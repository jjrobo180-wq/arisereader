// Reading Runner — the endless world around the track: sky, skyline, ground, rails, scenery, arches and weather.
import * as THREE from "three";
import { LANE_X } from "@shared/runner/sim";
import type { WorldLook } from "@shared/runner/missions";
import type { Fx } from "@/game/skybound/fx";
import { groundTexture, laneGlowTexture, skylineTexture, trackTexture } from "./textures";
import { bakeStatic, glowSprite, makeArch, makeProp, std } from "./models";

export type Quality = "low" | "medium" | "high";
const TILE = 8, TRACK_LEN = 340, GROUND = 704, CHUNK = 26;

function seeded(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

export class World {
  group = new THREE.Group();
  private sky: THREE.Mesh; private skyline: THREE.Mesh; private stars: THREE.Points | null = null; private disc: THREE.Object3D | null = null; private discDir = new THREE.Vector3(-0.35, 0.32, -1).normalize();
  private ground: THREE.Mesh; private track: THREE.Mesh; private railGroup = new THREE.Group();
  private chunks: { g: THREE.Group; s: number }[] = []; private arches: { g: THREE.Group; s: number }[] = [];
  private animated: { o: THREE.Object3D; kind: "spin" | "flag" | "sway"; seed: number }[] = [];
  private glows: THREE.Mesh[] = []; private glowTarget = [0, 0, 0];
  private rnd: () => number;
  private disposables: { dispose(): void }[] = [];

  constructor(public look: WorldLook, quality: Quality, seed = 1) {
    this.rnd = seeded(seed * 7919 + 13);
    const L = look;
    // sky dome
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(L.sky[0]) }, mid: { value: new THREE.Color(L.sky[1]) }, bot: { value: new THREE.Color(L.sky[2]) } },
      vertexShader: "varying vec3 vD; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vD = w.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vD; void main(){ float h = normalize(vD).y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h * 1.25, 0.0, 1.0), 0.7)) : mix(mid, bot, clamp(-h * 4.0, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(460, 32, 16), skyMat); this.sky.renderOrder = -3; this.sky.frustumCulled = false; this.group.add(this.sky);
    if (L.stars) {
      const n = 700, pos = new Float32Array(n * 3), r = seeded(99);
      for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, y = 0.05 + r() * 0.95, k = Math.sqrt(1 - y * y); pos.set([Math.cos(a) * k * 420, y * 420, Math.sin(a) * k * 420], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
      this.stars.renderOrder = -2; this.stars.frustumCulled = false; this.group.add(this.stars);
    }
    if (L.sunDisc !== "none") {
      const d = new THREE.Group();
      const col = L.sunDisc === "moon" ? 0xeef2ff : L.sunDisc === "planet" ? 0xb79aff : 0xfff3c4;
      const halo = glowSprite(col, L.sunDisc === "sun" ? 150 : 90, L.sunDisc === "sun" ? 0.75 : 0.5); (halo.material as THREE.SpriteMaterial).fog = false; d.add(halo);
      const core = new THREE.Mesh(new THREE.CircleGeometry(L.sunDisc === "sun" ? 14 : 12, 40), new THREE.MeshBasicMaterial({ color: col, fog: false, toneMapped: false }));
      d.add(core);
      if (L.sunDisc === "planet") { const ring = new THREE.Mesh(new THREE.RingGeometry(17, 21, 48), new THREE.MeshBasicMaterial({ color: 0xffd6a0, fog: false, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })); ring.rotation.set(0.2, 0.4, 0.5); d.add(ring); }
      if (L.sunDisc === "moon") { for (const [x, y, rr] of [[-3, 3, 2.6], [4, -2, 2], [1, 5, 1.4]] as const) { const c = new THREE.Mesh(new THREE.CircleGeometry(rr, 20), new THREE.MeshBasicMaterial({ color: 0xc8cfe6, fog: false })); c.position.set(x, y, 0.1); d.add(c); } }
      d.renderOrder = -2; this.disc = d; this.group.add(d);
    }
    // far skyline ring
    const sk = skylineTexture(L); sk.wrapS = THREE.RepeatWrapping; sk.repeat.set(4, 1);
    this.skyline = new THREE.Mesh(new THREE.CylinderGeometry(330, 330, 70, 72, 1, true), new THREE.MeshBasicMaterial({ map: sk, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false, color: new THREE.Color(0xffffff).lerp(new THREE.Color(L.fog), 0.35) }));
    this.skyline.renderOrder = -1; this.skyline.frustumCulled = false; this.group.add(this.skyline);

    // ground & track (snapped to whole tiles so the textures stay put while we run)
    const gt = groundTexture(L); gt.repeat.set(GROUND / TILE, GROUND / TILE);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND, GROUND), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.95, metalness: L.ground === "metal" ? 0.3 : 0 }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -0.04; this.ground.receiveShadow = quality !== "low"; this.group.add(this.ground);
    const tt = trackTexture(L); tt.repeat.set(1, TRACK_LEN / TILE);
    this.track = new THREE.Mesh(new THREE.PlaneGeometry(8.6, TRACK_LEN), new THREE.MeshStandardMaterial({ map: tt, roughness: 0.9 }));
    this.track.rotation.x = -Math.PI / 2; this.track.position.y = 0.01; this.track.receiveShadow = quality !== "low"; this.railGroup.add(this.track);
    const railMat = std(L.rail, 0.25, { metalness: 0.85, emissive: L.night ? L.rail : 0x000000, emissiveIntensity: L.night ? 0.35 : 0 });
    const railGeo = new THREE.BoxGeometry(0.13, 0.16, TRACK_LEN); this.disposables.push(railGeo);
    for (const x of LANE_X) for (const s of [-1, 1]) { const r = new THREE.Mesh(railGeo, railMat); r.position.set(x + s * 0.72, 0.09, 0); r.receiveShadow = true; this.railGroup.add(r); }
    const curbGeo = new THREE.BoxGeometry(0.6, 0.28, TRACK_LEN); this.disposables.push(curbGeo);
    for (const s of [-1, 1]) { const c = new THREE.Mesh(curbGeo, std(L.curb, 0.8)); c.position.set(s * 4.6, 0.12, 0); c.receiveShadow = true; this.railGroup.add(c); }
    if (L.night) for (const s of [-1, 1]) { const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, TRACK_LEN), new THREE.MeshBasicMaterial({ color: L.rail, toneMapped: false })); strip.position.set(s * 4.3, 0.28, 0); this.railGroup.add(strip); }
    this.group.add(this.railGroup);

    // lane guide glows (show where Riley is heading / where the player is looking)
    const lg = laneGlowTexture(); this.disposables.push(lg);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 20), new THREE.MeshBasicMaterial({ map: lg, color: L.night ? L.rail : 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(LANE_X[i], 0.05, 0); m.renderOrder = 1; this.glows.push(m); this.group.add(m);
    }

    // scenery chunks, built once and recycled
    const nChunks = 15, perSide = quality === "low" ? 1 : 2;
    for (let k = 0; k < nChunks; k++) {
      const g = new THREE.Group();
      for (const side of [-1, 1]) {
        for (let i = 0; i < perSide; i++) this.place(g, side, 6.4 + this.rnd() * 3.2, (i + this.rnd() * 0.7) * (CHUNK / perSide), quality);
        if (quality !== "low") this.place(g, side, 12 + this.rnd() * 10, this.rnd() * CHUNK, quality);
      }
      bakeStatic(g); this.group.add(g); this.chunks.push({ g, s: k * CHUNK });
    }
    if (L.arch) for (let k = 0; k < 7; k++) { const g = bakeStatic(makeArch(L.arch, L)); g.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = quality === "high"; }); this.group.add(g); this.arches.push({ g, s: 60 + k * 52 }); }
  }

  private place(g: THREE.Group, side: number, dist: number, s: number, quality: Quality) {
    const kind = this.look.props[Math.floor(this.rnd() * this.look.props.length)];
    const p = makeProp(kind, this.look, this.rnd);
    // big buildings sit further back so the track feels open
    const big = kind === "tower" || kind === "school" || kind === "castle" || kind === "barn" || kind === "volcano" || kind === "windmill";
    p.position.set(side * (dist + (big ? 5.5 + this.rnd() * 3 : 0)), 0, -s);
    if (kind !== "tower" && kind !== "school" && kind !== "castle") p.rotation.y = side > 0 ? -Math.PI / 2 + (this.rnd() - 0.5) * 0.6 : Math.PI / 2 + (this.rnd() - 0.5) * 0.6;
    p.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = quality === "high" && dist < 10; m.receiveShadow = false; } });
    if (p.userData.spin) this.animated.push({ o: p.userData.spin, kind: "spin", seed: this.rnd() * 6 });
    if (p.userData.flag) this.animated.push({ o: p.userData.flag, kind: "flag", seed: this.rnd() * 6 });
    if (p.userData.sway) this.animated.push({ o: p, kind: "sway", seed: this.rnd() * 6 });
    g.add(p);
  }

  setLaneGlow(lane: number, gazeLane: number | null, show: boolean) {
    for (let i = 0; i < 3; i++) this.glowTarget[i] = !show ? 0 : i === lane ? 0.32 : gazeLane === i ? 0.16 : 0;
  }

  update(s: number, camera: THREE.Camera, t: number, dt: number) {
    const snap = Math.floor(s / TILE) * TILE;
    this.ground.position.set(0, -0.04, -snap - GROUND / 2 + 60);
    this.railGroup.position.z = -snap - TRACK_LEN / 2 + 30;
    const cp = camera.position;
    this.sky.position.copy(cp); this.skyline.position.set(cp.x, 26, cp.z);
    if (this.stars) this.stars.position.copy(cp);
    if (this.disc) { this.disc.position.copy(cp).addScaledVector(this.discDir, 380); this.disc.lookAt(cp); }
    for (const c of this.chunks) { if (c.s + CHUNK < s - 14) c.s += this.chunks.length * CHUNK; c.g.position.z = -c.s; }
    for (const a of this.arches) { if (a.s < s - 14) a.s += this.arches.length * 52; a.g.position.z = -a.s; }
    for (const a of this.animated) {
      if (a.kind === "spin") a.o.rotation.z = t * 0.8 + a.seed;
      else if (a.kind === "flag") a.o.rotation.y = Math.sin(t * 3 + a.seed) * 0.3;
      else a.o.rotation.z = Math.sin(t * 1.3 + a.seed) * 0.06;
    }
    this.glows.forEach((m, i) => {
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity += (this.glowTarget[i] * (0.85 + Math.sin(t * 5) * 0.15) - mat.opacity) * Math.min(1, dt * 10);
      m.visible = mat.opacity > 0.01; m.position.z = -s - 11;
    });
  }

  /** Weather and floating sparkles in the space ahead of the runner. */
  ambient(fx: Fx, s: number, dt: number) {
    const kind = this.look.ambient;
    const rate = kind === "snow" ? 70 : kind === "none" ? 0 : kind === "bubbles" ? 26 : kind === "confetti" ? 22 : 18;
    let n = rate * dt;
    while (n > 0) {
      if (Math.random() > n) break; n -= 1;
      const x = (Math.random() - 0.5) * 34, z = -(s + 4 + Math.random() * 60), y = Math.random() * 9;
      switch (kind) {
        case "snow": fx.one(x, 9 + Math.random() * 4, z, -0.4 + Math.random() * 0.8, -2.2, 0xffffff, 6, 0.16); break;
        case "pollen": fx.one(x, 0.6 + y * 0.5, z, 0.3, 0.25, 0xfff3a0, 4, 0.1); break;
        case "sparkle": fx.one(x, 1 + y, z, 0, 0.25, Math.random() < 0.5 ? 0xb388ff : 0x7fe7ff, 2.6, 0.14); break;
        case "embers": fx.one(x, 0.2, z, 0.4, 2.4, Math.random() < 0.5 ? 0xffa24a : 0xff6a1a, 4.5, 0.13); break;
        case "bubbles": fx.one(x, 0.2, z, 0.2, 1.6 + Math.random(), 0xbff6ff, 6, 0.14 + Math.random() * 0.1); break;
        case "leaves": fx.one(x, 7 + Math.random() * 3, z, 0.8, -1.4, Math.random() < 0.5 ? 0x5cc85a : 0xb7e05a, 6, 0.16); break;
        case "confetti": fx.one(x, 8 + Math.random() * 3, z, 0.3 - Math.random() * 0.6, -1.6, [0xff5fae, 0x7fe0ff, 0xfff27a, 0xb98aff, 0x7dff9b][Math.floor(Math.random() * 5)], 6, 0.14); break;
      }
    }
  }

  dispose() {
    this.group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh || (o as THREE.Points).isPoints) { m.geometry?.dispose(); const mats = Array.isArray(m.material) ? m.material : [m.material]; for (const x of mats) { const mm = x as THREE.MeshStandardMaterial; if (mm?.map && !mm.map.userData?.shared) mm.map.dispose(); } } });
    for (const d of this.disposables) d.dispose();
  }
}

