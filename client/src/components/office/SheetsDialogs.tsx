// Arise Sheets' dialogs: find and replace, conditional formatting, dropdowns and rules, sorting,
// charts, number formats, links, notes, splitting text, removing duplicates, version history,
// printing, importing, the function list, keyboard shortcuts and the AI formula helper.
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { askAppAi, docsApi } from "@/lib/cloudDocs";
import { FUNCTION_HELP, FUNCTION_NAMES, colName, formatCode, parseRangeAddr } from "@shared/office/formula";
import {
  Calc, chartData, cleanWorkbook, display, findAll, key, newId, removeDuplicates, replaceAll, setStyle, setValues, sortRange, splitToColumns, updateSheet, usedBounds,
  type Chart, type ChartKind, type CondRule, type CellStyle, type Range, type Validation, type Workbook,
} from "@shared/office/workbook";
import { ChartSvg } from "./ChartSvg";
import { ColorGrid, Dialog, Floating, Label, btnGhost, btnPrimary, field } from "./officeUi";
import { SHORTCUTS, rangeLabel, sheetPrintHtml } from "./sheetsHelpers";

export type DialogState =
  | null
  | { kind: "find"; replace: boolean }
  | { kind: "cond" } | { kind: "valid" } | { kind: "sort" } | { kind: "format" } | { kind: "link" } | { kind: "note" } | { kind: "split" } | { kind: "dedupe" }
  | { kind: "versions" } | { kind: "shortcuts" } | { kind: "functions" } | { kind: "ai" } | { kind: "print" }
  | { kind: "chart"; chartId: string }
  | { kind: "import"; incoming: Workbook; fileName: string };

type Props = {
  state: DialogState; close: () => void; wb: Workbook; si: number; sel: Range; anchor: { r: number; c: number }; calc: Calc;
  commit: (fn: (w: Workbook) => Workbook) => void; commitAny: (w: Workbook | ((w: Workbook) => Workbook)) => void; say: (m: string) => void;
  docId: string; token: string | null; selectCell: (si: number, r: number, c: number) => void; replaceAllInto: (w: Workbook) => void; startFormula: (text: string) => void;
};

export function SheetDialogs(p: Props) {
  const s = p.state;
  if (!s) return null;
  switch (s.kind) {
    case "find": return <FindDialog {...p} replace={s.replace} />;
    case "cond": return <CondDialog {...p} />;
    case "valid": return <ValidDialog {...p} />;
    case "sort": return <SortDialog {...p} />;
    case "chart": return <ChartDialog {...p} chartId={s.chartId} />;
    case "format": return <FormatDialog {...p} />;
    case "link": return <LinkDialog {...p} />;
    case "note": return <NoteDialog {...p} />;
    case "split": return <SplitDialog {...p} />;
    case "dedupe": return <DedupeDialog {...p} />;
    case "versions": return <VersionsDialog {...p} />;
    case "shortcuts": return <Dialog title="Keyboard shortcuts" onClose={p.close} wide><div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">{SHORTCUTS.map(([k, d]) => <div key={k} className="flex justify-between gap-3 border-b border-slate-100 py-1"><span className="text-slate-700">{d}</span><kbd className="shrink-0 rounded bg-slate-100 px-1.5 font-mono text-xs text-slate-700">{k}</kbd></div>)}</div><p className="mt-3 text-xs text-slate-500">On a Mac, use ⌘ instead of Ctrl.</p></Dialog>;
    case "functions": return <FunctionsDialog {...p} />;
    case "ai": return <AiDialog {...p} />;
    case "print": return <PrintDialog {...p} />;
    case "import": return <ImportDialog {...p} incoming={s.incoming} fileName={s.fileName} />;
  }
}

// ─── Find and replace ───
function FindDialog({ close, wb, si, calc, selectCell, replaceAllInto, say, replace }: Props & { replace: boolean }) {
  const [q, setQ] = useState("");
  const [rep, setRep] = useState("");
  const [opts, setOpts] = useState({ all: false, caseSensitive: false, whole: false, formulas: false });
  const [i, setI] = useState(-1);
  const hits = useMemo(() => findAll(wb, calc, q, { ...opts, si }), [wb, calc, q, opts, si]);
  const next = (d: 1 | -1) => { if (!hits.length) { say(`No matches for "${q}".`); return; } const n = (i + d + hits.length) % hits.length; setI(n); selectCell(hits[n].si, hits[n].r, hits[n].c); };
  const replaceOne = () => {
    if (i < 0 || !hits[i]) { next(1); return; }
    replaceAllInto(replaceAll(wb, [hits[i]], q, rep, opts.caseSensitive));
    next(1);
  };
  const doAll = () => { if (!hits.length) { say(`No matches for "${q}".`); return; } const target = opts.formulas ? hits : hits.filter((h) => !(wb.sheets[h.si].cells[key(h.r, h.c)]?.v || "").startsWith("=")); replaceAllInto(replaceAll(wb, target, q, rep, opts.caseSensitive)); say(`Replaced ${target.length} ${target.length === 1 ? "cell" : "cells"}.`); setI(-1); };
  return <Dialog title={replace ? "Find and replace" : "Find"} onClose={close} testId="sheets-find"
    footer={<>{replace && <><button type="button" className={btnGhost} onClick={replaceOne} disabled={!q}>Replace</button><button type="button" className={btnGhost} onClick={doAll} disabled={!q}>Replace all</button></>}
      <button type="button" className={btnGhost} onClick={() => next(-1)} disabled={!q}>Previous</button><button type="button" className={btnPrimary} onClick={() => next(1)} disabled={!q}>Find next</button></>}>
    <div className="space-y-3">
      <Label text="Find"><input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setI(-1); }} onKeyDown={(e) => { if (e.key === "Enter") next(e.shiftKey ? -1 : 1); }} className={field} /></Label>
      {replace && <Label text="Replace with"><input value={rep} onChange={(e) => setRep(e.target.value)} className={field} /></Label>}
      <div className="grid grid-cols-2 gap-2 text-sm">
        {([["all", "Search all sheets"], ["caseSensitive", "Match case"], ["whole", "Match entire cell"], ["formulas", "Also search in formulas"]] as const).map(([k, l]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={opts[k]} onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })} />{l}</label>)}
      </div>
      {q && <p className="text-xs font-semibold text-slate-500">{hits.length ? `${i >= 0 ? `${i + 1} of ` : ""}${hits.length} match${hits.length === 1 ? "" : "es"}` : "No matches"}</p>}
    </div>
  </Dialog>;
}

// ─── Conditional formatting ───
const COND_KINDS: { id: CondRule["kind"]; label: string; args: 0 | 1 | 2; text?: boolean }[] = [
  { id: "gt", label: "Greater than", args: 1 }, { id: "ge", label: "Greater than or equal to", args: 1 }, { id: "lt", label: "Less than", args: 1 }, { id: "le", label: "Less than or equal to", args: 1 },
  { id: "eq", label: "Is equal to", args: 1, text: true }, { id: "ne", label: "Is not equal to", args: 1, text: true }, { id: "between", label: "Is between", args: 2 },
  { id: "contains", label: "Text contains", args: 1, text: true }, { id: "notContains", label: "Text does not contain", args: 1, text: true },
  { id: "empty", label: "Is empty", args: 0 }, { id: "notEmpty", label: "Is not empty", args: 0 }, { id: "dup", label: "Duplicate values", args: 0 },
  { id: "top", label: "Top N values", args: 1 }, { id: "bottom", label: "Bottom N values", args: 1 }, { id: "aboveAvg", label: "Above average", args: 0 }, { id: "belowAvg", label: "Below average", args: 0 },
  { id: "formula", label: "Custom formula is", args: 1, text: true }, { id: "scale", label: "Colour scale", args: 0 }, { id: "bars", label: "Data bars", args: 0 },
];
const STYLE_PRESETS: { label: string; style: CellStyle }[] = [
  { label: "Red", style: { bg: "#fee2e2", c: "#991b1b" } }, { label: "Green", style: { bg: "#dcfce7", c: "#166534" } }, { label: "Yellow", style: { bg: "#fef9c3", c: "#854d0e" } },
  { label: "Blue", style: { bg: "#dbeafe", c: "#1e40af" } }, { label: "Bold red text", style: { c: "#dc2626", b: true } }, { label: "Strike", style: { s: true, c: "#94a3b8" } },
];
function CondDialog({ close, wb, si, sel, commit }: Props) {
  const sheet = wb.sheets[si];
  const blank = (): CondRule => ({ id: newId(), range: rangeLabel(sel), kind: "gt", a: "", style: STYLE_PRESETS[0].style });
  const [editing, setEditing] = useState<CondRule | null>(sheet.cond.length ? null : blank());
  const [pick, setPick] = useState<{ which: "bg" | "c" | "min" | "mid" | "max"; el: HTMLElement } | null>(null);
  const save = () => {
    if (!editing) return;
    if (!parseRangeAddr(editing.range)) return;
    commit((w) => updateSheet(w, si, (s) => ({ ...s, cond: s.cond.some((r) => r.id === editing.id) ? s.cond.map((r) => (r.id === editing.id ? editing : r)) : [...s.cond, editing] })));
    setEditing(null);
  };
  const del = (id: string) => commit((w) => updateSheet(w, si, (s) => ({ ...s, cond: s.cond.filter((r) => r.id !== id) })));
  const k = editing ? COND_KINDS.find((x) => x.id === editing.kind)! : null;
  return <Dialog title="Conditional formatting" onClose={close} testId="sheets-cond" footer={editing ? <><button type="button" className={btnGhost} onClick={() => setEditing(null)}>Cancel</button><button type="button" className={btnPrimary} onClick={save} disabled={!parseRangeAddr(editing.range)}>Done</button></> : <button type="button" className={btnPrimary} onClick={() => setEditing(blank())}>+ Add another rule</button>}>
    {!editing ? <div className="space-y-2">
      {sheet.cond.length === 0 && <p className="text-slate-500">No rules on this sheet yet.</p>}
      {sheet.cond.map((r) => { const kk = COND_KINDS.find((x) => x.id === r.kind); return <div key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5">
        <span className="flex h-8 w-10 items-center justify-center rounded-md text-xs font-bold" style={{ background: r.kind === "scale" ? `linear-gradient(90deg, ${r.min || "#fff"}, ${r.mid || r.max || "#4ade80"}, ${r.max || "#4ade80"})` : r.kind === "bars" ? r.max || "#60a5fa" : r.style?.bg || "#fff", color: r.style?.c, fontWeight: r.style?.b ? 700 : 400, textDecoration: r.style?.s ? "line-through" : undefined }}>123</span>
        <button type="button" onClick={() => setEditing(r)} className="min-w-0 flex-1 text-left"><span className="block font-bold">{kk?.label}{r.a ? ` ${r.a}` : ""}{r.kind === "between" ? ` and ${r.b}` : ""}</span><span className="block font-mono text-xs text-slate-500">{r.range}</span></button>
        <button type="button" onClick={() => del(r.id)} aria-label="Delete rule" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
      </div>; })}
    </div> : <div className="space-y-3">
      <Label text="Apply to range"><input value={editing.range} onChange={(e) => setEditing({ ...editing, range: e.target.value.toUpperCase() })} className={`${field} font-mono`} /></Label>
      <Label text="Format cells if…"><select value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as CondRule["kind"], ...(e.target.value === "scale" ? { min: "#f87171", mid: "#fde68a", max: "#4ade80" } : e.target.value === "bars" ? { max: "#60a5fa" } : {}) })} className={field}>{COND_KINDS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></Label>
      {k && k.args >= 1 && <div className="flex gap-2"><input value={editing.a || ""} onChange={(e) => setEditing({ ...editing, a: e.target.value })} placeholder={editing.kind === "formula" ? `e.g. =$C2>100` : k.text ? "Value or text" : "Number"} className={`${field} ${editing.kind === "formula" ? "font-mono" : ""}`} />{k.args === 2 && <input value={editing.b || ""} onChange={(e) => setEditing({ ...editing, b: e.target.value })} placeholder="and" className={field} />}</div>}
      {editing.kind === "formula" && <p className="text-xs text-slate-500">Write it for the top-left cell of the range; it moves along for every other cell. Use $ to keep a column or row fixed.</p>}
      {editing.kind === "scale" ? <div className="flex items-center gap-3">{(["min", "mid", "max"] as const).map((w) => <button key={w} type="button" onClick={(e) => setPick({ which: w, el: e.currentTarget })} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold"><span className="h-4 w-4 rounded" style={{ background: editing[w] || "#fff" }} />{w === "min" ? "Lowest" : w === "mid" ? "Middle" : "Highest"}</button>)}</div>
        : editing.kind === "bars" ? <button type="button" onClick={(e) => setPick({ which: "max", el: e.currentTarget })} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold"><span className="h-4 w-4 rounded" style={{ background: editing.max || "#60a5fa" }} />Bar colour</button>
        : <div>
          <p className="mb-1 text-xs font-bold text-slate-600">Formatting style</p>
          <div className="mb-2 flex flex-wrap gap-1.5">{STYLE_PRESETS.map((sp) => <button key={sp.label} type="button" onClick={() => setEditing({ ...editing, style: sp.style })} className="rounded-md px-2 py-1 text-xs ring-1 ring-slate-200" style={{ background: sp.style.bg, color: sp.style.c, fontWeight: sp.style.b ? 700 : 400, textDecoration: sp.style.s ? "line-through" : undefined }}>{sp.label}</button>)}</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["b", "i", "u", "s"] as const).map((f) => <button key={f} type="button" onClick={() => setEditing({ ...editing, style: { ...editing.style, [f]: editing.style?.[f] ? undefined : true } })} className={`h-8 w-8 rounded-md text-sm ring-1 ring-slate-200 ${editing.style?.[f] ? "bg-sky-100 text-sky-800" : ""}`} style={{ fontWeight: f === "b" ? 700 : 400, fontStyle: f === "i" ? "italic" : undefined, textDecoration: f === "u" ? "underline" : f === "s" ? "line-through" : undefined }}>{f === "b" ? "B" : f === "i" ? "I" : f === "u" ? "U" : "S"}</button>)}
            <button type="button" onClick={(e) => setPick({ which: "c", el: e.currentTarget })} className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-bold ring-1 ring-slate-200"><span className="h-3.5 w-3.5 rounded" style={{ background: editing.style?.c || "#000" }} />Text</button>
            <button type="button" onClick={(e) => setPick({ which: "bg", el: e.currentTarget })} className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-bold ring-1 ring-slate-200"><span className="h-3.5 w-3.5 rounded border border-slate-200" style={{ background: editing.style?.bg || "#fff" }} />Fill</button>
          </div>
        </div>}
      {pick && <Floating anchor={pick.el} onClose={() => setPick(null)}><ColorGrid value={pick.which === "bg" || pick.which === "c" ? editing.style?.[pick.which] : editing[pick.which]} onPick={(c) => { if (pick.which === "bg" || pick.which === "c") setEditing({ ...editing, style: { ...editing.style, [pick.which]: c } }); else setEditing({ ...editing, [pick.which]: c }); setPick(null); }} /></Floating>}
    </div>}
  </Dialog>;
}

// ─── Dropdowns and rules ───
function ValidDialog({ close, wb, si, sel, commit, calc }: Props) {
  const sheet = wb.sheets[si];
  const existing = sheet.valid.find((v) => { const g = parseRangeAddr(v.range); return g && g.r1 <= sel.r1 && g.r2 >= sel.r1 && g.c1 <= sel.c1 && g.c2 >= sel.c1; });
  const [rule, setRule] = useState<Validation>(existing || { id: newId(), range: rangeLabel(sel), kind: "list", list: [], strict: false });
  const [items, setItems] = useState((existing?.list || []).join("\n"));
  const fromRange = () => {
    // Fill choices from the values already in the selected column.
    const g = parseRangeAddr(rule.range); if (!g) return;
    const b = usedBounds(sheet); const seen = new Set<string>();
    for (let r = 0; r < b.rows; r++) { const t = display(calc.value(si, r, g.c1), sheet.cells[key(r, g.c1)]?.s, sheet.cells[key(r, g.c1)]?.v || ""); if (t && r >= g.r1 && r <= g.r2) seen.add(t); }
    setItems([...seen].slice(0, 100).join("\n"));
  };
  const save = () => {
    const next: Validation = { ...rule, ...(rule.kind === "list" ? { list: items.split(/\n|,/).map((x) => x.trim()).filter(Boolean).slice(0, 200) } : {}) };
    commit((w) => updateSheet(w, si, (s) => ({ ...s, valid: [...s.valid.filter((v) => v.id !== next.id), next] })));
    close();
  };
  const remove = () => { commit((w) => updateSheet(w, si, (s) => ({ ...s, valid: s.valid.filter((v) => v.id !== rule.id) }))); close(); };
  return <Dialog title="Dropdowns and data rules" onClose={close} testId="sheets-valid" footer={<>{existing && <button type="button" className={`${btnGhost} text-rose-600`} onClick={remove}>Remove rule</button>}<button type="button" className={btnGhost} onClick={close}>Cancel</button><button type="button" className={btnPrimary} onClick={save} disabled={!parseRangeAddr(rule.range)}>Done</button></>}>
    <div className="space-y-3">
      <Label text="Apply to range"><input value={rule.range} onChange={(e) => setRule({ ...rule, range: e.target.value.toUpperCase() })} className={`${field} font-mono`} /></Label>
      <Label text="Criteria"><select value={rule.kind} onChange={(e) => setRule({ ...rule, kind: e.target.value as Validation["kind"] })} className={field}><option value="list">Dropdown (list of choices)</option><option value="number">Number between</option><option value="date">Is a valid date</option><option value="checkbox">Checkbox</option></select></Label>
      {rule.kind === "list" && <div><Label text="Choices (one per line)"><textarea value={items} onChange={(e) => setItems(e.target.value)} rows={5} placeholder={"Not started\nIn progress\nDone"} className={`${field} h-auto py-2`} /></Label><button type="button" onClick={fromRange} className="mt-1 text-xs font-bold text-sky-700">Use the values already in this range</button></div>}
      {rule.kind === "number" && <div className="flex gap-2"><Label text="Minimum"><input type="number" value={rule.min ?? ""} onChange={(e) => setRule({ ...rule, min: e.target.value === "" ? undefined : Number(e.target.value) })} className={field} /></Label><Label text="Maximum"><input type="number" value={rule.max ?? ""} onChange={(e) => setRule({ ...rule, max: e.target.value === "" ? undefined : Number(e.target.value) })} className={field} /></Label></div>}
      <Label text="Help text (optional)"><input value={rule.help || ""} onChange={(e) => setRule({ ...rule, help: e.target.value })} placeholder="Shown when something isn't allowed" className={field} /></Label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={!!rule.strict} onChange={(e) => setRule({ ...rule, strict: e.target.checked })} />Reject anything else (otherwise just allow it)</label>
    </div>
  </Dialog>;
}

// ─── Sort ───
function SortDialog({ close, wb, si, sel, commit, say }: Props) {
  const [range, setRange] = useState(rangeLabel(sel));
  const [headers, setHeaders] = useState(true);
  const g = parseRangeAddr(range);
  const sheet = wb.sheets[si];
  const [by, setBy] = useState<{ c: number; dir: 1 | -1 }[]>([{ c: sel.c1, dir: 1 }]);
  const colLabel = (c: number) => (headers && g ? `${colName(c)} — ${sheet.cells[key(g.r1, c)]?.v || ""}` : `Column ${colName(c)}`);
  const cols = g ? Array.from({ length: g.c2 - g.c1 + 1 }, (_, i) => g.c1 + i) : [];
  const run = () => { if (!g) return; commit((w) => sortRange(w, si, g, by, headers, new Calc(w))); say("Sorted."); close(); };
  return <Dialog title="Sort range" onClose={close} footer={<><button type="button" className={btnGhost} onClick={close}>Cancel</button><button type="button" className={btnPrimary} onClick={run} disabled={!g}>Sort</button></>}>
    <div className="space-y-3">
      <Label text="Range"><input value={range} onChange={(e) => setRange(e.target.value.toUpperCase())} className={`${field} font-mono`} /></Label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={headers} onChange={(e) => setHeaders(e.target.checked)} />The first row is a header row</label>
      {by.map((b, i) => <div key={i} className="flex items-center gap-2"><span className="w-16 text-xs font-bold text-slate-500">{i ? "then by" : "Sort by"}</span>
        <select value={b.c} onChange={(e) => setBy(by.map((x, j) => (j === i ? { ...x, c: Number(e.target.value) } : x)))} className={field}>{cols.map((c) => <option key={c} value={c}>{colLabel(c)}</option>)}</select>
        <select value={b.dir} onChange={(e) => setBy(by.map((x, j) => (j === i ? { ...x, dir: Number(e.target.value) as 1 | -1 } : x)))} className={`${field} w-28`}><option value={1}>A → Z</option><option value={-1}>Z → A</option></select>
        {i > 0 && <button type="button" onClick={() => setBy(by.filter((_, j) => j !== i))} aria-label="Remove" className="text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button>}
      </div>)}
      {g && by.length < 4 && <button type="button" className="text-xs font-bold text-sky-700" onClick={() => setBy([...by, { c: g.c1, dir: 1 }])}>+ Add another sort column</button>}
    </div>
  </Dialog>;
}

// ─── Charts ───
const CHART_KINDS: { id: ChartKind; label: string }[] = [{ id: "column", label: "Column" }, { id: "bar", label: "Bar" }, { id: "line", label: "Line" }, { id: "area", label: "Area" }, { id: "pie", label: "Pie" }, { id: "doughnut", label: "Doughnut" }, { id: "scatter", label: "Scatter" }];
function ChartDialog({ close, wb, si, calc, commit, chartId }: Props & { chartId: string }) {
  const orig = wb.sheets[si].charts.find((c) => c.id === chartId);
  const [ch, setCh] = useState<Chart | undefined>(orig);
  useEffect(() => { if (!orig) close(); }, [orig, close]);
  if (!ch) return null;
  const data = chartData(wb, si, calc, ch);
  const save = () => { commit((w) => updateSheet(w, si, (s) => ({ ...s, charts: s.charts.map((c) => (c.id === ch.id ? ch : c)) }))); close(); };
  return <Dialog title="Chart editor" onClose={close} wide testId="sheets-chart-dialog" footer={<><button type="button" className={btnGhost} onClick={close}>Cancel</button><button type="button" className={btnPrimary} onClick={save}>Done</button></>}>
    <div className="grid gap-4 sm:grid-cols-[1fr_300px]">
      <div className="overflow-hidden rounded-xl ring-1 ring-slate-200"><ChartSvg kind={ch.kind} labels={data.labels} series={data.series} title={ch.title} legend={ch.legend} stacked={ch.stacked} width={420} height={280} /></div>
      <div className="space-y-3">
        <div><p className="mb-1 text-xs font-bold text-slate-600">Chart type</p><div className="grid grid-cols-4 gap-1">{CHART_KINDS.map((k) => <button key={k.id} type="button" onClick={() => setCh({ ...ch, kind: k.id })} className={`rounded-md px-1 py-1.5 text-xs font-bold ring-1 ${ch.kind === k.id ? "bg-sky-50 text-sky-800 ring-sky-300" : "ring-slate-200"}`}>{k.label}</button>)}</div></div>
        <Label text="Data range"><input value={ch.range} onChange={(e) => setCh({ ...ch, range: e.target.value.toUpperCase() })} className={`${field} font-mono`} /></Label>
        <Label text="Title"><input value={ch.title} onChange={(e) => setCh({ ...ch, title: e.target.value })} className={field} /></Label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={ch.headers} onChange={(e) => setCh({ ...ch, headers: e.target.checked })} />Use the first row as headers</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={ch.legend} onChange={(e) => setCh({ ...ch, legend: e.target.checked })} />Show legend</label>
        {["column", "bar", "area"].includes(ch.kind) && <label className="flex items-center gap-2"><input type="checkbox" checked={!!ch.stacked} onChange={(e) => setCh({ ...ch, stacked: e.target.checked })} />Stacked</label>}
        <p className="text-xs text-slate-500">The first column is the labels; each column after it is a series. Drag the chart to move it and its corner to resize.</p>
      </div>
    </div>
  </Dialog>;
}

// ─── Number format ───
function FormatDialog({ close, wb, si, anchor, calc, commit, sel }: Props) {
  const cell = wb.sheets[si].cells[key(anchor.r, anchor.c)];
  const [code, setCode] = useState(cell?.s?.nf && cell.s.nf !== "checkbox" ? cell.s.nf : "#,##0.00");
  const v = calc.value(si, anchor.r, anchor.c);
  const sample = typeof v === "number" ? v : 1234.5;
  let preview = "";
  try { preview = formatCode(sample, code); } catch { preview = "—"; }
  const examples = ["0", "0.00", "#,##0", "#,##0.00", "$#,##0.00", "0%", "0.0%", "0.00E+00", "m/d/yyyy", "mmmm d, yyyy", "ddd, mmm d", "h:mm AM/PM", '#,##0 "pts"', '0.0 "kg"', "$#,##0.00;($#,##0.00)"];
  return <Dialog title="Custom number format" onClose={close} footer={<><button type="button" className={btnGhost} onClick={close}>Cancel</button><button type="button" className={btnPrimary} onClick={() => { commit((w) => setStyle(w, si, sel, { nf: code })); close(); }}>Apply</button></>}>
    <div className="space-y-3">
      <Label text="Format code"><input autoFocus value={code} onChange={(e) => setCode(e.target.value)} className={`${field} font-mono`} /></Label>
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm">Preview: <b>{preview}</b></p>
      <div className="flex flex-wrap gap-1.5">{examples.map((x) => <button key={x} type="button" onClick={() => setCode(x)} className="rounded-md bg-white px-2 py-1 font-mono text-xs ring-1 ring-slate-200 hover:bg-slate-50">{x}</button>)}</div>
      <p className="text-xs text-slate-500">0 is a digit that always shows, # one that shows only when needed, a comma adds thousands separators, and text in "quotes" shows as it is. Dates use d, m, y; times h, m, s and AM/PM.</p>
    </div>
  </Dialog>;
}

// ─── Link and note ───
function LinkDialog({ close, wb, si, anchor, commit }: Props) {
  const cell = wb.sheets[si].cells[key(anchor.r, anchor.c)];
  const [text, setText] = useState(cell?.v && !cell.v.startsWith("=") ? cell.v : "");
  const [url, setUrl] = useState(cell?.link || "");
  const fixed = url && !/^https?:\/\//i.test(url) ? `https://${url}` : url;
  const save = (remove = false) => {
    commit((w) => updateSheet(w, si, (s) => {
      const k = key(anchor.r, anchor.c); const old = s.cells[k] || { v: "" };
      const next = { ...old, v: remove ? old.v : text || fixed };
      if (remove || !fixed) delete next.link; else next.link = fixed;
      return { ...s, cells: { ...s.cells, [k]: next } };
    }));
    close();
  };
  return <Dialog title="Link" onClose={close} footer={<>{cell?.link && <button type="button" className={`${btnGhost} text-rose-600`} onClick={() => save(true)}>Remove link</button>}<button type="button" className={btnGhost} onClick={close}>Cancel</button><button type="button" className={btnPrimary} onClick={() => save()} disabled={!url}>Apply</button></>}>
    <div className="space-y-3"><Label text="Text"><input value={text} onChange={(e) => setText(e.target.value)} className={field} /></Label><Label text="Link (web address)"><input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={field} /></Label></div>
  </Dialog>;
}
function NoteDialog({ close, wb, si, anchor, commit }: Props) {
  const cell = wb.sheets[si].cells[key(anchor.r, anchor.c)];
  const [note, setNote] = useState(cell?.n || "");
  const save = (text: string) => {
    commit((w) => updateSheet(w, si, (s) => {
      const k = key(anchor.r, anchor.c); const old = s.cells[k] || { v: "" };
      const next = { ...old }; if (text.trim()) next.n = text.trim().slice(0, 2000); else delete next.n;
      const cells = { ...s.cells }; if (!next.v && !next.s && !next.n) delete cells[k]; else cells[k] = next;
      return { ...s, cells };
    }));
    close();
  };
  return <Dialog title={`Note on ${colName(anchor.c)}${anchor.r + 1}`} onClose={close} footer={<>{cell?.n && <button type="button" className={`${btnGhost} text-rose-600`} onClick={() => save("")}>Delete note</button>}<button type="button" className={btnGhost} onClick={close}>Cancel</button><button type="button" className={btnPrimary} onClick={() => save(note)}>Save</button></>}>
    <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={5} placeholder="A reminder about this cell…" className={`${field} h-auto py-2`} />
  </Dialog>;
}

// ─── Split / remove duplicates ───
function SplitDialog({ close, si, sel, commit, say }: Props) {
  const [sep, setSep] = useState(",");
  const [custom, setCustom] = useState("");
  return <Dialog title="Split text to columns" onClose={close} footer={<><button type="button" className={btnGhost} onClick={close}>Cancel</button><button type="button" className={btnPrimary} onClick={() => { commit((w) => splitToColumns(w, si, sel, sep === "custom" ? custom || "," : sep)); say("Split."); close(); }}>Split</button></>}>
    <p className="mb-2 text-slate-600">Splits the text in column {colName(sel.c1)} (rows {sel.r1 + 1}–{sel.r2 + 1}) into the columns to its right.</p>
    <div className="grid grid-cols-2 gap-2">{[[",", "Comma"], [";", "Semicolon"], [" ", "Space"], ["\\t", "Tab"], ["-", "Dash"], ["custom", "Custom"]].map(([v, l]) => <label key={v} className="flex items-center gap-2"><input type="radio" checked={sep === v} onChange={() => setSep(v)} />{l}</label>)}</div>
    {sep === "custom" && <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Separator" className={`${field} mt-2`} />}
  </Dialog>;
}
function DedupeDialog({ close, wb, si, sel, calc, commit, say }: Props) {
  const [headers, setHeaders] = useState(true);
  const cols = Array.from({ length: sel.c2 - sel.c1 + 1 }, (_, i) => sel.c1 + i);
  const [on, setOn] = useState<Set<number>>(new Set(cols));
  const run = () => {
    let removed = 0;
    commit((w) => { const r = removeDuplicates(w, si, sel, [...on], headers, new Calc(w)); removed = r.removed; return r.wb; });
    window.setTimeout(() => say(removed ? `Removed ${removed} duplicate row${removed === 1 ? "" : "s"}.` : "No duplicates found."), 0);
    close();
  };
  void calc;
  return <Dialog title="Remove duplicates" onClose={close} footer={<><button type="button" className={btnGhost} onClick={close}>Cancel</button><button type="button" className={btnPrimary} onClick={run} disabled={!on.size || sel.r2 <= sel.r1}>Remove duplicates</button></>}>
    <p className="mb-2 font-mono text-xs text-slate-500">{rangeLabel(sel)}</p>
    {sel.r2 <= sel.r1 && <p className="mb-2 text-amber-700">Select the rows to check first (more than one row).</p>}
    <label className="mb-2 flex items-center gap-2"><input type="checkbox" checked={headers} onChange={(e) => setHeaders(e.target.checked)} />Data has a header row</label>
    <p className="mb-1 text-xs font-bold text-slate-600">Columns to compare</p>
    <div className="grid grid-cols-2 gap-1">{cols.slice(0, 40).map((c) => <label key={c} className="flex items-center gap-2"><input type="checkbox" checked={on.has(c)} onChange={(e) => { const n = new Set(on); if (e.target.checked) n.add(c); else n.delete(c); setOn(n); }} />Column {colName(c)}{headers ? ` — ${wb.sheets[si].cells[key(sel.r1, c)]?.v || ""}` : ""}</label>)}</div>
  </Dialog>;
}

// ─── Version history ───
function VersionsDialog({ close, docId, token, commitAny, say }: Props) {
  const [list, setList] = useState<{ at: number }[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  useEffect(() => { docsApi(token).versions(docId).then(setList).catch((e) => setErr(e.message)); }, [docId, token]);
  const restore = async (at: number) => {
    setBusy(at);
    try { const v = await docsApi(token).version<unknown>(docId, at); commitAny(cleanWorkbook(v.content)); say(`Restored the version from ${new Date(at).toLocaleString()}. Undo brings back what you had.`); close(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  };
  return <Dialog title="Version history" onClose={close}>
    <p className="mb-3 text-slate-600">A copy is kept every 10 minutes while you work (the last 25).</p>
    {err && <p className="mb-2 text-rose-600">{err}</p>}
    {!list ? <p className="text-slate-500">Loading…</p> : list.length === 0 ? <p className="text-slate-500">No earlier versions yet. Keep working and they'll show up here.</p>
      : <ul className="divide-y divide-slate-100">{list.map((v) => <li key={v.at} className="flex items-center justify-between py-2"><span>{new Date(v.at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span><button type="button" onClick={() => void restore(v.at)} disabled={busy !== null} className={btnGhost}>{busy === v.at ? "Restoring…" : "Restore"}</button></li>)}</ul>}
  </Dialog>;
}

// ─── Functions ───
function FunctionsDialog({ close, startFormula }: Props) {
  const [q, setQ] = useState("");
  const list = FUNCTION_NAMES.filter((f) => f.includes(q.toUpperCase()) || (FUNCTION_HELP[f] || "").toLowerCase().includes(q.toLowerCase()));
  return <Dialog title="Functions" onClose={close} wide>
    <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search functions (sum, date, lookup…)" className={`${field} mb-3`} />
    <p className="mb-2 text-xs text-slate-500">{FUNCTION_NAMES.length} functions. Tap one to start a formula with it.</p>
    <div className="grid gap-1 sm:grid-cols-2">{list.map((f) => <button key={f} type="button" onClick={() => startFormula(`=${f}(`)} className="rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-50">
      <span className="font-mono text-sm font-bold">{f}</span>{FUNCTION_HELP[f] && <span className="block text-xs text-slate-500">{FUNCTION_HELP[f]}</span>}
    </button>)}</div>
  </Dialog>;
}

// ─── AI formula helper ───
function AiDialog({ close, wb, si, anchor, token, commit, say, sel }: Props) {
  const sheet = wb.sheets[si];
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ formula: string; explain: string } | null>(null);
  const [err, setErr] = useState("");
  const headers = useMemo(() => {
    const b = usedBounds(sheet);
    const out: string[] = [];
    for (let c = 0; c < Math.min(b.cols, 26); c++) { const h = sheet.cells[key(0, c)]?.v; if (h) out.push(`${colName(c)}: ${h} (rows 2-${b.rows})`); }
    return out.join("; ");
  }, [sheet]);
  const run = async () => {
    setBusy(true); setErr(""); setRes(null);
    try { const r = await askAppAi<{ formula: string; explain: string }>(token, "sheet-formula", { ask: `${ask} (selection is ${rangeLabel(sel)}, the answer goes in ${colName(anchor.c)}${anchor.r + 1})`, headers: headers || "none" }); if (!r?.formula?.startsWith("=")) throw new Error("No formula came back. Try saying it another way."); setRes(r); }
    catch (e: any) { setErr(e.message || "The AI helper couldn't answer. Try again."); } finally { setBusy(false); }
  };
  return <Dialog title="AI formula helper" onClose={close} footer={<>{res && <button type="button" className={btnPrimary} onClick={() => { commit((w) => setValues(w, si, [{ r: anchor.r, c: anchor.c, v: res.formula }])); say(`Formula put in ${colName(anchor.c)}${anchor.r + 1}.`); close(); }}>Insert in {colName(anchor.c)}{anchor.r + 1}</button>}<button type="button" className={res ? btnGhost : btnPrimary} onClick={() => void run()} disabled={!ask.trim() || busy}><Sparkles size={14} />{busy ? "Thinking…" : res ? "Try again" : "Write the formula"}</button></>}>
    <Label text="What do you want to work out?"><textarea autoFocus value={ask} onChange={(e) => setAsk(e.target.value)} rows={3} placeholder="e.g. the average score for students in period 2, or how many tasks are Done" className={`${field} h-auto py-2`} /></Label>
    {headers && <p className="mt-2 text-xs text-slate-500">Columns it can see: {headers.slice(0, 220)}{headers.length > 220 ? "…" : ""}</p>}
    {err && <p className="mt-2 text-rose-600">{err}</p>}
    {res && <div className="mt-3 rounded-xl bg-violet-50 p-3 ring-1 ring-violet-200"><code className="block break-all font-mono text-sm font-bold text-violet-900">{res.formula}</code><p className="mt-1 text-sm text-violet-900">{res.explain}</p></div>}
  </Dialog>;
}

// ─── Print / PDF ───
function PrintDialog({ close, wb, si, calc, sel, say }: Props) {
  const [what, setWhat] = useState<"sheet" | "selection">(sel.r2 > sel.r1 || sel.c2 > sel.c1 ? "selection" : "sheet");
  const [landscape, setLandscape] = useState(usedBounds(wb.sheets[si]).cols > 6);
  const [grid, setGrid] = useState(false);
  const [fit, setFit] = useState(true);
  const go = () => {
    const html = sheetPrintHtml(wb, si, calc, { title: wb.sheets[si].name, range: what === "selection" ? sel : undefined, gridlines: grid, landscape, fit });
    const w = window.open("", "_blank");
    if (!w) { say("Allow pop-ups for Arise to print."); return; }
    w.document.open(); w.document.write(html); w.document.close(); w.focus();
    window.setTimeout(() => { try { w.print(); } catch { /* still open to print by hand */ } }, 500);
    close();
  };
  return <Dialog title="Print or save as PDF" onClose={close} footer={<><button type="button" className={btnGhost} onClick={close}>Cancel</button><button type="button" className={btnPrimary} onClick={go}>Next</button></>}>
    <div className="space-y-3">
      <Label text="Print"><select value={what} onChange={(e) => setWhat(e.target.value as "sheet" | "selection")} className={field}><option value="sheet">This sheet ({wb.sheets[si].name})</option><option value="selection">Selected cells ({rangeLabel(sel)})</option></select></Label>
      <Label text="Page orientation"><select value={landscape ? "l" : "p"} onChange={(e) => setLandscape(e.target.value === "l")} className={field}><option value="p">Portrait</option><option value="l">Landscape</option></select></Label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={fit} onChange={(e) => setFit(e.target.checked)} />Fit to page width</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} />Show gridlines</label>
      <p className="text-xs text-slate-500">To make a PDF, choose "Save as PDF" as the printer.</p>
    </div>
  </Dialog>;
}

// ─── Import ───
function ImportDialog({ close, commitAny, say, incoming, fileName }: Props & { incoming: Workbook; fileName: string }) {
  const [how, setHow] = useState<"add" | "replace">("add");
  const go = () => {
    if (how === "replace") commitAny({ ...incoming, active: 0 });
    else commitAny((w) => {
      const names = new Set(w.sheets.map((s) => s.name.toLowerCase()));
      const add = incoming.sheets.map((s) => { let n = s.name, i = 2; while (names.has(n.toLowerCase())) n = `${s.name} (${i++})`; names.add(n.toLowerCase()); return { ...s, id: newId(), name: n }; });
      return { ...w, sheets: [...w.sheets, ...add].slice(0, 60), active: Math.min(59, w.sheets.length) };
    });
    say(`Imported ${fileName}.`);
    close();
  };
  return <Dialog title={`Import ${fileName}`} onClose={close} footer={<><button type="button" className={btnGhost} onClick={close}>Cancel</button><button type="button" className={btnPrimary} onClick={go}>Import</button></>}>
    <p className="mb-3 text-slate-600">{incoming.sheets.length} sheet{incoming.sheets.length === 1 ? "" : "s"}: {incoming.sheets.map((s) => s.name).join(", ")}</p>
    <label className="mb-2 flex items-center gap-2"><input type="radio" checked={how === "add"} onChange={() => setHow("add")} />Add as new sheets</label>
    <label className="flex items-center gap-2"><input type="radio" checked={how === "replace"} onChange={() => setHow("replace")} />Replace this spreadsheet (undo brings it back)</label>
  </Dialog>;
}

