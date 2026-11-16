import { addDays, todayISO, weekdayOf } from '@/lib/dates'
import { personalItems } from '@/lib/nutrition'
import { _internals, allFoods, choiceKey, mealFor, waterKey } from './repository'
import { emptyDB, replaceDB, setSessionUserId } from './store'
import type { DB, Profile } from './types'
import { MEAL_SLOTS } from './types'

export const SAMRIDHI_PROFILE = (): Profile => ({
  age: 24,
  sex: 'female',
  heightCm: 155,
  weightKg: 56,
  goal: 'lose',
  activity: 'moderate',
  activityNote: 'Calisthenics Mon–Fri',
  diet: 'egg-whites',
  dislikes: ['egg yolk', 'kaddu'],
  calorieTarget: 1650,
  proteinMin: 75,
  proteinTarget: 90,
  portionStyle: 'lighter',
  breakfastRamp: { enabled: false, startPct: 70, weeklyStepPct: 10, startedOn: todayISO() },
  trackWater: true,
  waterTargetGlasses: 8,
})

export const NAINA_PROFILE = (): Profile => ({
  age: 27,
  sex: 'female',
  heightCm: 155,
  weightKg: 40,
  goal: 'gain',
  activity: 'light',
  diet: 'non-veg',
  dislikes: ['lauki', 'kaddu'],
  calorieTarget: 1900,
  proteinMin: 65,
  proteinTarget: 75,
  portionStyle: 'hearty',
  breakfastRamp: { enabled: true, startPct: 70, weeklyStepPct: 10, startedOn: addDays(todayISO(), -10) },
  trackWater: true,
  waterTargetGlasses: 8,
})

/** Deterministic PRNG so the demo looks the same every time. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ALL_TIPS = { intro: true, plannedVsEaten: true, firstTick: true, sharing: true, swipe: true }

export function buildDemo() {
  const db: DB = emptyDB()
  const { buildLog, newMember, uniqueCode, seedPlan, insertCook } = _internals
  const householdId = 'hh_demo'
  const s = newMember(db, householdId, { name: 'Samridhi', profile: SAMRIDHI_PROFILE() }, 'owner', 0)
  const n = newMember(db, householdId, { name: 'Naina', profile: NAINA_PROFILE() }, 'member', 1)
  // Naina joined a little after Samridhi
  db.members[n.memberId].joinedAt = new Date(Date.now() + 1000).toISOString()
  db.members[s.memberId].tips = { ...ALL_TIPS }
  db.members[n.memberId].tips = { ...ALL_TIPS }
  db.households[householdId] = {
    id: householdId,
    name: 'Home',
    code: uniqueCode(db),
    createdBy: s.userId,
    createdAt: new Date().toISOString(),
    mealTimes: { breakfast: '08:30', lunch: '13:30', snack: '17:00', dinner: '20:30' },
  }
  seedPlan(db, householdId)
  const cook = insertCook(db, householdId, {
    name: 'Sunita',
    language: 'hi',
    visits: [
      { label: 'Morning', time: '07:45', slots: ['breakfast', 'lunch'] },
      { label: 'Evening', time: '18:30', slots: ['snack', 'dinner'] },
    ],
    weeklyOff: [],
  })
  const leaveId = 'leave_demo'
  db.cookLeaves[leaveId] = { id: leaveId, cookId: cook.id, date: addDays(todayISO(), 3), note: 'Going to my village', createdBy: cook.id, createdAt: new Date().toISOString() }

  const foods = allFoods(db)
  const rand = mulberry32(42)
  const today = todayISO()

  const people = [
    { ...s, extras: ['chai', 'hp-curd', 'coffee'], skipBias: 0 },
    { ...n, extras: ['chai', 'biscuits', 'milk', 'peanuts'], skipBias: 0.06 },
  ]

  for (let back = 13; back >= 0; back--) {
    const date = addDays(today, -back)
    const day = weekdayOf(date)
    for (const p of people) {
      const member = db.members[p.memberId]
      for (const slot of MEAL_SLOTS) {
        if (back === 0 && slot !== 'breakfast') continue
        const meal = mealFor(db, householdId, day, slot)
        // occasionally pick an alternative
        meal?.items.forEach((it) => {
          if (it.alts?.length && rand() < 0.35) {
            const altIndex = Math.floor(rand() * it.alts.length)
            db.choices[choiceKey(p.userId, date, it.id)] = { userId: p.userId, date, mealItemId: it.id, altIndex }
          }
        })
        const items = personalItems(meal, member, date, foods, (id) => db.choices[choiceKey(p.userId, date, id)]?.altIndex ?? -1)
        for (const pi of items) {
          const r = rand()
          const snackPenalty = slot === 'snack' ? 0.12 : 0
          let status: 'eaten' | 'partial' | 'skipped' | null
          if (pi.optional) status = rand() < 0.3 ? 'eaten' : null
          else if (back === 0) {
            // today: Samridhi has had most of breakfast, Naina is part-way through
            status = p.userId === s.userId ? (pi.food.id === 'banana' ? null : 'eaten') : pi.food.id === 'besan-chilla' ? 'partial' : null
          } else if (r < 0.74 - snackPenalty - p.skipBias) status = 'eaten'
          else if (r < 0.86 - snackPenalty / 2) status = 'partial'
          else if (r < 0.95) status = 'skipped'
          else status = null
          if (!status) continue
          const fraction = status === 'partial' ? [0.5, 0.75, 0.5, 0.25][Math.floor(rand() * 4)] : 1
          let amount = pi.portion.amount
          if (status === 'eaten' && pi.food.id === 'chapati' && rand() < 0.3) amount = Math.max(1, amount - 1)
          const log = buildLog(db, {
            householdId,
            userId: p.userId,
            date,
            slot,
            foodId: pi.food.id,
            amount,
            unit: pi.portion.unit,
            status,
            fraction,
            mealItemId: pi.item.id,
          })
          const t = new Date(date + 'T08:00:00')
          t.setHours(8 + MEAL_SLOTS.indexOf(slot) * 4)
          log.createdAt = log.updatedAt = t.toISOString()
          db.foodLogs[log.id] = log
        }
      }
      // extras
      if (back > 0) {
        for (const extra of p.extras) {
          if (rand() < (extra === 'chai' ? 0.85 : 0.3)) {
            const f = foods[extra]
            const slot = extra === 'chai' ? 'breakfast' : extra === 'milk' ? 'dinner' : 'snack'
            const log = buildLog(db, { householdId, userId: p.userId, date, slot, foodId: f.id, amount: f.defaultAmount, unit: f.defaultUnit })
            db.foodLogs[log.id] = log
          }
        }
        db.waterLogs[waterKey(p.userId, date)] = { userId: p.userId, date, glasses: 5 + Math.floor(rand() * 4) }
      } else {
        db.waterLogs[waterKey(p.userId, date)] = { userId: p.userId, date, glasses: 2 }
      }
    }
  }

  // weekly weigh-ins
  const sw = [56.9, 56.8, 56.5, 56.4, 56.2, 56.0]
  const nw = [39.2, 39.3, 39.5, 39.4, 39.7, 40.0]
  sw.forEach((kg, i) => {
    const id = `w_s${i}`
    db.weightLogs[id] = { id, userId: s.userId, date: addDays(today, -7 * (sw.length - 1 - i) - 1), kg }
  })
  nw.forEach((kg, i) => {
    const id = `w_n${i}`
    db.weightLogs[id] = { id, userId: n.userId, date: addDays(today, -7 * (nw.length - 1 - i) - 2), kg }
  })

  replaceDB(db)
  setSessionUserId(s.userId)
  return db.households[householdId]
}
