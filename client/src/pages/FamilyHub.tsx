// FamilyHub: the third hub beside WorkHub and LifeHub, one that the whole family shares (shared/familySpace.ts).
// Not in a family yet: start one or join one with its code. In one: the same hub as LifeHub (AriseTodo),
// saved to the family's shared copy, with "Who's in FamilyHub" in its ⋯ menu for the code and the people.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Copy, LogOut, Users, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import AriseTodo from "@/pages/AriseTodo";
import HubMark from "@/components/HubMark";
import HubSwitch from "@/components/HubSwitch";
import type { FamilyInfo } from "@shared/familySpace";

const api = `${API_BASE}/api/family-space`;
// Which family this account is in, kept on the device so FamilyHub opens straight into the hub (no spinner,
// no white flash) and is checked with the server in the background, like LifeHub ⇄ WorkHub.
const infoKey = (id: number | string) => `arise-family-info-v1:${id}`;
const readInfo = (id: number | string | undefined): FamilyInfo | null | undefined => { if (!id) return undefined; try { const raw = localStorage.getItem(infoKey(id)); return raw ? (JSON.parse(raw).family ?? null) : undefined; } catch { return undefined; } };
const keepInfo = (id: number | string | undefined, family: FamilyInfo | null) => { if (id) try { localStorage.setItem(infoKey(id), JSON.stringify({ family })); } catch {} };
/** Fetched ahead of time from LifeHub and WorkHub (App.tsx), so the first switch to FamilyHub is instant too. */
export async function prefetchFamilyInfo(userId: number | undefined, token: string | null) {
  if (!userId || !token) return;
  const res = await fetch(api, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null);
  if (!res?.ok) return;
  const out = await res.json().catch(() => null);
  if (out && "family" in out) keepInfo(userId, out.family ?? null);
}

export default function FamilyHub() {
  const { user, token } = useAuth();
  const [family, setFamilyRaw] = useState<FamilyInfo | null | undefined>(() => readInfo(user?.id));
  const setFamily = useCallback((next: FamilyInfo | null | undefined | ((f: FamilyInfo | null | undefined) => FamilyInfo | null | undefined)) => setFamilyRaw((f) => { const v = typeof next === "function" ? next(f) : next; if (v !== undefined) keepInfo(user?.id, v); return v; }), [user?.id]);
  const [error, setError] = useState("");
  const [people, setPeople] = useState(false);

  const call = useCallback(async (path: string, body?: object) => {
    setError("");
    const res = await fetch(`${api}${path}`, body ? { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) } : { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) { setError(out?.message || "That didn't work. Please try again."); return false; }
    setFamily(out.family ?? null);
    return true;
  }, [token, setFamily]);

  useEffect(() => { if (token) void call("").then((ok) => { if (!ok) setFamily((f) => f === undefined ? null : f); }); }, [token, call]);

  if (!user) return null;
  if (family === undefined) return <div className="grid min-h-screen place-items-center bg-[#f6f7fc] dark:bg-[#0d1020]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" /></div>;
  if (!family) return <FamilyStart call={call} error={error} showSwitch={user.role === "teacher" || user.role === "parent" || user.role === "todo" || !!user.isAdmin} />;
  return <>
    {/* A new family (or one rejoined) is its own hub: the key starts it fresh. */}
    <AriseTodo key={`family-${family.code}`} space="family" onFamilyPeople={() => setPeople(true)} />
    {people && <FamilyPeople family={family} meId={Number(user.id)} call={call} error={error} onClose={() => setPeople(false)} />}
  </>;
}

const field = "min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

function FamilyStart({ call, error, showSwitch }: { call: (path: string, body?: object) => Promise<boolean>; error: string; showSwitch: boolean }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const go = (path: string, body: object) => async (e: FormEvent) => { e.preventDefault(); setBusy(true); await call(path, body); setBusy(false); };
  return <main className="min-h-screen bg-[#f6f7fc] px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]" data-testid="family-start">
    <header className="mx-auto flex max-w-3xl items-center justify-between gap-3 py-3">
      <span className="flex items-center gap-2"><HubMark tone="family" className="h-8 w-8" /><span className="text-[15px] font-extrabold text-slate-700">FamilyHub</span></span>
      {showSwitch && <HubSwitch current="family" />}
    </header>
    <section className="mx-auto mt-6 max-w-3xl text-center">
      <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">One hub for the whole family</h1>
      <p className="mx-auto mt-3 max-w-xl text-slate-600">The family calendar, chores, groceries, meals, bills and lists, shared by everyone you invite. Your LifeHub stays yours.</p>
    </section>
    {error && <p role="alert" className="mx-auto mt-6 max-w-3xl rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" data-testid="family-error">{error}</p>}
    <div className="mx-auto mt-6 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
      <form onSubmit={go("", { name })} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">Start a family</h2>
        <p className="mt-1 text-sm text-slate-500">You'll get a code to invite everyone else.</p>
        <label className="mt-4 block text-sm font-bold text-slate-700" htmlFor="family-name">Family name</label>
        <input id="family-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="The Robinsons" className={`${field} mt-1`} data-testid="family-name" />
        <button disabled={busy} className="mt-4 min-h-12 w-full rounded-xl bg-amber-500 px-4 font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-60" data-testid="family-create">Start FamilyHub</button>
      </form>
      <form onSubmit={go("/join", { code })} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">Join your family</h2>
        <p className="mt-1 text-sm text-slate-500">Someone already started one? Type their code.</p>
        <label className="mt-4 block text-sm font-bold text-slate-700" htmlFor="family-code">Family code</label>
        <input id="family-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} autoCapitalize="characters" autoComplete="off" placeholder="ABC234" className={`${field} mt-1 font-mono tracking-[.3em]`} data-testid="family-code" />
        <button disabled={busy || code.replace(/[\s-]/g, "").length !== 6} className="mt-4 min-h-12 w-full rounded-xl bg-slate-900 px-4 font-bold text-white hover:bg-slate-800 disabled:opacity-60" data-testid="family-join">Join</button>
      </form>
    </div>
  </main>;
}

function FamilyPeople({ family, meId, call, error, onClose }: { family: FamilyInfo; meId: number; call: (path: string, body?: object) => Promise<boolean>; error: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const others = family.members.filter((m) => m.id !== meId).length;
  const copy = async () => { try { await navigator.clipboard.writeText(family.code); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* the code is on screen */ } };
  return <div className="fixed inset-0 z-[700] flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label="Who's in FamilyHub" className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" data-testid="family-people">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Users className="h-5 w-5 text-amber-600" /> {family.name}</h2>
        <button onClick={onClose} aria-label="Close" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </div>
      <p className="mt-4 text-sm text-slate-600">To invite someone, have them open <b>Family</b> in Arise To Duo and type this code:</p>
      <button onClick={copy} className="mt-2 flex w-full items-center justify-between rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200" data-testid="family-code-show">
        <span className="font-mono text-2xl font-black tracking-[.35em] text-slate-900">{family.code}</span>
        <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-800"><Copy className="h-4 w-4" />{copied ? "Copied" : "Copy"}</span>
      </button>
      <ul className="mt-5 divide-y divide-slate-100">
        {family.members.map((m) => <li key={m.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
          <span className="min-w-0 truncate font-semibold text-slate-800">{m.name}{m.id === meId ? " (you)" : ""}{m.owner ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Started it</span> : null}</span>
          {family.owner && m.id !== meId && <button onClick={() => void call("/remove", { userId: m.id })} className="rounded-lg px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50" data-testid={`family-remove-${m.id}`}>Remove</button>}
        </li>)}
      </ul>
      {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
      {family.owner && others > 0
        ? <p className="mt-5 text-xs text-slate-500">You started this family. To leave it, remove everyone else first.</p>
        : !leaving
          ? <button onClick={() => setLeaving(true)} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-rose-700" data-testid="family-leave"><LogOut className="h-4 w-4" /> {family.owner ? "Delete this FamilyHub" : "Leave this family"}</button>
          : <div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">
              <p className="font-semibold">{family.owner ? "This deletes the family's shared hub for good." : "You'll stop seeing this family's hub. Your LifeHub isn't touched."}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setLeaving(false)} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-white px-3 font-bold text-slate-700 ring-1 ring-slate-200"><ArrowLeft className="h-4 w-4" /> Keep it</button>
                <button onClick={() => void call("/leave", {}).then((ok) => { if (ok) onClose(); })} className="min-h-10 rounded-xl bg-rose-700 px-4 font-bold text-white" data-testid="family-leave-confirm">{family.owner ? "Delete" : "Leave"}</button>
              </div>
            </div>}
    </div>
  </div>;
}
