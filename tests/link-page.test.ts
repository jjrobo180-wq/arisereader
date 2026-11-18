// Link page (November 2026): a minimal profile page (social icons + quiet rows, four themes), a card on
// Home, an iPhone widget with a QR code, and a proper chat preview of the shared address.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanFamily, emptyFamily } from "../shared/familyHub";
import { linkBrand, linkHost, monogram, splitLinks } from "../shared/linkPageLook";
import { sharedView } from "../shared/todoShare";
import { registerTodoShareRoutes } from "../server/todoShare";
import { cleanSlots } from "../client/src/lib/widgets";
import { fakeSupabase } from "./helpers/fakeSupabase";

const read = (p: string) => readFileSync(p, "utf8");
const L = (title: string, url: string, emoji = "🔗") => ({ id: title, title, url, emoji });

test("social profiles become a row of icons; everything else is a row showing its site", () => {
  const links = [L("Insta", "https://www.instagram.com/jr"), L("Portfolio", "https://jr.design"), L("TikTok", "https://tiktok.com/@jr"), L("Email me", "mailto:jr@x.test"), L("Second Insta", "https://instagram.com/jr2"), L("Shop", "https://shop.jr.design/new")];
  const { icons, rows } = splitLinks(links);
  assert.deepEqual(icons.map((l) => l.brand.id), ["instagram", "tiktok", "email"]);
  assert.deepEqual(rows.map((l) => l.title), ["Portfolio", "Second Insta", "Shop"], "one icon per site; a second profile is a row");
  assert.equal(linkHost("https://www.jr.design/work"), "jr.design");
  assert.equal(linkHost("mailto:jr@x.test"), "jr@x.test");
  assert.equal(linkBrand("https://youtu.be/abc")?.id, "youtube");
  assert.equal(linkBrand("https://x.com/jr")?.name, "X");
  assert.equal(linkBrand("https://notinstagram.com"), null);
  assert.equal(monogram("Jermaine Robinson"), "JR");
  assert.equal(monogram("  maya "), "M");
  assert.equal(monogram(""), "?");
});

test("the theme is saved and shared; Paper (white) is the default and isn't stored", () => {
  const f = cleanFamily({ ...emptyFamily(), linkPage: { title: "JR", bio: "", theme: "sand", links: [L("Site", "https://jr.design")] } });
  assert.equal(f.linkPage.theme, "sand");
  assert.equal("theme" in cleanFamily({ ...emptyFamily(), linkPage: { title: "", bio: "", theme: "light", links: [] } }).linkPage, false);
  assert.equal("theme" in cleanFamily({ ...emptyFamily(), linkPage: { title: "", bio: "", theme: "neon", links: [] } }).linkPage, false);
  const view = sharedView({ family: f }, { kind: "links" }, "2026-11-15");
  assert.ok(view && view.kind === "links");
  assert.equal(view.theme, "sand");
});

test("the shared address previews as the person's page in chat apps", async () => {
  const family = { ...emptyFamily(), linkPage: { title: "Jermaine <Robinson>", bio: "Teacher & builder", links: [L("Site", "https://jr.design")] } };
  const db = fakeSupabase({ arise_todo_workspaces: [{ user_id: 7, workspace: { family }, updated_at: "2026-11-15T10:00:00.000Z" }], todo_shares: [{ token: "a".repeat(24), user_id: 7, target: "links", revoked: false }] }, { keys: { todo_shares: ["token"] } });
  const routes: Record<string, any> = {};
  const app: any = { get: (p: string, ...h: any[]) => { routes[p] = h[h.length - 1]; }, post: () => {}, put: () => {}, delete: () => {} };
  registerTodoShareRoutes(app, ((_q: any, _s: any, n: any) => n()) as any, { db, appUrl: "https://arisetodo.com", ownerAllowed: async () => true, ownerName: async () => "Jermaine" });
  let html = "";
  const res: any = { set: () => res, type: () => res, send: (b: string) => { html = b; return res; } };
  await routes["/share/:token"]({ params: { token: "a".repeat(24) }, headers: { "x-forwarded-for": "1.2.3.4" }, socket: {} }, res);
  assert.match(html, /<title>Jermaine &lt;Robinson&gt;<\/title>/);
  assert.match(html, /<meta property="og:description" content="Teacher &amp; builder">/);
  assert.match(html, /location\.replace\("\/#\/share\/a{24}"\)/);
});

test("the iPhone widget gets a QR code of the page (https only), and the app sends it", () => {
  const [slot] = cleanSlots([{ id: "duo.linkpage", title: "Jermaine Robinson", value: "JR", detail: "arisetodo.com/share/abc", qr: "https://arisetodo.com/share/abcdefghijklmnopqrstuv" }]);
  assert.equal(slot.qr, "https://arisetodo.com/share/abcdefghijklmnopqrstuv");
  assert.equal(cleanSlots([{ id: "duo.linkpage", title: "x", value: "x", qr: "javascript:alert(1)" }])[0].qr, undefined);
  const swift = read("native/widget-extension/AriseWidgets.swift");
  assert.match(swift, /CIFilter\.qrCodeGenerator\(\)/);
  assert.match(swift, /struct LinkPageWidget \{/);
  assert.match(swift, /var qr: String\?/);
  assert.match(read(".github/scripts/add_widget.rb"), /LinkPageWidget\(id: /);
  assert.match(read("client/src/pages/AriseTodo.tsx"), /isNativeApp\(\) && family\.linkPage\.links\.length > 0 && <LinkPageWidgetFeed page=\{family\.linkPage\} \/>/);
});

test("the public page is the minimal page, full screen; Home shows a Link page card", () => {
  const share = read("client/src/pages/TodoShare.tsx");
  assert.match(share, /if \(view\?\.kind === "links"\) return <div data-testid="todo-share"><LinkPageView /);
  assert.match(read("client/src/components/family-hub/FamilyHome.tsx"), /<LinkPageCard page=\{family\.linkPage\} say=\{say\} onEdit=\{\(\) => go\("links"\)\} \/>/);
  assert.match(read("client/src/components/family-hub/LinkPage.tsx"), /data-testid="link-theme"/);
});
