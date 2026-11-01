// Arise Fit matches its prototype: the blaze-orange look, five tabs with a sliding highlight, and motion.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f: string) => readFileSync(new URL(`../client/src/pages/fit/${f}`, import.meta.url), "utf8");

test("palette: Light by default (white cards on soft gray), Dark is graphite, one orange accent", () => {
  const ui = read("fitUi.tsx");
  const light = ui.slice(ui.indexOf("light: {"), ui.indexOf("dark: {"));
  const dark = ui.slice(ui.indexOf("dark: {"), ui.indexOf("} as const;"));
  for (const c of ['bg: "#f2f2f4"', 'card: "#ffffff"', 'text: "#111318"', 'dim: "#6b717c"', 'accent: "#ff5a1f"']) assert.ok(light.includes(c), `light ${c}`);
  for (const c of ['bg: "#15171b"', 'card: "#202329"', 'dim: "#a6acb5"', 'accent: "#ff5a1f"', 'blue: "#4d9fff"', 'amber: "#ffb020"']) assert.ok(dark.includes(c), `dark ${c}`);
  assert.match(ui, /lime: v\("accent"\)/, "screens use the accent through C.lime");
  assert.match(ui, /return x === "dark" \|\| x === "auto" \? x : "light"/, "Light unless Dark or Auto was chosen");
  assert.ok(!ui.includes("#c7a477"), "the old champagne accent is gone");
});

test("motion: entrances, fills, shine, scan, rest sheet and route draw, off for Reduce Motion", () => {
  const ui = read("fitUi.tsx");
  for (const k of ["fitIn", "fitSlide", "fitSheet", "fitPop", "fitBar", "fitShine", "fitPulse", "fitScan", "fitUp", "fitRoute"]) assert.ok(ui.includes(`@keyframes ${k}`), k);
  assert.match(ui, /prefers-reduced-motion/);
  assert.match(ui, /arise-fit-motion/);
  assert.match(read("FitTrain.tsx"), /fit-up fixed/);
  assert.match(read("FitFood.tsx"), /fit-scan/);
  assert.match(read("FitRun.tsx"), /className: "fit-route"/);
});

test("tabs: Today, Train, Food, Fast, Run, with a sliding highlight; Progress opens from Today", () => {
  const app = read("FitApp.tsx");
  assert.match(app, /\["fast", "Fast", Timer\], \["run", "Run", Route\]/);
  assert.match(app, /transition: "left \.35s/);
  assert.match(app, /<FastingSheet inline/);
  assert.match(app, /<OutdoorHub inline/);
  assert.match(app, /fit-open-progress/);
  assert.match(app, /key=\{tab\} className="fit-in"/);
});

test("finishing a workout shows the trophy screen", () => {
  const t = read("FitTrain.tsx");
  assert.match(t, /fit-pop grid h-\[104px\]/);
  assert.match(t, />Done\.</);
  assert.match(t, /Back to today/);
});

test("words never sit on top of video pictures; trails go through the server; US measurements", () => {
  const v = read("FitVideo.tsx");
  assert.match(v, /The video's name under it, not on top of it/);
  assert.doesNotMatch(v, /absolute inset-x-3 bottom-3 line-clamp-2/);
  const run = read("FitRun.tsx");
  assert.doesNotMatch(run, /fetch\(OVERPASS/);
  assert.match(run, /\/trails\?/);
  assert.match(run, /unit === "mi" \? \[5, 15, 30\]/);
  assert.match(read("FitFood.tsx"), /const OZ = 29\.5735/);
  assert.match(read("FitApp.tsx"), /lb · miles · ft\/in · oz/);
  const server = readFileSync(new URL("../server/fit.ts", import.meta.url), "utf8");
  assert.match(server, /app\.get\("\/api\/fit\/trails"/);
  assert.match(server, /overpass\.kumi\.systems/);
});

test("server: trails come from Overpass by the server, cached, with places from Nominatim", async () => {
  const { registerFitRoutes, createMemoryFitStore } = await import("../server/fit");
  const routes = new Map<string, any[]>();
  const app: any = { get: (p: string, ...h: any[]) => routes.set(`GET ${p}`, h), put: (p: string, ...h: any[]) => routes.set(`PUT ${p}`, h) };
  let asked = 0;
  registerFitRoutes(app, (_q: any, _r: any, next: any) => next(), { store: createMemoryFitStore(), overpass: async () => { asked++; return { elements: [{ type: "way", id: 5, tags: { name: "Ridge Trail", sac_scale: "hiking" }, center: { lat: 39.7, lon: -105 } }] }; },
    fetchJson: async () => [{ lat: "39.74", lon: "-104.99", display_name: "Denver, Colorado, United States" }] });
  const call = async (path: string, query: any) => { let out: any, status = 200; const res: any = { status(s: number) { status = s; return res; }, json(b: any) { out = b; return res; }, set() { return res; } }; const h = routes.get(`GET ${path}`)!; await h[h.length - 1]({ query, user: { id: 1 } }, res); return { status, out }; };
  const a = await call("/api/fit/trails", { lat: "39.7392", lng: "-104.9903", km: "24" });
  assert.equal(a.out.elements[0].tags.name, "Ridge Trail");
  await call("/api/fit/trails", { lat: "39.7391", lng: "-104.9902", km: "24" });
  assert.equal(asked, 1, "a nearby second search is answered from the cache");
  assert.equal((await call("/api/fit/trails", { lat: "x", lng: "1", km: "5" })).status, 400);
  assert.equal((await call("/api/fit/places", { q: "Denver" })).out.place.label, "Denver, Colorado");
});

test("full-screen views open on top of the whole app, never inside the scrolling page", () => {
  const ui = read("fitUi.tsx");
  assert.match(ui, /createPortal\(children, document\.body\)/);
  assert.match(ui, /return <Layer><div className="fit-sheet fixed inset-0/);
  // Entrance animations must not keep a transform once they finish (that traps "fixed" screens).
  for (const k of ["fitIn", "fitSlide", "fitSheet", "fitPop", "fitUp"]) assert.match(ui, new RegExp(`animation:${k} [^}]*backwards`), k);
  assert.doesNotMatch(ui, /animation:fit(In|Slide|Sheet|Pop|Up) [^}]* both/);
  assert.match(read("FitTrain.tsx"), /return <Layer><div className="fit-sheet fixed inset-0 z-\[70\]/);
  assert.match(read("FitRun.tsx"), /return <Layer><div className="fit-sheet fixed inset-0 z-\[85\]/);
});
