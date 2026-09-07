import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UserPlus, Scale, Loader2, CheckCircle2, Building2, Layers, Phone, WifiOff, MapPin, AlertTriangle } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { readEstateOptions, readDivisionOptions, saveLeafWeighing, type WeighInResult } from "@/lib/repo";
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
      setError(t("officer.errNameEmailPwRequired"));
      return;
    }
    if (!estateId) {
      setError(t("officer.errSelectFactory"));
      return;
    }
    if (password.length < 6) {
      setError(t("officer.errPasswordMin6"));
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
      notify({ title: t("officer.registered"), body: t("officer.registeredBody", { name: name.trim() }), tone: "emerald", channel: "system" });
      setName(""); setEmail(""); setPassword(""); setPhone(""); setEstateId(""); setDivisionId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("officer.registerFailed"));
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-sm";

  return (
    <div>
      <PageHeader
        eyebrow={t("officer.eyebrow")}
        title={t("officer.registerTitle")}
        desc={t("officer.registerDesc")}
        icon={<IconChip icon={UserPlus} tone="emerald" className="h-12 w-12" />}
      />
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-medium text-slate-400">{t("officer.fullName")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("officer.fullNamePh")} className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400">{t("officer.emailLabel")}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("officer.emailPh")} className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400">{t("officer.tempPassword")}</label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("officer.tempPasswordPh")} className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400"><Phone className="mr-1 inline h-3 w-3" />{t("officer.phoneOptional")}</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("officer.phonePh")} className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400"><Building2 className="mr-1 inline h-3 w-3" />{t("officer.factoryLabel")}</label>
            <select
              value={estateId}
              onChange={(e) => { setEstateId(e.target.value); setDivisionId(""); }}
              className={inputCls}
            >
              <option value="">{t("officer.selectFactory")}</option>
              {estateOptions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400"><Layers className="mr-1 inline h-3 w-3" />{t("officer.divisionOptional")}</label>
            <select
              value={divisionId}
              onChange={(e) => setDivisionId(e.target.value)}
              disabled={!estateId}
              className={inputCls}
            >
              <option value="">{estateId ? t("officer.noneOption") : t("officer.selectFactoryFirst")}</option>
              {filteredDivisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        <button onClick={register} disabled={busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition enabled:hover:brightness-110 disabled:opacity-60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
          {busy ? t("officer.registering") : t("officer.registerBtn")}
        </button>
      </Card>
    </div>
  );
}

/* ====================== 2 · LEAF WEIGHING ENTRY ====================== */

export function EoWeighing() {
  const { t } = useTranslation();
  const { estates, notify, syncQueue, enqueueSync } = useApp();
  const [gross, setGross] = useState(0);
  const [ded, setDed] = useState(4);
  const [grade, setGrade] = useState("Standard");
  const [savedCount, setSavedCount] = useState(0);
  const [tripNumber, setTripNumber] = useState(1);
  const [busy, setBusy] = useState(false);
  const net = +(gross * (1 - ded / 100)).toFixed(1);

  const estate = estates[0];
  const estateId = estate?.id ?? "";

  // Count of pending offline mutations (for the badge)
  const pendingSyncCount = syncQueue.filter(q => q.status === "queued").length;

  const save = async () => {
    if (gross <= 0) {
      notify({ title: t("officer.errInvalidWeight"), body: t("officer.errInvalidWeightBody"), tone: "rose", channel: "system" });
      return;
    }
    setBusy(true);
    try {
      const result: WeighInResult = await saveLeafWeighing("extension_officer", {
        fieldId: estateId,
        grossKg: gross,
        netKg: net,
        grade,
      });

      setSavedCount((c) => c + 1);
      setTripNumber(t => t + 1);

      if (result.status === "online") {
        // Saved successfully to Supabase — green toast
        notify({
          title: t("officer.weighInSaved"),
          body: t("officer.weighInSavedBody", { net: String(net), grade }),
          tone: "emerald",
          channel: "system",
        });
        // Alert all suppliers linked to this estate about the new weigh-in.
        void createAlert({
          targetUserId: estateId,
          title: t("officer.weighInRecorded"),
          body: t("officer.weighInAlertBody", { net: String(net), grade, estate: estate?.name ?? "" }),
          type: "delivery",
        });
      } else if (result.status === "queued_offline") {
        // No signal — saved locally to localStorage queue, will auto-sync later
        notify({
          title: "📭 No Signal! Saved Locally",
          body: `${net} kg (${grade}) saved offline. Will sync automatically when connection returns. (${result.id?.slice(0, 12)}…)`,
          tone: "amber",
          channel: "system",
        });
        // Refresh the queue display
        enqueueSync("Weigh-in queued offline");
      }

      setGross(0);
      setDed(4);
    } catch (e) {
      notify({ title: t("officer.saveFailedTitle"), body: e instanceof Error ? e.message : t("officer.dbErrorBody"), tone: "rose", channel: "system" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={t("officer.eyebrow")}
        title={t("officer.weighingTitle")}
        desc={t("officer.weighingDesc")}
        icon={<IconChip icon={Scale} tone="emerald" className="h-12 w-12" />}
      />

      {/* Pending Offline Sync Banner */}
      {pendingSyncCount > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <WifiOff className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">
              {pendingSyncCount} record{pendingSyncCount > 1 ? "s" : ""} pending sync
            </p>
            <p className="text-[11px] text-amber-600">
              Saved locally while offline. Will auto-sync when connection returns.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {syncQueue.filter(q => q.status === "queued").map(q => (
              <span key={q.id} className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800" title={`${q.label}${q.lastError ? ` — ${q.lastError}` : ""}${q.attempts ? ` (attempt ${q.attempts}/5)` : ""}`}>
                {q.attempts ? `⚠ ${q.attempts}` : "⏳"} {q.label.slice(0, 20)}…
              </span>
            )).slice(0, 3)}
            {pendingSyncCount > 3 && (
              <span className="text-[10px] font-semibold text-amber-600">+{pendingSyncCount - 3} more</span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        <StatCard icon={Scale} label={t("officer.todayNet")} value={net > 0 ? `${net}` : "—"} sub={t("common.kg")} tone="emerald" />
        <StatCard icon={CheckCircle2} label={t("officer.weighed")} value={String(savedCount)} tone="sky" />
        <StatCard icon={Building2} label={t("officer.estate")} value={estate?.name?.slice(0, 10) ?? "—"} tone="amber" />
      </div>

      {/* EO Geo-Location Verification — Sir's spec #2: confirm EO is at the registered estate */}
      <EoLocationVerify estate={estate} />

      <Card className="mt-4 p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-slate-800">{t("officer.newWeighIn")}</h3>
        <div className="grid grid-cols-2 gap-2.5 text-sm">
          <div>
            <label className="text-[11px] font-medium text-slate-400">{t("officer.gradeLabel")}</label>
            <select value={grade} onChange={(e) => setGrade(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5">
              <option value="Super">{t("farm.gradeSuper")}</option>
              <option value="Standard">{t("farm.gradeStandard")}</option>
              <option value="Coarse">{t("farm.gradeCoarse")}</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400">{t("officer.grossWeight")}</label>
            <input type="number" step="0.1" value={gross || ""} onChange={(e) => setGross(+e.target.value)} placeholder={t("officer.grossPh")} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 tnum" />
          </div>
        </div>
        <div className="mt-3">
          <label className="text-[11px] font-medium text-slate-400">{t("officer.deductionPct")}</label>
          <input type="range" min={0} max={15} value={ded} onChange={(e) => setDed(+e.target.value)} className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-600" />
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 p-3">
          <span className="text-xs font-medium text-slate-500">{t("officer.netWeight")}</span>
          <span className="font-display text-xl font-bold text-emerald-700 tnum">{net} {t("common.kg")}</span>
        </div>
        <div className="mt-3">
          {tripNumber > 1 && (
            <div className="mb-2 text-center text-xs font-semibold text-slate-500">
              Trip #{tripNumber} today · {savedCount} total weigh-ins
            </div>
          )}
          <button
            onClick={save}
            disabled={busy || gross <= 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Scale className="h-5 w-5" />}
            {busy ? t("officer.saving2") : t("officer.saveSync")}
          </button>
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * EoLocationVerify — Sir's spec #2 (Admin/EO interface):
 *   "Location API Integration: Alerts සහ Verified Data ලබාගැනීමට Extension
 *   Officers/Admins හරහා වත්තේ Geo-location Verify කිරීම."
 *
 * Uses browser Geolocation API to get EO's current GPS, then computes
 * distance to the registered estate's coordinates. Shows whether EO is
 * AT the estate (verified), NEAR it (within 500m tolerance), or FAR away
 * (potentially fraud — flags a warning).
 *
 * Haversine distance formula (meters).
 * --------------------------------------------------------------------------- */
function EoLocationVerify({ estate }: { estate: { id: string; name?: string; latitude?: number; longitude?: number } | undefined }) {
  const [state, setState] = useState<"idle" | "locating" | "done" | "error">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verify = () => {
    setState("locating");
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("GPS / Geolocation not supported on this device.");
      setState("error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });

        // Compute distance to estate (Haversine, meters)
        if (estate?.latitude !== undefined && estate?.longitude !== undefined) {
          const dist = haversineMeters(lat, lng, estate.latitude, estate.longitude);
          setDistance(Math.round(dist));
        } else {
          setDistance(null); // estate has no coords — can't compare
        }
        setState("done");
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: "Location permission denied. Please allow location access.",
          2: "Position unavailable. Check your GPS signal.",
          3: "Location request timed out. Try again.",
        };
        setError(msgs[err.code] ?? "Could not get your location.");
        setState("error");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Verdict based on distance (within 500m = verified, 500m-2km = near, >2km = far)
  const verdict = distance === null
    ? "no-estate-coords"
    : distance <= 500 ? "verified"
    : distance <= 2000 ? "near"
    : "far";

  return (
    <Card className="mt-4 p-4">
      <h3 className="mb-2 font-display text-sm font-bold text-slate-800 flex items-center gap-1.5">
        <MapPin className="h-4 w-4 text-emerald-600" /> Estate Location Verification
      </h3>
      <p className="text-[11px] text-slate-500 mb-3">
        Confirm you (the Extension Officer) are physically AT the registered estate before weighing leaves. Prevents fraudulent weigh-ins from non-estate locations.
      </p>

      {state === "idle" && (
        <button
          onClick={verify}
          className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:brightness-110 inline-flex items-center justify-center gap-1.5"
        >
          <MapPin className="h-3.5 w-3.5" /> Verify My Location at {estate?.name ?? "Estate"}
        </button>
      )}

      {state === "locating" && (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Getting your GPS location…
        </div>
      )}

      {state === "error" && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertTriangle className="h-3.5 w-3.5 inline mr-1" /> {error}
          <button onClick={verify} className="block mt-2 text-rose-700 underline">Retry</button>
        </div>
      )}

      {state === "done" && coords && (
        <div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-slate-200 p-2">
              <p className="text-[10px] text-slate-400">Your GPS</p>
              <p className="font-mono tnum text-slate-800">{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-2">
              <p className="text-[10px] text-slate-400">Estate GPS</p>
              <p className="font-mono tnum text-slate-800">
                {estate?.latitude?.toFixed(4) ?? "—"}, {estate?.longitude?.toFixed(4) ?? "—"}
              </p>
            </div>
          </div>

          {distance !== null && (
            <div className={`mt-2 rounded-lg p-3 text-xs ${verdict === "verified" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : verdict === "near" ? "bg-amber-50 border border-amber-200 text-amber-700" : "bg-rose-50 border border-rose-200 text-rose-700"}`}>
              <div className="flex items-center justify-between">
                <p className="font-bold">
                  {verdict === "verified" && "✓ Verified"}
                  {verdict === "near" && "⚠ Near estate"}
                  {verdict === "far" && "✗ Far from estate"}
                </p>
                <Badge tone={verdict === "verified" ? "emerald" : verdict === "near" ? "amber" : "rose"}>
                  {distance} m away
                </Badge>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed">
                {verdict === "verified" && "You are AT the registered estate. Weigh-in is verified."}
                {verdict === "near" && "You are within 2km of the estate but more than 500m away. Proceed with caution — confirm visually."}
                {verdict === "far" && "You are more than 2km from the estate. This weigh-in may be fraudulent — verify the supplier's source."}
              </p>
            </div>
          )}

          {distance === null && (
            <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
              Estate has no registered coordinates — cannot verify distance. Ask admin to set lat/lon for this estate.
            </div>
          )}

          <button onClick={verify} className="mt-2 w-full rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50">
            Verify again
          </button>
        </div>
      )}
    </Card>
  );
}

/** Haversine distance between two lat/lng points, in meters. */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
