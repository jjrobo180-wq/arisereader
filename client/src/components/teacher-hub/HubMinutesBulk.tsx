// Teacher Hub: several students added to a block at once.
// Tick the students, pick the minutes, and one save puts them in the block every week, so they are there
// each day they are due and never have to be added again. The same pop-up can log minutes for one day only.
// A screenshot of a schedule, a roster or a list can be read to tick the students for you; nothing is
// saved until the teacher has checked it.
// The rules are in shared/hubMinutesBulk.ts.
import { useId, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { ImagePlus, Loader2, Settings2, Users } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { blockName, schoolBlocks } from "@shared/hubBlocks";
import { DAY_NAMES, SERVICE_KINDS, WEEK_DAYS, planText, type WeekDay } from "@shared/hubProgress";
import {
  QUICK_MINUTES, bulkLine, bulkResult, cleanReadRows, joinsPlan, linePlan, lineText, placeRead,
  type BulkCommon, type BulkMode, type BulkPick, type BulkPicks, type BulkResult, type ReadRow,
} from "@shared/hubMinutesBulk";
import { HUB_IMPORT_LIMITS, type Workspace } from "@shared/teacherHub";
import { Field, GhostButton, Labeled, PrimaryButton, Select } from "./ui";
import { HubModal } from "./HubModal";
import { shrinkImage } from "./HubImport";

/** What the pop-up opens with: the day and block that were tapped, which of the two jobs it starts on, and the days to start with for "every week". */
export type BulkStart = { mode: BulkMode; date: string; block: string; days?: WeekDay[] };

const SCHOOL_DAYS: WeekDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const IMAGE_NAME = /\.(png|jpe?g|webp|gif|heic|heif|bmp)$/i;
const chip = (on: boolean) => `inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-semibold ${on ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;
const small = "inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border px-2.5 text-xs font-semibold";
const smallBtn = `${small} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const smallOn = `${small} border-slate-950 bg-slate-950 text-white hover:bg-slate-800`;
const people = (n: number) => `${n} ${n === 1 ? "student" : "students"}`;

/**
 * The minutes, picked with one tap: 20, 30 or 60, or any other number typed in the Other box.
 * `value` is what is in the minutes box of the form it belongs to ("" for none yet).
 */
export function MinutesPick({ value, onChange, label = "Minutes", max = 600 }: { value: string; onChange: (value: string) => void; label?: string; max?: number }) {
  // A number typed in the Other box stays in the box, even when it is one of the buttons' numbers (20 on the way to 200).
  const [typing, setTyping] = useState(false);
  const tapped = (m: number) => !typing && value === String(m);
  const inBox = typing || !QUICK_MINUTES.some((m) => String(m) === value) ? value : "";
  return (
    <div role="group" aria-label={label} data-testid="minutes-pick">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {QUICK_MINUTES.map((m) => <button key={m} type="button" aria-pressed={tapped(m)} aria-label={`${m} minutes`} className={chip(tapped(m))} onClick={() => { setTyping(false); onChange(String(m)); }}>{m}</button>)}
        <div className={`w-28 rounded-xl ${inBox ? "ring-2 ring-slate-950" : ""}`}><Field type="number" inputMode="numeric" min="1" max={max} placeholder="Other" value={inBox} onChange={(e) => { setTyping(e.target.value !== ""); onChange(e.target.value); }} onFocus={(e) => e.target.select()} aria-label="Other minutes" data-testid="minutes-other-box" /></div>
        <span className="text-sm text-slate-500">min</span>
      </div>
    </div>
  );
}

export function BulkMinutesModal({ workspace, today, token, start, onSave, onClose }: {
  workspace: Workspace; today: string; token: string | null; start: BulkStart;
  /** Saves what was ticked. */
  onSave: (result: BulkResult) => void;
  onClose: () => void;
}) {
  const blocks = useMemo(() => schoolBlocks(workspace), [workspace.minuteBlocks]);
  const plans = workspace.services;
  const names = useMemo(() => [...new Set(workspace.students.map((s) => s.name).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [workspace.students]);
  const [common, setCommon] = useState<BulkCommon>(() => ({ mode: start.mode, date: start.date || today, block: blocks.some((b) => b.id === start.block) ? start.block : "", kind: start.mode === "plan" ? SERVICE_KINDS[0] : "", minutes: "", days: SCHOOL_DAYS.filter((d) => (start.days || []).includes(d)), note: "" }));
  const [picks, setPicks] = useState<BulkPicks>({});
  /** The student whose own block, kind and days are open to change. */
  const [open, setOpen] = useState<string | null>(null);
  const [find, setFind] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  /** The last screenshot that was read, so its students can be counted the other way when the teacher switches. */
  const [read, setRead] = useState<{ rows: ReadRow[]; found: number; unknown: string[]; weekly: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const latest = useRef(common);
  latest.current = common;

  const plan = common.mode === "plan";
  const result = useMemo(() => bulkResult(common, picks, names, plans, blocks, today), [common, picks, names, plans, blocks, today]);
  const chosen = names.filter((n) => picks[n]);
  const ready = chosen.length > 0 && result.missing.length === 0;
  const shown = find.trim() ? names.filter((n) => n.toLowerCase().includes(find.trim().toLowerCase())) : names;
  /** The students whose minutes are already set in the block that is chosen. */
  const inBlock = common.block ? names.filter((n) => plans.some((p) => p.student === n && p.block === common.block)) : [];

  const set = (changes: Partial<BulkCommon>) => setCommon((c) => ({ ...c, ...changes }));
  const tick = (list: string[], on: boolean) => setPicks((prev) => {
    const next = { ...prev };
    for (const n of list) { if (on) next[n] = next[n] || {}; else delete next[n]; }
    return next;
  });
  /** Sets (or, with nothing, takes away) something that is one student's own. */
  function own(student: string, changes: Partial<BulkPick>) {
    setPicks((prev) => {
      const pick: BulkPick = { ...(prev[student] || {}), ...changes };
      for (const key of Object.keys(pick) as (keyof BulkPick)[]) if (pick[key] === undefined || pick[key] === "") delete pick[key];
      return { ...prev, [student]: pick };
    });
  }
  function setMode(mode: BulkMode) {
    const next: BulkCommon = { ...common, mode, kind: mode === "plan" && !common.kind ? SERVICE_KINDS[0] : common.kind };
    setCommon(next);
    // A screenshot counts minutes by the day or by the week, so its students are counted again the new way.
    if (read) setPicks((prev) => { const placed = placeRead(read.rows, next, names, blocks).picks; const out = { ...prev }; for (const n of Object.keys(placed)) if (out[n]) out[n] = placed[n]; return out; });
  }

  async function readPhotos(list: FileList | File[] | null) {
    const files = Array.from(list || []).filter((f) => f.type.startsWith("image/") || IMAGE_NAME.test(f.name));
    if (reading) return;
    if (!files.length) { if (Array.from(list || []).length) setError("Choose a photo or a screenshot."); return; }
    setReading(true);
    setError("");
    try {
      const images: string[] = [];
      for (const file of files.slice(0, HUB_IMPORT_LIMITS.images)) {
        try { images.push(await shrinkImage(file)); } catch { throw new Error("That photo could not be opened. Try a screenshot, or save it as a JPEG first."); }
      }
      const response = await fetch(`${API_BASE}/api/teacher-hub/import/minutes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ images, students: names, blocks: blocks.map((b) => b.name) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || (response.status === 413 ? "That is too large to read at once. Try one screenshot at a time." : "That could not be read right now. Try again in a moment."));
      const rows = cleanReadRows(data.rows);
      const placed = placeRead(rows, latest.current, names, blocks);
      setPicks((prev) => ({ ...prev, ...placed.picks }));
      setRead({ rows, found: Object.keys(placed.picks).length, unknown: placed.unknown, weekly: placed.weekly });
      setFind("");
    } catch (err: any) {
      setError(err?.message || "That could not be read right now. Try again in a moment.");
    } finally {
      setReading(false);
    }
  }
  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    // A copied screenshot arrives as a file. Words pasted into a box are left alone.
    const files = Array.from(e.clipboardData?.files || []);
    if (!files.length) return;
    e.preventDefault();
    void readPhotos(files);
  }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    void readPhotos(e.dataTransfer?.files || null);
  }

  const minutesLabel = !plan ? "Minutes for each student" : common.days.length ? "Minutes on each of those days" : "Minutes each week";
  const saveLabel = !chosen.length ? (plan ? "Add students" : "Log minutes") : plan ? `Add ${people(chosen.length)}` : `Log for ${people(chosen.length)}`;
  const title = !plan ? "Log minutes" : blockName(blocks, common.block) ? `Add students to ${blockName(blocks, common.block)}` : "Add students to a block";
  const waiting = !chosen.length ? "Tick the students." : result.missing.length ? `Pick the minutes for ${result.missing[0]}${result.missing.length > 1 ? ` and ${result.missing.length - 1} more` : ""}.` : "";

  return (
    <HubModal title={title} label="Minutes for several students" onClose={reading ? undefined : onClose}
      footer={<div className="flex flex-wrap items-center gap-2"><PrimaryButton onClick={() => { if (ready) onSave(result); }} disabled={!ready}>{saveLabel}</PrimaryButton><GhostButton onClick={onClose}>Cancel</GhostButton>{waiting && <span className="text-xs text-slate-500" data-testid="bulk-waiting">{waiting}</span>}</div>}>
      <div className={`grid gap-4 ${dragging ? "rounded-2xl ring-4 ring-teal-300" : ""}`} onPaste={onPaste} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} data-testid="bulk-form">
        <div>
          <div role="tablist" aria-label="What to do with the minutes" className="flex gap-1 rounded-2xl bg-slate-100 p-1" data-testid="bulk-mode">
            {([["plan", "Every week"], ["log", "Just this day"]] as const).map(([mode, label]) => (
              <button key={mode} type="button" role="tab" aria-selected={common.mode === mode} onClick={() => setMode(mode)} className={`min-h-11 flex-1 rounded-xl px-2 text-sm font-semibold ${common.mode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>{label}</button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{plan ? "The students you tick stay in this block every week, on the days you pick. You do not add them again." : "Logs the minutes you gave on this one day, for every student you tick. It does not repeat."}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {!plan && <Labeled label="Date"><Field type="date" value={common.date} onChange={(e) => set({ date: e.target.value })} aria-label="Date" /></Labeled>}
          <Labeled label="Block"><Select value={common.block} onChange={(e) => set({ block: e.target.value })} aria-label="Block for everyone"><option value="">{plan ? "No block" : "Their usual block"}</option>{blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Labeled>
          <Labeled label="Kind"><Select value={common.kind} onChange={(e) => set({ kind: e.target.value })} aria-label="Kind for everyone">{!plan && <option value="">Their usual kind</option>}{SERVICE_KINDS.map((k) => <option key={k}>{k}</option>)}</Select></Labeled>
          {!plan && <Labeled label="Note (optional)"><Field value={common.note} onChange={(e) => set({ note: e.target.value })} maxLength={200} aria-label="Note" /></Labeled>}
        </div>

        {plan && (
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Repeats every week on</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Days for everyone">
              {SCHOOL_DAYS.map((d) => { const on = common.days.includes(d); return <button key={d} type="button" aria-pressed={on} aria-label={DAY_NAMES[d]} className={chip(on)} onClick={() => set({ days: on ? common.days.filter((x) => x !== d) : WEEK_DAYS.filter((x) => x === d || common.days.includes(x)) })}>{d}</button>; })}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {common.days.length < SCHOOL_DAYS.length && <button type="button" className={smallBtn} onClick={() => set({ days: [...SCHOOL_DAYS] })} data-testid="bulk-every-day">Every school day</button>}
              <span>{common.days.length ? "" : "With no days picked, the minutes are for the whole week and can be given on any day."}</span>
            </div>
          </div>
        )}

        <MinutesPick value={common.minutes} onChange={(minutes) => set({ minutes })} label={minutesLabel} max={plan && !common.days.length ? 3000 : 600} />

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Students</span>
            <span className="text-xs font-semibold text-slate-600" data-testid="bulk-count">{chosen.length ? `${chosen.length} ticked` : "None ticked yet"}</span>
          </div>

          <button type="button" onClick={() => photoRef.current?.click()} disabled={reading} className="mt-1.5 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-dashed border-teal-300 bg-teal-50 px-4 py-2.5 text-left hover:bg-teal-100 disabled:opacity-70" data-testid="bulk-photo-button">
            {reading ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-teal-700" /> : <ImagePlus className="h-5 w-5 shrink-0 text-teal-700" />}
            <span><span className="block text-sm font-semibold text-slate-900">{reading ? "Reading your screenshot…" : "Tick them from a screenshot"}</span><span className="block text-xs text-slate-600">A schedule, a roster or a list. The students it finds are ticked for you to check.</span></span>
          </button>
          <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void readPhotos(e.target.files); e.target.value = ""; }} data-testid="bulk-photo" />
          {error && <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
          {read && !reading && (
            <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status" data-testid="bulk-read">
              {read.found ? `${people(read.found)} ticked from your screenshot. Check them, then save.` : read.unknown.length ? "Nobody in that screenshot is on your caseload." : "No students were found in that screenshot. Try a clearer one, or tick the students yourself."}
              {read.unknown.length > 0 && <span className="mt-1 block text-xs">Not on your caseload: {read.unknown.join(", ")}. Add them on the Caseload tab to include them.</span>}
              {read.weekly && !plan && read.found > 0 && <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">This looks like a weekly schedule. <button type="button" className={smallBtn} onClick={() => setMode("plan")} data-testid="bulk-read-weekly">Set it for every week</button></span>}
            </div>
          )}

          {names.length ? (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {names.length > 8 && <div className="min-w-0 flex-1 basis-40"><Field value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a student" aria-label="Find a student" /></div>}
                <button type="button" className={smallBtn} onClick={() => tick(shown, true)} data-testid="bulk-all">Tick all</button>
                {chosen.length > 0 && <button type="button" className={smallBtn} onClick={() => tick(names, false)}>Clear</button>}
                {inBlock.length > 0 && <button type="button" className={smallBtn} onClick={() => tick(inBlock, true)} data-testid="bulk-in-block"><Users className="h-3.5 w-3.5" /> {blockName(blocks, common.block)}'s students ({inBlock.length})</button>}
              </div>
              <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200" aria-label="Students" data-testid="bulk-students">
                {shown.map((name) => <StudentRow key={name} name={name} common={common} pick={picks[name]} missing={result.missing.includes(name)} open={open === name} workspace={workspace} onTick={(on) => { tick([name], on); if (!on && open === name) setOpen(null); }} onOwn={(changes) => own(name, changes)} onOpen={() => setOpen(open === name ? null : name)} />)}
                {!shown.length && <li className="px-3 py-4 text-center text-sm text-slate-500">No student by that name.</li>}
              </ul>
            </>
          ) : <p className="mt-2 rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">Add your students on the Caseload tab first. Then you can tick them here.</p>}
          <p className="mt-2 text-xs leading-5 text-slate-500">A screenshot is sent to an AI service (OpenAI) to be read, along with your students' names so they can be matched. A.R.I.S.E. does not keep it. Leave out anything you are not allowed to share. You can also copy a screenshot and paste it here.</p>
        </div>
      </div>
    </HubModal>
  );
}

/** One student in the list: a box to tick, and once ticked, what will be saved for them and a minutes box of their own. */
function StudentRow({ name, common, pick, missing, open, workspace, onTick, onOwn, onOpen }: {
  name: string; common: BulkCommon; pick: BulkPick | undefined; missing: boolean; open: boolean; workspace: Workspace;
  onTick: (on: boolean) => void; onOwn: (changes: Partial<BulkPick>) => void; onOpen: () => void;
}) {
  const blocks = schoolBlocks(workspace);
  const plans = workspace.services;
  const plan = common.mode === "plan";
  const mine = plans.filter((p) => p.student === name);
  const line = pick ? bulkLine(common, name, pick, plans, blocks) : null;
  /** Minutes already logged for this kind of service on the day being logged, so nobody is logged twice by mistake. */
  const already = line && !plan ? workspace.serviceLogs.filter((l) => l.student === name && l.kind === line.kind && l.date === common.date).reduce((n, l) => n + (Number(l.minutes) || 0), 0) : 0;
  const now = line && plan ? mine.find((p) => p.kind === line.kind) : undefined;
  const fields = line && plan ? linePlan(line) : null;
  const usual = [...new Set(mine.map((p) => blockName(blocks, p.block)).filter(Boolean))].join(", ");
  const days = pick?.days ?? common.days;
  const id = useId();

  return (
    <li className={pick ? "bg-teal-50/60" : ""} data-testid="bulk-student" data-ticked={pick ? "yes" : "no"}>
      <div className="flex items-center gap-3 px-3 py-2">
        <input id={id} type="checkbox" className="h-5 w-5 shrink-0" checked={!!pick} onChange={(e) => onTick(e.target.checked)} />
        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer py-1">
          <span className="block break-words text-sm font-semibold text-slate-900">{name}</span>
          {line
            ? <span className="block text-xs text-slate-600" data-testid="bulk-line">{missing ? <span className="font-semibold text-amber-700">Needs minutes</span> : lineText(common, line, plans, blocks)}{already > 0 ? <span className="text-amber-700"> · already {already} min this day</span> : null}</span>
            : usual ? <span className="block text-xs text-slate-500">Usually {usual}</span> : null}
          {now && <span className="block text-xs text-slate-500" data-testid="bulk-now">{fields && joinsPlan(now, fields) ? "Added to" : "Takes the place of"}: {planText(now, blockName(blocks, now.block))}</span>}
        </label>
        {pick && (
          <>
            <input type="number" inputMode="numeric" min="1" max="3000" value={pick.minutes ?? ""} placeholder={common.minutes || "min"} onChange={(e) => onOwn({ minutes: e.target.value })} onFocus={(e) => e.target.select()} aria-label={`Minutes for ${name}`}
              className="h-11 w-16 shrink-0 rounded-xl border border-slate-200 bg-white px-2 text-center text-base text-slate-900 outline-none focus:border-slate-400 sm:text-sm" data-testid="bulk-own-minutes" />
            <button type="button" onClick={onOpen} aria-expanded={open} aria-label={`Block, kind${plan ? " and days" : ""} for ${name}`} className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${open ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-100"}`} data-testid="bulk-own-open"><Settings2 className="h-4 w-4" /></button>
          </>
        )}
      </div>
      {pick && open && (
        <div className="grid grid-cols-2 gap-2 px-3 pb-3" data-testid="bulk-own">
          <Select value={pick.block || ""} onChange={(e) => onOwn({ block: e.target.value })} aria-label={`Block for ${name}`}><option value="">Same block</option>{blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
          <Select value={pick.kind || ""} onChange={(e) => onOwn({ kind: e.target.value })} aria-label={`Kind for ${name}`}><option value="">Same kind</option>{SERVICE_KINDS.map((k) => <option key={k}>{k}</option>)}</Select>
          {plan && (
            <div className="col-span-2 flex flex-wrap items-center gap-1.5" role="group" aria-label={`Days for ${name}`}>
              {SCHOOL_DAYS.map((d) => { const on = days.includes(d); return <button key={d} type="button" aria-pressed={on} aria-label={DAY_NAMES[d]} className={on ? smallOn : smallBtn} onClick={() => onOwn({ days: on ? days.filter((x) => x !== d) : WEEK_DAYS.filter((x) => x === d || days.includes(x)) })}>{d}</button>; })}
              {pick.days && <button type="button" className="min-h-9 px-1 text-xs font-semibold text-slate-600 underline" onClick={() => onOwn({ days: undefined })}>Same days as everyone</button>}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
