import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NOTES_PLANS } from "../shared/ariseNotes";

const ALL_ACCESS_PRICE = 10;

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

test("the homepage shows the same two plans as the app: Free and Arise All Access", () => {
  const pricing = page.slice(page.indexOf('id="pricing"'), page.indexOf('id="faq"'));
  assert.equal((pricing.match(/class="pricing-card"/g) ?? []).length, 2);
  assert.match(pricing, /\$0 <span>\/ month/);
  assert.match(pricing, /Arise All Access/);
  assert.ok(pricing.includes(`$${ALL_ACCESS_PRICE} <span>/ month`));
  assert.ok(pricing.includes(`${NOTES_PLANS.free.minutes} AI minutes a month`));
  assert.ok(pricing.includes(`${NOTES_PLANS.plus.minutes.toLocaleString("en-US")} minutes a month`));
  assert.doesNotMatch(page, /\$4\.99|\$7\.99|\$9\.99/, "no separate Notes plans on the homepage");
});

test("the top of the page is about meeting notes and Undercover AI", () => {
  const hero = page.slice(page.indexOf('<section class="hero">'), page.indexOf('class="intro-strip"'));
  assert.match(hero, /Meeting notes/);
  assert.match(hero, /Undercover/);
  assert.match(hero, /class="uc-card"/);
  assert.match(hero, /class="nm-window"/);
});

test("Sign up links open the create-account form", () => {
  assert.match(page, /\/notes\/\?app#\/signup/);
  assert.match(readFileSync("client/src/notes/main.tsx", "utf8"), /\^#\\\/\(signup\|register\)\/\.test\(window\.location\.hash\) \? "up" : "in"/);
});
