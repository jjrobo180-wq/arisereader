// No-proctor (camera) quizzes: starting, the live log, pictures, turning in, flags, review and points.
// Run: npx tsx --test tests/quiz-integrity.test.ts
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerQuizIntegrityRoutes, computeFlags, NO_PROCTOR } from "../server/quizIntegrity";

// In-memory stand-in for the Supabase client: just the calls the no-proctor routes make.
type Row = Record<string, any>;
const tables: Record<string, Row[]> = {};
const bucketFiles = new Map<string, Buffer>();
let clock = Date.now();
let nextId = 1;
const nextIso = () => new Date(++clock).toISOString();

class Query implements PromiseLike<{ data: any; error: any; count?: number }> {
  private filters: ((r: Row) => boolean)[] = [];
  private op: "select" | "insert" | "update" = "select";
  private payload: any;
  private mode: "many" | "single" | "maybe" = "many";
  private orderBy: { col: string; asc: boolean } | null = null;
  private lim = Infinity;
  private returning = false;
  private counting = false;
  constructor(private table: string) {}
  select(_cols?: string, opts?: { count?: string; head?: boolean }) { if (this.op !== "select") this.returning = true; if (opts?.count) this.counting = true; return this; }
  insert(row: any) { this.op = "insert"; this.payload = row; return this; }
  update(patch: any) { this.op = "update"; this.payload = patch; return this; }
  eq(col: string, val: any) { this.filters.push((r) => r[col] === val); return this; }
  in(col: string, vals: any[]) { this.filters.push((r) => vals.includes(r[col])); return this; }
  is(col: string, val: null) { this.filters.push((r) => (r[col] ?? null) === val); return this; }
  lt(col: string, val: any) { this.filters.push((r) => String(r[col]) < String(val)); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orderBy = { col, asc: opts?.ascending !== false }; return this; }
  limit(n: number) { this.lim = n; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }
  private run() {
    const rows = tables[this.table] || (tables[this.table] = []);
    const clone = (x: any) => JSON.parse(JSON.stringify(x));
    if (this.op === "insert") {
      const out = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r: Row) => {
        const base: Row = this.table === "quiz_integrity_sessions"
          ? { id: crypto.randomUUID(), created_at: nextIso(), status: "active", restarts: 0, leaves: 0, away_ms: 0, copy_attempts: 0, camera_off: 0, snapshot_count: 0, auto_submitted: false, flag: "clear", flag_reasons: [], voided: false, snapshots_purged: false, points_awarded: 0 }
          : { id: nextId++, at: nextIso() };
        const row = { ...base, ...clone(r) };
        rows.push(row);
        return row;
      });
      return this.shape(out.map(clone));
    }
    let hits = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === "update") {
      for (const r of hits) Object.assign(r, clone(this.payload));
      return this.returning || this.mode !== "many" ? this.shape(hits.map(clone)) : { data: null, error: null };
    }
    if (this.orderBy) { const { col, asc } = this.orderBy; hits = hits.slice().sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1)); }
    return this.shape(hits.slice(0, this.lim).map(clone));
  }
  private shape(list: Row[]): any {
    if (this.counting) return { data: null, count: list.length, error: null };
    if (this.mode === "single") return list.length === 1 ? { data: list[0], error: null } : { data: null, error: { message: "not single" } };
    if (this.mode === "maybe") return { data: list[0] ?? null, error: null };
    return { data: list, error: null };
  }
  then<A, B>(ok?: ((v: any) => A | PromiseLike<A>) | null, bad?: ((e: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.run()).then(ok, bad);
  }
}
const fakeDb = {
  from: (table: string) => new Query(table),
  storage: {
    from: (bucket: string) => ({
      upload: async (path: string, buf: Buffer) => {
        if (bucketFiles.has(bucket + "/" + path)) return { data: null, error: { message: "exists" } };
        bucketFiles.set(bucket + "/" + path, buf);
        return { data: { path }, error: null };
      },
      remove: async (paths: string[]) => { paths.forEach((p) => bucketFiles.delete(bucket + "/" + p)); return { data: paths, error: null }; },
      createSignedUrls: async (paths: string[], ttl: number) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://signed.test/${bucket}/${p}?ttl=${ttl}`, error: null })), error: null }),
    }),
  },
};
function reset() { for (const k of Object.keys(tables)) delete tables[k]; bucketFiles.clear(); nextId = 1; }

type Handler = (req: any, res: any) => Promise<void> | void;
const routes = new Map<string, Handler>();
const app: any = {
  get: (path: string, ...hs: any[]) => routes.set("GET " + path, hs[hs.length - 1]),
  post: (path: string, ...hs: any[]) => routes.set("POST " + path, hs[hs.length - 1]),
};

// Roster: teacher 10 has students 1 and 2; parent 20 is linked to student 1; student 3 belongs to nobody here.
const users: Record<number, any> = {
  1: { id: 1, role: "student", username: "ana", displayName: "Ana" },
  2: { id: 2, role: "student", username: "ben", displayName: "Ben" },
  3: { id: 3, role: "student", username: "cy", displayName: "Cy" },
  4: { id: 4, role: "student", username: "sample7", displayName: "Sample" },
  10: { id: 10, role: "teacher", username: "msg", displayName: "Ms. G" },
  20: { id: 20, role: "parent", username: "mom", displayName: "Mom" },
  99: { id: 99, role: "admin", isAdmin: true, username: "boss", displayName: "Admin" },
};
const attempts = new Set<string>();
const pointCalls: [number, number][] = [];
const integrity = registerQuizIntegrityRoutes(app, (() => {}) as any, {
  db: () => fakeDb,
  isDemoStudent: (u: any) => String(u?.username || "").startsWith("sample"),
  hasAttempt: async (userId, _k, quizId) => attempts.has(`${userId}:${quizId}`),
  getTeacherStudentIds: async (teacherId) => (teacherId === 10 ? [1, 2] : []),
  getParentStudentIds: async (parentId) => (parentId === 20 ? [1] : []),
  setAttemptPoints: async (attemptId, points) => { pointCalls.push([attemptId, points]); return { before: 0, after: points }; },
});

async function call(method: "GET" | "POST", path: string, userId: number | null, body: any = {}, query: any = {}, extra: any = {}) {
  const pathOnly = path.split("?")[0];
  const entry = [...routes.entries()].find(([key]) => {
    const [m, p] = key.split(" ");
    return m === method && new RegExp("^" + p.replace(/:[a-z]+/g, "([^/]+)") + "$").test(pathOnly);
  });
  if (!entry) throw new Error("no route " + method + " " + path);
  const p = entry[0].split(" ")[1];
  const names = (p.match(/:[a-z]+/g) || []).map((x) => x.slice(1));
  const values = pathOnly.match(new RegExp("^" + p.replace(/:[a-z]+/g, "([^/]+)") + "$"))!.slice(1);
  let status = 200, json: any;
  const res = { status(c: number) { status = c; return res; }, json(b: any) { json = b; return res; }, set() { return res; } };
  await entry[1]({ user: userId ? users[userId] : undefined, body, query, headers: { "user-agent": "test" }, params: Object.fromEntries(names.map((n, i) => [n, values[i]])), ...extra }, res);
  return { status, data: json };
}

const jpeg = (size = 2000) => { const b = Buffer.alloc(size, 7); b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; return b; };
const session = (token: string) => tables.quiz_integrity_sessions.find((s) => s.token === token)!;
const events = () => tables.quiz_integrity_events || [];

beforeEach(() => {
  reset();
  attempts.clear();
  pointCalls.length = 0;
  tables.users = Object.values(users).map((u) => ({ id: u.id, display_name: u.displayName, username: u.username }));
  tables.books = [{ id: 5, title: "Esperanza Rising" }, { id: 6, title: "Holes" }];
});

async function start(studentId = 1, quizId = 5) {
  const r = await call("POST", "/api/integrity/start", studentId, { quizKind: "book", quizId });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
}

/** What the quiz route does when the student turns the quiz in. */
async function submit(token: string, studentId: number, quizId: number, extra: any = {}) {
  const s = await integrity.checkForSubmit(token, studentId, "book", quizId);
  assert.ok(s, "session usable for submit");
  return integrity.finishAfterSubmit(s!, { attemptId: 700 + quizId, score: 8, total: 10, points: 6, questionCount: 10, ...extra });
}

test("only students can start, and not for a quiz they already took", async () => {
  assert.equal((await call("POST", "/api/integrity/start", 10, { quizId: 5 })).status, 403);
  assert.equal((await call("POST", "/api/integrity/start", 99, { quizId: 5 })).status, 403);
  const sample = await call("POST", "/api/integrity/start", 4, { quizId: 5 });
  assert.equal(sample.status, 200);
  assert.equal(sample.data.preview, true, "sample accounts see the flow without recording");
  assert.equal(sample.data.token, "preview");
  const preview = await call("POST", "/api/integrity/start", 99, { quizId: 5 }, {}, { adminPreview: "regular", user: { ...users[99], isAdmin: false, role: "student", username: "admin-preview" } });
  assert.equal(preview.data.token, "preview", "admin preview sees the flow without recording");
  assert.equal((tables.quiz_integrity_sessions || []).length, 0, "previews store nothing");
  assert.equal((await call("POST", "/api/integrity/start", 1, { quizId: 0 })).status, 400);
  attempts.add("1:5");
  assert.equal((await call("POST", "/api/integrity/start", 1, { quizId: 5 })).status, 409);
  const s = await start(1, 6);
  assert.match(s.token, /^[0-9a-f]{48}$/);
  assert.equal(s.snapshotEveryMs, 30_000);
  assert.equal(s.leavesBeforeTurnIn, 2);
  assert.equal(events().filter((e) => e.type === "start").length, 1);
});

test("events arrive as JSON or as a closing-page beacon, and unknown ones are ignored", async () => {
  const s = await start();
  let r = await call("POST", `/api/integrity/live/${s.token}/events`, null, { events: [{ type: "left", kind: "hidden", t: 1200 }, { type: "hack", t: 1 }] });
  assert.equal(r.status, 200);
  r = await call("POST", `/api/integrity/live/${s.token}/events`, null, JSON.stringify({ events: [{ type: "returned", ms: 4200 }] }));
  assert.equal(r.status, 200);
  const types = events().map((e) => e.type);
  assert.deepEqual(types, ["start", "left", "returned"]);
  await call("POST", `/api/integrity/live/${s.token}/events`, null, { events: [{ type: "stopped" }] });
  assert.equal(events().at(-1)!.type, "stopped");
  const status = await call("GET", `/api/integrity/live/${s.token}`, 1);
  assert.equal(status.data.status, "active");
  assert.ok(Math.abs(Date.parse(status.data.serverNow) - Date.now()) < 5000, "server time for lining up clocks");
  assert.equal(status.data.leaves, 1);
  assert.equal((await call("GET", `/api/integrity/live/${s.token}`, 2)).status, 404, "another student cannot read it");
  assert.equal((await call("POST", "/api/integrity/live/not-a-token/events", null, { events: [] })).status, 410);
});

test("snapshots must be JPEGs, are rate limited, and land in the private bucket", async () => {
  const s = await start();
  assert.equal((await call("POST", `/api/integrity/live/${s.token}/snapshot`, null, Buffer.from("hello world".repeat(20)), { reason: "interval" })).status, 400);
  assert.equal((await call("POST", `/api/integrity/live/${s.token}/snapshot`, null, jpeg(NO_PROCTOR.maxSnapshotBytes + 1))).status, 400);
  const ok = await call("POST", `/api/integrity/live/${s.token}/snapshot`, null, jpeg(), { reason: "start" });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  const again = await call("POST", `/api/integrity/live/${s.token}/snapshot`, null, jpeg(), { reason: "interval" });
  assert.equal(again.status, 429, "too soon after the last one");
  const keys = [...bucketFiles.keys()];
  assert.equal(keys.length, 1);
  assert.match(keys[0], new RegExp(`^quiz-integrity/${session(s.token).id}/\\d+-start\\.jpg$`));
});

test("a picture taken as the quiz is turned in still arrives; later ones and late events don't", async () => {
  const s = await start();
  await submit(s.token, 1, 5);
  const late = await call("POST", `/api/integrity/live/${s.token}/snapshot`, null, jpeg(), { reason: "end" });
  assert.equal(late.status, 200, JSON.stringify(late.data));
  assert.equal((await call("POST", `/api/integrity/live/${s.token}/events`, null, { events: [{ type: "returned", ms: 10 }] })).status, 410);
  session(s.token).submitted_at = new Date(Date.now() - NO_PROCTOR.lateSnapshotMs - 1000).toISOString();
  session(s.token).last_snapshot_at = null;
  assert.equal((await call("POST", `/api/integrity/live/${s.token}/snapshot`, null, jpeg(), { reason: "interval" })).status, 410);
  const expired = await start(2, 6);
  session(expired.token).status = "expired";
  assert.equal((await call("POST", `/api/integrity/live/${expired.token}/snapshot`, null, jpeg(), { reason: "interval" })).status, 410);
});

test("turning in sets the flag from what happened", async () => {
  const clean = await start(1, 5);
  for (let i = 0; i < 3; i++) events().push({ id: 1000 + i, session_id: session(clean.token).id, at: new Date().toISOString(), type: "snapshot", detail: { path: `x/${i}.jpg`, reason: "interval" } });
  // Pretend the quiz took two minutes.
  session(clean.token).created_at = new Date(Date.now() - 120_000).toISOString();
  let done = await submit(clean.token, 1, 5, { answerTimes: { "11": { first: 9000, changes: 1 }, bad: { first: 1 } } });
  assert.equal(done.flag, "clear", JSON.stringify(done.reasons));
  const row = session(clean.token);
  assert.equal(row.status, "submitted");
  assert.equal(row.attempt_id, 705);
  assert.equal(row.points_awarded, 6);
  assert.deepEqual(row.answer_times, { "11": { first: 9000, changes: 1 } });
  assert.equal(await integrity.checkForSubmit(clean.token, 1, "book", 5), null, "a session is used once");

  const auto = await start(2, 5);
  session(auto.token).created_at = new Date(Date.now() - 200_000).toISOString();
  await call("POST", `/api/integrity/live/${auto.token}/events`, null, { events: [{ type: "left", kind: "hidden" }, { type: "returned", ms: 9000 }, { type: "copy" }] });
  done = await submit(auto.token, 2, 5, { autoSubmitted: true, events: [{ type: "left", kind: "hidden" }] });
  assert.equal(done.flag, "high");
  assert.equal(done.autoSubmitted, true);
  const texts = done.reasons.map((r: any) => r.text).join(" | ");
  assert.match(texts, /Turned in automatically/);
  assert.match(texts, /copy or paste once/);
  assert.match(texts, /Fewer camera pictures/);
  assert.equal(session(auto.token).leaves, 2);
  assert.equal(await integrity.checkForSubmit(auto.token, 1, "book", 5), null, "wrong student");
});

test("the same try can't be turned in twice at once, and a failed grading can try again", async () => {
  const s = await start();
  const [a, b] = await Promise.all([integrity.checkForSubmit(s.token, 1, "book", 5), integrity.checkForSubmit(s.token, 1, "book", 5)]);
  assert.equal([a, b].filter(Boolean).length, 1, "only one turn-in claims the try");
  await integrity.release((a || b)!);
  const again = await integrity.checkForSubmit(s.token, 1, "book", 5);
  assert.ok(again, "released after a failed grading");
  await integrity.finishAfterSubmit(again!, { attemptId: 1, score: 1, total: 10, points: 0, questionCount: 10 });
  assert.equal(session(s.token).status, "submitted");
});

test("starting again without finishing is remembered and flagged", async () => {
  const first = await start(1, 6);
  const second = await start(1, 6);
  assert.equal(second.restarts, 1);
  assert.equal(session(first.token).status, "expired");
  assert.equal(await integrity.checkForSubmit(first.token, 1, "book", 6), null);
  session(second.token).created_at = new Date(Date.now() - 60_000).toISOString();
  const done = await submit(second.token, 1, 6);
  assert.equal(done.flag, "review");
  assert.match(done.reasons.map((r: any) => r.text).join(), /Started this quiz once before/);
});

test("reviewers only see their own students; parents can look but not change points", async () => {
  const a = await start(1, 5); await submit(a.token, 1, 5);
  const b = await start(2, 5); await submit(b.token, 2, 5);
  const c = await start(3, 5); await submit(c.token, 3, 5);
  const admin = await call("GET", "/api/integrity/review", 99);
  assert.equal(admin.data.sessions.length, 3);
  assert.equal(admin.data.canVoid, true);
  const teacher = await call("GET", "/api/integrity/review", 10);
  assert.deepEqual(teacher.data.sessions.map((s: any) => s.studentName).sort(), ["Ana", "Ben"]);
  assert.equal(teacher.data.sessions[0].quizTitle, "Esperanza Rising");
  const parent = await call("GET", "/api/integrity/review", 20);
  assert.deepEqual(parent.data.sessions.map((s: any) => s.studentName), ["Ana"]);
  assert.equal(parent.data.canVoid, false);
  assert.equal((await call("GET", "/api/integrity/review", 20, {}, { studentId: "2" })).status, 403);
  assert.equal((await call("GET", "/api/integrity/review", 1)).status, 403, "students cannot review");
  const cId = session(c.token).id;
  assert.equal((await call("GET", `/api/integrity/review/${cId}`, 10)).status, 404, "not the teacher's student");
  assert.equal((await call("POST", `/api/integrity/review/${session(a.token).id}/void`, 20, { reason: "x" })).status, 403);
});

test("the detail shows the timeline, signed pictures and earlier unfinished tries", async () => {
  const earlier = await start(1, 5);
  await call("POST", `/api/integrity/live/${earlier.token}/snapshot`, null, jpeg(), { reason: "start" });
  await call("POST", `/api/integrity/live/${earlier.token}/events`, null, { events: [{ type: "left", kind: "closed" }] });
  const now = await start(1, 5);
  await call("POST", `/api/integrity/live/${now.token}/snapshot`, null, jpeg(), { reason: "start" });
  await call("POST", `/api/integrity/live/${now.token}/events`, null, { events: [{ type: "left", kind: "window" }, { type: "returned", ms: 3000 }, { type: "warned" }] });
  await submit(now.token, 1, 5);
  const r = await call("GET", `/api/integrity/review/${session(now.token).id}`, 20);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.canVoid, false);
  assert.deepEqual(r.data.timeline.map((e: any) => e.type), ["start", "left", "returned", "warned", "submitted"]);
  assert.equal(r.data.snapshots.length, 1);
  assert.match(r.data.snapshots[0].url, /^https:\/\/signed\.test\/quiz-integrity\//);
  assert.equal(r.data.earlierTries.length, 1);
  assert.equal(r.data.earlierTries[0].leaves, 1);
  assert.equal(r.data.earlierTries[0].snapshots.length, 1);
  assert.equal(r.data.session.flag, "review");
});

test("teachers and the admin can remove points and give them back", async () => {
  const a = await start(1, 5); await submit(a.token, 1, 5);
  const id = session(a.token).id;
  let r = await call("POST", `/api/integrity/review/${id}/void`, 10, { reason: "Looked at a phone" });
  assert.equal(r.status, 200);
  assert.deepEqual(pointCalls, [[705, 0]]);
  assert.equal(session(a.token).voided, true);
  assert.equal(session(a.token).void_reason, "Looked at a phone");
  r = await call("POST", `/api/integrity/review/${id}/void`, 99, {});
  assert.deepEqual(pointCalls, [[705, 0]], "voiding twice changes nothing");
  r = await call("POST", `/api/integrity/review/${id}/restore`, 99);
  assert.equal(r.status, 200);
  assert.deepEqual(pointCalls, [[705, 0], [705, 6]]);
  assert.equal(session(a.token).voided, false);
});

test("pictures are deleted after 30 days and stale tries expire", async () => {
  const old = await start(1, 5);
  await call("POST", `/api/integrity/live/${old.token}/snapshot`, null, jpeg(), { reason: "start" });
  await submit(old.token, 1, 5);
  session(old.token).created_at = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString();
  const stale = await start(2, 6);
  session(stale.token).expires_at = new Date(Date.now() - 1000).toISOString();
  const fresh = await start(3, 6);
  await call("POST", `/api/integrity/live/${fresh.token}/snapshot`, null, jpeg(), { reason: "start" });
  assert.equal(bucketFiles.size, 2);
  await integrity.purgeOld();
  assert.equal(bucketFiles.size, 1, "only the old session's picture is gone");
  assert.equal(session(old.token).snapshots_purged, true);
  assert.equal(session(stale.token).status, "expired");
  assert.equal(session(fresh.token).status, "active");
});

test("flag rules", () => {
  const base = { leaves: 0, awayMs: 0, autoSubmitted: false, copyAttempts: 0, cameraOff: 0, snapshotCount: 5, durationMs: 120_000, questionCount: 10, restarts: 0 };
  assert.equal(computeFlags(base).flag, "clear");
  assert.equal(computeFlags({ ...base, leaves: 1, awayMs: 5000 }).flag, "review");
  assert.equal(computeFlags({ ...base, leaves: 2 }).flag, "high");
  assert.equal(computeFlags({ ...base, durationMs: 20_000, snapshotCount: 1 }).reasons[0].text, "Finished very fast (20 s for 10 questions)");
  assert.equal(computeFlags({ ...base, restarts: 2 }).flag, "high");
  assert.equal(computeFlags({ ...base, cameraOff: 1 }).flag, "review");
});
