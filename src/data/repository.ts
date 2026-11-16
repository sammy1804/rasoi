import { nutrientsFor, portionStyleForGoal } from '@/lib/nutrition'
import { joinCode, uid } from '@/lib/utils'
import { BUILTIN_FOOD_MAP } from './foods'
import { SEED_PLAN, toSpec } from './mealPlanSeed'
import { commit, emptyDB, getDB, replaceDB, setSessionUserId } from './store'
import { weekdayOf } from '@/lib/dates'
import type {
  Cook,
  CookAccount,
  CookHouse,
  CookLanguage,
  CookLeave,
  CookVisit,
  DB,
  Food,
  FoodLog,
  Household,
  HouseholdMember,
  ID,
  ISODate,
  LogStatus,
  Meal,
  MealItem,
  MealSlot,
  PlanItemSpec,
  Profile,
  Shop,
  ShopKind,
  SpendLog,
  RecipeIngredient,
  SharingSettings,
  Weekday,
} from './types'
import { MEAL_SLOTS } from './types'

export const MAX_MEMBERS = 2

/* ———————————————————— Selectors ———————————————————— */

export function allFoods(db: DB): Record<ID, Food> {
  return { ...BUILTIN_FOOD_MAP, ...db.foods }
}

export function membersOf(db: DB, householdId: ID): HouseholdMember[] {
  return Object.values(db.members)
    .filter((m) => m.householdId === householdId)
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
}

export function memberForUser(db: DB, userId: ID | null): HouseholdMember | undefined {
  if (!userId) return undefined
  return Object.values(db.members).find((m) => m.userId === userId)
}

export function planOf(db: DB, householdId: ID) {
  return Object.values(db.mealPlans).find((p) => p.householdId === householdId)
}

export function mealFor(db: DB, householdId: ID, day: Weekday, slot: MealSlot): Meal | undefined {
  const plan = planOf(db, householdId)
  if (!plan) return undefined
  return Object.values(db.meals).find((m) => m.mealPlanId === plan.id && m.day === day && m.slot === slot)
}

export function logsFor(db: DB, userId: ID, date: ISODate): FoodLog[] {
  return Object.values(db.foodLogs)
    .filter((l) => l.userId === userId && l.date === date)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function logsInRange(db: DB, userId: ID, dates: ISODate[]): FoodLog[] {
  const set = new Set(dates)
  return Object.values(db.foodLogs).filter((l) => l.userId === userId && set.has(l.date))
}

export const choiceKey = (userId: ID, date: ISODate, itemId: ID) => `${userId}|${date}|${itemId}`
export const waterKey = (userId: ID, date: ISODate) => `${userId}|${date}`

export function findHouseholdByCode(db: DB, code: string): Household | undefined {
  const c = code.trim().toUpperCase()
  return Object.values(db.households).find((h) => h.code === c)
}

/* ———————————————————— Household & onboarding ———————————————————— */

export const DEFAULT_SHARING: SharingSettings = { fullLog: true, calories: true, protein: true, mealCompletion: true }

function seedPlan(draft: DB, householdId: ID) {
  const planId = uid('plan')
  draft.mealPlans[planId] = { id: planId, householdId, name: 'Our week', createdAt: new Date().toISOString() }
  for (const [dayStr, slots] of Object.entries(SEED_PLAN)) {
    const day = Number(dayStr) as Weekday
    for (const slot of MEAL_SLOTS) {
      const mealId = uid('meal')
      const items: MealItem[] = slots[slot].map((s) => ({
        id: uid('item'),
        ...toSpec(s),
        alts: s.alts?.map(toSpec),
        optional: s.optional,
        onlyFor: s.onlyFor,
      }))
      draft.meals[mealId] = { id: mealId, mealPlanId: planId, day, slot, items }
    }
  }
}

function uniqueCode(db: DB): string {
  let code = joinCode()
  while (findHouseholdByCode(db, code)) code = joinCode()
  return code
}

export interface NewPerson {
  name: string
  profile: Profile
}

function newMember(draft: DB, householdId: ID, person: NewPerson, role: 'owner' | 'member', hue: number) {
  const userId = uid('user')
  const now = new Date().toISOString()
  draft.users[userId] = { id: userId, name: person.name.trim(), createdAt: now }
  const memberId = uid('mem')
  draft.members[memberId] = {
    id: memberId,
    householdId,
    userId,
    role,
    joinedAt: now,
    hue,
    profile: person.profile,
    sharing: { ...DEFAULT_SHARING },
    tips: {},
  }
  return { userId, memberId }
}

export const DEFAULT_MEAL_TIMES: Record<MealSlot, string> = { breakfast: '08:30', lunch: '13:30', snack: '17:00', dinner: '20:30' }

export interface CookInput {
  name: string
  phone?: string
  language: CookLanguage
  visits: Omit<CookVisit, 'id'>[]
  weeklyOff: Weekday[]
}

export function createHousehold(
  person: NewPerson,
  householdName: string,
  opts: { mealTimes?: Record<MealSlot, string>; cook?: CookInput } = {},
): { householdId: ID; code: string } {
  let result = { householdId: '', code: '' }
  let newUserId = ''
  commit((draft) => {
    const householdId = uid('hh')
    const code = uniqueCode(draft)
    const { userId } = newMember(draft, householdId, person, 'owner', 0)
    draft.households[householdId] = {
      id: householdId,
      name: householdName.trim() || `${person.name}'s kitchen`,
      code,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      mealTimes: opts.mealTimes ?? { ...DEFAULT_MEAL_TIMES },
    }
    seedPlan(draft, householdId)
    if (opts.cook) insertCook(draft, householdId, opts.cook)
    result = { householdId, code }
    newUserId = userId
  })
  setSessionUserId(newUserId)
  return result
}

export type JoinError = 'not-found' | 'full'

export function checkJoin(code: string): { household?: Household; members: HouseholdMember[]; error?: JoinError } {
  const db = getDB()
  const household = findHouseholdByCode(db, code)
  if (!household) return { members: [], error: 'not-found' }
  const members = membersOf(db, household.id)
  if (members.length >= MAX_MEMBERS) return { household, members, error: 'full' }
  return { household, members }
}

export function joinHousehold(code: string, person: NewPerson): { error?: JoinError } {
  const check = checkJoin(code)
  if (check.error || !check.household) return { error: check.error }
  const householdId = check.household.id
  let newUserId = ''
  commit((draft) => {
    newUserId = newMember(draft, householdId, person, 'member', check.members.length).userId
  })
  setSessionUserId(newUserId)
  return {}
}

export function updateProfile(memberId: ID, patch: Partial<Profile>) {
  commit((d) => {
    const m = d.members[memberId]
    if (!m) return
    m.profile = { ...m.profile, ...patch }
    if (patch.goal && !('portionStyle' in patch)) m.profile.portionStyle = portionStyleForGoal(patch.goal)
  })
}

export function updateUserName(userId: ID, name: string) {
  commit((d) => {
    if (d.users[userId] && name.trim()) d.users[userId].name = name.trim()
  })
}

export function updateHouseholdName(householdId: ID, name: string) {
  commit((d) => {
    if (d.households[householdId] && name.trim()) d.households[householdId].name = name.trim()
  })
}

export function updateSharing(memberId: ID, patch: Partial<SharingSettings>) {
  commit((d) => {
    const m = d.members[memberId]
    if (m) m.sharing = { ...m.sharing, ...patch }
  })
}

export function markTip(memberId: ID, tip: string, value = true) {
  commit((d) => {
    const m = d.members[memberId]
    if (m) m.tips = { ...m.tips, [tip]: value }
  })
}

export function resetTips(memberId: ID) {
  commit((d) => {
    const m = d.members[memberId]
    if (m) m.tips = {}
  })
}

export function leaveHousehold(memberId: ID) {
  commit((d) => {
    const m = d.members[memberId]
    if (!m) return
    delete d.members[memberId]
    delete d.users[m.userId]
    for (const [k, l] of Object.entries(d.foodLogs)) if (l.userId === m.userId) delete d.foodLogs[k]
    for (const [k, w] of Object.entries(d.weightLogs)) if (w.userId === m.userId) delete d.weightLogs[k]
  })
  setSessionUserId(null)
}

/* ———————————————————— Logging ———————————————————— */

interface LogInput {
  householdId: ID
  userId: ID
  date: ISODate
  slot: MealSlot
  foodId: ID
  amount: number
  unit: string
  status?: LogStatus
  fraction?: number
  mealItemId?: ID
  photoId?: string
}

function buildLog(db: DB, input: LogInput, existing?: FoodLog): FoodLog {
  const food = allFoods(db)[input.foodId]
  const fraction = input.status === 'skipped' ? 0 : input.fraction ?? 1
  const now = new Date().toISOString()
  return {
    id: existing?.id ?? uid('log'),
    householdId: input.householdId,
    userId: input.userId,
    date: input.date,
    slot: input.slot,
    mealItemId: input.mealItemId,
    foodId: input.foodId,
    status: input.status ?? 'eaten',
    amount: input.amount,
    unit: input.unit,
    fraction,
    nutrients: food ? nutrientsFor(food, input.amount, input.unit, fraction) : { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 },
    photoId: input.photoId ?? existing?.photoId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

export function planLogFor(db: DB, userId: ID, date: ISODate, mealItemId: ID): FoodLog | undefined {
  return Object.values(db.foodLogs).find((l) => l.userId === userId && l.date === date && l.mealItemId === mealItemId)
}

/** Create or update the log entry for a planned item (or an extra if no mealItemId). */
export function upsertLog(input: LogInput, logId?: ID): FoodLog {
  let saved!: FoodLog
  commit((d) => {
    const existing = logId
      ? d.foodLogs[logId]
      : input.mealItemId
        ? planLogFor(d, input.userId, input.date, input.mealItemId)
        : undefined
    saved = buildLog(d, input, existing)
    d.foodLogs[saved.id] = saved
  })
  return saved
}

export function deleteLog(logId: ID) {
  commit((d) => {
    delete d.foodLogs[logId]
  })
}

export function clearPlanLog(userId: ID, date: ISODate, mealItemId: ID) {
  commit((d) => {
    const l = planLogFor(d, userId, date, mealItemId)
    if (l) delete d.foodLogs[l.id]
  })
}

export function setChoice(userId: ID, date: ISODate, mealItemId: ID, altIndex: number) {
  commit((d) => {
    d.choices[choiceKey(userId, date, mealItemId)] = { userId, date, mealItemId, altIndex }
  })
}

export function setWater(userId: ID, date: ISODate, glasses: number) {
  commit((d) => {
    d.waterLogs[waterKey(userId, date)] = { userId, date, glasses: Math.max(0, Math.min(20, glasses)) }
  })
}

export function addWeight(userId: ID, date: ISODate, kg: number) {
  commit((d) => {
    for (const [k, w] of Object.entries(d.weightLogs)) if (w.userId === userId && w.date === date) delete d.weightLogs[k]
    const id = uid('w')
    d.weightLogs[id] = { id, userId, date, kg: Math.round(kg * 10) / 10 }
  })
}

export function deleteWeight(id: ID) {
  commit((d) => {
    delete d.weightLogs[id]
  })
}

/* ———————————————————— Foods & recipes ———————————————————— */

export interface CustomFoodInput {
  name: string
  category: Food['category']
  servingName: string
  servingGrams?: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  fibre: number
}

/** Custom foods are entered per serving; stored per 100 "units" so the maths stays uniform. */
export function addCustomFood(householdId: ID, userId: ID, input: CustomFoodInput): Food {
  const id = uid('food')
  const grams = input.servingGrams && input.servingGrams > 0 ? input.servingGrams : 100
  const k = 100 / grams
  const food: Food = {
    id,
    name: input.name.trim(),
    category: input.category,
    per100: {
      kcal: input.kcal * k,
      protein: input.protein * k,
      carbs: input.carbs * k,
      fat: input.fat * k,
      fibre: input.fibre * k,
    },
    units: input.servingGrams ? [{ name: input.servingName || 'serving', grams }, { name: 'g', grams: 1 }] : [{ name: input.servingName || 'serving', grams }],
    defaultUnit: input.servingName || 'serving',
    defaultAmount: 1,
    householdId,
    createdBy: userId,
    tags: ['custom'],
  }
  commit((d) => {
    d.foods[id] = food
  })
  return food
}

export function recipeTotals(db: DB, ingredients: RecipeIngredient[]) {
  const foods = allFoods(db)
  let grams = 0
  const total = { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }
  const produce = new Set<string>()
  let fv = 0
  for (const ing of ingredients) {
    const f = foods[ing.foodId]
    if (!f) continue
    const u = f.units.find((x) => x.name === ing.unit) ?? f.units[0]
    const g = u.grams * ing.amount
    grams += g
    const n = nutrientsFor(f, ing.amount, ing.unit)
    total.kcal += n.kcal
    total.protein += n.protein
    total.carbs += n.carbs
    total.fat += n.fat
    total.fibre += n.fibre
    f.produce?.forEach((p) => produce.add(p))
    fv += ((f.fvPer100 ?? 0) * g) / 100
  }
  return { grams, total, produce: [...produce], fv }
}

export function saveRecipe(
  householdId: ID,
  userId: ID,
  name: string,
  servings: number,
  ingredients: RecipeIngredient[],
): Food {
  const db = getDB()
  const { grams, total, produce, fv } = recipeTotals(db, ingredients)
  const safeGrams = Math.max(grams, 1)
  const k = 100 / safeGrams
  const foodId = uid('food')
  const recipeId = uid('rcp')
  const perServing = safeGrams / Math.max(servings, 1)
  const food: Food = {
    id: foodId,
    name: name.trim(),
    category: 'homemade',
    per100: {
      kcal: total.kcal * k,
      protein: total.protein * k,
      carbs: total.carbs * k,
      fat: total.fat * k,
      fibre: total.fibre * k,
    },
    units: [{ name: 'serving', grams: Math.round(perServing), label: `serving (~${Math.round(perServing)} g)` }, { name: 'g', grams: 1 }],
    defaultUnit: 'serving',
    defaultAmount: 1,
    fvPer100: (fv / safeGrams) * 100,
    produce,
    householdId,
    createdBy: userId,
    recipeId,
    tags: ['homemade', 'recipe'],
  }
  commit((d) => {
    d.foods[foodId] = food
    d.recipes[recipeId] = {
      id: recipeId,
      householdId,
      createdBy: userId,
      name: name.trim(),
      servings,
      ingredients,
      foodId,
      createdAt: new Date().toISOString(),
    }
  })
  return food
}

export function deleteCustomFood(foodId: ID) {
  commit((d) => {
    const f = d.foods[foodId]
    if (f) f.archived = true
  })
}

/* ———————————————————— Plan editing ———————————————————— */

export function addPlanItem(mealId: ID, spec: PlanItemSpec, opts: Partial<MealItem> = {}) {
  commit((d) => {
    const meal = d.meals[mealId]
    if (meal) meal.items.push({ id: uid('item'), ...spec, ...opts })
  })
}

export function updatePlanItem(mealId: ID, itemId: ID, patch: Partial<MealItem>) {
  commit((d) => {
    const meal = d.meals[mealId]
    const item = meal?.items.find((i) => i.id === itemId)
    if (item) Object.assign(item, patch)
  })
}

export function removePlanItem(mealId: ID, itemId: ID) {
  commit((d) => {
    const meal = d.meals[mealId]
    if (meal) meal.items = meal.items.filter((i) => i.id !== itemId)
  })
}

export function resetPlan(householdId: ID) {
  commit((d) => {
    const plan = Object.values(d.mealPlans).find((p) => p.householdId === householdId)
    if (plan) {
      for (const [k, m] of Object.entries(d.meals)) if (m.mealPlanId === plan.id) delete d.meals[k]
      delete d.mealPlans[plan.id]
    }
    seedPlan(d, householdId)
  })
}

/* ———————————————————— Session, reset, demo ———————————————————— */

export function switchUser(userId: ID) {
  setSessionUserId(userId)
}

export function signOut() {
  setSessionUserId(null)
}

export function resetAll() {
  replaceDB(emptyDB())
  setSessionUserId(null)
}

/* ———————————————————— Kitchen: cook, leave, meal times, groceries ———————————————————— */

export function cooksOf(db: DB, householdId: ID): Cook[] {
  return Object.values(db.cooks)
    .filter((c) => c.householdId === householdId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}


export function normalisePhone(raw: string | undefined): string | undefined {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (!digits) return undefined
  // assume India when a 10-digit mobile number is typed
  if (digits.length === 10) return '91' + digits
  return digits.replace(/^0+/, '')
}

function insertCook(draft: DB, householdId: ID, input: CookInput, userId?: ID): Cook {
  const id = uid('cook')
  const cook: Cook = {
    id,
    householdId,
    name: input.name.trim(),
    phone: normalisePhone(input.phone),
    language: input.language,
    visits: input.visits.map((v) => ({ ...v, id: uid('visit') })),
    weeklyOff: input.weeklyOff,
    userId,
    createdAt: new Date().toISOString(),
  }
  draft.cooks[id] = cook
  return cook
}

export function addCook(householdId: ID, input: CookInput): Cook {
  let cook!: Cook
  commit((d) => {
    cook = insertCook(d, householdId, input)
  })
  return cook
}

export function updateCook(cookId: ID, patch: Partial<Omit<Cook, 'id' | 'householdId'>>) {
  commit((d) => {
    const c = d.cooks[cookId]
    if (!c) return
    Object.assign(c, patch)
    if ('phone' in patch) c.phone = normalisePhone(patch.phone)
  })
}

export function removeCook(cookId: ID) {
  commit((d) => {
    delete d.cooks[cookId]
    for (const [k, l] of Object.entries(d.cookLeaves)) if (l.cookId === cookId) delete d.cookLeaves[k]
  })
}

/* ——— The cook's own account: one sign-in, several houses ——— */

export const DEFAULT_VISITS: Omit<CookVisit, 'id'>[] = [
  { label: 'Morning', time: '07:45', slots: ['breakfast', 'lunch'] },
  { label: 'Evening', time: '18:30', slots: ['snack', 'dinner'] },
]

export function createCookAccount(input: { name: string; phone?: string; language: CookLanguage }): ID {
  let userId = ''
  commit((d) => {
    userId = uid('user')
    const now = new Date().toISOString()
    d.users[userId] = { id: userId, name: input.name.trim(), createdAt: now }
    d.cookAccounts[userId] = { userId, name: input.name.trim(), phone: normalisePhone(input.phone), language: input.language, createdAt: now }
  })
  setSessionUserId(userId)
  return userId
}

export function updateCookAccount(userId: ID, patch: Partial<Pick<CookAccount, 'name' | 'phone' | 'language'>>) {
  commit((d) => {
    const a = d.cookAccounts[userId]
    if (!a) return
    Object.assign(a, patch)
    if ('phone' in patch) a.phone = normalisePhone(patch.phone)
    if (patch.name && d.users[userId]) d.users[userId].name = patch.name
  })
}

/** Houses on this phone that this cook works at. */
export function localCooksOf(db: DB, userId: ID): Cook[] {
  return Object.values(db.cooks)
    .filter((c) => c.userId === userId && db.households[c.householdId])
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Houses this cook added from a family's link. */
export function importedHousesOf(db: DB, userId: ID): CookHouse[] {
  return Object.values(db.cookHouses)
    .filter((h) => h.userId === userId)
    .sort((a, b) => a.importedAt.localeCompare(b.importedAt) || a.name.localeCompare(b.name))
}

/** Add a house with its family code. The household has to be on this phone (or be a demo code). */
export function addHouseByCode(userId: ID, code: string): { error?: 'not-found' | 'already' } {
  const db = getDB()
  const household = findHouseholdByCode(db, code)
  const account = db.cookAccounts[userId]
  if (!household || !account) return { error: 'not-found' }
  if (Object.values(db.cooks).some((c) => c.householdId === household.id && c.userId === userId)) return { error: 'already' }
  commit((d) => {
    // take over the profile the family set up for their cook, if there is one waiting
    const waiting = Object.values(d.cooks).find((c) => c.householdId === household.id && !c.userId)
    if (waiting) waiting.userId = userId
    else insertCook(d, household.id, { name: account.name, phone: account.phone, language: account.language, visits: DEFAULT_VISITS, weeklyOff: [] }, userId)
  })
  return {}
}

/** Stop working at a house on this phone. The family's cook profile stays, just unlinked. */
export function leaveLocalHouse(cookId: ID) {
  commit((d) => {
    if (d.cooks[cookId]) d.cooks[cookId].userId = undefined
  })
}

/** Add (or refresh) a house from a family's link. */
export function importHouse(userId: ID, house: Omit<CookHouse, 'id' | 'userId'>): ID {
  let id = ''
  commit((d) => {
    const existing = Object.values(d.cookHouses).find((h) => h.userId === userId && ((house.code && h.code === house.code) || (!house.code && h.name === house.name)))
    id = existing?.id ?? uid('house')
    // keep timings the cook changed herself when the family re-sends the link
    d.cookHouses[id] = { ...house, id, userId, visits: existing?.visits ?? house.visits.map((v) => ({ ...v, id: v.id ?? uid('visit') })), weeklyOff: existing?.weeklyOff ?? house.weeklyOff }
  })
  return id
}

export function updateCookHouse(id: ID, patch: Partial<Pick<CookHouse, 'visits' | 'weeklyOff'>>) {
  commit((d) => {
    if (d.cookHouses[id]) Object.assign(d.cookHouses[id], patch)
  })
}

export function removeCookHouse(id: ID) {
  commit((d) => {
    delete d.cookHouses[id]
    for (const [k, l] of Object.entries(d.cookLeaves)) if (l.cookId === id) delete d.cookLeaves[k]
  })
}

/** Use this phone as this cook's (e.g. a shared kitchen phone): signs in to her account, creating it if needed. */
export function signInAsCook(cookId: ID) {
  let userId = ''
  commit((d) => {
    const c = d.cooks[cookId]
    if (!c) return
    if (!c.userId || !d.users[c.userId]) {
      c.userId = uid('user')
      d.users[c.userId] = { id: c.userId, name: c.name, createdAt: new Date().toISOString() }
    }
    if (!d.cookAccounts[c.userId]) d.cookAccounts[c.userId] = { userId: c.userId, name: c.name, phone: c.phone, language: c.language, createdAt: new Date().toISOString() }
    userId = c.userId
  })
  if (userId) setSessionUserId(userId)
}

export function leavesOf(db: DB, cookId: ID): CookLeave[] {
  return Object.values(db.cookLeaves)
    .filter((l) => l.cookId === cookId)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Is the cook coming on this date? Weekly off days and marked leave both count. */
export function cookIsOff(db: DB, cook: Pick<Cook, 'id' | 'weeklyOff'>, date: ISODate): { off: boolean; reason?: 'weekly' | 'leave'; leave?: CookLeave } {
  const leave = Object.values(db.cookLeaves).find((l) => l.cookId === cook.id && l.date === date)
  if (leave) return { off: true, reason: 'leave', leave }
  if (cook.weeklyOff.includes(weekdayOf(date))) return { off: true, reason: 'weekly' }
  return { off: false }
}

export function addCookLeave(cookId: ID, dates: ISODate[], createdBy: ID, note?: string) {
  commit((d) => {
    for (const date of dates) {
      if (Object.values(d.cookLeaves).some((l) => l.cookId === cookId && l.date === date)) continue
      const id = uid('leave')
      d.cookLeaves[id] = { id, cookId, date, note: note?.trim() || undefined, createdBy, createdAt: new Date().toISOString() }
    }
  })
}

export function removeCookLeave(leaveId: ID) {
  commit((d) => {
    delete d.cookLeaves[leaveId]
  })
}

export function updateMealTimes(householdId: ID, mealTimes: Record<MealSlot, string>) {
  commit((d) => {
    if (d.households[householdId]) d.households[householdId].mealTimes = mealTimes
  })
}

export const DEFAULT_SHOPS: Record<ShopKind, Shop> = {
  quick: { name: 'Zepto', orderDays: [0, 2, 5] },
  bulk: { name: 'DMart' },
  subscription: { name: 'Country Delight' },
}

export function shopsOf(h: Household | undefined): Record<ShopKind, Shop> {
  return { ...DEFAULT_SHOPS, ...(h?.shops ?? {}) }
}

export function updateHousehold(householdId: ID, patch: Partial<Omit<Household, 'id' | 'code' | 'createdBy' | 'createdAt'>>) {
  commit((d) => {
    const h = d.households[householdId]
    if (!h) return
    Object.assign(h, patch)
    if ('contactPhone' in patch) h.contactPhone = normalisePhone(patch.contactPhone)
  })
}

export function updateShop(householdId: ID, kind: ShopKind, patch: Partial<Shop>) {
  commit((d) => {
    const h = d.households[householdId]
    if (!h) return
    const shops = shopsOf(h)
    h.shops = { ...shops, [kind]: { ...shops[kind], ...patch } }
  })
}

export function setItemShop(householdId: ID, item: string, kind: ShopKind) {
  commit((d) => {
    const h = d.households[householdId]
    if (h) h.itemShop = { ...(h.itemShop ?? {}), [item]: kind }
  })
}

export function setItemPrice(householdId: ID, item: string, price: number) {
  commit((d) => {
    const h = d.households[householdId]
    if (h) h.prices = { ...(h.prices ?? {}), [item]: Math.max(0, price) }
  })
}

export function setRecipeVideo(householdId: ID, foodId: ID, url: string) {
  commit((d) => {
    const h = d.households[householdId]
    if (!h) return
    const next = { ...(h.recipeVideos ?? {}) }
    if (url.trim()) next[foodId] = url.trim()
    else delete next[foodId]
    h.recipeVideos = next
  })
}

export function spendOf(db: DB, householdId: ID, month: string): SpendLog[] {
  return Object.values(db.spendLogs ?? {})
    .filter((l) => l.householdId === householdId && l.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

export function addSpend(householdId: ID, input: { date: ISODate; shop: SpendLog['shop']; amount: number; note?: string }) {
  commit((d) => {
    const id = uid('spend')
    d.spendLogs = d.spendLogs ?? {}
    d.spendLogs[id] = { id, householdId, ...input, amount: Math.round(input.amount), note: input.note?.trim() || undefined, createdAt: new Date().toISOString() }
  })
}

export function deleteSpend(id: ID) {
  commit((d) => {
    delete d.spendLogs[id]
  })
}

export const groceryKey = (householdId: ID, weekStart: string, item: string) => `${householdId}|${weekStart}|${item}`

export function setGroceryChecked(householdId: ID, weekStart: string, item: string, checked: boolean) {
  commit((d) => {
    d.groceryChecks[groceryKey(householdId, weekStart, item)] = { householdId, weekStart, item, checked }
  })
}

/** Internals shared with the demo builder. */
export const _internals = { buildLog, newMember, uniqueCode, seedPlan, insertCook }
