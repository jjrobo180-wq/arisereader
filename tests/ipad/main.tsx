// Each Eye Gazer game on its own, for the iPad (WebKit, touch) check: ?g=match|pop|sentence|fidget|farm|runner|ninja|splash
import "../../client/src/index.css";
import { createRoot } from "react-dom/client";
import MatchPairsGame from "@/pages/eye-gaze/MatchPairsGame";
import WordPopGame from "@/pages/eye-gaze/WordPopGame";
import SentenceTrainGame from "@/pages/eye-gaze/SentenceTrainGame";
import FidgetLabGame from "@/pages/eye-gaze/FidgetLabGame";
import FarmWorldGame from "@/pages/eye-gaze/FarmWorldGame";
import ReadingRunnerPro from "@/pages/ReadingRunnerPro";
import ReadingNinja from "@/pages/ReadingNinja";
import AnimalSplashGame from "@/pages/AnimalSplashGame";
const G: Record<string, any> = { match: MatchPairsGame, pop: WordPopGame, sentence: SentenceTrainGame, fidget: FidgetLabGame, farm: FarmWorldGame, runner: ReadingRunnerPro, ninja: ReadingNinja, splash: AnimalSplashGame };
const id = new URLSearchParams(location.search).get("g") || "match";
const C = G[id];
createRoot(document.getElementById("root")!).render(<C onBack={() => { (window as any).__back = true; }} />);
