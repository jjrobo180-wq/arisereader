import { useEffect, useState } from "react";
import {
  BookOpen,
  Camera,
  CheckCircle2,
  Eye,
  Gamepad2,
  MessageCircle,
  Settings,
  Sparkles,
  Star,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { speakCharacterAI } from "@/lib/tts";
import { useLocation } from "wouter";

type BuddyPreset = "puppy" | "dino" | "robot" | "bunny";

type BuddyConfig = {
  type: "preset" | "upload";
  preset: BuddyPreset;
  name: string;
  imageData: string | null;
  voiceEnabled: boolean;
  calmMode?: boolean;
};

type Props = {
  displayName: string;
  totalPoints?: number;
  quizzesTaken?: number;
  rank?: number | null;
};

const PRESETS: Record<BuddyPreset, { emoji: string; label: string; bg: string; accent: string }> = {
  puppy: { emoji: "🐶", label: "Puppy", bg: "from-sky-100 to-cyan-50", accent: "bg-sky-600" },
  dino: { emoji: "🦖", label: "Dino", bg: "from-lime-100 to-emerald-50", accent: "bg-emerald-600" },
  robot: { emoji: "🤖", label: "Robot", bg: "from-violet-100 to-indigo-50", accent: "bg-violet-600" },
  bunny: { emoji: "🐰", label: "Bunny", bg: "from-pink-100 to-rose-50", accent: "bg-rose-500" },
};

const LESSON_CHOICES = [
  { word: "CAT", emoji: "🐱" },
  { word: "DOG", emoji: "🐶" },
  { word: "SUN", emoji: "☀️" },
];

function getTokenFromCookie(): string | null {
  try {
    const match = document.cookie.match(/arise_session=([^;]+)/);
    if (!match) return null;
    return JSON.parse(atob(match[1])).token || null;
  } catch {
    return null;
  }
}

function BuddyVisual({ buddy, className = "" }: { buddy: BuddyConfig; className?: string }) {
  if (buddy.type === "upload" && buddy.imageData) {
    return (
      <img
        src={buddy.imageData}
        alt={buddy.name}
        className={`object-cover rounded-[2rem] border-4 border-white shadow-lg ${className}`}
      />
    );
  }

  const preset = PRESETS[buddy.preset] || PRESETS.puppy;
  return (
    <div
      className={`rounded-[2rem] border-4 border-white shadow-lg bg-gradient-to-br ${preset.bg} flex items-center justify-center ${className}`}
      aria-label={preset.label}
    >
      <span>{preset.emoji}</span>
    </div>
  );
}

export default function EyeGazeProfileDashboard({
  displayName,
  totalPoints = 0,
  quizzesTaken = 0,
  rank = null,
}: Props) {
  const [, navigate] = useLocation();
  const [buddy, setBuddy] = useState<BuddyConfig>({
    type: "preset",
    preset: "puppy",
    name: "Buddy",
    imageData: null,
    voiceEnabled: true,
    calmMode: false,
  });
  const [draft, setDraft] = useState<BuddyConfig>(buddy);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [lessonMessage, setLessonMessage] = useState("Which word says CAT?");
  const [lessonState, setLessonState] = useState<"ready" | "correct" | "retry">("ready");

  const firstName = displayName?.split(" ")[0] || "Learner";

  useEffect(() => {
    const token = getTokenFromCookie();
    if (!token) return;

    fetch(`${API_BASE}/api/eye-gaze/learning-buddy`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data) return;
        const normalized = { ...data, calmMode: !!data.calmMode };
        setBuddy(normalized);
        setDraft(normalized);
      })
      .catch(() => {});
  }, []);

  const speak = (text: string) => {
    if (!draft.voiceEnabled) return;
    setMessage("");
    speakCharacterAI(text, {
      calmMode: !!draft.calmMode,
      onStart: () => setVoicePlaying(true),
      onEnd: () => setVoicePlaying(false),
      onFallback: () => {
        setVoicePlaying(false);
        setMessage("Natural AI voice is unavailable right now.");
      },
    });
  };

  const choosePreset = (preset: BuddyPreset) => {
    const selected = PRESETS[preset];
    setDraft(prev => ({
      ...prev,
      type: "preset",
      preset,
      imageData: null,
      name:
        prev.name === "Buddy" || Object.values(PRESETS).some(item => item.label === prev.name)
          ? selected.label
          : prev.name,
    }));
  };

  const uploadPicture = (file?: File) => {
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setMessage("Choose a PNG, JPG, or WEBP picture.");
      return;
    }

    if (file.size > 1_500_000) {
      setMessage("Choose a picture under 1.5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setDraft(prev => ({
        ...prev,
        type: "upload",
        imageData: String(reader.result || ""),
      }));
      setMessage("");
    };
    reader.readAsDataURL(file);
  };

  const saveBuddy = async () => {
    const token = getTokenFromCookie();
    if (!token) return;

    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/eye-gaze/learning-buddy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not save buddy.");

      const normalized = { ...data, calmMode: !!data.calmMode };
      setBuddy(normalized);
      setDraft(normalized);
      setMessage("My Buddy is saved!");
      if (normalized.voiceEnabled) {
        speak(`Hi ${firstName}! I'm ${normalized.name}. Let's learn together!`);
      }
    } catch (error: any) {
      setMessage(error?.message || "Could not save buddy.");
    } finally {
      setSaving(false);
    }
  };

  const chooseLesson = (word: string) => {
    if (word === "CAT") {
      setLessonState("correct");
      setLessonMessage("YES! You found CAT!");
      speak(`Yes, ${firstName}! You found cat. Great job!`);
    } else {
      setLessonState("retry");
      setLessonMessage("Good try! Look again.");
      speak("Good try. Look again. Which word says cat?");
    }

    window.setTimeout(() => {
      setLessonState("ready");
      setLessonMessage("Which word says CAT?");
    }, 1800);
  };

  const heroBuddy = draft;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-7 pb-8 space-y-5">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-teal-200 bg-[#fffaf0] shadow-sm">
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-teal-500 via-cyan-400 to-amber-300" />
        <div className="relative grid lg:grid-cols-[330px_1fr] items-center gap-5 p-5 sm:p-7 lg:p-8">
          <button
            type="button"
            onClick={() => speak(`Hi ${firstName}! I'm ${heroBuddy.name}. Let's learn together!`)}
            className="relative mx-auto group"
            aria-label={`Hear ${heroBuddy.name}`}
          >
            <div className={voicePlaying ? "animate-bounce" : ""}>
              <BuddyVisual
                buddy={heroBuddy}
                className="w-52 h-52 sm:w-60 sm:h-60 text-[8rem] sm:text-[9rem] group-hover:scale-[1.02] transition-transform"
              />
            </div>
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-teal-700 text-white px-4 py-2 text-xs font-black whitespace-nowrap shadow">
              {voicePlaying ? "TALKING…" : "TAP TO HEAR"}
            </span>
          </button>

          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-teal-800">
              <Sparkles className="w-4 h-4" />
              My Eye Gazer Profile
            </div>
            <h1 className="mt-3 text-4xl sm:text-6xl font-black tracking-tight text-slate-950">
              Hi, {firstName}!
            </h1>
            <div className="mt-4 relative rounded-[2rem] border-4 border-teal-500 bg-white px-5 py-5 sm:px-7 sm:py-6 shadow-sm">
              <p className="text-2xl sm:text-3xl font-black text-teal-950">
                I'm {heroBuddy.name}. Ready to learn together?
              </p>
              <p className="mt-2 text-base sm:text-lg font-bold text-slate-600">
                Pick your buddy, hear a friendly voice, practice a word, or jump into one of your favorite activities.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => navigate("/eye-gaze-talker")}
                className="min-h-[76px] rounded-2xl bg-teal-700 text-white font-black flex flex-col items-center justify-center gap-1"
              >
                <MessageCircle className="w-6 h-6" />
                My Talker
              </button>
              <button
                type="button"
                onClick={() => navigate("/eye-gaze-games")}
                className="min-h-[76px] rounded-2xl bg-amber-300 text-slate-950 font-black flex flex-col items-center justify-center gap-1"
              >
                <Gamepad2 className="w-6 h-6" />
                Games
              </button>
              <button
                type="button"
                onClick={() => navigate("/leaderboard")}
                className="min-h-[76px] rounded-2xl bg-sky-100 text-sky-900 font-black flex flex-col items-center justify-center gap-1"
              >
                <Trophy className="w-6 h-6" />
                Progress
              </button>
              <button
                type="button"
                onClick={() => navigate("/eye-gaze-account")}
                className="min-h-[76px] rounded-2xl bg-slate-100 text-slate-800 font-black flex flex-col items-center justify-center gap-1"
              >
                <Settings className="w-6 h-6" />
                Settings
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-3xl bg-white/90 border border-teal-100 p-4 sm:p-5 text-center">
          <Star className="w-6 h-6 mx-auto text-amber-500 fill-current mb-2" />
          <div className="text-2xl sm:text-3xl font-black text-slate-950">{totalPoints}</div>
          <div className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">Points</div>
        </div>
        <div className="rounded-3xl bg-white/90 border border-teal-100 p-4 sm:p-5 text-center">
          <BookOpen className="w-6 h-6 mx-auto text-teal-600 mb-2" />
          <div className="text-2xl sm:text-3xl font-black text-slate-950">{quizzesTaken}</div>
          <div className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">Activities</div>
        </div>
        <div className="rounded-3xl bg-white/90 border border-teal-100 p-4 sm:p-5 text-center">
          <Trophy className="w-6 h-6 mx-auto text-violet-600 mb-2" />
          <div className="text-2xl sm:text-3xl font-black text-slate-950">{rank ? `#${rank}` : "—"}</div>
          <div className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">Rank</div>
        </div>
      </section>

      <section className="rounded-[2rem] bg-white/90 border border-teal-200 shadow-sm p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">My Buddy</p>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950">Choose who learns with me</h2>
            <p className="mt-1 font-bold text-slate-600">Big choices, simple labels, and one clear save button.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          {(Object.keys(PRESETS) as BuddyPreset[]).map(key => {
            const preset = PRESETS[key];
            const selected = draft.type === "preset" && draft.preset === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  choosePreset(key);
                  speak(`Hi! I'm ${preset.label}. Pick me as your learning buddy!`);
                }}
                className={`relative min-h-[170px] rounded-[1.75rem] border-4 overflow-hidden bg-white transition-all ${selected ? "border-teal-600 ring-4 ring-teal-100 -translate-y-0.5 shadow-md" : "border-slate-100 hover:border-teal-200"}`}
              >
                {selected && (
                  <span className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-teal-700 text-white flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </span>
                )}
                <div className={`h-28 bg-gradient-to-br ${preset.bg} flex items-center justify-center text-7xl`}>
                  {preset.emoji}
                </div>
                <div className={`py-3 text-lg font-black text-white ${preset.accent}`}>
                  {preset.label}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-[1.75rem] border-2 border-dashed border-teal-200 bg-teal-50/60 p-4">
          <label className="min-h-[130px] cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
            {draft.type === "upload" && draft.imageData ? (
              <BuddyVisual buddy={draft} className="w-24 h-24 text-5xl flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-3xl bg-white text-teal-700 flex items-center justify-center shadow-sm flex-shrink-0">
                <Camera className="w-9 h-9" />
              </div>
            )}
            <div>
              <div className="text-xl font-black text-slate-950">
                {draft.type === "upload" && draft.imageData ? "Favorite picture selected" : "Use a favorite picture instead"}
              </div>
              <div className="mt-1 font-bold text-slate-600">
                Add a familiar person, pet, character, or picture that feels comfortable.
              </div>
            </div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={event => uploadPicture(event.target.files?.[0])}
            />
          </label>
        </div>

        <div className="grid md:grid-cols-3 gap-3 mt-4">
          <button
            type="button"
            onClick={() => setDraft(prev => ({ ...prev, voiceEnabled: !prev.voiceEnabled }))}
            aria-pressed={draft.voiceEnabled}
            className="min-h-[88px] rounded-3xl border border-sky-100 bg-sky-50 px-5 flex items-center gap-4 text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-white text-sky-700 flex items-center justify-center shadow-sm">
              {draft.voiceEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </div>
            <div>
              <div className="font-black text-slate-950">Buddy voice {draft.voiceEnabled ? "ON" : "OFF"}</div>
              <div className="text-xs font-bold text-slate-500">Friendly voice during buddy activities</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setDraft(prev => ({ ...prev, calmMode: !prev.calmMode }))}
            aria-pressed={!!draft.calmMode}
            className="min-h-[88px] rounded-3xl border border-violet-100 bg-violet-50 px-5 flex items-center gap-4 text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-2xl shadow-sm">🪷</div>
            <div>
              <div className="font-black text-slate-950">Calm mode {draft.calmMode ? "ON" : "OFF"}</div>
              <div className="text-xs font-bold text-slate-500">Gentler pacing and voice</div>
            </div>
          </button>

          <button
            type="button"
            onClick={saveBuddy}
            disabled={saving}
            className="min-h-[88px] rounded-3xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white px-6 flex items-center justify-center gap-3 text-xl font-black"
          >
            <CheckCircle2 className="w-7 h-7" />
            {saving ? "Saving…" : "Use this buddy"}
          </button>
        </div>

        {message && <div role="status" className="mt-3 text-center font-black text-teal-800">{message}</div>}
      </section>

      <section
        className={`rounded-[2rem] overflow-hidden border-2 transition-colors ${lessonState === "correct" ? "border-emerald-300 bg-emerald-50" : lessonState === "retry" ? "border-amber-300 bg-amber-50" : "border-amber-200 bg-[#fffaf0]"}`}
      >
        <div className="grid lg:grid-cols-[330px_1fr]">
          <div className="p-5 sm:p-6 bg-gradient-to-br from-amber-100 to-orange-50 flex flex-col justify-center">
            <div className="inline-flex self-start rounded-full bg-amber-300 text-slate-950 px-4 py-2 text-xs font-black uppercase tracking-wider">
              Try it with my buddy
            </div>
            <div className="mt-4 flex items-center gap-4">
              <button
                type="button"
                onClick={() => speak(lessonMessage)}
                className="flex-shrink-0"
                aria-label="Hear the practice question"
              >
                <BuddyVisual buddy={heroBuddy} className="w-28 h-28 sm:w-32 sm:h-32 text-6xl sm:text-7xl" />
              </button>
              <div className="rounded-3xl bg-white border-4 border-teal-500 px-4 py-5 text-center flex-1">
                <div className="text-xl sm:text-2xl font-black text-teal-950">{lessonMessage}</div>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 grid grid-cols-3 gap-3">
            {LESSON_CHOICES.map(choice => (
              <button
                key={choice.word}
                type="button"
                onClick={() => chooseLesson(choice.word)}
                className="min-h-[185px] rounded-3xl border-2 border-amber-100 bg-white hover:border-teal-400 transition-all flex flex-col items-center justify-center p-3"
              >
                <div className="text-5xl sm:text-6xl mb-3">{choice.emoji}</div>
                <div className="text-2xl sm:text-4xl font-black text-slate-950 tracking-wide">{choice.word}</div>
                <div className="mt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Look or tap</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] bg-white/90 border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
          <Settings className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-black text-slate-950">Profile settings</h2>
          <p className="font-bold text-slate-600">Picture, background color, Talker access, parent controls, name, and password live here.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/eye-gaze-account")}
          className="min-h-[54px] rounded-2xl bg-slate-900 text-white px-5 font-black"
        >
          Open settings
        </button>
      </section>
    </main>
  );
}
