import { FlaskConical } from "lucide-react";
import { CrudPanel } from "@/components/CrudPanel";
import { Badge } from "@/components/ui";

interface AgroRow { id: string; name: string; category: string; onHand: string; nextSpray: string; certified: boolean; }

export default function Agrochemical() {
  return (
    <CrudPanel<AgroRow>
      table="agrochemical_stock"
      eyebrow="Inputs"
      title="Agrochemical Management"
      desc="Full CRUD — herbicide/pesticide inventory, scheduling, certification audit trail."
      icon={<FlaskConical className="h-6 w-6 text-emerald-600" />}
      tone="amber"
      fields={[
        { key: "name", label: "Product Name", type: "text", default: "" },
        { key: "category", label: "Category", type: "select", options: ["Herbicide", "Pesticide", "Fungicide", "Foliar"], default: "Herbicide" },
        { key: "onHand", label: "On Hand Qty", type: "text", default: "0 L" },
        { key: "nextSpray", label: "Next Spray Date", type: "date" },
        { key: "certified", label: "Certified?", type: "boolean", default: true },
      ]}
      toDb={(f) => ({ name: f.name, category: f.category, on_hand: f.onHand, next_spray: f.nextSpray, certified: f.certified })}
      fromDb={(r) => ({
        id: r.id as string, name: r.name as string, category: r.category as string,
        onHand: r.on_hand as string, nextSpray: r.next_spray as string, certified: Boolean(r.certified),
      })}
      columns={[
        { key: "name", header: "Product", render: (r) => <span className="font-semibold text-slate-800">{r.name}</span> },
        { key: "category", header: "Category", render: (r) => <Badge tone="amber">{r.category}</Badge> },
        { key: "onHand", header: "On Hand", align: "right" },
        { key: "certified", header: "Certified", align: "center", render: (r) => r.certified ? <Badge tone="emerald">✓</Badge> : <Badge tone="rose">Restricted</Badge> },
      ]}
    />
  );
}
