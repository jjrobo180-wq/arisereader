// The Drive app (App Store add-on, shared/driveApp.ts): upload photos from a camera roll or device
// to cloud storage. Same pattern as Eye Gazer's My World photos (server/routes.ts): a private
// Supabase Storage bucket, signed URLs only, never a public one.
//
// Storage quota: the client sends its current total bytes used (from family.drive, the metadata
// list it already keeps) with each upload; this route checks it against the free allowance plus
// any active paid storage tier before accepting the file. This is a soft check (the client could
// in principle lie about its own total), acceptable here because the real backstop is the per-file
// size cap and the fact that nothing but this family's own signed-in members ever see these files —
// there's no incentive to inflate a quota that only limits their own account.
import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { FREE_STORAGE_BYTES } from "@shared/driveApp";

const BUCKET = "life-drive-photos";
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB per photo

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif",
};

export type DriveDeps = {
  getAdminSupabase: () => any;
  /** This user's storage allowance in bytes: the free amount plus any active paid tier. */
  storageLimitFor: (userId: number) => Promise<number>;
};

/** Make sure the bucket is there, once per process. A creation failure is logged rather than
 *  thrown: throwing turned every upload into a 500 even when the bucket was fine, and if it
 *  really is missing the upload below reports that itself, precisely. (Same change in dropApp.ts.) */
let bucketReady: Promise<void> | null = null;
function ensureBucket(adminDb: any) {
  bucketReady ??= adminDb.storage
    .createBucket(BUCKET, { public: false, allowedMimeTypes: Object.keys(ALLOWED), fileSizeLimit: "20MB" })
    .then(({ error }: { error: any }) => {
      if (error && !/already exists|duplicate/i.test(error.message || "")) {
        console.error(`[drive-app] could not create the "${BUCKET}" bucket (carrying on, it may already exist):`, error.message || error);
      }
    })
    .catch((error: any) => { console.error(`[drive-app] bucket check failed (carrying on):`, error?.message || error); });
  return bucketReady;
}

export function registerDriveAppRoutes(app: Express, authMiddleware: RequestHandler, raw: (opts: { type: string[]; limit: string }) => RequestHandler, deps: DriveDeps) {
  app.post("/api/lifehub/drive/upload", authMiddleware, raw({ type: [...Object.keys(ALLOWED), "application/octet-stream"], limit: "22mb" }), async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Sign in required." });

      const contentType = String(req.headers["content-type"] || "").split(";")[0].toLowerCase();
      let ext = ALLOWED[contentType];
      const body: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
      // Some mobile browsers omit a useful MIME type: sniff common image signatures.
      if (!ext && contentType === "application/octet-stream" && body.length >= 12) {
        const head = body.subarray(0, 16);
        const ascii = head.toString("ascii");
        if (head[0] === 0xff && head[1] === 0xd8) ext = "jpg";
        else if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) ext = "png";
        else if (ascii.startsWith("RIFF") && ascii.includes("WEBP")) ext = "webp";
      }
      if (!ext || !body.length) return res.status(400).json({ message: "That photo did not reach A.R.I.S.E. Please choose it again." });
      if (body.length > MAX_FILE_BYTES) return res.status(413).json({ message: "Keep Drive photos under 20 MB." });

      const usedSoFar = Number(req.headers["x-drive-used-bytes"]) || 0;
      const limit = await deps.storageLimitFor(userId).catch(() => FREE_STORAGE_BYTES);
      if (usedSoFar + body.length > limit) {
        return res.status(413).json({ message: "You're out of Drive storage. Free up space or add more storage in Billing.", code: "drive_storage_full" });
      }

      const adminDb = deps.getAdminSupabase();
      await ensureBucket(adminDb);
      const name = String(req.headers["x-drive-name"] || "photo").toString().slice(0, 80).replace(/[^\w.\- ]+/g, "") || "photo";
      const id = randomUUID();
      const path = `${userId}/${Date.now()}-${id}.${ext}`;
      const { error } = await adminDb.storage.from(BUCKET).upload(path, body, { contentType: contentType.startsWith("image/") ? contentType : `image/${ext}`, cacheControl: "3600", upsert: false });
      if (error) throw error;
      res.json({ id, path, name, size: body.length, contentType: contentType.startsWith("image/") ? contentType : `image/${ext}`, uploadedAt: new Date().toISOString() });
    } catch (error: any) {
      console.error("[drive-app] upload failed:", error?.message || error);
      res.status(500).json({ message: "Could not upload that photo. Try again." });
    }
  });

  app.post("/api/lifehub/drive/url", authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Sign in required." });
      const path = String(req.body?.path || "");
      if (!path.startsWith(`${userId}/`)) return res.status(403).json({ message: "That photo does not belong to this account." });
      const adminDb = deps.getAdminSupabase();
      const { data, error } = await adminDb.storage.from(BUCKET).createSignedUrl(path, 3600);
      if (error) throw error;
      res.json({ url: data?.signedUrl || null });
    } catch (error: any) {
      res.status(500).json({ message: "Could not open that photo. Try again." });
    }
  });

  app.post("/api/lifehub/drive/delete", authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Sign in required." });
      const path = String(req.body?.path || "");
      if (!path.startsWith(`${userId}/`)) return res.status(403).json({ message: "That photo does not belong to this account." });
      const adminDb = deps.getAdminSupabase();
      const { error } = await adminDb.storage.from(BUCKET).remove([path]);
      if (error) throw error;
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ message: "Could not delete that photo. Try again." });
    }
  });
}
