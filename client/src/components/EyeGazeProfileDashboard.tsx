import { useEffect, useState } from "react";
import { BookOpen, Camera, CheckCircle2, Eye, Star, Trophy, Volume2, VolumeX } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { speakCharacterAI } from "@/lib/tts";

type BuddyPreset = "puppy" | "dino" | "robot" | "bunny";

type BuddyConfig = {
  type: "preset" | "upload";
  preset: BuddyPreset;
  name: string;
  imageData: string | null;
  voiceEnabled: boolean;
  calmMode?: boolean;
};

const PRESETS: Record<BuddyPreset, { emoji: string; label: string; bg: string }> = {
  puppy: { emoji: "🐶", label: "Puppy", bg: "from-sky-200 to-blue-100" },
  dino: { emoji: "🦖", label: "Dino", bg: "from-lime-200 to-emerald-100" },
  robot: { emoji: "🤖", label: "Robot", bg: "from-violet-200 to-indigo-100" },
  bunny: { emoji: "🐰", label: "Bunny", bg: "from-pink-200 to-rose-100" },
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

function BuddyVisual({
  buddy,
  className = "",
}: {
  buddy: BuddyConfig;
  className?: string;
}) {
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
  totalPoints,
  quizzesTaken,
  rank,
}: {
  displayName: string;
  totalPoints: number;
  quizzesTaken: number;
  rank?: number | null;
}) {
  const [buddy, setBuddy] = useState<BuddyConfig>({
    type: "preset",
    preset: "puppy",
    name: "Buddy",
    imageData: null,
    voiceEnabled: true,
    calmMode: false,
  });
  const [draft, setDraft] = useState<BuddyConfig>({
    type: "preset",
    preset: "puppy",
    name: "Buddy",
    imageData: null,
    voiceEnabled: true,
    calmMode: false,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [eyeStats, setEyeStats] = useState<any>(null);
  const [lessonMessage, setLessonMessage] = useState("Which word is CAT?");
  const [lessonState, setLessonState] = useState<"ready" | "correct" | "retry">("ready");
  const [voicePlaying, setVoicePlaying] = useState(false);

  const firstName = displayName?.split(" ")[0] || "Learner";

  useEffect(() => {
    const token = getTokenFromCookie();
    if (!token) return;

    Promise.all([
      fetch(`${API_BASE}/api/eye-gaze/learning-buddy`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/api/eye-gaze/profile`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }).then(r => r.ok ? r.json() : null),
    ])
      .then(([buddyData, profileData]) => {
        if (buddyData) {
          const normalized = { ...buddyData, calmMode: !!buddyData.calmMode };
          setBuddy(normalized);
          setDraft(normalized);
        }
        if (profileData) setEyeStats(profileData);
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
        setMessage("Natural AI voice is unavailable on the server.");
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
      name: prev.name === "Buddy" || Object.values(PRESETS).some(x => x.label === prev.name)
        ? selected.label
        : prev.name,
    }));
  };

  const uploadPicture = (file?: File) => {
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setMessage("Please choose a PNG, JPG, or WEBP picture.");
      return;
    }
    if (file.size > 1_500_000) {
      setMessage("Please choose a picture under 1.5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setDraft(prev => ({ ...prev, type: "upload", imageData: String(reader.result || "") }));
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
      setMessage("Learning Buddy saved!");
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
      const text = "Yes! You found CAT! Great job!";
      setLessonState("correct");
      setLessonMessage(text);
      speak(text);
    } else {
      const text = "Good try! Look again. Which word says CAT?";
      setLessonState("retry");
      setLessonMessage(text);
      speak(text);
    }

    window.setTimeout(() => {
      setLessonState("ready");
      setLessonMessage("Which word is CAT?");
    }, 1800);
  };

  const level = eyeStats?.current_level || 1;
  const completed = eyeStats?.total_completed || quizzesTaken || 0;

  return (
    <div className="min-h-screen bg-[#f7fbff] text-slate-900">
      <main className="max-w-[1500px] mx-auto p-3 sm:p-5 lg:p-6 space-y-5">
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-amber-100 via-orange-50 to-sky-100 border border-sky-100 min-h-[310px]">
          <div className="absolute top-5 left-[8%] text-5xl opacity-50">⭐</div>
          <div className="absolute bottom-6 right-[8%] text-5xl opacity-50">🌈</div>

          <div className="relative grid md:grid-cols-[360px_1fr] items-center gap-6 p-5 sm:p-8">
            <button
              type="button"
              onClick={() => speak(`Hi ${firstName}! I'm ${draft.name}. Let's learn together!`)}
              className="mx-auto relative group"
            >
              <div className={voicePlaying ? "animate-bounce" : ""}>
                <BuddyVisual buddy={draft} className="w-56 h-56 sm:w-64 sm:h-64 text-[8rem] sm:text-[10rem] group-hover:scale-105 transition-transform" />
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 text-white px-4 py-2 text-xs font-black shadow whitespace-nowrap">
                {voicePlaying ? "TALKING..." : "TAP ME!"}
              </div>
            </button>

            <div className="relative bg-white border-4 border-blue-500 rounded-[2.5rem] px-6 py-7 sm:px-9 sm:py-8 text-center shadow-sm">
              <p className="text-2xl sm:text-4xl font-black text-blue-950 leading-tight">
                Hi, {firstName}! I'm {draft.name}!
              </p>
              <p className="text-xl sm:text-3xl font-black text-blue-800 mt-3">
                Let's learn together.
              </p>
              <button
                type="button"
                onClick={() => speak(`Hi ${firstName}! I'm ${draft.name}. Let's learn together!`)}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-100 text-blue-700 px-5 py-3 font-black"
              >
                <Volume2 className="w-5 h-5" /> Hear My Buddy
              </button>
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-[1fr_360px] gap-4">
          <div className="rounded-[2rem] border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5">
            <h2 className="text-2xl sm:text-3xl font-black text-blue-950 mb-4">Choose a Buddy</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(Object.keys(PRESETS) as BuddyPreset[]).map(key => {
                const preset = PRESETS[key];
                const selected = draft.type === "preset" && draft.preset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => choosePreset(key)}
                    className={`rounded-3xl overflow-hidden border-4 transition-all bg-white min-h-[185px] ${
                      selected ? "border-sky-500 ring-4 ring-sky-100" : "border-transparent hover:border-sky-200"
                    }`}
                  >
                    <div className={`h-135 bg-gradient-to-br ${preset.bg} flex items-center justify-center text-7xl py-6`}>
                      {preset.emoji}
                    </div>
                    <div className="py-3 text-xl font-black text-blue-950">{preset.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[2rem] border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5">
            <h2 className="text-2xl font-black text-blue-950 mb-4">Upload Your Favorite Picture</h2>
            <label className="min-h-[225px] rounded-3xl border-4 border-dashed border-blue-200 bg-white flex flex-col items-center justify-center text-center p-5 cursor-pointer hover:bg-blue-50">
              {draft.type === "upload" && draft.imageData ? (
                <>
                  <BuddyVisual buddy={draft} className="w-28 h-28 text-6xl mb-3" />
                  <div className="font-black text-blue-950">Picture selected!</div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-3xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                    <Camera className="w-10 h-10" />
                  </div>
                  <div className="text-xl font-black text-blue-950">Upload a favorite picture</div>
                  <div className="text-sm text-slate-500 mt-2">Your picture becomes your Learning Buddy.</div>
                </>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => uploadPicture(e.target.files?.[0])}
              />
            </label>
          </div>
        </section>

        <section className="rounded-[2rem] border border-sky-100 bg-white p-4">
          <div className="grid lg:grid-cols-[1fr_1fr_1.2fr] gap-3">
            <button
              type="button"
              onClick={() => setDraft(prev => ({ ...prev, voiceEnabled: !prev.voiceEnabled }))}
              className="min-h-[88px] rounded-3xl border border-sky-100 bg-sky-50 px-5 flex items-center gap-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                {draft.voiceEnabled ? <Volume2 className="w-7 h-7" /> : <VolumeX className="w-7 h-7" />}
              </div>
              <div className="text-left flex-1">
                <div className="text-xl font-black text-blue-950">Buddy Voice: {draft.voiceEnabled ? "On" : "Off"}</div>
                <div className="text-xs text-slate-500">Natural AI-generated voice</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDraft(prev => ({ ...prev, calmMode: !prev.calmMode }))}
              className="min-h-[88px] rounded-3xl border border-violet-100 bg-violet-50 px-5 flex items-center gap-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center text-3xl">🪷</div>
              <div className="text-left flex-1">
                <div className="text-xl font-black text-blue-950">Calm Mode: {draft.calmMode ? "On" : "Off"}</div>
                <div className="text-xs text-slate-500">Gentler pacing for lessons</div>
              </div>
            </button>

            <button
              type="button"
              onClick={saveBuddy}
              disabled={saving}
              className="min-h-[88px] rounded-3xl bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white px-6 flex items-center justify-center gap-3 text-xl sm:text-2xl font-black shadow-sm"
            >
              <CheckCircle2 className="w-8 h-8" />
              {saving ? "Saving..." : "Use This Buddy"}
            </button>
          </div>
          {message && <div className="mt-3 text-center font-black text-blue-800">{message}</div>}
        </section>

        <section className={`rounded-[2rem] border-2 overflow-hidden ${
          lessonState === "correct" ? "border-green-300 bg-green-50" :
          lessonState === "retry" ? "border-amber-300 bg-amber-50" :
          "border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50"
        }`}>
          <div className="grid lg:grid-cols-[390px_1fr]">
            <div className="relative p-5 sm:p-6 bg-gradient-to-br from-yellow-100 to-orange-100 flex flex-col justify-center">
              <div className="absolute top-4 left-4 bg-yellow-400 text-blue-950 rounded-full px-5 py-2 font-black flex items-center gap-2">
                <BookOpen className="w-5 h-5" /> Try a Lesson
              </div>
              <div className="pt-12 flex items-center gap-4">
                <button type="button" onClick={() => speak(lessonMessage)} className="flex-shrink-0">
                  <BuddyVisual buddy={draft} className="w-32 h-32 sm:w-40 sm:h-40 text-7xl sm:text-8xl" />
                </button>
                <div className="rounded-3xl bg-white border-4 border-blue-500 px-5 py-5 text-center flex-1">
                  <div className="text-xl sm:text-2xl font-black text-blue-950">{lessonMessage}</div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 grid grid-cols-3 gap-3">
              {LESSON_CHOICES.map(choice => (
                <button
                  key={choice.word}
                  type="button"
                  onClick={() => chooseLesson(choice.word)}
                  className="min-h-[210px] rounded-3xl border-2 border-yellow-200 bg-white hover:border-blue-400 transition-all flex flex-col items-center justify-center p-4"
                >
                  <div className="text-6xl sm:text-7xl mb-4">{choice.emoji}</div>
                  <div className="text-3xl sm:text-5xl font-black text-slate-950">{choice.word}</div>
                  <div className="mt-3 text-xs font-black text-slate-400">GAZE OR TAP</div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 pb-5">
          <div className="rounded-3xl bg-white border border-sky-100 p-4">
            <Star className="w-6 h-6 text-yellow-400 fill-current mb-2" />
            <div className="text-3xl font-black text-blue-950">{totalPoints}</div>
            <div className="text-xs font-black text-slate-400">POINTS</div>
          </div>
          <div className="rounded-3xl bg-white border border-sky-100 p-4">
            <Eye className="w-6 h-6 text-blue-500 mb-2" />
            <div className="text-3xl font-black text-blue-950">Level {level}</div>
            <div className="text-xs font-black text-slate-400">EYE GAZE LEVEL</div>
          </div>
          <div className="rounded-3xl bg-white border border-sky-100 p-4">
            <BookOpen className="w-6 h-6 text-emerald-500 mb-2" />
            <div className="text-3xl font-black text-blue-950">{completed}</div>
            <div className="text-xs font-black text-slate-400">ACTIVITIES</div>
          </div>
          <div className="rounded-3xl bg-white border border-sky-100 p-4">
            <Trophy className="w-6 h-6 text-violet-500 mb-2" />
            <div className="text-3xl font-black text-blue-950">{rank ? `#${rank}` : "—"}</div>
            <div className="text-xs font-black text-slate-400">RANK</div>
          </div>
        </section>
      </main>
    </div>
  );
}
