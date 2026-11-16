import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/ui/button'
import { findHouseholdByCode } from '@/data/repository'
import { useSession } from '@/hooks/useSession'
import { Onboarding } from './Onboarding'

/** /join/:code — if this tab already belongs to that household, don't re-onboard. */
export function JoinGate({ code }: { code: string }) {
  const { db, member, user } = useSession()
  const navigate = useNavigate()
  const [asNew, setAsNew] = useState(false)
  const target = findHouseholdByCode(db, code)
  const alreadyIn = member && target && member.householdId === target.id
  if (!alreadyIn || asNew) return <Onboarding initialCode={code} key={code} />
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <Avatar name={user!.name} hue={member!.hue} size={56} />
      <h1 className="mt-6 font-display text-3xl font-medium tracking-tight">You’re already in {target!.name}</h1>
      <p className="mt-2 text-ink-soft">This device is signed in as {user!.name}. Is that you?</p>
      <div className="mt-8 space-y-2">
        <Button size="lg" block onClick={() => navigate('/', { replace: true })}>
          Continue as {user!.name} <ArrowRight size={18} />
        </Button>
        <Button size="lg" block variant="outline" onClick={() => setAsNew(true)}>
          I’m someone else — join
        </Button>
      </div>
    </div>
  )
}
