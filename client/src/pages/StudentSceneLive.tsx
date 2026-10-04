import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Maximize2, MonitorPlay, Radio, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

type Scene = {
  id: string;
  bookTitle: string;
  author?: string;
  chapterStart: number;
  chapterEnd: number;
  imageUrl?: string | null;
};

type LivePayload = {
  id: string;
  code: string;
  teacherName: string;
  status: "live" | "ended";
  updatedAt: string;
  viewerCount: number;
  scene: Scene | null;
};

function getTokenFromCookie(): string | null {
  try {
    for (const cookie of document.cookie.split(";")) {
      const value = cookie.trim();
      if (!value.startsWith("arise_session=")) continue;
      const raw = value.substring("arise_session=".length);
      const data = JSON.parse(atob(raw));
      return data.token || null;
    }
  } catch {}
  return null;
}

function codeFromHash() {
  try {
    const query = window.location.hash.split("?")[1] || "";
    return String(new URLSearchParams(query).get("code") || "").trim().toUpperCase().slice(0, 6);
  } catch {
    return "";
  }
}

export default function StudentSceneLive() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [code, setCode] = useState(codeFromHash());
  const [live, setLive] = useState<LivePayload | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const autoJoined = useRef(false);

  const home = user?.is_eye_gaze_user ? "/eye-gaze-home" : "/library";

  const request = async (path: string, options: RequestInit = {}) => {
    const token = getTokenFromCookie();
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Something went wrong.");
    return data;
  };

  const join = async (value = code) => {
    const clean = String(value || "").trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(clean)) {
      setError("Enter the 6-character code from your teacher.");
      return;
    }
    setJoining(true);
    setError("");
    try {
      const data = await request("/api/scenes/live/join", {
        method: "POST",
        body: JSON.stringify({ code: clean }),
      });
      setCode(clean);
      setLive(data);
      const nextHash = `#/scene-live?code=${encodeURIComponent(clean)}`;
      if (window.location.hash !== nextHash) window.history.replaceState(null, "", nextHash);
    } catch (err) {
      setLive(null);
      setError(err instanceof Error ? err.message : "Could not join that Scene.");
    } finally {
      setJoining(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (user.role !== "student" || user.isAdmin) {
      navigate("/");
      return;
    }
    const initial = codeFromHash();
    if (initial && !autoJoined.current) {
      autoJoined.current = true;
      setCode(initial);
      void join(initial);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!live?.code || live.status !== "live") return;
    const refresh = async () => {
      try {
        const data = await request(`/api/scenes/live/${live.code}`);
        setLive(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lost connection to the live Scene.");
      }
    };
    const timer = window.setInterval(refresh, 1200);
    return () => window.clearInterval(timer);
  }, [live?.code, live?.status]);

  const fullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    } catch {}
  };

  if (!user || user.role !== "student" || user.isAdmin) return null;

  if (!live) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#0b0b18] via-[#14112c] to-[#081c26] px-4 py-8 text-white">
        <div className="mx-auto max-w-lg">
          <button type="button" onClick={() => navigate(home)} className="mb-8 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 font-bold text-slate-200">
            <ArrowLeft size={18} /> Back
          </button>
          <section className="rounded-[28px] border border-cyan-300/20 bg-white/[0.06] p-6 shadow-2xl sm:p-8">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400">
              <MonitorPlay size={30} />
            </div>
            <div className="mt-5 text-center">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Live with your teacher</div>
              <h1 className="mt-2 text-3xl font-black">Join Teacher Scene</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">Enter the code on your teacher's presentation. Your screen will follow along automatically when the teacher changes Scenes.</p>
            </div>
            <label className="mt-7 block">
              <span className="mb-2 block text-sm font-black text-slate-300">6-character code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6))}
                onKeyDown={(e) => { if (e.key === "Enter") void join(); }}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="ABC234"
                className="h-16 w-full rounded-2xl border border-white/15 bg-black/30 px-4 text-center text-3xl font-black tracking-[0.28em] outline-none focus:border-cyan-300"
              />
            </label>
            {error && <div role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">{error}</div>}
            <button type="button" disabled={joining || code.length !== 6} onClick={() => void join()} className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 px-5 text-lg font-black disabled:opacity-50">
              <Radio size={20} /> {joining ? "Joining..." : "Join live Scene"}
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 z-[340] flex flex-col bg-black text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#090914] px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            {live.status === "live" ? "Live Scene" : "Session ended"}
          </div>
          <h1 className="m-0 mt-1 truncate text-lg font-black sm:text-2xl">{live.scene?.bookTitle || "Teacher Scene"}</h1>
          {live.scene && <div className="text-xs font-bold text-slate-400">Chapters {live.scene.chapterStart}{live.scene.chapterEnd !== live.scene.chapterStart ? `–${live.scene.chapterEnd}` : ""} • {live.teacherName}</div>}
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Code</div>
            <div className="font-black tracking-[0.16em]">{live.code}</div>
          </div>
          <button type="button" onClick={() => void fullscreen()} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5" aria-label="Full screen"><Maximize2 size={18} /></button>
          <button type="button" onClick={() => navigate(home)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-black"><ArrowLeft size={17} /> Exit</button>
        </div>
      </header>

      <section className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto">
        {live.scene?.imageUrl ? (
          <div className="flex min-h-full min-w-full items-center justify-center p-2 sm:p-5">
            <img
              key={live.scene.id}
              src={live.scene.imageUrl}
              alt={`${live.scene.bookTitle} live classroom Scene`}
              className="max-h-[calc(100vh-92px)] max-w-full object-contain"
            />
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400">
            <RefreshCw className="mx-auto mb-3" size={28} />
            Waiting for your teacher's Scene...
          </div>
        )}

        {live.status === "ended" && (
          <div className="absolute inset-0 grid place-items-center bg-black/75 p-6 backdrop-blur-sm">
            <div className="max-w-md rounded-3xl border border-white/10 bg-[#12121d] p-7 text-center shadow-2xl">
              <h2 className="text-2xl font-black">Live Scene finished</h2>
              <p className="mt-2 text-slate-300">Your teacher ended this presentation.</p>
              <button type="button" onClick={() => navigate(home)} className="mt-5 min-h-12 rounded-xl bg-cyan-300 px-5 font-black text-slate-950">Back to A.R.I.S.E.</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
