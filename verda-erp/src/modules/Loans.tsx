import { HandCoins } from "lucide-react";
import { CrudPanel } from "@/components/CrudPanel";
import { Badge } from "@/components/ui";
import { Meter } from "@/components/ui";
import { fmtLKR } from "@/lib/data";

interface LoanRow { id: string; workerName: string; loanType: string; principal: number; balance: number; monthlyDeduction: number; status: string; }

export default function Loans() {
  return (
    <CrudPanel<LoanRow>
      table="loans"
      eyebrow="People & Pay"
      title="Loans & Advances"
      desc="Full CRUD — issue, edit, settle, delete loans with overdue tracking."
      icon={<HandCoins className="h-6 w-6 text-rose-600" />}
      tone="rose"
      fields={[
        { key: "workerName", label: "Worker Name", type: "text", default: "" },
        { key: "loanType", label: "Loan Type", type: "select", options: ["Personal", "Festival Advance", "Emergency", "Salary Advance"], default: "Personal" },
        { key: "principal", label: "Principal (Rs)", type: "number", default: 25000 },
        { key: "balance", label: "Balance (Rs)", type: "number", default: 25000 },
        { key: "monthlyDeduction", label: "Monthly Deduction (Rs)", type: "number", default: 2500 },
        { key: "status", label: "Status", type: "select", options: ["on-track", "overdue", "cleared"], default: "on-track" },
      ]}
      toDb={(f) => ({
        worker_name: f.workerName, loan_type: f.loanType, principal: f.principal,
        balance: f.balance, monthly_deduction: f.monthlyDeduction, status: f.status,
      })}
      fromDb={(r) => ({
        id: r.id as string, workerName: r.worker_name as string, loanType: r.loan_type as string,
        principal: r.principal as number, balance: r.balance as number,
        monthlyDeduction: r.monthly_deduction as number, status: r.status as string,
      })}
      columns={[
        { key: "workerName", header: "Worker", render: (r) => <span className="font-semibold text-slate-800">{r.workerName}</span> },
        { key: "loanType", header: "Type", render: (r) => <Badge tone="amber">{r.loanType}</Badge> },
        { key: "balance", header: "Repayment", render: (r) => (
          <div className="w-32">
            <div className="mb-0.5 flex justify-between text-[11px] text-slate-400">
              <span>{fmtLKR(r.balance)}</span><span>{fmtLKR(r.principal)}</span>
            </div>
            <Meter value={r.principal > 0 ? ((r.principal - r.balance) / r.principal) * 100 : 0} tone={r.status === "overdue" ? "rose" : "emerald"} />
          </div>
        )},
        { key: "monthlyDeduction", header: "Deduction/mo", align: "right", render: (r) => fmtLKR(r.monthlyDeduction) },
        { key: "status", header: "Status", align: "center", render: (r) => <Badge tone={r.status === "overdue" ? "rose" : r.status === "cleared" ? "slate" : "emerald"} dot>{r.status}</Badge> },
      ]}
    />
  );
}
