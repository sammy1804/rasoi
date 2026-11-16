import { CalendarOff, Copy, MessageCircle, Moon, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SLOT_META } from '@/app/meta'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Field, Input } from '@/components/ui/field'
import { Sheet } from '@/components/ui/sheet'
import { addCookLeave, cookIsOff, leavesOf, removeCookLeave } from '@/data/repository'
import type { Cook, CookLanguage, CookVisit, DB, ISODate, MealSlot, Weekday } from '@/data/types'
import { MEAL_SLOTS } from '@/data/types'
import { WEEKDAY_SHORT, addDays, fmtShortDate, relativeDayLabel, todayISO, weekdayOf } from '@/lib/dates'
import {
  SLOT_EN,
  SLOT_HI,
  cookSlots,
  cookVisits,
  dayLabel,
  dishName,
  fmtTime,
  qtyFor,
  soakFor,
  usesLine,
  visitLabel,
  whatsappUrl,
} from '@/lib/kitchen'
import { ITEM_HI } from '@/data/kitchen'
import { cn } from '@/lib/utils'
import { copyText } from '@/screens/Invite'
import { useToast } from './Toast'

/* ——————————— The cook's menu for one day ——————————— */

export function CookMenu({ db, cook, date, lang, nameOf }: { db: DB; cook: Cook; date: ISODate; lang: CookLanguage; nameOf: (id: string) => string }) {
  const hi = lang === 'hi'
  const off = cookIsOff(db, cook, date)
  const visits = cookVisits(cook, cookSlots(db, cook.householdId, date, nameOf))
  const soak = soakFor(db, cook.householdId, addDays(date, 1))

  if (off.off) {
    return (
      <div className="rounded-3xl border border-dashed border-line px-5 py-8 text-center" data-testid="cook-off">
        <CalendarOff className="mx-auto text-ink-mute" size={26} />
        <p className="mt-3 text-[18px] font-semibold">{hi ? 'आज छुट्टी है' : 'Day off'}</p>
        <p className="mt-1 text-[15px] text-ink-soft">
          {off.reason === 'weekly' ? (hi ? 'यह आपकी साप्ताहिक छुट्टी है।' : 'Regular weekly day off.') : off.leave?.note ?? (hi ? 'छुट्टी दर्ज है।' : 'Marked as not coming.')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4" data-testid="cook-menu">
      {visits.map(({ visit, slots }) => (
        <section key={visit.id} className="overflow-hidden rounded-3xl border border-line/80 bg-card shadow-soft">
          <header className="flex items-baseline justify-between border-b border-line/70 px-5 py-3.5">
            <h3 className="font-display text-[22px] font-medium">{visitLabel(visit, lang)}</h3>
            <span className="text-[17px] font-semibold tabular">{fmtTime(visit.time)}</span>
          </header>
          {slots.every((s) => !s.dishes.length && !s.ready.length) && <p className="px-5 py-4 text-ink-mute">{hi ? 'कुछ नहीं' : 'Nothing planned'}</p>}
          {slots.map((s) =>
            !s.dishes.length && !s.ready.length ? null : (
              <div key={s.slot} className="border-t border-line/60 px-5 py-3.5 first-of-type:border-t-0">
                <p className="mb-2 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em] text-ink-soft">
                  <span className={cn('h-2.5 w-2.5 rounded-full', SLOT_META[s.slot].dot)} />
                  {hi ? SLOT_HI[s.slot] : SLOT_EN[s.slot]}
                  {s.time && <span className="font-semibold normal-case tracking-normal text-ink-mute">· {hi ? 'खाने का समय' : 'eat at'} {fmtTime(s.time)}</span>}
                </p>
                {s.dishes.length === 0 && <p className="text-[16px] text-ink-soft">{hi ? 'कुछ पकाना नहीं है' : 'Nothing to cook'}</p>}
                <ul className="space-y-3">
                  {s.dishes.map((d) => {
                    const note = [usesLine(d, lang), hi ? d.food.cookNoteHi : d.food.cookNote].filter(Boolean).join(' · ')
                    return (
                      <li key={d.food.id}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className={cn('text-[19px] font-semibold leading-snug', d.optional && 'text-ink-soft')}>
                            {dishName(d.food, lang)}
                            {d.optional && <span className="ml-2 text-[13px] font-medium text-ink-mute">{hi ? 'अगर चाहिए' : 'optional'}</span>}
                          </span>
                          <span className="shrink-0 text-[19px] font-bold tabular">{qtyFor(d.food, d.total, d.unit, lang)}</span>
                        </div>
                        {d.per.length > 1 && (
                          <p className="text-[14px] text-ink-soft">{d.per.map((p) => `${p.name} ${qtyFor(d.food, p.amount, d.unit, lang)}`).join(' · ')}</p>
                        )}
                        {note && <p className="text-[14px] text-ink-mute">{note}</p>}
                      </li>
                    )
                  })}
                </ul>
                {s.ready.length > 0 && (
                  <p className="mt-2 text-[14px] text-ink-mute">
                    {hi ? 'साथ में दें' : 'Also serve'}: {s.ready.map((f) => dishName(f, lang)).join(', ')}
                  </p>
                )}
              </div>
            ),
          )}
        </section>
      ))}
      {soak.length > 0 && (
        <div className="flex gap-3 rounded-2xl bg-clay-soft px-4 py-3.5 text-clay-deep">
          <Moon size={20} className="mt-0.5 shrink-0" />
          <p className="text-[16px] font-semibold leading-snug">
            {hi ? 'आज रात भिगोएँ (कल के लिए): ' : 'Soak tonight for tomorrow: '}
            {soak.map((x) => `${hi ? ITEM_HI[x.item] ?? x.item : x.item} ${x.qty} ${hi ? 'ग्राम' : 'g'}`).join(', ')}
          </p>
        </div>
      )}
    </div>
  )
}

/* ——————————— Timings editor ——————————— */

export type VisitDraft = Omit<CookVisit, 'id'> & { id?: string }

export const VISIT_PRESETS: { label: string; visits: VisitDraft[] }[] = [
  {
    label: 'Morning & evening',
    visits: [
      { label: 'Morning', time: '07:45', slots: ['breakfast', 'lunch'] },
      { label: 'Evening', time: '18:30', slots: ['snack', 'dinner'] },
    ],
  },
  { label: 'Once, in the morning', visits: [{ label: 'Morning', time: '09:00', slots: ['breakfast', 'lunch', 'snack', 'dinner'] }] },
  { label: 'Only evenings', visits: [{ label: 'Evening', time: '18:30', slots: ['dinner'] }] },
]

export function VisitsEditor({ visits, onChange, lang = 'en' }: { visits: VisitDraft[]; onChange: (v: VisitDraft[]) => void; lang?: CookLanguage }) {
  const hi = lang === 'hi'
  const set = (i: number, patch: Partial<VisitDraft>) => onChange(visits.map((v, j) => (j === i ? { ...v, ...patch } : v)))
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {VISIT_PRESETS.map((p) => (
          <Chip key={p.label} active={JSON.stringify(p.visits.map(({ label, time, slots }) => ({ label, time, slots }))) === JSON.stringify(visits.map(({ label, time, slots }) => ({ label, time, slots })))} onClick={() => onChange(p.visits.map((v) => ({ ...v, slots: [...v.slots] })))}>
            {p.label}
          </Chip>
        ))}
      </div>
      {visits.map((v, i) => (
        <div key={i} className="rounded-2xl border border-line bg-card p-3.5">
          <div className="flex items-center gap-2">
            <Input aria-label={hi ? 'नाम' : 'Visit name'} value={v.label} onChange={(e) => set(i, { label: e.target.value })} className="h-11 min-w-0 flex-1" />
            <Input aria-label={hi ? 'समय' : 'Arrives at'} type="time" value={v.time} onChange={(e) => set(i, { time: e.target.value || v.time })} className="h-11 w-[142px] shrink-0 px-3 tabular" />
            {visits.length > 1 && (
              <button onClick={() => onChange(visits.filter((_, j) => j !== i))} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-mute hover:bg-sand" aria-label="Remove visit">
                <X size={16} />
              </button>
            )}
          </div>
          <p className="mb-1.5 mt-3 text-[12px] font-semibold text-ink-soft">{hi ? 'कौन सा खाना बनाती हैं' : 'Cooks'}</p>
          <div className="flex flex-wrap gap-1.5">
            {MEAL_SLOTS.map((slot) => (
              <Chip
                key={slot}
                active={v.slots.includes(slot)}
                onClick={() => set(i, { slots: v.slots.includes(slot) ? v.slots.filter((x) => x !== slot) : MEAL_SLOTS.filter((x) => x === slot || v.slots.includes(x)) })}
                className="h-8 px-3"
              >
                {hi ? SLOT_HI[slot] : SLOT_EN[slot]}
              </Chip>
            ))}
          </div>
        </div>
      ))}
      {visits.length < 3 && (
        <Button variant="ghost" size="sm" onClick={() => onChange([...visits, { label: 'Afternoon', time: '13:00', slots: [] as MealSlot[] }])}>
          <Plus size={15} /> {hi ? 'एक और समय' : 'Add another visit'}
        </Button>
      )}
    </div>
  )
}

export function WeeklyOffPicker({ value, onChange }: { value: Weekday[]; onChange: (v: Weekday[]) => void }) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEKDAY_SHORT.map((d, i) => {
        const on = value.includes(i as Weekday)
        return (
          <button
            key={d}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== i) : ([...value, i] as Weekday[]).sort())}
            className={cn('h-10 rounded-xl text-[13px] font-semibold transition focus-ring', on ? 'bg-ink text-paper' : 'bg-sand text-ink-soft')}
          >
            {d.slice(0, 2)}
          </button>
        )
      })}
    </div>
  )
}

/* ——————————— Leave ——————————— */

export function LeaveSheet({ open, onClose, db, cook, byUserId, lang = 'en' }: { open: boolean; onClose: () => void; db: DB; cook: Cook; byUserId: string; lang?: CookLanguage }) {
  const hi = lang === 'hi'
  const today = todayISO()
  const [dates, setDates] = useState<ISODate[]>([])
  const [custom, setCustom] = useState('')
  const [note, setNote] = useState('')
  const toast = useToast()
  useEffect(() => {
    if (open) {
      setDates([])
      setNote('')
      setCustom('')
    }
  }, [open])
  const toggle = (d: ISODate) => setDates((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d].sort()))
  const quick = [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(today, n))
  const upcoming = leavesOf(db, cook.id).filter((l) => l.date >= today)
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={hi ? 'छुट्टी बताएँ' : `When is ${cook.name} not coming?`}
      description={hi ? 'जिन दिनों आप नहीं आएँगी, उन्हें चुनें।' : 'Pick the days. The family sees it on their home screen.'}
      footer={
        <Button
          size="lg"
          block
          disabled={dates.length === 0}
          onClick={() => {
            addCookLeave(cook.id, dates, byUserId, note)
            toast({ text: hi ? 'छुट्टी दर्ज हो गई' : `Saved — ${dates.length} day${dates.length > 1 ? 's' : ''} off` })
            onClose()
          }}
        >
          {hi ? 'सेव करें' : 'Save'}
        </Button>
      }
    >
      <div className="space-y-5 pb-2">
        <div className="grid grid-cols-4 gap-1.5">
          {quick.map((d, i) => {
            const on = dates.includes(d)
            const already = upcoming.some((l) => l.date === d)
            return (
              <button
                key={d}
                disabled={already}
                onClick={() => toggle(d)}
                aria-pressed={on}
                className={cn(
                  'flex h-16 flex-col items-center justify-center rounded-2xl text-center transition focus-ring disabled:opacity-40',
                  on ? 'bg-ink text-paper' : 'bg-sand text-ink',
                )}
              >
                <span className="text-[14px] font-semibold">{i === 0 ? (hi ? 'आज' : 'Today') : i === 1 ? (hi ? 'कल' : 'Tomorrow') : WEEKDAY_SHORT[weekdayOf(d)]}</span>
                <span className={cn('text-[12px]', on ? 'text-paper/70' : 'text-ink-mute')}>{fmtShortDate(d)}</span>
              </button>
            )
          })}
        </div>
        <Field label={hi ? 'कोई और तारीख' : 'Another date'}>
          <div className="flex gap-2">
            <Input type="date" min={today} value={custom} onChange={(e) => setCustom(e.target.value)} />
            <Button variant="secondary" className="h-12" disabled={!custom} onClick={() => custom && (toggle(custom), setCustom(''))}>
              {hi ? 'जोड़ें' : 'Add'}
            </Button>
          </div>
        </Field>
        {dates.some((d) => !quick.includes(d)) && (
          <div className="flex flex-wrap gap-1.5">
            {dates.filter((d) => !quick.includes(d)).map((d) => (
              <Chip key={d} active onClick={() => toggle(d)}>
                {fmtShortDate(d)} <X size={13} />
              </Chip>
            ))}
          </div>
        )}
        <Field label={hi ? 'वजह (ज़रूरी नहीं)' : 'Note (optional)'}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={hi ? 'जैसे: गाँव जा रही हूँ' : 'e.g. going to the village'} />
        </Field>
      </div>
    </Sheet>
  )
}

export function LeaveList({ db, cook, lang = 'en', canEdit = true }: { db: DB; cook: Cook; lang?: CookLanguage; canEdit?: boolean }) {
  const hi = lang === 'hi'
  const today = todayISO()
  const upcoming = leavesOf(db, cook.id).filter((l) => l.date >= today)
  const weekly = cook.weeklyOff.map((d) => WEEKDAY_SHORT[d]).join(', ')
  return (
    <div data-testid="leave-list">
      {weekly && (
        <p className="mb-2 text-[14px] text-ink-soft">
          {hi ? 'साप्ताहिक छुट्टी' : 'Weekly off'}: <b>{weekly}</b>
        </p>
      )}
      {upcoming.length === 0 ? (
        <p className="text-[14px] text-ink-mute">{hi ? 'कोई छुट्टी दर्ज नहीं।' : 'No days off coming up.'}</p>
      ) : (
        <ul className="divide-y divide-line/70 overflow-hidden rounded-2xl border border-line/80 bg-card">
          {upcoming.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-4 py-3">
              <CalendarOff size={18} className="shrink-0 text-clay" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{hi ? dayLabel(l.date, 'hi') : `${relativeDayLabel(l.date)}, ${fmtShortDate(l.date)}`}</span>
                {l.note && <span className="block truncate text-[13px] text-ink-mute">{l.note}</span>}
              </span>
              {canEdit && (
                <button onClick={() => removeCookLeave(l.id)} className="grid h-9 w-9 place-items-center rounded-full text-ink-mute hover:bg-sand hover:text-ink" aria-label={`Remove day off on ${l.date}`}>
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ——————————— WhatsApp ——————————— */

/** Opens WhatsApp with the message typed in. With a phone it opens that chat; without, WhatsApp asks who to send to (pick the group). */
export function WhatsAppButtons({ text, phone, toLabel, compact }: { text: string; phone?: string; toLabel?: string; compact?: boolean }) {
  const toast = useToast()
  return (
    <div className={cn('flex flex-wrap gap-2', compact && 'flex-nowrap')}>
      {phone && (
        <a
          href={whatsappUrl(text, phone)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-wa px-4 text-[14px] font-semibold text-white shadow-soft transition active:scale-[0.97] focus-ring"
        >
          <MessageCircle size={17} /> {toLabel ?? 'Send on WhatsApp'}
        </a>
      )}
      <a
        href={whatsappUrl(text)}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition active:scale-[0.97] focus-ring',
          phone ? 'border border-line bg-card text-ink' : 'bg-wa text-white shadow-soft',
        )}
      >
        <MessageCircle size={17} /> {phone ? 'Share to group' : 'Share on WhatsApp'}
      </a>
      <button
        onClick={async () => {
          const ok = await copyText(text)
          toast({ text: ok ? 'Copied — paste it anywhere' : 'Couldn’t copy' })
        }}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-card px-4 text-[14px] font-semibold text-ink transition active:scale-[0.97] focus-ring"
        aria-label="Copy message"
      >
        <Copy size={16} /> {compact ? '' : 'Copy'}
      </button>
    </div>
  )
}
