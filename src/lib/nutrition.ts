import type {
  Activity,
  Food,
  FoodUnit,
  Goal,
  HouseholdMember,
  ISODate,
  Meal,
  MealItem,
  Nutrients,
  PlanItemSpec,
  Portion,
  PortionStyle,
  Profile,
} from '@/data/types'
import { daysBetween } from './dates'
import { clamp, round } from './utils'

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }

export function addN(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fibre: a.fibre + b.fibre,
  }
}

export function scaleN(a: Nutrients, k: number): Nutrients {
  return { kcal: a.kcal * k, protein: a.protein * k, carbs: a.carbs * k, fat: a.fat * k, fibre: a.fibre * k }
}

export function unitOf(food: Food, unit?: string): FoodUnit {
  return food.units.find((u) => u.name === unit) ?? food.units.find((u) => u.name === food.defaultUnit) ?? food.units[0]
}

export function gramsFor(food: Food, amount: number, unit?: string): number {
  return unitOf(food, unit).grams * amount
}

/** Estimated nutrients for an amount of a food. */
export function nutrientsFor(food: Food, amount: number, unit?: string, fraction = 1): Nutrients {
  const grams = gramsFor(food, amount, unit) * fraction
  return scaleN(food.per100, grams / 100)
}

export function fvServingsFor(food: Food, amount: number, unit?: string, fraction = 1): number {
  if (!food.fvPer100) return 0
  return (gramsFor(food, amount, unit) * fraction * food.fvPer100) / 100
}

// ——— Targets ———

const ACTIVITY_FACTOR: Record<Activity, number> = { light: 1.375, moderate: 1.55, active: 1.7 }
const GOAL_DELTA: Record<Goal, number> = { lose: -300, maintain: 0, gain: 300 }

/**
 * Rough starting estimate (Mifflin-St Jeor × activity ± a gentle 300 kcal).
 * Only a starting point — never medical advice.
 */
export function suggestTargets(p: Pick<Profile, 'age' | 'sex' | 'heightCm' | 'weightKg' | 'goal' | 'activity'>) {
  const age = p.age ?? 28
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * age + (p.sex === 'male' ? 5 : -161)
  const tdee = bmr * ACTIVITY_FACTOR[p.activity]
  const kcal = round(clamp(tdee + GOAL_DELTA[p.goal], 1200, 3500), 50)
  // ~1.3–1.6 g/kg for losing (keep muscle), 1.6–2.0 g/kg for gaining, capped sensibly
  const perKg = p.goal === 'lose' ? [1.35, 1.6] : p.goal === 'gain' ? [1.6, 2.0] : [1.2, 1.5]
  const proteinMin = round(clamp(p.weightKg * perKg[0], 50, 160), 5)
  const proteinTarget = round(clamp(p.weightKg * perKg[1], proteinMin, 180), 5)
  return { calorieTarget: kcal, proteinMin, proteinTarget }
}

export function portionStyleForGoal(goal: Goal): PortionStyle {
  return goal === 'lose' ? 'lighter' : goal === 'gain' ? 'hearty' : 'standard'
}

export const PORTION_LABEL: Record<PortionStyle, string> = {
  lighter: 'Lighter portions',
  standard: 'Standard portions',
  hearty: 'Hearty portions',
}

// ——— Personal portions ———

function smartRound(amount: number, unit: string | undefined): number {
  if (unit === 'g' || unit === 'ml') return Math.max(5, round(amount, 5))
  if (amount >= 2) return Math.max(0.5, round(amount, 0.5))
  return Math.max(0.25, round(amount, 0.25))
}

export function portionFor(spec: PlanItemSpec, style: PortionStyle): Portion {
  if (style === 'lighter') return spec.lighter
  if (style === 'hearty') return spec.hearty
  if (spec.standard) return spec.standard
  const unit = spec.lighter.unit
  const amount = smartRound((spec.lighter.amount + spec.hearty.amount) / 2, unit)
  const range: [number, number] | undefined =
    spec.lighter.range && spec.hearty.range
      ? [spec.lighter.range[0], spec.hearty.range[1] - 1 >= spec.lighter.range[0] ? spec.hearty.range[1] - 1 : spec.hearty.range[1]]
      : undefined
  return { amount, unit, range, hint: spec.lighter.hint === spec.hearty.hint ? spec.lighter.hint : undefined }
}

export function breakfastRampFactor(profile: Profile, date: ISODate): number {
  const r = profile.breakfastRamp
  if (!r?.enabled) return 1
  const weeks = Math.max(0, Math.floor(daysBetween(r.startedOn, date) / 7))
  return clamp((r.startPct + weeks * r.weeklyStepPct) / 100, 0.3, 1)
}

export function rampWeekLabel(profile: Profile, date: ISODate): string | null {
  const r = profile.breakfastRamp
  if (!r?.enabled) return null
  const pct = Math.round(breakfastRampFactor(profile, date) * 100)
  if (pct >= 100) return 'Full breakfast — you built up to it.'
  return `Breakfast at ${pct}% this week · building up gently`
}

export function dietBlocks(food: Food, profile: Profile): boolean {
  const c = food.contains ?? []
  if (profile.diet === 'veg') return c.includes('egg-white') || c.includes('egg-yolk') || c.includes('meat')
  if (profile.diet === 'egg-whites') return c.includes('egg-yolk') || c.includes('meat')
  if (profile.diet === 'eggs') return c.includes('meat')
  return false
}

export function isDisliked(food: Food, profile: Profile): boolean {
  if (!profile.dislikes.length) return false
  const hay = [food.name, ...(food.produce ?? []), ...(food.tags ?? [])].join(' ').toLowerCase()
  return profile.dislikes.some((d) => d.trim() && hay.includes(d.trim().toLowerCase()))
}

export interface PersonalItem {
  item: MealItem
  spec: PlanItemSpec
  altIndex: number // -1 primary
  food: Food
  portion: Portion & { unit: string }
  optional: boolean
  disliked: boolean
}

export function personalItems(
  meal: Meal | undefined,
  member: HouseholdMember,
  date: ISODate,
  foods: Record<string, Food>,
  choiceFor: (itemId: string) => number,
): PersonalItem[] {
  if (!meal) return []
  const style = member.profile.portionStyle
  const ramp = meal.slot === 'breakfast' ? breakfastRampFactor(member.profile, date) : 1
  const out: PersonalItem[] = []
  for (const item of meal.items) {
    if (item.onlyFor && item.onlyFor !== style) continue
    let altIndex = choiceFor(item.id)
    const specs = [item as PlanItemSpec, ...(item.alts ?? [])]
    if (altIndex < -1 || altIndex >= specs.length - 1) altIndex = -1
    const resolve = (sp: PlanItemSpec) => {
      const base = portionFor(sp, style)
      return { base, food: foods[base.foodId ?? sp.foodId] as Food | undefined }
    }
    let spec = specs[altIndex + 1]
    let { base, food } = resolve(spec)
    // Respect diet: fall back to the first alternative the person can eat.
    if (food && dietBlocks(food, member.profile)) {
      const idx = specs.findIndex((s) => {
        const r = resolve(s)
        return r.food && !dietBlocks(r.food, member.profile)
      })
      if (idx === -1) continue
      spec = specs[idx]
      ;({ base, food } = resolve(spec))
      altIndex = idx - 1
    }
    if (!food) continue
    const unit = base.unit && food.units.some((u) => u.name === base.unit) ? base.unit : food.defaultUnit
    const amount = ramp < 1 ? smartRound(base.amount * ramp, unit) : base.amount
    const range = base.range && ramp < 1 ? undefined : base.range
    out.push({
      item,
      spec,
      altIndex,
      food,
      portion: { ...base, amount, unit, range },
      optional: !!item.optional,
      disliked: isDisliked(food, member.profile),
    })
  }
  return out
}
