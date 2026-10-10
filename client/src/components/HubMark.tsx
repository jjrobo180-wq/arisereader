// The Arise hub mark: a split field with two left-aligned bars crossing the seam.
//
// Same geometry as the site icon (client/public/favicon.svg) — only the accent colour changes,
// so WorkHub and LifeHub read as siblings rather than as two unrelated logos.
import { useId } from "react";

type Tone = "work" | "life" | "brand";

const INK = "#15131f";
/** The half that tells the hubs apart. Brand matches the favicon. */
const ACCENT: Record<Tone, string> = { work: "#22d3ee", life: "#7c4dff", brand: "#7c4dff" };

export default function HubMark({ tone = "brand", className = "h-5 w-5", label }: { tone?: Tone; className?: string; label?: string }) {
  // Each instance needs its own clip id, or two marks on one page collide.
  const clip = `hub-mark-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 96 96" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
      <defs><clipPath id={clip}><rect width="96" height="96" rx="22" /></clipPath></defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="48" height="96" fill={INK} />
        <rect x="48" width="48" height="96" fill={ACCENT[tone]} />
        <rect x="14" y="32" width="42" height="12" rx="6" fill="#ffffff" />
        <rect x="14" y="52" width="68" height="12" rx="6" fill="#ffffff" />
      </g>
    </svg>
  );
}
