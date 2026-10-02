// Prism Paintball — paintballs in flight, paint splat decals and droplet particles.
import * as THREE from "three";
import { raycastWorld, rayPlayer, ballisticPos, type V3, type WeaponDef } from "@shared/paintball";
import { splatAtlas } from "./textures";

export interface TargetBody { id: number; team: number; x: number; y: number; z: number; crouch: boolean; alive: boolean }

interface Ball {
  o: V3; d: V3; w: WeaponDef; age: number; team: number; owner: number; local: boolean;
  shotId: number; pellet: number; color: THREE.Color; size: number;
}
interface Drop { p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; size: number; color: THREE.Color; grav: number; drag: number }

const MAX_BALLS = 260, MAX_SPLATS = 700, MAX_DROPS = 520;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _n = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _z = new THREE.Vector3(0, 0, 1);

export const TEAM_PAINT = [new THREE.Color(0x22d3ee), new THREE.Color(0xf0479a)];
const PAINT_VARIANTS = [[0x22d3ee, 0x38bdf8, 0x2dd4bf], [0xf0479a, 0xec4899, 0xd946ef]].map((l) => l.map((c) => new THREE.Color(c)));

export class Effects {
  readonly group = new THREE.Group();
  private balls: Ball[] = [];
  private ballMesh: THREE.InstancedMesh;
  private trailMesh: THREE.InstancedMesh;
  private splatMesh: THREE.InstancedMesh;
  private splatTile: THREE.InstancedBufferAttribute;
  private splatCount = 0;
  private dropMesh: THREE.InstancedMesh;
  private drops: Drop[] = [];
  private atlas: THREE.Texture;
  private disposables: { dispose(): void }[] = [];

  /** Called when a locally fired ball touches an enemy (client-side hit claim). */
  onLocalHit: ((shotId: number, pellet: number, targetId: number, head: boolean, p: V3) => void) | null = null;
  /** Called on every impact (for audio). */
  onImpact: ((p: V3, local: boolean, player: boolean) => void) | null = null;
  /** Visual-only hit on a character (remote balls). */
  onBodyHit: ((targetId: number, p: V3, team: number) => void) | null = null;

  constructor(scene: THREE.Scene, private quality: "low" | "medium" | "high") {
    scene.add(this.group);
    const ballGeo = new THREE.SphereGeometry(0.075, 12, 8);
    const ballMat = new THREE.MeshStandardMaterial({ roughness: 0.18, metalness: 0.05, emissive: 0xffffff, emissiveIntensity: 0.18 });
    this.ballMesh = new THREE.InstancedMesh(ballGeo, ballMat, MAX_BALLS);
    this.ballMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ballMesh.count = 0;
    this.ballMesh.frustumCulled = false;
    this.ballMesh.castShadow = false;
    this.group.add(this.ballMesh);

    const trailGeo = new THREE.CylinderGeometry(0.024, 0.0, 1, 8, 1, true);
    trailGeo.translate(0, -0.5, 0);
    trailGeo.rotateX(Math.PI / 2); // along +z, tail toward -z
    const trailMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.trailMesh = new THREE.InstancedMesh(trailGeo, trailMat, MAX_BALLS);
    this.trailMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.trailMesh.count = 0;
    this.trailMesh.frustumCulled = false;
    this.group.add(this.trailMesh);

    this.atlas = splatAtlas();
    const splatGeo = new THREE.PlaneGeometry(1, 1);
    this.splatTile = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SPLATS), 1);
    splatGeo.setAttribute("aTile", this.splatTile);
    const splatMat = new THREE.MeshStandardMaterial({
      map: this.atlas, alphaTest: 0.5, roughness: 0.2, metalness: 0, transparent: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide,
    });
    splatMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float aTile;")
        .replace("#include <uv_vertex>", "#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = (uv * 0.5) + vec2(mod(aTile, 2.0), floor(aTile / 2.0)) * 0.5;\n#endif");
    };
    splatMat.customProgramCacheKey = () => "splat-atlas";
    this.splatMesh = new THREE.InstancedMesh(splatGeo, splatMat, MAX_SPLATS);
    this.splatMesh.count = 0;
    this.splatMesh.frustumCulled = false;
    this.splatMesh.receiveShadow = quality !== "low";
    this.group.add(this.splatMesh);

    const dropGeo = new THREE.SphereGeometry(1, 7, 5);
    const dropMat = new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.12 });
    this.dropMesh = new THREE.InstancedMesh(dropGeo, dropMat, MAX_DROPS);
    this.dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dropMesh.count = 0;
    this.dropMesh.frustumCulled = false;
    this.group.add(this.dropMesh);
    // make sure instanceColor buffers exist
    for (const m of [this.ballMesh, this.trailMesh, this.splatMesh, this.dropMesh]) m.setColorAt(0, new THREE.Color(1, 1, 1));
    this.disposables.push(ballGeo, ballMat, trailGeo, trailMat, this.atlas, splatGeo, splatMat, dropGeo, dropMat);
  }

  paintColor(team: number) {
    const list = PAINT_VARIANTS[team] || PAINT_VARIANTS[0];
    return list[Math.floor(Math.random() * list.length)];
  }

  fire(o: V3, dirs: V3[], w: WeaponDef, team: number, owner: number, local: boolean, shotId: number) {
    const color = TEAM_PAINT[team] || TEAM_PAINT[0];
    dirs.forEach((d, i) => {
      if (this.balls.length >= MAX_BALLS) this.balls.shift();
      this.balls.push({ o: [o[0], o[1], o[2]], d, w, age: 0, team, owner, local, shotId, pellet: i, color, size: w.ballSize });
    });
    // muzzle puff
    const n = this.quality === "low" ? 2 : 4;
    for (let i = 0; i < n; i++) {
      this.drop(new THREE.Vector3(o[0], o[1], o[2]), new THREE.Vector3(dirs[0][0] * 2 + rnd(-0.6, 0.6), dirs[0][1] * 2 + rnd(0, 0.8), dirs[0][2] * 2 + rnd(-0.6, 0.6)), 0.25, 0.05 + Math.random() * 0.03, new THREE.Color(0xf1f5f9), -0.8, 3);
    }
  }

  private drop(p: THREE.Vector3, v: THREE.Vector3, life: number, size: number, color: THREE.Color, grav = 14, drag = 0.6) {
    if (this.drops.length >= MAX_DROPS) this.drops.shift();
    this.drops.push({ p, v, life, max: life, size, color, grav, drag });
  }

  burst(p: V3, n: V3, team: number, count: number, power = 1) {
    const color = this.paintColor(team);
    const c = this.quality === "low" ? Math.ceil(count * 0.5) : count;
    const normal = new THREE.Vector3(n[0], n[1], n[2]);
    for (let i = 0; i < c; i++) {
      const dir = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().addScaledVector(normal, 1.3).normalize();
      this.drop(new THREE.Vector3(p[0], p[1], p[2]).addScaledVector(normal, 0.05), dir.multiplyScalar(rnd(2, 6.5) * power), rnd(0.35, 0.75), rnd(0.02, 0.05) * Math.sqrt(power), color);
    }
  }

  /** Paint decal on a surface. */
  addSplat(p: V3, n: V3, team: number, size: number) {
    const i = this.splatCount % MAX_SPLATS;
    _n.set(n[0], n[1], n[2]).normalize();
    _q.setFromUnitVectors(_z, _n);
    const spin = new THREE.Quaternion().setFromAxisAngle(_z, Math.random() * Math.PI * 2);
    _q.multiply(spin);
    _p.set(p[0], p[1], p[2]).addScaledVector(_n, 0.012 + (this.splatCount % 7) * 0.0015);
    const s = size * rnd(0.8, 1.25);
    _s.set(s, s * rnd(0.8, 1.15), s);
    // stretch along the ground slightly for oblique hits
    _m.compose(_p, _q, _s);
    this.splatMesh.setMatrixAt(i, _m);
    this.splatMesh.setColorAt(i, this.paintColor(team));
    this.splatTile.setX(i, Math.floor(Math.random() * 4));
    this.splatTile.needsUpdate = true;
    this.splatCount++;
    this.splatMesh.count = Math.min(this.splatCount, MAX_SPLATS);
    this.splatMesh.instanceMatrix.needsUpdate = true;
    if (this.splatMesh.instanceColor) this.splatMesh.instanceColor.needsUpdate = true;
  }

  /** Large paint explosion when a player is eliminated. */
  elimination(x: number, y: number, z: number, team: number) {
    for (let i = 0; i < 4; i++) this.burst([x, y + 0.6 + i * 0.35, z], [rnd(-1, 1), 0.5, rnd(-1, 1)], team, 12, 1.5);
    for (let i = 0; i < 5; i++) this.addSplat([x + rnd(-1, 1), 0.005, z + rnd(-1, 1)], [0, 1, 0], team, rnd(0.6, 1.2));
  }

  update(dt: number, bodies: TargetBody[]) {
    // ---- balls ----
    const keep: Ball[] = [];
    for (const b of this.balls) {
      const t0 = b.age, t1 = Math.min(b.age + dt, b.w.life);
      let alive = t1 < b.w.life;
      const steps = Math.max(1, Math.ceil(((t1 - t0) * b.w.speed) / 1.5));
      for (let k = 0; k < steps && alive; k++) {
        const ta = t0 + ((t1 - t0) * k) / steps, tb = t0 + ((t1 - t0) * (k + 1)) / steps;
        const a = ballisticPos(b.o, b.d, b.w.speed, b.w.grav, ta), c = ballisticPos(b.o, b.d, b.w.speed, b.w.grav, tb);
        const dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2];
        const wh = raycastWorld(a[0], a[1], a[2], dx, dy, dz, 1);
        let bestT = wh ? wh.t : 1, hitBody: TargetBody | null = null, head = false;
        for (const body of bodies) {
          if (!body.alive || body.id === b.owner || body.team === b.team) continue;
          const h = rayPlayer(a[0], a[1], a[2], dx, dy, dz, bestT, body.x, body.y, body.z, body.crouch);
          if (h && h.t <= bestT) { bestT = h.t; hitBody = body; head = h.head; }
        }
        const hp: V3 = [a[0] + dx * bestT, a[1] + dy * bestT, a[2] + dz * bestT];
        if (hitBody) {
          alive = false;
          const back: V3 = [-dx, -dy, -dz];
          const bl = Math.hypot(back[0], back[1], back[2]) || 1;
          this.burst(hp, [back[0] / bl, back[1] / bl, back[2] / bl], b.team, 9);
          if (b.local) this.onLocalHit?.(b.shotId, b.pellet, hitBody.id, head, hp);
          else this.onBodyHit?.(hitBody.id, hp, b.team);
          this.onImpact?.(hp, b.local, true);
        } else if (wh) {
          alive = false;
          const n: V3 = [wh.nx, wh.ny, wh.nz];
          this.burst(hp, n, b.team, 7);
          this.addSplat(hp, n, b.team, (n[1] > 0.7 ? 0.55 : 0.42) * b.size);
          this.onImpact?.(hp, b.local, false);
        }
      }
      b.age = t1;
      if (alive) keep.push(b);
    }
    this.balls = keep;
    let i = 0;
    for (const b of this.balls) {
      const p = ballisticPos(b.o, b.d, b.w.speed, b.w.grav, b.age);
      // velocity direction
      const vx = b.d[0] * b.w.speed, vy = b.d[1] * b.w.speed - b.w.grav * b.age, vz = b.d[2] * b.w.speed;
      const sp = Math.hypot(vx, vy, vz);
      _s.setScalar(b.size);
      _q.identity();
      _m.compose(_p.set(p[0], p[1], p[2]), _q, _s);
      this.ballMesh.setMatrixAt(i, _m);
      this.ballMesh.setColorAt(i, b.color);
      _n.set(vx / sp, vy / sp, vz / sp);
      _q.setFromUnitVectors(_z, _n);
      const len = Math.min(b.age * sp, sp * 0.008, 0.7);
      _s.set(b.size, b.size, Math.max(0.001, len));
      _m.compose(_p, _q, _s);
      this.trailMesh.setMatrixAt(i, _m);
      this.trailMesh.setColorAt(i, b.color);
      i++;
    }
    this.ballMesh.count = i; this.trailMesh.count = i;
    this.ballMesh.instanceMatrix.needsUpdate = true; this.trailMesh.instanceMatrix.needsUpdate = true;
    if (this.ballMesh.instanceColor) this.ballMesh.instanceColor.needsUpdate = true;
    if (this.trailMesh.instanceColor) this.trailMesh.instanceColor.needsUpdate = true;

    // ---- droplets ----
    const dk: Drop[] = [];
    let j = 0;
    for (const d of this.drops) {
      d.life -= dt;
      if (d.life <= 0) continue;
      d.v.y -= d.grav * dt;
      d.v.multiplyScalar(Math.max(0, 1 - d.drag * dt));
      d.p.addScaledVector(d.v, dt);
      if (d.p.y < 0.02 && d.grav > 0) { d.p.y = 0.02; d.v.set(0, 0, 0); }
      const k = d.life / d.max;
      const s = d.size * (d.grav < 0 ? 1 + (1 - k) * 3 : 0.4 + k * 0.6);
      _q.identity();
      _s.setScalar(s);
      _m.compose(d.p, _q, _s);
      this.dropMesh.setMatrixAt(j, _m);
      this.dropMesh.setColorAt(j, d.color);
      j++;
      dk.push(d);
    }
    this.drops = dk;
    this.dropMesh.count = j;
    this.dropMesh.instanceMatrix.needsUpdate = true;
    if (this.dropMesh.instanceColor) this.dropMesh.instanceColor.needsUpdate = true;
  }

  clearBalls() { this.balls = []; }

  dispose() {
    this.group.parent?.remove(this.group);
    for (const d of this.disposables) d.dispose();
    for (const m of [this.ballMesh, this.trailMesh, this.splatMesh, this.dropMesh]) m.dispose();
  }
}

function rnd(a: number, b: number) { return a + Math.random() * (b - a); }
export { _up as UP };
