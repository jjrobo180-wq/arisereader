// Randomizer (a Plugin Store add-on): pick from a list, flip a coin, roll dice or pick a number.
// Lists can be saved for next time ("Who does dishes", "Dinner ideas").
import { useRef, useState } from "react";
import { Coins, Dices, Hash, ListChecks, Save, Shuffle, Trash2 } from "lucide-react";
import { PageHead, Panel, danger, inputClass, plain, primary, soft, type SectionProps } from "./ui";

type Mode = "list" | "coin" | "dice" | "number";
const MODES: [Mode, string, typeof Coins][] = [["list", "Pick from a list", ListChecks], ["coin", "Flip a coin", Coins], ["dice", "Roll dice", Dices], ["number", "Pick a number", Hash]];
const FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const rand = (n: number) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };

export default function Randomizer({ family, setFamily, makeId, say }: SectionProps) {
  const [mode, setMode] = useState<Mode>("list");
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [dice, setDice] = useState(2);
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(100);
  const [result, setResult] = useState<string>("");
  const [spinning, setSpinning] = useState(false);
  const timer = useRef<number | null>(null);
  const items = text.split("\n").map((s) => s.trim()).filter(Boolean);

  // Flicks through a few random results before landing, so it feels like a spin.
  const spin = (next: () => string) => {
    if (timer.current) window.clearInterval(timer.current);
    setSpinning(true);
    let n = 0;
    timer.current = window.setInterval(() => {
      setResult(next());
      if (++n >= 12) { window.clearInterval(timer.current!); timer.current = null; setSpinning(false); }
    }, 70);
  };
  const go = () => {
    if (mode === "list") { if (items.length < 2) { say("Add at least two things, one per line."); return; } spin(() => items[rand(items.length)]); }
    if (mode === "coin") spin(() => (rand(2) ? "Heads" : "Tails"));
    if (mode === "dice") spin(() => { const r = Array.from({ length: dice }, () => rand(6)); return `${r.map((x) => FACES[x]).join(" ")}|${r.reduce((s, x) => s + x + 1, 0)}`; });
    if (mode === "number") { const lo = Math.min(min, max), hi = Math.max(min, max); spin(() => String(lo + rand(hi - lo + 1))); }
  };
  const saveList = () => {
    if (!name.trim() || items.length < 2) { say("Give the list a name and at least two things."); return; }
    setFamily((f) => ({ ...f, randomLists: [...f.randomLists.filter((l) => l.name.toLowerCase() !== name.trim().toLowerCase()), { id: makeId(), name: name.trim(), items }] }));
    say(`Saved “${name.trim()}”.`);
  };
  const [diceFaces, diceTotal] = mode === "dice" && result.includes("|") ? result.split("|") : ["", ""];

  return <div className="space-y-6">
    <PageHead eyebrow="Randomizer" title="Let chance decide" blurb="Who picks the movie, what's for dinner, heads or tails. Fair every time." />
    <div className="flex flex-wrap gap-1.5">{MODES.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => { setMode(id); setResult(""); }} aria-pressed={mode === id} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold ${mode === id ? "bg-[#292446] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"}`}><Icon size={16} />{label}</button>)}</div>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel title="Set it up">
        {mode === "list" && <div className="space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder={"One per line:\nMaya\nLeo\nDad"} className={inputClass + " py-3 leading-6"} aria-label="Things to pick from" />
          <div className="flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Name this list to save it" className={inputClass} aria-label="List name" /><button type="button" onClick={saveList} className={plain}><Save size={15} />Save</button></div>
          {family.randomLists.length > 0 && <div><p className="mb-1.5 text-xs font-bold text-slate-500">Saved lists</p><div className="flex flex-wrap gap-1.5">{family.randomLists.map((l) => <span key={l.id} className="inline-flex items-center rounded-full bg-violet-50 text-sm font-bold text-violet-700">
            <button type="button" onClick={() => { setText(l.items.join("\n")); setName(l.name); setResult(""); }} className="py-1.5 pl-3 pr-1">{l.name}</button>
            <button type="button" onClick={() => setFamily((f) => ({ ...f, randomLists: f.randomLists.filter((x) => x.id !== l.id) }))} className="rounded-full p-1.5 text-violet-400 hover:text-rose-600" aria-label={`Delete ${l.name}`}><Trash2 size={13} /></button>
          </span>)}</div></div>}
        </div>}
        {mode === "coin" && <p className="text-sm text-slate-600">Call it in the air, then flip.</p>}
        {mode === "dice" && <div><p className="mb-2 text-xs font-bold text-slate-500">How many dice</p><div className="flex gap-1.5">{[1, 2, 3, 4, 5, 6].map((n) => <button key={n} type="button" onClick={() => setDice(n)} aria-pressed={dice === n} className={`h-11 w-11 rounded-xl text-sm font-bold ${dice === n ? "bg-[#292446] text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>{n}</button>)}</div></div>}
        {mode === "number" && <div className="flex items-center gap-2"><input type="number" value={min} onChange={(e) => setMin(Math.trunc(Number(e.target.value) || 0))} className={inputClass} aria-label="Lowest" /><span className="text-sm font-bold text-slate-400">to</span><input type="number" value={max} onChange={(e) => setMax(Math.trunc(Number(e.target.value) || 0))} className={inputClass} aria-label="Highest" /></div>}
        <button type="button" onClick={go} disabled={spinning} className={primary + " mt-5 w-full min-h-12 text-base"}><Shuffle size={18} />{mode === "coin" ? "Flip" : mode === "dice" ? "Roll" : "Pick"}</button>
      </Panel>
      <section className="flex min-h-64 flex-col items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-[#2d2555] to-[#6d5ce7] p-8 text-center text-white shadow-[0_18px_40px_#4b3fa033]" aria-live="polite">
        {!result ? <p className="text-lg font-bold text-violet-200">Your result shows here</p>
          : mode === "dice" ? <><p className="text-7xl leading-none tracking-wider">{diceFaces}</p>{dice > 1 && <p className="mt-4 text-xl font-black">Total {diceTotal}</p>}</>
          : <p className={`break-words text-5xl font-black tracking-tight transition ${spinning ? "opacity-70 blur-[1px]" : "scale-105"}`}>{result}</p>}
        {result && !spinning && mode === "list" && <button type="button" onClick={() => { setText(items.filter((i) => i !== result).join("\n")); setResult(""); }} className={soft + " mt-6 bg-white/15 text-white hover:bg-white/25"}>Take “{result}” off and pick again</button>}
      </section>
    </div>
  </div>;
}
