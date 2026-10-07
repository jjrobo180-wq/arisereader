// Teacher Hub: saved emails that need something done. An email can be flagged (it floats to the top),
// and it can be put on the to-do list, where it is checked off like any other to-do. The to-do
// remembers which email it came from, so the email shows whether it is still waiting or done.
import type { EmailItem, Task, Workspace } from "./teacherHub";

export type EmailFilter = "all" | "flagged" | "todo";

const oneLine = (text: string) => String(text || "").replace(/\s+/g, " ").trim();

/** What the to-do for an email is called: its action item if one was written, otherwise "Reply to ..." from who sent it and its subject. */
export function emailTaskTitle(email: Pick<EmailItem, "from" | "subject" | "action">): string {
  const action = oneLine(String(email.action || "").split(/\r?\n/).find((line) => line.trim()) || "");
  const from = oneLine(email.from), subject = oneLine(email.subject);
  const title = action || (from && subject ? `Reply to ${from}: ${subject}` : from ? `Reply to ${from}` : subject ? `Email: ${subject}` : "Follow up on an email");
  return title.slice(0, 200).trim();
}

/** The to-do an email was put on the list as. The one still open, if there is one; otherwise the latest finished one. */
export function emailTask(workspace: Pick<Workspace, "tasks">, emailId: string): Task | undefined {
  const linked = workspace.tasks.filter((t) => t.emailId === emailId);
  return linked.find((t) => !t.done) || linked[linked.length - 1];
}

/**
 * Puts an email on the to-do list. If it is already there and still open, nothing is added.
 * `taskId` is the open to-do for it either way; null when the email is not there to add.
 */
export function addEmailToTasks(workspace: Workspace, emailId: string, makeId: () => string, dueDate = ""): { workspace: Workspace; taskId: string | null; added: boolean } {
  const email = workspace.emails.find((e) => e.id === emailId);
  if (!email) return { workspace, taskId: null, added: false };
  const open = workspace.tasks.find((t) => t.emailId === emailId && !t.done);
  if (open) return { workspace, taskId: open.id, added: false };
  const from = oneLine(email.from), subject = oneLine(email.subject);
  const about = [from && `From ${from}`, subject].filter(Boolean).join(" · ").slice(0, 300);
  const task: Task = { id: makeId(), title: emailTaskTitle(email), dueDate, recurring: "", done: false, emailId, ...(about ? { notes: about } : {}) };
  return { workspace: { ...workspace, tasks: [...workspace.tasks, task] }, taskId: task.id, added: true };
}

/** Flags an email, or takes the flag off. */
export function toggleEmailFlag(workspace: Workspace, emailId: string): Workspace {
  if (!workspace.emails.some((e) => e.id === emailId)) return workspace;
  return { ...workspace, emails: workspace.emails.map((e) => { if (e.id !== emailId) return e; const { flagged, ...rest } = e; return flagged ? rest : { ...rest, flagged: true }; }) };
}

/** The saved emails to show: flagged ones first, the rest in the order they were saved (newest first). */
export function arrangeEmails(workspace: Pick<Workspace, "emails" | "tasks">, filter: EmailFilter = "all"): EmailItem[] {
  const waiting = new Set(workspace.tasks.filter((t) => t.emailId && !t.done).map((t) => t.emailId));
  const shown = workspace.emails.filter((e) => (filter === "flagged" ? !!e.flagged : filter === "todo" ? waiting.has(e.id) : true));
  return [...shown.filter((e) => e.flagged), ...shown.filter((e) => !e.flagged)];
}

export function emailCounts(workspace: Pick<Workspace, "emails" | "tasks">): { all: number; flagged: number; todo: number } {
  return { all: workspace.emails.length, flagged: workspace.emails.filter((e) => e.flagged).length, todo: arrangeEmails(workspace, "todo").length };
}
