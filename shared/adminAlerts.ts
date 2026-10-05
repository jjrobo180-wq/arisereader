// Admin alerts: the things that can happen on the site that the admin may want to hear about,
// by email and in the notification bell. Each one can be switched on or off for each channel
// under Admin > Settings > Notifications. The server sends them (server/adminAlerts.ts).

export const ALERT_EVENT_KEYS = [
  "student_signup",
  "teacher_signup",
  "parent_signup",
  "quiz_completed",
  "eye_gaze_quiz_completed",
  "assessment_completed",
  "ai_quiz_review",
  "quiz_request",
  "review_request",
  "approval_request",
  "club_signup",
  "student_message",
  "problem_report",
] as const;

export type AlertEventKey = (typeof ALERT_EVENT_KEYS)[number];

export type AlertChannels = { email: boolean; inApp: boolean };

export type AlertEventInfo = {
  key: AlertEventKey;
  group: "Sign-ups" | "Quizzes" | "Requests" | "Messages";
  label: string;
  hint: string;
  defaults: AlertChannels;
};

export const ALERT_EVENTS: readonly AlertEventInfo[] = [
  { key: "student_signup", group: "Sign-ups", label: "A student signs up", hint: "Their grade, school and the teacher they picked.", defaults: { email: true, inApp: true } },
  { key: "teacher_signup", group: "Sign-ups", label: "A teacher joins", hint: "When a teacher confirms their school email, or needs you to turn their account on.", defaults: { email: true, inApp: true } },
  { key: "parent_signup", group: "Sign-ups", label: "A parent signs up", hint: "And which student they connected to.", defaults: { email: true, inApp: true } },
  { key: "quiz_completed", group: "Quizzes", label: "A book quiz is taken", hint: "Score, points earned and who proctored it.", defaults: { email: true, inApp: true } },
  { key: "eye_gaze_quiz_completed", group: "Quizzes", label: "An Eye Gazer quiz is taken", hint: "Built-in and custom Eye Gazer quizzes.", defaults: { email: true, inApp: true } },
  { key: "assessment_completed", group: "Quizzes", label: "A reading assessment or Growth Check is finished", hint: "Score and the reading level it points to.", defaults: { email: true, inApp: true } },
  { key: "ai_quiz_review", group: "Requests", label: "An AI quiz needs your review", hint: "A student made a quiz with AI and it's waiting for approval.", defaults: { email: true, inApp: true } },
  { key: "quiz_request", group: "Requests", label: "A student asks for a book or quiz", hint: "Quiz requests, book requests and Learning Ally / Clever requests.", defaults: { email: true, inApp: true } },
  { key: "review_request", group: "Requests", label: "A student asks you to re-check a quiz grade", hint: "Manual review requests.", defaults: { email: true, inApp: true } },
  { key: "approval_request", group: "Requests", label: "Grade change, Eye Gaze mode and reward requests", hint: "Students asking to change grade band or Eye Gaze mode, or to claim a reward.", defaults: { email: true, inApp: true } },
  { key: "club_signup", group: "Requests", label: "A Reading Club sign-up", hint: "Waiting for you to confirm or deny.", defaults: { email: true, inApp: true } },
  { key: "student_message", group: "Messages", label: "Someone sends you a message", hint: "Students, parents and teachers writing to the admin inbox.", defaults: { email: true, inApp: true } },
  { key: "problem_report", group: "Messages", label: "Someone reports a problem", hint: "From the Report button on any page.", defaults: { email: true, inApp: true } },
];

export type AlertSettings = {
  /** Master switch for alert emails. In-app alerts follow each event's own switch. */
  emailEnabled: boolean;
  /** Where alert emails go. */
  recipients: string[];
  /** Alerts that arrive within a minute of an email are combined into one email. */
  bundle: boolean;
  /** Most alert emails in one day (Mountain Time). 0 means no limit. */
  dailyLimit: number;
  events: Record<AlertEventKey, AlertChannels>;
};

export type AlertEmailLogEntry = {
  at: string;
  subject: string;
  to: string[];
  events: string[];
  status: "sent" | "failed" | "skipped";
  detail?: string;
};

export type AlertSettingsResponse = {
  settings: AlertSettings;
  email: { configured: boolean; from: string; sentToday: number; dailyLimit: number };
  log: AlertEmailLogEntry[];
};

export const MAX_ALERT_RECIPIENTS = 5;
export const DEFAULT_DAILY_LIMIT = 80;

const EMAIL_PATTERN = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]{2,}$/;

export function isEmailAddress(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL_PATTERN.test(value);
}

export function defaultAlertSettings(recipient: string): AlertSettings {
  const events = {} as Record<AlertEventKey, AlertChannels>;
  for (const info of ALERT_EVENTS) events[info.key] = { ...info.defaults };
  return {
    emailEnabled: true,
    recipients: isEmailAddress(recipient.trim().toLowerCase()) ? [recipient.trim().toLowerCase()] : [],
    bundle: true,
    dailyLimit: DEFAULT_DAILY_LIMIT,
    events,
  };
}

/** Anything saved or sent by a page becomes a complete, valid settings object. */
export function normalizeAlertSettings(raw: unknown, recipient: string): AlertSettings {
  const base = defaultAlertSettings(recipient);
  if (!raw || typeof raw !== "object") return base;
  const input = raw as Record<string, any>;
  const out: AlertSettings = { ...base, events: { ...base.events } };
  if (typeof input.emailEnabled === "boolean") out.emailEnabled = input.emailEnabled;
  if (typeof input.bundle === "boolean") out.bundle = input.bundle;
  if (input.dailyLimit !== undefined) {
    const limit = Math.floor(Number(input.dailyLimit));
    if (Number.isFinite(limit)) out.dailyLimit = Math.min(1000, Math.max(0, limit));
  }
  if (Array.isArray(input.recipients)) {
    const seen = new Set<string>();
    for (const value of input.recipients) {
      const email = String(value ?? "").trim().toLowerCase();
      if (isEmailAddress(email) && !seen.has(email)) seen.add(email);
    }
    out.recipients = Array.from(seen).slice(0, MAX_ALERT_RECIPIENTS);
  }
  if (input.events && typeof input.events === "object") {
    for (const info of ALERT_EVENTS) {
      const saved = input.events[info.key];
      if (!saved || typeof saved !== "object") continue;
      out.events[info.key] = {
        email: typeof saved.email === "boolean" ? saved.email : info.defaults.email,
        inApp: typeof saved.inApp === "boolean" ? saved.inApp : info.defaults.inApp,
      };
    }
  }
  return out;
}

export function isAlertEventKey(value: unknown): value is AlertEventKey {
  return typeof value === "string" && (ALERT_EVENT_KEYS as readonly string[]).includes(value);
}
