import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Apple, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eye, Hand, Move, Volume2, VolumeX, Wheat } from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";

type AnimalKind = "cow" | "horse" | "pig" | "sheep" | "goat" | "chicken" | "duck" | "dog";
type FoodType = "hay" | "grain" | "apple" | "carrot";

type AnimalDef = {
  id: string;
  kind: AnimalKind;
  name: string;
  sound: string;
  soundFile: string;
  soundSeconds: number;
  fact: string;
  model: string;
  x: number;
  z: number;
  height: number;
  speed: number;
  area: { minX: number; maxX: number; minZ: number; maxZ: number };
};

type AnimalRuntime = {
  def: AnimalDef;
  root: THREE.Group;
  target: THREE.Vector3;
  moving: boolean;
  pausedUntil: number;
  phase: number;
  mixer: THREE.AnimationMixer | null;
  walkAction: THREE.AnimationAction | null;
  idleAction: THREE.AnimationAction | null;
  activeAction: "walk" | "idle" | null;
  proceduralLegs: THREE.Object3D[];
  canRoam: boolean;
  foodTarget: string | null;
};

type FoodRuntime = {
  id: string;
  type: FoodType;
  root: THREE.Group;
  position: THREE.Vector3;
  claimedBy: string | null;
};

type Obstacle = { minX: number; maxX: number; minZ: number; maxZ: number; pad?: number };

const commonsAudio = (file: string) =>
  "https://commons.wikimedia.org/wiki/Special:Redirect/file/" + encodeURIComponent(file);

const MODEL = {
  cow: "https://static.poly.pizza/382b3d4a-a7c9-4c03-9858-3df630d90047.glb",
  horse: "https://static.poly.pizza/d37dbc87-ca61-4b2c-a2da-d2f0c4240bef.glb",
  pig: "https://cdn.3dassets.dev/assets/29194/v1/model.glb",
  sheep: "https://cdn.3dassets.dev/assets/29189/v1/model.glb",
  goat: "https://cdn.3dassets.dev/assets/29192/v1/model.glb",
  chicken: "https://cdn.3dassets.dev/assets/29197/v1/model.glb",
  duck: "https://cdn.3dassets.dev/assets/29201/v1/model.glb",
  dog: "https://cdn.3dassets.dev/assets/29204/v1/model.glb",
} satisfies Record<AnimalKind, string>;

const BASE = {
  cow: { sound: "Moo", soundFile: "Single Cow Moo.ogg", soundSeconds: 3.2, fact: "Cows are social animals that graze on grass and hay.", height: 1.65, speed: 0.46 },
  horse: { sound: "Neigh", soundFile: "Wiehern.ogg", soundSeconds: 2.2, fact: "Horses can walk, trot, and gallop, and they use body language to communicate.", height: 2.0, speed: 0.72 },
  pig: { sound: "Oink", soundFile: "Mudchute pig 2.ogg", soundSeconds: 0.7, fact: "Pigs are intelligent and curious and use their noses to explore.", height: 1.05, speed: 0.44 },
  sheep: { sound: "Baa", soundFile: "Mudchute sheep 1.ogg", soundSeconds: 1.1, fact: "Sheep live in flocks and grow wool that helps keep them warm.", height: 1.1, speed: 0.42 },
  goat: { sound: "Bleat", soundFile: "Herd of goats bleating.ogg", soundSeconds: 2.8, fact: "Goats are curious explorers and excellent climbers.", height: 1.08, speed: 0.5 },
  chicken: { sound: "Cluck", soundFile: "Chickens demanding food.ogg", soundSeconds: 2.4, fact: "Chickens scratch and peck at the ground to find seeds and insects.", height: 0.62, speed: 0.58 },
  duck: { sound: "Quack", soundFile: "Ducks snatching.ogg", soundSeconds: 2.8, fact: "Ducks have waterproof feathers and webbed feet that help them swim.", height: 0.5, speed: 0.5 },
  dog: { sound: "Bark", soundFile: "George vuf 1996.ogg", soundSeconds: 0.8, fact: "Farm dogs can help people guide and watch livestock.", height: 0.78, speed: 0.68 },
} as const;

const SPACE = 3.25;
const FIELD = { minX: -45, maxX: 45, minZ: -34, maxZ: 36 };
const POND = { minX: 25, maxX: 42, minZ: 17, maxZ: 34 };
const BARN_A: Obstacle = { minX: -32.5, maxX: -26.0, minZ: -22.5, maxZ: -16.5, pad: 1.3 };
const BARN_B: Obstacle = { minX: -4.0, maxX: 3.0, minZ: -22.0, maxZ: -16.5, pad: 1.3 };
const STABLE: Obstacle = { minX: 23.0, maxX: 29.5, minZ: -21.5, maxZ: -15.5, pad: 1.3 };
const COOP: Obstacle = { minX: 28.0, maxX: 32.5, minZ: 3.5, maxZ: 7.7, pad: 0.9 };
const OBSTACLES: Obstacle[] = [BARN_A, BARN_B, STABLE, COOP];

const HERD_AREA = { minX: -40, maxX: -8, minZ: -4, maxZ: 30 };
const YARD_AREA = { minX: 5, maxX: 40, minZ: -3, maxZ: 29 };
const HORSE_AREA = { minX: -10, maxX: 19, minZ: -4, maxZ: 30 };
const CHICKEN_AREA = { minX: 24, maxX: 41, minZ: 3, maxZ: 24 };

const animal = (
  id: string,
  kind: AnimalKind,
  name: string,
  x: number,
  z: number,
  area: AnimalDef["area"],
  scale = 1,
): AnimalDef => ({
  id, kind, name, x: x * SPACE, z: z * SPACE, area,
  model: MODEL[kind],
  sound: BASE[kind].sound,
  soundFile: BASE[kind].soundFile,
  soundSeconds: BASE[kind].soundSeconds,
  fact: BASE[kind].fact,
  height: BASE[kind].height * scale,
  speed: BASE[kind].speed * Math.max(0.78, scale),
});

const ANIMALS: AnimalDef[] = [
  animal("cow-1", "cow", "Bessie the Cow", -9.2, 2.1, HERD_AREA),
  animal("cow-2", "cow", "Daisy the Cow", -6.6, 5.6, HERD_AREA, 0.96),
  animal("calf-1", "cow", "Little Calf", -8.0, 4.2, HERD_AREA, 0.58),
  animal("horse-1", "horse", "Maple the Horse", -1.6, 0.3, HORSE_AREA),
  animal("horse-2", "horse", "Sunny the Horse", 3.0, 4.6, HORSE_AREA, 0.94),
  animal("foal-1", "horse", "Little Foal", 0.8, 3.0, HORSE_AREA, 0.62),
  animal("pig-1", "pig", "Rosie the Pig", 3.8, 7.0, YARD_AREA),
  animal("pig-2", "pig", "Poppy the Pig", 5.3, 6.0, YARD_AREA, 0.92),
  animal("piglet-1", "pig", "Little Piglet", 4.5, 5.0, YARD_AREA, 0.58),
  animal("sheep-1", "sheep", "Cloud the Sheep", -3.8, 6.5, HERD_AREA),
  animal("sheep-2", "sheep", "Snowy the Sheep", -1.8, 7.3, HERD_AREA, 0.93),
  animal("lamb-1", "sheep", "Little Lamb", -2.7, 5.4, HERD_AREA, 0.58),
  animal("goat-1", "goat", "Piper the Goat", 1.8, 6.7, YARD_AREA),
  animal("goat-2", "goat", "Juniper the Goat", 1.0, 5.2, YARD_AREA, 0.9),
  animal("chicken-1", "chicken", "Hen", 8.6, 3.8, CHICKEN_AREA),
  animal("chicken-2", "chicken", "Chicken", 9.8, 4.8, CHICKEN_AREA, 0.9),
  animal("duck-1", "duck", "Mallard Duck", 9.3, 6.7, POND),
  animal("duck-2", "duck", "Duck", 10.4, 7.5, POND, 0.9),
  animal("dog-1", "dog", "Farm Dog", 0.0, 1.8, YARD_AREA),
];

const byId = Object.fromEntries(ANIMALS.map(a => [a.id, a])) as Record<string, AnimalDef>;

const FOOD_LABEL: Record<FoodType, string> = {
  hay: "Hay",
  grain: "Grain",
  apple: "Apples",
  carrot: "Carrots",
};

const FOOD_COMPATIBILITY: Record<AnimalKind, FoodType[]> = {
  cow: ["hay", "grain", "apple"],
  horse: ["hay", "grain", "apple", "carrot"],
  pig: ["grain", "apple", "carrot"],
  sheep: ["hay", "grain"],
  goat: ["hay", "grain", "apple", "carrot"],
  chicken: ["grain"],
  duck: ["grain"],
  dog: [],
};

function prepareGroundedModel(model: THREE.Group, wantedHeight: number) {
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.updateMatrixWorld(true);
  const initial = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  initial.getSize(size);
  model.scale.setScalar(wantedHeight / Math.max(0.01, size.y));
  model.updateMatrixWorld(true);
  const scaled = new THREE.Box3().setFromObject(model);
  model.position.y = -scaled.min.y;
  model.updateMatrixWorld(true);
}

function findProceduralLegs(root: THREE.Object3D) {
  const named: THREE.Object3D[] = [];
  const lowBones: Array<{ node: THREE.Bone; y: number }> = [];
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  bounds.getSize(size);
  const cutoff = bounds.min.y + size.y * 0.62;

  root.traverse(obj => {
    const n = obj.name.toLowerCase();
    if (/leg|hoof|foot|forelimb|hindlimb|front[_ -]?limb|rear[_ -]?limb|ankle|hock|paw/.test(n)) named.push(obj);
    if ((obj as THREE.Bone).isBone) {
      const p = new THREE.Vector3();
      obj.getWorldPosition(p);
      if (p.y <= cutoff) lowBones.push({ node: obj as THREE.Bone, y: p.y });
    }
  });

  if (named.length >= 2) return named.slice(0, 8);
  return lowBones.sort((a,b) => a.y - b.y).map(x => x.node).slice(0, 8);
}

function findClip(clips: THREE.AnimationClip[], pattern: RegExp) {
  return clips.find(clip => pattern.test(clip.name)) || null;
}

function insideObstacle(x: number, z: number, obstacle: Obstacle) {
  const p = obstacle.pad ?? 0;
  return x > obstacle.minX - p && x < obstacle.maxX + p && z > obstacle.minZ - p && z < obstacle.maxZ + p;
}

function blocked(x: number, z: number, def?: AnimalDef) {
  if (x < FIELD.minX || x > FIELD.maxX || z < FIELD.minZ || z > FIELD.maxZ) return true;
  if (OBSTACLES.some(o => insideObstacle(x, z, o))) return true;
  if (
    def?.kind !== "duck"
    && x > POND.minX - 1
    && x < POND.maxX + 1
    && z > POND.minZ - 1
    && z < POND.maxZ + 1
  ) return true;
  return false;
}

function randomTarget(def: AnimalDef) {
  for (let i = 0; i < 60; i++) {
    const x = def.area.minX + Math.random() * (def.area.maxX - def.area.minX);
    const z = def.area.minZ + Math.random() * (def.area.maxZ - def.area.minZ);
    if (!blocked(x, z, def)) return new THREE.Vector3(x, 0, z);
  }
  return new THREE.Vector3(def.x, 0, def.z);
}

function addBox(
  scene: THREE.Scene,
  size: [number, number, number],
  pos: [number, number, number],
  color: number,
  roughness = 0.9,
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color, roughness }),
  );
  mesh.position.set(...pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addBarn(scene: THREE.Scene, x: number, z: number, w: number, d: number, wall = 0x9b3d2f, roof = 0x4f241c) {
  addBox(scene, [w, 3.5, d], [x, 1.75, z], wall);
  const panelA = addBox(scene, [w * 0.62, 0.28, d + 0.5], [x - w * 0.18, 3.85, z], roof);
  panelA.rotation.z = Math.PI / 5.1;
  const panelB = addBox(scene, [w * 0.62, 0.28, d + 0.5], [x + w * 0.18, 3.85, z], roof);
  panelB.rotation.z = -Math.PI / 5.1;
  addBox(scene, [w * 0.28, 2.55, 0.18], [x, 1.35, z + d / 2 + 0.1], 0x3d241d);
  addBox(scene, [0.16, 1.0, 0.2], [x - w * 0.33, 2.0, z + d / 2 + 0.12], 0xe8d7a9);
  addBox(scene, [0.16, 1.0, 0.2], [x + w * 0.33, 2.0, z + d / 2 + 0.12], 0xe8d7a9);
}

function addFence(scene: THREE.Scene, x1: number, z1: number, x2: number, z2: number) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const rail1 = addBox(scene, [len, 0.12, 0.12], [cx, 0.85, cz], 0x8b5a2b);
  const rail2 = addBox(scene, [len, 0.12, 0.12], [cx, 1.35, cz], 0x8b5a2b);
  rail1.rotation.y = -angle;
  rail2.rotation.y = -angle;
  const posts = Math.max(2, Math.ceil(len / 2.2));
  for (let i = 0; i <= posts; i++) {
    const t = i / posts;
    addBox(scene, [0.16, 1.8, 0.16], [x1 + dx * t, 0.9, z1 + dz * t], 0x6f451f);
  }
}

function addTree(scene: THREE.Scene, x: number, z: number, s = 1) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.22 * s, 2.2 * s, 10), new THREE.MeshStandardMaterial({ color: 0x6b4424 }));
  trunk.position.set(x, 1.1 * s, z);
  trunk.castShadow = true;
  scene.add(trunk);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15 * s, 2), new THREE.MeshStandardMaterial({ color: 0x477d38, roughness: 1 }));
  crown.position.set(x, 2.7 * s, z);
  crown.castShadow = true;
  scene.add(crown);
}

function createFoodMesh(type: FoodType) {
  const root = new THREE.Group();
  if (type === "hay") {
    const hay = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.6, 0.8), new THREE.MeshStandardMaterial({ color: 0xc99b35, roughness: 1 }));
    hay.position.y = 0.3;
    hay.castShadow = true;
    root.add(hay);
  } else if (type === "grain") {
    const trough = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.32, 0.72), new THREE.MeshStandardMaterial({ color: 0x6d4526, roughness: 1 }));
    trough.position.y = 0.22;
    root.add(trough);
    const grain = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.1, 0.48), new THREE.MeshStandardMaterial({ color: 0xd9b95d, roughness: 1 }));
    grain.position.y = 0.43;
    root.add(grain);
  } else if (type === "apple") {
    for (let i = 0; i < 7; i++) {
      const apple = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), new THREE.MeshStandardMaterial({ color: 0xa92d27, roughness: 0.78 }));
      apple.position.set((i % 4) * 0.28 - 0.42, 0.16 + Math.floor(i / 4) * 0.18, (i % 2) * 0.26 - 0.12);
      apple.castShadow = true;
      root.add(apple);
    }
  } else {
    for (let i = 0; i < 7; i++) {
      const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 10), new THREE.MeshStandardMaterial({ color: 0xe9821f, roughness: 0.85 }));
      carrot.rotation.z = Math.PI / 2;
      carrot.position.set((i % 4) * 0.28 - 0.42, 0.16, (i % 2) * 0.26 - 0.12);
      carrot.castShadow = true;
      root.add(carrot);
    }
  }
  return root;
}

export default function EyeGazeFarmWorld() {
  const [, navigate] = useLocation();
  const mountRef = useRef<HTMLDivElement>(null);
  const animalsRef = useRef<Map<string, AnimalRuntime>>(new Map());
  const foodsRef = useRef<Map<string, FoodRuntime>>(new Map());
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const hoveredRef = useRef<string | null>(null);
  const dwellTimerRef = useRef<number | null>(null);
  const dragRef = useRef<{ id: string; plane: THREE.Plane } | null>(null);
  const animationRef = useRef<number | null>(null);
  const animalAudioRef = useRef<HTMLAudioElement | null>(null);
  const animalAudioTimerRef = useRef<number | null>(null);
  const foodCounterRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [loadMessage, setLoadMessage] = useState("Opening your expanded farm…");
  const [muted, setMuted] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedMode, setFeedMode] = useState<FoodType | null>(null);
  const [message, setMessage] = useState("Explore the farm. Animals roam, eat, and react to you.");

  const selectedAnimal = selected ? byId[selected] : null;

  const stopAnimalAudio = useCallback(() => {
    if (animalAudioTimerRef.current) window.clearTimeout(animalAudioTimerRef.current);
    animalAudioTimerRef.current = null;
    if (animalAudioRef.current) {
      animalAudioRef.current.pause();
      animalAudioRef.current.currentTime = 0;
      animalAudioRef.current = null;
    }
  }, []);

  const playAuthenticSound = useCallback((animal: AnimalDef, after?: () => void) => {
    stopAnimalAudio();
    const audio = new Audio(commonsAudio(animal.soundFile));
    animalAudioRef.current = audio;
    audio.volume = 0.95;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (animalAudioTimerRef.current) window.clearTimeout(animalAudioTimerRef.current);
      animalAudioTimerRef.current = null;
      if (animalAudioRef.current === audio) animalAudioRef.current = null;
      audio.pause();
      after?.();
    };
    audio.onended = finish;
    audio.onerror = finish;
    void audio.play().then(() => {
      animalAudioTimerRef.current = window.setTimeout(finish, animal.soundSeconds * 1000);
    }).catch(finish);
  }, [stopAnimalAudio]);

  const speakAnimal = useCallback((id: string, withFact = false) => {
    const animal = byId[id];
    if (!animal) return;
    setSelected(id);
    setMessage(withFact ? animal.fact : animal.name + " · authentic " + animal.sound.toLowerCase());
    stopSpeaking();
    stopAnimalAudio();
    if (muted) return;

    void speakCharacterAI(animal.name, {
      calmMode: true,
      onEnd: () => {
        playAuthenticSound(animal, withFact ? () => { void speakCharacterAI(animal.fact, { calmMode: true }); } : undefined);
      },
      onFallback: () => {
        playAuthenticSound(animal, withFact ? () => { void speakCharacterAI(animal.fact, { calmMode: true }); } : undefined);
      },
    });
  }, [muted, playAuthenticSound, stopAnimalAudio]);

  useEffect(() => {
    if (muted) {
      stopSpeaking();
      stopAnimalAudio();
    }
  }, [muted, stopAnimalAudio]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x91c9eb);
    scene.fog = new THREE.FogExp2(0xcbe3ed, 0.014);

    const camera = new THREE.PerspectiveCamera(49, mount.clientWidth / mount.clientHeight, 0.1, 150);
    camera.position.set(58, 31, 64);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.className = "absolute inset-0 h-full w-full";
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2.5, 3);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 8;
    controls.maxDistance = 96;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.enablePan = true;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xe6f5ff, 0x526d34, 2.3));
    const sun = new THREE.DirectionalLight(0xffefce, 4.5);
    sun.position.set(-15, 22, 11);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -28;
    sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 28;
    sun.shadow.camera.bottom = -28;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(104, 88, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x6d9c45, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData.isFarmGround = true;
    scene.add(ground);

    // Farm paths and mud.
    const path = addBox(scene, [7.5, 0.035, 70], [1.0, 0.02, 3], 0xb79265);
    path.rotation.y = -0.12;
    const mud = new THREE.Mesh(new THREE.CircleGeometry(2.35, 48), new THREE.MeshStandardMaterial({ color: 0x6f4b32, roughness: 1 }));
    mud.rotation.x = -Math.PI / 2;
    mud.scale.setScalar(2.2);
    mud.position.set(15, 0.03, 23);
    scene.add(mud);

    // Three larger buildings + coop.
    addBarn(scene, -29.3, -19.5, 6.0, 5.3, 0x8d342b, 0x3c241f);
    addBarn(scene, -0.5, -19.2, 6.4, 4.8, 0xb35835, 0x4b2d23);
    addBarn(scene, 26.3, -18.5, 5.8, 5.2, 0xd3b56c, 0x5b3a24);
    addBarn(scene, 30.3, 5.6, 4.0, 3.6, 0x9b5536, 0x4a2c22);

    // Pond with bank.
    const pondBank = new THREE.Mesh(new THREE.CircleGeometry(3.2, 64), new THREE.MeshStandardMaterial({ color: 0x6b7f43, roughness: 1 }));
    pondBank.rotation.x = -Math.PI / 2;
    pondBank.scale.setScalar(2.6);
    pondBank.position.set(33.5, 0.035, 25.5);
    scene.add(pondBank);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(2.75, 64), new THREE.MeshPhysicalMaterial({ color: 0x4da9cb, roughness: 0.18, metalness: 0, transparent: true, opacity: 0.9 }));
    pond.rotation.x = -Math.PI / 2;
    pond.scale.setScalar(2.6);
    pond.position.set(33.5, 0.06, 25.5);
    scene.add(pond);

    // Fenced zones, but with gaps.
    addFence(scene, -42, -4, -31, -4);
    addFence(scene, -26, -4, -10, -4);
    addFence(scene, -5, -4, 12, -4);
    addFence(scene, 18, -4, 40, -4);
    addFence(scene, -42, 32, -22, 32);
    addFence(scene, -16, 32, 6, 32);
    addFence(scene, 12, 32, 22, 32);
    addFence(scene, -42, -4, -42, 32);
    addFence(scene, 43, -4, 43, 15);

    // Troughs.
    addBox(scene, [3.4, 0.48, 1.0], [-25, 0.25, 4], 0x704725);
    addBox(scene, [3.4, 0.48, 1.0], [0, 0.25, 23], 0x704725);
    addBox(scene, [2.6, 0.35, 0.8], [27, 0.2, 12], 0x704725);

    // Hay bales.
    for (const [x,z,r] of [[-20,-11,0],[9,-12,0.2],[20,-9,-0.15],[-12,20,0.1]] as const) {
      const bale = new THREE.Mesh(new THREE.CylinderGeometry(0.68,0.68,1.15,22), new THREE.MeshStandardMaterial({ color: 0xc89d3f, roughness: 1 }));
      bale.rotation.z = Math.PI/2;
      bale.rotation.y = r;
      bale.position.set(x,0.7,z);
      bale.castShadow = true;
      scene.add(bale);
    }

    // Trees / visual depth.
    [[-48,-30,1.6],[-48,-8,1.35],[-47,18,1.5],[-45,35,1.7],[47,-28,1.55],[48,-4,1.35],[47,18,1.45],[46,38,1.7],[20,40,1.35],[-20,42,1.45]].forEach(([x,z,s]) => addTree(scene,x,z,s));

    const loader = new GLTFLoader();
    let remaining = ANIMALS.length;

    for (const def of ANIMALS) {
      loader.load(def.model, gltf => {
        if (disposed) return;
        const model = gltf.scene.clone(true);
        prepareGroundedModel(model, def.height);

        const root = new THREE.Group();
        root.name = "ARISE_ANIMAL_" + def.id;
        root.position.set(def.x, 0, def.z);
        root.rotation.y = Math.random() * Math.PI * 2;
        root.add(model);

        root.traverse(obj => {
          obj.userData.ariseAnimalId = def.id;
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });

        let mixer: THREE.AnimationMixer | null = null;
        let walkAction: THREE.AnimationAction | null = null;
        let idleAction: THREE.AnimationAction | null = null;
        if (gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          const walkClip = findClip(gltf.animations, /walk|trot|run/i) || gltf.animations[0];
          const idleClip = findClip(gltf.animations, /idle|stand|rest|eat|graze/i);
          walkAction = walkClip ? mixer.clipAction(walkClip) : null;
          idleAction = idleClip ? mixer.clipAction(idleClip) : null;
          if (idleAction) idleAction.play();
          else if (walkAction) {
            walkAction.play();
            walkAction.paused = true;
          }
        }

        const proceduralLegs = findProceduralLegs(model);
        const canRoam = !!walkAction || proceduralLegs.length >= 2;

        scene.add(root);
        animalsRef.current.set(def.id, {
          def, root, target: randomTarget(def), moving: canRoam,
          pausedUntil: performance.now() + Math.random() * 2200,
          phase: Math.random() * Math.PI * 2,
          mixer, walkAction, idleAction,
          activeAction: idleAction ? "idle" : null,
          proceduralLegs,
          canRoam,
          foodTarget: null,
        });

        remaining -= 1;
        setLoadMessage("Bringing in " + remaining + " more animal" + (remaining === 1 ? "" : "s") + "…");
        if (remaining <= 0) {
          setLoading(false);
          setLoadMessage("");
        }
      }, undefined, () => {
        remaining -= 1;
        if (remaining <= 0) setLoading(false);
      });
    }

    const clearDwell = () => {
      if (dwellTimerRef.current) window.clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    };

    const setPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
    };

    const pickAnimal = (event: PointerEvent): string | null => {
      setPointer(event);
      const hits = raycasterRef.current.intersectObjects(scene.children, true);
      for (const hit of hits) {
        let node: THREE.Object3D | null = hit.object;
        while (node) {
          const id = node.userData?.ariseAnimalId as string | undefined;
          if (id) return id;
          node = node.parent;
        }
      }
      return null;
    };

    const groundPoint = (event: PointerEvent) => {
      setPointer(event);
      const point = new THREE.Vector3();
      const plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
      return raycasterRef.current.ray.intersectPlane(plane, point) ? point : null;
    };

    const addFood = (type: FoodType, point: THREE.Vector3) => {
      const x = THREE.MathUtils.clamp(point.x, FIELD.minX + .7, FIELD.maxX - .7);
      const z = THREE.MathUtils.clamp(point.z, FIELD.minZ + .7, FIELD.maxZ - .7);
      if (blocked(x, z)) {
        setMessage("Place the food in an open part of the farm.");
        return;
      }
      const id = "food-" + (++foodCounterRef.current);
      const root = createFoodMesh(type);
      root.position.set(x, 0, z);
      root.userData.foodId = id;
      scene.add(root);
      foodsRef.current.set(id, { id, type, root, position: new THREE.Vector3(x,0,z), claimedBy: null });
      setFeedMode(null);
      setMessage(FOOD_LABEL[type] + " placed! Watch the animals notice it.");

      let best: AnimalRuntime | null = null;
      let bestDistance = Infinity;
      animalsRef.current.forEach(runtime => {
        if (!FOOD_COMPATIBILITY[runtime.def.kind].includes(type)) return;
        const d = runtime.root.position.distanceTo(root.position);
        if (d < bestDistance) { best = runtime; bestDistance = d; }
      });
      if (best && best.canRoam) {
        best.foodTarget = id;
        best.target.copy(root.position);
        best.pausedUntil = performance.now();
        foodsRef.current.get(id)!.claimedBy = best.def.id;
      } else if (best) {
        setMessage(best.def.name + " sees the food, but stays where it is until its real walk animation is ready.");
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (dragRef.current) {
        setPointer(event);
        const point = new THREE.Vector3();
        if (raycasterRef.current.ray.intersectPlane(dragRef.current.plane, point)) {
          const runtime = animalsRef.current.get(dragRef.current.id);
          if (runtime) {
            const nx = THREE.MathUtils.clamp(point.x, FIELD.minX + .5, FIELD.maxX - .5);
            const nz = THREE.MathUtils.clamp(point.z, FIELD.minZ + .5, FIELD.maxZ - .5);
            if (!blocked(nx, nz, runtime.def)) {
              runtime.root.position.set(nx, 0, nz);
              runtime.target.copy(runtime.root.position);
              runtime.pausedUntil = performance.now() + 2200;
            }
          }
        }
        return;
      }

      const id = pickAnimal(event);
      renderer.domElement.style.cursor = id ? "pointer" : feedMode ? "crosshair" : "grab";
      if (id === hoveredRef.current) return;
      clearDwell();
      hoveredRef.current = id;
      if (id) dwellTimerRef.current = window.setTimeout(() => speakAnimal(id), 1000);
    };

    const onPointerDown = (event: PointerEvent) => {
      const id = pickAnimal(event);
      if (!id && feedMode) {
        const p = groundPoint(event);
        if (p) addFood(feedMode, p);
        return;
      }
      if (!id) return;

      clearDwell();
      controls.enabled = false;
      const runtime = animalsRef.current.get(id);
      if (runtime) {
        runtime.pausedUntil = performance.now() + 3500;
        runtime.foodTarget = null;
        dragRef.current = { id, plane: new THREE.Plane(new THREE.Vector3(0,1,0), 0) };
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      const dragged = dragRef.current;
      dragRef.current = null;
      controls.enabled = true;
      if (!dragged) return;
      const runtime = animalsRef.current.get(dragged.id);
      if (runtime) {
        runtime.target.copy(randomTarget(runtime.def));
        runtime.pausedUntil = performance.now() + 1400;
      }
      speakAnimal(dragged.id);
    };

    const onPointerLeave = () => {
      clearDwell();
      hoveredRef.current = null;
      if (dragRef.current) {
        dragRef.current = null;
        controls.enabled = true;
      }
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);

    const clock = new THREE.Clock();

    const animate = () => {
      if (disposed) return;
      const dt = Math.min(0.04, clock.getDelta());
      const now = performance.now();

      animalsRef.current.forEach(runtime => {
        const root = runtime.root;
        let target = runtime.target;

        if (runtime.foodTarget) {
          const food = foodsRef.current.get(runtime.foodTarget);
          if (!food) runtime.foodTarget = null;
          else {
            target = food.position;
            runtime.target.copy(food.position);
          }
        }

        const distance = root.position.distanceTo(target);

        if (runtime.foodTarget && distance < 0.82) {
          const foodId = runtime.foodTarget;
          const food = foodsRef.current.get(foodId);
          runtime.moving = false;
          runtime.pausedUntil = Math.max(runtime.pausedUntil, now + 3600);
          runtime.phase += dt * 5;
          const child = root.children[0];
          if (child) child.rotation.x = Math.sin(runtime.phase) * 0.08 + 0.05;

          if (food && now + 3200 >= runtime.pausedUntil) {
            window.setTimeout(() => {
              const current = foodsRef.current.get(foodId);
              if (current) {
                scene.remove(current.root);
                foodsRef.current.delete(foodId);
              }
              if (runtime.foodTarget === foodId) {
                runtime.foodTarget = null;
                runtime.target.copy(randomTarget(runtime.def));
                runtime.pausedUntil = performance.now() + 900;
                const c = runtime.root.children[0];
                if (c) c.rotation.x = 0;
              }
            }, 3300);
          }
        } else if (now > runtime.pausedUntil && !dragRef.current) {
          if (distance < 0.35) {
            runtime.moving = false;
            runtime.pausedUntil = now + 1100 + Math.random() * 2600;
            if (!runtime.foodTarget) runtime.target.copy(randomTarget(runtime.def));
          } else {
            runtime.moving = runtime.canRoam;
          }
        }

        const shouldWalk = runtime.canRoam && runtime.moving && now > runtime.pausedUntil && dragRef.current?.id !== runtime.def.id;

        if (runtime.mixer) {
          runtime.mixer.update(dt);
          if (shouldWalk && runtime.walkAction && runtime.activeAction !== "walk") {
            runtime.idleAction?.fadeOut(0.18);
            runtime.walkAction.paused = false;
            runtime.walkAction.reset().fadeIn(0.18).play();
            runtime.activeAction = "walk";
          } else if (!shouldWalk && runtime.activeAction !== "idle") {
            runtime.walkAction?.fadeOut(0.18);
            if (runtime.idleAction) {
              runtime.idleAction.reset().fadeIn(0.18).play();
              runtime.activeAction = "idle";
            } else if (runtime.walkAction) {
              runtime.walkAction.paused = true;
              runtime.activeAction = null;
            }
          }
        }

        if (shouldWalk) {
          const direction = target.clone().sub(root.position);
          direction.y = 0;
          if (direction.lengthSq() > 0.001) {
            direction.normalize();
            const nextX = root.position.x + direction.x * runtime.def.speed * dt;
            const nextZ = root.position.z + direction.z * runtime.def.speed * dt;

            if (blocked(nextX, nextZ, runtime.def)) {
              runtime.target.copy(randomTarget(runtime.def));
              runtime.foodTarget = null;
            } else {
              // Simple flock separation so animals don't stack on top of each other.
              let separation = new THREE.Vector3();
              animalsRef.current.forEach(other => {
                if (other === runtime) return;
                const delta = root.position.clone().sub(other.root.position);
                delta.y = 0;
                const d = delta.length();
                if (d > 0 && d < 1.15) separation.add(delta.normalize().multiplyScalar((1.15 - d) * 0.55));
              });
              direction.add(separation).normalize();

              root.position.addScaledVector(direction, runtime.def.speed * dt);
              root.position.y = 0;
              const desired = Math.atan2(direction.x, direction.z);
              root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, desired, 0.1);

              if (!runtime.mixer && runtime.proceduralLegs.length >= 2) {
                runtime.phase += dt * (runtime.def.kind === "chicken" || runtime.def.kind === "duck" ? 13 : 8);
                runtime.proceduralLegs.forEach((leg, index) => {
                  leg.rotation.x = Math.sin(runtime.phase + (index % 2 ? Math.PI : 0)) * 0.2;
                });
              }
            }
          }
        } else {
          root.position.y = 0;
          if (!runtime.mixer) {
            runtime.proceduralLegs.forEach(leg => {
              leg.rotation.x = THREE.MathUtils.lerp(leg.rotation.x, 0, 0.12);
            });
          }
        }
      });

      controls.update();
      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      stopSpeaking();
      stopAnimalAudio();
      clearDwell();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      controls.dispose();
      renderer.dispose();
      animalsRef.current.clear();
      foodsRef.current.clear();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, [feedMode, speakAnimal, stopAnimalAudio]);

  const moveCamera = (forward: number, sideways: number) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const f = new THREE.Vector3();
    camera.getWorldDirection(f);
    f.y = 0;
    f.normalize();
    const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0,1,0)).normalize();
    const movement = f.multiplyScalar(forward * 5.5).add(r.multiplyScalar(sideways * 5.5));
    camera.position.add(movement);
    controls.target.add(movement);
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -52, 52);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -46, 46);
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -44, 44);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -35, 36);
    controls.update();
  };

  const foodButtons = useMemo(() => ([
    { type: "hay" as const, label: "Hay", icon: Wheat },
    { type: "grain" as const, label: "Grain", icon: Wheat },
    { type: "apple" as const, label: "Apples", icon: Apple },
    { type: "carrot" as const, label: "Carrots", icon: Apple },
  ]), []);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-slate-950 text-white">
      <div ref={mountRef} className="absolute inset-0" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent p-3 sm:p-5">
        <button type="button" onClick={() => navigate("/eye-gaze-games")} className="pointer-events-auto flex min-h-12 items-center gap-2 rounded-2xl border border-white/20 bg-black/55 px-4 font-black shadow-xl backdrop-blur focus:outline-none focus:ring-4 focus:ring-emerald-300">
          <ArrowLeft className="h-5 w-5" /> Games
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-black drop-shadow sm:text-2xl">A.R.I.S.E. Farm World</h1>
          <p className="hidden text-xs font-bold text-white/75 sm:block">{ANIMALS.length} animals · huge open farm · authentic sounds · feeding · free exploration</p>
        </div>
        <button type="button" onClick={() => setMuted(v => !v)} className="pointer-events-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-black/55 shadow-xl backdrop-blur focus:outline-none focus:ring-4 focus:ring-emerald-300" aria-label={muted ? "Turn sound on" : "Mute sound"}>
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </header>

      {loading && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-slate-950">
          <div className="w-[min(440px,86vw)] text-center">
            <div className="mx-auto mb-5 h-14 w-14 animate-spin rounded-full border-4 border-white/20 border-t-emerald-400" />
            <h2 className="text-2xl font-black">Opening Expanded Farm</h2>
            <p className="mt-2 font-bold text-white/65">{loadMessage}</p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute left-1/2 top-20 z-20 max-w-[82vw] -translate-x-1/2 rounded-2xl bg-black/60 px-4 py-2 text-center text-sm font-black shadow-xl backdrop-blur sm:text-base" aria-live="polite">
        {feedMode ? "Tap an open spot to place " + FOOD_LABEL[feedMode].toLowerCase() + "." : message}
      </div>

      <section className="absolute bottom-4 left-4 z-30">
        <div className="mb-2 rounded-2xl border border-white/20 bg-black/60 p-2 shadow-xl backdrop-blur">
          <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-widest text-white/60">Feed animals</p>
          <div className="grid grid-cols-2 gap-2">
            {foodButtons.map(({ type, label, icon: Icon }) => (
              <button key={type} type="button" onClick={() => { setFeedMode(type); setMessage("Place " + label.toLowerCase() + " anywhere open."); }} className={"flex min-h-12 items-center gap-2 rounded-xl px-3 text-xs font-black transition " + (feedMode === type ? "bg-amber-300 text-slate-950" : "bg-white/10 text-white hover:bg-white/15")}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid w-fit grid-cols-3 gap-2">
          <div />
          <button type="button" onClick={() => moveCamera(1,0)} className="grid h-14 w-14 place-items-center rounded-2xl border border-white/25 bg-black/60 shadow-xl backdrop-blur"><ArrowUp className="h-7 w-7"/></button>
          <div />
          <button type="button" onClick={() => moveCamera(0,-1)} className="grid h-14 w-14 place-items-center rounded-2xl border border-white/25 bg-black/60 shadow-xl backdrop-blur"><ArrowLeft className="h-7 w-7"/></button>
          <button type="button" onClick={() => moveCamera(-1,0)} className="grid h-14 w-14 place-items-center rounded-2xl border border-white/25 bg-black/60 shadow-xl backdrop-blur"><ArrowDown className="h-7 w-7"/></button>
          <button type="button" onClick={() => moveCamera(0,1)} className="grid h-14 w-14 place-items-center rounded-2xl border border-white/25 bg-black/60 shadow-xl backdrop-blur"><ArrowRight className="h-7 w-7"/></button>
        </div>
      </section>

      <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 hidden -translate-x-1/2 gap-2 lg:flex">
        <span className="inline-flex items-center gap-2 rounded-xl bg-black/55 px-3 py-2 text-xs font-black backdrop-blur"><Eye className="h-4 w-4"/> Look & hold</span>
        <span className="inline-flex items-center gap-2 rounded-xl bg-black/55 px-3 py-2 text-xs font-black backdrop-blur"><Hand className="h-4 w-4"/> Tap animal</span>
        <span className="inline-flex items-center gap-2 rounded-xl bg-black/55 px-3 py-2 text-xs font-black backdrop-blur"><Move className="h-4 w-4"/> Drag animal</span>
      </div>

      {selectedAnimal && (
        <aside className="absolute bottom-4 right-4 z-30 w-[min(350px,calc(100%-2rem))] rounded-3xl border border-white/20 bg-black/72 p-4 shadow-2xl backdrop-blur-xl">
          <h2 className="text-xl font-black">{selectedAnimal.name}</h2>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-white/75">{selectedAnimal.fact}</p>
          <button type="button" onClick={() => speakAnimal(selectedAnimal.id, true)} className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-slate-950 shadow focus:outline-none focus:ring-4 focus:ring-emerald-200">
            <Volume2 className="h-4 w-4"/> Hear & learn
          </button>
        </aside>
      )}

      <div className="pointer-events-none absolute bottom-1 right-2 z-10 text-[9px] font-semibold text-white/40">
        3D assets + authentic animal recordings
      </div>
    </main>
  );
}
