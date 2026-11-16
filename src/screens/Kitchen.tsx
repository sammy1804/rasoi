import { CalendarOff, ChefHat, ChevronRight, Clock, ExternalLink, Pencil, Phone, Smartphone, UserPlus, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { CookDayView, LeaveList, LeaveSheet, VISIT_PRESETS, VisitsEditor, WeeklyOffPicker, WhatsAppButtons, type VisitDraft } from '@/components/kitchen'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Segmented } from '@/components/ui/segmented'
import { Sheet } from '@/components/ui/sheet'
import { DEFAULT_MEAL_TIMES, addCook, cookIsOff, allFoods, planOf, removeCook, setRecipeVideo, signInAsCook, updateCook, updateHousehold, updateMealTimes, type CookInput } from '@/data/repository'
import { READY_TO_SERVE } from '@/data/kitchen'
import type { Cook, CookLanguage, MealSlot, Weekday } from '@/data/types'
import { MEAL_SLOTS } from '@/data/types'
import { useSession } from '@/hooks/useSession'
import { addDays, todayISO, weekDates } from '@/lib/dates'
import { buildCookDay, cookMessage, fmtTime, videoUrl, visitLabel, weekMenuMessage } from '@/lib/kitchen'
import { SLOT_META } from '@/app/meta'
import { cn, uid } from '@/lib/utils'
import { TimingsSheet } from './CookApp'

/* ——————————————— Cook ——————————————— */

export function CookPanel() {
  const { db, member, household, cooks } = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const cook = cooks[0]
  const [editing, setEditing] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [timesOpen, setTimesOpen] = useState(false)
  const [videos, setVideos] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
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
  const cookDay = buildCookDay(db, cook, date, lang)
  const msg = cookMessage(cookDay, lang)
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
        <CookDayView day={cookDay} lang={lang} />
        {!off.off && (
          <div className="mt-4">
            <p className="mb-2 px-1 text-[13px] text-ink-soft">
              Send it {cook.phone ? `to ${cook.name}, or to your house group` : 'to your house group'}. The message ends with a link {cook.name} can tap to see this
              menu with pictures, hear it read aloud and open recipe videos — no app or login needed.
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

      <section className="overflow-hidden rounded-2xl border border-line/80 bg-card">
        <button onClick={() => setVideos(true)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
          <Video size={19} className="shrink-0 text-ink-soft" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Recipe videos</span>
            <span className="block text-[13px] text-ink-mute">
              {Object.keys(household.recipeVideos ?? {}).length
                ? `${Object.keys(household.recipeVideos ?? {}).length} chosen · others open a YouTube search`
                : 'Every dish opens a YouTube search. Pick your favourite video for any dish.'}
            </span>
          </span>
          <ChevronRight size={16} className="text-ink-mute" />
        </button>
        <button onClick={() => setReplyOpen(true)} className="flex w-full items-center gap-3 border-t border-line/60 px-4 py-3 text-left">
          <Phone size={18} className="shrink-0 text-ink-soft" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">{cook.name}’s replies go to</span>
            <span className="block text-[13px] text-ink-mute">{household.contactPhone ? `+${household.contactPhone} on WhatsApp` : 'Add your WhatsApp number so “done” and “not coming” reach you'}</span>
          </span>
          <ChevronRight size={16} className="text-ink-mute" />
        </button>
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
      <RecipeVideosSheet open={videos} onClose={() => setVideos(false)} />
      <ReplyNumberSheet open={replyOpen} onClose={() => setReplyOpen(false)} householdId={household.id} current={household.contactPhone} />
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


/* ——————————— Recipe videos & reply number ——————————— */

function RecipeVideosSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, household, cooks } = useSession()
  if (!household) return null
  const foods = allFoods(db)
  const plan = planOf(db, household.id)
  const ids = new Set<string>()
  for (const m of Object.values(db.meals)) {
    if (m.mealPlanId !== plan?.id) continue
    for (const it of m.items) for (const id of [it.foodId, ...(it.alts?.map((a) => a.foodId) ?? [])]) if (foods[id] && !READY_TO_SERVE.has(id)) ids.add(id)
  }
  const list = [...ids].map((id) => foods[id]).sort((a, b) => a.name.localeCompare(b.name))
  const lang = cooks[0]?.language ?? 'hi'
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Recipe videos" description="Paste a YouTube link for any dish you want made a particular way. Dishes without one open a YouTube search." className="h-[92dvh]">
      <ul className="space-y-2 pb-3">
        {list.map((f) => {
          const saved = household.recipeVideos?.[f.id] ?? ''
          return (
            <li key={f.id} className="rounded-2xl border border-line bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[15px] font-semibold">{f.name}</span>
                <a href={videoUrl({ name: f.name, hi: f.hi, video: saved || undefined }, lang)} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-clay">
                  {saved ? 'Open' : 'Find one'} <ExternalLink size={13} />
                </a>
              </div>
              <Input
                key={saved}
                defaultValue={saved}
                onBlur={(e) => e.target.value.trim() !== saved && setRecipeVideo(household.id, f.id, e.target.value)}
                placeholder="Paste a YouTube link"
                inputMode="url"
                aria-label={`Video link for ${f.name}`}
                className="mt-2 h-11"
              />
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

function ReplyNumberSheet({ open, onClose, householdId, current }: { open: boolean; onClose: () => void; householdId: string; current?: string }) {
  const [v, setV] = useState('')
  useEffect(() => {
    if (open) setV(current ? `+${current}` : '')
  }, [open, current])
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Your WhatsApp number"
      description="When the cook taps “Done” or “I’m not coming” on her link, the message comes to this number."
      footer={
        <Button size="lg" block onClick={() => { updateHousehold(householdId, { contactPhone: v }); onClose() }}>
          Save
        </Button>
      }
    >
      <Input type="tel" inputMode="tel" value={v} onChange={(e) => setV(e.target.value)} placeholder="98xxxxxxxx" aria-label="Your WhatsApp number" className="mb-2" />
    </Sheet>
  )
}
