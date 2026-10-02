// Aurora Racers — builds the 3D world for a track: road, curbs, walls, terrain, props and themed scenery.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TrackSpace, SHOULDER, RAMP_LEN, RAMP_H, type ThemeId } from "./tracks";

export type Quality = "low" | "medium" | "high";

interface ThemeLook {
  skyTop: number; skyHorizon: number; fog: number; fogNear: number; fogFar: number;
  sun: number; sunIntensity: number; hemiSky: number; hemiGround: number; hemiIntensity: number;
  ground: number; ground2: number; shoulder: number; night: boolean; exposure: number;
}

export const THEMES: Record<ThemeId, ThemeLook> = {
  shores: { skyTop: 0x2f8fe6, skyHorizon: 0xcdeffd, fog: 0xcfeefc, fogNear: 140, fogFar: 700, sun: 0xfff1d6, sunIntensity: 3.2, hemiSky: 0xd7efff, hemiGround: 0xc9b07a, hemiIntensity: 1.2, ground: 0xe9d29a, ground2: 0x6cc24a, shoulder: 0xf0dca8, night: false, exposure: 1.0 },
  books: { skyTop: 0xf3a65f, skyHorizon: 0xffe2b8, fog: 0xffe0bd, fogNear: 120, fogFar: 650, sun: 0xffd6a0, sunIntensity: 3.0, hemiSky: 0xffe6c4, hemiGround: 0x8a6a4a, hemiIntensity: 1.15, ground: 0xc9a273, ground2: 0xb3875a, shoulder: 0xe9dcc0, night: false, exposure: 1.0 },
  neon: { skyTop: 0x05031a, skyHorizon: 0x2a1252, fog: 0x1b0d3a, fogNear: 90, fogFar: 520, sun: 0x9fb4ff, sunIntensity: 0.9, hemiSky: 0x5b5bd6, hemiGround: 0x1a1030, hemiIntensity: 0.9, ground: 0x15152a, ground2: 0x1d1d38, shoulder: 0x26264a, night: true, exposure: 1.1 },
  frost: { skyTop: 0x5d9ce6, skyHorizon: 0xe8f3ff, fog: 0xe6f1fb, fogNear: 110, fogFar: 600, sun: 0xffffff, sunIntensity: 3.0, hemiSky: 0xeaf4ff, hemiGround: 0xb9c7d6, hemiIntensity: 1.25, ground: 0xf4f8fc, ground2: 0xdbe7f2, shoulder: 0xf7fbff, night: false, exposure: 0.95 },
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

let seed = 1;
function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
function hash2(x: number, y: number) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, o = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += noise(x * f, y * f) * a; n += a; a *= 0.5; f *= 2; } return s / n; }

function roadTexture(theme: ThemeId) {
  return canvasTex(512, 512, (ctx) => {
    const base = theme === "books" ? "#efe3c6" : theme === "neon" ? "#1d1e2e" : theme === "frost" ? "#5b6676" : "#4a4d55";
    ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 512);
    const img = ctx.getImageData(0, 0, 512, 512);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * (theme === "books" ? 14 : 26);
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    if (theme === "books") {
      // printed lines like a giant page
      ctx.fillStyle = "rgba(60,45,30,0.35)";
      for (let y = 20; y < 512; y += 26) for (let x = 60; x < 452; x += 6 + Math.random() * 30) { const w = 8 + Math.random() * 30; ctx.fillRect(x, y, w, 5); x += w; }
    }
    // edge lines (u = 0..1 across the road)
    const edge = theme === "neon" ? "#22d3ee" : theme === "books" ? "#b4542f" : "#f8fafc";
    ctx.fillStyle = edge; ctx.fillRect(14, 0, 12, 512); ctx.fillRect(486, 0, 12, 512);
    if (theme === "neon") { ctx.fillStyle = "#f0479a"; ctx.fillRect(30, 0, 4, 512); ctx.fillRect(478, 0, 4, 512); }
    // dashed centre line
    ctx.fillStyle = theme === "books" ? "rgba(180,84,47,0.7)" : theme === "neon" ? "rgba(250,204,21,0.8)" : "rgba(250,250,250,0.75)";
    ctx.fillRect(250, 0, 12, 200); ctx.fillRect(250, 300, 12, 160);
    // tire marks
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    for (const x of [150, 340]) ctx.fillRect(x, 0, 26, 512);
  });
}

function groundTexture(theme: ThemeId) {
  return canvasTex(256, 256, (ctx) => {
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const n = noise(x / 9, y / 9) * 0.6 + noise(x / 2.5, y / 2.5) * 0.4;
      const v = 0.82 + n * 0.3;
      const i = (y * 256 + x) * 4;
      img.data[i] = 255 * v; img.data[i + 1] = 255 * v; img.data[i + 2] = 255 * v; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    if (theme === "shores" || theme === "books") {
      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      for (let i = 0; i < 400; i++) { const x = Math.random() * 256, y = Math.random() * 256; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 6); ctx.stroke(); }
    }
  });
}

function checkerTexture() {
  return canvasTex(256, 64, (ctx) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { ctx.fillStyle = (x + y) % 2 ? "#111" : "#fafafa"; ctx.fillRect(x * 16, y * 16, 16, 16); }
  }, false);
}

function boostTexture() {
  return canvasTex(128, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#ff7a00"); g.addColorStop(1, "#ffd400");
    ctx.fillStyle = "#3a1d00"; ctx.fillRect(0, 0, 128, 256);
    ctx.fillStyle = g;
    for (let i = 0; i < 3; i++) {
      const y = 20 + i * 80;
      ctx.beginPath(); ctx.moveTo(14, y + 60); ctx.lineTo(64, y); ctx.lineTo(114, y + 60); ctx.lineTo(114, y + 78); ctx.lineTo(64, y + 22); ctx.lineTo(14, y + 78); ctx.closePath(); ctx.fill();
    }
  });
}

function itemBoxTexture() {
  return canvasTex(128, 128, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 128, 128);
    g.addColorStop(0, "rgba(255,90,170,0.85)"); g.addColorStop(0.5, "rgba(120,200,255,0.85)"); g.addColorStop(1, "rgba(255,230,90,0.85)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 120, 120);
    ctx.font = "900 84px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 6; ctx.strokeStyle = "rgba(60,0,80,0.6)"; ctx.strokeText("?", 64, 70);
    ctx.fillStyle = "#ffffff"; ctx.fillText("?", 64, 70);
  }, false);
}

function windowTexture(colorA: string, colorB: string) {
  return canvasTex(128, 256, (ctx) => {
    ctx.fillStyle = "#0b0b1a"; ctx.fillRect(0, 0, 128, 256);
    for (let y = 6; y < 256; y += 14) for (let x = 6; x < 128; x += 14) {
      const r = Math.random();
      ctx.fillStyle = r < 0.45 ? "#14142a" : r < 0.75 ? colorA : colorB;
      ctx.fillRect(x, y, 9, 9);
    }
  });
}

function bookCoverTexture() {
  // atlas of book spines/covers; tinted per instance
  return canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(0, 30, 256, 14); ctx.fillRect(0, 212, 256, 14);
    ctx.fillStyle = "rgba(255,230,150,0.9)"; ctx.fillRect(0, 36, 256, 3); ctx.fillRect(0, 218, 256, 3);
    ctx.font = "900 34px Georgia, serif"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,240,200,0.9)";
    ctx.fillText("ARISE", 128, 120); ctx.font = "italic 22px Georgia, serif"; ctx.fillText("Volume", 128, 160);
  }, false);
}

// ---------------------------------------------------------------------------
// builder
// ---------------------------------------------------------------------------

export interface BuiltTrack {
  group: THREE.Group;
  sun: THREE.DirectionalLight;
  update: (dt: number, t: number) => void;
  itemBoxes: { pos: THREE.Vector3; mesh: THREE.Object3D; respawn: number }[];
  coins: { pos: THREE.Vector3; mesh: THREE.Object3D; taken: boolean; respawn: number }[];
  boostPads: { s: number; lat: number }[];
  startLights: THREE.Mesh[];
  dispose: () => void;
}

export function buildTrack(scene: THREE.Scene, renderer: THREE.WebGLRenderer, track: TrackSpace, quality: Quality): BuiltTrack {
  seed = 12345 + track.def.id.length * 999;
  const theme = track.def.theme;
  const look = THEMES[theme];
  const group = new THREE.Group();
  scene.add(group);
  const disposables: { dispose(): void }[] = [];
  const updaters: ((dt: number, t: number) => void)[] = [];
  const S = track.samples, N = S.length, half = track.half, limit = track.limit;
  const shadows = quality !== "low";

  // ---------------- sky & lights ----------------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(look.skyTop) }, horizon: { value: new THREE.Color(look.skyHorizon) }, night: { value: look.night ? 1 : 0 } },
    vertexShader: "varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform float night; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      void main(){ float y = clamp(vD.y, 0.0, 1.0); vec3 c = mix(horizon, top, pow(y, 0.6));
        if (night > 0.5) { vec3 q = floor(vD * 420.0); float st = step(0.9965, h(q)) * smoothstep(0.05, 0.4, vD.y); c += vec3(st); }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), skyMat);
  sky.frustumCulled = false;
  group.add(sky);
  disposables.push(skyMat, sky.geometry);
  scene.background = new THREE.Color(look.skyHorizon);
  scene.fog = new THREE.Fog(look.fog, look.fogNear, look.fogFar);
  const hemi = new THREE.HemisphereLight(look.hemiSky, look.hemiGround, look.hemiIntensity);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(look.sun, look.sunIntensity);
  sun.castShadow = shadows;
  if (shadows) {
    const sz = quality === "high" ? 4096 : 2048;
    sun.shadow.mapSize.set(sz, sz);
    const e = 60;
    Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 5, far: 260 });
    sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04;
  }
  group.add(sun, sun.target);
  // moon/sun disc
  const discMat = new THREE.MeshBasicMaterial({ color: look.night ? 0xe8ecff : 0xfff6dc, fog: false, toneMapped: false });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(look.night ? 36 : 44, 32), discMat);
  disc.position.set(-500, look.night ? 380 : 520, -700); disc.lookAt(0, 0, 0);
  group.add(disc);
  disposables.push(discMat, disc.geometry);

  // pmrem environment for glossy bits
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(5, 16, 8), skyMat));
  const env = pmrem.fromScene(envScene, 0.04);
  scene.environment = env.texture;
  scene.environmentIntensity = look.night ? 0.35 : 0.55;
  disposables.push(env, pmrem);

  // ---------------- road ----------------
  const across = 8;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const smp = S[i % N];
    const sDist = i === N ? track.length : smp.s;
    for (let k = 0; k <= across; k++) {
      const lat = -half + (2 * half * k) / across;
      const rh = track.rampHeight(sDist % track.length);
      const y = smp.p.y + Math.tan(smp.bank) * lat + rh + 0.02;
      pos.push(smp.p.x + smp.n.x * lat, y, smp.p.z + smp.n.z * lat);
      uv.push(k / across, sDist / (track.def.width * 1.2));
    }
  }
  const row = across + 1;
  for (let i = 0; i < N; i++) for (let k = 0; k < across; k++) {
    const a = i * row + k, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, b, c, b, d, c); // counter-clockwise from above (faces up)
  }
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  roadGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  roadGeo.setIndex(idx);
  roadGeo.computeVertexNormals();
  const roadTex = roadTexture(theme);
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: theme === "frost" ? 0.35 : theme === "neon" ? 0.45 : 0.82, metalness: 0.02 });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.receiveShadow = true;
  group.add(road);
  disposables.push(roadGeo, roadTex, roadMat);

  // ---------------- shoulders (strip from road edge to wall) ----------------
  const groundTex = groundTexture(theme);
  const shoulderMat = new THREE.MeshStandardMaterial({ color: look.shoulder, map: groundTex, roughness: 0.95 });
  disposables.push(groundTex, shoulderMat);
  for (const side of [-1, 1]) {
    const sp: number[] = [], su: number[] = [], si: number[] = [];
    for (let i = 0; i <= N; i++) {
      const smp = S[i % N];
      const edgeY = smp.p.y + Math.tan(smp.bank) * half * side;
      for (const [lat, dy] of [[half * side, 0.0], [(limit + 1.5) * side, -0.15]] as [number, number][]) {
        sp.push(smp.p.x + smp.n.x * lat, edgeY + dy, smp.p.z + smp.n.z * lat);
        su.push(lat / 4, (i === N ? track.length : smp.s) / 4);
      }
    }
    for (let i = 0; i < N; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; if (side > 0) si.push(a, b, c, b, d, c); else si.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(su, 2));
    g.setIndex(si); g.computeVertexNormals();
    const m = new THREE.Mesh(g, shoulderMat); m.receiveShadow = true; group.add(m);
    disposables.push(g);
  }

  // ---------------- curbs on tight corners ----------------
  const curbParts: THREE.BufferGeometry[] = [];
  const curbColors: number[] = [];
  for (let i = 0; i < N; i++) {
    const smp = S[i];
    if (Math.abs(smp.curv) < 0.011) continue;
    const insideSide = smp.curv > 0 ? 1 : -1; // positive curvature turns toward +n
    for (const side of [insideSide, -insideSide]) {
      const lat = (half + 0.55) * side;
      const p = new THREE.Vector3(smp.p.x + smp.n.x * lat, smp.p.y + Math.tan(smp.bank) * half * side + 0.06, smp.p.z + smp.n.z * lat);
      const g = new THREE.BoxGeometry(1.1, 0.14, 1.6);
      const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), smp.t, new THREE.Vector3(0, 1, 0));
      m.setPosition(p);
      g.applyMatrix4(m);
      curbParts.push(g);
      const c = Math.floor(smp.s / 1.6) % 2 ? new THREE.Color(theme === "neon" ? 0xf0479a : 0xe11d48) : new THREE.Color(0xf8fafc);
      for (let v = 0; v < g.getAttribute("position").count; v++) curbColors.push(c.r, c.g, c.b);
    }
  }
  if (curbParts.length) {
    const curbGeo = mergeGeometries(curbParts.map((g) => { g.deleteAttribute("uv"); return g; }))!;
    curbParts.forEach((g) => g.dispose());
    curbGeo.setAttribute("color", new THREE.Float32BufferAttribute(curbColors, 3));
    const curbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    const curbs = new THREE.Mesh(curbGeo, curbMat); curbs.receiveShadow = true; curbs.castShadow = shadows;
    group.add(curbs);
    disposables.push(curbGeo, curbMat);
  }

  // ---------------- barrier walls ----------------
  const wallTex = canvasTex(256, 64, (ctx) => {
    if (theme === "neon") { ctx.fillStyle = "#0e0e22"; ctx.fillRect(0, 0, 256, 64); ctx.fillStyle = "#22d3ee"; ctx.fillRect(0, 6, 256, 6); ctx.fillStyle = "#f0479a"; ctx.fillRect(0, 50, 256, 6); }
    else if (theme === "books") { const cols = ["#c2410c", "#1d4ed8", "#15803d", "#7c3aed", "#b91c1c", "#0f766e", "#a16207"]; for (let i = 0; i < 16; i++) { ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(i * 16, 0, 15, 64); ctx.fillStyle = "rgba(255,230,160,.8)"; ctx.fillRect(i * 16, 10, 15, 3); ctx.fillRect(i * 16, 50, 15, 3); } }
    else if (theme === "frost") { ctx.fillStyle = "#e0f2fe"; ctx.fillRect(0, 0, 256, 64); for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#1d4ed8" : "#f8fafc"; ctx.fillRect(i * 32, 0, 32, 24); } }
    else { for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#e11d48" : "#f8fafc"; ctx.fillRect(i * 32, 0, 32, 64); } ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.fillRect(0, 56, 256, 8); }
  });
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.6, emissive: theme === "neon" ? 0xffffff : 0x000000, emissiveMap: theme === "neon" ? wallTex : null, emissiveIntensity: theme === "neon" ? 1.2 : 0 });
  disposables.push(wallTex, wallMat);
  const wallH = theme === "books" ? 1.4 : 1.1;
  for (const side of [-1, 1]) {
    const wp: number[] = [], wu: number[] = [], wi: number[] = [];
    for (let i = 0; i <= N; i++) {
      const smp = S[i % N];
      const lat = limit * side;
      const y = smp.p.y + Math.tan(smp.bank) * half * side - 0.2;
      const x = smp.p.x + smp.n.x * lat, z = smp.p.z + smp.n.z * lat;
      const sd = (i === N ? track.length : smp.s) / 8;
      wp.push(x, y, z, x, y + wallH, z); wu.push(sd, 0, sd, 1);
    }
    for (let i = 0; i < N; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; if (side > 0) wi.push(a, b, c, b, d, c); else wi.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(wp, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(wu, 2));
    g.setIndex(wi); g.computeVertexNormals();
    const m = new THREE.Mesh(g, wallMat); m.castShadow = shadows; m.receiveShadow = true;
    (m.material as THREE.Material).side = THREE.DoubleSide;
    group.add(m);
    disposables.push(g);
  }

  // ---------------- terrain ----------------
  // bucket samples for nearest-track lookups
  const cell = 24, buckets = new Map<string, number[]>();
  S.forEach((smp, i) => { const k = Math.floor(smp.p.x / cell) + "," + Math.floor(smp.p.z / cell); const b = buckets.get(k); if (b) b.push(i); else buckets.set(k, [i]); });
  const nearest = (x: number, z: number) => {
    let best = -1, bd = Infinity;
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    for (let r = 0; r <= 3 && best < 0; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        const list = buckets.get((cx + dx) + "," + (cz + dz)); if (!list) continue;
        for (const i of list) { const p = S[i].p; const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } }
      }
      if (best >= 0 && r > 0) break;
    }
    return { i: best, d: Math.sqrt(bd) };
  };
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const smp of S) { minX = Math.min(minX, smp.p.x); maxX = Math.max(maxX, smp.p.x); minZ = Math.min(minZ, smp.p.z); maxZ = Math.max(maxZ, smp.p.z); }
  const cxm = (minX + maxX) / 2, czm = (minZ + maxZ) / 2;
  const TS = 1300, TR = quality === "low" ? 150 : 220;
  const tGeo = new THREE.PlaneGeometry(TS, TS, TR, TR);
  tGeo.rotateX(-Math.PI / 2);
  tGeo.translate(cxm, 0, czm);
  const tp = tGeo.getAttribute("position") as THREE.BufferAttribute;
  const tcol = new Float32Array(tp.count * 3);
  const g1 = new THREE.Color(look.ground), g2 = new THREE.Color(look.ground2), tmpC = new THREE.Color();
  const water = theme === "shores";
  for (let v = 0; v < tp.count; v++) {
    const x = tp.getX(v), z = tp.getZ(v);
    const nr = nearest(x, z);
    const d = nr.i >= 0 ? nr.d : 999;
    const trackY = nr.i >= 0 ? S[nr.i].p.y : 0;
    const n = fbm(x / 70, z / 70);
    let natural = (n - 0.35) * 18;
    if (theme === "frost") natural = (n - 0.3) * 40 + Math.max(0, d - 90) * 0.35;
    if (theme === "books") natural = (n - 0.4) * 10 + Math.max(0, d - 70) * 0.5; // canyon walls
    if (theme === "neon") natural = (n - 0.5) * 2;
    if (water) {
      // ocean on the south-west side
      const ocean = THREE.MathUtils.smoothstep(-(x * 0.45 + z * 0.9) - 40, 0, 120);
      natural = natural * (1 - ocean) - ocean * 10;
    }
    const blend = THREE.MathUtils.smoothstep(d, limit + 2, limit + 45);
    const y = d < limit + 2 ? trackY - 0.4 : THREE.MathUtils.lerp(trackY - 0.4, natural, blend);
    tp.setY(v, y);
    tmpC.copy(g1).lerp(g2, THREE.MathUtils.clamp(fbm(x / 30 + 9, z / 30 + 9) * 1.4 - 0.2, 0, 1));
    if (water && y < 0.8) tmpC.lerp(new THREE.Color(0xf3e2b0), 0.9); // beach sand near water
    if (water && y > 0.8) tmpC.lerp(new THREE.Color(0x7ccf5a), THREE.MathUtils.smoothstep(d, 30, 70) * 0.8);
    if (theme === "frost") tmpC.lerp(new THREE.Color(0x8aa0b4), THREE.MathUtils.clamp((y - trackY - 25) / 60, 0, 0.5));
    if (theme === "books" && y > trackY + 8) tmpC.lerp(new THREE.Color(0xa06a3c), 0.5);
    tcol[v * 3] = tmpC.r; tcol[v * 3 + 1] = tmpC.g; tcol[v * 3 + 2] = tmpC.b;
  }
  tGeo.setAttribute("color", new THREE.BufferAttribute(tcol, 3));
  tGeo.computeVertexNormals();
  const tuv = tGeo.getAttribute("uv") as THREE.BufferAttribute;
  for (let v = 0; v < tuv.count; v++) tuv.setXY(v, tuv.getX(v) * 120, tuv.getY(v) * 120);
  // steep mountain slopes would stretch the detail texture into streaks, so frost uses colour only
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: theme === "frost" ? null : groundTex, roughness: theme === "frost" ? 0.7 : 0.95 });
  const terrain = new THREE.Mesh(tGeo, terrainMat);
  terrain.receiveShadow = true;
  group.add(terrain);
  disposables.push(tGeo, terrainMat);
  const groundY = (x: number, z: number) => {
    // approximate terrain height at a point (for placing props)
    const nr = nearest(x, z); const d = nr.i >= 0 ? nr.d : 999; const trackY = nr.i >= 0 ? S[nr.i].p.y : 0;
    const n = fbm(x / 70, z / 70);
    let natural = (n - 0.35) * 18;
    if (theme === "frost") natural = (n - 0.3) * 40 + Math.max(0, d - 90) * 0.35;
    if (theme === "books") natural = (n - 0.4) * 10 + Math.max(0, d - 70) * 0.5;
    if (theme === "neon") natural = (n - 0.5) * 2;
    if (water) { const ocean = THREE.MathUtils.smoothstep(-(x * 0.45 + z * 0.9) - 40, 0, 120); natural = natural * (1 - ocean) - ocean * 10; }
    const blend = THREE.MathUtils.smoothstep(d, limit + 2, limit + 45);
    return { y: d < limit + 2 ? trackY - 0.4 : THREE.MathUtils.lerp(trackY - 0.4, natural, blend), d };
  };

  if (water) {
    const wMat = new THREE.MeshStandardMaterial({ color: 0x1fa6d8, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.88 });
    const wu = { value: 0 };
    wMat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = wu;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uT;").replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.z += sin(position.x*0.05+uT)*0.35 + cos(position.y*0.07+uT*1.3)*0.3;");
    };
    const w = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600, 120, 120), wMat);
    w.rotation.x = -Math.PI / 2; w.position.set(cxm, -0.8, czm);
    group.add(w);
    disposables.push(wMat, w.geometry);
    updaters.push((_d, t) => { wu.value = t * 0.8; });
  }

  // ---------------- start line & gantry ----------------
  const start = track.at(0);
  const chk = checkerTexture();
  const chkMat = new THREE.MeshStandardMaterial({ map: chk, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  const line = new THREE.Mesh(new THREE.PlaneGeometry(track.def.width, 2.2), chkMat);
  line.rotation.x = -Math.PI / 2;
  const holder = new THREE.Group();
  holder.position.copy(start.p).setY(start.p.y + 0.04);
  holder.lookAt(start.p.clone().add(start.t.clone().setY(0)));
  holder.add(line);
  group.add(holder);
  disposables.push(chk, chkMat, line.geometry);
  const gantry = new THREE.Group();
  gantry.position.copy(start.p);
  gantry.lookAt(start.p.clone().add(start.t.clone().setY(0)));
  const postMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4, metalness: 0.6 });
  for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), postMat); post.position.set(sx * (half + 1.6), 4, 0); post.castShadow = shadows; gantry.add(post); }
  const bannerTex = canvasTex(1024, 128, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 1024, 0); g.addColorStop(0, "#7c3aed"); g.addColorStop(0.5, "#ec4899"); g.addColorStop(1, "#f59e0b");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 128);
    ctx.font = "italic 900 80px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff";
    ctx.fillText("AURORA RACERS", 512, 68);
  }, false);
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, emissive: 0xffffff, emissiveMap: bannerTex, emissiveIntensity: 0.35 });
  const banner = new THREE.Mesh(new THREE.BoxGeometry(track.def.width + 4, 1.8, 0.4), [postMat, postMat, postMat, postMat, bannerMat, bannerMat]);
  banner.position.set(0, 7.4, 0); banner.castShadow = shadows;
  gantry.add(banner);
  const startLights: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const lm = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0x000000, emissiveIntensity: 2.5 });
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), lm);
    l.position.set(-2.4 + i * 1.6, 5.9, -0.3);
    gantry.add(l); startLights.push(l);
    disposables.push(lm);
  }
  const box = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.1, 0.5), postMat); box.position.set(0, 5.9, 0); gantry.add(box);
  group.add(gantry);
  disposables.push(postMat, bannerTex, bannerMat);

  // ---------------- boost pads ----------------
  const bTex = boostTexture();
  const bMat = new THREE.MeshBasicMaterial({ map: bTex, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 });
  disposables.push(bTex, bMat);
  const boostPads = track.def.boosts.map(([f, latF]) => ({ s: f * track.length, lat: latF * half }));
  for (const bp of boostPads) {
    const fr = track.at(bp.s);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6), bMat);
    pad.rotation.x = -Math.PI / 2;
    const h = new THREE.Group();
    h.position.copy(track.point(bp.s, bp.lat, 0.05));
    h.lookAt(h.position.clone().add(fr.t.clone().setY(0)));
    pad.rotation.z = Math.PI;
    h.add(pad);
    group.add(h);
  }
  updaters.push((_d, t) => { bTex.offset.y = -t * 1.6; });

  // ---------------- jump ramps ----------------
  const rampMat = new THREE.MeshStandardMaterial({ color: theme === "neon" ? 0x22d3ee : 0xf59e0b, roughness: 0.5, emissive: theme === "neon" ? 0x0e7490 : 0x000000 });
  disposables.push(rampMat);
  for (const f of track.def.jumps) {
    const s0 = f * track.length;
    // stripes on the ramp surface
    for (let k = 0; k < 4; k++) {
      const s = s0 + (k + 0.5) * (RAMP_LEN / 4);
      const fr = track.at(s);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(track.def.width - 1, 0.06, 0.7), rampMat);
      stripe.position.copy(fr.p).setY(fr.p.y + track.rampHeight(s) + 0.05);
      stripe.lookAt(stripe.position.clone().add(fr.t));
      stripe.rotateX(-Math.atan2(RAMP_H, RAMP_LEN));
      group.add(stripe);
    }
    // the drop face
    const fr = track.at(s0 + RAMP_LEN - 0.05);
    const face = new THREE.Mesh(new THREE.BoxGeometry(track.def.width, RAMP_H, 0.3), rampMat);
    face.position.copy(fr.p).setY(fr.p.y + RAMP_H / 2);
    face.lookAt(face.position.clone().add(fr.t.clone().setY(0)));
    face.castShadow = shadows;
    group.add(face);
  }

  // ---------------- item boxes ----------------
  const ibTex = itemBoxTexture();
  const ibMat = new THREE.MeshStandardMaterial({ map: ibTex, transparent: true, opacity: 0.92, emissive: 0xffffff, emissiveMap: ibTex, emissiveIntensity: 0.55, roughness: 0.2 });
  const ibGeo = new THREE.BoxGeometry(1.3, 1.3, 1.3);
  disposables.push(ibTex, ibMat, ibGeo);
  const itemBoxes: BuiltTrack["itemBoxes"] = [];
  for (const f of track.def.items) {
    for (let k = -2; k <= 2; k++) {
      const p = track.point(f * track.length, k * (half / 2.6), 1.2);
      const m = new THREE.Mesh(ibGeo, ibMat);
      m.position.copy(p);
      m.castShadow = shadows;
      group.add(m);
      itemBoxes.push({ pos: p, mesh: m, respawn: 0 });
    }
  }
  updaters.push((dt, t) => {
    itemBoxes.forEach((b, i) => {
      b.mesh.rotation.set(t * 0.9 + i, t * 1.3 + i, 0);
      b.mesh.position.y = b.pos.y + Math.sin(t * 2 + i) * 0.15;
      const target = b.respawn > 0 ? 0.001 : 1;
      const sc = b.mesh.scale.x + (target - b.mesh.scale.x) * Math.min(1, dt * 6);
      b.mesh.scale.setScalar(sc);
      b.mesh.visible = sc > 0.02;
    });
  });

  // ---------------- coins ----------------
  const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20);
  coinGeo.rotateX(Math.PI / 2);
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc928, metalness: 0.85, roughness: 0.25, emissive: 0x6b4a00, emissiveIntensity: 0.6 });
  disposables.push(coinGeo, coinMat);
  const coins: BuiltTrack["coins"] = [];
  for (const [f, latF, count] of track.def.coins) {
    for (let k = 0; k < count; k++) {
      const p = track.point(f * track.length + k * 3.2, latF * half, 0.9);
      const m = new THREE.Mesh(coinGeo, coinMat);
      m.position.copy(p);
      group.add(m);
      coins.push({ pos: p, mesh: m, taken: false, respawn: 0 });
    }
  }
  updaters.push((_dt, t) => { coins.forEach((c, i) => { c.mesh.rotation.y = t * 3 + i * 0.4; c.mesh.visible = !c.taken; }); });

  // ---------------- themed scenery ----------------
  const placeOutside = (count: number, minD: number, maxD: number, fn: (x: number, y: number, z: number, s: number, i: number) => void) => {
    let placed = 0, tries = 0;
    while (placed < count && tries < count * 30) {
      tries++;
      const i = Math.floor(rnd() * N);
      const smp = S[i];
      const side = rnd() < 0.5 ? -1 : 1;
      const lat = side * (limit + minD + rnd() * (maxD - minD));
      const x = smp.p.x + smp.n.x * lat + (rnd() - 0.5) * 6, z = smp.p.z + smp.n.z * lat + (rnd() - 0.5) * 6;
      const gy = groundY(x, z);
      if (gy.d < limit + minD - 1) continue;
      if (water && gy.y < -0.2) continue;
      fn(x, gy.y, z, 0.8 + rnd() * 0.6, placed);
      placed++;
    }
  };
  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[], colors?: THREE.Color[], cast = true) => {
    if (!mats.length) return;
    const m = new THREE.InstancedMesh(geo, mat, mats.length);
    mats.forEach((mm, i) => { m.setMatrixAt(i, mm); if (colors) m.setColorAt(i, colors[i]); });
    m.castShadow = cast && shadows; m.receiveShadow = true;
    group.add(m);
    disposables.push(geo, mat);
  };
  const mat4 = (x: number, y: number, z: number, s: number, ry = rnd() * Math.PI * 2, sx = 1, sy = 1, sz = 1) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s * sx, s * sy, s * sz));
  const density = quality === "low" ? 0.55 : quality === "medium" ? 0.8 : 1;

  if (theme === "shores") {
    // palm trees
    const trunkParts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 6; k++) { const g = new THREE.CylinderGeometry(0.28 - k * 0.02, 0.32 - k * 0.02, 1.5, 8); g.translate(k * 0.18, 0.75 + k * 1.4, 0); g.rotateZ(-0.03 * k); trunkParts.push(g); }
    const trunk = mergeGeometries(trunkParts)!;
    const frondParts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 8; k++) { const g = new THREE.ConeGeometry(0.55, 4.2, 4); g.rotateZ(Math.PI / 2 + 0.4); g.translate(2, 0, 0); g.rotateY((k / 8) * Math.PI * 2); g.translate(1.0, 8.6, 0); frondParts.push(g); }
    const fronds = mergeGeometries(frondParts)!;
    const tm: THREE.Matrix4[] = [];
    placeOutside(Math.round(110 * density), 2, 40, (x, y, z, s) => tm.push(mat4(x, y, z, s)));
    inst(trunk, new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.9 }), tm);
    inst(fronds, new THREE.MeshStandardMaterial({ color: 0x2f9e44, roughness: 0.8 }), tm);
    // beach umbrellas & huts
    const umb = mergeGeometries([new THREE.ConeGeometry(2, 0.9, 12).translate(0, 2.6, 0), new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6).translate(0, 1.3, 0)])!;
    const um: THREE.Matrix4[] = [], uc: THREE.Color[] = [];
    placeOutside(Math.round(40 * density), 3, 25, (x, y, z, s) => { um.push(mat4(x, y, z, s)); uc.push(new THREE.Color().setHSL(rnd(), 0.8, 0.6)); });
    inst(umb, new THREE.MeshStandardMaterial({ roughness: 0.6 }), um, uc);
    const hut = mergeGeometries([new THREE.BoxGeometry(4, 2.6, 3.4).translate(0, 1.3, 0), new THREE.ConeGeometry(3.4, 2, 4).rotateY(Math.PI / 4).translate(0, 3.6, 0)])!;
    const hm: THREE.Matrix4[] = [], hc: THREE.Color[] = [];
    placeOutside(Math.round(14 * density), 8, 40, (x, y, z, s) => { hm.push(mat4(x, y, z, s)); hc.push(new THREE.Color().setHSL(0.05 + rnd() * 0.5, 0.6, 0.65)); });
    inst(hut, new THREE.MeshStandardMaterial({ roughness: 0.8 }), hm, hc);
    // lighthouse landmark
    const lh = new THREE.Group();
    const lw = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }), lr = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 });
    for (let k = 0; k < 5; k++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(2.6 - k * 0.3, 2.9 - k * 0.3, 4, 18), k % 2 ? lr : lw); seg.position.y = 2 + k * 4; seg.castShadow = shadows; lh.add(seg); }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 10), new THREE.MeshBasicMaterial({ color: 0xfff3b0, toneMapped: false }));
    lamp.position.y = 21.5; lh.add(lamp);
    lh.position.set(cxm - 120, 0, czm - 220);
    group.add(lh);
    disposables.push(lw, lr);
  } else if (theme === "books") {
    // giant books (standing and lying), pencils
    const cover = bookCoverTexture();
    const bookMat = new THREE.MeshStandardMaterial({ map: cover, roughness: 0.6 });
    const pageMat = new THREE.MeshStandardMaterial({ color: 0xfdf6e3, roughness: 0.9 });
    const bm: THREE.Matrix4[] = [], bc: THREE.Color[] = [];
    const pm: THREE.Matrix4[] = [];
    const palette = [0xb91c1c, 0x1d4ed8, 0x15803d, 0x7c3aed, 0xc2410c, 0x0f766e, 0xa16207, 0xbe185d];
    placeOutside(Math.round(120 * density), 2, 50, (x, y, z, s) => {
      const standing = rnd() < 0.6;
      const w = 3 + rnd() * 3, h = standing ? 10 + rnd() * 16 : 1.6 + rnd() * 2.4, d = standing ? 8 + rnd() * 6 : 9 + rnd() * 6;
      const ry = rnd() * Math.PI;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + h / 2 * s, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, standing ? (rnd() - 0.5) * 0.25 : 0)), new THREE.Vector3(w * s, h * s, d * s));
      bm.push(m); bc.push(new THREE.Color(palette[Math.floor(rnd() * palette.length)]));
      const pmx = m.clone().multiply(new THREE.Matrix4().makeScale(0.92, 0.96, 1.01)).premultiply(new THREE.Matrix4().makeTranslation(0, 0, 0));
      pm.push(pmx);
    });
    inst(new THREE.BoxGeometry(1, 1, 1), bookMat, bm, bc);
    inst(new THREE.BoxGeometry(1.02, 0.94, 0.9), pageMat, pm, undefined, false);
    disposables.push(cover);
    const pencil = mergeGeometries([
      new THREE.CylinderGeometry(0.8, 0.8, 16, 6).translate(0, 8, 0),
      new THREE.ConeGeometry(0.8, 2.6, 6).translate(0, 17.3, 0),
    ])!;
    const pc: THREE.Color[] = [], pmm: THREE.Matrix4[] = [];
    placeOutside(Math.round(26 * density), 4, 40, (x, y, z, s) => {
      pmm.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.5, rnd() * 6, (rnd() - 0.5) * 0.5)), new THREE.Vector3(s, s, s)));
      pc.push(new THREE.Color(rnd() < 0.5 ? 0xfacc15 : rnd() < 0.5 ? 0x60a5fa : 0xf472b6));
    });
    inst(pencil, new THREE.MeshStandardMaterial({ roughness: 0.5 }), pmm, pc);
    // giant open book arch over the road at the half-way point
    const fr = track.at(track.length * 0.25);
    const arch = new THREE.Group();
    arch.position.copy(fr.p);
    arch.lookAt(fr.p.clone().add(fr.t.clone().setY(0)));
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.6 });
    for (const sx of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 16, 12), coverMat);
      c.position.set(sx * (half + 4), 7, 0); c.rotation.z = sx * 0.35; c.castShadow = shadows;
      arch.add(c);
      const pg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 15, 11.4), pageMat);
      pg.position.set(sx * (half + 2.9), 7.2, 0); pg.rotation.z = sx * 0.35;
      arch.add(pg);
    }
    group.add(arch);
    disposables.push(coverMat);
    // floating letters
    const letters = new THREE.Group();
    const lmat = new THREE.MeshStandardMaterial({ color: 0xfff7e0, emissive: 0xffd27a, emissiveIntensity: 0.35 });
    for (let i = 0; i < 26; i++) {
      const t = canvasTex(64, 64, (ctx) => { ctx.clearRect(0, 0, 64, 64); ctx.font = "900 54px Georgia, serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff"; ctx.fillText(String.fromCharCode(65 + i), 32, 36); }, false);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: 0xffe08a, transparent: true, fog: true }));
      const smp = S[Math.floor(rnd() * N)];
      const lat = (rnd() < 0.5 ? -1 : 1) * (limit + 6 + rnd() * 20);
      sp.position.set(smp.p.x + smp.n.x * lat, smp.p.y + 8 + rnd() * 14, smp.p.z + smp.n.z * lat);
      sp.scale.setScalar(4 + rnd() * 3);
      sp.userData.base = sp.position.y;
      letters.add(sp);
      disposables.push(t, sp.material);
    }
    group.add(letters);
    updaters.push((_d, t) => letters.children.forEach((c, i) => { c.position.y = c.userData.base + Math.sin(t * 0.8 + i) * 1.2; }));
    disposables.push(lmat);
  } else if (theme === "neon") {
    const winA = windowTexture("#22d3ee", "#f0abfc"), winB = windowTexture("#fde047", "#f472b6");
    winA.repeat.set(2, 3); winB.repeat.set(2, 4);
    const bMatA = new THREE.MeshStandardMaterial({ map: winA, emissive: 0xffffff, emissiveMap: winA, emissiveIntensity: 1.1, roughness: 0.4, metalness: 0.4 });
    const bMatB = new THREE.MeshStandardMaterial({ map: winB, emissive: 0xffffff, emissiveMap: winB, emissiveIntensity: 1.1, roughness: 0.4, metalness: 0.4 });
    disposables.push(winA, winB);
    const ma: THREE.Matrix4[] = [], mb: THREE.Matrix4[] = [];
    placeOutside(Math.round(170 * density), 5, 70, (x, y, z, s, i) => {
      const h = 18 + rnd() * 60, w = 8 + rnd() * 10;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * Math.PI, 0)), new THREE.Vector3(w, h, w * (0.7 + rnd() * 0.5)));
      (i % 2 ? ma : mb).push(m);
    });
    inst(new THREE.BoxGeometry(1, 1, 1), bMatA, ma);
    inst(new THREE.BoxGeometry(1, 1, 1), bMatB, mb);
    // street lamps along the track
    const lampGeo = mergeGeometries([new THREE.CylinderGeometry(0.1, 0.12, 6, 6).translate(0, 3, 0), new THREE.BoxGeometry(1.4, 0.2, 0.3).translate(0.6, 6, 0)])!;
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xfef3c7, toneMapped: false });
    const lm: THREE.Matrix4[] = [], gm: THREE.Matrix4[] = [];
    for (let i = 0; i < N; i += 12) {
      const smp = S[i];
      for (const side of [-1, 1]) {
        const lat = side * (limit + 0.8);
        const x = smp.p.x + smp.n.x * lat, z = smp.p.z + smp.n.z * lat;
        const ry = Math.atan2(-smp.n.x * side, -smp.n.z * side) - Math.PI / 2;
        lm.push(new THREE.Matrix4().compose(new THREE.Vector3(x, smp.p.y - 0.2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1)));
        gm.push(new THREE.Matrix4().makeTranslation(x - smp.n.x * side * 1.1, smp.p.y + 5.75, z - smp.n.z * side * 1.1));
      }
    }
    inst(lampGeo, new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.4 }), lm);
    inst(new THREE.BoxGeometry(0.9, 0.12, 0.35), glowMat, gm, undefined, false);
    // floating neon rings over the road
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf0479a, toneMapped: false });
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x22d3ee, toneMapped: false });
    for (let k = 0; k < 6; k++) {
      const fr = track.at((k / 6 + 0.05) * track.length);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(half + 3, 0.22, 8, 48, Math.PI), k % 2 ? ringMat : ringMat2);
      ring.position.copy(fr.p);
      ring.lookAt(fr.p.clone().add(fr.t.clone().setY(0)));
      group.add(ring);
      disposables.push(ring.geometry);
    }
    disposables.push(ringMat, ringMat2);
  } else {
    // frost: snowy pines, snowmen, ice crystals, falling snow
    const pine = mergeGeometries([0, 1, 2, 3].map((k) => new THREE.ConeGeometry(2.6 - k * 0.5, 2.8, 9).translate(0, 2.2 + k * 1.6, 0)))!;
    const snowCap = mergeGeometries([0, 1, 2, 3].map((k) => new THREE.ConeGeometry(1.5 - k * 0.3, 1.1, 9).translate(0, 3.2 + k * 1.6, 0)))!;
    const trunk = new THREE.CylinderGeometry(0.25, 0.35, 2, 6).translate(0, 1, 0);
    const pm: THREE.Matrix4[] = [];
    placeOutside(Math.round(220 * density), 1, 60, (x, y, z, s) => pm.push(mat4(x, y, z, s * 1.2)));
    inst(pine, new THREE.MeshStandardMaterial({ color: 0x1f5f46, roughness: 0.85 }), pm);
    inst(snowCap, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), pm, undefined, false);
    inst(trunk, new THREE.MeshStandardMaterial({ color: 0x5b4030 }), pm);
    const snowman = mergeGeometries([new THREE.SphereGeometry(1, 14, 10).translate(0, 1, 0), new THREE.SphereGeometry(0.7, 14, 10).translate(0, 2.4, 0), new THREE.SphereGeometry(0.48, 12, 8).translate(0, 3.4, 0)])!;
    const sm: THREE.Matrix4[] = [];
    placeOutside(Math.round(18 * density), 2, 16, (x, y, z, s) => sm.push(mat4(x, y, z, s)));
    inst(snowman, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), sm);
    const crystal = new THREE.OctahedronGeometry(1.4, 0); crystal.scale(0.6, 2.2, 0.6);
    const cm: THREE.Matrix4[] = [];
    placeOutside(Math.round(40 * density), 2, 30, (x, y, z, s) => cm.push(mat4(x, y + 2, z, s)));
    inst(crystal, new THREE.MeshPhysicalMaterial({ color: 0x9ddcff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.8, emissive: 0x2a6fa8, emissiveIntensity: 0.5 }), cm);
    // falling snow around the camera
    const flakes = quality === "low" ? 600 : 1600;
    const fp = new Float32Array(flakes * 3);
    for (let i = 0; i < flakes; i++) { fp[i * 3] = (rnd() - 0.5) * 120; fp[i * 3 + 1] = rnd() * 50; fp[i * 3 + 2] = (rnd() - 0.5) * 120; }
    const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.BufferAttribute(fp, 3));
    const fmat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.85, depthWrite: false });
    const snow = new THREE.Points(fg, fmat);
    snow.frustumCulled = false;
    group.add(snow);
    disposables.push(fg, fmat);
    updaters.push((dt) => {
      const a = fg.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < flakes; i++) { let y = a.getY(i) - dt * 4; if (y < 0) y += 50; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(y * 0.3 + i) * dt * 0.6); }
      a.needsUpdate = true;
    });
    group.userData.snow = snow;
  }

  // cheering stands near the start line (all themes)
  {
    const fr = track.at(track.length * 0.985);
    const stand = new THREE.Group();
    stand.position.copy(fr.p);
    stand.lookAt(fr.p.clone().add(fr.t.clone().setY(0)));
    const standMat = new THREE.MeshStandardMaterial({ color: theme === "neon" ? 0x312e81 : 0x94a3b8, roughness: 0.6, metalness: 0.3 });
    for (let r = 0; r < 4; r++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 26), standMat);
      step.position.set(limit + 2 + r * 1.4, 0.3 + r * 0.6, 0); step.castShadow = shadows; step.receiveShadow = true;
      stand.add(step);
    }
    const fanGeo = mergeGeometries([new THREE.CapsuleGeometry(0.22, 0.5, 3, 6).translate(0, 0.5, 0), new THREE.SphereGeometry(0.18, 8, 6).translate(0, 1.05, 0)].map((g) => { g.deleteAttribute("uv"); return g; }))!;
    const fans = new THREE.InstancedMesh(fanGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), 64);
    const base: THREE.Matrix4[] = [];
    for (let i = 0; i < 64; i++) {
      const r = i % 4, k = Math.floor(i / 4);
      const m = new THREE.Matrix4().makeTranslation(limit + 2 + r * 1.4, 0.6 + r * 0.6, -12 + k * 1.6);
      base.push(m); fans.setMatrixAt(i, m); fans.setColorAt(i, new THREE.Color().setHSL(rnd(), 0.75, 0.6));
    }
    stand.add(fans);
    group.add(stand);
    disposables.push(standMat, fanGeo, fans.material as THREE.Material);
    updaters.push((_d, t) => {
      const m = new THREE.Matrix4();
      for (let i = 0; i < 64; i++) { m.copy(base[i]); m.elements[13] += Math.abs(Math.sin(t * 6 + i * 1.7)) * 0.25; fans.setMatrixAt(i, m); }
      fans.instanceMatrix.needsUpdate = true;
    });
  }

  return {
    group, sun, itemBoxes, coins, boostPads, startLights,
    update: (dt, t) => { for (const u of updaters) u(dt, t); },
    dispose: () => {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
      });
      disposables.forEach((d) => { try { d.dispose(); } catch { /* ignore */ } });
      scene.remove(group);
      scene.environment = null; scene.fog = null;
    },
  };
}

export { SHOULDER };
