// Cover art, part 2: cards & dice, word games, and math & science.
import type { ReactNode } from "react";
import { Fog, Glow, GlowEllipse, H, type Ids, Motes, Rays, Ridge, Sky, Stars, Vignette, W, hgrad, pipsFor, rgrad, rng, vgrad } from "./paint";

const url = (k: Ids, name: string) => `url(#${k(name)})`;

/** A tapered tentacle along a cubic curve. */
function tentaclePath(p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number], w0: number, w1: number) {
  const pt = (t: number) => {
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ] as const;
  };
  const left: string[] = [], right: string[] = [];
  const centers: [number, number, number, number][] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const [x, y] = pt(t);
    const [x2, y2] = pt(Math.min(1, t + 0.01));
    const [x1, y1] = pt(Math.max(0, t - 0.01));
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const w = w0 + (w1 - w0) * t;
    left.push(`${(x + nx * w).toFixed(1)},${(y + ny * w).toFixed(1)}`);
    right.unshift(`${(x - nx * w).toFixed(1)},${(y - ny * w).toFixed(1)}`);
    centers.push([x, y, nx, ny]);
  }
  return { d: `M${left.join(" L")} L${right.join(" L")} Z`, centers };
}

/** An isometric die with pips. */
function Die({ x, y, s, top, left, right, rot = 0 }: { x: number; y: number; s: number; top: number; left: number; right: number; rot?: number }) {
  const h = s * 0.58;
  const faces = {
    top: `M0,${-h} L${s},0 L0,${h} L${-s},0 Z`,
    left: `M${-s},0 L0,${h} L0,${h + s * 1.15} L${-s},${s * 1.15} Z`,
    right: `M${s},0 L0,${h} L0,${h + s * 1.15} L${s},${s * 1.15} Z`,
  };
  const pip = (face: "top" | "left" | "right", n: number) =>
    pipsFor(n).map(([u, v], i) => {
      let px = 0, py = 0;
      if (face === "top") { px = (u - v) * s; py = -h + (u + v) * h; }
      if (face === "left") { px = -s + u * s; py = u * h + v * s * 1.15; }
      if (face === "right") { px = s - u * s; py = u * h + v * s * 1.15; }
      return <ellipse key={`${face}${i}`} cx={px} cy={py} rx={s * 0.11} ry={s * 0.075} fill={n === 1 && face === "top" ? "#d61f45" : "#1a1726"} />;
    });
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d={faces.left} fill="#d9d5e3" />
      <path d={faces.right} fill="#a9a3bb" />
      <path d={faces.top} fill="#ffffff" />
      {pip("top", top)}{pip("left", left)}{pip("right", right)}
    </g>
  );
}

const SUITS = ["♠", "♥", "♦", "♣"];

export const SCENES_B: Record<string, (k: Ids) => ReactNode> = {
  // ─── WILDCARD ─────────────────────────────────────────────────────────────
  eights: (k) => {
    const fan = [-44, -22, 22, 44].map((a, i) => {
      const suit = SUITS[i];
      const red = suit === "♥" || suit === "♦";
      const rank = ["K", "7", "3", "Q"][i];
      return (
        <g key={a} transform={`translate(240 360) rotate(${a}) translate(0 -168)`}>
          <rect x={-40} y={-58} width={80} height={116} rx={8} fill="#fbf8f0" stroke="#d6cdb4" strokeWidth={1.5} />
          <text x={-29} y={-36} fontFamily="Cinzel, serif" fontWeight={900} fontSize={17} fill={red ? "#d61f45" : "#1a1726"}>{rank}</text>
          <text x={-29} y={-20} fontSize={14} fill={red ? "#d61f45" : "#1a1726"}>{suit}</text>
          <text x={0} y={16} textAnchor="middle" fontSize={42} fill={red ? "#d61f45" : "#1a1726"}>{suit}</text>
        </g>
      );
    });
    const r = rng(171);
    const embers = Array.from({ length: 14 }, (_, i) => {
      const suit = SUITS[i % 4];
      const red = suit === "♥" || suit === "♦";
      return <text key={i} x={60 + r() * 360} y={30 + r() * 250} fontSize={10 + r() * 16} fill={red ? "#ff5a6e" : "#ffd27a"} opacity={0.35 + r() * 0.5} textAnchor="middle">{suit}</text>;
    });
    return (
      <>
        <Sky k={k} stops={[[0, "#020d07"], [0.55, "#0b3a22"], [1, "#020a05"]]} />
        <defs>
          {vgrad(k("cone"), [[0, "#fff6d8", 0.3], [1, "#fff6d8", 0]])}
          {vgrad(k("gold"), [[0, "#fff4c4"], [0.5, "#ffcf55"], [1, "#a8650c"]])}
        </defs>
        <path d="M190,-10 L290,-10 L400,330 L80,330 Z" fill={url(k, "cone")} />
        <GlowEllipse k={k} name="table" cx={240} cy={330} rx={240} ry={50} color="#2fd17a" opacity={0.25} />
        {embers}
        {fan}
        <Glow k={k} name="eightGlow" cx={240} cy={176} r={130} color="#ffcf55" opacity={0.5} />
        <g transform="translate(240 178)">
          <rect x={-56} y={-80} width={112} height={160} rx={11} fill="#fffdf6" stroke={url(k, "gold")} strokeWidth={5} />
          <text x={-40} y={-50} fontFamily="Cinzel, serif" fontWeight={900} fontSize={24} fill="#d61f45">8</text>
          <text x={-40} y={-30} fontSize={18} fill="#d61f45">♥</text>
          <text x={0} y={34} textAnchor="middle" fontFamily="Cinzel, serif" fontWeight={900} fontSize={96} fill="#d61f45">8</text>
          <g transform="rotate(180)"><text x={-40} y={-50} fontFamily="Cinzel, serif" fontWeight={900} fontSize={24} fill="#d61f45">8</text></g>
        </g>
        <Motes seed={172} n={40} y0={20} y1={320} color="#ffe6a8" size={1.1} opacity={0.6} />
        <Vignette k={k} strength={0.7} />
      </>
    );
  },

  // ─── KRAKEN ───────────────────────────────────────────────────────────────
  gofish: (k) => {
    const arms: [[number, number], [number, number], [number, number], [number, number], number, number][] = [
      [[150, 262], [120, 200], [70, 150], [110, 90], 22, 5],
      [[326, 262], [360, 200], [410, 140], [362, 70], 24, 5],
      [[196, 268], [186, 210], [150, 170], [176, 132], 15, 4],
      [[290, 270], [300, 220], [334, 186], [310, 150], 14, 4],
    ];
    const tentacles = arms.map(([a, b, c, d, w0, w1], i) => {
      const { d: path, centers } = tentaclePath(a, b, c, d, w0, w1);
      const suckers = centers.filter((_, j) => j > 3 && j < 22 && j % 2 === 0).map(([x, y, nx, ny], j) => {
        const w = w0 + (w1 - w0) * ((j * 2 + 4) / 24);
        return <ellipse key={j} cx={x - nx * w * 0.55} cy={y - ny * w * 0.55} rx={w * 0.28} ry={w * 0.22} fill="#f2b6d8" opacity={0.75} />;
      });
      return (
        <g key={i}>
          <path d={path} fill={url(k, "skin")} />
          <path d={path} fill={url(k, "skinRim")} opacity={0.6} />
          {suckers}
        </g>
      );
    });
    const waves: ReactNode[] = [];
    for (let i = 0; i < 7; i++) {
      const y = 262 + i * 20;
      let d = `M-10,${y}`;
      for (let x = -10; x <= W + 20; x += 40) d += ` Q${x + 20},${y - 9} ${x + 40},${y}`;
      waves.push(<path key={i} d={`${d} L${W + 20},${H + 10} L-10,${H + 10} Z`} fill={i % 2 ? "#06233a" : "#082c48"} />);
      waves.push(<path key={`f${i}`} d={d} fill="none" stroke="#bfe3ff" strokeOpacity={0.12 + i * 0.03} strokeWidth={1.2} />);
    }
    return (
      <>
        <Sky k={k} stops={[[0, "#01060f"], [0.5, "#07213a"], [0.66, "#0e3a5a"], [1, "#020a14"]]} />
        <Stars seed={181} n={70} y1={200} />
        <Glow k={k} name="moonGlow" cx={330} cy={78} r={150} color="#cfe8ff" opacity={0.45} />
        <circle cx={330} cy={78} r={38} fill="#eaf5ff" />
        <circle cx={318} cy={70} r={7} fill="#c9dcef" opacity={0.6} /><circle cx={342} cy={90} r={5} fill="#c9dcef" opacity={0.5} />
        <defs>
          {hgrad(k("skin"), [[0, "#3a0f45"], [0.5, "#7a2a7e"], [1, "#2a0a33"]])}
          {hgrad(k("skinRim"), [[0, "#bfe3ff", 0], [0.8, "#bfe3ff", 0], [1, "#dff1ff", 0.7]])}
        </defs>
        <GlowEllipse k={k} name="moonPath" cx={330} cy={300} rx={60} ry={110} color="#cfe8ff" opacity={0.25} />
        {tentacles}
        <g>{waves}</g>
        <g transform="translate(240 250)">
          <path d="M-34,0 L34,0 L24,14 L-24,14 Z" fill="#1a0f08" />
          <rect x={-2} y={-44} width={3} height={44} fill="#1a0f08" />
          <path d="M1,-42 L26,-8 L1,-8 Z" fill="#2a1a10" />
        </g>
        <Glow k={k} name="lantern" cx={222} cy={244} r={34} color="#ffcf6b" opacity={0.85} />
        <circle cx={222} cy={244} r={3.5} fill="#fff2c4" />
        <Motes seed={182} n={30} y0={100} y1={300} color="#cfe8ff" size={1} opacity={0.5} />
        <Vignette k={k} strength={0.7} />
      </>
    );
  },

  // ─── BOAR RUSH ────────────────────────────────────────────────────────────
  pig: (k) => {
    const boar = "M98,236 L92,222 Q96,212 130,206 L156,176 L166,148 L180,172 L198,162 L206,148 L216,164 L228,148 L238,164 L252,150 L262,166 L276,156 L286,172 Q320,170 346,190 Q356,196 366,190 L370,200 Q362,208 354,206 L352,236 L360,294 L344,298 L332,252 L292,256 L218,258 L212,298 L196,300 L194,252 Q170,252 156,248 L130,248 L110,246 Z";
    return (
      <>
        <Sky k={k} stops={[[0, "#140703"], [0.45, "#62250b"], [0.66, "#dc7429"], [0.74, "#ffc27a"], [0.76, "#3a1608"], [1, "#160803"]]} />
        <Glow k={k} name="sun" cx={240} cy={292} r={220} color="#ffb05a" opacity={0.6} />
        <Rays k={k} name="rays" cx={240} cy={290} n={12} spread={160} len={320} color="#ffd9a0" opacity={0.18} seed={191} angle={-90} />
        <Ridge seed={192} y={300} amp={24} color="#2a0f05" />
        <GlowEllipse k={k} name="dust" cx={300} cy={296} rx={150} ry={40} color="#e8a060" opacity={0.55} />
        <defs>
          {vgrad(k("hide"), [[0, "#2a160c"], [1, "#0c0603"]])}
          {vgrad(k("rim"), [[0, "#ffc27a", 0.95], [0.25, "#ffc27a", 0]])}
        </defs>
        <ellipse cx={240} cy={302} rx={130} ry={10} fill="#000" opacity={0.5} />
        <path d={boar} fill={url(k, "hide")} />
        <path d={boar} fill={url(k, "rim")} opacity={0.75} />
        <path d="M112,240 Q100,236 96,214 Q108,226 118,232 Z" fill="#fff4dc" />
        <circle cx={140} cy={214} r={3.2} fill="#ffcf6b" />
        <Glow k={k} name="eye" cx={140} cy={214} r={10} color="#ffcf6b" opacity={0.8} />
        <Die x={140} y={86} s={30} top={6} left={3} right={2} rot={-14} />
        <Die x={346} y={64} s={26} top={1} left={5} right={4} rot={12} />
        <Motes seed={193} n={50} y0={150} y1={320} color="#ffd6a0" size={1.3} opacity={0.6} />
        <Vignette k={k} strength={0.7} />
      </>
    );
  },

  // ─── RUNESEEKER ───────────────────────────────────────────────────────────
  word_tiles: (k) => {
    const letters = ["W", "O", "R", "D", "S", "E", "K"];
    const tiles = letters.map((ch, i) => {
      const a = Math.PI * (1.08 + (i / (letters.length - 1)) * 0.84);
      const x = 240 + Math.cos(a) * 150, y = 196 + Math.sin(a) * 88;
      const rot = (i - 3) * 7;
      return (
        <g key={ch + i} transform={`translate(${x} ${y}) rotate(${rot})`}>
          <rect x={-22} y={-25} width={44} height={50} rx={7} fill="#1c2430" />
          <rect x={-22} y={-25} width={44} height={46} rx={7} fill={url(k, "stone")} />
          <text x={0} y={10} textAnchor="middle" fontFamily="Cinzel, serif" fontWeight={900} fontSize={26} fill="#9fd8ee" opacity={0.7}>{ch}</text>
        </g>
      );
    });
    return (
      <>
        <Sky k={k} stops={[[0, "#03060a"], [0.6, "#0f1b28"], [1, "#030508"]]} />
        <Glow k={k} name="depth" cx={240} cy={200} r={230} color="#3fb6e0" opacity={0.28} />
        <path d="M-10,-10 L490,-10 L490,60 Q420,40 380,80 Q330,30 270,56 Q220,20 170,60 Q120,30 80,70 Q40,46 -10,70 Z" fill="#020407" />
        <path d="M-10,410 L-10,150 Q20,200 40,260 Q60,320 110,350 L110,410 Z" fill="#020407" />
        <path d="M490,410 L490,140 Q456,200 440,262 Q420,320 370,352 L370,410 Z" fill="#020407" />
        <defs>
          {vgrad(k("stone"), [[0, "#5d6878"], [1, "#2c3442"]])}
          {vgrad(k("lit"), [[0, "#e8fbff"], [1, "#8fdcf2"]])}
          {vgrad(k("beam"), [[0, "#bff0ff", 0], [1, "#bff0ff", 0.45]])}
        </defs>
        <path d="M222,-10 L258,-10 L276,196 L204,196 Z" fill={url(k, "beam")} />
        {tiles}
        <Glow k={k} name="true" cx={240} cy={196} r={100} color="#7fe3ff" opacity={0.7} />
        <g transform="translate(240 196)">
          <rect x={-36} y={-40} width={72} height={80} rx={10} fill="#1c3a4a" />
          <rect x={-36} y={-40} width={72} height={74} rx={10} fill={url(k, "lit")} />
          <text x={0} y={18} textAnchor="middle" fontFamily="Cinzel, serif" fontWeight={900} fontSize={48} fill="#0b4a66">A</text>
        </g>
        <Motes seed={201} n={60} color="#9fe8ff" size={1.2} opacity={0.6} />
        <Vignette k={k} strength={0.7} />
      </>
    );
  },

  // ─── LIFELINE ─────────────────────────────────────────────────────────────
  word_rescue: (k) => {
    const sector = (a0: number, a1: number, r0: number, r1: number) => {
      const p = (a: number, r: number) => `${(240 + Math.cos(a) * r).toFixed(1)},${(206 + Math.sin(a) * r).toFixed(1)}`;
      return `M${p(a0, r1)} A${r1},${r1} 0 0 1 ${p(a1, r1)} L${p(a1, r0)} A${r0},${r0} 0 0 0 ${p(a0, r0)} Z`;
    };
    const segs = Array.from({ length: 8 }, (_, i) => {
      const a0 = (i / 8) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / 8) * Math.PI * 2 - Math.PI / 2;
      return <path key={i} d={sector(a0, a1, 36, 70)} fill={i % 2 ? url(k, "white") : url(k, "red")} />;
    });
    const rain: ReactNode[] = [];
    const r = rng(211);
    for (let i = 0; i < 70; i++) {
      const x = r() * W, y = r() * H, l = 10 + r() * 16;
      rain.push(<line key={i} x1={x} y1={y} x2={x - l * 0.35} y2={y + l} stroke="#cfe6ff" strokeOpacity={0.12 + r() * 0.2} strokeWidth={1} />);
    }
    const waves: ReactNode[] = [];
    for (let i = 0; i < 7; i++) {
      const y = 250 + i * 22;
      let d = `M-10,${y}`;
      for (let x = -10; x <= W + 20; x += 36) d += ` Q${x + 18},${y - 10} ${x + 36},${y}`;
      waves.push(<path key={i} d={`${d} L${W + 20},${H + 10} L-10,${H + 10} Z`} fill={i % 2 ? "#082238" : "#0b2c48"} />);
      waves.push(<path key={`f${i}`} d={d} fill="none" stroke="#cfe6ff" strokeOpacity={0.14 + i * 0.03} strokeWidth={1.2} />);
    }
    return (
      <>
        <Sky k={k} stops={[[0, "#02060c"], [0.55, "#0b2236"], [0.68, "#153a55"], [1, "#030a12"]]} />
        <defs>
          {vgrad(k("beam"), [[0, "#fff1c4", 0.5], [1, "#fff1c4", 0]], 1, 0, 0, 0)}
          {rgrad(k("red"), [[0, "#ff7a6b"], [1, "#c0141f"]], 0.4, 0.3, 0.9)}
          {rgrad(k("white"), [[0, "#ffffff"], [1, "#cdd6e2"]], 0.4, 0.3, 0.9)}
        </defs>
        <path d="M418,118 L-20,40 L-20,250 Z" fill={url(k, "beam")} opacity={0.65} />
        <path d="M408,124 L416,212 L432,212 L428,124 Z" fill="#dfe6ee" />
        <path d="M406,124 L430,124 L426,108 L410,108 Z" fill="#1a2533" />
        <Glow k={k} name="lamp" cx={418} cy={116} r={46} color="#fff1c4" opacity={0.85} />
        <Ridge seed={212} y={232} amp={14} color="#06121d" />
        <g>{waves.slice(0, 4)}</g>
        <ellipse cx={240} cy={268} rx={88} ry={12} fill="#000" opacity={0.4} />
        <Glow k={k} name="ringGlow" cx={240} cy={206} r={120} color="#ffe2b0" opacity={0.35} />
        {segs}
        <circle cx={240} cy={206} r={53} fill="none" stroke="#e8d6a8" strokeWidth={3} strokeDasharray="10 8" />
        <g>{waves.slice(4)}</g>
        <g>{rain}</g>
        <Vignette k={k} strength={0.7} />
      </>
    );
  },

  // ─── ECHOES ───────────────────────────────────────────────────────────────
  synonym_sprint: (k) => {
    const horizon = 236;
    const rings = [36, 62, 92, 126, 164].map((r, i) => <circle key={i} cx={240} cy={150} r={r} fill="none" stroke="#ffe3f0" strokeWidth={2 - i * 0.25} strokeOpacity={0.7 - i * 0.12} />);
    const ripples = [30, 58, 90, 126, 166].map((r, i) => <ellipse key={i} cx={240} cy={322} rx={r * 1.2} ry={r * 0.22} fill="none" stroke="#ffe3f0" strokeWidth={1.6} strokeOpacity={0.55 - i * 0.09} />);
    return (
      <>
        <Sky k={k} stops={[[0, "#06081c"], [0.36, "#272466"], [0.52, "#b866a6"], [0.59, "#ffb0a0"], [0.6, "#3a2a5a"], [1, "#070818"]]} />
        <Stars seed={221} n={50} y1={150} color="#fff0f8" />
        <defs>{vgrad(k("water"), [[0, "#ffb0a0", 0.55], [0.3, "#b866a6", 0.35], [1, "#06081c", 0]])}</defs>
        <Ridge seed={222} y={horizon} amp={40} step={22} color="#2a1f52" peaks={[[120, 40], [360, 50]]} />
        <g transform={`translate(0 ${horizon * 2}) scale(1 -1)`} opacity={0.35}>
          <Ridge seed={222} y={horizon} amp={40} step={22} color="#2a1f52" peaks={[[120, 40], [360, 50]]} />
        </g>
        <rect x={0} y={horizon} width={W} height={H - horizon} fill={url(k, "water")} />
        <Glow k={k} name="orb" cx={240} cy={150} r={130} color="#ffd6ea" opacity={0.6} />
        {rings}
        <circle cx={240} cy={150} r={16} fill="#fff6fb" />
        <GlowEllipse k={k} name="orbR" cx={240} cy={322} rx={110} ry={26} color="#ffd6ea" opacity={0.5} />
        {ripples}
        <Motes seed={223} n={30} y0={40} y1={220} color="#ffe3f0" size={1} opacity={0.5} />
        <Vignette k={k} strength={0.6} />
      </>
    );
  },

  // ─── WORDSMITH ────────────────────────────────────────────────────────────
  sentence_fix: (k) => {
    const sparks: ReactNode[] = [];
    const r = rng(231);
    for (let i = 0; i < 44; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.6;
      const d0 = 30 + r() * 30, d1 = d0 + 20 + r() * 90;
      sparks.push(<line key={i} x1={240 + Math.cos(a) * d0} y1={150 + Math.sin(a) * d0} x2={240 + Math.cos(a) * d1} y2={150 + Math.sin(a) * d1} stroke={r() > 0.4 ? "#ffd36b" : "#ff8a2a"} strokeWidth={0.8 + r() * 1.8} strokeLinecap="round" opacity={0.5 + r() * 0.5} />);
    }
    return (
      <>
        <Sky k={k} stops={[[0, "#0b0302"], [0.55, "#331006"], [1, "#0a0302"]]} />
        <Glow k={k} name="forge" cx={100} cy={360} r={230} color="#ff6a1a" opacity={0.45} />
        <Glow k={k} name="heat" cx={240} cy={160} r={170} color="#ff9a3d" opacity={0.45} />
        <defs>
          {vgrad(k("anvil"), [[0, "#4a4c56"], [0.4, "#25262e"], [1, "#0c0c10"]])}
          {vgrad(k("hot"), [[0, "#fffbe6"], [0.45, "#ffd36b"], [1, "#ff6a1a"]])}
        </defs>
        <g transform="translate(240 236)">
          <path d="M-120,-30 L96,-30 Q130,-30 150,-12 Q120,-6 100,-4 L56,-4 Q46,10 46,28 L70,52 L-70,52 L-46,28 Q-46,10 -56,-4 L-100,-4 Q-126,-8 -120,-30 Z" fill={url(k, "anvil")} />
          <path d="M-120,-30 L96,-30 Q130,-30 150,-12" fill="none" stroke="#ffb36b" strokeWidth={2.4} strokeOpacity={0.8} />
          <rect x={-86} y={52} width={172} height={18} rx={3} fill="#0a0a0d" />
        </g>
        <Glow k={k} name="letterGlow" cx={240} cy={150} r={90} color="#ffb84d" opacity={0.75} />
        <text x={240} y={200} textAnchor="middle" fontFamily="Cinzel, serif" fontWeight={900} fontSize={124} fill={url(k, "hot")}>A</text>
        <g>{sparks}</g>
        <g transform="translate(352 74) rotate(32)">
          <rect x={-5} y={-6} width={10} height={110} rx={4} fill="#2a1a10" />
          <rect x={-34} y={-30} width={68} height={30} rx={5} fill="#1c1c22" stroke="#ffb36b" strokeOpacity={0.6} strokeWidth={1.5} />
        </g>
        <Motes seed={232} n={50} color="#ffb36b" size={1.2} opacity={0.6} />
        <Vignette k={k} strength={0.7} />
      </>
    );
  },

  // ─── SPELLBOUND ───────────────────────────────────────────────────────────
  spelling: (k) => {
    const letters = "SPELLBOUNDQWZ".split("");
    const swirl = letters.map((ch, i) => {
      const t = i / letters.length;
      const a = t * Math.PI * 3.2 + 0.6;
      const radius = 30 + t * 120;
      const x = 240 + Math.cos(a) * radius, y = 250 - t * 210 + Math.sin(a) * 18;
      const size = 34 - t * 18;
      return <text key={i} x={x} y={y} textAnchor="middle" fontFamily="Cinzel, serif" fontWeight={900} fontSize={size} fill={i % 3 ? "#ffe7a3" : "#d4b8ff"} opacity={0.95 - t * 0.55}>{ch}</text>;
    });
    return (
      <>
        <Sky k={k} stops={[[0, "#04020d"], [0.55, "#1a0f4a"], [1, "#05030f"]]} />
        <Stars seed={241} n={70} y1={260} color="#efe4ff" />
        <Glow k={k} name="aura" cx={240} cy={220} r={230} color="#9b6bff" opacity={0.35} />
        <defs>
          {vgrad(k("beam"), [[0, "#fff4d0", 0], [1, "#fff4d0", 0.55]])}
          {vgrad(k("pageL"), [[0, "#fffaf0"], [1, "#e0cfff"]])}
          {vgrad(k("pageR"), [[0, "#fffaf0"], [1, "#d6c2ff"]])}
        </defs>
        <path d="M200,0 L280,0 L330,264 L150,264 Z" fill={url(k, "beam")} opacity={0.6} />
        {swirl}
        <Glow k={k} name="book" cx={240} cy={262} r={130} color="#fff1c4" opacity={0.55} />
        <path d="M110,292 Q170,266 238,284 L238,302 Q170,286 112,310 Z" fill="#2a1460" />
        <path d="M370,292 Q310,266 242,284 L242,302 Q310,286 368,310 Z" fill="#2a1460" />
        <path d="M118,284 Q172,256 238,276 L238,294 Q172,276 120,300 Z" fill={url(k, "pageL")} />
        <path d="M362,284 Q308,256 242,276 L242,294 Q308,276 360,300 Z" fill={url(k, "pageR")} />
        {[0, 1, 2, 3].map((i) => <path key={i} d={`M${132 + i * 4},${282 - i * 2.5} Q${180},${262 - i * 2} ${230},${276 - i * 1}`} fill="none" stroke="#b9a3e6" strokeOpacity={0.4} strokeWidth={1} />)}
        <Motes seed={242} n={70} y0={20} y1={300} color="#ffe7a3" size={1.2} opacity={0.65} />
        <Vignette k={k} strength={0.65} />
      </>
    );
  },

  // ─── NUMBER STORM ─────────────────────────────────────────────────────────
  math_duel: (k) => {
    const r = rng(251);
    const big: [string, number, number, number, number][] = [
      ["7", 168, 196, 96, -8], ["+", 312, 150, 70, 6], ["3", 318, 248, 84, 10], ["÷", 140, 104, 54, -4], ["=", 238, 286, 58, 0],
    ];
    const small = ["9", "×", "4", "−", "8", "2", "6", "5"].map((g, i) => (
      <text key={i} x={70 + r() * 340} y={70 + r() * 230} textAnchor="middle" fontFamily="Teko, sans-serif" fontWeight={600} fontSize={18 + r() * 16} fill="#bfe6ff" opacity={0.25 + r() * 0.3}>{g}</text>
    ));
    const rain: ReactNode[] = [];
    for (let i = 0; i < 70; i++) {
      const x = r() * W, y = 40 + r() * H, l = 10 + r() * 16;
      rain.push(<line key={i} x1={x} y1={y} x2={x - 4} y2={y + l} stroke="#bfe0ff" strokeOpacity={0.1 + r() * 0.16} strokeWidth={1} />);
    }
    const bolt = "236,30 214,104 246,110 206,196 238,202 196,300";
    return (
      <>
        <Sky k={k} stops={[[0, "#02040b"], [0.5, "#0e1f4c"], [1, "#03081a"]]} />
        <Glow k={k} name="flash" cx={230} cy={120} r={240} color="#8fc8ff" opacity={0.5} />
        <defs>
          {vgrad(k("cloud"), [[0, "#3a5a9a"], [0.35, "#16295a"], [1, "#0a1430"]])}
          {vgrad(k("digit"), [[0, "#ffffff"], [0.6, "#bfe6ff"], [1, "#5fb0ff"]])}
        </defs>
        {[[60, 30, 150, 50], [250, 18, 210, 56], [430, 40, 160, 50], [150, 70, 150, 34], [350, 74, 170, 38]].map(([x, y, rx, ry], i) => (
          <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill={url(k, "cloud")} />
        ))}
        <polyline points={bolt} fill="none" stroke="#7fc8ff" strokeWidth={18} strokeOpacity={0.22} strokeLinejoin="round" />
        <polyline points={bolt} fill="none" stroke="#dff2ff" strokeWidth={5} strokeLinejoin="round" />
        <polyline points={bolt} fill="none" stroke="#ffffff" strokeWidth={2} strokeLinejoin="round" />
        <polyline points="214,104 170,140 150,190" fill="none" stroke="#dff2ff" strokeWidth={2} strokeLinejoin="round" opacity={0.7} />
        {small}
        {big.map(([g, x, y, sz, rot], i) => (
          <g key={i} transform={`rotate(${rot} ${x} ${y})`}>
            <Glow k={k} name={`g${i}`} cx={x} cy={y - sz * 0.3} r={sz * 0.8} color="#6fc0ff" opacity={0.45} />
            <text x={x} y={y} textAnchor="middle" fontFamily="Teko, sans-serif" fontWeight={700} fontSize={sz} fill={url(k, "digit")}>{g}</text>
          </g>
        ))}
        <g>{rain}</g>
        <Vignette k={k} strength={0.7} />
      </>
    );
  },

  // ─── FRACTAL ──────────────────────────────────────────────────────────────
  pattern_power: (k) => {
    const tris: string[] = [];
    const sier = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, d: number) => {
      if (d === 0) { tris.push(`M${ax.toFixed(1)},${ay.toFixed(1)} L${bx.toFixed(1)},${by.toFixed(1)} L${cx.toFixed(1)},${cy.toFixed(1)} Z`); return; }
      const abx = (ax + bx) / 2, aby = (ay + by) / 2, bcx = (bx + cx) / 2, bcy = (by + cy) / 2, cax = (cx + ax) / 2, cay = (cy + ay) / 2;
      sier(ax, ay, abx, aby, cax, cay, d - 1);
      sier(abx, aby, bx, by, bcx, bcy, d - 1);
      sier(cax, cay, bcx, bcy, cx, cy, d - 1);
    };
    const s = 250, h = (s * Math.sqrt(3)) / 2;
    const top: [number, number] = [240, 56], left: [number, number] = [240 - s / 2, 56 + h], right: [number, number] = [240 + s / 2, 56 + h];
    sier(top[0], top[1], left[0], left[1], right[0], right[1], 5);
    return (
      <>
        <Sky k={k} stops={[[0, "#03020a"], [0.6, "#12092a"], [1, "#04030c"]]} />
        <Stars seed={261} n={80} y1={400} color="#e8e4ff" size={0.9} />
        <Glow k={k} name="halo" cx={240} cy={190} r={220} color="#7a5cff" opacity={0.35} />
        <defs>
          <linearGradient id={k("iri")} gradientUnits="userSpaceOnUse" x1={115} y1={60} x2={365} y2={276}>
            <stop offset={0} stopColor="#5ff3ff" />
            <stop offset={0.5} stopColor="#ff5fd8" />
            <stop offset={1} stopColor="#ffd36b" />
          </linearGradient>
        </defs>
        {[0, 1, 2].map((i) => <ellipse key={i} cx={240} cy={190} rx={180 + i * 26} ry={48 + i * 8} fill="none" stroke="#a99bff" strokeOpacity={0.18 - i * 0.04} strokeWidth={1.2} transform={`rotate(${-12 + i * 12} 240 190)`} />)}
        <path d={tris.join(" ")} fill={url(k, "iri")} />
        <path d={`M${top[0]},${top[1]} L${left[0]},${left[1]} L${right[0]},${right[1]} Z`} fill="none" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.5} />
        <Glow k={k} name="apex" cx={240} cy={56} r={40} color="#c9fbff" opacity={0.7} />
        <Motes seed={262} n={40} color="#d6ccff" size={1} opacity={0.5} />
        <Vignette k={k} strength={0.65} />
      </>
    );
  },

  // ─── QUANTUM ──────────────────────────────────────────────────────────────
  fact_dash: (k) => {
    const nucleus = [[0, 0, 1], [-14, -6, 0], [12, -8, 1], [-6, 12, 1], [10, 10, 0], [-16, 8, 1], [4, -16, 0], [16, 2, 1], [-4, -2, 0]] as const;
    return (
      <>
        <Sky k={k} stops={[[0, "#01030a"], [0.6, "#061a33"], [1, "#020812"]]} />
        <Stars seed={271} n={60} y1={400} color="#cfefff" size={0.9} />
        <Glow k={k} name="lab" cx={240} cy={176} r={230} color="#3aa8ff" opacity={0.3} />
        <defs>
          {hgrad(k("orbit"), [[0, "#5ff3ff", 0.15], [0.5, "#bff8ff", 0.95], [1, "#5ff3ff", 0.15]])}
          {rgrad(k("p"), [[0, "#ffd0f0"], [0.5, "#ff5fc8"], [1, "#8a1a6a"]], 0.36, 0.3, 0.8)}
          {rgrad(k("n"), [[0, "#fff4c4"], [0.5, "#ffc23d"], [1, "#8a5a0a"]], 0.36, 0.3, 0.8)}
        </defs>
        {[0, 60, 120].map((a, i) => (
          <g key={a} transform={`rotate(${a} 240 176)`}>
            <ellipse cx={240} cy={176} rx={140} ry={44} fill="none" stroke={url(k, "orbit")} strokeWidth={3} />
            <ellipse cx={240} cy={176} rx={140} ry={44} fill="none" stroke="#5ff3ff" strokeWidth={10} strokeOpacity={0.08} />
            <Glow k={k} name={`e${i}`} cx={240 + 140 * Math.cos(1.1 + i * 2)} cy={176 + 44 * Math.sin(1.1 + i * 2)} r={18} color="#e6fdff" opacity={1} core={0.15} />
          </g>
        ))}
        <Glow k={k} name="core" cx={240} cy={176} r={70} color="#ff8ad8" opacity={0.6} />
        {nucleus.map(([x, y, p], i) => <circle key={i} cx={240 + x} cy={176 + y} r={11} fill={url(k, p ? "p" : "n")} />)}
        <Motes seed={272} n={50} color="#bff8ff" size={1.1} opacity={0.55} />
        <Vignette k={k} strength={0.65} />
      </>
    );
  },

  // ─── ATLAS ────────────────────────────────────────────────────────────────
  geography: (k) => {
    const cx = 240, cy = 182, R = 112;
    const meridians = [-0.85, -0.55, -0.2, 0.2, 0.55, 0.85].map((f, i) => <ellipse key={`m${i}`} cx={cx} cy={cy} rx={Math.abs(f) * R} ry={R} fill="none" stroke="#dff1ff" strokeOpacity={0.16} strokeWidth={1} />);
    const parallels = [-0.66, -0.33, 0, 0.33, 0.66].map((f, i) => {
      const y = cy + f * R, w = Math.sqrt(1 - f * f) * R;
      return <ellipse key={`p${i}`} cx={cx} cy={y} rx={w} ry={w * 0.14} fill="none" stroke="#dff1ff" strokeOpacity={0.16} strokeWidth={1} />;
    });
    return (
      <>
        <Sky k={k} stops={[[0, "#01040c"], [0.6, "#06162a"], [1, "#020610"]]} />
        <Stars seed={281} n={120} y1={400} color="#e6f2ff" />
        <Glow k={k} name="atmo" cx={cx} cy={cy} r={170} color="#4fc3ff" opacity={0.45} />
        <defs>
          {rgrad(k("ocean"), [[0, "#4aa8ec"], [0.6, "#155a9a"], [1, "#062a4e"]], 0.35, 0.3, 0.85)}
          {rgrad(k("shade"), [[0.55, "#000", 0], [1, "#000", 0.55]], 0.32, 0.3, 0.8)}
          {vgrad(k("land"), [[0, "#7fdc8f"], [1, "#2f9a63"]])}
          <clipPath id={k("globe")}><circle cx={cx} cy={cy} r={R} /></clipPath>
        </defs>
        <circle cx={cx} cy={cy} r={R} fill={url(k, "ocean")} />
        <g clipPath={url(k, "globe")}>
          <path d="M150,96 Q176,78 204,92 Q214,112 196,126 Q206,146 196,170 Q186,196 200,222 Q206,250 188,268 Q170,252 172,226 Q160,198 166,170 Q150,152 152,130 Q140,112 150,96 Z" fill={url(k, "land")} />
          <path d="M248,94 Q272,82 300,92 Q326,104 316,124 Q300,132 290,128 Q300,150 314,166 Q330,190 318,214 Q300,246 284,250 Q270,226 276,198 Q262,184 266,162 Q248,150 252,126 Q238,112 248,94 Z" fill={url(k, "land")} />
          <path d="M318,232 Q334,224 346,236 Q342,252 326,252 Q314,246 318,232 Z" fill={url(k, "land")} />
          {meridians}{parallels}
        </g>
        <circle cx={cx} cy={cy} r={R} fill={url(k, "shade")} />
        <circle cx={cx} cy={cy} r={R + 1} fill="none" stroke="#9fe0ff" strokeWidth={2} strokeOpacity={0.6} />
        <path d="M186,154 Q238,70 300,150" fill="none" stroke="#ffd36b" strokeWidth={2.6} strokeDasharray="6 6" strokeLinecap="round" />
        <circle cx={186} cy={154} r={4.5} fill="#ffd36b" /><circle cx={300} cy={150} r={4.5} fill="#ffd36b" />
        <Glow k={k} name="pin" cx={300} cy={150} r={20} color="#ffd36b" opacity={0.7} />
        <g transform="translate(132 72)">
          <path d="M0,-22 L5,-5 L22,0 L5,5 L0,22 L-5,5 L-22,0 L-5,-5 Z" fill="#ffd36b" opacity={0.9} />
          <circle cx={0} cy={0} r={3} fill="#06162a" />
        </g>
        <Motes seed={282} n={30} color="#bfe8ff" size={1} opacity={0.5} />
        <Vignette k={k} strength={0.6} />
      </>
    );
  },
};
