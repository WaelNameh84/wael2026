/** Shared loading components — replace heavy skeleton screens */

/** Full-page loader: light-blue bg + spinning arc (matches legacy PageLoader UX) */
export function PageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-50">
      <div className="w-10 h-10 rounded-full border-4 border-sky-200 border-t-sky-500 animate-spin" />
    </div>
  );
}

/** Inline loader: centred inside a content area */
export function InlineLoader({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-16 ${className}`}>
      <div className="w-8 h-8 rounded-full border-4 border-sky-200 border-t-sky-500 animate-spin" />
    </div>
  );
}
