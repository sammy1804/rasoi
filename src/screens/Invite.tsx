import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { useSession } from '@/hooks/useSession'
import { IS_MOBILE_PAGE } from '@/app/target'

/** What "Copy" puts on the clipboard: a link on the web build, a code message on the mobile page. */
export function inviteText(code: string, householdName: string) {
  if (IS_MOBILE_PAGE) return `Join ${householdName} on Rasoi: open the app, tap “I have an invite” and enter code ${code}`
  return inviteLink(code)
}

export function inviteLink(code: string) {
  return `${window.location.origin}/join/${code}`
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

export function InviteScreen() {
  const { household, member, partner, nameOf } = useSession()
  const [params] = useSearchParams()
  const isNew = params.get('new') === '1'
  const navigate = useNavigate()
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  if (!household || !member) return <Navigate to="/welcome" replace />
  const link = inviteLink(household.code)

  const copy = async () => {
    const ok = await copyText(inviteText(household.code, household.name))
    setCopied(ok)
    toast({ text: ok ? (IS_MOBILE_PAGE ? 'Invite copied — paste it to them' : 'Invite link copied') : 'Couldn’t copy — long-press the code instead' })
    setTimeout(() => setCopied(false), 1800)
  }
  const share = async () => {
    try {
      await navigator.share({ title: `Join ${household.name} on Rasoi`, text: `Join our shared meal plan on Rasoi — code ${household.code}`, url: link })
    } catch {
      /* cancelled */
    }
  }
  const canShare = !IS_MOBILE_PAGE && typeof navigator !== 'undefined' && 'share' in navigator

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-safe">
      <div className="flex h-14 items-center">
        {!isNew && (
          <button onClick={() => navigate(-1)} className="-ml-2 grid h-10 w-10 place-items-center rounded-full hover:bg-sand focus-ring" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
        )}
      </div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-1 flex-col">
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-clay">{isNew ? 'Household created' : household.name}</p>
        <h1 className="mt-2 font-display text-[32px] font-medium leading-tight tracking-tight">
          {partner ? 'You’re both in.' : 'Invite your person'}
        </h1>
        <p className="mt-2 text-[15px] text-ink-soft">
          {partner
            ? `${nameOf(partner.userId)} has joined ${household.name}. You’ll both see the same meals — each with your own portions.`
            : IS_MOBILE_PAGE
              ? 'Send them this code. They tap “I have an invite”, set up their own goals and see the same meal plan — no need to recreate anything.'
              : 'Send them this link. They’ll set up their own goals and see the same meal plan — no need to recreate anything.'}
        </p>

        <div className="mt-8 rounded-3xl border border-line bg-card p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-mute">Join code</p>
          <p className="mt-1 font-mono text-[40px] font-semibold tracking-[0.18em] text-ink" data-testid="join-code">
            {household.code}
          </p>
          {!IS_MOBILE_PAGE && (
            <div className="mt-3 truncate rounded-xl bg-sand px-3 py-2.5 font-mono text-[13px] text-ink-soft" data-testid="invite-link">
              {link.replace(/^https?:\/\//, '')}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Button block onClick={copy} variant="primary">
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.span key="c" initial={{ scale: 0.6 }} animate={{ scale: 1 }}>
                    <Check size={18} />
                  </motion.span>
                ) : (
                  <motion.span key="i" initial={{ scale: 0.6 }} animate={{ scale: 1 }}>
                    <Copy size={18} />
                  </motion.span>
                )}
              </AnimatePresence>
              {copied ? 'Copied' : IS_MOBILE_PAGE ? 'Copy invite' : 'Copy invite link'}
            </Button>
            {canShare && (
              <Button variant="outline" size="icon" className="h-11 w-11" onClick={share} aria-label="Share invite">
                <Share2 size={18} />
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-sand/70 px-4 py-3.5">
          <div className="flex -space-x-2">
            <Avatar name={nameOf(member.userId)} hue={member.hue} size={34} className="ring-2 ring-paper" />
            {partner ? (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <Avatar name={nameOf(partner.userId)} hue={partner.hue} size={34} className="ring-2 ring-paper" />
              </motion.span>
            ) : (
              <span className="grid h-[34px] w-[34px] place-items-center rounded-full border-2 border-dashed border-ink-mute/40 bg-paper text-ink-mute ring-2 ring-paper">?</span>
            )}
          </div>
          <p className="flex-1 text-sm font-medium text-ink-soft">
            {partner ? (
              <>
                <span className="text-ink">{nameOf(partner.userId)}</span> joined — you’re all set.
              </>
            ) : (
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulseDot rounded-full bg-clay" />
                Waiting for your second person to join
              </span>
            )}
          </p>
        </div>

        <details className="mt-4 rounded-2xl px-1 text-[13px] text-ink-mute">
          <summary className="cursor-pointer select-none py-1 font-semibold text-ink-soft">Testing on one device?</summary>
          {IS_MOBILE_PAGE ? (
            <p className="mt-1 leading-relaxed">
              This version keeps your data on this phone. To try the second person here, go to <b>Profile → Sign out on this device</b>, then tap <b>I have an invite</b> and enter the code. Switch back any time from Profile.
            </p>
          ) : (
            <>
              <p className="mt-1 leading-relaxed">
                This prototype keeps data in this browser. Open the invite link in a <b>new tab</b> to onboard the second person — both tabs stay in sync. To share across two phones, connect the Supabase backend (see README).
              </p>
              <a href={link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-semibold text-clay">
                Open invite in a new tab <ExternalLink size={14} />
              </a>
            </>
          )}
        </details>

        <div className="mt-auto pt-8">
          <Button size="lg" block variant={isNew ? 'accent' : 'outline'} onClick={() => navigate(isNew ? '/?welcome=1' : '/', { replace: isNew })}>
            {isNew ? 'See today’s plan' : 'Done'} <ArrowRight size={18} />
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
