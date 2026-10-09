// Arise WorkHub: tabs that belong together share one place in the menu (goals and minutes, tasks and notes...). Inside, a row of buttons switches
// between them. The tabs themselves (and "Customize tabs") are unchanged, so a link to
// "tasks" still opens Tasks, now inside "Tasks & Notes".
import type { HubTab } from "./teacherHub";

export type HubGroupId = "home" | "calendar" | "caseload" | "progress" | "iep" | "classroom" | "tasks" | "arise" | "behavior" | "family";

export const HUB_GROUPS: readonly { id: HubGroupId; label: string; tabs: readonly HubTab[] }[] = [
  { id: "home", label: "Home", tabs: ["overview"] },
  // Arise WorkHub is the space for every A.R.I.S.E. program: the Reader's teacher tools come first.
  { id: "arise", label: "A.R.I.S.E. Reader", tabs: ["reader", "readerStudents", "readerApprovals", "readerParents", "readerQuizzes", "readerGames", "readerPrizes", "arise", "admin"] },
  { id: "calendar", label: "Calendar & Schedules", tabs: ["calendar", "schedules"] },
  { id: "caseload", label: "Caseload", tabs: ["caseload"] },
  { id: "iep", label: "IEP & Meetings", tabs: ["iep"] },
  { id: "progress", label: "Goals & Minutes", tabs: ["goals", "minutes"] },
  { id: "tasks", label: "Tasks & Notes", tabs: ["tasks", "notes"] },
  { id: "classroom", label: "Lessons & Grades", tabs: ["lessons", "gradebook"] },
  { id: "behavior", label: "Behavior & Attendance", tabs: ["behavior", "attendance"] },
  { id: "family", label: "Parents & Email", tabs: ["parents", "email"] },
];

/** What a tab is called on the row of buttons inside its group. */
export const SUB_LABELS: Partial<Record<HubTab, string>> = {
  calendar: "Calendar", schedules: "Student schedules",
  iep: "Meetings",
  goals: "Goals", minutes: "Minutes",
  tasks: "Tasks", notes: "Notes",
  lessons: "Lessons", gradebook: "Gradebook",
  behavior: "Behavior", attendance: "Attendance",
  parents: "Parents", email: "Email",
  reader: "Overview", readerStudents: "Students", readerApprovals: "Approvals", readerParents: "Parents", readerQuizzes: "Quizzes & grading",
  readerGames: "Game time", readerPrizes: "Prizes", arise: "Reading records", admin: "Admin console",
};

/** A group's name when only one of its tabs shows. */
const ALONE: Partial<Record<HubTab, string>> = { iep: "IEP & Meetings", schedules: "Schedules" };

export function groupOf(tab: HubTab) {
  return HUB_GROUPS.find((g) => g.tabs.includes(tab)) ?? HUB_GROUPS[0];
}

/** Home and the Reader's teacher tools always show; the admin console only when the page says so (admins). */
export const ALWAYS_SHOWN: readonly HubTab[] = ["overview", "reader", "readerStudents", "readerApprovals", "readerParents", "readerQuizzes", "readerGames", "readerPrizes"];
const shown = (visible: Partial<Record<HubTab, boolean>>, tab: HubTab) => ALWAYS_SHOWN.includes(tab) || (tab === "admin" ? visible.admin === true : visible[tab] !== false);

/** The tabs of a group the teacher has not hidden. */
export function groupTabs(groupId: HubGroupId, visible: Partial<Record<HubTab, boolean>>): HubTab[] {
  const g = HUB_GROUPS.find((x) => x.id === groupId);
  return g ? g.tabs.filter((t) => shown(visible, t)) : [];
}

/** The groups in the menu: those with at least one tab showing. */
export function visibleGroups(visible: Partial<Record<HubTab, boolean>>) {
  return HUB_GROUPS.filter((g) => groupTabs(g.id, visible).length > 0);
}

/** Where tapping a group goes: the tab used last in it, if it still shows, else its first tab. */
export function openGroup(groupId: HubGroupId, visible: Partial<Record<HubTab, boolean>>, last: Partial<Record<HubGroupId, HubTab>>): HubTab {
  const tabs = groupTabs(groupId, visible);
  const remembered = last[groupId];
  return remembered && tabs.includes(remembered) ? remembered : tabs[0] ?? "overview";
}

/** The group's name in the menu when only some of its tabs show ("Tasks" rather than "Tasks & Notes"). */
export function groupLabel(groupId: HubGroupId, visible: Partial<Record<HubTab, boolean>>): string {
  const g = HUB_GROUPS.find((x) => x.id === groupId);
  if (!g) return "";
  const tabs = groupTabs(groupId, visible);
  return tabs.length === 1 && g.tabs.length > 1 ? ALONE[tabs[0]] ?? SUB_LABELS[tabs[0]] ?? g.label : g.label;
}
