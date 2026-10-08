// Teacher Hub calendar: hiding events that are on the teacher's calendar but are not theirs to go to
// (a family calendar's "Ari: parallel play" that someone else takes her to). A hidden event is not
// shown, does not count as busy, and sends no reminder. Nothing is deleted: it can be shown again.
import { isOthers } from "./hubOthers";
import { expandEvents } from "./hubRepeat";
import type { HiddenRule, HubCalendar, HubEvent, Workspace } from "./teacherHub";

const fold = (text: string) => String(text || "").trim().toLowerCase().replace(/\s+/g, " ");

export type HideScope = "one" | "all";

export function isHidden(event: Pick<HubEvent, "title" | "date" | "start">, rules: HiddenRule[] | undefined): boolean {
  if (!rules?.length) return false;
  const title = fold(event.title);
  return rules.some((r) => fold(r.title) === title && (!r.date || (r.date === event.date && (r.start || "") === (event.start || ""))));
}

/**
 * The teacher's own events to draw and to plan around between two days: repeating events worked out day
 * by day, hidden ones left out. Use this everywhere the calendar is read. Events on other people's
 * calendars are never in it (shared/hubOthers.ts has those): they are not the teacher's to go to.
 */
export function calendarEvents(workspace: Pick<Workspace, "events" | "hiddenEvents"> & { calendars?: HubCalendar[] }, from: string, to: string): HubEvent[] {
  const theirs = new Set((workspace.calendars || []).filter(isOthers).map((c) => c.id));
  const mine = theirs.size ? (workspace.events || []).filter((e) => !e.calendarId || !theirs.has(e.calendarId)) : workspace.events || [];
  const all = expandEvents(mine, from, to);
  const rules = workspace.hiddenEvents;
  return rules?.length ? all.filter((e) => !isHidden(e, rules)) : all;
}

/** Hides this event ("one": just this day and time) or every event with its name ("all"). */
export function hideEvent(workspace: Workspace, event: Pick<HubEvent, "title" | "date" | "start">, scope: HideScope, makeId: () => string): { workspace: Workspace; ruleId: string | null } {
  const title = event.title.trim();
  if (!title) return { workspace, ruleId: null };
  const rules = workspace.hiddenEvents || [];
  const rule: HiddenRule = { id: makeId(), title, date: scope === "one" ? event.date : "", start: scope === "one" ? event.start || "" : "" };
  const same = rules.find((r) => fold(r.title) === fold(title) && r.date === rule.date && r.start === rule.start);
  if (same) return { workspace, ruleId: same.id };
  // "Every one" makes the single-day rules for the same name pointless.
  const kept = scope === "all" ? rules.filter((r) => fold(r.title) !== fold(title)) : rules;
  return { workspace: { ...workspace, hiddenEvents: [...kept, rule] }, ruleId: rule.id };
}

/** Shows a hidden event (or name) again. */
export function showAgain(workspace: Workspace, ruleId: string): Workspace {
  const rules = workspace.hiddenEvents || [];
  return rules.some((r) => r.id === ruleId) ? { ...workspace, hiddenEvents: rules.filter((r) => r.id !== ruleId) } : workspace;
}
