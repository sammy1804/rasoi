import { Camera, ListPlus, Mic, Search, Sparkles, Square, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SLOT_META, slotForNow } from '@/app/meta'
import { Button } from '@/components/ui/button'
import { Input, NumberInput } from '@/components/ui/field'
import { Sheet } from '@/components/ui/sheet'
import { Stepper } from '@/components/ui/stepper'
import { Switch } from '@/components/ui/switch'
import { savePhoto } from '@/data/photos'
import { addCustomFood, allFoods, upsertLog } from '@/data/repository'
import { useStore } from '@/data/store'
import type { Food, HouseholdMember, ISODate, MealSlot } from '@/data/types'
import { MEAL_SLOTS } from '@/data/types'
import { AssistantError, askClaude, assistantErrorText, useAbilities, useVoice } from '@/lib/assistant'
import { fmtQty } from '@/lib/format'
import { dayView } from '@/lib/summary'
import { buildIndex, itemNutrients, matchFood, understandText, type Understood, type UnderstoodItem } from '@/lib/understand'
import { cn, fmtNum } from '@/lib/utils'
import { stepFor } from './LogSheet'
import { useToast } from './Toast'

/**
 * "What did you eat?" — say it, type it or photograph it, then confirm.
 * Where Claude is available it reads photos and loose sentences; everywhere
 * else the on-phone matcher handles what was typed or said.
 */
export function SayItSheet({
  open,
  onClose,
  member,
  date,
  defaultSlot,
  initialPhotos,
  onBrowse,
}: {
  open: boolean
  onClose: () => void
  member: HouseholdMember
  date: ISODate
  defaultSlot?: MealSlot
  /** photos picked before the sheet opened (the camera button on a meal) */
  initialPhotos?: File[]
  /** open the classic food list instead */
  onBrowse: () => void
}) {
  const { db } = useStore()
  const toast = useToast()
  const abilities = useAbilities()
  const foods = useMemo(() => Object.values(allFoods(db)).filter((f) => !f.archived && (!f.householdId || f.householdId === member.householdId)), [db, member.householdId])
  const [text, setText] = useState('')
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([])
  const [slot, setSlot] = useState<MealSlot>(defaultSlot ?? slotForNow())
  const [slotTouched, setSlotTouched] = useState(false)
  const [working, setWorking] = useState(false)
  const [result, setResult] = useState<Understood | null>(null)
  const [items, setItems] = useState<UnderstoodItem[]>([])
  const [replace, setReplace] = useState(false)
  const [message, setMessage] = useState('')
  const [lang, setLang] = useState<'en' | 'hi'>('en')
  const abort = useRef<AbortController | null>(null)
  const voice = useVoice((heard) => setText((t) => (t.trim() ? t.replace(/\s+$/, '') + ' ' : '') + heard.trim()))
  const canReadPhotos = (abilities?.photos ?? 0) > 0

  const addPhotos = (files: File[]) => setPhotos((p) => [...p, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 3))

  useEffect(() => {
    if (!open) {
      abort.current?.abort()
      return
    }
    setText('')
    setResult(null)
    setItems([])
    setReplace(false)
    setMessage('')
    setWorking(false)
    setSlot(defaultSlot ?? slotForNow())
    setSlotTouched(!!defaultSlot)
    setPhotos((old) => {
      old.forEach((p) => URL.revokeObjectURL(p.url))
      return (initialPhotos ?? []).slice(0, 3).map((file) => ({ file, url: URL.createObjectURL(file) }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const workItOut = async (withPhotos = photos, withText = text) => {
    setMessage('')
    let understood: Understood | null = null
    if (abilities?.claude) {
      setWorking(true)
      abort.current = new AbortController()
      try {
        understood = await askClaude(withText, withPhotos.map((p) => p.file), foods, member.profile, abort.current.signal)
      } catch (e) {
        const code = e instanceof AssistantError ? e.code : 'failed'
        if (code === 'cancelled') return setWorking(false)
        // Claude couldn't help: fall back to the on-phone matcher when there are words to match
        if (!withText.trim()) {
          setWorking(false)
          return setMessage(assistantErrorText(code))
        }
      }
      setWorking(false)
    }
    if (!understood) {
      if (!withText.trim()) return setMessage(withPhotos.length ? 'Say or type what’s on the plate. Photos are read automatically when you open Rasoi from the Claude link; here the photo is saved with your meal.' : 'Say or type what you ate.')
      understood = understandText(withText, foods, member.profile)
    }
    if (understood.items.length === 0 && !understood.replacePlanned) return setMessage('Couldn’t find any food in that. Try something like “2 roti, 1 katori dal”.')
    setResult(understood)
    setItems(understood.items)
    setReplace(understood.replacePlanned)
    if (understood.slot && !slotTouched) setSlot(understood.slot)
  }

  // a photo on its own is enough where Claude can see it: work it out straight away
  const autoRan = useRef(false)
  useEffect(() => {
    if (!open) {
      autoRan.current = false
      return
    }
    if (!autoRan.current && canReadPhotos && photos.length > 0 && initialPhotos?.length && !result && !working) {
      autoRan.current = true
      workItOut(photos, '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, canReadPhotos, photos.length])

  const view = useMemo(() => dayView(db, member, date), [db, member, date])
  const plannedLeft = view.slots.find((s) => s.slot === slot)?.planned.filter((r) => !r.log && !r.optional) ?? []
  const ready = items.filter((it) => it.food || (it.custom?.name.trim() && it.custom.nutrients))
  const total = ready.reduce((sum, it) => {
    const n = itemNutrients(it)
    return { kcal: sum.kcal + (n?.kcal ?? 0), protein: sum.protein + (n?.protein ?? 0) }
  }, { kcal: 0, protein: 0 })
  const blocked = items.some((it) => !it.food && !(it.custom?.name.trim() && it.custom.nutrients))

  const save = async () => {
    const photoId = photos[0] ? await savePhoto(photos[0].file) : undefined
    const base = { householdId: member.householdId, userId: member.userId, date, slot, status: 'eaten' as const, photoId }
    // something that's on today's plan ticks the planned item (with what was actually eaten) instead of adding a duplicate
    const left = [...plannedLeft]
    for (const it of ready) {
      if (it.food) {
        const i = left.findIndex((r) => r.food.id === it.food!.id)
        const planned = i >= 0 ? left.splice(i, 1)[0] : undefined
        upsertLog({ ...base, foodId: it.food.id, amount: it.amount, unit: it.unit, mealItemId: planned?.item.id })
      } else {
        const n = it.custom!.nutrients!
        const food = addCustomFood(member.householdId, member.userId, { name: it.custom!.name.trim(), category: 'custom', servingName: 'serving', kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat, fibre: n.fibre })
        upsertLog({ ...base, foodId: food.id, amount: it.amount, unit: 'serving' })
      }
    }
    if (replace) for (const r of left) upsertLog({ householdId: member.householdId, userId: member.userId, date, slot, foodId: r.food.id, amount: r.portion.amount, unit: r.portion.unit, status: 'skipped', mealItemId: r.item.id })
    const label = SLOT_META[slot].label.toLowerCase()
    toast({ text: ready.length ? `Added ${ready.length} item${ready.length > 1 ? 's' : ''} to ${label}${replace && plannedLeft.length ? ', planned ones skipped' : ''}` : `Marked the planned ${label} as skipped` })
    onClose()
  }

  const update = (key: string, patch: Partial<UnderstoodItem>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)))

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={result ? 'Is this right?' : 'What did you eat?'}
      description={result ? (result.by === 'claude' ? 'Claude worked this out. Fix anything that’s off, then add it.' : 'Fix anything that’s off, then add it.') : canReadPhotos ? 'Say it, type it or take a photo. Amounts are worked out for you.' : 'Say it or type it. Amounts are worked out for you.'}
      className="h-[92dvh]"
      footer={
        result ? (
          <div className="flex gap-2">
            <Button variant="outline" size="lg" onClick={() => setResult(null)}>
              Back
            </Button>
            <Button size="lg" block disabled={blocked || (ready.length === 0 && !(replace && plannedLeft.length))} onClick={save} data-testid="sayit-add">
              {ready.length ? `Add to ${SLOT_META[slot].label.toLowerCase()} · ${fmtNum(total.kcal)} kcal` : `Skip planned ${SLOT_META[slot].label.toLowerCase()}`}
            </Button>
          </div>
        ) : (
          <Button size="lg" block disabled={working || (!text.trim() && photos.length === 0)} onClick={() => workItOut()} data-testid="sayit-go">
            {working ? (
              'Looking at it…'
            ) : (
              <>
                <Sparkles size={18} /> Work it out
              </>
            )}
          </Button>
        )
      }
    >
      {!result ? (
        <div className="space-y-4 pb-2">
          <div className="rounded-3xl border border-line bg-card p-3 shadow-soft focus-within:border-ink/30">
            <textarea
              id="sayit-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="e.g. 2 roti, 1 katori dal and half a cup of rice"
              aria-label="What you ate"
              className="block w-full resize-none bg-transparent px-1.5 py-1 text-[17px] leading-relaxed text-ink placeholder:text-ink-mute/80 focus:outline-none"
            />
            {voice.listening && <p className="px-1.5 text-[15px] italic text-ink-mute">{voice.partial || 'Listening…'}</p>}
            {photos.length > 0 && (
              <div className="mt-2 flex gap-2 px-1">
                {photos.map((p, i) => (
                  <span key={p.url} className="relative">
                    <img src={p.url} alt={`Meal photo ${i + 1}`} className="h-16 w-16 rounded-xl object-cover" />
                    <button
                      onClick={() => setPhotos((ps) => ps.filter((x) => x.url !== p.url))}
                      className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink text-paper"
                      aria-label={`Remove photo ${i + 1}`}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              {voice.supported && (
                <button
                  onClick={() => voice.toggle(lang)}
                  aria-pressed={voice.listening}
                  className={cn('inline-flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition active:scale-95 focus-ring', voice.listening ? 'bg-clay text-clay-on' : 'bg-sand text-ink')}
                >
                  {voice.listening ? <Square size={15} fill="currentColor" /> : <Mic size={18} />} {voice.listening ? 'Stop' : 'Talk'}
                </button>
              )}
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-sand px-4 text-[15px] font-semibold text-ink transition active:scale-95 focus-within:ring-2 focus-within:ring-clay/40">
                <Camera size={18} /> Photo
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const files = [...(e.target.files ?? [])]
                    e.target.value = ''
                    if (!files.length) return
                    addPhotos(files)
                    if (canReadPhotos && !text.trim()) workItOut([...photos, ...files.map((file) => ({ file, url: '' }))], '')
                  }}
                />
              </label>
              {voice.supported && (
                <button onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} className="ml-auto rounded-full px-3 py-1.5 text-[13px] font-semibold text-ink-mute hover:bg-sand" aria-label="Speech language">
                  {lang === 'en' ? 'English' : 'हिंदी'}
                </button>
              )}
            </div>
          </div>
          {!voice.supported && <p className="px-1 text-[13px] text-ink-mute">To talk instead of typing, tap the mic key on your keyboard.</p>}
          {voice.error && <p className="px-1 text-[13px] text-clay-deep">{voice.error}</p>}
          {photos.length > 0 && abilities && !canReadPhotos && <p className="rounded-2xl bg-sand px-4 py-3 text-[13px] leading-relaxed text-ink-soft">Photos are read automatically when you open Rasoi from the Claude link. Here, say or type what’s on the plate and the photo is saved with the meal.</p>}
          {message && (
            <p className="rounded-2xl bg-clay-soft px-4 py-3 text-[14px] leading-relaxed text-clay-deep" role="alert">
              {message}
            </p>
          )}
          <SlotPicker slot={slot} onChange={(s) => (setSlot(s), setSlotTouched(true))} />
          <div className="space-y-1.5">
            {['Skipped breakfast, had poha and chai instead', '2 roti, bhindi and 1 katori dal'].map((ex) => (
              <button key={ex} onClick={() => setText(ex)} className="block w-full truncate rounded-2xl border border-dashed border-line px-4 py-2.5 text-left text-[14px] text-ink-soft hover:border-ink/30">
                “{ex}”
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              onClose()
              onBrowse()
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full py-2 text-[14px] font-semibold text-ink-soft hover:text-ink"
          >
            <ListPlus size={16} /> Pick from the food list instead
          </button>
        </div>
      ) : (
        <div className="space-y-3 pb-2" data-testid="sayit-review">
          {photos.length > 0 && (
            <div className="flex gap-2">
              {photos.map((p, i) => (
                <img key={p.url} src={p.url} alt={`Meal photo ${i + 1}`} className="h-20 w-20 rounded-2xl object-cover" />
              ))}
            </div>
          )}
          {result.note && <p className="rounded-2xl bg-sand px-4 py-2.5 text-[13px] text-ink-soft">{result.note}</p>}
          <ul className="space-y-2">
            {items.map((it) => (
              <ItemRow key={it.key} it={it} foods={foods} onChange={(patch) => update(it.key, patch)} onRemove={() => setItems((xs) => xs.filter((x) => x.key !== it.key))} />
            ))}
          </ul>
          {items.length === 0 && <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-ink-mute">Nothing to add. {replace ? 'The planned meal will be marked as skipped.' : 'Go back and try again.'}</p>}
          <SlotPicker slot={slot} onChange={(s) => (setSlot(s), setSlotTouched(true))} />
          {plannedLeft.length > 0 && (
            <div className="flex items-center gap-4 rounded-2xl border border-line bg-card px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">I had this instead of the plan</span>
                <span className="block truncate text-[13px] text-ink-mute">Marks {plannedLeft.map((r) => r.food.name.toLowerCase()).join(', ')} as skipped</span>
              </span>
              <Switch checked={replace} onChange={setReplace} label="I had this instead of the plan" />
            </div>
          )}
          <p className="px-1 text-[12px] leading-relaxed text-ink-mute">
            About {fmtNum(total.kcal)} kcal · {Math.round(total.protein)} g protein. These are estimates{photos.length ? ', and portions judged from a photo are rougher still' : ''}.
          </p>
        </div>
      )}
    </Sheet>
  )
}

function SlotPicker({ slot, onChange }: { slot: MealSlot; onChange: (s: MealSlot) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Which meal">
      {MEAL_SLOTS.map((s) => (
        <button
          key={s}
          role="radio"
          aria-checked={slot === s}
          onClick={() => onChange(s)}
          className={cn('flex h-10 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold transition focus-ring', slot === s ? 'bg-ink text-paper' : 'bg-sand text-ink-soft')}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', SLOT_META[s].dot)} />
          {SLOT_META[s].label}
        </button>
      ))}
    </div>
  )
}

function ItemRow({ it, foods, onChange, onRemove }: { it: UnderstoodItem; foods: Food[]; onChange: (patch: Partial<UnderstoodItem>) => void; onRemove: () => void }) {
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState('')
  const n = itemNutrients(it)
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return []
    const best = matchFood(needle, buildIndex(foods))?.food
    const rest = foods.filter((f) => f.id !== best?.id && [f.name, ...(f.tags ?? [])].join(' ').toLowerCase().includes(needle))
    return [...(best ? [best] : []), ...rest].slice(0, 5)
  }, [q, foods])
  const pick = (f: Food) => {
    onChange({ food: f, amount: f.defaultAmount, unit: f.defaultUnit, custom: undefined, confidence: 'high' })
    setSearching(false)
  }
  const custom = it.custom
  const setN = (k: 'kcal' | 'protein', v: number | '') => onChange({ custom: { name: custom?.name ?? '', nutrients: { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, ...(custom?.nutrients ?? {}), [k]: v === '' ? 0 : v } } })

  return (
    <li className={cn('rounded-2xl border bg-card p-3', it.food ? 'border-line' : 'border-clay/40')}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {it.food ? (
            <button onClick={() => (setSearching(!searching), setQ(''))} className="flex max-w-full items-center gap-1.5 text-left" aria-label={`Change ${it.food.name}`}>
              <span className="truncate text-[16px] font-semibold">{it.food.name}</span>
              <Search size={13} className="shrink-0 text-ink-mute" />
            </button>
          ) : (
            <Input value={custom?.name ?? ''} onChange={(e) => onChange({ custom: { ...custom, name: e.target.value } })} aria-label="Food name" className="h-10" />
          )}
          <p className="mt-0.5 text-[13px] text-ink-mute tabular">
            {it.food ? '' : 'Not in the food list · '}
            {n ? `${fmtNum(n.kcal)} kcal · ${Math.round(n.protein)} g protein` : 'add calories below, or pick a food'}
            {it.confidence === 'low' && it.food ? ' · check the amount' : ''}
          </p>
        </div>
        <button onClick={onRemove} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-mute hover:bg-sand hover:text-ink focus-ring" aria-label={`Remove ${it.food?.name ?? custom?.name ?? 'item'}`}>
          <X size={16} />
        </button>
      </div>
      <div className="mt-2">
        <Stepper
          value={it.amount}
          onChange={(v) => onChange({ amount: v })}
          step={it.food ? stepFor(it.unit) : 0.5}
          min={it.food ? stepFor(it.unit) : 0.5}
          max={it.unit === 'g' || it.unit === 'ml' ? 2000 : 20}
          format={(v) => (it.food ? fmtQty(it.food, v, it.unit) : `${v} serving${v === 1 ? '' : 's'}`)}
          label={it.food?.name ?? 'amount'}
        />
      </div>
      {!it.food && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <NumberInput value={custom?.nutrients ? Math.round(custom.nutrients.kcal) : ''} onChange={(v) => setN('kcal', v)} suffix="kcal" placeholder="per serving" aria-label="Calories per serving" className="[&_input]:h-11" />
          <NumberInput value={custom?.nutrients ? Math.round(custom.nutrients.protein) : ''} onChange={(v) => setN('protein', v)} suffix="g protein" placeholder="0" aria-label="Protein per serving" className="[&_input]:h-11 [&_input]:pr-20" />
        </div>
      )}
      {(!it.food || searching) && (
        <div className="mt-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={it.food ? 'Search for the right food' : 'Or search the food list'} className="h-10 rounded-full" aria-label="Search the food list" />
          {matches.length > 0 && (
            <ul className="mt-1.5 divide-y divide-line/70 overflow-hidden rounded-xl border border-line">
              {matches.map((f) => (
                <li key={f.id}>
                  <button onClick={() => pick(f)} className="block w-full truncate px-3 py-2 text-left text-[14px] font-semibold hover:bg-sand/60">
                    {f.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}
