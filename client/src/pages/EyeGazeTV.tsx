import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, Play, Volume2 } from "lucide-react";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";

type TvAnswer = {
  label: string;
  visual: string;
  correct: boolean;
};

type TvVideo = {
  id: string;
  title: string;
  channel: string;
  age: string;
  topic: string;
  checkpointRatio: number;
  fallbackCheckpoint: number;
  question: string;
  hint: string;
  answers: TvAnswer[];
};

const VIDEOS: TvVideo[] = [
  {
    id: "jwoWBrT-FyU",
    title: "The Count Counts to Zero",
    channel: "Sesame Street",
    age: "Pre-K",
    topic: "Numbers",
    checkpointRatio: 0.55,
    fallbackCheckpoint: 30,
    question: "Which choice shows ZERO stars?",
    hint: "Zero means there are none.",
    answers: [
      { label: "No stars", visual: "⬜", correct: true },
      { label: "Two stars", visual: "⭐⭐", correct: false },
      { label: "Four stars", visual: "⭐⭐⭐⭐", correct: false },
    ],
  },
  {
    id: "w0VQIJVnoxU",
    title: "Daniel's Feeling Songs",
    channel: "PBS KIDS",
    age: "Pre-K–K",
    topic: "Feelings",
    checkpointRatio: 0.55,
    fallbackCheckpoint: 45,
    question: "Which face shows HAPPY?",
    hint: "Think about the feeling on the face.",
    answers: [
      { label: "Happy", visual: "😊", correct: true },
      { label: "Sad", visual: "😢", correct: false },
      { label: "Mad", visual: "😠", correct: false },
    ],
  },
  {
    id: "-k5R0haCa6o",
    title: "The Ancient Animal Crossing",
    channel: "SciShow Kids",
    age: "Grades 1–3",
    topic: "Animals & Earth",
    checkpointRatio: 0.58,
    fallbackCheckpoint: 60,
    question: "What could help animals WALK from one land area to another long ago?",
    hint: "Look for something animals could walk across.",
    answers: [
      { label: "A land bridge", visual: "🌎↔️🌎", correct: true },
      { label: "An airplane", visual: "✈️", correct: false },
      { label: "A rocket", visual: "🚀", correct: false },
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
      u.rate = 0.88;
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
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [watched, setWatched] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("arise-tv-watched") || "{}"); } catch { return {}; }
  });

  const playerRef = useRef<any>(null);
  const intervalRef = useRef<number | null>(null);
  const checkpointPassedRef = useRef(false);
  const questionOpenRef = useRef(false);
  const answeredRef = useRef(false);
  const answerLockedRef = useRef(false);

  const setQuestionState = (open: boolean) => {
    questionOpenRef.current = open;
    setQuestionOpen(open);
  };

  const resetPlaybackState = () => {
    checkpointPassedRef.current = false;
    questionOpenRef.current = false;
    answeredRef.current = false;
    answerLockedRef.current = false;
    setQuestionOpen(false);
    setAnswered(false);
    setFeedback("");
    setSelectedAnswer(null);
    setAnswerLocked(false);
    setPlayerReady(false);
  };

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    const makePlayer = () => {
      if (cancelled || !window.YT?.Player) return;
      try { playerRef.current?.destroy?.(); } catch {}

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
          disablekb: 1,
        },
        events: {
          onReady: (event: any) => {
            setPlayerReady(true);
            try { event.target.playVideo(); } catch {}
          },
          onStateChange: (event: any) => {
            if (event.data === 0 && answeredRef.current) {
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
        if (!player || checkpointPassedRef.current || questionOpenRef.current || answeredRef.current) return;

        try {
          const time = Number(player.getCurrentTime?.() || 0);
          const duration = Number(player.getDuration?.() || 0);
          const checkpoint = duration > 10
            ? Math.max(8, duration * active.checkpointRatio)
            : active.fallbackCheckpoint;

          if (time >= checkpoint) {
            // Lock the checkpoint BEFORE React rerenders so the interval cannot fire twice.
            checkpointPassedRef.current = true;
            questionOpenRef.current = true;
            try { player.pauseVideo?.(); } catch {}
            setSelectedAnswer(null);
            setFeedback("");
            setQuestionOpen(true);
            speak(active.question);
          }
        } catch {}
      }, 250);
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
    resetPlaybackState();
    setActive(video);
  };

  const leaveVideo = () => {
    stopSpeaking();
    resetPlaybackState();
    setActive(null);
  };

  const answerQuestion = (choice: TvAnswer) => {
    if (!active || answerLockedRef.current || answeredRef.current) return;

    answerLockedRef.current = true;
    setAnswerLocked(true);
    setSelectedAnswer(choice.label);

    if (choice.correct) {
      answeredRef.current = true;
      setAnswered(true);
      setFeedback("Yes! You got it!");
      speak("Yes! You got it! Keep watching.");

      // Resume in the same user interaction. The checkpoint is already permanently passed.
      try { playerRef.current?.playVideo?.(); } catch {}

      window.setTimeout(() => {
        setQuestionState(false);
        setAnswerLocked(false);
        answerLockedRef.current = false;
        setFeedback("Great job! The video is continuing.");
      }, 500);

      window.setTimeout(() => setFeedback(""), 1800);
      return;
    }

    setFeedback("Good try. Look again.");
    speak("Good try. Look again.");
    window.setTimeout(() => {
      setSelectedAnswer(null);
      setAnswerLocked(false);
      answerLockedRef.current = false;
      setFeedback("");
    }, 900);
  };

  if (active) {
    return (
      <main className="fixed inset-0 z-[120] h-[100dvh] bg-slate-950 text-white overflow-hidden flex flex-col">
        <header className="flex items-center gap-2 p-2 sm:p-3 bg-slate-950 border-b border-white/10 flex-shrink-0">
          <button type="button" onClick={leaveVideo} className="min-h-12 rounded-2xl bg-white/10 px-4 font-black flex items-center gap-2">
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
          {!playerReady && <div className="absolute inset-0 z-20 bg-slate-950 grid place-items-center font-black text-xl">Loading video…</div>}

          {questionOpen && (
            <div className="absolute inset-0 z-50 bg-slate-950/98 backdrop-blur-sm p-3 sm:p-8 grid place-items-center pointer-events-auto">
              <div className="w-full max-w-5xl">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 rounded-full bg-cyan-300/15 border border-cyan-200/30 px-4 py-2 text-cyan-200 font-black text-sm">🧠 Quick Learning Check</div>
                  <h2 className="text-2xl sm:text-5xl font-black mt-4 leading-tight">{active.question}</h2>
                  <p className="mt-2 font-bold text-white/65">{active.hint}</p>
                  <button type="button" onClick={() => speak(active.question)} className="mt-3 min-h-12 rounded-2xl bg-white/10 px-5 font-black inline-flex items-center gap-2 touch-manipulation"><Volume2 className="w-5 h-5"/> Hear question</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5 mt-5">
                  {active.answers.map(choice => {
                    const selected = selectedAnswer === choice.label;
                    const stateClass = selected
                      ? choice.correct
                        ? "border-emerald-300 bg-emerald-50 ring-8 ring-emerald-300/30"
                        : "border-rose-400 bg-rose-50 ring-8 ring-rose-400/30"
                      : "border-white bg-white hover:border-cyan-300";

                    return (
                      <button
                        key={choice.label}
                        type="button"
                        disabled={answerLocked}
                        onClick={() => answerQuestion(choice)}
                        aria-pressed={selected}
                        className={"relative z-10 min-h-[125px] sm:min-h-[235px] rounded-[1.75rem] text-slate-950 border-4 focus:outline-none focus:ring-8 focus:ring-cyan-300/30 flex sm:flex-col items-center justify-center gap-4 p-4 shadow-2xl touch-manipulation transition-all disabled:opacity-100 " + stateClass}
                      >
                        <span className="text-5xl sm:text-7xl leading-none">{choice.visual}</span>
                        <strong className="text-xl sm:text-3xl font-black">{choice.label}</strong>
                        {selected && <span className="absolute top-2 right-3 text-2xl">{choice.correct ? "✓" : "✕"}</span>}
                      </button>
                    );
                  })}
                </div>

                {feedback && (
                  <div role="status" aria-live="assertive" className={"mt-4 rounded-2xl px-4 py-3 text-center text-xl sm:text-2xl font-black " + (answered ? "bg-emerald-400 text-slate-950" : "bg-amber-200 text-slate-950")}>
                    {feedback}
                  </div>
                )}
                <p className="text-center text-xs sm:text-sm font-bold text-white/50 mt-3">Choose the correct answer once. Then the video continues automatically.</p>
              </div>
            </div>
          )}

          {feedback && !questionOpen && answered && (
            <div className="absolute left-1/2 -translate-x-1/2 top-4 z-40 rounded-full bg-emerald-400 text-slate-950 px-5 py-3 font-black shadow-xl flex items-center gap-2">
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
          <p className="text-lg sm:text-xl font-bold text-slate-600 mt-2 max-w-3xl">Choose one approved educational video. The video pauses once for a real learning check, then continues after the correct answer.</p>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {VIDEOS.map(video => (
          <button key={video.id} type="button" onClick={() => chooseVideo(video)} className="overflow-hidden rounded-[2rem] bg-white border-2 border-sky-100 shadow-lg text-left hover:-translate-y-1 hover:shadow-xl transition-all focus:outline-none focus:ring-4 focus:ring-violet-200 touch-manipulation">
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
    </main>
  );
}
