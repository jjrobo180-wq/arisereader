import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";

export function serveStatic(app: Express, distPath = path.resolve(__dirname, "public")) {
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // An API address that doesn't exist answers in JSON, not with the app's page.
  app.use("/api/{*path}", (_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (req, res) => {
    // A missing file (for example a script from before the last update) must be a real 404:
    // answering with the page would make the browser try to run HTML as a script.
    // (Inside app.use the mount path is cut off req.path, so read the address as it came in.)
    const requested = String(req.originalUrl || req.url || "").split("?")[0];
    if (/\.[a-z0-9]{2,5}$/i.test(requested) && !/\.html?$/i.test(requested)) {
      return res.status(404).type("text/plain").send("Not found");
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
