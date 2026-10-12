import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Card } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { decidePriceChange, readPriceHistory, requestPriceChange, rollbackPrice, type AuditedTeaPrice } from "@/lib/priceAudit";
import { readFactories, type FactoryOption } from "@/lib/supplierOperations";

export default function PriceManagement() {
  const { userUid, role } = useApp(); const [factoryId, setFactoryId] = useState(""); const [factories, setFactories] = useState<FactoryOption[]>([]); const [rows, setRows] = useState<AuditedTeaPrice[]>([]);
  const load = async () => setRows(await readPriceHistory(factoryId || undefined));
  useEffect(() => { void readFactories().then(setFactories); }, []); useEffect(() => { void load(); }, [factoryId]);
  const change = async (row: AuditedTeaPrice) => { const value = window.prompt(`New Rs/kg for ${row.grade}`, String(row.price)); const reason = window.prompt("Change reason"); if (!value || !reason) return; await requestPriceChange({ id: row.id, newPrice: Number(value), reason, actorId: userUid }); await load(); };
  return <Card className="p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Tea price audit & approval</h2><select value={factoryId} onChange={(e) => setFactoryId(e.target.value)} className="rounded-lg border p-2 text-xs"><option value="">All factories</option>{factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b text-slate-400"><th className="p-2">Date</th><th>Grade</th><th>Previous</th><th>Current</th><th>Status</th><th>Reason</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b"><td className="p-2">{row.priceDate}</td><td>{row.grade}</td><td>Rs {row.previousPrice ?? "—"}</td><td>Rs {row.price}</td><td>{row.approvalStatus}</td><td>{row.changeReason ?? "—"}</td><td className="space-x-2"><button onClick={() => void change(row)} className="font-bold text-sky-700">Change</button>{role === "super_admin" && row.approvalStatus === "pending" && <><button onClick={() => void decidePriceChange(row.id, true, userUid).then(load)} className="font-bold text-emerald-700">Approve</button><button onClick={() => void decidePriceChange(row.id, false, userUid).then(load)} className="font-bold text-rose-700">Reject</button></>}{role === "super_admin" && row.previousPrice != null && <button title="Rollback" onClick={() => void rollbackPrice(row.id, userUid).then(load)}><RotateCcw className="inline h-4 w-4" /></button>}</td></tr>)}</tbody></table></div></Card>;
}
