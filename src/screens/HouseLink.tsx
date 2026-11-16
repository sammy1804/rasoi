import { ArrowRight, Home } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Segmented } from '@/components/ui/segmented'
import { createCookAccount, importHouse } from '@/data/repository'
import type { CookLanguage } from '@/data/types'
import { useSession } from '@/hooks/useSession'
import { decodeHouse, fmtTime, type HouseSnapshot } from '@/lib/kitchen'
import { uid } from '@/lib/utils'

/**
 * A family's house link, opened on the cook's phone. If she already has her
 * Rasoi, the house is added to it; if not, this is her whole sign-up: confirm
 * her name and language, and she's in with this house.
 */
export function HouseLinkScreen() {
  const { data } = useParams()
  const navigate = useNavigate()
  const { cookAccount } = useSession()
  const [snap, setSnap] = useState<HouseSnapshot | null | undefined>(undefined)
  const [name, setName] = useState('')
  const [lang, setLang] = useState<CookLanguage>('hi')

  useEffect(() => {
    let live = true
    decodeHouse(data ?? '').then((s) => {
      if (!live) return
      setSnap(s)
      if (s) {
        setName(s.cookName)
        setLang(s.lang)
      }
    })
    return () => {
      live = false
    }
  }, [data])

  if (snap === undefined) return <div className="grid min-h-dvh place-items-center text-ink-mute">…</div>
  if (!snap) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-[40px]">🏠</p>
        <h1 className="mt-3 font-display text-[26px] font-medium">यह लिंक खुल नहीं पाया</h1>
        <p className="mt-2 text-[16px] text-ink-soft">परिवार से नया लिंक माँगें। · This link didn’t open. Ask the family to send it again.</p>
        <Button variant="outline" className="mt-6" onClick={() => navigate('/welcome')}>
          Rasoi
        </Button>
      </div>
    )
  }

  const hi = (cookAccount?.language ?? lang) === 'hi'
  const add = () => {
    const userId = cookAccount?.userId ?? createCookAccount({ name: name.trim() || snap.cookName, language: lang })
    importHouse(userId, { name: snap.name, code: snap.code, cookName: snap.cookName, people: snap.people, reply: snap.reply, visits: snap.visits.map((v) => ({ ...v, id: uid('visit') })), weeklyOff: snap.weeklyOff, week: snap.week, importedAt: snap.at })
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-safe" data-testid="house-link">
      <p className="pt-8 text-[13px] font-semibold uppercase tracking-[0.14em] text-clay">Rasoi</p>
      <h1 className="mt-2 font-display text-[32px] font-medium leading-tight tracking-tight">{hi ? 'नमस्ते! 🙏' : 'Namaste! 🙏'}</h1>
      <p className="mt-2 text-[17px] leading-relaxed text-ink-soft">
        {hi ? 'इस घर ने आपको अपनी रसोई में जोड़ा है। यहाँ रोज़ का खाना, कितना बनाना है और वीडियो दिखेंगे।' : 'This house has added you to their kitchen. You’ll see each day’s menu here, how much to make, and recipe videos.'}
      </p>

      <div className="mt-6 flex items-center gap-4 rounded-3xl border border-line bg-card p-4 shadow-soft">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-clay-soft text-clay-deep">
          <Home size={26} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[20px] font-semibold">{snap.name}</p>
          <p className="truncate text-[15px] text-ink-soft">{snap.people.join(', ')}</p>
          <p className="text-[14px] text-ink-mute tabular">{snap.visits.map((v) => fmtTime(v.time)).join(' · ')}</p>
        </div>
      </div>

      {!cookAccount && (
        <div className="mt-6 space-y-4">
          <Field label="आपका नाम · Your name">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-14 text-[18px]" autoComplete="given-name" />
          </Field>
          <Field label="भाषा · Language">
            <Segmented
              value={lang}
              onChange={setLang}
              options={[
                { value: 'hi', label: 'हिंदी' },
                { value: 'en', label: 'English' },
              ]}
            />
          </Field>
        </div>
      )}

      <div className="mt-auto pt-8">
        <Button size="lg" variant="accent" block className="h-16 rounded-2xl text-[18px]" disabled={!cookAccount && !name.trim()} onClick={add}>
          {cookAccount ? (hi ? `${snap.name} जोड़ें` : `Add ${snap.name}`) : hi ? 'शुरू करें' : 'Start'} <ArrowRight size={20} />
        </Button>
      </div>
    </div>
  )
}
