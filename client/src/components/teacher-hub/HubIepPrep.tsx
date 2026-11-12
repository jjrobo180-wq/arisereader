// Arise WorkHub, IEP → Prep: the planning-period checklist. Today's jobs to check off, anything missed
// this week, what's next, and every job with how it repeats. The rules are in shared/hubPrep.ts.
import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Pause, Pencil, Play, Plus, Printer, Trash2 } from "lucide-react";
import {
  PREP_KIND_LABELS, PREP_KINDS, PREP_REPEAT_LABELS, PREP_REPEATS, PREP_TEMPLATES, WEEKDAY_SHORT,
  cleanPrepChecks, prepForDay, prepMissed, prepNextDue, prepRepeatWords, prepWeekScore, togglePrep, weekdayOf,
  type PrepCheck, type PrepKind, type PrepRepeat,
} from "@shared/hubPrep";
import { addDays, friendlyDate } from "@shared/hubDates";
import type { Workspace } from "@shared/teacherHub";
import { HubModal } from "./HubModal";
import { PrimaryButton } from "./ui";

type Setter = React.Dispatch<React.SetStateAction<Workspace>>;
const panel = "rounded-3xl bg-white ring-1 ring-slate-200/70";
const h3 = "text-[11px] font-semibold uppercase tracking-[.08em] text-slate-500";
const pill = (on: boolean) => `inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold ${on ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`;
const KIND_TINT: Record<PrepKind, string> = { collect: "bg-sky-50 text-sky-800", modify: "bg-violet-50 text-violet-800", make: "bg-emerald-50 text-emerald-800", input: "bg-amber-50 text-amber-800", other: "bg-slate-100 text-slate-700" };

/** How many jobs are left today, for the IEP folder tile. */
export function prepLeftToday(workspace: Workspace, today: string): number {
  return prepForDay(cleanPrepChecks(workspace.prepChecks), today).filter((i) => !i.done).length;
}

export function PrepChecklist({ workspace, setWorkspace, makeId, today }: { workspace: Workspace; setWorkspace: Setter; makeId: () => string; today: string }) {
  const list = useMemo(() => cleanPrepChecks(workspace.prepChecks), [workspace.prepChecks]);
  const [day, setDay] = useState(today);
  const [editing, setEditing] = useState<PrepCheck | null>(null);
  const [showAll, setShowAll] = useState(false);
  const items = prepForDay(list, day);
  const missed = day === today ? prepMissed(list, today) : [];
  const week = prepWeekScore(list, today);
  const left = items.filter((i) => !i.done).length;

  const change = (next: (l: PrepCheck[]) => PrepCheck[]) => setWorkspace((w) => ({ ...w, prepChecks: next(cleanPrepChecks(w.prepChecks)) }));
  const toggle = (id: string, date: string) => change((l) => l.map((c) => (c.id === id ? togglePrep(c, date) : c)));
  const save = (c: PrepCheck) => change((l) => (l.some((x) => x.id === c.id) ? l.map((x) => (x.id === c.id ? c : x)) : [...l, c]));
  const remove = (id: string) => change((l) => l.filter((x) => x.id !== id));
  const blank = (t?: (typeof PREP_TEMPLATES)[number]): PrepCheck => ({
    id: makeId(), title: t?.title || "", kind: t?.kind || "other", who: t?.who || "", note: "",
    repeat: t?.repeat || "days", days: t?.days || [weekdayOf(today) >= 1 && weekdayOf(today) <= 5 ? weekdayOf(today) : 1],
    start: today, until: "", done: [], paused: false, createdAt: new Date().toISOString(),
  });

  const printWeek = () => {
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
    const days = [0, 1, 2, 3, 4].map((n) => addDays(monday, n));
    const html = days.map((d) => { const rows = prepForDay(list, d); return `<section><h2>${esc(friendlyDate(d, today))}</h2>${rows.length ? `<ul>${rows.map((r) => `<li><span class="box">${r.done ? "✓" : ""}</span>${esc(r.check.title)}${r.check.who ? ` <small>· ${esc(r.check.who)}</small>` : ""}</li>`).join("")}</ul>` : "<p><small>Nothing planned</small></p>"}</section>`; }).join("");
    const w = window.open("", "_blank"); if (!w) return;
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Prep checklist</title><style>body{font:14px/1.45 -apple-system,Helvetica,Arial,sans-serif;margin:32px;color:#111}h1{font-size:20px}section{break-inside:avoid;margin:14px 0}h2{font-size:15px;margin:0 0 6px}ul{list-style:none;margin:0;padding:0}li{padding:4px 0}.box{display:inline-block;width:14px;height:14px;border:1.5px solid #333;border-radius:3px;margin-right:8px;text-align:center;line-height:13px;font-size:11px}small{color:#666}</style></head><body><h1>Prep checklist · week of ${esc(friendlyDate(monday, today))}</h1>${html}<script>onload=function(){setTimeout(function(){print()},250)}</script></body></html>`);
    w.document.close();
  };

  const Row = ({ c, date, done, showDate }: { c: PrepCheck; date: string; done: boolean; showDate?: boolean }) => (
    <li className="flex items-center gap-3 px-2 py-2.5">
      <button type="button" role="checkbox" aria-checked={done} aria-label={`${done ? "Uncheck" : "Check off"} ${c.title}`} onClick={() => toggle(c.id, date)}
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition ${done ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-transparent hover:border-slate-400"}`} data-testid="prep-check">
        <Check className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => setEditing(c)} className="min-w-0 flex-1 text-left">
        <span className={`block truncate text-[15px] font-medium ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>{c.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${KIND_TINT[c.kind]}`}>{PREP_KIND_LABELS[c.kind]}</span>
          {c.who && <span className="truncate">{c.who}</span>}
          {showDate && <span className="font-semibold text-red-600">{friendlyDate(date, today)}</span>}
        </span>
      </button>
    </li>
  );

  return (
    <>
      <section className={`${panel} p-4`} data-testid="iep-prep">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Day before" onClick={() => setDay(addDays(day, -1))} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"><ChevronLeft className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1 text-center">
            <div className="text-[15px] font-semibold text-slate-950">{day === today ? "Today" : friendlyDate(day, today)}</div>
            <div className="text-xs text-slate-500">{items.length ? (left ? `${left} of ${items.length} left` : "All done") : "Nothing planned"}</div>
          </div>
          <button type="button" aria-label="Next day" onClick={() => setDay(addDays(day, 1))} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"><ChevronRight className="h-5 w-5" /></button>
        </div>
        {day !== today && <div className="mt-1 text-center"><button type="button" onClick={() => setDay(today)} className="text-xs font-semibold text-violet-700">Back to today</button></div>}
        {items.length > 0 && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round(((items.length - left) / items.length) * 100)}%` }} /></div>}
        {items.length ? <ul className="-mx-2 mt-2 divide-y divide-slate-100">{items.map((i) => <Row key={i.check.id} c={i.check} date={day} done={i.done} />)}</ul>
          : <p className="mt-3 text-sm text-slate-500">{list.length ? "Nothing due this day." : "Add the jobs you do in planning periods. They come back on their own, ready to check off."}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <PrimaryButton onClick={() => setEditing(blank())}><Plus className="h-4 w-4" /> Add a job</PrimaryButton>
          {list.length > 0 && <button type="button" onClick={printWeek} className={pill(false)}><Printer className="h-3.5 w-3.5" /> Print this week</button>}
        </div>
      </section>

      {missed.length > 0 && <section className={panel} data-testid="prep-missed">
        <div className="px-4 pt-4"><h3 className={h3}>Not done earlier · {missed.length}</h3></div>
        <ul className="mx-2 divide-y divide-slate-100 pb-2">{missed.map((i) => <Row key={`${i.check.id}${i.date}`} c={i.check} date={i.date} done={false} showDate />)}</ul>
      </section>}

      {!list.length && <section className={`${panel} p-4`}>
        <h3 className={h3}>Quick start</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">{PREP_TEMPLATES.map((t) => <button key={t.title} type="button" className={pill(false)} onClick={() => setEditing(blank(t))}><Plus className="h-3 w-3" />{t.title}</button>)}</div>
      </section>}

      {list.length > 0 && <section className={panel}>
        <button type="button" onClick={() => setShowAll((v) => !v)} className="flex w-full items-center justify-between px-4 py-4 text-left">
          <h3 className={h3}>All jobs · {list.length}</h3>
          <span className="text-xs font-semibold text-slate-500">{week.due ? `${week.done}/${week.due} done this week` : ""} {showAll ? "Hide" : "Show"}</span>
        </button>
        {showAll && <>
          <ul className="mx-2 divide-y divide-slate-100">{list.map((c) => { const next = prepNextDue(c, today); return (
            <li key={c.id} className="flex items-center gap-2 px-2 py-2.5">
              <button type="button" onClick={() => setEditing(c)} className="min-w-0 flex-1 text-left">
                <span className={`block truncate text-[15px] font-medium ${c.paused ? "text-slate-400" : "text-slate-900"}`}>{c.title}{c.who && <span className="font-normal text-slate-500"> · {c.who}</span>}</span>
                <span className="block truncate text-xs text-slate-500">{c.paused ? "Paused" : `${prepRepeatWords(c)}${next ? ` · next ${friendlyDate(next, today)}` : " · finished"}`}</span>
              </button>
              <button type="button" aria-label={c.paused ? `Turn ${c.title} back on` : `Pause ${c.title}`} onClick={() => save({ ...c, paused: !c.paused })} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">{c.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</button>
              <button type="button" aria-label={`Edit ${c.title}`} onClick={() => setEditing(c)} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
            </li>); })}</ul>
          <div className="px-4 pb-4 pt-2"><span className={h3}>Add from a quick start</span><div className="mt-1.5 flex flex-wrap gap-1.5">{PREP_TEMPLATES.map((t) => <button key={t.title} type="button" className={pill(false)} onClick={() => setEditing(blank(t))}><Plus className="h-3 w-3" />{t.title}</button>)}</div></div>
        </>}
      </section>}

      {editing && <PrepEditor check={editing} isNew={!list.some((c) => c.id === editing.id)} onClose={() => setEditing(null)}
        onSave={(c) => { save(c); setEditing(null); }} onDelete={() => { remove(editing.id); setEditing(null); }} />}
    </>
  );
}

function PrepEditor({ check, isNew, onSave, onDelete, onClose }: { check: PrepCheck; isNew: boolean; onSave: (c: PrepCheck) => void; onDelete: () => void; onClose: () => void }) {
  const [c, setC] = useState<PrepCheck>(check);
  const set = (patch: Partial<PrepCheck>) => setC((x) => ({ ...x, ...patch }));
  const toggleDay = (d: number) => set({ days: c.days.includes(d) ? c.days.filter((x) => x !== d) : [...c.days, d].sort() });
  const needsDays = c.repeat === "days" || c.repeat === "biweekly";
  const ok = c.title.trim().length > 0 && !!c.start && (!needsDays || c.days.length > 0);
  const input = "min-h-11 w-full rounded-xl border border-slate-200 px-3 text-base sm:text-sm";
  const label = "mb-1 block text-xs font-semibold text-slate-600";
  return (
    <HubModal title={isNew ? "Add a job" : "Edit job"} onClose={onClose} closeOnBackdrop>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (ok) onSave({ ...c, title: c.title.trim(), who: c.who.trim(), note: c.note.trim() }); }}>
        <div><label className={label} htmlFor="prep-title">What to do</label><input id="prep-title" autoFocus value={c.title} maxLength={160} onChange={(e) => set({ title: e.target.value })} placeholder="Collect unmodified paper" className={input} /></div>
        <div><label className={label} htmlFor="prep-who">For which teacher or class</label><input id="prep-who" value={c.who} maxLength={80} onChange={(e) => set({ who: e.target.value })} placeholder="Ms. Kast, Math Lab A…" className={input} /></div>
        <div><span className={label}>Kind</span><div className="flex flex-wrap gap-1.5">{PREP_KINDS.map((k) => <button key={k} type="button" className={pill(c.kind === k)} onClick={() => set({ kind: k })}>{PREP_KIND_LABELS[k]}</button>)}</div></div>
        <div><span className={label}>Repeats</span><div className="flex flex-wrap gap-1.5">{PREP_REPEATS.map((r) => <button key={r} type="button" className={pill(c.repeat === r)} onClick={() => set({ repeat: r as PrepRepeat })}>{PREP_REPEAT_LABELS[r]}</button>)}</div></div>
        {needsDays && <div><span className={label}>On these days (your planning periods)</span><div className="flex flex-wrap gap-1.5">{[1, 2, 3, 4, 5, 6, 0].map((d) => <button key={d} type="button" aria-pressed={c.days.includes(d)} className={pill(c.days.includes(d))} onClick={() => toggleDay(d)}>{WEEKDAY_SHORT[d]}</button>)}</div></div>}
        <div className="grid grid-cols-2 gap-2">
          <div><label className={label} htmlFor="prep-start">{c.repeat === "once" ? "Day" : c.repeat === "monthly" ? "First day (same date each month)" : "Starts"}</label><input id="prep-start" type="date" value={c.start} onChange={(e) => set({ start: e.target.value })} className={input} /></div>
          {c.repeat !== "once" && <div><label className={label} htmlFor="prep-until">Ends (optional)</label><input id="prep-until" type="date" value={c.until} min={c.start} onChange={(e) => set({ until: e.target.value })} className={input} /></div>}
        </div>
        <div><label className={label} htmlFor="prep-note">Notes</label><textarea id="prep-note" value={c.note} maxLength={600} onChange={(e) => set({ note: e.target.value })} rows={2} placeholder="Which lesson, where the copies go…" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" /></div>
        <div className="flex items-center gap-2 pt-1">
          <PrimaryButton type="submit" disabled={!ok}>{isNew ? "Add" : "Save"}</PrimaryButton>
          {!isNew && <button type="button" onClick={onDelete} className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button>}
        </div>
      </form>
    </HubModal>
  );
}
