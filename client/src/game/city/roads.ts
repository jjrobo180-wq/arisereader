// Draws the whole road network from the shared layout: asphalt, sidewalks,
// lane paint, crosswalks, stop lines, street lamps and working traffic lights.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { JUNCTIONS, ROADS, ROAD_HALF, isNS, type Road } from "@shared/city/layout";
import { STOP_LINE, lightAt, type Axis, type Light } from "@shared/city/lights";

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...extra });

/** A flat rectangle spanning [a0, a1] along a road and [c0, c1] across it. */
function strip(r: Road, a0: number, a1: number, c0: number, c1: number, y: number) {
  const along = a1 - a0, across = c1 - c0;
  const g = new THREE.PlaneGeometry(isNS(r) ? across : along, isNS(r) ? along : across);
  g.rotateX(-Math.PI / 2);
  const ma = (a0 + a1) / 2, mc = (c0 + c1) / 2;
  if (isNS(r)) g.translate(r.x1 + mc, y, ma); else g.translate(ma, y, r.z1 + mc);
  return g;
}

/** Splits [from, to] into the pieces that avoid every gap. */
function pieces(from: number, to: number, gaps: [number, number][]) {
  const out: [number, number][] = [];
  let at = from;
  for (const [g0, g1] of [...gaps].sort((a, b) => a[0] - b[0])) {
    if (g1 <= at) continue;
    if (g0 > at) out.push([at, Math.min(g0, to)]);
    at = Math.max(at, g1);
    if (at >= to) break;
  }
  if (at < to) out.push([at, to]);
  return out.filter(([a, b]) => b - a > 0.5);
}

export type RoadNetwork = { update: () => void };

export function buildRoads(scene: THREE.Scene, keep: <T extends { dispose: () => void }>(o: T) => T): RoadNetwork {
  const roads: THREE.BufferGeometry[] = [], walks: THREE.BufferGeometry[] = [], dashes: THREE.BufferGeometry[] = [], edges: THREE.BufferGeometry[] = [], zebra: THREE.BufferGeometry[] = [];
  const lamps: [number, number][] = [];
  const W = ROAD_HALF;

  for (const r of ROADS) {
    const ns = isNS(r);
    const a0 = ns ? r.z1 : r.x1, a1 = ns ? r.z2 : r.x2, pos = ns ? r.x1 : r.z1;
    roads.push(strip(r, a0 - W, a1 + W, -W, W, 0.04));
    // every road that crosses or meets this one, and which side it leaves from
    const crossings: { at: number; minus: boolean; plus: boolean }[] = [];
    for (const o of ROADS) {
      if (isNS(o) === ns) continue;
      const oPos = ns ? o.z1 : o.x1; // where the other road sits along this one
      const oFrom = ns ? o.x1 : o.z1, oTo = ns ? o.x2 : o.z2; // the other road's extent across this one
      if (oPos < a0 - W - 0.1 || oPos > a1 + W + 0.1 || pos < oFrom - 0.1 || pos > oTo + 0.1) continue;
      crossings.push({ at: oPos, minus: oFrom < pos - 1, plus: oTo > pos + 1 });
    }
    const gap = (c: { at: number }, pad: number): [number, number] => [c.at - W - pad, c.at + W + pad];
    for (const side of [-1, 1]) {
      const gaps = crossings.filter((c) => (side < 0 ? c.minus : c.plus)).map((c) => gap(c, 1.6));
      for (const [p0, p1] of pieces(a0 - W, a1 + W, gaps)) {
        walks.push(strip(r, p0, p1, side * (W + 0.05), side * (W + 1.65), 0.03));
        edges.push(strip(r, p0, p1, side * (W - 0.49), side * (W - 0.31), 0.055));
      }
    }
    for (let p = a0 + 3; p < a1; p += 6) if (!crossings.some((c) => Math.abs(p - c.at) < W + 2)) dashes.push(strip(r, p - 1.3, p + 1.3, -0.125, 0.125, 0.06));
    for (let p = a0 + 10; p < a1 - 4; p += 28) if (!crossings.some((c) => Math.abs(p - c.at) < 12)) lamps.push(ns ? [pos + W + 1.6, p] : [p, pos - W - 1.6]);
  }

  // crosswalks and stop lines on every arm of every junction
  const stopLines: THREE.BufferGeometry[] = [];
  const armDirs: { key: "n" | "s" | "e" | "w"; dx: number; dz: number }[] = [{ key: "n", dx: 0, dz: -1 }, { key: "s", dx: 0, dz: 1 }, { key: "e", dx: 1, dz: 0 }, { key: "w", dx: -1, dz: 0 }];
  for (const j of JUNCTIONS) for (const a of armDirs) {
    if (!j.arms[a.key]) continue;
    const off = W + 1.3;
    for (let k = -2; k <= 2; k++) {
      const g = new THREE.PlaneGeometry(a.dz ? 0.9 : 2.2, a.dz ? 2.2 : 0.9); g.rotateX(-Math.PI / 2);
      g.translate(j.x + a.dx * off + (a.dz ? k * 2.2 : 0), 0.058, j.z + a.dz * off + (a.dx ? k * 2.2 : 0));
      zebra.push(g);
    }
    // stop line across the lane coming in on this arm (right-hand traffic)
    const rx = a.dz, rz = -a.dx; // right of incoming traffic
    const g = new THREE.PlaneGeometry(a.dz ? W : 0.45, a.dz ? 0.45 : W); g.rotateX(-Math.PI / 2);
    g.translate(j.x + a.dx * (STOP_LINE + 0.4) + rx * W / 2, 0.059, j.z + a.dz * (STOP_LINE + 0.4) + rz * W / 2);
    stopLines.push(g);
  }

  const merged = (list: THREE.BufferGeometry[], mat: THREE.Material) => {
    if (!list.length) return;
    const g = keep(mergeGeometries(list)!); list.forEach((x) => x.dispose());
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m);
  };
  merged(roads, keep(std(0x2c2f3a, { roughness: 0.95 })));
  merged(walks, keep(std(0xb8b4c2)));
  merged(dashes, keep(new THREE.MeshBasicMaterial({ color: 0xffd76a })));
  merged([...edges, ...stopLines], keep(new THREE.MeshBasicMaterial({ color: 0xe8e8f0 })));
  merged(zebra, keep(new THREE.MeshBasicMaterial({ color: 0xf2f2f2 })));

  // street lamps
  {
    const pole = keep(new THREE.CylinderGeometry(0.1, 0.14, 6, 6)); pole.translate(0, 3, 0);
    const head = keep(new THREE.SphereGeometry(0.4, 10, 8)); head.translate(0, 6.1, 0);
    const pm = new THREE.InstancedMesh(pole, keep(std(0x2a2d38)), lamps.length);
    const hm = new THREE.InstancedMesh(head, keep(new THREE.MeshBasicMaterial({ color: 0xffe2a0 })), lamps.length);
    const m4 = new THREE.Matrix4();
    lamps.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); pm.setMatrixAt(i, m4); hm.setMatrixAt(i, m4); });
    scene.add(pm, hm);
  }

  // traffic lights: a pole on the far-right corner for each arm, with a mast arm
  // reaching over the incoming lane and a three-lamp head facing the drivers
  type Head = { junction: number; axis: Axis; lamp: number };
  const heads: Head[] = [];
  const placements: { x: number; z: number; yaw: number; armX: number; armZ: number }[] = [];
  for (const j of JUNCTIONS) for (const a of armDirs) {
    if (!j.arms[a.key]) continue;
    const rx = a.dz, rz = -a.dx;
    // on the far side of the junction, so drivers waiting at the line can see it
    const px = j.x - a.dx * (W + 1.8) + rx * (W + 1.8), pz = j.z - a.dz * (W + 1.8) + rz * (W + 1.8);
    placements.push({ x: px, z: pz, yaw: Math.atan2(a.dx, a.dz), armX: -rx, armZ: -rz });
    heads.push({ junction: j.id, axis: a.dz ? "z" : "x", lamp: placements.length - 1 });
  }
  const n = placements.length;
  const poleGeo = keep(new THREE.CylinderGeometry(0.13, 0.16, 6, 8)); poleGeo.translate(0, 3, 0);
  const armGeo = keep(new THREE.BoxGeometry(0.14, 0.14, 4.4)); armGeo.translate(0, 5.8, 2.2); // reaches along local +z
  const headGeo = keep(new THREE.BoxGeometry(0.6, 1.7, 0.45)); headGeo.translate(0, 5.0, 4.0);
  const dark = keep(std(0x24262e, { roughness: 0.6 }));
  const poles = new THREE.InstancedMesh(poleGeo, dark, n), arms = new THREE.InstancedMesh(armGeo, dark, n), housings = new THREE.InstancedMesh(headGeo, keep(std(0x1a1b20)), n);
  const lampGeo = keep(new THREE.SphereGeometry(0.19, 10, 8));
  const lamps3 = new THREE.InstancedMesh(lampGeo, keep(new THREE.MeshBasicMaterial({ color: 0xffffff })), n * 3);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const unlit = [new THREE.Color(0x3a1212), new THREE.Color(0x3a300c), new THREE.Color(0x0c3a1c)];
  const lit = [new THREE.Color(0xff3b3b), new THREE.Color(0xffc531), new THREE.Color(0x3dff84)];
  placements.forEach((p, i) => {
    // the arm points along local +z, so turn it toward the road (−right)
    q.setFromAxisAngle(up, Math.atan2(p.armX, p.armZ));
    m4.compose(new THREE.Vector3(p.x, 0, p.z), q, one);
    poles.setMatrixAt(i, m4); arms.setMatrixAt(i, m4); housings.setMatrixAt(i, m4);
    // lamps sit on the face of the housing that looks back at the drivers (outward along the arm direction p.yaw)
    const hx = p.x + p.armX * 4.0 + Math.sin(p.yaw) * 0.33, hz = p.z + p.armZ * 4.0 + Math.cos(p.yaw) * 0.33;
    [5.55, 5.0, 4.45].forEach((y, k) => {
      m4.makeTranslation(hx, y, hz);
      lamps3.setMatrixAt(i * 3 + k, m4); lamps3.setColorAt(i * 3 + k, unlit[k]);
    });
  });
  poles.castShadow = arms.castShadow = housings.castShadow = true;
  scene.add(poles, arms, housings, lamps3);

  const shown: (Light | null)[] = heads.map(() => null);
  const order: Light[] = ["red", "yellow", "green"];
  return {
    update() {
      const t = Date.now() / 1000;
      let changed = false;
      heads.forEach((h, i) => {
        const light = lightAt(JUNCTIONS[h.junction], h.axis, t);
        if (shown[i] === light) return;
        shown[i] = light; changed = true;
        order.forEach((name, k) => lamps3.setColorAt(i * 3 + k, name === light ? lit[k] : unlit[k]));
      });
      if (changed && lamps3.instanceColor) lamps3.instanceColor.needsUpdate = true;
    },
  };
}
