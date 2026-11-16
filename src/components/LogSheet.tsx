import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeftRight, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { SLOT_META } from '@/app/meta'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Sheet } from '@/components/ui/sheet'
import { Stepper } from '@/components/ui/stepper'
import { allFoods, clearPlanLog, deleteLog, setChoice, upsertLog } from '@/data/repository'
import { useStore } from '@/data/store'
import type { Food, FoodLog, HouseholdMember, ISODate, LogStatus, MealSlot } from '@/data/types'
import { fmtG, fmtQty, fmtRange } from '@/lib/format'
import { nutrientsFor, portionFor } from '@/lib/nutrition'
import type { PlannedRow } from '@/lib/summary'
import { cn, fmtAmount, fmtNum } from '@/lib/utils'
import { useToast } from './Toast'

export type LogTarget =
  | { kind: 'planned'; row: PlannedRow; slot: MealSlot; date: ISODate }
  | { kind: 'log'; log: FoodLog }

type S = LogStatus | 'planned'

/** Friendly quantity presets around a planned amount: ½ / 1 / 1½ / 2 cups, not 0.4 / 1.1. */
export function presetAmounts(base: number, unit: string): number[] {
  if (unit === 'g' || unit === 'ml') return [0.5, 1, 1.5, 2].map((k) => Math.max(5, Math.round((base * k) / 5) * 5))
  const set = base <= 2 ? [0.5, 1, 1.5, 2, base] : [base - 1, base, base + 1, base + 2]
  return [...new Set(set.map((x) => Math.round(x * 100) / 100))].filter((x) => x > 0).sort((a, b) => a - b)
}

export function stepFor(unit: string): number {
  if (unit === 'g' || unit === 'ml') return 10
  if (unit === 'tsp' || unit === 'tbsp' || unit === 'nut') return 1
  return 0.25
}

export function LogSheet({
  target: targetProp,
  member,
  onClose,
}: {
  target: LogTarget | null
  member: HouseholdMember
  onClose: () => void
}) {
  const { db } = useStore()
  const foods = allFoods(db)
  const toast = useToast()
  const open = !!targetProp
  // keep rendering the last target while the sheet animates closed
  const [held, setHeld] = useState<LogTarget | null>(targetProp)
  useEffect(() => {
    if (targetProp) setHeld(targetProp)
  }, [targetProp])
  const target = targetProp ?? held

  const log = target?.kind === 'log' ? target.log : target?.row.log
  const planned = target?.kind === 'planned' ? target.row : undefined
  const food: Food | undefined = target ? foods[target.kind === 'log' ? target.log.foodId : target.row.food.id] : undefined
  const baseAmount = planned ? planned.portion.amount : (log?.amount ?? 1)
  const baseUnit = planned ? planned.portion.unit : (log?.unit ?? food?.defaultUnit ?? 'g')

  const [status, setStatus] = useState<S>('eaten')
  const [amount, setAmount] = useState(1)
  const [unit, setUnit] = useState('g')
  const [fraction, setFraction] = useState(1)
  const [customQty, setCustomQty] = useState(false)
  const [customPct, setCustomPct] = useState(false)

  // reset local state whenever a new target opens
  const key = target ? (target.kind === 'log' ? target.log.id : `${target.row.item.id}|${target.row.food.id}`) : ''
  useEffect(() => {
    if (!target || !targetProp) return
    setStatus(log ? log.status : 'eaten')
    setAmount(log ? log.amount : baseAmount)
    setUnit(log ? log.unit : baseUnit)
    const f = log ? log.fraction : 1
    setFraction(log?.status === 'partial' ? f : 1)
    setCustomQty(log ? !(log.unit === baseUnit && presetAmounts(baseAmount, baseUnit).some((a) => Math.abs(log.amount - a) < 1e-6)) : false)
    setCustomPct(log?.status === 'partial' ? ![0.25, 0.5, 0.75, 1].includes(f) : false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, !!targetProp])

  const effFraction = status === 'partial' ? fraction : status === 'skipped' ? 0 : 1
  const n = useMemo(() => (food ? nutrientsFor(food, amount, unit, effFraction) : null), [food, amount, unit, effFraction])

  if (!food) return <Sheet open={false} onOpenChange={() => {}} title="" children={null} />

  const slot = target?.kind === 'log' ? target.log.slot : target?.slot
  const date = target?.kind === 'log' ? target.log.date : target?.date

  const save = () => {
    if (!target || !slot || !date) return
    if (status === 'planned') {
      if (planned) clearPlanLog(member.userId, date, planned.item.id)
      onClose()
      return
    }
    upsertLog(
      {
        householdId: member.householdId,
        userId: member.userId,
        date,
        slot,
        foodId: food.id,
        amount,
        unit,
        status: status === 'partial' && fraction >= 1 ? 'eaten' : status,
        fraction: status === 'partial' ? fraction : 1,
        mealItemId: planned?.item.id ?? log?.mealItemId,
      },
      log?.id,
    )
    onClose()
  }

  const remove = () => {
    if (!log) return
    const copy = log
    deleteLog(log.id)
    onClose()
    toast({
      text: `Removed ${food.name}`,
      action: {
        label: 'Undo',
        onClick: () =>
          upsertLog({
            householdId: copy.householdId,
            userId: copy.userId,
            date: copy.date,
            slot: copy.slot,
            foodId: copy.foodId,
            amount: copy.amount,
            unit: copy.unit,
            status: copy.status,
            fraction: copy.fraction,
            mealItemId: copy.mealItemId,
          }),
      },
    })
  }

  const swapTo = (altIndex: number) => {
    if (!planned || !date || !slot) return
    setChoice(member.userId, date, planned.item.id, altIndex)
    const spec = altIndex === -1 ? planned.item : planned.item.alts![altIndex]
    const p = portionFor(spec, member.profile.portionStyle)
    const newFood = foods[p.foodId ?? spec.foodId]
    if (log && newFood) {
      upsertLog(
        {
          householdId: member.householdId,
          userId: member.userId,
          date,
          slot,
          foodId: newFood.id,
          amount: p.amount,
          unit: p.unit ?? newFood.defaultUnit,
          status: log.status,
          fraction: log.fraction,
          mealItemId: planned.item.id,
        },
        log.id,
      )
    }
    onClose()
    toast({ text: `Swapped to ${newFood?.name ?? 'alternative'}` })
  }

  const presets = presetAmounts(baseAmount, baseUnit).map((a) => ({ k: a, amount: a }))
  const alts = planned?.item.alts?.length ? [planned.item as { foodId: string }, ...planned.item.alts] : []

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={food.name}
      description={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {slot && (
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', SLOT_META[slot].dot)} />
              {SLOT_META[slot].label}
            </span>
          )}
          {planned && (
            <>
              <span className="text-ink-mute">·</span>
              <span>
                Planned {fmtQty(food, planned.portion.amount, planned.portion.unit)}
                {planned.portion.hint ? ` (${planned.portion.hint})` : ''}
                {planned.portion.range && planned.portion.range[0] !== planned.portion.range[1] ? ` · aim ${fmtRange(food, planned.portion.range, planned.portion.unit)}` : ''}
              </span>
            </>
          )}
        </span>
      }
      footer={
        <div className="flex gap-2">
          {target?.kind === 'log' && !planned && (
            <Button variant="danger" size="lg" className="w-14 px-0" onClick={remove} aria-label="Remove entry">
              <Trash2 size={18} />
            </Button>
          )}
          <Button size="lg" block onClick={save}>
            {status === 'planned' ? 'Mark as not eaten yet' : 'Save'}
          </Button>
        </div>
      }
    >
      {alts.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft">
            <ArrowLeftRight size={14} /> Swap
          </p>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {alts.map((a, i) => {
              const spec = i === 0 ? planned!.item : planned!.item.alts![i - 1]
              const p = portionFor(spec, member.profile.portionStyle)
              const f = foods[p.foodId ?? a.foodId]
              const idx = i - 1
              return (
                <Chip key={i} active={planned!.altIndex === idx} onClick={() => planned!.altIndex !== idx && swapTo(idx)}>
                  {f?.name}
                </Chip>
              )
            })}
          </div>
        </div>
      )}

      {target?.kind === 'planned' && (
        <div className="mb-5">
          <p className="mb-2 text-[13px] font-semibold text-ink-soft">Did you have it?</p>
          <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-sand p-1">
            {(
              [
                ['planned', 'Not yet'],
                ['eaten', 'Eaten'],
                ['partial', 'Partly'],
                ['skipped', 'Skipped'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => {
                  setStatus(v)
                  if (v === 'partial' && fraction >= 1) setFraction(0.5)
                }}
                aria-pressed={status === v}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[12px] font-semibold transition focus-ring',
                  status === v ? 'bg-card text-ink shadow-soft' : 'text-ink-mute',
                )}
              >
                <MiniStatus s={v} />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence initial={false}>
        {(status === 'eaten' || status === 'partial') && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <p className="mb-2 text-[13px] font-semibold text-ink-soft">{planned ? 'Actual amount' : 'Amount'}</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <Chip
                  key={p.k}
                  active={!customQty && unit === baseUnit && Math.abs(amount - p.amount) < 1e-6}
                  onClick={() => {
                    setCustomQty(false)
                    setUnit(baseUnit)
                    setAmount(p.amount)
                  }}
                >
                  {fmtQty(food, p.amount, baseUnit)}
                </Chip>
              ))}
              <Chip active={customQty} onClick={() => setCustomQty(true)}>
                Custom
              </Chip>
            </div>
            {customQty && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 space-y-2">
                <Stepper value={amount} onChange={setAmount} step={stepFor(unit)} min={stepFor(unit)} max={unit === 'g' || unit === 'ml' ? 2000 : 20} format={(v) => fmtQty(food, v, unit)} label="amount" />
                {food.units.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {food.units.map((u) => (
                      <button
                        key={u.name}
                        onClick={() => {
                          // convert so the weight stays roughly the same
                          const grams = food.units.find((x) => x.name === unit)!.grams * amount
                          const next = Math.max(stepFor(u.name), Math.round((grams / u.grams) / stepFor(u.name)) * stepFor(u.name))
                          setUnit(u.name)
                          setAmount(next)
                        }}
                        className={cn('rounded-full px-3 py-1.5 text-[12px] font-semibold transition', unit === u.name ? 'bg-ink text-paper' : 'bg-sand text-ink-soft')}
                      >
                        {u.label ?? u.name}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {status === 'partial' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <p className="mb-2 mt-5 text-[13px] font-semibold text-ink-soft">How much did you eat?</p>
            <div className="grid grid-cols-5 gap-1.5">
              {[0.25, 0.5, 0.75, 1].map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setCustomPct(false)
                    setFraction(f)
                  }}
                  className={cn(
                    'h-11 rounded-xl text-[14px] font-semibold tabular transition focus-ring',
                    !customPct && fraction === f ? 'bg-ink text-paper' : 'bg-sand text-ink-soft',
                  )}
                >
                  {f * 100}%
                </button>
              ))}
              <button
                onClick={() => setCustomPct(true)}
                className={cn('h-11 rounded-xl text-[13px] font-semibold transition focus-ring', customPct ? 'bg-ink text-paper' : 'bg-sand text-ink-soft')}
              >
                Custom
              </button>
            </div>
            {customPct && (
              <div className="mt-3">
                <Stepper value={Math.round(fraction * 100)} onChange={(v) => setFraction(v / 100)} step={5} min={5} max={100} format={(v) => `${v}%`} label="percentage" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {status !== 'planned' && n && (
        <div className="mt-6 rounded-2xl border border-line bg-card p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-semibold text-ink-soft">
              {status === 'skipped' ? 'Not counted' : `≈ ${fmtQty(food, amount * effFraction, unit)}`}
            </p>
            <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Estimate</span>
          </div>
          <div className="mt-2 flex items-baseline gap-4">
            <p className="font-display text-3xl font-medium tabular">
              {fmtNum(n.kcal)}
              <span className="ml-1 font-sans text-sm font-semibold text-ink-mute">kcal</span>
            </p>
            <p className="font-display text-3xl font-medium tabular">
              {n.protein < 10 ? fmtAmount(Math.round(n.protein * 2) / 2) : Math.round(n.protein)}
              <span className="ml-1 font-sans text-sm font-semibold text-ink-mute">g protein</span>
            </p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[12px] text-ink-soft">
            <span className="rounded-lg bg-sand/70 py-1.5">Carbs {fmtG(n.carbs)}</span>
            <span className="rounded-lg bg-sand/70 py-1.5">Fat {fmtG(n.fat)}</span>
            <span className="rounded-lg bg-sand/70 py-1.5">Fibre {fmtG(n.fibre)}</span>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-mute">Homemade food varies — these numbers are a helpful approximation, not an exact measurement.</p>
        </div>
      )}
    </Sheet>
  )
}

export function MiniStatus({ s }: { s: S }) {
  return (
    <span
      className={cn(
        'relative grid h-4 w-4 place-items-center overflow-hidden rounded-full border-[1.5px]',
        s === 'planned' && 'border-ink-mute',
        s === 'eaten' && 'border-ink bg-ink',
        s === 'partial' && 'border-ink',
        s === 'skipped' && 'border-ink-mute bg-sand',
      )}
      aria-hidden
    >
      {s === 'eaten' && (
        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5">
          <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="rgb(var(--paper))" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {s === 'partial' && <span className="absolute inset-y-0 left-0 w-1/2 bg-ink" />}
      {s === 'skipped' && (
        <svg viewBox="0 0 24 24" className="h-2 w-2 text-ink-mute">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
        </svg>
      )}
    </span>
  )
}
