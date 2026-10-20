import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { authMiddleware, registerRoutes } from "./routes";
import { loggablePath } from "./logPath";
import { registerHomeWorldRoutes } from "./homeWorld";
import { serveStatic } from "./static";
import { createServer } from "node:http";
import path from "node:path";

const app = express();
const httpServer = createServer(app);

// Serve search-engine discovery files for the correct domain. The two brands share
// this server but must NOT share a sitemap or a cross-domain sitemap directive.
function isAriseTodoHostname(req: Request): boolean {
  const host = (req.headers.host || "").split(":")[0].toLowerCase();
  return host === "arisetodo.com" || host === "www.arisetodo.com";
}

app.get("/robots.txt", (req, res, next) => {
  if (!isAriseTodoHostname(req)) return next();
  res.type("text/plain; charset=utf-8").send(
    "User-agent: *\\nAllow: /\\nDisallow: /api/\\nDisallow: /app\\n\\nSitemap: https://arisetodo.com/sitemap.xml\\n".replace(/\\\\n/g, "\\n"),
  );
});

app.get("/sitemap.xml", (req, res, next) => {
  if (!isAriseTodoHostname(req)) return next();
  res.type("application/xml; charset=utf-8").send(
    '<?xml version="1.0" encoding="UTF-8"?>\\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\\n  <url><loc>https://arisetodo.com/</loc></url>\\n</urlset>\\n'.replace(/\\\\n/g, "\\n"),
  );
});

// The A.R.I.S.E. To-Do custom domain gets the educator marketing page at its root.
// Keep the existing A.R.I.S.E. Reader homepage unchanged on its own hostname.
// The HTML is a self-contained public page; static assets and API routes are unaffected.
app.get("/", (req, res, next) => {
  const host = (req.headers.host || "").split(":")[0].toLowerCase();
  if (host !== "arisetodo.com" && host !== "www.arisetodo.com") return next();
  const page = process.env.NODE_ENV === "production"
    ? path.resolve(__dirname, "public", "educator.html")
    : path.resolve(process.cwd(), "client", "public", "educator.html");
  res.type("html").sendFile(page);
});

// The light To-Do homepage has an inline pricing section. Old /pricing
// links must not fall through into the dark React app on this hostname.
app.get("/pricing", (req, res, next) => {
  const host = (req.headers.host || "").split(":")[0].toLowerCase();
  if (host !== "arisetodo.com" && host !== "www.arisetodo.com") return next();
  res.redirect(302, "/#pricing");
});

// Serve the real A.R.I.S.E. LifeHub SPA on the To-Do domain without replacing its
// independent educator landing page at /. This keeps Reader's homepage untouched.
app.get("/app", (req, res, next) => {
  const host = (req.headers.host || "").split(":")[0].toLowerCase();
  if (host !== "arisetodo.com" && host !== "www.arisetodo.com") return next();
  const appIndex = process.env.NODE_ENV === "production"
    ? path.resolve(__dirname, "public", "index.html")
    : path.resolve(process.cwd(), "client", "index.html");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.type("html").sendFile(appIndex);
});

// The Eye Gazer home page lives at /eyegaze/. Its first address, /eye-gaze/, and /eyegaze without
// the slash land there too, so links already shared keep working. (Only these exact pages: the
// app's /api/eye-gaze/... data routes are untouched.)
// Matched on the exact address: Express treats "/eyegaze" and "/eyegaze/" as the same route,
// which would send /eyegaze/ back to itself forever.
const EYE_GAZER_OLD = new Set(["/eye-gaze", "/eye-gaze/", "/eyegaze"]);
app.use((req, res, next) => {
  if ((req.method !== "GET" && req.method !== "HEAD") || !EYE_GAZER_OLD.has(req.path)) return next();
  const q = req.originalUrl.indexOf("?");
  res.redirect(301, "/eyegaze/" + (q >= 0 ? req.originalUrl.slice(q) : ""));
});

// Basic safety headers for every response. (No content security policy or frame blocking:
// the app embeds videos and games, and schools may show it inside their learning sites.)
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000");
  next();
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use("/api/eye-gaze/talker-state", express.json({ limit: "2mb" }));
// Build Zone worlds can be a few hundred kilobytes once they're full of builds.
app.use("/api/city/build", express.json({ limit: "600kb" }));

app.use("/api/eye-gaze/my-world/upload", express.raw({
  type: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"],
  limit: "20mb",
}));

// LifeHub Drive (App Store add-on): file bytes arrive as a raw body, same as My World above —
// this has to run before the global express.json() below, or that parser drains the request
// stream first and the route's own body-reading never sees any bytes.
//
// Every content-type is caught here, not a list of image types: Drive takes PDFs and documents
// too, and a type missing from the list fell through to a parser that left req.body empty, so
// the upload failed with "that file did not reach A.R.I.S.E." The route itself is what decides
// which types are allowed (ALLOWED in server/driveApp.ts) and rejects the rest by name.
app.use("/api/lifehub/drive/upload", express.raw({ type: "*/*", limit: "22mb" }));

// LifeHub Drop (App Store add-on): an AirDrop-style file hand-off. Any file type is allowed, so
// this has to catch every content-type on this one path — same raw-before-json ordering reason
// as Drive and My World above.
app.use("/api/lifehub/drop/upload", express.raw({ type: "*/*", limit: "205mb" }));

// Para Team uploads (server/paraTeam.ts): any file type arrives raw, same reason as Drive above.
// The route checks the person is on the team and which types are allowed.
app.use(/^\/api\/para-teams\/[^/]+\/files$/, express.raw({ type: "*/*", limit: "26mb" }));

// Arise WorkHub: a workspace with a full caseload and connected calendars is bigger than the usual
// request, and an upload to be read (photos, a spreadsheet, a PDF) is bigger still.
app.use("/api/teacher-hub/workspace", express.json({ limit: "6mb" }));
// Arise Office files and premium-app data: big workbooks and documents are saved here whole.
app.use("/api/docs", express.json({ limit: "11mb" }));
app.use("/api/app-data", express.json({ limit: "2500kb" }));
app.use("/api/apps/ai", express.json({ limit: "200kb" }));
// LifeHub workspaces can exceed the default 100 KB JSON request size.
app.use("/api/arise-todo/workspace", express.json({ limit: "6mb" }));
// A meal photo for the food diary's calorie estimate (shrunk on the phone first).
app.use("/api/arise-todo/food/estimate", express.json({ limit: "4mb" }));
// Apple Health apps can send a couple of months of readings in one post.
app.use("/api/arise-todo/apple-health/sync", express.json({ limit: "5mb" }));
// An upload that big is only read for someone who is signed in: the sign-in is checked first, so a stranger can't make
// the server read 24 MB just to turn them away.
app.use("/api/teacher-hub/import", (req, res, next) => { authMiddleware(req, res, next).catch(next); }, express.json({ limit: "24mb" }));
// Arise Math "Snap a problem": a photo or screenshot of one math problem (shrunk on the device first).
app.use("/api/math/photo-help", (req, res, next) => { authMiddleware(req, res, next).catch(next); }, express.json({ limit: "8mb" }));

// No-proctor quizzes: camera snapshots arrive as raw JPEG, and the page sends
// its last events with sendBeacon (plain text) while it is closing.
app.use("/api/integrity/live", express.raw({ type: "image/jpeg", limit: "220kb" }));
app.use("/api/integrity/live", express.text({ type: "text/plain", limit: "32kb" }));

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  res.on("finish", () => {
    const duration = Date.now() - start;
    // Never log API response bodies: they can contain student data, session tokens,
    // parent connection codes, proctor credentials, or quiz results.
    // Paintball, racing and study rooms sync many times a second; only log their failures.
    if (path.startsWith("/api") && ((!path.startsWith("/api/paintball/") && !path.startsWith("/api/racing/rooms/") && path !== "/api/study/sync") || res.statusCode >= 400)) {
      log(`${req.method} ${loggablePath(path)} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

(async () => {
  await registerRoutes(httpServer, app);
  registerHomeWorldRoutes(app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    { port, host: "0.0.0.0", reusePort: true },
    () => { log(`serving on port ${port}`); },
  );
})();
