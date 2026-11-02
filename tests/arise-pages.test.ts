// Arise Notes → Notes: typed and handwritten notes, synced across devices.
//   Syncing: a save names the revision it started from; another device's newer save is never
//            overwritten (409 with the newer copy). Offline-made notes keep their id.
//   Privacy: nobody reaches another person's note; locked notes reach the server only encrypted, and
//            the server keeps nothing readable from them (no title, preview, search text or tags).
//   Encryption: the notes password unlocks; a wrong one doesn't; ciphertext opens only with the key.
//   Recently Deleted, version history, search, limits, AI never on locked notes, exports.
// Run with: npx tsx --test tests/arise-pages.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { PAGE_BYTES_MAX, cleanPage, cleanSettings, tagsIn, type Page } from "../shared/arisePages";
import { registerPagesRoutes } from "../server/arisePages";
import { createMemoryPagesStore } from "../server/arisePagesStore";
import { lockContent, makeVault, unlockContent, unlockVault } from "../client/src/components/arise-notes/pages/pagesLock";
import { htmlToMarkdown, jpegSize } from "../client/src/components/arise-notes/pages/pagesExport";

const NOW = Date.parse("2026-11-15T18:00:00Z");
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function server(t: any, ask?: any) {
  const store = createMemoryPagesStore();
  const users: Record<number, any> = { 2: { id: 2, role: "parent" }, 3: { id: 3, role: "teacher" } };
  const app = express();
  app.use(express.json({ limit: "9mb" }));
  app.use((req: any, _res, next) => { const u = users[Number(req.headers["x-user"])]; if (u) req.user = u; next(); });
  registerPagesRoutes(app, (_req, _res, next) => next(), { store, ask, aiReady: () => true, now: () => NOW });
  const srv = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => srv.once("listening", () => r()));
  t.after(() => srv.close());
  const base = `http://127.0.0.1:${(srv.address() as any).port}`;
  const call = async (user: number | null, method: string, path: string, body?: any) => {
    const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(user ? { "x-user": String(user) } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
  };
  return { store, call };
}
const textPage = (html: string, title = "Plan", extra: Partial<Page> = {}) => ({ kind: "text", content: { title, html, ink: [], look: { theme: "cream", font: "serif" } }, ...extra });

test("a note is cleaned: safe HTML, its look, a preview and hashtags; handwriting keeps only valid strokes", () => {
  const p = cleanPage({ id: ID(1), kind: "text", content: { title: "  Week   plan ", html: '<h2>Monday</h2><p onclick="x()">Read <b>ch. 4</b> #reading <script>alert(1)</script></p><img src="javascript:alert(1)">', look: { theme: "midnight", font: "nope", size: 99 } } }, "2026-11-15T18:00:00.000Z");
  assert.equal(p.content.title, "Week plan");
  assert.doesNotMatch(p.content.html, /script|onclick|javascript/);
  assert.match(p.content.html, /<h2>Monday<\/h2>/);
  assert.deepEqual([p.content.look.theme, p.content.look.font, p.content.look.size], ["midnight", "system", 28]);
  assert.match(p.preview, /^Monday\s+Read ch\. 4 #reading/);
  assert.deepEqual(p.tags, ["reading"]);
  assert.deepEqual(tagsIn("#IEP notes and #reading-log, not#this"), ["iep", "reading-log"]);

  const ink = cleanPage({ id: ID(2), kind: "ink", content: { ink: [{ paper: "grid", tint: "sky", strokes: [{ t: "pen", c: "#123456", w: 3, p: [10, 20, 0.5, 30, 40, 0.9] }, { t: "pen", c: "red", p: ["x"] }, { nope: 1 }], bg: "data:text/html;base64,AAAA" }] }, inkText: "Photosynthesis notes" }, "2026-11-15T18:00:00.000Z");
  assert.equal(ink.content.ink[0].strokes.length, 1, "bad strokes are dropped");
  assert.equal(ink.content.ink[0].bg, undefined, "only pictures can be backgrounds");
  assert.deepEqual([ink.content.ink[0].paper, ink.content.ink[0].tint], ["grid", "sky"]);
  assert.match(ink.search, /Photosynthesis/, "what the iPhone read from the handwriting is searchable");
  assert.equal(cleanPage({ id: ID(3), kind: "ink", content: {} }, "2026-11-15T18:00:00.000Z").content.ink.length, 1, "a handwritten note has at least one page");
});

test("syncing: saves build on a revision, and another device's newer save is never overwritten", async (t) => {
  const { call } = await server(t);
  const made = await call(2, "PUT", `/api/pages/${ID(10)}`, { page: textPage("<p>first</p>"), baseRev: 0 });
  assert.equal(made.status, 200);
  assert.equal(made.body.page.rev, 1);
  assert.equal(made.body.page.id, ID(10), "the device's own id is kept (notes made offline)");

  const phone = await call(2, "PUT", `/api/pages/${ID(10)}`, { page: textPage("<p>from the phone</p>"), baseRev: 1 });
  assert.equal(phone.body.page.rev, 2);
  // The laptop still had revision 1.
  const laptop = await call(2, "PUT", `/api/pages/${ID(10)}`, { page: textPage("<p>from the laptop</p>"), baseRev: 1 });
  assert.equal(laptop.status, 409);
  assert.match(laptop.body.page.content.html, /from the phone/, "the newer copy comes back so the device can keep both");
  const now = await call(2, "GET", `/api/pages/${ID(10)}`);
  assert.match(now.body.page.content.html, /from the phone/, "nothing was overwritten");

  const again = await call(2, "PUT", `/api/pages/${ID(10)}`, { page: textPage("<p>new</p>"), baseRev: 0 });
  assert.equal(again.status, 409, "making a note with an id that exists doesn't replace it");

  const list = await call(2, "GET", "/api/pages");
  assert.deepEqual(list.body.pages.map((p: any) => [p.id, p.rev, p.title]), [[ID(10), 2, "Plan"]]);
  assert.equal(list.body.pages[0].content.html, "", "the list leaves the content out");
  const later = await call(2, "GET", `/api/pages?since=${encodeURIComponent(list.body.now)}`);
  assert.equal(later.body.pages.length, 0, "only what changed since the last sync");
});

test("nobody reaches someone else's note", async (t) => {
  const { call } = await server(t);
  await call(2, "PUT", `/api/pages/${ID(20)}`, { page: textPage("<p>private</p>"), baseRev: 0 });
  const notFound = "That note isn't here. It may have been deleted.";
  for (const r of [
    await call(3, "GET", `/api/pages/${ID(20)}`),
    await call(3, "DELETE", `/api/pages/${ID(20)}`),
    await call(3, "POST", `/api/pages/${ID(20)}/restore`),
    await call(3, "GET", `/api/pages/${ID(20)}/versions`),
  ]) assert.deepEqual([r.status, r.body.message], [404, notFound]);
  assert.equal((await call(3, "PUT", `/api/pages/${ID(20)}`, { page: textPage("<p>mine now</p>"), baseRev: 1 })).status, 404);
  assert.equal((await call(3, "GET", "/api/pages")).body.pages.length, 0);
  assert.equal((await call(3, "GET", "/api/pages/search?q=private")).body.pages.length, 0);
  assert.equal((await call(3, "POST", "/api/pages/forever", { ids: [ID(20)] })).body.removed, 0);
  assert.match((await call(2, "GET", `/api/pages/${ID(20)}`)).body.page.content.html, /private/);
  assert.equal((await call(null, "GET", "/api/pages")).status, 403);
});

test("locked notes: the password unlocks, a wrong one doesn't, and the server keeps nothing readable", async (t) => {
  const { vault, key } = await makeVault("correct horse", "a horse");
  assert.equal(vault.hint, "a horse");
  assert.ok(vault.iter >= 310_000);
  assert.equal(await unlockVault(vault, "wrong horse"), null);
  const again = await unlockVault(vault, "correct horse");
  assert.ok(again);

  const content = { title: "Doctor visit", html: "<p>Blood pressure 120/80 #health</p>", ink: [], look: cleanPage({ kind: "text" }, "x").content.look };
  const cipher = await lockContent(key, content);
  assert.doesNotMatch(cipher.data, /Doctor|pressure/);

  const { call, store } = await server(t);
  const saved = await call(2, "PUT", `/api/pages/${ID(30)}`, { page: { kind: "text", locked: true, cipher, content: { ...content, title: "LEAK", html: "<p>LEAK</p>" }, tags: ["leak"], inkText: "LEAK" }, baseRev: 0 });
  assert.equal(saved.status, 200);
  const raw = store._pages.get(ID(30))!;
  assert.equal(raw.locked, true);
  assert.equal(JSON.stringify({ ...raw, cipher: null }).includes("LEAK"), false, "nothing the device sent in the clear is kept");
  assert.deepEqual([raw.content.title, raw.content.html, raw.preview, raw.search, raw.tags.length], ["", "", "", "", 0]);
  assert.equal((await call(2, "GET", "/api/pages/search?q=pressure")).body.pages.length, 0);

  const opened = await unlockContent(again!, { ...(saved.body.page as Page), cipher: raw.cipher });
  assert.deepEqual([opened.title, opened.html], ["Doctor visit", "<p>Blood pressure 120/80 #health</p>"]);
  const other = await makeVault("correct horse");
  await assert.rejects(unlockContent(other.key, { ...(saved.body.page as Page), cipher: raw.cipher }), "the same password with another salt is another key");

  // A "locked" note without real ciphertext is just an ordinary note.
  const fake = await call(2, "PUT", `/api/pages/${ID(31)}`, { page: { kind: "text", locked: true, cipher: { v: 1, iv: "!!", data: "" }, content: { title: "Plain", html: "<p>x</p>" } }, baseRev: 0 });
  assert.deepEqual([fake.body.page.locked, fake.body.page.content.title], [false, "Plain"]);

  // AI never reads a locked note; a forgotten password clears locked notes only.
  const ai = await call(2, "POST", `/api/pages/${ID(30)}/ai`, { action: "summarize" });
  assert.equal(ai.status, 400);
  const reset = await call(2, "POST", "/api/pages/forever", { ids: [ID(30), ID(31)], lockedReset: true });
  assert.equal(reset.body.removed, 1);
  assert.ok(store._pages.has(ID(31)), "unlocked notes are kept");
  assert.deepEqual(cleanSettings({ vault }).vault, vault, "the vault keeps only the salt, rounds, check and hint");
  assert.equal(JSON.stringify(cleanSettings({ vault: { ...vault, password: "correct horse" } as any })).includes("correct horse"), false);
});

test("Recently Deleted, deleting for good, version history and search", async (t) => {
  const { call, store } = await server(t);
  await call(2, "PUT", `/api/pages/${ID(40)}`, { page: textPage("<p>Photosynthesis makes glucose</p>", "Bio"), baseRev: 0 });
  assert.equal((await call(2, "POST", "/api/pages/forever", { ids: [ID(40)] })).body.removed, 0, "only notes already in Recently Deleted");
  const del = await call(2, "DELETE", `/api/pages/${ID(40)}`);
  assert.ok(del.body.page.deletedAt);
  assert.equal((await call(2, "GET", "/api/pages/search?q=glucose")).body.pages.length, 0, "deleted notes aren't in search");
  const back = await call(2, "POST", `/api/pages/${ID(40)}/restore`);
  assert.equal(back.body.page.deletedAt, null);
  assert.deepEqual((await call(2, "GET", "/api/pages/search?q=glucose")).body.pages.map((p: any) => p.id), [ID(40)]);

  const rev = (await call(2, "GET", `/api/pages/${ID(40)}`)).body.page.rev;
  await call(2, "PUT", `/api/pages/${ID(40)}`, { page: textPage("<p>Edited</p>", "Bio"), baseRev: rev });
  const versions = (await call(2, "GET", `/api/pages/${ID(40)}/versions`)).body.versions;
  assert.equal(versions.length, 1);
  const v = (await call(2, "GET", `/api/pages/${ID(40)}/versions/${versions[0].rev}`)).body.version;
  assert.match(v.content.html, /Photosynthesis/, "the earlier words are kept");

  await call(2, "DELETE", `/api/pages/${ID(40)}`);
  assert.equal((await call(2, "POST", "/api/pages/forever", { ids: [ID(40)] })).body.removed, 1);
  assert.equal(store._pages.has(ID(40)), false);
  assert.equal(store._versions.has(ID(40)), false, "its versions go too");

  await call(2, "PUT", `/api/pages/${ID(41)}`, { page: textPage("<p>old</p>"), baseRev: 0 });
  await call(2, "DELETE", `/api/pages/${ID(41)}`);
  store._pages.get(ID(41))!.deletedAt = "2026-09-01T00:00:00.000Z";
  assert.equal(await store.purgeTrash("2026-10-16T00:00:00.000Z"), 1, "gone after 30 days");
});

test("settings sync with revisions; limits; AI on typed notes", async (t) => {
  const asked: string[] = [];
  const ask = async (system: string, user: string) => { asked.push(`${system}\n${user}`); return { json: system.includes("action items") ? { items: [{ title: "Email Ms. Lee", due: "2026-11-20" }, { title: "" }] } : { text: "Short summary." }, chars: 10 }; };
  const { call } = await server(t, ask);
  const folder = { id: ID(90), name: "School", color: "#6a55dc", icon: "🍎" };
  const s1 = await call(2, "PUT", "/api/pages-settings", { settings: { folders: [folder], prefs: { view: "list", sort: "title" } }, baseRev: 0 });
  assert.deepEqual([s1.status, s1.body.settings.rev, s1.body.settings.folders[0].name, s1.body.settings.prefs.view], [200, 1, "School", "list"]);
  assert.equal((await call(2, "PUT", "/api/pages-settings", { settings: { folders: [] }, baseRev: 0 })).status, 409, "an older device doesn't wipe the folders");

  const big = "<p>" + "x".repeat(PAGE_BYTES_MAX) + "</p>";
  assert.equal((await call(2, "PUT", `/api/pages/${ID(50)}`, { page: textPage(big), baseRev: 0 })).status, 413);
  assert.equal((await call(2, "PUT", "/api/pages/not-an-id", { page: textPage("<p>x</p>"), baseRev: 0 })).status, 400);

  await call(2, "PUT", `/api/pages/${ID(51)}`, { page: textPage("<p>Need to email Ms. Lee about the field trip by Friday.</p>"), baseRev: 0 });
  const sum = await call(2, "POST", `/api/pages/${ID(51)}/ai`, { action: "summarize" });
  assert.deepEqual([sum.status, sum.body.text], [200, "Short summary."]);
  assert.match(asked[0], /field trip/);
  const todos = await call(2, "POST", `/api/pages/${ID(51)}/ai`, { action: "todos" });
  assert.deepEqual(todos.body.items, [{ title: "Email Ms. Lee", due: "2026-11-20" }]);
  assert.match(asked[1], /Today is 2026-11-15/);
  assert.equal((await call(2, "POST", `/api/pages/${ID(51)}/ai`, { action: "hack" })).status, 400);
  assert.equal((await call(2, "POST", `/api/pages/${ID(51)}/planner`, { tasks: [{ title: "x" }] })).status, 503, "LifeHub not set up in this test");
});

test("exports: Markdown from a typed note, and the JPEG size reader the PDF uses", () => {
  const md = htmlToMarkdown('<h2>Plan</h2><p>Read <b>ch. 4</b> and <i>take</i> notes</p><ul data-check="true"><li data-checked="true">Book</li><li data-checked="false">Pen</li></ul><ol><li>One</li><li>Two</li></ol><table><tr><th>Q</th><th>A</th></tr><tr><td>Why?</td><td>Because</td></tr></table><blockquote>Quote</blockquote>');
  assert.match(md, /^### Plan/m);
  assert.match(md, /Read \*\*ch\. 4\*\* and \*take\* notes/);
  assert.match(md, /- \[x\] Book\n- \[ \] Pen/);
  assert.match(md, /1\. One\n2\. Two/);
  assert.match(md, /\| Q \| A \|\n\| --- \| --- \|\n\| Why\? \| Because \|/);
  assert.match(md, /^> Quote/m);
  // A tiny JPEG header: SOI, then a SOF0 frame 300 tall and 200 wide.
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x00, 0xc8, 0x03]);
  assert.deepEqual(jpegSize(jpg), { w: 200, h: 300 });
});
