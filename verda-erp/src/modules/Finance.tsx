import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calculator, BookOpen, Plus, FileText, Scale, TrendingUp, TrendingDown, CheckCircle2, Loader2, FileDown, Target } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip, Panel, DataTable } from "@/components/ui";
import { fmtLKR, fmtLKRShort } from "@/lib/data";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { exportObjectsToCSV } from "@/lib/csvExport";
import {
  listGlAccounts, listJournalEntries, createJournalEntry, postJournalEntry, trialBalance,
} from "@/lib/repo.phase2";
import { useApp } from "@/context/AppContext";
import type { GlAccount, JournalEntry, JournalStatus } from "@/lib/data";

/**
 * Finance & Accounting — double-entry general ledger.
 * - Chart of accounts (read-only here; seeded via SQL migration)
 * - Create journal entry (debit/credit lines, must balance)
 * - Post draft entries (locks them)
 * - Trial balance summary (debits = credits across all posted entries)
 * - P&L summary (revenue − expenses from posted entries)
 */
export default function Finance() {
  const { t } = useTranslation();
  const { userUid } = useApp();
  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [balance, setBalance] = useState<{ account: GlAccount; debit: number; credit: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"ledger" | "newEntry" | "trialBalance" | "balanceSheet" | "budget">("ledger");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });

  // New entry form state
  const [entryNo, setEntryNo] = useState(`JE-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<{ accountId: string; debit: number; credit: number }[]>([
    { accountId: "", debit: 0, credit: 0 },
    { accountId: "", debit: 0, credit: 0 },
  ]);

  const reload = async () => {
    setBusy(true);
    try {
      const [a, e, b] = await Promise.all([listGlAccounts(), listJournalEntries(), trialBalance()]);
      setAccounts(a);
      setEntries(e);
      setBalance(b);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load finance data");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const addLine = () => setLines([...lines, { accountId: "", debit: 0, credit: 0 }]);
  const removeLine = (idx: number) => lines.length > 2 && setLines(lines.filter((_, i) => i !== idx));
  const updateLine = (idx: number, field: "accountId" | "debit" | "credit", value: string | number) => {
    setLines(lines.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const submit = async () => {
    setError(null); setSuccess(null);
    if (!description.trim()) { setError("Description is required"); return; }
    if (lines.some(l => !l.accountId)) { setError("All lines must have an account"); return; }
    if (!balanced) { setError(`Journal not balanced — debits ${fmtLKR(totalDebit)} ≠ credits ${fmtLKR(totalCredit)}`); return; }
    setBusy(true);
    try {
      await createJournalEntry({
        entryNo, entryDate, description: description.trim(), reference: reference.trim() || undefined,
        lines: lines.map(l => ({ accountId: l.accountId, debit: +l.debit.toFixed(2), credit: +l.credit.toFixed(2) })),
      });
      setSuccess(`Journal ${entryNo} created as draft`);
      // reset
      setDescription(""); setReference("");
      setLines([{ accountId: "", debit: 0, credit: 0 }, { accountId: "", debit: 0, credit: 0 }]);
      setEntryNo(`JE-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create journal entry");
    } finally {
      setBusy(false);
    }
  };

  const post = async (je: JournalEntry) => {
    setError(null);
    setBusy(true);
    try {
      const res = await postJournalEntry(je.id, je.version, userUid);
      if (res.resolution === "conflict") {
        setError(`Conflict — another user modified ${je.entryNo}. Refreshed.`);
        await reload();
      } else if (res.resolution === "updated") {
        await reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post entry");
    } finally {
      setBusy(false);
    }
  };

  // P&L summary from trial balance
  const revenue = balance.filter(b => b.account.type === "revenue").reduce((s, b) => s + (b.credit - b.debit), 0);
  const expenses = balance.filter(b => b.account.type === "expense").reduce((s, b) => s + (b.debit - b.credit), 0);
  const netPL = revenue - expenses;

  return (
    <div>
      <PageHeader
        eyebrow="Finance & Accounting"
        title="General Ledger & P&L"
        desc="Double-entry accounting — chart of accounts, journal entries, trial balance, and profit & loss."
        icon={<IconChip icon={Calculator} tone="emerald" className="h-12 w-12" />}
      />

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      {success && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={TrendingUp} label="Revenue" value={fmtLKRShort(revenue)} tone="emerald" />
        <StatCard icon={TrendingDown} label="Expenses" value={fmtLKRShort(expenses)} tone="rose" />
        <StatCard icon={Scale} label="Net P&L" value={fmtLKRShort(netPL)} tone={netPL >= 0 ? "emerald" : "rose"} />
        <StatCard icon={BookOpen} label="Journal Entries" value={String(entries.length)} tone="sky" />
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-2">
        {([
          { id: "ledger", label: "Journal Entries", icon: BookOpen },
          { id: "newEntry", label: "New Entry", icon: Plus },
          { id: "trialBalance", label: "Trial Balance", icon: Scale },
          { id: "balanceSheet", label: "Balance Sheet", icon: FileText },
          { id: "budget", label: "Budget vs Actual", icon: Target },
        ] as const).map(t2 => {
          const Icon = t2.icon;
          const active = tab === t2.id;
          return (
            <button key={t2.id} onClick={() => setTab(t2.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${active ? "bg-emerald-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              <Icon className="h-3.5 w-3.5" /> {t2.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Ledger */}
      {tab === "ledger" && (
        <Card className="mt-4 p-4">
          <div className="mb-3">
            <DateRangeFilter onChange={(start, end) => setDateRange({ start, end })} />
          </div>
          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No journal entries yet. Create one in the New Entry tab.</p>
          ) : (
            <div className="space-y-3">
              {entries.filter(je => {
                if (!dateRange.start || !dateRange.end) return true;
                return je.entryDate >= dateRange.start && je.entryDate <= dateRange.end;
              }).map(je => (
                <div key={je.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-display text-sm font-bold text-slate-800">{je.entryNo}</p>
                      <p className="text-[11px] text-slate-400">{je.entryDate} · {je.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={je.status === "posted" ? "emerald" : je.status === "reversed" ? "rose" : "amber"} dot>{je.status}</Badge>
                      <span className="text-xs text-slate-400">v{je.version}</span>
                      {je.status === "draft" && (
                        <button onClick={() => post(je)} disabled={busy}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-50">
                          Post
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    {je.lines.map(l => {
                      const acc = accounts.find(a => a.id === l.accountId);
                      return (
                        <div key={l.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{acc ? `${acc.code} · ${acc.name}` : l.accountId}</span>
                          <span className="flex gap-4 font-mono">
                            <span className="text-slate-800">{l.debit ? fmtLKR(l.debit) : "—"}</span>
                            <span className="text-slate-800">{l.credit ? fmtLKR(l.credit) : "—"}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab: New Entry */}
      {tab === "newEntry" && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Create Journal Entry</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="text-[11px] font-medium text-slate-400">Entry No</label>
              <input value={entryNo} onChange={e => setEntryNo(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400">Date</label>
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400">Reference</label>
              <input value={reference} onChange={e => setReference(e.target.value)} placeholder="optional" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm" />
            </div>
            <div className="sm:col-span-3">
              <label className="text-[11px] font-medium text-slate-400">Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Green leaf payment — Supplier 001" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm" />
            </div>
          </div>

          {/* Lines */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Account</th>
                  <th className="pb-2 text-right">Debit (Rs)</th>
                  <th className="pb-2 text-right">Credit (Rs)</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="py-2 pr-2">
                      <select value={l.accountId} onChange={e => updateLine(idx, "accountId", e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
                        <option value="">— select —</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name} ({a.type})</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" step="0.01" value={l.debit || ""} onChange={e => updateLine(idx, "debit", +e.target.value)}
                        className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-xs tnum" />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" step="0.01" value={l.credit || ""} onChange={e => updateLine(idx, "credit", +e.target.value)}
                        className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-xs tnum" />
                    </td>
                    <td className="py-2">
                      {lines.length > 2 && (
                        <button onClick={() => removeLine(idx)} className="text-xs text-rose-500 hover:text-rose-700">Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-bold">
                  <td className="py-2">Total</td>
                  <td className="py-2 pr-2 text-right text-emerald-700 tnum">{fmtLKR(totalDebit)}</td>
                  <td className="py-2 pr-2 text-right text-rose-700 tnum">{fmtLKR(totalCredit)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <button onClick={addLine} className="text-xs font-semibold text-emerald-600 hover:underline">+ Add line</button>
            <Badge tone={balanced ? "emerald" : "rose"} dot>{balanced ? "Balanced" : "Not balanced"}</Badge>
          </div>

          <button onClick={submit} disabled={busy || !balanced}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition enabled:hover:brightness-110 disabled:opacity-50">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            Create Draft Entry
          </button>
        </Card>
      )}

      {/* Tab: Trial Balance */}
      {tab === "trialBalance" && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Trial Balance (posted entries only)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Code</th>
                  <th className="pb-2">Account</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2 text-right">Debit</th>
                  <th className="pb-2 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {balance.filter(b => b.debit !== 0 || b.credit !== 0).map(b => (
                  <tr key={b.account.id} className="border-t border-slate-100">
                    <td className="py-2 font-mono text-xs text-slate-400">{b.account.code}</td>
                    <td className="py-2 font-semibold text-slate-800">{b.account.name}</td>
                    <td className="py-2"><Badge tone={b.account.type === "revenue" ? "emerald" : b.account.type === "expense" ? "rose" : b.account.type === "asset" ? "sky" : "amber"}>{b.account.type}</Badge></td>
                    <td className="py-2 text-right tnum">{b.debit ? fmtLKR(b.debit) : "—"}</td>
                    <td className="py-2 text-right tnum">{b.credit ? fmtLKR(b.credit) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-bold">
                  <td colSpan={3} className="py-2">Total</td>
                  <td className="py-2 text-right text-emerald-700 tnum">{fmtLKR(balance.reduce((s, b) => s + b.debit, 0))}</td>
                  <td className="py-2 text-right text-rose-700 tnum">{fmtLKR(balance.reduce((s, b) => s + b.credit, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {balance.filter(b => b.debit !== 0 || b.credit !== 0).length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">No posted journal entries yet.</p>
          )}
          <button onClick={() => exportObjectsToCSV("trial_balance", balance.filter(b => b.debit !== 0 || b.credit !== 0).map(b => ({
            code: b.account.code, account: b.account.name, type: b.account.type,
            debit: b.debit, credit: b.credit,
          })))}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <FileDown className="h-3 w-3" /> Export CSV
          </button>
        </Card>
      )}

      {/* Balance Sheet */}
      {tab === "balanceSheet" && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Balance Sheet (from posted entries)</h3>
          {(() => {
            const assets = balance.filter(b => b.account.type === "asset");
            const liabilities = balance.filter(b => b.account.type === "liability");
            const equity = balance.filter(b => b.account.type === "equity");
            const totalAssets = assets.reduce((s, b) => s + b.debit - b.credit, 0);
            const totalLiabilities = liabilities.reduce((s, b) => s + b.credit - b.debit, 0);
            const totalEquity = equity.reduce((s, b) => s + b.credit - b.debit, 0);
            const balanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;
            return (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase text-sky-600">Assets</h4>
                  {assets.filter(b => b.debit !== 0 || b.credit !== 0).map(b => (
                    <div key={b.account.id} className="flex justify-between border-b border-slate-50 py-1.5 text-xs">
                      <span className="text-slate-600">{b.account.code} · {b.account.name}</span>
                      <span className="font-mono text-slate-800">{fmtLKR(b.debit - b.credit)}</span>
                    </div>
                  ))}
                  <div className="mt-2 flex justify-between border-t-2 border-slate-200 pt-2 text-sm font-bold">
                    <span>Total Assets</span>
                    <span className="text-sky-700">{fmtLKR(totalAssets)}</span>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase text-amber-600">Liabilities</h4>
                  {liabilities.filter(b => b.debit !== 0 || b.credit !== 0).map(b => (
                    <div key={b.account.id} className="flex justify-between border-b border-slate-50 py-1.5 text-xs">
                      <span className="text-slate-600">{b.account.code} · {b.account.name}</span>
                      <span className="font-mono text-slate-800">{fmtLKR(b.credit - b.debit)}</span>
                    </div>
                  ))}
                  <div className="mt-2 flex justify-between border-t-2 border-slate-200 pt-2 text-sm font-bold">
                    <span>Total Liabilities</span>
                    <span className="text-amber-700">{fmtLKR(totalLiabilities)}</span>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase text-emerald-600">Equity</h4>
                  {equity.filter(b => b.debit !== 0 || b.credit !== 0).map(b => (
                    <div key={b.account.id} className="flex justify-between border-b border-slate-50 py-1.5 text-xs">
                      <span className="text-slate-600">{b.account.code} · {b.account.name}</span>
                      <span className="font-mono text-slate-800">{fmtLKR(b.credit - b.debit)}</span>
                    </div>
                  ))}
                  <div className="mt-2 flex justify-between border-t-2 border-slate-200 pt-2 text-sm font-bold">
                    <span>Total Equity</span>
                    <span className="text-emerald-700">{fmtLKR(totalEquity)}</span>
                  </div>
                </div>
                <div className="lg:col-span-3 mt-2 rounded-lg p-3 text-center text-sm">
                  {balanced ? (
                    <Badge tone="emerald" dot>✓ Balanced: Assets ({fmtLKRShort(totalAssets)}) = Liabilities ({fmtLKRShort(totalLiabilities)}) + Equity ({fmtLKRShort(totalEquity)})</Badge>
                  ) : (
                    <Badge tone="rose" dot>⚠ Out of balance by {fmtLKR(Math.abs(totalAssets - totalLiabilities - totalEquity))}</Badge>
                  )}
                </div>
              </div>
            );
          })()}
        </Card>
      )}

      {/* Budget vs Actual */}
      {tab === "budget" && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Budget vs Actual (this month)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Account</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2 text-right">Actual</th>
                  <th className="pb-2 text-center">Variance</th>
                </tr>
              </thead>
              <tbody>
                {balance.filter(b => b.account.type === "revenue" || b.account.type === "expense").map(b => {
                  const actual = b.account.type === "revenue" ? b.credit - b.debit : b.debit - b.credit;
                  return (
                    <tr key={b.account.id} className="border-t border-slate-100">
                      <td className="py-2 font-semibold text-slate-800">{b.account.code} · {b.account.name}</td>
                      <td className="py-2"><Badge tone={b.account.type === "revenue" ? "emerald" : "rose"}>{b.account.type}</Badge></td>
                      <td className="py-2 text-right tnum">{actual > 0 ? fmtLKR(actual) : "—"}</td>
                      <td className="py-2 text-center">
                        {actual > 0 ? <Badge tone="slate">{b.account.type === "revenue" ? "Revenue" : "Cost"}</Badge> : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            💡 Set monthly budgets per GL account in the <code>budgets</code> table to see budget vs actual variance.
            Budget entries can be added via Supabase Table Editor or a future budget form.
          </p>
        </Card>
      )}
    </div>
  );
}
