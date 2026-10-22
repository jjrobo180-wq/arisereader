// A Drop link (/drop/CODE) opens a plain page made on the server: no account, no app to load,
// a preview for pictures, PDFs and Office files, and a download. The sender picks how long it lasts.
// Run with: npx tsx --test tests/drop-page.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { registerDropAppRoutes } from "../server/dropApp";
import { dropKeepMs, dropPreviewKind } from "../shared/dropApp";

function setup(drop: any) {
  const routes: Record<string, Function> = {};
  const app: any = { get: (p: string, ...h: Function[]) => { routes["GET " + p] = h[h.length - 1]; }, post: (p: string, ...h: Function[]) => { routes["POST " + p] = h[h.length - 1]; } };
  const settings: Record<string, string> = drop ? { [`drop_${drop.code}`]: JSON.stringify(drop) } : {};
  registerDropAppRoutes(app, (() => {}) as any, (() => () => {}) as any, {
    getAdminSupabase: () => ({ storage: { from: () => ({ createSignedUrl: async (_p: string, _t: number, o?: any) => ({ data: { signedUrl: `https://files.example/x?dl=${o?.download ? 1 : 0}` } }) }) } }),
    getSetting: async (k) => settings[k] || "",
    upsertSetting: async (k, v) => { settings[k] = v; },
    listSettingsByPrefix: async () => [],
  });
  const call = async (route: string, code: string) => {
    const out: any = { status: 200, headers: {} as Record<string, string> };
    const res: any = { status(c: number) { out.status = c; return res; }, type() { return res; }, send(b: string) { out.body = b; return res; }, setHeader(k: string, v: string) { out.headers[k] = v; }, redirect(c: number, u: string) { out.status = c; out.location = u; } };
    await routes[route]({ params: { code } }, res);
    return { out, settings };
  };
  return call;
}

const future = new Date(Date.now() + 3600_000).toISOString();

test("a drop link shows the picture with no account, and a download", async () => {
  const call = setup({ code: "ABC234", name: "Field trip.jpg", size: 2_000_000, contentType: "image/jpeg", createdAt: new Date().toISOString(), expiresAt: future, claimed: false, path: "1/x", ownerId: 1 });
  const { out } = await call("GET /drop/:code", "abc234");
  assert.equal(out.status, 200);
  assert.ok(out.body.includes("<img") && out.body.includes("Field trip.jpg") && out.body.includes('href="/drop/ABC234/download"'));
  assert.ok(!out.body.includes("<script"), "no app to load");
  const dl = await call("GET /drop/:code/download", "ABC234");
  assert.equal(dl.out.status, 302);
  assert.ok(dl.out.location.includes("dl=1"));
  assert.ok(JSON.parse(dl.settings.drop_ABC234).claimed);
});

test("expired, missing and bad codes say so instead of loading forever", async () => {
  const call = setup({ code: "ZZZ234", name: "a.pdf", size: 1, contentType: "application/pdf", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() - 1000).toISOString(), claimed: false, path: "1/x", ownerId: 1 });
  assert.match((await call("GET /drop/:code", "ZZZ234")).out.body, /expired/);
  assert.equal((await call("GET /drop/:code", "nope")).out.status, 404);
});

test("previews and how long a drop lasts", () => {
  assert.equal(dropPreviewKind("application/pdf", "a.pdf"), "pdf");
  assert.equal(dropPreviewKind("application/octet-stream", "plan.docx"), "office");
  assert.equal(dropPreviewKind("video/mp4", "a.mp4"), "video");
  assert.equal(dropKeepMs("7d"), 7 * 86_400_000);
  assert.equal(dropKeepMs("forever"), 3_600_000);
});
