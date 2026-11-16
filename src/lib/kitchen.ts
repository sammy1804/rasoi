import { publicLink } from '@/app/target'
import { BUILTIN_FOOD_MAP } from '@/data/foods'
import { EMOJI, ITEM_HI, PANTRY, PRICES, READY_TO_SERVE, SUBSCRIPTION_DEFAULT, UNIT_HI, groceryGroup, type GroceryGroup } from '@/data/kitchen'
import { allFoods, choiceKey, cookIsOff, mealFor, membersOf, shopsOf } from '@/data/repository'
import type { Cook, CookLanguage, DB, Food, Household, ISODate, MealSlot, ShopKind, Weekday } from '@/data/types'
import { MEAL_SLOTS } from '@/data/types'
import { WEEKDAY_NAMES, addDays, fromISO, todayISO, weekDates, weekdayOf } from './dates'
import { gramsFor, personalItems } from './nutrition'
import { fmtAmount, plural } from './utils'

type ID = string
const roundTo = (n: number, step: number) => Math.round(n / step) * step
const roundUp = (n: number, step: number) => Math.max(step, Math.ceil(n / step - 1e-9) * step)

/* ════════════════════════ What the cook makes ════════════════════════ */

/** One dish for the whole household. Plain data: it can be rendered, spoken, sent on WhatsApp or packed into a link. */
export interface CookDish {
  id: string
  name: string
  hi?: string
  emoji: string
  total: number
  unit: string
  /** amount per person, in the order of `CookDay.people` (0 = not having it) */
  per: number[]
  optional: boolean
  /** main raw ingredient for everyone, e.g. ['Paneer', 200, 'g'] */
  uses?: [item: string, qty: number, unit: string]
  note?: string
  noteHi?: string
  /** family-chosen recipe video */
  video?: string
}

export interface CookSlot {
  slot: MealSlot
  time?: string
  dishes: CookDish[]
  ready: { id: string; name: string; hi?: string }[]
}

export interface CookVisitPlan {
  label: string
  time: string
  slots: CookSlot[]
}

export interface CookDay {
  date: ISODate
  household: string
  cook: string
  lang: CookLanguage
  people: string[]
  /** family WhatsApp number the cook can reply to */
  reply?: string
  off?: { reason: 'weekly' | 'leave'; note?: string }
  visits: CookVisitPlan[]
  soak: [item: string, qty: number][]
}

function usesFor(food: Food, total: number, unit: string): CookDish['uses'] {
  const main = food.ingredients?.[0]
  if (!main || main.unit === 'pc' || main.item.toLowerCase() === food.name.toLowerCase()) return undefined
  const scale = gramsFor(food, total, unit) / gramsFor(food, 1, food.defaultUnit)
  return [main.item, roundTo(main.qty * scale, 10), main.unit]
}

function dishFrom(food: Food, total: number, unit: string, per: number[], optional: boolean, video?: string): CookDish {
  return {
    id: food.id,
    name: food.name.replace(' (cooked)', ''),
    hi: food.hi,
    emoji: EMOJI[food.id] ?? '🍽️',
    total,
    unit,
    per,
    optional,
    uses: usesFor(food, total, unit),
    note: food.cookNote,
    noteHi: food.cookNoteHi,
    video,
  }
}

/** Household totals per meal slot for a date. */
export function cookSlots(db: DB, householdId: ID, date: ISODate): { slots: CookSlot[]; people: string[] } {
  const foods = allFoods(db)
  const members = membersOf(db, householdId)
  const household = db.households[householdId]
  const day = weekdayOf(date)
  const people = members.map((m) => db.users[m.userId]?.name ?? '?')
  const slots = MEAL_SLOTS.map((slot) => {
    const meal = mealFor(db, householdId, day, slot)
    const acc = new Map<string, { food: Food; unit: string; per: number[]; optional: boolean }>()
    const ready = new Map<string, Food>()
    members.forEach((m, mi) => {
      const items = personalItems(meal, m, date, foods, (id) => db.choices[choiceKey(m.userId, date, id)]?.altIndex ?? -1)
      for (const r of items) {
        if (READY_TO_SERVE.has(r.food.id)) {
          if (!r.optional) ready.set(r.food.id, r.food)
          continue
        }
        const e = acc.get(r.food.id) ?? { food: r.food, unit: r.portion.unit, per: members.map(() => 0), optional: true }
        // convert to the first-seen unit so the amounts add up
        const amount = e.unit === r.portion.unit ? r.portion.amount : gramsFor(r.food, r.portion.amount, r.portion.unit) / gramsFor(r.food, 1, e.unit)
        e.per[mi] += amount
        e.optional = e.optional && r.optional
        acc.set(r.food.id, e)
      }
    })
    return {
      slot,
      time: household?.mealTimes?.[slot],
      dishes: [...acc.values()].map((e) => dishFrom(e.food, e.per.reduce((a, b) => a + b, 0), e.unit, e.per, e.optional, household?.recipeVideos?.[e.food.id])),
      ready: [...ready.values()].map((f) => ({ id: f.id, name: f.name, hi: f.hi })),
    }
  })
  return { slots, people }
}

/** Things to soak tonight for tomorrow's meals. */
export function soakFor(db: DB, householdId: ID, date: ISODate): [string, number][] {
  const foods = allFoods(db)
  const out = new Map<string, number>()
  for (const s of cookSlots(db, householdId, date).slots) {
    for (const d of s.dishes) {
      const food = foods[d.id]
      for (const ing of food?.ingredients ?? []) {
        if (!ing.soak) continue
        const scale = gramsFor(food, d.total, d.unit) / gramsFor(food, 1, food.defaultUnit)
        out.set(ing.item, (out.get(ing.item) ?? 0) + ing.qty * scale)
      }
    }
  }
  return [...out.entries()].map(([item, qty]) => [item, roundTo(qty, 10)])
}

export function buildCookDay(db: DB, cook: Cook, date: ISODate, lang: CookLanguage = cook.language): CookDay {
  const household = db.households[cook.householdId]
  const off = cookIsOff(db, cook, date)
  const { slots, people } = cookSlots(db, cook.householdId, date)
  return {
    date,
    household: household?.name ?? 'Home',
    cook: cook.name,
    lang,
    people,
    reply: household?.contactPhone,
    off: off.off ? { reason: off.reason!, note: off.leave?.note } : undefined,
    visits: off.off
      ? []
      : [...cook.visits]
          .sort((a, b) => a.time.localeCompare(b.time))
          .map((v) => ({ label: v.label, time: v.time, slots: slots.filter((s) => v.slots.includes(s.slot)) })),
    soak: off.off ? [] : soakFor(db, cook.householdId, addDays(date, 1)),
  }
}

/* ════════════════════════ The cook's link ════════════════════════
 * The whole day's menu is packed into the link itself, so the cook's phone
 * needs no login, no app and no shared database: tap the link, see and hear
 * the menu. Built-in dishes travel as ids; custom ones carry their name.
 */

const b64 = {
  enc(s: string) {
    const bytes = new TextEncoder().encode(s)
    let bin = ''
    bytes.forEach((b) => (bin += String.fromCharCode(b)))
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  },
  dec(s: string) {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
  },
}

type PackedDish = [id: string, unit: string, per: number[], optional: 0 | 1, video: string | 0, name?: string]
type PackedSlot = [slot: number, time: string | 0, dishes: PackedDish[], ready: string[]]
type Packed = [v: 1, date: string, household: string, cook: string, lang: CookLanguage, people: string[], reply: string | 0, off: 0 | [string, string | 0], visits: [string, string, PackedSlot[]][], soak: [string, number][]]

export function encodeCookDay(day: CookDay): string {
  const packed: Packed = [
    1,
    day.date,
    day.household,
    day.cook,
    day.lang,
    day.people,
    day.reply ?? 0,
    day.off ? [day.off.reason, day.off.note ?? 0] : 0,
    day.visits.map((v) => [
      v.label,
      v.time,
      v.slots.map((s) => [
        MEAL_SLOTS.indexOf(s.slot),
        s.time ?? 0,
        s.dishes.map((d) => {
          const p: PackedDish = [d.id, d.unit, d.per.map((x) => +x.toFixed(2)), d.optional ? 1 : 0, d.video ?? 0]
          if (!BUILTIN_FOOD_MAP[d.id]) p.push(d.name)
          return p
        }),
        s.ready.map((r) => (BUILTIN_FOOD_MAP[r.id] ? r.id : r.name)),
      ]),
    ]),
    day.soak,
  ]
  return b64.enc(JSON.stringify(packed))
}

export function decodeCookDay(data: string): CookDay | null {
  try {
    const p = JSON.parse(b64.dec(data)) as Packed
    if (p[0] !== 1) return null
    return {
      date: p[1],
      household: p[2],
      cook: p[3],
      lang: p[4],
      people: p[5],
      reply: p[6] || undefined,
      off: p[7] ? { reason: p[7][0] as 'weekly' | 'leave', note: p[7][1] || undefined } : undefined,
      visits: p[8].map(([label, time, slots]) => ({
        label,
        time,
        slots: slots.map(([si, t, dishes, ready]) => ({
          slot: MEAL_SLOTS[si],
          time: t || undefined,
          dishes: dishes.map(([id, unit, per, optional, video, name]) => {
            const total = per.reduce((a, b) => a + b, 0)
            const food = BUILTIN_FOOD_MAP[id]
            if (food) return dishFrom(food, total, unit, per, !!optional, video || undefined)
            return { id, name: name ?? id, emoji: '🍽️', total, unit, per, optional: !!optional, video: video || undefined }
          }),
          ready: ready.map((r) => {
            const f = BUILTIN_FOOD_MAP[r]
            return f ? { id: f.id, name: f.name, hi: f.hi } : { id: r, name: r }
          }),
        })),
      })),
      soak: p[9],
    }
  } catch {
    return null
  }
}

export const cookLink = (day: CookDay) => publicLink(`/c/${encodeCookDay(day)}`)

/* ════════════════════════ Words for the cook ════════════════════════ */

export const dishName = (d: { name: string; hi?: string }, lang: CookLanguage) => (lang === 'hi' && d.hi ? d.hi : d.name.replace(' (cooked)', ''))

export function qtyText(amount: number, unit: string, lang: CookLanguage): string {
  const gramLike = unit === 'g' || unit === 'ml'
  if (lang === 'hi') {
    const u = UNIT_HI[unit] ?? unit
    return gramLike ? `${Math.round(amount)} ${u}` : `${fmtAmount(roundTo(amount, 0.25))}${u ? ' ' + u : ''}`
  }
  if (gramLike) return `${Math.round(amount)} ${unit}`
  if (unit === 'medium') return `${fmtAmount(amount)} medium`
  return `${fmtAmount(roundTo(amount, 0.25))} ${plural(unit, amount)}`
}

export function usesLine(d: CookDish, lang: CookLanguage): string {
  if (!d.uses) return ''
  const [item, qty, unit] = d.uses
  const raw = PANTRY.has(item) && !['Atta', 'Besan', 'Soya chunks'].includes(item)
  const u = unit === 'ml' ? 'ml' : lang === 'hi' ? 'ग्राम' : 'g'
  if (lang === 'hi') return `≈ ${qty} ${u} ${ITEM_HI[item] ?? item}${raw ? ' (कच्चा)' : ''}`
  return `≈ ${qty} ${u} ${raw ? 'raw ' : ''}${item.toLowerCase()}`
}

export function perLine(d: CookDish, people: string[], lang: CookLanguage): string {
  const parts = d.per.map((a, i) => (a > 0 ? `${people[i]} ${qtyText(a, d.unit, lang)}` : '')).filter(Boolean)
  return parts.length > 1 ? parts.join(' · ') : ''
}

export const SLOT_HI: Record<MealSlot, string> = { breakfast: 'नाश्ता', lunch: 'दोपहर का खाना', snack: 'शाम का नाश्ता', dinner: 'रात का खाना' }
export const SLOT_EN: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' }
const VISIT_HI: Record<string, string> = { morning: 'सुबह', afternoon: 'दोपहर', evening: 'शाम', night: 'रात' }
export const visitLabel = (v: { label: string }, lang: CookLanguage) => (lang === 'hi' ? VISIT_HI[v.label.toLowerCase()] ?? v.label : v.label)
const DAY_HI = ['सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार', 'रविवार']
const MONTH_HI = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर']

export function dayLabel(date: ISODate, lang: CookLanguage) {
  const d = fromISO(date)
  if (lang === 'hi') return `${DAY_HI[weekdayOf(date)]}, ${d.getDate()} ${MONTH_HI[d.getMonth()]}`
  return `${WEEKDAY_NAMES[weekdayOf(date)]}, ${d.getDate()} ${d.toLocaleString('en-GB', { month: 'long' })}`
}

/** '07:45' → '7:45 am' */
export function fmtTime(t?: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

/** What gets read aloud for one dish, e.g. "रोटी, 5 रोटी। Samridhi 2, Naina 3।" */
export function dishSpeech(d: CookDish, people: string[], lang: CookLanguage): string {
  const hi = lang === 'hi'
  const parts = [`${dishName(d, lang)}, ${qtyText(d.total, d.unit, lang)}`]
  const per = perLine(d, people, lang)
  if (per) parts.push(per.replace(/ · /g, ', '))
  if (d.uses) parts.push(usesLine(d, lang).replace('≈', hi ? 'लगभग' : 'about'))
  const note = hi ? d.noteHi : d.note
  if (note) parts.push(note)
  if (d.optional) parts.push(hi ? 'अगर चाहिए तो' : 'only if wanted')
  return parts.join(hi ? '। ' : '. ')
}

export function visitSpeech(v: CookVisitPlan, day: CookDay, lang: CookLanguage): string {
  const hi = lang === 'hi'
  const out: string[] = [hi ? `${visitLabel(v, lang)} का खाना` : `${v.label} cooking`]
  for (const s of v.slots) {
    if (!s.dishes.length && !s.ready.length) continue
    out.push(hi ? SLOT_HI[s.slot] : SLOT_EN[s.slot])
    for (const d of s.dishes) out.push(dishSpeech(d, day.people, lang))
    if (s.ready.length) out.push(`${hi ? 'साथ में दें' : 'Also serve'}: ${s.ready.map((r) => dishName(r, lang)).join(', ')}`)
  }
  return out.join(hi ? '। ' : '. ')
}

export function soakText(day: CookDay, lang: CookLanguage): string {
  if (!day.soak.length) return ''
  const hi = lang === 'hi'
  return `${hi ? 'आज रात भिगोएँ, कल के लिए' : 'Soak tonight for tomorrow'}: ${day.soak.map(([item, qty]) => `${hi ? ITEM_HI[item] ?? item : item} ${qty} ${hi ? 'ग्राम' : 'g'}`).join(', ')}`
}

/** A recipe video for a dish: the family's chosen one, or a YouTube search in the cook's language. */
export function videoUrl(d: { name: string; hi?: string; video?: string }, lang: CookLanguage): string {
  if (d.video) return d.video
  const q = lang === 'hi' && d.hi ? `${d.hi} रेसिपी` : `${d.name} recipe Indian home style`
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
}

/* ════════════════════════ WhatsApp ════════════════════════ */

export function whatsappUrl(text: string, phone?: string) {
  return `https://wa.me/${phone ?? ''}?text=${encodeURIComponent(text)}`
}

export function cookMessage(day: CookDay, lang: CookLanguage = day.lang, withLink = true): string {
  const hi = lang === 'hi'
  const lines: string[] = [`*${hi ? 'रसोई' : 'Rasoi'} · ${dayLabel(day.date, lang)}*`]
  if (day.off) {
    lines.push(hi ? `${day.cook} जी आज छुट्टी पर हैं।` : `${day.cook} is off on this day.`)
    return lines.join('\n')
  }
  lines.push(hi ? `नमस्ते ${day.cook} जी! आज का खाना:` : `Hi ${day.cook}! Here's the menu:`)
  for (const v of day.visits) {
    lines.push('', `*${visitLabel(v, lang)} · ${fmtTime(v.time)}*`)
    for (const s of v.slots) {
      if (!s.dishes.length && !s.ready.length) continue
      lines.push(`_${hi ? SLOT_HI[s.slot] : SLOT_EN[s.slot]}${s.time ? ` (${fmtTime(s.time)})` : ''}_`)
      if (!s.dishes.length) lines.push(hi ? '• कुछ पकाना नहीं है' : '• Nothing to cook')
      for (const d of s.dishes) {
        const per = perLine(d, day.people, lang)
        const opt = d.optional ? (hi ? ' — अगर चाहिए' : ' — optional') : ''
        lines.push(`• ${d.emoji} ${dishName(d, lang)} — ${qtyText(d.total, d.unit, lang)}${per ? ` (${per.replace(/ · /g, ', ')})` : ''}${opt}`)
        const note = [usesLine(d, lang), hi ? d.noteHi : d.note].filter(Boolean).join(' · ')
        if (note) lines.push(`   ${note}`)
      }
      if (s.ready.length) lines.push(`• ${hi ? 'साथ में दें' : 'Also serve'}: ${s.ready.map((f) => dishName(f, lang)).join(', ')}`)
    }
  }
  if (day.soak.length) lines.push('', `*${soakText(day, lang)}*`)
  if (withLink) lines.push('', hi ? `👉 देखने, सुनने और वीडियो के लिए दबाएँ:\n${cookLink({ ...day, lang })}` : `👉 Tap to see it with pictures, sound and videos:\n${cookLink({ ...day, lang })}`)
  lines.push('', hi ? 'धन्यवाद! 🙏' : 'Thank you! 🙏')
  return lines.join('\n')
}

export function weekMenuMessage(db: DB, householdId: ID, dates: ISODate[], lang: CookLanguage): string {
  const hi = lang === 'hi'
  const foods = allFoods(db)
  const lines = [hi ? '*इस हफ़्ते का मेन्यू*' : '*This week’s menu*']
  for (const date of dates) {
    lines.push('', `*${dayLabel(date, lang)}*`)
    for (const slot of MEAL_SLOTS) {
      const meal = mealFor(db, householdId, weekdayOf(date), slot)
      const names = (meal?.items ?? []).filter((i) => !i.optional && !i.onlyFor && foods[i.foodId]).map((i) => dishName(foods[i.foodId], lang))
      if (names.length) lines.push(`${hi ? SLOT_HI[slot] : SLOT_EN[slot]}: ${names.join(', ')}`)
    }
  }
  return lines.join('\n')
}

/** What the cook sends back from her link. */
export function leaveReply(day: CookDay, when: 'today' | 'tomorrow' | 'dayafter', lang: CookLanguage): string {
  const date = addDays(todayISO(), when === 'today' ? 0 : when === 'tomorrow' ? 1 : 2)
  return lang === 'hi' ? `नमस्ते, मैं ${day.cook} हूँ। मैं ${dayLabel(date, 'hi')} को नहीं आ पाऊँगी। 🙏` : `Hi, this is ${day.cook}. I won't be able to come on ${dayLabel(date, 'en')}. 🙏`
}

/* ════════════════════════ Groceries ════════════════════════ */

export interface GroceryLine {
  item: string
  qty: number
  unit: 'g' | 'ml' | 'pc'
  group: GroceryGroup
  pantry: boolean
  soak: boolean
  /** dishes it's for, e.g. ['Kadai paneer', 'Paneer bhurji'] */
  for: string[]
}

/** Exact (unrounded) amounts needed for the given dates, for everyone in the household. */
export function rawGroceries(db: DB, householdId: ID, dates: ISODate[]): GroceryLine[] {
  const foods = allFoods(db)
  const members = membersOf(db, householdId)
  const map = new Map<string, GroceryLine>()
  for (const date of dates) {
    const day = weekdayOf(date)
    for (const slot of MEAL_SLOTS) {
      const meal = mealFor(db, householdId, day, slot)
      for (const m of members) {
        const items = personalItems(meal, m, date, foods, (id) => db.choices[choiceKey(m.userId, date, id)]?.altIndex ?? -1)
        for (const r of items) {
          if (r.optional || !r.food.ingredients) continue
          const scale = gramsFor(r.food, r.portion.amount, r.portion.unit) / gramsFor(r.food, 1, r.food.defaultUnit)
          for (const ing of r.food.ingredients) {
            const line = map.get(ing.item) ?? { item: ing.item, qty: 0, unit: ing.unit, group: groceryGroup(ing.item), pantry: PANTRY.has(ing.item), soak: !!ing.soak, for: [] }
            line.qty += ing.qty * scale
            if (!line.for.includes(r.food.name)) line.for.push(r.food.name)
            map.set(ing.item, line)
          }
        }
      }
    }
  }
  return [...map.values()].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.item.localeCompare(b.item))
}

export const GROUP_ORDER: GroceryGroup[] = ['Vegetables', 'Dairy & eggs', 'Fruit', 'Staples', 'Other']

/** Round up to something you can actually buy. */
export function buyQty(l: Pick<GroceryLine, 'qty' | 'unit'>, bulk = false): number {
  if (l.unit === 'pc') return Math.ceil(l.qty - 1e-9)
  if (l.unit === 'ml') return roundUp(l.qty, bulk ? 500 : 250)
  if (bulk) return roundUp(l.qty, l.qty > 1000 ? 500 : 100)
  return roundUp(l.qty, 50)
}

export function fmtGroceryQty(l: Pick<GroceryLine, 'qty' | 'unit'>) {
  if (l.unit === 'pc') return `${l.qty}`
  if (l.unit === 'ml') return l.qty >= 1000 ? `${+(l.qty / 1000).toFixed(1)} L` : `${Math.round(l.qty)} ml`
  return l.qty >= 1000 ? `${+(l.qty / 1000).toFixed(1)} kg` : `${Math.round(l.qty)} g`
}

/* ——— shops ——— */

export function shopFor(h: Household | undefined, item: string): ShopKind {
  const override = h?.itemShop?.[item]
  if (override) return override
  if (SUBSCRIPTION_DEFAULT.has(item)) return 'subscription'
  if (PANTRY.has(item)) return 'bulk'
  return 'quick'
}

/** The next quick-commerce order: the day you order and the days it has to cover (until the order after). */
export function quickWindow(today: ISODate, orderDays: Weekday[]): { orderDate: ISODate; dates: ISODate[]; nextOrder: ISODate } {
  const days = orderDays.length ? orderDays : ([0, 1, 2, 3, 4, 5, 6] as Weekday[])
  const firstFrom = (start: ISODate) => {
    for (let i = 0; i < 7; i++) if (days.includes(weekdayOf(addDays(start, i)))) return addDays(start, i)
    return start
  }
  const orderDate = firstFrom(today)
  const nextOrder = firstFrom(addDays(orderDate, 1))
  const dates: ISODate[] = []
  for (let d = orderDate; d < nextOrder; d = addDays(d, 1)) dates.push(d)
  return { orderDate, dates, nextOrder }
}

export function quickList(db: DB, h: Household, today = todayISO()) {
  const shops = shopsOf(h)
  const w = quickWindow(today, shops.quick.orderDays ?? [])
  const lines = rawGroceries(db, h.id, w.dates)
    .filter((l) => shopFor(h, l.item) === 'quick')
    .map((l) => ({ ...l, qty: buyQty(l) }))
  return { ...w, lines, period: w.orderDate }
}

/** The monthly shop: a typical week of the plan, scaled to a month. */
export function bulkList(db: DB, h: Household, today = todayISO()) {
  const lines = rawGroceries(db, h.id, weekDates(today))
    .filter((l) => shopFor(h, l.item) === 'bulk')
    .map((l) => ({ ...l, qty: buyQty({ qty: l.qty * (30 / 7), unit: l.unit }, true) }))
  return { lines, period: today.slice(0, 7) }
}

export interface SubscriptionLine {
  item: string
  unit: 'g' | 'ml' | 'pc'
  /** amount needed each weekday, Monday first */
  perDay: number[]
  weekly: number
  for: string[]
}

/** What arrives by subscription: how much of each item is needed on each weekday. */
export function subscriptionPlan(db: DB, h: Household, today = todayISO()): SubscriptionLine[] {
  const map = new Map<string, SubscriptionLine>()
  weekDates(today).forEach((date, di) => {
    for (const l of rawGroceries(db, h.id, [date])) {
      if (shopFor(h, l.item) !== 'subscription') continue
      const e = map.get(l.item) ?? { item: l.item, unit: l.unit, perDay: [0, 0, 0, 0, 0, 0, 0], weekly: 0, for: [] }
      const q = l.unit === 'pc' ? Math.ceil(l.qty) : roundUp(l.qty, l.unit === 'ml' ? 50 : 10)
      e.perDay[di] = q
      e.weekly += q
      for (const f of l.for) if (!e.for.includes(f)) e.for.push(f)
      map.set(l.item, e)
    }
  })
  return [...map.values()].sort((a, b) => a.item.localeCompare(b.item))
}

/* ——— money ——— */

export function priceOf(h: Household | undefined, item: string): number {
  return h?.prices?.[item] ?? PRICES[item] ?? 0
}

/** Estimated cost of a grocery line in ₹ (prices are per kg / litre / piece). */
export function costOf(h: Household | undefined, l: Pick<GroceryLine, 'item' | 'qty' | 'unit'>): number {
  const p = priceOf(h, l.item)
  return l.unit === 'pc' ? l.qty * p : (l.qty / 1000) * p
}

export const fmtRupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

/** Estimated grocery cost of a typical month of this plan, split by shop. */
export function monthlyEstimate(db: DB, h: Household, today = todayISO()): { total: number; byShop: Record<ShopKind, number>; top: { item: string; cost: number; shop: ShopKind }[] } {
  const byShop: Record<ShopKind, number> = { quick: 0, bulk: 0, subscription: 0 }
  const items: { item: string; cost: number; shop: ShopKind }[] = []
  for (const l of rawGroceries(db, h.id, weekDates(today))) {
    const cost = costOf(h, l) * (30 / 7)
    const shop = shopFor(h, l.item)
    byShop[shop] += cost
    items.push({ item: l.item, cost, shop })
  }
  return { total: byShop.quick + byShop.bulk + byShop.subscription, byShop, top: items.sort((a, b) => b.cost - a.cost) }
}

/* ——— sharing lists ——— */

export function groceryMessage(lines: Pick<GroceryLine, 'item' | 'qty' | 'unit' | 'group'>[], title: string): string {
  const out = [`*${title}*`]
  for (const g of GROUP_ORDER) {
    const ls = lines.filter((l) => l.group === g)
    if (!ls.length) continue
    out.push('', `_${g}_`)
    for (const l of ls) out.push(`• ${l.item} — ${fmtGroceryQty(l)}`)
  }
  return out.join('\n')
}

/** A ready-to-paste request for Claude with the store's connector: it searches and fills the cart. */
export function orderPrompt(store: string, lines: Pick<GroceryLine, 'item' | 'qty' | 'unit'>[]): string {
  return [
    `Using the ${store} connector, add these groceries to my ${store} cart.`,
    `For each one pick the closest pack size to the quantity (a little over is fine), prefer good-value options, and tell me about anything unavailable instead of substituting.`,
    `Do not place the order — when the cart is ready, show me the items and the total so I can check and pay myself.`,
    '',
    ...lines.map((l, i) => `${i + 1}. ${l.item} — ${fmtGroceryQty(l)}`),
  ].join('\n')
}
