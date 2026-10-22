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
// now. Instead, GET /api/lifehub/drop/mine lists this signed-in user's own drops from the last
// hour — a tap-to-grab list when sender and receiver are the same account on two devices (e.g.
// phone drops a photo, laptop picks it up), without a true cross-account "nearby" radar.
//
// A drop lasts one hour and downloading it does NOT remove it, so the same file can be pulled
// down on several devices, or again after a download that went wrong. Expired drops are swept
// (bytes and lookup row both) when the next upload comes in — see sweepExpired.
import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { DROP_KEEP, DROP_MAX_BYTES, cleanDropMeta, dropKeepMs, dropPreviewKind, isDropCode, isDropExpired, makeDropCode, type DropMeta } from "@shared/dropApp";

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

/** Clears out drops whose hour is up: the stored bytes and the code -> file row both.
 *
 *  Nothing used to delete a drop's bytes at all — a claimed drop was merely hidden — so the bucket
 *  only ever grew. Now that a download no longer ends a drop, the clock is the only thing that
 *  does, and this is what acts on it. It runs after an upload rather than on a timer: uploads are
 *  the only moment new files appear, and a sweep then keeps the bucket proportional to real use
 *  without standing up a scheduler. Failures are logged and ignored; the next upload tries again. */
async function sweepExpired(deps: DropDeps) {
  try {
    const rows = await deps.listSettingsByPrefix(SETTING_PREFIX);
    const dead: { key: string; path: string }[] = [];
    for (const r of rows) {
      try {
        const parsed = JSON.parse(r.value);
        if (parsed?.expiresAt && isDropExpired({ expiresAt: String(parsed.expiresAt) })) {
          dead.push({ key: r.key, path: String(parsed.path || "") });
        }
      } catch { dead.push({ key: r.key, path: "" }); } // unreadable row: drop it too
    }
    if (!dead.length) return;

    const adminDb = deps.getAdminSupabase();
    const paths = dead.map((d) => d.path).filter(Boolean);
    if (paths.length) {
      const { error } = await adminDb.storage.from(BUCKET).remove(paths);
      // If the bytes can't be removed, keep the lookup rows so the next sweep retries them rather
      // than orphaning files nothing points at any more.
      if (error) { console.error("[drop-app] sweep could not remove files:", error.message || error); return; }
    }
    const { error } = await adminDb.from("settings").delete().in("key", dead.map((d) => d.key));
    if (error) console.error("[drop-app] sweep could not clear lookup rows:", error.message || error);
  } catch (error: any) {
    console.error("[drop-app] sweep failed:", error?.message || error);
  }
}

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
      // The client percent-encodes the name so it survives as a header. Decoding it first matters:
      // without that, "My Report.pdf" arrived as "My%20Report.pdf" and the strip below turned the
      // escape into digits, handing the other device a file called "My20Report.pdf".
      let sentName = String(req.headers["x-drop-name"] || "");
      try { sentName = decodeURIComponent(sentName); } catch { /* not encoded; use as sent */ }
      const name = sentName.slice(0, 160).replace(/[^\w.\- ]+/g, "").trim() || "file";

      const adminDb = deps.getAdminSupabase();
      await ensureBucket(adminDb);

      // Codes are short, so collisions are possible (not likely): retry a few times against an
      // unexpired existing drop before giving up.
      let code = "";
      let replacing = "";
      for (let attempt = 0; attempt < 6; attempt++) {
        const candidate = makeDropCode();
        const existing = await readDrop(deps, candidate);
        if (!existing || isDropExpired(existing)) { code = candidate; replacing = existing?.path || ""; break; }
      }
      if (!code) return res.status(503).json({ message: "Drop is busy right now. Try again in a moment." });
      // Taking over an expired drop's code overwrites the only row pointing at its file, so the
      // sweep below would never find those bytes again. Remove them while the path is still known.
      if (replacing) {
        const { error } = await adminDb.storage.from(BUCKET).remove([replacing]);
        if (error) console.error("[drop-app] could not remove the file of the expired drop whose code is being reused:", error.message || error);
      }

      const id = randomUUID();
      const path = `${userId ?? "anon"}/${Date.now()}-${id}`;
      const { error } = await adminDb.storage.from(BUCKET).upload(path, body, { contentType, cacheControl: "0", upsert: false });
      if (error) throw error;

      const now = Date.now();
      const drop: StoredDrop = { code, name, size: body.length, contentType, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + dropKeepMs(req.headers["x-drop-keep"])).toISOString(), claimed: false, path, ownerId: userId };
      await writeDrop(deps, drop);
      res.json({ code, name, size: drop.size, expiresAt: drop.expiresAt });
      // After answering, so clearing out old drops never delays the send that just happened.
      void sweepExpired(deps);
    } catch (error: any) {
      console.error("[drop-app] upload failed:", error?.message || error);
      res.status(500).json({ message: "Could not create that drop. Try again." });
    }
  });

  // The page a Drop link and QR code open: /drop/CODE. It is plain HTML made here on the server,
  // not part of the app, so it opens instantly on any phone or computer with no account and no
  // sign-in. (The link used to open the app itself, which routes by "#/…" and, for someone not
  // signed in, never got as far as showing the file — it just kept loading.) Pictures, videos,
  // audio and PDFs show right on the page; Word, Excel and PowerPoint files open in Microsoft's
  // free web viewer; everything can be downloaded.
  app.get("/drop/:code", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    const code = String(req.params.code || "").toUpperCase();
    const send = (status: number, body: string) => res.status(status).type("html").send(dropPage(body));
    try {
      if (!isDropCode(code)) return send(404, notice("That link isn't a valid Drop code.", "Check the link, or ask the sender for a new one."));
      const drop = await readDrop(deps, code);
      if (!drop || isDropExpired(drop)) return send(404, notice("This drop has expired.", "Ask the sender to drop it again."));
      const adminDb = deps.getAdminSupabase();
      const view = await adminDb.storage.from(BUCKET).createSignedUrl(drop.path, 3600);
      const viewUrl: string = view?.data?.signedUrl || "";
      const kind = dropPreviewKind(drop.contentType, drop.name);
      const e = escapeHtml, u = escapeHtml(viewUrl);
      const preview = !viewUrl ? "" :
        kind === "image" ? `<a href="${u}" target="_blank" rel="noopener"><img class="pv" src="${u}" alt="${e(drop.name)}"></a>` :
        kind === "video" ? `<video class="pv" src="${u}" controls playsinline preload="metadata"></video>` :
        kind === "audio" ? `<audio src="${u}" controls preload="metadata" style="width:100%"></audio>` :
        kind === "pdf" ? `<iframe class="doc" src="${u}" title="${e(drop.name)}"></iframe><a class="ghost" href="${u}" target="_blank" rel="noopener">Open the PDF full screen</a>` :
        kind === "office" ? `<iframe class="doc" src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(viewUrl)}" title="${e(drop.name)}"></iframe><a class="ghost" href="https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(viewUrl)}" target="_blank" rel="noopener">Open it full screen</a>` :
        kind === "text" ? `<iframe class="doc" src="${u}" title="${e(drop.name)}"></iframe>` : "";
      const left = Math.max(0, Date.parse(drop.expiresAt) - Date.now());
      const leftWords = left > 36 * 3600_000 ? `${Math.round(left / 86_400_000)} days` : left > 90 * 60_000 ? `${Math.round(left / 3600_000)} hours` : `${Math.max(1, Math.round(left / 60_000))} minutes`;
      return send(200, `<h1>${e(drop.name)}</h1><p class="meta">${fmtBytes(drop.size)} · available for about ${leftWords} more</p>${preview}
        <a class="btn" href="/drop/${code}/download">Download</a>
        <p class="small">No account needed. Anyone with this link can view and download this file until it expires.</p>`);
    } catch (error: any) {
      console.error("[drop-app] page failed:", error?.message || error);
      return send(500, notice("Couldn't open this drop right now.", "Refresh the page in a moment."));
    }
  });

  // The Download button on that page: marks the drop as picked up and hands over the file.
  app.get("/drop/:code/download", async (req, res) => {
    const code = String(req.params.code || "").toUpperCase();
    try {
      if (!isDropCode(code)) return res.redirect(302, `/drop/${encodeURIComponent(code)}`);
      const drop = await readDrop(deps, code);
      if (!drop || isDropExpired(drop)) return res.redirect(302, `/drop/${code}`);
      const { data, error } = await deps.getAdminSupabase().storage.from(BUCKET).createSignedUrl(drop.path, 300, { download: drop.name });
      if (error || !data?.signedUrl) throw error || new Error("no url");
      await writeDrop(deps, { ...drop, claimed: true }).catch(() => {});
      res.setHeader("Cache-Control", "no-store");
      res.redirect(302, data.signedUrl);
    } catch {
      res.redirect(302, `/drop/${code}`);
    }
  });

  // Receive, step 1: look up a code (typed, scanned, or from the link) without downloading yet,
  // so the receiving screen can show "Photo.jpg · 2.1 MB" before the person commits to pulling it.
  app.get("/api/lifehub/drop/:code", async (req, res) => {
    try {
      const code = String(req.params.code || "").toUpperCase();
      if (!isDropCode(code)) return res.status(400).json({ message: "That code isn't valid." });
      const drop = await readDrop(deps, code);
      if (!drop || isDropExpired(drop)) return res.status(404).json({ message: "That drop has expired. Drops last one hour." });
      res.json({ code: drop.code, name: drop.name, size: drop.size, contentType: drop.contentType, expiresAt: drop.expiresAt, claimed: drop.claimed });
    } catch {
      res.status(500).json({ message: "Could not look up that drop." });
    }
  });

  // Receive, step 2: the actual file, as a signed URL good for a few minutes. The drop is marked
  // as having been picked up, but stays available for the rest of its hour — a download is not a
  // one-shot consumption, so a second device (or a retry) still finds it.
  app.post("/api/lifehub/drop/:code/claim", async (req, res) => {
    try {
      const code = String(req.params.code || "").toUpperCase();
      if (!isDropCode(code)) return res.status(400).json({ message: "That code isn't valid." });
      const drop = await readDrop(deps, code);
      if (!drop || isDropExpired(drop)) return res.status(404).json({ message: "That drop has expired. Drops last one hour." });

      const adminDb = deps.getAdminSupabase();
      const { data, error } = await adminDb.storage.from(BUCKET).createSignedUrl(drop.path, 300, { download: drop.name });
      if (error) throw error;
      await writeDrop(deps, { ...drop, claimed: true });
      res.json({ url: data?.signedUrl || null, name: drop.name });
    } catch (error: any) {
      res.status(500).json({ message: "Could not open that drop. Try again." });
    }
  });

  // The signed-in user's own drops from the last hour — the "Waiting for you" tap-to-grab list on the
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

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmtBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const notice = (title: string, line: string) => `<h1>${escapeHtml(title)}</h1><p class="meta">${escapeHtml(line)}</p>`;
export const DROP_KEEP_CHOICES = Object.keys(DROP_KEEP);

/** The whole Drop page around its content: small, fast, readable on a phone, no scripts. */
export function dropPage(body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>A.R.I.S.E. Drop</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f6f7fc;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0f172a;padding:16px}
main{width:100%;max-width:760px;background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:24px;text-align:center;box-shadow:0 8px 30px #0f172a0d}
.logo{display:inline-flex;align-items:center;gap:8px;font-weight:900;font-size:14px;letter-spacing:.02em;color:#292446;margin-bottom:12px}.logo span{display:inline-grid;place-items:center;width:32px;height:32px;border-radius:10px;background:#292446;color:#fff}
h1{font-size:20px;margin:4px 0;word-break:break-word}.meta{color:#64748b;font-size:14px;margin:4px 0 16px}
.pv{max-width:100%;max-height:70vh;border-radius:16px;border:1px solid #e2e8f0;display:block;margin:0 auto 16px;background:#f1f5f9}
.doc{width:100%;height:70vh;border:1px solid #e2e8f0;border-radius:16px;margin-bottom:8px;background:#fff}
.btn{display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:14px;background:#292446;color:#fff;font-weight:800;text-decoration:none;margin-top:8px}
.ghost{display:inline-block;margin:4px 0 12px;color:#5b47d6;font-weight:700;font-size:14px}
.small{color:#94a3b8;font-size:12px;margin-top:16px}
</style></head><body><main><div class="logo"><span>⇣</span>A.R.I.S.E. Drop</div>${body}</main></body></html>`;
}
