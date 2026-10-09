// Saving the Teacher Hub without losing work: a second phone or computer can't save over newer
// changes, a copy is kept each day, and a full Hub says so. Run with:
//   npx tsx --test tests/teacher-hub-save.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseWorkspaceStore, registerTeacherHubRoutes } from "../server/teacherHub";
import { MAX_WORKSPACE_BYTES, blockMessage, retryDelay, sameInstant, sizeLevel, sizePercent, workspaceBytes } from "../shared/hubSave";
import { fakeSupabase } from "./helpers/fakeSupabase";

const KEYS = { teacher_hub_workspaces: ["teacher_id"], teacher_hub_backups: ["teacher_id", "day", "kind"] };

function setup(opts: { seats?: number | null; seed?: Record<string, any[]>; missingTables?: string[] } = {}) {
  const db = fakeSupabase(opts.seed || {}, { keys: KEYS, missingTables: opts.missingTables });
  const store = createSupabaseWorkspaceStore(db);
  const routes: Record<string, Function[]> = {};
  const add = (method: string) => (path: string, ...handlers: Function[]) => { routes[`${method} ${path}`] = handlers; };
  const app: any = { get: add("GET"), put: add("PUT"), post: add("POST") };
  const auth = (req: any, _res: any, next: any) => { req.user = { id: 7, role: "teacher" }; return next(); };
  registerTeacherHubRoutes(app, auth as any, { hubAccess: async () => ({ access: true, via: "hub-teacher-plan", seats: opts.seats === undefined ? null : opts.seats } as any), store });
  async function call(method: string, path: string, body: any = {}, query: any = {}) {
    const req: any = { body, query, headers: {} };
    const out: any = { status: 200, body: null };
    const res: any = { status(code: number) { out.status = code; return res; }, json(b: any) { out.body = b; return res; }, set() { return res; } };
    const chain = routes[`${method} ${path}`];
    assert.ok(chain, `no route ${method} ${path}`);
    let i = 0;
    const next = async () => { const handler = chain[i++]; if (handler) await handler(req, res, next); };
    await next();
    return out;
  }
  return { db, store, call };
}

const put = (call: any, workspace: any, extra: any = {}) => call("PUT", "/api/teacher-hub/workspace", { workspace, ...extra });
const students = (n: number) => ({ students: Array.from({ length: n }, (_, i) => ({ id: `s${i}`, name: `Student ${i}` })) });

test("the first save works, and each save after it names the copy it started from", async () => {
  const { call } = setup();
  const first = await put(call, { notes: [] }, { baseUpdatedAt: null });
  assert.equal(first.status, 200);
  assert.equal(first.body.success, true);
  assert.ok(first.body.updatedAt);
  const second = await put(call, { notes: [{ id: "n1" }] }, { baseUpdatedAt: first.body.updatedAt });
  assert.equal(second.status, 200);
  assert.notEqual(second.body.updatedAt, first.body.updatedAt, "every save gets a new time");
  const read = await call("GET", "/api/teacher-hub/workspace");
  assert.deepEqual(read.body.workspace, { notes: [{ id: "n1" }] });
  assert.equal(read.body.updatedAt, second.body.updatedAt);
});

test("a phone left open can't save over newer work from another device", async () => {
  const { call } = setup();
  const start = await put(call, { notes: [] }, { baseUpdatedAt: null });
  // The computer saves a new note.
  const computer = await put(call, { notes: [{ id: "new" }] }, { baseUpdatedAt: start.body.updatedAt });
  assert.equal(computer.status, 200);
  // The phone still thinks it is on the first copy.
  const phone = await put(call, { notes: [] }, { baseUpdatedAt: start.body.updatedAt });
  assert.equal(phone.status, 409);
  assert.equal(phone.body.code, "hub_conflict");
  assert.equal(phone.body.updatedAt, computer.body.updatedAt, "says where the newest copy is");
  const read = await call("GET", "/api/teacher-hub/workspace");
  assert.deepEqual(read.body.workspace, { notes: [{ id: "new" }] }, "the newer work is still there");
});

test("someone who chooses to keep their own version can save over it", async () => {
  const { call } = setup();
  const start = await put(call, { v: 1 }, { baseUpdatedAt: null });
  await put(call, { v: 2 }, { baseUpdatedAt: start.body.updatedAt });
  const mine = await put(call, { v: 3 }, { baseUpdatedAt: start.body.updatedAt, overwrite: true });
  assert.equal(mine.status, 200);
  assert.deepEqual((await call("GET", "/api/teacher-hub/workspace")).body.workspace, { v: 3 });
});

test("a page that thinks the Hub is empty can't wipe a Hub that has since been made", async () => {
  const { call } = setup();
  await put(call, { v: 1 }, { baseUpdatedAt: null });
  const late = await put(call, { v: 0 }, { baseUpdatedAt: null });
  assert.equal(late.status, 409);
  assert.deepEqual((await call("GET", "/api/teacher-hub/workspace")).body.workspace, { v: 1 });
});

test("a page opened before this check existed can still save", async () => {
  const { call } = setup();
  const a = await put(call, { v: 1 });
  assert.equal(a.status, 200);
  const b = await put(call, { v: 2 });
  assert.equal(b.status, 200);
});

test("two saves from the same copy at the same moment: one wins and one is told", async () => {
  const { call } = setup();
  const start = await put(call, { v: 0 }, { baseUpdatedAt: null });
  const [a, b] = await Promise.all([
    put(call, { v: "a" }, { baseUpdatedAt: start.body.updatedAt }),
    put(call, { v: "b" }, { baseUpdatedAt: start.body.updatedAt }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const loser = a.status === 409 ? a : b;
  assert.equal(loser.body.code, "hub_conflict");
});

test("a Hub that is too big is refused with a clear code", async () => {
  const { call } = setup();
  const big = { emails: [{ body: "x".repeat(MAX_WORKSPACE_BYTES + 10) }] };
  const result = await put(call, big, { baseUpdatedAt: null });
  assert.equal(result.status, 413);
  assert.equal(result.body.code, "hub_too_large");
});

test("the caseload can't grow past the plan, but a Hub that is already over can still be saved", async () => {
  const { call } = setup({ seats: 2 });
  const first = await put(call, students(3), { baseUpdatedAt: null });
  assert.equal(first.status, 409);
  assert.equal(first.body.code, "hub_seats_full");
  const ok = await put(call, students(2), { baseUpdatedAt: null });
  assert.equal(ok.status, 200);
  const grow = await put(call, students(3), { baseUpdatedAt: ok.body.updatedAt });
  assert.equal(grow.status, 409);
  assert.equal(grow.body.code, "hub_seats_full");

  // A plan made smaller later: the caseload of 5 stays, it just can't get bigger.
  const over = setup({ seats: 2, seed: { teacher_hub_workspaces: [{ teacher_id: 7, workspace: students(5), updated_at: "2026-10-01T10:00:00.000Z" }] } });
  const same = await put(over.call, students(5), { baseUpdatedAt: "2026-10-01T10:00:00.000Z" });
  assert.equal(same.status, 200);
  const smaller = await put(over.call, students(4), { baseUpdatedAt: same.body.updatedAt });
  assert.equal(smaller.status, 200);
});

test("asking whether anything changed doesn't download the whole Hub again", async () => {
  const { call } = setup();
  const saved = await put(call, { v: 1 }, { baseUpdatedAt: null });
  const same = await call("GET", "/api/teacher-hub/workspace", {}, { since: saved.body.updatedAt });
  assert.equal(same.body.unchanged, true);
  assert.equal(same.body.workspace, undefined);
  const stale = await call("GET", "/api/teacher-hub/workspace", {}, { since: "2020-01-01T00:00:00.000Z" });
  assert.deepEqual(stale.body.workspace, { v: 1 });
});

test("a copy of the Hub is kept before the first change of each day, once", async () => {
  const { call, db } = setup();
  const a = await put(call, { v: 1 }, { baseUpdatedAt: null });
  assert.equal((db.tables.teacher_hub_backups || []).length, 0, "nothing to keep before there is a first copy");
  const b = await put(call, { v: 2 }, { baseUpdatedAt: a.body.updatedAt });
  await put(call, { v: 3 }, { baseUpdatedAt: b.body.updatedAt });
  const kept = db.tables.teacher_hub_backups;
  assert.equal(kept.length, 1);
  assert.deepEqual(kept[0].workspace, { v: 1 }, "the Hub as it was before the day's changes");
  assert.equal(kept[0].kind, "daily");
});

test("a Hub still saves when the copies table has not been made yet", async () => {
  const { call } = setup({ missingTables: ["teacher_hub_backups"] });
  const a = await put(call, { v: 1 }, { baseUpdatedAt: null });
  const b = await put(call, { v: 2 }, { baseUpdatedAt: a.body.updatedAt });
  assert.equal(b.status, 200);
  const list = await call("GET", "/api/teacher-hub/backups");
  assert.deepEqual(list.body, { available: false, backups: [] });
});

test("an earlier copy can be brought back, and what was there is kept too", async () => {
  const day = "2026-10-01";
  const { call, db } = setup({
    seed: {
      teacher_hub_workspaces: [{ teacher_id: 7, workspace: { v: "now" }, updated_at: "2026-10-05T10:00:00.000Z" }],
      teacher_hub_backups: [{ teacher_id: 7, day, kind: "daily", workspace: { v: "old" }, students: 0, saved_at: "2026-10-01T09:00:00.000Z" }],
    },
  });
  const list = await call("GET", "/api/teacher-hub/backups");
  assert.equal(list.body.available, true);
  assert.deepEqual(list.body.backups.map((b: any) => b.day), [day]);
  const back = await call("POST", "/api/teacher-hub/backups/restore", { day, kind: "daily" });
  assert.equal(back.status, 200);
  assert.deepEqual(back.body.workspace, { v: "old" });
  assert.deepEqual((await call("GET", "/api/teacher-hub/workspace")).body.workspace, { v: "old" });
  const undo = db.tables.teacher_hub_backups.find((b: any) => b.kind === "restore")!;
  assert.deepEqual(undo.workspace, { v: "now" });
  const missing = await call("POST", "/api/teacher-hub/backups/restore", { day: "2026-09-01", kind: "daily" });
  assert.equal(missing.status, 404);
  const bad = await call("POST", "/api/teacher-hub/backups/restore", { day: "yesterday" });
  assert.equal(bad.status, 400);
});

test("copies older than two weeks are cleared out when a new one is kept", async () => {
  const store = createSupabaseWorkspaceStore(fakeSupabase({
    teacher_hub_backups: [
      { teacher_id: 7, day: "2026-09-01", kind: "daily", workspace: {}, students: 0, saved_at: "x" },
      { teacher_id: 7, day: "2026-09-25", kind: "daily", workspace: {}, students: 0, saved_at: "x" },
    ],
  }, { keys: KEYS }));
  await store.backup(7, "daily", "2026-10-05", { v: 1 }, 0);
  const days = (await store.backups(7))!.map((b) => b.day);
  assert.deepEqual(days, ["2026-10-05", "2026-09-25"]);
});

test("the size rules: warn from 70%, high from 90%, full at the limit", () => {
  assert.equal(sizeLevel(MAX_WORKSPACE_BYTES * 0.5), "ok");
  assert.equal(sizeLevel(MAX_WORKSPACE_BYTES * 0.7), "warn");
  assert.equal(sizeLevel(MAX_WORKSPACE_BYTES * 0.9), "high");
  assert.equal(sizeLevel(MAX_WORKSPACE_BYTES), "full");
  assert.equal(sizePercent(MAX_WORKSPACE_BYTES * 0.723), 72);
  assert.equal(sizePercent(MAX_WORKSPACE_BYTES * 3), 100);
  assert.equal(workspaceBytes({ a: "é" }), new TextEncoder().encode('{"a":"é"}').length);
});

test("times that name the same moment match, however they are written", () => {
  assert.equal(sameInstant("2026-10-07T12:00:00.123Z", "2026-10-07T12:00:00.123+00:00"), true);
  assert.equal(sameInstant("2026-10-07T12:00:00.123Z", "2026-10-07T12:00:00.124Z"), false);
  assert.equal(sameInstant(null, "2026-10-07T12:00:00Z"), false);
  assert.equal(sameInstant("nonsense", "nonsense"), false);
});

test("a failed save is tried again after 2, 5, 15 and then every 30 seconds", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(retryDelay), [2000, 5000, 15000, 30000, 30000, 30000]);
});

test("every reason a save can stop has plain words", () => {
  for (const block of ["conflict", "too_large", "seats_full", "plan", "signed_out", "rejected"] as const) assert.ok(blockMessage(block).length > 20, block);
  assert.match(blockMessage("seats_full", "Your plan covers 100 students."), /100 students/);
});

test("A.R.I.S.E. To-Do reads the teacher's own Hub calendar: repeats worked out, hidden and other people's events left out", async () => {
  const { call } = setup();
  await put(call, {
    events: [
      { id: "e1", title: "IEP meeting", date: "2026-10-14", start: "15:30", end: "16:30", location: "Room 4", notes: "private notes" },
      { id: "e2", title: "Duty", date: "2026-10-05", start: "07:30", end: "", location: "", notes: "", repeat: "Weekly" },
      { id: "e3", title: "Staff lunch", date: "2026-10-16", start: "12:00", end: "", location: "", notes: "" },
      { id: "e4", title: "Busy", date: "2026-10-15", start: "09:00", end: "10:00", location: "", notes: "", calendarId: "c-other" },
      { id: "e5", title: "Old", date: "2026-08-01", start: "", end: "", location: "", notes: "" },
    ],
    calendars: [{ id: "c-other", name: "Ms. Lee", url: "https://x", syncedAt: "", owner: "Ms. Lee" }],
    hiddenEvents: [{ id: "h1", title: "Staff lunch", date: "", start: "" }],
  }, { baseUpdatedAt: null });
  const r = await call("GET", "/api/teacher-hub/calendar", {}, { from: "2026-10-01", to: "2026-10-31" });
  assert.equal(r.status, 200);
  const got = r.body.events.map((e: any) => `${e.date} ${e.title}`).sort();
  assert.deepEqual(got, ["2026-10-05 Duty", "2026-10-12 Duty", "2026-10-14 IEP meeting", "2026-10-19 Duty", "2026-10-26 Duty"]);
  const iep = r.body.events.find((e: any) => e.title === "IEP meeting");
  assert.deepEqual(iep, { id: "e1", title: "IEP meeting", date: "2026-10-14", start: "15:30", end: "16:30", location: "Room 4", done: false }, "notes stay in the Hub");
  assert.equal((await call("GET", "/api/teacher-hub/calendar", {}, { from: "2026-01-01", to: "2026-12-31" })).status, 400, "at most 100 days");
  assert.equal((await call("GET", "/api/teacher-hub/calendar", {}, { from: "nope", to: "2026-10-31" })).status, 400);
});
