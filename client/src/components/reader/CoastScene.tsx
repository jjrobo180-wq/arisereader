// The scenery behind Arise Reader's "Neon Coast" theme (pages/readerCoast.css): a dusk sky, a striped
// setting sun over the water, a beach-city skyline with lit windows, and palms in the foreground.
// Drawn here from plain shapes, so it is our own art; fixed behind the page and ignored by screen readers.

/** One palm: a curved trunk and a crown of drooping fronds, all one silhouette color. */
function Palm({ x, base, height, lean, scale = 1 }: { x: number; base: number; height: number; lean: number; scale?: number }) {
  const topX = x + lean, topY = base - height;
  const trunk = `M ${x - 9 * scale} ${base} C ${x - 6 * scale} ${base - height * 0.45}, ${topX - lean * 0.2 - 5 * scale} ${topY + height * 0.25}, ${topX - 4 * scale} ${topY}
    L ${topX + 4 * scale} ${topY} C ${topX - lean * 0.2 + 5 * scale} ${topY + height * 0.25}, ${x + 6 * scale} ${base - height * 0.45}, ${x + 9 * scale} ${base} Z`;
  // Fronds: [angle in degrees, length, droop]
  const fronds: Array<[number, number, number]> = [[-170, 150, 60], [-145, 165, 70], [-115, 120, 40], [-80, 110, 30], [-50, 140, 55], [-20, 165, 75], [5, 150, 85], [-195, 130, 80]];
  return (
    <g>
      <path d={trunk} />
      {fronds.map(([a, len, droop], i) => {
        const r = (a * Math.PI) / 180, L = len * scale, D = droop * scale;
        const ex = topX + Math.cos(r) * L, ey = topY + Math.sin(r) * L + D;
        const mx = topX + Math.cos(r) * L * 0.5, my = topY + Math.sin(r) * L * 0.5 - 18 * scale;
        const w = 13 * scale;
        return <path key={i} d={`M ${topX} ${topY} Q ${mx} ${my - w} ${ex} ${ey} Q ${mx} ${my + w} ${topX} ${topY + 3 * scale} Z`} />;
      })}
    </g>
  );
}

/** Buildings along the shore: [x, width, height]. Lit windows are a fixed pattern, so it never flickers between renders. */
const TOWERS: Array<[number, number, number]> = [
  [0, 70, 210], [64, 46, 300], [104, 80, 250], [176, 38, 380], [208, 90, 290], [292, 54, 340], [340, 70, 230], [404, 44, 190],
  [442, 86, 150], [522, 60, 120], [1190, 70, 170], [1252, 52, 260], [1298, 84, 320], [1376, 64, 220],
];

export default function CoastScene() {
  const horizon = 600;
  return (
    <div className="coast-scene" aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="coast-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1e0640" />
            <stop offset="0.22" stopColor="#4d1269" />
            <stop offset="0.42" stopColor="#a8236f" />
            <stop offset="0.56" stopColor="#ff5f66" />
            <stop offset="0.67" stopColor="#ffb05a" />
          </linearGradient>
          <linearGradient id="coast-sun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff1a8" />
            <stop offset="0.45" stopColor="#ffb85c" />
            <stop offset="1" stopColor="#ff3d8b" />
          </linearGradient>
          <linearGradient id="coast-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5a1460" />
            <stop offset="0.4" stopColor="#2a0a40" />
            <stop offset="1" stopColor="#0e0419" />
          </linearGradient>
          {/* Bands cut out of the lower half of the sun, wider toward the horizon. */}
          <mask id="coast-sun-cut">
            <rect x="0" y="0" width="1440" height="900" fill="#fff" />
            {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x="0" y={482 + i * 22} width="1440" height={3 + i * 2.2} fill="#000" />)}
          </mask>
          <radialGradient id="coast-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ff7a6b" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ff7a6b" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="1440" height="900" fill="url(#coast-sky)" />
        {/* A few early stars up high. */}
        {[[120, 60], [260, 120], [420, 40], [610, 90], [760, 30], [1130, 70], [1290, 40], [1380, 130], [900, 110], [40, 180]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 1.6 : 1} fill="#ffe3f3" opacity={0.7} />
        ))}
        {/* Long, thin sunset clouds. */}
        <g fill="#ff8fb8" opacity="0.35">
          <ellipse cx="300" cy="300" rx="260" ry="7" /><ellipse cx="420" cy="322" rx="170" ry="5" />
          <ellipse cx="1180" cy="270" rx="230" ry="6" /><ellipse cx="1060" cy="292" rx="140" ry="4" />
        </g>

        <circle cx="900" cy={horizon - 40} r="300" fill="url(#coast-glow)" />
        <g className="coast-sun">
          <circle cx="900" cy={horizon - 60} r="165" fill="url(#coast-sun)" mask="url(#coast-sun-cut)" />
        </g>

        {/* The skyline on the shore, with a neon edge on the tallest roofs. */}
        <g>
          {TOWERS.map(([x, w, h], i) => (
            <g key={i}>
              <rect x={x} y={horizon - h} width={w} height={h} fill={i % 2 ? "#26093a" : "#1d072e"} />
              {Array.from({ length: Math.floor(h / 26) }, (_, row) => Array.from({ length: Math.max(1, Math.floor(w / 18)) }, (_, col) => {
                const lit = (row * 7 + col * 3 + i * 5) % 5 === 0;
                return lit ? <rect key={`${row}-${col}`} x={x + 6 + col * 18} y={horizon - h + 12 + row * 26} width="7" height="9" fill={(row + col + i) % 3 ? "#ffcf7a" : "#2ee6d6"} opacity="0.85" /> : null;
              }))}
              {h > 280 && <rect x={x} y={horizon - h} width={w} height="3" fill={i % 3 ? "#ff3d8b" : "#2ee6d6"} />}
            </g>
          ))}
        </g>

        {/* The water, the sun's reflection and a bright shoreline. */}
        <rect x="0" y={horizon} width="1440" height={900 - horizon} fill="url(#coast-sea)" />
        <rect x="0" y={horizon} width="1440" height="2" fill="#ff9a8a" opacity="0.7" />
        <g fill="#ffb878">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect key={i} x={900 - (150 - i * 14) + (i % 2) * 10} y={horizon + 12 + i * 16} width={(150 - i * 14) * 2} height="3" rx="1.5" opacity={0.7 - i * 0.07} />
          ))}
        </g>

        {/* Palms in the foreground. */}
        <g className="coast-palms" fill="#0b0215">
          <Palm x={1290} base={900} height={430} lean={-70} scale={1.15} />
          <Palm x={1400} base={900} height={330} lean={-30} scale={0.9} />
          <Palm x={110} base={900} height={380} lean={60} scale={1} />
        </g>
      </svg>
    </div>
  );
}
