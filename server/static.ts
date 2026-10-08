import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // The notification worker must always be the newest copy, or updates to it never reach phones.
  app.get("/sw.js", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.type("application/javascript").sendFile(path.resolve(distPath, "sw.js"));
  });

  app.use(express.static(distPath));

  // An API address that doesn't exist answers in JSON, not with the app's page.
  app.use("/api/{*path}", (_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (req, res) => {
    // A missing file (for example a script from before the last update) must be a real 404:
    // answering with the page would make the browser try to run HTML as a script.
    if (/\.[a-z0-9]{2,5}$/i.test(req.path) && !req.path.endsWith(".html")) {
      return res.status(404).type("text/plain").send("Not found");
    }
    // Unknown direct URLs are app routes or invalid URLs, not independent public pages.
    // Keep those pages out of search indexes; the homepage and static marketing pages
    // are served above and remain indexable.
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
