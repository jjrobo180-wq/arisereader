// The all-time counter on the home page and the sign-in screen: GET /api/public/reader-totals (every quiz taken
// and the points they earned, nothing about any one reader) and where it shows up.
// Run with: npx tsx --test tests/reader-totals.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOTALS_FRESH_MS, registerReaderTotalsRoutes, totalAttempts } from "../server/readerTotals";
import { formatTotal, sinceLabel } from "../shared/readerTotals";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

test("totals count every attempt, add up the points (numbers or numeric strings, none for a missed quiz) and name the first day", () => {
  assert.deepEqual(totalAttempts([]), { quizzes: 0, points: 0, since: null });
  const rows = [
    { points_earned: "10.0", completed_at: "2026-09-08T20:44:03.265726+00:00" },
    { points_earned: 5.5, completed_at: "2026-11-19T20:47:22.708603+00:00" },
    { points_earned: null, completed_at: "2026-10-01T12:00:00Z" },
    { points_earned: 0, completed_at: null },
  ];
  assert.deepEqual(totalAttempts(rows), { quizzes: 4, points: 15.5, since: "2026-09-08" });
});

function fakeApp(pages: (from: number, to: number) => any, now = { t: 1_000_000 }) {
  const routes: Record<string, Function> = {};
  const app: any = { get: (path: string, ...h: Function[]) => { routes[path] = h[h.length - 1]; } };
  const asked: Array<[number, number]> = [];
  registerReaderTotalsRoutes(app, { attemptsPage: async (a, b) => { asked.push([a, b]); return pages(a, b); }, now: () => now.t });
  const get = async () => {
    let body: any; let status = 200; const headers: Record<string, string> = {};
    const res: any = { json: (b: any) => { body = b; return res; }, status: (s: number) => { status = s; return res; }, set: (k: string, v: string) => { headers[k] = v; return res; } };
    await routes["/api/public/reader-totals"]({}, res);
    return { status, body, headers };
  };
  return { get, asked, now };
}

test("the route is public, reads the attempts a thousand at a time, and answers with just the totals", async () => {
  const all = Array.from({ length: 2300 }, (_, i) => ({ points_earned: 10, completed_at: i === 7 ? "2026-09-08T20:00:00Z" : "2026-11-01T00:00:00Z" }));
  const { get, asked } = fakeApp((a, b) => all.slice(a, b + 1));
  const { status, body, headers } = await get();
  assert.equal(status, 200);
  assert.deepEqual(body, { quizzes: 2300, points: 23000, since: "2026-09-08" });
  assert.deepEqual(Object.keys(body).sort(), ["points", "quizzes", "since"], "no names, schools or ids");
  assert.deepEqual(asked, [[0, 999], [1000, 1999], [2000, 2999]]);
  assert.match(headers["Cache-Control"], /public, max-age=300/);
  const src = read("server/readerTotals.ts");
  assert.match(src, /app\.get\("\/api\/public\/reader-totals", async \(_req, res\)/, "no sign-in required");
  assert.doesNotMatch(src, /\bauth\b/);
});

test("the totals are reused for five minutes, then worked out again; a database error keeps showing the last ones", async () => {
  let n = 0; let failing = false;
  const { get, asked, now } = fakeApp(() => { if (failing) throw new Error("db down"); n++; return [{ points_earned: n, completed_at: "2026-10-01T00:00:00Z" }]; });
  assert.equal((await get()).body.points, 1);
  assert.equal((await get()).body.points, 1, "within five minutes: no new query");
  assert.equal(asked.length, 1);
  now.t += TOTALS_FRESH_MS;
  assert.equal((await get()).body.points, 2, "after five minutes: counted again");
  failing = true; now.t += TOTALS_FRESH_MS;
  const kept = await get();
  assert.equal(kept.status, 200);
  assert.equal(kept.body.points, 2, "the last totals, not an error");
});

test("with nothing counted yet and the database down, it says so instead of showing a zero", async () => {
  const { get } = fakeApp(() => { throw new Error("db down"); });
  const r = await get();
  assert.equal(r.status, 503);
  assert.equal(r.body.quizzes, undefined);
});

test("numbers and the start date read the way the screens show them", () => {
  assert.equal(formatTotal(1666), "1,666");
  assert.equal(formatTotal(16263.0), "16,263");
  assert.equal(formatTotal(16262.6), "16,263");
  assert.equal(sinceLabel("2026-09-08"), "September 8, 2026");
  assert.equal(sinceLabel(null), "");
  assert.equal(sinceLabel("not a date"), "");
});

test("the sign-in screen and the home page show the counter, and the server registers the route", () => {
  const login = read("client/src/pages/Login.tsx");
  assert.match(login, /import ReaderTotalsStrip from "@\/components\/ReaderTotalsStrip";/);
  assert.match(login, /<main className="[^"]*"><ReaderTotalsStrip \/><div className="grid /);
  const strip = read("client/src/components/ReaderTotalsStrip.tsx");
  assert.match(strip, /quizzes taken/);
  assert.match(strip, /points earned/);
  assert.match(strip, /if \(!totals\) return null;/, "nothing (never a 0) until the numbers arrive");
  assert.match(read("client/src/lib/readerTotals.ts"), /\/api\/public\/reader-totals/);
  const landing = read("client/public/reader-landing.html");
  assert.match(landing, /id="reader-totals" hidden/);
  assert.match(landing, /fetch\('\/api\/public\/reader-totals'\)/);
  assert.match(landing, /<span>quizzes taken<\/span>/);
  assert.match(landing, /<span>points earned<\/span>/);
  const routes = read("server/routes.ts");
  assert.match(routes, /registerReaderTotalsRoutes\(app, \{/);
  assert.match(routes, /supabase\.from\("attempts"\)\.select\("points_earned, completed_at"\)\.order\("id", \{ ascending: true \}\)\.range\(from, to\)/);
});
