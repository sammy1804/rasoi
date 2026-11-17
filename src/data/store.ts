import { useSyncExternalStore } from 'react'
import type { DB } from './types'

/**
 * Tiny observable store holding the normalised DB in memory and persisting it
 * to localStorage. Every tab of the same browser shares the data (the `storage`
 * event keeps them in sync), while *who you are* is kept per-tab in
 * sessionStorage — so you can be Samridhi in one tab and Naina in another.
 *
 * To move to Supabase: hydrate `db` from the tables on load, route the
 * mutations in `repository.ts` through supabase-js, and replace the `storage`
 * listener with a realtime channel subscription on `household_id`.
 */

const DB_KEY = 'rasoi:db:v1'
const SESSION_KEY = 'rasoi:session'
const LAST_USER_KEY = 'rasoi:lastUser'
export const DB_VERSION = 1

export function emptyDB(): DB {
  return {
    version: DB_VERSION,
    users: {},
    households: {},
    members: {},
    mealPlans: {},
    meals: {},
    foods: {},
    recipes: {},
    foodLogs: {},
    weightLogs: {},
    waterLogs: {},
    choices: {},
    cooks: {},
    cookLeaves: {},
    groceryChecks: {},
    spendLogs: {},
    cookAccounts: {},
    cookHouses: {},
    activityLogs: {},
  }
}

function safeGet(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}
function safeSet(storage: Storage | undefined, key: string, value: string | null) {
  try {
    if (value === null) storage?.removeItem(key)
    else storage?.setItem(key, value)
  } catch {
    /* storage unavailable (private mode / quota) — keep working in memory */
  }
}

const ls = typeof window !== 'undefined' ? window.localStorage : undefined
const ss = typeof window !== 'undefined' ? window.sessionStorage : undefined

function load(): DB {
  const raw = safeGet(ls, DB_KEY)
  if (!raw) return emptyDB()
  try {
    const parsed = JSON.parse(raw) as DB
    if (parsed.version !== DB_VERSION) return emptyDB()
    return { ...emptyDB(), ...parsed }
  } catch {
    return emptyDB()
  }
}

let db: DB = load()
let sessionUserId: string | null = safeGet(ss, SESSION_KEY) ?? safeGet(ls, LAST_USER_KEY)
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function getDB(): DB {
  return db
}

export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Apply a mutation to a structural copy of the DB, persist and notify. */
export function commit(mutate: (draft: DB) => void) {
  const draft = structuredClone(db)
  mutate(draft)
  db = draft
  safeSet(ls, DB_KEY, JSON.stringify(db))
  emit()
}

export function replaceDB(next: DB) {
  db = next
  safeSet(ls, DB_KEY, JSON.stringify(db))
  emit()
}

export function getSessionUserId(): string | null {
  if (sessionUserId && !db.users[sessionUserId]) return null
  return sessionUserId
}

export function setSessionUserId(id: string | null) {
  sessionUserId = id
  safeSet(ss, SESSION_KEY, id)
  safeSet(ls, LAST_USER_KEY, id)
  emit()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === DB_KEY) {
      db = load()
      emit()
    }
  })
}

let snapshot = { db, sessionUserId: getSessionUserId() }
function getSnapshot() {
  const s = getSessionUserId()
  if (snapshot.db !== db || snapshot.sessionUserId !== s) snapshot = { db, sessionUserId: s }
  return snapshot
}

export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
