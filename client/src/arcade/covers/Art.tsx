import SceneArt, { type Painter } from "./Scene";
import { SCENES_A } from "./scenesA";
import { SCENES_B } from "./scenesB";
import { H, W } from "./paint";

const SCENES: Record<string, Painter> = { ...SCENES_A, ...SCENES_B };

export const hasArt = (gameId: string) => !!SCENES[gameId];

function hashId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** Polished generated key art keeps brand-new games from ever showing blank covers. */
function generatedArt(gameId: string): Painter {
  const hash = hashId(gameId);
  const hue = hash % 360;
  const hue2 = (hue + 55 + (hash % 70)) % 360;
  const mark = gameId.split("_").map((p) => p[0] || "").join("").slice(0, 3).toUpperCase();
  const tilt = (hash % 18) - 9;
  return (k) => (
    <>
      <defs>
        <linearGradient id={k("bg")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 82% 24%)`} />
          <stop offset=".58" stopColor={`hsl(${hue2} 78% 18%)`} />
          <stop offset="1" stopColor="#080b18" />
        </linearGradient>
        <radialGradient id={k("glow")} cx=".5" cy=".42" r=".65">
          <stop offset="0" stopColor={`hsla(${hue2} 100% 70% / .75)`} />
          <stop offset=".55" stopColor={`hsla(${hue} 100% 55% / .18)`} />
          <stop offset="1" stopColor="transparent" />
        </radialGradient>
        <linearGradient id={k("tile")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffdf2" />
          <stop offset="1" stopColor="#dce7ff" />
        </linearGradient>
        <filter id={k("shadow")} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity=".55" />
        </filter>
      </defs>
      <rect width={W} height={H} fill={`url(#${k("bg")})`} />
      <rect width={W} height={H} fill={`url(#${k("glow")})`} />
      <g opacity=".18">
        {Array.from({ length: 9 }, (_, i) => (
          <circle key={i} cx={42 + ((i * 71 + hash) % 410)} cy={32 + ((i * 97 + hash) % 330)} r={10 + (i % 4) * 7} fill="none" stroke="#fff" strokeWidth="2" />
        ))}
      </g>
      <g transform={`translate(240 198) rotate(${tilt})`} filter={`url(#${k("shadow")})`}>
        <rect x="-116" y="-92" width="232" height="184" rx="32" fill="rgba(5,10,28,.76)" stroke="rgba(255,255,255,.34)" strokeWidth="3" />
        <rect x="-87" y="-57" width="58" height="70" rx="11" fill={`url(#${k("tile")})`} />
        <rect x="-22" y="-57" width="58" height="70" rx="11" fill={`url(#${k("tile")})`} />
        <rect x="43" y="-57" width="58" height="70" rx="11" fill={`url(#${k("tile")})`} />
        <text x="-58" y="-11" textAnchor="middle" fontSize="33" fontWeight="900" fill="#152039">{mark[0] || "A"}</text>
        <text x="7" y="-11" textAnchor="middle" fontSize="33" fontWeight="900" fill="#152039">{mark[1] || "R"}</text>
        <text x="72" y="-11" textAnchor="middle" fontSize="33" fontWeight="900" fill="#152039">{mark[2] || "!"}</text>
        <path d="M-78 50 H78" stroke={`hsl(${hue2} 100% 72%)`} strokeWidth="8" strokeLinecap="round" />
        <circle cx="-78" cy="50" r="11" fill="#fff" />
        <circle cx="78" cy="50" r="11" fill="#fff" />
      </g>
      <path d="M0 330 C100 290 170 360 250 322 C330 285 395 324 480 290 V400 H0Z" fill="rgba(0,0,0,.28)" />
    </>
  );
}

/** An arcade game's painted key art (see SceneArt for the two fits). */
export default function GameArt({ gameId, fit = "cover", className }: { gameId: string; fit?: "cover" | "wide"; className?: string }) {
  return <SceneArt paint={SCENES[gameId] || generatedArt(gameId)} fit={fit} className={className} />;
}
