// AI-powered tools in A.R.I.S.E. Premium. Each task is server-defined and returns structured JSON.
// Generations are saved per signed-in user using the same cloud storage as Office.
import { hubNightClass } from "@/lib/hubNight";
import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { askAppAi, saveLabel, useAppData } from "@/lib/cloudDocs";
import { ArrowLeft, Check, ClipboardCopy, Sparkles, Trash2 } from "lucide-react";

type Field = { key: string; label: string; placeholder?: string; large?: boolean };
type Tool = { id: string; name: string; group: string; description: string; fields: Field[] };
const f = (key: string, label: string, placeholder?: string, large?: boolean): Field => ({ key, label, placeholder, large });
const TOOLS: Tool[] = [
  { id: "meeting-agenda", name: "Meeting agenda", group: "Work", description: "Organize topics and time for your next meeting.", fields: [f("purpose", "Meeting purpose"), f("people", "Attendees"), f("minutes", "Length in minutes", "30")] },
  { id: "meeting-summary", name: "Meeting minutes", group: "Work", description: "Turn rough notes into decisions and action items.", fields: [f("notes", "Notes from the meeting", "Paste or write notes…", true)] },
  { id: "email-rewrite", name: "Email helper", group: "Work", description: "Polish an email while keeping its meaning.", fields: [f("text", "Draft email", "Paste your email…", true), f("tone", "Tone", "Professional and warm")] },
  { id: "resume-bullets", name: "Résumé bullets", group: "Work", description: "Describe your experience with clear action verbs.", fields: [f("role", "Job or role"), f("text", "What did you do?", "Responsibilities and accomplishments…", true)] },
  { id: "cover-letter", name: "Cover letter", group: "Work", description: "Draft a personalized application letter.", fields: [f("name", "Your name"), f("role", "Position"), f("company", "Company"), f("background", "Relevant experience", undefined, true), f("why", "Why this position?", undefined, true)] },
  { id: "brainstorm", name: "Idea generator", group: "Work", description: "Generate useful ideas for a project.", fields: [f("topic", "What should we brainstorm?"), f("count", "Number of ideas", "10"), f("notes", "Additional details", undefined, true)] },
  { id: "rubric", name: "Rubric builder", group: "Teaching", description: "Create scoring criteria for an assignment.", fields: [f("task", "Assignment"), f("grade", "Grade level"), f("criteria", "Number of criteria", "4")] },
  { id: "newsletter", name: "Newsletter writer", group: "Teaching", description: "Make a class or family update.", fields: [f("audience", "Audience"), f("points", "What to include", undefined, true), f("tone", "Tone")] },
  { id: "flashcards", name: "Flashcards", group: "Teaching", description: "Study or review any topic.", fields: [f("topic", "Topic"), f("level", "Grade or ability level"), f("count", "Cards", "15"), f("text", "Study notes (optional)", undefined, true)] },
  { id: "quiz", name: "Quiz builder", group: "Teaching", description: "Write multiple-choice questions and answer explanations.", fields: [f("topic", "Topic"), f("level", "Grade or ability level"), f("count", "Questions", "10"), f("text", "Source material (optional)", undefined, true)] },
  { id: "essay-outline", name: "Essay outline", group: "Teaching", description: "Organize a clear writing plan.", fields: [f("topic", "Essay prompt"), f("type", "Essay type"), f("level", "Grade level")] },
  { id: "study-guide", name: "Study guide", group: "Teaching", description: "Key terms, concepts, and practice questions.", fields: [f("topic", "Topic"), f("text", "Notes or source content", undefined, true)] },
  { id: "vocab", name: "Vocabulary helper", group: "Teaching", description: "Definitions, examples and synonyms.", fields: [f("words", "Words", "List the words…", true)] },
  { id: "mnemonic", name: "Memory tricks", group: "Teaching", description: "Remember hard facts with helpful phrases.", fields: [f("topic", "What should you remember?")] },
  { id: "workout-plan", name: "Workout planner", group: "Life", description: "A weekly fitness schedule matched to your equipment.", fields: [f("goal", "Fitness goal"), f("level", "Experience"), f("equipment", "Equipment"), f("days", "Days a week", "3"), f("minutes", "Minutes each day", "30")] },
  { id: "meal-plan", name: "Meal planner", group: "Life", description: "Plan meals and make a grocery list.", fields: [f("diet", "Diet/preferences"), f("people", "How many people?", "2"), f("budget", "Budget"), f("avoid", "Foods to avoid"), f("calories", "Daily calorie goal (optional)")] },
  { id: "journal-reflect", name: "Journal reflection", group: "Life", description: "Reflect on your writing with a gentle question.", fields: [f("text", "Journal entry", undefined, true)] },
  { id: "thought-reframe", name: "Thought reframer", group: "Life", description: "Explore more balanced ways to view a challenge.", fields: [f("situation", "Situation", undefined, true), f("thought", "Thought", undefined, true)] },
  { id: "gift-ideas", name: "Gift ideas", group: "Life", description: "Get ideas based on interests and a budget.", fields: [f("who", "Who is it for?"), f("likes", "Interests"), f("budget", "Budget"), f("occasion", "Occasion")] },
  { id: "party-plan", name: "Party planner", group: "Life", description: "Create a checklist, menu, and activity ideas.", fields: [f("event", "Event"), f("guests", "Guest count"), f("theme", "Theme"), f("budget", "Budget")] },
];
type Entry = { id: string; task: string; title: string; createdAt: string; result: Record<string, unknown> };
const cleanHistory = (raw: unknown): Entry[] => Array.isArray(raw) ? raw.filter((x: any) => x && typeof x === "object" && typeof x.task === "string").slice(0, 50).map((x: any) => ({
  id: String(x.id).slice(0, 80), task: String(x.task).slice(0, 80), title: String(x.title || "").slice(0, 140),
  createdAt: String(x.createdAt || ""), result: x.result && typeof x.result === "object" ? x.result : {}
})) : [];
const fieldClass = "w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-indigo-500";
function nice(key: string) { return key.replace(/([A-Z])/g, " $1").replace(/[-_]/g, " ").replace(/^./, (m) => m.toUpperCase()); }
function ResultTree({ value, label, depth = 0 }: { value: unknown; label?: string; depth?: number }) {
  if (depth > 6) return null;
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "object") return <div className="my-1 text-sm leading-6">{label ? <strong className="text-slate-700">{nice(label)}: </strong> : null}<span>{String(value)}</span></div>;
  if (Array.isArray(value)) return <div className="my-2">{label && <h3 className="mb-1 font-bold">{nice(label)}</h3>}<ol className="ml-4 list-decimal space-y-2">{value.map((v, i) => <li key={i}><ResultTree value={v} depth={depth + 1}/></li>)}</ol></div>;
  return <section className="my-2">{label && <h3 className="mb-2 font-bold text-indigo-900">{nice(label)}</h3>}{Object.entries(value).map(([k, v]) => <ResultTree key={k} label={k} value={v} depth={depth + 1}/>)}</section>;
}
export default function PremiumStudio() {
  const { user, token } = useAuth();
  const { data, setData, state, loaded } = useAppData("premium-studio-v1", cleanHistory);
  const [activeId, setActiveId] = useState(() => { const requested = new URLSearchParams(window.location.hash.split("?")[1] || "").get("task"); return TOOLS.some((t) => t.id === requested) ? requested! : "meeting-agenda"; });
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const tool = useMemo(() => TOOLS.find((t) => t.id === activeId) || TOOLS[0], [activeId]);
  const selected = data.find((e) => e.id === focused) || null;
  const changeTool = (id: string) => { setActiveId(id); setValues({}); setMessage(""); setFocused(null); };
  const generate = async () => {
    if (!Object.values(values).some((v) => v.trim())) { setMessage("Fill in at least one field."); return; }
    setBusy(true); setMessage("");
    try {
      const result = await askAppAi<Record<string, unknown>>(token, tool.id, values);
      if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("The AI did not return a usable result.");
      const title = values.topic || values.purpose || values.role || values.task || values.event || tool.name;
      const entry: Entry = { id: Math.random().toString(36).slice(2) + Date.now(), task: tool.id, title, createdAt: new Date().toISOString(), result };
      setData((old) => [entry, ...old].slice(0, 50)); setFocused(entry.id);
    } catch (e: any) { setMessage(e.message || "The AI helper is unavailable."); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    if (!selected) return;
    try { await navigator.clipboard.writeText(JSON.stringify(selected.result, null, 2)); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
    catch { setMessage("Couldn't copy. Select the result text instead."); }
  };
  return <main className={`${hubNightClass()} min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8`}><div className="mx-auto max-w-6xl space-y-6">
    <header><a href={user?.role === "parent" ? "#/lifehub" : "#/workhub"} className="text-sm font-semibold text-indigo-700 hover:underline"><ArrowLeft size={16} className="inline"/> Back to my hub</a>
      <h1 className="mt-3 text-3xl font-extrabold">A.R.I.S.E. AI Apps</h1><p className="mt-1 text-sm text-slate-600">Plan, write and create. Your generated work is saved to your account.</p></header>
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_1fr]">
      <nav aria-label="AI tools" className="rounded-2xl border border-slate-200 bg-white p-3">
        {["Work", "Teaching", "Life"].map((group) => <div key={group} className="mb-3"><h2 className="px-2 pb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{group}</h2>
          {TOOLS.filter((t) => t.group === group).map((t) => <button key={t.id} onClick={() => changeTool(t.id)} aria-current={tool.id === t.id ? "page" : undefined} className={"mb-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold " + (tool.id === t.id ? "bg-indigo-100 text-indigo-900" : "text-slate-700 hover:bg-slate-100")}>{t.name}</button>)}</div>)}
      </nav>
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-xl font-bold">{tool.name}</h2><p className="mt-1 text-sm text-slate-500">{tool.description}</p></div><span role="status" className="text-xs text-slate-500">{saveLabel(state)}</span></div>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">{tool.fields.map((f) => <label key={f.key} className={"block text-sm font-semibold " + (f.large ? "sm:col-span-2" : "")}>{f.label}
            {f.large ? <textarea rows={5} className={fieldClass + " mt-1"} value={values[f.key] || ""} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}/> :
              <input className={fieldClass + " mt-1"} value={values[f.key] || ""} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}/>}</label>)}</div>
          <div className="mt-5 flex flex-wrap items-center gap-3"><button disabled={busy || !loaded} onClick={() => void generate()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"><Sparkles size={16}/>{busy ? "Creating…" : "Generate"}</button>
            {message && <span role="alert" className="text-sm text-rose-700">{message}</span>}</div>
        </section>
        {selected && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-extrabold">{selected.title}</h2>
          <button onClick={() => void copy()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">{copied ? <Check size={16}/> : <ClipboardCopy size={16}/>} {copied ? "Copied" : "Copy result"}</button></div>
          <div className="mt-3 text-slate-800"><ResultTree value={selected.result}/></div></section>}
        <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-3 text-lg font-bold">Saved creations</h2>
          {!data.length && <p className="text-sm text-slate-500">Your AI creations will appear here after you generate them.</p>}
          <ul className="space-y-2">{data.map((entry) => <li key={entry.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <button className="min-w-0 flex-1 text-left text-sm" onClick={() => { setFocused(entry.id); setActiveId(entry.task); }}><strong className="block truncate">{entry.title}</strong><span className="text-xs text-slate-500">{TOOLS.find((t) => t.id === entry.task)?.name || entry.task} · {new Date(entry.createdAt).toLocaleDateString()}</span></button>
            <button onClick={() => { setData((all) => all.filter((v) => v.id !== entry.id)); if (focused === entry.id) setFocused(null); }} aria-label={"Delete " + entry.title} className="rounded-xl p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={16}/></button>
          </li>)}</ul>
        </section>
      </div>
    </div>
  </div></main>;
}
