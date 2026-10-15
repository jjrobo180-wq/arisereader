// Arise WorkHub: telling a student's gen ed teacher about the IEP meeting (no poll: the time is already chosen),
// asking if they need their class covered and for when, and then one message to the lead teacher or supervisor
// that names each teacher and the exact time they need coverage. The messages are written to be copied or opened
// in the teacher's own email. The student's name goes to the gen ed teacher (who teaches them) but never to
// the person arranging coverage, who only needs to know who is out, and when.
import { meetingPeople } from "./hubStudentTeam";
import { clock12, type Meeting, type Workspace } from "./teacherHub";

export type CoverageAsk = NonNullable<Meeting["coverage"]>[number];
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;
const pad = (n: number) => String(n).padStart(2, "0");
const mins = (hm: string) => Number(hm.split(":")[0]) * 60 + Number(hm.split(":")[1]);
const clock = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const line = (value: unknown, max: number) => String(value ?? "").replace(/[\u0000-\u001f<>]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
export const COVERAGE_MAX = 12;

/** "Tuesday, Oct 13" */
export function dayWords(date: string): string {
  const d = new Date(`${String(date).slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
}
/** "9:00 AM to 10:00 AM", or just the start, or "" with no time. */
export function rangeWords(start: string, end: string): string {
  if (!TIME.test(start || "")) return "";
  return TIME.test(end || "") && mins(end) > mins(start) ? `${clock12(start)} to ${clock12(end)}` : clock12(start);
}
/** "an IEP meeting", "a re-evaluation meeting", "a meeting". */
export function kindWords(type: string): string {
  if (/reeval|re-eval/i.test(type || "")) return "a re-evaluation meeting";
  if (/iep/i.test(type || "")) return "an IEP meeting";
  return "a meeting";
}

/** A saved list made safe: no more than COVERAGE_MAX, times that are times, one row per person. */
export function cleanCoverage(raw: unknown): CoverageAsk[] {
  const out: CoverageAsk[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(raw) ? raw : []) {
    const id = line((item as any)?.id, 60), teacher = line((item as any)?.teacher, 80);
    if (!id || !teacher || seen.has(id)) continue;
    seen.add(id);
    const from = TIME.test((item as any)?.from || "") ? String((item as any).from).padStart(5, "0") : "";
    const to = TIME.test((item as any)?.to || "") ? String((item as any).to).padStart(5, "0") : "";
    out.push({ id, teacher, email: line((item as any)?.email, 120), needs: (item as any)?.needs === "yes" ? "yes" : (item as any)?.needs === "no" ? "no" : "", from, to });
    if (out.length >= COVERAGE_MAX) break;
  }
  return out;
}

/** The meeting's own times as the starting point for a teacher's coverage. */
export function meetingSpan(meeting: Pick<Meeting, "time" | "end">): { from: string; to: string } {
  if (!TIME.test(meeting.time || "")) return { from: "", to: "" };
  const from = String(meeting.time).padStart(5, "0");
  const to = TIME.test(meeting.end || "") && mins(meeting.end!) > mins(from) ? String(meeting.end).padStart(5, "0") : clock(mins(from) + 60);
  return { from, to };
}

/** Who is told: what was saved on the meeting, or else the student's gen ed teacher from their team. */
export function coverageAsks(ws: Workspace, meeting: Meeting): CoverageAsk[] {
  const saved = cleanCoverage(meeting.coverage);
  if (saved.length) return saved;
  const span = meetingSpan(meeting);
  return meetingPeople(ws, meeting.student).filter((p) => p.role === "genEd").map(({ person }) => ({ id: person.id, teacher: person.name, email: person.email || "", needs: "" as const, ...span }));
}

/** Teachers who need coverage with a time to cover, in the order of their times. */
export function needingCoverage(asks: CoverageAsk[]): CoverageAsk[] {
  return asks.filter((a) => a.needs === "yes" && TIME.test(a.from) && TIME.test(a.to) && mins(a.to) > mins(a.from)).sort((a, b) => mins(a.from) - mins(b.from) || a.teacher.localeCompare(b.teacher));
}

export type Message = { subject: string; body: string };
/** What to call someone: "Ms. Lopez" stays whole, "Dana Smith" becomes "Dana". */
const first = (name: string) => { const n = line(name, 80); return /^(mr|mrs|ms|miss|mx|dr|coach)\.?\s+\S+/i.test(n) ? n.split(" ").slice(0, 2).join(" ") : n.split(" ")[0] || "there"; };
const thanks = (sender: string) => `Thank you,${sender ? `\n${sender}` : ""}`;

/** The note to the gen ed teacher: the student, the day and time, and the two questions about coverage. */
export function genEdMessage(opts: { teacher: string; student: string; meeting: Pick<Meeting, "type" | "date" | "time" | "end" | "room">; sender: string }): Message {
  const { meeting } = opts;
  const day = dayWords(meeting.date), range = rangeWords(meeting.time || "", meeting.end || "");
  const student = line(opts.student, 80) || "your student";
  const when = [day, range ? `from ${range}` : ""].filter(Boolean).join(" ") || "a day we are still choosing";
  const where = meeting.room ? ` The meeting is in ${line(meeting.room, 80)}.` : "";
  return {
    subject: `${student}: ${kindWords(meeting.type).replace(/^an? /, "")}${day ? `, ${day}${range ? ` at ${clock12(meeting.time || "")}` : ""}` : ""}`.replace(/^./, (c) => c.toUpperCase()),
    body: [
      `Hi ${first(opts.teacher)},`,
      `I'm holding ${kindWords(meeting.type)} for ${student} on ${when}.${where} Your input as ${student}'s general education teacher matters, so I'd like you to be there. There's nothing to fill in or vote on; the time is set.`,
      `Will you need coverage for your class while you're at the meeting? If so, what time would you need it, from what time to what time?`,
      thanks(line(opts.sender, 80)),
    ].join("\n\n"),
  };
}

/** The note to the lead teacher or supervisor: each teacher and the exact time to cover. No student name. */
export function coverageRequest(opts: { asks: CoverageAsk[]; meeting: Pick<Meeting, "type" | "date">; sender: string; to?: string }): (Message & { count: number }) | null {
  const asks = needingCoverage(opts.asks);
  if (!asks.length) return null;
  const day = dayWords(opts.meeting.date);
  const items = asks.map((a) => `• ${a.teacher}: ${rangeWords(a.from, a.to)}`);
  const subject = asks.length === 1 ? `Coverage needed${day ? ` ${day}` : ""}: ${asks[0].teacher}, ${rangeWords(asks[0].from, asks[0].to)}` : `Coverage needed${day ? ` ${day}` : ""} for ${asks.length} teachers`;
  return {
    count: asks.length, subject,
    body: [
      `Hi ${first(opts.to || "")},`,
      `I need coverage ${day ? `on ${day} ` : ""}for ${asks.length === 1 ? "a teacher's class" : "these teachers' classes"} while they attend ${kindWords(opts.meeting.type)}:`,
      items.join("\n"),
      `Could you arrange coverage for ${asks.length === 1 ? "that time" : "these times"}? Let me know if anything needs to change or if I should do anything on my end.`,
      thanks(line(opts.sender, 80)),
    ].join("\n\n"),
  };
}
