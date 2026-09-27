import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { addTvUsage, fetchFamilySettings, getTvUsage, type FamilyVideo, type ParentControls } from "@/lib/parentControls";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export default function EyeGazeTV() {
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const [settings, setSettings] = useState<ParentControls | null>(null);
  const [videos, setVideos] = useState<FamilyVideo[]>([]);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [usageMinutes, setUsageMinutes] = useState(0);
  const [error, setError] = useState("");
  const playerRef = useRef<any>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const usageTimerRef = useRef<number | null>(null);

  const limited = !!settings?.tvDailyMinutes && usageMinutes >= settings.tvDailyMinutes;

  useEffect(() => {
    let active = true;
    Promise.all([fetchFamilySettings(token), getTvUsage(token)])
      .then(([family, usage]) => {
        if (!active) return;
        setSettings(family.settings);
        setVideos(family.settings.videos || []);
        setUsageMinutes(usage.minutes || 0);
      })
      .catch(err => { if (active) setError(err.message || "Could not load A.R.I.S.E. TV."); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!videos.length || limited) return;
    let cancelled = false;

    const createPlayer = () => {
      if (cancelled || !window.YT?.Player) return;
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = new window.YT.Player(`arise-tv-player-${index}`, {
        videoId: videos[index].id,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, controls: 0, rel: 0, playsinline: 1, modestbranding: 1, fs: 0, disablekb: 1 },
        events: {
          onReady: (event: any) => {
            try {
              if (muted) event.target.mute?.(); else event.target.unMute?.();
              event.target.playVideo?.();
            } catch {}
          },
          onStateChange: (event: any) => setPlaying(event.data === 1),
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
      setPlaying(false);
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = null;
    };
  }, [index, videos, limited]);

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
      void addTvUsage(token, 15)
        .then(result => setUsageMinutes(result.minutes || 0))
        .catch(() => {});
    }, 15000);

    return () => {
      if (usageTimerRef.current) window.clearInterval(usageTimerRef.current);
      usageTimerRef.current = null;
    };
  }, [playing, limited, token]);

  const togglePlay = () => {
    try {
      if (playing) playerRef.current?.pauseVideo?.();
      else playerRef.current?.playVideo?.();
    } catch {}
  };

  const onScroll = () => {
    const el = feedRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(videos.length - 1, Math.round(el.scrollTop / Math.max(1, el.clientHeight))));
    if (next !== index) setIndex(next);
  };

  if (limited) return <main className="fixed inset-0 z-[130] bg-slate-950 text-white grid place-items-center p-6">
    <div className="max-w-lg text-center"><div className="text-8xl">🌙</div><h1 className="text-4xl font-black mt-4">TV time is finished for today</h1><p className="text-white/70 font-bold mt-2">Your grown-up set today's A.R.I.S.E. TV limit.</p><button onClick={()=>navigate("/eye-gaze-home")} className="mt-6 min-h-14 rounded-2xl bg-white text-slate-950 px-6 font-black">Back Home</button></div>
  </main>;

  if (error) return <main className="fixed inset-0 z-[130] bg-slate-950 text-white grid place-items-center p-6"><div className="max-w-lg text-center"><div className="text-7xl">📺</div><h1 className="text-3xl font-black mt-3">A.R.I.S.E. TV</h1><p className="mt-3 font-bold text-rose-200">{error}</p><button onClick={()=>navigate("/eye-gaze-home")} className="mt-5 min-h-14 rounded-2xl bg-white text-slate-950 px-6 font-black">Back Home</button></div></main>;

  if (!settings) return <main className="fixed inset-0 z-[130] bg-slate-950 text-white grid place-items-center font-black">Loading A.R.I.S.E. TV…</main>;

  if (!videos.length) return <main className="fixed inset-0 z-[130] bg-slate-950 text-white grid place-items-center p-6">
    <div className="max-w-lg text-center"><div className="text-8xl">📺</div><h1 className="text-4xl font-black mt-4">Your TV is ready</h1><p className="text-white/70 font-bold mt-2">A grown-up has not added any learning videos yet.</p><button onClick={()=>navigate("/eye-gaze-home")} className="mt-6 min-h-14 rounded-2xl bg-white text-slate-950 px-6 font-black">Back Home</button></div>
  </main>;

  return <main className="fixed inset-0 z-[130] h-[100dvh] bg-black text-white overflow-hidden select-none">
    <header className="absolute z-50 top-0 inset-x-0 p-3 flex items-center gap-3 bg-gradient-to-b from-black/80 via-black/35 to-transparent pointer-events-none">
      <button onClick={()=>navigate("/eye-gaze-home")} className="pointer-events-auto min-h-12 rounded-full bg-black/70 border border-white/20 px-4 font-black flex items-center gap-2"><ArrowLeft className="w-5 h-5"/> Home</button>
      <div className="flex-1 text-center"><div className="font-black text-lg">A.R.I.S.E. TV</div><div className="text-[10px] font-black text-white/65">{index+1} of {videos.length}</div></div>
      <button onClick={()=>setMuted(v=>!v)} className="pointer-events-auto w-12 h-12 rounded-full bg-black/70 border border-white/20 grid place-items-center" aria-label={muted?"Turn sound on":"Mute"}>{muted?<VolumeX/>:<Volume2/>}</button>
    </header>

    <div ref={feedRef} onScroll={onScroll} className="h-full overflow-y-auto snap-y snap-mandatory overscroll-y-contain scroll-smooth">
      {videos.map((video,i)=><article key={video.id} className="relative h-[100dvh] snap-start snap-always bg-slate-950 overflow-hidden">
        {i === index ? <div id={`arise-tv-player-${i}`} className="absolute inset-0 w-full h-full pointer-events-none" /> :
          <img src={`https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`} onError={e=>{e.currentTarget.src=`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;}} alt="" className="absolute inset-0 w-full h-full object-contain bg-black" />}
        <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black via-black/55 to-transparent pointer-events-none" />
        <div className="absolute z-30 left-4 right-20 bottom-8 pointer-events-none">
          <span className="inline-block rounded-full bg-cyan-300 text-slate-950 px-3 py-1 text-xs font-black">✓ GROWN-UP APPROVED</span>
          <h2 className="text-2xl sm:text-4xl font-black mt-2 leading-tight">{video.title}</h2>
          <p className="font-bold text-white/80 mt-1">{video.topic} · {video.channel}</p>
          <p className="text-xs font-bold text-white/55 mt-2">Swipe up for the next video</p>
        </div>
        {i === index && <div className="absolute z-40 right-3 bottom-24 flex flex-col gap-3">
          <button onClick={togglePlay} className="w-16 h-16 rounded-full bg-black/70 border-2 border-white/25 grid place-items-center shadow-xl" aria-label={playing?"Pause":"Play"}>{playing?<Pause className="w-7 h-7"/>:<Play className="w-7 h-7 fill-current ml-1"/>}</button>
          <button onClick={()=>setMuted(v=>!v)} className="w-16 h-16 rounded-full bg-black/70 border-2 border-white/25 grid place-items-center shadow-xl" aria-label={muted?"Turn sound on":"Mute"}>{muted?<VolumeX className="w-7 h-7"/>:<Volume2 className="w-7 h-7"/>}</button>
        </div>}
      </article>)}
    </div>
  </main>;
}
