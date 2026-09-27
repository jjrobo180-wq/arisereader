import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { addTvUsage, fetchFamilySettings, getTvUsage, type FamilyVideo, type ParentControls } from "@/lib/parentControls";
import { makeAriseShortBatch, type AriseShort } from "@/lib/ariseShorts";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";

type FeedItem =
  | { kind: "generated"; key: string; short: AriseShort }
  | { kind: "youtube"; key: string; video: FamilyVideo };

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function speak(text: string) {
  stopSpeaking();
  void speakCharacterAI(text, {
    calmMode: true,
    onFallback: () => {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.88;
      window.speechSynthesis.speak(utterance);
    },
  });
}

function buildFeed(settings: ParentControls, generatedCount: number): FeedItem[] {
  const generated = makeAriseShortBatch(0, generatedCount, settings.tvAgeRange, settings.tvTopics)
    .map(short => ({ kind: "generated" as const, key: short.id, short }));

  if (!settings.videos.length) return generated;

  const feed: FeedItem[] = [];
  let videoIndex = 0;
  generated.forEach((item, index) => {
    feed.push(item);
    if ((index + 1) % 6 === 0 && videoIndex < settings.videos.length) {
      const video = settings.videos[videoIndex];
      feed.push({ kind: "youtube", key: `youtube-${video.id}-${videoIndex}`, video });
      videoIndex++;
    }
  });
  while (videoIndex < settings.videos.length) {
    const video = settings.videos[videoIndex];
    feed.push({ kind: "youtube", key: `youtube-${video.id}-${videoIndex}`, video });
    videoIndex++;
  }
  return feed;
}

export default function EyeGazeTV() {
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const [settings, setSettings] = useState<ParentControls | null>(null);
  const [generatedCount, setGeneratedCount] = useState(30);
  const [index, setIndex] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [youtubePlaying, setYoutubePlaying] = useState(false);
  const [usageMinutes, setUsageMinutes] = useState(0);
  const [error, setError] = useState("");

  const playerRef = useRef<any>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const usageTimerRef = useRef<number | null>(null);
  const sceneTimerRef = useRef<number | null>(null);

  const feed = useMemo(() => settings ? buildFeed(settings, generatedCount) : [], [settings, generatedCount]);
  const current = feed[index];
  const limited = !!settings?.tvDailyMinutes && usageMinutes >= settings.tvDailyMinutes;

  useEffect(() => {
    let active = true;
    Promise.all([fetchFamilySettings(token), getTvUsage(token)])
      .then(([family, usage]) => {
        if (!active) return;
        setSettings(family.settings);
        setUsageMinutes(usage.minutes || 0);
      })
      .catch(err => { if (active) setError(err.message || "Could not load A.R.I.S.E. Shorts."); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!current || current.kind !== "generated" || limited) return;
    setSceneIndex(0);
    if (!muted) speak(current.short.scenes[0].say);

    if (sceneTimerRef.current) window.clearInterval(sceneTimerRef.current);
    sceneTimerRef.current = window.setInterval(() => {
      setSceneIndex(previous => {
        const next = (previous + 1) % current.short.scenes.length;
        if (!muted) speak(current.short.scenes[next].say);
        return next;
      });
    }, 3600);

    return () => {
      if (sceneTimerRef.current) window.clearInterval(sceneTimerRef.current);
      sceneTimerRef.current = null;
      stopSpeaking();
    };
  }, [current?.key, muted, limited]);

  useEffect(() => {
    if (!current || current.kind !== "youtube" || limited) {
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = null;
      setYoutubePlaying(false);
      return;
    }

    let cancelled = false;
    const createPlayer = () => {
      if (cancelled || !window.YT?.Player) return;
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = new window.YT.Player(`arise-short-player-${index}`, {
        videoId: current.video.id,
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
          playlist: current.video.id,
        },
        events: {
          onReady: (event: any) => {
            try {
              if (muted) event.target.mute?.(); else event.target.unMute?.();
              event.target.playVideo?.();
            } catch {}
          },
          onStateChange: (event: any) => setYoutubePlaying(event.data === 1),
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
      setYoutubePlaying(false);
    };
  }, [current?.key, limited]);

  useEffect(() => {
    try {
      if (muted) playerRef.current?.mute?.();
      else playerRef.current?.unMute?.();
    } catch {}
    if (muted) stopSpeaking();
    else if (current?.kind === "generated") speak(current.short.scenes[sceneIndex]?.say || current.short.scenes[0].say);
  }, [muted]);

  useEffect(() => {
    if (usageTimerRef.current) window.clearInterval(usageTimerRef.current);
    usageTimerRef.current = null;
    if (!settings || limited) return;

    usageTimerRef.current = window.setInterval(() => {
      void addTvUsage(token, 15)
        .then(result => setUsageMinutes(result.minutes || 0))
        .catch(() => {});
    }, 15000);

    return () => {
      if (usageTimerRef.current) window.clearInterval(usageTimerRef.current);
      usageTimerRef.current = null;
    };
  }, [settings, limited, token]);

  useEffect(() => {
    if (feed.length - index <= 8) setGeneratedCount(count => count + 24);
  }, [index, feed.length]);

  useEffect(() => () => {
    stopSpeaking();
    if (usageTimerRef.current) window.clearInterval(usageTimerRef.current);
    if (sceneTimerRef.current) window.clearInterval(sceneTimerRef.current);
    try { playerRef.current?.destroy?.(); } catch {}
  }, []);

  const toggleYoutubePlay = () => {
    try {
      if (youtubePlaying) playerRef.current?.pauseVideo?.();
      else playerRef.current?.playVideo?.();
    } catch {}
  };

  const onScroll = () => {
    const el = feedRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(feed.length - 1, Math.round(el.scrollTop / Math.max(1, el.clientHeight))));
    if (next !== index) {
      setIndex(next);
      setSceneIndex(0);
    }
  };

  if (limited) return <main className="fixed inset-0 z-[130] bg-slate-950 text-white grid place-items-center p-6">
    <div className="max-w-lg text-center">
      <div className="text-8xl">🌙</div>
      <h1 className="text-4xl font-black mt-4">Shorts time is finished for today</h1>
      <p className="text-white/70 font-bold mt-2">Your grown-up set today's A.R.I.S.E. Shorts limit.</p>
      <button onClick={()=>navigate("/eye-gaze-home")} className="mt-6 min-h-14 rounded-2xl bg-white text-slate-950 px-6 font-black">Back Home</button>
    </div>
  </main>;

  if (error) return <main className="fixed inset-0 z-[130] bg-slate-950 text-white grid place-items-center p-6">
    <div className="max-w-lg text-center">
      <div className="text-7xl">📱</div>
      <h1 className="text-3xl font-black mt-3">A.R.I.S.E. Shorts</h1>
      <p className="mt-3 font-bold text-rose-200">{error}</p>
      <button onClick={()=>navigate("/eye-gaze-home")} className="mt-5 min-h-14 rounded-2xl bg-white text-slate-950 px-6 font-black">Back Home</button>
    </div>
  </main>;

  if (!settings) return <main className="fixed inset-0 z-[130] bg-slate-950 text-white grid place-items-center font-black">Loading A.R.I.S.E. Shorts…</main>;

  return <main className="fixed inset-0 z-[130] h-[100dvh] bg-black text-white overflow-hidden select-none">
    <header className="absolute z-[70] top-0 inset-x-0 p-3 flex items-center gap-3 bg-gradient-to-b from-black/85 via-black/35 to-transparent pointer-events-none">
      <button onClick={()=>navigate("/eye-gaze-home")} className="pointer-events-auto min-h-12 rounded-full bg-black/70 border border-white/20 px-4 font-black flex items-center gap-2">
        <ArrowLeft className="w-5 h-5"/> Home
      </button>
      <div className="flex-1 text-center">
        <div className="font-black text-lg">A.R.I.S.E. Shorts</div>
        <div className="text-[10px] font-black text-white/65">Ages {settings.tvAgeRange} · endless learning feed</div>
      </div>
      <button onClick={()=>setMuted(value=>!value)} className="pointer-events-auto w-12 h-12 rounded-full bg-black/70 border border-white/20 grid place-items-center" aria-label={muted?"Turn sound on":"Mute"}>
        {muted?<VolumeX/>:<Volume2/>}
      </button>
    </header>

    <div ref={feedRef} onScroll={onScroll} className="h-full overflow-y-auto snap-y snap-mandatory overscroll-y-contain scroll-smooth">
      {feed.map((item, i) => {
        if (item.kind === "youtube") {
          const active = i === index;
          return <article key={item.key} className="relative h-[100dvh] snap-start snap-always bg-black overflow-hidden">
            {active
              ? <div id={`arise-short-player-${i}`} className="absolute inset-0 w-full h-full pointer-events-none" />
              : <img src={`https://i.ytimg.com/vi/${item.video.id}/hqdefault.jpg`} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />}
            <div className="absolute inset-0 z-20 touch-pan-y" aria-hidden="true" />
            <div className="absolute inset-x-0 bottom-0 z-[21] h-64 bg-gradient-to-t from-black via-black/65 to-transparent pointer-events-none" />
            <div className="absolute z-30 left-4 right-24 bottom-8 pointer-events-none">
              <span className="inline-block rounded-full bg-fuchsia-300 text-slate-950 px-3 py-1 text-xs font-black">▶ PARENT-APPROVED YOUTUBE SHORT</span>
              <h2 className="text-2xl sm:text-4xl font-black mt-2 leading-tight">{item.video.title}</h2>
              <p className="font-bold text-white/80 mt-1">{item.video.topic} · {item.video.channel}</p>
              <p className="text-xs font-bold text-white/55 mt-2">Swipe up for the next Short</p>
            </div>
            {active && <button onClick={toggleYoutubePlay} className="absolute z-40 right-3 bottom-28 w-16 h-16 rounded-full bg-black/70 border-2 border-white/25 grid place-items-center shadow-xl" aria-label={youtubePlaying?"Pause":"Play"}>
              {youtubePlaying?<Pause className="w-7 h-7"/>:<Play className="w-7 h-7 fill-current ml-1"/>}
            </button>}
          </article>;
        }

        const active = i === index;
        const scene = item.short.scenes[active ? sceneIndex : 0];
        return <article key={item.key} className="relative h-[100dvh] snap-start snap-always overflow-hidden bg-gradient-to-b from-violet-700 via-blue-700 to-slate-950">
          <style>{`
            @keyframes shortFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-14px) scale(1.04)}}
            @keyframes shortPop{0%{opacity:0;transform:scale(.8) translateY(18px)}15%{opacity:1;transform:scale(1) translateY(0)}85%{opacity:1}100%{opacity:.95}}
          `}</style>
          <div className="absolute inset-0 opacity-25" style={{backgroundImage:"radial-gradient(circle,white 1px,transparent 1px)",backgroundSize:"34px 34px"}} />
          <div className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[88vw] max-w-[580px] text-center">
            <div key={`${item.key}-${active ? sceneIndex : 0}`} style={{animation:"shortPop .45s ease-out both"}}>
              <div className="text-[9rem] sm:text-[13rem] leading-none drop-shadow-2xl" style={{animation:"shortFloat 2.8s ease-in-out infinite"}}>{scene.visual}</div>
              <h2 className="text-4xl sm:text-6xl font-black mt-6 leading-tight drop-shadow-xl">{scene.title}</h2>
              <p className="text-xl sm:text-3xl font-black text-white/90 mt-4 leading-snug">{scene.caption}</p>
            </div>
          </div>

          <div className="absolute z-30 left-4 right-20 bottom-8 pointer-events-none">
            <span className="inline-block rounded-full bg-cyan-300 text-slate-950 px-3 py-1 text-xs font-black">✨ A.R.I.S.E.-MADE SHORT</span>
            <p className="font-black mt-2 text-lg">{item.short.topicLabel}</p>
            <p className="text-xs font-bold text-white/60 mt-1">Swipe up for another · A.R.I.S.E. keeps making more</p>
            <div className="grid grid-cols-3 gap-1 mt-3 max-w-xs">
              {item.short.scenes.map((_, sceneNumber) => <div key={sceneNumber} className={`h-1.5 rounded-full ${active && sceneNumber === sceneIndex ? "bg-cyan-300" : "bg-white/30"}`} />)}
            </div>
          </div>

          {active && <button onClick={()=>{ if(muted){setMuted(false); speak(scene.say);} else speak(scene.say); }} className="absolute z-40 right-3 bottom-28 w-16 h-16 rounded-full bg-black/55 border-2 border-white/25 grid place-items-center shadow-xl" aria-label="Hear this Short">
            <Volume2 className="w-7 h-7"/>
          </button>}
        </article>;
      })}
    </div>
  </main>;
}
