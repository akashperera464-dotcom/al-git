import { ShieldCheck, FileCheck, FileText, Download, BookCheck } from "lucide-react";
import { PageHeader, StatCard, Panel, Badge, Meter, IconChip } from "@/components/ui";
import { complianceItems, addDays, TODAY_ISO, fmtNum } from "@/lib/data";

const VAULT = [
  { standard: "Rainforest Alliance", icon: "🌿", docs: 18, tone: "emerald" as const },
  { standard: "Fairtrade International", icon: "🤝", docs: 12, tone: "amber" as const },
  { standard: "ISO 22000", icon: "⚙️", docs: 9, tone: "sky" as const },
  { standard: "Ethical Tea Partnership", icon: "🫖", docs: 7, tone: "violet" as const },
];

const CHECKLIST = [
  { label: "Pesticide residue logs (12 mo)", done: true },
  { label: "Worker welfare & wages audit", done: true },
  { label: "Water protection buffer zones", done: true },
  { label: "Biodiversity inventory updated", done: false },
  { label: "Traceability (field → factory → ship)", done: true },
  { label: "Grievance mechanism documented", done: false },
];

export default function AuditCompliance() {
  const certified = complianceItems.filter((c) => c.status === "Certified").length;
  const avg = Math.round(complianceItems.reduce((s, c) => s + c.score, 0) / complianceItems.length);

  return (
    <div>
      <PageHeader
        eyebrow="Audit & Compliance"
        title="Certification Vault"
        desc="Documentation templates and compliance states for Rainforest Alliance, Fairtrade and ISO."
        icon={<IconChip icon={ShieldCheck} tone="emerald" className="h-12 w-12" />}
        actions={<button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"><Download className="h-4 w-4" /> Audit pack</button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={ShieldCheck} label="Certified" value={`${certified}/${complianceItems.length}`} sub="Active standards" tone="emerald" />
        <StatCard icon={BookCheck} label="Avg Score" value={`${avg}%`} sub="Across all audits" tone="sky" />
        <StatCard icon={FileText} label="Vault Documents" value={String(VAULT.reduce((s, v) => s + v.docs, 0))} sub="Versioned" tone="violet" />
        <StatCard icon={FileCheck} label="Next Expiry" value={fmtNum(Math.round((new Date(complianceItems.reduce((m, c) => (new Date(c.expiry) < new Date(m) ? c.expiry : m), TODAY_ISO)).getTime() - new Date(TODAY_ISO).getTime()) / 86400000))} sub="Days · ETP" tone="amber" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Compliance Posture" subtitle="Audit score by standard" icon={<IconChip icon={ShieldCheck} tone="emerald" className="h-9 w-9" />}>
          <div className="space-y-3">
            {complianceItems.map((c) => {
              const days = Math.round((new Date(c.expiry).getTime() - new Date(TODAY_ISO).getTime()) / 86400000);
              return (
                <div key={c.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800">{c.standard}</span>
                    <Badge tone={c.status === "Certified" ? "emerald" : c.status === "Action Needed" ? "rose" : "amber"} dot>{c.status}</Badge>
                  </div>
                  <Meter value={c.score} tone={c.score >= 85 ? "emerald" : c.score >= 75 ? "amber" : "rose"} showLabel />
                  <p className="mt-1 text-[11px] text-slate-400">Renewal {addDays(TODAY_ISO, days)} · {days} days · score {c.score}</p>
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Documentation Vault" subtitle="Template repositories" icon={<IconChip icon={FileText} tone="violet" className="h-9 w-9" />}>
            <div className="grid grid-cols-2 gap-2.5">
              {VAULT.map((v) => (
                <div key={v.standard} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{v.icon}</span>
                    <Badge tone={v.tone}>{v.docs} docs</Badge>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-700">{v.standard}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Audit Checklist" subtitle="Ethical Tea Partnership renewal" icon={<IconChip icon={BookCheck} tone="sky" className="h-9 w-9" />}>
            <div className="space-y-2">
              {CHECKLIST.map((c) => (
                <div key={c.label} className="flex items-center gap-2.5 text-sm">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full ${c.done ? "bg-emerald-500 text-white" : "border-2 border-slate-300"}`}>
                    {c.done && <FileCheck className="h-3 w-3" />}
                  </span>
                  <span className={c.done ? "text-slate-600" : "text-slate-800 font-medium"}>{c.label}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
