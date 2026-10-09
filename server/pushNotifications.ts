// Notifications for phones and browsers (Web Push): turning them on, and sending
// Teacher Hub and A.R.I.S.E. To-Do reminders to the devices that asked for them.
// One row per device; `hub` and `todo` say which reminders that device turned on.
import type { Express, RequestHandler } from "express";
import { supabase } from "./supabase";
import { generateVapidKeys, isPushServiceUrl, sendWebPush, type PushMessage, type VapidKeys } from "./webPush";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { dueHubReminders, HUB_REMINDER_URL } from "../shared/hubReminders";
import { normalizeWorkspace } from "../shared/teacherHub";
import { dueTodoReminders, TODO_REMINDER_URL } from "../shared/todoReminders";

type Gate = (req: any, res: any) => Promise<unknown | null>;
type Row = { id: number; user_id: number; endpoint: string; p256dh: string; auth: string; time_zone: string; sent: Record<string, number> | null; hub?: boolean | null; todo?: boolean | null };
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

/** Sends to one saved device; forgets it if the phone says it is gone. Returns whether it was delivered. */
async function deliver(row: Row, message: PushMessage, keys: VapidKeys): Promise<boolean> {
  try {
    const result = await sendWebPush({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, message, keys);
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
  if (!keys) return 0;
  const { data } = await supabase.from("push_subscriptions").select(SUBSCRIPTION_COLUMNS).eq("user_id", userId);
  let delivered = 0;
  for (const row of (data || []) as Row[]) {
    if (only && !wants(row, only)) continue;
    if (await deliver(row, message, keys)) delivered++;
  }
  return delivered;
}

/** Devices saved before To-Do reminders existed were all Teacher Hub devices. */
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
    rows.push(...((data || []) as Row[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** One pass: send the Teacher Hub reminders that are due. */
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

/** Marks reminders as sent on a device, then sends them. Returns how many arrived. */
async function sendTo(row: Row, due: { key: string; title: string; body: string; url: string }[], nowMs: number, keys: VapidKeys): Promise<number> {
  if (!due.length) return 0;
  const next: Record<string, number> = {};
  for (const [key, at] of Object.entries(row.sent || {})) if (nowMs - Number(at) < KEEP_SENT_MS) next[key] = Number(at);
  for (const reminder of due) next[reminder.key] = nowMs; // mark first, so a slow phone service can't cause a repeat
  row.sent = next; // a device with Hub and To-Do reminders keeps both sets of marks
  await supabase.from("push_subscriptions").update({ sent: next, last_used_at: new Date(nowMs).toISOString() }).eq("id", row.id);
  let count = 0;
  for (const reminder of due) {
    if (await deliver(row, { title: reminder.title, body: reminder.body, url: reminder.url, tag: reminder.key }, keys)) count++;
  }
  return count;
}

let todoAllowed: (userId: number) => Promise<boolean> = async () => true;

/** One pass: send the A.R.I.S.E. To-Do reminders that are due. */
export async function sendDueTodoReminders(nowMs = Date.now(), rows?: Row[]): Promise<number> {
  const keys = await pushKeys();
  if (!keys) return 0;
  const devicesOf = new Map<number, Row[]>();
  for (const row of rows || (await allSubscriptions())) if (wants(row, "todo")) devicesOf.set(Number(row.user_id), [...(devicesOf.get(Number(row.user_id)) || []), row]);
  const userIds = Array.from(devicesOf.keys());
  let sentCount = 0;
  for (let i = 0; i < userIds.length; i += WORKSPACE_CHUNK) {
    const { data: spaces, error } = await supabase.from("arise_todo_workspaces").select("user_id, workspace").in("user_id", userIds.slice(i, i + WORKSPACE_CHUNK));
    if (error) { console.error("[push] could not read To-Do lists for reminders", error.message); continue; }
    for (const space of spaces || []) {
      const userId = Number((space as any).user_id);
      const devices = devicesOf.get(userId) || [];
      const due = devices.map((row) => dueTodoReminders((space as any).workspace, nowMs, row.time_zone || "UTC", row.sent || {}));
      if (!due.some((list) => list.length)) continue;
      // Reminders stop when someone's To-Do ends (checked only when there is something to send).
      if (!(await todoAllowed(userId).catch(() => true))) continue;
      for (let d = 0; d < devices.length; d++) sentCount += await sendTo(devices[d], due[d], nowMs, keys);
    }
  }
  return sentCount;
}

let ticking = false;
export function startHubReminderTicker() {
  const timer = setInterval(async () => {
    if (ticking) return;
    ticking = true;
    const now = Date.now();
    try { await sendDueHubReminders(now); } catch (error: any) { console.error("[push] reminder pass failed", error?.message); }
    try { await sendDueTodoReminders(now); } catch (error: any) { console.error("[push] To-Do reminder pass failed", error?.message); }
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
async function saveDevice(userId: number, sub: { endpoint: string; p256dh: string; auth: string }, timeZone: string, app: PushApp) {
  const mine = await supabase.from("push_subscriptions").select("id, endpoint").eq("user_id", userId).order("id", { ascending: true });
  const others = (mine.data || []).filter((r: any) => r.endpoint !== sub.endpoint);
  if (others.length >= MAX_DEVICES_PER_USER) {
    await supabase.from("push_subscriptions").delete().in("id", others.slice(0, others.length - MAX_DEVICES_PER_USER + 1).map((r: any) => r.id));
  }
  const { data: existing } = await supabase.from("push_subscriptions").select("id, user_id").eq("endpoint", sub.endpoint).maybeSingle();
  if (existing && Number(existing.user_id) === userId) {
    const { error } = await supabase.from("push_subscriptions").update({ p256dh: sub.p256dh, auth: sub.auth, time_zone: timeZone, [app]: true }).eq("id", existing.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, time_zone: timeZone, sent: {}, hub: app === "hub", todo: app === "todo" },
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

export function registerPushRoutes(app: Express, authMiddleware: RequestHandler, deps: { hubGate: Gate; todoAllowed?: (userId: number) => Promise<boolean> }) {
  if (deps.todoAllowed) todoAllowed = deps.todoAllowed;
  startHubReminderTicker();
  // "Send a test" goes to every phone signed up; a few a quarter-hour is plenty.
  const testSends = createAttemptLimiter({ max: 5, windowMs: 15 * 60_000 });

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
      ? { title: "Notifications are on", body: "You'll get reminders from your Teacher Hub here.", url: HUB_REMINDER_URL, tag: "test" }
      : { title: "Notifications are on", body: "You'll get reminders from A.R.I.S.E. To-Do here.", url: TODO_REMINDER_URL, tag: "todo-test" }, which);
    if (!delivered) return res.status(409).json({ message: "No phone is signed up yet. Turn notifications on first." });
    res.json({ ok: true, delivered });
  };

  // Teacher Hub reminders are part of the Hub, so only Hub teachers can turn them on.
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
    res.json(data ? { hub: wants(data as Row, "hub"), todo: wants(data as Row, "todo") } : { hub: false, todo: false });
  });

  // A.R.I.S.E. To-Do reminders sit behind the To-Do add-on gate (everything under /api/arise-todo).
  const realAccount = (req: any, res: any, next: any) => {
    if (req.adminPreview || !Number.isSafeInteger(Number(req.user?.id))) return res.status(403).json({ message: "Sign in to your own account to turn on reminders." });
    next();
  };
  app.post("/api/arise-todo/push/subscribe", authMiddleware, realAccount, subscribe("todo"));
  app.post("/api/arise-todo/push/unsubscribe", authMiddleware, realAccount, unsubscribe("todo"));
  app.post("/api/arise-todo/push/test", authMiddleware, realAccount, sendTest("todo"));
}
