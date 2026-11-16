import { motion } from 'framer-motion'
import { ArrowLeft, ChefHat, ChevronRight, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SLOT_META, slotForNow } from '@/app/meta'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Field, Input, NumberInput } from '@/components/ui/field'
import { Sheet } from '@/components/ui/sheet'
import { Stepper } from '@/components/ui/stepper'
import { addCustomFood, allFoods, recipeTotals, saveRecipe } from '@/data/repository'
import { useStore } from '@/data/store'
import type { Food, FoodCategory, HouseholdMember, MealSlot, RecipeIngredient } from '@/data/types'
import { MEAL_SLOTS } from '@/data/types'
import { fmtQty } from '@/lib/format'
import { dietBlocks, nutrientsFor } from '@/lib/nutrition'
import { cn, fmtNum } from '@/lib/utils'
import { presetAmounts, stepFor } from './LogSheet'

type Cat = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink' | 'fruit' | 'homemade' | 'custom'
const CATS: { v: Cat; label: string }[] = [
  { v: 'all', label: 'All' },
  { v: 'breakfast', label: 'Breakfast' },
  { v: 'lunch', label: 'Lunch' },
  { v: 'dinner', label: 'Dinner' },
  { v: 'snack', label: 'Snacks' },
  { v: 'drink', label: 'Drinks' },
  { v: 'fruit', label: 'Fruits' },
  { v: 'homemade', label: 'Homemade' },
  { v: 'custom', label: 'Custom' },
]

function inCat(f: Food, c: Cat): boolean {
  if (c === 'all') return true
  if (c === 'lunch' || c === 'dinner') return f.category === 'lunch' || f.category === 'dinner'
  if (c === 'custom') return f.category === 'custom' || (!!f.householdId && !f.recipeId)
  if (c === 'homemade') return f.category === 'homemade' || !!f.recipeId
  return f.category === c
}

type View = 'search' | 'amount' | 'custom' | 'recipe' | 'recipe-pick'

export interface AddFoodResult {
  food: Food
  amount: number
  unit: string
  slot: MealSlot
}

export function AddFoodSheet({
  open,
  onOpenChange,
  member,
  defaultSlot,
  onAdd,
  title = 'Add food',
  confirmLabel = 'Add',
  showSlot = true,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  member: HouseholdMember
  defaultSlot?: MealSlot
  onAdd: (r: AddFoodResult) => void
  title?: string
  confirmLabel?: string
  showSlot?: boolean
}) {
  const { db } = useStore()
  const foods = allFoods(db)
  const [view, setView] = useState<View>('search')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Cat>('all')
  const [picked, setPicked] = useState<Food | null>(null)
  const [amount, setAmount] = useState(1)
  const [unit, setUnit] = useState('g')
  const [slot, setSlot] = useState<MealSlot>(defaultSlot ?? slotForNow())

  useEffect(() => {
    if (open) {
      setView('search')
      setQ('')
      setCat('all')
      setPicked(null)
      setSlot(defaultSlot ?? slotForNow())
    }
  }, [open, defaultSlot])

  const pick = (f: Food) => {
    setPicked(f)
    setAmount(f.defaultAmount)
    setUnit(f.defaultUnit)
    setView('amount')
  }

  const recent = useMemo(() => {
    const seen = new Set<string>()
    const out: Food[] = []
    const logs = Object.values(db.foodLogs)
      .filter((l) => l.userId === member.userId && !l.mealItemId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    for (const l of logs) {
      if (seen.has(l.foodId) || !foods[l.foodId] || foods[l.foodId].archived) continue
      seen.add(l.foodId)
      out.push(foods[l.foodId])
      if (out.length >= 6) break
    }
    return out
  }, [db.foodLogs, member.userId, foods])

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = Object.values(foods).filter((f) => {
      if (f.archived || (f.householdId && f.householdId !== member.householdId)) return false
      if (!inCat(f, cat)) return false
      if (!needle) return true
      return [f.name, ...(f.tags ?? []), ...(f.produce ?? [])].join(' ').toLowerCase().includes(needle)
    })
    return list.sort((a, b) => {
      if (cat === 'dinner' && a.category !== b.category) return a.category === 'dinner' ? -1 : 1
      const an = a.name.toLowerCase().startsWith(needle) ? 0 : 1
      const bn = b.name.toLowerCase().startsWith(needle) ? 0 : 1
      return an - bn || a.name.localeCompare(b.name)
    })
  }, [foods, q, cat, member.householdId])

  const headerBack = view !== 'search' && (
    <button
      onClick={() => setView(view === 'recipe-pick' ? 'recipe' : 'search')}
      className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft hover:text-ink"
    >
      <ArrowLeft size={16} /> Back
    </button>
  )

  // ——— Recipe state ———
  const [rName, setRName] = useState('')
  const [rServings, setRServings] = useState(2)
  const [rIngs, setRIngs] = useState<RecipeIngredient[]>([])
  const rTotals = useMemo(() => recipeTotals(db, rIngs), [db, rIngs])

  // ——— Custom food state ———
  const [cf, setCf] = useState({ name: '', category: 'custom' as FoodCategory, servingName: 'serving', servingGrams: '' as number | '', kcal: '' as number | '', protein: '' as number | '', carbs: '' as number | '', fat: '' as number | '', fibre: '' as number | '' })

  const n = picked ? nutrientsFor(picked, amount, unit) : null
  const footer =
    view === 'amount' && picked ? (
      <Button
        size="lg"
        block
        onClick={() => {
          onAdd({ food: picked, amount, unit, slot })
          onOpenChange(false)
        }}
      >
        {confirmLabel} · {fmtNum(n!.kcal)} kcal
      </Button>
    ) : view === 'custom' ? (
      <Button
        size="lg"
        block
        disabled={!cf.name.trim() || cf.kcal === ''}
        onClick={() => {
          const food = addCustomFood(member.householdId, member.userId, {
            name: cf.name,
            category: cf.category,
            servingName: cf.servingName.trim() || 'serving',
            servingGrams: cf.servingGrams || undefined,
            kcal: Number(cf.kcal) || 0,
            protein: Number(cf.protein) || 0,
            carbs: Number(cf.carbs) || 0,
            fat: Number(cf.fat) || 0,
            fibre: Number(cf.fibre) || 0,
          })
          setCf({ ...cf, name: '', kcal: '', protein: '', carbs: '', fat: '', fibre: '', servingGrams: '' })
          pick(food)
        }}
      >
        Save food
      </Button>
    ) : view === 'recipe' ? (
      <Button
        size="lg"
        block
        disabled={!rName.trim() || rIngs.length === 0}
        onClick={() => {
          const food = saveRecipe(member.householdId, member.userId, rName, rServings, rIngs)
          setRName('')
          setRIngs([])
          setRServings(2)
          pick(food)
        }}
      >
        Save recipe
      </Button>
    ) : undefined

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={view === 'custom' ? 'Custom food' : view === 'recipe' ? 'Homemade recipe' : view === 'recipe-pick' ? 'Add ingredient' : view === 'amount' && picked ? picked.name : title}
      description={view === 'recipe' ? 'Add ingredients — we’ll estimate nutrition per serving.' : view === 'custom' ? 'Enter values for one serving, from a label or your best guess.' : undefined}
      footer={footer}
      className="h-[92dvh]"
    >
        <motion.div key={view} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
          {(view === 'search' || view === 'recipe-pick') && (
            <SearchList
              back={headerBack}
              q={q}
              setQ={setQ}
              cat={cat}
              setCat={setCat}
              results={results}
              recent={view === 'search' ? recent : []}
              member={member}
              onPick={(f) => {
                if (view === 'recipe-pick') {
                  setRIngs((xs) => [...xs, { foodId: f.id, amount: f.defaultAmount, unit: f.defaultUnit }])
                  setView('recipe')
                  setQ('')
                } else pick(f)
              }}
              extra={
                view === 'search' && (
                  <div className="mb-4 grid grid-cols-2 gap-2">
                    <button onClick={() => setView('custom')} className="flex items-center gap-2.5 rounded-2xl border border-line bg-card p-3 text-left transition hover:border-ink/20 focus-ring">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-sand"><Plus size={18} /></span>
                      <span className="text-[13px] font-semibold leading-tight">Custom<br /><span className="font-medium text-ink-mute">food</span></span>
                    </button>
                    <button onClick={() => setView('recipe')} className="flex items-center gap-2.5 rounded-2xl border border-line bg-card p-3 text-left transition hover:border-ink/20 focus-ring">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-clay-soft text-clay-deep"><ChefHat size={18} /></span>
                      <span className="text-[13px] font-semibold leading-tight">Homemade<br /><span className="font-medium text-ink-mute">recipe</span></span>
                    </button>
                  </div>
                )
              }
            />
          )}

          {view === 'amount' && picked && n && (
            <div>
              {headerBack}
              <p className="mb-2 text-[13px] font-semibold text-ink-soft">How much?</p>
              <div className="flex flex-wrap gap-2">
                {presetAmounts(picked.defaultAmount, picked.defaultUnit).map((a) => {
                  return (
                    <Chip key={a} active={unit === picked.defaultUnit && amount === a} onClick={() => { setUnit(picked.defaultUnit); setAmount(a) }}>
                      {fmtQty(picked, a, picked.defaultUnit)}
                    </Chip>
                  )
                })}
              </div>
              <div className="mt-3">
                <Stepper value={amount} onChange={setAmount} step={stepFor(unit)} min={stepFor(unit)} max={unit === 'g' || unit === 'ml' ? 2000 : 20} format={(v) => fmtQty(picked, v, unit)} label="amount" />
              </div>
              {picked.units.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {picked.units.map((u) => (
                    <button
                      key={u.name}
                      onClick={() => {
                        const grams = picked.units.find((x) => x.name === unit)!.grams * amount
                        const st = stepFor(u.name)
                        setUnit(u.name)
                        setAmount(Math.max(st, Math.round(grams / u.grams / st) * st))
                      }}
                      className={cn('rounded-full px-3 py-1.5 text-[12px] font-semibold transition', unit === u.name ? 'bg-ink text-paper' : 'bg-sand text-ink-soft')}
                    >
                      {u.label ?? u.name}
                    </button>
                  ))}
                </div>
              )}
              {showSlot && (
                <>
                  <p className="mb-2 mt-6 text-[13px] font-semibold text-ink-soft">Which meal?</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {MEAL_SLOTS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSlot(s)}
                        className={cn('flex h-11 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold transition focus-ring', slot === s ? 'bg-ink text-paper' : 'bg-sand text-ink-soft')}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', SLOT_META[s].dot)} />
                        {SLOT_META[s].label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <NutritionCard n={n} />
              {dietBlocks(picked, member.profile) && (
                <p className="mt-3 rounded-xl bg-sand px-3 py-2 text-[13px] text-ink-soft">Heads up — this doesn’t match the diet in your profile. Logging it is still fine.</p>
              )}
            </div>
          )}

          {view === 'custom' && (
            <div className="space-y-4">
              {headerBack}
              <Field label="Name">
                <Input value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} placeholder="e.g. Mom’s besan ladoo" autoFocus />
              </Field>
              <Field label="Type">
                <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
                  {(['custom', 'breakfast', 'lunch', 'dinner', 'snack', 'drink', 'fruit'] as FoodCategory[]).map((c) => (
                    <Chip key={c} active={cf.category === c} onClick={() => setCf({ ...cf, category: c })} className="capitalize">
                      {c === 'custom' ? 'Other' : c}
                    </Chip>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Serving called">
                  <Input value={cf.servingName} onChange={(e) => setCf({ ...cf, servingName: e.target.value })} placeholder="piece, bowl…" />
                </Field>
                <Field label="Weighs (optional)">
                  <NumberInput value={cf.servingGrams} onChange={(v) => setCf({ ...cf, servingGrams: v })} suffix="g" placeholder="—" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Calories">
                  <NumberInput value={cf.kcal} onChange={(v) => setCf({ ...cf, kcal: v })} suffix="kcal" placeholder="0" />
                </Field>
                <Field label="Protein">
                  <NumberInput value={cf.protein} onChange={(v) => setCf({ ...cf, protein: v })} suffix="g" placeholder="0" />
                </Field>
                <Field label="Carbs">
                  <NumberInput value={cf.carbs} onChange={(v) => setCf({ ...cf, carbs: v })} suffix="g" placeholder="0" />
                </Field>
                <Field label="Fat">
                  <NumberInput value={cf.fat} onChange={(v) => setCf({ ...cf, fat: v })} suffix="g" placeholder="0" />
                </Field>
                <Field label="Fibre">
                  <NumberInput value={cf.fibre} onChange={(v) => setCf({ ...cf, fibre: v })} suffix="g" placeholder="0" />
                </Field>
              </div>
            </div>
          )}

          {view === 'recipe' && (
            <div className="space-y-4">
              {headerBack}
              <Field label="Recipe name">
                <Input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="e.g. Paneer bhurji (our way)" />
              </Field>
              <Field label="Makes how many servings?">
                <Stepper value={rServings} onChange={setRServings} min={1} max={12} format={(v) => `${v} serving${v > 1 ? 's' : ''}`} label="servings" />
              </Field>
              <div>
                <p className="mb-2 text-[13px] font-semibold text-ink-soft">Ingredients</p>
                {rIngs.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-ink-mute">
                    e.g. paneer 200 g, onion, tomato, 2 tsp oil, spices
                  </p>
                )}
                <ul className="space-y-2">
                  {rIngs.map((ing, i) => {
                    const f = foods[ing.foodId]
                    if (!f) return null
                    return (
                      <li key={i} className="rounded-2xl border border-line bg-card p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="truncate text-[14px] font-semibold">{f.name}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-[12px] text-ink-mute tabular">{fmtNum(nutrientsFor(f, ing.amount, ing.unit).kcal)} kcal</span>
                            <button aria-label={`Remove ${f.name}`} onClick={() => setRIngs((xs) => xs.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-full text-ink-mute hover:bg-sand hover:text-ink">
                              <Trash2 size={15} />
                            </button>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Stepper
                            className="flex-1"
                            value={ing.amount}
                            onChange={(v) => setRIngs((xs) => xs.map((x, j) => (j === i ? { ...x, amount: v } : x)))}
                            step={stepFor(ing.unit)}
                            min={stepFor(ing.unit)}
                            max={5000}
                            format={(v) => fmtQty(f, v, ing.unit)}
                            label={f.name}
                          />
                          {f.units.length > 1 && (
                            <select
                              value={ing.unit}
                              onChange={(e) => setRIngs((xs) => xs.map((x, j) => (j === i ? { ...x, unit: e.target.value, amount: e.target.value === 'g' || e.target.value === 'ml' ? 100 : 1 } : x)))}
                              className="h-11 rounded-full border border-line bg-card px-3 text-[14px] font-semibold"
                              aria-label="Unit"
                            >
                              {f.units.map((u) => (
                                <option key={u.name} value={u.name}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <Button variant="outline" block className="mt-3" onClick={() => { setQ(''); setCat('all'); setView('recipe-pick') }}>
                  <Plus size={16} /> Add ingredient
                </Button>
              </div>
              {rIngs.length > 0 && (
                <NutritionCard
                  label={`Per serving (1 of ${rServings})`}
                  n={{
                    kcal: rTotals.total.kcal / rServings,
                    protein: rTotals.total.protein / rServings,
                    carbs: rTotals.total.carbs / rServings,
                    fat: rTotals.total.fat / rServings,
                    fibre: rTotals.total.fibre / rServings,
                  }}
                />
              )}
            </div>
          )}
        </motion.div>
    </Sheet>
  )
}

function SearchList({
  q,
  setQ,
  cat,
  setCat,
  results,
  recent,
  onPick,
  extra,
  back,
  member,
}: {
  q: string
  setQ: (s: string) => void
  cat: Cat
  setCat: (c: Cat) => void
  results: Food[]
  recent: Food[]
  onPick: (f: Food) => void
  extra?: React.ReactNode
  back?: React.ReactNode
  member: HouseholdMember
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      {back}
      <div className="relative mb-3">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-mute" />
        <Input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dal, paneer, chai…" className="rounded-full pl-11 pr-10" aria-label="Search foods" />
        {q && (
          <button onClick={() => { setQ(''); inputRef.current?.focus() }} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ink-mute hover:bg-sand" aria-label="Clear search">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5">
        {CATS.map((c) => (
          <Chip key={c.v} active={cat === c.v} onClick={() => setCat(c.v)}>
            {c.label}
          </Chip>
        ))}
      </div>
      {!q && cat === 'all' && extra}
      {!q && cat === 'all' && recent.length > 0 && (
        <>
          <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-mute">Recent</p>
          <FoodList foods={recent} onPick={onPick} member={member} />
          <p className="mb-1 mt-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-mute">All foods</p>
        </>
      )}
      {results.length === 0 ? (
        <div className="py-10 text-center">
          <p className="font-semibold">Nothing called “{q}” yet</p>
          <p className="mt-1 text-sm text-ink-mute">{cat === 'homemade' || cat === 'custom' ? 'Create one with the buttons under “All”.' : 'Try a simpler word, or add it as a custom food.'}</p>
          {cat !== 'all' && (
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => setCat('all')}>
              Show all foods
            </Button>
          )}
        </div>
      ) : (
        <FoodList foods={results} onPick={onPick} member={member} />
      )}
    </div>
  )
}

function FoodList({ foods, onPick, member }: { foods: Food[]; onPick: (f: Food) => void; member: HouseholdMember }) {
  return (
    <ul className="divide-y divide-line/70">
      {foods.map((f) => {
        const n = nutrientsFor(f, f.defaultAmount, f.defaultUnit)
        const blocked = dietBlocks(f, member.profile)
        return (
          <li key={f.id}>
            <button onClick={() => onPick(f)} className="flex w-full items-center gap-3 py-3 text-left transition active:bg-sand/50">
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-[15px] font-semibold', blocked && 'text-ink-mute')}>
                  {f.name}
                  {f.recipeId && <span className="ml-2 rounded-full bg-clay-soft px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-clay-deep">Recipe</span>}
                  {f.householdId && !f.recipeId && <span className="ml-2 rounded-full bg-sand px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-ink-mute">Custom</span>}
                </span>
                <span className="block text-[13px] text-ink-mute tabular">
                  {fmtQty(f, f.defaultAmount, f.defaultUnit)} · {fmtNum(n.kcal)} kcal · {Math.round(n.protein)} g protein
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-ink-mute" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function NutritionCard({ n, label = 'Estimated nutrition' }: { n: { kcal: number; protein: number; carbs: number; fat: number; fibre: number }; label?: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-ink-soft">{label}</p>
        <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Estimate</span>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1 text-center">
        {(
          [
            ['kcal', n.kcal, ''],
            ['protein', n.protein, 'g'],
            ['carbs', n.carbs, 'g'],
            ['fat', n.fat, 'g'],
            ['fibre', n.fibre, 'g'],
          ] as const
        ).map(([k, v, u]) => (
          <div key={k}>
            <p className={cn('font-display text-xl font-medium tabular', k === 'kcal' || k === 'protein' ? 'text-ink' : 'text-ink-soft')}>
              {v < 10 && k !== 'kcal' ? Math.round(v * 10) / 10 : Math.round(v)}
              <span className="text-xs font-sans text-ink-mute">{u}</span>
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{k}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
