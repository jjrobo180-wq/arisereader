// The Arise Reader Reward Store — server (rules in shared/rewardStore.ts).
//
// A student cashes in Reward Points; a parent says yes or no; a paid reward goes to the parent's email, sent
// automatically through Tremendous when it's set up (TREMENDOUS_API_KEY and the item's Tremendous product id),
// otherwise it waits in the admin's queue to be sent by hand. A perk (a parent's own reward) is given by the parent.
// Storage is the settings table, passed in, so there's no database migration and it all runs in tests.
import type { Express, RequestHandler } from "express";
import { randomBytes } from "node:crypto";
import {
  DEFAULT_CATALOG, DEFAULT_CONFIG, LIMITS, PERK_IDEAS, balanceOf, canRedeem, cleanCatalog, cleanConfig, earnings, monthOf, monthSpend, storeSummary,
  type AttemptLike, type RewardItem, type RewardRequest, type StoreConfig, PAID_STORE_OPEN,
} from "../shared/rewardStore";

type AnyUser = { id: number; displayName?: string; username?: string; role?: string | null; isAdmin?: boolean; email?: string | null };

export type RewardDeps = {
  /** The A.R.I.S.E.-paid gift-card catalog (PAID_STORE_OPEN); tests open it to check the machinery. */
  paidStoreOpen?: boolean;
  getSetting(key: string): Promise<string>;
  upsertSetting(key: string, value: string): Promise<void>;
  /** Throws when the database can't be reached (a failed read must never look like an empty list before a save). */
  readSetting?(key: string): Promise<string>;
  getUser(id: number): Promise<AnyUser | null | undefined>;
  attempts(studentId: number): Promise<AttemptLike[]>;
  beginnersPasses(studentId: number): Promise<number[]>;
  bookTitle?(bookId: number): Promise<string>;
  parentStudentIds(parentId: number): Promise<number[]>;
  studentParentIds(studentId: number): Promise<number[]>;
  /** Is this student on a paid family plan (paid rewards are only for them)? */
  paidFamily(student: AnyUser): Promise<boolean>;
  notify?(userId: number, text: string): Promise<void>;
  /** Sends a paid reward through Tremendous. Left out (no key), paid rewards wait for the admin. */
  tremendous?(order: { productId: string; cents: number; name: string; email: string; ref: string }): Promise<string>;
  now?: () => number;
};

class Refused extends Error { constructor(message: string, readonly status = 400) { super(message); } }
const nameOf = (u: AnyUser | null | undefined) => String(u?.displayName || u?.username || "Someone");
const isAdmin = (u: AnyUser) => !!u.isAdmin || u.role === "admin";
const KEYS = { config: "reward_store_config", catalog: "reward_store_catalog", requests: "reward_requests", perks: (parentId: number) => `reward_perks_parent_${parentId}` };
const newId = () => `rw_${Date.now().toString(36)}${randomBytes(4).toString("hex")}`;
const emailOk = (e: unknown) => typeof e === "string" && /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e.trim());

export function registerRewardStoreRoutes(app: Express, auth: RequestHandler, deps: RewardDeps) {
  const now = () => (deps.now ?? Date.now)();
  const today = () => new Date(now()).toISOString().slice(0, 10);
  const month = () => monthOf(new Date(now()).toISOString());
  const read = (key: string) => (deps.readSetting ?? deps.getSetting)(key);
  const json = <T,>(raw: string, fb: T): T => { try { return raw ? JSON.parse(raw) : fb; } catch { return fb; } };

  const config = async (): Promise<StoreConfig> => cleanConfig(json(await deps.getSetting(KEYS.config), DEFAULT_CONFIG));
  const catalog = async (): Promise<RewardItem[]> => { const raw = await deps.getSetting(KEYS.catalog); return raw ? cleanCatalog(json(raw, [])) : DEFAULT_CATALOG; };
  const requests = async (strict = false): Promise<RewardRequest[]> => { const v = json<unknown>(await (strict ? read : deps.getSetting)(KEYS.requests), []); return Array.isArray(v) ? (v as RewardRequest[]) : []; };
  const saveRequests = (list: RewardRequest[]) => deps.upsertSetting(KEYS.requests, JSON.stringify(list.slice(-LIMITS.requests)));
  const perksOf = async (parentId: number): Promise<RewardItem[]> => cleanCatalog(json(await deps.getSetting(KEYS.perks(parentId)), []), true);
  /** Changes the request list safely: read straight from the database first, then save. */
  const changeRequests = async (fn: (list: RewardRequest[]) => RewardRequest[]) => { const next = fn(await requests(true)); await saveRequests(next); return next; };

  /** A student's earnings and balance. Before the store's start day nothing counts; the first save sets it to today. */
  const studentState = async (studentId: number, cfg: StoreConfig, all: RewardRequest[]) => {
    const titles = new Map<number, string>();
    const atts = await deps.attempts(studentId);
    if (deps.bookTitle) for (const a of atts.filter((x) => x.pointsEarned > 0).slice(-60)) if (!titles.has(a.bookId)) titles.set(a.bookId, await deps.bookTitle(a.bookId).catch(() => "a book"));
    const earned = earnings(atts, await deps.beginnersPasses(studentId).catch(() => []), cfg.startedOn || today(), (id) => titles.get(id) || "a book");
    const mine = all.filter((r) => r.studentId === studentId);
    const b = balanceOf(earned, mine, today());
    return { earnings: earned, mine, balance: b.balance, earned: b.earned, spent: b.spent, expiring: b.expiring };
  };
  const ensureStarted = async (cfg: StoreConfig) => { if (!cfg.startedOn) { cfg = { ...cfg, startedOn: today() }; await deps.upsertSetting(KEYS.config, JSON.stringify(cfg)); } return cfg; };

  const wrap = (fn: (req: any, res: any) => Promise<unknown>): RequestHandler => async (req, res) => {
    try { await fn(req, res); }
    catch (e: any) { if (e instanceof Refused) res.status(e.status).json({ message: e.message }); else { console.error("[rewards]", e?.message); res.status(500).json({ message: "The Reward Store couldn't do that. Try again." }); } }
  };
  const me = async (req: any): Promise<AnyUser> => { const u = await deps.getUser(Number(req.user?.id)); if (!u) throw new Refused("Sign in again.", 403); return u; };
  const roleOf = (u: AnyUser) => (isAdmin(u) ? "admin" : u.role === "parent" ? "parent" : u.role === "student" || !u.role ? "student" : "other");

  // ── What each person sees ──
  app.get("/api/rewards", auth, wrap(async (req, res) => {
    const u = await me(req);
    res.set("Cache-Control", "no-store");
    const cfg = await ensureStarted(await config());
    const all = await requests();
    const role = roleOf(u);
    if (role === "student") {
      const st = await studentState(u.id, cfg, all);
      const parents = await deps.studentParentIds(u.id);
      const paidPlan = await deps.paidFamily(u);
      const perks = (await Promise.all(parents.map(async (pid) => (await perksOf(pid)).map((p) => ({ ...p, id: `perk:${pid}:${p.id}` }))))).flat();
      const avail = (it: RewardItem) => canRedeem({ item: it, balance: st.balance, config: cfg, requests: all, studentId: u.id, month: month(), paidPlan, hasParent: parents.length > 0 });
      return res.json({
        role, balance: st.balance, earnedTotal: st.earned, spentTotal: st.spent, expiring: st.expiring,
        recent: st.earnings.slice(-20).reverse(),
        store: ((deps.paidStoreOpen ?? PAID_STORE_OPEN) ? await catalog() : []).filter((x) => x.active).map((it) => ({ ...it, tremendousProduct: undefined, availability: avail(it) })),
        perks: perks.filter((x) => x.active).map((it) => ({ ...it, availability: avail(it) })),
        requests: st.mine.slice(-50).reverse(),
        monthUsedCents: monthSpend(all, month(), u.id), studentCapCents: cfg.studentCapCents, hasParent: parents.length > 0, paidPlan,
      });
    }
    if (role === "parent") {
      const kids = await deps.parentStudentIds(u.id);
      const children = await Promise.all(kids.map(async (id) => { const k = await deps.getUser(id); const st = await studentState(id, cfg, all); return { id, name: nameOf(k), balance: st.balance }; }));
      const theirs = all.filter((r) => kids.includes(r.studentId));
      return res.json({
        role, children, email: emailOk(u.email) ? String(u.email) : "",
        waiting: theirs.filter((r) => r.status === "waiting").reverse(),
        toGive: theirs.filter((r) => r.status === "approved" && r.kind === "perk" && r.perkParentId === u.id).reverse(),
        recent: theirs.filter((r) => r.status !== "waiting").slice(-40).reverse(),
        perks: await perksOf(u.id), ideas: PERK_IDEAS,
      });
    }
    if (role === "admin") {
      return res.json({
        role, config: cfg, catalog: await catalog(), summary: storeSummary(all, cfg, month()), tremendous: !!deps.tremendous,
        queue: all.filter((r) => r.status === "approved" && r.costCents > 0).reverse(), recent: all.slice(-100).reverse(),
      });
    }
    res.json({ role });
  }));

  // ── A student cashes in ──
  app.post("/api/rewards/redeem", auth, wrap(async (req, res) => {
    const u = await me(req);
    if (roleOf(u) !== "student") throw new Refused("Only a student can cash in points.", 403);
    const itemId = String(req.body?.itemId || "");
    const cfg = await ensureStarted(await config());
    const parents = await deps.studentParentIds(u.id);
    let it: RewardItem | undefined, perkParentId: number | undefined;
    const m = /^perk:(\d+):(.+)$/.exec(itemId);
    if (m) { perkParentId = Number(m[1]); if (!parents.includes(perkParentId)) throw new Refused("That reward isn't yours to pick."); it = (await perksOf(perkParentId)).find((p) => p.id === m[2]); }
    else if (!(deps.paidStoreOpen ?? PAID_STORE_OPEN)) throw new Refused("Rewards come from your parent or teacher now.", 404);
    else it = (await catalog()).find((x) => x.id === itemId);
    if (!it) throw new Refused("That reward isn't in the store any more.", 404);
    const all = await requests(true);
    if (all.some((r) => r.studentId === u.id && r.itemId === itemId && r.status === "waiting")) throw new Refused("You already asked for this one. Your parent will see it.");
    const st = await studentState(u.id, cfg, all);
    const ok = canRedeem({ item: it, balance: st.balance, config: cfg, requests: all, studentId: u.id, month: month(), paidPlan: await deps.paidFamily(u), hasParent: parents.length > 0 });
    if (!ok.ok) {
      const words = { points: "You don't have enough points for that yet.", restocking: "Paid rewards are restocking. They're back next month.", closed: "Paid rewards aren't open yet.", cap: "You've reached this month's limit for paid rewards.", plan: "Paid rewards need an Arise Reader family plan.", parent: "Ask a parent to link to your account first.", hidden: "That reward isn't available." } as const;
      throw new Refused(words[ok.why]);
    }
    const r: RewardRequest = { id: newId(), studentId: u.id, studentName: nameOf(u), itemId, kind: it.kind, title: it.title, points: it.points, costCents: it.costCents, ...(perkParentId ? { perkParentId } : {}), status: "waiting", at: new Date(now()).toISOString() };
    await saveRequests([...all, r]);
    for (const pid of perkParentId ? [perkParentId] : parents) void deps.notify?.(pid, `${nameOf(u)} wants to cash in ${it.points.toLocaleString("en-US")} Reward Points for: ${it.title}. Say yes or no in Arise Reader.`)?.catch(() => {});
    res.json({ ok: true, request: r });
  }));

  app.post("/api/rewards/requests/:id/cancel", auth, wrap(async (req, res) => {
    const u = await me(req);
    let found = false;
    await changeRequests((list) => list.map((r) => { if (r.id !== req.params.id || r.studentId !== u.id || r.status !== "waiting") return r; found = true; return { ...r, status: "canceled", decidedAt: new Date(now()).toISOString() }; }));
    if (!found) throw new Refused("That request can't be taken back now.", 404);
    res.json({ ok: true });
  }));

  // ── A parent says yes or no ──
  app.post("/api/rewards/requests/:id/decide", auth, wrap(async (req, res) => {
    const u = await me(req);
    if (roleOf(u) !== "parent") throw new Refused("Only a parent can say yes or no.", 403);
    const yes = req.body?.yes === true;
    const kids = await deps.parentStudentIds(u.id);
    const all = await requests(true);
    const r = all.find((x) => x.id === req.params.id);
    if (!r || !kids.includes(r.studentId) || r.status !== "waiting") throw new Refused("That request is already answered.", 404);
    if (r.kind === "perk" && r.perkParentId !== u.id) throw new Refused("That one is up to the parent who offered it.", 403);
    const at = new Date(now()).toISOString();
    let next: RewardRequest;
    if (!yes) next = { ...r, status: "declined", parentId: u.id, parentName: nameOf(u), decidedAt: at };
    else {
      if (r.costCents > 0) {
        const email = String(req.body?.email || u.email || "").trim();
        if (!emailOk(email)) throw new Refused("Add the email the reward should go to.");
        // The budget and the student's cap are checked again: other requests may have been answered since.
        const cfg = await config();
        const others = all.filter((x) => x.id !== r.id);
        if (monthSpend(others, monthOf(r.at)) + r.costCents > cfg.budgetCents) throw new Refused("Paid rewards are restocking right now. Try again next month, or say no for now.");
        next = { ...r, status: "approved", parentId: u.id, parentName: nameOf(u), sendTo: email, decidedAt: at };
        const item = (await catalog()).find((x) => x.id === r.itemId);
        if (deps.tremendous && item?.tremendousProduct) {
          try {
            const order = await deps.tremendous({ productId: item.tremendousProduct, cents: r.kind === "money" ? Math.floor(r.costCents / 100) * 100 : r.costCents, name: nameOf(u), email, ref: r.id });
            next = { ...next, status: "sent", sentAt: new Date(now()).toISOString(), note: `Tremendous order ${order}` };
          } catch (e: any) { console.error("[rewards] tremendous:", e?.message); /* waits in the admin queue */ }
        }
      } else next = { ...r, status: "approved", parentId: u.id, parentName: nameOf(u), decidedAt: at };
    }
    await saveRequests(all.map((x) => (x.id === r.id ? next : x)));
    void deps.notify?.(r.studentId, yes ? (r.kind === "perk" ? `Yes! ${r.title} is yours.` : next.status === "sent" ? `Yes! Your ${r.title} was sent to your parent's email.` : `Yes! Your ${r.title} is on its way to your parent's email.`) : `Your parent said not yet for ${r.title}. Your points are back.`)?.catch(() => {});
    res.json({ ok: true, request: next });
  }));

  // ── Marked as given (a parent's perk) or sent (the admin, for a paid reward) ──
  app.post("/api/rewards/requests/:id/sent", auth, wrap(async (req, res) => {
    const u = await me(req);
    const all = await requests(true);
    const r = all.find((x) => x.id === req.params.id);
    if (!r || r.status !== "approved") throw new Refused("That reward isn't waiting to be given.", 404);
    const mayDo = r.kind === "perk" ? r.perkParentId === u.id : isAdmin(u);
    if (!mayDo) throw new Refused("That isn't yours to mark.", 403);
    const next: RewardRequest = { ...r, status: "sent", sentAt: new Date(now()).toISOString(), note: String(req.body?.note || "").slice(0, LIMITS.note) || r.note };
    await saveRequests(all.map((x) => (x.id === r.id ? next : x)));
    if (r.kind !== "perk") void deps.notify?.(r.studentId, `Your ${r.title} was sent to your parent's email.`)?.catch(() => {});
    res.json({ ok: true, request: next });
  }));

  // ── A parent's own rewards ──
  app.put("/api/rewards/perks", auth, wrap(async (req, res) => {
    const u = await me(req);
    if (roleOf(u) !== "parent") throw new Refused("Only a parent can set family rewards.", 403);
    const perks = cleanCatalog(req.body?.perks, true);
    await deps.upsertSetting(KEYS.perks(u.id), JSON.stringify(perks));
    res.json({ ok: true, perks });
  }));

  // ── The admin: budget, limits, catalog ──
  app.put("/api/rewards/admin", auth, wrap(async (req, res) => {
    const u = await me(req);
    if (!isAdmin(u)) throw new Refused("Only the admin can change the store.", 403);
    const prev = await config();
    const cfg = cleanConfig({ ...prev, ...(req.body?.config || {}) });
    if (!cfg.startedOn) cfg.startedOn = prev.startedOn || today();
    await deps.upsertSetting(KEYS.config, JSON.stringify(cfg));
    if (Array.isArray(req.body?.catalog)) await deps.upsertSetting(KEYS.catalog, JSON.stringify(cleanCatalog(req.body.catalog)));
    res.json({ ok: true, config: cfg, catalog: await catalog() });
  }));
}

/** Tremendous (gift cards, PayPal and Venmo), when TREMENDOUS_API_KEY is set. Sandbox keys start with TEST_. */
export function tremendousSender(apiKey: string | undefined, fundingSource = "balance") {
  if (!apiKey) return undefined;
  const base = apiKey.startsWith("TEST_") ? "https://testflight.tremendous.com/api/v2" : "https://www.tremendous.com/api/v2";
  return async (o: { productId: string; cents: number; name: string; email: string; ref: string }): Promise<string> => {
    const res = await fetch(`${base}/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        external_id: o.ref,
        payment: { funding_source_id: fundingSource },
        reward: { value: { denomination: o.cents / 100, currency_code: "USD" }, delivery: { method: "EMAIL" }, recipient: { name: o.name, email: o.email }, products: [o.productId] },
      }),
    });
    const body: any = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.errors?.message || `Tremendous said ${res.status}`);
    return String(body?.order?.id || "sent");
  };
}
