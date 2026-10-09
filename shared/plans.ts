// Plans, prices and who gets Premium.
//
// Free is for students and their parents. Premium is for teachers and
// schools, and their students get the Premium extras through them.
// Teacher Hub is a separate add-on for teachers and schools, sold at the same
// prices as Premium. It is not part of the free year or a free school.
// Every teacher gets one free month of both: Premium (the teacher account, with
// Arise Math) and Teacher Hub.
// This file is the single place the numbers live: the pricing page, the
// server's plan checks and billing all read them from here.

export const PLANS = {
  teacher: {
    /** $10 a month covers one block of students. */
    monthlyCents: 1000,
    studentsPerBlock: 100,
    /** The most blocks one teacher can buy online (5,000 students). */
    maxBlocks: 50,
  },
  school: {
    /** $700 for a full 12 months, summer included. */
    yearlyCents: 70000,
    studentCap: 1000,
  },
  /** Teacher Hub, the add-on: the same prices as Premium, counted against the students in the teacher's Hub caseload. */
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
   * Like Teacher Hub it is always paid: plan rules, the free year and free schools don't apply.
   */
  social: {
    monthlyCents: 500,
  },
  /**
   * The Learning Bundle: Arise History, Arise Math and Arise Social together.
   * A family pays $10 a month for the parent and every linked child. A teacher adds it
   * on top of Premium for $50 a month, covering their class (up to 100 students).
   * When a teacher's class plan covers every child in a family that is paying, the
   * family's plan is cancelled and the unused part of the month refunded to their card.
   */
  bundle: {
    familyMonthlyCents: 1000,
    teacherMonthlyCents: 5000,
    teacherSeats: 100,
  },
  /** A.R.I.S.E. To-Do for parents: $10 a month. Teachers get it with Teacher Hub. */
  todo: {
    familyMonthlyCents: 1000,
  },
  /**
   * Every account gets 30 free days of the Learning Bundle and To-Do, no card needed.
   * The days start when the account is made; for an account that was already there,
   * they start here instead: midnight on October 9, 2026, Mountain time.
   */
  trialDays: 30,
  trialFrom: "2026-10-09T06:00:00.000Z",
  /** One parent profile can follow this many children on the Free plan. */
  parentMaxChildren: 5,
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
  /**
   * Every teacher's first month is free: Premium (the teacher account, with Arise
   * Math) and Teacher Hub. The month starts when the account is made. For a
   * teacher who already had an account when the free month began, it starts
   * here instead: 8:36 pm on October 8, 2026, Mountain time.
   */
  freeMonthFrom: "2026-10-09T02:36:00.000Z",
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
 * "hub_teacher" and "hub_school" are the Teacher Hub add-on.
 */
export type PlanKind = "teacher" | "school" | "hub_teacher" | "hub_school" | "social" | "bundle_family" | "bundle_teacher" | "todo_family";
export const PLAN_KINDS: readonly PlanKind[] = ["school", "teacher", "hub_school", "hub_teacher", "social", "bundle_family", "bundle_teacher", "todo_family"];
/** Plans bought for one person (or one family), not sized in blocks of students. */
export const isAddonKind = (kind: PlanKind) => kind === "social" || kind === "bundle_family" || kind === "bundle_teacher" || kind === "todo_family";
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
};

/** Is this plan in force right now? */
export function grantLive(grant: PlanGrant | null | undefined, now = Date.now()): boolean {
  if (!grant || grant.status === "canceled") return false;
  if (!grant.endsAt) return true;
  const end = Date.parse(grant.endsAt);
  if (!Number.isFinite(end)) return false;
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

/** The same time of day one calendar month later. January 31 gives the last day of February. */
export function monthAfter(ms: number): number {
  const d = new Date(ms);
  const dayOfMonth = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dayOfMonth, lastDay));
  return d.getTime();
}

/**
 * When a teacher's free month ends (ISO): one month after they made their account.
 * An account that was already there when the free month began, or has no sign-up
 * date on record, counts from `freeMonthFrom`.
 */
export function freeMonthEnd(createdAt: unknown): string {
  const from = Date.parse(PLANS.freeMonthFrom);
  const t = signedUpAt(createdAt);
  return new Date(monthAfter(Number.isFinite(t) && t > from ? t : from)).toISOString();
}

/** Is this teacher still in their free month? */
export function inFreeMonth(createdAt: unknown, now = Date.now()): boolean {
  return now >= Date.parse(PLANS.freeMonthFrom) && now < Date.parse(freeMonthEnd(createdAt));
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
  | "grandfathered"  // signed up before October 1, 2026
  | "free-month";    // a teacher's first month

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
  // The free month comes last: a plan or the free year outlasts it.
  if (inFreeMonth(teacher.createdAt, now)) return yes("free-month", null, freeMonthEnd(teacher.createdAt));
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
  if (!opts.enforced || opts.premiumFamily) return true;
  return linkedCount < PLANS.parentMaxChildren;
}

// ─── Teacher Hub ─────────────────────────────────────────────────────────────

export type HubVia = "admin" | "hub-teacher-plan" | "hub-school-plan" | "free-month";
export type HubAccess = { access: boolean; via: HubVia | null; seats: number | null; endsAt: string | null };

/**
 * Can this person open Teacher Hub? With a Teacher Hub plan of their own or their
 * school's, during a teacher's free month, or as the site admin. Unlike Premium it
 * does not depend on plan rules being on, and there is no free year, free school
 * or sample account.
 */
export function hubAccessFor(person: PlanPerson | null | undefined, facts: { now?: number; teacherGrant?: PlanGrant | null; schoolGrant?: PlanGrant | null }): HubAccess {
  const none: HubAccess = { access: false, via: null, seats: null, endsAt: null };
  if (!person) return none;
  if (person.isAdmin || person.role === "admin") return { access: true, via: "admin", seats: null, endsAt: null };
  if (person.role !== "teacher") return none;
  const now = facts.now ?? Date.now();
  const own = facts.teacherGrant, school = facts.schoolGrant;
  if (grantLive(own, now) && own!.kind === "hub_teacher") return { access: true, via: "hub-teacher-plan", seats: own!.seats, endsAt: own!.endsAt };
  if (grantLive(school, now) && school!.kind === "hub_school" && !school!.free) return { access: true, via: "hub-school-plan", seats: school!.seats, endsAt: school!.endsAt };
  // The free month has no student limit.
  if (inFreeMonth(person.createdAt, now)) return { access: true, via: "free-month", seats: null, endsAt: freeMonthEnd(person.createdAt) };
  return none;
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

// ─── Free trial, Learning Bundle and To-Do ───────────────────────────────────

/** When this account's 30 free days end (ISO). */
export function trialEnd(createdAt: unknown): string {
  const from = Date.parse(PLANS.trialFrom);
  const t = signedUpAt(createdAt);
  return new Date((Number.isFinite(t) && t > from ? t : from) + PLANS.trialDays * 86_400_000).toISOString();
}
export const inTrial = (createdAt: unknown, now = Date.now()) => now >= Date.parse(PLANS.trialFrom) && now < Date.parse(trialEnd(createdAt));
/** Whole days left in the trial, counting today (0 once it's over). */
export const trialDaysLeft = (createdAt: unknown, now = Date.now()) => Math.max(0, Math.ceil((Date.parse(trialEnd(createdAt)) - now) / 86_400_000));

export type AddonVia =
  | "admin" | "demo"
  | "family-plan"      // a parent's Learning Bundle (the parent, or a child of theirs)
  | "class-plan"       // a teacher's Learning Bundle covering their class (the teacher, or a student in it)
  | "social-plan"      // an Arise Social plan bought before the Learning Bundle existed
  | "child-in-class"   // a parent whose every linked child is covered by a class plan
  | "hub"              // To-Do for a teacher, through Teacher Hub
  | "todo-plan"        // To-Do for a parent
  | "trial";
export type AddonAccess = { access: boolean; via: AddonVia | null; endsAt: string | null; trialEndsAt: string | null };

export type BundleFacts = {
  now?: number;
  /** The person's own Learning Bundle (bundle_family for a parent, bundle_teacher for a teacher). */
  ownGrant?: PlanGrant | null;
  /** An old Arise Social plan of the person's own. */
  socialGrant?: PlanGrant | null;
  /** Students: the family plans of their linked parents. */
  parentGrants?: (PlanGrant | null)[];
  /** Students: their teacher's class plan, if the teacher approved them into the class. */
  classGrant?: PlanGrant | null;
  /** Parents: does a class plan cover every one of their linked children (at least one)? */
  allChildrenInClassPlans?: boolean;
};

/** Can this person use Arise History, Arise Math and Arise Social? */
export function bundleAccessFor(person: PlanPerson | null | undefined, facts: BundleFacts): AddonAccess {
  const none: AddonAccess = { access: false, via: null, endsAt: null, trialEndsAt: null };
  if (!person) return none;
  if (person.isAdmin || person.role === "admin") return { ...none, access: true, via: "admin" };
  if (isDemoAccount(person.username)) return { ...none, access: true, via: "demo" };
  const now = facts.now ?? Date.now();
  const live = (g: PlanGrant | null | undefined, kind: PlanKind) => !!g && g.kind === kind && grantLive(g, now);
  const yes = (via: AddonVia, g?: PlanGrant | null): AddonAccess => ({ access: true, via, endsAt: g?.endsAt ?? null, trialEndsAt: null });
  if (person.role === "teacher" && live(facts.ownGrant, "bundle_teacher")) return yes("class-plan", facts.ownGrant);
  if (person.role === "parent" && live(facts.ownGrant, "bundle_family")) return yes("family-plan", facts.ownGrant);
  if (person.role !== "teacher" && person.role !== "parent") {
    const fam = (facts.parentGrants || []).find((g) => live(g, "bundle_family"));
    if (fam) return yes("family-plan", fam);
    if (live(facts.classGrant, "bundle_teacher")) return yes("class-plan", facts.classGrant);
  }
  if (person.role === "parent" && facts.allChildrenInClassPlans) return yes("child-in-class");
  if (live(facts.socialGrant, "social")) return yes("social-plan", facts.socialGrant);
  if (inTrial(person.createdAt, now)) return { access: true, via: "trial", endsAt: trialEnd(person.createdAt), trialEndsAt: trialEnd(person.createdAt) };
  return { ...none, trialEndsAt: trialEnd(person.createdAt) };
}

/**
 * Can this person use A.R.I.S.E. To-Do? Parents with a To-Do plan or in their trial; teachers
 * with Teacher Hub (paid or in its free month). Everyone else keeps To-Do as before.
 */
export function todoAccessFor(person: PlanPerson | null | undefined, facts: { now?: number; todoGrant?: PlanGrant | null; hub?: HubAccess | null }): AddonAccess {
  const none: AddonAccess = { access: false, via: null, endsAt: null, trialEndsAt: null };
  if (!person) return none;
  if (person.isAdmin || person.role === "admin") return { ...none, access: true, via: "admin" };
  if (isDemoAccount(person.username)) return { ...none, access: true, via: "demo" };
  const now = facts.now ?? Date.now();
  if (person.role === "teacher") {
    return facts.hub?.access ? { access: true, via: "hub", endsAt: facts.hub.endsAt, trialEndsAt: facts.hub.via === "free-month" ? facts.hub.endsAt : null } : none;
  }
  if (person.role !== "parent") return { ...none, access: true };
  const g = facts.todoGrant;
  if (g && g.kind === "todo_family" && grantLive(g, now)) return { access: true, via: "todo-plan", endsAt: g.endsAt, trialEndsAt: null };
  if (inTrial(person.createdAt, now)) return { access: true, via: "trial", endsAt: trialEnd(person.createdAt), trialEndsAt: trialEnd(person.createdAt) };
  return { ...none, trialEndsAt: trialEnd(person.createdAt) };
}
export const BUNDLE_REQUIRED = "bundle_required";
export const TODO_REQUIRED = "todo_required";

export const HUB_REQUIRED = "hub_required";
export const hubMessage = "Teacher Hub is a paid add-on. Get it on your plan page.";

/** The message shown when something needs Premium. */
export const PREMIUM_REQUIRED = "premium_required";
export const premiumMessage = (who: "teacher" | "student" | "parent") =>
  who === "teacher"
    ? "Teacher tools are part of A.R.I.S.E. Premium."
    : who === "parent"
      ? `One parent profile can follow up to ${PLANS.parentMaxChildren} children.`
      : "This is part of A.R.I.S.E. Premium. Ask your teacher about it.";
