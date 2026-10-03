// The districts outside the grid: Seaside Boardwalk (west) with its beach, pier
// and Ferris wheel, and Lakeside Park (east) with the lake loop, lookout tower,
// picnic lawn and the Stunt Park ramps. Same approach as scene.ts: shared data
// from the layout, merged or instanced geometry, a few animated parts.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  BEACH_SHOPS, CITY, EXTENDED_ROADS, FERRIS, LIFEGUARD, LOOKOUT, PALMS, PARK, PARK_TREES, PICNIC, RAMPS, ROAD_HALF, SEASIDE, STUNT_ROAD, loopEntryX, rng,
} from "@shared/city/layout";
import { chevronTexture, doorTexture, plankTexture, sandTexture, signTexture } from "./textures";

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...extra });

/** A ground rectangle whose UVs tile every `tile` units. */
function flat(w: number, d: number, x: number, z: number, y: number, tile = 0) {
  const g = new THREE.PlaneGeometry(w, d);
  if (tile) { const uv = g.getAttribute("uv") as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / tile), uv.getY(i) * (d / tile)); }
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);
  return g;
}
function boxAt(w: number, h: number, d: number, x: number, y: number, z: number, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y + h / 2, z);
  return g;
}
/** A thin post between two points. */
function beam(a: THREE.Vector3, b: THREE.Vector3, r: number) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, 6);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  const m = a.clone().add(b).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}

export type Districts = { update: (t: number) => void };

export function buildDistricts(scene: THREE.Scene, keep: <T extends { dispose: () => void }>(o: T) => T): Districts {
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, opts: { cast?: boolean; receive?: boolean } = {}) => {
    keep(geo); const m = new THREE.Mesh(geo, mat);
    m.castShadow = !!opts.cast; m.receiveShadow = opts.receive ?? true;
    scene.add(m); return m;
  };
  const merged = (list: THREE.BufferGeometry[], mat: THREE.Material, opts: { cast?: boolean } = {}) => { if (list.length) add(mergeGeometries(list)!, mat, opts); list.forEach((g) => g.dispose()); };
  /** A sign readable from both sides (two planes back to back, so the text is never mirrored). */
  const sign = (tex: THREE.Texture, w: number, h: number, x: number, y: number, z: number, rotY: number, twoSided = true) => {
    const mat = keep(new THREE.MeshBasicMaterial({ map: tex }));
    for (const flip of twoSided ? [0, Math.PI] : [0]) {
      const p = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, h)), mat);
      p.position.set(x, y, z); p.rotation.y = rotY + flip; scene.add(p);
    }
  };

  const roadMat = keep(std(0x2c2f3a, { roughness: 0.95 }));
  const paint = keep(new THREE.MeshBasicMaterial({ color: 0xffd76a }));
  const white = keep(new THREE.MeshBasicMaterial({ color: 0xe8e8f0 }));
  const paved = keep(std(0x9a96a2));
  const wood = keep(std(0x8a5a3c));
  const darkWood = keep(std(0x5e3d28));
  const roads: THREE.BufferGeometry[] = [], dashes: THREE.BufferGeometry[] = [], lines: THREE.BufferGeometry[] = [];
  const lamps: [number, number][] = [];

  // ═══ Seaside Boardwalk ═══════════════════════════════════════════════════
  const bw = SEASIDE.boardwalk;
  // paved promenade between the city and the boardwalk, then planks, then sand
  add(flat(-CITY - bw.maxX + 0.5, CITY * 2, (bw.maxX - CITY) / 2, 0, 0.01), paved);
  const planks = keep(plankTexture());
  add(flat(bw.maxX - bw.minX, CITY * 2, (bw.minX + bw.maxX) / 2, 0, 0.03, 4), keep(std(0xffffff, { map: planks, roughness: 0.9 })));
  const sand = keep(sandTexture());
  add(flat(bw.minX - (SEASIDE.ocean - 6), CITY * 2, (bw.minX + SEASIDE.ocean - 6) / 2, 0, 0.012, 6), keep(std(0xffffff, { map: sand, roughness: 1 })));
  // ocean and a line of surf
  const oceanMat = keep(new THREE.MeshStandardMaterial({ color: 0x1f86c9, emissive: 0x0b3d66, emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.15 }));
  add(flat(900, 1400, SEASIDE.ocean - 450, 100, 0.03), oceanMat, { receive: false });
  const foamMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
  const foam = add(flat(3, CITY * 2 + 40, SEASIDE.ocean + 0.5, 0, 0.04), foamMat, { receive: false });

  // coast road and the two avenues that lead to it
  roads.push(flat(ROAD_HALF * 2, CITY * 2, SEASIDE.road, 0, 0.04));
  for (let z = -CITY + 3; z < CITY; z += 6) if (!EXTENDED_ROADS.some((r) => Math.abs(z - r) < ROAD_HALF + 2)) dashes.push(flat(0.25, 2.6, SEASIDE.road, z, 0.06));
  for (const s of [-1, 1]) lines.push(flat(0.18, CITY * 2, SEASIDE.road + s * (ROAD_HALF - 0.4), 0, 0.055));
  for (const r of EXTENDED_ROADS) {
    const x0 = SEASIDE.road + ROAD_HALF, x1 = -CITY;
    roads.push(flat(x1 - x0 + 1, ROAD_HALF * 2, (x0 + x1) / 2, r, 0.045));
    for (let x = x0 + 3; x < x1; x += 6) dashes.push(flat(2.6, 0.25, x, r, 0.06));
  }
  for (let z = -CITY + 12; z < CITY; z += 26) if (!EXTENDED_ROADS.some((r) => Math.abs(z - r) < 10)) lamps.push([SEASIDE.road + ROAD_HALF + 1.6, z], [SEASIDE.road - ROAD_HALF - 1.6, z]);

  // beach shops facing the coast road
  for (const shop of BEACH_SHOPS) {
    const b = shop.box, w = b.maxX - b.minX, d = b.maxZ - b.minZ;
    add(boxAt(w, 6, d, shop.x, 0, shop.z), keep(std(new THREE.Color(shop.color).lerp(new THREE.Color(0xffffff), 0.45).getHex())), { cast: true });
    add(boxAt(w + 0.8, 0.6, d + 0.8, shop.x, 6, shop.z), keep(std(shop.color)));
    // striped awning over the front
    const stripes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) { const g = new THREE.BoxGeometry(2.6, 0.18, d / 7); g.rotateZ(0.32); g.translate(b.minX - 1.1, 3.9, b.minZ + (i + 0.5) * (d / 7)); stripes.push(g); }
    merged(stripes.filter((_, i) => i % 2 === 0), keep(std(shop.color)));
    merged(stripes.filter((_, i) => i % 2 === 1), keep(std(0xffffff)));
    const tex = keep(signTexture([{ text: shop.name.toUpperCase(), size: 120, color: "#" + shop.color.toString(16).padStart(6, "0") }], { w: 1024, h: 200, bg: "#141026" }));
    sign(tex, 11, 2.1, b.minX - 0.06, 5.1, shop.z, -Math.PI / 2, false);
    const door = new THREE.Mesh(keep(new THREE.PlaneGeometry(4, 3)), keep(new THREE.MeshBasicMaterial({ map: keep(doorTexture()) })));
    door.position.set(b.minX - 0.05, 1.5, shop.z); door.rotation.y = -Math.PI / 2; scene.add(door);
  }

  // palms
  {
    const r = rng(77);
    const trunkParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) { const g = new THREE.CylinderGeometry(0.2 - i * 0.02, 0.26 - i * 0.02, 1.6, 6); g.translate(i * 0.12, 0.8 + i * 1.5, 0); trunkParts.push(g); }
    const trunk = keep(mergeGeometries(trunkParts)!); trunkParts.forEach((g) => g.dispose());
    const leafParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) {
      const g = new THREE.BoxGeometry(0.9, 0.08, 3.6); g.translate(0, 0, 1.7); g.rotateX(0.45); g.rotateY((i / 7) * Math.PI * 2); g.translate(0.6, 7.7, 0);
      leafParts.push(g);
    }
    const crown = keep(mergeGeometries(leafParts)!); leafParts.forEach((g) => g.dispose());
    const tm = new THREE.InstancedMesh(trunk, keep(std(0x8b6a45)), PALMS.length);
    const cm = new THREE.InstancedMesh(crown, keep(std(0x2f9a4e, { flatShading: true })), PALMS.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    PALMS.forEach((p, i) => {
      q.setFromAxisAngle(up, r() * Math.PI * 2);
      m4.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
      tm.setMatrixAt(i, m4); cm.setMatrixAt(i, m4);
    });
    tm.castShadow = cm.castShadow = true;
    scene.add(tm, cm);
  }

  // umbrellas and towels on the sand
  {
    const r = rng(2024);
    const spots: { x: number; z: number }[] = [];
    for (let i = 0; i < 60 && spots.length < 26; i++) {
      const x = SEASIDE.ocean + 8 + r() * (bw.minX - SEASIDE.ocean - 14), z = -CITY + 8 + r() * (CITY * 2 - 16);
      if (Math.abs(z) < 12 || Math.hypot(x - LIFEGUARD.x, z - LIFEGUARD.z) < 8 || spots.some((s) => Math.hypot(s.x - x, s.z - z) < 9)) continue;
      spots.push({ x, z });
    }
    const pole = keep(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5)); pole.translate(0, 1.3, 0);
    const canopy = keep(new THREE.ConeGeometry(1.8, 0.7, 10, 1, true)); canopy.translate(0, 2.6, 0);
    const towel = keep(new THREE.PlaneGeometry(1.1, 2.2)); towel.rotateX(-Math.PI / 2); towel.translate(1.6, 0.03, 0.4);
    const pm = new THREE.InstancedMesh(pole, keep(std(0xf2f2f2)), spots.length);
    const cm = new THREE.InstancedMesh(canopy, keep(std(0xffffff, { side: THREE.DoubleSide })), spots.length);
    const twm = new THREE.InstancedMesh(towel, keep(std(0xffffff)), spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    const palette = [0xff5f7a, 0x3ee6ff, 0xffd36b, 0x7cf29a, 0xa974ff, 0xff9a3d];
    spots.forEach((s, i) => {
      q.setFromAxisAngle(up, r() * Math.PI * 2);
      m4.compose(new THREE.Vector3(s.x, 0, s.z), q, one);
      pm.setMatrixAt(i, m4); cm.setMatrixAt(i, m4); twm.setMatrixAt(i, m4);
      cm.setColorAt(i, col.setHex(palette[i % palette.length])); twm.setColorAt(i, col.setHex(palette[(i + 2) % palette.length]));
    });
    cm.castShadow = true;
    scene.add(pm, cm, twm);
  }

  // lifeguard tower
  {
    const { x, z } = LIFEGUARD, parts: THREE.BufferGeometry[] = [];
    for (const dx of [-1.3, 1.3]) for (const dz of [-1.3, 1.3]) parts.push(beam(new THREE.Vector3(x + dx, 0, z + dz), new THREE.Vector3(x + dx * 0.7, 3.2, z + dz * 0.7), 0.12));
    parts.push(boxAt(2.8, 0.2, 2.8, x, 3.2, z));
    merged(parts, keep(std(0xf2f2f2)), { cast: true });
    add(boxAt(2.4, 1.8, 2.4, x, 3.4, z), keep(std(0xe23b4a)), { cast: true });
    add(boxAt(3, 0.25, 3, x, 5.2, z), keep(std(0xffffff)));
    const tex = keep(signTexture([{ text: "LIFEGUARD", size: 110, color: "#e23b4a" }], { w: 512, h: 128, bg: "#ffffff" }));
    sign(tex, 2.3, 0.6, x - 1.22, 4.5, z, -Math.PI / 2, false);
  }

  // the pier: planks from the boardwalk out over the water, rails and posts
  const pier = SEASIDE.pier;
  {
    const len = bw.minX - pier.minX, cx = (bw.minX + pier.minX) / 2, wz = pier.maxZ - pier.minZ;
    add(flat(len, wz, cx, 0, 0.14, 4), keep(std(0xffffff, { map: planks, roughness: 0.9 })));
    const rails: THREE.BufferGeometry[] = [], posts: THREE.BufferGeometry[] = [];
    for (const z of [pier.minZ + 0.2, pier.maxZ - 0.2]) {
      rails.push(boxAt(pier.maxX - pier.minX, 0.12, 0.12, (pier.minX + pier.maxX) / 2, 1.05, z));
      for (let x = pier.minX + 0.2; x <= pier.maxX; x += 3) posts.push(boxAt(0.14, 1.15, 0.14, x, 0, z));
    }
    rails.push(boxAt(0.12, 0.12, wz, pier.minX + 0.2, 1.05, 0));
    for (let x = pier.minX + 1; x < SEASIDE.ocean; x += 6) for (const z of [pier.minZ + 0.6, pier.maxZ - 0.6]) posts.push(boxAt(0.5, 0.6, 0.5, x, -0.45, z));
    merged(rails, white);
    merged(posts, darkWood);
    // a welcome arch where the pier leaves the boardwalk
    const tex = keep(signTexture([{ text: "HAVEN PIER", size: 140, color: "#3ee6ff" }], { w: 1024, h: 220, bg: "#0e0a22", border: "#ff5fd8" }));
    sign(tex, 11, 2.4, bw.minX - 1, 6.6, 0, Math.PI / 2);
    const arch: THREE.BufferGeometry[] = [];
    for (const z of [pier.minZ - 0.4, pier.maxZ + 0.4]) arch.push(boxAt(0.4, 7.8, 0.4, bw.minX - 1, 0, z));
    merged(arch, keep(std(0x2a2240)), { cast: true });
  }

  // the Ferris wheel at the end of the pier
  const wheel = new THREE.Group();
  const gondolas: THREE.Object3D[] = [];
  {
    const hub = 17;
    const legs: THREE.BufferGeometry[] = [];
    for (const dx of [-2.2, 2.2]) for (const dz of [-8, 8]) legs.push(beam(new THREE.Vector3(FERRIS.x + dx, 0, dz), new THREE.Vector3(FERRIS.x + dx * 0.5, hub, 0), 0.3));
    legs.push(beam(new THREE.Vector3(FERRIS.x - 2.4, hub, 0), new THREE.Vector3(FERRIS.x + 2.4, hub, 0), 0.45));
    merged(legs, keep(std(0xe8e8f0, { metalness: 0.4, roughness: 0.4 })), { cast: true });
    wheel.position.set(FERRIS.x, hub, 0);
    scene.add(wheel);
    const rimMat = keep(new THREE.MeshBasicMaterial({ color: 0xff5fd8 }));
    for (const dx of [-1.1, 1.1]) {
      const rim = new THREE.Mesh(keep(new THREE.TorusGeometry(FERRIS.r, 0.22, 6, 64)), rimMat);
      rim.rotation.y = Math.PI / 2; rim.position.x = dx; wheel.add(rim);
    }
    const spokes: THREE.BufferGeometry[] = [];
    const N = 12;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      for (const dx of [-1.1, 1.1]) spokes.push(beam(new THREE.Vector3(dx, 0, 0), new THREE.Vector3(dx, Math.sin(a) * FERRIS.r, Math.cos(a) * FERRIS.r), 0.07));
    }
    const sp = new THREE.Mesh(keep(mergeGeometries(spokes)!), keep(std(0xf2f2f2, { metalness: 0.4 }))); spokes.forEach((g) => g.dispose());
    wheel.add(sp);
    const cabinColors = [0x3ee6ff, 0xffd36b, 0xff5f7a, 0x7cf29a];
    const cabinGeo = keep(new THREE.BoxGeometry(1.8, 1.4, 1.6)); cabinGeo.translate(0, -1.2, 0);
    const roofGeo = keep(new THREE.BoxGeometry(2, 0.2, 1.8)); roofGeo.translate(0, -0.4, 0);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const g = new THREE.Group();
      g.position.set(0, Math.sin(a) * FERRIS.r, Math.cos(a) * FERRIS.r);
      g.add(new THREE.Mesh(cabinGeo, keep(std(cabinColors[i % cabinColors.length]))), new THREE.Mesh(roofGeo, white));
      wheel.add(g); gondolas.push(g);
    }
  }

  // ═══ Lakeside Park ═══════════════════════════════════════════════════════
  const { lake, loop, stunt } = PARK;
  // the avenues out to the loop road, and the road up to the stunt park
  for (const r of EXTENDED_ROADS) {
    const x0 = CITY, x1 = loopEntryX(r) + 2;
    roads.push(flat(x1 - x0 + 1, ROAD_HALF * 2, (x0 + x1) / 2, r, 0.045));
    for (let x = x0 + 3; x < x1 - 3; x += 6) if (Math.abs(x - STUNT_ROAD.x) > ROAD_HALF + 1) dashes.push(flat(2.6, 0.25, x, r, 0.06));
    for (let x = x0 + 14; x < x1 - 6; x += 26) lamps.push([x, r - ROAD_HALF - 1.6]);
  }
  roads.push(flat(ROAD_HALF * 2, STUNT_ROAD.toZ - STUNT_ROAD.fromZ + 2, STUNT_ROAD.x, (STUNT_ROAD.fromZ + STUNT_ROAD.toZ) / 2, 0.047));
  // loop road round the lake
  const ring = keep(new THREE.RingGeometry(loop.r - ROAD_HALF, loop.r + ROAD_HALF, 120, 1)); ring.rotateX(-Math.PI / 2); ring.translate(loop.x, 0.046, loop.z);
  add(ring, roadMat);
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const g = new THREE.PlaneGeometry(0.25, 2.6); g.rotateX(-Math.PI / 2); g.rotateY(-a); g.translate(loop.x + Math.cos(a) * loop.r, 0.062, loop.z + Math.sin(a) * loop.r);
    dashes.push(g);
    if (i % 4 === 0) lamps.push([loop.x + Math.cos(a) * (loop.r + ROAD_HALF + 1.6), loop.z + Math.sin(a) * (loop.r + ROAD_HALF + 1.6)]);
  }
  // the lake with a sandy shore, lily pads and two paddle boats
  const shore = keep(new THREE.RingGeometry(lake.r - 1, lake.r + 3, 96, 1)); shore.rotateX(-Math.PI / 2); shore.translate(lake.x, 0.03, lake.z);
  add(shore, keep(std(0xd9c592)));
  const water = keep(new THREE.CircleGeometry(lake.r, 96)); water.rotateX(-Math.PI / 2); water.translate(lake.x, 0.07, lake.z);
  add(water, keep(new THREE.MeshStandardMaterial({ color: 0x3fb6e8, emissive: 0x0d4c74, emissiveIntensity: 0.45, roughness: 0.15, metalness: 0.1 })), { receive: false });
  {
    const r = rng(616), pads: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = lake.r * (0.55 + r() * 0.38);
      const g = new THREE.CircleGeometry(0.6 + r() * 0.5, 10, 0.4, Math.PI * 1.8); g.rotateX(-Math.PI / 2); g.translate(lake.x + Math.cos(a) * d, 0.09, lake.z + Math.sin(a) * d);
      pads.push(g);
    }
    merged(pads, keep(std(0x3f9a4a)));
  }
  const boats: THREE.Group[] = [];
  [0xffd36b, 0xff5f7a].forEach((c, i) => {
    const b = new THREE.Group();
    const hull = new THREE.Mesh(keep(new THREE.BoxGeometry(2, 0.6, 3)), keep(std(c)));
    const seat = new THREE.Mesh(keep(new THREE.BoxGeometry(1.8, 0.8, 0.4)), keep(std(0xffffff))); seat.position.set(0, 0.6, -0.4);
    const wheelL = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.6, 0.6, 0.2, 10)), keep(std(0x3ee6ff))); wheelL.rotation.z = Math.PI / 2; wheelL.position.set(1.1, 0.2, 0.6);
    b.add(hull, seat, wheelL);
    b.userData.a = i * Math.PI;
    scene.add(b); boats.push(b);
  });

  // lookout tower
  {
    const { x, z } = LOOKOUT, parts: THREE.BufferGeometry[] = [];
    for (const dx of [-2.6, 2.6]) for (const dz of [-2.6, 2.6]) parts.push(beam(new THREE.Vector3(x + dx * 1.2, 0, z + dz * 1.2), new THREE.Vector3(x + dx, 9, z + dz), 0.22));
    for (const y of [3, 6]) for (const s of [-1, 1]) { parts.push(boxAt(6.4, 0.18, 0.18, x, y, z + s * 2.9)); parts.push(boxAt(0.18, 0.18, 6.4, x + s * 2.9, y, z)); }
    merged(parts, darkWood, { cast: true });
    add(boxAt(7, 0.4, 7, x, 9, z), wood, { cast: true });
    const rails: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) { rails.push(boxAt(7, 1, 0.15, x, 9.4, z + s * 3.4)); rails.push(boxAt(0.15, 1, 7, x + s * 3.4, 9.4, z)); }
    merged(rails, wood);
    const roof = new THREE.Mesh(keep(new THREE.ConeGeometry(5.4, 2.6, 4)), keep(std(0x2f9a4e))); roof.position.set(x, 13.6, z); roof.rotation.y = Math.PI / 4; roof.castShadow = true; scene.add(roof);
    const posts: THREE.BufferGeometry[] = [];
    for (const dx of [-3.2, 3.2]) for (const dz of [-3.2, 3.2]) posts.push(boxAt(0.2, 2.9, 0.2, x + dx, 9.4, z + dz));
    merged(posts, darkWood);
  }

  // picnic tables
  {
    const tops: THREE.BufferGeometry[] = [], legs: THREE.BufferGeometry[] = [];
    PICNIC.forEach((p) => {
      tops.push(boxAt(3.6, 0.16, 1.3, p.x, 0.86, p.z));
      for (const s of [-1, 1]) tops.push(boxAt(3.6, 0.12, 0.4, p.x, 0.48, p.z + s * 1.05));
      for (const dx of [-1.4, 1.4]) legs.push(boxAt(0.14, 0.86, 1.9, p.x + dx, 0, p.z));
    });
    merged(tops, wood, { cast: true });
    merged(legs, darkWood);
  }

  // park trees
  {
    const trunk = keep(new THREE.CylinderGeometry(0.22, 0.3, 2.2, 6)); trunk.translate(0, 1.1, 0);
    const crown = keep(new THREE.IcosahedronGeometry(1.7, 0)); crown.translate(0, 3.3, 0);
    const tm = new THREE.InstancedMesh(trunk, keep(std(0x6b4a32)), PARK_TREES.length);
    const cm = new THREE.InstancedMesh(crown, keep(std(0xffffff, { flatShading: true })), PARK_TREES.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), color = new THREE.Color(), r = rng(31);
    PARK_TREES.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI);
      m4.compose(new THREE.Vector3(t.x, 0, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
      tm.setMatrixAt(i, m4); cm.setMatrixAt(i, m4);
      cm.setColorAt(i, color.setHSL(0.22 + r() * 0.12, 0.5, 0.3 + r() * 0.12));
    });
    tm.castShadow = cm.castShadow = true;
    scene.add(tm, cm);
  }
  {
    const tex = keep(signTexture([{ text: "LAKESIDE PARK", size: 120, color: "#7cf29a" }, { text: "LOOP ROAD · LOOKOUT · STUNT PARK", size: 50, color: "#ffd36b" }], { w: 1024, h: 260, bg: "#0c2118", border: "#7cf29a" }));
    sign(tex, 10, 2.5, CITY + 10, 4.6, 40 + ROAD_HALF + 3, -Math.PI / 2);
    merged([boxAt(0.3, 5.8, 0.3, CITY + 10, 0, 40 + ROAD_HALF + 3 - 4.6), boxAt(0.3, 5.8, 0.3, CITY + 10, 0, 40 + ROAD_HALF + 3 + 4.6)], keep(std(0x2a2240)));
  }

  // ═══ Stunt Park ══════════════════════════════════════════════════════════
  {
    const w = stunt.maxX - stunt.minX, d = stunt.maxZ - stunt.minZ, cx = (stunt.minX + stunt.maxX) / 2, cz = (stunt.minZ + stunt.maxZ) / 2;
    add(flat(w, d, cx, cz, 0.044), keep(std(0x24262f, { roughness: 0.95 })));
    // painted skid lanes and a border
    for (const s of [-1, 1]) { lines.push(flat(w - 2, 0.3, cx, cz + s * (d / 2 - 1), 0.06)); lines.push(flat(0.3, d - 2, cx + s * (w / 2 - 1), cz, 0.06)); }
    // tyre stacks round the edge (soft barriers, purely for show)
    const r = rng(4), tyres: THREE.BufferGeometry[] = [];
    for (let x = stunt.minX + 3; x < stunt.maxX; x += 7) for (const z of [stunt.minZ + 0.2, ...(Math.abs(x - STUNT_ROAD.x) > ROAD_HALF + 2 ? [stunt.maxZ - 0.2] : [])]) {
      const h = 1 + Math.floor(r() * 3);
      for (let k = 0; k < h; k++) { const g = new THREE.TorusGeometry(0.55, 0.22, 6, 12); g.rotateX(Math.PI / 2); g.translate(x, 0.22 + k * 0.42, z); tyres.push(g); }
    }
    merged(tyres, keep(std(0x1b1b1f, { roughness: 1 })));
    // entrance gantry over the access road
    const tex = keep(signTexture([{ text: "STUNT PARK", size: 150, color: "#ffcf33" }], { w: 1024, h: 220, bg: "#14121c", border: "#ffcf33" }));
    sign(tex, 12, 2.6, STUNT_ROAD.x, 7, stunt.maxZ + 4, 0);
    merged([boxAt(0.5, 8.3, 0.5, STUNT_ROAD.x - 7, 0, stunt.maxZ + 4), boxAt(0.5, 8.3, 0.5, STUNT_ROAD.x + 7, 0, stunt.maxZ + 4)], keep(std(0x333344)));
  }
  // ramps: wedges you drive up along their heading
  {
    const chev = keep(chevronTexture());
    const top = keep(std(0xffffff, { map: chev, roughness: 0.6 }));
    const side = keep(std(0x3a3d4a));
    for (const ramp of RAMPS) {
      const shape = new THREE.Shape();
      shape.moveTo(-ramp.length / 2, 0); shape.lineTo(ramp.length / 2, 0); shape.lineTo(ramp.length / 2, ramp.height); shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: ramp.width, bevelEnabled: false });
      g.translate(0, 0, -ramp.width / 2);
      g.rotateY(-Math.PI / 2); // shape x → forward (+z), extrusion → sideways
      g.rotateY(ramp.heading);
      g.translate(ramp.x, 0, ramp.z);
      // the extrude groups are [caps, sides]: the sides include the slope, so they get the chevrons
      const m = new THREE.Mesh(keep(g), [side, top]);
      m.castShadow = true; m.receiveShadow = true; scene.add(m);
      chev.repeat.set(0.25, 0.25);
    }
  }

  // ═══ Shared paint, lamps and the outer hedge ═════════════════════════════
  merged(roads, roadMat);
  merged(dashes, paint);
  merged(lines, white);
  {
    const pole = keep(new THREE.CylinderGeometry(0.1, 0.14, 6, 6)); pole.translate(0, 3, 0);
    const head = keep(new THREE.SphereGeometry(0.4, 10, 8)); head.translate(0, 6.1, 0);
    const pm = new THREE.InstancedMesh(pole, keep(std(0x2a2d38)), lamps.length);
    const hm = new THREE.InstancedMesh(head, keep(new THREE.MeshBasicMaterial({ color: 0xffe2a0 })), lamps.length);
    const m4 = new THREE.Matrix4();
    lamps.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); pm.setMatrixAt(i, m4); hm.setMatrixAt(i, m4); });
    scene.add(pm, hm);
  }

  return {
    update(t: number) {
      wheel.rotation.x = t * 0.12;
      for (const g of gondolas) g.rotation.x = -wheel.rotation.x;
      foamMat.opacity = 0.45 + Math.sin(t * 1.3) * 0.2;
      foam.position.x = Math.sin(t * 1.3) * 0.8;
      boats.forEach((b, i) => {
        const a = b.userData.a + t * 0.05 * (i ? -1 : 1), d = lake.r * 0.6;
        b.position.set(lake.x + Math.cos(a) * d, 0.2 + Math.sin(t * 2 + i) * 0.06, lake.z + Math.sin(a) * d);
        b.rotation.y = -a + (i ? 0 : Math.PI);
      });
    },
  };
}
