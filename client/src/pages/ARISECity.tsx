import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import ARISECityInterior, { type CityInteriorAction } from "@/pages/ARISECityInterior";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Car,
  Coins,
  Home,
  MapPin,
  ShoppingBag,
  Sparkles,
  Star,
  UserRound,
  X,
  Volume2,
  VolumeX,
} from "lucide-react";

type CareerId = "teacher" | "medical" | "engineer" | "chef" | "designer" | "entrepreneur";
type AvatarId = "jay" | "maya" | "alex" | "zoe";
type PlaceType =
  | "career"
  | "school"
  | "hospital"
  | "tech"
  | "restaurant"
  | "studio"
  | "business"
  | "store"
  | "dealer"
  | "apartments"
  | "houses"
  | "library"
  | "bank"
  | "park";

type Building = {
  id: string;
  label: string;
  type: PlaceType;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  accent: string;
};

type GameSave = {
  started: boolean;
  avatar: AvatarId;
  career: CareerId;
  money: number;
  xp: number;
  hired: boolean;
  interviewPassed: boolean;
  carOwned: boolean;
  homeOwned: boolean;
  inventory: string[];
  playerX: number;
  playerY: number;
  shiftsWorked: number;
};

const WORLD_W = 2800;
const WORLD_H = 2100;
const SAVE_KEY = "arise-city-save-v1";

const CAREERS: Record<CareerId, {
  name: string;
  icon: string;
  workplace: PlaceType;
  color: string;
  description: string;
  pay: number;
}> = {
  teacher: { name: "Teacher", icon: "📚", workplace: "school", color: "#2563eb", description: "Teach, plan lessons, and help students grow.", pay: 180 },
  medical: { name: "Medical Professional", icon: "🩺", workplace: "hospital", color: "#ef4444", description: "Help patients, communicate clearly, and solve problems.", pay: 200 },
  engineer: { name: "Engineer", icon: "🛠️", workplace: "tech", color: "#7c3aed", description: "Design, test, and improve how things work.", pay: 210 },
  chef: { name: "Chef", icon: "👨‍🍳", workplace: "restaurant", color: "#f59e0b", description: "Plan meals, manage a kitchen, and serve customers.", pay: 175 },
  designer: { name: "Designer", icon: "🎨", workplace: "studio", color: "#ec4899", description: "Create visuals, products, spaces, and ideas.", pay: 190 },
  entrepreneur: { name: "Entrepreneur", icon: "💼", workplace: "business", color: "#0f766e", description: "Build a business, solve customer problems, and manage money.", pay: 220 },
};

const AVATARS: Record<AvatarId, { name: string; skin: string; hair: string; shirt: string; pants: string }> = {
  jay: { name: "Jay", skin: "#9a633f", hair: "#24140d", shirt: "#e11d48", pants: "#1d4ed8" },
  maya: { name: "Maya", skin: "#7b4b32", hair: "#1a1110", shirt: "#7c3aed", pants: "#0f766e" },
  alex: { name: "Alex", skin: "#c88962", hair: "#4a2a1c", shirt: "#0284c7", pants: "#334155" },
  zoe: { name: "Zoe", skin: "#e1aa86", hair: "#6b3f27", shirt: "#db2777", pants: "#4338ca" },
};

const BUILDINGS: Building[] = [
  { id: "career", label: "Career Center", type: "career", x: 260, y: 250, w: 300, h: 190, color: "#4f46e5", accent: "#c7d2fe" },
  { id: "school", label: "A.R.I.S.E. Middle School", type: "school", x: 760, y: 210, w: 380, h: 230, color: "#2563eb", accent: "#bfdbfe" },
  { id: "hospital", label: "Community Health Center", type: "hospital", x: 1320, y: 230, w: 340, h: 215, color: "#dc2626", accent: "#fecaca" },
  { id: "tech", label: "FutureWorks Lab", type: "tech", x: 1910, y: 220, w: 340, h: 215, color: "#7c3aed", accent: "#ddd6fe" },
  { id: "restaurant", label: "Main Street Kitchen", type: "restaurant", x: 2280, y: 600, w: 300, h: 210, color: "#d97706", accent: "#fde68a" },
  { id: "studio", label: "Create Studio", type: "studio", x: 1900, y: 910, w: 330, h: 210, color: "#db2777", accent: "#fbcfe8" },
  { id: "business", label: "LaunchPad Offices", type: "business", x: 2280, y: 1210, w: 300, h: 210, color: "#0f766e", accent: "#99f6e4" },
  { id: "store", label: "Central Shops", type: "store", x: 1450, y: 1210, w: 360, h: 220, color: "#ea580c", accent: "#fed7aa" },
  { id: "dealer", label: "Metro Motors", type: "dealer", x: 790, y: 1210, w: 360, h: 215, color: "#334155", accent: "#cbd5e1" },
  { id: "apartments", label: "Skyline Apartments", type: "apartments", x: 240, y: 1160, w: 350, h: 270, color: "#0891b2", accent: "#a5f3fc" },
  { id: "houses", label: "Maple Homes", type: "houses", x: 240, y: 1630, w: 470, h: 240, color: "#16a34a", accent: "#bbf7d0" },
  { id: "library", label: "City Library", type: "library", x: 1030, y: 1650, w: 340, h: 215, color: "#9333ea", accent: "#e9d5ff" },
  { id: "bank", label: "Community Bank", type: "bank", x: 1570, y: 1650, w: 300, h: 205, color: "#047857", accent: "#a7f3d0" },
];

const NPCS = [
  { name: "Jordan", x: 635, y: 690, shirt: "#0ea5e9", line: "The Career Center helped me practice my interview!" },
  { name: "Sam", x: 1150, y: 790, shirt: "#e11d48", line: "I’m saving up for my first apartment." },
  { name: "Nia", x: 1730, y: 760, shirt: "#7c3aed", line: "Try working a shift after you get hired." },
  { name: "Kai", x: 2080, y: 1510, shirt: "#059669", line: "The library gives easy XP if you want to level up." },
  { name: "Avery", x: 930, y: 1540, shirt: "#f59e0b", line: "Cars make it way faster to get around the city." },
  { name: "Milo", x: 400, y: 920, shirt: "#ec4899", line: "I like hanging out at Central Park after work." },
];

const INTERVIEW_QUESTIONS = [
  {
    q: "The interviewer asks about a mistake you made. What is the strongest response?",
    choices: ["Blame somebody else", "Explain what you learned and how you improved", "Say you never make mistakes"],
    answer: 1,
  },
  {
    q: "What should you do if you do not understand an interview question?",
    choices: ["Ask politely for clarification", "Guess quickly", "Ignore the question"],
    answer: 0,
  },
  {
    q: "Which choice shows strong workplace communication?",
    choices: ["Listen, respond clearly, and ask questions", "Interrupt everyone", "Avoid speaking to teammates"],
    answer: 0,
  },
];

type ComprehensionChallenge = {
  passage: string;
  q: string;
  choices: string[];
  answer: number;
  explanation: string;
};

const TRAFFIC_COMPREHENSION: ComprehensionChallenge[] = [
  {
    passage: "Maya left the library and started across Main Street. The walk signal had already changed, but she was focused on a message and kept walking. A driver stopped suddenly. Maya stepped back onto the sidewalk and decided to wait for the next walk signal.",
    q: "What caused the dangerous situation?",
    choices: ["Maya crossed after the signal changed while distracted", "The library closed early", "Maya waited on the sidewalk"],
    answer: 0,
    explanation: "The passage says Maya kept crossing after the signal changed because she was distracted.",
  },
  {
    passage: "Jordan reached an intersection where parked cars made it hard to see traffic. Instead of stepping into the street, Jordan moved to the marked crosswalk, looked left, right, and left again, and crossed when the road was clear.",
    q: "Why did Jordan move to the marked crosswalk?",
    choices: ["To find a safer place with a better view of traffic", "To get farther from the destination", "To avoid seeing any cars"],
    answer: 0,
    explanation: "Jordan needed a safer place to see traffic before crossing.",
  },
  {
    passage: "Kai was hurrying to work when a ball rolled into the road. Kai wanted to grab it right away, but noticed a car approaching. Kai stayed on the sidewalk, let the car pass, and only picked up the ball when the street was clear.",
    q: "What is the main idea of this passage?",
    choices: ["Being late is always a problem", "Objects are more important than safety", "Waiting for traffic to clear is safer than rushing into the road"],
    answer: 2,
    explanation: "Kai chose to wait because personal safety mattered more than grabbing the ball quickly.",
  },
  {
    passage: "Avery got off the city bus near school. The bus blocked Avery's view of the next lane. Avery waited until the bus moved away before crossing so there would be a clear view in both directions.",
    q: "What can you infer about why Avery waited?",
    choices: ["The bus was the final destination", "A clear view helps Avery check for moving vehicles", "Avery forgot where the school was"],
    answer: 1,
    explanation: "Waiting until the bus moved gave Avery a clear view of traffic.",
  },
];

const LIBRARY_COMPREHENSION: ComprehensionChallenge[] = [
  {
    passage: "DeShawn wanted to buy a $120 pair of headphones. He had $45 saved and earned $25 each weekend helping his aunt. Instead of spending his weekend money on snacks, he decided to save until he had enough for the headphones.",
    q: "Which detail best shows DeShawn is working toward a goal?",
    choices: ["The headphones cost $120", "He saves his weekend earnings instead of spending them", "He helps his aunt"],
    answer: 1,
    explanation: "Saving his earnings directly shows the action he is taking to reach his goal.",
  },
  {
    passage: "A robotics team built a small delivery robot. During the first test, the robot kept turning too early. The team reviewed the sensor data, changed the code, and tested again. On the third test, the robot completed the route.",
    q: "What helped the team solve the problem?",
    choices: ["Ignoring the first test", "Using evidence and revising the code", "Building a completely unrelated robot"],
    answer: 1,
    explanation: "The team studied the data, made a change, and tested the solution.",
  },
  {
    passage: "Nia started a new job at a café. During a busy shift, she noticed that customers were waiting a long time because orders were being placed in two different spots. She suggested using one clearly marked pickup area. The next day, customers moved through the line more quickly.",
    q: "What problem did Nia's idea solve?",
    choices: ["Customers did not know where to pick up orders", "The café had no food", "Nia did not like her job"],
    answer: 0,
    explanation: "The single pickup area made the process clearer and reduced waiting.",
  },
  {
    passage: "Luis read two articles about the same event. One article included interviews and links to official records. The other made several big claims but did not name any sources. Luis decided to use the first article for his project.",
    q: "Why was the first article a stronger source?",
    choices: ["It was shorter", "It used evidence that could be checked", "It had a more exciting headline"],
    answer: 1,
    explanation: "Interviews and official records gave Luis evidence he could verify.",
  },
];

function isTrafficRoad(x: number, y: number) {
  return (
    (y >= 520 && y <= 770) ||
    (y >= 1000 && y <= 1250) ||
    (x >= 640 && x <= 890) ||
    (x >= 1180 && x <= 1430) ||
    (x >= 1830 && x <= 2080)
  );
}

const WORK_TASKS: Record<CareerId, Array<{ q: string; choices: string[]; answer: number }>> = {
  teacher: [
    { q: "A student is confused. What should you do first?", choices: ["Explain it another way", "Ignore them", "Give harder work"], answer: 0 },
    { q: "What helps a class stay organized?", choices: ["Clear routines", "Changing every rule daily", "No directions"], answer: 0 },
    { q: "A student improves. What is useful feedback?", choices: ["Name what they did well", "Say nothing", "Compare them to others"], answer: 0 },
  ],
  medical: [
    { q: "A patient is nervous. What is a good first step?", choices: ["Listen and explain what will happen", "Rush them", "Ignore questions"], answer: 0 },
    { q: "Why is accurate information important?", choices: ["It supports safe decisions", "It makes work slower", "It does not matter"], answer: 0 },
    { q: "What skill matters in health care?", choices: ["Careful communication", "Guessing", "Avoiding teamwork"], answer: 0 },
  ],
  engineer: [
    { q: "A design fails a test. What should you do?", choices: ["Study the problem and improve it", "Pretend it worked", "Throw it away immediately"], answer: 0 },
    { q: "Why do engineers build prototypes?", choices: ["To test ideas", "To avoid planning", "Only for decoration"], answer: 0 },
    { q: "Which skill helps engineering teams?", choices: ["Problem solving", "Ignoring evidence", "Never revising"], answer: 0 },
  ],
  chef: [
    { q: "An order has a food allergy note. What should you do?", choices: ["Follow the safety instructions carefully", "Ignore it", "Guess"], answer: 0 },
    { q: "What helps a kitchen run well?", choices: ["Organization and communication", "Leaving messes", "No teamwork"], answer: 0 },
    { q: "A dish is not right. What should you do?", choices: ["Fix the problem before serving", "Serve it anyway", "Hide it"], answer: 0 },
  ],
  designer: [
    { q: "A client says a design is hard to read. What should you do?", choices: ["Use the feedback to improve clarity", "Ignore them", "Make it smaller"], answer: 0 },
    { q: "What should a strong design solve?", choices: ["A real user need", "Nothing", "Only the designer's preference"], answer: 0 },
    { q: "Why make multiple drafts?", choices: ["To improve the idea", "Because the first idea must be bad", "To waste time"], answer: 0 },
  ],
  entrepreneur: [
    { q: "Customers keep asking for the same feature. What should you do?", choices: ["Study whether it solves a real need", "Ignore all customers", "Spend money immediately"], answer: 0 },
    { q: "Why track business costs?", choices: ["To make informed money decisions", "Because prices never matter", "Only for decoration"], answer: 0 },
    { q: "A plan is not working. What is a strong response?", choices: ["Use evidence and adjust the plan", "Keep doing the exact same thing forever", "Blame customers"], answer: 0 },
  ],
};

function freshSave(): GameSave {
  return {
    started: false,
    avatar: "jay",
    career: "teacher",
    money: 250,
    xp: 0,
    hired: false,
    interviewPassed: false,
    carOwned: false,
    homeOwned: false,
    inventory: [],
    playerX: 850,
    playerY: 760,
    shiftsWorked: 0,
  };
}

function loadSave(): GameSave {
  try {
    return { ...freshSave(), ...JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") };
  } catch {
    return freshSave();
  }
}

function levelFromXp(xp: number) {
  return Math.max(1, Math.floor(xp / 250) + 1);
}

function xpForNext(level: number) {
  return level * 250;
}

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function drawPerson(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  avatar: { skin: string; hair: string; shirt: string; pants: string },
  direction: number,
  walking: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.fillStyle = "rgba(15,23,42,.24)";
  ctx.beginPath();
  ctx.ellipse(0, 26, 20, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  const swing = walking ? Math.sin(performance.now() / 95) * 8 : 0;

  ctx.strokeStyle = avatar.pants;
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-6, 12);
  ctx.lineTo(-8 + swing * .45, 31);
  ctx.moveTo(6, 12);
  ctx.lineTo(8 - swing * .45, 31);
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.ellipse(-9 + swing * .45, 33, 9, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(9 - swing * .45, 33, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = avatar.shirt;
  drawRoundedRect(ctx, -16, -24, 32, 39, 11);
  ctx.fill();

  ctx.strokeStyle = avatar.skin;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-13, -15);
  ctx.lineTo(-23 - swing * .3, 7);
  ctx.moveTo(13, -15);
  ctx.lineTo(23 + swing * .3, 7);
  ctx.stroke();

  ctx.fillStyle = avatar.skin;
  ctx.beginPath();
  ctx.arc(0, -38, 17, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = avatar.hair;
  ctx.beginPath();
  ctx.arc(0, -43, 17, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-10, -43, 9, Math.PI * .8, Math.PI * 1.8);
  ctx.fill();

  ctx.fillStyle = "#111827";
  const eyeOffset = direction < 0 ? -2 : direction > 0 ? 2 : 0;
  ctx.beginPath();
  ctx.arc(-6 + eyeOffset, -39, 1.7, 0, Math.PI * 2);
  ctx.arc(6 + eyeOffset, -39, 1.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, angle = 0, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.shadowColor = "rgba(15,23,42,.28)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 7;
  ctx.fillStyle = color;
  drawRoundedRect(ctx, -32, -18, 64, 36, 10);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#dbeafe";
  drawRoundedRect(ctx, -17, -13, 34, 20, 6);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(-22, -21, 14, 5);
  ctx.fillRect(8, -21, 14, 5);
  ctx.fillRect(-22, 16, 14, 5);
  ctx.fillRect(8, 16, 14, 5);
  ctx.restore();
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(15,23,42,.18)";
  ctx.beginPath();
  ctx.ellipse(6, 23, 20, 7, -.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7c4a2d";
  ctx.fillRect(-4, 4, 8, 24);
  ctx.fillStyle = "#15803d";
  ctx.beginPath();
  ctx.arc(-10, -3, 16, 0, Math.PI * 2);
  ctx.arc(9, -7, 18, 0, Math.PI * 2);
  ctx.arc(0, -20, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(-3, -15, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Building) {
  const depth = 34;

  ctx.save();
  ctx.shadowColor = "rgba(15,23,42,.22)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 14;

  ctx.fillStyle = "#334155";
  ctx.beginPath();
  ctx.moveTo(b.x + b.w, b.y + 18);
  ctx.lineTo(b.x + b.w + depth, b.y);
  ctx.lineTo(b.x + b.w + depth, b.y + b.h - 10);
  ctx.lineTo(b.x + b.w, b.y + b.h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = b.color;
  drawRoundedRect(ctx, b.x, b.y + 18, b.w, b.h - 18, 14);
  ctx.fill();

  ctx.fillStyle = b.accent;
  ctx.beginPath();
  ctx.moveTo(b.x + 12, b.y + 18);
  ctx.lineTo(b.x + 42, b.y);
  ctx.lineTo(b.x + b.w + depth - 12, b.y);
  ctx.lineTo(b.x + b.w - 12, b.y + 18);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = "transparent";

  ctx.fillStyle = "rgba(255,255,255,.85)";
  for (let row = 0; row < 2; row++) {
    const count = Math.max(3, Math.floor(b.w / 85));
    for (let i = 0; i < count; i++) {
      const wx = b.x + 28 + i * ((b.w - 56) / count);
      const wy = b.y + 62 + row * 58;
      drawRoundedRect(ctx, wx, wy, 42, 30, 5);
      ctx.fill();
      ctx.fillStyle = "rgba(14,116,144,.25)";
      ctx.fillRect(wx + 19, wy, 4, 30);
      ctx.fillStyle = "rgba(255,255,255,.85)";
    }
  }

  ctx.fillStyle = "#f8fafc";
  const doorW = 48;
  drawRoundedRect(ctx, b.x + b.w / 2 - doorW / 2, b.y + b.h - 58, doorW, 58, 7);
  ctx.fill();
  ctx.fillStyle = "#475569";
  ctx.fillRect(b.x + b.w / 2 - 2, b.y + b.h - 50, 4, 45);

  ctx.font = "900 22px system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = "#0f172a";
  const labelWidth = Math.min(b.w - 32, ctx.measureText(b.label).width + 32);
  drawRoundedRect(ctx, b.x + b.w / 2 - labelWidth / 2, b.y + 22, labelWidth, 36, 12);
  ctx.fillStyle = "rgba(255,255,255,.95)";
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.fillText(b.label, b.x + b.w / 2, b.y + 48);

  ctx.restore();
}

function GameModal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[130] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2rem] bg-white text-slate-900 shadow-2xl border border-white/70">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-5 sm:px-7 py-5 border-b border-slate-100 flex items-start gap-4">
          <div className="flex-1">
            <h2 className="text-2xl sm:text-3xl font-black">{title}</h2>
            {subtitle && <p className="mt-1 text-sm sm:text-base font-semibold text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 sm:p-7">{children}</div>
      </div>
    </div>
  );
}

export default function ARISECity() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const frameRef = useRef<number | null>(null);
  const trafficLockRef = useRef(false);
  const lastSafeRef = useRef({ x: loadSave().playerX, y: loadSave().playerY });
  const trafficAudioRef = useRef<{
    ctx: AudioContext;
    source: AudioBufferSourceNode;
    gain: GainNode;
    hum: OscillatorNode;
  } | null>(null);

  const [save, setSave] = useState<GameSave>(() => loadSave());
  const [screen, setScreen] = useState<"setup" | "city" | "interior">(() => (loadSave().started ? "city" : "setup"));
  const [insidePlace, setInsidePlace] = useState<Building | null>(null);
  const [transitionLabel, setTransitionLabel] = useState<string | null>(null);
  const [trafficChallenge, setTrafficChallenge] = useState<number | null>(null);
  const [trafficFeedback, setTrafficFeedback] = useState("");
  const [libraryChallenge, setLibraryChallenge] = useState(0);
  const [libraryFeedback, setLibraryFeedback] = useState("");
  const [ambientEnabled, setAmbientEnabled] = useState(true);
  const [avatar, setAvatar] = useState<AvatarId>(() => loadSave().avatar);
  const [career, setCareer] = useState<CareerId>(() => loadSave().career);
  const [nearPlace, setNearPlace] = useState<Building | null>(null);
  const [nearNpc, setNearNpc] = useState<(typeof NPCS)[number] | null>(null);
  const [modal, setModal] = useState<null | "interview" | "work" | "store" | "dealer" | "home" | "library" | "bank" | "npc">(null);
  const [selectedNpc, setSelectedNpc] = useState<(typeof NPCS)[number] | null>(null);
  const [interviewIndex, setInterviewIndex] = useState(0);
  const [interviewScore, setInterviewScore] = useState(0);
  const [workIndex, setWorkIndex] = useState(0);
  const [workScore, setWorkScore] = useState(0);
  const [notice, setNotice] = useState("");

  const level = levelFromXp(save.xp);
  const careerInfo = CAREERS[save.career];

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }, [save]);

  const updateSave = (patch: Partial<GameSave>) => {
    setSave(current => ({ ...current, ...patch }));
  };

  const addMoneyXp = (money: number, xp: number, message: string) => {
    setSave(current => ({ ...current, money: current.money + money, xp: current.xp + xp }));
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const stopTrafficAudio = () => {
    const audio = trafficAudioRef.current;
    if (!audio) return;
    try {
      audio.source.stop();
      audio.hum.stop();
      audio.ctx.close();
    } catch {}
    trafficAudioRef.current = null;
  };

  const startTrafficAudio = () => {
    if (!ambientEnabled || screen !== "city" || trafficAudioRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new AudioCtx();
      const duration = 2.5;
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (0.42 + Math.sin(i / 2200) * 0.08);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 620;
      const gain = ctx.createGain();
      gain.gain.value = 0.045;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      const hum = ctx.createOscillator();
      const humGain = ctx.createGain();
      hum.type = "sine";
      hum.frequency.value = 56;
      humGain.gain.value = 0.018;
      hum.connect(humGain);
      humGain.connect(ctx.destination);

      source.start();
      hum.start();
      trafficAudioRef.current = { ctx, source, gain, hum };
    } catch {}
  };

  const playTrafficAlert = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new AudioCtx();
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + .45);
      const horn = ctx.createOscillator();
      horn.type = "square";
      horn.frequency.setValueAtTime(310, ctx.currentTime);
      horn.frequency.exponentialRampToValueAtTime(245, ctx.currentTime + .35);
      horn.connect(gain);
      horn.start();
      horn.stop(ctx.currentTime + .45);
      window.setTimeout(() => ctx.close().catch(() => {}), 700);
    } catch {}
  };

  const enterBuilding = (place: Building) => {
    keysRef.current = {};
    setTransitionLabel(`Entering ${place.label}…`);
    window.setTimeout(() => {
      stopTrafficAudio();
      setInsidePlace(place);
      setScreen("interior");
      setNearPlace(null);
      setTransitionLabel(null);
    }, 420);
  };

  const exitBuilding = () => {
    if (!insidePlace) return;
    const label = insidePlace.label;
    setTransitionLabel(`Leaving ${label}…`);
    window.setTimeout(() => {
      setInsidePlace(null);
      setScreen("city");
      setTransitionLabel(null);
      window.setTimeout(() => startTrafficAudio(), 100);
    }, 420);
  };

  const handleInteriorAction = (action: CityInteriorAction) => {
    if (action === "interview") {
      setInterviewIndex(0);
      setInterviewScore(0);
      setModal("interview");
      return;
    }
    if (action === "work") {
      if (!save.hired) {
        setNotice("Get hired at the Career Center first.");
        window.setTimeout(() => setNotice(""), 2400);
        return;
      }
      setWorkIndex(0);
      setWorkScore(0);
      setModal("work");
      return;
    }
    if (action === "store") setModal("store");
    else if (action === "dealer") setModal("dealer");
    else if (action === "home") setModal("home");
    else if (action === "bank") setModal("bank");
    else if (action === "library") {
      setLibraryChallenge((save.xp + level) % LIBRARY_COMPREHENSION.length);
      setLibraryFeedback("");
      setModal("library");
    } else {
      setNotice("You explored this building and learned more about the community.");
      window.setTimeout(() => setNotice(""), 2400);
    }
  };

  useEffect(() => {
    if (screen !== "city") stopTrafficAudio();
    return () => {
      if (screen !== "city") stopTrafficAudio();
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== "city") return;

    const onDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      startTrafficAudio();
      keysRef.current[key] = true;
      if (key === "e") interact();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
    };
    const onUp = (event: KeyboardEvent) => {
      keysRef.current[event.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [screen, nearPlace, nearNpc, save]);

  useEffect(() => {
    if (screen !== "city") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let last = performance.now();
    let playerX = save.playerX;
    let playerY = save.playerY;
    let direction = 1;
    let lastPositionSave = performance.now();

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const render = (time: number) => {
      const rect = wrap.getBoundingClientRect();
      const dt = Math.min(.04, (time - last) / 1000);
      last = time;

      const keys = keysRef.current;
      let dx = 0;
      let dy = 0;
      if (keys["w"] || keys["arrowup"]) dy -= 1;
      if (keys["s"] || keys["arrowdown"]) dy += 1;
      if (keys["a"] || keys["arrowleft"]) dx -= 1;
      if (keys["d"] || keys["arrowright"]) dx += 1;

      const isMoving = dx !== 0 || dy !== 0;
      if (isMoving && !trafficLockRef.current) {
        const mag = Math.hypot(dx, dy) || 1;
        dx /= mag;
        dy /= mag;
        direction = dx < 0 ? -1 : dx > 0 ? 1 : direction;
        const speed = save.carOwned && keys["shift"] ? 410 : save.carOwned ? 300 : 220;
        playerX = Math.max(75, Math.min(WORLD_W - 75, playerX + dx * speed * dt));
        playerY = Math.max(75, Math.min(WORLD_H - 75, playerY + dy * speed * dt));
      }
      const cameraX = Math.max(0, Math.min(WORLD_W - rect.width, playerX - rect.width / 2));
      const cameraY = Math.max(0, Math.min(WORLD_H - rect.height, playerY - rect.height / 2));

      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.save();
      ctx.translate(-cameraX, -cameraY);

      const grass = ctx.createLinearGradient(0, 0, WORLD_W, WORLD_H);
      grass.addColorStop(0, "#8ddf7b");
      grass.addColorStop(.55, "#76cf69");
      grass.addColorStop(1, "#5ebc5d");
      ctx.fillStyle = grass;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);

      ctx.fillStyle = "#64748b";
      ctx.fillRect(0, 520, WORLD_W, 250);
      ctx.fillRect(0, 1000, WORLD_W, 250);
      ctx.fillRect(640, 0, 250, WORLD_H);
      ctx.fillRect(1180, 0, 250, WORLD_H);
      ctx.fillRect(1830, 0, 250, WORLD_H);

      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(0, 500, WORLD_W, 20);
      ctx.fillRect(0, 770, WORLD_W, 20);
      ctx.fillRect(0, 980, WORLD_W, 20);
      ctx.fillRect(0, 1250, WORLD_W, 20);
      ctx.fillRect(620, 0, 20, WORLD_H);
      ctx.fillRect(890, 0, 20, WORLD_H);
      ctx.fillRect(1160, 0, 20, WORLD_H);
      ctx.fillRect(1430, 0, 20, WORLD_H);
      ctx.fillRect(1810, 0, 20, WORLD_H);
      ctx.fillRect(2080, 0, 20, WORLD_H);

      ctx.strokeStyle = "rgba(255,255,255,.55)";
      ctx.lineWidth = 4;
      ctx.setLineDash([24, 24]);
      [645, 1125].forEach(y => {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WORLD_W, y);
        ctx.stroke();
      });
      [765, 1305, 1955].forEach(x => {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, WORLD_H);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      ctx.fillStyle = "#f8fafc";
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(630 + i * 34, 590, 18, 110);
        ctx.fillRect(1180 + i * 34, 1070, 18, 110);
        ctx.fillRect(1830 + i * 34, 590, 18, 110);
      }

      ctx.fillStyle = "#5eead4";
      ctx.beginPath();
      ctx.ellipse(1580, 870, 120, 74, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#dbeafe";
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.fillStyle = "#e0f2fe";
      ctx.beginPath();
      ctx.arc(1580, 860, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0ea5e9";
      ctx.beginPath();
      ctx.arc(1580, 852, 10, 0, Math.PI * 2);
      ctx.fill();

      BUILDINGS.forEach(b => drawBuilding(ctx, b));

      const treePoints = [
        [120, 130], [570, 140], [1040, 115], [1710, 120], [2520, 210],
        [110, 860], [520, 860], [1010, 875], [1670, 900], [2520, 930],
        [120, 1500], [750, 1550], [1420, 1530], [2030, 1580], [2580, 1650],
        [830, 1930], [1480, 1940], [2240, 1920],
      ];
      treePoints.forEach(([x, y], index) => drawTree(ctx, x, y, .9 + (index % 3) * .08));

      ctx.font = "900 28px system-ui";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(15,23,42,.72)";
      ctx.fillText("CENTRAL PARK", 1580, 985);

      const trafficT = (time / 1000) % 18;
      const trafficCars = [
        { x: ((trafficT * 180) % (WORLD_W + 300)) - 150, y: 580, color: "#ef4444", angle: 0, scale: .9 },
        { x: WORLD_W - (((trafficT + 5) * 160) % (WORLD_W + 300)) + 150, y: 720, color: "#0ea5e9", angle: Math.PI, scale: .88 },
        { x: 700, y: ((trafficT * 140) % (WORLD_H + 260)) - 130, color: "#f59e0b", angle: Math.PI / 2, scale: .84 },
        { x: 2020, y: WORLD_H - (((trafficT + 2) * 145) % (WORLD_H + 260)) + 130, color: "#8b5cf6", angle: -Math.PI / 2, scale: .85 },
      ];
      trafficCars.forEach(car => drawCar(ctx, car.x, car.y, car.color, car.angle, car.scale));

      if (!isTrafficRoad(playerX, playerY)) {
        lastSafeRef.current = { x: playerX, y: playerY };
      }

      const drivingOwnCar = save.carOwned && keys["shift"];
      if (!drivingOwnCar && !trafficLockRef.current) {
        const hit = trafficCars.some(car => distance(playerX, playerY, car.x, car.y) < 50);
        if (hit) {
          trafficLockRef.current = true;
          keysRef.current = {};
          playTrafficAlert();
          playerX = lastSafeRef.current.x;
          playerY = lastSafeRef.current.y;
          setSave(current => ({ ...current, playerX, playerY }));
          setTrafficFeedback("");
          setTrafficChallenge((Math.floor(time / 1000) + level) % TRAFFIC_COMPREHENSION.length);
        }
      }

      NPCS.forEach((npc, i) => {
        const bobX = Math.sin(time / 1200 + i) * 10;
        const bobY = Math.cos(time / 1500 + i) * 7;
        drawPerson(ctx, npc.x + bobX, npc.y + bobY, .82, {
          skin: i % 2 ? "#b97952" : "#8f5b3d",
          hair: i % 3 ? "#26140d" : "#4b2c1d",
          shirt: npc.shirt,
          pants: "#334155",
        }, 1, true);
        ctx.font = "800 15px system-ui";
        ctx.fillStyle = "rgba(15,23,42,.8)";
        ctx.textAlign = "center";
        ctx.fillText(npc.name, npc.x + bobX, npc.y + bobY - 58);
      });

      if (save.carOwned && keys["shift"]) {
        drawCar(ctx, playerX, playerY + 5, "#2563eb", 0, 1.12);
      } else {
        drawPerson(ctx, playerX, playerY, 1.05, AVATARS[save.avatar], direction, isMoving);
      }

      ctx.restore();

      let closestPlace: Building | null = null;
      let closestPlaceDist = Infinity;
      BUILDINGS.forEach(b => {
        const doorX = b.x + b.w / 2;
        const doorY = b.y + b.h + 20;
        const d = distance(playerX, playerY, doorX, doorY);
        if (d < closestPlaceDist) {
          closestPlaceDist = d;
          closestPlace = b;
        }
      });
      const nextPlace = closestPlaceDist < 140 ? closestPlace : null;
      if ((nextPlace?.id || null) !== (nearPlace?.id || null)) setNearPlace(nextPlace);

      let closestNpc: (typeof NPCS)[number] | null = null;
      let closestNpcDist = Infinity;
      NPCS.forEach(npc => {
        const d = distance(playerX, playerY, npc.x, npc.y);
        if (d < closestNpcDist) {
          closestNpcDist = d;
          closestNpc = npc;
        }
      });
      const nextNpc = closestNpcDist < 90 ? closestNpc : null;
      if ((nextNpc?.name || null) !== (nearNpc?.name || null)) setNearNpc(nextNpc);

      if (time - lastPositionSave > 1200) {
        lastPositionSave = time;
        setSave(current => {
          if (Math.abs(current.playerX - playerX) < 2 && Math.abs(current.playerY - playerY) < 2) return current;
          return { ...current, playerX, playerY };
        });
      }

      frameRef.current = requestAnimationFrame(render);
    };

    frameRef.current = requestAnimationFrame(render);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
      setSave(current => ({ ...current, playerX, playerY }));
    };
  }, [screen, save.avatar, save.carOwned]);

  const startNewGame = () => {
    const next: GameSave = { ...freshSave(), started: true, avatar, career, playerX: 850, playerY: 760 };
    setSave(next);
    setScreen("city");
  };

  const interact = () => {
    startTrafficAudio();
    if (modal || trafficChallenge !== null || transitionLabel) return;
    if (nearNpc) {
      setSelectedNpc(nearNpc);
      setModal("npc");
      return;
    }
    if (nearPlace) enterBuilding(nearPlace);
  };

  const chooseTrafficAnswer = (choice: number) => {
    if (trafficChallenge === null) return;
    const challenge = TRAFFIC_COMPREHENSION[trafficChallenge];
    if (choice !== challenge.answer) {
      setTrafficFeedback("Not quite. Read the passage again and use the details to try another answer.");
      return;
    }
    setTrafficFeedback(`Correct. ${challenge.explanation}`);
    setSave(current => ({ ...current, xp: current.xp + 20 }));
    window.setTimeout(() => {
      setTrafficChallenge(null);
      setTrafficFeedback("");
      trafficLockRef.current = false;
      setNotice("Safe again. +20 XP for reading carefully.");
      window.setTimeout(() => setNotice(""), 2200);
    }, 700);
  };

  const chooseLibraryAnswer = (choice: number) => {
    const challenge = LIBRARY_COMPREHENSION[libraryChallenge];
    if (choice !== challenge.answer) {
      setLibraryFeedback("Look back at the passage. Which answer is supported by what you actually read?");
      return;
    }
    setLibraryFeedback(`Correct. ${challenge.explanation}`);
    setSave(current => ({ ...current, xp: current.xp + 50 }));
    window.setTimeout(() => {
      setModal(null);
      setLibraryFeedback("");
      setNotice("Reading challenge complete! +50 XP.");
      window.setTimeout(() => setNotice(""), 2400);
    }, 750);
  };

  const chooseInterview = (choice: number) => {
    const correct = choice === INTERVIEW_QUESTIONS[interviewIndex].answer;
    const nextScore = interviewScore + (correct ? 1 : 0);
    if (interviewIndex < INTERVIEW_QUESTIONS.length - 1) {
      setInterviewScore(nextScore);
      setInterviewIndex(index => index + 1);
      return;
    }

    const passed = nextScore >= 2;
    if (passed) {
      setSave(current => ({
        ...current,
        hired: true,
        interviewPassed: true,
        money: current.money + 100,
        xp: current.xp + 100,
      }));
      setNotice("You got the job! +$100 signing bonus and +100 XP.");
    } else {
      setNotice("Good practice. Try the interview again when you're ready.");
    }
    setModal(null);
    window.setTimeout(() => setNotice(""), 3000);
  };

  const chooseWork = (choice: number) => {
    const tasks = WORK_TASKS[save.career];
    const correct = choice === tasks[workIndex].answer;
    const nextScore = workScore + (correct ? 1 : 0);

    if (workIndex < tasks.length - 1) {
      setWorkScore(nextScore);
      setWorkIndex(index => index + 1);
      return;
    }

    const bonus = nextScore === 3 ? 60 : nextScore === 2 ? 30 : 0;
    const pay = careerInfo.pay + bonus;
    setSave(current => ({
      ...current,
      money: current.money + pay,
      xp: current.xp + 80 + nextScore * 20,
      shiftsWorked: current.shiftsWorked + 1,
    }));
    setNotice(`Shift complete! +$${pay} and +${80 + nextScore * 20} XP.`);
    setModal(null);
    window.setTimeout(() => setNotice(""), 3000);
  };

  const buyItem = (name: string, price: number) => {
    if (save.inventory.includes(name)) return;
    if (save.money < price) {
      setNotice("You need more money for that.");
      window.setTimeout(() => setNotice(""), 2200);
      return;
    }
    setSave(current => ({
      ...current,
      money: current.money - price,
      xp: current.xp + 15,
      inventory: [...current.inventory, name],
    }));
  };

  if (screen === "setup") {
    return (
      <div className="min-h-screen bg-[#07111f] text-white">
        <style>{cityStyles}</style>
        <div className="max-w-7xl mx-auto px-4 sm:px-7 py-6 sm:py-10">
          <button type="button" onClick={() => navigate("/eye-gaze-games")} className="mb-6 min-h-[48px] px-4 rounded-2xl bg-white/10 border border-white/10 font-black flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" /> Games
          </button>

          <div className="relative overflow-hidden rounded-[2.5rem] min-h-[330px] border border-white/10 shadow-2xl city-hero p-6 sm:p-10 flex items-center">
            <div className="absolute inset-0 city-grid opacity-30" />
            <div className="absolute -right-16 -bottom-16 w-[430px] h-[430px] rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="relative max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-300/15 border border-cyan-200/20 px-4 py-2 text-xs font-black uppercase tracking-[.2em] text-cyan-200">
                <Sparkles className="w-4 h-4" /> New Flagship Game
              </div>
              <h1 className="mt-5 text-4xl sm:text-6xl lg:text-7xl font-black leading-[.95]">A.R.I.S.E. CITY</h1>
              <p className="mt-5 text-lg sm:text-2xl text-slate-200 font-bold max-w-2xl">
                Build a life. Pick a career. Explore the city. Work, earn, level up, shop, drive, and build your future.
              </p>
            </div>
          </div>

          <section className="mt-7 rounded-[2rem] bg-white/5 border border-white/10 p-5 sm:p-7">
            <div className="flex items-center gap-3 mb-5">
              <UserRound className="w-7 h-7 text-cyan-300" />
              <div>
                <h2 className="text-2xl font-black">Choose your character</h2>
                <p className="text-sm text-slate-400 font-semibold">This is who you will control in the city.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(Object.keys(AVATARS) as AvatarId[]).map(id => {
                const a = AVATARS[id];
                return (
                  <button key={id} type="button" onClick={() => setAvatar(id)} className={`relative min-h-[150px] rounded-3xl border-2 p-4 text-left transition-all ${avatar === id ? "border-cyan-300 bg-cyan-300/10 -translate-y-1 shadow-xl" : "border-white/10 bg-white/5 hover:border-white/30"}`}>
                    <div className="w-16 h-16 rounded-full mb-3 border-4 border-white/80" style={{ background: a.skin, boxShadow: `inset 0 -20px 0 ${a.shirt}` }} />
                    <div className="text-xl font-black">{a.name}</div>
                    {avatar === id && <CheckCircle2 className="absolute top-4 right-4 w-6 h-6 text-cyan-300" />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-5 rounded-[2rem] bg-white/5 border border-white/10 p-5 sm:p-7">
            <div className="flex items-center gap-3 mb-5">
              <BriefcaseBusiness className="w-7 h-7 text-violet-300" />
              <div>
                <h2 className="text-2xl font-black">Choose a career path</h2>
                <p className="text-sm text-slate-400 font-semibold">You can interview, get hired, work shifts, and level up in this field.</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(Object.keys(CAREERS) as CareerId[]).map(id => {
                const c = CAREERS[id];
                return (
                  <button key={id} type="button" onClick={() => setCareer(id)} className={`relative min-h-[150px] rounded-3xl border-2 p-5 text-left transition-all ${career === id ? "border-violet-300 bg-violet-300/10 -translate-y-1 shadow-xl" : "border-white/10 bg-white/5 hover:border-white/30"}`}>
                    <div className="text-4xl">{c.icon}</div>
                    <div className="mt-3 text-xl font-black">{c.name}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-400">{c.description}</div>
                    {career === id && <CheckCircle2 className="absolute top-4 right-4 w-6 h-6 text-violet-300" />}
                  </button>
                );
              })}
            </div>
          </section>

          <button type="button" onClick={startNewGame} className="mt-6 w-full min-h-[76px] rounded-[1.7rem] bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-600 text-white text-xl sm:text-2xl font-black shadow-2xl hover:-translate-y-1 transition-transform">
            Enter A.R.I.S.E. City →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] bg-[#07111f] text-white overflow-hidden">
      <style>{cityStyles}</style>

      {screen === "city" && (
        <div ref={wrapRef} className="absolute inset-0">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 pointer-events-none city-vignette" />
        </div>
      )}

      {screen === "interior" && insidePlace && (
        <ARISECityInterior
          place={insidePlace}
          avatar={AVATARS[save.avatar]}
          careerWorkplace={careerInfo.workplace}
          hired={save.hired}
          disabled={!!modal || !!transitionLabel}
          onAction={handleInteriorAction}
          onExit={exitBuilding}
        />
      )}

      <div className="absolute z-[125] top-3 left-3 right-3 flex items-start gap-2 sm:gap-3 pointer-events-none">
        <button type="button" onClick={() => navigate("/eye-gaze-games")} className="pointer-events-auto min-h-[48px] px-3 sm:px-4 rounded-2xl bg-slate-950/80 backdrop-blur border border-white/15 font-black flex items-center gap-2 shadow-xl">
          <ArrowLeft className="w-5 h-5" /> <span className="hidden sm:inline">Games</span>
        </button>

        <div className="pointer-events-auto rounded-2xl bg-slate-950/80 backdrop-blur border border-white/15 px-3 sm:px-4 py-2 shadow-xl">
          <div className="text-[10px] uppercase tracking-widest text-cyan-300 font-black">Level {level}</div>
          <div className="font-black text-sm sm:text-base">{AVATARS[save.avatar].name} · {careerInfo.name}</div>
        </div>

        <div className="hidden md:block flex-1 max-w-md rounded-2xl bg-slate-950/80 backdrop-blur border border-white/15 px-4 py-3 shadow-xl">
          <div className="flex items-center justify-between text-xs font-black mb-1.5">
            <span>XP {save.xp}</span>
            <span>Next {xpForNext(level)}</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-300 to-violet-400" style={{ width: `${Math.min(100, ((save.xp - (level - 1) * 250) / 250) * 100)}%` }} />
          </div>
        </div>

        <div className="ml-auto pointer-events-auto flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (ambientEnabled) {
                setAmbientEnabled(false);
                stopTrafficAudio();
              } else {
                setAmbientEnabled(true);
                window.setTimeout(() => startTrafficAudio(), 0);
              }
            }}
            className="w-12 rounded-2xl bg-slate-950/80 backdrop-blur border border-white/15 flex items-center justify-center shadow-xl"
            aria-label={ambientEnabled ? "Mute city sounds" : "Turn on city sounds"}
          >
            {ambientEnabled ? <Volume2 className="w-5 h-5 text-cyan-300" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
          </button>
          <div className="rounded-2xl bg-slate-950/80 backdrop-blur border border-white/15 px-3 sm:px-4 py-3 font-black shadow-xl flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-300" /> ${save.money}
          </div>
          <div className="hidden sm:flex rounded-2xl bg-slate-950/80 backdrop-blur border border-white/15 px-3 py-3 font-black shadow-xl items-center gap-2">
            {save.carOwned ? <Car className="w-5 h-5 text-cyan-300" /> : <Home className="w-5 h-5 text-violet-300" />}
            {save.carOwned ? "Car" : save.homeOwned ? "Home" : "Starter"}
          </div>
        </div>
      </div>

      <div className="absolute z-[125] top-24 left-3 pointer-events-none">
        <div className="rounded-2xl bg-slate-950/75 backdrop-blur border border-white/10 p-3 shadow-xl max-w-[240px]">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Mission</div>
          <div className="mt-1 font-black text-sm">
            {!save.hired ? "Visit the Career Center and pass your interview." : !save.carOwned ? `Work at ${BUILDINGS.find(b => b.type === careerInfo.workplace)?.label} and save for a car.` : !save.homeOwned ? "Keep working and save for a home." : "Build your city life and keep leveling up."}
          </div>
        </div>
      </div>

      {notice && (
        <div className="absolute z-[135] top-24 left-1/2 -translate-x-1/2 rounded-2xl bg-white text-slate-900 shadow-2xl border border-white px-5 py-3 font-black text-center max-w-[90vw]">
          {notice}
        </div>
      )}

      {screen === "city" && (nearPlace || nearNpc) && !modal && trafficChallenge === null && (
        <button type="button" onClick={interact} className="absolute z-[128] bottom-28 sm:bottom-8 left-1/2 -translate-x-1/2 min-h-[58px] px-6 rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-500 text-white font-black text-lg shadow-2xl border-2 border-white/60 animate-pulse">
          {nearNpc ? `Talk to ${nearNpc.name}` : `Enter ${nearPlace?.label}`} <span className="hidden sm:inline text-white/70 ml-2">[E]</span>
        </button>
      )}

      {screen === "city" && (
        <div className="absolute z-[127] bottom-3 left-3 sm:hidden grid grid-cols-3 gap-2">
          <div />
          <button className="touch-control" onPointerDown={() => { startTrafficAudio(); keysRef.current["w"] = true; }} onPointerUp={() => (keysRef.current["w"] = false)} onPointerCancel={() => (keysRef.current["w"] = false)}>▲</button>
          <div />
          <button className="touch-control" onPointerDown={() => { startTrafficAudio(); keysRef.current["a"] = true; }} onPointerUp={() => (keysRef.current["a"] = false)} onPointerCancel={() => (keysRef.current["a"] = false)}>◀</button>
          <button className="touch-control" onPointerDown={() => { startTrafficAudio(); keysRef.current["s"] = true; }} onPointerUp={() => (keysRef.current["s"] = false)} onPointerCancel={() => (keysRef.current["s"] = false)}>▼</button>
          <button className="touch-control" onPointerDown={() => { startTrafficAudio(); keysRef.current["d"] = true; }} onPointerUp={() => (keysRef.current["d"] = false)} onPointerCancel={() => (keysRef.current["d"] = false)}>▶</button>
        </div>
      )}

      {screen === "city" && <div className="hidden sm:block absolute z-[126] bottom-4 right-4 rounded-2xl bg-slate-950/70 backdrop-blur border border-white/10 px-4 py-3 text-xs font-bold text-slate-300">
        Move: WASD / Arrow Keys · Interact: E {save.carOwned && "· Hold Shift to drive"}
      </div>}

      {transitionLabel && (
        <div className="absolute inset-0 z-[160] bg-slate-950 flex items-center justify-center transition-screen">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto rounded-full border-4 border-white/25 border-t-cyan-300 animate-spin" />
            <div className="mt-5 text-xl sm:text-2xl font-black">{transitionLabel}</div>
          </div>
        </div>
      )}

      {trafficChallenge !== null && (
        <div className="fixed inset-0 z-[155] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white text-slate-900 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-5 sm:px-7 py-5">
              <div className="text-xs uppercase tracking-[.2em] font-black">Traffic Safety · Reading Comprehension</div>
              <h2 className="mt-1 text-2xl sm:text-3xl font-black">Pause. Read. Think.</h2>
              <p className="mt-1 text-white/90 font-semibold">Your character is okay. Answer correctly to continue exploring.</p>
            </div>
            <div className="p-5 sm:p-7">
              <div className="rounded-3xl bg-slate-50 border-2 border-slate-100 p-5 text-base sm:text-lg font-semibold leading-relaxed">
                {TRAFFIC_COMPREHENSION[trafficChallenge].passage}
              </div>
              <div className="mt-5 text-xl font-black">{TRAFFIC_COMPREHENSION[trafficChallenge].q}</div>
              <div className="mt-4 space-y-3">
                {TRAFFIC_COMPREHENSION[trafficChallenge].choices.map((choice, index) => (
                  <button key={choice} type="button" onClick={() => chooseTrafficAnswer(index)} className="w-full min-h-[60px] rounded-2xl border-2 border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50 px-4 text-left font-black">
                    {choice}
                  </button>
                ))}
              </div>
              {trafficFeedback && <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 font-bold text-amber-900">{trafficFeedback}</div>}
            </div>
          </div>
        </div>
      )}

      {modal === "npc" && selectedNpc && (
        <GameModal title={selectedNpc.name} subtitle="Community resident" onClose={() => setModal(null)}>
          <div className="rounded-3xl bg-sky-50 border border-sky-100 p-5 text-lg font-bold leading-relaxed">“{selectedNpc.line}”</div>
          <button type="button" onClick={() => { setModal(null); addMoneyXp(0, 5, "+5 XP for connecting with your community."); }} className="mt-5 w-full min-h-[58px] rounded-2xl bg-slate-900 text-white font-black">Thanks!</button>
        </GameModal>
      )}

      {modal === "interview" && (
        <GameModal title="Career Center Interview" subtitle={save.hired ? "Practice again or strengthen your skills." : `Interview for your ${careerInfo.name} career path.`} onClose={() => setModal(null)}>
          <div className="mb-4 text-sm font-black text-violet-600 uppercase tracking-widest">Question {interviewIndex + 1} of {INTERVIEW_QUESTIONS.length}</div>
          <div className="text-xl sm:text-2xl font-black leading-tight">{INTERVIEW_QUESTIONS[interviewIndex].q}</div>
          <div className="mt-5 space-y-3">
            {INTERVIEW_QUESTIONS[interviewIndex].choices.map((choice, index) => (
              <button key={choice} type="button" onClick={() => chooseInterview(index)} className="w-full min-h-[62px] rounded-2xl border-2 border-slate-200 bg-slate-50 hover:border-violet-400 hover:bg-violet-50 px-4 text-left font-black">
                {choice}
              </button>
            ))}
          </div>
        </GameModal>
      )}

      {modal === "work" && (
        <GameModal title={`${careerInfo.name} Work Shift`} subtitle={`Base pay: $${careerInfo.pay}. Strong performance earns a bonus.`} onClose={() => setModal(null)}>
          <div className="mb-4 text-sm font-black text-cyan-700 uppercase tracking-widest">Task {workIndex + 1} of {WORK_TASKS[save.career].length}</div>
          <div className="text-xl sm:text-2xl font-black leading-tight">{WORK_TASKS[save.career][workIndex].q}</div>
          <div className="mt-5 space-y-3">
            {WORK_TASKS[save.career][workIndex].choices.map((choice, index) => (
              <button key={choice} type="button" onClick={() => chooseWork(index)} className="w-full min-h-[62px] rounded-2xl border-2 border-slate-200 bg-slate-50 hover:border-cyan-400 hover:bg-cyan-50 px-4 text-left font-black">
                {choice}
              </button>
            ))}
          </div>
        </GameModal>
      )}

      {modal === "store" && (
        <GameModal title="Central Shops" subtitle="Spend your earned money on items for your character." onClose={() => setModal(null)}>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              ["Fresh Sneakers", 90, "👟"],
              ["City Backpack", 70, "🎒"],
              ["Headphones", 120, "🎧"],
              ["Tablet", 240, "📱"],
              ["Bike", 320, "🚲"],
              ["Game Console", 450, "🎮"],
            ].map(([name, price, icon]) => {
              const owned = save.inventory.includes(String(name));
              return (
                <button key={String(name)} type="button" disabled={owned} onClick={() => buyItem(String(name), Number(price))} className="rounded-3xl border-2 border-slate-200 bg-slate-50 p-5 text-left disabled:opacity-60">
                  <div className="text-4xl">{icon}</div>
                  <div className="mt-3 text-lg font-black">{name}</div>
                  <div className="text-sm font-bold text-slate-500 mt-1">{owned ? "Owned" : `$${price}`}</div>
                </button>
              );
            })}
          </div>
        </GameModal>
      )}

      {modal === "dealer" && (
        <GameModal title="Metro Motors" subtitle="A car makes it much faster to cross the city." onClose={() => setModal(null)}>
          <div className="rounded-[2rem] bg-gradient-to-br from-slate-900 to-blue-950 text-white p-6">
            <div className="text-7xl">🚙</div>
            <h3 className="mt-4 text-2xl font-black">Metro Compact</h3>
            <p className="mt-2 text-slate-300 font-semibold">Safe, efficient, and perfect for getting to work.</p>
            <div className="mt-5 text-3xl font-black">$650</div>
          </div>
          <button type="button" disabled={save.carOwned} onClick={() => {
            if (save.money < 650) {
              setNotice("You need $650 to buy the car.");
              return;
            }
            setSave(current => ({ ...current, carOwned: true, money: current.money - 650, xp: current.xp + 100 }));
            setModal(null);
            setNotice("You bought your first car! Hold Shift while moving to drive.");
            window.setTimeout(() => setNotice(""), 3200);
          }} className="mt-4 w-full min-h-[60px] rounded-2xl bg-blue-600 text-white font-black disabled:opacity-50">
            {save.carOwned ? "Already Owned" : "Buy Car"}
          </button>
        </GameModal>
      )}

      {modal === "home" && (
        <GameModal title="Maple Homes" subtitle="Own a place in the community and build long-term progress." onClose={() => setModal(null)}>
          <div className="rounded-[2rem] overflow-hidden bg-gradient-to-br from-emerald-50 to-sky-100 border border-emerald-100 p-6">
            <div className="text-7xl">🏡</div>
            <h3 className="mt-4 text-2xl font-black">Starter Townhome</h3>
            <p className="mt-2 text-slate-600 font-semibold">A comfortable first home near the park and library.</p>
            <div className="mt-5 text-3xl font-black">$1,500</div>
          </div>
          <button type="button" disabled={save.homeOwned} onClick={() => {
            if (save.money < 1500) {
              setNotice("You need $1,500 to buy the home.");
              return;
            }
            setSave(current => ({ ...current, homeOwned: true, money: current.money - 1500, xp: current.xp + 200 }));
            setModal(null);
            setNotice("You bought your first home! +200 XP.");
            window.setTimeout(() => setNotice(""), 3000);
          }} className="mt-4 w-full min-h-[60px] rounded-2xl bg-emerald-600 text-white font-black disabled:opacity-50">
            {save.homeOwned ? "Home Owned" : "Buy Home"}
          </button>
        </GameModal>
      )}

      {modal === "library" && (
        <GameModal title="City Library Reading Challenge" subtitle="Read the passage and use evidence from the text." onClose={() => setModal(null)}>
          <div className="rounded-3xl bg-violet-50 border-2 border-violet-100 p-5">
            <BookOpen className="w-10 h-10 text-violet-600" />
            <div className="mt-3 text-base sm:text-lg font-semibold leading-relaxed text-slate-700">
              {LIBRARY_COMPREHENSION[libraryChallenge].passage}
            </div>
          </div>
          <div className="mt-5 text-xl sm:text-2xl font-black">{LIBRARY_COMPREHENSION[libraryChallenge].q}</div>
          <div className="mt-4 space-y-3">
            {LIBRARY_COMPREHENSION[libraryChallenge].choices.map((choice, index) => (
              <button key={choice} type="button" onClick={() => chooseLibraryAnswer(index)} className="w-full min-h-[60px] rounded-2xl border-2 border-slate-200 bg-slate-50 hover:border-violet-400 hover:bg-violet-50 px-4 text-left font-black">
                {choice}
              </button>
            ))}
          </div>
          {libraryFeedback && <div className="mt-4 rounded-2xl bg-violet-50 border border-violet-200 p-4 font-bold text-violet-900">{libraryFeedback}</div>}
        </GameModal>
      )}

      {modal === "bank" && (
        <GameModal title="Community Bank" subtitle="See the financial progress you have built." onClose={() => setModal(null)}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-3xl bg-emerald-50 border border-emerald-100 p-5">
              <div className="text-sm font-black uppercase tracking-widest text-emerald-700">Cash</div>
              <div className="mt-2 text-4xl font-black">${save.money}</div>
            </div>
            <div className="rounded-3xl bg-sky-50 border border-sky-100 p-5">
              <div className="text-sm font-black uppercase tracking-widest text-sky-700">Work Shifts</div>
              <div className="mt-2 text-4xl font-black">{save.shiftsWorked}</div>
            </div>
            <div className="rounded-3xl bg-violet-50 border border-violet-100 p-5">
              <div className="text-sm font-black uppercase tracking-widest text-violet-700">Car</div>
              <div className="mt-2 text-xl font-black">{save.carOwned ? "Owned" : "Not yet"}</div>
            </div>
            <div className="rounded-3xl bg-amber-50 border border-amber-100 p-5">
              <div className="text-sm font-black uppercase tracking-widest text-amber-700">Home</div>
              <div className="mt-2 text-xl font-black">{save.homeOwned ? "Owned" : "Not yet"}</div>
            </div>
          </div>
        </GameModal>
      )}
    </div>
  );
}

const cityStyles = `
  .city-hero {
    background:
      radial-gradient(circle at 80% 20%, rgba(34,211,238,.25), transparent 26%),
      radial-gradient(circle at 65% 80%, rgba(139,92,246,.3), transparent 32%),
      linear-gradient(135deg,#081426 0%,#102a55 48%,#2e1065 100%);
  }
  .city-grid {
    background-image:
      linear-gradient(rgba(255,255,255,.12) 1px,transparent 1px),
      linear-gradient(90deg,rgba(255,255,255,.12) 1px,transparent 1px);
    background-size:42px 42px;
    transform:perspective(600px) rotateX(58deg) scale(1.8);
    transform-origin:bottom;
  }
  .city-vignette {
    box-shadow:inset 0 0 140px rgba(2,6,23,.32);
  }
  .transition-screen {
    animation:cityFadeIn .42s ease both;
  }
  @keyframes cityFadeIn {
    from { opacity:0; }
    to { opacity:1; }
  }
  .touch-control {
    width:54px;
    height:54px;
    border-radius:18px;
    background:rgba(2,6,23,.72);
    border:1px solid rgba(255,255,255,.18);
    color:white;
    font-size:20px;
    font-weight:900;
    backdrop-filter:blur(10px);
    box-shadow:0 8px 24px rgba(2,6,23,.3);
    touch-action:none;
  }
`;

function CheckCircle2(props: React.ComponentProps<"svg"> & { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function BookOpen(props: React.ComponentProps<"svg"> & { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
