// The To-Do admin: a separate admin screen (client/src/pages/TodoAdmin.tsx) that is not part of the Reader admin.
// Everyone who signed up and who is on which plan, how many people are using the site, what each person paid,
// and the things the admin does about it: switch an account off or on, give a free trial, cancel a plan, refund.
//
// Every route here is for the site admin only. The counting and the labels are in shared/todoAdmin.ts.
import type { Express, RequestHandler } from "express";
import { ACTIVITY_KEY_PREFIX, addDays, dayKey, fetchAll, isDemoUsername, parseActivityDay, type PresenceTracker } from "./adminStats";
import { Refused, type Plans } from "./plans";
import { ONLINE_WINDOW_MS } from "../shared/adminStats";
import { onVipList } from "../shared/plans";
import { isSampleAccount } from "../shared/sampleAccounts";
import {
  PLAN_FILTERS, ROLE_FILTERS, SORTS, ZERO_ROLES, stripeKeyMode, bestInfo, cleanTrialDays, emptyCounts, matchesPlan, matchesQuery, matchesRole, monthlyRecurringCents, pageOf, planView, sortPeople,
  PROGRAMS, bestOf, programOf, programStats, type Program, type ProgramPerson,
  type Counts, type Overview, type Person, type PersonRole, type PlanFilter, type PlanInfo, type PersonSort, type RoleFilter,
} from "../shared/todoAdmin";

type Db = { from: (table: string) => any };
const DAY = 86_400_000;
const WINDOW_DAYS = 35;

type Raw = { id: number; username: string; name: string; email: string; role: PersonRole; createdAt: string; enabled: boolean; confirmed: boolean };
type Loaded = { at: number; users: Raw[]; lastActive: Map<number, number>; days: Map<number, Set<string>> };

const ROLES = new Set(["student", "teacher", "parent", "todo"]);

export function registerTodoAdminRoutes(
  app: Express,
  auth: RequestHandler,
  admin: RequestHandler,
  deps: {
    db: () => Db;
    plans: Plans;
    presence: PresenceTracker;
    /** Switches an account off (archive) or on (restore). Signing out everywhere is part of "off". */
    setArchived: (userId: number, archive: boolean, byUserId: number) => Promise<void>;
    /** Turns an account on without waiting for its email code. */
    confirm: (userId: number) => Promise<void>;
    /** Deletes an account and everything that belongs to it. `blockedBy` names what stopped it. */
    deleteAccount?: (userId: number) => Promise<{ blockedBy?: string }>;
    now?: () => number;
  },
) {
  const now = deps.now ?? Date.now;
  const T = deps.plans.adminTodo;

  // ─── Reading the people ───────────────────────────────────────────────────
  let loaded: Loaded | null = null;
  let loading: Promise<Loaded> | null = null;
  const forgetPeople = () => { loaded = null; };

  async function load(): Promise<Loaded> {
    if (loaded && now() - loaded.at < 30_000) return loaded;
    loading ??= (async () => {
      const db = deps.db();
      const t = now();
      const firstDay = addDays(dayKey(t), -WINDOW_DAYS);
      const [rows, dayRows] = await Promise.all([
        fetchAll<any>((a, b) => db.from("users").select("id, username, display_name, role, is_admin, email, created_at, account_approved, archived_at").order("id").range(a, b)),
        fetchAll<any>((a, b) => db.from("settings").select("key, value").like("key", `${ACTIVITY_KEY_PREFIX}%`).gte("key", ACTIVITY_KEY_PREFIX + firstDay).order("key").range(a, b)),
      ]);
      const users: Raw[] = rows
        .filter((u) => u.is_admin !== true && u.role !== "admin" && ROLES.has(String(u.role || "student")) && !isDemoUsername(u.username) && !isSampleAccount(u))
        .map((u) => ({
          id: Number(u.id), username: String(u.username || ""), name: String(u.display_name || u.username || ""), email: String(u.email || ""),
          role: String(u.role || "student") as PersonRole, createdAt: String(u.created_at || ""), enabled: !u.archived_at, confirmed: u.account_approved !== false,
        }));
      const lastActive = new Map<number, number>();
      const days = new Map<number, Set<string>>();
      const note = (day: string, entries: Record<string, [number, number]>) => {
        for (const [id, [, last]] of Object.entries(entries)) {
          const n = Number(id);
          if (last > (lastActive.get(n) ?? 0)) lastActive.set(n, last);
          (days.get(n) ?? days.set(n, new Set()).get(n)!).add(day);
        }
      };
      for (const row of dayRows) note(String(row.key).slice(ACTIVITY_KEY_PREFIX.length), parseActivityDay(row.value));
      // visits this server has noted but not saved yet
      for (const [day, entries] of Object.entries(deps.presence.unsaved())) note(day, entries as Record<string, [number, number]>);
      return { at: t, users, lastActive, days };
    })().finally(() => { loading = null; });
    loaded = await loading;
    return loaded;
  }

  type PlanBook = { infos: Map<number, PlanInfo[]>; vip: Awaited<ReturnType<typeof T.readVip>> };
  async function planBook(): Promise<PlanBook> {
    const [infos, vip] = await Promise.all([T.planInfos(), T.readVip()]);
    return { infos, vip };
  }

  type Money = { available: boolean; mode: "live" | "test" | "unset"; byUser: Map<number, { cents: number; refunded: number }>; collected: number; refunded: number; todoCollected: number; count: number; truncated: boolean; note: string };
  async function money(book: PlanBook): Promise<Money> {
    const none: Money = { available: false, mode: "unset", byUser: new Map(), collected: 0, refunded: 0, todoCollected: 0, count: 0, truncated: false, note: "Online payment is not set up, so there are no payments to show." };
    try {
      const paid = await T.payments();
      if (!paid) return none;
      const owners = await T.customerOwners();
      const byUser = new Map<number, { cents: number; refunded: number }>();
      let todoCollected = 0;
      const todoCustomers = new Set<string>();
      for (const list of book.infos.values()) for (const i of list) if (i.customerId && i.kind !== "todo_family") todoCustomers.add(i.customerId);
      for (const [customer, p] of paid.byCustomer) {
        const uid = owners.get(customer);
        if (uid) { const cur = byUser.get(uid) || { cents: 0, refunded: 0 }; cur.cents += p.cents; cur.refunded += p.refunded; byUser.set(uid, cur); }
        if (todoCustomers.has(customer)) todoCollected += p.cents - p.refunded;
      }
      return { available: true, mode: paid.mode, byUser, collected: paid.cents, refunded: paid.refunded, todoCollected, count: paid.count, truncated: paid.truncated, note: paid.truncated ? "Totals count the most recent 3,000 payments." : "" };
    } catch (e: any) {
      console.error("[todo-admin] payments:", e?.message);
      return { ...none, note: "Stripe could not be reached just now, so payment amounts are missing. Try again in a moment." };
    }
  }

  function peopleFrom(l: Loaded, book: PlanBook, m: Money): { people: Person[]; infoOf: Map<number, PlanInfo | null> } {
    const infoOf = new Map<number, PlanInfo | null>();
    const people = l.users.map((u): Person => {
      const info = bestInfo(book.infos.get(u.id) || []);
      infoOf.set(u.id, info);
      const vip = onVipList(book.vip, { id: u.id, email: u.email, role: u.role, accountApproved: u.confirmed });
      const paid = m.byUser.get(u.id);
      const last = l.lastActive.get(u.id);
      return {
        id: u.id, name: u.name, username: u.username, email: u.email, role: u.role, createdAt: u.createdAt, enabled: u.enabled, confirmed: u.confirmed,
        lastActiveAt: last ? new Date(last).toISOString() : null, plan: planView(info, vip, now()),
        paidCents: m.available ? paid?.cents ?? 0 : null, refundedCents: m.available ? paid?.refunded ?? 0 : null,
      };
    });
    return { people, infoOf };
  }

  const countsFor = (dates: (string | number)[]): Counts => {
    const t = now();
    const today = dayKey(t), weekStart = addDays(today, -6), monthStart = addDays(today, -29);
    const c = emptyCounts();
    for (const d of dates) {
      const ms = typeof d === "number" ? d : Date.parse(d);
      if (!Number.isFinite(ms)) continue;
      const day = dayKey(ms);
      if (day === today) c.today++;
      if (day >= weekStart && day <= today) c.week++;
      if (day >= monthStart && day <= today) c.month++;
    }
    return c;
  };

  // ─── Errors ───────────────────────────────────────────────────────────────
  const fail = (res: any, e: any, what: string) => {
    if (e instanceof Refused) return res.status(e.status).json({ message: e.message });
    console.error(`[todo-admin] ${what}:`, e?.message || e);
    return res.status(500).json({ message: "That didn't work. Please try again in a moment." });
  };
  const idOf = (req: any): number => {
    const id = Number(req.params?.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new Refused("That person could not be found.", 400);
    return id;
  };
  const target = async (req: any): Promise<Raw> => {
    const id = idOf(req);
    const l = await load();
    const u = l.users.find((x) => x.id === id);
    if (!u) throw new Refused("That person could not be found.", 404);
    return u;
  };

  // ─── Overview: how many people are using the site ─────────────────────────
  app.get("/api/todo-admin/overview", auth, admin, async (_req: any, res: any) => {
    try {
      res.set("Cache-Control", "no-store");
      const [l, book] = await Promise.all([load(), planBook()]);
      const m = await money(book);
      const { people, infoOf } = peopleFrom(l, book, m);

      const byRole = ZERO_ROLES();
      for (const u of l.users) byRole[u.role]++;
      const todoUsers = l.users.filter((u) => u.role === "todo");
      const t = now();
      const today = dayKey(t), weekStart = addDays(today, -6), monthStart = addDays(today, -29);
      const activeIn = (users: Raw[]): Counts => {
        const c = emptyCounts();
        for (const u of users) {
          const set = l.days.get(u.id);
          if (!set) continue;
          if (set.has(today)) c.today++;
          if ([...set].some((d) => d >= weekStart && d <= today)) c.week++;
          if ([...set].some((d) => d >= monthStart && d <= today)) c.month++;
        }
        return c;
      };
      const ids = new Set(l.users.map((u) => u.id));
      let online = 0;
      for (const [id, at] of deps.presence.lastSeen()) if (ids.has(id) && t - at <= ONLINE_WINDOW_MS) online++;

      const tiers = (filter: (p: Person) => boolean) => people.filter(filter).length;
      const todoPeople = people.filter((p) => p.role === "todo");
      const overview: Overview = {
        generatedAt: new Date(t).toISOString(),
        accounts: { total: l.users.length, byRole, off: l.users.filter((u) => !u.enabled).length, unconfirmed: l.users.filter((u) => u.enabled && !u.confirmed).length },
        newAccounts: { all: countsFor(l.users.map((u) => u.createdAt)), todo: countsFor(todoUsers.map((u) => u.createdAt)) },
        active: { now: online, all: activeIn(l.users), todo: activeIn(todoUsers) },
        plans: {
          paid: tiers((p) => p.plan.tier === "paid" || p.plan.tier === "past_due"),
          monthly: people.filter((p) => infoOf.get(p.id)?.kind === "todo_unlimited" && (p.plan.tier === "paid" || p.plan.tier === "past_due")).length,
          yearly: people.filter((p) => infoOf.get(p.id)?.kind === "todo_unlimited_year" && (p.plan.tier === "paid" || p.plan.tier === "past_due")).length,
          trials: tiers((p) => p.plan.tier === "trial"), gifts: tiers((p) => p.plan.tier === "gift"), vip: tiers((p) => p.plan.tier === "vip"),
          pastDue: tiers((p) => p.plan.tier === "past_due"), canceling: tiers((p) => p.plan.canceling),
          todoFree: todoPeople.filter((p) => !p.plan.unlimited).length, todoTotal: todoPeople.length,
        },
        money: {
          available: m.available, mode: m.mode, collectedCents: m.collected, refundedCents: m.refunded, todoCollectedCents: m.todoCollected,
          monthlyRecurringCents: monthlyRecurringCents(people, (p) => infoOf.get((p as Person).id) ?? null), payments: m.count, truncated: m.truncated, note: m.note,
        },
      };
      res.json(overview);
    } catch (e) { fail(res, e, "overview"); }
  });

  // ─── The list ─────────────────────────────────────────────────────────────
  app.get("/api/todo-admin/people", auth, admin, async (req: any, res: any) => {
    try {
      res.set("Cache-Control", "no-store");
      const role: RoleFilter = (ROLE_FILTERS as readonly string[]).includes(String(req.query?.role)) ? (req.query.role as RoleFilter) : "todo";
      const plan: PlanFilter = (PLAN_FILTERS as readonly string[]).includes(String(req.query?.plan)) ? (req.query.plan as PlanFilter) : "all";
      const sort: PersonSort = (SORTS as readonly string[]).includes(String(req.query?.sort)) ? (req.query.sort as PersonSort) : "newest";
      const q = String(req.query?.q ?? "").slice(0, 80);
      const [l, book] = await Promise.all([load(), planBook()]);
      const m = await money(book);
      const { people } = peopleFrom(l, book, m);
      const inRole = people.filter((p) => matchesRole(p, role));
      const rows = sortPeople(inRole.filter((p) => matchesPlan(p, plan) && matchesQuery(p, q)), sort);
      const counts = Object.fromEntries(PLAN_FILTERS.map((f) => [f, inRole.filter((p) => matchesPlan(p, f)).length]));
      res.json({ ...pageOf(rows, Number(req.query?.page), Number(req.query?.size)), counts, moneyAvailable: m.available });
    } catch (e) { fail(res, e, "people"); }
  });

  // ─── One person ───────────────────────────────────────────────────────────
  app.get("/api/todo-admin/people/:id", auth, admin, async (req: any, res: any) => {
    try {
      res.set("Cache-Control", "no-store");
      const u = await target(req);
      const [l, book] = await Promise.all([load(), planBook()]);
      const m = await money(book);
      const { people, infoOf } = peopleFrom({ ...l, users: [u] }, book, m);
      const person = people[0];
      const info = infoOf.get(u.id) ?? null;
      let payments: { id: string; at: string; cents: number; refundedCents: number; description: string }[] = [];
      let paymentsNote = "";
      const customer = await T.personCustomer(u.id).catch(() => "");
      if (customer) {
        try { payments = await T.personPayments(customer); } catch (e: any) { paymentsNote = e instanceof Refused ? e.message : "Their payments could not be loaded."; }
      }
      const days = [...(l.days.get(u.id) ?? [])].sort().reverse();
      res.json({
        person, payments, paymentsNote, hasCustomer: !!customer, mode: stripeKeyMode(await T.stripeKey()),
        plan: info && { kind: info.kind, source: info.source, status: info.status, live: info.live, endsAt: info.endsAt, trial: info.trial, cancelAtPeriodEnd: info.cancelAtPeriodEnd, note: info.note || "", paidOnline: info.source === "stripe", canCancel: info.source === "stripe" && info.live && info.status !== "canceled" && !!info.subscriptionId },
        usedOn: { days: days.length, last: days.slice(0, 10) },
        vip: person.plan.tier === "vip",
      });
    } catch (e) { fail(res, e, "person"); }
  });

  // ─── Programs: each app's memberships on their own ────────────────────────
  const programViews = async (prog: Program) => {
    const [l, infos] = await Promise.all([load(), T.programInfos(prog.kinds)]);
    return l.users.map((u) => { const info = bestOf(infos.get(u.id) || []); return { u, info, plan: planView(info, false, now(), prog.id === "todo" ? undefined : prog.membership), last: l.lastActive.get(u.id) }; });
  };
  const askedProgram = (v: unknown): Program => { const p = programOf(v); if (!p) throw new Refused("Choose a program.", 400); return p; };
  app.get("/api/todo-admin/programs", auth, admin, async (_req: any, res: any) => {
    try {
      res.set("Cache-Control", "no-store");
      const out = [];
      for (const prog of PROGRAMS) out.push(programStats(prog, await programViews(prog)));
      res.json({ programs: out, accounts: (await load()).users.length });
    } catch (e) { fail(res, e, "programs"); }
  });
  /** One program's people: its members by default, or anyone found by name, username or email. */
  app.get("/api/todo-admin/programs/:program/people", auth, admin, async (req: any, res: any) => {
    try {
      res.set("Cache-Control", "no-store");
      const prog = askedProgram(req.params?.program);
      const q = String(req.query?.q ?? "").slice(0, 80).trim();
      const views = await programViews(prog);
      const rows = views
        .filter((v) => (q ? matchesQuery({ name: v.u.name, username: v.u.username, email: v.u.email } as Person, q) : !!v.info))
        .map((v): ProgramPerson => ({ id: v.u.id, name: v.u.name, username: v.u.username, email: v.u.email, role: v.u.role, createdAt: v.u.createdAt, enabled: v.u.enabled,
          lastActiveAt: v.last ? new Date(v.last).toISOString() : null, plan: v.plan, given: !!v.info && v.info.source === "admin" && v.info.live }))
        .sort((a, b) => Number(b.plan.tier !== "free" && b.plan.tier !== "ended") - Number(a.plan.tier !== "free" && a.plan.tier !== "ended") || a.name.localeCompare(b.name));
      res.json({ ...pageOf(rows, Number(req.query?.page), 50), searching: !!q });
    } catch (e) { fail(res, e, "program people"); }
  });

  // ─── Actions ──────────────────────────────────────────────────────────────
  const done = (res: any, extra: Record<string, unknown> = {}) => { forgetPeople(); res.json({ ok: true, ...extra }); };

  app.post("/api/todo-admin/people/:id/active", auth, admin, async (req: any, res: any) => {
    try {
      const u = await target(req);
      if (typeof req.body?.active !== "boolean") throw new Refused("Choose on or off.");
      if (u.id === Number(req.user?.id)) throw new Refused("You can't switch off your own account.");
      await deps.setArchived(u.id, !req.body.active, Number(req.user?.id));
      done(res, { enabled: req.body.active });
    } catch (e) { fail(res, e, "on/off"); }
  });

  app.post("/api/todo-admin/people/:id/trial", auth, admin, async (req: any, res: any) => {
    try {
      const u = await target(req);
      if (u.role === "student") throw new Refused("Unlimited is for adult accounts. Students can't be given a trial here.");
      const days = cleanTrialDays(req.body?.days);
      if (days === null) throw new Refused("Choose how long the trial lasts.");
      await T.giveTrial(u.id, days, String(req.body?.note ?? ""));
      done(res);
    } catch (e) { fail(res, e, "trial"); }
  });

  app.post("/api/todo-admin/people/:id/program", auth, admin, async (req: any, res: any) => {
    try {
      const u = await target(req);
      const prog = askedProgram(req.body?.program);
      if (!prog.give) throw new Refused(`${prog.name} memberships are managed in the Reader admin, under Schools & plans.`);
      if (u.role === "student") throw new Refused("Memberships are for adult accounts. Students can't be given one here.");
      const days = cleanTrialDays(req.body?.days);
      if (days === null) throw new Refused("Choose how long the membership lasts.");
      await T.giveProgram(u.id, prog.kinds, prog.give, days, String(req.body?.note ?? ""));
      done(res);
    } catch (e) { fail(res, e, "give membership"); }
  });
  app.post("/api/todo-admin/people/:id/program/end", auth, admin, async (req: any, res: any) => {
    try {
      const u = await target(req);
      const prog = askedProgram(req.body?.program);
      if (!prog.give) throw new Refused("There is no free membership to end here.");
      await T.endProgram(u.id, prog.give);
      done(res);
    } catch (e) { fail(res, e, "end membership"); }
  });
  /** Deletes an account for good. The admin types the person's username to confirm. */
  app.delete("/api/todo-admin/people/:id", auth, admin, async (req: any, res: any) => {
    try {
      const u = await target(req);
      if (u.id === Number(req.user?.id)) throw new Refused("You can't delete your own account.");
      if (!deps.deleteAccount) throw new Refused("Deleting accounts is not set up on this server.", 503);
      if (String(req.body?.confirm ?? "").trim().toLowerCase() !== u.username.toLowerCase()) throw new Refused("Type their username exactly to delete the account.");
      const { blockedBy } = await deps.deleteAccount(u.id);
      if (blockedBy) throw new Refused(`This account still has ${blockedBy.replace(/_/g, " ")} linked to it, so it can't be deleted yet. Switch it off instead.`, 409);
      done(res);
    } catch (e) { fail(res, e, "delete"); }
  });

  app.post("/api/todo-admin/people/:id/trial/end", auth, admin, async (req: any, res: any) => {
    try { const u = await target(req); await T.endTrial(u.id); done(res); } catch (e) { fail(res, e, "end trial"); }
  });

  app.post("/api/todo-admin/people/:id/cancel", auth, admin, async (req: any, res: any) => {
    try {
      const u = await target(req);
      const when = req.body?.when === "now" ? "now" : req.body?.when === "period_end" ? "period_end" : null;
      if (!when) throw new Refused("Choose when the plan ends.");
      await T.cancelPaid(u.id, when);
      done(res);
    } catch (e) { fail(res, e, "cancel"); }
  });

  app.post("/api/todo-admin/people/:id/vip", auth, admin, async (req: any, res: any) => {
    try {
      const u = await target(req);
      if (typeof req.body?.on !== "boolean") throw new Refused("Choose on or off.");
      if (req.body.on && u.role === "student") throw new Refused("Unlimited is for adult accounts.");
      await T.vipSet({ id: u.id, email: u.email }, req.body.on);
      done(res);
    } catch (e) { fail(res, e, "vip"); }
  });

  app.post("/api/todo-admin/people/:id/confirm", auth, admin, async (req: any, res: any) => {
    try {
      const u = await target(req);
      if (u.confirmed) throw new Refused("Their account is already confirmed.", 409);
      await deps.confirm(u.id);
      done(res);
    } catch (e) { fail(res, e, "confirm"); }
  });

  app.post("/api/todo-admin/people/:id/keep", auth, admin, async (req: any, res: any) => {
    try { const u = await target(req); await T.keepPlan(u.id); done(res); } catch (e) { fail(res, e, "keep plan"); }
  });

  app.post("/api/todo-admin/people/:id/refund", auth, admin, async (req: any, res: any) => {
    try { const u = await target(req); const r = await T.refundLast(u.id); done(res, { refundedCents: r.cents }); } catch (e) { fail(res, e, "refund"); }
  });
}
