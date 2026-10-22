// Class Goal Board: saving and sharing a teacher's class goals.
//
// One saved copy per account (a row in `settings`, key class_goals_<id>). The teacher's phone, laptop
// and the classroom board all read that same copy, so a phone can add points while the board shows them.
//
//   GET  /api/class-goals            the goals (pass ?rev=N to skip the download when nothing changed)
//   POST /api/class-goals/ops        { ops: [...] } changes, applied in order with shared/classGoals.ts
//
// Changes are applied here, one account at a time, on the latest saved copy, so two devices adding
// points at once both count, and a change sent twice counts once.
import type { Express, RequestHandler } from "express";
import { applyOp, cleanClassGoals, emptyClassGoals, isId, type ClassGoals, type Op } from "../shared/classGoals";

export const MAX_OPS_PER_REQUEST = 60;
export const classGoalsKey = (userId: number | string) => `class_goals_${userId}`;

export type ClassGoalsDeps = {
  /** Reads a saved value, and throws if the database can't be read (an unread copy must never be saved over). */
  readSetting: (key: string) => Promise<string>;
  upsertSetting: (key: string, value: string) => Promise<void>;
  now?: () => number;
};

/** Who may use it: any adult account. Students, and the admin's "see it as a student" preview, may not. */
export const mayUseClassGoals = (user: any) => !!user && (user.isAdmin === true || user.role === "teacher" || user.role === "parent" || user.role === "todo");

/** How long a board's polling can be answered from memory. Every change made through this server updates it at once. */
export const READ_CACHE_MS = 3000;

export function createClassGoalsStore(deps: ClassGoalsDeps) {
  const queues = new Map<string, Promise<unknown>>();
  const recent = new Map<string, { state: ClassGoals; at: number }>();
  const clock = () => (deps.now ?? Date.now)();
  const remember = (userId: number | string, state: ClassGoals) => {
    if (recent.size > 500) for (const [k, v] of Array.from(recent)) if (clock() - v.at > READ_CACHE_MS) recent.delete(k);
    recent.set(String(userId), { state, at: clock() });
  };
  /** Runs `job` after every earlier job for the same account has finished. */
  function inOrder<T>(key: string, job: () => Promise<T>): Promise<T> {
    const run = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(job);
    const tail = run.catch(() => undefined);
    queues.set(key, tail);
    tail.then(() => { if (queues.get(key) === tail) queues.delete(key); });
    return run;
  }
  async function load(userId: number | string): Promise<ClassGoals> {
    const raw = await deps.readSetting(classGoalsKey(userId));
    return raw ? cleanClassGoals(raw) : emptyClassGoals();
  }
  return {
    /** The saved goals. A classroom board asks every few seconds, so a recent copy is reused. */
    async read(userId: number | string): Promise<ClassGoals> {
      const hit = recent.get(String(userId));
      if (hit && clock() - hit.at < READ_CACHE_MS) return hit.state;
      const state = await load(userId);
      remember(userId, state);
      return state;
    },
    /** Applies the changes in order and saves once, when something changed. */
    apply(userId: number | string, ops: Op[], now: () => number = Date.now): Promise<{ state: ClassGoals; changed: number }> {
      return inOrder(String(userId), async () => {
        let state = await load(userId);
        let changed = 0;
        for (const op of ops) {
          const next = applyOp(state, { ...op, at: validTime(op.at, now) });
          if (next !== state) { state = next; changed++; }
        }
        if (changed) { await deps.upsertSetting(classGoalsKey(userId), JSON.stringify(state)); }
        remember(userId, state);
        return { state, changed };
      });
    },
  };
}

/** A phone's clock can be wrong: a time from the future (or far past) is replaced with the server's. */
function validTime(at: unknown, now: () => number): string {
  const t = typeof at === "string" ? Date.parse(at) : NaN;
  const n = now();
  return Number.isFinite(t) && t <= n + 5 * 60_000 && t >= n - 30 * 86_400_000 ? new Date(t).toISOString() : new Date(n).toISOString();
}

export function registerClassGoalRoutes(app: Express, auth: RequestHandler, deps: ClassGoalsDeps) {
  const store = createClassGoalsStore(deps);
  const now = deps.now ?? Date.now;
  const fail = (res: any, e: any) => { console.error("[class-goals]", e?.message || e); res.status(500).json({ message: "Couldn't reach your saved goals. Try again." }); };
  const guard = (req: any, res: any) => {
    if (mayUseClassGoals(req.user)) return true;
    res.status(403).json({ message: "Class goals are for teachers and other adult accounts." });
    return false;
  };

  app.get("/api/class-goals", auth, async (req: any, res: any) => {
    if (!guard(req, res)) return;
    try {
      const state = await store.read(req.user.id);
      res.set("Cache-Control", "no-store");
      const known = req.query?.rev === undefined ? NaN : Number(req.query.rev);
      if (Number.isFinite(known) && known === state.rev) return res.json({ unchanged: true, rev: state.rev });
      res.json({ state });
    } catch (e) { fail(res, e); }
  });

  app.post("/api/class-goals/ops", auth, async (req: any, res: any) => {
    if (!guard(req, res)) return;
    const raw = req.body?.ops;
    if (!Array.isArray(raw) || !raw.length) return res.status(400).json({ message: "Nothing to change." });
    if (raw.length > MAX_OPS_PER_REQUEST) return res.status(400).json({ message: "Too many changes at once." });
    const ops = raw.filter((o: any) => o && typeof o === "object" && typeof o.type === "string" && isId(o.opId)) as Op[];
    try {
      const { state, changed } = await store.apply(req.user.id, ops, now);
      res.set("Cache-Control", "no-store");
      res.json({ state, changed });
    } catch (e) { fail(res, e); }
  });
}
