import { useEffect, useMemo, useRef, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { ArrowLeft, Camera, CheckCircle2, Eye, Home, MapPin, Plus, Save, Sparkles, Star, Trash2, Upload, Video } from "lucide-react";
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
}: {
  children: React.ReactNode;
  onSelect: () => void;
  className?: string;
  label: string;
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
      className={`relative overflow-hidden ${active ? "ring-4 ring-blue-500" : ""} ${className}`}
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

  const isParent = user?.role === "parent";
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
      setWorlds(result.worlds || []);
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

  const uploadMedia = async (file: File, label: string) => {
    if (!authToken) throw new Error("Please sign in again.");
    const res = await fetch(`${API_BASE}/api/eye-gaze/my-world/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": file.type,
        "X-My-World-Label": label,
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
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
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
        x: 50,
        y: 55,
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

  const placeItem = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!builderWorld || !placingItemId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(8, Math.min(92, ((event.clientY - rect.top) / rect.height) * 100));
    setWorlds(prev => prev.map(w => w.id === builderWorld.id ? {
      ...w,
      items: w.items.map(item => item.id === placingItemId ? { ...item, x, y } : item),
    } : w));
    setNotice("Placed! You can tap another item below to position it.");
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
      speak(text);
      record(item, "explored");
      return;
    }
    if (!target) return;
    if (item.id !== target.id) {
      const text = `That is ${item.label}. Find ${target.label}.`;
      setFeedback(text);
      speak(text);
      record(target, "retry");
      return;
    }
    const text = `Yes! You found ${target.label}. ${target.phrase}`;
    setFeedback(text);
    setStars(value => value + 1);
    speak(text);
    record(target, "correct");
    window.setTimeout(() => {
      if (!selectedWorld.items.length) return;
      setTargetIndex(index => (index + 1) % selectedWorld.items.length);
      setFeedback("");
    }, 1900);
  };

  if (!user) return <Redirect to="/" />;
  if (!isParent && !user.is_eye_gaze_user) return <Redirect to="/library" />;

  if (loading) return <div className="min-h-screen grid place-items-center bg-sky-50"><div className="w-14 h-14 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" /></div>;

  if (isParent) {
    return (
      <div className="min-h-screen bg-[#f7fbff] text-slate-900 px-4 sm:px-6 py-5">
        <div className="max-w-6xl mx-auto space-y-5">
          <header className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => navigate("/parent-dashboard")} className="min-h-12 rounded-2xl bg-white border-2 border-slate-200 px-4 font-black flex items-center gap-2"><ArrowLeft className="w-5 h-5" /> Parent Portal</button>
            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-widest text-violet-600">Family setup</p>
              <h1 className="text-3xl sm:text-4xl font-black text-blue-950">Build {data?.student.name}'s My World</h1>
            </div>
            <button type="button" disabled={saving} onClick={() => saveWorlds(false)} className="min-h-12 rounded-2xl bg-blue-600 text-white px-5 font-black flex items-center gap-2 disabled:opacity-50"><Save className="w-5 h-5" /> Save</button>
          </header>

          {!data?.setupComplete && (
            <section className="rounded-[2rem] bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-500 text-white p-6 sm:p-8 shadow-xl">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-widest"><Sparkles className="w-4 h-4" /> First-time setup</div>
                <h2 className="text-3xl sm:text-5xl font-black mt-4">Turn real life into the learning game.</h2>
                <p className="mt-3 text-lg font-bold text-white/90">Take a photo of a real room. Add pictures or short videos of familiar things and routines. Then tap the room photo where each thing belongs. Your child will use those exact images in Explore and I‑Spy activities.</p>
                <div className="grid sm:grid-cols-3 gap-3 mt-5">
                  <div className="rounded-2xl bg-white/15 p-4"><Camera className="w-7 h-7 mb-2" /><strong className="block">1. Photograph a place</strong><span className="text-sm">Bedroom, kitchen, bathroom, classroom area.</span></div>
                  <div className="rounded-2xl bg-white/15 p-4"><Upload className="w-7 h-7 mb-2" /><strong className="block">2. Add real things</strong><span className="text-sm">Bed, TV, shoes, cup, toothbrush—or a short action video.</span></div>
                  <div className="rounded-2xl bg-white/15 p-4"><MapPin className="w-7 h-7 mb-2" /><strong className="block">3. Tag the spot</strong><span className="text-sm">Tap where the object is so your child can find it.</span></div>
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
                        <div className="flex-1"><h2 className="text-2xl font-black text-blue-950">{builderWorld.name}</h2><p className="text-sm font-bold text-slate-500">Use a wide room photo when possible.</p></div>
                        <button type="button" onClick={() => removeWorld(builderWorld.id)} className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 grid place-items-center" aria-label="Delete place"><Trash2 className="w-5 h-5" /></button>
                      </div>
                      <label className="mt-4 min-h-14 rounded-2xl border-2 border-dashed border-blue-200 bg-sky-50 px-4 flex items-center justify-center gap-2 font-black cursor-pointer">
                        <Camera className="w-5 h-5" /> {builderWorld.backgroundUrl ? "Replace room photo" : "Take / upload room photo"}
                        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={e => uploadBackground(e.target.files?.[0])} />
                      </label>
                    </section>

                    {builderWorld.backgroundUrl && (
                      <section className="rounded-[2rem] bg-white border border-sky-100 p-4">
                        <div className="mb-3">
                          <h3 className="text-xl font-black">Tag where things are</h3>
                          <p className="text-sm font-bold text-slate-500">{placingItemId ? "Tap the room photo where the selected item is." : "Choose an item below, then tap its real location in the room."}</p>
                        </div>
                        <div onClick={placeItem} className={`relative rounded-3xl overflow-hidden bg-slate-100 aspect-video ${placingItemId ? "cursor-crosshair ring-4 ring-blue-300" : ""}`}>
                          <img src={builderWorld.backgroundUrl} alt={builderWorld.name} className="w-full h-full object-cover" />
                          {builderWorld.items.map(item => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={e => { e.stopPropagation(); setPlacingItemId(item.id); }}
                              style={{ left: `${item.x}%`, top: `${item.y}%` }}
                              className={`absolute -translate-x-1/2 -translate-y-1/2 min-w-16 min-h-16 rounded-full border-4 shadow-lg grid place-items-center px-2 font-black text-xs ${placingItemId === item.id ? "bg-blue-600 border-white text-white scale-110" : "bg-white/90 border-amber-300 text-slate-900"}`}
                            >
                              {item.mediaType === "video" ? "🎥" : "📍"}<span className="block">{item.label}</span>
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                    <section className="rounded-[2rem] bg-white border border-sky-100 p-5">
                      <h3 className="text-xl font-black">Add something to learn</h3>
                      <p className="text-sm font-bold text-slate-500 mt-1">Use a photo of the actual object, or a short video of the child/parent doing an action such as putting on shoes.</p>
                      <div className="grid sm:grid-cols-2 gap-3 mt-4">
                        <input value={itemLabel} onChange={e => setItemLabel(e.target.value)} placeholder="Word: Bed, Shoes, TV..." className="min-h-12 rounded-2xl border-2 border-slate-200 px-4 font-bold" />
                        <input value={itemPhrase} onChange={e => setItemPhrase(e.target.value)} placeholder="Phrase: Put on my shoes." className="min-h-12 rounded-2xl border-2 border-slate-200 px-4 font-bold" />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 mt-3">
                        <label className="flex-1 min-h-12 rounded-2xl bg-violet-50 border-2 border-violet-100 px-4 flex items-center justify-center gap-2 font-black cursor-pointer">
                          {itemFile?.type.startsWith("video/") ? <Video className="w-5 h-5" /> : <Upload className="w-5 h-5" />} {itemFile ? itemFile.name : "Photo or short video"}
                          <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" capture="environment" className="hidden" onChange={e => setItemFile(e.target.files?.[0] || null)} />
                        </label>
                        <button type="button" disabled={uploading || !itemLabel.trim()} onClick={addItem} className="min-h-12 rounded-2xl bg-violet-600 text-white px-5 font-black disabled:opacity-50"><Plus className="w-4 h-4 inline mr-1" /> Add item</button>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3 mt-5">
                        {builderWorld.items.map(item => (
                          <div key={item.id} className={`rounded-2xl border-2 p-3 flex gap-3 ${placingItemId === item.id ? "border-blue-500 bg-blue-50" : "border-slate-100"}`}>
                            <button type="button" onClick={() => setPlacingItemId(item.id)} className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                              <Media item={item} className="w-full h-full rounded-xl object-cover" />
                            </button>
                            <div className="flex-1 min-w-0">
                              <strong className="block font-black">{item.label}</strong>
                              <p className="text-xs text-slate-500 line-clamp-2">{item.phrase}</p>
                              <button type="button" onClick={() => setPlacingItemId(item.id)} className="text-xs font-black text-blue-600 mt-2">📍 Place on room</button>
                            </div>
                            <button type="button" onClick={() => removeItem(item.id)} className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 grid place-items-center"><Trash2 className="w-4 h-4" /></button>
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
          <h1 className="text-4xl font-black text-blue-950 mt-4">My World is getting ready!</h1>
          <p className="text-lg font-bold text-slate-600 mt-3">A parent or caregiver needs to add familiar rooms, pictures, and videos first.</p>
          <button type="button" onClick={() => navigate("/eye-gaze-home")} className="mt-5 min-h-14 rounded-2xl bg-blue-600 text-white px-6 font-black">Back Home</button>
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
          <button type="button" onClick={() => { setSelectedWorldId(null); setFeedback(""); stopSpeaking(); }} className="min-h-12 rounded-2xl bg-white border-2 border-slate-200 px-4 font-black flex items-center gap-2"><ArrowLeft className="w-5 h-5" /> Places</button>
          <div className="flex-1 text-center"><p className="text-xs font-black uppercase tracking-widest text-violet-600">My World</p><h1 className="text-3xl sm:text-4xl font-black text-blue-950">{selectedWorld.icon} {selectedWorld.name}</h1></div>
          <div className="rounded-2xl bg-amber-100 px-4 py-2 font-black text-amber-700 flex items-center gap-2"><Star className="w-5 h-5 fill-current" /> {stars}</div>
        </header>

        <div className="grid grid-cols-2 gap-2 max-w-xl mx-auto">
          <button type="button" onClick={() => { setMode("ispy"); setFeedback(""); if (target) speak(`Find ${target.label}.`); }} className={`min-h-14 rounded-2xl font-black flex items-center justify-center gap-2 ${mode === "ispy" ? "bg-violet-600 text-white" : "bg-white border-2 border-violet-100 text-violet-700"}`}><Eye className="w-5 h-5" /> I‑Spy</button>
          <button type="button" onClick={() => { setMode("explore"); setFeedback(""); speak("Explore your world. Choose something you know."); }} className={`min-h-14 rounded-2xl font-black flex items-center justify-center gap-2 ${mode === "explore" ? "bg-teal-600 text-white" : "bg-white border-2 border-teal-100 text-teal-700"}`}><Home className="w-5 h-5" /> Explore</button>
        </div>

        {mode === "ispy" && target && (
          <section className="rounded-[2rem] bg-gradient-to-r from-amber-100 via-white to-violet-100 border-2 border-amber-200 p-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-28 h-28 rounded-2xl overflow-hidden bg-white border-4 border-white shadow flex-shrink-0"><Media item={target} className="w-full h-full rounded-2xl object-cover" /></div>
            <div className="flex-1 text-center sm:text-left"><p className="text-sm font-black uppercase tracking-widest text-amber-700">I‑SPY</p><h2 className="text-3xl sm:text-4xl font-black text-blue-950">Find {target.label}!</h2><p className="font-bold text-slate-600">Look at your real {selectedWorld.name.toLowerCase()} and choose where it is.</p></div>
            <button type="button" onClick={() => speak(`Find ${target.label}. Where is ${target.label}?`)} className="min-h-14 rounded-2xl bg-blue-600 text-white px-5 font-black">🔊 Hear clue</button>
          </section>
        )}

        <section className="relative rounded-[2rem] overflow-hidden bg-slate-200 min-h-[520px] sm:min-h-[650px] border-4 border-white shadow-xl">
          {selectedWorld.backgroundUrl ? (
            <img src={selectedWorld.backgroundUrl} alt={selectedWorld.name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-sky-100 to-violet-100 grid place-items-center text-[10rem]">{selectedWorld.icon}</div>
          )}
          <div className="absolute inset-0 bg-black/5" />

          {selectedWorld.items.map(item => (
            <div
              key={item.id}
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
            >
              <DwellButton
                label={mode === "ispy" ? `Choose this spot for ${target?.label || "the item"}` : `Explore ${item.label}`}
                onSelect={() => chooseItem(item)}
                className={`rounded-full shadow-2xl border-[5px] border-white flex items-center justify-center transition-all ${mode === "ispy" ? "w-24 h-24 sm:w-32 sm:h-32 bg-amber-300/90 hover:bg-amber-300" : "w-28 h-28 sm:w-36 sm:h-36 bg-white/95"}`}
              >
                {mode === "explore" ? (
                  item.mediaUrl ? <Media item={item} className="w-full h-full rounded-full object-cover" /> : <span className="text-4xl">📍</span>
                ) : (
                  <span className="text-4xl sm:text-5xl font-black text-amber-900">?</span>
                )}
              </DwellButton>
              {mode === "explore" && <div className="mt-1 rounded-full bg-slate-950/85 text-white px-3 py-1 text-center text-sm font-black whitespace-nowrap">{item.label}</div>}
            </div>
          ))}
        </section>

        {feedback && <div role="status" className={`rounded-2xl p-4 text-center text-xl font-black ${feedback.startsWith("Yes") ? "bg-green-100 text-green-800" : feedback.startsWith("That") ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>{feedback}</div>}

        <p className="text-center text-sm font-bold text-slate-500">Look at a large circle for about one second, or tap it. My World uses familiar family photos and videos chosen by your caregiver.</p>
      </div>
    </div>
  );
}
