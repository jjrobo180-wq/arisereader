// Arise WorkHub: tabs that belong together share one place in the menu (goals and minutes, tasks and notes...). Inside, a row of buttons switches
// between them. The tabs themselves (and "Customize tabs") are unchanged, so a link to
// "tasks" still opens Tasks, now inside "Tasks & Notes".
import { isTabOn, type HubTab } from "./teacherHub";

export type HubGroupId =
  | "home" | "arise" | "records" | "admin" | "calendar" | "schedules" | "caseload" | "iep" | "goals" | "minutes"
  | "tasks" | "notes" | "lessons" | "gradebook" | "behavior" | "attendance" | "parents" | "email";

export const HUB_GROUPS: readonly { id: HubGroupId; label: string; tabs: readonly HubTab[] }[] = [
  { id: "home", label: "Home", tabs: ["overview"] },
  // A.R.I.S.E. Reader has its own page now (/reader, client/src/pages/AriseReader.tsx), so this is
  // a way out of the hub rather than a group of tabs: tapping it leaves for that page. One tab is
  // kept so the item still shows, and can be hidden in Customize like any other.
  { id: "arise", label: "A.R.I.S.E. Reader", tabs: ["reader"] },
  // Reading records is a WorkHub screen (the class's reading at a glance), not one of the Reader's
  // own, so it stayed behind when the Reader left — and needed its own item rather than vanishing.
  { id: "records", label: "Reading records", tabs: ["arise"] },
  // The admin console used to sit inside the Reader group. It is not a Reader screen, and with the
  // Reader gone it would have had nowhere to live, so it stands on its own (admins only).
  { id: "admin", label: "Admin console", tabs: ["admin"] },
  // Everything else stands on its own, so the menu names the screen you are going to.
  { id: "calendar", label: "Calendar", tabs: ["calendar"] },
  { id: "schedules", label: "Student schedules", tabs: ["schedules"] },
  { id: "caseload", label: "Caseload", tabs: ["caseload"] },
  { id: "iep", label: "Meetings", tabs: ["iep"] },
  { id: "goals", label: "Goals", tabs: ["goals"] },
  { id: "minutes", label: "Minutes", tabs: ["minutes"] },
  { id: "tasks", label: "Tasks", tabs: ["tasks"] },
  { id: "notes", label: "Notes", tabs: ["notes"] },
  { id: "lessons", label: "Lessons", tabs: ["lessons"] },
  { id: "gradebook", label: "Gradebook", tabs: ["gradebook"] },
  { id: "behavior", label: "Behavior", tabs: ["behavior"] },
  { id: "attendance", label: "Attendance", tabs: ["attendance"] },
  { id: "parents", label: "Parents", tabs: ["parents"] },
  { id: "email", label: "Email", tabs: ["email"] },
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
  reader: "Overview", readerLive: "Live quiz", readerScenes: "Scenes", readerStudents: "Students", readerAdvisory: "Advisory & Lit", readerApprovals: "Approvals", readerParents: "Parents", readerQuizzes: "Quizzes & grading",
  readerGames: "Game time", readerPrizes: "Prizes", arise: "Reading records", admin: "Admin console",
};

/** A group's name when only one of its tabs shows. */
const ALONE: Partial<Record<HubTab, string>> = { iep: "IEP & Meetings", schedules: "Schedules" };

export function groupOf(tab: HubTab) {
  return HUB_GROUPS.find((g) => g.tabs.includes(tab)) ?? HUB_GROUPS[0];
}

/** A saved `groupOrder` (everything but Home, which always stays first) made safe to use: every
 *  reorderable group appears exactly once, keeping the saved order where valid and appending
 *  anything missing (a new group, or one dropped from a stale save) at the end. */
const REORDERABLE: readonly HubGroupId[] = HUB_GROUPS.filter((g) => g.id !== "home").map((g) => g.id);
export function cleanGroupOrder(v: unknown): HubGroupId[] {
  const saved = Array.isArray(v) ? v.filter((id): id is HubGroupId => REORDERABLE.includes(id as HubGroupId)) : [];
  const seen = new Set(saved);
  return [...saved, ...REORDERABLE.filter((id) => !seen.has(id))];
}

/** Home and the Reader's teacher tools always show; the admin console only when the page says so (admins). */
export const ALWAYS_SHOWN: readonly HubTab[] = ["overview", "reader", "readerLive", "readerScenes", "readerStudents", "readerAdvisory", "readerApprovals", "readerParents", "readerQuizzes", "readerGames", "readerPrizes"];
const shown = (visible: Partial<Record<HubTab, boolean>>, tab: HubTab, isAdmin = false) =>
  ALWAYS_SHOWN.includes(tab) || (tab === "admin" ? visible.admin === true : isTabOn(tab, visible, isAdmin));

/** The tabs of a group the teacher has not hidden. */
export function groupTabs(groupId: HubGroupId, visible: Partial<Record<HubTab, boolean>>, isAdmin = false): HubTab[] {
  const g = HUB_GROUPS.find((x) => x.id === groupId);
  return g ? g.tabs.filter((t) => shown(visible, t, isAdmin)) : [];
}

/** The groups in the menu: those with at least one tab showing, in the teacher's chosen order
 *  (Home always first, whatever order is passed). */
export function visibleGroups(visible: Partial<Record<HubTab, boolean>>, order?: readonly string[], isAdmin = false) {
  const ids = order?.length ? ["home", ...cleanGroupOrder(order)] : HUB_GROUPS.map((g) => g.id);
  return ids
    .map((id) => HUB_GROUPS.find((g) => g.id === id))
    .filter((g): g is (typeof HUB_GROUPS)[number] => !!g && groupTabs(g.id, visible, isAdmin).length > 0);
}

/** Where tapping a group goes: the tab used last in it, if it still shows, else its first tab. */
export function openGroup(groupId: HubGroupId, visible: Partial<Record<HubTab, boolean>>, last: Partial<Record<HubGroupId, HubTab>>, isAdmin = false): HubTab {
  // Admins can see every WorkHub app without installing it. Match the
  // visibility rule that built their menu; otherwise clicking a visible admin
  // app silently falls back to Home when its saved visible flag is false.
  const tabs = groupTabs(groupId, visible, isAdmin);
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
