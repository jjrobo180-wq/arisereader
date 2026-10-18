import test from "node:test";
import assert from "node:assert/strict";
import { MISSIONS } from "../shared/runner/missions";
import { Sim, DEFAULT_ASSISTS, LANE_X, TRAIN_H, type Difficulty, type SimInput } from "../shared/runner/sim";

const idle: SimInput = { moves: [], jump: false, lane: null };
const DT = 1 / 120;

function run(sim: Sim, seconds: number, input: (s: Sim) => SimInput = () => idle) {
  const all: string[] = [];
  for (let i = 0; i < seconds / DT; i++) {
    sim.step(DT, input(sim));
    for (const e of sim.events) all.push(e.t);
    if (sim.state === "win" && sim.winT > 1) break;
    if (sim.state === "fail") break;
  }
  return all;
}

test("all 15 worlds have a target, distractors and a goal", () => {
  assert.equal(MISSIONS.length, 15);
  for (const m of MISSIONS) {
    assert.ok(m.goal >= 8);
    assert.ok(m.distractors.length >= 2);
    assert.ok(!m.distractors.some(d => d.label === m.target.label), `${m.action} must not use its own target as a distractor`);
  }
});

test("the runner waits for the countdown, then runs forward", () => {
  const sim = new Sim(MISSIONS[0], { difficulty: "easy", assists: DEFAULT_ASSISTS.easy, seed: 3 });
  run(sim, 1);
  assert.equal(sim.p.s, 0);
  sim.start();
  run(sim, 2);
  assert.ok(sim.p.s > 10);
});

test("every train row leaves at least one open lane", () => {
  for (const d of ["easy", "medium", "hard"] as Difficulty[]) {
    for (let seed = 1; seed < 40; seed++) {
      const sim = new Sim(MISSIONS[seed % 15], { difficulty: d, assists: DEFAULT_ASSISTS[d], seed });
      for (let s = 0; s < 140; s += 0.5) {
        const blocked = [0, 1, 2].filter(l => sim.obstacles.some(o => o.k === "train" && o.lane === l && o.s0 <= s && o.s1 >= s));
        assert.ok(blocked.length < 3, `${d} seed ${seed}: all lanes blocked by trains at s=${s}`);
      }
    }
  }
});

test("every card row has exactly one matching card", () => {
  const sim = new Sim(MISSIONS[2], { difficulty: "hard", assists: { autoJump: true, autoDodge: true, guide: false }, seed: 11, demo: true });
  const rows = new Map<number, Set<number>>();
  const seen = () => { for (const c of sim.pickups) if (c.k === "card") { const r = rows.get(c.card!.row) || new Set(); if (c.card!.target) r.add(c.id); rows.set(c.card!.row, r); } };
  seen(); sim.start();
  for (let i = 0; i < 40 / DT; i++) { sim.step(DT, idle); if (i % 60 === 0) seen(); }
  assert.ok(rows.size >= 10);
  for (const ids of rows.values()) assert.equal(ids.size, 1);
});

test("cards never sit inside a train or on a barrier", () => {
  for (let seed = 1; seed < 30; seed++) {
    const sim = new Sim(MISSIONS[seed % 15], { difficulty: "hard", assists: DEFAULT_ASSISTS.hard, seed });
    for (const c of sim.pickups.filter(p => p.k === "card"))
      assert.ok(!sim.obstacles.some(o => o.lane === c.lane && c.s > o.s0 - 3 && c.s < o.s1 + 3), `seed ${seed}: card at ${c.s} overlaps an obstacle`);
  }
});

test("Easy mode with helpers finishes every world without help from the player", () => {
  MISSIONS.forEach((m, i) => {
    const sim = new Sim(m, { difficulty: "easy", assists: DEFAULT_ASSISTS.easy, seed: 100 + i });
    sim.start();
    const events = run(sim, 240);
    assert.equal(sim.state, "win", `${m.look.name} did not finish (caught ${sim.caught}/${m.goal})`);
    assert.equal(sim.wrong, 0, `${m.look.name}: the guide should never pick a wrong card`);
    assert.ok(events.includes("card") && events.includes("coin"));
    assert.equal(sim.p.hearts, 3, "Easy never takes hearts");
  });
});

test("Medium with the default helpers rarely crashes when the player steers to the cards", () => {
  let wins = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const sim = new Sim(MISSIONS[seed % 15], { difficulty: "medium", assists: { autoJump: true, autoDodge: true, guide: true }, seed });
    sim.start();
    run(sim, 240);
    if (sim.state === "win") wins++;
  }
  assert.ok(wins >= 11, `only ${wins}/12 assisted medium runs finished`);
});

test("running into a train front crashes, costs a heart on Medium and moves you to a free lane", () => {
  const sim = new Sim(MISSIONS[0], { difficulty: "medium", assists: { autoJump: false, autoDodge: false, guide: false }, seed: 5 });
  sim.obstacles = []; sim.pickups = [];
  sim.obstacles.push({ id: 999, k: "train", lane: 1, s0: 20, s1: 31, cars: 1, hit: false });
  sim.start();
  const ev = run(sim, 3);
  assert.ok(ev.includes("crash"));
  assert.equal(sim.p.hearts, 2);
  assert.notEqual(sim.p.lane, 1);
});

test("a ramp carries you up onto the train roof", () => {
  const sim = new Sim(MISSIONS[0], { difficulty: "medium", assists: { autoJump: false, autoDodge: false, guide: false }, seed: 5 });
  sim.obstacles = []; sim.pickups = [];
  sim.obstacles.push({ id: 998, k: "ramp", lane: 1, s0: 20, s1: 28, cars: 0, hit: false }, { id: 999, k: "train", lane: 1, s0: 28, s1: 50, cars: 2, hit: false });
  sim.start();
  let maxY = 0;
  for (let i = 0; i < 4 / DT; i++) { sim.step(DT, idle); if (sim.p.s > 30 && sim.p.s < 48) maxY = Math.max(maxY, sim.p.y); }
  assert.equal(sim.crashes, 0);
  assert.ok(Math.abs(maxY - TRAIN_H) < 0.05, `expected to ride on the roof, max y ${maxY}`);
});

test("jumping clears a barrier; standing still into it does not", () => {
  const make = () => {
    const sim = new Sim(MISSIONS[0], { difficulty: "hard", assists: { autoJump: false, autoDodge: false, guide: false }, seed: 9 });
    sim.obstacles = [{ id: 997, k: "barrier", lane: 1, s0: 30, s1: 30.5, cars: 0, hit: false }]; sim.pickups = []; sim.start(); return sim;
  };
  const hit = make(); run(hit, 3); assert.equal(hit.crashes, 1);
  const jumper = make();
  run(jumper, 3, s => ({ ...idle, jump: s.obstacles.some(o => o.k === "barrier" && o.s0 - s.p.s > 0 && o.s0 - s.p.s < 3) }));
  assert.equal(jumper.crashes, 0);
});

test("looking at a lane (gaze steering) moves the runner there", () => {
  const sim = new Sim(MISSIONS[0], { difficulty: "easy", assists: { autoJump: true, autoDodge: false, guide: false }, seed: 2 });
  sim.start();
  run(sim, 0.5, () => ({ ...idle, lane: 2 }));
  assert.equal(sim.p.lane, 2);
  assert.ok(Math.abs(sim.p.x - LANE_X[2]) < 0.01);
  run(sim, 0.5, () => ({ ...idle, lane: 0 }));
  assert.equal(sim.p.lane, 0);
});

test("on Easy, a child staring at one lane still gets every card, with no wrong picks or crashes", () => {
  for (const lane of [0, 1, 2]) {
    const sim = new Sim(MISSIONS[lane * 4], { difficulty: "easy", assists: DEFAULT_ASSISTS.easy, seed: 300 + lane });
    sim.start();
    run(sim, 240, () => ({ ...idle, lane }));
    assert.equal(sim.state, "win", `gaze fixed on lane ${lane} should still finish`);
    assert.equal(sim.wrong, 0);
    assert.equal(sim.crashes, 0);
  }
});

test("with auto-dodge on, looking toward a train beside you doesn't steer into it", () => {
  const sim = new Sim(MISSIONS[0], { difficulty: "easy", assists: { autoJump: true, autoDodge: true, guide: false }, seed: 8 });
  sim.obstacles = [{ id: 1, k: "train", lane: 0, s0: 5, s1: 60, cars: 3, hit: false }]; sim.pickups = [];
  sim.start();
  const ev = run(sim, 2, () => ({ ...idle, lane: 0 }));
  assert.equal(sim.p.lane, 1);
  assert.ok(!ev.includes("bump") && !ev.includes("crash"));
});

test("a wrong card costs a heart on Medium but never on Easy, and Hard can end the run", () => {
  for (const d of ["easy", "medium"] as Difficulty[]) {
    const sim = new Sim(MISSIONS[0], { difficulty: d, assists: { autoJump: true, autoDodge: false, guide: false }, seed: 4 });
    sim.obstacles = []; sim.pickups = [];
    sim.pickups.push({ id: 900, k: "card", lane: 1, s: 15, y: 1.35, alive: true, card: { label: "dog", emoji: "🐶", target: false, row: 900 } });
    sim.start(); run(sim, 2);
    assert.equal(sim.wrong, 1);
    assert.equal(sim.p.hearts, d === "easy" ? 3 : 2);
  }
  const hard = new Sim(MISSIONS[0], { difficulty: "hard", assists: { autoJump: true, autoDodge: false, guide: false }, seed: 4 });
  hard.obstacles = []; hard.pickups = [];
  for (let i = 0; i < 3; i++) hard.pickups.push({ id: 800 + i, k: "card", lane: 1, s: 20 + i * 40, y: 1.35, alive: true, card: { label: "dog", emoji: "🐶", target: false, row: 800 + i } });
  hard.start(); const ev = run(hard, 12);
  assert.equal(hard.state, "fail");
  assert.ok(ev.includes("fail"));
});

test("results give 3 stars for a clean run and more points on harder speeds", () => {
  const sims = (["easy", "hard"] as Difficulty[]).map(d => { const s = new Sim(MISSIONS[0], { difficulty: d, assists: DEFAULT_ASSISTS.easy, seed: 1 }); s.coins = 10; s.caught = 8; return s; });
  assert.equal(sims[0].stars(), 3);
  assert.ok(sims[1].score() > sims[0].score());
});

test("the demo runner (title screen) never ends", () => {
  const sim = new Sim(MISSIONS[8], { difficulty: "medium", assists: DEFAULT_ASSISTS.easy, seed: 7, demo: true });
  sim.start(); run(sim, 120);
  assert.equal(sim.state, "run");
  assert.ok(sim.caught > 10);
});
