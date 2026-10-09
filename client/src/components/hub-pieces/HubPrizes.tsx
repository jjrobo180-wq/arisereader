// Prizes built from the hub's own parts. Same rules as the site's PrizeManager and PrizeBoard:
// a parent's prizes are for their children, a teacher's for their class or school, and the
// grown-up hands the prize over. The board lists what a child can win from class and school.
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Gift, Home, School, Trash2, Trophy, Undo2, Users } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { PRIZE_LIMITS, prettyDay, type Prize, type PrizeScope, type PrizeView } from "@shared/prizes";
import { Meter, Pill, kit, type Which } from "./kit";

type Person = { id: number; name: string };
type Owned = Prize & { state: "open" | "ended" | "given"; forWho: string; progress?: Array<Person & { passed: number }> };
type Mine = { prizes: Owned[]; children: Person[]; school: { id: number; name: string } | null };
type Candidate = Person & { passed: number | null };
const BLANK = { title: "", how: "", quizGoal: "", endsOn: "" };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const WHERE: Record<PrizeScope, { label: string; icon: ReactNode }> = {
  family: { label: "Home", icon: <Home className="h-4 w-4" /> }, class: { label: "Class", icon: <Users className="h-4 w-4" /> }, school: { label: "School", icon: <School className="h-4 w-4" /> },
};

function Progress({ which, passed, goal }: { which: Which; passed: number; goal: number }) {
  const shown = Math.min(passed, goal);
  return <div className="mt-2"><Meter which={which} value={shown} max={goal} /><p className={`mt-1 ${kit(which).small}`}><b className="text-slate-800">{shown} of {goal}</b> {goal === 1 ? "quiz" : "quizzes"} passed</p></div>;
}

export function HubPrizeManager({ which, token, role }: { which: Which; token: string | null | undefined; role: "parent" | "teacher" }) {
  const k = kit(which);
  const [mine, setMine] = useState<Mine | null>(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(BLANK);
  const [scope, setScope] = useState<PrizeScope>("class");
  const [forKids, setForKids] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [giving, setGiving] = useState<{ id: string; people: Candidate[] | null; filter: string } | null>(null);
  const [busyId, setBusyId] = useState("");
  const isParent = role === "parent";

  const call = useCallback(async (path: string, method = "GET", body?: unknown) => {
    const res = await fetch(`${API_BASE}${path}`, { method, cache: "no-store", headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || "That didn't work. Try again.");
    if (!data || typeof data !== "object") throw new Error("That didn't work. Try again.");
    if ("prizes" in data && !Array.isArray(data.prizes)) data.prizes = [];
    if ("prizes" in data && !Array.isArray(data.children)) data.children = [];
    return data;
  }, [token]);
  useEffect(() => {
    if (!token) return;
    let alive = true;
    call("/api/prizes/mine").then((d) => { if (alive) { setMine(d); setLoadError(""); } }).catch((e) => { if (alive) setLoadError(e.message); });
    return () => { alive = false; };
  }, [token, call]);

  const children = mine?.children || [];
  const allKids = useMemo(() => children.map((c) => c.id), [children]);
  const picked = forKids ?? allKids;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setMessage(null);
    try {
      const d = await call("/api/prizes", "POST", { title: form.title, how: form.how, quizGoal: form.quizGoal, endsOn: form.endsOn, ...(isParent ? { studentIds: picked } : { scope }) });
      setMine(d); setForm(BLANK);
      setMessage({ text: `"${d.prize.title}" is up. ${isParent ? "Your child" : "Your students"} can see it now.`, bad: false });
    } catch (err: any) { setMessage({ text: err.message, bad: true }); }
    finally { setSaving(false); }
  };
  const act = async (id: string, work: () => Promise<Mine>) => {
    setBusyId(id); setMessage(null);
    try { setMine(await work()); setGiving(null); } catch (err: any) { setMessage({ text: err.message, bad: true }); } finally { setBusyId(""); }
  };
  const remove = (p: Owned) => { if (window.confirm(`Remove "${p.title}"? Readers will stop seeing it.`)) void act(p.id, () => call(`/api/prizes/${p.id}`, "DELETE")); };
  const give = (p: Owned, to: { studentId: number } | { everyone: true } | { undo: true }) => act(p.id, () => call(`/api/prizes/${p.id}/give`, "POST", to));
  const openGive = async (p: Owned) => {
    setGiving({ id: p.id, people: null, filter: "" });
    try { const d = await call(`/api/prizes/${p.id}/people`); setGiving((g) => (g && g.id === p.id ? { ...g, people: d.people || [] } : g)); }
    catch (err: any) { setGiving(null); setMessage({ text: err.message, bad: true }); }
  };
  const everyone = (p: Owned, people: Candidate[]) => people.length < 2 ? "" : p.scope === "family" ? (people.length === 2 ? "Both of them" : "All of them") : p.scope === "class" ? "The whole class" : "The whole school";

  if (!token) return null;
  if (loadError) return <p role="alert" className={k.bad}>{loadError}</p>;
  if (!mine) return <p className={k.small}>Loading prizes…</p>;
  const noKids = isParent && !children.length;

  return <div className="space-y-4" data-testid="hub-prize-manager">
    <p className={k.text}>{isParent ? "Put up a prize for your child. They see it on their rewards page, and you hand it over yourself."
      : "Put up a prize for your class or your whole school. Students see it on their rewards page and beside the leaderboards. You hand it over yourself."}</p>

    {noKids ? <p className={k.empty}>Connect your child first. Then you can add a prize for them here.</p> : <form onSubmit={add} className={`${k.soft} grid gap-3 sm:grid-cols-2`}>
      <label className="block"><span className={k.label}>Prize</span><input className={k.input} value={form.title} maxLength={PRIZE_LIMITS.title} required placeholder={isParent ? "Pizza night" : "Homework pass"} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="input-prize-title" /></label>
      <label className="block"><span className={k.label}>Last day to win it (optional)</span><input type="date" className={k.input} value={form.endsOn} min={today()} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} data-testid="input-prize-ends" /></label>
      <label className="block sm:col-span-2"><span className={k.label}>How to win it</span><textarea rows={2} className={k.input + " py-2"} value={form.how} maxLength={PRIZE_LIMITS.how} placeholder={isParent ? "Finish your book and pass the quiz" : "Top of the class leaderboard on Friday"} onChange={(e) => setForm({ ...form, how: e.target.value })} data-testid="input-prize-how" /></label>
      <label className="block"><span className={k.label}>Quizzes to pass (optional)</span><input type="number" inputMode="numeric" min={1} max={PRIZE_LIMITS.quizGoal} className={k.input} value={form.quizGoal} placeholder="5" onChange={(e) => setForm({ ...form, quizGoal: e.target.value })} data-testid="input-prize-goal" /><span className={`mt-1 block ${k.small}`}>Counted from today. The reader sees a progress bar.</span></label>
      {isParent && children.length > 1 && <fieldset><legend className={k.label}>For</legend><div className="flex flex-wrap gap-2">{children.map((c) => { const on = picked.includes(c.id); return <button key={c.id} type="button" aria-pressed={on} onClick={() => setForKids(on ? picked.filter((id) => id !== c.id) : [...picked, c.id])} className={`${k.segBtn} min-h-10 border ${on ? (which === "work" ? "border-slate-950 bg-slate-950 text-white" : "border-[#6e5ae0] bg-[#6e5ae0] text-white") : "border-slate-200 bg-white text-slate-600"}`}>{c.name}</button>; })}</div></fieldset>}
      {!isParent && <fieldset><legend className={k.label}>For</legend><div className="flex flex-wrap gap-2">
        {([["class", "My class"], ...(mine.school ? [["school", `Everyone at ${mine.school.name}`]] : [])] as [PrizeScope, string][]).map(([id, label]) =>
          <button key={id} type="button" aria-pressed={scope === id} onClick={() => setScope(id)} className={`${k.segBtn} min-h-10 border ${scope === id ? (which === "work" ? "border-slate-950 bg-slate-950 text-white" : "border-[#6e5ae0] bg-[#6e5ae0] text-white") : "border-slate-200 bg-white text-slate-600"}`}>{label}</button>)}
      </div></fieldset>}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><button type="submit" className={k.accent} disabled={saving || (isParent && !picked.length)} data-testid="button-add-prize"><Gift className="h-4 w-4" /> {saving ? "Adding…" : "Add prize"}</button>{isParent && !picked.length && <span className={k.small}>Pick at least one child.</span>}</div>
    </form>}

    {message && <p className={message.bad ? k.bad : k.ok} role={message.bad ? "alert" : "status"}>{message.text}</p>}

    {mine.prizes.length > 0 && <ul className="grid gap-3 lg:grid-cols-2">{mine.prizes.map((p) => {
      const busy = busyId === p.id, open = giving?.id === p.id ? giving : null;
      const people = open?.people?.filter((c) => c.name.toLowerCase().includes(open.filter.trim().toLowerCase())) || [];
      return <li key={p.id} className={`${p.state === "given" ? k.rowGood : k.row} space-y-2`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><p className={k.h}>{p.title}</p><p className={k.small}>For {p.forWho}{p.state === "open" && p.endsOn ? `, until ${prettyDay(p.endsOn)}` : ""}</p></div>
          {p.state === "given" ? <Pill which={which} tone="green">Given to {p.won?.name}</Pill> : p.state === "ended" ? <Pill which={which} tone="slate">Ended {prettyDay(p.endsOn)}</Pill> : <Pill which={which} tone="brand">{WHERE[p.scope].label}</Pill>}
        </div>
        {p.how && <p className={k.text}>{p.how}</p>}
        {p.quizGoal > 0 && !p.progress && <p className={k.small}>Goal: pass {p.quizGoal} {p.quizGoal === 1 ? "quiz" : "quizzes"}</p>}
        {p.quizGoal > 0 && p.progress && p.state !== "given" && (p.progress.length === 1 ? <Progress which={which} passed={p.progress[0].passed} goal={p.quizGoal} />
          : <div className="flex flex-wrap gap-1.5">{p.progress.map((c) => <Pill key={c.id} which={which} tone={c.passed >= p.quizGoal ? "green" : "slate"}>{c.name}: {Math.min(c.passed, p.quizGoal)} of {p.quizGoal}</Pill>)}</div>)}
        {open ? <div className={`${k.soft} space-y-2`}>
          <p className={k.h}>Who gets "{p.title}"?</p>
          {!open.people ? <p className={k.small}>Loading names…</p> : <>
            {open.people.length > 12 && <input type="search" placeholder="Find a name" aria-label="Find a name" className={k.input} value={open.filter} onChange={(e) => setGiving({ ...open, filter: e.target.value })} />}
            {open.people.length === 0 && <p className={k.small}>{p.scope === "class" ? "No students are in your class yet." : "No readers to pick from yet."}</p>}
            <div className="flex flex-wrap gap-1.5">{people.map((c) => {
              const there = c.passed !== null && p.quizGoal > 0 && c.passed >= p.quizGoal;
              return <button key={c.id} type="button" disabled={busy} onClick={() => void give(p, { studentId: c.id })} className={there ? k.accent : k.ghost}>{c.name}{c.passed !== null && <span className="text-xs opacity-75">{Math.min(c.passed, p.quizGoal)}/{p.quizGoal}</span>}</button>;
            })}</div>
          </>}
          <div className="flex flex-wrap gap-2">
            {open.people && everyone(p, open.people) && <button type="button" className={k.primary} disabled={busy} onClick={() => void give(p, { everyone: true })}>{everyone(p, open.people)}</button>}
            <button type="button" className={k.ghost} onClick={() => setGiving(null)}>Cancel</button>
          </div>
        </div> : <div className="flex flex-wrap gap-2">
          {p.state === "given" ? <button type="button" className={k.ghost} disabled={busy} onClick={() => void give(p, { undo: true })}><Undo2 className="h-4 w-4" /> Take it back</button>
            : <button type="button" className={k.accent} disabled={busy} onClick={() => void openGive(p)} data-testid="button-give-prize"><Gift className="h-4 w-4" /> Give prize</button>}
          <button type="button" className={k.ghost} disabled={busy} onClick={() => remove(p)} data-testid="button-remove-prize"><Trash2 className="h-4 w-4" /> Remove</button>
        </div>}
      </li>;
    })}</ul>}
  </div>;
}

/** What a child can win from their class and school (a parent's view). Nothing shows when there's nothing. */
export function HubPrizeBoard({ which, token, studentId, childName, scopes, emptyHint }: { which: Which; token: string | null | undefined; studentId: number; childName: string; scopes?: PrizeScope[]; emptyHint?: string }) {
  const k = kit(which);
  const [prizes, setPrizes] = useState<PrizeView[] | null>(null);
  useEffect(() => {
    if (!token) { setPrizes(null); return; }
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/prizes?studentId=${studentId}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const d = res.ok ? await res.json() : null;
        if (alive) setPrizes(Array.isArray(d?.prizes) ? d.prizes : []);
      } catch { if (alive) setPrizes([]); }
    };
    void load();
    window.addEventListener("arise-points-updated", load);
    return () => { alive = false; window.removeEventListener("arise-points-updated", load); };
  }, [token, studentId]);
  if (!token || !prizes) return <p className={k.small}>Loading…</p>;
  const shown = prizes.filter((p) => !scopes || scopes.includes(p.scope));
  if (!shown.length) return <p className={k.empty}>{emptyHint || `Nothing up for ${childName} at school right now.`}</p>;
  return <ul className="grid gap-3" data-testid="hub-prize-board">{shown.map((p) => {
    const giver = p.by || p.from;
    const line = p.state === "yours" ? `${childName} won this.` : p.state === "won" ? `Won by ${p.winner || "another reader"}.` : p.state === "reached" ? `${childName} reached the goal.` : p.state === "ended" ? `The last day has passed. ${giver} decides who gets it.` : p.endsOn ? `Last day: ${prettyDay(p.endsOn)}` : "";
    return <li key={p.id} className={`${p.state === "yours" || p.state === "reached" ? k.rowGood : k.row} space-y-1`}>
      <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className={k.h}>{p.title}</p><p className={k.small}>From {p.from}</p></div>
        <Pill which={which} tone={p.state === "yours" ? "green" : "brand"}>{p.state === "yours" ? <><Trophy className="mr-1 h-3.5 w-3.5" />Won</> : WHERE[p.scope].label}</Pill></div>
      {p.how && <p className={k.text}>{p.how}</p>}
      {p.quizGoal > 0 && p.state !== "won" && p.state !== "yours" && <Progress which={which} passed={p.passed ?? 0} goal={p.quizGoal} />}
      {line && <p className={k.small}>{line}</p>}
    </li>;
  })}</ul>;
}
