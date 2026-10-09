// Plans and billing — server.
//
// Free is for students and parents. Premium is for teachers and schools, and a
// Premium teacher's students get the extras through them. This module answers
// "does this person have Premium?", locks what needs it, and takes payment
// through Stripe.
//
// Teacher Hub is a separate add-on with its own plans ("hub_teacher" and
// "hub_school"), bought the same way. Plan rules, the free year and always-free
// schools don't apply to it.
//
// Every teacher's first month is free, for Premium and Teacher Hub alike (see
// freeMonthFrom in shared/plans.ts). Nothing is stored for it: it is worked out
// from the day the account was made.
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
  PLANS, PLAN_KINDS, PREMIUM_REQUIRED, bundleAccessFor, clampBlocks, entitlementFor, freeMonthEnd, grantLive, hubAccessFor, isAddonKind, isDemoAccount, isFreeSchoolName, isHubKind, isPlanKind, todoAccessFor,
  type AddonAccess,
  isSchoolKind, parentCanLink, premiumMessage, priceOf, schoolKindOf, seatsFor,
  type Entitlement, type HubAccess, type PlanFacts, type PlanGrant, type PlanKind, type PlanPerson,
} from "../shared/plans";

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
  /** Students in a teacher's Teacher Hub caseload. Left out, counted as 0. */
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
  /** Schools the admin has made always free ("on"), and name-matched ones the admin has taken off ("off"). */
  freeSchools: "plans_free_schools",
  stripeKey: "stripe_secret_key",
  webhookSecret: "stripe_webhook_secret",
};

/** What a teacher without Premium may still reach: signing in and out, their plan, and paying for it. */
const TEACHER_OPEN = ["/api/social", "/api/addons", "/api/teacher-hub", "/api/me", "/api/login", "/api/logout", "/api/auth", "/api/plan", "/api/billing", "/api/settings", "/api/banners", "/api/notifications", "/api/competition-settings", "/api/schools"];

// Never 401 or 503 here: the app retries those for several seconds before showing the message.
class Refused extends Error { constructor(message: string, readonly status = 400, readonly code?: string) { super(message); } }

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
    // An always-free school is free for Premium only, not for Teacher Hub.
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

  /** Can this teacher open Teacher Hub, and how many students may its caseload hold? */
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

  /** Is there room on this teacher's plan for one more approved student? */
  const seatCheck = async (teacher: AnyUser | null | undefined): Promise<{ ok: boolean; message?: string }> => {
    try {
      if (!teacher || teacher.isAdmin || teacher.role !== "teacher") return { ok: true };
      const e = await entitlement(teacher);
      if (e.via === "teacher-plan" && e.seats !== null) {
        const used = await deps.countTeacherStudents(teacher.id);
        if (used >= e.seats) return { ok: false, message: `This teacher's plan covers ${e.seats.toLocaleString("en-US")} students, and it is full. Another ${PLANS.teacher.studentsPerBlock} students can be added on the plan page.` };
      }
      if (e.via === "school-plan" && e.seats !== null && schoolOf(teacher)) {
        const used = await deps.countSchoolStudents(schoolOf(teacher)!);
        if (used >= e.seats) return { ok: false, message: `The school's plan covers ${e.seats.toLocaleString("en-US")} students, and it is full.` };
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
              endsAt: iso(at + (isSchoolKind(m.kind) ? 366 : 32) * DAY), updatedAt: iso(at), buyerId: m.buyerId || undefined,
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
        // When this teacher's free month ends, or ended.
        body.freeMonthEndsAt = freeMonthEnd(user.createdAt);
        body.students = await deps.countTeacherStudents(user.id);
        body.teacherPlan = grantView(await readGrant("teacher", user.id));
        const schoolPlan = schoolId ? ((await isFreeSchool(schoolId)) ? freeGrant(schoolId) : await readGrant("school", schoolId)) : null;
        body.school = schoolId ? { id: schoolId, name: await deps.schoolName(schoolId), students: await deps.countSchoolStudents(schoolId), plan: grantView(schoolPlan) } : null;
      }
      if (user.role === "teacher" || user.isAdmin) {
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
      const teacher = approvedTeacher(req);
      const kind: PlanKind = isPlanKind(req.body?.kind) ? req.body.kind : "teacher";
      const hub = isHubKind(kind);
      const what = hub ? "Teacher Hub" : "Premium";
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
        if (seatsFor(blocks) < students) throw new Refused(`Your Teacher Hub caseload has ${students} students, so your plan needs to cover at least that many.`, 409);
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
        : kind === "hub_school" ? `A.R.I.S.E. Teacher Hub for a school (up to ${PLANS.hub.schoolStudentCap.toLocaleString("en-US")} students)`
        : `A.R.I.S.E. Teacher Hub for a teacher (per ${PLANS.hub.studentsPerBlock} students)`;
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

  // ─── Add-ons: the Learning Bundle (History, Math, Social) and To-Do ─────────
  // Parents: $10 a month for the family's Learning Bundle, $10 a month for To-Do.
  // Teachers: $50 a month for the Learning Bundle for their class (on top of Premium,
  // up to 100 students); To-Do comes with Teacher Hub. Every account gets 30 free days.
  // A teacher's class plan replaces a family's plan once it covers every child in the
  // family: the family plan is cancelled and the unused days refunded to the card.

  const ADDON_PAGES: Record<string, string> = { "/social/": "/social/", "/math/": "/math/", "/history/": "/history/", "/to-do": "/#/to-do", "/billing": "/#/billing" };
  const addonReturn = (req: any) => {
    const origin = new URL(siteOf(req)).origin;
    const asked = String(req.body?.returnPath || "/billing");
    const target = ADDON_PAGES[asked] ?? ADDON_PAGES["/billing"];
    const [path, hash] = target.split("#");
    return { done: `${origin}${path}?paid={CHECKOUT_SESSION_ID}${hash ? `#${hash}` : ""}`, back: `${origin}${target}` };
  };
  const firstAndInitial = (name: unknown) => {
    const w = String(name || "").trim().split(/\s+/).filter(Boolean);
    return w.length > 1 ? `${w[0]} ${w[w.length - 1][0].toUpperCase()}.` : w[0] || "Your child";
  };
  const linkedChildren = async (parent: AnyUser): Promise<number[]> =>
    parent.role === "parent" && deps.parentChildIds ? (await deps.parentChildIds(parent.id)).map(posInt).filter(Boolean) : [];
  /** The class plan covering this student, if their teacher approved them into a class that has one. */
  const classPlanOf = async (student: AnyUser | null | undefined): Promise<PlanGrant | null> => {
    if (!student || student.role !== "student" || student.approvedByTeacher === false || !posInt(student.teacherId)) return null;
    const g = await current("bundle_teacher", Number(student.teacherId));
    return grantLive(g, now()) ? g : null;
  };
  const childrenCoveredByClass = async (parent: AnyUser): Promise<boolean> => {
    const ids = await linkedChildren(parent);
    if (!ids.length) return false;
    for (const id of ids) if (!(await classPlanOf(await deps.getUser(id)))) return false;
    return true;
  };

  /** Learning Bundle access for this account, and why. Remembered briefly; a database hiccup lets the person in. */
  const bundleStatus = async (user: AnyUser | null | undefined): Promise<AddonAccess> => {
    if (!user || !posInt(user.id)) return { access: false, via: null, endsAt: null, trialEndsAt: null };
    const key = `b|${user.id}|${user.role || ""}|${user.isAdmin ? 1 : 0}`;
    const hit = addonCache.get(key);
    if (hit && now() - hit.at < CACHE_MS) return hit.value;
    try {
      const facts: Parameters<typeof bundleAccessFor>[1] = { now: now(), socialGrant: await current("social", user.id) };
      if (user.role === "teacher") facts.ownGrant = await current("bundle_teacher", user.id);
      else if (user.role === "parent") {
        facts.ownGrant = await current("bundle_family", user.id);
        facts.allChildrenInClassPlans = await childrenCoveredByClass(user);
      } else {
        const parents = deps.studentParentIds ? await deps.studentParentIds(user.id) : [];
        facts.parentGrants = await Promise.all(parents.map((p) => current("bundle_family", p)));
        facts.classGrant = await classPlanOf(user);
      }
      const value = bundleAccessFor(person(user), facts);
      addonCache.set(key, { at: now(), value });
      return value;
    } catch (e: any) {
      console.error("[plans] Learning Bundle check failed:", e?.message);
      return { access: true, via: null, endsAt: null, trialEndsAt: null };
    }
  };
  const bundleAccess = async (user: AnyUser | null | undefined) => (await bundleStatus(user)).access;
  /** Arise Social is part of the Learning Bundle. */
  const socialAccess = bundleAccess;

  const todoStatus = async (user: AnyUser | null | undefined): Promise<AddonAccess> => {
    if (!user || !posInt(user.id)) return { access: false, via: null, endsAt: null, trialEndsAt: null };
    try {
      return todoAccessFor(person(user), {
        now: now(),
        todoGrant: user.role === "parent" ? await current("todo_family", user.id) : null,
        hub: user.role === "teacher" ? await hubAccess(user) : null,
      });
    } catch (e: any) {
      console.error("[plans] To-Do check failed:", e?.message);
      return { access: true, via: null, endsAt: null, trialEndsAt: null };
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
  /** Once every child in a paying family is covered by a class plan, refund the family. */
  const creditFamilyIfCovered = async (parentId: number) => {
    const parent = await deps.getUser(parentId);
    if (!parent || parent.role !== "parent") return;
    const fam = await readGrant("bundle_family", parentId, true);
    if (!fam || fam.source !== "stripe" || !grantLive(fam, now())) return;
    if (!(await childrenCoveredByClass(parent))) return;
    await refundFamilyPlan(fam, "Every child is now covered by their teacher's class plan.");
  };
  /** Runs after a plan is saved. A teacher's new class plan may take over some families' plans. */
  const afterGrant = async (grant: PlanGrant) => {
    if (grant.kind !== "bundle_teacher" || !grantLive(grant, now()) || !deps.teacherStudentIds || !deps.studentParentIds) return;
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
    if (product === "todo") {
      if (user.role === "teacher") throw new Refused("A.R.I.S.E. To-Do comes with Teacher Hub. Get Teacher Hub on your plan page.", 409);
      if (user.role !== "parent") throw new Refused("To-Do plans are for parent accounts.", 403);
      return "todo_family";
    }
    if (product === "bundle") {
      if (user.role === "teacher") return "bundle_teacher";
      if (user.role === "parent") return "bundle_family";
      throw new Refused("Ask a parent or your teacher to add the Learning Bundle for you.", 403);
    }
    throw new Refused("Choose an add-on.", 400);
  };
  const addonView = async (user: AnyUser, kind: PlanKind, status: AddonAccess) => {
    const g = await readGrant(kind, user.id);
    return {
      ...status,
      trialDaysLeft: status.trialEndsAt ? Math.max(0, Math.ceil((Date.parse(status.trialEndsAt) - now()) / DAY)) : null,
      plan: grantView(g), paidByYou: !!g && g.buyerId === user.id && !!g.stripeCustomerId,
    };
  };

  /** Everything the add-on cards show: access, trial countdowns, plans and prices. */
  app.get("/api/addons", auth, async (req: any, res: any) => {
    try {
      const user: AnyUser = req.adminPreview && req.realUser ? req.realUser : req.user;
      if (user.role === "parent") await creditFamilyIfCovered(user.id).catch(() => {});
      const bundleKind: PlanKind = user.role === "teacher" ? "bundle_teacher" : "bundle_family";
      const body: any = {
        role: user.isAdmin ? "admin" : user.role || "student",
        payment: !!(await stripeKey()), trialDays: PLANS.trialDays,
        prices: { familyBundleCents: PLANS.bundle.familyMonthlyCents, teacherBundleCents: PLANS.bundle.teacherMonthlyCents, teacherSeats: PLANS.bundle.teacherSeats, todoCents: PLANS.todo.familyMonthlyCents, hubCents: PLANS.hub.monthlyCents },
        bundle: await addonView(user, bundleKind, await bundleStatus(user)),
        todo: await addonView(user, "todo_family", await todoStatus(user)),
      };
      if (user.role === "teacher" && !user.isAdmin) {
        const reading = await entitlement(user);
        body.premium = reading.premium;
        // Why the teacher's reading plan is on (a free year, a free month, a plan) and until when,
        // so the card can say the add-ons are a separate thing.
        body.premiumVia = reading.via;
        body.premiumEndsAt = reading.endsAt;
        body.students = await deps.countTeacherStudents(user.id);
        body.hub = await hubAccess(user);
      }
      if (user.role === "parent") {
        const kids = [];
        for (const id of await linkedChildren(user)) {
          const child = await deps.getUser(id);
          if (child && child.role === "student") kids.push({ id, name: firstAndInitial(child.displayName), coveredByClass: !!(await classPlanOf(child)) });
        }
        body.children = kids;
        body.refund = parse<any>(await read(REFUND_KEY(user.id)), null);
      }
      res.set("Cache-Control", "no-store");
      res.json(body);
    } catch (e) { fail(res, e, "add-ons"); }
  });

  /** Starts a Stripe Checkout page for an add-on: the Learning Bundle or To-Do. */
  app.post("/api/billing/addon-checkout", auth, async (req: any, res: any) => {
    try {
      const buyer: AnyUser = req.user;
      if (req.adminPreview || !buyer || buyer.isAdmin) throw new Refused("The admin account already has every add-on.", 409);
      if (buyer.accountApproved === false) throw new Refused("Your account is still waiting for approval.", 403);
      const kind = productKind(buyer, req.body?.product);
      if (grantLive(await current(kind, buyer.id), now())) throw new Refused("You already have this add-on. Use Manage billing to change it.", 409);
      if (kind === "bundle_teacher") {
        if (!(await entitlement(buyer)).premium) throw new Refused("The Learning Bundle for a class is added on top of A.R.I.S.E. Premium. Get Premium on your plan page first.", 409);
        const students = await deps.countTeacherStudents(buyer.id);
        if (students > PLANS.bundle.teacherSeats) throw new Refused(`The class plan covers up to ${PLANS.bundle.teacherSeats} students, and you have ${students}.`, 409);
      }
      if (kind === "bundle_family" && (await childrenCoveredByClass(buyer))) throw new Refused("Your children's teachers already cover the Learning Bundle for them, so there's nothing to buy.", 409);
      const pending = await readPending(kind, buyer.id);
      if (pending && now() - Date.parse(pending.at) < 2 * 60_000) throw new Refused("A payment page for this was just opened. Finish it there, or try again in two minutes.", 409);
      const metadata: Record<string, string> = { kind, ownerId: String(buyer.id), buyerId: String(buyer.id) };
      const email = typeof buyer.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email) ? buyer.email : undefined;
      let customer: string | undefined;
      for (const k of PLAN_KINDS) { const g = await readGrant(k, buyer.id); if (g?.buyerId === buyer.id && g.stripeCustomerId) { customer = g.stripeCustomerId; break; } }
      const name = kind === "bundle_teacher" ? `A.R.I.S.E. Learning Bundle for a class (History, Math, Social; up to ${PLANS.bundle.teacherSeats} students)`
        : kind === "bundle_family" ? "A.R.I.S.E. Learning Bundle for a family (History, Math, Social)"
        : "A.R.I.S.E. To-Do for a family";
      const back = addonReturn(req);
      const session = await stripe("POST", "/checkout/sessions", {
        mode: "subscription",
        client_reference_id: `${kind}:${buyer.id}`,
        ...(customer ? { customer } : email ? { customer_email: email } : {}),
        line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: priceOf(kind).cents, recurring: { interval: "month" }, product_data: { name } } }],
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
      const grant = await readGrant(kind, buyer.id);
      if (!grant?.stripeCustomerId) throw new Refused("There is no online payment to manage for this add-on.", 409);
      if (grant.buyerId !== buyer.id) throw new Refused("Only the person who paid for this can manage its billing.", 403);
      const session = await stripe("POST", "/billing_portal/sessions", { customer: grant.stripeCustomerId, return_url: addonReturn(req).back });
      if (typeof session?.url !== "string" || !session.url.startsWith("https://")) throw new Refused("The billing page could not be opened.", 502);
      res.json({ url: session.url });
    } catch (e) { fail(res, e, "add-on portal"); }
  });

  // ─── Admin ─────────────────────────────────────────────────────────────────
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
        freeMonth: { from: PLANS.freeMonthFrom, existingUntil: freeMonthEnd(null) },
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

  return { entitlement, hubAccess, socialAccess, bundleStatus, bundleAccess, todoStatus, isPremium, isFreeSchool, enforced, blockFreeStudent, parentLinkAllowed, seatCheck, seatCheckFor, teacherGate, applyEvent, forget };
}

export type Plans = ReturnType<typeof registerPlanRoutes>;
