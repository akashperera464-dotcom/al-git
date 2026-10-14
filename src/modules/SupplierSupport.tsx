import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleHelp, Clock3, Send, WifiOff } from "lucide-react";
import { Badge, Card, IconChip, PageHeader, StatCard } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { createWorkflowRequest, readWorkflowRequests, type WorkflowRequest } from "@/lib/connectedOperations";
import { getQueuedItems } from "@/lib/offlineQueue";

export default function SupplierSupport() {
  const { t } = useTranslation();
  const { userUid } = useApp();
  const [subject,setSubject]=useState(""); const [message,setMessage]=useState(""); const [rows,setRows]=useState<WorkflowRequest[]>([]); const [feedback,setFeedback]=useState(""); const [busy,setBusy]=useState(false);
  const load=()=>readWorkflowRequests({requestedBy:userUid}).then(setRows).catch((error)=>setFeedback(error instanceof Error?error.message:t("request.submitFailed")));
  useEffect(()=>{void load();},[userUid]);
  const submit=async()=>{if(!subject.trim()||!message.trim())return;setBusy(true);setFeedback("");try{await createWorkflowRequest({requestType:"support",requestedBy:userUid,subject:subject.trim(),details:{message:message.trim()}});setSubject("");setMessage("");setFeedback(t("round15.supportSubmitted"));await load();}catch(error){setFeedback(error instanceof Error?error.message:t("request.submitFailed"));}finally{setBusy(false)}};
  const queued=getQueuedItems();
  return <div><PageHeader eyebrow={t("supplier.eyebrow")} title={t("round15.supportTitle")} desc={t("round15.supportDesc")} icon={<IconChip icon={CircleHelp} tone="violet" className="h-12 w-12"/>}/>
    {feedback&&<p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">{feedback}</p>}
    <div className="mb-4 grid grid-cols-2 gap-3"><StatCard icon={Clock3} label={t("round15.openRequests")} value={String(rows.filter(row=>row.status==="pending").length)} tone="amber"/><StatCard icon={WifiOff} label={t("round15.waitingSync")} value={String(queued.length)} tone={queued.length?"rose":"emerald"}/></div>
    <Card className="p-4"><h3 className="font-bold">{t("round15.newTicket")}</h3><input value={subject} onChange={e=>setSubject(e.target.value)} placeholder={t("round15.subject")} className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"/><textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder={t("round15.helpMessage")} rows={4} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"/><button onClick={()=>void submit()} disabled={busy||!subject.trim()||!message.trim()} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Send className="h-4 w-4"/>{busy?t("round15.sending"):t("round15.sendAdmin")}</button></Card>
    <Card className="mt-4 p-4"><h3 className="mb-2 font-bold">{t("round15.myRequests")}</h3>{rows.length===0?<p className="text-sm text-slate-400">{t("round15.noSupportRequests")}</p>:rows.map(row=><div key={row.id} className="flex gap-2 border-b py-3 text-xs"><Badge tone={row.status==="pending"?"amber":row.status==="rejected"?"rose":"emerald"}>{t(`status.${row.status}`, { defaultValue: row.status })}</Badge><div className="min-w-0 flex-1"><b>{row.subject}</b><p className="text-slate-400">{row.requestType.replace(/_/g," ")} · {new Date(row.createdAt).toLocaleString()}</p>{row.resolution&&<p className="mt-1 rounded bg-emerald-50 px-2 py-1 text-emerald-700">Admin: {row.resolution}</p>}</div></div>)}</Card>
    <Card className="mt-4 p-4"><h3 className="font-bold">{t("round15.offlineDetails")}</h3>{queued.length===0?<p className="mt-2 text-sm text-emerald-700">{t("round15.allSynced")}</p>:queued.map(row=><p key={row.id} className="border-b py-2 text-xs"><b>{row.label}</b><span className="block text-slate-400">Attempt {row.attempts}/5 {row.lastError?`· ${row.lastError}`:""}</span></p>)}</Card>
  </div>;
}
