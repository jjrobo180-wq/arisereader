// What WorkHub's notification bell lists besides the account's own notifications (the Reader's
// approvals, messages and so on): what needs doing today. Built from the workspace so it can be tested.
// Keys start with "work:" so the bell knows they are made on this device, not stored on the server.
import { calendarEvents } from "./hubHidden";
import { clock12, type Workspace } from "./teacherHub";
import type { FeedItem } from "./notifications";

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
const hm = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const MAX = 14;

/**
 * `newPollAnswers`: how many answers to the teacher's meeting polls they have not looked at yet; `newestPollAnswerAt`:
 * when the latest of them came in. Both are in the alert's key, so clearing it hides these answers only, and the next ones show.
 */
export function workAlerts(workspace: Workspace, today: string, nowMs: number, newPollAnswers = 0, newestPollAnswerAt = ""): FeedItem[] {
  const nowIso = new Date(nowMs).toISOString();
  const now = hm(nowMs);
  const soon = hm(nowMs + 3 * 3_600_000);
  const go = (tab: string) => ({ type: `work:${tab}`, id: 0 });
  const out: FeedItem[] = [];

  if (newPollAnswers > 0) {
    out.push({ key: `work:polls:${newPollAnswers}:${Date.parse(newestPollAnswerAt) || 0}`, kind: "action", category: "message", title: `${newPollAnswers} new meeting poll ${plural(newPollAnswers, "answer")}`, body: "Tap to see who can make it", createdAt: nowIso, target: go("polls") });
  }

  const tasks = (workspace.tasks || []).filter((t) => !t.done && t.dueDate && t.dueDate.slice(0, 10) <= today)
    .sort((a, b) => (a.dueDate.slice(0, 10) + (a.dueTime || "")).localeCompare(b.dueDate.slice(0, 10) + (b.dueTime || "")));
  for (const t of tasks) {
    const due = t.dueDate.slice(0, 10);
    const late = due < today || (!!t.dueTime && t.dueTime < now);
    out.push({
      key: `work:task:${t.id}:${due}`, kind: "action", category: late ? "report" : "request", title: t.title || "To-do",
      body: due < today ? `Overdue since ${shortDate(due)}` : t.dueTime ? `Due today at ${clock12(t.dueTime)}` : "Due today",
      createdAt: nowIso, target: go("tasks"),
    });
  }

  for (const m of (workspace.meetings || []).filter((x) => !x.done && (x.date || "").slice(0, 10) === today).sort((a, b) => (a.time || "").localeCompare(b.time || ""))) {
    out.push({
      key: `work:meeting:${m.id}:${today}`, kind: "action", category: "club", title: `${m.type || "Meeting"}${m.student ? `: ${m.student}` : ""}`,
      body: m.time ? `Today at ${clock12(m.time)}${m.room ? ` · ${m.room}` : ""}` : "Today", createdAt: nowIso, target: go("iep"),
    });
  }

  for (const e of calendarEvents(workspace, today, today).filter((x) => x.date === today && !x.done && x.start && x.start >= now && x.start <= soon).slice(0, 3)) {
    out.push({ key: `work:event:${e.id}:${today}`, kind: "action", category: "message", title: `${e.title || "Event"} at ${clock12(e.start)}`, body: e.location || "Coming up in the next few hours", createdAt: nowIso, target: go("calendar") });
  }

  return out.slice(0, MAX);
}
