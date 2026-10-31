// Pod+ downloads relay: members' pass required, only public http(s) audio, never this server or a private network.
// Run with: npx tsx --test tests/pod-download.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { downloadUrlAllowed, isAudioType, registerPodDownloadRoute } from "../server/podDownload";

test("only public http(s) addresses on normal ports", () => {
  assert.ok(downloadUrlAllowed("https://traffic.megaphone.fm/ABC123.mp3?updated=1"));
  assert.ok(downloadUrlAllowed("http://feeds.example.com/ep.mp3"));
  for (const bad of ["ftp://x.com/a.mp3", "https://localhost/a.mp3", "http://127.0.0.1/a.mp3", "http://10.0.0.5/a.mp3", "http://169.254.169.254/latest", "http://[::1]/a.mp3",
    "https://user:pw@x.com/a.mp3", "https://x.com:8443/a.mp3", "http://printer.local/a.mp3", "http://db.internal/a", "not a url"]) {
    assert.equal(downloadUrlAllowed(bad), null, bad);
  }
});

test("audio types pass, pages and playlists don't", () => {
  for (const ok of ["audio/mpeg", "audio/x-m4a", "video/mp4", "application/octet-stream", "binary/octet-stream", ""]) assert.ok(isAudioType(ok), ok);
  for (const bad of ["text/html", "application/json", "application/x-mpegURL", "audio/mpegurl", "image/png"]) assert.equal(isAudioType(bad), false, bad);
});

async function withServer(passOk: (k: string) => boolean, fn: (base: string) => Promise<void>) {
  const app = express();
  registerPodDownloadRoute(app, { prefix: "/api/podscroll", passOk, clientIp: () => "203.0.113.9" });
  const server = app.listen(0);
  try { await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); } finally { server.close(); }
}

test("no member pass, no download", () => withServer(() => false, async (base) => {
  const r = await fetch(`${base}/api/podscroll/download?u=${encodeURIComponent("https://example.com/a.mp3")}&k=nope`);
  assert.equal(r.status, 403);
}));

test("a private address is refused even with a pass", () => withServer(() => true, async (base) => {
  const r = await fetch(`${base}/api/podscroll/download?u=${encodeURIComponent("http://127.0.0.1:80/secret")}&k=ok`);
  assert.equal(r.status, 400);
}));
