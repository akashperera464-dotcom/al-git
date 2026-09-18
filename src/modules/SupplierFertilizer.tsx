import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sprout, CalendarDays, TrendingDown, Package, AlertTriangle } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { useLiveData } from "@/lib/useLiveData";
import { fmtNum } from "@/lib/data";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

/**
 * SupplierFertilizer — "My Fertilizer" module (supplier side)
 * ------------------------------------------------------------------
 * Per Sir's spec: "Personal Fertilizer Stock / History — Factory එකෙන්
 * ලබාගත් පොහොර ප්‍රමාණය සහ තමන් ලඟ දැනට ඉතිරි පොහොර ප්‍රමාණය බලාගැනීම."
 *
 * Shows:
 *   - Total fertilizer received from factory (credit + cash)
 *   - Per-issue history (date, type, qty, division)
 *   - Outstanding balance (credit only — to be deducted from leaf payments)
 *
 * B26 FIX (real-time sync): The ledger now reads from Supabase via
 * useLiveData (with a localStorage fallback), so admin issues appear
 * instantly in the supplier view without a page refresh. The "Used (kg)"
 * figure now reads from BOTH the Supabase `farm_activities` table AND
 * the localStorage cache (kept in sync by recordFarmActivity write-through).
 */

interface LedgerEntry {
  id: string;
  supplierName: string;
  stockItemCode: string;
  stockItemName: string;
  qtyIssued: number;
  unit: string;
  date: string;
  notes?: string;
}

interface FarmActivityRecord {
  activityType: string;
  loggedDate: string;
  details: { type?: string; quantityKg?: number; [k: string]: unknown };
}

const LEDGER_KEY = "kdu.supplier_fertilizer_ledger";

/** Fetch the supplier's fertilizer ledger from Supabase (real-time). */
async function fetchLedger(supplierName: string): Promise<LedgerEntry[]> {
  if (!supabaseConfigured) {
    // Demo mode fallback to localStorage.
    try {
      const raw = localStorage.getItem(LEDGER_KEY);
      const all: LedgerEntry[] = raw ? JSON.parse(raw) : [];
      return supplierName
        ? all.filter(e => e.supplierName.toLowerCase() === supplierName.toLowerCase())
        : [];
    } catch { return []; }
  }
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("supplier_fertilizer_ledger")
    .select("id, supplier_name, stock_item_code, stock_item_name, qty_issued, unit, date, notes")
    .ilike("supplier_name", supplierName || "_")
    .order("date", { ascending: false });
  if (error) {
    // Fall back to localStorage on error.
    try {
      const raw = localStorage.getItem(LEDGER_KEY);
      const all: LedgerEntry[] = raw ? JSON.parse(raw) : [];
      return supplierName
        ? all.filter(e => e.supplierName.toLowerCase() === supplierName.toLowerCase())
        : [];
    } catch { return []; }
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    supplierName: r.supplier_name as string,
    stockItemCode: r.stock_item_code as string,
    stockItemName: r.stock_item_name as string,
    qtyIssued: Number(r.qty_issued ?? 0),
    unit: r.unit as string,
    date: r.date as string,
    notes: r.notes as string | undefined,
  }));
}

/** Fetch fertilizer-usage total (kg) from Supabase farm_activities. */
async function fetchUsedKg(userId: string): Promise<number> {
  if (!supabaseConfigured) {
    // Demo mode: read from localStorage cache.
    try {
      const farmRaw = localStorage.getItem("kdu.farm_activities.cache");
      const farmLogs: FarmActivityRecord[] = farmRaw ? JSON.parse(farmRaw) : [];
      return farmLogs
        .filter(a => a.activityType === "fertilizer")
        .reduce((sum, a) => sum + (a.details.quantityKg ?? 0), 0);
    } catch { return 0; }
  }
  const sb = getSupabase()!;
  const { data } = await sb
    .from("farm_activities")
    .select("details")
    .eq("user_id", userId)
    .eq("activity_type", "fertilizer");
  return (data ?? []).reduce((sum, r) => {
    const d = r.details as { quantityKg?: number };
    return sum + (Number(d?.quantityKg ?? 0));
  }, 0);
}

export function SupplierFertilizer() {
  const { t } = useTranslation();
  const { user, associatedEntityId } = useApp();
  const mySupplierName = user?.name ?? "";

  // B26 FIX: Real-time ledger via useLiveData. Falls back to localStorage in demo mode.
  const { data: ledger } = useLiveData<LedgerEntry>(
    "supplier_fertilizer_ledger",
    () => fetchLedger(mySupplierName),
    `supplier_name=ilike.${mySupplierName || "_"}`,
  );

  const [usedKg, setUsedKg] = useState<number>(0);

  // Read fertilizer usage from localStorage cache (instant) + Supabase (authoritative).
  // Also listen for the verda:farm-cache-updated event so the figure updates immediately
  // when a new fertilizer log is recorded via FarmActivities (B12 fix).
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      // 1. Instant value from localStorage cache.
      try {
        const farmRaw = localStorage.getItem("kdu.farm_activities.cache");
        if (farmRaw) {
          const farmLogs: FarmActivityRecord[] = JSON.parse(farmRaw);
          const total = farmLogs
            .filter(a => a.activityType === "fertilizer")
            .reduce((sum, a) => sum + (a.details.quantityKg ?? 0), 0);
          if (!cancelled) setUsedKg(total);
        }
      } catch { /* ignore */ }
      // 2. Authoritative value from Supabase (overrides cache if non-zero).
      void fetchUsedKg(associatedEntityId).then(kg => {
        if (!cancelled && kg > 0) setUsedKg(kg);
      });
    };
    refresh();
    window.addEventListener("verda:farm-cache-updated", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("verda:farm-cache-updated", refresh);
    };
  }, [associatedEntityId]);

  // Aggregate stats
  const totalReceivedKg = ledger
    .filter(e => e.unit === "kg")
    .reduce((sum, e) => sum + e.qtyIssued, 0);
  const totalReceivedBags = ledger
    .filter(e => e.unit === "bag" || e.unit === "bags")
    .reduce((sum, e) => sum + e.qtyIssued, 0);
  const creditEntries = ledger.filter(e =>
    (e.notes || "").toLowerCase().includes("credit")
  );
  const totalCreditKg = creditEntries
    .filter(e => e.unit === "kg")
    .reduce((sum, e) => sum + e.qtyIssued, 0);

  // Remaining balance (rough estimate — assumes 1 bag = 50 kg)
  const usedKgEquiv = usedKg + (totalReceivedBags * 50);
  const remainingKg = Math.max(0, totalReceivedKg + (totalReceivedBags * 50) - usedKgEquiv);

  return (
    <div>
      <PageHeader
        eyebrow={t("supplierFert.eyebrow")}
        title={t("supplierFert.title")}
        desc={t("supplierFert.desc")}
        icon={<IconChip icon={Sprout} tone="emerald" className="h-12 w-12" />}
      />

      {/* Stats overview */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Package}
          label={t("supplierFert.totalReceived")}
          value={fmtNum(totalReceivedKg)}
          sub={`${ledger.length} ${t("supplierFert.issues")}`}
          tone="emerald"
        />
        <StatCard
          icon={TrendingDown}
          label={t("supplierFert.used")}
          value={fmtNum(usedKg)}
          sub={t("supplierFert.fromFarm")}
          tone="sky"
        />
        {usedKg === 0 && (
          <p className="col-span-2 sm:col-span-4 mt-1 text-[10px] text-slate-400 text-center leading-relaxed">
            💡 {t("supplierFert.noLogs")}<br />
            {t("supplierFert.logHint")}
          </p>
        )}
        <StatCard
          icon={CalendarDays}
          label={t("supplierFert.remaining")}
          value={fmtNum(remainingKg)}
          sub={t("supplierFert.estimated")}
          tone={remainingKg < 50 ? "rose" : "amber"}
        />
        <StatCard
          icon={AlertTriangle}
          label={t("supplierFert.creditOutstanding")}
          value={fmtNum(totalCreditKg)}
          sub={t("supplierFert.deductedFromLeaf")}
          tone="rose"
        />
      </div>

      {/* History */}
      <Card className="mt-4 p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-slate-800">{t("supplierFert.historyTitle")}</h3>
        {ledger.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-400">{t("supplierFert.emptyMsg")}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              {t("supplierFert.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {ledger.map(e => {
              const isCredit = (e.notes || "").toLowerCase().includes("credit");
              const division = (e.notes || "").match(/division:([^|]+)/i)?.[1]?.trim();
              return (
                <div key={e.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {fmtNum(e.qtyIssued)} {e.unit} · {e.stockItemName}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {e.stockItemCode} · {new Date(e.date).toLocaleDateString()}
                        {division && ` · ${division}`}
                      </p>
                    </div>
                    <Badge tone={isCredit ? "amber" : "emerald"} dot>
                      {isCredit ? t("supplierFert.credit") : t("supplierFert.cash")}
                    </Badge>
                  </div>
                  {e.notes && (
                    <p className="mt-1.5 text-[10px] text-slate-500 italic">
                      {e.notes.split("|").slice(-1)[0].trim()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Note about how this works */}
      <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-700">
        <p className="font-semibold">{t("supplierFert.howTitle")}</p>
        <ul className="mt-1.5 space-y-1 list-disc list-inside">
          <li>{t("supplierFert.how1")}</li>
          <li>{t("supplierFert.how2")}</li>
          <li>{t("supplierFert.how3")}</li>
          <li>{t("supplierFert.how4")}</li>
          <li>{t("supplierFert.how5")}</li>
        </ul>
        <p className="mt-2 text-[10px] text-sky-600">
          {t("supplierFert.syncNote")}
        </p>
      </div>
    </div>
  );
}
