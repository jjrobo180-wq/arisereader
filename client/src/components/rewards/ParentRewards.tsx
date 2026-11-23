// The Reward Store for a parent (shared/rewardStore.ts): their children's Reward Points, what's waiting for a yes
// or no, perks to give, and the family's own rewards (free to them: screen time, picking dinner…).
import { useCallback, useEffect, useState } from "react";
import { Check, Coins, Loader2, Plus, Trash2, X } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import type { RewardItem, RewardRequest } from "@shared/rewardStore";
import { KIND_COLOR, KIND_ICON } from "./RewardStore";

type ParentData = { role: "parent"; children: { id: number; name: string; balance: number }[]; email: string; waiting: RewardRequest[]; toGive: RewardRequest[]; recent: RewardRequest[]; perks: RewardItem[]; ideas: RewardItem[] };
const field = "min-h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-400";

export default function ParentRewards({ token }: { token: string | null }) {
  const [data, setData] = useState<ParentData | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [perks, setPerks] = useState<RewardItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const call = useCallback(async (path: string, method = "GET", body?: unknown) => {
    const res = await fetch(`${API_BASE}/api/rewards${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await res.json().catch(() => null);
    if (!res.ok) throw new Error(j?.message || "The Reward Store can't be reached right now.");
    return j;
  }, [token]);
  const load = useCallback(async () => {
    try { const d = await call(""); if (d?.role === "parent") { setData(d); setEmail((e) => e || d.email); setPerks(d.perks); setDirty(false); } setError(""); }
    catch (e: any) { setError(e.message); }
  }, [call]);
  useEffect(() => { void load(); }, [load]);

  const decide = async (r: RewardRequest, yes: boolean) => {
    setBusy(r.id);
    try { await call(`/requests/${r.id}/decide`, "POST", { yes, email }); await load(); } catch (e: any) { setError(e.message); }
    setBusy("");
  };
  const given = async (r: RewardRequest) => { setBusy(r.id); try { await call(`/requests/${r.id}/sent`, "POST", {}); await load(); } catch (e: any) { setError(e.message); } setBusy(""); };
  const savePerks = async () => { setBusy("perks"); try { await call("/perks", "PUT", { perks }); await load(); } catch (e: any) { setError(e.message); } setBusy(""); };
  const edit = (i: number, patch: Partial<RewardItem>) => { setPerks((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x))); setDirty(true); };

  if (!data) return error ? <p className="text-sm text-slate-500">{error}</p> : <div className="grid place-items-center py-6"><Loader2 className="animate-spin text-slate-400" /></div>;
  const paidWaiting = data.waiting.some((r) => r.costCents > 0);

  return <div className="space-y-5" data-testid="parent-rewards">
    <p className="text-sm text-slate-600">Your child earns Reward Points by passing book quizzes, and cashes them in here. You pick the rewards and what each costs in points, and you give them: nothing happens until you say yes.</p>
    {error && <p className="flex items-center justify-between gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss"><X size={15} /></button></p>}

    {data.children.length > 0 && <div className="flex flex-wrap gap-2">{data.children.map((c) => <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-800"><Coins size={14} />{c.name}: {c.balance.toLocaleString("en-US")}</span>)}</div>}

    {data.waiting.length > 0 && <div className="space-y-2">
      <h3 className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Waiting for you</h3>
      {paidWaiting && <label className="block text-sm"><span className="mb-1 block text-xs font-semibold text-slate-500">Send gift cards and money to</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={`${field} w-full`} /></label>}
      <ul className="space-y-2">{data.waiting.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${KIND_COLOR[r.kind]}`}>{KIND_ICON[r.kind]}</span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900">{r.studentName} wants {r.title}</span><span className="text-xs text-slate-500">{r.points.toLocaleString("en-US")} points</span></span>
        <span className="flex gap-2">
          <button type="button" disabled={!!busy} onClick={() => void decide(r, false)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">Not yet</button>
          <button type="button" disabled={!!busy} onClick={() => void decide(r, true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-sm font-semibold text-white" data-testid="reward-approve">{busy === r.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}Yes</button>
        </span>
      </li>)}</ul>
    </div>}

    {data.toGive.length > 0 && <div className="space-y-2">
      <h3 className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Yours to give</h3>
      <ul className="space-y-2">{data.toGive.map((r) => <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <span className="min-w-0 flex-1 text-sm"><b>{r.title}</b> for {r.studentName}</span>
        <button type="button" disabled={!!busy} onClick={() => void given(r)} className="min-h-10 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white">Given</button>
      </li>)}</ul>
    </div>}

    <div className="space-y-2">
      <h3 className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Your family's rewards (free to give)</h3>
      {perks.map((p, i) => <div key={i} className="flex flex-wrap items-center gap-2">
        <input value={p.title} onChange={(e) => edit(i, { title: e.target.value })} maxLength={60} aria-label="Reward" className={`${field} flex-1`} />
        <label className="flex items-center gap-1 text-sm text-slate-500"><input type="number" min={100} step={100} value={p.points} onChange={(e) => edit(i, { points: Number(e.target.value) })} aria-label="Points" className={`${field} w-28`} />pts</label>
        <button type="button" onClick={() => { setPerks((x) => x.filter((_, j) => j !== i)); setDirty(true); }} aria-label={`Remove ${p.title}`} className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-slate-100"><Trash2 size={16} /></button>
      </div>)}
      <div className="flex flex-wrap gap-2">
        {data.ideas.filter((x) => !perks.some((p) => p.title === x.title)).map((x) => <button key={x.title} type="button" onClick={() => { setPerks((p) => [...p, { ...x, id: "" }]); setDirty(true); }} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200"><Plus size={13} />{x.title}</button>)}
        <button type="button" onClick={() => { setPerks((p) => [...p, { id: "", kind: "perk", title: "", costCents: 0, points: 2000, detail: "", active: true }]); setDirty(true); }} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200"><Plus size={13} />Your own</button>
      </div>
      {dirty && <button type="button" disabled={busy === "perks"} onClick={() => void savePerks()} className="min-h-10 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white" data-testid="perks-save">Save rewards</button>}
    </div>

    {data.recent.length > 0 && <details className="text-sm"><summary className="cursor-pointer font-semibold text-slate-600">Past rewards</summary>
      <ul className="mt-2 space-y-1">{data.recent.map((r) => <li key={r.id} className="flex justify-between gap-2 text-slate-600"><span className="truncate">{r.studentName}: {r.title}</span><span className="shrink-0 text-xs">{r.status === "sent" ? "Done" : r.status === "approved" ? "On its way" : r.status === "declined" ? "Said not yet" : "Taken back"}</span></li>)}</ul>
    </details>}
  </div>;
}
