// Farm World — who lives on the farm, where they roam, what they eat, and how they are loaded:
// real 3D models (shared per file, cloned with their skeletons) with a hand-built stand-in if a model can't load.
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { FIELD, OBSTACLES, inBox, inPond, POND } from "@/game/farm/world";
import { mesh, std } from "@/game/runner/models";

export type AnimalKind = "cow" | "horse" | "pig" | "sheep" | "goat" | "chicken" | "duck" | "dog";
export type FoodType = "hay" | "grain" | "apple" | "carrot" | "bone";
type Area = { minX: number; maxX: number; minZ: number; maxZ: number };
export type AnimalDef = { id: string; kind: AnimalKind; name: string; sound: string; soundFile: string; soundSeconds: number; fact: string; model: string; x: number; z: number; height: number; speed: number; area: Area; emoji: string;
  /** colour multiplier for breeds made from the same model (a black sheep, a chestnut horse…) */ tint?: [number, number, number];
  /** can you climb on? seat = saddle height as a share of the animal's height */ ride?: { seat: number; walk: number; run: number; saddle?: boolean };
  baby?: boolean };

const commons = (file: string) => "https://commons.wikimedia.org/wiki/Special:Redirect/file/" + encodeURIComponent(file);
export const soundUrl = (d: AnimalDef) => commons(d.soundFile);
const MODEL: Record<AnimalKind, string> = {
  cow: "https://cdn.3dassets.dev/assets/29184/v1/model.glb", horse: "https://cdn.3dassets.dev/assets/29181/v1/model.glb",
  pig: "https://cdn.3dassets.dev/assets/29194/v1/model.glb", sheep: "https://cdn.3dassets.dev/assets/29189/v1/model.glb",
  goat: "https://cdn.3dassets.dev/assets/29192/v1/model.glb", chicken: "https://cdn.3dassets.dev/assets/29197/v1/model.glb",
  duck: "https://cdn.3dassets.dev/assets/29201/v1/model.glb", dog: "https://cdn.3dassets.dev/assets/29204/v1/model.glb",
};
const YOUNG = { calf: "https://cdn.3dassets.dev/assets/29187/v1/model.glb", foal: "https://cdn.3dassets.dev/assets/29180/v1/model.glb" };
const BASE: Record<AnimalKind, { sound: string; soundFile: string; soundSeconds: number; fact: string; height: number; speed: number; emoji: string }> = {
  cow: { sound: "Moo", soundFile: "Single Cow Moo.ogg", soundSeconds: 3.2, fact: "Cows are social animals that graze on grass and hay.", height: 1.65, speed: 0.9, emoji: "🐄" },
  horse: { sound: "Neigh", soundFile: "Wiehern.ogg", soundSeconds: 2.2, fact: "Horses can walk, trot, and gallop, and they use body language to talk to each other.", height: 2.0, speed: 1.3, emoji: "🐴" },
  pig: { sound: "Oink", soundFile: "Mudchute pig 2.ogg", soundSeconds: 0.7, fact: "Pigs are smart and curious and use their noses to explore.", height: 1.05, speed: 0.85, emoji: "🐷" },
  sheep: { sound: "Baa", soundFile: "Mudchute sheep 1.ogg", soundSeconds: 1.1, fact: "Sheep live in flocks and grow wool that keeps them warm.", height: 1.1, speed: 0.8, emoji: "🐑" },
  goat: { sound: "Bleat", soundFile: "Herd of goats bleating.ogg", soundSeconds: 2.8, fact: "Goats are curious explorers and excellent climbers.", height: 1.08, speed: 0.95, emoji: "🐐" },
  chicken: { sound: "Cluck", soundFile: "Chickens demanding food.ogg", soundSeconds: 2.4, fact: "Chickens scratch and peck the ground to find seeds and bugs.", height: 0.62, speed: 1.0, emoji: "🐔" },
  duck: { sound: "Quack", soundFile: "Ducks snatching.ogg", soundSeconds: 2.8, fact: "Ducks have waterproof feathers and webbed feet for swimming.", height: 0.5, speed: 0.8, emoji: "🦆" },
  dog: { sound: "Woof", soundFile: "George vuf 1996.ogg", soundSeconds: 0.8, fact: "Farm dogs help people guide and watch over the animals.", height: 0.78, speed: 1.5, emoji: "🐶" },
};
const S = 3.25;
const HERD = { minX: -40, maxX: -8, minZ: -2, maxZ: 30 }, YARD = { minX: 5, maxX: 40, minZ: -2, maxZ: 29 }, HORSES = { minX: -10, maxX: 19, minZ: -2, maxZ: 30 }, HENS = { minX: 22, maxX: 41, minZ: 1, maxZ: 16 };
const PONDAREA = { minX: POND.x - POND.r + 1, maxX: POND.x + POND.r - 1, minZ: POND.z - POND.r + 1, maxZ: POND.z + POND.r - 1 };
type Extra = Partial<Pick<AnimalDef, "tint" | "ride" | "baby" | "sound" | "fact" | "emoji">>;
const A = (id: string, kind: AnimalKind, name: string, x: number, z: number, area: Area, scale = 1, model = MODEL[kind], extra: Extra = {}): AnimalDef =>
  ({ id, kind, name, x: x * S, z: z * S, area, model, ...BASE[kind], height: BASE[kind].height * scale, speed: BASE[kind].speed * Math.max(0.8, scale), baby: scale < 0.7, ...extra });
const HORSE_RIDE = { seat: 0.74, walk: 4.5, run: 11, saddle: true }, PONY_RIDE = { seat: 0.74, walk: 4, run: 8.5, saddle: true };
const COW_RIDE = { seat: 0.86, walk: 3.2, run: 6 }, PIG_RIDE = { seat: 0.88, walk: 3.2, run: 6.5 }, WOOLLY_RIDE = { seat: 0.9, walk: 3.2, run: 6.5 }, GOAT_RIDE = { seat: 0.9, walk: 3.6, run: 7.5 };
export const ANIMALS: AnimalDef[] = [
  A("cow-1", "cow", "Bessie the Cow", -9.2, 2.1, HERD, 1, MODEL.cow, { ride: COW_RIDE }),
  A("cow-2", "cow", "Daisy the Brown Cow", -6.6, 5.6, HERD, 0.96, MODEL.cow, { ride: COW_RIDE, tint: [0.78, 0.56, 0.4] }),
  A("bull-1", "cow", "Bruno the Bull", -11.5, 6.5, HERD, 1.12, MODEL.cow, { ride: { seat: 0.86, walk: 3.4, run: 6.5 }, tint: [0.36, 0.27, 0.22], fact: "A bull is a grown-up boy cow. Bulls are big and strong!" }),
  A("calf-1", "cow", "Little Calf", -8.0, 4.2, HERD, 0.58, YOUNG.calf),
  A("horse-1", "horse", "Maple the Horse", -1.6, 0.6, HORSES, 1, MODEL.horse, { ride: HORSE_RIDE }),
  A("horse-2", "horse", "Sunny the Chestnut Horse", 3.0, 4.6, HORSES, 0.97, MODEL.horse, { ride: HORSE_RIDE, tint: [1.08, 0.74, 0.52] }),
  A("horse-3", "horse", "Midnight the Black Horse", -2.8, 5.2, HORSES, 1.02, MODEL.horse, { ride: HORSE_RIDE, tint: [0.32, 0.3, 0.33] }),
  A("pony-1", "horse", "Pepper the Pony", 1.6, 7.0, HORSES, 0.72, MODEL.horse, { ride: PONY_RIDE, baby: false, tint: [0.95, 0.9, 0.85], fact: "Ponies are small horses with thick manes. They are strong for their size!", emoji: "🐎" }),
  A("foal-1", "horse", "Little Foal", 0.8, 3.0, HORSES, 0.62, YOUNG.foal),
  A("pig-1", "pig", "Rosie the Pig", 4.4, 7.0, YARD, 1, MODEL.pig, { ride: PIG_RIDE }),
  A("pig-2", "pig", "Poppy the Spotty Pig", 5.3, 6.0, YARD, 0.95, MODEL.pig, { ride: PIG_RIDE, tint: [0.92, 0.72, 0.66] }),
  A("piglet-1", "pig", "Little Piglet", 4.7, 7.6, YARD, 0.55), A("piglet-2", "pig", "Tiny Piglet", 5.0, 7.9, YARD, 0.5),
  A("sheep-1", "sheep", "Cloud the Sheep", -3.8, 6.5, HERD, 1, MODEL.sheep, { ride: WOOLLY_RIDE }),
  A("sheep-2", "sheep", "Snowy the Sheep", -4.8, 7.3, HERD, 0.93, MODEL.sheep, { ride: WOOLLY_RIDE }),
  A("sheep-3", "sheep", "Licorice the Black Sheep", -5.6, 6.1, HERD, 0.95, MODEL.sheep, { ride: WOOLLY_RIDE, tint: [0.3, 0.3, 0.32], fact: "Some sheep have black wool! A black sheep is just as soft and cozy." }),
  A("lamb-1", "sheep", "Little Lamb", -4.2, 5.4, HERD, 0.58), A("lamb-2", "sheep", "Fluffy Lamb", -3.4, 5.9, HERD, 0.55),
  A("goat-1", "goat", "Piper the Goat", 2.4, 6.7, YARD, 1, MODEL.goat, { ride: GOAT_RIDE }),
  A("goat-2", "goat", "Juniper the Goat", 2.0, 5.4, YARD, 0.9, MODEL.goat, { ride: GOAT_RIDE, tint: [0.85, 0.7, 0.55] }),
  A("kid-1", "goat", "Little Kid Goat", 2.6, 6.0, YARD, 0.55, MODEL.goat, { fact: "A baby goat is called a kid. Kids love to jump and play!" }),
  A("chicken-1", "chicken", "Henny the Hen", 8.6, 3.0, HENS), A("chicken-2", "chicken", "Clucky the Chicken", 9.6, 3.8, HENS, 0.9),
  A("rooster-1", "chicken", "Rocky the Rooster", 9.2, 2.6, HENS, 1.15, MODEL.chicken, { tint: [1.0, 0.62, 0.42], sound: "Cock-a-doodle-doo", fact: "Roosters crow early in the morning to say good morning to the farm!" }),
  A("chick-1", "chicken", "Peep the Chick", 8.9, 3.4, HENS, 0.34, MODEL.chicken, { tint: [1.35, 1.2, 0.35], fact: "Chicks are baby chickens. They hatch out of eggs!" }),
  A("chick-2", "chicken", "Cheep the Chick", 9.1, 3.5, HENS, 0.32, MODEL.chicken, { tint: [1.35, 1.2, 0.35], fact: "Chicks are baby chickens. They hatch out of eggs!" }),
  A("duck-1", "duck", "Mallard Duck", POND.x / S - 0.6, POND.z / S, PONDAREA), A("duck-2", "duck", "Dot the Duck", POND.x / S + 0.5, POND.z / S + 0.4, PONDAREA, 0.9),
  A("duckling-1", "duck", "Little Duckling", POND.x / S - 0.3, POND.z / S + 0.2, PONDAREA, 0.42, MODEL.duck, { tint: [1.3, 1.2, 0.4], fact: "Baby ducks are called ducklings. They follow their mom in a line!" }),
  A("duckling-2", "duck", "Tiny Duckling", POND.x / S - 0.1, POND.z / S + 0.25, PONDAREA, 0.4, MODEL.duck, { tint: [1.3, 1.2, 0.4], fact: "Baby ducks are called ducklings. They follow their mom in a line!" }),
  A("dog-1", "dog", "Rex the Farm Dog", 0.6, 1.8, YARD), A("puppy-1", "dog", "Biscuit the Puppy", 1.0, 2.1, YARD, 0.58, MODEL.dog, { fact: "Puppies are baby dogs. They love to play and nap!" }),
];
export const byId = Object.fromEntries(ANIMALS.map(a => [a.id, a])) as Record<string, AnimalDef>;
export const FOOD: Record<FoodType, { label: string; emoji: string }> = { hay: { label: "Hay", emoji: "🌾" }, grain: { label: "Grain", emoji: "🌽" }, apple: { label: "Apples", emoji: "🍎" }, carrot: { label: "Carrots", emoji: "🥕" }, bone: { label: "Dog treat", emoji: "🦴" } };
export const EATS: Record<AnimalKind, FoodType[]> = { cow: ["hay", "grain", "apple"], horse: ["hay", "carrot", "apple", "grain"], pig: ["apple", "carrot", "grain"], sheep: ["hay", "grain"], goat: ["hay", "carrot", "apple", "grain"], chicken: ["grain"], duck: ["grain"], dog: ["bone"] };

export function blocked(x: number, z: number, def?: AnimalDef) {
  if (x < FIELD.minX || x > FIELD.maxX || z < FIELD.minZ || z > FIELD.maxZ) return true;
  if (OBSTACLES.some(o => inBox(x, z, o))) return true;
  if (def?.kind === "duck") return !inPond(x, z, -0.8) && !inPond(x, z, 1.4);
  return inPond(x, z, 1);
}
export function randomTarget(def: AnimalDef) {
  for (let i = 0; i < 60; i++) { const x = def.area.minX + Math.random() * (def.area.maxX - def.area.minX), z = def.area.minZ + Math.random() * (def.area.maxZ - def.area.minZ); if (def.kind === "duck" ? inPond(x, z, -1) : !blocked(x, z, def)) return new THREE.Vector3(x, 0, z); }
  return new THREE.Vector3(def.x, 0, def.z);
}

export function foodMesh(type: FoodType) {
  const g = new THREE.Group();
  if (type === "hay") { const b = mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.7, 14), std(0xd4ab4f, 1, { flatShading: true }), g, [0, 0.35, 0]); b.scale.set(1.4, 1, 1); for (let i = 0; i < 10; i++) { const s = mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), std(0xe7c66b, 1), g, [(Math.random() - 0.5) * 1.1, 0.75, (Math.random() - 0.5) * 0.7]); s.rotation.set(Math.random() - 0.5, 0, Math.random() - 0.5); } }
  else if (type === "grain") { mesh(new THREE.CylinderGeometry(0.6, 0.45, 0.32, 18), std(0x8b5a2b, 0.8), g, [0, 0.16, 0]); const top = mesh(new THREE.SphereGeometry(0.55, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0xe9c46a, 1), g, [0, 0.3, 0]); top.scale.y = 0.35; }
  else if (type === "apple") { mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.36, 14), std(0xa16207, 0.8), g, [0, 0.18, 0]); for (let i = 0; i < 7; i++) { const a = mesh(new THREE.SphereGeometry(0.16, 12, 9), std(i % 3 ? 0xdc2626 : 0x84cc16, 0.55), g, [Math.cos(i) * 0.28 * (i ? 1 : 0), 0.45 + (i ? 0 : 0.12), Math.sin(i) * 0.28 * (i ? 1 : 0)]); void a; } }
  else if (type === "carrot") { for (let i = 0; i < 6; i++) { const c = mesh(new THREE.ConeGeometry(0.1, 0.6, 10), std(0xf97316, 0.7), g, [(i - 2.5) * 0.18, 0.12, Math.sin(i * 2) * 0.12]); c.rotation.z = Math.PI / 2; c.rotation.y = (i - 2.5) * 0.15; const l = mesh(new THREE.ConeGeometry(0.08, 0.25, 5), std(0x16a34a, 0.8), g, [(i - 2.5) * 0.18 - 0.38, 0.14, Math.sin(i * 2) * 0.12]); l.rotation.z = -Math.PI / 2; } }
  else { mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.2, 16), std(0xef4444, 0.5), g, [0, 0.1, 0]); const b = mesh(new THREE.CapsuleGeometry(0.07, 0.38, 3, 8), std(0xfef3c7, 0.6), g, [0, 0.3, 0]); b.rotation.z = Math.PI / 2; for (const s of [-1, 1]) for (const z of [-0.06, 0.06]) mesh(new THREE.SphereGeometry(0.085, 8, 6), std(0xfef3c7, 0.6), g, [s * 0.24, 0.3, z]); }
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return g;
}

/** A friendly hand-built animal used when a model can't be downloaded. Faces +z. */
export function standIn(kind: AnimalKind, height: number) {
  const g = new THREE.Group(); const legs: THREE.Object3D[] = [];
  const col: Record<AnimalKind, [number, number]> = { cow: [0xfafafa, 0x111827], horse: [0x8b5a2b, 0x3b2314], pig: [0xf9a8d4, 0xf472b6], sheep: [0xf8fafc, 0x1f2937], goat: [0xe7e5e4, 0x78716c], chicken: [0xffffff, 0xdc2626], duck: [0xf8fafc, 0x166534], dog: [0xb45309, 0x451a03] };
  const [a, b] = col[kind]; const body = std(a, 0.8), dark = std(b, 0.7);
  const bird = kind === "chicken" || kind === "duck";
  if (bird) {
    mesh(new THREE.SphereGeometry(0.5, 16, 12), body, g, [0, 0.62, 0]).scale.set(0.85, 0.8, 1.15);
    mesh(new THREE.SphereGeometry(0.28, 14, 10), kind === "duck" ? dark : body, g, [0, 1.08, 0.38]);
    const beak = mesh(new THREE.ConeGeometry(0.09, 0.26, 8), std(0xf59e0b, 0.5), g, [0, 1.04, 0.7]); beak.rotation.x = Math.PI / 2;
    if (kind === "chicken") mesh(new THREE.BoxGeometry(0.06, 0.18, 0.26), dark, g, [0, 1.38, 0.36]);
    for (const s of [-1, 1]) { const l = new THREE.Group(); l.position.set(s * 0.16, 0.36, 0); mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.36, 5), std(0xf59e0b, 0.5), l, [0, -0.18, 0]); g.add(l); legs.push(l); mesh(new THREE.SphereGeometry(0.04, 6, 4), std(0x111827), g, [s * 0.14, 1.14, 0.6]); }
  } else {
    const L = kind === "horse" ? 1.6 : kind === "dog" ? 1.0 : 1.3, H = kind === "horse" ? 1.05 : kind === "pig" ? 0.55 : kind === "dog" ? 0.55 : 0.75;
    const torso = mesh(new THREE.CapsuleGeometry(H * 0.5, L * 0.7, 6, 14), body, g, [0, H + 0.45, 0]); torso.rotation.x = Math.PI / 2;
    if (kind === "sheep") for (let i = 0; i < 9; i++) mesh(new THREE.SphereGeometry(0.32, 10, 8), body, g, [(i % 3 - 1) * 0.3, H + 0.75, (Math.floor(i / 3) - 1) * 0.42]);
    if (kind === "cow") for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(0.22, 10, 8), dark, g, [Math.sin(i * 2.1) * 0.35, H + 0.55 + (i % 2) * 0.2, (i - 1.5) * 0.3]).scale.z = 0.4;
    const neck = new THREE.Group(); neck.position.set(0, H + 0.6, L * 0.5); g.add(neck);
    const head = mesh(new THREE.BoxGeometry(H * 0.6, H * 0.6, H * (kind === "horse" ? 1.0 : 0.8)), kind === "sheep" ? dark : body, neck, [0, kind === "horse" ? 0.5 : 0.15, H * 0.35]);
    if (kind === "pig") mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 12), dark, neck, [0, 0.12, H * 0.78]).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) { mesh(new THREE.SphereGeometry(0.05, 6, 4), std(0x111827), head, [s * H * 0.2, H * 0.12, H * 0.38]); const ear = mesh(new THREE.ConeGeometry(0.09, 0.24, 6), dark, head, [s * H * 0.3, H * 0.34, 0]); ear.rotation.z = -s * 0.6; }
    if (kind === "cow" || kind === "goat") for (const s of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(0.05, 0.25, 6), std(0xe7e5e4, 0.6), head, [s * 0.14, H * 0.42, -0.05]); h.rotation.z = -s * 0.3; }
    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const l = new THREE.Group(); l.position.set(x * H * 0.32, H + 0.25, z * L * 0.42); mesh(new THREE.CylinderGeometry(0.09, 0.08, H + 0.25, 7), kind === "sheep" ? dark : body, l, [0, -(H + 0.25) / 2, 0]); mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 7), dark, l, [0, -(H + 0.2), 0]); g.add(l); legs.push(l); }
    const tail = mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.5, 5), dark, g, [0, H + 0.45, -L * 0.62]); tail.rotation.x = -0.6;
  }
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  const box = new THREE.Box3().setFromObject(g); g.scale.setScalar(height / Math.max(0.1, box.max.y)); g.userData.legs = legs; g.userData.standIn = true;
  return g;
}

const loader = new GLTFLoader(); const cache = new Map<string, Promise<GLTF>>();
const load = (url: string) => { let p = cache.get(url); if (!p) { p = loader.loadAsync(url); cache.set(url, p); p.catch(() => cache.delete(url)); } return p; };
export type Loaded = { model: THREE.Object3D; clips: THREE.AnimationClip[]; standIn: boolean };
/** Load an animal's model, scaled to its height and standing on the ground, facing +z. Times out to the stand-in. */
export async function loadAnimal(def: AnimalDef, timeoutMs = 12000): Promise<Loaded> {
  try {
    const gltf = await Promise.race([load(def.model), new Promise<never>((_, rej) => window.setTimeout(() => rej(new Error("timeout")), timeoutMs))]);
    const model = cloneSkinned(gltf.scene) as THREE.Object3D;
    model.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(model); const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(def.height / Math.max(0.01, size.y)); model.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(model); model.position.y = -b2.min.y;
    model.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; if (def.tint) { const tint = (mm: THREE.Material) => { const c = mm.clone() as THREE.MeshStandardMaterial; c.color?.multiply(new THREE.Color(...def.tint!)); return c; }; m.material = Array.isArray(m.material) ? m.material.map(tint) : tint(m.material); } } });
    return { model, clips: gltf.animations, standIn: false };
  } catch { const m = standIn(def.kind, def.height); if (def.tint) m.traverse(o => { const mm = o as THREE.Mesh; if (mm.isMesh) { const c = (mm.material as THREE.MeshStandardMaterial).clone(); c.color.multiply(new THREE.Color(...def.tint!)); mm.material = c; } }); return { model: m, clips: [], standIn: true }; }
}

/** A leather saddle with a red blanket for the horses you can ride (sits on the animal's back). */
export function saddle(def: AnimalDef) {
  const g = new THREE.Group(); const h = def.height, k = h / 2;
  const blanket = mesh(new THREE.BoxGeometry(0.72 * k, 0.04, 0.78 * k), std(0xb91c1c, 0.8), g, [0, 0, 0]); blanket.castShadow = false;
  mesh(new THREE.BoxGeometry(0.76 * k, 0.02, 0.06), std(0xfacc15, 0.6), g, [0, 0.01, 0.38 * k]);
  const seat = mesh(new THREE.CylinderGeometry(0.26 * k, 0.3 * k, 0.12, 18, 1, false, 0, Math.PI), std(0x7c3f16, 0.45), g, [0, 0.07, 0]); seat.rotation.z = Math.PI / 2; seat.rotation.y = Math.PI / 2; seat.scale.set(1, 1.2, 1);
  mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 8), std(0x5a2d0c, 0.5), g, [0, 0.16, 0.2 * k]);
  for (const sd of [-1, 1]) { mesh(new THREE.BoxGeometry(0.02, 0.4 * k, 0.03), std(0x3f2a14, 0.6), g, [sd * 0.3 * k, -0.2 * k, 0]); mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12), std(0x9ca3af, 0.3, { metalness: 0.8 }), g, [sd * 0.3 * k, -0.42 * k, 0]); }
  g.position.y = h * (def.ride?.seat ?? 0.74);
  return g;
}
