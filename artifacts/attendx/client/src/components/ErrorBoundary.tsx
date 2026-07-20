import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

/**
 * Returns true when the error is a failed dynamic-import / stale-chunk error.
 * These happen when a PWA has an old index.html cached that references JS
 * chunk filenames that no longer exist on the server after a new deploy.
 * The only real fix is a hard reload so the browser fetches a fresh index.html.
 */
function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const msg = error.message?.toLowerCase() ?? "";
  return (
    msg.includes("importing a module script failed") ||
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("dynamically imported module") ||
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk") ||
    msg.includes("error loading") ||
    // Safari / iOS
    msg.includes("module script load failed") ||
    msg.includes("cannot load module")
  );
}

function hardReload() {
  // Remove the stale query-cache so the fresh app starts clean.
  try { localStorage.removeItem("attendx_qcache_v1"); } catch { /* ignore */ }
  // Force the browser to bypass any cached SW response.
  window.location.reload();
}

export default class ErrorBoundary extends Component<Props, State> {
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      isChunkError: isChunkLoadError(error),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Caught:", error, info.componentStack);

    // Chunk errors = stale PWA cache → reload automatically after a short
    // delay so the user sees a helpful message before the page refreshes.
    if (isChunkLoadError(error)) {
      this.reloadTimer = setTimeout(() => hardReload(), 2500);
    }
  }

  componentWillUnmount() {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      if (this.state.isChunkError) {
        // Stale-cache / module-load error — auto-reload in progress.
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-foreground">تحديث التطبيق…</p>
              <p className="text-sm text-muted-foreground mt-1">
                Updating to the latest version…
              </p>
            </div>
            <button
              className="text-sm text-primary underline underline-offset-2"
              onClick={() => hardReload()}
            >
              تحديث الآن / Reload now
            </button>
          </div>
        );
      }

      // Generic error — let the user try again without a full reload.
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-2xl text-destructive">!</span>
          </div>
          <div>
            <p className="font-semibold text-foreground">{localStorage.getItem("settings_lang") === "ar" ? "حدث خطأ ما" : "Something went wrong"}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {this.state.error?.message ?? (localStorage.getItem("settings_lang") === "ar" ? "حدث خطأ غير متوقع" : "An unexpected error occurred")}
            </p>
          </div>
          <button
            className="text-sm text-primary underline underline-offset-2"
            onClick={() => this.setState({ hasError: false, error: null, isChunkError: false })}
          >
            {localStorage.getItem("settings_lang") === "ar" ? "إعادة المحاولة" : "Try again"}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
