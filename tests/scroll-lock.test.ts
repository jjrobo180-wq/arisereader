import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const css = () => new Proxy({} as Record<string, string>, { get: (t, k: string) => t[k] ?? "" });
const html = { style: css(), clientWidth: 1000 };
const body = { style: css() };
(globalThis as any).document = { documentElement: html, body };
(globalThis as any).window = { innerWidth: 1000, scrollY: 0, scrollTo() {} };

test("overlapping locks: the page scrolls again once the last one lets go, in any order", async () => {
  const { lockPageScroll, pageScrollHolds } = await import("../client/src/lib/scrollLock");
  // Phone-style Home pins the page, the apps grid opens over it, an app is picked: Home closes first, then the grid.
  const home = lockPageScroll({ fixed: true });
  assert.equal(body.style.position, "fixed");
  const grid = lockPageScroll();
  home();
  assert.equal(body.style.overflow, "hidden", "still held by the grid");
  assert.equal(body.style.position, "", "no longer pinned once the full-screen view is gone");
  grid();
  assert.equal(body.style.overflow, "", "the page scrolls again");
  assert.equal(html.style.overflow, "");
  assert.equal(pageScrollHolds(), 0);
  // The other order, and a release called twice.
  const a = lockPageScroll(), b = lockPageScroll({ fixed: true });
  a(); a(); b();
  assert.equal(body.style.overflow, ""); assert.equal(body.style.position, "");
});

test("nothing sets the page's scroll by hand any more: everything goes through lockPageScroll", () => {
  const files: string[] = [];
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(n)) files.push(p); } };
  walk(new URL("../client/src", import.meta.url).pathname);
  const bad = files.filter((f) => !f.endsWith("scrollLock.ts") && /body\.style\.overflow\s*=(?!=)/.test(readFileSync(f, "utf8")));
  assert.deepEqual(bad, []);
});
