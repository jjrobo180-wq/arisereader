'use strict';
/* Twinlight Run: a three-lane runner where the road exists in two worlds at once. */
(() => {
const { M4, Geo, Node, hex, lerp, clamp, damp, norm, mul3, mix3 } = E, I = M4.T, { sin, cos, PI, abs, floor, min, max, exp } = Math;
const $ = id => document.getElementById(id);
const cv = $('c'); let R;
try { R = new E.Renderer(cv, { outline: 0.022, maxDpr: matchMedia('(pointer: coarse)').matches ? 1.5 : 2 }); } catch (e) { $('fatal').hidden = false; $('fatalMsg').textContent = e.message; return; }
const A = E.Audio, P = new E.Particles(1300);
const QS = new URLSearchParams(location.search), HOSTED = QS.get('host') === 'arise' && window.parent !== window, UKEY = (QS.get('u') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
// On the Arise site each reader keeps their own save on a shared computer, and gets a way back to the Games page.
const skey = k => UKEY ? k + '_' + UKEY : k;
for (const b of document.querySelectorAll('.exit')) { b.hidden = !HOSTED; b.addEventListener('click', () => { try { window.parent.postMessage({ type: 'arise-game-exit' }, location.origin); } catch (e) { } }); }
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };

// ───────────── the two worlds ─────────────
const DAY = {
  lightDir: norm([-0.5, 0.72, 0.3]), lightCol: [1.04, 1.0, 0.93], shadowCol: [0.7, 0.63, 0.86], rimCol: [1, 0.95, 0.8], fogCol: hex('#c9e8ff'), fogNear: 50, fogFar: 165, outline: [0.2, 0.13, 0.24], unlit: 1,
  sky: { top: hex('#2a78e4'), hor: hex('#bfe7ff'), bot: hex('#e6f5ff'), sunDir: norm([-0.26, 0.2, -0.94]), sunCol: [1, 0.94, 0.72], sunSize: 0.9972, cloud: 0.5, cloudCol: [1, 1, 1], cloudShade: hex('#a9c5ef'), cloudSpeed: 0.012, stars: 0, moon: 0, aurora: 0, eclipse: 0, glow: 0.5 },
  bloom: 0.3, bloomThresh: 0.86, sat: 1.12, grade: [1.02, 1.0, 0.98], vig: 0.25, curve: [0, 0],
};
const NIGHT = {
  lightDir: norm([0.45, 0.7, 0.3]), lightCol: [0.6, 0.7, 1.02], shadowCol: [0.2, 0.2, 0.52], rimCol: [0.55, 0.8, 1], fogCol: hex('#1c1b52'), fogNear: 38, fogFar: 150, outline: [0.03, 0.02, 0.1], unlit: 0.82,
  sky: { top: hex('#060926'), hor: hex('#3b2f8c'), bot: hex('#15154a'), sunDir: norm([0.3, 0.24, -0.92]), sunCol: [0.86, 0.93, 1], sunSize: 0.9958, cloud: 0.43, cloudCol: hex('#6268c4'), cloudShade: hex('#2b2b72'), cloudSpeed: 0.008, stars: 1, moon: 1, aurora: 1, eclipse: 0, glow: 0.28 },
  bloom: 0.6, bloomThresh: 0.74, sat: 1.15, grade: [0.95, 0.98, 1.1], vig: 0.42, curve: [0, 0],
};
const ECL = {
  lightDir: norm([-0.2, 0.8, 0.3]), lightCol: [0.98, 0.82, 0.9], shadowCol: [0.5, 0.3, 0.62], rimCol: [1, 0.75, 0.5], fogCol: hex('#7d3f80'), fogNear: 45, fogFar: 160, outline: [0.14, 0.04, 0.16], unlit: 1,
  sky: { top: hex('#1a0b3a'), hor: hex('#ff9463'), bot: hex('#64306f'), sunDir: norm([0, 0.22, -0.97]), sunCol: [1, 0.86, 0.62], sunSize: 0.9958, cloud: 0.42, cloudCol: hex('#ffbe94'), cloudShade: hex('#84447f'), cloudSpeed: 0.03, stars: 0.7, moon: 0, aurora: 0.5, eclipse: 1, glow: 0.42 },
  bloom: 0.6, bloomThresh: 0.8, sat: 1.25, grade: [1.06, 0.98, 1.02], vig: 0.38, curve: [0, 0],
};

// ───────────── world pieces ─────────────
const SEG = 24, LANE = 2.3;
const C = {
  stone: { t: hex('#d6c8b3'), b: hex('#96846f') }, seam: hex('#b3a38c'), lane: hex('#f3ead8'), red: hex('#e8483a'), redD: hex('#b02e33'), dark: hex('#33263d'), wood: { t: hex('#c99a68'), b: hex('#8d6648') }, woodD: hex('#6d4c3d'),
  rock: { t: hex('#9c8777'), b: hex('#574a63') }, grass: { t: hex('#9be36f'), b: hex('#56b06a') }, wall: { t: hex('#fff6e6'), b: hex('#e6d4bd') }, pink: { t: hex('#ffd6e6'), b: hex('#ff8fbe') }, pine: { t: hex('#63c582'), b: hex('#2c7a5b') },
  lamp: hex('#ffd98a'), win: hex('#ffe9a8'), sun: { t: hex('#fff4b8'), b: hex('#ffb13d') }, sunD: hex('#e07a12'), moon: { t: hex('#dfe3ff'), b: hex('#6e68ff') }, moonD: hex('#3a2fb5'),
};
const meshes = {};
function buildTrack() {
  const g = new Geo(), gl = new Geo(), dc = new Geo(), L = SEG;
  for (let z = -L / 2 + 2; z < L / 2; z += 4) {
    g.box(7.8, 0.5, 4, C.stone, I(0, -0.25, z));
    for (const sx of [1, -1]) { g.box(0.34, 0.3, 4, C.red, I(sx * 3.73, 0.15, z)); g.box(0.1, 0.1, 4, C.red, I(sx * 3.73, 1.3, z)); g.box(0.08, 0.08, 4, C.redD, I(sx * 3.73, 0.82, z)); }
  }
  for (let z = -L / 2 + 1.5; z < L / 2; z += 3) { dc.box(7.1, 0.02, 0.07, C.seam, I(0, 0.011, z)); for (const x of [-LANE / 2, LANE / 2]) dc.box(0.12, 0.02, 1.5, C.lane, I(x, 0.014, z + 1.5)); }
  for (let z = -L / 2 + 3; z < L / 2; z += 6) for (const sx of [1, -1]) {
    g.cyl(0.13, 0.15, 1.3, 8, C.red, I(sx * 3.73, 0.92, z)); g.box(0.4, 0.1, 0.4, C.dark, I(sx * 3.73, 1.62, z));
    g.box(8.2, 0.3, 0.45, C.woodD, I(0, -0.66, z));
  }
  g.cyl(2.7, 0.3, 5.6, 7, C.rock, I(0, -3.5, 0)); g.cyl(1.2, 0.1, 3, 6, C.rock, I(2.3, -2.6, 7)); g.cyl(1.0, 0.1, 2.6, 6, C.rock, I(-2.1, -2.4, -8));
  for (const z of [-9, 3]) for (const sx of [1, -1]) {
    g.cyl(0.03, 0.03, 0.5, 5, C.dark, I(sx * 3.73, 1.9, z)); gl.ell(0.2, 0.26, 0.2, 8, 6, C.lamp, I(sx * 3.73, 2.25, z)); g.cyl(0.11, 0.11, 0.06, 8, C.dark, I(sx * 3.73, 2.52, z)); g.cyl(0.11, 0.11, 0.06, 8, C.dark, I(sx * 3.73, 1.98, z));
    g.cyl(0.05, 0.05, 1.0, 6, C.red, I(sx * 3.73, 2.1, z + 0.001));
  }
  gl.cyl(0.5, 0, 1.3, 6, hex('#8ff4ff'), I(0, -6.9, 0)); gl.cyl(0, 0.5, 0.6, 6, hex('#8ff4ff'), I(0, -5.95, 0));
  meshes.track = g.build(); meshes.trackGlow = gl.build(); meshes.trackDecal = dc.build();
}
function buildTorii() {
  const g = new Geo();
  for (const sx of [1, -1]) { g.cyl(0.3, 0.38, 6.6, 10, C.red, I(sx * 4.5, 3.0, 0, 0, 0, sx * 0.04)); g.cyl(0.45, 0.5, 0.5, 10, C.dark, I(sx * 4.62, -0.1, 0)); }
  g.box(11.4, 0.5, 0.75, C.red, I(0, 6.5, 0)); g.box(12.2, 0.22, 0.95, C.dark, I(0, 6.86, 0)); g.box(9.6, 0.36, 0.5, C.red, I(0, 5.4, 0)); g.box(0.7, 0.85, 0.2, C.dark, I(0, 5.95, 0)); g.box(0.5, 0.62, 0.22, hex('#ffd66b'), I(0, 5.95, 0));
  meshes.torii = g.build();
}
function buildIsland(seed) {
  const r = E.rng(seed), g = new Geo(), gl = new Geo(), Rr = 5 + r() * 3.5;
  g.cyl(Rr, Rr * 0.18, Rr * 1.5, 9, C.rock, I(0, -Rr * 0.75 - 0.25, 0)); g.cyl(Rr * 1.06, Rr * 1.0, 0.5, 9, C.grass, I(0, 0, 0));
  g.cyl(Rr * 0.3, 0.05, Rr * 0.8, 6, C.rock, I(Rr * 0.5, -Rr * 1.2, Rr * 0.3)); g.cyl(Rr * 0.22, 0.05, Rr * 0.6, 6, C.rock, I(-Rr * 0.6, -Rr * 0.9, -Rr * 0.2));
  const tree = (x, z, s, pine) => {
    if (pine) { g.cyl(0.14 * s, 0.2 * s, 1.2 * s, 6, C.woodD, I(x, 0.8 * s, z)); for (let i = 0; i < 3; i++) g.cyl(0, (1.15 - i * 0.28) * s, 1.3 * s, 7, C.pine, I(x, (1.7 + i * 0.85) * s, z), false, true); }
    else { g.cyl(0.16 * s, 0.3 * s, 2.2 * s, 6, C.woodD, I(x, 1.2 * s, z, 0.05, 0, 0.08)); for (const [dx, dy, dz, rr] of [[0, 2.9, 0, 1.5], [1.0, 2.5, 0.3, 1.1], [-0.9, 2.6, -0.4, 1.15], [0.2, 3.5, -0.6, 1.0], [-0.2, 2.4, 0.9, 0.95]]) g.ell(rr * s, rr * 0.82 * s, rr * s, 9, 6, C.pink, I(x + dx * s, dy * s, z + dz * s)); }
  };
  const house = (x, z, ry, w, d, hh, roofC) => {
    const m = I(x, 0.25, z, 0, ry, 0);
    g.box(w, hh, d, C.wall, E.at(m, 0, hh / 2, 0)); g.box(w + 0.1, 0.25, d + 0.1, C.woodD, E.at(m, 0, 0.12, 0)); g.roof(w, hh * 0.75, d, roofC, E.at(m, 0, hh, 0), 0.4);
    gl.box(0.55, 0.65, 0.06, C.win, E.at(m, -w * 0.22, hh * 0.55, d / 2 + 0.01)); gl.box(0.55, 0.65, 0.06, C.win, E.at(m, w * 0.22, hh * 0.55, d / 2 + 0.01)); gl.box(0.06, 0.6, 0.6, C.win, E.at(m, w / 2 + 0.01, hh * 0.55, 0)); gl.box(0.06, 0.6, 0.6, C.win, E.at(m, -w / 2 - 0.01, hh * 0.55, 0));
  };
  const roofs = [{ t: hex('#4f74c8'), b: hex('#33488f') }, { t: hex('#ef6a55'), b: hex('#b8403f') }, { t: hex('#3fb5a8'), b: hex('#267a7c') }];
  const kind = floor(r() * 4);
  if (kind === 0) { house(-1.2, 0.3, r() * 0.6, 2.8, 2.4, 1.9, roofs[floor(r() * 3)]); house(1.9, -1.2, 1.2 + r(), 2.2, 2.0, 1.6, roofs[floor(r() * 3)]); tree(-Rr * 0.6, -Rr * 0.4, 0.9, false); tree(Rr * 0.5, Rr * 0.5, 0.8, true); }
  else if (kind === 1) {
    let y = 0.25;
    for (let i = 0; i < 3; i++) { const w = 3.3 - i * 0.75; g.box(w, 1.5, w, C.wall, I(0, y + 0.75, 0)); for (const sx of [1, -1]) for (const sz of [1, -1]) g.box(0.2, 1.5, 0.2, C.red, I(sx * w / 2, y + 0.75, sz * w / 2)); for (const a of [0, PI / 2, PI, -PI / 2]) gl.box(0.6, 0.7, 0.06, C.win, E.at(I(0, y + 0.8, 0, 0, a, 0), 0, 0, w / 2 + 0.02)); g.cyl(w * 0.42, w * 1.02, 0.75, 4, { t: hex('#3e5fae'), b: hex('#27386f') }, I(0, y + 1.85, 0, 0, PI / 4, 0)); y += 2.2; }
    g.cyl(0.05, 0.1, 1.4, 6, hex('#ffd66b'), I(0, y + 0.6, 0)); gl.ell(0.18, 0.18, 0.18, 8, 6, hex('#ffe08a'), I(0, y + 1.35, 0)); tree(Rr * 0.6, 0.5, 0.8, false);
  }
  else if (kind === 2) { tree(0, 0, 1.25, false); tree(-Rr * 0.5, Rr * 0.3, 0.9, false); tree(Rr * 0.5, -Rr * 0.35, 1.0, false); g.cyl(0.25, 0.3, 0.9, 6, hex('#cfc7c0'), I(Rr * 0.3, 0.7, Rr * 0.5)); gl.box(0.3, 0.3, 0.3, C.lamp, I(Rr * 0.3, 1.3, Rr * 0.5)); g.cyl(0, 0.4, 0.3, 4, hex('#8d8591'), I(Rr * 0.3, 1.6, Rr * 0.5, 0, PI / 4, 0)); }
  else { tree(-Rr * 0.5, -0.5, 1.2, true); tree(Rr * 0.45, 0.8, 1.0, true); tree(0.3, -Rr * 0.5, 1.4, true); house(0, 1.0, r() * 3, 2.4, 2.2, 1.7, roofs[floor(r() * 3)]); }
  return { mesh: g.build(), glow: gl.build(), R: Rr };
}
function buildCloud(seed) { const r = E.rng(seed), g = new Geo(), col = { t: hex('#ffffff'), b: hex('#cbdcf7') }; const n = 5 + floor(r() * 3); for (let i = 0; i < n; i++) { const rr = 2.2 + r() * 2.6; g.ell(rr * 1.25, rr * 0.7, rr, 9, 6, col, I((i - n / 2) * 2.6 + r() * 1.5, r() * 1.4, r() * 3 - 1.5)); } return g.build(); }
function buildObstacles() {
  let g = new Geo();
  for (const sx of [1, -1]) g.cyl(0.08, 0.1, 0.95, 6, C.woodD, I(sx * 0.9, 0.47, 0));
  g.box(1.95, 0.3, 0.1, hex('#fff3df'), I(0, 0.72, 0)); for (let i = -2; i <= 2; i++) g.box(0.2, 0.3, 0.11, C.red, I(i * 0.42, 0.72, 0, 0, 0, 0.5)); g.box(1.95, 0.1, 0.1, C.woodD, I(0, 0.35, 0));
  meshes.low = g.build();
  g = new Geo();
  for (const sx of [1, -1]) g.cyl(0.1, 0.12, 2.6, 8, C.red, I(sx * 1.02, 1.3, 0));
  g.box(2.5, 0.34, 0.42, C.red, I(0, 2.25, 0)); g.box(2.7, 0.14, 0.52, C.dark, I(0, 2.48, 0));
  for (let i = -1; i <= 1; i++) { g.box(0.6, 0.86, 0.05, { t: hex('#39479f'), b: hex('#27306f') }, I(i * 0.63, 1.66, 0)); g.cyl(0.16, 0.16, 0.06, 12, hex('#fff3df'), I(i * 0.63, 1.7, 0, PI / 2, 0, 0)); }
  meshes.high = g.build();
  g = new Geo();
  g.box(1.85, 1.3, 1.5, C.wood, I(0, 0.65, 0)); g.box(1.5, 1.15, 1.25, C.wood, I(0.05, 1.88, 0.02, 0, 0.18, 0));
  for (const y of [0.18, 1.12]) g.box(1.92, 0.12, 1.57, C.woodD, I(0, y, 0)); for (const sx of [1, -1]) g.box(0.12, 1.3, 1.57, C.woodD, I(sx * 0.87, 0.65, 0));
  g.box(1.57, 0.1, 1.32, C.woodD, I(0.05, 2.4, 0.02, 0, 0.18, 0)); g.cyl(0.26, 0.2, 0.3, 8, hex('#6d7fb0'), I(0.05, 2.62, 0)); g.ell(0.5, 0.36, 0.5, 8, 6, C.pine, I(0.05, 3.0, 0)); g.ell(0.3, 0.25, 0.3, 8, 6, C.pine, I(0.38, 3.22, 0.1));
  meshes.block = g.build();
  const gate = (col, dark, moon) => {
    const k = new Geo();
    k.box(2.0, 2.9, 0.3, col, I(0, 1.5, 0)); for (const sx of [1, -1]) k.box(0.16, 3.1, 0.4, dark, I(sx * 1.04, 1.55, 0)); k.box(2.24, 0.16, 0.4, dark, I(0, 3.1, 0)); k.box(2.24, 0.12, 0.4, dark, I(0, 0.06, 0));
    for (const sz of [1, -1]) {
      if (!moon) { k.cyl(0.42, 0.42, 0.06, 16, [1, 1, 1], I(0, 1.7, sz * 0.17, PI / 2, 0, 0)); for (let i = 0; i < 8; i++) { const a = i / 8 * 2 * PI; k.box(0.1, 0.3, 0.05, [1, 1, 1], I(cos(a) * 0.72, 1.7 + sin(a) * 0.72, sz * 0.17, 0, 0, a - PI / 2)); } }
      else { k.cyl(0.52, 0.52, 0.06, 18, [1, 1, 1], I(0, 1.7, sz * 0.17, PI / 2, 0, 0)); k.cyl(0.42, 0.42, 0.07, 18, col.b, I(0.2, 1.82, sz * 0.172, PI / 2, 0, 0)); for (const [x, y] of [[-0.6, 2.5], [0.62, 0.9], [0.5, 2.55]]) k.box(0.12, 0.12, 0.05, [1, 1, 1], I(x, y, sz * 0.17, 0, 0, PI / 4)); }
    }
    return k.build();
  };
  meshes.sun = gate(C.sun, C.sunD, false); meshes.moon = gate(C.moon, C.moonD, true);
  g = new Geo(); g.ell(0.24, 0.24, 0.24, 10, 7, { t: hex('#fff7c4'), b: hex('#ffb52e') }); for (let i = 0; i < 6; i++) { const a = i / 6 * 2 * PI; g.cyl(0, 0.07, 0.2, 5, hex('#ffcf4d'), I(cos(a) * 0.33, sin(a) * 0.33, 0, 0, 0, a - PI / 2), false, true); }
  meshes.orbSun = g.build();
  g = new Geo(); g.ell(0.22, 0.22, 0.22, 10, 7, { t: hex('#f1f3ff'), b: hex('#8d8aff') }); g.torus(0.35, 0.035, 16, 5, hex('#c9c6ff'), I(0, 0, 0, 0.5, 0, 0.3));
  meshes.orbMoon = g.build();
  g = new Geo(); g.cyl(0, 0.42, 0.5, 6, hex('#7af2e0'), I(0, 0.25, 0), false, false); g.cyl(0.42, 0, 0.5, 6, hex('#3fc7d6'), I(0, -0.25, 0), false, false); g.torus(0.6, 0.04, 18, 5, [1, 1, 1]);
  meshes.shield = g.build();
  g = new Geo(); g.torus(0.36, 0.11, 16, 7, hex('#ff6fb1')); g.box(0.26, 0.26, 0.26, [1, 1, 1], I(0.36, 0, 0)); g.box(0.26, 0.26, 0.26, [1, 1, 1], I(-0.36, 0, 0));
  meshes.magnet = g.build();
  g = new Geo(); g.ell(0.2, 0.2, 0.2, 10, 7, [1, 1, 1]); for (const sx of [1, -1]) g.cyl(0, 0.08, 0.2, 5, [1, 1, 1], I(sx * 0.11, 0.2, 0, 0, 0, -sx * 0.35), false, true); g.cyl(0.12, 0, 0.34, 6, [1, 1, 1], I(0, -0.05, -0.26, 1.2, 0, 0), false, false);
  meshes.pip = g.build();
  g = new Geo(); for (const sx of [1, -1]) { g.ell(0.035, 0.05, 0.02, 6, 4, [0.12, 0.08, 0.2], I(sx * 0.07, 0.02, 0.185)); } meshes.pipFace = g.build();
  g = new Geo(); g.torus(1, 0.05, 28, 5, [1, 1, 1]); meshes.ring = g.build();
  meshes.shadow = E.shadowMesh();
}
buildTrack(); buildTorii(); buildObstacles();
const islands = []; for (let i = 0; i < 6; i++) islands.push(buildIsland(101 + i * 17));
const clouds = []; for (let i = 0; i < 3; i++) clouds.push(buildCloud(7 + i * 5));

const hero = E.makeHumanoid({ hair: hex('#2d3a8c'), hairStyle: 'spiky', eye: hex('#ffb02e'), top: hex('#fffaf0'), acc: hex('#ff7a3c'), bottom: hex('#2b3470'), boots: hex('#ff7a3c'), shin: hex('#fffaf0'), scarf: hex('#ff4f5e'), pouch: hex('#b8804f'), bootTop: hex('#2b3470'), stripe: hex('#ff7a3c') });
hero.root.r[1] = PI;

// ───────────── game state ─────────────
const FLOW_MAX = 45;
let state = 'menu', time = 0, night = false, realmT = 0, flipCd = 0, eclipse = 0, eclT = 0, flow = 0, score = 0, nSun = 0, nMoon = 0, streak = 0, mult = 1, best = store.get(skey('twinlight_best'), 0);
let obstacles = [], orbs = [], pickups = [], rings = [], nextRow = 0, gNight = false, rowCount = 0, shake = 0, slowmo = 1, tutorial = !store.get(skey('twinlight_seen'), false), hints = {}, combo = 0, comboT = 0, menuFlip = 0, paused = false;
const pl = { lane: 0, x: 0, y: 0, vy: 0, slide: 0, air: false, dist: 0, speed: 9, shield: false, magnet: 0, inv: 0, dead: 0, cycle: 0 };
const pip = { x: 1, y: 1.6, z: 0 };
const camPos = [3, 2, -5], camTgt = [0, 1.2, 0];
let seed = 1; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }, ri = n => floor(rnd() * n);
const speedAt = d => 13 + 17 * (1 - exp(-d / 1100));

function reset() {
  obstacles = []; orbs = []; pickups = []; rings = []; nextRow = 46; gNight = false; rowCount = 0; seed = (Date.now() & 0xffff) + 7;
  night = false; flipCd = 0; eclipse = 0; flow = 0; score = 0; nSun = 0; nMoon = 0; streak = 0; mult = 1; combo = 0; slowmo = 1; hints = {};
  Object.assign(pl, { lane: 0, x: 0, y: 0, vy: 0, slide: 0, air: false, dist: 0, speed: 12, shield: false, magnet: 0, inv: 0, dead: 0 });
}
function genRow(d) {
  rowCount++;
  const diff = clamp((d - 260) / 1700, 0, 1), v = speedAt(d), gap = max(11, v * lerp(1.08, 0.66, diff)), r = rnd(), cur = gNight ? 'm' : 's', oth = gNight ? 's' : 'm';
  let cells = ['.', '.', '.'];
  if (rowCount === 1) cells = ['.', 'b', '.'];
  else if (rowCount === 2) cells = ['l', 'l', 'l'];
  else if (rowCount === 3) cells = ['h', 'h', 'h'];
  else if (rowCount === 4 || r < 0.13 + 0.09 * diff) cells = [cur, cur, cur];
  else if (r < 0.31 + 0.1 * diff) { const a = ri(3), b = (a + 1 + ri(2)) % 3; cells = ['b', 'b', 'b']; cells[a] = oth; cells[b] = rnd() < 0.5 ? cur : (rnd() < 0.5 ? 'l' : 'h'); }
  else {
    const n = diff < 0.12 ? 1 : (rnd() < 0.42 - 0.22 * diff ? 1 : (rnd() < 0.62 ? 2 : 3)), order = [0, 1, 2].sort(() => rnd() - 0.5);
    for (let i = 0; i < n; i++) { const q = rnd(); cells[order[i]] = q < 0.4 ? 'b' : q < 0.7 ? 'l' : 'h'; }
    if (n === 3 && cells.every(c => c === 'b')) cells[order[0]] = rnd() < 0.5 ? 'l' : 'h';
  }
  const wall = cells.every(c => c === cur), kind = gNight ? 1 : 0;
  // a trail of orbs leading to a lane that is safe in the world you should be in
  const safe = [0, 1, 2].filter(i => cells[i] === '.' || cells[i] === oth), soft = [0, 1, 2].filter(i => cells[i] === 'l' || cells[i] === 'h');
  const lane = wall ? ri(3) : safe.length ? safe[ri(safe.length)] : soft[ri(soft.length)];
  const cnt = clamp(floor(gap * 0.5 / 2.1), 4, 8), endD = d - (wall ? 5 : cells[lane] === 'l' ? v * 0.36 + 1 : 1.5);
  for (let i = 0; i < cnt; i++) orbs.push({ k: kind, x: (lane - 1) * LANE, y: cells[lane] === 'h' ? 0.55 : 0.95, d: endD - (cnt - 1 - i) * 2.1 });
  if (cells[lane] === 'l') for (let i = 0; i < 5; i++) orbs.push({ k: kind, x: (lane - 1) * LANE, y: 0.95 + 1.55 * sin(PI * (i + 0.5) / 5), d: d + (i - 2) * v * 0.72 / 5 });
  if (!wall && rowCount > 5 && rnd() < 0.3) { const free = [0, 1, 2].filter(i => i !== lane && cells[i] === '.'); if (free.length) { const l2 = free[ri(free.length)]; for (let i = 0; i < 4; i++) orbs.push({ k: 1 - kind, x: (l2 - 1) * LANE, y: 0.95, d: d - 3 - i * 2.1 }); } }
  if (rowCount > 6 && rowCount % 13 === 0) { const free = [0, 1, 2].filter(i => cells[i] === '.' || cells[i] === oth); pickups.push({ k: rnd() < 0.55 ? 'shield' : 'magnet', x: ((free.length ? free[ri(free.length)] : 1) - 1) * LANE, d: d - gap * 0.5 }); }
  for (let i = 0; i < 3; i++) if (cells[i] !== '.') obstacles.push({ t: { b: 'block', l: 'low', h: 'high', s: 'sun', m: 'moon' }[cells[i]], lane: i - 1, d, wall });
  if (wall) gNight = !gNight;
  return gap;
}

// ───────────── sound ─────────────
const SONG = {
  bpm: 138, root: 62, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 4, 5, 3], pad: 1, leadType: 'square', leadV: 0.9, arpType: 'triangle',
  bass: '0..0..5.0..0.8.5', arp: '0.1.2.3.2.1.2.1.', kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: '..x...x...x...xx',
  lead: [[4, , , 4, , 5, , 7, , , 5, , 4, , 2, ,], [1, , , 1, , 2, , 4, , , 2, , 1, , -1, ,], [2, , , 2, , 4, , 5, , , 7, , 5, , 4, ,], [3, , 5, , 7, , 5, , 4, , , , , , , ,],
    [7, , , 7, , 9, , 8, , , 7, , 5, , 4, ,], [8, , , 6, , 5, , 4, , , 5, , 6, , 4, ,], [9, , 7, , 5, , 7, , 9, , , 11, , 9, , 7,], [8, , , , 7, , , , 5, , 4, , 2, , , ,]],
};
const sfx = {
  lane() { A.tone({ f: 520, f2: 700, d: 0.06, v: 0.08, type: 'triangle' }); },
  jump() { A.tone({ f: 330, f2: 720, d: 0.16, v: 0.14, type: 'square' }); },
  slide() { A.noise({ f: 2400, f2: 500, d: 0.28, v: 0.12 }); },
  orb(n) { const f = 660 * Math.pow(2, (min(n, 12) * 2 % 24) / 12 * 0.5); A.tone({ f, d: 0.12, v: 0.12, type: 'triangle' }); A.tone({ f: f * 2, d: 0.08, v: 0.05, t: 0.03 }); },
  flip(n) { A.noise({ f: n ? 3000 : 600, f2: n ? 400 : 4000, d: 0.3, v: 0.12 }); const b = n ? [74, 69, 62] : [62, 69, 74]; b.forEach((m, i) => A.tone({ f: A.m2f(m), d: 0.25, v: 0.11, type: 'triangle', t: i * 0.05 })); },
  phase() { [81, 86, 90, 93].forEach((m, i) => A.tone({ f: A.m2f(m), d: 0.2, v: 0.09, type: 'triangle', t: i * 0.04 })); },
  crash() { A.tone({ f: 160, f2: 40, d: 0.5, v: 0.5 }); A.noise({ f: 900, f2: 120, d: 0.5, v: 0.4, type: 'lowpass' }); },
  smash() { A.noise({ f: 1500, f2: 300, d: 0.22, v: 0.3 }); A.tone({ f: 220, f2: 90, d: 0.18, v: 0.25, type: 'square' }); },
  power() { [62, 66, 69, 74, 78].forEach((m, i) => A.tone({ f: A.m2f(m), d: 0.3, v: 0.1, type: 'square', t: i * 0.05 })); },
  eclipse() { [50, 57, 62, 66, 69, 74, 81].forEach((m, i) => A.tone({ f: A.m2f(m), d: 0.9, v: 0.1, type: 'sawtooth', t: i * 0.06 })); A.noise({ f: 300, f2: 6000, d: 0.9, v: 0.15 }); },
};

// ───────────── HUD ─────────────
const hud = { score: $('score'), mult: $('mult'), sun: $('nSun'), moon: $('nMoon'), flow: $('flowFill'), flowBox: $('flow'), realm: $('realm'), hint: $('hint'), pop: $('pops'), badge: $('badges') };
let lastScore = -1, hintT = 0;
function hint(text, secs = 2.6, big = false) { hud.hint.innerHTML = text; hud.hint.classList.toggle('big', big); hud.hint.classList.add('on'); hintT = secs; }
function pop(text, cls = '') { const el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = text; hud.pop.appendChild(el); setTimeout(() => el.remove(), 900); }
function show(id, on) { $(id).hidden = !on; }

// ───────────── actions ─────────────
function flip(force) {
  if (state !== 'play' || paused || (flipCd > 0 && !force)) return;
  night = !night; flipCd = 0.2; R.fx.flash = 0.3; R.fx.flashCol = night ? [0.45, 0.4, 1] : [1, 0.92, 0.6]; sfx.flip(night); A.color(night ? 1500 : 9000);
  rings.push({ t: 0, x: pl.x, y: pl.y + 0.9, z: -pl.dist, c: night ? [0.6, 0.6, 1] : [1, 0.85, 0.4] });
  P.burst(26, { x: pl.x, y: pl.y + 0.9, z: -pl.dist, c: night ? [0.6, 0.65, 1] : [1, 0.85, 0.35], s0: 0.22, life: 0.5, drag: 3, shape: 2 }, 6);
  if (hud.hint.classList.contains('big')) { hud.hint.classList.remove('on'); hintT = 0; }
  if (slowmo < 1) { slowmo = 1; hint('Gold walls are solid by day. Violet walls are solid at night.', 4); tutorial = false; store.set(skey('twinlight_seen'), true); }
}
function move(dir) { if (state !== 'play' || paused) return; const l = clamp(pl.lane + dir, -1, 1); if (l !== pl.lane) { pl.lane = l; sfx.lane(); } }
function jump() { if (state !== 'play' || paused) return; if (!pl.air) { pl.vy = 10; pl.air = true; pl.slide = 0; sfx.jump(); P.burst(6, { x: pl.x, y: 0.1, z: -pl.dist, c: [1, 1, 1], s0: 0.16, life: 0.3, add: false, a: 0.6 }, 1.5, 0.5); } }
function slide() { if (state !== 'play' || paused) return; if (pl.air) pl.vy = -17; pl.slide = 0.72; sfx.slide(); }
function start() {
  A.init(); A.music(SONG); A.color(9000); A.drums(1); reset(); state = 'play'; paused = false; show('menu', false); show('over', false); show('hud', true); show('pauseP', false);
  hint(touch ? 'Swipe left or right to change lanes' : 'Use ← → to change lanes', 3.2);
}
function die() {
  state = 'dying'; pl.dead = 0; shake = 0.7; R.fx.flash = 0.5; R.fx.flashCol = [1, 0.3, 0.3]; R.fx.aberr = 0.05; sfx.crash(); A.drums(0);
  P.burst(40, { x: pl.x, y: pl.y + 0.9, z: -pl.dist, c: [1, 0.6, 0.3], s0: 0.25, life: 0.7, g: 9, shape: 2 }, 7, 3);
}
function gameOver() {
  state = 'over'; const s = floor(score), rec = s > best; if (rec) { best = s; store.set(skey('twinlight_best'), best); }
  $('oScore').textContent = s.toLocaleString(); $('oBest').textContent = best.toLocaleString(); $('oDist').textContent = floor(pl.dist).toLocaleString() + ' m'; $('oSun').textContent = nSun; $('oMoon').textContent = nMoon; $('oNew').hidden = !rec;
  show('over', true); show('hud', false); A.color(900);
}
function setPaused(p) { if (state !== 'play') return; paused = p; show('pauseP', p); if (p) A.suspend(); else A.resume(); }
function smash(o) {
  o.gone = true; shake = max(shake, 0.25); sfx.smash(); score += 25 * mult;
  P.burst(22, { x: o.lane * LANE, y: 1.2, z: -o.d, c: o.t === 'sun' ? [1, 0.8, 0.3] : o.t === 'moon' ? [0.6, 0.6, 1] : [0.85, 0.65, 0.45], s0: 0.3, life: 0.6, g: 12, shape: 1, add: false }, 7, 4);
}

// ───────────── input ─────────────
const touch = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch', touch);
addEventListener('keydown', e => {
  if (e.repeat) return; const k = e.key;
  if (state === 'menu' || state === 'over') { if (k === 'Enter' || k === ' ') { e.preventDefault(); start(); } return; }
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') move(-1); else if (k === 'ArrowRight' || k === 'd' || k === 'D') move(1);
  else if (k === 'ArrowUp' || k === 'w' || k === 'W') jump(); else if (k === 'ArrowDown' || k === 's' || k === 'S') slide();
  else if (k === ' ' || k === 'Shift' || k === 'f' || k === 'F') flip(); else if (k === 'p' || k === 'P' || k === 'Escape') setPaused(!paused); else return;
  e.preventDefault();
});
let tp = null;
cv.addEventListener('pointerdown', e => { tp = { x: e.clientX, y: e.clientY, t: performance.now(), used: false }; });
cv.addEventListener('pointermove', e => {
  if (!tp || tp.used) return; const dx = e.clientX - tp.x, dy = e.clientY - tp.y;
  if (max(abs(dx), abs(dy)) > 26) { tp.used = true; if (abs(dx) > abs(dy)) move(dx > 0 ? 1 : -1); else if (dy < 0) jump(); else slide(); }
});
cv.addEventListener('pointerup', () => { if (tp && !tp.used && performance.now() - tp.t < 350) flip(); tp = null; });
cv.addEventListener('pointercancel', () => { tp = null; });
$('flipBtn').addEventListener('pointerdown', e => { e.preventDefault(); flip(); });
$('playBtn').addEventListener('click', start); $('againBtn').addEventListener('click', start);
$('pauseBtn').addEventListener('click', () => setPaused(!paused)); $('resumeBtn').addEventListener('click', () => setPaused(false));
$('soundBtn').addEventListener('click', () => { A.init(); A.mute(!A.muted); $('soundBtn').classList.toggle('off', A.muted); $('soundBtn').setAttribute('aria-pressed', String(!A.muted)); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') setPaused(true); });
$('mBest').textContent = best.toLocaleString();

// ───────────── frame ─────────────
const tm = M4.create(), h3 = (a, b, c) => { let x = Math.imul(a * 374761393 + b * 668265263 + c * 2147483647 | 0, 1274126177); x ^= x >>> 15; return ((x >>> 0) % 10007) / 10007; };
function update(rdt) {
  time += rdt;
  let dt = rdt * (paused ? 0 : slowmo);
  if (state === 'menu') {
    pl.speed = 9; pl.dist += pl.speed * dt; pl.x = damp(pl.x, 0, 6, dt); menuFlip += dt; if (menuFlip > 5) { menuFlip = 0; night = !night; }
  } else if (state === 'play') {
    pl.speed = speedAt(pl.dist) * (eclipse > 0 ? 1.18 : 1); pl.dist += pl.speed * dt; score += pl.speed * dt * mult;
    while (nextRow < pl.dist + 150) nextRow += genRow(nextRow);
    flipCd -= dt; pl.inv -= dt; pl.magnet -= dt; comboT -= dt; if (comboT < 0) combo = 0;
    const tx = pl.lane * LANE; pl.x = damp(pl.x, tx, 18, dt);
    if (pl.air) { pl.vy -= 28 * dt; pl.y += pl.vy * dt; if (pl.y <= 0) { pl.y = 0; pl.vy = 0; pl.air = false; P.burst(5, { x: pl.x, y: 0.08, z: -pl.dist, c: [1, 1, 1], s0: 0.15, life: 0.25, add: false, a: 0.5 }, 1.6, 0.3); } }
    if (pl.slide > 0 && !pl.air) pl.slide -= dt;
    if (eclipse > 0) { eclipse -= dt; if (eclipse <= 0) { hint('Eclipse over', 1.4); A.color(night ? 1500 : 9000); } }
    // first-time coaching
    for (const o of obstacles) {
      const ahead = o.d - pl.dist; if (ahead < 0 || ahead > 36) continue;
      if (o.t === 'low' && !hints.low) { hints.low = 1; hint(touch ? 'Swipe up to jump' : 'Press ↑ to jump'); }
      if (o.t === 'high' && !hints.high) { hints.high = 1; hint(touch ? 'Swipe down to slide' : 'Press ↓ to slide'); }
      if (o.wall && !hints.wall && ahead < 30) { hints.wall = 1; hint(touch ? 'Tap to FLIP worlds' : 'Press SPACE to FLIP worlds', 5, true); }
      if (o.wall && tutorial && ahead < 13 && ((o.t === 'sun') !== night)) slowmo = 0.12;
    }
    // collisions
    for (const o of obstacles) {
      if (o.gone) continue; const dz = o.d - pl.dist, lx = o.lane * LANE;
      if (abs(pl.x - lx) > 1.05 || pl.god) continue;
      const half = o.t === 'block' ? 1.05 : 0.5; if (abs(dz) > half) continue;
      const gate = o.t === 'sun' || o.t === 'moon', solid = o.t === 'low' ? pl.y < 0.72 : o.t === 'high' ? pl.slide <= 0 || pl.air : gate ? eclipse <= 0 && ((o.t === 'sun') !== night) : true;
      if (!solid) { if (gate && !o.phased && eclipse <= 0) { o.phased = true; streak++; mult = 1 + min(9, floor(streak / 3)); score += 100 * mult; pop('PHASE  +' + 100 * mult, night ? 'moon' : 'sun'); sfx.phase(); flow = min(FLOW_MAX, flow + 3); P.burst(18, { x: pl.x, y: pl.y + 1, z: -pl.dist, c: night ? [0.6, 0.65, 1] : [1, 0.85, 0.35], s0: 0.2, life: 0.5, drag: 2, shape: 2 }, 5); } continue; }
      if (eclipse > 0 || pl.inv > 0) { smash(o); continue; }
      if (pl.shield) { pl.shield = false; pl.inv = 1.3; smash(o); pop('SHIELD BROKEN'); R.fx.flash = 0.3; R.fx.flashCol = [0.5, 1, 0.95]; continue; }
      die(); break;
    }
    for (const b of orbs) {
      if (b.got) continue; const dz = b.d - pl.dist; if (dz > 14 || dz < -2) continue;
      const active = eclipse > 0 || (b.k === 1) === night; if (!active) continue;
      if ((pl.magnet > 0 || eclipse > 0) && dz < 12) { b.x = damp(b.x, pl.x, 9, dt); b.y = damp(b.y, pl.y + 0.9, 9, dt); }
      if (abs(dz) < 1.0 && abs(b.x - pl.x) < 0.95 && abs(b.y - (pl.y + 0.85)) < 1.15) {
        b.got = true; if (b.k) nMoon++; else nSun++; combo++; comboT = 0.8; score += 10 * mult * (eclipse > 0 ? 2 : 1); sfx.orb(combo);
        if (eclipse <= 0) { flow++; if (flow >= FLOW_MAX) { flow = 0; eclipse = 7; R.fx.flash = 0.6; R.fx.flashCol = [1, 0.8, 0.6]; sfx.eclipse(); pop('ECLIPSE!', 'ecl'); hint('Both worlds are one. Smash through everything!', 3); A.color(12000); } }
        P.burst(5, { x: b.x, y: b.y, z: -b.d, c: b.k ? [0.65, 0.7, 1] : [1, 0.85, 0.3], s0: 0.16, life: 0.35, drag: 3 }, 3.5, 1);
      }
    }
    for (const k of pickups) {
      if (k.got) continue; if (abs(k.d - pl.dist) < 1.1 && abs(k.x - pl.x) < 1.0 && pl.y < 1.6) { k.got = true; sfx.power(); if (k.k === 'shield') { pl.shield = true; pop('SHIELD'); } else { pl.magnet = 9; pop('MAGNET'); } }
    }
    if (obstacles.length && obstacles[0].d < pl.dist - 14) obstacles = obstacles.filter(o => o.d > pl.dist - 12);
    if (orbs.length > 30 && orbs[0].d < pl.dist - 14) orbs = orbs.filter(o => o.d > pl.dist - 10 && !o.got);
    if (pickups.length && pickups[0].d < pl.dist - 14) pickups.shift();
  } else if (state === 'dying') {
    pl.dead += rdt; pl.speed = damp(pl.speed, 0, 5, rdt); pl.dist += pl.speed * rdt * 0.3; if (pl.air) { pl.vy -= 28 * dt; pl.y = max(0, pl.y + pl.vy * dt); }
    if (pl.dead > 1.25) gameOver();
  }
  realmT = damp(realmT, night ? 1 : 0, 11, rdt); eclT = damp(eclT, eclipse > 0 ? 1 : 0, 6, rdt);
  shake = max(0, shake - rdt * 1.6); R.fx.flash = max(0, R.fx.flash - rdt * 2.2); R.fx.aberr = damp(R.fx.aberr, 0, 3, rdt);
  R.fx.lines = damp(R.fx.lines, state === 'play' ? (eclipse > 0 ? 0.55 : clamp((pl.speed - 20) / 22, 0, 0.3)) : 0, 4, rdt);
  pl.cycle += dt * (5.5 + pl.speed * 0.42);
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += rdt * 2.2; if (rings[i].t > 1) rings.splice(i, 1); }
  // hero pose
  const mode = state === 'dying' || state === 'over' ? (pl.dead > 0.35 ? 'dead' : 'hit') : pl.slide > 0 && !pl.air ? 'slide' : pl.air ? (pl.vy > -2 ? 'jump' : 'fall') : 'run';
  E.animateHumanoid(hero, dt || 0.0001, { mode, t: time, cycle: pl.cycle, ninja: state !== 'menu', amp: state === 'menu' ? 0.8 : 1 });
  const tx = pl.lane * LANE;
  hero.root.p[0] = pl.x; hero.root.p[1] = pl.y; hero.root.p[2] = -pl.dist; hero.root.r[1] = PI - (tx - pl.x) * 0.22; hero.root.r[2] = (tx - pl.x) * 0.1;
  hero.root.update(null);
  // companion spirit
  pip.x = damp(pip.x, pl.x + 0.95, 5, rdt); pip.y = damp(pip.y, pl.y + 1.75 + sin(time * 3) * 0.12, 6, rdt); pip.z = -pl.dist + 0.7;
  if (Math.random() < 0.5 && !paused) P.spawn({ x: pip.x + E.rand(-0.1, 0.1), y: pip.y - 0.1, z: pip.z + 0.2, vz: pl.speed * 0.5, vy: E.rand(-0.3, 0.3), c: mix3([1, 0.8, 0.3], [0.6, 0.65, 1], realmT), s0: 0.14, life: 0.45 });
  if (state === 'play' && !paused) {
    if (eclipse > 0 && Math.random() < 0.8) P.spawn({ x: pl.x + E.rand(-0.4, 0.4), y: pl.y + E.rand(0.2, 1.6), z: -pl.dist + 0.3, vz: pl.speed * 0.6, c: [1, 0.7, 0.4], s0: 0.22, life: 0.4, shape: 2 });
    if (realmT > 0.5 && Math.random() < 0.3) P.spawn({ x: E.rand(-9, 9), y: E.rand(0.5, 5), z: -pl.dist - E.rand(10, 70), vy: E.rand(-0.2, 0.4), vx: E.rand(-0.3, 0.3), c: [0.75, 1, 0.6], s0: 0.12, life: 2.2 });
    if (realmT < 0.5 && Math.random() < 0.25) P.spawn({ x: E.rand(-10, 10), y: E.rand(3, 8), z: -pl.dist - E.rand(10, 70), vy: -0.9, vx: E.rand(-0.8, -0.2), c: [1, 0.75, 0.86], s0: 0.09, life: 3, shape: 1, add: false, a: 0.9 });
  }
  P.update(rdt * (paused ? 0 : 1));
  // camera
  const sx = (Math.random() - 0.5) * shake * 0.5, sy = (Math.random() - 0.5) * shake * 0.5;
  let cp, ct, fov; const pf = clamp((1 - R.w / R.h) / 0.55, 0, 1);   // 1 on a tall phone screen
  if (state === 'menu') { const a = sin(time * 0.22) * 0.75 + 0.5, dd = 1 + pf * 0.25; cp = [pl.x + sin(a) * 4.4 * dd, 1.75, -pl.dist - cos(a) * 4.6 * dd]; ct = [pl.x, 1.05 - pf * 0.85, -pl.dist + 0.2]; fov = 46 + pf * 8; }
  else if (state === 'dying' || state === 'over') { const a = 0.7 + pl.dead * 0.25; cp = [pl.x + sin(a) * 5, 2.6, -pl.dist + cos(a) * 5]; ct = [pl.x, 0.8, -pl.dist]; fov = 52; }
  else { cp = [pl.x * (0.62 + pf * 0.2), 3.0 + pl.y * 0.3 + pf * 1.9, -pl.dist + 5.3 + pf * 3.4]; ct = [pl.x * (0.78 + pf * 0.1), 1.3 + pl.y * 0.35, -pl.dist - 9]; fov = 62 + pf * 16 + clamp((pl.speed - 13) / 17, 0, 1) * 8 + eclT * 5; }
  const ck = state === 'play' ? 9 : 2.6;
  for (let i = 0; i < 3; i++) { camPos[i] = damp(camPos[i], cp[i], i === 2 && state !== 'dying' && state !== 'over' ? 60 : ck, rdt); camTgt[i] = damp(camTgt[i], ct[i], i === 2 ? 60 : ck, rdt); }
  R.cam.pos = [camPos[0] + sx, camPos[1] + sy, camPos[2]]; R.cam.tgt = camTgt; R.cam.fov = damp(R.cam.fov, fov, 5, rdt); R.cam.far = 420; R.cam.roll = state === 'play' ? (tx - pl.x) * -0.012 : 0;
  // HUD
  if (hintT > 0) { hintT -= rdt; if (hintT <= 0) hud.hint.classList.remove('on'); }
  if (state === 'play') {
    const s = floor(score); if (s !== lastScore) { lastScore = s; hud.score.textContent = s.toLocaleString(); }
    hud.mult.textContent = '×' + mult; hud.mult.classList.toggle('hot', mult > 1); hud.sun.textContent = nSun; hud.moon.textContent = nMoon;
    hud.flow.style.transform = 'scaleX(' + (eclipse > 0 ? eclipse / 7 : flow / FLOW_MAX).toFixed(3) + ')'; hud.flowBox.classList.toggle('on', eclipse > 0);
    hud.realm.classList.toggle('night', night); hud.badge.innerHTML = (pl.shield ? '<span class="bd sh">Shield</span>' : '') + (pl.magnet > 0 ? '<span class="bd mg">Magnet ' + Math.ceil(pl.magnet) + '</span>' : '');
  }
  document.body.classList.toggle('night', night);
}
function render(dt) {
  let env = E.lerpEnv(DAY, NIGHT, E.ease(realmT)); if (eclT > 0.01) env = E.lerpEnv(env, ECL, eclT);
  env.curve = [0.0011, 0.00055 * sin(time * 0.11)];
  if (state === 'menu') env.lightDir = norm([0.45, 0.7, -0.55]);
  R.begin(env, dt);
  const d = pl.dist, glowAmt = max(realmT, eclT * 0.6), lampE = mul3(C.lamp, 0.25 + glowAmt * 0.9), winE = [1.0 * glowAmt, 0.85 * glowAmt, 0.5 * glowAmt];
  // clouds under the road
  for (let j = floor((d - 60) / 34); j < floor((d - 60) / 34) + 9; j++) for (const s of [-1, 1]) {
    const a = h3(j, s, 1), b = h3(j, s, 2); M4.trs(tm, [s * (9 + a * 34) + sin(time * 0.05 + j) * 2, -9 - b * 9, -(j * 34 + a * 20)], [0, a * 6, 0], [1.4 + b, 1.2 + a * 0.6, 1.4 + b]);
    R.draw(clouds[floor(h3(j, s, 3) * 3)], tm, { outline: false, tint: mix3([1, 1, 1], [0.75, 0.78, 1.25], realmT) });
  }
  // road
  const i0 = floor((d - 30) / SEG);
  for (let i = i0; i < i0 + 9; i++) {
    M4.trs(tm, [0, 0, -(i * SEG + SEG / 2)], [0, 0, 0], [1, 1, 1]); R.draw(meshes.track, tm); R.draw(meshes.trackDecal, tm, { outline: false }); R.draw(meshes.trackGlow, tm, { unlit: true, emis: lampE, outline: false });
    if (i % 3 === 0) { M4.trs(tm, [0, 0, -(i * SEG)], [0, 0, 0], [1, 1, 1]); R.draw(meshes.torii, tm); }
  }
  // floating islands
  for (let j = floor((d - 50) / 27); j < floor((d - 50) / 27) + 9; j++) for (const s of [-1, 1]) for (let layer = 0; layer < 2; layer++) {
    if (layer && (j + (s > 0 ? 1 : 0)) % 2) continue;
    const a = h3(j, s, 10 + layer), b = h3(j, s, 20 + layer), c = h3(j, s, 30 + layer), isl = islands[floor(c * 6)], sc = layer ? 1.5 + b : 0.8 + b * 0.45;
    M4.trs(tm, [s * (layer ? 34 + a * 26 : 12 + a * 12), layer ? 4 + b * 13 : -4.5 + b * 7 + sin(time * 0.5 + j * 1.7) * 0.25, -(j * 27 + c * 12)], [0, a * 6.28, 0], [sc, sc, sc]);
    R.draw(isl.mesh, tm); R.draw(isl.glow, tm, { unlit: true, tint: mix3([0.55, 0.62, 0.8], [1, 0.95, 0.7], glowAmt), emis: winE, outline: false });
  }
  // obstacles
  for (const o of obstacles) {
    if (o.gone) continue; const dz = o.d - d; if (dz > 165 || dz < -2.4) continue;
    M4.trs(tm, [o.lane * LANE, 0, -o.d], [0, 0, 0], [1, 1, 1]);
    const behind = state === 'play' ? clamp(1 + (dz + 0.9) / 1.4, 0, 1) : 1;
    if (behind < 0.99) { if (behind > 0.02) R.draw(meshes[o.t], tm, { alpha: behind * ((o.t === 'sun' || o.t === 'moon') ? 0.3 : 1) }); }
    else if (o.t === 'sun' || o.t === 'moon') {
      const sol = eclT > 0.5 ? 0 : (o.t === 'sun' ? 1 - realmT : realmT), pulse = 0.5 + 0.5 * sin(time * 5 + o.d);
      if (sol > 0.97) R.draw(meshes[o.t], tm, { emis: o.t === 'sun' ? [0.3 + pulse * 0.12, 0.18, 0] : [0.12, 0.1, 0.4 + pulse * 0.15] });
      else R.draw(meshes[o.t], tm, { alpha: lerp(0.13 + pulse * 0.05, 1, sol), unlit: sol < 0.5, tint: o.t === 'sun' ? [1, 0.9, 0.6] : [0.75, 0.75, 1.2] });
    } else R.draw(meshes[o.t], tm);
  }
  for (const b of orbs) {
    if (b.got) continue; const dz = b.d - d; if (dz > 120 || dz < -6) continue;
    const active = eclipse > 0 || (b.k === 1) === night, bob = sin(time * 4 + b.d * 0.6) * 0.1;
    M4.trs(tm, [b.x, b.y + bob, -b.d], [0, time * 3 + b.d, b.k ? 0.3 : 0], active ? [1, 1, 1] : [0.6, 0.6, 0.6]);
    if (active) R.draw(b.k ? meshes.orbMoon : meshes.orbSun, tm, { unlit: true, outline: false, emis: b.k ? [0.15, 0.15, 0.4] : [0.35, 0.2, 0] });
    else if (dz < 60) R.draw(b.k ? meshes.orbMoon : meshes.orbSun, tm, { unlit: true, alpha: 0.16 });
  }
  for (const k of pickups) { if (k.got) continue; M4.trs(tm, [k.x, 1.1 + sin(time * 3) * 0.15, -k.d], [0, time * 2.5, 0], [1, 1, 1]); R.draw(meshes[k.k], tm, { unlit: true, emis: [0.25, 0.25, 0.25] }); }
  // hero, shadow, spirit
  M4.trs(tm, [pl.x, 0.02, -d], [0, 0, 0], [0.5 - pl.y * 0.08, 1, 0.5 - pl.y * 0.08]); R.draw(meshes.shadow, tm, { unlit: true, alpha: 0.32, tint: [0.1, 0.05, 0.2] });
  const blinkInv = pl.inv > 0 && floor(time * 16) % 2;
  if (!blinkInv) hero.root.draw(R, { flash: eclT * (0.25 + 0.15 * sin(time * 14)) });
  if (pl.shield) { M4.trs(tm, [pl.x, pl.y + 0.85, -d], [time * 2, time * 3, 0], [1.05, 1.05, 1.05]); R.draw(meshes.ring, tm, { unlit: true, additive: true, alpha: 0.9, tint: [0.4, 1, 0.95] }); M4.trs(tm, [pl.x, pl.y + 0.85, -d], [PI / 2, time * 2, time], [1.05, 1.05, 1.05]); R.draw(meshes.ring, tm, { unlit: true, additive: true, alpha: 0.6, tint: [0.4, 1, 0.95] }); }
  const pc = mix3([1, 0.86, 0.45], [0.7, 0.75, 1.15], realmT);
  M4.trs(tm, [pip.x, pip.y, pip.z], [sin(time * 2) * 0.15, PI + sin(time * 1.3) * 0.3, sin(time * 3) * 0.12], [1, 1, 1]); R.draw(meshes.pip, tm, { unlit: true, tint: mul3(pc, 0.92), outline: 0.012 }); R.draw(meshes.pipFace, tm, { unlit: true, outline: false });
  for (const r of rings) { const s = 0.4 + r.t * 5; M4.trs(tm, [r.x, r.y, r.z], [PI / 2, 0, 0], [s, s, s]); R.draw(meshes.ring, tm, { unlit: true, additive: true, alpha: (1 - r.t) * 0.9, tint: r.c }); }
  R.end(P);
}
show('hud', false); show('menu', true);
window.__game = { start, flip, move, jump, slide, LANE, get night() { return night; }, get eclipse() { return eclipse; }, get state() { return state; }, pl, get score() { return score; }, setEclipse(v) { eclipse = v; }, get obstacles() { return obstacles; }, setTime(s) { slowmo = s; } };
E.loop(dt => { const g = window.__game, n = g.fast || 1; for (let i = 0; i < n; i++) { if (g.auto) g.auto(); update(n > 1 ? 0.016 : dt); } render(dt); });
})();
