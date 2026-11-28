// Wikiverse's server side (shared/wikiFeed.ts has the algorithm; the cards come straight from Wikipedia):
//   GET/PUT /api/wiki/profile          what the feed learned, likes and saves, kept on the account so every device
//                                      shares them (merged with mergeProfiles, newest settings win)
//   GET  /api/wiki/stats?titles=a|b    like, comment and share counts for up to 30 articles
//   POST /api/wiki/react               {title, kind: like|unlike|share}
//   GET  /api/wiki/comments?title=     an article's comments, newest first
//   POST /api/wiki/comments            {title, text}; student accounts can't post (canComment), as in Earshot
//   DELETE /api/wiki/comments/:id      your own comment (or any, for an admin)
//   POST /api/wiki/comments/:id/report hidden from everyone once 3 people report it
// Everything is kept in the settings table: one key per person, one per article's comments, one for all counts.
import { createHash } from "node:crypto";
import type { Express, RequestHandler } from "express";
import { cleanProfile, mergeProfiles, type WikiProfile } from "../shared/wikiFeed";
import { canComment, cleanComment, commentAuthor } from "../shared/earshot";

type Settings = { getSetting(key: string): Promise<string | null | undefined>; upsertSetting(key: string, value: string): Promise<unknown> };
type Counts = Record<string, [number, number, number]>; // title → [likes, comments, shares]
type Comment = { id: string; uid: number; author: string; text: string; at: string; reports: number[] };

const MAX_COUNTED = 20_000;
const titleOf = (v: unknown) => (typeof v === "string" ? v.replace(/[\u0000-\u001F]/g, "").trim().slice(0, 255) : "");
const keyFor = (title: string) => `wiki_comments:${createHash("sha1").update(title).digest("hex").slice(0, 24)}`;
const parse = <T,>(s: string | null | undefined, d: T): T => { try { return s ? (JSON.parse(s) as T) : d; } catch { return d; } };

export function registerWikiRoutes(app: Express, auth: RequestHandler, settings: Settings, now: () => number = Date.now) {
  // One write at a time to a shared key (counts, an article's comments), so two at once don't lose one.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T,>(fn: () => Promise<T>): Promise<T> => { const run = chain.then(fn, fn); chain = run.catch(() => {}); return run; };
  const recent = new Map<number, number[]>();
  const tooFast = (uid: number) => { const t = now(); const list = (recent.get(uid) || []).filter((x) => t - x < 10 * 60_000); if (list.length >= 20) return true; list.push(t); recent.set(uid, list); return false; };
  const bump = (title: string, i: 0 | 1 | 2, by: number) => serial(async () => {
    const counts = parse<Counts>(await settings.getSetting("wiki_counts"), {});
    const c = counts[title] || [0, 0, 0];
    c[i] = Math.max(0, c[i] + by);
    counts[title] = c;
    const keys = Object.keys(counts);
    if (keys.length > MAX_COUNTED) { keys.sort((a, b) => counts[a].reduce((x, y) => x + y, 0) - counts[b].reduce((x, y) => x + y, 0)); for (const k of keys.slice(0, keys.length - MAX_COUNTED)) delete counts[k]; }
    await settings.upsertSetting("wiki_counts", JSON.stringify(counts));
    return c;
  });
  const uid = (req: any) => Number(req.user?.id) || 0;

  app.get("/api/wiki/profile", auth, async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    const saved = await settings.getSetting(`wiki_profile:${uid(req)}`).catch(() => "");
    res.json({ profile: saved ? cleanProfile(parse(saved, null), now()) : null });
  });
  app.put("/api/wiki/profile", auth, async (req: any, res) => {
    const mine = cleanProfile(req.body?.profile, now());
    try {
      const out = await serial(async () => {
        const saved = await settings.getSetting(`wiki_profile:${uid(req)}`);
        const merged: WikiProfile = saved ? mergeProfiles(mine, cleanProfile(parse(saved, null), now())) : mine;
        await settings.upsertSetting(`wiki_profile:${uid(req)}`, JSON.stringify(merged));
        return merged;
      });
      res.json({ profile: out });
    } catch { res.status(503).json({ message: "Couldn't save right now." }); }
  });

  app.get("/api/wiki/stats", auth, async (req: any, res) => {
    const titles = String(req.query?.titles || "").split("|").map(titleOf).filter(Boolean).slice(0, 30);
    const counts = parse<Counts>(await settings.getSetting("wiki_counts").catch(() => ""), {});
    res.json({ stats: Object.fromEntries(titles.map((t) => { const c = counts[t] || [0, 0, 0]; return [t, { likes: c[0], comments: c[1], shares: c[2] }]; })) });
  });
  app.post("/api/wiki/react", auth, async (req: any, res) => {
    const title = titleOf(req.body?.title), kind = req.body?.kind;
    if (!title || !["like", "unlike", "share"].includes(kind)) return res.status(400).json({ message: "Nothing to count." });
    const c = await bump(title, kind === "share" ? 2 : 0, kind === "unlike" ? -1 : 1).catch(() => null);
    res.json({ likes: c?.[0] ?? 0, comments: c?.[1] ?? 0, shares: c?.[2] ?? 0 });
  });

  app.get("/api/wiki/comments", auth, async (req: any, res) => {
    const title = titleOf(req.query?.title);
    if (!title) return res.json({ comments: [] });
    const list = parse<Comment[]>(await settings.getSetting(keyFor(title)).catch(() => ""), []);
    const me = uid(req);
    res.json({
      canPost: canComment(req.user?.role),
      comments: list.filter((c) => c.reports.length < 3 || c.uid === me).slice().reverse().map((c) => ({ id: c.id, author: c.author, text: c.text, at: c.at, mine: c.uid === me })),
    });
  });
  app.post("/api/wiki/comments", auth, async (req: any, res) => {
    if (!canComment(req.user?.role)) return res.status(403).json({ message: "Student accounts can read comments but can't post them." });
    const title = titleOf(req.body?.title), text = cleanComment(req.body?.text);
    if (!title || !text) return res.status(400).json({ message: "Write something first." });
    if (/https?:\/\/|www\./i.test(text)) return res.status(400).json({ message: "Links can't go in comments." });
    if (tooFast(uid(req))) return res.status(429).json({ message: "That's a lot of comments. Try again in a few minutes." });
    const c: Comment = { id: `${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, uid: uid(req), author: commentAuthor(req.user?.displayName || req.user?.display_name), text, at: new Date(now()).toISOString(), reports: [] };
    await serial(async () => {
      const list = parse<Comment[]>(await settings.getSetting(keyFor(title)), []);
      list.push(c);
      await settings.upsertSetting(keyFor(title), JSON.stringify(list.slice(-500)));
    });
    await bump(title, 1, 1).catch(() => null);
    res.json({ comment: { id: c.id, author: c.author, text: c.text, at: c.at, mine: true } });
  });
  app.delete("/api/wiki/comments/:id", auth, async (req: any, res) => {
    const title = titleOf(req.query?.title);
    let gone = false;
    await serial(async () => {
      const list = parse<Comment[]>(await settings.getSetting(keyFor(title)), []);
      const keep = list.filter((c) => !(c.id === req.params.id && (c.uid === uid(req) || req.user?.isAdmin)));
      gone = keep.length < list.length;
      if (gone) await settings.upsertSetting(keyFor(title), JSON.stringify(keep));
    });
    if (gone) await bump(title, 1, -1).catch(() => null);
    res.status(gone ? 200 : 404).json({ ok: gone });
  });
  app.post("/api/wiki/comments/:id/report", auth, async (req: any, res) => {
    const title = titleOf(req.body?.title);
    await serial(async () => {
      const list = parse<Comment[]>(await settings.getSetting(keyFor(title)), []);
      const c = list.find((x) => x.id === req.params.id);
      if (c && c.uid !== uid(req) && !c.reports.includes(uid(req))) { c.reports.push(uid(req)); await settings.upsertSetting(keyFor(title), JSON.stringify(list)); }
    });
    res.json({ ok: true });
  });
}
