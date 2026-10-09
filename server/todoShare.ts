// Arise LifeHub share links. The owner copies a private link to one part of their Family Hub
// (a poll, a list, the calendar, bills, a trip, chores, goals, one person's food & fitness) and
// sends it to family. Whoever has the link can see that part, and vote in a poll, without an account.
// The link shows the owner's LifeHub as it is now (nothing is copied), and stops working when the owner
// turns it off or their LifeHub ends. Guest votes are kept beside the LifeHub, never written into it,
// so a vote can't collide with the owner saving on their phone.
import type { Express, RequestHandler } from "express";
import { randomBytes } from "crypto";
import { createAttemptLimiter, clientAddress, waitWords } from "./attemptLimiter";
import { guestToday, parseTarget, pollOpen, sharedView, targetKey, targetLabel, type GuestVote } from "../shared/todoShare";
import { cleanFamily } from "../shared/familyHub";

type Db = { from: (table: string) => any };
export type TodoShareDeps = {
  db: Db;
  appUrl: string;
  /** Whether the owner still has LifeHub (a link stops working when their LifeHub ends). */
  ownerAllowed: (userId: number) => Promise<boolean>;
  /** The owner's first name, for the page ("Dana shared this with you"). */
  ownerName: (userId: number) => Promise<string>;
  now?: () => number;
};

const SHARES = "todo_shares";
const VOTES = "todo_share_votes";
const WORKSPACES = "arise_todo_workspaces";
export const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
const VOTER = /^[A-Za-z0-9-]{8,64}$/;
export const SHARE_LIMITS = { linksPerOwner: 200, guestsPerPoll: 300 };

const newToken = () => randomBytes(18).toString("base64url");

export function registerTodoShareRoutes(app: Express, authMiddleware: RequestHandler, deps: TodoShareDeps) {
  const now = deps.now ?? Date.now;
  const base = deps.appUrl.replace(/\/+$/, "");
  const linkFor = (token: string) => `${base}/share/${token}`;
  const badLinks = createAttemptLimiter({ max: 40, windowMs: 3600_000, now });
  const views = createAttemptLimiter({ max: 600, windowMs: 3600_000, now });
  const votes = createAttemptLimiter({ max: 60, windowMs: 3600_000, now });
  const made = createAttemptLimiter({ max: 100, windowMs: 3600_000, now });

  const owner = (req: any, res: any): number | null => {
    const id = Number(req.user?.id);
    if (!Number.isSafeInteger(id) || req.adminPreview) {
      res.status(403).json({ message: "Sign in to your own account to share from Arise LifeHub." });
      return null;
    }
    return id;
  };
  const readWorkspace = async (userId: number) => {
    const { data, error } = await deps.db.from(WORKSPACES).select("workspace, updated_at").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data ? { workspace: data.workspace, updatedAt: String(data.updated_at) } : null;
  };
  const guestVotes = async (tokens: string[]): Promise<Map<string, GuestVote[]>> => {
    const out = new Map<string, GuestVote[]>();
    if (!tokens.length) return out;
    const { data, error } = await deps.db.from(VOTES).select("token, voter_key, voter_name, option_id").in("token", tokens);
    if (error) throw error;
    for (const row of data || []) out.set(row.token, [...(out.get(row.token) || []), { voter: row.voter_key, name: row.voter_name, optionId: row.option_id }]);
    return out;
  };

  /* ---------------- the owner's links (behind the LifeHub add-on gate) ---------------- */

  app.get("/api/arise-todo/shares", authMiddleware, async (req: any, res) => {
    const userId = owner(req, res);
    if (userId === null) return;
    res.set("Cache-Control", "no-store");
    try {
      const { data, error } = await deps.db.from(SHARES).select("token, target, created_at, revoked").eq("user_id", userId);
      if (error) throw error;
      const rows = (data || []) as { token: string; target: string; created_at: string; revoked: boolean }[];
      const [saved, name] = await Promise.all([readWorkspace(userId), deps.ownerName(userId)]);
      // Votes from every poll link, even one turned off: those votes were still cast.
      const pollRows = rows.filter((r) => r.target.startsWith("poll:"));
      const byToken = await guestVotes(pollRows.map((r) => r.token));
      const guestVotesByPoll: Record<string, { name: string; optionId: string }[]> = {};
      for (const r of pollRows) {
        const id = r.target.slice(5);
        guestVotesByPoll[id] = [...(guestVotesByPoll[id] || []), ...(byToken.get(r.token) || []).map((v) => ({ name: v.name, optionId: v.optionId }))];
      }
      const shares = rows.filter((r) => !r.revoked).map((r) => {
        const target = parseTarget(r.target);
        return { token: r.token, target: r.target, url: linkFor(r.token), createdAt: r.created_at, label: target ? targetLabel(saved?.workspace, target, name) : r.target };
      }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      res.json({ shares, guestVotes: guestVotesByPoll });
    } catch (error: any) {
      console.error("[todo-share] list failed", error?.message);
      res.status(500).json({ message: "Could not load your shared links. Try again in a moment." });
    }
  });

  app.post("/api/arise-todo/shares", authMiddleware, async (req: any, res) => {
    const userId = owner(req, res);
    if (userId === null) return;
    const target = parseTarget(req.body?.target);
    if (!target) return res.status(400).json({ message: "That can't be shared." });
    const key = targetKey(target);
    const wait = made.retryAfter(String(userId));
    if (wait) return res.status(429).json({ message: `That's a lot of links. Try again in ${waitWords(wait)}.` });
    try {
      const { data, error } = await deps.db.from(SHARES).select("token, target, revoked").eq("user_id", userId);
      if (error) throw error;
      const live = (data || []).filter((r: any) => !r.revoked);
      // One link per thing: copying it again gives the same link, so people already sent it keep it.
      const existing = live.find((r: any) => r.target === key);
      if (existing) return res.json({ token: existing.token, target: key, url: linkFor(existing.token) });
      if (live.length >= SHARE_LIMITS.linksPerOwner) return res.status(409).json({ message: "You have a lot of shared links. Turn some off in Family & settings first." });
      made.fail(String(userId));
      const token = newToken();
      const { error: insertError } = await deps.db.from(SHARES).insert({ token, user_id: userId, target: key, revoked: false, created_at: new Date(now()).toISOString() });
      if (insertError) throw insertError;
      res.json({ token, target: key, url: linkFor(token) });
    } catch (error: any) {
      console.error("[todo-share] create failed", error?.message);
      res.status(500).json({ message: "Could not make a link. Try again in a moment." });
    }
  });

  app.delete("/api/arise-todo/shares/:token", authMiddleware, async (req: any, res) => {
    const userId = owner(req, res);
    if (userId === null) return;
    const token = String(req.params.token || "");
    if (!TOKEN.test(token)) return res.status(400).json({ message: "Unknown link." });
    try {
      const { error } = await deps.db.from(SHARES).update({ revoked: true }).eq("token", token).eq("user_id", userId);
      if (error) throw error;
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[todo-share] revoke failed", error?.message);
      res.status(500).json({ message: "Could not turn that link off. Try again." });
    }
  });

  /* ---------------- the page someone opens from the link (no account) ---------------- */

  /** The address people get. Chat apps read it for a preview, so it's a bare page that moves on. */
  app.get("/share/:token", (req, res) => {
    const token = String(req.params.token || "");
    const to = TOKEN.test(token) ? `/#/share/${token}` : "/";
    res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" });
    res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Shared from Arise LifeHub</title></head><body><script>location.replace(${JSON.stringify(to)});</script><noscript><a href="${to}">Open the shared page</a></noscript></body></html>`);
  });

  /** Finds a working link, or answers for it. */
  async function open(req: any, res: any) {
    const address = clientAddress(req);
    const wait = badLinks.retryAfter(address);
    if (wait) { res.status(429).json({ message: `Too many tries. Try again in ${waitWords(wait)}.` }); return null; }
    const token = String(req.params.token || "");
    const gone = () => { badLinks.fail(address); res.status(404).json({ message: "This link isn't working. It may have been turned off. Ask the person who sent it for a new one." }); return null; };
    if (!TOKEN.test(token)) return gone();
    const { data, error } = await deps.db.from(SHARES).select("token, user_id, target, revoked").eq("token", token).maybeSingle();
    if (error) throw error;
    if (!data || data.revoked) return gone();
    const target = parseTarget(data.target);
    if (!target) return gone();
    const userId = Number(data.user_id);
    if (!(await deps.ownerAllowed(userId).catch(() => true))) {
      res.status(410).json({ message: "This shared page isn't available right now." });
      return null;
    }
    const saved = await readWorkspace(userId);
    return { token, userId, target, workspace: saved?.workspace, updatedAt: saved?.updatedAt || null };
  }

  app.get("/api/todo-share/:token", async (req: any, res) => {
    res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
    const address = clientAddress(req);
    const wait = views.retryAfter(address);
    if (wait) return res.status(429).json({ message: `Too many refreshes. Try again in ${waitWords(wait)}.` });
    views.fail(address);
    try {
      const found = await open(req, res);
      if (!found) return;
      const today = guestToday(req.query?.today, now());
      const name = await deps.ownerName(found.userId).catch(() => "");
      const guests = found.target.kind === "poll" ? (await guestVotes([found.token])).get(found.token) || [] : [];
      const view = sharedView(found.workspace, found.target, today, { ownerName: name, guests });
      if (!view) return res.status(404).json({ message: "What this link shared has been removed." });
      const voter = typeof req.query?.voter === "string" && VOTER.test(req.query.voter) ? req.query.voter : "";
      const mine = voter ? guests.find((g) => g.voter === voter) : undefined;
      res.json({ view, owner: name, today, updatedAt: found.updatedAt, myVote: mine ? { name: mine.name, optionId: mine.optionId } : null });
    } catch (error: any) {
      console.error("[todo-share] open failed", error?.message);
      res.status(500).json({ message: "Could not open this page. Try again in a moment." });
    }
  });

  app.post("/api/todo-share/:token/vote", async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    const address = clientAddress(req);
    const wait = votes.retryAfter(address);
    if (wait) return res.status(429).json({ message: `Too many votes. Try again in ${waitWords(wait)}.` });
    votes.fail(address);
    const voter = String(req.body?.voter || "");
    const name = String(req.body?.name || "").replace(/\s+/g, " ").trim();
    const optionId = String(req.body?.optionId || "");
    if (!VOTER.test(voter)) return res.status(400).json({ message: "Refresh the page and try again." });
    if (name.length < 1 || name.length > 40) return res.status(400).json({ message: "Type your name (up to 40 letters) so the family knows who voted." });
    try {
      const found = await open(req, res);
      if (!found) return;
      const target = found.target;
      if (target.kind !== "poll") return res.status(400).json({ message: "This link isn't a vote." });
      const today = guestToday(req.body?.today, now());
      const poll = cleanFamily((found.workspace as any)?.family).polls.find((p) => p.id === target.id);
      if (!poll) return res.status(404).json({ message: "This vote has been removed." });
      if (!pollOpen(poll, today)) return res.status(409).json({ message: "Voting has closed." });
      if (!poll.options.some((o) => o.id === optionId)) return res.status(400).json({ message: "That choice isn't on the list anymore. Refresh and pick again." });
      const existing = (await guestVotes([found.token])).get(found.token) || [];
      if (!existing.some((v) => v.voter === voter) && existing.length >= SHARE_LIMITS.guestsPerPoll) return res.status(409).json({ message: "This vote is full." });
      const { error } = await deps.db.from(VOTES).upsert(
        { token: found.token, voter_key: voter, voter_name: name, option_id: optionId, updated_at: new Date(now()).toISOString() },
        { onConflict: "token,voter_key" },
      );
      if (error) throw error;
      const view = sharedView(found.workspace, found.target, today, { guests: (await guestVotes([found.token])).get(found.token) || [] });
      res.json({ ok: true, view, myVote: { name, optionId } });
    } catch (error: any) {
      console.error("[todo-share] vote failed", error?.message);
      res.status(500).json({ message: "Could not save your vote. Try again in a moment." });
    }
  });
}
