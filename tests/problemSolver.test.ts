import test from "node:test";
import assert from "node:assert/strict";
import { cleanSolution, evaluate, realFractions, sameAnswer, sameNumber, solutionText, wrongChecks } from "../shared/problemSolver";

test("fractions are always real, stacked fractions; dates and links are left alone", () => {
  assert.equal(realFractions("Add 1/2 and 3/4."), "Add $\\frac{1}{2}$ and $\\frac{3}{4}$.");
  assert.equal(realFractions("She ran 3 1/4 miles."), "She ran $3\\frac{1}{4}$ miles.");
  assert.equal(realFractions("The answer is -5/8"), "The answer is $-\\frac{5}{8}$");
  assert.equal(realFractions("Due on 11/19/2026."), "Due on 11/19/2026.");
  assert.equal(realFractions("Turned in on 11/19."), "Turned in on 11/19.");
  assert.equal(realFractions("See https://x.org/a/1/2"), "See https://x.org/a/1/2");
  assert.equal(realFractions("$x = 7/8$"), "$x = \\frac{7}{8}$");
  assert.equal(realFractions("$\\frac{1}{2}$ stays"), "$\\frac{1}{2}$ stays");
});

test("the calculator checks arithmetic the way a teacher would write it", () => {
  assert.equal(evaluate("120 · 3 · 12"), 4320);
  assert.equal(evaluate("4,320 - 4,306"), 14);
  assert.ok(sameNumber(evaluate("14 ÷ 4,320"), evaluate("0.00324"), "0.00324"));
  assert.equal(evaluate("\\frac{3}{4} + \\frac{1}{8}"), 0.875);
  assert.equal(evaluate("2^3 + sqrt(49)"), 15);
  assert.equal(evaluate("25% * 24"), 6);
  assert.equal(evaluate("2(3+4)"), 14);
  assert.ok(Number.isNaN(evaluate("x + 2")));
  assert.ok(Number.isNaN(evaluate("alert(1)")));
  const wrong = wrongChecks([{ expr: "360 - 358.8333", equals: "1.1667" }, { expr: "24 * 0.75", equals: "16" }, { expr: "the sum", equals: "5" }]);
  assert.equal(wrong.length, 1);
  assert.equal(wrong[0].actual, 18);
});

test("two solves agree by value, by letter, or by wording", () => {
  const sol = (o: any) => cleanSolution({ answer: "x", ...o })!;
  assert.ok(sameAnswer(sol({ value: "7/8" }), sol({ value: "0.875" })));
  assert.ok(!sameAnswer(sol({ value: "7/8" }), sol({ value: "3/4" })));
  assert.ok(sameAnswer(sol({ choice: "b" }), sol({ choice: "B" })));
  assert.ok(!sameAnswer(sol({ choice: "A" }), sol({ choice: "C" })));
  assert.ok(sameAnswer(sol({ answer: "The theme is that courage means facing fear." }), sol({ answer: "Courage means facing your fear." })));
  const s = cleanSolution({ question: "What is 1/2 + 1/4?", steps: ["Make the bottoms match: 1/2 = 2/4."], answer: "3/4", value: "3/4" })!;
  assert.equal(s.answer, "$\\frac{3}{4}$");
  assert.match(solutionText({ solution: s }), /Answer: 3\/4/);
  assert.equal(cleanSolution({ steps: ["x"] }), null);
});

test("an answer is only marked Checked when two solves agree and every calculation recomputes", async () => {
  const { solveChecked } = await import("../server/problemSolver");
  const reply = (o: any) => JSON.stringify({ subject: "Math", question: "q", steps: ["s"], answer: "x", value: "", choice: "", checks: [], ...o });
  // Both agree, arithmetic right.
  let calls = 0;
  let r = await solveChecked(async () => { calls++; return reply({ answer: "$\\frac{7}{8}$", value: "7/8", checks: [{ expr: "3/4+1/8", equals: "7/8" }] }); }, "3/4 + 1/8", "");
  assert.equal(r.verdict, "checked");
  assert.equal(calls, 2);
  // One solver slips on arithmetic (24 × 0.75 = 16): a third pass is called and told the exact value.
  let judgeSaw = "";
  r = await solveChecked(async (system, user) => {
    if (/final checker/.test(system)) { judgeSaw = user; return reply({ answer: "18", value: "18", checks: [{ expr: "24*0.75", equals: "18" }] }); }
    return /answer-key writer/.test(system) ? reply({ answer: "16", value: "16", checks: [{ expr: "24*0.75", equals: "16" }] }) : reply({ answer: "18", value: "18", checks: [{ expr: "24*0.75", equals: "18" }] });
  }, "25% off $24", "");
  assert.match(judgeSaw, /24\*0\.75 is 18, not 16/);
  assert.equal(r.verdict, "settled");
  assert.equal(r.solution.value, "18");
  // Three different answers: never marked checked.
  let n = 0;
  r = await solveChecked(async () => reply({ choice: "ABC"[n++ % 3] }), "pick one", "");
  assert.equal(r.verdict, "unsure");
});

test("Problem Solver is a WorkHub plugin with its own menu item", async () => {
  const { HUB_TABS, WORK_ADD_ON_TABS } = await import("../shared/teacherHub");
  const { HUB_GROUPS } = await import("../shared/hubTabGroups");
  assert.ok(HUB_TABS.includes("solver" as any));
  assert.ok(WORK_ADD_ON_TABS.includes("solver" as any));
  assert.ok(HUB_GROUPS.some((g) => (g.tabs as string[]).includes("solver")));
});

test("Wolfram|Alpha's own answer confirms a number answer, or sends it back to be solved again", async () => {
  const { engineNumber, engineAgrees } = await import("../shared/problemSolver");
  assert.equal(engineNumber("14 inches"), 14);
  assert.ok(Math.abs(engineNumber("0.3240740740740741%") - 0.003240740740740741) < 1e-15);
  assert.equal(engineNumber("x = -3"), -3);
  assert.equal(engineNumber("7/8"), 0.875);
  assert.equal(engineNumber("$1,250.50"), 1250.5);
  assert.ok(Number.isNaN(engineNumber("x = -3 or x = 3")));
  assert.ok(Number.isNaN(engineNumber("Wolfram|Alpha did not understand your input")));
  assert.ok(engineAgrees("0.32", engineNumber("0.3240740740740741%")), "0.32% shown, engine says 0.324%");
  assert.ok(engineAgrees("7/8", 0.875));
  assert.ok(!engineAgrees("3/4", 0.875));

  const { solveChecked } = await import("../server/problemSolver");
  const reply = (o: any) => JSON.stringify({ subject: "Math", question: "q", steps: ["s"], answer: "x", value: "", choice: "", checks: [], ...o });
  const asked: string[] = [];
  const engine = async (q: string) => { asked.push(q); return "18"; };
  // Both AI solves agree on 16 (both wrong): the engine says 18, so it's solved again and fixed.
  let r = await solveChecked(async (system) => (/final checker/.test(system) ? reply({ answer: "18", value: "18", engineQuery: "24*0.75" }) : reply({ answer: "16", value: "16", engineQuery: "24*0.75" })), "25% off $24", "", engine);
  assert.equal(asked[0], "24*0.75");
  assert.equal(r.verdict, "settled");
  assert.equal(r.solution.value, "18");
  assert.equal(r.engine?.result, "agrees");
  // The re-solve still disagrees with the engine: never shown as checked.
  r = await solveChecked(async () => reply({ answer: "16", value: "16", engineQuery: "24*0.75" }), "25% off $24", "", engine);
  assert.equal(r.verdict, "unsure");
  assert.equal(r.engine?.result, "disagrees");
  // Agreement adds the engine's confirmation; no engine, or a word answer, works as before.
  r = await solveChecked(async () => reply({ answer: "18", value: "18", engineQuery: "24*0.75", checks: [{ expr: "24*0.75", equals: "18" }] }), "25% off $24", "", engine);
  assert.equal(r.verdict, "checked");
  assert.match(r.note, /Wolfram\|Alpha computed the same answer \(18\)/);
  r = await solveChecked(async () => reply({ answer: "18", value: "18", engineQuery: "24*0.75" }), "q", "", null);
  assert.equal(r.engine, undefined);
});
