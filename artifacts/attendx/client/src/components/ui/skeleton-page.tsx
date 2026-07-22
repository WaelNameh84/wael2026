/**
 * SkeletonPage — بديل التحميل الاحترافي
 * بدل الـ spinner يظهر شكل الصفحة بلون رمادي (مثل Facebook/LinkedIn)
 *
 * الاستخدام:
 *   if (isLoading) return <SkeletonPage />;
 *   if (isLoading) return <SkeletonPage variant="list" rows={5} />;
 *   if (isLoading) return <SkeletonPage variant="cards" />;
 */
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("skeleton", className)} />;
}

interface SkeletonPageProps {
  /** نوع التخطيط */
  variant?: "default" | "list" | "cards" | "profile" | "dashboard";
  /** عدد الصفوف (للـ list) */
  rows?: number;
  className?: string;
}

export function SkeletonPage({ variant = "default", rows = 4, className }: SkeletonPageProps) {
  return (
    <div className={cn("p-4 space-y-4 animate-in fade-in duration-300", className)}>
      {variant === "list" && (
        <>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="w-16 h-6 rounded-full" />
            </div>
          ))}
        </>
      )}

      {variant === "cards" && (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 rounded-2xl bg-card border border-border space-y-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {variant === "profile" && (
        <>
          <div className="flex flex-col items-center gap-3 py-4">
            <Skeleton className="w-20 h-20 rounded-full" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {variant === "dashboard" && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-2xl bg-card border border-border space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-7 w-1/2" />
              </div>
            ))}
          </div>
          {/* Chart placeholder */}
          <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
          {/* List items */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
              <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </>
      )}

      {variant === "default" && (
        <>
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        </>
      )}
    </div>
  );
}
