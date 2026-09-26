import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  BookOpen,
  Camera,
  CheckCircle2,
  Gamepad2,
  Home,
  Settings,
  Star,
  Trophy,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  Eye,
} from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { speakCharacter, speakCharacterAI } from "@/lib/tts";

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
  puppy: { emoji: "🐶", label: "Puppy", bg: "from-sky-300/30 to-blue-500/20" },
  dino: { emoji: "🦖", label: "Dino", bg: "from-lime-300/30 to-emerald-500/20" },
  robot: { emoji: "🤖", label: "Robot", bg: "from-violet-300/30 to-indigo-500/20" },
  bunny: { emoji: "🐰", label: "Bunny", bg: "from-pink-300/30 to-rose-500/20" },
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
      <span className="drop-shadow-sm">{preset.emoji}</span>
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
  const [, navigate] = useLocation();
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
  const [saveMessage, setSaveMessage] = useState("");
  const [eyeStats, setEyeStats] = useState<any>(null);
  const [lessonMessage, setLessonMessage] = useState("Which word is CAT?");
  const [lessonState, setLessonState] = useState<"ready" | "correct" | "retry">("ready");

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

  const speak = (text: string, excited = false) => {
    if (!draft.voiceEnabled) return;
    speakCharacterAI(text, {
      calmMode: !!draft.calmMode,
      onFallback: () => {
        speakCharacter(text, {
          excitement: draft.calmMode ? "calm" : excited ? "excited" : "normal",
        });
      },
    });
  };

  const saveBuddy = async () => {
    const token = getTokenFromCookie();
    if (!token) return;

    setSaving(true);
    setSaveMessage("");
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
      setSaveMessage("Buddy saved!");
      if (normalized.voiceEnabled) {
        speakCharacterAI(`Hi ${firstName}! I'm ${normalized.name}. Let's learn together!`, {
          calmMode: !!normalized.calmMode,
          onFallback: () => speakCharacter(`Hi ${firstName}! I'm ${normalized.name}. Let's learn together!`, {
            excitement: normalized.calmMode ? "calm" : "excited",
          }),
        });
      }
    } catch (error: any) {
      setSaveMessage(error?.message || "Could not save buddy.");
    } finally {
      setSaving(false);
    }
  };

  const uploadPicture = (file?: File) => {
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setSaveMessage("Please choose a PNG, JPG, or WEBP picture.");
      return;
    }

    if (file.size > 1_500_000) {
      setSaveMessage("Please choose a picture under 1.5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setDraft(prev => ({
        ...prev,
        type: "upload",
        imageData: String(reader.result || ""),
      }));
      setSaveMessage("");
    };
    reader.readAsDataURL(file);
  };

  const choosePreset = (preset: BuddyPreset) => {
    const item = PRESETS[preset];
    setDraft(prev => ({
      ...prev,
      type: "preset",
      preset,
      imageData: null,
      name: prev.name === "Buddy" || Object.values(PRESETS).some(p => p.label === prev.name)
        ? item.label
        : prev.name,
    }));
  };

  const chooseLesson = (word: string) => {
    if (word === "CAT") {
      setLessonState("correct");
      setLessonMessage("YES! You found CAT! Great job!");
      speak("Yes! You found cat! Great job!", true);
    } else {
      setLessonState("retry");
      setLessonMessage("Good try! Look again. Which word says CAT?");
      speak("Good try! Look again. Which word says cat?");
    }

    window.setTimeout(() => {
      setLessonState("ready");
      setLessonMessage("Which word is CAT?");
    }, 1800);
  };

  const level = eyeStats?.current_level || 1;
  const completed = eyeStats?.total_completed || quizzesTaken || 0;
  const heroBuddy = draft;

  return (
    <div className="min-h-screen bg-[#f7fbff] text-slate-900">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-sky-100">
        <div className="max-w-[1500px] mx-auto h-20 px-4 sm:px-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/library")}
            className="flex items-center gap-3 mr-auto"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-300 via-sky-300 to-violet-400 flex items-center justify-center text-2xl shadow-sm">
              🌈
            </div>
            <div className="text-left leading-tight">
              <div className="text-lg sm:text-xl font-black tracking-wide text-blue-700">A.R.I.S.E.</div>
              <div className="text-xl sm:text-2xl font-black text-blue-950">Reader</div>
            </div>
          </button>

          <nav className="hidden lg:flex items-center gap-2">
            <button onClick={() => navigate("/eye-gaze-home")} className="px-4 py-3 rounded-2xl font-black text-slate-600 hover:bg-blue-50 flex items-center gap-2">
              <Home className="w-5 h-5" /> Home
            </button>
            <button onClick={() => navigate("/library")} className="px-4 py-3 rounded-2xl font-black text-slate-600 hover:bg-blue-50 flex items-center gap-2">
              <BookOpen className="w-5 h-5" /> My Lessons
            </button>
            <button onClick={() => navigate("/leaderboard")} className="px-4 py-3 rounded-2xl font-black text-slate-600 hover:bg-blue-50 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400 fill-current" /> My Progress
            </button>
            <div className="px-5 py-3 rounded-2xl bg-blue-100 text-blue-900 font-black flex items-center gap-2">
              <Users className="w-5 h-5" /> My Learning Buddy
            </div>
          </nav>

          <div className="hidden sm:flex items-center gap-2 pl-3">
            <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <UserRound className="w-6 h-6" />
            </div>
            <div className="font-black text-blue-950">Hi, {firstName}!</div>
          </div>
        </div>
      </header>

      <div className="max-w-[1500px] mx-auto flex">
        <aside className="hidden xl:flex w-28 flex-col items-center gap-5 py-6 px-3 border-r border-sky-100 bg-white/70">
          <button onClick={() => navigate("/eye-gaze-home")} className="w-full min-h-[86px] rounded-3xl hover:bg-blue-50 flex flex-col items-center justify-center gap-2 text-slate-500 font-black text-xs">
            <Home className="w-7 h-7" /> Home
          </button>
          <button onClick={() => navigate("/library")} className="w-full min-h-[86px] rounded-3xl hover:bg-blue-50 flex flex-col items-center justify-center gap-2 text-slate-500 font-black text-xs">
            <BookOpen className="w-7 h-7" /> Read
          </button>
          <button onClick={() => navigate("/eye-gaze-games")} className="w-full min-h-[86px] rounded-3xl hover:bg-blue-50 flex flex-col items-center justify-center gap-2 text-slate-500 font-black text-xs">
            <Gamepad2 className="w-7 h-7" /> Games
          </button>
          <button onClick={() => navigate("/leaderboard")} className="w-full min-h-[86px] rounded-3xl hover:bg-blue-50 flex flex-col items-center justify-center gap-2 text-slate-500 font-black text-xs">
            <Trophy className="w-7 h-7 text-yellow-400" /> Progress
          </button>
          <div className="w-full min-h-[100px] rounded-3xl bg-violet-500 text-white flex flex-col items-center justify-center gap-2 font-black text-xs text-center px-1">
            <Users className="w-7 h-7" /> My Learning Buddy
          </div>
          <button onClick={() => navigate("/profile")} className="w-full min-h-[86px] rounded-3xl hover:bg-blue-50 flex flex-col items-center justify-center gap-2 text-slate-500 font-black text-xs">
            <Settings className="w-7 h-7" /> Settings
          </button>
        </aside>

        <main className="flex-1 min-w-0 p-3 sm:p-5 lg:p-6 space-y-4">
          <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-amber-100 via-orange-50 to-sky-100 border border-sky-100 min-h-[310px]">
            <div className="absolute inset-0 opacity-50">
              <div className="absolute top-5 left-[8%] text-5xl">⭐</div>
              <div className="absolute bottom-6 right-[8%] text-5xl">🌈</div>
              <div className="absolute top-10 right-[15%] text-4xl">☀️</div>
            </div>

            <div className="relative grid md:grid-cols-[380px_1fr] items-center gap-5 p-5 sm:p-7">
              <button
                type="button"
                onClick={() => speak(`Hi ${firstName}! I'm ${heroBuddy.name}. Let's learn together!`, true)}
                className="mx-auto relative group"
              >
                <BuddyVisual buddy={heroBuddy} className="w-56 h-56 sm:w-64 sm:h-64 text-[8rem] sm:text-[10rem] group-hover:scale-105 transition-transform" />
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 text-white px-4 py-2 text-xs font-black shadow">
                  TAP ME!
                </div>
              </button>

              <div className="relative bg-white border-4 border-blue-500 rounded-[2.5rem] px-6 py-7 sm:px-9 sm:py-8 text-center shadow-sm">
                <div className="hidden md:block absolute -left-7 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[22px] border-y-transparent border-r-[30px] border-r-blue-500" />
                <p className="text-2xl sm:text-4xl font-black text-blue-950 leading-tight">
                  Hi! I'm your reading buddy!
                </p>
                <p className="text-xl sm:text-3xl font-black text-blue-800 mt-2">
                  Let's find the word
                </p>
                <p className="text-5xl sm:text-7xl font-black text-blue-600 mt-2 tracking-wide">
                  CAT!
                </p>
              </div>
            </div>
          </section>

          <section className="grid lg:grid-cols-[1fr_360px] gap-4">
            <div className="rounded-[2rem] border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-4 sm:p-5">
              <h2 className="text-2xl sm:text-3xl font-black text-blue-950 mb-4">Choose a Buddy</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(Object.keys(PRESETS) as BuddyPreset[]).map(key => {
                  const preset = PRESETS[key];
                  const selected = draft.type === "preset" && draft.preset === key;
                  return (
    <div className="bg-[#f7fbff] text-slate-900 min-h-screen">
      <main className="max-w-[1500px] mx-auto p-3 sm:p-5 lg:p-6 space-y-4">

          <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-amber-100 via-orange-50 to-sky-100 border border-sky-100 min-h-[310px]">
            <div className="absolute inset-0 opacity-50">
              <div className="absolute top-5 left-[8%] text-5xl">⭐</div>
              <div className="absolute bottom-6 right-[8%] text-5xl">🌈</div>
              <div className="absolute top-10 right-[15%] text-4xl">☀️</div>
            </div>

            <div className="relative grid md:grid-cols-[380px_1fr] items-center gap-5 p-5 sm:p-7">
              <button
                type="button"
                onClick={() => speak(`Hi ${firstName}! I'm ${heroBuddy.name}. Let's learn together!`, true)}
                className="mx-auto relative group"
              >
                <BuddyVisual buddy={heroBuddy} className="w-56 h-56 sm:w-64 sm:h-64 text-[8rem] sm:text-[10rem] group-hover:scale-105 transition-transform" />
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 text-white px-4 py-2 text-xs font-black shadow">
                  TAP ME!
                </div>
              </button>

              <div className="relative bg-white border-4 border-blue-500 rounded-[2.5rem] px-6 py-7 sm:px-9 sm:py-8 text-center shadow-sm">
                <div className="hidden md:block absolute -left-7 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[22px] border-y-transparent border-r-[30px] border-r-blue-500" />
                <p className="text-2xl sm:text-4xl font-black text-blue-950 leading-tight">
                  Hi! I'm your reading buddy!
                </p>
                <p className="text-xl sm:text-3xl font-black text-blue-800 mt-2">
                  Let's find the word
                </p>
                <p className="text-5xl sm:text-7xl font-black text-blue-600 mt-2 tracking-wide">
                  CAT!
                </p>
              </div>
            </div>
          </section>

          <section className="grid lg:grid-cols-[1fr_360px] gap-4">
            <div className="rounded-[2rem] border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-4 sm:p-5">
              <h2 className="text-2xl sm:text-3xl font-black text-blue-950 mb-4">Choose a Buddy</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(Object.keys(PRESETS) as BuddyPreset[]).map(key => {
                  const preset = PRESETS[key];
                  const selected = draft.type === "preset" && draft.preset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        choosePreset(key);
                        speak(`Hi! I'm ${preset.label}. Pick me as your learning buddy!`);
                      }}
                      className={`rounded-3xl overflow-hidden border-4 transition-all bg-white min-h-[190px] ${
                        selected ? "border-sky-500 ring-4 ring-sky-100" : "border-transparent hover:border-sky-200"
                      }`}
                    >
                      <div className={`h-36 bg-gradient-to-br ${preset.bg} flex items-center justify-center text-7xl`}>
                        {preset.emoji}
                      </div>
                      <div className={`py-3 text-xl font-black text-white ${
                        key === "puppy" ? "bg-sky-500" :
                        key === "dino" ? "bg-emerald-500" :
                        key === "robot" ? "bg-violet-500" :
                        "bg-pink-500"
                      }`}>
                        {preset.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[2rem] border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5">
              <h2 className="text-2xl font-black text-blue-950 mb-4">Upload Your Favorite Picture</h2>
              <label className="min-h-[225px] rounded-3xl border-4 border-dashed border-blue-200 bg-white flex flex-col items-center justify-center text-center p-5 cursor-pointer hover:bg-blue-50 transition-colors">
                {draft.type === "upload" && draft.imageData ? (
                  <>
                    <BuddyVisual buddy={draft} className="w-28 h-28 text-6xl mb-3" />
                    <div className="font-black text-blue-950">Picture selected!</div>
                    <div className="text-sm text-slate-500 mt-1">Tap to choose a different picture.</div>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-3xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                      <Camera className="w-10 h-10" />
                    </div>
                    <div className="text-xl font-black text-blue-950">Click to upload a photo</div>
                    <div className="text-sm text-slate-500 mt-2">Use a favorite picture to guide lessons.</div>
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
                onClick={() => {
                  setDraft(prev => ({ ...prev, voiceEnabled: !prev.voiceEnabled }));
                }}
                className="min-h-[88px] rounded-3xl border border-sky-100 bg-sky-50 px-5 flex items-center gap-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  {draft.voiceEnabled ? <Volume2 className="w-7 h-7" /> : <VolumeX className="w-7 h-7" />}
                </div>
                <div className="text-left flex-1">
                  <div className="text-xl font-black text-blue-950">Buddy Voice: {draft.voiceEnabled ? "On" : "Off"}</div>
                  <div className="text-xs text-slate-500">Natural AI-generated character voice during lessons</div>
                </div>
                <div className={`w-16 h-9 rounded-full p-1 transition-colors ${draft.voiceEnabled ? "bg-green-400" : "bg-slate-300"}`}>
                  <div className={`w-7 h-7 rounded-full bg-white transition-transform ${draft.voiceEnabled ? "translate-x-7" : ""}`} />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDraft(prev => ({ ...prev, calmMode: !prev.calmMode }))}
                className="min-h-[88px] rounded-3xl border border-violet-100 bg-violet-50 px-5 flex items-center gap-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center text-3xl">🪷</div>
                <div className="text-left flex-1">
                  <div className="text-xl font-black text-blue-950">Calm Mode</div>
                  <div className="text-xs text-slate-500">Quieter voice and slower pace</div>
                </div>
                <div className={`w-16 h-9 rounded-full p-1 transition-colors ${draft.calmMode ? "bg-violet-500" : "bg-slate-300"}`}>
                  <div className={`w-7 h-7 rounded-full bg-white transition-transform ${draft.calmMode ? "translate-x-7" : ""}`} />
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

            {saveMessage && (
              <div className="mt-3 text-center font-black text-blue-800">{saveMessage}</div>
            )}
          </section>

          <section className={`rounded-[2rem] border-2 overflow-hidden transition-colors ${
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
                  <button
                    type="button"
                    onClick={() => speak(lessonMessage, lessonState === "correct")}
                    className="flex-shrink-0"
                  >
                    <BuddyVisual buddy={heroBuddy} className="w-32 h-32 sm:w-40 sm:h-40 text-7xl sm:text-8xl hover:scale-105 transition-transform" />
                  </button>
                  <div className="relative rounded-3xl bg-white border-4 border-blue-500 px-5 py-5 text-center flex-1">
                    <div className="text-xl sm:text-2xl font-black text-blue-950 leading-tight">{lessonMessage}</div>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 grid grid-cols-3 gap-3 items-stretch">
                {LESSON_CHOICES.map(choice => (
                  <button
                    key={choice.word}
                    type="button"
                    onClick={() => chooseLesson(choice.word)}
                    className="min-h-[210px] rounded-3xl border-2 border-yellow-200 bg-white hover:border-blue-400 hover:scale-[1.02] transition-all flex flex-col items-center justify-center p-4"
                  >
                    <div className="text-6xl sm:text-7xl mb-4">{choice.emoji}</div>
                    <div className="text-3xl sm:text-5xl font-black text-slate-950 tracking-wide">{choice.word}</div>
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
