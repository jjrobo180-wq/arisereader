// Arise WorkHub: reminders sent from the Apple Reminders app (by an iPhone Shortcut) become to-dos.
// One way only: Apple Reminders to the Hub. Nothing is written back to the Reminders app.
import type { Task } from "./teacherHub";

export type AppleReminder = { key: string; title: string; due: string; notes: string; done: boolean };

export const APPLE_LIMITS = { perSend: 200, title: 200, notes: 1000, inbox: 400 } as const;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const real = (y: number, m: number, d: number) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : ""; };

/** A date as Shortcuts or a person may write it ("2026-10-12", "10/12/2026", "Oct 12, 2026", "12 Oct 2026") as YYYY-MM-DD, or "". */
export function parseDue(raw: unknown): string {
  const s = String(raw ?? "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return real(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})\b/.exec(s);
  if (m) return real(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
  m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/.exec(s);
  if (m && MONTHS.includes(m[1].toLowerCase())) return real(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]);
  m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})/.exec(s);
  if (m && MONTHS.includes(m[2].toLowerCase())) return real(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
  return "";
}

const clip = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

function one(raw: any): AppleReminder | null {
  const title = clip(raw?.title ?? raw?.name, APPLE_LIMITS.title);
  if (!title) return null;
  const done = raw?.completed === true || raw?.done === true || /^(true|yes|1)$/i.test(String(raw?.completed ?? raw?.done ?? ""));
  return { key: clip(raw?.id, 120) || `t:${title.toLowerCase()}`, title, due: parseDue(raw?.due ?? raw?.dueDate ?? raw?.date), notes: String(raw?.notes ?? "").trim().slice(0, APPLE_LIMITS.notes), done };
}

/**
 * What a Shortcut sent, made safe. Accepts {"reminders":[{title, due, notes, completed, id}]}, a bare list, or plain text with one
 * reminder per line ("Call Ms. Lee | 2026-10-12", with an optional third part, "Yes", for one that is already done).
 */
export function cleanReminders(raw: unknown): AppleReminder[] {
  let list: any[] = [];
  if (typeof raw === "string") {
    list = raw.split(/\r?\n/).map((line) => { const [title, due, state] = line.split("|").map((x) => x.trim()); return { title, due, completed: state }; });
  } else if (Array.isArray(raw)) list = raw;
  else if (Array.isArray((raw as any)?.reminders)) list = (raw as any).reminders;
  else if (raw && typeof raw === "object" && ((raw as any).title || (raw as any).name)) list = [raw];
  const seen = new Set<string>();
  const out: AppleReminder[] = [];
  for (const item of list.slice(0, APPLE_LIMITS.perSend)) {
    const r = one(item);
    if (r && !seen.has(r.key)) { seen.add(r.key); out.push(r); }
  }
  return out;
}

export type AppleTask = Task & { appleId?: string };

/** New reminders become to-dos; ones already brought in are updated (a reminder checked off in Apple is checked off here). */
export function mergeReminders(tasks: AppleTask[], items: AppleReminder[], makeId: () => string, today: string): { tasks: AppleTask[]; added: number; updated: number } {
  let added = 0, updated = 0;
  const next = [...tasks];
  for (const item of items) {
    const at = next.findIndex((t) => t.appleId === item.key);
    if (at < 0) {
      next.push({ id: makeId(), title: item.title, dueDate: item.due, recurring: "", done: item.done, notes: item.notes || undefined, appleId: item.key, ...(item.done ? { doneAt: `${today}T12:00:00.000Z` } : {}) });
      added++;
      continue;
    }
    const t = next[at];
    const change: Partial<AppleTask> = {};
    if (item.done && !t.done) Object.assign(change, { done: true, doneAt: `${today}T12:00:00.000Z` });
    if (item.title !== t.title || (item.due && item.due !== t.dueDate)) Object.assign(change, { title: item.title, dueDate: item.due || t.dueDate });
    if (Object.keys(change).length) { next[at] = { ...t, ...change }; updated++; }
  }
  return { tasks: next, added, updated };
}

export const appleSummary = (added: number, updated: number) =>
  [added ? `${added} new from Apple Reminders` : "", updated ? `${updated} updated` : ""].filter(Boolean).join(", ");
