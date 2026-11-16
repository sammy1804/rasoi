import { ITEM_HI, PANTRY, READY_TO_SERVE, UNIT_HI, groceryGroup, type GroceryGroup } from '@/data/kitchen'
import { allFoods, choiceKey, cookIsOff, mealFor, membersOf } from '@/data/repository'
import type { Cook, CookLanguage, CookVisit, DB, Food, HouseholdMember, ISODate, MealSlot } from '@/data/types'
import { MEAL_SLOTS } from '@/data/types'
import { WEEKDAY_NAMES, addDays, fromISO, weekdayOf } from './dates'
import { fmtQty } from './format'
import { gramsFor, personalItems } from './nutrition'
import { fmtAmount } from './utils'

/* ——————————— What the cook makes ——————————— */

export interface CookDish {
  food: Food
  unit: string
  total: number
  per: { name: string; amount: number }[]
  optional: boolean
  /** main raw ingredient for the whole household, e.g. { item: 'Paneer', qty: 190, unit: 'g' } */
  uses?: { item: string; qty: number; unit: string }
}

export interface CookSlot {
  slot: MealSlot
  time?: string
  dishes: CookDish[]
  ready: Food[]
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step

export function cookSlots(db: DB, householdId: ID, date: ISODate, nameOf: (userId: string) => string): CookSlot[] {
  const foods = allFoods(db)
  const members = membersOf(db, householdId)
  const day = weekdayOf(date)
  const mealTimes = db.households[householdId]?.mealTimes
  return MEAL_SLOTS.map((slot) => {
    const meal = mealFor(db, householdId, day, slot)
    const dishes = new Map<string, CookDish>()
    const ready = new Map<string, Food>()
    for (const m of members) {
      const items = personalItems(meal, m, date, foods, (id) => db.choices[choiceKey(m.userId, date, id)]?.altIndex ?? -1)
      for (const r of items) {
        if (READY_TO_SERVE.has(r.food.id)) {
          if (!r.optional) ready.set(r.food.id, r.food)
          continue
        }
        const key = r.food.id
        const existing = dishes.get(key)
        // convert to the first-seen unit so totals add up
        const amountInUnit = (unit: string) => {
          if (unit === r.portion.unit) return r.portion.amount
          return gramsFor(r.food, r.portion.amount, r.portion.unit) / gramsFor(r.food, 1, unit)
        }
        if (existing) {
          const a = amountInUnit(existing.unit)
          existing.total += a
          existing.per.push({ name: nameOf(m.userId), amount: a })
          existing.optional = existing.optional && r.optional
        } else {
          dishes.set(key, {
            food: r.food,
            unit: r.portion.unit,
            total: r.portion.amount,
            per: [{ name: nameOf(m.userId), amount: r.portion.amount }],
            optional: r.optional,
          })
        }
      }
    }
    for (const d of dishes.values()) {
      const main = d.food.ingredients?.[0]
      if (main && main.item.toLowerCase() !== d.food.name.toLowerCase() && main.unit !== 'pc') {
        const scale = gramsFor(d.food, d.total, d.unit) / gramsFor(d.food, 1, d.food.defaultUnit)
        d.uses = { item: main.item, qty: roundTo(main.qty * scale, 10), unit: main.unit }
      }
    }
    return { slot, time: mealTimes?.[slot], dishes: [...dishes.values()], ready: [...ready.values()] }
  })
}

export interface CookVisitPlan {
  visit: CookVisit
  slots: CookSlot[]
}

export function cookVisits(cook: Cook, slots: CookSlot[]): CookVisitPlan[] {
  return [...cook.visits]
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((visit) => ({ visit, slots: slots.filter((s) => visit.slots.includes(s.slot)) }))
}

/** Things to soak tonight for tomorrow's meals. */
export function soakFor(db: DB, householdId: ID, date: ISODate): { item: string; qty: number }[] {
  const out = new Map<string, number>()
  for (const s of cookSlots(db, householdId, date, () => '')) {
    for (const d of s.dishes) {
      for (const ing of d.food.ingredients ?? []) {
        if (!ing.soak) continue
        const scale = gramsFor(d.food, d.total, d.unit) / gramsFor(d.food, 1, d.food.defaultUnit)
        out.set(ing.item, (out.get(ing.item) ?? 0) + ing.qty * scale)
      }
    }
  }
  return [...out.entries()].map(([item, qty]) => ({ item, qty: roundTo(qty, 10) }))
}

/* ——————————— Formatting for the cook ——————————— */

export function dishName(food: Food, lang: CookLanguage) {
  return lang === 'hi' && food.hi ? food.hi : food.name.replace(' (cooked)', '')
}

export function qtyFor(food: Food, amount: number, unit: string, lang: CookLanguage) {
  if (lang === 'en') return fmtQty(food, amount, unit)
  const u = UNIT_HI[unit] ?? unit
  if (unit === 'g' || unit === 'ml') return `${Math.round(amount)} ${u}`
  return `${fmtAmount(roundTo(amount, 0.25))}${u ? ' ' + u : ''}`
}

export function usesLine(d: CookDish, lang: CookLanguage) {
  if (!d.uses) return ''
  const item = lang === 'hi' ? ITEM_HI[d.uses.item] ?? d.uses.item : d.uses.item.toLowerCase()
  const unit = d.uses.unit === 'ml' ? 'ml' : lang === 'hi' ? 'ग्राम' : 'g'
  const raw = PANTRY.has(d.uses.item) && d.uses.item !== 'Atta' && d.uses.item !== 'Besan' && d.uses.item !== 'Soya chunks'
  if (lang === 'hi') return `≈ ${d.uses.qty} ${unit} ${item}${raw ? ' (कच्चा)' : ''}`
  return `≈ ${d.uses.qty} ${unit} ${raw ? 'raw ' : ''}${item}`
}

export const SLOT_HI: Record<MealSlot, string> = { breakfast: 'नाश्ता', lunch: 'दोपहर का खाना', snack: 'शाम का नाश्ता', dinner: 'रात का खाना' }
export const SLOT_EN: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' }
const VISIT_HI: Record<string, string> = { morning: 'सुबह', afternoon: 'दोपहर', evening: 'शाम', night: 'रात' }
export const visitLabel = (v: CookVisit, lang: CookLanguage) => (lang === 'hi' ? VISIT_HI[v.label.toLowerCase()] ?? v.label : v.label)
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
  const am = h < 12
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}:${String(m).padStart(2, '0')} ${am ? 'am' : 'pm'}`
}

/* ——————————— WhatsApp ——————————— */

export function whatsappUrl(text: string, phone?: string) {
  return `https://wa.me/${phone ?? ''}?text=${encodeURIComponent(text)}`
}

export function cookMessage(db: DB, cook: Cook, date: ISODate, nameOf: (id: string) => string, lang: CookLanguage = cook.language): string {
  const hi = lang === 'hi'
  const off = cookIsOff(db, cook, date)
  const lines: string[] = [`*${hi ? 'रसोई' : 'Rasoi'} · ${dayLabel(date, lang)}*`]
  if (off.off) {
    lines.push(hi ? `${cook.name} जी आज छुट्टी पर हैं।` : `${cook.name} is off on this day.`)
    return lines.join('\n')
  }
  lines.push(hi ? `नमस्ते ${cook.name} जी! आज का खाना:` : `Hi ${cook.name}! Here's the menu:`)
  const slots = cookSlots(db, cook.householdId, date, nameOf)
  for (const { visit, slots: vs } of cookVisits(cook, slots)) {
    lines.push('', `*${visitLabel(visit, lang)} · ${fmtTime(visit.time)}*`)
    for (const s of vs) {
      if (!s.dishes.length && !s.ready.length) continue
      lines.push(`_${hi ? SLOT_HI[s.slot] : SLOT_EN[s.slot]}${s.time ? ` (${fmtTime(s.time)})` : ''}_`)
      if (!s.dishes.length) lines.push(hi ? '• कुछ पकाना नहीं है' : '• Nothing to cook')
      for (const d of s.dishes) {
        const split = d.per.length > 1 ? ` (${d.per.map((p) => `${p.name} ${qtyFor(d.food, p.amount, d.unit, lang)}`).join(', ')})` : ''
        const opt = d.optional ? (hi ? ' — अगर चाहिए' : ' — optional') : ''
        lines.push(`• ${dishName(d.food, lang)} — ${qtyFor(d.food, d.total, d.unit, lang)}${split}${opt}`)
        const note = [usesLine(d, lang), hi ? d.food.cookNoteHi : d.food.cookNote].filter(Boolean).join(' · ')
        if (note) lines.push(`   ${note}`)
      }
      if (s.ready.length) lines.push(`• ${hi ? 'साथ में दें' : 'Also serve'}: ${s.ready.map((f) => dishName(f, lang)).join(', ')}`)
    }
  }
  const soak = soakFor(db, cook.householdId, addDays(date, 1))
  if (soak.length) {
    lines.push('', hi ? `*आज रात भिगोएँ (कल के लिए):* ${soak.map((x) => `${ITEM_HI[x.item] ?? x.item} ${x.qty} ग्राम`).join(', ')}` : `*Soak tonight for tomorrow:* ${soak.map((x) => `${x.item} ${x.qty} g`).join(', ')}`)
  }
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
      const names = (meal?.items ?? []).filter((i) => !i.optional && !i.onlyFor).map((i) => dishName(foods[i.foodId], lang))
      if (names.length) lines.push(`${hi ? SLOT_HI[slot] : SLOT_EN[slot]}: ${names.join(', ')}`)
    }
  }
  return lines.join('\n')
}

/* ——————————— Groceries ——————————— */

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

export function groceryList(db: DB, householdId: ID, dates: ISODate[]): GroceryLine[] {
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
            const line = map.get(ing.item) ?? {
              item: ing.item,
              qty: 0,
              unit: ing.unit,
              group: groceryGroup(ing.item),
              pantry: PANTRY.has(ing.item),
              soak: !!ing.soak,
              for: [],
            }
            line.qty += ing.qty * scale
            if (!line.for.includes(r.food.name)) line.for.push(r.food.name)
            map.set(ing.item, line)
          }
        }
      }
    }
  }
  return [...map.values()]
    .map((l) => ({ ...l, qty: l.unit === 'pc' ? Math.ceil(l.qty) : roundUp(l.qty, l.unit === 'ml' ? 250 : l.pantry ? 100 : 50) }))
    .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.item.localeCompare(b.item))
}

export const GROUP_ORDER: GroceryGroup[] = ['Vegetables', 'Dairy & eggs', 'Fruit', 'Staples', 'Other']

const roundUp = (n: number, step: number) => Math.max(step, Math.ceil(n / step) * step)

export function fmtGroceryQty(l: Pick<GroceryLine, 'qty' | 'unit' | 'item'>) {
  if (l.unit === 'pc') return `${l.qty}`
  if (l.unit === 'ml') return l.qty >= 1000 ? `${+(l.qty / 1000).toFixed(1)} L` : `${l.qty} ml`
  return l.qty >= 1000 ? `${+(l.qty / 1000).toFixed(1)} kg` : `${l.qty} g`
}

export function groceryMessage(lines: GroceryLine[], title: string): string {
  const out = [`*${title}*`]
  for (const g of GROUP_ORDER) {
    const ls = lines.filter((l) => l.group === g)
    if (!ls.length) continue
    out.push('', `_${g}_`)
    for (const l of ls) out.push(`• ${l.item} — ${fmtGroceryQty(l)}${l.pantry ? ' (check pantry)' : ''}`)
  }
  return out.join('\n')
}

export type { HouseholdMember }
type ID = string
