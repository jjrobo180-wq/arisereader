// Merging two accounts for one student: usually the account a teacher made for them and the one
// they made themselves later. Everything the duplicate has (quizzes and points, reading, Arise Math
// and History work, messages, certificates, Connect profile…) moves to the account that stays.
// The duplicate is archived, not deleted, and every merge is recorded in account_merges.
//
// USER_LINKS is every column in the database that points at users(id), with the columns that make
// a row unique. A row that would clash with one the kept account already has (two attempts at the
// same book, two reading profiles) is left on the archived duplicate, except quiz attempts, where
// the better score stays. If a table that points at users is added later, add it here:
// tests/account-merge.test.ts lists the expected set.
//
// The database is passed in (MergeDb) so tests/account-merge.test.ts runs the whole merge in memory.
import type { Express, RequestHandler } from "express";

export type Link = { table: string; col: string; key: string[] };

const L = (table: string, col: string, key: string[] = ["id"]): Link => ({ table, col, key });

/** Every column that points at users(id) (from the database's foreign keys, Oct 2026), with each row's unique key. */
export const USER_LINKS: Link[] = [
  L("arise_health_links", "user_id", ["user_id", "member_id"]),
  L("arise_health_sync", "user_id", ["user_id", "member_id", "day"]),
  L("arise_todo_workspaces", "user_id", ["user_id"]),
  L("attempts", "user_id"), L("attempts", "proctor_user_id"),
  L("behavior_events", "student_id"), L("behavior_events", "teacher_id"),
  L("book_feed_events", "user_id"),
  L("book_feed_reactions", "user_id", ["user_id", "book_id"]),
  L("book_feed_saves", "user_id", ["user_id", "book_id"]),
  L("book_feed_shares", "user_id"),
  L("club_arise_controls", "student_id", ["student_id"]), L("club_arise_controls", "teacher_id", ["student_id"]),
  L("club_arise_matches", "player1_id"), L("club_arise_matches", "player2_id"), L("club_arise_matches", "winner_id"),
  L("club_arise_presence", "user_id", ["user_id"]),
  L("comprehension_responses", "student_id"), L("comprehension_responses", "graded_by"),
  L("custom_eye_gaze_attempts", "user_id"), L("custom_eye_gaze_attempts", "proctor_user_id"),
  L("custom_eye_gaze_quizzes", "creator_user_id"), L("custom_eye_gaze_quizzes", "target_teacher_id"),
  L("easter_egg_claims", "user_id"),
  L("english_learners", "student_id", ["student_id"]), L("english_learners", "enabled_by", ["student_id"]),
  L("english_sessions", "student_id"),
  L("english_units", "student_id", ["student_id", "unit_id"]),
  L("english_words", "student_id", ["student_id", "word_id"]),
  L("eye_gaze_attempts", "user_id"), L("eye_gaze_attempts", "proctor_user_id"),
  L("eye_gaze_my_world", "student_id", ["student_id"]),
  L("eye_gaze_profiles", "user_id", ["user_id"]),
  L("eye_gaze_talker_state", "student_id", ["student_id"]),
  L("growth_check_assignments", "student_id"), L("growth_check_attempts", "student_id"),
  L("hall_passes", "student_id"),
  L("history_assignment_results", "user_id", ["assignment_id", "user_id"]),
  L("history_live_players", "user_id", ["game_id", "user_id"]),
  L("history_profiles", "user_id", ["user_id"]),
  L("history_sessions", "user_id"),
  L("live_players", "user_id", ["session_id", "user_id"]),
  L("manual_point_awards", "student_id"),
  L("math_assignment_results", "user_id", ["assignment_id", "user_id"]),
  L("math_live_players", "user_id", ["game_id", "user_id"]),
  L("math_profiles", "user_id", ["user_id"]),
  L("math_sessions", "user_id"),
  L("messages", "user_id"),
  L("notifications", "user_id"),
  L("para_team_items", "created_by"),
  L("para_team_members", "user_id", ["team_id", "user_id"]),
  L("parent_invite_codes", "student_id", ["student_id"]),
  L("push_subscriptions", "user_id"),
  L("quiz_integrity_sessions", "student_id"),
  L("quiz_proctor_sessions", "student_id", []),
  L("quiz_requests", "user_id"), L("quiz_review_requests", "user_id"),
  L("reading_assessment_attempts", "user_id"),
  L("reading_profiles", "user_id", ["user_id"]),
  L("reading_retake_requests", "user_id"),
  L("social_posts", "author_id"),
  L("social_profiles", "user_id", ["user_id"]),
  L("social_reactions", "user_id", ["post_id", "user_id"]),
  L("social_rsvps", "user_id", ["event_id", "user_id"]),
  L("student_class_teachers", "student_id", ["student_id", "school_year"]),
];

export type MergeUser = {
  id: number; username: string; role: string | null; isAdmin: boolean; archived: boolean;
  displayName: string; email: string | null; schoolId: number | null; classId: number | null; teacherId: number | null;
  studentNumber: string | null; approved: boolean; totalPoints: number; password: string; mustChange: boolean; createdAt: string;
};

export type MergeDb = {
  user(id: number): Promise<MergeUser | null>;
  /** Moves every row at once. "conflict" when a unique key would clash. */
  moveAll(table: string, col: string, from: number, to: number): Promise<{ count: number } | "conflict">;
  rows(table: string, cols: string[], match: Record<string, unknown>): Promise<Record<string, any>[]>;
  /** Moves one row (found by match). "conflict" when a unique key would clash. */
  moveOne(table: string, col: string, to: number, match: Record<string, unknown>): Promise<"ok" | "conflict">;
  deleteRows(table: string, match: Record<string, unknown>): Promise<void>;
  updateUser(id: number, patch: Record<string, unknown>): Promise<void>;
  signOut(userId: number): Promise<void>;
  getSetting(key: string): Promise<string>;
  setSetting(key: string, value: string): Promise<void>;
  log(row: { keep_id: number; dup_id: number; by_id: number; login: string; moved: Record<string, number>; skipped: Record<string, number>; points: number }): Promise<void>;
};

export class MergeError extends Error { constructor(message: string, readonly status = 400) { super(message); } }

export type MergeResult = { keep: number; dup: number; moved: Record<string, number>; skipped: Record<string, number>; points: number; username: string; login: "keep" | "dup" };

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Merges dup into keep. login: whose username and password the student signs in with afterward. */
export async function mergeStudentAccounts(db: MergeDb, keepId: number, dupId: number, byId: number, login: "keep" | "dup" = "keep"): Promise<MergeResult> {
  if (!keepId || !dupId || keepId === dupId) throw new MergeError("Pick two different accounts.");
  const [k, d] = await Promise.all([db.user(keepId), db.user(dupId)]);
  if (!k || !d) throw new MergeError("One of those accounts no longer exists.", 404);
  const student = (u: MergeUser) => !u.isAdmin && (!u.role || u.role === "student");
  if (!student(k) || !student(d)) throw new MergeError("Only student accounts can be merged.");
  if (d.archived) throw new MergeError("That account was already merged or archived.");
  if (k.archived) throw new MergeError("The account you're keeping is archived. Restore it first.");

  await db.signOut(dupId);
  const moved: Record<string, number> = {}, skipped: Record<string, number> = {};
  const add = (m: Record<string, number>, k2: string, n: number) => { if (n) m[k2] = (m[k2] || 0) + n; };
  // Points the duplicate had that don't come across (a weaker attempt at a book the kept account
  // also took), and points the kept account loses when the duplicate's better attempt replaces its own.
  let pointsLeftBehind = 0, pointsReplaced = 0;

  for (const link of USER_LINKS) {
    const name = `${link.table}.${link.col}`;
    const all = await db.moveAll(link.table, link.col, dupId, keepId);
    if (all !== "conflict") { add(moved, name, all.count); continue; }
    if (!link.key.length) { const left = await db.rows(link.table, [link.col], { [link.col]: dupId }); add(skipped, name, left.length); continue; }
    const extra = link.table === "attempts" && link.col === "user_id" ? ["book_id", "points_earned", "score", "total"] : [];
    const rows = await db.rows(link.table, [...new Set([...link.key, ...extra])], { [link.col]: dupId });
    for (const row of rows) {
      const match = Object.fromEntries(link.key.map((c) => [c, row[c]]));
      if ((await db.moveOne(link.table, link.col, keepId, match)) === "ok") { add(moved, name, 1); continue; }
      if (extra.length) {
        // Both accounts took this book: keep the better attempt, on the account that stays.
        const [mine] = await db.rows("attempts", ["id", "points_earned", "score", "total"], { user_id: keepId, book_id: row.book_id });
        const better = Number(row.points_earned || 0) > Number(mine?.points_earned || 0)
          || (Number(row.points_earned || 0) === Number(mine?.points_earned || 0) && Number(row.score || 0) / Math.max(1, Number(row.total || 1)) > Number(mine?.score || 0) / Math.max(1, Number(mine?.total || 1)));
        if (mine && better) {
          await db.deleteRows("attempts", { id: mine.id });
          if ((await db.moveOne("attempts", "user_id", keepId, { id: row.id })) === "ok") {
            pointsReplaced += Number(mine.points_earned || 0);
            add(moved, name, 1);
            continue;
          }
        }
        pointsLeftBehind += Number(row.points_earned || 0);
      }
      add(skipped, name, 1);
    }
  }

  await mergeSettings(db, keepId, dupId);

  const points = round1(Math.max(0, d.totalPoints - pointsLeftBehind - pointsReplaced));
  // Free the duplicate's sign-in name and student number first: they're unique, and the kept account may take them.
  await db.updateUser(dupId, {
    username: `${d.username.slice(0, 60)}.merged${dupId}`, student_number: null, email: null, total_points: 0,
    archived_at: new Date().toISOString(), archived_by: byId || null,
  });
  await db.updateUser(keepId, {
    total_points: round1(k.totalPoints + points),
    email: k.email || d.email,
    school_id: k.schoolId ?? d.schoolId,
    class_id: k.classId ?? d.classId,
    teacher_id: k.teacherId ?? d.teacherId,
    student_number: k.studentNumber || d.studentNumber,
    approved_by_teacher: k.approved || d.approved,
    ...(login === "dup" ? { username: d.username, password: d.password, must_change_password: false } : {}),
  });
  await db.log({ keep_id: keepId, dup_id: dupId, by_id: byId, login, moved, skipped, points });
  return { keep: keepId, dup: dupId, moved, skipped, points, login, username: login === "dup" ? d.username : k.username };
}

/** Things kept in settings by student id: a parent's linked children and the student's rewards. */
async function mergeSettings(db: MergeDb, keepId: number, dupId: number) {
  const links = await db.getSetting("parent_student_links");
  if (links) {
    try {
      const map = JSON.parse(links) as Record<string, unknown>;
      let changed = false;
      for (const [parent, raw] of Object.entries(map)) {
        const ids = (Array.isArray(raw) ? raw : raw == null ? [] : [raw]).map(Number);
        if (!ids.includes(dupId)) continue;
        map[parent] = [...new Set(ids.map((id) => (id === dupId ? keepId : id)))];
        changed = true;
      }
      if (changed) await db.setSetting("parent_student_links", JSON.stringify(map));
    } catch { /* leave a setting we can't read alone */ }
  }
  const dupRewards = await db.getSetting(`student_rewards_${dupId}`);
  if (dupRewards) {
    try {
      const mine = JSON.parse((await db.getSetting(`student_rewards_${keepId}`)) || "[]");
      const theirs = JSON.parse(dupRewards);
      if (Array.isArray(mine) && Array.isArray(theirs) && theirs.length) {
        await db.setSetting(`student_rewards_${keepId}`, JSON.stringify([...mine, ...theirs]));
        await db.setSetting(`student_rewards_${dupId}`, "[]");
      }
    } catch { /* leave it */ }
  }
}

// ─── finding duplicates ───

/** "Jaylen  O'Neil-Smith" → "jaylen oneilsmith": first and last word, letters only. */
export function nameKey(name: string): string {
  const words = String(name || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/).map((w) => w.replace(/[^a-z]/g, "")).filter(Boolean);
  if (words.length < 2) return words[0] || "";
  return `${words[0]} ${words[words.length - 1]}`;
}

export type Candidate = { id: number; name: string; username: string; createdAt: string; points: number; teacherId: number | null; teacherName: string | null; schoolId: number | null; approved: boolean; mine: boolean };
export type DuplicatePair = { keep: Candidate; dup: Candidate; reason: string };

/** Pairs of accounts that look like the same student. The one to keep is the one in the teacher's
 *  class, else the older one (a teacher's account usually came first). */
export function findDuplicates(students: Candidate[]): DuplicatePair[] {
  const groups = new Map<string, Candidate[]>();
  const push = (key: string, s: Candidate) => { if (!key) return; const g = groups.get(key) || []; if (!g.some((x) => x.id === s.id)) g.push(s); groups.set(key, g); };
  for (const s of students) {
    const nk = nameKey(s.name);
    if (nk.includes(" ")) push(`name:${s.schoolId ?? "any"}:${nk}`, s);
    if (/^\d{4,}$/.test(s.username)) push(`num:${s.username}`, s);
  }
  // An unlisted student (no school yet) still matches a classmate with the same full name.
  for (const s of students) {
    if (s.schoolId != null) continue;
    const nk = nameKey(s.name);
    if (!nk.includes(" ")) continue;
    for (const [key, g] of groups) if (key.startsWith("name:") && key.endsWith(`:${nk}`) && !key.startsWith("name:any:")) push(key, s);
  }
  const seen = new Set<string>(), out: DuplicatePair[] = [];
  for (const [key, g] of groups) {
    if (g.length < 2) continue;
    const order = [...g].sort((a, b) => Number(b.mine) - Number(a.mine) || a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
    const keep = order[0];
    for (const dup of order.slice(1)) {
      const id = `${keep.id}-${dup.id}`;
      if (seen.has(id) || seen.has(`${dup.id}-${keep.id}`)) continue;
      seen.add(id);
      out.push({ keep, dup, reason: key.startsWith("num:") ? "Same student number" : "Same name" });
    }
  }
  return out.filter((p) => p.keep.mine || p.dup.mine);
}

// ─── routes ───

export type MergeRouteDeps = {
  auth: RequestHandler;
  teacherOrAdmin: RequestHandler;
  db: MergeDb;
  canReach(user: any, studentId: number): Promise<boolean>;
  /** The students this person may merge between: theirs, plus unlisted students at their school (admin: everyone). */
  pool(user: any): Promise<Candidate[]>;
  afterMerge(): void;
};

export function registerAccountMergeRoutes(app: Express, deps: MergeRouteDeps) {
  const guard = [deps.auth, deps.teacherOrAdmin];

  app.get("/api/teacher-admin/students/duplicates", ...guard, async (req: any, res) => {
    try {
      const pool = await deps.pool(req.user);
      res.json({ pairs: findDuplicates(pool).slice(0, 100), students: pool.map(({ id, name, username, createdAt, points, teacherName, approved, mine }) => ({ id, name, username, createdAt, points, teacherName, approved, mine })) });
    } catch (e: any) {
      console.error("[merge] duplicates:", e?.message || e);
      res.status(500).json({ message: "Couldn't look for duplicate accounts. Try again." });
    }
  });

  app.post("/api/teacher-admin/students/merge", ...guard, async (req: any, res) => {
    try {
      const keepId = Number(req.body?.keepId), dupId = Number(req.body?.dupId);
      const login = req.body?.login === "dup" ? "dup" : "keep";
      if (!Number.isInteger(keepId) || !Number.isInteger(dupId) || keepId <= 0 || dupId <= 0) return res.status(400).json({ message: "Pick the two accounts to merge." });
      // The account that stays has to be one of yours; the other has to be yours too, or an
      // unlisted account at your school (a student who signed up on their own).
      if (!(await deps.canReach(req.user, keepId))) return res.status(403).json({ message: "The account you keep has to be one of your students." });
      if (!req.user?.isAdmin && !(await deps.canReach(req.user, dupId))) {
        const pool = await deps.pool(req.user);
        if (!pool.some((s) => s.id === dupId)) return res.status(403).json({ message: "You can only merge your own students, or accounts at your school that aren't in a class yet." });
      }
      const result = await mergeStudentAccounts(deps.db, keepId, dupId, Number(req.user?.id) || 0, login);
      deps.afterMerge();
      res.json(result);
    } catch (e: any) {
      if (e instanceof MergeError) return res.status(e.status).json({ message: e.message });
      console.error("[merge] merge:", e?.message || e);
      res.status(500).json({ message: "The merge stopped partway. Nothing was lost: run the same merge again to finish it." });
    }
  });
}

// ─── Supabase ───

export function supabaseMergeDb(getAdminSupabase: () => any): MergeDb {
  const sb = () => getAdminSupabase();
  const isConflict = (error: any) => error && (error.code === "23505" || /duplicate key/i.test(error.message || ""));
  const where = (q: any, match: Record<string, unknown>) => { for (const [k, v] of Object.entries(match)) q = v === null ? q.is(k, null) : q.eq(k, v); return q; };
  return {
    async user(id) {
      const { data, error } = await sb().from("users").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        id: data.id, username: data.username, role: data.role, isAdmin: !!data.is_admin, archived: !!data.archived_at, displayName: data.display_name || "",
        email: data.email || null, schoolId: data.school_id ?? null, classId: data.class_id ?? null, teacherId: data.teacher_id ?? null,
        studentNumber: data.student_number || null, approved: data.approved_by_teacher !== false, totalPoints: Number(data.total_points || 0),
        password: data.password, mustChange: !!data.must_change_password, createdAt: data.created_at || "",
      };
    },
    async moveAll(table, col, from, to) {
      const { data, error } = await sb().from(table).update({ [col]: to }).eq(col, from).select(col);
      if (isConflict(error)) return "conflict";
      if (error) throw new Error(`${table}: ${error.message}`);
      return { count: (data || []).length };
    },
    async rows(table, cols, match) {
      const { data, error } = await where(sb().from(table).select(cols.join(",")), match).limit(5000);
      if (error) throw new Error(`${table}: ${error.message}`);
      return data || [];
    },
    async moveOne(table, col, to, match) {
      const { error } = await where(sb().from(table).update({ [col]: to }), match);
      if (isConflict(error)) return "conflict";
      if (error) throw new Error(`${table}: ${error.message}`);
      return "ok";
    },
    async deleteRows(table, match) {
      const { error } = await where(sb().from(table).delete(), match);
      if (error) throw new Error(`${table}: ${error.message}`);
    },
    async updateUser(id, patch) {
      const { error } = await sb().from("users").update(patch).eq("id", id);
      if (error) throw new Error(`users: ${error.message}`);
    },
    async signOut(userId) {
      const { error } = await sb().from("sessions").delete().eq("user_id", userId);
      if (error) throw new Error(`sessions: ${error.message}`);
    },
    async getSetting(key) {
      const { data, error } = await sb().from("settings").select("value").eq("key", key).maybeSingle();
      if (error) throw new Error(error.message);
      return data?.value || "";
    },
    async setSetting(key, value) {
      const { error } = await sb().from("settings").upsert({ key, value }, { onConflict: "key" });
      if (error) throw new Error(error.message);
    },
    async log(row) {
      const { error } = await sb().from("account_merges").insert(row);
      if (error) console.error("[merge] log:", error.message);
    },
  };
}
