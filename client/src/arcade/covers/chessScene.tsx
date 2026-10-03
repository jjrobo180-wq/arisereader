// Ultimate Chess cover art. It lives in its own file because both the arcade's
// Game Room and the Worlds page show it, and the Worlds page shouldn't have to
// load every arcade cover just for this one.
import { Fog, Glow, type Ids, Motes, Rays, Sky, Vignette, floorCells, hgrad } from "./paint";

export function chessScene(k: Ids) {
  const floor = floorCells({ vpX: 240, horizon: 268, rows: 8, colW: 70, cols: [-6, 6] });
  return (
    <>
      <Sky k={k} stops={[[0, "#090604"], [0.42, "#3b2210"], [0.6, "#a8662a"], [0.67, "#ffd27a"], [0.68, "#2a1a0c"], [1, "#0d0805"]]} />
      <Glow k={k} name="sun" cx={240} cy={268} r={240} color="#ffcf73" opacity={0.6} />
      <Rays k={k} name="rays" cx={240} cy={250} n={14} spread={180} len={330} color="#ffe2a3" opacity={0.2} seed={71} angle={-90} width={0.04} />
      <g opacity={0.9}>{floor.cells.map((c) => <path key={`${c.i},${c.j}`} d={c.d} fill={(c.i + c.j) % 2 ? "#3a2614" : "#120b06"} />)}</g>
      <Fog k={k} name="fog" y={246} h={70} color="#ffcf8a" opacity={0.45} />
      <defs>{hgrad(k("rim"), [[0, "#ffd27a", 0.9], [0.18, "#ffd27a", 0], [0.82, "#ffd27a", 0], [1, "#ffd27a", 0.9]])}</defs>
      {/* pawns */}
      {[[120, 300, 0.55], [362, 306, 0.6], [180, 286, 0.42], [306, 288, 0.44]].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M-34,0 L34,0 L28,-14 L18,-18 L12,-62 L22,-70 Q24,-96 0,-100 Q-24,-96 -22,-70 L-12,-62 L-18,-18 L-28,-14 Z" fill="#0b0705" />
        </g>
      ))}
      {/* the king */}
      <g transform="translate(240 322)">
        <ellipse cx={0} cy={4} rx={86} ry={14} fill="#000" opacity={0.6} />
        <path d="M-72,0 L72,0 L64,-22 L44,-30 L34,-120 L50,-132 L50,-150 L30,-158 L44,-196 L14,-196 L14,-214 L30,-214 L30,-232 L14,-232 L14,-252 L-14,-252 L-14,-232 L-30,-232 L-30,-214 L-14,-214 L-14,-196 L-44,-196 L-30,-158 L-50,-150 L-50,-132 L-34,-120 L-44,-30 L-64,-22 Z" fill="#0c0806" stroke="#ffcf73" strokeOpacity={0.55} strokeWidth={1.6} strokeLinejoin="round" />
        <path d="M-72,0 L72,0 L64,-22 L44,-30 L34,-120 L50,-132 L50,-150 L30,-158 L44,-196 L-44,-196 L-30,-158 L-50,-150 L-50,-132 L-34,-120 L-44,-30 L-64,-22 Z" fill={`url(#${k("rim")})`} opacity={0.5} />
      </g>
      <Motes seed={72} n={40} y0={120} y1={320} color="#ffe6b0" size={1.1} opacity={0.6} />
      <Vignette k={k} strength={0.7} />
    </>
  );
}
