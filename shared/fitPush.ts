// Cooked and Cooked PT: the alerts the server sends when someone else does something (a message, a
// check-in, a buddy who just trained). Each kind can be switched off in the app's Notifications screen;
// the choices are saved as settings key `fit_push_prefs_<userId>` and checked in notifyUser.

export const FIT_PUSH_KINDS = ["messages", "requests", "checkins", "sessions", "plan", "form", "payments", "friends", "groups"] as const;
export type FitPushKind = (typeof FIT_PUSH_KINDS)[number];

/** What each switch says, and which app shows it. */
export const FIT_PUSH_LABELS: Record<FitPushKind, { label: string; sub: string; apps: ("fit" | "trainer")[] }> = {
  messages: { label: "Messages", sub: "From your trainer or your clients", apps: ["fit", "trainer"] },
  requests: { label: "New clients and leads", sub: "Requests, invites, website leads, marketplace", apps: ["trainer"] },
  checkins: { label: "Check-ins", sub: "When a client answers their check-in", apps: ["trainer"] },
  sessions: { label: "Session requests", sub: "When a client asks for a session", apps: ["trainer"] },
  plan: { label: "Plan updates", sub: "New workouts and targets from your trainer", apps: ["fit"] },
  form: { label: "Form checks", sub: "Videos sent and feedback back", apps: ["fit", "trainer"] },
  payments: { label: "Payments", sub: "When a client pays", apps: ["trainer"] },
  friends: { label: "Buddy, circle and guest pass", sub: "Cheers, workouts done, buddy messages", apps: ["fit"] },
  groups: { label: "Groups and challenges", sub: "Posts, chats and new challenges", apps: ["fit", "trainer"] },
};

export type FitPushPrefs = { all: boolean } & Record<FitPushKind, boolean>;
export const defaultFitPushPrefs = (): FitPushPrefs => ({ all: true, ...Object.fromEntries(FIT_PUSH_KINDS.map((k) => [k, true])) } as FitPushPrefs);

export function cleanFitPushPrefs(raw: any): FitPushPrefs {
  const out = defaultFitPushPrefs();
  if (!raw || typeof raw !== "object") return out;
  if (raw.all === false) out.all = false;
  for (const k of FIT_PUSH_KINDS) if (raw[k] === false) out[k] = false;
  return out;
}

/** Which switch a server alert falls under. null for alerts that aren't Cooked's (the Reader, WorkHub). */
export function fitPushKind(m: { title?: string; tag?: string; url?: string }): FitPushKind | null {
  const url = String(m.url || ""), tag = String(m.tag || ""), title = String(m.title || "");
  if (!/^#\/(fit|trainer)\b/.test(url)) return null;
  if (tag.startsWith("pay-")) return "payments";
  if (tag.startsWith("fc-")) return "form";
  if (tag.startsWith("lead-") || tag.startsWith("mk-")) return "requests";
  if (/^g(roup|post|com|chat|ch)-/.test(tag)) return "groups";
  if (/^fit-(buddy|circle|cheer|done|pass)/.test(tag)) return "friends";
  if (tag.startsWith("coach-")) {
    if (/request|new client|you have a trainer|hired/i.test(title) && !/session/i.test(title)) return "requests";
    if (/check-?in/i.test(title)) return "checkins";
    if (/session/i.test(title)) return "sessions";
    if (/plan|workouts from|targets/i.test(title)) return "plan";
    return "messages";
  }
  return "messages";
}

/** Should this alert go to this person? */
export function fitPushAllowed(prefs: FitPushPrefs | null | undefined, m: { title?: string; tag?: string; url?: string }): boolean {
  const kind = fitPushKind(m);
  if (!kind || !prefs) return true;
  return prefs.all !== false && prefs[kind] !== false;
}
