// Teacher Hub: one student's whole picture. Opened from the Caseload: everything the Hub holds
// for that student in one place, each part with a way to jump to the tab where it is kept.
import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { friendlyDate } from "@shared/hubDates";
import { saveNote } from "@shared/hubNotes";
import { dueWords, studentProfile, type ProfileDate } from "@shared/hubStudentProfile";
import { planText } from "@shared/hubProgress";
import { placeText, schoolBlocks } from "@shared/hubBlocks";
import { sessionBlockName } from "@shared/hubMinutesWeek";
import { clock12, type HubTab, type Workspace } from "@shared/teacherHub";
import { Card, Empty, GhostButton, PrimaryButton, Select } from "./ui";
import { NoteCard, NoteModal } from "./HubNotes";

type SetWorkspace = Dispatch<SetStateAction<Workspace>>;
const FIRST = 5;
const STATUS_LOOK: Record<string, string> = { met: "bg-emerald-100 text-emerald-800", "on track": "bg-teal-50 text-teal-800", close: "bg-amber-100 text-amber-800", behind: "bg-red-100 text-red-700", "no data": "bg-slate-100 text-slate-600" };

/** A part of the profile: its name, how many, a way to its tab, and its rows (the first few, then "Show all"). */
function Part({ title, count, tab, tabLabel, onOpenTab, right, children }: { title: string; count?: number; tab?: HubTab; tabLabel?: string; onOpenTab: (tab: HubTab) => void; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm" aria-label={title} data-testid="profile-part">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-3 sm:px-5">
        <h3 className="font-semibold text-slate-900">{title}{count !== undefined && <span className="ml-2 text-sm font-medium text-slate-500">{count}</span>}</h3>
        <div className="flex items-center gap-2">
          {right}
          {tab && <button type="button" onClick={() => onOpenTab(tab)} className="min-h-10 text-sm font-medium text-teal-800 underline decoration-teal-200 underline-offset-4">Open {tabLabel}</button>}
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** A list that shows its first rows and offers the rest. */
function Rows<T>({ rows, empty, render }: { rows: T[]; empty: string; render: (row: T) => ReactNode }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <>
      <ul className="space-y-2">{(all ? rows : rows.slice(0, FIRST)).map(render)}</ul>
      {rows.length > FIRST && <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 min-h-10 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4">{all ? "Show fewer" : `Show all ${rows.length}`}</button>}
    </>
  );
}

const row = "rounded-xl bg-slate-50 px-3 py-2 text-sm";

function DateFact({ label, when, today }: { label: string; when: ProfileDate; today: string }) {
  const late = when.days !== null && when.days < 0, soon = when.days !== null && when.days >= 0 && when.days <= 30;
  return (
    <div className={`rounded-xl p-3 ${late ? "bg-red-50" : soon ? "bg-amber-50" : "bg-slate-50"}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-900">{when.date ? friendlyDate(when.date, today) : "Not set"}</div>
      {when.date && <div className={`text-xs ${late ? "font-semibold text-red-700" : soon ? "font-semibold text-amber-800" : "text-slate-500"}`}>{dueWords(when)}</div>}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 break-words font-semibold text-slate-900">{value || "—"}</div></div>;
}

export default function StudentProfileView({ workspace, setWorkspace, studentId, today, makeId, onBack, onPick, onOpenTab, onEdit }: {
  workspace: Workspace; setWorkspace: SetWorkspace; studentId: string; today: string; makeId: () => string;
  onBack: () => void; onPick: (studentId: string) => void; onOpenTab: (tab: HubTab) => void; onEdit: (studentId: string) => void;
}) {
  const profile = useMemo(() => studentProfile(workspace, studentId, today), [workspace, studentId, today]);
  const blocks = useMemo(() => schoolBlocks(workspace), [workspace.minuteBlocks]);
  const [noting, setNoting] = useState(false);
  if (!profile) return <Card title="Student profile"><Empty>That student is no longer on your caseload.</Empty><div className="mt-3"><GhostButton onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back to caseload</GhostButton></div></Card>;
  const { student: s } = profile;
  const a = profile.attendance.counts;
  const day = (date: string) => (date ? friendlyDate(date.slice(0, 10), today) : "No date");
  return (
    <div className="space-y-4" data-testid="student-profile">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <GhostButton onClick={onBack}><ArrowLeft className="h-4 w-4" /> Caseload</GhostButton>
          <Select value={s.id} onChange={(e) => onPick(e.target.value)} aria-label="Switch student" className="!w-auto max-w-full">{workspace.students.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
        </div>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-2xl font-bold text-slate-950">{s.name}</h2>
            <p className="text-sm text-slate-500">{profile.records ? `${profile.records} ${profile.records === 1 ? "record" : "records"} across your Hub` : "Nothing recorded for this student yet."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={() => setNoting(true)}><Plus className="h-4 w-4" /> Add a note</PrimaryButton>
            <GhostButton onClick={() => onEdit(s.id)}>Edit details</GhostButton>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Fact label="Grade" value={s.grade} />
          <Fact label="Reading level" value={s.readingLevel} />
          <Fact label="Math level" value={s.mathLevel} />
          <Fact label="Behavior points" value={profile.behavior.entries.length ? String(profile.behavior.total) : ""} />
          <DateFact label="IEP date" when={profile.iep} today={today} />
          <DateFact label="Reevaluation" when={profile.reeval} today={today} />
          <Fact label="Grade average" value={profile.grades.average === null ? "" : `${profile.grades.average}%`} />
          <Fact label="Attendance" value={profile.attendance.entries.length ? `${a.Present} present · ${a.Absent} absent · ${a.Tardy} tardy` : ""} />
        </div>
        {s.accommodations && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Accommodations</div><p className="mt-1 whitespace-pre-wrap break-words text-slate-800">{s.accommodations}</p></div>}
        {s.notes && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Quick notes</div><p className="mt-1 whitespace-pre-wrap break-words text-slate-800">{s.notes}</p></div>}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Part title="IEP goals" count={profile.goals.length} tab="goals" tabLabel="Goals" onOpenTab={onOpenTab}>
          <Rows rows={profile.goals} empty="No goals yet." render={({ goal, latest, percent, status }) => (
            <li key={goal.id} className={row}>
              <div className="flex flex-wrap items-start justify-between gap-2"><span className="min-w-0 break-words font-medium text-slate-900">{goal.area}: {goal.text}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_LOOK[status] || STATUS_LOOK["no data"]}`}>{status}</span></div>
              <div className="mt-1 text-xs text-slate-500">Start {goal.baseline}{goal.unit ? ` ${goal.unit}` : ""} · Now {latest === null ? "no data" : `${latest}${goal.unit ? ` ${goal.unit}` : ""}`} · Goal {goal.target}{goal.unit ? ` ${goal.unit}` : ""}{goal.targetDate ? ` by ${day(goal.targetDate)}` : ""}</div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden><div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div>
            </li>
          )} />
        </Part>

        <Part title="Service minutes" count={profile.services.length} tab="minutes" tabLabel="Minutes" onOpenTab={onOpenTab}>
          <Rows rows={profile.services} empty="No services set up." render={({ plan, status }) => (
            <li key={plan.id} className={row}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-900">{plan.kind} <span className="text-xs font-normal text-slate-500">· {planText(plan, placeText(blocks, plan))}</span></span><span className="text-xs font-semibold text-slate-700">{status.thisWeek} of {status.required} min this week</span></div>
              {(status.remaining > 0 || status.owed > 0) && <div className="mt-1 text-xs text-slate-500">{status.remaining > 0 ? `${status.remaining} min left this week` : "This week is done"}{status.owed > 0 ? ` · ${status.owed} min to make up` : ""}</div>}
            </li>
          )} />
          {profile.serviceLogs.length > 0 && <div className="mt-3"><div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Sessions logged</div><Rows rows={profile.serviceLogs} empty="" render={(l) => <li key={l.id} className={row}><span className="font-medium text-slate-900">{day(l.date)}</span>{sessionBlockName(l, workspace.services, blocks) ? ` · ${sessionBlockName(l, workspace.services, blocks)}` : ""} · {l.kind} · {l.notMet ? "did not meet" : `${l.minutes} min`}{l.note ? <span className="text-slate-500"> · {l.note}</span> : null}</li>} /></div>}
        </Part>

        <Part title="Meetings" count={profile.meetings.upcoming.length + profile.meetings.past.length} tab="iep" tabLabel="IEP & meetings" onOpenTab={onOpenTab}>
          <Rows rows={[...profile.meetings.upcoming, ...profile.meetings.past]} empty="No meetings yet." render={(m) => (
            <li key={m.id} className={row}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-900">{m.type}</span><span className="text-xs font-semibold text-slate-700">{day(m.date)}{m.time ? ` · ${clock12(m.time)}` : ""}{m.done ? " · done" : ""}</span></div>
              {m.notes && <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-xs text-slate-500">{m.notes}</p>}
            </li>
          )} />
          {profile.guides.length > 0 && <div className="mt-3 space-y-1">{profile.guides.map(({ guide, done, total }) => <button key={guide.id} type="button" onClick={() => onOpenTab("guide")} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 text-left text-sm"><span className="font-medium text-slate-900">{guide.kind} checklist</span><span className="text-xs font-semibold text-slate-600">{done} of {total} steps</span></button>)}</div>}
        </Part>

        <Part title="Notes" count={profile.notes.length} tab="notes" tabLabel="Notes" onOpenTab={onOpenTab}>
          {profile.notes.length ? <NotesList notes={profile.notes} /> : <p className="text-sm text-slate-500">No notes yet. Add a note puts one here.</p>}
        </Part>

        <Part title="Parent contact" count={profile.parentLogs.length} tab="parents" tabLabel="Parents" onOpenTab={onOpenTab}>
          <Rows rows={profile.parentLogs} empty="No contact logged." render={(p) => (
            <li key={p.id} className={row}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-900">{p.guardian || "Parent or guardian"}</span><span className="text-xs font-semibold text-slate-700">{day(p.date)}{p.status ? ` · ${p.status}` : ""}</span></div>
              {p.message && <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-xs text-slate-600">{p.message}</p>}
            </li>
          )} />
        </Part>

        <Part title="Behavior" count={profile.behavior.entries.length} tab="behavior" tabLabel="Behavior" onOpenTab={onOpenTab} right={profile.behavior.entries.length ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{profile.behavior.total} {Math.abs(profile.behavior.total) === 1 ? "point" : "points"}</span> : undefined}>
          <Rows rows={profile.behavior.entries} empty="No behavior points yet." render={(b) => <li key={b.id} className={row}><span className={`font-semibold ${b.points < 0 ? "text-red-700" : "text-teal-800"}`}>{b.points > 0 ? `+${b.points}` : b.points}</span> · <span className="font-medium text-slate-900">{day(b.date)}</span>{b.reason ? <span className="text-slate-600"> · {b.reason}</span> : null}</li>} />
        </Part>

        <Part title="Attendance" count={profile.attendance.entries.length} tab="attendance" tabLabel="Attendance" onOpenTab={onOpenTab}>
          {profile.attendance.entries.length > 0 && <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold">{(["Present", "Absent", "Tardy", "Excused"] as const).map((k) => <span key={k} className={`rounded-full px-2.5 py-1 ${k === "Absent" && a[k] ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>{a[k]} {k.toLowerCase()}</span>)}</div>}
          <Rows rows={profile.attendance.entries} empty="No attendance taken." render={(x) => <li key={x.id} className={row}><span className="font-medium text-slate-900">{day(x.date)}</span> · {x.status}{x.className ? <span className="text-slate-500"> · {x.className}</span> : null}</li>} />
        </Part>

        <Part title="Grades" count={profile.grades.rows.length} tab="gradebook" tabLabel="Gradebook" onOpenTab={onOpenTab} right={profile.grades.average !== null ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{profile.grades.average}% average</span> : undefined}>
          <Rows rows={profile.grades.rows} empty="No scores entered." render={(g) => (
            <li key={g.id} className={`${row} flex flex-wrap items-center justify-between gap-2`}>
              <span className="min-w-0 break-words"><span className="font-medium text-slate-900">{g.assignment?.title || "Assignment"}</span>{g.assignment?.category ? <span className="text-slate-500"> · {g.assignment.category}</span> : null}</span>
              <span className={`shrink-0 text-xs font-semibold ${g.missing ? "text-red-700" : "text-slate-700"}`}>{g.missing ? "Missing" : g.excused ? "Excused" : g.score === null ? "No score" : `${g.score}${g.assignment ? ` / ${g.assignment.points}` : ""}`}</span>
            </li>
          )} />
        </Part>

        <Part title="Schedule" count={profile.schedule.length} tab="schedules" tabLabel="Schedules" onOpenTab={onOpenTab}>
          <Rows rows={profile.schedule} empty="No schedule entered." render={(c) => <li key={c.id} className={row}><span className="font-medium text-slate-900">{c.day}</span> · {c.start ? clock12(c.start) : ""}{c.end ? ` – ${clock12(c.end)}` : ""}{c.label ? <span className="text-slate-600"> · {c.label}</span> : null}</li>} />
        </Part>

        <Part title="A.R.I.S.E. reading" count={profile.reading.length} tab="arise" tabLabel="A.R.I.S.E." onOpenTab={onOpenTab}>
          <Rows rows={profile.reading} empty="No reading records yet." render={(r) => <li key={r.id} className={`${row} flex flex-wrap items-center justify-between gap-2`}><span className="min-w-0 break-words font-medium text-slate-900">{r.book || "Book"}</span><span className="shrink-0 text-xs font-semibold text-slate-700">{day(r.date)}{r.score ? ` · score ${r.score}` : ""}{r.points ? ` · ${r.points} pts` : ""}</span></li>} />
        </Part>
      </div>
      {noting && <NoteModal student={s.name} students={workspace.students.map((x) => x.name)} onSave={(fields) => setWorkspace((p) => saveNote(p, null, { ...fields, scope: "student", student: s.name }, makeId))} onClose={() => setNoting(false)} />}
    </div>
  );
}

function NotesList({ notes }: { notes: Parameters<typeof NoteCard>[0]["note"][] }) {
  const [all, setAll] = useState(false);
  return (
    <>
      <div className="space-y-3">{(all ? notes : notes.slice(0, 3)).map((n) => <NoteCard key={n.id} note={n} />)}</div>
      {notes.length > 3 && <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 min-h-10 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4">{all ? "Show fewer" : `Show all ${notes.length}`}</button>}
    </>
  );
}
