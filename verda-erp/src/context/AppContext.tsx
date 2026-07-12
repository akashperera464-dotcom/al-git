import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Role, Estate, Division, Field } from "@/lib/data";
import { estates as seedEstates, seedResourceRequests, CURRENT_SUPPLIER, SUPPLIER_ENTITY_MAP, type ResourceRequest, type RequestStatus } from "@/lib/data";
import { readEstateHierarchy } from "@/lib/repo";
import { canAccess as rbacCanAccess, homeModuleFor, usesAdminShell } from "@/lib/rbac";
import { sendFcmToSupplier } from "@/lib/fcm";
import { createAlert } from "@/lib/notifications";
import { createEstate as repoCreateEstate, createDivision as repoCreateDivision, createField as repoCreateField } from "@/lib/repo";
import { signOutFirebase, watchHybridSession, type AuthState } from "@/lib/auth.hybrid";

export interface SyncItem {
  id: string;
  label: string;
  time: string;
  status: "queued" | "synced";
}

export interface UserProfile {
  name: string;
  role: Role;
  title: string;
  initials: string;
  avatarTone: string;
}

export type ToastTone = "emerald" | "rose" | "amber" | "sky" | "violet";
export interface Toast {
  id: string;
  title: string;
  body: string;
  tone: ToastTone;
  channel: "FCM" | "system";
}

/** Fallback display profiles (used in demo/preview mode or as defaults). */
export const USERS: Record<Role, UserProfile> = {
  super_admin: {
    name: "Akash Perera",
    role: "super_admin",
    title: "Super Administrator",
    initials: "AP",
    avatarTone: "from-emerald-600 to-teal-700",
  },
  admin: {
    name: "Anjali Wijesinghe",
    role: "admin",
    title: "Estate Director · Glenview",
    initials: "AW",
    avatarTone: "from-emerald-500 to-teal-600",
  },
  extension_officer: {
    name: "Ruwan Kumara",
    role: "extension_officer",
    title: "Extension Officer · Field",
    initials: "RK",
    avatarTone: "from-amber-500 to-orange-600",
  },
  supplier: {
    name: "Sumithra Green Leaf Co.",
    role: "supplier",
    title: "VVIP Supplier · Ragala",
    initials: "SG",
    avatarTone: "from-violet-500 to-fuchsia-600",
  },
};

/** Demo uids (preview-mode role switcher). Real sessions use AuthState.uid. */
export const USER_UIDS: Record<Role, string> = {
  super_admin: "uid-superadmin-001",
  admin: "uid-admin-001",
  extension_officer: "uid-eo-001",
  supplier: "sup-001",
};

interface AppState {
  /** Authenticated session (null until login). Drives real role routing. */
  session: AuthState | null;
  /** Apply a resolved auth session (called by Login.tsx after Firebase + Supabase). */
  setSession: (s: AuthState | null) => void;
  /** Sign out: clears session. */
  signOut: () => Promise<void>;
  /** True once the initial Firebase auth check has completed. */
  authReady: boolean;
  /** True when a real session is active (hides the demo role switcher). */
  isAuthenticated: boolean;

  /** Effective role = real session role, else the preview/demo role. */
  role: Role;
  setRole: (r: Role) => void;
  user: UserProfile;
  activeModule: string;
  setActiveModule: (m: string) => void;
  online: boolean;
  toggleOnline: () => void;
  syncQueue: SyncItem[];
  enqueueSync: (label: string) => void;
  flushSync: () => void;
  notifications: number;
  canAccess: (moduleKey: string) => boolean;
  userUid: string;
  associatedEntityId: string;

  /* ---- Estate hierarchy (admin-createable, live state) ---- */
  estates: Estate[];
  addEstate: (input: Omit<Estate, "id" | "divisions">) => Promise<Estate>;
  addDivision: (estateId: string, input: Omit<Division, "id" | "fields">) => Promise<Division>;
  addField: (estateId: string, divisionId: string, input: Omit<Field, "id">) => Promise<Field>;

  /* ---- Resource Requisitions (real-time, Firestore-mirrored) ---- */
  resourceRequests: ResourceRequest[];
  submitRequest: (input: Omit<ResourceRequest, "id" | "supplierId" | "supplierName" | "status" | "adminNotes" | "timestamp">) => ResourceRequest;
  decideRequest: (id: string, status: RequestStatus, adminNotes: string) => void;

  /* ---- FCM-style toasts ---- */
  toasts: Toast[];
  notify: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppState | null>(null);

const INITIAL_QUEUE: SyncItem[] = [
  { id: "q1", label: "Weigh-in · Craighead CC", time: "06:42", status: "queued" },
  { id: "q2", label: "Attendance · 6 workers", time: "06:30", status: "queued" },
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthState | null>(null);
  const [previewRole, setPreviewRole] = useState<Role>("admin");
  const [activeModule, setActiveModule] = useState<string>("dashboard");
  const [online, setOnline] = useState<boolean>(true);
  const [syncQueue, setSyncQueue] = useState<SyncItem[]>(INITIAL_QUEUE);
  const [authReady, setAuthReady] = useState<boolean>(false);

  const [resourceRequests, setResourceRequests] = useState<ResourceRequest[]>(seedResourceRequests);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [estates, setEstates] = useState<Estate[]>(seedEstates);

  // On mount: load the REAL estates from Supabase (replaces the mock seed).
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const live = await readEstateHierarchy("admin");
        if (active && live.length) setEstates(live);
      } catch {
        // DB not reachable — keep the mock seed data.
      }
    })();
    return () => { active = false; };
  }, []);
  // (local ID counters removed — Supabase gen_random_uuid() provides real IDs)

  // ---- derived identity ----
  const isAuthenticated = session !== null;
  const role: Role = isAuthenticated ? session!.role : previewRole;
  const userUid = isAuthenticated ? session!.uid : USER_UIDS[previewRole];
  const associatedEntityId = isAuthenticated
    ? session!.associatedEntityId ?? session!.uid
    : previewRole === "supplier"
      ? SUPPLIER_ENTITY_MAP[USER_UIDS[previewRole]] ?? USER_UIDS[previewRole]
      : USER_UIDS[previewRole];

  const toggleOnline = useCallback(() => setOnline((o) => !o), []);

  const enqueueSync = useCallback((label: string) => {
    const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    const item: SyncItem = { id: `q-${Date.now()}`, label, time, status: "queued" };
    setSyncQueue((q) => [item, ...q].slice(0, 12));
  }, []);

  const flushSync = useCallback(() => {
    setSyncQueue((q) => q.map((i): SyncItem => ({ ...i, status: "synced" })));
    window.setTimeout(() => setSyncQueue([]), 1600);
  }, []);

  const notify = useCallback((t: Omit<Toast, "id">) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((ts) => [...ts, { ...t, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((t) => window.setTimeout(() => dismissToast(t.id), 5000));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [toasts, dismissToast]);

  // ---- session lifecycle ----
  const setSession = useCallback((s: AuthState | null) => {
    setSessionState(s);
    if (s) setActiveModule(homeModuleFor(s.role));
  }, []);

  const signOut = useCallback(async () => {
    // Clear the Firebase session too, so onAuthStateChanged doesn't re-replay it.
    try {
      await signOutFirebase();
    } catch {
      /* ignore — still clear local state */
    }
    setSessionState(null);
    setActiveModule("dashboard");
  }, []);

  // Resolve the REAL Firebase session on mount — no fake timeout.
  // watchHybridSession uses onAuthStateChanged which fires when Firebase is ready.
  useEffect(() => {
    const unsub = watchHybridSession((s) => {
      setAuthReady(true);
      if (s) setSessionState(s);
    });
    // If Firebase isn't configured (demo mode), resolve after a brief check.
    const fallback = window.setTimeout(() => setAuthReady(true), 1500);
    return () => {
      unsub();
      window.clearTimeout(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preview-role switch lands on that role's home module.
  useEffect(() => {
    if (!isAuthenticated) setActiveModule(homeModuleFor(previewRole));
  }, [previewRole, isAuthenticated]);

  // Auto-flush the offline queue when connectivity returns.
  useEffect(() => {
    if (online && syncQueue.some((q) => q.status === "queued")) {
      const t = window.setTimeout(() => flushSync(), 1200);
      return () => window.clearTimeout(t);
    }
  }, [online, syncQueue, flushSync]);

  const submitRequest = useCallback(
    (input: Omit<ResourceRequest, "id" | "supplierId" | "supplierName" | "status" | "adminNotes" | "timestamp">) => {
      const full: ResourceRequest = {
        ...input,
        id: `rr-${Date.now()}`,
        supplierId: CURRENT_SUPPLIER.id,
        supplierName: CURRENT_SUPPLIER.name,
        status: "PENDING",
        adminNotes: "",
        timestamp: Date.now(),
      };
      setResourceRequests((rs) => [full, ...rs]);
      return full;
    },
    []
  );

  const decideRequest = useCallback(
    (id: string, status: RequestStatus, adminNotes: string) => {
      setResourceRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status, adminNotes } : r)));
      const req = resourceRequests.find((r) => r.id === id);
      if (!req) return;
      void sendFcmToSupplier({
        token: `fcm:${req.supplierId}`,
        title: status === "APPROVED" ? "Resource Request Approved ✅" : "Resource Request Rejected",
        body: `${req.quantity}× ${req.itemDetails}${adminNotes ? " — " + adminNotes : ""}`,
        data: { requestId: id, type: req.type, status },
      });
      // Also insert into the alerts table for real-time bell + supplier portal.
      void createAlert({
        targetUserId: req.supplierId,
        title: status === "APPROVED" ? "Resource Request Approved ✅" : "Resource Request Rejected",
        body: `${req.quantity}× ${req.itemDetails}${adminNotes ? " — " + adminNotes : ""}`,
        type: "resource",
      });
      notify({
        title: `FCM push dispatched → ${req.supplierName}`,
        body:
          status === "APPROVED"
            ? `Approved ${req.quantity}× ${req.itemDetails}. Allocation confirmed.`
            : `Rejected ${req.quantity}× ${req.itemDetails}. Reason sent to supplier.`,
        tone: status === "APPROVED" ? "emerald" : "rose",
        channel: "FCM",
      });
    },
    [resourceRequests, notify]
  );

  const addEstate = useCallback(
    async (input: Omit<Estate, "id" | "divisions">): Promise<Estate> => {
      const dbId = await repoCreateEstate(role, input);
      const estate: Estate = { ...input, id: dbId, divisions: [] };
      setEstates((es) => [estate, ...es]);
      notify({ title: "Estate created ✅", body: `${input.name} added and saved to database.`, tone: "emerald", channel: "system" });
      return estate;
    },
    [role, notify]
  );

  const addDivision = useCallback(
    async (estateId: string, input: Omit<Division, "id" | "fields">): Promise<Division> => {
      const dbId = await repoCreateDivision(role, estateId, input);
      const division: Division = { ...input, id: dbId, fields: [] };
      setEstates((es) => es.map((e) => (e.id === estateId ? { ...e, divisions: [...e.divisions, division] } : e)));
      return division;
    },
    [role]
  );

  const addField = useCallback(
    async (estateId: string, divisionId: string, input: Omit<Field, "id">): Promise<Field> => {
      const dbId = await repoCreateField(role, estateId, divisionId, input);
      const field: Field = { ...input, id: dbId };
      setEstates((es) =>
        es.map((e) =>
          e.id === estateId
            ? { ...e, divisions: e.divisions.map((d) => (d.id === divisionId ? { ...d, fields: [...d.fields, field] } : d)) }
            : e
        )
      );
      return field;
    },
    [role]
  );

  const value = useMemo<AppState>(
    () => ({
      session,
      setSession,
      signOut,
      authReady,
      isAuthenticated,
      role,
      setRole: setPreviewRole,
      user: USERS[role],
      activeModule,
      setActiveModule,
      online,
      toggleOnline,
      syncQueue,
      enqueueSync,
      flushSync,
      notifications: usesAdminShell(role)
        ? resourceRequests.filter((r) => r.status === "PENDING").length
        : role === "extension_officer"
          ? 3
          : 2,
      canAccess: (moduleKey: string) => rbacCanAccess(role, moduleKey),
      userUid,
      associatedEntityId,
      estates,
      addEstate,
      addDivision,
      addField,
      resourceRequests,
      submitRequest,
      decideRequest,
      toasts,
      notify,
      dismissToast,
    }),
    [session, setSession, signOut, authReady, isAuthenticated, role, activeModule, online, syncQueue, enqueueSync, flushSync, toggleOnline, userUid, associatedEntityId, resourceRequests, submitRequest, decideRequest, toasts, notify, dismissToast, estates, addEstate, addDivision, addField]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
