import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { authMiddleware, registerRoutes } from "./routes";
import { loggablePath } from "./logPath";
import { registerHomeWorldRoutes } from "./homeWorld";
import { serveStatic } from "./static";
import { createServer } from "node:http";

const app = express();
const httpServer = createServer(app);

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

// Teacher Hub: a workspace with a full caseload and connected calendars is bigger than the usual
// request, and an upload to be read (photos, a spreadsheet, a PDF) is bigger still.
app.use("/api/teacher-hub/workspace", express.json({ limit: "6mb" }));
// To-Do workspaces can exceed the default 100 KB JSON request size.
app.use("/api/arise-todo/workspace", express.json({ limit: "6mb" }));
// An upload that big is only read for someone who is signed in: the sign-in is checked first, so a stranger can't make
// the server read 24 MB just to turn them away.
app.use("/api/teacher-hub/import", (req, res, next) => { authMiddleware(req, res, next).catch(next); }, express.json({ limit: "24mb" }));

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
