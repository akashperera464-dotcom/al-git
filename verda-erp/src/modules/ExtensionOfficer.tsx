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
      notify({ title: t("officer.errInvalidWeight"), body: t("officer.errInvalidWeightBody"), tone: "rose", channel: "system" });
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
      notify({ title: t("officer.weighInSaved"), body: t("officer.weighInSavedBody", { net: String(net), grade }), tone: "emerald", channel: "system" });
      // Alert all suppliers linked to this estate about the new weigh-in.
      void createAlert({
        targetUserId: estateId,
        title: t("officer.weighInRecorded"),
        body: t("officer.weighInAlertBody", { net: String(net), grade, estate: estate?.name ?? "" }),
        type: "delivery",
      });
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
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard icon={Scale} label={t("officer.todayNet")} value={net > 0 ? `${net}` : "—"} sub={t("common.kg")} tone="emerald" />
        <StatCard icon={CheckCircle2} label={t("officer.weighed")} value={String(savedCount)} tone="sky" />
        <StatCard icon={Building2} label={t("officer.estate")} value={estate?.name?.slice(0, 10) ?? "—"} tone="amber" />
      </div>
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
