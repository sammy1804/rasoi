/**
 * Rasoi data model.
 *
 * These entities map 1:1 to the tables in `supabase/schema.sql`. The local
 * prototype keeps them in a single normalised `DB` object persisted to
 * localStorage (see `store.ts`); a Supabase adapter would read/write the same
 * shapes row-by-row.
 */

export type ID = string
export type ISODate = string // 'YYYY-MM-DD'

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner'
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner']

/** 0 = Monday … 6 = Sunday */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type Goal = 'lose' | 'maintain' | 'gain'
export type Activity = 'light' | 'moderate' | 'active'
export type Diet = 'veg' | 'egg-whites' | 'eggs' | 'non-veg'
/** How a member's portions are scaled from the shared household meal. */
export type PortionStyle = 'lighter' | 'standard' | 'hearty'

export interface User {
  id: ID
  name: string
  createdAt: string
}

export interface Household {
  id: ID
  name: string
  /** Short, human-friendly join code, e.g. 7XK92A */
  code: string
  createdBy: ID
  createdAt: string
  /** When the household usually eats, 'HH:MM' 24h. Optional for older data. */
  mealTimes?: Record<MealSlot, string>
  /** Where groceries come from. */
  shops?: Record<ShopKind, Shop>
  /** per-item override of which shop it's bought from */
  itemShop?: Record<string, ShopKind>
  /** per-item price override, ₹ per kg / litre / piece */
  prices?: Record<string, number>
  /** monthly grocery budget in ₹ */
  budgetMonthly?: number
  /** a family WhatsApp number the cook can reply to (digits with country code) */
  contactPhone?: string
  /** family-chosen recipe video per dish (food id → YouTube link) */
  recipeVideos?: Record<ID, string>
}

/**
 * subscription = comes by itself every day (e.g. Country Delight milk, paneer)
 * quick        = quick-commerce orders a few times a week (Zepto, Instamart)
 * bulk         = big monthly shop for staples (DMart)
 */
export type ShopKind = 'subscription' | 'quick' | 'bulk'
export const SHOP_KINDS: ShopKind[] = ['quick', 'bulk', 'subscription']

export interface Shop {
  name: string
  /** quick only: which weekdays you usually order */
  orderDays?: Weekday[]
}

export interface SpendLog {
  id: ID
  householdId: ID
  date: ISODate
  shop: ShopKind | 'other'
  amount: number
  note?: string
  createdAt: string
}

export type CookLanguage = 'en' | 'hi'

/** One visit by the cook, e.g. Morning 08:00 cooking breakfast + lunch. */
export interface CookVisit {
  id: ID
  label: string
  time: string // 'HH:MM'
  slots: MealSlot[]
}

export interface Cook {
  id: ID
  householdId: ID
  name: string
  /** WhatsApp number with country code, digits only, e.g. 919812345678 */
  phone?: string
  language: CookLanguage
  visits: CookVisit[]
  /** regular days off */
  weeklyOff: Weekday[]
  /** set once the cook signs in on a device */
  userId?: ID
  createdAt: string
}

/** The cook's own sign-in. One account can work at several houses. */
export interface CookAccount {
  userId: ID
  name: string
  phone?: string
  language: CookLanguage
  createdAt: string
}

/**
 * A house the cook added from a family's link. It holds a snapshot of that
 * family's weekly menu, so it works on the cook's own phone with no shared database.
 */
export interface CookHouse {
  id: ID
  userId: ID
  name: string
  code?: string
  /** what the family calls the cook */
  cookName: string
  people: string[]
  /** family WhatsApp number for replies */
  reply?: string
  visits: CookVisit[]
  weeklyOff: Weekday[]
  /** packed menu for Monday…Sunday (see lib/kitchen.ts) */
  week: unknown[]
  importedAt: ISODate
}

export interface CookLeave {
  id: ID
  /** a Cook id (house on this phone) or a CookHouse id (house added by link) */
  cookId: ID
  date: ISODate
  note?: string
  /** who marked it: the cook herself or a family member */
  createdBy: ID
  createdAt: string
}

/** A ticked-off grocery line for a given week. */
export interface GroceryCheck {
  householdId: ID
  /** the shopping period: an order date for quick orders, 'YYYY-MM' for the monthly shop */
  weekStart: string
  item: string
  checked: boolean
}

export interface SharingSettings {
  fullLog: boolean
  calories: boolean
  protein: boolean
  mealCompletion: boolean
}

export interface BreakfastRamp {
  enabled: boolean
  /** % of full breakfast in week 1 */
  startPct: number
  /** % added each week until 100 */
  weeklyStepPct: number
  startedOn: ISODate
}

export interface Profile {
  age?: number
  /** only used for the calorie estimate formula */
  sex: 'female' | 'male'
  heightCm: number
  weightKg: number
  goal: Goal
  activity: Activity
  activityNote?: string
  diet: Diet
  dislikes: string[]
  calorieTarget: number
  proteinMin: number
  proteinTarget: number
  portionStyle: PortionStyle
  breakfastRamp: BreakfastRamp
  trackWater: boolean
  waterTargetGlasses: number
}

export interface HouseholdMember {
  id: ID
  householdId: ID
  userId: ID
  role: 'owner' | 'member'
  joinedAt: string
  /** Visual identity chip colour index */
  hue: number
  profile: Profile
  sharing: SharingSettings
  /** First-run coach marks already seen */
  tips: Record<string, boolean>
}

export type FoodCategory =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snack'
  | 'drink'
  | 'fruit'
  | 'basic'
  | 'homemade'
  | 'custom'

export interface Ingredient {
  /** grocery item, e.g. 'Paneer', 'Rice', 'Rajma' */
  item: string
  qty: number
  unit: 'g' | 'ml' | 'pc'
  /** needs soaking the night before */
  soak?: boolean
}

export interface Nutrients {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fibre: number
}

export interface FoodUnit {
  /** e.g. 'piece', 'cup', 'katori', 'tbsp', 'g', 'ml' */
  name: string
  /** weight (or ml) of ONE unit; for 'g'/'ml' this is 1 */
  grams: number
  /** optional friendly label e.g. 'katori (~150 g)' */
  label?: string
}

export interface Food {
  id: ID
  name: string
  category: FoodCategory
  /** Nutrition per 100 g (or 100 ml). Always an estimate. */
  per100: Nutrients
  units: FoodUnit[]
  defaultUnit: string
  defaultAmount: number
  /** fruit/veg servings per 100 g (1 serving ≈ 80 g) */
  fvPer100?: number
  /** vegetables / fruits it contains, for variety tracking */
  produce?: string[]
  /** keywords to help search */
  tags?: string[]
  /** contains egg yolk / meat etc. — used to respect diet */
  contains?: ('egg-yolk' | 'egg-white' | 'meat' | 'dairy')[]
  /** set for user-created foods */
  householdId?: ID
  createdBy?: ID
  recipeId?: ID
  /** Hindi name shown to the cook */
  hi?: string
  /** raw ingredients for ONE default unit (e.g. 1 katori), used for prep + groceries */
  ingredients?: Ingredient[]
  cookNote?: string
  cookNoteHi?: string
  /** soft-deleted custom foods stay resolvable for old logs */
  archived?: boolean
}

export interface RecipeIngredient {
  foodId: ID
  amount: number
  unit: string
}

export interface Recipe {
  id: ID
  householdId: ID
  createdBy: ID
  name: string
  servings: number
  ingredients: RecipeIngredient[]
  /** the generated Food row that users log */
  foodId: ID
  createdAt: string
}

/** Portion for one style, in the food's units. */
export interface Portion {
  amount: number
  /** use a different food for this style (e.g. high-protein dahi instead of curd) */
  foodId?: ID
  unit?: string
  /** human hint e.g. '80–100 g paneer' */
  hint?: string
  /** range shown to the user e.g. [1, 2] chapatis */
  range?: [number, number]
}

export interface PlanItemSpec {
  foodId: ID
  lighter: Portion
  hearty: Portion
  /** if set, standard portion; otherwise it is interpolated */
  standard?: Portion
}

export interface MealItem extends PlanItemSpec {
  id: ID
  /** alternatives the person can swap to, e.g. Rice OR chapati */
  alts?: PlanItemSpec[]
  optional?: boolean
  /** only shown to members with this portion style (e.g. calorie-dense add-ons) */
  onlyFor?: PortionStyle
}

export interface Meal {
  id: ID
  mealPlanId: ID
  day: Weekday
  slot: MealSlot
  items: MealItem[]
}

export interface MealPlan {
  id: ID
  householdId: ID
  name: string
  createdAt: string
}

export type LogStatus = 'eaten' | 'partial' | 'skipped'

export interface FoodLog {
  id: ID
  householdId: ID
  userId: ID
  date: ISODate
  slot: MealSlot
  /** set when the entry ticks off a planned item */
  mealItemId?: ID
  foodId: ID
  status: LogStatus
  /** the quantity the person actually had (before `fraction`) */
  amount: number
  unit: string
  /** 0..1 — for 'partial' */
  fraction: number
  /** nutrients snapshot at time of logging (estimate) */
  nutrients: Nutrients
  /** a photo of the meal, kept on this phone (see data/photos.ts) */
  photoId?: string
  createdAt: string
  updatedAt: string
}

export interface WeightLog {
  id: ID
  userId: ID
  date: ISODate
  kg: number
}

export interface WaterLog {
  userId: ID
  date: ISODate
  glasses: number
}

/** Which alternative a person picked for a planned item on a day. */
export interface ItemChoice {
  userId: ID
  date: ISODate
  mealItemId: ID
  altIndex: number // -1 = primary
}

export interface DB {
  version: number
  users: Record<ID, User>
  households: Record<ID, Household>
  members: Record<ID, HouseholdMember>
  mealPlans: Record<ID, MealPlan>
  meals: Record<ID, Meal>
  foods: Record<ID, Food>
  recipes: Record<ID, Recipe>
  foodLogs: Record<ID, FoodLog>
  weightLogs: Record<ID, WeightLog>
  waterLogs: Record<string, WaterLog>
  choices: Record<string, ItemChoice>
  cooks: Record<ID, Cook>
  cookLeaves: Record<ID, CookLeave>
  groceryChecks: Record<string, GroceryCheck>
  spendLogs: Record<ID, SpendLog>
  cookAccounts: Record<ID, CookAccount>
  cookHouses: Record<ID, CookHouse>
}
