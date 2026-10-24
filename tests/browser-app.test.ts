// Arise To Duo Browser: what opens inside the app, and what the server refuses to look at.
// Run with: npx tsx --test tests/browser-app.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { addressFor, frameAllowed, isPrivateAddress, pageTitle, hostOf } from "../shared/browserApp";
import { checkPage } from "../server/browserCheck";
import { cleanFamily, emptyFamily, isCurrentFamily } from "../shared/familyHub";

test("the address bar: web addresses open, words search", () => {
  assert.deepEqual(addressFor("https://example.com/a"), { kind: "url", url: "https://example.com/a" });
  assert.deepEqual(addressFor("en.wikipedia.org/wiki/Fold"), { kind: "url", url: "https://en.wikipedia.org/wiki/Fold" });
  const s = addressFor("best pizza near me");
  assert.equal(s?.kind, "search");
  assert.match(s!.url, /^https:\/\/duckduckgo\.com\/\?q=best%20pizza%20near%20me$/);
  assert.equal(addressFor("   "), null);
  assert.equal(hostOf("https://www.nytimes.com/x"), "nytimes.com");
});

test("a page opens inside the app only when its headers allow it", () => {
  assert.equal(frameAllowed({}), true);
  assert.equal(frameAllowed({ xFrameOptions: "SAMEORIGIN" }), false);
  assert.equal(frameAllowed({ xFrameOptions: "DENY" }), false);
  assert.equal(frameAllowed({ csp: "default-src 'self'; frame-ancestors 'self'" }), false);
  assert.equal(frameAllowed({ csp: "frame-ancestors 'none'" }), false);
  assert.equal(frameAllowed({ csp: "frame-ancestors *" }), true);
  assert.equal(frameAllowed({ csp: "frame-ancestors 'self' https://arisetodo.com" }), true);
  assert.equal(frameAllowed({ csp: "frame-ancestors https://*.arisetodo.com" }), true);
  assert.equal(frameAllowed({ csp: "frame-ancestors https://example.org" }), false);
  // frame-ancestors wins over X-Frame-Options
  assert.equal(frameAllowed({ xFrameOptions: "SAMEORIGIN", csp: "frame-ancestors *" }), true);
});

test("private and local addresses are refused", async () => {
  for (const ip of ["127.0.0.1", "10.2.3.4", "192.168.1.5", "172.20.0.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "::ffff:127.0.0.1", "100.64.0.1"]) assert.equal(isPrivateAddress(ip), true, ip);
  for (const ip of ["8.8.8.8", "151.101.1.69", "2606:4700::1111"]) assert.equal(isPrivateAddress(ip), false, ip);
  for (const url of ["http://127.0.0.1/", "http://localhost:3000/", "https://169.254.169.254/latest", "ftp://example.com/", "https://example.com:8443/", "https://user:pw@example.com/", "http://[::1]/"]) {
    const r = await checkPage(url);
    assert.equal(r.frameable, false, url);
    assert.equal(r.reason, "address", url);
  }
});

test("page titles are read and tidied", () => {
  assert.equal(pageTitle("<html><head><title> Fold &amp; Flip \n</title></head>"), "Fold & Flip");
  assert.equal(pageTitle("<p>no title</p>"), "");
});

test("bookmarks are kept in the family and cleaned", () => {
  const f = emptyFamily();
  assert.deepEqual(f.browserMarks, []);
  const clean = cleanFamily({ ...f, browserMarks: [{ id: "a", title: "Wiki", url: "https://en.wikipedia.org/" }, { id: "b", title: "bad", url: "javascript:alert(1)" }, { id: "c", title: "", url: "https://x.org" }] });
  assert.deepEqual(clean.browserMarks.map((m) => m.id), ["a", "c"]);
  assert.equal(clean.browserMarks[1].title, "x.org");
  const old: any = { ...f }; delete old.browserMarks;
  assert.equal(isCurrentFamily(old), false);
  assert.deepEqual(cleanFamily(old).browserMarks, []);
});
