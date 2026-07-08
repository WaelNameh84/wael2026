import { useCallback, useEffect, useRef, useState } from "react"
import { useSettings } from "@/hooks/use-settings"

function detectLang(text: string): string {
  if (/[\u0600-\u06FF]/.test(text)) return "ar-SA"
  if (/[åäöÅÄÖ]/.test(text)) return "sv-SE"
  return "en-US"
}

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

    synthRef.current.cancel()

    const fire = () => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = detectLang(text)
      utterance.rate = 1.0
      utterance.pitch = 1.0
      utterance.volume = 1.0

      const voices = synthRef.current!.getVoices()
      const matched = voices.find((v) =>
        v.lang.startsWith(utterance.lang.split("-")[0])
      )
      if (matched) utterance.voice = matched

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => {
        setIsSpeaking(false)
        onEnd?.()
      }
      utterance.onerror = () => {
        setIsSpeaking(false)
        onEnd?.()
      }

      synthRef.current!.speak(utterance)
    }

    if (synthRef.current.getVoices().length === 0) {
      window.speechSynthesis.addEventListener("voiceschanged", fire, { once: true })
    } else {
      fire()
    }
  }, [ttsEnabled])

  const stop = useCallback(() => {
    synthRef.current?.cancel()
    setIsSpeaking(false)
  }, [])

  return { speak, stop, isSpeaking }
}
