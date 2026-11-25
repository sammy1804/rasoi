import { ChevronRight, ClipboardCopy, ClipboardPaste, Copy, Info, LogOut, Pencil, RefreshCw, Repeat, RotateCcw, Smartphone, Sparkles, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDay } from '@/app/DayContext'
import { Avatar } from '@/components/Avatar'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Field, Input, NumberInput } from '@/components/ui/field'
import { Segmented } from '@/components/ui/segmented'
import { Sheet } from '@/components/ui/sheet'
import { Stepper } from '@/components/ui/stepper'
import { Switch } from '@/components/ui/switch'
import { buildDemo } from '@/data/demo'
import { getBackup, restoreBackup } from '@/data/store'
import { DataSheet, InstallSheet, useCopyData } from '@/components/AppSheets'
import { useInstall } from '@/lib/install'
import { resetAll, resetTips, signOut, switchUser, updateHouseholdName, updateProfile, updateSharing, updateUserName } from '@/data/repository'
import type { Diet, Goal, PortionStyle, Profile } from '@/data/types'
import { useSession } from '@/hooks/useSession'
import { todayISO } from '@/lib/dates'
import { PORTION_LABEL, suggestTargets } from '@/lib/nutrition'
import { copyText, inviteText } from './Invite'
import { IS_MOBILE_PAGE } from '@/app/target'
import { DislikePicker } from './Onboarding'

const GOAL_LABEL: Record<Goal, string> = { lose: 'Lose weight gradually', maintain: 'Maintain', gain: 'Gain weight gradually' }
const DIET_LABEL: Record<Diet, string> = { veg: 'Vegetarian', 'egg-whites': 'Veg + egg whites', eggs: 'Veg + eggs', 'non-veg': 'Non-veg' }

type SheetKind = null | 'name' | 'targets' | 'body' | 'food' | 'household' | 'demo' | 'reset' | 'leave' | 'install' | 'data' | 'restore'

export function ProfileScreen() {
  const { member, user, household, members, partner, nameOf, db } = useSession()
  const me = member!
  const p = me.profile
  const [sheet, setSheet] = useState<SheetKind>(null)
  const navigate = useNavigate()
  const toast = useToast()
  const { hash } = useLocation()
  const { setViewUserId, setDate } = useDay()

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  const patch = (x: Partial<Profile>) => updateProfile(me.id, x)
  const { standalone } = useInstall()
  const { copy } = useCopyData()
  const backup = useMemo(() => getBackup(), [db])
  const backupWhen = backup ? new Date(backup.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''
  const partnerName = partner ? nameOf(partner.userId) : 'your person'

  return (
    <div className="px-4">
      <header className="pt-safe">
        <div className="flex items-center gap-4 pt-6">
          <Avatar name={user!.name} hue={me.hue} size={64} />
          <div className="min-w-0 flex-1">
            <button onClick={() => setSheet('name')} className="group flex items-center gap-2 text-left">
              <h1 className="truncate font-display text-[28px] font-medium tracking-tight">{user!.name}</h1>
              <Pencil size={15} className="text-ink-mute group-hover:text-ink" />
            </button>
            <p className="text-[14px] text-ink-soft">
              {household?.name} · {me.role === 'owner' ? 'created the household' : 'member'}
            </p>
          </div>
        </div>
      </header>

      <Section title="Goals & targets" action={<EditBtn onClick={() => setSheet('targets')} />}>
        <Row label="Goal" value={GOAL_LABEL[p.goal]} />
        <Row label="Calories" value={`≈ ${p.calorieTarget.toLocaleString('en-IN')} kcal / day`} />
        <Row label="Protein" value={`${p.proteinMin}–${p.proteinTarget} g / day`} />
        <Row label="Portions" value={PORTION_LABEL[p.portionStyle]} />
      </Section>

      <Section title="Body" action={<EditBtn onClick={() => setSheet('body')} />}>
        <Row label="Height" value={`${p.heightCm} cm`} />
        <Row label="Weight" value={`${p.weightKg} kg`} />
        {p.age && <Row label="Age" value={`${p.age}`} />}
        <Row label="Activity" value={`${{ light: 'Light', moderate: 'Moderate', active: 'Very active' }[p.activity]}${p.activityNote ? ` · ${p.activityNote}` : ''}`} />
      </Section>

      <Section title="Food preferences" action={<EditBtn onClick={() => setSheet('food')} />}>
        <Row label="Diet" value={DIET_LABEL[p.diet]} />
        <Row label="Rather not eat" value={p.dislikes.length ? p.dislikes.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ') : 'Nothing listed'} />
      </Section>

      <Section title="Breakfast, movement & water">
        <ToggleRow
          label="Build up breakfast gradually"
          sub={p.breakfastRamp.enabled ? `Starting at ${p.breakfastRamp.startPct}%, +${p.breakfastRamp.weeklyStepPct}% a week` : 'For small morning appetites'}
          checked={p.breakfastRamp.enabled}
          onChange={(v) => patch({ breakfastRamp: { ...p.breakfastRamp, enabled: v, startedOn: v ? todayISO() : p.breakfastRamp.startedOn } })}
        />
        {p.breakfastRamp.enabled && (
          <div className="grid grid-cols-2 gap-2 px-4 pb-3">
            <Stepper value={p.breakfastRamp.startPct} step={5} min={40} max={100} format={(v) => `${v}% start`} label="starting breakfast percentage" onChange={(v) => patch({ breakfastRamp: { ...p.breakfastRamp, startPct: v } })} />
            <Stepper value={p.breakfastRamp.weeklyStepPct} step={5} min={5} max={30} format={(v) => `+${v}%/wk`} label="weekly increase" onChange={(v) => patch({ breakfastRamp: { ...p.breakfastRamp, weeklyStepPct: v } })} />
          </div>
        )}
        <ToggleRow
          label="Calories follow my activity"
          sub={p.adjustForActivity === false ? `Always ${p.calorieTarget.toLocaleString('en-IN')} kcal` : 'More on active days, a little less on quiet ones (±250 kcal at most)'}
          checked={p.adjustForActivity !== false}
          onChange={(v) => patch({ adjustForActivity: v })}
        />
        <div className="border-t border-line/60 px-4 py-3">
          <p className="mb-2 text-[15px] font-semibold">Daily step goal</p>
          <Stepper value={p.stepGoal ?? 8000} step={500} min={2000} max={30000} format={(v) => `${v.toLocaleString('en-IN')} steps`} label="step goal" onChange={(v) => patch({ stepGoal: v })} />
        </div>
        <ToggleRow label="Track water" sub="Optional glasses counter on Home" checked={p.trackWater} onChange={(v) => patch({ trackWater: v })} />
        {p.trackWater && (
          <div className="px-4 pb-3">
            <Stepper value={p.waterTargetGlasses} step={1} min={4} max={14} format={(v) => `${v} glasses / day`} label="water target" onChange={(v) => patch({ waterTargetGlasses: v })} />
          </div>
        )}
      </Section>

      <Section id="sharing" title={`What ${partnerName} can see`}>
        <p className="px-4 pb-1 pt-3 text-[13px] text-ink-soft">You share the meal plan either way. Choose what of your own tracking is visible.</p>
        <ToggleRow label="Full food log" sub="Every item you tick or add" checked={me.sharing.fullLog} onChange={(v) => updateSharing(me.id, { fullLog: v })} />
        <ToggleRow label="Calories" checked={me.sharing.calories} onChange={(v) => updateSharing(me.id, { calories: v })} />
        <ToggleRow label="Protein" checked={me.sharing.protein} onChange={(v) => updateSharing(me.id, { protein: v })} />
        <ToggleRow label="Meal completion" sub="e.g. “3 of 4 meals done” — the minimum" checked={me.sharing.mealCompletion} onChange={(v) => updateSharing(me.id, { mealCompletion: v })} />
      </Section>

      <Section title="Household" action={<EditBtn onClick={() => setSheet('household')} label="Rename" />}>
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-mute">Join code</p>
              <p className="font-mono text-[22px] font-semibold tracking-[0.16em]">{household?.code}</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const ok = await copyText(inviteText(household!.code, household!.name))
                toast({ text: ok ? 'Invite copied' : 'Couldn’t copy — share the code instead' })
              }}
            >
              <Copy size={14} /> {IS_MOBILE_PAGE ? 'Copy invite' : 'Copy link'}
            </Button>
          </div>
        </div>
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 border-t border-line/60 px-4 py-3">
            <Avatar name={nameOf(m.userId)} hue={m.hue} size={32} />
            <span className="flex-1 text-[15px] font-semibold">
              {nameOf(m.userId)} {m.userId === me.userId && <span className="font-medium text-ink-mute">(you)</span>}
            </span>
            <span className="text-[12px] text-ink-mute">{PORTION_LABEL[m.profile.portionStyle]}</span>
          </div>
        ))}
        {!partner && (
          <button onClick={() => navigate('/invite')} className="flex w-full items-center gap-3 border-t border-line/60 px-4 py-3 text-left text-[15px] font-semibold text-clay">
            <UserPlus size={18} /> Invite your second person <ChevronRight size={16} className="ml-auto" />
          </button>
        )}
      </Section>

      <Section title="This device">
        {partner && (
          <ActionRow
            icon={<Repeat size={17} />}
            label={`Switch to ${partnerName}`}
            sub="For testing both people on one phone"
            onClick={() => {
              switchUser(partner.userId)
              setViewUserId(null)
              setDate(todayISO())
              navigate('/')
              toast({ text: `Now using Rasoi as ${partnerName}` })
            }}
          />
        )}
        <ActionRow
          icon={<Sparkles size={17} />}
          label="Replay the welcome tips"
          onClick={() => {
            resetTips(me.id)
            setDate(todayISO())
            navigate('/')
          }}
        />
        <ActionRow
          icon={<LogOut size={17} />}
          label="Sign out on this device"
          sub="Your data stays in the household"
          onClick={() => {
            signOut()
            navigate('/welcome')
          }}
        />
      </Section>

      <Section id="app" title="App on your phone">
        <ActionRow
          icon={<Smartphone size={17} />}
          label={standalone && !IS_MOBILE_PAGE ? 'Rasoi is on your home screen' : 'Add Rasoi to your home screen'}
          sub={standalone && !IS_MOBILE_PAGE ? 'It updates itself and works offline' : 'An app icon that opens full screen and updates itself'}
          onClick={() => setSheet('install')}
        />
        <ActionRow icon={<ClipboardCopy size={17} />} label="Copy my data" sub="To move it into the app or onto another phone" onClick={copy} />
        <ActionRow icon={<ClipboardPaste size={17} />} label="Bring my data" sub="Paste data copied from another copy of Rasoi" onClick={() => setSheet('data')} />
        {backup && <ActionRow icon={<RotateCcw size={17} />} label="Put back the previous data" sub={`What was here before the last demo, reset or import · ${backupWhen}`} onClick={() => setSheet('restore')} />}
      </Section>

      <Section title="Demo & data">
        <ActionRow icon={<RefreshCw size={17} />} label="Load demo household" sub="Samridhi & Naina with two weeks of history" onClick={() => setSheet('demo')} />
        <ActionRow icon={<Trash2 size={17} />} label="Reset all data" sub="Start again from the welcome screen" danger onClick={() => setSheet('reset')} />
      </Section>

      <p className="mx-1 mt-6 flex gap-2 text-[12px] leading-relaxed text-ink-mute">
        <Info size={14} className="mt-0.5 shrink-0" />
        Calorie and protein numbers in Rasoi are approximate estimates for home-cooked food. They’re here to guide, not to diagnose — for medical or dietary advice, please talk to a doctor or registered dietitian.
      </p>

      {/* ——— Sheets ——— */}
      <NameSheet open={sheet === 'name'} onClose={() => setSheet(null)} initial={user!.name} onSave={(n) => updateUserName(user!.id, n)} title="Your name" />
      <NameSheet open={sheet === 'household'} onClose={() => setSheet(null)} initial={household?.name ?? ''} onSave={(n) => updateHouseholdName(household!.id, n)} title="Household name" />
      <TargetsSheet open={sheet === 'targets'} onClose={() => setSheet(null)} profile={p} onSave={patch} />
      <BodySheet open={sheet === 'body'} onClose={() => setSheet(null)} profile={p} onSave={patch} />
      <FoodSheet open={sheet === 'food'} onClose={() => setSheet(null)} profile={p} onSave={patch} />
      <ConfirmSheet
        open={sheet === 'demo'}
        onClose={() => setSheet(null)}
        title="Load the demo household?"
        body="This replaces everything stored in this browser with a demo of Samridhi and Naina, including two weeks of logs and weigh-ins. Your own data is kept aside: Profile → “Put back the previous data” brings it back."
        confirm="Load demo"
        onConfirm={() => {
          buildDemo()
          setViewUserId(null)
          setDate(todayISO())
          navigate('/')
          toast({ text: 'Demo loaded — you’re Samridhi' })
        }}
      />
      <InstallSheet open={sheet === 'install'} onClose={() => setSheet(null)} />
      <DataSheet
        open={sheet === 'data'}
        onClose={() => setSheet(null)}
        onDone={(d) => {
          setSheet(null)
          setViewUserId(null)
          setDate(todayISO())
          navigate(d.userId ? '/' : '/welcome')
        }}
      />
      <ConfirmSheet
        open={sheet === 'restore'}
        onClose={() => setSheet(null)}
        title="Put back the previous data?"
        body={`This brings back what was on this phone before the last demo, reset or import (saved ${backupWhen}). What’s here now is kept, so you can swap back.`}
        confirm="Put it back"
        onConfirm={() => {
          restoreBackup()
          setViewUserId(null)
          setDate(todayISO())
          navigate('/')
          toast({ text: 'Your previous data is back' })
        }}
      />
      <ConfirmSheet
        open={sheet === 'reset'}
        onClose={() => setSheet(null)}
        title="Reset all data?"
        body="This clears the household, both profiles, the plan and every log stored in this browser. One copy is kept aside, so “Put back the previous data” can still bring it back."
        confirm="Delete everything"
        danger
        onConfirm={() => {
          resetAll()
          navigate('/welcome')
        }}
      />
    </div>
  )
}

/* ——————— Pieces ——————— */

function Section({ title, action, children, id }: { title: string; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-6 scroll-mt-6">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-mute">{title}</h2>
        {action}
      </div>
      <div className="overflow-hidden rounded-2xl border border-line/80 bg-card shadow-soft">{children}</div>
    </section>
  )
}

function EditBtn({ onClick, label = 'Edit' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="rounded-full px-2.5 py-1 text-[13px] font-semibold text-clay hover:bg-clay-soft focus-ring">
      {label}
    </button>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-line/60 px-4 py-3 first:border-t-0">
      <span className="text-[14px] text-ink-soft">{label}</span>
      <span className="text-right text-[14px] font-semibold">{value}</span>
    </div>
  )
}

function ToggleRow({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-4 border-t border-line/60 px-4 py-3 first:border-t-0">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{label}</span>
        {sub && <span className="block text-[13px] text-ink-mute">{sub}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

function ActionRow({ icon, label, sub, onClick, danger }: { icon: ReactNode; label: string; sub?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 border-t border-line/60 px-4 py-3 text-left transition first:border-t-0 hover:bg-sand/40">
      <span className={danger ? 'text-danger' : 'text-ink-soft'}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-semibold ${danger ? 'text-danger' : ''}`}>{label}</span>
        {sub && <span className="block text-[13px] text-ink-mute">{sub}</span>}
      </span>
      <ChevronRight size={16} className="text-ink-mute" />
    </button>
  )
}

function NameSheet({ open, onClose, initial, onSave, title }: { open: boolean; onClose: () => void; initial: string; onSave: (n: string) => void; title: string }) {
  const [v, setV] = useState(initial)
  useEffect(() => setV(initial), [initial, open])
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      footer={
        <Button size="lg" block disabled={!v.trim()} onClick={() => { onSave(v); onClose() }}>
          Save
        </Button>
      }
    >
      <Input value={v} onChange={(e) => setV(e.target.value)} autoFocus />
    </Sheet>
  )
}

function TargetsSheet({ open, onClose, profile, onSave }: { open: boolean; onClose: () => void; profile: Profile; onSave: (p: Partial<Profile>) => void }) {
  const [d, setD] = useState(profile)
  useEffect(() => setD(profile), [profile, open])
  const s = suggestTargets(d)
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Goals & targets"
      description="Rough targets are fine. Change them whenever your goals change."
      footer={
        <Button size="lg" block onClick={() => { onSave({ goal: d.goal, calorieTarget: d.calorieTarget, proteinMin: Math.min(d.proteinMin, d.proteinTarget), proteinTarget: d.proteinTarget, portionStyle: d.portionStyle }); onClose() }}>
          Save targets
        </Button>
      }
    >
      <div className="space-y-5 pb-2">
        <Field label="Goal">
          <Segmented
            size="sm"
            value={d.goal}
            onChange={(g) => setD({ ...d, goal: g, portionStyle: g === 'lose' ? 'lighter' : g === 'gain' ? 'hearty' : 'standard' })}
            options={[
              { value: 'lose', label: 'Lose' },
              { value: 'maintain', label: 'Maintain' },
              { value: 'gain', label: 'Gain' },
            ]}
          />
        </Field>
        <Field label="Calories per day" hint={`Estimate from your details: ≈ ${s.calorieTarget.toLocaleString('en-IN')} kcal`}>
          <Stepper value={d.calorieTarget} step={50} min={1000} max={4000} format={(v) => `${v.toLocaleString('en-IN')} kcal`} label="calories" onChange={(v) => setD({ ...d, calorieTarget: v })} />
        </Field>
        <Field label="Protein range" hint={`Estimate: ${s.proteinMin}–${s.proteinTarget} g`}>
          <div className="flex items-center gap-2">
            <Stepper className="flex-1" value={d.proteinMin} step={5} min={30} max={d.proteinTarget} format={(v) => `${v} g`} label="minimum protein" onChange={(v) => setD({ ...d, proteinMin: v })} />
            <span className="text-ink-mute">to</span>
            <Stepper className="flex-1" value={d.proteinTarget} step={5} min={d.proteinMin} max={200} format={(v) => `${v} g`} label="protein target" onChange={(v) => setD({ ...d, proteinTarget: v })} />
          </div>
        </Field>
        <Button variant="secondary" size="sm" onClick={() => setD({ ...d, ...s })}>
          Use the estimate
        </Button>
        <Field label="Portion size of shared meals">
          <Segmented
            size="sm"
            value={d.portionStyle}
            onChange={(v: PortionStyle) => setD({ ...d, portionStyle: v })}
            options={[
              { value: 'lighter', label: 'Lighter' },
              { value: 'standard', label: 'Standard' },
              { value: 'hearty', label: 'Hearty' },
            ]}
          />
        </Field>
      </div>
    </Sheet>
  )
}

function BodySheet({ open, onClose, profile, onSave }: { open: boolean; onClose: () => void; profile: Profile; onSave: (p: Partial<Profile>) => void }) {
  const [h, setH] = useState<number | ''>(profile.heightCm)
  const [w, setW] = useState<number | ''>(profile.weightKg)
  const [a, setA] = useState<number | ''>(profile.age ?? '')
  const [act, setAct] = useState(profile.activity)
  const [note, setNote] = useState(profile.activityNote ?? '')
  useEffect(() => {
    setH(profile.heightCm)
    setW(profile.weightKg)
    setA(profile.age ?? '')
    setAct(profile.activity)
    setNote(profile.activityNote ?? '')
  }, [profile, open])
  const valid = Number(h) >= 100 && Number(h) <= 230 && Number(w) >= 25 && Number(w) <= 250
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Body & activity"
      description="Used only to suggest targets."
      footer={
        <Button size="lg" block disabled={!valid} onClick={() => { onSave({ heightCm: Number(h), weightKg: Number(w), age: a || undefined, activity: act, activityNote: note.trim() || undefined }); onClose() }}>
          Save
        </Button>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Age"><NumberInput value={a} onChange={setA} /></Field>
          <Field label="Height"><NumberInput value={h} onChange={setH} suffix="cm" /></Field>
          <Field label="Weight"><NumberInput value={w} onChange={setW} suffix="kg" step={0.1} /></Field>
        </div>
        <Field label="Activity">
          <Segmented size="sm" value={act} onChange={setAct} options={[{ value: 'light', label: 'Light' }, { value: 'moderate', label: 'Moderate' }, { value: 'active', label: 'Very' }]} />
        </Field>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. calisthenics Mon–Fri" />
      </div>
    </Sheet>
  )
}

function FoodSheet({ open, onClose, profile, onSave }: { open: boolean; onClose: () => void; profile: Profile; onSave: (p: Partial<Profile>) => void }) {
  const [diet, setDiet] = useState(profile.diet)
  const [dislikes, setDislikes] = useState(profile.dislikes.map((d) => d.charAt(0).toUpperCase() + d.slice(1)))
  useEffect(() => {
    setDiet(profile.diet)
    setDislikes(profile.dislikes.map((d) => d.charAt(0).toUpperCase() + d.slice(1)))
  }, [profile, open])
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Food preferences"
      footer={
        <Button size="lg" block onClick={() => { onSave({ diet, dislikes: dislikes.map((d) => d.toLowerCase()) }); onClose() }}>
          Save
        </Button>
      }
    >
      <div className="space-y-5 pb-2">
        <Field label="Diet">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(DIET_LABEL) as Diet[]).map((k) => (
              <button
                key={k}
                onClick={() => setDiet(k)}
                aria-pressed={diet === k}
                className={`rounded-2xl border px-3 py-3 text-left text-[14px] font-semibold transition ${diet === k ? 'border-ink bg-card shadow-soft' : 'border-line bg-card text-ink-soft'}`}
              >
                {DIET_LABEL[k]}
              </button>
            ))}
          </div>
        </Field>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink-soft">Rather not eat</p>
          <DislikePicker value={dislikes} onChange={setDislikes} />
        </div>
      </div>
    </Sheet>
  )
}

function ConfirmSheet({ open, onClose, title, body, confirm, onConfirm, danger }: { open: boolean; onClose: () => void; title: string; body: string; confirm: string; onConfirm: () => void; danger?: boolean }) {
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      description={body}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" block onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} size="lg" block onClick={() => { onClose(); onConfirm() }}>
            {confirm}
          </Button>
        </div>
      }
    >
      <span />
    </Sheet>
  )
}
