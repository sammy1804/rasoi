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
  { bg: 'bg-[#EFD9CB]', text: 'text-[#8C4226]', ring: 'ring-[#B85C38]', solid: '#B85C38' },
  { bg: 'bg-[#DCE0EE]', text: 'text-[#3F4A7A]', ring: 'ring-[#62629A]', solid: '#62629A' },
  { bg: 'bg-[#E3E6D6]', text: 'text-[#4E5B33]', ring: 'ring-[#7A8C5C]', solid: '#7A8C5C' },
]
export const hueOf = (i: number) => HUES[i % HUES.length]
