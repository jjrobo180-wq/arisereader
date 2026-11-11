// Cooked workout circles (shared/fitCircle.ts explains what they are). Kept as small JSON records
// in the settings table (server/fitKv.ts), so no new table is needed:
//   fit_circle_<ownerId>        { code, members: [ids] }   a circle, under the person who started it
//   fit_circle_member_<id>      { owner }                  someone who joined a circle
//   fit_circle_code_<CODE>      { owner }                  which circle an invite code opens
//   fit_circle_cheers_<id>      [Cheer]                    the last cheers and nudges sent to someone
// Everyone has their own full account. Anyone in a circle can share its code; the person who
// started it can remove people, and when they leave, the circle passes to the next person in it.
// Routes (all signed in):
//   GET  /api/fit/circle           my circle: everyone's training, the invite code, cheers to me
//   POST /api/fit/circle/invite    the circle's invite code (made the first time; {fresh:true} replaces it)
//   POST /api/fit/circle/join      {code} join a circle
//   POST /api/fit/circle/leave     leave my circle
//   POST /api/fit/circle/remove    {id} the person who started it removes someone
//   POST /api/fit/circle/cheer     {to, kind} a cheer or nudge (with a notification)
// When someone in a circle saves a new workout, the others get a notification (server/fit.ts calls tell).
import type { Express, RequestHandler } from "express";
import { CHEERS, MAX_CIRCLE, cleanCode, makeCode, memberStats, newWorkouts, type Cheer, type CheerKind, type Member } from "../shared/fitCircle";
import { cleanFit, type FitData } from "../shared/fit";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import type { FitKv } from "./fitKv";

type Circle = { code: string; members: number[] };
const K = { circle: (id: number) => `fit_circle_${id}`, member: (id: number) => `fit_circle_member_${id}`, code: (c: string) => `fit_circle_code_${c}`, cheers: (id: number) => `fit_circle_cheers_${id}` };

export type CircleDeps = {
  kv: FitKv;
  getData: (userId: number) => Promise<unknown | null>;
  nameOf?: (userId: number) => Promise<string>;
  notify?: (userId: number, m: { title: string; body: string; url: string; tag?: string }) => Promise<unknown>;
};

export function createCircles(deps: CircleDeps) {
  const { kv } = deps;
  const nameOf = async (id: number) => ((await deps.nameOf?.(id).catch(() => "")) || "Someone").slice(0, 40);
  const notify = deps.notify ?? (async (userId: number, m: any) => { try { const { notifyUser } = await import("./pushNotifications"); await notifyUser(userId, m); } catch { /* notifications are a bonus */ } });
  const circleOf = async (id: number): Promise<Circle | null> => { const c = await kv.get(K.circle(id)); return c && Array.isArray(c.members) ? c : null; };
  /** My circle: who started it, everyone else in it, and whether it's mine. null when I'm in none. */
  const groupOf = async (me: number): Promise<{ owner: number; members: number[]; code: string } | null> => {
    const mine = await circleOf(me);
    if (mine?.members.length) return { owner: me, members: mine.members, code: mine.code };
    const m = await kv.get(K.member(me));
    if (m?.owner) {
      const c = await circleOf(Number(m.owner));
      if (c?.members.includes(me)) return { owner: Number(m.owner), members: c.members, code: c.code };
      await kv.set(K.member(me), null); // the circle ended or they were removed
    }
    return null;
  };
  /** Makes (or replaces) the invite code of the circle `owner` started. */
  const newCode = async (owner: number, c: Circle) => {
    if (c.code) await kv.set(K.code(c.code), null);
    let code = makeCode();
    for (let i = 0; i < 5 && (await kv.get(K.code(code))); i++) code = makeCode();
    await kv.set(K.code(code), { owner });
    await kv.set(K.circle(owner), { ...c, code });
    return code;
  };
  return {
    groupOf,
    async view(me: number) {
      const g = await groupOf(me);
      const ids = g ? [g.owner, ...g.members] : [];
      const members: Member[] = await Promise.all(ids.map(async (id) => {
        const raw = await deps.getData(id).catch(() => null);
        return { id, name: await nameOf(id), owner: id === g!.owner, me: id === me, stats: raw ? memberStats(cleanFit(raw) as FitData) : null };
      }));
      const cheers: Cheer[] = ((await kv.get(K.cheers(me))) ?? []).slice(-12).reverse();
      // Not in a circle yet: the code they made to start one, if any.
      const code = g?.code ?? (await circleOf(me))?.code ?? null;
      return { inCircle: !!g, owner: g ? g.owner === me : false, code, max: MAX_CIRCLE, members, cheers };
    },
    async invite(me: number, fresh = false) {
      const g = await groupOf(me);
      if (g && g.owner !== me) {
        if (fresh) return { error: 403, message: "Only the person who started the circle can change its code." };
        return { code: g.code };
      }
      const c = (await circleOf(me)) ?? { code: "", members: [] };
      if (c.code && !fresh) return { code: c.code };
      return { code: await newCode(me, c) };
    },
    async join(me: number, rawCode: unknown) {
      const code = cleanCode(rawCode);
      const at = code ? (await kv.get(K.code(code)))?.owner : null;
      if (!at) return { error: 404, message: "That invite code doesn't work. Check it, or ask your friend for a new one." };
      const owner = Number(at);
      const c = await circleOf(owner);
      if (!c || c.code !== code) return { error: 404, message: "That invite code doesn't work anymore. Ask your friend for a new one." };
      if (owner === me) return { error: 400, message: "That's your own circle's code. Send it to a friend." };
      const now = await groupOf(me);
      if (now && now.owner === owner) return { ok: true };
      if (now) return { error: 409, message: `You're already in ${now.owner === me ? "your own" : `${await nameOf(now.owner)}'s`} circle. Leave it first to join this one.` };
      if (c.members.length + 1 >= MAX_CIRCLE) return { error: 409, message: `That circle is full (${MAX_CIRCLE} people).` };
      // Someone who made a code but had no one join yet: that empty circle goes away.
      const mine = await circleOf(me);
      if (mine) { if (mine.code) await kv.set(K.code(mine.code), null); await kv.set(K.circle(me), null); }
      await kv.set(K.circle(owner), { ...c, members: [...c.members, me] });
      await kv.set(K.member(me), { owner });
      const who = await nameOf(me);
      for (const id of [owner, ...c.members]) void notify(id, { title: "Your workout circle grew", body: `${who} joined your circle.`, url: "#/fit", tag: `fit-circle-${owner}` });
      return { ok: true };
    },
    async leave(me: number) {
      const g = await groupOf(me);
      if (!g) return { ok: true };
      if (g.owner !== me) {
        const c = await circleOf(g.owner);
        if (c) await kv.set(K.circle(g.owner), { ...c, members: c.members.filter((x) => x !== me) });
        await kv.set(K.member(me), null);
        return { ok: true };
      }
      // The person who started it leaves: the circle carries on under the next person in it.
      const [next, ...rest] = g.members;
      await kv.set(K.circle(me), null);
      await kv.set(K.member(next), null);
      await kv.set(K.circle(next), { code: g.code, members: rest });
      await kv.set(K.code(g.code), { owner: next });
      for (const id of rest) await kv.set(K.member(id), { owner: next });
      return { ok: true };
    },
    async remove(me: number, who: number) {
      const c = await circleOf(me);
      if (!c?.members.includes(who)) return { error: 404, message: "Only the person who started the circle can remove people." };
      await kv.set(K.circle(me), { ...c, members: c.members.filter((x) => x !== who) });
      await kv.set(K.member(who), null);
      return { ok: true };
    },
    async cheer(me: number, to: number, kind: CheerKind) {
      const g = await groupOf(me);
      if (!g || to === me || ![g.owner, ...g.members].includes(to)) return { error: 404, message: "That person isn't in your circle." };
      const name = await nameOf(me);
      const list: Cheer[] = (await kv.get(K.cheers(to))) ?? [];
      await kv.set(K.cheers(to), [...list, { from: me, name, kind, at: Date.now() }].slice(-30));
      void notify(to, { title: `${CHEERS[kind].e} ${name}`, body: CHEERS[kind].body(name), url: "#/fit", tag: `fit-cheer-${me}` });
      return { ok: true };
    },
    /** After someone saves: tell their circle about a workout they just finished. */
    async tell(me: number, before: Pick<FitData, "workouts"> | null, after: Pick<FitData, "workouts">) {
      const fresh = newWorkouts(before, after);
      if (!fresh.length) return 0;
      const g = await groupOf(me);
      if (!g) return 0;
      const w = fresh[fresh.length - 1];
      const name = await nameOf(me);
      const others = [g.owner, ...g.members].filter((x) => x !== me);
      for (const id of others) void notify(id, { title: `${name} just trained`, body: `${w.name} · ${Math.max(1, Math.round(w.secs / 60))} min. Send a cheer!`, url: "#/fit", tag: `fit-done-${me}` });
      return others.length;
    },
  };
}

export function registerCircleRoutes(app: Express, auth: RequestHandler, deps: CircleDeps) {
  const c = createCircles(deps);
  const limit = createAttemptLimiter({ max: 40, windowMs: 60 * 60_000 });
  const send = (res: any, r: any) => (r?.error ? res.status(r.error).json({ message: r.message }) : res.json(r));
  const wrap = (fn: (me: number, req: any) => Promise<any>, limited = false) => async (req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    const me = Number(req.user?.id);
    if (limited) {
      const wait = limit.retryAfter(String(me));
      if (wait) return res.status(429).json({ message: `Slow down a little. Try again in ${waitWords(wait)}.` });
      limit.fail(String(me));
    }
    try { return send(res, await fn(me, req)); }
    catch (e: any) { console.error("[fit] circle", e?.message); return res.status(503).json({ message: "Your circle can't be reached right now. Try again in a moment." }); }
  };
  app.get("/api/fit/circle", auth, wrap((me) => c.view(me)));
  app.post("/api/fit/circle/invite", auth, wrap((me, req) => c.invite(me, req.body?.fresh === true), true));
  app.post("/api/fit/circle/join", auth, wrap((me, req) => c.join(me, req.body?.code), true));
  app.post("/api/fit/circle/leave", auth, wrap((me) => c.leave(me)));
  app.post("/api/fit/circle/remove", auth, wrap((me, req) => c.remove(me, Number(req.body?.id))));
  app.post("/api/fit/circle/cheer", auth, wrap((me, req) => c.cheer(me, Number(req.body?.to), (req.body?.kind in CHEERS ? req.body.kind : "cheer") as CheerKind), true));
  return c;
}
