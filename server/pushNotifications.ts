// Notifications for phones and browsers (Web Push): turning them on, and sending
// Teacher Hub reminders to the devices that asked for them.
import type { Express, RequestHandler } from "express";
import { supabase } from "./supabase";
import { generateVapidKeys, sendWebPush, type PushMessage, type VapidKeys } from "./webPush";
import { dueHubReminders, HUB_REMINDER_URL } from "../shared/hubReminders";
import { normalizeWorkspace } from "../shared/teacherHub";

type Gate = (req: any, res: any) => Promise<unknown | null>;
type Row = { id: number; user_id: number; endpoint: string; p256dh: string; auth: string; time_zone: string; sent: Record<string, number> | null };

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
export async function notifyUser(userId: number, message: PushMessage): Promise<number> {
  const keys = await pushKeys();
  if (!keys) return 0;
  const { data } = await supabase.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth, time_zone, sent").eq("user_id", userId);
  let delivered = 0;
  for (const row of (data || []) as Row[]) if (await deliver(row, message, keys)) delivered++;
  return delivered;
}

/** One pass: send the Teacher Hub reminders that are due. */
export async function sendDueHubReminders(nowMs = Date.now()): Promise<number> {
  const keys = await pushKeys();
  if (!keys) return 0;
  const { data: subs, error } = await supabase.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth, time_zone, sent");
  if (error || !subs?.length) return 0;
  const rows = subs as Row[];
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: spaces } = await supabase.from("teacher_hub_workspaces").select("teacher_id, workspace").in("teacher_id", userIds);
  const byUser = new Map<number, any>((spaces || []).map((s: any) => [Number(s.teacher_id), normalizeWorkspace(s.workspace)]));

  let sentCount = 0;
  for (const row of rows) {
    const workspace = byUser.get(Number(row.user_id));
    if (!workspace) continue;
    const sent = row.sent || {};
    const due = dueHubReminders(workspace, nowMs, row.time_zone || "UTC", sent);
    if (!due.length) continue;
    const next: Record<string, number> = {};
    for (const [key, at] of Object.entries(sent)) if (nowMs - Number(at) < KEEP_SENT_MS) next[key] = Number(at);
    for (const reminder of due) {
      next[reminder.key] = nowMs; // mark first, so a slow phone service can't cause a repeat
    }
    await supabase.from("push_subscriptions").update({ sent: next, last_used_at: new Date(nowMs).toISOString() }).eq("id", row.id);
    for (const reminder of due) {
      if (await deliver(row, { title: reminder.title, body: reminder.body, url: reminder.url, tag: reminder.key }, keys)) sentCount++;
    }
  }
  return sentCount;
}

let ticking = false;
export function startHubReminderTicker() {
  const timer = setInterval(async () => {
    if (ticking) return;
    ticking = true;
    try { await sendDueHubReminders(); } catch (error: any) { console.error("[push] reminder pass failed", error?.message); }
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

export function registerPushRoutes(app: Express, authMiddleware: RequestHandler, deps: { hubGate: Gate }) {
  startHubReminderTicker();

  app.get("/api/push/config", async (_req, res) => {
    const keys = await pushKeys();
    res.json({ enabled: !!keys, publicKey: keys?.publicKey || null });
  });

  // Teacher Hub reminders are part of the Hub, so only Hub teachers can turn them on.
  app.post("/api/push/subscribe", authMiddleware, async (req: any, res) => {
    if (!(await deps.hubGate(req, res))) return;
    const sub = cleanSubscription(req.body);
    if (!sub) return res.status(400).json({ message: "That phone's notification details look wrong. Try turning notifications on again." });
    try {
      const mine = await supabase.from("push_subscriptions").select("id, endpoint").eq("user_id", Number(req.user.id)).order("id", { ascending: true });
      const others = (mine.data || []).filter((r: any) => r.endpoint !== sub.endpoint);
      if (others.length >= MAX_DEVICES_PER_USER) {
        await supabase.from("push_subscriptions").delete().in("id", others.slice(0, others.length - MAX_DEVICES_PER_USER + 1).map((r: any) => r.id));
      }
      const { error } = await supabase.from("push_subscriptions").upsert(
        { user_id: Number(req.user.id), endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, time_zone: cleanZone(req.body?.timeZone) },
        { onConflict: "endpoint" },
      );
      if (error) throw error;
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[push] subscribe failed", error?.message);
      res.status(500).json({ message: "Could not turn notifications on. Try again in a moment." });
    }
  });

  app.post("/api/push/unsubscribe", authMiddleware, async (req: any, res) => {
    const endpoint = String(req.body?.endpoint || "");
    if (!endpoint) return res.status(400).json({ message: "Missing device" });
    await supabase.from("push_subscriptions").delete().eq("user_id", Number(req.user.id)).eq("endpoint", endpoint);
    res.json({ ok: true });
  });

  app.post("/api/push/test", authMiddleware, async (req: any, res) => {
    const delivered = await notifyUser(Number(req.user.id), {
      title: "Notifications are on",
      body: "You'll get reminders from your Teacher Hub here.",
      url: HUB_REMINDER_URL,
      tag: "test",
    });
    if (!delivered) return res.status(409).json({ message: "No phone is signed up yet. Turn notifications on first." });
    res.json({ ok: true, delivered });
  });
}
