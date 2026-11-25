import { getDB, getSessionUserId, normaliseDB, replaceDB, setSessionUserId } from '@/data/store'
import type { DB } from '@/data/types'
import { packJSON, unpackJSON } from './pack'

/**
 * Moving data between copies of Rasoi (the Claude page, the browser, the
 * home-screen app — on iPhone each keeps its own storage). The whole DB is
 * packed into one line of text the person copies and pastes. Meal photos stay
 * behind: they're large and live under their own key.
 */

const PREFIX = 'rasoi-data:'

interface Payload {
  v: 1
  at: string
  userId: string | null
  db: DB
}

export async function exportData(): Promise<string> {
  const payload: Payload = { v: 1, at: new Date().toISOString(), userId: getSessionUserId(), db: getDB() }
  return PREFIX + (await packJSON(payload))
}

export interface ReadData {
  db: DB
  userId: string | null
  at: string
  people: string[]
  logs: number
}

/** Find and unpack an export in pasted text (it may arrive wrapped in a chat message or with line breaks). */
export async function readData(text: string): Promise<ReadData | null> {
  const m = text.replace(/\s+/g, '').match(/rasoi-data:([zj][A-Za-z0-9_-]+)/)
  if (!m) return null
  const p = await unpackJSON<Payload>(m[1])
  const db = normaliseDB(p?.db)
  if (!p || !db) return null
  return {
    db,
    userId: p.userId && db.users[p.userId] ? p.userId : null,
    at: p.at,
    people: Object.values(db.members).map((m) => db.users[m.userId]?.name).filter(Boolean) as string[],
    logs: Object.keys(db.foodLogs).length,
  }
}

/** Load an export, keeping what was here as the backup. */
export function importData(d: ReadData) {
  replaceDB(d.db)
  setSessionUserId(d.userId)
}

export const hasData = () => Object.keys(getDB().users).length > 0 || Object.keys(getDB().cookAccounts).length > 0
