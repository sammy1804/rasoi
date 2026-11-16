import { CalendarOff, ChefHat, Clock, ExternalLink, Pencil, Phone, Smartphone, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { CookMenu, LeaveList, LeaveSheet, VISIT_PRESETS, VisitsEditor, WeeklyOffPicker, WhatsAppButtons, type VisitDraft } from '@/components/kitchen'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Segmented } from '@/components/ui/segmented'
import { Sheet } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { DEFAULT_MEAL_TIMES, addCook, cookIsOff, groceryKey, removeCook, setGroceryChecked, signInAsCook, updateCook, updateMealTimes, type CookInput } from '@/data/repository'
import { zeptoSearchUrl } from '@/data/kitchen'
import type { Cook, CookLanguage, MealSlot, Weekday } from '@/data/types'
import { MEAL_SLOTS } from '@/data/types'
import { useSession } from '@/hooks/useSession'
import { addDays, fmtShortDate, startOfWeek, todayISO, weekDates } from '@/lib/dates'
import { GROUP_ORDER, cookMessage, fmtGroceryQty, fmtTime, groceryList, groceryMessage, visitLabel, weekMenuMessage } from '@/lib/kitchen'
import { SLOT_META } from '@/app/meta'
import { cn, uid } from '@/lib/utils'
import { TimingsSheet } from './CookApp'

/* ——————————————— Cook ——————————————— */

export function CookPanel() {
  const { db, member, household, cooks, nameOf } = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const cook = cooks[0]
  const [editing, setEditing] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [timesOpen, setTimesOpen] = useState(false)
  const [day, setDay] = useState<'today' | 'tomorrow'>(() => (new Date().getHours() >= 20 ? 'tomorrow' : 'today'))
  const [lang, setLang] = useState<CookLanguage>(cook?.language ?? 'hi')
  useEffect(() => {
    if (cook) setLang(cook.language)
  }, [cook?.id, cook?.language])
  if (!household || !member) return null

  if (!cook) {
    return (
      <>
        <div className="rounded-3xl border border-dashed border-line px-6 py-9 text-center" data-testid="no-cook">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-clay-soft text-clay-deep">
            <ChefHat size={22} />
          </span>
          <p className="mt-4 text-[17px] font-semibold">Have a cook?</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">
            Add them once. Rasoi works out how much to make for both of you, and sends the day’s menu on WhatsApp in Hindi or English.
          </p>
          <Button className="mt-5" onClick={() => setEditing(true)}>
            <UserPlus size={16} /> Add your cook
          </Button>
        </div>
        <MealTimesCard />
        <CookFormSheet open={editing} onClose={() => setEditing(false)} householdId={household.id} />
      </>
    )
  }

  const date = day === 'today' ? todayISO() : addDays(todayISO(), 1)
  const off = cookIsOff(db, cook, date)
  const msg = cookMessage(db, cook, date, nameOf, lang)
  const week = weekDates(todayISO()).filter((d) => d >= todayISO())

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-line/80 bg-card p-4 shadow-soft" data-testid="cook-card">
        <div className="flex items-center gap-3">
          <Avatar name={cook.name} hue={2} size={48} />
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-semibold">{cook.name}</p>
            <p className="truncate text-[13px] text-ink-mute">
              {cook.visits.map((v) => `${v.label} ${fmtTime(v.time)}`).join(' · ')} · {cook.language === 'hi' ? 'Hindi' : 'English'}
            </p>
          </div>
          <button onClick={() => setEditing(true)} className="grid h-10 w-10 place-items-center rounded-full text-ink-mute hover:bg-sand hover:text-ink" aria-label={`Edit ${cook.name}`}>
            <Pencil size={16} />
          </button>
        </div>
        <TodayStatus cook={cook} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => setLeaveOpen(true)}>
            <CalendarOff size={15} /> Mark a day off
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTimesOpen(true)}>
            <Clock size={15} /> Timings
          </Button>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-mute">What {cook.name} will see</h2>
          <Segmented
            size="sm"
            className="w-[120px]"
            value={lang}
            onChange={setLang}
            options={[
              { value: 'hi', label: 'हिंदी' },
              { value: 'en', label: 'Eng' },
            ]}
          />
        </div>
        <Segmented
          className="mb-3"
          value={day}
          onChange={setDay}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'tomorrow', label: 'Tomorrow' },
          ]}
        />
        <CookMenu db={db} cook={cook} date={date} lang={lang} nameOf={nameOf} />
        {!off.off && (
          <div className="mt-4">
            <p className="mb-2 px-1 text-[13px] text-ink-soft">
              Send it {cook.phone ? `to ${cook.name}, or to your house group` : 'to your house group'} — WhatsApp opens with the message ready.
            </p>
            <WhatsAppButtons text={msg} phone={cook.phone} toLabel={`Send to ${cook.name}`} />
            {!cook.phone && (
              <button onClick={() => setEditing(true)} className="mt-2 inline-flex items-center gap-1.5 px-1 text-[13px] font-semibold text-clay">
                <Phone size={14} /> Add {cook.name}’s WhatsApp number to message her directly
              </button>
            )}
          </div>
        )}
        <details className="mt-4 rounded-2xl bg-sand/60 px-4 py-3">
          <summary className="cursor-pointer select-none text-[14px] font-semibold">Send the rest of this week’s menu</summary>
          <p className="mt-2 text-[13px] text-ink-soft">Good for planning shopping together. Daily messages include exact amounts.</p>
          <div className="mt-3">
            <WhatsAppButtons text={weekMenuMessage(db, household.id, week, lang)} phone={cook.phone} toLabel={`Send to ${cook.name}`} />
          </div>
        </details>
      </section>

      <section>
        <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-mute">Days off</h2>
        <LeaveList db={db} cook={cook} />
      </section>

      <MealTimesCard />

      <section className="rounded-2xl border border-line/80 bg-card p-4">
        <p className="flex items-center gap-2 text-[15px] font-semibold">
          <Smartphone size={17} /> {cook.name}’s own screen
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
          A big-text view of just what to cook, in {cook.language === 'hi' ? 'Hindi' : 'English'}, where {cook.name} can mark days off and change timings. Use it on a kitchen phone or tablet.
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => {
            signInAsCook(cook.id)
            navigate('/')
            toast({ text: `This phone now shows ${cook.name}’s view` })
          }}
        >
          Open {cook.name}’s view on this phone
        </Button>
      </section>

      <CookFormSheet open={editing} onClose={() => setEditing(false)} householdId={household.id} cook={cook} />
      <LeaveSheet open={leaveOpen} onClose={() => setLeaveOpen(false)} db={db} cook={cook} byUserId={member.userId} />
      <TimingsSheet open={timesOpen} onClose={() => setTimesOpen(false)} cookId={cook.id} visits={cook.visits} weeklyOff={cook.weeklyOff} />
    </div>
  )
}

function TodayStatus({ cook }: { cook: Cook }) {
  const { db } = useSession()
  const today = todayISO()
  const off = cookIsOff(db, cook, today)
  const tomorrowOff = cookIsOff(db, cook, addDays(today, 1))
  return (
    <div className={cn('mt-3 rounded-2xl px-3.5 py-2.5 text-[14px]', off.off ? 'bg-clay-soft text-clay-deep' : 'bg-sand/70 text-ink-soft')}>
      {off.off ? (
        <b>Off today{off.leave?.note ? ` — ${off.leave.note}` : off.reason === 'weekly' ? ' (weekly day off)' : ''}</b>
      ) : (
        <>
          Coming today: <b className="text-ink">{cook.visits.map((v) => `${visitLabel(v, 'en').toLowerCase()} ${fmtTime(v.time)}`).join(' & ')}</b>
        </>
      )}
      {tomorrowOff.off && !off.off && <span className="block text-clay-deep">Off tomorrow{tomorrowOff.leave?.note ? ` — ${tomorrowOff.leave.note}` : ''}</span>}
    </div>
  )
}

export function MealTimesCard() {
  const { household } = useSession()
  const [open, setOpen] = useState(false)
  if (!household) return null
  const times = household.mealTimes ?? DEFAULT_MEAL_TIMES
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-mute">Household meal times</h2>
        <button onClick={() => setOpen(true)} className="rounded-full px-2.5 py-1 text-[13px] font-semibold text-clay hover:bg-clay-soft">
          Edit
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {MEAL_SLOTS.map((s) => (
          <div key={s} className="rounded-2xl border border-line/80 bg-card px-2 py-2.5 text-center">
            <span className={cn('mx-auto block h-1.5 w-1.5 rounded-full', SLOT_META[s].dot)} />
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{SLOT_META[s].label}</p>
            <p className="text-[14px] font-semibold tabular">{fmtTime(times[s])}</p>
          </div>
        ))}
      </div>
      <MealTimesSheet open={open} onClose={() => setOpen(false)} householdId={household.id} times={times} />
    </section>
  )
}

export function MealTimesEditor({ value, onChange }: { value: Record<MealSlot, string>; onChange: (v: Record<MealSlot, string>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {MEAL_SLOTS.map((s) => (
        <Field key={s} label={SLOT_META[s].label}>
          <Input type="time" value={value[s]} onChange={(e) => onChange({ ...value, [s]: e.target.value || value[s] })} className="tabular" />
        </Field>
      ))}
    </div>
  )
}

function MealTimesSheet({ open, onClose, householdId, times }: { open: boolean; onClose: () => void; householdId: string; times: Record<MealSlot, string> }) {
  const [v, setV] = useState(times)
  useEffect(() => {
    if (open) setV(times)
  }, [open, times])
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Meal times"
      description="When you usually eat. The cook sees these with the menu."
      footer={
        <Button size="lg" block onClick={() => { updateMealTimes(householdId, v); onClose() }}>
          Save
        </Button>
      }
    >
      <MealTimesEditor value={v} onChange={setV} />
    </Sheet>
  )
}

/* ——————————— Add / edit cook ——————————— */

export function CookForm({ value, onChange }: { value: CookInput; onChange: (v: CookInput) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Name">
        <Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="e.g. Sunita" autoComplete="off" />
      </Field>
      <Field label="WhatsApp number (optional)" hint="So you can send the menu straight to their chat.">
        <Input
          type="tel"
          inputMode="tel"
          value={value.phone ?? ''}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
          placeholder="98xxxxxxxx"
          autoComplete="off"
        />
      </Field>
      <Field label="Language for the menu">
        <Segmented
          value={value.language}
          onChange={(l) => onChange({ ...value, language: l })}
          options={[
            { value: 'hi', label: 'हिंदी' },
            { value: 'en', label: 'English' },
          ]}
        />
      </Field>
      <div>
        <p className="mb-2 text-[13px] font-semibold text-ink-soft">When do they come?</p>
        <VisitsEditor visits={value.visits} onChange={(visits) => onChange({ ...value, visits })} />
      </div>
      <div>
        <p className="mb-2 text-[13px] font-semibold text-ink-soft">Regular day off</p>
        <WeeklyOffPicker value={value.weeklyOff} onChange={(weeklyOff: Weekday[]) => onChange({ ...value, weeklyOff })} />
      </div>
    </div>
  )
}

export const emptyCook = (): CookInput => ({ name: '', phone: '', language: 'hi', visits: VISIT_PRESETS[0].visits.map((v) => ({ ...v, slots: [...v.slots] })), weeklyOff: [] })

function CookFormSheet({ open, onClose, householdId, cook }: { open: boolean; onClose: () => void; householdId: string; cook?: Cook }) {
  const [v, setV] = useState<CookInput>(emptyCook())
  const [confirmRemove, setConfirmRemove] = useState(false)
  useEffect(() => {
    if (open) {
      setConfirmRemove(false)
      setV(cook ? { name: cook.name, phone: cook.phone ? `+${cook.phone}` : '', language: cook.language, visits: cook.visits.map((x) => ({ ...x, slots: [...x.slots] })), weeklyOff: [...cook.weeklyOff] } : emptyCook())
    }
  }, [open, cook])
  const valid = v.name.trim() && v.visits.length > 0 && v.visits.every((x) => x.slots.length > 0)
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={cook ? `Edit ${cook.name}` : 'Add your cook'}
      footer={
        <div className="flex gap-2">
          {cook && (
            <Button variant="danger" size="lg" onClick={() => (confirmRemove ? (removeCook(cook.id), onClose()) : setConfirmRemove(true))}>
              {confirmRemove ? 'Tap to confirm' : 'Remove'}
            </Button>
          )}
          <Button
            size="lg"
            block
            disabled={!valid}
            onClick={() => {
              if (cook) updateCook(cook.id, { name: v.name.trim(), phone: v.phone, language: v.language, visits: v.visits.map((x) => ({ ...x, id: (x as VisitDraft).id ?? uid('visit') })), weeklyOff: v.weeklyOff })
              else addCook(householdId, v)
              onClose()
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      <CookForm value={v} onChange={setV} />
    </Sheet>
  )
}

/* ——————————————— Groceries ——————————————— */

export function GroceriesPanel() {
  const { db, household } = useSession()
  const [range, setRange] = useState<'rest' | 'next7'>('rest')
  const [hideBought, setHideBought] = useState(false)
  const today = todayISO()
  const dates = useMemo(
    () => (range === 'rest' ? weekDates(today).filter((d) => d >= today) : Array.from({ length: 7 }, (_, i) => addDays(today, i + 1))),
    [range, today],
  )
  const lines = useMemo(() => (household ? groceryList(db, household.id, dates) : []), [db, household, dates])
  if (!household) return null
  const weekStart = startOfWeek(dates[0])
  const isChecked = (item: string) => !!db.groceryChecks[groceryKey(household.id, weekStart, item)]?.checked
  const fresh = lines.filter((l) => !l.pantry)
  const bought = lines.filter((l) => isChecked(l.item)).length
  const title = `Groceries · ${fmtShortDate(dates[0])}–${fmtShortDate(dates[dates.length - 1])}`

  return (
    <div className="space-y-4" data-testid="groceries">
      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: 'rest', label: 'Rest of this week' },
          { value: 'next7', label: 'Next 7 days' },
        ]}
      />
      <section className="rounded-3xl border border-line/80 bg-card p-4 shadow-soft">
        <p className="text-[13px] font-semibold text-ink-soft">{title}</p>
        <p className="mt-1 font-display text-[22px] font-medium leading-tight">
          {fresh.length} fresh items <span className="text-ink-mute">· {lines.length - fresh.length} staples to check</span>
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand">
          <div className="h-full rounded-full bg-meal-lunch transition-all" style={{ width: `${lines.length ? (bought / lines.length) * 100 : 0}%` }} />
        </div>
        <p className="mt-1.5 text-[12px] text-ink-mute tabular">{bought} of {lines.length} ticked off</p>
        <div className="mt-4">
          <WhatsAppButtons text={groceryMessage(lines.filter((l) => !isChecked(l.item)), title)} />
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-mute">
          Amounts are for both of you, from your planned portions. Zepto doesn’t offer an API for adding to a cart, so each item opens Zepto search.
        </p>
      </section>

      <div className="flex items-center justify-between px-1">
        <span className="text-[14px] font-semibold">Hide ticked items</span>
        <Switch checked={hideBought} onChange={setHideBought} label="Hide ticked items" />
      </div>

      {GROUP_ORDER.map((g) => {
        const ls = lines.filter((l) => l.group === g && !(hideBought && isChecked(l.item)))
        if (!ls.length) return null
        return (
          <section key={g}>
            <h3 className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-mute">{g}</h3>
            <ul className="overflow-hidden rounded-2xl border border-line/80 bg-card">
              {ls.map((l) => {
                const checked = isChecked(l.item)
                return (
                  <li key={l.item} className="flex items-center gap-2 border-t border-line/60 py-1.5 pl-2 pr-2 first:border-t-0">
                    <button
                      onClick={() => setGroceryChecked(household.id, weekStart, l.item, !checked)}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full focus-ring"
                      aria-pressed={checked}
                      aria-label={`${checked ? 'Untick' : 'Tick'} ${l.item}`}
                    >
                      <span className={cn('grid h-6 w-6 place-items-center rounded-md border-2 transition', checked ? 'border-ink bg-ink text-paper' : 'border-line bg-card')}>
                        {checked && (
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5">
                            <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                    </button>
                    <span className="min-w-0 flex-1 py-1">
                      <span className={cn('block text-[15px] font-semibold', checked && 'text-ink-mute line-through')}>
                        {l.item}
                        {l.soak && <span className="ml-1.5 rounded-full bg-meal-dinner/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-meal-dinner">soak</span>}
                      </span>
                      <span className="block truncate text-[12px] text-ink-mute">
                        {l.pantry ? 'Check the pantry · ' : ''}for {l.for.slice(0, 3).join(', ')}
                        {l.for.length > 3 ? ` +${l.for.length - 3}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-[14px] font-semibold tabular">{fmtGroceryQty(l)}</span>
                    <a
                      href={zeptoSearchUrl(l.item)}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-1 inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-sand px-2.5 text-[12px] font-bold text-ink-soft hover:text-ink focus-ring"
                      aria-label={`Search ${l.item} on Zepto`}
                    >
                      Zepto <ExternalLink size={12} />
                    </a>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      {lines.length === 0 && <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-mute">Nothing planned for these days.</p>}
    </div>
  )
}
