// The Drive app (App Store add-on, shared/driveApp.ts): upload files — photos, PDFs, documents —
// from a phone or computer to cloud storage. Same pattern as Eye Gazer's My World photos (server/routes.ts): a private
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
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB per file

/** What Drive stores. It began as photos only, which is why a PDF or a Word document — the things
 *  a teacher most wants somewhere safe — bounced off it. Everyday document, image, audio and
 *  video types are all accepted now; the extension is only used to name the stored object. */
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "image/heic": "heic", "image/heif": "heif", "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt", "text/csv": "csv", "text/markdown": "md", "text/rtf": "rtf", "application/rtf": "rtf",
  "application/zip": "zip",
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav", "audio/x-m4a": "m4a",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
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
      const sentName = decodeURIComponent(String(req.headers["x-drive-name"] || "")).slice(0, 120);
      let ext = ALLOWED[contentType];
      const body: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
      // Phones often send no useful MIME type at all. Read the file's own first bytes, then fall
      // back to the extension on the name the browser gave us, so a PDF picked from Files still
      // lands as a PDF rather than being turned away.
      if (!ext && body.length >= 12) {
        const head = body.subarray(0, 16);
        const ascii = head.toString("ascii");
        if (head[0] === 0xff && head[1] === 0xd8) ext = "jpg";
        else if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) ext = "png";
        else if (ascii.startsWith("RIFF") && ascii.includes("WEBP")) ext = "webp";
        else if (ascii.startsWith("%PDF")) ext = "pdf";
        else if (head[0] === 0x50 && head[1] === 0x4b) ext = "zip"; // also docx/xlsx/pptx; refined below
      }
      if (!ext) {
        const fromName = (sentName.match(/\.([A-Za-z0-9]{1,5})$/)?.[1] || "").toLowerCase();
        if (fromName && Object.values(ALLOWED).includes(fromName)) ext = fromName;
      }
      if (!ext || !body.length) return res.status(400).json({ message: "That file did not reach A.R.I.S.E. Please choose it again." });
      if (body.length > MAX_FILE_BYTES) return res.status(413).json({ message: "Keep Drive files under 20 MB." });

      const usedSoFar = Number(req.headers["x-drive-used-bytes"]) || 0;
      const limit = await deps.storageLimitFor(userId).catch(() => FREE_STORAGE_BYTES);
      if (usedSoFar + body.length > limit) {
        return res.status(413).json({ message: "You're out of Drive storage. Free up space or add more storage in Billing.", code: "drive_storage_full" });
      }

      const adminDb = deps.getAdminSupabase();
      await ensureBucket(adminDb);
      const name = (sentName || "file").slice(0, 80).replace(/[^\w.\- ]+/g, "") || "file";
      const id = randomUUID();
      const path = `${userId}/${Date.now()}-${id}.${ext}`;
      // The type to store it under: what the browser said, if we accept it, else the one implied
      // by the extension we worked out. It used to force `image/<ext>` onto everything, which
      // labelled a PDF "image/pdf" and made it unopenable later.
      const EXT_TYPE = Object.fromEntries(Object.entries(ALLOWED).map(([type, e]) => [e, type]));
      const storedType = ALLOWED[contentType] ? contentType : EXT_TYPE[ext] || "application/octet-stream";
      const { error } = await adminDb.storage.from(BUCKET).upload(path, body, { contentType: storedType, cacheControl: "3600", upsert: false });
      if (error) throw error;
      res.json({ id, path, name, size: body.length, contentType: storedType, uploadedAt: new Date().toISOString() });
    } catch (error: any) {
      console.error("[drive-app] upload failed:", error?.message || error);
      res.status(500).json({ message: "Could not upload that file. Try again." });
    }
  });

  app.post("/api/lifehub/drive/url", authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Sign in required." });
      const path = String(req.body?.path || "");
      if (!path.startsWith(`${userId}/`)) return res.status(403).json({ message: "That file does not belong to this account." });
      const adminDb = deps.getAdminSupabase();
      const { data, error } = await adminDb.storage.from(BUCKET).createSignedUrl(path, 3600);
      if (error) throw error;
      res.json({ url: data?.signedUrl || null });
    } catch (error: any) {
      res.status(500).json({ message: "Could not open that file. Try again." });
    }
  });

  app.post("/api/lifehub/drive/delete", authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Sign in required." });
      const path = String(req.body?.path || "");
      if (!path.startsWith(`${userId}/`)) return res.status(403).json({ message: "That file does not belong to this account." });
      const adminDb = deps.getAdminSupabase();
      const { error } = await adminDb.storage.from(BUCKET).remove([path]);
      if (error) throw error;
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ message: "Could not delete that file. Try again." });
    }
  });
}
