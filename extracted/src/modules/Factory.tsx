import { Factory } from "lucide-react";
import { CrudPanel } from "@/components/CrudPanel";
import { fmtNum, fmtLKRShort } from "@/lib/data";

interface BatchRow { id: string; gradeCode: string; gradeName: string; outputKg: number; pricePerKg: number; greenLeafInKg: number; wasteKg: number; }

export default function FactoryModule() {
  return (
    <CrudPanel<BatchRow>
      table="factory_batches"
      eyebrow="More / Future"
      title="Factory Integration"
      desc="Full CRUD — green leaf intake, made tea output grades (OP/BOP/Dust), waste factoring."
      icon={<Factory className="h-6 w-6 text-emerald-600" />}
      tone="emerald"
      fields={[
        { key: "gradeCode", label: "Grade Code", type: "select", options: ["OP", "BOP", "PEK", "BOPF", "DUST"], default: "BOP" },
        { key: "gradeName", label: "Grade Name", type: "text", default: "Broken Orange Pekoe" },
        { key: "outputKg", label: "Output (kg)", type: "number", default: 1000 },
        { key: "pricePerKg", label: "Price/kg (Rs)", type: "number", default: 1000 },
        { key: "greenLeafInKg", label: "Green Leaf In (kg)", type: "number", default: 4000 },
        { key: "wasteKg", label: "Waste (kg)", type: "number", default: 0 },
      ]}
      toDb={(f) => ({ grade_code: f.gradeCode, grade_name: f.gradeName, output_kg: f.outputKg, price_per_kg: f.pricePerKg, green_leaf_in_kg: f.greenLeafInKg, waste_kg: f.wasteKg })}
      fromDb={(r) => ({
        id: r.id as string, gradeCode: r.grade_code as string, gradeName: r.grade_name as string,
        outputKg: Number(r.output_kg), pricePerKg: Number(r.price_per_kg),
        greenLeafInKg: Number(r.green_leaf_in_kg), wasteKg: Number(r.waste_kg),
      })}
      columns={[
        { key: "gradeCode", header: "Grade", render: (r) => <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-emerald-50 px-2 text-xs font-bold text-emerald-700">{r.gradeCode}</span> },
        { key: "gradeName", header: "Description" },
        { key: "outputKg", header: "Output", align: "right", render: (r) => <span className="font-bold text-slate-800 tnum">{fmtNum(r.outputKg)} kg</span> },
        { key: "pricePerKg", header: "Rs/kg", align: "right", render: (r) => fmtNum(r.pricePerKg) },
        { key: "value", header: "Value", align: "right", render: (r) => <span className="font-semibold text-emerald-700">{fmtLKRShort(r.outputKg * r.pricePerKg)}</span> },
      ]}
    />
  );
}
