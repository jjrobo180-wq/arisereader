// The reads and books the iPhone apps can add without an app update (shared/liveCatalog.ts).
import type { Express } from "express";
import { createHash } from "node:crypto";
import { catalogIndex, catalogItems, NAME } from "@shared/liveCatalog";

export function registerContentCatalog(app: Express) {
  const index = JSON.stringify(catalogIndex());
  const etag = `"${createHash("sha1").update(index).digest("hex").slice(0, 20)}"`;
  app.get("/api/content/catalog", (req, res) => {
    res.set({ "Cache-Control": "public, max-age=300", ETag: etag });
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    res.type("application/json").send(index);
  });
  app.get("/api/content/catalog/items", (req, res) => {
    const names = (v: unknown) => String(v ?? "").split(",").filter((s) => NAME.test(s));
    res.set("Cache-Control", "public, max-age=300");
    res.json(catalogItems({ reads: names(req.query.reads), books: names(req.query.books), classics: names(req.query.classics) }));
  });
}
