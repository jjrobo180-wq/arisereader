// Plans and billing — server.
//
// Free is for students and parents. Premium is for teachers and schools, and a
// Premium teacher's students get the extras through them. This module answers
// "does this person have Premium?", locks what needs it, and takes payment
// through Stripe.
//
// Arise WorkHub is a separate add-on with its own plans ("hub_teacher" and
// "hub_school"), bought the same way. Plan rules, the free year and always-free
// schools don't apply to it.
//
// Arise WorkHub is always free for a teacher or parent (see hubAccessFor). Premium
// (Reader/Math/History for a teacher's class) has no free trial — a teacher pays
// from day one, unless they are grandfathered or their school has a free plan.
//
// Two switches keep a live site safe:
//   - Plan rules do nothing until the admin turns them on (setting "plans_enforced").
//   - Payment does nothing until a Stripe key is set.
//
// Storage is the settings table, passed in, so there is no database migration
// and the whole thing runs in tests. Stripe is called over plain HTTPS, so no
// new package is needed.
import type { Express, RequestHandler } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  APP_IDS, APP_NAMES, PLANS, PLAN_KINDS, PREMIUM_REQUIRED, appAccessFor, appOfClassKind, classAppCents, classGrantCovers, classKindOf, clampBlocks, isAppId, isClassAppKind, entitlementFor, grantLive, hubAccessFor, isAddonKind, isDemoAccount, isFreeSchoolName, isHubKind, isPlanKind, todoAccessFor,
  type AddonAccess, type AppId,
  isSchoolKind, parentCanLink, premiumMessage, priceOf, schoolKindOf, seatsFor,
  type Entitlement, type HubAccess, type PlanFacts, type PlanGrant, type PlanKind, type PlanPerson,
  todoUnlimitedFor, cleanVipEmail, cleanVipList, onVipList, VIP_MAX, type VipEntry,
} from "../shared/plans";
import { TODO_PLAN_KINDS, infoFromGrant, stripeKeyMode, type PlanInfo } from "../shared/todoAdmin";
import { AI_LIMIT, FAIR_USE, UNLIMITED_AI_PER_MONTH, UNLIMITED_MONTHLY_CENTS, UNLIMITED_NAME, UNLIMITED_YEARLY_OFFER, aiMonth } from "../shared/todoPlan";

type AnyUser = {
  id: number; username?: string; displayName?: string; role?: string; isAdmin?: boolean; email?: string | null;
  createdAt?: unknown; teacherId?: number | null; school_id?: number | null; schoolId?: number | null;
  accountApproved?: boolean; approvedByTeacher?: boolean;
};

export type PlanDeps = {
  getSetting(key: string): Promise<string>;
  upsertSetting(key: string, value: string): Promise<void>;
  /**
   * Reads a setting straight from the database and throws when the database
   * can't be reached. getSetting hides such failures as "", which here would
   * read as "no plan" and lock a paying teacher out. Left out, getSetting is used.
   */
  readSetting?(key: string): Promise<string>;
  /** The signed-in user for a session token, or null. Used to check teachers before a route runs. */
  userForToken(token: string): Promise<AnyUser | null>;
  getUser(id: number): Promise<AnyUser | null | undefined>;
  /** An account by its username, for putting an existing account on the VIP list. */
  findUserByUsername?(username: string): Promise<AnyUser | null | undefined>;
  /** Approved students on a teacher's roster. */
  countTeacherStudents(teacherId: number): Promise<number>;
  /** Students at a school. */
  countSchoolStudents(schoolId: number): Promise<number>;
  /** Children linked to a parent account: a family's Learning Bundle covers them. */
  parentChildIds?(parentId: number): Promise<number[]>;
  /** Parents linked to a student. */
  studentParentIds?(studentId: number): Promise<number[]>;
  /** A teacher's approved students. */
  teacherStudentIds?(teacherId: number): Promise<number[]>;
  /** Students in a teacher's Arise WorkHub caseload. Left out, counted as 0. */
  countHubStudents?(teacherId: number): Promise<number>;
  schoolName(schoolId: number): Promise<string>;
  /** Every school on the site, for the admin's list of always-free schools. */
  schools?(): Promise<Array<{ id: number; name: string }>>;
  /**
   * Can this school be free because of its name? Schools that people add at
   * sign-up can't: otherwise typing the right name would be a way to get Premium.
   * Left out, every school can.
   */
  freeByNameAllowed?(schoolId: number): Promise<boolean>;
  /** The site's own address, used if a request's Host header is missing or odd. */
  appUrl?: string;
  /** Stripe keys from the hosting environment; the admin panel can also store them. */
  envStripeKey?: () => string;
  envWebhookSecret?: () => string;
  fetch?: typeof fetch;
  now?: () => number;
};

const KEY = {
  enforced: "plans_enforced",
  grant: (kind: PlanKind, id: number) => `plan_${kind}_${id}`,
  /** A Checkout page that was opened and may have been paid: checked with Stripe until it resolves. */
  pending: (kind: PlanKind, id: number) => `plan_pending_${kind}_${id}`,
  index: "plan_index",
  /** People given To-Do Unlimited by the admin, no payment (see VipEntry in shared/plans.ts). */
  vip: "todo_vip",
  /** Schools the admin has made always free ("on"), and name-matched ones the admin has taken off ("off"). */
  freeSchools: "plans_free_schools",
  stripeKey: "stripe_secret_key",
  webhookSecret: "stripe_webhook_secret",
};

/** What a teacher without Premium may still reach: signing in and out, their plan, and paying for it. */
const TEACHER_OPEN = ["/api/social", "/api/addons", "/api/teacher-hub", "/api/arise-todo", "/api/lifehub", "/api/hub-chat", "/api/hub-calendar", "/api/hub-files", "/api/hub-inbox", "/api/me", "/api/login", "/api/logout", "/api/auth", "/api/plan", "/api/billing", "/api/settings", "/api/banners", "/api/notifications", "/api/competition-settings", "/api/schools"];

// Never 401 or 503 here: the app retries those for several seconds before showing the message.
export class Refused extends Error { constructor(message: string, readonly status = 400, readonly code?: string) { super(message); } }

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const posInt = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 0; };
const schoolOf = (u: AnyUser | null | undefined) => posInt(u?.school_id ?? u?.schoolId) || null;
const person = (u: AnyUser): PlanPerson => ({
  id: u.id, role: u.role, isAdmin: u.isAdmin, username: u.username, createdAt: u.createdAt,
  teacherId: posInt(u.teacherId) || null, schoolId: schoolOf(u), accountApproved: u.accountApproved, approvedByTeacher: u.approvedByTeacher,
});
const mask = (secret: string) => (secret ? `${secret.slice(0, 7)}...${secret.slice(-4)}` : "");

/** Stripe wants nested values as form fields like line_items[0][price_data][currency]. */
export function stripeForm(value: Record<string, unknown>): string {
  const out: string[] = [];
  const walk = (v: unknown, name: string) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((item, i) => walk(item, `${name}[${i}]`));
    else if (typeof v === "object") for (const [k, inner] of Object.entries(v as Record<string, unknown>)) walk(inner, name ? `${name}[${k}]` : k);
    else out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(v))}`);
  };
  walk(value, "");
  return out.join("&");
}

/**
 * Checks that a webhook really came from Stripe: the header carries a time and
 * an HMAC-SHA256 of "<time>.<body>" made with the webhook secret. Old messages
 * are turned away so a captured one can't be replayed later.
 */
export function verifyStripeSignature(payload: Buffer | string, header: unknown, secret: string, nowMs = Date.now(), toleranceSeconds = 300): boolean {
  if (!secret || typeof header !== "string" || !header) return false;
  let time = "";
  const given: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim(), v = part.slice(eq + 1).trim();
    if (k === "t") time = v; else if (k === "v1") given.push(v);
  }
  if (!/^\d+$/.test(time) || !given.length) return false;
  if (Math.abs(nowMs / 1000 - Number(time)) > toleranceSeconds) return false;
  const body = typeof payload === "string" ? Buffer.from(payload, "utf8") : payload;
  const expected = createHmac("sha256", secret).update(`${time}.`).update(body).digest();
  return given.some((sig) => {
    if (!/^[0-9a-f]{64}$/i.test(sig)) return false;
    return timingSafeEqual(Buffer.from(sig, "hex"), expected);
  });
}

export function registerPlanRoutes(app: Express, auth: RequestHandler, admin: RequestHandler, deps: PlanDeps) {
  const doFetch: typeof fetch = deps.fetch ?? ((...args) => fetch(...args));
  const now = () => (deps.now ? deps.now() : Date.now());

  // ─── Storage ───────────────────────────────────────────────────────────────
  // Reads throw when the database can't be reached, so a hiccup is never mistaken
  // for "no plan". Values are remembered for a few seconds because the teacher
  // check runs on most requests.
  const MEM_MS = 20_000;
  const mem = new Map<string, { at: number; value: string }>();
  const readFresh = async (key: string): Promise<string> => {
    const value = await (deps.readSetting ?? deps.getSetting)(key);
    mem.set(key, { at: now(), value });
    return value;
  };
  const read = async (key: string): Promise<string> => {
    const hit = mem.get(key);
    return hit && now() - hit.at < MEM_MS ? hit.value : readFresh(key);
  };
  const write = async (key: string, value: string) => {
    await deps.upsertSetting(key, value);
    mem.set(key, { at: now(), value });
  };
  const parse = <T,>(raw: string, fallback: T): T => { if (!raw) return fallback; try { return JSON.parse(raw) as T; } catch { return fallback; } };

  let lastEnforced: boolean | null = null;
  const enforced = async (): Promise<boolean> => {
    try { lastEnforced = (await read(KEY.enforced)) === "1"; return lastEnforced; }
    catch (e) { if (lastEnforced !== null) return lastEnforced; throw e; }
  };
  const asGrant = (raw: string, kind: PlanKind, id: number): PlanGrant | null => {
    const g = parse<PlanGrant | null>(raw, null);
    return g && g.kind === kind && Number(g.ownerId) === id ? g : null;
  };
  const readGrant = async (kind: PlanKind, id: number | null | undefined, fresh = false): Promise<PlanGrant | null> => {
    if (!posInt(id)) return null;
    const key = KEY.grant(kind, Number(id));
    return asGrant(await (fresh ? readFresh(key) : read(key)), kind, Number(id));
  };
  type Index = Record<PlanKind, number[]>;
  const readIndex = async (fresh = false): Promise<Index> => {
    const raw = parse<Partial<Index>>(await (fresh ? readFresh(KEY.index) : read(KEY.index)), {});
    const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map(posInt).filter(Boolean))] : []);
    return Object.fromEntries(PLAN_KINDS.map((k) => [k, ids(raw[k])])) as Index;
  };
  type Pending = { sessionId: string; buyerId: number; at: string };
  const readPending = async (kind: PlanKind, id: number): Promise<Pending | null> => {
    const p = parse<Pending | null>(await read(KEY.pending(kind, id)), null);
    return p && typeof p.sessionId === "string" && /^cs_[A-Za-z0-9_]{8,200}$/.test(p.sessionId) ? p : null;
  };
  const clearPending = (kind: PlanKind, id: number) => write(KEY.pending(kind, id), "");

  // ─── Schools that are always free ──────────────────────────────────────────
  // A school is always free when its name matches (see isFreeSchoolName) or the
  // admin has switched it on, unless the admin has switched it off. Every teacher
  // at such a school has Premium at no charge, and so do the students in their classes.
  type FreeChoice = { on: number[]; off: number[] };
  const readFreeChoice = async (fresh = false): Promise<FreeChoice> => {
    const raw = parse<Partial<FreeChoice>>(await (fresh ? readFresh(KEY.freeSchools) : read(KEY.freeSchools)), {});
    const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map(posInt).filter(Boolean))] : []);
    return { on: ids(raw.on), off: ids(raw.off) };
  };
  // A name that matched is remembered for good, so a later hiccup looking the name up can't lock the
  // school out. A name that didn't match is looked at again after a while, in case the school was renamed.
  const nameMatched = new Map<number, { yes: boolean; at: number }>();
  const matchesByName = async (schoolId: number): Promise<boolean> => {
    const known = nameMatched.get(schoolId);
    if (known && (known.yes || now() - known.at < 10 * 60_000)) return known.yes;
    const name = await deps.schoolName(schoolId).catch(() => "");
    if (name) {
      const allowed = isFreeSchoolName(name) && (deps.freeByNameAllowed ? await deps.freeByNameAllowed(schoolId) : true);
      nameMatched.set(schoolId, { yes: allowed, at: now() });
    }
    return nameMatched.get(schoolId)?.yes ?? false;
  };
  const isFreeSchool = async (id: number | null | undefined): Promise<boolean> => {
    const schoolId = posInt(id);
    if (!schoolId) return false;
    const choice = await readFreeChoice();
    if (choice.off.includes(schoolId)) return false;
    return choice.on.includes(schoolId) || matchesByName(schoolId);
  };
  const freeGrant = (schoolId: number): PlanGrant => ({
    kind: "school", ownerId: schoolId, source: "admin", status: "active", seats: PLANS.school.studentCap,
    endsAt: null, updatedAt: iso(now()), free: true, note: "Always free",
  });

  // Entitlements are looked up on most requests, so they are remembered briefly.
  // The key includes the role: an admin previewing the site as a student is a different answer from the admin.
  const cache = new Map<string, { at: number; value: Entitlement }>();
  const hubCache = new Map<string, { at: number; value: HubAccess }>();
  const addonCache = new Map<string, { at: number; value: AddonAccess }>();
  const CACHE_MS = 30_000;
  const forget = () => { cache.clear(); hubCache.clear(); addonCache.clear(); };

  // One change at a time. A plan is read, compared and written in one step, so two
  // Stripe messages arriving together can't overwrite each other.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T,>(job: () => Promise<T>): Promise<T> => { const run = chain.then(job, job); chain = run.catch(() => {}); return run; };

  /** Call inside serial(). */
  const saveGrant = async (grant: PlanGrant) => {
    await write(KEY.grant(grant.kind, grant.ownerId), JSON.stringify(grant));
    const index = await readIndex(true);
    if (!index[grant.kind].includes(grant.ownerId)) {
      index[grant.kind].push(grant.ownerId);
      await write(KEY.index, JSON.stringify(index));
    }
    forget();
  };

  // ─── Stripe ────────────────────────────────────────────────────────────────
  const stripeKey = async () => (deps.envStripeKey?.() || (await read(KEY.stripeKey)) || "").trim();
  const webhookSecret = async () => (deps.envWebhookSecret?.() || (await read(KEY.webhookSecret)) || "").trim();

  const stripe = async (method: "GET" | "POST" | "DELETE", path: string, params?: Record<string, unknown>): Promise<any> => {
    const key = await stripeKey();
    if (!key) throw new Refused("Online payment is not set up yet.", 409);
    let res: Response;
    try {
      res = await doFetch(`https://api.stripe.com/v1${path}`, {
        method,
        headers: { Authorization: `Bearer ${key}`, ...(method !== "GET" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
        body: method !== "GET" && params ? stripeForm(params) : undefined,
      });
    } catch {
      throw new Refused("Could not reach the payment service. Try again in a moment.", 502);
    }
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[plans] Stripe refused:", res.status, data?.error?.type, data?.error?.code);
      throw new Refused("The payment service could not complete that. Nothing was charged.", 502);
    }
    return data;
  };
  const subscriptionPath = (id: unknown) => {
    if (typeof id !== "string" || !/^sub_[A-Za-z0-9]{1,200}$/.test(id)) throw new Refused("That subscription could not be found.", 400);
    return `/subscriptions/${id}`;
  };
  const sessionPath = (id: unknown) => {
    if (typeof id !== "string" || !/^cs_[A-Za-z0-9_]{8,200}$/.test(id)) throw new Refused("That payment could not be found.", 400);
    return `/checkout/sessions/${id}?expand%5B%5D=subscription`;
  };

  /**
   * The page the buyer is on: where Stripe sends them back after paying.
   *
   * The page tells us its own address ("returnTo"), and it is believed only when
   * it matches where the browser says the request came from (the Origin or
   * Referer header, which a web page can't fake) or the site's configured
   * address. The server's own Host header is the last resort: when the server
   * sits behind a different address from the site, Host is the server's address,
   * and sending a buyer there lands them on a page that doesn't exist.
   */
  const originFrom = (value: unknown): string => {
    try {
      const url = new URL(String(value || ""));
      const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return "";
      if (url.username || url.password) return "";
      return url.origin;
    } catch { return ""; }
  };
  const siteOf = (req: any): string => {
    const header = (name: string) => String(req.headers?.[name] || "").split(",")[0].trim();
    const fromBrowser = [originFrom(header("origin")), originFrom(header("referer"))].filter(Boolean);
    const configured = originFrom(deps.appUrl);
    const proto = header("x-forwarded-proto") || req.protocol || "https";
    const host = header("host");
    const fromHost = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?(:\d{1,5})?$/i.test(host) ? `${proto === "http" ? "http" : "https"}://${host}` : "";

    const asked = String(req.body?.returnTo || "");
    const askedOrigin = originFrom(asked);
    if (askedOrigin && [...fromBrowser, configured].filter(Boolean).includes(askedOrigin)) {
      // keep the folder the site lives in, drop any ?query and #hash
      const path = new URL(asked).pathname;
      if (path.length <= 200 && /^[A-Za-z0-9\/._~-]*$/.test(path)) return askedOrigin + (path || "/");
    }
    return (fromBrowser[0] || configured || fromHost) + "/";
  };
  /**
   * The plan page's address, with an optional ?query in front of the "#". The site's
   * router only finds a page when the query is before the hash (/?paid=1#/billing);
   * #/billing?paid=1 shows "page not found".
   */
  const billingUrl = (req: any, query = "") => `${siteOf(req)}${query ? `?${query}` : ""}#/billing`;

  const meta = (m: any): { kind: PlanKind; ownerId: number; buyerId: number } | null => {
    const kind = isPlanKind(m?.kind) ? m.kind : null;
    const ownerId = posInt(m?.ownerId), buyerId = posInt(m?.buyerId);
    return kind && ownerId ? { kind, ownerId, buyerId } : null;
  };

  /**
   * Turns a Stripe subscription into our plan record. A subscription whose first
   * payment has not finished ("incomplete") is not a plan yet, so it gives null.
   */
  const grantFromSubscription = (sub: any, at: number, deleted = false): PlanGrant | null => {
    const m = meta(sub?.metadata);
    if (!m || typeof sub?.id !== "string") return null;
    if (!deleted && sub.status === "incomplete") return null;
    const item = sub?.items?.data?.[0];
    const periodEnd = Number(sub.current_period_end ?? item?.current_period_end);
    const status: PlanGrant["status"] = deleted ? "canceled" : sub.status === "active" || sub.status === "trialing" ? "active" : sub.status === "past_due" ? "past_due" : "canceled";
    let endsAt = Number.isFinite(periodEnd) && periodEnd > 0 ? periodEnd * 1000 : at;
    // A missed payment keeps the class running for a week while the card is retried, not a whole period.
    if (status === "past_due") endsAt = Math.min(endsAt, at + 7 * DAY);
    return {
      kind: m.kind, ownerId: m.ownerId, source: "stripe", status,
      seats: priceOf(m.kind).seats(clampBlocks(item?.quantity ?? 1)),
      endsAt: iso(endsAt), updatedAt: iso(at), buyerId: m.buyerId || undefined,
      stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
      stripeSubscriptionId: sub.id, stripeItemId: typeof item?.id === "string" ? item.id : undefined,
      ...(sub.cancel_at_period_end === true && status === "active" ? { cancelAtPeriodEnd: true } : {}),
    };
  };

  /** Saves a plan from Stripe unless we already hold newer news about it, or it would wrongly switch off a plan that is running. */
  const applyStripeGrant = async (incoming: PlanGrant) => {
    await saveStripeGrant(incoming);
    await afterGrant(incoming);
  };
  const saveStripeGrant = (incoming: PlanGrant) => serial(async () => {
    let next = incoming;
    const held = await readGrant(next.kind, next.ownerId, true);
    if (held) {
      const sameSub = held.stripeSubscriptionId === next.stripeSubscriptionId;
      const heldLive = grantLive(held, now());
      // A plan the admin switched on, or a different paid plan that is running, is only replaced by a plan that is itself active.
      if (!sameSub && heldLive && next.status !== "active") return;
      if (sameSub && Date.parse(held.updatedAt) > Date.parse(next.updatedAt)) return;
      // The week of grace after a missed payment starts once. Later checks must not push it out again.
      if (sameSub && held.status === "past_due" && next.status === "past_due" && held.endsAt && next.endsAt && Date.parse(held.endsAt) < Date.parse(next.endsAt)) {
        next = { ...next, endsAt: held.endsAt };
      }
    }
    await saveGrant(next);
  });

  /** Asks Stripe what a subscription looks like right now and saves that. */
  const syncSubscription = async (subscriptionId: unknown) => {
    const sub = await stripe("GET", subscriptionPath(subscriptionId));
    const grant = grantFromSubscription(sub, now(), sub?.status === "canceled");
    if (grant) await applyStripeGrant(grant);
    return grant;
  };

  /**
   * A Checkout page that was opened and never reported back: the buyer may have
   * paid and closed the tab. Ask Stripe, so nobody pays and gets nothing.
   */
  const lastAsked = new Map<string, number>();
  const reconcilePending = async (kind: PlanKind, id: number): Promise<boolean> => {
    const pending = await readPending(kind, id);
    if (!pending) return false;
    const started = Date.parse(pending.at);
    if (!Number.isFinite(started) || now() - started > 3 * DAY) { await clearPending(kind, id); return false; }
    if (now() - (lastAsked.get(pending.sessionId) ?? -Infinity) < 60_000) return false;
    lastAsked.set(pending.sessionId, now());
    if (!(await stripeKey())) return false;
    const session = await stripe("GET", sessionPath(pending.sessionId));
    const m = meta(session?.metadata);
    if (session?.status === "expired" || !m || m.kind !== kind || m.ownerId !== id) { await clearPending(kind, id); return false; }
    const paid = session.status === "complete" && (session.payment_status === "paid" || session.payment_status === "no_payment_required");
    const grant = paid && session.subscription && typeof session.subscription === "object" ? grantFromSubscription(session.subscription, now()) : null;
    if (!grant || grant.kind !== kind || grant.ownerId !== id) return false;
    await applyStripeGrant(grant);
    await clearPending(kind, id);
    return true;
  };

  // ─── Who has Premium ───────────────────────────────────────────────────────
  /**
   * The plan as it stands now. A paid plan whose period has run out is checked
   * with Stripe before it is treated as ended, and an unfinished Checkout is
   * looked up. Renewals normally arrive by webhook; this covers a webhook that
   * is late, lost or was never set up, so a paying teacher is not locked out.
   */
  const lastSync = new Map<string, number>();
  const SYNC_EVERY_MS = 6 * 3_600_000;
  const current = async (kind: PlanKind, id: number | null | undefined): Promise<PlanGrant | null> => {
    const ownerId = posInt(id);
    if (!ownerId) return null;
    // An always-free school is free for Premium only, not for Arise WorkHub.
    if (kind === "school" && (await isFreeSchool(ownerId))) return freeGrant(ownerId);
    let g = await readGrant(kind, ownerId);
    try {
      if (!grantLive(g, now()) && (await reconcilePending(kind, ownerId))) g = await readGrant(kind, ownerId, true);
      if (!g || g.source !== "stripe" || !g.stripeSubscriptionId || g.status === "canceled") return g;
      if (g.endsAt && now() < Date.parse(g.endsAt)) return g;
      const sub = g.stripeSubscriptionId;
      if (now() - (lastSync.get(sub) ?? -Infinity) < SYNC_EVERY_MS) return g;
      lastSync.set(sub, now());
      if (!(await stripeKey())) return g;
      await syncSubscription(sub);
      return (await readGrant(kind, ownerId, true)) ?? g;
    } catch (e: any) {
      console.error("[plans] check with Stripe failed:", e?.message);
      return g;
    }
  };

  const factsFor = async (user: AnyUser): Promise<PlanFacts> => {
    const facts: PlanFacts = { enforced: await enforced(), now: now() };
    if (!facts.enforced || user.isAdmin) return facts;
    if (user.role === "teacher") {
      facts.schoolGrant = await current("school", schoolOf(user));
      facts.teacherGrant = await current("teacher", user.id);
    } else if (user.role !== "parent" && posInt(user.teacherId)) {
      const teacher = await deps.getUser(Number(user.teacherId));
      if (teacher && teacher.role === "teacher") {
        facts.classTeacher = person(teacher);
        facts.classTeacherGrant = await current("teacher", teacher.id);
        facts.classTeacherSchoolGrant = await current("school", schoolOf(teacher));
      }
    }
    return facts;
  };
  const entitlement = async (user: AnyUser | null | undefined): Promise<Entitlement> => {
    if (!user || !posInt(user.id)) return { premium: false, via: null, seats: null, endsAt: null };
    const key = `${user.id}|${user.role || ""}|${user.isAdmin ? 1 : 0}`;
    const hit = cache.get(key);
    if (hit && now() - hit.at < CACHE_MS) return hit.value;
    const value = entitlementFor(person(user), await factsFor(user));
    cache.set(key, { at: now(), value });
    return value;
  };

  /** Can this teacher open Arise WorkHub, and how many students may its caseload hold? */
  const hubAccess = async (user: AnyUser | null | undefined): Promise<HubAccess> => {
    if (!user || !posInt(user.id)) return { access: false, via: null, seats: null, endsAt: null };
    const key = `hub|${user.id}|${user.role || ""}|${user.isAdmin ? 1 : 0}`;
    const hit = hubCache.get(key);
    if (hit && now() - hit.at < CACHE_MS) return hit.value;
    const isTeacher = user.role === "teacher" && !user.isAdmin;
    const value = hubAccessFor(person(user), {
      now: now(),
      teacherGrant: isTeacher ? await current("hub_teacher", user.id) : null,
      schoolGrant: isTeacher ? await current("hub_school", schoolOf(user)) : null,
    });
    hubCache.set(key, { at: now(), value });
    return value;
  };

  // ─── Locks used by the rest of the server ──────────────────────────────────
  const pathOf = (req: any) => String(req.originalUrl || req.url || "").split("?")[0];

  /**
   * A teacher account is part of Premium. With plan rules on, a teacher without
   * it can still sign in, see their plan and pay; every other request stops here.
   * If the plan lookup itself fails, the request goes through: a database hiccup
   * must not lock a whole class out.
   */
  const teacherGate: RequestHandler = async (req: any, res: any, next: any) => {
    try {
      const token = String(req.headers?.authorization || "").replace("Bearer ", "");
      if (!token || !(await enforced())) return next();
      const path = pathOf(req);
      if (TEACHER_OPEN.some((open) => path === open || path.startsWith(open + "/"))) return next();
      const user = await deps.userForToken(token);
      if (!user || user.isAdmin || user.role !== "teacher") return next();
      if ((await entitlement(user)).premium) return next();
      return res.status(402).json({ message: premiumMessage("teacher"), code: PREMIUM_REQUIRED });
    } catch (e: any) {
      console.error("[plans] teacher check failed:", e?.message);
      return next();
    }
  };
  app.use("/api", teacherGate);

  /** For a student-only extra (AI study sets, lessons from topics). Sends the refusal and returns true when blocked. */
  const blockFreeStudent = async (req: any, res: any): Promise<boolean> => {
    try {
      if (req.adminPreview || req.user?.isAdmin) return false;
      if ((await entitlement(req.user)).premium) return false;
      res.status(402).json({ message: premiumMessage("student"), code: PREMIUM_REQUIRED });
      return true;
    } catch (e: any) {
      console.error("[plans] student check failed:", e?.message);
      return false;
    }
  };
  const isPremium = async (user: AnyUser | null | undefined) => { try { return (await entitlement(user)).premium; } catch { return true; } };

  /** Can this parent link another child? Five on Free; no limit for a family with a child in a Premium class. */
  const parentLinkAllowed = async (linkedIds: number[], newChildId: number): Promise<{ ok: boolean; message?: string }> => {
    try {
      const on = await enforced();
      if (!on) return { ok: true };
      const ids = [...new Set([...linkedIds, newChildId].map(posInt).filter(Boolean))];
      let premiumFamily = false;
      for (const id of ids) {
        const child = await deps.getUser(id);
        if (child && (await entitlement(child)).premium) { premiumFamily = true; break; }
      }
      if (parentCanLink(linkedIds.length, { enforced: on, premiumFamily })) return { ok: true };
      return { ok: false, message: premiumMessage("parent") };
    } catch { return { ok: true }; }
  };

  /** Is there room on this teacher's plan for `count` more approved students (default 1)? */
  const seatCheck = async (teacher: AnyUser | null | undefined, count = 1): Promise<{ ok: boolean; message?: string }> => {
    try {
      if (!teacher || teacher.isAdmin || teacher.role !== "teacher") return { ok: true };
      const e = await entitlement(teacher);
      if (e.via === "teacher-plan" && e.seats !== null) {
        const used = await deps.countTeacherStudents(teacher.id);
        if (used + count > e.seats) return { ok: false, message: `This teacher's plan covers ${e.seats.toLocaleString("en-US")} students, and it is full. Another ${PLANS.teacher.studentsPerBlock} students can be added on the plan page.` };
      }
      if (e.via === "school-plan" && e.seats !== null && schoolOf(teacher)) {
        const used = await deps.countSchoolStudents(schoolOf(teacher)!);
        if (used + count > e.seats) return { ok: false, message: `The school's plan covers ${e.seats.toLocaleString("en-US")} students, and it is full.` };
      }
      return { ok: true };
    } catch { return { ok: true }; }
  };
  /** The same check, for the teacher a student is being moved to. */
  const seatCheckFor = async (teacherId: unknown) => (posInt(teacherId) ? seatCheck(await deps.getUser(posInt(teacherId)).catch(() => null)) : { ok: true });

  const applyEvent = async (event: any) => {
    const at = Number(event?.created) > 0 ? Number(event.created) * 1000 : now();
    const obj = event?.data?.object;
    const haveKey = !!(await stripeKey());
    switch (event?.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        if (!meta(obj?.metadata)) return;
        // Messages can arrive late or out of order, so the message is only a nudge: Stripe is asked for the truth.
        if (haveKey) { await syncSubscription(obj?.id); return; }
        const grant = grantFromSubscription(obj, at, event.type.endsWith("deleted"));
        if (grant) await applyStripeGrant(grant);
        return;
      }
      case "checkout.session.completed": {
        const m = meta(obj?.metadata);
        if (!m || obj?.mode !== "subscription" || typeof obj?.subscription !== "string") return;
        if (obj.payment_status !== "paid" && obj.payment_status !== "no_payment_required") return;
        if (haveKey) {
          await syncSubscription(obj.subscription);
        } else {
          // Without a key the real dates can't be fetched. Switch Premium on now; the subscription messages bring the dates.
          const held = await readGrant(m.kind, m.ownerId, true);
          if (!(held?.stripeSubscriptionId === obj.subscription && grantLive(held, now()))) {
            await applyStripeGrant({
              kind: m.kind, ownerId: m.ownerId, source: "stripe", status: "active",
              seats: priceOf(m.kind).seats(clampBlocks(obj?.metadata?.blocks)),
              endsAt: iso(at + (isSchoolKind(m.kind) || priceOf(m.kind).interval === "year" ? 366 : 32) * DAY), updatedAt: iso(at), buyerId: m.buyerId || undefined,
              stripeCustomerId: typeof obj.customer === "string" ? obj.customer : undefined, stripeSubscriptionId: obj.subscription,
            });
          }
        }
        if (grantLive(await readGrant(m.kind, m.ownerId, true), now())) await clearPending(m.kind, m.ownerId);
        return;
      }
      default:
        return;
    }
  };

  // ─── Routes ────────────────────────────────────────────────────────────────
  const fail = (res: any, e: any, what: string) => {
    if (e instanceof Refused) return res.status(e.status).json({ message: e.message, ...(e.code ? { code: e.code } : {}) });
    console.error(`[plans] ${what}:`, e?.message);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  };
  const grantView = (g: PlanGrant | null) => g && {
    kind: g.kind, source: g.source, status: g.status, seats: g.seats, endsAt: g.endsAt, live: grantLive(g, now()),
    paidOnline: g.source === "stripe", canManage: !!g.stripeCustomerId, free: !!g.free,
  };
  const approvedTeacher = (req: any) => {
    const u: AnyUser = req.user;
    if (req.adminPreview || !u || u.role !== "teacher" || u.isAdmin) throw new Refused("Premium is bought from a teacher account.", 403);
    if (u.accountApproved === false) throw new Refused("Your teacher account is still waiting for approval.", 403);
    return u;
  };

  /** The signed-in person's plan: what they have, why, and what they could buy. */
  app.get("/api/plan", auth, async (req: any, res: any) => {
    try {
      const user: AnyUser = req.adminPreview && req.realUser ? req.realUser : req.user;
      const e = await entitlement(user);
      const body: any = {
        enforced: await enforced(), premium: e.premium, via: e.via, seats: e.seats, endsAt: e.endsAt,
        payment: !!(await stripeKey()),
        prices: { teacherMonthlyCents: PLANS.teacher.monthlyCents, studentsPerBlock: PLANS.teacher.studentsPerBlock, maxBlocks: PLANS.teacher.maxBlocks, schoolYearlyCents: PLANS.school.yearlyCents, schoolStudentCap: PLANS.school.studentCap },
      };
      if (user.role === "teacher" && !user.isAdmin) {
        const schoolId = schoolOf(user);
        body.students = await deps.countTeacherStudents(user.id);
        body.teacherPlan = grantView(await readGrant("teacher", user.id));
        const schoolPlan = schoolId ? ((await isFreeSchool(schoolId)) ? freeGrant(schoolId) : await readGrant("school", schoolId)) : null;
        body.school = schoolId ? { id: schoolId, name: await deps.schoolName(schoolId), students: await deps.countSchoolStudents(schoolId), plan: grantView(schoolPlan) } : null;
      }
      // Personal A.R.I.S.E. To-Do accounts have WorkHub too, so their plan page must say so.
      if (user.role === "teacher" || user.role === "parent" || user.role === "todo" || user.isAdmin) {
        const h = await hubAccess(user);
        const isTeacher = user.role === "teacher" && !user.isAdmin;
        body.hub = {
          access: h.access, via: h.via, seats: h.seats, endsAt: h.endsAt,
          students: isTeacher && deps.countHubStudents ? await deps.countHubStudents(user.id) : 0,
          teacherPlan: isTeacher ? grantView(await readGrant("hub_teacher", user.id)) : null,
          schoolPlan: isTeacher && schoolOf(user) ? grantView(await readGrant("hub_school", schoolOf(user))) : null,
          prices: { monthlyCents: PLANS.hub.monthlyCents, studentsPerBlock: PLANS.hub.studentsPerBlock, maxBlocks: PLANS.hub.maxBlocks, schoolYearlyCents: PLANS.hub.schoolYearlyCents, schoolStudentCap: PLANS.hub.schoolStudentCap },
        };
      }
      res.set("Cache-Control", "no-store");
      res.json(body);
    } catch (e) { fail(res, e, "plan"); }
  });

  /** Starts a Stripe Checkout page for a teacher plan or a school plan and returns its address. */
  app.post("/api/billing/checkout", auth, async (req: any, res: any) => {
    try {
      if (isPlanKind(req.body?.kind) && isAddonKind(req.body.kind)) throw new Refused("Add-ons are bought with their own button.", 400);
      if (isHubKind(req.body?.kind)) throw new Refused("A.R.I.S.E. To-Do Work and Life hubs are free. No payment is required.", 409);
      const teacher = approvedTeacher(req);
      const kind: PlanKind = isPlanKind(req.body?.kind) ? req.body.kind : "teacher";
      const hub = isHubKind(kind);
      const what = hub ? "Arise WorkHub" : "Premium";
      const schoolId = schoolOf(teacher);
      if (isSchoolKind(kind) && !schoolId) throw new Refused("Your account is not connected to a school yet, so a school plan can't be bought from it.", 409);
      const ownerId = isSchoolKind(kind) ? schoolId! : teacher.id;
      if (!hub && (await isFreeSchool(schoolId))) throw new Refused("Your school has Premium at no charge. There is nothing to buy.", 409);
      // Never sell a plan to someone who already has one, however they got it.
      if (grantLive(await current(kind, ownerId), now())) {
        throw new Refused(isSchoolKind(kind) ? `Your school already has a ${what} plan.` : `You already have a ${what} plan. Use Manage billing to change it.`, 409);
      }
      if (!isSchoolKind(kind)) {
        const schoolPlan = await current(schoolKindOf(kind), schoolId);
        if (grantLive(schoolPlan, now()) && !(hub && schoolPlan?.free)) throw new Refused(`Your school already has ${what}, so you don't need a plan of your own.`, 409);
      }
      // Two teachers at one school must not both pay for the school.
      const pending = await readPending(kind, ownerId);
      if (pending && pending.buyerId !== teacher.id && now() - Date.parse(pending.at) < 30 * 60_000) {
        throw new Refused("Another teacher at your school has just started paying for the school plan. Check with them, or try again in half an hour.", 409);
      }
      const blocks = clampBlocks(req.body?.blocks);
      if (kind === "hub_teacher" && deps.countHubStudents) {
        const students = await deps.countHubStudents(teacher.id);
        if (seatsFor(blocks) < students) throw new Refused(`Your Arise WorkHub caseload has ${students} students, so your plan needs to cover at least that many.`, 409);
      }
      const metadata: Record<string, string> = { kind, ownerId: String(ownerId), buyerId: String(teacher.id) };
      if (!isSchoolKind(kind)) metadata.blocks = String(blocks);
      const email = typeof teacher.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacher.email) ? teacher.email : undefined;
      // Reuse the Stripe customer from the teacher's other plan, so their cards and receipts stay in one place.
      const mine = (await readGrant("teacher", teacher.id)) ?? (await readGrant("hub_teacher", teacher.id));
      const customer = mine?.buyerId === teacher.id ? mine.stripeCustomerId : undefined;
      const price = priceOf(kind);
      const productName = kind === "school" ? `A.R.I.S.E. Premium for a school (up to ${PLANS.school.studentCap.toLocaleString("en-US")} students)`
        : kind === "teacher" ? `A.R.I.S.E. Premium for a teacher (per ${PLANS.teacher.studentsPerBlock} students)`
        : kind === "hub_school" ? `Arise WorkHub for a school (up to ${PLANS.hub.schoolStudentCap.toLocaleString("en-US")} students)`
        : `Arise WorkHub for a teacher (per ${PLANS.hub.studentsPerBlock} students)`;
      const session = await stripe("POST", "/checkout/sessions", {
        mode: "subscription",
        client_reference_id: `${kind}:${ownerId}`,
        ...(customer ? { customer } : email ? { customer_email: email } : {}),
        line_items: [{
          quantity: isSchoolKind(kind) ? 1 : blocks,
          price_data: {
            currency: "usd",
            unit_amount: price.cents,
            recurring: { interval: price.interval },
            product_data: { name: productName },
          },
        }],
        metadata,
        subscription_data: { metadata },
        success_url: billingUrl(req, "paid={CHECKOUT_SESSION_ID}"),
        cancel_url: billingUrl(req),
      });
      if (typeof session?.url !== "string" || !session.url.startsWith("https://")) throw new Refused("The payment page could not be opened. Nothing was charged.", 502);
      // Remember the page that was opened, so the payment is found even if the buyer never comes back to the site.
      if (typeof session.id === "string" && /^cs_[A-Za-z0-9_]{8,200}$/.test(session.id)) {
        const opened: Pending = { sessionId: session.id, buyerId: teacher.id, at: iso(now()) };
        await write(KEY.pending(kind, ownerId), JSON.stringify(opened));
      }
      res.json({ url: session.url });
    } catch (e) { fail(res, e, "checkout"); }
  });

  /** After paying, the browser comes back with the Checkout id. This asks Stripe directly, so Premium is on even if the webhook is slow. */
  app.post("/api/billing/confirm", auth, async (req: any, res: any) => {
    try {
      const session = await stripe("GET", sessionPath(String(req.body?.sessionId || "")));
      const m = meta(session?.metadata);
      if (!m || m.buyerId !== Number(req.user?.id)) throw new Refused("That payment belongs to a different account.", 403);
      const paid = session.status === "complete" && (session.payment_status === "paid" || session.payment_status === "no_payment_required");
      const grant = paid && session.subscription && typeof session.subscription === "object" ? grantFromSubscription(session.subscription, now()) : null;
      if (!grant || grant.kind !== m.kind || grant.ownerId !== m.ownerId) throw new Refused("That payment has not gone through yet.", 409);
      await applyStripeGrant(grant);
      const held = await readGrant(m.kind, m.ownerId, true);
      if (grantLive(held, now())) await clearPending(m.kind, m.ownerId);
      res.json({ ok: true, plan: grantView(held) });
    } catch (e) { fail(res, e, "confirm"); }
  });

  /** A link to Stripe's own page for changing the card, seeing receipts or cancelling. */
  app.post("/api/billing/portal", auth, async (req: any, res: any) => {
    try {
      if (isPlanKind(req.body?.kind) && isAddonKind(req.body.kind)) throw new Refused("Add-on billing is managed with its own button.", 400);
      const teacher = approvedTeacher(req);
      const kind: PlanKind = isPlanKind(req.body?.kind) ? req.body.kind : "teacher";
      const grant = await readGrant(kind, isSchoolKind(kind) ? schoolOf(teacher) : teacher.id);
      if (!grant?.stripeCustomerId) throw new Refused("There is no online payment to manage for this plan.", 409);
      if (grant.buyerId && grant.buyerId !== teacher.id) throw new Refused("Only the teacher who paid for this plan can manage its billing.", 403);
      const session = await stripe("POST", "/billing_portal/sessions", { customer: grant.stripeCustomerId, return_url: billingUrl(req) });
      if (typeof session?.url !== "string" || !session.url.startsWith("https://")) throw new Refused("The billing page could not be opened.", 502);
      res.json({ url: session.url });
    } catch (e) { fail(res, e, "portal"); }
  });

  /** Changes how many 100-student blocks a teacher pays for. */
  app.post("/api/billing/blocks", auth, async (req: any, res: any) => {
    try {
      const teacher = approvedTeacher(req);
      const kind: PlanKind = req.body?.kind === "hub_teacher" ? "hub_teacher" : "teacher";
      const grant = await readGrant(kind, teacher.id);
      if (!grant || grant.source !== "stripe" || !grant.stripeSubscriptionId || !grant.stripeItemId || !grantLive(grant, now())) throw new Refused("You don't have a teacher plan paid online to change.", 409);
      const blocks = clampBlocks(req.body?.blocks);
      const students = kind === "hub_teacher" ? (deps.countHubStudents ? await deps.countHubStudents(teacher.id) : 0) : await deps.countTeacherStudents(teacher.id);
      if (seatsFor(blocks) < students) throw new Refused(`You have ${students} students, so your plan needs to cover at least that many.`, 409);
      const sub = await stripe("POST", subscriptionPath(grant.stripeSubscriptionId), {
        items: [{ id: grant.stripeItemId, quantity: blocks }], proration_behavior: "create_prorations",
      });
      const next = grantFromSubscription(sub, now());
      if (!next || next.ownerId !== teacher.id || next.kind !== kind) throw new Refused("The plan could not be changed.", 502);
      await applyStripeGrant(next);
      res.json({ ok: true, plan: grantView(await readGrant(kind, teacher.id, true)) });
    } catch (e) { fail(res, e, "blocks"); }
  });

  /** Stripe calls this when a payment, renewal or cancellation happens. No sign-in: the signature is the proof. */
  app.post("/api/billing/webhook", async (req: any, res: any) => {
    try {
      const secret = await webhookSecret();
      const raw: unknown = req.rawBody;
      if (!secret || !(Buffer.isBuffer(raw) || typeof raw === "string")) return res.status(400).json({ message: "Webhook is not set up." });
      if (!verifyStripeSignature(raw as Buffer | string, req.headers?.["stripe-signature"], secret, now())) return res.status(400).json({ message: "Bad signature." });
      const event = JSON.parse(Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw));
      await applyEvent(event);
      res.json({ received: true });
    } catch (e: any) {
      console.error("[plans] webhook:", e?.message);
      // A 500 makes Stripe send the event again later.
      res.status(500).json({ message: "Could not process the event." });
    }
  });

  // ─── Add-ons: the Learning Bundle (History, Math, Social) and LifeHub ─────────
  // Parents: $10 a month for the family's Learning Bundle, $10 a month for LifeHub.
  // Teachers: $50 a month for the Learning Bundle for their class (on top of Premium,
  // up to 100 students); LifeHub comes with Arise WorkHub. Every account gets 30 free days.
  // A teacher's class plan replaces a family's plan once it covers every child in the
  // family: the family plan is cancelled and the unused days refunded to the card.

  const ADDON_PAGES: Record<string, string> = { "/social/": "/social/", "/math/": "/math/", "/history/": "/history/", "/to-do": "/#/to-do", "/billing": "/#/billing", "/workhub": "/#/workhub", "/lifehub": "/#/lifehub" };
  const addonReturn = (req: any) => {
    const origin = new URL(siteOf(req)).origin;
    const asked = String(req.body?.returnPath || "/billing");
    const target = ADDON_PAGES[asked] ?? ADDON_PAGES["/billing"];
    const [path, hash] = target.split("#");
    // On arisetodo.com the app is served at /app and "/" is the educator landing page, so a
    // hash-routed page has to be sent back to /app — otherwise someone who has just paid lands on
    // marketing, the "?paid=" confirmation never runs, and the app goes on asking them to pay.
    const onTodoSite = /^https:\/\/(www\.)?arisetodo\.com$/i.test(origin);
    const base = onTodoSite && hash && (path === "" || path === "/") ? "/app" : path;
    return { done: `${origin}${base}?paid={CHECKOUT_SESSION_ID}${hash ? `#${hash}` : ""}`, back: `${origin}${base}${hash ? `#${hash}` : ""}` };
  };
  const firstAndInitial = (name: unknown) => {
    const w = String(name || "").trim().split(/\s+/).filter(Boolean);
    return w.length > 1 ? `${w[0]} ${w[w.length - 1][0].toUpperCase()}.` : w[0] || "Your child";
  };
  const linkedChildren = async (parent: AnyUser): Promise<number[]> =>
    parent.role === "parent" && deps.parentChildIds ? (await deps.parentChildIds(parent.id)).map(posInt).filter(Boolean) : [];
  /** A teacher's class add-on for an app: the app's own, or the old all-three class plan. */
  const teacherClassGrant = async (teacherId: number, app: AppId): Promise<PlanGrant | null> => {
    const own = await current(classKindOf(app), teacherId);
    if (classGrantCovers(own, app, now())) return own;
    const old = await current("bundle_teacher", teacherId);
    return classGrantCovers(old, app, now()) ? old : null;
  };
  /** The class add-on covering this student for an app, if their teacher approved them into a class that has it. */
  const classPlanOf = async (student: AnyUser | null | undefined, app: AppId): Promise<PlanGrant | null> => {
    if (!student || student.role !== "student" || student.approvedByTeacher === false || !posInt(student.teacherId)) return null;
    return teacherClassGrant(Number(student.teacherId), app);
  };
  /** Is this student covered for an app: an old per-app grant on their teacher, or (now) the teacher's Class plan, which includes every app. */
  const studentCoveredFor = async (student: AnyUser | null | undefined, app: AppId): Promise<boolean> => {
    if (!student || student.role !== "student" || student.approvedByTeacher === false || !posInt(student.teacherId)) return false;
    if (await classPlanOf(student, app)) return true;
    const teacher = await deps.getUser(Number(student.teacherId));
    if (!teacher || teacher.role !== "teacher" || teacher.accountApproved === false) return false;
    return (await entitlement(teacher)).premium;
  };
  /** Are all of this parent's linked children (at least one) covered by their teacher's class for these apps? */
  const childrenCoveredByClass = async (parent: AnyUser, apps: readonly AppId[] = APP_IDS): Promise<boolean> => {
    const ids = await linkedChildren(parent);
    if (!ids.length) return false;
    for (const id of ids) {
      const child = await deps.getUser(id);
      for (const app of apps) if (!(await studentCoveredFor(child, app))) return false;
    }
    return true;
  };

  /** Access to one app for this account, and why. Remembered briefly; a database hiccup lets the person in. */
  const appStatus = async (user: AnyUser | null | undefined, app: AppId): Promise<AddonAccess> => {
    if (!user || !posInt(user.id)) return { access: false, via: null, endsAt: null };
    const key = `${app}|${user.id}|${user.role || ""}|${user.isAdmin ? 1 : 0}`;
    const hit = addonCache.get(key);
    if (hit && now() - hit.at < CACHE_MS) return hit.value;
    try {
      const facts: Parameters<typeof appAccessFor>[2] = { now: now(), socialGrant: app === "social" ? await current("social", user.id) : null };
      if (user.role === "teacher") { facts.ownGrant = await teacherClassGrant(user.id, app); facts.classPremium = (await entitlement(user)).premium; }
      else if (user.role === "parent") {
        facts.ownGrant = await current("bundle_family", user.id);
        facts.allChildrenInClassPlans = await childrenCoveredByClass(user, [app]);
      } else {
        const parents = deps.studentParentIds ? await deps.studentParentIds(user.id) : [];
        facts.parentGrants = await Promise.all(parents.map((p) => current("bundle_family", p)));
        facts.classGrant = await classPlanOf(user, app);
        if (user.role === "student" && user.approvedByTeacher !== false && posInt(user.teacherId)) {
          const classTeacher = await deps.getUser(Number(user.teacherId));
          if (classTeacher?.role === "teacher" && classTeacher.accountApproved !== false) facts.classPremium = (await entitlement(classTeacher)).premium;
        }
      }
      const value = appAccessFor(person(user), app, facts);
      addonCache.set(key, { at: now(), value });
      return value;
    } catch (e: any) {
      console.error(`[plans] ${app} check failed:`, e?.message);
      return { access: true, via: null, endsAt: null };
    }
  };
  const appAccess = async (user: AnyUser | null | undefined, app: AppId) => (await appStatus(user, app)).access;
  const socialAccess = (user: AnyUser | null | undefined) => appAccess(user, "social");

  const todoStatus = async (user: AnyUser | null | undefined): Promise<AddonAccess> => {
    if (!user || !posInt(user.id)) return { access: false, via: null, endsAt: null };
    try {
      return todoAccessFor(person(user), {
        now: now(),
        todoGrant: user.role === "parent" ? await current("todo_family", user.id) : null,
        hub: user.role === "teacher" ? await hubAccess(user) : null,
      });
    } catch (e: any) {
      console.error("[plans] LifeHub check failed:", e?.message);
      return { access: true, via: null, endsAt: null };
    }
  };

  // ── Refunds: a teacher's class plan takes over from a family's plan ──
  const REFUND_KEY = (parentId: number) => `addon_refund_${parentId}`;
  /**
   * Cancels a family's paid Learning Bundle now and refunds the unused part of the
   * month to the card it was paid with. If Stripe can't say which payment that was,
   * the unused days go on the family's Stripe balance instead.
   */
  const refundFamilyPlan = async (grant: PlanGrant, reason: string) => {
    if (grant.source !== "stripe" || !grant.stripeSubscriptionId) return;
    let refundedCents = 0;
    const sub = await stripe("GET", `${subscriptionPath(grant.stripeSubscriptionId)}?expand%5B%5D=latest_invoice`);
    if (sub?.status === "canceled") return;
    const item = sub?.items?.data?.[0];
    const start = Number(sub?.current_period_start ?? item?.current_period_start) * 1000;
    const end = Number(sub?.current_period_end ?? item?.current_period_end) * 1000;
    const invoice = sub?.latest_invoice && typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
    const paid = Number(invoice?.amount_paid) || 0;
    const pi = typeof invoice?.payment_intent === "string" ? invoice.payment_intent : invoice?.payment_intent?.id;
    const charge = typeof invoice?.charge === "string" ? invoice.charge : invoice?.charge?.id;
    const unused = end > start && now() < end ? (end - now()) / (end - start) : 0;
    const amount = Math.floor(paid * Math.min(1, Math.max(0, unused)));
    if (amount > 0 && (pi || charge)) {
      await stripe("POST", "/refunds", { ...(pi ? { payment_intent: pi } : { charge }), amount, metadata: { reason: "covered_by_class_plan" } });
      refundedCents = amount;
      await stripe("DELETE", subscriptionPath(grant.stripeSubscriptionId));
    } else {
      // No payment to point a refund at: Stripe puts the unused time on the family's balance.
      await stripe("DELETE", subscriptionPath(grant.stripeSubscriptionId), { prorate: "true", invoice_now: "true" });
    }
    await serial(async () => {
      await saveGrant({ ...grant, status: "canceled", updatedAt: iso(now()), note: reason });
      await write(REFUND_KEY(grant.ownerId), JSON.stringify({ cents: refundedCents, toCard: refundedCents > 0, at: iso(now()), reason }));
    });
  };
  /** Once class add-ons cover all three apps for every child in a paying family, refund the family. */
  const creditFamilyIfCovered = async (parentId: number) => {
    const parent = await deps.getUser(parentId);
    if (!parent || parent.role !== "parent") return;
    const fam = await readGrant("bundle_family", parentId, true);
    if (!fam || fam.source !== "stripe" || !grantLive(fam, now())) return;
    if (!(await childrenCoveredByClass(parent))) return;
    await refundFamilyPlan(fam, "Every child now has Arise Math, Arise History and Arise Social through their teacher's class.");
  };
  /** Runs after a plan is saved. A teacher's new class add-on may take over some families' plans. */
  const afterGrant = async (grant: PlanGrant) => {
    if (!(grant.kind === "bundle_teacher" || isClassAppKind(grant.kind)) || !grantLive(grant, now()) || !deps.teacherStudentIds || !deps.studentParentIds) return;
    try {
      forget();
      const parents = new Set<number>();
      for (const sid of await deps.teacherStudentIds(grant.ownerId)) for (const pid of await deps.studentParentIds(sid)) parents.add(pid);
      for (const pid of parents) await creditFamilyIfCovered(pid).catch((e: any) => console.error("[plans] family refund failed:", pid, e?.message));
    } catch (e: any) {
      console.error("[plans] family refunds after a class plan failed:", e?.message);
    }
  };

  const productKind = (user: AnyUser, product: unknown): PlanKind => {
    if (isAppId(product)) {
      if (user.role === "teacher") return classKindOf(product);
      if (user.role === "parent") throw new Refused("Families get Arise Math, Arise History and Arise Social together in the Learning Bundle.", 400);
      throw new Refused("Ask a parent or your teacher to add it for you.", 403);
    }
    if (product === "todo") {
      if (user.role === "teacher") throw new Refused("Arise LifeHub comes with Arise WorkHub. Get Arise WorkHub on your plan page.", 409);
      if (user.role !== "parent") throw new Refused("LifeHub plans are for parent accounts.", 403);
      return "todo_family";
    }
    if (product === "unlimited" || product === "unlimited_year") {
      if (user.role === "student" || (!user.role && !user.isAdmin)) throw new Refused("A.R.I.S.E. To-Do Unlimited is for adult accounts.", 403);
      return product === "unlimited_year" ? "todo_unlimited_year" : "todo_unlimited";
    }
    if (product === "bundle") {
      if (user.role === "teacher") throw new Refused("Teachers add Arise Math, Arise History and Arise Social for their class one at a time.", 400);
      if (user.role === "parent") return "bundle_family";
      throw new Refused("Ask a parent or your teacher to add the Learning Bundle for you.", 403);
    }
    throw new Refused("Choose an add-on.", 400);
  };
  const addonView = async (user: AnyUser, kind: PlanKind, status: AddonAccess) => {
    const g = await readGrant(kind, user.id);
    return { ...status, plan: grantView(g), paidByYou: !!g && g.buyerId === user.id && !!g.stripeCustomerId };
  };

  /** Everything the add-on cards show: access, why, plans and prices. */
  app.get("/api/addons", auth, async (req: any, res: any) => {
    try {
      const user: AnyUser = req.adminPreview && req.realUser ? req.realUser : req.user;
      if (user.role === "parent") await creditFamilyIfCovered(user.id).catch(() => {});
      const apps: Record<string, any> = {};
      for (const app of APP_IDS) {
        const status = await appStatus(user, app);
        apps[app] = await addonView(user, user.role === "teacher" ? classKindOf(app) : "bundle_family", status);
        // A teacher who still has the old all-three class plan: it shows on every app.
        if (user.role === "teacher" && !apps[app].plan?.live) {
          const old = await readGrant("bundle_teacher", user.id);
          if (grantLive(old, now())) apps[app] = { ...apps[app], plan: grantView(old), paidByYou: !!old && old.buyerId === user.id && !!old.stripeCustomerId, oldBundle: true };
        }
      }
      // One summary for the three apps: whether any of them is open, and why.
      const all = APP_IDS.map((a) => apps[a]);
      const bundle = user.role === "parent" || user.role === "student"
        ? { ...apps.math, access: all.some((a) => a.access), via: all.every((a) => a.via === all[0].via) ? all[0].via : all[0].via }
        : { access: all.some((a) => a.access), via: all.some((a) => a.access) ? "mixed" : null, endsAt: null, plan: null, paidByYou: false };
      const body: any = {
        role: user.isAdmin ? "admin" : user.role || "student",
        payment: !!(await stripeKey()),
        prices: {
          familyBundleCents: PLANS.bundle.familyMonthlyCents, todoCents: 0, hubCents: 0,
          classSeats: PLANS.classApps.seats, classApps: Object.fromEntries(APP_IDS.map((a) => [a, classAppCents(a)])),
        },
        appNames: APP_NAMES,
        apps, bundle,
        todo: await addonView(user, "todo_family", await todoStatus(user)),
      };
      if (user.role === "teacher" && !user.isAdmin) {
        const reading = await entitlement(user);
        body.premium = reading.premium;
        // Why the teacher's reading plan is on (a free year, a plan) and until when, so the card
        // can say the add-ons are a separate thing.
        body.premiumVia = reading.via;
        body.premiumEndsAt = reading.endsAt;
        body.students = await deps.countTeacherStudents(user.id);
        body.hub = await hubAccess(user);
      }
      if (user.role === "parent") {
        const kids = [];
        for (const id of await linkedChildren(user)) {
          const child = await deps.getUser(id);
          if (!child || child.role !== "student") continue;
          const covered: AppId[] = [];
          for (const app of APP_IDS) if (await studentCoveredFor(child, app)) covered.push(app);
          kids.push({ id, name: firstAndInitial(child.displayName), coveredByClass: covered.length === APP_IDS.length, coveredApps: covered });
        }
        body.children = kids;
        body.refund = parse<any>(await read(REFUND_KEY(user.id)), null);
      }
      res.set("Cache-Control", "no-store");
      res.json(body);
    } catch (e) { fail(res, e, "add-ons"); }
  });

  /** Starts a Stripe Checkout page for an add-on: the Learning Bundle or LifeHub. */
  app.post("/api/billing/addon-checkout", auth, async (req: any, res: any) => {
    try {
      const buyer: AnyUser = req.user;
      if (req.adminPreview || !buyer || buyer.isAdmin) throw new Refused("The admin account already has every add-on.", 409);
      if (buyer.accountApproved === false) throw new Refused("Your account is still waiting for approval.", 403);
      if (req.body?.product === "todo") throw new Refused("A.R.I.S.E. To-Do is free. No checkout is needed.", 409);
      const kind = productKind(buyer, req.body?.product);
      if (grantLive(await current(kind, buyer.id), now())) throw new Refused("You already have this add-on. Use Manage billing to change it.", 409);
      if (kind === "todo_unlimited" || kind === "todo_unlimited_year") {
        if ((await todoUnlimited(buyer)).unlimited) throw new Refused("You're already on Unlimited. Use Manage billing to change it.", 409);
        if (kind === "todo_unlimited_year" && !UNLIMITED_YEARLY_OFFER) throw new Refused("The yearly offer has ended. Unlimited is still available monthly.", 409);
      }
      const app = appOfClassKind(kind);
      if (app) {
        // The Class plan now includes Math, History and Connect for every student it covers —
        // there is nothing left to sell separately to a teacher.
        if (!(await entitlement(buyer)).premium) throw new Refused(`${APP_NAMES[app]} for a class is included with the Class plan. Get the Class plan on your plan page first.`, 409);
        throw new Refused(`Your Class plan already includes ${APP_NAMES[app]} for your whole class. There's nothing extra to buy.`, 409);
      }
      if (kind === "bundle_family" && (await childrenCoveredByClass(buyer))) throw new Refused("Your children's teachers already cover Arise Math, Arise History and Arise Social for them, so there's nothing to buy.", 409);
      const pending = await readPending(kind, buyer.id);
      if (pending && now() - Date.parse(pending.at) < 2 * 60_000) throw new Refused("A payment page for this was just opened. Finish it there, or try again in two minutes.", 409);
      const metadata: Record<string, string> = { kind, ownerId: String(buyer.id), buyerId: String(buyer.id) };
      const email = typeof buyer.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email) ? buyer.email : undefined;
      let customer: string | undefined;
      for (const k of PLAN_KINDS) { const g = await readGrant(k, buyer.id); if (g?.buyerId === buyer.id && g.stripeCustomerId) { customer = g.stripeCustomerId; break; } }
      const name = app ? `${APP_NAMES[app]} for a class (up to ${PLANS.classApps.seats} students)`
        : kind === "todo_unlimited" ? UNLIMITED_NAME
        : kind === "todo_unlimited_year" ? `${UNLIMITED_NAME}, yearly`
        : kind === "bundle_family" ? "A.R.I.S.E. Learning Bundle for a family (History, Math, Social)"
        : "Arise LifeHub for a family";
      const back = addonReturn(req);
      const session = await stripe("POST", "/checkout/sessions", {
        mode: "subscription",
        client_reference_id: `${kind}:${buyer.id}`,
        ...(customer ? { customer } : email ? { customer_email: email } : {}),
        line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: priceOf(kind).cents, recurring: { interval: priceOf(kind).interval }, product_data: kind === "todo_unlimited" || kind === "todo_unlimited_year" ? { name, description: FAIR_USE.slice(0, 480) } : { name } } }],
        metadata,
        subscription_data: { metadata },
        success_url: back.done,
        cancel_url: back.back,
      });
      if (typeof session?.url !== "string" || !session.url.startsWith("https://")) throw new Refused("The payment page could not be opened. Nothing was charged.", 502);
      if (typeof session.id === "string" && /^cs_[A-Za-z0-9_]{8,200}$/.test(session.id)) {
        await write(KEY.pending(kind, buyer.id), JSON.stringify({ sessionId: session.id, buyerId: buyer.id, at: iso(now()) }));
      }
      res.json({ url: session.url });
    } catch (e) { fail(res, e, "add-on checkout"); }
  });

  /** Stripe's page for changing the card or cancelling an add-on you paid for. */
  app.post("/api/billing/addon-portal", auth, async (req: any, res: any) => {
    try {
      const buyer: AnyUser = req.user;
      const kind = productKind(buyer, req.body?.product);
      let grant = await readGrant(kind, buyer.id);
      if (isClassAppKind(kind) && !grantLive(grant, now())) {
        const old = await readGrant("bundle_teacher", buyer.id);
        if (grantLive(old, now())) grant = old;
      }
      if (!grant?.stripeCustomerId) throw new Refused("There is no online payment to manage for this add-on.", 409);
      if (grant.buyerId !== buyer.id) throw new Refused("Only the person who paid for this can manage its billing.", 403);
      const session = await stripe("POST", "/billing_portal/sessions", { customer: grant.stripeCustomerId, return_url: addonReturn(req).back });
      if (typeof session?.url !== "string" || !session.url.startsWith("https://")) throw new Refused("The billing page could not be opened.", 502);
      res.json({ url: session.url });
    } catch (e) { fail(res, e, "add-on portal"); }
  });

  // ─── A.R.I.S.E. To-Do: Free and the $5 upgrade ────────────────────────────
  // Free: up to 3 App Store apps across both hubs, and no AI. Unlimited ($5 a month): every app,
  // and AI up to a fair-use ceiling. See shared/todoPlan.ts. (The app check is in routes.ts, which
  // can read the hubs.)
  const readVip = async (fresh = false): Promise<VipEntry[]> => cleanVipList(parse<unknown>(await (fresh ? readFresh(KEY.vip) : read(KEY.vip)), []));
  /** Is this person on the admin's VIP list? A failed read counts as "not on it" for the list, never as a crash. */
  const onVip = async (user: AnyUser): Promise<boolean> => {
    try {
      const list = await readVip();
      if (!list.length) return false;
      // The session may carry only part of the account; the email and "switched on" flag come from the account itself.
      const full = user.email === undefined || user.accountApproved === undefined ? ((await deps.getUser(user.id)) ?? user) : user;
      return onVipList(list, full);
    } catch (e: any) {
      console.error("[plans] VIP list check failed:", e?.message);
      return false;
    }
  };
  const todoUnlimited = async (user: AnyUser) => {
    // `current`, not `readGrant`: it looks up an unfinished Checkout with Stripe and syncs a
    // subscription whose period has lapsed. Reading the saved grant alone meant a payment that
    // the webhook never delivered — late, lost, or a webhook that was never set up — left someone
    // who had paid being told to pay again, with nothing in the app ever going back to ask Stripe.
    // Every other plan goes through `current`; To-Do Unlimited was the one that didn't.
    const [unlimited, yearly, oldLifeHub, vip] = await Promise.all([current("todo_unlimited", user.id), current("todo_unlimited_year", user.id), current("todo_family", user.id), onVip(user)]);
    return todoUnlimitedFor(user as PlanPerson, { unlimited, yearly, oldLifeHub, vip }, now());
  };
  const AI_KEY = (id: number) => `todo_ai_usage_u${id}`;
  /** This month's AI uses for this person: the allowance, how many are used, and how many are left. */
  const aiUsage = async (user: AnyUser) => {
    const plan = await todoUnlimited(user);
    const limit = plan.unlimited ? UNLIMITED_AI_PER_MONTH : 0;
    const saved = parse<{ month?: string; count?: number }>(await read(AI_KEY(user.id)), {});
    const used = saved.month === aiMonth(now()) ? Math.max(0, Number(saved.count) || 0) : 0;
    return { limit, used, left: Math.max(0, limit - used), unlimited: plan.unlimited, admin: plan.via === "admin" };
  };
  /** Counts one AI use (after it worked). */
  const countAiUse = async (user: AnyUser) => {
    await serial(async () => {
      const month = aiMonth(now());
      const saved = parse<{ month?: string; count?: number }>(await read(AI_KEY(user.id)), {});
      const count = saved.month === month ? Math.max(0, Number(saved.count) || 0) + 1 : 1;
      await write(AI_KEY(user.id), JSON.stringify({ month, count }));
    });
  };
  /**
   * Express step in front of every hub AI route: answers 402 when this month's AI uses are gone,
   * and counts a use once the route has answered successfully. Admins are never limited.
   */
  const aiMeter: RequestHandler = async (req: any, res: any, next: any) => {
    try {
      const user: AnyUser | undefined = req.adminPreview && req.realUser ? req.realUser : req.user;
      if (!user) return next();
      const usage = await aiUsage(user);
      if (usage.admin) return next();
      if (usage.left <= 0) {
        return res.status(402).json({
          code: AI_LIMIT, limit: usage.limit, used: usage.used, unlimited: usage.unlimited,
          message: usage.unlimited
            ? `You've reached this month's fair-use limit of ${usage.limit} AI uses. It resets on the 1st.`
            : `AI is part of A.R.I.S.E. To-Do Unlimited: $${UNLIMITED_MONTHLY_CENTS / 100} a month for every app and AI.`,
        });
      }
      res.on("finish", () => { if (res.statusCode < 400) void countAiUse(user).catch(() => {}); });
      next();
    } catch (e) { next(); }
  };

  // ─── Admin ─────────────────────────────────────────────────────────────────
  /**
   * Every A.R.I.S.E. program, and whether this admin can open it. Admins are never charged and
   * never locked out; this runs the same checks the programs themselves use, so the admin
   * settings page shows what is really true rather than a promise.
   */
  app.get("/api/admin/programs", auth, admin, async (req: any, res: any) => {
    try {
      const user: AnyUser = req.adminPreview && req.realUser ? req.realUser : req.user;
      const [reader, hub, todo, ...apps] = await Promise.all([
        entitlement(user), hubAccess(user), todoStatus(user), ...APP_IDS.map((app) => appStatus(user, app)),
      ]);
      res.json({ programs: [
        { id: "reader", name: "A.R.I.S.E. Reader and Class tools", access: reader.premium },
        { id: "hub", name: "Arise WorkHub", access: hub.access },
        { id: "todo", name: "Arise LifeHub", access: todo.access },
        ...APP_IDS.map((app, i) => ({ id: app, name: APP_NAMES[app], access: apps[i].access })),
      ] });
    } catch (e) { fail(res, e, "admin programs"); }
  });

  app.get("/api/admin/plans", auth, admin, async (_req: any, res: any) => {
    try {
      const index = await readIndex();
      const rows: any[] = [];
      for (const kind of PLAN_KINDS) {
        for (const id of index[kind]) {
          const g = await readGrant(kind, id);
          if (!g) continue;
          const name = isSchoolKind(kind) ? await deps.schoolName(id) : (await deps.getUser(id))?.displayName || `${isAddonKind(kind) ? "Account" : "Teacher"} ${id}`;
          const students = isSchoolKind(kind) ? await deps.countSchoolStudents(id)
            : kind === "bundle_teacher" ? await deps.countTeacherStudents(id)
            : isAddonKind(kind) ? 0
            : kind === "hub_teacher" ? (deps.countHubStudents ? await deps.countHubStudents(id) : 0)
            : await deps.countTeacherStudents(id);
          rows.push({ kind, ownerId: id, name, students, source: g.source, status: g.status, seats: g.seats, endsAt: g.endsAt, live: grantLive(g, now()), note: g.note || "" });
        }
      }
      const key = await stripeKey(), secret = await webhookSecret();
      const choice = await readFreeChoice();
      const freeSchools = await Promise.all((deps.schools ? await deps.schools() : []).map(async (sc) => {
        const byName = isFreeSchoolName(sc.name) && (deps.freeByNameAllowed ? await deps.freeByNameAllowed(sc.id) : true);
        return { id: sc.id, name: sc.name, byName, free: !choice.off.includes(sc.id) && (byName || choice.on.includes(sc.id)) };
      }));
      res.set("Cache-Control", "no-store");
      res.json({
        enforced: await enforced(), plans: rows, freeSchools,
        stripe: { keySet: !!key, keyPreview: mask(key), keyFromHosting: !!deps.envStripeKey?.(), webhookSet: !!secret, webhookPreview: mask(secret), webhookFromHosting: !!deps.envWebhookSecret?.() },
        grandfather: { before: PLANS.grandfatherBefore, until: PLANS.grandfatherUntil },
      });
    } catch (e) { fail(res, e, "admin plans"); }
  });

  app.post("/api/admin/plans/enforce", auth, admin, async (req: any, res: any) => {
    try {
      const on = req.body?.enforced === true;
      await write(KEY.enforced, on ? "1" : "0");
      forget();
      res.json({ enforced: on });
    } catch (e) { fail(res, e, "enforce"); }
  });

  /** Makes a school always free, or takes that away. Its teachers are never charged while it is on. */
  app.post("/api/admin/plans/free-school", auth, admin, async (req: any, res: any) => {
    try {
      const schoolId = posInt(req.body?.schoolId);
      const name = schoolId ? await deps.schoolName(schoolId) : "";
      if (!schoolId || !name) throw new Refused("That school could not be found.");
      const free = req.body?.free === true;
      const byName = isFreeSchoolName(name) && (deps.freeByNameAllowed ? await deps.freeByNameAllowed(schoolId) : true);
      await serial(async () => {
        const choice = await readFreeChoice(true);
        const without = (list: number[]) => list.filter((id) => id !== schoolId);
        // A school that is free by its name only needs to come off the "off" list.
        const next: FreeChoice = free
          ? { on: byName ? without(choice.on) : [...without(choice.on), schoolId], off: without(choice.off) }
          : { on: without(choice.on), off: byName ? [...without(choice.off), schoolId] : without(choice.off) };
        await write(KEY.freeSchools, JSON.stringify(next));
        forget();
      });
      res.json({ ok: true, free });
    } catch (e) { fail(res, e, "free school"); }
  });

  // ─── VIP list ──────────────────────────────────────────────────────────────
  // People who get To-Do Unlimited (every app, AI to the fair-use ceiling) with no payment. Added by email, so it
  // works the moment they confirm their account, or by username for an account that exists already.
  const vipRows = async (list: VipEntry[]) => Promise.all(list.map(async (e) => {
    const u = e.userId ? await deps.getUser(e.userId) : null;
    return { email: e.email || "", userId: e.userId || null, label: e.label || "", addedAt: e.addedAt, account: u ? { id: u.id, username: u.username || "", displayName: u.displayName || "", role: u.role || "" } : null };
  }));
  app.get("/api/admin/plans/vip", auth, admin, async (_req: any, res: any) => {
    try { res.set("Cache-Control", "no-store"); res.json({ vip: await vipRows(await readVip(true)), max: VIP_MAX }); }
    catch (e) { fail(res, e, "vip list"); }
  });
  app.post("/api/admin/plans/vip", auth, admin, async (req: any, res: any) => {
    try {
      const who = String(req.body?.who ?? "").trim().replace(/^@/, "");
      if (!who) throw new Refused("Type their email, or the username of an account that already exists.");
      const label = String(req.body?.label ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
      let entry: VipEntry;
      if (who.includes("@")) {
        const email = cleanVipEmail(who);
        if (!email) throw new Refused("That does not look like an email address.");
        entry = { email, ...(label ? { label } : {}), addedAt: iso(now()) };
      } else {
        const u = deps.findUserByUsername ? await deps.findUserByUsername(who.toLowerCase()) : null;
        if (!u || !posInt(u.id)) throw new Refused("No account has that username. For someone who has not signed up yet, use their email.");
        entry = { userId: Number(u.id), ...(label ? { label } : {}), addedAt: iso(now()) };
      }
      await serial(async () => {
        const list = await readVip(true);
        if (list.some((e) => (entry.email && e.email === entry.email) || (entry.userId && e.userId === entry.userId))) throw new Refused("They are on the list already.", 409);
        if (list.length >= VIP_MAX) throw new Refused(`The list is full (${VIP_MAX}). Remove someone first.`);
        await write(KEY.vip, JSON.stringify([...list, entry]));
      });
      res.json({ ok: true, vip: await vipRows(await readVip(true)) });
    } catch (e) { fail(res, e, "vip add"); }
  });
  app.post("/api/admin/plans/vip/remove", auth, admin, async (req: any, res: any) => {
    try {
      const email = cleanVipEmail(req.body?.email);
      const userId = posInt(req.body?.userId);
      if (!email && !userId) throw new Refused("Choose who to take off the list.");
      await serial(async () => {
        const list = await readVip(true);
        const next = list.filter((e) => !((email && e.email === email) || (userId && e.userId === userId)));
        if (next.length === list.length) throw new Refused("They are not on the list.", 404);
        await write(KEY.vip, JSON.stringify(next));
      });
      res.json({ ok: true, vip: await vipRows(await readVip(true)) });
    } catch (e) { fail(res, e, "vip remove"); }
  });

  /** Switches Premium on by hand for a teacher or a school: a purchase order, a gift, a pilot. */
  app.post("/api/admin/plans/grant", auth, admin, async (req: any, res: any) => {
    try {
      const kind: PlanKind | null = isPlanKind(req.body?.kind) ? req.body.kind : null;
      const ownerId = posInt(req.body?.ownerId);
      if (!kind || !ownerId) throw new Refused("Choose a teacher or a school.");
      if (kind === "social") {
        if (!(await deps.getUser(ownerId))) throw new Refused("That account could not be found.");
      } else if (kind === "bundle_family" || kind === "todo_family") {
        const p = await deps.getUser(ownerId);
        if (!p || p.role !== "parent") throw new Refused("That account is not a parent.");
      } else if (!isSchoolKind(kind)) {
        const t = await deps.getUser(ownerId);
        if (!t || t.role !== "teacher") throw new Refused("That account is not a teacher.");
      } else if (!(await deps.schoolName(ownerId))) throw new Refused("That school could not be found.");
      const months = Math.min(60, Math.max(0, Math.floor(Number(req.body?.months) || 0)));
      const seats = priceOf(kind).seats(clampBlocks(req.body?.blocks));
      const grant: PlanGrant = {
        kind, ownerId, source: "admin", status: "active", seats,
        endsAt: months ? iso(now() + months * 30.4375 * DAY) : null, updatedAt: iso(now()),
        note: String(req.body?.note || "").replace(/\s+/g, " ").trim().slice(0, 120) || undefined,
      };
      await serial(async () => {
        const held = await readGrant(kind, ownerId, true);
        if (held?.source === "stripe" && grantLive(held, now())) throw new Refused("This plan is being paid online already.", 409);
        await saveGrant(grant);
      });
      await afterGrant(grant);
      res.json({ ok: true });
    } catch (e) { fail(res, e, "grant"); }
  });

  app.post("/api/admin/plans/revoke", auth, admin, async (req: any, res: any) => {
    try {
      const kind: PlanKind | null = isPlanKind(req.body?.kind) ? req.body.kind : null;
      const ownerId = posInt(req.body?.ownerId);
      await serial(async () => {
        const held = kind ? await readGrant(kind, ownerId, true) : null;
        if (!held) throw new Refused("That plan could not be found.", 404);
        if (held.source === "stripe" && grantLive(held, now())) throw new Refused("This plan is paid online. Cancel it in Stripe so the card stops being charged.", 409);
        await saveGrant({ ...held, status: "canceled", updatedAt: iso(now()) });
      });
      res.json({ ok: true });
    } catch (e) { fail(res, e, "revoke"); }
  });

  /** Saves the Stripe keys. They are never sent back, only a short preview. */
  app.post("/api/admin/plans/stripe", auth, admin, async (req: any, res: any) => {
    try {
      const key = typeof req.body?.secretKey === "string" ? req.body.secretKey.trim() : "";
      const secret = typeof req.body?.webhookSecret === "string" ? req.body.webhookSecret.trim() : "";
      if (!key && !secret) throw new Refused("Paste a key to save.");
      if (key && !/^(sk|rk)_(live|test)_[A-Za-z0-9]{10,}$/.test(key)) throw new Refused("That does not look like a Stripe secret key. It starts with sk_live_ or sk_test_.");
      if (secret && !/^whsec_[A-Za-z0-9]{10,}$/.test(secret)) throw new Refused("That does not look like a Stripe webhook secret. It starts with whsec_.");
      if (key) await write(KEY.stripeKey, key);
      if (secret) await write(KEY.webhookSecret, secret);
      res.json({ ok: true });
    } catch (e) { fail(res, e, "stripe keys"); }
  });

  // ─── For the To-Do admin screen (server/todoAdmin.ts) ──────────────────────
  // Who is on which To-Do plan, what Stripe says people paid, and the actions: a free trial, ending one,
  // cancelling a paid plan, and refunding the last payment.
  const TODO_PAID_KINDS: PlanKind[] = ["todo_unlimited", "todo_unlimited_year"];
  /** Every To-Do plan record, by person. */
  const todoPlanInfos = async (): Promise<Map<number, PlanInfo[]>> => {
    const index = await readIndex();
    const out = new Map<number, PlanInfo[]>();
    for (const kind of TODO_PLAN_KINDS) {
      for (const id of index[kind as PlanKind] || []) {
        const g = await readGrant(kind as PlanKind, id);
        if (!g) continue;
        out.set(id, [...(out.get(id) || []), infoFromGrant(g, now())]);
      }
    }
    return out;
  };
  /** Which person each Stripe customer belongs to, from every plan anyone has bought. */
  const customerOwners = async (): Promise<Map<string, number>> => {
    const index = await readIndex();
    const out = new Map<string, number>();
    for (const kind of PLAN_KINDS) {
      for (const id of index[kind]) {
        const g = await readGrant(kind, id);
        if (g?.stripeCustomerId) out.set(g.stripeCustomerId, posInt(g.buyerId) || (isSchoolKind(kind) ? 0 : id));
      }
    }
    out.delete("");
    return out;
  };

  type Paid = { cents: number; refunded: number; count: number; lastAt: string | null };
  const PAID_TTL = 5 * 60_000, PAID_PAGES = 30;
  let paidCache: { at: number; mode: "live" | "test"; byCustomer: Map<string, Paid>; cents: number; refunded: number; count: number; truncated: boolean } | null = null;
  const chargeOk = (c: any) => c && c.status === "succeeded" && c.paid === true;
  /** What Stripe has taken, in total and by customer. Counts the most recent 3,000 payments. */
  const stripePayments = async (force = false) => {
    if (!force && paidCache && now() - paidCache.at < PAID_TTL) return paidCache;
    const key = await stripeKey();
    if (!key) return null;
    const byCustomer = new Map<string, Paid>();
    let cents = 0, refunded = 0, count = 0, after = "", truncated = false;
    for (let page = 0; ; page++) {
      if (page >= PAID_PAGES) { truncated = true; break; }
      const list = await stripe("GET", `/charges?limit=100${after ? `&starting_after=${encodeURIComponent(after)}` : ""}`);
      const rows: any[] = Array.isArray(list?.data) ? list.data : [];
      for (const c of rows) {
        if (!chargeOk(c)) continue;
        const amount = Math.max(0, Number(c.amount) || 0), back = Math.min(amount, Math.max(0, Number(c.amount_refunded) || 0));
        cents += amount; refunded += back; count++;
        const cus = typeof c.customer === "string" ? c.customer : c.customer?.id;
        if (!cus) continue;
        const at = Number(c.created) > 0 ? iso(Number(c.created) * 1000) : null;
        const cur = byCustomer.get(cus) || { cents: 0, refunded: 0, count: 0, lastAt: null };
        cur.cents += amount; cur.refunded += back; cur.count++;
        if (at && (!cur.lastAt || at > cur.lastAt)) cur.lastAt = at;
        byCustomer.set(cus, cur);
      }
      if (!list?.has_more || !rows.length) break;
      after = String(rows[rows.length - 1].id);
    }
    paidCache = { at: now(), mode: stripeKeyMode(key) === "test" ? "test" : "live", byCustomer, cents, refunded, count, truncated };
    return paidCache;
  };
  /** One person's payments, newest first. */
  const personPayments = async (customerId: string) => {
    if (!/^cus_[A-Za-z0-9]{6,100}$/.test(customerId)) return [];
    const list = await stripe("GET", `/charges?customer=${customerId}&limit=24`);
    return (Array.isArray(list?.data) ? list.data : []).filter(chargeOk).map((c: any) => ({
      id: String(c.id), at: Number(c.created) > 0 ? iso(Number(c.created) * 1000) : "", cents: Number(c.amount) || 0, refundedCents: Number(c.amount_refunded) || 0,
      description: String(c.description || "").slice(0, 120),
    }));
  };
  const personCustomer = async (userId: number): Promise<string> => {
    for (const kind of [...TODO_PAID_KINDS, "todo_family"] as PlanKind[]) {
      const g = await readGrant(kind, userId, true);
      if (g?.stripeCustomerId) return g.stripeCustomerId;
    }
    return "";
  };

  /** A free trial (days) or free access with no end (days = 0). Not while they are paying. */
  const giveTrial = async (userId: number, days: number, note: string) => {
    await serial(async () => {
      for (const kind of TODO_PAID_KINDS) {
        const held = await readGrant(kind, userId, true);
        if (held?.source === "stripe" && grantLive(held, now())) throw new Refused("They are paying for Unlimited already. Cancel their plan first if you want to replace it.", 409);
      }
      const grant: PlanGrant = {
        kind: "todo_unlimited", ownerId: userId, source: "admin", status: "active", seats: 1, trial: true,
        endsAt: days > 0 ? iso(now() + days * DAY) : null, updatedAt: iso(now()),
        note: note.replace(/\s+/g, " ").trim().slice(0, 120) || undefined,
      };
      await saveGrant(grant);
    });
  };
  /** Ends a trial or free access the admin gave. */
  const endTrial = async (userId: number) => {
    await serial(async () => {
      const held = await readGrant("todo_unlimited", userId, true);
      if (!held || held.source !== "admin" || held.status === "canceled") throw new Refused("They have no free trial or free access to end.", 404);
      await saveGrant({ ...held, status: "canceled", updatedAt: iso(now()) });
    });
  };
  /** Cancels a paid plan: at the end of the period they paid for, or right now. */
  const cancelPaid = async (userId: number, when: "period_end" | "now") => {
    let sub = "";
    for (const kind of TODO_PAID_KINDS) {
      const held = await readGrant(kind, userId, true);
      if (held?.source === "stripe" && held.stripeSubscriptionId && held.status !== "canceled" && grantLive(held, now())) { sub = held.stripeSubscriptionId; break; }
    }
    if (!sub) throw new Refused("They are not paying for a plan that can be cancelled.", 404);
    if (when === "now") await stripe("DELETE", subscriptionPath(sub));
    else await stripe("POST", subscriptionPath(sub), { cancel_at_period_end: true });
    await syncSubscription(sub);
    paidCache = null;
  };
  /** Puts a person on the VIP list (free Unlimited for good), or takes them off. Taking off also removes an email entry for them. */
  const vipSet = async (who: { id: number; email: string }, on: boolean) => {
    await serial(async () => {
      const list = await readVip(true);
      const email = cleanVipEmail(who.email);
      const mine = (e: VipEntry) => e.userId === who.id || (!!email && e.email === email);
      if (on && !list.some(mine) && list.length >= VIP_MAX) throw new Refused(`The VIP list is full (${VIP_MAX}). Remove someone first.`);
      const next = on ? (list.some(mine) ? list : [...list, { userId: who.id, addedAt: iso(now()) }]) : list.filter((e) => !mine(e));
      if (next.length !== list.length || on) await write(KEY.vip, JSON.stringify(next));
    });
  };
  /** Takes back a cancel-at-period-end. */
  const keepPlan = async (userId: number) => {
    let sub = "";
    for (const kind of TODO_PAID_KINDS) {
      const held = await readGrant(kind, userId, true);
      if (held?.source === "stripe" && held.stripeSubscriptionId && held.cancelAtPeriodEnd && grantLive(held, now())) { sub = held.stripeSubscriptionId; break; }
    }
    if (!sub) throw new Refused("Their plan is not set to cancel.", 404);
    await stripe("POST", subscriptionPath(sub), { cancel_at_period_end: false });
    await syncSubscription(sub);
  };
  /** Refunds the last payment that has not been refunded yet. Does not cancel the plan. */
  const refundLast = async (userId: number) => {
    const customer = await personCustomer(userId);
    if (!customer) throw new Refused("There is no online payment to refund.", 404);
    const charge = (await personPayments(customer)).find((c: any) => c.refundedCents < c.cents);
    if (!charge) throw new Refused("There is no payment left to refund.", 404);
    await stripe("POST", "/refunds", { charge: charge.id });
    paidCache = null;
    return { cents: charge.cents - charge.refundedCents, at: charge.at };
  };

  return { entitlement, hubAccess, adminTodo: { planInfos: todoPlanInfos, customerOwners, payments: stripePayments, personPayments, personCustomer, giveTrial, endTrial, cancelPaid, keepPlan, refundLast, readVip, vipSet, stripeKey }, socialAccess, appStatus, appAccess, todoStatus, isPremium, isFreeSchool, enforced, blockFreeStudent, parentLinkAllowed, seatCheck, seatCheckFor, teacherGate, applyEvent, forget, todoUnlimited, aiUsage, aiMeter, stripeReady: async () => !!(await stripeKey()), unlimitedPaidBy: async (userId: number) => { for (const k of ["todo_unlimited", "todo_unlimited_year"] as const) { const g = await readGrant(k, userId); if (g && g.buyerId === userId && g.stripeCustomerId && grantLive(g, now())) return k === "todo_unlimited_year" ? "unlimited_year" : "unlimited"; } return null; } };
}

export type Plans = ReturnType<typeof registerPlanRoutes>;
