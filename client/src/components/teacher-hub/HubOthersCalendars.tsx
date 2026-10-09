// Teacher Hub: other people's calendars (a social worker's, a psychologist's, another teacher's).
// How to ask someone for their calendar's link, with a message to copy or send, and what is on the
// calendars that are followed. Their events are never put on the teacher's own calendar.
// The rules are in shared/hubOthers.ts.
import { useMemo, useRef, useState } from "react";
import { Check, Copy, Mail, MessageSquare, Users } from "lucide-react";
import { addDays } from "@shared/hubDates";
import { ASK_CALENDAR_SUBJECT, CALENDAR_LINK_STEPS, askForCalendarMessage, othersCalendars, othersEvents, type OthersEvent } from "@shared/hubOthers";
import { clock12, type Workspace } from "@shared/teacherHub";
import { Card, GhostButton, TextArea } from "./ui";

const link = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50";
const dayName = (date: string) => { const d = new Date(`${date}T12:00:00`); return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); };
const when = (e: Pick<OthersEvent, "start" | "end">) => (e.start ? (e.end ? `${clock12(e.start)} – ${clock12(e.end)}` : clock12(e.start)) : "All day");

/**
 * How to get someone else's calendar: the steps for them, and a message asking for the link that can be
 * copied, emailed or sent as a text. The message can be changed before it is sent.
 */
export function AskForCalendar({ sender }: { /** The teacher's name, to sign the message. */ sender: string }) {
  const [text, setText] = useState(() => askForCalendarMessage(sender));
  const [copied, setCopied] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  async function copy() {
    try { await navigator.clipboard.writeText(text); }
    catch { area.current?.select(); document.execCommand?.("copy"); } // older browsers, and pages that are not allowed the clipboard
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }
  const body = encodeURIComponent(text.replace(/\r?\n/g, "\r\n"));
  return (
    <details className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700" data-testid="ask-for-calendar">
      <summary className="cursor-pointer font-semibold text-slate-900">How do I get someone else's calendar link?</summary>
      <div className="mt-3 space-y-3 leading-6">
        <p>Only the person whose calendar it is can get its link. Ask them for it, then paste it above as “Someone else's”. Here is what they do:</p>
        <ol className="list-decimal space-y-2 pl-5">
          {CALENDAR_LINK_STEPS.map((s) => <li key={s.app}><strong>{s.app}:</strong> {s.steps}{s.help ? <> <a href={s.help} target="_blank" rel="noreferrer" className="font-medium text-teal-800 underline decoration-teal-200 underline-offset-4">Steps with pictures</a></> : null}</li>)}
        </ol>
        <div>
          <label className="mb-1 block font-semibold text-slate-900" htmlFor="ask-calendar-text">A message you can send them</label>
          <TextArea id="ask-calendar-text" ref={area} value={text} onChange={(e) => setText(e.target.value)} className="min-h-56" aria-label="A message you can send them" data-testid="ask-calendar-text" />
          <div className="mt-2 flex flex-wrap gap-2">
            <GhostButton onClick={() => void copy()}>{copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy the message</>}</GhostButton>
            <a className={link} href={`mailto:?subject=${encodeURIComponent(ASK_CALENDAR_SUBJECT)}&body=${body}`} data-testid="ask-calendar-email"><Mail className="h-4 w-4" /> Email it</a>
            <a className={link} href={`sms:?&body=${body}`} data-testid="ask-calendar-text-link"><MessageSquare className="h-4 w-4" /> Text it</a>
          </div>
        </div>
        <p className="text-slate-600">Their link lets your Hub read their calendar. It can't change it. Anyone who has the link can read that calendar, so keep it to yourself. If their school has turned sharing off, they can tell you their usual times and you can save those as their availability on your IEP guide's team list.</p>
      </div>
    </details>
  );
}

/** What is on the calendars of the people the teacher follows, for the next two weeks. Nothing here can be changed: it is theirs. */
export function OthersSchedule({ workspace, today }: { workspace: Workspace; today: string }) {
  const people = othersCalendars(workspace);
  const events = useMemo(() => othersEvents(workspace, today, addDays(today, 13)), [workspace.events, workspace.calendars, today]);
  if (!people.length) return null;
  return (
    <Card title="Other people's calendars">
      <p className="text-sm text-slate-600">When the people you plan meetings with are busy, for the next two weeks. These are not on your calendar and send you no reminders. When you ask for meeting times, the times suggested stay clear of them.</p>
      <ul className="mt-3 space-y-2" data-testid="others-schedule">
        {people.map((c) => {
          const mine = events.filter((e) => e.calendarId === c.id);
          const days = [...new Set(mine.map((e) => e.date))];
          return (
            <li key={c.id} className="rounded-2xl border border-slate-200 p-3" data-testid="others-person">
              <details>
                <summary className="flex min-h-11 cursor-pointer items-center gap-3">
                  <Users className="h-5 w-5 shrink-0 text-teal-600" />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium text-slate-900">{c.name}</span><span className="block text-xs text-slate-500">{mine.length ? `${mine.length} ${mine.length === 1 ? "thing" : "things"} on their calendar in the next 2 weeks` : "Nothing on their calendar in the next 2 weeks"}{c.busyOnly ? " · busy times only" : ""}</span></span>
                </summary>
                {days.length > 0 && (
                  <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-sm">
                    {days.map((date) => (
                      <div key={date}>
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-600">{date === today ? "Today" : dayName(date)}</div>
                        <ul className="mt-0.5 space-y-0.5">{mine.filter((e) => e.date === date).map((e) => <li key={e.id} className="flex gap-2"><span className="w-40 shrink-0 text-slate-600">{when(e)}</span><span className="min-w-0 break-words text-slate-900">{e.title}</span></li>)}</ul>
                      </div>
                    ))}
                  </div>
                )}
              </details>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
