// North Haven (the library, the mall, the skate park, the sports field, the
// Reading Garden, the water tower and the Maple Grove houses) plus the south
// side: Haven Farm's pumpkin patch and the Off-Road Trail.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  BARN, BLOCK_HALF, FARM, FIELD, GARDEN, HOUSES, LIBRARY, MALL, NORTH_BLOCKS, NORTH_HOUSE, NORTH_TREES, SILO, SKATE, SKATE_PIPES, SOUTH_ROAD, TRAIL, WATER_TOWER, rng,
} from "@shared/city/layout";
import { signTexture } from "./textures";

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...extra });
function flat(w: number, d: number, x: number, z: number, y: number) {
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate(x, y, z); return g;
}
function boxAt(w: number, h: number, d: number, x: number, y: number, z: number, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d); if (rotY) g.rotateY(rotY); g.translate(x, y + h / 2, z); return g;
}
function cyl(r: number, h: number, x: number, y: number, z: number, seg = 12) {
  const g = new THREE.CylinderGeometry(r, r, h, seg); g.translate(x, y + h / 2, z); return g;
}
/** A triangular roof prism `w` wide (ridge along local x), `d` deep, `h` tall, sitting at height y. */
function prism(w: number, d: number, h: number, x: number, y: number, z: number, rotY = 0) {
  const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2); g.rotateY(Math.PI / 2 + rotY); g.translate(x, y, z);
  return g;
}

export type North = { update: (t: number) => void };

export function buildNorth(scene: THREE.Scene, keep: <T extends { dispose: () => void }>(o: T) => T): North {
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, opts: { cast?: boolean; receive?: boolean } = {}) => {
    keep(geo); const m = new THREE.Mesh(geo, mat);
    m.castShadow = !!opts.cast; m.receiveShadow = opts.receive ?? true; scene.add(m); return m;
  };
  const merged = (list: THREE.BufferGeometry[], mat: THREE.Material, opts: { cast?: boolean } = {}) => {
    if (!list.length) return null;
    const m = add(mergeGeometries(list)!, mat, opts); list.forEach((g) => g.dispose()); return m;
  };
  const sign = (tex: THREE.Texture, w: number, h: number, x: number, y: number, z: number, rotY: number, twoSided = true) => {
    const mat = keep(new THREE.MeshBasicMaterial({ map: tex }));
    for (const flip of twoSided ? [0, Math.PI] : [0]) { const p = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, h)), mat); p.position.set(x, y, z); p.rotation.y = rotY + flip; scene.add(p); }
  };
  const paved = keep(std(0x8d8a96)), grass = keep(std(0x4f8f4a)), white = keep(std(0xf2f2f2)), wood = keep(std(0x8a5a3c)), dark = keep(std(0x2a2d38));
  const paint = keep(new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }));

  // ── ground: paved uptown blocks, lawns for the houses, the field and the garden ──
  {
    const pave: THREE.BufferGeometry[] = [], lawn: THREE.BufferGeometry[] = [];
    for (const b of NORTH_BLOCKS) (["houses", "watertower", "field", "garden"].includes(b.kind) ? lawn : pave).push(flat(BLOCK_HALF * 2 + 4, BLOCK_HALF * 2 + 4, b.x, b.z, 0.01));
    for (const cx of [-80, 0, 80]) pave.push(flat(BLOCK_HALF * 2 + 4, 40, cx, -177, 0.01));
    pave.push(flat(BLOCK_HALF * 2 + 4, BLOCK_HALF * 2 + 4, -160, -160, 0.012), flat(58, BLOCK_HALF * 2 + 4, 155, -160, 0.012));
    merged(pave, paved); merged(lawn, grass);
  }

  // ── Maple Grove houses ──
  {
    const n = HOUSES.length;
    const body = keep(new THREE.BoxGeometry(NORTH_HOUSE, 4.6, NORTH_HOUSE)); body.translate(0, 2.3, 0);
    const roof = keep(prism(NORTH_HOUSE + 0.8, NORTH_HOUSE + 0.8, 3.2, 0, 4.6, 0));
    const trimParts = [boxAt(1.5, 2.4, 0.12, 0, 0, NORTH_HOUSE / 2 + 0.02), boxAt(1.4, 1.1, 0.12, -2.6, 1.6, NORTH_HOUSE / 2 + 0.02), boxAt(1.4, 1.1, 0.12, 2.6, 1.6, NORTH_HOUSE / 2 + 0.02)];
    const trim = keep(mergeGeometries(trimParts)!); trimParts.forEach((g) => g.dispose());
    const path = keep(new THREE.BoxGeometry(1.8, 0.06, 6.6)); path.translate(0, 0.04, NORTH_HOUSE / 2 + 3.3);
    const bodies = new THREE.InstancedMesh(body, keep(std(0xffffff)), n);
    const roofs = new THREE.InstancedMesh(roof, keep(std(0xffffff, { flatShading: true })), n);
    const trims = new THREE.InstancedMesh(trim, keep(new THREE.MeshStandardMaterial({ color: 0x4a3a2a, emissive: 0xffd28a, emissiveIntensity: 0.35 })), n);
    const paths = new THREE.InstancedMesh(path, keep(std(0xd8cdb4)), n);
    const walls = [0xf4e3c3, 0xcfe6f2, 0xf2d0d0, 0xd9ecd2, 0xf5f0e6, 0xe6d6f2, 0xf2e2b8, 0xd0dde8], roofsC = [0x8b3a3a, 0x3a4a6b, 0x5a4a3a, 0x2f5a4a, 0x6b3a5a, 0x4a4a52, 0x7a4a2a, 0x3a5a7a];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
    HOUSES.forEach((h, i) => {
      q.setFromAxisAngle(up, h.facing);
      m4.compose(new THREE.Vector3(h.x, 0, h.z), q, one);
      bodies.setMatrixAt(i, m4); roofs.setMatrixAt(i, m4); trims.setMatrixAt(i, m4); paths.setMatrixAt(i, m4);
      bodies.setColorAt(i, col.setHex(walls[h.color])); roofs.setColorAt(i, col.setHex(roofsC[(h.color + 3) % 8]));
    });
    bodies.castShadow = roofs.castShadow = true; bodies.receiveShadow = true;
    scene.add(bodies, roofs, trims, paths);
  }

  // ── trees in the yards and round the garden ──
  {
    const trunk = keep(new THREE.CylinderGeometry(0.22, 0.3, 2.2, 6)); trunk.translate(0, 1.1, 0);
    const crown = keep(new THREE.IcosahedronGeometry(1.7, 0)); crown.translate(0, 3.3, 0);
    const tm = new THREE.InstancedMesh(trunk, keep(std(0x6b4a32)), NORTH_TREES.length);
    const cm = new THREE.InstancedMesh(crown, keep(std(0xffffff, { flatShading: true })), NORTH_TREES.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), color = new THREE.Color(), r = rng(818);
    NORTH_TREES.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI);
      m4.compose(new THREE.Vector3(t.x, 0, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
      tm.setMatrixAt(i, m4); cm.setMatrixAt(i, m4);
      // autumn colours for Maple Grove
      cm.setColorAt(i, color.setHSL([0.02, 0.07, 0.11, 0.28][Math.floor(r() * 4)], 0.65, 0.42 + r() * 0.08));
    });
    tm.castShadow = cm.castShadow = true;
    scene.add(tm, cm);
  }

  // ── A.R.I.S.E. Library ──
  {
    const b = LIBRARY.building, w = b.maxX - b.minX, d = b.maxZ - b.minZ, cz = (b.minZ + b.maxZ) / 2;
    add(boxAt(w, LIBRARY.height, d, 0, 0, cz), keep(std(0xe8dcc4, { roughness: 0.75 })), { cast: true });
    add(boxAt(w + 2, 1, d + 2, 0, LIBRARY.height, cz), keep(std(0xcbbd9f)));
    add(prism(w + 2, 7, 3.4, 0, LIBRARY.height + 1, b.maxZ - 3.5), keep(std(0xd6c8a8)), { cast: true });
    // columns and steps across the front
    const cols: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) cols.push(cyl(0.7, LIBRARY.height - 1, -15.75 + i * 4.5, 0.9, b.maxZ + 1.4, 14));
    merged(cols, keep(std(0xf4ecdc)), { cast: true });
    const steps: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 3; k++) steps.push(boxAt(w - 4 - k * 2, 0.3, 2.2, 0, k * 0.3, b.maxZ + 3.6 - k * 0.7));
    merged(steps, keep(std(0xd8d2c4)));
    const doorTex = keep(signTexture([{ text: "OPEN", size: 90, color: "#ffd36b" }], { w: 256, h: 256, bg: "#3a2414", border: "#ffd36b" }));
    sign(doorTex, 4.4, 4.4, 0, 2.4, b.maxZ + 0.06, 0, false);
    const tex = keep(signTexture([{ text: "A.R.I.S.E. LIBRARY", size: 110, color: "#3a2414" }, { text: "READ · EARN COINS · EXPLORE", size: 48, color: "#7a5230" }], { w: 1024, h: 230, bg: "#f4ecdc" }));
    sign(tex, 18, 4, 0, LIBRARY.height - 1.8, b.maxZ + 2.3, 0, false);
    // lit windows down the sides
    const win: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) for (const y of [3, 8]) win.push(boxAt(0.1, 2.6, 2.2, sx * (w / 2 + 0.05), y, b.minZ + 4 + i * 6.2));
    merged(win, keep(new THREE.MeshBasicMaterial({ color: 0xffd98a })));
    // a stack of giant books on the front lawn
    const books = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60];
    books.forEach((c, i) => add(boxAt(4.2 - i * 0.3, 0.8, 3, -14, i * 0.8, -208 + 0.2 * i, 0.15 * i), keep(std(c)), { cast: true }));
  }

  // ── Haven Mall and its parking lot ──
  {
    const b = MALL.building, w = b.maxX - b.minX, d = b.maxZ - b.minZ, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    add(boxAt(w, MALL.height, d, cx, 0, cz), keep(std(0xd7d3de)), { cast: true });
    add(boxAt(w * 0.8, 4.4, 0.3, cx, 0.2, b.maxZ + 0.1), keep(new THREE.MeshStandardMaterial({ color: 0x7fd3ff, emissive: 0x2a6aa8, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.5 })));
    add(boxAt(w * 0.86, 0.5, 3, cx, 4.8, b.maxZ + 1.4), keep(std(0x8a4fd8)));
    const tex = keep(signTexture([{ text: "HAVEN MALL", size: 140, color: "#ffffff" }], { w: 1024, h: 200, bg: "#8a4fd8" }));
    sign(tex, 16, 3.1, cx, MALL.height - 2.2, b.maxZ + 0.08, 0, false);
    const lines: THREE.BufferGeometry[] = [];
    for (let x = b.minX + 2; x <= b.maxX - 2; x += 3.2) for (const z0 of [-224, -213]) lines.push(flat(0.18, 5, x, z0, 0.03));
    merged(lines, paint);
  }

  // ── Skate park ──
  {
    add(flat(66, 66, SKATE.x, SKATE.z, 0.02), keep(std(0xb9b6bf, { roughness: 0.7 })));
    const circles = [[0x3ee6ff, 230, -244, 6], [0xff5fd8, 252, -232, 4], [0xffd36b, 244, -256, 3.5]] as const;
    circles.forEach(([c, x, z, r]) => { const g = keep(new THREE.RingGeometry(r - 0.5, r, 40)); g.rotateX(-Math.PI / 2); g.translate(x, 0.03, z); add(g, keep(new THREE.MeshBasicMaterial({ color: c }))); });
    const concrete = keep(std(0xcfccd6, { roughness: 0.6, side: THREE.DoubleSide }));
    for (const p of SKATE_PIPES) {
      const g = keep(new THREE.CylinderGeometry(4, 4, 40, 16, 1, true, Math.PI, Math.PI / 2));
      g.rotateZ(Math.PI / 2); g.rotateY(p.rot); g.translate(p.x, 4, p.z + (p.rot ? -2 : 2));
      add(g, concrete, { cast: true });
      add(boxAt(40, 4, 0.5, p.x, 0, p.z + (p.rot ? 2.2 : -2.2)), concrete); // back wall behind the lip
    }
    add(boxAt(9, 1, 4, SKATE.x, 0, SKATE.z + 4), keep(std(0x5a5f6e)), { cast: true });
    const rails: THREE.BufferGeometry[] = [];
    for (const x of [-4, 4]) rails.push(boxAt(0.12, 0.6, 0.12, SKATE.x + x, 0, SKATE.z - 6));
    rails.push(boxAt(8.2, 0.1, 0.1, SKATE.x, 0.6, SKATE.z - 6));
    merged(rails, keep(std(0xffd36b, { metalness: 0.6, roughness: 0.3 })));
    const tex = keep(signTexture([{ text: "SKATE PARK", size: 140, color: "#ff5fd8" }], { w: 1024, h: 200, bg: "#101018", border: "#3ee6ff" }));
    sign(tex, 10, 2, SKATE.x - 30, 4.6, SKATE.z + 31, 0);
    merged([boxAt(0.3, 5.6, 0.3, SKATE.x - 35, 0, SKATE.z + 31), boxAt(0.3, 5.6, 0.3, SKATE.x - 25, 0, SKATE.z + 31)], dark);
  }

  // ── Sports field ──
  {
    const { x, z, w, d } = FIELD;
    add(flat(w + 4, d + 4, x, z, 0.02), keep(std(0x3f9a46)));
    const stripes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i += 2) stripes.push(flat(w / 6, d, x - w / 2 + (i + 0.5) * (w / 6), z, 0.025));
    merged(stripes, keep(std(0x48a84f)));
    const lines: THREE.BufferGeometry[] = [flat(w, 0.25, x, z - d / 2, 0.03), flat(w, 0.25, x, z + d / 2, 0.03), flat(0.25, d, x - w / 2, z, 0.03), flat(0.25, d, x + w / 2, z, 0.03), flat(0.25, d, x, z, 0.03)];
    const ring = new THREE.RingGeometry(5.2, 5.45, 48); ring.rotateX(-Math.PI / 2); ring.translate(x, 0.03, z); lines.push(ring);
    merged(lines, paint);
    const goals: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) {
      const gx = x + sx * (w / 2);
      goals.push(boxAt(0.2, 2.4, 0.2, gx, 0, z - 3.6), boxAt(0.2, 2.4, 0.2, gx, 0, z + 3.6), boxAt(0.2, 0.2, 7.4, gx, 2.3, z));
    }
    merged(goals, white, { cast: true });
    const stands: THREE.BufferGeometry[] = [];
    for (let row = 0; row < 4; row++) stands.push(boxAt(40, 0.8, 1.2, x, row * 0.8, z - 25.4 - row * 1.2));
    merged(stands, keep(std(0x3a5aa8)), { cast: true });
    const tex = keep(signTexture([{ text: "HAVEN FIELD", size: 130, color: "#ffd36b" }], { w: 1024, h: 200, bg: "#0e1a33" }));
    sign(tex, 10, 2, x, 5.4, z - 30.6, 0);
  }

  // ── Reading Garden ──
  {
    const { x, z, pond } = GARDEN;
    const path = keep(new THREE.RingGeometry(pond + 4, pond + 6.5, 64)); path.rotateX(-Math.PI / 2); path.translate(x, 0.03, z);
    add(path, keep(std(0xd8cdb4)));
    const water = keep(new THREE.CircleGeometry(pond, 48)); water.rotateX(-Math.PI / 2); water.translate(x, 0.05, z);
    add(water, keep(new THREE.MeshStandardMaterial({ color: 0x3fb6e8, emissive: 0x0d4c74, emissiveIntensity: 0.45, roughness: 0.15 })));
    const rim = keep(new THREE.TorusGeometry(pond, 0.35, 6, 48)); rim.rotateX(Math.PI / 2); rim.translate(x, 0.15, z);
    add(rim, keep(std(0xbdb6a6)));
    const r = rng(9191), flowers: THREE.BufferGeometry[][] = [[], [], []];
    for (let i = 0; i < 90; i++) {
      const a = r() * Math.PI * 2, d = pond + 8 + r() * 10;
      const g = new THREE.SphereGeometry(0.35, 6, 5); g.translate(x + Math.cos(a) * d, 0.35, z + Math.sin(a) * d);
      flowers[i % 3].push(g);
    }
    [0xff5f9a, 0xffd23f, 0xa974ff].forEach((c, i) => merged(flowers[i], keep(std(c))));
    const benches: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const g = new THREE.BoxGeometry(2.6, 0.45, 0.8); g.rotateY(-a + Math.PI / 2); g.translate(x + Math.cos(a) * (pond + 7.4), 0.45, z + Math.sin(a) * (pond + 7.4)); benches.push(g); }
    merged(benches, wood, { cast: true });
    // an open-book sculpture
    const book = new THREE.Group(); book.position.set(x + 12, 0, z - 9);
    const pageMat = keep(std(0xfaf6ea)), cover = keep(std(0x2e86c1));
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(keep(new THREE.BoxGeometry(3, 0.25, 4)), cover); c.position.set(s * 1.5, 1.4, 0); c.rotation.z = s * -0.3; book.add(c);
      const p = new THREE.Mesh(keep(new THREE.BoxGeometry(2.8, 0.25, 3.8)), pageMat); p.position.set(s * 1.4, 1.62, 0); p.rotation.z = s * -0.3; book.add(p);
    }
    const stand = new THREE.Mesh(keep(new THREE.BoxGeometry(0.8, 1.3, 0.8)), keep(std(0x6b6f7a))); stand.position.y = 0.65; book.add(stand);
    book.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
    scene.add(book);
    const tex = keep(signTexture([{ text: "READING GARDEN", size: 120, color: "#2f6b35" }], { w: 1024, h: 200, bg: "#f4ecdc" }));
    sign(tex, 9, 1.8, x, 2.6, z + BLOCK_HALF - 4, 0);
    merged([boxAt(0.25, 3.6, 0.25, x - 4.4, 0, z + BLOCK_HALF - 4), boxAt(0.25, 3.6, 0.25, x + 4.4, 0, z + BLOCK_HALF - 4)], wood);
  }

  // ── Water tower ──
  {
    const { x, z } = WATER_TOWER, legs: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) legs.push(boxAt(0.4, 14, 0.4, x + sx * 3, 0, z + sz * 3));
    for (const y of [4.5, 9]) { legs.push(boxAt(6.4, 0.25, 0.25, x, y, z - 3), boxAt(6.4, 0.25, 0.25, x, y, z + 3), boxAt(0.25, 0.25, 6.4, x - 3, y, z), boxAt(0.25, 0.25, 6.4, x + 3, y, z)); }
    merged(legs, keep(std(0x9aa3b5, { metalness: 0.5, roughness: 0.4 })), { cast: true });
    add(cyl(5.2, 6, x, 14, z, 24), keep(std(0x8fd3ff, { metalness: 0.3, roughness: 0.4 })), { cast: true });
    const top = new THREE.Mesh(keep(new THREE.ConeGeometry(5.4, 2.6, 24)), keep(std(0x5b8fd8))); top.position.set(x, 21.3, z); top.castShadow = true; scene.add(top);
    const tex = keep(signTexture([{ text: "HAVEN", size: 160, color: "#ffffff" }], { w: 512, h: 200, bg: "#3b82f6" }));
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) sign(tex, 5, 2, x + Math.sin(a) * 5.25, 17, z + Math.cos(a) * 5.25, a, false);
  }

  // ── Haven Farm ──
  {
    add(flat(FARM.maxX - FARM.minX, FARM.maxZ - FARM.minZ, (FARM.minX + FARM.maxX) / 2, (FARM.minZ + FARM.maxZ) / 2, 0.01), keep(std(0x6f9a45)));
    const bw = BARN.maxX - BARN.minX, bd = BARN.maxZ - BARN.minZ, bx = (BARN.minX + BARN.maxX) / 2, bz = (BARN.minZ + BARN.maxZ) / 2;
    add(boxAt(bw, 7, bd, bx, 0, bz), keep(std(0xb8322e)), { cast: true });
    add(prism(bd + 1, bw + 0.6, 4.2, bx, 7, bz, Math.PI / 2), keep(std(0x4a4a52, { flatShading: true })), { cast: true });
    const doorX: THREE.BufferGeometry[] = [];
    const door = boxAt(5, 5, 0.15, bx + bw / 2 + 0.08, 0, bz, Math.PI / 2); doorX.push(door);
    merged(doorX, white);
    add(cyl(SILO.r, 14, SILO.x, 0, SILO.z, 20), keep(std(0xc9cdd6, { metalness: 0.4, roughness: 0.4 })), { cast: true });
    const dome = new THREE.Mesh(keep(new THREE.SphereGeometry(SILO.r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), keep(std(0x8a4f2e))); dome.position.set(SILO.x, 14, SILO.z); scene.add(dome);
    // pumpkin patch
    const r = rng(3030);
    add(flat(40, 40, -168, 280, 0.02), keep(std(0x4a6b2a)));
    const pumpkin = keep(new THREE.SphereGeometry(0.6, 10, 8)); pumpkin.scale(1, 0.75, 1); pumpkin.translate(0, 0.45, 0);
    const pm = new THREE.InstancedMesh(pumpkin, keep(std(0xff8a1f, { roughness: 0.6 })), 70);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 70; i++) {
      const s = 0.7 + r() * 0.9;
      q.setFromAxisAngle(up, r() * Math.PI);
      m4.compose(new THREE.Vector3(-186 + r() * 36, 0, 262 + r() * 36), q, new THREE.Vector3(s, s, s));
      if (Math.hypot(m4.elements[12] + 170, m4.elements[14] - 280) < 2.5) m4.elements[12] -= 4; // keep the star clear
      pm.setMatrixAt(i, m4);
    }
    pm.castShadow = true; scene.add(pm);
    // corn rows you can drive straight through
    const stalk = keep(new THREE.ConeGeometry(0.35, 2.6, 5)); stalk.translate(0, 1.3, 0);
    const corn: [number, number][] = [];
    for (let x = FARM.minX + 3; x < FARM.maxX - 2; x += 2.2) for (let z = 306; z < FARM.maxZ - 3; z += 1.6) corn.push([x + (r() - 0.5) * 0.4, z]);
    const cm = new THREE.InstancedMesh(stalk, keep(std(0xc8b04a, { flatShading: true })), corn.length);
    corn.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); cm.setMatrixAt(i, m4); });
    scene.add(cm);
    // hay bales and a fence along the road
    const bales: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) { const g = new THREE.CylinderGeometry(0.9, 0.9, 1.4, 14); g.rotateZ(Math.PI / 2); g.translate(-148 + (i % 3) * 2.2, 0.9 + Math.floor(i / 3) * 1.6, 250); bales.push(g); }
    merged(bales, keep(std(0xe0c060)), { cast: true });
    const fence: THREE.BufferGeometry[] = [];
    for (let x = FARM.minX; x <= FARM.maxX; x += 2.5) fence.push(boxAt(0.15, 1.1, 0.15, x, 0, FARM.minZ));
    fence.push(boxAt(FARM.maxX - FARM.minX, 0.12, 0.08, (FARM.minX + FARM.maxX) / 2, 0.9, FARM.minZ), boxAt(FARM.maxX - FARM.minX, 0.12, 0.08, (FARM.minX + FARM.maxX) / 2, 0.5, FARM.minZ));
    merged(fence, white);
    const tex = keep(signTexture([{ text: "HAVEN FARM", size: 130, color: "#b8322e" }, { text: "PUMPKIN PATCH · CORN MAZE", size: 52, color: "#4a6b2a" }], { w: 1024, h: 250, bg: "#fff4e0" }));
    sign(tex, 9, 2.2, -150, 3, FARM.minZ + 1.5, 0);
    merged([boxAt(0.25, 4, 0.25, -154.4, 0, FARM.minZ + 1.5), boxAt(0.25, 4, 0.25, -145.6, 0, FARM.minZ + 1.5)], wood);
  }

  // ── Off-Road Trail ──
  {
    const { cx, cz, half, radius, width } = TRAIL;
    const stadium = (rad: number) => {
      const s = new THREE.Shape();
      s.moveTo(cx - half, cz - rad); s.lineTo(cx + half, cz - rad);
      s.absarc(cx + half, cz, rad, -Math.PI / 2, Math.PI / 2, false);
      s.lineTo(cx - half, cz + rad);
      s.absarc(cx - half, cz, rad, Math.PI / 2, Math.PI * 1.5, false);
      return s;
    };
    const outer = stadium(radius + width), inner = stadium(radius - width);
    outer.holes.push(new THREE.Path(inner.getPoints(64).reverse()));
    const tg = keep(new THREE.ShapeGeometry(outer, 48)); tg.rotateX(Math.PI / 2); tg.translate(0, 0.03, 0);
    const dirt = keep(std(0x8a6a44, { roughness: 1, side: THREE.DoubleSide }));
    add(tg, dirt);
    add(flat(8, cz - radius - SOUTH_ROAD, TRAIL.entryX, (SOUTH_ROAD + cz - radius) / 2, 0.028), dirt);
    // flags round the outside and a few boulders
    const r = rng(4545), flags: THREE.BufferGeometry[] = [], poles: THREE.BufferGeometry[] = [], rocks: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const px = cx + Math.cos(a) * (half + radius + width + 3), pz = cz + Math.sin(a) * (radius + width + 3);
      if (Math.abs(px - TRAIL.entryX) < 6 && pz < cz) continue;
      poles.push(boxAt(0.1, 2.4, 0.1, px, 0, pz));
      const f = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(px, 2.4, pz), new THREE.Vector3(px, 1.8, pz), new THREE.Vector3(px + 0.9, 2.1, pz)]);
      f.computeVertexNormals(); flags.push(f);
    }
    for (let i = 0; i < 10; i++) { const g = new THREE.DodecahedronGeometry(0.8 + r() * 1.2, 0); g.translate(cx + (r() - 0.5) * half * 1.4, 0.4, cz + (r() - 0.5) * (radius - width - 6)); rocks.push(g); }
    merged(poles, dark);
    merged(flags, keep(new THREE.MeshBasicMaterial({ color: 0xff7a1a, side: THREE.DoubleSide })));
    merged(rocks, keep(std(0x8e8a84, { flatShading: true })), { cast: true });
    const tex = keep(signTexture([{ text: "OFF-ROAD TRAIL", size: 120, color: "#ffcf33" }, { text: "SUVs WELCOME", size: 56, color: "#ffffff" }], { w: 1024, h: 250, bg: "#3a2a18", border: "#ffcf33" }));
    sign(tex, 9, 2.2, TRAIL.entryX + 8, 3.2, SOUTH_ROAD + ROAD_SIGN_GAP, 0);
    merged([boxAt(0.25, 4.3, 0.25, TRAIL.entryX + 3.6, 0, SOUTH_ROAD + ROAD_SIGN_GAP), boxAt(0.25, 4.3, 0.25, TRAIL.entryX + 12.4, 0, SOUTH_ROAD + ROAD_SIGN_GAP)], wood);
  }

  return { update() { /* nothing animates here yet */ } };
}

const ROAD_SIGN_GAP = 10;
