'use strict';
/* Chime of Aoren: a three-chapter anime action story. */
(() => {
const { M4, Geo, Node, hex, lerp, clamp, damp, norm, mul3, mix3, rand } = E, I = M4.T;
const { sin, cos, PI, abs, floor, min, max, hypot, atan2, exp } = Math;
const $ = id => document.getElementById(id);
const cv = $('c'), touch = matchMedia('(pointer: coarse)').matches; document.body.classList.toggle('touch', touch);
let R; try { R = new E.Renderer(cv, { outline: 0.02, maxDpr: touch ? 1.5 : 2 }); } catch (e) { $('title').hidden = true; $('fatal').hidden = false; $('fatalMsg').textContent = e.message; return; }
const A = E.Audio, P = new E.Particles(1500), tm = M4.create(), ID = M4.create();
const QS = new URLSearchParams(location.search), HOSTED = QS.get('host') === 'arise' && window.parent !== window, UKEY = (QS.get('u') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
// On the Arise site each reader keeps their own save on a shared computer, and gets a way back to the Games page.
const skey = k => UKEY ? k + '_' + UKEY : k;
for (const b of document.querySelectorAll('.exit')) { b.hidden = !HOSTED; b.addEventListener('click', () => { try { window.parent.postMessage({ type: 'arise-game-exit' }, location.origin); } catch (e) { } }); }
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
const show = (id, on) => { $(id).hidden = !on; };

// ═════════════ skies and light for each chapter ═════════════
const ENV = {
  village: { lightDir: norm([-0.55, 0.55, 0.62]), lightCol: [1.0, 0.88, 0.76], shadowCol: [0.72, 0.5, 0.7], rimCol: [1, 0.75, 0.5], fogCol: hex('#eca98c'), fogNear: 46, fogFar: 190, outline: [0.2, 0.1, 0.18], unlit: 1,
    sky: { top: hex('#3a4fa8'), hor: hex('#ffb07c'), bot: hex('#ffd9b0'), sunDir: norm([-0.5, 0.12, -0.86]), sunCol: [1, 0.8, 0.55], sunSize: 0.996, cloud: 0.5, cloudCol: hex('#ffd9c2'), cloudShade: hex('#c9789a'), cloudSpeed: 0.01, stars: 0.15, moon: 0, aurora: 0, eclipse: 0, glow: 0.5 },
    bloom: 0.26, bloomThresh: 0.9, sat: 1.12, grade: [1.04, 0.99, 0.96], vig: 0.3, curve: [0, 0] },
  cliffs: { lightDir: norm([0.5, 0.75, 0.45]), lightCol: [1.04, 1.01, 0.95], shadowCol: [0.74, 0.66, 0.88], rimCol: [0.9, 1, 1], fogCol: hex('#cfeaff'), fogNear: 40, fogFar: 170, outline: [0.14, 0.13, 0.26], unlit: 1,
    sky: { top: hex('#1f6fe0'), hor: hex('#b5e2ff'), bot: hex('#f2fbff'), sunDir: norm([0.45, 0.5, -0.74]), sunCol: [1, 0.97, 0.82], sunSize: 0.9975, cloud: 0.58, cloudCol: [1, 1, 1], cloudShade: hex('#9cbcec'), cloudSpeed: 0.03, stars: 0, moon: 0, aurora: 0, eclipse: 0, glow: 0.5 },
    bloom: 0.3, bloomThresh: 0.87, sat: 1.15, grade: [1, 1.01, 1.02], vig: 0.24, curve: [0, 0] },
  temple: { lightDir: norm([0.35, 0.7, 0.6]), lightCol: [0.74, 0.77, 0.98], shadowCol: [0.36, 0.3, 0.62], rimCol: [0.6, 0.85, 1], fogCol: hex('#1a1a4e'), fogNear: 30, fogFar: 140, outline: [0.03, 0.02, 0.1], unlit: 0.92,
    sky: { top: hex('#05071f'), hor: hex('#33287f'), bot: hex('#111040'), sunDir: norm([0.25, 0.42, -0.87]), sunCol: [0.85, 0.92, 1], sunSize: 0.9955, cloud: 0.4, cloudCol: hex('#5c61bd'), cloudShade: hex('#27276a'), cloudSpeed: 0.006, stars: 1, moon: 1, aurora: 1, eclipse: 0, glow: 0.3 },
    bloom: 0.62, bloomThresh: 0.8, sat: 1.15, grade: [0.96, 0.98, 1.08], vig: 0.42, curve: [0, 0] },
};

// ═════════════ sets ═════════════
const K = { rock: { t: hex('#8a7668'), b: hex('#4a3f58') }, wood: { t: hex('#c99a68'), b: hex('#8d6648') }, woodD: hex('#6d4c3d'), wall: { t: hex('#fff6e6'), b: hex('#e6d4bd') }, red: hex('#e8483a'), dark: hex('#33263d'), pink: { t: hex('#ffd6e6'), b: hex('#ff8fbe') }, pine: { t: hex('#63c582'), b: hex('#2c7a5b') }, lamp: hex('#ffd98a'), win: hex('#ffe9a8'), bronze: { t: hex('#f6cc74'), b: hex('#b9772f') } };
function tree(g, x, z, s, pine, cols) {
  if (pine) { g.cyl(0.14 * s, 0.2 * s, 1.2 * s, 6, K.woodD, I(x, 0.6 * s, z)); for (let i = 0; i < 3; i++) g.cyl(0, (1.15 - i * 0.28) * s, 1.3 * s, 7, cols || K.pine, I(x, (1.5 + i * 0.85) * s, z), false, true); }
  else { g.cyl(0.16 * s, 0.3 * s, 2.2 * s, 6, K.woodD, I(x, 1.1 * s, z, 0.05, 0, 0.08)); for (const [dx, dy, dz, rr] of [[0, 2.9, 0, 1.5], [1.0, 2.5, 0.3, 1.1], [-0.9, 2.6, -0.4, 1.15], [0.2, 3.5, -0.6, 1.0], [-0.2, 2.4, 0.9, 0.95]]) g.ell(rr * s, rr * 0.82 * s, rr * s, 9, 6, cols || K.pink, I(x + dx * s, dy * s, z + dz * s)); }
}
function house(g, gl, x, z, ry, w, d, hh, roofC) {
  const m = I(x, 0, z, 0, ry, 0);
  g.box(w, hh, d, K.wall, E.at(m, 0, hh / 2, 0)); g.box(w + 0.1, 0.25, d + 0.1, K.woodD, E.at(m, 0, 0.12, 0)); g.roof(w, hh * 0.75, d, roofC, E.at(m, 0, hh, 0), 0.45);
  g.box(0.8, 1.5, 0.08, K.woodD, E.at(m, 0, 0.75, d / 2 + 0.02));
  for (const sx of [1, -1]) { gl.box(0.6, 0.7, 0.06, K.win, E.at(m, sx * w * 0.3, hh * 0.6, d / 2 + 0.02)); gl.box(0.06, 0.7, 0.7, K.win, E.at(m, sx * (w / 2 + 0.02), hh * 0.6, 0)); }
}
function islandBase(g, topCol) {
  g.cyl(24, 21.5, 1.4, 44, topCol, I(0, -0.7, 0)); g.cyl(21.5, 2.5, 17, 13, K.rock, I(0, -9.9, 0));
  for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.3; g.cyl(2.5, 0.2, 6, 6, K.rock, I(sin(a) * 15, -5.5, cos(a) * 15)); }
}
function backdrop(g, seed, top, rockC) {
  const r = E.rng(seed);
  for (let i = 0; i < 24; i++) { const a = i / 24 * 2 * PI + r() * 0.2, rad = 52 + r() * 75, y = -22 + r() * 34, s = 5 + r() * 11; g.cyl(s, s * 0.15, s * 1.6, 7, rockC || K.rock, I(sin(a) * rad, y - s * 0.8, cos(a) * rad)); g.cyl(s * 1.05, s, 0.9, 7, top, I(sin(a) * rad, y + 0.45, cos(a) * rad)); if (r() < 0.6) tree(g, sin(a) * rad, cos(a) * rad, 1.2 + r(), r() < 0.5, null); }
}
function bell(g, x, y, z, s, col) { g.cyl(0.62 * s, 1.0 * s, 1.5 * s, 18, col, I(x, y, z)); g.ell(0.62 * s, 0.4 * s, 0.62 * s, 18, 6, col, I(x, y + 0.75 * s, z)); g.cyl(1.06 * s, 1.06 * s, 0.14 * s, 18, col.b, I(x, y - 0.75 * s, z)); g.cyl(0.1 * s, 0.1 * s, 0.4 * s, 8, K.dark, I(x, y + 1.2 * s, z)); g.ell(0.16 * s, 0.16 * s, 0.16 * s, 8, 6, K.dark, I(x, y - 0.95 * s, z)); }
function buildVillage() {
  const g = new Geo(), gl = new Geo(), fl = new Geo();
  islandBase(g, { t: hex('#9fd27a'), b: hex('#6b5a4a') });
  [[16.6, '#dbbb8e'], [15.7, '#c9a473'], [9.2, '#dcbd90'], [8.6, '#c39d6d'], [3.2, '#e3c89c'], [2.7, '#c9a473']].forEach(([r, c], i) => fl.cyl(r, r, 0.004, 56, hex(c), I(0, 0.004 + i * 0.006, 0), true, false));
  for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; fl.box(0.09, 0.004, 6.3, hex('#ad875c'), I(sin(a) * 12.4, 0.02, cos(a) * 12.4, 0, a, 0)); }
  const roofs = [{ t: hex('#4f74c8'), b: hex('#33488f') }, { t: hex('#ef6a55'), b: hex('#b8403f') }, { t: hex('#3fb5a8'), b: hex('#267a7c') }];
  let n = 0;
  for (const a of [1.55, 1.95, 2.35, 3.95, 4.35, 4.75]) { const rr = 20 + (n % 2) * 1.2; house(g, gl, sin(a) * rr, cos(a) * rr, a + PI, 3.6 + (n % 3) * 0.5, 3, 2.3 + (n % 2) * 0.5, roofs[n % 3]); n++; }
  for (const a of [1.3, 1.75, 2.15, 2.65, 3.6, 4.15, 4.55, 5.0]) tree(g, sin(a) * 18.2, cos(a) * 18.2, 1.25, false);
  for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI + 0.26, x = sin(a) * 17.1, z = cos(a) * 17.1; if (cos(a) > 0.55) { g.cyl(0.09, 0.11, 0.8, 6, K.red, I(x, 0.4, z)); continue; } g.cyl(0.09, 0.12, 2.4, 6, K.red, I(x, 1.2, z)); g.box(0.34, 0.08, 0.34, K.dark, I(x, 2.45, z)); gl.ell(0.24, 0.3, 0.24, 8, 6, K.lamp, I(x, 2.85, z)); g.box(0.3, 0.07, 0.3, K.dark, I(x, 3.2, z)); }
  // the Hollowbell Chime
  for (const sx of [1, -1]) { g.cyl(0.45, 0.55, 10, 10, K.red, I(sx * 4.2, 5, -19)); g.cyl(0.7, 0.75, 0.6, 10, K.dark, I(sx * 4.2, 0.3, -19)); }
  g.box(11.5, 0.7, 1.1, K.red, I(0, 9.6, -19)); g.box(12.6, 0.3, 1.5, K.dark, I(0, 10.1, -19)); g.roof(12.6, 1.6, 2.6, { t: hex('#4f74c8'), b: hex('#33488f') }, I(0, 10.25, -19, 0, PI / 2, 0), 0.3);
  bell(g, 0, 6.2, -19, 2.7, K.bronze);
  for (let i = 0; i < 4; i++) g.box(9 - i * 0.6, 0.3, 1.2, { t: hex('#e9cfa6'), b: hex('#b99b78') }, I(0, 0.15 + i * 0.3, -16.2 - i * 0.9));
  backdrop(g, 11, { t: hex('#9fd27a'), b: hex('#6ea85e') });
  const crack = new Geo(); let cx = 0.2, cy = 7.9; for (let i = 0; i < 7; i++) { const dx = (i % 2 ? 0.45 : -0.4), dy = -0.55; crack.box(0.16, 0.75, 0.08, [1, 1, 1], I(cx + dx / 2, cy + dy / 2, -19 + 2.05 + i * 0.1, 0, 0, atan2(dx, -dy) * -1)); cx += dx; cy += dy; }
  return { env: ENV.village, mesh: g.build(), glow: gl.build(), flat: fl.build(), crack: crack.build(), glowE: [0.3, 0.22, 0.08], petals: [0.95, 0.66, 0.78] };
}
function buildCliffs() {
  const g = new Geo(), gl = new Geo(), fl = new Geo(), r = E.rng(5);
  islandBase(g, { t: hex('#a9e27c'), b: hex('#7a6a55') });
  fl.cyl(14.6, 14.6, 0.004, 50, hex('#c8e79a'), I(0, 0.004, 0), true, false); fl.cyl(13.8, 13.8, 0.004, 50, hex('#d3bd87'), I(0, 0.01, 0), true, false); fl.cyl(6, 6, 0.004, 40, hex('#dfcb98'), I(0, 0.016, 0), true, false);
  for (let i = 0; i < 60; i++) { const a = r() * 6.28, rad = 15 + r() * 7, c = [hex('#ffffff'), hex('#ffd35a'), hex('#ff8fbe'), hex('#8fd0ff')][floor(r() * 4)]; fl.box(0.22, 0.02, 0.22, c, I(sin(a) * rad, 0.03, cos(a) * rad, 0, r() * 3, 0)); }
  for (let i = 0; i < 14; i++) { const a = 0.9 + r() * 4.5, rad = 16.5 + r() * 5, s = 0.6 + r() * 1.3; g.ell(s * 1.2, s * 0.8, s, 7, 5, { t: hex('#c5c9d6'), b: hex('#7d8198') }, I(sin(a) * rad, s * 0.4, cos(a) * rad, 0, r() * 3, 0)); }
  const mills = [];
  for (const [x, z, s] of [[-15.5, -13, 1], [16.5, -11.5, 0.9], [0, -21.5, 1.35]]) {
    g.cyl(1.0 * s, 1.75 * s, 8 * s, 10, { t: hex('#fffaf0'), b: hex('#d9cdbb') }, I(x, 4 * s, z)); g.cyl(0, 1.5 * s, 2.2 * s, 10, { t: hex('#ef6a55'), b: hex('#b8403f') }, I(x, 9.1 * s, z)); g.box(0.9 * s, 1.6 * s, 0.1, K.woodD, I(x, 0.8 * s, z + 1.72 * s));
    gl.box(0.6 * s, 0.8 * s, 0.1, K.win, I(x, 5 * s, z + 1.36 * s));
    const b = new Geo(); for (let i = 0; i < 4; i++) { const a = i * PI / 2; b.box(0.16 * s, 4.6 * s, 0.1, K.woodD, I(sin(a) * 2.3 * s, cos(a) * 2.3 * s, 0, 0, 0, -a)); b.box(0.9 * s, 3.4 * s, 0.05, hex('#fff3df'), I(sin(a) * 2.7 * s + cos(a) * 0.5 * s, cos(a) * 2.7 * s - sin(a) * 0.5 * s, 0.02, 0, 0, -a)); } b.cyl(0.3 * s, 0.3 * s, 0.6 * s, 8, K.dark, I(0, 0, 0, PI / 2, 0, 0));
    const nd = new Node(b.build()); nd.p = [x, 7.6 * s, z + 1.5 * s]; nd.two = true; mills.push({ nd, sp: 0.7 + s * 0.3 });
  }
  for (const [x, z] of [[-11, -15.5], [11, -15.5]]) { g.cyl(0.08, 0.1, 6, 6, K.woodD, I(x, 3, z)); }
  // the Gale Chime under a stone arch
  for (const sx of [1, -1]) g.box(1.1, 6, 1.1, { t: hex('#d5d9e6'), b: hex('#8d91a8') }, I(sx * 2.8, 3, -17)); g.box(7.6, 1, 1.3, { t: hex('#d5d9e6'), b: hex('#8d91a8') }, I(0, 6.4, -17)); bell(g, 0, 4.2, -17, 1.5, { t: hex('#9ff0dc'), b: hex('#2f9f99') });
  for (let i = 0; i < 9; i++) { const a = 1.2 + i * 0.5, rad = 30 + (i % 3) * 7, hh = 14 + (i % 4) * 6; g.cyl(0.6, 3.2, hh, 7, { t: hex('#c9d3ea'), b: hex('#6f7aa0') }, I(sin(a) * rad, hh / 2 - 8, cos(a) * rad)); }
  backdrop(g, 23, { t: hex('#a9e27c'), b: hex('#6ea85e') }, { t: hex('#b9c1d9'), b: hex('#6a7196') });
  const fgeo = new Geo(); fgeo.quad([0, 0, 0], [2.6, 0, 0], [2.6, 1.5, 0], [0, 1.5, 0], { t: hex('#58d9b6'), b: hex('#1f9f96') }, null, [0, 0, 1], true);
  const flags = [[-11, -15.5], [11, -15.5]].map(([x, z]) => { const nd = new Node(fgeo.build()); nd.p = [x, 4.4, z]; nd.two = true; return nd; });
  return { env: ENV.cliffs, mesh: g.build(), glow: gl.build(), flat: fl.build(), mills, flags, glowE: [0, 0, 0], petals: [0.8, 0.95, 0.75] };
}
function buildTemple() {
  const g = new Geo(), gl = new Geo(), fl = new Geo();
  islandBase(g, { t: hex('#56568e'), b: hex('#23213f') });
  [[16.8, '#4a4a80'], [16.0, '#5c5c98'], [10, '#4d4d86'], [9.4, '#62629f'], [4, '#4d4d86'], [3.5, '#6a6aa8']].forEach(([r, c], i) => fl.cyl(r, r, 0.004, 56, hex(c), I(0, 0.004 + i * 0.006, 0), true, false));
  for (const r of [15.2, 8.8, 3.0]) gl.torus(r, 0.07, 64, 4, hex('#7af2ff'), I(0, 0.05, 0));
  for (let i = 0; i < 16; i++) { const a = i / 16 * 2 * PI; gl.box(0.14, 0.03, 1.1, hex('#7af2ff'), I(sin(a) * 12, 0.06, cos(a) * 12, 0, a, 0)); gl.box(0.5, 0.03, 0.14, hex('#7af2ff'), I(sin(a) * 12.4, 0.06, cos(a) * 12.4, 0, a, 0)); }
  for (let i = 0; i < 14; i++) { const a = i / 14 * 2 * PI + 0.22; if (cos(a) > 0.5) continue; const x = sin(a) * 18, z = cos(a) * 18; g.cyl(0.7, 0.85, 7.5, 10, { t: hex('#8483c0'), b: hex('#3a3866') }, I(x, 3.75, z)); g.box(2, 0.5, 2, { t: hex('#8483c0'), b: hex('#55548c') }, I(x, 7.7, z)); g.box(2.1, 0.5, 2.1, hex('#3a3866'), I(x, 0.25, z)); gl.cyl(0, 0.4, 0.7, 4, hex('#9af7ff'), I(x, 8.65, z)); gl.cyl(0.4, 0, 0.7, 4, hex('#9af7ff'), I(x, 9.35, z)); }
  for (const sx of [1, -1]) { g.box(1.6, 13, 1.6, { t: hex('#8483c0'), b: hex('#3a3866') }, I(sx * 5.6, 6.5, -19.5)); }
  g.box(14.5, 1.4, 2, { t: hex('#8483c0'), b: hex('#55548c') }, I(0, 13.4, -19.5)); g.box(16, 0.5, 2.6, hex('#2a2850'), I(0, 14.3, -19.5));
  bell(g, 0, 8.4, -19.5, 3.7, { t: hex('#ffe08a'), b: hex('#c98a2c') }); gl.torus(4.0, 0.09, 40, 5, hex('#ffe9a8'), I(0, 5.5, -19.5));
  for (let i = 0; i < 5; i++) g.box(11 - i * 0.7, 0.32, 1.2, { t: hex('#6a6aa8'), b: hex('#3a3866') }, I(0, 0.16 + i * 0.32, -15.6 - i * 0.9));
  backdrop(g, 41, { t: hex('#4e5fa0'), b: hex('#2d376e') }, { t: hex('#56568e'), b: hex('#23213f') });
  return { env: ENV.temple, mesh: g.build(), glow: gl.build(), flat: fl.build(), glowE: [0.25, 0.5, 0.55], petals: [0.6, 0.9, 1] };
}
const SCENES = { village: buildVillage(), cliffs: buildCliffs(), temple: buildTemple() };
let scene = SCENES.village, sceneName = 'village', chimeGlow = 1, crackOn = 0, bellFlash = 0;
function setScene(n) { scene = SCENES[n]; sceneName = n; }

// ═════════════ shared meshes ═════════════
const MS = {};
(() => {
  MS.shadow = E.shadowMesh();
  let g = new Geo(); g.cyl(1, 1, 0.01, 40, [1, 1, 1], null, true, false); MS.disc = g.build();
  g = new Geo(); g.torus(1, 0.035, 48, 4, [1, 1, 1]); MS.ring = g.build();
  g = new Geo(); g.torus(1, 0.11, 40, 6, [1, 1, 1]); MS.ringFat = g.build();
  g = new Geo(); g.box(1, 1, 1, [1, 1, 1]); MS.unit = g.build();
  g = new Geo(); g.ell(1, 1, 1, 12, 8, [1, 1, 1]); MS.ball = g.build();
  const slash = (a0, a1, rad, w) => { const k = new Geo(), n = 20; for (let i = 0; i < n; i++) { const u0 = i / n, u1 = (i + 1) / n, b0 = lerp(a0, a1, u0), b1 = lerp(a0, a1, u1), w0 = sin(PI * u0) * w, w1 = sin(PI * u1) * w; k.quad([sin(b0) * (rad - w0 * 0.3), 0, cos(b0) * (rad - w0 * 0.3)], [sin(b1) * (rad - w1 * 0.3), 0, cos(b1) * (rad - w1 * 0.3)], [sin(b1) * (rad + w1 * 0.7), 0, cos(b1) * (rad + w1 * 0.7)], [sin(b0) * (rad + w0 * 0.7), 0, cos(b0) * (rad + w0 * 0.7)], [1, 1, 1], null, [0, 1, 0], true); } return k.build(); };
  MS.slash = slash(-1.25, 1.25, 1.55, 0.75); MS.slashBig = slash(-PI, PI * 0.72, 2.2, 0.8); MS.blade = slash(-0.9, 0.9, 0.7, 0.45);
  // Rin's bell-mallet
  g = new Geo(); g.cyl(0.022, 0.026, 1.25, 6, hex('#8d6648'), I(0, -0.45, 0)); g.cyl(0.035, 0.035, 0.1, 6, hex('#2cc4b0'), I(0, 0.05, 0)); g.cyl(0.07, 0.13, 0.2, 10, K.bronze, I(0, -1.12, 0)); g.ell(0.07, 0.05, 0.07, 10, 5, K.bronze, I(0, -1.02, 0)); g.cyl(0.14, 0.14, 0.03, 10, K.bronze.b, I(0, -1.22, 0)); g.box(0.05, 0.16, 0.012, hex('#f0647e'), I(0.04, -0.2, 0));
  MS.mallet = g.build();
  g = new Geo(); g.cyl(0.02, 0.024, 0.26, 6, K.dark, I(0, -0.02, 0)); g.box(0.16, 0.03, 0.06, hex('#f2b84b'), I(0, -0.16, 0)); g.box(0.045, 1.0, 0.014, { t: hex('#ffffff'), b: hex('#cfe1ff') }, I(0, -0.68, 0));
  MS.katana = g.build();
  g = new Geo(); g.cyl(0.012, 0.02, 0.62, 6, [1, 1, 1], I(0, -0.3, 0)); g.ell(0.03, 0.03, 0.03, 6, 4, hex('#f2b84b'), I(0, -0.62, 0));
  MS.baton = g.build();
  // Pip, a spirit shaped like a small bell
  g = new Geo(); g.cyl(0.1, 0.19, 0.22, 12, { t: hex('#fff2b8'), b: hex('#ffc24a') }); g.ell(0.1, 0.08, 0.1, 12, 5, hex('#fff2b8'), I(0, 0.11, 0)); g.cyl(0.2, 0.2, 0.03, 12, hex('#f2a93b'), I(0, -0.11, 0)); g.ell(0.045, 0.045, 0.045, 8, 5, hex('#f2a93b'), I(0, -0.17, 0)); g.cyl(0.02, 0.02, 0.06, 6, hex('#f2a93b'), I(0, 0.2, 0));
  for (const sx of [1, -1]) g.ell(0.09, 0.04, 0.02, 6, 4, [1, 1, 1], I(sx * 0.2, 0.05, -0.02, 0, 0, sx * 0.5));
  MS.pip = g.build();
  g = new Geo(); for (const sx of [1, -1]) { g.ell(0.026, 0.036, 0.012, 6, 4, hex('#3a2a20'), I(sx * 0.05, 0.02, 0.145)); g.ell(0.01, 0.012, 0.01, 5, 3, [1, 1, 1], I(sx * 0.05 + 0.008, 0.034, 0.152)); g.ell(0.022, 0.012, 0.008, 6, 3, hex('#ff9d9d'), I(sx * 0.09, -0.02, 0.15)); }
  MS.pipFace = g.build();
})();

// the Hushed
const RIG = {};
(() => {
  const body = { t: hex('#4a3a86'), b: hex('#120e2e') }, mask = { t: hex('#ffffff'), b: hex('#d9d6ee') }, ink = hex('#0d0a22');
  const mk = (kind) => {
    const root = new Node(), b = root.add(new Node()), g = new Geo(), m = new Geo(), f = new Geo();
    if (kind === 'hushed') { g.ell(0.44, 0.5, 0.42, 12, 8, body, I(0, 0.75, 0)); g.cyl(0.36, 0, 0.75, 10, body, I(0, 0.2, -0.05), false, false); g.cyl(0, 0.1, 0.3, 5, body, I(0.16, 1.3, 0), false, true); g.cyl(0, 0.1, 0.3, 5, body, I(-0.16, 1.3, 0), false, true); m.ell(0.27, 0.31, 0.07, 12, 6, mask, I(0, 0.82, 0.36)); for (const sx of [1, -1]) f.ell(0.06, 0.09, 0.02, 8, 4, ink, I(sx * 0.1, 0.86, 0.43, 0, 0, sx * 0.3)); f.box(0.12, 0.018, 0.02, ink, I(0, 0.7, 0.43)); }
    else if (kind === 'wailer') { g.cyl(0.2, 0.42, 1.25, 10, body, I(0, 0.75, 0)); g.ell(0.3, 0.34, 0.3, 10, 7, body, I(0, 1.55, 0)); g.cyl(0, 0.07, 0.5, 5, body, I(0, 2.05, 0), false, true); m.ell(0.2, 0.25, 0.06, 12, 6, mask, I(0, 1.55, 0.27)); f.ell(0.09, 0.11, 0.02, 10, 5, ink, I(0, 1.57, 0.33)); f.ell(0.035, 0.045, 0.02, 6, 4, hex('#c9a2ff'), I(0, 1.57, 0.345)); }
    else { g.ell(0.95, 0.95, 0.85, 14, 9, body, I(0, 1.15, 0)); g.cyl(0.7, 0.25, 0.7, 10, body, I(0, 0.25, 0), false, false); for (const sx of [1, -1]) g.cyl(0, 0.2, 0.55, 5, body, I(sx * 0.45, 2.15, 0, 0, 0, -sx * 0.3), false, true); m.ell(0.42, 0.46, 0.08, 14, 7, mask, I(0, 1.3, 0.78)); for (const sx of [1, -1]) f.ell(0.09, 0.05, 0.02, 8, 4, ink, I(sx * 0.17, 1.4, 0.87, 0, 0, sx * -0.4)); f.box(0.3, 0.03, 0.02, ink, I(0, 1.1, 0.87)); for (let i = -1; i <= 1; i++) f.box(0.03, 0.09, 0.02, ink, I(i * 0.1, 1.1, 0.87)); }
    b.add(new Node(g.build())); const mn = b.add(new Node(m.build())); const fn = b.add(new Node(f.build())); fn.outline = false; fn.unlit = true;
    const hs = kind === 'brute' ? 0.42 : 0.17, hg = new Geo(); hg.ell(hs, hs * 1.1, hs, 8, 6, body); if (kind !== 'brute') for (let i = -1; i <= 1; i++) hg.cyl(0.04, 0, 0.2, 4, mask, I(i * 0.08, -0.2, 0.05), false, false);
    const hm = hg.build(), hL = b.add(new Node(hm)), hR = b.add(new Node(hm));
    return { root, b, mn, hL, hR, kind };
  };
  RIG.hushed = mk('hushed'); RIG.wailer = mk('wailer'); RIG.brute = mk('brute');
})();

// ═════════════ the cast ═════════════
const mkActor = (h, o = {}) => Object.assign({ h, x: 0, y: 0, z: 0, yaw: 0, mode: 'idle', cycle: 0, phase: 0, vis: false, flash: 0, look: 0, over: null, eyesShut: false, sc: 1 }, o);
const rin = mkActor(E.makeHumanoid({ hair: hex('#f0647e'), hairStyle: 'pony', ahoge: true, eye: hex('#2fc7b3'), top: hex('#fff3e0'), acc: hex('#22a99a'), bottom: hex('#2a3a6e'), skirt: hex('#2a3a6e'), thigh: hex('#ffdcc6'), boots: hex('#7a4a3a'), shin: hex('#fff3e0'), cuff: hex('#22a99a'), bootTop: hex('#22a99a'), stripe: hex('#22a99a'), brow: 0.14 }), { name: 'Rin', col: '#f0647e' });
const kaito = mkActor(E.makeHumanoid({ hair: hex('#b9cdf5'), hairStyle: 'spiky', eye: hex('#4f7dff'), top: hex('#27376b'), acc: hex('#f7efe1'), bottom: hex('#1b2550'), coat: hex('#27376b'), boots: hex('#11183a'), shin: hex('#1b2550'), longSleeve: true, cuff: hex('#f7efe1'), scarf: hex('#6fe3c4'), brow: 0.26, mouth: 0.028, skin: hex('#f6d2b8'), eyeH: 0.8, noBlush: true }), { name: 'Kaito', col: '#6fe3c4' });
const sato = mkActor(E.makeHumanoid({ hair: hex('#c9c6cf'), hairStyle: 'short', eye: hex('#6b5a4a'), top: hex('#7a6a4f'), acc: hex('#3d3226'), bottom: hex('#4a4034'), coat: hex('#7a6a4f'), boots: hex('#3d3226'), shin: hex('#4a4034'), longSleeve: true, skin: hex('#e8c4a2'), brow: -0.08, eyeH: 0.5, noBlush: true, scale: 0.95, bangs: [[-1.2, 0.12], [-0.5, 0.08], [0.5, 0.08], [1.2, 0.12]] }), { name: 'Master Sato', col: '#d9b06a' });
const veyl = mkActor(E.makeHumanoid({ hair: hex('#cfc9e4'), hairStyle: 'long', eye: hex('#a57bff'), top: hex('#1c1630'), acc: hex('#f2b84b'), bottom: hex('#15102a'), coat: hex('#1c1630'), boots: hex('#0d0a1c'), shin: hex('#15102a'), longSleeve: true, cuff: hex('#f2b84b'), cape: hex('#3b2470'), stripe: hex('#f2b84b'), skin: hex('#e2ccc8'), brow: 0.3, mouth: 0.03, eyeH: 0.58, noBlush: true, scale: 1.14 }), { name: 'Conductor Veyl', col: '#9a80ff' });
for (const [a, mesh] of [[rin, MS.mallet], [kaito, MS.katana], [veyl, MS.baton]]) { const w = a.h.handR.add(new Node(mesh)); w.r = [-1.0, 0, 0]; a.weapon = w; a.armed = true; }
sato.h.seed = 1.7; kaito.h.seed = 3.1; veyl.h.seed = 4.4;
const pip = { x: 0, y: 1.6, z: 0, vis: false, tx: 0, ty: 1.6, tz: 0, name: 'Pip', col: '#f2b84b' };
const CAST = { rin, kaito, sato, veyl, pip };

// ═════════════ state ═════════════
let mode = 'title', paused = false, time = 0, playTime = 0, freeze = 0, shake = 0, stage = 0, hurtFx = 0;
let enemies = [], shots = [], teles = [], fx = [], floats = [], fight = null, ally = null, cs = null;
const PL = { a: rin, hp: 120, maxHp: 120, breath: 100, chord: 0, level: 1, xp: 0, atk: 12, state: 'idle', t: 0, combo: 0, comboT: 0, inv: 0, cdD: 0, cdE: 0, cdG: 0, un: { ember: false, gale: false, chord: false }, storm: 0, stormTick: 0, hitDone: false, dx: 0, dz: -1, lunge: 0, buf: null, kills: 0, hitSet: null, vx: 0, vz: 0 };
const input = { x: 0, z: 0, keys: {} };
const cam = { pos: [0, 4, 12], tgt: [0, 1.5, 0], fov: 46 }, camGoal = { pos: [0, 4, 12], tgt: [0, 1.5, 0], fov: 46, k: 4 };
const ARENA = 14.2, need = l => 60 + l * 70;

// ═════════════ sound ═════════════
const N = null;
const MUS = {
  village: { bpm: 86, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 5, 3, 4], pad: 1.4, arp: '0.2.3.2.1.2.3.2.', arpV: 0.9, bass: '0.......0.......', leadType: 'sine', leadV: 1.5, leadLen: 5, vib: true, lead: [[4, N, N, N, 7, N, N, N, 9, N, N, N, 7, N, 4, N], [5, N, N, N, 4, N, N, N, 2, N, N, N, N, N, N, N], [3, N, N, N, 5, N, N, N, 7, N, N, N, 8, N, 7, N], [6, N, N, N, 4, N, N, N, 4, N, N, N, N, N, N, N]] },
  cliffs: { bpm: 112, root: 62, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 3, 4, 0], pad: 1, arp: '0.1.2.3.4.3.2.1.', bass: '0...0...5...0...', hat: '..x...x...x...x.', kick: 'x.......x.......', leadType: 'triangle', leadV: 1.6, leadLen: 3, lead: [[7, N, 9, N, 11, N, N, 9, N, N, 7, N, N, N, 4, N], [8, N, N, 7, N, N, 5, N, 7, N, N, N, N, N, N, N], [8, N, 9, N, 11, N, N, 13, N, N, 11, N, 9, N, 8, N], [7, N, N, N, 4, N, N, N, 7, N, N, N, N, N, N, N]] },
  temple: { bpm: 66, root: 53, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4], pad: 1.6, arp: '0...2...3...2...', arpType: 'sine', arpV: 1.4, bass: '0...............', leadType: 'sine', leadV: 1.2, leadLen: 7, vib: true, lead: [[7, N, N, N, N, N, N, N, 9, N, N, N, N, N, N, N], [8, N, N, N, N, N, N, N, 7, N, N, N, N, N, N, N]] },
  battle: { bpm: 152, root: 57, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6], pad: 0.8, arp: '0123210301232103', arpType: 'square', arpV: 0.7, bass: '0.0.0.0.5.0.0.8.', kick: 'x...x...x...x.x.', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.x.', leadType: 'square', leadV: 1, leadLen: 2.4, lead: [[7, N, N, 7, N, 9, N, 11, N, N, 9, N, 7, N, 4, N], [5, N, N, 5, N, 7, N, 9, N, N, 12, N, 11, N, 9, N], [9, N, N, 9, N, 11, N, 13, N, N, 11, N, 9, N, 7, N], [8, N, 9, N, 11, N, 13, N, 15, N, N, N, 13, N, 11, N]] },
  boss: { bpm: 166, root: 55, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 4, 0, 3, 5, 6], pad: 0.9, arp: '0303020301030203', arpType: 'sawtooth', arpV: 0.55, bass: '0.00.0.05.00.8.5', kick: 'x.x.x...x.x.x.x.', snare: '....x..x....x.xx', hat: 'xxx.xxx.xxx.xxxx', leadType: 'sawtooth', leadV: 0.8, leadLen: 2.2, lead: [[7, N, 9, N, 10, N, N, 7, N, 9, N, 10, N, 14, N, N], [13, N, N, 11, N, 10, N, 9, N, N, 7, N, N, N, N, N], [12, N, 14, N, 15, N, N, 12, N, 14, N, 15, N, 17, N, N], [16, N, N, 14, N, 13, N, 11, N, 9, N, 11, N, 13, N, N]] },
  ending: { bpm: 80, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], prog: [3, 4, 0, 5, 3, 4, 0, 0], pad: 1.6, arp: '0.2.3.4.3.2.3.2.', arpV: 1, bass: '0.......5.......', leadType: 'sine', leadV: 1.7, leadLen: 5, vib: true, lead: [[9, N, N, N, 8, N, 7, N, 5, N, N, N, 7, N, N, N], [8, N, N, N, 7, N, 5, N, 4, N, N, N, N, N, N, N], [4, N, 5, N, 7, N, N, N, 9, N, N, N, 11, N, N, N], [9, N, N, N, 8, N, N, N, 7, N, N, N, N, N, N, N]] },
};
const music = n => { if (!A.ready) return; A.music(MUS[n]); A.drums(1); A.color(n === 'temple' ? 3500 : 9000); };
const bellSnd = (f, v = 0.3, d = 2.2) => { for (const [m, k, dd] of [[1, 1, 1], [2.0, 0.6, 0.7], [2.76, 0.4, 0.5], [5.4, 0.25, 0.3], [8.9, 0.12, 0.2]]) A.tone({ f: f * m, d: d * dd, v: v * k, type: 'sine', a: 0.004 }); };
const SFX = {
  swing() { A.noise({ f: 900, f2: 3200, d: 0.13, v: 0.1, q: 1.2 }); },
  hit(h) { A.noise({ f: h ? 700 : 1400, f2: 200, d: h ? 0.22 : 0.12, v: h ? 0.4 : 0.25, type: 'lowpass' }); A.tone({ f: h ? 130 : 220, f2: 60, d: h ? 0.25 : 0.12, v: h ? 0.4 : 0.2, type: 'square' }); if (h) bellSnd(392, 0.12, 0.8); },
  hurt() { A.tone({ f: 300, f2: 90, d: 0.3, v: 0.35, type: 'sawtooth' }); A.noise({ f: 500, d: 0.2, v: 0.25, type: 'lowpass' }); },
  dodge() { A.noise({ f: 2000, f2: 6000, d: 0.16, v: 0.1 }); },
  ember() { bellSnd(294, 0.3, 1.6); A.noise({ f: 300, f2: 2500, d: 0.6, v: 0.3, type: 'lowpass' }); },
  gale() { A.noise({ f: 5000, f2: 900, d: 0.4, v: 0.25 }); A.tone({ f: 900, f2: 1800, d: 0.25, v: 0.08, type: 'sine' }); },
  chord() { bellSnd(196, 0.35, 3); bellSnd(294, 0.3, 3); bellSnd(392, 0.25, 3); A.noise({ f: 200, f2: 7000, d: 1.1, v: 0.3 }); },
  die() { A.tone({ f: 500, f2: 80, d: 0.35, v: 0.14, type: 'triangle' }); A.noise({ f: 3000, f2: 300, d: 0.3, v: 0.1 }); },
  warn() { A.tone({ f: 880, d: 0.09, v: 0.07, type: 'square' }); },
  shot() { A.tone({ f: 700, f2: 300, d: 0.2, v: 0.09, type: 'sawtooth' }); },
  level() { [72, 76, 79, 84, 88].forEach((m, i) => A.tone({ f: A.m2f(m), d: 0.35, v: 0.12, type: 'triangle', t: i * 0.07 })); },
  blip(p) { A.tone({ f: p * (0.96 + Math.random() * 0.08), d: 0.045, v: 0.05, type: 'triangle' }); },
  crack() { A.noise({ f: 2500, f2: 150, d: 0.9, v: 0.5, type: 'lowpass' }); A.tone({ f: 220, f2: 55, d: 1.4, v: 0.4, type: 'sawtooth' }); },
  unlock() { [69, 73, 76, 81].forEach((m, i) => bellSnd(A.m2f(m), 0.14, 1.2 - i * 0.1)); },
  beam() { A.tone({ f: 1400, f2: 200, d: 0.3, v: 0.16, type: 'sawtooth' }); A.noise({ f: 4000, d: 0.2, v: 0.14 }); },
};

// ═════════════ HUD helpers ═════════════
function ftext(x, y, z, s, cls) { const el = document.createElement('div'); el.className = 'fl ' + (cls || ''); el.textContent = s; $('floats').appendChild(el); floats.push({ el, x: x + rand(-0.3, 0.3), y, z, t: 0 }); }
let tipT = 0; function tip(s, secs = 3.5) { $('tip').innerHTML = s; $('tip').classList.add('on'); tipT = secs; }
let toastT = 0; function toast(big, small, secs = 1.8) { $('toast').innerHTML = big + (small ? '<small>' + small + '</small>' : ''); $('toast').classList.add('on'); toastT = secs; }
function ringFx(x, y, z, r0, r1, dur, c, fat) { fx.push({ k: 'ring', x, y, z, r0, r1, dur, t: 0, c, fat }); }
function slashFx(x, z, yaw, c, s, big, y = 1.0, tilt = 0) { fx.push({ k: 'slash', x, z, yaw, c, s, big, y, tilt, t: 0, dur: big ? 0.3 : 0.2 }); }
function hudRefresh() {
  $('hpF').style.transform = 'scaleX(' + clamp(PL.hp / PL.maxHp, 0, 1).toFixed(3) + ')'; $('brF').style.transform = 'scaleX(' + (PL.breath / 100).toFixed(3) + ')'; $('xpF').style.transform = 'scaleX(' + clamp(PL.xp / need(PL.level), 0, 1).toFixed(3) + ')'; $('lv').textContent = 'LV ' + PL.level;
  show('skEmber', PL.un.ember); show('skGale', PL.un.gale); show('skChord', PL.un.chord);
  const cd = (id, v) => { $(id).querySelector('.cd').style.transform = 'scaleY(' + clamp(v, 0, 1).toFixed(2) + ')'; };
  cd('skDodge', PL.cdD / 0.55); cd('skEmber', PL.cdE / 1.2); cd('skGale', PL.cdG / 1.0); cd('skChord', 1 - PL.chord / 100);
  $('skEmber').classList.toggle('low', PL.breath < 30); $('skGale').classList.toggle('low', PL.breath < 25); $('skChord').classList.toggle('ready', PL.chord >= 100 && PL.storm <= 0);
  const b = enemies.find(e => e.boss && !e.dead);
  show('boss', !!b); if (b) { $('bossF').style.transform = 'scaleX(' + clamp(b.hp / b.max, 0, 1).toFixed(3) + ')'; }
}

// ═════════════ combat ═════════════
const ATK = [null, { dur: 0.3, hit: 0.1, cancel: 0.19, mul: 1, range: 2.5, arc: 1.3, mode: 'atk1' }, { dur: 0.3, hit: 0.1, cancel: 0.19, mul: 1.15, range: 2.5, arc: 1.3, mode: 'atk2' }, { dur: 0.56, hit: 0.25, cancel: 0.46, mul: 2.2, range: 3.1, arc: 4, mode: 'atk3' }];
const STAT = { hushed: { hp: 50, r: 0.5, sp: 3.7, dmg: 10, xp: 12 }, wailer: { hp: 40, r: 0.45, sp: 2.5, dmg: 11, xp: 16 }, brute: { hp: 230, r: 1.0, sp: 2.2, dmg: 24, xp: 42 }, kaito: { hp: 950, r: 0.5, sp: 6.2, dmg: 12, xp: 110, boss: true }, veyl: { hp: 1150, r: 0.6, sp: 0, dmg: 14, xp: 160, boss: true } };
function spawn(type, x, z, mul = 1) {
  const s = STAT[type], e = { type, x, z, y: 0, yaw: 0, hp: s.hp * mul, max: s.hp * mul, r: s.r, sp: s.sp, dmg: s.dmg * (0.85 + mul * 0.15), xp: s.xp, boss: !!s.boss, state: 'spawn', t: 0, flash: 0, stun: 0, kx: 0, kz: 0, dead: false, seed: rand(10), cd: rand(1.2, 2.6), n: 0, last: '', phase: 1 };
  enemies.push(e); if (!e.boss) P.burst(16, { x, y: 0.8, z, c: [0.45, 0.3, 0.9], s0: 0.4, life: 0.6, add: false, a: 0.8 }, 2.5, 1); return e;
}
function nearest(x, z, maxD, filt) { let b = null, bd = maxD; for (const e of enemies) { if (e.dead || e.state === 'gone' || (filt && !filt(e))) continue; const d = hypot(e.x - x, e.z - z) - e.r; if (d < bd) { bd = d; b = e; } } return b; }
function gainXp(n) { PL.xp += n; while (PL.xp >= need(PL.level)) { PL.xp -= need(PL.level); PL.level++; PL.maxHp += 14; PL.hp = PL.maxHp; PL.atk += 2; toast('LEVEL ' + PL.level, "Rin's resolve deepens"); SFX.level(); ringFx(rin.x, 0.1, rin.z, 0.5, 4, 0.6, [1, 0.85, 0.4], true); P.burst(30, { x: rin.x, y: 1, z: rin.z, c: [1, 0.85, 0.4], s0: 0.25, life: 0.9, shape: 2, drag: 1 }, 5, 3); } }
function damage(e, d, dx, dz, heavy, col) {
  if (e.dead || e.state === 'gone' || e.state === 'spawn' && e.boss) return;
  d = Math.round(d * rand(0.92, 1.1)); e.hp -= d; e.flash = 1; const kb = e.boss ? 0 : e.type === 'brute' ? 2 : heavy ? 11 : 6; e.kx += dx * kb; e.kz += dz * kb;
  if (!e.boss && e.type !== 'brute') { e.stun = heavy ? 0.5 : 0.28; if (e.state === 'wind' || e.state === 'strike') { e.state = 'chase'; e.t = 0; } }
  ftext(e.x, 1.6 + (e.type === 'brute' ? 0.8 : 0), e.z, String(d), heavy ? 'big' : ''); freeze = max(freeze, heavy ? 0.085 : 0.04); shake = max(shake, heavy ? 0.45 : 0.16); SFX.hit(heavy);
  P.burst(heavy ? 16 : 8, { x: e.x, y: 1.1, z: e.z, c: col || [1, 0.95, 0.7], s0: heavy ? 0.3 : 0.2, life: 0.35, shape: 2, drag: 4 }, heavy ? 9 : 6, 1);
  if (heavy) R.fx.flash = max(R.fx.flash, 0.16);
  if (e.hp <= 0) kill(e);
}
function kill(e) {
  if (e.boss) { e.hp = 0; e.dead = true; e.state = 'down'; freeze = 0.5; shake = 0.8; R.fx.flash = 0.6; R.fx.flashCol = [1, 1, 1]; gainXp(e.xp); for (const s of shots) s.life = 0; teles.length = 0; for (const o of enemies) if (!o.boss && !o.dead) { o.dead = true; P.burst(14, { x: o.x, y: 1, z: o.z, c: [0.5, 0.35, 1], s0: 0.35, life: 0.6 }, 4, 2); } return; }
  e.dead = true; PL.kills++; SFX.die(); gainXp(e.xp);
  P.burst(22, { x: e.x, y: 1, z: e.z, c: [0.4, 0.28, 0.85], s0: 0.42, s1: 0.1, life: 0.7, add: false, a: 0.85, drag: 2 }, 4.5, 1.5); P.burst(8, { x: e.x, y: 1.2, z: e.z, c: [0.8, 0.9, 1], s0: 0.14, life: 1.1, g: -3, drag: 2 }, 2, 2);
  if (Math.random() < 0.3 && PL.hp < PL.maxHp) { PL.hp = min(PL.maxHp, PL.hp + 8); ftext(rin.x, 2, rin.z, '+8', 'heal'); }
}
function hurtPlayer(d, dx, dz) {
  if (mode !== 'fight' || PL.state === 'dead' || PL.godMode || fight && fight.done) return false;
  if (PL.inv > 0) { if ((PL.state === 'dodge' || PL.state === 'dash') && !PL.perfect) { PL.perfect = true; PL.breath = min(100, PL.breath + 18); ftext(rin.x, 2.1, rin.z, 'DODGED', 'note'); } return false; }
  d = Math.round(d); PL.hp -= d; PL.state = 'hit'; PL.t = 0; PL.vx = dx * 7; PL.vz = dz * 7; PL.inv = 0.7; shake = max(shake, 0.5); hurtFx = 1; R.fx.aberr = 0.03; SFX.hurt(); ftext(rin.x, 2, rin.z, '-' + d, 'hurt'); freeze = max(freeze, 0.06);
  if (PL.hp <= 0) { PL.hp = 0; PL.state = 'dead'; PL.t = 0; A.drums(0); A.color(700); setTimeout(() => { if (PL.state === 'dead') { mode = 'dead'; show('dead', true); show('hud', false); } }, 1500); }
  return true;
}
function melee(i) {
  const a = ATK[i], fxv = sin(rin.yaw), fzv = cos(rin.yaw), dmg = PL.atk * a.mul * (PL.storm > 0 ? 1.3 : 1); let n = 0;
  for (const e of enemies) {
    if (e.dead || e.state === 'gone') continue; const dx = e.x - rin.x, dz = e.z - rin.z, d = hypot(dx, dz) || 0.01; if (d > a.range + e.r) continue;
    if (a.arc < 3 && d > 0.9 && Math.acos(clamp((dx * fxv + dz * fzv) / d, -1, 1)) > a.arc) continue;
    damage(e, dmg, dx / d, dz / d, i === 3, PL.storm > 0 ? [1, 0.6, 0.3] : null); n++;
  }
  for (const s of shots) { if (s.from !== 'e') continue; if (hypot(s.x - rin.x, s.z - rin.z) < a.range) { s.life = 0; n++; P.burst(8, { x: s.x, y: s.y, z: s.z, c: [0.8, 0.7, 1], s0: 0.2, life: 0.3 }, 4); } }
  if (n) { PL.breath = min(100, PL.breath + 5 * n + (i === 3 ? 4 : 0)); if (PL.un.chord && PL.storm <= 0) PL.chord = min(100, PL.chord + 4 * n + (i === 3 ? 4 : 0)); }
  if (i === 3) { ringFx(rin.x + fxv, 0.1, rin.z + fzv, 0.4, 3.2, 0.35, PL.storm > 0 ? [1, 0.6, 0.25] : [1, 0.9, 0.6], true); shake = max(shake, 0.3); P.burst(14, { x: rin.x + fxv * 1.2, y: 0.15, z: rin.z + fzv * 1.2, c: [1, 0.95, 0.8], s0: 0.25, life: 0.4, add: false, a: 0.6 }, 5, 1.5); }
}
function startAtk(i) {
  const p = PL; p.state = 'atk'; p.combo = i; p.t = 0; p.hitDone = false; const t = nearest(rin.x, rin.z, 6);
  if (t) { rin.yaw = atan2(t.x - rin.x, t.z - rin.z); p.lunge = hypot(t.x - rin.x, t.z - rin.z) - t.r > 1.7 ? 9 : 1.5; } else { if (hypot(input.x, input.z) > 0.2) rin.yaw = atan2(input.x, input.z); p.lunge = 3; }
  SFX.swing(); slashFx(rin.x, rin.z, rin.yaw, p.storm > 0 ? [1, 0.55, 0.2] : [1, 0.86, 0.9], i === 3 ? 1.25 : 1, i === 3, 1.0, i === 2 ? 0.25 : i === 1 ? -0.2 : 0);
}
function doAct(n) {
  const p = PL, free = p.state === 'idle' || p.state === 'run', atkOpen = p.state === 'atk' && p.t >= ATK[p.combo].cancel * (p.storm > 0 ? 0.75 : 1);
  if (n === 'atk') { if (free || atkOpen) { startAtk(p.state === 'atk' || p.comboT > 0 ? p.combo % 3 + 1 : 1); return true; } return false; }
  if (n === 'dodge') { if (p.cdD > 0) return true; if (free || p.state === 'atk') { let dx = input.x, dz = input.z; const m = hypot(dx, dz); if (m > 0.2) { dx /= m; dz /= m; } else { dx = sin(rin.yaw); dz = cos(rin.yaw); } p.state = 'dodge'; p.t = 0; p.dx = dx; p.dz = dz; p.inv = 0.34; p.cdD = 0.55; p.perfect = false; rin.yaw = atan2(dx, dz); SFX.dodge(); return true; } return false; }
  if (n === 'ember') { if (!p.un.ember) return true; if (p.cdE > 0) return true; if (p.breath < 30) { tip('Not enough Breath. Land strikes to earn it back.', 2); return true; } if (free || atkOpen || p.state === 'atk') { p.state = 'cast'; p.t = 0; p.hitDone = false; p.breath -= 30; p.cdE = 1.2; return true; } return false; }
  if (n === 'gale') { if (!p.un.gale) return true; if (p.cdG > 0) return true; if (p.breath < 25) { tip('Not enough Breath. Land strikes to earn it back.', 2); return true; } if (free || p.state === 'atk') { let dx = input.x, dz = input.z; const m = hypot(dx, dz), t = nearest(rin.x, rin.z, 10); if (m > 0.2) { dx /= m; dz /= m; } else if (t) { const d = hypot(t.x - rin.x, t.z - rin.z) || 1; dx = (t.x - rin.x) / d; dz = (t.z - rin.z) / d; } else { dx = sin(rin.yaw); dz = cos(rin.yaw); } p.state = 'dash'; p.t = 0; p.dx = dx; p.dz = dz; p.breath -= 25; p.cdG = 1.0; p.inv = 0.36; p.perfect = false; p.hitSet = new Set(); rin.yaw = atan2(dx, dz); SFX.gale(); slashFx(rin.x, rin.z, rin.yaw, [0.5, 1, 0.85], 1.3, true, 1.0); return true; } return false; }
  if (n === 'chord') { if (!p.un.chord || p.chord < 100 || p.storm > 0) return true; p.chord = 0; p.storm = 6.5; p.stormTick = 0; freeze = 1.15; SFX.chord(); R.fx.flash = 0.5; R.fx.flashCol = [1, 0.8, 0.5]; const c = $('cutin'); c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); return true; }
  return true;
}
function act(n) { if (mode !== 'fight' || paused || PL.state === 'dead') return; PL.buf = { n, t: 0.25 }; }
function playerUpdate(dt) {
  const p = PL; p.inv -= dt; p.cdD -= dt; p.cdE -= dt; p.cdG -= dt; p.comboT -= dt; p.breath = min(100, p.breath + (p.storm > 0 ? 14 : 3.5) * dt);
  if (p.buf) { p.buf.t -= dt; if (doAct(p.buf.n) || p.buf.t <= 0) p.buf = null; }
  let ix = input.x, iz = input.z; const m = hypot(ix, iz); if (m > 1) { ix /= m; iz /= m; }
  const sp = 6.6 * (p.storm > 0 ? 1.15 : 1), ts = p.storm > 0 ? 0.75 : 1;
  switch (p.state) {
    case 'idle': case 'run':
      if (m > 0.15) { rin.yaw += E.angDiff(rin.yaw, atan2(ix, iz)) * min(1, 16 * dt); rin.x += ix * sp * dt; rin.z += iz * sp * dt; p.state = 'run'; rin.cycle += dt * 12 * min(1, m); rin.mode = 'run'; } else { p.state = 'idle'; rin.mode = 'idle'; }
      break;
    case 'atk': { const a = ATK[p.combo]; p.t += dt; rin.mode = a.mode; rin.phase = p.t / (a.dur * ts); if (p.t < 0.13) { rin.x += sin(rin.yaw) * p.lunge * dt; rin.z += cos(rin.yaw) * p.lunge * dt; }
      if (!p.hitDone && p.t >= a.hit * ts) { p.hitDone = true; melee(p.combo); } if (p.t >= a.dur * ts) { p.state = 'idle'; p.comboT = 0.4; if (p.combo === 3) p.comboT = 0; } break; }
    case 'dodge': p.t += dt; rin.mode = 'dodge'; rin.x += p.dx * 17 * dt; rin.z += p.dz * 17 * dt; if (Math.random() < 0.7) P.spawn({ x: rin.x, y: rand(0.3, 1.3), z: rin.z, c: [0.8, 0.95, 1], s0: 0.2, life: 0.25, add: false, a: 0.5 }); if (p.t > 0.26) p.state = 'idle'; break;
    case 'dash': { p.t += dt; rin.mode = 'atk1'; rin.phase = 0.6; rin.x += p.dx * 42 * dt; rin.z += p.dz * 42 * dt;
      for (const e of enemies) { if (e.dead || p.hitSet.has(e)) continue; if (hypot(e.x - rin.x, e.z - rin.z) < 1.9 + e.r) { p.hitSet.add(e); damage(e, 22 + p.atk * 1.3, p.dx, p.dz, true, [0.5, 1, 0.85]); if (p.un.chord && p.storm <= 0) p.chord = min(100, p.chord + 6); } }
      for (let i = 0; i < 3; i++) P.spawn({ x: rin.x + rand(-0.4, 0.4), y: rand(0.3, 1.6), z: rin.z + rand(-0.4, 0.4), c: [0.5, 1, 0.85], s0: 0.3, life: 0.35, shape: 2 });
      if (p.t > 0.2) { p.state = 'idle'; slashFx(rin.x, rin.z, rin.yaw + PI, [0.5, 1, 0.85], 1.1, false); } break; }
    case 'cast': p.t += dt; rin.mode = 'cast';
      if (!p.hitDone && p.t >= 0.2) { p.hitDone = true; SFX.ember(); shake = max(shake, 0.6); R.fx.flash = 0.25; R.fx.flashCol = [1, 0.6, 0.3]; ringFx(rin.x, 0.15, rin.z, 0.5, 4.9, 0.4, [1, 0.5, 0.15], true); ringFx(rin.x, 0.6, rin.z, 0.3, 4.2, 0.5, [1, 0.8, 0.3], false);
        P.burst(46, { x: rin.x, y: 0.5, z: rin.z, c: [1, 0.55, 0.15], s0: 0.45, s1: 0.05, life: 0.7, g: -4, drag: 2.5 }, 10, 2); P.burst(18, { x: rin.x, y: 1, z: rin.z, c: [1, 0.9, 0.5], s0: 0.2, life: 0.9, shape: 2, drag: 1.5 }, 7, 4);
        for (const e of enemies) { if (e.dead) continue; const dx = e.x - rin.x, dz = e.z - rin.z, d = hypot(dx, dz) || 1; if (d < 4.8 + e.r) { damage(e, 30 + p.atk * 1.7, dx / d, dz / d, true, [1, 0.55, 0.15]); if (p.un.chord && p.storm <= 0) p.chord = min(100, p.chord + 6); } }
        for (const s of shots) if (s.from === 'e' && hypot(s.x - rin.x, s.z - rin.z) < 4.8) s.life = 0; }
      if (p.t > 0.5) p.state = 'idle'; break;
    case 'hit': p.t += dt; rin.mode = 'hit'; rin.x += p.vx * dt; rin.z += p.vz * dt; p.vx *= exp(-9 * dt); p.vz *= exp(-9 * dt); if (p.t > 0.3) p.state = 'idle'; break;
    case 'dead': p.t += dt; rin.mode = 'dead'; break;
  }
  if (p.storm > 0) {
    p.storm -= dt; p.stormTick -= dt;
    for (let i = 0; i < 3; i++) { const a = time * 7 + i * 2.1 + rand(0.5), rr = 1 + rand(3.5); P.spawn({ x: rin.x + sin(a) * rr, y: rand(0.1, 0.6), z: rin.z + cos(a) * rr, vx: cos(a) * 6, vz: -sin(a) * 6, vy: rand(3, 7), c: i % 3 ? [1, 0.5, 0.12] : [0.5, 1, 0.85], s0: 0.4, s1: 0.05, life: 0.6 }); }
    if (p.stormTick <= 0) { p.stormTick = 0.24; for (const e of enemies) { if (e.dead) continue; const dx = e.x - rin.x, dz = e.z - rin.z, d = hypot(dx, dz) || 1; if (d < 5.4 + e.r) damage(e, 5 + p.atk * 0.5, dx / d * 0.2, dz / d * 0.2, false, [1, 0.55, 0.15]); } ringFx(rin.x, 0.2, rin.z, 4.8, 5.4, 0.24, [1, 0.6, 0.2], false); }
  }
  const d = hypot(rin.x, rin.z); if (d > ARENA) { rin.x *= ARENA / d; rin.z *= ARENA / d; }
}
// ───── enemy minds ─────
function tele(o) { teles.push(Object.assign({ t: 0, col: [1, 0.25, 0.4] }, o)); SFX.warn(); }
function shoot(x, y, z, dx, dz, sp, dmg, c, r = 0.32, kind = 'orb', life = 4.5) { shots.push({ x, y, z, vx: dx * sp, vz: dz * sp, dmg, c, r, kind, life, from: 'e', yaw: atan2(dx, dz) }); }
function face(e, dx, dz, k, dt) { e.yaw += E.angDiff(e.yaw, atan2(dx, dz)) * min(1, k * dt); }
function hitPlayerIf(cond, dmg, dx, dz) { if (cond) hurtPlayer(dmg, dx, dz); }
function enemyUpdate(e, dt) {
  e.t += dt; e.flash = max(0, e.flash - dt * 5); e.x += e.kx * dt; e.z += e.kz * dt; const kd = exp(-8 * dt); e.kx *= kd; e.kz *= kd;
  const pd = hypot(e.x, e.z); if (pd > ARENA + 0.5) { e.x *= (ARENA + 0.5) / pd; e.z *= (ARENA + 0.5) / pd; }
  if (e.stun > 0) { e.stun -= dt; return; }
  const dx = rin.x - e.x, dz = rin.z - e.z, d = hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
  if (e.type === 'hushed') {
    if (e.state === 'spawn') { if (e.t > 0.6) { e.state = 'chase'; e.t = 0; } }
    else if (e.state === 'chase') { face(e, ux, uz, 8, dt); e.x += ux * e.sp * dt; e.z += uz * e.sp * dt; if (d < 1.9) { e.state = 'wind'; e.t = 0; SFX.warn(); } }
    else if (e.state === 'wind') { face(e, ux, uz, 5, dt); if (e.t > 0.5) { e.state = 'strike'; e.t = 0; e.kx += sin(e.yaw) * 10; e.kz += cos(e.yaw) * 10; e.hitDone = false; slashFx(e.x, e.z, e.yaw, [0.7, 0.4, 1], 0.8, false, 0.9); } }
    else if (e.state === 'strike') { if (!e.hitDone && e.t > 0.1) { e.hitDone = true; hitPlayerIf(d < 1.9, e.dmg, ux, uz); } if (e.t > 0.32) { e.state = 'rest'; e.t = 0; } }
    else if (e.state === 'rest') { if (e.t > 0.55) { e.state = 'chase'; e.t = 0; } }
  } else if (e.type === 'wailer') {
    if (e.state === 'spawn') { if (e.t > 0.6) { e.state = 'chase'; e.t = 0; } }
    else if (e.state === 'chase') { face(e, ux, uz, 6, dt); const mv = d < 6 ? -1 : d > 10 ? 1 : 0; e.x += (ux * mv * e.sp + -uz * sin(time * 0.7 + e.seed) * 1.2) * dt; e.z += (uz * mv * e.sp + ux * sin(time * 0.7 + e.seed) * 1.2) * dt; e.cd -= dt; if (e.cd <= 0 && d < 15) { e.state = 'wind'; e.t = 0; SFX.warn(); } }
    else if (e.state === 'wind') { face(e, ux, uz, 6, dt); if (e.t > 0.7) { shoot(e.x + ux * 0.5, 1.3, e.z + uz * 0.5, ux, uz, 7.5, e.dmg, [0.75, 0.5, 1]); SFX.shot(); e.state = 'chase'; e.t = 0; e.cd = rand(2.3, 3.4); } }
  } else if (e.type === 'brute') {
    if (e.state === 'spawn') { if (e.t > 0.7) { e.state = 'chase'; e.t = 0; } }
    else if (e.state === 'chase') { face(e, ux, uz, 3, dt); e.x += ux * e.sp * dt; e.z += uz * e.sp * dt; if (d < 3.1) { e.state = 'wind'; e.t = 0; e.tx = e.x + sin(e.yaw) * 1.7; e.tz = e.z + cos(e.yaw) * 1.7; tele({ k: 'circle', x: e.tx, z: e.tz, r: 3.1, dur: 0.95, own: e, fire() { if (e.dead) return; shake = max(shake, 0.6); ringFx(e.tx, 0.1, e.tz, 0.5, 3.4, 0.35, [0.7, 0.4, 1], true); P.burst(20, { x: e.tx, y: 0.2, z: e.tz, c: [0.6, 0.5, 0.8], s0: 0.4, life: 0.5, add: false, a: 0.7 }, 6, 2); SFX.hit(true); const ddx = rin.x - e.tx, ddz = rin.z - e.tz, dd = hypot(ddx, ddz) || 1; hitPlayerIf(dd < 3.1 + 0.3, e.dmg, ddx / dd, ddz / dd); } }); } }
    else if (e.state === 'wind') { if (e.t > 0.95) { e.state = 'rest'; e.t = 0; } }
    else if (e.state === 'rest') { if (e.t > 1.25) { e.state = 'chase'; e.t = 0; } }
  } else if (e.type === 'kaito') kaitoAI(e, dt, d, ux, uz);
  else if (e.type === 'veyl') veylAI(e, dt, d, ux, uz);
}
function kaitoAI(e, dt, d, ux, uz) {
  const a = kaito; a.x = e.x; a.z = e.z; a.yaw = e.yaw; a.flash = e.flash; const low = e.hp < e.max * 0.5;
  const rest = (s) => { e.state = 'rest'; e.t = 0; e.restDur = s * (low ? 0.8 : 1); };
  switch (e.state) {
    case 'spawn': a.mode = 'idle'; if (e.t > 0.8) rest(0.5); break;
    case 'rest': a.mode = 'idle'; face(e, ux, uz, 6, dt); if (e.t > e.restDur) { const r = Math.random(); e.t = 0;
        if (low && r < 0.22 && e.last !== 'whirl') { e.state = 'whirl'; e.last = 'whirl'; tele({ k: 'circle', x: e.x, z: e.z, r: 4.5, dur: 0.85, col: [0.4, 1, 0.8], fire() { if (e.dead) return; ringFx(e.x, 0.3, e.z, 0.5, 4.8, 0.35, [0.5, 1, 0.85], true); slashFx(e.x, e.z, e.yaw, [0.6, 1, 0.9], 2, true); SFX.gale(); const dd = hypot(rin.x - e.x, rin.z - e.z) || 1; hitPlayerIf(dd < 4.7, 20, (rin.x - e.x) / dd, (rin.z - e.z) / dd); } }); }
        else if (d > 6 && r < 0.55 && e.last !== 'dash') { e.state = 'dashw'; e.last = 'dash'; e.dyaw = atan2(ux, uz); e.dlen = min(13, d + 3.5); tele({ k: 'line', x: e.x, z: e.z, yaw: e.dyaw, len: e.dlen, w: 1.7, dur: 0.6, col: [0.4, 1, 0.8] }); }
        else if (d > 5 && e.last !== 'blades') { e.state = 'blades'; e.last = 'blades'; }
        else { e.state = 'approach'; e.last = 'combo'; } } break;
    case 'approach': a.mode = 'run'; a.cycle += dt * 13; face(e, ux, uz, 10, dt); e.x += ux * e.sp * dt; e.z += uz * e.sp * dt; if (d < 2.3 || e.t > 1.7) { e.state = 'combo'; e.t = 0; e.n = 0; e.hitDone = false; SFX.warn(); } break;
    case 'combo': { const dur = 0.46; a.mode = e.n % 2 ? 'atk2' : (e.n === 2 ? 'atk3' : 'atk1'); a.phase = clamp((e.t - 0.2) / 0.22, 0, 1); if (e.t < 0.2) face(e, ux, uz, 9, dt); else if (e.t < 0.3) { e.x += sin(e.yaw) * 7 * dt; e.z += cos(e.yaw) * 7 * dt; }
      if (!e.hitDone && e.t > 0.27) { e.hitDone = true; SFX.swing(); slashFx(e.x, e.z, e.yaw, [0.6, 1, 0.9], 1.05, e.n === 2); const fd = (ux * sin(e.yaw) + uz * cos(e.yaw)); hitPlayerIf(d < 2.7 && fd > 0.2, e.n === 2 ? 18 : e.dmg, ux, uz); }
      if (e.t > dur) { e.n++; e.t = 0; e.hitDone = false; if (e.n >= 3) rest(1.05); } break; }
    case 'dashw': a.mode = 'guard'; e.yaw = e.dyaw; if (e.t > 0.6) { e.state = 'dash'; e.t = 0; e.sx = e.x; e.sz = e.z; SFX.gale(); const px = rin.x - e.x, pz = rin.z - e.z, along = px * sin(e.dyaw) + pz * cos(e.dyaw), side = abs(px * cos(e.dyaw) - pz * sin(e.dyaw)); hitPlayerIf(along > -0.5 && along < e.dlen && side < 1.25, 20, cos(e.dyaw), -sin(e.dyaw)); } break;
    case 'dash': { a.mode = 'atk1'; a.phase = 0.7; const k = min(1, e.t / 0.16); e.x = e.sx + sin(e.dyaw) * e.dlen * k; e.z = e.sz + cos(e.dyaw) * e.dlen * k; P.spawn({ x: e.x, y: rand(0.4, 1.5), z: e.z, c: [0.5, 1, 0.85], s0: 0.3, life: 0.3, shape: 2 }); if (k >= 1) { slashFx(e.x, e.z, e.dyaw + PI, [0.6, 1, 0.9], 1.2, false); rest(0.9); } break; }
    case 'blades': a.mode = 'cast'; face(e, ux, uz, 8, dt); if (e.t > 0.5) { const by = atan2(ux, uz); for (const o of (low ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.3, 0, 0.3])) shoot(e.x, 1.1, e.z, sin(by + o), cos(by + o), 11, 12, [0.5, 1, 0.85], 0.5, 'blade', 2.2); SFX.gale(); rest(0.8); } break;
    case 'whirl': a.mode = 'cast'; if (e.t > 0.9) rest(1.0); break;
  }
}
function veylAI(e, dt, d, ux, uz) {
  const a = veyl, p2 = e.phase === 2; a.x = e.x; a.z = e.z; a.yaw = e.yaw; a.flash = e.flash; a.y = 0.4 + sin(time * 2) * 0.12 - (e.state === 'rest' ? 0.3 : 0);
  face(e, ux, uz, 5, dt);
  const rest = () => { e.state = 'rest'; e.t = 0; e.restDur = p2 ? 0.95 : 1.3; };
  switch (e.state) {
    case 'spawn': a.mode = 'proud'; a.sc = min(1, e.t / 0.6); if (e.t > 1) rest(); break;
    case 'rest': a.mode = 'idle'; a.sc = 1; if (e.t > e.restDur) { e.t = 0; e.n++;
        const frac = e.hp / e.max;
        if ((!e.sum1 && frac < 0.62) || (p2 && !e.sum2 && frac < 0.3)) { if (!e.sum1) e.sum1 = 1; else e.sum2 = 1; e.state = 'summon'; break; }
        if (e.n % 3 === 0) { e.state = 'out'; break; }
        if (d < 3.4 && Math.random() < 0.65) { e.state = 'melee'; tele({ k: 'circle', x: e.x, z: e.z, r: 3.6, dur: 0.6, col: [0.7, 0.5, 1], fire() { if (e.dead) return; ringFx(e.x, 0.3, e.z, 0.5, 3.9, 0.3, [0.7, 0.5, 1], true); SFX.hit(true); const dd = hypot(rin.x - e.x, rin.z - e.z) || 1; hitPlayerIf(dd < 3.8, 14, (rin.x - e.x) / dd, (rin.z - e.z) / dd); } }); break; }
        const opts = ['beams', 'rings', 'zones'].filter(o => o !== e.last); e.state = e.last = opts[floor(Math.random() * opts.length)]; e.k = 0; } break;
    case 'out': a.mode = 'cast'; a.sc = max(0, 1 - e.t / 0.3); if (e.t > 0.3) { P.burst(20, { x: e.x, y: 1.2, z: e.z, c: [0.6, 0.45, 1], s0: 0.35, life: 0.5 }, 4, 1); let tx, tz, n = 0; do { const an = rand(6.28), rr = rand(6, 11); tx = sin(an) * rr; tz = cos(an) * rr; } while (hypot(tx - rin.x, tz - rin.z) < 6 && n++ < 12); e.x = tx; e.z = tz; e.state = 'in'; e.t = 0; e.state2 = 1; } break;
    case 'in': a.sc = min(1, e.t / 0.3); if (e.t > 0.35) { a.sc = 1; const opts = ['beams', 'rings', 'zones'].filter(o => o !== e.last); e.state = e.last = opts[floor(Math.random() * opts.length)]; e.t = 0; e.k = 0; } break;
    case 'beams': { a.mode = 'cast'; const nB = p2 ? 5 : 3; if (e.k === 0) { e.k = 1; const by = atan2(ux, uz); for (let i = 0; i < nB; i++) { const yw = by + (i - (nB - 1) / 2) * 0.34; tele({ k: 'line', x: e.x, z: e.z, yaw: yw, len: 30, w: 1.3, dur: 0.85 + i * 0.1, col: [0.75, 0.5, 1], fire() { if (e.dead) return; fx.push({ k: 'beam', x: e.x, z: e.z, yaw: yw, len: 30, w: 1.1, t: 0, dur: 0.28 }); SFX.beam(); const px = rin.x - e.x, pz = rin.z - e.z, along = px * sin(yw) + pz * cos(yw), side = abs(px * cos(yw) - pz * sin(yw)); hitPlayerIf(along > 0 && side < 0.95, 18, cos(yw), -sin(yw)); } }); } } if (e.t > 0.85 + nB * 0.1 + 0.3) rest(); break; }
    case 'rings': { a.mode = 'cast'; const waves = p2 ? 3 : 2, cnt = p2 ? 14 : 11; if (e.k < waves && e.t > 0.35 + e.k * 0.6) { for (let i = 0; i < cnt; i++) { const an = i / cnt * 2 * PI + e.k * 0.28 + e.seed; shoot(e.x, 1.2, e.z, sin(an), cos(an), 6, 11, [0.75, 0.5, 1]); } SFX.shot(); ringFx(e.x, 1.2, e.z, 0.3, 2, 0.3, [0.75, 0.5, 1], false); e.k++; } if (e.t > 0.5 + waves * 0.6) rest(); break; }
    case 'zones': { a.mode = 'cast'; const cnt = p2 ? 6 : 4; if (e.k < cnt && e.t > 0.2 + e.k * 0.28) { const ox = e.k === 0 ? 0 : rand(-2.6, 2.6), oz = e.k === 0 ? 0 : rand(-2.6, 2.6), zx = rin.x + ox, zz = rin.z + oz; tele({ k: 'circle', x: zx, z: zz, r: 2.5, dur: 0.95, col: [0.75, 0.5, 1], fire() { if (e.dead) return; ringFx(zx, 0.2, zz, 0.3, 2.7, 0.3, [0.75, 0.5, 1], true); P.burst(14, { x: zx, y: 0.3, z: zz, c: [0.7, 0.5, 1], s0: 0.35, life: 0.6, g: -5 }, 3, 3); SFX.beam(); const dd = hypot(rin.x - zx, rin.z - zz) || 1; hitPlayerIf(dd < 2.6, 19, (rin.x - zx) / dd, (rin.z - zz) / dd); } }); e.k++; } if (e.t > 0.4 + cnt * 0.28 + 1.0) rest(); break; }
    case 'melee': a.mode = 'cast'; if (e.t > 0.7) rest(); break;
    case 'summon': a.mode = 'proud'; if (e.k !== 9 && e.t > 0.5) { e.k = 9; for (let i = 0; i < (p2 ? 4 : 3); i++) { const an = rand(6.28); spawn('hushed', e.x + sin(an) * 3, e.z + cos(an) * 3, fight.def.mul || 1); } SFX.crack(); } if (e.t > 1.1) { e.k = 0; rest(); } break;
  }
}
function allyUpdate(dt) {
  const a = kaito, t = nearest(a.x, a.z, 40); ally.cd -= dt;
  if (!t) { a.mode = 'idle'; return; }
  const dx = t.x - a.x, dz = t.z - a.z, d = hypot(dx, dz) || 1; a.yaw += E.angDiff(a.yaw, atan2(dx, dz)) * min(1, 10 * dt);
  if (ally.sw > 0) { ally.sw -= dt; a.mode = ally.n % 2 ? 'atk2' : 'atk1'; a.phase = 1 - ally.sw / 0.3; return; }
  if (d > 2 + t.r) { a.x += dx / d * 6.4 * dt; a.z += dz / d * 6.4 * dt; a.mode = 'run'; a.cycle += dt * 13; }
  else if (ally.cd <= 0) { ally.cd = 0.85; ally.sw = 0.3; ally.n++; slashFx(a.x, a.z, a.yaw, [0.6, 1, 0.9], 1, false); const f0 = freeze, s0 = shake; damage(t, 13, dx / d, dz / d, false, [0.5, 1, 0.85]); freeze = f0; shake = s0; } else a.mode = 'guard';
}

// ═════════════ fights ═════════════
function spawnWave(w) {
  const mul = fight.def.mul || 1;
  for (const [type, n] of w) for (let i = 0; i < n; i++) {
    if (type === 'kaito') { const e = spawn('kaito', 0, -6, 1); kaito.vis = true; kaito.x = 0; kaito.z = -6; $('bossN').textContent = 'Kaito Maro'; $('bossS').textContent = 'Gale Tuner of Windward'; continue; }
    if (type === 'veyl') { const e = spawn('veyl', 0, -7, fight.def.p2 ? 1.2 : 1); e.phase = fight.def.p2 ? 2 : 1; veyl.vis = true; $('bossN').textContent = 'Conductor Veyl'; $('bossS').textContent = fight.def.p2 ? 'The Silent Conductor, unbound' : 'The Silent Conductor'; continue; }
    let x, z, k = 0; do { const a = rand(6.28), r = rand(7, 12.5); x = sin(a) * r; z = cos(a) * r; } while (hypot(x - rin.x, z - rin.z) < 5.5 && k++ < 14);
    spawn(type, x, z, mul);
  }
}
function startFight(def, onDone) {
  fight = { def, wave: -1, between: 0.9, done: false, onDone, doneT: 0 }; enemies = []; shots = []; teles = []; mode = 'fight';
  Object.assign(PL, { hp: PL.maxHp, breath: 100, state: 'idle', t: 0, inv: 1, buf: null, storm: 0, combo: 0, comboT: 0 }); if (def.chordFull) PL.chord = 100;
  sato.vis = false; veyl.vis = false; kaito.vis = false; rin.lock = false;
  rin.vis = true; rin.x = def.px || 0; rin.z = def.pz === undefined ? 5 : def.pz; rin.yaw = PI; rin.mode = 'idle'; rin.over = { fRx: -0.85 }; rin.y = 0;
  if (def.ally) { ally = { cd: 1, sw: 0, n: 0 }; kaito.vis = true; kaito.x = rin.x + 2.5; kaito.z = rin.z; kaito.over = { fRx: -0.85 }; } else ally = null;
  show('hud', true); show('story', false); $('bars').classList.remove('on'); show('dead', false); music(def.music || 'battle'); A.drums(1); if (def.tip) tip(def.tip, 7);
  camGoal.k = 5; hudRefresh();
}
function fightUpdate(dt) {
  if (fight.done) { fight.doneT += dt; if (fight.doneT > 1.3) { const f = fight; fight = null; f.onDone(); } return; }
  const alive = enemies.filter(e => !e.dead).length;
  if (!alive) {
    if (fight.wave >= fight.def.waves.length - 1) { fight.done = true; shots.length = 0; teles.length = 0; A.drums(0); PL.buf = null; if (!fight.def.quiet) toast('Silence broken', '', 1.4); return; }
    fight.between -= dt;
    if (fight.between <= 0) { fight.wave++; fight.between = 1.1; spawnWave(fight.def.waves[fight.wave]); $('objT').textContent = fight.def.waves.length > 1 ? 'Wave ' + (fight.wave + 1) + ' of ' + fight.def.waves.length : (fight.def.label || ''); }
  }
}

// ═════════════ story engine ═════════════
let typing = null;
function closeUp(a, side, dist = 2.5) {
  const isPip = a === pip, yaw = isPip ? atan2(cam.pos[0] - a.x, cam.pos[2] - a.z) : a.yaw, s = isPip ? 1 : (a.h.root.s[0] || 1), fx_ = sin(yaw), fz_ = cos(yaw), rx = cos(yaw), rz = -sin(yaw), low = !isPip && (a.mode === 'kneel' || a.rest === 'kneel'), hy = isPip ? a.y : (low ? 1.0 : 1.42) * s + (a.y || 0);
  if (isPip) dist = 1.5;
  const pf = clamp((1 - R.w / R.h) / 0.55, 0, 1), sh = 0.28 * (1 - pf);   // on a tall screen the face sits dead centre
  const ox = low ? fx_ * 0.3 : 0, oz = low ? fz_ * 0.3 : 0;
  return { pos: [a.x + fx_ * dist + rx * side * 0.9, hy + (low ? 0.3 : 0.08), a.z + fz_ * dist + rz * side * 0.9], tgt: [a.x + ox - rx * side * sh, hy - 0.02 - pf * 0.12, a.z + oz - rz * side * sh], fov: 30 + pf * 12 };
}
function setCam(c, snap) { camGoal.pos = c.pos.slice(); camGoal.tgt = c.tgt.slice(); camGoal.fov = c.fov || 40; camGoal.k = c.k || 3; if (snap !== false) { cam.pos = c.pos.slice(); cam.tgt = c.tgt.slice(); cam.fov = camGoal.fov; } }
function runScript(steps, onDone) { cs = { steps, i: -1, onDone, wait: 0, hold: false }; mode = 'cut'; show('hud', false); show('story', true); show('dead', false); $('dlg').style.visibility = 'hidden'; $('bars').classList.add('on'); enemies = enemies.filter(e => e.boss && false); shots = []; teles = []; for (const a of [rin, kaito, sato, veyl]) { a.flash = 0; a.eyesShut = false; } csNext(); }
function csNext() {
  if (!cs) return; cs.i++; cs.hold = false; typing = null;
  if (cs.i >= cs.steps.length) { const d = cs.onDone; cs = null; show('story', false); $('dlg').style.visibility = 'hidden'; d(); return; }
  const s = cs.steps[cs.i];
  switch (s[0]) {
    case 'say': case 'narr': {
      const who = s[0] === 'say' ? CAST[s[1]] : null, text = s[0] === 'say' ? s[2] : s[1], o = (s[0] === 'say' ? s[3] : s[2]) || {};
      const dlg = $('dlg'); dlg.style.visibility = 'visible'; dlg.classList.toggle('narr', !who); dlg.classList.remove('done'); dlg.style.setProperty('--c', who ? who.col : '#f2b84b'); $('dName').textContent = who ? who.name : ''; $('dText').textContent = '';
      for (const a of [rin, kaito, sato, veyl]) if (a.mode === 'talk') a.mode = a.rest || 'idle';
      if (who && who !== pip) { if (o.pose) { who.mode = o.pose; who.rest = o.pose; } else if (!who.lock) { who.rest = who.mode === 'talk' ? 'idle' : who.mode; who.mode = 'talk'; } }
      if (who && o.cam !== false && who.vis) { cs.side = who.side || (cs.side === 1 ? -1 : 1); setCam(closeUp(who, who.side || cs.side, o.dist)); const g = closeUp(who, who.side || cs.side, (o.dist || 2.5) - 0.3); camGoal.pos = g.pos; camGoal.tgt = g.tgt; camGoal.k = 0.25; }
      if (o.fn) o.fn();
      typing = { text, n: 0, t: 0, pitch: who === pip ? 1100 : who === rin ? 620 : who === kaito ? 420 : who === veyl ? 250 : who === sato ? 300 : 0 }; cs.hold = true; break;
    }
    case 'do': s[1](); csNext(); break;
    case 'wait': cs.wait = s[1]; $('dlg').style.visibility = 'hidden'; break;
    case 'cam': setCam(s[1], s[2]); csNext(); break;
    case 'card': $('cardK').textContent = s[1]; $('cardT').textContent = s[2]; $('card').classList.add('on'); $('dlg').style.visibility = 'hidden'; cs.wait = 3.2; cs.card = true; break;
    case 'unlock': { const u = $('unlock'); u.style.setProperty('--c', s[4]); $('uK').textContent = s[1]; $('uT').textContent = s[2]; $('uP').innerHTML = s[3]; show('unlock', true); $('dlg').style.visibility = 'hidden'; SFX.unlock(); cs.hold = true; cs.unlock = true; break; }
  }
}
function csAdvance() {
  if (!cs || paused) return;
  if (cs.unlock) { cs.unlock = false; show('unlock', false); csNext(); return; }
  if (!cs.hold) return;
  if (typing && typing.n < typing.text.length) { typing.n = typing.text.length; $('dText').textContent = typing.text; $('dlg').classList.add('done'); return; }
  csNext();
}
function csSkip() { if (!cs) return; show('unlock', false); cs.unlock = false; $('card').classList.remove('on'); for (let i = cs.i + 1; i < cs.steps.length; i++) { const s = cs.steps[i]; if (s[0] === 'do') s[1](); else if (s[0] === 'say' && s[3] && s[3].fn) s[3].fn(); } cs.i = cs.steps.length; csNext(); }
function csUpdate(dt) {
  if (!cs) return;
  if (cs.wait > 0) { cs.wait -= dt; if (cs.wait <= 0.6 && cs.card) { $('card').classList.remove('on'); } if (cs.wait <= 0) { cs.card = false; csNext(); } return; }
  if (typing && typing.n < typing.text.length) { typing.t += dt; const n = min(typing.text.length, floor(typing.t * 46)); if (n > typing.n) { if (typing.pitch && n % 3 === 0 && /\w/.test(typing.text[n - 1] || '')) SFX.blip(typing.pitch); typing.n = n; $('dText').textContent = typing.text.slice(0, n); if (n >= typing.text.length) $('dlg').classList.add('done'); } }
}
const place = (a, x, z, yaw, mode_ = 'idle') => { a.vis = true; a.x = x; a.z = z; a.yaw = yaw; a.mode = mode_; a.rest = mode_; a.y = 0; a.sc = 1; a.over = a.armed ? { fRx: -0.85 } : null; a.lock = false; };
const hideAll = () => { for (const a of [rin, kaito, sato, veyl]) { a.vis = false; a.lock = false; a.side = 0; } pip.vis = false; };
const WIDE = { village: { pos: [0, 3.4, 11.5], tgt: [0, 2.6, -8], fov: 44 }, cliffs: { pos: [2, 3.2, 12], tgt: [0, 2.8, -8], fov: 46 }, temple: { pos: [0, 2.6, 12.5], tgt: [0, 5, -12], fov: 48 } };
const drift = (c, dx, dy, dz) => ({ pos: [c.pos[0] + dx, c.pos[1] + dy, c.pos[2] + dz], tgt: c.tgt, fov: c.fov, k: 0.12 });
const pipTo = (x, y, z) => { pip.vis = true; pip.tx = x; pip.ty = y; pip.tz = z; };

const S = {
  c1intro: () => [
    ['do', () => { setScene('village'); hideAll(); chimeGlow = 1; crackOn = 0; music('village'); place(sato, 1.3, -2, -PI / 2); place(rin, -1.3, -2, PI / 2); rin.side = -1; sato.side = 1; setCam(WIDE.village); const g = drift(WIDE.village, 0, 0.5, -3); camGoal.pos = g.pos; camGoal.k = 0.1; }],
    ['card', 'Chapter One', 'The Cracked Chime'],
    ['narr', 'Aoren is a sky of islands. Each one stays aloft because a great bell, a Chime, never stops ringing.'],
    ['narr', 'People who can hear a Chime are called Tuners. Each of them hears a single Tone, and learns to bend it into power.'],
    ['say', 'sato', 'Rin. The mallet goes on the rack. Not on the floor.'],
    ['say', 'rin', 'Sorry, Master Sato. I was listening to the Chime again.'],
    ['say', 'sato', 'And what did it tell you today?'],
    ['say', 'rin', "Same as always. Nothing. Every kid on this island heard their Tone by twelve. I'm sixteen, and all I hear is... bell."],
    ['say', 'sato', "A bell doesn't ring because it is struck hard. It rings because it is hollow enough to listen. Remember that the next time you feel sorry for yourself."],
    ['say', 'rin', "That's not comforting. That's a riddle."],
    ['do', () => { SFX.crack(); shake = 1; chimeGlow = 0; crackOn = 1; A.stopMusic(); R.fx.flash = 0.5; R.fx.flashCol = [0.7, 0.5, 1]; setCam({ pos: [0, 2.2, -6], tgt: [0, 6.5, -19], fov: 40 }); camGoal.pos = [0, 2.4, -8]; camGoal.k = 0.4; rin.yaw = PI; sato.yaw = PI; rin.mode = rin.rest = 'hit'; }],
    ['wait', 1.8],
    ['say', 'rin', 'The Chime... it stopped.', { pose: 'idle' }],
    ['say', 'sato', "It didn't stop. Someone silenced it. Rin, behind you!", { pose: 'guard' }],
    ['do', () => { sato.vis = false; }],
  ],
  c1ember: () => [
    ['do', () => { hideAll(); place(rin, 0, 2, PI + 0.3); rin.side = -1; pip.x = 0; pip.y = 6; pip.z = -19; pipTo(1.2, 1.7, 0.8); pip.vis = true; music('village'); }],
    ['say', 'rin', "They don't make any sound. Not even when they break."],
    ['say', 'pip', "That's because they're the Hushed! Holes where sound used to be. Hi! I'm Pip. I fell out of your bell."],
    ['say', 'rin', 'You fell out of my...'],
    ['say', 'pip', 'No time! Listen. Not with your ears. Under the quiet. Do you hear it?'],
    ['do', () => { rin.eyesShut = true; rin.mode = rin.rest = 'idle'; ringFx(rin.x, 0.1, rin.z, 0.3, 3, 1.2, [1, 0.5, 0.15], false); P.burst(30, { x: rin.x, y: 0.2, z: rin.z, c: [1, 0.55, 0.15], s0: 0.25, life: 1.4, g: -3, drag: 1 }, 2.5, 1); bellSnd(294, 0.2, 2); setCam(closeUp(rin, -1, 1.9)); }],
    ['wait', 1.6],
    ['say', 'rin', "...It's warm. Like the forge when Master lights it.", { cam: false }],
    ['do', () => { rin.eyesShut = false; }],
    ['say', 'pip', "That's EMBER! The Tone that burns! Ring it, Rin!"],
    ['do', () => { PL.un.ember = true; }],
    ['unlock', 'Tone learned', 'EMBER', 'Press <b>K</b> (or the Ember button) to ring a wave of fire around you.<br>A Tone costs <b>Breath</b>, the blue bar. Every strike you land gives Breath back.', '#ff8a3c'],
  ],
  c1outro: () => [
    ['do', () => { hideAll(); music('village'); place(sato, 1.2, -3, -PI / 2, 'kneel'); sato.lock = true; place(rin, -0.6, -3, PI / 2); pip.x = -0.2; pip.y = 1.8; pip.z = -2.2; pipTo(-0.2, 1.8, -2.2); rin.side = -1; sato.side = 1; }],
    ['say', 'sato', 'You heard a Tone. At sixteen. Stubborn in everything, aren\'t you.'],
    ['say', 'rin', "Master, you're hurt. Don't talk."],
    ['say', 'sato', "I'll mend. The Chime won't. The man who cracked it wore a conductor's coat. He is walking the islands and silencing every bell he reaches."],
    ['say', 'sato', "Windward's Chime is next. Take my mallet with you. It has rung true for forty years."],
    ['say', 'rin', "I'm not a Tuner. I've had a Tone for ten minutes."],
    ['say', 'pip', 'Eleven! I counted.'],
    ['say', 'sato', "Then you will have had it for twelve by the time you reach the bridge. Go."],
    ['narr', 'She took the mallet. It was heavier than it looked, and it hummed.'],
  ],
  c2intro: () => [
    ['do', () => { setScene('cliffs'); hideAll(); music('cliffs'); place(kaito, 0, -4, 0, 'proud'); kaito.lock = true; place(rin, 0, 3, PI); pip.x = 1; pip.y = 1.7; pip.z = 3.4; pipTo(1, 1.7, 3.4); rin.side = -1; kaito.side = 1; setCam(WIDE.cliffs); const g = drift(WIDE.cliffs, -3, 0.4, -2); camGoal.pos = g.pos; camGoal.k = 0.1; }],
    ['card', 'Chapter Two', 'Windward'],
    ['narr', 'Windward. The island where the wind never rests, and neither do its swordsmen.'],
    ['say', 'kaito', 'Stop there. The Gale Chime is under the protection of the Windward school. State your Tone.'],
    ['say', 'rin', 'Ember. Since yesterday.'],
    ['say', 'kaito', 'Since yesterday. And before that?'],
    ['say', 'rin', 'Toneless.'],
    ['say', 'kaito', "Then go home, Toneless. A man who silences bells is coming, and I don't have time to guard a beginner as well as a Chime."],
    ['say', 'rin', "I'm not asking you to guard me. I'm asking you to move.", { pose: 'guard' }],
    ['say', 'pip', "Ooh. She's doing the eyebrows."],
    ['say', 'kaito', '...Draw your mallet. If you can touch me even once, I will hear you out.', { pose: 'guard' }],
  ],
  c2mid: () => [
    ['do', () => { hideAll(); A.stopMusic(); place(kaito, 1.5, -1, -PI / 2, 'kneel'); kaito.lock = true; place(rin, -1.5, -1, PI / 2); pip.x = -1.8; pip.y = 1.8; pip.z = -0.3; pipTo(-1.8, 1.8, -0.3); rin.side = -1; kaito.side = 1; }],
    ['say', 'kaito', 'You touched me. More than once.'],
    ['say', 'rin', 'You were counting?'],
    ['say', 'kaito', 'I always count. ...Behind you! The Hushed. They have never come this high.', { pose: 'guard', fn() { SFX.crack(); shake = 0.6; music('battle'); kaito.lock = false; } }],
    ['say', 'kaito', "There are too many. My wind can't reach you from here. Run!"],
    ['say', 'pip', "Rin! Under the quiet again! There's another one!"],
    ['do', () => { rin.eyesShut = true; rin.mode = rin.rest = 'idle'; ringFx(rin.x, 0.1, rin.z, 0.3, 3.4, 1.2, [0.5, 1, 0.85], false); P.burst(30, { x: rin.x, y: 0.3, z: rin.z, c: [0.5, 1, 0.85], s0: 0.25, life: 1.4, g: -3, drag: 1 }, 3, 1); bellSnd(440, 0.2, 2); SFX.gale(); setCam(closeUp(rin, -1, 1.9)); }],
    ['wait', 1.5],
    ['say', 'rin', "I hear it. It's the same wind he uses. It was never only his.", { cam: false }],
    ['do', () => { rin.eyesShut = false; PL.un.gale = true; }],
    ['unlock', 'Tone learned', 'GALE', 'Press <b>L</b> (or the Gale button) to dash through enemies like a blade of wind. You cannot be hurt while you dash.', '#2cc4b0'],
    ['say', 'kaito', 'Two Tones? Nobody hears two...'],
    ['say', 'rin', "Complain later. The left side is yours.", { pose: 'guard' }],
  ],
  c2outro: () => [
    ['do', () => { hideAll(); music('cliffs'); place(kaito, 1.3, 0, -PI / 2); place(rin, -1.3, 0, PI / 2); pip.x = 0; pip.y = 2; pip.z = -1; pipTo(0, 2.1, -1); rin.side = -1; kaito.side = 1; }],
    ['say', 'kaito', 'Two Tones. The masters say that is impossible. One voice for each ear.'],
    ['say', 'rin', 'Maybe I just listen to more than one thing at a time. Master Sato says I never shut up, so it balances.'],
    ['say', 'kaito', 'I was wrong to send you home. I have trained since I was six to be strong enough that nobody would ever need me to listen. I am starting to think I had it backwards.'],
    ['say', 'rin', 'Is that an apology?'],
    ['say', 'kaito', "It's a report. Don't make it strange."],
    ['say', 'pip', 'The Conductor went up. To the Great Chime. The one that holds up all the others.'],
    ['say', 'kaito', "Then that is where we are going. Try to keep up, To... Rin.", { pose: 'proud' }],
  ],
  c3intro: () => [
    ['do', () => { setScene('temple'); hideAll(); music('temple'); place(rin, -1, 5, PI); place(kaito, 1.2, 5.4, PI); pip.x = -1.8; pip.y = 1.9; pip.z = 5; pipTo(-1.8, 1.9, 5); rin.side = -1; kaito.side = 1; setCam(WIDE.temple); const g = drift(WIDE.temple, 0, 1.5, -3); camGoal.pos = g.pos; camGoal.k = 0.08; }],
    ['card', 'Chapter Three', 'The Silent Conductor'],
    ['narr', 'The Great Chime hangs at the top of the sky. If it ever falls silent, every island falls with it.'],
    ['say', 'kaito', 'They are guarding the stairs. Together, then.', { pose: 'guard' }],
    ['say', 'rin', "Together. Try to keep up.", { pose: 'guard' }],
  ],
  c3veyl: () => [
    ['do', () => { hideAll(); music('temple'); place(veyl, 0, -7, 0, 'idle'); veyl.y = 0.4; place(rin, -1, 3, PI); place(kaito, 1.4, 3.6, PI); rin.side = -1; kaito.side = 1; veyl.side = 1; pip.x = -1.8; pip.y = 1.9; pip.z = 3; pipTo(-1.8, 1.9, 3); setCam({ pos: [0, 2, 8], tgt: [0, 3, -8], fov: 42 }); }],
    ['say', 'veyl', 'You came a long way to stop an old man from finishing his work.'],
    ['say', 'rin', "You're killing the islands!"],
    ['say', 'veyl', 'I am ending Dissonance. Do you know what happens to a Tuner who rings too loud for too long? The Tone eats them. My sister Liora heard Tide. She sang a flood away from our village when she was your age.'],
    ['say', 'veyl', 'It took her voice first. Then her name. Then her.'],
    ['say', 'veyl', 'No more Tones. No more Tuners burning themselves away to keep rocks in the air. Silence is kinder.', { pose: 'proud' }],
    ['say', 'rin', 'And everyone who falls with the islands? Is that kind?'],
    ['say', 'veyl', 'They will not hear it coming. That is the only mercy I have left to give.'],
    ['say', 'kaito', "He is not going to stop. Rin, I'll hold the Hushed off. He's yours.", { pose: 'guard' }],
  ],
  c3mid: () => [
    ['do', () => { hideAll(); A.stopMusic(); place(veyl, 0, -5, 0, 'cast'); veyl.y = 0.6; veyl.lock = true; place(rin, 0, 2, PI, 'kneel'); rin.lock = true; place(kaito, 6, 5, PI + 0.6, 'guard'); rin.side = -1; veyl.side = 1; kaito.side = 1; pip.x = 0.6; pip.y = 1; pip.z = 2.5; pipTo(0.6, 0.6, 2.5); SFX.crack(); shake = 0.8; R.fx.flash = 0.6; R.fx.flashCol = [0.4, 0.3, 0.7]; ringFx(0, 0.3, -5, 0.5, 16, 1.2, [0.6, 0.45, 1], true); chimeGlow = 0.15; }],
    ['say', 'veyl', 'Be still.'],
    ['say', 'rin', "I can't... hear anything. Ember's gone. Gale's gone."],
    ['say', 'pip', "Rin... I'm getting... quiet too..."],
    ['narr', '"A bell doesn\'t ring because it is struck hard. It rings because it is hollow enough to listen."'],
    ['say', 'rin', '...Hollow enough to listen. I was never Toneless. I was hearing all of them at once, and calling it nothing.', { fn() { rin.eyesShut = true; } }],
    ['say', 'kaito', 'Rin! Take my wind! All of it!', { pose: 'cast' }],
    ['do', () => { rin.eyesShut = false; rin.lock = false; rin.mode = rin.rest = 'cast'; music('boss'); chimeGlow = 1; R.fx.flash = 0.7; R.fx.flashCol = [1, 0.8, 0.5]; shake = 0.7; ringFx(rin.x, 0.2, rin.z, 0.3, 6, 0.8, [1, 0.6, 0.2], true); ringFx(rin.x, 0.6, rin.z, 0.3, 5, 1.0, [0.5, 1, 0.85], true); P.burst(60, { x: rin.x, y: 0.5, z: rin.z, c: [1, 0.6, 0.2], s0: 0.4, life: 1.2, g: -4, drag: 1.5 }, 8, 3); SFX.chord(); setCam(closeUp(rin, -1, 2.2)); }],
    ['say', 'rin', 'Not instead of mine. With mine.', { cam: false, pose: 'cast' }],
    ['do', () => { PL.un.chord = true; PL.chord = 100; }],
    ['unlock', 'Chord learned', 'FIRESTORM', 'When the <b>Chord</b> gauge is full, press <b>R</b> (or the Chord button). Ember and Gale play together and a storm of fire follows you.<br>Two Tones together are stronger than either alone.', '#f2b84b'],
  ],
  ending: () => [
    ['do', () => { hideAll(); A.stopMusic(); place(veyl, 0, -6, 0, 'kneel'); veyl.lock = true; veyl.y = 0; place(rin, 0, -2.5, PI); place(kaito, 3, 0, PI + 0.5); rin.side = -1; veyl.side = 1; kaito.side = 1; pip.x = -0.8; pip.y = 1.8; pip.z = -2; pipTo(-0.8, 1.8, -2); }],
    ['say', 'veyl', 'Finish it, then. Silence me. It is only fair.'],
    ['say', 'rin', "No. You've had enough quiet."],
    ['do', () => { veyl.vis = true; place(rin, 0, -13, PI, 'atk3'); rin.lock = true; rin.phase = 0; setCam({ pos: [3.5, 2.2, -8], tgt: [0, 5, -19], fov: 46 }); camGoal.pos = [2.5, 2.6, -6.5]; camGoal.k = 0.3; }],
    ['wait', 0.5],
    ['do', () => { rin.phase = 1; bellSnd(98, 0.5, 5); bellSnd(196, 0.35, 5); bellSnd(294, 0.2, 4); R.fx.flash = 1; R.fx.flashCol = [1, 0.95, 0.8]; shake = 0.6; bellFlash = 1; chimeGlow = 1.6; for (let i = 0; i < 4; i++) setTimeout(() => ringFx(0, 5 + i, -19.5, 2, 30, 2.2, [1, 0.9, 0.6], true), i * 250); music('ending'); }],
    ['wait', 2.2],
    ['narr', 'She struck the Great Chime once. Not hard. Just true.'],
    ['do', () => { place(rin, 0, -3, PI); place(veyl, 0, -6, 0, 'kneel'); veyl.lock = true; }],
    ['say', 'veyl', '...That note. That is Tide. That is... Liora?', { fn() { veyl.eyesShut = true; } }],
    ['say', 'rin', "She's in there. All of them are. The Tones don't eat people, Conductor. People hold a note alone until it breaks them. Nobody is supposed to ring alone."],
    ['say', 'veyl', 'Then teach an old man to listen.', { fn() { veyl.eyesShut = false; } }],
    ['say', 'kaito', 'For the record, I held off forty-one Hushed.', { pose: 'proud' }],
    ['say', 'pip', 'Forty! One of them was a rock.'],
    ['do', () => { setCam(WIDE.temple); camGoal.pos = [0, 9, 20]; camGoal.k = 0.08; }],
    ['narr', 'The islands did not fall. In Hollowbell, an old bell-mender heard the evening Chime, and smiled, and put the mallet rack back up.'],
    ['card', 'Chime of Aoren', 'The End'],
  ],
};
const F = {
  c1a: { waves: [[['hushed', 3]], [['hushed', 4]]], music: 'battle', tip: touch ? 'Drag on the left to move. Tap <b>Strike</b> to attack, <b>Dodge</b> to slip away.' : '<b>W A S D</b> to move &nbsp;·&nbsp; <b>J</b> or click to strike &nbsp;·&nbsp; <b>Space</b> to dodge', pz: 4 },
  c1b: { waves: [[['hushed', 4], ['wailer', 1]], [['hushed', 5], ['wailer', 2]], [['hushed', 6], ['wailer', 2]]], music: 'battle', tip: touch ? 'Tap <b>Ember</b> when enemies crowd you.' : 'Press <b>K</b> to ring Ember when enemies crowd you.' },
  c2a: { waves: [[['kaito', 1]]], music: 'boss', mul: 1, label: 'Duel', quiet: true, tip: 'Watch the green marks on the ground. Dodge, then strike while he catches his breath.' },
  c2b: { waves: [[['hushed', 5], ['wailer', 2]], [['hushed', 5], ['wailer', 2], ['brute', 1]], [['hushed', 4], ['wailer', 3], ['brute', 1]]], music: 'battle', mul: 1.25, ally: true, tip: touch ? 'Tap <b>Gale</b> to dash straight through a line of enemies.' : 'Press <b>L</b> to dash straight through a line of enemies.' },
  c3a: { waves: [[['hushed', 6], ['wailer', 2]], [['hushed', 5], ['wailer', 3], ['brute', 1]], [['hushed', 4], ['wailer', 2], ['brute', 2]]], music: 'battle', mul: 1.5, ally: true },
  c3b: { waves: [[['veyl', 1]]], music: 'boss', mul: 1.5, label: 'Boss', quiet: true, pz: 6, tip: 'Violet marks show where his silence will land. Keep moving.' },
  c3c: { waves: [[['veyl', 1]]], music: 'boss', mul: 1.5, label: 'Boss', quiet: true, p2: true, chordFull: true, pz: 4, tip: touch ? 'Your Chord is full. Tap <b>Chord</b>!' : 'Your Chord is full. Press <b>R</b>!' },
};
const save = () => { const s = store.get(skey('aoren_save'), { ch: 1 }); store.set(skey('aoren_save'), { ch: max(s.ch || 1, chapterOf(stage)), level: PL.level, xp: PL.xp, maxHp: PL.maxHp, atk: PL.atk }); };
const FLOW = [
  () => runScript(S.c1intro(), next), () => startFight(F.c1a, next), () => runScript(S.c1ember(), next), () => startFight(F.c1b, next), () => runScript(S.c1outro(), next),
  () => { save(); runScript(S.c2intro(), next); }, () => startFight(F.c2a, next), () => runScript(S.c2mid(), next), () => startFight(F.c2b, next), () => runScript(S.c2outro(), next),
  () => { save(); runScript(S.c3intro(), next); }, () => startFight(F.c3a, next), () => runScript(S.c3veyl(), next), () => startFight(F.c3b, next), () => runScript(S.c3mid(), next), () => startFight(F.c3c, next), () => runScript(S.ending(), next),
  () => { mode = 'end'; show('hud', false); $('bars').classList.remove('on'); $('eLv').textContent = PL.level; $('eKills').textContent = PL.kills; $('eTime').textContent = floor(playTime / 60) + ':' + String(floor(playTime % 60)).padStart(2, '0'); show('endP', true); store.set(skey('aoren_save'), Object.assign(store.get(skey('aoren_save'), {}), { ch: 3, done: true })); },
];
const CH_START = [0, 5, 10], chapterOf = s => s >= 10 ? 3 : s >= 5 ? 2 : 1;
function next() { stage++; FLOW[stage](); }
function beginAt(ch, fresh) {
  A.init(); for (const id of ['title', 'chsel', 'how', 'endP', 'dead', 'pauseP']) show(id, false); paused = false;
  const s = store.get(skey('aoren_save'), {});
  if (fresh) Object.assign(PL, { level: 1, xp: 0, maxHp: 120, atk: 12, kills: 0 }); else Object.assign(PL, { level: max(s.level || 1, ch === 3 ? 4 : ch === 2 ? 2 : 1), xp: s.xp || 0, maxHp: max(s.maxHp || 120, 120 + (ch - 1) * 28), atk: max(s.atk || 12, 12 + (ch - 1) * 4) });
  if (fresh) playTime = 0;
  PL.un = { ember: ch >= 2, gale: ch >= 3, chord: false }; PL.chord = 0; PL.hp = PL.maxHp; setScene(['village', 'cliffs', 'temple'][ch - 1]); chimeGlow = 1; crackOn = ch > 1 ? 1 : 0; bellFlash = 0;
  stage = CH_START[ch - 1]; FLOW[stage]();
}
function toTitle() { mode = 'title'; cs = null; fight = null; enemies = []; shots = []; teles = []; paused = false; for (const id of ['hud', 'story', 'dead', 'pauseP', 'endP', 'chsel', 'how', 'unlock']) show(id, false); $('bars').classList.remove('on'); $('card').classList.remove('on'); show('title', true); setScene('village'); hideAll(); chimeGlow = 1; crackOn = 0; place(rin, 1.25, 2.2, -0.45); pip.x = 2.1; pip.y = 1.8; pip.z = 2.6; pipTo(2.1, 1.8, 2.6); update(0); cam.pos = camGoal.pos.slice(); cam.tgt = camGoal.tgt.slice(); cam.fov = camGoal.fov; const sv = store.get(skey('aoren_save'), null); show('bCont', !!sv && (sv.ch > 1 || sv.done)); music('village'); A.resume(); }

// ═════════════ input ═════════════
const KEYMAP = { j: 'atk', J: 'atk', k: 'ember', K: 'ember', e: 'ember', E: 'ember', l: 'gale', L: 'gale', q: 'gale', Q: 'gale', r: 'chord', R: 'chord', f: 'chord', F: 'chord', Shift: 'dodge', ' ': 'dodge' };
function readKeys() { const k = input.keys; let x = 0, z = 0; if (k.a || k.A || k.ArrowLeft) x -= 1; if (k.d || k.D || k.ArrowRight) x += 1; if (k.w || k.W || k.ArrowUp) z -= 1; if (k.s || k.S || k.ArrowDown) z += 1; if (!stick.on) { input.x = x; input.z = z; } }
addEventListener('keydown', e => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (mode === 'fight' || mode === 'cut') setPaused(!paused); return; }
  if ((e.key === 'm' || e.key === 'M') && !e.repeat) { $('soundBtn').click(); return; }
  if (mode === 'cut') { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); csAdvance(); } return; }
  input.keys[e.key] = true; if (KEYMAP[e.key] && !e.repeat) { e.preventDefault(); act(KEYMAP[e.key]); } if (e.key.startsWith('Arrow')) e.preventDefault(); readKeys();
});
addEventListener('keyup', e => { delete input.keys[e.key]; if (e.key.length === 1) { delete input.keys[e.key.toLowerCase()]; delete input.keys[e.key.toUpperCase()]; } readKeys(); });
addEventListener('blur', () => { input.keys = {}; readKeys(); });
const stick = { on: false, id: -1, ox: 0, oy: 0 };
cv.addEventListener('pointerdown', e => {
  if (mode === 'cut') { csAdvance(); return; }
  if (mode !== 'fight' || paused) return;
  if (e.pointerType === 'mouse') { act('atk'); return; }
  if (e.clientX < innerWidth * 0.55 && !stick.on) { stick.on = true; stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; const s = $('stick'); s.hidden = false; s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px'; s.firstElementChild.style.transform = ''; try { cv.setPointerCapture(e.pointerId); } catch (er) { } }
  else act('atk');
});
cv.addEventListener('pointermove', e => { if (!stick.on || e.pointerId !== stick.id) return; let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const m = hypot(dx, dy), lim = 52; if (m > lim) { dx *= lim / m; dy *= lim / m; } input.x = dx / lim; input.z = dy / lim; $('stick').firstElementChild.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; });
const stickEnd = e => { if (stick.on && e.pointerId === stick.id) { stick.on = false; input.x = 0; input.z = 0; $('stick').hidden = true; } };
cv.addEventListener('pointerup', stickEnd); cv.addEventListener('pointercancel', stickEnd);
for (const [id, n] of [['skAtk', 'atk'], ['skDodge', 'dodge'], ['skEmber', 'ember'], ['skGale', 'gale'], ['skChord', 'chord']]) $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); act(n); });
$('dlg').addEventListener('click', csAdvance); $('unlock').addEventListener('click', csAdvance); $('skip').addEventListener('click', e => { e.stopPropagation(); csSkip(); });
function setPaused(p) { if (mode !== 'fight' && mode !== 'cut') return; paused = p; show('pauseP', p); if (p) A.suspend(); else A.resume(); }
$('pauseBtn').addEventListener('click', () => setPaused(true)); $('bResume').addEventListener('click', () => setPaused(false));
$('soundBtn').addEventListener('click', () => { A.init(); A.mute(!A.muted); $('soundBtn').classList.toggle('off', A.muted); $('soundBtn').setAttribute('aria-pressed', String(!A.muted)); });
$('bNew').addEventListener('click', () => beginAt(1, true));
$('bCont').addEventListener('click', () => { const s = store.get(skey('aoren_save'), { ch: 1 }), L = $('chList'); L.textContent = ''; [['Chapter One', 'The Cracked Chime'], ['Chapter Two', 'Windward'], ['Chapter Three', 'The Silent Conductor']].forEach(([k, t], i) => { const b = document.createElement('button'); b.innerHTML = '<span>' + t + '</span><small>' + k + '</small>'; b.disabled = i + 1 > (s.ch || 1); b.addEventListener('click', () => beginAt(i + 1, false)); L.appendChild(b); }); show('title', false); show('endP', false); show('chsel', true); });
$('bChBack').addEventListener('click', toTitle); $('bHow').addEventListener('click', () => { show('title', false); show('how', true); }); $('bHowBack').addEventListener('click', () => { show('how', false); show('title', true); });
$('bRetry').addEventListener('click', () => { show('dead', false); const d = fight ? fight.def : null; if (d) { const od = fight.onDone; A.resume(); startFight(d, od); } else toTitle(); });
$('bQuit').addEventListener('click', toTitle); $('bQuit2').addEventListener('click', toTitle); $('bAgain').addEventListener('click', () => beginAt(1, true)); $('bEndCh').addEventListener('click', () => $('bCont').click());
document.addEventListener('visibilitychange', () => { if (document.hidden && (mode === 'fight')) setPaused(true); });

// ═════════════ frame ═════════════
function update(rdt) {
  time += rdt; if (paused) return;
  if (mode === 'fight' || mode === 'cut') playTime += rdt;
  let dt = rdt; if (freeze > 0) { freeze -= rdt; dt = rdt * 0.03; }
  shake = max(0, shake - rdt * 1.8); R.fx.flash = max(0, R.fx.flash - rdt * 2); R.fx.aberr = damp(R.fx.aberr, 0, 4, rdt); hurtFx = max(0, hurtFx - rdt * 1.6); $('hurt').style.opacity = (hurtFx * 0.8 + (mode === 'fight' && PL.hp < PL.maxHp * 0.25 ? 0.25 + 0.1 * sin(time * 6) : 0)).toFixed(2);
  R.fx.lines = damp(R.fx.lines, (PL.storm > 0 && mode === 'fight') ? 0.4 : (PL.state === 'dash' ? 0.5 : freeze > 0.3 ? 0.7 : 0), 8, rdt);
  bellFlash = max(0, bellFlash - rdt * 0.4);
  if (tipT > 0) { tipT -= rdt; if (tipT <= 0) $('tip').classList.remove('on'); }
  if (toastT > 0) { toastT -= rdt; if (toastT <= 0) $('toast').classList.remove('on'); }
  if (mode === 'fight') {
    if (window.__aoren.bot) window.__aoren.bot();
    playerUpdate(dt); for (const e of enemies) if (!e.dead) enemyUpdate(e, dt);
    // keep enemies from stacking
    for (let i = 0; i < enemies.length; i++) { const a = enemies[i]; if (a.dead || a.boss) continue; for (let j = i + 1; j < enemies.length; j++) { const b = enemies[j]; if (b.dead || b.boss) continue; const dx = b.x - a.x, dz = b.z - a.z, d = hypot(dx, dz) || 0.01, mn = a.r + b.r + 0.25; if (d < mn) { const p = (mn - d) / 2 / d; a.x -= dx * p; a.z -= dz * p; b.x += dx * p; b.z += dz * p; } } const dx = a.x - rin.x, dz = a.z - rin.z, d = hypot(dx, dz) || 0.01, mn = a.r + 0.45; if (d < mn && PL.state !== 'dash' && PL.state !== 'dodge') { a.x += dx / d * (mn - d); a.z += dz / d * (mn - d); } }
    if (ally) allyUpdate(dt);
    for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; s.life -= dt; s.x += s.vx * dt; s.z += s.vz * dt; if (Math.random() < 0.6) P.spawn({ x: s.x, y: s.y, z: s.z, c: s.c, s0: s.r * 0.9, life: 0.3 }); if (s.life > 0 && hypot(s.x - rin.x, s.z - rin.z) < s.r + 0.45) { if (hurtPlayer(s.dmg, s.vx / 8, s.vz / 8) || PL.inv <= 0) s.life = 0; } if (s.life <= 0 || hypot(s.x, s.z) > 24) shots.splice(i, 1); }
    for (let i = teles.length - 1; i >= 0; i--) { const t = teles[i]; t.t += dt; if (t.own && (t.own.dead || t.own.stun > 0 && false)) { teles.splice(i, 1); continue; } if (t.t >= t.dur) { teles.splice(i, 1); if (t.fire) t.fire(); } }
    enemies = enemies.filter(e => !e.dead || e.boss);
    if (fight) fightUpdate(dt);
  }
  if (mode === 'fight') {   // checked again: the fight may just have handed over to a story scene
    const pf = clamp((1 - R.w / R.h) / 0.55, 0, 1), lead = nearest(rin.x, rin.z, 12), lx = lead ? (lead.x - rin.x) * 0.12 : 0, lz = lead ? (lead.z - rin.z) * 0.12 : 0;
    camGoal.pos = [rin.x * 0.84 + lx, 6.7 + pf * 4.6, rin.z + 8.2 + pf * 4.2 + lz]; camGoal.tgt = [rin.x + lx, 0.9, rin.z - 1.3 + lz]; camGoal.fov = 47 + pf * 9 + (PL.storm > 0 ? 3 : 0); camGoal.k = 5;
    hudRefresh();
  } else if (mode === 'cut') csUpdate(rdt);
  else if (mode === 'title' || mode === 'end') { const a = sin(time * 0.13), pf = clamp((1 - R.w / R.h) / 0.55, 0, 1); camGoal.pos = [-0.4 + a * 0.8 + pf * 1.9, 1.55, 6.7 + pf * 1.9]; camGoal.tgt = [0.5 + pf * 1.0, 1.95 - pf * 1.15, -4]; camGoal.fov = 40 + pf * 10; camGoal.k = 1.2; }
  else if (mode === 'dead') { rin.mode = 'dead'; }
  for (let i = fx.length - 1; i >= 0; i--) { fx[i].t += dt; if (fx[i].t >= fx[i].dur) fx.splice(i, 1); }
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.t += rdt; f.y += rdt * 1.5; const p = R.project([f.x, f.y, f.z]), k = f.t / 0.85; if (k >= 1 || mode !== 'fight') { f.el.remove(); floats.splice(i, 1); continue; } f.el.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px) translate(-50%,-50%) scale(' + (k < 0.15 ? 0.6 + k * 4 : 1.2 - k * 0.2).toFixed(2) + ')'; f.el.style.opacity = (k > 0.6 ? (1 - k) / 0.4 : 1).toFixed(2); }
  // Pip floats near Rin in fights, or where the scene puts it
  if (mode === 'fight') { pip.vis = PL.un.ember; pip.tx = rin.x - 0.9; pip.ty = 1.9; pip.tz = rin.z + 0.5; }
  pip.x = damp(pip.x, pip.tx, 3.5, rdt); pip.y = damp(pip.y, pip.ty + sin(time * 3) * 0.1, 4, rdt); pip.z = damp(pip.z, pip.tz, 3.5, rdt);
  if (pip.vis && Math.random() < 0.3) P.spawn({ x: pip.x + rand(-0.1, 0.1), y: pip.y - 0.15, z: pip.z + rand(-0.1, 0.1), vy: -0.4, c: [1, 0.85, 0.4], s0: 0.09, life: 0.6, shape: 2 });
  // ambience
  if (Math.random() < 0.35) { const pc = scene.petals; if (sceneName === 'temple') P.spawn({ x: rand(-16, 16), y: rand(0.3, 7), z: rand(-18, 10), vy: rand(0.2, 0.6), c: pc, s0: 0.1, life: 3 }); else P.spawn({ x: cam.tgt[0] + rand(-14, 14), y: rand(1.5, 4.6), z: cam.tgt[2] + rand(-14, 3), vx: sceneName === 'cliffs' ? rand(2.5, 4) : rand(0.4, 1), vy: -rand(0.3, 0.8), c: pc, s0: sceneName === 'cliffs' ? 0.045 : 0.07, life: 4, shape: 1, add: false, a: 0.85 }); }
  P.update(dt);
  const ck = 1 - exp(-camGoal.k * rdt); for (let i = 0; i < 3; i++) { cam.pos[i] += (camGoal.pos[i] - cam.pos[i]) * ck; cam.tgt[i] += (camGoal.tgt[i] - cam.tgt[i]) * ck; } cam.fov += (camGoal.fov - cam.fov) * ck;
  R.cam.pos = [cam.pos[0] + (Math.random() - 0.5) * shake * 0.5, cam.pos[1] + (Math.random() - 0.5) * shake * 0.5, cam.pos[2]]; R.cam.tgt = cam.tgt; R.cam.fov = cam.fov; R.cam.far = 420; R.cam.near = 0.3;
  return dt;
}
function drawActor(a, dt) {
  if (!a.vis) return; const h = a.h, s = (h.baseS || (h.baseS = h.root.s[0])) * (a.sc === undefined ? 1 : a.sc);
  h.root.p[0] = a.x; h.root.p[1] = a.y; h.root.p[2] = a.z; h.root.r[1] = a.yaw; h.root.s[0] = h.root.s[2] = h.baseS * (0.4 + 0.6 * (a.sc === undefined ? 1 : a.sc)); h.root.s[1] = s;
  if (a.weapon) { a.weapon.visible = mode !== 'cut' || /guard|atk|cast|hit|run/.test(a.mode); a.weapon.r[0] = mode === 'title' ? -2.55 : -1.0; }
  E.animateHumanoid(h, dt, { mode: a.mode, t: time, cycle: a.cycle, phase: a.phase, over: (a.mode === 'idle' || a.mode === 'run' || a.mode === 'talk') ? a.over : null, look: a.look, eyesShut: a.eyesShut });
  h.root.update(null); if (s > 0.05) h.root.draw(R, { flash: a.flash });
  M4.trs(tm, [a.x, 0.05, a.z], [0, 0, 0], [0.5 * h.baseS, 1, 0.5 * h.baseS]); R.draw(MS.shadow, tm, { unlit: true, alpha: 0.3 * (a.sc === undefined ? 1 : a.sc), tint: [0.08, 0.04, 0.16] });
}
function drawEnemy(e) {
  if (e.type === 'kaito' || e.type === 'veyl') return;
  const g = RIG[e.type], sc = e.state === 'spawn' ? E.ease(min(1, e.t / 0.55)) : 1, wind = e.state === 'wind' ? min(1, e.t / 0.5) : 0, big = e.type === 'brute';
  g.root.p[0] = e.x; g.root.p[1] = (big ? 0 : 0.12 + sin(time * 3 + e.seed) * 0.08); g.root.p[2] = e.z; g.root.r[1] = e.yaw; g.root.s = [sc, sc * (1 + (e.stun > 0 ? -0.12 : 0) + wind * 0.08), sc];
  g.b.r[0] = e.state === 'strike' ? 0.5 : -wind * 0.3; g.b.r[2] = sin(time * 2.2 + e.seed) * 0.06;
  const hy = big ? 1.1 : e.type === 'wailer' ? 1.1 : 0.7, hx = big ? 1.25 : 0.62, raise = wind * (big ? 1.5 : 0.7), sw = e.state === 'strike' ? 0.7 : 0;
  g.hL.p = [hx, hy + raise + sin(time * 4 + e.seed) * 0.06, 0.15 + sw]; g.hR.p = [-hx, hy + raise + cos(time * 4 + e.seed) * 0.06, 0.15 + sw];
  g.mn.emis = wind > 0 ? [0.9 * wind, 0.1, 0.25 * wind] : null;
  g.root.update(null); g.root.draw(R, { flash: e.flash });
  M4.trs(tm, [e.x, 0.05, e.z], [0, 0, 0], [e.r * 1.3 * sc, 1, e.r * 1.3 * sc]); R.draw(MS.shadow, tm, { unlit: true, alpha: 0.3, tint: [0.08, 0.04, 0.16] });
  if (e.hp < e.max) { const y = big ? 2.9 : e.type === 'wailer' ? 2.5 : 1.75, w = big ? 1.6 : 0.9, f = clamp(e.hp / e.max, 0, 1); M4.trs(tm, [e.x, y, e.z], [-0.5, 0, 0], [w, 0.09, 0.02]); R.draw(MS.unit, tm, { unlit: true, tint: [0.1, 0.07, 0.18], outline: false }); M4.trs(tm, [e.x - w * (1 - f) / 2, y, e.z + 0.02], [-0.5, 0, 0], [w * f, 0.065, 0.02]); R.draw(MS.unit, tm, { unlit: true, tint: [1, 0.4, 0.5], outline: false }); }
}
function render(dt) {
  let env = scene.env;
  if (mode === 'cut' || mode === 'title' || mode === 'end') { // a key light from over the camera's left shoulder, so faces read clearly
    const fx_ = cam.tgt[0] - cam.pos[0], fz_ = cam.tgt[2] - cam.pos[2], l = hypot(fx_, fz_) || 1, f = [fx_ / l, fz_ / l]; env = Object.assign({}, env, { lightDir: norm([-f[0] * 0.55 + f[1] * 0.42, 0.62, -f[1] * 0.55 - f[0] * 0.42]) }); }
  R.begin(env, dt);
  R.draw(scene.mesh, ID); R.draw(scene.flat, ID, { outline: false });
  const pulse = 0.75 + 0.25 * sin(time * 2), ge = scene.glowE;
  R.draw(scene.glow, ID, { unlit: true, emis: mul3(ge, pulse * (sceneName === 'temple' ? max(0.2, chimeGlow) : 1) + bellFlash), outline: false });
  if (scene.crack && crackOn) R.draw(scene.crack, ID, { unlit: true, tint: [0.6, 0.35, 1], emis: [0.25 + 0.15 * pulse, 0.1, 0.5], outline: false });
  if (scene.mills) for (const m of scene.mills) { m.nd.r[2] = time * m.sp; m.nd.update(null); m.nd.draw(R); }
  if (scene.flags) for (const f of scene.flags) { f.r[1] = -0.5 + sin(time * 4 + f.p[0]) * 0.25; f.r[0] = sin(time * 6.3) * 0.06; f.update(null); f.draw(R); }
  for (const a of [rin, kaito, sato, veyl]) drawActor(a, dt);
  if (pip.vis) { M4.trs(tm, [pip.x, pip.y, pip.z], [sin(time * 2.4) * 0.15, atan2(cam.pos[0] - pip.x, cam.pos[2] - pip.z), sin(time * 3.3) * 0.2], [1, 1, 1]); R.draw(MS.pip, tm, { unlit: true, outline: 0.011, emis: [0.1, 0.07, 0] }); R.draw(MS.pipFace, tm, { unlit: true, outline: false }); }
  for (const e of enemies) if (!e.dead) drawEnemy(e);
  if (mode === 'fight') { const t = nearest(rin.x, rin.z, 7); if (t && !t.boss) { const s = t.r + 0.45; M4.trs(tm, [t.x, 0.08, t.z], [0, time * 2, 0], [s, 1, s]); R.draw(MS.ring, tm, { unlit: true, additive: true, alpha: 0.7, tint: [1, 0.8, 0.4] }); } }
  for (const s of shots) { if (s.kind === 'blade') { M4.trs(tm, [s.x, s.y, s.z], [0.3, s.yaw, 0], [1.2, 1.2, 1.2]); R.draw(MS.blade, tm, { unlit: true, additive: true, alpha: 0.95, tint: s.c, two: true }); } else { const k = s.r * (1 + 0.15 * sin(time * 20)); M4.trs(tm, [s.x, s.y, s.z], [0, 0, 0], [k, k, k]); R.draw(MS.ball, tm, { unlit: true, tint: [1, 0.9, 1], emis: mul3(s.c, 0.4), outline: false }); M4.trs(tm, [s.x, 0.05, s.z], [0, 0, 0], [s.r * 1.2, 1, s.r * 1.2]); R.draw(MS.disc, tm, { unlit: true, alpha: 0.35, tint: s.c }); } }
  for (const t of teles) {
    const k = t.t / t.dur, c = t.col;
    if (t.k === 'circle') { M4.trs(tm, [t.x, 0.06, t.z], [0, 0, 0], [t.r, 1, t.r]); R.draw(MS.disc, tm, { unlit: true, alpha: 0.16, tint: c }); R.draw(MS.ring, tm, { unlit: true, additive: true, alpha: 0.9, tint: c }); M4.trs(tm, [t.x, 0.075, t.z], [0, 0, 0], [t.r * k, 1, t.r * k]); R.draw(MS.disc, tm, { unlit: true, alpha: 0.3, tint: c }); }
    else { M4.trs(tm, [t.x + sin(t.yaw) * t.len / 2, 0.06, t.z + cos(t.yaw) * t.len / 2], [0, t.yaw, 0], [t.w, 0.01, t.len]); R.draw(MS.unit, tm, { unlit: true, alpha: 0.18, tint: c }); M4.trs(tm, [t.x + sin(t.yaw) * t.len / 2, 0.08, t.z + cos(t.yaw) * t.len / 2], [0, t.yaw, 0], [t.w * k, 0.01, t.len]); R.draw(MS.unit, tm, { unlit: true, alpha: 0.32, tint: c }); }
  }
  for (const f of fx) {
    const k = f.t / f.dur;
    if (f.k === 'ring') { const r = lerp(f.r0, f.r1, 1 - (1 - k) * (1 - k)); M4.trs(tm, [f.x, f.y, f.z], [0, 0, 0], [r, 1 + (f.fat ? 2 : 0), r]); R.draw(f.fat ? MS.ringFat : MS.ring, tm, { unlit: true, additive: true, alpha: (1 - k), tint: f.c }); }
    else if (f.k === 'slash') { const s = f.s * (0.85 + k * 0.3); M4.trs(tm, [f.x, f.y, f.z], [f.tilt, f.yaw + (k - 0.5) * (f.big ? 1.2 : 0.7), 0], [s, s, s]); R.draw(f.big ? MS.slashBig : MS.slash, tm, { unlit: true, additive: true, alpha: (1 - k) * 0.95, tint: f.c, two: true }); }
    else if (f.k === 'beam') { M4.trs(tm, [f.x + sin(f.yaw) * f.len / 2, 1.0, f.z + cos(f.yaw) * f.len / 2], [0, f.yaw, 0], [f.w * (1 - k * 0.7), 1.4 * (1 - k * 0.5), f.len]); R.draw(MS.unit, tm, { unlit: true, additive: true, alpha: 1 - k, tint: [0.85, 0.65, 1] }); }
  }
  R.end(P);
}
toTitle();
window.__aoren = { beginAt, csAdvance, csSkip, act, PL, input, rin, fast: 1, get playTime() { return playTime; }, get tris() { const o = {}; for (const k in SCENES) o[k] = Math.round((SCENES[k].mesh.count + SCENES[k].glow.count + SCENES[k].flat.count) / 3); return o; }, get shots() { return shots; }, get teles() { return teles; }, get mode() { return mode; }, get stage() { return stage; }, get enemies() { return enemies; }, get cs() { return cs; }, killAll() { for (const e of enemies) if (!e.dead) { e.hp = 1; damage(e, 99999, 0, 0, true); } }, god(v) { PL.godMode = v; }, go(s) { for (const id of ['title', 'chsel', 'how', 'endP', 'dead']) show(id, false); A.init(); stage = s; FLOW[s](); } };
E.loop(dt => { let d; const n = window.__aoren.fast; for (let i = 0; i < n; i++) d = update(n > 1 ? 0.033 : dt); render(d === undefined ? 0 : d); });
})();
