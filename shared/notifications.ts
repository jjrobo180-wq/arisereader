// The notification bell's feed, shared by the server that builds it and the bell that shows it.
//
// Two kinds of items:
//  - "action": something waiting for this person (a teacher to approve, an AI quiz to review,
//    an unread message). It comes from the live state of that thing, so it disappears by itself
//    as soon as the thing is dealt with, wherever that happens. It can also be dismissed.
//  - "update": a stored notification (a quiz was taken, a student signed up). It disappears
//    once it is read.

export type FeedCategory =
  | "teacher" | "parent" | "student" | "unlisted"
  | "ai_quiz" | "request" | "review" | "club" | "grade_change" | "eye_gaze" | "reward"
  | "message" | "report"
  | "signup" | "quiz" | "assessment"
  | "success" | "info";

/** Where the bell sends someone who opens an item; the page decides what each type means. */
export type FeedTarget = { type: string; id: number };

export type FeedItem = {
  /** Stable for the life of the item: dismissing and reading are done by key. */
  key: string;
  kind: "action" | "update";
  category: FeedCategory;
  title: string;
  body: string;
  createdAt: string;
  target?: FeedTarget;
};

export type FeedResponse = {
  type: "admin" | "teacher" | "student" | "parent";
  items: FeedItem[];
  actionCount: number;
  updateCount: number;
  unreadCount: number;
  /** Admin only: unread messages in the admin inbox. */
  inboxUnread?: number;
};

/** Stored notifications made by the admin alerts carry their event in `type`: "alert:<event>[:<ref>]". */
export function parseAlertType(type: unknown): { event: string; ref: string | null } | null {
  const text = String(type || "");
  if (!text.startsWith("alert:")) return null;
  const [, event = "", ref = ""] = text.split(":");
  return event ? { event, ref: ref || null } : null;
}

const ALERT_CATEGORY: Record<string, FeedCategory> = {
  student_signup: "signup",
  teacher_signup: "signup",
  parent_signup: "signup",
  quiz_completed: "quiz",
  eye_gaze_quiz_completed: "quiz",
  assessment_completed: "assessment",
  ai_quiz_review: "ai_quiz",
  quiz_request: "request",
  review_request: "review",
  approval_request: "reward",
  club_signup: "club",
  student_message: "message",
  problem_report: "report",
};

/** The category and link of a stored notification, from its `type`. */
export function describeStoredType(type: unknown): { category: FeedCategory; target?: FeedTarget } {
  const alert = parseAlertType(type);
  if (alert) {
    const category = ALERT_CATEGORY[alert.event] || "info";
    const match = alert.ref ? /^u(\d+)$/.exec(alert.ref) : null;
    const id = match ? Number(match[1]) : 0;
    if (id > 0) {
      const role = alert.event === "teacher_signup" ? "teacher" : alert.event === "parent_signup" ? "parent" : "student";
      return { category, target: { type: role, id } };
    }
    return { category };
  }
  return { category: String(type || "") === "success" ? "success" : "info" };
}
