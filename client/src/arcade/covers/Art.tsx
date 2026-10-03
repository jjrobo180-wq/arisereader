import { useId, type ReactNode } from "react";
import { H, W, type Ids } from "./paint";
import { SCENES_A } from "./scenesA";
import { SCENES_B } from "./scenesB";

const SCENES: Record<string, (k: Ids) => ReactNode> = { ...SCENES_A, ...SCENES_B };

export const hasArt = (gameId: string) => !!SCENES[gameId];

/**
 * A game's painted key art. "cover" crops the middle for a 3:4 tile; "wide"
 * shows the whole scene (used behind the spotlight and on the game page).
 */
export default function GameArt({ gameId, fit = "cover", className }: { gameId: string; fit?: "cover" | "wide"; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const k: Ids = (name) => `${uid}-${name}`;
  const paint = SCENES[gameId];
  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio={fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"}
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      {paint ? paint(k) : <rect width={W} height={H} fill="#10131f" />}
    </svg>
  );
}
