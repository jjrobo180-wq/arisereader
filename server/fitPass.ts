// Cooked Fitness by Arise Premium for each account, and the guest pass (shared/fitPlus.ts says what both are).
// Someone has Fit+ when they pay for it (or the admin gave it, server/plans.ts's fitPlusOwn), or when
// a person who pays shared their guest pass with them and still pays. Records in the settings table
// (server/fitKv.ts):
//   fit_pass_<ownerId>        { code, guest: id | null, since, freedAt }   a payer's pass
//   fit_pass_guest_<id>       { owner }                                   whose pass a guest has
//   fit_pass_code_<CODE>      { owner }                                   which pass a code opens
// Routes (all signed in):
//   GET  /api/fit/plus            do I have Fit+, why, and my guest pass
//   POST /api/fit/pass/code       the code for my pass (payers only; {fresh:true} replaces it)
//   POST /api/fit/pass/redeem     {code} use someone's guest pass
//   POST /api/fit/pass/end        a payer takes their pass back, or a guest gives it up
import type { Express, RequestHandler } from "express";
import { cleanCode, makeCode } from "../shared/fitCircle";
import { FIT_PLUS_PRICE, PASS_SWITCH_DAYS, PLUS_REQUIRED, freeStatus, type PlusStatus } from "../shared/fitPlus";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import type { FitKv } from "./fitKv";

export type OwnPlus = { live: boolean; admin?: boolean; grant?: { endsAt: string | null; source?: string; stripeCustomerId?: string; buyerId?: number } | null };
export type PassDeps = {
  kv: FitKv;
  /** This account's own Fit+ (paid or given), never counting a guest pass. */
  ownPlus: (userId: number) => Promise<OwnPlus>;
  payment?: () => Promise<boolean>;
  nameOf?: (userId: number) => Promise<string>;
  notify?: (userId: number, m: { title: string; body: string; url: string; tag?: string }) => Promise<unknown>;
  now?: () => number;
};
type Pass = { code: string; guest: number | null; since: string | null; freedAt: string | null };
const K = { pass: (id: number) => `fit_pass_${id}`, guest: (id: number) => `fit_pass_guest_${id}`, code: (c: string) => `fit_pass_code_${c}` };
const DAY = 864e5;

export function createPasses(deps: PassDeps) {
  const { kv } = deps;
  const now = deps.now ?? Date.now;
  const nameOf = async (id: number) => ((await deps.nameOf?.(id).catch(() => "")) || "A friend").slice(0, 40);
  const notify = deps.notify ?? (async (userId: number, m: any) => { try { const { notifyUser } = await import("./pushNotifications"); await notifyUser(userId, m); } catch { /* notifications are a bonus */ } });
  const own = async (id: number): Promise<OwnPlus> => { try { return await deps.ownPlus(id); } catch { return { live: false }; } };
  const passOf = async (id: number): Promise<Pass | null> => { const p = await kv.get(K.pass(id)); return p && typeof p.code === "string" ? { guest: null, since: null, freedAt: null, ...p } : null; };
  /** Whose pass I'm on, when it's still good (they still pay and still list me). */
  const hostOf = async (me: number): Promise<number | null> => {
    const g = await kv.get(K.guest(me));
    if (!g?.owner) return null;
    const owner = Number(g.owner);
    const p = await passOf(owner);
    if (p?.guest !== me) { await kv.set(K.guest(me), null); return null; }
    return (await own(owner)).live ? owner : null;
  };
  const switchAfter = (p: Pass | null) => {
    const t = p?.freedAt ? Date.parse(p.freedAt) + PASS_SWITCH_DAYS * DAY : NaN;
    return Number.isFinite(t) && t > now() ? new Date(t).toISOString() : null;
  };
  const free = async (owner: number, p: Pass) => {
    if (p.guest) await kv.set(K.guest(p.guest), null);
    await kv.set(K.pass(owner), { ...p, guest: null, since: null, freedAt: new Date(now()).toISOString() });
  };

  /** Does this person have Fit+, and why. */
  const plusOf = async (me: number): Promise<{ plus: boolean; via: PlusStatus["via"]; endsAt: string | null; owner: number | null; mine: OwnPlus }> => {
    const mine = await own(me);
    if (mine.live) return { plus: true, via: mine.admin ? "admin" : "plan", endsAt: mine.grant?.endsAt ?? null, owner: null, mine };
    const owner = await hostOf(me);
    if (owner) return { plus: true, via: "guest-pass", endsAt: (await own(owner)).grant?.endsAt ?? null, owner, mine };
    return { plus: false, via: null, endsAt: null, owner: null, mine };
  };

  return {
    plusOf,
    async status(me: number): Promise<PlusStatus> {
      const p = await plusOf(me);
      const s = freeStatus(deps.payment ? await deps.payment().catch(() => false) : false);
      s.plus = p.plus; s.via = p.via; s.endsAt = p.endsAt; s.price = FIT_PLUS_PRICE;
      s.canManage = !!(p.mine.grant?.stripeCustomerId && (!p.mine.grant.buyerId || p.mine.grant.buyerId === me));
      s.canGivePass = p.mine.live;
      if (p.mine.live) {
        const pass = await passOf(me);
        // A guest who has since bought Fit+ themselves no longer needs the pass: it's free again.
        if (pass?.guest && (await own(pass.guest)).live) await free(me, pass);
        const fresh = await passOf(me);
        s.pass = { role: "owner", code: fresh?.code ?? null, guest: fresh?.guest ? { id: fresh.guest, name: await nameOf(fresh.guest), since: fresh.since ?? "" } : null, owner: null, switchAfter: fresh?.guest ? null : switchAfter(fresh) };
      } else if (p.owner) {
        s.pass = { role: "guest", code: null, guest: null, owner: { id: p.owner, name: await nameOf(p.owner) }, switchAfter: null };
      }
      return s;
    },
    async code(me: number, fresh = false) {
      if (!(await own(me)).live) return { error: 403, message: "Guest passes come with your own Cooked Fitness by Arise Premium plan. A guest pass can't be shared again." };
      const p = (await passOf(me)) ?? { code: "", guest: null, since: null, freedAt: null };
      if (p.code && !fresh) return { code: p.code };
      if (p.code) await kv.set(K.code(p.code), null);
      let code = makeCode();
      for (let i = 0; i < 5 && (await kv.get(K.code(code))); i++) code = makeCode();
      await kv.set(K.code(code), { owner: me });
      await kv.set(K.pass(me), { ...p, code });
      return { code };
    },
    async redeem(me: number, raw: unknown) {
      const code = cleanCode(raw);
      const at = code ? (await kv.get(K.code(code)))?.owner : null;
      if (!at) return { error: 404, message: "That guest pass code doesn't work. Check it, or ask for a new one." };
      const owner = Number(at);
      const p = await passOf(owner);
      if (!p || p.code !== code) return { error: 404, message: "That guest pass code doesn't work anymore. Ask for a new one." };
      if (owner === me) return { error: 400, message: "That's your own guest pass. Send it to a friend or family member." };
      if ((await own(me)).live) return { error: 409, message: "You already have Cooked Fitness by Arise Premium yourself, so you don't need a guest pass." };
      if (!(await own(owner)).live) return { error: 409, message: `${await nameOf(owner)}'s Cooked Fitness by Arise Premium isn't active, so their guest pass isn't either.` };
      if (p.guest === me) return { ok: true };
      if (p.guest) return { error: 409, message: `${await nameOf(owner)} has already shared their guest pass. Each Fit+ member can share with one person.` };
      const wait = switchAfter(p);
      if (wait) return { error: 409, message: `This guest pass can go to someone new on ${new Date(wait).toLocaleDateString("en-US", { month: "long", day: "numeric" })}. Guest passes can change hands once every ${PASS_SWITCH_DAYS} days.` };
      const host = await hostOf(me);
      if (host) return { error: 409, message: `You already have ${await nameOf(host)}'s guest pass. Give it up first to use this one.` };
      await kv.set(K.pass(owner), { ...p, guest: me, since: new Date(now()).toISOString() });
      await kv.set(K.guest(me), { owner });
      void notify(owner, { title: "Guest pass used", body: `${await nameOf(me)} now has Cooked Fitness by Arise Premium with your guest pass.`, url: "#/fit", tag: `fit-pass-${owner}` });
      return { ok: true };
    },
    async end(me: number) {
      const mine = await passOf(me);
      if (mine?.guest) {
        const guest = mine.guest;
        await free(me, mine);
        void notify(guest, { title: "Guest pass ended", body: `${await nameOf(me)} took back their Cooked Fitness by Arise Premium guest pass.`, url: "#/fit", tag: `fit-pass-${me}` });
        return { ok: true };
      }
      const g = await kv.get(K.guest(me));
      if (g?.owner) {
        const owner = Number(g.owner);
        const p = await passOf(owner);
        if (p?.guest === me) await free(owner, p);
        await kv.set(K.guest(me), null);
        void notify(owner, { title: "Guest pass is free", body: `${await nameOf(me)} gave back your Cooked Fitness by Arise Premium guest pass.`, url: "#/fit", tag: `fit-pass-${owner}` });
      }
      return { ok: true };
    },
  };
}

/** A route that needs Fit+: answers 402 with PLUS_REQUIRED when the person doesn't have it. */
export const needsPlus = (plusOf: (id: number) => Promise<{ plus: boolean }>, what: string): RequestHandler => async (req: any, res: any, next: any) => {
  try { if ((await plusOf(Number(req.user?.id))).plus) return next(); }
  catch { /* treated as no plan */ }
  res.status(402).json({ message: `${what} is part of Cooked Fitness by Arise Premium.`, code: PLUS_REQUIRED });
};

export function registerPassRoutes(app: Express, auth: RequestHandler, deps: PassDeps) {
  const p = createPasses(deps);
  const limit = createAttemptLimiter({ max: 20, windowMs: 60 * 60_000 });
  const wrap = (fn: (me: number, req: any) => Promise<any>, limited = false) => async (req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    const me = Number(req.user?.id);
    if (limited) {
      const wait = limit.retryAfter(String(me));
      if (wait) return res.status(429).json({ message: `Too many tries. Try again in ${waitWords(wait)}.` });
      limit.fail(String(me));
    }
    try { const r = await fn(me, req); return r?.error ? res.status(r.error).json({ message: r.message }) : res.json(r); }
    catch (e: any) { console.error("[fit] plus", e?.message); return res.status(503).json({ message: "Cooked Fitness by Arise Premium can't be checked right now. Try again in a moment." }); }
  };
  app.get("/api/fit/plus", auth, wrap((me) => p.status(me)));
  app.post("/api/fit/pass/code", auth, wrap((me, req) => p.code(me, req.body?.fresh === true), true));
  app.post("/api/fit/pass/redeem", auth, wrap((me, req) => p.redeem(me, req.body?.code), true));
  app.post("/api/fit/pass/end", auth, wrap((me) => p.end(me)));
  return p;
}
