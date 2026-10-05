// Admin alerts: tell the admin when something happens on the site (a sign-up, a quiz, a request),
// by email and in the notification bell, following the switches under Admin > Settings > Notifications.
//
// - In the bell: a stored notification for every admin account. Things the bell already shows from
//   their live state (an AI quiz to review, an unread message) pass `row: false`, so they are not
//   shown twice and still disappear on their own once dealt with.
// - By email: sent through the site's email sender. Alerts that come in within a minute of the last
//   email are combined into one email, so a class taking quizzes doesn't send thirty emails, and a
//   daily limit keeps alerts from using up the email allowance that sign-up codes and password
//   resets also need. Every email (sent, failed or skipped) is written to a short log the admin can see.
//
// Nothing here ever throws into the request that triggered it.
import {
  normalizeAlertSettings,
  type AlertEmailLogEntry,
  type AlertEventKey,
  type AlertSettings,
} from "../shared/adminAlerts";

export const ALERT_SETTINGS_KEY = "admin_alert_settings";
export const ALERT_STATE_KEY = "admin_alert_email_state";
export const ALERT_LOG_LIMIT = 50;
export const BUNDLE_WINDOW_MS = 60_000;
const SETTINGS_TTL_MS = 15_000;
const MAX_ALERTS_PER_EMAIL = 25;

export type AlertLine = [label: string, value: string | number | null | undefined];

export type Alert = {
  /** One line: the email subject and the bell's title. */
  title: string;
  /** One line under the title in the bell. */
  summary: string;
  /** Details for the email. Empty values are left out. */
  lines?: AlertLine[];
  /** A sentence under the details, e.g. what to do next. */
  note?: string;
  /** What the alert is about, e.g. "u12" for user 12; the bell links to it. */
  ref?: string;
  /** false when the bell already shows this from its live state. */
  row?: boolean;
};

export type SendResult = { sent: boolean; error?: string };

export type AdminAlertDeps = {
  /** A fresh read; throws when the database can't be reached. */
  readSetting(key: string): Promise<string>;
  upsertSetting(key: string, value: string): Promise<void>;
  adminIds(): Promise<number[]>;
  insertNotifications(rows: { user_id: number; type: string; title: string; message: string }[]): Promise<void>;
  sendEmail(to: string[], subject: string, html: string): Promise<SendResult>;
  emailConfigured(): boolean;
  fromAddress: string;
  fallbackRecipient: string;
  appUrl: string;
  timeZone?: string;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  log?: (message: string) => void;
};

type Pending = { event: AlertEventKey; alert: Alert; at: number };
type EmailState = { day: string; count: number; capNoted: boolean; log: AlertEmailLogEntry[] };

// ─── Email content ───────────────────────────────────────────────────────────

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const clip = (value: unknown, max: number) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const NOUNS: Record<AlertEventKey, [string, string]> = {
  student_signup: ["new student", "new students"],
  teacher_signup: ["teacher update", "teacher updates"],
  parent_signup: ["new parent", "new parents"],
  quiz_completed: ["quiz taken", "quizzes taken"],
  eye_gaze_quiz_completed: ["Eye Gazer quiz", "Eye Gazer quizzes"],
  assessment_completed: ["assessment finished", "assessments finished"],
  ai_quiz_review: ["AI quiz to review", "AI quizzes to review"],
  quiz_request: ["book request", "book requests"],
  review_request: ["grade review request", "grade review requests"],
  approval_request: ["request to approve", "requests to approve"],
  club_signup: ["Reading Club sign-up", "Reading Club sign-ups"],
  student_message: ["message", "messages"],
  problem_report: ["problem report", "problem reports"],
};

export function alertEmailSubject(batch: { event: AlertEventKey; alert: Alert }[]): string {
  if (batch.length === 1) return `${clip(batch[0].alert.title, 140)} · A.R.I.S.E Reader`;
  const counts = new Map<AlertEventKey, number>();
  for (const { event } of batch) counts.set(event, (counts.get(event) || 0) + 1);
  const parts = Array.from(counts, ([event, n]) => `${n} ${NOUNS[event][n === 1 ? 0 : 1]}`);
  const shown = parts.slice(0, 3).join(", ") + (parts.length > 3 ? ", and more" : "");
  return `${batch.length} new alerts: ${shown} · A.R.I.S.E Reader`;
}

function alertBlock(alert: Alert, heading: "h2" | "h3"): string {
  const size = heading === "h2" ? 22 : 17;
  const rows = (alert.lines || [])
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .map(([label, value]) => `<tr><td style="padding:6px 12px 6px 0;color:#9a9ab0;font-size:14px;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:6px 0;color:#f1f1f6;font-size:14px;line-height:1.5;word-break:break-word;">${escapeHtml(value)}</td></tr>`)
    .join("");
  return `<${heading} style="color:#FF5900;font-size:${size}px;line-height:1.3;margin:0 0 12px 0;">${escapeHtml(alert.title)}</${heading}>`
    + (rows ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#26262e;border-radius:8px;padding:10px 16px;margin:0 0 12px 0;">${rows}</table>` : "")
    + (alert.note ? `<p style="color:#c8c8d4;font-size:14px;line-height:1.6;margin:0 0 4px 0;">${escapeHtml(alert.note)}</p>` : "");
}

export function alertEmailHtml(batch: { event: AlertEventKey; alert: Alert }[], appUrl: string): string {
  const shown = batch.slice(0, MAX_ALERTS_PER_EMAIL);
  const more = batch.length - shown.length;
  const body = batch.length === 1
    ? alertBlock(batch[0].alert, "h2")
    : `<h2 style="color:#FF5900;font-size:22px;margin:0 0 6px 0;">${batch.length} new alerts</h2><p style="color:#9a9ab0;font-size:14px;margin:0 0 20px 0;">These came in close together, so they're in one email.</p>`
      + shown.map(({ alert }) => `<div style="border-top:1px solid #33333d;padding-top:18px;margin-top:18px;">${alertBlock(alert, "h3")}</div>`).join("")
      + (more > 0 ? `<p style="color:#c8c8d4;font-size:14px;margin:18px 0 0 0;">…and ${more} more. Open the notification bell on the admin page to see them all.</p>` : "");
  const adminUrl = `${appUrl.replace(/\/+$/, "")}/#/admin`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#1a1a1f;color:#ffffff;padding:32px;border-radius:12px;">`
    + `<p style="margin:0 0 24px 0;color:#FF5900;font-size:13px;font-weight:bold;letter-spacing:2px;">A.R.I.S.E READER · ADMIN ALERT</p>`
    + body
    + `<a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#FF5900;color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:8px;font-size:15px;font-weight:bold;margin:22px 0 0 0;">Open the admin page</a>`
    + `<p style="color:#77778a;font-size:12px;line-height:1.6;margin:28px 0 0 0;">You get this because admin alert emails are on. Choose which alerts you get under Admin → Settings → Notifications.</p>`
    + `</div>`;
}

export function testEmailHtml(appUrl: string): string {
  return alertEmailHtml([{ event: "student_message", alert: {
    title: "Alert emails are working",
    summary: "",
    lines: [["Sent", new Date().toUTCString()]],
    note: "This is a test from Admin → Settings → Notifications. Real alerts will look like this.",
  } }], appUrl);
}

// ─── The sender ──────────────────────────────────────────────────────────────

export function dayInZone(ms: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

export function createAdminAlerts(deps: AdminAlertDeps) {
  const now = deps.now || (() => Date.now());
  const setTimer = deps.setTimer || ((fn: () => void, ms: number) => {
    const timer = setTimeout(fn, ms);
    (timer as any).unref?.();
    return timer;
  });
  const say = deps.log || ((message: string) => console.error(message));
  const timeZone = deps.timeZone || "America/Denver";

  let settingsCache: { value: AlertSettings; at: number } | null = null;
  let state: EmailState = { day: "", count: 0, capNoted: false, log: [] };
  let stateLoaded: Promise<void> | null = null;
  let lastSentAt = -Infinity;
  let pending: Pending[] = [];
  let flushScheduled = false;
  let writes: Promise<void> = Promise.resolve();

  const loadState = () => {
    if (!stateLoaded) {
      stateLoaded = (async () => {
        try {
          const raw = await deps.readSetting(ALERT_STATE_KEY);
          const saved = raw ? JSON.parse(raw) : null;
          if (saved && typeof saved === "object") {
            state = {
              day: typeof saved.day === "string" ? saved.day : "",
              count: Number.isFinite(saved.count) ? Number(saved.count) : 0,
              capNoted: !!saved.capNoted,
              log: Array.isArray(saved.log) ? saved.log.slice(0, ALERT_LOG_LIMIT) : [],
            };
          }
        } catch (e: any) {
          say(`[admin-alerts] could not read the email log: ${e?.message || e}`);
        }
      })();
    }
    return stateLoaded;
  };

  const rollDay = () => {
    const today = dayInZone(now(), timeZone);
    if (state.day !== today) state = { ...state, day: today, count: 0, capNoted: false };
  };

  const record = (entry: AlertEmailLogEntry) => {
    state.log = [entry, ...state.log].slice(0, ALERT_LOG_LIMIT);
    const snapshot = JSON.stringify(state);
    writes = writes
      .then(() => deps.upsertSetting(ALERT_STATE_KEY, snapshot))
      .catch((e: any) => say(`[admin-alerts] could not save the email log: ${e?.message || e}`));
    return writes;
  };

  async function getSettings(): Promise<AlertSettings> {
    if (settingsCache && now() - settingsCache.at < SETTINGS_TTL_MS) return settingsCache.value;
    let raw = "";
    try {
      raw = await deps.readSetting(ALERT_SETTINGS_KEY);
    } catch (e: any) {
      say(`[admin-alerts] could not read alert settings: ${e?.message || e}`);
      if (settingsCache) return settingsCache.value;
    }
    let parsed: unknown = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
    const value = normalizeAlertSettings(parsed, deps.fallbackRecipient);
    settingsCache = { value, at: now() };
    return value;
  }

  async function saveSettings(input: unknown): Promise<AlertSettings> {
    const value = normalizeAlertSettings(input, deps.fallbackRecipient);
    await deps.upsertSetting(ALERT_SETTINGS_KEY, JSON.stringify(value));
    settingsCache = { value, at: now() };
    return value;
  }

  async function send(batch: Pending[], settings: AlertSettings): Promise<void> {
    if (!batch.length) return;
    await loadState();
    rollDay();
    const events = batch.map((item) => item.event);
    if (settings.dailyLimit > 0 && state.count >= settings.dailyLimit) {
      if (!state.capNoted) {
        state.capNoted = true;
        await record({
          at: new Date(now()).toISOString(),
          subject: alertEmailSubject(batch),
          to: settings.recipients,
          events,
          status: "skipped",
          detail: `Today's limit of ${settings.dailyLimit} alert emails was reached. More alerts today show in the bell only.`,
        });
      }
      return;
    }
    lastSentAt = now();
    const subject = alertEmailSubject(batch);
    let result: SendResult;
    try {
      result = await deps.sendEmail(settings.recipients, subject, alertEmailHtml(batch, deps.appUrl));
    } catch (e: any) {
      result = { sent: false, error: e?.message || "The email could not be sent." };
    }
    if (result.sent) state.count += 1;
    else say(`[admin-alerts] email not sent: ${result.error || "unknown error"}`);
    await record({
      at: new Date(now()).toISOString(),
      subject,
      to: settings.recipients,
      events,
      status: result.sent ? "sent" : "failed",
      ...(result.sent ? {} : { detail: clip(result.error || "Unknown error", 300) }),
    });
  }

  const flush = async () => {
    flushScheduled = false;
    const batch = pending;
    pending = [];
    try {
      const settings = await getSettings();
      if (settings.emailEnabled && settings.recipients.length && deps.emailConfigured()) await send(batch, settings);
    } catch (e: any) {
      say(`[admin-alerts] could not send combined alerts: ${e?.message || e}`);
    }
  };

  async function queueEmail(event: AlertEventKey, alert: Alert, settings: AlertSettings): Promise<void> {
    if (!deps.emailConfigured() || !settings.recipients.length) return;
    const item: Pending = { event, alert, at: now() };
    if (!settings.bundle || (pending.length === 0 && now() - lastSentAt >= BUNDLE_WINDOW_MS)) {
      await send([item], settings);
      return;
    }
    pending.push(item);
    if (!flushScheduled) {
      flushScheduled = true;
      setTimer(() => { void flush(); }, Math.max(1000, lastSentAt + BUNDLE_WINDOW_MS - now()));
    }
  }

  async function storeInApp(event: AlertEventKey, alert: Alert): Promise<void> {
    const ids = await deps.adminIds();
    if (!ids.length) return;
    const type = `alert:${event}${alert.ref ? `:${alert.ref}` : ""}`;
    const title = clip(alert.title, 200);
    const message = clip(alert.summary, 500);
    await deps.insertNotifications(ids.map((user_id) => ({ user_id, type, title, message })));
  }

  /** Tell the admin about something. Never throws. */
  async function notify(event: AlertEventKey, alert: Alert): Promise<void> {
    try {
      const settings = await getSettings();
      const channels = settings.events[event];
      if (!channels) return;
      const work: Promise<void>[] = [];
      if (channels.inApp && alert.row !== false) {
        work.push(storeInApp(event, alert).catch((e: any) => say(`[admin-alerts] could not add a notification: ${e?.message || e}`)));
      }
      if (channels.email && settings.emailEnabled) {
        work.push(queueEmail(event, alert, settings).catch((e: any) => say(`[admin-alerts] could not send an alert email: ${e?.message || e}`)));
      }
      await Promise.all(work);
    } catch (e: any) {
      say(`[admin-alerts] ${event} failed: ${e?.message || e}`);
    }
  }

  /** Sends a test email to the alert addresses, whatever the switches say. */
  async function sendTest(): Promise<SendResult & { to: string[] }> {
    const settings = await getSettings();
    if (!deps.emailConfigured()) return { sent: false, error: "Email isn't set up on the server yet: RESEND_API_KEY is missing from the hosting settings.", to: [] };
    if (!settings.recipients.length) return { sent: false, error: "Add an email address to send alerts to first.", to: [] };
    await loadState();
    rollDay();
    let result: SendResult;
    try {
      result = await deps.sendEmail(settings.recipients, "Test alert · A.R.I.S.E Reader", testEmailHtml(deps.appUrl));
    } catch (e: any) {
      result = { sent: false, error: e?.message || "The email could not be sent." };
    }
    if (result.sent) state.count += 1;
    await record({
      at: new Date(now()).toISOString(),
      subject: "Test alert",
      to: settings.recipients,
      events: ["test"],
      status: result.sent ? "sent" : "failed",
      ...(result.sent ? {} : { detail: clip(result.error || "Unknown error", 300) }),
    });
    return { ...result, to: settings.recipients };
  }

  async function status() {
    await loadState();
    rollDay();
    const settings = await getSettings();
    return {
      email: { configured: deps.emailConfigured(), from: deps.fromAddress, sentToday: state.count, dailyLimit: settings.dailyLimit },
      log: state.log.slice(0, ALERT_LOG_LIMIT),
    };
  }

  return { notify, getSettings, saveSettings, sendTest, status, flushNow: flush };
}

export type AdminAlerts = ReturnType<typeof createAdminAlerts>;
