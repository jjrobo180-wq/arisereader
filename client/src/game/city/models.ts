// Car models for the city. Kenney Car Kit (CC0) models face +z with named wheel
// nodes, so wheels can spin and the front pair can steer.
import * as THREE from "three";
import { loadGltfCached } from "@/lib/worldAvatar";
import { CAR_MODELS } from "@/lib/worldModels";
import type { CarId } from "@shared/city/drive";

const MODEL_FOR: Record<CarId, string> = {
  "car-starter": "/world/sedan.glb",
  "car-street": CAR_MODELS["car-street"],
  "car-electric": CAR_MODELS["car-electric"],
  "car-super": CAR_MODELS["car-super"],
  "car-suv": CAR_MODELS["car-suv"],
};

const repaintCache = new Map<string, THREE.Texture>();

/**
 * Repaints a car: the Kenney models share one palette texture, so we copy it and
 * move every strongly coloured pixel (the paint) to the tint's hue, leaving glass,
 * tyres and chrome alone.
 */
function repaint(src: THREE.Texture, tint: number): THREE.Texture | null {
  const key = src.uuid + ":" + tint;
  const hit = repaintCache.get(key); if (hit) return hit;
  const img = src.image as CanvasImageSource & { width: number; height: number };
  if (!img || !img.width) return null;
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const g = c.getContext("2d", { willReadFrequently: true }); if (!g) return null;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height);
  const target = new THREE.Color(tint), hsl = { h: 0, s: 0, l: 0 }, t = { h: 0, s: 0, l: 0 }, col = new THREE.Color();
  target.getHSL(t);
  for (let i = 0; i < data.data.length; i += 4) {
    col.setRGB(data.data[i] / 255, data.data[i + 1] / 255, data.data[i + 2] / 255);
    col.getHSL(hsl);
    if (hsl.s < 0.35 || hsl.l < 0.12 || hsl.l > 0.92) continue;
    col.setHSL(t.h, Math.min(1, hsl.s * 0.6 + t.s * 0.4), hsl.l * 0.7 + t.l * 0.3);
    data.data[i] = col.r * 255; data.data[i + 1] = col.g * 255; data.data[i + 2] = col.b * 255;
  }
  g.putImageData(data, 0, 0);
  const out = new THREE.CanvasTexture(c);
  out.flipY = src.flipY; out.colorSpace = src.colorSpace; out.magFilter = src.magFilter; out.minFilter = src.minFilter; out.wrapS = src.wrapS; out.wrapT = src.wrapT;
  repaintCache.set(key, out);
  return out;
}

export type CarRig = { root: THREE.Group; setMotion: (speed: number, steer: number, dt: number) => void; dispose: () => void };

/**
 * A car: the model scaled to `length` units, sitting on y = 0 and facing +z.
 * `tint` recolours it (the free starter is teal, traffic cars get their own colours).
 */
export function makeCar(id: CarId | string, opts: { length?: number; tint?: number; path?: string } = {}): CarRig {
  const root = new THREE.Group();
  const length = opts.length ?? 4.4;
  const wheels: THREE.Object3D[] = [], fronts: THREE.Object3D[] = [];
  let spin = 0;
  const owned: THREE.Material[] = [];
  const path = opts.path ?? MODEL_FOR[id as CarId] ?? MODEL_FOR["car-starter"];
  const tint = opts.tint ?? (id === "car-starter" ? 0x5eead4 : undefined);
  let disposed = false;
  loadGltfCached(path).then((gltf) => {
    if (disposed) return;
    const model = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(length / Math.max(0.01, size.z));
    model.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(model), c = b2.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -b2.min.y, -c.z);
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true; m.receiveShadow = true;
        if (tint !== undefined && /body/i.test(m.name + (m.parent?.name || ""))) {
          const base = m.material as THREE.MeshStandardMaterial;
          const map = base.map ? repaint(base.map, tint) : null;
          if (map) { const mat = base.clone(); mat.map = map; m.material = mat; owned.push(mat); }
        }
      }
      if (/^wheel/i.test(o.name)) { wheels.push(o); if (/front/i.test(o.name)) fronts.push(o); }
    });
    root.add(model);
  }).catch(() => {
    // fall back to a simple box car so the game still works
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1, length), new THREE.MeshStandardMaterial({ color: tint ?? 0x3b82f6 }));
    body.position.y = 0.7; root.add(body);
  });
  return {
    root,
    setMotion(speed, steer, dt) {
      spin += (speed / 0.35) * dt;
      for (const w of wheels) w.rotation.x = spin;
      for (const f of fronts) f.rotation.y = steer * 0.45;
    },
    dispose() { disposed = true; owned.forEach((m) => m.dispose()); },
  };
}
