import type { ActivityLog, Effort, Profile, Workout } from '@/data/types'
import { activityShare, bmrOf } from './nutrition'

/**
 * Movement → calories. Everything here is an estimate from standard formulas
 * (step length from height, MET values for workouts); real burn varies a lot
 * between people and days, so adjustments to the food target are capped.
 */

export interface WorkoutKind {
  id: string
  label: string
  emoji: string
  /** MET (multiples of resting energy use) at easy / moderate / hard effort */
  met: Record<Effort, number>
  aliases: string[]
}

export const WORKOUTS: WorkoutKind[] = [
  { id: 'calisthenics', label: 'Calisthenics', emoji: '🤸', met: { easy: 3, moderate: 3.8, hard: 8 }, aliases: ['calisthenics', 'bodyweight', 'body weight', 'pushups', 'push ups', 'pullups'] },
  { id: 'strength', label: 'Gym / weights', emoji: '🏋️', met: { easy: 3, moderate: 3.5, hard: 6 }, aliases: ['gym', 'weights', 'strength', 'lifting', 'weight training', 'workout'] },
  { id: 'walk', label: 'Brisk walk', emoji: '🚶', met: { easy: 2.8, moderate: 3.5, hard: 4.3 }, aliases: ['walk', 'walking', 'walked', 'stroll', 'sair'] },
  { id: 'run', label: 'Run', emoji: '🏃', met: { easy: 7, moderate: 9, hard: 11 }, aliases: ['run', 'running', 'ran', 'jog', 'jogging', 'jogged'] },
  { id: 'yoga', label: 'Yoga', emoji: '🧘', met: { easy: 2, moderate: 2.5, hard: 4 }, aliases: ['yoga', 'stretching', 'stretch', 'pranayam', 'surya namaskar'] },
  { id: 'cycle', label: 'Cycling', emoji: '🚴', met: { easy: 4, moderate: 6.8, hard: 10 }, aliases: ['cycling', 'cycle', 'cycled', 'bike', 'biking', 'spin'] },
  { id: 'dance', label: 'Dance / Zumba', emoji: '💃', met: { easy: 3.5, moderate: 5, hard: 7 }, aliases: ['dance', 'dancing', 'danced', 'zumba', 'garba', 'bhangra'] },
  { id: 'hiit', label: 'HIIT / cardio', emoji: '🔥', met: { easy: 5, moderate: 7, hard: 9 }, aliases: ['hiit', 'cardio', 'aerobics', 'skipping', 'jump rope', 'crossfit'] },
  { id: 'swim', label: 'Swimming', emoji: '🏊', met: { easy: 4.5, moderate: 6, hard: 9 }, aliases: ['swim', 'swimming', 'swam'] },
  { id: 'sport', label: 'Badminton / sport', emoji: '🏸', met: { easy: 4, moderate: 5.5, hard: 7 }, aliases: ['badminton', 'tennis', 'cricket', 'football', 'basketball', 'sport', 'sports', 'played'] },
  { id: 'pilates', label: 'Pilates', emoji: '🤍', met: { easy: 2.5, moderate: 3, hard: 4 }, aliases: ['pilates', 'barre'] },
  { id: 'chores', label: 'Housework', emoji: '🧹', met: { easy: 2.3, moderate: 3, hard: 3.8 }, aliases: ['cleaning', 'housework', 'chores', 'jhadu', 'pocha', 'mopping', 'sweeping'] },
]
export const workoutKind = (id: string) => WORKOUTS.find((w) => w.id === id) ?? WORKOUTS[1]

type Body = Pick<Profile, 'heightCm' | 'weightKg'>

/** Distance walked, from step count and height (step length ≈ 0.413 × height). */
export const stepsKm = (p: Body, steps: number) => (steps * (p.heightCm / 100) * 0.413) / 1000

/** Extra calories from walking that many steps, above resting (≈ 0.5 kcal per kg per km). */
export const stepsKcal = (p: Body, steps: number) => stepsKm(p, steps) * p.weightKg * 0.5

/** Extra calories from a workout, above what resting for the same time would use. */
export function workoutKcal(p: Body, w: Pick<Workout, 'type' | 'minutes' | 'effort'>): number {
  const met = workoutKind(w.type).met[w.effort]
  return Math.max(0, met - 1) * p.weightKg * (w.minutes / 60)
}

export interface ActiveBreakdown {
  steps: number
  stepsKcal: number
  workoutKcal: number
  workoutMinutes: number
  total: number
}

export function activeFor(p: Body, log: ActivityLog | undefined): ActiveBreakdown {
  const steps = log?.steps ?? 0
  const sk = stepsKcal(p, steps)
  const wk = (log?.workouts ?? []).reduce((s, w) => s + workoutKcal(p, w), 0)
  return { steps, stepsKcal: sk, workoutKcal: wk, workoutMinutes: (log?.workouts ?? []).reduce((s, w) => s + w.minutes, 0), total: sk + wk }
}

/**
 * What the person's calorie target already assumes they burn by moving on a
 * typical day, from the activity level in their profile (the gap between that
 * level and a resting day).
 */
export function usualActiveKcal(p: Profile): number {
  return bmrOf(p) * activityShare(p.activity)
}

export const MAX_ADJUST = 250
export const MIN_TARGET = 1200

export interface DayTarget {
  /** the calorie target to eat towards today */
  target: number
  /** the fixed target from the profile */
  base: number
  /** target − base */
  adjust: number
  active: ActiveBreakdown
  usual: number
  /** why it's adjusted (or not) */
  reason: 'no-data' | 'off' | 'usual' | 'more' | 'less' | 'gain-floor' | 'in-progress'
}

/**
 * The day's calorie target, following how active the day was.
 *
 * The profile's target stays the anchor: it already assumes a usual amount of
 * movement. A more active day adds calories, a quieter day takes some off, by
 * the difference from usual — capped at ±250 kcal, never below 1,200, and for
 * someone gaining weight never below their base target. Days with no movement
 * logged are left alone rather than treated as rest days. A day that is still
 * going (`inProgress`) is never lowered: there's still time to move, so today's
 * target only climbs, and a quiet day counts once it's over.
 */
export function dayTarget(p: Profile, log: ActivityLog | undefined, inProgress = false): DayTarget {
  const active = activeFor(p, log)
  const usual = usualActiveKcal(p)
  const base = p.calorieTarget
  const none = { target: base, base, adjust: 0, active, usual }
  if (p.adjustForActivity === false) return { ...none, reason: 'off' }
  if (!log || (log.steps === 0 && log.workouts.length === 0)) return { ...none, reason: 'no-data' }
  let adjust = Math.round((active.total - usual) / 10) * 10
  adjust = Math.max(-MAX_ADJUST, Math.min(MAX_ADJUST, adjust))
  if (adjust < 0 && inProgress) return { ...none, reason: 'in-progress' }
  if (p.goal === 'gain' && adjust < 0) return { ...none, reason: 'gain-floor' }
  const target = Math.max(Math.min(base, MIN_TARGET), base + adjust)
  adjust = target - base
  return { target, base, adjust, active, usual, reason: Math.abs(adjust) < 30 ? 'usual' : adjust > 0 ? 'more' : 'less' }
}

export function targetNote(t: DayTarget): string {
  const n = Math.abs(t.adjust).toLocaleString('en-IN')
  switch (t.reason) {
    case 'more':
      return `+${n} kcal today: more active than your usual`
    case 'less':
      return `−${n} kcal today: a quieter day than your usual`
    case 'usual':
      return 'About as active as your usual day'
    case 'gain-floor':
      return 'Quieter day, but your target stays put while you’re gaining'
    default:
      return ''
  }
}

/* ——————————— "8000 steps and 45 min yoga" ——————————— */

export interface ParsedActivity {
  steps?: number
  workouts: { type: string; minutes: number; effort: Effort }[]
}

/** Read steps and workouts out of a typed or spoken sentence. */
export function parseActivity(text: string): ParsedActivity {
  const t = text.toLowerCase().replace(/,(\d{3})/g, '$1')
  const out: ParsedActivity = { workouts: [] }
  const steps = t.match(/(\d+(?:\.\d+)?)\s*(k|thousand|hazaar|hazar|हज़ार|हजार)?\s*(steps?|kadam|क़दम|कदम)/)
  if (steps) out.steps = Math.round(Number(steps[1]) * (steps[2] ? 1000 : 1))
  const effort: Effort = /\b(hard|intense|heavy|vigorous|tough)\b/.test(t) ? 'hard' : /\b(easy|light|gentle|slow)\b/.test(t) ? 'easy' : 'moderate'
  // "45 min yoga", "yoga for 45 minutes", "1 hour gym", "an hour of badminton", "half an hour walk"
  const durations: { minutes: number; index: number }[] = []
  const re = /(\d+(?:\.\d+)?|an|a|half an|half)\s*(hours?|hrs?|h|ghante?|घंटे?|minutes?|mins?|min|m|मिनट)\b/g
  for (let m = re.exec(t); m; m = re.exec(t)) {
    const n = m[1] === 'an' || m[1] === 'a' ? 1 : m[1].startsWith('half') ? 0.5 : Number(m[1])
    const hours = /^(h|gh|घ)/.test(m[2])
    durations.push({ minutes: Math.round(n * (hours ? 60 : 1)), index: m.index })
  }
  const found: { type: string; index: number }[] = []
  for (const w of WORKOUTS) {
    for (const a of w.aliases) {
      const i = t.search(new RegExp(`\\b${a.replace(/ /g, '\\s+')}\\b`))
      if (i >= 0 && !found.some((f) => f.type === w.id)) found.push({ type: w.id, index: i })
    }
  }
  // "walked 8000 steps" is the step count, not a separate walk: drop the walk when there's no duration left over for it
  const kinds = found.filter((f) => !(f.type === 'walk' && out.steps !== undefined && durations.length < found.length)).sort((a, b) => a.index - b.index)
  const free = [...durations]
  for (const k of kinds) {
    if (!free.length) break
    // pair each workout with the nearest duration
    let best = 0
    free.forEach((d, i) => {
      if (Math.abs(d.index - k.index) < Math.abs(free[best].index - k.index)) best = i
    })
    out.workouts.push({ type: k.type, minutes: free.splice(best, 1)[0].minutes, effort })
  }
  return out
}
