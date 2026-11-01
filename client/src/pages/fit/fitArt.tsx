// Arise Fit's cover art: a bold gradient, a fine sport texture and one big white glyph, a color family
// per kind of training (like Apple Fitness's tiles). It replaces YouTube stills on cards: those came with
// their own shouting thumbnails ("HUGE CHEST"), and every card looked like a different app. Videos
// still play from YouTube inside the app; only the covers are ours.
import type { CSSProperties, ReactNode } from "react";
import { Dumbbell, Flame, Flower2, Footprints, Home, Mountain, PersonStanding, ScanFace, Target, Timer, Trophy, Wind, Zap, Move } from "lucide-react";
import type { Program } from "@shared/fit";
import { CATALOG_BY_ID } from "@shared/fit";

/** A loaded barbell. */
export function Barbell({ className, style }: { className?: string; style?: CSSProperties }) {
  return <svg viewBox="0 0 64 32" className={className} style={style} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 16h56" /><rect x="10" y="5" width="6" height="22" rx="2" /><rect x="17" y="9" width="4" height="14" rx="1.5" /><rect x="48" y="5" width="6" height="22" rx="2" /><rect x="43" y="9" width="4" height="14" rx="1.5" />
  </svg>;
}
/** A kettlebell. */
export function Kettlebell({ className, style }: { className?: string; style?: CSSProperties }) {
  return <svg viewBox="0 0 32 32" className={className} style={style} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M11 11a5 5 0 0 1 10 0" /><path d="M10.5 11h11l1.5 2.5" /><path d="M9 13.5 10.5 11" /><path d="M8 20a8 8 0 1 0 16 0 8 8 0 0 0-1.4-4.5H9.4A8 8 0 0 0 8 20Z" />
  </svg>;
}
/** A weight plate. */
export function Plate({ className, style }: { className?: string; style?: CSSProperties }) {
  return <svg viewBox="0 0 32 32" className={className} style={style} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
    <circle cx="16" cy="16" r="13" /><circle cx="16" cy="16" r="8.5" strokeWidth={1.4} /><circle cx="16" cy="16" r="2.6" />
  </svg>;
}

export type ArtKind = "strength" | "power" | "muscle" | "push" | "pull" | "legs" | "full" | "core" | "hiit" | "run" | "c25k" | "trails" | "yoga" | "meditation" | "body" | "form" | "home" | "mobility" | "coach";
type Glyph = (p: { className?: string; style?: CSSProperties; strokeWidth?: number }) => ReactNode;
const ART: Record<ArtKind, { from: string; to: string; glyph: Glyph; texture: "lines" | "dots" | "grid" | "rings" }> = {
  strength: { from: "#ff7a3c", to: "#c2330b", glyph: (p) => <Barbell {...p} />, texture: "lines" },
  power: { from: "#ff5257", to: "#8f1220", glyph: (p) => <Flame {...p} />, texture: "lines" },
  muscle: { from: "#9b6bff", to: "#4b1fa3", glyph: (p) => <Trophy {...p} />, texture: "grid" },
  push: { from: "#ff8a3d", to: "#d1430d", glyph: (p) => <Barbell {...p} />, texture: "lines" },
  pull: { from: "#4c8dff", to: "#1d3fa8", glyph: (p) => <Kettlebell {...p} />, texture: "grid" },
  legs: { from: "#22c79a", to: "#0b6e58", glyph: (p) => <Plate {...p} />, texture: "rings" },
  full: { from: "#ff6b3d", to: "#9c2a10", glyph: (p) => <Dumbbell {...p} />, texture: "dots" },
  core: { from: "#f7b733", to: "#c45c06", glyph: (p) => <Target {...p} />, texture: "rings" },
  hiit: { from: "#ff3d6e", to: "#9e0f3d", glyph: (p) => <Zap {...p} />, texture: "lines" },
  run: { from: "#18c2b2", to: "#0b6a73", glyph: (p) => <Footprints {...p} />, texture: "dots" },
  c25k: { from: "#2fc4e8", to: "#0d5f8f", glyph: (p) => <Timer {...p} />, texture: "rings" },
  trails: { from: "#3fcf6b", to: "#16653a", glyph: (p) => <Mountain {...p} />, texture: "lines" },
  yoga: { from: "#f472b6", to: "#9b1c63", glyph: (p) => <Flower2 {...p} />, texture: "rings" },
  meditation: { from: "#7b7dff", to: "#2d2a8f", glyph: (p) => <Wind {...p} />, texture: "dots" },
  body: { from: "#ff6a2b", to: "#6e1d07", glyph: (p) => <PersonStanding {...p} />, texture: "grid" },
  form: { from: "#21a8f0", to: "#0a4d86", glyph: (p) => <ScanFace {...p} />, texture: "grid" },
  home: { from: "#f59e0b", to: "#a34d05", glyph: (p) => <Home {...p} />, texture: "dots" },
  mobility: { from: "#36d1c4", to: "#127c8a", glyph: (p) => <Move {...p} />, texture: "rings" },
  coach: { from: "#ff6a2b", to: "#2b1206", glyph: (p) => <PersonStanding {...p} />, texture: "lines" },
};
const TEXTURE: Record<"lines" | "dots" | "grid" | "rings", string> = {
  lines: "repeating-linear-gradient(115deg, rgba(255,255,255,.075) 0 2px, transparent 2px 13px)",
  dots: "radial-gradient(rgba(255,255,255,.17) 1.2px, transparent 1.7px) 0 0 / 13px 13px",
  grid: "linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px) 0 0 / 22px 22px",
  rings: "repeating-radial-gradient(circle at 88% 110%, rgba(255,255,255,.085) 0 2px, transparent 2px 17px)",
};

/** The art itself, filling its box. Anything passed as children sits on top (a badge, a label). */
export function Art({ kind, className = "", style, children, glyph = true }: { kind: ArtKind; className?: string; style?: CSSProperties; children?: ReactNode; glyph?: boolean }) {
  const a = ART[kind] ?? ART.strength;
  return <span className={`relative block overflow-hidden ${className}`} style={{ background: `radial-gradient(120% 95% at 0% 0%, rgba(255,255,255,.26), transparent 55%), ${TEXTURE[a.texture]}, linear-gradient(135deg, ${a.from}, ${a.to})`, ...style }}>
    {glyph && <>
      {/* A huge faint copy for depth, and the crisp glyph. */}
      <span aria-hidden className="absolute -bottom-[38%] -right-[14%] h-[150%] w-auto text-white opacity-[.10]" style={{ transform: "rotate(-14deg)", aspectRatio: "1" }}>{a.glyph({ className: "h-full w-full", strokeWidth: 1.4 })}</span>
      <span aria-hidden className="absolute right-[7%] top-1/2 h-[58%] -translate-y-1/2 text-white" style={{ aspectRatio: "1", filter: "drop-shadow(0 6px 14px rgba(0,0,0,.25))" }}>{a.glyph({ className: "h-full w-full", strokeWidth: 1.7 })}</span>
    </>}
    {children}
  </span>;
}

/** A small square of the same art, for list rows. */
export function ArtTile({ kind, size = 48, className = "" }: { kind: ArtKind; size?: number; className?: string }) {
  const a = ART[kind] ?? ART.strength;
  return <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-[12px] text-white ${className}`} style={{ width: size, height: size, background: `radial-gradient(120% 95% at 0% 0%, rgba(255,255,255,.28), transparent 60%), linear-gradient(135deg, ${a.from}, ${a.to})` }} aria-hidden>
    <span style={{ width: size * 0.56, height: size * 0.56 }}>{a.glyph({ className: "h-full w-full", strokeWidth: 1.9 })}</span>
  </span>;
}

const hash = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
/** A program's art: from its goal, varied a little by its name. */
export function programArt(p: Pick<Program, "id" | "goal" | "equipment">): ArtKind {
  const g = `${p.goal} ${p.equipment}`.toLowerCase();
  if (/home|bodyweight|no equipment/.test(g)) return "home";
  if (/fat|condition|cardio|hiit|endurance/.test(g)) return "hiit";
  if (/muscle|size|hypertrophy|physique/.test(g)) return (["muscle", "push", "pull"] as const)[hash(p.id) % 3];
  return (["strength", "power", "full"] as const)[hash(p.id) % 3];
}
/** A workout's art from its name (push, pull, legs...) or its first exercise's muscle. */
export function workoutArt(name: string, firstExId?: string): ArtKind {
  const n = name.toLowerCase();
  if (/push|chest|press/.test(n)) return "push";
  if (/pull|back|row/.test(n)) return "pull";
  if (/leg|lower|squat|glute/.test(n)) return "legs";
  if (/core|abs/.test(n)) return "core";
  if (/full|total/.test(n)) return "full";
  if (/upper/.test(n)) return "push";
  const m = firstExId ? CATALOG_BY_ID.get(firstExId)?.muscle : undefined;
  if (m === "chest" || m === "shoulders" || m === "triceps") return "push";
  if (m === "back" || m === "biceps" || m === "forearms") return "pull";
  if (m === "quads" || m === "hamstrings" || m === "glutes" || m === "calves") return "legs";
  if (m === "abs") return "core";
  if (m === "cardio") return "run";
  return "strength";
}
