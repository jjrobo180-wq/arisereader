import { useEffect, useMemo, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  Gauge,
  Headphones,
  LockKeyhole,
  Search,
  Sparkles,
  Star,
  Target,
  Trophy,
  Volume2,
  Zap,
} from "lucide-react";

type TrackId = "decode" | "fluency" | "vocab" | "comprehension" | "choice";
type Difficulty = 1 | 2 | 3;

type Progress = {
  xp: number;
  completed: Record<string, boolean>;
  trackXp: Record<TrackId, number>;
  streak: number;
  lastDay: string;
  fluencyBest: Record<string, number>;
  choiceMinutes: number;
};

type Mission = {
  id: string;
  track: TrackId;
  title: string;
  subtitle: string;
  difficulty: Difficulty;
  xp: number;
};

const TRACKS: Record<TrackId, {
  name: string;
  icon: string;
  tagline: string;
  gradient: string;
  ring: string;
}> = {
  decode: {
    name: "Decode Lab",
    icon: "🔓",
    tagline: "Crack unfamiliar words instead of guessing.",
    gradient: "from-cyan-500 to-blue-600",
    ring: "border-cyan-300",
  },
  fluency: {
    name: "Fluency Sprint",
    icon: "⚡",
    tagline: "Build smoother, more natural reading.",
    gradient: "from-amber-400 to-orange-600",
    ring: "border-amber-300",
  },
  vocab: {
    name: "Word Detective",
    icon: "🕵️",
    tagline: "Use clues around a word to figure it out.",
    gradient: "from-violet-500 to-fuchsia-600",
    ring: "border-violet-300",
  },
  comprehension: {
    name: "Meaning Missions",
    icon: "🧠",
    tagline: "Find evidence, main ideas, and hidden meaning.",
    gradient: "from-emerald-500 to-teal-600",
    ring: "border-emerald-300",
  },
  choice: {
    name: "Your Reading",
    icon: "📚",
    tagline: "Practice with topics and books you actually like.",
    gradient: "from-rose-500 to-pink-600",
    ring: "border-rose-300",
  },
};

const MISSIONS: Mission[] = [
  { id: "decode-1", track: "decode", title: "Word Parts", subtitle: "Break longer words into smaller pieces.", difficulty: 1, xp: 40 },
  { id: "decode-2", track: "decode", title: "Vowel Power", subtitle: "Use vowel patterns to unlock unfamiliar words.", difficulty: 2, xp: 55 },
  { id: "decode-3", track: "decode", title: "Big Word Breaker", subtitle: "Decode multisyllable middle-school words.", difficulty: 3, xp: 75 },

  { id: "fluency-1", track: "fluency", title: "Smooth Read", subtitle: "Read the same short passage three times.", difficulty: 1, xp: 40 },
  { id: "fluency-2", track: "fluency", title: "Phrase Power", subtitle: "Practice reading in meaningful groups of words.", difficulty: 2, xp: 55 },
  { id: "fluency-3", track: "fluency", title: "Beat Your Best", subtitle: "Improve your pace without losing meaning.", difficulty: 3, xp: 75 },

  { id: "vocab-1", track: "vocab", title: "Context Clues", subtitle: "Use nearby words to figure out meaning.", difficulty: 1, xp: 40 },
  { id: "vocab-2", track: "vocab", title: "Word Families", subtitle: "Use roots, prefixes, and suffixes.", difficulty: 2, xp: 55 },
  { id: "vocab-3", track: "vocab", title: "Academic Vocabulary", subtitle: "Practice words used across school subjects.", difficulty: 3, xp: 75 },

  { id: "comprehension-1", track: "comprehension", title: "Find the Evidence", subtitle: "Answer using details directly from the text.", difficulty: 1, xp: 40 },
  { id: "comprehension-2", track: "comprehension", title: "Main Idea Mission", subtitle: "Separate the big idea from smaller details.", difficulty: 2, xp: 55 },
  { id: "comprehension-3", track: "comprehension", title: "Inference Challenge", subtitle: "Combine text clues with what you already know.", difficulty: 3, xp: 75 },

  { id: "choice-1", track: "choice", title: "Pick Your Topic", subtitle: "Choose something you actually want to read.", difficulty: 1, xp: 30 },
  { id: "choice-2", track: "choice", title: "10-Minute Read", subtitle: "Build stamina with a short independent read.", difficulty: 2, xp: 45 },
  { id: "choice-3", track: "choice", title: "Book Mission", subtitle: "Read, summarize, and make a connection.", difficulty: 3, xp: 65 },
];

const DEFAULT_PROGRESS: Progress = {
  xp: 0,
  completed: {},
  trackXp: { decode: 0, fluency: 0, vocab: 0, comprehension: 0, choice: 0 },
  streak: 0,
  lastDay: "",
  fluencyBest: {},
  choiceMinutes: 0,
};

const decodeData = {
  "decode-1": {
    intro: "Long words get easier when you split them into parts.",
    items: [
      { word: "reusable", parts: ["re", "use", "able"], prompt: "Which split helps you decode reusable?", choices: ["re / use / able", "reu / sa / ble", "r / eusab / le"], answer: 0 },
      { word: "disagreement", parts: ["dis", "agree", "ment"], prompt: "Which split helps you decode disagreement?", choices: ["dis / agree / ment", "disa / gree / ment", "di / sagree / ment"], answer: 0 },
      { word: "unpredictable", parts: ["un", "pre", "dict", "able"], prompt: "Which word part means 'not'?", choices: ["un", "dict", "able"], answer: 0 },
    ],
  },
  "decode-2": {
    intro: "Vowel patterns often tell you how a word sounds.",
    items: [
      { word: "remain", parts: ["re", "main"], prompt: "Which word has the same long-A pattern as remain?", choices: ["train", "ran", "trim"], answer: 0 },
      { word: "complete", parts: ["com", "plete"], prompt: "Which final pattern helps the second part sound like 'pleet'?", choices: ["silent e", "double consonant", "short vowel"], answer: 0 },
      { word: "coach", parts: ["coach"], prompt: "Which word uses a similar vowel team?", choices: ["road", "rod", "red"], answer: 0 },
    ],
  },
  "decode-3": {
    intro: "Use prefixes, roots, suffixes, and syllables to attack bigger words.",
    items: [
      { word: "miscommunication", parts: ["mis", "com", "mun", "i", "ca", "tion"], prompt: "Which beginning part means wrong or badly?", choices: ["mis", "com", "tion"], answer: 0 },
      { word: "transportation", parts: ["trans", "por", "ta", "tion"], prompt: "Which ending often turns a verb into a noun?", choices: ["tion", "trans", "por"], answer: 0 },
      { word: "independently", parts: ["in", "de", "pend", "ent", "ly"], prompt: "What is the best first move when this word feels hard?", choices: ["Break it into parts", "Skip every long word", "Guess from the first letter"], answer: 0 },
    ],
  },
} as const;

const fluencyData = {
  "fluency-1": {
    passage: "The gym was almost empty after school. Marcus stayed behind to practice his free throws. At first, most of his shots hit the rim. He slowed down, checked his form, and tried again. By the end of practice, his shots felt smoother and more controlled.",
    focus: "Read it three times. Aim for smooth—not rushed.",
  },
  "fluency-2": {
    passage: "When the storm knocked out power, / the apartment building became unusually quiet. / Neighbors stepped into the hallway / and checked on one another. / Someone brought flashlights, / while another person shared phone chargers / connected to a battery pack.",
    focus: "Pause slightly at each slash. Read groups of words together.",
  },
  "fluency-3": {
    passage: "Scientists often repeat an experiment because one result may not tell the whole story. Repeating the same procedure can reveal patterns, mistakes, or unexpected changes. Strong evidence becomes more convincing when similar results appear again and again.",
    focus: "Keep the meaning clear while trying to improve your pace.",
  },
} as const;

const vocabData = {
  "vocab-1": [
    {
      sentence: "The hallway was usually loud, but after the final bell it became deserted. Only one custodian remained.",
      q: "What does deserted most likely mean?",
      choices: ["mostly empty", "very colorful", "dangerous"],
      answer: 0,
      clue: "The clue says only one person remained.",
    },
    {
      sentence: "Imani was reluctant to speak first, so she waited until two other students shared their ideas.",
      q: "What does reluctant most likely mean?",
      choices: ["unsure or unwilling", "extremely loud", "completely prepared"],
      answer: 0,
      clue: "Waiting for others shows she was hesitant.",
    },
    {
      sentence: "The coach gave a brief explanation, lasting less than one minute.",
      q: "What does brief mean?",
      choices: ["short", "confusing", "angry"],
      answer: 0,
      clue: "Less than one minute is a direct clue.",
    },
  ],
  "vocab-2": [
    {
      sentence: "The word preview contains the prefix pre-, meaning before.",
      q: "What does preview mean?",
      choices: ["see beforehand", "see incorrectly", "see again afterward"],
      answer: 0,
      clue: "pre- means before + view means see.",
    },
    {
      sentence: "In the word careless, the suffix -less means without.",
      q: "What does careless most nearly mean?",
      choices: ["without enough care", "full of care", "able to care"],
      answer: 0,
      clue: "care + less = without care.",
    },
    {
      sentence: "The root struct means build. Construct and structure use this root.",
      q: "Which idea connects construct and structure?",
      choices: ["building", "hearing", "moving"],
      answer: 0,
      clue: "The shared root carries the idea of building.",
    },
  ],
  "vocab-3": [
    {
      sentence: "The class analyzed the graph before making a conclusion.",
      q: "What does analyzed mean here?",
      choices: ["examined carefully", "copied quickly", "ignored"],
      answer: 0,
      clue: "You examine evidence before reaching a conclusion.",
    },
    {
      sentence: "The two articles had contrasting viewpoints: one supported the plan while the other opposed it.",
      q: "What does contrasting mean?",
      choices: ["different from each other", "exactly the same", "unfinished"],
      answer: 0,
      clue: "One supported the plan and the other opposed it.",
    },
    {
      sentence: "The evidence was sufficient to support the claim because several reliable sources reported the same result.",
      q: "What does sufficient mean?",
      choices: ["enough", "incorrect", "secret"],
      answer: 0,
      clue: "Several reliable sources provided enough support.",
    },
  ],
} as const;

const comprehensionData = {
  "comprehension-1": {
    passage: "On Tuesday, the student council placed three recycling bins in the cafeteria. By Friday, they had collected more than 200 plastic bottles. Council members plan to add bins near the gym next week.",
    questions: [
      { q: "Where were the first recycling bins placed?", choices: ["cafeteria", "gym", "library"], answer: 0 },
      { q: "What happened by Friday?", choices: ["More than 200 bottles were collected", "The bins were removed", "The gym closed"], answer: 0 },
      { q: "Which detail shows what will happen next?", choices: ["Bins will be added near the gym", "Tuesday came before Friday", "Students ate lunch"], answer: 0 },
    ],
  },
  "comprehension-2": {
    passage: "Many students use music while studying, but the type of task matters. Music with lyrics can compete with the words a student is trying to read or write. Instrumental music may be less distracting for some people. Other students focus best in silence. The most useful strategy is to notice which environment helps you stay focused and remember information.",
    questions: [
      { q: "What is the main idea?", choices: ["Different study tasks and students may need different sound environments", "Everyone should study with loud music", "Instrumental music always improves grades"], answer: 0 },
      { q: "Which detail supports the main idea?", choices: ["Lyrics can compete with words being read or written", "All music has lyrics", "Silence is impossible"], answer: 0 },
      { q: "What does the author suggest students do?", choices: ["Notice what helps them focus and remember", "Copy what every friend does", "Always use headphones"], answer: 0 },
    ],
  },
  "comprehension-3": {
    passage: "When the community center announced that its basketball court would close for repairs, several teens complained online. A week later, staff invited them to a planning meeting. The teens learned that the old floor had become unsafe and that the renovation would add better lighting and new hoops. They still disliked losing the court for a month, but several volunteered to help plan a reopening tournament.",
    questions: [
      { q: "Why did the teens' attitude begin to change?", choices: ["They learned why the repair was needed and what improvements were planned", "The center cancelled the repairs", "They stopped caring about basketball"], answer: 0 },
      { q: "What can you infer about the planning meeting?", choices: ["Having more information helped the teens see the situation differently", "The teens were forced to volunteer", "The repairs were unnecessary"], answer: 0 },
      { q: "Which detail best supports that inference?", choices: ["Several teens volunteered to help plan a reopening tournament", "The court would close for a month", "Some teens complained online"], answer: 0 },
    ],
  },
} as const;

function todayKey() {
  return new Date().toLocaleDateString("en-CA");
}

function loadProgress(key: string): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "{}");
    return {
      ...DEFAULT_PROGRESS,
      ...raw,
      completed: raw.completed || {},
      trackXp: { ...DEFAULT_PROGRESS.trackXp, ...(raw.trackXp || {}) },
      fluencyBest: raw.fluencyBest || {},
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function levelFromXp(xp: number) {
  return Math.floor(xp / 200) + 1;
}

function titleForLevel(level: number) {
  if (level >= 12) return "Reading Strategist";
  if (level >= 8) return "Meaning Master";
  if (level >= 5) return "Skill Builder";
  if (level >= 3) return "Word Breaker";
  return "Rising Reader";
}

function speakText(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = .92;
  window.speechSynthesis.speak(u);
}

function MissionShell({
  title,
  track,
  children,
  onBack,
}: {
  title: string;
  track: TrackId;
  children: React.ReactNode;
  onBack: () => void;
}) {
  const t = TRACKS[track];
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className={`bg-gradient-to-r ${t.gradient} px-4 sm:px-7 py-5 shadow-xl`}>
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <button onClick={onBack} className="min-h-[48px] px-4 rounded-2xl bg-black/20 border border-white/20 font-black flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          <div>
            <div className="text-xs uppercase tracking-[.2em] font-black text-white/70">{t.name}</div>
            <h1 className="text-2xl sm:text-3xl font-black">{title}</h1>
          </div>
        </div>
      </div>
      <main className="max-w-5xl mx-auto px-4 sm:px-7 py-7">{children}</main>
    </div>
  );
}

export default function ReadingLevelUp() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  if (user?.is_eye_gaze_user) return <Redirect to="/eye-gaze-home" />;

  const storageKey = `arise-reading-level-up-${user?.id || user?.username || "student"}`;
  const [progress, setProgress] = useState<Progress>(() => loadProgress(storageKey));
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [missionStep, setMissionStep] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [fluencyRound, setFluencyRound] = useState(1);
  const [fluencyStart, setFluencyStart] = useState<number | null>(null);
  const [fluencyTimes, setFluencyTimes] = useState<number[]>([]);
  const [choiceTopic, setChoiceTopic] = useState("");
  const [choiceMinutes, setChoiceMinutes] = useState(10);
  const [choiceReflection, setChoiceReflection] = useState("");

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(progress));
  }, [storageKey, progress]);

  useEffect(() => {
    if (!progress.lastDay) return;
    const today = todayKey();
    if (progress.lastDay === today) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toLocaleDateString("en-CA");
    if (progress.lastDay !== yesterdayKey && progress.streak !== 0) {
      setProgress(p => ({ ...p, streak: 0 }));
    }
  }, []);

  const currentLevel = levelFromXp(progress.xp);
  const nextLevelXp = currentLevel * 200;
  const currentLevelBase = (currentLevel - 1) * 200;
  const levelPct = Math.min(100, ((progress.xp - currentLevelBase) / 200) * 100);
  const completedCount = Object.values(progress.completed).filter(Boolean).length;

  const completeMission = (mission: Mission, earnedXp = mission.xp) => {
    const firstTime = !progress.completed[mission.id];
    const xpToAdd = firstTime ? earnedXp : Math.max(10, Math.round(earnedXp * .2));
    const today = todayKey();

    setProgress(p => {
      let streak = p.streak;
      if (p.lastDay !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = yesterday.toLocaleDateString("en-CA");
        streak = p.lastDay === yesterdayKey ? p.streak + 1 : 1;
      }
      return {
        ...p,
        xp: p.xp + xpToAdd,
        completed: { ...p.completed, [mission.id]: true },
        trackXp: { ...p.trackXp, [mission.track]: p.trackXp[mission.track] + xpToAdd },
        streak,
        lastDay: today,
      };
    });

    setFeedback(`Mission complete! +${xpToAdd} Reading XP`);
  };

  const resetMissionState = (mission: Mission) => {
    setActiveMission(mission);
    setMissionStep(0);
    setScore(0);
    setFeedback("");
    setFluencyRound(1);
    setFluencyStart(null);
    setFluencyTimes([]);
    setChoiceTopic("");
    setChoiceMinutes(10);
    setChoiceReflection("");
  };

  const finishAndReturn = () => {
    setActiveMission(null);
    setMissionStep(0);
    setFeedback("");
  };

  const answerObjective = (correct: boolean, totalSteps: number) => {
    if (feedback) return;
    const newScore = score + (correct ? 1 : 0);
    setScore(newScore);
    setFeedback(correct ? "Correct — nice work." : "Not quite. Use the clue or reread before moving on.");
    window.setTimeout(() => {
      setFeedback("");
      if (missionStep + 1 >= totalSteps) {
        if (activeMission) completeMission(activeMission, Math.max(20, Math.round(activeMission.xp * (newScore / totalSteps))));
      } else {
        setMissionStep(s => s + 1);
      }
    }, 850);
  };

  if (activeMission) {
    if (activeMission.track === "decode") {
      const data = decodeData[activeMission.id as keyof typeof decodeData];
      const item = data.items[Math.min(missionStep, data.items.length - 1)];
      const done = !!feedback && missionStep === data.items.length - 1;

      return (
        <MissionShell title={activeMission.title} track="decode" onBack={finishAndReturn}>
          <div className="rounded-[2rem] bg-white text-slate-900 p-5 sm:p-8 shadow-2xl">
            <div className="text-sm font-black text-cyan-700 uppercase tracking-widest">Strategy</div>
            <p className="mt-2 text-lg sm:text-xl font-bold text-slate-600">{data.intro}</p>

            <div className="mt-7 rounded-3xl bg-slate-950 text-white p-6 text-center">
              <div className="text-xs uppercase tracking-[.2em] font-black text-cyan-300">Target Word</div>
              <div className="mt-2 text-4xl sm:text-6xl font-black tracking-wide">{item.word}</div>
              <div className="mt-4 flex justify-center gap-2 flex-wrap">
                {item.parts.map(part => (
                  <span key={part} className="rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-lg font-black">{part}</span>
                ))}
              </div>
              <button onClick={() => speakText(item.word)} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-cyan-400 text-slate-950 px-4 py-2 font-black">
                <Volume2 className="w-5 h-5" /> Hear Word
              </button>
            </div>

            <div className="mt-7 text-xl sm:text-2xl font-black">{item.prompt}</div>
            <div className="mt-4 grid gap-3">
              {item.choices.map((choice, index) => (
                <button key={choice} disabled={!!feedback} onClick={() => answerObjective(index === item.answer, data.items.length)} className="min-h-[64px] rounded-2xl border-2 border-slate-200 bg-slate-50 hover:border-cyan-400 hover:bg-cyan-50 px-5 text-left text-lg font-black disabled:opacity-70">
                  {choice}
                </button>
              ))}
            </div>
            {feedback && <div className={`mt-5 rounded-2xl p-4 font-black ${feedback.startsWith("Correct") ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{feedback}</div>}
            {progress.completed[activeMission.id] && missionStep === data.items.length - 1 && feedback.startsWith("Mission complete") && (
              <button onClick={finishAndReturn} className="mt-5 w-full min-h-[60px] rounded-2xl bg-cyan-600 text-white font-black">Back to Training Map</button>
            )}
          </div>
        </MissionShell>
      );
    }

    if (activeMission.track === "vocab") {
      const items = vocabData[activeMission.id as keyof typeof vocabData];
      const item = items[Math.min(missionStep, items.length - 1)];

      return (
        <MissionShell title={activeMission.title} track="vocab" onBack={finishAndReturn}>
          <div className="rounded-[2rem] bg-white text-slate-900 p-5 sm:p-8 shadow-2xl">
            <div className="flex items-center gap-3">
              <Search className="w-8 h-8 text-violet-600" />
              <div>
                <div className="text-sm font-black text-violet-700 uppercase tracking-widest">Detective Rule</div>
                <div className="font-bold text-slate-500">Do not stop at the hard word. Look around it for clues.</div>
              </div>
            </div>

            <div className="mt-7 rounded-3xl bg-violet-50 border-2 border-violet-100 p-5 sm:p-7 text-lg sm:text-xl font-semibold leading-relaxed">
              {item.sentence}
            </div>

            <div className="mt-6 text-xl sm:text-2xl font-black">{item.q}</div>
            <div className="mt-4 grid gap-3">
              {item.choices.map((choice, index) => (
                <button key={choice} disabled={!!feedback} onClick={() => answerObjective(index === item.answer, items.length)} className="min-h-[64px] rounded-2xl border-2 border-slate-200 bg-slate-50 hover:border-violet-400 hover:bg-violet-50 px-5 text-left text-lg font-black disabled:opacity-70">
                  {choice}
                </button>
              ))}
            </div>
            {feedback && (
              <div className="mt-5 rounded-2xl bg-violet-50 border border-violet-200 p-4">
                <div className="font-black text-violet-800">{feedback}</div>
                <div className="mt-1 text-sm font-semibold text-slate-600">Clue: {item.clue}</div>
              </div>
            )}
          </div>
        </MissionShell>
      );
    }

    if (activeMission.track === "comprehension") {
      const data = comprehensionData[activeMission.id as keyof typeof comprehensionData];
      const item = data.questions[Math.min(missionStep, data.questions.length - 1)];

      return (
        <MissionShell title={activeMission.title} track="comprehension" onBack={finishAndReturn}>
          <div className="rounded-[2rem] bg-white text-slate-900 p-5 sm:p-8 shadow-2xl">
            <div className="flex flex-wrap gap-2 mb-5">
              <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-black">READ</span>
              <span className="rounded-full bg-sky-100 text-sky-800 px-3 py-1 text-xs font-black">FIND EVIDENCE</span>
              <span className="rounded-full bg-violet-100 text-violet-800 px-3 py-1 text-xs font-black">ANSWER</span>
            </div>

            <div className="rounded-3xl bg-slate-50 border-2 border-slate-100 p-5 sm:p-7 text-base sm:text-xl font-semibold leading-[1.75]">
              {data.passage}
            </div>
            <button onClick={() => speakText(data.passage)} className="mt-3 inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-black">
              <Headphones className="w-4 h-4" /> Listen to Passage
            </button>

            <div className="mt-7 text-xl sm:text-2xl font-black">{item.q}</div>
            <div className="mt-4 grid gap-3">
              {item.choices.map((choice, index) => (
                <button key={choice} disabled={!!feedback} onClick={() => answerObjective(index === item.answer, data.questions.length)} className="min-h-[64px] rounded-2xl border-2 border-slate-200 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50 px-5 text-left text-lg font-black disabled:opacity-70">
                  {choice}
                </button>
              ))}
            </div>
            {feedback && <div className={`mt-5 rounded-2xl p-4 font-black ${feedback.startsWith("Correct") ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{feedback}</div>}
          </div>
        </MissionShell>
      );
    }

    if (activeMission.track === "fluency") {
      const data = fluencyData[activeMission.id as keyof typeof fluencyData];

      return (
        <MissionShell title={activeMission.title} track="fluency" onBack={finishAndReturn}>
          <div className="rounded-[2rem] bg-white text-slate-900 p-5 sm:p-8 shadow-2xl">
            <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-start">
              <div>
                <div className="text-sm font-black text-amber-700 uppercase tracking-widest">Round {fluencyRound} of 3</div>
                <h2 className="mt-1 text-2xl sm:text-3xl font-black">Read it out loud.</h2>
                <p className="mt-2 font-semibold text-slate-500">{data.focus}</p>
              </div>
              <div className="rounded-2xl bg-amber-100 text-amber-900 px-4 py-3 font-black">
                Best: {progress.fluencyBest[activeMission.id] ? `${progress.fluencyBest[activeMission.id]}s` : "—"}
              </div>
            </div>

            <div className="mt-7 rounded-3xl bg-slate-950 text-white p-5 sm:p-8 text-lg sm:text-2xl font-semibold leading-[1.8]">
              {data.passage}
            </div>

            {!fluencyStart ? (
              <button onClick={() => setFluencyStart(Date.now())} className="mt-6 w-full min-h-[66px] rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-xl flex items-center justify-center gap-2">
                <Clock3 className="w-6 h-6" /> Start Reading
              </button>
            ) : (
              <button
                onClick={() => {
                  const seconds = Math.max(1, Math.round((Date.now() - fluencyStart) / 1000));
                  const nextTimes = [...fluencyTimes, seconds];
                  setFluencyTimes(nextTimes);
                  setFluencyStart(null);
                  setProgress(p => ({
                    ...p,
                    fluencyBest: {
                      ...p.fluencyBest,
                      [activeMission.id]: !p.fluencyBest[activeMission.id]
                        ? seconds
                        : Math.min(p.fluencyBest[activeMission.id], seconds),
                    },
                  }));
                  if (fluencyRound >= 3) {
                    const consistencyBonus = Math.max(0, 15 - Math.abs(nextTimes[nextTimes.length - 1] - nextTimes[0]));
                    completeMission(activeMission, activeMission.xp + consistencyBonus);
                  } else {
                    setFluencyRound(r => r + 1);
                  }
                }}
                className="mt-6 w-full min-h-[66px] rounded-2xl bg-emerald-500 text-white font-black text-xl"
              >
                Finished Reading
              </button>
            )}

            <div className="mt-5 grid grid-cols-3 gap-3">
              {[1, 2, 3].map((round, index) => (
                <div key={round} className="rounded-2xl bg-slate-100 p-4 text-center">
                  <div className="text-xs font-black text-slate-500 uppercase">Read {round}</div>
                  <div className="mt-1 text-xl font-black">{fluencyTimes[index] ? `${fluencyTimes[index]}s` : "—"}</div>
                </div>
              ))}
            </div>

            {feedback.startsWith("Mission complete") && (
              <div className="mt-6">
                <div className="rounded-2xl bg-emerald-50 text-emerald-800 p-4 font-black">{feedback}</div>
                <p className="mt-3 text-sm font-semibold text-slate-500">The goal is smoother, accurate reading—not just going as fast as possible.</p>
                <button onClick={finishAndReturn} className="mt-5 w-full min-h-[60px] rounded-2xl bg-amber-500 text-slate-950 font-black">Back to Training Map</button>
              </div>
            )}
          </div>
        </MissionShell>
      );
    }

    return (
      <MissionShell title={activeMission.title} track="choice" onBack={finishAndReturn}>
        <div className="rounded-[2rem] bg-white text-slate-900 p-5 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3">
            <BookOpen className="w-9 h-9 text-rose-600" />
            <div>
              <div className="text-sm font-black text-rose-700 uppercase tracking-widest">Student Choice</div>
              <h2 className="text-2xl sm:text-3xl font-black">You pick what matters to you.</h2>
            </div>
          </div>

          <label className="block mt-7 text-sm font-black text-slate-600">What are you reading about?</label>
          <input
            value={choiceTopic}
            onChange={e => setChoiceTopic(e.target.value)}
            placeholder="Example: basketball, anime, cars, history, music..."
            className="mt-2 w-full min-h-[58px] rounded-2xl border-2 border-slate-200 px-4 text-lg font-bold outline-none focus:border-rose-400"
          />

          <div className="mt-5">
            <div className="text-sm font-black text-slate-600">Reading time</div>
            <div className="mt-2 flex gap-2 flex-wrap">
              {[5, 10, 15, 20].map(minutes => (
                <button key={minutes} onClick={() => setChoiceMinutes(minutes)} className={`min-h-[48px] rounded-2xl px-5 font-black border-2 ${choiceMinutes === minutes ? "bg-rose-600 border-rose-600 text-white" : "border-slate-200 bg-slate-50"}`}>
                  {minutes} min
                </button>
              ))}
            </div>
          </div>

          <label className="block mt-6 text-sm font-black text-slate-600">After reading: what was one important or interesting idea?</label>
          <textarea
            value={choiceReflection}
            onChange={e => setChoiceReflection(e.target.value)}
            placeholder="Write one sentence."
            className="mt-2 w-full min-h-[110px] rounded-2xl border-2 border-slate-200 p-4 text-lg font-semibold outline-none focus:border-rose-400"
          />

          <button
            disabled={choiceTopic.trim().length < 2 || choiceReflection.trim().length < 8}
            onClick={() => {
              setProgress(p => ({ ...p, choiceMinutes: p.choiceMinutes + choiceMinutes }));
              completeMission(activeMission);
            }}
            className="mt-6 w-full min-h-[64px] rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black text-xl disabled:opacity-40"
          >
            Finish Reading Mission
          </button>

          {feedback.startsWith("Mission complete") && (
            <button onClick={finishAndReturn} className="mt-4 w-full min-h-[58px] rounded-2xl bg-slate-900 text-white font-black">Back to Training Map</button>
          )}
        </div>
      </MissionShell>
    );
  }

  return (
    <div className="min-h-screen bg-[#07111f] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <header className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/library")} className="min-h-[48px] px-4 rounded-2xl bg-white/10 border border-white/10 font-black flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" /> Library
          </button>
          <div className="ml-auto flex items-center gap-2 rounded-2xl bg-white/10 border border-white/10 px-4 py-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <span className="font-black">{progress.streak} day streak</span>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-blue-700 via-violet-700 to-fuchsia-700 p-6 sm:p-9 shadow-2xl border border-white/10">
          <div className="absolute -right-16 -bottom-20 w-80 h-80 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-5 top-5 text-7xl opacity-25">📈</div>
          <div className="relative grid lg:grid-cols-[1fr_360px] gap-7 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/15 px-3 py-1.5 text-xs font-black uppercase tracking-widest">
                <Sparkles className="w-4 h-4" /> Reading Level Up
              </div>
              <h1 className="mt-4 text-4xl sm:text-6xl font-black leading-[.95]">TRAIN YOUR READING.</h1>
              <p className="mt-4 text-base sm:text-xl font-bold text-white/80 max-w-2xl">
                Five skills work together: decoding, fluency, vocabulary, comprehension, and reading things you actually care about.
              </p>
            </div>

            <div className="rounded-[2rem] bg-slate-950/35 backdrop-blur border border-white/15 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest font-black text-cyan-200">Reading Power</div>
                  <div className="mt-1 text-3xl font-black">Level {currentLevel}</div>
                  <div className="text-sm font-bold text-white/65">{titleForLevel(currentLevel)}</div>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Gauge className="w-9 h-9 text-cyan-300" />
                </div>
              </div>
              <div className="mt-5 h-3 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-300 to-lime-300 transition-all" style={{ width: `${levelPct}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs font-black text-white/60">
                <span>{progress.xp} XP</span>
                <span>{nextLevelXp} XP</span>
              </div>
            </div>
          </div>
        </section>

        <div className="grid sm:grid-cols-3 gap-3 mt-5">
          <div className="rounded-3xl bg-white/5 border border-white/10 p-4">
            <Trophy className="w-6 h-6 text-amber-300" />
            <div className="mt-2 text-3xl font-black">{completedCount}/15</div>
            <div className="text-sm font-bold text-white/55">Missions cleared</div>
          </div>
          <div className="rounded-3xl bg-white/5 border border-white/10 p-4">
            <BookOpen className="w-6 h-6 text-rose-300" />
            <div className="mt-2 text-3xl font-black">{progress.choiceMinutes}</div>
            <div className="text-sm font-bold text-white/55">Choice-reading minutes</div>
          </div>
          <div className="rounded-3xl bg-white/5 border border-white/10 p-4">
            <Target className="w-6 h-6 text-emerald-300" />
            <div className="mt-2 text-3xl font-black">{progress.xp}</div>
            <div className="text-sm font-bold text-white/55">Reading XP earned</div>
          </div>
        </div>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <div className="text-xs uppercase tracking-[.2em] text-cyan-300 font-black">Training Map</div>
              <h2 className="text-2xl sm:text-3xl font-black">Build every reading skill.</h2>
            </div>
            <div className="hidden sm:block text-sm font-bold text-white/50">Complete easier missions first, then move up.</div>
          </div>

          <div className="space-y-5">
            {(Object.keys(TRACKS) as TrackId[]).map(trackId => {
              const track = TRACKS[trackId];
              const trackMissions = MISSIONS.filter(m => m.track === trackId);
              return (
                <div key={trackId} className="rounded-[2rem] bg-white/5 border border-white/10 p-4 sm:p-5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${track.gradient} flex items-center justify-center text-3xl shadow-lg`}>{track.icon}</div>
                    <div className="flex-1">
                      <h3 className="text-xl sm:text-2xl font-black">{track.name}</h3>
                      <p className="text-sm font-semibold text-white/55">{track.tagline}</p>
                    </div>
                    <div className="hidden sm:block text-right">
                      <div className="text-xl font-black">{progress.trackXp[trackId]} XP</div>
                      <div className="text-xs text-white/45 font-bold uppercase">Track XP</div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-3">
                    {trackMissions.map((mission, index) => {
                      const prior = trackMissions[index - 1];
                      const unlocked = index === 0 || !!progress.completed[prior.id];
                      const done = !!progress.completed[mission.id];

                      return (
                        <button
                          key={mission.id}
                          disabled={!unlocked}
                          onClick={() => resetMissionState(mission)}
                          className={`relative min-h-[150px] rounded-3xl border-2 p-4 text-left transition-all ${done ? "bg-emerald-500/10 border-emerald-400/40" : unlocked ? `bg-slate-950/45 ${track.ring} hover:-translate-y-1 hover:bg-slate-950/65` : "bg-white/[.025] border-white/5 opacity-45"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-xs font-black uppercase tracking-widest text-white/45">Stage {index + 1}</div>
                            {done ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : !unlocked ? <LockKeyhole className="w-5 h-5 text-white/30" /> : <ChevronRight className="w-5 h-5 text-white/50" />}
                          </div>
                          <div className="mt-3 text-lg font-black">{mission.title}</div>
                          <div className="mt-1 text-sm font-semibold text-white/50 leading-snug">{mission.subtitle}</div>
                          <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/8 px-2.5 py-1 text-xs font-black">
                            <Star className="w-3.5 h-3.5 text-amber-300" /> {mission.xp} XP
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-cyan-300/20 bg-cyan-300/5 p-5 sm:p-7">
          <div className="flex gap-4 items-start">
            <Award className="w-8 h-8 text-cyan-300 flex-shrink-0" />
            <div>
              <h3 className="text-xl font-black">How this helps your reading level</h3>
              <p className="mt-2 text-sm sm:text-base font-semibold text-white/60 leading-relaxed">
                Decode Lab helps you read unfamiliar words. Fluency Sprint builds smoother repeated reading. Word Detective strengthens vocabulary without stopping every time you meet a new word. Meaning Missions makes you prove answers with the text. Your Reading builds stamina and lets you practice with subjects you care about.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
