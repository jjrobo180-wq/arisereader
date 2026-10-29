// Pod+ Clips: one shared list of TikTok videos that everyone reads and only the owner changes.
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { clipId, clipIds, CLIPS_MAX } from "../shared/podClips";
import { clipOwners, registerClipsRoutes, SAMPLE_CLIPS } from "../server/podcastClips";
import { memoryKV } from "../server/podcastDirectory";

test("clips: video ids from TikTok links", () => {
  assert.equal(clipId("https://www.tiktok.com/@someone/video/7123456789012345678?is_from_webapp=1"), "7123456789012345678");
  assert.equal(clipId(" 7123456789012345678 "), "7123456789012345678");
  assert.equal(clipId("https://vm.tiktok.com/ZMabc123/"), "", "short links have no id until opened");
  assert.deepEqual(clipIds("https://www.tiktok.com/@a/video/111111111\n\nhttps://www.tiktok.com/@b/video/222222222 https://www.tiktok.com/@a/video/111111111 junk"), ["111111111", "222222222"]);
  assert.deepEqual(clipIds(["333333333", "nope", 444444444]), ["333333333", "444444444"]);
  assert.equal(clipIds(Array.from({ length: 150 }, (_, i) => String(100000000 + i))).length, CLIPS_MAX);
});

test("clips: the owner list", () => {
  assert.deepEqual(clipOwners({ PODSCROLL_OWNERS: "A@x.com, b@y.com" }), ["a@x.com", "b@y.com"]);
  assert.deepEqual(clipOwners({ ADMIN_NOTIFY_EMAIL: "Boss@site.com" }), ["boss@site.com"]);
});

test("clips: everyone reads the list; only the owner changes it", async () => {
  const app = express(); app.use(express.json());
  // The gate stands in for Pod+'s: an "x-email" header plays a signed-in account.
  const gate: any = (req: any, _res: any, next: any) => { const e = req.headers["x-email"]; if (e) req.creator = { email: e, id: 1 }; next(); };
  registerClipsRoutes(app, gate, { kv: memoryKV(), owners: ["owner@site.com"] });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/podscroll/clips`;
  const post = (clips: unknown, email?: string) => fetch(base, { method: "POST", headers: { "Content-Type": "application/json", ...(email ? { "x-email": email } : {}) }, body: JSON.stringify({ clips }) });
  try {
    let r = await (await fetch(base)).json();
    assert.deepEqual(r, { clips: SAMPLE_CLIPS, canEdit: false }, "a sample until the owner picks some");
    assert.equal((await post("https://www.tiktok.com/@a/video/999999999")).status, 401);
    assert.equal((await post("https://www.tiktok.com/@a/video/999999999", "someone@else.com")).status, 403);
    const ok = await post("https://www.tiktok.com/@a/video/123456789\nhttps://www.tiktok.com/@b/video/987654321", "Owner@Site.com");
    assert.equal(ok.status, 200);
    r = await (await fetch(base)).json();
    assert.deepEqual(r, { clips: ["123456789", "987654321"], canEdit: false }, "everyone sees the owner's list");
    r = await (await fetch(base, { headers: { "x-email": "owner@site.com" } })).json();
    assert.equal(r.canEdit, true);
    await post("", "owner@site.com");
    assert.deepEqual((await (await fetch(base)).json()).clips, [], "the owner can empty it");
  } finally { server.close(); }
});
