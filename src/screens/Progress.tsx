import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Lock, Plus, Scale, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SLOT_META } from '@/app/meta'
import { Avatar } from '@/components/Avatar'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Field, Input, NumberInput } from '@/components/ui/field'
import { Segmented } from '@/components/ui/segmented'
import { Sheet } from '@/components/ui/sheet'
import { addWeight, deleteWeight } from '@/data/repository'
import type { HouseholdMember, WeightLog } from '@/data/types'
import { useSession } from '@/hooks/useSession'
import { WEEKDAY_SHORT, addDays, daysBetween, fmtShortDate, fromISO, startOfWeek, todayISO, weekDates } from '@/lib/dates'
import { weekReview } from '@/lib/summary'
import { usualActiveKcal } from '@/lib/fitness'
import { DailyBars, LineChart, MacroBar, MealGrid } from '@/components/charts'
import { fmtNum } from '@/lib/utils'

export function ProgressScreen() {
  const { db, member, partner, nameOf } = useSession()
  const me = member!
  const [whoId, setWhoId] = useState(me.userId)
  const who: HouseholdMember = whoId === partner?.userId ? partner : me
  const isMine = who.userId === me.userId
  // Early in the week, the last full week is the more useful review.
  const [weekStart, setWeekStart] = useState(() => {
    const thisMon = startOfWeek(todayISO())
    return daysBetween(thisMon, todayISO()) < 2 ? addDays(thisMon, -7) : thisMon
  })
  const dates = weekDates(weekStart)
  const r = useMemo(() => weekReview(db, who, dates), [db, who, weekStart])
  const thisWeek = weekStart === startOfWeek(todayISO())
  /** the calorie target moved on at least one day this week */
  const adjusts = r.daily.some((d) => d.target !== who.profile.calorieTarget)
  const sh = who.sharing
  const canCal = isMine || sh.calories
  const canPro = isMine || sh.protein
  const canMeals = isMine || sh.mealCompletion || sh.fullLog
  const canFoods = isMine || sh.fullLog
  const [trendMetric, setTrendMetric] = useState<'protein' | 'kcal' | 'steps'>('protein')
  const stepGoal = who.profile.stepGoal ?? 8000
  const usual = usualActiveKcal(who.profile)

  // Both people's protein as % of their own target (one shared axis, no dual scales).
  const together = useMemo(() => {
    if (!partner || !partner.sharing.protein) return null
    return [me, partner].map((m) => {
      const rv = m.userId === who.userId ? r : weekReview(db, m, dates)
      return {
        name: nameOf(m.userId),
        values: rv.daily.map((d) => (d.logged ? (d.protein / m.profile.proteinTarget) * 100 : null)),
        color: m.hue % 2 === 0 ? 'rgb(var(--c1))' : 'rgb(var(--c2))',
      }
    })
  }, [db, me, partner, r, who.userId, weekStart])

  const trend = useMemo(() => {
    const starts = [-21, -14, -7, 0].map((n) => addDays(weekStart, n))
    const reviews = starts.map((st) => weekReview(db, who, weekDates(st)))
    if (reviews.filter((x) => x.loggedDays > 0).length < 2) return null
    return {
      labels: starts.map((st) => fmtShortDate(st)),
      protein: reviews.map((x) => (x.loggedDays ? x.avgProtein : null)),
      kcal: reviews.map((x) => (x.loggedDays ? x.avgKcal : null)),
      steps: reviews.map((x) => (x.movementDays ? x.avgSteps : null)),
    }
  }, [db, who, weekStart])

  return (
    <div className="px-4">
      <header className="pt-safe">
        <div className="pt-5">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-mute">Weekly review</p>
          <h1 className="mt-0.5 font-display text-[28px] font-medium tracking-tight">Progress</h1>
        </div>
        {partner && (
          <Segmented
            className="mt-4"
            value={whoId}
            onChange={setWhoId}
            options={[me, partner].map((m) => ({
              value: m.userId,
              label: (
                <>
                  <Avatar name={nameOf(m.userId)} hue={m.hue} size={20} /> {m.userId === me.userId ? 'Me' : nameOf(m.userId)}
                </>
              ),
            }))}
          />
        )}
        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="grid h-10 w-10 place-items-center rounded-full hover:bg-sand focus-ring" aria-label="Previous week">
            <ChevronLeft size={20} />
          </button>
          <p className="text-center">
            <span className="block text-[15px] font-semibold">{thisWeek ? 'This week' : daysBetween(weekStart, startOfWeek(todayISO())) === 7 ? 'Last week' : `Week of ${fmtShortDate(weekStart)}`}</span>
            <span className="block text-[12px] text-ink-mute">
              {fmtShortDate(dates[0])} – {fmtShortDate(dates[6])}
            </span>
          </p>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            disabled={thisWeek}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-sand disabled:opacity-25 focus-ring"
            aria-label="Next week"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {r.loggedDays === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-line px-6 py-10 text-center">
          <p className="font-semibold">No meals logged this week{isMine ? '' : ` for ${nameOf(who.userId)}`}</p>
          <p className="mt-1 text-sm text-ink-mute">Your review fills in as you tick things off on the Home tab.</p>
        </div>
      ) : (
        <motion.div key={`${weekStart}${whoId}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {canCal && <Tile label="Avg calories" value={fmtNum(r.avgKcal)} sub={`target ${fmtNum(who.profile.calorieTarget)}${adjusts ? ', moves with activity' : ''}`} />}
            {canPro && <Tile label="Avg protein" value={`${Math.round(r.avgProtein)} g`} sub={`target ${who.profile.proteinMin}–${who.profile.proteinTarget} g`} />}
            {canPro && <Tile label="Protein days" value={`${r.proteinDays} / ${r.loggedDays}`} sub={`days at ${who.profile.proteinMin} g or more`} />}
            {canMeals && <Tile label="Meals completed" value={`${r.mealsCompleted}`} sub={`of ${r.mealsPossible} so far`} />}
            {canMeals && (
              <Tile
                label="Most skipped"
                value={r.mostSkipped ? SLOT_META[r.mostSkipped.slot].label : 'None'}
                sub={r.mostSkipped ? `${r.mostSkipped.count} item${r.mostSkipped.count > 1 ? 's' : ''} skipped` : 'nothing skipped'}
              />
            )}
            {canFoods && <Tile label="Veg variety" value={`${r.veg.length}`} sub={`different vegetables${r.fruit.length ? ` · ${r.fruit.length} fruits` : ''}`} />}
            {canCal && r.movementDays > 0 && <Tile label="Avg steps" value={fmtNum(r.avgSteps)} sub={`${r.stepGoalDays} of ${r.movementDays} days at ${fmtNum(stepGoal)}+`} />}
            {canCal && r.movementDays > 0 && <Tile label="Workouts" value={`${r.workouts}`} sub={`${fmtNum(r.workoutMinutes)} min · about ${fmtNum(r.avgActive)} kcal active a day`} />}
          </div>

          {canCal && (
            <DailyBars
              title="Calories per day"
              testId="chart-kcal"
              days={r.daily.map((d) => ({ value: d.kcal, logged: d.logged }))}
              target={who.profile.calorieTarget}
              band={[0.9, 1.1]}
              targets={adjusts ? r.daily.map((d) => d.target) : undefined}
              unit="kcal"
              barClass="bg-ink/80"
              footer={adjusts ? 'Each day’s target follows how active that day was, so the line moves. Solid bars landed within 10% of it.' : undefined}
            />
          )}
          {canCal && r.movementDays > 0 && (
            <DailyBars
              title="Steps per day"
              testId="chart-steps"
              days={r.daily.map((d) => ({ value: d.steps, logged: d.steps > 0 }))}
              target={stepGoal}
              unit="steps"
              barClass="bg-chart-2"
            />
          )}
          {canCal && r.movementDays > 0 && (
            <DailyBars
              title="Calories burned by moving"
              testId="chart-active"
              days={r.daily.map((d) => ({ value: d.active, logged: d.active > 0 }))}
              target={usual}
              unit="kcal"
              barClass="bg-chart-3"
              footer={`Steps plus workouts, above resting. The dashed line is the usual day your ${fmtNum(who.profile.calorieTarget)} kcal target assumes. Estimates.`}
            />
          )}
          {canPro && (
            <DailyBars
              title="Protein per day"
              testId="chart-protein"
              days={r.daily.map((d) => ({ value: d.protein, logged: d.logged }))}
              target={who.profile.proteinTarget}
              marker={who.profile.proteinMin}
              unit="g"
              barClass="bg-chart-1"
            />
          )}
          {canMeals && <MealGrid grid={r.slotGrid} />}
          {(isMine || (sh.calories && sh.protein)) && <MacroBar protein={r.avgProtein} carbs={r.avgCarbs} fat={r.avgFat} />}
          {isMine && together && (
            <LineChart
              title="Both of you · protein"
              testId="chart-together"
              labels={WEEKDAY_SHORT.map((d) => d.charAt(0))}
              series={together}
              refLine={100}
              refLabel="100% of own target"
              format={(v) => `${Math.round(v)}%`}
              footer="Each line is protein as a % of that person’s own target, so different goals compare fairly."
            />
          )}
          {canPro && trend && (
            <div>
              <Segmented
                size="sm"
                className="mb-2"
                value={trendMetric}
                onChange={setTrendMetric}
                options={[
                  { value: 'protein', label: 'Protein' },
                  ...(canCal ? [{ value: 'kcal' as const, label: 'Calories' }] : []),
                  ...(canCal && trend.steps.some((x) => x !== null) ? [{ value: 'steps' as const, label: 'Steps' }] : []),
                ]}
              />
              <LineChart
                title="Last 4 weeks · daily average"
                testId="chart-trend"
                labels={trend.labels}
                series={[
                  trendMetric === 'protein'
                    ? { name: 'Protein', values: trend.protein, color: 'rgb(var(--c1))' }
                    : trendMetric === 'kcal'
                      ? { name: 'Calories', values: trend.kcal, color: 'rgb(var(--ink))' }
                      : { name: 'Steps', values: trend.steps, color: 'rgb(var(--c2))' },
                ]}
                refLine={trendMetric === 'protein' ? who.profile.proteinMin : trendMetric === 'kcal' ? who.profile.calorieTarget : stepGoal}
                refLabel={trendMetric === 'protein' ? `${who.profile.proteinMin} g` : trendMetric === 'kcal' ? `${fmtNum(who.profile.calorieTarget)} kcal` : `${fmtNum(stepGoal)} steps`}
                format={(v) => (trendMetric === 'protein' ? `${Math.round(v)} g` : trendMetric === 'kcal' ? `${fmtNum(v)} kcal` : `${fmtNum(v)} steps`)}
              />
            </div>
          )}

          {canFoods && r.topFoods.length > 0 && (
            <section className="rounded-3xl border border-line/80 bg-card p-4 shadow-soft">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-ink-mute">Most eaten</h2>
              <ol className="mt-2 space-y-1.5">
                {r.topFoods.map((t, i) => (
                  <li key={t.food.id} className="flex items-center gap-3 text-[14px]">
                    <span className="w-4 text-ink-mute tabular">{i + 1}</span>
                    <span className="flex-1 font-semibold">{t.food.name}</span>
                    <span className="text-ink-mute tabular">×{t.count}</span>
                  </li>
                ))}
              </ol>
              {r.veg.length > 0 && (
                <>
                  <h2 className="mt-4 text-[13px] font-semibold uppercase tracking-[0.1em] text-ink-mute">Vegetables this week</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.veg.map((v) => (
                      <span key={v} className="rounded-full bg-meal-lunch/10 px-2.5 py-1 text-[12px] font-semibold capitalize text-meal-lunch-text">
                        {v}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {!isMine && !(canCal || canPro || canMeals) && (
            <p className="flex items-center gap-2 rounded-2xl bg-sand px-4 py-3 text-sm text-ink-soft">
              <Lock size={14} /> {nameOf(who.userId)} keeps their progress private.
            </p>
          )}
          <p className="px-1 text-[12px] leading-relaxed text-ink-mute">
            Averages count only days with something logged. Day-to-day numbers bounce around — the weekly picture is what matters.
          </p>
        </motion.div>
      )}

      {isMine ? (
        <WeightCard member={me} logs={Object.values(db.weightLogs).filter((w) => w.userId === me.userId)} />
      ) : (
        <p className="mt-6 flex items-center gap-2 px-1 text-[13px] text-ink-mute">
          <Lock size={13} /> Weight is only ever visible to the person who logs it.
        </p>
      )}
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line/80 bg-card px-4 py-3.5 shadow-soft">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-mute">{label}</p>
      <p className="mt-1 font-display text-[24px] font-medium leading-none tabular">{value}</p>
      {sub && <p className="mt-1.5 text-[12px] text-ink-mute">{sub}</p>}
    </div>
  )
}

function WeightCard({ member, logs }: { member: HouseholdMember; logs: WeightLog[] }) {
  const [range, setRange] = useState<'weekly' | 'monthly'>('weekly')
  const [open, setOpen] = useState(false)
  const [kg, setKg] = useState<number | ''>(member.profile.weightKg)
  const [date, setDate] = useState(todayISO())
  const [hover, setHover] = useState<number | null>(null)
  const toast = useToast()
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date))
  const last = sorted[sorted.length - 1]
  const daysSinceLast = last ? daysBetween(last.date, todayISO()) : Infinity

  // bucket to weekly or monthly averages so daily noise disappears
  const points = useMemo(() => {
    const buckets = new Map<string, number[]>()
    for (const w of sorted) {
      const key = range === 'weekly' ? startOfWeek(w.date) : w.date.slice(0, 7)
      buckets.set(key, [...(buckets.get(key) ?? []), w.kg])
    }
    const arr = [...buckets.entries()].map(([k, v]) => ({ key: k, kg: v.reduce((a, b) => a + b, 0) / v.length }))
    return arr.slice(range === 'weekly' ? -8 : -6)
  }, [sorted, range])

  const W = 300
  const H = 110
  const minKg = Math.min(...points.map((p) => p.kg)) - 0.6
  const maxKg = Math.max(...points.map((p) => p.kg)) + 0.6
  const px = (i: number) => (points.length === 1 ? W / 2 : 14 + (i * (W - 28)) / (points.length - 1))
  const py = (v: number) => 8 + (1 - (v - minKg) / (maxKg - minKg || 1)) * (H - 16)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(p.kg).toFixed(1)}`).join(' ')
  const change = points.length >= 2 ? points[points.length - 1].kg - points[0].kg : 0
  const labelOf = (k: string) => (range === 'weekly' ? fmtShortDate(k) : fromISO(k + '-01').toLocaleString('en-GB', { month: 'short' }))
  const sel = hover ?? points.length - 1

  return (
    <section className="mt-6 rounded-3xl border border-line/80 bg-card p-4 shadow-soft" aria-label="Weight" data-testid="weight-card">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <Scale size={17} className="text-ink-soft" /> Weight <span className="text-[12px] font-medium text-ink-mute">· optional</span>
        </h2>
        {points.length > 0 && (
          <Segmented
            size="sm"
            className="w-[170px]"
            value={range}
            onChange={setRange}
            options={[
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
          />
        )}
      </div>

      {points.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">
          Logging weight is entirely optional. If you do, once a week at the same time of day is plenty — we’ll show the trend, not the daily ups and downs.
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-baseline gap-3">
            <p className="font-display text-[30px] font-medium tabular">
              {points[sel].kg.toFixed(1)}
              <span className="ml-1 font-sans text-sm font-semibold text-ink-mute">kg</span>
            </p>
            <p className="text-[13px] text-ink-mute">
              {hover !== null ? `${range === 'weekly' ? 'week of' : ''} ${labelOf(points[sel].key)}` : points.length >= 2 ? `${change >= 0 ? '+' : '−'}${Math.abs(change).toFixed(1)} kg over ${points.length} ${range === 'weekly' ? 'weeks' : 'months'}` : 'first entry'}
            </p>
          </div>
          <svg viewBox={`0 0 ${W} ${H + 18}`} className="mt-2 w-full overflow-visible" role="img" aria-label={`Weight trend, ${range}`}>
            {[0.25, 0.75].map((f) => (
              <line key={f} x1={0} x2={W} y1={8 + f * (H - 16)} y2={8 + f * (H - 16)} stroke="rgb(var(--line))" strokeWidth={1} />
            ))}
            <motion.path d={path} fill="none" stroke="rgb(var(--ink))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} key={range} />
            {points.map((p, i) => (
              <g key={p.key}>
                <circle cx={px(i)} cy={py(p.kg)} r={i === sel ? 5 : 4} fill={i === sel ? 'rgb(var(--clay))' : 'rgb(var(--ink))'} stroke="rgb(var(--card))" strokeWidth={2} />
                <rect x={px(i) - 18} y={0} width={36} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)} />
                {(i === 0 || i === points.length - 1) && (
                  <text x={px(i)} y={H + 14} textAnchor={i === 0 && points.length > 1 ? 'start' : 'end'} className="fill-ink-mute text-[10px] font-semibold">
                    {labelOf(p.key)}
                  </text>
                )}
              </g>
            ))}
          </svg>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-mute">
            {range === 'weekly' ? 'Each dot is a weekly average.' : 'Each dot is a monthly average.'} Bodies fluctuate with water, salt and sleep — the slow trend is what counts.
          </p>
        </>
      )}

      <Button variant={daysSinceLast < 6 ? 'secondary' : 'outline'} block className="mt-4" onClick={() => setOpen(true)}>
        <Plus size={16} /> {daysSinceLast < 6 ? `Logged ${daysSinceLast === 0 ? 'today' : `${daysSinceLast} day${daysSinceLast > 1 ? 's' : ''} ago`} · add anyway` : 'Log weight'}
      </Button>

      <AnimatePresence>
        {sorted.length > 0 && (
          <details className="mt-3 text-[13px]">
            <summary className="cursor-pointer select-none px-1 font-semibold text-ink-soft">All entries ({sorted.length})</summary>
            <ul className="mt-2 divide-y divide-line/70">
              {[...sorted].reverse().map((w) => (
                <li key={w.id} className="flex items-center justify-between py-2 pl-1">
                  <span className="text-ink-soft">{fmtShortDate(w.date)} {w.date.slice(0, 4)}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold tabular">{w.kg.toFixed(1)} kg</span>
                    <button onClick={() => deleteWeight(w.id)} className="grid h-8 w-8 place-items-center rounded-full text-ink-mute hover:bg-sand hover:text-ink" aria-label={`Delete entry from ${w.date}`}>
                      <Trash2 size={14} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </AnimatePresence>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Log weight"
        description="Once a week, same time of day, is plenty. No need to weigh daily."
        footer={
          <Button
            size="lg"
            block
            disabled={!kg || kg < 20 || kg > 300}
            onClick={() => {
              addWeight(member.userId, date, Number(kg))
              setOpen(false)
              toast({ text: 'Weight saved' })
            }}
          >
            Save
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3 pb-2">
          <Field label="Weight">
            <NumberInput value={kg} onChange={setKg} suffix="kg" step={0.1} />
          </Field>
          <Field label="Date">
            <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} />
          </Field>
        </div>
      </Sheet>
    </section>
  )
}
