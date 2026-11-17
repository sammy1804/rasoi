import { Footprints, Mic, Plus, Square, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Input, NumberInput } from '@/components/ui/field'
import { Segmented } from '@/components/ui/segmented'
import { Sheet } from '@/components/ui/sheet'
import { Stepper } from '@/components/ui/stepper'
import { Switch } from '@/components/ui/switch'
import { activityFor, addWorkout, removeWorkout, setSteps, updateProfile } from '@/data/repository'
import { useStore } from '@/data/store'
import type { Effort, HouseholdMember, ISODate } from '@/data/types'
import { useVoice } from '@/lib/assistant'
import { relativeDayLabel, todayISO } from '@/lib/dates'
import { MAX_ADJUST, WORKOUTS, dayTarget, parseActivity, stepsKcal, stepsKm, targetNote, workoutKcal, workoutKind } from '@/lib/fitness'
import { cn, fmtNum } from '@/lib/utils'
import { useToast } from './Toast'

/** Log the day's steps and workouts, and see what they do to today's calories. */
export function ActivitySheet({ open, onClose, member, date }: { open: boolean; onClose: () => void; member: HouseholdMember; date: ISODate }) {
  const { db } = useStore()
  const toast = useToast()
  const p = member.profile
  const log = activityFor(db, member.userId, date)
  const [steps, setStepsDraft] = useState<number | ''>('')
  const [type, setType] = useState('calisthenics')
  const [minutes, setMinutes] = useState(30)
  const [effort, setEffort] = useState<Effort>('moderate')
  const [said, setSaid] = useState('')
  const voice = useVoice((heard) => setSaid((t) => (t.trim() ? t.trim() + ' ' : '') + heard.trim()))

  useEffect(() => {
    if (open) {
      setStepsDraft(log?.steps || '')
      setSaid('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const saveSteps = (n: number | '') => {
    setStepsDraft(n)
    setSteps(member.userId, date, n === '' ? 0 : n)
  }
  const t = dayTarget(p, log, date === todayISO())
  const note = targetNote(t)
  const applySaid = () => {
    const parsed = parseActivity(said)
    if (parsed.steps === undefined && parsed.workouts.length === 0) return toast({ text: 'Couldn’t find steps or a workout in that' })
    if (parsed.steps !== undefined) saveSteps(parsed.steps)
    for (const w of parsed.workouts) addWorkout(member.userId, date, w)
    setSaid('')
    toast({ text: [parsed.steps !== undefined ? `${fmtNum(parsed.steps)} steps` : '', ...parsed.workouts.map((w) => `${w.minutes} min ${workoutKind(w.type).label.toLowerCase()}`)].filter(Boolean).join(' · ') })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Movement"
      description={`${relativeDayLabel(date)}’s steps and workouts. Type them in from your phone or watch.`}
      className="h-[92dvh]"
      footer={
        <Button size="lg" block onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-5 pb-2" data-testid="activity-sheet">
        <section>
          <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
            <Footprints size={15} /> Steps
          </p>
          <NumberInput value={steps} onChange={saveSteps} placeholder="0" suffix="steps" aria-label="Steps" className="[&_input]:h-14 [&_input]:pr-16 [&_input]:text-[20px] [&_input]:font-semibold" />
          <div className="mt-2 flex flex-wrap gap-2">
            {[1000, 2500, 5000].map((n) => (
              <Chip key={n} onClick={() => saveSteps((Number(steps) || 0) + n)}>
                +{fmtNum(n)}
              </Chip>
            ))}
          </div>
          {Number(steps) > 0 && (
            <p className="mt-2 text-[13px] text-ink-mute tabular">
              About {stepsKm(p, Number(steps)).toFixed(1)} km · {fmtNum(stepsKcal(p, Number(steps)))} kcal
            </p>
          )}
        </section>

        <section>
          <p className="mb-2 text-[13px] font-semibold text-ink-soft">Workouts</p>
          {(log?.workouts.length ?? 0) > 0 && (
            <ul className="mb-3 overflow-hidden rounded-2xl border border-line/80 bg-card" data-testid="workout-list">
              {log!.workouts.map((w) => {
                const k = workoutKind(w.type)
                return (
                  <li key={w.id} className="flex items-center gap-3 border-t border-line/60 px-3 py-2.5 first:border-t-0">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand text-[20px]" aria-hidden>
                      {k.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{k.label}</span>
                      <span className="block text-[13px] text-ink-mute tabular">
                        {w.minutes} min · {w.effort} · {fmtNum(workoutKcal(p, w))} kcal
                      </span>
                    </span>
                    <button onClick={() => removeWorkout(member.userId, date, w.id)} className="grid h-9 w-9 place-items-center rounded-full text-ink-mute hover:bg-sand hover:text-ink focus-ring" aria-label={`Remove ${k.label}`}>
                      <Trash2 size={15} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="rounded-2xl border border-line bg-card p-3">
            <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3">
              {WORKOUTS.map((w) => (
                <Chip key={w.id} active={type === w.id} onClick={() => setType(w.id)}>
                  <span aria-hidden>{w.emoji}</span> {w.label}
                </Chip>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2">
              <Stepper value={minutes} onChange={setMinutes} step={5} min={5} max={300} format={(v) => `${v} min`} label="minutes" />
              <span className="pr-1 text-[13px] text-ink-mute tabular">≈ {fmtNum(workoutKcal(p, { type, minutes, effort }))} kcal</span>
            </div>
            <Segmented
              size="sm"
              className="mt-2"
              value={effort}
              onChange={setEffort}
              options={[
                { value: 'easy', label: 'Easy' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'hard', label: 'Hard' },
              ]}
            />
            <Button
              variant="secondary"
              block
              className="mt-3"
              onClick={() => {
                addWorkout(member.userId, date, { type, minutes, effort })
                toast({ text: `Added ${minutes} min ${workoutKind(type).label.toLowerCase()}` })
              }}
            >
              <Plus size={16} /> Add workout
            </Button>
          </div>
        </section>

        <section>
          <p className="mb-2 text-[13px] font-semibold text-ink-soft">Or just say it</p>
          <div className="flex gap-2">
            <Input value={said} onChange={(e) => setSaid(e.target.value)} placeholder="8,000 steps and 45 min yoga" aria-label="Say your movement" className="h-11 rounded-full" onKeyDown={(e) => e.key === 'Enter' && applySaid()} />
            {voice.supported && (
              <button onClick={() => voice.toggle('en')} aria-pressed={voice.listening} aria-label={voice.listening ? 'Stop listening' : 'Talk'} className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-full transition focus-ring', voice.listening ? 'bg-clay text-clay-on' : 'bg-sand text-ink')}>
                {voice.listening ? <Square size={14} fill="currentColor" /> : <Mic size={17} />}
              </button>
            )}
            <Button variant="secondary" className="h-11" disabled={!said.trim()} onClick={applySaid}>
              Add
            </Button>
          </div>
          {voice.listening && <p className="mt-1 px-1 text-[13px] italic text-ink-mute">{voice.partial || 'Listening…'}</p>}
        </section>

        <section className="rounded-2xl bg-sand/70 p-4" data-testid="activity-effect">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-semibold text-ink-soft">Burned by moving</p>
            <p className="font-display text-[24px] font-medium leading-none tabular">
              {fmtNum(t.active.total)} <span className="font-sans text-[13px] font-semibold text-ink-mute">kcal</span>
            </p>
          </div>
          <p className="mt-1 text-[13px] text-ink-mute tabular">
            Steps {fmtNum(t.active.stepsKcal)} · workouts {fmtNum(t.active.workoutKcal)} · your usual day is about {fmtNum(t.usual)}
          </p>
          <div className="mt-3 flex items-center gap-4 border-t border-line/70 pt-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">Let my calories follow my activity</span>
              <span className="block text-[13px] leading-snug text-ink-mute">
                {p.adjustForActivity === false ? `Your target stays at ${fmtNum(p.calorieTarget)} kcal every day.` : `${date === todayISO() ? 'Today’s' : 'This day’s'} target: ${fmtNum(t.target)} kcal${note ? ` (${note.toLowerCase()})` : ''}.${t.reason === 'in-progress' ? ' It goes up as you move today; a quieter day only counts once the day is over.' : ''}`}
              </span>
            </span>
            <Switch checked={p.adjustForActivity !== false} onChange={(v) => updateProfile(member.id, { adjustForActivity: v })} label="Let my calories follow my activity" />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-mute">
            Your {fmtNum(p.calorieTarget)} kcal target already assumes a usual amount of movement for a “{p.activity}” activity level. More than that adds calories, less takes some off, by at most {MAX_ADJUST} kcal. These are estimates.
          </p>
        </section>
      </div>
    </Sheet>
  )
}
