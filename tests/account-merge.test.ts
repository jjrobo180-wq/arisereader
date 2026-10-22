// Merging a student's two accounts (server/accountMerge.ts), run against an in-memory database
// that enforces the same one-per-student rules the real tables have.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { USER_LINKS, findDuplicates, mergeStudentAccounts, nameKey, registerAccountMergeRoutes, type Candidate, type MergeDb, type MergeUser } from "../server/accountMerge";

const UNIQUE: Record<string, string[][]> = {
  attempts: [["user_id", "book_id"]], reading_profiles: [["user_id"]], social_profiles: [["user_id"]],
  student_class_teachers: [["student_id", "school_year"]], book_feed_saves: [["user_id", "book_id"]],
};

function memory(users: MergeUser[], tables: Record<string, Record<string, any>[]>, settings: Record<string, string> = {}) {
  const U = new Map(users.map((u) => [u.id, { ...u }]));
  const T: Record<string, Record<string, any>[]> = JSON.parse(JSON.stringify(tables));
  const S = { ...settings };
  const signedOut: number[] = [], logs: any[] = [];
  const matches = (row: any, m: Record<string, unknown>) => Object.entries(m).every(([k, v]) => row[k] === v);
  const clash = (table: string, row: any, others: any[]) => (UNIQUE[table] || []).some((cols) => others.some((o) => o !== row && cols.every((c) => o[c] === row[c])));
  const db: MergeDb = {
    async user(id) { return U.get(id) ? { ...U.get(id)! } : null; },
    async moveAll(table, col, from, to) {
      const rows = (T[table] ||= []);
      const moving = rows.filter((r) => r[col] === from);
      const after = rows.map((r) => (moving.includes(r) ? { ...r, [col]: to } : r));
      if (after.some((r) => clash(table, r, after))) return "conflict";
      moving.forEach((r) => { r[col] = to; });
      return { count: moving.length };
    },
    async rows(table, cols, m) { return (T[table] || []).filter((r) => matches(r, m)).map((r) => Object.fromEntries(cols.map((c) => [c, r[c]]))); },
    async moveOne(table, col, to, m) {
      const rows = T[table] || [];
      const row = rows.find((r) => matches(r, m));
      if (!row) return "ok";
      if (clash(table, { ...row, [col]: to }, rows.filter((r) => r !== row))) return "conflict";
      row[col] = to;
      return "ok";
    },
    async deleteRows(table, m) { T[table] = (T[table] || []).filter((r) => !matches(r, m)); },
    async updateUser(id, patch) {
      const u: any = U.get(id)!;
      for (const [k, v] of Object.entries(patch)) {
        const key = ({ total_points: "totalPoints", student_number: "studentNumber", school_id: "schoolId", class_id: "classId", teacher_id: "teacherId", approved_by_teacher: "approved", must_change_password: "mustChange", archived_at: "archived" } as any)[k] || k;
        if (k === "username" && [...U.values()].some((o) => o.id !== id && o.username === v)) throw new Error("users: duplicate username");
        if (k === "student_number" && v && [...U.values()].some((o) => o.id !== id && o.studentNumber === v)) throw new Error("users: duplicate student number");
        u[key] = k === "archived_at" ? !!v : v;
      }
    },
    async signOut(id) { signedOut.push(id); },
    async getSetting(k) { return S[k] || ""; },
    async setSetting(k, v) { S[k] = v; },
    async log(row) { logs.push(row); },
  };
  return { db, U, T, S, signedOut, logs };
}

const student = (id: number, username: string, extra: Partial<MergeUser> = {}): MergeUser => ({
  id, username, role: "student", isAdmin: false, archived: false, displayName: "Jaylen Williams", email: null, schoolId: 10, classId: null, teacherId: null,
  studentNumber: null, approved: true, totalPoints: 0, password: `hash-${username}`, mustChange: false, createdAt: "2026-09-01", ...extra,
});

test("a merge moves everything to the kept account, keeps the better quiz, adds points and archives the extra account", async () => {
  const keep = student(1, "970819", { teacherId: 5, studentNumber: "970819", totalPoints: 30, mustChange: true });
  const dup = student(2, "jaylen.w", { createdAt: "2026-10-01", totalPoints: 50, email: "jw@example.com" });
  const m = memory([keep, dup], {
    attempts: [
      { id: 1, user_id: 1, book_id: 7, points_earned: 10, score: 6, total: 10 },
      { id: 2, user_id: 1, book_id: 8, points_earned: 20, score: 9, total: 10 },
      { id: 3, user_id: 2, book_id: 7, points_earned: 15, score: 9, total: 10 }, // better than the kept account's book 7
      { id: 4, user_id: 2, book_id: 8, points_earned: 5, score: 5, total: 10 },  // worse: stays behind
      { id: 5, user_id: 2, book_id: 9, points_earned: 30, score: 10, total: 10 },
    ],
    reading_profiles: [{ user_id: 1, level: "M" }, { user_id: 2, level: "J" }],
    messages: [{ id: 1, user_id: 2, text: "hi" }],
    student_class_teachers: [{ student_id: 2, school_year: "2026-27", advisory: "Chase & Shuster" }],
  }, { parent_student_links: JSON.stringify({ 77: [2], 78: 1 }), student_rewards_2: JSON.stringify([{ id: 1, title: "Free time" }]) });

  const r = await mergeStudentAccounts(m.db, 1, 2, 99, "keep");
  const attempts = m.T.attempts.filter((a) => a.user_id === 1).map((a) => a.id).sort();
  assert.deepEqual(attempts, [2, 3, 5], "book 7: the better attempt; book 8: the kept account's own; book 9: moved");
  assert.equal(m.T.attempts.find((a) => a.id === 4).user_id, 2, "the weaker duplicate attempt stays on the archived account");
  // 30 + 50 - 5 (left behind) - 10 (replaced) = 65
  assert.equal(m.U.get(1)!.totalPoints, 65);
  assert.equal(r.points, 35);
  assert.equal(m.T.reading_profiles.find((p) => p.user_id === 1).level, "M", "the kept account's own reading profile wins");
  assert.equal(m.T.messages[0].user_id, 1);
  assert.equal(m.T.student_class_teachers[0].student_id, 1, "the advisory pick comes across");
  assert.equal(m.U.get(1)!.email, "jw@example.com", "missing details are filled in");
  assert.equal(m.U.get(1)!.username, "970819");
  assert.equal(m.U.get(1)!.mustChange, true, "the student still sets a new password on the teacher-made sign-in");
  assert.equal(m.U.get(2)!.archived, true);
  assert.equal(m.U.get(2)!.username, "jaylen.w.merged2");
  assert.equal(m.U.get(2)!.totalPoints, 0);
  assert.deepEqual(m.signedOut, [2]);
  assert.deepEqual(JSON.parse(m.S.parent_student_links), { 77: [1], 78: 1 }, "the parent now follows the kept account");
  assert.deepEqual(JSON.parse(m.S.student_rewards_1), [{ id: 1, title: "Free time" }]);
  assert.equal(m.logs.length, 1);
  await assert.rejects(mergeStudentAccounts(m.db, 1, 2, 99), /already merged/);
});

test("the student can keep the sign-in they made themselves", async () => {
  const m = memory([student(1, "970819", { studentNumber: "970819", mustChange: true }), student(2, "jaylen.w")], {});
  const r = await mergeStudentAccounts(m.db, 1, 2, 99, "dup");
  assert.equal(r.username, "jaylen.w");
  assert.equal(m.U.get(1)!.username, "jaylen.w");
  assert.equal(m.U.get(1)!.password, "hash-jaylen.w");
  assert.equal(m.U.get(1)!.mustChange, false);
  assert.equal(m.U.get(1)!.studentNumber, "970819", "the student number stays on the kept account");
});

test("only two different, active student accounts can be merged", async () => {
  const m = memory([student(1, "a"), student(2, "b", { role: "teacher" }), student(3, "c", { archived: true })], {});
  await assert.rejects(mergeStudentAccounts(m.db, 1, 1, 9), /two different/);
  await assert.rejects(mergeStudentAccounts(m.db, 1, 2, 9), /Only student accounts/);
  await assert.rejects(mergeStudentAccounts(m.db, 3, 1, 9), /archived/);
  await assert.rejects(mergeStudentAccounts(m.db, 1, 404, 9), /no longer exists/);
});

const c = (id: number, name: string, extra: Partial<Candidate> = {}): Candidate => ({ id, name, username: `u${id}`, createdAt: `2026-09-${String(id).padStart(2, "0")}`, points: 0, teacherId: null, teacherName: null, schoolId: 10, approved: true, mine: false, ...extra });

test("duplicates are found by full name or student number, keeping the teacher's own (older) account", () => {
  assert.equal(nameKey("  Jaylen  Marcus O'Neil-Smith "), "jaylen oneilsmith");
  assert.equal(nameKey("José Pérez"), "jose perez");
  const pairs = findDuplicates([
    c(1, "Jaylen Williams", { mine: true, teacherId: 5 }),
    c(2, "jaylen   williams"),
    c(3, "Ana Lopez", { mine: true, username: "970819" }),
    c(4, "Ana L", { username: "970819" }),
    c(5, "Sam Ortiz"), c(6, "Sam Ortiz"), // neither is this teacher's: not shown
    c(7, "Jaylen Williams", { schoolId: null }), // signed up with no school yet
  ]);
  const ids = pairs.map((p) => `${p.keep.id}>${p.dup.id}`).sort();
  assert.deepEqual(ids, ["1>2", "1>7", "3>4"]);
  assert.equal(pairs.find((p) => p.dup.id === 4)!.reason, "Same student number");
  // An admin sees every account as theirs: the student-number account stays even when it's newer.
  const admin = findDuplicates([c(1, "Adrian Stubbs", { mine: true, username: "adrianstubbs" }), c(9, "Adrian Stubbs", { mine: true, username: "92817", createdAt: "2026-10-19" })]);
  assert.deepEqual(admin.map((p) => `${p.keep.id}>${p.dup.id}`), ["9>1"]);
});

test("the merge route: the kept account must be the teacher's; the other must be theirs or an unlisted signup", async () => {
  const m = memory([student(1, "970819", { teacherId: 5 }), student(2, "jaylen.w"), student(3, "other", { teacherId: 6 })], {});
  const routes: Record<string, Function> = {};
  const app: any = { get: (p: string, ...h: any[]) => { routes[`GET ${p}`] = h[h.length - 1]; }, post: (p: string, ...h: any[]) => { routes[`POST ${p}`] = h[h.length - 1]; } };
  let cleared = 0;
  registerAccountMergeRoutes(app, {
    auth: (_q, _s, n) => n(), teacherOrAdmin: (_q, _s, n) => n(), db: m.db,
    canReach: async (user, id) => user.isAdmin || (id === 1 && user.id === 5) || (id === 3 && user.id === 6),
    pool: async () => [c(1, "Jaylen Williams", { mine: true }), c(2, "Jaylen Williams")],
    afterMerge: () => { cleared++; },
  });
  const call = async (body: any, user: any = { id: 5, role: "teacher" }) => {
    let out: any, status = 200;
    const res: any = { json: (b: any) => { out = b; return res; }, status: (s: number) => { status = s; return res; } };
    await routes["POST /api/teacher-admin/students/merge"]({ body, user }, res);
    return { status, body: out };
  };
  assert.equal((await call({ keepId: 2, dupId: 1 })).status, 403, "can't keep an account that isn't yours");
  assert.equal((await call({ keepId: 1, dupId: 3 })).status, 403, "can't pull in another teacher's student");
  const ok = await call({ keepId: 1, dupId: 2 });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.keep, 1);
  assert.equal(cleared, 1);
  assert.equal((await call({ keepId: 1, dupId: 2 })).status, 400, "already merged");
});

test("the merge covers the tables that matter and is wired into the site", () => {
  const names = new Set(USER_LINKS.map((l) => `${l.table}.${l.col}`));
  for (const t of ["attempts.user_id", "reading_profiles.user_id", "manual_point_awards.student_id", "messages.user_id", "math_sessions.user_id", "history_sessions.user_id",
    "comprehension_responses.student_id", "social_profiles.user_id", "student_class_teachers.student_id", "eye_gaze_profiles.user_id", "growth_check_attempts.student_id", "reading_assessment_attempts.user_id"]) {
    assert.ok(names.has(t), t);
  }
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  assert.match(read("server/routes.ts"), /registerAccountMergeRoutes\(app, \{/);
  assert.match(read("client/src/components/teacher-hub/HubReaderTools.tsx"), /\{tab === "readerStudents" && <MergeAccountsCard request=\{request\}/);
  assert.match(read("migrations/merge_student_accounts.sql"), /create table if not exists public\.account_merges/);
});
