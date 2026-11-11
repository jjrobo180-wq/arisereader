// Cooked workout buddies (shared/fitBuddy.ts explains what they are). Small JSON records in the
// settings table (server/fitKv.ts):
//   fit_buddy_profile_<id>   { tag, avatar, focus, level, perWeek, mode, tz, at }
//   fit_buddy_queue          [{ id, at }]            people waiting for a buddy (profiles are read from above)
//   fit_buddy_pair_<id>      { buddy, since, goal, proposal? }   written for both people
//   fit_buddy_inbox_<id>     [{ kind, at }]          preset messages received
//   fit_buddy_block_<id>     [ids]                   people never matched with again
//   fit_buddy_sent_<id>      { day, n }              messages sent today (a daily cap)
//   fit_buddy_reports        [{ by, who, reason, at }]
// Routes (all signed in):
//   GET  /api/fit/buddy           where things stand: searching, matched (with the week), or neither
//   POST /api/fit/buddy/join      {avatar, focus, level, perWeek, mode, tz} look for a buddy
//   POST /api/fit/buddy/cancel    stop looking
//   POST /api/fit/buddy/send      {kind} a preset message
//   POST /api/fit/buddy/goal      {perWeek, mode} propose a goal (the other person accepts)
//   POST /api/fit/buddy/accept    accept the proposed goal
//   POST /api/fit/buddy/leave     end the pairing
//   POST /api/fit/buddy/report    {reason} report, end the pairing and never match again
// People only ever see a gamertag and an emoji. Nothing they type reaches the other person.
import type { Express, RequestHandler } from "express";
import { PRESET_BY_ID, REPORT_REASONS, adultCheck, bestMatch, buddyRecord, cleanPrefs, countsFrom, makeTag, startingGoal, type BuddyProfile, type Goal, type Msg, type Pair } from "../shared/fitBuddy";
import { cleanFit } from "../shared/fit";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import type { FitKv } from "./fitKv";

const K = {
  profile: (id: number) => `fit_buddy_profile_${id}`, queue: "fit_buddy_queue", pair: (id: number) => `fit_buddy_pair_${id}`, inbox: (id: number) => `fit_buddy_inbox_${id}`,
  block: (id: number) => `fit_buddy_block_${id}`, sent: (id: number) => `fit_buddy_sent_${id}`, reports: "fit_buddy_reports",
};
const WAIT_MS = 14 * 864e5;
const DAILY_MESSAGES = 30;

export type BuddyDeps = {
  kv: FitKv;
  getData: (userId: number) => Promise<unknown | null>;
  notify?: (userId: number, m: { title: string; body: string; url: string; tag?: string }) => Promise<unknown>;
  now?: () => number;
};

export function createBuddies(deps: BuddyDeps) {
  const { kv } = deps;
  const now = () => (deps.now ?? Date.now)();
  const notify = deps.notify ?? (async (userId: number, m: any) => { try { const { notifyUser } = await import("./pushNotifications"); await notifyUser(userId, m); } catch { /* a bonus */ } });
  // One match at a time, so two people looking at once can't both pick the same third person.
  let lock: Promise<unknown> = Promise.resolve();
  const exclusive = <T,>(fn: () => Promise<T>): Promise<T> => { const run = lock.then(fn, fn); lock = run.catch(() => {}); return run; };

  const profileOf = async (id: number): Promise<BuddyProfile | null> => (await kv.get(K.profile(id))) ?? null;
  const pairOf = async (id: number): Promise<Pair | null> => { const p = await kv.get(K.pair(id)); return p?.buddy ? p : null; };
  const queue = async (): Promise<{ id: number; at: number }[]> => ((await kv.get(K.queue)) ?? []).filter((q: any) => q?.id && now() - q.at < WAIT_MS);
  const blocked = async (id: number): Promise<number[]> => (await kv.get(K.block(id))) ?? [];

  const eligible = async (me: number) => {
    const raw = await deps.getData(me).catch(() => null);
    return { raw, ...adultCheck(raw ? cleanFit(raw).profile : undefined, new Date(now())) };
  };

  async function end(me: number, andBlock: boolean) {
    const pair = await pairOf(me);
    if (!pair) return;
    await kv.set(K.pair(me), null); await kv.set(K.pair(pair.buddy), null);
    if (andBlock) {
      await kv.set(K.block(me), [...new Set([...(await blocked(me)), pair.buddy])].slice(-200));
      await kv.set(K.block(pair.buddy), [...new Set([...(await blocked(pair.buddy)), me])].slice(-200));
    }
    void notify(pair.buddy, { title: "Workout buddy", body: "Your buddy has moved on. You can look for a new one anytime.", url: "#/fit", tag: `fit-buddy-${me}` });
  }

  async function view(me: number) {
    const ok = await eligible(me);
    const mine = await profileOf(me);
    if (!ok.ok) return { eligible: false, why: ok.why, status: "none" as const };
    const pair = await pairOf(me);
    if (pair) {
      const them = await profileOf(pair.buddy);
      const theirRaw = await deps.getData(pair.buddy).catch(() => null);
      const myCounts = countsFrom(ok.raw, now()), theirCounts = countsFrom(theirRaw, now());
      const inbox: Msg[] = ((await kv.get(K.inbox(me))) ?? []).slice(-12).reverse();
      const proposal = pair.proposal ? { perWeek: pair.proposal.perWeek, mode: pair.proposal.mode, mine: pair.proposal.by === me } : null;
      return {
        eligible: true, status: "matched" as const, me: mine && { tag: mine.tag, avatar: mine.avatar },
        buddy: them && { tag: them.tag, avatar: them.avatar, focus: them.focus, level: them.level }, since: pair.since,
        goal: pair.goal, proposal, weeks: { me: myCounts, them: theirCounts }, record: buddyRecord(myCounts, theirCounts, pair.goal), inbox,
      };
    }
    const waiting = (await queue()).some((q) => q.id === me);
    return { eligible: true, status: waiting ? ("searching" as const) : ("none" as const), me: mine && { tag: mine.tag, avatar: mine.avatar }, prefs: mine ? { avatar: mine.avatar, focus: mine.focus, level: mine.level, perWeek: mine.perWeek, mode: mine.mode } : null };
  }

  return {
    pairOf, view,
    join: (me: number, body: any) => exclusive(async () => {
      const ok = await eligible(me);
      if (!ok.ok) return { error: 403, message: ok.why };
      if (await pairOf(me)) return { error: 409, message: "You already have a workout buddy." };
      const prev = await profileOf(me);
      const profile: BuddyProfile = { ...cleanPrefs(body), tag: prev?.tag ?? makeTag(), at: now() };
      await kv.set(K.profile(me), profile);
      const mineBlocked = new Set(await blocked(me));
      const waiting = (await queue()).filter((q) => q.id !== me && !mineBlocked.has(q.id));
      const cands: { id: number; p: BuddyProfile }[] = [];
      for (const q of waiting) {
        if (await pairOf(q.id)) continue;
        if ((await blocked(q.id)).includes(me)) continue;
        const p = await profileOf(q.id); if (p) cands.push({ id: q.id, p });
      }
      const match = bestMatch(profile, cands);
      if (!match) {
        await kv.set(K.queue, [...(await queue()).filter((q) => q.id !== me), { id: me, at: now() }].slice(-500));
        return view(me);
      }
      const goal = startingGoal(profile, match.p);
      await kv.set(K.pair(me), { buddy: match.id, since: now(), goal });
      await kv.set(K.pair(match.id), { buddy: me, since: now(), goal });
      await kv.set(K.queue, (await queue()).filter((q) => q.id !== me && q.id !== match.id));
      void notify(match.id, { title: "You have a workout buddy", body: `Meet ${profile.avatar} ${profile.tag}. Say hi and set your goal.`, url: "#/fit", tag: `fit-buddy-${me}` });
      return view(me);
    }),
    async cancel(me: number) { await kv.set(K.queue, (await queue()).filter((q) => q.id !== me)); return view(me); },
    async send(me: number, kind: unknown) {
      const preset = PRESET_BY_ID.get(String(kind));
      const pair = await pairOf(me);
      if (!preset || !pair) return { error: 404, message: "You don't have a buddy to message right now." };
      const day = new Date(now()).toISOString().slice(0, 10);
      const sent = (await kv.get(K.sent(me))) ?? { day, n: 0 };
      const n = sent.day === day ? sent.n : 0;
      if (n >= DAILY_MESSAGES) return { error: 429, message: "That's plenty for today. Come back tomorrow." };
      await kv.set(K.sent(me), { day, n: n + 1 });
      const inbox = (await kv.get(K.inbox(pair.buddy))) ?? [];
      await kv.set(K.inbox(pair.buddy), [...inbox, { kind: preset.id, from: "them", at: now() }].slice(-30));
      const mine = await profileOf(me);
      void notify(pair.buddy, { title: `${mine?.avatar ?? ""} ${mine?.tag ?? "Your buddy"}`.trim(), body: `${preset.e} ${preset.text}`, url: "#/fit", tag: `fit-buddy-msg-${me}` });
      return { ok: true };
    },
    async goal(me: number, body: any) {
      const pair = await pairOf(me);
      if (!pair) return { error: 404, message: "You don't have a buddy yet." };
      const g: Goal = { perWeek: Math.min(7, Math.max(1, Math.round(Number(body?.perWeek)) || pair.goal.perWeek)), mode: body?.mode === "duel" ? "duel" : "coop" };
      // The same thing the other person already proposed: that settles it.
      if (pair.proposal && pair.proposal.by !== me && pair.proposal.perWeek === g.perWeek && pair.proposal.mode === g.mode) return this.accept(me);
      const next = { ...pair, proposal: { ...g, by: me } };
      await kv.set(K.pair(me), next); await kv.set(K.pair(pair.buddy), { ...(await pairOf(pair.buddy)), ...next, buddy: me, since: pair.since });
      const mine = await profileOf(me);
      void notify(pair.buddy, { title: `${mine?.avatar ?? ""} ${mine?.tag ?? "Your buddy"}`.trim(), body: `Proposed a goal: ${g.perWeek} workouts a week.`, url: "#/fit", tag: `fit-buddy-goal-${me}` });
      return view(me);
    },
    async accept(me: number) {
      const pair = await pairOf(me);
      if (!pair?.proposal || pair.proposal.by === me) return { error: 404, message: "There's no goal waiting for you to accept." };
      const goal = { perWeek: pair.proposal.perWeek, mode: pair.proposal.mode };
      const theirs = await pairOf(pair.buddy);
      await kv.set(K.pair(me), { buddy: pair.buddy, since: pair.since, goal }); await kv.set(K.pair(pair.buddy), { buddy: me, since: theirs?.since ?? pair.since, goal });
      void notify(pair.buddy, { title: "Goal set", body: `You're both on ${goal.perWeek} workouts a week. Go get it.`, url: "#/fit", tag: `fit-buddy-goal-${me}` });
      return view(me);
    },
    async leave(me: number) { await end(me, false); return view(me); },
    async report(me: number, reason: unknown) {
      const pair = await pairOf(me);
      const r = REPORT_REASONS.find((x) => x.id === reason) ?? REPORT_REASONS[3];
      if (pair) {
        await kv.set(K.reports, [...((await kv.get(K.reports)) ?? []), { by: me, who: pair.buddy, reason: r.id, at: now() }].slice(-500));
        await end(me, true);
      }
      return view(me);
    },
    /** After someone saves: their buddy hears about a workout they just finished. */
    async tell(me: number, before: { workouts: any[] } | null, after: { workouts: any[] }) {
      const had = new Set((before?.workouts ?? []).map((w) => w.id));
      const fresh = after.workouts.filter((w) => !had.has(w.id) && now() - Date.parse(w.date) < 12 * 3600_000 && w.exercises?.length);
      if (!fresh.length) return 0;
      const pair = await pairOf(me); if (!pair) return 0;
      const w = fresh[fresh.length - 1], mine = await profileOf(me);
      void notify(pair.buddy, { title: `${mine?.avatar ?? ""} ${mine?.tag ?? "Your buddy"} just trained`.trim(), body: `${Math.max(1, Math.round(w.secs / 60))} minutes. Send a 🙌?`, url: "#/fit", tag: `fit-buddy-done-${me}` });
      return 1;
    },
  };
}

export function registerBuddyRoutes(app: Express, auth: RequestHandler, deps: BuddyDeps) {
  const b = createBuddies(deps);
  const limit = createAttemptLimiter({ max: 60, windowMs: 60 * 60_000 });
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
    catch (e: any) { console.error("[fit] buddy", e?.message); return res.status(503).json({ message: "Workout buddies can't be reached right now. Try again in a moment." }); }
  };
  app.get("/api/fit/buddy", auth, wrap((me) => b.view(me)));
  app.post("/api/fit/buddy/join", auth, wrap((me, req) => b.join(me, req.body), true));
  app.post("/api/fit/buddy/cancel", auth, wrap((me) => b.cancel(me)));
  app.post("/api/fit/buddy/send", auth, wrap((me, req) => b.send(me, req.body?.kind), true));
  app.post("/api/fit/buddy/goal", auth, wrap((me, req) => b.goal(me, req.body), true));
  app.post("/api/fit/buddy/accept", auth, wrap((me) => b.accept(me)));
  app.post("/api/fit/buddy/leave", auth, wrap((me) => b.leave(me)));
  app.post("/api/fit/buddy/report", auth, wrap((me, req) => b.report(me, req.body?.reason), true));
  return b;
}
