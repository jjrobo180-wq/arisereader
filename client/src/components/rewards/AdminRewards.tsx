// The Reward Store for the admin (shared/rewardStore.ts): the monthly budget (the safety switch), each student's
// monthly cap, the catalog and its prices, and the queue of approved paid rewards to send.
import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { POINTS_PER_DOLLAR, pointsFor, type RewardItem, type RewardKind, type RewardRequest, type StoreConfig } from "@shared/rewardStore";

type AdminData = { role: "admin"; config: StoreConfig; catalog: RewardItem[]; summary: { spentCents: number; leftCents: number; toSend: number; waitingParent: number }; tremendous: boolean; queue: RewardRequest[]; recent: RewardRequest[] };
const field = "min-h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-violet-400";
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function AdminRewards({ token }: { token: string | null }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [cfg, setCfg] = useState<StoreConfig | null>(null);
  const [items, setItems] = useState<RewardItem[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const call = useCallback(async (path: string, method = "GET", body?: unknown) => {
    const res = await fetch(`${API_BASE}/api/rewards${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await res.json().catch(() => null);
    if (!res.ok) throw new Error(j?.message || "The Reward Store can't be reached right now.");
    return j;
  }, [token]);
  const load = useCallback(async () => { try { const d = await call(""); if (d?.role === "admin") { setData(d); setCfg(d.config); setItems(d.catalog); } } catch (e: any) { setMsg(e.message); } }, [call]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setBusy("save");
    try { await call("/admin", "PUT", { config: cfg, catalog: items }); setMsg("Saved."); await load(); } catch (e: any) { setMsg(e.message); }
    setBusy("");
  };
  const sent = async (r: RewardRequest) => { setBusy(r.id); try { await call(`/requests/${r.id}/sent`, "POST", { note: notes[r.id] || "" }); await load(); } catch (e: any) { setMsg(e.message); } setBusy(""); };
  const edit = (i: number, patch: Partial<RewardItem>) => setItems((x) => x.map((y, j) => (j === i ? { ...y, ...patch } : y)));

  if (!data || !cfg) return <div className="grid place-items-center py-6"><Loader2 className="animate-spin text-slate-400" /></div>;
  return <div className="space-y-6" data-testid="admin-rewards">
    {msg && <p className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => setMsg("")}>{msg}</p>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[["Spent this month", usd(data.summary.spentCents)], ["Left in budget", usd(data.summary.leftCents)], ["To send", String(data.summary.toSend)], ["Waiting on parents", String(data.summary.waitingParent)]].map(([k, v]) =>
        <div key={k} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">{k}</p><p className="text-xl font-black tabular-nums">{v}</p></div>)}
    </div>

    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-bold">Money limits</h3>
      <p className="text-sm text-slate-500">The monthly budget is the safety switch: once paid rewards reach it, they show "Restocking" until next month. $0 keeps paid rewards closed. A good start is about 20% of what Reader brings in each month.</p>
      <div className="flex flex-wrap gap-4">
        <label className="text-sm">Monthly budget ($)<br /><input type="number" min={0} step={5} value={cfg.budgetCents / 100} onChange={(e) => setCfg({ ...cfg, budgetCents: Math.round(Number(e.target.value) * 100) })} className={`${field} mt-1 w-32`} data-testid="rewards-budget" /></label>
        <label className="text-sm">Per student per month ($)<br /><input type="number" min={0} step={1} value={cfg.studentCapCents / 100} onChange={(e) => setCfg({ ...cfg, studentCapCents: Math.round(Number(e.target.value) * 100) })} className={`${field} mt-1 w-32`} /></label>
        <label className="text-sm">Quizzes count from<br /><input type="date" value={cfg.startedOn} onChange={(e) => setCfg({ ...cfg, startedOn: e.target.value })} className={`${field} mt-1`} /></label>
      </div>
      <p className="text-xs text-slate-500">{POINTS_PER_DOLLAR.toLocaleString("en-US")} points = $1 of cost. Paid rewards can't be priced below cost + 20%. Gift cards {data.tremendous ? "with a Tremendous product id are sent automatically when a parent says yes" : "are sent by hand from the queue below (set TREMENDOUS_API_KEY to send them automatically)"}.</p>
    </div>

    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-bold">Catalog</h3>
      {items.map((it, i) => <div key={i} className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
        <select value={it.kind} onChange={(e) => edit(i, { kind: e.target.value as RewardKind })} className={field} aria-label="Kind"><option value="gift">Gift card</option><option value="food">Food</option><option value="money">Money</option></select>
        <input value={it.title} onChange={(e) => edit(i, { title: e.target.value })} className={`${field} flex-1`} aria-label="Title" />
        <label className="text-xs text-slate-500">Cost $<input type="number" min={0.01} step={0.25} value={it.costCents / 100} onChange={(e) => { const c = Math.round(Number(e.target.value) * 100); edit(i, { costCents: c, points: Math.max(it.points, pointsFor(c)) }); }} className={`${field} ml-1 w-20`} /></label>
        <label className="text-xs text-slate-500">Points<input type="number" min={pointsFor(it.costCents)} step={500} value={it.points} onChange={(e) => edit(i, { points: Number(e.target.value) })} className={`${field} ml-1 w-24`} /></label>
        {data.tremendous && <input value={it.tremendousProduct || ""} onChange={(e) => edit(i, { tremendousProduct: e.target.value })} placeholder="Tremendous product id" className={`${field} w-44`} />}
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={it.active} onChange={(e) => edit(i, { active: e.target.checked })} />Shown</label>
        <button type="button" onClick={() => setItems((x) => x.filter((_, j) => j !== i))} aria-label={`Remove ${it.title}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><Trash2 size={15} /></button>
      </div>)}
      <button type="button" onClick={() => setItems((x) => [...x, { id: "", kind: "gift", title: "New gift card · $5", costCents: 500, points: pointsFor(500), detail: "Sent to your parent's email", active: true }])} className="inline-flex items-center gap-1 text-sm font-semibold text-violet-700"><Plus size={15} />Add a reward</button>
    </div>
    <button type="button" disabled={busy === "save"} onClick={() => void save()} className="min-h-11 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white">Save the store</button>

    <div className="space-y-2">
      <h3 className="font-bold">To send ({data.queue.length})</h3>
      {!data.queue.length && <p className="text-sm text-slate-500">Nothing waiting.</p>}
      {data.queue.map((r) => <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
        <span className="min-w-0 flex-1"><b>{r.title}</b> ({usd(r.costCents)}) for {r.studentName} → <span className="select-all font-mono">{r.sendTo}</span></span>
        <input value={notes[r.id] || ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} placeholder="Order number (optional)" className={`${field} w-48`} />
        <button type="button" disabled={!!busy} onClick={() => void sent(r)} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-slate-900 px-3 font-semibold text-white"><Check size={14} />Sent</button>
      </div>)}
    </div>
  </div>;
}
