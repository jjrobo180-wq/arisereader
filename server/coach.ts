// Arise Coaching (shared/coach.ts): the trainer directory, the client–trainer connection, messages, the
// trainer's plan for each client, and the monthly listing fee trainers pay to be in the directory.
//
//   Public
//     GET  /api/coach/trainers                 listed trainers (directory)
//     GET  /api/coach/trainers/:id             one listing with its reviews
//   A client (Arise Fit)
//     GET  /api/coach/me                       my trainers: their plan for me, my side, unread counts
//     POST /api/coach/request                  ask a trainer to coach me, choosing what Arise Fit shares
//     PUT  /api/coach/links/:id/consent        change what's shared
//     PUT  /api/coach/links/:id/client         my habit checks, check-in answers, photos, steps
//     POST /api/coach/links/:id/done/:aid      I did an assigned workout
//     POST /api/coach/links/:id/appointment    ask for a session time
//     POST /api/coach/trainers/:id/review      review a trainer I've worked with
//   Either side
//     GET  /api/coach/links/:id/messages       the conversation (?after=<id> for new ones)
//     POST /api/coach/links/:id/messages       send one (the other side gets a notification)
//     POST /api/coach/links/:id/end            stop coaching (sharing stops at once)
//   A trainer (Arise Trainer)
//     GET  /api/coach/trainer                  my listing, plan status, library and clients
//     PUT  /api/coach/trainer/profile          my listing
//     PUT  /api/coach/trainer/library          workout templates, own exercises, programs, forms
//     POST /api/coach/links/:id/accept|decline a request
//     GET  /api/coach/links/:id/client         a client: their Arise Fit data (by consent), my plan, their side
//     PUT  /api/coach/links/:id/coaching       my plan for a client
//     POST /api/coach/trainer/broadcast        one message to several clients (a group)
//     POST /api/coach/reviews/:id/reply        answer a review
//     POST /api/coach/trainer/listing/checkout Stripe Checkout for the monthly listing (trial first)
//     POST /api/coach/trainer/listing/confirm  after paying: checks with Stripe and turns the listing on
//     POST /api/coach/trainer/listing/manage   Stripe's billing page (card, cancel)
//
// Data lives in public.coach_trainers, coach_links, coach_messages, coach_reviews, coach_library
// (migrations/coach.sql). Arise Fit data is read live from fit_data, so the trainer always sees what's
// current, limited to what the client chose to share.
import type { Express, RequestHandler } from "express";
import {
  LISTING, cleanClientSide, cleanCoaching, cleanConsent, cleanLibrary, cleanMessage, cleanReview, cleanTrainer, compliance, emptyClientSide, emptyCoaching,
  emptyLibrary, emptyTrainer, forClient, fromCents, listingProblems, snapshot,
  type ClientSide, type Coaching, type Consent, type Library, type LinkStatus, type Message, type PublicTrainer, type Review, type TrainerProfile,
} from "../shared/coach";
import { cleanFit, type FitData } from "../shared/fit";
import { createHmac } from "node:crypto";
import { cleanLead, cleanLeads, cleanSite, emptySite, idFromSlug, siteSlug, type Lead, type LeadStatus } from "../shared/coachSite";
import { createSupabaseKv, type FitKv } from "./fitKv";
import { createAttemptLimiter } from "./attemptLimiter";
import { registerCoachGroupRoutes } from "./coachGroups";
import { clientFacts, draftFor, flags as copilotFlags, progress as progressPlan, reflow as reflowPlan, score as copilotScore } from "../shared/coachCopilot";
import { checkinDue } from "../shared/coach";
import { clientsCsv, importClients, importWorkouts } from "../shared/coachImport";
import { CATALOG } from "../shared/fit";
import { cleanPlanWorkout as cleanWorkoutForAi } from "../shared/coach";

export type TrainerRow = { userId: number; profile: TrainerProfile; paidUntil: string | null; stripeCustomer: string | null; stripeSub: string | null; createdAt: string };
export type LinkRow = { id: string; trainerId: number; clientId: number; status: LinkStatus; consent: Consent; coaching: Coaching; clientSide: ClientSide; createdAt: string; updatedAt: string };
export type ReviewRow = Review & { clientId: number };

export interface CoachStore {
  trainer(userId: number): Promise<TrainerRow | null>;
  saveTrainer(row: TrainerRow): Promise<void>;
  /** Trainers whose listing is paid up to at least `nowIso`. */
  listed(nowIso: string): Promise<TrainerRow[]>;
  link(id: string): Promise<LinkRow | null>;
  linkBetween(trainerId: number, clientId: number): Promise<LinkRow | null>;
  linksOf(who: "trainer" | "client", userId: number): Promise<LinkRow[]>;
  saveLink(row: LinkRow): Promise<void>;
  messages(linkId: string, after: number, limit: number): Promise<Message[]>;
  addMessage(linkId: string, from: number, body: string, img?: string): Promise<Message>;
  markRead(linkId: string, reader: number): Promise<void>;
  unread(linkIds: string[], reader: number): Promise<Record<string, { count: number; last?: Message }>>;
  reviews(trainerId: number): Promise<ReviewRow[]>;
  allRatings(): Promise<Record<number, { sum: number; n: number }>>;
  saveReview(r: ReviewRow): Promise<void>;
  review(id: string): Promise<ReviewRow | null>;
  library(trainerId: number): Promise<Library | null>;
  saveLibrary(trainerId: number, lib: Library): Promise<void>;
}

const uuid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);

export function createMemoryCoachStore(): CoachStore {
  const trainers = new Map<number, TrainerRow>(), links = new Map<string, LinkRow>(), msgs: (Message & { linkId: string })[] = [], reviews = new Map<string, ReviewRow>(), libs = new Map<number, Library>();
  const clone = <T,>(x: T): T => structuredClone(x);
  return {
    async trainer(id) { return trainers.has(id) ? clone(trainers.get(id)!) : null; },
    async saveTrainer(r) { trainers.set(r.userId, clone(r)); },
    async listed(now) { return [...trainers.values()].filter((t) => t.paidUntil && t.paidUntil >= now).map(clone); },
    async link(id) { return links.has(id) ? clone(links.get(id)!) : null; },
    async linkBetween(t, c) { const l = [...links.values()].find((x) => x.trainerId === t && x.clientId === c); return l ? clone(l) : null; },
    async linksOf(who, id) { return [...links.values()].filter((l) => (who === "trainer" ? l.trainerId : l.clientId) === id).map(clone); },
    async saveLink(r) { links.set(r.id, clone(r)); },
    async messages(linkId, after, limit) { return msgs.filter((m) => m.linkId === linkId && m.id > after).slice(-limit).map(({ linkId: _l, ...m }) => clone(m)); },
    async addMessage(linkId, from, body, img) { const m = { linkId, id: msgs.length + 1, from, body, ...(img ? { img } : {}), at: new Date().toISOString(), read: false }; msgs.push(m); const { linkId: _l, ...out } = m; return clone(out); },
    async markRead(linkId, reader) { for (const m of msgs) if (m.linkId === linkId && m.from !== reader) m.read = true; },
    async unread(ids, reader) {
      const out: Record<string, { count: number; last?: Message }> = {};
      for (const id of ids) { const mine = msgs.filter((m) => m.linkId === id); const last = mine[mine.length - 1]; out[id] = { count: mine.filter((m) => m.from !== reader && !m.read).length, ...(last ? { last: (({ linkId: _l, ...m }) => m)(last) } : {}) }; }
      return out;
    },
    async reviews(t) { return [...reviews.values()].filter((r) => r.trainerId === t).sort((a, b) => b.date.localeCompare(a.date)).map(clone); },
    async allRatings() { const out: Record<number, { sum: number; n: number }> = {}; for (const r of reviews.values()) { const o = (out[r.trainerId] ??= { sum: 0, n: 0 }); o.sum += r.stars; o.n++; } return out; },
    async saveReview(r) { const old = [...reviews.values()].find((x) => x.trainerId === r.trainerId && x.clientId === r.clientId); if (old) reviews.delete(old.id); reviews.set(r.id, clone(r)); },
    async review(id) { return reviews.has(id) ? clone(reviews.get(id)!) : null; },
    async library(t) { return libs.has(t) ? clone(libs.get(t)!) : null; },
    async saveLibrary(t, l) { libs.set(t, clone(l)); },
  };
}

export function createSupabaseCoachStore(): CoachStore {
  const db = async () => (await import("./supabase")).supabase;
  const must = <T,>(r: { data: T; error: any }): T => { if (r.error) throw r.error; return r.data; };
  const toTrainer = (r: any): TrainerRow => ({ userId: Number(r.user_id), profile: cleanTrainer(r.profile), paidUntil: r.paid_until ?? null, stripeCustomer: r.stripe_customer ?? null, stripeSub: r.stripe_sub ?? null, createdAt: r.created_at });
  const toLink = (r: any): LinkRow => ({ id: r.id, trainerId: Number(r.trainer_id), clientId: Number(r.client_id), status: r.status, consent: cleanConsent(r.consent), coaching: cleanCoaching(r.coaching), clientSide: cleanClientSide(r.client_side), createdAt: r.created_at, updatedAt: r.updated_at });
  const toMsg = (r: any): Message => ({ id: Number(r.id), from: Number(r.sender_id), body: r.body || "", ...(r.img ? { img: r.img } : {}), at: r.created_at, read: !!r.read_at });
  const toReview = (r: any): ReviewRow => ({ id: r.id, trainerId: Number(r.trainer_id), clientId: Number(r.client_id), name: r.name || "", stars: Number(r.stars), text: r.text || "", date: r.created_at, ...(r.reply ? { reply: r.reply } : {}) });
  const LINK_COLS = "id, trainer_id, client_id, status, consent, coaching, client_side, created_at, updated_at";
  return {
    async trainer(id) { const r = must(await (await db()).from("coach_trainers").select("*").eq("user_id", id).maybeSingle()); return r ? toTrainer(r) : null; },
    async saveTrainer(t) { must(await (await db()).from("coach_trainers").upsert({ user_id: t.userId, profile: t.profile, paid_until: t.paidUntil, stripe_customer: t.stripeCustomer, stripe_sub: t.stripeSub, updated_at: new Date().toISOString() }, { onConflict: "user_id" })); },
    async listed(now) { return (must(await (await db()).from("coach_trainers").select("*").gte("paid_until", now).limit(2000)) as any[]).map(toTrainer); },
    async link(id) { if (!/^[0-9a-f-]{36}$/i.test(id)) return null; const r = must(await (await db()).from("coach_links").select(LINK_COLS).eq("id", id).maybeSingle()); return r ? toLink(r) : null; },
    async linkBetween(t, c) { const r = must(await (await db()).from("coach_links").select(LINK_COLS).eq("trainer_id", t).eq("client_id", c).maybeSingle()); return r ? toLink(r) : null; },
    async linksOf(who, id) { return (must(await (await db()).from("coach_links").select(LINK_COLS).eq(who === "trainer" ? "trainer_id" : "client_id", id).limit(1000)) as any[]).map(toLink); },
    async saveLink(l) { must(await (await db()).from("coach_links").upsert({ id: l.id, trainer_id: l.trainerId, client_id: l.clientId, status: l.status, consent: l.consent, coaching: l.coaching, client_side: l.clientSide, updated_at: new Date().toISOString() }, { onConflict: "id" })); },
    async messages(linkId, after, limit) { const rows = must(await (await db()).from("coach_messages").select("*").eq("link_id", linkId).gt("id", after).order("id", { ascending: false }).limit(limit)) as any[]; return rows.reverse().map(toMsg); },
    async addMessage(linkId, from, body, img) { return toMsg(must(await (await db()).from("coach_messages").insert({ link_id: linkId, sender_id: from, body, img: img ?? null }).select("*").single())); },
    async markRead(linkId, reader) { must(await (await db()).from("coach_messages").update({ read_at: new Date().toISOString() }).eq("link_id", linkId).neq("sender_id", reader).is("read_at", null)); },
    async unread(ids, reader) {
      const out: Record<string, { count: number; last?: Message }> = {};
      if (!ids.length) return out;
      const unreadRows = must(await (await db()).from("coach_messages").select("link_id").in("link_id", ids).neq("sender_id", reader).is("read_at", null).limit(5000)) as any[];
      for (const id of ids) out[id] = { count: unreadRows.filter((r) => r.link_id === id).length };
      await Promise.all(ids.map(async (id) => { const r = must(await (await db()).from("coach_messages").select("*").eq("link_id", id).order("id", { ascending: false }).limit(1)) as any[]; if (r[0]) out[id].last = toMsg(r[0]); }));
      return out;
    },
    async reviews(t) { return (must(await (await db()).from("coach_reviews").select("*").eq("trainer_id", t).order("created_at", { ascending: false }).limit(200)) as any[]).map(toReview); },
    async allRatings() { const rows = must(await (await db()).from("coach_reviews").select("trainer_id, stars").limit(20000)) as any[]; const out: Record<number, { sum: number; n: number }> = {}; for (const r of rows) { const o = (out[Number(r.trainer_id)] ??= { sum: 0, n: 0 }); o.sum += Number(r.stars); o.n++; } return out; },
    async saveReview(r) { must(await (await db()).from("coach_reviews").upsert({ id: r.id, trainer_id: r.trainerId, client_id: r.clientId, name: r.name, stars: r.stars, text: r.text, reply: r.reply ?? null }, { onConflict: "trainer_id,client_id" })); },
    async review(id) { if (!/^[0-9a-f-]{36}$/i.test(id)) return null; const r = must(await (await db()).from("coach_reviews").select("*").eq("id", id).maybeSingle()); return r ? toReview(r) : null; },
    async library(t) { const r = must(await (await db()).from("coach_library").select("data").eq("trainer_id", t).maybeSingle()) as any; return r ? cleanLibrary(r.data) : null; },
    async saveLibrary(t, l) { must(await (await db()).from("coach_library").upsert({ trainer_id: t, data: l, updated_at: new Date().toISOString() }, { onConflict: "trainer_id" })); },
  };
}

export type CoachDeps = {
  store?: CoachStore;
  /** A person's Arise Fit data (fit_data), for what their trainer may see. */
  fitData?: (userId: number) => Promise<FitData | null>;
  /** A person's first name for the other side to see. */
  nameOf?: (userId: number) => Promise<string>;
  notify?: (userId: number, m: { title: string; body: string; url: string; tag?: string }) => Promise<unknown>;
  stripeKey?: () => Promise<string>;
  /** Sends an email (Resend, server/routes.ts). Left out, emailed invites are off and the app offers the link to copy. */
  sendEmail?: (to: string, subject: string, html: string, options: { replyTo?: string; fromName?: string }) => Promise<{ sent: boolean; error?: string }>;
  fetch?: typeof fetch;
  appUrl?: string;
  /** Lets the site owner list a trainer for free (the free listing ends on its own). */
  isAdmin?: (req: any) => boolean;
  /** The AI that drafts workouts (OpenAI by default): takes the instructions and the request, returns JSON text. */
  ai?: (system: string, user: string) => Promise<string>;
  /** Signs invite links, so a code can't be guessed or changed to another trainer's. */
  inviteSecret?: string;
  /** Small JSON records (trainer websites and their leads). */
  kv?: FitKv;
  now?: () => number;
};

class Refused extends Error { constructor(message: string, public status = 400) { super(message); } }

const SITE = "https://arisetodo.com";
const stripeForm = (o: Record<string, unknown>, prefix = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => { const key = prefix ? `${prefix}[${k}]` : k; return v && typeof v === "object" ? stripeForm(v as Record<string, unknown>, key) : v === undefined ? [] : [`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`]; });

export function registerCoachRoutes(app: Express, auth: RequestHandler, deps: CoachDeps = {}) {
  const store = deps.store ?? createSupabaseCoachStore();
  const now = deps.now ?? Date.now;
  const fitData = deps.fitData ?? (async (id: number) => { const s = (await import("./fit")).createSupabaseFitStore(); const raw = await s.get(id); return raw ? cleanFit(raw) : null; });
  const nameOf = deps.nameOf ?? (async () => "");
  const notify = deps.notify ?? (async (userId: number, m: any) => { try { const { notifyUser } = await import("./pushNotifications"); await notifyUser(userId, m); } catch { /* notifications are a bonus */ } });
  const doFetch = deps.fetch ?? fetch;
  const sends = createAttemptLimiter({ max: 60, windowMs: 60_000 });
  const asks = createAttemptLimiter({ max: 10, windowMs: 60 * 60_000 });
  /** Counts one try; false once the limit for this key is used up. */
  const allow = (lim: ReturnType<typeof createAttemptLimiter>, key: string) => { if (lim.retryAfter(key)) return false; lim.fail(key); return true; };

  const me = (req: any): number => {
    const id = Number(req.user?.id);
    if (req.adminPreview || !Number.isSafeInteger(id) || id <= 0) throw new Refused("Sign in to your own account.", 403);
    return id;
  };
  const wrap = (fn: (req: any, res: any) => Promise<unknown>) => async (req: any, res: any) => {
    try { const out = await fn(req, res); if (!res.headersSent) res.json(out ?? { ok: true }); }
    catch (e: any) { if (e instanceof Refused) return res.status(e.status).json({ message: e.message }); console.error("[coach]", e?.message || e); res.status(500).json({ message: "Something went wrong. Try again in a moment." }); }
  };
  const first = async (id: number) => (await nameOf(id).catch(() => "")) || "Your client";
  const listedNow = (t: TrainerRow | null) => !!t?.paidUntil && Date.parse(t.paidUntil) >= now();

  async function publicOf(t: TrainerRow, ratings?: Record<number, { sum: number; n: number }>, clients?: number): Promise<PublicTrainer> {
    const r = (ratings ?? (await store.allRatings()))[t.userId] ?? { sum: 0, n: 0 };
    const { email: _e, phone: _p, welcome: _w, ...rest } = t.profile;
    return { ...rest, email: t.profile.email, phone: t.profile.phone, welcome: "", id: t.userId, rating: r.n ? Math.round((r.sum / r.n) * 10) / 10 : 0, reviews: r.n, since: t.createdAt, fromCents: fromCents(t.profile), clients: clients ?? 0 };
  }

  // ——— Directory (public) ————————————————————————————————————————————————————————————————————————
  let cache: { at: number; list: PublicTrainer[] } | null = null;
  app.get("/api/coach/trainers", wrap(async () => {
    if (cache && now() - cache.at < 60_000) return { trainers: cache.list };
    const [rows, ratings] = await Promise.all([store.listed(new Date(now()).toISOString()), store.allRatings()]);
    const list = await Promise.all(rows.filter((t) => !listingProblems(t.profile).length).map((t) => publicOf(t, ratings)));
    cache = { at: now(), list };
    return { trainers: list };
  }));
  app.get("/api/coach/trainers/:id", wrap(async (req) => {
    const t = await store.trainer(Number(req.params.id));
    if (!t || !listedNow(t)) throw new Refused("That trainer isn't listed right now.", 404);
    const reviews = (await store.reviews(t.userId)).map(({ clientId: _c, ...r }) => r);
    const active = (await store.linksOf("trainer", t.userId)).filter((l) => l.status === "active").length;
    return { trainer: await publicOf(t, undefined, active), reviews };
  }));

  // ——— The client side ——————————————————————————————————————————————————————————————————————————
  app.get("/api/coach/me", auth, wrap(async (req) => {
    const id = me(req);
    const links = (await store.linksOf("client", id)).filter((l) => l.status !== "declined" || Date.parse(l.updatedAt) > now() - 14 * 864e5);
    const unread = await store.unread(links.map((l) => l.id), id);
    const ratings = await store.allRatings();
    return { links: await Promise.all(links.map(async (l) => {
      const t = await store.trainer(l.trainerId);
      return { id: l.id, status: l.status, consent: l.consent, since: l.createdAt, coaching: forClient(l.coaching), clientSide: l.clientSide, unread: unread[l.id]?.count ?? 0, last: unread[l.id]?.last,
        trainer: t ? { ...(await publicOf(t, ratings)), welcome: l.status === "active" ? t.profile.welcome : "" } : null };
    })) };
  }));

  app.post("/api/coach/request", auth, wrap(async (req) => {
    const id = me(req);
    const trainerId = Number(req.body?.trainerId);
    if (trainerId === id) throw new Refused("You can't coach yourself here.");
    const t = await store.trainer(trainerId);
    if (!t || !listedNow(t)) throw new Refused("That trainer isn't listed right now.", 404);
    if (!t.profile.accepting) throw new Refused(`${t.profile.name} isn't taking new clients right now.`, 409);
    if (!allow(asks, `ask:${id}`)) throw new Refused("Too many requests. Try again later.", 429);
    const old = await store.linkBetween(trainerId, id);
    if (old && (old.status === "active" || old.status === "requested")) return { id: old.id, status: old.status };
    const stamp = new Date(now()).toISOString();
    const link: LinkRow = { id: old?.id ?? uuid(), trainerId, clientId: id, status: "requested", consent: cleanConsent(req.body?.consent), coaching: old?.coaching ?? emptyCoaching(), clientSide: old?.clientSide ?? emptyClientSide(), createdAt: old?.createdAt ?? stamp, updatedAt: stamp };
    await store.saveLink(link);
    const msg = cleanMessage(req.body?.message, null);
    if (msg?.body) await store.addMessage(link.id, id, msg.body);
    const who = await first(id);
    void notify(trainerId, { title: "New client request", body: `${who} wants you to coach them${msg?.body ? `: ${msg.body.slice(0, 120)}` : "."}`, url: "#/trainer", tag: `coach-${link.id}` });
    return { id: link.id, status: link.status };
  }));

  const linkFor = async (req: any, side: "client" | "trainer" | "either"): Promise<{ l: LinkRow; id: number; role: "client" | "trainer" }> => {
    const id = me(req);
    const l = await store.link(String(req.params.id || ""));
    if (!l) throw new Refused("That coaching connection wasn't found.", 404);
    const role = l.clientId === id ? "client" : l.trainerId === id ? "trainer" : null;
    if (!role || (side !== "either" && side !== role)) throw new Refused("That coaching connection wasn't found.", 404);
    return { l, id, role };
  };
  const touch = (l: LinkRow) => ({ ...l, updatedAt: new Date(now()).toISOString() });

  app.put("/api/coach/links/:id/consent", auth, wrap(async (req) => { const { l } = await linkFor(req, "client"); await store.saveLink(touch({ ...l, consent: cleanConsent(req.body?.consent) })); return { ok: true }; }));
  app.put("/api/coach/links/:id/client", auth, wrap(async (req) => {
    const { l } = await linkFor(req, "client");
    const side = cleanClientSide({ ...l.clientSide, ...(req.body && typeof req.body === "object" ? req.body : {}) });
    if (!l.consent.photos) side.photos = [];
    if (!l.consent.health) side.health = { steps: {}, active: {} };
    const checkedIn = side.checkins.length > l.clientSide.checkins.length;
    await store.saveLink(touch({ ...l, clientSide: side }));
    if (checkedIn) void notify(l.trainerId, { title: "Check-in submitted", body: `${await first(l.clientId)} answered their check-in.`, url: "#/trainer", tag: `coach-${l.id}` });
    return { ok: true };
  }));
  app.post("/api/coach/links/:id/done/:aid", auth, wrap(async (req) => {
    const { l } = await linkFor(req, "client");
    const aid = String(req.params.aid);
    const assigned = l.coaching.assigned.map((a) => (a.id === aid ? { ...a, done: new Date(now()).toISOString() } : a));
    await store.saveLink(touch({ ...l, coaching: { ...l.coaching, assigned } }));
    return { ok: true };
  }));
  app.post("/api/coach/links/:id/appointment", auth, wrap(async (req) => {
    const { l } = await linkFor(req, "client");
    const c = cleanCoaching({ ...l.coaching, appts: [...l.coaching.appts, { ...req.body, id: uuid().slice(0, 12), status: "booked", requested: true }] });
    await store.saveLink(touch({ ...l, coaching: { ...c, notes: l.coaching.notes } }));
    void notify(l.trainerId, { title: "Session requested", body: `${await first(l.clientId)} asked for a session.`, url: "#/trainer", tag: `coach-${l.id}` });
    return { ok: true };
  }));
  app.post("/api/coach/trainers/:id/review", auth, wrap(async (req) => {
    const id = me(req);
    const trainerId = Number(req.params.id);
    const l = await store.linkBetween(trainerId, id);
    // Only people who've actually been coached by the trainer can review them.
    if (!l || (l.status !== "active" && l.status !== "ended")) throw new Refused("You can review a trainer after they've coached you.", 403);
    const r = cleanReview(req.body);
    if (!r) throw new Refused("Pick 1 to 5 stars.");
    const old = (await store.reviews(trainerId)).find((x) => x.clientId === id);
    await store.saveReview({ id: old?.id ?? uuid(), trainerId, clientId: id, name: await first(id), stars: r.stars, text: r.text, date: new Date(now()).toISOString(), ...(old?.reply ? { reply: old.reply } : {}) });
    cache = null;
    return { ok: true };
  }));

  // ——— Messages ——————————————————————————————————————————————————————————————————————————————————
  app.get("/api/coach/links/:id/messages", auth, wrap(async (req) => {
    const { l, id } = await linkFor(req, "either");
    const after = Math.max(0, Number(req.query?.after) || 0);
    const list = await store.messages(l.id, after, 200);
    if (list.some((m) => m.from !== id && !m.read)) await store.markRead(l.id, id);
    return { messages: list };
  }));
  app.post("/api/coach/links/:id/messages", auth, wrap(async (req) => {
    const { l, id, role } = await linkFor(req, "either");
    if (l.status === "declined" || l.status === "ended") throw new Refused("This coaching has ended.", 409);
    if (!allow(sends, `msg:${id}`)) throw new Refused("Slow down a little.", 429);
    const m = cleanMessage(req.body?.body, req.body?.img);
    if (!m) throw new Refused("Write a message first.");
    const saved = await store.addMessage(l.id, id, m.body, m.img);
    const to = role === "client" ? l.trainerId : l.clientId;
    const fromName = role === "client" ? await first(id) : (await store.trainer(id))?.profile.name || "Your trainer";
    void notify(to, { title: fromName, body: m.body ? m.body.slice(0, 180) : "Sent a photo", url: role === "client" ? "#/trainer" : "#/fit", tag: `coach-${l.id}` });
    return { message: saved };
  }));
  app.post("/api/coach/links/:id/end", auth, wrap(async (req) => {
    const { l, role } = await linkFor(req, "either");
    await store.saveLink(touch({ ...l, status: l.status === "requested" && role === "trainer" ? "declined" : "ended" }));
    return { ok: true };
  }));

  // ——— The trainer side ——————————————————————————————————————————————————————————————————————————
  /** Brings the listing's paid-until date up to date with Stripe (once a day at most). */
  const checked = new Map<number, number>();
  async function refreshPlan(t: TrainerRow): Promise<TrainerRow> {
    if (!t.stripeSub || (checked.get(t.userId) ?? 0) > now() - 864e5) return t;
    if (t.paidUntil && Date.parse(t.paidUntil) > now() + 3 * 864e5) return t;
    checked.set(t.userId, now());
    try {
      const sub = await stripe("GET", `/subscriptions/${encodeURIComponent(t.stripeSub)}`);
      const end = Number(sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end) * 1000;
      const live = sub?.status === "active" || sub?.status === "trialing" || sub?.status === "past_due";
      const next = { ...t, paidUntil: live && end ? new Date(end + 2 * 864e5).toISOString() : t.paidUntil };
      if (next.paidUntil !== t.paidUntil) { await store.saveTrainer(next); cache = null; }
      return next;
    } catch { return t; }
  }

  app.get("/api/coach/trainer", auth, wrap(async (req) => {
    const id = me(req);
    let t = await store.trainer(id);
    if (t) t = await refreshPlan(t);
    const profile = t?.profile ?? emptyTrainer(await first(id).then((n) => (n === "Your client" ? "" : n)));
    const links = (await store.linksOf("trainer", id)).filter((l) => l.status === "active" || l.status === "requested");
    const unread = await store.unread(links.map((l) => l.id), id);
    const clients = await Promise.all(links.map(async (l) => {
      const fit = l.status === "active" && l.consent.workouts ? await fitData(l.clientId).catch(() => null) : null;
      return { id: l.id, clientId: l.clientId, name: await first(l.clientId), status: l.status, since: l.createdAt, consent: l.consent, tags: l.coaching.tags, phase: l.coaching.phase ?? "",
        unread: unread[l.id]?.count ?? 0, last: unread[l.id]?.last, compliance: compliance(l.coaching, l.clientSide, fit?.workouts, new Date(now())),
        lastWorkout: fit?.workouts.length ? fit.workouts[fit.workouts.length - 1].date : null, nextAppt: l.coaching.appts.find((a) => a.status === "booked" && Date.parse(a.at) > now())?.at ?? null };
    }));
    const reviews = t ? (await store.reviews(id)).map(({ clientId: _c, ...r }) => r) : [];
    return { profile, listed: listedNow(t), paidUntil: t?.paidUntil ?? null, subscribed: !!t?.stripeSub, problems: listingProblems(profile), library: (await store.library(id)) ?? emptyLibrary(),
      clients, reviews, price: LISTING, payments: !!(await (deps.stripeKey?.() ?? Promise.resolve("")).catch(() => "")) };
  }));

  app.put("/api/coach/trainer/profile", auth, wrap(async (req) => {
    const id = me(req);
    const old = await store.trainer(id);
    const profile = cleanTrainer(req.body?.profile);
    await store.saveTrainer({ userId: id, profile, paidUntil: old?.paidUntil ?? null, stripeCustomer: old?.stripeCustomer ?? null, stripeSub: old?.stripeSub ?? null, createdAt: old?.createdAt ?? new Date(now()).toISOString() });
    cache = null;
    return { profile, problems: listingProblems(profile) };
  }));
  app.put("/api/coach/trainer/library", auth, wrap(async (req) => { const id = me(req); const lib = cleanLibrary(req.body?.library); await store.saveLibrary(id, lib); return { library: lib }; }));

  const num = (v: unknown, lo: number, hi: number, fb: number) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : fb; };
  // ── Inviting a client directly (no directory listing needed, no client limit) ────────────────────────────
  // A trainer shares a link; the client opens it in Arise Fit, picks what to share, and they're connected at once.
  const secret = deps.inviteSecret ?? process.env.COACH_INVITE_SECRET ?? process.env.SESSION_SECRET ?? process.env.JWT_SECRET ?? "arise-coach-invites";
  const sign = (trainerId: number) => createHmac("sha256", secret).update(`invite:${trainerId}`).digest("base64url").slice(0, 10);
  const inviteCode = (trainerId: number) => `${trainerId.toString(36)}-${sign(trainerId)}`;
  const trainerOfCode = (code: string): number | null => {
    const m = /^([0-9a-z]{1,10})-([A-Za-z0-9_-]{10})$/.exec(String(code || ""));
    if (!m) return null;
    const id = parseInt(m[1], 36);
    return Number.isSafeInteger(id) && id > 0 && sign(id) === m[2] ? id : null;
  };
  const joins = createAttemptLimiter({ max: 20, windowMs: 60 * 60_000 });
  app.get("/api/coach/trainer/invite", auth, wrap(async (req) => { const id = me(req); const code = inviteCode(id); return { code, url: `${deps.appUrl ?? SITE}/#/fit?coach=${code}` }; }));
  app.get("/api/coach/invite/:code", wrap(async (req) => {
    const tid = trainerOfCode(req.params.code);
    const t = tid ? await store.trainer(tid) : null;
    if (!tid) throw new Refused("That invite link isn't right. Ask your trainer to send it again.", 404);
    const name = t?.profile.name || (await first(tid));
    return { trainer: { id: tid, name, photo: t?.profile.photo ?? "", headline: t?.profile.headline ?? "" } };
  }));
  app.post("/api/coach/invite/:code/join", auth, wrap(async (req) => {
    const id = me(req);
    const tid = trainerOfCode(req.params.code);
    if (!tid) throw new Refused("That invite link isn't right. Ask your trainer to send it again.", 404);
    if (tid === id) throw new Refused("That's your own invite link. Send it to a client.");
    if (!allow(joins, `join:${id}`)) throw new Refused("Too many tries. Try again later.", 429);
    const old = await store.linkBetween(tid, id);
    const stamp = new Date(now()).toISOString();
    if (old?.status === "active") return { id: old.id, status: "active" };
    const link: LinkRow = { id: old?.id ?? uuid(), trainerId: tid, clientId: id, status: "active", consent: cleanConsent(req.body?.consent), coaching: old?.coaching ?? emptyCoaching(), clientSide: old?.clientSide ?? emptyClientSide(), createdAt: old?.createdAt ?? stamp, updatedAt: stamp };
    await store.saveLink(link);
    const t = await store.trainer(tid);
    if (t?.profile.welcome) await store.addMessage(link.id, tid, t.profile.welcome);
    void notify(tid, { title: "New client", body: `${await first(id)} joined from your invite link.`, url: "#/trainer", tag: `coach-${link.id}` });
    return { id: link.id, status: "active" };
  }));

  // ── The AI workout and program builder ───────────────────────────────────────────────────────────────────
  // It may only use Arise Fit's catalog, so every move it picks has a name and a demo video in the client's app.
  const aiLimit = createAttemptLimiter({ max: 40, windowMs: 60 * 60_000 });
  const callAi = deps.ai ?? (async (system: string, user: string) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Refused("The AI builder isn't set up on this server yet.", 503);
    const r = await doFetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4.1-mini", temperature: 0.4, max_tokens: 4000, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }), signal: AbortSignal.timeout(60_000) });
    if (!r.ok) throw new Refused("The AI builder is busy. Try again in a minute.", 503);
    return String((await r.json())?.choices?.[0]?.message?.content ?? "{}");
  });
  const EQUIP: Record<string, string[]> = { gym: [], dumbbells: ["dumbbell", "bodyweight", "bench", "band", "kettlebell"], home: ["bodyweight", "band", "other"] };
  const catalogFor = (equip: string) => CATALOG.filter((e) => !EQUIP[equip]?.length || EQUIP[equip].includes(e.equipment));
  const brief = (b: any) => ({
    goal: String(b?.goal ?? "general fitness").slice(0, 120), level: ["beginner", "intermediate", "advanced"].includes(b?.level) ? b.level : "intermediate",
    equip: ["gym", "dumbbells", "home"].includes(b?.equip) ? b.equip : "gym", minutes: Math.round(num(b?.minutes, 10, 120, 45)), focus: String(b?.focus ?? "").slice(0, 120), notes: String(b?.notes ?? "").slice(0, 400),
  });
  const RULES = (list: typeof CATALOG) => `You are an expert, certified strength and conditioning coach writing plans for a personal trainer to give a client.
Use ONLY these exercises, by their exact id:
${list.map((e) => `${e.id}: ${e.name} (${e.muscle}, ${e.equipment})`).join("\n")}
Each item: {"exId": an id above, "sets": 1-8, "reps": text like "8-10", "12", "30s" or "10 min", "rest": seconds 0-300, "note": a short coaching cue}.
Order exercises sensibly (big compound lifts first). Respect injuries or limits in the notes. Reply with JSON only.`;
  const toWorkout = (raw: any, fallbackName: string) => {
    const known = new Map(CATALOG.map((e) => [e.id, e.name]));
    const items = (Array.isArray(raw?.items) ? raw.items : []).filter((i: any) => known.has(String(i?.exId))).slice(0, 14)
      .map((i: any) => ({ exId: String(i.exId), name: known.get(String(i.exId))!, sets: Math.round(num(i.sets, 1, 8, 3)), reps: String(i.reps ?? "10").slice(0, 16), rest: Math.round(num(i.rest, 0, 300, 90)), ...(i.note ? { note: String(i.note).slice(0, 200) } : {}) }));
    return cleanWorkoutForAi({ id: uuid().slice(0, 12), name: String(raw?.name || fallbackName).slice(0, 80), note: raw?.note ? String(raw.note).slice(0, 600) : undefined, mins: raw?.mins, items });
  };
  app.post("/api/coach/trainer/ai/workout", auth, wrap(async (req) => {
    const id = me(req);
    if (!allow(aiLimit, `ai:${id}`)) throw new Refused("That's a lot of AI drafts for one hour. Try again later.", 429);
    const b = brief(req.body);
    const out = JSON.parse(await callAi(`${RULES(catalogFor(b.equip))}\nReturn {"name": a short workout name, "note": one or two sentences to the client, "mins": number, "items": [...]}.`,
      `One workout. Goal: ${b.goal}. Level: ${b.level}. Equipment: ${b.equip}. About ${b.minutes} minutes.${b.focus ? ` Focus: ${b.focus}.` : ""}${b.notes ? ` Notes: ${b.notes}` : ""}`).catch(() => "{}"));
    const workout = toWorkout(out, `${b.goal} workout`);
    if (!workout || workout.items.length < 2) throw new Refused("The AI didn't come back with a usable workout. Try again or change the request.", 502);
    return { workout };
  }));
  app.post("/api/coach/trainer/ai/program", auth, wrap(async (req) => {
    const id = me(req);
    if (!allow(aiLimit, `ai:${id}`)) throw new Refused("That's a lot of AI drafts for one hour. Try again later.", 429);
    const b = brief(req.body);
    const perWeek = Math.round(num(req.body?.perWeek, 1, 6, 3)), weeks = Math.round(num(req.body?.weeks, 1, 16, 6));
    const out = JSON.parse(await callAi(`${RULES(catalogFor(b.equip))}\nReturn {"name": program name, "note": two sentences on how to run it and progress, "workouts": [{"name", "note", "mins", "items": [...]}], "week": [{"weekday": 0-6 (0 = Sunday), "workout": index into workouts}]}. Use ${perWeek} training days per week, spread out with rest days.`,
      `A ${weeks}-week program, ${perWeek} days a week. Goal: ${b.goal}. Level: ${b.level}. Equipment: ${b.equip}. About ${b.minutes} minutes a session.${b.focus ? ` Focus: ${b.focus}.` : ""}${b.notes ? ` Notes: ${b.notes}` : ""}`).catch(() => "{}"));
    const workouts = (Array.isArray(out?.workouts) ? out.workouts : []).slice(0, 7).map((w: any, i: number) => toWorkout(w, `Day ${i + 1}`)).filter((w: any) => w && w.items.length >= 2);
    if (!workouts.length) throw new Refused("The AI didn't come back with a usable program. Try again or change the request.", 502);
    const week: { weekday: number; workout: number }[] = (Array.isArray(out?.week) ? out.week : []).map((d: any) => ({ weekday: Math.round(num(d?.weekday, 0, 6, 1)), workout: Math.round(num(d?.workout, 0, workouts.length - 1, 0)) }))
      .filter((d: { weekday: number }, i: number, all: { weekday: number }[]) => all.findIndex((x) => x.weekday === d.weekday) === i).slice(0, perWeek);
    const pattern = week.length ? week : workouts.map((_: unknown, i: number) => ({ weekday: [1, 3, 5, 2, 4, 6, 0][i], workout: i })).slice(0, perWeek);
    const days = Array.from({ length: weeks }, (_, k) => pattern.map((d) => ({ day: k * 7 + d.weekday, workoutId: workouts[d.workout].id }))).flat().sort((a, c) => a.day - c.day);
    return { workouts, program: { id: uuid().slice(0, 12), name: String(out?.name || `${b.goal}: ${weeks} weeks`).slice(0, 80), weeks, ...(out?.note ? { note: String(out.note).slice(0, 600) } : {}), days } };
  }));

  // ── Trainer websites (shared/coachSite.ts) ──────────────────────────────────────────────────────────────
  const kv = deps.kv ?? createSupabaseKv();
  const siteKey = (id: number) => `coach-site:${id}`, leadsKey = (id: number) => `coach-leads:${id}`;
  const siteUrl = (slug: string) => `${deps.appUrl ?? SITE}/#/t/${slug}`;
  app.get("/api/coach/trainer/site", auth, wrap(async (req) => {
    const id = me(req); const t = await store.trainer(id);
    const site = cleanSite((await kv.get(siteKey(id))) ?? emptySite());
    const slug = siteSlug(t?.profile.name || (await first(id)), id);
    return { site, slug, url: siteUrl(slug) };
  }));
  app.put("/api/coach/trainer/site", auth, wrap(async (req) => {
    const id = me(req); const site = cleanSite(req.body?.site);
    const t = await store.trainer(id);
    if (site.published && !(t?.profile.name)) throw new Refused("Add your name to your listing before you publish your site.");
    await kv.set(siteKey(id), site);
    return { site, url: siteUrl(siteSlug(t?.profile.name || "", id)) };
  }));
  app.get("/api/coach/site/:slug", wrap(async (req) => {
    const id = idFromSlug(req.params.slug);
    const t = id ? await store.trainer(id) : null;
    const site = id ? cleanSite((await kv.get(siteKey(id))) ?? emptySite()) : null;
    if (!id || !t || !site?.published) throw new Refused("This site isn't published.", 404);
    const reviews = site.showReviews ? (await store.reviews(id)).map(({ clientId: _c, ...r }) => r).slice(0, 12) : []; // newest first
    const p = t.profile;
    return { site, slug: siteSlug(p.name, id), invite: inviteCode(id), reviews,
      trainer: { id, name: p.name, headline: p.headline, bio: p.bio, photo: p.photo, specialties: p.specialties, certifications: p.certifications, years: p.years, languages: p.languages, city: p.city, state: p.state, modes: p.modes, prices: site.showPrices ? p.prices : [], instagram: p.instagram, bookingUrl: p.bookingUrl, accepting: p.accepting } };
  }));
  const leadLimit = createAttemptLimiter({ max: 5, windowMs: 60 * 60_000 });
  app.post("/api/coach/site/:slug/lead", wrap(async (req) => {
    const id = idFromSlug(req.params.slug);
    const site = id ? cleanSite((await kv.get(siteKey(id))) ?? emptySite()) : null;
    if (!id || !site?.published) throw new Refused("This site isn't published.", 404);
    // A filled-in hidden field means a bot.
    if (req.body?.website) return { ok: true };
    const who = String(req.headers?.["x-forwarded-for"] ?? req.ip ?? "anon").split(",")[0].trim();
    if (!allow(leadLimit, `lead:${id}:${who}`)) throw new Refused("Thanks! You've already sent a few messages. The coach will be in touch.", 429);
    const lead = cleanLead(req.body, new Date(now()).toISOString());
    if (!lead) throw new Refused("Add your name and an email or phone number so the coach can reach you.");
    const leads = cleanLeads(await kv.get(leadsKey(id)));
    await kv.set(leadsKey(id), [lead, ...leads].slice(0, 2000));
    void notify(id, { title: "New lead from your website", body: `${lead.name}${lead.goal ? ` · ${lead.goal}` : ""}${lead.message ? `: ${lead.message.slice(0, 100)}` : ""}`, url: "#/trainer", tag: `lead-${lead.id}` });
    return { ok: true };
  }));
  app.get("/api/coach/trainer/leads", auth, wrap(async (req) => ({ leads: cleanLeads(await kv.get(leadsKey(me(req)))) })));
  app.put("/api/coach/trainer/leads/:lid", auth, wrap(async (req) => {
    const id = me(req); const leads = cleanLeads(await kv.get(leadsKey(id)));
    const status = String(req.body?.status) as LeadStatus;
    const next = req.body?.remove ? leads.filter((l: Lead) => l.id !== req.params.lid) : leads.map((l: Lead) => (l.id === req.params.lid && ["new", "contacted", "won", "lost"].includes(status) ? { ...l, status } : l));
    await kv.set(leadsKey(id), next);
    return { leads: next };
  }));
  app.post("/api/coach/trainer/site/ai", auth, wrap(async (req) => {
    const id = me(req);
    if (!allow(aiLimit, `ai:${id}`)) throw new Refused("That's a lot of AI drafts for one hour. Try again later.", 429);
    const t = await store.trainer(id); const p = t?.profile;
    if (!p?.name) throw new Refused("Fill in your listing first (at least your name and a few lines about you), then AI can write your site.");
    const out = JSON.parse(await callAi(`You write warm, specific, professional website copy for an independent personal trainer. Never invent certifications, numbers, awards or client results. Plain English, no hype words like "ultimate" or "revolutionary". Reply with JSON: {"heroTitle": max 8 words, "heroSub": one sentence, "about": 2 short paragraphs in first person, "services": [{"title", "text": one or two sentences, "price": short text or ""}] (3-5), "faqs": [{"q","a"}] (4-6)}.`,
      JSON.stringify({ name: p.name, headline: p.headline, bio: p.bio, specialties: p.specialties, certifications: p.certifications, years: p.years, city: p.city, state: p.state, modes: p.modes, prices: p.prices.map((x) => ({ label: x.label, mode: x.mode, dollars: x.cents / 100, per: x.per, sessions: x.sessions })), tone: String(req.body?.tone ?? "").slice(0, 60) })).catch(() => "{}"));
    const draft = cleanSite({ ...emptySite(), ...out, services: (out?.services ?? []).map((x: any, i: number) => ({ ...x, id: `s${i}` })), faqs: (out?.faqs ?? []).map((x: any, i: number) => ({ ...x, id: `f${i}` })) });
    if (!draft.heroTitle && !draft.about) throw new Refused("The AI didn't come back with usable copy. Try again.", 502);
    return { draft: { heroTitle: draft.heroTitle, heroSub: draft.heroSub, about: draft.about, services: draft.services, faqs: draft.faqs } };
  }));

  const decide = (status: "active" | "declined") => wrap(async (req) => {
    const { l } = await linkFor(req, "trainer");
    if (l.status !== "requested") return { ok: true, status: l.status };
    await store.saveLink(touch({ ...l, status }));
    const t = await store.trainer(l.trainerId);
    if (status === "active") {
      if (t?.profile.welcome) await store.addMessage(l.id, l.trainerId, t.profile.welcome);
      void notify(l.clientId, { title: "You have a trainer", body: `${t?.profile.name || "Your trainer"} accepted. Say hi and check your plan in Arise Fit.`, url: "#/fit", tag: `coach-${l.id}` });
    }
    return { ok: true, status };
  });
  app.post("/api/coach/links/:id/accept", auth, decide("active"));
  app.post("/api/coach/links/:id/decline", auth, decide("declined"));

  app.get("/api/coach/links/:id/client", auth, wrap(async (req) => {
    const { l } = await linkFor(req, "trainer");
    const fit = l.status === "active" ? await fitData(l.clientId).catch(() => null) : null;
    const snap = snapshot(fit, l.consent, await first(l.clientId), l.createdAt, new Date(now()));
    return { id: l.id, status: l.status, consent: l.consent, coaching: l.coaching, clientSide: l.clientSide, snapshot: snap, compliance: compliance(l.coaching, l.clientSide, fit?.workouts, new Date(now()), 7), compliance30: compliance(l.coaching, l.clientSide, fit?.workouts, new Date(now()), 30) };
  }));
  app.put("/api/coach/links/:id/coaching", auth, wrap(async (req) => {
    const { l } = await linkFor(req, "trainer");
    const next = cleanCoaching(req.body?.coaching);
    // Keep what the client already finished (they mark workouts done from their phone).
    const done = new Map(l.coaching.assigned.filter((a) => a.done).map((a) => [a.id, a.done!]));
    next.assigned = next.assigned.map((a) => (done.has(a.id) && !a.done ? { ...a, done: done.get(a.id) } : a));
    const added = next.assigned.filter((a) => !l.coaching.assigned.some((x) => x.id === a.id)).length;
    await store.saveLink(touch({ ...l, coaching: next }));
    if (added && l.status === "active" && req.body?.notify !== false) void notify(l.clientId, { title: "New workouts from your trainer", body: `${added} new ${added === 1 ? "workout is" : "workouts are"} on your plan.`, url: "#/fit", tag: `coach-${l.id}` });
    return { coaching: next };
  }));
  app.post("/api/coach/trainer/broadcast", auth, wrap(async (req) => {
    const id = me(req);
    const m = cleanMessage(req.body?.body, req.body?.img);
    if (!m) throw new Refused("Write a message first.");
    const ids = new Set((Array.isArray(req.body?.linkIds) ? req.body.linkIds : []).map(String).slice(0, 500));
    const links = (await store.linksOf("trainer", id)).filter((l) => l.status === "active" && ids.has(l.id));
    if (!allow(sends, `cast:${id}`)) throw new Refused("Slow down a little.", 429);
    const name = (await store.trainer(id))?.profile.name || "Your trainer";
    for (const l of links) { await store.addMessage(l.id, id, m.body, m.img); void notify(l.clientId, { title: name, body: m.body.slice(0, 180) || "Sent a photo", url: "#/fit", tag: `coach-${l.id}` }); }
    return { sent: links.length };
  }));
  app.post("/api/coach/reviews/:id/reply", auth, wrap(async (req) => {
    const id = me(req);
    const r = await store.review(String(req.params.id));
    if (!r || r.trainerId !== id) throw new Refused("That review wasn't found.", 404);
    await store.saveReview({ ...r, reply: String(req.body?.reply ?? "").trim().slice(0, 800) || undefined });
    return { ok: true };
  }));

  // ——— The listing fee (Stripe) ————————————————————————————————————————————————————————————————————
  async function stripe(method: "GET" | "POST", path: string, params?: Record<string, unknown>): Promise<any> {
    const key = (await deps.stripeKey?.().catch(() => "")) || "";
    if (!key) throw new Refused("Payments aren't set up yet. Try again soon.", 409);
    const res = await doFetch(`https://api.stripe.com/v1${path}`, { method, headers: { Authorization: `Bearer ${key}`, ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) }, body: method === "POST" && params ? stripeForm(params).join("&") : undefined });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) { console.error("[coach] Stripe refused", res.status, data?.error?.code); throw new Refused("The payment service couldn't do that. Nothing was charged.", 502); }
    return data;
  }
  const back = (req: any) => {
    const asked = String(req.body?.returnTo || "");
    try { const u = new URL(asked); if (u.protocol === "https:" && [new URL(deps.appUrl || SITE).host, "arisetodo.com", "www.arisetodo.com"].includes(u.host)) return u.origin + u.pathname; } catch { /* default */ }
    return (deps.appUrl || SITE).replace(/\/$/, "") + "/";
  };
  app.post("/api/coach/trainer/listing/checkout", auth, wrap(async (req) => {
    const id = me(req);
    const t = await store.trainer(id);
    if (!t) throw new Refused("Fill in your listing first.");
    const problems = listingProblems(t.profile);
    if (problems.length) throw new Refused(`Before your listing goes live: ${problems.join("; ")}.`);
    const base = back(req);
    const session = await stripe("POST", "/checkout/sessions", {
      mode: "subscription", client_reference_id: String(id), success_url: `${base}#/trainer?listing={CHECKOUT_SESSION_ID}`, cancel_url: `${base}#/trainer`,
      ...(t.stripeCustomer ? { customer: t.stripeCustomer } : { customer_email: req.user?.email || undefined }),
      line_items: { 0: { quantity: 1, price_data: { currency: "usd", unit_amount: LISTING.cents, recurring: { interval: "month" }, product_data: { name: LISTING.name, description: "Your profile, prices and reviews in the Arise trainer directory, and the Arise Trainer coaching app." } } } },
      subscription_data: { ...(t.stripeSub ? {} : { trial_period_days: LISTING.trialDays }), metadata: { arise_trainer: String(id) } },
      metadata: { arise_trainer: String(id) },
    });
    return { url: session.url };
  }));
  app.post("/api/coach/trainer/listing/confirm", auth, wrap(async (req) => {
    const id = me(req);
    const sid = String(req.body?.session || "");
    if (!/^cs_[A-Za-z0-9_]{8,200}$/.test(sid)) throw new Refused("That payment wasn't found.");
    const s = await stripe("GET", `/checkout/sessions/${sid}?expand%5B%5D=subscription`);
    if (String(s?.client_reference_id) !== String(id) && String(s?.metadata?.arise_trainer) !== String(id)) throw new Refused("That payment belongs to someone else.", 403);
    const sub = s?.subscription;
    const live = s?.status === "complete" && sub && (sub.status === "active" || sub.status === "trialing");
    if (!live) throw new Refused("The payment hasn't gone through yet.", 409);
    const t = (await store.trainer(id))!;
    const end = Number(sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? sub.trial_end) * 1000 || now() + 31 * 864e5;
    await store.saveTrainer({ ...t, stripeCustomer: String(s.customer || t.stripeCustomer || "") || null, stripeSub: String(sub.id), paidUntil: new Date(end + 2 * 864e5).toISOString() });
    cache = null;
    return { listed: true };
  }));
  app.post("/api/coach/trainer/listing/manage", auth, wrap(async (req) => {
    const t = await store.trainer(me(req));
    if (!t?.stripeCustomer) throw new Refused("There's no listing plan to manage yet.");
    const p = await stripe("POST", "/billing_portal/sessions", { customer: t.stripeCustomer, return_url: `${back(req)}#/trainer` });
    return { url: p.url };
  }));
  // The site owner can list a trainer for free for a while (a founding trainer, a friend, a test).
  app.post("/api/coach/admin/comp", auth, wrap(async (req) => {
    if (!deps.isAdmin?.(req)) throw new Refused("Only the site owner can do that.", 403);
    const userId = Number(req.body?.userId); const days = Math.max(1, Math.min(3650, Number(req.body?.days) || 30));
    const t = await store.trainer(userId);
    if (!t) throw new Refused("That person hasn't started a trainer listing.", 404);
    await store.saveTrainer({ ...t, paidUntil: new Date(Math.max(now(), t.paidUntil ? Date.parse(t.paidUntil) : 0) + days * 864e5).toISOString() });
    cache = null;
    return { ok: true };
  }));

  // ── Coach Copilot (shared/coachCopilot.ts): who needs you this week, with a drafted message each ─────────────
  /** Arise Fit data trimmed to what this client agreed to share. */
  const sharedFit = (fit: FitData | null, c: Consent): FitData | null => (fit ? { ...fit, workouts: c.workouts ? fit.workouts : [], weights: c.body ? fit.weights : [], foods: c.food ? fit.foods : [] } : null);
  const copilotAi = createAttemptLimiter({ max: 12, windowMs: 24 * 60 * 60_000 });
  app.get("/api/coach/trainer/copilot", auth, wrap(async (req) => {
    const id = me(req); const at = new Date(now());
    const links = (await store.linksOf("trainer", id)).filter((l) => l.status === "active");
    const unread = await store.unread(links.map((l) => l.id), id);
    let items = await Promise.all(links.map(async (l) => {
      const fit = sharedFit(await fitData(l.clientId).catch(() => null), l.consent);
      const name = await first(l.clientId);
      const f = clientFacts({ name, coaching: l.coaching, side: l.clientSide, fit, unread: unread[l.id]?.count ?? 0, kcalTarget: l.consent.profile ? snapshot(fit, l.consent, name, l.createdAt, at).profile?.kcal ?? null : null, checkinDue: checkinDue(l.coaching, l.clientSide, at), sharesWorkouts: l.consent.workouts }, at);
      const fl = copilotFlags(f);
      return { linkId: l.id, clientId: l.clientId, name, facts: f, flags: fl, draft: draftFor(f, fl), score: copilotScore(fl), summary: "" };
    }));
    items.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    let ai = false;
    if (req.query?.ai === "1" && items.length) {
      if (!allow(copilotAi, `cp:${id}`)) throw new Refused("Copilot has written a lot today. The plain version still updates.", 429);
      const t = await store.trainer(id);
      const top = items.slice(0, 30);
      const out = await callAi(`You help a personal trainer run their week. For each client you get facts and flags. Write: "summary" (one short plain sentence a busy coach can scan) and "draft" (a warm, specific text message from the coach, 1-3 sentences, first name only, no emojis, no hashtags, never invent numbers or events that aren't in the facts). Coach's name: ${t?.profile.name || "the coach"}. Reply JSON {"clients":[{"linkId","summary","draft"}]}.`,
        JSON.stringify(top.map((x) => ({ linkId: x.linkId, name: x.name.split(" ")[0], flags: x.flags.map((f) => f.text), facts: { workouts: `${x.facts.workoutsDone}/${x.facts.workoutsDue}`, habits: `${x.facts.habitsDone}/${x.facts.habitsDue}`, daysSinceWorkout: x.facts.daysSinceWorkout, foodDaysLogged: x.facts.foodDays, newBests: x.facts.newPRs } })))).catch(() => "{}");
      try {
        const byId = new Map<string, { summary?: string; draft?: string }>((JSON.parse(out)?.clients ?? []).map((c: any) => [String(c.linkId), c]));
        items = items.map((x) => { const c = byId.get(x.linkId); const sum = typeof c?.summary === "string" ? c.summary.trim().slice(0, 200) : ""; const dr = typeof c?.draft === "string" ? c.draft.trim().slice(0, 600) : ""; if (sum || dr) ai = true; return { ...x, summary: sum, draft: dr || x.draft }; });
      } catch { /* the plain drafts stand */ }
    }
    const count = (lv: string) => items.filter((x) => x.flags.some((f) => f.level === lv)).length;
    return { at: at.toISOString(), ai, totals: { urgent: count("urgent"), watch: count("watch"), win: count("win"), clients: items.length }, items };
  }));
  /** Plan tools: preview, then apply. "reflow" moves missed workouts forward; "progress" writes next targets. */
  const planTool = (kind: "reflow" | "progress") => wrap(async (req) => {
    const { l } = await linkFor(req, "trainer");
    const raw = await fitData(l.clientId).catch(() => null);
    const fit = sharedFit(raw, l.consent);
    const at = new Date(now());
    const days = Array.isArray(req.body?.days) ? req.body.days.map(Number).filter((d: number) => d >= 0 && d <= 6) : [];
    const r = kind === "reflow" ? reflowPlan(l.coaching, fit?.workouts, at, { days }) : progressPlan(l.coaching, fit?.workouts, raw?.profile.units ?? "lb", at);
    const changes = "moves" in r ? r.moves : r.bumps;
    if (req.body?.apply === true && changes.length) {
      await store.saveLink(touch({ ...l, coaching: { ...l.coaching, assigned: r.assigned } }));
      void notify(l.clientId, kind === "reflow"
        ? { title: "Your plan was updated", body: `Your trainer moved ${changes.length} missed ${changes.length === 1 ? "workout" : "workouts"} to the coming days.`, url: "#/fit", tag: `coach-${l.id}` }
        : { title: "New targets from your trainer", body: "Your next workouts have new weight and rep targets based on your last sessions.", url: "#/fit", tag: `coach-${l.id}` });
    }
    return { changes, applied: req.body?.apply === true && changes.length > 0, ...(req.body?.apply === true ? { assigned: r.assigned } : {}) };
  });
  app.post("/api/coach/links/:id/reflow", auth, planTool("reflow"));
  app.post("/api/coach/links/:id/progress", auth, planTool("progress"));

  // ── Moving in and out (shared/coachImport.ts): import from Trainerize/TrueCoach/a spreadsheet, export everything ──
  app.get("/api/coach/trainer/export", auth, wrap(async (req) => {
    const id = me(req); const t = await store.trainer(id);
    const links = (await store.linksOf("trainer", id)).filter((l) => l.status !== "declined");
    const clients = await Promise.all(links.map(async (l) => ({ name: await first(l.clientId), status: l.status, since: l.createdAt, tags: l.coaching.tags, phase: l.coaching.phase ?? "", notes: l.coaching.notes,
      plan: { assigned: l.coaching.assigned, habits: l.coaching.habits, goals: l.coaching.goals, nutrition: l.coaching.nutrition ?? null, checkin: l.coaching.checkin ?? null, appointments: l.coaching.appts },
      checkins: l.clientSide.checkins, compliance: compliance(l.coaching, l.clientSide, undefined, new Date(now())) })));
    const leads = cleanLeads(await kv.get(leadsKey(id)));
    return { app: "Arise Trainer", exportedAt: new Date(now()).toISOString(), profile: t?.profile ?? null, library: (await store.library(id)) ?? emptyLibrary(), site: cleanSite((await kv.get(siteKey(id))) ?? emptySite()), leads, clients,
      clientsCsv: clientsCsv(clients.map((c) => ({ ...c, workoutsPct: c.compliance.pct }))) };
  }));
  app.post("/api/coach/trainer/import/clients", auth, wrap(async (req) => {
    const id = me(req);
    const r = importClients(String(req.body?.csv ?? ""));
    if (r.problem) throw new Refused(r.problem);
    if (!r.clients.length) throw new Refused("No clients with a name and an email or phone were found.");
    const leads = cleanLeads(await kv.get(leadsKey(id)));
    const known = new Set(leads.flatMap((l) => [l.email, l.phone.replace(/\D/g, "")]).filter(Boolean));
    const at = new Date(now()).toISOString();
    const fresh = r.clients.filter((c) => !known.has(c.email) && !known.has(c.phone.replace(/\D/g, "")))
      .map((c) => cleanLeads([{ name: c.name, email: c.email, phone: c.phone, message: c.note, goal: "", at, source: "import", status: "new", tags: c.tags }])[0]).filter(Boolean);
    await kv.set(leadsKey(id), [...fresh, ...leads].slice(0, 2000));
    return { added: fresh.length, already: r.clients.length - fresh.length, skipped: r.skipped, leads: [...fresh, ...leads] };
  }));
  app.post("/api/coach/trainer/import/workouts", auth, wrap(async (req) => {
    const id = me(req); const lib = (await store.library(id)) ?? emptyLibrary();
    const r = importWorkouts(String(req.body?.csv ?? ""), lib.exercises);
    if (r.problem) throw new Refused(r.problem);
    if (!r.workouts.length) throw new Refused("No workouts were found in that file.");
    const names = new Set(lib.workouts.map((w) => w.name.toLowerCase()));
    const workouts = r.workouts.map((w) => (names.has(w.name.toLowerCase()) ? { ...w, name: `${w.name} (imported)`.slice(0, 80) } : w));
    const next = cleanLibrary({ ...lib, workouts: [...lib.workouts, ...workouts], exercises: [...lib.exercises, ...r.exercises] });
    if (req.body?.apply === true) await store.saveLibrary(id, next);
    return { workouts: workouts.map((w) => ({ name: w.name, exercises: w.items.length })), matched: r.matched, added: r.added, applied: req.body?.apply === true, ...(req.body?.apply === true ? { library: next } : {}) };
  }));
  const mailLimit = createAttemptLimiter({ max: 300, windowMs: 24 * 60 * 60_000 });
  /** Emails the trainer's invite link to imported (or any) leads that have an email. */
  app.post("/api/coach/trainer/import/invite", auth, wrap(async (req) => {
    const id = me(req);
    if (!deps.sendEmail) throw new Refused("Email isn't set up on this server. Copy your invite link instead.", 503);
    const t = await store.trainer(id); const coach = t?.profile.name || (await first(id));
    const wanted = new Set((Array.isArray(req.body?.leadIds) ? req.body.leadIds : []).map(String).slice(0, 300));
    const leads = cleanLeads(await kv.get(leadsKey(id)));
    const to = leads.filter((l) => wanted.has(l.id) && l.email);
    const link = `${SITE}/#/fit?coach=${inviteCode(id)}`;
    const note = String(req.body?.note ?? "").trim().slice(0, 600);
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
    let sent = 0; const done = new Set<string>();
    for (const l of to) {
      if (!allow(mailLimit, `mail:${id}`)) break;
      const html = `<p>Hi ${esc(l.name.split(" ")[0])},</p><p>${note ? esc(note).replace(/\n/g, "<br>") : `I'm moving my coaching to Arise. Your workouts, nutrition and our chat will live in the Arise Fit app from now on.`}</p><p><a href="${link}" style="display:inline-block;background:#ff5a1f;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Join me in Arise Fit</a></p><p>See you there,<br>${esc(coach)}</p>`;
      const r = await deps.sendEmail(l.email, `${coach} invited you to train in Arise Fit`, html, { fromName: coach, replyTo: t?.profile.email || undefined }).catch(() => ({ sent: false }));
      if (r.sent) { sent++; done.add(l.id); }
    }
    const next = leads.map((l) => (done.has(l.id) && l.status === "new" ? { ...l, status: "contacted" as LeadStatus } : l));
    await kv.set(leadsKey(id), next);
    return { sent, skipped: wanted.size - sent, leads: next };
  }));

  // Groups: pages, chat and challenges (server/coachGroups.ts).
  registerCoachGroupRoutes(app, auth, { store, kv, now, me, wrap, first, notify, refuse: (m, status) => new Refused(m, status) });
}
