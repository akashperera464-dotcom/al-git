import { useEffect, useState } from "react";
import { Sprout, CalendarDays, TrendingDown, Package, AlertTriangle } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { fmtNum } from "@/lib/data";

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
 * Reads from the supplier fertilizer ledger written by admin's Inventory
 * module when issuing fertilizer on Credit (Phase 1: localStorage).
 *
 * ALSO reads from supplier's own "My Farm Activities" log to compute
 * "fertilizer used" so we can show "remaining balance".
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

export function SupplierFertilizer() {
  const { user, associatedEntityId } = useApp();
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [usedKg, setUsedKg] = useState<number>(0);

  // The supplier name to match in the ledger — use the logged-in user's name
  const mySupplierName = user?.name ?? "";

  useEffect(() => {
    // Load ledger from localStorage, filter to entries matching my supplier name
    try {
      const raw = localStorage.getItem(LEDGER_KEY);
      const all: LedgerEntry[] = raw ? JSON.parse(raw) : [];
      // Match by name (case-insensitive). Empty name → no match.
      const mine = mySupplierName
        ? all.filter(e => e.supplierName.toLowerCase() === mySupplierName.toLowerCase())
        : [];
      setLedger(mine);
    } catch { /* ignore */ }

    // For Phase 1, read from localStorage farm activity log if present
    // (Phase 2 will replace with useLiveData hook reading from Supabase)
    try {
      const farmRaw = localStorage.getItem("kdu.farm_activities.cache");
      if (farmRaw) {
        const farmLogs: FarmActivityRecord[] = JSON.parse(farmRaw);
        const total = farmLogs
          .filter(a => a.activityType === "fertilizer")
          .reduce((sum, a) => sum + (a.details.quantityKg ?? 0), 0);
        setUsedKg(total);
      }
    } catch { /* ignore */ }
  }, [mySupplierName, associatedEntityId]);

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
        eyebrow="VVIP Supplier Portal"
        title="My Fertilizer"
        desc="Track fertilizer received from factory (credit + cash) + your remaining balance. Credit issues will be deducted from your leaf payments at the factory."
        icon={<IconChip icon={Sprout} tone="emerald" className="h-12 w-12" />}
      />

      {/* Stats overview */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Package}
          label="Total Received (kg)"
          value={fmtNum(totalReceivedKg)}
          sub={`${ledger.length} issues`}
          tone="emerald"
        />
        <StatCard
          icon={TrendingDown}
          label="Used (kg)"
          value={fmtNum(usedKg)}
          sub="from My Farm Activities"
          tone="sky"
        />
        <StatCard
          icon={CalendarDays}
          label="Remaining (kg)"
          value={fmtNum(remainingKg)}
          sub="estimated balance"
          tone={remainingKg < 50 ? "rose" : "amber"}
        />
        <StatCard
          icon={AlertTriangle}
          label="Credit Outstanding"
          value={fmtNum(totalCreditKg)}
          sub="deducted from leaf"
          tone="rose"
        />
      </div>

      {/* History */}
      <Card className="mt-4 p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Fertilizer Issue History</h3>
        {ledger.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-400">No fertilizer received from factory yet.</p>
            <p className="mt-1 text-[11px] text-slate-400">
              When admin issues fertilizer to you (credit or cash), it will appear here.
              Make sure your supplier name matches what admin typed in the Inventory module.
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
                      {isCredit ? "Credit" : "Cash"}
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

      {/* Note about Phase 1 limitations */}
      <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-700">
        <p className="font-semibold">📌 How this works</p>
        <ul className="mt-1.5 space-y-1 list-disc list-inside">
          <li>When admin issues fertilizer to you in the Inventory module, they pick "Credit" + your supplier name.</li>
          <li>The issue appears here with the date, fertilizer type, and quantity.</li>
          <li>"Used (kg)" is computed from your "My Farm Activities" logs.</li>
          <li>"Remaining (kg)" = received − used (estimated; assumes 1 bag = 50 kg).</li>
          <li>Credit issues will be deducted from your leaf payments at the factory.</li>
        </ul>
        <p className="mt-2 text-[10px] text-sky-600">
          Phase 1: stored in browser localStorage. Phase 2 will sync to Supabase `supplier_fertilizer_ledger` table.
        </p>
      </div>
    </div>
  );
}
