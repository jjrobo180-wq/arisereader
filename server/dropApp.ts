// The "Drop" app (App Store add-on, shared/dropApp.ts): an AirDrop-style file hand-off. One
// device uploads, gets a 6-char code + QR + link; the other device enters the code, scans the
// QR, or opens the link to pull the file straight back down — no account needed on that side.
//
// Storage: file bytes go in Supabase Storage (bucket "life-drop-files"), signed URLs only, same
// pattern as Drive/My World. The code -> {path, name, size, ...} lookup lives in the generic
// `settings` table (one row per drop, key `drop_<CODE>`) rather than on any one family's own
// record, because the receiver is frequently a different account, or no account at all — a drop
// has to be findable by its code alone, independent of whose family made it.
//
// "Nearby" list: real local-network device discovery (the way AirDrop/Snapdrop do it) needs
// either a live socket server or multicast, neither of which this request is standing up right
// now. Instead, GET /api/lifehub/drop/mine lists this signed-in user's own recent, unclaimed
// drops — a tap-to-grab list when sender and receiver are the same account on two devices (e.g.
// phone drops a photo, laptop picks it up), without a true cross-account "nearby" radar.
import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { DROP_MAX_BYTES, DROP_TTL_MS, cleanDropMeta, isDropCode, isDropExpired, makeDropCode, type DropMeta } from "@shared/dropApp";

const BUCKET = "life-drop-files";
const SETTING_PREFIX = "drop_";

export type DropDeps = {
  getAdminSupabase: () => any;
  getSetting: (key: string) => Promise<string>;
  upsertSetting: (key: string, value: string) => Promise<void>;
  /** Raw settings-table access for listing this user's own recent drops (no prefix-list helper
   *  exists on the shared storage interface, so this reads the table directly). */
  listSettingsByPrefix: (prefix: string) => Promise<Array<{ key: string; value: string }>>;
};

/** Make sure the bucket is there, once per process.
 *
 *  This used to throw whenever createBucket returned anything but "already exists", which meant a
 *  project where the key may not create buckets failed EVERY upload with a 500 — and on the Drop
 *  screen a failed upload shows no code, no QR and no link, so the app looked simply broken.
 *  A creation failure is now logged and the upload goes ahead: if the bucket does exist, the
 *  upload works, and if it truly doesn't, the upload's own error says so precisely. */
let bucketReady: Promise<void> | null = null;
function ensureBucket(adminDb: any) {
  bucketReady ??= adminDb.storage
    .createBucket(BUCKET, { public: false, fileSizeLimit: "200MB" })
    .then(({ error }: { error: any }) => {
      if (error && !/already exists|duplicate/i.test(error.message || "")) {
        console.error(`[drop-app] could not create the "${BUCKET}" bucket (carrying on, it may already exist):`, error.message || error);
      }
    })
    .catch((error: any) => { console.error(`[drop-app] bucket check failed (carrying on):`, error?.message || error); });
  return bucketReady;
}

type StoredDrop = DropMeta & { path: string; ownerId: number | null };

const readDrop = async (deps: DropDeps, code: string): Promise<StoredDrop | null> => {
  const raw = await deps.getSetting(`${SETTING_PREFIX}${code}`).catch(() => "");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const meta = cleanDropMeta(parsed);
    if (!meta) return null;
    const path = String(parsed.path || "");
    if (!path) return null;
    const ownerId = Number.isFinite(Number(parsed.ownerId)) ? Number(parsed.ownerId) : null;
    return { ...meta, path, ownerId };
  } catch {
    return null;
  }
};

const writeDrop = (deps: DropDeps, drop: StoredDrop) =>
  deps.upsertSetting(`${SETTING_PREFIX}${drop.code}`, JSON.stringify(drop));

export function registerDropAppRoutes(app: Express, authMiddleware: RequestHandler, raw: (opts: { type: string[]; limit: string }) => RequestHandler, deps: DropDeps) {
  // Send: pick a file, get back a code + link. Signed in, so a drop can be attributed to an
  // account for the "mine" list, but the receiving side never needs to be.
  app.post("/api/lifehub/drop/upload", authMiddleware, raw({ type: ["*/*"], limit: "205mb" }), async (req: any, res) => {
    try {
      const userId = req.user?.id ?? null;
      const body: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
      if (!body.length) return res.status(400).json({ message: "That file did not reach A.R.I.S.E. Please choose it again." });
      if (body.length > DROP_MAX_BYTES) return res.status(413).json({ message: "Keep a Drop file under 200 MB." });

      const contentType = String(req.headers["content-type"] || "application/octet-stream").split(";")[0].toLowerCase();
      const name = String(req.headers["x-drop-name"] || "file").toString().slice(0, 160).replace(/[^\w.\- ]+/g, "") || "file";

      const adminDb = deps.getAdminSupabase();
      await ensureBucket(adminDb);

      // Codes are short, so collisions are possible (not likely): retry a few times against an
      // unexpired, unclaimed existing drop before giving up.
      let code = "";
      for (let attempt = 0; attempt < 6; attempt++) {
        const candidate = makeDropCode();
        const existing = await readDrop(deps, candidate);
        if (!existing || isDropExpired(existing)) { code = candidate; break; }
      }
      if (!code) return res.status(503).json({ message: "Drop is busy right now. Try again in a moment." });

      const id = randomUUID();
      const path = `${userId ?? "anon"}/${Date.now()}-${id}`;
      const { error } = await adminDb.storage.from(BUCKET).upload(path, body, { contentType, cacheControl: "0", upsert: false });
      if (error) throw error;

      const now = Date.now();
      const drop: StoredDrop = { code, name, size: body.length, contentType, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + DROP_TTL_MS).toISOString(), claimed: false, path, ownerId: userId };
      await writeDrop(deps, drop);
      res.json({ code, name, size: drop.size, expiresAt: drop.expiresAt });
    } catch (error: any) {
      console.error("[drop-app] upload failed:", error?.message || error);
      res.status(500).json({ message: "Could not create that drop. Try again." });
    }
  });

  // Receive, step 1: look up a code (typed, scanned, or from the link) without downloading yet,
  // so the receiving screen can show "Photo.jpg · 2.1 MB" before the person commits to pulling it.
  app.get("/api/lifehub/drop/:code", async (req, res) => {
    try {
      const code = String(req.params.code || "").toUpperCase();
      if (!isDropCode(code)) return res.status(400).json({ message: "That code isn't valid." });
      const drop = await readDrop(deps, code);
      if (!drop || isDropExpired(drop)) return res.status(404).json({ message: "That drop has expired or was already picked up." });
      res.json({ code: drop.code, name: drop.name, size: drop.size, contentType: drop.contentType, expiresAt: drop.expiresAt });
    } catch {
      res.status(500).json({ message: "Could not look up that drop." });
    }
  });

  // Receive, step 2: the actual file, as a signed URL good for a few minutes. Marks the drop
  // claimed so a second visitor sees "already picked up" instead of also grabbing it.
  app.post("/api/lifehub/drop/:code/claim", async (req, res) => {
    try {
      const code = String(req.params.code || "").toUpperCase();
      if (!isDropCode(code)) return res.status(400).json({ message: "That code isn't valid." });
      const drop = await readDrop(deps, code);
      if (!drop || isDropExpired(drop)) return res.status(404).json({ message: "That drop has expired or was already picked up." });

      const adminDb = deps.getAdminSupabase();
      const { data, error } = await adminDb.storage.from(BUCKET).createSignedUrl(drop.path, 300, { download: drop.name });
      if (error) throw error;
      await writeDrop(deps, { ...drop, claimed: true });
      res.json({ url: data?.signedUrl || null, name: drop.name });
    } catch (error: any) {
      res.status(500).json({ message: "Could not open that drop. Try again." });
    }
  });

  // The signed-in user's own recent, unclaimed drops — the "nearby" tap-to-grab list on the
  // Drop screen (see file-top comment for why this isn't true cross-device network discovery).
  app.get("/api/lifehub/drop/mine/list", authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Sign in required." });
      const rows = await deps.listSettingsByPrefix(SETTING_PREFIX).catch(() => []);
      const mine = rows
        .map((r) => { try { return JSON.parse(r.value) as StoredDrop; } catch { return null; } })
        .filter((d): d is StoredDrop => !!d && d.ownerId === userId && !isDropExpired(d))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 10)
        .map((d) => ({ code: d.code, name: d.name, size: d.size, createdAt: d.createdAt, expiresAt: d.expiresAt }));
      res.json({ drops: mine });
    } catch {
      res.status(500).json({ message: "Could not load your drops." });
    }
  });
}
