import { ArrowLeftRight, Check, Copy, ExternalLink, Pencil, Plus, Settings2, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ChartCard } from '@/components/charts'
import { WhatsAppButtons } from '@/components/kitchen'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Field, Input, NumberInput } from '@/components/ui/field'
import { ProgressBar } from '@/components/ui/progress'
import { Segmented } from '@/components/ui/segmented'
import { Sheet } from '@/components/ui/sheet'
import { QUICK_STORES, quickStore, storeSearchUrl } from '@/data/kitchen'
import { addSpend, deleteSpend, groceryKey, membersOf, setGroceryChecked, setItemPrice, setItemShop, shopsOf, spendOf, updateHousehold, updateShop } from '@/data/repository'
import type { Household, ShopKind, SpendLog, Weekday } from '@/data/types'
import { SHOP_KINDS } from '@/data/types'
import { useSession } from '@/hooks/useSession'
import { WEEKDAY_SHORT, fmtShortDate, fromISO, relativeDayLabel, todayISO } from '@/lib/dates'
import {
  GROUP_ORDER,
  bulkList,
  costOf,
  fmtGroceryQty,
  fmtRupees,
  groceryMessage,
  monthlyEstimate,
  orderPrompt,
  priceOf,
  quickList,
  subscriptionPlan,
  type GroceryLine,
  type SubscriptionLine,
} from '@/lib/kitchen'
import { cn } from '@/lib/utils'
import { copyText } from './Invite'

const SHOP_HINT: Record<ShopKind, string> = {
  quick: 'Fresh things, a few times a week',
  bulk: 'Atta, rice, dals — the big monthly shop',
  subscription: 'Comes by itself every day',
}

/* ════════════════════════ Groceries ════════════════════════ */

export function GroceriesPanel() {
  const { household } = useSession()
  const [tab, setTab] = useState<ShopKind>('quick')
  const [moving, setMoving] = useState<string | null>(null)
  const [settings, setSettings] = useState(false)
  if (!household) return null
  const shops = shopsOf(household)

  return (
    <div className="space-y-4" data-testid="groceries">
      <div className="flex items-center gap-2">
        <Segmented
          className="min-w-0 flex-1"
          size="sm"
          value={tab}
          onChange={setTab}
          options={SHOP_KINDS.map((k) => ({ value: k, label: <span className="truncate">{shops[k].name}</span> }))}
        />
        <button onClick={() => setSettings(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand text-ink-soft hover:text-ink focus-ring" aria-label="Shop settings">
          <Settings2 size={17} />
        </button>
      </div>
      <p className="-mt-1 px-1 text-[13px] text-ink-mute">{SHOP_HINT[tab]}. Tap ⇄ on any item to change where you buy it.</p>

      {tab === 'quick' && <QuickShop household={household} onMove={setMoving} />}
      {tab === 'bulk' && <BulkShop household={household} onMove={setMoving} />}
      {tab === 'subscription' && <SubscriptionShop household={household} onMove={setMoving} />}

      <Sheet open={!!moving} onOpenChange={(o) => !o && setMoving(null)} title={`Where do you buy ${moving?.toLowerCase() ?? ''}?`}>
        <div className="space-y-2 pb-2">
          {SHOP_KINDS.map((k) => (
            <button
              key={k}
              onClick={() => {
                if (moving) setItemShop(household.id, moving, k)
                setMoving(null)
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3.5 text-left transition hover:border-ink/30 focus-ring"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold">{shops[k].name}</span>
                <span className="block text-[13px] text-ink-mute">{SHOP_HINT[k]}</span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>
      <ShopSettingsSheet open={settings} onClose={() => setSettings(false)} household={household} />
    </div>
  )
}

function useChecks(household: Household, period: string) {
  const { db } = useSession()
  return {
    isChecked: (item: string) => !!db.groceryChecks[groceryKey(household.id, period, item)]?.checked,
    toggle: (item: string, v: boolean) => setGroceryChecked(household.id, period, item, v),
  }
}

function QuickShop({ household, onMove }: { household: Household; onMove: (item: string) => void }) {
  const { db } = useSession()
  const shops = shopsOf(household)
  const store = shops.quick.name
  const q = useMemo(() => quickList(db, household), [db, household])
  const { isChecked, toggle } = useChecks(household, q.period)
  const [ordering, setOrdering] = useState(false)
  const [logging, setLogging] = useState(false)
  const left = q.lines.filter((l) => !isChecked(l.item))
  const done = q.lines.filter((l) => isChecked(l.item))
  const total = q.lines.reduce((s, l) => s + costOf(household, l), 0)
  const doneCost = done.reduce((s, l) => s + costOf(household, l), 0)
  const orderDays = shops.quick.orderDays ?? []
  const mcp = quickStore(store)?.mcp
  const title = `${store} order · ${fmtShortDate(q.orderDate)}`
  const covers = q.dates.length === 1 ? fmtShortDate(q.dates[0]) : `${fmtShortDate(q.dates[0])} – ${fmtShortDate(q.dates[q.dates.length - 1])}`

  return (
    <>
      <section className="rounded-3xl border border-line/80 bg-card p-4 shadow-soft" data-testid="quick-card">
        <p className="text-[13px] font-semibold text-ink-soft">Next {store} order</p>
        <p className="mt-0.5 font-display text-[24px] font-medium leading-tight">
          {relativeDayLabel(q.orderDate)}
          <span className="text-ink-mute"> · {fmtShortDate(q.orderDate)}</span>
        </p>
        <p className="mt-1 text-[13px] text-ink-mute tabular">
          Covers {covers} · {left.length} to buy · about {fmtRupees(total)}
        </p>
        <div className="mt-3">
          <p className="mb-1.5 text-[12px] font-semibold text-ink-soft">You order on</p>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_SHORT.map((d, i) => {
              const on = orderDays.includes(i as Weekday)
              return (
                <button
                  key={d}
                  aria-pressed={on}
                  aria-label={`Order on ${d}`}
                  onClick={() => updateShop(household.id, 'quick', { orderDays: (on ? orderDays.filter((x) => x !== i) : [...orderDays, i as Weekday]).sort() as Weekday[] })}
                  className={cn('h-9 rounded-xl text-[12px] font-semibold transition focus-ring', on ? 'bg-ink text-paper' : 'bg-sand text-ink-mute')}
                >
                  {d.slice(0, 2)}
                </button>
              )
            })}
          </div>
        </div>
        {left.length > 0 && (
          <div className="mt-4 space-y-2">
            {mcp && (
              <Button block variant="accent" onClick={() => setOrdering(true)} data-testid="order-with-claude">
                <Sparkles size={16} /> Fill my {store} cart with Claude
              </Button>
            )}
            <WhatsAppButtons text={groceryMessage(left, title)} />
          </div>
        )}
        {done.length > 0 && (
          <Button block variant="secondary" className="mt-3" onClick={() => setLogging(true)}>
            <Plus size={15} /> Log this order in the budget · about {fmtRupees(doneCost)}
          </Button>
        )}
      </section>

      <GroceryLines lines={q.lines} household={household} isChecked={isChecked} toggle={toggle} onMove={onMove} store={store} empty="Nothing fresh needed for this order." />

      <OrderSheet open={ordering} onClose={() => setOrdering(false)} store={store} mcp={mcp ?? ''} lines={left} />
      <SpendSheet open={logging} onClose={() => setLogging(false)} householdId={household.id} preset={{ shop: 'quick', amount: Math.round(doneCost), note: `${store} · ${done.length} items` }} />
    </>
  )
}

function BulkShop({ household, onMove }: { household: Household; onMove: (item: string) => void }) {
  const { db } = useSession()
  const shops = shopsOf(household)
  const b = useMemo(() => bulkList(db, household), [db, household])
  const { isChecked, toggle } = useChecks(household, b.period)
  const [logging, setLogging] = useState(false)
  const left = b.lines.filter((l) => !isChecked(l.item))
  const done = b.lines.filter((l) => isChecked(l.item))
  const total = b.lines.reduce((s, l) => s + costOf(household, l), 0)
  const doneCost = done.reduce((s, l) => s + costOf(household, l), 0)
  const month = fromISO(todayISO()).toLocaleString('en-GB', { month: 'long' })
  return (
    <>
      <section className="rounded-3xl border border-line/80 bg-card p-4 shadow-soft" data-testid="bulk-card">
        <p className="text-[13px] font-semibold text-ink-soft">{shops.bulk.name} list for {month}</p>
        <p className="mt-0.5 font-display text-[24px] font-medium leading-tight">
          {b.lines.length} staples <span className="text-ink-mute">· about {fmtRupees(total)}</span>
        </p>
        <p className="mt-1 text-[13px] text-ink-mute">Enough for about a month of this plan. Tick what’s already in the pantry.</p>
        {left.length > 0 && (
          <div className="mt-4">
            <WhatsAppButtons text={groceryMessage(left, `${shops.bulk.name} list · ${month}`)} />
          </div>
        )}
        {done.length > 0 && (
          <Button block variant="secondary" className="mt-3" onClick={() => setLogging(true)}>
            <Plus size={15} /> Log this shop in the budget · about {fmtRupees(doneCost)}
          </Button>
        )}
      </section>
      <GroceryLines lines={b.lines} household={household} isChecked={isChecked} toggle={toggle} onMove={onMove} empty="No staples on this plan." />
      <SpendSheet open={logging} onClose={() => setLogging(false)} householdId={household.id} preset={{ shop: 'bulk', amount: Math.round(doneCost), note: `${shops.bulk.name} · ${done.length} items` }} />
    </>
  )
}

/** "500 ml daily" or "200 g on Mon, Wed, Fri". */
function subscriptionAdvice(l: SubscriptionLine): string {
  const days = l.perDay.map((q, i) => (q > 0 ? i : -1)).filter((i) => i >= 0)
  if (!days.length) return 'Not needed this week'
  const max = Math.max(...l.perDay)
  const step = l.unit === 'ml' ? 500 : l.unit === 'pc' ? 1 : 100
  const pack = Math.ceil(max / step - 1e-9) * step
  const qty = fmtGroceryQty({ qty: pack, unit: l.unit })
  if (days.length >= 6) return `${qty} every day`
  return `${qty} on ${days.map((d) => WEEKDAY_SHORT[d]).join(', ')}`
}

function SubscriptionShop({ household, onMove }: { household: Household; onMove: (item: string) => void }) {
  const { db } = useSession()
  const shops = shopsOf(household)
  const plan = useMemo(() => subscriptionPlan(db, household), [db, household])
  const monthly = plan.reduce((s, l) => s + costOf(household, { item: l.item, qty: l.weekly, unit: l.unit }) * (30 / 7), 0)
  return (
    <>
      <section className="rounded-3xl border border-line/80 bg-card p-4 shadow-soft" data-testid="subscription-card">
        <p className="text-[13px] font-semibold text-ink-soft">{shops.subscription.name} · daily delivery</p>
        <p className="mt-0.5 font-display text-[24px] font-medium leading-tight">
          {plan.length} item{plan.length === 1 ? '' : 's'} <span className="text-ink-mute">· about {fmtRupees(monthly)} a month</span>
        </p>
        <p className="mt-1 text-[13px] text-ink-mute">These never show up in your order lists. Below is what this week’s plan needs, so you can set the subscription once.</p>
      </section>
      {plan.length === 0 && <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-mute">Nothing comes by subscription yet. Tap ⇄ on milk, curd or paneer in another list to move it here.</p>}
      <ul className="space-y-2">
        {plan.map((l) => (
          <li key={l.item} className="rounded-2xl border border-line/80 bg-card p-3.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold">{l.item}</p>
                <p className="text-[14px] font-semibold text-clay-deep">Set: {subscriptionAdvice(l)}</p>
              </div>
              <span className="pt-0.5 text-[13px] text-ink-mute tabular">{fmtGroceryQty({ qty: l.weekly, unit: l.unit })} / week</span>
              <MoveButton item={l.item} onMove={onMove} />
            </div>
            <div className="mt-2.5 grid grid-cols-7 gap-1">
              {l.perDay.map((q, i) => (
                <div key={i} className={cn('rounded-lg px-0.5 py-1.5 text-center', q > 0 ? 'bg-sand' : 'border border-dashed border-line')}>
                  <p className="text-[10px] font-semibold uppercase text-ink-mute">{WEEKDAY_SHORT[i].slice(0, 2)}</p>
                  <p className="text-[11px] font-semibold tabular">{q > 0 ? fmtGroceryQty({ qty: q, unit: l.unit }).replace(' ', '') : '–'}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 truncate text-[12px] text-ink-mute">for {l.for.slice(0, 4).join(', ')}</p>
          </li>
        ))}
      </ul>
    </>
  )
}

function MoveButton({ item, onMove }: { item: string; onMove: (item: string) => void }) {
  return (
    <button onClick={() => onMove(item)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-mute hover:bg-sand hover:text-ink focus-ring" aria-label={`Change where you buy ${item}`}>
      <ArrowLeftRight size={15} />
    </button>
  )
}

function GroceryLines({
  lines,
  household,
  isChecked,
  toggle,
  onMove,
  store,
  empty,
}: {
  lines: GroceryLine[]
  household: Household
  isChecked: (item: string) => boolean
  toggle: (item: string, v: boolean) => void
  onMove: (item: string) => void
  store?: string
  empty: string
}) {
  if (!lines.length) return <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-mute">{empty}</p>
  return (
    <>
      {GROUP_ORDER.map((g) => {
        const ls = lines.filter((l) => l.group === g)
        if (!ls.length) return null
        return (
          <section key={g}>
            <h3 className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-mute">{g}</h3>
            <ul className="overflow-hidden rounded-2xl border border-line/80 bg-card">
              {ls.map((l) => {
                const checked = isChecked(l.item)
                const search = store ? storeSearchUrl(store, l.item) : undefined
                return (
                  <li key={l.item} className="flex items-center gap-1 border-t border-line/60 py-1.5 pl-1.5 pr-1.5 first:border-t-0">
                    <button onClick={() => toggle(l.item, !checked)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full focus-ring" aria-pressed={checked} aria-label={`${checked ? 'Untick' : 'Tick'} ${l.item}`}>
                      <span className={cn('grid h-6 w-6 place-items-center rounded-md border-2 transition', checked ? 'border-ink bg-ink text-paper' : 'border-line bg-card')}>{checked && <Check size={14} strokeWidth={3.5} />}</span>
                    </button>
                    <span className="min-w-0 flex-1 py-1">
                      <span className={cn('block truncate text-[15px] font-semibold', checked && 'text-ink-mute line-through')}>
                        {l.item}
                        {l.soak && <span className="ml-1.5 rounded-full bg-meal-dinner/15 px-1.5 py-px align-middle text-[10px] font-bold uppercase tracking-wide text-meal-dinner">soak</span>}
                      </span>
                      <span className="block truncate text-[12px] text-ink-mute">for {l.for.slice(0, 2).join(', ')}{l.for.length > 2 ? ` +${l.for.length - 2}` : ''}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[14px] font-semibold tabular">{fmtGroceryQty(l)}</span>
                      <span className="block text-[11px] text-ink-mute tabular">≈ {fmtRupees(costOf(household, l))}</span>
                    </span>
                    {search && (
                      <a href={search} target="_blank" rel="noreferrer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-mute hover:bg-sand hover:text-ink focus-ring" aria-label={`Search ${l.item} on ${store}`}>
                        <ExternalLink size={14} />
                      </a>
                    )}
                    <MoveButton item={l.item} onMove={onMove} />
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </>
  )
}

/** The store's own AI connector does the searching and adding; this hands Claude the exact list. */
function OrderSheet({ open, onClose, store, mcp, lines }: { open: boolean; onClose: () => void; store: string; mcp: string; lines: GroceryLine[] }) {
  const toast = useToast()
  const prompt = orderPrompt(store, lines)
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Fill your ${store} cart`}
      description={`${store} has its own connector for Claude. Claude searches each item, adds it to your real ${store} cart, and stops before paying.`}
      footer={
        <Button
          size="lg"
          block
          onClick={async () => {
            const ok = await copyText(prompt)
            toast({ text: ok ? 'Copied — paste it into a Claude chat' : 'Couldn’t copy — select the text instead' })
          }}
        >
          <Copy size={17} /> Copy the order for Claude
        </Button>
      }
    >
      <ol className="space-y-3 pb-2 text-[14px] leading-relaxed">
        <li className="flex gap-3">
          <StepDot n={1} />
          <span>
            <b>Once only:</b> in the Claude app go to Settings → Connectors → Add custom connector, name it <b>{store}</b> and paste
            <span className="mt-1 block select-all break-all rounded-lg bg-sand px-2.5 py-1.5 font-mono text-[12px]">{mcp}</span>
            Sign in with your {store} mobile number and OTP.
          </span>
        </li>
        <li className="flex gap-3">
          <StepDot n={2} />
          <span>Tap <b>Copy the order</b> below and paste it into a new Claude chat. Claude adds all {lines.length} items to your cart.</span>
        </li>
        <li className="flex gap-3">
          <StepDot n={3} />
          <span>Open {store}, check the cart and pay. Then tick the items off here.</span>
        </li>
      </ol>
      <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-2xl border border-line bg-card p-3 text-[12px] leading-relaxed text-ink-soft" data-testid="order-prompt">{prompt}</pre>
      <p className="mt-3 text-[12px] leading-relaxed text-ink-mute">The cart is your real {store} cart and orders are real. The request tells Claude not to place the order, so you always confirm the total yourself.</p>
    </Sheet>
  )
}

function StepDot({ n }: { n: number }) {
  return <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-bold text-paper">{n}</span>
}

function ShopSettingsSheet({ open, onClose, household }: { open: boolean; onClose: () => void; household: Household }) {
  const shops = shopsOf(household)
  const [bulk, setBulk] = useState(shops.bulk.name)
  const [sub, setSub] = useState(shops.subscription.name)
  const [quick, setQuick] = useState(shops.quick.name)
  useEffect(() => {
    if (open) {
      setBulk(shops.bulk.name)
      setSub(shops.subscription.name)
      setQuick(shops.quick.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Where you shop"
      footer={
        <Button
          size="lg"
          block
          onClick={() => {
            updateHousehold(household.id, { shops: { quick: { ...shops.quick, name: quick.trim() || 'Zepto' }, bulk: { name: bulk.trim() || 'DMart' }, subscription: { name: sub.trim() || 'Country Delight' } } })
            onClose()
          }}
        >
          Save
        </Button>
      }
    >
      <div className="space-y-5 pb-2">
        <Field label="Quick orders (fresh, a few times a week)">
          <div className="mb-2 flex flex-wrap gap-2">
            {QUICK_STORES.map((s) => (
              <Chip key={s.name} active={quick === s.name} onClick={() => setQuick(s.name)}>
                {s.name}
              </Chip>
            ))}
          </div>
          <Input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Zepto" />
        </Field>
        <Field label="Big monthly shop (staples)">
          <Input value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="DMart" />
        </Field>
        <Field label="Daily subscription (milk, curd, paneer)">
          <Input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="Country Delight" />
        </Field>
      </div>
    </Sheet>
  )
}

/* ════════════════════════ Budget ════════════════════════ */

export function BudgetPanel() {
  const { db, household } = useSession()
  const [logging, setLogging] = useState(false)
  const [editBudget, setEditBudget] = useState(false)
  const [pricing, setPricing] = useState<string | null>(null)
  const [allItems, setAllItems] = useState(false)
  const est = useMemo(() => (household ? monthlyEstimate(db, household) : null), [db, household])
  if (!household || !est) return null
  const shops = shopsOf(household)
  const today = todayISO()
  const month = today.slice(0, 7)
  const logs = spendOf(db, household.id, month)
  const spent = logs.reduce((s, l) => s + l.amount, 0)
  const budget = household.budgetMonthly
  const d = fromISO(today)
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  const monthName = d.toLocaleString('en-GB', { month: 'long' })
  const pace = budget ? (budget * d.getDate()) / daysInMonth : 0
  const people = Math.max(1, membersOf(db, household.id).length)
  const suggested = Math.ceil((est.total * 1.1) / 500) * 500
  const parts = SHOP_KINDS.map((k, i) => ({ kind: k, name: shops[k].name, cost: est.byShop[k], cls: ['bg-chart-1', 'bg-chart-2', 'bg-chart-3'][i] }))
  const spentByShop = (k: SpendLog['shop']) => logs.filter((l) => l.shop === k).reduce((s, l) => s + l.amount, 0)

  return (
    <div className="space-y-4" data-testid="budget">
      <section className="rounded-3xl border border-line/80 bg-card p-4 shadow-soft" data-testid="budget-card">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-ink-soft">Groceries in {monthName}</p>
          <button onClick={() => setEditBudget(true)} className="rounded-full px-2.5 py-1 text-[13px] font-semibold text-clay hover:bg-clay-soft">
            {budget ? 'Edit budget' : 'Set a budget'}
          </button>
        </div>
        <p className="mt-1 font-display tabular">
          <span className="text-[34px] font-medium leading-none">{fmtRupees(spent)}</span>
          {budget ? <span className="ml-1.5 font-sans text-[14px] font-semibold text-ink-mute">of {fmtRupees(budget)}</span> : <span className="ml-1.5 font-sans text-[14px] font-semibold text-ink-mute">spent so far</span>}
        </p>
        {budget ? (
          <>
            <ProgressBar value={spent} max={budget} marker={pace} className="mt-3 h-2.5" barClassName={spent > budget ? 'bg-clay' : 'bg-ink'} />
            <p className="mt-2 text-[13px] text-ink-soft">
              {spent > budget
                ? `${fmtRupees(spent - budget)} over this month’s budget. The costliest items below are the easiest place to adjust.`
                : spent > pace * 1.1
                  ? `A little ahead of pace for day ${d.getDate()} of ${daysInMonth} — ${fmtRupees(budget - spent)} left.`
                  : `On track. ${fmtRupees(budget - spent)} left for the next ${daysInMonth - d.getDate()} days.`}
            </p>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-ink-soft">This plan costs about {fmtRupees(est.total)} a month. A budget of {fmtRupees(suggested)} leaves a little room.</p>
        )}
        <Button block className="mt-4" onClick={() => setLogging(true)}>
          <Plus size={16} /> Log an order
        </Button>
      </section>

      <ChartCard title="What this plan costs" readout={`about ${fmtRupees(est.total)} / month`} testId="chart-cost" footer={`Roughly ${fmtRupees(est.total / 30 / people)} per person per day. Prices are estimates you can correct below.`}>
        <div className="mt-3 flex h-4 gap-[2px] overflow-hidden rounded-[4px]">
          {parts.map((p) => (
            <span key={p.kind} className={p.cls} style={{ width: `${est.total ? (p.cost / est.total) * 100 : 0}%` }} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {parts.map((p) => (
            <div key={p.kind} className="min-w-0">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-[3px]', p.cls)} /> <span className="truncate">{p.name}</span>
              </p>
              <p className="mt-0.5 font-display text-[20px] font-medium leading-none tabular">{fmtRupees(p.cost)}</p>
              <p className="text-[11px] text-ink-mute tabular">spent {fmtRupees(spentByShop(p.kind))}</p>
            </div>
          ))}
        </div>
      </ChartCard>

      <section>
        <div className="mb-1.5 flex items-center justify-between px-1">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-mute">Where the money goes</h3>
          <button onClick={() => setAllItems(!allItems)} className="text-[13px] font-semibold text-clay">
            {allItems ? 'Show top 6' : `All ${est.top.length}`}
          </button>
        </div>
        <ul className="overflow-hidden rounded-2xl border border-line/80 bg-card">
          {est.top.slice(0, allItems ? undefined : 6).map((t) => (
            <li key={t.item} className="border-t border-line/60 first:border-t-0">
              <button onClick={() => setPricing(t.item)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left" aria-label={`Edit price of ${t.item}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{t.item}</span>
                  <span className="block text-[12px] text-ink-mute">{shops[t.shop].name} · ₹{priceOf(household, t.item)}{unitLabel(t.item)}</span>
                </span>
                <span className="text-[14px] font-semibold tabular">{fmtRupees(t.cost)}<span className="text-[11px] font-medium text-ink-mute"> /mo</span></span>
                <Pencil size={14} className="text-ink-mute" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-mute">Orders in {monthName}</h3>
        {logs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-mute">Nothing logged yet. Log each order or shop to see how the month is going.</p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-line/80 bg-card" data-testid="spend-list">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center gap-3 border-t border-line/60 px-4 py-2.5 first:border-t-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{l.note ?? (l.shop === 'other' ? 'Other' : shops[l.shop].name)}</span>
                  <span className="block text-[12px] text-ink-mute">{fmtShortDate(l.date)} · {l.shop === 'other' ? 'Other' : shops[l.shop].name}</span>
                </span>
                <span className="text-[15px] font-semibold tabular">{fmtRupees(l.amount)}</span>
                <button onClick={() => deleteSpend(l.id)} className="grid h-9 w-9 place-items-center rounded-full text-ink-mute hover:bg-sand hover:text-ink" aria-label={`Delete ${fmtRupees(l.amount)} order`}>
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SpendSheet open={logging} onClose={() => setLogging(false)} householdId={household.id} />
      <BudgetSheet open={editBudget} onClose={() => setEditBudget(false)} household={household} suggested={suggested} />
      <PriceSheet item={pricing} onClose={() => setPricing(null)} household={household} />
    </div>
  )
}

const PER_PIECE = new Set(['Eggs', 'Bananas', 'Apples', 'Oranges', 'Guava', 'Lemon', 'Tender coconut', 'Brown bread (slices)'])
const unitLabel = (item: string) => (PER_PIECE.has(item) ? ' each' : item === 'Milk' ? ' / litre' : ' / kg')

function SpendSheet({ open, onClose, householdId, preset }: { open: boolean; onClose: () => void; householdId: string; preset?: { shop: SpendLog['shop']; amount: number; note?: string } }) {
  const { household } = useSession()
  const shops = shopsOf(household)
  const toast = useToast()
  const [shop, setShop] = useState<SpendLog['shop']>('quick')
  const [amount, setAmount] = useState<number | ''>('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  useEffect(() => {
    if (open) {
      setShop(preset?.shop ?? 'quick')
      setAmount(preset?.amount || '')
      setNote(preset?.note ?? '')
      setDate(todayISO())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Log an order"
      description={preset ? 'This is our estimate for what you ticked. Change it to what you actually paid.' : 'What you paid for a grocery order or shop.'}
      footer={
        <Button
          size="lg"
          block
          disabled={!amount || amount <= 0}
          onClick={() => {
            addSpend(householdId, { date, shop, amount: Number(amount), note })
            toast({ text: `Logged ₹${Number(amount).toLocaleString('en-IN')}` })
            onClose()
          }}
        >
          Save
        </Button>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="flex flex-wrap gap-2">
          {[...SHOP_KINDS, 'other' as const].map((k) => (
            <Chip key={k} active={shop === k} onClick={() => setShop(k)}>
              {k === 'other' ? 'Other' : shops[k].name}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount paid">
            <NumberInput value={amount} onChange={setAmount} suffix="₹" placeholder="0" aria-label="Amount paid" />
          </Field>
          <Field label="Date">
            <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} />
          </Field>
        </div>
        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. veggies + fruit" />
        </Field>
      </div>
    </Sheet>
  )
}

function BudgetSheet({ open, onClose, household, suggested }: { open: boolean; onClose: () => void; household: Household; suggested: number }) {
  const [v, setV] = useState<number | ''>(household.budgetMonthly ?? suggested)
  useEffect(() => {
    if (open) setV(household.budgetMonthly ?? suggested)
  }, [open, household.budgetMonthly, suggested])
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Monthly grocery budget"
      description={`Your current plan costs about ₹${(suggested / 1.1).toLocaleString('en-IN', { maximumFractionDigits: 0 })} a month at estimated prices.`}
      footer={
        <Button size="lg" block disabled={!v || v <= 0} onClick={() => { updateHousehold(household.id, { budgetMonthly: Number(v) }); onClose() }}>
          Save budget
        </Button>
      }
    >
      <div className="space-y-3 pb-2">
        <NumberInput value={v} onChange={setV} suffix="₹" step={500} aria-label="Monthly budget" />
        <div className="flex flex-wrap gap-2">
          {[suggested - 1000, suggested, suggested + 1500].filter((x) => x > 0).map((x) => (
            <Chip key={x} active={v === x} onClick={() => setV(x)}>
              {fmtRupees(x)}
            </Chip>
          ))}
        </div>
      </div>
    </Sheet>
  )
}

function PriceSheet({ item, onClose, household }: { item: string | null; onClose: () => void; household: Household }) {
  const [held, setHeld] = useState(item)
  const [v, setV] = useState<number | ''>('')
  useEffect(() => {
    if (item) {
      setHeld(item)
      setV(priceOf(household, item))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item])
  const name = item ?? held ?? ''
  return (
    <Sheet
      open={!!item}
      onOpenChange={(o) => !o && onClose()}
      title={`Price of ${name.toLowerCase()}`}
      description="What you usually pay. Estimates and the budget update straight away."
      footer={
        <Button size="lg" block disabled={v === '' || v < 0} onClick={() => { setItemPrice(household.id, name, Number(v)); onClose() }}>
          Save price
        </Button>
      }
    >
      <NumberInput value={v} onChange={setV} suffix={`₹${unitLabel(name)}`} className="pb-2 [&_input]:pr-24" aria-label="Price" />
    </Sheet>
  )
}
