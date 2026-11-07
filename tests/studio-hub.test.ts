// The Studio looks in Arise To Duo and WorkHub (November 2026). Each look draws the hubs the way its preview
// and Arise Notes draw it: Stickies is a wall of sticky notes, Receipts paper slips, Tape Rack cassettes,
// Chronograph a dial, and so on. They all shared one plain Home before, only the colors and type changed.
// Run with: npx tsx --test tests/studio-hub.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PROTO_SPECS, PROTO_LOOKS, contrast } from "../shared/protoLooks";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const hub = () => read("client/src/components/arise-notes/protoHub.tsx");
const css = () => read("client/src/components/arise-notes/protoHub.css");
const archs = [...new Set(PROTO_SPECS.map((s) => s.arch))];
/** The body of a function in protoHub.tsx, up to the next top-level declaration. */
const body = (src: string, start: string) => { const i = src.indexOf(start); assert.ok(i >= 0, start); const j = src.indexOf("\nexport ", i + start.length); return src.slice(i, j < 0 ? undefined : j); };

test("every Studio arrangement draws its own list of tasks, days and notes (none falls back to a plain list)", () => {
  const list = body(hub(), "export function ArchList");
  for (const a of archs) assert.match(list, new RegExp(`case "${a}":`), `${a} has its own list`);
});

test("every Studio arrangement has its own top of Home in the hubs", () => {
  const hero = body(hub(), "export function archHubHero");
  for (const a of archs.filter((x) => x !== "billboard")) assert.match(hero, new RegExp(`case "${a}":`), `${a} has its own top of Home`);
  // Billboard keeps the one it had (protoLooks.tsx); the rest go to protoHub.tsx.
  assert.match(read("client/src/components/arise-notes/protoLooks.tsx"), /if \(look\.arch !== "billboard"\) return archHubHero\(/);
});

test("the hub's Home, Tasks, Calendar and Notes all use the look's arrangement", () => {
  const os = read("client/src/components/look-os/LookOS.tsx");
  assert.match(os, /if \(hasArch\(p\.look\)\) return <StudioHome /);
  assert.doesNotMatch(os, /los-studio-home/, "the shared plain Home is gone");
  for (const kind of ["tasks", "days", "notes"]) assert.match(os, new RegExp(`<ArchList look=\\{p\\.look\\} kind="${kind}"`), `Home's ${kind}`);
  // Tasks and Calendar go through LookTaskList / LookAgenda, which hand Studio looks to the arrangement.
  const proto = read("client/src/components/arise-notes/protoLooks.tsx");
  assert.match(proto, /return <ArchList look=\{look\} kind="tasks" items=\{taskItems\(/);
  assert.match(proto, /return <ArchList look=\{look\} kind="days" items=\{dayItems\(/);
  // Notes (LifeHub's and WorkHub's) draws its notes the look's way.
  assert.match(read("client/src/components/family-hub/Notes.tsx"), /notes\.length && look\?\.arch \? <ArchList look=\{look\} kind="notes"/);
});

test("each arrangement's list is dressed in protoHub.css", () => {
  const s = css();
  for (const cls of ["sh-sticky", "sh-wall", "sh-receipt", "sh-tiles", "sh-cons", "sh-strips", "sh-tapes", "sh-dots", "sh-deckcard", "sh-books", "sh-lined", "sh-paper", "sh-tline", "sh-rows", "sh-ix", "sh-tl", "sh-week", "sh-ed", "sh-tiles2", "sh-st", "sh-dialface", "sh-bento", "sh-rhead", "sh-tapbig"]) {
    assert.ok(s.includes(`.${cls} `) || s.includes(`.${cls}{`), `${cls} is styled`);
  }
  // Its rules outrank the Notes app's generic ones (".stx.stx-s small" turned the sticky notes' words grey).
  for (const line of s.split("\n")) {
    const m = /^(\.stx[^{]*)\{/.exec(line);
    if (m) for (const sel of m[1].split(",")) assert.ok(sel.trim().startsWith(".stx.stx"), `${sel.trim()} starts with .stx.stx`);
  }
});

test("a done check, not a word, marks a task done on every board, and a note's pin stays reachable", () => {
  const h = hub();
  assert.match(h, /aria-pressed=\{c\.pressed\} aria-label=\{c\.label\}/);
  assert.match(h, /label: t\.done \? `Reopen \$\{t\.title\}` : `Complete \$\{t\.title\}`/);
  assert.match(h, /label: n\.pinned \? `Unpin \$\{title\}` : `Pin \$\{title\}`/);
});

test("Receipts and Field Notes have words on their bar, like their Notes screens", () => {
  const os = read("client/src/components/look-os/LookOS.tsx");
  assert.match(os, /const words = WORDS\[look\.id\] \?\? \(look\.arch \? ARCH_WORDS\[look\.arch\] : undefined\);/);
  assert.match(os, /receipt: \{ home: "HOME", tasks: "TASKS"/);
});

test("every Studio look's accent words read on its own background (Peel Pad's were 3.0 to 1)", () => {
  for (const t of PROTO_LOOKS) assert.ok(contrast(t.accentInk, t.bg) >= 4.5, `${t.id}: ${contrast(t.accentInk, t.bg).toFixed(2)}`);
});
