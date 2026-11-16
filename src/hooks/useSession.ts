import { membersOf, memberForUser } from '@/data/repository'
import { useStore } from '@/data/store'

export function useSession() {
  const { db, sessionUserId } = useStore()
  const user = sessionUserId ? db.users[sessionUserId] : undefined
  const member = memberForUser(db, sessionUserId)
  const household = member ? db.households[member.householdId] : undefined
  const members = household ? membersOf(db, household.id) : []
  const partner = members.find((m) => m.userId !== sessionUserId)
  const nameOf = (userId: string) => db.users[userId]?.name ?? 'Someone'
  return { db, user, member, household, members, partner, nameOf }
}

export type Session = ReturnType<typeof useSession>
