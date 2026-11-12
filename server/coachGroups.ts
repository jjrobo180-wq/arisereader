// Cooked PT groups: group pages (posts, photos, comments, likes, pins), group chat, and challenges with a
// leaderboard. A trainer owns each group; members are their active clients. Shapes: shared/coachGroups.ts.
// Registered from registerCoachRoutes (server/coach.ts), which passes its store, key-value store and helpers.
import type { Express, RequestHandler } from "express";
import type { CoachStore } from "./coach";
import type { FitKv } from "./fitKv";
import { createAttemptLimiter } from "./attemptLimiter";
import {
  GROUP_LIMITS, canCheck, challengeState, cleanChallenge, cleanGroup, photoOk, standings, trainerOfGroup,
  type Challenge, type Group, type GroupMsg, type GroupPost,
} from "../shared/coachGroups";

type Ctx = {
  store: CoachStore; kv: FitKv; now: () => number;
  me: (req: any) => number;
  wrap: (fn: (req: any, res: any) => Promise<unknown>) => RequestHandler;
  refuse: (message: string, status?: number) => Error;
  first: (id: number) => Promise<string>;
  notify: (userId: number, m: { title: string; body: string; url: string; tag?: string }) => Promise<unknown>;
};

const rid = () => Math.random().toString(36).slice(2, 12);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function registerCoachGroupRoutes(app: Express, auth: RequestHandler, c: Ctx) {
  const { store, kv, me, wrap, refuse, first, notify } = c;
  const K = { groups: (t: number) => `coach-groups:${t}`, posts: (g: string) => `coach-gposts:${g}`, chat: (g: string) => `coach-gchat:${g}`, ch: (g: string) => `coach-gch:${g}` };
  const groupsOf = async (t: number): Promise<Group[]> => { const v = await kv.get(K.groups(t)); return Array.isArray(v) ? (v as Group[]) : []; };
  const list = async <T,>(key: string): Promise<T[]> => { const v = await kv.get(key); return Array.isArray(v) ? (v as T[]) : []; };
  const utcToday = () => new Date(c.now()).toISOString().slice(0, 10);
  /** The member's own date (they may be a day either side of UTC). */
  const todayOf = (req: any) => { const t = String(req.query?.today ?? req.body?.today ?? ""); const u = utcToday(); const d = (x: string) => Math.abs(Date.parse(`${x}T12:00:00Z`) - Date.parse(`${u}T12:00:00Z`)); return DAY.test(t) && d(t) <= 864e5 ? t : u; };
  const posting = createAttemptLimiter({ max: 60, windowMs: 60 * 60_000 });
  const chatting = createAttemptLimiter({ max: 120, windowMs: 60 * 60_000 });
  const allow = (lim: ReturnType<typeof createAttemptLimiter>, key: string) => { if (lim.retryAfter(key)) return false; lim.fail(key); return true; };

  /** Who may see this group: its trainer, or a member who is still an active client of that trainer. */
  async function access(req: any): Promise<{ g: Group; id: number; coach: boolean; all: Group[] }> {
    const id = me(req); const gid = String(req.params.gid); const tid = trainerOfGroup(gid);
    const all = tid ? await groupsOf(tid) : [];
    const g = all.find((x) => x.id === gid);
    if (!g) throw refuse("That group isn't there anymore.", 404);
    if (id === g.trainerId) return { g, id, coach: true, all };
    const l = g.members.includes(id) ? await store.linkBetween(g.trainerId, id) : null;
    if (l?.status !== "active") throw refuse("You're not in this group.", 403);
    return { g, id, coach: false, all };
  }
  /** Active clients of the trainer, so nobody else can be put in a group. */
  const activeClients = async (tid: number) => new Set((await store.linksOf("trainer", tid)).filter((l) => l.status === "active").map((l) => l.clientId));
  const coachName = async (tid: number) => (await store.trainer(tid))?.profile.name || (await first(tid));
  const nameFor = async (id: number, g: Group) => (id === g.trainerId ? coachName(id) : first(id));
  const tell = (ids: number[], m: { title: string; body: string; tag: string }) => { for (const u of ids) void notify(u, { ...m, url: "#/fit" }); };
  const others = (g: Group, id: number) => [g.trainerId, ...g.members].filter((x) => x !== id);

  async function view(g: Group, id: number, coach: boolean, today: string) {
    const [posts, chat, chs] = await Promise.all([list<GroupPost>(K.posts(g.id)), list<GroupMsg>(K.chat(g.id)), list<Challenge>(K.ch(g.id))]);
    const names: Record<number, string> = {};
    await Promise.all(g.members.map(async (m) => { names[m] = await first(m); }));
    const challenges = chs.map((ch) => ({ ...ch, state: challengeState(ch, today),
      // Members see their own log and the leaderboard, not everyone's day-by-day.
      log: coach ? ch.log : { [String(id)]: ch.log[String(id)] ?? {} },
      board: standings(ch, g.members, today).map((s) => ({ ...s, name: names[s.clientId] || "Member", me: s.clientId === id })) }));
    const sorted = [...posts].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at.localeCompare(a.at));
    return { group: { ...g, members: coach ? g.members : [] }, memberNames: coach ? names : {}, memberCount: g.members.length, coach, me: id,
      posts: sorted.slice(0, 100), chat: g.chatOn ? chat.slice(-150) : [], challenges };
  }

  // ── Trainer: make and manage groups ──
  app.get("/api/coach/trainer/groups", auth, wrap(async (req) => {
    const id = me(req); const today = todayOf(req);
    const groups = await groupsOf(id);
    return { groups: await Promise.all(groups.map(async (g) => {
      const [posts, chs] = await Promise.all([list<GroupPost>(K.posts(g.id)), list<Challenge>(K.ch(g.id))]);
      const live = chs.find((x) => challengeState(x, today) === "live");
      return { ...g, posts: posts.length, lastPost: posts.reduce((t, p) => (p.at > t ? p.at : t), ""), live: live ? { name: live.name, start: live.start, days: live.days } : null };
    })) };
  }));
  app.post("/api/coach/trainer/groups", auth, wrap(async (req) => {
    const id = me(req); const all = await groupsOf(id);
    if (all.length >= GROUP_LIMITS.groups) throw refuse(`You can have up to ${GROUP_LIMITS.groups} groups. Delete an old one first.`);
    const ok = await activeClients(id);
    const g = cleanGroup({ ...req.body?.group, members: (req.body?.group?.members ?? []).filter((m: number) => ok.has(Number(m))) }, id);
    if (!g) throw refuse("Give the group a name.");
    await kv.set(K.groups(id), [...all, g]);
    tell(g.members, { title: `You're in ${g.name}`, body: `${await coachName(id)} added you to a group. Say hi in Cooked.`, tag: `group-${g.id}` });
    return { group: g };
  }));
  app.put("/api/coach/trainer/groups/:gid", auth, wrap(async (req) => {
    const { g, coach, all } = await access(req);
    if (!coach) throw refuse("Only the coach can change the group.", 403);
    if (req.body?.remove) {
      await kv.set(K.groups(g.trainerId), all.filter((x) => x.id !== g.id));
      await Promise.all([kv.set(K.posts(g.id), []), kv.set(K.chat(g.id), []), kv.set(K.ch(g.id), [])]);
      return { ok: true };
    }
    const ok = await activeClients(g.trainerId);
    const raw = req.body?.group ?? {};
    const next = cleanGroup({ ...g, ...raw, members: Array.isArray(raw.members) ? raw.members.filter((m: number) => ok.has(Number(m)) || g.members.includes(Number(m))) : g.members }, g.trainerId, g);
    if (!next) throw refuse("Give the group a name.");
    await kv.set(K.groups(g.trainerId), all.map((x) => (x.id === g.id ? next : x)));
    const added = next.members.filter((m) => !g.members.includes(m));
    if (added.length) tell(added, { title: `You're in ${next.name}`, body: `${await coachName(g.trainerId)} added you to a group. Say hi in Cooked.`, tag: `group-${g.id}` });
    return { group: next };
  }));

  // ── Everyone in the group ──
  /** A client's groups, from every trainer they're actively coached by. */
  app.get("/api/coach/groups", auth, wrap(async (req) => {
    const id = me(req); const today = todayOf(req);
    const links = (await store.linksOf("client", id)).filter((l) => l.status === "active");
    const out = [];
    for (const l of links) for (const g of await groupsOf(l.trainerId)) if (g.members.includes(id)) {
      const chs = await list<Challenge>(K.ch(g.id));
      const live = chs.find((x) => challengeState(x, today) === "live");
      out.push({ id: g.id, trainerId: g.trainerId, linkId: l.id, name: g.name, about: g.about, cover: g.cover, memberCount: g.members.length, live: live ? live.name : "" });
    }
    return { groups: out };
  }));
  app.get("/api/coach/groups/:gid", auth, wrap(async (req) => { const { g, id, coach } = await access(req); return view(g, id, coach, todayOf(req)); }));
  app.post("/api/coach/groups/:gid/leave", auth, wrap(async (req) => {
    const { g, id, coach, all } = await access(req);
    if (coach) throw refuse("You run this group. Delete it instead.");
    await kv.set(K.groups(g.trainerId), all.map((x) => (x.id === g.id ? { ...x, members: x.members.filter((m) => m !== id) } : x)));
    return { ok: true };
  }));

  // Posts
  app.post("/api/coach/groups/:gid/posts", auth, wrap(async (req) => {
    const { g, id, coach } = await access(req);
    if (!coach && !g.memberPosts) throw refuse("Only the coach posts in this group. You can comment and like.", 403);
    if (!allow(posting, `p:${id}`)) throw refuse("That's a lot of posts for one hour. Try again later.", 429);
    const text = String(req.body?.text ?? "").trim().slice(0, 3000); const photo = photoOk(req.body?.photo);
    if (!text && !photo) throw refuse("Write something or add a photo.");
    const p: GroupPost = { id: rid(), by: id, name: await nameFor(id, g), coach, at: new Date(c.now()).toISOString(), text, photo, likes: [], comments: [], pinned: coach && req.body?.pinned === true };
    const posts = await list<GroupPost>(K.posts(g.id));
    // The oldest unpinned posts make room once the page is full.
    const kept = [p, ...posts]; while (kept.length > GROUP_LIMITS.posts) { const i = kept.map((x) => x.pinned).lastIndexOf(false); kept.splice(i < 0 ? kept.length - 1 : i, 1); }
    await kv.set(K.posts(g.id), kept);
    tell(others(g, id), { title: g.name, body: `${p.name}${coach ? " (coach)" : ""}: ${text.slice(0, 120) || "shared a photo"}`, tag: `gpost-${g.id}` });
    return { post: p };
  }));
  const editPost = async (req: any, fn: (p: GroupPost, who: { id: number; coach: boolean; g: Group }) => GroupPost | null) => {
    const { g, id, coach } = await access(req);
    const posts = await list<GroupPost>(K.posts(g.id));
    const p = posts.find((x) => x.id === req.params.pid);
    if (!p) throw refuse("That post was removed.", 404);
    const next = fn(p, { id, coach, g });
    await kv.set(K.posts(g.id), next ? posts.map((x) => (x.id === p.id ? next : x)) : posts.filter((x) => x.id !== p.id));
    return { post: next, by: { id, coach, g } };
  };
  app.post("/api/coach/groups/:gid/posts/:pid/like", auth, wrap(async (req) => (await editPost(req, (p, w) => ({ ...p, likes: p.likes.includes(w.id) ? p.likes.filter((x) => x !== w.id) : [...p.likes, w.id] }))).post));
  app.post("/api/coach/groups/:gid/posts/:pid/comments", auth, wrap(async (req) => {
    const text = String(req.body?.text ?? "").trim().slice(0, 1000);
    if (!text) throw refuse("Write a comment.");
    const { g, id } = await access(req);
    if (!allow(chatting, `c:${id}`)) throw refuse("Slow down a little. Try again soon.", 429);
    const name = await nameFor(id, g);
    const out = await editPost(req, (p) => (p.comments.length >= GROUP_LIMITS.comments ? (() => { throw refuse("This post has a lot of comments. Start a new post."); })() : { ...p, comments: [...p.comments, { id: rid(), by: id, name, at: new Date(c.now()).toISOString(), text }] }));
    if (out.post && out.post.by !== id) void notify(out.post.by, { title: g.name, body: `${name} commented: ${text.slice(0, 120)}`, url: "#/fit", tag: `gcom-${out.post.id}` });
    return out.post;
  }));
  /** Pin or remove a post (the coach, or the author removing their own), or remove a comment. */
  app.put("/api/coach/groups/:gid/posts/:pid", auth, wrap(async (req) => {
    const b = req.body ?? {};
    const out = await editPost(req, (p, w) => {
      if (b.comment) { const cm = p.comments.find((x) => x.id === b.comment); if (cm && (w.coach || cm.by === w.id)) return { ...p, comments: p.comments.filter((x) => x.id !== cm.id) }; throw refuse("You can only remove your own comments.", 403); }
      if (b.remove) { if (w.coach || p.by === w.id) return null; throw refuse("You can only remove your own posts.", 403); }
      if (typeof b.pinned === "boolean") { if (!w.coach) throw refuse("Only the coach can pin posts.", 403); return { ...p, pinned: b.pinned }; }
      if (typeof b.text === "string") { if (p.by !== w.id) throw refuse("You can only edit your own posts.", 403); const text = b.text.trim().slice(0, 3000); if (!text && !p.photo) throw refuse("Write something."); return { ...p, text }; }
      return p;
    });
    return { post: out.post };
  }));

  // Chat
  app.get("/api/coach/groups/:gid/chat", auth, wrap(async (req) => {
    const { g } = await access(req);
    const after = String(req.query?.after ?? "");
    const all = g.chatOn ? await list<GroupMsg>(K.chat(g.id)) : [];
    return { chat: after ? all.filter((m) => m.at > after) : all.slice(-150) };
  }));
  app.post("/api/coach/groups/:gid/chat", auth, wrap(async (req) => {
    const { g, id, coach } = await access(req);
    if (!g.chatOn) throw refuse("Chat is off in this group.", 403);
    const text = String(req.body?.text ?? "").trim().slice(0, 2000);
    if (!text) throw refuse("Write a message.");
    if (!allow(chatting, `m:${id}`)) throw refuse("Slow down a little. Try again soon.", 429);
    const m: GroupMsg = { id: rid(), by: id, name: await nameFor(id, g), coach, at: new Date(c.now()).toISOString(), text };
    const all = await list<GroupMsg>(K.chat(g.id));
    await kv.set(K.chat(g.id), [...all, m].slice(-GROUP_LIMITS.chat));
    tell(others(g, id), { title: g.name, body: `${m.name}: ${text.slice(0, 120)}`, tag: `gchat-${g.id}` });
    return { msg: m };
  }));

  // Challenges
  app.post("/api/coach/groups/:gid/challenges", auth, wrap(async (req) => {
    const { g, coach, id } = await access(req);
    if (!coach) throw refuse("Only the coach can start a challenge.", 403);
    const all = await list<Challenge>(K.ch(g.id));
    if (all.length >= GROUP_LIMITS.challenges) throw refuse("This group has a lot of challenges. Delete an old one first.");
    const ch = cleanChallenge(req.body?.challenge);
    if (!ch) throw refuse("A challenge needs a name, a start date and at least one daily goal.");
    if (ch.start < todayOf(req)) throw refuse("Start the challenge today or later.");
    await kv.set(K.ch(g.id), [...all, ch]);
    tell(g.members, { title: `New challenge: ${ch.name}`, body: `${await coachName(id)} started a ${ch.days}-day challenge in ${g.name}. It starts ${ch.start === todayOf(req) ? "today" : ch.start}.`, tag: `gch-${ch.id}` });
    return { challenge: ch };
  }));
  app.put("/api/coach/groups/:gid/challenges/:cid", auth, wrap(async (req) => {
    const { g, coach } = await access(req);
    if (!coach) throw refuse("Only the coach can change a challenge.", 403);
    const all = await list<Challenge>(K.ch(g.id)); const old = all.find((x) => x.id === req.params.cid);
    if (!old) throw refuse("That challenge was removed.", 404);
    if (req.body?.remove) { await kv.set(K.ch(g.id), all.filter((x) => x.id !== old.id)); return { ok: true }; }
    const ch = cleanChallenge({ ...old, ...req.body?.challenge }, old);
    if (!ch) throw refuse("A challenge needs a name, a start date and at least one daily goal.");
    await kv.set(K.ch(g.id), all.map((x) => (x.id === old.id ? ch : x)));
    return { challenge: ch };
  }));
  /** A member checks a daily goal off (or back on). */
  app.post("/api/coach/groups/:gid/challenges/:cid/check", auth, wrap(async (req) => {
    const { g, id, coach } = await access(req);
    if (coach) throw refuse("Members check off their own goals.", 403);
    const today = todayOf(req); const day = String(req.body?.day ?? today); const task = String(req.body?.task ?? "");
    const all = await list<Challenge>(K.ch(g.id)); const ch = all.find((x) => x.id === req.params.cid);
    if (!ch) throw refuse("That challenge was removed.", 404);
    if (!ch.tasks.some((t) => t.id === task)) throw refuse("That goal isn't in this challenge.");
    if (!canCheck(ch, day, today)) throw refuse(day > today || day < ch.start ? "That day hasn't started yet." : "You can only check off today and yesterday.");
    const mine = { ...(ch.log[String(id)] ?? {}) };
    const done = new Set(mine[day] ?? []);
    if (req.body?.on === false) done.delete(task); else done.add(task);
    mine[day] = [...done];
    const next = { ...ch, log: { ...ch.log, [String(id)]: mine } };
    await kv.set(K.ch(g.id), all.map((x) => (x.id === ch.id ? next : x)));
    const names: Record<number, string> = {};
    await Promise.all(g.members.map(async (m) => { names[m] = await first(m); }));
    return { log: mine, board: standings(next, g.members, today).map((s) => ({ ...s, name: names[s.clientId] || "Member", me: s.clientId === id })) };
  }));
}
