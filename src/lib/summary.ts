import { allFoods, choiceKey, logsFor, mealFor, waterKey } from '@/data/repository'
import type { DB, Food, FoodLog, HouseholdMember, ISODate, MealSlot, Nutrients, Profile } from '@/data/types'
import { MEAL_SLOTS } from '@/data/types'
import { todayISO, weekdayOf } from './dates'
import { ZERO, addN, fvServingsFor, nutrientsFor, personalItems, type PersonalItem } from './nutrition'

export interface PlannedRow extends PersonalItem {
  log?: FoodLog
}

export interface SlotView {
  slot: MealSlot
  planned: PlannedRow[]
  extras: FoodLog[]
  done: boolean
  eatenCount: number
  requiredCount: number
  markedCount: number
}

export interface DayView {
  date: ISODate
  slots: SlotView[]
  totals: Nutrients
  plannedTotals: Nutrients
  fv: number
  mealsDone: number
  water: number
  logs: FoodLog[]
}

export function dayView(db: DB, member: HouseholdMember, date: ISODate): DayView {
  const foods = allFoods(db)
  const logs = logsFor(db, member.userId, date)
  const byItem = new Map(logs.filter((l) => l.mealItemId).map((l) => [l.mealItemId!, l]))
  const day = weekdayOf(date)
  let totals = ZERO
  let plannedTotals = ZERO
  let fv = 0
  const slots: SlotView[] = MEAL_SLOTS.map((slot) => {
    const meal = mealFor(db, member.householdId, day, slot)
    const items = personalItems(meal, member, date, foods, (id) => db.choices[choiceKey(member.userId, date, id)]?.altIndex ?? -1)
    const planned: PlannedRow[] = items.map((pi) => ({ ...pi, log: byItem.get(pi.item.id) }))
    const extras = logs.filter((l) => l.slot === slot && (!l.mealItemId || !items.some((i) => i.item.id === l.mealItemId)))
    const required = planned.filter((p) => !p.optional)
    for (const p of required) plannedTotals = addN(plannedTotals, nutrientsFor(p.food, p.portion.amount, p.portion.unit))
    const eatenCount = [...planned.map((p) => p.log), ...extras].filter((l) => l && l.status !== 'skipped').length
    const markedCount = required.filter((p) => p.log).length
    return {
      slot,
      planned,
      extras,
      eatenCount,
      requiredCount: required.length,
      markedCount,
      done: eatenCount > 0 && markedCount === required.length,
    }
  })
  for (const l of logs) {
    if (l.status === 'skipped') continue
    totals = addN(totals, l.nutrients)
    const f = foods[l.foodId]
    if (f) fv += fvServingsFor(f, l.amount, l.unit, l.fraction)
  }
  return {
    date,
    slots,
    totals,
    plannedTotals,
    fv,
    mealsDone: slots.filter((s) => s.done).length,
    water: db.waterLogs[waterKey(member.userId, date)]?.glasses ?? 0,
    logs,
  }
}

export type Tone = 'good' | 'nudge' | 'neutral'
export interface Insight {
  tone: Tone
  text: string
}

export function proteinIdeas(profile: Profile): string {
  const base = ['curd', 'paneer']
  if (profile.diet !== 'veg') base.push(profile.diet === 'egg-whites' ? 'egg whites' : 'eggs')
  base.push('chana')
  return base.slice(0, -1).join(', ') + ' or ' + base[base.length - 1]
}

export function dayInsights(view: DayView, profile: Profile): Insight[] {
  const out: Insight[] = []
  const { kcal, protein } = view.totals
  const isToday = view.date === todayISO()
  const hour = new Date().getHours()
  const dayMostlyOver = !isToday || hour >= 18 || view.mealsDone >= 3
  if (view.logs.length === 0) {
    return [{ tone: 'neutral', text: 'Tick things off as you eat — it takes a second, and your numbers fill in on their own.' }]
  }
  if (protein >= profile.proteinMin) out.push({ tone: 'good', text: 'Good protein intake today.' })
  else if (dayMostlyOver)
    out.push({ tone: 'nudge', text: `You’re still short on protein — consider ${proteinIdeas(profile)}.` })
  else if (protein >= profile.proteinMin * 0.45) out.push({ tone: 'good', text: 'Protein is on track so far.' })

  const lo = profile.calorieTarget * 0.9
  const hi = profile.calorieTarget * 1.1
  if (kcal >= lo && kcal <= hi) out.push({ tone: 'good', text: 'Calories are within your target range.' })
  else if (kcal > hi)
    out.push({ tone: 'neutral', text: 'A little above your usual range today — that’s fine, it evens out over the week.' })
  else if (dayMostlyOver && profile.goal === 'gain')
    out.push({ tone: 'nudge', text: 'Easy top-ups: a glass of milk, a banana with peanut butter, or a handful of nuts.' })
  else if (!dayMostlyOver) out.push({ tone: 'neutral', text: `About ${Math.max(0, Math.round((profile.calorieTarget - kcal) / 10) * 10).toLocaleString('en-IN')} kcal of room left today.` })
  if (view.fv >= 5) out.push({ tone: 'good', text: 'Five or more fruit & veg servings — lovely variety.' })
  return out.slice(0, 2)
}

/* ——————————— Weekly review ——————————— */

const FRUITS = new Set(['banana', 'apple', 'papaya', 'pineapple', 'orange', 'guava', 'watermelon', 'seasonal fruit'])

export interface WeekReview {
  loggedDays: number
  avgKcal: number
  avgProtein: number
  mealsCompleted: number
  mealsPossible: number
  mostSkipped: { slot: MealSlot; count: number } | null
  topFoods: { food: Food; count: number }[]
  veg: string[]
  fruit: string[]
  proteinDays: number
  calorieDays: number
  avgCarbs: number
  avgFat: number
  daily: { date: ISODate; kcal: number; protein: number; logged: boolean }[]
  /** per day, per meal slot: 2 = done, 1 = partly, 0 = nothing logged, null = still ahead */
  slotGrid: (0 | 1 | 2 | null)[][]
}

export function weekReview(db: DB, member: HouseholdMember, dates: ISODate[]): WeekReview {
  const foods = allFoods(db)
  const today = todayISO()
  const p = member.profile
  let sumK = 0
  let sumP = 0
  let logged = 0
  let mealsCompleted = 0
  let mealsPossible = 0
  let proteinDays = 0
  let calorieDays = 0
  let sumC = 0
  let sumF = 0
  const slotGrid: WeekReview['slotGrid'] = []
  const skipped: Record<MealSlot, number> = { breakfast: 0, lunch: 0, snack: 0, dinner: 0 }
  const counts = new Map<string, number>()
  const produce = new Set<string>()
  const daily: WeekReview['daily'] = []
  for (const date of dates) {
    if (date > today) {
      daily.push({ date, kcal: 0, protein: 0, logged: false })
      slotGrid.push([null, null, null, null])
      continue
    }
    const v = dayView(db, member, date)
    slotGrid.push(v.slots.map((sl) => (sl.done ? 2 : sl.eatenCount > 0 ? 1 : 0)))
    const has = v.logs.some((l) => l.status !== 'skipped')
    daily.push({ date, kcal: v.totals.kcal, protein: v.totals.protein, logged: has })
    mealsPossible += 4
    mealsCompleted += v.mealsDone
    for (const s of v.slots) {
      skipped[s.slot] += s.planned.filter((r) => r.log?.status === 'skipped').length
    }
    if (!has) continue
    logged++
    sumK += v.totals.kcal
    sumP += v.totals.protein
    sumC += v.totals.carbs
    sumF += v.totals.fat
    if (v.totals.protein >= p.proteinMin) proteinDays++
    if (v.totals.kcal >= p.calorieTarget * 0.9 && v.totals.kcal <= p.calorieTarget * 1.1) calorieDays++
    for (const l of v.logs) {
      if (l.status === 'skipped') continue
      counts.set(l.foodId, (counts.get(l.foodId) ?? 0) + 1)
      foods[l.foodId]?.produce?.forEach((x) => produce.add(x))
    }
  }
  const skippedEntries = Object.entries(skipped).sort((a, b) => b[1] - a[1])
  const mostSkipped = skippedEntries[0][1] > 0 ? { slot: skippedEntries[0][0] as MealSlot, count: skippedEntries[0][1] } : null
  const topFoods = [...counts.entries()]
    .filter(([id]) => foods[id])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ food: foods[id], count }))
  const all = [...produce]
  return {
    loggedDays: logged,
    avgKcal: logged ? sumK / logged : 0,
    avgProtein: logged ? sumP / logged : 0,
    mealsCompleted,
    mealsPossible,
    mostSkipped,
    topFoods,
    veg: all.filter((x) => !FRUITS.has(x) && x !== 'potato').sort(),
    fruit: all.filter((x) => FRUITS.has(x)).sort(),
    proteinDays,
    calorieDays,
    avgCarbs: logged ? sumC / logged : 0,
    avgFat: logged ? sumF / logged : 0,
    daily,
    slotGrid,
  }
}
