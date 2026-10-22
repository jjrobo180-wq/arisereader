import test from "node:test";
import assert from "node:assert/strict";
import { LEVELS } from "../shared/ninja/missions";
import { NinjaSim, DEFAULT_DWELL, FLOOR, type Difficulty, type NinjaInput } from "../shared/ninja/sim";

const DT = 1 / 120;
const none: NinjaInput = { swipes: [], gaze: null, swipeId: -1 };
function run(sim: NinjaSim, seconds: number, input: (s: NinjaSim) => NinjaInput = () => none) {
  const ev: string[] = [];
  for (let i = 0; i < seconds / DT; i++) { sim.step(DT, input(sim)); for (const e of sim.events) ev.push(e.t); if (sim.state === "win" || sim.state === "fail") break; }
  return ev;
}
/** an eye-gaze player who looks at the highest matching token on screen */
const gazer = (s: NinjaSim): NinjaInput => {
  const t = s.tokens.filter(k => k.state === "fly" && k.target && k.y > FLOOR + 1).sort((a, b) => b.y - a.y)[0];
  return { swipes: [], gaze: t ? { x: t.x, y: t.y } : null, swipeId: -1 };
};

test("15 levels, none uses its own target as a distractor", () => {
  assert.equal(LEVELS.length, 15);
  for (const l of LEVELS) { assert.ok(l.goal >= 9); assert.ok(!l.distractors.some(d => d.label === l.target.label)); }
});

test("nothing launches before the countdown ends", () => {
  const sim = new NinjaSim(LEVELS[0], { difficulty: "easy", dwellMs: 450, slowLook: true, seed: 1 });
  run(sim, 3); assert.equal(sim.tokens.length, 0);
  sim.start(); run(sim, 3); assert.ok(sim.tokens.length > 0);
});

test("waves mix tokens to slice with tokens to leave alone, in a fair ratio", () => {
  for (const d of ["easy", "medium", "hard"] as Difficulty[]) {
    const sim = new NinjaSim(LEVELS[11], { difficulty: d, dwellMs: 350, slowLook: true, seed: 5 });
    sim.setBounds(4.5); sim.start();
    const seen = new Set<number>(); let targets = 0, others = 0, waves = 0;
    for (let i = 0; i < 60 / DT; i++) {
      const before = new Set(sim.tokens.map(t => t.id));
      sim.step(DT, none);
      if (sim.events.some(e => e.t === "launch")) {
        waves++;
        const fresh = sim.tokens.filter(t => !before.has(t.id));
        if (fresh.length >= 2) assert.ok(fresh.some(t => t.target) && fresh.some(t => !t.target), `${d}: a multi-token wave that isn't mixed`);
      }
      for (const t of sim.tokens) if (!seen.has(t.id)) { seen.add(t.id); if (t.target) targets++; else others++; }
    }
    const share = others / (targets + others);
    assert.ok(waves > 15);
    assert.ok(share > 0.3 && share < 0.65, `${d}: ${Math.round(share * 100)}% of tokens are distractors`);
  }
});

test("tokens stay inside the screen and come back down", () => {
  const sim = new NinjaSim(LEVELS[0], { difficulty: "hard", dwellMs: 280, slowLook: false, seed: 9 });
  sim.setBounds(6); sim.start();
  for (let i = 0; i < 30 / DT; i++) { sim.step(DT, none); for (const t of sim.tokens) if (t.state === "fly") { assert.ok(Math.abs(t.x) <= 6 + 0.01, `x ${t.x}`); assert.ok(t.y < 11); } }
  assert.ok(sim.misses > 0, "unsliced matching tokens fall away");
});

test("looking at matching tokens finishes every level on Easy with no wrong slices", () => {
  LEVELS.forEach((l, i) => {
    const sim = new NinjaSim(l, { difficulty: "easy", dwellMs: DEFAULT_DWELL.easy, slowLook: true, seed: 40 + i });
    sim.start(); run(sim, 240, gazer);
    assert.equal(sim.state, "win", `${l.name}: caught ${sim.caught}/${l.goal}`);
    assert.equal(sim.wrong, 0); assert.equal(sim.stars(), 3);
  });
});

test("the token under the gaze slows down while the player looks at it", () => {
  const sim = new NinjaSim(LEVELS[0], { difficulty: "medium", dwellMs: 100000, slowLook: true, seed: 2 });
  sim.start(); run(sim, 1.2);
  const t = sim.tokens[0]; const y0 = t.y;
  sim.step(0.1, { swipes: [], gaze: { x: t.x, y: t.y }, swipeId: -1 }); const looked = Math.abs(t.y - y0);
  const y1 = t.y; sim.step(0.1, none); const free = Math.abs(t.y - y1);
  assert.ok(looked < free * 0.6, `looked ${looked} vs free ${free}`);
});

test("a swipe slices every token it crosses and counts a combo", () => {
  const sim = new NinjaSim(LEVELS[0], { difficulty: "medium", dwellMs: 350, slowLook: false, seed: 3 });
  sim.start();
  const tok = (x: number, target: boolean) => ({ id: 900 + x, thing: target ? LEVELS[0].target : LEVELS[0].distractors[0], target, x, y: 3, vx: 0, vy: 0, rot: 0, vrot: 0, r: 1.1, state: "fly" as const, dwell: 0, looked: false, angle: 0 });
  sim.tokens = [tok(-3, true), tok(0, true), tok(3, true)];
  sim.step(DT, { swipes: [{ x0: -6, y0: 3, x1: 6, y1: 3 }], gaze: null, swipeId: 7 });
  assert.equal(sim.caught, 3); assert.equal(sim.bestCombo, 3);
  assert.ok(sim.events.filter(e => e.t === "slice").map(e => e.combo).join() === "1,2,3");
});

test("slicing a wrong token costs a heart on Medium (not Easy); three ends the round", () => {
  for (const d of ["easy", "medium"] as Difficulty[]) {
    const sim = new NinjaSim(LEVELS[1], { difficulty: d, dwellMs: 350, slowLook: false, seed: 4 }); sim.start();
    sim.tokens = [{ id: 1, thing: LEVELS[1].distractors[0], target: false, x: 0, y: 3, vx: 0, vy: 0, rot: 0, vrot: 0, r: 1.1, state: "fly", dwell: 0, looked: false, angle: 0 }];
    sim.step(DT, { swipes: [{ x0: -2, y0: 3, x1: 2, y1: 3 }], gaze: null, swipeId: 1 });
    assert.equal(sim.wrong, 1); assert.equal(sim.hearts, d === "easy" ? 3 : 2);
  }
  const hard = new NinjaSim(LEVELS[1], { difficulty: "hard", dwellMs: 280, slowLook: false, seed: 4 }); hard.start();
  hard.tokens = [0, 1, 2].map(i => ({ id: i + 1, thing: LEVELS[1].distractors[i], target: false, x: i * 3 - 3, y: 3, vx: 0, vy: 0, rot: 0, vrot: 0, r: 1, state: "fly" as const, dwell: 0, looked: false, angle: 0 }));
  hard.step(DT, { swipes: [{ x0: -6, y0: 3, x1: 6, y1: 3 }], gaze: null, swipeId: 2 });
  assert.equal(hard.state, "fail");
});

test("winning clears the remaining tokens with a burst", () => {
  const sim = new NinjaSim(LEVELS[0], { difficulty: "easy", dwellMs: 450, slowLook: true, seed: 6 });
  sim.start(); sim.caught = sim.goal - 1;
  const ev = run(sim, 60, gazer);
  assert.equal(sim.state, "win"); assert.ok(ev.includes("win"));
  assert.equal(sim.tokens.filter(t => t.state === "fly").length, 0);
});

test("the title-screen demo slices matching tokens forever", () => {
  const sim = new NinjaSim(LEVELS[11], { difficulty: "medium", dwellMs: 350, slowLook: true, seed: 8, demo: true });
  sim.start(); run(sim, 90);
  assert.equal(sim.state, "play"); assert.ok(sim.caught > 15); assert.equal(sim.wrong, 0);
});
