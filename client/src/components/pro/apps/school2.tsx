// Puzzles and practice: word search and crossword makers you can play on screen or print,
// math-facts drills, spelling practice read aloud, an interactive periodic table, a fraction lab
// and typing practice.
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Check, Eye, Play, Plus, Printer, RotateCcw, Shuffle, Trash2, Volume2 } from "lucide-react";
import { CAT_INFO, ELEMENTS, allFacts, equivalents, fracCompare, fracOp, fracStr, makeCrossword, makeWordSearch, mixed, pickFact, rng, simplify, typingScore, wsClean, type ElementCat, type Frac, type FracOp, type MathOp, type WsLevel } from "@shared/pro/school";
import { Bar, Btn, Card, Chart, Empty, Field, NumIn, Ring, Stat, Tabs, beep, chime, esc, fit, fmtDay, inputCls, printPage, randInt, shuffle, speak, today, uid, usePro, useTick } from "../kit";

const area = `${inputCls} h-auto py-2`;
const newSeed = () => randInt(1_000_000_000);

// ─── Word search ───
type WsPuzzle = { id: string; title: string; words: string; size: number; level: WsLevel; seed: number };
function WordSearchApp() {
  const { data, setData } = usePro<{ list: WsPuzzle[] }>("word-search", { list: [] });
  const [id, setId] = useState<string | null>(null);
  const [found, setFound] = useState<string[]>([]); const [start, setStart] = useState<[number, number] | null>(null);
  const p = data.list.find((x) => x.id === id) || null;
  const put = (x: WsPuzzle) => setData((d) => ({ list: d.list.some((y) => y.id === x.id) ? d.list.map((y) => (y.id === x.id ? x : y)) : [x, ...d.list] }));
  const words = p ? p.words.split(/[\n,]/).map((w) => w.trim()).filter(Boolean) : [];
  const ws = useMemo(() => (p ? makeWordSearch(words, p.size, p.level, p.seed) : null), [p?.words, p?.size, p?.level, p?.seed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setFound([]); setStart(null); }, [p?.seed, p?.words, p?.size, p?.level]);
  const foundCells = useMemo(() => { const s = new Set<string>(); if (ws) for (const pl of ws.placed) if (found.includes(pl.word)) for (let i = 0; i < pl.word.length; i++) s.add(`${pl.r + pl.dr * i},${pl.c + pl.dc * i}`); return s; }, [ws, found]);
  const tap = (r: number, c: number) => {
    if (!ws) return;
    if (!start) { setStart([r, c]); return; }
    const [r0, c0] = start; setStart(null);
    const hit = ws.placed.find((pl) => { const er = pl.r + pl.dr * (pl.word.length - 1), ec = pl.c + pl.dc * (pl.word.length - 1); return (pl.r === r0 && pl.c === c0 && er === r && ec === c) || (pl.r === r && pl.c === c && er === r0 && ec === c0); });
    if (hit && !found.includes(hit.word)) { const nf = [...found, hit.word]; setFound(nf); if (nf.length === ws.placed.length) chime(); else beep(880, 90); }
  };
  const gridHtml = (key: boolean) => { if (!ws || !p) return ""; const keyCells = new Set<string>(); if (key) for (const pl of ws.placed) for (let i = 0; i < pl.word.length; i++) keyCells.add(`${pl.r + pl.dr * i},${pl.c + pl.dc * i}`); return `<table style="width:auto;margin:16px auto;border-collapse:collapse">${ws.grid.map((row, r) => `<tr>${row.map((ch, c) => `<td style="width:${Math.min(36, 620 / p.size)}px;height:${Math.min(36, 620 / p.size)}px;text-align:center;font:bold ${Math.min(20, 360 / p.size)}px monospace;border:1px solid #e2e8f0;${keyCells.has(`${r},${c}`) ? "background:#fde68a" : ""}">${ch}</td>`).join("")}</tr>`).join("")}</table>`; };
  const print = () => { if (!ws || !p) return; const list = `<div style="columns:3;font-size:15px;margin-top:10px">${ws.placed.map((w) => `<div>☐ ${w.word}</div>`).join("")}</div>`; printPage(p.title, `<h1 style="text-align:center">${esc(p.title)}</h1><p class="muted" style="text-align:center">Name: ____________________</p>${gridHtml(false)}${list}<div style="page-break-before:always"></div><h1 style="text-align:center">${esc(p.title)} — answer key</h1>${gridHtml(true)}`); };
  if (p && ws) {
    const cell = Math.max(22, Math.min(40, Math.floor(560 / p.size)));
    return <div className="space-y-4">
      <div className="flex flex-wrap gap-2"><Btn onClick={() => setId(null)}>← Puzzles</Btn><span className="flex-1" /><Btn onClick={() => put({ ...p, seed: newSeed() })}><Shuffle size={14} />New layout</Btn><Btn kind="primary" color="#ea580c" onClick={print}><Printer size={14} />Print + key</Btn></div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        <Card><Field label="Title"><input value={p.title} onChange={(e) => put({ ...p, title: e.target.value })} className={inputCls} /></Field><Field label="Words (one per line or commas)" className="mt-3"><textarea rows={8} value={p.words} onChange={(e) => put({ ...p, words: e.target.value })} className={area} /></Field>
          <Field label={`Grid size: ${p.size} × ${p.size}`} className="mt-3"><input type="range" min={8} max={20} value={p.size} onChange={(e) => put({ ...p, size: Number(e.target.value) })} className="w-full accent-orange-600" /></Field>
          <div className="mt-3"><Tabs value={p.level} onChange={(v) => put({ ...p, level: v })} color="#ea580c" items={[{ id: "easy", label: "Easy →↓" }, { id: "medium", label: "Medium ↘" }, { id: "hard", label: "Hard ↺" }]} /></div>
          {ws.missed.length > 0 && <p className="mt-2 text-sm text-amber-700">Didn't fit: {ws.missed.join(", ")} — make the grid bigger or tap New layout.</p>}</Card>
        <Card title={`${found.length} of ${ws.placed.length} found`} right={found.length > 0 && <Btn onClick={() => setFound([])}><RotateCcw size={14} />Reset</Btn>}>
          <p className="mb-2 text-xs text-slate-500">Play on screen: tap the first letter of a word, then its last letter.</p>
          <div className="overflow-x-auto"><div className="mx-auto grid grid-cols-1 w-max select-none" style={{ gridTemplateColumns: `repeat(${p.size}, ${cell}px)` }}>{ws.grid.map((row, r) => row.map((ch, c) => { const f = foundCells.has(`${r},${c}`); const s = start && start[0] === r && start[1] === c; return <button key={`${r},${c}`} type="button" onClick={() => tap(r, c)} className={`flex items-center justify-center font-mono font-black ${s ? "rounded-full bg-orange-500 text-white" : f ? "bg-amber-200 text-amber-900" : "hover:bg-orange-50"}`} style={{ width: cell, height: cell, fontSize: cell * 0.5 }}>{ch}</button>; }))}</div></div>
          <div className="mt-3 flex flex-wrap gap-1.5">{ws.placed.map((w) => <span key={w.word} className={`rounded-full px-2.5 py-1 text-xs font-bold ${found.includes(w.word) ? "bg-amber-200 text-amber-900 line-through" : "bg-slate-100 text-slate-700"}`}>{w.word}</span>)}</div>
        </Card>
      </div>
    </div>;
  }
  return <div className="space-y-4">
    <div className="flex justify-end"><Btn kind="primary" color="#ea580c" onClick={() => { const x: WsPuzzle = { id: uid(), title: "Word search", words: "apple\nbanana\ncherry\ngrape\nlemon\nmango\npeach\npear", size: 12, level: "medium", seed: newSeed() }; put(x); setId(x.id); }}><Plus size={16} />New word search</Btn></div>
    {data.list.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{data.list.map((x) => <div key={x.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"><button type="button" onClick={() => setId(x.id)} className="block w-full text-left"><p className="font-black">{x.title}</p><p className="text-xs text-slate-500">{x.words.split(/[\n,]/).filter((w) => wsClean(w)).length} words · {x.size}×{x.size} · {x.level}</p></button><button type="button" aria-label="Delete" onClick={() => setData((d) => ({ list: d.list.filter((y) => y.id !== x.id) }))} className="mt-2 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button></div>)}</div> : <Empty>Type your spelling words, vocabulary or any theme and get a word search to play on screen or print with an answer key.</Empty>}
  </div>;
}

// ─── Crossword ───
type CwPuzzle = { id: string; title: string; entries: { id: string; word: string; clue: string }[]; seed: number };
function CrosswordApp() {
  const { data, setData } = usePro<{ list: CwPuzzle[] }>("crossword", { list: [] });
  const [id, setId] = useState<string | null>(null); const [mode, setMode] = useState<"edit" | "solve">("edit");
  const [answers, setAnswers] = useState<Record<string, string>>({}); const [checked, setChecked] = useState(false);
  const p = data.list.find((x) => x.id === id) || null;
  const put = (x: CwPuzzle) => setData((d) => ({ list: d.list.some((y) => y.id === x.id) ? d.list.map((y) => (y.id === x.id ? x : y)) : [x, ...d.list] }));
  const cw = useMemo(() => (p ? makeCrossword(p.entries.filter((e) => e.clue.trim()), p.seed) : null), [p?.entries, p?.seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const [dir, setDir] = useState<"a" | "d">("a");
  const html = (key: boolean) => { if (!cw) return ""; const sz = Math.min(34, Math.floor(640 / Math.max(cw.cols, 1))); return `<table style="width:auto;margin:14px auto;border-collapse:collapse">${cw.cells.map((row, r) => `<tr>${row.map((ch, c) => (ch ? `<td style="position:relative;width:${sz}px;height:${sz}px;border:1.5px solid #111;text-align:center;vertical-align:middle;font:bold ${sz * 0.5}px Arial">${cw.numbers[r][c] ? `<span style="position:absolute;top:1px;left:2px;font-size:${Math.max(8, sz * 0.28)}px;font-weight:normal">${cw.numbers[r][c]}</span>` : ""}${key ? ch : ""}</td>` : `<td style="width:${sz}px;height:${sz}px;border:0"></td>`)).join("")}</tr>`).join("")}</table>`; };
  const clues = () => { if (!cw) return ""; const list = (a: boolean) => cw.words.filter((w) => w.across === a).map((w) => `<div style="margin:3px 0"><b>${w.num}.</b> ${esc(w.clue)} <span class="muted">(${w.word.length})</span></div>`).join(""); return `<div style="display:flex;gap:30px;font-size:14px"><div style="flex:1"><h2>Across</h2>${list(true)}</div><div style="flex:1"><h2>Down</h2>${list(false)}</div></div>`; };
  if (p && cw) {
    const cell = Math.max(26, Math.min(40, Math.floor(600 / Math.max(cw.cols, 1))));
    const focusNext = (r: number, c: number, back = false) => {
      const s = back ? -1 : 1; const go = (d: "a" | "d") => refs.current[d === "a" ? `${r},${c + s}` : `${r + s},${c}`];
      // Keep going the way you're typing; at the end of a word, turn if the word carries on the other way.
      const el = go(dir) || go(dir === "a" ? "d" : "a"); if (!go(dir) && el) setDir(dir === "a" ? "d" : "a"); el?.focus();
    };
    const onFocusCell = (r: number, c: number) => { const across = !!(refs.current[`${r},${c - 1}`] || refs.current[`${r},${c + 1}`]); const down = !!(refs.current[`${r - 1},${c}`] || refs.current[`${r + 1},${c}`]); if (dir === "a" && !across && down) setDir("d"); if (dir === "d" && !down && across) setDir("a"); };
    const wrong = (r: number, c: number) => checked && answers[`${r},${c}`] && answers[`${r},${c}`] !== cw.cells[r][c];
    const allRight = cw.cells.every((row, r) => row.every((ch, c) => !ch || answers[`${r},${c}`] === ch));
    return <div className="space-y-4">
      <div className="flex flex-wrap gap-2"><Btn onClick={() => setId(null)}>← Crosswords</Btn><Tabs value={mode} onChange={setMode} color="#7c3aed" items={[{ id: "edit", label: "Words & clues" }, { id: "solve", label: "Solve" }]} /><span className="flex-1" /><Btn onClick={() => put({ ...p, seed: newSeed() })}><Shuffle size={14} />New layout</Btn><Btn kind="primary" color="#7c3aed" onClick={() => printPage(p.title, `<h1 style="text-align:center">${esc(p.title)}</h1><p class="muted" style="text-align:center">Name: ____________________</p>${html(false)}${clues()}<div style="page-break-before:always"></div><h1 style="text-align:center">Answer key</h1>${html(true)}`)}><Printer size={14} />Print + key</Btn></div>
      {mode === "edit" ? <Card><Field label="Title"><input value={p.title} onChange={(e) => put({ ...p, title: e.target.value })} className={inputCls} /></Field>
        <div className="mt-3 space-y-2">{p.entries.map((e) => <div key={e.id} className="grid grid-cols-[150px_1fr_28px] gap-2"><input value={e.word} onChange={(ev) => put({ ...p, entries: p.entries.map((x) => (x.id === e.id ? { ...x, word: ev.target.value } : x)) })} placeholder="Answer" className={`${inputCls} font-bold uppercase`} /><input value={e.clue} onChange={(ev) => put({ ...p, entries: p.entries.map((x) => (x.id === e.id ? { ...x, clue: ev.target.value } : x)) })} placeholder="Clue" className={inputCls} /><button type="button" aria-label="Remove" onClick={() => put({ ...p, entries: p.entries.filter((x) => x.id !== e.id) })} className="text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button></div>)}</div>
        <Btn className="mt-2" onClick={() => put({ ...p, entries: [...p.entries, { id: uid(), word: "", clue: "" }] })}><Plus size={14} />Word</Btn>
        {cw.missed.length > 0 && <p className="mt-2 text-sm text-amber-700">Couldn't connect: {cw.missed.join(", ")}. Try New layout, or add words that share letters.</p>}
        <div className="mt-4 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html(true) }} />
      </Card> : <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card title={allRight ? "🎉 Solved!" : "Type in the boxes"} right={<div className="flex gap-2"><Btn onClick={() => setChecked(true)}><Check size={14} />Check</Btn><Btn onClick={() => { const a: Record<string, string> = {}; cw.cells.forEach((row, r) => row.forEach((ch, c) => { if (ch) a[`${r},${c}`] = ch; })); setAnswers(a); }}><Eye size={14} />Reveal</Btn><Btn onClick={() => { setAnswers({}); setChecked(false); }}><RotateCcw size={14} /></Btn></div>}>
          <div className="overflow-x-auto"><div className="mx-auto grid grid-cols-1 w-max" style={{ gridTemplateColumns: `repeat(${cw.cols}, ${cell}px)` }}>{cw.cells.map((row, r) => row.map((ch, c) => ch ? <div key={`${r},${c}`} className="relative border border-slate-800" style={{ width: cell, height: cell, background: wrong(r, c) ? "#fecaca" : "white" }}>{cw.numbers[r][c] && <span className="absolute left-0.5 top-0 text-[9px] text-slate-600">{cw.numbers[r][c]}</span>}<input ref={(el) => { refs.current[`${r},${c}`] = el; }} value={answers[`${r},${c}`] || ""} maxLength={2} onFocus={() => onFocusCell(r, c)} aria-label={`Row ${r + 1} column ${c + 1}`} onChange={(e) => { const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(-1); setAnswers({ ...answers, [`${r},${c}`]: v }); setChecked(false); if (v) focusNext(r, c); }} onKeyDown={(e) => { if (e.key === "Backspace" && !answers[`${r},${c}`]) focusNext(r, c, true); if (e.key === "ArrowRight") { setDir("a"); refs.current[`${r},${c + 1}`]?.focus(); } if (e.key === "ArrowLeft") refs.current[`${r},${c - 1}`]?.focus(); if (e.key === "ArrowDown") { setDir("d"); refs.current[`${r + 1},${c}`]?.focus(); } if (e.key === "ArrowUp") refs.current[`${r - 1},${c}`]?.focus(); }} className="h-full w-full bg-transparent text-center font-black uppercase caret-violet-600 focus:bg-violet-100 focus:outline-none" style={{ fontSize: cell * 0.5 }} /></div> : <div key={`${r},${c}`} style={{ width: cell, height: cell }} />))}</div></div>
          <p className="mt-2 text-xs text-slate-500">Typing moves {dir === "a" ? "across" : "down"} — press ↓ or → to switch.</p>
        </Card>
        <Card title="Clues">{(["Across", "Down"] as const).map((h) => <div key={h} className="mb-3"><p className="text-xs font-black uppercase text-violet-700">{h}</p>{cw.words.filter((w) => w.across === (h === "Across")).map((w) => <button key={w.word} type="button" onClick={() => { setDir(w.across ? "a" : "d"); refs.current[`${w.r},${w.c}`]?.focus(); }} className="block w-full rounded-lg px-1 py-0.5 text-left text-sm hover:bg-violet-50"><b>{w.num}.</b> {w.clue} <span className="text-slate-400">({w.word.length})</span></button>)}</div>)}</Card>
      </div>}
    </div>;
  }
  return <div className="space-y-4">
    <div className="flex justify-end"><Btn kind="primary" color="#7c3aed" onClick={() => { const x: CwPuzzle = { id: uid(), title: "Crossword", seed: newSeed(), entries: [["planet", "Earth is one"], ["moon", "It orbits the Earth"], ["sun", "Our closest star"], ["comet", "Icy space visitor with a tail"], ["orbit", "Path around a planet or star"], ["gravity", "Force that pulls things down"], ["astronaut", "Person who travels to space"]].map(([word, clue]) => ({ id: uid(), word, clue })) }; put(x); setId(x.id); setMode("edit"); }}><Plus size={16} />New crossword</Btn></div>
    {data.list.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{data.list.map((x) => <div key={x.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"><button type="button" onClick={() => { setId(x.id); setMode("solve"); setAnswers({}); }} className="block w-full text-left"><p className="font-black">{x.title}</p><p className="text-xs text-slate-500">{x.entries.length} words</p></button><div className="mt-2 flex gap-2"><Btn onClick={() => { setId(x.id); setMode("edit"); }}>Edit</Btn><button type="button" aria-label="Delete" onClick={() => setData((d) => ({ list: d.list.filter((y) => y.id !== x.id) }))} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button></div></div>)}</div> : <Empty>Enter answers and clues; the maker fits them into a real interlocking crossword to solve on screen or print.</Empty>}
  </div>;
}

// ─── Math facts ───
const OPS: MathOp[] = ["+", "−", "×", "÷"];
function MathFacts() {
  const { data, setData } = usePro<{ ops: MathOp[]; max: number; seconds: number; stats: Record<string, { r: number; w: number }>; history: { day: string; right: number; total: number; ops: string }[] }>("math-facts", { ops: ["×"], max: 10, seconds: 60, stats: {}, history: [] });
  const [run, setRun] = useState<{ end: number; right: number; total: number; key: string; input: string; flash: "" | "ok" | "no"; misses: string[] } | null>(null);
  const [done, setDone] = useState<{ right: number; total: number; misses: string[] } | null>(null);
  const facts = useMemo(() => allFacts(data.ops.length ? data.ops : ["+"], data.max), [data.ops, data.max]);
  const rand = useRef(rng(Date.now())).current;
  const misses = useMemo(() => Object.fromEntries(Object.entries(data.stats).map(([k, v]) => [k, Math.max(0, v.w * 2 - v.r)])), [data.stats]);
  const fact = run ? facts.find((f) => f.key === run.key) || facts[0] : null;
  useTick(!!run && data.seconds > 0, 200);
  const finish = (r = run) => { if (!r) return; setData((d) => ({ ...d, history: [{ day: today(), right: r.right, total: r.total, ops: d.ops.join("") }, ...d.history].slice(0, 60) })); setDone({ right: r.right, total: r.total, misses: r.misses }); setRun(null); chime(); };
  useEffect(() => { if (run && data.seconds > 0 && Date.now() >= run.end) finish(); });
  const start = () => { setDone(null); setRun({ end: Date.now() + data.seconds * 1000, right: 0, total: 0, key: pickFact(facts, misses, rand).key, input: "", flash: "", misses: [] }); };
  const submit = () => {
    if (!run || !fact || run.input === "") return;
    const ok = Number(run.input) === fact.answer;
    setData((d) => ({ ...d, stats: { ...d.stats, [fact.key]: { r: (d.stats[fact.key]?.r || 0) + (ok ? 1 : 0), w: (d.stats[fact.key]?.w || 0) + (ok ? 0 : 1) } } }));
    if (!ok) beep(220, 140, 0.2, "square");
    const next = { ...run, right: run.right + (ok ? 1 : 0), total: run.total + 1, key: pickFact(facts, misses, rand, fact.key).key, input: "", flash: (ok ? "ok" : "no") as "ok" | "no", misses: ok ? run.misses : [...run.misses, `${fact.a} ${fact.op} ${fact.b} = ${fact.answer}`] };
    setRun(next);
    if (data.seconds === 0 && next.total >= 20) finish(next);
  };
  const toggleOp = (o: MathOp) => setData((d) => ({ ...d, ops: d.ops.includes(o) ? d.ops.filter((x) => x !== o) : [...d.ops, o] }));
  if (run && fact) {
    const left = data.seconds ? Math.max(0, (run.end - Date.now()) / 1000) : 0;
    return <div className="mx-auto max-w-md space-y-4 text-center">
      <div className="flex items-center justify-between text-sm font-bold"><span className="text-emerald-700">✓ {run.right}</span>{data.seconds ? <span className="font-mono text-2xl">{Math.ceil(left)}s</span> : <span>{run.total + 1} / 20</span>}<Btn onClick={() => finish()}>Stop</Btn></div>
      {data.seconds > 0 && <Bar value={left} max={data.seconds} color="#2563eb" />}
      <div className={`rounded-3xl p-8 transition ${run.flash === "ok" ? "bg-emerald-100" : run.flash === "no" ? "bg-rose-100" : "bg-blue-50"}`}><p className="font-mono text-6xl font-black tabular-nums">{fact.a} {fact.op} {fact.b}</p></div>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}><input autoFocus inputMode="numeric" value={run.input} onChange={(e) => setRun({ ...run, input: e.target.value.replace(/[^\d-]/g, ""), flash: "" })} className="h-20 w-full rounded-2xl border-2 border-blue-300 text-center font-mono text-5xl font-black focus:border-blue-600 focus:outline-none" aria-label="Answer" /></form>
      <div className="grid grid-cols-3 gap-2 sm:hidden">{["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].map((k) => <button key={k} type="button" onClick={() => (k === "✓" ? submit() : setRun({ ...run, input: k === "⌫" ? run.input.slice(0, -1) : run.input + k, flash: "" }))} className="h-14 rounded-xl bg-white text-2xl font-black ring-1 ring-slate-200">{k}</button>)}</div>
    </div>;
  }
  const table = data.ops.includes("×") || data.ops.includes("+") ? (data.ops.includes("×") ? "×" : "+") : null;
  return <div className="space-y-4">
    {done && <Card tint="#eff6ff"><div className="flex flex-wrap items-center gap-4"><Ring value={done.right} max={done.total || 1} color="#2563eb" size={110}><p className="text-2xl font-black">{done.right}</p><p className="text-[10px] text-slate-500">of {done.total}</p></Ring><div className="flex-1"><p className="text-xl font-black">{done.total ? `${Math.round((done.right / done.total) * 100)}% correct` : "No answers"}</p>{done.misses.length > 0 && <p className="mt-1 text-sm text-slate-600">Practise: {[...new Set(done.misses)].slice(0, 8).join(" · ")}</p>}</div><Btn big kind="primary" color="#2563eb" onClick={start}><RotateCcw size={16} />Again</Btn></div></Card>}
    <Card title="Practice">
      <div className="flex flex-wrap gap-2">{OPS.map((o) => <button key={o} type="button" onClick={() => toggleOp(o)} className={`h-14 w-14 rounded-2xl text-3xl font-black ring-2 ${data.ops.includes(o) ? "bg-blue-600 text-white ring-blue-600" : "bg-white text-slate-500 ring-slate-200"}`}>{o}</button>)}</div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label={`Numbers up to ${data.max}`}><input type="range" min={5} max={12} value={data.max} onChange={(e) => setData((d) => ({ ...d, max: Number(e.target.value) }))} className="w-full accent-blue-600" /></Field><Field label="Mode"><select value={data.seconds} onChange={(e) => setData((d) => ({ ...d, seconds: Number(e.target.value) }))} className={inputCls}><option value={60}>1 minute sprint</option><option value={120}>2 minutes</option><option value={180}>3 minutes</option><option value={0}>Untimed — 20 questions</option></select></Field></div>
      <Btn big kind="primary" color="#2563eb" className="mt-4 w-full" disabled={!data.ops.length} onClick={start}><Play size={18} />Start</Btn>
      <p className="mt-2 text-xs text-slate-500">Facts you miss come back more often until you know them.</p>
    </Card>
    {table && <Card title={`How you're doing: ${table} facts`}><div className="overflow-x-auto"><table className="mx-auto text-center text-xs"><tbody><tr><td className="p-1 font-black text-blue-700">{table}</td>{Array.from({ length: data.max + 1 }, (_, b) => <td key={b} className="p-1 font-black text-slate-500">{b}</td>)}</tr>{Array.from({ length: data.max + 1 }, (_, a) => <tr key={a}><td className="p-1 font-black text-slate-500">{a}</td>{Array.from({ length: data.max + 1 }, (_, b) => { const s = data.stats[`${a}${table === "×" ? "x" : "+"}${b}`]; const pct = s ? s.r / (s.r + s.w) : -1; return <td key={b} title={s ? `${s.r} right, ${s.w} wrong` : "Not tried"} className="h-7 w-7 rounded" style={{ background: pct < 0 ? "#f1f5f9" : pct >= 0.9 ? "#22c55e" : pct >= 0.6 ? "#facc15" : "#f87171", color: pct < 0 ? "#94a3b8" : "white" }}>{table === "×" ? a * b : a + b}</td>; })}</tr>)}</tbody></table></div><p className="mt-2 text-center text-xs text-slate-500">Green = solid · yellow = getting there · red = practise · grey = not tried yet</p></Card>}
    {data.history.length > 1 && <Card title="Progress"><Chart kind="line" labels={[...data.history].reverse().map((h) => fmtDay(h.day, { month: "short", day: "numeric" }))} series={[{ name: "Correct", values: [...data.history].reverse().map((h) => h.right) }]} height={180} colors={["#2563eb"]} /></Card>}
  </div>;
}

// ─── Spelling ───
type SpList = { id: string; name: string; words: { w: string; s: string }[] };
function Spelling() {
  const { data, setData } = usePro<{ lists: SpList[]; tricky: Record<string, number>; tests: { day: string; list: string; score: number; total: number }[] }>("spelling", { lists: [], tricky: {}, tests: [] });
  const [id, setId] = useState<string | null>(null); const [edit, setEdit] = useState(false);
  const [run, setRun] = useState<{ test: boolean; order: number[]; i: number; input: string; result: null | boolean; tries: number; wrong: string[] } | null>(null);
  const list = data.lists.find((l) => l.id === id) || null;
  const put = (l: SpList) => setData((d) => ({ ...d, lists: d.lists.some((x) => x.id === l.id) ? d.lists.map((x) => (x.id === l.id ? l : x)) : [l, ...d.lists] }));
  const say = (i: number, slow = false) => { if (!list) return; const w = list.words[i]; speak(`${w.w}.${w.s ? ` ${w.s}.` : ""} ${w.w}.`, slow ? 0.6 : 0.9); };
  const begin = (test: boolean) => { if (!list?.words.length) return; const order = shuffle(list.words.map((_, i) => i)); setRun({ test, order, i: 0, input: "", result: null, tries: 0, wrong: [] }); window.setTimeout(() => say(order[0]), 300); };
  const check = () => {
    if (!run || !list) return; const w = list.words[run.order[run.i]].w; const ok = run.input.trim().toLowerCase() === w.toLowerCase();
    if (!ok) setData((d) => ({ ...d, tricky: { ...d.tricky, [w.toLowerCase()]: (d.tricky[w.toLowerCase()] || 0) + 1 } }));
    if (ok) beep(880, 90); else beep(220, 140, 0.2, "square");
    setRun({ ...run, result: ok, tries: run.tries + 1, wrong: ok || run.wrong.includes(w) ? run.wrong : [...run.wrong, w] });
  };
  const next = () => { if (!run || !list) return; const i = run.i + 1; if (i >= run.order.length) { if (run.test) setData((d) => ({ ...d, tests: [{ day: today(), list: list.name, score: run.order.length - run.wrong.length, total: run.order.length }, ...d.tests].slice(0, 40) })); chime(); setRun({ ...run, i }); return; } setRun({ ...run, i, input: "", result: null, tries: 0 }); window.setTimeout(() => say(run.order[i]), 250); };
  if (list && run) {
    if (run.i >= run.order.length) return <Card><div className="py-6 text-center"><Ring value={run.order.length - run.wrong.length} max={run.order.length} color="#db2777"><p className="text-3xl font-black">{run.order.length - run.wrong.length}/{run.order.length}</p></Ring>{run.wrong.length ? <p className="mt-3">Practise: <b>{run.wrong.join(", ")}</b></p> : <p className="mt-3 text-xl font-black text-emerald-700">Perfect! ⭐</p>}<div className="mt-3 flex justify-center gap-2"><Btn onClick={() => setRun(null)}>Done</Btn><Btn kind="primary" color="#db2777" onClick={() => begin(run.test)}><RotateCcw size={14} />Again</Btn></div></div></Card>;
    const w = list.words[run.order[run.i]].w;
    return <div className="mx-auto max-w-lg space-y-4 text-center">
      <div className="flex items-center justify-between text-sm text-slate-500"><span>{run.test ? "Test" : "Practice"} · word {run.i + 1} of {run.order.length}</span><Btn onClick={() => setRun(null)}>Stop</Btn></div>
      <div className="flex justify-center gap-2"><Btn big kind="primary" color="#db2777" onClick={() => say(run.order[run.i])}><Volume2 size={20} />Hear it</Btn><Btn big onClick={() => say(run.order[run.i], true)}>Slowly</Btn></div>
      <form onSubmit={(e) => { e.preventDefault(); if (run.result === null || (!run.test && run.result === false && run.tries < 3)) check(); else next(); }}><input autoFocus autoCapitalize="off" autoCorrect="off" spellCheck={false} value={run.input} onChange={(e) => setRun({ ...run, input: e.target.value, result: run.result === false && !run.test ? null : run.result })} className="h-20 w-full rounded-2xl border-2 border-pink-300 text-center text-4xl font-black tracking-wider focus:border-pink-600 focus:outline-none" aria-label="Spell the word" placeholder="type it here" /></form>
      {run.result === true && <p className="text-2xl font-black text-emerald-600">✓ Correct!</p>}
      {run.result === false && (run.test || run.tries >= 3 ? <div><p className="text-xl font-black text-rose-600">It's spelled:</p><p className="text-4xl font-black tracking-widest">{w.split("").map((ch, i) => <span key={i} className={run.input[i]?.toLowerCase() === ch.toLowerCase() ? "text-slate-900" : "text-pink-600 underline"}>{ch}</span>)}</p></div> : <p className="font-bold text-rose-600">Not quite — try again ({3 - run.tries} left)</p>)}
      {(run.result === true || (run.result === false && (run.test || run.tries >= 3))) ? <Btn big kind="primary" color="#db2777" className="w-full" onClick={next}>Next word</Btn> : <Btn big kind="primary" color="#db2777" className="w-full" disabled={!run.input.trim()} onClick={check}>Check</Btn>}
    </div>;
  }
  if (list) return <div className="space-y-4">
    <div className="flex flex-wrap gap-2"><Btn onClick={() => { setId(null); setEdit(false); }}>← Lists</Btn><span className="flex-1" /><Btn onClick={() => setEdit(!edit)}>{edit ? "Done editing" : "Edit words"}</Btn><Btn kind="soft" color="#db2777" disabled={!list.words.length} onClick={() => begin(false)}><Play size={15} />Practice</Btn><Btn kind="primary" color="#db2777" disabled={!list.words.length} onClick={() => begin(true)}>Take test</Btn></div>
    <Card><Field label="List name"><input value={list.name} onChange={(e) => put({ ...list, name: e.target.value })} className={inputCls} /></Field>
      {edit || !list.words.length ? <><p className="mt-3 text-sm text-slate-600">One word per line. Add a sentence after a dash to hear it in context: <code>because - I smiled because it was sunny</code></p><textarea rows={12} defaultValue={list.words.map((w) => (w.s ? `${w.w} - ${w.s}` : w.w)).join("\n")} onBlur={(e) => put({ ...list, words: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [w, ...s] = l.split(/\s+[-–—]\s+/); return { w: w.trim(), s: s.join(" - ").trim() }; }) })} className={`${area} mt-2`} /><p className="text-xs text-slate-500">Saves when you click away.</p></>
        : <div className="mt-3 flex flex-wrap gap-2">{list.words.map((w, i) => <button key={i} type="button" onClick={() => say(i)} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-bold ${data.tricky[w.w.toLowerCase()] ? "bg-pink-100 text-pink-800" : "bg-slate-100"}`}><Volume2 size={13} />{w.w}</button>)}</div>}</Card>
  </div>;
  const tricky = Object.entries(data.tricky).sort((a, b) => b[1] - a[1]).slice(0, 20);
  return <div className="space-y-4">
    <div className="flex justify-end"><Btn kind="primary" color="#db2777" onClick={() => { const l: SpList = { id: uid(), name: `Week of ${fmtDay(today(), { month: "short", day: "numeric" })}`, words: [] }; put(l); setId(l.id); setEdit(true); }}><Plus size={16} />New list</Btn></div>
    {data.lists.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{data.lists.map((l) => { const last = data.tests.find((t) => t.list === l.name); return <div key={l.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"><button type="button" onClick={() => setId(l.id)} className="block w-full text-left"><p className="font-black">{l.name}</p><p className="text-xs text-slate-500">{l.words.length} words{last ? ` · last test ${last.score}/${last.total}` : ""}</p></button><div className="mt-2 flex items-center gap-2"><Btn kind="soft" color="#db2777" onClick={() => setId(l.id)}>Open</Btn><button type="button" aria-label="Delete list" onClick={() => setData((d) => ({ ...d, lists: d.lists.filter((x) => x.id !== l.id) }))} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button></div></div>; })}</div> : <Empty>Add this week's spelling words. The app reads each word and a sentence aloud — you type it.</Empty>}
    {tricky.length > 0 && <Card title="Tricky words"><div className="flex flex-wrap gap-2">{tricky.map(([w, n]) => <span key={w} className="rounded-full bg-pink-50 px-3 py-1 text-sm font-bold text-pink-800">{w} <span className="text-pink-400">×{n}</span></span>)}</div><Btn className="mt-3" onClick={() => { const l: SpList = { id: uid(), name: "Tricky words", words: tricky.map(([w]) => ({ w, s: "" })) }; put(l); setId(l.id); }}>Make a list from these</Btn></Card>}
  </div>;
}

// ─── Periodic table ───
function Periodic() {
  const [sel, setSel] = useState(26); const [q, setQ] = useState(""); const [cat, setCat] = useState<ElementCat | "">("");
  const [quiz, setQuiz] = useState<{ z: number; choices: number[]; picked: number | null; n: number; score: number; range: number } | null>(null);
  const { data, setData } = usePro<{ best: number }>("periodic", { best: 0 });
  const el = ELEMENTS[sel - 1];
  const match = (z: number) => { const e = ELEMENTS[z - 1]; if (cat && e.cat !== cat) return false; if (!q.trim()) return true; const s = q.trim().toLowerCase(); return e.name.toLowerCase().includes(s) || e.sym.toLowerCase() === s || String(e.z) === s; };
  const newQ = (range: number, n = 0, score = 0) => { const z = randInt(range) + 1; const others = shuffle(Array.from({ length: range }, (_, i) => i + 1).filter((x) => x !== z)).slice(0, 3); setQuiz({ z, choices: shuffle([z, ...others]), picked: null, n, score, range }); };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, symbol or number" className={fit("w-64")} /><select value={cat} onChange={(e) => setCat(e.target.value as ElementCat | "")} className={fit("w-56")}><option value="">All groups</option>{Object.entries(CAT_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select><span className="flex-1" /><Btn kind="soft" color="#0891b2" onClick={() => newQ(36)}>Quiz: first 36</Btn><Btn kind="soft" color="#0891b2" onClick={() => newQ(118)}>Quiz: all 118</Btn></div>
    {quiz && <Card tint="#ecfeff">{quiz.n >= 10 ? <div className="text-center"><p className="text-2xl font-black">{quiz.score} / 10</p>{quiz.score > data.best && <p className="text-emerald-700">New best!</p>}<div className="mt-2 flex justify-center gap-2"><Btn onClick={() => setQuiz(null)}>Close</Btn><Btn kind="primary" color="#0891b2" onClick={() => newQ(quiz.range)}>Again</Btn></div></div> : <div className="text-center"><p className="text-sm text-slate-500">Question {quiz.n + 1} of 10 · score {quiz.score} · best {data.best}</p><p className="my-2 text-5xl font-black" style={{ color: "#0e7490" }}>{ELEMENTS[quiz.z - 1].sym}</p><p className="text-sm text-slate-600">Which element is this?</p><div className="mt-2 grid grid-cols-2 gap-2">{quiz.choices.map((z) => <button key={z} type="button" disabled={quiz.picked !== null} onClick={() => setQuiz({ ...quiz, picked: z, score: quiz.score + (z === quiz.z ? 1 : 0) })} className={`rounded-xl p-2 font-bold ring-1 ${quiz.picked !== null && z === quiz.z ? "bg-emerald-100 ring-emerald-400" : quiz.picked === z ? "bg-rose-100 ring-rose-400" : "bg-white ring-slate-200"}`}>{ELEMENTS[z - 1].name}</button>)}</div>{quiz.picked !== null && <Btn className="mt-2" kind="primary" color="#0891b2" onClick={() => { const n = quiz.n + 1; if (n >= 10) { setData((d) => ({ best: Math.max(d.best, quiz.score) })); chime(); setQuiz({ ...quiz, n }); } else newQ(quiz.range, n, quiz.score); setSel(quiz.z); }}>Next</Btn>}</div>}</Card>}
    <div className="overflow-x-auto rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200"><div className="grid grid-cols-1 min-w-[760px] gap-[3px]" style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))", gridTemplateRows: "repeat(7, auto) 10px repeat(2, auto)" }}>
      {ELEMENTS.map((e) => { const on = match(e.z); return <button key={e.z} type="button" onClick={() => setSel(e.z)} title={e.name} className={`flex aspect-square flex-col items-center justify-center rounded-md p-0.5 leading-none transition ${sel === e.z ? "ring-2 ring-slate-900" : ""}`} style={{ gridRow: e.row, gridColumn: e.col, background: CAT_INFO[e.cat].color, opacity: on ? 1 : 0.18 }}><span className="text-[8px] text-slate-700">{e.z}</span><span className="text-sm font-black text-slate-900">{e.sym}</span><span className="hidden w-full truncate text-center text-[7px] text-slate-700 lg:block">{e.name}</span></button>; })}
      <div className="flex items-center justify-center rounded-md bg-pink-100 text-[9px] font-bold text-pink-700" style={{ gridRow: 6, gridColumn: 3 }}>57–71</div><div className="flex items-center justify-center rounded-md bg-fuchsia-100 text-[9px] font-bold text-fuchsia-700" style={{ gridRow: 7, gridColumn: 3 }}>89–103</div>
    </div></div>
    <Card><div className="flex flex-wrap gap-4"><div className="flex h-32 w-32 shrink-0 flex-col items-center justify-center rounded-2xl" style={{ background: CAT_INFO[el.cat].color }}><span className="text-sm">{el.z}</span><span className="text-5xl font-black">{el.sym}</span><span className="text-xs">{el.mass}</span></div>
      <div className="min-w-[240px] flex-1"><p className="text-2xl font-black">{el.name}</p><p className="text-sm font-bold" style={{ color: "#0e7490" }}>{CAT_INFO[el.cat].label}</p><p className="mt-2">{el.fact}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><div><p className="text-xs text-slate-500">Atomic number</p><b>{el.z}</b></div><div><p className="text-xs text-slate-500">Atomic mass</p><b>{el.mass}</b></div><div><p className="text-xs text-slate-500">Group · period</p><b>{el.group} · {el.period}</b></div><div><p className="text-xs text-slate-500">At room temp</p><b className="capitalize">{el.phase}</b></div><div className="col-span-2 sm:col-span-4"><p className="text-xs text-slate-500">Electron configuration</p><b>{el.config}</b></div></div>
        <p className="mt-2 text-xs text-slate-500">Protons: {el.z} · Electrons (neutral atom): {el.z}{/^\d/.test(el.mass) ? ` · Neutrons (most common isotope ≈): ${Math.round(parseFloat(el.mass)) - el.z}` : ""}</p>
      </div></div>
      <div className="mt-3 flex gap-2"><Btn disabled={sel <= 1} onClick={() => setSel(sel - 1)}>← {sel > 1 ? ELEMENTS[sel - 2].sym : ""}</Btn><Btn disabled={sel >= 118} onClick={() => setSel(sel + 1)}>{sel < 118 ? ELEMENTS[sel].sym : ""} →</Btn></div></Card>
    <div className="flex flex-wrap gap-2">{Object.entries(CAT_INFO).map(([k, v]) => <button key={k} type="button" onClick={() => setCat(cat === k ? "" : (k as ElementCat))} className={`rounded-full px-2.5 py-1 text-xs font-bold ${cat === k ? "ring-2 ring-slate-900" : ""}`} style={{ background: v.color }}>{v.label}</button>)}</div>
  </div>;
}

// ─── Fraction lab ───
function FracBar({ f, color, max = 1 }: { f: Frac; color: string; max?: number }) {
  const s = f.d > 0 ? f : { n: 0, d: 1 }; const wholes = Math.max(1, Math.ceil(Math.max(Math.abs(s.n) / s.d, max)));
  return <div className="space-y-1">{Array.from({ length: wholes }, (_, w) => <div key={w} className="flex h-9 overflow-hidden rounded-lg ring-2 ring-slate-300">{Array.from({ length: Math.min(s.d, 48) }, (_, i) => { const filled = w * s.d + i < Math.abs(s.n); return <div key={i} className="flex-1 border-r border-white/70 last:border-0" style={{ background: filled ? color : "#f8fafc" }} />; })}</div>)}</div>;
}
function FracPie({ f, color, size = 70 }: { f: Frac; color: string; size?: number }) {
  const r = size / 2 - 3, c = size / 2; const n = Math.min(f.d, 36); const take = Math.min(n, Math.max(0, f.n));
  return <svg width={size} height={size}>{Array.from({ length: n }, (_, i) => { const a0 = (i / n) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2; const d = n === 1 ? "" : `M${c},${c} L${c + r * Math.cos(a0)},${c + r * Math.sin(a0)} A${r},${r} 0 0 1 ${c + r * Math.cos(a1)},${c + r * Math.sin(a1)} Z`; return n === 1 ? <circle key={i} cx={c} cy={c} r={r} fill={take ? color : "#f8fafc"} stroke="#94a3b8" strokeWidth={1.5} /> : <path key={i} d={d} fill={i < take ? color : "#f8fafc"} stroke="#94a3b8" strokeWidth={1.5} />; })}</svg>;
}
function FracIn({ f, onChange }: { f: Frac; onChange: (f: Frac) => void }) {
  return <div className="inline-flex flex-col items-center"><input type="number" value={f.n} onChange={(e) => onChange({ ...f, n: Math.trunc(Number(e.target.value) || 0) })} className="h-12 w-20 rounded-xl border border-slate-300 text-center text-2xl font-black" aria-label="Numerator" /><div className="my-1 h-1 w-20 rounded bg-slate-800" /><input type="number" min={1} value={f.d} onChange={(e) => onChange({ ...f, d: Math.max(1, Math.trunc(Number(e.target.value) || 1)) })} className="h-12 w-20 rounded-xl border border-slate-300 text-center text-2xl font-black" aria-label="Denominator" /></div>;
}
function Fractions() {
  const { data, setData } = usePro<{ a: Frac; b: Frac; op: FracOp }>("fractions", { a: { n: 1, d: 2 }, b: { n: 1, d: 3 }, op: "+" });
  const [tab, setTab] = useState<"calc" | "compare" | "equiv">("calc");
  const { a, b, op } = data; const res = fracOp(a, b, op);
  const set = (p: Partial<typeof data>) => setData((d) => ({ ...d, ...p }));
  const cmp = fracCompare(a, b);
  return <div className="space-y-4">
    <Tabs value={tab} onChange={setTab} color="#f97316" items={[{ id: "calc", label: "Calculate" }, { id: "compare", label: "Compare" }, { id: "equiv", label: "Equivalent" }]} />
    {tab === "calc" && <>
      <Card><div className="flex flex-wrap items-center justify-center gap-4"><FracIn f={a} onChange={(f) => set({ a: f })} /><div className="flex flex-col gap-1">{(["+", "−", "×", "÷"] as FracOp[]).map((o) => <button key={o} type="button" onClick={() => set({ op: o })} className={`h-9 w-9 rounded-lg text-xl font-black ${op === o ? "bg-orange-500 text-white" : "bg-slate-100"}`}>{o}</button>)}</div><FracIn f={b} onChange={(f) => set({ b: f })} /><span className="text-4xl font-black">=</span><div className="text-center">{res ? <><p className="text-5xl font-black text-orange-600">{fracStr(res.result)}</p>{mixed(res.result) !== fracStr(res.result) && <p className="font-bold text-slate-600">= {mixed(res.result)}</p>}<p className="text-sm text-slate-500">≈ {(res.result.n / res.result.d).toFixed(3).replace(/\.?0+$/, "")}</p></> : <p className="text-rose-600">Can't divide by zero</p>}</div></div></Card>
      {res && <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><Card title="Steps"><ol className="list-decimal space-y-2 pl-5">{res.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></Card><Card title="See it"><div className="space-y-3"><div><p className="mb-1 text-sm font-bold">{fracStr(a)}</p><FracBar f={a} color="#fb923c" /></div><div><p className="mb-1 text-sm font-bold">{fracStr(b)}</p><FracBar f={b} color="#60a5fa" /></div><div><p className="mb-1 text-sm font-bold">{fracStr(res.result)}</p><FracBar f={res.result} color="#22c55e" /></div></div></Card></div>}
    </>}
    {tab === "compare" && <Card><div className="flex flex-wrap items-center justify-center gap-6"><FracIn f={a} onChange={(f) => set({ a: f })} /><span className="text-6xl font-black text-orange-600">{cmp > 0 ? ">" : cmp < 0 ? "<" : "="}</span><FracIn f={b} onChange={(f) => set({ b: f })} /></div>
      <div className="mt-4 grid grid-cols-1 gap-3"><FracBar f={a} color="#fb923c" /><FracBar f={b} color="#60a5fa" /></div>
      <p className="mt-3 text-center text-slate-700">Cross-multiply: {a.n} × {b.d} = <b>{a.n * b.d}</b> and {b.n} × {a.d} = <b>{b.n * a.d}</b>, so {fracStr(a)} {cmp > 0 ? "is bigger than" : cmp < 0 ? "is smaller than" : "equals"} {fracStr(b)}.</p></Card>}
    {tab === "equiv" && <Card><div className="flex flex-wrap items-center gap-6"><FracIn f={a} onChange={(f) => set({ a: f })} /><div><p className="text-lg">Simplest form: <b className="text-orange-600">{fracStr(simplify(a))}</b></p><p className="text-sm text-slate-500">Decimal {(a.n / a.d).toFixed(3).replace(/\.?0+$/, "")} · Percent {((a.n / a.d) * 100).toFixed(1).replace(/\.0$/, "")}%</p></div></div>
      <div className="mt-4 flex flex-wrap gap-4">{equivalents(a, 6).map((f, i) => <div key={i} className="text-center"><FracPie f={f} color="#fb923c" /><p className="font-black">{fracStr(f)}</p></div>)}</div>
      <p className="mt-2 text-sm text-slate-600">Multiply the top and bottom by the same number and the amount stays the same — the slices just get smaller.</p></Card>}
  </div>;
}

// ─── Typing ───
const PASSAGES: Record<"easy" | "medium" | "hard", string[]> = {
  easy: ["the cat sat in the sun and took a long nap", "we like to read books and play games after school", "a big red ball rolled down the hill and into the pond", "my dog likes to run fast and dig in the sand", "she put on her hat and went out to see the stars", "ten small fish swam in a ring around the rock"],
  medium: ["Practice a little every day and your fingers will learn where the keys are without looking.", "The library was quiet except for the soft sound of pages turning and a clock ticking on the wall.", "Clouds formed over the mountains, and by noon a cool rain was falling on the valley below.", "Good typists keep their wrists relaxed, sit up straight, and rest their fingers on the home row.", "Our class planted a garden with beans, tomatoes, and sunflowers that grew taller than the fence."],
  hard: ["On Tuesday, 14 students (and 2 teachers!) visited the museum's new exhibit: \"Oceans of the World.\"", "Quickly, the jovial wizard mixed 7 potions; each one fizzed, sparkled, and glowed a different color.", "Can you believe it? The recipe needs 2 1/2 cups of flour, 3 eggs, and a pinch of salt — that's all.", "Email the report to the team by 5:30 p.m.; include charts, a short summary, and next week's goals."],
};
function Typing() {
  const { data, setData } = usePro<{ level: "easy" | "medium" | "hard"; history: { day: string; wpm: number; acc: number }[]; misses: Record<string, number> }>("typing", { level: "medium", history: [], misses: {} });
  const [target, setTarget] = useState(() => PASSAGES.medium[0]); const [typed, setTyped] = useState(""); const [t0, setT0] = useState<number | null>(null); const [res, setRes] = useState<null | ReturnType<typeof typingScore>>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  useTick(t0 !== null && !res, 500);
  const pick = (lv = data.level) => { const ps = PASSAGES[lv].filter((p) => p !== target); setTarget(ps[randInt(ps.length)]); setTyped(""); setT0(null); setRes(null); window.setTimeout(() => ref.current?.focus(), 50); };
  const secs = t0 ? (Date.now() - t0) / 1000 : 0; const live = typingScore(target, typed, secs);
  const onType = (v: string) => {
    if (res) return; if (!t0 && v) setT0(Date.now()); const val = v.slice(0, target.length); setTyped(val);
    if (val.length >= target.length) { const r = typingScore(target, val, (Date.now() - (t0 || Date.now())) / 1000); setRes(r); chime(); setData((d) => { const m = { ...d.misses }; for (const [k, n] of Object.entries(r.misses)) m[k] = (m[k] || 0) + n; return { ...d, misses: m, history: [{ day: today(), wpm: r.wpm, acc: r.accuracy }, ...d.history].slice(0, 50) }; }); }
  };
  const best = data.history.reduce((m, h) => Math.max(m, h.wpm), 0);
  const problem = Object.entries(data.misses).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2"><Tabs value={data.level} onChange={(v) => { setData((d) => ({ ...d, level: v })); pick(v); }} color="#334155" items={[{ id: "easy", label: "Easy" }, { id: "medium", label: "Medium" }, { id: "hard", label: "Hard" }]} /><span className="flex-1" /><Btn onClick={() => pick()}><Shuffle size={14} />New passage</Btn></div>
    <div className="grid grid-cols-3 gap-3"><Stat label="Words per minute" value={res ? res.wpm : t0 ? live.wpm : "—"} color="#334155" /><Stat label="Accuracy" value={res ? `${res.accuracy}%` : t0 ? `${live.accuracy}%` : "—"} /><Stat label="Best" value={best ? `${best} wpm` : "—"} /></div>
    <Card><div onClick={() => ref.current?.focus()} className="cursor-text rounded-xl bg-slate-50 p-4 font-mono text-xl leading-relaxed sm:text-2xl">{target.split("").map((ch, i) => { const t = typed[i]; const cls = t === undefined ? (i === typed.length ? "border-b-2 border-slate-900 text-slate-400" : "text-slate-400") : t === ch ? "text-slate-900" : "bg-rose-200 text-rose-700"; return <span key={i} className={cls}>{ch}</span>; })}</div>
      <textarea ref={ref} value={typed} onChange={(e) => onType(e.target.value)} onPaste={(e) => e.preventDefault()} autoFocus spellCheck={false} autoCapitalize="off" autoCorrect="off" rows={2} placeholder="Start typing the passage above — the timer starts with your first key" className={`${area} mt-3 font-mono text-lg`} aria-label="Type here" disabled={!!res} />
      {res && <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 p-3"><p className="flex-1 font-bold">Done! {res.wpm} words per minute at {res.accuracy}% accuracy{res.wpm >= best && data.history.length > 1 ? " — a new best! 🎉" : ""}</p><Btn kind="primary" color="#334155" onClick={() => pick()}><RotateCcw size={14} />Next passage</Btn></div>}
    </Card>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      {data.history.length > 1 ? <Card title="Progress"><Chart kind="line" labels={[...data.history].reverse().map((_, i) => `${i + 1}`)} series={[{ name: "WPM", values: [...data.history].reverse().map((h) => h.wpm) }, { name: "Accuracy %", values: [...data.history].reverse().map((h) => h.acc) }]} height={200} colors={["#334155", "#16a34a"]} legend /></Card> : <Card title="Tips"><p className="text-sm text-slate-600">Rest your fingers on <b>A S D F</b> and <b>J K L ;</b>. Look at the screen, not the keys. Accuracy first — speed follows.</p></Card>}
      <Card title="Problem keys">{problem.length ? <div className="flex flex-wrap gap-2">{problem.map(([k, n]) => <span key={k} className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 font-mono font-bold text-white">{k}<span className="text-xs text-rose-300">{n}</span></span>)}</div> : <Empty>Keys you miss will show here.</Empty>}</Card>
    </div>
  </div>;
}

export const SCHOOL2: Record<string, ComponentType> = {
  "word-search": WordSearchApp, crossword: CrosswordApp, "math-facts": MathFacts, spelling: Spelling, periodic: Periodic, fractions: Fractions, typing: Typing,
};
