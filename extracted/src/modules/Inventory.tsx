import { Boxes } from "lucide-react";
import { CrudPanel } from "@/components/CrudPanel";
import { Badge } from "@/components/ui";

interface InvRow { id: string; name: string; category: string; qty: string; location: string; qrTag: string; }

export default function Inventory() {
  return (
    <CrudPanel<InvRow>
      table="inventory_items"
      eyebrow="Manufacturing"
      title="Inventory Management"
      desc="Full CRUD — stores and warehouse item allocation with QR-based asset tracking."
      icon={<Boxes className="h-6 w-6 text-emerald-600" />}
      tone="emerald"
      fields={[
        { key: "name", label: "Item Name", type: "text", default: "" },
        { key: "category", label: "Category", type: "select", options: ["Field Gear", "Tools", "Equipment", "PPE", "Welfare"], default: "Equipment" },
        { key: "qty", label: "Quantity", type: "text", default: "0 units" },
        { key: "location", label: "Location", type: "text", default: "Stores A" },
        { key: "qrTag", label: "QR Tag", type: "text", default: "" },
      ]}
      toDb={(f) => ({ name: f.name, category: f.category, qty: f.qty, location: f.location, qr_tag: f.qrTag })}
      fromDb={(r) => ({
        id: r.id as string, name: r.name as string, category: r.category as string,
        qty: r.qty as string, location: r.location as string, qrTag: r.qr_tag as string,
      })}
      columns={[
        { key: "name", header: "Item", render: (r) => <span className="font-semibold text-slate-800">{r.name}</span> },
        { key: "category", header: "Category", render: (r) => <Badge tone="sky">{r.category}</Badge> },
        { key: "qty", header: "Quantity", align: "right" },
        { key: "location", header: "Location" },
        { key: "qrTag", header: "QR Tag", align: "center", render: (r) => r.qrTag ? <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300">{r.qrTag}</span> : <span className="text-slate-300">—</span> },
      ]}
    />
  );
}
