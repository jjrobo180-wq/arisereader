// Arise Fit workout buddies (shared/fitBuddy.ts explains what they are). Kept as small JSON records in
// the settings table, so no new table is needed:
//   fit_buddy_host_<id>    { code, guests: [ids] }   a person who invited friends
//   fit_buddy_guest_<id>   { host }                  a friend who joined someone's group
//   fit_buddy_code_<CODE>  { host }                  which group an invite code opens
//   fit_buddy_cheers_<id>  [Cheer]                   the last cheers and nudges sent to someone
// Routes (all signed in):
//   GET  /api/fit/buddies           my group: everyone's training, my invite code, cheers to me
//   POST /api/fit/buddies/invite    make (or with {fresh:true} replace) my invite code; guests can't
//   POST /api/fit/buddies/join      {code} join a friend's group as their guest
//   POST /api/fit/buddies/leave     a guest leaves; a host ends the group
//   POST /api/fit/buddies/remove    {id} a host removes a guest
//   POST /api/fit/buddies/cheer     {to, kind} a cheer or nudge (with a notification)
// When someone in a group saves a new workout, the others get a notification (server/fit.ts calls
// tellBuddies).
import type { Express, RequestHandler } from "express";
import { CHEERS, MAX_GUESTS, buddyStats, cleanCode, makeCode, newWorkouts, type Buddy, type Cheer, type CheerKind } from "../shared/fitBuddy";
import { cleanFit, type FitData } from "../shared/fit";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";

export type FitKv = { get(key: string): Promise<any | null>; set(key: string, value: unknown | null): Promise<void> };
export function createMemoryKv(): FitKv {
  const m = new Map<string, string>();
  return { async get(k) { const v = m.get(k); return v == null ? null : JSON.parse(v); }, async set(k, v) { if (v == null) m.delete(k); else m.set(k, JSON.stringify(v)); } };
}
export function createSupabaseKv(): FitKv {
  const db = async () => (await import("./supabase")).supabase;
  return {
    async get(key) {
      const r = await (await db()).from("settings").select("value").eq("key", key).maybeSingle();
      if (r.error) throw r.error;
      try { return r.data?.value ? JSON.parse(r.data.value) : null; } catch { return null; }
    },
    async set(key, value) {
      const c = await db();
      const r = value == null ? await c.from("settings").delete().eq("key", key) : await c.from("settings").upsert({ key, value: JSON.stringify(value) }, { onConflict: "key" });
      if (r.error) throw r.error;
    },
  };
}

type Host = { code: string; guests: number[] };
const K = { host: (id: number) => `fit_buddy_host_${id}`, guest: (id: number) => `fit_buddy_guest_${id}`, code: (c: string) => `fit_buddy_code_${c}`, cheers: (id: number) => `fit_buddy_cheers_${id}` };

export type BuddyDeps = {
  kv: FitKv;
  getData: (userId: number) => Promise<unknown | null>;
  nameOf?: (userId: number) => Promise<string>;
  notify?: (userId: number, m: { title: string; body: string; url: string; tag?: string }) => Promise<unknown>;
  appUrl?: string;
};

export function createBuddies(deps: BuddyDeps) {
  const { kv } = deps;
  const nameOf = async (id: number) => ((await deps.nameOf?.(id).catch(() => "")) || "Your buddy").slice(0, 40);
  const notify = deps.notify ?? (async (userId: number, m: any) => { try { const { notifyUser } = await import("./pushNotifications"); await notifyUser(userId, m); } catch { /* notifications are a bonus */ } });
  const hostOf = async (id: number): Promise<Host | null> => { const h = await kv.get(K.host(id)); return h && Array.isArray(h.guests) ? h : null; };
  /** Who's in my group (host first) and my place in it; null when I'm in none. */
  const groupOf = async (me: number): Promise<{ host: number; guests: number[]; role: "host" | "guest" } | null> => {
    const mine = await hostOf(me);
    if (mine?.guests.length) return { host: me, guests: mine.guests, role: "host" };
    const g = await kv.get(K.guest(me));
    if (g?.host) {
      const h = await hostOf(Number(g.host));
      if (h?.guests.includes(me)) return { host: Number(g.host), guests: h.guests, role: "guest" };
      await kv.set(K.guest(me), null); // the host ended the group
    }
    return null;
  };
  return {
    groupOf,
    async view(me: number) {
      const group = await groupOf(me);
      const mine = await hostOf(me);
      const isGuest = group?.role === "guest";
      const ids = group ? [group.host, ...group.guests] : [];
      const buddies: Buddy[] = await Promise.all(ids.map(async (id) => {
        const raw = await deps.getData(id).catch(() => null);
        return { id, name: await nameOf(id), role: id === group!.host ? "host" as const : "guest" as const, me: id === me, stats: raw ? buddyStats(cleanFit(raw) as FitData) : null };
      }));
      const cheers: Cheer[] = ((await kv.get(K.cheers(me))) ?? []).slice(-12).reverse();
      return { role: group?.role ?? "none", code: isGuest ? null : mine?.code ?? null, canInvite: !isGuest, max: MAX_GUESTS, buddies, cheers };
    },
    async invite(me: number, fresh = false) {
      if ((await groupOf(me))?.role === "guest") return { error: 403, message: "Guests can't invite guests of their own. Ask the person who invited you to add your friend." };
      const h = (await hostOf(me)) ?? { code: "", guests: [] };
      if (h.code && !fresh) return { code: h.code };
      if (h.code) await kv.set(K.code(h.code), null);
      let code = makeCode();
      for (let i = 0; i < 5 && (await kv.get(K.code(code))); i++) code = makeCode();
      await kv.set(K.code(code), { host: me });
      await kv.set(K.host(me), { ...h, code });
      return { code };
    },
    async join(me: number, rawCode: unknown) {
      const code = cleanCode(rawCode);
      const owner = code ? (await kv.get(K.code(code)))?.host : null;
      if (!owner) return { error: 404, message: "That invite code doesn't work. Check it, or ask your friend for a new one." };
      const host = Number(owner);
      if (host === me) return { error: 400, message: "That's your own invite code. Send it to a friend." };
      const now = await groupOf(me);
      if (now?.role === "guest" && now.host === host) return { ok: true };
      if (now?.role === "guest") return { error: 409, message: `You're already in ${await nameOf(now.host)}'s group. Leave it first to join this one.` };
      if (now?.role === "host") return { error: 409, message: "You have buddies of your own. End your group first to join someone else's." };
      if ((await groupOf(host))?.role === "guest") return { error: 409, message: "That invite no longer works." };
      const h = await hostOf(host);
      if (!h || h.code !== code) return { error: 404, message: "That invite code doesn't work anymore. Ask your friend for a new one." };
      if (h.guests.length >= MAX_GUESTS) return { error: 409, message: `${await nameOf(host)}'s group is full (${MAX_GUESTS} guests).` };
      await kv.set(K.host(host), { ...h, guests: [...h.guests, me] });
      await kv.set(K.guest(me), { host });
      void notify(host, { title: "New workout buddy", body: `${await nameOf(me)} joined your Arise Fit group.`, url: "#/fit", tag: `fit-buddy-${host}` });
      return { ok: true };
    },
    async leave(me: number) {
      const g = await groupOf(me);
      if (!g) return { ok: true };
      if (g.role === "guest") {
        const h = await hostOf(g.host);
        if (h) await kv.set(K.host(g.host), { ...h, guests: h.guests.filter((x) => x !== me) });
        await kv.set(K.guest(me), null);
        return { ok: true };
      }
      const h = await hostOf(me);
      for (const id of g.guests) await kv.set(K.guest(id), null);
      if (h?.code) await kv.set(K.code(h.code), null);
      await kv.set(K.host(me), null);
      return { ok: true };
    },
    async remove(me: number, guest: number) {
      const h = await hostOf(me);
      if (!h?.guests.includes(guest)) return { error: 404, message: "That person isn't in your group." };
      await kv.set(K.host(me), { ...h, guests: h.guests.filter((x) => x !== guest) });
      await kv.set(K.guest(guest), null);
      return { ok: true };
    },
    async cheer(me: number, to: number, kind: CheerKind) {
      const g = await groupOf(me);
      if (!g || to === me || ![g.host, ...g.guests].includes(to)) return { error: 404, message: "That person isn't in your group." };
      const name = await nameOf(me);
      const list: Cheer[] = (await kv.get(K.cheers(to))) ?? [];
      await kv.set(K.cheers(to), [...list, { from: me, name, kind, at: Date.now() }].slice(-30));
      void notify(to, { title: `${CHEERS[kind].e} ${name}`, body: CHEERS[kind].body(name), url: "#/fit", tag: `fit-cheer-${me}` });
      return { ok: true };
    },
    /** After someone saves: tell their group about a workout they just finished. */
    async tell(me: number, before: Pick<FitData, "workouts"> | null, after: Pick<FitData, "workouts">) {
      const fresh = newWorkouts(before, after);
      if (!fresh.length) return 0;
      const g = await groupOf(me);
      if (!g) return 0;
      const w = fresh[fresh.length - 1];
      const name = await nameOf(me);
      const others = [g.host, ...g.guests].filter((x) => x !== me);
      for (const id of others) void notify(id, { title: `${name} just trained 💪`, body: `${w.name} · ${Math.max(1, Math.round(w.secs / 60))} min. Send a cheer!`, url: "#/fit", tag: `fit-done-${me}` });
      return others.length;
    },
  };
}

export function registerBuddyRoutes(app: Express, auth: RequestHandler, deps: BuddyDeps) {
  const b = createBuddies(deps);
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
    catch (e: any) { console.error("[fit] buddies", e?.message); return res.status(503).json({ message: "Buddies can't be reached right now. Try again in a moment." }); }
  };
  app.get("/api/fit/buddies", auth, wrap((me) => b.view(me)));
  app.post("/api/fit/buddies/invite", auth, wrap((me, req) => b.invite(me, req.body?.fresh === true), true));
  app.post("/api/fit/buddies/join", auth, wrap((me, req) => b.join(me, req.body?.code), true));
  app.post("/api/fit/buddies/leave", auth, wrap((me) => b.leave(me)));
  app.post("/api/fit/buddies/remove", auth, wrap((me, req) => b.remove(me, Number(req.body?.id))));
  app.post("/api/fit/buddies/cheer", auth, wrap((me, req) => b.cheer(me, Number(req.body?.to), (req.body?.kind in CHEERS ? req.body.kind : "cheer") as CheerKind), true));
  return b;
}
