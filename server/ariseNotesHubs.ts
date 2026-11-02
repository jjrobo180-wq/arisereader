// Arise Notes → Arise To Duo. Action items become to-dos, meeting dates go on the calendar, and an
// IEP draft is filed under the student in WorkHub (goals, service minutes, the meeting and a note),
// always after the person checked them on the review screen.
//
// The hubs are saved as one copy per person (arise_todo_workspaces for LifeHub, teacher_hub_workspaces
// for WorkHub). Each change here reads the newest copy, adds to it and saves it only if nobody saved
// in between (otherwise it reads again and retries), the same rule the apps themselves follow, so
// nothing anyone typed is ever overwritten. Open hubs pick the change up on their next check.
import { randomUUID } from "node:crypto";
import { cleanFamily, emptyFamily } from "../shared/familyHub";
import { cleanHubImport, emptyHubImport, mergeHubImport, normalizeWorkspace, type HubImportItems, type ServicePlan, type Workspace } from "../shared/teacherHub";
import type { IepDraft } from "../shared/ariseNotes";

export type LifeCopy = { workspace: any; updatedAt: string } | null;
export type LifeStore = {
  get(userId: number): Promise<LifeCopy>;
  /** Saves only if the saved copy is still `expected` (null: there was none). False when someone saved first. */
  save(userId: number, workspace: any, expected: string | null): Promise<boolean>;
};
export type WorkStore = {
  get(userId: number): Promise<{ workspace: Record<string, any>; updatedAt: string } | null>;
  save(userId: number, workspace: Record<string, any>, expected: string | null): Promise<string | null>;
};

export type TaskIn = { title: string; notes: string; due: string; time: string; who: string };
export type EventIn = { title: string; date: string; time: string; notes: string };

const LIFE_LISTS = [
  { id: "personal", name: "Personal", color: "#7566e8" },
  { id: "work", name: "Work", color: "#f59e72" },
  { id: "family", name: "Family", color: "#36b6a5" },
];
const MAX_LIFE_BYTES = 5_000_000;
const day = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const hm = (v: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : "");
const cut = (v: string, n: number) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);

export function createSupabaseLifeStore(db: () => any): LifeStore {
  return {
    async get(userId) {
      const { data, error } = await db().from("arise_todo_workspaces").select("workspace, updated_at").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data ? { workspace: data.workspace, updatedAt: String(data.updated_at) } : null;
    },
    async save(userId, workspace, expected) {
      const stamp = new Date(Math.max(Date.now(), (expected ? Date.parse(expected) : 0) + 1)).toISOString();
      if (expected === null) {
        const { error } = await db().from("arise_todo_workspaces").insert({ user_id: userId, workspace, updated_at: stamp });
        if (error?.code === "23505") return false;
        if (error) throw error;
        return true;
      }
      const { data, error } = await db().from("arise_todo_workspaces").update({ workspace, updated_at: stamp }).eq("user_id", userId).eq("updated_at", expected).select("user_id");
      if (error) throw error;
      return !!data?.length;
    },
  };
}

/** LifeHub lists and calendars, for the review screen. */
export async function lifeTargets(store: LifeStore, userId: number) {
  const row = await store.get(userId);
  const ws = row?.workspace;
  const lists = Array.isArray(ws?.lists) && ws.lists.length ? ws.lists.map((l: any) => ({ id: String(l.id), name: String(l.name), color: String(l.color) })) : LIFE_LISTS;
  const calendars = (ws?.version === 2 && Array.isArray(ws?.family?.calendars) ? ws.family.calendars : emptyFamily().calendars).filter((c: any) => !c.url).map((c: any) => ({ id: String(c.id), name: String(c.name), color: String(c.color) }));
  return { lists, calendars };
}

/** Adds to-dos and calendar events to LifeHub. */
export async function addToLife(store: LifeStore, userId: number, o: { tasks: TaskIn[]; events: EventIn[]; listId?: string; calendarId?: string; from: string }) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await store.get(userId);
    let ws: any = row?.workspace && typeof row.workspace === "object" ? structuredClone(row.workspace) : { version: 2, lists: LIFE_LISTS.map((l) => ({ ...l })), tasks: [], family: emptyFamily() };
    if (!Array.isArray(ws.lists) || !ws.lists.length) ws.lists = LIFE_LISTS.map((l) => ({ ...l }));
    if (!Array.isArray(ws.tasks)) ws.tasks = [];
    if (ws.version !== 2 || !ws.family || typeof ws.family !== "object") ws = { ...ws, version: 2, family: cleanFamily(ws.family) };
    const list = ws.lists.find((l: any) => l.id === o.listId) ?? ws.lists[0];
    const now = new Date().toISOString();
    if (ws.tasks.length + o.tasks.length > 5000) throw new Error("Your LifeHub to-do list is full (5,000 to-dos). Clear some finished ones first.");
    for (const t of o.tasks) {
      const notes = [t.notes, `From Arise Notes: ${o.from}`].filter(Boolean).join("\n").slice(0, 2000);
      ws.tasks.push({ id: randomUUID(), title: cut(t.title, 200) || "To-do from Arise Notes", notes, listId: list.id, assignee: cut(t.who, 100), due: day(t.due), time: day(t.due) ? hm(t.time) : "", priority: "normal", repeat: "none", done: false, createdAt: now });
    }
    if (o.events.length) {
      const cals = Array.isArray(ws.family.calendars) ? ws.family.calendars : [];
      const cal = cals.find((c: any) => c.id === o.calendarId && !c.url) ?? cals.find((c: any) => !c.url) ?? { id: "family" };
      const events = Array.isArray(ws.family.events) ? ws.family.events : [];
      for (const e of o.events) {
        if (!day(e.date)) continue;
        events.push({ id: randomUUID(), title: cut(e.title, 120) || "Meeting", date: e.date, time: hm(e.time), endTime: "", calendarId: cal.id, memberIds: [], location: "", notes: [cut(e.notes, 900), `From Arise Notes: ${o.from}`].filter(Boolean).join("\n").slice(0, 1000), repeat: "none" });
      }
      ws.family = cleanFamily({ ...ws.family, events });
    }
    if (Buffer.byteLength(JSON.stringify(ws), "utf8") > MAX_LIFE_BYTES) throw new Error("Your LifeHub is out of space. Export a backup and remove old items first.");
    if (await store.save(userId, ws, row ? row.updatedAt : null)) return { list: list.name, tasks: o.tasks.length, events: o.events.filter((e) => day(e.date)).length };
  }
  throw new Error("Your LifeHub was busy saving on another device. Try again in a moment.");
}

const WORK_TODAY = () => new Date().toISOString().slice(0, 10);
async function changeWork(store: WorkStore, userId: number, change: (ws: Workspace) => { ws: Workspace; added: number }) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await store.get(userId);
    const { ws, added } = change(normalizeWorkspace(row?.workspace ? structuredClone(row.workspace) : {}));
    if ((await store.save(userId, ws as any, row ? row.updatedAt : null)) !== null) return added;
  }
  throw new Error("Your WorkHub was busy saving on another device. Try again in a moment.");
}

/** Caseload names, for the IEP review screen. */
export async function workTargets(store: WorkStore, userId: number) {
  const row = await store.get(userId);
  const ws = normalizeWorkspace(row?.workspace ?? {});
  return { students: ws.students.map((s) => s.name).filter(Boolean).slice(0, 500) };
}

/** Adds reminders and calendar events to WorkHub (the same way its own import adds them, so nothing doubles). */
export async function addToWork(store: WorkStore, userId: number, o: { tasks: TaskIn[]; events: EventIn[]; from: string }) {
  const items: HubImportItems = { ...emptyHubImport(), tasks: o.tasks.map((t) => ({ title: cut(t.title, 200), dueDate: day(t.due), dueTime: day(t.due) ? hm(t.time) : "", recurring: "" })), events: o.events.filter((e) => day(e.date)).map((e) => ({ title: cut(e.title, 200), date: e.date, start: hm(e.time), end: "", location: "", notes: [cut(e.notes, 400), `From Arise Notes: ${o.from}`].filter(Boolean).join(" · ") })) };
  const clean = cleanHubImport(items, WORK_TODAY());
  const added = await changeWork(store, userId, (ws) => {
    const r = mergeHubImport(ws, clean, randomUUID, null);
    return { ws: r.workspace, added: Object.values(r.added).reduce((a, b) => a + (b || 0), 0) };
  });
  return { tasks: clean.tasks.length, events: clean.events.length, added };
}

/** Files a reviewed IEP draft under one caseload student: goals, weekly service minutes, the next
 *  meeting, the next steps as reminders, accommodations on the student, and the draft as a note. */
export async function addIepToWork(store: WorkStore, userId: number, o: { student: string; iep: IepDraft; meetingDay: string; noteText: string; from: string }) {
  const student = cut(o.student, 80);
  if (!student) throw new Error("Choose the student this IEP meeting was about.");
  const i = o.iep;
  const items: HubImportItems = {
    ...emptyHubImport(),
    goals: i.goals.map((g) => ({ student, area: cut(g.area, 40), text: cut(g.text, 600), baseline: 0, target: null, unit: "", startDate: day(o.meetingDay), targetDate: "" })),
    meetings: day(i.nextMeeting) ? [{ student, type: "Annual IEP", date: i.nextMeeting, notes: `Next meeting set at the ${o.meetingDay} meeting (Arise Notes).` }] : [],
    notes: [{ student, type: "Meeting note", date: day(o.meetingDay), body: o.noteText.slice(0, 4000) }],
    tasks: i.nextSteps.map((s) => ({ title: cut(`${s.what}${s.who ? ` (${s.who})` : ""}`, 200), dueDate: day(s.due), dueTime: "", recurring: "" })),
  };
  const clean = cleanHubImport(items, WORK_TODAY());
  const perWeek = (m: number, per: string) => Math.round(per === "day" ? m * 5 : per === "month" ? (m * 12) / 52 : m);
  let services = 0;
  await changeWork(store, userId, (ws) => {
    const r = mergeHubImport(ws, clean, randomUUID, null);
    const next: Workspace = r.workspace;
    const plans: ServicePlan[] = [...(next.services || [])];
    for (const s of i.services) {
      const kind = cut(s.service, 60);
      if (!kind || !(s.minutes > 0)) continue;
      const have = plans.find((p) => p.student.toLowerCase() === student.toLowerCase() && p.kind.toLowerCase() === kind.toLowerCase());
      if (have) have.minutesPerWeek = perWeek(s.minutes, s.per);
      else plans.push({ id: randomUUID(), student, kind, minutesPerWeek: perWeek(s.minutes, s.per), since: day(o.meetingDay) || undefined });
      services++;
    }
    next.services = plans;
    if (i.accommodations.length) {
      next.students = next.students.map((st) => {
        if (st.name.trim().toLowerCase() !== student.toLowerCase()) return st;
        const haveText = (st.accommodations || "").toLowerCase();
        const add = i.accommodations.filter((a) => !haveText.includes(a.toLowerCase()));
        return add.length ? { ...st, accommodations: [st.accommodations, ...add].filter(Boolean).join("; ").slice(0, 600) } : st;
      });
    }
    return { ws: next, added: 0 };
  });
  return { goals: clean.goals.length, services, meetings: clean.meetings.length, reminders: clean.tasks.length };
}
