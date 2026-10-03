import SceneArt, { type Painter } from "./Scene";
import { SCENES_A } from "./scenesA";
import { SCENES_B } from "./scenesB";

const SCENES: Record<string, Painter> = { ...SCENES_A, ...SCENES_B };

export const hasArt = (gameId: string) => !!SCENES[gameId];

/** An arcade game's painted key art (see SceneArt for the two fits). */
export default function GameArt({ gameId, fit = "cover", className }: { gameId: string; fit?: "cover" | "wide"; className?: string }) {
  return <SceneArt paint={SCENES[gameId]} fit={fit} className={className} />;
}
