import { CalendarOff, Check, Clock, Home, LogOut, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CookDayView, LeaveList, VisitsEditor, WeeklyOffPicker, type VisitDraft } from '@/components/kitchen'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Field, Input } from '@/components/ui/field'
import { Segmented } from '@/components/ui/segmented'
import { Sheet } from '@/components/ui/sheet'
import { DEMO_CODE, DEMO_CODE_2, ensureDemoHouse, isDemoCode } from '@/data/demo'
import {
  addCookLeave,
  addHouseByCode,
  cookIsOff,
  importHouse,
  importedHousesOf,
  leaveLocalHouse,
  localCooksOf,
  membersOf,
  removeCookHouse,
  signOut,
  updateCook,
  updateCookAccount,
  updateCookHouse,
} from '@/data/repository'
import type { CookAccount, CookLanguage, CookVisit, DB, ISODate, Weekday } from '@/data/types'
import { useSession } from '@/hooks/useSession'
import { WEEKDAY_SHORT, addDays, fmtShortDate, todayISO, weekDates, weekdayOf } from '@/lib/dates'
import { SLOT_EN, SLOT_HI, buildCookDay, dayFromHouse, dayLabel, decodeHouse, dishName, fmtTime, visitLabel, whatsappUrl, type CookDay } from '@/lib/kitchen'
import { cn, parseJoinInput, uid } from '@/lib/utils'

/** One house the cook works at, whether it lives on this phone or was added from a family's link. */
interface HouseView {
  id: string
  kind: 'local' | 'link'
  name: string
  people: string[]
  visits: CookVisit[]
  weeklyOff: Weekday[]
  reply?: string
  importedAt?: ISODate
  day: (date: ISODate) => CookDay | null
}

function housesFor(db: DB, account: CookAccount): HouseView[] {
  const lang = account.language
  const local: HouseView[] = localCooksOf(db, account.userId).map((c) => {
    const h = db.households[c.householdId]
    return {
      id: c.id,
      kind: 'local',
      name: h.name,
      people: membersOf(db, h.id).map((m) => db.users[m.userId]?.name ?? '?'),
      visits: c.visits,
      weeklyOff: c.weeklyOff,
      reply: h.contactPhone,
      day: (date) => buildCookDay(db, c, date, lang),
    }
  })
  const linked: HouseView[] = importedHousesOf(db, account.userId).map((h) => ({
    id: h.id,
    kind: 'link',
    name: h.name,
    people: h.people,
    visits: h.visits,
    weeklyOff: h.weeklyOff,
    reply: h.reply,
    importedAt: h.importedAt,
    day: (date) => {
      const off = cookIsOff(db, h, date)
      return dayFromHouse(h, date, lang, off.off ? { reason: off.reason!, note: off.leave?.note } : undefined)
    },
  }))
  const first = (h: HouseView) => [...h.visits].sort((a, b) => a.time.localeCompare(b.time))[0]?.time ?? '99'
  return [...local, ...linked].sort((a, b) => first(a).localeCompare(first(b)))
}

type View = 'today' | 'tomorrow' | 'week'

/** The cook's own app: every house she works at, what to make there, and when. */
export function CookApp() {
  const { db, cookAccount } = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const [view, setView] = useState<View>('today')
  const [filter, setFilter] = useState<string>('all')
  const [adding, setAdding] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [timings, setTimings] = useState<HouseView | null>(null)
  const [removing, setRemoving] = useState<HouseView | null>(null)
  const houses = useMemo(() => (cookAccount ? housesFor(db, cookAccount) : []), [db, cookAccount])
  if (!cookAccount) return null
  const lang = cookAccount.language
  const hi = lang === 'hi'
  const today = todayISO()
  const date = view === 'tomorrow' ? addDays(today, 1) : today
  const shown = houses.filter((h) => filter === 'all' || h.id === filter)
  if (filter !== 'all' && !houses.some((h) => h.id === filter)) setFilter('all')

  // the day's route: every visit at every house, in time order
  const route = houses
    .flatMap((h) => {
      const day = h.day(date)
      return day && !day.off ? day.visits.map((v) => ({ house: h, time: v.time, label: v.label })) : []
    })
    .sort((a, b) => a.time.localeCompare(b.time))

  const addDemo = () => {
    for (const code of [DEMO_CODE, DEMO_CODE_2]) {
      ensureDemoHouse(code)
      addHouseByCode(cookAccount.userId, code)
    }
    toast({ text: hi ? 'दो डेमो घर जुड़ गए' : 'Two demo houses added' })
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-paper px-4 pb-[max(32px,env(safe-area-inset-bottom))] pt-safe" data-testid="cook-app">
      <header className="flex items-start justify-between gap-3 pt-5">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-clay">Rasoi · {hi ? 'कुक' : 'Cook'}</p>
          <h1 className="mt-0.5 font-display text-[30px] font-medium leading-tight tracking-tight">{hi ? `नमस्ते, ${cookAccount.name} जी` : `Namaste, ${cookAccount.name}`}</h1>
        </div>
        <Segmented
          size="sm"
          className="mt-1 w-[132px] shrink-0"
          value={lang}
          onChange={(l: CookLanguage) => updateCookAccount(cookAccount.userId, { language: l })}
          options={[
            { value: 'hi', label: 'हिंदी' },
            { value: 'en', label: 'English' },
          ]}
        />
      </header>

      {houses.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-line px-6 py-9 text-center" data-testid="cook-empty">
          <p className="text-[44px] leading-none">🏠</p>
          <h2 className="mt-4 font-display text-[24px] font-medium leading-tight">{hi ? 'अपना पहला घर जोड़ें' : 'Add your first house'}</h2>
          <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-ink-soft">
            {hi ? 'जिस घर में खाना बनाती हैं, उनसे “घर का लिंक” या कोड माँगें। आप कई घर जोड़ सकती हैं।' : 'Ask the family you cook for to send their house link or code. You can add as many houses as you work at.'}
          </p>
          <div className="mt-6 space-y-2">
            <Button size="lg" block className="h-16 rounded-2xl text-[17px]" onClick={() => setAdding(true)}>
              <Plus size={20} /> {hi ? 'घर जोड़ें' : 'Add a house'}
            </Button>
            <Button size="lg" variant="secondary" block className="h-14 rounded-2xl" onClick={addDemo} data-testid="try-demo-houses">
              {hi ? 'डेमो घर आज़माएँ' : 'Try with demo houses'}
            </Button>
          </div>
          <p className="mt-4 text-[13px] text-ink-mute">
            {hi ? 'डेमो कोड' : 'Demo family codes'}: <b className="font-mono tracking-wider text-ink-soft">{DEMO_CODE}</b> · <b className="font-mono tracking-wider text-ink-soft">{DEMO_CODE_2}</b>
          </p>
        </section>
      ) : (
        <>
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

          {view !== 'week' && (
            <section className="mt-4 rounded-2xl bg-sand/70 px-4 py-3" data-testid="cook-route">
              <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em] text-ink-soft">
                <Clock size={15} /> {dayLabel(date, lang)}
              </p>
              {route.length === 0 ? (
                <p className="mt-1.5 text-[17px] font-semibold">{hi ? 'आज कहीं नहीं जाना — छुट्टी' : 'Nowhere to go — day off'}</p>
              ) : (
                <ol className="mt-2 space-y-1.5">
                  {route.map((r, i) => (
                    <li key={i} className="flex items-baseline gap-3">
                      <span className="w-[76px] shrink-0 text-[17px] font-bold tabular">{fmtTime(r.time)}</span>
                      <button onClick={() => setFilter(r.house.id)} className="min-w-0 truncate text-left text-[17px] font-semibold underline decoration-line decoration-2 underline-offset-4">
                        {r.house.name}
                      </button>
                      <span className="shrink-0 text-[13px] text-ink-mute">{visitLabel(r, lang)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label={hi ? 'घर' : 'Houses'}>
            {houses.length > 1 && (
              <Chip active={filter === 'all'} onClick={() => setFilter('all')} className="h-11 px-4 text-[14px]">
                {hi ? 'सब घर' : 'All houses'}
              </Chip>
            )}
            {houses.map((h) => (
              <Chip key={h.id} active={filter === h.id || houses.length === 1} onClick={() => setFilter(h.id)} className="h-11 px-4 text-[14px]">
                <Home size={15} /> {h.name}
              </Chip>
            ))}
            <Chip onClick={() => setAdding(true)} className="h-11 border-dashed px-4 text-[14px]" aria-label={hi ? 'घर जोड़ें' : 'Add a house'}>
              <Plus size={15} /> {hi ? 'घर जोड़ें' : 'Add'}
            </Chip>
          </div>

          <div className="mt-4 space-y-7">
            {shown.map((h) => (
              <section key={h.id} data-testid="cook-house">
                <div className="mb-2.5 flex items-end justify-between gap-3 px-1">
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-[22px] font-medium leading-tight">{h.name}</h2>
                    <p className="truncate text-[14px] text-ink-soft">{h.people.join(', ')}</p>
                  </div>
                  <button onClick={() => setTimings(h)} className="shrink-0 rounded-full bg-sand px-3 py-1.5 text-[13px] font-semibold text-ink-soft hover:text-ink focus-ring">
                    <Clock size={13} className="mr-1 inline" />
                    {hi ? 'समय' : 'Timings'}
                  </button>
                </div>
                {view !== 'week' ? <HouseDay house={h} date={date} lang={lang} /> : <HouseWeek house={h} lang={lang} />}
              </section>
            ))}
          </div>

          <Button size="lg" variant="outline" block className="mt-7 h-16 rounded-2xl text-[17px]" onClick={() => setLeaveOpen(true)}>
            <CalendarOff size={20} /> {hi ? 'मैं नहीं आऊँगी' : 'I’m not coming'}
          </Button>

          <section className="mt-8">
            <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-mute">{hi ? 'मेरे घर' : 'My houses'}</h2>
            <ul className="overflow-hidden rounded-2xl border border-line/80 bg-card" data-testid="my-houses">
              {houses.map((h) => (
                <li key={h.id} className="border-t border-line/60 px-4 py-3 first:border-t-0">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-ink-soft">
                      <Home size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-semibold">{h.name}</p>
                      <p className="truncate text-[13px] text-ink-mute">
                        {[...h.visits].sort((a, b) => a.time.localeCompare(b.time)).map((v) => fmtTime(v.time)).join(' · ')}
                        {h.weeklyOff.length ? ` · ${hi ? 'छुट्टी' : 'off'} ${h.weeklyOff.map((d) => WEEKDAY_SHORT[d]).join(', ')}` : ''}
                      </p>
                      <p className="text-[12px] text-ink-mute">{h.kind === 'link' ? `${hi ? 'लिंक से जोड़ा' : 'Added by link'} · ${fmtShortDate(h.importedAt!)}` : hi ? 'इस फ़ोन पर' : 'On this phone'}</p>
                    </div>
                    <button onClick={() => setRemoving(h)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-mute hover:bg-sand hover:text-ink focus-ring" aria-label={`${hi ? 'हटाएँ' : 'Remove'} ${h.name}`}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="mt-2 pl-12">
                    <LeaveList db={db} cook={{ id: h.id, weeklyOff: [] }} lang={lang} compact />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <button
        onClick={() => {
          signOut()
          navigate('/welcome')
        }}
        className="mx-auto mt-8 flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold text-ink-mute hover:bg-sand"
      >
        <LogOut size={16} /> {hi ? `${cookAccount.name} नहीं हैं? बाहर निकलें` : `Not ${cookAccount.name}? Sign out`}
      </button>

      <AddHouseSheet open={adding} onClose={() => setAdding(false)} account={cookAccount} onDemo={addDemo} />
      <CookLeaveSheet open={leaveOpen} onClose={() => setLeaveOpen(false)} houses={houses} account={cookAccount} initial={filter} />
      <TimingsSheet
        open={!!timings}
        onClose={() => setTimings(null)}
        visits={timings?.visits ?? []}
        weeklyOff={timings?.weeklyOff ?? []}
        lang={lang}
        title={timings ? `${timings.name} · ${hi ? 'समय' : 'timings'}` : undefined}
        onSave={(visits, weeklyOff) => {
          if (!timings) return
          if (timings.kind === 'local') updateCook(timings.id, { visits, weeklyOff })
          else updateCookHouse(timings.id, { visits, weeklyOff })
        }}
      />
      <Sheet
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={hi ? `${removing?.name ?? ''} हटाएँ?` : `Remove ${removing?.name ?? ''}?`}
        description={hi ? 'यह घर आपकी सूची से हट जाएगा। बाद में फिर जोड़ सकती हैं।' : 'It leaves your list. You can add it again later.'}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="lg" block onClick={() => setRemoving(null)}>
              {hi ? 'रहने दें' : 'Keep'}
            </Button>
            <Button
              variant="danger"
              size="lg"
              block
              onClick={() => {
                if (removing) (removing.kind === 'local' ? leaveLocalHouse : removeCookHouse)(removing.id)
                setRemoving(null)
              }}
            >
              {hi ? 'हटाएँ' : 'Remove'}
            </Button>
          </div>
        }
      >
        <span />
      </Sheet>
    </div>
  )
}

function HouseDay({ house, date, lang }: { house: HouseView; date: ISODate; lang: CookLanguage }) {
  const day = house.day(date)
  if (!day) return <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-ink-mute">{lang === 'hi' ? 'मेन्यू नहीं मिला — परिवार से नया लिंक माँगें।' : 'No menu found. Ask the family for a new link.'}</p>
  return <CookDayView day={day} lang={lang} />
}

function HouseWeek({ house, lang }: { house: HouseView; lang: CookLanguage }) {
  const hi = lang === 'hi'
  const today = todayISO()
  return (
    <div className="space-y-2">
      {weekDates(today).map((d) => {
        const day = house.day(d)
        return (
          <div key={d} className={cn('rounded-2xl border bg-card px-4 py-3', d === today ? 'border-ink/60' : 'border-line/80', d < today && 'opacity-50')}>
            <p className="flex items-center justify-between text-[16px] font-semibold">
              {dayLabel(d, lang)}
              {day?.off && <span className="rounded-full bg-clay-soft px-2 py-0.5 text-[12px] text-clay-deep">{hi ? 'छुट्टी' : 'Off'}</span>}
            </p>
            {day &&
              !day.off &&
              day.visits.flatMap((v) => v.slots).map((s) =>
                s.dishes.length ? (
                  <p key={s.slot} className="mt-1 text-[14px] leading-snug text-ink-soft">
                    <b className="text-ink">{hi ? SLOT_HI[s.slot] : SLOT_EN[s.slot]}:</b> {s.dishes.map((x) => dishName(x, lang)).join(', ')}
                  </p>
                ) : null,
              )}
          </div>
        )
      })}
    </div>
  )
}

/* ——————————— Add a house ——————————— */

function AddHouseSheet({ open, onClose, account, onDemo }: { open: boolean; onClose: () => void; account: CookAccount; onDemo: () => void }) {
  const hi = account.language === 'hi'
  const toast = useToast()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) {
      setValue('')
      setError('')
    }
  }, [open])

  const submit = async () => {
    setError('')
    const text = value.trim()
    const linkData = text.match(/#\/h\/([A-Za-z0-9_-]+)/)?.[1]
    if (linkData) {
      setBusy(true)
      const snap = await decodeHouse(linkData)
      setBusy(false)
      if (!snap) return setError(hi ? 'यह लिंक खुल नहीं पाया। परिवार से दोबारा भेजने को कहें।' : 'That link didn’t open. Ask the family to send it again.')
      importHouse(account.userId, { name: snap.name, code: snap.code, cookName: snap.cookName, people: snap.people, reply: snap.reply, visits: snap.visits.map((v) => ({ ...v, id: uid('visit') })), weeklyOff: snap.weeklyOff, week: snap.week, importedAt: snap.at })
      toast({ text: hi ? `${snap.name} जुड़ गया` : `${snap.name} added` })
      return onClose()
    }
    const code = parseJoinInput(text)
    if (!code) return setError(hi ? 'कोड 6 अक्षर का होता है, जैसे 7XK92A' : 'Codes are 6 characters, like 7XK92A')
    if (isDemoCode(code)) ensureDemoHouse(code)
    const res = addHouseByCode(account.userId, code)
    if (res.error === 'already') return setError(hi ? 'यह घर पहले से जुड़ा है।' : 'You’ve already added this house.')
    if (res.error)
      return setError(
        hi
          ? `यह कोड इस फ़ोन पर नहीं मिला। परिवार से “घर का लिंक” व्हाट्सऐप पर माँगें — उसे दबाते ही घर जुड़ जाएगा। आज़माने के लिए डेमो कोड ${DEMO_CODE} डालें।`
          : `That code isn’t on this phone. Ask the family to WhatsApp you their house link — tapping it adds the house. To try things out, use the demo code ${DEMO_CODE}.`,
      )
    toast({ text: hi ? 'घर जुड़ गया' : 'House added' })
    onClose()
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={hi ? 'घर जोड़ें' : 'Add a house'}
      description={hi ? 'परिवार का भेजा लिंक चिपकाएँ, या उनका कोड लिखें।' : 'Paste the link the family sent you, or type their code.'}
      footer={
        <Button size="lg" block disabled={!value.trim() || busy} onClick={submit}>
          {hi ? 'जोड़ें' : 'Add house'}
        </Button>
      }
    >
      <div className="space-y-3 pb-2">
        <Field label={hi ? 'घर का लिंक या कोड' : 'House link or family code'}>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={`${hi ? 'जैसे' : 'e.g.'} ${DEMO_CODE}`} autoCapitalize="characters" autoComplete="off" className="h-14 text-[18px]" aria-label={hi ? 'घर का लिंक या कोड' : 'House link or family code'} />
        </Field>
        {error && (
          <p className="rounded-2xl bg-clay-soft px-4 py-3 text-[14px] leading-relaxed text-clay-deep" role="alert">
            {error}
          </p>
        )}
        <button
          onClick={() => {
            onDemo()
            onClose()
          }}
          className="w-full rounded-2xl bg-sand px-4 py-3 text-left text-[14px] font-semibold text-ink-soft hover:text-ink focus-ring"
        >
          {hi ? `आज़माने के लिए दो डेमो घर जोड़ें (${DEMO_CODE}, ${DEMO_CODE_2})` : `Just trying it out? Add two demo houses (${DEMO_CODE}, ${DEMO_CODE_2})`}
        </button>
      </div>
    </Sheet>
  )
}

/* ——————————— Days off, per house ——————————— */

function CookLeaveSheet({ open, onClose, houses, account, initial }: { open: boolean; onClose: () => void; houses: HouseView[]; account: CookAccount; initial: string }) {
  const lang = account.language
  const hi = lang === 'hi'
  const today = todayISO()
  const [dates, setDates] = useState<ISODate[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (open) {
      setDates([])
      setSaved(false)
      setPicked(initial === 'all' ? houses.map((h) => h.id) : [initial])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const quick = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => addDays(today, n))
  const toggle = (d: ISODate) => setDates((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d].sort()))
  const chosen = houses.filter((h) => picked.includes(h.id))
  const message = (h: HouseView) =>
    hi
      ? `नमस्ते, मैं ${account.name} हूँ। मैं ${dates.map((d) => dayLabel(d, 'hi')).join(', ')} को ${h.name} नहीं आ पाऊँगी। 🙏`
      : `Hi, this is ${account.name}. I won't be able to come to ${h.name} on ${dates.map((d) => dayLabel(d, 'en')).join(', ')}. 🙏`

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={saved ? (hi ? 'परिवार को बताएँ' : 'Tell the family') : hi ? 'कब नहीं आएँगी?' : 'When are you not coming?'}
      description={saved ? (hi ? 'छुट्टी दर्ज हो गई। नीचे दबाकर व्हाट्सऐप पर बता दें।' : 'Saved. Tap below to let each house know on WhatsApp.') : hi ? 'दिन और घर चुनें।' : 'Pick the days and the houses.'}
      footer={
        saved ? (
          <Button size="lg" block onClick={onClose}>
            {hi ? 'हो गया' : 'Done'}
          </Button>
        ) : (
          <Button
            size="lg"
            block
            disabled={dates.length === 0 || chosen.length === 0}
            onClick={() => {
              for (const h of chosen) addCookLeave(h.id, dates, account.userId)
              setSaved(true)
            }}
          >
            {hi ? 'सेव करें' : 'Save'}
          </Button>
        )
      }
    >
      {saved ? (
        <div className="space-y-2 pb-2" data-testid="leave-notify">
          {chosen.map((h) => (
            <a
              key={h.id}
              href={whatsappUrl(message(h), h.reply)}
              target="_blank"
              rel="noreferrer"
              className="flex h-16 items-center gap-3 rounded-2xl bg-wa px-4 text-[16px] font-semibold text-white shadow-soft transition active:scale-[0.98] focus-ring"
            >
              <MessageCircle size={20} /> <span className="min-w-0 flex-1 truncate">{hi ? `${h.name} को बताएँ` : `Tell ${h.name}`}</span>
            </a>
          ))}
        </div>
      ) : (
        <div className="space-y-5 pb-2">
          <div className="grid grid-cols-4 gap-1.5">
            {quick.map((d, i) => {
              const on = dates.includes(d)
              return (
                <button key={d} onClick={() => toggle(d)} aria-pressed={on} className={cn('flex h-16 flex-col items-center justify-center rounded-2xl text-center transition focus-ring', on ? 'bg-ink text-paper' : 'bg-sand text-ink')}>
                  <span className="text-[14px] font-semibold">{i === 0 ? (hi ? 'आज' : 'Today') : i === 1 ? (hi ? 'कल' : 'Tomorrow') : WEEKDAY_SHORT[weekdayOf(d)]}</span>
                  <span className={cn('text-[12px]', on ? 'text-paper/70' : 'text-ink-mute')}>{fmtShortDate(d)}</span>
                </button>
              )
            })}
          </div>
          {houses.length > 1 && (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-ink-soft">{hi ? 'किस घर में?' : 'Which houses?'}</p>
              <div className="space-y-1.5">
                {houses.map((h) => {
                  const on = picked.includes(h.id)
                  return (
                    <button
                      key={h.id}
                      onClick={() => setPicked(on ? picked.filter((x) => x !== h.id) : [...picked, h.id])}
                      aria-pressed={on}
                      className={cn('flex h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left text-[16px] font-semibold transition focus-ring', on ? 'border-ink bg-card' : 'border-line bg-card text-ink-mute')}
                    >
                      <span className={cn('grid h-6 w-6 place-items-center rounded-md border-2', on ? 'border-ink bg-ink text-paper' : 'border-line')}>{on && <Check size={14} strokeWidth={3.5} />}</span>
                      {h.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}

/* ——————————— Timings ——————————— */

export function TimingsSheet({
  open,
  onClose,
  cookId,
  visits,
  weeklyOff,
  lang = 'en',
  title,
  onSave,
}: {
  open: boolean
  onClose: () => void
  /** family side: saves straight to this cook */
  cookId?: string
  visits: VisitDraft[]
  weeklyOff: Weekday[]
  lang?: CookLanguage
  title?: string
  onSave?: (visits: CookVisit[], weeklyOff: Weekday[]) => void
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
      title={title ?? (hi ? 'मेरा समय' : 'Timings')}
      description={hi ? 'आप कब आती हैं और कौन सा खाना बनाती हैं।' : 'When the cook comes, and which meals each visit covers.'}
      footer={
        <Button
          size="lg"
          block
          disabled={v.length === 0 || v.some((x) => x.slots.length === 0)}
          onClick={() => {
            const saved = v.map((x) => ({ ...x, id: x.id ?? uid('visit') }))
            if (onSave) onSave(saved, off)
            else if (cookId) updateCook(cookId, { visits: saved, weeklyOff: off })
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
