// Book covers drawn in code: each book gets a palette and a picture from its genre, picked steadily
// from its id, with the title set in a serif. Nothing to download, sharp at any size.

const PALETTES: Record<string, [string, string, string][]> = {
  Romance: [["#7a1f3d", "#c2476d", "#ffd6e0"], ["#5b2a4e", "#a0527f", "#f6d1e6"], ["#3f2a56", "#8a5ba8", "#ead9ff"], ["#8b3a3a", "#d4766f", "#ffe1d6"]],
  Classics: [["#1f3a5f", "#3f6e9e", "#f1e3c4"], ["#2d4a3e", "#4f8069", "#efe6cf"], ["#4a3426", "#8a6247", "#f3e2c7"], ["#22313f", "#56708a", "#e8dcc2"]],
  Mystery: [["#14181f", "#38424f", "#e6c069"], ["#1d1a26", "#433a5c", "#d7b46a"], ["#10202a", "#2f4d5e", "#e3c27a"]],
  Adventure: [["#0f4c5c", "#2a8a9a", "#ffd166"], ["#3d2b1f", "#8c5a2b", "#ffcf7a"], ["#123a2a", "#2f7a52", "#f7d77c"]],
  Horror: [["#120b12", "#3b1323", "#e04f5f"], ["#0d0f14", "#2b2f3a", "#c8ccd6"], ["#16090d", "#4a1220", "#f2b5a0"]],
  "Sci-Fi": [["#0a0f2c", "#2b2f86", "#7df9ff"], ["#0c1a1f", "#145a63", "#9effc2"], ["#1a0b2e", "#5a2a8a", "#ffb3f0"]],
  Plays: [["#3b0d11", "#8c1c27", "#f4d58d"], ["#1f1033", "#4e2a6e", "#f0c27b"]],
  Humor: [["#f4a259", "#f7d488", "#2b2d42"], ["#5bc0be", "#b8f2e6", "#1c2541"]],
  Nonfiction: [["#22333b", "#5e6f73", "#eae0d5"], ["#283618", "#606c38", "#fefae0"], ["#3d405b", "#81b29a", "#f4f1de"]],
  "Short Stories": [["#2a2438", "#5c5470", "#dbd8e3"]],
  "Kids & Family": [["#ffb703", "#fb8500", "#023047"], ["#8ecae6", "#219ebc", "#023047"], ["#bde0fe", "#a2d2ff", "#3a0ca3"], ["#ffafcc", "#ffc8dd", "#5a189a"], ["#95d5b2", "#52b788", "#081c15"], ["#f7b267", "#f4845f", "#3d1a2c"]],
};
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** Words wrapped to about `max` letters a line. */
function wrap(text: string, max: number): string[] {
  const out: string[] = []; let line = "";
  for (const w of text.split(/\s+/)) {
    if ((line + " " + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + " " + w).trim();
  }
  if (line) out.push(line);
  return out;
}

function Motif({ genre, fg, seed }: { genre: string; fg: string; seed: number }) {
  const r = (n: number) => ((seed >> n) & 255) / 255;
  switch (genre) {
    case "Romance": return <g opacity=".9"><path d="M200 470 C150 420 110 390 110 350 a45 45 0 0 1 90 -10 a45 45 0 0 1 90 10 c0 40 -40 70 -90 120Z" fill={fg} opacity=".85" /><circle cx={80 + r(3) * 60} cy={430} r="5" fill={fg} /><circle cx={310 - r(5) * 40} cy={400} r="4" fill={fg} /></g>;
    case "Mystery": return <g><circle cx="185" cy="390" r="58" fill="none" stroke={fg} strokeWidth="13" /><circle cx="185" cy="390" r="50" fill="#fff" opacity=".1" /><path d="M228 433 L290 495" stroke={fg} strokeWidth="18" strokeLinecap="round" /></g>;
    case "Adventure": return <g><path d={`M0 500 L${110 + r(2) * 40} 380 L190 440 L270 350 L400 500 Z`} fill={fg} opacity=".9" /><circle cx={300 - r(4) * 60} cy="320" r="26" fill={fg} opacity=".95" /></g>;
    case "Horror": return <g><circle cx="270" cy="320" r="46" fill={fg} opacity=".9" /><path d="M60 500 L60 430 L80 410 L100 430 L100 500 M140 500 L140 400 L170 370 L200 400 L200 500" fill="#000" opacity=".55" /><path d="M110 330 q20 -16 40 0 q20 -16 40 0" stroke={fg} strokeWidth="5" fill="none" /></g>;
    case "Sci-Fi": return <g fill="none" stroke={fg} strokeWidth="4"><circle cx="200" cy="400" r="44" fill={fg} opacity=".25" /><ellipse cx="200" cy="400" rx="96" ry="22" transform="rotate(-18 200 400)" /><circle cx={90 + r(1) * 30} cy="320" r="3" fill={fg} /><circle cx={310} cy={340 + r(6) * 40} r="3" fill={fg} /><circle cx="140" cy="480" r="2" fill={fg} /></g>;
    case "Plays": return <g fill={fg}><path d="M120 340 q40 -20 80 0 v40 q-40 60 -80 0Z" opacity=".95" /><path d="M200 360 q40 -20 80 0 v40 q-40 60 -80 0Z" opacity=".6" /></g>;
    case "Humor": return <g><circle cx="200" cy="400" r="62" fill={fg} opacity=".9" /><path d="M170 420 q30 26 60 0" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" /><circle cx="180" cy="388" r="7" fill="#fff" /><circle cx="220" cy="388" r="7" fill="#fff" /></g>;
    case "Nonfiction": return <g stroke={fg} strokeWidth="4" fill="none" opacity=".9"><path d="M140 470 V360 M200 470 V330 M260 470 V380" /><path d="M110 470 H290" /><circle cx="200" cy="315" r="10" fill={fg} /></g>;
    case "Kids & Family": return <g><circle cx={110 + r(2) * 40} cy="380" r="34" fill={fg} opacity=".9" /><circle cx="250" cy="420" r="52" fill="#fff" opacity=".35" /><path d="M0 500 Q120 450 220 480 T400 470 V600 H0Z" fill={fg} opacity=".25" /></g>;
    default: return <g stroke={fg} strokeWidth="3" fill="none" opacity=".8"><rect x="140" y="340" width="120" height="120" rx="6" /><path d="M140 380 H260 M140 420 H260" /></g>;
  }
}

export function BookCover({ id, title, author, genre, className = "" }: { id: string; title: string; author: string; genre: string; className?: string }) {
  const seed = hash(id);
  const set = PALETTES[genre] ?? PALETTES.Classics;
  const [bg, mid, fg] = set[seed % set.length];
  const long = title.length > 34, lines = wrap(title, long ? 16 : 13).slice(0, 5);
  const size = lines.length > 3 ? 34 : long ? 36 : 42;
  const gid = `bc-${seed}`;
  return (
    <svg viewBox="0 0 400 600" className={className} role="img" aria-label={`Cover of ${title}`} preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={bg} /><stop offset="1" stopColor={mid} /></linearGradient></defs>
      <rect width="400" height="600" fill={`url(#${gid})`} />
      <Motif genre={genre} fg={fg} seed={seed} />
      <rect x="20" y="20" width="360" height="560" fill="none" stroke={fg} strokeOpacity=".45" strokeWidth="2" />
      {lines.map((l, i) => <text key={i} x="200" y={80 + i * (size + 8)} fontFamily="Georgia, 'Times New Roman', serif" fontSize={size} fontWeight="700" fill="#fff" textAnchor="middle">{l}</text>)}
      <text x="200" y="560" fontFamily="Georgia, serif" fontSize="22" fill={fg} textAnchor="middle" letterSpacing="1">{author.length > 28 ? author.slice(0, 27) + "…" : author}</text>
    </svg>
  );
}
