// The note's sheets: the review screen before action items and dates go to the planner, filing an
// IEP draft in WorkHub, share and export, and the note's own settings.
import { useEffect, useState, type ReactNode } from "react";
import { Copy, FileText, Link2, Mail, Printer, Trash2, Users } from "lucide-react";
import { cleanIep, noteText, type IepDraft } from "@shared/ariseNotes";
import { announceSaved } from "@/lib/paneSync";
import { addToAppleReminders, addToIphoneCalendar, appleAddAvailable } from "@/lib/notesApple";
import { notesApi, type FullNote, type HubTargets } from "./api";
import { copyText, download, fileName, mailtoLink, noteDocx, notePdf, pdfCanShow, printNote } from "./exporters";
import { Btn, Notice, PlanLock, Sheet, Spinner, Toggle, useToast } from "./ui";
import type { AppCtx } from "./NotesApp";

const exportable = (n: FullNote) => ({ title: n.title, createdAt: n.createdAt, durationSecs: n.durationSecs, template: n.template, summary: n.summary, segments: n.segments, speakers: n.speakers });

// ─── Review before anything goes to the planner ──────────────────────────────
type Row = { id?: string; on: boolean; title: string; due: string; time: string; who: string };
type EventRow = { on: boolean; title: string; date: string; time: string };
// In the iPhone app the checked items can also go to Apple Reminders and the iPhone Calendar; the
// choice is remembered on this phone.
const APPLE_KEY = { reminders: "arise-notes-apple-reminders", calendar: "arise-notes-apple-calendar" };
const remembered = (k: string) => { try { return localStorage.getItem(k) !== "0"; } catch { return true; } };
const remember = (k: string, on: boolean) => { try { localStorage.setItem(k, on ? "1" : "0"); } catch { /* not kept */ } };

export function PlannerSheet({ ctx, note, onClose, onDone }: { ctx: AppCtx; note: FullNote; onClose: () => void; onDone: (n: FullNote) => void }) {
  const say = useToast();
  const [targets, setTargets] = useState<HubTargets | null>(null);
  const [hub, setHub] = useState<"life" | "work">(ctx.hub);
  const [listId, setListId] = useState("");
  const [calendarId, setCalendarId] = useState("");
  const [busy, setBusy] = useState(false);
  const apple = appleAddAvailable();
  const [toReminders, setToReminders] = useState(() => apple && remembered(APPLE_KEY.reminders));
  const [toCalendar, setToCalendar] = useState(() => apple && remembered(APPLE_KEY.calendar));
  const s = note.summary;
  const [rows, setRows] = useState<Row[]>(() => (s?.actions ?? []).map((a) => {
    const row = note.actions.find((x) => x.text === a.what);
    return { id: row?.id, on: !row?.sentTo, title: a.what, due: a.due, time: "", who: a.who };
  }));
  const [events, setEvents] = useState<EventRow[]>(() => (s?.dates ?? []).map((d) => ({ on: true, title: d.title, date: d.date, time: d.time })));
  useEffect(() => { notesApi.targets().then((t) => { setTargets(t); setListId(t.life?.lists[0]?.id ?? ""); setCalendarId(t.life?.calendars[0]?.id ?? ""); if (!t.work && hub === "work") setHub("life"); }).catch((e) => say(e.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pickedTasks = rows.filter((r) => r.on && r.title.trim());
  const pickedEvents = events.filter((e) => e.on && e.title.trim() && e.date);
  const send = async () => {
    setBusy(true);
    try {
      const r = await notesApi.send(note.id, { hub, listId: hub === "life" ? listId : undefined, calendarId: hub === "life" ? calendarId : undefined, tasks: pickedTasks.map((x) => ({ id: x.id, title: x.title, who: x.who, due: x.due, time: x.time })), events: pickedEvents });
      announceSaved(hub === "work" ? "workhub" : "todo", ctx.me.user.id);
      const where = hub === "work" ? "WorkHub" : `LifeHub${r.list ? ` (${r.list})` : ""}`;
      // Then the iPhone's own apps, when chosen. Arise To Duo already has them, so a problem here is
      // said plainly and nothing is undone.
      const from = `From Arise Notes: ${note.title}`;
      const also: string[] = [];
      try {
        if (toReminders && pickedTasks.length) { const n = await addToAppleReminders(pickedTasks.map((x) => ({ title: x.title, due: x.due, time: x.time, notes: from }))); if (n) also.push("Reminders"); }
        if (toCalendar && pickedEvents.length) { const n = await addToIphoneCalendar(pickedEvents.map((x) => ({ title: x.title, date: x.date, time: x.time, notes: from }))); if (n) also.push("Calendar"); }
      } catch (e: any) { say(`Added to ${where}, but not to the iPhone: ${e.message}`); onDone({ ...note, actions: r.actions }); onClose(); return; }
      say(`Added ${[r.tasks && `${r.tasks} to-do${r.tasks === 1 ? "" : "s"}`, r.events && `${r.events} event${r.events === 1 ? "" : "s"}`].filter(Boolean).join(" and ")} to ${where}${also.length ? ` and the iPhone's ${also.join(" and ")}` : ""}.`);
      onDone({ ...note, actions: r.actions });
      onClose();
    } catch (e: any) { say(e.message); }
    finally { setBusy(false); }
  };
  const set = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const setE = (i: number, p: Partial<EventRow>) => setEvents((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return <Sheet title="Add to your planner" onClose={onClose} wide>
    {!targets ? <Spinner /> : <div className="space-y-4">
      <p className="text-[14px] text-[var(--an-muted)]">Check what to add and fix anything first. Nothing is added until you tap the button.</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Which hub">
        <button type="button" role="radio" aria-checked={hub === "life"} className="an-chip" aria-pressed={hub === "life"} onClick={() => setHub("life")}>LifeHub</button>
        {targets.work && <button type="button" role="radio" aria-checked={hub === "work"} className="an-chip" aria-pressed={hub === "work"} onClick={() => setHub("work")}>WorkHub</button>}
        {hub === "life" && targets.life && targets.life.lists.length > 1 && <select className="an-input !min-h-9 !w-auto !py-0 text-[14px]" value={listId} onChange={(e) => setListId(e.target.value)} aria-label="List">{targets.life.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
      </div>
      {rows.length > 0 && <fieldset className="space-y-2">
        <legend className="mb-1 text-[14px] font-bold">To-dos {ctx.me.features.planner ? "" : <PlanLock plan="Basic" onClick={() => ctx.go({ name: "settings", tab: "plan" })} />}</legend>
        {rows.map((r, i) => <div key={i} className={`rounded-2xl border p-3 ${r.on ? "border-[var(--an-violet)] bg-[#f7f5ff]" : "border-[var(--an-line)]"}`}>
          <div className="flex items-start gap-3">
            <input type="checkbox" checked={r.on} onChange={(e) => set(i, { on: e.target.checked })} className="mt-3 h-5 w-5 accent-[var(--an-violet)]" aria-label={`Add “${r.title}”`} disabled={!ctx.me.features.planner} />
            <div className="min-w-0 flex-1 space-y-2">
              <input className="an-input" value={r.title} onChange={(e) => set(i, { title: e.target.value })} maxLength={200} aria-label="To-do" />
              <div className="flex flex-wrap gap-2 text-[13px]"><label className="flex items-center gap-1.5">Due <input type="date" className="an-input !min-h-9 !w-auto" value={r.due} onChange={(e) => set(i, { due: e.target.value })} /></label>{r.due && <label className="flex items-center gap-1.5">at <input type="time" className="an-input !min-h-9 !w-auto" value={r.time} onChange={(e) => set(i, { time: e.target.value })} /></label>}{r.who && <span className="self-center text-[var(--an-muted)]">· {r.who}</span>}</div>
            </div>
          </div>
        </div>)}
      </fieldset>}
      {events.length > 0 && <fieldset className="space-y-2">
        <legend className="mb-1 text-[14px] font-bold">Calendar</legend>
        {events.map((e, i) => <div key={i} className="flex items-start gap-3 rounded-2xl border border-[var(--an-line)] p-3">
          <input type="checkbox" checked={e.on} onChange={(x) => setE(i, { on: x.target.checked })} className="mt-3 h-5 w-5 accent-[var(--an-violet)]" aria-label={`Add “${e.title}” to the calendar`} />
          <div className="min-w-0 flex-1 space-y-2"><input className="an-input" value={e.title} onChange={(x) => setE(i, { title: x.target.value })} aria-label="Event" /><div className="flex flex-wrap gap-2"><input type="date" className="an-input !min-h-9 !w-auto" value={e.date} onChange={(x) => setE(i, { date: x.target.value })} aria-label="Date" /><input type="time" className="an-input !min-h-9 !w-auto" value={e.time} onChange={(x) => setE(i, { time: x.target.value })} aria-label="Time" /></div></div>
        </div>)}
        {hub === "life" && targets.life && targets.life.calendars.length > 1 && <label className="flex items-center gap-2 text-[14px]">Calendar <select className="an-input !min-h-9 !w-auto" value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>{targets.life.calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      </fieldset>}
      {apple && (rows.length > 0 || events.length > 0) && <fieldset className="space-y-2 rounded-2xl border border-[var(--an-line)] p-3" data-testid="notes-apple-targets">
        <legend className="px-1 text-[14px] font-bold">Also on this iPhone</legend>
        {rows.length > 0 && <Toggle on={toReminders} onChange={(v) => { setToReminders(v); remember(APPLE_KEY.reminders, v); }} label="Add to-dos to Apple Reminders" />}
        {events.length > 0 && <Toggle on={toCalendar} onChange={(v) => { setToCalendar(v); remember(APPLE_KEY.calendar, v); }} label="Add events to the iPhone Calendar" />}
      </fieldset>}
      <Btn kind="primary" className="w-full" busy={busy} disabled={!pickedTasks.length && !pickedEvents.length} onClick={() => void send()} data-testid="notes-planner-send">
        Add {pickedTasks.length + pickedEvents.length || ""} to {hub === "work" ? "WorkHub" : "LifeHub"}
      </Btn>
    </div>}
  </Sheet>;
}

// ─── IEP draft → WorkHub ─────────────────────────────────────────────────────
const lines = (v: string[]) => v.join("\n");
const unlines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);

export function IepSheet({ ctx, note, onClose, onDone }: { ctx: AppCtx; note: FullNote; onClose: () => void; onDone: () => void }) {
  const say = useToast();
  const base = note.summary?.iep;
  const [student, setStudent] = useState(base?.student ?? "");
  const [students, setStudents] = useState<string[] | null>(null);
  const [goals, setGoals] = useState(lines((base?.goals ?? []).map((g) => (g.area ? `${g.area}: ${g.text}` : g.text))));
  const [services, setServices] = useState(lines((base?.services ?? []).map((v) => `${v.service}, ${v.minutes} minutes a ${v.per}`)));
  const [acc, setAcc] = useState(lines(base?.accommodations ?? []));
  const [steps, setSteps] = useState(lines((base?.nextSteps ?? []).map((s) => `${s.what}${s.due ? ` | ${s.due}` : ""}`)));
  const [next, setNext] = useState(base?.nextMeeting ?? "");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { notesApi.targets().then((t) => setStudents(t.work?.students ?? [])).catch(() => setStudents([])); }, []);
  if (!ctx.me.features.iep) return <Sheet title="IEP meeting mode" onClose={onClose}><Notice tone="warn" action={<Btn kind="primary" onClick={() => ctx.go({ name: "settings", tab: "plan" })}>See Plus</Btn>}>IEP meeting mode comes with Arise Notes Plus.</Notice></Sheet>;
  if (!ctx.me.user.workHub) return <Sheet title="File in WorkHub" onClose={onClose}><Notice>Filing an IEP draft needs Arise WorkHub, which comes with teacher and adult accounts.</Notice></Sheet>;
  const file = async () => {
    const iep: IepDraft = cleanIep({
      ...(base ?? {}), student,
      goals: unlines(goals).map((g) => { const m = /^([^:]{1,40}):\s*(.+)$/.exec(g); return m ? { area: m[1], text: m[2] } : { area: "", text: g }; }),
      services: unlines(services).map((v) => { const m = /^(.+?),?\s+(\d+)\s*min\w*\s*(?:a|per|\/)?\s*(day|week|month)?/i.exec(v); return m ? { service: m[1], minutes: Number(m[2]), per: (m[3] || "week").toLowerCase() } : { service: v, minutes: 0, per: "week" }; }),
      accommodations: unlines(acc),
      nextSteps: unlines(steps).map((s) => { const [what, due] = s.split("|").map((x) => x.trim()); return { what, who: "", due: /^\d{4}-\d{2}-\d{2}$/.test(due || "") ? due : "" }; }),
      nextMeeting: next,
    })!;
    setBusy(true);
    try {
      const r = await notesApi.iep(note.id, { student, iep });
      announceSaved("workhub", ctx.me.user.id);
      say(`Filed under ${r.student} in WorkHub: ${r.goals} goal${r.goals === 1 ? "" : "s"}, ${r.services} service${r.services === 1 ? "" : "s"}, ${r.reminders} reminder${r.reminders === 1 ? "" : "s"}.`);
      onDone();
    } catch (e: any) { say(e.message); }
    finally { setBusy(false); }
  };
  const area = (label: string, v: string, set: (v: string) => void, hint: string) => <label className="block"><span className="block text-[14px] font-bold">{label}</span><span className="block text-[12px] text-[var(--an-muted)]">{hint}</span><textarea className="an-input mt-1" rows={3} value={v} onChange={(e) => set(e.target.value)} /></label>;
  return <Sheet title="File the IEP draft in WorkHub" onClose={onClose} wide>
    <div className="space-y-4">
      <Notice tone="warn">This is a draft from the recording. Check every line before filing. Nothing is shared with anyone.</Notice>
      <label className="block"><span className="block text-[14px] font-bold">Student</span>
        <input className="an-input mt-1" list="an-caseload" value={student} onChange={(e) => setStudent(e.target.value)} placeholder="Pick from your caseload or type a name" />
        <datalist id="an-caseload">{(students ?? []).map((s) => <option key={s} value={s} />)}</datalist>
        {students && student && !students.some((s) => s.toLowerCase() === student.trim().toLowerCase()) && <span className="mt-1 block text-[12px] text-[var(--an-amber)]">Not in your WorkHub caseload yet: it's filed under this name.</span>}
      </label>
      {area("Goals", goals, setGoals, "One per line. “Reading: Read 80 words a minute by May”")}
      {area("Services and minutes", services, setServices, "One per line. “Speech, 30 minutes a week”")}
      {area("Accommodations", acc, setAcc, "One per line.")}
      {area("Next steps", steps, setSteps, "One per line. Add a due date after a bar: “Send the evaluation | 2026-11-20”")}
      <label className="block"><span className="block text-[14px] font-bold">Next meeting</span><input type="date" className="an-input mt-1 !w-auto" value={next} onChange={(e) => setNext(e.target.value)} /></label>
      <label className="flex items-center gap-3 text-[15px] font-semibold"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="h-5 w-5 accent-[var(--an-violet)]" />I reviewed this draft</label>
      <Btn kind="primary" className="w-full" busy={busy} disabled={!ok || !student.trim()} onClick={() => void file()}>File under {student.trim() || "the student"}</Btn>
    </div>
  </Sheet>;
}

// ─── Share and export ────────────────────────────────────────────────────────
export function ShareSheet({ ctx, note, onClose, onNote }: { ctx: AppCtx; note: FullNote; onClose: () => void; onNote: (n: FullNote) => void }) {
  const say = useToast();
  const [busy, setBusy] = useState("");
  const [withTranscript, setWithTranscript] = useState(true);
  const can = ctx.me.features.export;
  const ex = exportable(note);
  const linkUrl = note.shareToken ? `${window.location.origin}/notes/#/s/${note.shareToken}` : "";
  const locked = () => { say("Exports come with Arise Notes Basic."); ctx.go({ name: "settings", tab: "plan" }); };
  const act = async (k: string, fn: () => Promise<void> | void) => { if (k !== "copy" && !can) return locked(); setBusy(k); try { await fn(); } catch (e: any) { say(e.message); } finally { setBusy(""); } };
  const row = (k: string, icon: ReactNode, label: string, fn: () => Promise<void> | void, lock = k !== "copy" && !can) =>
    <button key={k} type="button" onClick={() => void act(k, fn)} disabled={busy === k} className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left text-[15px] font-semibold hover:bg-[var(--an-violet-soft)]">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--an-violet-soft)] text-[var(--an-violet-ink)]">{icon}</span><span className="flex-1">{label}</span>{lock && <PlanLock plan="Basic" />}
    </button>;
  return <Sheet title="Share and export" onClose={onClose}>
    <Toggle on={withTranscript} onChange={setWithTranscript} label="Include the full transcript" />
    <div className="mt-2 space-y-1">
      {row("copy", <Copy className="h-5 w-5" />, "Copy as text", async () => { if (await copyText(noteText(ex, withTranscript))) say("Copied."); })}
      {row("pdf", <FileText className="h-5 w-5" />, "Download PDF", () => { const text = noteText(ex, withTranscript); if (pdfCanShow(text)) download(fileName(note.title, "pdf"), notePdf(ex, withTranscript), "application/pdf"); else if (!printNote(ex, withTranscript)) say("Allow pop-ups to save as PDF."); })}
      {row("docx", <FileText className="h-5 w-5" />, "Download Word file", () => download(fileName(note.title, "docx"), noteDocx(ex, withTranscript), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))}
      {row("print", <Printer className="h-5 w-5" />, "Print", () => { if (!printNote(ex, withTranscript)) say("Allow pop-ups to print."); })}
      {row("email", <Mail className="h-5 w-5" />, ctx.me.user.email ? "Email it to me" : "Email it", async () => { if (!ctx.me.user.email) { window.location.href = mailtoLink(note.title, noteText(ex, false)); return; } const r = await notesApi.email(note.id); say(`Sent to ${r.to}.`); })}
    </div>
    {note.mine && <div className="mt-4 space-y-3 border-t border-[var(--an-line)] pt-4">
      <Toggle on={note.shareOn} label="View-only link" hint="Anyone with the link can read the summary and transcript (never the audio). Turn it off any time." disabled={!ctx.me.features.share && !note.shareOn}
        onChange={async (on) => { if (!ctx.me.features.share && on) return locked(); try { const r = await notesApi.share(note.id, on); onNote({ ...note, shareOn: r.on, shareToken: r.token }); if (on) { await copyText(`${window.location.origin}${r.path}`); say("Link copied."); } } catch (e: any) { say(e.message); } }} />
      {note.shareOn && linkUrl && <div className="flex gap-2"><input className="an-input text-[13px]" readOnly value={linkUrl} aria-label="Share link" onFocus={(e) => e.target.select()} /><Btn kind="soft" onClick={async () => { if (await copyText(linkUrl)) say("Link copied."); }}><Link2 className="h-4 w-4" />Copy</Btn></div>}
      {ctx.me.family && <Toggle on={note.familyShared} label={<span className="flex items-center gap-2"><Users className="h-4 w-4" />Share with my family plan</span>} hint="Everyone on your Family plan can read it." onChange={async (v) => { try { const r = await notesApi.patch(note.id, { familyShared: v }); if (r.note) onNote(r.note); } catch (e: any) { say(e.message); } }} />}
    </div>}
  </Sheet>;
}

// ─── Note settings ───────────────────────────────────────────────────────────
export function MoreSheet({ ctx, note, onClose, patch, onDeleted }: { ctx: AppCtx; note: FullNote; onClose: () => void; patch: (b: Record<string, unknown>) => Promise<void>; onDeleted: () => void }) {
  const say = useToast();
  const [folder, setFolder] = useState(note.folder);
  const [tags, setTags] = useState(note.tags.join(", "));
  const [keep, setKeep] = useState(note.audioKeep);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const save = async () => { setBusy(true); try { await patch({ folder, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), audioKeep: keep }); say("Saved."); onClose(); } catch (e: any) { say(e.message); } finally { setBusy(false); } };
  void ctx;
  return <Sheet title="Note settings" onClose={onClose}>
    <div className="space-y-4">
      <label className="block"><span className="block text-[14px] font-bold">Folder</span><input className="an-input mt-1" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Like “Team meetings” or “Biology”" maxLength={40} /></label>
      <label className="block"><span className="block text-[14px] font-bold">Tags</span><input className="an-input mt-1" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Separate with commas" /></label>
      <fieldset><legend className="text-[14px] font-bold">This note's audio</legend>
        {([["delete", "Delete it (only the text is kept)"], ["30d", "Keep it for 30 days"], ["keep", "Keep it"]] as const).map(([v, label]) => <label key={v} className="mt-2 flex items-center gap-3 text-[15px]"><input type="radio" name="keep" checked={keep === v} onChange={() => setKeep(v)} className="h-5 w-5 accent-[var(--an-violet)]" />{label}</label>)}
        {keep !== note.audioKeep && keep === "delete" && note.audio && <p className="mt-1 text-[13px] text-[var(--an-coral)]">The saved audio is deleted now.</p>}
        {keep !== "delete" && note.audioKeep === "delete" && <p className="mt-1 text-[13px] text-[var(--an-muted)]">Audio already deleted can't come back; this applies to anything recorded into this note from now on.</p>}
      </fieldset>
      <Btn kind="primary" className="w-full" busy={busy} onClick={() => void save()}>Save</Btn>
      <div className="border-t border-[var(--an-line)] pt-4">
        {!confirm ? <Btn kind="danger" className="w-full" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" />Delete this note</Btn>
          : <div className="space-y-2"><p className="text-[14px] font-semibold">Delete “{note.title}”, its transcript, summary and audio? This can't be undone.</p><div className="flex gap-2"><Btn kind="danger" className="flex-1" onClick={async () => { try { await notesApi.remove(note.id); say("Deleted."); onDeleted(); } catch (e: any) { say(e.message); } }}>Delete for good</Btn><Btn kind="plain" onClick={() => setConfirm(false)}>Keep it</Btn></div></div>}
      </div>
    </div>
  </Sheet>;
}
