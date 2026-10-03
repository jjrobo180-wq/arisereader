// Cover art, part 1: strategy classics, quick matches and mind games.
// Each scene paints a 480×400 canvas; covers crop the middle (x 90–390).
import type { ReactNode } from "react";
import { Fog, Glow, GlowEllipse, H, type Ids, Motes, Rays, Ridge, Sky, Stars, Vignette, W, floorCells, hgrad, rgrad, rng, vgrad } from "./paint";
import { chessScene } from "./chessScene";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const url = (k: Ids, name: string) => `url(#${k(name)})`;

/** A glossy game disc seen straight on. */
function discGrads(k: Ids) {
  return (
    <defs>
      {rgrad(k("dRed"), [[0, "#ffb3a6"], [0.42, "#ff3b3b"], [1, "#8c0b1b"]], 0.36, 0.3, 0.75)}
      {rgrad(k("dGold"), [[0, "#fff6c2"], [0.42, "#ffc233"], [1, "#9a5a06"]], 0.36, 0.3, 0.75)}
      {rgrad(k("dBlack"), [[0, "#6b6f80"], [0.35, "#22242e"], [1, "#050508"]], 0.36, 0.3, 0.75)}
      {rgrad(k("dWhite"), [[0, "#ffffff"], [0.55, "#e6e8f0"], [1, "#9ea3b5"]], 0.36, 0.3, 0.75)}
    </defs>
  );
}

export const SCENES_A: Record<string, (k: Ids) => ReactNode> = {
  // ─── FOURFALL ─────────────────────────────────────────────────────────────
  four: (k) => {
    const top = 96, bot = 312, topL = 170, topR = 310, botL = 136, botR = 344;
    const pattern = ["0000000", "0000000", "0000200", "0002100", "0122110", "1221211"];
    const win = new Set(["5,1", "4,2", "3,3", "2,4"]);
    const holes: ReactNode[] = [];
    const winPts: string[] = [];
    for (let r = 0; r < 6; r++) {
      const t = (r + 0.5) / 6;
      const y = lerp(top, bot, t);
      const left = lerp(topL, botL, t), right = lerp(topR, botR, t);
      const rad = lerp(8.4, 12, t);
      for (let c = 0; c < 7; c++) {
        const x = left + ((c + 0.5) * (right - left)) / 7;
        const v = pattern[r][c];
        holes.push(<circle key={`h${r}${c}`} cx={x} cy={y} r={rad} fill="#050b22" />);
        holes.push(<path key={`s${r}${c}`} d={`M${x - rad},${y} a${rad},${rad} 0 0 1 ${rad * 2},0`} fill="none" stroke="#000" strokeOpacity={0.55} strokeWidth={2.2} />);
        if (v !== "0") holes.push(<circle key={`d${r}${c}`} cx={x} cy={y} r={rad * 0.9} fill={url(k, v === "1" ? "dRed" : "dGold")} />);
        if (win.has(`${r},${c}`)) winPts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
    }
    const colX = (c: number) => lerp(topL, topR, (c + 0.5) / 7);
    return (
      <>
        <Sky k={k} stops={[[0, "#050819"], [0.42, "#122452"], [0.72, "#2c5a8c"], [1, "#0a1326"]]} />
        <Stars seed={11} n={70} y1={190} />
        <Glow k={k} name="halo" cx={240} cy={170} r={230} color="#69b8ff" opacity={0.42} />
        <Rays k={k} name="rays" cx={240} cy={-40} n={9} spread={70} len={420} color="#bfe3ff" opacity={0.16} seed={4} />
        <Ridge seed={3} y={300} amp={36} color="#13254a" />
        <Fog k={k} name="fog1" y={262} h={70} color="#7fb8ff" opacity={0.28} />
        {discGrads(k)}
        <defs>
          {hgrad(k("face"), [[0, "#244fc4"], [0.55, "#3a72ee"], [1, "#1d3f9c"]])}
          {vgrad(k("side"), [[0, "#14307a"], [1, "#0a1a45"]])}
          {vgrad(k("trail"), [[0, "#ffffff", 0], [1, "#ffe7a6", 0.75]])}
          {vgrad(k("trailR"), [[0, "#ffffff", 0], [1, "#ffb3a6", 0.75]])}
        </defs>
        <path d={`M${topR},${top} L${topR + 16},${top + 9} L${botR + 20},${bot + 6} L${botR},${bot} Z`} fill={url(k, "side")} />
        <path d={`M${topL},${top} L${topR},${top} L${botR},${bot} L${botL},${bot} Z`} fill={url(k, "face")} />
        <path d={`M${topL},${top} L${topR},${top}`} stroke="#bfe0ff" strokeWidth={2} strokeOpacity={0.8} />
        <path d={`M${topL},${top} L${botL},${bot}`} stroke="#9fd0ff" strokeWidth={1.4} strokeOpacity={0.5} />
        {holes}
        <polyline points={winPts.join(" ")} fill="none" stroke="#ffe08a" strokeWidth={10} strokeLinecap="round" strokeOpacity={0.22} />
        <polyline points={winPts.join(" ")} fill="none" stroke="#fff4c7" strokeWidth={2.5} strokeLinecap="round" strokeOpacity={0.85} />
        <path d={`M${botL - 16},${bot} L${botR + 26},${bot} L${botR + 40},${bot + 22} L${botL - 30},${bot + 22} Z`} fill="#0b1633" />
        <rect x={colX(2) - 1.5} y={-10} width={3} height={78} fill={url(k, "trailR")} />
        <circle cx={colX(2)} cy={68} r={10.5} fill={url(k, "dRed")} />
        <rect x={colX(4) - 1.5} y={-20} width={3} height={60} fill={url(k, "trail")} />
        <circle cx={colX(4)} cy={42} r={10.5} fill={url(k, "dGold")} />
        <Glow k={k} name="discGlow" cx={colX(4)} cy={42} r={30} color="#ffd36b" opacity={0.45} />
        <Ridge seed={9} y={346} amp={16} color="#050915" step={18} />
        <Motes seed={5} n={26} y0={40} y1={300} color="#cfe8ff" size={1.1} opacity={0.6} />
        <Vignette k={k} />
      </>
    );
  },

  // ─── KINGMAKER ────────────────────────────────────────────────────────────
  checkers: (k) => {
    const floor = floorCells({ vpX: 240, horizon: 196, rows: 9, colW: 74, cols: [-6, 6] });
    return (
      <>
        <Sky k={k} stops={[[0, "#0f0207"], [0.45, "#3d0714"], [0.7, "#24040c"], [1, "#0a0104"]]} />
        <Glow k={k} name="back" cx={240} cy={150} r={220} color="#c2182f" opacity={0.35} />
        <defs>
          {vgrad(k("beam"), [[0, "#fff1d0", 0.32], [1, "#fff1d0", 0]])}
          {vgrad(k("floorFog"), [[0, "#2a0510", 1], [0.45, "#2a0510", 0.55], [1, "#2a0510", 0]])}
          {rgrad(k("kingTop"), [[0, "#ff8a80"], [0.5, "#e0262f"], [1, "#7a0812"]], 0.4, 0.3, 0.8)}
          {vgrad(k("kingSide"), [[0, "#b3141f"], [1, "#4a040a"]])}
          {vgrad(k("crown"), [[0, "#fff4c4"], [0.4, "#ffcf55"], [1, "#a8650c"]])}
          {rgrad(k("blk"), [[0, "#4a4d5c"], [1, "#09090d"]], 0.4, 0.3, 0.8)}
        </defs>
        <g>
          {floor.cells.map((c) => (
            <path key={`${c.i},${c.j}`} d={c.d} fill={(c.i + c.j) % 2 === 0 ? "#d7a86a" : "#3a1a0b"} />
          ))}
        </g>
        <rect x={0} y={196} width={W} height={140} fill={url(k, "floorFog")} />
        <path d="M196,-10 L284,-10 L380,340 L100,340 Z" fill={url(k, "beam")} />
        {/* distant black pieces */}
        {[[132, 232, 26], [356, 238, 28], [300, 214, 17]].map(([x, y, r], i) => (
          <g key={i}>
            <ellipse cx={x} cy={y + r * 0.34} rx={r} ry={r * 0.32} fill="#000" opacity={0.5} />
            <path d={`M${x - r},${y} L${x - r},${y + r * 0.28} A${r},${r * 0.3} 0 0 0 ${x + r},${y + r * 0.28} L${x + r},${y} Z`} fill="#0c0c12" />
            <ellipse cx={x} cy={y} rx={r} ry={r * 0.3} fill={url(k, "blk")} />
          </g>
        ))}
        {/* the king */}
        <ellipse cx={240} cy={318} rx={92} ry={20} fill="#000" opacity={0.55} />
        <path d="M160,284 L160,306 A80,22 0 0 0 320,306 L320,284 Z" fill={url(k, "kingSide")} />
        <ellipse cx={240} cy={284} rx={80} ry={22} fill={url(k, "kingTop")} />
        <path d="M168,258 L168,280 A72,20 0 0 0 312,280 L312,258 Z" fill={url(k, "kingSide")} />
        <ellipse cx={240} cy={258} rx={72} ry={20} fill={url(k, "kingTop")} />
        <ellipse cx={240} cy={258} rx={52} ry={13} fill="none" stroke="#ff9a8f" strokeOpacity={0.35} strokeWidth={2} />
        <Glow k={k} name="crownGlow" cx={240} cy={214} r={90} color="#ffd36b" opacity={0.45} />
        <path d="M196,244 L188,186 L214,212 L240,172 L266,212 L292,186 L284,244 Z" fill={url(k, "crown")} stroke="#6b3d05" strokeWidth={2} strokeLinejoin="round" />
        <path d="M196,244 L284,244 L286,252 L194,252 Z" fill="#c8861c" />
        {[[188, 186], [240, 172], [292, 186]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={5.5} fill="#fff4c4" stroke="#6b3d05" strokeWidth={1.5} />)}
        <circle cx={240} cy={226} r={6} fill="#e8263a" stroke="#6b3d05" strokeWidth={1.5} />
        <circle cx={213} cy={232} r={4} fill="#3dc1ff" stroke="#6b3d05" strokeWidth={1.2} />
        <circle cx={267} cy={232} r={4} fill="#3dc1ff" stroke="#6b3d05" strokeWidth={1.2} />
        <Motes seed={7} n={40} x0={120} x1={360} y0={20} y1={320} color="#ffe2a0" size={1.2} opacity={0.7} />
        <Vignette k={k} strength={0.75} />
      </>
    );
  },

  // ─── ECLIPSE ──────────────────────────────────────────────────────────────
  reversi: (k) => {
    const r = rng(23);
    const discs: ReactNode[] = [];
    const spots: [number, number, number, number][] = [
      [118, 300, 22, 0], [176, 286, 18, 1], [300, 292, 20, 0], [362, 306, 24, 1], [228, 330, 30, 1], [140, 352, 34, 0],
      [330, 352, 36, 0], [262, 278, 14, 0], [204, 268, 11, 1], [310, 270, 12, 1], [98, 274, 12, 1], [392, 276, 13, 0],
    ];
    spots.forEach(([x, y, s, c], i) => {
      const tilt = 0.32 + r() * 0.05;
      discs.push(
        <g key={i}>
          <ellipse cx={x} cy={y + s * 0.2} rx={s} ry={s * tilt} fill="#000" opacity={0.55} />
          <ellipse cx={x} cy={y + s * 0.12} rx={s} ry={s * tilt} fill={c ? "#c9ccd8" : "#0c0d12"} />
          <ellipse cx={x} cy={y} rx={s} ry={s * tilt} fill={url(k, c ? "dWhite" : "dBlack")} />
        </g>,
      );
    });
    return (
      <>
        <Sky k={k} stops={[[0, "#010208"], [0.55, "#060b1d"], [0.7, "#0d1a2a"], [1, "#03070c"]]} />
        <Stars seed={31} n={110} y1={250} />
        <Glow k={k} name="corona" cx={240} cy={140} r={210} color="#ffc56b" opacity={0.3} />
        <Glow k={k} name="ring" cx={240} cy={140} r={112} color="#fff2cc" opacity={0.95} core={0.62} />
        <Rays k={k} name="cRays" cx={240} cy={140} n={22} spread={360} len={200} color="#ffe0a0" opacity={0.25} seed={8} width={0.02} />
        <circle cx={240} cy={140} r={78} fill="#000" />
        <circle cx={240} cy={140} r={78.5} fill="none" stroke="#fffbe8" strokeWidth={2.2} strokeOpacity={0.95} />
        <Glow k={k} name="diamond" cx={182} cy={92} r={30} color="#ffffff" opacity={1} core={0.12} />
        {discGrads(k)}
        <defs>{vgrad(k("plain"), [[0, "#0d1d26"], [1, "#020407"]])}</defs>
        <path d={`M0,262 L${W},262 L${W},${H} L0,${H} Z`} fill={url(k, "plain")} />
        <GlowEllipse k={k} name="shine" cx={240} cy={268} rx={220} ry={26} color="#ffd88a" opacity={0.35} />
        {discs}
        {/* a disc mid-flip */}
        <g transform="translate(250 214) rotate(-18)">
          <ellipse cx={0} cy={0} rx={9} ry={24} fill="#f2f3f8" />
          <path d="M0,-24 A9,24 0 0 1 0,24 Z" fill="#111218" />
        </g>
        <Glow k={k} name="flipGlow" cx={250} cy={214} r={36} color="#fff2cc" opacity={0.35} />
        <Vignette k={k} strength={0.7} />
      </>
    );
  },

  // ─── STONE HARVEST ────────────────────────────────────────────────────────
  mancala: (k) => {
    const gem = ["#4ff0d6", "#ffb547", "#c58bff", "#ff6b8b", "#7fe36b"];
    const r = rng(41);
    const pits: ReactNode[] = [];
    // The board sits in perspective: the far row is narrower and smaller.
    const rows = [{ y: 214, half: 118, rx: 15, ry: 7 }, { y: 250, half: 134, rx: 18, ry: 9 }];
    rows.forEach((row, ri) => {
      for (let i = 0; i < 6; i++) {
        const x = 240 - row.half + ((i + 0.5) / 6) * row.half * 2;
        pits.push(<ellipse key={`p${ri}${i}`} cx={x} cy={row.y} rx={row.rx} ry={row.ry} fill="#241104" />);
        pits.push(<ellipse key={`q${ri}${i}`} cx={x} cy={row.y - 1.6} rx={row.rx} ry={row.ry * 0.72} fill="#3a1d09" />);
        const n = 2 + Math.floor(r() * 3);
        for (let s2 = 0; s2 < n; s2++) {
          const gx = x + (r() - 0.5) * row.rx * 1.1, gy = row.y + (r() - 0.5) * row.ry * 0.8;
          const col = gem[Math.floor(r() * gem.length)];
          pits.push(<circle key={`g${ri}${i}${s2}`} cx={gx} cy={gy} r={ri ? 4 : 3.4} fill={col} />);
          pits.push(<circle key={`gl${ri}${i}${s2}`} cx={gx - 1} cy={gy - 1.2} r={1.2} fill="#fff" opacity={0.85} />);
        }
      }
    });
    return (
      <>
        <Sky k={k} stops={[[0, "#220a35"], [0.24, "#642555"], [0.4, "#de663e"], [0.47, "#ffc06b"], [0.5, "#f08a4b"], [1, "#3a1322"]]} />
        <Glow k={k} name="sun" cx={240} cy={170} r={190} color="#ffd38a" opacity={0.62} />
        <circle cx={240} cy={166} r={32} fill="#fff1c9" />
        <Stars seed={42} n={30} y1={90} color="#ffe9d6" />
        <path d="M-10,184 L40,184 L52,160 L118,160 L128,184 L178,184 L188,170 L214,170 L222,184 L300,184 L312,154 L366,154 L378,184 L490,184 L490,210 L-10,210 Z" fill="#6e2b4a" opacity={0.85} />
        <Fog k={k} name="haze" y={160} h={50} color="#ffb27a" opacity={0.55} />
        <defs>
          {vgrad(k("dune1"), [[0, "#d27a43"], [1, "#8c3f22"]])}
          {vgrad(k("dune2"), [[0, "#93401f"], [1, "#4a1a0c"]])}
          {vgrad(k("wood"), [[0, "#c98240"], [0.5, "#935427"], [1, "#552d11"]])}
          {vgrad(k("woodSide"), [[0, "#5c3014"], [1, "#220e04"]])}
        </defs>
        <path d="M-10,206 C80,186 160,196 240,204 C330,212 400,190 490,198 L490,410 L-10,410 Z" fill={url(k, "dune1")} />
        <path d="M-10,300 C90,282 170,306 260,300 C350,294 420,280 490,288 L490,410 L-10,410 Z" fill={url(k, "dune2")} />
        <ellipse cx={240} cy={286} rx={200} ry={22} fill="#000" opacity={0.45} />
        <path d="M78,222 Q80,196 112,192 L368,192 Q400,196 402,222 L420,262 Q422,280 388,282 L92,282 Q58,280 60,262 Z" fill={url(k, "woodSide")} />
        <path d="M84,218 Q86,196 114,194 L366,194 Q394,196 396,218 L414,256 Q416,270 386,271 L94,271 Q64,270 66,256 Z" fill={url(k, "wood")} />
        <path d="M114,195 L366,195" stroke="#ffd29a" strokeOpacity={0.55} strokeWidth={1.5} />
        <ellipse cx={86} cy={232} rx={13} ry={28} fill="#241104" />
        <ellipse cx={394} cy={232} rx={13} ry={28} fill="#241104" />
        {pits}
        <circle cx={84} cy={224} r={3.8} fill="#4ff0d6" /><circle cx={89} cy={238} r={3.8} fill="#ffb547" /><circle cx={392} cy={228} r={3.8} fill="#c58bff" /><circle cx={396} cy={242} r={3.8} fill="#ff6b8b" />
        <Glow k={k} name="gemGlow" cx={240} cy={232} r={160} color="#ffd38a" opacity={0.2} />
        <Motes seed={44} n={36} y0={100} y1={300} color="#ffe0b8" size={1} opacity={0.6} />
        <Vignette k={k} strength={0.55} />
      </>
    );
  },

  // ─── GRIDLOCK ─────────────────────────────────────────────────────────────
  dots: (k) => {
    const horizon = 236;
    const lines: ReactNode[] = [];
    for (let i = -14; i <= 14; i++) {
      const xb = 240 + i * 46;
      lines.push(<line key={`v${i}`} x1={240} y1={horizon} x2={xb} y2={H} stroke="#39e6ff" strokeWidth={1.4} strokeOpacity={0.55} />);
    }
    const ys: number[] = [];
    for (let j = 1; j <= 11; j++) ys.push(horizon + (H - horizon) * Math.pow(j / 11, 2.1));
    ys.forEach((y, j) => lines.push(<line key={`h${j}`} x1={0} y1={y} x2={W} y2={y} stroke="#39e6ff" strokeWidth={1.2} strokeOpacity={0.25 + (j / 11) * 0.5} />));
    const fl = floorCells({ vpX: 240, horizon, rows: 11, colW: 46, cols: [-6, 6], curve: 2.1 });
    const claimed: Record<string, string> = { "-2,8": "#ff3fd0", "-1,8": "#ff3fd0", "1,7": "#39e6ff", "0,9": "#39e6ff", "1,9": "#39e6ff", "-3,10": "#ff3fd0", "2,10": "#39e6ff", "-1,6": "#ff3fd0" };
    const cells = fl.cells.filter((c) => claimed[`${c.i},${c.j}`]);
    const dots: ReactNode[] = [];
    fl.ys.forEach((y, j) => {
      if (j < 5) return;
      for (let i = -5; i <= 5; i++) dots.push(<circle key={`d${i},${j}`} cx={fl.xAt(i, y)} cy={y} r={1 + (j / 11) * 2.6} fill="#e9fbff" />);
    });
    return (
      <>
        <Sky k={k} stops={[[0, "#04010c"], [0.4, "#16053a"], [0.58, "#4a0c62"], [0.59, "#07010f"], [1, "#07010f"]]} />
        <Stars seed={51} n={60} y1={200} />
        <defs>
          {vgrad(k("sun"), [[0, "#fff27a"], [0.55, "#ff8a5c"], [1, "#ff2fa0"]])}
          {vgrad(k("mtn"), [[0, "#2a0a4a"], [1, "#0b0218"]])}
        </defs>
        <Glow k={k} name="sunGlow" cx={240} cy={176} r={170} color="#ff4fbf" opacity={0.45} />
        <circle cx={240} cy={176} r={84} fill={url(k, "sun")} />
        {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={150} y={186 + i * 9.5} width={180} height={2 + i * 1.1} fill="#16053a" />)}
        <path d="M-10,236 L30,206 L64,222 L106,182 L150,226 L176,214 L196,236 Z" fill={url(k, "mtn")} stroke="#ff3fd0" strokeWidth={1.4} strokeOpacity={0.8} />
        <path d="M290,236 L322,208 L350,220 L392,176 L430,214 L460,198 L490,236 Z" fill={url(k, "mtn")} stroke="#ff3fd0" strokeWidth={1.4} strokeOpacity={0.8} />
        <GlowEllipse k={k} name="horizonGlow" cx={240} cy={238} rx={260} ry={22} color="#ff3fd0" opacity={0.6} />
        <g>{lines}</g>
        <g>{cells.map((c) => <path key={`${c.i},${c.j}`} d={c.d} fill={claimed[`${c.i},${c.j}`]} fillOpacity={0.55} stroke={claimed[`${c.i},${c.j}`]} strokeWidth={1.6} />)}</g>
        <g>{dots}</g>
        <Vignette k={k} strength={0.6} />
      </>
    );
  },

  // ─── FIVEFOLD ─────────────────────────────────────────────────────────────
  gomoku: (k) => {
    const horizon = 206, bottom = 420;
    const toX = (u: number, y: number) => 240 + u * (0.55 + 1.15 * ((y - horizon) / (bottom - horizon)));
    const gy = (v: number) => horizon + 14 + (bottom - horizon - 14) * Math.pow(Math.max(0, v), 1.5);
    const grid: ReactNode[] = [];
    for (let i = -7; i <= 7; i++) {
      const y0 = gy(0), y1 = gy(1);
      grid.push(<line key={`v${i}`} x1={toX(i * 26, y0)} y1={y0} x2={toX(i * 26, y1)} y2={y1} stroke="#3b2306" strokeWidth={1} strokeOpacity={0.75} />);
    }
    for (let j = 0; j <= 9; j++) {
      const y = gy(j / 9);
      grid.push(<line key={`h${j}`} x1={toX(-7 * 26, y)} y1={y} x2={toX(7 * 26, y)} y2={y} stroke="#3b2306" strokeWidth={1} strokeOpacity={0.75} />);
    }
    const stone = (u: number, v: number, white: boolean, key: string) => {
      const y = gy(v / 9), x = toX(u * 26, y);
      const s = 7 + 10 * (v / 9);
      return (
        <g key={key}>
          <ellipse cx={x} cy={y + s * 0.35} rx={s} ry={s * 0.45} fill="#000" opacity={0.35} />
          <ellipse cx={x} cy={y} rx={s} ry={s * 0.62} fill={url(k, white ? "sW" : "sB")} />
        </g>
      );
    };
    const line = [[-2.4, 1], [-1.2, 2.2], [0, 3.4], [1.2, 4.6], [2.4, 5.8]] as const;
    const pts = line.map(([u, v]) => { const y = gy(v / 9); return `${toX(u * 26, y).toFixed(1)},${y.toFixed(1)}`; }).join(" ");
    return (
      <>
        <Sky k={k} stops={[[0, "#08111f"], [0.36, "#1b324c"], [0.5, "#5a6f86"], [0.56, "#c8b48c"], [1, "#2a2016"]]} />
        <Glow k={k} name="moonGlow" cx={318} cy={70} r={110} color="#f6ecd2" opacity={0.4} />
        <circle cx={318} cy={70} r={24} fill="#f6ecd2" />
        <Ridge seed={61} y={160} amp={60} step={30} color="#3d5470" rough={0.5} peaks={[[160, 50], [380, 34]]} />
        <Fog k={k} name="mist1" y={140} h={56} color="#c9d4de" opacity={0.45} />
        <Ridge seed={62} y={196} amp={44} step={24} color="#26394f" rough={0.55} peaks={[[90, 34], [300, 46]]} />
        <Fog k={k} name="mist2" y={180} h={44} color="#d8d0bc" opacity={0.5} />
        <defs>
          {vgrad(k("board"), [[0, "#e2b06a"], [1, "#a8702f"]])}
          {rgrad(k("sW"), [[0, "#ffffff"], [0.6, "#e7e7ee"], [1, "#9aa0b2"]], 0.38, 0.3, 0.8)}
          {rgrad(k("sB"), [[0, "#6b6e7c"], [0.4, "#1b1c24"], [1, "#030304"]], 0.38, 0.3, 0.8)}
        </defs>
        <path d={`M${toX(-7.6 * 26, horizon + 8)},${horizon + 8} L${toX(7.6 * 26, horizon + 8)},${horizon + 8} L${toX(7.6 * 26, bottom)},${bottom} L${toX(-7.6 * 26, bottom)},${bottom} Z`} fill={url(k, "board")} />
        <path d={`M${toX(-7.6 * 26, horizon + 8)},${horizon + 8} L${toX(7.6 * 26, horizon + 8)},${horizon + 8}`} stroke="#ffe2a8" strokeWidth={1.5} strokeOpacity={0.8} />
        <g>{grid}</g>
        {stone(-4, 2, false, "b1")}{stone(3.5, 1.5, false, "b2")}{stone(-2.5, 4.5, false, "b3")}{stone(4, 5, false, "b4")}{stone(1, 0.6, false, "b5")}
        <polyline points={pts} fill="none" stroke="#ffd36b" strokeWidth={12} strokeLinecap="round" strokeOpacity={0.25} />
        <polyline points={pts} fill="none" stroke="#fff3c4" strokeWidth={2.4} strokeLinecap="round" strokeOpacity={0.9} />
        {line.map(([u, v], i) => stone(u, v, true, `w${i}`))}
        <Motes seed={63} n={30} y0={60} y1={260} color="#ffffff" size={1} opacity={0.5} />
        <Vignette k={k} strength={0.6} />
      </>
    );
  },

  // ─── ULTIMATE CHESS (shared with the Worlds page) ─────────────────────
  chess: chessScene,

  // ─── CROSSFIRE ────────────────────────────────────────────────────────────
  tictactoe: (k) => {
    const sparks: ReactNode[] = [];
    const r = rng(81);
    for (let i = 0; i < 34; i++) {
      const a = r() * Math.PI * 2, d0 = 14 + r() * 20, d1 = d0 + 20 + r() * 70;
      sparks.push(<line key={i} x1={242 + Math.cos(a) * d0} y1={172 + Math.sin(a) * d0} x2={242 + Math.cos(a) * d1} y2={172 + Math.sin(a) * d1} stroke={r() > 0.5 ? "#ffe9b0" : "#bfe6ff"} strokeWidth={0.8 + r() * 1.6} strokeLinecap="round" opacity={0.5 + r() * 0.5} />);
    }
    return (
      <>
        <Sky k={k} stops={[[0, "#04040a"], [0.6, "#0d0a1c"], [1, "#05040a"]]} />
        <defs>
          {vgrad(k("spotL"), [[0, "#ff8a5c", 0.35], [1, "#ff8a5c", 0]])}
          {vgrad(k("spotR"), [[0, "#5cb8ff", 0.35], [1, "#5cb8ff", 0]])}
          {vgrad(k("x"), [[0, "#ffd37a"], [0.5, "#ff6a3d"], [1, "#b3201a"]])}
          {vgrad(k("o"), [[0, "#9be6ff"], [0.5, "#3d9bff"], [1, "#5a2fd6"]])}
        </defs>
        <path d="M60,-10 L120,-10 L250,330 L120,330 Z" fill={url(k, "spotL")} />
        <path d="M360,-10 L420,-10 L360,330 L230,330 Z" fill={url(k, "spotR")} />
        <GlowEllipse k={k} name="floor" cx={240} cy={330} rx={240} ry={40} color="#6a4cff" opacity={0.35} />
        <Glow k={k} name="xGlow" cx={176} cy={176} r={120} color="#ff5a3d" opacity={0.45} />
        <Glow k={k} name="oGlow" cx={306} cy={176} r={120} color="#3d9bff" opacity={0.45} />
        <g transform="translate(176 176) rotate(45)">
          <rect x={-18} y={-82} width={36} height={164} rx={14} fill={url(k, "x")} />
          <rect x={-82} y={-18} width={164} height={36} rx={14} fill={url(k, "x")} />
          <rect x={-10} y={-76} width={8} height={152} rx={4} fill="#fff3d6" opacity={0.45} />
        </g>
        <circle cx={306} cy={176} r={62} fill="none" stroke={url(k, "o")} strokeWidth={34} />
        <path d="M262,140 A62,62 0 0 1 330,118" fill="none" stroke="#e8f8ff" strokeWidth={6} strokeLinecap="round" opacity={0.55} />
        <Glow k={k} name="burst" cx={242} cy={172} r={70} color="#ffffff" opacity={0.95} core={0.08} />
        <g>{sparks}</g>
        <Motes seed={82} n={40} y0={40} y1={320} color="#ffd9b0" size={1.1} opacity={0.55} />
        <Vignette k={k} strength={0.65} />
      </>
    );
  },

  // ─── COLOSSUS ─────────────────────────────────────────────────────────────
  gobble: (k) => {
    const PAWN = "M-60,0 Q-62,-14 -48,-20 Q-30,-28 -26,-62 Q-22,-108 -15,-126 L-27,-134 Q-30,-146 -16,-149 Q-31,-162 -31,-184 A31,31 0 1 1 31,-184 Q31,-162 16,-149 Q30,-146 27,-134 L15,-126 Q22,-108 26,-62 Q30,-28 48,-20 Q62,-14 60,0 Z";
    const piece = (x: number, y: number, s: number, key: string, fillId: string, rim = 0.55) => (
      <g key={key} transform={`translate(${x} ${y}) scale(${s})`}>
        <ellipse cx={0} cy={2} rx={66} ry={13} fill="#000" opacity={0.55} />
        <path d={PAWN} fill={url(k, fillId)} />
        <path d={PAWN} fill={url(k, "rimR")} opacity={rim} />
        <ellipse cx={-10} cy={-196} rx={9} ry={6} fill="#fff" opacity={0.25} />
      </g>
    );
    return (
      <>
        <Sky k={k} stops={[[0, "#160404"], [0.4, "#5e1610"], [0.66, "#d25a26"], [0.74, "#ffb25e"], [0.75, "#2a0c08"], [1, "#100403"]]} />
        <Glow k={k} name="sun" cx={252} cy={292} r={220} color="#ff9a4d" opacity={0.6} />
        {[[90, 70, 120, 26], [380, 110, 140, 30], [200, 40, 150, 24], [330, 30, 110, 20]].map(([x, y, rx, ry], i) => (
          <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill="#2a0806" opacity={0.75} />
        ))}
        <Rays k={k} name="rays" cx={252} cy={292} n={12} spread={150} len={320} color="#ffcf8a" opacity={0.2} seed={92} angle={-90} />
        <Ridge seed={91} y={300} amp={26} color="#2a0a07" />
        <defs>
          {hgrad(k("stone"), [[0, "#1c1a20"], [0.4, "#3a3640"], [0.7, "#4c4450"], [1, "#1a1418"]])}
          {hgrad(k("small"), [[0, "#5a1a0c"], [0.5, "#b8441e"], [1, "#4a1408"]])}
          {hgrad(k("rimR"), [[0, "#ffb15e", 0], [0.78, "#ffb15e", 0], [1, "#ffcf8a", 0.9]])}
        </defs>
        {piece(240, 318, 1.12, "big", "stone", 0.8)}
        {piece(130, 330, 0.36, "s1", "small")}
        {piece(352, 334, 0.42, "s2", "small")}
        {piece(176, 346, 0.28, "s3", "small")}
        <Fog k={k} name="dust" y={290} h={80} color="#ff9a5c" opacity={0.3} />
        <Motes seed={93} n={36} y0={120} y1={340} color="#ffc58a" size={1.2} opacity={0.6} />
        <Vignette k={k} strength={0.7} />
      </>
    );
  },

  // ─── SHOWDOWN ─────────────────────────────────────────────────────────────
  rps: (k) => {
    const bolt = (x1: number, y1: number, x2: number, y2: number, seed: number) => {
      const r = rng(seed);
      const pts: string[] = [`${x1},${y1}`];
      for (let i = 1; i < 7; i++) {
        const t = i / 7;
        pts.push(`${(lerp(x1, x2, t) + (r() - 0.5) * 16).toFixed(1)},${(lerp(y1, y2, t) + (r() - 0.5) * 16).toFixed(1)}`);
      }
      pts.push(`${x2},${y2}`);
      return (
        <g key={seed}>
          <polyline points={pts.join(" ")} fill="none" stroke="#ffcf6b" strokeWidth={12} strokeOpacity={0.22} strokeLinejoin="round" />
          <polyline points={pts.join(" ")} fill="none" stroke="#fff3c4" strokeWidth={2.6} strokeLinejoin="round" />
        </g>
      );
    };
    return (
      <>
        <Sky k={k} stops={[[0, "#1a0904"], [0.45, "#6b240e"], [0.66, "#e0702c"], [0.74, "#ffd08a"], [1, "#3a1608"]]} />
        <Glow k={k} name="sun" cx={240} cy={262} r={200} color="#ffc070" opacity={0.6} />
        <path d="M-10,400 L-10,120 L30,128 L44,180 L70,190 L86,262 L118,276 L132,330 L170,350 L170,410 Z" fill="#2a0f06" />
        <path d="M490,400 L490,100 L452,118 L440,170 L410,184 L396,250 L364,270 L350,328 L310,352 L310,410 Z" fill="#2a0f06" />
        <path d="M-10,410 L-10,330 Q120,300 240,318 Q360,300 490,330 L490,410 Z" fill="#1c0904" />
        <defs>
          {rgrad(k("rock"), [[0, "#b8b0aa"], [0.5, "#6e6660"], [1, "#2a2420"]], 0.35, 0.3, 0.8)}
          {vgrad(k("paper"), [[0, "#fffaf0"], [1, "#d9c9a6"]])}
          {hgrad(k("blade"), [[0, "#e8eef8"], [0.5, "#9aa8bd"], [1, "#4a5568"]])}
        </defs>
        <Glow k={k} name="hP" cx={240} cy={124} r={80} color="#fff1c4" opacity={0.45} />
        <Glow k={k} name="hR" cx={176} cy={260} r={80} color="#ffb070" opacity={0.4} />
        <Glow k={k} name="hS" cx={306} cy={250} r={80} color="#cfe3ff" opacity={0.4} />
        {bolt(240, 150, 178, 246, 101)}{bolt(240, 150, 306, 246, 102)}{bolt(186, 262, 300, 262, 103)}
        {/* paper */}
        <g transform="translate(240 122) rotate(-6) scale(1.25)">
          <path d="M-34,-40 L26,-40 L36,-30 L36,42 L-34,42 Z" fill={url(k, "paper")} stroke="#7a6440" strokeWidth={1.5} />
          <path d="M26,-40 L26,-30 L36,-30 Z" fill="#c9b48a" />
          {[-24, -14, -4, 6, 16, 26].map((y) => <line key={y} x1={-24} y1={y} x2={26} y2={y} stroke="#b9a37a" strokeWidth={1.4} />)}
        </g>
        {/* rock */}
        <g transform="translate(178 262) scale(1.25) translate(-178 -262)">
          <path d="M134,282 Q136,238 172,228 Q206,222 222,250 Q236,276 214,294 Q176,306 134,282 Z" fill={url(k, "rock")} />
          <path d="M156,238 Q176,230 194,236" fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={2.4} strokeLinecap="round" />
        </g>
        {/* scissors */}
        <g transform="translate(308 258) scale(1.25)">
          <path d="M-6,4 L46,-58 L52,-52 L4,10 Z" fill={url(k, "blade")} />
          <path d="M6,4 L-34,-60 L-40,-54 L-4,10 Z" fill={url(k, "blade")} />
          <circle cx={-12} cy={22} r={11} fill="none" stroke="#c0392b" strokeWidth={6} />
          <circle cx={14} cy={22} r={11} fill="none" stroke="#c0392b" strokeWidth={6} />
          <circle cx={0} cy={6} r={3} fill="#2a2a2a" />
        </g>
        <Motes seed={104} n={44} y0={100} y1={360} color="#ffd9a0" size={1.2} opacity={0.55} />
        <Vignette k={k} strength={0.65} />
      </>
    );
  },

  // ─── MINDVAULT ────────────────────────────────────────────────────────────
  memory: (k) => {
    const bolts: ReactNode[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      bolts.push(<circle key={i} cx={240 + Math.cos(a) * 100} cy={172 + Math.sin(a) * 100} r={4.5} fill="#bff8ec" stroke="#0a3a36" strokeWidth={1.5} />);
    }
    const card = (x: number, y: number, rot: number, sym: string, key: string, glow = false) => (
      <g key={key} transform={`translate(${x} ${y}) rotate(${rot})`}>
        <rect x={-22} y={-30} width={44} height={60} rx={6} fill={glow ? "#f4fffc" : "#d9f5ef"} stroke="#3df2d0" strokeWidth={glow ? 2.5 : 1.2} />
        <text x={0} y={9} textAnchor="middle" fontSize={26} fill={glow ? "#0aa38a" : "#2c8f80"} fontFamily="Cinzel, serif" fontWeight={900}>{sym}</text>
      </g>
    );
    return (
      <>
        <Sky k={k} stops={[[0, "#010a0d"], [0.6, "#05333a"], [1, "#020d10"]]} />
        <Glow k={k} name="back" cx={240} cy={172} r={210} color="#2fe0c4" opacity={0.3} />
        <defs>
          {rgrad(k("door"), [[0, "#2a6e6a"], [0.6, "#123e3c"], [1, "#071d1c"]], 0.4, 0.35, 0.8)}
          {vgrad(k("ring"), [[0, "#bff8ec"], [0.5, "#3aa89a"], [1, "#0d3a36"]])}
        </defs>
        <circle cx={240} cy={172} r={124} fill="#031413" />
        <circle cx={240} cy={172} r={116} fill="none" stroke={url(k, "ring")} strokeWidth={12} />
        <circle cx={240} cy={172} r={104} fill={url(k, "door")} />
        {bolts}
        <circle cx={240} cy={172} r={70} fill="none" stroke="#3df2d0" strokeOpacity={0.4} strokeWidth={2} strokeDasharray="6 7" />
        {[0, 60, 120].map((a) => <rect key={a} x={236} y={92} width={8} height={160} rx={4} fill="#0b2a28" transform={`rotate(${a} 240 172)`} />)}
        <circle cx={240} cy={172} r={34} fill="#0b2a28" stroke="#3df2d0" strokeWidth={2} />
        <Glow k={k} name="core" cx={240} cy={172} r={60} color="#5dffe2" opacity={0.65} />
        {card(240, 172, 0, "★", "c0", true)}
        {card(104, 98, -16, "◆", "c1")}{card(378, 92, 14, "★", "c2")}{card(92, 262, 10, "●", "c3")}{card(388, 258, -12, "◆", "c4")}
        <Motes seed={111} n={50} color="#7dffe8" size={1.2} opacity={0.6} />
        <Vignette k={k} strength={0.65} />
      </>
    );
  },

  // ─── NINE REALMS ──────────────────────────────────────────────────────────
  ultimate: (k) => {
    const isles: ReactNode[] = [];
    const marks = ["x", "o", "x", "", "x", "o", "o", "", "x"];
    let n = 0;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const depth = row / 2; // back row first
        const s = lerp(0.62, 1.05, depth);
        const x = 240 + (col - 1) * lerp(92, 128, depth);
        const y = lerp(88, 270, depth);
        const mark = marks[n++];
        isles.push(
          <g key={`${row}${col}`} transform={`translate(${x} ${y}) scale(${s})`}>
            <path d="M-46,2 Q-30,58 0,78 Q30,58 46,2 Z" fill={url(k, "rock")} />
            <path d="M-6,70 L-4,140" stroke="#dff1ff" strokeOpacity={0.45} strokeWidth={2.5} />
            <ellipse cx={0} cy={0} rx={48} ry={14} fill={url(k, "grass")} />
            <ellipse cx={-6} cy={-3} rx={30} ry={7} fill="#9be89b" opacity={0.5} />
            {mark === "x" && <g stroke="#ffd36b" strokeWidth={6} strokeLinecap="round"><line x1={-11} y1={-30} x2={11} y2={-8} /><line x1={11} y1={-30} x2={-11} y2={-8} /></g>}
            {mark === "o" && <circle cx={0} cy={-19} r={11} fill="none" stroke="#9fe0ff" strokeWidth={6} />}
          </g>,
        );
      }
    }
    return (
      <>
        <Sky k={k} stops={[[0, "#100a2c"], [0.42, "#3a2a86"], [0.72, "#b86ad0"], [1, "#ffc0d4"]]} />
        <Stars seed={121} n={50} y1={140} />
        <Glow k={k} name="sunrise" cx={240} cy={380} r={260} color="#ffd0a0" opacity={0.6} />
        <defs>
          {vgrad(k("grass"), [[0, "#5fd17f"], [1, "#2c8a50"]])}
          {vgrad(k("rock"), [[0, "#7a5a44"], [1, "#2e1f18"]])}
        </defs>
        {[[60, 330, 120, 24], [400, 350, 130, 26], [240, 372, 200, 30]].map(([x, y, rx, ry], i) => <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill="#fff3fa" opacity={0.55} />)}
        <g>{isles}</g>
        <Motes seed={122} n={36} color="#fff2fb" size={1.1} opacity={0.55} />
        <Vignette k={k} strength={0.5} />
      </>
    );
  },

  // ─── IRON TIDE ────────────────────────────────────────────────────────────
  seabattle: (k) => {
    const waves: ReactNode[] = [];
    const r = rng(131);
    for (let i = 0; i < 9; i++) {
      const y = 262 + i * 16;
      let d = `M-10,${y}`;
      for (let x = -10; x <= W + 20; x += 30) d += ` Q${x + 15},${y - 6 - r() * 6} ${x + 30},${y}`;
      waves.push(<path key={i} d={`${d} L${W + 20},${H + 10} L-10,${H + 10} Z`} fill={i % 2 ? "#0b2a40" : "#0e3450"} opacity={0.95} />);
      waves.push(<path key={`f${i}`} d={d} fill="none" stroke="#9fd6ff" strokeOpacity={0.12 + i * 0.03} strokeWidth={1.2} />);
    }
    return (
      <>
        <Sky k={k} stops={[[0, "#02050c"], [0.55, "#0b1f36"], [0.66, "#173a5c"], [1, "#071624"]]} />
        <Stars seed={132} n={40} y1={150} />
        <polyline points="70,-5 92,58 76,64 104,132 88,136 118,206" fill="none" stroke="#dff1ff" strokeWidth={8} strokeOpacity={0.2} strokeLinejoin="round" />
        <polyline points="70,-5 92,58 76,64 104,132 88,136 118,206" fill="none" stroke="#ffffff" strokeWidth={2} strokeLinejoin="round" />
        <Glow k={k} name="flash" cx={90} cy={90} r={150} color="#bfe2ff" opacity={0.3} />
        <defs>
          {vgrad(k("beam"), [[0, "#e8f6ff", 0.45], [1, "#e8f6ff", 0]], 0, 1, 0, 0)}
          {vgrad(k("hull"), [[0, "#1a2a3c"], [1, "#05090f"]])}
        </defs>
        <path d="M272,206 L388,-10 L470,-10 L286,212 Z" fill={url(k, "beam")} />
        <path d="M236,204 L150,-10 L96,-10 L224,210 Z" fill={url(k, "beam")} opacity={0.7} />
        <Glow k={k} name="lamp" cx={262} cy={200} r={60} color="#e8f6ff" opacity={0.55} />
        <g transform="translate(240 262) scale(1.18) translate(-240 -262)">
          <path d="M108,262 L372,262 L352,292 L132,292 Z" fill={url(k, "hull")} />
          <path d="M150,262 L176,236 L222,236 L232,212 L262,212 L268,196 L282,196 L288,236 L330,236 L346,262 Z" fill="#0d1622" />
          <rect x={268} y={150} width={4} height={50} fill="#0d1622" />
          <rect x={256} y={168} width={28} height={3} fill="#0d1622" />
          <rect x={186} y={228} width={30} height={8} fill="#0d1622" />
          <rect x={210} y={230} width={34} height={3} fill="#0d1622" />
          <rect x={300} y={228} width={30} height={8} fill="#0d1622" />
          <rect x={276} y={230} width={34} height={3} fill="#0d1622" />
          <path d="M108,262 L372,262" stroke="#9fd6ff" strokeOpacity={0.45} strokeWidth={1.5} />
          {[190, 210, 230, 250, 290, 310].map((x) => <circle key={x} cx={x} cy={272} r={2} fill="#ffd36b" opacity={0.85} />)}
        </g>
        <g>{waves}</g>
        <Glow k={k} name="blast" cx={392} cy={262} r={70} color="#ff8a3d" opacity={0.7} />
        <path d="M378,268 Q382,214 392,200 Q402,214 406,268 Z" fill="#dff1ff" opacity={0.75} />
        <path d="M366,270 Q370,236 378,226 Q384,240 384,270 Z M400,270 Q404,232 412,222 Q418,238 416,270 Z" fill="#dff1ff" opacity={0.5} />
        <Motes seed={133} n={30} y0={180} y1={300} color="#ffcf9a" size={1.1} opacity={0.6} />
        <Vignette k={k} strength={0.7} />
      </>
    );
  },

  // ─── CIPHER ───────────────────────────────────────────────────────────────
  codebreaker: (k) => {
    const traces: ReactNode[] = [];
    const r = rng(141);
    for (let i = 0; i < 18; i++) {
      const x = r() * W, y = r() * H;
      const dx = (r() > 0.5 ? 1 : -1) * (30 + r() * 80);
      const dy = (r() > 0.5 ? 1 : -1) * (20 + r() * 40);
      traces.push(<path key={i} d={`M${x},${y} L${x + dx},${y} L${x + dx + dy * 0.6},${y + dy}`} fill="none" stroke="#3dff9c" strokeOpacity={0.16} strokeWidth={1.4} />);
      traces.push(<circle key={`n${i}`} cx={x + dx + dy * 0.6} cy={y + dy} r={2.4} fill="#3dff9c" opacity={0.35} />);
    }
    const ticks: ReactNode[] = [];
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const r1 = i % 5 === 0 ? 108 : 113;
      ticks.push(<line key={i} x1={240 + Math.cos(a) * r1} y1={172 + Math.sin(a) * r1} x2={240 + Math.cos(a) * 120} y2={172 + Math.sin(a) * 120} stroke="#7dffbd" strokeOpacity={i % 5 === 0 ? 0.9 : 0.4} strokeWidth={i % 5 === 0 ? 2 : 1} />);
    }
    const pegs = ["#ff4d6a", "#3d8bff", "#ffd13d", "#b56bff"];
    return (
      <>
        <Sky k={k} stops={[[0, "#010605"], [0.6, "#03261d"], [1, "#010a07"]]} />
        <g>{traces}</g>
        <Glow k={k} name="back" cx={240} cy={172} r={200} color="#2dff94" opacity={0.25} />
        <defs>{rgrad(k("dial"), [[0, "#0e3d2c"], [1, "#03130d"]], 0.45, 0.4, 0.7)}</defs>
        <circle cx={240} cy={172} r={124} fill="#020c08" stroke="#3dff9c" strokeOpacity={0.6} strokeWidth={2} />
        <g>{ticks}</g>
        <circle cx={240} cy={172} r={100} fill={url(k, "dial")} />
        <circle cx={240} cy={172} r={76} fill="none" stroke="#3dff9c" strokeOpacity={0.35} strokeWidth={14} />
        {pegs.map((c, i) => {
          const a = (-90 + i * 90 + 45) * (Math.PI / 180);
          const x = 240 + Math.cos(a) * 76, y = 172 + Math.sin(a) * 76;
          return (
            <g key={c}>
              <Glow k={k} name={`peg${i}`} cx={x} cy={y} r={26} color={c} opacity={0.6} />
              <circle cx={x} cy={y} r={12} fill={c} />
              <circle cx={x - 3.5} cy={y - 4} r={3.5} fill="#fff" opacity={0.7} />
            </g>
          );
        })}
        <Glow k={k} name="core" cx={240} cy={172} r={44} color="#7dffbd" opacity={0.6} />
        <path d="M240,148 a12,12 0 0 1 8,21 L252,196 L228,196 L232,169 a12,12 0 0 1 8,-21 Z" fill="#021009" stroke="#bfffdc" strokeWidth={2} />
        <text x={240} y={330} textAnchor="middle" fontFamily="Teko, sans-serif" fontWeight={600} fontSize={22} fill="#3dff9c" fillOpacity={0.35} letterSpacing={6}>4 7 1 9 · 0 3 8 2</text>
        <Vignette k={k} strength={0.7} />
      </>
    );
  },

  // ─── MONOLITH ─────────────────────────────────────────────────────────────
  nim: (k) => {
    const piles: ReactNode[] = [];
    const r = rng(151);
    [[96, 312, 6], [150, 330, 4], [338, 322, 5], [392, 338, 7], [60, 350, 3]].forEach(([x, y, n], p) => {
      for (let i = 0; i < n; i++) {
        const sx = x + (r() - 0.5) * 34, sy = y - (i % 3) * 7 + (r() - 0.5) * 6;
        piles.push(<ellipse key={`${p}-${i}`} cx={sx} cy={sy} rx={9 + r() * 5} ry={6 + r() * 2} fill={url(k, "pebble")} />);
      }
    });
    return (
      <>
        <Sky k={k} stops={[[0, "#02040b"], [0.55, "#0b1730"], [0.75, "#162a46"], [1, "#05080f"]]} />
        <Stars seed={152} n={120} y1={260} />
        <defs>
          {vgrad(k("aurA"), [[0, "#3dffb4", 0], [0.75, "#3dffb4", 0.32], [1, "#b8ffe4", 0.55]])}
          {vgrad(k("aurB"), [[0, "#8a6bff", 0], [0.75, "#8a6bff", 0.28], [1, "#d6c8ff", 0.45]])}
          {hgrad(k("slab"), [[0, "#12151c"], [0.5, "#2a2f3a"], [0.85, "#4a5262"], [1, "#1a1d24"]])}
          {rgrad(k("pebble"), [[0, "#8a93a6"], [1, "#2a2f3a"]], 0.4, 0.3, 0.8)}
        </defs>
        {[0, 1, 2, 3, 4].map((i) => {
          const base = 120 + i * 16, amp = 18 + i * 4, ph = i * 1.3;
          const pts = Array.from({ length: 13 }, (_, j) => { const x = -20 + j * 43; return [x, base + Math.sin(j * 0.7 + ph) * amp] as const; });
          const top = pts.map(([x, y]) => `${x},${(y - 70 - i * 6).toFixed(1)}`).join(" L");
          const bottom = pts.slice().reverse().map(([x, y]) => `${x},${y.toFixed(1)}`).join(" L");
          return <path key={i} d={`M${top} L${bottom} Z`} fill={url(k, i % 2 ? "aurB" : "aurA")} opacity={0.75 - i * 0.1} />;
        })}
        <Ridge seed={153} y={292} amp={18} color="#0a1222" />
        <defs>{vgrad(k("ground"), [[0, "#0f1828"], [1, "#04060b"]])}</defs>
        <rect x={0} y={296} width={W} height={110} fill={url(k, "ground")} />
        <Fog k={k} name="mist" y={270} h={60} color="#6fa8ff" opacity={0.2} />
        <ellipse cx={240} cy={322} rx={70} ry={10} fill="#000" opacity={0.6} />
        <path d="M212,320 L216,84 L264,76 L270,320 Z" fill={url(k, "slab")} />
        <path d="M264,76 L270,320 L262,320 L258,82 Z" fill="#8fb8ff" opacity={0.25} />
        <Glow k={k} name="orbGlow" cx={240} cy={62} r={80} color="#9fe8ff" opacity={0.75} />
        <circle cx={240} cy={62} r={15} fill="#e6fbff" />
        {piles}
        <Motes seed={154} n={24} y0={40} y1={200} color="#bff8ff" size={1} opacity={0.6} />
        <Vignette k={k} strength={0.7} />
      </>
    );
  },

  // ─── ARCANE FIFTEEN ───────────────────────────────────────────────────────
  fifteen: (k) => {
    const nums = [2, 7, 6, 9, 5, 1, 4, 3, 8];
    const lit = new Set([1, 4, 7]); // the middle column: 7 + 5 + 3
    const runes: ReactNode[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      runes.push(<line key={i} x1={240 + Math.cos(a) * 150} y1={312 + Math.sin(a) * 34} x2={240 + Math.cos(a) * 162} y2={312 + Math.sin(a) * 37} stroke="#d6a8ff" strokeWidth={2} strokeOpacity={0.8} />);
    }
    return (
      <>
        <Sky k={k} stops={[[0, "#060110"], [0.55, "#1e0a3c"], [1, "#0b0318"]]} />
        <Stars seed={161} n={50} y1={200} color="#e8d6ff" />
        <Glow k={k} name="back" cx={240} cy={176} r={210} color="#9b5cff" opacity={0.35} />
        <GlowEllipse k={k} name="circleGlow" cx={240} cy={312} rx={200} ry={56} color="#b57bff" opacity={0.45} />
        <ellipse cx={240} cy={312} rx={170} ry={40} fill="none" stroke="#d6a8ff" strokeWidth={2.5} strokeOpacity={0.85} />
        <ellipse cx={240} cy={312} rx={146} ry={33} fill="none" stroke="#d6a8ff" strokeWidth={1.2} strokeOpacity={0.6} strokeDasharray="4 6" />
        <g>{runes}</g>
        <defs>
          {vgrad(k("tile"), [[0, "#3a1c6e"], [1, "#160832"]])}
          {vgrad(k("tileLit"), [[0, "#7a4ad6"], [1, "#2c1066"]])}
        </defs>
        {nums.map((n, i) => {
          const x = 240 + ((i % 3) - 1) * 62, y = 92 + Math.floor(i / 3) * 62;
          const on = lit.has(i);
          return (
            <g key={i}>
              {on && <Glow k={k} name={`t${i}`} cx={x} cy={y} r={46} color="#ffd27a" opacity={0.45} />}
              <rect x={x - 27} y={y - 27} width={54} height={54} rx={8} fill={url(k, on ? "tileLit" : "tile")} stroke={on ? "#ffd27a" : "#9b6be0"} strokeWidth={on ? 2.5 : 1.2} />
              <text x={x} y={y + 13} textAnchor="middle" fontFamily="Cinzel, serif" fontWeight={900} fontSize={34} fill={on ? "#fff1c4" : "#c9a6ff"}>{n}</text>
            </g>
          );
        })}
        <Motes seed={162} n={50} y0={60} y1={330} color="#ffd27a" size={1.2} opacity={0.6} />
        <Vignette k={k} strength={0.65} />
      </>
    );
  },
};
