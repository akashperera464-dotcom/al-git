import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trophy, Plus, Loader2, Gift, History, Award, ArrowUp, ArrowDown, Star, Crown, Medal, Sparkles, CheckCircle2, XCircle, Package } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import {
  listLoyaltyMembers, createLoyaltyMember, awardPoints,
  listPointsLedger, listLoyaltyRewards, createLoyaltyReward, toggleRewardActive,
  listRedemptions, redeemReward, decideRedemption,
  decideRedemptionWithPayrollWire,
} from "@/lib/repo.phase2";
import { useApp } from "@/context/AppContext";
import {
  TIER_THRESHOLDS, tierForPoints, badgeForPoints, nextTierFrom,
  type LoyaltyMemberFull, type LoyaltyPointsEntry, type LoyaltyReward,
  type LoyaltyRedemption, type RedemptionStatus, type LoyaltyTier,
} from "@/lib/data";

type Tab = "leaderboard" | "members" | "rewards" | "redemptions" | "ledger";

/**
 * Loyalty Program — full gamified points + tier + rewards + redemption system.
 *
 * Tabs:
 *   1. Leaderboard  — ranked members with tier badges + progression
 *   2. Members      — CRUD members + manual points award/deduct
 *   3. Rewards      — catalog CRUD (add/activate/deactivate)
 *   4. Redemptions  — pending approvals + history; approve/reject/fulfill
 *   5. Ledger       — full points audit log (earn/burn/adjust/bonus)
 */
export default function Loyalty() {
  const { t } = useTranslation();
  const { userUid } = useApp();
  const [tab, setTab] = useState<Tab>("leaderboard");
  const [members, setMembers] = useState<LoyaltyMemberFull[]>([]);
  const [ledger, setLedger] = useState<LoyaltyPointsEntry[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [redemptions, setRedemptions] = useState<LoyaltyRedemption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<LoyaltyMemberFull | null>(null);

  // Forms
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberInitial, setNewMemberInitial] = useState(0);
  const [awardPointsForm, setAwardPointsForm] = useState({ points: 0, reason: "" });
  const [newReward, setNewReward] = useState({ code: "", name: "", description: "", category: "merchandise" as LoyaltyReward["category"], pointsCost: 500, cashValue: 0, stockQty: -1 });
  const [redeemForm, setRedeemForm] = useState({ memberId: "", rewardId: "" });

  const reload = async () => {
    setBusy(true);
    try {
      const [m, l, r, rd] = await Promise.all([
        listLoyaltyMembers(), listPointsLedger(),
        listLoyaltyRewards(), listRedemptions(),
      ]);
      setMembers(m); setLedger(l); setRewards(r); setRedemptions(rd);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load loyalty data");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  // Stats
  const totalMembers = members.length;
  const totalPoints = members.reduce((s, m) => s + m.points, 0);
  const pendingRedemptions = redemptions.filter(r => r.status === "pending").length;
  const totalRedeemed = redemptions.filter(r => r.status === "fulfilled").length;

  // ---- Actions ----
  const addMember = async () => {
    setError(null);
    if (!newMemberName.trim()) { setError("Worker name required"); return; }
    setBusy(true);
    try {
      await createLoyaltyMember({ workerName: newMemberName.trim(), initialPoints: newMemberInitial });
      setSuccess(`Member "${newMemberName}" added${newMemberInitial > 0 ? ` with ${newMemberInitial} bonus points` : ""}`);
      setNewMemberName(""); setNewMemberInitial(0);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add member");
    } finally {
      setBusy(false);
    }
  };

  const submitAward = async () => {
    if (!selectedMember) return;
    setError(null);
    if (!awardPointsForm.reason.trim()) { setError("Reason required"); return; }
    if (awardPointsForm.points === 0) { setError("Points must be non-zero (use +N to earn, -N to deduct)"); return; }
    setBusy(true);
    try {
      const res = await awardPoints({
        memberId: selectedMember.id,
        points: awardPointsForm.points,
        reason: awardPointsForm.reason.trim(),
        awardedBy: userUid,
        expectedVersion: selectedMember.version,
      });
      if (res.resolution === "conflict") {
        setError("Conflict — another user modified this member. Refreshed.");
      } else if (res.resolution === "updated") {
        setSuccess(`${awardPointsForm.points > 0 ? "Awarded" : "Deducted"} ${Math.abs(awardPointsForm.points)} points ${awardPointsForm.points > 0 ? "to" : "from"} ${selectedMember.workerName}`);
        setAwardPointsForm({ points: 0, reason: "" });
        await reload();
        // Refresh selected member
        const updated = (await listLoyaltyMembers()).find(m => m.id === selectedMember.id);
        if (updated) setSelectedMember(updated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to award points");
    } finally {
      setBusy(false);
    }
  };

  const addReward = async () => {
    setError(null);
    if (!newReward.code.trim() || !newReward.name.trim()) { setError("Code and Name required"); return; }
    setBusy(true);
    try {
      await createLoyaltyReward({
        code: newReward.code.trim(), name: newReward.name.trim(),
        description: newReward.description.trim() || undefined,
        category: newReward.category, pointsCost: newReward.pointsCost,
        cashValue: newReward.cashValue, stockQty: newReward.stockQty,
      });
      setSuccess(`Reward "${newReward.name}" added to catalog`);
      setNewReward({ code: "", name: "", description: "", category: "merchandise", pointsCost: 500, cashValue: 0, stockQty: -1 });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add reward");
    } finally {
      setBusy(false);
    }
  };

  const toggleReward = async (r: LoyaltyReward) => {
    setBusy(true);
    try {
      await toggleRewardActive(r.id, !r.isActive, r.version);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to toggle");
    } finally {
      setBusy(false);
    }
  };

  const submitRedeem = async () => {
    setError(null);
    if (!redeemForm.memberId || !redeemForm.rewardId) { setError("Select member and reward"); return; }
    const member = members.find(m => m.id === redeemForm.memberId);
    const reward = rewards.find(r => r.id === redeemForm.rewardId);
    if (!member || !reward) { setError("Invalid selection"); return; }
    setBusy(true);
    try {
      const res = await redeemReward({
        memberId: redeemForm.memberId, rewardId: redeemForm.rewardId,
        expectedMemberVersion: member.version, expectedRewardVersion: reward.version,
      });
      if (!res.ok) {
        setError(res.error ?? "Redemption failed");
      } else {
        setSuccess(`Redemption "${res.redemption?.redemptionCode}" created — ${reward.pointsCost} points deducted from ${member.workerName}`);
        setRedeemForm({ memberId: "", rewardId: "" });
        await reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to redeem");
    } finally {
      setBusy(false);
    }
  };

  const decideRedemptionAction = async (r: LoyaltyRedemption, decision: "approved" | "rejected" | "fulfilled" | "cancelled") => {
    setBusy(true);
    try {
      // For cash-category redemptions being approved, use the payroll-wired version
      // which auto-creates a payroll_allowance for the worker
      const reward = rewards.find(rw => rw.id === r.rewardId);
      const member = members.find(m => m.id === r.memberId);
      const isCashRedemption = reward?.category === "cash" && decision === "approved";

      if (isCashRedemption && member) {
        // Find the worker in seedWorkers by name (mock) — in production, member.workerId links directly
        const res = await decideRedemptionWithPayrollWire({
          redemptionId: r.id,
          decision,
          approverUid: userUid,
          notes: r.notes,
          expectedVersion: r.version,
          workerId: member.workerId ?? member.id, // fallback to member.id for mock
          workerName: member.workerName,
          cashValue: reward?.cashValue ?? 0,
        });
        if (!res.ok) {
          setError(res.error ?? "Failed to approve with payroll link");
        } else {
          setSuccess(`Cash bonus redemption approved — Rs ${reward?.cashValue.toLocaleString()} will auto-flow into ${member.workerName}'s next payroll`);
        }
      } else {
        // Non-cash redemptions: use the standard decide function
        const res = await decideRedemption({
          redemptionId: r.id, decision, approverUid: userUid, expectedVersion: r.version,
        });
        if (res.resolution === "conflict") {
          setError("Conflict — another admin already acted. Refreshed.");
        }
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to decide");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="People & Pay"
        title="Loyalty Program"
        desc="Gamified points, tier progression (Bronze → Platinum), rewards catalog, and redemption workflow for estate workers."
        icon={<IconChip icon={Trophy} tone="violet" className="h-12 w-12" />}
      />

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      {success && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Trophy} label="Members" value={String(totalMembers)} tone="violet" />
        <StatCard icon={Star} label="Points in Circulation" value={String(totalPoints)} tone="amber" />
        <StatCard icon={Gift} label="Pending Redemptions" value={String(pendingRedemptions)} tone="rose" />
        <StatCard icon={CheckCircle2} label="Fulfilled" value={String(totalRedeemed)} tone="emerald" />
      </div>

      {/* Tier legend */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">Tiers:</span>
        {(["Bronze", "Silver", "Gold", "Platinum"] as LoyaltyTier[]).map(tier => (
          <Badge key={tier} tone={tier === "Platinum" ? "violet" : tier === "Gold" ? "amber" : tier === "Silver" ? "slate" : "rose"}>
            {tier === "Platinum" && <Crown className="mr-1 inline h-3 w-3" />}
            {tier === "Gold" && <Medal className="mr-1 inline h-3 w-3" />}
            {tier === "Silver" && <Medal className="mr-1 inline h-3 w-3" />}
            {tier === "Bronze" && <Medal className="mr-1 inline h-3 w-3" />}
            {tier} ≥ {TIER_THRESHOLDS[tier]}pts
          </Badge>
        ))}
      </div>

      {/* Tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {([
          { id: "leaderboard", label: "Leaderboard", icon: Trophy },
          { id: "members", label: "Members", icon: Star },
          { id: "rewards", label: "Rewards Catalog", icon: Gift },
          { id: "redemptions", label: `Redemptions${pendingRedemptions > 0 ? ` (${pendingRedemptions})` : ""}`, icon: Package },
          { id: "ledger", label: "Points Ledger", icon: History },
        ] as const).map(t2 => {
          const Icon = t2.icon;
          const active = tab === t2.id;
          return (
            <button key={t2.id} onClick={() => setTab(t2.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${active ? "bg-violet-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              <Icon className="h-3.5 w-3.5" /> {t2.label}
            </button>
          );
        })}
      </div>

      {/* ============== Tab: Leaderboard ============== */}
      {tab === "leaderboard" && (
        <div className="mt-4 space-y-2">
          {members.length === 0 ? (
            <Card className="p-8 text-center text-sm text-slate-400">No members yet. Add one in the Members tab.</Card>
          ) : (
            members.map((m, idx) => {
              const rank = idx + 1;
              const next = nextTierFrom(m.points);
              const progressPct = next
                ? Math.min(100, Math.round(((m.points - TIER_THRESHOLDS[m.tier]) / (TIER_THRESHOLDS[next.next] - TIER_THRESHOLDS[m.tier])) * 100))
                : 100;
              return (
                <Card key={m.id} className={`p-4 ${rank <= 3 ? "border-violet-200" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${rank === 1 ? "bg-amber-100 text-amber-700" : rank === 2 ? "bg-slate-200 text-slate-700" : rank === 3 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}>
                      {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-display text-sm font-bold text-slate-800">{m.workerName}</p>
                        <Badge tone={m.tier === "Platinum" ? "violet" : m.tier === "Gold" ? "amber" : m.tier === "Silver" ? "slate" : "rose"}>
                          {m.tier}
                        </Badge>
                        {m.badge && <Badge tone="sky">{m.badge}</Badge>}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
                        <span>{m.points.toLocaleString()} pts</span>
                        <span>· Streak: {m.streakDays}d</span>
                        <span>· Earned: {m.totalEarned.toLocaleString()}</span>
                        <span>· Burned: {m.totalBurned.toLocaleString()}</span>
                      </div>
                      {next && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${progressPct}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-400">{next.pointsNeeded}pts to {next.next}</span>
                        </div>
                      )}
                      {!next && <p className="mt-1 text-[10px] text-violet-600">★ Top tier reached</p>}
                    </div>
                    <button onClick={() => { setSelectedMember(m); setTab("members"); }}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-50">
                      Manage
                    </button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ============== Tab: Members ============== */}
      {tab === "members" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Left: Add member + Award points */}
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Add New Member</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-slate-400">Worker Name</label>
                  <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder="e.g. Nimal Perera" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Initial Bonus Points</label>
                  <input type="number" value={newMemberInitial || ""} onChange={e => setNewMemberInitial(+e.target.value)} placeholder="0" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
                </div>
                <button onClick={addMember} disabled={busy} className="w-full rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">Add Member</button>
              </div>
            </Card>

            {selectedMember && (
              <Card className="p-4">
                <h3 className="mb-1 font-display text-sm font-bold text-slate-800">Award / Deduct Points</h3>
                <p className="mb-3 text-[11px] text-slate-400">{selectedMember.workerName} · {selectedMember.points} pts · {selectedMember.tier} · v{selectedMember.version}</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-slate-400">Points (+ earn, − deduct)</label>
                    <input type="number" value={awardPointsForm.points || ""} onChange={e => setAwardPointsForm({ ...awardPointsForm, points: +e.target.value })} placeholder="e.g. 100 or -50" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">Reason</label>
                    <input value={awardPointsForm.reason} onChange={e => setAwardPointsForm({ ...awardPointsForm, reason: e.target.value })} placeholder="e.g. Perfect attendance July" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={submitAward} disabled={busy} className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50">
                      {awardPointsForm.points >= 0 ? <><ArrowUp className="mr-1 inline h-3 w-3" />Award</> : <><ArrowDown className="mr-1 inline h-3 w-3" />Deduct</>}
                    </button>
                    <button onClick={() => setSelectedMember(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500">Cancel</button>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Right: Members list */}
          <Card className="lg:col-span-2 p-3">
            <h3 className="mb-2 px-1 font-display text-sm font-bold text-slate-800">All Members ({members.length})</h3>
            {members.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No members yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
                {members.map(m => (
                  <button key={m.id} onClick={() => setSelectedMember(m)}
                    className={`w-full rounded-lg border p-2.5 text-left transition ${selectedMember?.id === m.id ? "border-violet-300 bg-violet-50" : "border-slate-100 hover:bg-slate-50"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{m.workerName}</p>
                        <p className="text-[11px] text-slate-400">{m.points} pts · {m.streakDays}d streak · {m.badge || "no badge"}</p>
                      </div>
                      <Badge tone={m.tier === "Platinum" ? "violet" : m.tier === "Gold" ? "amber" : m.tier === "Silver" ? "slate" : "rose"}>{m.tier}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ============== Tab: Rewards Catalog ============== */}
      {tab === "rewards" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Add Reward</h3>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-slate-400">Code</label>
                <input value={newReward.code} onChange={e => setNewReward({ ...newReward, code: e.target.value })} placeholder="RWD-MUG" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Name</label>
                <input value={newReward.name} onChange={e => setNewReward({ ...newReward, name: e.target.value })} placeholder="Coffee Mug" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Description</label>
                <input value={newReward.description} onChange={e => setNewReward({ ...newReward, description: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400">Category</label>
                  <select value={newReward.category} onChange={e => setNewReward({ ...newReward, category: e.target.value as LoyaltyReward["category"] })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                    <option value="merchandise">Merchandise</option>
                    <option value="cash">Cash Bonus</option>
                    <option value="voucher">Voucher</option>
                    <option value="experience">Experience</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Points Cost</label>
                  <input type="number" value={newReward.pointsCost} onChange={e => setNewReward({ ...newReward, pointsCost: +e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400">Cash Value (Rs)</label>
                  <input type="number" value={newReward.cashValue || ""} onChange={e => setNewReward({ ...newReward, cashValue: +e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Stock (-1 = unlimited)</label>
                  <input type="number" value={newReward.stockQty} onChange={e => setNewReward({ ...newReward, stockQty: +e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
                </div>
              </div>
              <button onClick={addReward} disabled={busy} className="w-full rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">Add Reward</button>
            </div>
          </Card>

          <Card className="lg:col-span-2 p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Catalog ({rewards.length})</h3>
            {rewards.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No rewards yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {rewards.map(r => (
                  <div key={r.id} className={`rounded-xl border p-3 ${r.isActive ? "border-violet-100" : "border-slate-100 opacity-60"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{r.name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{r.code}</p>
                      </div>
                      <Badge tone={r.category === "cash" ? "emerald" : r.category === "voucher" ? "amber" : r.category === "experience" ? "violet" : "sky"}>{r.category}</Badge>
                    </div>
                    {r.description && <p className="mt-1 text-[11px] text-slate-500">{r.description}</p>}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-bold text-violet-700">{r.pointsCost.toLocaleString()} pts</span>
                      {r.cashValue > 0 && <span className="text-slate-500">Rs {r.cashValue.toLocaleString()}</span>}
                      {r.stockQty !== -1 && <span className="text-slate-400">{r.stockQty} in stock</span>}
                      {r.stockQty === -1 && <span className="text-slate-400">∞ unlimited</span>}
                    </div>
                    <button onClick={() => toggleReward(r)} disabled={busy}
                      className={`mt-2 w-full rounded-lg py-1 text-[11px] font-semibold ${r.isActive ? "border border-rose-200 text-rose-600 hover:bg-rose-50" : "bg-emerald-600 text-white hover:brightness-110"}`}>
                      {r.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ============== Tab: Redemptions ============== */}
      {tab === "redemptions" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">New Redemption</h3>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-slate-400">Member</label>
                <select value={redeemForm.memberId} onChange={e => setRedeemForm({ ...redeemForm, memberId: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                  <option value="">— select —</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.workerName} ({m.points} pts)</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Reward</label>
                <select value={redeemForm.rewardId} onChange={e => setRedeemForm({ ...redeemForm, rewardId: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                  <option value="">— select —</option>
                  {rewards.filter(r => r.isActive).map(r => <option key={r.id} value={r.id}>{r.name} ({r.pointsCost} pts)</option>)}
                </select>
              </div>
              {redeemForm.memberId && redeemForm.rewardId && (() => {
                const m = members.find(x => x.id === redeemForm.memberId);
                const r = rewards.find(x => x.id === redeemForm.rewardId);
                if (!m || !r) return null;
                const canAfford = m.points >= r.pointsCost;
                return (
                  <div className={`rounded-lg p-2 text-xs ${canAfford ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {canAfford
                      ? `✓ ${m.workerName} will have ${m.points - r.pointsCost} pts remaining`
                      : `✗ Insufficient — needs ${r.pointsCost - m.points} more pts`}
                  </div>
                );
              })()}
              <button onClick={submitRedeem} disabled={busy || !redeemForm.memberId || !redeemForm.rewardId}
                className="w-full rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
                Redeem Reward
              </button>
            </div>
          </Card>

          <Card className="lg:col-span-2 p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Redemption History ({redemptions.length})</h3>
            {redemptions.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No redemptions yet.</p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {redemptions.map(r => (
                  <div key={r.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{r.redemptionCode}</p>
                        <p className="text-[11px] text-slate-400">
                          {r.workerName} → {r.rewardName} · {r.pointsCost} pts
                          {r.cashValue > 0 && ` · Rs ${r.cashValue.toLocaleString()}`}
                        </p>
                        <p className="text-[10px] text-slate-400">{new Date(r.redeemedAt).toLocaleString()} · v{r.version}</p>
                      </div>
                      <Badge tone={
                        r.status === "fulfilled" ? "emerald" :
                        r.status === "approved" ? "sky" :
                        r.status === "rejected" ? "rose" :
                        r.status === "cancelled" ? "slate" : "amber"
                      } dot>{r.status}</Badge>
                    </div>
                    {r.status === "pending" && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button onClick={() => decideRedemptionAction(r, "approved")} disabled={busy}
                          className="rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:brightness-110">
                          <CheckCircle2 className="mr-1 inline h-3 w-3" />Approve
                        </button>
                        <button onClick={() => decideRedemptionAction(r, "rejected")} disabled={busy}
                          className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:brightness-110">
                          <XCircle className="mr-1 inline h-3 w-3" />Reject
                        </button>
                      </div>
                    )}
                    {r.status === "approved" && (
                      <div className="mt-2">
                        <button onClick={() => decideRedemptionAction(r, "fulfilled")} disabled={busy}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:brightness-110">
                          <Package className="mr-1 inline h-3 w-3" />Mark Fulfilled
                        </button>
                      </div>
                    )}
                    {r.notes && <p className="mt-1 text-[11px] text-slate-500">"{r.notes}"</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ============== Tab: Points Ledger ============== */}
      {tab === "ledger" && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Points Ledger — Audit Log ({ledger.length})</h3>
          {ledger.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No points transactions yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
              {ledger.map(l => (
                <div key={l.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5 text-xs">
                  <Badge tone={l.points >= 0 ? "emerald" : "rose"}>
                    {l.points >= 0 ? <ArrowUp className="mr-1 inline h-3 w-3" /> : <ArrowDown className="mr-1 inline h-3 w-3" />}
                    {l.transactionType}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800">
                      {l.workerName ?? "—"}
                      <span className={l.points >= 0 ? "ml-2 text-emerald-600" : "ml-2 text-rose-600"}>
                        {l.points >= 0 ? "+" : ""}{l.points}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400">{l.reason}{l.referenceType && ` · ref: ${l.referenceType}`}</p>
                  </div>
                  <span className="text-[10px] text-slate-400">{new Date(l.awardedAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
