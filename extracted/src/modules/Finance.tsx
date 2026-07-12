import { Calculator } from "lucide-react";
import { CrudPanel } from "@/components/CrudPanel";
import { Badge } from "@/components/ui";
import { fmtLKR } from "@/lib/data";

interface LedgerRow { id: string; account: string; entryType: string; debit: number; credit: number; }

export default function Finance() {
  return (
    <CrudPanel<LedgerRow>
      table="ledger_entries"
      eyebrow="Finance"
      title="Finance & Accounting"
      desc="Full CRUD — general ledger entries, P&L, accounts payable/receivable."
      icon={<Calculator className="h-6 w-6 text-emerald-600" />}
      tone="emerald"
      fields={[
        { key: "account", label: "Account Name", type: "text", default: "" },
        { key: "entryType", label: "Type", type: "select", options: ["Revenue", "Expense", "Asset", "Liability"], default: "Expense" },
        { key: "debit", label: "Debit (Rs)", type: "number", default: 0 },
        { key: "credit", label: "Credit (Rs)", type: "number", default: 0 },
      ]}
      toDb={(f) => ({ account: f.account, entry_type: f.entryType, debit: f.debit, credit: f.credit })}
      fromDb={(r) => ({
        id: r.id as string, account: r.account as string, entryType: r.entry_type as string,
        debit: Number(r.debit), credit: Number(r.credit),
      })}
      columns={[
        { key: "account", header: "Account", render: (r) => <span className="font-semibold text-slate-800">{r.account}</span> },
        { key: "entryType", header: "Type", render: (r) => <Badge tone={r.entryType === "Revenue" ? "emerald" : r.entryType === "Expense" ? "rose" : r.entryType === "Asset" ? "sky" : "amber"}>{r.entryType}</Badge> },
        { key: "debit", header: "Debit", align: "right", render: (r) => r.debit ? fmtLKR(r.debit) : <span className="text-slate-300">—</span> },
        { key: "credit", header: "Credit", align: "right", render: (r) => r.credit ? fmtLKR(r.credit) : <span className="text-slate-300">—</span> },
      ]}
    />
  );
}
