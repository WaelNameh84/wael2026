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
      const isAr = utterance.lang.startsWith("ar")
      utterance.rate = isAr ? 0.88 : 0.93
      utterance.pitch = isAr ? 1.05 : 1.0
      utterance.volume = 1.0

      const voices = synthRef.current!.getVoices()
      const langPrefix = utterance.lang.split("-")[0]

      // Priority order: enhanced/neural → premium → default
      // On iOS/macOS Apple voices are labeled with "enhanced" or have
      // "com.apple.voice.enhanced" in their voiceURI
      const sameLang = voices.filter(v => v.lang.startsWith(langPrefix))

      const enhanced = sameLang.find(v =>
        v.voiceURI.includes("enhanced") || v.name.toLowerCase().includes("enhanced")
      )
      const premium = sameLang.find(v =>
        v.voiceURI.includes("premium") || v.name.toLowerCase().includes("premium")
      )
      // Arabic: prefer known high-quality voices by name
      const namedAr = isAr
        ? sameLang.find(v => /maged|tamar|laila|hamdi|hala/i.test(v.name))
        : null
      // English: prefer known neural voices
      const namedEn = !isAr
        ? sameLang.find(v => /samantha|karen|moira|daniel|thomas|kate|alex/i.test(v.name))
        : null

      const picked = enhanced ?? premium ?? namedAr ?? namedEn ?? sameLang[0]
      if (picked) utterance.voice = picked

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
