import { createContext, useContext, useState, type ReactNode } from 'react'
import type { ISODate } from '@/data/types'
import { todayISO } from '@/lib/dates'

interface DayCtx {
  date: ISODate
  setDate: (d: ISODate) => void
  viewUserId: string | null
  setViewUserId: (id: string | null) => void
}

const Ctx = createContext<DayCtx>({ date: todayISO(), setDate: () => {}, viewUserId: null, setViewUserId: () => {} })

export function DayProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState(todayISO())
  const [viewUserId, setViewUserId] = useState<string | null>(null)
  return <Ctx.Provider value={{ date, setDate, viewUserId, setViewUserId }}>{children}</Ctx.Provider>
}

export const useDay = () => useContext(Ctx)
