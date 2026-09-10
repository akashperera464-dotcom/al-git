import { useEffect, useState } from "react";
import { Sprout, Save, Check, CalendarDays, TrendingUp, Trees, RefreshCw, MapPin, Send, Clock, XCircle } from "lucide-react";
import { PageHeader, StatCard, Card, IconChip } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { fmtNum } from "@/lib/data";
import {
  saveRegistrationRequest,
  getLatestRegistrationRequest,
  type EstateRegistrationRequest,
} from "@/lib/estateRegistration";

/**
 * SupplierPlot — "My Plot" module (supplier side)
 * ------------------------------------------------------------------
 * Per Sir's spec round #5:
 *   - Supplier registers estate with all necessary details
 *   - Request goes to admin for approval
 *   - Supplier can enter lat/lon manually OR auto-detect via GPS button
 *   - Edit option available (major changes require re-approval)
 *   - On approval, data auto-populates My Plot module
 *
 * Three modes:
 *   1. "register" — no approved plot data + no pending request → show registration form
 *   2. "pending" — pending request submitted → show "Awaiting Approval" status
 *   3. "view" — approved plot data exists → show stats + details + edit
 *   4. "rejected" — latest request rejected → show rejection reason + allow resubmit
 */
const STORAGE_KEY = (userUid: string) => `kdu.supplier_plot.${userUid}`;

interface PlotSubField {
  id: string;
  code: string;
  name: string;
  cultivar: string;
  plantingYear: number;
  areaHa: number;
  bushCount: number;
  status: "plucking" | "pruned" | "young" | "nursery";
}

interface PlotData {
  acreage: number;
  bushCount: number;
  verifiedAt: string | null;
  cultivar?: string;
  region?: string;
  lastUpdated?: string;
  subFields?: PlotSubField[];
  // Extended fields from approved registration
  plotName?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  contactPhone?: string;
  photoUrls?: string[];
}

const DEFAULT_PLOT: PlotData = {
  acreage: 0,
  bushCount: 0,
  verifiedAt: null,
  subFields: [],
};

/** Yield per acre per year by region (kg green leaf) — Sri Lankan agronomy */
const YIELD_BY_REGION: Record<string, number> = {
  "low-country": 1500,
  "mid-country": 1100,
  "up-country": 800,
  "default": 1200,
};

export function SupplierPlot() {
  const { userUid, user, notify } = useApp();

  const [plot, setPlot] = useState<PlotData>(DEFAULT_PLOT);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [regReq, setRegReq] = useState<EstateRegistrationRequest | null>(null);
  const [locating, setLocating] = useState(false);

  // Form state (used for both initial registration + editing)
  const [formAcreage, setFormAcreage] = useState(0);
  const [formBushCount, setFormBushCount] = useState(0);
  const [formCultivar, setFormCultivar] = useState("TRI 2025 (VP)");
  const [formRegion, setFormRegion] = useState<"low-country" | "mid-country" | "up-country">("low-country");
  // NEW: Registration form fields
  const [formPlotName, setFormPlotName] = useState("");
  const [formLat, setFormLat] = useState<number | "">("");
  const [formLon, setFormLon] = useState<number | "">("");
  const [formAddress, setFormAddress] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPhoto1, setFormPhoto1] = useState("");
  const [formPhoto2, setFormPhoto2] = useState("");
  const [formPhoto3, setFormPhoto3] = useState("");
  const [formLandDoc, setFormLandDoc] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formSoilType, setFormSoilType] = useState<"sandy" | "loam" | "clay" | "sandy-loam" | "clay-loam" | "unknown">("unknown");

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(userUid));
      if (raw) {
        const data = JSON.parse(raw) as PlotData;
        setPlot(data);
        setFormAcreage(data.acreage);
        setFormBushCount(data.bushCount);
        setFormCultivar(data.cultivar ?? "TRI 2025 (VP)");
        setFormRegion((data.region as any) ?? "low-country");
        setFormPlotName(data.plotName ?? "");
        setFormLat(data.latitude ?? "");
        setFormLon(data.longitude ?? "");
        setFormAddress(data.address ?? "");
        setFormPhone(data.contactPhone ?? "");
      }
    } catch { /* ignore */ }

    // Also load latest registration request
    const latest = getLatestRegistrationRequest(userUid);
    setRegReq(latest);
  }, [userUid]);

  const persist = (next: PlotData) => {
    setPlot(next);
    try { localStorage.setItem(STORAGE_KEY(userUid), JSON.stringify(next)); } catch { /* ignore */ }
  };

  const save = () => {
    if (formAcreage < 0 || formBushCount < 0) {
      notify({ title: "Invalid input", body: "Acreage + bush count cannot be negative.", tone: "rose", channel: "system" });
      return;
    }
    setBusy(true);
    const now = new Date().toISOString();
    const next: PlotData = {
      acreage: formAcreage,
      bushCount: formBushCount,
      verifiedAt: now, // saving also marks verification
      cultivar: formCultivar,
      region: formRegion,
      lastUpdated: now,
    };
    persist(next);
    setBusy(false);
    setEditing(false);
    notify({
      title: "Plot details saved ✅",
      body: `${formAcreage} acres · ${fmtNum(formBushCount)} bushes · bush count verified today.`,
      tone: "emerald",
      channel: "system",
    });
  };

  const verifyNow = () => {
    const now = new Date().toISOString();
    persist({ ...plot, verifiedAt: now, lastUpdated: now });
    notify({
      title: "Bush count verified ✅",
      body: "Today's date marked as the new verified snapshot. Next reminder in 6 months.",
      tone: "emerald",
      channel: "system",
    });
  };

  // ---- NEW (Sir's spec): Auto-detect GPS location ----
  const autoDetectLocation = () => {
    setLocating(true);
    if (!("geolocation" in navigator)) {
      notify({ title: "GPS not supported", body: "Geolocation is not available on this device.", tone: "rose", channel: "system" });
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormLat(+pos.coords.latitude.toFixed(6));
        setFormLon(+pos.coords.longitude.toFixed(6));
        setLocating(false);
        notify({ title: "📍 Location detected", body: `Lat: ${pos.coords.latitude.toFixed(4)}, Lon: ${pos.coords.longitude.toFixed(4)}`, tone: "sky", channel: "system" });
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: "Location permission denied. Please allow location access.",
          2: "Position unavailable. Check your GPS signal.",
          3: "Location request timed out. Try again.",
        };
        notify({ title: "Location error", body: msgs[err.code] ?? "Could not get your location.", tone: "rose", channel: "system" });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // ---- NEW (Sir's spec): Submit registration request for admin approval ----
  const submitRegistration = () => {
    if (!formPlotName.trim()) { notify({ title: "Missing plot name", body: "Please enter a name for your plot.", tone: "rose", channel: "system" }); return; }
    if (formAcreage <= 0) { notify({ title: "Missing acreage", body: "Please enter your plot acreage.", tone: "rose", channel: "system" }); return; }
    if (formBushCount <= 0) { notify({ title: "Missing bush count", body: "Please enter your bush count.", tone: "rose", channel: "system" }); return; }

    const photoUrls = [formPhoto1, formPhoto2, formPhoto3].filter(u => u.trim());

    const req: EstateRegistrationRequest = {
      id: `reg-${Date.now()}`,
      supplierId: userUid,
      supplierName: user?.name ?? userUid,
      plotName: formPlotName.trim(),
      acreage: formAcreage,
      bushCount: formBushCount,
      cultivar: formCultivar,
      region: formRegion,
      soilType: formSoilType,
      latitude: typeof formLat === "number" ? formLat : 0,
      longitude: typeof formLon === "number" ? formLon : 0,
      address: formAddress.trim(),
      contactPhone: formPhone.trim(),
      photoUrls,
      landDocumentUrl: formLandDoc.trim() || undefined,
      notes: formNotes.trim(),
      status: "PENDING",
      adminNotes: "",
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      editCount: regReq ? regReq.editCount + 1 : 0,
      lastEditedAt: regReq ? new Date().toISOString() : null,
    };
    saveRegistrationRequest(req);
    setRegReq(req);
    notify({
      title: "✅ Registration submitted!",
      body: `"${req.plotName}" — awaiting admin approval. You'll be notified once approved.`,
      tone: "sky",
      channel: "system",
    });
  };

  // ---- Determine which mode to show ----
  // Mode priority: pending request > rejected (show form) > no data (show form) > approved data (show view)
  const mode: "register" | "pending" | "rejected" | "view" =
    regReq?.status === "PENDING" ? "pending"
    : regReq?.status === "REJECTED" ? "rejected"
    : plot.acreage === 0 ? "register"
    : "view";

  // NEW (Sir's spec): Sub-field management — like admin's Estate Master but for the supplier's own plot.
  // Suppliers can divide their plot into sub-sections (e.g., "Upper Plot", "Lower Plot") and
  // track per-section bush count + area + cultivar. The plot's total acreage + bush count
  // are auto-aggregated from sub-fields when present (overriding manual entry).
  const [showSubFieldForm, setShowSubFieldForm] = useState(false);
  const [editingSubFieldId, setEditingSubFieldId] = useState<string | null>(null);
  const [subCode, setSubCode] = useState("P-01");
  const [subName, setSubName] = useState("");
  const [subCultivar, setSubCultivar] = useState("TRI 2025 (VP)");
  const [subYear, setSubYear] = useState(new Date().getFullYear());
  const [subAreaHa, setSubAreaHa] = useState(0);
  const [subBush, setSubBush] = useState(0);
  const [subStatus, setSubStatus] = useState<PlotSubField["status"]>("plucking");

  const startAddSubField = () => {
    setEditingSubFieldId(null);
    setSubCode(`P-${String((plot.subFields?.length ?? 0) + 1).padStart(2, "0")}`);
    setSubName("");
    setSubCultivar(plot.cultivar ?? "TRI 2025 (VP)");
    setSubYear(new Date().getFullYear());
    setSubAreaHa(0);
    setSubBush(0);
    setSubStatus("plucking");
    setShowSubFieldForm(true);
  };

  const startEditSubField = (sf: PlotSubField) => {
    setEditingSubFieldId(sf.id);
    setSubCode(sf.code);
    setSubName(sf.name);
    setSubCultivar(sf.cultivar);
    setSubYear(sf.plantingYear);
    setSubAreaHa(sf.areaHa);
    setSubBush(sf.bushCount);
    setSubStatus(sf.status);
    setShowSubFieldForm(true);
  };

  const saveSubField = () => {
    if (!subName.trim() || subAreaHa <= 0) {
      notify({ title: "Missing fields", body: "Sub-field name + area are required", tone: "rose", channel: "system" });
      return;
    }
    const newSf: PlotSubField = {
      id: editingSubFieldId ?? `sf-${Date.now()}`,
      code: subCode.trim() || `P-${String((plot.subFields?.length ?? 0) + 1).padStart(2, "0")}`,
      name: subName.trim(),
      cultivar: subCultivar,
      plantingYear: subYear,
      areaHa: subAreaHa,
      bushCount: subBush,
      status: subStatus,
    };
    const existing = plot.subFields ?? [];
    const updated = editingSubFieldId
      ? existing.map(sf => sf.id === editingSubFieldId ? newSf : sf)
      : [...existing, newSf];

    // Auto-aggregate plot totals from sub-fields (in hectares → acres conversion)
    const totalHa = updated.reduce((s, sf) => s + sf.areaHa, 0);
    const totalBush = updated.reduce((s, sf) => s + sf.bushCount, 0);
    const now = new Date().toISOString();
    const next: PlotData = {
      ...plot,
      subFields: updated,
      // Auto-update acreage + bush count from sub-fields (when present)
      acreage: +(totalHa * 2.471).toFixed(2),  // ha → acres
      bushCount: totalBush,
      lastUpdated: now,
    };
    persist(next);
    setShowSubFieldForm(false);
    setEditingSubFieldId(null);
    notify({
      title: editingSubFieldId ? "Sub-field updated ✅" : "Sub-field added ✅",
      body: `${newSf.name} (${newSf.areaHa} ha, ${fmtNum(newSf.bushCount)} bushes). Plot totals auto-updated.`,
      tone: "emerald",
      channel: "system",
    });
  };

  const deleteSubField = (id: string) => {
    const updated = (plot.subFields ?? []).filter(sf => sf.id !== id);
    const totalHa = updated.reduce((s, sf) => s + sf.areaHa, 0);
    const totalBush = updated.reduce((s, sf) => s + sf.bushCount, 0);
    const next: PlotData = {
      ...plot,
      subFields: updated,
      acreage: updated.length > 0 ? +(totalHa * 2.471).toFixed(2) : plot.acreage,
      bushCount: updated.length > 0 ? totalBush : plot.bushCount,
      lastUpdated: new Date().toISOString(),
    };
    persist(next);
  };

  // Calculations
  const bushesPerAcre = plot.acreage > 0 ? Math.round(plot.bushCount / plot.acreage) : 0;
  const expectedYieldKgPerYear = plot.acreage > 0
    ? Math.round(plot.acreage * (YIELD_BY_REGION[plot.region ?? "default"] ?? YIELD_BY_REGION.default))
    : 0;
  const expectedMonthlyKg = Math.round(expectedYieldKgPerYear / 12);

  // 6-month staleness check
  const now = Date.now();
  const SIX_MONTHS_MS = 6 * 30 * 86400_000;
  const lastDate = plot.verifiedAt ? new Date(plot.verifiedAt) : null;
  const isStale = !lastDate || (now - lastDate.getTime()) > SIX_MONTHS_MS;
  const monthsAgo = lastDate ? Math.floor((now - lastDate.getTime()) / (30 * 86400_000)) : null;

  return (
    <div>
      <PageHeader
        eyebrow="VVIP Supplier Portal"
        title="My Plot"
        desc="Register your tea plot with all details. Admin must approve before your plot becomes active. You can auto-detect your GPS location or enter it manually."
        icon={<IconChip icon={Sprout} tone="emerald" className="h-12 w-12" />}
      />

      {/* ===== PENDING STATUS — registration awaiting admin approval ===== */}
      {mode === "pending" && regReq && (
        <Card className="mt-4 p-5 border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <h3 className="font-display text-base font-bold text-amber-800">⏳ Registration Awaiting Approval</h3>
          </div>
          <p className="text-sm text-amber-700 mb-3">
            Your plot "<strong>{regReq.plotName}</strong>" was submitted on {new Date(regReq.submittedAt).toLocaleDateString()}.
            Admin will review and approve/reject it. You'll be notified when it's approved.
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm border-t border-amber-200 pt-3">
            <div><span className="text-amber-600">Acreage:</span> <strong>{regReq.acreage} acres</strong></div>
            <div><span className="text-amber-600">Bush Count:</span> <strong>{fmtNum(regReq.bushCount)}</strong></div>
            <div><span className="text-amber-600">Cultivar:</span> <strong>{regReq.cultivar}</strong></div>
            <div><span className="text-amber-600">Region:</span> <strong className="capitalize">{regReq.region.replace("-", " ")}</strong></div>
            <div><span className="text-amber-600">GPS:</span> <strong>{regReq.latitude.toFixed(4)}, {regReq.longitude.toFixed(4)}</strong></div>
            <div><span className="text-amber-600">Phone:</span> <strong>{regReq.contactPhone || "—"}</strong></div>
          </div>
          {regReq.address && <p className="mt-2 text-xs text-amber-600">📍 {regReq.address}</p>}
          {regReq.notes && <p className="mt-1 text-xs text-amber-600 italic">Notes: "{regReq.notes}"</p>}
          {regReq.photoUrls.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] text-amber-600 font-semibold mb-1">📷 Photos:</p>
              <div className="flex gap-2">
                {regReq.photoUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-amber-700 underline">Photo {i + 1}</a>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ===== REJECTED STATUS — show rejection reason + allow resubmit ===== */}
      {mode === "rejected" && regReq && (
        <Card className="mt-4 p-5 border-rose-200 bg-rose-50">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 text-rose-600" />
            <h3 className="font-display text-base font-bold text-rose-800">❌ Registration Rejected</h3>
          </div>
          <p className="text-sm text-rose-700 mb-2">
            Your plot "<strong>{regReq.plotName}</strong>" was rejected on {regReq.reviewedAt ? new Date(regReq.reviewedAt).toLocaleDateString() : "—"}.
          </p>
          {regReq.adminNotes && (
            <div className="rounded-lg bg-white border border-rose-200 px-3 py-2 text-sm text-rose-700 mb-3">
              <strong>Admin's reason:</strong> {regReq.adminNotes}
            </div>
          )}
          <p className="text-xs text-rose-600">Please review the feedback above, update your details, and resubmit below.</p>
        </Card>
      )}

      {/* ===== REGISTRATION FORM — for first-time registration OR rejected resubmit ===== */}
      {(mode === "register" || mode === "rejected") && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">
            {mode === "rejected" ? "📝 Update & Resubmit Registration" : "📝 Register Your Tea Plot"}
          </h3>
          <p className="text-[11px] text-slate-500 mb-3">
            Fill in all details below. Your plot will be reviewed by the admin before activation.
            Use the 📍 Auto-Detect button to fill your GPS coordinates automatically.
          </p>
          <div className="space-y-3">
            {/* Plot name + phone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400">🏞️ වත්තේ නම · Plot Name *</label>
                <input value={formPlotName} onChange={e => setFormPlotName(e.target.value)} placeholder="උදා: නිමල්ගේ තේ වත්ත / e.g., Nimal's Tea Plot" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">📞 දුරකථන · Contact Phone</label>
                <input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+94 77 123 4567" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              </div>
            </div>
            {/* Acreage + bush count */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400">📐 අක්කර ගණන · Acreage (acres) *</label>
                <input type="number" min={0} step="any" value={formAcreage || ""} onChange={e => setFormAcreage(+e.target.value)} placeholder="උදා: 2.5" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">🌳 තේ ගස් ගණන · Bush Count *</label>
                <input type="number" min={0} value={formBushCount || ""} onChange={e => setFormBushCount(+e.target.value)} placeholder="උදා: 5400" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
              </div>
            </div>
            {/* Cultivar + region */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400">🌱 තේ ප්‍රභේදය · Cultivar (TRI Clone)</label>
                <select value={formCultivar} onChange={e => setFormCultivar(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                  <option value="TRI 2025 (VP)">TRI 2025 (VP)</option>
                  <option value="TRI 2023 (VP)">TRI 2023 (VP)</option>
                  <option value="TRI 2024 (VP)">TRI 2024 (VP)</option>
                  <option value="Seedling">Seedling (බීජ පැළ)</option>
                  <option value="Other">Other (වෙනත්)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400">🌍 ප්‍රදේශය · Region</label>
                <select value={formRegion} onChange={e => setFormRegion(e.target.value as any)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                  <option value="low-country">Low-Country (පහතරට) — ~1,500 kg/acre</option>
                  <option value="mid-country">Mid-Country (මැදරට) — ~1,100 kg/acre</option>
                  <option value="up-country">Up-Country (ඉහළරට) — ~800 kg/acre</option>
                </select>
              </div>
            </div>
            {/* Soil type — NEW per spec */}
            <div>
              <label className="text-[11px] text-slate-400">🪨 පසේ ස්වභාවය · Soil Type</label>
              <select value={formSoilType} onChange={e => setFormSoilType(e.target.value as any)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                <option value="unknown">— නොදනී / Unknown —</option>
                <option value="sandy">�වැලි පස / Sandy</option>
                <option value="loam">ලෝම පස / Loam (best for tea)</option>
                <option value="clay">මැටි පස / Clay</option>
                <option value="sandy-loam">වැලි-ලෝම / Sandy-Loam</option>
                <option value="clay-loam">මැටි-ලෝම / Clay-Loam</option>
              </select>
              <p className="mt-1 text-[10px] text-slate-400">පසේ ස්වභාවය අනුව පොහොර නිර්දේශ වෙනස් වේ. (Soil type affects fertilizer recommendations.)</p>
            </div>
            {/* GPS coordinates with auto-detect */}
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] text-sky-700 font-semibold flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> GPS Coordinates *
                </label>
                <button
                  onClick={autoDetectLocation}
                  disabled={locating}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {locating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                  {locating ? "Detecting..." : "📍 Auto-Detect My Location"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400">Latitude</label>
                  <input type="number" step="any" value={formLat} onChange={e => setFormLat(e.target.value ? +e.target.value : "")} placeholder="6.9679" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Longitude</label>
                  <input type="number" step="any" value={formLon} onChange={e => setFormLon(e.target.value ? +e.target.value : "")} placeholder="80.7618" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
                </div>
              </div>
              {typeof formLat === "number" && typeof formLon === "number" && (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${formLat}&mlon=${formLon}&zoom=15`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-block text-[11px] text-sky-700 underline"
                >
                  🗺️ View on map (opens OpenStreetMap)
                </a>
              )}
            </div>
            {/* Address */}
            <div>
              <label className="text-[11px] text-slate-400">📍 ලිපිනය · Address (village, district)</label>
              <input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="උදා: රගල, වලපානේ / e.g., Ragala, Walapane" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
            {/* Photo URLs (Phase 1: text input; Phase 2: file upload) */}
            <div className="rounded-lg border border-slate-200 p-3">
              <label className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 mb-2">
                📷 වත්තේ ඡායාරූප · Plot Photos (URLs — optional)
              </label>
              <div className="space-y-2">
                <input value={formPhoto1} onChange={e => setFormPhoto1(e.target.value)} placeholder="Photo 1 URL (boundary/entrance)" className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
                <input value={formPhoto2} onChange={e => setFormPhoto2(e.target.value)} placeholder="Photo 2 URL (tea bushes)" className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
                <input value={formPhoto3} onChange={e => setFormPhoto3(e.target.value)} placeholder="Photo 3 URL (landscape)" className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
              </div>
            </div>
            {/* Land document URL (optional) */}
            <div>
              <label className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                📄 ඉඩම් ඔප්පු · Land Document URL (optional — deed/ඔප්පු)
              </label>
              <input value={formLandDoc} onChange={e => setFormLandDoc(e.target.value)} placeholder="URL to scan/photo of land deed" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
            {/* Notes */}
            <div>
              <label className="text-[11px] text-slate-400">📝 සටහන් · Notes (optional)</label>
              <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} placeholder="Any additional information about your plot" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
            {/* Submit button */}
            <button
              onClick={submitRegistration}
              className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white hover:brightness-110 inline-flex items-center justify-center gap-1.5"
            >
              <Send className="h-4 w-4" /> Submit for Admin Approval
            </button>
            {formAcreage > 0 && formBushCount > 0 && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-700">
                <strong>{fmtNum(Math.round(formBushCount / formAcreage))}</strong> bushes/acre density
                · Expected yield: <strong>{fmtNum(Math.round(formAcreage * (YIELD_BY_REGION[formRegion] ?? YIELD_BY_REGION.default)))} kg/year</strong>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ===== VIEW MODE — existing UI (only when mode === "view") ===== */}
      {mode === "view" && (
        <>
      {/* 6-month bush count re-verification reminder */}
      {isStale && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-800">
          <p className="flex items-center gap-1.5 text-sm font-bold mb-1">
            <RefreshCw className="h-4 w-4" /> 🌳 Bush count re-verification due
          </p>
          <p className="text-xs leading-relaxed">
            {monthsAgo === null
              ? "Bush count has never been verified. Set your plot details below and verify it now."
              : `Last verified ${monthsAgo} month(s) ago. Plants may have died or been replanted — please re-count.`}
            {" "}Tap "Verify Now" to mark today's date as the new verified snapshot.
          </p>
          <div className="mt-2 flex gap-2">
            {plot.bushCount > 0 && (
              <button
                onClick={verifyNow}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 inline-flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" /> Verify Now
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-amber-600 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
            >
              Edit Plot Details
            </button>
          </div>
        </div>
      )}

      {/* Stats overview */}
      {plot.acreage > 0 && !editing && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Sprout} label="Acreage" value={`${plot.acreage}`} sub="acres" tone="emerald" />
          <StatCard icon={Trees} label="Bush Count" value={fmtNum(plot.bushCount)} sub="bushes" tone="sky" />
          <StatCard icon={TrendingUp} label="Bushes / Acre" value={fmtNum(bushesPerAcre)} sub="density" tone="violet" />
          <StatCard icon={CalendarDays} label="Last Verified" value={lastDate ? lastDate.toLocaleDateString() : "—"} sub={monthsAgo !== null ? `${monthsAgo}m ago` : "never"} tone={isStale ? "rose" : "amber"} />
        </div>
      )}

      {/* Yield prediction */}
      {plot.acreage > 0 && !editing && (
        <Card className="mt-4 p-4">
          <h3 className="font-display text-sm font-bold text-slate-800 mb-2">📊 Yield Potential ({{ "low-country": "Low-Country", "mid-country": "Mid-Country", "up-country": "Up-Country" }[plot.region ?? "default"] || "Default"})</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-[11px] text-emerald-700 font-semibold">Expected Annual Yield</p>
              <p className="text-2xl font-extrabold text-emerald-700 tnum">{fmtNum(expectedYieldKgPerYear)} kg</p>
              <p className="text-[10px] text-emerald-600">green leaf per year</p>
            </div>
            <div className="rounded-lg bg-sky-50 p-3">
              <p className="text-[11px] text-sky-700 font-semibold">Monthly Average</p>
              <p className="text-2xl font-extrabold text-sky-700 tnum">{fmtNum(expectedMonthlyKg)} kg</p>
              <p className="text-[10px] text-sky-600">green leaf per month</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            * Yield estimates based on Sri Lankan tea agronomy: low-country ~1,500 kg/acre/year, mid-country ~1,100 kg/acre/year, up-country ~800 kg/acre/year. Actual yield depends on fertilizer, pruning cycles, and weather.
          </p>
        </Card>
      )}

      {/* Edit form */}
      {editing && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">
            {plot.acreage === 0 ? "Enter Your Plot Details" : "Edit Plot Details"}
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400">Acreage (acres)</label>
                <input
                  type="number" min={0} step="any" value={formAcreage || ""}
                  onChange={e => setFormAcreage(+e.target.value)}
                  placeholder="e.g. 2.5"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Bush Count (total tea bushes)</label>
                <input
                  type="number" min={0} value={formBushCount || ""}
                  onChange={e => setFormBushCount(+e.target.value)}
                  placeholder="e.g. 5400"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400">Cultivar (tea variety)</label>
                <select
                  value={formCultivar}
                  onChange={e => setFormCultivar(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm"
                >
                  <option value="TRI 2025 (VP)">TRI 2025 (VP)</option>
                  <option value="TRI 2023 (VP)">TRI 2023 (VP)</option>
                  <option value="TRI 2024 (VP)">TRI 2024 (VP)</option>
                  <option value="Seedling">Seedling</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Region (drives yield estimate)</label>
                <select
                  value={formRegion}
                  onChange={e => setFormRegion(e.target.value as any)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm"
                >
                  <option value="low-country">Low-Country (පහතරට) — ~1,500 kg/acre</option>
                  <option value="mid-country">Mid-Country (මැදරට) — ~1,100 kg/acre</option>
                  <option value="up-country">Up-Country (ඉහළරට) — ~800 kg/acre</option>
                </select>
              </div>
            </div>
            {formAcreage > 0 && formBushCount > 0 && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-700">
                <strong>{fmtNum(Math.round(formBushCount / formAcreage))}</strong> bushes/acre density
                · Expected yield: <strong>{fmtNum(Math.round(formAcreage * (YIELD_BY_REGION[formRegion] ?? YIELD_BY_REGION.default)))} kg/year</strong>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={busy}
                className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                <Save className="h-3.5 w-3.5" /> Save & Verify
              </button>
              {plot.acreage > 0 && (
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500"
                >
                  Cancel
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              Phase 1: saved to browser localStorage. Phase 2 will sync to Supabase + send FCM reminder 6 months from now.
            </p>
          </div>
        </Card>
      )}

      {/* Show saved details (when not editing) */}
      {plot.acreage > 0 && !editing && (
        <Card className="mt-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-slate-800">Plot Details</h3>
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-semibold text-emerald-600 hover:underline"
            >
              Edit
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-[11px] text-slate-400">Acreage</dt><dd className="font-semibold text-slate-800 tnum">{plot.acreage} acres</dd></div>
            <div><dt className="text-[11px] text-slate-400">Bush Count</dt><dd className="font-semibold text-slate-800 tnum">{fmtNum(plot.bushCount)} bushes</dd></div>
            <div><dt className="text-[11px] text-slate-400">Cultivar</dt><dd className="font-semibold text-slate-800">{plot.cultivar ?? "—"}</dd></div>
            <div><dt className="text-[11px] text-slate-400">Region</dt><dd className="font-semibold text-slate-800 capitalize">{plot.region?.replace("-", " ") ?? "—"}</dd></div>
            <div><dt className="text-[11px] text-slate-400">Verified At</dt><dd className="font-semibold text-slate-800">{lastDate ? lastDate.toLocaleDateString() : "—"}</dd></div>
            <div><dt className="text-[11px] text-slate-400">Last Updated</dt><dd className="font-semibold text-slate-800">{plot.lastUpdated ? new Date(plot.lastUpdated).toLocaleDateString() : "—"}</dd></div>
          </dl>
        </Card>
      )}

      {/* NEW (Sir's spec — supplier-side estate management):
          Sub-fields management — suppliers can divide their plot into sub-sections
          (like admin's Estate Master but for the supplier's own plot). Each sub-field
          has its own area + bush count + cultivar. Plot totals auto-aggregate. */}
      {plot.acreage > 0 && !editing && (
        <Card className="mt-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-800">Plot Sub-Fields / Sections</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Divide your plot into sub-sections (e.g., Upper Plot, Lower Plot) to track each section separately.
                Plot totals auto-aggregate from sub-fields.
              </p>
            </div>
            <button
              onClick={startAddSubField}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
            >
              + Add Sub-Field
            </button>
          </div>

          {/* Sub-fields list */}
          {(plot.subFields?.length ?? 0) > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="pb-2">Code</th>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Cultivar</th>
                    <th className="pb-2 text-right">Area (ha)</th>
                    <th className="pb-2 text-right">Bushes</th>
                    <th className="pb-2 text-center">Status</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {plot.subFields!.map(sf => (
                    <tr key={sf.id} className="border-t border-slate-100">
                      <td className="py-2 font-mono text-xs">{sf.code}</td>
                      <td className="py-2 font-semibold text-slate-800">{sf.name}</td>
                      <td className="py-2 text-slate-600">{sf.cultivar}</td>
                      <td className="py-2 text-right tnum">{sf.areaHa}</td>
                      <td className="py-2 text-right tnum">{fmtNum(sf.bushCount)}</td>
                      <td className="py-2 text-center">
                        <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${
                          sf.status === "plucking" ? "bg-emerald-100 text-emerald-700"
                          : sf.status === "pruned" ? "bg-amber-100 text-amber-700"
                          : sf.status === "young" ? "bg-sky-100 text-sky-700"
                          : "bg-violet-100 text-violet-700"
                        }`}>
                          {sf.status}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button onClick={() => startEditSubField(sf)} className="text-xs text-emerald-600 hover:underline mr-2">Edit</button>
                        <button onClick={() => deleteSubField(sf.id)} className="text-xs text-rose-500 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200">
                    <td colSpan={3} className="py-2 text-right text-xs font-semibold text-slate-600">Total</td>
                    <td className="py-2 text-right tnum font-bold text-slate-800">{(plot.subFields ?? []).reduce((s, sf) => s + sf.areaHa, 0).toFixed(2)} ha</td>
                    <td className="py-2 text-right tnum font-bold text-slate-800">{fmtNum((plot.subFields ?? []).reduce((s, sf) => s + sf.bushCount, 0))}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-slate-400">
              No sub-fields yet. Add sub-fields to track different sections of your plot separately.
            </p>
          )}

          {/* Add/Edit sub-field form */}
          {showSubFieldForm && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h4 className="mb-2 text-sm font-bold text-slate-800">
                {editingSubFieldId ? "Edit Sub-Field" : "Add Sub-Field"}
              </h4>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-[11px] text-slate-400">Code</label>
                  <input value={subCode} onChange={e => setSubCode(e.target.value)} placeholder="P-01" className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Name *</label>
                  <input value={subName} onChange={e => setSubName(e.target.value)} placeholder="e.g., Upper Plot" className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Cultivar</label>
                  <select value={subCultivar} onChange={e => setSubCultivar(e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs">
                    <option value="TRI 2025 (VP)">TRI 2025 (VP)</option>
                    <option value="TRI 2023 (VP)">TRI 2023 (VP)</option>
                    <option value="TRI 2024 (VP)">TRI 2024 (VP)</option>
                    <option value="Seedling">Seedling</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Planting Year</label>
                  <input type="number" value={subYear} onChange={e => setSubYear(+e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs tnum" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Area (ha) *</label>
                  <input type="number" step="any" min={0} value={subAreaHa || ""} onChange={e => setSubAreaHa(+e.target.value)} placeholder="0.5" className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs tnum" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Bush Count</label>
                  <input type="number" min={0} value={subBush || ""} onChange={e => setSubBush(+e.target.value)} placeholder="1200" className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs tnum" />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-slate-400">Status</label>
                  <select value={subStatus} onChange={e => setSubStatus(e.target.value as PlotSubField["status"])} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs">
                    <option value="plucking">Plucking</option>
                    <option value="pruned">Pruned</option>
                    <option value="young">Young</option>
                    <option value="nursery">Nursery</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveSubField}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:brightness-110"
                >
                  {editingSubFieldId ? "Update" : "Add"}
                </button>
                <button
                  onClick={() => { setShowSubFieldForm(false); setEditingSubFieldId(null); }}
                  className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-500"
                >
                  Cancel
                </button>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                * Adding sub-fields auto-updates your plot's total acreage + bush count.
              </p>
            </div>
          )}
        </Card>
      )}
      {/* ===== END VIEW MODE ===== */}
      </>
      )}
    </div>
  );
}
