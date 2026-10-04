// Study Squad: the study-set shelf. Browse the sets you can play, make a new
// one (write it, ask AI, or paste/upload a list), and for teachers, manage
// what the class can do and see what students have made.
import { useEffect, useMemo, useRef, useState } from "react";
import { SET_LIMITS, STUDY_GRADES, STUDY_SUBJECTS, parseStudyImport, type StudyItem, type StudyKind, type StudySet, type StudySetSummary } from "@shared/study/sets";
import type { Boot, StudyClient } from "./api";
import { IconClose, IconPlus, IconSpark, IconTrash } from "./icons";

type Props = {
  api: StudyClient; boot: Boot; sets: StudySetSummary[]; refresh: () => Promise<unknown>;
  onClose: () => void; say: (text: string) => void;
  /** When choosing a set for a table. */
  pick?: (id: string) => void;
  onFlashcards: (id: string) => void;
  onAiUsed: (left: number) => void;
  onRules: (rules: Boot["rules"]) => void;
};

const KIND_NAMES: Record<StudyKind, string> = { choice: "Multiple choice", truefalse: "True or false", typed: "Type the answer", card: "Flashcard" };
const byLine = (s: StudySetSummary) => (s.ownerRole === "starter" ? "Starter set" : s.mine ? "Made by you" : `By ${s.ownerName}`);

export default function SetShelf({ api, boot, sets, refresh, onClose, say, pick, onFlashcards, onAiUsed, onRules }: Props) {
  const [tab, setTab] = useState<"all" | "mine" | "class">("all");
  const [subject, setSubject] = useState("All");
  const [editing, setEditing] = useState<{ set: StudySet | null } | null>(null);
  const [busy, setBusy] = useState("");
  const canMake = boot.me.teacher || (boot.me.student && boot.rules.studentSets);
  const subjects = useMemo(() => ["All", ...STUDY_SUBJECTS.filter((s) => sets.some((x) => x.subject === s))], [sets]);
  const shown = sets.filter((s) => (tab === "mine" ? s.mine : true) && (subject === "All" || s.subject === subject));

  const edit = async (id: string) => {
    setBusy(id);
    try { setEditing({ set: (await api.set(id)).set }); } catch (e: any) { say(e.message); } finally { setBusy(""); }
  };
  const remove = async (s: StudySetSummary) => {
    if (!window.confirm(`Delete “${s.title}”? This can't be undone.`)) return;
    setBusy(s.id);
    try { await api.deleteSet(s.id); await refresh(); say("Set deleted."); } catch (e: any) { say(e.message); } finally { setBusy(""); }
  };

  if (editing) {
    return (
      <SetEditor
        api={api} boot={boot} initial={editing.set} say={say} onAiUsed={onAiUsed}
        onCancel={() => setEditing(null)}
        onSaved={async (saved) => { await refresh(); setEditing(null); setTab("mine"); say(`Saved “${saved.title}”.`); }}
      />
    );
  }

  return (
    <section className="sq-sheet" role="dialog" aria-label="Study sets">
      <div className="sq-slate">
        <header className="sq-slate-head">
          <h2>{pick ? "Pick a set for your table" : "Study sets"}</h2>
          <button type="button" className="sq-round sq-round-sm" onClick={onClose} aria-label="Close"><IconClose /></button>
        </header>

        <div className="sq-shelf-bar">
          <div className="sq-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "all"} onClick={() => setTab("all")}>All sets</button>
            <button type="button" role="tab" aria-selected={tab === "mine"} onClick={() => setTab("mine")}>Made by me</button>
            {boot.me.teacher && !pick && <button type="button" role="tab" aria-selected={tab === "class"} onClick={() => setTab("class")}>My class</button>}
          </div>
          {canMake && <button type="button" className="sq-btn sq-btn-main" onClick={() => setEditing({ set: null })}><IconPlus /> Make a set</button>}
        </div>
        {boot.me.student && !boot.rules.studentSets && <p className="sq-note">Your teacher has turned off student-made sets for your class. You can still play every set here.</p>}

        {tab === "class" ? <ClassTab api={api} say={say} onRules={onRules} onFlashcards={onFlashcards} /> : (
          <>
            {subjects.length > 2 && (
              <div className="sq-filter" role="group" aria-label="Subject">
                {subjects.map((s) => <button key={s} type="button" className="sq-opt" aria-pressed={subject === s} onClick={() => setSubject(s)}>{s}</button>)}
              </div>
            )}
            {shown.length === 0 ? (
              <p className="sq-note">{tab === "mine" ? (canMake ? "You haven't made a set yet. Choose “Make a set” to write one, ask AI, or paste a list." : "You haven't made any sets.") : "No sets for that subject yet."}</p>
            ) : (
              <ul className="sq-sets">
                {shown.map((s) => (
                  <li key={s.id} className="sq-card sq-set">
                    <div className="sq-set-text">
                      <b>{s.title}</b>
                      <span>{s.subject}{s.grade !== "Any" ? `, grades ${s.grade}` : ""}, {s.count} questions</span>
                      <small>{byLine(s)}{s.madeWith === "ai" ? ", made with AI" : ""}{s.mine && boot.me.teacher ? (s.shared ? ", shared with your class" : ", not shared yet") : ""}</small>
                    </div>
                    <div className="sq-set-btns">
                      {pick && <button type="button" className="sq-btn sq-btn-ink" onClick={() => pick(s.id)}>Use this set</button>}
                      <button type="button" className="sq-btn sq-btn-inkquiet" onClick={() => onFlashcards(s.id)}>Flashcards</button>
                      {s.mine && !pick && <button type="button" className="sq-btn sq-btn-inkquiet" disabled={busy === s.id} onClick={() => void edit(s.id)}>Edit</button>}
                      {s.mine && !pick && <button type="button" className="sq-icon-btn" disabled={busy === s.id} onClick={() => void remove(s)} aria-label={`Delete ${s.title}`}><IconTrash /></button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ─── Teachers: class rules and student-made sets ─────────────────────────────
function ClassTab({ api, say, onRules, onFlashcards }: { api: StudyClient; say: (t: string) => void; onRules: (r: Boot["rules"]) => void; onFlashcards: (id: string) => void }) {
  const [data, setData] = useState<{ rules: Boot["rules"]; sets: StudySetSummary[] } | null>(null);
  const [error, setError] = useState("");
  const load = () => api.klass().then(setData).catch((e) => setError(e.message));
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <p className="sq-note">{error}</p>;
  if (!data) return <p className="sq-note">Loading your class…</p>;
  const setRule = async (patch: Partial<Boot["rules"]>) => {
    const rules = { ...data.rules, ...patch };
    setData({ ...data, rules });
    try { const saved = await api.saveRules(rules); onRules(saved.rules); } catch (e: any) { say(e.message); void load(); }
  };
  const remove = async (s: StudySetSummary) => {
    if (!window.confirm(`Remove “${s.title}” by ${s.ownerName}? The student will no longer have it.`)) return;
    try { await api.removeClassSet(s.id); say("Set removed."); await load(); } catch (e: any) { say(e.message); }
  };
  return (
    <div className="sq-class">
      <p className="sq-note">Sets you make and share appear for your students under “All sets”. Students' own sets stay private to them and to the table they host; you can see every one here.</p>
      <label className="sq-switch"><input type="checkbox" checked={data.rules.studentSets} onChange={(e) => void setRule({ studentSets: e.target.checked })} /><span><b>Students can make their own sets</b><small>Typing questions or pasting a list. A word filter checks everything they write.</small></span></label>
      <label className="sq-switch"><input type="checkbox" checked={data.rules.studentAi && data.rules.studentSets} disabled={!data.rules.studentSets} onChange={(e) => void setRule({ studentAi: e.target.checked })} /><span><b>Students can ask AI to make a set</b><small>Up to 5 a day each. What a student types as the topic or notes is sent to the AI service.</small></span></label>
      <h3>Made by your students</h3>
      {data.sets.length === 0 ? <p className="sq-note">Nothing yet. Sets your students make will show up here.</p> : (
        <ul className="sq-sets">
          {data.sets.map((s) => (
            <li key={s.id} className="sq-card sq-set">
              <div className="sq-set-text"><b>{s.title}</b><span>{s.subject}, {s.count} questions</span><small>By {s.ownerName}{s.madeWith === "ai" ? ", made with AI" : ""}</small></div>
              <div className="sq-set-btns">
                <button type="button" className="sq-btn sq-btn-inkquiet" onClick={() => onFlashcards(s.id)}>Look through it</button>
                <button type="button" className="sq-icon-btn" onClick={() => void remove(s)} aria-label={`Remove ${s.title}`}><IconTrash /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Making or editing a set ─────────────────────────────────────────────────
type Row = { key: number; kind: StudyKind; prompt: string; answer: string; wrong: [string, string, string]; accept: string; explain: string };
let rowKey = 1;
const blankRow = (kind: StudyKind): Row => ({ key: rowKey++, kind, prompt: "", answer: kind === "truefalse" ? "True" : "", wrong: ["", "", ""], accept: "", explain: "" });
const toRow = (item: StudyItem): Row => ({
  key: rowKey++, kind: item.kind, prompt: item.prompt, answer: item.answer,
  wrong: item.kind === "choice" ? [item.wrong[0] ?? "", item.wrong[1] ?? "", item.wrong[2] ?? ""] : ["", "", ""],
  accept: item.kind === "typed" ? item.accept.join(", ") : "", explain: item.explain ?? "",
});
const fromRow = (r: Row) => ({
  kind: r.kind, prompt: r.prompt, answer: r.answer, explain: r.explain,
  ...(r.kind === "choice" ? { wrong: r.wrong.filter((w) => w.trim()) } : {}),
  ...(r.kind === "typed" ? { accept: r.accept.split(",").map((a) => a.trim()).filter(Boolean) } : {}),
});
const rowEmpty = (r: Row) => !r.prompt.trim() && (r.kind === "truefalse" || !r.answer.trim());

function SetEditor({ api, boot, initial, say, onAiUsed, onCancel, onSaved }: {
  api: StudyClient; boot: Boot; initial: StudySet | null; say: (t: string) => void; onAiUsed: (left: number) => void;
  onCancel: () => void; onSaved: (s: StudySetSummary) => void | Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subject, setSubject] = useState<string>(initial?.subject ?? "Other");
  const [grade, setGrade] = useState<string>(initial?.grade ?? "6-8");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [shared, setShared] = useState(initial?.shared ?? true);
  const [rows, setRows] = useState<Row[]>(() => (initial ? initial.items.map(toRow) : []));
  const [madeWith, setMadeWith] = useState<StudySet["madeWith"]>(initial?.madeWith ?? "hand");
  const [way, setWay] = useState<"write" | "ai" | "paste">("write");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // AI
  const aiAllowed = boot.ai.available && (boot.me.teacher || boot.rules.studentAi);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState(10);
  const [format, setFormat] = useState("mixed");
  const [thinking, setThinking] = useState(false);
  const [aiLeft, setAiLeft] = useState(boot.ai.left);
  // paste / upload
  const [pasted, setPasted] = useState("");
  const [importNote, setImportNote] = useState("");
  const listEnd = useRef<HTMLDivElement>(null);

  const room = SET_LIMITS.maxItems - rows.length;
  const update = (key: number, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = (items: StudyItem[]) => {
    const fresh = items.slice(0, Math.max(0, room)).map(toRow);
    setRows((list) => [...list.filter((r) => !rowEmpty(r)), ...fresh]);
    window.setTimeout(() => listEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 50);
    return fresh.length;
  };
  const addBlank = (kind: StudyKind) => { if (room > 0) { setRows((list) => [...list, blankRow(kind)]); window.setTimeout(() => listEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 50); } };

  const readFile = async (file: File | undefined, into: (text: string) => void) => {
    if (!file) return;
    if (file.size > 300_000) { setError("That file is too big. Use a text or CSV file under 300 KB."); return; }
    if (/\.(pdf|docx?|pptx?|xlsx?)$/i.test(file.name)) { setError("That kind of file can't be read here. Copy the text out of it and paste it in, or save it as .txt or .csv."); return; }
    setError("");
    into((await file.text()).replace(/\u0000/g, ""));
  };

  const generate = async () => {
    if (thinking) return;
    setThinking(true); setError("");
    try {
      const { draft, left } = await api.generate({ topic, notes, grade, count, format });
      setAiLeft(left); onAiUsed(left);
      const added = add(draft.items);
      if (!title.trim()) setTitle(String(draft.title || ""));
      if (subject === "Other" && draft.subject) setSubject(String(draft.subject));
      if (!description.trim() && draft.description) setDescription(String(draft.description));
      setMadeWith("ai");
      say(`The AI wrote ${added} questions. Read each one before you save.`);
      setWay("write");
    } catch (e: any) { setError(e.message); } finally { setThinking(false); }
  };

  const importText = () => {
    const { items, skipped } = parseStudyImport(pasted);
    if (!items.length) { setImportNote("Couldn't find any questions in that. Put each one on its own line, like: term - meaning"); return; }
    const added = add(items);
    if (madeWith === "hand" && rows.every(rowEmpty)) setMadeWith("import");
    setImportNote(`Added ${added} ${added === 1 ? "question" : "questions"}${skipped ? `, skipped ${skipped} ${skipped === 1 ? "line" : "lines"} that didn't fit` : ""}${items.length > added ? ". The set is full" : ""}.`);
    setPasted("");
  };

  const save = async () => {
    if (saving) return;
    setSaving(true); setError("");
    try {
      const items = rows.filter((r) => !rowEmpty(r)).map(fromRow);
      const { set } = await api.saveSet(initial?.id ?? null, { title, subject, grade, description, shared, items, madeWith });
      await onSaved(set);
    } catch (e: any) { setError(e.message); setSaving(false); }
  };

  const filled = rows.filter((r) => !rowEmpty(r)).length;
  return (
    <section className="sq-sheet" role="dialog" aria-label={initial ? "Edit study set" : "Make a study set"}>
      <div className="sq-slate sq-editor">
        <header className="sq-slate-head">
          <h2>{initial ? "Edit your set" : "Make a study set"}</h2>
          <button type="button" className="sq-round sq-round-sm" onClick={onCancel} aria-label="Close without saving"><IconClose /></button>
        </header>

        <div className="sq-fields">
          <label className="wide"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={SET_LIMITS.title[1]} placeholder="Chapter 4 vocabulary" /></label>
          <label><span>Subject</span><select value={subject} onChange={(e) => setSubject(e.target.value)}>{STUDY_SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label><span>Grades</span><select value={grade} onChange={(e) => setGrade(e.target.value)}>{STUDY_GRADES.map((g) => <option key={g}>{g}</option>)}</select></label>
          {boot.me.teacher && <label className="sq-check wide"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /><span>Share with my class</span></label>}
        </div>

        <div className="sq-ways">
          <div className="sq-tabs" role="tablist" aria-label="How to add questions">
            <button type="button" role="tab" aria-selected={way === "write"} onClick={() => setWay("write")}>Write them</button>
            <button type="button" role="tab" aria-selected={way === "ai"} onClick={() => setWay("ai")}><IconSpark /> Ask AI</button>
            <button type="button" role="tab" aria-selected={way === "paste"} onClick={() => setWay("paste")}>Paste or upload</button>
          </div>

          {way === "write" && (
            <div className="sq-way">
              <p>Add a question in any of these formats. You can mix them in one set.</p>
              <div className="sq-addrow">
                {(Object.keys(KIND_NAMES) as StudyKind[]).map((k) => <button key={k} type="button" className="sq-btn" disabled={room <= 0} onClick={() => addBlank(k)}><IconPlus /> {KIND_NAMES[k]}</button>)}
              </div>
            </div>
          )}

          {way === "ai" && (
            <div className="sq-way">
              {!boot.ai.available ? <p>AI sets aren't switched on for this site yet. You can still write your own or paste a list.</p>
                : !aiAllowed ? <p>Your teacher has turned off AI sets for your class. You can still write your own or paste a list.</p> : (
                <>
                  <p>Tell the AI what to make questions about, or give it your notes and it will only use those. AI can get things wrong, so read every answer before you save.</p>
                  <label><span>Topic</span><input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} placeholder="The causes of the American Revolution" /></label>
                  <label><span>Your notes (optional)</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={6000} rows={4} placeholder="Paste class notes or a reading here, and the questions will come from it." /></label>
                  <div className="sq-airow">
                    <label className="sq-file"><input type="file" accept=".txt,.md,.csv,.tsv,text/plain,text/csv,text/markdown" onChange={(e) => { void readFile(e.target.files?.[0], (t) => setNotes(t.slice(0, 6000))); e.target.value = ""; }} /><span className="sq-btn">Upload notes (.txt)</span></label>
                    <label><span>How many</span><select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
                    <label><span>Format</span><select value={format} onChange={(e) => setFormat(e.target.value)}><option value="mixed">A mix</option><option value="choice">Multiple choice</option><option value="truefalse">True or false</option><option value="typed">Type the answer</option><option value="card">Flashcards</option></select></label>
                  </div>
                  <div className="sq-airow">
                    <button type="button" className="sq-btn sq-btn-main" disabled={thinking || aiLeft <= 0 || room <= 0 || (topic.trim().length < 2 && notes.trim().length < 40)} onClick={() => void generate()}><IconSpark /> {thinking ? "Writing questions…" : "Write the questions"}</button>
                    <small>{aiLeft > 0 ? `${aiLeft} of ${boot.ai.perDay} AI sets left today` : "You've used today's AI sets."}</small>
                  </div>
                </>
              )}
            </div>
          )}

          {way === "paste" && (
            <div className="sq-way">
              <p>Paste a list or upload a .txt or .csv file. One question per line:</p>
              <ul className="sq-examples">
                <li><code>photosynthesis - how plants make food from light</code> makes a flashcard</li>
                <li><code>What is 7 × 8?, 56, 54, 48, 64</code> makes multiple choice (the right answer goes first)</li>
                <li><code>The Sun is a star, true</code> makes true or false</li>
              </ul>
              <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={6} placeholder={"term - meaning\nquestion, right answer, wrong, wrong, wrong"} aria-label="Paste your list" />
              <div className="sq-airow">
                <button type="button" className="sq-btn sq-btn-main" disabled={!pasted.trim() || room <= 0} onClick={importText}>Add these questions</button>
                <label className="sq-file"><input type="file" accept=".txt,.md,.csv,.tsv,text/plain,text/csv,text/markdown" onChange={(e) => { void readFile(e.target.files?.[0], setPasted); e.target.value = ""; }} /><span className="sq-btn">Upload a file</span></label>
              </div>
              {importNote && <p className="sq-fine" role="status">{importNote}</p>}
            </div>
          )}
        </div>

        <div className="sq-rows">
          <h3>{filled === 0 ? "No questions yet" : `${filled} ${filled === 1 ? "question" : "questions"}`}<small>A set needs at least {SET_LIMITS.minItems} and can hold {SET_LIMITS.maxItems}.</small></h3>
          {rows.map((r, i) => (
            <div key={r.key} className="sq-card sq-row">
              <div className="sq-row-top">
                <b>{i + 1}</b>
                <select value={r.kind} onChange={(e) => update(r.key, { kind: e.target.value as StudyKind, answer: e.target.value === "truefalse" ? "True" : r.kind === "truefalse" ? "" : r.answer })} aria-label={`Question ${i + 1} format`}>
                  {(Object.keys(KIND_NAMES) as StudyKind[]).map((k) => <option key={k} value={k}>{KIND_NAMES[k]}</option>)}
                </select>
                <button type="button" className="sq-icon-btn" onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))} aria-label={`Delete question ${i + 1}`}><IconTrash /></button>
              </div>
              <input value={r.prompt} onChange={(e) => update(r.key, { prompt: e.target.value })} maxLength={SET_LIMITS.prompt} placeholder={r.kind === "card" ? "Term or name" : r.kind === "truefalse" ? "A statement that is true or false" : "Question"} aria-label={`Question ${i + 1}`} />
              {r.kind === "truefalse" ? (
                <div className="sq-tf" role="group" aria-label="Answer">
                  {["True", "False"].map((v) => <button key={v} type="button" className="sq-opt ink" aria-pressed={r.answer === v} onClick={() => update(r.key, { answer: v })}>{v}</button>)}
                </div>
              ) : (
                <input className="right" value={r.answer} onChange={(e) => update(r.key, { answer: e.target.value })} maxLength={SET_LIMITS.answer} placeholder={r.kind === "card" ? "What it means" : "Right answer"} aria-label={`Right answer ${i + 1}`} />
              )}
              {r.kind === "choice" && (
                <div className="sq-wrongs">
                  {r.wrong.map((w, wi) => <input key={wi} value={w} onChange={(e) => { const next = r.wrong.slice() as Row["wrong"]; next[wi] = e.target.value; update(r.key, { wrong: next }); }} maxLength={SET_LIMITS.answer} placeholder={wi === 0 ? "Wrong answer" : "Wrong answer (optional)"} aria-label={`Wrong answer ${wi + 1} for question ${i + 1}`} />)}
                </div>
              )}
              {r.kind === "typed" && <input value={r.accept} onChange={(e) => update(r.key, { accept: e.target.value })} placeholder="Other answers to accept, separated by commas (optional)" aria-label={`Other accepted answers ${i + 1}`} />}
            </div>
          ))}
          <div ref={listEnd} />
        </div>

        <footer className="sq-editor-foot">
          {error && <p className="sq-error" role="alert">{error}</p>}
          <button type="button" className="sq-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="sq-btn sq-btn-main" disabled={saving || filled < SET_LIMITS.minItems || title.trim().length < SET_LIMITS.title[0]} onClick={() => void save()}>{saving ? "Saving…" : "Save set"}</button>
        </footer>
      </div>
    </section>
  );
}
