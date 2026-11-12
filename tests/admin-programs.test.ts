import test from "node:test";
import assert from "node:assert/strict";
import { PROGRAMS, bestOf, planView, programOf, programStats, type PlanInfo } from "../shared/todoAdmin";

const now = Date.parse("2026-11-11T12:00:00Z");
const info = (o: Partial<PlanInfo>): PlanInfo => ({ kind: "notes_plus", source: "stripe", status: "active", live: true, endsAt: "2026-12-01T00:00:00Z", trial: false, cancelAtPeriodEnd: false, ...o } as PlanInfo);

test("every program is separate and no plan kind is in two programs", () => {
  const kinds = PROGRAMS.flatMap((p) => p.kinds);
  assert.equal(new Set(kinds).size, kinds.length);
  assert.equal(programOf("fit")?.give, "fit_plus");
  assert.equal(programOf("nope"), null);
  for (const p of PROGRAMS) if (p.give) assert.ok(p.kinds.includes(p.give));
});

test("a program's numbers", () => {
  const prog = programOf("notes")!;
  const list = [info({}), info({ source: "admin", trial: true }), info({ status: "past_due" }), info({ live: false }), null];
  const st = programStats(prog, list.map((i) => ({ info: i, plan: planView(i, false, now, prog.membership) })));
  assert.deepEqual([st.members, st.paying, st.given, st.pastDue, st.ended], [3, 2, 1, 1, 1]);
});

test("a given membership is named after its program, and a paid record wins", () => {
  assert.match(planView(info({ source: "admin", trial: true }), false, now, "Cooked+").detail, /^Cooked\+ until /);
  assert.match(planView(info({ source: "admin", trial: true, kind: "todo_unlimited" }), false, now).detail, /^Unlimited until /);
  assert.equal(bestOf([info({ source: "admin" }), info({ source: "stripe" })])?.source, "stripe");
});
