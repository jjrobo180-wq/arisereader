// Two phone fixes: sheets that sit at the bottom of the screen move up above the keyboard (so the
// food search and what it finds stay in sight while typing), and barcode scanning works on
// iPhone, where Safari has no barcode reader of its own.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const files = (dir: string): string[] => readdirSync(join(ROOT, dir)).flatMap((n) => {
  const p = join(dir, n);
  return statSync(join(ROOT, p)).isDirectory() ? files(p) : /\.tsx$/.test(n) ? [p] : [];
});

test("every sheet that sits at the bottom of the screen can move up above the keyboard", () => {
  const sheets: string[] = [];
  for (const f of files("client/src")) {
    for (const m of read(f).matchAll(/["`](fixed inset-0 [^"`]*items-end[^"`]*)["`]/g)) {
      // The login screen's sample chooser scrolls as a whole page and has nothing to type in.
      if (f.endsWith("pages/Login.tsx") && m[1].includes("overflow-y-auto")) continue;
      sheets.push(`${f}: ${m[1].slice(0, 60)}`);
      assert.match(m[1], /\bkb-sheet\b/, `${f} has a bottom sheet without kb-sheet`);
    }
  }
  assert.ok(sheets.length >= 20, `${sheets.length} sheets`);
  assert.ok(sheets.some((s) => s.includes("family-hub/ui.tsx")), "LifeHub's sheets");
  assert.ok(sheets.some((s) => s.includes("teacher-hub/HubModal.tsx")), "WorkHub's sheets");
});

test("the keyboard watcher is on for the whole app, and the sheets fit the visible screen", () => {
  const main = read("client/src/main.tsx");
  assert.match(main, /import "\.\/keyboard-inset\.css";/);
  assert.match(main, /import \{ watchKeyboard \} from "\.\/lib\/keyboardInset";/);
  assert.match(main, /\nwatchKeyboard\(\);\n/);
  const css = read("client/src/keyboard-inset.css");
  assert.match(css, /html\.kb-open \.kb-sheet \{[^}]*top: var\(--kb-top, 0px\) !important;[^}]*height: var\(--kb-height, 100%\) !important;/);
  assert.match(css, /html\.kb-open \.kb-sheet > \* \{[^}]*max-height: calc\(100% - 0\.5rem\) !important;/);
  assert.match(css, /\[data-keyboard-top\] \+ \* \{[^}]*min-height: var\(--kb-height/);
  const watcher = read("client/src/lib/keyboardInset.ts");
  assert.match(watcher, /visualViewport/);
  assert.doesNotMatch(watcher, /\(\?<[=!]/, "no lookbehind (older iPhones can't parse it)");
});

test("the food search stays at the top while typing, so results show", () => {
  const health = read("client/src/components/family-hub/Health.tsx");
  assert.match(health, /<div className="sticky -top-5 [^"]*" data-keyboard-top=""><div className="relative"><Search /);
  assert.match(health, /aria-label="Search foods" enterKeyHint="search"/);
});

test("barcode scanning uses the app's own reader where the browser has none (iPhone)", () => {
  const health = read("client/src/components/family-hub/Health.tsx");
  assert.match(health, /import \{ canUseCamera, scanWithCamera \} from "@\/lib\/barcodeScanner";/);
  assert.doesNotMatch(health, /BarcodeDetector|canScan\(/, "no longer limited to browsers with BarcodeDetector");
  assert.match(health, /canUseCamera\(\) && <button onClick=\{\(\) => setScan\(\{ busy: false, error: "", camera: true \}\)\}/);
  assert.match(health, /Line the barcode up in the box\. It reads by itself\./);
  assert.match(health, /className=\{plain \+ " shrink-0 whitespace-nowrap"\}/, "Look up stays on one line");
  assert.doesNotMatch(read("client/src/lib/foodLookup.ts"), /canScan/);

  const scanner = read("client/src/lib/barcodeScanner.ts");
  assert.match(scanner, /import \{ expandUpcE, lookupCode, readPicture \} from "@shared\/barcode";/);
  assert.match(scanner, /getUserMedia\(\{ audio: false, video: \{ facingMode: \{ ideal: "environment" \}/);
  assert.match(scanner, /best\.hits >= 2 \|\| `\$\{best\.format\}:\$\{best\.text\}` === previous/, "two lines or two frames must agree");
  assert.match(scanner, /stream\?\.getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/, "the camera is switched off when done");
  assert.doesNotMatch(scanner, /\(\?<[=!]/);
  assert.doesNotMatch(read("shared/barcode.ts"), /\(\?<[=!]/);
});

test("a UPC-E code is also looked up as the UPC-A it stands for, and a 12-digit UPC-A with a leading 0", () => {
  const server = read("server/foodLookup.ts");
  assert.match(server, /barcodeCandidates\(code\)/);
  return import("../shared/foodLookup").then((m) => {
    assert.deepEqual(m.barcodeCandidates("04252614"), ["04252614", "042100005264", "0042100005264"]);
    assert.deepEqual(m.barcodeCandidates("036000291452"), ["036000291452", "0036000291452"]);
    assert.deepEqual(m.barcodeCandidates("5901234123457"), ["5901234123457"]);
    assert.deepEqual(m.barcodeCandidates("96385074"), ["96385074"]);
  });
});
