"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Elegant Sonner Toaster with rich color-coded styles.
 * - Success: emerald gradient
 * - Error: rose/red gradient
 * - Warning: amber gradient
 * - Info: sky/primary gradient
 * - Default: glass card style
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      richColors
      expand={false}
      toastOptions={{
        duration: 5000,
        classNames: {
          toast: [
            "group toast",
            "!rounded-2xl !border !shadow-xl !backdrop-blur-xl",
            "group-[.toaster]:bg-background/95 group-[.toaster]:text-foreground",
            "group-[.toaster]:border-border/60",
            "transition-all duration-300",
          ].join(" "),
          title: "font-semibold text-sm leading-tight",
          description: "group-[.toast]:text-muted-foreground text-xs mt-0.5",
          actionButton: [
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            "!rounded-lg !text-xs !font-medium !px-3 !py-1.5",
          ].join(" "),
          cancelButton: [
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
            "!rounded-lg !text-xs !font-medium !px-3 !py-1.5",
          ].join(" "),
          // Success — emerald
          success: [
            "!bg-gradient-to-br !from-emerald-50 !to-green-50",
            "dark:!from-emerald-950/80 dark:!to-green-950/80",
            "!border-emerald-200 dark:!border-emerald-800/60",
            "!text-emerald-900 dark:!text-emerald-100",
          ].join(" "),
          // Error — rose
          error: [
            "!bg-gradient-to-br !from-rose-50 !to-red-50",
            "dark:!from-rose-950/80 dark:!to-red-950/80",
            "!border-rose-200 dark:!border-rose-800/60",
            "!text-rose-900 dark:!text-rose-100",
          ].join(" "),
          // Warning — amber
          warning: [
            "!bg-gradient-to-br !from-amber-50 !to-orange-50",
            "dark:!from-amber-950/80 dark:!to-orange-950/80",
            "!border-amber-200 dark:!border-amber-800/60",
            "!text-amber-900 dark:!text-amber-100",
          ].join(" "),
          // Info — sky
          info: [
            "!bg-gradient-to-br !from-sky-50 !to-blue-50",
            "dark:!from-sky-950/80 dark:!to-blue-950/80",
            "!border-sky-200 dark:!border-sky-800/60",
            "!text-sky-900 dark:!text-sky-100",
          ].join(" "),
          closeButton: [
            "group-[.toast]:!bg-muted/50 group-[.toast]:!border-border/40",
            "group-[.toast]:!text-muted-foreground hover:!bg-muted",
            "!rounded-lg",
          ].join(" "),
          icon: "!mt-0.5",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
