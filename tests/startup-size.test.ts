import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Every app (To Duo, Reader, Notes, Cooked, Cooked PT, AAC, Talk, Educator, Undercover) runs client/src/main.tsx
// first, and everything it imports (not import()) must be read and run before the first screen. Keep it small:
// the sign-in code once pulled in every hub's data model (1 MB more), and the iPhone apps opened slowly.
const root = resolve(".");
const alias: Record<string, string> = { "@/": "client/src/", "@shared/": "shared/" };
const exts = ["", ".ts", ".tsx", ".js", ".css", "/index.ts", "/index.tsx"];
function find(spec: string, from: string): string | null {
  let base: string | null = null;
  for (const [a, p] of Object.entries(alias)) if (spec.startsWith(a)) base = join(root, p, spec.slice(a.length));
  if (!base && spec.startsWith(".")) base = resolve(dirname(from), spec);
  if (!base) return null; // a package
  for (const e of exts) { const f = base + e; if (existsSync(f) && statSync(f).isFile()) return f; }
  return null;
}
function startupFiles(): Map<string, number> {
  const seen = new Map<string, number>();
  const stack = [join(root, "client/src/main.tsx")];
  const re = /(?:^|\n)\s*(?:import\s+(?!type\b)(?:[^'"]*?\s+from\s+)?|export\s+(?!type\b)[^'"]*?\s+from\s+)["']([^"']+)["']/g;
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    const src = readFileSync(f, "utf8");
    seen.set(f, src.length);
    if (!/\.(tsx?|jsx?)$/.test(f)) continue;
    for (const m of src.matchAll(re)) { const next = find(m[1], f); if (next) stack.push(next); }
  }
  return seen;
}

test("the code every app loads first stays small", () => {
  const files = startupFiles();
  const total = [...files.values()].reduce((a, b) => a + b, 0);
  assert.ok(total < 800_000, `startup source is ${Math.round(total / 1024)} KB (limit 800,000 bytes)`);
});

test("no hub data models, catalogs or other apps' screens in the startup code", () => {
  const names = [...startupFiles().keys()].map((f) => f.slice(root.length + 1));
  for (const heavy of ["shared/familyHub.ts", "shared/teacherHub.ts", "shared/pluginKit.ts", "shared/iepWriter/index.ts", "shared/kitchen.ts",
    "client/src/lib/nativeReminders.ts", "client/src/components/tour/TourScenes.tsx", "client/src/components/WorkHubTour.tsx",
    "client/src/components/AdvisoryChallenge.tsx", "client/src/pages/TeacherSignup.tsx", "shared/ariseNotes.ts"]) {
    assert.ok(!names.includes(heavy), `${heavy} is loaded at startup`);
  }
});
