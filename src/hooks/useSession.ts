import { cooksOf, membersOf, memberForUser } from '@/data/repository'
import { useStore } from '@/data/store'

export function useSession() {
  const { db, sessionUserId } = useStore()
  const user = sessionUserId ? db.users[sessionUserId] : undefined
  const member = memberForUser(db, sessionUserId)
  /** set when the person using this phone is a cook (her own account, any number of houses) */
  const cookAccount = !member && sessionUserId ? db.cookAccounts[sessionUserId] : undefined
  const householdId = member?.householdId
  const household = householdId ? db.households[householdId] : undefined
  const members = household ? membersOf(db, household.id) : []
  const partner = members.find((m) => m.userId !== sessionUserId)
  const nameOf = (userId: string) => db.users[userId]?.name ?? 'Someone'
  const cooks = household ? cooksOf(db, household.id) : []
  return { db, user, member, cookAccount, cooks, household, members, partner, nameOf }
}

export type Session = ReturnType<typeof useSession>
