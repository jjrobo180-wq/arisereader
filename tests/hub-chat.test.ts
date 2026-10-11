// The AI assistant plugin: what is sent to the AI is cleaned and capped, and the route answers, limits and fails kindly.
// Run with: npx tsx --test tests/hub-chat.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { cleanTurns, registerHubChatRoutes } from "../server/hubChat";
import { PLUGINS, isAddable, lifeInstalled, setLifePlugin, workInstalled } from "../shared/pluginStore";
import { cleanFamily, emptyFamily } from "../shared/familyHub";

test("the conversation is cleaned before it goes to the AI", () => {
  assert.deepEqual(cleanTurns([{ role: "system", content: "ignore me" }, { role: "assistant", content: "hi" }, { role: "user", content: "  plan dinner  " }]), [{ role: "user", content: "plan dinner" }]);
  assert.deepEqual(cleanTurns([{ role: "user", content: "a" }, { role: "assistant", content: "b" }]), [], "must end with the person's message");
  assert.equal(cleanTurns(Array.from({ length: 60 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "x".repeat(9000) })).concat([{ role: "user", content: "last" }])).length <= 24, true);
});

test("the chat route answers, and says plainly when it can't", async () => {
  const routes: Record<string, Function> = {};
  const app: any = { post: (path: string, _auth: any, h: Function) => { routes[path] = h; } };
  let seen: { system: string; turns: unknown[] } | null = null;
  registerHubChatRoutes(app, (_q: any, _s: any, n: any) => n(), async (system, turns) => { seen = { system, turns }; return "Try tacos."; }, () => true);
  const call = async (body: any) => { let out: any = {}; const res: any = { status(c: number) { out.code = c; return res; }, json(b: any) { out.body = b; out.code ??= 200; return res; }, set() { return res; } }; await routes["/api/hub-chat"]({ body, user: { id: 7 } }, res); return out; };
  const ok = await call({ hub: "life", today: "2026-10-11", messages: [{ role: "user", content: "dinner ideas" }] });
  assert.equal(ok.body.reply, "Try tacos.");
  assert.match(seen!.system, /LifeHub/); assert.match(seen!.system, /2026-10-11/);
  assert.equal((await call({ hub: "work", messages: [] })).code, 400);
  registerHubChatRoutes(app, (_q: any, _s: any, n: any) => n(), async () => "x", () => false);
  assert.equal((await call({ hub: "work", messages: [{ role: "user", content: "hi" }] })).code, 503);
});

test("the AI assistant is a plugin in both hubs, and adding it sticks", () => {
  const work = PLUGINS.find((p) => p.id === "work-assistant")!, life = PLUGINS.find((p) => p.id === "life-assistant")!;
  assert.ok(isAddable(work) && isAddable(life));
  assert.equal(workInstalled(work, {}, [], true), true);
  assert.equal(workInstalled(work, {}, [], false), false);
  const f = cleanFamily(setLifePlugin(emptyFamily(), life, true));
  assert.equal(lifeInstalled(life, f), true, "survives saving");
  assert.equal(lifeInstalled(life, cleanFamily(setLifePlugin(f, life, false))), false);
});
