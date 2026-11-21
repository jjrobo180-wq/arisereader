import test from "node:test";
import assert from "node:assert/strict";
import { cleanLook, registerAccountLookRoutes } from "../server/accountLook";

/** A tiny stand-in for Express: records the handlers so they can be called directly. */
function fakeApp() {
  const routes: Record<string, (req: any, res: any) => Promise<unknown>> = {};
  const app: any = { get: (p: string, _a: unknown, h: any) => { routes[`GET ${p}`] = h; }, put: (p: string, _a: unknown, h: any) => { routes[`PUT ${p}`] = h; } };
  return { app, routes };
}
const res = () => { const r: any = { code: 200, body: null, set: () => r, status: (c: number) => { r.code = c; return r; }, json: (b: unknown) => { r.body = b; return r; } }; return r; };

test("light/dark is kept on the account, and the newest choice wins on every device", async () => {
  const store = new Map<string, string>();
  const { app, routes } = fakeApp();
  registerAccountLookRoutes(app, (() => {}) as any, { getSetting: async (k) => store.get(k) ?? null, upsertSetting: async (k, v) => { store.set(k, v); } });
  const user = { user: { id: 7 } };
  // The computer turns on light mode.
  let r = res(); await routes["PUT /api/account/look"]({ ...user, body: { night: false, at: "2026-11-20T20:00:00Z" } }, r);
  assert.deepEqual(r.body, { night: false, at: "2026-11-20T20:00:00Z" });
  // The phone asks, and gets light mode.
  r = res(); await routes["GET /api/account/look"](user, r);
  assert.equal(r.body.night, false);
  // An older dark choice arriving late (a phone that was offline) doesn't win.
  r = res(); await routes["PUT /api/account/look"]({ ...user, body: { night: true, at: "2026-11-20T19:00:00Z" } }, r);
  assert.equal(r.body.night, false);
  r = res(); await routes["GET /api/account/look"](user, r);
  assert.equal(r.body.night, false);
  assert.equal(cleanLook({ night: "yes", at: "x" }), null);
});
