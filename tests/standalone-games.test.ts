// Twinlight Run and Chime of Aoren: the two self-contained games shown in a frame on the Games page.
// Run with: npx tsx --test tests/standalone-games.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
// @ts-expect-error a plain build script with no types
import { GAMES, page } from "../client/standalone-games/build.mjs";
import { CLUB_WORLD_PATHS } from "../shared/clubPlay";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const TITLES: Record<string, string> = { "twinlight-run": "Twinlight Run", "chime-of-aoren": "Chime of Aoren" };

test("the built game pages match their sources", () => {
  assert.deepEqual([...GAMES].sort(), Object.keys(TITLES).sort());
  for (const name of GAMES) {
    assert.equal(read(`client/public/standalone/${name}.html`), page(name), `${name}.html is stale: run node client/standalone-games/build.mjs`);
  }
});

test("each game is one complete page with everything inside it", () => {
  for (const name of GAMES) {
    const html = read(`client/public/standalone/${name}.html`);
    assert.ok(html.startsWith("<!doctype html>"), name);
    assert.ok(html.includes(`<title>${TITLES[name]}</title>`), name);
    assert.ok(html.indexOf("<title>") < html.indexOf("</head>") && html.indexOf("</head>") < html.indexOf('<div id="app">'), `${name}: title and styles belong in the head`);
    // no outside scripts, images or media: a school network that blocks other sites must still run the game
    assert.equal(/<script[^>]+src=/i.test(html), false, `${name} loads an outside script`);
    assert.equal(/<(img|audio|video|iframe)\b/i.test(html), false, `${name} loads outside media`);
    const links = [...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(links.every((href) => href.startsWith("https://fonts.googleapis.com/")), `${name}: only the font stylesheet may come from outside`);
    assert.equal(/\bfetch\(|XMLHttpRequest|WebSocket\(/.test(html), false, `${name} talks to a server`);
  }
});

test("the game scripts are valid JavaScript", () => {
  for (const name of GAMES) {
    const html = read(`client/public/standalone/${name}.html`);
    const scripts = html.split("<script>").slice(1).map((s) => s.split("</script>")[0]);
    assert.equal(scripts.length, 2, name);
    for (const code of scripts) assert.doesNotThrow(() => new vm.Script(code), name);
  }
});

test("inside the site each reader has their own save and a way back to the Games page", () => {
  for (const name of GAMES) {
    const js = read(`client/standalone-games/${name}.js`), html = read(`client/standalone-games/${name}.html`);
    // saves are kept per reader, so two students on one school computer don't share a score or a chapter
    for (const m of js.matchAll(/store\.(get|set)\(([^,)]+)/g)) assert.ok(m[2].startsWith("skey("), `${name}: ${m[0]} is not saved per reader`);
    assert.ok(js.includes("QS.get('u')") && js.includes("QS.get('host') === 'arise'"), name);
    // "Back to Games" buttons exist, start hidden, and only show inside the site
    assert.ok((html.match(/class="[^"]*\bexit\b[^"]*" hidden/g) || []).length >= 3, `${name}: Back to Games buttons`);
    assert.ok(js.includes("b.hidden = !HOSTED") && js.includes("type: 'arise-game-exit'"), name);
  }
  const host = read("client/src/pages/StandaloneGame.tsx");
  assert.ok(host.includes('e.data.type === "arise-game-exit"') && host.includes('navigate("/games")'));
  assert.ok(host.includes("e.origin !== window.location.origin"), "messages from other sites are ignored");
  assert.ok(host.includes("/standalone/${file}.html?host=arise&u="));
});

test("both games are wired into the site like the other game worlds", () => {
  const app = read("client/src/App.tsx"), games = read("client/src/pages/Games.tsx"), scenes = read("client/src/arcade/covers/scenesWorlds.tsx");
  const fullscreen = /const FULLSCREEN_GAME_ROUTES = \[([^\]]+)\]/.exec(app)![1];
  for (const [name, id] of [["twinlight-run", "twinlight"], ["chime-of-aoren", "aoren"]]) {
    const route = "/" + name;
    assert.ok(app.includes(`<Route path="${route}">`), `${route} has a page`);
    assert.ok(app.includes(`file="${name}" title="${TITLES[name]}"`), route);
    assert.ok(fullscreen.includes(`"${route}"`), `${route} hides the site's tabs and popups`);
    // counted against daily play time, the same as every other game world
    assert.ok(CLUB_WORLD_PATHS.includes(route), `${route} follows the play-time rules`);
    assert.ok(games.includes(`id: "${id}", title: "${TITLES[name]}"`) && games.includes(`path: "${route}"`), `${id} is on the Games page`);
    assert.ok(new RegExp(`\\b${id}: \\(\\) => import\\("\\./StandaloneGame"\\)`).test(games), `${id} can be warmed up`);
    assert.ok(new RegExp(`\\n  ${id}: \\w+,`).test(scenes), `${id} has cover art`);
  }
  // every world id used on a shelf is a real world
  const ids = [...games.matchAll(/\n    id: "(\w+)", title:/g)].map((m) => m[1]);
  for (const list of games.matchAll(/(?:TOP_GAMES|ROTATION): WorldId\[\] = \[([^\]]+)\]|worlds: \[([^\]]+)\]/g)) {
    for (const id of (list[1] || list[2]).split(",").map((s) => s.trim().replace(/"/g, ""))) assert.ok(ids.includes(id), `"${id}" is on a shelf but is not a world`);
  }
});
