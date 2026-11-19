import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("premium apps (Potty Training…) open inside LifeHub with the menu beside them, not on a page of their own", () => {
  const todo = read("../client/src/pages/AriseTodo.tsx");
  assert.ok(todo.includes("ProAppInHub") && todo.includes('data-testid="lifehub-pro-app"'));
  assert.match(todo, /if \(pro\) \{ closeApps\(\); setKitOpen\(`pro:\$\{pro\}`\); \}/, "opening it from the Plugin Gallery stays in LifeHub");
  assert.ok(todo.includes('if (go === "pro")'), "links (#/lifehub?go=pro&app=potty) open it in LifeHub");
  const pro = read("../client/src/pages/ProApps.tsx");
  assert.ok(pro.includes("export function ProAppInHub"));
  assert.ok(pro.includes("#/lifehub?go=pro&app="), "old #/pro?app=potty links (timer notifications) land in LifeHub");
});
