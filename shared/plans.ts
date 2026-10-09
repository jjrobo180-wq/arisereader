// Plans, prices and who gets Premium.
//
// Free is for students and their parents. Premium is for teachers and
// schools, and their students get the Premium extras through them.
// Teacher Hub is a separate add-on for teachers and schools, sold at the same
// prices as Premium. Nobody gets it free: no free year, no free school.
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
export type PlanKind = "teacher" | "school" | "hub_teacher" | "hub_school" | "social";
export const PLAN_KINDS: readonly PlanKind[] = ["school", "teacher", "hub_school", "hub_teacher", "social"];
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

/**
 * Signed up before the cutoff, and the free year has not run out.
 * An account with no sign-up date on record is an old one, so it counts.
 */
export function grandfathered(createdAt: unknown, now = Date.now()): boolean {
  if (now >= Date.parse(PLANS.grandfatherUntil)) return false;
  if (createdAt === null || createdAt === undefined || createdAt === "") return true;
  const t = createdAt instanceof Date ? createdAt.getTime() : typeof createdAt === "number" ? createdAt : Date.parse(String(createdAt));
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
  if (!opts.enforced || opts.premiumFamily) return true;
  return linkedCount < PLANS.parentMaxChildren;
}

// ─── Teacher Hub ─────────────────────────────────────────────────────────────

export type HubVia = "admin" | "hub-teacher-plan" | "hub-school-plan";
export type HubAccess = { access: boolean; via: HubVia | null; seats: number | null; endsAt: string | null };

/**
 * Can this person open Teacher Hub? Only with a Teacher Hub plan of their own or
 * their school's, or as the site admin. Unlike Premium it does not depend on plan
 * rules being on, and there is no free year, free school or sample account.
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
