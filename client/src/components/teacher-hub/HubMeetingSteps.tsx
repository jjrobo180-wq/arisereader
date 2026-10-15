// Arise WorkHub: the ten steps for getting an IEP or re-evaluation meeting done, all in one pop-up.
// Step 1 adds the meeting: the student, the kind of meeting and its deadline (filled in from the
// student's caseload date). Step 2 is the scheduler for that meeting: who is coming, and times
// before the deadline (or a time already chosen). Step 5 is the checklist and messages. Nothing leaves
// this screen. Any step can be skipped and come back to; the progress is kept on the meeting.
import { useEffect, useState, type FormEvent, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { ArrowLeft, Check, ChevronRight, Plus, SkipForward, Undo2, X } from "lucide-react";
import { MEETING_STEPS, STEP_COUNT, cleanPlan, emptyPlan, firstOpen, markDone, markSkipped, prepTodos, stepState } from "@shared/meetingSteps";
import { addMeetingWithDeadline, changeMeetingBasics, deadlineLabel, deadlineWords, meetingDeadline, planningDeadlineFor, savesToStudent, studentDeadline } from "@shared/meetingDeadline";
import { newGuideFor } from "@shared/hubStudentTeam";
import type { GuideSender } from "@shared/hubGuide";
import { GuideChecklist } from "./HubGuide";
import type { Meeting, Workspace } from "@shared/teacherHub";
import { Field, GhostButton, PrimaryButton, Select } from "./ui";
import HubQuickAddStudent from "./HubQuickAddStudent";

export type WizardState = { step: number; meetingId: string | null };
type Setter = Dispatch<SetStateAction<Workspace>>;

/** What each of the later steps says, and whether it can put a to-do on the list. */
const HELP: Record<number, { text: string; todo?: string }> = {
  6: { text: "Pull together current data, progress notes and a few work samples so the team can see how the student is doing.", todo: "Gather data and work samples" },
  7: { text: "Write the draft goals and reports ahead of time so there is something to talk about.", todo: "Draft goals and reports" },
  8: { text: "Share the drafts with parents and the team before the meeting so nothing is a surprise.", todo: "Send drafts to parents and the team" },
  9: { text: "Hold the meeting. Take quick notes as you go. You can put them in the meeting's notes on your timeline." },
  10: { text: "Finish the paperwork, send the final copy to the parents and the team, and file everything.", todo: "Finish paperwork and send the final copy" },
};

export default function MeetingWizard({ workspace, setWorkspace, seats, makeId, wizard, setWizard, studentOptions, sender, showPolls, pollBody }: {
  workspace: Workspace; setWorkspace: Setter; seats: number | null; makeId: () => string; wizard: WizardState; setWizard: (next: WizardState | null) => void;
  studentOptions: () => ReactNode; sender: GuideSender; showPolls: () => void;
  pollBody: (meeting: Meeting, onSent: () => void) => ReactNode;
}) {
  const meeting = wizard.meetingId ? workspace.meetings.find((m) => m.id === wizard.meetingId) : undefined;
  const plan = cleanPlan(meeting?.plan);
  const step = Math.min(Math.max(wizard.step, 1), STEP_COUNT);
  const info = MEETING_STEPS[step - 1];
  const [form, setForm] = useState({ student: "", type: "Annual IEP", deadline: "" });
  const [planning, setPlanning] = useState(false);
  // The deadline fills in from the student's caseload date until the teacher types their own.
  const [typedDeadline, setTypedDeadline] = useState(false);
  const [addStudent, setAddStudent] = useState(false);
  const [haveTime, setHaveTime] = useState(false);
  const [when, setWhen] = useState({ date: "", time: "", room: "" });
  const [prep, setPrep] = useState(true);
  const saved = studentDeadline(workspace, form.student, form.type);
  useEffect(() => {
    if (!typedDeadline) setForm((f) => ({ ...f, deadline: studentDeadline(workspace, f.student, f.type) }));
  }, [form.student, form.type]); // eslint-disable-line react-hooks/exhaustive-deps
  const [added, setAdded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setWizard(null); };
    window.addEventListener("keydown", key);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = before; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (n: number, id = wizard.meetingId) => setWizard({ step: Math.min(Math.max(n, 1), STEP_COUNT), meetingId: id });
  const setPlan = (change: (p: ReturnType<typeof cleanPlan>) => ReturnType<typeof cleanPlan>, id = wizard.meetingId) => {
    if (!id) return;
    setWorkspace((p) => ({ ...p, meetings: p.meetings.map((m) => (m.id === id ? { ...m, plan: change(cleanPlan(m.plan)) } : m)) }));
  };
  const done = () => { setPlan((p) => markDone(p, step)); if (step >= STEP_COUNT) setWizard(null); else go(step + 1); };
  const skip = () => { setPlan((p) => markSkipped(p, step)); if (step >= STEP_COUNT) setWizard(null); else go(step + 1); };

  function addMeeting(e: FormEvent) {
    e.preventDefault();
    const id = makeId();
    const kind = /reeval/i.test(form.type) ? "Re-evaluation" : "IEP meeting";
    const today = new Date().toISOString().slice(0, 10);
    const blank = { date: "", time: "", room: "", notes: "" };
    setWorkspace((p) => {
      let next = addMeetingWithDeadline(p, { ...form, ...blank }, id, markDone(emptyPlan(), 1));
      // The planning meeting goes on the list too, alongside the IEP or reevaluation it leads up to.
      if (planning && savesToStudent(form.type)) {
        next = addMeetingWithDeadline(next, { student: form.student, type: "Planning meeting", deadline: planningDeadlineFor(form.deadline, today), ...blank }, makeId(), markDone(emptyPlan(), 1));
      }
      // The prep to-dos go on the list with dates counted back from the deadline.
      if (prep) {
        const todos = prepTodos(form.student, form.deadline, today).filter((t) => !next.tasks.some((x) => x.title === t.title && !x.done));
        next = { ...next, tasks: [...next.tasks, ...todos.map((t) => ({ id: makeId(), title: t.title, dueDate: t.dueDate, recurring: "", done: false }))] };
      }
      // The meeting's guide starts with it: the student's team is already on it, and it holds the parents and the checklist.
      if (next.guides.some((g) => g.student === form.student)) return next;
      return { ...next, guides: [...next.guides, newGuideFor(next, form.student, kind, makeId)] };
    });
    // On to step 2: who is coming, and when.
    setWizard({ step: 2, meetingId: id });
    if (prep) setAdded({ 6: true, 7: true, 8: true, 10: true });
  }
  /** "I already have a time": the time goes on the meeting and its guide, and finding, booking and telling are done. */
  function saveTime(e: FormEvent) {
    e.preventDefault();
    if (!meeting || !when.date) return;
    setWorkspace((p) => ({
      ...p,
      meetings: p.meetings.map((m) => (m.id === meeting.id ? { ...m, date: when.date, time: when.time, room: when.room.trim() } : m)),
      guides: p.guides.map((g) => (g.student === meeting.student ? { ...g, meetingDate: when.date, meetingTime: when.time, room: when.room.trim() } : g)),
    }));
    setPlan((pl) => [2, 3, 4].reduce((acc, n) => markDone(acc, n), pl));
    go(5);
  }
  function addTodo(title: string) {
    if (!meeting) return;
    setWorkspace((p) => ({ ...p, tasks: [...p.tasks, { id: makeId(), title: `${title}: ${meeting.student}`, dueDate: meeting.date || meetingDeadline(p, meeting), recurring: "", done: false }] }));
    setAdded((a) => ({ ...a, [step]: true }));
  }
  const guide = meeting ? workspace.guides.find((g) => g.student === meeting.student) : undefined;
  // A meeting added before the steps held the guide gets its guide the first time it is opened here.
  useEffect(() => {
    if (!meeting || guide || !meeting.student) return;
    const kind = /reeval/i.test(meeting.type) ? "Re-evaluation" : "IEP meeting";
    setWorkspace((p) => (p.guides.some((g) => g.student === meeting.student) ? p : { ...p, guides: [...p.guides, newGuideFor(p, meeting.student, kind, makeId)] }));
  }, [meeting?.id, !!guide]); // eslint-disable-line react-hooks/exhaustive-deps

  const skippedList = plan.skipped.filter((n) => n !== step);
  const pill = "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Step ${step} of ${STEP_COUNT}: ${info.title}`} data-testid="meeting-wizard">
      <div className="flex max-h-[94dvh] w-full min-w-0 max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="border-b border-slate-100 px-4 pb-3 pt-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-500" data-testid="wizard-counter">Step {step} of {STEP_COUNT}</div>
            <button type="button" onClick={() => setWizard(null)} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
          </div>
          <ol className="-mx-1 mt-1 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label="Steps">
            {MEETING_STEPS.map((s) => {
              const state = stepState(plan, s.n, step);
              const cls = state === "current" ? "border-slate-950 bg-slate-950 text-white"
                : state === "done" ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                : state === "skipped" ? "border-dashed border-amber-500 bg-amber-50 text-amber-800"
                : "border-slate-200 bg-white text-slate-400";
              const reachable = !!meeting || s.n === 1;
              return (
                <li key={s.n} className="shrink-0">
                  <button type="button" disabled={!reachable} onClick={() => go(s.n)} aria-current={state === "current" ? "step" : undefined} data-state={state}
                    aria-label={`Step ${s.n}: ${s.title}${state === "done" ? ", done" : state === "skipped" ? ", skipped" : ""}`}
                    className={`flex h-11 min-w-11 items-center justify-center rounded-full border-2 px-3 text-sm font-bold ${cls}`}>
                    {state === "done" ? <Check className="h-4 w-4" /> : state === "skipped" ? <Undo2 className="h-4 w-4" /> : s.n}
                  </button>
                </li>
              );
            })}
          </ol>
          <h2 className="mt-2 text-lg font-bold leading-snug sm:text-xl">{info.title}</h2>
          {meeting && <p className="text-xs text-slate-500">{meeting.student} · {meeting.type}{meetingDeadline(workspace, meeting) ? ` · Deadline ${deadlineWords(meetingDeadline(workspace, meeting))}` : ""}{meeting.date ? ` · Meeting ${meeting.date}` : ""}</p>}
        </div>

        <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 sm:px-6">
          {skippedList.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" data-testid="wizard-skipped">
              You skipped {skippedList.length === 1 ? "a step" : "some steps"}.
              <div className="mt-2 flex flex-wrap gap-2">
                {skippedList.map((n) => <button key={n} type="button" onClick={() => go(n)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 font-semibold"><Undo2 className="h-4 w-4" /> Go back to step {n}: {MEETING_STEPS[n - 1].short}</button>)}
              </div>
            </div>
          )}

          {step === 1 && !meeting && (
            <form id="wizard-add" onSubmit={addMeeting} className="grid min-w-0 gap-4">
              <div className="min-w-0 space-y-2">
                <Select aria-label="Student" value={form.student} onChange={(e) => { setForm({ ...form, student: e.target.value }); setTypedDeadline(false); }} required autoFocus>{studentOptions()}</Select>
                <button type="button" onClick={() => setAddStudent((v) => !v)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-teal-200 px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50" data-testid="wizard-add-student-open">
                  <Plus className="h-4 w-4" /> {addStudent ? "Hide student form" : "Student not listed? Add student"}
                </button>
                {addStudent && <div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-3" data-testid="wizard-add-student">
                  <HubQuickAddStudent workspace={workspace} setWorkspace={setWorkspace} seats={seats} makeId={makeId}
                    onAdded={(name) => { setTypedDeadline(false); setForm((f) => ({ ...f, student: name })); setAddStudent(false); }}
                    onCancel={() => setAddStudent(false)} />
                </div>}
              </div>
              <div className="min-w-0">
                <div className="mb-1.5 text-sm font-semibold text-slate-800">What kind of meeting?</div>
                <TypeChips value={form.type} onPick={(t) => setForm({ ...form, type: t })} />
              </div>
              <label className="block min-w-0 text-sm font-semibold text-slate-800">
                {deadlineLabel(form.type)}
                <Field aria-label={deadlineLabel(form.type)} type="date" value={form.deadline} className="mt-1" data-testid="wizard-deadline"
                  onChange={(e) => { setTypedDeadline(true); setForm({ ...form, deadline: e.target.value }); }} />
                <span className="mt-1 block text-xs font-normal text-slate-500" data-testid="wizard-deadline-note">
                  {form.deadline && saved === form.deadline ? `Filled in from ${form.student.split(" ")[0]}'s caseload. ` : ""}
                  Step 2 picks who is coming and finds times before this date.{form.deadline && savesToStudent(form.type) && form.student && saved !== form.deadline ? ` It is saved to ${form.student.split(" ")[0]}'s caseload too.` : ""}
                </span>
              </label>
              {savesToStudent(form.type) && (
                <label className="flex min-h-11 items-start gap-3 rounded-2xl bg-slate-50 p-3 text-sm">
                  <input type="checkbox" checked={planning} onChange={(e) => setPlanning(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" data-testid="wizard-planning" />
                  <span className="min-w-0"><b>Also add the planning meeting</b><span className="block text-xs text-slate-600">It goes on your list next to this one, with its own deadline two weeks earlier, and its own times to find.</span></span>
                </label>
              )}
              <label className="flex min-h-11 items-start gap-3 rounded-2xl bg-slate-50 p-3 text-sm">
                <input type="checkbox" checked={prep} onChange={(e) => setPrep(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
                <span className="min-w-0"><b>Plan my prep for me</b><span className="block text-xs text-slate-600">Adds dated to-dos: gather data 2 weeks before, draft goals 10 days before, send drafts 5 days before, and finish the paperwork 3 days after.</span></span>
              </label>
            </form>
          )}
          {step === 1 && meeting && <MeetingBasics key={meeting.id} workspace={workspace} meeting={meeting} onSave={(change) => setWorkspace((p) => changeMeetingBasics(p, meeting.id, change))} />}

          {step === 2 && (meeting ? <div className="min-w-0 space-y-4">
            <div role="radiogroup" aria-label="Meeting time" className="grid gap-2 sm:grid-cols-2">
              <button type="button" role="radio" aria-checked={!haveTime} onClick={() => setHaveTime(false)} className={`rounded-2xl border-2 p-3 text-left ${!haveTime ? "border-teal-700 bg-teal-50" : "border-slate-200"}`}><b className="block text-sm">Find a time with everyone</b><span className="text-xs text-slate-600">Pick who is coming, then ask them which times work.</span></button>
              <button type="button" role="radio" aria-checked={haveTime} onClick={() => setHaveTime(true)} className={`rounded-2xl border-2 p-3 text-left ${haveTime ? "border-teal-700 bg-teal-50" : "border-slate-200"}`}><b className="block text-sm">I already have a time</b><span className="text-xs text-slate-600">Enter it and skip to the checklist.</span></button>
            </div>
            {haveTime
              ? <form onSubmit={saveTime} className="grid min-w-0 gap-3" data-testid="wizard-have-time">
                  <div className="grid grid-cols-2 gap-3">
                    <Field aria-label="Meeting date" type="date" required value={when.date} onChange={(e) => setWhen({ ...when, date: e.target.value })} />
                    <Field aria-label="Meeting time (optional)" type="time" value={when.time} onChange={(e) => setWhen({ ...when, time: e.target.value })} />
                  </div>
                  <Field aria-label="Where (room or video link)" placeholder="Where (room or video link)" value={when.room} maxLength={80} onChange={(e) => setWhen({ ...when, room: e.target.value })} />
                  <div><PrimaryButton type="submit" disabled={!when.date}>Save the time <ChevronRight className="h-4 w-4" /></PrimaryButton></div>
                </form>
              : pollBody(meeting, () => { setPlan((p) => markDone(p, 2)); go(3); })}
          </div> : <NeedMeeting go={() => go(1)} />)}

          {step === 3 && <>
            <p className="text-sm text-slate-600">When people answer, their answers show in “Find a time with everyone”. Pick the best time there and tap Book this time. It goes on your calendar.</p>
            <GhostButton onClick={showPolls}>Open my polls</GhostButton>
          </>}
          {step === 4 && <>
            <p className="text-sm text-slate-600">Booking a time tells everyone for you. If you chose to send things yourself, open the poll and use “Tell everyone” to send the final time from your own email or phone.</p>
            <GhostButton onClick={showPolls}>Open my polls</GhostButton>
          </>}
          {step === 5 && (meeting ? (guide
            ? <GuideChecklist guide={guide} workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} sender={sender} />
            : <p className="text-sm text-slate-600">Getting the checklist ready…</p>) : <NeedMeeting go={() => go(1)} />)}
          {HELP[step] && <>
            <p className="text-sm text-slate-600">{HELP[step].text}</p>
            {HELP[step].todo && meeting && (added[step]
              ? <p className="text-sm font-medium text-emerald-700"><Check className="mr-1 inline h-4 w-4" />Added to your to-do list.</p>
              : <GhostButton onClick={() => addTodo(HELP[step].todo!)}><Plus className="h-4 w-4" /> Add to my to-do list</GhostButton>)}
          </>}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3 sm:px-6" data-testid="wizard-footer">
          {step > 1 && <GhostButton onClick={() => go(step - 1)}><ArrowLeft className="h-4 w-4" /> Back</GhostButton>}
          <div className="ml-auto flex flex-wrap gap-2">
            {step === 1 && !meeting
              ? <PrimaryButton onClick={() => (document.getElementById("wizard-add") as HTMLFormElement | null)?.requestSubmit()}>Next <ChevronRight className="h-4 w-4" /></PrimaryButton>
              : <>
                {meeting && step > 1 && <button type="button" onClick={skip} className={`${pill} border border-slate-200 text-slate-600 hover:bg-slate-50`}><SkipForward className="h-4 w-4" /> Skip for now</button>}
                {meeting && step !== 1 && step !== 2 && <PrimaryButton onClick={done}>{step === STEP_COUNT ? "Finish" : "Done, next"} <ChevronRight className="h-4 w-4" /></PrimaryButton>}
                {meeting && step === 1 && <PrimaryButton onClick={() => go(firstOpen(plan) > 1 ? firstOpen(plan) : 2)}>Next <ChevronRight className="h-4 w-4" /></PrimaryButton>}
              </>}
          </div>
        </div>
      </div>
    </div>
  );
}

function NeedMeeting({ go }: { go: () => void }) {
  return <div className="text-sm text-slate-600">Add the meeting first. <button type="button" onClick={go} className="font-semibold underline">Go to step 1</button></div>;
}

const TYPES = ["Annual IEP", "Reevaluation", "Planning meeting", "Parent meeting", "Progress review", "Other"];
function TypeChips({ value, onPick }: { value: string; onPick: (t: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Meeting type" className="flex flex-wrap gap-2">
      {TYPES.map((t) => <button key={t} type="button" role="radio" aria-checked={value === t} onClick={() => onPick(t)}
        className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${value === t ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>{t}</button>)}
    </div>
  );
}

/** Step 1 reopened on a meeting that already exists: its kind and deadline, and nothing else to fill in. */
function MeetingBasics({ workspace, meeting, onSave }: { workspace: Workspace; meeting: Meeting; onSave: (change: { type: string; deadline: string }) => void }) {
  const current = meetingDeadline(workspace, meeting);
  const [type, setType] = useState(meeting.type);
  const [deadline, setDeadline] = useState(current);
  const dirty = type !== meeting.type || deadline !== current;
  return (
    <div className="min-w-0 space-y-4" data-testid="wizard-basics">
      <p className="text-sm text-slate-600"><b>{meeting.student}</b> is on your list. Next, step 2: pick who is coming and find a time.</p>
      <div><div className="mb-1.5 text-sm font-semibold text-slate-800">What kind of meeting?</div><TypeChips value={type} onPick={setType} /></div>
      <label className="block min-w-0 text-sm font-semibold text-slate-800">{deadlineLabel(type)}
        <Field aria-label={deadlineLabel(type)} type="date" value={deadline} className="mt-1" onChange={(e) => setDeadline(e.target.value)} />
      </label>
      {dirty && <div><PrimaryButton onClick={() => onSave({ type, deadline })}><Check className="h-4 w-4" /> Save changes</PrimaryButton></div>}
    </div>
  );
}
