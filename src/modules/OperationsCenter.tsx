import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArchiveRestore, CheckCircle2, ClipboardCheck, Download, RefreshCw, ShieldAlert, Smartphone, Users } from "lucide-react";
import { Badge, Card, IconChip, PageHeader, StatCard } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { getSupabase } from "@/lib/supabase";
import { decideWorkflowRequest, readCollectionReconciliation, readDeviceSessions, readDuplicateUsers, readHealthEvents, readMonthClosures, readMonthlyFactoryReport, readWorkflowRequests, recordHealthEvent, resolveHealthEvent, revokeDeviceSession, setMonthClosure, type CollectionReconciliation, type DeviceSession, type DuplicateUserGroup, type HealthEvent, type MonthClosure, type MonthlyFactoryReport, type WorkflowRequest } from "@/lib/connectedOperations";

type Pending = { users: any[]; estates: any[]; prices: any[]; resources: any[]; finance: any[] };
const emptyPending: Pending = { users: [], estates: [], prices: [], resources: [], finance: [] };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date());

export default function OperationsCenter() {
  const { userUid, role, setActiveModule } = useApp();
  const [tab, setTab] = useState<"pending" | "integrity" | "health" | "sessions" | "reports">("pending");
  const [pending, setPending] = useState<Pending>(emptyPending);
  const [workflows, setWorkflows] = useState<WorkflowRequest[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateUserGroup[]>([]);
  const [health, setHealth] = useState<HealthEvent[]>([]);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [reconciliation, setReconciliation] = useState<CollectionReconciliation[]>([]);
  const [closures, setClosures] = useState<MonthClosure[]>([]);
  const [factoryReport, setFactoryReport] = useState<MonthlyFactoryReport[]>([]);
  const [supabaseProfiles, setSupabaseProfiles] = useState<Array<{ id: string; email?: string }>>([]);
  const [identityMismatches, setIdentityMismatches] = useState<string[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setMessage("");
    const sb = getSupabase()!;
    try {
      const [users, estates, prices, resources, finance, requests, dupes, events, deviceRows, recon, monthRows, factoryRows, profiles] = await Promise.all([
        sb.from("users").select("id,name,email,phone,supplier_no,status").eq("status", "pending_approval"),
        sb.from("estates").select("id,name,owner_supplier_id,status").eq("status", "pending"),
        sb.from("daily_tea_prices").select("id,grade,price_per_kg,approval_status").eq("approval_status", "pending"),
        sb.from("resource_requests").select("id,supplier_id,supplier_name,item_details,quantity,status").eq("status", "PENDING"),
        sb.from("supplier_financial_summary").select("supplier_id,period_month,estimated_net_payable,confirmed_net_payable").is("confirmed_net_payable", null),
        readWorkflowRequests({ status: "pending" }), readDuplicateUsers(), readHealthEvents(), readDeviceSessions(), readCollectionReconciliation(today()), readMonthClosures(month), readMonthlyFactoryReport(month), sb.from("users").select("id,email"),
      ]);
      setPending({ users: users.data ?? [], estates: estates.data ?? [], prices: prices.data ?? [], resources: resources.data ?? [], finance: finance.data ?? [] });
      setWorkflows(requests); setDuplicates(dupes); setHealth(events); setSessions(deviceRows); setReconciliation(recon); setClosures(monthRows); setFactoryReport(factoryRows);
      setSupabaseProfiles((profiles.data ?? []).map((row) => ({ id: row.id, email: row.email ?? undefined })));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Operations data could not be loaded."); }
    finally { setLoading(false); }
  }, [month]);
  useEffect(() => { void load(); }, [load]);

  const pendingCount = Object.values(pending).reduce((sum, rows) => sum + rows.length, 0) + workflows.length;
  const decide = async (request: WorkflowRequest, status: "approved" | "rejected" | "resolved") => {
    const resolution = window.prompt("Decision / response")?.trim(); if (!resolution) return;
    await decideWorkflowRequest(request.id, status, resolution, userUid); await load();
  };
  const exportCsv = () => {
    const rows = [["collector","suppliers","deliveries","total_kg"], ...reconciliation.map((row) => [row.collectorId,row.supplierCount,row.deliveryCount,row.totalKg])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g,'""')}"`).join(",")).join("\n");
    const anchor=document.createElement("a"); anchor.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); anchor.download=`collection-reconciliation-${today()}.csv`; anchor.click(); URL.revokeObjectURL(anchor.href);
  };
  const factoryReportRows = () => [["factory","suppliers","deliveries","total_kg","gross_amount"], ...factoryReport.map((row) => [row.factoryId,row.supplierCount,row.deliveryCount,row.totalKg.toFixed(1),row.grossAmount.toFixed(2)])];
  const exportFactoryCsv = () => {
    const csv = factoryReportRows().map((row) => row.map((value) => `"${String(value).replace(/"/g,'""')}"`).join(",")).join("\n");
    const anchor=document.createElement("a"); anchor.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); anchor.download=`factory-report-${month}.csv`; anchor.click(); URL.revokeObjectURL(anchor.href);
  };
  const exportFactoryPdf = async () => {
    const { jsPDF } = await import("jspdf"); const pdf = new jsPDF();
    pdf.setFontSize(16); pdf.text("Estate Pulse · Monthly Factory Report",14,18); pdf.setFontSize(10); pdf.text(`Period: ${month}`,14,27);
    let y=40; for(const row of factoryReport){pdf.text(`${row.factoryId} | ${row.supplierCount} suppliers | ${row.deliveryCount} receipts | ${row.totalKg.toFixed(1)} kg | Rs ${row.grossAmount.toFixed(2)}`,14,y);y+=8;if(y>280){pdf.addPage();y=18;}}
    pdf.save(`factory-report-${month}.pdf`);
  };
  const lastBackup = health.find((event) => event.category === "backup" && !event.resolvedAt);
  const lastRestore = health.find((event) => event.category === "restore" && !event.resolvedAt);
  const markBackup = async () => { const reference = window.prompt("Backup file/reference created by your manual pg_dump or dashboard export"); if (!reference?.trim()) return; await recordHealthEvent({ category: "backup", severity: "info", userId: userUid, module: "operations", message: "Manual database backup recorded", details: { reference: reference.trim() } }); await load(); };
  const markRestore = async () => { const reference = window.prompt("Restore test project/reference and result"); if (!reference?.trim()) return; await recordHealthEvent({ category: "restore", severity: "info", userId: userUid, module: "operations", message: "Database restore test recorded", details: { reference: reference.trim() } }); await load(); };
  const compareFirebaseExport = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { users?: Array<{ localId?: string; uid?: string; email?: string }> };
      const firebaseUsers = parsed.users ?? [];
      const firebaseIds = new Set(firebaseUsers.map((entry) => entry.localId ?? entry.uid).filter(Boolean));
      const profileIds = new Set(supabaseProfiles.map((entry) => entry.id));
      const missingProfiles = firebaseUsers.filter((entry) => !profileIds.has(entry.localId ?? entry.uid ?? "")).map((entry) => `Firebase only: ${entry.email ?? entry.localId ?? entry.uid}`);
      const missingFirebase = supabaseProfiles.filter((entry) => !firebaseIds.has(entry.id)).map((entry) => `Supabase only: ${entry.email ?? entry.id}`);
      setIdentityMismatches([...missingProfiles, ...missingFirebase]);
    } catch { setIdentityMismatches(["The selected file is not a valid Firebase Auth JSON export."]); }
  };
  const allPending = useMemo(() => [
    ...pending.users.map((row) => ({ key:`u-${row.id}`, type:"Registration", title:row.name, detail:row.email, module:"user-management" })),
    ...pending.estates.map((row) => ({ key:`e-${row.id}`, type:"Estate", title:row.name, detail:row.owner_supplier_id, module:"estate-master" })),
    ...pending.prices.map((row) => ({ key:`p-${row.id}`, type:"Price", title:row.grade, detail:`Rs ${row.price_per_kg}`, module:"factory" })),
    ...pending.resources.map((row) => ({ key:`r-${row.id}`, type:"Resource", title:`${row.quantity}× ${row.item_details}`, detail:row.supplier_name ?? row.supplier_id, module:"resource-requests" })),
    ...pending.finance.map((row) => ({ key:`f-${row.supplier_id}-${row.period_month}`, type:"Month-end", title:row.supplier_id, detail:`Rs ${Number(row.estimated_net_payable).toLocaleString()}`, module:"factory" })),
  ], [pending]);

  return <div><PageHeader eyebrow="Administration" title="Operations & Pending Actions" desc="One operational inbox for approvals, data integrity, reconciliation, sessions and system health." icon={<IconChip icon={ClipboardCheck} tone="emerald" className="h-12 w-12" />} actions={<button onClick={() => void load()} className="rounded-lg border bg-white p-2"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`} /></button>} />
    {message && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{message}</p>}
    <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4"><StatCard icon={AlertTriangle} label="Pending actions" value={String(pendingCount)} tone="amber"/><StatCard icon={ShieldAlert} label="Duplicate identities" value={String(duplicates.length)} tone="rose"/><StatCard icon={Activity} label="Open health events" value={String(health.filter(e=>!e.resolvedAt).length)} tone="sky"/><StatCard icon={Smartphone} label="Active devices" value={String(sessions.filter(s=>!s.revokedAt).length)} tone="violet"/></div>
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">{(["pending","integrity","health","sessions","reports"] as const).map((key)=><button key={key} onClick={()=>setTab(key)} className={`rounded-lg px-3 py-2 text-xs font-bold capitalize ${tab===key?"bg-white text-emerald-700 shadow-sm":"text-slate-500"}`}>{key}</button>)}</div>
    {tab==="pending" && <div className="space-y-3"><Card className="p-4"><h3 className="mb-2 font-bold">Unified pending inbox</h3>{allPending.length===0?<p className="text-sm text-slate-400">No standard approvals are pending.</p>:allPending.map(item=><div key={item.key} className="flex items-center gap-3 border-b py-2 text-xs"><Badge tone="amber">{item.type}</Badge><b className="flex-1">{item.title}</b><span className="text-slate-400">{item.detail}</span><button onClick={()=>setActiveModule(item.module)} className="font-bold text-emerald-700">Open</button></div>)}</Card><Card className="p-4"><h3 className="mb-2 font-bold">Disputes, support, profile and route changes</h3>{workflows.length===0?<p className="text-sm text-slate-400">No workflow requests pending.</p>:workflows.map(request=><div key={request.id} className="flex flex-wrap items-center gap-2 border-b py-3 text-xs"><Badge tone="sky">{request.requestType.replace(/_/g," ")}</Badge><div className="min-w-0 flex-1"><b>{request.subject}</b><p className="truncate text-slate-400">{JSON.stringify(request.details)}</p></div><button onClick={()=>void decide(request,"approved")} className="font-bold text-emerald-700">Approve</button><button onClick={()=>void decide(request,"rejected")} className="font-bold text-rose-700">Reject</button><button onClick={()=>void decide(request,"resolved")} className="font-bold text-sky-700">Resolve</button></div>)}</Card></div>}
    {tab==="integrity" && <div className="grid gap-3 lg:grid-cols-2"><Card className="p-4"><h3 className="mb-2 flex items-center gap-2 font-bold"><Users className="h-4 w-4"/>Duplicate supplier identities</h3>{duplicates.length?duplicates.map((row)=><p key={`${row.field}-${row.value}`} className="border-b py-2 text-xs"><b>{row.field}: {row.value}</b><span className="block text-slate-400">{row.userIds.join(", ")}</span></p>):<p className="text-sm text-emerald-700">No duplicates detected.</p>}</Card><Card className="p-4"><h3 className="font-bold">Firebase ↔ Supabase identity check</h3><p className="mt-2 text-xs text-slate-500">For a secure comparison, export Firebase Auth with <code>firebase auth:export users.json --format=json</code>, then select that local file. It is parsed only in this browser and is not uploaded.</p><label className="mt-3 inline-flex cursor-pointer rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Compare Firebase export<input type="file" accept="application/json,.json" className="hidden" onChange={(event)=>void compareFirebaseExport(event.target.files?.[0])}/></label>{identityMismatches.length===0?<p className="mt-3 text-xs text-emerald-700">No comparison issues loaded.</p>:identityMismatches.map((row)=><p key={row} className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">{row}</p>)}</Card></div>}
    {tab==="health" && <div className="grid gap-3 lg:grid-cols-2"><Card className="p-4"><div className="flex items-center justify-between"><h3 className="font-bold">Errors, sync & notification failures</h3><Badge tone={health.some(e=>!e.resolvedAt&&["error","critical"].includes(e.severity))?"rose":"emerald"}>{health.filter(e=>!e.resolvedAt).length} open</Badge></div>{health.slice(0,30).map(event=><div key={event.id} className="flex gap-2 border-b py-2 text-xs"><Badge tone={event.severity==="critical"||event.severity==="error"?"rose":"amber"}>{event.category}</Badge><span className="flex-1">{event.message}<small className="block text-slate-400">{new Date(event.createdAt).toLocaleString()}</small></span>{!event.resolvedAt&&<button onClick={()=>void resolveHealthEvent(event.id,userUid).then(load)} className="font-bold text-emerald-700">Resolve</button>}</div>)}</Card><Card className="p-4"><h3 className="flex items-center gap-2 font-bold"><ArchiveRestore className="h-4 w-4"/>Backup / restore readiness</h3><p className="mt-2 text-xs text-slate-500">Browser code cannot create a PostgreSQL backup. Record the result after using Supabase Dashboard export or pg_dump, then test a restore in a separate project.</p><p className="mt-3 text-xs"><b>Last recorded backup:</b> {lastBackup?new Date(lastBackup.createdAt).toLocaleString():"Never recorded"}</p><p className="mt-1 text-xs"><b>Last restore test:</b> {lastRestore?new Date(lastRestore.createdAt).toLocaleString():"Never recorded"}</p><div className="mt-3 flex gap-2"><button onClick={()=>void markBackup()} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Record backup</button><button onClick={()=>void markRestore()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Record restore test</button></div></Card></div>}
    {tab==="sessions" && <Card className="p-4"><h3 className="mb-2 font-bold">User devices & forced app logout</h3>{sessions.map(session=><div key={session.id} className="flex items-center gap-3 border-b py-2 text-xs"><Smartphone className="h-4 w-4"/><span className="flex-1"><b>{session.deviceName}</b><small className="block text-slate-400">{session.userId} · {new Date(session.lastSeenAt).toLocaleString()}</small></span>{session.revokedAt?<Badge tone="rose">Revoked</Badge>:<button onClick={()=>void revokeDeviceSession(session.id,userUid).then(load)} className="font-bold text-rose-700">Force logout</button>}</div>)}</Card>}
    {tab==="reports" && <div className="space-y-3"><Card className="p-4"><div className="flex flex-wrap items-center gap-2"><h3 className="mr-auto font-bold">Daily collection reconciliation</h3><button onClick={exportCsv} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white"><Download className="h-4 w-4"/>CSV</button></div>{reconciliation.map(row=><div key={row.collectorId} className="grid grid-cols-4 border-b py-2 text-xs"><b>{row.collectorId}</b><span>{row.supplierCount} suppliers</span><span>{row.deliveryCount} receipts</span><span>{row.totalKg.toFixed(1)} kg</span></div>)}</Card><Card className="p-4"><div className="flex flex-wrap items-center gap-2"><h3 className="mr-auto font-bold">Monthly factory report</h3><input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="rounded-lg border p-2 text-sm"/><button onClick={exportFactoryCsv} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">CSV</button><button onClick={()=>void exportFactoryPdf()} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white">PDF</button></div>{factoryReport.length?factoryReport.map(row=><div key={row.factoryId} className="grid grid-cols-5 border-b py-2 text-xs"><b>{row.factoryId}</b><span>{row.supplierCount} suppliers</span><span>{row.deliveryCount} receipts</span><span>{row.totalKg.toFixed(1)} kg</span><span>Rs {row.grossAmount.toLocaleString()}</span></div>):<p className="mt-3 text-sm text-slate-400">No deliveries for this month.</p>}</Card><Card className="p-4"><div className="flex flex-wrap items-center gap-2"><h3 className="mr-auto font-bold">Month-end lock</h3><button onClick={()=>void setMonthClosure(null,month,"locked",userUid).then(load)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Lock all factories</button>{role==="super_admin"&&<button onClick={()=>{const reason=window.prompt("Reason for reopening")??"";if(reason)void setMonthClosure(null,month,"reopened",userUid,reason).then(load)}} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white">Reopen</button>}</div><p className="mt-3 text-xs text-slate-500">{closures.length?closures.map(row=>`${row.factoryId??"All factories"}: ${row.status}`).join(" · "):"No closure record for this month."}</p></Card></div>}
  </div>;
}
