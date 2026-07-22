import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Leaf,
  Search,
  Menu,
  X,
  Bell,
  ChevronDown,
  Wifi,
  WifiOff,
  CloudSun,
  Grid3x3,
  Check,
  LogOut,
  Home,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useApp } from "@/context/AppContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useBranding, isMediaUrl } from "@/lib/branding";
import { useLiveData } from "@/lib/useLiveData";
import { readAlerts, markAlertsRead, type AlertRow } from "@/lib/notifications";
import { moduleLabel, moduleShort, roleTitle } from "@/i18n/modules";
import { CATEGORIES, MODULES, modulesForRole, primaryTabsForRole, usesAdminShell, type NavItem } from "@/lib/nav";
import type { Role } from "@/lib/data";

/* ----------------------------- Brand ----------------------------- */
function Brand({ compact }: { compact?: boolean }) {
  const { branding } = useBranding();
  const logo = branding.companyLogoUrl && isMediaUrl(branding.companyLogoUrl);
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-600/30">
        {logo ? (
          <img src={branding.companyLogoUrl} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <Leaf className="h-5 w-5 text-white" />
        )}
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
      </span>
      {!compact && (
        <div className="leading-tight">
          <p className="font-display text-[15px] font-extrabold tracking-tight text-white">{branding.companyName || "Verda"}</p>
          <p className="text-[10px] font-medium text-emerald-300/80">{branding.companyTagline}</p>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Role Switcher ----------------------------- */
const ROLE_LABEL: Record<Role, { title: string; desc: string; tone: string }> = {
  super_admin: { title: "Super Administrator", desc: "Full system control", tone: "from-emerald-600 to-teal-700" },
  admin: { title: "Estate Director", desc: "Full executive access", tone: "from-emerald-500 to-teal-600" },
  extension_officer: { title: "Extension Officer", desc: "Field registration & weighing", tone: "from-amber-500 to-orange-600" },
  supplier: { title: "VVIP Supplier", desc: "Alert & advisor portal", tone: "from-violet-500 to-fuchsia-600" },
};

function RoleSwitcher({ dark }: { dark?: boolean }) {
  const { t } = useTranslation();
  const { role, setRole, user, isAuthenticated, signOut, session } = useApp();
  const [open, setOpen] = useState(false);

  // When a real session is active, render a profile + Sign-out menu (no role switching).
  if (isAuthenticated) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn("flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition", dark ? "hover:bg-white/10" : "hover:bg-slate-100")}
        >
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-bold text-white", user.avatarTone)}>
            {user.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn("truncate text-sm font-bold", dark ? "text-white" : "text-slate-800")}>{session?.name ?? user.name}</p>
            <p className={cn("truncate text-[11px]", dark ? "text-emerald-300/80" : "text-slate-400")}>{roleTitle(t, role)}</p>
          </div>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180", dark ? "text-emerald-300" : "text-slate-400")} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute bottom-full z-50 mb-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{session?.email ?? "Signed in"}</p>
              <button
                onClick={() => { signOut(); setOpen(false); }}
                className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-rose-600 transition hover:bg-rose-50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100"><LogOut className="h-4 w-4" /></span>
                <p className="text-xs font-bold">Sign out</p>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Demo / preview mode: allow switching roles freely.
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn("flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition", dark ? "hover:bg-white/10" : "hover:bg-slate-100")}
      >
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-bold text-white", user.avatarTone)}>
          {user.initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm font-bold", dark ? "text-white" : "text-slate-800")}>{user.name}</p>
          <p className={cn("truncate text-[11px]", dark ? "text-emerald-300/80" : "text-slate-400")}>{roleTitle(t, role)}</p>
        </div>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180", dark ? "text-emerald-300" : "text-slate-400")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full z-50 mb-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("common.switchRole")} · demo</p>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => {
              const meta = ROLE_LABEL[r];
              return (
                <button
                  key={r}
                  onClick={() => {
                    setRole(r);
                    setOpen(false);
                  }}
                  className={cn("flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition hover:bg-slate-50", role === r && "bg-emerald-50")}
                >
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-[10px] font-bold text-white", meta.tone)}>
                    {r === "super_admin" ? "SA" : r === "admin" ? "AD" : r === "extension_officer" ? "EO" : "SP"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800">{meta.title}</p>
                    <p className="truncate text-[10px] text-slate-400">{meta.desc}</p>
                  </div>
                  {role === r && <Check className="h-4 w-4 text-emerald-600" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ----------------------------- Notification Bell ----------------------------- */
function NotificationBell() {
  const { session } = useApp();
  const userId = session?.uid ?? "admin-demo";
  const { data: alerts, reload } = useLiveData<AlertRow>("alerts", () => readAlerts(userId, 15), `target_user_id=eq.${userId}`);
  const [open, setOpen] = useState(false);
  const unread = alerts.filter((a) => !a.read);
  const count = unread.length;

  const markAllRead = async () => {
    await markAlertsRead(userId);
    void reload();
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((o) => !o); if (!open && count > 0) void markAllRead(); }}
        className="relative rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{count}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-bold text-slate-800">Notifications</p>
              {count > 0 && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">{count} new</span>}
            </div>
            <div className="max-h-80 overflow-y-auto no-scrollbar">
              {alerts.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Check className="mx-auto h-6 w-6 text-emerald-400" />
                  <p className="mt-2 text-xs text-slate-400">No notifications yet.</p>
                </div>
              ) : (
                alerts.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-start gap-2.5 border-b border-slate-50 px-4 py-2.5">
                    <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${a.read ? "bg-slate-200" : "bg-amber-400"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-700">{a.title}</p>
                      <p className="truncate text-[10px] text-slate-400">{a.body}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ----------------------------- Sync Pill ----------------------------- */
function SyncPill({ dark }: { dark?: boolean }) {
  const { online, toggleOnline, syncQueue } = useApp();
  const queued = syncQueue.filter((q) => q.status === "queued").length;
  return (
    <button
      onClick={toggleOnline}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
        online ? (dark ? "bg-emerald-500/20 text-emerald-200" : "bg-emerald-50 text-emerald-700") : dark ? "bg-rose-500/20 text-rose-200" : "bg-rose-50 text-rose-700"
      )}
    >
      {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {online ? "Online" : "Offline"}
      {queued > 0 && <span className={cn("rounded-full px-1.5 text-[9px]", dark ? "bg-white/20" : "bg-amber-400 text-white")}>{queued}</span>}
    </button>
  );
}

/* ----------------------------- Nav Link ----------------------------- */
function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
        active ? "bg-gradient-to-r from-emerald-500/20 to-transparent text-white" : "text-emerald-100/70 hover:bg-white/5 hover:text-white"
      )}
    >
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg transition", active ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/40" : "bg-white/5 text-emerald-200 group-hover:bg-white/10")}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-left">{moduleLabel(t, item.key)}</span>
      {item.premium && <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">Pro</span>}
    </button>
  );
}

/* ----------------------------- Sidebar Content ----------------------------- */
function SidebarContent() {
  const { t } = useTranslation();
  const { activeModule, setActiveModule, role } = useApp();
  const [search, setSearch] = useState("");
  const allItems = modulesForRole(role);
  const searchLower = search.trim().toLowerCase();
  const items = searchLower
    ? allItems.filter((m) => moduleLabel(t, m.key).toLowerCase().includes(searchLower))
    : allItems;
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Brand />
      </div>
      <div className="px-4">
        <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-emerald-100/60">
          <Search className="h-4 w-4" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("common.search")} className="w-full bg-transparent text-sm text-white placeholder:text-emerald-200/50 focus:outline-none" />
          {search && <button onClick={() => setSearch("")} className="text-emerald-200/50 hover:text-white"><X className="h-3.5 w-3.5" /></button>}
        </div>
      </div>
      <nav className="no-scrollbar mt-3 flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {searchLower && items.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-emerald-200/40">No modules match "{search}"</p>
        )}
        {CATEGORIES.map((cat) => {
          const group = items.filter((m) => m.category === cat.id);
          if (!group.length) return null;
          return (
            <div key={cat.id}>
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300/50">{cat.label}</p>
              <div className="space-y-0.5">
                {group.map((m) => (
                  <NavLink key={m.key} item={m} active={activeModule === m.key} onClick={() => setActiveModule(m.key)} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <RoleSwitcher dark />
        <div className="mt-3 px-1">
          <SyncPill dark />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Admin Shell ----------------------------- */
function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { activeModule, isAuthenticated, signOut } = useApp();
  const [drawer, setDrawer] = useState(false);
  const current = MODULES.find((m) => m.key === activeModule);

  return (
    <div className="app-aurora min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-pine-950 to-pine-900 lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setDrawer(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 animate-fade-in bg-gradient-to-b from-pine-950 to-pine-900">
            <button onClick={() => setDrawer(false)} className="absolute right-3 top-4 text-emerald-200">
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-xl lg:px-6">
          <button onClick={() => setDrawer(true)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400">Verda ERP</p>
            <h1 className="font-display text-base font-bold tracking-tight text-slate-900 sm:text-lg">{current ? moduleLabel(t, current.key) : t("common.home")}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <SyncPill />
            <LanguageSwitcher />
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 sm:flex">
              <CloudSun className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-700">21°C</span>
            </div>
            <NotificationBell />
            <div className="hidden w-48 sm:block">
              <RoleSwitcher />
            </div>
            {isAuthenticated && (
              <button
                onClick={() => void signOut()}
                title="Sign out"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 active:scale-95"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

/* ----------------------------- Mobile Bottom Nav ----------------------------- */
function BottomNav({ onMore }: { onMore: () => void }) {
  const { t } = useTranslation();
  const { role, activeModule, setActiveModule } = useApp();
  const tabs = primaryTabsForRole(role);
  // Supervisors & suppliers have exactly 3 permitted modules — render them
  // directly. Only show the overflow "More" sheet when there are many tabs.
  const showMore = tabs.length > 4;
  const visible = showMore ? tabs.slice(0, 4) : tabs;
  return (
    <nav className="sticky bottom-0 z-30 flex items-center justify-around border-t border-slate-200 bg-white/95 px-2 py-1.5 backdrop-blur-xl">
      {visible.map((tab) => {
        const Icon = tab.icon;
        const active = activeModule === tab.key;
        return (
          <button key={tab.key} onClick={() => setActiveModule(tab.key)} className={cn("flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 transition", active ? "text-emerald-600" : "text-slate-400")}>
            <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg transition", active && "bg-emerald-100")}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="text-[10px] font-semibold">{moduleShort(t, tab.key)}</span>
          </button>
        );
      })}
      {showMore && (
        <button onClick={onMore} className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-slate-400 transition hover:text-slate-600">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg">
            <Grid3x3 className="h-[18px] w-[18px]" />
          </span>
          <span className="text-[10px] font-semibold">More</span>
        </button>
      )}
    </nav>
  );
}

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { role, activeModule, setActiveModule } = useApp();
  if (!open) return null;
  const items = modulesForRole(role);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-slate-900/60 animate-fade-in" onClick={onClose} />
      <div className="relative m-3 w-full max-w-md animate-fade-up rounded-3xl bg-white p-5 shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200" />
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-slate-800">{t("common.allModules")}</h3>
          <button onClick={onClose} className="text-slate-400"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto no-scrollbar">
          {items.map((m) => {
            const Icon = m.icon;
            const active = activeModule === m.key;
            return (
              <button
                key={m.key}
                onClick={() => {
                  setActiveModule(m.key);
                  onClose();
                }}
                className={cn("flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition", active ? "border-emerald-300 bg-emerald-50" : "border-slate-100 hover:border-emerald-200 hover:bg-slate-50")}
              >
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", active ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600")}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-[10px] font-semibold leading-tight text-slate-600">{moduleShort(t, m.key)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Mobile Shell ----------------------------- */
function MobileShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { isAuthenticated, signOut, setActiveModule } = useApp();
  const [more, setMore] = useState(false);
  return (
    <div className="app-aurora min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col md:my-5 md:max-w-[430px] md:min-h-[calc(100vh-2.5rem)] md:overflow-hidden md:rounded-[2.5rem] md:border-[10px] md:border-slate-900 md:shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between gap-2 bg-gradient-to-r from-pine-900 to-pine-800 px-4 py-3 text-white">
          <Brand />
          <div className="flex items-center gap-1.5">
            <SyncPill dark />
            <LanguageSwitcher dark />
            {/* Always-visible sign-out button — now also duplicated at the bottom */}
            {isAuthenticated ? (
              <button
                onClick={() => void signOut()}
                title={t("common.logout")}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-900/30 transition hover:bg-rose-400 active:scale-95"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            ) : (
              <button
                onClick={() => setActiveModule("dashboard")}
                title={t("common.home")}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
              >
                <Home className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>
        </header>
        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 no-scrollbar">
          {children}
          {/* Full-width logout button at the bottom — always visible & accessible */}
          {isAuthenticated && (
            <button
              onClick={() => void signOut()}
              className="mt-6 mb-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-600/30 transition hover:bg-rose-700 active:scale-[0.99]"
            >
              <LogOut className="h-4 w-4" />
              {t("common.logout") ?? "Sign out"}
            </button>
          )}
        </main>
        <BottomNav onMore={() => setMore(true)} />
      </div>
      <MoreSheet open={more} onClose={() => setMore(false)} />
    </div>
  );
}

/* ----------------------------- Shell ----------------------------- */
export function Shell({ children }: { children: ReactNode }) {
  const { role } = useApp();
  // Super Admin + Admin → desktop Admin Shell. Supervisor + Supplier → Mobile Shell.
  return usesAdminShell(role) ? <AdminShell>{children}</AdminShell> : <MobileShell>{children}</MobileShell>;
}
