import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, Play, Volume2 } from "lucide-react";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";

type TvVideo = {
  id: string;
  title: string;
  channel: string;
  age: string;
  topic: string;
  checkpoint: number;
  question: string;
  answers: Array<{ label: string; emoji: string; correct: boolean }>;
};

const VIDEOS: TvVideo[] = [
  {
    id: "jwoWBrT-FyU",
    title: "The Count Counts to Zero",
    channel: "Sesame Street",
    age: "Pre-K",
    topic: "Numbers",
    checkpoint: 28,
    question: "What does zero mean?",
    answers: [
      { label: "Nothing", emoji: "0️⃣", correct: true },
      { label: "Ten things", emoji: "🔟", correct: false },
    ],
  },
  {
    id: "w0VQIJVnoxU",
    title: "Daniel's Feeling Songs",
    channel: "PBS KIDS",
    age: "Pre-K–K",
    topic: "Feelings",
    checkpoint: 45,
    question: "What is Daniel learning about?",
    answers: [
      { label: "Feelings", emoji: "😊", correct: true },
      { label: "Cars", emoji: "🚗", correct: false },
    ],
  },
  {
    id: "-k5R0haCa6o",
    title: "The Ancient Animal Crossing",
    channel: "SciShow Kids",
    age: "Grades 1–3",
    topic: "Animals",
    checkpoint: 50,
    question: "What are they learning about?",
    answers: [
      { label: "Animals", emoji: "🐻", correct: true },
      { label: "Music", emoji: "🎵", correct: false },
    ],
  },
];

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
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    },
  });
}

export default function EyeGazeTV() {
  const [, navigate] = useLocation();
  const [active, setActive] = useState<TvVideo | null>(null);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [watched, setWatched] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("arise-tv-watched") || "{}"); } catch { return {}; }
  });
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const makePlayer = () => {
      if (cancelled || !window.YT?.Player) return;
      if (playerRef.current?.destroy) {
        try { playerRef.current.destroy(); } catch {}
      }

      playerRef.current = new window.YT.Player("arise-tv-player", {
        videoId: active.id,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0,
          playsinline: 1,
          modestbranding: 1,
          fs: 0,
        },
        events: {
          onReady: (event: any) => {
            try { event.target.playVideo(); } catch {}
          },
          onStateChange: (event: any) => {
            if (event.data === 0 && answered) {
              setWatched(prev => {
                const next = { ...prev, [active.id]: true };
                localStorage.setItem("arise-tv-watched", JSON.stringify(next));
                return next;
              });
            }
          },
        },
      });

      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = window.setInterval(() => {
        const player = playerRef.current;
        if (!player || questionOpen || answered) return;
        try {
          const time = Number(player.getCurrentTime?.() || 0);
          if (time >= active.checkpoint) {
            player.pauseVideo?.();
            setQuestionOpen(true);
            setFeedback("");
            speak(active.question);
          }
        } catch {}
      }, 350);
    };

    if (window.YT?.Player) {
      makePlayer();
    } else {
      const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (!existing) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.head.appendChild(script);
      }
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        makePlayer();
      };
    }

    return () => {
      cancelled = true;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = null;
      stopSpeaking();
    };
  }, [active?.id]);

  const chooseVideo = (video: TvVideo) => {
    setAnswered(false);
    setQuestionOpen(false);
    setFeedback("");
    setActive(video);
  };

  const answerQuestion = (choice: TvVideo["answers"][number]) => {
    if (!active) return;
    if (choice.correct) {
      setAnswered(true);
      setQuestionOpen(false);
      setFeedback("Yes! Great job!");
      speak("Yes! Great job! Keep watching.");
      window.setTimeout(() => {
        try { playerRef.current?.playVideo?.(); } catch {}
      }, 450);
    } else {
      setFeedback("Good try. Choose again.");
      speak("Good try. Choose again.");
    }
  };

  if (active) {
    return (
      <main className="fixed inset-0 z-[120] h-[100dvh] bg-slate-950 text-white overflow-hidden flex flex-col">
        <header className="flex items-center gap-2 p-2 sm:p-3 bg-slate-950 border-b border-white/10 flex-shrink-0">
          <button type="button" onClick={() => setActive(null)} className="min-h-12 rounded-2xl bg-white/10 px-4 font-black flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" /> Videos
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-cyan-300">A.R.I.S.E. TV · {active.topic}</div>
            <div className="font-black truncate">{active.title}</div>
          </div>
          {answered && <div className="rounded-full bg-emerald-400 text-slate-950 px-3 py-2 text-xs font-black">✓ CHECK PASSED</div>}
        </header>

        <section className="relative flex-1 min-h-0 bg-black">
          <div id="arise-tv-player" className="absolute inset-0 w-full h-full" />

          {questionOpen && (
            <div className="absolute inset-0 z-40 bg-slate-950/96 backdrop-blur-sm p-4 sm:p-8 grid place-items-center">
              <div className="w-full max-w-4xl">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 rounded-full bg-cyan-300/15 border border-cyan-200/30 px-4 py-2 text-cyan-200 font-black text-sm">🧠 Quick Learning Check</div>
                  <h2 className="text-3xl sm:text-5xl font-black mt-4">{active.question}</h2>
                  <button type="button" onClick={() => speak(active.question)} className="mt-3 min-h-12 rounded-2xl bg-white/10 px-5 font-black inline-flex items-center gap-2"><Volume2 className="w-5 h-5"/> Hear question</button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-5 mt-6">
                  {active.answers.map(choice => (
                    <button
                      key={choice.label}
                      type="button"
                      onClick={() => answerQuestion(choice)}
                      className="min-h-[190px] sm:min-h-[250px] rounded-[2rem] bg-white text-slate-950 border-4 border-white hover:border-cyan-300 focus:outline-none focus:ring-8 focus:ring-cyan-300/30 flex flex-col items-center justify-center p-4 shadow-2xl"
                    >
                      <span className="text-7xl sm:text-8xl">{choice.emoji}</span>
                      <strong className="text-2xl sm:text-4xl font-black mt-3">{choice.label}</strong>
                    </button>
                  ))}
                </div>

                {feedback && <div role="status" className="mt-5 text-center text-2xl font-black text-amber-200">{feedback}</div>}
                <p className="text-center text-sm font-bold text-white/55 mt-4">The video stays paused until the learning check is answered correctly.</p>
              </div>
            </div>
          )}

          {feedback && !questionOpen && answered && (
            <div className="absolute left-1/2 -translate-x-1/2 top-4 z-20 rounded-full bg-emerald-400 text-slate-950 px-5 py-3 font-black shadow-xl flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> {feedback}
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <section className="rounded-[2rem] bg-gradient-to-r from-violet-100 via-white to-cyan-100 border border-violet-100 p-5 sm:p-7">
        <button type="button" onClick={() => navigate("/eye-gaze-home")} className="min-h-12 rounded-2xl bg-white border border-slate-200 px-4 font-black flex items-center gap-2"><ArrowLeft className="w-5 h-5"/> Home</button>
        <div className="mt-5">
          <p className="text-sm font-black uppercase tracking-widest text-violet-600">Safe learning videos</p>
          <h1 className="text-4xl sm:text-6xl font-black text-blue-950 mt-1">A.R.I.S.E. TV 📺</h1>
          <p className="text-lg sm:text-xl font-bold text-slate-600 mt-2 max-w-3xl">Choose one educational video. Halfway through, the video pauses for one simple question before it can continue.</p>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {VIDEOS.map(video => (
          <button key={video.id} type="button" onClick={() => chooseVideo(video)} className="overflow-hidden rounded-[2rem] bg-white border-2 border-sky-100 shadow-lg text-left hover:-translate-y-1 hover:shadow-xl transition-all focus:outline-none focus:ring-4 focus:ring-violet-200">
            <div className="relative aspect-video bg-slate-200 overflow-hidden">
              <img src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-black/10 grid place-items-center"><span className="w-16 h-16 rounded-full bg-white/95 text-violet-700 grid place-items-center shadow-xl"><Play className="w-8 h-8 fill-current ml-1"/></span></div>
              {watched[video.id] && <span className="absolute top-3 right-3 rounded-full bg-emerald-400 text-slate-950 px-3 py-1 text-xs font-black">✓ Watched</span>}
            </div>
            <div className="p-5">
              <div className="flex gap-2 flex-wrap text-xs font-black uppercase tracking-wide">
                <span className="rounded-full bg-violet-100 text-violet-700 px-2 py-1">{video.topic}</span>
                <span className="rounded-full bg-sky-100 text-sky-700 px-2 py-1">{video.age}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-blue-950 mt-3">{video.title}</h2>
              <p className="font-bold text-slate-500 mt-1">{video.channel}</p>
              <div className="mt-4 min-h-12 rounded-2xl bg-violet-600 text-white font-black flex items-center justify-center">▶ Watch & Learn</div>
            </div>
          </button>
        ))}
      </section>

      <section className="rounded-[2rem] bg-white border border-slate-100 p-5">
        <h2 className="text-xl font-black text-blue-950">How A.R.I.S.E. TV works</h2>
        <p className="font-bold text-slate-600 mt-2">There is no open YouTube search here. Only approved educational videos appear. Each video has one built-in comprehension checkpoint that pauses playback until the learner answers correctly.</p>
      </section>
    </main>
  );
}
