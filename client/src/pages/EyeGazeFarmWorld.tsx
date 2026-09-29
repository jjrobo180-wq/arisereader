import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eye, Hand, Move, Volume2, VolumeX } from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";

type AnimalId = "cow" | "horse" | "pig" | "sheep" | "goat" | "chicken" | "duck" | "dog";

type AnimalDef = {
  id: AnimalId;
  name: string;
  sound: string;
  fact: string;
  model: string;
  x: number;
  z: number;
  height: number;
  area: { minX: number; maxX: number; minZ: number; maxZ: number };
};

type AnimalRuntime = {
  def: AnimalDef;
  root: THREE.Group;
  target: THREE.Vector3;
  moving: boolean;
  pausedUntil: number;
  phase: number;
};

const FARM_SCENE = "https://cdn.3dassets.dev/assets/29225/v1/model.glb";

const ANIMALS: AnimalDef[] = [
  {
    id: "cow", name: "Cow", sound: "Moooo!",
    fact: "Cows are social animals. They graze on grass and usually stay close to their herd.",
    model: "https://cdn.3dassets.dev/assets/29184/v1/model.glb",
    x: -5.5, z: 1.8, height: 1.65, area: { minX: -9, maxX: 4, minZ: -3.8, maxZ: 5.2 },
  },
  {
    id: "horse", name: "Horse", sound: "Neigh!",
    fact: "Horses can walk, trot, and gallop. They use their ears and body language to communicate.",
    model: "https://cdn.3dassets.dev/assets/29169/v1/model.glb",
    x: 2.5, z: -2.8, height: 2.0, area: { minX: -6, maxX: 8, minZ: -5.5, maxZ: 4.5 },
  },
  {
    id: "pig", name: "Pig", sound: "Oink oink!",
    fact: "Pigs are intelligent and curious. They use their noses to explore the ground.",
    model: "https://cdn.3dassets.dev/assets/29194/v1/model.glb",
    x: 5.8, z: 2.6, height: 1.05, area: { minX: 2.5, maxX: 9.5, minZ: -1, maxZ: 5.5 },
  },
  {
    id: "sheep", name: "Sheep", sound: "Baa baa!",
    fact: "Sheep live in flocks. Their wool helps keep them warm.",
    model: "https://cdn.3dassets.dev/assets/29189/v1/model.glb",
    x: -1.4, z: 4.6, height: 1.1, area: { minX: -8, maxX: 4, minZ: 0.5, maxZ: 6.2 },
  },
  {
    id: "goat", name: "Goat", sound: "Maa maa!",
    fact: "Goats are curious explorers and very good climbers.",
    model: "https://cdn.3dassets.dev/assets/29192/v1/model.glb",
    x: 7.2, z: -0.4, height: 1.08, area: { minX: 3.2, maxX: 10.2, minZ: -4.2, maxZ: 4.5 },
  },
  {
    id: "chicken", name: "Chicken", sound: "Cluck cluck!",
    fact: "Chickens scratch and peck at the ground to find seeds and insects.",
    model: "https://cdn.3dassets.dev/assets/29197/v1/model.glb",
    x: 7.7, z: 5.1, height: 0.62, area: { minX: 4.5, maxX: 10, minZ: 2.2, maxZ: 6.1 },
  },
  {
    id: "duck", name: "Duck", sound: "Quack quack!",
    fact: "Ducks have waterproof feathers and webbed feet that help them swim.",
    model: "https://cdn.3dassets.dev/assets/29201/v1/model.glb",
    x: 9.1, z: 3.8, height: 0.5, area: { minX: 6.5, maxX: 10.5, minZ: 1.2, maxZ: 5.8 },
  },
  {
    id: "dog", name: "Farm Dog", sound: "Woof woof!",
    fact: "Working farm dogs can help people guide and watch livestock.",
    model: "https://cdn.3dassets.dev/assets/29204/v1/model.glb",
    x: 0.6, z: -0.2, height: 0.78, area: { minX: -5, maxX: 7, minZ: -4.5, maxZ: 5.5 },
  },
];

const byId = Object.fromEntries(ANIMALS.map(a => [a.id, a])) as Record<AnimalId, AnimalDef>;
const animalTokens = ["cow", "horse", "pony", "foal", "bull", "calf", "sheep", "lamb", "goat", "pig", "donkey", "alpaca", "hen", "cockerel", "chick", "duck", "goose", "turkey", "collie", "cat", "oxen"];

function randomTarget(def: AnimalDef) {
  const { minX, maxX, minZ, maxZ } = def.area;
  return new THREE.Vector3(
    minX + Math.random() * (maxX - minX),
    0,
    minZ + Math.random() * (maxZ - minZ),
  );
}

function normalizeModel(root: THREE.Group, wantedHeight: number) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = wantedHeight / Math.max(0.01, size.y);
  root.scale.setScalar(scale);

  const scaled = new THREE.Box3().setFromObject(root);
  root.position.y -= scaled.min.y;
}

export default function EyeGazeFarmWorld() {
  const [, navigate] = useLocation();
  const mountRef = useRef<HTMLDivElement>(null);
  const animalsRef = useRef<Map<AnimalId, AnimalRuntime>>(new Map());
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const hoveredRef = useRef<AnimalId | null>(null);
  const dwellTimerRef = useRef<number | null>(null);
  const dragRef = useRef<{ id: AnimalId; plane: THREE.Plane } | null>(null);
  const animationRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadMessage, setLoadMessage] = useState("Building your 3D farm…");
  const [muted, setMuted] = useState(false);
  const [selected, setSelected] = useState<AnimalId | null>(null);
  const [message, setMessage] = useState("Move around the farm. Look at or tap an animal to meet it.");

  const speakAnimal = useCallback((id: AnimalId, withFact = false) => {
    const animal = byId[id];
    setSelected(id);
    setMessage(withFact ? animal.fact : animal.name + " says " + animal.sound);
    if (!muted) {
      const text = withFact
        ? animal.name + ". " + animal.sound + " " + animal.fact
        : animal.name + ". " + animal.sound;
      void speakCharacterAI(text, { calmMode: true });
    }
  }, [muted]);

  useEffect(() => {
    if (muted) stopSpeaking();
  }, [muted]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xaed9f3);
    scene.fog = new THREE.FogExp2(0xc8e5f2, 0.017);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 140);
    camera.position.set(18, 11, 21);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.className = "absolute inset-0 h-full w-full";
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.1, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 5;
    controls.maxDistance = 31;
    controls.maxPolarAngle = Math.PI * 0.46;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.enablePan = true;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xdff3ff, 0x5b6b3a, 2.4));
    const sun = new THREE.DirectionalLight(0xfff1cf, 4.2);
    sun.position.set(-12, 20, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -24;
    sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 24;
    sun.shadow.camera.bottom = -24;
    scene.add(sun);

    const loader = new GLTFLoader();

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(34, 96),
      new THREE.MeshStandardMaterial({ color: 0x6f9f45, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.035;
    ground.receiveShadow = true;
    scene.add(ground);

    const hideStaticAnimals = (root: THREE.Object3D) => {
      root.traverse(obj => {
        const n = obj.name.toLowerCase();
        if (animalTokens.some(token => n.includes(token))) obj.visible = false;
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
    };

    loader.load(
      FARM_SCENE,
      gltf => {
        if (disposed) return;
        const farm = gltf.scene;
        hideStaticAnimals(farm);
        farm.position.set(0, 0, 0);
        farm.traverse(obj => {
          if ((obj as THREE.Mesh).isMesh) {
            (obj as THREE.Mesh).castShadow = true;
            (obj as THREE.Mesh).receiveShadow = true;
          }
        });
        scene.add(farm);
      },
      undefined,
      () => setLoadMessage("Farm loaded. Bringing in the animals…")
    );

    let remaining = ANIMALS.length;
    for (const def of ANIMALS) {
      loader.load(
        def.model,
        gltf => {
          if (disposed) return;
          const root = gltf.scene;
          root.name = "ARISE_ANIMAL_" + def.id;
          normalizeModel(root, def.height);
          root.position.set(def.x, 0, def.z);
          root.rotation.y = Math.random() * Math.PI * 2;

          root.traverse(obj => {
            obj.userData.ariseAnimalId = def.id;
            if ((obj as THREE.Mesh).isMesh) {
              const mesh = obj as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });

          scene.add(root);
          animalsRef.current.set(def.id, {
            def,
            root,
            target: randomTarget(def),
            moving: true,
            pausedUntil: performance.now() + Math.random() * 2500,
            phase: Math.random() * Math.PI * 2,
          });

          remaining -= 1;
          if (remaining <= 0) {
            setLoading(false);
            setLoadMessage("");
          } else {
            setLoadMessage("Bringing in " + remaining + " more animal" + (remaining === 1 ? "" : "s") + "…");
          }
        },
        undefined,
        () => {
          remaining -= 1;
          if (remaining <= 0) setLoading(false);
        }
      );
    }

    const pickAnimal = (clientX: number, clientY: number): AnimalId | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      const intersections = raycasterRef.current.intersectObjects(scene.children, true);
      for (const hit of intersections) {
        let current: THREE.Object3D | null = hit.object;
        while (current) {
          const id = current.userData?.ariseAnimalId as AnimalId | undefined;
          if (id) return id;
          current = current.parent;
        }
      }
      return null;
    };

    const clearDwell = () => {
      if (dwellTimerRef.current) window.clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (dragRef.current) {
        raycasterRef.current.setFromCamera(pointerRef.current, camera);
        const point = new THREE.Vector3();
        if (raycasterRef.current.ray.intersectPlane(dragRef.current.plane, point)) {
          const runtime = animalsRef.current.get(dragRef.current.id);
          if (runtime) {
            runtime.root.position.x = THREE.MathUtils.clamp(point.x, -10.5, 10.5);
            runtime.root.position.z = THREE.MathUtils.clamp(point.z, -6.2, 6.2);
            runtime.target.copy(runtime.root.position);
            runtime.pausedUntil = performance.now() + 2500;
          }
        }
        return;
      }

      const id = pickAnimal(event.clientX, event.clientY);
      renderer.domElement.style.cursor = id ? "pointer" : "grab";
      if (id === hoveredRef.current) return;

      clearDwell();
      hoveredRef.current = id;
      if (id) {
        dwellTimerRef.current = window.setTimeout(() => speakAnimal(id), 1050);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      pointerRef.current.x = ((event.clientX - renderer.domElement.getBoundingClientRect().left) / renderer.domElement.clientWidth) * 2 - 1;
      pointerRef.current.y = -((event.clientY - renderer.domElement.getBoundingClientRect().top) / renderer.domElement.clientHeight) * 2 + 1;
      const id = pickAnimal(event.clientX, event.clientY);
      if (!id) return;

      clearDwell();
      controls.enabled = false;
      const runtime = animalsRef.current.get(id);
      if (runtime) {
        runtime.pausedUntil = performance.now() + 4000;
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        dragRef.current = { id, plane };
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      const dragged = dragRef.current;
      dragRef.current = null;
      controls.enabled = true;
      if (!dragged) return;

      const id = pickAnimal(event.clientX, event.clientY) || dragged.id;
      const runtime = animalsRef.current.get(dragged.id);
      if (runtime) {
        runtime.target.copy(randomTarget(runtime.def));
        runtime.pausedUntil = performance.now() + 1800;
      }
      speakAnimal(id);
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
        const distance = root.position.distanceTo(runtime.target);

        if (now > runtime.pausedUntil && !dragRef.current) {
          if (distance < 0.35) {
            runtime.moving = false;
            runtime.pausedUntil = now + 1200 + Math.random() * 3000;
            runtime.target.copy(randomTarget(runtime.def));
          } else {
            runtime.moving = true;
          }
        }

        if (runtime.moving && now > runtime.pausedUntil && dragRef.current?.id !== runtime.def.id) {
          const direction = runtime.target.clone().sub(root.position);
          direction.y = 0;
          const len = direction.length();
          if (len > 0.01) {
            direction.normalize();
            const speed = runtime.def.id === "chicken" || runtime.def.id === "duck" ? 0.62 : 0.48;
            root.position.addScaledVector(direction, speed * dt);
            const desired = Math.atan2(direction.x, direction.z);
            root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, desired, 0.08);
            runtime.phase += dt * (runtime.def.id === "horse" ? 10 : 7);
            root.position.y = Math.abs(Math.sin(runtime.phase)) * (runtime.def.id === "chicken" || runtime.def.id === "duck" ? 0.018 : 0.025);
            root.rotation.z = Math.sin(runtime.phase * 0.5) * 0.012;
          }
        } else {
          root.position.y = THREE.MathUtils.lerp(root.position.y, 0, 0.08);
          root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, 0, 0.08);
        }
      });

      controls.update();
      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      if (!mount || !rendererRef.current || !cameraRef.current) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      stopSpeaking();
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
      mount.removeChild(renderer.domElement);
    };
  }, [speakAnimal]);

  const moveCamera = (forward: number, sideways: number) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const forwardVec = new THREE.Vector3();
    camera.getWorldDirection(forwardVec);
    forwardVec.y = 0;
    forwardVec.normalize();

    const rightVec = new THREE.Vector3().crossVectors(forwardVec, new THREE.Vector3(0, 1, 0)).normalize();
    const movement = forwardVec.multiplyScalar(forward * 2.2).add(rightVec.multiplyScalar(sideways * 2.2));

    camera.position.add(movement);
    controls.target.add(movement);
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -18, 18);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -18, 18);
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -11, 11);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -8, 8);
    controls.update();
  };

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-slate-950 text-white">
      <div ref={mountRef} className="absolute inset-0" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent p-3 sm:p-5">
        <button
          type="button"
          onClick={() => navigate("/eye-gaze-games")}
          className="pointer-events-auto flex min-h-12 items-center gap-2 rounded-2xl border border-white/20 bg-black/55 px-4 font-black text-white shadow-xl backdrop-blur focus:outline-none focus:ring-4 focus:ring-emerald-300"
        >
          <ArrowLeft className="h-5 w-5" /> Games
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-black drop-shadow sm:text-2xl">A.R.I.S.E. Farm World</h1>
          <p className="hidden text-xs font-bold text-white/75 sm:block">A real 3D farm · move around · meet the animals</p>
        </div>
        <button
          type="button"
          onClick={() => setMuted(v => !v)}
          className="pointer-events-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-black/55 shadow-xl backdrop-blur focus:outline-none focus:ring-4 focus:ring-emerald-300"
          aria-label={muted ? "Turn sound on" : "Mute sound"}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </header>

      {loading && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-slate-950">
          <div className="w-[min(420px,85vw)] text-center">
            <div className="mx-auto mb-5 h-14 w-14 animate-spin rounded-full border-4 border-white/20 border-t-emerald-400" />
            <h2 className="text-2xl font-black">Opening Farm World</h2>
            <p className="mt-2 font-bold text-white/65">{loadMessage}</p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute left-1/2 top-20 z-20 max-w-[80vw] -translate-x-1/2 rounded-2xl bg-black/60 px-4 py-2 text-center text-sm font-black shadow-xl backdrop-blur sm:text-base" aria-live="polite">
        {message}
      </div>

      <div className="absolute bottom-4 left-4 z-30 grid grid-cols-3 gap-2">
        <div />
        <button type="button" onClick={() => moveCamera(1, 0)} className="grid h-14 w-14 place-items-center rounded-2xl border border-white/25 bg-black/60 shadow-xl backdrop-blur focus:outline-none focus:ring-4 focus:ring-emerald-300" aria-label="Move forward">
          <ArrowUp className="h-7 w-7" />
        </button>
        <div />
        <button type="button" onClick={() => moveCamera(0, -1)} className="grid h-14 w-14 place-items-center rounded-2xl border border-white/25 bg-black/60 shadow-xl backdrop-blur focus:outline-none focus:ring-4 focus:ring-emerald-300" aria-label="Move left">
          <ArrowLeft className="h-7 w-7" />
        </button>
        <button type="button" onClick={() => moveCamera(-1, 0)} className="grid h-14 w-14 place-items-center rounded-2xl border border-white/25 bg-black/60 shadow-xl backdrop-blur focus:outline-none focus:ring-4 focus:ring-emerald-300" aria-label="Move backward">
          <ArrowDown className="h-7 w-7" />
        </button>
        <button type="button" onClick={() => moveCamera(0, 1)} className="grid h-14 w-14 place-items-center rounded-2xl border border-white/25 bg-black/60 shadow-xl backdrop-blur focus:outline-none focus:ring-4 focus:ring-emerald-300" aria-label="Move right">
          <ArrowRight className="h-7 w-7" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 hidden -translate-x-1/2 gap-2 md:flex">
        <span className="inline-flex items-center gap-2 rounded-xl bg-black/55 px-3 py-2 text-xs font-black backdrop-blur"><Eye className="h-4 w-4" /> Look & hold</span>
        <span className="inline-flex items-center gap-2 rounded-xl bg-black/55 px-3 py-2 text-xs font-black backdrop-blur"><Hand className="h-4 w-4" /> Tap animal</span>
        <span className="inline-flex items-center gap-2 rounded-xl bg-black/55 px-3 py-2 text-xs font-black backdrop-blur"><Move className="h-4 w-4" /> Drag animal</span>
      </div>

      {selected && (
        <aside className="absolute bottom-4 right-4 z-30 w-[min(350px,calc(100%-2rem))] rounded-3xl border border-white/20 bg-black/70 p-4 shadow-2xl backdrop-blur-xl">
          <h2 className="text-xl font-black">{byId[selected].name}</h2>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-white/75">{byId[selected].fact}</p>
          <button
            type="button"
            onClick={() => speakAnimal(selected, true)}
            className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-slate-950 shadow focus:outline-none focus:ring-4 focus:ring-emerald-200"
          >
            <Volume2 className="h-4 w-4" /> Hear & learn
          </button>
        </aside>
      )}

      <div className="pointer-events-none absolute bottom-1 right-2 z-10 text-[9px] font-semibold text-white/40">
        3D farm & animals: CC0 assets
      </div>
    </main>
  );
}
