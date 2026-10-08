// Teacher Hub: several students added to a block at once.
// Tick the students, pick the minutes, and one save puts them in the block every week, so they are there
// each day they are due and never have to be added again. The same pop-up can log minutes for one day only.
// A screenshot of a schedule, a roster or a list can be read to tick the students for you; nothing is
// saved until the teacher has checked it.
// The rules are in shared/hubMinutesBulk.ts.
import { useId, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { Check, ImagePlus, Loader2, Plus, Settings2, Users } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { BLOCK_PARTS, PART_NAMES, TEACHER_NAME_MAX, blockName, cleanTeacher, placeText, schoolBlocks } from "@shared/hubBlocks";
import { DAY_NAMES, SERVICE_KINDS, WEEK_DAYS, countedPlan, meetingDays, optionalDays, planText, weekDayOf, type WeekDay } from "@shared/hubProgress";
import {
  PUSH_IN, QUICK_MINUTES, blockGroups, bulkLine, bulkResult, cleanName, cleanReadRows, joinsPlan, knownName, linePlan, lineText, minuteNames, placeRead,
  type BulkCommon, type BulkMode, type BulkPick, type BulkPicks, type BulkResult, type ReadRow,
} from "@shared/hubMinutesBulk";
import { HUB_IMPORT_LIMITS, type ServicePlan, type Workspace } from "@shared/teacherHub";
import { Field, GhostButton, Labeled, PrimaryButton, Select } from "./ui";
import { HubModal } from "./HubModal";
import { shrinkImage } from "./HubImport";

/** What the pop-up opens with: the day and block that were tapped, which of the two jobs it starts on, and the days to start with for "every week". */
export type BulkStart = { mode: BulkMode; date: string; block: string; days?: WeekDay[] };

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

/** The teachers whose classes were named before, to pick with one tap. */
export function knownTeachers(workspace: Pick<Workspace, "services" | "serviceLogs">): string[] {
  return [...new Set([...workspace.services, ...workspace.serviceLogs].map((x) => cleanTeacher(x.teacher)).filter(Boolean))].sort((a, b) => a.localeCompare(b)).slice(0, 8);
}

/**
 * Where in the block, and whose class: for a teacher who goes to two classes in one block (the first half with one
 * teacher, the second half with another). The half is only asked for a block, and the class only for push-in.
 */
export function ClassFields({ hasBlock, pushIn, part, teacher, known, usual = false, onChange }: {
  hasBlock: boolean; pushIn: boolean; part: string; teacher: string;
  /** For minutes logged on one day: left alone, each student stays in their usual half and class. */
  usual?: boolean;
  /** Teachers named before. */
  known: string[];
  onChange: (changes: { part?: string; teacher?: string }) => void;
}) {
  if (!hasBlock && !pushIn) return null;
  return (
    <div className="grid gap-3" data-testid="class-fields">
      {hasBlock && (
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Part of the block</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Part of the block" data-testid="block-part">
            <button type="button" aria-pressed={!part} className={chip(!part)} onClick={() => onChange({ part: "" })}>{usual ? "Their usual" : "Whole block"}</button>
            {BLOCK_PARTS.map((value) => <button key={value} type="button" aria-pressed={part === value} className={chip(part === value)} onClick={() => onChange({ part: value })}>{PART_NAMES[value]}</button>)}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{usual ? "Left as it is, each student stays in their usual half and class." : "Pick a half only if you go to two classes in this block."}</p>
        </div>
      )}
      {pushIn && (
        <div>
          <Labeled label="Whose class are you pushing in to?"><Field value={teacher} onChange={(e) => onChange({ teacher: e.target.value })} maxLength={TEACHER_NAME_MAX} autoCapitalize="words" placeholder={usual ? "Their usual class, or a teacher's name" : "The teacher's name, like Ms. Lee"} aria-label="Whose class are you pushing in to" data-testid="class-teacher" /></Labeled>
          {known.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Teachers you named before">{known.map((name) => <button key={name} type="button" aria-pressed={cleanTeacher(teacher) === name} className={cleanTeacher(teacher) === name ? smallOn : smallBtn} onClick={() => onChange({ teacher: name })}>{name}</button>)}</div>}
        </div>
      )}
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
  /** The optional days (Wednesday unless the teacher chose others) are not days a student can be put on every week. */
  const optional = useMemo(() => optionalDays(workspace), [workspace.minuteOptionalDays]);
  const meeting = useMemo(() => meetingDays(optional), [optional]);
  // Each plan as it counts: an optional day asks for nothing.
  const plans = useMemo(() => workspace.services.map((p) => countedPlan(p, optional)), [workspace.services, optional]);
  /** Names that were typed here, or read from a screenshot, for students who are not on the caseload. */
  const [typed, setTyped] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const names = useMemo(() => minuteNames(workspace, typed), [workspace.students, workspace.services, workspace.serviceLogs, typed]);
  const onCaseload = useMemo(() => new Set(workspace.students.map((s) => cleanName(s.name).toLowerCase())), [workspace.students]);
  const [common, setCommon] = useState<BulkCommon>(() => ({ mode: start.mode, date: start.date || today, block: blocks.some((b) => b.id === start.block) ? start.block : "", kind: start.mode === "plan" ? SERVICE_KINDS[0] : "", part: "", teacher: "", minutes: "", days: meetingDays(optionalDays(workspace)).filter((d) => (start.days || []).includes(d)), note: "" }));
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
  /** The same students class by class, when the block is split into halves or has more than one teacher. */
  const groups = useMemo(() => blockGroups(plans, common.block, names), [plans, common.block, names]);
  const usualDone = inBlock.length > 0 && inBlock.every((n) => picks[n]);
  const teachers = useMemo(() => knownTeachers(workspace), [workspace.services, workspace.serviceLogs]);

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
    if (read) setPicks((prev) => { const placed = placeRead(read.rows, next, names, blocks, optional).picks; const out = { ...prev }; for (const n of Object.keys(placed)) if (out[n]) out[n] = placed[n]; return out; });
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
      const placed = placeRead(rows, latest.current, names, blocks, optional);
      // A name that is not on the list is ticked as it was read: a student does not have to be on the caseload.
      if (placed.unknown.length) setTyped((list) => [...list, ...placed.unknown]);
      setPicks((prev) => ({ ...prev, ...placed.picks }));
      setRead({ rows, found: Object.keys(placed.picks).length, unknown: placed.unknown, weekly: placed.weekly });
      setFind("");
    } catch (err: any) {
      setError(err?.message || "That could not be read right now. Try again in a moment.");
    } finally {
      setReading(false);
    }
  }
  /** A name typed for a student who is not on the list: it is added to the list and ticked. A name that is already there is just ticked. */
  function addName() {
    const name = knownName(newName, names);
    if (!name) return;
    if (!names.includes(name)) setTyped((list) => [...list, name]);
    tick([name], true);
    setNewName("");
    setFind("");
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

  /** The day being logged, when it is an optional day: its minutes are extra. */
  const extraDay = optional.find((d) => d === weekDayOf(common.date));
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
          <p className="mt-1.5 text-xs text-slate-500">{plan ? "The students you tick stay in this block every week, on the days you pick. You do not add them again." : "Logs the minutes you gave on this one day, for every student you tick. It does not repeat."}{!plan && extraDay ? ` ${DAY_NAMES[extraDay]} is optional, so these minutes count as extra.` : ""}</p>
        </div>

        {/* Logging a day in a block: the students who usually meet in it are one big tap away, before anything else. */}
        {!plan && inBlock.length > 0 && (
          <div className="rounded-2xl border-2 border-teal-600 bg-teal-50 p-2.5" data-testid="bulk-usual">
            <button type="button" onClick={() => tick(inBlock, true)} aria-pressed={usualDone} className="flex min-h-16 w-full items-center gap-3 rounded-xl bg-teal-600 px-4 py-3 text-left text-white shadow-sm hover:bg-teal-700" data-testid="bulk-in-block">
              {usualDone ? <Check className="h-7 w-7 shrink-0" /> : <Users className="h-7 w-7 shrink-0" />}
              <span>
                <span className="block text-base font-bold leading-snug">{usualDone ? `${people(inBlock.length)} ticked` : `Tick the ${people(inBlock.length)} who usually meet in ${blockName(blocks, common.block)}`}</span>
                <span className="block text-xs font-medium text-white/90">{usualDone ? "Untick anyone who was not there, in the list below." : "One tap. Then untick anyone who was not there."}</span>
              </span>
            </button>
            {(groups.length > 1 || !!groups[0]?.label) && (
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="One class at a time" data-testid="bulk-usual-groups">
                {groups.map((g) => { const on = g.students.every((n) => picks[n]); return <button key={g.label || "whole"} type="button" aria-pressed={on} onClick={() => tick(g.students, !on)} className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-semibold ${on ? "border-teal-600 bg-teal-600 text-white" : "border-teal-600 bg-white text-teal-800 hover:bg-teal-100"}`}>{on && <Check className="h-4 w-4" />}{g.label || "Whole block"} ({g.students.length})</button>; })}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {!plan && <Labeled label="Date"><Field type="date" value={common.date} onChange={(e) => set({ date: e.target.value })} aria-label="Date" /></Labeled>}
          <Labeled label="Block"><Select value={common.block} onChange={(e) => set({ block: e.target.value })} aria-label="Block for everyone"><option value="">{plan ? "No block" : "Their usual block"}</option>{blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Labeled>
          <Labeled label="Kind"><Select value={common.kind} onChange={(e) => set({ kind: e.target.value })} aria-label="Kind for everyone">{!plan && <option value="">Their usual kind</option>}{SERVICE_KINDS.map((k) => <option key={k}>{k}</option>)}</Select></Labeled>
          {!plan && <Labeled label="Note (optional)"><Field value={common.note} onChange={(e) => set({ note: e.target.value })} maxLength={200} aria-label="Note" /></Labeled>}
        </div>

        <ClassFields hasBlock={!!common.block} pushIn={!common.kind || common.kind === PUSH_IN} part={common.part || ""} teacher={common.teacher || ""} known={teachers} usual={!plan} onChange={set} />

        {plan && (
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Repeats every week on</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Days for everyone">
              {meeting.map((d) => { const on = common.days.includes(d); return <button key={d} type="button" aria-pressed={on} aria-label={DAY_NAMES[d]} className={chip(on)} onClick={() => set({ days: on ? common.days.filter((x) => x !== d) : WEEK_DAYS.filter((x) => x === d || common.days.includes(x)) })}>{d}</button>; })}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {common.days.length < meeting.length && <button type="button" className={smallBtn} onClick={() => set({ days: [...meeting] })} data-testid="bulk-every-day">Every meeting day</button>}
              <span>{common.days.length ? "" : "With no days picked, the minutes are for the whole week and can be given on any day."}</span>
            </div>
            {optional.length > 0 && <p className="mt-1.5 text-xs text-sky-800" data-testid="bulk-optional">{optional.map((d) => DAY_NAMES[d]).join(" and ")} {optional.length > 1 ? "are" : "is"} optional, so {optional.length > 1 ? "they are" : "it is"} not listed. If you met on {optional.length > 1 ? "one of those days" : `a ${DAY_NAMES[optional[0]]}`}, tap “Add if you met” on that day and the minutes count as extra.</p>}
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
              {read.found ? `${people(read.found)} ticked from your screenshot. Check them, then save.` : "No students were found in that screenshot. Try a clearer one, or tick the students yourself."}
              {read.unknown.length > 0 && <span className="mt-1 block text-xs">New names, not on your caseload: {read.unknown.join(", ")}. They are ticked too. Untick any that were read wrong.</span>}
              {read.weekly && !plan && read.found > 0 && <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">This looks like a weekly schedule. <button type="button" className={smallBtn} onClick={() => setMode("plan")} data-testid="bulk-read-weekly">Set it for every week</button></span>}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {names.length > 8 && <div className="min-w-0 flex-1 basis-40"><Field value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a student" aria-label="Find a student" /></div>}
            {names.length > 0 && <button type="button" className={smallBtn} onClick={() => tick(shown, true)} data-testid="bulk-all">Tick all</button>}
            {chosen.length > 0 && <button type="button" className={smallBtn} onClick={() => tick(names, false)}>Clear</button>}
            {plan && inBlock.length > 0 && <button type="button" className={smallBtn} onClick={() => tick(inBlock, true)} data-testid="bulk-in-block-small"><Users className="h-3.5 w-3.5" /> {blockName(blocks, common.block)}'s students ({inBlock.length})</button>}
          </div>
          {names.length > 0 && (
            <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200" aria-label="Students" data-testid="bulk-students">
              {shown.map((name) => <StudentRow key={name} name={name} common={common} pick={picks[name]} missing={result.missing.includes(name)} open={open === name} workspace={workspace} plans={plans} meeting={meeting} listed={onCaseload.has(name.toLowerCase())} onTick={(on) => { tick([name], on); if (!on && open === name) setOpen(null); }} onOwn={(changes) => own(name, changes)} onOpen={() => setOpen(open === name ? null : name)} />)}
              {!shown.length && <li className="px-3 py-4 text-center text-sm text-slate-500">No student by that name. You can type the name below.</li>}
            </ul>
          )}
          {/* Anyone can be given minutes: a student who is not on the caseload is typed in here. */}
          <div className="mt-2 flex items-end gap-2" data-testid="bulk-type-name">
            <label className="block min-w-0 flex-1"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Someone not on the list</span><Field value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addName(); } }} maxLength={80} autoCapitalize="words" placeholder="Type a name" aria-label="Type a name that is not on the list" /></label>
            <button type="button" onClick={addName} disabled={!cleanName(newName)} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:min-h-10" data-testid="bulk-add-name"><Plus className="h-4 w-4" /> Add name</button>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">A screenshot is sent to an AI service (OpenAI) to be read, along with your students' names so they can be matched. A.R.I.S.E. does not keep it. Leave out anything you are not allowed to share. You can also copy a screenshot and paste it here.</p>
        </div>
      </div>
    </HubModal>
  );
}

/** One student in the list: a box to tick, and once ticked, what will be saved for them and a minutes box of their own. */
function StudentRow({ name, common, pick, missing, open, workspace, plans, meeting, listed, onTick, onOwn, onOpen }: {
  name: string; common: BulkCommon; pick: BulkPick | undefined; missing: boolean; open: boolean; workspace: Workspace;
  /** The plans as they count, and the days a student can be put on. */
  plans: ServicePlan[]; meeting: WeekDay[];
  /** On the caseload. A name that is not was typed, or read from a screenshot. */
  listed: boolean;
  onTick: (on: boolean) => void; onOwn: (changes: Partial<BulkPick>) => void; onOpen: () => void;
}) {
  const blocks = schoolBlocks(workspace);
  const plan = common.mode === "plan";
  const mine = plans.filter((p) => p.student === name);
  const line = pick ? bulkLine(common, name, pick, plans, blocks) : null;
  /** Minutes already logged for this kind of service on the day being logged, so nobody is logged twice by mistake. */
  const already = line && !plan ? workspace.serviceLogs.filter((l) => l.student === name && l.kind === line.kind && l.date === common.date).reduce((n, l) => n + (Number(l.minutes) || 0), 0) : 0;
  const now = line && plan ? mine.find((p) => p.kind === line.kind) : undefined;
  const fields = line && plan ? linePlan(line) : null;
  const usual = [...new Set(mine.map((p) => placeText(blocks, p)).filter(Boolean))].join(", ");
  const days = pick?.days ?? common.days;
  const id = useId();

  return (
    <li className={pick ? "bg-teal-50/60" : ""} data-testid="bulk-student" data-ticked={pick ? "yes" : "no"}>
      <div className="flex items-center gap-3 px-3 py-2">
        <input id={id} type="checkbox" className="h-5 w-5 shrink-0" checked={!!pick} onChange={(e) => onTick(e.target.checked)} />
        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer py-1">
          <span className="block break-words text-sm font-semibold text-slate-900">{name}{!listed && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-slate-600" data-testid="bulk-typed">Not on caseload</span>}</span>
          {line
            ? <span className="block text-xs text-slate-600" data-testid="bulk-line">{missing ? <span className="font-semibold text-amber-700">Needs minutes</span> : lineText(common, line, plans, blocks)}{already > 0 ? <span className="text-amber-700"> · already {already} min this day</span> : null}</span>
            : usual ? <span className="block text-xs text-slate-500">Usually {usual}</span> : null}
          {now && <span className="block text-xs text-slate-500" data-testid="bulk-now">{fields && joinsPlan(now, fields) ? "Added to" : "Takes the place of"}: {planText(now, placeText(blocks, now))}</span>}
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
              {meeting.map((d) => { const on = days.includes(d); return <button key={d} type="button" aria-pressed={on} aria-label={DAY_NAMES[d]} className={on ? smallOn : smallBtn} onClick={() => onOwn({ days: on ? days.filter((x) => x !== d) : WEEK_DAYS.filter((x) => x === d || days.includes(x)) })}>{d}</button>; })}
              {pick.days && <button type="button" className="min-h-9 px-1 text-xs font-semibold text-slate-600 underline" onClick={() => onOwn({ days: undefined })}>Same days as everyone</button>}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
