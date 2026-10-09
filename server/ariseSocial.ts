// Arise Social (/social/): students explore careers, do off-screen quests and share wins with
// their class; parents follow along and set limits; teachers approve every student post and host events.
//
// Safety rules kept here, on the server:
// - Accounts are the regular A.R.I.S.E. Reader accounts. Students show as "First L." to everyone.
// - A student's post is seen by nobody but its author until their own teacher approves it.
// - Students who are not yet approved by a teacher, or have no teacher, can explore but not post.
// - Posts are seen only by the author's class (or school, if a parent allows it). There are no messages.
// - K–5 students build posts from fixed choices instead of typing, and need a parent's OK to join an event.
// Tables: migrations/arise_social.sql.
import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { createAttemptLimiter } from "./attemptLimiter";
import {
  BANDS, CAREERS, CLUSTERS, LEVELS, LIMITS, QUESTS, REACTIONS, ROADMAP, SCHOLARSHIPS, XP, YOUNG_STARTERS,
  awardXp, bandForGrade, careerById, cleanPostText, cleanProfile, dayKey, isYoungBand, profileForDay, questById,
  type BandId, type PostScope, type Reaction, type SocialProfile,
} from "../shared/ariseSocial";

export type SocialRole = "student" | "teacher" | "parent" | "admin";
export type SocialUser = {
  id: number; role: SocialRole; displayName: string; teacherId: number | null; schoolId: number | null;
  approvedByTeacher: boolean; archived: boolean;
};
export type PostRow = {
  id: string; author_id: number; author_role: "student" | "teacher" | "admin"; teacher_id: number | null; school_id: number | null;
  scope: PostScope; body: string; quest_id: string | null; career_id: string | null;
  status: "pending" | "approved" | "rejected"; reviewed_by: number | null; reviewed_at: string | null; created_at: string;
};
export type ReactionRow = { post_id: string; user_id: number; kind: Reaction };
export type EventRow = {
  id: string; host_id: number; school_id: number | null; scope: PostScope; title: string; starts_on: string; time_label: string;
  format: string; cluster: string; seats: number; created_at: string;
};
export type RsvpRow = { event_id: string; user_id: number; status: "requested" | "going" };
export type ProfileRow = { profile: SocialProfile; post_scope: PostScope };

export interface SocialStore {
  getProfile(userId: number): Promise<ProfileRow>;
  getProfiles(userIds: number[]): Promise<Map<number, ProfileRow>>;
  saveProfile(userId: number, profile: SocialProfile): Promise<void>;
  setScope(userId: number, scope: PostScope): Promise<void>;
  createPost(row: Omit<PostRow, "id" | "created_at" | "reviewed_by" | "reviewed_at">): Promise<PostRow>;
  getPost(id: string): Promise<PostRow | null>;
  /** Approved posts of these classes, plus approved school-wide posts of this school. Newest first. */
  visiblePosts(q: { teacherIds: number[]; schoolId: number | null; limit: number; everyone?: boolean }): Promise<PostRow[]>;
  postsBy(authorId: number, limit: number): Promise<PostRow[]>;
  pendingFor(teacherIds: number[] | "all"): Promise<PostRow[]>;
  review(id: string, status: "approved" | "rejected", reviewerId: number, at: string): Promise<void>;
  deletePost(id: string): Promise<void>;
  reactions(postIds: string[]): Promise<ReactionRow[]>;
  react(postId: string, userId: number, kind: Reaction | null): Promise<void>;
  createEvent(row: Omit<EventRow, "id" | "created_at">): Promise<EventRow>;
  getEvent(id: string): Promise<EventRow | null>;
  visibleEvents(q: { hostIds: number[]; schoolId: number | null; fromDay: string }): Promise<EventRow[]>;
  deleteEvent(id: string): Promise<void>;
  rsvps(eventIds: string[]): Promise<RsvpRow[]>;
  setRsvp(eventId: string, userId: number, status: RsvpRow["status"] | null): Promise<void>;
}

export type SocialDirectory = {
  user(id: number): Promise<SocialUser | null>;
  /** The grade a student gave at sign-up ("K", "3", "11"...), if any. */
  gradeOf(id: number): Promise<string | null>;
  /** A teacher's approved, active students. */
  studentsOf(teacherId: number): Promise<SocialUser[]>;
  /** Students linked to a parent account. */
  childrenOf(parentId: number): Promise<number[]>;
  /** Parents linked to a student. */
  parentsOf(studentId: number): Promise<number[]>;
  /** Sends a phone notification; optional. */
  notify?(userId: number, message: { title: string; body: string; url?: string }): Promise<unknown>;
};

export type SocialDeps = {
  store?: SocialStore; directory: SocialDirectory; now?: () => number; random?: () => number;
  /**
   * Arise Social is a paid add-on (see shared/plans.ts). self: may the signed-in account use it?
   * user: does this account have it (used to check a student's teacher)? Left out, everyone may.
   */
  access?: { self(req: any): Promise<boolean>; user(id: number): Promise<boolean> };
};

/* ------------------------------------------------------------------ stores */

const loadDb = async () => (await import("./supabase")).supabase;
/** Thrown when migrations/arise_social.sql has not been run yet (Postgres 42P01, PostgREST PGRST205). */
export class SocialNotSetUp extends Error {}
const isMissingTable = (error: any) => error?.code === "42P01" || error?.code === "PGRST205" || /could not find the table|does not exist/i.test(String(error?.message || ""));

export function createSupabaseSocialStore(client?: any): SocialStore {
  const db = async () => client ?? (await loadDb());
  const fail = (error: any) => {
    if (!error) return;
    if (isMissingTable(error)) throw new SocialNotSetUp(String(error.message));
    throw error;
  };
  const toProfile = (row: any): ProfileRow => ({ profile: cleanProfile(row), post_scope: row?.post_scope === "school" ? "school" : "class" });
  return {
    async getProfile(userId) {
      const r = await (await db()).from("social_profiles").select("*").eq("user_id", userId).maybeSingle();
      fail(r.error);
      return toProfile(r.data);
    },
    async getProfiles(userIds) {
      const out = new Map<number, ProfileRow>();
      if (!userIds.length) return out;
      const r = await (await db()).from("social_profiles").select("*").in("user_id", userIds);
      fail(r.error);
      for (const row of r.data || []) out.set(Number(row.user_id), toProfile(row));
      return out;
    },
    async saveProfile(userId, p) {
      const r = await (await db()).from("social_profiles").upsert({
        user_id: userId, xp: p.xp, streak: p.streak, last_active: p.last_active, daily_date: p.daily_date, daily_xp: p.daily_xp,
        collected: p.collected, saved: p.saved, quests: p.quests, road: p.road, spun: p.spun, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      fail(r.error);
    },
    async setScope(userId, scope) {
      const r = await (await db()).from("social_profiles").upsert({ user_id: userId, post_scope: scope, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      fail(r.error);
    },
    async createPost(row) {
      const r = await (await db()).from("social_posts").insert(row).select("*").single();
      fail(r.error);
      return r.data as PostRow;
    },
    async getPost(id) {
      const r = await (await db()).from("social_posts").select("*").eq("id", id).maybeSingle();
      fail(r.error);
      return (r.data as PostRow) || null;
    },
    async visiblePosts({ teacherIds, schoolId, limit, everyone }) {
      if (everyone) {
        const all = await (await db()).from("social_posts").select("*").eq("status", "approved").order("created_at", { ascending: false }).limit(limit);
        fail(all.error);
        return (all.data || []) as PostRow[];
      }
      const ors: string[] = [];
      if (teacherIds.length) ors.push(`teacher_id.in.(${teacherIds.map(Number).join(",")})`);
      if (schoolId) ors.push(`and(scope.eq.school,school_id.eq.${Number(schoolId)})`);
      if (!ors.length) return [];
      const r = await (await db()).from("social_posts").select("*").eq("status", "approved").or(ors.join(",")).order("created_at", { ascending: false }).limit(limit);
      fail(r.error);
      return (r.data || []) as PostRow[];
    },
    async postsBy(authorId, limit) {
      const r = await (await db()).from("social_posts").select("*").eq("author_id", authorId).order("created_at", { ascending: false }).limit(limit);
      fail(r.error);
      return (r.data || []) as PostRow[];
    },
    async pendingFor(teacherIds) {
      let q = (await db()).from("social_posts").select("*").eq("status", "pending");
      if (teacherIds !== "all") {
        if (!teacherIds.length) return [];
        q = q.in("teacher_id", teacherIds);
      }
      const r = await q.order("created_at", { ascending: true }).limit(200);
      fail(r.error);
      return (r.data || []) as PostRow[];
    },
    async review(id, status, reviewerId, at) {
      fail((await (await db()).from("social_posts").update({ status, reviewed_by: reviewerId, reviewed_at: at }).eq("id", id)).error);
    },
    async deletePost(id) { fail((await (await db()).from("social_posts").delete().eq("id", id)).error); },
    async reactions(postIds) {
      if (!postIds.length) return [];
      const r = await (await db()).from("social_reactions").select("post_id, user_id, kind").in("post_id", postIds);
      fail(r.error);
      return (r.data || []) as ReactionRow[];
    },
    async react(postId, userId, kind) {
      const t = (await db()).from("social_reactions");
      if (kind) fail((await t.upsert({ post_id: postId, user_id: userId, kind }, { onConflict: "post_id,user_id" })).error);
      else fail((await t.delete().eq("post_id", postId).eq("user_id", userId)).error);
    },
    async createEvent(row) {
      const r = await (await db()).from("social_events").insert(row).select("*").single();
      fail(r.error);
      return r.data as EventRow;
    },
    async getEvent(id) {
      const r = await (await db()).from("social_events").select("*").eq("id", id).maybeSingle();
      fail(r.error);
      return (r.data as EventRow) || null;
    },
    async visibleEvents({ hostIds, schoolId, fromDay }) {
      const ors: string[] = [];
      if (hostIds.length) ors.push(`host_id.in.(${hostIds.map(Number).join(",")})`);
      if (schoolId) ors.push(`and(scope.eq.school,school_id.eq.${Number(schoolId)})`);
      if (!ors.length) return [];
      const r = await (await db()).from("social_events").select("*").gte("starts_on", fromDay).or(ors.join(",")).order("starts_on", { ascending: true }).limit(60);
      fail(r.error);
      return (r.data || []) as EventRow[];
    },
    async deleteEvent(id) { fail((await (await db()).from("social_events").delete().eq("id", id)).error); },
    async rsvps(eventIds) {
      if (!eventIds.length) return [];
      const r = await (await db()).from("social_rsvps").select("event_id, user_id, status").in("event_id", eventIds);
      fail(r.error);
      return (r.data || []) as RsvpRow[];
    },
    async setRsvp(eventId, userId, status) {
      const t = (await db()).from("social_rsvps");
      if (status) fail((await t.upsert({ event_id: eventId, user_id: userId, status, updated_at: new Date().toISOString() }, { onConflict: "event_id,user_id" })).error);
      else fail((await t.delete().eq("event_id", eventId).eq("user_id", userId)).error);
    },
  };
}

/** In-memory store for tests. */
export function createMemorySocialStore(now: () => number = Date.now): SocialStore {
  const profiles = new Map<number, ProfileRow>();
  const posts: PostRow[] = [];
  const reactions: ReactionRow[] = [];
  const events: EventRow[] = [];
  const rsvps: RsvpRow[] = [];
  const iso = () => new Date(now()).toISOString();
  const byNewest = (a: { created_at: string }, b: { created_at: string }) => b.created_at.localeCompare(a.created_at);
  return {
    async getProfile(id) { return structuredClone(profiles.get(id) ?? { profile: cleanProfile(null), post_scope: "class" }); },
    async getProfiles(ids) { return new Map(ids.filter((i) => profiles.has(i)).map((i) => [i, structuredClone(profiles.get(i)!)])); },
    async saveProfile(id, p) { profiles.set(id, { profile: structuredClone(p), post_scope: profiles.get(id)?.post_scope ?? "class" }); },
    async setScope(id, scope) { profiles.set(id, { profile: profiles.get(id)?.profile ?? cleanProfile(null), post_scope: scope }); },
    async createPost(row) { const p: PostRow = { ...row, id: randomUUID(), created_at: iso(), reviewed_by: null, reviewed_at: null }; posts.push(p); return structuredClone(p); },
    async getPost(id) { return structuredClone(posts.find((p) => p.id === id) ?? null); },
    async visiblePosts({ teacherIds, schoolId, limit, everyone }) {
      return structuredClone(posts.filter((p) => p.status === "approved" && (everyone || (p.teacher_id != null && teacherIds.includes(p.teacher_id)) || (schoolId != null && p.scope === "school" && p.school_id === schoolId))).sort(byNewest).slice(0, limit));
    },
    async postsBy(a, limit) { return structuredClone(posts.filter((p) => p.author_id === a).sort(byNewest).slice(0, limit)); },
    async pendingFor(ids) { return structuredClone(posts.filter((p) => p.status === "pending" && (ids === "all" || (p.teacher_id != null && ids.includes(p.teacher_id))))); },
    async review(id, status, by, at) { const p = posts.find((x) => x.id === id); if (p) Object.assign(p, { status, reviewed_by: by, reviewed_at: at }); },
    async deletePost(id) { const i = posts.findIndex((p) => p.id === id); if (i >= 0) posts.splice(i, 1); for (let j = reactions.length - 1; j >= 0; j--) if (reactions[j].post_id === id) reactions.splice(j, 1); },
    async reactions(ids) { return structuredClone(reactions.filter((r) => ids.includes(r.post_id))); },
    async react(postId, userId, kind) {
      const i = reactions.findIndex((r) => r.post_id === postId && r.user_id === userId);
      if (i >= 0) reactions.splice(i, 1);
      if (kind) reactions.push({ post_id: postId, user_id: userId, kind });
    },
    async createEvent(row) { const e: EventRow = { ...row, id: randomUUID(), created_at: iso() }; events.push(e); return structuredClone(e); },
    async getEvent(id) { return structuredClone(events.find((e) => e.id === id) ?? null); },
    async visibleEvents({ hostIds, schoolId, fromDay }) {
      return structuredClone(events.filter((e) => e.starts_on >= fromDay && (hostIds.includes(e.host_id) || (schoolId != null && e.scope === "school" && e.school_id === schoolId))).sort((a, b) => a.starts_on.localeCompare(b.starts_on)));
    },
    async deleteEvent(id) { const i = events.findIndex((e) => e.id === id); if (i >= 0) events.splice(i, 1); for (let j = rsvps.length - 1; j >= 0; j--) if (rsvps[j].event_id === id) rsvps.splice(j, 1); },
    async rsvps(ids) { return structuredClone(rsvps.filter((r) => ids.includes(r.event_id))); },
    async setRsvp(eventId, userId, status) {
      const i = rsvps.findIndex((r) => r.event_id === eventId && r.user_id === userId);
      if (i >= 0) rsvps.splice(i, 1);
      if (status) rsvps.push({ event_id: eventId, user_id: userId, status });
    },
  };
}

/* ------------------------------------------------------------------ helpers */

/** "Jaylen Williams" → "Jaylen W." (students only ever show this way). */
export function studentName(displayName: string): string {
  const words = String(displayName || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "Student";
  return words.length === 1 ? words[0] : `${words[0]} ${words[words.length - 1][0].toUpperCase()}.`;
}
const publicName = (u: SocialUser) => (u.role === "student" ? studentName(u.displayName) : u.displayName || "Teacher");
const roleOf = (raw: any): SocialRole => (raw?.isAdmin ? "admin" : raw?.role === "teacher" ? "teacher" : raw?.role === "parent" ? "parent" : "student");
const EVENT_FORMATS = ["In class", "Live video", "Field trip", "After school", "Families · In person"];
const isDay = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));

/* ------------------------------------------------------------------ routes */

export function registerAriseSocialRoutes(app: Express, auth: RequestHandler, deps: SocialDeps) {
  const store = deps.store ?? createSupabaseSocialStore();
  const dir = deps.directory;
  const now = deps.now ?? Date.now;
  const random = deps.random ?? Math.random;
  const today = () => dayKey(now());
  const postsToday = createAttemptLimiter({ max: LIMITS.postsPerDay, windowMs: 24 * 3600_000, now });
  const eventsToday = createAttemptLimiter({ max: LIMITS.eventsPerDay, windowMs: 24 * 3600_000, now });
  const notify = (id: number, title: string, body: string) => { dir.notify?.(id, { title, body, url: "/social/" })?.catch?.(() => {}); };

  /** The signed-in account as Arise Social sees it (an admin previewing as a student counts as that student). */
  async function viewer(req: any): Promise<SocialUser & { band: BandId; grade: string | null }> {
    const raw = req.user || {};
    const role: SocialRole = req.adminPreview ? "student" : roleOf(raw);
    const grade = role === "student" ? await dir.gradeOf(Number(raw.id)).catch(() => null) : null;
    return {
      id: Number(raw.id), role, displayName: String(raw.displayName || raw.display_name || raw.username || ""),
      teacherId: raw.teacherId ? Number(raw.teacherId) : null, schoolId: raw.school_id ?? raw.schoolId ?? null,
      approvedByTeacher: raw.approvedByTeacher !== false, archived: !!raw.archivedAt, band: bandForGrade(grade), grade,
    };
  }
  const hasAccess = (req: any) => (deps.access ? deps.access.self(req) : Promise.resolve(true));
  const userHasAccess = (id: number) => (deps.access ? deps.access.user(id).catch(() => false) : Promise.resolve(true));
  /** Why a student can't post yet, or null when they can. */
  async function postBlock(v: SocialUser): Promise<string | null> {
    if (v.role !== "student") return null;
    if (!v.teacherId) return "Posting opens once you join a teacher’s class.";
    if (!v.approvedByTeacher) return "Posting opens once your teacher approves your account.";
    if (!(await userHasAccess(v.teacherId))) return "Your teacher hasn’t added Arise Social yet, so nobody can approve posts. Ask them about it!";
    return null;
  }
  const handle = (fn: (req: any, res: any) => Promise<unknown>) => async (req: any, res: any) => {
    try { await fn(req, res); }
    catch (error: any) {
      if (error instanceof SocialNotSetUp) return res.status(503).json({ message: "Arise Social is still being set up. Please check back soon.", setup: true });
      console.error("[arise-social]", error?.message || error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  };
  const noStore = (res: any) => res.set?.("Cache-Control", "no-store");
  /** Every route but the catalog and "who am I" needs the add-on. */
  const paid = (fn: (req: any, res: any) => Promise<unknown>) => handle(async (req, res) => {
    if (!(await hasAccess(req))) return res.status(402).json({ message: "Arise Social is a paid add-on. Add it to keep going.", code: "social_required" });
    return fn(req, res);
  });

  /** Which classes' posts and events this person sees. */
  async function reach(v: SocialUser): Promise<{ teacherIds: number[]; schoolId: number | null }> {
    if (v.role === "teacher") return { teacherIds: [v.id], schoolId: v.schoolId };
    if (v.role === "student") return { teacherIds: v.teacherId && v.approvedByTeacher ? [v.teacherId] : [], schoolId: v.teacherId && v.approvedByTeacher ? v.schoolId : null };
    return { teacherIds: [], schoolId: null };
  }
  async function canSeePost(v: SocialUser, p: PostRow) {
    if (p.author_id === v.id) return true;
    if (v.role === "admin") return true;
    if (p.status !== "approved") return v.role === "teacher" && p.teacher_id === v.id;
    const r = await reach(v);
    return (p.teacher_id != null && r.teacherIds.includes(p.teacher_id)) || (p.scope === "school" && r.schoolId != null && p.school_id === r.schoolId);
  }
  const canModerate = (v: SocialUser, p: PostRow) => v.role === "admin" || (v.role === "teacher" && p.teacher_id === v.id);

  async function present(v: SocialUser, rows: PostRow[]) {
    const ids = [...new Set(rows.map((p) => p.author_id))];
    const authors = new Map((await Promise.all(ids.map((id) => dir.user(id)))).filter(Boolean).map((u) => [u!.id, u!]));
    const reacts = await store.reactions(rows.map((p) => p.id));
    return rows.map((p) => {
      const a = authors.get(p.author_id);
      const mine = reacts.find((r) => r.post_id === p.id && r.user_id === v.id)?.kind ?? null;
      const counts = Object.fromEntries(REACTIONS.map((k) => [k, reacts.filter((r) => r.post_id === p.id && r.kind === k).length]));
      const quest = p.quest_id ? questById(p.quest_id) : null;
      return {
        id: p.id, author: a ? publicName(a) : "Former member", authorRole: p.author_role, mine: p.author_id === v.id,
        body: p.body, scope: p.scope, status: p.status, createdAt: p.created_at,
        quest: quest ? { id: quest.id, title: quest.title, c: quest.c } : null,
        career: p.career_id && careerById(p.career_id) ? { id: p.career_id, name: careerById(p.career_id)!.name, c: careerById(p.career_id)!.c } : null,
        reactions: counts, myReaction: mine, canDelete: p.author_id === v.id || canModerate(v, p),
      };
    });
  }

  async function profileOut(userId: number) {
    const row = await store.getProfile(userId);
    return { ...profileForDay(row.profile, today()), postScope: row.post_scope };
  }

  /* ---------- catalog (public: the page shows careers before anyone signs in) */
  app.get("/api/social/catalog", (_req: any, res: any) => {
    res.set?.("Cache-Control", "public, max-age=300");
    res.json({ bands: BANDS, clusters: CLUSTERS, careers: CAREERS, quests: QUESTS, roadmap: ROADMAP, scholarships: SCHOLARSHIPS, levels: LEVELS, xp: XP, limits: LIMITS, starters: YOUNG_STARTERS });
  });

  /* ---------- who am I */
  app.get("/api/social/me", auth, handle(async (req, res) => {
    const v = await viewer(req);
    noStore(res);
    const teacher = v.role === "student" && v.teacherId ? await dir.user(v.teacherId) : null;
    const block = await postBlock(v);
    const base = {
      access: await hasAccess(req),
      user: {
        id: v.id, role: v.role, name: v.role === "student" ? studentName(v.displayName) : v.displayName, band: v.band, grade: v.grade,
        schoolId: v.schoolId, teacherName: teacher ? teacher.displayName : null, canPost: v.role === "teacher" || (v.role === "student" && !block), postBlock: v.role === "admin" ? "Admins approve and remove posts; teachers and students post." : block,
      },
      today: today(),
    };
    if (v.role === "student") return res.json({ ...base, profile: await profileOut(v.id) });
    res.json(base);
  }));

  /* ---------- feed */
  app.get("/api/social/feed", auth, paid(async (req, res) => {
    const v = await viewer(req);
    noStore(res);
    if (v.role === "parent") return res.json({ posts: [] });
    const r = await reach(v);
    const visible = await store.visiblePosts({ ...r, limit: 60, everyone: v.role === "admin" });
    const own = v.role === "student" ? await store.postsBy(v.id, 20) : [];
    const seen = new Set<string>();
    const rows = [...own.filter((p) => p.status !== "approved"), ...visible, ...own.filter((p) => p.status === "approved")]
      .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60);
    res.json({ posts: await present(v, rows) });
  }));

  app.post("/api/social/posts", auth, paid(async (req, res) => {
    const v = await viewer(req);
    if (v.role === "parent" || v.role === "admin") return res.status(403).json({ message: "Posting is for students and teachers." });
    const block = await postBlock(v);
    if (block) return res.status(403).json({ message: block });
    if (postsToday.retryAfter(String(v.id))) return res.status(429).json({ message: "That’s all the posts for today. Try again tomorrow." });
    const body = req.body || {};
    let text = "";
    const questId = body.questId && questById(String(body.questId)) ? String(body.questId) : null;
    const careerId = body.careerId && careerById(String(body.careerId)) ? String(body.careerId) : null;
    if (v.role === "student" && isYoungBand(v.band)) {
      // K–5: the post is built here from the fixed choices; nothing typed is accepted.
      const starter = YOUNG_STARTERS[Number(body.starter)];
      if (!starter || !careerId) return res.status(400).json({ message: "Pick a sentence and a job." });
      text = `${starter} ${careerById(careerId)!.name.toLowerCase()}!`;
    } else {
      text = cleanPostText(body.text);
    }
    if (questId && v.role === "student") {
      const p = (await store.getProfile(v.id)).profile;
      if (p.quests[questId] !== "done") return res.status(400).json({ message: "Finish that quest before sharing it." });
    }
    if (!text && !questId) return res.status(400).json({ message: "Write something or attach a finished quest." });
    const scope: PostScope = v.role === "student" ? (await store.getProfile(v.id)).post_scope : body.scope === "school" ? "school" : "class";
    const isStaff = v.role === "teacher";
    const post = await store.createPost({
      author_id: v.id, author_role: isStaff ? "teacher" : "student",
      teacher_id: isStaff ? v.id : v.teacherId, school_id: v.schoolId,
      scope, body: text, quest_id: questId, career_id: careerId, status: isStaff ? "approved" : "pending",
    });
    postsToday.fail(String(v.id));
    if (!isStaff && v.teacherId) notify(v.teacherId, "Arise Social", `${studentName(v.displayName)} shared a post for you to check.`);
    res.status(201).json({ post: (await present(v, [post]))[0] });
  }));

  app.delete("/api/social/posts/:id", auth, paid(async (req, res) => {
    const v = await viewer(req);
    const p = await store.getPost(String(req.params.id));
    if (!p || !(p.author_id === v.id || canModerate(v, p))) return res.status(404).json({ message: "Post not found." });
    await store.deletePost(p.id);
    res.json({ ok: true });
  }));

  app.post("/api/social/posts/:id/react", auth, paid(async (req, res) => {
    const v = await viewer(req);
    if (v.role === "parent") return res.status(403).json({ message: "Reactions are for students and teachers." });
    const p = await store.getPost(String(req.params.id));
    if (!p || p.status !== "approved" || !(await canSeePost(v, p))) return res.status(404).json({ message: "Post not found." });
    const kind = req.body?.kind == null ? null : String(req.body.kind);
    if (kind !== null && !(REACTIONS as readonly string[]).includes(kind)) return res.status(400).json({ message: "Unknown reaction." });
    await store.react(p.id, v.id, kind as Reaction | null);
    res.json({ post: (await present(v, [p]))[0] });
  }));

  /* ---------- teacher approvals */
  app.get("/api/social/approvals", auth, paid(async (req, res) => {
    const v = await viewer(req);
    if (v.role !== "teacher" && v.role !== "admin") return res.status(403).json({ message: "Teachers only." });
    noStore(res);
    res.json({ posts: await present(v, await store.pendingFor(v.role === "admin" ? "all" : [v.id])) });
  }));

  app.post("/api/social/posts/:id/review", auth, paid(async (req, res) => {
    const v = await viewer(req);
    const p = await store.getPost(String(req.params.id));
    if (!p || !canModerate(v, p)) return res.status(404).json({ message: "Post not found." });
    const decision = req.body?.decision === "approve" ? "approved" : req.body?.decision === "reject" ? "rejected" : null;
    if (!decision) return res.status(400).json({ message: "Choose approve or send back." });
    await store.review(p.id, decision, v.id, new Date(now()).toISOString());
    notify(p.author_id, "Arise Social", decision === "approved" ? "Your post is live for your class." : "Your teacher sent your post back. Take another look.");
    res.json({ ok: true, status: decision });
  }));

  /* ---------- student progress (all scoring happens here) */
  async function withProfile(req: any, res: any, change: (p: SocialProfile, v: SocialUser & { band: BandId }) => { profile?: SocialProfile; error?: string; extra?: Record<string, unknown> }) {
    const v = await viewer(req);
    if (v.role !== "student") return res.status(403).json({ message: "This is for student accounts." });
    const current = (await store.getProfile(v.id)).profile;
    const out = change(current, v);
    if (out.error) return res.status(400).json({ message: out.error });
    if (out.profile) await store.saveProfile(v.id, out.profile);
    res.json({ profile: await profileOut(v.id), ...(out.extra || {}) });
  }

  app.post("/api/social/collect", auth, paid((req, res) => withProfile(req, res, (p) => {
    const id = String(req.body?.careerId || "");
    if (!careerById(id)) return { error: "Unknown career." };
    if (p.collected.includes(id)) return {};
    return { profile: awardXp({ ...p, collected: [...p.collected, id] }, XP.collect, today()), extra: { gained: XP.collect } };
  })));

  app.post("/api/social/save", auth, paid((req, res) => withProfile(req, res, (p) => {
    const id = String(req.body?.careerId || "");
    if (!careerById(id)) return { error: "Unknown career." };
    return { profile: { ...p, saved: p.saved.includes(id) ? p.saved.filter((x) => x !== id) : [...p.saved, id] } };
  })));

  app.post("/api/social/spin", auth, paid((req, res) => withProfile(req, res, (p) => {
    const day = today();
    if (p.spun?.day === day) return { extra: { career: p.spun.career, already: true } };
    const career = CAREERS[Math.floor(random() * CAREERS.length) % CAREERS.length].id;
    return { profile: awardXp({ ...p, spun: { day, career } }, XP.spin, day), extra: { career, gained: XP.spin } };
  })));

  app.post("/api/social/quests/:id/step", auth, paid((req, res) => withProfile(req, res, (p, v) => {
    const q = questById(String(req.params.id));
    if (!q || !QUESTS[v.band].some((x) => x.id === q.id)) return { error: "That quest isn’t in your grade’s list." };
    if (p.quests[q.id] === "done") return {};
    const i = Number(req.body?.step);
    if (!Number.isInteger(i) || i < 0 || i >= q.steps.length) return { error: "Unknown step." };
    const steps = Array.isArray(p.quests[q.id]) ? [...(p.quests[q.id] as boolean[])] : q.steps.map(() => false);
    steps[i] = req.body?.done === undefined ? !steps[i] : !!req.body.done;
    return { profile: { ...p, quests: { ...p.quests, [q.id]: steps } } };
  })));

  app.post("/api/social/quests/:id/complete", auth, paid((req, res) => withProfile(req, res, (p, v) => {
    const q = questById(String(req.params.id));
    if (!q || !QUESTS[v.band].some((x) => x.id === q.id)) return { error: "That quest isn’t in your grade’s list." };
    if (p.quests[q.id] === "done") return {};
    const steps = p.quests[q.id];
    if (!Array.isArray(steps) || !q.steps.every((_, i) => steps[i])) return { error: "Check off every step first." };
    return { profile: awardXp({ ...p, quests: { ...p.quests, [q.id]: "done" } }, q.xp, today()), extra: { gained: q.xp } };
  })));

  app.post("/api/social/roadmap", auth, paid((req, res) => withProfile(req, res, (p) => {
    const key = String(req.body?.key || "");
    const [g, i] = key.split("-").map(Number);
    const row = ROADMAP.find((r) => r.g === g);
    if (!row || !Number.isInteger(i) || i < 0 || i >= row.items.length) return { error: "Unknown roadmap step." };
    return { profile: { ...p, road: p.road.includes(key) ? p.road.filter((x) => x !== key) : [...p.road, key] } };
  })));

  /* ---------- parents */
  async function linkedChild(req: any, studentId: number) {
    const v = await viewer(req);
    if (v.role !== "parent") return { error: 403, v } as const;
    const ids = await dir.childrenOf(v.id);
    if (!ids.includes(studentId)) return { error: 404, v } as const;
    const child = await dir.user(studentId);
    if (!child || child.role !== "student" || child.archived) return { error: 404, v } as const;
    return { v, child } as const;
  }

  app.get("/api/social/children", auth, paid(async (req, res) => {
    const v = await viewer(req);
    if (v.role !== "parent") return res.status(403).json({ message: "Parent accounts only." });
    noStore(res);
    const ids = await dir.childrenOf(v.id);
    const kids = (await Promise.all(ids.map((id) => dir.user(id)))).filter((u): u is SocialUser => !!u && u.role === "student" && !u.archived);
    const out = [];
    for (const k of kids) {
      const grade = await dir.gradeOf(k.id).catch(() => null);
      const band = bandForGrade(grade);
      const events = await store.visibleEvents({ hostIds: k.teacherId ? [k.teacherId] : [], schoolId: k.teacherId ? k.schoolId : null, fromDay: today() });
      const rs = await store.rsvps(events.map((e) => e.id));
      out.push({
        id: k.id, name: studentName(k.displayName), firstName: k.displayName.split(/\s+/)[0] || "Your child", band, grade,
        hasClass: !!k.teacherId && k.approvedByTeacher, profile: await profileOut(k.id),
        events: events.map((e) => ({ ...eventOut(e, rs), status: rs.find((r) => r.event_id === e.id && r.user_id === k.id)?.status ?? null })),
      });
    }
    res.json({ children: out });
  }));

  app.put("/api/social/children/:id/settings", auth, paid(async (req, res) => {
    const r = await linkedChild(req, Number(req.params.id));
    if ("error" in r) return res.status(r.error).json({ message: r.error === 403 ? "Parent accounts only." : "That student is not linked to your account." });
    const scope = req.body?.postScope;
    if (scope !== "class" && scope !== "school") return res.status(400).json({ message: "Choose class or school." });
    await store.setScope(r.child.id, scope);
    res.json({ ok: true, postScope: scope });
  }));

  /* ---------- events */
  function eventOut(e: EventRow, rs: RsvpRow[]) {
    return {
      id: e.id, title: e.title, date: e.starts_on, time: e.time_label, format: e.format, cluster: e.cluster, scope: e.scope, seats: e.seats,
      going: rs.filter((r) => r.event_id === e.id && r.status === "going").length, hostId: e.host_id,
    };
  }

  app.get("/api/social/events", auth, paid(async (req, res) => {
    const v = await viewer(req);
    noStore(res);
    if (v.role === "parent") return res.json({ events: [] }); // parents see each child's events in /children
    const r = await reach(v);
    const events = await store.visibleEvents({ hostIds: r.teacherIds, schoolId: r.schoolId, fromDay: today() });
    const rs = await store.rsvps(events.map((e) => e.id));
    const hosts = new Map((await Promise.all([...new Set(events.map((e) => e.host_id))].map((id) => dir.user(id)))).filter(Boolean).map((u) => [u!.id, u!.displayName]));
    res.json({ events: events.map((e) => ({ ...eventOut(e, rs), host: hosts.get(e.host_id) || "Teacher", mine: e.host_id === v.id, myStatus: rs.find((x) => x.event_id === e.id && x.user_id === v.id)?.status ?? null })) });
  }));

  app.post("/api/social/events", auth, paid(async (req, res) => {
    const v = await viewer(req);
    if (v.role !== "teacher") return res.status(403).json({ message: "Teachers host events." });
    if (eventsToday.retryAfter(String(v.id))) return res.status(429).json({ message: "That’s all the new events for today." });
    const b = req.body || {};
    const title = cleanPostText(b.title).slice(0, LIMITS.eventTitle);
    if (!title) return res.status(400).json({ message: "Give the event a title." });
    if (!isDay(b.date) || String(b.date) < today()) return res.status(400).json({ message: "Pick a date that hasn’t passed." });
    const cluster = Object.prototype.hasOwnProperty.call(CLUSTERS, String(b.cluster)) ? String(b.cluster) : "help";
    const format = EVENT_FORMATS.includes(String(b.format)) ? String(b.format) : "In class";
    const seats = Math.min(1000, Math.max(1, Math.floor(Number(b.seats) || 30)));
    const time = String(b.time || "").replace(/[^\w :.-]/g, "").slice(0, 20);
    const e = await store.createEvent({ host_id: v.id, school_id: v.schoolId, scope: b.scope === "school" && v.schoolId ? "school" : "class", title, starts_on: String(b.date), time_label: time, format, cluster, seats });
    eventsToday.fail(String(v.id));
    res.status(201).json({ event: { ...eventOut(e, []), host: v.displayName, mine: true, myStatus: null } });
  }));

  app.delete("/api/social/events/:id", auth, paid(async (req, res) => {
    const v = await viewer(req);
    const e = await store.getEvent(String(req.params.id));
    if (!e || !(e.host_id === v.id || v.role === "admin")) return res.status(404).json({ message: "Event not found." });
    await store.deleteEvent(e.id);
    res.json({ ok: true });
  }));

  /** body: { action: "join" | "leave" } for students; parents add { studentId, action: "approve" | "join" | "leave" }. */
  app.post("/api/social/events/:id/rsvp", auth, paid(async (req, res) => {
    const e = await store.getEvent(String(req.params.id));
    if (!e) return res.status(404).json({ message: "Event not found." });
    const action = String(req.body?.action || "");
    let student: SocialUser & { band?: BandId };
    let byParent = false;
    const v = await viewer(req);
    if (v.role === "parent") {
      const r = await linkedChild(req, Number(req.body?.studentId));
      if ("error" in r) return res.status(404).json({ message: "That student is not linked to your account." });
      student = r.child; byParent = true;
    } else if (v.role === "student") student = v;
    else return res.status(403).json({ message: "Students and parents sign up for events." });
    const sees = (student.teacherId && student.approvedByTeacher && (e.host_id === student.teacherId || (e.scope === "school" && e.school_id === student.schoolId)));
    if (!sees || e.starts_on < today()) return res.status(404).json({ message: "Event not found." });
    const rs = await store.rsvps([e.id]);
    const current = rs.find((r) => r.user_id === student.id)?.status ?? null;
    const full = rs.filter((r) => r.status === "going").length >= e.seats;
    const young = byParent ? false : isYoungBand(bandForGrade(await dir.gradeOf(student.id).catch(() => null)));
    let next: RsvpRow["status"] | null = current;
    if (action === "leave") next = null;
    else if (action === "join" || action === "approve") {
      if (action === "approve" && !byParent) return res.status(403).json({ message: "A parent approves this." });
      if (young) next = current === "going" ? "going" : "requested";
      else {
        if (current !== "going" && full) return res.status(409).json({ message: "This event is full." });
        next = "going";
      }
    } else return res.status(400).json({ message: "Unknown choice." });
    await store.setRsvp(e.id, student.id, next);
    if (next === "requested" && current !== "requested") for (const pid of await parentsFor(student.id)) notify(pid, "Arise Social", `${studentName(student.displayName)} wants to join “${e.title}”.`);
    const after = await store.rsvps([e.id]);
    res.json({ event: { ...eventOut(e, after), myStatus: next } });
  }));
  const parentsFor = (studentId: number) => dir.parentsOf(studentId).catch(() => [] as number[]);

  /* ---------- teacher's class view */
  app.get("/api/social/class", auth, paid(async (req, res) => {
    const v = await viewer(req);
    if (v.role !== "teacher") return res.status(403).json({ message: "Teachers only." });
    noStore(res);
    const students = await dir.studentsOf(v.id);
    const profiles = await store.getProfiles(students.map((s) => s.id));
    const day = today();
    const weekAgo = dayKey(now() - 7 * 86400_000);
    const clusters: Record<string, number> = {};
    let questsDone = 0; let activeWeek = 0;
    const rows = students.map((s) => {
      const p = profileForDay(profiles.get(s.id)?.profile ?? cleanProfile(null), day);
      for (const id of p.collected) { const c = careerById(id)!.c; clusters[c] = (clusters[c] || 0) + 1; }
      const done = Object.values(p.quests).filter((x) => x === "done").length;
      questsDone += done;
      if (p.last_active && p.last_active >= weekAgo) activeWeek++;
      return { id: s.id, name: studentName(s.displayName), xp: p.xp, level: p.level + 1, collected: p.collected.length, questsDone: done, streak: p.streak, lastActive: p.last_active };
    });
    const pending = (await store.pendingFor([v.id])).length;
    res.json({ students: rows.sort((a, b) => b.xp - a.xp), totals: { students: students.length, activeWeek, questsDone, pending }, clusters });
  }));
}
