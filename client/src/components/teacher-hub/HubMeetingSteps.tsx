// Teacher Hub: the ten-step guide for getting an IEP or re-evaluation meeting done.
// Step 1 adds the meeting, step 2 finds a time for everyone. Any step can be skipped and
// come back to; the progress is kept on the meeting.
import { useEffect, useState, type FormEvent, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { ArrowLeft, Check, ChevronRight, Plus, SkipForward, Undo2, X } from "lucide-react";
import { MEETING_STEPS, STEP_COUNT, cleanPlan, emptyPlan, markDone, markSkipped, stepState } from "@shared/meetingSteps";
import { newGuide } from "@shared/hubGuide";
import type { Meeting, Workspace } from "@shared/teacherHub";
import { Field, GhostButton, PrimaryButton, Select, TextArea } from "./ui";

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

export default function MeetingWizard({ workspace, setWorkspace, makeId, wizard, setWizard, studentOptions, openGuide, showPolls, pollBody }: {
  workspace: Workspace; setWorkspace: Setter; makeId: () => string; wizard: WizardState; setWizard: (next: WizardState | null) => void;
  studentOptions: () => ReactNode; openGuide: (guideId: string) => void; showPolls: () => void;
  pollBody: (meeting: Meeting, onSent: () => void) => ReactNode;
}) {
  const meeting = wizard.meetingId ? workspace.meetings.find((m) => m.id === wizard.meetingId) : undefined;
  const plan = cleanPlan(meeting?.plan);
  const step = Math.min(Math.max(wizard.step, 1), STEP_COUNT);
  const info = MEETING_STEPS[step - 1];
  const [form, setForm] = useState({ student: "", type: "Annual IEP", date: "", notes: "" });
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
    setWorkspace((p) => ({ ...p, meetings: [...p.meetings, { id, ...form, done: false, plan: markDone(emptyPlan(), 1) }] }));
    setWizard({ step: 2, meetingId: id });
  }
  function addTodo(title: string) {
    if (!meeting) return;
    setWorkspace((p) => ({ ...p, tasks: [...p.tasks, { id: makeId(), title: `${title}: ${meeting.student}`, dueDate: meeting.date, recurring: "", done: false }] }));
    setAdded((a) => ({ ...a, [step]: true }));
  }
  const guide = meeting ? workspace.guides.find((g) => g.student === meeting.student) : undefined;
  function startGuide() {
    if (!meeting) return;
    const g = newGuide(meeting.student, /reeval/i.test(meeting.type) ? "Re-evaluation" : "IEP meeting", makeId);
    setWorkspace((p) => ({ ...p, guides: [...p.guides, g], meetings: p.meetings.map((m) => (m.id === meeting.id ? { ...m, plan: markDone(cleanPlan(m.plan), 5) } : m)) }));
    setWizard(null); openGuide(g.id);
  }

  const skippedList = plan.skipped.filter((n) => n !== step);
  const pill = "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Step ${step} of ${STEP_COUNT}: ${info.title}`} data-testid="meeting-wizard">
      <div className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
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
          {meeting && <p className="text-xs text-slate-500">{meeting.student} · {meeting.type}{meeting.date ? ` · ${meeting.date}` : ""}</p>}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          {skippedList.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" data-testid="wizard-skipped">
              You skipped {skippedList.length === 1 ? "a step" : "some steps"}.
              <div className="mt-2 flex flex-wrap gap-2">
                {skippedList.map((n) => <button key={n} type="button" onClick={() => go(n)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 font-semibold"><Undo2 className="h-4 w-4" /> Go back to step {n}: {MEETING_STEPS[n - 1].short}</button>)}
              </div>
            </div>
          )}

          {step === 1 && !meeting && (
            <form id="wizard-add" onSubmit={addMeeting} className="grid gap-3">
              <Select aria-label="Student" value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} required autoFocus>{studentOptions()}</Select>
              <Select aria-label="Meeting type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option>Annual IEP</option><option>Reevaluation</option><option>Planning meeting</option><option>Parent meeting</option><option>Progress review</option><option>Other</option>
              </Select>
              <Field aria-label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <TextArea aria-label="Meeting notes" placeholder="Meeting notes / checklist (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </form>
          )}
          {step === 1 && meeting && <p className="text-sm text-slate-600">This meeting is on your timeline. You can fix its date or notes there any time.</p>}

          {step === 2 && (meeting ? pollBody(meeting, () => { setPlan((p) => markDone(p, 2)); go(3); }) : <NeedMeeting go={() => go(1)} />)}

          {step === 3 && <>
            <p className="text-sm text-slate-600">When people answer, their answers show in “Find a time with everyone”. Pick the best time there and tap Book this time. It goes on your calendar.</p>
            <GhostButton onClick={showPolls}>Open my polls</GhostButton>
          </>}
          {step === 4 && <>
            <p className="text-sm text-slate-600">Booking a time tells everyone for you. If you chose to send things yourself, open the poll and use “Tell everyone” to send the final time from your own email or phone.</p>
            <GhostButton onClick={showPolls}>Open my polls</GhostButton>
          </>}
          {step === 5 && (meeting ? <>
            <p className="text-sm text-slate-600">The guide is your checklist for this student's meeting, with notes and who is on the team.</p>
            {guide
              ? <PrimaryButton onClick={() => { setPlan((p) => markDone(p, 5)); setWizard(null); openGuide(guide.id); }}>Open the guide for {meeting.student}</PrimaryButton>
              : <PrimaryButton onClick={startGuide}><Plus className="h-4 w-4" /> Start the guide for {meeting.student}</PrimaryButton>}
          </> : <NeedMeeting go={() => go(1)} />)}
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
                {meeting && step !== 2 && <PrimaryButton onClick={done}>{step === STEP_COUNT ? "Finish" : "Done, next"} <ChevronRight className="h-4 w-4" /></PrimaryButton>}
                {meeting && step === 1 && <PrimaryButton onClick={() => go(2)}>Next <ChevronRight className="h-4 w-4" /></PrimaryButton>}
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
