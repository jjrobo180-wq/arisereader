import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import {
  CONTROLLED_FEATURES,
  defaultParentControls,
  fetchFamilySettings,
  saveFamilySettings,
  type ParentControls,
} from "@/lib/parentControls";
import { SHORT_AGE_OPTIONS, SHORT_TOPIC_OPTIONS } from "@/lib/ariseShorts";

function youtubeId(value: string) {
  const v = value.trim();
  const match = v.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|shorts\/|embed\/))([A-Za-z0-9_-]{11})/i);
  return match?.[1] || (/^[A-Za-z0-9_-]{11}$/.test(v) ? v : "");
}

export default function EyeGazeParentControls() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const [controls, setControls] = useState<ParentControls>(defaultParentControls());
  const [studentName, setStudentName] = useState("your child");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(user?.role === "parent");
  const [challenge, setChallenge] = useState<{ challengeId: string; question: string } | null>(null);
  const [answer, setAnswer] = useState("");
  const [url, setUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoChannel, setVideoChannel] = useState("Parent approved");
  const [videoTopic, setVideoTopic] = useState("Learning");

  useEffect(() => {
    let active = true;
    const existing = sessionStorage.getItem("talker-grownup-token");
    if (existing) setVerified(true);
    void fetchFamilySettings(token)
      .then(result => {
        if (!active) return;
        setControls(result.settings);
        setStudentName(result.student.name || "your child");
      })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, user?.id]);

  const startChallenge = async () => {
    if (!token) return;
    setError("");
    const res = await fetch(`${API_BASE}/api/eye-gaze/talker-state/grownup-challenge`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.message || "Could not open the grown-up check."); return; }
    setChallenge(data);
    setAnswer("");
  };

  const verify = async () => {
    if (!token || !challenge) return;
    setError("");
    const res = await fetch(`${API_BASE}/api/eye-gaze/talker-state/grownup-challenge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId: challenge.challengeId, answer: Number(answer) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.message || "Not quite. Try a new question.");
      setChallenge(null);
      setAnswer("");
      return;
    }
    sessionStorage.setItem("talker-grownup-token", data.grownupToken);
    setVerified(true);
    setChallenge(null);
    setMessage("Grown-up tools unlocked for 30 minutes.");
  };

  const save = async () => {
    setSaving(true); setError(""); setMessage("");
    try {
      const grownupToken = sessionStorage.getItem("talker-grownup-token") || "";
      const result = await saveFamilySettings(token, controls, grownupToken);
      setControls(result.settings);
      window.dispatchEvent(new CustomEvent("arise-parent-controls-updated", { detail: result.settings }));
      setMessage("✓ Child profile controls saved.");
    } catch (err: any) {
      setError(err.message || "Could not save controls.");
      if (/grown-up math/i.test(err.message || "")) setVerified(false);
    } finally { setSaving(false); }
  };

  const toggle = (path: string) => setControls(current => ({
    ...current,
    allowedPaths: current.allowedPaths.includes(path)
      ? current.allowedPaths.filter(item => item !== path)
      : [...current.allowedPaths, path],
  }));

  const addVideo = () => {
    const id = youtubeId(url);
    if (!id) { setError("Paste a valid YouTube video link."); return; }
    if (controls.videos.some(video => video.id === id)) { setError("That video is already in the feed."); return; }
    setControls(current => ({
      ...current,
      videos: [...current.videos, {
        id,
        title: videoTitle.trim() || "Learning video",
        channel: videoChannel.trim() || "Parent approved",
        topic: videoTopic.trim() || "Learning",
      }],
    }));
    setUrl(""); setVideoTitle(""); setVideoChannel("Parent approved"); setVideoTopic("Learning"); setError("");
  };

  const moveVideo = (index: number, delta: number) => {
    setControls(current => {
      const next = [...current.videos];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, videos: next };
    });
  };

  if (loading) return <main className="min-h-screen bg-slate-50 grid place-items-center font-black text-slate-700">Loading grown-up controls…</main>;

  if (!verified) {
    return <main className="fixed inset-0 z-[130] bg-slate-950 text-white grid place-items-center p-5">
      <section className="w-full max-w-md rounded-[2rem] bg-white text-slate-950 p-6 shadow-2xl text-center">
        <div className="text-6xl">👨‍👩‍👧</div>
        <h1 className="text-3xl font-black mt-3">Grown-up check</h1>
        <p className="font-bold text-slate-600 mt-2">A quick math question keeps child profile settings out of the kid area.</p>
        {!challenge ? <button onClick={startChallenge} className="mt-5 w-full min-h-14 rounded-2xl bg-violet-700 text-white font-black">Show math question</button> :
          <div className="mt-5">
            <div className="text-4xl font-black">{challenge.question}</div>
            <input value={answer} onChange={e=>setAnswer(e.target.value.replace(/[^0-9]/g,""))} inputMode="numeric" autoFocus className="mt-4 w-full min-h-16 rounded-2xl border-4 border-violet-200 text-center text-3xl font-black" />
            <button onClick={verify} disabled={!answer} className="mt-3 w-full min-h-14 rounded-2xl bg-violet-700 text-white font-black disabled:opacity-40">Unlock grown-up tools</button>
          </div>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 text-rose-800 p-3 font-bold">{error}</p>}
        <button onClick={()=>navigate("/eye-gaze-home")} className="mt-3 min-h-12 px-4 font-black text-slate-500">← Back</button>
      </section>
    </main>;
  }

  return <main className="min-h-screen bg-slate-50 text-slate-950 p-3 sm:p-7 pb-28">
    <div className="max-w-4xl mx-auto">
      <header className="flex flex-wrap items-center gap-3">
        <button onClick={()=>navigate(user?.role === "parent" ? "/parent-dashboard" : "/eye-gaze-parent")} className="min-h-12 rounded-2xl bg-white border-2 border-slate-200 px-4 font-black">← Back</button>
        <div className="flex-1 min-w-0"><p className="text-xs font-black uppercase tracking-widest text-violet-700">Grown-up controls</p><h1 className="text-3xl sm:text-5xl font-black">Control {studentName}'s A.R.I.S.E.</h1></div>
        <button onClick={save} disabled={saving} className="min-h-12 rounded-2xl bg-violet-700 text-white px-5 font-black disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
      </header>

      {error && <p role="alert" className="mt-4 rounded-2xl bg-rose-50 border-2 border-rose-200 text-rose-900 p-4 font-bold">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-emerald-900 p-4 font-bold">{message}</p>}

      <section className="mt-5 rounded-[2rem] bg-white border-2 border-violet-100 p-5 sm:p-7 shadow-sm">
        <h2 className="text-2xl font-black">Child profile access</h2>
        <p className="font-bold text-slate-600 mt-1">Turn limits on, then decide exactly which areas your child can see. Hidden areas also stay blocked if someone types the direct address.</p>
        <button onClick={()=>setControls(c=>({...c,enabled:!c.enabled}))} className={`mt-5 w-full min-h-16 rounded-2xl text-xl font-black border-4 ${controls.enabled?"bg-emerald-100 border-emerald-400 text-emerald-950":"bg-slate-100 border-slate-300"}`}>{controls.enabled?"✓ Profile limits are ON":"Profile limits are OFF"}</button>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {CONTROLLED_FEATURES.map(feature=>{const on=controls.allowedPaths.includes(feature.path);return <button key={feature.path} onClick={()=>toggle(feature.path)} disabled={!controls.enabled} className={`min-h-24 rounded-3xl border-4 p-4 text-left flex items-center gap-4 disabled:opacity-45 ${on?"bg-white border-emerald-400":"bg-slate-100 border-slate-300"}`}><span className="text-4xl">{feature.emoji}</span><span className="flex-1"><strong className="block text-xl">{feature.label}</strong><small className="font-black text-slate-500">{on?"ALLOWED":"HIDDEN"}</small></span><span className="text-2xl">{on?"✓":"—"}</span></button>})}
        </div>
      </section>

      <section className="mt-5 rounded-[2rem] bg-white border-2 border-sky-100 p-5 sm:p-7 shadow-sm">
        <h2 className="text-2xl font-black">A.R.I.S.E. Shorts</h2>
        <p className="font-bold text-slate-600 mt-1">Choose the age and learning topics. A.R.I.S.E. finds real educational YouTube Shorts that match those settings and keeps loading more as the child swipes.</p>

        <div className="mt-5">
          <h3 className="text-lg font-black">1. Age range</h3>
          <div className="grid sm:grid-cols-2 gap-2 mt-2">
            {SHORT_AGE_OPTIONS.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => setControls(current => ({ ...current, tvAgeRange: option.id }))}
                className={`min-h-20 rounded-2xl border-4 p-3 text-left ${controls.tvAgeRange === option.id ? "bg-violet-100 border-violet-500 ring-4 ring-violet-200" : "bg-white border-slate-200"}`}
              >
                <strong className="block text-lg">{option.label}</strong>
                <span className="block text-xs font-bold text-slate-500 mt-1">{option.note}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <h3 className="text-lg font-black">2. What should show up?</h3>
          <p className="text-sm font-bold text-slate-500">Pick as many topics as you want. A.R.I.S.E. uses these topics when finding YouTube Shorts.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
            {SHORT_TOPIC_OPTIONS.map(topic => {
              const selected = controls.tvTopics.includes(topic.id);
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setControls(current => {
                    const already = current.tvTopics.includes(topic.id);
                    const next = already ? current.tvTopics.filter(item => item !== topic.id) : [...current.tvTopics, topic.id];
                    return { ...current, tvTopics: next.length ? next : [topic.id] };
                  })}
                  className={`min-h-20 rounded-2xl border-4 p-3 text-left ${selected ? "bg-sky-100 border-sky-500" : "bg-white border-slate-200"}`}
                >
                  <span className="text-3xl">{topic.emoji}</span>
                  <strong className="block text-sm sm:text-base mt-1">{topic.label}</strong>
                  <span className="text-xs font-black text-slate-500">{selected ? "✓ INCLUDED" : "Tap to include"}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-slate-50 border-2 border-slate-200 p-4">
          <h3 className="text-lg font-black">3. Optional: add specific YouTube Shorts</h3>
          <p className="text-sm font-bold text-slate-500 mt-1">These get mixed into the automatic YouTube Shorts feed. Paste a specific Short you approve.</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <label className="font-black sm:col-span-2">YouTube Short link<input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://youtube.com/shorts/…" className="mt-1 w-full min-h-14 rounded-2xl border-2 border-slate-200 px-4" /></label>
          <label className="font-black">Title<input value={videoTitle} onChange={e=>setVideoTitle(e.target.value)} placeholder="Counting to 10" className="mt-1 w-full min-h-14 rounded-2xl border-2 border-slate-200 px-4" /></label>
          <label className="font-black">Channel/source<input value={videoChannel} onChange={e=>setVideoChannel(e.target.value)} className="mt-1 w-full min-h-14 rounded-2xl border-2 border-slate-200 px-4" /></label>
          <label className="font-black sm:col-span-2">Topic<input value={videoTopic} onChange={e=>setVideoTopic(e.target.value)} placeholder="Numbers, animals, speech…" className="mt-1 w-full min-h-14 rounded-2xl border-2 border-slate-200 px-4" /></label>
        </div>
        <button onClick={addVideo} className="mt-3 w-full min-h-14 rounded-2xl bg-sky-700 text-white font-black">+ Add approved YouTube Short</button>

        <div className="space-y-3 mt-5">
          {controls.videos.map((video,index)=><div key={video.id} className="rounded-2xl border-2 border-slate-200 p-3 flex items-center gap-3">
            <img src={`https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`} alt="" className="w-28 aspect-video rounded-xl object-cover bg-slate-100" />
            <div className="flex-1 min-w-0"><strong className="block truncate">{video.title}</strong><span className="text-sm font-bold text-slate-500">{video.topic}</span></div>
            <div className="grid gap-1">
              <button onClick={()=>moveVideo(index,-1)} disabled={index===0} className="w-10 h-9 rounded-lg bg-slate-100 font-black disabled:opacity-30">↑</button>
              <button onClick={()=>moveVideo(index,1)} disabled={index===controls.videos.length-1} className="w-10 h-9 rounded-lg bg-slate-100 font-black disabled:opacity-30">↓</button>
              <button onClick={()=>setControls(c=>({...c,videos:c.videos.filter((_,i)=>i!==index)}))} className="w-10 h-9 rounded-lg bg-rose-100 text-rose-800 font-black">×</button>
            </div>
          </div>)}
          {!controls.videos.length && <div className="rounded-2xl bg-sky-50 border-2 border-sky-200 p-4 font-bold text-sky-900">No specific YouTube Shorts added — that's okay. A.R.I.S.E. will still find YouTube Shorts from the age and topics above.</div>}
        </div>
        </div>

        <div className="mt-5 border-t pt-5">
          <h3 className="text-lg font-black">Daily Shorts limit</h3><p className="text-sm font-bold text-slate-500">0 means no daily limit.</p>
          <div className="grid grid-cols-4 gap-2 mt-3">{[0,15,30,60].map(n=><button key={n} onClick={()=>setControls(c=>({...c,tvDailyMinutes:n}))} className={`min-h-12 rounded-xl border-2 font-black ${controls.tvDailyMinutes===n?"bg-sky-100 border-sky-500":"bg-white border-slate-200"}`}>{n===0?"None":`${n} min`}</button>)}</div>
        </div>
      </section>

      <button onClick={save} disabled={saving} className="mt-5 w-full min-h-16 rounded-2xl bg-violet-700 text-white text-xl font-black shadow-lg disabled:opacity-50">{saving?"Saving…":"Save all grown-up controls"}</button>
    </div>
  </main>;
}
