// Arise Notes → Arise To Duo: checked action items and dates really land in LifeHub and WorkHub, in
// the shapes those hubs read (shared/familyHub.ts FamilyEvent, shared/teacherHub.ts Task). Also the
// iPhone app's helpers that put the same items in Apple Reminders and the iPhone Calendar.
// Run with: npx tsx --test tests/arise-notes-planner.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { registerAriseNotesRoutes } from "../server/ariseNotes";
import { createMemoryNotesStore } from "../server/ariseNotesStore";
import type { LifeStore, WorkStore } from "../server/ariseNotesHubs";
import type { Hearer } from "../server/ariseNotesAi";
import { dueMs, eventSpan } from "../client/src/lib/notesApple";

const NOW = Date.parse("2026-11-15T18:00:00Z");

function memoryLife(): LifeStore & { rows: Map<number, { workspace: any; updatedAt: string }> } {
  const rows = new Map<number, { workspace: any; updatedAt: string }>();
  let n = 0;
  return {
    rows,
    async get(id) { const r = rows.get(id); return r ? structuredClone(r) : null; },
    async save(id, workspace, expected) {
      const cur = rows.get(id);
      if ((cur?.updatedAt ?? null) !== expected) return false;
      rows.set(id, { workspace: structuredClone(workspace), updatedAt: `v${++n}` });
      return true;
    },
  };
}
function memoryWork(): WorkStore & { rows: Map<number, { workspace: any; updatedAt: string }> } {
  const rows = new Map<number, { workspace: any; updatedAt: string }>();
  let n = 0;
  return {
    rows,
    async get(id) { const r = rows.get(id); return r ? structuredClone(r) : null; },
    async save(id, workspace, expected) {
      const cur = rows.get(id);
      if ((cur?.updatedAt ?? null) !== expected) return null;
      const v = `v${++n}`;
      rows.set(id, { workspace: structuredClone(workspace), updatedAt: v });
      return v;
    },
  };
}

async function server(t: any) {
  const store = createMemoryNotesStore(() => NOW);
  const life = memoryLife();
  const work = memoryWork();
  const hear: Hearer = { hear: async () => ({ lines: [], duration: 0, provider: "test", diarized: false }), available: () => true, speakersAvailable: () => false };
  const users: Record<number, any> = { 2: { id: 2, displayName: "Pat", role: "teacher" }, 3: { id: 3, displayName: "Sam", role: "parent" } };
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { const u = users[Number(req.headers["x-user"])]; if (u) req.user = u; next(); });
  registerAriseNotesRoutes(app, (_req, _res, next) => next(), {
    store, hear, ask: async () => ({ json: {}, chars: 0 }), aiReady: () => true,
    planOf: async () => "basic", getUser: async (id) => users[id] ?? null, life, work, now: () => NOW,
  });
  const srv = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => srv.once("listening", () => r()));
  t.after(() => srv.close());
  const base = `http://127.0.0.1:${(srv.address() as any).port}`;
  const call = async (user: number, method: string, path: string, body?: any) => {
    const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json", "x-user": String(user) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
  };
  return { store, life, work, call };
}

test("checked to-dos and dates go into LifeHub, the way LifeHub shows them", async (t) => {
  const { life, call } = await server(t);
  const id = (await call(2, "POST", "/api/notes", { title: "Parent conference", saveOnly: true })).body.note.id;

  const targets = (await call(2, "GET", "/api/notes/hubs/targets")).body;
  assert.deepEqual(targets.life.lists.map((l: any) => l.name), ["Personal", "Work", "Family"], "a new LifeHub's lists");

  const sent = await call(2, "POST", `/api/notes/${id}/send`, {
    hub: "life", listId: "family",
    tasks: [{ title: "Email the reading log", due: "2026-11-20", time: "15:30", who: "Pat" }, { title: "Buy a planner", due: "", time: "" }],
    events: [{ title: "Follow-up meeting", date: "2026-12-02", time: "08:15" }],
  });
  assert.equal(sent.status, 200);
  assert.deepEqual([sent.body.hub, sent.body.list, sent.body.tasks, sent.body.events], ["life", "Family", 2, 1]);

  const ws = life.rows.get(2)!.workspace;
  assert.equal(ws.version, 2);
  const [a, b] = ws.tasks;
  assert.deepEqual([a.title, a.listId, a.due, a.time, a.assignee, a.done, a.repeat], ["Email the reading log", "family", "2026-11-20", "15:30", "Pat", false, "none"]);
  assert.match(a.notes, /From Arise Notes: Parent conference/);
  assert.deepEqual([b.title, b.due, b.time], ["Buy a planner", "", ""], "no date is fine");
  const ev = ws.family.events.find((e: any) => e.title === "Follow-up meeting");
  assert.ok(ev, "the event is on the LifeHub calendar");
  assert.deepEqual([ev.date, ev.time, ev.endTime, ev.repeat], ["2026-12-02", "08:15", "", "none"]);
  assert.ok(ws.family.calendars.some((c: any) => c.id === ev.calendarId && !c.url), "on one of LifeHub's own calendars");
  for (const k of ["id", "title", "date", "time", "endTime", "calendarId", "memberIds", "location", "notes", "repeat"]) assert.ok(k in ev, `event has ${k}`);

  // A second send adds to what's there and keeps everything else.
  ws.tasks.push({ id: "mine", title: "Something I added in LifeHub", listId: "personal", due: "", time: "", done: false });
  await life.save(2, ws, life.rows.get(2)!.updatedAt);
  await call(2, "POST", `/api/notes/${id}/send`, { hub: "life", tasks: [{ title: "Call the school" }], events: [] });
  const after = life.rows.get(2)!.workspace.tasks.map((x: any) => x.title);
  assert.deepEqual(after, ["Email the reading log", "Buy a planner", "Something I added in LifeHub", "Call the school"]);
});

test("WorkHub gets them too, and nobody can send into someone else's planner", async (t) => {
  const { work, life, call } = await server(t);
  const id = (await call(2, "POST", "/api/notes", { title: "Staff meeting", saveOnly: true })).body.note.id;
  const sent = await call(2, "POST", `/api/notes/${id}/send`, { hub: "work", tasks: [{ title: "Grade the essays", due: "2026-11-18", time: "16:00" }], events: [{ title: "PD day", date: "2026-11-25", time: "" }] });
  assert.equal(sent.status, 200);
  const ws = work.rows.get(2)!.workspace;
  const task = ws.tasks.find((x: any) => x.title === "Grade the essays");
  assert.ok(task, "on the WorkHub to-do list");
  assert.equal(task.dueDate, "2026-11-18");
  assert.equal(task.done, false);

  const other = await call(3, "POST", `/api/notes/${id}/send`, { hub: "life", tasks: [{ title: "Not yours" }] });
  assert.equal(other.status, 404);
  assert.equal(life.rows.get(3), undefined, "nothing written for anyone else");
  assert.equal((await call(2, "POST", `/api/notes/${id}/send`, { hub: "life", tasks: [], events: [] })).status, 400, "something has to be checked");
});

test("the iPhone app's Reminders and Calendar times", () => {
  const local = (s: string) => new Date(s).getTime();
  assert.equal(dueMs("2026-11-20", "15:30"), local("2026-11-20T15:30:00"));
  assert.equal(dueMs("2026-11-20", ""), local("2026-11-20T09:00:00"), "a day without a time is 9 in the morning");
  assert.equal(dueMs("", "15:30"), null, "no day, no due date");
  assert.deepEqual(eventSpan("2026-12-02", "08:15"), { startDate: local("2026-12-02T08:15:00"), endDate: local("2026-12-02T09:15:00"), isAllDay: false });
  assert.deepEqual(eventSpan("2026-12-02", ""), { startDate: local("2026-12-02T00:00:00"), endDate: local("2026-12-03T00:00:00"), isAllDay: true });
  assert.equal(eventSpan("someday", "08:15"), null);
});
