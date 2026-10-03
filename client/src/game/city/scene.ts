// Builds the static 3D city from the shared layout: ground, roads, districts,
// towers, trees, street lights and the speedway. Geometry that repeats is merged
// or instanced so the whole city draws in a few dozen calls.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  BLOCK_HALF, CINEMA, CITY, CONNECTOR, DEALER, FOUNTAIN, PETSHOP, ROAD_HALF, ROAD_LINES, STAGE, TOWERS, TRACK, TREES, BOUNDS, SOUTH_FIELD_HALF_X, SEASIDE, rng,
} from "@shared/city/layout";
import { buildDistricts } from "./districts";
import { LAP_LENGTH, START_S, trackPoint } from "@shared/city/race";
import { checkerTexture, doorTexture, posterTexture, signTexture, skyTexture, windowTextures } from "./textures";

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...extra });

function flat(w: number, d: number, x: number, z: number, y: number) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, z);
  return g;
}

/** A tower box whose side UVs tile the window texture (cells of 5×4 units, 4×4 per texture). */
function towerGeometry(w: number, h: number, d: number, x: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  // faces: +x, -x, +y, -y, +z, -z (4 vertices each)
  const faceW = [d, d, 0, 0, w, w];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      if (f === 2 || f === 3) { uv.setXY(i, 0.02, 0.02); continue; }
      uv.setXY(i, uv.getX(i) * (faceW[f] / 20), uv.getY(i) * (h / 16));
    }
  }
  g.translate(x, h / 2, z);
  return g;
}

export type CityScene = { update: (t: number) => void; dispose: () => void };

export function buildCity(scene: THREE.Scene): CityScene {
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(o: T) => { disposables.push(o); return o; };
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, opts: { cast?: boolean; receive?: boolean } = {}) => {
    keep(geo); const m = new THREE.Mesh(geo, mat);
    m.castShadow = !!opts.cast; m.receiveShadow = opts.receive ?? true;
    scene.add(m); return m;
  };

  // ── Sky, fog and light ──
  const sky = keep(skyTexture());
  scene.background = sky;
  scene.fog = new THREE.Fog(0x6a4a7a, 140, 420);
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x3a2a40, 1.25));

  // ── Ground ──
  const grass = keep(std(0x4f8f4a));
  const paved = keep(std(0x8d8a96));
  const roadMat = keep(std(0x2c2f3a, { roughness: 0.95 }));
  const sidewalk = keep(std(0xb8b4c2));
  add(flat(1400, 1400, 0, 100, -0.02), keep(std(0x3f7a3d)));

  // blocks: paved downtown, grass in Haven Heights and the park
  const blocks: THREE.BufferGeometry[] = [], lawns: THREE.BufferGeometry[] = [];
  for (const cx of [-80, 0, 80]) for (const cz of [-80, 0, 80]) {
    (cz === 80 ? lawns : blocks).push(flat(BLOCK_HALF * 2 + 4, BLOCK_HALF * 2 + 4, cx, cz, 0.01));
  }
  for (const c of [-143, 143]) for (const cz of [-143, -80, 0]) blocks.push(flat(30, cz === -143 ? 30 : BLOCK_HALF * 2 + 4, c, cz, 0.01));
  for (const cx of [-80, 0, 80]) blocks.push(flat(BLOCK_HALF * 2 + 4, 30, cx, -143, 0.01));
  add(mergeGeometries(blocks)!, paved);
  add(mergeGeometries(lawns)!, grass);
  add(flat(PETSHOP.park.maxX - PETSHOP.park.minX, PETSHOP.park.maxZ - PETSHOP.park.minZ, 0, (PETSHOP.park.minZ + PETSHOP.park.maxZ) / 2, 0.03), grass);

  // roads, sidewalks and lane paint
  const roads: THREE.BufferGeometry[] = [], walks: THREE.BufferGeometry[] = [], dashes: THREE.BufferGeometry[] = [], edges: THREE.BufferGeometry[] = [];
  const span = CITY * 2;
  for (const r of ROAD_LINES) {
    roads.push(flat(ROAD_HALF * 2, span, r, 0, 0.04), flat(span, ROAD_HALF * 2, 0, r, 0.04));
    for (const s of [-1, 1]) { walks.push(flat(1.6, span, r + s * (ROAD_HALF + 0.8), 0, 0.03), flat(span, 1.6, 0, r + s * (ROAD_HALF + 0.8), 0.03)); }
    for (let p = -CITY + 3; p < CITY; p += 6) {
      if (ROAD_LINES.some((q) => Math.abs(p - q) < ROAD_HALF + 2)) continue;
      dashes.push(flat(0.25, 2.6, r, p, 0.06), flat(2.6, 0.25, p, r, 0.06));
    }
    for (const s of [-1, 1]) { edges.push(flat(0.18, span, r + s * (ROAD_HALF - 0.4), 0, 0.055), flat(span, 0.18, 0, r + s * (ROAD_HALF - 0.4), 0.055)); }
  }
  roads.push(flat(ROAD_HALF * 2, CONNECTOR.toZ - 120 + 4, CONNECTOR.x, (120 + CONNECTOR.toZ) / 2 + 2, 0.04));
  for (let p = 126; p < CONNECTOR.toZ; p += 6) dashes.push(flat(0.25, 2.6, CONNECTOR.x, p, 0.06));
  add(mergeGeometries(roads)!, roadMat);
  add(mergeGeometries(walks)!, sidewalk);
  add(mergeGeometries(dashes)!, keep(new THREE.MeshBasicMaterial({ color: 0xffd76a })));
  add(mergeGeometries(edges)!, keep(new THREE.MeshBasicMaterial({ color: 0xe8e8f0 })));

  // crosswalks at every crossing
  const zebra: THREE.BufferGeometry[] = [];
  for (const a of ROAD_LINES) for (const b of ROAD_LINES) for (const s of [-1, 1]) for (let k = -2; k <= 2; k++) {
    zebra.push(flat(0.9, 2.2, a + k * 2.2, b + s * (ROAD_HALF + 1.3), 0.058));
    zebra.push(flat(2.2, 0.9, a + s * (ROAD_HALF + 1.3), b + k * 2.2, 0.058));
  }
  add(mergeGeometries(zebra)!, keep(new THREE.MeshBasicMaterial({ color: 0xf2f2f2 })));

  // ── Downtown towers ──
  const win = windowTextures(11);
  keep(win.map); keep(win.emissive);
  const towerColors = [0x9aa7c7, 0xc7b39a, 0x8fb8b0, 0xb79ac7, 0xd0d0d8, 0x9ab0d8];
  const byColor: THREE.BufferGeometry[][] = towerColors.map(() => []);
  const roofs: THREE.BufferGeometry[] = [];
  for (const t of TOWERS) {
    const w = t.maxX - t.minX, d = t.maxZ - t.minZ, x = (t.minX + t.maxX) / 2, z = (t.minZ + t.maxZ) / 2;
    byColor[t.color].push(towerGeometry(w, t.height, d, x, z));
    roofs.push(boxAt(w * 0.4, 1.6, d * 0.4, x, t.height, z));
  }
  byColor.forEach((list, i) => {
    if (!list.length) return;
    const mat = keep(std(towerColors[i], { map: win.map, emissiveMap: win.emissive, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.6, metalness: 0.2 }));
    add(mergeGeometries(list)!, mat, { cast: true });
  });
  add(mergeGeometries(roofs)!, keep(std(0x3a3d4a)), { cast: true });

  // ── Central Plaza ──
  const basin = new THREE.Mesh(keep(new THREE.CylinderGeometry(4.4, 4.7, 0.9, 32)), keep(std(0xd8d2e2)));
  basin.position.set(0, 0.45, 0); basin.castShadow = true; basin.receiveShadow = true; scene.add(basin);
  const waterMat = keep(new THREE.MeshStandardMaterial({ color: 0x4fd1ff, emissive: 0x1a6aa8, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 }));
  const water = new THREE.Mesh(keep(new THREE.CylinderGeometry(4.0, 4.0, 0.1, 32)), waterMat); water.position.set(0, 0.86, 0); scene.add(water);
  const jet = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.25, 0.6, 3.4, 12, 1, true)), keep(new THREE.MeshStandardMaterial({ color: 0xbff1ff, emissive: 0x7fdcff, emissiveIntensity: 0.8, transparent: true, opacity: 0.55 })));
  jet.position.set(0, 2.5, 0); scene.add(jet);
  void FOUNTAIN;
  // stage with neon trim
  const stage = new THREE.Mesh(keep(new THREE.BoxGeometry(STAGE.maxX - STAGE.minX, 1.1, STAGE.maxZ - STAGE.minZ)), keep(std(0x2a2240)));
  stage.position.set(0, 0.55, (STAGE.minZ + STAGE.maxZ) / 2); stage.castShadow = true; stage.receiveShadow = true; scene.add(stage);
  const neonPink = keep(new THREE.MeshBasicMaterial({ color: 0xff5fd8 })), neonCyan = keep(new THREE.MeshBasicMaterial({ color: 0x3ee6ff }));
  const trim = new THREE.Mesh(keep(new THREE.BoxGeometry(STAGE.maxX - STAGE.minX + 0.2, 0.12, 0.12)), neonPink); trim.position.set(0, 1.12, STAGE.maxZ); scene.add(trim);
  const stageSign = signTexture([{ text: "HANGOUT STAGE", size: 120, color: "#ff5fd8" }], { w: 1024, h: 200, bg: "#140a26" }); keep(stageSign);
  const ss = new THREE.Mesh(keep(new THREE.PlaneGeometry(12, 2.3)), keep(new THREE.MeshBasicMaterial({ map: stageSign })));
  ss.position.set(0, 4.2, STAGE.minZ + 0.5); scene.add(ss);
  for (const x of [-6.5, 6.5]) { const post = new THREE.Mesh(keep(new THREE.BoxGeometry(0.3, 4.4, 0.3)), neonCyan); post.position.set(x, 3, STAGE.minZ + 0.4); scene.add(post); }
  // benches around the fountain
  const benches: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8, rad = 10;
    const g = new THREE.BoxGeometry(3, 0.5, 0.9); g.rotateY(-a + Math.PI / 2); g.translate(Math.cos(a) * rad, 0.5, Math.sin(a) * rad);
    benches.push(g);
  }
  add(mergeGeometries(benches)!, keep(std(0x8a5a3c)), { cast: true });
  // welcome arch on the north edge of the plaza
  const archSign = signTexture([{ text: "HAVEN CITY", size: 150, color: "#3ee6ff" }, { text: "A.R.I.S.E. HANGOUT", size: 56, color: "#ffd36b" }], { w: 1024, h: 300, bg: "#0e0a22", border: "#3ee6ff" }); keep(archSign);
  for (const z of [-33, 33]) {
    const arch = new THREE.Mesh(keep(new THREE.PlaneGeometry(14, 4.1)), keep(new THREE.MeshBasicMaterial({ map: archSign, side: THREE.DoubleSide })));
    arch.position.set(0, 7.2, z); scene.add(arch);
    for (const x of [-7.2, 7.2]) { const p = new THREE.Mesh(keep(new THREE.BoxGeometry(0.5, 9, 0.5)), keep(std(0x2a2240))); p.position.set(x, 4.5, z); p.castShadow = true; scene.add(p); }
  }

  // ── Starlight Cinema ──
  {
    const b = CINEMA.building, w = b.maxX - b.minX, d = b.maxZ - b.minZ, cx = (b.minX + b.maxX) / 2;
    add(boxAt(w, CINEMA.height, d, cx, 0, 0), keep(std(0x5a1a2e, { roughness: 0.7 })), { cast: true });
    add(boxAt(w + 1, 1.2, d + 1, cx, CINEMA.height, 0), keep(std(0xd9a84a, { metalness: 0.5, roughness: 0.4 })));
    const marquee = signTexture([{ text: "STARLIGHT", size: 130, color: "#ffd36b" }, { text: "CINEMA · NOW SHOWING", size: 64, color: "#ff8fb0" }], { w: 1024, h: 330, bg: "#1a0610", border: "#ffd36b" }); keep(marquee);
    const m = new THREE.Mesh(keep(new THREE.BoxGeometry(1.2, 5.5, 17)), [keep(new THREE.MeshBasicMaterial({ color: 0x1a0610 })), keep(new THREE.MeshBasicMaterial({ map: marquee })), keep(new THREE.MeshBasicMaterial({ color: 0x1a0610 })), keep(new THREE.MeshBasicMaterial({ color: 0x1a0610 })), keep(new THREE.MeshBasicMaterial({ color: 0x1a0610 })), keep(new THREE.MeshBasicMaterial({ color: 0x1a0610 }))]);
    m.position.set(b.minX - 0.8, 9, 0); scene.add(m);
    // glass doors and two movie posters on the front wall
    const doors = keep(doorTexture());
    const door = new THREE.Mesh(keep(new THREE.PlaneGeometry(7, 4.2)), keep(new THREE.MeshBasicMaterial({ map: doors })));
    door.position.set(b.minX - 0.05, 2.1, 0); door.rotation.y = -Math.PI / 2; scene.add(door);
    [["SPACE QUEST", "#3b82f6", "#a855f7"], ["OCEAN WONDERS", "#14b8a6", "#0ea5e9"]].forEach(([title, a, c], i) => {
      const tex = keep(posterTexture(title, a, c));
      const poster = new THREE.Mesh(keep(new THREE.PlaneGeometry(3, 4.4)), keep(new THREE.MeshBasicMaterial({ map: tex })));
      poster.position.set(b.minX - 0.06, 2.8, i ? 7.5 : -7.5); poster.rotation.y = -Math.PI / 2; scene.add(poster);
    });
    // red carpet and rope posts
    add(flat(4, 7, b.minX - 2.5, 0, 0.06), keep(std(0xb3122e)));
    const posts: THREE.BufferGeometry[] = [];
    for (const z of [-3.2, 3.2]) for (const x of [b.minX - 1.2, b.minX - 4]) posts.push(boxAt(0.25, 1.1, 0.25, x, 0, z));
    add(mergeGeometries(posts)!, keep(std(0xd9a84a, { metalness: 0.6, roughness: 0.3 })));
  }

  // ── Velocity Motors ──
  {
    const b = DEALER.building, w = b.maxX - b.minX, d = b.maxZ - b.minZ, cx = (b.minX + b.maxX) / 2;
    add(boxAt(w, DEALER.height, d, cx, 0, 0), keep(new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x2a6aa8, emissiveIntensity: 0.55, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.9 })), { cast: true });
    add(boxAt(w + 1, 0.8, d + 1, cx, DEALER.height, 0), keep(std(0x1f2433)));
    const sign = signTexture([{ text: "VELOCITY MOTORS", size: 120, color: "#3ee6ff" }], { w: 1024, h: 180, bg: "#0a1424" }); keep(sign);
    const s = new THREE.Mesh(keep(new THREE.PlaneGeometry(16, 2.8)), keep(new THREE.MeshBasicMaterial({ map: sign })));
    s.position.set(b.maxX + 0.05, DEALER.height - 1.8, 0); s.rotation.y = Math.PI / 2; scene.add(s);
    const pads: THREE.BufferGeometry[] = [];
    for (const p of DEALER.showcase) pads.push(boxAt(5.6, 0.35, 3.4, p.x, 0, p.z));
    add(mergeGeometries(pads)!, keep(new THREE.MeshStandardMaterial({ color: 0x1b2232, emissive: 0x3ee6ff, emissiveIntensity: 0.25 })));
  }

  // ── Paws & Pals ──
  {
    const b = PETSHOP.building, w = b.maxX - b.minX, d = b.maxZ - b.minZ, cz = (b.minZ + b.maxZ) / 2;
    add(boxAt(w, PETSHOP.height, d, 0, 0, cz), keep(std(0xffcf8a, { roughness: 0.8 })), { cast: true });
    const awning = new THREE.Mesh(keep(new THREE.BoxGeometry(w * 0.7, 0.3, 3)), keep(std(0x2fb8a4))); awning.position.set(0, 4.2, b.maxZ + 1.2); awning.rotation.x = -0.25; scene.add(awning);
    const sign = signTexture([{ text: "PAWS & PALS", size: 130, color: "#ff8a3d" }, { text: "PET SHOP · PET CARE", size: 56, color: "#2fb8a4" }], { w: 1024, h: 280, bg: "#fff4e0" }); keep(sign);
    const s = new THREE.Mesh(keep(new THREE.PlaneGeometry(14, 3.8)), keep(new THREE.MeshBasicMaterial({ map: sign })));
    s.position.set(0, PETSHOP.height + 2.3, b.maxZ + 0.05); scene.add(s);
    // dog park fence and toys
    const p = PETSHOP.park, fence: THREE.BufferGeometry[] = [];
    for (let x = p.minX; x <= p.maxX; x += 2) for (const z of [p.minZ, p.maxZ]) if (Math.abs(x) > 3) fence.push(boxAt(0.15, 1, 0.15, x, 0, z));
    for (let z = p.minZ; z <= p.maxZ; z += 2) for (const x of [p.minX, p.maxX]) fence.push(boxAt(0.15, 1, 0.15, x, 0, z));
    add(mergeGeometries(fence)!, keep(std(0xf2f2f2)));
    const toys = [0xff5f5f, 0x5fb8ff, 0xffd23f];
    toys.forEach((c, i) => { const ball = new THREE.Mesh(keep(new THREE.SphereGeometry(0.5, 16, 12)), keep(std(c, { roughness: 0.4 }))); ball.position.set(-14 + i * 12, 0.5, -64 + (i % 2) * 6); ball.castShadow = true; scene.add(ball); });
    const ramp = new THREE.Mesh(keep(new THREE.BoxGeometry(5, 0.3, 2)), keep(std(0x2fb8a4))); ramp.position.set(16, 0.7, -60); ramp.rotation.z = 0.3; scene.add(ramp);
  }

  // ── Trees ──
  {
    const trunk = keep(new THREE.CylinderGeometry(0.22, 0.3, 2.2, 6)); trunk.translate(0, 1.1, 0);
    const crown = keep(new THREE.IcosahedronGeometry(1.6, 0)); crown.translate(0, 3.2, 0);
    const tm = new THREE.InstancedMesh(trunk, keep(std(0x6b4a32)), TREES.length);
    const cm = new THREE.InstancedMesh(crown, keep(std(0x3f8f52, { flatShading: true })), TREES.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), color = new THREE.Color();
    const r = rng(99);
    TREES.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI);
      m4.compose(new THREE.Vector3(t.x, 0, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
      tm.setMatrixAt(i, m4); cm.setMatrixAt(i, m4);
      cm.setColorAt(i, color.setHSL(0.28 + r() * 0.08, 0.45, 0.32 + r() * 0.1));
    });
    tm.castShadow = cm.castShadow = true;
    scene.add(tm, cm);
  }

  // ── Street lights ──
  const lampSpots: [number, number][] = [];
  for (const r of ROAD_LINES) for (let p = -CITY + 10; p < CITY; p += 28) {
    if (ROAD_LINES.some((q) => Math.abs(p - q) < 12)) continue;
    lampSpots.push([r + ROAD_HALF + 1.6, p], [p, r - ROAD_HALF - 1.6]);
  }
  for (let p = 130; p < CONNECTOR.toZ; p += 20) lampSpots.push([CONNECTOR.x + ROAD_HALF + 1.6, p]);
  {
    const pole = keep(new THREE.CylinderGeometry(0.1, 0.14, 6, 6)); pole.translate(0, 3, 0);
    const head = keep(new THREE.SphereGeometry(0.4, 10, 8)); head.translate(0, 6.1, 0);
    const pm = new THREE.InstancedMesh(pole, keep(std(0x2a2d38)), lampSpots.length);
    const hm = new THREE.InstancedMesh(head, keep(new THREE.MeshBasicMaterial({ color: 0xffe2a0 })), lampSpots.length);
    const m4 = new THREE.Matrix4();
    lampSpots.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); pm.setMatrixAt(i, m4); hm.setMatrixAt(i, m4); });
    scene.add(pm, hm);
  }

  // ── Haven Speedway ──
  {
    const { cx, cz, half, radius, width } = TRACK;
    const stadium = (rad: number) => {
      const s = new THREE.Shape();
      s.moveTo(cx - half, cz - rad);
      s.lineTo(cx + half, cz - rad);
      s.absarc(cx + half, cz, rad, -Math.PI / 2, Math.PI / 2, false);
      s.lineTo(cx - half, cz + rad);
      s.absarc(cx - half, cz, rad, Math.PI / 2, Math.PI * 1.5, false);
      return s;
    };
    const outer = stadium(radius + width);
    const inner = stadium(radius - width);
    outer.holes.push(new THREE.Path(inner.getPoints(64).reverse()));
    const tg = keep(new THREE.ShapeGeometry(outer, 48));
    tg.rotateX(Math.PI / 2); // shape is drawn in x/z via its y axis
    tg.translate(0, 0.05, 0);
    const track = new THREE.Mesh(tg, keep(std(0x262832, { roughness: 0.9, side: THREE.DoubleSide })));
    track.receiveShadow = true; scene.add(track);
    // curbs: red and white blocks along both edges
    const curbGeo = keep(new THREE.BoxGeometry(2.2, 0.12, 0.8));
    const n = Math.floor(LAP_LENGTH / 2.4);
    const red = new THREE.InstancedMesh(curbGeo, keep(std(0xe23b4a)), n * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    const white = new THREE.Color(0xf4f4f4), redC = new THREE.Color(0xe23b4a);
    let k = 0;
    for (let i = 0; i < n; i++) for (const off of [-width, width]) {
      const p = trackPoint(i * (LAP_LENGTH / n), off);
      q.setFromAxisAngle(up, p.heading + Math.PI / 2);
      m4.compose(new THREE.Vector3(p.x, 0.08, p.z), q, one);
      red.setMatrixAt(k, m4); red.setColorAt(k, i % 2 ? white : redC); k++;
    }
    scene.add(red);
    // start / finish line
    const chk = keep(checkerTexture()); chk.repeat.set(1, 6);
    const start = trackPoint(START_S);
    const line = new THREE.Mesh(keep(new THREE.PlaneGeometry(2, width * 2)), keep(new THREE.MeshBasicMaterial({ map: chk })));
    line.rotation.x = -Math.PI / 2; line.position.set(start.x, 0.07, start.z); scene.add(line);
    // gantry over the line
    const gSign = signTexture([{ text: "HAVEN SPEEDWAY", size: 120, color: "#ffd23f" }], { w: 1024, h: 180, bg: "#111" }); keep(gSign);
    const gantry = new THREE.Mesh(keep(new THREE.PlaneGeometry(width * 2 + 2, 2.6)), keep(new THREE.MeshBasicMaterial({ map: gSign, side: THREE.DoubleSide })));
    gantry.position.set(start.x, 7, start.z); gantry.rotation.y = -Math.PI / 2; scene.add(gantry);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(keep(new THREE.BoxGeometry(0.5, 8.3, 0.5)), keep(std(0x333))); p.position.set(start.x, 4.15, start.z + s * (width + 1)); scene.add(p); }
    // grandstands along the top straight
    const stands: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) for (let row = 0; row < 4; row++) stands.push(boxAt(46, 1, 2, sx * 40, row * 1, cz - radius - width - 6 - row * 2));
    add(mergeGeometries(stands)!, keep(std(0x3a5aa8)), { cast: true });
    // crowd: little coloured blocks on the stands
    const crowdGeo = keep(new THREE.BoxGeometry(0.6, 0.9, 0.6));
    const crowd = new THREE.InstancedMesh(crowdGeo, keep(std(0xffffff)), 160);
    const cr = rng(5); const col = new THREE.Color();
    for (let i = 0; i < 160; i++) {
      const row = i % 4, sx = i % 8 < 4 ? -1 : 1;
      m4.makeTranslation(sx * 40 + (cr() - 0.5) * 44, row + 1.45, cz - radius - width - 6 - row * 2);
      crowd.setMatrixAt(i, m4); crowd.setColorAt(i, col.setHSL(cr(), 0.6, 0.55));
    }
    scene.add(crowd);
  }

  // ── The beach, the pier, Lakeside Park and the Stunt Park ──
  const districts = buildDistricts(scene, keep);

  // ── Outer edge: a low hedge round everything except the ocean ──
  {
    const hedge: THREE.BufferGeometry[] = [];
    const west = SEASIDE.ocean, east = BOUNDS.maxX;
    hedge.push(boxAt(east - west, 1.2, 1.4, (west + east) / 2, 0, -CITY - 0.7)); // north
    hedge.push(boxAt(1.4, 1.2, CITY * 2, east + 0.7, 0, 0)); // east
    hedge.push(boxAt(-SOUTH_FIELD_HALF_X - west, 1.2, 1.4, (west - SOUTH_FIELD_HALF_X) / 2, 0, CITY + 0.7)); // south, west of the speedway fields
    hedge.push(boxAt(east - SOUTH_FIELD_HALF_X, 1.2, 1.4, (east + SOUTH_FIELD_HALF_X) / 2, 0, CITY + 0.7)); // south, east of them
    for (const s of [-1, 1]) hedge.push(boxAt(1.4, 1.2, BOUNDS.maxZ - CITY, s * (SOUTH_FIELD_HALF_X + 0.7), 0, (CITY + BOUNDS.maxZ) / 2));
    hedge.push(boxAt(SOUTH_FIELD_HALF_X * 2, 1.2, 1.4, 0, 0, BOUNDS.maxZ + 0.7));
    add(mergeGeometries(hedge)!, keep(std(0x2f6b35)), { cast: true });
  }

  return {
    update(t: number) {
      jet.scale.y = 1 + Math.sin(t * 3) * 0.12;
      water.position.y = 0.86 + Math.sin(t * 2) * 0.02;
      (neonPink as THREE.MeshBasicMaterial).color.setHSL(0.88 + Math.sin(t * 1.5) * 0.04, 1, 0.65);
      districts.update(t);
    },
    dispose() { disposables.forEach((d) => d.dispose()); },
  };
}
