import { BUILTIN_FOOD_MAP } from '../src/data/foods'
import { SEED_PLAN, toSpec } from '../src/data/mealPlanSeed'
import { nutrientsFor, portionFor } from '../src/lib/nutrition'
const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
for (const style of ['lighter','standard','hearty'] as const) {
  console.log('\n==', style)
  for (let d = 0; d < 7; d++) {
    let k = 0, p = 0
    const per: string[] = []
    for (const slot of ['breakfast','lunch','snack','dinner'] as const) {
      let sk = 0, sp = 0
      for (const it of (SEED_PLAN as any)[d][slot]) {
        if (it.optional) continue
        if (it.onlyFor && it.onlyFor !== style) continue
        const spec = toSpec(it); const por = portionFor(spec, style)
        const f = BUILTIN_FOOD_MAP[por.foodId ?? spec.foodId]
        if (!f) { console.log('MISSING', spec.foodId); continue }
        const n = nutrientsFor(f, por.amount, por.unit)
        sk += n.kcal; sp += n.protein
      }
      per.push(`${slot[0]}:${Math.round(sk)}/${Math.round(sp)}`)
      k += sk; p += sp
    }
    console.log(days[d], Math.round(k), 'kcal', Math.round(p), 'g', per.join(' '))
  }
}
