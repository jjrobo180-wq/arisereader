// A.R.I.S.E. To-Do share links and phone reminders.
// Run with: npx tsx --test tests/todo-share.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { emptyFamily } from "../shared/familyHub";
import { guestToday, parseTarget, sharedView, targetKey, targetLabel } from "../shared/todoShare";
import { dueTodoReminders } from "../shared/todoReminders";
import { registerTodoShareRoutes } from "../server/todoShare";
import { fakeSupabase } from "./helpers/fakeSupabase";

const TODAY = "2026-10-09"; // a Friday
function workspace() {
  const family = emptyFamily();
  family.members = [
    { id: "m1", name: "Dana", emoji: "🙂", color: "#7566e8", kind: "adult" },
    { id: "k1", name: "Sam", emoji: "⚽", color: "#36b6a5", kind: "kid" },
  ];
  family.polls = [{ id: "p1", question: "What's for dinner?", kind: "dinner", options: [{ id: "a", label: "Tacos" }, { id: "b", label: "Pizza" }], votes: { m1: "a" }, closed: false, createdAt: "2026-10-08T00:00:00Z", closesOn: TODAY }];
  family.bills = [
    { id: "b1", name: "Rent", amount: 1500, dueDay: 1, category: "Housing", autopay: false, paid: ["2026-10"] },
    { id: "b2", name: "Electric", amount: 92.5, dueDay: 10, category: "Utilities", autopay: false, paid: [] },
  ];
  family.events = [{ id: "e1", title: "Soccer practice", date: "2026-10-02", time: "17:30", endTime: "18:30", calendarId: "activities", memberIds: ["k1"], location: "Field 3", notes: "secret note", repeat: "weekly" }];
  family.chores = [{ id: "c1", title: "Dishes", memberId: "k1", rotation: [], days: [], points: 2 }];
  family.trips = [{ id: "t1", name: "Beach week", destination: "Outer Banks", start: "2026-10-20", end: "2026-10-25", budget: 2000, notes: "", stops: [], packing: [{ id: "x", item: "Sunscreen", memberId: "k1", packed: false }] }];
  family.goals = [{ id: "g1", title: "Read 20 books", why: "", category: "learning", memberId: "k1", due: "", kind: "number", target: 20, current: 5, unit: "books", milestones: [], done: false, createdAt: "", doneAt: "" }];
  family.health.food = [
    { id: "f1", memberId: "m1", date: TODAY, meal: "lunch", name: "Salad", servings: 1, calories: 400, protein: 10, carbs: 20, fat: 10 },
    { id: "f2", memberId: "k1", date: TODAY, meal: "lunch", name: "Sandwich", servings: 1, calories: 500, protein: 10, carbs: 20, fat: 10 },
  ];
  return {
    version: 2,
    lists: [{ id: "home", name: "Home", color: "#7566e8" }, { id: "work", name: "Work", color: "#36b6a5" }],
    tasks: [
      { id: "t-a", title: "Call the dentist", notes: "", listId: "home", assignee: "Dana", due: TODAY, time: "09:00", priority: "normal", repeat: "none", done: false, createdAt: "" },
      { id: "t-b", title: "Quarterly report", notes: "", listId: "work", assignee: "", due: "2026-10-01", time: "", priority: "high", repeat: "none", done: false, createdAt: "" },
    ],
    family,
  };
}

test("share targets are read strictly", () => {
  assert.deepEqual(parseTarget("poll:p1"), { kind: "poll", id: "p1" });
  assert.deepEqual(parseTarget("tasks"), { kind: "tasks", id: "" });
  assert.deepEqual(parseTarget("trip:t1"), { kind: "trips", id: "t1" });
  assert.equal(targetKey(parseTarget("trip:t1")!), "trip:t1");
  assert.equal(targetKey(parseTarget("tasks:home")!), "tasks:home");
  for (const bad of ["poll", "bills:x", "health", "nope", "poll:a:b", "poll:<script>", 5, null]) assert.equal(parseTarget(bad), null, String(bad));
  assert.equal(targetLabel(workspace(), { kind: "poll", id: "p1" }), "Poll: What's for dinner?");
});

test("a poll link counts family votes and guest votes, and nothing else from the hub", () => {
  const view = sharedView(workspace(), { kind: "poll", id: "p1" }, TODAY, { guests: [{ voter: "g1", name: "Grandma", optionId: "b" }, { voter: "g2", name: "Uncle", optionId: "gone" }] });
  assert.ok(view && view.kind === "poll");
  assert.equal(view.open, true);
  assert.deepEqual(view.options.map((o) => o.votes), [1, 1]);
  assert.equal(view.total, 2);
  assert.deepEqual(view.guests, ["Grandma"]);
  assert.ok(!JSON.stringify(view).includes("Rent"));
  const closed = sharedView(workspace(), { kind: "poll", id: "p1" }, "2026-10-10");
  assert.ok(closed && closed.kind === "poll" && !closed.open);
  assert.equal(sharedView(workspace(), { kind: "poll", id: "missing" }, TODAY), null);
});

test("a list link shows only that list", () => {
  const view = sharedView(workspace(), { kind: "tasks", id: "work" }, TODAY);
  assert.ok(view && view.kind === "tasks");
  assert.equal(view.lists.length, 1);
  assert.equal(view.lists[0].tasks[0].title, "Quarterly report");
  assert.ok(!JSON.stringify(view).includes("dentist"));
});

test("bills, calendar, chores, trips, goals and health links", () => {
  const bills = sharedView(workspace(), { kind: "bills" }, TODAY);
  assert.ok(bills && bills.kind === "bills");
  assert.deepEqual(bills.bills.map((b) => [b.name, b.state]), [["Rent", "paid"], ["Electric", "soon"]]);

  const cal = sharedView(workspace(), { kind: "calendar" }, TODAY);
  assert.ok(cal && cal.kind === "calendar");
  assert.equal(cal.days.find((d) => d.date === TODAY)?.items[0].title, "Soccer practice");
  assert.deepEqual(cal.days.find((d) => d.date === TODAY)?.items[0].people, ["Sam"]);
  assert.ok(!JSON.stringify(cal).includes("secret note"), "event notes stay private");
  assert.ok(cal.days.some((d) => d.items.some((i) => i.title.includes("Beach week"))));

  const chores = sharedView(workspace(), { kind: "chores" }, TODAY);
  assert.ok(chores && chores.kind === "chores");
  assert.equal(chores.week.length, 7);
  assert.equal(chores.chores[0].days[0].person, "Sam");

  const trip = sharedView(workspace(), { kind: "trips", id: "t1" }, TODAY);
  assert.ok(trip && trip.kind === "trips");
  assert.deepEqual(trip.trips[0].packing, [{ person: "Sam", items: [{ item: "Sunscreen", packed: false }] }]);

  const goals = sharedView(workspace(), { kind: "goals" }, TODAY);
  assert.ok(goals && goals.kind === "goals");
  assert.equal(goals.goals[0].progress, 0.25);

  const adult = sharedView(workspace(), { kind: "health", id: "m1" }, TODAY);
  assert.ok(adult && adult.kind === "health");
  assert.equal(adult.days[0].calories, 400);
  assert.ok(!JSON.stringify(adult).includes("Sandwich"), "one person's diary only");
  const kid = sharedView(workspace(), { kind: "health", id: "k1" }, TODAY);
  assert.ok(kid && kid.kind === "health" && kid.kid);
  assert.equal(kid.days[0].calories, 0, "no calorie counting for kids");
  assert.deepEqual(kid.days[0].meals, []);
});

test("a guest's date is trusted only within a day of the server's", () => {
  const now = Date.parse("2026-10-09T03:00:00Z");
  assert.equal(guestToday("2026-10-08", now), "2026-10-08");
  assert.equal(guestToday("2026-12-25", now), "2026-10-09");
  assert.equal(guestToday("nope", now), "2026-10-09");
});

test("To-Do reminders: morning summary, heads-up, and tomorrow's bill, each once", () => {
  const zone = "America/New_York";
  const morning = Date.parse("2026-10-09T12:00:00Z"); // 8:00 in New York
  const due = dueTodoReminders(workspace(), morning, zone, {});
  const summary = due.find((r) => r.key === "todo:morning:2026-10-09");
  assert.ok(summary);
  assert.match(summary.body, /2 tasks \(1 overdue\)/);
  assert.match(summary.body, /1 event/);
  assert.match(summary.body, /1 chore/);
  assert.match(summary.body, /Vote closes today/);
  assert.ok(due.some((r) => r.key === "todo:bill:b2:2026-10-10" && r.title === "Electric is due tomorrow"));
  const sent = Object.fromEntries(due.map((r) => [r.key, morning]));
  assert.deepEqual(dueTodoReminders(workspace(), morning + 60_000, zone, sent), []);

  const beforeTask = Date.parse("2026-10-09T12:50:00Z"); // 8:50, task due at 9:00
  assert.ok(dueTodoReminders(workspace(), beforeTask, zone, sent).some((r) => r.key === "todo:task:t-a:2026-10-09:09:00"));
  const beforePractice = Date.parse("2026-10-09T21:20:00Z"); // 17:20, practice at 17:30
  assert.deepEqual(dueTodoReminders(workspace(), beforePractice, zone, sent).map((r) => r.title), ["Soccer practice"]);
});

/* ---------------- the routes ---------------- */

function server(opts: { allowed?: boolean } = {}) {
  const db = fakeSupabase({ arise_todo_workspaces: [{ user_id: 7, workspace: workspace(), updated_at: "2026-10-09T10:00:00.000Z" }] }, { keys: { todo_shares: ["token"], todo_share_votes: ["token", "voter_key"] } });
  const routes: Record<string, Function[]> = {};
  const add = (method: string) => (path: string, ...handlers: Function[]) => { routes[`${method} ${path}`] = handlers; };
  const app: any = { get: add("GET"), put: add("PUT"), post: add("POST"), delete: add("DELETE") };
  const auth = (req: any, _res: any, next: any) => { req.user = { id: 7, role: "parent" }; return next(); };
  registerTodoShareRoutes(app, auth as any, { db, appUrl: "https://arisereader.com/", ownerAllowed: async () => opts.allowed !== false, ownerName: async () => "Dana", now: () => Date.parse("2026-10-09T15:00:00Z") });
  async function call(method: string, route: string, params: any = {}, body: any = {}, query: any = {}) {
    const req: any = { body, query, params, headers: { "x-forwarded-for": "1.2.3.4" } };
    const out: any = { status: 200, body: null };
    const res: any = { status(code: number) { out.status = code; return res; }, json(b: any) { out.body = b; return res; }, set() { return res; }, type() { return res; }, send(b: any) { out.body = b; return res; } };
    const chain = routes[`${method} ${route}`];
    assert.ok(chain, `no route ${method} ${route}`);
    let i = 0;
    const next = async () => { const handler = chain[i++]; if (handler) await handler(req, res, next); };
    await next();
    return out;
  }
  return { call };
}

test("a family member votes from the link without an account, and the owner sees it", async () => {
  const { call } = server();
  const made = await call("POST", "/api/arise-todo/shares", {}, { target: "poll:p1" });
  assert.equal(made.status, 200);
  assert.match(made.body.url, /^https:\/\/arisereader\.com\/share\/[A-Za-z0-9_-]{24}$/);
  const again = await call("POST", "/api/arise-todo/shares", {}, { target: "poll:p1" });
  assert.equal(again.body.token, made.body.token, "copying again gives the same link");

  const token = made.body.token;
  const page = await call("GET", "/api/todo-share/:token", { token }, {}, { today: TODAY });
  assert.equal(page.status, 200);
  assert.equal(page.body.view.kind, "poll");
  assert.equal(page.body.owner, "Dana");

  const vote = await call("POST", "/api/todo-share/:token/vote", { token }, { voter: "grandma-device-1", name: "Grandma", optionId: "b", today: TODAY });
  assert.equal(vote.status, 200);
  assert.deepEqual(vote.body.view.options.map((o: any) => o.votes), [1, 1]);
  const changed = await call("POST", "/api/todo-share/:token/vote", { token }, { voter: "grandma-device-1", name: "Grandma", optionId: "a", today: TODAY });
  assert.deepEqual(changed.body.view.options.map((o: any) => o.votes), [2, 0], "changing a vote doesn't count twice");
  const bad = await call("POST", "/api/todo-share/:token/vote", { token }, { voter: "grandma-device-1", name: "", optionId: "a" });
  assert.equal(bad.status, 400);

  const list = await call("GET", "/api/arise-todo/shares");
  assert.deepEqual(list.body.guestVotes, { p1: [{ name: "Grandma", optionId: "a" }] });
  assert.equal(list.body.shares[0].label, "Poll: What's for dinner?");

  const off = await call("DELETE", "/api/arise-todo/shares/:token", { token });
  assert.equal(off.status, 200);
  assert.equal((await call("GET", "/api/todo-share/:token", { token })).status, 404);
  assert.deepEqual((await call("GET", "/api/arise-todo/shares")).body.guestVotes, { p1: [{ name: "Grandma", optionId: "a" }] }, "votes already cast still count");
});

test("a bills link can't be voted on, a closed poll can't be voted in, and links stop when To-Do ends", async () => {
  const { call } = server();
  const bills = (await call("POST", "/api/arise-todo/shares", {}, { target: "bills" })).body.token;
  assert.equal((await call("GET", "/api/todo-share/:token", { token: bills }, {}, { today: TODAY })).body.view.kind, "bills");
  assert.equal((await call("POST", "/api/todo-share/:token/vote", { token: bills }, { voter: "someone-123", name: "X", optionId: "a" })).status, 400);
  const poll = (await call("POST", "/api/arise-todo/shares", {}, { target: "poll:p1" })).body.token;
  assert.equal((await call("POST", "/api/todo-share/:token/vote", { token: poll }, { voter: "someone-123", name: "X", optionId: "a", today: "2026-10-10" })).status, 409);
  assert.equal((await call("POST", "/api/arise-todo/shares", {}, { target: "everything" })).status, 400);

  const ended = server({ allowed: false });
  const token = (await ended.call("POST", "/api/arise-todo/shares", {}, { target: "calendar" })).body.token;
  assert.equal((await ended.call("GET", "/api/todo-share/:token", { token })).status, 410);
});
