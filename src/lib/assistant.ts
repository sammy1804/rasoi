import { useCallback, useEffect, useRef, useState } from 'react'
import { IS_MOBILE_PAGE } from '@/app/target'
import { shrink } from '@/data/photos'
import type { Food, Profile } from '@/data/types'
import { claudePrompt, fromClaude, type Understood } from './understand'

/**
 * Optional helpers the page gets when it runs inside claude.ai (the Claude
 * phone page): Claude reads meal photos and loose sentences, and Claude's
 * dictation turns speech into text. On the public site neither exists, so
 * everything here resolves to "not available" and the app falls back to the
 * on-phone matcher and the browser's own speech recognition.
 */

interface SampleNs {
  json<T>(input: string, options?: { images?: Blob[]; modelTier?: 'quick' | 'default' | 'complex'; signal?: AbortSignal }): Promise<T>
  limits(): Promise<{ images?: { maxCount: number; maxInputBytes: number; mediaTypes: string[] } }>
}
interface DictationNs {
  start(options?: { language?: string }): Promise<void>
  stop(): Promise<void>
  onPartial(h: (e: { text: string }) => void): () => void
  onFinal(h: (e: { text: string }) => void): () => void
  onState(h: (e: { state: 'idle' | 'starting' | 'listening' | 'finishing'; reason?: string }) => void): () => void
}

async function capability<T>(name: string): Promise<T | null> {
  if (!IS_MOBILE_PAGE || typeof window === 'undefined') return null
  try {
    const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude
    return claude?.use ? ((await claude.use(name)) as T | null) : null
  } catch {
    return null
  }
}

export interface Abilities {
  /** Claude can read what was typed or said */
  claude: boolean
  /** how many photos Claude can read at once (0 = it can't) */
  photos: number
}

let abilities: Promise<Abilities> | undefined
export function getAbilities(): Promise<Abilities> {
  abilities ??= (async () => {
    const sample = await capability<SampleNs>('sample')
    if (!sample) return { claude: false, photos: 0 }
    const limits = await sample.limits().catch(() => null)
    return { claude: true, photos: limits?.images?.maxCount ?? 0 }
  })()
  return abilities
}

export function useAbilities(): Abilities | undefined {
  const [a, setA] = useState<Abilities>()
  useEffect(() => {
    let live = true
    getAbilities().then((x) => live && setA(x))
    return () => {
      live = false
    }
  }, [])
  return a
}

export class AssistantError extends Error {
  constructor(public code: string) {
    super(code)
  }
}

/** Ask Claude what was eaten. Rejects with an AssistantError whose code says why. */
export async function askClaude(text: string, photos: Blob[], foods: Food[], profile: Profile | undefined, signal?: AbortSignal): Promise<Understood> {
  const sample = await capability<SampleNs>('sample')
  if (!sample) throw new AssistantError('unavailable')
  const limits = await sample.limits().catch(() => null)
  const max = limits?.images?.maxCount ?? 0
  const images = max > 0 ? await Promise.all(photos.slice(0, max).map((p) => shrink(p, 1280, 0.8))) : []
  if (photos.length && !images.length && !text.trim()) throw new AssistantError('images_unavailable')
  try {
    const raw = await sample.json<unknown>(claudePrompt(text, foods, profile, images.length), { images: images.length ? images : undefined, modelTier: 'default', signal })
    const understood = fromClaude(raw, foods)
    if (!understood) throw new AssistantError('invalid_json')
    return understood
  } catch (e) {
    if (e instanceof AssistantError) throw e
    throw new AssistantError(String((e as { code?: string })?.code ?? 'failed'))
  }
}

export function assistantErrorText(code: string): string {
  switch (code) {
    case 'not_granted':
      return 'Claude isn’t allowed to help on this page. You can switch it on from the page’s Permissions menu.'
    case 'rate_limited':
      return 'Claude is busy right now. Try again in a minute.'
    case 'images_unavailable':
    case 'image_rejected':
      return 'That photo couldn’t be read here. Say or type what’s on the plate instead.'
    case 'cancelled':
      return ''
    default:
      return 'Couldn’t work that out just now. Try again, or type it differently.'
  }
}

/* ——————————— Talking ——————————— */

type SpeechRec = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

const browserRec = (): (new () => SpeechRec) | undefined => {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/**
 * Speech to text: Claude's dictation inside claude.ai, else the browser's own
 * recognition (Chrome on Android, Safari on iPhone). `supported` is false
 * where neither exists — the keyboard's mic key still works there.
 */
export function useVoice(onText: (text: string) => void) {
  const [supported, setSupported] = useState<boolean>(() => !IS_MOBILE_PAGE && !!browserRec())
  const [listening, setListening] = useState(false)
  const [partial, setPartial] = useState('')
  const [error, setError] = useState('')
  const dictation = useRef<DictationNs | null>(null)
  const rec = useRef<SpeechRec | null>(null)
  const cb = useRef(onText)
  cb.current = onText

  useEffect(() => {
    let live = true
    const offs: (() => void)[] = []
    capability<DictationNs>('dictation').then((d) => {
      if (!live) return
      if (!d) return setSupported(!!browserRec())
      dictation.current = d
      setSupported(true)
      offs.push(
        d.onFinal(({ text }) => cb.current(text)),
        d.onPartial(({ text }) => setPartial(text)),
        d.onState(({ state, reason }) => {
          setListening(state === 'listening' || state === 'starting')
          if (state === 'idle') {
            setPartial('')
            if (reason === 'unavailable') setSupported(!!browserRec())
          }
        }),
      )
    })
    return () => {
      live = false
      offs.forEach((off) => off())
      dictation.current?.stop().catch(() => {})
      rec.current?.stop()
    }
  }, [])

  const toggle = useCallback(
    (lang: 'en' | 'hi' = 'en') => {
      setError('')
      const d = dictation.current
      if (d) {
        // must be called straight from the tap
        if (listening) d.stop().catch(() => {})
        else
          d.start().catch((e: { code?: string }) => {
            if (e?.code === 'not_granted') setError('Microphone access is off for this page.')
            else if (e?.code === 'unavailable') setSupported(!!browserRec())
          })
        return
      }
      if (listening) return rec.current?.stop()
      const Rec = browserRec()
      if (!Rec) return setSupported(false)
      const r = new Rec()
      r.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
      r.continuous = true
      r.interimResults = true
      r.onresult = (e) => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]
          if (res.isFinal) cb.current(res[0].transcript)
          else interim += res[0].transcript
        }
        setPartial(interim)
      }
      r.onend = () => {
        setListening(false)
        setPartial('')
      }
      r.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('Allow the microphone for this site to talk instead of typing.')
        else if (e.error !== 'no-speech' && e.error !== 'aborted') setError('Couldn’t hear that. Try again, or use the mic key on your keyboard.')
      }
      rec.current = r
      try {
        r.start()
        setListening(true)
      } catch {
        setError('Couldn’t start listening. Use the mic key on your keyboard instead.')
      }
    },
    [listening],
  )

  return { supported, listening, partial, error, toggle }
}
