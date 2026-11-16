import type { MealSlot, Portion, PlanItemSpec, PortionStyle, Weekday } from './types'

/**
 * The household's base 7-day rotation. Every item carries a "lighter" and a
 * "hearty" portion (in the food's own units). Each member sees the same meal,
 * scaled to their portion style — that's the core idea of the app.
 */

type P = number | [amount: number, hint?: string, range?: [number, number]] | Portion

interface SeedItem {
  food: string
  L: P
  H: P
  unit?: string
  alts?: { food: string; L: P; H: P; unit?: string }[]
  optional?: boolean
  onlyFor?: PortionStyle
}

const toPortion = (p: P, unit?: string): Portion => {
  if (typeof p === 'number') return { amount: p, unit }
  if (Array.isArray(p)) return { amount: p[0], unit, hint: p[1], range: p[2] }
  return { unit, ...p }
}

export const toSpec = (s: { food: string; L: P; H: P; unit?: string }): PlanItemSpec => ({
  foodId: s.food,
  lighter: toPortion(s.L, s.unit),
  hearty: toPortion(s.H, s.unit),
})

const i = (food: string, L: P, H: P, opts: Partial<SeedItem> = {}): SeedItem => ({ food, L, H, ...opts })

const PANEER_L = '80–100 g paneer'
const PANEER_H = '100–120 g paneer'
const FRUIT_ALTS = [
  { food: 'banana', L: 1, H: 1 },
  { food: 'apple', L: 1, H: 1 },
  { food: 'papaya', L: 1, H: 1 },
  { food: 'pineapple', L: 1, H: 1 },
]
const chapati = (L: [number, number] = [1, 2], H: [number, number] = [2, 3], defL = 2, defH = 3) =>
  i('chapati', [defL, undefined, L], [defH, undefined, H])

/** Curd for everyone — Samridhi's version is high-protein dahi. */
const curd = (H: P = 1) => i('curd', { amount: 1, foodId: 'hp-curd' }, H)
const heartyCurd = i('curd', 1, 1, { optional: true, onlyFor: 'hearty' })
const lighterEggWhites = i('egg-white', 2, 2, { onlyFor: 'lighter' })
const lighterDahi = i('hp-curd', 1, 1, { onlyFor: 'lighter' })
const heartyGhee = i('ghee', 1, 1, { optional: true, onlyFor: 'hearty' })
const heartyEgg = i('egg-whole', 1, 1, { optional: true, onlyFor: 'hearty' })

export const SEED_PLAN: Record<Weekday, Record<MealSlot, SeedItem[]>> = {
  // MONDAY
  0: {
    breakfast: [
      i('besan-chilla', [2, undefined, [2, 2]], [3, undefined, [2, 3]]),
      i('paneer', [40, 'grated on top'], [40, 'grated on top']),
      i('paneer-dip', 2, 3),
      i('banana', 1, 1),
    ],
    lunch: [
      i('rice', [0.75, '¾–1 cup'], [1.5, '1½ cups']),
      i('beetroot-carrot', 1, 1),
      i('moong-dal', 1, 1.5),
      i('cucumber-tomato', 1, 1),
      curd(),
    ],
    snack: [i('watermelon-juice', 1, 1), i('nuts', 1, 1.5)],
    dinner: [chapati(), i('paneer-bhurji', [1, PANEER_L], [1.25, PANEER_H]), i('salad', 1, 1), heartyCurd, heartyGhee],
  },
  // TUESDAY
  1: {
    breakfast: [
      i('egg-white', 3, 3),
      heartyEgg,
      i('bread', 2, 2),
      i('peanut-butter', 1, 1.5),
      i('fruit', 1, 1, { alts: FRUIT_ALTS }),
    ],
    lunch: [chapati(), i('baingan-bharta', 1, 1), i('chana-dal', 1, 1.5), i('cucumber-tomato', 1, 1)],
    snack: [i('kala-chana-chaat', 1, 1.5)],
    dinner: [i('rice', [0.75, '¾–1 cup'], [1.5, '1½ cups']), i('bhindi', 1, 1), i('dal', 1, 1.5), curd()],
  },
  // WEDNESDAY
  2: {
    breakfast: [
      i('muesli', 40, 50),
      i('milk', 1, 1),
      i('banana', 1, 1),
      i('nuts', 1, 1),
      i('peanut-butter', 1, 1, { unit: 'tsp', H: 3 }),
    ],
    lunch: [i('rice', [0.75, '¾–1 cup'], [1.5, '1½ cups']), i('aloo-beans', 1, 1), i('dal', 1, 1.5), curd()],
    snack: [i('fruit', 1, 1, { alts: FRUIT_ALTS }), i('nuts', 1, 1.5), lighterDahi],
    dinner: [i('kadai-paneer', [1, PANEER_L], [1.25, PANEER_H]), chapati(), heartyCurd],
  },
  // THURSDAY
  3: {
    breakfast: [i('egg-white', 2, 3), heartyEgg, i('bread', 2, 2), i('peanut-butter', 1, 1.5), i('watermelon-juice', 1, 1)],
    lunch: [chapati(), i('patta-gobi-carrot', 1, 1), i('rajma', 1, 1.5), i('cucumber-tomato', 1, 1)],
    snack: [i('soya-crispy', 1, 1)],
    dinner: [i('soya-keema', 1, 1.5), chapati(), heartyCurd],
  },
  // FRIDAY
  4: {
    breakfast: [
      i('besan-chilla', [2, undefined, [2, 2]], [3, undefined, [2, 3]]),
      i('paneer', [40, 'grated on top'], [40, 'grated on top']),
      i('paneer-dip', 2, 3),
      i('tomato-capsicum', 1, 1),
    ],
    lunch: [i('rice', [0.75, '¾–1 cup'], [1.5, '1½ cups']), i('gobi-peas', 1, 1), i('dal', 1, 1.5), curd()],
    snack: [i('banana', 1, 1), i('peanut-butter', 1, 1.5)],
    dinner: [
      i('paneer-tikka', [5, PANEER_L], [6, PANEER_H]),
      i('onion-capsicum', 1, 1),
      chapati([1, 2], [2, 3], 1, 2),
      i('salad', 1, 1),
      heartyGhee,
    ],
  },
  // SATURDAY
  5: {
    breakfast: [i('oats-milk', 1, 1), i('banana', 1, 1), i('nuts', 1, 1), lighterEggWhites],
    lunch: [chapati(), i('beetroot-sabzi', 1, 1), i('dal', 1, 1.5), curd()],
    snack: [i('chhole-chaat', 1, 1.5)],
    dinner: [
      i('rice', [0.75, '¾–1 cup'], [1.5, '1½ cups']),
      i('patta-gobi', 1, 1, { alts: [{ food: 'gobi', L: 1, H: 1 }] }),
      i('dal', 1, 1.5, { alts: [{ food: 'curd', L: 1, H: 1.5 }] }),
      heartyCurd,
    ],
  },
  // SUNDAY
  6: {
    breakfast: [
      i('paneer-bhurji', [1, PANEER_L], [1, PANEER_L]),
      i('bread', 2, 2),
      i('cucumber-tomato', 1, 1),
      i('egg-white', 2, 2, { optional: true }),
    ],
    lunch: [
      i('rice', [0.75, '¾–1 cup'], [1.5, '1½ cups'], { alts: [{ food: 'chapati', L: [2, undefined, [1, 2]], H: [3, undefined, [2, 3]] }] }),
      i('baingan-bharta', 1, 1),
      i('dal', 1, 1.5),
      curd(),
      i('cucumber', 0.5, 0.5),
    ],
    snack: [i('watermelon-juice', 1, 1), i('fruit', 1, 1, { alts: FRUIT_ALTS }), i('nuts', 1, 1.5)],
    dinner: [
      i('kadai-paneer', [1, PANEER_L], [1.25, PANEER_H], {
        alts: [{ food: 'paneer-tikka', L: [5, PANEER_L], H: [6, PANEER_H] }],
      }),
      chapati(),
      i('salad', 1, 1),
      heartyCurd,
    ],
  },
}

export type { SeedItem }
