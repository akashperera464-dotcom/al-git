import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UserPlus, Scale, Loader2, CheckCircle2, Building2, Layers, Phone } from "lucide-react";
import { PageHeader, StatCard, Card, IconChip } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { readEstateOptions, readDivisionOptions, saveLeafWeighing } from "@/lib/repo";
import { provisionUser } from "@/lib/auth.hybrid";
import { useLiveData } from "@/lib/useLiveData";
import { createAlert } from "@/lib/notifications";

/* ====================== 1 · REGISTER NEW SUPPLIER ====================== */

/**
 * Extension Officer · Register New Supplier form.
 * Fetches real estates from Supabase for the dropdown, then provisions the
 * new supplier via Firebase Auth (secondary app) + Supabase INSERT.
 */
export function EoRegisterSupplier() {
  const { t } = useTranslation();
  const { notify } = useApp();
  const { data: estateOptions } = useLiveData("estates", readEstateOptions);
  const { data: allDivisions } = useLiveData("divisions", readDivisionOptions);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [estateId, setEstateId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cascading: filter divisions by selected estate.
  const filteredDivisions = estateId ? allDivisions.filter((d) => d.id === estateId || d.estateName === estateOptions.find((e) => e.id === estateId)?.name) : [];

  const register = async () => {
    setError(null);
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Full name, email and a temporary password are required.");
      return;
    }
    if (!estateId) {
      setError("Please select a factory for this supplier.");
      return;
    }
    if (password.length < 6) {
      setError("Temporary password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      await provisionUser(email.trim(), password, {
        name: name.trim(),
        role: "supplier",
        associatedEntityId: estateId,
        division: divisionId || null, // nullable — optional
        phone: phone.trim() || null,
      });
      notify({ title: "Supplier registered ✅", body: `${name.trim()} can now log in as a supplier.`, tone: "emerald", channel: "system" });
      setName(""); setEmail(""); setPassword(""); setPhone(""); setEstateId(""); setDivisionId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to register supplier.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-sm";

  return (
    <div>
      <PageHeader
        eyebrow="Extension Officer · Field"
        title={t("officer.registerTitle")}
        desc={t("officer.registerDesc")}
        icon={<IconChip icon={UserPlus} tone="emerald" className="h-12 w-12" />}
      />
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-medium text-slate-400">Full name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nimal Suppliers" className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400">Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="supplier@kdu.com" className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400">Temporary password *</label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 6 chars" className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400"><Phone className="mr-1 inline h-3 w-3" />Phone (optional)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+94 77 000 0000" className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400"><Building2 className="mr-1 inline h-3 w-3" />Factory *</label>
            <select
              value={estateId}
              onChange={(e) => { setEstateId(e.target.value); setDivisionId(""); }}
              className={inputCls}
            >
              <option value="">— select factory —</option>
              {estateOptions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400"><Layers className="mr-1 inline h-3 w-3" />Route / Division (optional)</label>
            <select
              value={divisionId}
              onChange={(e) => setDivisionId(e.target.value)}
              disabled={!estateId}
              className={inputCls}
            >
              <option value="">{estateId ? "— none —" : "select factory first"}</option>
              {filteredDivisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        <button onClick={register} disabled={busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition enabled:hover:brightness-110 disabled:opacity-60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
          {busy ? "Registering…" : "Register Supplier"}
        </button>
      </Card>
    </div>
  );
}

/* ====================== 2 · LEAF WEIGHING ENTRY ====================== */

export function EoWeighing() {
  const { estates, notify } = useApp();
  const [gross, setGross] = useState(0);
  const [ded, setDed] = useState(4);
  const [grade, setGrade] = useState("Standard");
  const [savedCount, setSavedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const net = +(gross * (1 - ded / 100)).toFixed(1);

  const estate = estates[0];
  const estateId = estate?.id ?? "";

  const save = async () => {
    if (gross <= 0) {
      notify({ title: "Invalid weight", body: "Gross weight must be greater than 0.", tone: "rose", channel: "system" });
      return;
    }
    setBusy(true);
    try {
      await saveLeafWeighing("extension_officer", {
        fieldId: estateId,
        grossKg: gross,
        netKg: net,
        grade,
      });
      setSavedCount((c) => c + 1);
      notify({ title: "Weigh-in saved ✅", body: `${net} kg net (${grade}) saved to database.`, tone: "emerald", channel: "system" });
      // Alert all suppliers linked to this estate about the new weigh-in.
      void createAlert({
        targetUserId: estateId,
        title: "Weigh-in Recorded 🌿",
        body: `${net} kg net (${grade} grade) recorded at ${estate?.name ?? "estate"}.`,
        type: "delivery",
      });
      setGross(0);
      setDed(4);
    } catch (e) {
      notify({ title: "Save failed", body: e instanceof Error ? e.message : "Database error.", tone: "rose", channel: "system" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Extension Officer · Field"
        title="Leaf Weighing Entry"
        desc="Log green-leaf weights. Offline-first — queues and syncs automatically."
        icon={<IconChip icon={Scale} tone="emerald" className="h-12 w-12" />}
      />
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard icon={Scale} label="Net Last" value={net > 0 ? `${net}` : "—"} sub="kg" tone="emerald" />
        <StatCard icon={CheckCircle2} label="Weighed" value={String(savedCount)} tone="sky" />
        <StatCard icon={Building2} label="Estate" value={estate?.name?.slice(0, 10) ?? "—"} tone="amber" />
      </div>
      <Card className="mt-4 p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-slate-800">New Weigh-in</h3>
        <div className="grid grid-cols-2 gap-2.5 text-sm">
          <div>
            <label className="text-[11px] font-medium text-slate-400">Grade</label>
            <select value={grade} onChange={(e) => setGrade(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5">
              <option>Super</option>
              <option>Standard</option>
              <option>Coarse</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400">Gross (kg)</label>
            <input type="number" step="0.1" value={gross || ""} onChange={(e) => setGross(+e.target.value)} placeholder="0.0" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 tnum" />
          </div>
        </div>
        <div className="mt-3">
          <label className="text-[11px] font-medium text-slate-400">Deduction %</label>
          <input type="range" min={0} max={15} value={ded} onChange={(e) => setDed(+e.target.value)} className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-600" />
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 p-3">
          <span className="text-xs font-medium text-slate-500">Net weight</span>
          <span className="font-display text-xl font-bold text-emerald-700 tnum">{net} kg</span>
        </div>
        <div className="mt-3">
          <button
            onClick={save}
            disabled={busy || gross <= 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Scale className="h-5 w-5" />}
            {busy ? "Saving…" : "Save & sync"}
          </button>
        </div>
      </Card>
    </div>
  );
}
