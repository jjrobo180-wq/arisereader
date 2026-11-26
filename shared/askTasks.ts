// "@arise what tasks do I have left?" in Arise Notes (and Undercover): the answer comes from the person's real
// Arise To Do task lists (LifeHub, and WorkHub for teachers), not just their notes. server/undercover.ts adds
// these lines to the AI's facts when the question is about tasks.

/** Is the question about the person's tasks or to-dos? */
export function wantsTasks(q: string): boolean {
  return /\b(tasks?|to-?dos?|to do list|todo list|checklist|left to do|need to do|have to do|due (today|tomorrow|this week)|overdue)\b/i.test(q);
}

type Open = { title: string; due: string; time: string; list: string; where: string };
const s = (v: unknown, n = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** The open (not done, not archived) tasks from a LifeHub and a WorkHub workspace, soonest first. */
export function openTasks(life: any, work: any): Open[] {
  const out: Open[] = [];
  const lifeLists = new Map<string, string>((Array.isArray(life?.lists) ? life.lists : []).map((l: any) => [String(l?.id), s(l?.name, 40)]));
  for (const t of Array.isArray(life?.tasks) ? life.tasks : []) {
    if (!t || t.done || t.archived || !s(t.title)) continue;
    out.push({ title: s(t.title), due: /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : "", time: /^\d{2}:\d{2}$/.test(t.time) ? t.time : "", list: lifeLists.get(String(t.listId)) || "", where: "To Do" });
  }
  const workLists = new Map<string, string>((Array.isArray(work?.taskLists) ? work.taskLists : []).map((l: any) => [String(l?.id), s(l?.name, 40)]));
  for (const t of Array.isArray(work?.tasks) ? work.tasks : []) {
    if (!t || t.done || t.archived || !s(t.title)) continue;
    out.push({ title: s(t.title), due: /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) ? t.dueDate : "", time: /^\d{2}:\d{2}$/.test(t.dueTime) ? t.dueTime : "", list: workLists.get(String(t.listId)) || "", where: "WorkHub" });
  }
  return out.sort((a, b) => (a.due ? 0 : 1) - (b.due ? 0 : 1) || `${a.due}${a.time}`.localeCompare(`${b.due}${b.time}`));
}

/** The facts line for the AI: every open task (up to 60), or that there are none. */
export function tasksFacts(tasks: Open[], today: string): string {
  if (!tasks.length) return "The person's Arise To Do task lists have no unfinished tasks. Say they're all caught up.";
  const line = (t: Open) => `${t.title}${t.due ? ` (due ${t.due}${t.time ? ` ${t.time}` : ""}${t.due < today ? ", overdue" : ""})` : ""}${t.list ? ` [${t.list}]` : ""}`;
  const shown = tasks.slice(0, 60);
  return `The person's unfinished tasks from their Arise To Do task lists (today is ${today}). When they ask about their tasks, list these one per line, soonest first, and don't say their notes have none: ${shown.map(line).join("; ")}${tasks.length > shown.length ? `; and ${tasks.length - shown.length} more` : ""}.`;
}
