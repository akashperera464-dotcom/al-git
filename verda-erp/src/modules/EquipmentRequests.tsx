import { useEffect, useState } from "react";
import { Wrench, CheckCircle2, XCircle, Clock3, Send } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip, Segmented } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { fmtNum, addDays, TODAY_ISO, type EquipmentCategory } from "@/lib/data";

/**
 * Equipment Requests Module
 * ------------------------------------------------------------------
 * Phase 1 standalone module per Sir's spec:
 *   - Separate icon/module from Resource Requisitions
 *   - Suppliers (or admin on their behalf) raise equipment requests
 *   - Categories: Plucking Machine, Spray Machine, Bag (Goni),
 *     Pruning Shears, Knapsack Sprayer, Basket, Other
 *   - Phase 2: link to admin inbox + auto-issue from Inventory on approval
 *
 * Persistence: Phase 1 saves to localStorage; Phase 2 will write to
 * Supabase `equipment_requests` table.
 */

const EQUIPMENT_CATEGORIES: { value: EquipmentCategory; label: string; sinhala: string }[] = [
  { value: "Plucking Machine", label: "Plucking Machine", sinhala: "දලු කඩන මැෂින්" },
  { value: "Spray Machine",    label: "Spray Machine",    sinhala: "තෙල්/පොහොර විදින මැෂින්" },
  { value: "Bag",             label: "Bag (Goni)",       sinhala: "ගෝනි" },
  { value: "Pruning Shears",   label: "Pruning Shears",   sinhala: "කප්පාදු කතුරු" },
  { value: "Knapsack Sprayer", label: "Knapsack Sprayer", sinhala: "නාක්සැක් ස්ප්‍රේයර්" },
  { value: "Basket",          label: "Plucking Basket",   sinhala: "ප්ලකිං බාස්කට්" },
  { value: "Other",            label: "Other",            sinhala: "වෙනත්" },
];

type ReqStatus = "PENDING" | "APPROVED" | "REJECTED";

interface EquipmentRequest {
  id: string;
  category: EquipmentCategory;
  itemName: string;
  quantity: number;
  dateNeeded: string;       // ISO yyyy-mm-ddThh:mm
  durationDays: number;
  note: string;
  status: ReqStatus;
  adminNotes: string;
  timestamp: number;
}

const STORAGE_KEY = "kdu.equipment_requests";

export default function EquipmentRequests() {
  const { notify } = useApp();

  const [requests, setRequests] = useState<EquipmentRequest[]>([]);

  // Form state
  const [category, setCategory] = useState<EquipmentCategory>("Plucking Machine");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [dateNeeded, setDateNeeded] = useState(`${addDays(TODAY_ISO, 1)}T06:00`);
  const [duration, setDuration] = useState(1);
  const [note, setNote] = useState("");

  // Filter
  const [filter, setFilter] = useState<"ALL" | ReqStatus>("ALL");

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRequests(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const persist = (next: EquipmentRequest[]) => {
    setRequests(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const submit = () => {
    if (!itemName.trim() || quantity <= 0) {
      notify({ title: "Missing fields", body: "Item name + quantity required", tone: "rose", channel: "system" });
      return;
    }
    const req: EquipmentRequest = {
      id: `eq-${Date.now()}`,
      category,
      itemName: itemName.trim(),
      quantity,
      dateNeeded,
      durationDays: duration,
      note: note.trim(),
      status: "PENDING",
      adminNotes: "",
      timestamp: Date.now(),
    };
    persist([req, ...requests]);
    notify({ title: "Equipment request submitted ✦", body: `${quantity}× ${itemName} (${category}) — pending admin review.`, tone: "sky", channel: "system" });
    setItemName(""); setQuantity(1); setNote("");
  };

  const approve = (id: string) => {
    const req = requests.find(r => r.id === id);
    if (!req) return;
    persist(requests.map(r => r.id === id ? { ...r, status: "APPROVED" } : r));
    notify({ title: "Approved", body: "Equipment request approved.", tone: "emerald", channel: "system" });

    // NEW (Sir's spec A.5): Auto-issue from Inventory on approval.
    // Find matching stock_item (by category='equipment' + matching name) and
    // call issueStock() to auto-deduct. Best-effort — if no match, just approve.
    void (async () => {
      try {
        const { listStockItems, issueStock } = await import("@/lib/repo.phase2");
        const stockItems = await listStockItems();
        // Match: category='equipment' + name contains itemName OR vice versa
        const match = stockItems.find(s =>
          s.category === "equipment" && (
            s.name.toLowerCase().includes(req.itemName.toLowerCase()) ||
            req.itemName.toLowerCase().includes(s.name.toLowerCase()) ||
            s.code.toLowerCase() === req.itemName.toLowerCase()
          )
        );
        if (match) {
          await issueStock({
            stockItemId: match.id,
            qty: req.quantity,
            performedBy: "system-equipment-approve",
            notes: `[Equipment Req #${id.slice(-6).toUpperCase()} · ${req.category} · auto-issue on approval]`,
          });
          notify({
            title: "✅ Auto-issued from Inventory",
            body: `${req.quantity}× ${match.name} auto-deducted from stock (was ${match.qtyOnHand} ${match.unit}, now ${match.qtyOnHand - req.quantity}).`,
            tone: "emerald",
            channel: "system",
          });
        } else {
          notify({
            title: "⚠ No matching stock item",
            body: `Could not find "${req.itemName}" in Inventory (category=equipment). Approved but stock NOT auto-deducted. Please deduct manually.`,
            tone: "amber",
            channel: "system",
          });
        }
      } catch (e) {
        notify({
          title: "Auto-issue failed",
          body: `Approved but couldn't deduct stock: ${e instanceof Error ? e.message : "Unknown error"}`,
          tone: "rose",
          channel: "system",
        });
      }
    })();
  };
  const reject = (id: string) => {
    persist(requests.map(r => r.id === id ? { ...r, status: "REJECTED", adminNotes: "Insufficient stock / unavailable" } : r));
    notify({ title: "Rejected", body: "Equipment request rejected.", tone: "rose", channel: "system" });
  };

  const filtered = filter === "ALL" ? requests : requests.filter(r => r.status === filter);
  const pending = requests.filter(r => r.status === "PENDING").length;
  const approved = requests.filter(r => r.status === "APPROVED").length;
  const rejected = requests.filter(r => r.status === "REJECTED").length;

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Equipment Requests"
        desc="Standalone module for requesting plucking machines, spray machines, bags, shears, and other field equipment. Categories: Plucking Machine, Spray Machine, Bag, Pruning Shears, Knapsack Sprayer, Basket."
        icon={<IconChip icon={Wrench} tone="sky" className="h-12 w-12" />}
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Clock3} label="Pending" value={String(pending)} tone="amber" />
        <StatCard icon={CheckCircle2} label="Approved" value={String(approved)} tone="emerald" />
        <StatCard icon={XCircle} label="Rejected" value={String(rejected)} tone="rose" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Form: submit new equipment request */}
        <Card className="p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">New Equipment Request</h3>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-slate-400">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as EquipmentCategory)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                {EQUIPMENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label} · {c.sinhala}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Item Name (specific)</label>
              <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="e.g., Honda Plucking Machine GX35"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400">Quantity</label>
                <input type="number" min={1} value={quantity} onChange={e => setQuantity(Math.max(0, +e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Duration (days)</label>
                <input type="number" min={1} value={duration} onChange={e => setDuration(Math.max(1, +e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Date & time needed</label>
              <input type="datetime-local" value={dateNeeded} onChange={e => setDateNeeded(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Note (optional)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="e.g. Needed for the peak flush plucking round in Sutton division…"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
            <button onClick={submit}
              className="w-full rounded-lg bg-sky-600 py-2 text-sm font-semibold text-white hover:brightness-110 inline-flex items-center justify-center gap-1.5">
              <Send className="h-3.5 w-3.5" /> Submit Request
            </button>
          </div>
        </Card>

        {/* List of submitted requests */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-slate-800">All Requests</h3>
            <Segmented
              value={filter}
              onChange={v => setFilter(v as "ALL" | ReqStatus)}
              options={[
                { value: "ALL", label: "All" },
                { value: "PENDING", label: "Pending" },
                { value: "APPROVED", label: "Approved" },
                { value: "REJECTED", label: "Rejected" },
              ]}
            />
          </div>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No equipment requests yet.</p>
          ) : (
            <div className="space-y-2 max-h-[28rem] overflow-y-auto">
              {filtered.map(r => (
                <div key={r.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{fmtNum(r.quantity)}× {r.itemName}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{r.category} · needed {new Date(r.dateNeeded).toLocaleString()}</p>
                    </div>
                    <Badge tone={r.status === "APPROVED" ? "emerald" : r.status === "REJECTED" ? "rose" : "amber"} dot>
                      {r.status}
                    </Badge>
                  </div>
                  {r.note && <p className="mt-1.5 text-[11px] text-slate-600 italic">"{r.note}"</p>}
                  {r.status === "PENDING" && (
                    <div className="mt-2 flex gap-1.5">
                      <button onClick={() => approve(r.id)}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:brightness-110 inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Approve
                      </button>
                      <button onClick={() => reject(r.id)}
                        className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:brightness-110 inline-flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[10px] text-slate-400">
            Phase 1: stored in browser localStorage. Phase 2 will sync to Supabase + auto-issue from Inventory on approval.
          </p>
        </Card>
      </div>
    </div>
  );
}
