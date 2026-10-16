// The reward, filling up. The emoji is drawn twice: dim and grey underneath, in full colour on top,
// and the colour rises with the points, so the class can see the pizza (or the party) coming.
import type { CSSProperties } from "react";

export default function Vessel({ emoji, pct, reached }: { emoji: string; pct: number; reached?: boolean }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className={"cg-vessel" + (reached ? " is-reached" : "")} style={{ "--fill": `${p}%` } as CSSProperties} role="img" aria-label={`${emoji} ${p}% filled`}>
      {reached && <span className="cg-rays" aria-hidden />}
      <div className="cg-disc">
        <span className="cg-emoji cg-emoji-dim" aria-hidden>{emoji}</span>
        <div className="cg-liquid" data-empty={p === 0}>
          <div className="cg-liquid-clip"><span className="cg-emoji cg-emoji-lit" aria-hidden>{emoji}</span></div>
        </div>
      </div>
    </div>
  );
}
