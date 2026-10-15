// Plans, prices and who gets Premium.
//
// Free is for students and their parents. Premium is for teachers and
// schools, and their students get the Premium extras through them.
// Arise WorkHub is a separate add-on for teachers and schools, sold at the same
// prices as Premium, and is unconditionally free for every teacher and parent
// (see hubAccessFor) — not a trial, just free. It is not part of the free year
// or a free school.
// The teacher Class plan (PLANS.teacher) is a single combined price: $10/month
// per 30 students includes A.R.I.S.E. Reader, Math, History AND Connect — there
// is no longer a separate per-app class add-on for teachers (classApps/
// classAppCents is kept only for the parent family bundle's pricing and old
// records; appAccessFor grants every app to a teacher with Premium).
// No part of the site has a free trial: Premium and the storage tiers need a
// plan (or grandfathering, or admin/demo) from the first day.
// This file is the single place the numbers live: the pricing page, the
// server's plan checks and billing all read them from here.

import { UNLIMITED_MONTHLY_CENTS, UNLIMITED_YEARLY_CENTS } from "./todoPlan";

export const PLANS = {
  teacher: {
    /** $10 a month covers one block of students. */
    monthlyCents: 1000,
    studentsPerBlock: 30,
    /** The most blocks one teacher can buy online (5,000 students). */
    maxBlocks: 50,
  },
  school: {
    /** $700 for a full 12 months, summer included. */
    yearlyCents: 70000,
    studentCap: 1000,
  },
  /** Arise WorkHub, the add-on: the same prices as Premium, counted against the students in the teacher's Hub caseload. */
  hub: {
    monthlyCents: 1000,
    studentsPerBlock: 100,
    maxBlocks: 50,
    schoolYearlyCents: 70000,
    schoolStudentCap: 1000,
  },
  /**
   * Arise Social (/social/), the career-discovery add-on: $5 a month for each account that uses it.
   * Students, parents and teachers each need their own; a parent can pay for a linked child.
   * Like Arise WorkHub it is always paid: plan rules, the free year and free schools don't apply.
   */
  social: {
    monthlyCents: 500,
  },
  /**
   * The Learning Bundle: Arise History, Arise Math and Arise Social together, for a family:
   * $10 a month covers the parent and every linked child.
   * (teacherMonthlyCents is the old all-three class plan, kept so plans bought before
   * the apps were sold one by one keep working. It is no longer sold.)
   */
  bundle: {
    familyMonthlyCents: 1000,
    teacherMonthlyCents: 5000,
    teacherSeats: 100,
  },
  /**
   * Historical per-app class pricing. Teachers no longer buy these separately — the Class
   * plan (PLANS.teacher) now includes Math, History and Connect for every student it covers.
   * The numbers are kept only so a family's Learning Bundle refund math (see
   * childrenCoveredByClass) and any pre-existing per-app grant still read correctly.
   */
  classApps: {
    mathCents: 1200,
    historyCents: 1200,
    socialCents: 700,
    seats: 100,
  },
  /** Arise LifeHub for parents: $10 a month. Teachers get it with Arise WorkHub. */
  todo: {
    familyMonthlyCents: 1000,
  },
  /**
   * Arise AI Pro: the premium AI assistant add-on, $10 a month per hub, billed on its own like
   * Arise Social. See shared/aiProApp.ts for its monthly usage cap and the margin math behind it.
   */
  aiPro: {
    monthlyCents: 1000,
  },
  /**
   * Arise Drive storage tiers: extra cloud storage for the Drive app, on top of the free 500MB
   * (shared/driveApp.ts). Priced against real Supabase Storage cost (~$0.021/GB-month, plus a
   * conservative egress estimate for a personal photo drive) to keep a healthy margin at every
   * tier: roughly 80% / 62% / 40% gross margin as the tiers get bigger and cost scales up.
   */
  storage: {
    tiers: [
      { id: "storage_20gb", gb: 20, monthlyCents: 299 },
      { id: "storage_100gb", gb: 100, monthlyCents: 799 },
      { id: "storage_500gb", gb: 500, monthlyCents: 2499 },
    ],
  },
  /** One parent profile can follow this many children on the Free plan. */
  parentMaxChildren: 3,
  /**
   * Teachers and school students who signed up before this moment keep
   * everything free until `grandfatherUntil`. Midnight on October 1, 2026,
   * Mountain time, the time zone the site already uses for class hours.
   */
  grandfatherBefore: "2026-10-01T06:00:00.000Z",
  /** The end of the 2026-27 school year: midnight on July 1, 2027, Mountain time. */
  grandfatherUntil: "2027-07-01T06:00:00.000Z",
  /** A paid plan stays on this long past its end date, so a late renewal notice never locks a class out. */
  graceDays: 3,
} as const;

export const usd = (cents: number) => (cents % 100 === 0 ? `$${(cents / 100).toLocaleString("en-US")}` : `$${(cents / 100).toFixed(2)}`);

/** How many 100-student blocks a teacher with this many students needs. Always at least one. */
export function blocksFor(students: number): number {
  const n = Math.ceil(Math.max(0, Math.floor(Number(students) || 0)) / PLANS.teacher.studentsPerBlock);
  return Math.min(PLANS.teacher.maxBlocks, Math.max(1, n));
}
export const seatsFor = (blocks: number) => clampBlocks(blocks) * PLANS.teacher.studentsPerBlock;
export const teacherMonthlyCents = (blocks: number) => clampBlocks(blocks) * PLANS.teacher.monthlyCents;
export function clampBlocks(blocks: unknown): number {
  const n = Math.floor(Number(blocks));
  return Number.isFinite(n) ? Math.min(PLANS.teacher.maxBlocks, Math.max(1, n)) : 1;
}

/**
 * What a plan is for. "teacher" and "school" are A.R.I.S.E. Premium;
 * "hub_teacher" and "hub_school" are the Arise WorkHub add-on.
 */
export type PlanKind = "teacher" | "school" | "hub_teacher" | "hub_school" | "social" | "bundle_family" | "bundle_teacher" | "todo_family" | "math_class" | "history_class" | "social_class" | "ai_pro" | "storage_20gb" | "storage_100gb" | "storage_500gb" | "todo_unlimited" | "todo_unlimited_year";
export const PLAN_KINDS: readonly PlanKind[] = ["school", "teacher", "hub_school", "hub_teacher", "social", "bundle_family", "bundle_teacher", "todo_family", "math_class", "history_class", "social_class", "ai_pro", "storage_20gb", "storage_100gb", "storage_500gb", "todo_unlimited", "todo_unlimited_year"];
/** The three paid Drive storage tiers, by plan kind. */
export const STORAGE_PLAN_KINDS: readonly PlanKind[] = ["storage_20gb", "storage_100gb", "storage_500gb"];
export const isStoragePlanKind = (kind: PlanKind): boolean => (STORAGE_PLAN_KINDS as readonly string[]).includes(kind);
/** This storage plan's size, in GB. */
export function storageTierGb(kind: PlanKind): number {
  const tier = PLANS.storage.tiers.find((t) => t.id === kind);
  return tier?.gb ?? 0;
}
/** The three apps in the Learning Bundle. */
export type AppId = "math" | "history" | "social";
export const APP_IDS: readonly AppId[] = ["math", "history", "social"];
export const APP_NAMES: Record<AppId, string> = { math: "Arise Math", history: "Arise History", social: "A.R.I.S.E. Connect" };
export const isAppId = (v: unknown): v is AppId => v === "math" || v === "history" || v === "social";
/** The class add-on for one app. */
export const classKindOf = (app: AppId): PlanKind => `${app}_class` as PlanKind;
export const appOfClassKind = (kind: PlanKind): AppId | null => (kind === "math_class" ? "math" : kind === "history_class" ? "history" : kind === "social_class" ? "social" : null);
export const isClassAppKind = (kind: PlanKind) => appOfClassKind(kind) !== null;
export const classAppCents = (app: AppId) => (app === "math" ? PLANS.classApps.mathCents : app === "history" ? PLANS.classApps.historyCents : PLANS.classApps.socialCents);
/** Plans bought for one person (or one family, or one teacher's class), not sized in blocks of students. */
export const isAddonKind = (kind: PlanKind) => kind === "social" || kind === "bundle_family" || kind === "bundle_teacher" || kind === "todo_family" || kind === "todo_unlimited" || kind === "todo_unlimited_year" || kind === "ai_pro" || isStoragePlanKind(kind) || isClassAppKind(kind);
export const isPlanKind = (v: unknown): v is PlanKind => typeof v === "string" && (PLAN_KINDS as readonly string[]).includes(v);
export const isSchoolKind = (kind: PlanKind) => kind === "school" || kind === "hub_school";
export const isHubKind = (kind: PlanKind) => kind === "hub_teacher" || kind === "hub_school";
/** The school plan that covers the same product as this plan. */
export const schoolKindOf = (kind: PlanKind): PlanKind => (isHubKind(kind) ? "hub_school" : "school");
export const teacherKindOf = (kind: PlanKind): PlanKind => (isHubKind(kind) ? "hub_teacher" : "teacher");
/** Price and size of a plan, by kind. */
export function priceOf(kind: PlanKind): { cents: number; interval: "month" | "year"; seats: (blocks: number) => number } {
  if (kind === "school") return { cents: PLANS.school.yearlyCents, interval: "year", seats: () => PLANS.school.studentCap };
  if (kind === "hub_school") return { cents: PLANS.hub.schoolYearlyCents, interval: "year", seats: () => PLANS.hub.schoolStudentCap };
  if (kind === "social") return { cents: PLANS.social.monthlyCents, interval: "month", seats: () => 1 };
  if (kind === "bundle_family") return { cents: PLANS.bundle.familyMonthlyCents, interval: "month", seats: () => 1 };
  if (kind === "bundle_teacher") return { cents: PLANS.bundle.teacherMonthlyCents, interval: "month", seats: () => PLANS.bundle.teacherSeats };
  if (kind === "todo_family") return { cents: PLANS.todo.familyMonthlyCents, interval: "month", seats: () => 1 };
  if (kind === "ai_pro") return { cents: PLANS.aiPro.monthlyCents, interval: "month", seats: () => 1 };
  if (kind === "todo_unlimited") return { cents: UNLIMITED_MONTHLY_CENTS, interval: "month", seats: () => 1 };
  if (kind === "todo_unlimited_year") return { cents: UNLIMITED_YEARLY_CENTS, interval: "year", seats: () => 1 };
  if (isStoragePlanKind(kind)) { const tier = PLANS.storage.tiers.find((t) => t.id === kind)!; return { cents: tier.monthlyCents, interval: "month", seats: () => 1 }; }
  const app = appOfClassKind(kind);
  if (app) return { cents: classAppCents(app), interval: "month", seats: () => PLANS.classApps.seats };
  const t = kind === "hub_teacher" ? PLANS.hub : PLANS.teacher;
  return { cents: t.monthlyCents, interval: "month", seats: (blocks) => clampBlocks(blocks) * t.studentsPerBlock };
}

/** A Premium plan held by one teacher or one school. */
export type PlanGrant = {
  kind: PlanKind;
  /** The teacher's user id, or the school's id. */
  ownerId: number;
  /** Paid online, or switched on by the site admin. */
  source: "stripe" | "admin";
  status: "active" | "past_due" | "canceled";
  /** How many students it covers. */
  seats: number;
  /** When it runs out (ISO). null means it has no end date. */
  endsAt: string | null;
  /** When this record last changed (ISO). For paid plans, the time of the Stripe event applied. */
  updatedAt: string;
  /** The teacher who paid. */
  buyerId?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeItemId?: string;
  note?: string;
  /** A school that is always Premium at no charge: no student limit, no end date, nothing to pay. */
  free?: boolean;
  /** A free trial or gift the admin gave: it ends on `endsAt` exactly, with no extra days of grace. */
  trial?: boolean;
  /** Paid online, and set to stop at the end of the period already paid for. */
  cancelAtPeriodEnd?: boolean;
};

/** Is this plan in force right now? */
export function grantLive(grant: PlanGrant | null | undefined, now = Date.now()): boolean {
  if (!grant || grant.status === "canceled") return false;
  if (!grant.endsAt) return true;
  const end = Date.parse(grant.endsAt);
  if (!Number.isFinite(end)) return false;
  if (grant.trial) return now < end;
  return now < end + PLANS.graceDays * 86_400_000;
}

/** A sign-up date as a time. NaN when there is none on record, or it can't be read. */
function signedUpAt(createdAt: unknown): number {
  if (createdAt === null || createdAt === undefined || createdAt === "") return NaN;
  return createdAt instanceof Date ? createdAt.getTime() : typeof createdAt === "number" ? createdAt : Date.parse(String(createdAt));
}

/**
 * Signed up before the cutoff, and the free year has not run out.
 * An account with no sign-up date on record is an old one, so it counts.
 */
export function grandfathered(createdAt: unknown, now = Date.now()): boolean {
  if (now >= Date.parse(PLANS.grandfatherUntil)) return false;
  const t = signedUpAt(createdAt);
  if (!Number.isFinite(t)) return true;
  return t < Date.parse(PLANS.grandfatherBefore);
}

/**
 * The sample accounts behind "Try a sample" on the front page. They always see
 * everything. Exact names only: a prefix match would hand Premium to anyone who
 * picked a username like "samplesmith".
 */
const DEMO_ACCOUNTS = new Set(["sample", "sample-parent", "tutorial-eye"]);
export function isDemoAccount(username: unknown): boolean {
  return DEMO_ACCOUNTS.has(String(username || "").toLowerCase());
}

/**
 * Schools that are always Premium and never charged: every teacher there, now
 * or later, and the students in their classes. CGMS is the school A.R.I.S.E.
 * started at. The admin can add or remove schools in Admin, under Plans and billing.
 */
export const FREE_SCHOOL_CODES = ["CGMS"] as const;

/**
 * Is this the name of an always-free school? A school is found by its short
 * name ("CGMS", "CGMS Tigers") or by the first letters of its full name
 * ("C… G… Middle School", with or without the word "School").
 */
export function isFreeSchoolName(name: unknown): boolean {
  // a town on the end ("(Denver, CO)") is not part of the school's name
  const bare = String(name || "").replace(/\s*\([^()]*\)\s*$/, "");
  const words = bare.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return false;
  const initials = words.map((w) => w[0]).join("");
  return FREE_SCHOOL_CODES.some((code) =>
    words.includes(code)
    || initials === code
    || (code.endsWith("MS") && initials === code.slice(0, -1) && words[words.length - 1] === "MIDDLE"));
}

export type PlanPerson = {
  id: number;
  role?: string | null;
  isAdmin?: boolean;
  username?: string | null;
  createdAt?: unknown;
  teacherId?: number | null;
  schoolId?: number | null;
  /** Teachers and parents: approved by the admin. */
  accountApproved?: boolean;
  /** Students: approved by the teacher they chose. */
  approvedByTeacher?: boolean;
};

export type PlanVia =
  | "rules-off"      // the admin has not turned plan rules on: nothing is locked
  | "admin"
  | "demo"
  | "teacher-plan"   // this teacher's own plan
  | "school-plan"    // a teacher whose school has a plan
  | "class"          // a student whose teacher has Premium
  | "grandfathered"; // signed up before October 1, 2026

export type Entitlement = {
  premium: boolean;
  via: PlanVia | null;
  /** Students the plan covers, when a paid plan is the reason. */
  seats: number | null;
  /** When Premium ends, if it does (ISO). */
  endsAt: string | null;
};

export type PlanFacts = {
  /** Has the admin turned plan rules on? */
  enforced: boolean;
  now?: number;
  /** For a teacher: their own plan. */
  teacherGrant?: PlanGrant | null;
  /** For a teacher: their school's plan. */
  schoolGrant?: PlanGrant | null;
  /** For a student: their teacher, and what that teacher has. */
  classTeacher?: PlanPerson | null;
  classTeacherGrant?: PlanGrant | null;
  classTeacherSchoolGrant?: PlanGrant | null;
};

const NONE: Entitlement = { premium: false, via: null, seats: null, endsAt: null };
const yes = (via: PlanVia, grant?: PlanGrant | null, endsAt?: string | null): Entitlement => ({
  premium: true, via, seats: grant && !grant.free ? grant.seats : null, endsAt: grant ? grant.endsAt : endsAt ?? null,
});

function teacherEntitlement(teacher: PlanPerson, own: PlanGrant | null | undefined, school: PlanGrant | null | undefined, now: number): Entitlement {
  if (grantLive(own, now)) return yes("teacher-plan", own);
  if (grantLive(school, now)) return yes("school-plan", school);
  if (grandfathered(teacher.createdAt, now)) return yes("grandfathered", null, PLANS.grandfatherUntil);
  return NONE;
}

/** Does this person have Premium, and why? */
export function entitlementFor(person: PlanPerson | null | undefined, facts: PlanFacts): Entitlement {
  if (!person) return NONE;
  const now = facts.now ?? Date.now();
  if (!facts.enforced) return yes("rules-off");
  if (person.isAdmin || person.role === "admin") return yes("admin");
  if (isDemoAccount(person.username)) return yes("demo");

  if (person.role === "teacher") return teacherEntitlement(person, facts.teacherGrant, facts.schoolGrant, now);

  if (person.role === "parent") return NONE;

  // A student gets the Premium extras through the teacher who approved them into
  // a class: that teacher's plan, or the plan of that teacher's school. Picking a
  // school or a teacher at sign-up is not enough on its own, or anyone could
  // claim a paying school.
  const teacher = facts.classTeacher;
  if (teacher && teacher.accountApproved !== false && person.approvedByTeacher !== false) {
    const t = teacherEntitlement(teacher, facts.classTeacherGrant, facts.classTeacherSchoolGrant, now);
    if (t.premium) return { premium: true, via: "class", seats: null, endsAt: t.endsAt };
  }
  // A school student who signed up before the cutoff keeps what they had.
  const atSchool = !!(person.teacherId || person.schoolId);
  if (atSchool && grandfathered(person.createdAt, now)) return yes("grandfathered", null, PLANS.grandfatherUntil);
  return NONE;
}

/** Can a parent with this many children already linked add one more? */
export function parentCanLink(linkedCount: number, opts: { enforced: boolean; premiumFamily?: boolean }): boolean {
  // The free family limit is a safety and plan limit, independent of rollout flags.
  return linkedCount < PLANS.parentMaxChildren;
}

// ─── Arise WorkHub ─────────────────────────────────────────────────────────────

export type HubVia = "admin" | "free" | "hub-teacher-plan" | "hub-school-plan";
export type HubAccess = { access: boolean; via: HubVia | null; seats: number | null; endsAt: string | null };

/**
 * Can this person open Arise WorkHub? Always, for a teacher or parent, or as the site
 * admin — WorkHub itself is permanently free. (A.R.I.S.E. Premium, the Reader/Math/
 * History content for a teacher's class, is the separate thing that is paid and has
 * no free trial — see entitlementFor.) Unlike Premium this does not depend on plan
 * rules being on, and there is no free year, free school or sample account.
 */
export function hubAccessFor(person: PlanPerson | null | undefined, _facts: { now?: number; teacherGrant?: PlanGrant | null; schoolGrant?: PlanGrant | null }): HubAccess {
  if (!person) return { access: false, via: null, seats: null, endsAt: null };
  if (person.isAdmin || person.role === "admin") return { access: true, via: "admin", seats: null, endsAt: null };
  // Both hubs are for anyone with an adult account: teachers, parents and personal A.R.I.S.E. To-Do accounts.
  if (person.role === "teacher" || person.role === "parent" || person.role === "todo") return { access: true, via: "free", seats: null, endsAt: null };
  return { access: false, via: null, seats: null, endsAt: null };
}

// ─── Arise Social ────────────────────────────────────────────────────────────

/**
 * Can this person use Arise Social? Only with an Arise Social plan of their own
 * (bought by them, or for a child by a parent), as the site admin, or as a sample
 * account. It does not depend on plan rules being on.
 */
export function socialAccessFor(person: PlanPerson | null | undefined, grant: PlanGrant | null | undefined, now = Date.now()): boolean {
  if (!person) return false;
  if (person.isAdmin || person.role === "admin" || isDemoAccount(person.username)) return true;
  return !!grant && grant.kind === "social" && grantLive(grant, now);
}
export const SOCIAL_REQUIRED = "social_required";

// ─── Arise AI Pro ────────────────────────────────────────────────────────────

/**
 * Can this person use Arise AI Pro, the premium metered AI assistant? Only with an AI Pro plan of
 * their own, or as the site admin. It does not depend on plan rules being on, same as Social.
 */
export function aiProAccessFor(person: PlanPerson | null | undefined, grant: PlanGrant | null | undefined, now = Date.now()): boolean {
  if (!person) return false;
  if (person.isAdmin || person.role === "admin" || isDemoAccount(person.username)) return true;
  return !!grant && grant.kind === "ai_pro" && grantLive(grant, now);
}
export const AI_PRO_REQUIRED = "ai_pro_required";

// ─── Learning Bundle and LifeHub ───────────────────────────────────────────────

export type AddonVia =
  | "admin" | "demo"
  | "family-plan"      // a parent's Learning Bundle (the parent, or a child of theirs)
  | "class-plan"       // a teacher's class add-on for this app (the teacher, or a student in the class)
  | "social-plan"      // an Arise Social plan bought before the Learning Bundle existed
  | "child-in-class"   // a parent whose every linked child is covered by a class plan
  | "hub"              // LifeHub for a teacher, through Arise WorkHub
  | "todo-plan"        // historical paid LifeHub account
  | "free";            // free adult hub access
export type AddonAccess = { access: boolean; via: AddonVia | null; endsAt: string | null };

export type BundleFacts = {
  now?: number;
  /** Parents: their family's Learning Bundle. Teachers: their class add-on for this app (or the old all-three class plan). */
  ownGrant?: PlanGrant | null;
  /** An old Arise Social plan of the person's own. */
  socialGrant?: PlanGrant | null;
  /** Students: the family plans of their linked parents. */
  parentGrants?: (PlanGrant | null)[];
  /** Students: their teacher's class add-on for this app, if the teacher approved them into the class. */
  classGrant?: PlanGrant | null;
  /** Parents: do class add-ons for this app cover every one of their linked children (at least one)? */
  allChildrenInClassPlans?: boolean;
  /** A teacher Class plan includes Math, History and Connect for approved students. */
  classPremium?: boolean;
};

/** Is this grant a class add-on covering this app: the app's own, or the old all-three class plan? */
export function classGrantCovers(g: PlanGrant | null | undefined, app: AppId, now = Date.now()): boolean {
  return !!g && (g.kind === classKindOf(app) || g.kind === "bundle_teacher") && grantLive(g, now);
}

/**
 * Can this person use one of the apps (Arise Math, Arise History or A.R.I.S.E. Connect)?
 * A teacher's Class plan now includes all three for every student it covers — there is no
 * per-app class add-on to buy anymore. A family's Learning Bundle still covers all three
 * for a parent and their linked children.
 */
export function appAccessFor(person: PlanPerson | null | undefined, app: AppId, facts: BundleFacts): AddonAccess {
  const none: AddonAccess = { access: false, via: null, endsAt: null };
  if (!person) return none;
  if (person.isAdmin || person.role === "admin") return { ...none, access: true, via: "admin" };
  if (isDemoAccount(person.username)) return { ...none, access: true, via: "demo" };
  const now = facts.now ?? Date.now();
  const live = (g: PlanGrant | null | undefined, kind: PlanKind) => !!g && g.kind === kind && grantLive(g, now);
  const yes = (via: AddonVia, g?: PlanGrant | null): AddonAccess => ({ access: true, via, endsAt: g?.endsAt ?? null });
  if (facts.classPremium && (person.role === "teacher" || person.role === "student")) return yes("class-plan");
  if (person.role === "teacher" && classGrantCovers(facts.ownGrant, app, now)) return yes("class-plan", facts.ownGrant);
  if (person.role === "parent" && live(facts.ownGrant, "bundle_family")) return yes("family-plan", facts.ownGrant);
  if (person.role !== "teacher" && person.role !== "parent") {
    const fam = (facts.parentGrants || []).find((g) => live(g, "bundle_family"));
    if (fam) return yes("family-plan", fam);
    if (classGrantCovers(facts.classGrant, app, now)) return yes("class-plan", facts.classGrant);
  }
  if (person.role === "parent" && facts.allChildrenInClassPlans) return yes("child-in-class");
  if (app === "social" && live(facts.socialGrant, "social")) return yes("social-plan", facts.socialGrant);
  return none;
}

/** Can this person use Arise LifeHub? Always, for any signed-in adult — it's permanently free. */
export function todoAccessFor(person: PlanPerson | null | undefined, _facts: { now?: number; todoGrant?: PlanGrant | null; hub?: HubAccess | null }): AddonAccess {
  const none: AddonAccess = { access: false, via: null, endsAt: null };
  if (!person) return none;
  return { ...none, access: true, via: person.isAdmin || person.role === "admin" ? "admin" : "free" };
}

/**
 * Is this person on A.R.I.S.E. To-Do Unlimited ($5 a month or $50 a year: every App Store app, and AI to the fair-use ceiling)?
 * Admins and sample accounts always are; anyone else needs a live Unlimited plan, or a LifeHub
 * plan bought before Unlimited existed.
 */
export function todoUnlimitedFor(person: PlanPerson | null | undefined, grants: { unlimited?: PlanGrant | null; yearly?: PlanGrant | null; oldLifeHub?: PlanGrant | null; vip?: boolean }, now = Date.now()): { unlimited: boolean; via: "admin" | "demo" | "vip" | "plan" | "old-plan" | null; endsAt: string | null } {
  if (!person) return { unlimited: false, via: null, endsAt: null };
  if (person.isAdmin || person.role === "admin") return { unlimited: true, via: "admin", endsAt: null };
  if (isDemoAccount(person.username)) return { unlimited: true, via: "demo", endsAt: null };
  if (grants.vip) return { unlimited: true, via: "vip", endsAt: null };
  const g = grants.unlimited;
  if (g && g.kind === "todo_unlimited" && grantLive(g, now)) return { unlimited: true, via: "plan", endsAt: g.endsAt ?? null };
  const y = grants.yearly;
  if (y && y.kind === "todo_unlimited_year" && grantLive(y, now)) return { unlimited: true, via: "plan", endsAt: y.endsAt ?? null };
  const old = grants.oldLifeHub;
  if (old && old.kind === "todo_family" && grantLive(old, now)) return { unlimited: true, via: "old-plan", endsAt: old.endsAt ?? null };
  return { unlimited: false, via: null, endsAt: null };
}

// ─── VIP list: people the admin gives To-Do Unlimited to, no payment ──────────────────────────

/** One person on the VIP list. By email, so it works for someone who has not signed up yet; by account id, for an
 *  existing account of any kind (a parent, say). */
export type VipEntry = { email?: string; userId?: number; label?: string; addedAt: string };
export const VIP_MAX = 200;
const VIP_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const cleanVipEmail = (v: unknown): string => { const e = String(v ?? "").trim().toLowerCase(); return e.length <= 254 && VIP_EMAIL.test(e) ? e : ""; };

/** A saved VIP list made safe to use. */
export function cleanVipList(raw: unknown): VipEntry[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: VipEntry[] = [];
  const seen = new Set<string>();
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    const email = cleanVipEmail((r as any).email);
    const userId = Number.isInteger(Number((r as any).userId)) && Number((r as any).userId) > 0 ? Number((r as any).userId) : 0;
    if (!email && !userId) continue;
    const id = email ? `e:${email}` : `u:${userId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ ...(email ? { email } : {}), ...(userId ? { userId } : {}), ...((r as any).label ? { label: String((r as any).label).replace(/\s+/g, " ").trim().slice(0, 80) } : {}), addedAt: typeof (r as any).addedAt === "string" ? (r as any).addedAt : "" });
    if (out.length >= VIP_MAX) break;
  }
  return out;
}

/** Is this account on the list? By account id (any kind of account), or by email for accounts whose email was
 *  confirmed with a code at sign-up (a To-Do or teacher account that is switched on). A parent account's email is
 *  typed in and never checked, so an email alone never gives a parent account anything: someone could have signed up
 *  with the address first. */
export function onVipList(list: VipEntry[], user: { id?: unknown; email?: unknown; role?: unknown; accountApproved?: unknown } | null | undefined): boolean {
  if (!user) return false;
  const id = Number(user.id);
  if (list.some((e) => e.userId && e.userId === id)) return true;
  const email = cleanVipEmail(user.email);
  if (!email || (user.role !== "todo" && user.role !== "teacher") || user.accountApproved === false) return false;
  return list.some((e) => e.email === email);
}

export const BUNDLE_REQUIRED = "bundle_required";
export const TODO_REQUIRED = "todo_required";

export const HUB_REQUIRED = "hub_required";
export const hubMessage = "A.R.I.S.E. To-Do is free for parents and teachers. Please sign in to continue.";

/** The message shown when something needs Premium. */
export const PREMIUM_REQUIRED = "premium_required";
export const premiumMessage = (who: "teacher" | "student" | "parent") =>
  who === "teacher"
    ? "Teacher tools are part of A.R.I.S.E. Premium."
    : who === "parent"
      ? `One parent profile can follow up to ${PLANS.parentMaxChildren} children.`
      : "This is part of A.R.I.S.E. Premium. Ask your teacher about it.";
