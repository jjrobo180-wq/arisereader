import test from "node:test";
import assert from "node:assert/strict";
import {
  billDue, billState, choreDoneOn, choreOwner, cleanFamily, emptyFamily, eventsOn, isOn, monthSummary, occursOn,
  starBalance, tally, toggleChore, type Chore, type FamilyEvent,
} from "../shared/familyHub";

let n = 0; const mk = () => `id${++n}`;
const ev = (over: Partial<FamilyEvent>): FamilyEvent => ({ id: mk(), title: "E", date: "2026-10-08", time: "", endTime: "", calendarId: "family", memberIds: [], location: "", notes: "", repeat: "none", ...over });

test("an old workspace with no family data opens as an empty hub", () => {
  const f = cleanFamily(undefined);
  assert.deepEqual(f, emptyFamily());
  assert.equal(f.calendars.length, 4);
  assert.ok(isOn("chores", f));
});

test("cleaning drops bad rows, caps text and keeps good data unchanged", () => {
  const good = emptyFamily();
  good.members = [{ id: "m1", name: "Maya", emoji: "🦄", color: "#7566e8", kind: "kid" }];
  good.chores = [{ id: "c1", title: "Dishes", memberId: "m1", rotation: [], days: [1, 3], points: 2 }];
  good.notes = [{ id: "n1", title: "Wi-Fi", body: "pass", color: "#fff7d6", pinned: true, updatedAt: "2026-10-08T00:00:00Z" }];
  assert.deepEqual(cleanFamily(JSON.parse(JSON.stringify(good))), good);

  const messy = cleanFamily({
    members: [{ id: "m1", name: "" }, { id: "m2", name: "x".repeat(99), color: "red", kind: "boss" }, { id: "m2", name: "dup" }, "nope"],
    chores: [{ id: "c", title: "Trash", days: [9, 1, 1, "2"], points: 9999 }],
    events: [{ id: "e", title: "Bad date", date: "2026-02-30" }, { id: "e2", title: "Ok", date: "2026-03-01", time: "25:00", repeat: "daily" }],
    polls: [{ id: "p", question: "Dinner?", options: [{ id: "a", label: "Tacos" }], votes: { m2: "a", m3: "zzz" } }],
    bills: [{ id: "b", name: "Rent", amount: "1200.555", dueDay: 40, paid: ["2026-10", "2026-13", 5] }],
    sections: { chores: false, home: false, nope: true },
  });
  assert.equal(messy.members.length, 1);
  assert.equal(messy.members[0].name.length, 40);
  assert.equal(messy.members[0].color, "#7566e8");
  assert.equal(messy.members[0].kind, "kid");
  assert.deepEqual(messy.chores[0].days, [1]);
  assert.equal(messy.chores[0].points, 100);
  assert.deepEqual(messy.events.map((e) => [e.title, e.time, e.repeat]), [["Ok", "", "none"]]);
  assert.deepEqual(messy.polls[0].votes, { m2: "a" });
  assert.equal(messy.bills[0].amount, 1200.56);
  assert.equal(messy.bills[0].dueDay, 31);
  assert.deepEqual(messy.bills[0].paid, ["2026-10"]);
  assert.deepEqual(messy.sections, { chores: false });
  assert.equal(isOn("chores", messy), false);
  assert.equal(isOn("home", messy), true);
});

test("repeating events land on the right days", () => {
  const weekly = ev({ date: "2026-10-06", repeat: "weekly" });
  assert.ok(occursOn(weekly, "2026-10-13"));
  assert.ok(!occursOn(weekly, "2026-10-14"));
  assert.ok(!occursOn(weekly, "2026-09-29"));
  const monthly = ev({ date: "2026-01-31", repeat: "monthly" });
  assert.ok(occursOn(monthly, "2026-02-28"));
  assert.ok(occursOn(monthly, "2026-04-30"));
  const birthday = ev({ date: "2024-02-29", repeat: "yearly" });
  assert.ok(occursOn(birthday, "2027-02-28"));
  assert.ok(occursOn(birthday, "2028-02-29"));
  assert.ok(!occursOn(birthday, "2028-02-28"));
});

test("hidden calendars hide their events unless asked for everything", () => {
  const f = emptyFamily();
  f.events = [ev({ id: "s", calendarId: "school", time: "09:00" }), ev({ id: "f", calendarId: "family", time: "08:00" })];
  f.calendars = f.calendars.map((c) => (c.id === "school" ? { ...c, show: false } : c));
  assert.deepEqual(eventsOn(f, "2026-10-08").map((e) => e.id), ["f"]);
  assert.deepEqual(eventsOn(f, "2026-10-08", true).map((e) => e.id), ["f", "s"]);
});

test("chore rotations change hands each week and earn stars", () => {
  const chore: Chore = { id: "c1", title: "Trash", memberId: "", rotation: ["a", "b", "c"], days: [], points: 3 };
  const owners = ["2026-10-04", "2026-10-11", "2026-10-18", "2026-10-25"].map((d) => choreOwner(chore, d));
  assert.equal(new Set(owners.slice(0, 3)).size, 3);
  assert.equal(owners[3], owners[0]);
  assert.equal(choreOwner(chore, "2026-10-04"), choreOwner(chore, "2026-10-10"));

  let f = emptyFamily();
  f.members = [{ id: "a", name: "A", emoji: "", color: "#7566e8", kind: "kid" }];
  f = toggleChore(f, { ...chore, rotation: [], memberId: "a" }, "2026-10-08", mk);
  assert.ok(choreDoneOn(f, "c1", "2026-10-08"));
  f.behavior = [{ id: "b1", memberId: "a", date: "2026-10-08", points: 2, note: "Kind" }];
  f.redemptions = [{ id: "r1", memberId: "a", title: "Dessert", cost: 4, date: "2026-10-08" }];
  assert.deepEqual(starBalance(f, "a"), { behavior: 2, chores: 3, spent: 4, balance: 1 });
  assert.equal(starBalance({ ...f, chorePointsCount: false }, "a").balance, -2);
  f = toggleChore(f, { ...chore, rotation: [], memberId: "a" }, "2026-10-08", mk);
  assert.equal(choreDoneOn(f, "c1", "2026-10-08"), undefined);
});

test("poll tallies find the leaders", () => {
  const t = tally({ id: "p", question: "Dinner", kind: "dinner", options: [{ id: "x", label: "Tacos" }, { id: "y", label: "Pasta" }], votes: { a: "y", b: "y", c: "x" }, closed: false, createdAt: "", closesOn: "" });
  assert.equal(t.total, 3);
  assert.deepEqual(t.leaders.map((o) => o.label), ["Pasta"]);
  assert.deepEqual(tally({ id: "p", question: "Q", kind: "other", options: [{ id: "x", label: "A" }], votes: {}, closed: false, createdAt: "", closesOn: "" }).leaders, []);
});

test("bills: due dates, states and the month's money", () => {
  const rent = { id: "r", name: "Rent", amount: 1500, dueDay: 31, category: "", autopay: false, paid: ["2026-10"] };
  const phone = { id: "p", name: "Phone", amount: 80, dueDay: 12, category: "", autopay: true, paid: [] };
  assert.equal(billDue(rent, "2026-02"), "2026-02-28");
  assert.equal(billState(rent, "2026-10", "2026-10-08"), "paid");
  assert.equal(billState(phone, "2026-10", "2026-10-08"), "soon");
  assert.equal(billState(phone, "2026-10", "2026-10-20"), "late");
  assert.equal(billState(phone, "2026-11", "2026-10-08"), "later");
  const f = { ...emptyFamily(), income: 4000, bills: [rent, phone], expenses: [{ id: "e", categoryId: "b-groceries", amount: 200, date: "2026-10-03", note: "" }, { id: "e2", categoryId: "b-groceries", amount: 50, date: "2026-09-30", note: "" }] };
  assert.deepEqual(monthSummary(f, "2026-10"), { billsTotal: 1580, billsPaid: 1500, billsLeft: 80, spent: 200, budgeted: 0, leftover: 2220 });
});

test("family data saved by an older page is recognized and filled in", async () => {
  const { isCurrentFamily } = await import("../shared/familyHub");
  assert.ok(isCurrentFamily(emptyFamily()));
  const old = JSON.parse(JSON.stringify(emptyFamily()));
  delete old.health.profiles;
  old.members = [{ id: "m1", name: "Maya", emoji: "", color: "#7566e8", kind: "kid" }];
  assert.equal(isCurrentFamily(old), false);
  const fixed = cleanFamily(old);
  assert.ok(isCurrentFamily(fixed));
  assert.deepEqual(fixed.health.profiles, {});
  assert.equal(fixed.members[0].name, "Maya");
  const older = JSON.parse(JSON.stringify(emptyFamily()));
  delete older.health;
  assert.equal(isCurrentFamily(older), false);
  assert.ok(isCurrentFamily(cleanFamily(older)));
});
