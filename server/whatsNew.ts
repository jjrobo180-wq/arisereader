/**
 * Shared public changelog/blog for A.R.I.S.E. Reader and Arise To Duo.
 * Both hostnames reach this same server and persisted settings row. Never accept
 * an admin flag, author or user ID from a request body: the session decides.
 */
import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { storage } from "./storage";

const KEY = "arise_whats_new_posts_v1";
type Kind = "new" | "upcoming";
type Status = "draft" | "published";
type Post = {
  id: string; title: string; summary: string; body: string;
  kind: Kind; status: Status; featured: boolean;
  imageUrl: string; linkUrl: string;
  createdAt: string; updatedAt: string; publishedAt: string | null;
};

function optionalUrl(input: unknown, image = false): string {
  if (input == null || input === "") return "";
  if (typeof input !== "string" || input.length > 2048) throw new Error("Invalid link URL.");
  const value = input.trim();
  if (!value) return "";
  if (!image && /^\/(?!\/)[a-zA-Z0-9/_#?=&.%+~-]*$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || (!image && url.protocol === "http:")) return url.toString();
  } catch {}
  throw new Error(image ? "Cover image must use an HTTPS URL." : "Use a valid HTTPS link or site path.");
}
function parsePost(input: any, previous?: Post): Post {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid post.");
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const summary = typeof input.summary === "string" ? input.summary.trim() : "";
  if (!title || title.length > 160) throw new Error("Title must be 1–160 characters.");
  if (!body || body.length > 16000) throw new Error("Article must be 1–16,000 characters.");
  if (summary.length > 320) throw new Error("Summary must be under 320 characters.");
  const kind = input.kind as Kind, status = input.status as Status;
  if (kind !== "new" && kind !== "upcoming") throw new Error("Choose What's New or Upcoming.");
  if (status !== "draft" && status !== "published") throw new Error("Choose Draft or Published.");
  const now = new Date().toISOString();
  return {
    id: previous?.id || randomUUID(), title, body,
    summary: summary || body.replace(/[#*\n]/g, " ").replace(/\s+/g, " ").slice(0, 220),
    kind, status, featured: input.featured === true,
    imageUrl: optionalUrl(input.imageUrl, true), linkUrl: optionalUrl(input.linkUrl),
    createdAt: previous?.createdAt || now, updatedAt: now,
    publishedAt: status === "published" ? (previous?.publishedAt || now) : (previous?.publishedAt || null),
  };
}
async function readPosts(): Promise<Post[]> {
  const raw = await storage.getSetting(KEY);
  if (!raw) return [];
  const result = JSON.parse(raw);
  if (!Array.isArray(result)) throw new Error("Invalid stored announcement data.");
  return result as Post[];
}
const order = (posts: Post[]) => [...posts].sort((a, b) =>
  Number(b.featured) - Number(a.featured) ||
  Date.parse(b.publishedAt || b.updatedAt || "") - Date.parse(a.publishedAt || a.updatedAt || ""));

// Mutations are serialized so two admin browser tabs cannot overwrite each other's work.
let pending = Promise.resolve();
function withWriteLock<T>(action: () => Promise<T>): Promise<T> {
  const next = pending.then(action, action);
  pending = next.then(() => undefined, () => undefined);
  return next;
}
const adminOnly: RequestHandler = (req: any, res, next) => {
  if (req.adminPreview || req.user?.isAdmin !== true) return res.status(403).json({ message: "Administrator access required." });
  next();
};
function errorResponse(res: any, error: any) {
  const reason = error instanceof Error ? error.message : "";
  if (/^(Invalid|Title|Article|Summary|Choose|Cover|Use a valid)/.test(reason)) return res.status(400).json({ message: reason });
  console.error("[whats-new]", reason);
  return res.status(500).json({ message: "Could not save announcements. Please retry." });
}

export function registerWhatsNewRoutes(app: Express, authMiddleware: RequestHandler) {
  // Public readers only receive published articles; drafts never reach a browser.
  app.get("/api/whats-new", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try { res.json({ posts: order((await readPosts()).filter(p => p.status === "published")) }); }
    catch (err) { console.error("[whats-new] public read", err); res.status(503).json({ message: "Updates are temporarily unavailable." }); }
  });
  app.get("/api/admin/whats-new", authMiddleware, adminOnly, async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try { res.json({ posts: order(await readPosts()) }); }
    catch (err) { errorResponse(res, err); }
  });
  app.post("/api/admin/whats-new", authMiddleware, adminOnly, async (req, res) => {
    try {
      const post = await withWriteLock(async () => {
        const posts = await readPosts();
        if (posts.length >= 250) throw new Error("Maximum 250 posts reached.");
        const created = parsePost(req.body);
        await storage.upsertSetting(KEY, JSON.stringify([created, ...posts]));
        return created;
      });
      res.status(201).json({ post });
    } catch (err) { errorResponse(res, err); }
  });
  app.put("/api/admin/whats-new/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
      const post = await withWriteLock(async () => {
        const posts = await readPosts(), index = posts.findIndex(p => p.id === req.params.id);
        if (index < 0) return null;
        // Reject stale editor data rather than silently losing another tab's edits.
        if (req.body?.expectedUpdatedAt && req.body.expectedUpdatedAt !== posts[index].updatedAt) throw new Error("This post changed in another tab. Reload it before saving.");
        const updated = parsePost(req.body, posts[index]);
        posts[index] = updated;
        await storage.upsertSetting(KEY, JSON.stringify(posts));
        return updated;
      });
      if (!post) return res.status(404).json({ message: "Post not found." });
      res.json({ post });
    } catch (err: any) {
      if (/changed in another tab/.test(String(err?.message))) return res.status(409).json({ message: err.message });
      errorResponse(res, err);
    }
  });
  app.delete("/api/admin/whats-new/:id", authMiddleware, adminOnly, async (req, res) => {
    try {
      const found = await withWriteLock(async () => {
        const posts = await readPosts(), remaining = posts.filter(p => p.id !== req.params.id);
        if (remaining.length === posts.length) return false;
        await storage.upsertSetting(KEY, JSON.stringify(remaining));
        return true;
      });
      if (!found) return res.status(404).json({ message: "Post not found." });
      res.json({ success: true });
    } catch (err) { errorResponse(res, err); }
  });
}
