// Arise Math: the check on everything the AI writes.
// Run with: npx tsx --test tests/arise-math-verify.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { checkQuestions, checkTopics, judge, sameAnswer, wrongArithmetic, CheckUnavailable } from "../shared/ariseMathVerify";
import { cleanQuestion, cleanTopic } from "../shared/ariseMathPrep";

test("code catches the false steps from the flag question", () => {
  assert.deepEqual(wrongArithmetic("75/8 × 2 = 150/8 = 15 1/4 feet."), ["75/8 × 2 = 150/8 = 15 1/4"]);
  assert.deepEqual(wrongArithmetic("53/8 × 2 = 106/8 = 10 3/4 feet."), ["53/8 × 2 = 106/8 = 10 3/4"]);
  assert.deepEqual(wrongArithmetic("Multiply 61/8 × 2 = 122/8 = 15 1/4 feet."), []);
  assert.deepEqual(wrongArithmetic("38 ÷ 19 = 2. Then 43/8 × 2 = 86/8 = 10 3/4 feet."), []);
  assert.deepEqual(wrongArithmetic("First 3 + 4 = 8. Next 2 × 5 = 10."), ["3 + 4 = 8"]);
});

test("code leaves alone what isn't plain arithmetic", () => {
  for (const ok of ["x + 3 = 5", "3x = 6", "2x + 1 = 7", "y = 3 + 4", "2 ft = 24 in", "1 yard = 3 feet", "5 = 2 + x", "3² = 9", "20% of 50 = 10", "π × 2 = 6.28", "10 ÷ 3 = 3.33", "1/3 = 0.33", "2 (x + 1) = 4", "Block 2 = 30 min", "1,000 + 500 = 1,500", "(2 + 3) × 4 = 20", "7 5/8 = (7 × 8 + 5)/8 = 61/8", "-3 + 5 = 9"])
    assert.deepEqual(wrongArithmetic(ok), [], ok);
});

test("two ways of writing the same answer agree, and different ones don't", () => {
  for (const [a, b] of [["3/4", "0.75"], ["15 1/4 ft by 10 3/4 ft", "15.25 by 10.75"], ["1,000", "1000"], ["x = 5", "5"], ["$4.50", "4.5 dollars"], ["3x + 2", "3x+2"]]) assert.ok(sameAnswer(a, b), `${a} / ${b}`);
  for (const [a, b] of [["3/4", "4/3"], ["15 1/4 by 10 3/4", "18 3/4 by 13 1/4"], ["5", "-5"], ["3x + 2", "3x - 2"], ["yes", "no"], ["", "4"]]) assert.ok(!sameAnswer(a, b), `${a} / ${b}`);
});

const Q = (over: any = {}) => cleanQuestion({ q: "What is 2 + 2?", answer: "4", steps: [{ title: "Add", work: "2 + 2 = 4" }], hint: "Count up", ...over })!;
const flag = () => Q({ q: "A flag is 38 feet by 20 feet. What are the dimensions of its union?", answer: "15 1/4 ft by 10 3/4 ft", steps: [{ title: "Scale", work: "75/8 × 2 = 150/8 = 15 1/4 feet." }] });

test("a question is flagged for wrong math, a missing number or a different answer", () => {
  const items = [{ id: "1", question: flag() }, { id: "2", question: Q({ q: "From the chart, what is it?" }) }, { id: "3", question: Q() }, { id: "4", question: Q() }, { id: "5", question: Q() }];
  const flagged = judge(items, { results: [{ id: "1", solvable: true, answer: "15 1/4 ft by 10 3/4 ft" }, { id: "2", solvable: false, why: "no chart" }, { id: "3", solvable: true, answer: "5" }, { id: "5", solvable: true, answer: "4" }] });
  assert.deepEqual(flagged.map((f) => f.id), ["1", "2", "3", "4"]);
  assert.match(flagged[0].why, /false/);
});

test("a failed question is rewritten and rechecked, and dropped if it still fails", async () => {
  const fixed = { id: "1", q: "A flag is 19 ft by 10 ft with a union of 7 5/8 ft by 5 3/8 ft. On a flag twice that size, how wide is the union?", answer: "15 1/4 ft", steps: [{ title: "Scale", work: "61/8 × 2 = 122/8 = 15 1/4 feet." }] };
  const script = (repair: unknown, recheck: unknown) => async (system: string) => (system.includes("fixing") ? repair : (seen++ === 0 ? { results: [{ id: "1", solvable: false, why: "19 is missing" }, { id: "2", solvable: true, answer: "4" }] } : recheck));
  let seen = 0;
  let out = await checkQuestions([flag(), Q()], script({ questions: [fixed] }, { results: [{ id: "1", solvable: true, answer: "15.25 ft" }] }));
  assert.equal(out.length, 2); assert.match(out[0].q, /19 ft/);
  seen = 0;
  out = await checkQuestions([flag(), Q()], script({ questions: [fixed] }, { results: [{ id: "1", solvable: false }] }));
  assert.deepEqual(out.map((q) => q.q), ["What is 2 + 2?"]);
  seen = 0;
  out = await checkQuestions([flag(), Q()], async (system) => { if (system.includes("fixing")) throw new Error("down"); return { results: [{ id: "1", solvable: false }, { id: "2", solvable: true, answer: "4" }] }; });
  assert.deepEqual(out.map((q) => q.q), ["What is 2 + 2?"], "repair down: the bad one still doesn't get through");
});

test("if the second solver can't run, nothing passes as checked", async () => {
  await assert.rejects(checkQuestions([Q()], async () => { throw new Error("down"); }), CheckUnavailable);
});

test("topics keep only what passed, and a bad example goes without losing good questions", async () => {
  const topic = (name: string, bad = false) => cleanTopic({ name, questions: [{ q: `${name}: 2 + 2?`, answer: "4", steps: [{ work: "2 + 2 = 4" }] }], example: { problem: "3 + 3?", answer: "6", steps: [{ work: bad ? "3 + 3 = 7" : "3 + 3 = 6" }] } })!;
  const solveAll = async (system: string, text: string) => system.includes("fixing") ? { questions: [] } : { results: JSON.parse(text).map((x: any) => ({ id: x.id, solvable: true, answer: x.q.includes("3 + 3") ? "6" : "4" })) };
  const out = await checkTopics([topic("A"), topic("B", true)], solveAll);
  assert.equal(out.length, 2); assert.ok(out[0].example); assert.equal(out[1].example, null); assert.equal(out[1].questions.length, 1);
  const none = await checkTopics([topic("A")], async (s) => (s.includes("fixing") ? { questions: [] } : { results: [] }));
  assert.equal(none.length, 0);
});
