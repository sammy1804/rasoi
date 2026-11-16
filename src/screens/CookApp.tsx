import { CalendarOff, Clock, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CookMenu, LeaveList, LeaveSheet, VisitsEditor, WeeklyOffPicker, type VisitDraft } from '@/components/kitchen'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Sheet } from '@/components/ui/sheet'
import { allFoods, cookIsOff, mealFor, signOut, updateCook } from '@/data/repository'
import type { CookLanguage, Weekday } from '@/data/types'
import { useSession } from '@/hooks/useSession'
import { addDays, todayISO, weekDates, weekdayOf } from '@/lib/dates'
import { SLOT_EN, SLOT_HI, dayLabel, dishName, fmtTime, visitLabel } from '@/lib/kitchen'
import { cn, uid } from '@/lib/utils'

type View = 'today' | 'tomorrow' | 'week'

/** The cook's interface: big type, one job — what to cook, how much, when. */
export function CookApp() {
  const { db, cook, household, nameOf } = useSession()
  const navigate = useNavigate()
  const [view, setView] = useState<View>('today')
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [timesOpen, setTimesOpen] = useState(false)
  if (!cook || !household) return null
  const lang = cook.language
  const hi = lang === 'hi'
  const today = todayISO()
  const date = view === 'tomorrow' ? addDays(today, 1) : today
  const now = new Date()
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const nextVisit = [...cook.visits].sort((a, b) => a.time.localeCompare(b.time)).find((v) => v.time >= hhmm)
  const offToday = cookIsOff(db, cook, today)
  const setLang = (l: CookLanguage) => updateCook(cook.id, { language: l })
  const foods = allFoods(db)

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-paper px-4 pb-[max(32px,env(safe-area-inset-bottom))] pt-safe" data-testid="cook-app">
      <header className="flex items-start justify-between gap-3 pt-5">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-clay">{household.name}</p>
          <h1 className="mt-0.5 font-display text-[30px] font-medium leading-tight tracking-tight">{hi ? `नमस्ते, ${cook.name} जी` : `Namaste, ${cook.name}`}</h1>
        </div>
        <Segmented
          size="sm"
          className="mt-1 w-[132px] shrink-0"
          value={lang}
          onChange={setLang}
          options={[
            { value: 'hi', label: 'हिंदी' },
            { value: 'en', label: 'English' },
          ]}
        />
      </header>

      <p className="mt-2 flex items-center gap-2 text-[16px] text-ink-soft">
        <Clock size={17} />
        {offToday.off
          ? hi ? 'आज आपकी छुट्टी है' : 'You’re off today'
          : nextVisit
            ? hi ? `अगली बार: ${visitLabel(nextVisit, lang)} ${fmtTime(nextVisit.time)}` : `Next: ${visitLabel(nextVisit, lang)} at ${fmtTime(nextVisit.time)}`
            : hi ? 'आज का काम पूरा' : 'All done for today'}
      </p>

      <Segmented
        className="mt-5"
        value={view}
        onChange={setView}
        options={[
          { value: 'today', label: hi ? 'आज' : 'Today' },
          { value: 'tomorrow', label: hi ? 'कल' : 'Tomorrow' },
          { value: 'week', label: hi ? 'हफ़्ता' : 'Week' },
        ]}
      />

      {view !== 'week' ? (
        <>
          <h2 className="mb-3 mt-5 text-[17px] font-semibold">{dayLabel(date, lang)}</h2>
          <CookMenu db={db} cook={cook} date={date} lang={lang} nameOf={nameOf} />
        </>
      ) : (
        <div className="mt-5 space-y-2">
          {weekDates(today).map((d) => {
            const off = cookIsOff(db, cook, d)
            return (
              <div key={d} className={cn('rounded-2xl border bg-card px-4 py-3', d === today ? 'border-ink/60' : 'border-line/80', d < today && 'opacity-50')}>
                <p className="flex items-center justify-between text-[16px] font-semibold">
                  {dayLabel(d, lang)}
                  {off.off && <span className="rounded-full bg-clay-soft px-2 py-0.5 text-[12px] text-clay-deep">{hi ? 'छुट्टी' : 'Off'}</span>}
                </p>
                {!off.off &&
                  cook.visits.flatMap((v) => v.slots).map((slot) => {
                    const meal = mealFor(db, household.id, weekdayOf(d), slot)
                    const names = (meal?.items ?? []).filter((i) => !i.optional && !i.onlyFor).map((i) => foods[i.foodId] && dishName(foods[i.foodId], lang)).filter(Boolean)
                    return (
                      <p key={slot} className="mt-1 text-[14px] leading-snug text-ink-soft">
                        <b className="text-ink">{hi ? SLOT_HI[slot] : SLOT_EN[slot]}:</b> {names.join(', ')}
                      </p>
                    )
                  })}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button size="lg" variant="outline" className="h-16 rounded-2xl text-[16px]" onClick={() => setLeaveOpen(true)}>
          <CalendarOff size={20} /> {hi ? 'मैं नहीं आऊँगी' : 'I’m not coming'}
        </Button>
        <Button size="lg" variant="outline" className="h-16 rounded-2xl text-[16px]" onClick={() => setTimesOpen(true)}>
          <Clock size={20} /> {hi ? 'मेरा समय' : 'My timings'}
        </Button>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-mute">{hi ? 'आने वाली छुट्टियाँ' : 'Days off'}</h2>
        <LeaveList db={db} cook={cook} lang={lang} />
      </section>

      <button
        onClick={() => {
          signOut()
          navigate('/welcome')
        }}
        className="mx-auto mt-8 flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold text-ink-mute hover:bg-sand"
      >
        <LogOut size={16} /> {hi ? `${cook.name} नहीं हैं? बाहर निकलें` : `Not ${cook.name}? Sign out`}
      </button>

      <LeaveSheet open={leaveOpen} onClose={() => setLeaveOpen(false)} db={db} cook={cook} byUserId={cook.userId ?? cook.id} lang={lang} />
      <TimingsSheet open={timesOpen} onClose={() => setTimesOpen(false)} cookId={cook.id} visits={cook.visits} weeklyOff={cook.weeklyOff} lang={lang} />
    </div>
  )
}

export function TimingsSheet({
  open,
  onClose,
  cookId,
  visits,
  weeklyOff,
  lang = 'en',
}: {
  open: boolean
  onClose: () => void
  cookId: string
  visits: VisitDraft[]
  weeklyOff: Weekday[]
  lang?: CookLanguage
}) {
  const hi = lang === 'hi'
  const [v, setV] = useState<VisitDraft[]>(visits)
  const [off, setOff] = useState<Weekday[]>(weeklyOff)
  useEffect(() => {
    if (open) {
      setV(visits.map((x) => ({ ...x, slots: [...x.slots] })))
      setOff(weeklyOff)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={hi ? 'मेरा समय' : 'Timings'}
      description={hi ? 'आप कब आती हैं और कौन सा खाना बनाती हैं।' : 'When the cook comes, and which meals each visit covers.'}
      footer={
        <Button
          size="lg"
          block
          disabled={v.length === 0 || v.some((x) => x.slots.length === 0)}
          onClick={() => {
            updateCook(cookId, { visits: v.map((x) => ({ ...x, id: x.id ?? uid('visit') })), weeklyOff: off })
            onClose()
          }}
        >
          {hi ? 'सेव करें' : 'Save timings'}
        </Button>
      }
    >
      <div className="space-y-5 pb-2">
        <VisitsEditor visits={v} onChange={setV} lang={lang} />
        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink-soft">{hi ? 'साप्ताहिक छुट्टी' : 'Weekly day off'}</p>
          <WeeklyOffPicker value={off} onChange={setOff} />
        </div>
      </div>
    </Sheet>
  )
}
