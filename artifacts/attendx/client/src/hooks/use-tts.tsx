import { useCallback, useEffect, useRef, useState } from "react"
import { useSettings } from "@/hooks/use-settings"

function detectLang(text: string): string {
  if (/[\u0600-\u06FF]/.test(text)) return "ar-SA"
  if (/[åäöÅÄÖ]/.test(text)) return "sv-SE"
  return "en-US"
}

/** Pick the best available voice — prefers neural/enhanced Apple/system voices */
function pickBestVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const langPrefix = lang.split("-")[0]
  const isAr = langPrefix === "ar"

  const sameLang = voices.filter(v => v.lang.startsWith(langPrefix))
  if (sameLang.length === 0) return null

  const matchers: ((v: SpeechSynthesisVoice) => boolean)[] = isAr
    ? [
        v => v.voiceURI.includes("com.apple.voice.enhanced") || v.voiceURI.includes("com.apple.voice.premium"),
        v => /maged|layla|laila|tamar|hala|hamdi|sara/i.test(v.name),
        v => /enhanced|premium|neural|natural/i.test(v.voiceURI + v.name),
      ]
    : [
        v => v.voiceURI.includes("com.apple.voice.enhanced") || v.voiceURI.includes("com.apple.voice.premium"),
        v => /samantha|karen|moira|daniel|kate|alex|allison|ava|victoria|serena/i.test(v.name),
        v => /enhanced|premium|neural|natural/i.test(v.voiceURI + v.name),
      ]

  for (const match of matchers) {
    const found = sameLang.find(match)
    if (found) return found
  }
  return sameLang[0]
}

/** Pick a narrator voice — prefers a different voice than the AI to sound distinct */
function pickNavVoice(voices: SpeechSynthesisVoice[], lang: string, aiVoice: SpeechSynthesisVoice | null): SpeechSynthesisVoice | null {
  const langPrefix = lang.split("-")[0]
  const sameLang = voices.filter(v => v.lang.startsWith(langPrefix))
  if (sameLang.length === 0) return null

  // Try to pick a voice different from the AI assistant's voice
  if (aiVoice && sameLang.length > 1) {
    const different = sameLang.find(v => v.name !== aiVoice.name)
    if (different) return different
  }
  // Fallback to any voice
  return sameLang[0]
}

// ─── Module-level coordination ─────────────────────────────────────────────
// Tracks whether the AI assistant is currently speaking so the narrator
// (nav TTS) can pause rather than cancelling the AI mid-sentence.
let _aiSpeaking = false

// ─── AI Assistant TTS (internal) ──────────────────────────────────────────
function doSpeakAI(
  synth: SpeechSynthesis,
  text: string,
  onEnd?: () => void,
  onStart?: () => void,
  onError?: () => void,
): void {
  // AI takes priority — cancel everything (including any nav speech)
  synth.cancel()
  _aiSpeaking = true

  const lang = detectLang(text)
  const isAr = lang.startsWith("ar")

  const fire = () => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang   = lang
    // Warm, human-like parameters — slower + slightly warmer pitch than default
    utterance.rate   = isAr ? 0.80 : 0.82
    utterance.pitch  = isAr ? 1.04 : 0.96
    utterance.volume = 1.0

    const voices = synth.getVoices()
    const best = pickBestVoice(voices, lang)
    if (best) utterance.voice = best

    utterance.onstart = () => {
      _aiSpeaking = true
      onStart?.()
    }
    utterance.onend = () => {
      _aiSpeaking = false
      onEnd?.()
    }
    utterance.onerror = () => {
      _aiSpeaking = false
      onError?.()
    }

    synth.speak(utterance)
  }

  if (synth.getVoices().length === 0) {
    window.speechSynthesis.addEventListener("voiceschanged", fire, { once: true })
  } else {
    fire()
  }
}

// ─── Navigator / Button Narrator TTS (internal) ───────────────────────────
function doSpeakNav(
  synth: SpeechSynthesis,
  text: string,
): void {
  // Do NOT interrupt the AI assistant — skip this announcement if AI is talking
  if (_aiSpeaking) return

  const lang = detectLang(text)
  const isAr = lang.startsWith("ar")

  const fire = () => {
    // Only cancel other nav speech (not AI) — since we already checked _aiSpeaking
    if (!_aiSpeaking) synth.cancel()
    if (_aiSpeaking) return // double-check after cancel

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang   = lang
    // Navigator is slightly faster + more neutral — clearly distinct from the AI
    utterance.rate   = isAr ? 0.92 : 0.94
    utterance.pitch  = isAr ? 0.96 : 1.02
    utterance.volume = 0.85

    const voices = synth.getVoices()
    const aiVoice = pickBestVoice(voices, lang)
    // Prefer a different voice than the AI to make them sound distinct
    const navVoice = pickNavVoice(voices, lang, aiVoice)
    if (navVoice) utterance.voice = navVoice

    synth.speak(utterance)
  }

  if (synth.getVoices().length === 0) {
    window.speechSynthesis.addEventListener("voiceschanged", fire, { once: true })
  } else {
    fire()
  }
}

// ─── AI Assistant TTS hook ──────────────────────────────────────────────────
/** Used by the AI assistant. Respects `ttsEnabled` and `aiVoiceResponse` settings.
 *  Takes priority over the navigator — will cancel any nav speech when AI starts. */
export function useTTS() {
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const { ttsEnabled } = useSettings()

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis
      window.speechSynthesis.getVoices()
    }
  }, [])

  const speak = useCallback((text: string, onEnd?: () => void, force = false) => {
    if (!ttsEnabled && !force) {
      onEnd?.()
      return
    }
    if (!synthRef.current || !text?.trim()) {
      onEnd?.()
      return
    }
    doSpeakAI(
      synthRef.current,
      text,
      () => { setIsSpeaking(false); onEnd?.() },
      () => setIsSpeaking(true),
      () => { setIsSpeaking(false); onEnd?.() },
    )
  }, [ttsEnabled])

  const stop = useCallback(() => {
    synthRef.current?.cancel()
    _aiSpeaking = false
    setIsSpeaking(false)
  }, [])

  return { speak, stop, isSpeaking }
}

// ─── Navigation / Button Narrator TTS hook ────────────────────────────────
/** Completely separate from the AI assistant voice.
 *  Reads page names and UI labels aloud when navigating or pressing buttons.
 *  Respects `navTtsEnabled`. Pauses silently if the AI is currently speaking. */
export function useNavTTS() {
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const { navTtsEnabled } = useSettings()

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis
      window.speechSynthesis.getVoices()
    }
  }, [])

  const speakNav = useCallback((text: string) => {
    if (!navTtsEnabled) return
    if (!synthRef.current || !text?.trim()) return
    doSpeakNav(synthRef.current, text)
  }, [navTtsEnabled])

  return { speakNav }
}
