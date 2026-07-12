import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface State { hasError: boolean; error?: Error; }

/**
 * ErrorBoundary — catches render crashes and shows a friendly error screen
 * instead of a white screen. Wraps the entire app.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-aurora flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-slate-800">Something went wrong</h2>
            <p className="mt-1 max-w-md text-sm text-slate-400">
              {this.state.error?.message || "An unexpected error occurred. Please refresh the page."}
            </p>
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, error: undefined }); window.location.reload(); }}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:brightness-110"
          >
            <RefreshCw className="h-4 w-4" /> Refresh page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
