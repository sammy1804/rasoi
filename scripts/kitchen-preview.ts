/**
 * Prints what the kitchen logic produces for the demo household: the cook's WhatsApp
 * message and link, the shop lists and the cost estimate.
 *   npx tsx --tsconfig tsconfig.json scripts/kitchen-preview.ts [YYYY-MM-DD]
 */
import { buildDemo } from '../src/data/demo'
import { cooksOf } from '../src/data/repository'
import { getDB } from '../src/data/store'
import { addDays, todayISO } from '../src/lib/dates'
import { buildCookDay, bulkList, cookLink, cookMessage, decodeCookDay, encodeCookDay, monthlyEstimate, orderPrompt, quickList, subscriptionPlan } from '../src/lib/kitchen'

const hh = buildDemo()
const db = getDB()
const cook = cooksOf(db, hh.id)[0]
const h = db.households[hh.id]
const day = buildCookDay(db, cook, process.argv[2] ?? addDays(todayISO(), 1))
console.log(cookMessage(day, 'hi', false))
console.log('\n---- English\n')
console.log(cookMessage(day, 'en', false))
const link = cookLink(day)
console.log('\ncook link:', link.length, 'chars · round-trips:', JSON.stringify(decodeCookDay(encodeCookDay(day))) === JSON.stringify(day))
const q = quickList(db, h)
console.log('\nquick order', q.orderDate, 'covers', q.dates.join(', '))
console.log(orderPrompt('Zepto', q.lines))
console.log('\nmonthly staples:', bulkList(db, h).lines.map((l) => `${l.item} ${l.qty}${l.unit}`).join(', '))
console.log('\nsubscription (Mon..Sun):', subscriptionPlan(db, h).map((l) => `${l.item} ${l.perDay.join('/')}`).join(' | '))
const e = monthlyEstimate(db, h)
console.log('\nestimate ₹/month:', Math.round(e.total), Object.fromEntries(Object.entries(e.byShop).map(([k, v]) => [k, Math.round(v)])))
console.log('top:', e.top.slice(0, 6).map((t) => `${t.item} ₹${Math.round(t.cost)}`).join(', '))
