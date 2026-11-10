// Smart matching (November 2026). Run with: npx tsx --test tests/trainer-match.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PublicTrainer } from "../shared/coach";
import { cleanNeed, emptyNeed, introMessage, matchTrainers, monthlyCents } from "../shared/coachMatch";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const T = (id: number, x: Partial<PublicTrainer>): PublicTrainer => ({ id, name: `Coach ${id}`, headline: "", bio: "", photo: "", specialties: [], certifications: [], years: 3, languages: [], city: "Denver", state: "CO", zip: "80202", modes: ["remote"], prices: [{ id: "p", label: "Online", mode: "remote", cents: 15000, per: "month" }], website: "", bookingUrl: "", payUrl: "", instagram: "", email: "", phone: "", welcome: "", accepting: true, rating: 0, reviews: 0, since: "", fromCents: 15000, clients: 0, ...x } as PublicTrainer);

test("monthly cost per client: sessions and packages scale with how often they train", () => {
  assert.equal(monthlyCents({ id: "a", label: "", mode: "inPerson", cents: 8000, per: "session" }, 2), Math.round(8000 * 2 * 4.33));
  assert.equal(monthlyCents({ id: "a", label: "", mode: "inPerson", cents: 60000, per: "package", sessions: 10 }, 3), Math.round(6000 * 3 * 4.33));
  assert.equal(monthlyCents({ id: "a", label: "", mode: "remote", cents: 15000, per: "month" }, 5), 15000);
});

test("the best three: goal first, then budget, place and track record; never someone who can't help", () => {
  const list = [
    T(1, { specialties: ["Fat loss", "Beginners"], rating: 4.9, reviews: 12, years: 8 }),
    T(2, { specialties: ["Bodybuilding"], prices: [{ id: "p", label: "", mode: "remote", cents: 40000, per: "month" }] }),
    T(3, { specialties: ["Nutrition"] }),
    T(4, { specialties: ["Fat loss"], accepting: false }),
    T(5, { specialties: ["Fat loss"], modes: ["inPerson"], state: "TX", prices: [{ id: "p", label: "", mode: "inPerson", cents: 7000, per: "session" }] }),
    T(6, { specialties: ["Fat loss"], modes: ["inPerson"], state: "CO", zip: "80211", prices: [{ id: "p", label: "", mode: "inPerson", cents: 6000, per: "session" }] }),
  ];
  const r = matchTrainers(list, { ...emptyNeed(), goal: "Fat loss", modes: ["remote", "inPerson"], budgetCents: 60000, perWeek: 2, state: "CO", zip: "80205", level: "new" });
  assert.deepEqual(r.map((m) => m.trainer.id), [1, 6, 3]);
  assert.ok(!r.some((m) => m.trainer.id === 4), "not taking clients");
  assert.ok(!r.some((m) => m.trainer.id === 5), "in person in another state");
  assert.ok(r[0].reasons.includes("Specializes in fat loss")); assert.ok(r[0].reasons.some((x) => /in your budget/.test(x)));
  assert.ok(r[1].reasons.some((x) => /In person near you \(Denver\)/.test(x)));
  assert.ok(r[2].reasons.some((x) => /close to your goal/.test(x)), "Nutrition is near Fat loss");
  // Online only: in-person-only trainers drop out.
  assert.ok(!matchTrainers(list, { ...emptyNeed(), goal: "Fat loss", modes: ["remote"] }).some((m) => m.trainer.id === 6));
  // A budget far under the price pushes them down.
  const score2 = (budgetCents: number) => matchTrainers(list, { ...emptyNeed(), goal: "Muscle building", modes: ["remote"], budgetCents }, 6).find((m) => m.trainer.id === 2)!.score;
  assert.ok(score2(10000) < score2(0) - 20, "$400/month against a $100 budget");
  assert.ok(score2(50000) > score2(0), "inside the budget is a plus");
});

test("answers are cleaned and turn into a first message", () => {
  const n = cleanNeed({ goal: "Fat loss", modes: ["remote", "teleport"], budgetCents: -5, perWeek: 99, state: "co", zip: "8020", level: "new", notes: "  Bad knee " });
  assert.deepEqual([n.modes, n.budgetCents, n.perWeek, n.state, n.zip, n.notes], [["remote"], 0, 7, "", "", "Bad knee"]);
  assert.equal(introMessage({ ...n, modes: ["inPerson"], perWeek: 2 }, "Maya"), "Hi Maya! I'm looking for help with fat loss. I'm pretty new to training. I'd like in person, about 2 times a week. Bad knee");
});

test("matching is in Arise Fit's Find a trainer, and the server route exists", () => {
  const fit = read("client/src/pages/fit/FitCoach.tsx");
  assert.match(fit, /<MatchCard onOpen=\{\(\) => setMatching\(true\)\}/);
  assert.match(fit, /initialMsg=\{askMsg\}/);
  assert.match(read("server/coach.ts"), /app\.post\("\/api\/coach\/match", auth,/);
  for (const t of ["match-go", "match-result", "match-ask"]) assert.ok(read("client/src/pages/coach/Match.tsx").includes(t), t);
});
