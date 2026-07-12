import { Truck } from "lucide-react";
import { CrudPanel } from "@/components/CrudPanel";
import { Badge } from "@/components/ui";
import { fmtNum } from "@/lib/data";

interface VehicleRow { id: string; reg: string; vehicleType: string; driver: string; km: number; fuelL: number; lastService: string; status: string; }

export default function Vehicles() {
  return (
    <CrudPanel<VehicleRow>
      table="vehicles"
      eyebrow="More / Future"
      title="Vehicle & Fuel Management"
      desc="Full CRUD — fleet roster (tractors, lorries), fuel tracking, mileage, service status."
      icon={<Truck className="h-6 w-6 text-amber-600" />}
      tone="amber"
      fields={[
        { key: "reg", label: "Registration No.", type: "text", default: "" },
        { key: "vehicleType", label: "Vehicle Type", type: "text", default: "Lorry" },
        { key: "driver", label: "Driver", type: "text", default: "" },
        { key: "km", label: "Mileage (km)", type: "number", default: 0 },
        { key: "fuelL", label: "Fuel (L)", type: "number", step: "0.1", default: 0 },
        { key: "lastService", label: "Last Service", type: "date" },
        { key: "status", label: "Status", type: "select", options: ["active", "idle", "service"], default: "active" },
      ]}
      toDb={(f) => ({ reg: f.reg, vehicle_type: f.vehicleType, driver: f.driver, km: f.km, fuel_l: f.fuelL, last_service: f.lastService, status: f.status })}
      fromDb={(r) => ({
        id: r.id as string, reg: r.reg as string, vehicleType: r.vehicle_type as string,
        driver: r.driver as string, km: r.km as number, fuelL: Number(r.fuel_l),
        lastService: r.last_service as string, status: r.status as string,
      })}
      columns={[
        { key: "reg", header: "Vehicle", render: (r) => <span className="font-semibold text-slate-800">{r.reg}</span> },
        { key: "vehicleType", header: "Type" },
        { key: "driver", header: "Driver" },
        { key: "km", header: "Mileage", align: "right", render: (r) => `${fmtNum(r.km)} km` },
        { key: "status", header: "Status", align: "center", render: (r) => <Badge tone={r.status === "active" ? "emerald" : r.status === "service" ? "rose" : "amber"} dot>{r.status}</Badge> },
      ]}
    />
  );
}
