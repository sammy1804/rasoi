import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { ArrowLeftRight, Check, Droplet, Eye, Lock, Minus, Pencil, Plus, Sparkles, UserPlus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDay } from '@/app/DayContext'
import { SLOT_META, hueOf, slotForNow } from '@/app/meta'
import { AddFoodSheet } from '@/components/AddFoodSheet'
import { Avatar } from '@/components/Avatar'
import { DayStrip } from '@/components/DayStrip'
import { LogSheet, MiniStatus, type LogTarget } from '@/components/LogSheet'
import { StatusCheck } from '@/components/StatusCheck'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress'
import { allFoods, clearPlanLog, markTip, setWater, upsertLog } from '@/data/repository'
import type { FoodLog, HouseholdMember, ISODate, MealSlot } from '@/data/types'
import { useSession } from '@/hooks/useSession'
import { addDays, fmtLongDate, relativeDayLabel, todayISO, weekDates } from '@/lib/dates'
import { fmtQty, fmtRange } from '@/lib/format'
import { PORTION_LABEL, nutrientsFor, rampWeekLabel } from '@/lib/nutrition'
import { dayInsights, dayView, type DayView, type PlannedRow, type SlotView } from '@/lib/summary'
import { cn, fmtAmount, fmtNum } from '@/lib/utils'

export function HomeScreen() {
  const s = useSession()
  const { db, member, partner, nameOf, household } = s
  const { date, setDate, viewUserId, setViewUserId } = useDay()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [dir, setDir] = useState(0)
  const [target, setTarget] = useState<LogTarget | null>(null)
  const [adding, setAdding] = useState<{ slot?: MealSlot } | null>(null)

  const me = member!
  const viewing: HouseholdMember = (viewUserId && partner && viewUserId === partner.userId ? partner : me) ?? me
  const isMine = viewing.userId === me.userId
  const view = useMemo(() => dayView(db, viewing, date), [db, viewing, date])

  // first visit after onboarding lands here with ?welcome=1
  useEffect(() => {
    if (params.get('welcome')) {
      setDate(todayISO())
      setViewUserId(null)
      params.delete('welcome')
      setParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const changeDay = (n: number) => {
    setDir(n)
    setDate(addDays(date, n))
  }
  const pickDay = (d: ISODate) => {
    setDir(d > date ? 1 : -1)
    setDate(d)
  }
  const dragging = useRef(false)
  const onDragEnd = (_: unknown, info: PanInfo) => {
    setTimeout(() => (dragging.current = false), 0)
    if (Math.abs(info.offset.x) < 70 || Math.abs(info.offset.y) > Math.abs(info.offset.x)) return
    changeDay(info.offset.x < 0 ? 1 : -1)
    if (!me.tips.swipe) markTip(me.id, 'swipe')
  }

  const tick = (row: PlannedRow, slot: MealSlot) => {
    if (!isMine) return
    if (row.log) {
      clearPlanLog(me.userId, date, row.item.id)
      return
    }
    const log = upsertLog({
      householdId: me.householdId,
      userId: me.userId,
      date,
      slot,
      foodId: row.food.id,
      amount: row.portion.amount,
      unit: row.portion.unit,
      status: 'eaten',
      mealItemId: row.item.id,
    })
    if (!me.tips.firstTick) {
      markTip(me.id, 'firstTick')
      toast({ text: `Nice — +${Math.round(log.nutrients.protein)} g protein, +${fmtNum(log.nutrients.kcal)} kcal added` })
    }
  }

  const weekMarks = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of weekDates(date)) m.set(d, d > todayISO() ? 0 : dayView(db, viewing, d).mealsDone)
    return m
  }, [db, viewing, date])

  const tipOrder = ['intro', 'plannedVsEaten', 'firstTick', 'sharing'] as const
  const activeTip = isMine && date === todayISO() ? tipOrder.find((t) => !me.tips[t]) : undefined
  const firstPlannedId = activeTip === 'firstTick' ? (view.slots.find((sl) => sl.slot === slotForNow())?.planned.find((r) => !r.log && !r.optional) ?? view.slots.flatMap((x) => x.planned).find((r) => !r.log && !r.optional))?.item.id : undefined

  const ramp = rampWeekLabel(viewing.profile, date)
  const viewingName = nameOf(viewing.userId)
  const sharing = viewing.sharing
  const showCalories = isMine || sharing.calories
  const showProtein = isMine || sharing.protein
  const showItems = isMine || sharing.fullLog
  const showCompletion = isMine || sharing.mealCompletion || sharing.fullLog

  return (
    <div className="px-4">
      <header className="pt-safe">
        <div className="flex items-end justify-between gap-3 pt-5">
          <div className="min-w-0">
            <p className={cn('text-[13px] font-semibold uppercase tracking-[0.14em]', date === todayISO() ? 'text-clay' : 'text-ink-mute')}>
              {relativeDayLabel(date)}
              {date !== todayISO() && (
                <button onClick={() => pickDay(todayISO())} className="ml-2 rounded-full bg-sand px-2 py-0.5 text-[11px] normal-case tracking-normal text-ink-soft hover:text-ink">
                  Back to today
                </button>
              )}
            </p>
            <h1 className="mt-0.5 truncate font-display text-[clamp(22px,7.2vw,27px)] font-medium leading-tight tracking-tight" data-testid="home-date">
              {fmtLongDate(date)}
            </h1>
          </div>
          <button onClick={() => navigate('/profile')} className="mb-1 flex shrink-0 -space-x-2 rounded-full focus-ring" aria-label={`${household?.name} household`}>
            {s.members.map((m) => (
              <Avatar key={m.id} name={nameOf(m.userId)} hue={m.hue} size={30} className="ring-2 ring-paper" />
            ))}
          </button>
        </div>
        <div className="-mx-1 mt-4">
          <DayStrip date={date} onChange={pickDay} marks={(d) => weekMarks.get(d) ?? 0} />
        </div>
      </header>

      {/* Person tabs */}
      <div className="mt-4 grid grid-cols-2 gap-2" role="tablist" aria-label="Whose tracker">
        <PersonTab
          member={me}
          name={nameOf(me.userId)}
          sub="You"
          active={isMine}
          view={isMine ? view : dayView(db, me, date)}
          onClick={() => setViewUserId(null)}
        />
        {partner ? (
          <PersonTab
            member={partner}
            name={nameOf(partner.userId)}
            active={!isMine}
            view={!isMine ? view : dayView(db, partner, date)}
            onClick={() => setViewUserId(partner.userId)}
          />
        ) : (
          <button
            onClick={() => navigate('/invite')}
            className="flex items-center gap-3 rounded-2xl border border-dashed border-line px-3 py-3 text-left transition hover:border-ink/30 focus-ring"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-sand text-ink-soft">
              <UserPlus size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold">Invite</span>
              <span className="block truncate text-[12px] text-ink-mute">your person</span>
            </span>
          </button>
        )}
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        dragDirectionLock
        onDragStart={() => (dragging.current = true)}
        onDragEnd={onDragEnd}
        onClickCapture={(e) => {
          if (dragging.current) {
            e.stopPropagation()
            e.preventDefault()
          }
        }}
        style={{ touchAction: 'pan-y' }}
      >
          <motion.div
            key={`${date}|${viewing.userId}`}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
          >
            {/* Targets */}
            <section className="mt-3 rounded-3xl border border-line/80 bg-card p-4 shadow-soft" aria-label="Today’s progress">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-ink-soft">
                  {isMine ? 'Your plan' : `${viewingName}’s plan`} · <span className="text-ink-mute">{PORTION_LABEL[viewing.profile.portionStyle]}</span>
                </p>
                {!isMine && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2 py-0.5 text-[11px] font-semibold text-ink-mute">
                    <Eye size={12} /> View only
                  </span>
                )}
              </div>
              {showCalories || showProtein ? (
                <div className="grid grid-cols-2 gap-5">
                  {showCalories ? (
                    <Metric label="Calories" value={view.totals.kcal} target={viewing.profile.calorieTarget} unit="kcal" testId="metric-kcal" />
                  ) : (
                    <Hidden label="Calories" />
                  )}
                  {showProtein ? (
                    <Metric label="Protein" value={view.totals.protein} target={viewing.profile.proteinTarget} marker={viewing.profile.proteinMin} unit="g" accent testId="metric-protein" />
                  ) : (
                    <Hidden label="Protein" />
                  )}
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-ink-mute">
                  <Lock size={14} /> {viewingName} keeps their numbers private.
                </p>
              )}
              {ramp && viewing.profile.breakfastRamp.enabled && (
                <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-mute">
                  <Sparkles size={12} className="text-meal-breakfast" /> {ramp}
                </p>
              )}
            </section>

            {activeTip && activeTip !== 'firstTick' && (
              <CoachCard
                tip={activeTip}
                memberName={nameOf(me.userId)}
                partnerName={partner ? nameOf(partner.userId) : undefined}
                style={PORTION_LABEL[me.profile.portionStyle].toLowerCase()}
                onDone={() => markTip(me.id, activeTip)}
                onInvite={() => navigate('/invite')}
                onSettings={() => {
                  markTip(me.id, activeTip)
                  navigate('/profile#sharing')
                }}
              />
            )}
            {activeTip === 'firstTick' && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-2 rounded-2xl bg-clay-soft px-4 py-3 text-[14px] text-clay-deep">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-clay text-clay-on">
                  <Check size={14} strokeWidth={3} />
                </span>
                <span className="flex-1 font-semibold">Tick something you’ve already eaten today</span>
                <button onClick={() => markTip(me.id, 'firstTick')} className="text-[12px] font-semibold opacity-70 hover:opacity-100">
                  Skip
                </button>
              </motion.div>
            )}

            {/* Meals */}
            {showItems ? (
              <div className="mt-5 space-y-6">
                {view.slots.map((sl) => (
                  <MealSection
                    key={sl.slot}
                    sl={sl}
                    readOnly={!isMine}
                    pulseId={firstPlannedId}
                    onTick={(r) => tick(r, sl.slot)}
                    onEdit={(r) => setTarget({ kind: 'planned', row: r, slot: sl.slot, date })}
                    onEditExtra={(l) => setTarget({ kind: 'log', log: l })}
                    onAdd={() => setAdding({ slot: sl.slot })}
                    foodsName={(id) => allFoods(db)[id]?.name ?? 'Food'}
                    db={db}
                  />
                ))}
              </div>
            ) : (
              <CompletionOnly view={view} name={viewingName} show={showCompletion} />
            )}

            {(isMine || showCalories || showProtein) && (
              <DailySummary view={view} member={viewing} isMine={isMine} showCalories={showCalories} showProtein={showProtein} />
            )}

            {isMine && !me.tips.swipe && (
              <p className="mt-4 text-center text-[12px] text-ink-mute">Tip: swipe left or right to move between days</p>
            )}
          </motion.div>
      </motion.div>

      {isMine && (
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setAdding({})}
          className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] right-[max(16px,calc(50vw-224px+16px))] z-20 flex h-14 items-center gap-2 rounded-full bg-ink pl-4 pr-5 text-[15px] font-semibold text-paper shadow-lift focus-ring"
          aria-label="Add food"
        >
          <Plus size={20} strokeWidth={2.5} /> Add food
        </motion.button>
      )}

      <LogSheet target={target} member={me} onClose={() => setTarget(null)} />
      <AddFoodSheet
        open={!!adding}
        onOpenChange={(o) => !o && setAdding(null)}
        member={me}
        defaultSlot={adding?.slot}
        onAdd={({ food, amount, unit, slot }) => {
          upsertLog({ householdId: me.householdId, userId: me.userId, date, slot, foodId: food.id, amount, unit, status: 'eaten' })
          toast({ text: `Added ${food.name} to ${SLOT_META[slot].label.toLowerCase()}` })
        }}
      />
    </div>
  )
}

/* ——————————————— Pieces ——————————————— */

function PersonTab({ member, name, sub, active, view, onClick }: { member: HouseholdMember; name: string; sub?: string; active: boolean; view: DayView; onClick: () => void }) {
  const h = hueOf(member.hue)
  const pct = member.profile.proteinTarget ? Math.min(1, view.totals.protein / member.profile.proteinTarget) : 0
  const canSeeProtein = !!sub || member.sharing.protein
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn('relative flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition focus-ring', active ? 'border-ink bg-card shadow-soft' : 'border-line bg-paper hover:border-ink/20')}
    >
      <Avatar name={name} hue={member.hue} size={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold leading-tight">
          {name}
          {sub && <span className="ml-1 hidden font-medium text-ink-mute min-[380px]:inline">· {sub}</span>}
        </span>
        {canSeeProtein ? (
          <span className="mt-1 flex items-center gap-2">
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-sand">
              <motion.span className="block h-full rounded-full" style={{ backgroundColor: h.solid }} initial={false} animate={{ width: `${pct * 100}%` }} />
            </span>
            <span className="text-[11px] font-semibold text-ink-mute tabular">
              {Math.round(view.totals.protein)}/{member.profile.proteinTarget} g
            </span>
          </span>
        ) : (
          <span className="mt-0.5 block text-[12px] text-ink-mute">{view.mealsDone}/4 meals</span>
        )}
      </span>
    </button>
  )
}

function Metric({ label, value, target, unit, marker, accent, testId }: { label: string; value: number; target: number; unit: string; marker?: number; accent?: boolean; testId?: string }) {
  return (
    <div data-testid={testId}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-mute">{label}</p>
      <p className="mt-1 whitespace-nowrap font-display tabular">
        <motion.span key={Math.round(value)} initial={{ opacity: 0.4, y: -3 }} animate={{ opacity: 1, y: 0 }} className="inline-block text-[28px] font-medium leading-none">
          {fmtNum(value)}
        </motion.span>
        <span className="ml-1 font-sans text-[13px] font-semibold text-ink-mute">
          / {fmtNum(target)} {unit}
        </span>
      </p>
      <ProgressBar value={value} max={target} marker={marker} className="mt-2.5" barClassName={accent ? 'bg-clay' : 'bg-ink'} />
    </div>
  )
}

function Hidden({ label }: { label: string }) {
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-mute">{label}</p>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-mute">
        <Lock size={13} /> Private
      </p>
    </div>
  )
}

function MealSection({
  sl,
  readOnly,
  pulseId,
  onTick,
  onEdit,
  onEditExtra,
  onAdd,
  foodsName,
  db,
}: {
  sl: SlotView
  readOnly: boolean
  pulseId?: string
  onTick: (r: PlannedRow) => void
  onEdit: (r: PlannedRow) => void
  onEditExtra: (l: FoodLog) => void
  onAdd: () => void
  foodsName: (id: string) => string
  db: ReturnType<typeof useSession>['db']
}) {
  const meta = SLOT_META[sl.slot]
  return (
    <section aria-label={meta.label} data-testid={`slot-${sl.slot}`}>
      <div className="mb-1 flex items-center gap-2 px-1">
        <span className={cn('h-2.5 w-2.5 rounded-full', meta.dot)} />
        <h2 className="text-[17px] font-semibold tracking-tight">{meta.label}</h2>
        <span className="text-[12px] text-ink-mute">{meta.time}</span>
        <span className="ml-auto flex items-center gap-2">
          <AnimatePresence initial={false}>
            {sl.done && (
              <motion.span
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold', meta.soft, meta.text)}
              >
                <Check size={12} strokeWidth={3} /> Done
              </motion.span>
            )}
          </AnimatePresence>
          <span className="text-[12px] font-semibold text-ink-mute tabular">
            {sl.markedCount}/{sl.requiredCount}
          </span>
        </span>
      </div>
      <ul className="overflow-hidden rounded-2xl border border-line/80 bg-card shadow-soft">
        {sl.planned.map((r) => (
          <ItemRow key={r.item.id} r={r} readOnly={readOnly} pulse={pulseId === r.item.id} onTick={() => onTick(r)} onEdit={() => onEdit(r)} />
        ))}
        {sl.extras.map((l) => (
          <ExtraRow key={l.id} log={l} name={foodsName(l.foodId)} readOnly={readOnly} onEdit={() => onEditExtra(l)} db={db} />
        ))}
        {!readOnly && (
          <li className="border-t border-line/60">
            <button onClick={onAdd} className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-ink-mute transition hover:text-ink">
              <Plus size={15} /> Add to {meta.label.toLowerCase()}
            </button>
          </li>
        )}
        {readOnly && sl.planned.length === 0 && sl.extras.length === 0 && <li className="px-4 py-3 text-sm text-ink-mute">Nothing planned</li>}
      </ul>
    </section>
  )
}

function ItemRow({ r, readOnly, pulse, onTick, onEdit }: { r: PlannedRow; readOnly: boolean; pulse?: boolean; onTick: () => void; onEdit: () => void }) {
  const status = r.log?.status ?? 'planned'
  const n = r.log ? r.log.nutrients : nutrientsFor(r.food, r.portion.amount, r.portion.unit)
  const plannedQty = fmtQty(r.food, r.portion.amount, r.portion.unit)
  const changed = r.log && (r.log.amount !== r.portion.amount || r.log.unit !== r.portion.unit || r.log.status === 'partial')
  const actualQty = r.log ? fmtQty(r.food, r.log.amount, r.log.unit) : ''
  return (
    <li className={cn('flex items-center gap-1 border-t border-line/60 pl-1.5 pr-2 first:border-t-0', r.optional && !r.log && 'bg-paper/60')}>
      <StatusCheck status={status} onClick={onTick} onLongPress={readOnly ? undefined : onEdit} disabled={readOnly} label={`${r.food.name}: ${status === 'planned' ? 'mark as eaten' : 'mark as not eaten'}`} pulse={pulse && status === 'planned'} />
      <button onClick={readOnly ? undefined : onEdit} disabled={readOnly} className="min-w-0 flex-1 py-2.5 pl-1 text-left disabled:cursor-default">
        <span className={cn('flex flex-wrap items-center gap-x-1.5 text-[15px] font-semibold leading-snug transition-colors', status === 'skipped' && 'text-ink-mute line-through decoration-ink-mute/50', status === 'eaten' && 'text-ink-soft')}>
          {r.food.name}
          {r.optional && <span className="rounded-full bg-sand px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-ink-mute">optional</span>}
          {r.item.alts?.length ? <ArrowLeftRight size={12} className="text-ink-mute" aria-label="has swaps" /> : null}
          {r.disliked && <span className="rounded-full bg-clay-soft px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-clay-deep">not a fave · swap?</span>}
        </span>
        <span className="block truncate text-[13px] text-ink-mute">
          {changed ? (
            <>
              <span className="line-through decoration-ink-mute/40">{plannedQty}</span> → had {r.log!.status === 'partial' ? `${Math.round(r.log!.fraction * 100)}% of ${actualQty}` : actualQty}
            </>
          ) : (
            <>
              {plannedQty}
              {r.portion.hint ? ` · ${r.portion.hint}` : ''}
              {r.portion.range && r.portion.range[0] !== r.portion.range[1] ? ` · aim ${fmtRange(r.food, r.portion.range, r.portion.unit)}` : ''}
            </>
          )}
        </span>
        <span className={cn('block text-[12px] tabular', status === 'skipped' ? 'text-ink-mute/70' : 'text-ink-mute')}>
          {status === 'skipped' ? 'Skipped' : `${fmtNum(n.kcal)} kcal · ${n.protein < 10 ? fmtAmount(Math.round(n.protein * 2) / 2) : Math.round(n.protein)} g protein`}
        </span>
      </button>
      {!readOnly && (
        <button onClick={onEdit} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-mute transition hover:bg-sand hover:text-ink focus-ring" aria-label={`Edit ${r.food.name}`}>
          <Pencil size={16} />
        </button>
      )}
    </li>
  )
}

function ExtraRow({ log, name, readOnly, onEdit, db }: { log: FoodLog; name: string; readOnly: boolean; onEdit: () => void; db: ReturnType<typeof useSession>['db'] }) {
  const food = allFoods(db)[log.foodId]
  return (
    <li className="flex items-center gap-1 border-t border-line/60 pl-1.5 pr-2">
      <span className="grid h-11 w-11 shrink-0 place-items-center">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-clay-soft text-clay-deep">
          <Plus size={14} strokeWidth={3} />
        </span>
      </span>
      <button onClick={readOnly ? undefined : onEdit} disabled={readOnly} className="min-w-0 flex-1 py-2.5 pl-1 text-left">
        <span className="block truncate text-[15px] font-semibold leading-snug">{name}</span>
        <span className="block truncate text-[13px] text-ink-mute">
          {fmtQty(food, log.amount, log.unit)} · extra
        </span>
        <span className="block text-[12px] text-ink-mute tabular">
          {fmtNum(log.nutrients.kcal)} kcal · {Math.round(log.nutrients.protein)} g protein
        </span>
      </button>
      {!readOnly && (
        <button onClick={onEdit} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-mute transition hover:bg-sand hover:text-ink focus-ring" aria-label={`Edit ${name}`}>
          <Pencil size={16} />
        </button>
      )}
    </li>
  )
}

function CompletionOnly({ view, name, show }: { view: DayView; name: string; show: boolean }) {
  if (!show)
    return (
      <div className="mt-5 rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-mute">
        <Lock size={18} className="mx-auto mb-2" />
        {name} hasn’t shared their log. That’s okay — you still share the same plan.
      </div>
    )
  return (
    <div className="mt-5 grid grid-cols-2 gap-2">
      {view.slots.map((sl) => (
        <div key={sl.slot} className="flex items-center gap-3 rounded-2xl border border-line/80 bg-card px-4 py-3">
          <span className={cn('h-2.5 w-2.5 rounded-full', SLOT_META[sl.slot].dot)} />
          <span className="flex-1 text-[14px] font-semibold">{SLOT_META[sl.slot].label}</span>
          {sl.done ? <Check size={16} className="text-ink" strokeWidth={3} /> : <span className="text-[12px] text-ink-mute tabular">{sl.markedCount}/{sl.requiredCount}</span>}
        </div>
      ))}
    </div>
  )
}

function DailySummary({ view, member, isMine, showCalories, showProtein }: { view: DayView; member: HouseholdMember; isMine: boolean; showCalories: boolean; showProtein: boolean }) {
  const p = member.profile
  const insights = isMine ? dayInsights(view, p) : []
  return (
    <section className="mt-8 rounded-3xl bg-sand/60 p-4" aria-label="Daily summary" data-testid="daily-summary">
      <h2 className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-mute">Daily summary</h2>
      <dl className="grid grid-cols-2 gap-2">
        {showCalories && <Stat label="Calories" value={`${fmtNum(view.totals.kcal)} / ${fmtNum(p.calorieTarget)}`} />}
        {showProtein && <Stat label="Protein" value={`${Math.round(view.totals.protein)} / ${p.proteinTarget} g`} />}
        <Stat label="Meals completed" value={`${view.mealsDone} / 4`} />
        <Stat label="Fruit & veg" value={`${fmtAmount(Math.round(view.fv * 2) / 2)} serving${view.fv >= 1.5 || view.fv === 0 ? 's' : ''}`} />
      </dl>
      {isMine && p.trackWater && <Water member={member} date={view.date} glasses={view.water} />}
      {insights.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {insights.map((ins, i) => (
            <motion.li
              key={ins.text}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-2.5 rounded-2xl bg-card px-3.5 py-2.5 text-[14px] leading-snug"
            >
              <span className={cn('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', ins.tone === 'good' ? 'bg-meal-lunch' : ins.tone === 'nudge' ? 'bg-clay' : 'bg-ink-mute')} />
              {ins.text}
            </motion.li>
          ))}
        </ul>
      )}
      {isMine && (
        <p className="mt-3 px-1 text-[11px] leading-relaxed text-ink-mute">
          If you ate everything planned today: ≈ {fmtNum(view.plannedTotals.kcal)} kcal · {Math.round(view.plannedTotals.protein)} g protein. All numbers are estimates.
        </p>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card px-3.5 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-mute">{label}</dt>
      <dd className="mt-0.5 text-[16px] font-semibold tabular">{value}</dd>
    </div>
  )
}

function Water({ member, date, glasses }: { member: HouseholdMember; date: ISODate; glasses: number }) {
  const target = member.profile.waterTargetGlasses
  return (
    <div className="mt-2 flex items-center gap-3 rounded-2xl bg-card px-3.5 py-2.5">
      <Droplet size={18} className="text-water" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-mute">Water · optional</p>
        <div className="mt-1 flex gap-[3px]" aria-hidden>
          {Array.from({ length: Math.max(target, glasses) }).map((_, i) => (
            <span key={i} className={cn('h-2 flex-1 rounded-full transition-colors duration-300', i < glasses ? 'bg-water-fill' : 'bg-line')} />
          ))}
        </div>
      </div>
      <span className="text-[13px] font-semibold tabular" aria-live="polite">
        {glasses}/{target}
      </span>
      <div className="flex gap-1">
        <button onClick={() => setWater(member.userId, date, glasses - 1)} disabled={glasses <= 0} className="grid h-9 w-9 place-items-center rounded-full bg-sand disabled:opacity-30 focus-ring" aria-label="Remove a glass of water">
          <Minus size={15} />
        </button>
        <button onClick={() => setWater(member.userId, date, glasses + 1)} className="grid h-9 w-9 place-items-center rounded-full bg-ink text-paper focus-ring" aria-label="Add a glass of water">
          <Plus size={15} />
        </button>
      </div>
    </div>
  )
}

function CoachCard({
  tip,
  memberName,
  partnerName,
  style,
  onDone,
  onInvite,
  onSettings,
}: {
  tip: 'intro' | 'plannedVsEaten' | 'sharing'
  memberName: string
  partnerName?: string
  style: string
  onDone: () => void
  onInvite: () => void
  onSettings: () => void
}) {
  const content = {
    intro: {
      title: `Welcome, ${memberName}`,
      body: partnerName
        ? `This is your plan — the same meals as ${partnerName}, with ${style} sized for your goal.`
        : `This is your plan — home-style meals with ${style} sized for your goal. When your person joins, they’ll see the same meals with their own portions.`,
    },
    plannedVsEaten: {
      title: 'Planned vs eaten',
      body: '○ is planned. Tap the circle once you’ve eaten it ✓. Had less or more? Tap the item to log what you actually had — half a cup, 75%, or skipped.',
    },
    sharing: {
      title: partnerName ? `Sharing with ${partnerName}` : 'Better with two',
      body: partnerName
        ? `You can see each other’s progress. Choose exactly what ${partnerName} sees — full log, calories, protein or just meal completion.`
        : 'Invite your second person so you both tick off the same meals. They’ll set up their own goals.',
    },
  }[tip]
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative mt-3 rounded-2xl bg-ink p-4 pr-10 text-paper shadow-lift" data-testid={`coach-${tip}`}>
      <button onClick={onDone} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-paper/60 hover:text-paper" aria-label="Dismiss">
        <X size={16} />
      </button>
      <p className="font-display text-[19px] leading-tight">{content.title}</p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-paper/75">{content.body}</p>
      {tip === 'plannedVsEaten' && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-paper/80">
          {(['planned', 'eaten', 'partial', 'skipped'] as const).map((st) => (
            <span key={st} className="inline-flex items-center gap-1.5 rounded-full bg-paper px-2 py-0.5 text-ink">
              <MiniStatus s={st} /> {{ planned: 'Planned', eaten: 'Eaten', partial: 'Partly', skipped: 'Skipped' }[st]}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Button size="sm" className="bg-paper text-ink hover:bg-paper/90" onClick={onDone}>
          Got it
        </Button>
        {tip === 'sharing' && (
          <Button size="sm" variant="ghost" className="text-paper/80 hover:bg-paper/10 hover:text-paper" onClick={partnerName ? onSettings : onInvite}>
            {partnerName ? 'Sharing settings' : 'Invite now'}
          </Button>
        )}
      </div>
    </motion.div>
  )
}
