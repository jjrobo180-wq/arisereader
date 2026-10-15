// After the time is booked: tell the student's gen ed teacher (no poll, the time is set), ask if they need their
// class covered and when, tick it off here, and copy one message to the lead teacher or supervisor that names
// each teacher and the exact time to cover. Answers are kept on the meeting, so going back loses nothing.
import { useState, type Dispatch, type SetStateAction } from "react";
import { Check, Copy, Mail, Plus, Trash2, UserRound } from "lucide-react";
import { coverageAsks, coverageRequest, dayWords, genEdMessage, meetingSpan, needingCoverage, rangeWords, COVERAGE_MAX, type CoverageAsk } from "@shared/genEdCoverage";
import type { Meeting, Workspace } from "@shared/teacherHub";

type Setter = Dispatch<SetStateAction<Workspace>>;

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const box = document.createElement("textarea");
    box.value = text; box.setAttribute("readonly", ""); box.style.position = "fixed"; box.style.opacity = "0";
    document.body.appendChild(box); box.select();
    try { document.execCommand("copy"); } catch { /* nothing more to try */ }
    box.remove();
  }
}
const mailto = (to: string, m: { subject: string; body: string }) => `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;

function CopyOpen({ text, message, to, label, disabled, primary }: { text: string; message: { subject: string; body: string }; to: string; label: string; disabled?: boolean; primary?: boolean }) {
  const [copied, setCopied] = useState(false);
  const base = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-40";
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={disabled} onClick={async () => { await copyText(text); setCopied(true); window.setTimeout(() => setCopied(false), 2500); }}
        className={`${base} ${primary ? "bg-teal-700 text-white hover:bg-teal-800" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`}>
        {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> {label}</>}
      </button>
      {to.includes("@") && <a href={disabled ? undefined : mailto(to, message)} aria-disabled={disabled} className={`${base} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 ${disabled ? "pointer-events-none opacity-40" : ""}`}><Mail className="h-4 w-4" /> Open in email</a>}
    </div>
  );
}

export default function GenEdCoverage({ workspace, setWorkspace, meeting, senderName, makeId }: { workspace: Workspace; setWorkspace: Setter; meeting: Meeting; senderName: string; makeId: () => string }) {
  const asks = coverageAsks(workspace, meeting);
  const [adding, setAdding] = useState(false);
  const [other, setOther] = useState(false);
  const [typed, setTyped] = useState({ pick: "", name: "", email: "" });
  const span = meetingSpan(meeting);
  const when = [dayWords(meeting.date), rangeWords(meeting.time || "", meeting.end || "")].filter(Boolean).join(" · ");

  // Everything is saved on the meeting, so the answers are still there after going back.
  const save = (next: CoverageAsk[]) => setWorkspace((p) => ({ ...p, meetings: p.meetings.map((m) => (m.id === meeting.id ? { ...m, coverage: next } : m)) }));
  const change = (id: string, patch: Partial<CoverageAsk>) => save(asks.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const saveTo = (coverageTo: string) => setWorkspace((p) => ({ ...p, meetings: p.meetings.map((m) => (m.id === meeting.id ? { ...m, coverageTo } : m)) }));

  const people = workspace.spedContacts.filter((c) => !asks.some((a) => a.id === c.id));
  function add() {
    const contact = workspace.spedContacts.find((c) => c.id === typed.pick);
    const teacher = (contact?.name || typed.name).trim();
    if (!teacher || asks.length >= COVERAGE_MAX) return;
    save([...asks, { id: contact?.id || makeId(), teacher, email: contact?.email || typed.email.trim(), needs: "", ...span }]);
    setTyped({ pick: "", name: "", email: "" }); setAdding(false);
  }

  const needs = needingCoverage(asks);
  const waiting = asks.filter((a) => !a.needs);
  const lead = (meeting.coverageTo || "").trim();
  const leadContact = workspace.spedContacts.find((c) => c.id === lead || c.name === lead);
  const leadEmail = leadContact?.email || (lead.includes("@") ? lead : "");
  const leadName = leadContact?.name || (lead.includes("@") ? "" : lead);
  const request = coverageRequest({ asks, meeting, sender: senderName, to: leadName });

  if (!meeting.date) return <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600" data-testid="gened-need-time">Once the time is booked, the gen ed teacher's note and the coverage request show up here.</p>;

  return (
    <section className="min-w-0 space-y-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" data-testid="gened-coverage">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><UserRound className="h-5 w-5 text-teal-700" /> Gen ed teacher and coverage</h3>
        <p className="mt-0.5 text-sm text-slate-600">No poll needed. Copy the note, send it, then mark whether they need their class covered.</p>
        <p className="mt-1 inline-flex rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-900">{meeting.student} · {when}</p>
      </div>

      {asks.length === 0 && <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">No gen ed teacher is saved for {meeting.student.split(" ")[0]}. Add one below (or add them on the Caseload and they'll be here next time).</p>}

      {asks.map((a) => {
        const message = genEdMessage({ teacher: a.teacher, student: meeting.student, meeting, sender: senderName });
        const bad = a.needs === "yes" && !(a.from && a.to && a.to > a.from);
        return (
          <div key={a.id} className="min-w-0 space-y-3 rounded-2xl border border-slate-200 p-3" data-testid={`gened-${a.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><div className="truncate text-base font-bold text-slate-900">{a.teacher}</div><div className="truncate text-xs text-slate-500">{a.email || "Gen ed teacher"}</div></div>
              <button type="button" aria-label={`Remove ${a.teacher}`} onClick={() => save(asks.filter((x) => x.id !== a.id))} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
            <CopyOpen primary text={`${message.subject}\n\n${message.body}`} message={message} to={a.email} label={`Copy note for ${a.teacher.split(" ").slice(0, 2).join(" ")}`} />
            <fieldset className="min-w-0">
              <legend className="mb-1.5 text-sm font-semibold text-slate-800">Do they need their class covered?</legend>
              <div className="grid grid-cols-3 gap-2" role="radiogroup">
                {([["", "Not sure yet"], ["yes", "Yes"], ["no", "No"]] as const).map(([v, label]) => (
                  <button key={v} type="button" role="radio" aria-checked={a.needs === v} onClick={() => change(a.id, { needs: v })}
                    className={`min-h-11 rounded-xl border-2 px-2 text-sm font-bold ${a.needs === v ? (v === "yes" ? "border-amber-600 bg-amber-50 text-amber-900" : v === "no" ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-slate-700 bg-slate-100 text-slate-900") : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{label}</button>
                ))}
              </div>
            </fieldset>
            {a.needs === "yes" && (
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-amber-50 p-3">
                <label className="min-w-0 text-xs font-semibold text-amber-900">Coverage starts
                  <input type="time" step={900} value={a.from} onChange={(e) => change(a.id, { from: e.target.value })} className="mt-1 min-h-11 w-full min-w-0 max-w-full rounded-xl border border-amber-200 bg-white px-3 text-base font-normal text-slate-900 sm:text-sm" />
                </label>
                <label className="min-w-0 text-xs font-semibold text-amber-900">Coverage ends
                  <input type="time" step={900} value={a.to} onChange={(e) => change(a.id, { to: e.target.value })} className="mt-1 min-h-11 w-full min-w-0 max-w-full rounded-xl border border-amber-200 bg-white px-3 text-base font-normal text-slate-900 sm:text-sm" />
                </label>
                {bad && <p className="col-span-2 text-xs font-bold text-red-700" role="alert">Coverage has to end after it starts.</p>}
                <p className="col-span-2 text-xs text-amber-900">Filled in with the meeting time. Change it to what {a.teacher.split(" ").slice(0, 2).join(" ")} tells you.</p>
              </div>
            )}
          </div>
        );
      })}

      {asks.length < COVERAGE_MAX && (adding ? (
        <div className="space-y-2 rounded-2xl border border-slate-200 p-3">
          {people.length > 0 && (
            <select aria-label="Pick from my contacts" value={typed.pick} onChange={(e) => setTyped({ ...typed, pick: e.target.value })} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base sm:text-sm">
              <option value="">Pick from my contacts…</option>
              {people.map((c) => <option key={c.id} value={c.id}>{c.name}{c.role ? ` · ${c.role}` : ""}</option>)}
            </select>
          )}
          {!typed.pick && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input aria-label="Teacher's name" placeholder="Or type a name, like Ms. Lopez" value={typed.name} maxLength={80} onChange={(e) => setTyped({ ...typed, name: e.target.value })} className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 px-3 text-base sm:text-sm" />
            <input aria-label="Teacher's email (optional)" type="email" placeholder="Email (optional)" value={typed.email} maxLength={120} onChange={(e) => setTyped({ ...typed, email: e.target.value })} className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 px-3 text-base sm:text-sm" />
          </div>}
          <div className="flex gap-2">
            <button type="button" onClick={add} disabled={!typed.pick && !typed.name.trim()} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-40">Add teacher</button>
            <button type="button" onClick={() => setAdding(false)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700">Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Plus className="h-4 w-4" /> Another gen ed teacher</button>
      ))}

      {/* The coverage request: only when someone needs it. */}
      <div className={`rounded-2xl p-3 ${needs.length ? "border-2 border-amber-400 bg-amber-50" : "border border-slate-200 bg-slate-50"}`} data-testid="coverage-request">
        <h4 className="text-base font-bold text-slate-900">Find coverage</h4>
        {needs.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">{waiting.length ? `Waiting to hear from ${waiting.map((a) => a.teacher).join(", ")}. ` : ""}When a teacher needs coverage, mark Yes above and the request is written here for you.</p>
        ) : (
          <div className="mt-2 space-y-3">
            <ul className="space-y-1 text-sm text-slate-900">
              {needs.map((a) => <li key={a.id} className="flex flex-wrap justify-between gap-x-3 rounded-xl bg-white px-3 py-2 font-semibold"><span>{a.teacher}</span><span className="text-amber-900">{rangeWords(a.from, a.to)}</span></li>)}
            </ul>
            <label className="block text-xs font-semibold text-slate-700">Send to (lead teacher or supervisor)
              <select value={leadContact?.id || (other || lead ? "other" : "")} onChange={(e) => { setOther(e.target.value === "other"); saveTo(e.target.value === "other" ? "" : e.target.value); }} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-normal text-slate-900 sm:text-sm">
                <option value="">Choose who…</option>
                {workspace.spedContacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.role ? ` · ${c.role}` : ""}</option>)}
                <option value="other">Someone else (type a name or email)</option>
              </select>
            </label>
            {!leadContact && (other || lead !== "") && <input aria-label="Name or email" placeholder="Their name or email" value={lead} maxLength={120} onChange={(e) => saveTo(e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base sm:text-sm" />}
            {request && <CopyOpen primary text={`${request.subject}\n\n${request.body}`} message={request} to={leadEmail} label={`Copy coverage request (${request.count} ${request.count === 1 ? "teacher" : "teachers"})`} />}
            <p className="text-xs text-slate-600">The request names the teachers and times, not the student.</p>
          </div>
        )}
      </div>
    </section>
  );
}
