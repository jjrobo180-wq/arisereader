// "Reading challenges" in the admin (Nov 25, 2026): make a challenge (dates, schools, how many win and what they win),
// choose how it looks with a live preview, and see its leaderboard. Students and parents at those schools see it on
// the leaderboards and the library, the same way the Top Reader Challenge works (shared/topReader.ts, server/topReader.ts).
import { useCallback, useEffect, useState } from "react";
import { Eye, Loader2, Plus, Save, Trash2, Trophy } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { TopReaderCard } from "@/components/TopReader";
import { DEFAULT_LOOK, LOOK_PRESETS, type TopReaderChallenge, type TopReaderPhase, type TopReaderView } from "@shared/topReader";

type Row = TopReaderChallenge & { phase?: TopReaderPhase };
const field = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400";
const label = "mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500";
const PHASE: Record<TopReaderPhase, [string, string]> = { soon: ["Starts soon", "bg-sky-100 text-sky-800"], live: ["Running", "bg-emerald-100 text-emerald-800"], over: ["Over, showing winners", "bg-amber-100 text-amber-800"], done: ["Finished", "bg-slate-100 text-slate-600"] };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const plus = (day: string, n: number) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** A made-up board for the look preview. */
const sampleView = (c: TopReaderChallenge): TopReaderView => ({
  challenge: { ...c, phase: "live", daysLeft: 3, firstDay: false, endMs: Date.now() + 3 * 86_400_000 },
  standings: [{ rank: 1, name: "M. R.", grade: "7", points: 420, passed: 6 }, { rank: 2, name: "J. T.", grade: "6", points: 380, passed: 5 }, { rank: 3, name: "A. K.", grade: "8", points: 250, passed: 4 }, { rank: 4, name: "Sam Lee", grade: "7", points: 190, passed: 3, id: 1 } as any],
  racers: 24, mine: { name: "Sam Lee", rank: 4, points: 190, passed: 3 },
});

export default function AdminChallenges({ token }: { token: string | null }) {
  const [list, setList] = useState<Row[] | null>(null);
  const [schools, setSchools] = useState<{ id: number; name: string }[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [board, setBoard] = useState<{ id: string; view: TopReaderView | null } | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const auth: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const load = useCallback(async () => {
    const r = await fetch(`${API_BASE}/api/admin/reader-challenges`, { headers: auth });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg({ ok: false, text: b?.message || "Couldn't load the challenges." }); return; }
    setList(b.challenges); setSchools(b.schools);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);

  const edit = (id: string, p: Partial<Row>) => setList((l) => (l ?? []).map((c) => (c.id === id ? { ...c, ...p } : c)));
  const add = () => {
    const s = today(), id = `challenge-${Date.now().toString(36)}`;
    setList((l) => [...(l ?? []), { id, title: "Reading Challenge", starts: s, lastDay: plus(s, 7), prizeDay: plus(s, 8), showUntil: plus(s, 11), winners: 3, prize: "a prize", schoolIds: [], on: true, look: DEFAULT_LOOK }]);
    setOpen(id);
  };
  const save = async () => {
    setBusy("save"); setMsg(null);
    try {
      const r = await fetch(`${API_BASE}/api/admin/reader-challenges`, { method: "PUT", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ challenges: list }) });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b?.message || "Couldn't save.");
      setList(b.challenges); setMsg({ ok: true, text: "Saved. Students and parents see the changes now." });
    } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(""); }
  };
  const showBoard = async (c: Row) => {
    if (board?.id === c.id) { setBoard(null); return; }
    setBoard({ id: c.id, view: null });
    const r = await fetch(`${API_BASE}/api/top-reader?challenge=${encodeURIComponent(c.id)}`, { headers: auth });
    const b = await r.json().catch(() => null);
    setBoard({ id: c.id, view: r.ok ? b : null });
  };
  const schoolName = (id: number) => schools.find((s) => s.id === id)?.name.replace(/\s*\(.*\)$/, "") ?? `School ${id}`;

  if (!list) return <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading challenges…</p>;
  return <div className="space-y-4" data-testid="admin-challenges">
    <p className="text-sm text-slate-600">Each challenge counts reading points between its first and last day. The students with the most points win. Students and parents at its schools see it on the leaderboards, and other children show by initials. Save after changes.</p>
    {list.length === 0 && <p className="text-sm text-slate-500">No challenges yet.</p>}
    {list.map((c) => { const ph = PHASE[c.phase ?? "soon"]; const isOpen = open === c.id; return <div key={c.id} className="rounded-2xl border border-slate-200 bg-white" data-testid={`admin-challenge-${c.id}`}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: c.look?.background ?? DEFAULT_LOOK.background, color: c.look?.accent ?? DEFAULT_LOOK.accent }}><Trophy className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-slate-900">{c.title}{c.on === false && <span className="ml-2 text-xs font-semibold text-slate-400">Off</span>}</p>
          <p className="truncate text-xs text-slate-500">{c.starts} to {c.lastDay} · top {c.winners} win {c.prize} · {c.schoolIds?.length ? c.schoolIds.map(schoolName).join(", ") : "Every school"}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ph[1]}`}>{ph[0]}</span>
        <button type="button" onClick={() => void showBoard(c)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700" data-testid={`admin-challenge-board-${c.id}`}><Eye className="h-4 w-4" />Leaderboard</button>
        <button type="button" onClick={() => setOpen(isOpen ? null : c.id)} className="min-h-9 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white">{isOpen ? "Close" : "Edit"}</button>
      </div>
      {board?.id === c.id && <div className="border-t border-slate-100 p-4">
        {board.view === null ? <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading the leaderboard…</p>
          : board.view?.challenge ? <TopReaderCard view={board.view} /> : <p className="text-sm text-slate-500">Nothing to show yet. Save it first, or check its schools and dates.</p>}
        {board.view?.challenge && <p className="mt-2 text-xs text-slate-500">You see everyone's full names. Students and parents see the top 10, with other children by initials.</p>}
      </div>}
      {isOpen && <div className="grid gap-5 border-t border-slate-100 p-4 lg:grid-cols-[1fr_minmax(0,24rem)]">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className={label}>Name</span><input value={c.title} onChange={(e) => edit(c.id, { title: e.target.value })} className={field} /></label>
            <label><span className={label}>Prize</span><input value={c.prize} onChange={(e) => edit(c.id, { prize: e.target.value })} placeholder="a $5 gift card" className={field} /></label>
            <label><span className={label}>First day</span><input type="date" value={c.starts} onChange={(e) => edit(c.id, { starts: e.target.value })} className={field} /></label>
            <label><span className={label}>Last day</span><input type="date" value={c.lastDay} onChange={(e) => edit(c.id, { lastDay: e.target.value })} className={field} /></label>
            <label><span className={label}>Prizes given</span><input type="date" value={c.prizeDay} onChange={(e) => edit(c.id, { prizeDay: e.target.value })} className={field} /></label>
            <label><span className={label}>Show winners until</span><input type="date" value={c.showUntil} onChange={(e) => edit(c.id, { showUntil: e.target.value })} className={field} /></label>
            <label><span className={label}>How many win</span><input type="number" min={1} max={50} value={c.winners} onChange={(e) => edit(c.id, { winners: Number(e.target.value) })} className={field} /></label>
            <label className="flex items-end gap-2 pb-2"><input type="checkbox" checked={c.on !== false} onChange={(e) => edit(c.id, { on: e.target.checked })} className="h-5 w-5" /><span className="text-sm font-semibold text-slate-700">On (students and parents see it)</span></label>
          </div>
          <div><span className={label}>Schools</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => edit(c.id, { schoolIds: [] })} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${!c.schoolIds?.length ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-700"}`}>Every school</button>
              {schools.map((s) => { const on = !!c.schoolIds?.includes(s.id); return <button key={s.id} type="button" onClick={() => edit(c.id, { schoolIds: on ? c.schoolIds!.filter((x) => x !== s.id) : [...(c.schoolIds ?? []), s.id] })}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${on ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-700"}`}>{schoolName(s.id)}</button>; })}
            </div>
          </div>
          <div><span className={label}>Look</span>
            <div className="mb-2 flex flex-wrap gap-2">{LOOK_PRESETS.map((p) => { const on = c.look?.accent === p.look.accent && c.look?.background === p.look.background; return <button key={p.name} type="button" onClick={() => edit(c.id, { look: { ...p.look, ...(c.look?.headline ? { headline: c.look.headline } : {}) } })}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-2 ${on ? "ring-violet-500" : "ring-transparent"}`} style={{ background: p.look.background, color: p.look.accent }}>{p.name}</button>; })}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="color" value={c.look?.accent ?? DEFAULT_LOOK.accent} onChange={(e) => edit(c.id, { look: { ...(c.look ?? DEFAULT_LOOK), accent: e.target.value } })} className="h-9 w-12 rounded" />Accent colour</label>
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="color" value={c.look?.background ?? DEFAULT_LOOK.background} onChange={(e) => edit(c.id, { look: { ...(c.look ?? DEFAULT_LOOK), background: e.target.value } })} className="h-9 w-12 rounded" />Background</label>
            </div>
            <label className="mt-3 block"><span className={label}>Headline (optional)</span><input value={c.look?.headline ?? ""} onChange={(e) => edit(c.id, { look: { ...(c.look ?? DEFAULT_LOOK), headline: e.target.value } })} placeholder={`Read the most, win ${c.prize}.`} className={field} /></label>
          </div>
          <button type="button" onClick={() => { setList((l) => (l ?? []).filter((x) => x.id !== c.id)); setOpen(null); }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600"><Trash2 className="h-4 w-4" />Delete this challenge</button>
        </div>
        <div><span className={label}>Preview</span><TopReaderCard view={sampleView(c)} /></div>
      </div>}
    </div>; })}
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={add} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700" data-testid="admin-challenge-add"><Plus className="h-4 w-4" />New challenge</button>
      <button type="button" onClick={() => void save()} disabled={busy === "save"} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white disabled:opacity-50" data-testid="admin-challenge-save">{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save challenges</button>
      {msg && <span className={`text-sm font-semibold ${msg.ok ? "text-emerald-700" : "text-rose-700"}`} role="status">{msg.text}</span>}
    </div>
  </div>;
}
