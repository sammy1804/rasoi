import { motion } from 'framer-motion'
import { ChefHat, NotebookPen, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDay } from '@/app/DayContext'
import { SLOT_META } from '@/app/meta'
import { AddFoodSheet } from '@/components/AddFoodSheet'
import { DayStrip } from '@/components/DayStrip'
import { LogSheet, type LogTarget } from '@/components/LogSheet'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { allFoods, deleteCustomFood, upsertLog } from '@/data/repository'
import type { Food, FoodLog } from '@/data/types'
import { MEAL_SLOTS } from '@/data/types'
import { useSession } from '@/hooks/useSession'
import { fmtLongDate, relativeDayLabel, todayISO } from '@/lib/dates'
import { fmtG, fmtQty } from '@/lib/format'
import { nutrientsFor } from '@/lib/nutrition'
import { dayView } from '@/lib/summary'
import { cn, fmtNum } from '@/lib/utils'

export function LogScreen() {
  const { db, member } = useSession()
  const me = member!
  const { date, setDate } = useDay()
  const navigate = useNavigate()
  const toast = useToast()
  const [target, setTarget] = useState<LogTarget | null>(null)
  const [adding, setAdding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Food | null>(null)
  const foods = allFoods(db)
  const view = useMemo(() => dayView(db, me, date), [db, me, date])
  const myFoods = Object.values(db.foods).filter((f) => f.householdId === me.householdId && !f.archived)

  const openLog = (l: FoodLog) => {
    if (l.mealItemId) {
      const sl = view.slots.find((s) => s.slot === l.slot)
      const row = sl?.planned.find((r) => r.item.id === l.mealItemId)
      if (row) return setTarget({ kind: 'planned', row, slot: l.slot, date })
    }
    setTarget({ kind: 'log', log: l })
  }

  const t = view.totals
  const eatenLogs = view.logs

  return (
    <div className="px-4">
      <header className="pt-safe">
        <div className="pt-5">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-mute">My log · {relativeDayLabel(date)}</p>
          <h1 className="mt-0.5 font-display text-[28px] font-medium tracking-tight">{fmtLongDate(date)}</h1>
        </div>
        <div className="-mx-1 mt-4">
          <DayStrip date={date} onChange={setDate} />
        </div>
      </header>

      <section className="mt-4 rounded-3xl border border-line/80 bg-card p-4 shadow-soft" aria-label="Totals" data-testid="log-totals">
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] font-semibold text-ink-soft">What I ate</p>
          <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Estimates</span>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1 text-center">
          {(
            [
              ['kcal', t.kcal, '', `of ${fmtNum(me.profile.calorieTarget)}`],
              ['protein', t.protein, 'g', `of ${me.profile.proteinTarget}`],
              ['carbs', t.carbs, 'g', ''],
              ['fat', t.fat, 'g', ''],
              ['fibre', t.fibre, 'g', ''],
            ] as const
          ).map(([k, v, u, sub]) => (
            <div key={k}>
              <p className={cn('font-display text-[22px] font-medium tabular', k === 'kcal' || k === 'protein' ? 'text-ink' : 'text-ink-soft')}>
                {fmtNum(v)}
                <span className="font-sans text-xs text-ink-mute">{u}</span>
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">{k}</p>
              {sub && <p className="text-[10px] text-ink-mute tabular">{sub}</p>}
            </div>
          ))}
        </div>
      </section>

      {eatenLogs.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line px-6 py-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-sand text-ink-soft">
            <NotebookPen size={22} />
          </span>
          <p className="mt-4 font-semibold">{date === todayISO() ? 'Nothing logged yet today' : 'Nothing logged this day'}</p>
          <p className="mt-1 text-sm text-ink-mute">Tick meals off your plan, or add something extra — chai, a snack, anything.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              Open the plan
            </Button>
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus size={15} /> Add food
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {MEAL_SLOTS.map((slot) => {
            const logs = eatenLogs.filter((l) => l.slot === slot)
            if (!logs.length) return null
            const sk = logs.reduce((s, l) => s + (l.status === 'skipped' ? 0 : l.nutrients.kcal), 0)
            return (
              <section key={slot}>
                <div className="mb-1.5 flex items-center gap-2 px-1">
                  <span className={cn('h-2 w-2 rounded-full', SLOT_META[slot].dot)} />
                  <h2 className="text-[15px] font-semibold">{SLOT_META[slot].label}</h2>
                  <span className="ml-auto text-[12px] font-semibold text-ink-mute tabular">{fmtNum(sk)} kcal</span>
                </div>
                <ul className="overflow-hidden rounded-2xl border border-line/80 bg-card">
                  {logs.map((l) => {
                    const f = foods[l.foodId]
                    return (
                      <li key={l.id} className="border-t border-line/60 first:border-t-0">
                        <button onClick={() => openLog(l)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-sand/50">
                          <span className="min-w-0 flex-1">
                            <span className={cn('block truncate text-[15px] font-semibold', l.status === 'skipped' && 'text-ink-mute line-through')}>{f?.name ?? 'Food'}</span>
                            <span className="block text-[13px] text-ink-mute">
                              {l.status === 'skipped' ? 'Skipped' : l.status === 'partial' ? `${Math.round(l.fraction * 100)}% of ${fmtQty(f, l.amount, l.unit)}` : fmtQty(f, l.amount, l.unit)}
                              {l.mealItemId ? ' · from plan' : ' · extra'}
                            </span>
                          </span>
                          {l.status !== 'skipped' && (
                            <span className="text-right text-[13px] tabular">
                              <span className="block font-semibold">{fmtNum(l.nutrients.kcal)} kcal</span>
                              <span className="block text-ink-mute">{fmtG(l.nutrients.protein)} protein</span>
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      <section className="mt-8">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-[15px] font-semibold">Our foods & recipes</h2>
          <button onClick={() => setAdding(true)} className="text-[13px] font-semibold text-clay">
            + Create
          </button>
        </div>
        {myFoods.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl bg-sand/60 px-4 py-4 text-sm text-ink-soft">
            <ChefHat size={20} className="shrink-0 text-clay" />
            Save a homemade recipe once — like your paneer bhurji — and log it in one tap after that.
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-line/80 bg-card">
            {myFoods.map((f) => {
              const n = nutrientsFor(f, f.defaultAmount, f.defaultUnit)
              const recipe = f.recipeId ? db.recipes[f.recipeId] : undefined
              return (
                <li key={f.id} className="flex items-center gap-3 border-t border-line/60 px-4 py-3 first:border-t-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{f.name}</span>
                    <span className="block text-[13px] text-ink-mute">
                      {recipe ? `Recipe · ${recipe.ingredients.length} ingredients · ` : 'Custom · '}
                      {fmtQty(f, 1, f.defaultUnit)} ≈ {fmtNum(n.kcal)} kcal, {Math.round(n.protein)} g protein
                    </span>
                  </span>
                  <button
                    onClick={() => {
                      upsertLog({ householdId: me.householdId, userId: me.userId, date, slot: 'snack', foodId: f.id, amount: f.defaultAmount, unit: f.defaultUnit, status: 'eaten' })
                      toast({ text: `Logged ${f.name}` })
                    }}
                    className="grid h-9 w-9 place-items-center rounded-full bg-sand text-ink focus-ring"
                    aria-label={`Log ${f.name}`}
                  >
                    <Plus size={16} />
                  </button>
                  <button onClick={() => setConfirmDelete(f)} className="grid h-9 w-9 place-items-center rounded-full text-ink-mute hover:bg-sand hover:text-ink focus-ring" aria-label={`Delete ${f.name}`}>
                    <Trash2 size={15} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <motion.button
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setAdding(true)}
        className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] right-[max(16px,calc(50vw-224px+16px))] z-20 flex h-14 items-center gap-2 rounded-full bg-ink pl-4 pr-5 text-[15px] font-semibold text-paper shadow-lift focus-ring"
      >
        <Plus size={20} strokeWidth={2.5} /> Add food
      </motion.button>

      <LogSheet target={target} member={me} onClose={() => setTarget(null)} />
      <AddFoodSheet
        open={adding}
        onOpenChange={setAdding}
        member={me}
        onAdd={({ food, amount, unit, slot }) => {
          upsertLog({ householdId: me.householdId, userId: me.userId, date, slot, foodId: food.id, amount, unit, status: 'eaten' })
          toast({ text: `Added ${food.name}` })
        }}
      />
      <Sheet
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.name ?? ''}?`}
        description="It’ll disappear from search for both of you. Past log entries keep their numbers."
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="lg" block onClick={() => setConfirmDelete(null)}>
              Keep
            </Button>
            <Button
              variant="danger"
              size="lg"
              block
              onClick={() => {
                if (confirmDelete) deleteCustomFood(confirmDelete.id)
                setConfirmDelete(null)
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        <span />
      </Sheet>
    </div>
  )
}
