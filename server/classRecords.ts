// A.R.I.S.E. class records (shared/classRecords.ts): what teachers share with families and staff.
//
// Rules kept here, on the server:
// - A teacher reads and writes records only for their own approved students.
// - Families see only their own child, only what each teacher shares with families (ShareSettings),
//   only published grades, and only wall posts meant for their child. A signed-in parent is linked to
//   the child (parent codes); a private link (one per child, made, replaced or turned off by a teacher)
//   sees the same thing without signing in.
// - Other staff at the school see what each teacher shares with staff; admins see everything at their
//   school. Messages between a family and a teacher are private to them (and admins).
// - Hall passes and behavior points live in server/classBehavior.ts; this reads them for families and staff.
// Storage: small JSON records in the settings table (server/fitKv.ts) and wall photos in a private
// bucket. No tables to set up.
import type { Express, RequestHandler } from "express";
import { randomBytes, randomUUID } from "node:crypto";
import type { FitKv } from "./fitKv";
import type { BehaviorStore } from "./classBehavior";
import {
  ATTENDANCE, LINK_RE, POST_KINDS, RECORD_PLUGINS, addDays, attendanceSummary, cleanAssignment, cleanAudience, cleanCategories, cleanMark, cleanScale, cleanScore, cleanShare,
  dayIn, emptyGradebook, isDay, seesPost, studentGrade, text, unreadFor, wallOrder,
  type AttendanceMonth, type Gradebook, type Message, type RecordPlugin, type ShareSettings, type Thread, type WallPost,
} from "../shared/classRecords";
import { totals } from "../shared/classBehavior";

export type RUser = { id: number; role: "student" | "teacher" | "parent" | "admin"; displayName: string; teacherId: number | null; schoolId: number | null; approvedByTeacher: boolean; archived: boolean };
export type RecordsDirectory = {
  user: (id: number) => Promise<RUser | null>;
  studentsOf: (teacherId: number) => Promise<RUser[]>;
  childrenOf: (parentId: number) => Promise<number[]>;
  parentsOf: (studentId: number) => Promise<number[]>;
  /** Teachers (and admins) at a school. */
  staffOf: (schoolId: number) => Promise<RUser[]>;
  notify?: (userId: number, message: { title: string; body: string; url?: string }) => Promise<unknown> | void;
};
export type RecordFiles = { put(path: string, data: Buffer, type: string): Promise<void>; get(path: string): Promise<{ data: Buffer; type: string } | null>; del(paths: string[]): Promise<void> };
export type RecordsDeps = { directory: RecordsDirectory; kv: FitKv; files: RecordFiles; behavior?: BehaviorStore; now?: () => number; token?: () => string };

const MAX_POSTS = 400, MAX_MESSAGES = 500, MAX_PHOTOS = 8, PHOTO_BYTES = 8 * 1024 * 1024;
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const first = (n: string) => n.trim().split(/\s+/)[0] || "Student";
const monthKey = (day: string) => day.slice(0, 7);
const monthsBetween = (from: string, to: string) => { const out: string[] = []; let m = monthKey(from); while (m <= monthKey(to) && out.length < 24) { out.push(m); const [y, mo] = m.split("-").map(Number); m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; } return out; };

/** Where a teacher's sharing settings are kept (server/classBehavior.ts reads them too). */
export const recordShareKey = (t: number) => `cr:share:${t}`;
const K = {
  share: recordShareKey,
  att: (t: number, month: string) => `cr:att:${t}:${month}`,
  grades: (t: number) => `cr:grades:${t}`,
  wall: (t: number) => `cr:wall:${t}`,
  thread: (t: number, s: number) => `cr:thread:${t}:${s}`,
  teachersOf: (s: number) => `cr:teachersOf:${s}`,
  link: (token: string) => `cr:link:${token}`,
  linkOf: (s: number) => `cr:linkOf:${s}`,
};

export function registerClassRecordsRoutes(app: Express, auth: RequestHandler, deps: RecordsDeps) {
  const { directory: dir, kv, files } = deps;
  const now = deps.now ?? Date.now;
  const iso = () => new Date(now()).toISOString();
  const makeToken = deps.token ?? (() => randomBytes(32).toString("base64url"));

  // One write at a time per record, so two quick saves never lose each other's changes.
  const locks = new Map<string, Promise<unknown>>();
  async function update<T>(key: string, fallback: () => T, change: (v: T) => T | Promise<T>): Promise<T> {
    const prev = locks.get(key) ?? Promise.resolve();
    const run = prev.catch(() => null).then(async () => { const cur = ((await kv.get(key)) ?? fallback()) as T; const next = await change(cur); await kv.set(key, next); return next; });
    locks.set(key, run); run.finally(() => { if (locks.get(key) === run) locks.delete(key); }).catch(() => null);
    return run;
  }

  const handle = (fn: (req: any, res: any) => Promise<any>) => async (req: any, res: any) => {
    try { await fn(req, res); }
    catch (e: any) {
      if (e?.code === 401) return res.status(401).json({ message: "Sign in again." });
      if (e?.status) return res.status(e.status).json({ message: e.message });
      console.error("[class-records]", e?.message || e);
      res.status(500).json({ message: "Something went wrong. Try again." });
    }
  };
  const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
  async function me(req: any) { const u = await dir.user(Number(req.user?.id)); if (!u || u.archived) throw Object.assign(new Error("no"), { code: 401 }); return u; }
  const isStaff = (u: RUser) => u.role === "teacher" || u.role === "admin";
  async function teacher(req: any) { const t = await me(req); if (!isStaff(t)) throw fail(403, "Teachers only."); return t; }
  async function myStudents(t: RUser) { return (await dir.studentsOf(t.id)).filter((s) => s.role === "student" && s.approvedByTeacher && !s.archived).sort((a, b) => a.displayName.localeCompare(b.displayName)); }
  async function myStudent(t: RUser, sid: number) { const k = (await myStudents(t)).find((s) => s.id === sid); if (!k) throw fail(404, "Not one of your students."); return k; }

  const getShare = async (t: number) => cleanShare(await kv.get(K.share(t)));
  const getBook = async (t: number): Promise<Gradebook> => { const b = await kv.get(K.grades(t)); return b ? { ...emptyGradebook(), ...b, categories: cleanCategories(b.categories), scale: cleanScale(b.scale) } : emptyGradebook(); };
  const getWall = async (t: number): Promise<WallPost[]> => (await kv.get(K.wall(t))) ?? [];
  const getThread = async (t: number, s: number): Promise<Thread> => (await kv.get(K.thread(t, s))) ?? { studentId: s, teacherId: t, messages: [], teacherRead: "", familyRead: "" };
  /** Remember which teachers keep records for a child, so the family page finds them all. */
  async function remember(teacherId: number, studentIds: number[]) {
    for (const s of studentIds) await update<number[]>(K.teachersOf(s), () => [], (ids) => (ids.includes(teacherId) ? ids : [...ids, teacherId].slice(-30)));
  }
  async function notifyParents(studentId: number, title: string, body: string) {
    if (!dir.notify) return;
    for (const p of await dir.parentsOf(studentId).catch(() => [])) { try { await dir.notify(p, { title, body, url: "/#/family" }); } catch { /* no device */ } }
  }

  /* ================================================================ teacher: sharing and roster */

  app.get("/api/records/setup", auth, handle(async (req, res) => {
    const t = await teacher(req);
    const kids = await myStudents(t);
    const links = await Promise.all(kids.map(async (k) => [k.id, await kv.get(K.linkOf(k.id))] as const));
    res.json({
      share: await getShare(t.id),
      students: kids.map((k) => ({ id: k.id, name: k.displayName })),
      links: Object.fromEntries(links.map(([id, l]) => [id, l && l.on ? { token: l.token, at: l.at } : null])),
    });
  }));
  app.put("/api/records/share", auth, handle(async (req, res) => {
    const t = await teacher(req);
    const s = cleanShare(req.body); await kv.set(K.share(t.id), s); res.json({ share: s });
  }));

  /** The private family link for one child: make one (or a new one, which turns the old one off) or turn it off. */
  app.post("/api/records/links/:sid", auth, handle(async (req, res) => {
    const t = await teacher(req); const kid = await myStudent(t, Number(req.params.sid));
    const old = await kv.get(K.linkOf(kid.id));
    if (old?.token) await kv.set(K.link(old.token), null);
    const token = makeToken();
    await kv.set(K.link(token), { studentId: kid.id, by: t.id, at: iso() });
    await kv.set(K.linkOf(kid.id), { token, on: true, by: t.id, at: iso() });
    await remember(t.id, [kid.id]);
    res.json({ token, at: iso() });
  }));
  app.delete("/api/records/links/:sid", auth, handle(async (req, res) => {
    const t = await teacher(req); const kid = await myStudent(t, Number(req.params.sid));
    const old = await kv.get(K.linkOf(kid.id));
    if (old?.token) await kv.set(K.link(old.token), null);
    await kv.set(K.linkOf(kid.id), null);
    res.json({ ok: true });
  }));

  /* ================================================================ teacher: attendance */

  app.get("/api/records/attendance", auth, handle(async (req, res) => {
    const t = await teacher(req);
    const today = dayIn(now());
    const day = isDay(req.query.day) ? String(req.query.day) : today;
    const kids = await myStudents(t);
    const month: AttendanceMonth = (await kv.get(K.att(t.id, monthKey(day)))) ?? {};
    // Rates over the last 60 school days, for the roster.
    const from = addDays(day, -90);
    const months = await Promise.all(monthsBetween(from, day).map(async (m) => ((await kv.get(K.att(t.id, m))) ?? {}) as AttendanceMonth));
    const sum = attendanceSummary(months, kids.map((k) => k.id), from, day);
    res.json({ day, today, marks: month[day] ?? {}, students: kids.map((k) => ({ id: k.id, name: k.displayName, ...sum[k.id] })) });
  }));
  app.put("/api/records/attendance", auth, handle(async (req, res) => {
    const t = await teacher(req);
    const day = String(req.body?.day || "");
    if (!isDay(day)) throw fail(400, "Pick a day.");
    if (day > addDays(dayIn(now()), 7)) throw fail(400, "That day is too far ahead.");
    const ids = new Set((await myStudents(t)).map((k) => k.id));
    const incoming = req.body?.marks && typeof req.body.marks === "object" ? req.body.marks : {};
    const changed: number[] = [];
    await update<AttendanceMonth>(K.att(t.id, monthKey(day)), () => ({}), (month) => {
      const marks = { ...(month[day] ?? {}) };
      for (const [sid, raw] of Object.entries(incoming)) {
        if (!ids.has(Number(sid))) continue;
        const m = raw === null ? null : cleanMark(raw);
        if (m) marks[sid] = m; else delete marks[sid];
        changed.push(Number(sid));
      }
      return { ...month, [day]: marks };
    });
    await remember(t.id, changed);
    // Families who are shown attendance hear about an absence or a tardy the day it happens.
    const share = await getShare(t.id);
    if (share.parents.attendance && day === dayIn(now())) {
      for (const sid of changed) {
        const m = incoming[String(sid)];
        if (m?.status === "absent" || m?.status === "tardy") {
          const kid = await dir.user(sid);
          if (kid) void notifyParents(sid, `${first(kid.displayName)}: ${m.status === "absent" ? "absent" : "tardy"} today`, `${t.displayName} marked ${first(kid.displayName)} ${m.status} in class today.`);
        }
      }
    }
    res.json({ ok: true, saved: changed.length });
  }));

  /* ================================================================ teacher: gradebook */

  app.get("/api/records/grades", auth, handle(async (req, res) => {
    const t = await teacher(req);
    const kids = await myStudents(t);
    const book = await getBook(t.id);
    res.json({ book, students: kids.map((k) => ({ id: k.id, name: k.displayName, grade: studentGrade(book, k.id) })) });
  }));
  app.put("/api/records/grades/setup", auth, handle(async (req, res) => {
    const t = await teacher(req);
    const book = await update<Gradebook>(K.grades(t.id), emptyGradebook, (b) => {
      const categories = req.body?.categories ? cleanCategories(req.body.categories) : b.categories;
      // Work in a category that's gone moves to the first one, so no scores are lost.
      const assignments = b.assignments.map((a) => (categories.some((c) => c.id === a.categoryId) ? a : { ...a, categoryId: categories[0].id }));
      return { ...b, categories, assignments, scale: req.body?.scale ? cleanScale(req.body.scale) : b.scale };
    });
    res.json({ book });
  }));
  app.post("/api/records/grades/assignments", auth, handle(async (req, res) => {
    const t = await teacher(req);
    let made = null as any;
    const book = await update<Gradebook>(K.grades(t.id), emptyGradebook, (b) => {
      if (b.assignments.length >= 600) throw fail(400, "The gradebook is full. Delete old assignments first.");
      made = cleanAssignment(req.body, b.categories, randomUUID(), iso());
      if (!made) throw fail(400, "Give the assignment a name.");
      return { ...b, assignments: [...b.assignments, made] };
    });
    res.json({ assignment: made, book });
  }));
  app.put("/api/records/grades/assignments/:id", auth, handle(async (req, res) => {
    const t = await teacher(req);
    const book = await update<Gradebook>(K.grades(t.id), emptyGradebook, (b) => {
      const old = b.assignments.find((a) => a.id === req.params.id); if (!old) throw fail(404, "That assignment is gone.");
      const next = cleanAssignment({ ...old, ...req.body }, b.categories, old.id, old.createdAt); if (!next) throw fail(400, "Give the assignment a name.");
      return { ...b, assignments: b.assignments.map((a) => (a.id === old.id ? next : a)) };
    });
    res.json({ book });
  }));
  app.delete("/api/records/grades/assignments/:id", auth, handle(async (req, res) => {
    const t = await teacher(req);
    const book = await update<Gradebook>(K.grades(t.id), emptyGradebook, (b) => {
      const scores = { ...b.scores }; delete scores[req.params.id];
      return { ...b, assignments: b.assignments.filter((a) => a.id !== req.params.id), scores };
    });
    res.json({ book });
  }));
  /** Scores for one assignment: { assignmentId, scores: { [studentId]: Score | null } }. */
  app.put("/api/records/grades/scores", auth, handle(async (req, res) => {
    const t = await teacher(req);
    const ids = new Set((await myStudents(t)).map((k) => String(k.id)));
    const aid = String(req.body?.assignmentId || "");
    const incoming = req.body?.scores && typeof req.body.scores === "object" ? req.body.scores : {};
    const touched: number[] = [];
    const book = await update<Gradebook>(K.grades(t.id), emptyGradebook, (b) => {
      const a = b.assignments.find((x) => x.id === aid); if (!a) throw fail(404, "That assignment is gone.");
      const col = { ...(b.scores[aid] ?? {}) };
      for (const [sid, raw] of Object.entries(incoming)) {
        if (!ids.has(sid)) continue;
        const s = raw === null ? null : cleanScore(raw, a.points);
        if (s) col[sid] = s; else delete col[sid];
        touched.push(Number(sid));
      }
      return { ...b, scores: { ...b.scores, [aid]: col } };
    });
    await remember(t.id, touched);
    res.json({ book });
  }));

  /* ================================================================ teacher: the student wall */

  /** One photo for a post, as the raw image. Returns its name, to send with the post. */
  app.post("/api/records/photos", auth, handle(async (req, res) => {
    const t = await teacher(req);
    const type = String(req.headers["content-type"] || "").split(";")[0].trim();
    const ext = PHOTO_TYPES[type];
    if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) throw fail(400, "Send a JPG, PNG or WebP picture.");
    if (req.body.length > PHOTO_BYTES) throw fail(413, "That picture is too big (8 MB at most).");
    const name = `${randomUUID()}.${ext}`;
    await files.put(`wall/${t.id}/${name}`, req.body, type);
    res.json({ photo: name });
  }));
  app.get("/api/records/wall", auth, handle(async (req, res) => {
    const t = await teacher(req);
    const kids = await myStudents(t);
    const threads = await Promise.all(kids.map((k) => getThread(t.id, k.id)));
    res.json({
      posts: wallOrder(await getWall(t.id)),
      students: kids.map((k) => ({ id: k.id, name: k.displayName })),
      inbox: threads.filter((th) => th.messages.length).map((th) => ({ studentId: th.studentId, last: th.messages[th.messages.length - 1], unread: unreadFor(th, "teacher") }))
        .sort((a, b) => b.last.at.localeCompare(a.last.at)),
    });
  }));
  app.post("/api/records/wall", auth, handle(async (req, res) => {
    const t = await teacher(req);
    const kids = await myStudents(t), ids = kids.map((k) => k.id);
    const post = cleanPost(req.body, t.id, ids);
    await update<WallPost[]>(K.wall(t.id), () => [], (posts) => [post, ...posts].slice(0, MAX_POSTS));
    const reach = post.audience.kind === "class" ? ids : post.audience.ids;
    await remember(t.id, reach);
    const share = await getShare(t.id);
    if (share.parents.wall && req.body?.notify !== false) {
      const label = post.kind === "announcement" ? "Announcement" : post.kind === "newsletter" ? "Newsletter" : "New post";
      for (const sid of reach) void notifyParents(sid, `${label} from ${t.displayName}`, post.title || post.body.slice(0, 120));
    }
    res.json({ post });
  }));
  app.put("/api/records/wall/:id", auth, handle(async (req, res) => {
    const t = await teacher(req);
    const ids = (await myStudents(t)).map((k) => k.id);
    let out: WallPost | null = null;
    await update<WallPost[]>(K.wall(t.id), () => [], (posts) => posts.map((p) => {
      if (p.id !== req.params.id) return p;
      const next = cleanPost({ ...p, ...req.body }, t.id, ids, p);
      out = { ...next, editedAt: iso() }; return out;
    }));
    if (!out) throw fail(404, "That post is gone.");
    res.json({ post: out });
  }));
  app.delete("/api/records/wall/:id", auth, handle(async (req, res) => {
    const t = await teacher(req);
    let gone: WallPost | undefined;
    await update<WallPost[]>(K.wall(t.id), () => [], (posts) => { gone = posts.find((p) => p.id === req.params.id); return posts.filter((p) => p.id !== req.params.id); });
    if (gone?.photos.length) await files.del(gone.photos.map((f) => `wall/${t.id}/${f}`)).catch(() => null);
    res.json({ ok: !!gone });
  }));
  function cleanPost(raw: any, teacherId: number, myIds: number[], was?: WallPost): WallPost {
    const kind = (POST_KINDS as readonly string[]).includes(raw?.kind) ? raw.kind : "post";
    const audience = cleanAudience(raw?.audience, myIds);
    if (!audience) throw fail(400, "Pick who it's for: the whole class or at least one student.");
    const title = text(raw?.title, 140).replace(/\s+/g, " ");
    const body = text(raw?.body, kind === "newsletter" ? 12000 : 4000);
    const photos = (Array.isArray(raw?.photos) ? raw.photos : []).map(String).filter((f: string) => /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(f)).slice(0, MAX_PHOTOS);
    if (!body && !photos.length && !title) throw fail(400, "Write something or add a photo.");
    if (kind !== "post" && !title) throw fail(400, `Give the ${kind} a title.`);
    return { id: was?.id ?? randomUUID(), teacherId, kind, title, body, audience, photos, pinned: !!raw?.pinned, createdAt: was?.createdAt ?? iso() };
  }

  /* ================================================================ teacher: messages */

  app.get("/api/records/messages/:sid", auth, handle(async (req, res) => {
    const t = await teacher(req); const kid = await myStudent(t, Number(req.params.sid));
    const th = await update<Thread>(K.thread(t.id, kid.id), () => ({ studentId: kid.id, teacherId: t.id, messages: [], teacherRead: "", familyRead: "" }), (x) => ({ ...x, teacherRead: iso() }));
    res.json({ thread: th, parents: (await dir.parentsOf(kid.id).catch(() => [])).length, link: !!(await kv.get(K.linkOf(kid.id)))?.on });
  }));
  app.post("/api/records/messages/:sid", auth, handle(async (req, res) => {
    const t = await teacher(req); const kid = await myStudent(t, Number(req.params.sid));
    const body = text(req.body?.body, 2000); if (!body) throw fail(400, "Write a message.");
    const msg: Message = { id: randomUUID(), from: "teacher", authorId: t.id, authorName: t.displayName, body, at: iso() };
    const th = await update<Thread>(K.thread(t.id, kid.id), () => ({ studentId: kid.id, teacherId: t.id, messages: [], teacherRead: "", familyRead: "" }), (x) => ({ ...x, messages: [...x.messages, msg].slice(-MAX_MESSAGES), teacherRead: msg.at }));
    await remember(t.id, [kid.id]);
    void notifyParents(kid.id, `Message from ${t.displayName}`, body.slice(0, 160));
    res.json({ thread: th });
  }));

  /* ================================================================ what a family (or staff) sees */

  type Viewer = { kind: "family"; parentId: number | null; linkName?: string } | { kind: "staff"; user: RUser } | { kind: "admin"; user: RUser };

  async function teachersFor(kid: RUser): Promise<RUser[]> {
    const ids = new Set<number>((await kv.get(K.teachersOf(kid.id))) ?? []);
    if (kid.teacherId) ids.add(kid.teacherId);
    const out: RUser[] = [];
    for (const id of ids) {
      const t = await dir.user(id);
      if (!t || t.archived || !isStaff(t)) continue;
      // Still this child's teacher? (A student who moved classes leaves the old teacher's records behind.)
      if (id !== kid.teacherId && !(await myStudents(t)).some((s) => s.id === kid.id)) continue;
      out.push(t);
    }
    return out.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async function childView(kid: RUser, viewer: Viewer) {
    const teachers = await teachersFor(kid);
    const today = dayIn(now()), from = addDays(today, -120);
    const sees = (share: ShareSettings, p: RecordPlugin) => viewer.kind === "admin" || (viewer.kind === "family" ? share.parents[p] : share.staff[p]);
    const per = await Promise.all(teachers.map(async (t) => {
      const share = await getShare(t.id);
      const shown = Object.fromEntries(RECORD_PLUGINS.map((p) => [p, sees(share, p)])) as Record<RecordPlugin, boolean>;
      const out: any = { teacher: { id: t.id, name: t.displayName }, shown };
      if (shown.grades) {
        const book = await getBook(t.id), g = studentGrade(book, kid.id, { publishedOnly: viewer.kind === "family" });
        const work = book.assignments.filter((a) => viewer.kind !== "family" || a.published).sort((a, b) => (b.due || b.createdAt).localeCompare(a.due || a.createdAt))
          .map((a) => ({ id: a.id, title: a.title, category: book.categories.find((c) => c.id === a.categoryId)?.name || "", points: a.points, due: a.due, ...(book.scores[a.id]?.[String(kid.id)] ?? {}) }));
        out.grades = book.assignments.length ? { ...g, work } : null;
      }
      if (shown.attendance) {
        const months = await Promise.all(monthsBetween(from, today).map(async (m) => ((await kv.get(K.att(t.id, m))) ?? {}) as AttendanceMonth));
        const sum = attendanceSummary(months, [kid.id], from, today)[kid.id];
        out.attendance = sum.days ? sum : null;
      }
      if (shown.wall) out.wall = wallOrder(await getWall(t.id)).filter((p) => seesPost(p, kid.id)).slice(0, 60).map(({ audience: _a, ...p }) => ({ ...p, teacherName: t.displayName }));
      if (viewer.kind === "family" || viewer.kind === "admin") {
        const th = await getThread(t.id, kid.id);
        out.messages = { messages: th.messages.slice(-100), unread: viewer.kind === "family" ? unreadFor(th, "family") : 0 };
      }
      return out;
    }));
    // Behavior points and hall passes (server/classBehavior.ts), each teacher's sharing applied.
    let behavior: any = null, passes: any = null;
    if (deps.behavior) {
      const showB = new Set(per.filter((p) => p.shown.behavior).map((p) => p.teacher.id));
      const showP = new Set(per.filter((p) => p.shown.passes).map((p) => p.teacher.id));
      if (showB.size || viewer.kind === "admin") {
        const ev = (await deps.behavior.events({ studentIds: [kid.id], since: new Date(now() - 120 * 86_400_000).toISOString(), limit: 1000 }).catch(() => []))
          .filter((e) => (viewer.kind === "admin" || showB.has(e.teacher_id)) && (viewer.kind !== "family" || e.share));
        behavior = { totals: totals(ev, now())[kid.id] ?? { all: 0, week: 0, today: 0, pos: 0, neg: 0 }, recent: ev.slice(0, 60).map((e) => ({ id: e.id, points: e.points, label: e.label, note: e.note, at: e.created_at, teacher: per.find((p) => p.teacher.id === e.teacher_id)?.teacher.name || "" })) };
      }
      if (showP.size || viewer.kind === "admin") {
        const ps = (await deps.behavior.passes({ studentIds: [kid.id], since: new Date(now() - 60 * 86_400_000).toISOString() }).catch(() => []))
          .filter((p) => (viewer.kind === "admin" || showP.has(p.teacher_id)) && p.status !== "denied" && p.status !== "asked");
        passes = ps.slice(0, 60).map((p) => ({ id: p.id, place: p.place, status: p.status, limit: p.limit_min, outAt: p.out_at, backAt: p.back_at, teacher: per.find((x) => x.teacher.id === p.teacher_id)?.teacher.name || "" }));
      }
    }
    return { child: { id: kid.id, name: kid.displayName, first: first(kid.displayName) }, teachers: per, behavior, passes, serverNow: now() };
  }

  async function familyChild(req: any, sid: number): Promise<{ kid: RUser; viewer: Viewer }> {
    const link = String(req.headers["x-family-link"] || req.query.link || "");
    if (link) {
      if (!LINK_RE.test(link)) throw fail(404, "This link doesn't work anymore. Ask the teacher for a new one.");
      const l = await kv.get(K.link(link)); if (!l) throw fail(404, "This link doesn't work anymore. Ask the teacher for a new one.");
      const kid = await dir.user(Number(l.studentId)); if (!kid || kid.archived) throw fail(404, "This link doesn't work anymore.");
      return { kid, viewer: { kind: "family", parentId: null } };
    }
    const u = await me(req);
    if (u.role === "parent") {
      const kids = await dir.childrenOf(u.id);
      const id = sid || kids[0];
      if (!id || !kids.includes(id)) throw fail(404, "That isn't one of your children.");
      const kid = await dir.user(id); if (!kid || kid.archived) throw fail(404, "That account is closed.");
      return { kid, viewer: { kind: "family", parentId: u.id } };
    }
    throw fail(403, "Parents only.");
  }
  /** The link check runs before sign-in, so a family link works with no account. */
  const linkOrAuth: RequestHandler = (req, res, next) => (req.headers["x-family-link"] || req.query.link ? next() : auth(req, res, next));

  app.get("/api/family/children", linkOrAuth, handle(async (req, res) => {
    const link = String(req.headers["x-family-link"] || req.query.link || "");
    if (link) { const { kid } = await familyChild(req, 0); return res.json({ children: [{ id: kid.id, name: kid.displayName, first: first(kid.displayName) }], viaLink: true }); }
    const u = await me(req); if (u.role !== "parent") throw fail(403, "Parents only.");
    const kids = (await Promise.all((await dir.childrenOf(u.id)).map((id) => dir.user(id)))).filter((k): k is RUser => !!k && !k.archived && k.role === "student");
    res.json({ children: kids.map((k) => ({ id: k.id, name: k.displayName, first: first(k.displayName) })), viaLink: false, me: { name: u.displayName } });
  }));
  app.get("/api/family/child/:sid", linkOrAuth, handle(async (req, res) => {
    const { kid, viewer } = await familyChild(req, Number(req.params.sid));
    res.json(await childView(kid, viewer));
  }));
  /** A family reads a teacher's thread: marks it read. */
  app.post("/api/family/child/:sid/read/:tid", linkOrAuth, handle(async (req, res) => {
    const { kid } = await familyChild(req, Number(req.params.sid));
    const tid = Number(req.params.tid);
    if (!(await teachersFor(kid)).some((t) => t.id === tid)) throw fail(404, "That teacher isn't on this page.");
    await update<Thread>(K.thread(tid, kid.id), () => ({ studentId: kid.id, teacherId: tid, messages: [], teacherRead: "", familyRead: "" }), (x) => ({ ...x, familyRead: iso() }));
    res.json({ ok: true });
  }));
  app.post("/api/family/child/:sid/messages/:tid", linkOrAuth, handle(async (req, res) => {
    const { kid, viewer } = await familyChild(req, Number(req.params.sid));
    const tid = Number(req.params.tid);
    const t = (await teachersFor(kid)).find((x) => x.id === tid); if (!t) throw fail(404, "That teacher isn't on this page.");
    const body = text(req.body?.body, 2000); if (!body) throw fail(400, "Write a message.");
    let authorName = "";
    if (viewer.kind === "family" && viewer.parentId) authorName = (await dir.user(viewer.parentId))?.displayName || "Parent";
    else { authorName = text(req.body?.name, 60).replace(/\s+/g, " "); if (!authorName) throw fail(400, "Add your name so the teacher knows who's writing."); }
    const msg: Message = { id: randomUUID(), from: "family", authorId: viewer.kind === "family" ? viewer.parentId : null, authorName: `${authorName} (${first(kid.displayName)}'s family)`, body, at: iso() };
    const th = await update<Thread>(K.thread(tid, kid.id), () => ({ studentId: kid.id, teacherId: tid, messages: [], teacherRead: "", familyRead: "" }), (x) => ({ ...x, messages: [...x.messages, msg].slice(-MAX_MESSAGES), familyRead: msg.at }));
    if (dir.notify) { try { await dir.notify(tid, { title: `Message about ${first(kid.displayName)}`, body: `${authorName}: ${body.slice(0, 140)}`, url: "/#/workhub?go=wall" }); } catch { /* no device */ } }
    res.json({ messages: th.messages.slice(-100) });
  }));

  /** A wall photo, for anyone who may see its post. */
  app.get("/api/records/photo/:tid/:name", linkOrAuth, handle(async (req, res) => {
    const tid = Number(req.params.tid), name = String(req.params.name);
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(name)) throw fail(404, "No such picture.");
    const posts = await getWall(tid);
    const post = posts.find((p) => p.photos.includes(name));
    // A teacher sees their own uploads (even before posting); everyone else needs a post that shows it to them.
    const link = String(req.headers["x-family-link"] || req.query.link || "");
    let ok = false;
    if (link) { try { const { kid } = await familyChild(req, 0); ok = !!post && seesPost(post, kid.id) && (await getShare(tid)).parents.wall; } catch { ok = false; } }
    else {
      const u = await me(req);
      if (u.id === tid) ok = true;
      else if (post && u.role === "parent") { const kids = await dir.childrenOf(u.id); ok = kids.some((k) => seesPost(post, k)) && (await getShare(tid)).parents.wall; }
      else if (post && isStaff(u)) { const t = await dir.user(tid); ok = !!t && t.schoolId != null && t.schoolId === u.schoolId && (u.role === "admin" || (await getShare(tid)).staff.wall); }
    }
    if (!ok) throw fail(404, "No such picture.");
    const f = await files.get(`wall/${tid}/${name}`); if (!f) throw fail(404, "No such picture.");
    res.setHeader("Content-Type", f.type); res.setHeader("Cache-Control", "private, max-age=86400"); res.end(f.data);
  }));

  /* ================================================================ staff and admins */

  /** One student, for other staff at the school (what each teacher shares with staff) and admins (everything). */
  app.get("/api/records/student/:sid", auth, handle(async (req, res) => {
    const u = await teacher(req);
    const kid = await dir.user(Number(req.params.sid));
    if (!kid || kid.role !== "student" || kid.archived) throw fail(404, "No such student.");
    if (u.role !== "admin" && (kid.schoolId == null || kid.schoolId !== u.schoolId)) throw fail(404, "That student isn't at your school.");
    res.json(await childView(kid, u.role === "admin" ? { kind: "admin", user: u } : { kind: "staff", user: u }));
  }));

  /** Every student at the viewer's school, with their teachers, so staff can look one up. */
  app.get("/api/records/school/students", auth, handle(async (req, res) => {
    const u = await teacher(req);
    if (u.schoolId == null) return res.json({ students: [] });
    const staff = (await dir.staffOf(u.schoolId)).filter((t) => !t.archived);
    const seen = new Map<number, { id: number; name: string; teachers: string[] }>();
    for (const t of staff) for (const k of await myStudents(t)) {
      if (k.schoolId != null && k.schoolId !== u.schoolId) continue;
      const row = seen.get(k.id) ?? { id: k.id, name: k.displayName, teachers: [] };
      if (!row.teachers.includes(t.displayName)) row.teachers.push(t.displayName);
      seen.set(k.id, row);
    }
    res.json({ students: [...seen.values()].sort((a, b) => a.name.localeCompare(b.name)) });
  }));

  /** The admin's look over the school: each teacher's class at a glance. */
  app.get("/api/records/admin/overview", auth, handle(async (req, res) => {
    const u = await me(req); if (u.role !== "admin") throw fail(403, "Admins only.");
    const schoolId = u.schoolId ?? (Number(req.query.schoolId) || null);
    if (!schoolId) return res.json({ teachers: [], schoolId: null });
    const today = dayIn(now()), from = addDays(today, -30);
    const staff = (await dir.staffOf(schoolId)).filter((t) => !t.archived);
    const rows = await Promise.all(staff.map(async (t) => {
      const kids = await myStudents(t); if (!kids.length) return null;
      const ids = kids.map((k) => k.id);
      const [share, book, wall, months] = await Promise.all([getShare(t.id), getBook(t.id), getWall(t.id), Promise.all(monthsBetween(from, today).map(async (m) => ((await kv.get(K.att(t.id, m))) ?? {}) as AttendanceMonth))]);
      const att = attendanceSummary(months, ids, from, today);
      const rates = Object.values(att).map((a) => a.rate).filter((r): r is number => r !== null);
      const grades = kids.map((k) => studentGrade(book, k.id));
      const pcts = grades.map((g) => g.percent).filter((p): p is number => p !== null);
      const threads = await Promise.all(kids.map((k) => getThread(t.id, k.id)));
      return {
        teacher: { id: t.id, name: t.displayName }, students: kids.length, share,
        attendanceRate: rates.length ? Math.round((10 * rates.reduce((a, b) => a + b, 0)) / rates.length) / 10 : null,
        absences: Object.values(att).reduce((n, a) => n + a.absent, 0),
        gradeAverage: pcts.length ? Math.round((10 * pcts.reduce((a, b) => a + b, 0)) / pcts.length) / 10 : null,
        missing: grades.reduce((n, g) => n + g.missing.length, 0), assignments: book.assignments.length,
        posts: wall.filter((p) => p.createdAt >= `${from}T00:00:00`).length,
        familyMessages: threads.reduce((n, th) => n + th.messages.filter((m) => m.from === "family" && m.at >= `${from}T00:00:00`).length, 0),
        waiting: threads.reduce((n, th) => n + unreadFor(th, "teacher"), 0),
        links: (await Promise.all(ids.map((id) => kv.get(K.linkOf(id))))).filter((l) => l?.on).length,
      };
    }));
    res.json({ schoolId, from, teachers: rows.filter(Boolean).sort((a: any, b: any) => a.teacher.name.localeCompare(b.teacher.name)) });
  }));

  /** Admin: one teacher's students, to open any of them. */
  app.get("/api/records/admin/teacher/:tid", auth, handle(async (req, res) => {
    const u = await me(req); if (u.role !== "admin") throw fail(403, "Admins only.");
    const t = await dir.user(Number(req.params.tid)); if (!t || !isStaff(t)) throw fail(404, "No such teacher.");
    if (u.schoolId != null && t.schoolId !== u.schoolId) throw fail(404, "That teacher isn't at your school.");
    res.json({ students: (await myStudents(t)).map((k) => ({ id: k.id, name: k.displayName })) });
  }));
}



/** Wall photos in their own private Supabase Storage bucket. Only this server reads them, for the right people. */
export function createSupabaseRecordFiles(): RecordFiles {
  const BUCKET = "class-wall";
  let ready: Promise<unknown> | null = null;
  const st = async () => { const s = (await import("./supabase")).getAdminSupabase().storage; await (ready ??= s.createBucket(BUCKET, { public: false, fileSizeLimit: "8MB" }).catch(() => null)); return s.from(BUCKET); };
  return {
    async put(p, data, type) { const r = await (await st()).upload(p, data, { contentType: type, upsert: true }); if (r.error) throw r.error; },
    async get(p) { const r = await (await st()).download(p).catch(() => ({ data: null })); return r.data ? { data: Buffer.from(await r.data.arrayBuffer()), type: r.data.type || "image/jpeg" } : null; },
    async del(ps) { if (ps.length) await (await st()).remove(ps).catch(() => null); },
  };
}
