// Play time (game minutes a day) built from the hub's own parts. Same rules as the site's
// PlayTimeManager: the general daily minutes (admins), requests for more time, and bonus minutes.
import { useEffect, useMemo, useState } from "react";
import { Check, Plus, RefreshCw, Search, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { Pill, kit, type Which } from "./kit";

type Row = { id: number; displayName: string; username: string; extraMinutes: number; totalMinutes: number; request: { status?: string; requestedMinutes?: number } | null };
type Data = { globalMinutes: number; students: Row[]; canSetGlobal: boolean };

export default function HubPlayTime({ which }: { which: Which }) {
  const { user, token } = useAuth();
  const k = kit(which);
  const [data, setData] = useState<Data | null>(null);
  const [general, setGeneral] = useState("10");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const adult = !!user && (user.isAdmin || user.role === "teacher" || user.role === "parent");

  const call = async (path: string, init: RequestInit = {}) => {
    const res = await fetch(`${API_BASE}${path}`, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "Something went wrong.");
    return body;
  };
  const load = async (quiet = false) => {
    if (!adult || !token) return;
    if (!quiet) setError("");
    try { const body = await call("/api/play-time/manage"); setData(body); setGeneral(String(body.globalMinutes || 10)); }
    catch (e) { if (!quiet) setError(e instanceof Error ? e.message : "Play time could not be loaded."); }
  };
  useEffect(() => {
    if (!adult || !token) return;
    void load();
    const t = window.setInterval(() => void load(true), 15000);
    return () => window.clearInterval(t);
  }, [user?.id, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (key: string, work: () => Promise<string>) => {
    setBusy(key); setError(""); setMessage("");
    try { setMessage(await work()); await load(true); } catch (e) { setError(e instanceof Error ? e.message : "That didn't work."); } finally { setBusy(""); }
  };
  const saveGeneral = () => run("general", async () => (await call("/api/admin/play-time/default", { method: "POST", body: JSON.stringify({ minutes: Math.max(1, Math.min(240, Math.round(Number(general) || 0))) }) })).message || "Daily play time updated.");
  const grant = (s: Row, minutes: number) => run(`g-${s.id}`, async () => `${s.displayName}: ${(await call(`/api/play-time/students/${s.id}/grant`, { method: "POST", body: JSON.stringify({ minutes }) })).message || "time added"}`);
  const deny = (s: Row) => run(`d-${s.id}`, async () => { await call(`/api/play-time/students/${s.id}/request-action`, { method: "POST", body: JSON.stringify({ action: "deny" }) }); return `${s.displayName}'s request was declined.`; });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase(), list = data?.students || [];
    const shown = q ? list.filter((s) => s.displayName.toLowerCase().includes(q) || s.username.toLowerCase().includes(q)) : list;
    return [...shown].sort((a, b) => Number(b.request?.status === "pending") - Number(a.request?.status === "pending"));
  }, [data, search]);
  const waiting = data?.students.filter((s) => s.request?.status === "pending").length || 0;
  if (!adult) return null;

  return <div className="space-y-4" data-testid="hub-play-time">
    <div className="flex flex-wrap items-center gap-2">
      <p className={k.text}>{data ? `Everyone starts each day with ${data.globalMinutes} minutes of games.` : "Loading play time…"}</p>
      {waiting > 0 && <Pill which={which} tone="amber">{waiting} asking for more</Pill>}
    </div>

    {data?.canSetGlobal && <div className={k.soft}>
      <p className={k.h}>Daily minutes for every student</p>
      <p className={`mt-1 ${k.small}`}>Every regular student starts the day with this. Bonus minutes are added on top, for today only.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input type="number" min={1} max={240} value={general} onChange={(e) => setGeneral(e.target.value)} aria-label="Minutes a day" className={k.input + " !w-24"} />
        <span className={k.small}>minutes a day</span>
        <button type="button" className={k.primary} disabled={busy === "general"} onClick={() => void saveGeneral()}>{busy === "general" ? "Saving…" : "Update everyone"}</button>
      </div>
    </div>}

    {error && <p role="alert" className={k.bad}>{error}</p>}
    {message && <p role="status" className={k.ok}>{message}</p>}

    {(data?.students.length || 0) > 5 && <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a student" aria-label="Find a student" className={k.input + " pl-9"} /></label>}

    {!data ? <p className={k.empty}><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading students…</p>
      : !rows.length ? <p className={k.empty}>No students found.</p>
      : <ul className="max-h-[520px] space-y-2 overflow-y-auto">{rows.map((s) => {
        const asking = s.request?.status === "pending";
        const ask = Math.max(5, Math.min(60, Number(s.request?.requestedMinutes) || 10));
        return <li key={s.id} className={`${asking ? k.rowWarn : k.row} flex flex-col gap-3 sm:flex-row sm:items-center`}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><span className={k.h}>{s.displayName}</span>{asking && <Pill which={which} tone="amber">Asking for {ask} more minutes</Pill>}</div>
            <p className={k.small}>@{s.username} · {s.totalMinutes} minutes today{s.extraMinutes > 0 ? ` (${data.globalMinutes} + ${s.extraMinutes} bonus)` : ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {asking && <>
              <button type="button" className={k.accent} disabled={busy === `g-${s.id}`} onClick={() => void grant(s, ask)}><Check className="h-4 w-4" /> Give {ask}</button>
              <button type="button" className={k.ghost} disabled={busy === `d-${s.id}`} onClick={() => void deny(s)}><X className="h-4 w-4" /> No</button>
            </>}
            {[5, 10, 15].map((m) => <button key={m} type="button" className={k.ghost} disabled={busy === `g-${s.id}`} onClick={() => void grant(s, m)} aria-label={`Give ${s.displayName} ${m} more minutes`}><Plus className="h-3.5 w-3.5" />{m}</button>)}
          </div>
        </li>;
      })}</ul>}
    <p className={k.small}>Bonus minutes are for today only. Passing a book quiz can still unlock unlimited games for the week when that rule is on.</p>
  </div>;
}
