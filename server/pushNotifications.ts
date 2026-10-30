// Notifications for phones and browsers (Web Push): turning them on, and sending
// Arise WorkHub and Arise LifeHub reminders to the devices that asked for them.
// One row per device; `hub` and `todo` say which reminders that device turned on.
import type { Express, RequestHandler } from "express";
import crypto from "node:crypto";
import { snoozeSig } from "./snoozeSig";
import { supabase } from "./supabase";
import { generateVapidKeys, isPushServiceUrl, sendWebPush, type PushMessage, type VapidKeys } from "./webPush";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { dueHubReminders, HUB_REMINDER_URL } from "../shared/hubReminders";
import { normalizeWorkspace } from "../shared/teacherHub";
import { dueTodoReminders, TODO_REMINDER_URL, type TodoReminder } from "../shared/todoReminders";
import { NEWS_TOPICS } from "../shared/todoNews";
import { fetchHeadlines } from "./todoNews";
import { dueNudges } from "../shared/healthNudges";
import { APNS_PREFIX, appleToken, cleanAppleToken, hasApplePush, isAppleDevice, loadAppleKey, sendApplePush } from "./applePush";

type Gate = (req: any, res: any) => Promise<unknown | null>;
type Row = { id: number; user_id: number; endpoint: string; p256dh: string; auth: string; time_zone: string; sent: Record<string, any> | null; hub?: boolean | null; todo?: boolean | null };
export type PushApp = "hub" | "todo";

const MAX_DEVICES_PER_USER = 8;
const KEEP_SENT_MS = 3 * 24 * 3600 * 1000;
const TICK_MS = 60_000;

const DEFAULT_SUBJECT = "mailto:support@arisereader.com";

let cachedKeys: VapidKeys | null = null;

/** The site's push keys: from the environment if set, else the ones saved (and made on first use). */
export async function pushKeys(): Promise<VapidKeys | null> {
  if (cachedKeys) return cachedKeys;
  const subject = process.env.VAPID_SUBJECT || DEFAULT_SUBJECT;
  const envPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  if (envPublic && envPrivate) return (cachedKeys = { publicKey: envPublic, privateKey: envPrivate, subject });
  try {
    const read = async () => (await supabase.from("push_settings").select("public_key, private_key").eq("id", 1).maybeSingle()).data;
    let row = await read();
    if (!row) {
      const fresh = generateVapidKeys();
      await supabase.from("push_settings").upsert({ id: 1, public_key: fresh.publicKey, private_key: fresh.privateKey }, { onConflict: "id", ignoreDuplicates: true });
      row = await read(); // if two servers raced, both use whichever row won
    }
    if (!row) return null;
    return (cachedKeys = { publicKey: row.public_key, privateKey: row.private_key, subject });
  } catch (error: any) {
    console.error("[push] could not load push keys", error?.message);
    return null;
  }
}

/** The Apple push key saved with the push settings (when the server's environment has none). */
const appleKey = () => loadAppleKey(async () => (await supabase.from("push_settings").select("apns_key, apns_key_id, apns_team_id").eq("id", 1).maybeSingle()).data as any);

/** Sends to one saved device; forgets it if the phone says it is gone. Returns whether it was delivered. */
async function deliver(row: Row, message: PushMessage, keys: VapidKeys | null): Promise<boolean> {
  try {
    // The Arise To Duo iPhone app: straight to Apple.
    const result = isAppleDevice(row.endpoint) ? await sendApplePush(appleToken(row.endpoint), message) : !keys ? { ok: false, gone: false } : await sendWebPush({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, message, keys);
    if (result.gone) await supabase.from("push_subscriptions").delete().eq("id", row.id);
    return result.ok;
  } catch (error: any) {
    console.error("[push] send failed", error?.message);
    return false;
  }
}

/** Sends a notification to every device a user turned notifications on for. */
export async function notifyUser(userId: number, message: PushMessage, only?: PushApp): Promise<number> {
  const keys = await pushKeys();
  await appleKey();
  const { data } = await supabase.from("push_subscriptions").select(SUBSCRIPTION_COLUMNS).eq("user_id", userId);
  let delivered = 0;
  for (const row of (data || []) as Row[]) {
    // The iPhone app holds both hubs, so it gets every notification meant for this person.
    if (only && !isAppleDevice(row.endpoint) && !wants(row, only)) continue;
    if (await deliver(row, message, keys)) delivered++;
  }
  return delivered;
}

/** Devices saved before LifeHub reminders existed were all Arise WorkHub devices. */
const wants = (row: Row, app: PushApp) => (app === "hub" ? row.hub !== false : row.todo === true);

const PAGE = 500;
const WORKSPACE_CHUNK = 40;
const SUBSCRIPTION_COLUMNS = "id, user_id, endpoint, p256dh, auth, time_zone, sent, hub, todo";

/** Every saved device, a page at a time (the database hands back at most a thousand rows in one go). */
async function allSubscriptions(): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from("push_subscriptions").select(SUBSCRIPTION_COLUMNS).order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) { console.error("[push] could not list devices", error.message); break; }
    // Scheduled reminders reach the iPhone app as notifications it schedules itself (nativeReminders.ts), so not twice.
    rows.push(...((data || []) as Row[]).filter((r) => !isAppleDevice(r.endpoint)));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** One pass: send the Arise WorkHub reminders that are due. */
export async function sendDueHubReminders(nowMs = Date.now()): Promise<number> {
  const keys = await pushKeys();
  if (!keys) return 0;
  const rows = await allSubscriptions();
  if (!rows.length) return 0;
  const devicesOf = new Map<number, Row[]>();
  for (const row of rows) if (wants(row, "hub")) devicesOf.set(Number(row.user_id), [...(devicesOf.get(Number(row.user_id)) || []), row]);
  const userIds = Array.from(devicesOf.keys());

  let sentCount = 0;
  // A few Hubs at a time: a long list in one request is refused, and every Hub held at once is a lot to keep in memory.
  for (let i = 0; i < userIds.length; i += WORKSPACE_CHUNK) {
    const { data: spaces, error } = await supabase.from("teacher_hub_workspaces").select("teacher_id, workspace").in("teacher_id", userIds.slice(i, i + WORKSPACE_CHUNK));
    if (error) { console.error("[push] could not read Hubs for reminders", error.message); continue; }
    for (const space of spaces || []) {
      const workspace = normalizeWorkspace((space as any).workspace);
      for (const row of devicesOf.get(Number((space as any).teacher_id)) || []) {
        sentCount += await sendTo(row, dueHubReminders(workspace, nowMs, row.time_zone || "UTC", row.sent || {}), nowMs, keys);
      }
    }
  }
  return sentCount;
}

// ─── Snooze ───
// A reminder can be snoozed from the notification's own button (Android, computers) or from the bar
// LifeHub shows when a notification is tapped (iPhone, whose notifications can't have buttons). The
// snooze is kept on every one of the person's devices, in `sent`, as "snz:<reminder key>" →
// { until, title, body, url }, and sendDueSnoozes() sends it again when the time comes.

type Snoozed = { until: number; title: string; body: string; url: string };
const SNOOZE_PREFIX = "snz:";
export const SNOOZE_MIN = 5, SNOOZE_MAX = 24 * 60;

export { snoozeSig };
const sameSig = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const isSnooze = (key: string, value: unknown): value is Snoozed => key.startsWith(SNOOZE_PREFIX) && !!value && typeof value === "object" && typeof (value as any).until === "number";

/** A device's sent marks, with old ones dropped. Snoozes are kept until they have been sent. */
function keptMarks(row: Row, nowMs: number): Record<string, any> {
  const next: Record<string, any> = {};
  for (const [key, at] of Object.entries(row.sent || {})) {
    if (isSnooze(key, at)) { if (at.until > nowMs - KEEP_SENT_MS) next[key] = at; continue; }
    if (nowMs - Number(at) < KEEP_SENT_MS) next[key] = Number(at);
  }
  return next;
}

/** Puts a snooze on every device of a person. Returns when it will come back. */
export async function snoozeReminder(userId: number, reminder: { key: string; title: string; body: string; url: string }, minutes: number, nowMs = Date.now()): Promise<number> {
  const until = nowMs + Math.max(SNOOZE_MIN, Math.min(SNOOZE_MAX, Math.round(minutes))) * 60_000;
  const clean = { until, title: String(reminder.title || "Reminder").slice(0, 160), body: String(reminder.body || "").slice(0, 300), url: /^\/[^\s]{0,300}$/.test(reminder.url) ? reminder.url : "/" };
  const key = String(reminder.key || "").replace(/~s\d+$/, "").slice(0, 200);
  const { data } = await supabase.from("push_subscriptions").select(SUBSCRIPTION_COLUMNS).eq("user_id", userId);
  for (const row of ((data || []) as Row[]).filter((r) => !isAppleDevice(r.endpoint))) {
    const next = keptMarks(row, nowMs);
    next[SNOOZE_PREFIX + key] = clean;
    await supabase.from("push_subscriptions").update({ sent: next }).eq("id", row.id);
  }
  return until;
}

/** One pass: send snoozed reminders whose time has come, and clear them. */
export async function sendDueSnoozes(nowMs = Date.now(), rows?: Row[]): Promise<number> {
  const keys = await pushKeys();
  if (!keys) return 0;
  let count = 0;
  for (const row of rows || (await allSubscriptions())) {
    const due = Object.entries(row.sent || {}).filter(([k, v]) => isSnooze(k, v) && (v as Snoozed).until <= nowMs) as [string, Snoozed][];
    if (!due.length) continue;
    const next = keptMarks(row, nowMs);
    for (const [k] of due) delete next[k];
    row.sent = next;
    await supabase.from("push_subscriptions").update({ sent: next }).eq("id", row.id);
    for (const [k, v] of due) {
      const key = k.slice(SNOOZE_PREFIX.length);
      if (await deliver(row, { title: v.title, body: v.body, url: v.url, tag: key, snooze: { u: Number(row.user_id), key, sig: snoozeSig(keys.privateKey, Number(row.user_id), key) } }, keys)) count++;
    }
  }
  return count;
}

/** Marks reminders as sent on a device, then sends them. Returns how many arrived. */
async function sendTo(row: Row, due: { key: string; title: string; body: string; url: string }[], nowMs: number, keys: VapidKeys): Promise<number> {
  if (!due.length) return 0;
  const next: Record<string, any> = keptMarks(row, nowMs);
  for (const reminder of due) next[reminder.key] = nowMs; // mark first, so a slow phone service can't cause a repeat
  row.sent = next; // a device with Hub and LifeHub reminders keeps both sets of marks
  await supabase.from("push_subscriptions").update({ sent: next, last_used_at: new Date(nowMs).toISOString() }).eq("id", row.id);
  let count = 0;
  for (const reminder of due) {
    const userId = Number(row.user_id);
    if (await deliver(row, { title: reminder.title, body: reminder.body, url: reminder.url, tag: reminder.key, snooze: { u: userId, key: reminder.key, sig: snoozeSig(keys.privateKey, userId, reminder.key) } }, keys)) count++;
  }
  return count;
}

let headlinesFor: (topic: string, place: string) => Promise<{ title: string; source: string }[]> = async (topic, place) =>
  ((await fetchHeadlines(topic === "local" && !place ? "top" : topic, topic === "local" ? place : ""))?.items || []);
/** For tests: where news reminders get their headlines. */
export function setHeadlineSource(source: typeof headlinesFor) { headlinesFor = source; }

/** Fills in news reminders with a current headline. One that can't get a headline is left out
 *  (and not marked sent), so it is tried again on the next pass while its time window is open. */
async function withHeadlines(list: TodoReminder[]): Promise<TodoReminder[]> {
  if (!list.some((r) => r.news)) return list;
  const out: TodoReminder[] = [];
  for (const reminder of list) {
    if (!reminder.news) { out.push(reminder); continue; }
    const items = await headlinesFor(reminder.news.topic, reminder.news.place).catch(() => []);
    const pick = items[reminder.news.index % Math.max(1, items.length)];
    if (!pick) continue;
    const label = NEWS_TOPICS.find((t) => t.id === reminder.news!.topic)?.label || "News";
    out.push({ key: reminder.key, url: reminder.url, title: `📰 ${label}${pick.source ? ` · ${pick.source}` : ""}`, body: pick.title });
  }
  return out;
}

let todoAllowed: (userId: number) => Promise<boolean> = async () => true;

/** One pass: send the Arise LifeHub reminders that are due. */
export async function sendDueTodoReminders(nowMs = Date.now(), rows?: Row[]): Promise<number> {
  const keys = await pushKeys();
  if (!keys) return 0;
  const devicesOf = new Map<number, Row[]>();
  for (const row of rows || (await allSubscriptions())) if (wants(row, "todo")) devicesOf.set(Number(row.user_id), [...(devicesOf.get(Number(row.user_id)) || []), row]);
  const userIds = Array.from(devicesOf.keys());
  let sentCount = 0;
  for (let i = 0; i < userIds.length; i += WORKSPACE_CHUNK) {
    const { data: spaces, error } = await supabase.from("arise_todo_workspaces").select("user_id, workspace").in("user_id", userIds.slice(i, i + WORKSPACE_CHUNK));
    if (error) { console.error("[push] could not read LifeHub lists for reminders", error.message); continue; }
    for (const space of spaces || []) {
      const userId = Number((space as any).user_id);
      const devices = devicesOf.get(userId) || [];
      const due = devices.map((row) => dueTodoReminders((space as any).workspace, nowMs, row.time_zone || "UTC", row.sent || {}));
      if (!due.some((list) => list.length)) continue;
      for (let d = 0; d < due.length; d++) due[d] = await withHeadlines(due[d]);
      // Reminders stop when someone's LifeHub ends (checked only when there is something to send).
      if (!(await todoAllowed(userId).catch(() => true))) continue;
      for (let d = 0; d < devices.length; d++) sentCount += await sendTo(devices[d], due[d], nowMs, keys);
    }
  }
  return sentCount;
}

// ─── Health Nudges (a premium app): motivation sent through the day to the phones of people who turned it on ───

let readNudgeSettings: (userId: number) => Promise<unknown | null> = async () => null;
/** Where Health Nudges settings come from: the user's saved app data (set up in routes.ts; tests pass their own). */
export function setNudgeSource(source: typeof readNudgeSettings) { readNudgeSettings = source; nudgeCache.clear(); }

const NUDGE_CACHE_MS = 10 * 60_000;
const NUDGE_READS_PER_PASS = 60;
const nudgeCache = new Map<number, { at: number; settings: unknown | null }>();

/** One pass: send the Health Nudges that are due. Anyone's phone that has any Arise reminders on can get them;
 *  settings are read at most every ten minutes per person, and only a limited number of people per pass. */
export async function sendDueNudges(nowMs = Date.now(), rows?: Row[]): Promise<number> {
  const keys = await pushKeys();
  if (!keys) return 0;
  const devicesOf = new Map<number, Row[]>();
  for (const row of rows || (await allSubscriptions())) devicesOf.set(Number(row.user_id), [...(devicesOf.get(Number(row.user_id)) || []), row]);
  let reads = 0, sentCount = 0;
  for (const [userId, devices] of Array.from(devicesOf)) {
    let entry = nudgeCache.get(userId);
    if (!entry || nowMs - entry.at >= NUDGE_CACHE_MS) {
      if (reads >= NUDGE_READS_PER_PASS) continue; // the rest wait for the next minute
      reads++;
      try { entry = { at: nowMs, settings: await readNudgeSettings(userId) }; }
      catch { continue; } // storage hiccup: try again next pass instead of caching "no settings"
      nudgeCache.set(userId, entry);
    }
    if (!entry.settings) continue;
    for (const row of devices) sentCount += await sendTo(row, dueNudges(entry.settings, nowMs, row.time_zone || "UTC", row.sent || {}), nowMs, keys);
  }
  if (nudgeCache.size > 20_000) nudgeCache.clear();
  return sentCount;
}

let ticking = false;
export function startHubReminderTicker() {
  const timer = setInterval(async () => {
    if (ticking) return;
    ticking = true;
    const now = Date.now();
    try { await sendDueHubReminders(now); } catch (error: any) { console.error("[push] reminder pass failed", error?.message); }
    try { await sendDueTodoReminders(now); } catch (error: any) { console.error("[push] LifeHub reminder pass failed", error?.message); }
    try { await sendDueNudges(now); } catch (error: any) { console.error("[push] Health Nudges pass failed", error?.message); }
    try { await sendDueSnoozes(now); } catch (error: any) { console.error("[push] snooze pass failed", error?.message); }
    finally { ticking = false; }
  }, TICK_MS);
  timer.unref?.();
}

function cleanSubscription(body: any): { endpoint: string; p256dh: string; auth: string } | null {
  const endpoint = String(body?.subscription?.endpoint || "");
  const p256dh = String(body?.subscription?.keys?.p256dh || "");
  const auth = String(body?.subscription?.keys?.auth || "");
  if (!/^https:\/\//i.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint, p256dh, auth };
}

function cleanZone(value: unknown): string {
  const zone = String(value || "");
  try { new Intl.DateTimeFormat("en", { timeZone: zone }); return zone; } catch { return "UTC"; }
}

/** Turns one app's reminders on for a device. A device that moves to a different account starts fresh. */
async function saveDevice(userId: number, sub: { endpoint: string; p256dh: string; auth: string }, timeZone: string, app: PushApp | "pro") {
  const mine = await supabase.from("push_subscriptions").select("id, endpoint").eq("user_id", userId).order("id", { ascending: true });
  const others = (mine.data || []).filter((r: any) => r.endpoint !== sub.endpoint);
  if (others.length >= MAX_DEVICES_PER_USER) {
    await supabase.from("push_subscriptions").delete().in("id", others.slice(0, others.length - MAX_DEVICES_PER_USER + 1).map((r: any) => r.id));
  }
  const { data: existing } = await supabase.from("push_subscriptions").select("id, user_id").eq("endpoint", sub.endpoint).maybeSingle();
  if (existing && Number(existing.user_id) === userId) {
    // A phone signed up for a premium app's notifications keeps whichever Hub or LifeHub reminders it already had.
    const { error } = await supabase.from("push_subscriptions").update({ p256dh: sub.p256dh, auth: sub.auth, time_zone: timeZone, ...(app === "pro" ? {} : { [app]: true }) }).eq("id", existing.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, time_zone: timeZone, sent: {}, hub: app === "hub", todo: app === "todo" }, // a premium app's phone gets neither Hub nor LifeHub reminders
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

/** Turns one app's reminders off for a device (or every reminder, when no app is named, as on signing out). */
async function forgetDevice(userId: number, endpoint: string, app?: PushApp): Promise<boolean> {
  if (!app) {
    await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
    return false;
  }
  const { data } = await supabase.from("push_subscriptions").select(SUBSCRIPTION_COLUMNS).eq("user_id", userId).eq("endpoint", endpoint).maybeSingle();
  if (!data) return false;
  const row = data as Row;
  const left = app === "hub" ? wants(row, "todo") : wants(row, "hub");
  if (!left) await supabase.from("push_subscriptions").delete().eq("id", row.id);
  else await supabase.from("push_subscriptions").update({ [app]: false }).eq("id", row.id);
  return left;
}

/** Saves a phone for a premium app's notifications (the potty timer). It gets no Hub or LifeHub reminders from this. */
export async function registerProDevice(userId: number, body: any): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const sub = cleanSubscription(body);
  if (!sub) return { ok: false, status: 400, message: "That phone's notification details look wrong. Try turning notifications on again." };
  if (!isPushServiceUrl(sub.endpoint)) return { ok: false, status: 400, message: "This browser's notification service isn't supported here. Try Chrome, Safari or Firefox." };
  try { await saveDevice(userId, sub, cleanZone(body?.timeZone), "pro"); return { ok: true }; }
  catch (error: any) { console.error("[push] pro subscribe failed", error?.message); return { ok: false, status: 500, message: "Could not turn notifications on. Try again in a moment." }; }
}

export function registerPushRoutes(app: Express, authMiddleware: RequestHandler, deps: { hubGate: Gate; todoAllowed?: (userId: number) => Promise<boolean> }) {
  if (deps.todoAllowed) todoAllowed = deps.todoAllowed;
  startHubReminderTicker();
  // "Send a test" goes to every phone signed up; a few a quarter-hour is plenty.
  const testSends = createAttemptLimiter({ max: 5, windowMs: 15 * 60_000 });

  // The Arise To Duo iPhone app's Apple device token. It gets the same notifications as a phone with
  // Web Push (messages, shares, tests), never the scheduled reminders (the app schedules those itself).
  void appleKey();
  app.get("/api/push/apple/config", async (_req, res) => { await appleKey(); res.json({ enabled: hasApplePush() }); });
  app.post("/api/push/apple", authMiddleware, async (req: any, res) => {
    const token = cleanAppleToken(req.body?.token);
    if (!token) return res.status(400).json({ message: "That iPhone's notification details look wrong." });
    if (req.adminPreview || !Number.isSafeInteger(Number(req.user?.id))) return res.status(403).json({ message: "Sign in to your own account." });
    try { await saveDevice(Number(req.user.id), { endpoint: APNS_PREFIX + token, p256dh: "apns", auth: "apns" }, cleanZone(req.body?.timeZone), "pro"); res.json({ ok: true, enabled: hasApplePush() }); }
    catch (error: any) { console.error("[push] apple register failed", error?.message); res.status(500).json({ message: "Could not turn notifications on. Try again in a moment." }); }
  });
  app.post("/api/push/apple/forget", authMiddleware, async (req: any, res) => {
    const token = cleanAppleToken(req.body?.token);
    if (token) await forgetDevice(Number(req.user.id), APNS_PREFIX + token);
    res.json({ ok: true });
  });

  app.get("/api/push/config", async (_req, res) => {
    const keys = await pushKeys();
    res.json({ enabled: !!keys, publicKey: keys?.publicKey || null });
  });

  const subscribe = (which: PushApp) => async (req: any, res: any) => {
    const sub = cleanSubscription(req.body);
    if (!sub) return res.status(400).json({ message: "That phone's notification details look wrong. Try turning notifications on again." });
    if (!isPushServiceUrl(sub.endpoint)) return res.status(400).json({ message: "This browser's notification service isn't supported here. Try Chrome, Safari or Firefox." });
    try {
      await saveDevice(Number(req.user.id), sub, cleanZone(req.body?.timeZone), which);
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[push] subscribe failed", error?.message);
      res.status(500).json({ message: "Could not turn notifications on. Try again in a moment." });
    }
  };
  const unsubscribe = (which?: PushApp) => async (req: any, res: any) => {
    const endpoint = String(req.body?.endpoint || "");
    if (!endpoint) return res.status(400).json({ message: "Missing device" });
    const named = req.body?.app === "hub" || req.body?.app === "todo" ? (req.body.app as PushApp) : undefined;
    // `stillUsed`: the device still gets the other app's reminders, so the browser should stay signed up.
    const stillUsed = await forgetDevice(Number(req.user.id), endpoint, which || named);
    res.json({ ok: true, stillUsed });
  };
  const sendTest = (which: PushApp) => async (req: any, res: any) => {
    const who = String(req.user.id);
    const wait = testSends.retryAfter(who);
    if (wait) return res.status(429).json({ message: `That's a lot of tests. Try again in ${waitWords(wait)}.` });
    testSends.fail(who);
    const delivered = await notifyUser(Number(req.user.id), which === "hub"
      ? { title: "Notifications are on", body: "You'll get reminders from your Arise WorkHub here.", url: HUB_REMINDER_URL, tag: "test" }
      : { title: "Notifications are on", body: "You'll get reminders from Arise LifeHub here.", url: TODO_REMINDER_URL, tag: "todo-test" }, which);
    if (!delivered) return res.status(409).json({ message: "No phone is signed up yet. Turn notifications on first." });
    res.json({ ok: true, delivered });
  };

  // Arise WorkHub reminders are part of the Hub, so only Hub teachers can turn them on.
  app.post("/api/push/subscribe", authMiddleware, async (req: any, res) => {
    if (!(await deps.hubGate(req, res))) return;
    return subscribe("hub")(req, res);
  });
  // Without an app named (signing out), every reminder on this device stops.
  app.post("/api/push/unsubscribe", authMiddleware, unsubscribe());
  app.post("/api/push/test", authMiddleware, sendTest("hub"));
  // Which reminders this device gets, so each page shows its own switch correctly.
  app.post("/api/push/status", authMiddleware, async (req: any, res) => {
    const endpoint = String(req.body?.endpoint || "");
    if (!endpoint) return res.json({ hub: false, todo: false });
    const { data } = await supabase.from("push_subscriptions").select(SUBSCRIPTION_COLUMNS).eq("user_id", Number(req.user.id)).eq("endpoint", endpoint).maybeSingle();
    // `device`: this phone is signed up for something (the potty timer uses it).
    res.json(data ? { hub: wants(data as Row, "hub"), todo: wants(data as Row, "todo"), device: true } : { hub: false, todo: false, device: false });
  });

  // Arise LifeHub reminders sit behind the LifeHub add-on gate (everything under /api/arise-todo).
  const realAccount = (req: any, res: any, next: any) => {
    if (req.adminPreview || !Number.isSafeInteger(Number(req.user?.id))) return res.status(403).json({ message: "Sign in to your own account to turn on reminders." });
    next();
  };
  // Snooze: from a notification's own button (signed, no sign-in needed: the service worker has no
  // session), or from the app's snooze bar (signed in).
  const snoozeLimit = createAttemptLimiter({ max: 120, windowMs: 60 * 60_000 });
  const readSnooze = (body: any) => ({ key: String(body?.key || "").slice(0, 200), title: String(body?.title || ""), body: String(body?.body || ""), url: String(body?.url || "/"), minutes: Number(body?.minutes) });
  app.post("/api/push/snooze", async (req: any, res) => {
    const userId = Number(req.body?.u), sig = String(req.body?.sig || "");
    const r = readSnooze(req.body);
    const keys = await pushKeys();
    if (!keys || !Number.isInteger(userId) || userId < 1 || !r.key || !sig || !sameSig(sig, snoozeSig(keys.privateKey, userId, r.key))) return res.status(403).json({ message: "That snooze link isn't valid." });
    if (snoozeLimit.retryAfter(String(userId)) > 0) return res.status(429).json({ message: "Too many snoozes. Try again later." });
    snoozeLimit.fail(String(userId));
    if (!Number.isFinite(r.minutes)) return res.status(400).json({ message: "Pick how long to snooze." });
    res.json({ until: await snoozeReminder(userId, r, r.minutes) });
  });
  app.post("/api/arise-todo/push/snooze", authMiddleware, realAccount, async (req: any, res) => {
    const r = readSnooze(req.body);
    if (!r.key || !Number.isFinite(r.minutes)) return res.status(400).json({ message: "Pick how long to snooze." });
    res.json({ until: await snoozeReminder(Number(req.user.id), r, r.minutes) });
  });
  app.post("/api/arise-todo/push/subscribe", authMiddleware, realAccount, subscribe("todo"));
  app.post("/api/arise-todo/push/unsubscribe", authMiddleware, realAccount, unsubscribe("todo"));
  app.post("/api/arise-todo/push/test", authMiddleware, realAccount, sendTest("todo"));
}
