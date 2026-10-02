// Skybound Sprint — level designs. Tile coordinates: column x to the right, row y upward (row 0 = bottom).
import { T, type Ent, type GiftContent, type LevelDef, type ThemeId } from "./sim";

const CHAR: Record<string, number> = {
  B: T.BRICK, X: T.STONE, K: T.CRUMBLE, I: T.ICE, O: T.BOUNCE, W: T.ONEWAY, "^": T.SPIKE, G: T.GROUND, U: T.USED, "#": T.METAL,
};
const GIFT: Record<string, GiftContent> = { "?": "gem", M: "gems", F: "feather", S: "star", H: "heart" };

class LB {
  tiles: Uint8Array; gifts: Record<number, GiftContent> = {}; ents: Ent[] = []; start = { x: 2.5, y: 4 };
  constructor(public id: string, public num: string, public name: string, public theme: ThemeId, public blurb: string, public w: number, public h: number, public parTime: number) {
    this.tiles = new Uint8Array(w * h);
  }
  set(x: number, y: number, t: number) { if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.tiles[y * this.w + x] = t; }
  /** solid column(s) from the bottom up to (not including) `top` */
  ground(x: number, w: number, top: number, t: number = T.GROUND) { for (let c = x; c < x + w; c++) for (let r = 0; r < top; r++) this.set(c, r, t); return this; }
  fill(x: number, y: number, w: number, h: number, t: number) { for (let c = x; c < x + w; c++) for (let r = y; r < y + h; r++) this.set(c, r, t); return this; }
  clear(x: number, y: number, w: number, h: number) { return this.fill(x, y, w, h, T.EMPTY); }
  row(x: number, y: number, pattern: string) {
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i];
      if (ch === ".") continue;
      if (GIFT[ch]) { this.set(x + i, y, T.GIFT); this.gifts[y * this.w + x + i] = GIFT[ch]; }
      else if (CHAR[ch] !== undefined) this.set(x + i, y, CHAR[ch]);
    }
    return this;
  }
  plat(x: number, y: number, w: number, t: number = T.ONEWAY) { return this.fill(x, y, w, 1, t); }
  /** a staircase rising (dir 1) or falling (dir -1) from `baseTop` */
  stairs(x: number, baseTop: number, steps: number, dir = 1, t: number = T.STONE) {
    for (let i = 0; i < steps; i++) { const c = x + i; const top = dir > 0 ? baseTop + i + 1 : baseTop + steps - i; for (let r = 0; r < top; r++) this.set(c, r, t); }
    return this;
  }
  gems(x: number, y: number, n: number, dx = 1, dy = 0) { for (let i = 0; i < n; i++) this.ents.push({ k: "gem", x: x + i * dx + 0.5, y: y + i * dy + 0.5 }); return this; }
  arc(x: number, y: number, n: number, height: number) { for (let i = 0; i < n; i++) { const t = n > 1 ? i / (n - 1) : 0.5; this.ents.push({ k: "gem", x: x + i + 0.5, y: y + 0.5 + Math.sin(t * Math.PI) * height }); } return this; }
  shard(x: number, y: number, i: number) { this.ents.push({ k: "shard", x: x + 0.5, y: y + 0.5, i }); return this; }
  puff(x: number, y: number) { this.ents.push({ k: "puff", x: x + 0.5, y }); return this; }
  spiky(x: number, y: number) { this.ents.push({ k: "spiky", x: x + 0.5, y }); return this; }
  buzzer(x: number, y: number, range = 2, amp = 1) { this.ents.push({ k: "buzzer", x: x + 0.5, y, range, amp }); return this; }
  spring(x: number, y: number) { this.ents.push({ k: "spring", x, y }); return this; }
  updraft(x: number, y: number, w: number, h: number) { this.ents.push({ k: "updraft", x, y, w, h }); return this; }
  mover(x: number, y: number, w: number, dx: number, dy: number, period = 4, phase = 0) { this.ents.push({ k: "mover", x, y, w, dx, dy, period, phase }); return this; }
  check(x: number, y: number) { this.ents.push({ k: "check", x: x + 0.5, y }); return this; }
  goal(x: number, y: number) { this.ents.push({ k: "goal", x: x + 0.5, y }); return this; }
  sign(x: number, y: number, text: string) { this.ents.push({ k: "sign", x: x + 0.5, y, text }); return this; }
  item(k: "feather" | "heart", x: number, y: number) { this.ents.push({ k, x: x + 0.5, y }); return this; }
  build(): LevelDef {
    return { id: this.id, num: this.num, name: this.name, theme: this.theme, blurb: this.blurb, w: this.w, h: this.h, tiles: this.tiles, gifts: this.gifts, ents: this.ents, start: this.start, parTime: this.parTime, boss: this.ents.some(e => e.k === "boss") };
  }
}

// ── 1-1 Meadow Isles: learn to run, jump, stomp and glide ──
function meadow() {
  const L = new LB("meadow", "1-1", "Meadow Isles", "meadow", "Hop across sunny floating islands. Learn to jump, stomp and glide.", 200, 24, 95);
  L.start = { x: 2.5, y: 4 };
  L.ground(0, 32, 4).sign(4, 4, "← → run · JUMP to hop").gems(7, 6, 4);
  L.row(12, 8, "?BFB?").puff(20, 4);
  L.fill(26, 4, 2, 2, T.STONE);
  L.arc(31, 6, 5, 2.5);
  L.ground(36, 20, 4).puff(42, 4).puff(48, 4);
  L.row(40, 8, "B?B?B").plat(46, 12, 3).shard(47, 14, 0).gems(46, 13, 1);
  L.ground(56, 10, 6).gems(57, 8, 6);
  L.ground(70, 24, 5).check(72, 5).sign(76, 5, "Tap JUMP again in the air to GLIDE").puff(82, 5).buzzer(88, 8, 3);
  L.gems(95, 8, 7).shard(98, 10, 1);
  L.ground(103, 22, 3).row(108, 7, "?S?").puff(113, 3).puff(117, 3).puff(121, 3);
  L.stairs(125, 3, 6);
  L.plat(133, 9, 4).gems(133, 10, 4).plat(139, 10, 3).gems(139, 11, 3).buzzer(141, 14, 2).plat(144, 9, 4).gems(144, 10, 4);
  L.ground(149, 51, 4).check(151, 4).puff(157, 4).puff(162, 4).row(158, 8, "?M?");
  L.stairs(168, 4, 5).fill(173, 4, 3, 5, T.STONE).gems(173, 9, 3);
  L.fill(178, 4, 2, 7, T.STONE).shard(178, 12, 2);
  L.goal(190, 4);
  return L.build();
}

// ── 1-2 Windy Bluffs: updrafts and long glides ──
function bluffs() {
  const L = new LB("bluffs", "1-2", "Windy Bluffs", "bluffs", "Tall cliffs and roaring wind. Glide into the wind to soar upward.", 214, 26, 110);
  L.start = { x: 2.5, y: 5 };
  L.ground(0, 18, 5).sign(4, 5, "GLIDE into the wind to float up ↑").gems(8, 6, 3);
  L.updraft(13, 5, 4, 10).gems(14, 9, 4, 0, 1);
  L.ground(18, 16, 11).gems(22, 12, 4).puff(28, 11);
  L.arc(36, 13, 9, 2).buzzer(41, 10, 2);
  L.ground(47, 20, 6).check(49, 6).puff(55, 6).puff(61, 6).row(56, 10, "?F?");
  L.updraft(70, -4, 4, 18).shard(71, 16, 0).gems(71, 9, 3, 0, 2);
  L.ground(77, 12, 8).buzzer(83, 11, 2).gems(80, 9, 5);
  L.ground(89, 8, 6).puff(93, 6).ground(97, 11, 4).gems(98, 5, 4);
  L.updraft(103, 4, 4, 12).fill(108, 4, 3, 9, T.STONE).gems(104, 8, 4, 0, 1);
  L.arc(112, 13, 8, 1.5);
  L.ground(121, 15, 7).check(123, 7).buzzer(128, 10, 3).buzzer(133, 9, 2).row(126, 11, "B?B");
  L.fill(139, 6, 5, 2, T.GROUND).gems(139, 8, 5);
  L.fill(148, 8, 4, 2, T.GROUND).gems(148, 10, 4);
  L.shard(149, 5, 1).updraft(152, -4, 3, 17);
  L.fill(157, 5, 5, 2, T.GROUND).gems(157, 7, 5);
  L.ground(165, 49, 5).check(167, 5).puff(172, 5);
  L.updraft(175, 5, 3, 13).fill(178, 5, 2, 10, T.STONE).gems(179, 15, 1).gems(176, 9, 3, 0, 2);
  L.shard(186, 14, 2).gems(183, 13, 3).puff(190, 5).puff(194, 5);
  L.goal(204, 5);
  return L.build();
}

// ── 1-3 Crystal Caverns: ground-pound, spikies, spike floors ──
function caverns() {
  const L = new LB("caverns", "1-3", "Crystal Caverns", "caverns", "Glowing crystals under the islands. Ground-pound through bricks and watch out for Spikies!", 196, 20, 115);
  L.start = { x: 2.5, y: 4 };
  L.fill(0, 16, 196, 4, T.STONE); // cave ceiling
  L.ground(0, 34, 4).sign(4, 4, "Press ▼ in the air to GROUND-POUND");
  L.clear(14, 1, 3, 2).row(14, 3, "BBB").shard(15, 1, 0).gems(14, 1, 1).gems(16, 1, 1);
  L.row(20, 8, "?B?B").spiky(26, 4).gems(22, 5, 3);
  L.row(30, 4, "^^^").gems(30, 7, 3);
  L.ground(38, 22, 4).puff(42, 4).spiky(48, 4).row(44, 8, "BMB").fill(52, 4, 2, 3, T.STONE).row(56, 4, "^^").gems(55, 8, 4);
  L.plat(62, 6, 3).plat(67, 8, 3).plat(72, 6, 3).gems(62, 7, 3).gems(67, 9, 3).gems(72, 7, 3).buzzer(68, 12, 2);
  L.ground(77, 26, 4).check(79, 4).spiky(85, 4).spiky(91, 4).row(86, 8, "?F?");
  // a low ceiling corridor
  L.fill(95, 9, 8, 7, T.STONE).gems(95, 5, 8).puff(99, 4);
  L.ground(107, 6, 4);
  L.fill(103, 0, 4, 4, T.EMPTY).row(103, 3, "BBBB"); // brick bridge over a drop
  L.clear(113, 0, 5, 4).plat(113, 3, 5, T.STONE);
  L.row(113, 4, ".^^^.");
  L.gems(113, 8, 5);
  L.ground(118, 24, 4).puff(122, 4).spiky(127, 4).puff(133, 4).row(126, 8, "B?BSB");
  L.clear(136, 1, 4, 2).row(136, 3, "BBBB").shard(137, 1, 1).gems(136, 1, 4);
  L.plat(143, 7, 3, T.STONE).plat(149, 9, 3, T.STONE).plat(155, 7, 3, T.STONE).buzzer(150, 12, 2).gems(149, 10, 3);
  L.ground(160, 36, 4).check(162, 4).spiky(167, 4).spiky(171, 4);
  L.fill(174, 4, 2, 3, T.STONE).fill(178, 10, 3, 6, T.STONE).gems(174, 8, 2);
  L.clear(182, 1, 3, 2).row(182, 3, "BBB").shard(183, 1, 2).gems(182, 1, 1).gems(184, 1, 1);
  L.goal(188, 4);
  return L.build();
}

// ── 1-4 Cloudtop Bounce: bounce clouds and moving platforms ──
function clouds() {
  const L = new LB("clouds", "1-4", "Cloudtop Bounce", "clouds", "Bounce on springy clouds and ride drifting platforms high above the sea.", 206, 26, 110);
  L.start = { x: 2.5, y: 6 };
  L.ground(0, 14, 6).sign(4, 6, "Land on pink clouds to BOUNCE!").gems(6, 7, 4);
  L.row(16, 4, "OO").gems(16, 9, 2, 1, 0).ground(20, 8, 8).puff(24, 8);
  L.row(30, 5, "OO").row(36, 7, "OO").ground(41, 10, 9).gems(31, 11, 2).gems(37, 13, 2).shard(36, 14, 0);
  L.mover(53, 8, 3, 6, 0, 4).gems(54, 10, 7);
  L.ground(64, 14, 7).check(66, 7).puff(70, 7).puff(74, 7).row(68, 11, "?F?");
  L.mover(80, 6, 3, 0, 6, 4).fill(86, 12, 6, 1, T.ONEWAY).gems(86, 13, 6).buzzer(89, 16, 2);
  L.mover(94, 12, 3, 7, 0, 4, 0.5);
  L.ground(106, 16, 6).check(108, 6).buzzer(113, 9, 3).puff(117, 6).row(114, 10, "B?BMB");
  L.row(124, 4, "OOO").row(130, 8, "OO").row(135, 12, "OOO").gems(124, 8, 3).gems(130, 13, 2).gems(135, 17, 3).shard(140, 19, 1);
  L.fill(140, 13, 6, 1, T.ONEWAY).plat(149, 11, 3).plat(155, 9, 3).buzzer(152, 14, 2).gems(149, 12, 3).gems(155, 10, 3);
  L.ground(160, 46, 6).check(162, 6).puff(167, 6).puff(171, 6);
  L.mover(174, 7, 3, 0, 8, 4).fill(178, 15, 4, 1, T.ONEWAY).shard(179, 17, 2).gems(178, 16, 4);
  L.row(184, 6, "OO").gems(184, 10, 2).puff(190, 6);
  L.goal(198, 6);
  return L.build();
}

// ── 1-5 Frosty Peaks: slippery ice and crumbling ledges ──
function frost() {
  const L = new LB("frost", "1-5", "Frosty Peaks", "frost", "Snowy peaks with slippery ice and ledges that crumble under your feet.", 204, 26, 120);
  L.start = { x: 2.5, y: 5 };
  L.ground(0, 20, 5).fill(10, 4, 10, 1, T.ICE).sign(4, 5, "ICE is slippery · cracked blocks crumble!").gems(11, 6, 8).puff(16, 5);
  L.row(22, 6, "KKK").row(28, 7, "KKK").row(34, 6, "KKK").gems(22, 7, 3).gems(28, 8, 3).gems(34, 7, 3);
  L.ground(39, 18, 6).fill(39, 5, 18, 1, T.ICE).spiky(46, 6).puff(51, 6).row(44, 10, "?H?");
  L.stairs(57, 6, 4, 1, T.ICE).fill(61, 9, 4, 1, T.ICE).fill(61, 0, 4, 9, T.GROUND);
  L.check(62, 10).row(66, 10, "KKKK").row(72, 11, "KK").row(76, 12, "KK").gems(66, 11, 4).gems(72, 12, 2).gems(76, 13, 2).shard(77, 16, 0);
  L.ground(80, 20, 9).fill(80, 8, 20, 1, T.ICE).spiky(86, 9).spiky(92, 9).buzzer(89, 13, 3);
  L.ground(100, 6, 7).ground(106, 6, 5).ground(112, 10, 3).puff(115, 3).row(114, 7, "?F?");
  L.row(124, 5, "KKK").row(130, 7, "KKK").row(136, 9, "KKK").gems(124, 6, 3).gems(130, 8, 3).gems(136, 10, 3).buzzer(133, 12, 2);
  L.ground(141, 16, 8).check(143, 8).fill(146, 7, 11, 1, T.ICE).spiky(150, 8).puff(154, 8);
  L.shard(149, 14, 1).plat(147, 12, 4).gems(147, 13, 4);
  L.row(159, 7, "KK").row(163, 6, "KK").row(167, 5, "KK").gems(159, 8, 2).gems(163, 7, 2).gems(167, 6, 2);
  L.ground(171, 33, 5).puff(176, 5).spiky(181, 5);
  L.fill(184, 5, 3, 4, T.ICE).fill(184, 0, 3, 5, T.GROUND).shard(185, 12, 2);
  L.goal(196, 5);
  return L.build();
}

// ── 1-6 Sunset Windmills: springs, wall-jumps and lifts ──
function sunset() {
  const L = new LB("sunset", "1-6", "Sunset Windmills", "sunset", "Golden-hour windmill towers. Springs, lifts, and wall-jumps up narrow shafts.", 212, 30, 125);
  L.start = { x: 2.5, y: 4 };
  L.ground(0, 22, 4).sign(4, 4, "Slide down a wall and JUMP to wall-jump").puff(14, 4).gems(8, 6, 4);
  // shaft: two walls, climb by wall-jumping
  L.fill(22, 4, 1, 12, T.STONE).fill(26, 4, 1, 10, T.STONE).ground(23, 3, 4).gems(24, 8, 4, 0, 2);
  L.ground(27, 14, 13).puff(32, 13).row(34, 17, "?F?");
  L.spring(42, 9).ground(41, 3, 9);
  L.plat(46, 18, 4).gems(46, 19, 4).shard(47, 22, 0);
  L.ground(52, 16, 8).check(54, 8).puff(58, 8).puff(63, 8).row(59, 12, "B?B");
  L.mover(69, 8, 3, 8, 0, 4).mover(81, 6, 3, 0, 7, 4, 0.25).gems(70, 10, 6).gems(81, 15, 3);
  L.ground(86, 12, 13).buzzer(91, 16, 2).spring(95, 13);
  L.plat(99, 21, 4).gems(99, 22, 4).ground(105, 14, 10).check(107, 10).puff(112, 10).row(110, 14, "?M?");
  L.updraft(120, 0, 3, 18).fill(124, 8, 4, 1, T.ONEWAY).gems(120, 10, 3, 0, 2);
  L.shard(121, 20, 1);
  L.ground(130, 18, 6).spiky(136, 6).puff(141, 6).spring(145, 6).plat(146, 14, 4).gems(146, 15, 4);
  // second shaft
  L.fill(150, 6, 1, 14, T.STONE).fill(154, 6, 1, 11, T.STONE).ground(151, 3, 6).gems(152, 10, 4, 0, 2);
  L.ground(155, 18, 17).check(157, 17).puff(163, 17).buzzer(167, 21, 2);
  L.mover(174, 14, 3, 7, -4, 4).gems(175, 16, 6);
  L.ground(186, 26, 8).puff(191, 8).spiky(196, 8);
  L.spring(198, 8).shard(198, 20, 2).gems(198, 12, 3, 0, 2);
  L.goal(205, 8);
  return L.build();
}

// ── 1-7 Thunder Fortress: everything at once ──
function fortress() {
  const L = new LB("fortress", "1-7", "Thunder Fortress", "fortress", "The Storm King's stronghold. Spikes, crumbling bridges and a whole army of Puffs.", 210, 24, 135);
  L.start = { x: 2.5, y: 4 };
  L.ground(0, 20, 4, T.STONE).sign(4, 4, "Almost there — reach the Sky Gate!").puff(10, 4).puff(14, 4);
  L.row(20, 3, "KKKKKK").gems(20, 5, 6).buzzer(23, 8, 2);
  L.ground(26, 18, 4, T.STONE).row(30, 4, "^^").spiky(35, 4).row(38, 4, "^^").row(33, 8, "?S?").gems(30, 7, 2).gems(38, 7, 2);
  L.plat(45, 6, 3, T.METAL).plat(50, 8, 3, T.METAL).plat(55, 6, 3, T.METAL).buzzer(51, 11, 2).gems(50, 9, 3);
  L.ground(59, 20, 4, T.STONE).check(61, 4).puff(66, 4).spiky(70, 4).puff(74, 4).row(67, 8, "BFB");
  L.fill(79, 4, 2, 8, T.METAL).spring(77, 4).gems(77, 9, 3, 0, 2);
  L.ground(81, 12, 12, T.STONE).puff(85, 12).spiky(89, 12);
  L.shard(86, 17, 0).plat(85, 15, 3, T.METAL);
  L.mover(94, 10, 3, 8, -4, 4).gems(95, 12, 6);
  L.ground(106, 16, 6, T.STONE).check(108, 6).row(112, 6, "^^^").gems(112, 9, 3).puff(117, 6).puff(120, 6);
  L.row(122, 5, "KKKKKKKK").buzzer(126, 9, 3).gems(122, 6, 8);
  L.ground(130, 14, 5, T.STONE).spiky(134, 5).spiky(139, 5).row(135, 9, "?H?");
  L.fill(144, 5, 1, 13, T.METAL).fill(148, 5, 1, 10, T.METAL).ground(145, 3, 5, T.STONE).gems(146, 9, 4, 0, 2).shard(146, 19, 1);
  L.ground(149, 14, 14, T.STONE).puff(153, 14).puff(158, 14).buzzer(156, 18, 2);
  L.row(163, 13, "KKK").row(167, 12, "KKK").row(171, 11, "KKK").gems(163, 14, 3).gems(167, 13, 3).gems(171, 12, 3);
  L.ground(175, 35, 6, T.STONE).check(177, 6).puff(182, 6).spiky(186, 6).puff(190, 6);
  L.updraft(193, 6, 3, 12).shard(194, 19, 2).gems(194, 10, 3, 0, 2);
  L.goal(202, 6);
  return L.build();
}

// ── 1-8 Storm King: the boss ──
function storm() {
  const L = new LB("storm", "1-8", "Storm King", "storm", "Face the Storm King above the clouds. Dodge lightning, then stomp him when he crashes down!", 36, 22, 90);
  L.start = { x: 4.5, y: 3 };
  L.ground(0, 36, 3, T.METAL).fill(0, 3, 1, 19, T.METAL).fill(35, 3, 1, 19, T.METAL);
  L.plat(5, 7, 4, T.ONEWAY).plat(27, 7, 4, T.ONEWAY).plat(15, 10, 6, T.ONEWAY);
  L.ents.push({ k: "boss", x: 18, y: 12 });
  L.sign(3, 3, "Stomp the Storm King when he crashes down!");
  return L.build();
}

let cache: LevelDef[] | null = null;
export function allLevels(): LevelDef[] { return cache || (cache = [meadow(), bluffs(), caverns(), clouds(), frost(), sunset(), fortress(), storm()]); }
export const LEVEL_IDS = ["meadow", "bluffs", "caverns", "clouds", "frost", "sunset", "fortress", "storm"] as const;
export function levelById(id: string) { return allLevels().find(l => l.id === id) || null; }
