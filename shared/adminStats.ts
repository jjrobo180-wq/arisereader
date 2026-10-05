// The admin Stats tab: what the server sends and the few rules both sides share.

export const STATS_RANGES = ["7d", "30d", "90d", "all"] as const;
export type StatsRange = (typeof STATS_RANGES)[number];
export const STATS_RANGE_LABEL: Record<StatsRange, string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days", all: "All time" };
export const isStatsRange = (v: unknown): v is StatsRange => typeof v === "string" && (STATS_RANGES as readonly string[]).includes(v);

/** Days are counted in the school's time zone, so "today" ends at local midnight. */
export const STATS_TIME_ZONE = "America/Denver";
/** Someone counts as online if the app heard from them this recently. */
export const ONLINE_WINDOW_MS = 10 * 60_000;
/** A student counts as quiet after this many days without opening the app. */
export const QUIET_AFTER_DAYS = 14;

export type StatsRole = "student" | "teacher" | "parent";

/** One point on the charts: a day, or a week (starting Monday) for long ranges. */
export type StatsBucket = {
  key: string; // YYYY-MM-DD (first day of the bucket)
  newStudents: number;
  newTeachers: number;
  newParents: number;
  /** Accounts that existed at the end of the bucket. */
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
  studentLogins: number;
  staffLogins: number;
  /** Students who opened the app or did anything in it. */
  activeStudents: number;
  bookQuizzes: number;
  eyeGazeQuizzes: number;
  assessments: number;
  passed: number;
  points: number;
  feedViews: number;
};

export type StatsDelta = { now: number; before: number | null };

export type StatsPerson = { userId: number; name: string; role: StatsRole; school: string | null };

export type AdminStats = {
  range: StatsRange;
  bucket: "day" | "week";
  from: string; // first day shown (YYYY-MM-DD)
  to: string; // today (YYYY-MM-DD)
  timeZone: string;
  generatedAt: string;
  /** The day the app started recording every visit (not only sign-ins). */
  visitsSince: string | null;
  totals: {
    students: number;
    teachers: number;
    parents: number;
    schools: number;
    newStudents: StatsDelta;
    newTeachers: StatsDelta;
    newParents: StatsDelta;
    activeStudents: StatsDelta;
    activeTeachers: number;
    activeParents: number;
    activeToday: number;
    onlineNow: number;
    logins: StatsDelta;
    quizzes: StatsDelta;
    passed: number;
    /** Share of graded quizzes passed in the range, 0-100, or null when there were none. */
    passRate: number | null;
    points: StatsDelta;
    feedViews: number;
  };
  buckets: StatsBucket[];
  /** Hours (0-23, local time) when students were using the app: one count per student per hour. */
  hours: number[];
  /** Monday first: one count per student per day they were active. */
  weekdays: number[];
  devices: { name: string; count: number }[];
  schools: { id: number | null; name: string; students: number; teachers: number; activeStudents: number }[];
  grades: { grade: string; students: number }[];
  onlineNow: (StatsPerson & { lastSeen: string })[];
  recentLogins: (StatsPerson & { at: string; device: string | null })[];
  topStudents: (StatsPerson & { activeDays: number; logins: number; quizzes: number; passed: number; points: number; lastSeen: string | null })[];
  quietStudents: (StatsPerson & { lastSeen: string | null; daysAway: number | null })[];
  quietCount: number;
  reading: {
    assessments: number;
    averagePercent: number | null;
    recent: (StatsPerson & { at: string; kind: "Reading check" | "Growth Check"; percent: number | null; detail: string })[];
  };
};
