import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("Cooked and Cooked PT draw To Duo's way inside To Duo: its boxes (not full-screen slides), buttons, pills and calm motion", () => {
  const ui = read("../client/src/pages/fit/fitUi.tsx");
  assert.ok(ui.includes("export const InDuoCtx = createContext(false)"));
  assert.ok(ui.includes("data-fit-duo-modal"), "a sheet is To Duo's box");
  assert.ok(ui.includes("html[data-fit-duo] .fit-shine::after{display:none!important}"));
  for (const f of ["CookedInDuo", "CookedPtInDuo"]) assert.ok(read(`../client/src/components/super-apps/${f}.tsx`).includes("<InDuoCtx.Provider value>"), f);
});

test("Podster's greys and Notes' serif and gradients become To Duo's colors, type and shapes", () => {
  const pod = read("../client/src/components/super-apps/podster-duo.css");
  for (const t of [".pod-duo .text-\\[\\#606060\\]", ".pod-duo .bg-\\[\\#0f0f0f\\]", ".pod-duo .bg-\\[\\#f2f2f2\\]", ".pod-duo.pod-duo-night .ps-dark .bg-white"]) assert.ok(pod.includes(t), t);
  assert.doesNotMatch(pod, /\[class\*="hover:/, "hover colors aren't painted on all the time");
  const notes = read("../client/src/components/super-apps/notes-duo.css");
  assert.ok(notes.includes("--an-serif: 'Barlow'") && notes.includes(".an-root.an-in-duo .an-primary { background: #6e5ae0"));
});

test("a Cooked box inside To Duo sits at the same level as Cooked's own sheets, so what opens from it (Preview, the account screen) shows on top", () => {
  const ui = read("../client/src/pages/fit/fitUi.tsx");
  assert.ok(ui.includes('fixed inset-0 z-[80] flex items-end justify-center bg-[#16152a]/65'));
  assert.ok(!ui.includes("z-[500] flex items-end justify-center bg-[#16152a]"));
});
