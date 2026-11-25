import { Check, ClipboardCopy, ClipboardPaste, Download, ExternalLink, MoreVertical, Share, Smartphone, SquarePlus, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { IS_MOBILE_PAGE, publicBase } from '@/app/target'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { exportData, hasData, importData, readData, type ReadData } from '@/lib/backup'
import { applyUpdate, isIOSSafari, promptInstall, useInstall } from '@/lib/install'
import { cn } from '@/lib/utils'
import { copyText } from '@/screens/Invite'
import { useToast } from './Toast'

/* ——————————— Copy my data ——————————— */

export function useCopyData() {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    const ok = await copyText(await exportData())
    setCopied(ok)
    toast({ text: ok ? 'Your data is copied — paste it into the app' : 'Couldn’t copy on this phone' })
    return ok
  }
  return { copy, copied }
}

/* ——————————— Get Rasoi on your home screen ——————————— */

function Step({ n, done, title, children }: { n: number; done?: boolean; title: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold', done ? 'bg-clay text-clay-on' : 'bg-sand text-ink')}>
        {done ? <Check size={14} strokeWidth={3} /> : n}
      </span>
      <div className="min-w-0 flex-1 pb-1">
        <p className="text-[15px] font-semibold leading-snug">{title}</p>
        {children && <div className="mt-1 text-[14px] leading-relaxed text-ink-soft">{children}</div>}
      </div>
    </li>
  )
}

const Key = ({ children }: { children: ReactNode }) => <span className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-sand px-1.5 py-0.5 align-middle text-[13px] font-semibold text-ink">{children}</span>

function AddSteps({ start }: { start: number }) {
  const { platform } = useInstall()
  if (platform === 'ios')
    return (
      <>
        <Step n={start} title="Tap the Share button">
          At the bottom of Safari (or next to the address bar): <Key><Share size={13} /> Share</Key>
        </Step>
        <Step n={start + 1} title="Choose “Add to Home Screen”">
          Scroll the list a little if you don’t see it: <Key><SquarePlus size={13} /> Add to Home Screen</Key>, then <Key>Add</Key>.
        </Step>
      </>
    )
  return (
    <>
      <Step n={start} title="Open the browser menu">
        In Chrome, the <Key><MoreVertical size={13} /></Key> at the top right.
      </Step>
      <Step n={start + 1} title="Choose “Install app” or “Add to Home screen”">
        Then <Key>Install</Key>. Rasoi’s icon appears with your other apps.
      </Step>
    </>
  )
}

export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { canPrompt, standalone, platform } = useInstall()
  const { copy, copied } = useCopyData()
  const toast = useToast()
  const url = publicBase()
  const withData = hasData()
  // On iPhone the home-screen app keeps its own storage, separate from Safari and from the Claude page.
  const needsMove = withData && (IS_MOBILE_PAGE || platform === 'ios')

  let body: ReactNode
  if (IS_MOBILE_PAGE) {
    body = (
      <ol className="space-y-4">
        {withData && (
          <Step n={1} done={copied} title="Copy your data">
            So your meals, logs and settings come with you.
            <span className="mt-2 block">
              <Button variant="secondary" size="sm" onClick={copy}>
                <ClipboardCopy size={15} /> {copied ? 'Copied' : 'Copy my data'}
              </Button>
            </span>
          </Step>
        )}
        <Step n={withData ? 2 : 1} title={`Open Rasoi in ${platform === 'ios' ? 'Safari' : 'Chrome'}`}>
          <span className="block break-all font-medium text-ink">{url}</span>
          <span className="mt-2 flex flex-wrap gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-full bg-ink px-3.5 text-[13px] font-semibold text-paper">
              <ExternalLink size={14} /> Open
            </a>
            <Button variant="secondary" size="sm" onClick={async () => toast({ text: (await copyText(url)) ? 'Link copied — paste it in Safari' : 'Couldn’t copy' })}>
              <ClipboardCopy size={14} /> Copy link
            </Button>
          </span>
          {platform === 'ios' && <span className="mt-2 block text-[13px] text-ink-mute">If it opens inside the Claude app, use its “Open in Safari” option, or paste the link into Safari.</span>}
        </Step>
        <AddSteps start={withData ? 3 : 2} />
        {withData && (
          <Step n={5} title="Open Rasoi from the new icon">
            On the welcome screen tap <Key><ClipboardPaste size={13} /> Bring my data</Key> and paste.
          </Step>
        )}
      </ol>
    )
  } else if (standalone) {
    body = (
      <div className="space-y-3 text-[15px] leading-relaxed text-ink-soft" data-testid="installed">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-clay text-clay-on">
            <Check size={14} strokeWidth={3} />
          </span>
          Rasoi is on your home screen
        </p>
        <p>It updates itself: when there’s a new version you’ll see “Update” at the top, one tap and you’re on it. It opens without internet too.</p>
        <p>Your data lives on this phone. To move it to another phone, use Profile → Copy my data.</p>
      </div>
    )
  } else {
    body = (
      <div className="space-y-5">
        {canPrompt && (
          <Button
            size="lg"
            block
            onClick={async () => {
              if (await promptInstall()) {
                toast({ text: 'Rasoi is on your home screen' })
                onClose()
              }
            }}
          >
            <Download size={18} /> Install Rasoi
          </Button>
        )}
        <ol className="space-y-4">
          {needsMove && (
            <Step n={1} done={copied} title="Copy your data first">
              On iPhone the home-screen app keeps its own copy of your data, separate from Safari.
              <span className="mt-2 block">
                <Button variant="secondary" size="sm" onClick={copy}>
                  <ClipboardCopy size={15} /> {copied ? 'Copied' : 'Copy my data'}
                </Button>
              </span>
            </Step>
          )}
          {platform === 'ios' && !isIOSSafari() && (
            <Step n={needsMove ? 2 : 1} title="Open this page in Safari">
              <Button variant="secondary" size="sm" onClick={async () => toast({ text: (await copyText(url)) ? 'Link copied — paste it in Safari' : 'Couldn’t copy' })}>
                <ClipboardCopy size={14} /> Copy link
              </Button>
            </Step>
          )}
          {!canPrompt && <AddSteps start={(needsMove ? 2 : 1) + (platform === 'ios' && !isIOSSafari() ? 1 : 0)} />}
          {needsMove && (
            <Step n={4 + (platform === 'ios' && !isIOSSafari() ? 1 : 0)} title="Open Rasoi from the new icon">
              Tap <Key><ClipboardPaste size={13} /> Bring my data</Key> on the welcome screen and paste.
            </Step>
          )}
        </ol>
      </div>
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={standalone && !IS_MOBILE_PAGE ? 'Rasoi on your phone' : 'Get Rasoi on your home screen'}
      description={standalone && !IS_MOBILE_PAGE ? undefined : 'An icon with your other apps. Opens full screen, works offline and updates itself — nothing to download from a store.'}
      footer={
        <Button variant="secondary" size="lg" block onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="pb-2 pt-2" data-testid="install-sheet">
        {body}
      </div>
    </Sheet>
  )
}

/* ——————————— Bring my data ——————————— */

export function DataSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (d: ReadData) => void }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [found, setFound] = useState<ReadData | null>(null)
  const [bad, setBad] = useState(false)

  useEffect(() => {
    if (open) {
      setText('')
      setFound(null)
      setBad(false)
    }
  }, [open])

  useEffect(() => {
    let live = true
    if (!text.trim()) {
      setFound(null)
      setBad(false)
      return
    }
    readData(text).then((d) => {
      if (!live) return
      setFound(d)
      setBad(!d)
    })
    return () => {
      live = false
    }
  }, [text])

  const paste = async () => {
    try {
      setText(await navigator.clipboard.readText())
    } catch {
      toast({ text: 'Press and hold in the box, then Paste' })
    }
  }
  const replacing = hasData()

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Bring my data"
      description="Paste what you copied with “Copy my data” on your other copy of Rasoi."
      footer={
        <Button
          size="lg"
          block
          disabled={!found}
          onClick={() => {
            if (!found) return
            importData(found)
            toast({ text: 'Your data is here' })
            onDone(found)
          }}
        >
          {found ? 'Bring it in' : 'Paste your data first'}
        </Button>
      }
    >
      <div className="space-y-3 pb-2 pt-1" data-testid="data-sheet">
        <Button variant="secondary" block onClick={paste}>
          <ClipboardPaste size={16} /> Paste
        </Button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="rasoi-data:…"
          aria-label="Your copied data"
          rows={4}
          className="w-full resize-none rounded-2xl border border-line bg-card px-4 py-3 font-mono text-[13px] text-ink placeholder:text-ink-mute/80 focus:border-ink/30 focus:outline-none focus:ring-4 focus:ring-clay/10"
        />
        {found && (
          <div className="rounded-2xl bg-sand/70 px-4 py-3 text-[14px]" data-testid="data-found">
            <p className="font-semibold">{found.people.length ? found.people.join(' & ') : 'Your data'}</p>
            <p className="text-ink-soft">
              {found.logs} food {found.logs === 1 ? 'entry' : 'entries'} · copied {new Date(found.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
        )}
        {bad && <p className="px-1 text-[14px] text-danger">That doesn’t look like Rasoi data. Copy it again with “Copy my data” and paste the whole thing.</p>}
        {replacing && found && <p className="px-1 text-[13px] leading-relaxed text-ink-mute">This replaces what’s on this phone now. What’s here now is kept: Profile → “Put back the previous data” brings it back.</p>}
        <p className="px-1 text-[13px] leading-relaxed text-ink-mute">Meal photos stay on the phone they were taken on.</p>
      </div>
    </Sheet>
  )
}

/* ——————————— Home card and update banner ——————————— */

const CARD_KEY = 'rasoi:installCard'

export function InstallCard() {
  const { standalone } = useInstall()
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(CARD_KEY) === 'dismissed'
    } catch {
      return false
    }
  })
  const [open, setOpen] = useState(false)
  if (standalone || hidden) return null
  const dismiss = () => {
    setHidden(true)
    try {
      localStorage.setItem(CARD_KEY, 'dismissed')
    } catch {
      /* fine: it just shows again next time */
    }
  }
  return (
    <>
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line/80 bg-card px-3 py-2.5" data-testid="install-card">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-clay-soft text-clay">
          <Smartphone size={19} />
        </span>
        <button onClick={() => setOpen(true)} className="min-w-0 flex-1 text-left">
          <span className="block text-[15px] font-semibold">Get Rasoi on your home screen</span>
          <span className="block text-[13px] text-ink-mute">An app icon that opens full screen and updates itself</span>
        </button>
        <button onClick={dismiss} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-mute hover:bg-sand hover:text-ink focus-ring" aria-label="Hide">
          <X size={15} />
        </button>
      </div>
      <InstallSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function UpdateBanner() {
  const { updateReady } = useInstall()
  if (!updateReady) return null
  return (
    <div className="pt-safe fixed inset-x-0 top-0 z-[70] mx-auto max-w-md px-4" data-testid="update-banner">
      <div className="mt-2 flex items-center gap-3 rounded-full bg-ink py-2 pl-4 pr-2 text-[14px] font-medium text-paper shadow-lift">
        <span className="min-w-0 flex-1 truncate">A new version of Rasoi is ready</span>
        <button onClick={applyUpdate} className="rounded-full bg-paper px-3.5 py-1.5 text-[13px] font-semibold text-ink">
          Update
        </button>
      </div>
    </div>
  )
}
