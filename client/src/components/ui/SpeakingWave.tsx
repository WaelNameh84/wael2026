import { cn } from "@/lib/utils"

interface SpeakingWaveProps {
  active: boolean
  onStop?: () => void
  label?: string
  size?: "sm" | "md"
  className?: string
}

export function SpeakingWave({
  active,
  onStop,
  label,
  size = "md",
  className,
}: SpeakingWaveProps) {
  if (!active) return null

  const barCount = size === "sm" ? 5 : 7
  const barHeights = size === "sm"
    ? ["h-2", "h-3", "h-4", "h-5", "h-3"]
    : ["h-2", "h-4", "h-6", "h-8", "h-10", "h-7", "h-3"]

  const delays = ["0ms", "80ms", "160ms", "240ms", "160ms", "80ms", "0ms"]

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl",
        "bg-primary/10 border border-primary/25",
        "backdrop-blur-sm select-none",
        className
      )}
    >
      {/* Wave bars */}
      <div className="flex items-center gap-[3px]" aria-hidden>
        {Array.from({ length: barCount }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "rounded-full bg-primary opacity-80",
              size === "sm" ? "w-[3px]" : "w-1",
              barHeights[i],
              active ? "animate-wave" : ""
            )}
            style={{ animationDelay: delays[i] }}
          />
        ))}
      </div>

      {/* Label */}
      {label && (
        <span className={cn(
          "font-medium text-primary",
          size === "sm" ? "text-[11px]" : "text-xs"
        )}>
          {label}
        </span>
      )}

      {/* Stop button */}
      {onStop && (
        <button
          onClick={onStop}
          className={cn(
            "ms-1 text-primary/60 hover:text-primary transition-colors underline underline-offset-2",
            size === "sm" ? "text-[10px]" : "text-xs"
          )}
        >
          ✕
        </button>
      )}
    </div>
  )
}
