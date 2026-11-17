/** Checks the movement → calories maths. `npm run check:fitness` */
import { NAINA_PROFILE, SAMRIDHI_PROFILE } from '../src/data/demo'
import { activeFor, dayTarget, parseActivity, stepsKcal, usualActiveKcal, workoutKcal } from '../src/lib/fitness'

const s = SAMRIDHI_PROFILE()
const n = NAINA_PROFILE()
let bad = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) bad++
  console.log(ok ? '✓' : '✗', name, ok ? '' : detail)
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol
const log = (steps: number, workouts: { type: string; minutes: number; effort: 'easy' | 'moderate' | 'hard' }[] = []) => ({ userId: 'u', date: '2026-11-17', steps, workouts: workouts.map((w, i) => ({ ...w, id: `w${i}` })) })

check('8,000 steps ≈ 145 kcal for Samridhi', near(stepsKcal(s, 8000), 143, 8), String(stepsKcal(s, 8000)))
check('45 min moderate calisthenics ≈ 118 kcal', near(workoutKcal(s, { type: 'calisthenics', minutes: 45, effort: 'moderate' }), 118, 6))
check('usual active for a moderate level ≈ 435 kcal', near(usualActiveKcal(s), 437, 10), String(usualActiveKcal(s)))
check('no movement logged leaves the target alone', dayTarget(s, undefined).target === 1650 && dayTarget(s, log(0)).reason === 'no-data')
const quiet = dayTarget(s, log(2000))
check('a quiet day lowers it, capped at −250', quiet.target === 1400 && quiet.reason === 'less', JSON.stringify(quiet))
const big = dayTarget(s, log(14000, [{ type: 'calisthenics', minutes: 60, effort: 'hard' }, { type: 'run', minutes: 30, effort: 'moderate' }]))
check('a very active day raises it, capped at +250', big.target === 1900 && big.reason === 'more', JSON.stringify(big))
const typical = dayTarget(s, log(9000, [{ type: 'calisthenics', minutes: 45, effort: 'hard' }]))
check('a typical training day lands near her 1,650', near(typical.target, 1650, 60), String(typical.target))
check('a day still in progress is never lowered', dayTarget(s, log(2000), true).target === 1650 && dayTarget(s, log(2000), true).reason === 'in-progress')
check('…but still goes up as she moves', dayTarget(s, log(14000, [{ type: 'run', minutes: 45, effort: 'moderate' }]), true).target === 1800)
check('switched off keeps the fixed target', dayTarget({ ...s, adjustForActivity: false }, log(2000)).target === 1650)
check('someone gaining never drops below their base', dayTarget(n, log(1000)).target === n.calorieTarget && dayTarget(n, log(1000)).reason === 'gain-floor')
check('…but gets more on an active day', dayTarget(n, log(12000, [{ type: 'yoga', minutes: 60, effort: 'hard' }])).target > n.calorieTarget)
check('never below 1,200', dayTarget({ ...s, calorieTarget: 1300 }, log(500)).target === 1200)
check('active breakdown adds up', near(activeFor(s, log(8000, [{ type: 'yoga', minutes: 30, effort: 'easy' }])).total, 143 + 28, 10))

const p1 = parseActivity('walked 8,000 steps and did 45 min calisthenics')
check('parse: steps + workout', p1.steps === 8000 && p1.workouts.length === 1 && p1.workouts[0].type === 'calisthenics' && p1.workouts[0].minutes === 45, JSON.stringify(p1))
const p2 = parseActivity('1 hour gym, hard, and half an hour walk, 6k steps')
check('parse: two workouts, hours, 6k', p2.steps === 6000 && p2.workouts.length === 2 && p2.workouts[0].minutes === 60 && p2.workouts[0].effort === 'hard' && p2.workouts[1].type === 'walk' && p2.workouts[1].minutes === 30, JSON.stringify(p2))
const p3 = parseActivity('yoga for 30 minutes')
check('parse: "yoga for 30 minutes"', p3.steps === undefined && p3.workouts[0]?.type === 'yoga' && p3.workouts[0]?.minutes === 30, JSON.stringify(p3))
console.log(bad ? `\n${bad} failed` : '\nall passed')
process.exit(bad ? 1 : 0)
