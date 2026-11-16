import type { ISODate, Weekday } from '@/data/types'

export function toISO(d: Date): ISODate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayISO = () => toISO(new Date())

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** 0 = Monday … 6 = Sunday */
export function weekdayOf(s: ISODate): Weekday {
  return ((fromISO(s).getDay() + 6) % 7) as Weekday
}

export function startOfWeek(s: ISODate): ISODate {
  return addDays(s, -weekdayOf(s))
}

export function weekDates(s: ISODate): ISODate[] {
  const start = startOfWeek(s)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000)
}

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function fmtLongDate(s: ISODate): string {
  const d = fromISO(s)
  return `${WEEKDAY_NAMES[weekdayOf(s)]}, ${d.getDate()} ${d.toLocaleString('en-GB', { month: 'long' })}`
}

export function fmtShortDate(s: ISODate): string {
  const d = fromISO(s)
  return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`
}

export function relativeDayLabel(s: ISODate): string {
  const diff = daysBetween(todayISO(), s)
  if (diff === 0) return 'Today'
  if (diff === -1) return 'Yesterday'
  if (diff === 1) return 'Tomorrow'
  return WEEKDAY_NAMES[weekdayOf(s)]
}
