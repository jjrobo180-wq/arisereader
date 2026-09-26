import { useEffect, useMemo, useRef, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { ArrowLeft, Camera, CheckCircle2, Eye, Focus, Home, MapPin, Plus, Save, Sparkles, Star, Trash2, Upload, Video, WandSparkles } from "lucide-react";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";

type MediaType = "image" | "video";
type WorldItem = {
  id: string;
  label: string;
  phrase: string;
  mediaPath?: string | null;
  mediaUrl?: string | null;
  mediaType?: MediaType | null;
  x: number;
  y: number;
  w: number;
  h: number;
  source?: "manual" | "ai";
  confidence?: number | null;
};
type MyWorld = {
  id: string;
  name: string;
  icon: string;
  backgroundPath?: string | null;
  backgroundUrl?: string | null;
  items: WorldItem[];
};
type MyWorldState = {
  student: { id: number; name: string };
  canEdit: boolean;
  setupComplete: boolean;
  worlds: MyWorld[];
  progress: { stars?: number; learned?: Record<string, any>; history?: any[] };
};

const STARTERS = [
  { name: "My Bedroom", icon: "🛏️" },
  { name: "My Kitchen", icon: "🥛" },
  { name: "Getting Ready", icon: "👟" },
  { name: "My Bathroom", icon: "🪥" },
  { name: "Outside", icon: "🌳" },
];

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36) || `world-${Date.now()}`;
}

function tokenFromCookie() {
  try {
    const match = document.cookie.match(/arise_session=([^;]+)/);
    if (!match) return null;
    return JSON.parse(atob(match[1])).token || null;
  } catch {
    return null;
  }
}

function DwellButton({
  children,
  onSelect,
  className = "",
  label,
  style,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  className?: string;
  label: string;
  style?: React.CSSProperties;
}) {
  const timer = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setActive(false);
  };
  const start = () => {
    stop();
    setActive(true);
    timer.current = window.setTimeout(() => {
      stop();
      onSelect();
    }, 1150);
  };
  useEffect(() => stop, []);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => { stop(); onSelect(); }}
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={stop}
      className={`${className.includes("absolute") ? "absolute" : "relative"} overflow-hidden ${active ? "ring-4 ring-blue-500 ring-offset-2" : ""} ${className}`}
      style={style}
    >
      {children}
      {active && <span className="absolute inset-x-0 bottom-0 h-2 bg-blue-500 animate-pulse" />}
    </button>
  );
}

function Media({ item, className = "" }: { item: WorldItem; className?: string }) {
  if (!item.mediaUrl) return <div className={`grid place-items-center bg-sky-100 text-5xl ${className}`}>📷</div>;
  if (item.mediaType === "video") {
    return <video src={item.mediaUrl} className={className} controls playsInline preload="metadata" />;
  }
  return <img src={item.mediaUrl} alt={item.label} className={`object-cover ${className}`} />;
}


function safeBox(item: Partial<WorldItem>) {
  const w = Math.max(4, Math.min(60, Number(item.w) || 18));
  const h = Math.max(4, Math.min(60, Number(item.h) || 18));
  let x = Number(item.x);
  let y = Number(item.y);
  if (!Number.isFinite(x)) x = 41;
  if (!Number.isFinite(y)) y = 41;
  x = Math.max(0, Math.min(100 - w, x));
  y = Math.max(0, Math.min(100 - h, y));
  return { x, y, w, h };
}

function RoomCrop({ world, item, className = "" }: { world: MyWorld; item: WorldItem; className?: string }) {
  if (!world.backgroundUrl) return <Media item={item} className={className} />;
  const box = safeBox(item);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const zoom = Math.min(650, Math.max(180, 6500 / Math.max(box.w, box.h)));
  return (
    <div
      className={`bg-slate-100 bg-no-repeat ${className}`}
      style={{
        backgroundImage: `url("${world.backgroundUrl}")`,
        backgroundSize: `${zoom}% auto`,
        backgroundPosition: `${cx}% ${cy}%`,
      }}
      role="img"
      aria-label={`Close-up of ${item.label} in ${world.name}`}
    />
  );
}

export default function EyeGazeMyWorld() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const authToken = token || tokenFromCookie();
  const [data, setData] = useState<MyWorldState | null>(null);
  const [worlds, setWorlds] = useState<MyWorld[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [builderWorldId, setBuilderWorldId] = useState<string | null>(null);
  const [placingItemId, setPlacingItemId] = useState<string | null>(null);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [newPlaceIcon, setNewPlaceIcon] = useState("🏠");
  const [itemLabel, setItemLabel] = useState("");
  const [itemPhrase, setItemPhrase] = useState("");
  const [itemFile, setItemFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<"explore" | "ispy">("ispy");
  const [targetIndex, setTargetIndex] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [stars, setStars] = useState(0);
  const [grownupToken, setGrownupToken] = useState("");
  const [gateOpen, setGateOpen] = useState(false);
  const [challenge, setChallenge] = useState<{ challengeId: string; question: string } | null>(null);
  const [mathAnswer, setMathAnswer] = useState("");
  const [gateError, setGateError] = useState("");
  const [gateLoading, setGateLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [focusedItem, setFocusedItem] = useState<WorldItem | null>(null);

  const isParent = user?.role === "parent";
  const canBuild = isParent || !!grownupToken;
  const selectedWorld = useMemo(() => worlds.find(w => w.id === selectedWorldId) || null, [worlds, selectedWorldId]);
  const builderWorld = useMemo(() => worlds.find(w => w.id === builderWorldId) || null, [worlds, builderWorldId]);
  const target = selectedWorld?.items[targetIndex % Math.max(1, selectedWorld?.items.length || 1)] || null;

  const speak = (text: string) => {
    if (!text) return;
    stopSpeaking();
    void speakCharacterAI(text, {
      calmMode: true,
      onFallback: () => {
        if (!("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.84;
        window.speechSynthesis.speak(utterance);
      },
    });
  };

  const load = async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/eye-gaze/my-world`, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: "no-store",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Could not load My World.");
      setData(result);
      const normalizedWorlds = (result.worlds || []).map((world: MyWorld) => ({
        ...world,
        items: (world.items || []).map((item: any) => {
          if (Number.isFinite(Number(item.w)) && Number.isFinite(Number(item.h))) return { ...item, ...safeBox(item) };
          const legacyW = 18;
          const legacyH = 18;
          return { ...item, x: Math.max(0, Number(item.x || 50) - legacyW / 2), y: Math.max(0, Number(item.y || 55) - legacyH / 2), w: legacyW, h: legacyH, source: item.source || "manual" };
        }),
      }));
      setWorlds(normalizedWorlds);
      setStars(Number(result.progress?.stars || 0));
    } catch (error: any) {
      setNotice(error?.message || "Could not load My World.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    return () => stopSpeaking();
  }, [authToken, user?.id]);


  const getNewChallenge = async (message = "") => {
    if (!authToken || isParent) return;
    setGateLoading(true);
    setGateError(message);
    setMathAnswer("");
    try {
      const res = await fetch(`${API_BASE}/api/eye-gaze/my-world/grownup-challenge`, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: "no-store",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Could not open the grown-up check.");
      setChallenge(result);
      setGateOpen(true);
    } catch (error: any) {
      setGateError(error?.message || "Could not open the grown-up check.");
      setGateOpen(true);
    } finally {
      setGateLoading(false);
    }
  };

  const startGrownupGate = () => {
    setSelectedWorldId(null);
    setGateOpen(true);
    void getNewChallenge();
  };

  const submitGrownupGate = async () => {
    if (!authToken || !challenge || !mathAnswer.trim()) return;
    setGateLoading(true);
    setGateError("");
    try {
      const res = await fetch(`${API_BASE}/api/eye-gaze/my-world/grownup-challenge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.challengeId, answer: Number(mathAnswer) }),
      });
      const result = await res.json();
      if (!res.ok) {
        await getNewChallenge(result.message || "Not quite. Try this one.");
        return;
      }
      setGrownupToken(result.grownupToken || "");
      setGateOpen(false);
      setChallenge(null);
      setMathAnswer("");
      setBuilderWorldId(worlds[0]?.id || null);
      setNotice("Grown-up setup unlocked for 30 minutes.");
    } catch (error: any) {
      await getNewChallenge(error?.message || "Try another grown-up question.");
    } finally {
      setGateLoading(false);
    }
  };

  const grownupHeader = grownupToken ? { "X-My-World-Grownup-Token": grownupToken } : {};

  const uploadMedia = async (file: File, label: string) => {
    if (!authToken) throw new Error("Please sign in again.");
    const res = await fetch(`${API_BASE}/api/eye-gaze/my-world/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": file.type,
        "X-My-World-Label": label,
        ...grownupHeader,
      },
      body: file,
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.message || "Could not upload that file.");
    return result as { path: string; mediaType: MediaType; url: string | null };
  };

  const saveWorlds = async (finish = false) => {
    if (!authToken) return;
    setSaving(true);
    setNotice("");
    try {
      const res = await fetch(`${API_BASE}/api/eye-gaze/my-world/config`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json", ...grownupHeader },
        body: JSON.stringify({ worlds, setupComplete: finish || !!data?.setupComplete }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Could not save My World.");
      setWorlds(result.worlds || worlds);
      setData(prev => prev ? { ...prev, setupComplete: result.setupComplete, worlds: result.worlds || worlds } : prev);
      setNotice(finish ? "My World is ready for your child!" : "Saved.");
    } catch (error: any) {
      setNotice(error?.message || "Could not save My World.");
    } finally {
      setSaving(false);
    }
  };

  const addStarter = (starter: { name: string; icon: string }) => {
    const base = slug(starter.name);
    const id = worlds.some(w => w.id === base) ? `${base}-${worlds.length + 1}` : base;
    const next = [...worlds, { id, name: starter.name, icon: starter.icon, backgroundPath: null, backgroundUrl: null, items: [] }];
    setWorlds(next);
    setBuilderWorldId(id);
  };

  const addCustomPlace = () => {
    const name = newPlaceName.trim();
    if (!name) return;
    const base = slug(name);
    const id = worlds.some(w => w.id === base) ? `${base}-${worlds.length + 1}` : base;
    setWorlds(prev => [...prev, { id, name, icon: newPlaceIcon || "🏠", backgroundPath: null, backgroundUrl: null, items: [] }]);
    setBuilderWorldId(id);
    setNewPlaceName("");
    setNewPlaceIcon("🏠");
  };

  const uploadBackground = async (file?: File) => {
    if (!file || !builderWorld) return;
    setUploading(true);
    setNotice("");
    try {
      if (!file.type.startsWith("image/")) throw new Error("Use a photo for the room/background.");
      const uploaded = await uploadMedia(file, builderWorld.name);
      setWorlds(prev => prev.map(w => w.id === builderWorld.id ? { ...w, backgroundPath: uploaded.path, backgroundUrl: uploaded.url } : w));
    } catch (error: any) {
      setNotice(error?.message || "Could not upload the room photo.");
    } finally {
      setUploading(false);
    }
  };

  const addItem = async () => {
    if (!builderWorld || !itemLabel.trim()) return;
    setUploading(true);
    setNotice("");
    try {
      let uploaded: { path: string; mediaType: MediaType; url: string | null } | null = null;
      if (itemFile) uploaded = await uploadMedia(itemFile, itemLabel);
      const label = itemLabel.trim();
      const item: WorldItem = {
        id: `${slug(label)}-${Date.now().toString(36)}`,
        label,
        phrase: itemPhrase.trim() || `This is ${label}.`,
        mediaPath: uploaded?.path || null,
        mediaUrl: uploaded?.url || null,
        mediaType: uploaded?.mediaType || null,
        x: 41,
        y: 41,
        w: 18,
        h: 18,
        source: "manual",
      };
      setWorlds(prev => prev.map(w => w.id === builderWorld.id ? { ...w, items: [...w.items, item] } : w));
      setPlacingItemId(item.id);
      setItemLabel("");
      setItemPhrase("");
      setItemFile(null);
      setNotice("Item added. Now tap the room photo where it belongs.");
    } catch (error: any) {
      setNotice(error?.message || "Could not add that item.");
    } finally {
      setUploading(false);
    }
  };

  const pointerPercent = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
    };
  };

  const startTagBox = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!builderWorld || !placingItemId) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = pointerPercent(event);
    setDrawStart(point);
    setDrawCurrent(point);
  };

  const moveTagBox = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawStart || !placingItemId) return;
    setDrawCurrent(pointerPercent(event));
  };

  const finishTagBox = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!builderWorld || !placingItemId || !drawStart) return;
    const end = pointerPercent(event);
    let x = Math.min(drawStart.x, end.x);
    let y = Math.min(drawStart.y, end.y);
    let w = Math.abs(end.x - drawStart.x);
    let h = Math.abs(end.y - drawStart.y);

    // A simple tap creates a useful default-size box centered on the tap.
    if (w < 3 && h < 3) {
      w = 18;
      h = 18;
      x = Math.max(0, Math.min(82, end.x - 9));
      y = Math.max(0, Math.min(82, end.y - 9));
    } else {
      w = Math.max(4, Math.min(60, w));
      h = Math.max(4, Math.min(60, h));
      x = Math.max(0, Math.min(100 - w, x));
      y = Math.max(0, Math.min(100 - h, y));
    }

    setWorlds(prev => prev.map(world => world.id === builderWorld.id ? {
      ...world,
      items: world.items.map(item => item.id === placingItemId ? { ...item, x, y, w, h, source: item.source || "manual" } : item),
    } : world));
    setDrawStart(null);
    setDrawCurrent(null);
    setNotice("Tagged! The box is the exact area your child can choose.");
  };

  const cancelTagBox = () => {
    setDrawStart(null);
    setDrawCurrent(null);
  };

  const updateItem = (itemId: string, patch: Partial<WorldItem>) => {
    if (!builderWorld) return;
    setWorlds(prev => prev.map(world => world.id === builderWorld.id ? {
      ...world,
      items: world.items.map(item => item.id === itemId ? { ...item, ...patch } : item),
    } : world));
  };

  const runAiTagging = async () => {
    if (!authToken || !builderWorld?.backgroundPath) return;
    setAiLoading(true);
    setNotice("");
    try {
      const res = await fetch(`${API_BASE}/api/eye-gaze/my-world/ai-tag`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json", ...grownupHeader },
        body: JSON.stringify({ backgroundPath: builderWorld.backgroundPath, worldName: builderWorld.name }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "AI could not tag this room.");
      const existing = new Set(builderWorld.items.map(item => item.label.toLowerCase()));
      const suggestions: WorldItem[] = (result.objects || [])
        .filter((obj: any) => obj?.label && !existing.has(String(obj.label).toLowerCase()))
        .map((obj: any, index: number) => ({
          id: `${obj.id || `ai-${slug(obj.label)}`}-${Date.now().toString(36)}-${index}`,
          label: String(obj.label).slice(0, 40),
          phrase: String(obj.phrase || `I see ${obj.label}.`).slice(0, 160),
          mediaPath: null,
          mediaUrl: null,
          mediaType: null,
          ...safeBox(obj),
          source: "ai" as const,
          confidence: Number(obj.confidence) || null,
        }));
      setWorlds(prev => prev.map(world => world.id === builderWorld.id ? { ...world, items: [...world.items, ...suggestions] } : world));
      setNotice(suggestions.length ? `AI suggested ${suggestions.length} objects. Review the boxes, words, and sentences before saving.` : "AI did not find any new clear objects. You can tag them manually.");
    } catch (error: any) {
      setNotice(error?.message || "AI tagging is unavailable right now. Manual tagging still works.");
    } finally {
      setAiLoading(false);
    }
  };

  const removeWorld = (worldId: string) => {
    setWorlds(prev => prev.filter(w => w.id !== worldId));
    if (builderWorldId === worldId) setBuilderWorldId(null);
  };

  const removeItem = (itemId: string) => {
    if (!builderWorld) return;
    setWorlds(prev => prev.map(w => w.id === builderWorld.id ? { ...w, items: w.items.filter(i => i.id !== itemId) } : w));
    if (placingItemId === itemId) setPlacingItemId(null);
  };

  const record = (item: WorldItem, outcome: "correct" | "retry" | "explored") => {
    if (!authToken) return;
    void fetch(`${API_BASE}/api/eye-gaze/my-world/practice`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ word: item.label, outcome }),
    }).catch(() => {});
  };

  const chooseItem = (item: WorldItem) => {
    if (!selectedWorld) return;
    if (mode === "explore") {
      const text = `${item.label}. ${item.phrase}`;
      setFeedback(text);
      setFocusedItem(item);
      speak(text);
      record(item, "explored");
      return;
    }
    if (!target) return;
    if (item.id !== target.id) {
      const text = `Good try. Find ${target.label}.`;
      setFeedback(text);
      speak(text);
      record(target, "retry");
      return;
    }
    const text = `Yes! You found ${target.label}. ${target.label}. ${target.phrase}`;
    setFeedback(text);
    setStars(value => value + 1);
    setFocusedItem(target);
    speak(text);
    record(target, "correct");
  };

  const playIspyWith = (item: WorldItem) => {
    if (!selectedWorld) return;
    const index = selectedWorld.items.findIndex(candidate => candidate.id === item.id);
    if (index >= 0) setTargetIndex(index);
    setMode("ispy");
    setFocusedItem(null);
    setFeedback("");
    speak(`I spy with my little eye. Find ${item.label}.`);
  };

  const nextIspy = () => {
    if (!selectedWorld?.items.length) return;
    setTargetIndex(index => (index + 1) % selectedWorld.items.length);
    setFocusedItem(null);
    setFeedback("");
    const next = selectedWorld.items[(targetIndex + 1) % selectedWorld.items.length];
    if (next) speak(`I spy with my little eye. Find ${next.label}.`);
  };

  if (!user) return <Redirect to="/" />;
  if (!isParent && !user.is_eye_gaze_user) return <Redirect to="/library" />;

  if (loading) return <div className="min-h-screen grid place-items-center bg-sky-50"><div className="w-14 h-14 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" /></div>;

  if (!isParent && gateOpen && !grownupToken) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-100 via-white to-sky-100 grid place-items-center p-5 text-slate-900">
        <div className="w-full max-w-lg rounded-[2rem] bg-white border-2 border-violet-100 p-6 sm:p-8 text-center shadow-2xl">
          <div className="text-6xl" aria-hidden="true">🧑‍🧒</div>
          <p className="mt-3 text-xs font-black uppercase tracking-widest text-violet-600">Grown-up check</p>
          <h1 className="text-3xl sm:text-4xl font-black text-blue-950 mt-1">A grown-up can set up My World</h1>
          <p className="font-bold text-slate-600 mt-3">Answer one quick math question. No parent account or signup is needed.</p>

          <div className="mt-6 rounded-3xl bg-amber-50 border-2 border-amber-200 p-5">
            <div className="text-sm font-black uppercase tracking-widest text-amber-700">What is</div>
            <div className="text-5xl sm:text-6xl font-black text-slate-950 mt-2">{challenge?.question || "Loading..."}</div>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              value={mathAnswer}
              onChange={e => setMathAnswer(e.target.value.replace(/[^0-9-]/g, "").slice(0, 3))}
              onKeyDown={e => { if (e.key === "Enter") void submitGrownupGate(); }}
              aria-label="Math answer"
              placeholder="Answer"
              className="mt-5 w-full min-h-16 rounded-2xl border-2 border-amber-200 bg-white px-4 text-center text-3xl font-black"
            />
          </div>

          {gateError && <div role="alert" className="mt-3 rounded-2xl bg-rose-50 border border-rose-200 p-3 font-bold text-rose-700">{gateError}</div>}

          <button type="button" disabled={gateLoading || !challenge || !mathAnswer.trim()} onClick={() => void submitGrownupGate()} className="mt-4 w-full min-h-16 rounded-2xl bg-violet-600 text-white text-xl font-black disabled:opacity-50">
            {gateLoading ? "Checking..." : "Unlock Grown-up Setup"}
          </button>
          <button type="button" onClick={() => { setGateOpen(false); setChallenge(null); setGateError(""); }} className="mt-2 w-full min-h-12 rounded-2xl text-slate-500 font-black">Back to My World</button>
          <p className="mt-4 text-xs font-bold text-slate-400">This is a simple grown-up barrier for the child's interface, not a replacement for account security.</p>
        </div>
      </div>
    );
  }

  if (canBuild) {
    return (
      <div className="min-h-screen bg-[#f7fbff] text-slate-900 px-4 sm:px-6 py-5">
        <div className="max-w-6xl mx-auto space-y-5">
          <header className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => { if (isParent) navigate("/parent-dashboard"); else { setGrownupToken(""); setBuilderWorldId(null); setNotice(""); } }} className="min-h-12 rounded-2xl bg-white border-2 border-slate-200 px-4 font-black flex items-center gap-2"><ArrowLeft className="w-5 h-5" /> {isParent ? "Parent Portal" : "My World"}</button>
            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-widest text-violet-600">{isParent ? "Family setup" : "Grown-up setup · unlocked for 30 minutes"}</p>
              <h1 className="text-3xl sm:text-4xl font-black text-blue-950">Build {data?.student.name}'s My World</h1>
            </div>
            <button type="button" disabled={saving} onClick={() => saveWorlds(false)} className="min-h-12 rounded-2xl bg-blue-600 text-white px-5 font-black flex items-center gap-2 disabled:opacity-50"><Save className="w-5 h-5" /> Save</button>
          </header>

          {!data?.setupComplete && (
            <section className="rounded-[2rem] bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-500 text-white p-6 sm:p-8 shadow-xl">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-widest"><Sparkles className="w-4 h-4" /> First-time setup</div>
                <h2 className="text-3xl sm:text-5xl font-black mt-4">Turn real life into the learning game.</h2>
                <p className="mt-3 text-lg font-bold text-white/90">Take or upload a normal or panoramic photo of a real room. Tag the actual objects inside the photo—bed, shoes, TV, cup, toys—and My World turns those exact spots into interactive learning targets. AI Auto‑Tag can suggest objects for you to review.</p>
                <div className="grid sm:grid-cols-3 gap-3 mt-5">
                  <div className="rounded-2xl bg-white/15 p-4"><Camera className="w-7 h-7 mb-2" /><strong className="block">1. Photograph a place</strong><span className="text-sm">Bedroom, kitchen, bathroom, classroom area.</span></div>
                  <div className="rounded-2xl bg-white/15 p-4"><MapPin className="w-7 h-7 mb-2" /><strong className="block">2. Box the objects</strong><span className="text-sm">Draw around the real bed, shoes, TV, cup, toothbrush, toys, and more.</span></div>
                  <div className="rounded-2xl bg-white/15 p-4"><WandSparkles className="w-7 h-7 mb-2" /><strong className="block">3. Or let AI help</strong><span className="text-sm">AI can suggest object boxes, words, and simple sentences. You review before saving.</span></div>
                </div>
              </div>
            </section>
          )}

          <section className="rounded-[2rem] bg-white border border-sky-100 p-5">
            <h2 className="text-2xl font-black text-blue-950">Add a place</h2>
            <div className="flex flex-wrap gap-2 mt-3">
              {STARTERS.map(starter => (
                <button key={starter.name} type="button" onClick={() => addStarter(starter)} className="min-h-12 rounded-2xl bg-sky-50 border-2 border-sky-100 px-4 font-black">{starter.icon} {starter.name}</button>
              ))}
            </div>
            <div className="grid sm:grid-cols-[100px_1fr_auto] gap-2 mt-4">
              <input value={newPlaceIcon} onChange={e => setNewPlaceIcon(e.target.value.slice(0, 8))} aria-label="Place icon" className="min-h-12 rounded-2xl border-2 border-slate-200 px-3 text-center text-2xl" />
              <input value={newPlaceName} onChange={e => setNewPlaceName(e.target.value)} placeholder="Custom place name" className="min-h-12 rounded-2xl border-2 border-slate-200 px-4 font-bold" />
              <button type="button" onClick={addCustomPlace} className="min-h-12 rounded-2xl bg-slate-900 text-white px-5 font-black"><Plus className="w-4 h-4 inline mr-1" /> Add</button>
            </div>
          </section>

          {worlds.length > 0 && (
            <section className="grid lg:grid-cols-[260px_1fr] gap-4">
              <aside className="rounded-[2rem] bg-white border border-sky-100 p-3 space-y-2 h-fit">
                <div className="px-2 py-1 text-xs font-black uppercase tracking-widest text-slate-400">My places</div>
                {worlds.map(world => (
                  <button key={world.id} type="button" onClick={() => { setBuilderWorldId(world.id); setPlacingItemId(null); }} className={`w-full rounded-2xl p-3 flex items-center gap-3 text-left border-2 ${builderWorldId === world.id ? "border-blue-500 bg-blue-50" : "border-transparent bg-slate-50"}`}>
                    <span className="text-3xl">{world.icon}</span>
                    <span className="flex-1 min-w-0"><strong className="block truncate">{world.name}</strong><small className="text-slate-500">{world.items.length} learning items</small></span>
                  </button>
                ))}
              </aside>

              <div className="space-y-4">
                {!builderWorld ? (
                  <div className="rounded-[2rem] bg-white border border-sky-100 p-10 text-center font-bold text-slate-500">Choose a place to build it.</div>
                ) : (
                  <>
                    <section className="rounded-[2rem] bg-white border border-sky-100 p-5">
                      <div className="flex items-start gap-3">
                        <div className="text-4xl">{builderWorld.icon}</div>
                        <div className="flex-1"><h2 className="text-2xl font-black text-blue-950">{builderWorld.name}</h2><p className="text-sm font-bold text-slate-500">Normal and panoramic room photos both work.</p></div>
                        <button type="button" onClick={() => removeWorld(builderWorld.id)} className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 grid place-items-center" aria-label="Delete place"><Trash2 className="w-5 h-5" /></button>
                      </div>
                      <label className="mt-4 min-h-14 rounded-2xl border-2 border-dashed border-blue-200 bg-sky-50 px-4 flex items-center justify-center gap-2 font-black cursor-pointer">
                        <Camera className="w-5 h-5" /> {builderWorld.backgroundUrl ? "Replace room photo" : "Take / upload room photo"}
                        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={e => uploadBackground(e.target.files?.[0])} />
                      </label>
                    </section>

                    {builderWorld.backgroundUrl && (
                      <section className="rounded-[2rem] bg-white border border-sky-100 p-4">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
                          <div className="flex-1">
                            <h3 className="text-xl font-black">Tag the exact object</h3>
                            <p className="text-sm font-bold text-slate-500">
                              {placingItemId
                                ? "Drag a box around the selected object. A quick tap makes a starter box you can redraw."
                                : "Choose an item below, then draw a box around that real object in the room."}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={aiLoading || !builderWorld.backgroundPath}
                            onClick={() => void runAiTagging()}
                            className="min-h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-5 font-black flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            <WandSparkles className="w-5 h-5" />
                            {aiLoading ? "AI is looking..." : "AI Auto‑Tag Room"}
                          </button>
                        </div>

                        <div className="rounded-3xl overflow-x-auto bg-slate-100 border-2 border-slate-100">
                          <div
                            className={`relative min-w-[680px] md:min-w-full ${placingItemId ? "touch-none cursor-crosshair ring-4 ring-inset ring-blue-300" : "touch-pan-x"}`}
                            onPointerDown={startTagBox}
                            onPointerMove={moveTagBox}
                            onPointerUp={finishTagBox}
                            onPointerCancel={cancelTagBox}
                          >
                            <img src={builderWorld.backgroundUrl} alt={builderWorld.name} className="block w-full h-auto select-none pointer-events-none" draggable={false} />

                            {builderWorld.items.map(item => {
                              const box = safeBox(item);
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onPointerDown={event => event.stopPropagation()}
                                  onClick={event => { event.stopPropagation(); setPlacingItemId(item.id); }}
                                  style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`, pointerEvents: placingItemId ? "none" : "auto" }}
                                  className={`absolute border-4 rounded-xl shadow-sm flex items-start justify-start p-1 text-left transition-all ${placingItemId === item.id ? "border-blue-500 bg-blue-500/20 ring-2 ring-white" : item.source === "ai" ? "border-violet-400 bg-violet-400/10" : "border-amber-400 bg-amber-300/10"}`}
                                  aria-label={`Retag ${item.label}`}
                                >
                                  <span className="max-w-full truncate rounded-lg bg-slate-950/80 text-white px-2 py-1 text-[11px] font-black">
                                    {item.source === "ai" ? "✨ " : ""}{item.label}
                                  </span>
                                </button>
                              );
                            })}

                            {drawStart && drawCurrent && (() => {
                              const x = Math.min(drawStart.x, drawCurrent.x);
                              const y = Math.min(drawStart.y, drawCurrent.y);
                              const w = Math.abs(drawCurrent.x - drawStart.x);
                              const h = Math.abs(drawCurrent.y - drawStart.y);
                              return <div className="absolute border-4 border-blue-600 bg-blue-400/20 rounded-xl pointer-events-none" style={{ left: `${x}%`, top: `${y}%`, width: `${Math.max(1, w)}%`, height: `${Math.max(1, h)}%` }} />;
                            })()}
                          </div>
                        </div>
                        <p className="mt-3 text-xs font-bold text-slate-500">AI boxes are suggestions, not final answers. Review them and redraw any box that misses the object.</p>
                      </section>
                    )}

                    <section className="rounded-[2rem] bg-white border border-sky-100 p-5">
                      <h3 className="text-xl font-black">Add or review learning objects</h3>
                      <p className="text-sm font-bold text-slate-500 mt-1">The room photo becomes the object's picture automatically. Add a separate photo/video only when you want extra teaching media for a routine, such as putting on shoes.</p>
                      <div className="grid sm:grid-cols-2 gap-3 mt-4">
                        <input value={itemLabel} onChange={e => setItemLabel(e.target.value)} placeholder="Word: Bed, Shoes, TV..." className="min-h-12 rounded-2xl border-2 border-slate-200 px-4 font-bold" />
                        <input value={itemPhrase} onChange={e => setItemPhrase(e.target.value)} placeholder="Sentence: I put on my shoes." className="min-h-12 rounded-2xl border-2 border-slate-200 px-4 font-bold" />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 mt-3">
                        <label className="flex-1 min-h-12 rounded-2xl bg-violet-50 border-2 border-violet-100 px-4 flex items-center justify-center gap-2 font-black cursor-pointer">
                          {itemFile?.type.startsWith("video/") ? <Video className="w-5 h-5" /> : <Upload className="w-5 h-5" />} {itemFile ? itemFile.name : "Optional extra photo / short video"}
                          <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" capture="environment" className="hidden" onChange={e => setItemFile(e.target.files?.[0] || null)} />
                        </label>
                        <button type="button" disabled={uploading || !itemLabel.trim()} onClick={addItem} className="min-h-12 rounded-2xl bg-violet-600 text-white px-5 font-black disabled:opacity-50"><Plus className="w-4 h-4 inline mr-1" /> Add & tag</button>
                      </div>

                      <div className="grid lg:grid-cols-2 gap-3 mt-5">
                        {builderWorld.items.map(item => (
                          <div key={item.id} className={`rounded-2xl border-2 p-3 ${placingItemId === item.id ? "border-blue-500 bg-blue-50" : item.source === "ai" ? "border-violet-200 bg-violet-50/40" : "border-slate-100"}`}>
                            <div className="flex gap-3">
                              <button type="button" onClick={() => setPlacingItemId(item.id)} className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 border-2 border-white shadow-sm">
                                <RoomCrop world={builderWorld} item={item} className="w-full h-full rounded-xl" />
                              </button>
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-center gap-2">
                                  {item.source === "ai" && <span className="rounded-full bg-violet-100 text-violet-700 px-2 py-1 text-[10px] font-black uppercase">✨ AI suggestion</span>}
                                  {item.mediaType === "video" && <span className="rounded-full bg-sky-100 text-sky-700 px-2 py-1 text-[10px] font-black uppercase">🎥 Extra video</span>}
                                </div>
                                <input
                                  value={item.label}
                                  onChange={e => updateItem(item.id, { label: e.target.value.slice(0, 40) })}
                                  aria-label="Learning word"
                                  className="w-full min-h-10 rounded-xl border-2 border-slate-200 px-3 font-black"
                                />
                                <input
                                  value={item.phrase}
                                  onChange={e => updateItem(item.id, { phrase: e.target.value.slice(0, 160) })}
                                  aria-label="Learning sentence"
                                  className="w-full min-h-10 rounded-xl border-2 border-slate-200 px-3 text-sm font-bold"
                                />
                              </div>
                              <button type="button" onClick={() => removeItem(item.id)} className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 grid place-items-center flex-shrink-0" aria-label={`Delete ${item.label}`}><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <button type="button" onClick={() => { setPlacingItemId(item.id); setNotice(`Draw a new box around ${item.label}.`); }} className="mt-3 w-full min-h-11 rounded-xl bg-white border-2 border-blue-100 text-blue-700 font-black flex items-center justify-center gap-2"><Focus className="w-4 h-4" /> Draw / adjust object box</button>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </div>
            </section>
          )}

          <section className="rounded-[2rem] bg-emerald-50 border-2 border-emerald-200 p-5 flex flex-col sm:flex-row items-center gap-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 flex-shrink-0" />
            <div className="flex-1"><h3 className="text-xl font-black text-emerald-950">Ready for your child?</h3><p className="text-sm font-bold text-emerald-800">Finish setup after you have at least one place with one learning item. You can always come back and add more later.</p></div>
            <button type="button" disabled={saving || !worlds.some(w => w.items.length)} onClick={() => saveWorlds(true)} className="w-full sm:w-auto min-h-14 rounded-2xl bg-emerald-600 text-white px-6 font-black disabled:opacity-50">Finish My World</button>
          </section>

          {notice && <div role="status" className="rounded-2xl bg-white border border-sky-100 p-4 text-center font-black text-blue-800">{notice}</div>}
        </div>
      </div>
    );
  }

  if (!data?.setupComplete || worlds.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-violet-100 grid place-items-center p-5">
        <div className="max-w-xl rounded-[2rem] bg-white border-2 border-sky-100 p-7 text-center shadow-xl">
          <div className="text-7xl">🏠</div>
          <h1 className="text-4xl font-black text-blue-950 mt-4">Build My World</h1>
          <p className="text-lg font-bold text-slate-600 mt-3">A grown-up can add familiar rooms, pictures, and short videos right from this account.</p>
          <button type="button" onClick={startGrownupGate} className="mt-5 w-full min-h-16 rounded-2xl bg-violet-600 text-white px-6 text-xl font-black">🧑‍🧒 Grown-up Setup</button>
          <p className="text-sm font-bold text-slate-400 mt-2">One simple math question · no parent signup</p>
          <button type="button" onClick={() => navigate("/eye-gaze-home")} className="mt-3 min-h-12 rounded-2xl bg-slate-100 text-slate-600 px-6 font-black">Back Home</button>
        </div>
      </div>
    );
  }

  if (!selectedWorld) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-violet-100 p-4 sm:p-6 text-slate-900">
        <div className="max-w-6xl mx-auto">
          <header className="flex items-center gap-3">
            <button type="button" onClick={() => navigate("/eye-gaze-home")} className="min-h-12 rounded-2xl bg-white border border-slate-200 px-4 font-black flex items-center gap-2"><ArrowLeft className="w-5 h-5" /> Home</button>
            <div className="flex-1 text-center"><p className="text-sm font-black uppercase tracking-widest text-violet-600">Made from my real life</p><h1 className="text-4xl sm:text-5xl font-black text-blue-950">My World</h1></div>
            <button type="button" onClick={startGrownupGate} className="min-h-12 rounded-2xl bg-violet-100 border border-violet-200 px-4 font-black text-violet-800">⚙ Grown-up Edit</button>
            <div className="rounded-2xl bg-amber-100 px-4 py-2 font-black text-amber-700 flex items-center gap-2"><Star className="w-5 h-5 fill-current" /> {stars}</div>
          </header>
          <p className="text-center text-lg font-bold text-slate-600 mt-3">Choose a familiar place.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {worlds.map(world => (
              <DwellButton key={world.id} label={`Open ${world.name}`} onSelect={() => { setSelectedWorldId(world.id); setTargetIndex(0); setFeedback(""); }} className="min-h-[240px] rounded-[2rem] bg-white border-2 border-sky-100 shadow-lg text-left">
                <div className="h-40 bg-sky-50 overflow-hidden rounded-t-[1.8rem]">
                  {world.backgroundUrl ? <img src={world.backgroundUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-7xl">{world.icon}</div>}
                </div>
                <div className="p-4"><div className="text-3xl font-black text-blue-950">{world.icon} {world.name}</div><div className="font-bold text-slate-500 mt-1">{world.items.length} things to find</div></div>
              </DwellButton>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5fbff] text-slate-900 p-3 sm:p-5">
      <div className="max-w-[1350px] mx-auto space-y-4">
        <header className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => { setSelectedWorldId(null); setFocusedItem(null); setFeedback(""); stopSpeaking(); }} className="min-h-12 rounded-2xl bg-white border-2 border-slate-200 px-4 font-black flex items-center gap-2"><ArrowLeft className="w-5 h-5" /> Places</button>
          <div className="flex-1 text-center"><p className="text-xs font-black uppercase tracking-widest text-violet-600">My World</p><h1 className="text-3xl sm:text-4xl font-black text-blue-950">{selectedWorld.icon} {selectedWorld.name}</h1></div>
          <div className="rounded-2xl bg-amber-100 px-4 py-2 font-black text-amber-700 flex items-center gap-2"><Star className="w-5 h-5 fill-current" /> {stars}</div>
        </header>

        <div className="grid grid-cols-2 gap-2 max-w-xl mx-auto">
          <button type="button" onClick={() => { setMode("ispy"); setFocusedItem(null); setFeedback(""); if (target) speak(`I spy with my little eye. Find ${target.label}.`); }} className={`min-h-14 rounded-2xl font-black flex items-center justify-center gap-2 ${mode === "ispy" ? "bg-violet-600 text-white" : "bg-white border-2 border-violet-100 text-violet-700"}`}><Eye className="w-5 h-5" /> I‑Spy</button>
          <button type="button" onClick={() => { setMode("explore"); setFocusedItem(null); setFeedback(""); speak("Explore your world. Choose something you know."); }} className={`min-h-14 rounded-2xl font-black flex items-center justify-center gap-2 ${mode === "explore" ? "bg-teal-600 text-white" : "bg-white border-2 border-teal-100 text-teal-700"}`}><Home className="w-5 h-5" /> Explore</button>
        </div>

        {mode === "ispy" && target && (
          <section className="rounded-[2rem] bg-gradient-to-r from-amber-100 via-white to-violet-100 border-2 border-amber-200 p-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-28 h-28 rounded-2xl overflow-hidden bg-white border-4 border-white shadow flex-shrink-0"><RoomCrop world={selectedWorld} item={target} className="w-full h-full rounded-2xl" /></div>
            <div className="flex-1 text-center sm:text-left"><p className="text-sm font-black uppercase tracking-widest text-amber-700">I‑SPY</p><h2 className="text-3xl sm:text-4xl font-black text-blue-950">Find {target.label}!</h2><p className="font-bold text-slate-600">Look at your real {selectedWorld.name.toLowerCase()} and choose where it is.</p></div>
            <button type="button" onClick={() => speak(`I spy with my little eye. Find ${target.label}. Where is ${target.label}?`)} className="min-h-14 rounded-2xl bg-blue-600 text-white px-5 font-black">🔊 Hear clue</button>
          </section>
        )}

        <section className="rounded-[2rem] overflow-hidden bg-slate-200 border-4 border-white shadow-xl">
          {selectedWorld.backgroundUrl ? (
            <div className="overflow-x-auto bg-slate-100">
              <div className="relative min-w-[640px] md:min-w-full">
                <img src={selectedWorld.backgroundUrl} alt={selectedWorld.name} className="block w-full h-auto select-none" draggable={false} />

                {selectedWorld.items.map(item => {
                  const box = safeBox(item);
                  return (
                    <DwellButton
                      key={item.id}
                      label={mode === "ispy" ? `Choose ${item.label}` : `Explore ${item.label}`}
                      onSelect={() => chooseItem(item)}
                      style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
                      className={`absolute z-20 min-w-12 min-h-12 rounded-xl border-4 transition-all ${mode === "ispy" ? "border-transparent bg-transparent hover:border-amber-300 hover:bg-amber-200/10 focus:border-amber-300" : "border-white/20 bg-white/5 hover:border-sky-300 hover:bg-sky-200/10 focus:border-sky-300"}`}
                    >
                      <span className="sr-only">{item.label}</span>
                    </DwellButton>
                  );
                })}

                {focusedItem && (
                  <div className="absolute inset-0 z-40 bg-slate-950/65 p-3 sm:p-6 grid place-items-center">
                    <div className="w-full max-w-4xl rounded-[2rem] bg-white p-4 sm:p-6 shadow-2xl">
                      <div className="grid md:grid-cols-[1.25fr_1fr] gap-5 items-stretch">
                        <div className="min-h-[260px] sm:min-h-[360px] rounded-3xl overflow-hidden border-4 border-sky-100 relative">
                          <RoomCrop world={selectedWorld} item={focusedItem} className="absolute inset-0 w-full h-full transition-all duration-500" />
                          <div className="absolute top-3 left-3 rounded-full bg-slate-950/80 text-white px-3 py-1 text-xs font-black uppercase tracking-widest flex items-center gap-2"><Focus className="w-4 h-4" /> Zoomed in</div>
                        </div>
                        <div className="flex flex-col justify-center text-center md:text-left">
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">{mode === "ispy" ? "You found it!" : "Learn this word"}</p>
                          <h2 className="text-4xl sm:text-6xl font-black text-blue-950 mt-2">{focusedItem.label}</h2>
                          <p className="text-xl sm:text-2xl font-bold text-slate-600 mt-3">{focusedItem.phrase}</p>

                          {focusedItem.mediaUrl && (
                            <div className="mt-4 rounded-2xl overflow-hidden border-2 border-slate-100 bg-slate-50">
                              <Media item={focusedItem} className="w-full max-h-44 object-cover" />
                            </div>
                          )}

                          <div className="grid sm:grid-cols-2 gap-2 mt-5">
                            <DwellButton label={`Hear ${focusedItem.label} again`} onSelect={() => speak(`${focusedItem.label}. ${focusedItem.phrase}`)} className="min-h-14 rounded-2xl bg-blue-600 text-white px-4 font-black">🔊 Hear it again</DwellButton>
                            {mode === "explore" ? (
                              <DwellButton label={`Play I Spy with ${focusedItem.label}`} onSelect={() => playIspyWith(focusedItem)} className="min-h-14 rounded-2xl bg-violet-600 text-white px-4 font-black">👁️ I‑Spy: find it</DwellButton>
                            ) : (
                              <DwellButton label="Next I Spy object" onSelect={nextIspy} className="min-h-14 rounded-2xl bg-emerald-600 text-white px-4 font-black">⭐ Next I‑Spy</DwellButton>
                            )}
                          </div>
                          <DwellButton label="Back to the full room" onSelect={() => { setFocusedItem(null); setFeedback(""); }} className="mt-2 min-h-12 rounded-2xl bg-slate-100 text-slate-700 px-4 font-black">Back to full room</DwellButton>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="min-h-[420px] bg-gradient-to-br from-sky-100 to-violet-100 grid place-items-center text-[10rem]">{selectedWorld.icon}</div>
          )}
        </section>

        {feedback && <div role="status" className={`rounded-2xl p-4 text-center text-xl font-black ${feedback.startsWith("Yes") ? "bg-green-100 text-green-800" : feedback.startsWith("Good try") ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>{feedback}</div>}

        <p className="text-center text-sm font-bold text-slate-500">Look at the real object for about one second, or tap it. My World uses the exact object areas tagged by a grown-up in familiar family photos.</p>
      </div>
    </div>
  );
}
