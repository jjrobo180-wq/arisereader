import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { registerRoutes } from "./routes";
import { registerHomeWorldRoutes } from "./homeWorld";
import { serveStatic } from "./static";
import { createServer } from "node:http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use("/api/eye-gaze/talker-state", express.json({ limit: "2mb" }));

app.use("/api/eye-gaze/my-world/upload", express.raw({
  type: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"],
  limit: "20mb",
}));

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
    // Paintball syncs many times a second; only log its failures.
    if (path.startsWith("/api") && (!path.startsWith("/api/paintball/") || res.statusCode >= 400)) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
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
