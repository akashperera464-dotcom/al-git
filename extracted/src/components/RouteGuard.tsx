import type { ReactNode } from "react";
import { Lock, ArrowLeft, ShieldCheck } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { canAccess, homeModuleFor } from "@/lib/rbac";
import type { Role } from "@/lib/data";

/**
 * RouteGuard — the single mount-time enforcement point.
 * Checks `user.role` (resolved from Firestore via AppContext) against the
 * centralized RBAC matrix BEFORE rendering a module. Blocked access renders
 * an AccessDenied surface instead of the component.
 */
export function RouteGuard({ moduleKey, children }: { moduleKey: string; children: ReactNode }) {
  const { role, setActiveModule } = useApp();

  if (canAccess(role, moduleKey)) return <>{children}</>;

  return <AccessDenied role={role} onHome={() => setActiveModule(homeModuleFor(role))} />;
}

const RESTRICTED_NOTE: Record<Role, string> = {
  super_admin: "This resource is outside the super-administrative scope.",
  admin: "This resource is outside the administrative scope.",
  extension_officer:
    "Corporate finance, payroll, profit & loss tools, user-rate configuration and supplier banking credentials are restricted to estate directors.",
  supplier:
    "Internal worker rosters, payroll metrics, other suppliers' data and factory admin dashboards are not available to external suppliers.",
};

function AccessDenied({ role, onHome }: { role: Role; onHome: () => void }) {
  return (
    <div className="flex min-h-[64vh] flex-col items-center justify-center px-6 text-center">
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-50 text-rose-500">
          <Lock className="h-9 w-9" />
        </div>
        <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow ring-1 ring-rose-100">
          <ShieldCheck className="h-3.5 w-3.5 text-rose-500" />
        </span>
      </div>
      <p className="mt-5 text-[11px] font-bold uppercase tracking-widest text-rose-500">Access Restricted</p>
      <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">You don't have access here</h2>
      <p className="mt-2 max-w-md text-sm text-slate-500">{RESTRICTED_NOTE[role]}</p>
      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
        RouteGuard · role: <span className="text-slate-700">{role}</span>
      </div>
      <button
        onClick={onHome}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Return to my console
      </button>
    </div>
  );
}
