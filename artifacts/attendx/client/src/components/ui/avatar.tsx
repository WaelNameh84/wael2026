"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

/* ── Status ring config ─────────────────────────────────────────── */
export type AttendanceStatus = "present" | "late" | "absent" | "on_leave" | "early_leave";

type StatusConfig = { ring: string; dot: string; glow: string; label: string; labelAr: string };

const statusRingConfig: Record<AttendanceStatus, StatusConfig> = {
  present:     { ring: "ring-2 ring-emerald-500", dot: "bg-emerald-500", glow: "shadow-emerald-500/40", label: "Present",     labelAr: "حاضر" },
  late:        { ring: "ring-2 ring-amber-400",   dot: "bg-amber-400",   glow: "shadow-amber-400/40",  label: "Late",        labelAr: "متأخر" },
  absent:      { ring: "ring-2 ring-rose-500",    dot: "bg-rose-500",    glow: "shadow-rose-500/40",   label: "Absent",      labelAr: "غائب" },
  on_leave:    { ring: "ring-2 ring-sky-400",     dot: "bg-sky-400",     glow: "shadow-sky-400/40",    label: "On Leave",    labelAr: "إجازة" },
  early_leave: { ring: "ring-2 ring-violet-400",  dot: "bg-violet-400",  glow: "shadow-violet-400/40", label: "Early Leave", labelAr: "خروج مبكر" },
};

export interface StatusAvatarProps {
  /** Attendance status ring colour */
  status?: AttendanceStatus;
  /** Name used for initials fallback and aria-label */
  name?: string;
  /** Image URL */
  src?: string;
  /** Size: sm=32px, md=40px (default), lg=48px, xl=64px */
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Pass true when the UI language is Arabic to use Arabic status labels */
  isArabic?: boolean;
}

const sizeMap: Record<NonNullable<StatusAvatarProps["size"]>, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

/**
 * Dot is placed at the bottom-end corner (logical, direction-aware).
 * `bottom-0 end-0` works correctly in both LTR and RTL layouts.
 */
const dotSizeMap: Record<NonNullable<StatusAvatarProps["size"]>, string> = {
  sm: "h-2 w-2 bottom-0 end-0",
  md: "h-2.5 w-2.5 bottom-0 end-0",
  lg: "h-3 w-3 bottom-0.5 end-0.5",
  xl: "h-3.5 w-3.5 bottom-1 end-1",
};

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

/**
 * Avatar with a coloured status ring and dot indicator.
 * The status dot uses logical `end-*` positioning for full RTL support.
 */
function StatusAvatar({ status, name, src, size = "md", className, isArabic }: StatusAvatarProps) {
  const cfg = status ? statusRingConfig[status] : null;
  const sizeClass = sizeMap[size];
  const dotClass  = dotSizeMap[size];
  const initials  = getInitials(name);

  const statusLabel = cfg ? (isArabic ? cfg.labelAr : cfg.label) : undefined;
  const ariaLabel   = [name, statusLabel].filter(Boolean).join(" — ");

  return (
    <div
      className={cn("relative inline-flex shrink-0", className)}
      role="img"
      aria-label={ariaLabel || undefined}
    >
      <Avatar
        className={cn(
          sizeClass,
          "ring-offset-background ring-offset-2 transition-all duration-300",
          cfg?.ring ?? "ring-2 ring-muted/30",
          cfg ? `shadow-lg ${cfg.glow}` : ""
        )}
      >
        {src ? <AvatarImage src={src} alt={name ?? ""} /> : null}
        <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Dot indicator — direction-aware (end-0) */}
      {cfg && (
        <span
          className={cn(
            "absolute rounded-full border-2 border-background transition-colors duration-300",
            dotClass,
            cfg.dot
          )}
          aria-hidden="true"
        />
      )}

      {/* Screen-reader status text */}
      {statusLabel && (
        <span className="sr-only">{statusLabel}</span>
      )}
    </div>
  );
}

export { Avatar, AvatarImage, AvatarFallback, StatusAvatar }
