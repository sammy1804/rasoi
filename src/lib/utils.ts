import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function uid(prefix = ''): string {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : Math.random().toString(36).slice(2, 18)
  return prefix ? `${prefix}_${r}` : r
}

// No 0/O/1/I/L to avoid confusion when read aloud or typed.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export function joinCode(len = 6): string {
  let out = ''
  const buf = new Uint32Array(len)
  crypto.getRandomValues(buf)
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length]
  return out
}

/** Extract a join code from a pasted link or raw code. */
export function parseJoinInput(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  const m = s.match(/join\/([A-Za-z0-9]{4,10})/)
  const raw = (m ? m[1] : s).replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return raw.length >= 4 && raw.length <= 10 ? raw : null
}

export const round = (n: number, step = 1) => Math.round(n / step) * step
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('en-IN')
}

/** 0.5 → ½ etc. for friendly portion labels */
export function fmtAmount(n: number): string {
  const whole = Math.floor(n + 1e-9)
  const frac = +(n - whole).toFixed(2)
  const fracMap: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾', '0.33': '⅓', '0.67': '⅔' }
  const f = fracMap[String(frac)]
  if (frac === 0) return String(whole)
  if (f) return whole === 0 ? f : `${whole}${f}`
  return String(+n.toFixed(1))
}

export function plural(word: string, n: number): string {
  if (n <= 1) return word
  if (['g', 'ml', 'tbsp', 'tsp', 'tbsp (grated)'].includes(word)) return word
  if (word === 'katori') return 'katoris'
  if (word === 'glass') return 'glasses'
  if (word === 'handful') return 'handfuls'
  if (word === 'medium') return 'medium'
  if (word.endsWith('s')) return word
  return word + 's'
}
