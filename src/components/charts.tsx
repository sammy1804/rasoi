import { motion } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { SLOT_META } from '@/app/meta'
import { MEAL_SLOTS } from '@/data/types'
import { WEEKDAY_SHORT } from '@/lib/dates'
import { cn, fmtNum } from '@/lib/utils'

/**
 * Small, single-purpose charts. One axis each, thin marks with 4px rounded ends,
 * tap or hover a mark to read its value in the header.
 */

export function ChartCard({ title, readout, children, footer, testId }: { title: string; readout?: ReactNode; children: ReactNode; footer?: ReactNode; testId?: string }) {
  return (
    <section className="rounded-3xl border border-line/80 bg-card p-4 shadow-soft" aria-label={title} data-testid={testId}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-ink-mute">{title}</h2>
        {readout && <span className="text-right text-[12px] text-ink-mute tabular">{readout}</span>}
      </div>
      {children}
      {footer && <div className="mt-3 text-[12px] leading-relaxed text-ink-mute">{footer}</div>}
    </section>
  )
}

/* ——————————— Daily bars against a target ——————————— */

export function DailyBars({
  title,
  days,
  target,
  marker,
  band,
  targets,
  unit,
  barClass = 'bg-chart-1',
  testId,
  footer,
}: {
  title: string
  days: { value: number; logged: boolean }[]
  target: number
  /** a dashed reference line (e.g. protein minimum) */
  marker?: number
  /** shaded "in range" band, e.g. [0.9, 1.1] × target */
  band?: [number, number]
  /** a different target for each day (drawn as a tick over each bar); replaces the band and dashed line */
  targets?: number[]
  unit: string
  barClass?: string
  testId?: string
  footer?: ReactNode
}) {
  const [sel, setSel] = useState<number | null>(null)
  const H = 120
  const max = Math.max(target * 1.2, ...(targets ?? []).map((t) => t * 1.12), ...days.map((d) => d.value))
  const y = (v: number) => H - (v / max) * H
  const ref = marker ?? target
  return (
    <ChartCard
      title={title}
      testId={testId}
      footer={footer}
      readout={
        sel !== null && days[sel].logged ? (
          <>
            <b className="text-ink">{WEEKDAY_SHORT[sel]}</b> · {fmtNum(days[sel].value)} {unit}
            {targets ? ` of ${fmtNum(targets[sel])}` : ''}
          </>
        ) : targets ? (
          'line over each bar = that day’s target'
        ) : band ? (
          `band = target ±10%`
        ) : (
          `dashed = ${fmtNum(ref)} ${unit}`
        )
      }
    >
      <div className="relative mt-3" style={{ height: H + 22 }}>
        {band && !targets && <div className="absolute inset-x-0 bg-meal-lunch/25" style={{ top: y(target * band[1]), height: y(target * band[0]) - y(target * band[1]) }} />}
        {!targets && <div className="absolute inset-x-0 border-t border-dashed border-ink-mute/60" style={{ top: y(ref) }} />}
        <div className="absolute inset-x-0 border-t border-line" style={{ top: H }} />
        <div className="absolute inset-0 grid grid-cols-7 gap-2">
          {days.map((d, i) => {
            const h = d.logged ? Math.max(3, (d.value / max) * H) : 0
            const hit = targets ? d.value >= targets[i] * 0.9 && d.value <= targets[i] * 1.1 : band ? d.value >= target * band[0] && d.value <= target * band[1] : d.value >= ref
            return (
              <button
                key={i}
                className="relative flex flex-col items-center justify-end rounded-lg focus-ring"
                style={{ height: H + 22 }}
                onClick={() => setSel(sel === i ? null : i)}
                onMouseEnter={() => setSel(i)}
                onMouseLeave={() => setSel(null)}
                aria-label={`${WEEKDAY_SHORT[i]}: ${d.logged ? `${fmtNum(d.value)} ${unit}` : 'not logged'}`}
              >
                <span className="relative flex w-full justify-center" style={{ height: H }}>
                  <motion.span
                    className={cn('absolute bottom-0 w-[60%] max-w-[22px] rounded-t-[4px]', barClass, !hit && 'opacity-45', sel === i && 'ring-2 ring-ink/25')}
                    initial={{ height: 0 }}
                    animate={{ height: h }}
                    transition={{ delay: i * 0.03, type: 'spring', stiffness: 160, damping: 22 }}
                  />
                  {targets && d.logged && <span className="absolute left-[8%] right-[8%] h-[2px] rounded-full bg-ink" style={{ top: y(targets[i]) - 1 }} />}
                </span>
                <span className={cn('mt-1.5 text-[11px] font-semibold', sel === i ? 'text-ink' : 'text-ink-mute')}>{WEEKDAY_SHORT[i].charAt(0)}</span>
              </button>
            )
          })}
        </div>
      </div>
    </ChartCard>
  )
}

/* ——————————— Meal completion grid ——————————— */

export function MealGrid({ grid }: { grid: (0 | 1 | 2 | null)[][] }) {
  const [sel, setSel] = useState<[number, number] | null>(null)
  const label = (v: 0 | 1 | 2 | null) => (v === 2 ? 'done' : v === 1 ? 'partly' : v === 0 ? 'nothing logged' : 'still ahead')
  return (
    <ChartCard
      title="Meals this week"
      testId="chart-meals"
      readout={sel ? `${WEEKDAY_SHORT[sel[0]]} ${SLOT_META[MEAL_SLOTS[sel[1]]].label.toLowerCase()} · ${label(grid[sel[0]][sel[1]])}` : undefined}
      footer={
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <Key className="bg-chart-1">Done</Key>
          <Key className="bg-chart-1/40">Partly</Key>
          <Key className="border border-line bg-sand">Nothing logged</Key>
        </span>
      }
    >
      <div className="mt-3 grid grid-cols-[64px_repeat(7,minmax(0,1fr))] items-center gap-1">
        <span />
        {WEEKDAY_SHORT.map((d) => (
          <span key={d} className="text-center text-[11px] font-semibold text-ink-mute">
            {d.charAt(0)}
          </span>
        ))}
        {MEAL_SLOTS.map((slot, si) => (
          <Row key={slot} label={SLOT_META[slot].label}>
            {grid.map((day, di) => {
              const v = day[si]
              return (
                <button
                  key={di}
                  onClick={() => setSel(sel && sel[0] === di && sel[1] === si ? null : [di, si])}
                  onMouseEnter={() => setSel([di, si])}
                  onMouseLeave={() => setSel(null)}
                  aria-label={`${WEEKDAY_SHORT[di]} ${SLOT_META[slot].label}: ${label(v)}`}
                  className={cn(
                    'aspect-square w-full max-w-[34px] justify-self-center rounded-[6px] transition focus-ring',
                    v === 2 && 'bg-chart-1',
                    v === 1 && 'bg-chart-1/40',
                    v === 0 && 'border border-line bg-sand',
                    v === null && 'border border-dashed border-line',
                  )}
                />
              )
            })}
          </Row>
        ))}
      </div>
    </ChartCard>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span className="truncate text-[12px] font-semibold text-ink-soft">{label}</span>
      {children}
    </>
  )
}

function Key({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2.5 w-2.5 rounded-[3px]', className)} />
      {children}
    </span>
  )
}

/* ——————————— Where calories come from ——————————— */

export function MacroBar({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const parts = [
    { key: 'Protein', kcal: protein * 4, g: protein, cls: 'bg-chart-1' },
    { key: 'Carbs', kcal: carbs * 4, g: carbs, cls: 'bg-chart-2' },
    { key: 'Fat', kcal: fat * 9, g: fat, cls: 'bg-chart-3' },
  ]
  const total = parts.reduce((s, p) => s + p.kcal, 0) || 1
  return (
    <ChartCard title="Where calories come from" testId="chart-macros" footer="Daily average on logged days. Protein and carbs have about 4 kcal per gram, fat about 9.">
      <div className="mt-3 flex h-4 gap-[2px] overflow-hidden rounded-[4px]">
        {parts.map((p) => (
          <motion.span key={p.key} className={p.cls} initial={{ width: 0 }} animate={{ width: `${(p.kcal / total) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {parts.map((p) => (
          <div key={p.key}>
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft">
              <span className={cn('h-2.5 w-2.5 rounded-[3px]', p.cls)} /> {p.key}
            </p>
            <p className="mt-0.5 font-display text-[22px] font-medium leading-none tabular">{Math.round((p.kcal / total) * 100)}%</p>
            <p className="text-[12px] text-ink-mute tabular">{Math.round(p.g)} g / day</p>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

/* ——————————— Line chart (one or two series, one axis) ——————————— */

export interface Series {
  name: string
  values: (number | null)[]
  /** CSS colour, e.g. 'rgb(var(--c1))' */
  color: string
}

export function LineChart({
  title,
  labels,
  series,
  refLine,
  refLabel,
  format,
  testId,
  footer,
}: {
  title: string
  labels: string[]
  series: Series[]
  refLine?: number
  refLabel?: string
  format: (v: number) => string
  testId?: string
  footer?: ReactNode
}) {
  const [sel, setSel] = useState<number | null>(null)
  const W = 300
  const H = 120
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null))
  const max = Math.max(refLine ?? 0, ...all, 1) * 1.15
  const n = labels.length
  const px = (i: number) => (n === 1 ? W / 2 : 16 + (i * (W - 32)) / (n - 1))
  const py = (v: number) => 8 + (1 - v / max) * (H - 16)
  const readout =
    sel !== null ? (
      <>
        <b className="text-ink">{labels[sel]}</b> · {series.map((s) => `${series.length > 1 ? s.name + ' ' : ''}${s.values[sel] === null ? '—' : format(s.values[sel] as number)}`).join(' · ')}
      </>
    ) : refLabel ? (
      `dashed = ${refLabel}`
    ) : undefined
  return (
    <ChartCard
      title={title}
      readout={readout}
      testId={testId}
      footer={
        <>
          {series.length > 1 && (
            <span className="mb-1 flex flex-wrap gap-x-4">
              {series.map((s) => (
                <span key={s.name} className="inline-flex items-center gap-1.5 font-semibold text-ink-soft">
                  <span className="h-[3px] w-4 rounded-full" style={{ background: s.color }} /> {s.name}
                </span>
              ))}
            </span>
          )}
          {footer}
        </>
      }
    >
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="mt-3 w-full overflow-visible" role="img" aria-label={title}>
        {refLine !== undefined && <line x1={0} x2={W} y1={py(refLine)} y2={py(refLine)} stroke="rgb(var(--ink-mute))" strokeOpacity={0.6} strokeDasharray="4 4" strokeWidth={1} />}
        <line x1={0} x2={W} y1={H - 8} y2={H - 8} stroke="rgb(var(--line))" strokeWidth={1} />
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : ([px(i), py(v)] as const)))
          let d = ''
          pts.forEach((p, i) => {
            if (!p) return
            d += `${d && pts[i - 1] ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)} `
          })
          return (
            <g key={s.name}>
              <motion.path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
              {pts.map((p, i) => (p ? <circle key={i} cx={p[0]} cy={p[1]} r={sel === i ? 5 : 4} fill={s.color} stroke="rgb(var(--card))" strokeWidth={2} /> : null))}
            </g>
          )
        })}
        {labels.map((l, i) => (
          <g key={l + i}>
            <rect x={px(i) - W / n / 2} y={0} width={W / n} height={H} fill="transparent" onMouseEnter={() => setSel(i)} onMouseLeave={() => setSel(null)} onClick={() => setSel(sel === i ? null : i)} />
            <text x={px(i)} y={H + 12} textAnchor="middle" className="fill-ink-mute text-[10px] font-semibold">
              {l}
            </text>
          </g>
        ))}
      </svg>
    </ChartCard>
  )
}
