// Pod+ Clips: one shared list of TikTok videos for the Clips page. Everyone can read it; only the
// site owner (signed in to Pod+ with an owner email) can change it. Kept in podcast_cache.
import type { Express, RequestHandler } from "express";
import { memoryKV, type KV } from "./podcastDirectory";
import { clipIds } from "../shared/podClips";

const KEY = "clips:list";
/** TikTok's own example video, so the page has something to show before any are picked. */
export const SAMPLE_CLIPS = ["6718335390845095173"];

/** Who may change the list: PODSCROLL_OWNERS (comma-separated emails), else ADMIN_NOTIFY_EMAIL. */
export function clipOwners(env: Record<string, string | undefined> = process.env): string[] {
  const list = String(env.PODSCROLL_OWNERS || env.ADMIN_NOTIFY_EMAIL || "jjrobo180@gmail.com").split(",");
  return list.map((x) => x.trim().toLowerCase()).filter((x) => x.includes("@"));
}

export function registerClipsRoutes(app: Express, gate: RequestHandler, opts: { kv?: KV; owners?: string[]; prefix?: string } = {}) {
  const prefix = opts.prefix ?? "/api/podscroll";
  const kv = opts.kv ?? memoryKV();
  const owners = opts.owners ?? clipOwners();
  // Remembered here too, so the page still works if the database is unreachable for a moment.
  let mem: string[] | null = null;
  const isOwner = (req: any) => !!req.creator?.email && owners.includes(String(req.creator.email).toLowerCase());
  const load = async (): Promise<string[]> => {
    if (mem) return mem;
    const d = await kv.get(KEY).catch(() => null);
    const ids = d && Array.isArray(d.value) ? clipIds(d.value) : null;
    if (ids) mem = ids;
    return ids ?? SAMPLE_CLIPS;
  };

  app.get(`${prefix}/clips`, gate, async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ clips: await load(), canEdit: isOwner(req) });
  });

  app.post(`${prefix}/clips`, gate, async (req: any, res) => {
    if (!req.creator) return res.status(401).json({ message: "Sign in to change the clips.", needSignIn: true });
    if (!isOwner(req)) return res.status(403).json({ message: "Only the site owner can change the clips." });
    const ids = clipIds(req.body?.clips);
    mem = ids;
    await kv.set(KEY, ids).catch(() => {});
    res.json({ clips: ids, canEdit: true });
  });
}
