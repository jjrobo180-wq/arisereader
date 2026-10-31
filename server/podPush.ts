// Pod+ notifications on iPhone: "New episode" when a show you follow puts one out.
// Listening needs no account, and what someone follows is kept on their phone, so the Pod+ app hands
// the server its Apple device token together with the ids of the shows it follows (and again
// whenever that list changes). Every half hour the server looks at each followed show's newest
// episode (the same Apple lookup the app uses, cached) and tells the phones following it.
//
// Kept gentle: nothing the first time a show is seen (that only notes its newest episode), nothing
// between 9 pm and 8 am on the phone's clock (it waits until morning), and at most 4 a day.
// Table: public.podplus_push (one row per phone).
import type { Express, RequestHandler } from "express";
import { cleanAppleToken, sendApplePush, type AppleMessage } from "./applePush";

export const PODPLUS_TOPIC = "com.arisereader.podplus";
const MAX_FOLLOWS = 300;
const PER_DAY = 4;
const SHOW_ID = /^\d{3,15}$/;

export type PodPushRow = { token: string; follows: string[]; seen: Record<string, string>; time_zone: string; sent_day: string; sent_count: number };
export type PodPushDeps = {
  /** public.podplus_push, or an in-memory stand-in for tests. */
  db: {
    save(row: { token: string; follows: string[]; time_zone: string }): Promise<void>;
    forget(token: string): Promise<void>;
    all(): Promise<PodPushRow[]>;
    update(token: string, patch: Partial<PodPushRow>): Promise<void>;
  };
  /** The newest episode of a show (from the podcast directory). */
  newest(showId: string): Promise<{ show: string; episodeId: string; title: string } | null>;
  send?: (token: string, m: AppleMessage) => Promise<{ ok: boolean; gone: boolean }>;
  /** The server is free to call Apple (nobody is waiting on it). */
  idle?: () => boolean;
  /** Loads the APNs key (saved in the database) before sending. */
  loadKey?: () => Promise<void>;
};

const cleanZone = (z: unknown) => { const s = String(z || ""); try { Intl.DateTimeFormat("en-US", { timeZone: s }); return s; } catch { return "UTC"; } };
/** The phone's own date and hour. */
function local(zone: string, now: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now).map((p) => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}
export const quietHour = (hour: number) => hour >= 21 || hour < 8;

/** One pass: every followed show once, then each phone's new episodes. Returns how many were sent. */
export async function runPodPush(deps: PodPushDeps, now = new Date()): Promise<number> {
  const send = deps.send ?? ((t, m) => sendApplePush(t, m, PODPLUS_TOPIC));
  await deps.loadKey?.().catch(() => {});
  const rows = await deps.db.all();
  if (!rows.length) return 0;
  const shows = [...new Set(rows.flatMap((r) => r.follows))];
  const latest = new Map<string, { show: string; episodeId: string; title: string }>();
  for (const id of shows) {
    if (deps.idle && !deps.idle()) await new Promise((r) => setTimeout(r, 2_000));
    try { const n = await deps.newest(id); if (n) latest.set(id, n); } catch { /* tried next time */ }
  }
  let sent = 0;
  for (const row of rows) {
    const zone = cleanZone(row.time_zone);
    const { day, hour } = local(zone, now);
    let count = row.sent_day === day ? row.sent_count : 0;
    const seen = { ...row.seen };
    let changed = false, gone = false;
    for (const id of row.follows) {
      const n = latest.get(id);
      if (!n) continue;
      if (!seen[id]) { seen[id] = n.episodeId; changed = true; continue; } // first look: only remember it
      if (seen[id] === n.episodeId) continue;
      if (quietHour(hour) || count >= PER_DAY) continue; // it waits for a better time
      const r = await send(row.token, { title: n.show, body: `New episode: ${n.title}`.slice(0, 300), url: `?s=${id}&e=${n.episodeId}`, tag: `pod-${id}` });
      if (r.gone) { await deps.db.forget(row.token); gone = true; break; } // the app was deleted from that phone
      if (r.ok) { sent++; count++; }
      seen[id] = n.episodeId; changed = true;
    }
    if (gone) continue;
    // Shows no longer followed drop out of what's remembered.
    for (const id of Object.keys(seen)) if (!row.follows.includes(id)) { delete seen[id]; changed = true; }
    if (changed || count !== row.sent_count || day !== row.sent_day) await deps.db.update(row.token, { seen, sent_day: day, sent_count: count });
  }
  return sent;
}

export function supabasePodPushDb(getDb: () => any): PodPushDeps["db"] {
  const t = () => getDb().from("podplus_push");
  return {
    async save(row) {
      const { error } = await t().upsert({ token: row.token, follows: row.follows, time_zone: row.time_zone, updated_at: new Date().toISOString() }, { onConflict: "token" });
      if (error) throw error;
    },
    async forget(token) { await t().delete().eq("token", token); },
    async all() {
      const out: PodPushRow[] = [];
      for (let from = 0; ; from += 500) {
        const { data, error } = await t().select("token, follows, seen, time_zone, sent_day, sent_count").order("token").range(from, from + 499);
        if (error) throw error;
        out.push(...((data || []) as any[]).map((r) => ({ token: r.token, follows: r.follows || [], seen: r.seen || {}, time_zone: r.time_zone || "UTC", sent_day: r.sent_day || "", sent_count: Number(r.sent_count || 0) })));
        if (!data || data.length < 500) break;
      }
      return out;
    },
    async update(token, patch) { await t().update(patch).eq("token", token); },
  };
}

/** POST /api/podscroll/push (the phone's token and the shows it follows) and /push/forget. */
export function registerPodPushRoutes(app: Express, gate: RequestHandler, deps: PodPushDeps, opts: { ticker?: boolean } = {}) {
  app.post("/api/podscroll/push", gate, async (req: any, res) => {
    const token = cleanAppleToken(req.body?.token);
    if (!token) return res.status(400).json({ message: "That iPhone's notification details look wrong." });
    const follows = [...new Set((Array.isArray(req.body?.follows) ? req.body.follows : []).map(String).filter((id: string) => SHOW_ID.test(id)))].slice(0, MAX_FOLLOWS) as string[];
    try { await deps.db.save({ token, follows, time_zone: cleanZone(req.body?.timeZone) }); res.json({ ok: true }); }
    catch (e: any) { console.error("[podplus push] save failed", e?.message); res.status(500).json({ message: "Couldn't turn notifications on. Try again in a moment." }); }
  });
  app.post("/api/podscroll/push/forget", gate, async (req: any, res) => {
    const token = cleanAppleToken(req.body?.token);
    if (token) await deps.db.forget(token).catch(() => {});
    res.json({ ok: true });
  });
  if (opts.ticker) {
    let running = false;
    const tick = () => { if (running) return; running = true; runPodPush(deps).then((n) => { if (n) console.log(`[podplus push] sent ${n}`); }, (e) => console.error("[podplus push]", e?.message)).finally(() => { running = false; }); };
    setTimeout(tick, 90_000).unref?.();
    setInterval(tick, 30 * 60_000).unref?.();
  }
}
