import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Home as HomeIcon, Link2, Sparkles, Users } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Field, Input, NumberInput } from '@/components/ui/field'
import { Segmented } from '@/components/ui/segmented'
import { Stepper } from '@/components/ui/stepper'
import { Switch } from '@/components/ui/switch'
import { NAINA_PROFILE, SAMRIDHI_PROFILE, buildDemo } from '@/data/demo'
import { checkJoin, createHousehold, joinHousehold } from '@/data/repository'
import type { Activity, Diet, Goal, PortionStyle, Profile } from '@/data/types'
import { useSession } from '@/hooks/useSession'
import { todayISO } from '@/lib/dates'
import { portionStyleForGoal, suggestTargets } from '@/lib/nutrition'
import { cn, parseJoinInput } from '@/lib/utils'

type Mode = 'create' | 'join'
type Step = 'welcome' | 'choose' | 'code' | 'about' | 'food' | 'targets' | 'household'

const CREATE_STEPS: Step[] = ['welcome', 'choose', 'about', 'food', 'targets', 'household']
const JOIN_STEPS: Step[] = ['welcome', 'choose', 'code', 'about', 'food', 'targets']

const DISLIKE_OPTIONS = ['Lauki', 'Kaddu', 'Karela', 'Spinach', 'Baingan', 'Bhindi', 'Mushroom', 'Tinda', 'Egg yolk', 'Rajma']

interface Draft {
  name: string
  age: number | ''
  sex: 'female' | 'male'
  heightCm: number | ''
  weightKg: number | ''
  goal: Goal
  activity: Activity
  activityNote: string
  diet: Diet
  dislikes: string[]
  lowBreakfast: boolean
  calorieTarget: number
  proteinMin: number
  proteinTarget: number
  portionStyle: PortionStyle
  targetsTouched: boolean
}

const emptyDraft: Draft = {
  name: '',
  age: '',
  sex: 'female',
  heightCm: '',
  weightKg: '',
  goal: 'maintain',
  activity: 'moderate',
  activityNote: '',
  diet: 'veg',
  dislikes: [],
  lowBreakfast: false,
  calorieTarget: 1800,
  proteinMin: 60,
  proteinTarget: 75,
  portionStyle: 'standard',
  targetsTouched: false,
}

function fromProfile(name: string, p: Profile): Draft {
  return {
    name,
    age: p.age ?? '',
    sex: p.sex,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    goal: p.goal,
    activity: p.activity,
    activityNote: p.activityNote ?? '',
    diet: p.diet,
    dislikes: p.dislikes.map((d) => d.charAt(0).toUpperCase() + d.slice(1)),
    lowBreakfast: p.breakfastRamp.enabled,
    calorieTarget: p.calorieTarget,
    proteinMin: p.proteinMin,
    proteinTarget: p.proteinTarget,
    portionStyle: p.portionStyle,
    targetsTouched: true,
  }
}

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
}

export function Onboarding({ initialCode }: { initialCode?: string }) {
  const navigate = useNavigate()
  const { member: existing, nameOf } = useSession()
  const joining = initialCode !== undefined
  const [mode, setMode] = useState<Mode>(joining ? 'join' : 'create')
  const [step, setStep] = useState<Step>(joining ? 'code' : 'welcome')
  const [dir, setDir] = useState(1)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [code, setCode] = useState(initialCode ?? '')
  const [householdName, setHouseholdName] = useState('Home')
  const [busy, setBusy] = useState(false)

  const steps = mode === 'create' ? CREATE_STEPS : JOIN_STEPS
  const idx = steps.indexOf(step)
  const go = (s: Step, d = 1) => {
    setDir(d)
    setStep(s)
    window.scrollTo({ top: 0 })
  }
  const next = () => go(steps[Math.min(idx + 1, steps.length - 1)], 1)
  const back = () => {
    if (joining && step === 'code') return navigate('/welcome')
    go(steps[Math.max(idx - 1, 0)], -1)
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const suggested = useMemo(() => {
    if (!draft.heightCm || !draft.weightKg) return null
    return suggestTargets({
      age: draft.age || undefined,
      sex: draft.sex,
      heightCm: draft.heightCm,
      weightKg: draft.weightKg,
      goal: draft.goal,
      activity: draft.activity,
    })
  }, [draft.age, draft.sex, draft.heightCm, draft.weightKg, draft.goal, draft.activity])

  const enterTargets = () => {
    if (!draft.targetsTouched && suggested) {
      setDraft((d) => ({ ...d, ...suggested, portionStyle: portionStyleForGoal(d.goal) }))
    }
    next()
  }

  const toProfile = (): Profile => ({
    age: draft.age || undefined,
    sex: draft.sex,
    heightCm: Number(draft.heightCm),
    weightKg: Number(draft.weightKg),
    goal: draft.goal,
    activity: draft.activity,
    activityNote: draft.activityNote.trim() || undefined,
    diet: draft.diet,
    dislikes: draft.dislikes.map((d) => d.toLowerCase()),
    calorieTarget: draft.calorieTarget,
    proteinMin: Math.min(draft.proteinMin, draft.proteinTarget),
    proteinTarget: draft.proteinTarget,
    portionStyle: draft.portionStyle,
    breakfastRamp: { enabled: draft.lowBreakfast, startPct: 70, weeklyStepPct: 10, startedOn: todayISO() },
    trackWater: true,
    waterTargetGlasses: 8,
  })

  const finishCreate = () => {
    setBusy(true)
    createHousehold({ name: draft.name, profile: toProfile() }, householdName)
    navigate('/invite?new=1', { replace: true })
  }

  const finishJoin = () => {
    setBusy(true)
    const res = joinHousehold(code, { name: draft.name, profile: toProfile() })
    if (res.error) {
      setBusy(false)
      go('code', -1)
      return
    }
    navigate('/?welcome=1', { replace: true })
  }

  const join = code ? checkJoin(code) : null
  const joinOwner = join?.members[0]

  const aboutValid = draft.name.trim().length > 0 && Number(draft.heightCm) >= 100 && Number(draft.heightCm) <= 230 && Number(draft.weightKg) >= 25 && Number(draft.weightKg) <= 250

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-paper">
      {step !== 'welcome' && (
        <header className="pt-safe sticky top-0 z-10 bg-paper/90 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4">
            <button onClick={back} className="grid h-10 w-10 place-items-center rounded-full hover:bg-sand focus-ring" aria-label="Back">
              <ArrowLeft size={20} />
            </button>
            <div className="flex flex-1 items-center justify-center gap-1.5" aria-hidden>
              {steps.slice(1).map((s, i) => (
                <span
                  key={s}
                  className={cn('h-1.5 rounded-full transition-all duration-300', i + 1 <= idx ? 'bg-ink' : 'bg-line')}
                  style={{ width: i + 1 === idx ? 22 : 6 }}
                />
              ))}
            </div>
            <span className="w-10" />
          </div>
        </header>
      )}

      <div className="relative flex flex-1 flex-col overflow-x-hidden">
          <motion.div
            key={step}
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="flex flex-1 flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))]"
          >
            {step === 'welcome' && (
              <Welcome
                existingName={existing ? nameOf(existing.userId) : undefined}
                onStart={() => {
                  setMode('create')
                  go('choose')
                }}
                onJoin={() => {
                  setMode('join')
                  go('choose')
                }}
                onDemo={() => {
                  buildDemo()
                  navigate('/', { replace: true })
                }}
                onContinue={() => navigate('/')}
              />
            )}

            {step === 'choose' && (
              <Screen title="Start a kitchen or join one" sub="One person creates the household. The other joins with a link or code — no need to set up the plan twice.">
                <div className="mt-2 space-y-3">
                  <ChoiceCard
                    active={mode === 'create'}
                    onClick={() => setMode('create')}
                    icon={<HomeIcon size={20} />}
                    title="Create a household"
                    text="Set up your goals, get the shared 7-day plan, then invite your person."
                  />
                  <ChoiceCard
                    active={mode === 'join'}
                    onClick={() => setMode('join')}
                    icon={<Link2 size={20} />}
                    title="Join a household"
                    text="Got an invite link or a 6-letter code? Join and set your own goals."
                  />
                </div>
                <Footer>
                  <Button size="lg" block onClick={next}>
                    Continue <ArrowRight size={18} />
                  </Button>
                </Footer>
              </Screen>
            )}

            {step === 'code' && (
              <Screen title="Join your household" sub="Paste the invite link, or type the 6-letter code you were sent.">
                <Field label="Invite link or code">
                  <Input
                    autoFocus={!initialCode}
                    value={code}
                    onChange={(e) => setCode(parseJoinInput(e.target.value) ?? e.target.value.toUpperCase())}
                    placeholder="e.g. 7XK92A"
                    autoCapitalize="characters"
                    autoComplete="off"
                    className="font-mono text-lg tracking-[0.2em] uppercase"
                  />
                </Field>
                <AnimatePresence mode="wait">
                  {code.length >= 4 && join && (
                    <motion.div key={join.error ?? 'ok'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
                      {join.error === 'not-found' && code.length >= 6 && (
                        <p className="rounded-2xl bg-sand px-4 py-3 text-sm text-ink-soft">
                          We couldn’t find that code. Check it with the person who invited you — codes are 6 characters.
                        </p>
                      )}
                      {join.error === 'full' && (
                        <p className="rounded-2xl bg-sand px-4 py-3 text-sm text-ink-soft">That household already has two people in it.</p>
                      )}
                      {!join.error && join.household && (
                        <div className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-soft">
                          {joinOwner && <Avatar name={nameOf(joinOwner.userId)} hue={joinOwner.hue} size={44} />}
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{join.household.name}</p>
                            <p className="text-sm text-ink-soft">
                              {joinOwner ? `${nameOf(joinOwner.userId)} is waiting for you` : 'Ready to join'}
                            </p>
                          </div>
                          <Check className="text-clay" size={20} />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                <Footer>
                  <Button size="lg" block disabled={!join || !!join.error} onClick={next}>
                    Join {join?.household?.name ?? 'household'} <ArrowRight size={18} />
                  </Button>
                </Footer>
              </Screen>
            )}

            {step === 'about' && (
              <Screen
                title={mode === 'join' ? 'Now, a little about you' : 'First, a little about you'}
                sub="Just enough to size your portions. You can change any of this later."
              >
                <QuickFill
                  onPick={(who) => setDraft(who === 'Samridhi' ? fromProfile('Samridhi', SAMRIDHI_PROFILE()) : fromProfile('Naina', NAINA_PROFILE()))}
                  suggest={mode === 'join' ? 'Naina' : 'Samridhi'}
                />
                <div className="space-y-4">
                  <Field label="What should we call you?">
                    <Input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Your name" autoComplete="given-name" />
                  </Field>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Age">
                      <NumberInput value={draft.age} onChange={(v) => set('age', v)} placeholder="—" min={12} max={100} />
                    </Field>
                    <Field label="Height">
                      <NumberInput value={draft.heightCm} onChange={(v) => set('heightCm', v)} suffix="cm" placeholder="155" />
                    </Field>
                    <Field label="Weight">
                      <NumberInput value={draft.weightKg} onChange={(v) => set('weightKg', v)} suffix="kg" placeholder="55" step={0.1} />
                    </Field>
                  </div>
                  <Field label="Your goal">
                    <div className="grid gap-2">
                      {(
                        [
                          ['lose', 'Lose weight gradually', 'Keep muscle, lighter portions'],
                          ['maintain', 'Maintain', 'Eat well, stay steady'],
                          ['gain', 'Gain weight gradually', 'Preferably muscle — heartier portions'],
                        ] as const
                      ).map(([v, t, s]) => (
                        <OptionRow key={v} active={draft.goal === v} onClick={() => set('goal', v)} title={t} sub={s} />
                      ))}
                    </div>
                  </Field>
                  <Field label="How active are you?">
                    <Segmented
                      value={draft.activity}
                      onChange={(v) => set('activity', v)}
                      options={[
                        { value: 'light', label: 'Light' },
                        { value: 'moderate', label: 'Moderate' },
                        { value: 'active', label: 'Very' },
                      ]}
                    />
                    <Input
                      className="mt-2"
                      value={draft.activityNote}
                      onChange={(e) => set('activityNote', e.target.value)}
                      placeholder="Optional — e.g. calisthenics Mon–Fri"
                    />
                  </Field>
                  <Field label="For the estimate formula" hint="Only used to suggest a starting calorie number.">
                    <Segmented
                      size="sm"
                      value={draft.sex}
                      onChange={(v) => set('sex', v)}
                      options={[
                        { value: 'female', label: 'Female' },
                        { value: 'male', label: 'Male' },
                      ]}
                    />
                  </Field>
                </div>
                <Footer>
                  <Button size="lg" block disabled={!aboutValid} onClick={next}>
                    Continue <ArrowRight size={18} />
                  </Button>
                </Footer>
              </Screen>
            )}

            {step === 'food' && (
              <Screen title="How do you eat?" sub="We’ll keep these out of your plan, or offer swaps.">
                <Field label="Diet">
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ['veg', 'Vegetarian', 'No eggs'],
                        ['egg-whites', 'Veg + egg whites', 'No yolks'],
                        ['eggs', 'Veg + eggs', 'Whole eggs fine'],
                        ['non-veg', 'Non-veg', 'Eats meat too'],
                      ] as const
                    ).map(([v, t, s]) => (
                      <OptionRow key={v} compact active={draft.diet === v} onClick={() => set('diet', v)} title={t} sub={s} />
                    ))}
                  </div>
                </Field>
                <div className="mt-6">
                  <p className="mb-2 text-[13px] font-semibold text-ink-soft">Anything you’d rather not eat?</p>
                  <DislikePicker value={draft.dislikes} onChange={(v) => set('dislikes', v)} />
                </div>
                <div className="mt-6 flex items-start gap-4 rounded-2xl border border-line bg-card p-4">
                  <div className="flex-1">
                    <p className="font-semibold">Small appetite in the mornings?</p>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      We’ll start your breakfast at about 70% and build up 10% a week — no pressure.
                    </p>
                  </div>
                  <Switch checked={draft.lowBreakfast} onChange={(v) => set('lowBreakfast', v)} label="Small breakfast appetite" />
                </div>
                <Footer>
                  <Button size="lg" block onClick={enterTargets}>
                    Continue <ArrowRight size={18} />
                  </Button>
                </Footer>
              </Screen>
            )}

            {step === 'targets' && (
              <Screen title="Your daily targets" sub="A gentle starting point based on what you told us. These are estimates, not medical advice — tweak them any time.">
                <div className="space-y-3">
                  <TargetRow
                    label="Calories"
                    sub={suggested ? `Suggested ≈ ${suggested.calorieTarget.toLocaleString('en-IN')} kcal` : undefined}
                  >
                    <Stepper
                      value={draft.calorieTarget}
                      step={50}
                      min={1000}
                      max={4000}
                      label="calories"
                      format={(n) => `${n.toLocaleString('en-IN')} kcal`}
                      onChange={(n) => setDraft((d) => ({ ...d, calorieTarget: n, targetsTouched: true }))}
                    />
                  </TargetRow>
                  <TargetRow label="Protein" sub="A range is kinder than a single number">
                    <div className="flex items-center gap-2">
                      <Stepper
                        className="flex-1"
                        value={draft.proteinMin}
                        step={5}
                        min={30}
                        max={draft.proteinTarget}
                        label="minimum protein"
                        format={(n) => `${n} g`}
                        onChange={(n) => setDraft((d) => ({ ...d, proteinMin: n, targetsTouched: true }))}
                      />
                      <span className="text-ink-mute">to</span>
                      <Stepper
                        className="flex-1"
                        value={draft.proteinTarget}
                        step={5}
                        min={draft.proteinMin}
                        max={200}
                        label="protein target"
                        format={(n) => `${n} g`}
                        onChange={(n) => setDraft((d) => ({ ...d, proteinTarget: n, targetsTouched: true }))}
                      />
                    </div>
                  </TargetRow>
                  <TargetRow label="Portions" sub="Everyone eats the same meal — only the amount changes.">
                    <Segmented
                      size="sm"
                      value={draft.portionStyle}
                      onChange={(v) => set('portionStyle', v)}
                      options={[
                        { value: 'lighter', label: 'Lighter' },
                        { value: 'standard', label: 'Standard' },
                        { value: 'hearty', label: 'Hearty' },
                      ]}
                    />
                    <p className="mt-2 text-xs text-ink-mute">{portionExample(draft.portionStyle)}</p>
                  </TargetRow>
                </div>
                <Footer>
                  {mode === 'create' ? (
                    <Button size="lg" block onClick={next}>
                      Looks good <ArrowRight size={18} />
                    </Button>
                  ) : (
                    <Button size="lg" variant="accent" block disabled={busy} onClick={finishJoin}>
                      Join and see today’s plan <ArrowRight size={18} />
                    </Button>
                  )}
                </Footer>
              </Screen>
            )}

            {step === 'household' && (
              <Screen title="Name your kitchen" sub="This is what your person will see when they join.">
                <Field label="Household name">
                  <Input value={householdName} onChange={(e) => setHouseholdName(e.target.value)} placeholder="Home" />
                </Field>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Home', 'Our kitchen', 'Flat 4B', 'The Rasoi'].map((n) => (
                    <Chip key={n} active={householdName === n} onClick={() => setHouseholdName(n)}>
                      {n}
                    </Chip>
                  ))}
                </div>
                <div className="mt-8 rounded-2xl bg-sand/70 p-4 text-sm text-ink-soft">
                  <p className="flex items-center gap-2 font-semibold text-ink">
                    <Sparkles size={16} className="text-clay" /> Your shared plan is ready
                  </p>
                  <p className="mt-1">
                    A 7-day home-style rotation — chilla, dal-chawal, paneer, soya, chaat. Edit it any time from the Week tab.
                  </p>
                </div>
                <Footer>
                  <Button size="lg" variant="accent" block disabled={busy || !householdName.trim()} onClick={finishCreate}>
                    Create household <ArrowRight size={18} />
                  </Button>
                </Footer>
              </Screen>
            )}
          </motion.div>
      </div>
    </div>
  )
}

function portionExample(style: PortionStyle) {
  if (style === 'lighter') return 'e.g. Kadai paneer: 80–100 g paneer + 1–2 chapatis'
  if (style === 'hearty') return 'e.g. Kadai paneer: 100–120 g paneer + 2–3 chapatis + optional curd'
  return 'e.g. Kadai paneer: ~100 g paneer + 2 chapatis'
}

/* ———————— Pieces ———————— */

function Welcome({
  onStart,
  onJoin,
  onDemo,
  existingName,
  onContinue,
}: {
  onStart: () => void
  onJoin: () => void
  onDemo: () => void
  existingName?: string
  onContinue: () => void
}) {
  return (
    <div className="flex flex-1 flex-col pt-safe">
      <div className="flex items-center justify-between pt-6">
        <span className="font-display text-xl font-semibold tracking-tight">rasoi</span>
        <button onClick={onDemo} className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-ink-soft hover:bg-sand focus-ring">
          Try demo
        </button>
      </div>
      <div className="relative mt-8 flex flex-1 flex-col justify-center">
        <PlateArt />
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mt-10 font-display text-[44px] font-medium leading-[1.02] tracking-[-0.02em]"
        >
          Eat better.
          <br />
          <span className="italic text-clay">Together.</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mt-4 text-lg text-ink-soft">
          One kitchen. One meal plan.
          <br />
          Your own goals.
        </motion.p>
      </div>
      <div className="space-y-2 pb-2 pt-8">
        {existingName ? (
          <Button size="lg" block onClick={onContinue}>
            Continue as {existingName}
          </Button>
        ) : null}
        <Button size="lg" variant={existingName ? 'outline' : 'primary'} block onClick={onStart}>
          Create a shared plan
        </Button>
        <Button size="lg" variant="ghost" block onClick={onJoin}>
          <Users size={18} /> I have an invite
        </Button>
      </div>
    </div>
  )
}

function PlateArt() {
  const items = [
    { c: 'bg-meal-breakfast', x: -64, y: -8, s: 46, d: 0.15 },
    { c: 'bg-meal-lunch', x: 8, y: -34, s: 58, d: 0.22 },
    { c: 'bg-meal-snack', x: 66, y: 6, s: 38, d: 0.29 },
    { c: 'bg-meal-dinner', x: -8, y: 34, s: 50, d: 0.36 },
  ]
  return (
    <div className="relative mx-auto h-48 w-48" aria-hidden>
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 18 }}
        className="absolute inset-0 rounded-full border border-line bg-card shadow-lift"
      />
      <div className="absolute inset-5 rounded-full border border-dashed border-line" />
      {items.map((it, i) => (
        <motion.span
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.9 }}
          transition={{ delay: it.d, type: 'spring', stiffness: 260, damping: 16 }}
          className={cn('absolute left-1/2 top-1/2 rounded-full', it.c)}
          style={{ width: it.s, height: it.s, marginLeft: it.x - it.s / 2, marginTop: it.y - it.s / 2 }}
        />
      ))}
    </div>
  )
}

function Screen({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col pt-2">
      <h1 className="font-display text-[30px] font-medium leading-tight tracking-tight">{title}</h1>
      {sub && <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{sub}</p>}
      <div className="mt-6 flex flex-1 flex-col">{children}</div>
    </div>
  )
}

function Footer({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-0 -mx-6 mt-auto bg-gradient-to-t from-paper via-paper to-paper/0 px-6 pb-2 pt-6">{children}</div>
}

function ChoiceCard({ active, onClick, icon, title, text }: { active: boolean; onClick: () => void; icon: ReactNode; title: string; text: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex w-full items-start gap-4 rounded-2xl border bg-card p-4 text-left transition focus-ring',
        active ? 'border-ink shadow-soft' : 'border-line hover:border-ink/20',
      )}
    >
      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', active ? 'bg-ink text-paper' : 'bg-sand text-ink-soft')}>{icon}</span>
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm text-ink-soft">{text}</span>
      </span>
      <span className={cn('mt-1 grid h-5 w-5 place-items-center rounded-full border-2', active ? 'border-ink bg-ink' : 'border-line')}>
        {active && <Check size={12} className="text-paper" strokeWidth={3.5} />}
      </span>
    </button>
  )
}

function OptionRow({ active, onClick, title, sub, compact }: { active: boolean; onClick: () => void; title: string; sub: string; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border bg-card text-left transition focus-ring',
        compact ? 'px-3.5 py-3' : 'px-4 py-3.5',
        active ? 'border-ink shadow-soft' : 'border-line hover:border-ink/20',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug">{title}</span>
        <span className="block text-[13px] text-ink-mute">{sub}</span>
      </span>
      {!compact && (
        <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full border-2', active ? 'border-ink bg-ink' : 'border-line')}>
          {active && <Check size={12} className="text-paper" strokeWidth={3.5} />}
        </span>
      )}
    </button>
  )
}

function TargetRow({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="font-semibold">{label}</span>
        {sub && <span className="text-right text-xs text-ink-mute">{sub}</span>}
      </div>
      {children}
    </div>
  )
}

export function DislikePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [custom, setCustom] = useState('')
  const all = [...new Set([...DISLIKE_OPTIONS, ...value])]
  const toggle = (d: string) => onChange(value.some((v) => v.toLowerCase() === d.toLowerCase()) ? value.filter((v) => v.toLowerCase() !== d.toLowerCase()) : [...value, d])
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {all.map((d) => (
          <Chip key={d} active={value.some((v) => v.toLowerCase() === d.toLowerCase())} onClick={() => toggle(d)}>
            {d}
          </Chip>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const c = custom.trim()
          if (c && !value.some((v) => v.toLowerCase() === c.toLowerCase())) onChange([...value, c.charAt(0).toUpperCase() + c.slice(1)])
          setCustom('')
        }}
      >
        <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add another…" className="h-10 rounded-full" />
        <Button type="submit" size="sm" variant="secondary" className="h-10" disabled={!custom.trim()}>
          Add
        </Button>
      </form>
    </div>
  )
}

function QuickFill({ onPick, suggest }: { onPick: (who: 'Samridhi' | 'Naina') => void; suggest: 'Samridhi' | 'Naina' }) {
  const other = suggest === 'Samridhi' ? 'Naina' : 'Samridhi'
  return (
    <div className="-mt-2 mb-5 flex flex-wrap items-center gap-2 text-[13px] text-ink-mute">
      <span>Testing?</span>
      <button className="rounded-full bg-sand px-3 py-1 font-semibold text-ink-soft hover:text-ink focus-ring" onClick={() => onPick(suggest)}>
        Fill in as {suggest}
      </button>
      <button className="rounded-full px-2 py-1 font-semibold hover:text-ink-soft focus-ring" onClick={() => onPick(other)}>
        or {other}
      </button>
    </div>
  )
}

