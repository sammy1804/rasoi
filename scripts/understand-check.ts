/** Checks the on-phone meal matcher against real sentences. `npx tsx --tsconfig tsconfig.json scripts/understand-check.ts` */
import { BUILTIN_FOODS } from '../src/data/foods'
import { SAMRIDHI_PROFILE } from '../src/data/demo'
import { fromClaude, understandText } from '../src/lib/understand'

const cases: [string, string[], { slot?: string; replace?: boolean }?][] = [
  ['2 roti, 1 katori dal and half a cup of rice', ['chapati 2 chapati', 'dal 1 katori', 'rice 0.5 cup']],
  ['had poha instead of chilla for breakfast', ['poha 1 katori'], { slot: 'breakfast', replace: true }],
  ['maine do roti aur ek katori paneer bhurji khayi', ['chapati 2 chapati', 'paneer-bhurji 1 katori']],
  ['skipped breakfast, just had a banana and chai', ['banana 1 medium', 'chai 1 cup'], { slot: 'breakfast', replace: true }],
  ['one and a half cups rice with rajma and dahi', ['rice 1.5 cup', 'rajma 1 katori', 'curd 1 katori']],
  ['2 eggs and 2 slices of toast with peanut butter', ['egg-white 2 white', 'bread 2 slice', 'peanut-butter 1 tbsp']],
  ['200g paneer tikka, salad', ['paneer-tikka 200 g', 'salad 1 katori']],
  ['दो रोटी, एक कटोरी दाल और आधा कप चावल', ['chapati 2 chapati', 'dal 1 katori', 'rice 0.5 cup']],
  ['a small bowl of kadai paneer and 3 chapatis for dinner', ['kadai-paneer 0.75 katori', 'chapati 3 chapati'], { slot: 'dinner' }],
  ['pizza 2 slices', ['? Pizza 2 serving']],
  ['a glass of milk, handful of almonds', ['milk 1 glass', 'almonds 17 nut']],
  ['lunch: bhindi, 2 roti, dal', ['bhindi 1 katori', 'chapati 2 chapati', 'dal 1 katori'], { slot: 'lunch' }],
]
let bad = 0
for (const [text, want, meta] of cases) {
  const u = understandText(text, BUILTIN_FOODS, SAMRIDHI_PROFILE())
  const got = u.items.map((i) => (i.food ? `${i.food.id} ${i.amount} ${i.unit}` : `? ${i.custom?.name} ${i.amount} ${i.unit}`))
  const ok = JSON.stringify(got) === JSON.stringify(want) && (meta?.slot ?? undefined) === u.slot && !!meta?.replace === u.replacePlanned
  if (!ok) bad++
  console.log(ok ? '✓' : '✗', text, ok ? '' : `\n    got  ${JSON.stringify(got)} slot=${u.slot} replace=${u.replacePlanned}\n    want ${JSON.stringify(want)} slot=${meta?.slot} replace=${!!meta?.replace}`)
}
// Claude's reply is validated, never trusted
const c = fromClaude({ slot: 'lunch', replacePlanned: true, note: 'Rice portion is a guess.', items: [
  { foodId: 'chapati', name: 'Chapati', amount: 2, unit: 'chapati', confidence: 'high' },
  { foodId: 'rice', name: 'Rice', amount: 1, unit: 'bucket' },
  { foodId: 'made-up', name: 'Veg pulao', amount: 1, unit: 'serving', kcal: 320, protein: 7, carbs: 52, fat: 9, fibre: 4 },
  { foodId: null, name: 'Dal', amount: 9999, unit: 'katori' },
  'nonsense',
] }, BUILTIN_FOODS)!
const cg = c.items.map((i) => (i.food ? `${i.food.id} ${i.amount} ${i.unit}` : `? ${i.custom?.name} ${i.custom?.nutrients?.kcal}`))
const cw = ['chapati 2 chapati', 'rice 1 cup', '? Veg pulao 320', 'dal 20 katori']
const cok = JSON.stringify(cg) === JSON.stringify(cw) && c.slot === 'lunch' && c.replacePlanned
if (!cok) bad++
console.log(cok ? '✓' : '✗', 'fromClaude validation', cok ? '' : JSON.stringify(cg))
console.log(bad ? `\n${bad} failed` : '\nall passed')
process.exit(bad ? 1 : 0)
