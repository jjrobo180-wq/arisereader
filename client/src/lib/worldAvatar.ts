import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { getAvatarCharacter } from "@/lib/avatarCharacters";

// One download per model, shared by every avatar that uses it.
const cache = new Map<string, Promise<GLTF>>();
const loader = new GLTFLoader();
export function loadGltfCached(path: string): Promise<GLTF> {
  let p = cache.get(path);
  if (!p) { p = loader.loadAsync(path); cache.set(path, p); p.catch(() => cache.delete(path)); }
  return p;
}

/** A walking, waving character: idle ↔ walk ↔ run blending plus one-shot gestures. */
export class AvatarRig {
  readonly root = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Record<string, THREE.AnimationAction> = {};
  private current = "";
  private gestureUntil = 0;
  private disposed = false;
  loaded = false;

  /** noWeapons hides prop weapons some models carry (Haven City has none). */
  constructor(characterId: string, height = 2.5, opts: { noWeapons?: boolean } = {}) {
    loadGltfCached(getAvatarCharacter(characterId).modelPath).then(gltf => {
      if (this.disposed) return;
      const model = cloneSkinned(gltf.scene) as THREE.Group;
      const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
      model.scale.setScalar(height / Math.max(0.01, size.y));
      model.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(model);
      model.position.y = -b2.min.y;
      model.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } });
      if (opts.noWeapons) model.traverse(o => { if ((o as THREE.Mesh).isMesh && /^(sword|pistol|gun|knife|dagger|axe|bow|crossbow)/i.test(o.name)) o.visible = false; });
      this.root.add(model);
      if (gltf.animations.length) {
        this.mixer = new THREE.AnimationMixer(model);
        const find = (re: RegExp) => gltf.animations.find(a => re.test(a.name));
        const map: Record<string, THREE.AnimationClip | undefined> = {
          idle: find(/^idle$/i) || find(/idle/i) || gltf.animations[0], walk: find(/^walk$/i) || find(/walk/i), run: find(/^run$/i),
          wave: find(/wave/i), interact: find(/interact/i), roll: find(/roll/i),
        };
        for (const k of Object.keys(map)) { const clip = map[k]; if (clip) this.actions[k] = this.mixer.clipAction(clip); }
        for (const k of ["wave", "interact", "roll"]) { const a = this.actions[k]; if (a) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } }
        this.play("idle", 0);
      }
      this.loaded = true;
    }).catch(() => { /* a missing model leaves just the name tag */ });
  }

  private play(name: string, fade = 0.2) {
    const next = this.actions[name] || this.actions.idle;
    if (!next || this.current === name) return;
    const prev = this.actions[this.current];
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (prev && prev !== next) prev.fadeOut(fade);
    this.current = name;
  }

  gesture(name: "wave" | "interact" | "roll") {
    const a = this.actions[name]; if (!a) return;
    this.play(name, 0.15);
    this.gestureUntil = performance.now() + a.getClip().duration * 1000 - 150;
  }

  /** speed in world units/s decides idle, walk or run. */
  update(dt: number, speed: number) {
    if (!this.mixer) return;
    if (performance.now() > this.gestureUntil || speed > 0.5) {
      this.play(speed > 6 ? "run" : speed > 0.4 ? "walk" : "idle");
      const w = this.actions.walk;
      if (w && this.current === "walk") w.timeScale = THREE.MathUtils.clamp(speed / 3.2, 0.7, 1.6);
    }
    this.mixer.update(dt);
  }

  dispose() { this.disposed = true; this.mixer?.stopAllAction(); }
}

/** Pets trot behind their owner with a little hop. */
export function followOwner(pet: THREE.Object3D, owner: THREE.Object3D, dt: number, t: number, offset = 1.3) {
  const behind = new THREE.Vector3(-Math.sin(owner.rotation.y) * offset, 0, -Math.cos(owner.rotation.y) * offset).add(owner.position);
  // trot slightly to the side so the pet stays visible behind its owner
  behind.x += Math.cos(owner.rotation.y) * 0.6;
  behind.z -= Math.sin(owner.rotation.y) * 0.6;
  const d = behind.clone().sub(pet.position); d.y = 0;
  const dist = d.length();
  if (dist > 0.05) {
    const step = Math.min(dist, dt * Math.max(2.5, dist * 3.2));
    pet.position.addScaledVector(d.normalize(), step);
    pet.rotation.y = THREE.MathUtils.lerp(pet.rotation.y, Math.atan2(d.x, d.z), Math.min(1, dt * 8));
  }
  pet.position.y = dist > 0.25 ? Math.abs(Math.sin(t * 11)) * 0.18 : Math.abs(Math.sin(t * 2)) * 0.03;
  if (dist > 12) pet.position.copy(behind);
}

export function nameTag(text: string, color = "#0f172a", sub?: string) {
  const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = sub ? 190 : 150;
  const c = canvas.getContext("2d")!;
  c.fillStyle = color; c.beginPath(); (c as any).roundRect(14, 18, 612, canvas.height - 38, 32); c.fill();
  c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 5; c.stroke();
  c.fillStyle = "#fff"; c.font = "800 44px system-ui"; c.textAlign = "center"; c.textBaseline = "middle";
  const t = text.length > 24 ? text.slice(0, 23) + "…" : text;
  c.fillText(t, 320, sub ? 66 : 74);
  if (sub) { c.font = "700 32px system-ui"; c.fillStyle = "rgba(255,255,255,.85)"; c.fillText(sub, 320, 124); }
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(4.6, 4.6 * canvas.height / 640, 1); sprite.renderOrder = 20;
  return sprite;
}

/** Reads ?key=value from a hash route like #/my-home?owner=5 (or a normal query string). */
export function hashParam(name: string) {
  const h = window.location.hash, i = h.indexOf("?");
  const fromHash = i >= 0 ? new URLSearchParams(h.slice(i + 1)).get(name) : null;
  return fromHash ?? new URLSearchParams(window.location.search).get(name);
}
