// Eye-gaze game stage — the shared 3D engine for the smaller eye-gazer games (Match Pairs, Word Pop,
// Sentence Train, Fidget Lab): renderer, lights, bloom, particles, and pointer picking with a gold
// look-to-select ring. Look at a registered object to fill its ring (eye gaze / mouse), or tap/click it.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Fx } from "@/game/skybound/fx";
import { touchOnly } from "@/lib/gazeDefaults";

export type Quality = "low" | "medium" | "high";
export type Pickable = { id: string; dwellMs?: number; enabled?: () => boolean; onDwell: () => void; onHover?: (on: boolean) => void; ringScale?: number };
export type StageOptions = { quality: Quality; fov?: number; camPos?: [number, number, number]; target?: [number, number, number]; bloom?: number; bloomThreshold?: number; exposure?: number; dwellMs?: number; dwell?: boolean; env?: boolean };

export class Stage {
  scene = new THREE.Scene(); camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; fx: Fx;
  t = 0; onFrame: ((dt: number, t: number) => void) | null = null; onResize: ((aspect: number) => void) | null = null;
  /** world point under the pointer on the z=0 plane, and whether it came from a mouse/pen/gaze (not touch) */
  pointer: THREE.Vector3 | null = null; pointerHover = false; pointerDown = false; lastMove = 0; client = { x: 0, y: 0 };
  onPointer: ((p: THREE.Vector3, kind: "move" | "down" | "up", touch: boolean) => void) | null = null;
  dwell: boolean;
  private composer: EffectComposer | null = null; private raf = 0; private last = 0; private disposed = false; private resizeObs: ResizeObserver;
  private picks = new Map<THREE.Object3D, Pickable>(); private hovered: { obj: THREE.Object3D; p: Pickable; since: number; fired: boolean } | null = null;
  private ring: THREE.Mesh; private ringGeo: THREE.RingGeometry; private ray = new THREE.Raycaster(); private ndc = new THREE.Vector2(); private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private downAt: { x: number; y: number; obj: THREE.Object3D | null } | null = null;
  readonly dwellMs: number; private envTex: THREE.Texture | null = null;

  constructor(private host: HTMLElement, public opts: StageOptions) {
    const q = opts.quality, phone = (Math.min(window.innerWidth, window.innerHeight) < 600 || touchOnly() /* tablets too: the full-screen glow pass is too heavy for them */);
    this.dwellMs = opts.dwellMs ?? 1100; this.dwell = opts.dwell ?? true;
    this.camera = new THREE.PerspectiveCamera(opts.fov ?? 42, 1, 0.1, 600);
    this.camera.position.set(...(opts.camPos ?? [0, 0, 16])); this.camera.lookAt(new THREE.Vector3(...(opts.target ?? [0, 0, 0])));
    this.renderer = new THREE.WebGLRenderer({ antialias: q !== "low", powerPreference: "high-performance", alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === "high" ? 2 : q === "medium" ? 1.5 : 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = opts.exposure ?? 1.05;
    this.renderer.shadowMap.enabled = q !== "low"; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none";
    host.appendChild(this.renderer.domElement);
    this.fx = new Fx(this.scene, this.renderer.getPixelRatio());
    if (opts.env) { const pm = new THREE.PMREMGenerator(this.renderer); this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();  }

    this.ringGeo = new THREE.RingGeometry(1, 1.16, 72, 1);
    this.ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, toneMapped: false }));
    this.ring.renderOrder = 50; this.ring.visible = false; this.scene.add(this.ring);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.18, 72, 1), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthTest: false, depthWrite: false })); halo.renderOrder = 49; this.ring.add(halo);

    if (q === "high" || (q === "medium" && !phone)) {
      const size = new THREE.Vector2(); this.renderer.getDrawingBufferSize(size);
      const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: q === "high" ? 4 : 0 });
      this.composer = new EffectComposer(this.renderer, rt); this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), opts.bloom ?? 0.35, 0.5, opts.bloomThreshold ?? 1)); this.composer.addPass(new OutputPass());
    }
    host.addEventListener("pointerdown", this.pd); window.addEventListener("pointermove", this.pm, { passive: true }); window.addEventListener("pointerup", this.pu); window.addEventListener("pointercancel", this.cancel); host.addEventListener("pointerleave", this.leave);
    this.resizeObs = new ResizeObserver(() => this.resize()); this.resizeObs.observe(host); this.resize();
    this.last = performance.now(); this.raf = requestAnimationFrame(this.frame);
    if (import.meta.env.DEV) (window as unknown as { __stage?: Stage }).__stage = this;
  }
  /** screen position (CSS px) of every pickable — used by the dev test harness */
  debugPicks() {
    const r = this.host.getBoundingClientRect();
    return [...this.picks.entries()].filter(([o, p]) => o.visible && (p.enabled?.() ?? true)).map(([o, p]) => {
      const v = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(this.camera);
      return { id: p.id, x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    });
  }

  /** Make an object lookable/tappable. Picking hits any mesh inside it. */
  pick(obj: THREE.Object3D, p: Pickable) { this.picks.set(obj, p); }
  unpick(obj: THREE.Object3D) { this.picks.delete(obj); if (this.hovered?.obj === obj) this.setHovered(null); }
  clearPicks() { this.picks.clear(); this.setHovered(null); }

  private setNdc(e: PointerEvent) { const r = this.host.getBoundingClientRect(); this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this.ray.setFromCamera(this.ndc, this.camera); }
  private hit(): THREE.Object3D | null {
    const roots = [...this.picks.keys()].filter(o => o.visible && (this.picks.get(o)!.enabled?.() ?? true));
    if (!roots.length) return null;
    const hits = this.ray.intersectObjects(roots, true);
    for (const h of hits) { let n: THREE.Object3D | null = h.object; while (n) { if (this.picks.has(n)) return n; n = n.parent; } }
    return null;
  }
  private planePoint() { const p = new THREE.Vector3(); return this.ray.ray.intersectPlane(this.plane, p) ? p : null; }
  private setHovered(obj: THREE.Object3D | null) {
    if (this.hovered?.obj === obj) return;
    this.hovered?.p.onHover?.(false);
    this.hovered = obj ? { obj, p: this.picks.get(obj)!, since: performance.now(), fired: false } : null;
    this.hovered?.p.onHover?.(true);
  }
  private calmUntil = 0;
  /** stop look-selecting for a moment (after the board changes under a resting gaze) */
  calm(ms = 700) { this.calmUntil = performance.now() + ms; this.setHovered(null); }
  private pm = (e: PointerEvent) => {
    // looking at an on-screen panel or button never selects the 3D thing behind it
    if ((e.target as HTMLElement)?.closest?.("button,[data-stage-ui]")) { this.setHovered(null); this.pointerHover = false; return; }
    this.setNdc(e); const touch = e.pointerType === "touch"; this.client.x = e.clientX; this.client.y = e.clientY;
    const p = this.planePoint(); if (p) { this.pointer = p; this.pointerHover = !touch; this.lastMove = performance.now(); this.onPointer?.(p, "move", touch); }
    if (!touch) this.setHovered(performance.now() < this.calmUntil ? null : this.hit());
  };
  private pd = (e: PointerEvent) => {
    if ((e.target as HTMLElement)?.closest?.("button,[data-stage-ui]")) return;
    this.setNdc(e); this.pointerDown = true; this.client.x = e.clientX; this.client.y = e.clientY; const p = this.planePoint(); if (p) { this.pointer = p; this.onPointer?.(p, "down", e.pointerType === "touch"); }
    this.downAt = { x: e.clientX, y: e.clientY, obj: this.hit() };
  };
  private pu = (e: PointerEvent) => {
    this.pointerDown = false; const d = this.downAt; this.downAt = null;
    if (this.pointer) this.onPointer?.(this.pointer, "up", e.pointerType === "touch");
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 24) return;
    this.setNdc(e); const obj = this.hit();
    if (obj && obj === d.obj) { const p = this.picks.get(obj)!; if (p.enabled?.() ?? true) { this.setHovered(null); p.onDwell(); } }
  };
  private leave = () => { this.setHovered(null); this.pointerHover = false; };
  /** A touch the tablet took over (a system swipe, a palm): forget it, so nothing stays "held down". */
  private cancel = () => { this.pointerDown = false; this.downAt = null; };

  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false); this.composer?.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.onResize?.(this.camera.aspect);
  }
  /** turn the soft studio reflections on (intensity > 0) or off — needs the env option */
  useEnvironment(intensity: number) { this.scene.environment = intensity > 0 ? this.envTex : null; this.scene.environmentIntensity = intensity; }
  /** the registered object under the pointer right now (if any) */
  hitTest() { return this.hit(); }
  /** is the pointer resting on something lookable right now? */
  get hovering() { return !!this.hovered; }
  /** where the pointer ray meets another plane (e.g. a floor) */
  pointerOn(plane: THREE.Plane) { const p = new THREE.Vector3(); return this.ray.ray.intersectPlane(plane, p) ? p : null; }
  /** move the camera (and what view() measures against) */
  setView(pos: [number, number, number], target: [number, number, number] = [0, 0, 0], fov?: number) {
    this.opts.camPos = pos; this.opts.target = target; this.camera.position.set(...pos); if (fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    this.camera.lookAt(new THREE.Vector3(...target)); this.camera.updateMatrixWorld();
  }
  /** visible half-width / half-height of the z=0 plane */
  view() { const d = this.camera.position.distanceTo(new THREE.Vector3(...(this.opts.target ?? [0, 0, 0]))); const hh = d * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)); return { hw: hh * this.camera.aspect, hh }; }

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
    // dwell ring
    const h = this.hovered;
    if (h && !(h.p.enabled?.() ?? true)) this.setHovered(null);
    if (this.hovered && this.dwell && !this.hovered.fired) {
      const ms = this.hovered.p.dwellMs ?? this.dwellMs, k = Math.min(1, (now - this.hovered.since) / ms);
      const box = new THREE.Box3().setFromObject(this.hovered.obj); const c = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3());
      // sit the ring just in front of the object, facing the camera, sized to what the camera sees
      const tc = this.camera.position.clone().sub(c).normalize();
      this.ring.visible = k > 0.04; this.ring.position.copy(c).addScaledVector(tc, (Math.abs(tc.x) * s.x + Math.abs(tc.y) * s.y + Math.abs(tc.z) * s.z) / 2 + 0.2);
      const seen = Math.max(s.x * Math.sqrt(1 - tc.x * tc.x), s.y * Math.sqrt(1 - tc.y * tc.y), s.z * Math.sqrt(1 - tc.z * tc.z));
      this.ring.scale.setScalar(seen * 0.56 * (this.hovered.p.ringScale ?? 1)); this.ring.quaternion.copy(this.camera.quaternion);
      this.ringGeo.setDrawRange(0, Math.max(6, Math.floor(k * 72) * 6));
      if (k >= 1) { this.hovered.fired = true; this.ring.visible = false; const p = this.hovered.p; p.onDwell(); }
    } else this.ring.visible = false;
    this.onFrame?.(dt, this.t);
    this.fx.update(dt);
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  };
  /** re-arm the dwell on whatever is under the pointer (call after the hovered object changed state) */
  rearm() { if (this.hovered) { this.hovered.since = performance.now(); this.hovered.fired = false; } }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    const w = window as unknown as { __stage?: Stage }; if (w.__stage === this) delete w.__stage; this.resizeObs.disconnect();
    this.host.removeEventListener("pointerdown", this.pd); window.removeEventListener("pointermove", this.pm); window.removeEventListener("pointerup", this.pu); window.removeEventListener("pointercancel", this.cancel); this.host.removeEventListener("pointerleave", this.leave);
    this.envTex?.dispose(); this.fx.dispose(); this.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry?.dispose(); });
    this.composer?.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

/** Soft gradient backdrop sphere. */
export function gradientSky(scene: THREE.Scene, top: number, mid: number, bottom: number) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bot: { value: new THREE.Color(bottom) } },
    vertexShader: "varying vec3 vD; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vD = w.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vD; void main(){ float h = normalize(vD).y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h * 1.6, 0.0, 1.0), 0.8)) : mix(mid, bot, clamp(-h * 2.5, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}" }));
  m.renderOrder = -5; scene.add(m); return m;
}
