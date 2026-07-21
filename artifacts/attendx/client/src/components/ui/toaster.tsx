import { useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import { useTTS } from "@/hooks/use-tts"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()
  const { speak } = useTTS()
  const spokenIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Only speak toasts when the user is authenticated (inside the app)
    // This prevents TTS from firing on the splash screen or login page
    const isAuthenticated = !!localStorage.getItem("auth_token")
    if (!isAuthenticated) return

    toasts.forEach((t) => {
      if (spokenIds.current.has(t.id)) return
      spokenIds.current.add(t.id)

      const parts: string[] = []
      if (typeof t.title === "string" && t.title) parts.push(t.title)
      if (typeof t.description === "string" && t.description) parts.push(t.description)
      const text = parts.join(". ")
      if (text) speak(text)
    })
  }, [toasts, speak])

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
