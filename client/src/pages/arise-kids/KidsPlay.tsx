// /eye-gaze-play/<game>: each game that used to sit inside "Eye-gaze games" opens here on its own, from its own
// tile on the Apps page, and its Back button goes straight back to Apps.
import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from "react";
import { Redirect, useLocation } from "wouter";
import { isPlayGame, type PlayGame } from "@shared/ariseKids";
import { KIDS_TAB_PATHS } from "./kidsUi";

const GAMES: Record<PlayGame, LazyExoticComponent<ComponentType<{ onBack: () => void }>>> = {
  "animal-splash": lazy(() => import("@/pages/AnimalSplashGame")),
  "word-pop": lazy(() => import("@/pages/eye-gaze/WordPopGame")),
  "match-pairs": lazy(() => import("@/pages/eye-gaze/MatchPairsGame")),
  "sentence-train": lazy(() => import("@/pages/eye-gaze/SentenceTrainGame")),
  "reading-runner": lazy(() => import("@/pages/ReadingRunnerPro")),
  "reading-ninja": lazy(() => import("@/pages/ReadingNinja")),
};

export default function KidsPlay({ game }: { game: string }) {
  const [, navigate] = useLocation();
  if (!isPlayGame(game)) return <Redirect to={KIDS_TAB_PATHS.apps} replace />;
  const Game = GAMES[game];
  return (
    <Suspense fallback={<div style={{ position: "fixed", inset: 0, background: "#111827", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Lexend, system-ui, sans-serif", fontSize: 24, fontWeight: 800 }}>Loading…</div>}>
      <Game onBack={() => navigate(KIDS_TAB_PATHS.apps)} />
    </Suspense>
  );
}
