// Cooked's popups inside To Do (the add-exercise picker, add food, every edit screen) are iPhone-style bottom
// sheets: a grab handle you can swipe down, a pinned title bar, a pinned search box and a pinned main button
// so only the list or form between them scrolls, and they rest on top of the keyboard.
// Run with: npx tsx --test tests/fit-sheet.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DISMISS_DISTANCE, DISMISS_SPEED, DRAG_START, FLICK_MIN, dragOffset, shouldDismiss } from "../shared/sheetDrag";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

test("the sheet follows a finger down but never up", () => {
  assert.equal(dragOffset(57), 57);
  assert.equal(dragOffset(0), 0);
  assert.equal(dragOffset(-80), 0);
  assert.equal(dragOffset(NaN), 0);
});

test("a long slow pull closes the sheet, a short one springs back", () => {
  assert.equal(shouldDismiss(DISMISS_DISTANCE, 900, 776), true, "pulled the full distance");
  assert.equal(shouldDismiss(DISMISS_DISTANCE - 1, 900, 776), false, "a hair short, and slow");
  assert.equal(shouldDismiss(30, 400, 776), false);
  assert.equal(shouldDismiss(0, 100, 776), false);
  assert.equal(shouldDismiss(-50, 100, 776), false, "pulling up never closes it");
});

test("a quick flick closes it from a short pull", () => {
  assert.equal(shouldDismiss(60, 60, 776), true, "1 px per ms");
  assert.equal(shouldDismiss(FLICK_MIN, FLICK_MIN / DISMISS_SPEED, 776), true, "exactly the flick speed");
  assert.equal(shouldDismiss(FLICK_MIN - 1, 10, 776), false, "too short to be a flick, even when fast");
  assert.equal(shouldDismiss(60, 400, 776), false, "slow and short");
});

test("a small sheet closes after a shorter pull (40% of its height) and a zero-height one can't be closed by a nudge", () => {
  assert.equal(shouldDismiss(80, 900, 200), true, "40% of 200 is 80");
  assert.equal(shouldDismiss(79, 900, 200), false);
  assert.equal(shouldDismiss(5, 900, 0), false, "no height known: not by a tiny pull");
  assert.ok(DRAG_START >= 4 && DRAG_START <= 10, "a tap on the close button is not a drag");
});

const ui = read("client/src/pages/fit/fitUi.tsx");
const sheetSrc = ui.slice(ui.indexOf("export function Sheet("), ui.indexOf("export function Chips<"));

test("inside To Do the popup is a keyboard-aware bottom sheet with a handle, pinned bar, pinned top and pinned footer", () => {
  const duo = sheetSrc.slice(sheetSrc.indexOf("if (duo) return"), sheetSrc.indexOf("return <Layer><div className=\"fit-sheet"));
  assert.match(duo, /className="kb-sheet fit-duo-scrim fixed inset-0 /, "rests on the keyboard (lib/keyboardInset.ts)");
  assert.match(duo, /fit-duo-sheet/, "slides up");
  assert.match(duo, /data-sheet-bar[^>]*\{\.\.\.sheet\.handlers\}/, "the handle and title bar take the swipe");
  assert.match(duo, /h-\[5px\] w-10 rounded-full sm:hidden/, "the grab handle, phones only");
  assert.match(duo, /\{top && <div data-sheet-top /);
  assert.match(duo, /data-sheet-body data-sheet-pad className="min-h-0 flex-1 overflow-y-auto overscroll-contain/, "only the middle scrolls");
  assert.match(duo, /\{footer && <div data-sheet-foot /);
  assert.match(duo, /h-\[92dvh\]/, "tall sheets keep one height while a list changes");
  assert.match(duo, /maxHeight: "calc\(100dvh - var\(--sat,env\(safe-area-inset-top,0px\)\) - 10px\)"/, "never under the clock or the notch");
  assert.match(duo, /aria-label="Close"/);
});

test("the page behind a bottom sheet is locked while it is open", () => {
  assert.match(sheetSrc, /useEffect\(\(\) => \(duo && !inline \? lockPageScroll\(\{ fixed: true \}\) : undefined\), \[duo, inline\]\);/);
  assert.match(ui, /import \{ lockPageScroll \} from "@\/lib\/scrollLock";/);
});

test("on its own (not in To Do) a screen keeps its old layout: top and footer just sit before and after the content", () => {
  assert.match(sheetSrc, /\{top\}\{children\}\{stuckFooter\}/, "the full-screen sheet keeps a sticky main button");
  assert.match(sheetSrc, /\{top\}\{children\}\{plainFooter\}/, "a tab keeps it in the flow");
});

test("the slide-up is turned off by Reduce Motion and doesn't use the animations To Do switches off", () => {
  assert.match(ui, /\.fit-duo-sheet\{animation:fitDuoSheet /);
  assert.match(ui, /prefers-reduced-motion: reduce\)\{\.fit-duo-scrim,\.fit-duo-sheet,/);
  const calm = ui.slice(ui.indexOf("To Do is calm"), ui.indexOf("To Do's shapes"));
  assert.doesNotMatch(calm, /fit-duo-sheet|fit-duo-scrim/);
});

test("the keyboard rule drops the home-bar gap while the keyboard is up", () => {
  assert.match(read("client/src/keyboard-inset.css"), /html\.kb-open \.kb-sheet \[data-sheet-pad\] \{\s*padding-bottom: 12px !important;/);
});

test("the exercise picker pins its search box; the filters and the list scroll; the exercise page pins Add to workout", () => {
  const t = read("client/src/pages/fit/FitTrain.tsx");
  const lib = t.slice(t.indexOf("export function Library("), t.indexOf("// ——— The live workout"));
  assert.match(lib, /<Sheet title=\{title\} onClose=\{onClose\} testId="fit-library" tall top=\{<div className="relative"><Search /);
  assert.match(lib, /data-testid="fit-library-search"/);
  const detail = t.slice(t.indexOf("export function ExerciseDetail("), t.indexOf("export function Library("));
  assert.match(detail, /testId="fit-exercise" tall footer=\{onAdd \? <Btn onClick=\{onAdd\} className="w-full" testId="fit-exercise-add">/);
  assert.doesNotMatch(detail, /sticky bottom-0/, "no more fake sticky button inside the scroll");
});

test("add food pins its tabs and search box on top, and the Add button at the bottom", () => {
  const f = read("client/src/pages/fit/FitFood.tsx");
  const main = f.slice(f.indexOf("onClose={onClose} testId=\"fit-add-food\""));
  assert.match(main, /testId="fit-add-food" tall top=\{<>\s*<Chips label="How to add"/);
  assert.match(main, /\{tab === "search" && <div className="relative mt-3">[\s\S]*?data-testid="fit-food-search" \/><\/div>\}\s*<\/>\}/, "the search box is in the pinned part");
  assert.match(main, /footer=\{tab === "quick" \? <Btn type="submit" form="fit-quick-form" /, "quick add's button is pinned");
  assert.match(main, /<form id="fit-quick-form" /, "Enter in a box still submits");
  const picked = f.slice(f.indexOf("if (picked) {"), f.indexOf("onClose={onClose} testId=\"fit-add-food\""));
  assert.match(picked, /footer=\{<Btn className="w-full" onClick=\{\(\) => add\(picked, n\)\} testId="fit-food-add">/);
  assert.doesNotMatch(picked, /<Btn className="mt-6 w-full"/, "the Add button no longer scrolls away with the form");
});

test("Btn can be tied to a form by id (a button in the pinned footer submits the form above it)", () => {
  assert.match(ui, /type\?: "button" \| "submit"; \/\*\*[^*]*\*\/ form\?: string \}\)/);
  assert.equal((ui.match(/<button type=\{type\} form=\{form\} /g) || []).length, 2, "both looks (Cooked's and To Do's)");
});
