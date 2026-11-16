import type { MealSlot } from '@/data/types'

export const SLOT_META: Record<MealSlot, { label: string; time: string; dot: string; soft: string; text: string }> = {
  breakfast: { label: 'Breakfast', time: '8–10 am', dot: 'bg-meal-breakfast', soft: 'bg-meal-breakfast/10', text: 'text-meal-breakfast' },
  lunch: { label: 'Lunch', time: '1–2 pm', dot: 'bg-meal-lunch', soft: 'bg-meal-lunch/10', text: 'text-meal-lunch' },
  snack: { label: 'Snack', time: '5 pm', dot: 'bg-meal-snack', soft: 'bg-meal-snack/10', text: 'text-meal-snack' },
  dinner: { label: 'Dinner', time: '8–9 pm', dot: 'bg-meal-dinner', soft: 'bg-meal-dinner/10', text: 'text-meal-dinner' },
}

export function slotForNow(): MealSlot {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 19) return 'snack'
  return 'dinner'
}

/** Person identity colours — kept muted so the one accent stays special. */
export const HUES = [
  { bg: 'bg-hue0-bg', text: 'text-hue0-fg', ring: 'ring-hue0-solid', solid: 'rgb(var(--h0-solid))' },
  { bg: 'bg-hue1-bg', text: 'text-hue1-fg', ring: 'ring-hue1-solid', solid: 'rgb(var(--h1-solid))' },
  { bg: 'bg-hue2-bg', text: 'text-hue2-fg', ring: 'ring-hue2-solid', solid: 'rgb(var(--h2-solid))' },
]
export const hueOf = (i: number) => HUES[i % HUES.length]
