import { Trophy } from "lucide-react";
import { CrudPanel } from "@/components/CrudPanel";
import { Badge } from "@/components/ui";

interface LoyaltyRow { id: string; workerName: string; points: number; tier: string; streakDays: number; badge: string; }

export default function Loyalty() {
  return (
    <CrudPanel<LoyaltyRow>
      table="loyalty_members"
      eyebrow="People & Pay"
      title="Loyalty Program"
      desc="Full CRUD — manage gamified points, tiers, streaks, and badges."
      icon={<Trophy className="h-6 w-6 text-violet-600" />}
      tone="violet"
      fields={[
        { key: "workerName", label: "Worker Name", type: "text", default: "" },
        { key: "points", label: "Points", type: "number", default: 500 },
        { key: "tier", label: "Tier", type: "select", options: ["Bronze", "Silver", "Gold", "Platinum"], default: "Bronze" },
        { key: "streakDays", label: "Streak Days", type: "number", default: 0 },
        { key: "badge", label: "Badge", type: "text", default: "" },
      ]}
      toDb={(f) => ({ worker_name: f.workerName, points: f.points, tier: f.tier, streak_days: f.streakDays, badge: f.badge })}
      fromDb={(r) => ({
        id: r.id as string, workerName: r.worker_name as string, points: r.points as number,
        tier: r.tier as string, streakDays: r.streak_days as number, badge: r.badge as string,
      })}
      columns={[
        { key: "workerName", header: "Worker", render: (r) => <span className="font-semibold text-slate-800">{r.workerName}</span> },
        { key: "tier", header: "Tier", render: (r) => <Badge tone={r.tier === "Platinum" ? "violet" : r.tier === "Gold" ? "amber" : "slate"}>{r.tier}</Badge> },
        { key: "points", header: "Points", align: "right" },
        { key: "streakDays", header: "Streak", align: "center", render: (r) => `${r.streakDays}d` },
      ]}
    />
  );
}
