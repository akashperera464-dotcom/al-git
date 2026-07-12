import { Wallet } from "lucide-react";
import { CrudPanel } from "@/components/CrudPanel";
import { Badge } from "@/components/ui";
import { fmtLKR } from "@/lib/data";

interface PayrollRow { id: string; workerName: string; days: number; dailyWage: number; otPay: number; incentive: number; deductions: number; netPay: number; period: string; }

export default function Payroll() {
  return (
    <CrudPanel<PayrollRow>
      table="payroll_runs"
      eyebrow="People & Pay"
      title="Payroll System"
      desc="Full CRUD — generate, edit, delete payroll runs with EPF/ETF calculations."
      icon={<Wallet className="h-6 w-6 text-emerald-600" />}
      tone="emerald"
      fields={[
        { key: "workerName", label: "Worker Name", type: "text", default: "" },
        { key: "days", label: "Days Worked", type: "number", default: 25 },
        { key: "dailyWage", label: "Daily Wage (Rs)", type: "number", default: 1700 },
        { key: "otPay", label: "OT Pay (Rs)", type: "number", default: 0 },
        { key: "incentive", label: "Incentive (Rs)", type: "number", default: 0 },
        { key: "deductions", label: "Deductions (Rs)", type: "number", default: 0 },
        { key: "period", label: "Period", type: "text", default: "Current Month" },
      ]}
      toDb={(f) => ({
        worker_name: f.workerName, days: f.days, daily_wage: f.dailyWage, ot_pay: f.otPay,
        incentive: f.incentive, deductions: f.deductions,
        net_pay: (Number(f.days) * Number(f.dailyWage)) + Number(f.otPay) + Number(f.incentive) - Number(f.deductions),
        period: f.period,
      })}
      fromDb={(r) => ({
        id: r.id as string, workerName: r.worker_name as string, days: r.days as number,
        dailyWage: r.daily_wage as number, otPay: r.ot_pay as number, incentive: r.incentive as number,
        deductions: r.deductions as number, netPay: r.net_pay as number, period: r.period as string,
      })}
      columns={[
        { key: "workerName", header: "Worker", render: (r) => <span className="font-semibold text-slate-800">{r.workerName}</span> },
        { key: "days", header: "Days", align: "center" },
        { key: "dailyWage", header: "Wage/Day", align: "right", render: (r) => fmtLKR(r.dailyWage) },
        { key: "netPay", header: "Net Pay", align: "right", render: (r) => <span className="font-bold text-emerald-700">{fmtLKR(r.netPay)}</span> },
        { key: "period", header: "Period", render: (r) => <Badge tone="slate">{r.period}</Badge> },
      ]}
    />
  );
}
