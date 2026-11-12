import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NOTES_PLANS } from "../shared/ariseNotes";

const page = readFileSync("client/public/notes-landing.html", "utf8");
const server = readFileSync("server/index.ts", "utf8");

test("arisetodo.com/notes/ shows the Notes homepage to signed-out visitors and the app to everyone else", () => {
  const route = server.slice(server.indexOf('app.get("/notes/"'), server.indexOf("// The light To-Do homepage"));
  assert.match(route, /notes-landing\.html/);
  assert.match(route, /arise_session=/, "a sign-in cookie gets the app");
  assert.match(route, /req\.query\.app !== undefined/, "/notes/?app always gets the app");
  assert.match(route, /endsWith\("\/notes\/"\)/, "only the exact /notes/ address");
  assert.match(route, /no-store/);
});

test("the homepage sends app links, signed-in visitors and the installed app on to the app", () => {
  assert.match(page, /location\.replace\("\/notes\/\?app"/);
  assert.match(page, /arise_session_backup/);
  assert.match(page, /display-mode: standalone/);
  const manifest = JSON.parse(readFileSync("client/public/notes-app/manifest.webmanifest", "utf8"));
  assert.equal(manifest.start_url, "/notes/?app");
});

test("the homepage matches the other Arise homepages and shows every part of Notes", () => {
  assert.match(page, /<title>Arise Notes: Notes Super App/);
  for (const cls of ["site-header", "hero-grid", "features-grid", "pricing-section", "faq-section", "bottom-cta", "site-footer"]) assert.ok(page.includes(`class="${cls}`) || page.includes(` ${cls}"`), cls);
  for (const id of ["features", "record", "ask", "undercover", "apps", "devices", "tutorial", "pricing", "faq", "whats-new"]) assert.match(page, new RegExp(`id="${id}"`), id);
  for (const cmd of ["@ariserecord", "@arisepause", "@ariseresume", "@arisemark", "@arisestop"]) assert.ok(page.includes(cmd), cmd);
  for (const href of page.match(/href="#[a-z-]+"/g) ?? []) {
    const id = href.slice(7, -1);
    if (id !== "top") assert.match(page, new RegExp(`id="${id}"`), `menu link ${id} has a section`);
  }
  for (const use of new Set((page.match(/href="#i-[a-z]+"/g) ?? []).map((u) => u.slice(6, -1)))) assert.match(page, new RegExp(`<symbol id="${use.slice(1)}"`), `icon ${use}`);
});

test("the prices on the homepage are the real Notes prices", () => {
  for (const id of ["basic", "plus", "family"] as const) {
    const p = NOTES_PLANS[id];
    assert.ok(page.includes(`$${(p.monthlyCents / 100).toFixed(2)}`), `${id} price`);
    assert.ok(page.includes(p.minutes.toLocaleString("en-US")), `${id} minutes`);
  }
  assert.ok(page.includes(`$${((NOTES_PLANS.plus.yearlyCents ?? 0) / 100).toFixed(2)} a year`));
  assert.ok(page.includes(`${NOTES_PLANS.free.minutes} AI minutes a month`));
});

test("Sign up links open the create-account form", () => {
  assert.match(page, /\/notes\/\?app#\/signup/);
  assert.match(readFileSync("client/src/notes/main.tsx", "utf8"), /\^#\\\/\(signup\|register\)\/\.test\(window\.location\.hash\) \? "up" : "in"/);
});
