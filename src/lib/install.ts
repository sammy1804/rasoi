import { useSyncExternalStore } from 'react'
import { IS_MOBILE_PAGE } from '@/app/target'

/**
 * Home-screen install and self-updating, for the public site.
 *  - Android/desktop Chrome fire `beforeinstallprompt`: we keep it so an "Install" button can show the real prompt.
 *  - iPhone has no prompt: Safari's Share → "Add to Home Screen" is the only way, so we show those steps.
 *  - A service worker (dist/sw.js, written at build time) keeps the app working offline and
 *    picks up new versions; when one is waiting we offer a one-tap update.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type State = { canPrompt: boolean; installed: boolean; updateReady: boolean }
let state: State = { canPrompt: false, installed: false, updateReady: false }
let deferred: BeforeInstallPromptEvent | null = null
let waiting: ServiceWorker | null = null
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

export type Platform = 'ios' | 'android' | 'other'
export function platform(): Platform {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

/** Safari is the only iPhone browser that could add to the home screen before iOS 16.4; it's still the surest. */
export const isIOSSafari = () => platform() === 'ios' && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(navigator.userAgent)

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  set({ canPrompt: false, installed: outcome === 'accepted' })
  return outcome === 'accepted'
}

export function applyUpdate() {
  if (waiting) waiting.postMessage('skip-waiting')
  else window.location.reload()
}

export function useInstall() {
  const s = useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => state,
    () => state,
  )
  return { ...s, standalone: isStandalone() || s.installed, platform: platform() }
}

/** Called once from main.tsx. */
export function setupInstall() {
  if (typeof window === 'undefined' || IS_MOBILE_PAGE) return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    set({ canPrompt: true })
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    set({ canPrompt: false, installed: true })
  })

  const env = (import.meta as { env?: Record<string, unknown> }).env ?? {}
  if (!env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js')
      const watch = (w: ServiceWorker | null) => {
        if (!w) return
        const ready = () => {
          // only an *update* needs the prompt; the very first install just starts working
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            waiting = w
            set({ updateReady: true })
          }
        }
        ready()
        w.addEventListener('statechange', ready)
      }
      watch(reg.waiting)
      reg.addEventListener('updatefound', () => watch(reg.installing))
      let reloading = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading || !waiting) return
        reloading = true
        window.location.reload()
      })
      // a home-screen app is often resumed rather than reopened: look for a new version then too
      let last = Date.now()
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - last > 30 * 60 * 1000) {
          last = Date.now()
          reg.update().catch(() => {})
        }
      })
    } catch {
      /* no service worker (private mode, old browser): the site still works online */
    }
  })
}
