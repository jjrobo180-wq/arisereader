import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");
const fit = read("client/public/cooked-landing.html");
const pt = read("client/public/cooked-pt-landing.html");
const server = read("server/index.ts");
const coach = read("shared/coach.ts");

test("Cooked homepages are served at /cooked/ and /cooked-pt/, signed-in visitors go to the app", () => {
  assert.match(server, /"\/cooked\/": \{ file: "cooked-landing\.html", app: "\/app#\/fit" \}/);
  assert.match(server, /"\/cooked-pt\/": \{ file: "cooked-pt-landing\.html", app: "\/app#\/trainer" \}/);
  assert.match(server, /app\.get\(\["\/cooked", "\/cooked-pt"\]/, "no-slash addresses redirect to the page");
  // The routes sit before the To Duo /app handler and the static files.
  assert.ok(server.indexOf('"/cooked/"') < server.indexOf('app.get("/app"'));
});

test("each page has sign in, sign up, pricing, FAQ and interactive previews", () => {
  for (const [name, s, hash] of [["fit", fit, "#/fit"], ["trainer", pt, "#/trainer"]] as const) {
    assert.ok(s.includes(`href="/app${hash}"`), `${name}: Sign in`);
    assert.ok(s.includes(`href="/app?start=signup${hash}"`), `${name}: sign up`);
    assert.ok(s.includes('id="pricing"') && s.includes('id="faq"') && s.includes('id="tutorial"'), `${name}: sections`);
    assert.ok((s.match(/<details>/g) || []).length >= 8, `${name}: at least 8 FAQs`);
    assert.ok(s.includes('class="phone"') && s.includes("data-go="), `${name}: tappable phone preview`);
    assert.ok(s.includes('application/ld+json'), `${name}: search data`);
    assert.ok(!/href="\/(privacy|terms|support)"/.test(s), `${name}: policy links use the folder address`);
  }
});

test("prices on the pages match the app", () => {
  assert.ok(fit.includes("Cooked Fitness by Arise: Premium All in one Health &amp; Fitness App"));
  assert.ok(fit.includes('<div class="price">$10<span> a month</span>') && fit.includes('<div class="price">$0</div>'));
  const m = coach.match(/LISTING = \{ cents: (\d+), trialDays: (\d+)/);
  assert.ok(m, "LISTING found");
  assert.ok(pt.includes(`$${Number(m![1]) / 100}<span> a month`), "trainer price");
  assert.ok(pt.includes(`${m![2]} days free`), "trial length");
  const fee = read("shared/coachPay.ts").match(/PLATFORM_FEE_PCT = (\d+(?:\.\d+)?)/);
  assert.ok(fee, "fee found");
  assert.ok(pt.includes(`Arise keeps ${fee![1]}%`), "card fee");
  assert.ok(pt.includes(`g*${Number(fee![1]) / 100}`), "calculator uses the same fee");
});

test("the website sign-in shows each app's own screen", () => {
  const app = read("client/src/App.tsx");
  assert.match(app, /<AppSignInGate flavor="fit">/);
  assert.match(app, /<AppSignInGate flavor="trainer">/);
  assert.match(read("client/src/pages/NativeSignIn.tsx"), /flavor: forced, start/);
});

test("Podster homepage has pricing and Sign in, and the app opens sign-in from the link", () => {
  const home = read("podscroll/index.html");
  assert.ok(home.includes('id="pricing"') && home.includes('href="#pricing"'));
  assert.ok(home.includes('href="/app/?signin"') && home.includes('href="/app/?signup"'));
  assert.ok(home.includes("$10<span> a month"));
  assert.match(read("podscroll/main.tsx"), /q\.has\("signup"\) \? "signup" : q\.has\("signin"\) \? "signin"/);
});

test("Podster is built into arisetodo.com at /podster/", () => {
  const build = read("script/build.ts");
  assert.match(build, /PODSTER_BASE = "\/podster\/"/);
  assert.match(build, /configFile: "podscroll\/vite\.config\.ts", build: \{ outDir: path\.resolve\("dist\/public\/podster"\)/);
  assert.match(build, /links outside \/podster\//, "the build fails if a link leaves /podster/");
  assert.match(read("podscroll/vite.config.ts"), /process\.env\.PODSTER_BASE \|\| "\/"/);
  // The worker and install file work in any folder.
  const sw = read("podscroll/public/sw.js");
  assert.ok(sw.includes('const BASE = self.location.pathname.replace(/sw\\.js$/, "")') && !/"\/app\/"/.test(sw));
  const manifest = JSON.parse(read("podscroll/public/manifest.webmanifest"));
  assert.equal(manifest.start_url, "app/");
  assert.ok(manifest.icons.every((i: { src: string }) => !i.src.startsWith("/")));
  assert.match(read("podscroll/main.tsx"), /register\(import\.meta\.env\.BASE_URL \+ "sw\.js"\)/);
  // Same-site API on arisetodo.com, and the live-party socket accepts it.
  assert.match(read("podscroll/main.tsx"), /BASE_URL === "\/podster\/" \? location\.origin/);
  assert.match(read("server/earshot.ts"), /PODSCROLL_ORIGINS = \["https:\/\/arisetodo\.com", "https:\/\/www\.arisetodo\.com"/);
});

test("the old Podster address forwards to arisetodo.com/podster/", () => {
  for (const f of ["podscroll/index.html", "podscroll/app/index.html", "podscroll/creators/index.html", "podscroll/public/privacy/index.html", "podscroll/public/terms/index.html", "podscroll/public/support/index.html"]) {
    const s = read(f);
    assert.ok(s.includes('if(location.hostname==="podscroll.onrender.com")location.replace("https://arisetodo.com/podster"+location.pathname'), f);
  }
  for (const f of ["client/public/cooked-landing.html", "client/public/cooked-pt-landing.html", "podscroll/Account.tsx", "client/src/components/family-hub/earshot/social/Rules.tsx"]) {
    assert.ok(!read(f).includes("https://podscroll.onrender.com/"), `${f} uses the new address`);
  }
});
