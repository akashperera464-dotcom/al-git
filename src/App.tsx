import { Suspense } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import { BrandingProvider } from "@/lib/branding";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Shell } from "@/components/Shell";
import { RouteGuard } from "@/components/RouteGuard";
import { Toaster } from "@/components/Toaster";
import { Login } from "@/components/Login";
import { REGISTRY } from "@/modules/registry";
import { homeModuleFor } from "@/lib/rbac";
import { SchemaVersionWarning } from "@/components/SchemaVersionWarning";

/** Resolves the module for the active nav key, behind the RouteGuard. */
function ModuleView() {
  const { activeModule } = useApp();
  const Comp = REGISTRY[activeModule] ?? REGISTRY[homeModuleFor("admin")];
  return (
    <RouteGuard moduleKey={activeModule}>
      <Suspense fallback={<div className="space-y-3 p-5"><div className="h-10 animate-pulse rounded-xl bg-slate-200" /><div className="h-48 animate-pulse rounded-2xl bg-slate-100" /></div>}><div key={activeModule} className="animate-fade-in"><Comp /></div></Suspense>
    </RouteGuard>
  );
}

function Root() {
  const { isAuthenticated, session } = useApp();

  // AppProvider owns the single Firebase session observer and performs the
  // account-status check. Show the usable login surface immediately instead
  // of blocking startup behind a branded full-screen splash.
  if (!isAuthenticated || !session) return <Login />;

  return (
    <>
      <SchemaVersionWarning />
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
