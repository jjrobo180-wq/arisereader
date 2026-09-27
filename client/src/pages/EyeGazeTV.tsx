import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { addTvUsage, fetchFamilySettings, getTvUsage, type FamilyVideo, type ParentControls } from "@/lib/parentControls";

type ShortItem = FamilyVideo & { source?: "youtube" | "curated" | "parent" };
type TopicCursor = Record<string, string | null>;

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function getTokenFromCookie(): string | null {
  try {
    const match = document.cookie.match(/arise_session=([^;]+)/);
    if (!match) return null;
    return JSON.parse(atob(match[1])).token || null;
  } catch { return null; }
}

export default function EyeGazeTV() {
  const { token } = useAuth();
  const authToken = token || getTokenFromCookie();
  const [, navigate] = useLocation();
  const [settings, setSettings] = useState<ParentControls | null>(null);
  const [shorts, setShorts] = useState<ShortItem[]>([]);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [usageMinutes, setUsageMinutes] = useState(0);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [automaticDiscovery, setAutomaticDiscovery] = useState(true);
  const [topicCursor, setTopicCursor] = useState<TopicCursor>({});
  const [topicTurn, setTopicTurn] = useState(0);

  const playerRef = useRef<any>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const usageTimerRef = useRef<number | null>(null);
  const loadingRef = useRef(false);

  const limited = !!settings?.tvDailyMinutes && usageMinutes >= settings.tvDailyMinutes;
  const current = shorts[index];

  const addUnique = (incoming: ShortItem[]) => {
    setShorts(existing => {
      const seen = new Set(existing.map(item => item.id));
      const next = [...existing];
      for (const item of incoming) {
        if (!item?.id || seen.has(item.id)) continue;
        seen.add(item.id);
        next.push(item);
      }
      return next;
    });
  };

  const loadMore = async (preferredTopic?: string) => {
    if (!settings || !authToken || loadingRef.current) return;
    loadingRef.current = true;
    setLoadingMore(true);
    setError("");

    try {
      const topics = settings.tvTopics.length ? settings.tvTopics : ["animals"];
      const topic = preferredTopic || topics[topicTurn % topics.length];
      const params = new URLSearchParams({ topic });
      const cursor = topicCursor[topic];
      if (cursor) params.set("pageToken", cursor);

      const res = await fetch(`${API_BASE}/api/eye-gaze/youtube-shorts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not load YouTube Shorts.");

      const items: ShortItem[] = Array.isArray(data.items)
        ? data.items.map((item: any) => ({
            id: String(item.id),
            title: String(item.title || "Learning Short"),
            channel: String(item.channel || "Educational channel"),
            topic: String(item.topic || topic),
            source: item.source || "youtube",
          }))
        : [];

      addUnique(items);
      setAutomaticDiscovery(data.automaticDiscovery !== false);
      setTopicCursor(current => ({ ...current, [topic]: data.nextPageToken || null }));
      setTopicTurn(turn => turn + 1);
    } catch (err: any) {
      setError(err.message || "Could not load more Shorts.");
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([fetchFamilySettings(authToken), getTvUsage(authToken)])
      .then(([family, usage]) => {
        if (!active) return;
        setSettings(family.settings);
        setUsageMinutes(usage.minutes || 0);
        const parentShorts: ShortItem[] = (family.settings.videos || []).map(video => ({ ...video, source: "parent" }));
        setShorts(parentShorts);
      })
      .catch(err => { if (active) setError(err.message || "Could not load A.R.I.S.E. Shorts."); });
    return () => { active = false; };
  }, [authToken]);

  useEffect(() => {
    if (!settings) return;
    void loadMore(settings.tvTopics[0]);
  }, [settings?.tvAgeRange, settings?.tvTopics.join("|")]);

  useEffect(() => {
    if (shorts.length - index <= 6 && settings) void loadMore();
  }, [index, shorts.length, settings]);

  useEffect(() => {
    if (!current || limited) return;
    let cancelled = false;

    const createPlayer = () => {
      if (cancelled || !window.YT?.Player) return;
      try { playerRef.current?.destroy?.(); } catch {}

      playerRef.current = new window.YT.Player(`arise-short-player-${index}`, {
        videoId: current.id,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0,
          playsinline: 1,
          modestbranding: 1,
          fs: 0,
          disablekb: 1,
          loop: 1,
          playlist: current.id,
        },
        events: {
          onReady: (event: any) => {
            try {
              if (muted) event.target.mute?.(); else event.target.unMute?.();
              event.target.playVideo?.();
            } catch {}
          },
          onStateChange: (event: any) => setPlaying(event.data === 1),
          onError: () => {
            window.setTimeout(() => {
              const el = feedRef.current;
              if (el && index < shorts.length - 1) el.scrollTo({ top: (index + 1) * el.clientHeight, behavior: "smooth" });
            }, 500);
          },
        },
      });
    };

    if (window.YT?.Player) createPlayer();
    else {
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.head.appendChild(script);
      }
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { previous?.(); createPlayer(); };
    }

    return () => {
      cancelled = true;
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = null;
      setPlaying(false);
    };
  }, [current?.id, limited]);

  useEffect(() => {
    try {
      if (muted) playerRef.current?.mute?.();
      else playerRef.current?.unMute?.();
    } catch {}
  }, [muted]);

  useEffect(() => {
    if (usageTimerRef.current) window.clearInterval(usageTimerRef.current);
    usageTimerRef.current = null;
    if (!playing || limited) return;

    usageTimerRef.current = window.setInterval(() => {
      void addTvUsage(authToken, 15)
        .then(result => setUsageMinutes(result.minutes || 0))
        .catch(() => {});
    }, 15000);

    return () => {
      if (usageTimerRef.current) window.clearInterval(usageTimerRef.current);
      usageTimerRef.current = null;
    };
  }, [playing, limited, authToken]);

  useEffect(() => () => {
    if (usageTimerRef.current) window.clearInterval(usageTimerRef.current);
    try { playerRef.current?.destroy?.(); } catch {}
  }, []);

  const togglePlay = () => {
    try {
      if (playing) playerRef.current?.pauseVideo?.();
      else playerRef.current?.playVideo?.();
    } catch {}
  };

  const onScroll = () => {
    const el = feedRef.current;
    if (!el || !shorts.length) return;
    const next = Math.max(0, Math.min(shorts.length - 1, Math.round(el.scrollTop / Math.max(1, el.clientHeight))));
    if (next !== index) setIndex(next);
  };

  if (limited) return <main className="fixed inset-0 z-[130] bg-slate-950 text-white grid place-items-center p-6">
    <div className="max-w-lg text-center">
      <div className="text-8xl">🌙</div>
      <h1 className="text-4xl font-black mt-4">Shorts time is finished for today</h1>
      <p className="text-white/70 font-bold mt-2">Your grown-up set today's A.R.I.S.E. Shorts limit.</p>
      <button onClick={()=>navigate("/eye-gaze-home")} className="mt-6 min-h-14 rounded-2xl bg-white text-slate-950 px-6 font-black">Back Home</button>
    </div>
  </main>;

  if (!settings) return <main className="fixed inset-0 z-[130] bg-slate-950 text-white grid place-items-center font-black">Loading A.R.I.S.E. Shorts…</main>;

  if (!shorts.length && !loadingMore) return <main className="fixed inset-0 z-[130] bg-slate-950 text-white grid place-items-center p-6">
    <div className="max-w-lg text-center">
      <div className="text-8xl">📱</div>
      <h1 className="text-4xl font-black mt-4">A.R.I.S.E. Shorts</h1>
      <p className="text-white/70 font-bold mt-2">{error || "No YouTube Shorts matched these settings yet."}</p>
      <button onClick={()=>void loadMore()} className="mt-5 min-h-14 rounded-2xl bg-cyan-300 text-slate-950 px-6 font-black">Try again</button>
      <button onClick={()=>navigate("/eye-gaze-home")} className="mt-3 min-h-12 rounded-2xl bg-white/10 px-6 font-black">Back Home</button>
    </div>
  </main>;

  return <main className="fixed inset-0 z-[130] h-[100dvh] bg-black text-white overflow-hidden select-none">
    <header className="absolute z-[70] top-0 inset-x-0 p-3 flex items-center gap-3 bg-gradient-to-b from-black/85 via-black/35 to-transparent pointer-events-none">
      <button onClick={()=>navigate("/eye-gaze-home")} className="pointer-events-auto min-h-12 rounded-full bg-black/70 border border-white/20 px-4 font-black flex items-center gap-2">
        <ArrowLeft className="w-5 h-5"/> Home
      </button>
      <div className="flex-1 text-center">
        <div className="font-black text-lg">A.R.I.S.E. Shorts</div>
        <div className="text-[10px] font-black text-white/65">Real YouTube Shorts · Ages {settings.tvAgeRange}</div>
      </div>
      <button onClick={()=>setMuted(value=>!value)} className="pointer-events-auto w-12 h-12 rounded-full bg-black/70 border border-white/20 grid place-items-center" aria-label={muted?"Turn sound on":"Mute"}>
        {muted?<VolumeX/>:<Volume2/>}
      </button>
    </header>

    <div ref={feedRef} onScroll={onScroll} className="h-full overflow-y-auto snap-y snap-mandatory overscroll-y-contain scroll-smooth">
      {shorts.map((item, i) => {
        const active = i === index;
        return <article key={item.id} className="relative h-[100dvh] snap-start snap-always bg-black overflow-hidden">
          {active
            ? <div id={`arise-short-player-${i}`} className="absolute inset-0 w-full h-full pointer-events-none" />
            : <img src={`https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />}
          <div className="absolute inset-0 z-20 touch-pan-y" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 z-[21] h-64 bg-gradient-to-t from-black via-black/65 to-transparent pointer-events-none" />

          <div className="absolute z-30 left-4 right-24 bottom-8 pointer-events-none">
            <span className="inline-block rounded-full bg-cyan-300 text-slate-950 px-3 py-1 text-xs font-black">
              {item.source === "parent" ? "✓ GROWN-UP APPROVED SHORT" : "▶ EDUCATIONAL YOUTUBE SHORT"}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black mt-2 leading-tight">{item.title}</h2>
            <p className="font-bold text-white/80 mt-1">{item.channel}</p>
            <p className="text-xs font-bold text-white/55 mt-2">Swipe up for the next Short</p>
          </div>

          {active && <div className="absolute z-40 right-3 bottom-24 flex flex-col gap-3">
            <button onClick={togglePlay} className="w-16 h-16 rounded-full bg-black/70 border-2 border-white/25 grid place-items-center shadow-xl" aria-label={playing?"Pause":"Play"}>
              {playing?<Pause className="w-7 h-7"/>:<Play className="w-7 h-7 fill-current ml-1"/>}
            </button>
            <button onClick={()=>setMuted(value=>!value)} className="w-16 h-16 rounded-full bg-black/70 border-2 border-white/25 grid place-items-center shadow-xl" aria-label={muted?"Turn sound on":"Mute"}>
              {muted?<VolumeX className="w-7 h-7"/>:<Volume2 className="w-7 h-7"/>}
            </button>
          </div>}
        </article>;
      })}

      {loadingMore && <section className="h-[100dvh] snap-start grid place-items-center bg-slate-950">
        <div className="text-center"><div className="w-12 h-12 mx-auto rounded-full border-4 border-cyan-300 border-t-transparent animate-spin"/><p className="mt-4 font-black">Finding more YouTube Shorts…</p></div>
      </section>}
    </div>

    {!automaticDiscovery && <div className="absolute z-50 bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-amber-300 text-slate-950 px-3 py-1 text-[10px] font-black pointer-events-none">Starter educational Shorts</div>}
  </main>;
}
