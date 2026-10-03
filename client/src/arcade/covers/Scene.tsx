import { useId, type ReactNode } from "react";
import { H, W, type Ids } from "./paint";

/** Paints one scene on the 480×400 canvas. `k` makes its gradient ids unique. */
export type Painter = (k: Ids) => ReactNode;

/**
 * Painted key art. "cover" crops the middle for a 3:4 tile; "wide" shows the
 * whole scene (used behind the spotlight and on a game's page).
 */
export default function SceneArt({ paint, fit = "cover", className }: { paint?: Painter; fit?: "cover" | "wide"; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const k: Ids = (name) => `${uid}-${name}`;
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
