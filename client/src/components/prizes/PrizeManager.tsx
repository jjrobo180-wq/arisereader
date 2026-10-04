// Where a parent or a teacher puts up prizes and hands them out.
// A parent's prizes are for their own children. A teacher's are for their
// class or their whole school. The grown-up gives the prize themself.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Gift, Trash2, Undo2 } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { PRIZE_LIMITS, prettyDay, type Prize, type PrizeScope } from "@shared/prizes";
import { QuizProgress, Ticket } from "./PrizeBoard";
import "./prizes.css";

type Person = { id: number; name: string };
type Owned = Prize & { state: "open" | "ended" | "given"; forWho: string; progress?: Array<Person & { passed: number }> };
type Mine = { role: "parent" | "teacher"; prizes: Owned[]; children: Person[]; school: { id: number; name: string } | null };
type Candidate = Person & { passed: number | null };

const BLANK = { title: "", how: "", quizGoal: "", endsOn: "" };
/** Today as YYYY-MM-DD on this device, for the date picker's earliest day. */
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function PrizeManager({ token, role }: { token: string | null | undefined; role: "parent" | "teacher" }) {
  const [mine, setMine] = useState<Mine | null>(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(BLANK);
  const [scope, setScope] = useState<PrizeScope>("class");
  const [forKids, setForKids] = useState<number[] | null>(null); // null = all of them
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [giving, setGiving] = useState<{ id: string; people: Candidate[] | null; filter: string } | null>(null);
  const [busyId, setBusyId] = useState("");

  const call = useCallback(async (path: string, method = "GET", body?: unknown) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method, cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "That didn't work. Try again.");
    return data;
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    call("/api/prizes/mine")
      .then((data) => { if (alive) { setMine(data); setLoadError(""); } })
      .catch((e) => { if (alive) setLoadError(e.message); });
    return () => { alive = false; };
  }, [token, call]);

  const children = mine?.children || [];
  const isParent = role === "parent";
  const allKids = useMemo(() => children.map((c) => c.id), [children]);
  const picked = forKids ?? allKids;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const data = await call("/api/prizes", "POST", {
        title: form.title, how: form.how, quizGoal: form.quizGoal, endsOn: form.endsOn,
        ...(isParent ? { studentIds: picked } : { scope }),
      });
      setMine(data);
      setForm(BLANK);
      setMessage({ text: `“${data.prize.title}” is up. ${isParent ? "Your child" : "Your students"} can see it now.`, bad: false });
    } catch (err: any) {
      setMessage({ text: err.message, bad: true });
    } finally { setSaving(false); }
  };

  const act = async (id: string, run: () => Promise<Mine>) => {
    setBusyId(id);
    setMessage(null);
    try { setMine(await run()); setGiving(null); }
    catch (err: any) { setMessage({ text: err.message, bad: true }); }
    finally { setBusyId(""); }
  };
  const remove = (p: Owned) => {
    if (!window.confirm(`Remove “${p.title}”? Readers will stop seeing it.`)) return;
    void act(p.id, () => call(`/api/prizes/${p.id}`, "DELETE"));
  };
  const give = (p: Owned, to: { studentId: number } | { everyone: true } | { undo: true }) => act(p.id, () => call(`/api/prizes/${p.id}/give`, "POST", to));
  const openGive = async (p: Owned) => {
    setGiving({ id: p.id, people: null, filter: "" });
    try {
      const data = await call(`/api/prizes/${p.id}/people`);
      setGiving((g) => (g && g.id === p.id ? { ...g, people: data.people || [] } : g));
    } catch (err: any) {
      setGiving(null);
      setMessage({ text: err.message, bad: true });
    }
  };

  if (!token) return null;
  if (loadError) return <div className="pz"><p className="pz-msg bad" role="alert">{loadError}</p></div>;
  if (!mine) return <div className="pz"><p className="pz-empty">Loading prizes…</p></div>;

  const noKids = isParent && !children.length;
  /** The button that gives a prize to everyone it was for. A prize for one child has no such button. */
  const everyoneLabel = (p: Owned, people: Candidate[]) =>
    people.length < 2 ? "" : p.scope === "family" ? (people.length === 2 ? "Both of them" : "All of them") : p.scope === "class" ? "The whole class" : "The whole school";

  return (
    <section className="pz" aria-label="Prizes" data-testid="prize-manager">
      <div className="pz-head">
        <h3>Prizes</h3>
      </div>
      <p className="pz-lede">
        {isParent
          ? "Put up a prize for your child. They see it on their rewards page, and you hand it over yourself."
          : "Put up a prize for your class or your whole school. Students see it on their rewards page and beside the leaderboards. You hand it over yourself."}
      </p>

      {noKids ? (
        <p className="pz-msg">Connect your child first. Then you can add a prize for them here.</p>
      ) : (
        <form className="pz-form" onSubmit={add}>
          <label className="pz-field">
            <span>Prize</span>
            <input type="text" value={form.title} maxLength={PRIZE_LIMITS.title} required placeholder={isParent ? "Pizza night" : "Homework pass"}
              onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="input-prize-title" />
          </label>
          <label className="pz-field">
            <span>Last day to win it (optional)</span>
            <input type="date" value={form.endsOn} min={localToday()} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} data-testid="input-prize-ends" />
          </label>
          <label className="pz-field full">
            <span>How to win it</span>
            <textarea value={form.how} maxLength={PRIZE_LIMITS.how} placeholder={isParent ? "Finish your book and pass the quiz" : "Top of the class leaderboard on Friday"}
              onChange={(e) => setForm({ ...form, how: e.target.value })} data-testid="input-prize-how" />
          </label>
          <label className="pz-field">
            <span>Quizzes to pass (optional)</span>
            <input type="number" inputMode="numeric" min={1} max={PRIZE_LIMITS.quizGoal} value={form.quizGoal} placeholder="5"
              onChange={(e) => setForm({ ...form, quizGoal: e.target.value })} data-testid="input-prize-goal" />
            <small>Counted from today. The reader sees a progress bar.</small>
          </label>

          {isParent && children.length > 1 && (
            <fieldset className="pz-field">
              <legend>For</legend>
              <div className="pz-choices">
                {children.map((c) => (
                  <label key={c.id} className="pz-choice">
                    <input type="checkbox" checked={picked.includes(c.id)}
                      onChange={(e) => setForKids(e.target.checked ? [...picked, c.id] : picked.filter((id) => id !== c.id))} />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {!isParent && (
            <fieldset className="pz-field">
              <legend>For</legend>
              <div className="pz-choices">
                <label className="pz-choice">
                  <input type="radio" name="pz-scope" checked={scope === "class"} onChange={() => setScope("class")} />
                  <span>My class</span>
                </label>
                {mine.school && (
                  <label className="pz-choice">
                    <input type="radio" name="pz-scope" checked={scope === "school"} onChange={() => setScope("school")} />
                    <span>Everyone at {mine.school.name}</span>
                  </label>
                )}
              </div>
            </fieldset>
          )}

          <div className="pz-field full pz-row">
            <button type="submit" className="pz-btn gold" disabled={saving || (isParent && !picked.length)} data-testid="button-add-prize">
              <Gift aria-hidden /> {saving ? "Adding…" : "Add prize"}
            </button>
            {isParent && !picked.length && <small>Pick at least one child.</small>}
          </div>
        </form>
      )}

      {message && <p className={`pz-msg ${message.bad ? "bad" : ""}`} role={message.bad ? "alert" : "status"}>{message.text}</p>}

      {mine.prizes.length > 0 && (
        <ul className="pz-list pz-wide">
          {mine.prizes.map((p) => {
            const busy = busyId === p.id;
            const open = giving?.id === p.id ? giving : null;
            const shownPeople = open?.people?.filter((c) => c.name.toLowerCase().includes(open.filter.trim().toLowerCase())) || [];
            return (
              <Ticket key={p.id} scope={p.scope} state={p.state} won={p.state === "given"}>
                {p.state === "given" && <span className="pz-stamp">Given to {p.won?.name}</span>}
                {p.state === "ended" && <span className="pz-stamp plain">Ended {prettyDay(p.endsOn)}</span>}
                <h4 className="pz-title">{p.title}</h4>
                <p className="pz-from">For {p.forWho}{p.state === "open" && p.endsOn ? `, until ${prettyDay(p.endsOn)}` : ""}</p>
                {p.how && <p className="pz-how">{p.how}</p>}
                {p.quizGoal > 0 && !p.progress && <p className="pz-note">Goal: pass {p.quizGoal} {p.quizGoal === 1 ? "quiz" : "quizzes"}</p>}
                {p.quizGoal > 0 && p.progress && p.state !== "given" && (
                  p.progress.length === 1
                    ? <QuizProgress passed={p.progress[0].passed} goal={p.quizGoal} />
                    : <div className="pz-kids">{p.progress.map((c) => (
                        <span key={c.id} className={`pz-kid ${c.passed >= p.quizGoal ? "there" : ""}`}>{c.name}: {Math.min(c.passed, p.quizGoal)} of {p.quizGoal}</span>
                      ))}</div>
                )}

                {open ? (
                  <div className="pz-give">
                    <p>Who gets “{p.title}”?</p>
                    {!open.people ? <p className="pz-empty">Loading names…</p> : (
                      <>
                        {open.people.length > 12 && (
                          <input type="search" placeholder="Find a name" aria-label="Find a name" value={open.filter}
                            onChange={(e) => setGiving({ ...open, filter: e.target.value })} />
                        )}
                        {open.people.length === 0 && <p className="pz-empty">{p.scope === "class" ? "No students are in your class yet." : "No readers to pick from yet."}</p>}
                        <div className="pz-people">
                          {shownPeople.map((c) => (
                            <button key={c.id} type="button" disabled={busy} onClick={() => give(p, { studentId: c.id })}
                              className={`pz-btn pz-person ${c.passed !== null && c.passed >= p.quizGoal && p.quizGoal > 0 ? "there" : ""}`}>
                              <span>{c.name}</span>
                              {c.passed !== null && <small>{Math.min(c.passed, p.quizGoal)} of {p.quizGoal}</small>}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <div className="pz-row">
                      {open.people && everyoneLabel(p, open.people) && (
                        <button type="button" className="pz-btn" disabled={busy} onClick={() => give(p, { everyone: true })}>{everyoneLabel(p, open.people)}</button>
                      )}
                      <button type="button" className="pz-btn quiet" onClick={() => setGiving(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="pz-row">
                    {p.state === "given"
                      ? <button type="button" className="pz-btn" disabled={busy} onClick={() => give(p, { undo: true })}><Undo2 aria-hidden /> Take it back</button>
                      : <button type="button" className="pz-btn gold" disabled={busy} onClick={() => openGive(p)} data-testid="button-give-prize"><Gift aria-hidden /> Give prize</button>}
                    <button type="button" className="pz-btn quiet" disabled={busy} onClick={() => remove(p)} data-testid="button-remove-prize"><Trash2 aria-hidden /> Remove</button>
                  </div>
                )}
              </Ticket>
            );
          })}
        </ul>
      )}
    </section>
  );
}
