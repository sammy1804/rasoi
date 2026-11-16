import type { Food, Nutrients } from '@/data/types'
import { unitOf } from './nutrition'
import { fmtAmount, plural } from './utils'

export function fmtQty(food: Food | undefined, amount: number, unit?: string): string {
  if (!food) return fmtAmount(amount)
  const u = unitOf(food, unit)
  if (u.name === 'g' || u.name === 'ml') return `${Math.round(amount)} ${u.name}`
  if (u.name === 'medium') return `${fmtAmount(amount)} medium`
  return `${fmtAmount(amount)} ${plural(u.name, amount)}`
}

export function fmtRange(food: Food, range: [number, number], unit?: string): string {
  const u = unitOf(food, unit)
  if (range[0] === range[1]) return fmtQty(food, range[0], unit)
  return `${fmtAmount(range[0])}–${fmtAmount(range[1])} ${plural(u.name, range[1])}`
}

export function fmtKcal(n: Nutrients | number): string {
  const k = typeof n === 'number' ? n : n.kcal
  return `${Math.round(k).toLocaleString('en-IN')} kcal`
}

export function fmtProtein(n: Nutrients | number): string {
  const p = typeof n === 'number' ? n : n.protein
  return `${p < 10 ? Math.round(p * 10) / 10 : Math.round(p)} g protein`
}

export const fmtG = (n: number) => `${n < 10 ? Math.round(n * 10) / 10 : Math.round(n)} g`
