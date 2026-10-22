import { fetchFamilySettings, pathAllowed, type ParentControls } from "@/lib/parentControls";
import EyeGazeLessons from "@/pages/EyeGazeLessons";
import EyeGazeAccessGate from "@/components/EyeGazeAccessGate";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Gamepad2, Sparkles, PawPrint, Move, Zap, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import ReadingRunnerPro from "@/pages/ReadingRunnerPro";
import ReadingNinja from "@/pages/ReadingNinja";
import AnimalSplashGame from "@/pages/AnimalSplashGame";
import MatchPairsGame from "@/pages/eye-gaze/MatchPairsGame";
import WordPopGame from "@/pages/eye-gaze/WordPopGame";
import SentenceTrainGame from "@/pages/eye-gaze/SentenceTrainGame";

type GameId = "animal-splash" | "runner" | "ninja" | "match" | "pop" | "sentence" | null;

export default function EyeGazeGames() {
  const { token, user } = useAuth();
  const [permissions,setPermissions]=useState<ParentControls|null>(null);
  const [permissionsFailed,setPermissionsFailed]=useState(false);
  const isChild=!!user?.is_eye_gaze_user && user.role === "student" && !user.isAdmin;
  useEffect(()=>{let active=true;if(isChild)void fetchFamilySettings(token).then(result=>{if(active)setPermissions(result.settings);}).catch(()=>{if(active)setPermissionsFailed(true);});return()=>{active=false;};},[token,isChild]);
  const canPlay=!isChild || (!!permissions && pathAllowed("/eye-gaze-games",permissions));
  const canLearn=!isChild || (!!permissions && pathAllowed("/library",permissions));
  const [, navigate] = useLocation();
  const [panel, setPanel] = useState<"games" | "lessons">(()=>new URLSearchParams(window.location.search).get("tab")==="lessons"?"lessons":"games");
  const [game, setGame] = useState<GameId>(null);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("eye-gaze-game-immersive", { detail: { active: !!game } }));
  }, [game]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent("eye-gaze-game-immersive", { detail: { active: false } }));
    };
  }, []);

  if(isChild && !permissions)return <div className="p-8 font-bold">{permissionsFailed?"Could not load activity permissions. Please reopen Games.":"Loading activities…"}</div>;
  const activePanel = panel === "games" && !canPlay ? "lessons" : panel === "lessons" && !canLearn ? "games" : panel;
  if (canPlay && isChild && game === "animal-splash") return <AnimalSplashGame onBack={() => setGame(null)} />;
  if (canPlay && game === "runner") return <ReadingRunnerPro onBack={() => setGame(null)} />;
  if (canPlay && game === "ninja") return <ReadingNinja onBack={() => setGame(null)} />;
  if (canPlay && game === "match") return <MatchPairsGame onBack={() => setGame(null)} />;
  if (canPlay && game === "pop") return <WordPopGame onBack={() => setGame(null)} />;
  if (canPlay && game === "sentence") return <SentenceTrainGame onBack={() => setGame(null)} />;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b-2 border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/eye-gaze-home")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Home
          </Button>
          <div className="flex-1">
            <h1 className="font-black text-lg flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-primary" /> Eye Gaze Reading Games
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Reading games with gaze, tap, and movement-based play. No quiz required.</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 pt-5">
        <div className="grid grid-cols-2 gap-3 rounded-3xl bg-white p-2 border-2 border-teal-200" role="tablist" aria-label="Games and lessons">
          <button role="tab" aria-selected={activePanel==="games"} disabled={!canPlay} onClick={()=>setPanel("games")} className={`min-h-16 rounded-2xl text-lg font-black disabled:opacity-40 ${activePanel==="games"?"bg-teal-800 text-white":"text-slate-700 bg-slate-100"}`}>🎮 Games</button>
          <button role="tab" aria-selected={activePanel==="lessons"} disabled={!canLearn} onClick={()=>setPanel("lessons")} className={`min-h-16 rounded-2xl text-lg font-black disabled:opacity-40 ${activePanel==="lessons"?"bg-teal-800 text-white":"text-slate-700 bg-slate-100"}`}>📚 Lessons & books</button>
        </div>
      </div>
      {activePanel === "lessons" ? <EyeGazeAccessGate path="/library"><EyeGazeLessons embedded /></EyeGazeAccessGate> : <main className="max-w-5xl mx-auto px-4 py-6">
        <section className="relative overflow-hidden w-full rounded-[2.2rem] border-2 border-slate-300 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6 sm:p-8 text-white shadow-lg mb-5 min-h-[160px]" aria-label="A.R.I.S.E. City coming later">
          <div className="absolute right-4 bottom-[-22px] text-[120px] sm:text-[150px] opacity-20">🏙️</div>
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-300 text-slate-950 px-3 py-1 text-xs font-black uppercase tracking-widest mb-4">COMING LATER</div>
            <h2 className="text-3xl sm:text-4xl font-black">A.R.I.S.E. City</h2>
            <p className="mt-3 text-white/80 text-base sm:text-lg font-bold max-w-xl">City is parked for now while it is rebuilt and cleaned up. It will return when the experience is ready.</p>
          </div>
        </section>

        {isChild && (
          <button
            type="button"
            onClick={() => setGame("animal-splash")}
            className="relative mb-5 min-h-[250px] w-full overflow-hidden rounded-[2.2rem] border-4 border-sky-300 bg-gradient-to-br from-sky-700 via-cyan-600 to-emerald-500 p-6 text-left text-white shadow-2xl transition-all hover:-translate-y-1 sm:p-8"
          >
            <img
              src="https://commons.wikimedia.org/wiki/Special:Redirect/file/White%20domesticated%20duck%2C%20stretching.jpg?width=760"
              alt=""
              className="absolute inset-y-0 right-0 h-full w-[46%] object-cover opacity-75"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-sky-950 via-sky-900/90 to-sky-800/15" />
            <div className="absolute right-6 top-5 rounded-full border-2 border-white/70 bg-white/90 px-4 py-2 text-xs font-black uppercase tracking-wider text-sky-900 shadow-xl">
              Eye Gazer Only
            </div>
            <div className="relative max-w-[62%]">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-300 px-3 py-1 text-xs font-black uppercase tracking-widest text-slate-950">
                <PawPrint className="h-4 w-4" /> NEW 3D POND · VOICE GAME
              </div>
              <h2 className="text-3xl font-black sm:text-5xl">Animal Splash!</h2>
              <p className="mt-3 text-base font-bold leading-7 text-white/95 sm:text-lg">
                Look at a real animal photo to splash it into a 3D pond, then say what animal it is — or pick a big answer button. Every animal you name joins your pond.
              </p>
              <div className="mt-5 inline-flex rounded-2xl bg-white px-5 py-3 text-lg font-black text-sky-800 shadow-lg">
                SPLASH & SAY →
              </div>
            </div>
          </button>
        )}

        <button
          type="button"
          onClick={() => navigate("/eye-gaze-farm")}
          className="relative overflow-hidden w-full rounded-[2.2rem] border-4 border-emerald-300 bg-gradient-to-br from-[#24492d] via-[#2f6b3b] to-[#7bbf52] p-6 sm:p-8 text-left text-white shadow-xl hover:-translate-y-1 transition-all mb-5 min-h-[230px]"
        >
          <div className="absolute inset-y-0 right-0 w-[42%] bg-[radial-gradient(circle_at_60%_40%,rgba(255,255,255,.18),transparent_55%)]" />
          <div className="absolute right-7 top-7 grid grid-cols-1 h-24 w-24 place-items-center rounded-full border border-white/20 bg-white/10 backdrop-blur">
            <PawPrint className="h-12 w-12 text-white" />
          </div>
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-200 text-emerald-950 px-3 py-1 text-xs font-black uppercase tracking-widest mb-4">
              <PawPrint className="w-4 h-4" /> NEW 3D · EXPLORE · RIDE · FEED
            </div>
            <h2 className="text-3xl sm:text-4xl font-black">A.R.I.S.E. Farm World</h2>
            <p className="mt-2 max-w-xl text-white/90 font-bold text-base sm:text-lg">Explore a big 3D farm as your own character. Meet 30 animals with their real sounds, climb on and ride horses, ponies, cows and pigs, feed the animals, and hunt for 12 golden horseshoes.</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white text-emerald-900 px-5 py-3 font-black">
              <Move className="w-5 h-5" /> Enter Farm World
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate("/eye-gaze-fidgets")}
          className="relative overflow-hidden w-full rounded-[2.2rem] border-4 border-cyan-300 bg-gradient-to-br from-slate-950 via-violet-950 to-cyan-950 p-6 sm:p-8 text-left text-white shadow-xl hover:-translate-y-1 transition-all mb-5 min-h-[210px]"
        >
          <div className="absolute right-[-8px] bottom-[-36px] text-[150px] opacity-25">🫧</div>
          <div className="absolute right-24 top-3 text-5xl opacity-80">🌀</div>
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-300 text-slate-950 px-3 py-1 text-xs font-black uppercase tracking-widest mb-4"><Sparkles className="w-4 h-4"/> NEW 3D · SENSORY PLAY</div>
            <h2 className="text-3xl sm:text-4xl font-black">Fidget Lab</h2>
            <p className="mt-2 text-white/85 font-bold text-base sm:text-lg">Twelve 3D fidgets that react to your eyes: a rainbow pop-it, bubble wrap, a spinner you spin by looking around it, galaxy slime, a ripple pool with ducks, lava orbs, music tiles and more.</p>
            <div className="mt-4 inline-flex rounded-2xl bg-white text-violet-800 px-5 py-3 font-black">OPEN FIDGET LAB →</div>
          </div>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <button
            type="button"
            onClick={() => setGame("runner")}
            className="relative overflow-hidden rounded-[2rem] border-2 border-violet-300 bg-gradient-to-br from-violet-600 via-fuchsia-500 to-sky-500 p-6 sm:p-8 text-left text-white shadow-xl hover:-translate-y-1 transition-all min-h-[280px]"
          >
            <div className="absolute -right-8 -bottom-10 text-[155px] opacity-20 rotate-[-8deg]">🏃</div>
            <div className="absolute right-7 top-5 flex gap-2 text-4xl"><span>🐱</span><span>🐶</span><span>🍎</span></div>
            <div className="relative max-w-lg">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-widest mb-4">
                <Zap className="w-4 h-4" /> NEW 3D · LOOK · RUN · READ
              </div>
              <h2 className="text-3xl sm:text-4xl font-black">Reading Runner</h2>
              <p className="mt-3 text-white/90 text-base sm:text-lg font-bold">Race down the train tracks in 15 worlds. Look left or right to change lanes, look up to jump, dodge trains and run into the card that matches the word.</p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white text-violet-700 px-5 py-3 font-black">
                <Flag className="w-5 h-5" /> Run & Rescue
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setGame("ninja")}
            className="relative overflow-hidden rounded-[2rem] border-2 border-pink-300 bg-gradient-to-br from-fuchsia-700 via-violet-700 to-indigo-800 p-6 sm:p-8 text-left text-white shadow-xl hover:-translate-y-1 transition-all min-h-[280px]"
          >
            <div className="absolute -right-2 -bottom-8 text-[150px] opacity-20">🥷</div>
            <div className="absolute right-7 top-5 flex gap-2 text-4xl"><span>🍎</span><span>🍌</span><span>🐱</span></div>
            <div className="relative max-w-lg">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-widest mb-4">
                ✨ NEW 3D · LOOK · SLICE · READ
              </div>
              <h2 className="text-3xl sm:text-4xl font-black">Reading Ninja</h2>
              <p className="mt-3 text-white/90 text-base sm:text-lg font-bold">Picture-and-word tokens fly up in 15 arenas. Look at the matching ones until they split in two — or swipe right through them. Leave the others alone!</p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white text-fuchsia-700 px-5 py-3 font-black">
                🥷 Start Game
              </div>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {([
            { id: "match", title: "Match Pairs", emoji: "🃏", pics: "🐱🐶🍎", tag: "NEW 3D · LOOK · MATCH", text: "Real 3D cards on a felt table. Look at a word, then its picture — or play memory and flip them over. 8 card sets.", cta: "PLAY MATCH PAIRS", from: "from-violet-600", to: "to-fuchsia-500" },
            { id: "pop", title: "Word Pop", emoji: "🫧", pics: "📘⚽🐸", tag: "NEW 3D · LOOK · POP", text: "Shiny soap bubbles float up with words inside. Read the sign and pop the bubble that matches. Bubbles hold still while you look.", cta: "PLAY WORD POP", from: "from-sky-500", to: "to-indigo-500" },
            { id: "sentence", title: "Sentence Train", emoji: "🚂", pics: "🐶🐱🐸", tag: "NEW 3D · LISTEN · BUILD", text: "Load the word blocks onto the train in the right order. The train reads your sentence back, toots and chugs away!", cta: "ALL ABOARD", from: "from-rose-500", to: "to-orange-400" },
          ] as const).map(c => (
            <button key={c.id} type="button" onClick={() => setGame(c.id)}
              className={`relative overflow-hidden rounded-[2rem] border-2 border-white/60 bg-gradient-to-br ${c.from} ${c.to} p-6 text-left text-white shadow-xl transition-all hover:-translate-y-1 min-h-[250px]`}>
              <div className="absolute -right-3 -bottom-8 text-[120px] opacity-20">{c.emoji}</div>
              <div className="absolute right-5 top-4 text-3xl tracking-widest">{c.pics}</div>
              <div className="relative">
                <div className="mb-3 inline-flex rounded-full bg-white/20 px-3 py-1 text-[11px] font-black uppercase tracking-widest">{c.tag}</div>
                <h2 className="text-2xl font-black sm:text-3xl">{c.title}</h2>
                <p className="mt-2 text-sm font-bold text-white/90 sm:text-base">{c.text}</p>
                <div className="mt-4 inline-flex rounded-2xl bg-white px-4 py-2.5 font-black text-slate-900">{c.cta} →</div>
              </div>
            </button>
          ))}
        </div>
      </main>}

    </div>
  );
}