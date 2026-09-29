import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Eye, Hand, Info, Move, Volume2, VolumeX } from "lucide-react";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";

type AnimalKind = "cow" | "horse" | "pig" | "sheep" | "duck" | "chicken" | "goat" | "dog";
type Behavior = "walk" | "graze" | "rest" | "peck" | "swim";

type AnimalInfo = {
  id: AnimalKind;
  name: string;
  sound: string;
  fact: string;
  image: string;
  x: number;
  y: number;
  width: number;
  zone: "field" | "pond" | "yard";
};

type Pos = { x: number; y: number; facing: 1 | -1 };
type BehaviorMap = Record<AnimalKind, Behavior>;

const COMMONS = (file: string) =>
  "https://commons.wikimedia.org/wiki/Special:Redirect/file/" + encodeURIComponent(file);

const FARM_BACKGROUND = COMMONS("Farm barn scenic landscape.jpg");

const ANIMALS: AnimalInfo[] = [
  {
    id: "cow",
    name: "Cow",
    sound: "Moooo!",
    fact: "Cows are social animals. They graze on grass and usually stay close to their herd.",
    image: COMMONS("Cow.png"),
    x: 23, y: 62, width: 205, zone: "field",
  },
  {
    id: "horse",
    name: "Horse",
    sound: "Neigh!",
    fact: "Horses can walk, trot, and gallop. They communicate with their ears, faces, and voices.",
    image: COMMONS("HorseSideView.png"),
    x: 53, y: 57, width: 225, zone: "field",
  },
  {
    id: "pig",
    name: "Pig",
    sound: "Oink oink!",
    fact: "Pigs are curious and intelligent. They use their strong noses to investigate the ground.",
    image: COMMONS("Pig (NIH BioArt 406 - 633283).png"),
    x: 38, y: 76, width: 165, zone: "yard",
  },
  {
    id: "sheep",
    name: "Sheep",
    sound: "Baa baa!",
    fact: "Sheep live in flocks. Their wool helps keep them warm.",
    image: COMMONS("Sheep (NIH BioArt 491).png"),
    x: 69, y: 64, width: 155, zone: "field",
  },
  {
    id: "duck",
    name: "Duck",
    sound: "Quack quack!",
    fact: "Ducks have waterproof feathers and webbed feet that help them swim.",
    image: COMMONS("Male mallard duck standing.png"),
    x: 83, y: 79, width: 115, zone: "pond",
  },
  {
    id: "chicken",
    name: "Chicken",
    sound: "Cluck cluck!",
    fact: "Chickens scratch and peck at the ground to look for seeds, plants, and insects.",
    image: COMMONS("Leghorn Chicken (NIH BioArt 707 - 788949).png"),
    x: 14, y: 77, width: 105, zone: "yard",
  },
  {
    id: "goat",
    name: "Goat",
    sound: "Maa maa!",
    fact: "Goats are curious explorers. They are excellent climbers and like to investigate new places.",
    image: COMMONS("Goat.png"),
    x: 64, y: 77, width: 130, zone: "yard",
  },
  {
    id: "dog",
    name: "Farm Dog",
    sound: "Woof woof!",
    fact: "Farm dogs can help people watch livestock and move animals from one place to another.",
    image: COMMONS("Domestic dog (NIH BioArt 594).png"),
    x: 47, y: 67, width: 125, zone: "yard",
  },
];

const INITIAL_BEHAVIORS: BehaviorMap = {
  cow: "graze",
  horse: "walk",
  pig: "rest",
  sheep: "graze",
  duck: "swim",
  chicken: "peck",
  goat: "walk",
  dog: "walk",
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const rnd = (min: number, max: number) => min + Math.random() * (max - min);

function zoneTarget(animal: AnimalInfo) {
  if (animal.zone === "pond") {
    return { x: rnd(76, 91), y: rnd(72, 84) };
  }
  if (animal.zone === "field") {
    return { x: rnd(17, 79), y: rnd(49, 72) };
  }
  return { x: rnd(10, 73), y: rnd(65, 84) };
}

function idleBehavior(id: AnimalKind): Behavior {
  if (id === "duck") return "swim";
  if (id === "chicken") return "peck";
  if (id === "cow" || id === "sheep") return Math.random() > 0.25 ? "graze" : "rest";
  if (id === "pig") return Math.random() > 0.5 ? "graze" : "rest";
  return Math.random() > 0.4 ? "rest" : "graze";
}

export default function EyeGazeFarmWorld() {
  const [, navigate] = useLocation();
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: AnimalKind; dx: number; dy: number; moved: boolean } | null>(null);
  const dwellRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const resumeRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const behaviorTimers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  const [muted, setMuted] = useState(false);
  const [selected, setSelected] = useState<AnimalKind | null>(null);
  const [message, setMessage] = useState("Explore the farm. Look at, tap, or move any animal.");
  const [positions, setPositions] = useState<Record<AnimalKind, Pos>>(
    () => Object.fromEntries(ANIMALS.map(a => [a.id, { x: a.x, y: a.y, facing: 1 }])) as Record<AnimalKind, Pos>
  );
  const [behaviors, setBehaviors] = useState<BehaviorMap>(INITIAL_BEHAVIORS);
  const [paused, setPaused] = useState<Record<AnimalKind, boolean>>(
    () => Object.fromEntries(ANIMALS.map(a => [a.id, false])) as Record<AnimalKind, boolean>
  );

  const animalMap = useMemo(
    () => Object.fromEntries(ANIMALS.map(a => [a.id, a])) as Record<AnimalKind, AnimalInfo>,
    []
  );

  const sayAnimal = useCallback((id: AnimalKind, includeFact = false) => {
    const animal = animalMap[id];
    setSelected(id);
    setMessage(includeFact ? animal.fact : animal.name + " says " + animal.sound);
    if (!muted) {
      void speakCharacterAI(
        includeFact ? animal.name + ". " + animal.sound + " " + animal.fact : animal.name + ". " + animal.sound,
        { calmMode: true }
      );
    }
  }, [animalMap, muted]);

  useEffect(() => {
    if (muted) stopSpeaking();
  }, [muted]);

  useEffect(() => {
    const moveAnimals = () => {
      setPositions(prev => {
        const next = { ...prev };
        for (const animal of ANIMALS) {
          if (paused[animal.id]) continue;
          const from = prev[animal.id];
          const target = zoneTarget(animal);
          next[animal.id] = {
            x: target.x,
            y: target.y,
            facing: target.x < from.x ? -1 : 1,
          };
          setBehaviors(current => ({ ...current, [animal.id]: "walk" }));
          if (behaviorTimers.current[animal.id]) clearTimeout(behaviorTimers.current[animal.id]!);
          behaviorTimers.current[animal.id] = setTimeout(() => {
            setBehaviors(current => ({ ...current, [animal.id]: idleBehavior(animal.id) }));
          }, 3700 + Math.random() * 800);
        }
        return next;
      });
    };

    const first = setTimeout(moveAnimals, 800);
    const timer = setInterval(moveAnimals, 4700);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [paused]);

  useEffect(() => () => {
    stopSpeaking();
    Object.values(dwellRef.current).forEach(t => t && clearTimeout(t));
    Object.values(resumeRef.current).forEach(t => t && clearTimeout(t));
    Object.values(behaviorTimers.current).forEach(t => t && clearTimeout(t));
  }, []);

  const startDwell = (id: AnimalKind) => {
    if (dragRef.current) return;
    if (dwellRef.current[id]) clearTimeout(dwellRef.current[id]!);
    dwellRef.current[id] = setTimeout(() => sayAnimal(id), 1000);
  };

  const cancelDwell = (id: AnimalKind) => {
    if (dwellRef.current[id]) clearTimeout(dwellRef.current[id]!);
    dwellRef.current[id] = null;
  };

  const onPointerDown = (id: AnimalKind, event: React.PointerEvent<HTMLButtonElement>) => {
    cancelDwell(id);
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const current = positions[id];
    const px = stage.left + (current.x / 100) * stage.width;
    const py = stage.top + (current.y / 100) * stage.height;

    dragRef.current = {
      id,
      dx: event.clientX - px,
      dy: event.clientY - py,
      moved: false,
    };
    setPaused(prev => ({ ...prev, [id]: true }));
    setBehaviors(prev => ({ ...prev, [id]: "rest" }));
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const stage = stageRef.current?.getBoundingClientRect();
    if (!drag || !stage) return;

    const x = clamp(((event.clientX - drag.dx - stage.left) / stage.width) * 100, 5, 94);
    const y = clamp(((event.clientY - drag.dy - stage.top) / stage.height) * 100, 42, 86);
    const old = positions[drag.id];

    if (Math.abs(x - old.x) > 0.7 || Math.abs(y - old.y) > 0.7) drag.moved = true;
    setPositions(prev => ({
      ...prev,
      [drag.id]: { x, y, facing: x < prev[drag.id].x ? -1 : 1 },
    }));
  };

  const onPointerUp = (id: AnimalKind) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    if (!drag.moved) {
      sayAnimal(id);
    } else {
      setMessage("You moved the " + animalMap[id].name + ". It will keep exploring from here.");
    }

    if (resumeRef.current[id]) clearTimeout(resumeRef.current[id]!);
    resumeRef.current[id] = setTimeout(() => {
      setPaused(prev => ({ ...prev, [id]: false }));
      setBehaviors(prev => ({ ...prev, [id]: idleBehavior(id) }));
    }, 2200);
  };

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#1d2d1e] text-slate-950">
      <style>{`
        @keyframes farm-walk {
          0%,100% { margin-top: 0; }
          25% { margin-top: -5px; }
          50% { margin-top: 0; }
          75% { margin-top: -3px; }
        }
        @keyframes farm-graze {
          0%,100% { rotate: 0deg; translate: 0 0; }
          45%,65% { rotate: 2deg; translate: 0 7px; }
        }
        @keyframes farm-peck {
          0%,100% { rotate: 0deg; translate: 0 0; }
          40% { rotate: 5deg; translate: 0 8px; }
          55% { rotate: -2deg; translate: 0 2px; }
        }
        @keyframes farm-swim {
          0%,100% { translate: 0 0; }
          50% { translate: 0 -4px; }
        }
        .farm-animal.walk img { animation: farm-walk .58s infinite ease-in-out; }
        .farm-animal.graze img { animation: farm-graze 2.6s infinite ease-in-out; transform-origin: 65% 90%; }
        .farm-animal.peck img { animation: farm-peck 1.25s infinite ease-in-out; transform-origin: 65% 90%; }
        .farm-animal.swim img { animation: farm-swim 1.8s infinite ease-in-out; }
      `}</style>

      <header className="relative z-50 flex min-h-16 items-center gap-2 border-b border-white/10 bg-[#172019]/95 px-3 py-2 text-white shadow-xl backdrop-blur sm:px-5">
        <button
          type="button"
          onClick={() => navigate("/eye-gaze-games")}
          className="flex h-11 items-center gap-2 rounded-xl bg-white/10 px-4 font-black ring-1 ring-white/15 hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-emerald-300"
        >
          <ArrowLeft className="h-5 w-5" /> Games
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-black sm:text-2xl">A.R.I.S.E. Farm World</h1>
          <p className="hidden text-xs font-bold text-white/65 sm:block">Free-play animal world · gaze · tap · move · listen</p>
        </div>

        <button
          type="button"
          onClick={() => setMuted(v => !v)}
          aria-label={muted ? "Turn sound on" : "Mute sound"}
          className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15 focus:outline-none focus:ring-4 focus:ring-emerald-300"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </header>

      <section
        ref={stageRef}
        className="relative h-[calc(100dvh-4rem)] min-h-[620px] w-full overflow-hidden touch-none select-none"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(5,20,10,.05), rgba(8,28,12,.18)), url("${FARM_BACKGROUND}")`,
          backgroundSize: "cover",
          backgroundPosition: "center 42%",
        }}
        aria-label="Interactive farm"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-sky-900/5 pointer-events-none" />

        <div className="pointer-events-none absolute bottom-0 right-0 h-[29%] w-[29%] rounded-tl-[65%] bg-[radial-gradient(circle_at_55%_65%,rgba(77,185,221,.94),rgba(30,120,158,.9)_55%,rgba(17,76,110,.92)_100%)] shadow-[inset_0_14px_35px_rgba(255,255,255,.22)]" />
        <div className="pointer-events-none absolute bottom-[21%] right-[3%] rounded-full bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700 shadow">Duck pond</div>

        <div className="pointer-events-none absolute left-1/2 top-3 z-40 max-w-[80%] -translate-x-1/2 rounded-2xl bg-black/66 px-4 py-2 text-center text-sm font-black text-white shadow-xl backdrop-blur-md sm:text-base" aria-live="polite">
          {message}
        </div>

        {ANIMALS.map(animal => {
          const pos = positions[animal.id];
          const selectedNow = selected === animal.id;
          const behavior = behaviors[animal.id];

          return (
            <button
              key={animal.id}
              type="button"
              aria-label={animal.name + ". Look and hold or tap to hear it. Drag to move it."}
              onMouseEnter={() => startDwell(animal.id)}
              onMouseLeave={() => cancelDwell(animal.id)}
              onFocus={() => startDwell(animal.id)}
              onBlur={() => cancelDwell(animal.id)}
              onPointerDown={e => onPointerDown(animal.id, e)}
              onPointerMove={onPointerMove}
              onPointerUp={() => onPointerUp(animal.id)}
              onPointerCancel={() => onPointerUp(animal.id)}
              className={`farm-animal ${behavior} absolute z-20 cursor-grab bg-transparent p-0 outline-none transition-[left,top,filter] duration-[3900ms] ease-in-out active:cursor-grabbing focus-visible:ring-4 focus-visible:ring-amber-300 ${selectedNow ? "drop-shadow-[0_0_18px_rgba(253,224,71,.95)]" : ""}`}
              style={{
                left: pos.x + "%",
                top: pos.y + "%",
                width: animal.width,
                maxWidth: "24vw",
                transform: `translate(-50%,-72%) scaleX(${pos.facing})`,
                touchAction: "none",
              }}
            >
              <img
                src={animal.image}
                alt=""
                draggable={false}
                className="pointer-events-none block h-auto w-full object-contain drop-shadow-[0_16px_12px_rgba(0,0,0,.32)]"
              />
              <span
                className={`absolute left-1/2 top-full mt-[-8px] whitespace-nowrap rounded-full px-3 py-1 text-xs font-black shadow-lg ${selectedNow ? "bg-amber-300 text-slate-950" : "bg-white/92 text-slate-900"}`}
                style={{ transform: `translateX(-50%) scaleX(${pos.facing})` }}
              >
                {animal.name}
              </span>
            </button>
          );
        })}

        <div className="absolute bottom-3 left-3 z-40 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-black/65 px-3 py-2 text-xs font-black text-white shadow backdrop-blur">
            <Eye className="h-4 w-4" /> Look & hold
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-black/65 px-3 py-2 text-xs font-black text-white shadow backdrop-blur">
            <Hand className="h-4 w-4" /> Tap
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-black/65 px-3 py-2 text-xs font-black text-white shadow backdrop-blur">
            <Move className="h-4 w-4" /> Drag
          </div>
        </div>

        {selected && (
          <aside className="absolute bottom-5 right-4 z-50 w-[min(360px,calc(100%-2rem))] rounded-3xl border border-white/55 bg-[#fffdf7]/96 p-4 shadow-2xl backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-100">
                <Info className="h-6 w-6 text-emerald-800" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black">{animalMap[selected].name}</h2>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-600">{animalMap[selected].fact}</p>
                <button
                  type="button"
                  onClick={() => sayAnimal(selected, true)}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-emerald-800 px-4 text-sm font-black text-white shadow focus:outline-none focus:ring-4 focus:ring-emerald-300"
                >
                  <Volume2 className="h-4 w-4" /> Hear & learn
                </button>
              </div>
            </div>
          </aside>
        )}

        <div className="absolute right-2 top-2 z-30 rounded-lg bg-black/35 px-2 py-1 text-[9px] font-semibold text-white/70 backdrop-blur">
          Farm scene: public-domain FWS image · animal imagery via Wikimedia Commons / NIH BioArt
        </div>
      </section>
    </main>
  );
}
