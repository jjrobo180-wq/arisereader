// The Reward Store, as a student sees it (shared/rewardStore.ts, server/rewardStore.ts): their Reward Points, how
// they earned them, and what they can cash them in for. Paid rewards go to a parent's email after the parent says
// yes; a family's own perks are given by the parent.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Check, Clock, Coins, Gift, Loader2, Sparkles, UtensilsCrossed, Wallet, X } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { DAILY_CAP, POINTS_PER_BOOK_POINT, WHY_WORDS, pointsWords, type Availability, type Earning, type RewardItem, type RewardKind, type RewardRequest } from "@shared/rewardStore";

type StoreItem = RewardItem & { availability: Availability };
type StudentData = {
  role: "student"; balance: number; earnedTotal: number; spentTotal: number; expiring: number; recent: Earning[];
  store: StoreItem[]; perks: StoreItem[]; requests: RewardRequest[]; monthUsedCents: number; studentCapCents: number; hasParent: boolean; paidPlan: boolean;
};

export const KIND_ICON: Record<RewardKind, ReactNode> = { gift: <Gift size={18} />, food: <UtensilsCrossed size={18} />, money: <Wallet size={18} />, perk: <Sparkles size={18} /> };
export const KIND_COLOR: Record<RewardKind, string> = { gift: "bg-violet-100 text-violet-700", food: "bg-amber-100 text-amber-700", money: "bg-emerald-100 text-emerald-700", perk: "bg-sky-100 text-sky-700" };
const STATUS: Record<RewardRequest["status"], [string, string]> = {
  waiting: ["Waiting for your parent", "bg-amber-100 text-amber-800"], approved: ["Yes! On its way", "bg-emerald-100 text-emerald-800"], sent: ["Done", "bg-slate-100 text-slate-600"],
  declined: ["Not this time · points back", "bg-rose-50 text-rose-700"], canceled: ["Taken back · points back", "bg-slate-100 text-slate-500"],
};

export default function RewardStore({ token }: { token: string | null }) {
  const [data, setData] = useState<StudentData | null>(null);
  const [error, setError] = useState("");
  const [asking, setAsking] = useState<StoreItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const call = useCallback(async (path: string, body?: unknown) => {
    const res = await fetch(`${API_BASE}/api/rewards${path}`, { method: body === undefined ? "GET" : "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await res.json().catch(() => null);
    if (!res.ok) throw new Error(j?.message || "The Reward Store can't be reached right now.");
    return j;
  }, [token]);
  const load = useCallback(async () => { try { const d = await call(""); if (d?.role === "student") setData(d); setError(""); } catch (e: any) { setError(e.message); } }, [call]);
  useEffect(() => { void load(); }, [load]);

  const redeem = async (it: StoreItem) => {
    setBusy(true);
    try { await call("/redeem", { itemId: it.id }); setAsking(null); setNote(it.costCents > 0 ? "Sent to your parent. When they say yes, it goes to their email." : "Sent to your parent to say yes."); await load(); }
    catch (e: any) { setNote(e.message); setAsking(null); }
    setBusy(false);
  };
  const cancel = async (r: RewardRequest) => { try { await call(`/requests/${r.id}/cancel`, {}); await load(); } catch (e: any) { setNote(e.message); } };

  if (!data) return error ? <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">{error}</p> : <div className="grid place-items-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>;
  const all = [...data.perks, ...data.store];
  const next = all.filter((x) => !x.availability.ok && x.availability.why === "points").sort((a, b) => a.points - b.points)[0];

  return <section className="space-y-5" data-testid="reward-store">
    {/* Balance */}
    <div className="rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-600 p-5 text-white shadow-lg">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-white/75"><Coins size={15} />Reward Points</p>
      <p className="mt-1 text-4xl font-black tabular-nums" data-testid="reward-balance">{data.balance.toLocaleString("en-US")}</p>
      {next && <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, Math.round((data.balance / next.points) * 100))}%` }} /></div>
        <p className="mt-1.5 text-sm text-white/85">{pointsWords(next.points - data.balance)} more for {next.title}</p>
      </div>}
      {data.expiring > 0 && <p className="mt-2 text-xs text-white/75">{pointsWords(data.expiring)} expire within a month: use them before then.</p>}
    </div>
    <p className="px-1 text-sm text-slate-500">Pass a book quiz to earn {POINTS_PER_BOOK_POINT}× the book's points (a 10-point book = {(10 * POINTS_PER_BOOK_POINT).toLocaleString("en-US")} Reward Points). Up to {DAILY_CAP.toLocaleString("en-US")} a day.</p>
    {note && <p className="flex items-center justify-between gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white" role="status">{note}<button type="button" onClick={() => setNote("")} aria-label="Dismiss"><X size={16} /></button></p>}

    {/* Waiting and recent */}
    {data.requests.length > 0 && <div>
      <h3 className="mb-2 px-1 text-xs font-black uppercase tracking-[.12em] text-slate-500">Your rewards</h3>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">{data.requests.slice(0, 8).map((r) => <li key={r.id} className="flex items-center gap-3 px-4 py-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${KIND_COLOR[r.kind]}`}>{KIND_ICON[r.kind]}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{r.title}</span><span className="text-xs text-slate-500">{r.points.toLocaleString("en-US")} points</span></span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span>
        {r.status === "waiting" && <button type="button" onClick={() => void cancel(r)} className="text-xs font-semibold text-slate-500 underline">Take back</button>}
      </li>)}</ul>
    </div>}

    {/* The store */}
    {data.perks.length > 0 && <Shelf title="From your family" items={data.perks} balance={data.balance} onPick={setAsking} />}
    <Shelf title="Gift cards" items={data.store.filter((x) => x.kind === "gift")} balance={data.balance} onPick={setAsking} />
    <Shelf title="Food" items={data.store.filter((x) => x.kind === "food")} balance={data.balance} onPick={setAsking} />
    <Shelf title="Money (sent to your parent)" items={data.store.filter((x) => x.kind === "money")} balance={data.balance} onPick={setAsking} />
    {data.hasParent && !data.perks.length && !data.store.length && <p className="rounded-2xl bg-violet-50 p-4 text-sm text-violet-900" data-testid="reward-store-empty">No rewards yet. Ask your parent to add some: they pick the rewards and what each one costs in points.</p>}
    {!data.hasParent && <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Ask a parent to link to your account. Every reward needs a parent's OK.</p>}

    {/* How it was earned */}
    {data.recent.length > 0 && <details className="rounded-2xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-bold text-slate-700">How you earned them</summary>
      <ul className="mt-3 space-y-1.5">{data.recent.map((e, i) => <li key={i} className="flex justify-between gap-3 text-sm"><span className="min-w-0 truncate text-slate-600">{e.what}</span><span className="shrink-0 font-semibold tabular-nums text-emerald-700">+{e.points.toLocaleString("en-US")}</span></li>)}</ul>
    </details>}

    {asking && <div className="fixed inset-0 z-[500] flex items-end justify-center bg-slate-950/50 p-4 sm:items-center" role="dialog" aria-modal="true" onClick={() => !busy && setAsking(null)}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <span className={`grid h-12 w-12 place-items-center rounded-2xl ${KIND_COLOR[asking.kind]}`}>{KIND_ICON[asking.kind]}</span>
        <h2 className="mt-3 text-xl font-black text-slate-900">{asking.title}</h2>
        <p className="mt-1 text-sm text-slate-600">Use <b>{asking.points.toLocaleString("en-US")}</b> of your {data.balance.toLocaleString("en-US")} points? Your parent will be asked to say yes{asking.costCents > 0 ? ", then it goes to their email" : ""}. If they say not yet, you get the points back.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => setAsking(null)} className="min-h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">Not now</button>
          <button type="button" disabled={busy} onClick={() => void redeem(asking)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white" data-testid="reward-confirm">{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}Cash in</button>
        </div>
      </div>
    </div>}
  </section>;
}

function Shelf({ title, items, balance, onPick }: { title: string; items: StoreItem[]; balance: number; onPick: (it: StoreItem) => void }) {
  if (!items.length) return null;
  return <div>
    <h3 className="mb-2 px-1 text-xs font-black uppercase tracking-[.12em] text-slate-500">{title}</h3>
    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{items.map((it) => {
      const ok = it.availability.ok;
      const why = !it.availability.ok ? it.availability.why : null;
      return <li key={it.id}><button type="button" disabled={!ok} onClick={() => onPick(it)} data-testid="reward-item"
        className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${ok ? "border-violet-200 bg-white hover:border-violet-400 hover:shadow-sm" : "border-slate-200 bg-slate-50"}`}>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${KIND_COLOR[it.kind]}`}>{KIND_ICON[it.kind]}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-slate-900">{it.title}</span>
          <span className="flex items-center gap-1 text-xs font-semibold text-violet-700"><Coins size={12} />{it.points.toLocaleString("en-US")}</span>
          {why && <span className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">{why === "restocking" ? <Clock size={11} /> : null}{why === "points" ? `${pointsWords(it.points - balance)} to go` : WHY_WORDS[why]}</span>}
        </span>
      </button></li>;
    })}</ul>
  </div>;
}
