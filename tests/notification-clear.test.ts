// Cleared bell items stay cleared. Run with: npx tsx --test tests/notification-clear.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addDismissals, cleanKeys, dismissedKeys, isLocalKey, parseDismissals } from "../shared/notificationDismiss";
import { lifeAlerts } from "../shared/lifeAlerts";
import { emptyFamily } from "../shared/familyHub";
import { workAlerts } from "../shared/hubAlerts";
import { normalizeWorkspace } from "../shared/teacherHub";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const DAY = 24 * 3600 * 1000;

test("only life: and work: keys are accepted, once each", () => {
  assert.deepEqual(cleanKeys(["life:task:a:2026-10-15", "work:polls:2:5", "life:task:a:2026-10-15", "row:12", "msg:3", "", 7, null, "life:", "life:has space", "x".repeat(300)]), ["life:task:a:2026-10-15", "work:polls:2:5"]);
  assert.deepEqual(cleanKeys("life:task:a"), []);
  assert.deepEqual(cleanKeys(undefined), []);
  assert.equal(cleanKeys(Array.from({ length: 500 }, (_, i) => `life:t:${i}`)).length, 100, "one request carries at most 100");
  assert.ok(isLocalKey("life:x") && isLocalKey("work:x") && !isLocalKey("row:1"));
});

test("a saved list only grows, and survives being read back", () => {
  const now = Date.now();
  let list = addDismissals([], ["life:task:a:2026-10-15"], now);
  list = addDismissals(list, ["work:meeting:m1:2026-10-15", "life:task:a:2026-10-15"], now + 1);
  assert.deepEqual(dismissedKeys(list).sort(), ["life:task:a:2026-10-15", "work:meeting:m1:2026-10-15"]);
  const again = parseDismissals(JSON.stringify(list), now + 2);
  assert.deepEqual(again, list);
  assert.equal(addDismissals(list, ["row:9"], now), list, "nothing valid to add leaves the list alone");
});

test("junk and old entries are dropped, and the list is capped", () => {
  const now = Date.now();
  assert.deepEqual(parseDismissals("not json", now), []);
  assert.deepEqual(parseDismissals({}, now), []);
  const mixed = [{ k: "life:old", at: now - 200 * DAY }, { k: "life:new", at: now - DAY }, { k: "bad", at: now }, { k: "life:nan", at: "x" }, "work:bare"];
  assert.deepEqual(dismissedKeys(parseDismissals(mixed, now)).sort(), ["life:new", "work:bare"]);
  let list = parseDismissals([], now);
  for (let i = 0; i < 6; i++) list = addDismissals(list, Array.from({ length: 100 }, (_, j) => `life:t:${i}:${j}`), now + i);
  assert.equal(list.length, 400);
  assert.ok(dismissedKeys(list).includes("life:t:5:99") && !dismissedKeys(list).includes("life:t:0:0"), "the newest are kept");
});

test("an item comes back only when it really changed", () => {
  const family = emptyFamily();
  const task = (due: string) => [{ id: "t1", title: "Pay rent", due, time: "", done: false }];
  const now = new Date(2026, 9, 15, 12, 0).getTime();
  const a = lifeAlerts(family, task("2026-10-14"), "2026-10-15", now)[0].key;
  assert.equal(lifeAlerts(family, task("2026-10-14"), "2026-10-15", now + 3600_000)[0].key, a, "same task, same key, later in the day");
  assert.equal(lifeAlerts(family, task("2026-10-14"), "2026-10-16", now + DAY)[0].key, a, "still overdue tomorrow: still cleared");
  assert.notEqual(lifeAlerts(family, task("2026-10-15"), "2026-10-15", now)[0].key, a, "moved to a new date: shows again");
  const ws = normalizeWorkspace({ tasks: [{ id: "w1", title: "Grade", dueDate: "2026-10-14", done: false }] });
  const w = workAlerts(ws, "2026-10-15", now)[0].key;
  assert.equal(workAlerts(ws, "2026-10-16", now + DAY)[0].key, w);
  const moved = normalizeWorkspace({ tasks: [{ id: "w1", title: "Grade", dueDate: "2026-10-20", done: false }] });
  assert.notEqual(workAlerts(moved, "2026-10-20", now)[0].key, w);
  for (const k of [a, w, workAlerts(ws, "2026-10-15", now, 3, "2026-10-15T10:00:00Z")[0].key]) assert.equal(cleanKeys([k]).length, 1, `${k} can be saved`);
});

test("the server remembers and returns them on every feed", () => {
  const routes = read("server/routes.ts");
  assert.match(routes, /notification_dismissed_local_\$\{userId\}/);
  assert.equal((routes.match(/withLocal\(userId,/g) || []).length, 3, "admin, teacher and member feeds all carry the list");
  assert.match(routes, /await addLocalDismissals\(userId, localKeys\)[\s\S]*?if \(clearAll\)/, "saved before anything else, so { all: true } keeps them too");
  assert.match(routes, /!Array\.isArray\(body\.local\)\)/, "a request that only carries cleared items is not mistaken for 'clear everything'");
  assert.match(read("shared/notifications.ts"), /dismissedLocal\?: string\[\]/);
});

test("the bell saves a clear in the browser first and on the account, and merges both on every load", () => {
  const bell = read("client/src/components/NotificationBell.tsx");
  assert.match(bell, /arise-bell-cleared:/);
  assert.match(bell, /!clearedKeys\.has\(item\.key\)/);
  assert.match(bell, /updateCleared\(\(list\) => addDismissals\(list, local\)\)[\s\S]*?fetch\(/, "browser copy is written before the request");
  assert.match(bell, /body\.local = local/);
  assert.match(bell, /next\.dismissedLocal/);
  assert.match(bell, /addEventListener\("storage"/);
  assert.match(bell, /body: JSON\.stringify\(\{ local: missing \}\)/, "anything only this browser knows is passed on to the account");
});
