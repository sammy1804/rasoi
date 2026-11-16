import { motion } from 'framer-motion'
import { ArrowLeftRight, ChevronDown, ChevronRight, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDay } from '@/app/DayContext'
import { SLOT_META } from '@/app/meta'
import { AddFoodSheet } from '@/components/AddFoodSheet'
import { Avatar } from '@/components/Avatar'
import { stepFor } from '@/components/LogSheet'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Sheet } from '@/components/ui/sheet'
import { Stepper } from '@/components/ui/stepper'
import { addPlanItem, allFoods, mealFor, removePlanItem, resetPlan, updatePlanItem } from '@/data/repository'
import type { DB, Food, HouseholdMember, Meal, MealItem, MealSlot, PortionStyle, Weekday } from '@/data/types'
import { MEAL_SLOTS } from '@/data/types'
import { useSession } from '@/hooks/useSession'
import { WEEKDAY_NAMES, fmtShortDate, todayISO, weekDates } from '@/lib/dates'
import { fmtQty } from '@/lib/format'
import { PORTION_LABEL, nutrientsFor, personalItems, portionFor } from '@/lib/nutrition'
import { cn, fmtNum } from '@/lib/utils'

export function WeekScreen() {
  const { db, member, members, household, nameOf } = useSession()
  const me = member!
  const navigate = useNavigate()
  const { setDate } = useDay()
  const [mode, setMode] = useState<'shared' | 'mine'>('mine')
  const [open, setOpen] = useState<{ day: Weekday; slot: MealSlot } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const toast = useToast()
  const dates = weekDates(todayISO())
  const today = todayISO()
  const todayRef = useRef<HTMLDivElement>(null)
  const foods = allFoods(db)

  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior })
    window.scrollBy({ top: -12 })
  }, [])

  return (
    <div className="px-4">
      <header className="pt-safe">
        <div className="pt-5">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-mute">{household?.name} · this week</p>
          <h1 className="mt-0.5 font-display text-[28px] font-medium tracking-tight">Weekly plan</h1>
          <p className="mt-1 text-[14px] text-ink-soft">
            {fmtShortDate(dates[0])} – {fmtShortDate(dates[6])} · one menu, {members.length > 1 ? 'two portion sizes' : 'your portions'}
          </p>
        </div>
        <Segmented
          className="mt-4"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'mine', label: 'My portions' },
            { value: 'shared', label: 'Shared menu' },
          ]}
        />
      </header>

      <div className="mt-5 space-y-4">
        {dates.map((d, i) => {
          const day = i as Weekday
          const isToday = d === today
          return (
            <motion.article
              key={d}
              ref={isToday ? todayRef : undefined}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.15) }}
              className={cn('scroll-mt-4 overflow-hidden rounded-3xl border bg-card shadow-soft', isToday ? 'border-ink/70' : 'border-line/80')}
              data-testid={`week-day-${i}`}
            >
              <button
                onClick={() => {
                  setDate(d)
                  navigate('/')
                }}
                className="flex w-full items-center justify-between px-4 pb-2 pt-3.5 text-left"
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-display text-[20px] font-medium">{WEEKDAY_NAMES[i]}</span>
                  <span className="text-[13px] text-ink-mute">{fmtShortDate(d)}</span>
                </span>
                {isToday ? (
                  <span className="rounded-full bg-clay px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">Today</span>
                ) : (
                  <span className="text-[12px] font-semibold text-ink-mute">Open day <ChevronRight size={12} className="inline" /></span>
                )}
              </button>
              <ul>
                {MEAL_SLOTS.map((slot) => {
                  const meal = mealFor(db, me.householdId, day, slot)
                  return (
                    <li key={slot} className="border-t border-line/60">
                      <button onClick={() => setOpen({ day, slot })} className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-sand/40" aria-label={`Edit ${WEEKDAY_NAMES[i]} ${SLOT_META[slot].label}`}>
                        <span className="mt-[3px] flex w-[84px] shrink-0 items-center gap-1.5">
                          <span className={cn('h-2 w-2 shrink-0 rounded-full', SLOT_META[slot].dot)} />
                          <span className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">{SLOT_META[slot].label}</span>
                        </span>
                        <span className="min-w-0 flex-1 text-[14px] leading-relaxed">
                          <MealSummary meal={meal} mode={mode} member={me} db={db} date={d} />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </motion.article>
          )
        })}
      </div>

      <div className="mt-6 flex justify-center">
        <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
          <RotateCcw size={14} /> Reset to the original plan
        </Button>
      </div>

      {open && (
        <MealPlanSheet
          meal={mealFor(db, me.householdId, open.day, open.slot)}
          title={`${WEEKDAY_NAMES[open.day]} · ${SLOT_META[open.slot].label}`}
          onClose={() => setOpen(null)}
          members={members}
          nameOf={nameOf}
          foods={foods}
          me={me}
        />
      )}

      <Sheet
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset the weekly plan?"
        description="This restores the original 7-day rotation for everyone in the household. Your food logs stay as they are."
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="lg" block onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              size="lg"
              block
              onClick={() => {
                resetPlan(me.householdId)
                setConfirmReset(false)
                toast({ text: 'Plan reset to the original rotation' })
              }}
            >
              Reset plan
            </Button>
          </div>
        }
      >
        <span />
      </Sheet>
    </div>
  )
}

function MealSummary({ meal, mode, member, db, date }: { meal?: Meal; mode: 'shared' | 'mine'; member: HouseholdMember; db: DB; date: string }) {
  const foods = allFoods(db)
  if (!meal || meal.items.length === 0) return <span className="text-ink-mute">Nothing planned — tap to add</span>
  if (mode === 'shared') {
    const parts = meal.items
      .filter((it) => !it.onlyFor)
      .map((it) => {
        const names = [it.foodId, ...(it.alts?.map((a) => a.foodId) ?? [])].map((id) => foods[id]?.name ?? id)
        return { label: names.join(' or '), optional: it.optional }
      })
    const addOns = meal.items.filter((it) => it.onlyFor).length
    return (
      <>
        {parts.map((p, i) => (
          <span key={i} className={cn(p.optional && 'text-ink-mute')}>
            {p.label}
            {p.optional ? ' (optional)' : ''}
            {i < parts.length - 1 ? <span className="text-ink-mute"> · </span> : null}
          </span>
        ))}
        {addOns > 0 && <span className="text-ink-mute"> · +{addOns} personal add-on{addOns > 1 ? 's' : ''}</span>}
      </>
    )
  }
  const items = personalItems(meal, member, date, foods, (id) => db.choices[`${member.userId}|${date}|${id}`]?.altIndex ?? -1)
  const kcal = items.filter((r) => !r.optional).reduce((s, r) => s + nutrientsFor(r.food, r.portion.amount, r.portion.unit).kcal, 0)
  return (
    <>
      {items.map((r, i) => (
        <span key={r.item.id} className={cn(r.optional && 'text-ink-mute')}>
          {r.food.name} <span className="text-ink-mute">{fmtQty(r.food, r.portion.amount, r.portion.unit)}</span>
          {r.item.alts?.length ? <ArrowLeftRight size={11} className="ml-0.5 inline text-ink-mute" /> : null}
          {i < items.length - 1 ? <span className="text-ink-mute"> · </span> : null}
        </span>
      ))}
      <span className="mt-0.5 block text-[12px] text-ink-mute tabular">≈ {fmtNum(kcal)} kcal</span>
    </>
  )
}

const STYLE_ORDER: PortionStyle[] = ['lighter', 'standard', 'hearty']

function MealPlanSheet({
  meal,
  title,
  onClose,
  members,
  nameOf,
  foods,
  me,
}: {
  meal?: Meal
  title: string
  onClose: () => void
  members: HouseholdMember[]
  nameOf: (id: string) => string
  foods: Record<string, Food>
  me: HouseholdMember
}) {
  const [open, setOpen] = useState(true)
  const [adding, setAdding] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const toast = useToast()
  const close = () => {
    setOpen(false)
    setTimeout(onClose, 250)
  }
  const styles = useMemo(() => {
    const s = new Set(members.map((m) => m.profile.portionStyle))
    return STYLE_ORDER.filter((x) => s.has(x))
  }, [members])

  if (!meal) return null

  return (
    <>
      <Sheet open={open && !adding} onOpenChange={(o) => !o && close()} title={title} description="Shared by the whole household. Portions adjust to each person.">
        <ul className="space-y-2">
          {meal.items.map((it) => (
            <PlanItemRow
              key={it.id}
              item={it}
              meal={meal}
              foods={foods}
              members={members}
              nameOf={nameOf}
              styles={styles}
              expanded={expanded === it.id}
              onToggle={() => setExpanded(expanded === it.id ? null : it.id)}
              onRemove={() => {
                removePlanItem(meal.id, it.id)
                toast({
                  text: `Removed ${foods[it.foodId]?.name ?? 'item'} from the plan`,
                  action: { label: 'Undo', onClick: () => addPlanItem(meal.id, { foodId: it.foodId, lighter: it.lighter, hearty: it.hearty, standard: it.standard }, { alts: it.alts, optional: it.optional, onlyFor: it.onlyFor }) },
                })
              }}
            />
          ))}
        </ul>
        {meal.items.length === 0 && <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-mute">No items yet.</p>}
        <Button variant="outline" block className="mt-4" onClick={() => setAdding(true)}>
          <Plus size={16} /> Add a dish to this meal
        </Button>
        <p className="mt-3 text-center text-[12px] text-ink-mute">Changes apply to every week, for everyone.</p>
      </Sheet>
      <AddFoodSheet
        open={adding}
        onOpenChange={(o) => !o && setAdding(false)}
        member={me}
        showSlot={false}
        title="Add to plan"
        confirmLabel="Add to plan"
        onAdd={({ food, amount, unit }) => {
          const st = stepFor(unit)
          const hearty = Math.max(st, Math.round((amount * 1.25) / st) * st)
          addPlanItem(meal.id, { foodId: food.id, lighter: { amount, unit }, hearty: { amount: hearty, unit } })
          toast({ text: `Added ${food.name} to the plan` })
          setAdding(false)
        }}
      />
    </>
  )
}

function PlanItemRow({
  item,
  meal,
  foods,
  members,
  nameOf,
  styles,
  expanded,
  onToggle,
  onRemove,
}: {
  item: MealItem
  meal: Meal
  foods: Record<string, Food>
  members: HouseholdMember[]
  nameOf: (id: string) => string
  styles: PortionStyle[]
  expanded: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  const food = foods[item.foodId]
  if (!food) return null
  const altNames = item.alts?.map((a) => foods[a.foodId]?.name).filter(Boolean)
  const visibleTo = members.filter((m) => !item.onlyFor || m.profile.portionStyle === item.onlyFor)
  return (
    <li className="rounded-2xl border border-line bg-card">
      <button onClick={onToggle} className="flex w-full items-start gap-3 p-3.5 text-left" aria-expanded={expanded}>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">
            {food.name}
            {item.optional && <span className="ml-1.5 text-[12px] font-medium text-ink-mute">optional</span>}
          </span>
          {altNames?.length ? <span className="block text-[12px] text-ink-mute">or {altNames.join(' or ')}</span> : null}
          {item.onlyFor && <span className="block text-[12px] text-clay-deep">Personal add-on · {PORTION_LABEL[item.onlyFor].toLowerCase()}</span>}
          <span className="mt-2 flex flex-wrap gap-1.5">
            {visibleTo.map((m) => {
              const p = portionFor(item, m.profile.portionStyle)
              const f = foods[p.foodId ?? item.foodId] ?? food
              return (
                <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-sand py-0.5 pl-0.5 pr-2.5 text-[12px] font-semibold text-ink-soft">
                  <Avatar name={nameOf(m.userId)} hue={m.hue} size={20} />
                  {fmtQty(f, p.amount, p.unit ?? f.defaultUnit)}
                  {f.id !== food.id ? ` ${f.name.toLowerCase()}` : ''}
                </span>
              )
            })}
          </span>
        </span>
        <ChevronDown size={18} className={cn('mt-1 shrink-0 text-ink-mute transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-line/70 p-3.5">
          {styles.map((style) => {
            const key = style
            const p = portionFor(item, style)
            const unit = p.unit ?? food.defaultUnit
            const who = members.filter((m) => m.profile.portionStyle === style).map((m) => nameOf(m.userId))
            return (
              <div key={key}>
                <p className="mb-1.5 text-[12px] font-semibold text-ink-soft">
                  {PORTION_LABEL[style]} <span className="font-medium text-ink-mute">· {who.join(', ')}</span>
                </p>
                <Stepper
                  value={p.amount}
                  step={stepFor(unit)}
                  min={stepFor(unit)}
                  max={unit === 'g' || unit === 'ml' ? 1000 : 10}
                  format={(v) => fmtQty(food, v, unit)}
                  label={`${PORTION_LABEL[style]} portion`}
                  onChange={(v) => {
                    const portion = { ...p, amount: v, unit, range: undefined }
                    updatePlanItem(meal.id, item.id, style === 'standard' ? { standard: portion } : { [style]: portion })
                  }}
                />
              </div>
            )
          })}
          <p className="text-[12px] text-ink-mute">≈ {fmtNum(nutrientsFor(food, food.defaultAmount, food.defaultUnit).kcal)} kcal per {fmtQty(food, food.defaultAmount, food.defaultUnit)}</p>
          <Button variant="danger" size="sm" onClick={onRemove}>
            <Trash2 size={14} /> Remove from plan
          </Button>
        </div>
      )}
    </li>
  )
}

