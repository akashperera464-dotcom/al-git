import { Sprout } from "lucide-react";
import { CrudPanel } from "@/components/CrudPanel";
import { Badge, Meter } from "@/components/ui";
import { fmtNum, fmtLKR } from "@/lib/data";

interface FertRow { id: string; name: string; fertType: string; onHandKg: number; reorderKg: number; costPerKg: number; }

export default function Fertilizer() {
  return (
    <CrudPanel<FertRow>
      table="fertilizer_stock"
      eyebrow="Inputs"
      title="Fertilizer Management"
      desc="Full CRUD — stock control (Urea, MOP, TSP), consumption logs, cost per hectare."
      icon={<Sprout className="h-6 w-6 text-emerald-600" />}
      tone="emerald"
      fields={[
        { key: "name", label: "Product Name", type: "text", default: "" },
        { key: "fertType", label: "Type", type: "select", options: ["Nitrogen", "Potassium", "Phosphorus", "pH Conditioner", "Organic"], default: "Nitrogen" },
        { key: "onHandKg", label: "On Hand (kg)", type: "number", default: 1000 },
        { key: "reorderKg", label: "Reorder Point (kg)", type: "number", default: 500 },
        { key: "costPerKg", label: "Cost per kg (Rs)", type: "number", default: 150 },
      ]}
      toDb={(f) => ({ name: f.name, fert_type: f.fertType, on_hand_kg: f.onHandKg, reorder_kg: f.reorderKg, cost_per_kg: f.costPerKg })}
      fromDb={(r) => ({
        id: r.id as string, name: r.name as string, fertType: r.fert_type as string,
        onHandKg: Number(r.on_hand_kg), reorderKg: Number(r.reorder_kg), costPerKg: Number(r.cost_per_kg),
      })}
      columns={[
        { key: "name", header: "Product", render: (r) => <span className="font-semibold text-slate-800">{r.name}</span> },
        { key: "onHandKg", header: "Stock Level", render: (r) => (
          <div className="w-32">
            <div className="mb-0.5 text-right text-xs font-semibold text-slate-700">{fmtNum(r.onHandKg)} kg</div>
            <Meter value={(r.onHandKg / (r.reorderKg * 1.6)) * 100} tone={r.onHandKg < r.reorderKg ? "rose" : "emerald"} />
          </div>
        )},
        { key: "costPerKg", header: "Cost/kg", align: "right", render: (r) => fmtLKR(r.costPerKg) },
        { key: "status", header: "Status", align: "center", render: (r) => <Badge tone={r.onHandKg < r.reorderKg ? "rose" : "emerald"} dot>{r.onHandKg < r.reorderKg ? "Reorder" : "OK"}</Badge> },
      ]}
    />
  );
}
