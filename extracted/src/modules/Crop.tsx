import { Leaf } from "lucide-react";
import { CrudPanel } from "@/components/CrudPanel";
import { Badge } from "@/components/ui";

interface CropRow { id: string; activity: string; field: string; dueDate: string; status: string; cycle: string; }

export default function Crop() {
  return (
    <CrudPanel<CropRow>
      table="crop_tasks"
      eyebrow="Estate & Land"
      title="Crop Management"
      desc="Full CRUD — lifecycle tasks (pruning, weeding, tipping), schedules, cycles."
      icon={<Leaf className="h-6 w-6 text-emerald-600" />}
      tone="emerald"
      fields={[
        { key: "activity", label: "Activity", type: "select", options: ["Plucking", "Pruning", "Weeding", "Tipping", "Skiffing"], default: "Plucking" },
        { key: "field", label: "Field / Block", type: "text", default: "" },
        { key: "dueDate", label: "Due Date", type: "date" },
        { key: "status", label: "Status", type: "select", options: ["scheduled", "in-progress", "done"], default: "scheduled" },
        { key: "cycle", label: "Cycle", type: "text", default: "7-day round" },
      ]}
      toDb={(f) => ({ activity: f.activity, field: f.field, due_date: f.dueDate, status: f.status, cycle: f.cycle })}
      fromDb={(r) => ({
        id: r.id as string, activity: r.activity as string, field: r.field as string,
        dueDate: r.due_date as string, status: r.status as string, cycle: r.cycle as string,
      })}
      columns={[
        { key: "activity", header: "Activity", render: (r) => <span className="font-semibold text-slate-800">{r.activity}</span> },
        { key: "field", header: "Field" },
        { key: "cycle", header: "Cycle", render: (r) => <Badge tone="slate">{r.cycle}</Badge> },
        { key: "dueDate", header: "Due", align: "center" },
        { key: "status", header: "Status", align: "center", render: (r) => <Badge tone={r.status === "done" ? "emerald" : r.status === "in-progress" ? "amber" : "sky"} dot>{r.status}</Badge> },
      ]}
    />
  );
}
