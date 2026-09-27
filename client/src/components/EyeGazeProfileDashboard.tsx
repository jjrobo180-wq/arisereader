import { useEffect, useState } from "react";
import { Camera, CheckCircle2, Gamepad2, Sparkles, Upload, Volume2, VolumeX } from "lucide-react";
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

const PRESETS: Record<BuddyPreset, { emoji: string; label: string; bg: string }> = {
  puppy: { emoji: "🐶", label: "Puppy", bg: "from-sky-200 to-blue-100" },
  dino: { emoji: "🦖", label: "Dino", bg: "from-lime-200 to-emerald-100" },
  robot: { emoji: "🤖", label: "Robot", bg: "from-violet-200 to-indigo-100" },
  bunny: { emoji: "🐰", label: "Bunny", bg: "from-pink-200 to-rose-100" },
};

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
    return <img src={buddy.imageData} alt={buddy.name} className={`object-cover rounded-[2rem] border-4 border-white shadow-lg ${className}`} />;
  }
  const preset = PRESETS[buddy.preset] || PRESETS.puppy;
  return (
    <div className={`rounded-[2rem] border-4 border-white shadow-lg bg-gradient-to-br ${preset.bg} flex items-center justify-center ${className}`} aria-label={preset.label}>
      <span>{preset.emoji}</span>
    </div>
  );
}

export default function EyeGazeProfileDashboard({ displayName }: { displayName: string }) {
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
  const firstName = displayName?.split(" ")[0] || "Learner";

  useEffect(() => {
    const token = getTokenFromCookie();
    if (!token) return;
    fetch(`${API_BASE}/api/eye-gaze/learning-buddy`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(r => r.ok ? r.json() : null)
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
      name: prev.name === "Buddy" || Object.values(PRESETS).some(x => x.label === prev.name) ? selected.label : prev.name,
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not save buddy.");
      const normalized = { ...data, calmMode: !!data.calmMode };
      setBuddy(normalized);
      setDraft(normalized);
      setMessage("Learning Buddy saved!");
      if (normalized.voiceEnabled) speak(`Hi ${firstName}! I'm ${normalized.name}. Let's learn together!`);
    } catch (error: any) {
      setMessage(error?.message || "Could not save buddy.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <section className="rounded-[2rem] border border-sky-100 bg-gradient-to-r from-sky-100 via-white to-violet-100 p-5 sm:p-7">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <button type="button" onClick={() => speak(`Hi ${firstName}! I'm ${draft.name}. Let's learn together!`)} className="relative flex-shrink-0">
            <div className={voicePlaying ? "animate-bounce" : ""}>
              <BuddyVisual buddy={draft} className="w-44 h-44 sm:w-52 sm:h-52 text-[7rem] sm:text-[8rem]" />
            </div>
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 text-white px-4 py-2 text-xs font-black whitespace-nowrap">
              {voicePlaying ? "TALKING..." : "TAP TO HEAR"}
            </span>
          </button>

          <div className="flex-1 text-center md:text-left">
            <p className="text-sm font-black uppercase tracking-widest text-violet-600">My Buddy</p>
            <h1 className="text-3xl sm:text-5xl font-black text-blue-950 mt-1">{draft.name}</h1>
            <p className="text-lg font-bold text-slate-600 mt-2">Pick your learning friend, hear their voice, and customize them here.</p>
            <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <button type="button" onClick={() => speak(`Hi ${firstName}! I'm ${draft.name}. Let's learn together!`)} className="min-h-[54px] rounded-2xl bg-blue-100 text-blue-800 px-5 font-black inline-flex items-center justify-center gap-2">
                <Volume2 className="w-5 h-5" /> Hear Buddy
              </button>
              <button type="button" onClick={() => speak(`You can do it, ${firstName}! I'm ${draft.name}, and I'm cheering for you!`)} className="min-h-[54px] rounded-2xl bg-amber-400 text-blue-950 px-5 font-black inline-flex items-center justify-center gap-2">
                ⭐ Cheer Me On
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-[1.35fr_.65fr] gap-4">
        <div className="rounded-[2rem] border border-violet-100 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-6 h-6 text-violet-500" />
            <h2 className="text-2xl font-black text-blue-950">Choose a Buddy</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.keys(PRESETS) as BuddyPreset[]).map(key => {
              const preset = PRESETS[key];
              const selected = draft.type === "preset" && draft.preset === key;
              return (
                <button key={key} type="button" onClick={() => choosePreset(key)} className={`rounded-3xl border-4 transition-all bg-white min-h-[150px] overflow-hidden ${selected ? "border-sky-500 ring-4 ring-sky-100" : "border-slate-100 hover:border-sky-200"}`}>
                  <div className={`h-24 bg-gradient-to-br ${preset.bg} flex items-center justify-center text-6xl`}>{preset.emoji}</div>
                  <div className="py-3 text-lg font-black text-blue-950">{preset.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[2rem] border border-sky-100 bg-white p-5">
          <h2 className="text-2xl font-black text-blue-950 mb-4">Use a Favorite Picture</h2>
          <label className="min-h-[190px] rounded-3xl border-4 border-dashed border-blue-200 bg-sky-50 flex flex-col items-center justify-center text-center p-5 cursor-pointer hover:bg-blue-50">
            {draft.type === "upload" && draft.imageData ? (
              <>
                <BuddyVisual buddy={draft} className="w-24 h-24 text-5xl mb-3" />
                <div className="font-black text-blue-950">Picture selected</div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3"><Camera className="w-8 h-8" /></div>
                <div className="font-black text-blue-950">Upload a picture</div>
                <div className="text-xs text-slate-500 mt-1">A favorite person, character, pet, or familiar image.</div>
              </>
            )}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => uploadPicture(e.target.files?.[0])} />
          </label>
        </div>
      </section>

      <section className="rounded-[2rem] border border-sky-100 bg-white p-4">
        <div className="grid md:grid-cols-3 gap-3">
          <button type="button" onClick={() => setDraft(prev => ({ ...prev, voiceEnabled: !prev.voiceEnabled }))} className="min-h-[82px] rounded-3xl bg-sky-50 px-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
              {draft.voiceEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </div>
            <div className="text-left">
              <div className="font-black text-blue-950">Voice {draft.voiceEnabled ? "On" : "Off"}</div>
              <div className="text-xs text-slate-500">Buddy voice stays on this My Buddy page</div>
            </div>
          </button>

          <button type="button" onClick={() => setDraft(prev => ({ ...prev, calmMode: !prev.calmMode }))} className="min-h-[82px] rounded-3xl bg-violet-50 px-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center text-2xl">🪷</div>
            <div className="text-left">
              <div className="font-black text-blue-950">Calm Mode {draft.calmMode ? "On" : "Off"}</div>
              <div className="text-xs text-slate-500">Slower, gentler coaching</div>
            </div>
          </button>

          <button type="button" onClick={saveBuddy} disabled={saving} className="min-h-[82px] rounded-3xl bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white px-6 flex items-center justify-center gap-3 text-xl font-black">
            <CheckCircle2 className="w-7 h-7" /> {saving ? "Saving..." : "Save My Buddy"}
          </button>
        </div>
        {message && <div className="mt-3 text-center font-black text-blue-800">{message}</div>}
      </section>
    </main>
  );
}
