// Plans and billing — server.
//
// Free is for students and parents. Premium is for teachers and schools, and a
// Premium teacher's students get the extras through them. This module answers
// "does this person have Premium?", locks what needs it, and takes payment
// through Stripe.
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
  PLANS, PREMIUM_REQUIRED, clampBlocks, entitlementFor, grantLive, parentCanLink, premiumMessage, seatsFor,
  type Entitlement, type PlanFacts, type PlanGrant, type PlanKind, type PlanPerson,
} from "../shared/plans";

type AnyUser = {
  id: number; username?: string; displayName?: string; role?: string; isAdmin?: boolean; email?: string | null;
  createdAt?: unknown; teacherId?: number | null; school_id?: number | null; schoolId?: number | null; accountApproved?: boolean;
};

export type PlanDeps = {
  getSetting(key: string): Promise<string>;
  upsertSetting(key: string, value: string): Promise<void>;
  /** The signed-in user for a session token, or null. Used to check teachers before a route runs. */
  userForToken(token: string): Promise<AnyUser | null>;
  getUser(id: number): Promise<AnyUser | null | undefined>;
  /** Approved students on a teacher's roster. */
  countTeacherStudents(teacherId: number): Promise<number>;
  /** Students at a school. */
  countSchoolStudents(schoolId: number): Promise<number>;
  schoolName(schoolId: number): Promise<string>;
  /** Stripe keys from the hosting environment; the admin panel can also store them. */
  /** The site's own address, used if a request's Host header is missing or odd. */
  appUrl?: string;
  envStripeKey?: () => string;
  envWebhookSecret?: () => string;
  fetch?: typeof fetch;
  now?: () => number;
};

const KEY = {
  enforced: "plans_enforced",
  grant: (kind: PlanKind, id: number) => `plan_${kind}_${id}`,
  index: "plan_index",
  stripeKey: "stripe_secret_key",
  webhookSecret: "stripe_webhook_secret",
};

/** What a teacher without Premium may still reach: signing in and out, their plan, and paying for it. */
const TEACHER_OPEN = ["/api/me", "/api/login", "/api/logout", "/api/auth", "/api/plan", "/api/billing", "/api/settings", "/api/banners", "/api/notifications", "/api/competition-settings", "/api/schools"];

// Never 401 or 503 here: the app retries those for several seconds before showing the message.
class Refused extends Error { constructor(message: string, readonly status = 400, readonly code?: string) { super(message); } }

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const posInt = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 0; };
const schoolOf = (u: AnyUser | null | undefined) => posInt(u?.school_id ?? u?.schoolId) || null;
const person = (u: AnyUser): PlanPerson => ({
  id: u.id, role: u.role, isAdmin: u.isAdmin, username: u.username, createdAt: u.createdAt,
  teacherId: posInt(u.teacherId) || null, schoolId: schoolOf(u), accountApproved: u.accountApproved,
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
  const readJson = async <T,>(key: string, fallback: T): Promise<T> => {
    try { const raw = await deps.getSetting(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
  };
  const enforced = async () => (await deps.getSetting(KEY.enforced)) === "1";
  const readGrant = async (kind: PlanKind, id: number | null | undefined): Promise<PlanGrant | null> => {
    if (!posInt(id)) return null;
    const g = await readJson<PlanGrant | null>(KEY.grant(kind, Number(id)), null);
    return g && g.kind === kind && Number(g.ownerId) === Number(id) ? g : null;
  };
  type Index = { teacher: number[]; school: number[] };
  const readIndex = async (): Promise<Index> => {
    const raw = await readJson<Partial<Index>>(KEY.index, {});
    const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map(posInt).filter(Boolean))] : []);
    return { teacher: ids(raw.teacher), school: ids(raw.school) };
  };

  // Entitlements are looked up on most requests, so they are remembered briefly.
  const cache = new Map<number, { at: number; value: Entitlement }>();
  const CACHE_MS = 30_000;
  const forget = () => cache.clear();

  // One write at a time: two Stripe events arriving together must not overwrite each other's index entry.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T,>(job: () => Promise<T>): Promise<T> => { const run = chain.then(job, job); chain = run.catch(() => {}); return run; };

  const writeGrant = (grant: PlanGrant) => serial(async () => {
    await deps.upsertSetting(KEY.grant(grant.kind, grant.ownerId), JSON.stringify(grant));
    const index = await readIndex();
    if (!index[grant.kind].includes(grant.ownerId)) {
      index[grant.kind].push(grant.ownerId);
      await deps.upsertSetting(KEY.index, JSON.stringify(index));
    }
    forget();
  });

  // ─── Who has Premium ───────────────────────────────────────────────────────
  /**
   * A paid plan whose period has run out is checked with Stripe before it is
   * treated as ended. Renewals normally arrive by webhook; this covers a webhook
   * that is late, lost or was never set up, so a paying teacher is not locked out.
   */
  const lastSync = new Map<string, number>();
  const SYNC_EVERY_MS = 6 * 3_600_000;
  const current = async (kind: PlanKind, id: number | null | undefined): Promise<PlanGrant | null> => {
    const g = await readGrant(kind, id);
    if (!g || g.source !== "stripe" || !g.stripeSubscriptionId || g.status === "canceled") return g;
    if (g.endsAt && now() < Date.parse(g.endsAt)) return g;
    const sub = g.stripeSubscriptionId;
    if (now() - (lastSync.get(sub) ?? -Infinity) < SYNC_EVERY_MS) return g;
    lastSync.set(sub, now());
    try {
      if (!(await stripeKey())) return g;
      const next = grantFromSubscription(await stripe("GET", `/subscriptions/${encodeURIComponent(sub)}`), now());
      if (!next || next.kind !== g.kind || next.ownerId !== g.ownerId) return g;
      await applyStripeGrant(next);
      return (await readGrant(kind, id)) ?? g;
    } catch (e: any) {
      console.error("[plans] renewal check failed:", e?.message);
      return g;
    }
  };

  const factsFor = async (user: AnyUser): Promise<PlanFacts> => {
    const facts: PlanFacts = { enforced: await enforced(), now: now() };
    if (!facts.enforced || user.isAdmin) return facts;
    facts.schoolGrant = await current("school", schoolOf(user));
    if (user.role === "teacher") {
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
    const hit = cache.get(user.id);
    if (hit && now() - hit.at < CACHE_MS) return hit.value;
    const value = entitlementFor(person(user), await factsFor(user));
    cache.set(user.id, { at: now(), value });
    return value;
  };

  // ─── Locks used by the rest of the server ──────────────────────────────────
  const pathOf = (req: any) => String(req.originalUrl || req.url || "").split("?")[0];

  /**
   * A teacher account is part of Premium. With plan rules on, a teacher without
   * it can still sign in, see their plan and pay; every other request stops here.
   * If the plan lookup itself fails, the request goes through: a storage hiccup
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
  };

  /** Is there room on this teacher's plan for one more approved student? */
  const seatCheck = async (teacher: AnyUser): Promise<{ ok: boolean; message?: string }> => {
    try {
      if (teacher.isAdmin || teacher.role !== "teacher") return { ok: true };
      const e = await entitlement(teacher);
      if (e.via === "teacher-plan" && e.seats !== null) {
        const used = await deps.countTeacherStudents(teacher.id);
        if (used >= e.seats) return { ok: false, message: `Your plan covers ${e.seats.toLocaleString("en-US")} students. Add another ${PLANS.teacher.studentsPerBlock} students in Billing to approve more.` };
      }
      if (e.via === "school-plan" && e.seats !== null && schoolOf(teacher)) {
        const used = await deps.countSchoolStudents(schoolOf(teacher)!);
        if (used >= e.seats) return { ok: false, message: `Your school's plan covers ${e.seats.toLocaleString("en-US")} students, and it is full.` };
      }
      return { ok: true };
    } catch { return { ok: true }; }
  };

  // ─── Stripe ────────────────────────────────────────────────────────────────
  const stripeKey = async () => (deps.envStripeKey?.() || (await deps.getSetting(KEY.stripeKey)) || "").trim();
  const webhookSecret = async () => (deps.envWebhookSecret?.() || (await deps.getSetting(KEY.webhookSecret)) || "").trim();

  const stripe = async (method: "GET" | "POST", path: string, params?: Record<string, unknown>): Promise<any> => {
    const key = await stripeKey();
    if (!key) throw new Refused("Online payment is not set up yet.", 409);
    let res: Response;
    try {
      res = await doFetch(`https://api.stripe.com/v1${path}`, {
        method,
        headers: { Authorization: `Bearer ${key}`, ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
        body: method === "POST" ? stripeForm(params || {}) : undefined,
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

  const originOf = (req: any) => {
    const header = (name: string) => String(req.headers?.[name] || "").split(",")[0].trim();
    const proto = header("x-forwarded-proto") || req.protocol || "https";
    const host = header("host");
    // Only a plain host name goes into the address Stripe sends the buyer back to.
    if (!/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?(:\d{1,5})?$/i.test(host)) return String(deps.appUrl || "").replace(/\/+$/, "");
    return `${proto === "http" ? "http" : "https"}://${host}`;
  };

  const meta = (m: any): { kind: PlanKind; ownerId: number; buyerId: number } | null => {
    const kind = m?.kind === "teacher" || m?.kind === "school" ? (m.kind as PlanKind) : null;
    const ownerId = posInt(m?.ownerId), buyerId = posInt(m?.buyerId);
    return kind && ownerId ? { kind, ownerId, buyerId } : null;
  };

  /** Turns a Stripe subscription into our plan record. */
  const grantFromSubscription = (sub: any, at: number, deleted = false): PlanGrant | null => {
    const m = meta(sub?.metadata);
    if (!m || typeof sub?.id !== "string") return null;
    const item = sub?.items?.data?.[0];
    const periodEnd = Number(sub.current_period_end ?? item?.current_period_end);
    const status: PlanGrant["status"] = deleted ? "canceled" : sub.status === "active" || sub.status === "trialing" ? "active" : sub.status === "past_due" ? "past_due" : "canceled";
    let endsAt = Number.isFinite(periodEnd) && periodEnd > 0 ? periodEnd * 1000 : at;
    // A missed payment keeps the class running for a week while the card is retried, not a whole period.
    if (status === "past_due") endsAt = Math.min(endsAt, at + 7 * DAY);
    return {
      kind: m.kind, ownerId: m.ownerId, source: "stripe", status,
      seats: m.kind === "school" ? PLANS.school.studentCap : seatsFor(clampBlocks(item?.quantity ?? 1)),
      endsAt: iso(endsAt), updatedAt: iso(at), buyerId: m.buyerId || undefined,
      stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
      stripeSubscriptionId: sub.id, stripeItemId: typeof item?.id === "string" ? item.id : undefined,
    };
  };

  /** Saves a plan from Stripe unless we already hold newer news about it, or the admin granted this plan by hand. */
  const applyStripeGrant = async (next: PlanGrant) => {
    const current = await readGrant(next.kind, next.ownerId);
    if (current) {
      if (current.source === "admin" && grantLive(current, now()) && next.status !== "active") return;
      const sameSub = current.stripeSubscriptionId === next.stripeSubscriptionId;
      if (sameSub && Date.parse(current.updatedAt) > Date.parse(next.updatedAt)) return;
      // An old, ended subscription must not switch off a newer one that is live.
      if (!sameSub && current.source === "stripe" && grantLive(current, now()) && next.status === "canceled") return;
    }
    await writeGrant(next);
  };

  const applyEvent = async (event: any) => {
    const at = Number(event?.created) > 0 ? Number(event.created) * 1000 : now();
    const obj = event?.data?.object;
    switch (event?.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const grant = grantFromSubscription(obj, at, event.type.endsWith("deleted"));
        if (grant) await applyStripeGrant(grant);
        return;
      }
      case "checkout.session.completed": {
        // The subscription events carry the real dates. This only switches Premium on at once if they are late.
        const m = meta(obj?.metadata);
        if (!m || obj?.mode !== "subscription" || typeof obj?.subscription !== "string") return;
        if (obj.payment_status !== "paid" && obj.payment_status !== "no_payment_required") return;
        const current = await readGrant(m.kind, m.ownerId);
        if (current?.stripeSubscriptionId === obj.subscription && grantLive(current, now())) return;
        await applyStripeGrant({
          kind: m.kind, ownerId: m.ownerId, source: "stripe", status: "active",
          seats: m.kind === "school" ? PLANS.school.studentCap : seatsFor(clampBlocks(obj?.metadata?.blocks)),
          endsAt: iso(at + (m.kind === "school" ? 366 : 32) * DAY), updatedAt: iso(at), buyerId: m.buyerId || undefined,
          stripeCustomerId: typeof obj.customer === "string" ? obj.customer : undefined, stripeSubscriptionId: obj.subscription,
        });
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
    paidOnline: g.source === "stripe", canManage: !!g.stripeCustomerId,
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
        body.school = schoolId ? { id: schoolId, name: await deps.schoolName(schoolId), students: await deps.countSchoolStudents(schoolId), plan: grantView(await readGrant("school", schoolId)) } : null;
      }
      res.set("Cache-Control", "no-store");
      res.json(body);
    } catch (e) { fail(res, e, "plan"); }
  });

  /** Starts a Stripe Checkout page for a teacher plan or a school plan and returns its address. */
  app.post("/api/billing/checkout", auth, async (req: any, res: any) => {
    try {
      const teacher = approvedTeacher(req);
      const kind: PlanKind = req.body?.kind === "school" ? "school" : "teacher";
      const schoolId = schoolOf(teacher);
      if (kind === "school" && !schoolId) throw new Refused("Your account is not connected to a school yet, so a school plan can't be bought from it.", 409);
      const ownerId = kind === "school" ? schoolId! : teacher.id;
      const existing = await readGrant(kind, ownerId);
      if (existing?.source === "stripe" && existing.status !== "canceled" && grantLive(existing, now())) {
        throw new Refused(kind === "school" ? "Your school already has a Premium plan." : "You already have a Premium plan. Use Manage billing to change it.", 409);
      }
      if (kind === "teacher" && grantLive(await readGrant("school", schoolId), now())) throw new Refused("Your school already has Premium, so you don't need a plan of your own.", 409);
      const blocks = clampBlocks(req.body?.blocks);
      const metadata: Record<string, string> = { kind, ownerId: String(ownerId), buyerId: String(teacher.id) };
      if (kind === "teacher") metadata.blocks = String(blocks);
      const origin = originOf(req);
      const email = typeof teacher.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacher.email) ? teacher.email : undefined;
      const mine = await readGrant("teacher", teacher.id);
      const customer = mine?.buyerId === teacher.id ? mine.stripeCustomerId : undefined;
      const session = await stripe("POST", "/checkout/sessions", {
        mode: "subscription",
        client_reference_id: `${kind}:${ownerId}`,
        ...(customer ? { customer } : email ? { customer_email: email } : {}),
        line_items: [{
          quantity: kind === "school" ? 1 : blocks,
          price_data: {
            currency: "usd",
            unit_amount: kind === "school" ? PLANS.school.yearlyCents : PLANS.teacher.monthlyCents,
            recurring: { interval: kind === "school" ? "year" : "month" },
            product_data: { name: kind === "school" ? `A.R.I.S.E. Premium for a school (up to ${PLANS.school.studentCap.toLocaleString("en-US")} students)` : `A.R.I.S.E. Premium for a teacher (per ${PLANS.teacher.studentsPerBlock} students)` },
          },
        }],
        metadata,
        subscription_data: { metadata },
        success_url: `${origin}/#/billing?paid={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/#/billing`,
      });
      if (typeof session?.url !== "string" || !session.url.startsWith("https://")) throw new Refused("The payment page could not be opened. Nothing was charged.", 502);
      res.json({ url: session.url });
    } catch (e) { fail(res, e, "checkout"); }
  });

  /** After paying, the browser comes back with the Checkout id. This asks Stripe directly, so Premium is on even if the webhook is slow. */
  app.post("/api/billing/confirm", auth, async (req: any, res: any) => {
    try {
      const id = String(req.body?.sessionId || "");
      if (!/^cs_[A-Za-z0-9_]{8,200}$/.test(id)) throw new Refused("That payment could not be found.", 400);
      const session = await stripe("GET", `/checkout/sessions/${id}?expand%5B%5D=subscription`);
      const m = meta(session?.metadata);
      if (!m || m.buyerId !== Number(req.user?.id)) throw new Refused("That payment belongs to a different account.", 403);
      const paid = session.status === "complete" && (session.payment_status === "paid" || session.payment_status === "no_payment_required");
      const grant = paid && session.subscription && typeof session.subscription === "object" ? grantFromSubscription(session.subscription, now()) : null;
      if (!grant || grant.kind !== m.kind || grant.ownerId !== m.ownerId) throw new Refused("That payment has not gone through yet.", 409);
      await applyStripeGrant(grant);
      res.json({ ok: true, plan: grantView(grant) });
    } catch (e) { fail(res, e, "confirm"); }
  });

  /** A link to Stripe's own page for changing the card, seeing receipts or cancelling. */
  app.post("/api/billing/portal", auth, async (req: any, res: any) => {
    try {
      const teacher = approvedTeacher(req);
      const kind: PlanKind = req.body?.kind === "school" ? "school" : "teacher";
      const grant = await readGrant(kind, kind === "school" ? schoolOf(teacher) : teacher.id);
      if (!grant?.stripeCustomerId) throw new Refused("There is no online payment to manage for this plan.", 409);
      if (grant.buyerId && grant.buyerId !== teacher.id) throw new Refused("Only the teacher who paid for this plan can manage its billing.", 403);
      const session = await stripe("POST", "/billing_portal/sessions", { customer: grant.stripeCustomerId, return_url: `${originOf(req)}/#/billing` });
      if (typeof session?.url !== "string" || !session.url.startsWith("https://")) throw new Refused("The billing page could not be opened.", 502);
      res.json({ url: session.url });
    } catch (e) { fail(res, e, "portal"); }
  });

  /** Changes how many 100-student blocks a teacher pays for. */
  app.post("/api/billing/blocks", auth, async (req: any, res: any) => {
    try {
      const teacher = approvedTeacher(req);
      const grant = await readGrant("teacher", teacher.id);
      if (!grant || grant.source !== "stripe" || !grant.stripeSubscriptionId || !grant.stripeItemId || !grantLive(grant, now())) throw new Refused("You don't have a teacher plan paid online to change.", 409);
      const blocks = clampBlocks(req.body?.blocks);
      const students = await deps.countTeacherStudents(teacher.id);
      if (seatsFor(blocks) < students) throw new Refused(`You have ${students} students, so your plan needs to cover at least that many.`, 409);
      const sub = await stripe("POST", `/subscriptions/${encodeURIComponent(grant.stripeSubscriptionId)}`, {
        items: [{ id: grant.stripeItemId, quantity: blocks }], proration_behavior: "create_prorations",
      });
      const next = grantFromSubscription(sub, now());
      if (!next || next.ownerId !== teacher.id || next.kind !== "teacher") throw new Refused("The plan could not be changed.", 502);
      await applyStripeGrant(next);
      res.json({ ok: true, plan: grantView(next) });
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

  // ─── Admin ─────────────────────────────────────────────────────────────────
  app.get("/api/admin/plans", auth, admin, async (_req: any, res: any) => {
    try {
      const index = await readIndex();
      const rows: any[] = [];
      for (const kind of ["school", "teacher"] as PlanKind[]) {
        for (const id of index[kind]) {
          const g = await readGrant(kind, id);
          if (!g) continue;
          const name = kind === "school" ? await deps.schoolName(id) : (await deps.getUser(id))?.displayName || `Teacher ${id}`;
          const students = kind === "school" ? await deps.countSchoolStudents(id) : await deps.countTeacherStudents(id);
          rows.push({ kind, ownerId: id, name, students, source: g.source, status: g.status, seats: g.seats, endsAt: g.endsAt, live: grantLive(g, now()), note: g.note || "" });
        }
      }
      const key = await stripeKey(), secret = await webhookSecret();
      res.set("Cache-Control", "no-store");
      res.json({
        enforced: await enforced(), plans: rows,
        stripe: { keySet: !!key, keyPreview: mask(key), keyFromHosting: !!deps.envStripeKey?.(), webhookSet: !!secret, webhookPreview: mask(secret), webhookFromHosting: !!deps.envWebhookSecret?.() },
        grandfather: { before: PLANS.grandfatherBefore, until: PLANS.grandfatherUntil },
      });
    } catch (e) { fail(res, e, "admin plans"); }
  });

  app.post("/api/admin/plans/enforce", auth, admin, async (req: any, res: any) => {
    try {
      const on = req.body?.enforced === true;
      await deps.upsertSetting(KEY.enforced, on ? "1" : "0");
      forget();
      res.json({ enforced: on });
    } catch (e) { fail(res, e, "enforce"); }
  });

  /** Switches Premium on by hand for a teacher or a school: a purchase order, a gift, a pilot. */
  app.post("/api/admin/plans/grant", auth, admin, async (req: any, res: any) => {
    try {
      const kind: PlanKind | null = req.body?.kind === "school" ? "school" : req.body?.kind === "teacher" ? "teacher" : null;
      const ownerId = posInt(req.body?.ownerId);
      if (!kind || !ownerId) throw new Refused("Choose a teacher or a school.");
      if (kind === "teacher") {
        const t = await deps.getUser(ownerId);
        if (!t || t.role !== "teacher") throw new Refused("That account is not a teacher.");
      } else if (!(await deps.schoolName(ownerId))) throw new Refused("That school could not be found.");
      const current = await readGrant(kind, ownerId);
      if (current?.source === "stripe" && grantLive(current, now())) throw new Refused("This plan is being paid online already.", 409);
      const months = Math.min(60, Math.max(0, Math.floor(Number(req.body?.months) || 0)));
      const seats = kind === "school" ? PLANS.school.studentCap : seatsFor(clampBlocks(req.body?.blocks));
      const grant: PlanGrant = {
        kind, ownerId, source: "admin", status: "active", seats,
        endsAt: months ? iso(now() + months * 30.4375 * DAY) : null, updatedAt: iso(now()),
        note: String(req.body?.note || "").replace(/\s+/g, " ").trim().slice(0, 120) || undefined,
      };
      await writeGrant(grant);
      res.json({ ok: true });
    } catch (e) { fail(res, e, "grant"); }
  });

  app.post("/api/admin/plans/revoke", auth, admin, async (req: any, res: any) => {
    try {
      const kind: PlanKind | null = req.body?.kind === "school" ? "school" : req.body?.kind === "teacher" ? "teacher" : null;
      const current = kind ? await readGrant(kind, posInt(req.body?.ownerId)) : null;
      if (!current) throw new Refused("That plan could not be found.", 404);
      if (current.source === "stripe" && grantLive(current, now())) throw new Refused("This plan is paid online. Cancel it in Stripe so the card stops being charged.", 409);
      await writeGrant({ ...current, status: "canceled", updatedAt: iso(now()) });
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
      if (key) await deps.upsertSetting(KEY.stripeKey, key);
      if (secret) await deps.upsertSetting(KEY.webhookSecret, secret);
      res.json({ ok: true });
    } catch (e) { fail(res, e, "stripe keys"); }
  });

  return { entitlement, isPremium, enforced, blockFreeStudent, parentLinkAllowed, seatCheck, teacherGate, applyEvent, forget };
}

export type Plans = ReturnType<typeof registerPlanRoutes>;
