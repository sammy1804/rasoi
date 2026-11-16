import { CalendarOff, Check, MessageCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CookDayView } from '@/components/kitchen'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Sheet } from '@/components/ui/sheet'
import type { CookLanguage } from '@/data/types'
import { addDays, todayISO } from '@/lib/dates'
import { dayLabel, decodeCookDay, leaveReply, whatsappUrl } from '@/lib/kitchen'

/**
 * What the cook sees when she taps the link in WhatsApp. The whole menu is in
 * the link, so there is nothing to install, no login and no typing: pictures,
 * big numbers, a listen button and recipe videos. Replies go back over WhatsApp.
 */
export function CookLinkScreen() {
  const { data } = useParams()
  const navigate = useNavigate()
  const day = useMemo(() => (data ? decodeCookDay(data) : null), [data])
  const [lang, setLang] = useState<CookLanguage>(day?.lang ?? 'hi')
  const [leave, setLeave] = useState(false)

  if (!day) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-[40px]">🍽️</p>
        <h1 className="mt-3 font-display text-[26px] font-medium">यह लिंक खुल नहीं पाया</h1>
        <p className="mt-2 text-[16px] text-ink-soft">परिवार से नया लिंक माँगें। · This link didn’t open. Ask the family to send it again.</p>
        <Button variant="outline" className="mt-6" onClick={() => navigate('/welcome')}>
          Rasoi
        </Button>
      </div>
    )
  }

  const hi = lang === 'hi'
  const today = todayISO()
  const old = day.date < today
  const reply = (text: string) => whatsappUrl(text, day.reply)

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-paper px-4 pb-[max(32px,env(safe-area-inset-bottom))] pt-safe" data-testid="cook-link">
      <header className="flex items-start justify-between gap-3 pt-5">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-clay">{day.household}</p>
          <h1 className="mt-0.5 font-display text-[30px] font-medium leading-tight tracking-tight">{hi ? `नमस्ते, ${day.cook} जी` : `Namaste, ${day.cook}`}</h1>
          <p className="mt-1 text-[17px] font-semibold text-ink-soft">{dayLabel(day.date, lang)}</p>
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

      {old && (
        <p className="mt-4 rounded-2xl bg-clay-soft px-4 py-3 text-[15px] font-semibold text-clay-deep" data-testid="cook-link-old">
          {hi ? 'यह पुराना मेन्यू है। आज का लिंक परिवार से माँगें।' : 'This is an older menu. Ask the family for today’s link.'}
        </p>
      )}

      <div className="mt-5">
        <CookDayView day={day} lang={lang} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <a
          href={reply(hi ? `नमस्ते, मैं ${day.cook} हूँ। खाना बन गया है। ✅` : `Hi, this is ${day.cook}. The cooking is done. ✅`)}
          target="_blank"
          rel="noreferrer"
          className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-wa px-3 text-center text-[16px] font-semibold text-white shadow-soft transition active:scale-[0.97] focus-ring"
        >
          <Check size={20} strokeWidth={3} /> {hi ? 'बन गया' : 'Done'}
        </a>
        <button
          onClick={() => setLeave(true)}
          className="flex h-16 items-center justify-center gap-2 rounded-2xl border border-line bg-card px-3 text-center text-[16px] font-semibold transition active:scale-[0.97] focus-ring"
        >
          <CalendarOff size={20} /> {hi ? 'मैं नहीं आऊँगी' : 'I’m not coming'}
        </button>
      </div>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[13px] text-ink-mute">
        <MessageCircle size={14} /> {hi ? 'ये बटन परिवार को व्हाट्सऐप संदेश भेजते हैं' : 'These buttons send the family a WhatsApp message'}
      </p>

      <Sheet open={leave} onOpenChange={setLeave} title={hi ? 'कब नहीं आएँगी?' : 'Which day are you off?'} description={hi ? 'दिन चुनें — व्हाट्सऐप खुलेगा, बस भेज दें।' : 'Pick a day. WhatsApp opens with the message ready to send.'}>
        <div className="grid gap-2 pb-3">
          {(['today', 'tomorrow', 'dayafter'] as const).map((when, i) => (
            <a
              key={when}
              href={reply(leaveReply(day, when, lang))}
              target="_blank"
              rel="noreferrer"
              onClick={() => setLeave(false)}
              className="flex h-16 items-center justify-between rounded-2xl bg-sand px-5 text-[18px] font-semibold transition active:scale-[0.98] focus-ring"
            >
              <span>{hi ? ['आज', 'कल', 'परसों'][i] : ['Today', 'Tomorrow', 'Day after'][i]}</span>
              <span className="text-[14px] font-medium text-ink-soft">{dayLabel(addDays(today, i), lang)}</span>
            </a>
          ))}
        </div>
      </Sheet>
    </div>
  )
}
