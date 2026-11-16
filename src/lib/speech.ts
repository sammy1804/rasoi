import { useCallback, useEffect, useState } from 'react'
import type { CookLanguage } from '@/data/types'

/**
 * Reading the menu aloud with the phone's built-in voice (Web Speech API).
 * Works in Chrome on Android and Safari on iPhone; where it isn't available
 * the listen buttons simply don't show.
 */
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

function pickVoice(lang: CookLanguage): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  const want = lang === 'hi' ? 'hi' : 'en-in'
  return voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(want)) ?? (lang === 'en' ? voices.find((v) => v.lang.toLowerCase().startsWith('en')) : undefined)
}

export function useSpeech() {
  const [speaking, setSpeaking] = useState<string | null>(null)
  const supported = canSpeak()

  useEffect(() => {
    if (!supported) return
    // voices load asynchronously on some phones; asking once wakes them up
    window.speechSynthesis.getVoices()
    return () => window.speechSynthesis.cancel()
  }, [supported])

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel()
    setSpeaking(null)
  }, [supported])

  const speak = useCallback(
    (id: string, text: string, lang: CookLanguage) => {
      if (!supported) return
      window.speechSynthesis.cancel()
      if (speaking === id) return setSpeaking(null)
      const u = new SpeechSynthesisUtterance(text)
      u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
      const voice = pickVoice(lang)
      if (voice) u.voice = voice
      u.rate = 0.9
      u.onend = () => setSpeaking((s) => (s === id ? null : s))
      u.onerror = () => setSpeaking((s) => (s === id ? null : s))
      setSpeaking(id)
      window.speechSynthesis.speak(u)
    },
    [supported, speaking],
  )

  return { supported, speaking, speak, stop }
}
