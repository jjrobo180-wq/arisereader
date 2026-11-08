// Arise Fit → Arise To Duo grocery list (November 2026). Run with: npx tsx --test tests/fit-to-duo-groceries.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mergeIntoFamilyList } from "../shared/fitMealPrep";
import { registerFitRoutes } from "../server/fit";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("items merge into the family list: same name updates, new ones are added, the cap holds", () => {
  let n = 0; const id = () => `n${++n}`;
  const list = [{ id: "a", name: "Eggs", qty: "12", aisle: "Dairy", checked: true }, { id: "b", name: "Spinach", qty: "", aisle: "Produce", checked: false }];
  const r = mergeIntoFamilyList(list, [{ name: " eggs ", qty: "24" }, { name: "Spinach" }, { name: "Greek yogurt", qty: "32 oz", aisle: "Dairy" }, { name: "" }], id);
  assert.equal(r.added, 1); assert.equal(r.updated, 1);
  assert.deepEqual(r.list.map((x) => [x.name, x.qty, x.checked]), [["Eggs", "24", false], ["Spinach", "", false], ["Greek yogurt", "32 oz", false]]);
  assert.equal(mergeIntoFamilyList([], Array.from({ length: 10 }, (_, i) => ({ name: `x${i}` })), id, 4).list.length, 4);
});

test("the route sends to the signed-in person's own list, and says when there is no Arise To Duo", async () => {
  const routes = new Map<string, any>(); const calls: any[] = [];
  const app: any = new Proxy({}, { get: (_t, m: string) => (path: any, ...h: any[]) => { if (typeof path === "string") routes.set(`${m} ${path}`, h.at(-1)); } });
  registerFitRoutes(app, ((_q: any, _r: any, n: any) => n()) as any, { addToDuoGroceries: async (uid, items) => { calls.push([uid, items]); return uid === 9 ? null : { added: items.length, updated: 0 }; } });
  const run = async (user: number | null, body: any) => { let status = 200, out: any; const res: any = { status(s: number) { status = s; return res; }, json(b: any) { out = b; return res; } }; await routes.get("post /api/fit/to-duo-groceries")({ user: user ? { id: user } : null, body }, res); return { status, out }; };
  assert.deepEqual((await run(5, { items: [{ name: "Oats", qty: "1 bag" }, { name: "  " }] })).out, { added: 1, updated: 0 });
  assert.deepEqual(calls[0], [5, [{ name: "Oats", qty: "1 bag", aisle: "" }]]);
  assert.equal((await run(5, { items: [] })).status, 400);
  assert.equal((await run(9, { items: [{ name: "Oats" }] })).status, 404);
  assert.equal((await run(null, { items: [{ name: "Oats" }] })).status, 403);
});

test("wired: the server writes the To Duo family list; Fit has the buttons", () => {
  const routes = read("server/routes.ts");
  assert.match(routes, /addToDuoGroceries: \(userId, items\) => updateTodoWorkspace\(userId,/);
  assert.match(routes, /mergeIntoFamilyList\(family\.groceries, items/);
  assert.match(read("client/src/pages/fit/FitMealPrep.tsx"), /testId="fit-grocery-duo"/);
  assert.match(read("client/src/pages/fit/FitFood.tsx"), /data-testid="fit-ai-grocery"/);
  assert.match(read("client/src/pages/fit/FitFood.tsx"), /<GroceryList token=\{token\}/);
});
