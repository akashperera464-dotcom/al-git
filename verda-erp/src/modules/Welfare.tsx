import { HeartPulse } from "lucide-react";
import { CrudPanel } from "@/components/CrudPanel";
import { Badge } from "@/components/ui";

interface WelfareRow { id: string; caseType: string; personName: string; detail: string; status: string; date: string; }

export default function Welfare() {
  return (
    <CrudPanel<WelfareRow>
      table="welfare_cases"
      eyebrow="People & Pay"
      title="Welfare Management"
      desc="Full CRUD — manage housing, clinic visits, scholarships, maternity cases."
      icon={<HeartPulse className="h-6 w-6 text-rose-600" />}
      tone="rose"
      fields={[
        { key: "caseType", label: "Case Type", type: "select", options: ["Clinic Visit", "Scholarship", "Maternity", "Housing Repair"], default: "Clinic Visit" },
        { key: "personName", label: "Person Name", type: "text", default: "" },
        { key: "detail", label: "Details", type: "text", default: "" },
        { key: "status", label: "Status", type: "select", options: ["open", "settled"], default: "open" },
        { key: "date", label: "Date", type: "date" },
      ]}
      toDb={(f) => ({ case_type: f.caseType, person_name: f.personName, detail: f.detail, status: f.status, date: f.date })}
      fromDb={(r) => ({
        id: r.id as string, caseType: r.case_type as string, personName: r.person_name as string,
        detail: r.detail as string, status: r.status as string, date: r.date as string,
      })}
      columns={[
        { key: "personName", header: "Person", render: (r) => <span className="font-semibold text-slate-800">{r.personName}</span> },
        { key: "caseType", header: "Type", render: (r) => <Badge tone="violet">{r.caseType}</Badge> },
        { key: "detail", header: "Details", render: (r) => <span className="text-xs text-slate-400">{r.detail}</span> },
        { key: "status", header: "Status", align: "center", render: (r) => <Badge tone={r.status === "open" ? "amber" : "emerald"} dot>{r.status}</Badge> },
      ]}
    />
  );
}
