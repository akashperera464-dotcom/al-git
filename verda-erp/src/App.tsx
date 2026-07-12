import { useEffect } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import { BrandingProvider } from "@/lib/branding";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Shell } from "@/components/Shell";
import { RouteGuard } from "@/components/RouteGuard";
import { Toaster } from "@/components/Toaster";
import { Login } from "@/components/Login";
import { REGISTRY } from "@/modules/registry";
import { homeModuleFor } from "@/lib/rbac";
import { watchHybridSession } from "@/lib/auth.hybrid";
import { Leaf } from "lucide-react";

/** Resolves the module for the active nav key, behind the RouteGuard. */
function ModuleView() {
  const { activeModule } = useApp();
  const Comp = REGISTRY[activeModule] ?? REGISTRY[homeModuleFor("admin")];
  return (
    <RouteGuard moduleKey={activeModule}>
      <div key={activeModule} className="animate-fade-in">
        <Comp />
      </div>
    </RouteGuard>
  );
}

/** Brief splash while the persisted Firebase session is being restored. */
function AuthSplash() {
  return (
    <div className="app-aurora flex min-h-screen flex-col items-center justify-center gap-5">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-xl shadow-emerald-600/30 animate-floaty">
        <Leaf className="h-8 w-8 text-white" />
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white" />
      </div>
      <div className="text-center">
        <p className="font-display text-lg font-bold text-slate-800">Verda ERP</p>
        <p className="text-sm text-slate-400">Restoring your session…</p>
      </div>
      <div className="h-1.5 w-44 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 shimmer" />
      </div>
    </div>
  );
}

function Root() {
  const { authReady, isAuthenticated, session, setSession } = useApp();

  // Replay any persisted Firebase session on mount (so refresh keeps you logged in).
  useEffect(() => {
    const unsub = watchHybridSession((s) => {
      if (s) setSession(s);
    });
    return () => unsub();
  }, [setSession]);

  // Not authenticated → show the unified login screen.
  if (authReady && !isAuthenticated) return <Login />;
  // Authenticated but session not yet resolved → splash.
  if (!authReady || !session) return <AuthSplash />;

  return (
    <>
      <Shell>
        <ModuleView />
      </Shell>
      <Toaster />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <BrandingProvider>
      <AppProvider>
        <Root />
      </AppProvider>
    </BrandingProvider>
    </ErrorBoundary>
  );
}
