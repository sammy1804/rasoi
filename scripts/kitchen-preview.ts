/** Prints the demo cook's WhatsApp message (EN + HI) and this week's grocery list. `npx tsx scripts/kitchen-preview.ts` */
import { buildDemo } from '../src/data/demo'
import { getDB } from '../src/data/store'
import { cooksOf } from '../src/data/repository'
import { cookMessage, groceryList, groceryMessage } from '../src/lib/kitchen'
import { todayISO, weekDates, addDays } from '../src/lib/dates'

const hh = buildDemo()
const db = getDB()
const cook = cooksOf(db, hh.id)[0]
const nameOf = (id: string) => db.users[id]?.name ?? '?'
const date = process.argv[2] ?? addDays(todayISO(), 2)
console.log(cookMessage(db, cook, date, nameOf, 'en'))
console.log('\n----\n')
console.log(cookMessage(db, cook, date, nameOf, 'hi'))
console.log('\n----\n')
console.log(groceryMessage(groceryList(db, hh.id, weekDates(todayISO())), 'Groceries this week'))
