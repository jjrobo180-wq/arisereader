import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Eye, Hand, Info, Move, Volume2, VolumeX } from "lucide-react";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";

type AnimalKind = "cow" | "horse" | "pig" | "sheep" | "duck" | "chicken" | "goat" | "dog";

type AnimalInfo = {
  id: AnimalKind;
  name: string;
  sound: string;
  fact: string;
  x: number;
  y: number;
  scale: number;
};

type Pos = { x: number; y: number; facing: 1 | -1 };

const ANIMALS: AnimalInfo[] = [
  { id: "cow", name: "Cow", sound: "Moooo!", fact: "Cows eat grass and hay. They are gentle herd animals.", x: 22, y: 58, scale: 1.18 },
  { id: "horse", name: "Horse", sound: "Neigh!", fact: "Horses can walk, trot, and run. They like being with other horses.", x: 58, y: 52, scale: 1.18 },
  { id: "pig", name: "Pig", sound: "Oink oink!", fact: "Pigs are very smart and use their noses to explore.", x: 40, y: 72, scale: 0.95 },
  { id: "sheep", name: "Sheep", sound: "Baa baa!", fact: "Sheep grow wool and like to stay together in a flock.", x: 72, y: 65, scale: 1.0 },
  { id: "duck", name: "Duck", sound: "Quack quack!", fact: "Ducks have waterproof feathers and love to swim.", x: 82, y: 78, scale: 0.72 },
  { id: "chicken", name: "Chicken", sound: "Cluck cluck!", fact: "Chickens scratch the ground to look for seeds and bugs.", x: 12, y: 76, scale: 0.7 },
  { id: "goat", name: "Goat", sound: "Maa maa!", fact: "Goats are curious climbers and love exploring new things.", x: 66, y: 76, scale: 0.82 },
  { id: "dog", name: "Farm Dog", sound: "Woof woof!", fact: "Farm dogs can help watch animals and stay close to people.", x: 48, y: 62, scale: 0.78 },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const random = (min: number, max: number) => min + Math.random() * (max - min);

function AnimalArt({ kind }: { kind: AnimalKind }) {
  const common = "drop-shadow-[0_12px_10px_rgba(15,23,42,0.24)]";
  if (kind === "cow") return (
    <svg viewBox="0 0 260 180" className={common} aria-hidden="true">
      <defs><linearGradient id="cowBody" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#d9d9d9"/></linearGradient></defs>
      <ellipse cx="120" cy="101" rx="76" ry="47" fill="url(#cowBody)" stroke="#252525" strokeWidth="3"/>
      <path d="M68 72c16-18 31-18 42-6-9 11-10 26-7 44-19-2-34-10-48-21zM128 61c20-12 42-8 54 8-11 9-18 23-18 40-16 1-32-4-43-13 11-12 12-23 7-35zM97 109c18-8 39-5 53 8-9 16-25 25-44 24-12-9-16-20-9-32z" fill="#242424"/>
      <path d="M54 91L34 77l10-14 22 12M186 79l27-8 6 16-25 9" fill="#f3f3f3" stroke="#252525" strokeWidth="3" strokeLinejoin="round"/>
      <ellipse cx="197" cy="94" rx="35" ry="31" fill="#f2f2f2" stroke="#252525" strokeWidth="3"/>
      <path d="M174 72c9-14 18-18 27-13l-4 19M219 72c-4-13-13-17-22-13l3 19" fill="#292929"/>
      <ellipse cx="211" cy="104" rx="22" ry="14" fill="#d9a5a5"/>
      <circle cx="188" cy="89" r="4.5" fill="#111"/><circle cx="210" cy="89" r="4.5" fill="#111"/>
      <ellipse cx="204" cy="103" rx="3" ry="2" fill="#6b3e3e"/><ellipse cx="217" cy="103" rx="3" ry="2" fill="#6b3e3e"/>
      <path d="M74 134v36M103 140v31M151 139v32M176 131v39" stroke="#323232" strokeWidth="10" strokeLinecap="round"/>
      <path d="M69 171h13M97 172h13M145 172h13M170 171h13" stroke="#151515" strokeWidth="6" strokeLinecap="round"/>
      <path d="M44 100c-18 5-21 18-14 29" stroke="#252525" strokeWidth="4" fill="none" strokeLinecap="round"/>
    </svg>
  );
  if (kind === "horse") return (
    <svg viewBox="0 0 260 180" className={common} aria-hidden="true">
      <defs><linearGradient id="horseBody" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b56a3c"/><stop offset="1" stopColor="#6f351f"/></linearGradient></defs>
      <ellipse cx="116" cy="103" rx="76" ry="42" fill="url(#horseBody)" stroke="#4d2918" strokeWidth="3"/>
      <path d="M171 99c9-33 9-49 31-67 15 9 20 24 15 47l-5 29z" fill="#8d4b2d" stroke="#4d2918" strokeWidth="3"/>
      <path d="M197 38l-2-24 12 19M211 40l9-22 5 27" fill="#8d4b2d" stroke="#4d2918" strokeWidth="3"/>
      <path d="M192 37c-10 17-11 38-7 63" stroke="#2b211c" strokeWidth="12" fill="none"/>
      <ellipse cx="211" cy="67" rx="22" ry="28" fill="#a85e36" stroke="#4d2918" strokeWidth="3"/>
      <circle cx="215" cy="58" r="4" fill="#101010"/><path d="M219 75c6 3 10 2 14-1" stroke="#2e1b14" strokeWidth="3" fill="none"/>
      <path d="M66 130l-8 42M93 135l-2 38M143 136l6 37M168 128l14 42" stroke="#64351f" strokeWidth="10" strokeLinecap="round"/>
      <path d="M54 172h13M85 173h13M143 173h14M176 171h13" stroke="#1e1a18" strokeWidth="6" strokeLinecap="round"/>
      <path d="M42 88c-25-15-32-4-42 8 18-5 27 2 39 13" fill="#2b211c"/>
    </svg>
  );
  if (kind === "pig") return (
    <svg viewBox="0 0 240 170" className={common} aria-hidden="true">
      <defs><linearGradient id="pigBody" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ffd0d8"/><stop offset="1" stopColor="#e996a7"/></linearGradient></defs>
      <ellipse cx="111" cy="105" rx="72" ry="43" fill="url(#pigBody)" stroke="#a85d6d" strokeWidth="3"/>
      <ellipse cx="182" cy="97" rx="35" ry="31" fill="#f5adbb" stroke="#a85d6d" strokeWidth="3"/>
      <path d="M165 72l-7-29 25 22M190 69l19-24 2 34" fill="#f1a1b0" stroke="#a85d6d" strokeWidth="3"/>
      <ellipse cx="203" cy="104" rx="22" ry="16" fill="#e9879a"/><circle cx="197" cy="104" r="3" fill="#824454"/><circle cx="209" cy="104" r="3" fill="#824454"/>
      <circle cx="180" cy="91" r="4" fill="#111"/><circle cx="199" cy="91" r="4" fill="#111"/>
      <path d="M68 137v27M98 143v22M139 142v23M160 133v31" stroke="#c97889" strokeWidth="9" strokeLinecap="round"/>
      <path d="M39 102c-17-5-18-18-5-20 14-2 17 13 7 18" stroke="#b76779" strokeWidth="4" fill="none" strokeLinecap="round"/>
    </svg>
  );
  if (kind === "sheep") return (
    <svg viewBox="0 0 250 180" className={common} aria-hidden="true">
      <defs><radialGradient id="wool" cx="40%" cy="30%"><stop stopColor="#fffef8"/><stop offset="1" stopColor="#d8d4c8"/></radialGradient></defs>
      <g fill="url(#wool)" stroke="#b8b3a5" strokeWidth="2">
        <circle cx="62" cy="97" r="32"/><circle cx="90" cy="78" r="34"/><circle cx="124" cy="78" r="37"/><circle cx="153" cy="91" r="36"/><circle cx="138" cy="119" r="38"/><circle cx="98" cy="121" r="39"/><circle cx="67" cy="119" r="30"/>
      </g>
      <path d="M157 90c10-23 31-28 48-14 15 12 13 36-4 48-20 13-40-1-44-34z" fill="#5b5146" stroke="#342f2b" strokeWidth="3"/>
      <path d="M166 79l-20-11 8 22M199 78l21-11-12 24" fill="#75695c" stroke="#342f2b" strokeWidth="3"/>
      <circle cx="178" cy="91" r="4" fill="#111"/><circle cx="199" cy="91" r="4" fill="#111"/>
      <path d="M82 139v32M113 143v29M144 139v32M165 130v40" stroke="#413a33" strokeWidth="9" strokeLinecap="round"/>
    </svg>
  );
  if (kind === "duck") return (
    <svg viewBox="0 0 220 160" className={common} aria-hidden="true">
      <defs><linearGradient id="duckBody" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f8df75"/><stop offset="1" stopColor="#d6a93f"/></linearGradient></defs>
      <ellipse cx="105" cy="104" rx="66" ry="35" fill="url(#duckBody)" stroke="#9f7629" strokeWidth="3"/>
      <circle cx="157" cy="69" r="31" fill="#337050" stroke="#214a37" strokeWidth="3"/>
      <path d="M184 71l29 9-29 11z" fill="#e89b32" stroke="#a8681f" strokeWidth="3"/>
      <circle cx="166" cy="60" r="4" fill="#111"/>
      <path d="M90 94c22-15 45-4 52 14-17 8-36 11-54 5z" fill="#b68c38" opacity=".8"/>
      <path d="M78 132l-5 17M128 133l3 16" stroke="#d78c23" strokeWidth="5"/><path d="M65 150h18M124 150h18" stroke="#d78c23" strokeWidth="5" strokeLinecap="round"/>
    </svg>
  );
  if (kind === "chicken") return (
    <svg viewBox="0 0 220 170" className={common} aria-hidden="true">
      <defs><linearGradient id="henBody" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b46d3d"/><stop offset="1" stopColor="#6d3423"/></linearGradient></defs>
      <ellipse cx="103" cy="105" rx="60" ry="42" fill="url(#henBody)" stroke="#54291d" strokeWidth="3"/>
      <circle cx="157" cy="72" r="28" fill="#9a5633" stroke="#54291d" strokeWidth="3"/>
      <path d="M145 45c-7-16 3-24 12-11 2-14 15-13 16 2 10-11 21 0 11 13" fill="#d94a3c" stroke="#8a2b24" strokeWidth="3"/>
      <path d="M181 74l28 9-27 11z" fill="#e3a62f" stroke="#aa761e" strokeWidth="3"/>
      <circle cx="166" cy="67" r="4" fill="#111"/>
      <path d="M62 95L25 66l13 40-29 9 49 10" fill="#7a402b" stroke="#54291d" strokeWidth="3"/>
      <path d="M89 139v25M126 139v25" stroke="#c6862b" strokeWidth="5"/><path d="M79 165h21M116 165h21" stroke="#c6862b" strokeWidth="5" strokeLinecap="round"/>
    </svg>
  );
  if (kind === "goat") return (
    <svg viewBox="0 0 240 180" className={common} aria-hidden="true">
      <defs><linearGradient id="goatBody" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#eee9df"/><stop offset="1" stopColor="#aaa394"/></linearGradient></defs>
      <ellipse cx="108" cy="105" rx="67" ry="39" fill="url(#goatBody)" stroke="#756f64" strokeWidth="3"/>
      <path d="M161 100c-2-33 12-53 35-56 20 14 25 38 11 62z" fill="#d6d0c5" stroke="#756f64" strokeWidth="3"/>
      <path d="M176 49c-12-23-7-34 2-38 2 17 9 25 16 31M199 47c13-20 11-31 3-37-6 16-13 23-20 29" fill="none" stroke="#8b7656" strokeWidth="6" strokeLinecap="round"/>
      <path d="M171 56l-18-7 11 19M206 55l18-9-12 21" fill="#c2baad" stroke="#756f64" strokeWidth="3"/>
      <circle cx="186" cy="74" r="4" fill="#111"/><circle cx="205" cy="74" r="4" fill="#111"/>
      <path d="M199 97c1 13 7 21 15 27-14 0-22-7-24-21" fill="#827a6e"/>
      <path d="M75 135v36M103 139v32M145 136v35M165 128v42" stroke="#888176" strokeWidth="9" strokeLinecap="round"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 240 170" className={common} aria-hidden="true">
      <defs><linearGradient id="dogBody" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#c68652"/><stop offset="1" stopColor="#7e452a"/></linearGradient></defs>
      <ellipse cx="112" cy="109" rx="62" ry="35" fill="url(#dogBody)" stroke="#60331f" strokeWidth="3"/>
      <circle cx="172" cy="78" r="31" fill="#ad6a3f" stroke="#60331f" strokeWidth="3"/>
      <path d="M153 62c-22-29-35-17-20 19M190 61c21-29 36-14 19 18" fill="#6e3a25" stroke="#60331f" strokeWidth="3"/>
      <ellipse cx="194" cy="88" rx="18" ry="13" fill="#d49b73"/><circle cx="198" cy="84" r="5" fill="#161616"/>
      <circle cx="174" cy="71" r="4" fill="#111"/>
      <path d="M58 105c-26-12-31-28-18-35 5 14 13 23 28 27" fill="#8a4c2e" stroke="#60331f" strokeWidth="3"/>
      <path d="M80 135v31M108 140v27M145 136v31M164 128v38" stroke="#7b442a" strokeWidth="9" strokeLinecap="round"/>
    </svg>
  );
}

export default function EyeGazeFarmWorld() {
  const [, navigate] = useLocation();
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: AnimalKind; dx: number; dy: number; moved: boolean } | null>(null);
  const dwellRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const resumeRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const [muted, setMuted] = useState(false);
  const [selected, setSelected] = useState<AnimalKind | null>(null);
  const [message, setMessage] = useState("Explore the farm. Look at, tap, or move any animal.");
  const [moving, setMoving] = useState<Record<AnimalKind, boolean>>(() => Object.fromEntries(ANIMALS.map(a => [a.id, true])) as Record<AnimalKind, boolean>);
  const [positions, setPositions] = useState<Record<AnimalKind, Pos>>(() => Object.fromEntries(ANIMALS.map(a => [a.id, { x: a.x, y: a.y, facing: 1 }])) as Record<AnimalKind, Pos>);
  const [friends, setFriends] = useState<[AnimalKind, AnimalKind] | null>(null);

  const animalMap = useMemo(() => Object.fromEntries(ANIMALS.map(a => [a.id, a])) as Record<AnimalKind, AnimalInfo>, []);

  const sayAnimal = useCallback((id: AnimalKind, includeFact = false) => {
    const animal = animalMap[id];
    setSelected(id);
    const text = includeFact
      ? `${animal.name}. ${animal.sound} ${animal.fact}`
      : `${animal.name}. ${animal.sound}`;
    setMessage(includeFact ? animal.fact : `${animal.name} says ${animal.sound}`);
    if (!muted) void speakCharacterAI(text, { calmMode: true });
  }, [animalMap, muted]);

  useEffect(() => {
    if (muted) stopSpeaking();
  }, [muted]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPositions(prev => {
        const next = { ...prev };
        for (const animal of ANIMALS) {
          if (!moving[animal.id]) continue;
          const old = prev[animal.id];
          let nx = random(8, 88);
          let ny = animal.id === "duck" ? random(69, 84) : random(46, 80);
          if (Math.random() < 0.22) {
            const buddy = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
            if (buddy.id !== animal.id) {
              nx = clamp(prev[buddy.id].x + random(-7, 7), 7, 90);
              ny = clamp(prev[buddy.id].y + random(-5, 5), 43, 82);
            }
          }
          next[animal.id] = { x: nx, y: ny, facing: nx < old.x ? -1 : 1 };
        }
        return next;
      });
    }, 4300);
    return () => window.clearInterval(timer);
  }, [moving]);

  useEffect(() => () => {
    stopSpeaking();
    Object.values(dwellRef.current).forEach(t => t && clearTimeout(t));
    Object.values(resumeRef.current).forEach(t => t && clearTimeout(t));
  }, []);

  const startDwell = (id: AnimalKind) => {
    if (dragRef.current) return;
    if (dwellRef.current[id]) clearTimeout(dwellRef.current[id]!);
    dwellRef.current[id] = setTimeout(() => sayAnimal(id), 1050);
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
    dragRef.current = { id, dx: event.clientX - px, dy: event.clientY - py, moved: false };
    setMoving(prev => ({ ...prev, [id]: false }));
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const stage = stageRef.current?.getBoundingClientRect();
    if (!drag || !stage) return;
    const x = clamp(((event.clientX - drag.dx - stage.left) / stage.width) * 100, 5, 92);
    const y = clamp(((event.clientY - drag.dy - stage.top) / stage.height) * 100, 38, 84);
    const old = positions[drag.id];
    if (Math.abs(x - old.x) > .8 || Math.abs(y - old.y) > .8) drag.moved = true;
    setPositions(prev => ({ ...prev, [drag.id]: { x, y, facing: x < prev[drag.id].x ? -1 : 1 } }));
  };

  const onPointerUp = (id: AnimalKind) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (!drag.moved) {
      sayAnimal(id);
    } else {
      let nearest: AnimalKind | null = null;
      let distance = Infinity;
      for (const other of ANIMALS) {
        if (other.id === id) continue;
        const a = positions[id], b = positions[other.id];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < distance) { distance = d; nearest = other.id; }
      }
      if (nearest && distance < 13) {
        setFriends([id, nearest]);
        const a = animalMap[id], b = animalMap[nearest];
        setMessage(`${a.name} is visiting ${b.name}!`);
        if (!muted) void speakCharacterAI(`${a.name} found ${b.name}. Hello, friend!`, { calmMode: true });
        setTimeout(() => setFriends(null), 2200);
      } else {
        setMessage(`You moved the ${animalMap[id].name}. Watch where it goes next!`);
      }
    }
    if (resumeRef.current[id]) clearTimeout(resumeRef.current[id]!);
    resumeRef.current[id] = setTimeout(() => setMoving(prev => ({ ...prev, [id]: true })), 3500);
  };

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#dcefc8] text-slate-950">
      <div className="relative z-50 flex min-h-16 items-center gap-2 border-b border-emerald-900/10 bg-[#fffdf5]/95 px-3 py-2 shadow-sm backdrop-blur sm:px-5">
        <button type="button" onClick={() => navigate("/eye-gaze-games")} className="flex h-11 items-center gap-2 rounded-2xl bg-white px-4 font-black shadow-sm ring-1 ring-slate-200 focus:outline-none focus:ring-4 focus:ring-emerald-300">
          <ArrowLeft className="h-5 w-5" /> Games
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-black sm:text-2xl">A.R.I.S.E. Farm World</h1>
          <p className="hidden text-xs font-bold text-slate-600 sm:block">Free play · gaze or tap · drag animals · learn by exploring</p>
        </div>
        <button type="button" onClick={() => setMuted(v => !v)} aria-label={muted ? "Turn sound on" : "Mute sound"} className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 focus:outline-none focus:ring-4 focus:ring-emerald-300">
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      <div className="relative">
        <div ref={stageRef} className="relative h-[calc(100dvh-7.5rem)] min-h-[560px] w-full overflow-hidden bg-gradient-to-b from-[#7bcdf4] via-[#b7e9ff] to-[#8bd36c] touch-none select-none">
          <div className="absolute left-0 right-0 top-[20%] h-[34%] rounded-[50%] bg-[#80bd59] opacity-90" style={{ transform: "scaleX(1.35)" }} />
          <div className="absolute left-[-10%] right-[-10%] top-[29%] h-[32%] rounded-[50%] bg-[#5fa64b]" />
          <div className="absolute inset-x-0 bottom-0 h-[49%] bg-[linear-gradient(180deg,#86c85b_0%,#69ad49_55%,#5b973d_100%)]" />
          <div className="absolute left-[4%] top-[4%] h-24 w-24 rounded-full bg-[#fff4a3] shadow-[0_0_80px_25px_rgba(255,244,163,0.55)]" />
          <div className="absolute left-[6%] top-[38%] h-[33%] w-[25%] rounded-[8px] bg-[#a94c35] shadow-2xl ring-4 ring-[#743326]/30">
            <div className="absolute left-[8%] right-[8%] top-[-23%] h-[31%] bg-[#623c32]" style={{ clipPath: "polygon(50% 0,100% 100%,0 100%)" }} />
            <div className="absolute bottom-0 left-[35%] h-[58%] w-[32%] rounded-t-[90px] bg-[#54372b] ring-4 ring-[#753d2d]" />
            <div className="absolute left-[11%] top-[25%] grid h-[26%] w-[22%] grid-cols-2 bg-[#f6e2a8] ring-4 ring-[#70412e]"><span className="border-r border-b border-[#70412e]"/><span className="border-b border-[#70412e]"/><span className="border-r border-[#70412e]"/><span/></div>
          </div>

          <div className="absolute bottom-[6%] right-[3%] h-[26%] w-[28%] rounded-[50%] bg-[radial-gradient(circle_at_50%_38%,#82dcff_0%,#48b7db_50%,#2287ae_100%)] shadow-inner ring-4 ring-white/30">
            <div className="absolute inset-x-[8%] top-[18%] h-2 rounded-full bg-white/25" />
          </div>

          <div className="absolute inset-x-0 bottom-[18%] h-20 opacity-80">
            {Array.from({ length: 14 }).map((_, i) => <span key={i} className="absolute bottom-0 h-20 w-3 rounded-t bg-[#e9d7a2] shadow" style={{ left: `${i * 8}%` }} />)}
            <div className="absolute inset-x-0 top-5 h-3 bg-[#dbc184]" />
            <div className="absolute inset-x-0 top-14 h-3 bg-[#dbc184]" />
          </div>

          <div className="absolute right-[5%] top-[32%] h-24 w-28">
            <div className="absolute bottom-0 left-[46%] h-16 w-5 rounded bg-[#74452d]" />
            <div className="absolute left-0 top-0 h-20 w-20 rounded-full bg-[#397d42] shadow-xl" />
            <div className="absolute right-0 top-3 h-16 w-16 rounded-full bg-[#4b934d]" />
          </div>

          <div className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2 rounded-full bg-slate-950/78 px-4 py-2 text-center text-sm font-black text-white shadow-lg backdrop-blur sm:text-base" aria-live="polite">
            {message}
          </div>

          {ANIMALS.map(animal => {
            const pos = positions[animal.id];
            const isSelected = selected === animal.id;
            const isFriend = friends?.includes(animal.id);
            return (
              <button
                key={animal.id}
                type="button"
                aria-label={`${animal.name}. Gaze or tap to hear it. Drag to move it.`}
                onMouseEnter={() => startDwell(animal.id)}
                onMouseLeave={() => cancelDwell(animal.id)}
                onFocus={() => startDwell(animal.id)}
                onBlur={() => cancelDwell(animal.id)}
                onPointerDown={e => onPointerDown(animal.id, e)}
                onPointerMove={onPointerMove}
                onPointerUp={() => onPointerUp(animal.id)}
                onPointerCancel={() => onPointerUp(animal.id)}
                className={`absolute z-20 w-[120px] sm:w-[150px] md:w-[175px] cursor-grab bg-transparent p-0 outline-none transition-[left,top,filter] duration-[3400ms] ease-in-out active:cursor-grabbing focus-visible:ring-4 focus-visible:ring-amber-300 ${isSelected ? "drop-shadow-[0_0_14px_rgba(250,204,21,.95)]" : ""} ${isFriend ? "animate-bounce" : ""}`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: `translate(-50%,-50%) scaleX(${pos.facing}) scale(${animal.scale})`, touchAction: "none" }}
              >
                <AnimalArt kind={animal.id} />
                <span className={`absolute left-1/2 top-full mt-[-5px] -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-black shadow ${isSelected ? "bg-amber-300 text-slate-950" : "bg-white/92 text-slate-900"}`} style={{ transform: `translateX(-50%) scaleX(${pos.facing})` }}>
                  {animal.name}
                </span>
              </button>
            );
          })}

          <div className="absolute bottom-3 left-3 z-40 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2">
            <div className="flex items-center gap-2 rounded-2xl bg-white/92 px-3 py-2 text-xs font-black shadow"><Eye className="h-4 w-4 text-emerald-700"/> Look & hold</div>
            <div className="flex items-center gap-2 rounded-2xl bg-white/92 px-3 py-2 text-xs font-black shadow"><Hand className="h-4 w-4 text-emerald-700"/> Tap animal</div>
            <div className="flex items-center gap-2 rounded-2xl bg-white/92 px-3 py-2 text-xs font-black shadow"><Move className="h-4 w-4 text-emerald-700"/> Drag to move</div>
          </div>
        </div>

        {selected && (
          <aside className="absolute bottom-5 right-4 z-50 w-[min(340px,calc(100%-2rem))] rounded-3xl border border-white/70 bg-white/95 p-4 shadow-2xl backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-100"><Info className="h-6 w-6 text-emerald-800"/></div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black">{animalMap[selected].name}</h2>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-600">{animalMap[selected].fact}</p>
                <button type="button" onClick={() => sayAnimal(selected, true)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-emerald-800 px-4 text-sm font-black text-white shadow focus:outline-none focus:ring-4 focus:ring-emerald-300">
                  <Volume2 className="h-4 w-4"/> Hear & learn
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
