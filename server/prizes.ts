// Prizes — server. A parent puts up a prize for their own children; a teacher
// puts one up for their class or their whole school. A.R.I.S.E. gives no prizes
// itself, so everything here is written by the grown-up who will hand it over.
// Storage is the settings table, passed in, so there is no database migration
// and the whole thing runs in tests.
import type { Express, RequestHandler } from "express";
import { randomBytes } from "node:crypto";
import { clubDay } from "../shared/clubPlay";
import {
  PRIZE_LIMITS, PrizeError, addDays, givenDay, normalizePrizeDraft, parsePrizeId, prizeCovers, prizeEnded, prizeId, prizeShown,
  quizzesToward, validDay, viewPrize,
  type Prize, type PrizeScope, type PrizeView,
} from "../shared/prizes";

type AnyUser = {
  id: number; displayName?: string; username?: string; role?: string | null; isAdmin?: boolean;
  teacherId?: number | null; school_id?: number | null; schoolId?: number | null;
  accountApproved?: boolean; approvedByTeacher?: boolean;
};
export type PrizePerson = { id: number; name: string };

export type PrizeDeps = {
  getSetting(key: string): Promise<string>;
  upsertSetting(key: string, value: string): Promise<void>;
  /**
   * The same read, but it throws when the database can't be reached. Used before every save:
   * a failed read must never look like an empty list, or the save would wipe the real one.
   * Left out, getSetting is used.
   */
  readSetting?(key: string): Promise<string>;
  /** The children linked to a parent. */
  parentStudentIds(parentId: number): Promise<number[]>;
  /** The parents linked to a student. */
  studentParentIds(studentId: number): Promise<number[]>;
  getUser(id: number): Promise<AnyUser | null | undefined>;
  /** The students a teacher has approved into their class. */
  teacherStudents(teacherId: number): Promise<PrizePerson[]>;
  schoolStudents(schoolId: number): Promise<PrizePerson[]>;
  schoolName(schoolId: number): Promise<string>;
  /** When this student passed each library quiz (milliseconds). */
  passedQuizTimes(studentId: number): Promise<number[]>;
  /** Tells a student they won. Left out, nobody is told. */
  notify?(studentId: number, text: string): Promise<void>;
  now?: () => number;
};

/** What the person who added a prize sees. */
export type OwnedPrize = Prize & {
  state: "open" | "ended" | "given";
  /** Reads after the word "For": "Ada and Ben", "your class", "everyone at Cedar Grove Middle". */
  forWho: string;
  /** Family prizes with a quiz goal: how each child is doing. */
  progress?: Array<PrizePerson & { passed: number }>;
};

// Never 401 or 503 here: the app retries those for several seconds before showing the message.
class Refused extends Error { constructor(message: string, readonly status = 400) { super(message); } }

const KEY: Record<PrizeScope, (ownerId: number) => string> = {
  family: (id) => `prizes_parent_${id}`,
  class: (id) => `prizes_teacher_${id}`,
  school: (id) => `prizes_school_${id}`,
};
/** Finished prizes are cleared out of a list this many days after they ended or were given. */
const KEEP_DAYS = 120;
/** Above this class size the "who is close" counts are skipped: each one is a database read. */
const COUNT_UP_TO = 60;

const posInt = (v: unknown) => { const n = Number(v); return Number.isSafeInteger(n) && n > 0 ? n : 0; };
const schoolOf = (u: AnyUser | null | undefined) => posInt(u?.school_id ?? u?.schoolId) || null;
const nameOf = (u: AnyUser | null | undefined) => String(u?.displayName || u?.username || "").replace(/\s+/g, " ").trim().slice(0, 40);
const isTeacher = (u: AnyUser) => !!(u.isAdmin || u.role === "teacher");
const isParent = (u: AnyUser) => !u.isAdmin && u.role === "parent";
const isStudent = (u: AnyUser) => !u.isAdmin && (u.role || "student") === "student";
const listNames = (names: string[]) => (names.length <= 1 ? names[0] || "" : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

function looksLikePrize(p: any): p is Prize {
  return !!p && typeof p === "object" && typeof p.id === "string" && typeof p.title === "string" && typeof p.createdAt === "string"
    && (p.scope === "family" || p.scope === "class" || p.scope === "school") && posInt(p.ownerId) > 0;
}

export function registerPrizeRoutes(app: Express, auth: RequestHandler, deps: PrizeDeps) {
  const now = () => (deps.now ? deps.now() : Date.now());
  const today = () => clubDay(now());

  // ─── Storage ───────────────────────────────────────────────────────────────
  const parse = (raw: string): Prize[] => {
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(looksLikePrize) : [];
  };
  /** For showing prizes. Anything that goes wrong reads as "no prizes". */
  async function readList(scope: PrizeScope, ownerId: number): Promise<Prize[]> {
    try { return parse(await deps.getSetting(KEY[scope](ownerId))); } catch { return []; }
  }
  /** For changing prizes. A database error stops the change instead of reading as an empty list. */
  async function readForSave(scope: PrizeScope, ownerId: number): Promise<Prize[]> {
    const raw = await (deps.readSetting ?? deps.getSetting)(KEY[scope](ownerId));
    try { return parse(raw); } catch { return []; }
  }
  const capFor = (scope: PrizeScope) => (scope === "family" ? PRIZE_LIMITS.perFamily : scope === "class" ? PRIZE_LIMITS.perClass : PRIZE_LIMITS.perSchool);
  /**
   * Saves a list. With `tidy`, prizes that finished long ago are cleared out first
   * (only when a prize is added, so taking a prize back can never make it vanish).
   */
  async function writeList(scope: PrizeScope, ownerId: number, list: Prize[], tidy = false) {
    let kept = list;
    if (tidy) {
      const day = today();
      kept = list.filter((p) => {
        const done = p.won ? givenDay(p.won) : p.endsOn;
        return !done || !validDay(done) || day <= addDays(done, KEEP_DAYS);
      });
      // a hard ceiling on what is stored: everything readers still see, then the newest of the rest
      const most = capFor(scope) * 3;
      if (kept.length > most) {
        const shown = kept.filter((p) => prizeShown(p, day));
        const rest = kept.filter((p) => !prizeShown(p, day)).slice(0, Math.max(0, most - shown.length));
        kept = kept.filter((p) => shown.includes(p) || rest.includes(p));
      }
    }
    await deps.upsertSetting(KEY[scope](ownerId), JSON.stringify(kept));
    return kept;
  }
  /**
   * A prize holds a place until it leaves the readers' page (two weeks after it ends or is given),
   * so the cap is also the most tickets a reader can be shown from one family, class or school.
   */
  function checkRoom(scope: PrizeScope, list: Prize[], u: AnyUser) {
    const day = today();
    const up = list.filter((p) => prizeShown(p, day));
    const cap = capFor(scope);
    if (up.length >= cap) throw new Refused(`That's the most prizes that can be up at once (${cap}). Remove one first.`, 409);
    if (scope === "school" && !u.isAdmin && up.filter((p) => p.byId === u.id).length >= PRIZE_LIMITS.perTeacherAtSchool) {
      throw new Refused(`You have ${PRIZE_LIMITS.perTeacherAtSchool} school prizes up already. Remove one first.`, 409);
    }
  }
  // one change at a time per list, so two saves can't overwrite each other
  const locks = new Map<string, Promise<unknown>>();
  function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const next = (locks.get(key) ?? Promise.resolve()).then(fn, fn);
    const settled = next.catch(() => undefined);
    locks.set(key, settled);
    void settled.then(() => { if (locks.get(key) === settled) locks.delete(key); });
    return next;
  }

  const wrap = (handler: (req: any, res: any) => Promise<void> | void): RequestHandler => async (req: any, res: any) => {
    try { res.set("Cache-Control", "no-store"); await handler(req, res); }
    catch (e: any) {
      if (e instanceof Refused) return void res.status(e.status).json({ message: e.message });
      if (e instanceof PrizeError) return void res.status(400).json({ message: e.message });
      console.error("[prizes]", req.method, req.path, e?.message || e);
      res.status(500).json({ message: "Something went wrong with prizes. Try again." });
    }
  };

  // ─── Who is who ────────────────────────────────────────────────────────────
  async function childrenOf(parentId: number): Promise<PrizePerson[]> {
    const ids = await deps.parentStudentIds(parentId);
    const users = await Promise.all(ids.map((id) => deps.getUser(id).catch(() => null)));
    return users.filter((u): u is AnyUser => !!u).map((u) => ({ id: u.id, name: nameOf(u) || "Reader" }));
  }
  const passedTimes = (studentId: number) => deps.passedQuizTimes(studentId).catch(() => [] as number[]);

  /** Everyone a prize can be given to. */
  async function peopleFor(prize: Prize): Promise<PrizePerson[]> {
    if (prize.scope === "family") return (await childrenOf(prize.ownerId)).filter((c) => prizeCovers(prize, c.id));
    if (prize.scope === "class") return deps.teacherStudents(prize.ownerId);
    return deps.schoolStudents(prize.ownerId);
  }

  function mayManage(u: AnyUser, prize: Prize): boolean {
    if (prize.scope === "family") return isParent(u) && prize.ownerId === u.id;
    if (prize.scope === "class") return isTeacher(u) && prize.ownerId === u.id;
    return !!u.isAdmin || (u.role === "teacher" && prize.byId === u.id && schoolOf(u) === prize.ownerId);
  }
  function mustBeGiver(u: AnyUser) {
    if (!u || (!isParent(u) && !isTeacher(u))) throw new Refused("Prizes are added by parents and teachers.", 403);
    if (!u.isAdmin && u.accountApproved === false) throw new Refused("Your account has to be approved before you can add prizes.", 403);
  }

  // ─── What a reader can win ─────────────────────────────────────────────────
  /** `onlyParentId`: a parent looking at their child sees their own family prizes, not another parent's. */
  async function prizesFor(student: AnyUser, onlyParentId?: number): Promise<PrizeView[]> {
    const day = today();
    const inClass = posInt(student.teacherId) > 0 && student.approvedByTeacher !== false;
    // School prizes come through the teacher who approved the student, the same way Premium does.
    // The school a student picked at sign-up is only their own say-so.
    const [parentIds, teacher] = await Promise.all([
      deps.studentParentIds(student.id).catch(() => [] as number[]),
      inClass ? deps.getUser(posInt(student.teacherId)).catch(() => null) : Promise.resolve(null),
    ]);
    const schoolId = teacher && teacher.accountApproved !== false ? schoolOf(teacher) : null;

    const [family, klass, school, schoolName] = await Promise.all([
      Promise.all(parentIds.filter((id) => !onlyParentId || id === onlyParentId).map((id) => readList("family", id)))
        .then((lists) => lists.flat().filter((p) => prizeCovers(p, student.id))),
      inClass ? readList("class", posInt(student.teacherId)) : Promise.resolve([] as Prize[]),
      schoolId ? readList("school", schoolId) : Promise.resolve([] as Prize[]),
      schoolId ? deps.schoolName(schoolId).catch(() => "") : Promise.resolve(""),
    ]);
    const shown = [...family, ...klass, ...school].filter((p) => prizeShown(p, day));
    if (!shown.length) return [];

    const times = shown.some((p) => p.quizGoal > 0 && !p.won) ? await passedTimes(student.id) : [];
    const views = shown.map((p) => {
      const from = p.scope === "school" && schoolName ? `${p.byName} at ${schoolName}` : p.byName;
      const passed = p.quizGoal > 0 ? quizzesToward(p, times, clubDay) : null;
      return viewPrize(p, student.id, from, passed, day);
    });
    const order: Record<PrizeView["state"], number> = { yours: 0, reached: 1, open: 2, ended: 3, won: 4 };
    return views.sort((a, b) => order[a.state] - order[b.state] || (a.endsOn || "9999").localeCompare(b.endsOn || "9999"));
  }

  app.get("/api/prizes", auth, wrap(async (req, res) => {
    const u: AnyUser = req.user;
    if (isParent(u)) {
      const childId = posInt(req.query?.studentId);
      if (u.accountApproved === false || !childId || !(await deps.parentStudentIds(u.id)).includes(childId)) return void res.json({ prizes: [] });
      const child = await deps.getUser(childId);
      return void res.json({ prizes: child ? await prizesFor(child, u.id) : [] });
    }
    res.json({ prizes: isStudent(u) ? await prizesFor(u) : [] });
  }));

  // ─── The giver's list ──────────────────────────────────────────────────────
  async function owned(prize: Prize, ctx: { children?: PrizePerson[]; schoolName?: string; times?: Map<number, number[]> }): Promise<OwnedPrize> {
    const state: OwnedPrize["state"] = prize.won ? "given" : prizeEnded(prize, today()) ? "ended" : "open";
    if (prize.scope === "family") {
      const covered = (ctx.children || []).filter((c) => prizeCovers(prize, c.id));
      const progress = prize.quizGoal > 0
        ? covered.map((c) => ({ ...c, passed: quizzesToward(prize, ctx.times?.get(c.id) || [], clubDay) }))
        : undefined;
      return { ...prize, state, forWho: listNames(covered.map((c) => c.name)) || "your children", progress };
    }
    return { ...prize, state, forWho: prize.scope === "class" ? "your class" : `everyone at ${ctx.schoolName || "your school"}` };
  }

  async function mine(u: AnyUser) {
    if (isParent(u)) {
      const [children, list] = await Promise.all([childrenOf(u.id), readList("family", u.id)]);
      const times = new Map<number, number[]>();
      if (list.some((p) => p.quizGoal > 0)) {
        await Promise.all(children.map(async (c) => { times.set(c.id, await passedTimes(c.id)); }));
      }
      const prizes = await Promise.all(list.map((p) => owned(p, { children, times })));
      return { role: "parent" as const, prizes, children, school: null, limits: PRIZE_LIMITS };
    }
    const schoolId = schoolOf(u);
    const [klass, school, schoolName] = await Promise.all([
      readList("class", u.id),
      schoolId ? readList("school", schoolId) : Promise.resolve([] as Prize[]),
      schoolId ? deps.schoolName(schoolId).catch(() => "") : Promise.resolve(""),
    ]);
    const list = [...klass, ...school.filter((p) => mayManage(u, p))];
    const prizes = await Promise.all(list.map((p) => owned(p, { schoolName })));
    return { role: "teacher" as const, prizes, children: [], school: schoolId ? { id: schoolId, name: schoolName || "Your school" } : null, limits: PRIZE_LIMITS };
  }

  app.get("/api/prizes/mine", auth, wrap(async (req, res) => {
    mustBeGiver(req.user);
    res.json(await mine(req.user));
  }));

  app.post("/api/prizes", auth, wrap(async (req, res) => {
    const u: AnyUser = req.user;
    mustBeGiver(u);
    const draft = normalizePrizeDraft(req.body, isParent(u) ? "parent" : "teacher", today());

    let ownerId = u.id;
    if (draft.scope === "family") {
      const children = await deps.parentStudentIds(u.id);
      if (!children.length) throw new Refused("Connect your child first, then you can add a prize for them.", 409);
      if (draft.studentIds && draft.studentIds.some((id) => !children.includes(id))) throw new Refused("That child isn't connected to your account.", 403);
      // picking every child is the same as "all my children", and then covers a child connected later
      if (draft.studentIds && children.every((id) => draft.studentIds!.includes(id))) draft.studentIds = null;
    } else if (draft.scope === "school") {
      const schoolId = schoolOf(u);
      if (!schoolId) throw new Refused("Your account isn't connected to a school yet, so this prize can only be for your class.", 409);
      ownerId = schoolId;
    }

    const key = KEY[draft.scope](ownerId);
    const prize = await withLock(key, async () => {
      const list = await readForSave(draft.scope, ownerId);
      checkRoom(draft.scope, list, u);
      const made: Prize = {
        id: prizeId(draft.scope, ownerId, `${now().toString(36)}${randomBytes(4).toString("hex")}`),
        scope: draft.scope, ownerId, byId: u.id, byName: nameOf(u) || (isParent(u) ? "Your parent" : "Your teacher"),
        title: draft.title, how: draft.how, quizGoal: draft.quizGoal, endsOn: draft.endsOn,
        studentIds: draft.scope === "family" ? draft.studentIds : null,
        createdAt: new Date(now()).toISOString(), won: null,
      };
      await writeList(draft.scope, ownerId, [made, ...list], true);
      return made;
    });
    // A family is a handful of children, so each one is told. A class or a school hears it from the teacher.
    if (prize.scope === "family" && deps.notify) {
      const kids = (await deps.parentStudentIds(u.id).catch(() => [] as number[])).filter((id) => prizeCovers(prize, id));
      const text = `${prize.byName} put up a prize for you: “${prize.title}”. See it on your rewards page.`;
      await Promise.all(kids.map((id) => deps.notify!(id, text).catch(() => undefined)));
    }
    res.status(201).json({ prize, ...(await mine(u)) });
  }));

  /** Finds a prize by id and checks this person may change it. */
  async function change(req: any, fn: (prize: Prize, list: Prize[]) => Promise<Prize[] | void> | Prize[] | void): Promise<void> {
    const u: AnyUser = req.user;
    mustBeGiver(u);
    const where = parsePrizeId(req.params.id);
    if (!where) throw new Refused("That prize wasn't found.", 404);
    await withLock(KEY[where.scope](where.ownerId), async () => {
      const list = await readForSave(where.scope, where.ownerId);
      const prize = list.find((p) => p.id === req.params.id);
      // the same answer whether it's missing or someone else's, so ids can't be probed
      if (!prize || !mayManage(u, prize)) throw new Refused("That prize wasn't found.", 404);
      const next = await fn(prize, list);
      await writeList(where.scope, where.ownerId, next || list);
    });
  }

  app.delete("/api/prizes/:id", auth, wrap(async (req, res) => {
    await change(req, (prize, list) => list.filter((p) => p.id !== prize.id));
    res.json(await mine(req.user));
  }));

  // Who a prize can be given to. For a quiz goal, how close each one is.
  app.get("/api/prizes/:id/people", auth, wrap(async (req, res) => {
    const u: AnyUser = req.user;
    mustBeGiver(u);
    const where = parsePrizeId(req.params.id);
    const prize = where ? (await readList(where.scope, where.ownerId)).find((p) => p.id === req.params.id) : null;
    if (!prize || !mayManage(u, prize)) throw new Refused("That prize wasn't found.", 404);
    const people = await peopleFor(prize);
    const counted = prize.quizGoal > 0 && prize.scope !== "school" && people.length <= COUNT_UP_TO;
    const rows = await Promise.all(people.map(async (p) => ({
      ...p, passed: counted ? quizzesToward(prize, await passedTimes(p.id), clubDay) : null,
    })));
    rows.sort((a, b) => (b.passed ?? 0) - (a.passed ?? 0) || a.name.localeCompare(b.name));
    res.json({ people: rows, counted });
  }));

  // Hand the prize to one reader, to everyone it was for, or take that back.
  app.post("/api/prizes/:id/give", auth, wrap(async (req, res) => {
    const body = req.body || {};
    const toTell: Array<{ id: number; text: string }> = [];
    await change(req, async (prize, list) => {
      if (body.undo) {
        // a prize given long ago has left the readers' page; putting it back up needs a free place
        if (prize.won && !prizeShown(prize, today())) checkRoom(prize.scope, list, req.user);
        prize.won = null;
        return;
      }
      const at = new Date(now()).toISOString(), day = today();
      const people = await peopleFor(prize);
      const text = `You won a prize: “${prize.title}”, from ${prize.byName}. Ask them how to collect it.`;
      if (body.everyone) {
        prize.won = { studentId: null, name: prize.scope === "family" ? listNames(people.map((p) => p.name)) || "Everyone" : prize.scope === "class" ? "The whole class" : "The whole school", at, day };
        // a family is a handful of children; a class or a school is told by the teacher
        if (prize.scope === "family") people.forEach((p) => toTell.push({ id: p.id, text }));
        return;
      }
      const winner = people.find((p) => p.id === posInt(body.studentId));
      if (!winner) throw new Refused(prize.scope === "family" ? "Pick one of your children." : prize.scope === "class" ? "Pick a student from your class." : "Pick a student from your school.", 400);
      prize.won = { studentId: winner.id, name: winner.name, at, day };
      toTell.push({ id: winner.id, text });
    });
    // telling the winner is a courtesy: the prize is saved either way
    if (deps.notify) await Promise.all(toTell.map((t) => deps.notify!(t.id, t.text).catch(() => undefined)));
    res.json(await mine(req.user));
  }));

  return { prizesFor };
}
