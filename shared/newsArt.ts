// Original flat illustrations for Arise News stories, drawn as SVG markup.
// Every scene is 1600×900 with its subject in the middle 600 px, so the same
// art works as a wide article hero and, cropped, as a tall library cover.
import { NEWS_ISSUE, SECTION_COLORS, type NewsArticle } from "./ariseNews";

const W = 1600, H = 900;

function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const f = (n: number) => Math.round(n * 10) / 10;
const poly = (pts: [number, number][], fill: string, extra = "") => `<polygon points="${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(" ")}" fill="${fill}" ${extra}/>`;
const circle = (x: number, y: number, r: number, fill: string, extra = "") => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" ${extra}/>`;
const rect = (x: number, y: number, w: number, h: number, fill: string, extra = "") => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" ${extra}/>`;
const path = (d: string, fill: string, extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`;
const stars = (seed: number, n: number, color = "#fff", maxY = H * 0.6) => {
  const r = rand(seed); let out = "";
  for (let i = 0; i < n; i++) out += circle(r() * W, r() * maxY, 1 + r() * 2.6, color, `opacity="${f(0.4 + r() * 0.6)}"`);
  return out;
};
const sparkle = (x: number, y: number, s: number, fill: string) => path(`M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`, fill);
const leaf = (x: number, y: number, s: number, rot: number, fill: string) => `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})">${path("M0 -40C26 -26 30 14 0 40C-30 14 -26 -26 0 -40Z", fill)}<path d="M0 -36V38" stroke="rgba(0,0,0,.25)" stroke-width="3" fill="none"/></g>`;

type Scene = (c: { ink: string; tint: string; deep: string }) => string;

const SCENES: Record<string, Scene> = {
  "asian-games-2026-close": (c) => {
    let s = rect(0, 0, W, H, "#0d1b3d") + stars(31, 60, "#fff", H * 0.4);
    // fireworks over a stadium
    const r = rand(44);
    for (const [x, y, col] of [[480, 200, "#ff6b6b"], [800, 140, "#ffd43b"], [1120, 210, "#63e6be"], [640, 320, "#74c0fc"], [980, 330, "#f783ac"]] as [number, number, string][]) {
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, l = 60 + r() * 50; s += path(`M${x} ${y}L${f(x + Math.cos(a) * l)} ${f(y + Math.sin(a) * l)}`, "none", `stroke="${col}" stroke-width="6" stroke-linecap="round"`); }
      s += circle(x, y, 10, "#fff");
    }
    s += path("M200 900V600Q800 440 1400 600V900Z", "#1f2a52") + path("M260 900V640Q800 500 1340 640V900Z", "#2c3a6b");
    for (let i = 0; i < 10; i++) s += rect(300 + i * 104, 620 - Math.sin((i / 9) * Math.PI) * 60, 60, 14, "#ffe8a3", 'opacity=".8"');
    s += path("M560 900L800 700L1040 900Z", "#3f9142");
    // a medal
    s += path("M760 470L740 380H780L800 440L820 380H860L840 470Z", "#e03131") + circle(800, 520, 60, "#ffd43b") + circle(800, 520, 42, "#f2b705");
    return s;
  },

  "saturn-opposition-2026": (c) => {
    let s = rect(0, 0, W, H, "#060818") + stars(77, 260, "#fff", H);
    s += `<defs><radialGradient id="sat" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ffe9b8"/><stop offset=".7" stop-color="#e3b66c"/><stop offset="1" stop-color="#a87a3a"/></radialGradient></defs>`;
    s += `<g transform="translate(800 450) rotate(-8)">`;
    s += `<ellipse cx="0" cy="0" rx="430" ry="56" fill="none" stroke="#d9c39a" stroke-width="34" opacity=".55"/>`;
    s += `<ellipse cx="0" cy="0" rx="360" ry="44" fill="none" stroke="#f1e2c0" stroke-width="22" opacity=".7"/>`;
    s += circle(0, 0, 200, "url(#sat)");
    for (let i = -3; i <= 3; i++) s += rect(-200, i * 46 - 6, 400, 12, "#c99a54", 'opacity=".35"');
    s += path("M-430 0A430 56 0 0 0 430 0", "none", 'stroke="#f1e2c0" stroke-width="22" opacity=".8"');
    s += `</g>`;
    s += circle(1270, 330, 9, "#ffd8a8") + circle(330, 600, 6, "#d0ebff");
    return s;
  },

  "artemis-iii-rocket-stacking": (c) => {
    let s = rect(0, 0, W, H, "#dfe7f2") + rect(0, 720, W, 180, "#9aa5b4");
    // the assembly building's open bay
    s += rect(420, 40, 760, 700, "#c3ccd8") + rect(470, 80, 660, 660, "#e9eef5");
    for (let y = 120; y < 720; y += 80) s += rect(470, y, 660, 6, "#b4bfcc");
    // two boosters with nose cones
    for (const x of [640, 960]) {
      s += rect(x - 46, 210, 92, 510, "#f8f9fa") + path(`M${x - 46} 210L${x} 120L${x + 46} 210Z`, "#f8f9fa");
      for (let k = 0; k < 5; k++) s += rect(x - 46, 260 + k * 92, 92, 6, "#adb5bd");
      s += rect(x - 46, 690, 92, 30, "#495057") + path(`M${x - 40} 720L${x - 56} 760H${x + 56}L${x + 40} 720Z`, "#343a40");
    }
    // the platform and a person for scale
    s += rect(500, 760, 600, 24, "#495057");
    s += circle(1180, 680, 10, "#343a40") + rect(1174, 690, 12, 32, "#ff922b");
    return s;
  },

  "comedy-wildlife-2026": (c) => {
    let s = rect(0, 0, W, H, "#fff3d6") + circle(1300, 160, 90, "#ffe066");
    s += path("M0 700Q400 620 800 690T1600 660V900H0Z", "#9bc46b");
    // a moose mid-sneeze
    s += `<g transform="translate(760 520)">`;
    s += `<ellipse cx="0" cy="40" rx="190" ry="110" fill="#7a4e2d"/>`;
    for (const x of [-120, -60, 80, 140]) s += rect(x, 120, 30, 170, "#6a4226");
    s += path("M150 -20Q230 -60 300 -10Q330 30 300 70Q240 90 190 50Z", "#7a4e2d");
    s += circle(290, 40, 10, "#3b2414") + circle(250, -10, 9, "#1b1b1b");
    s += path("M190 -40Q160 -150 90 -170Q140 -120 120 -90Q80 -160 30 -150Q90 -110 160 -50Z", "#c9a46a");
    s += path("M240 -50Q280 -160 360 -170Q310 -120 330 -90Q370 -160 420 -150Q360 -110 280 -45Z", "#c9a46a");
    s += `</g>`;
    // sneeze puff
    for (const [x, y, rr] of [[1100, 540, 30], [1150, 500, 22], [1190, 560, 18], [1140, 580, 14], [1220, 520, 12]]) s += circle(x, y, rr, "#ffffff", 'opacity=".9"');
    s += path("M1060 470l40 -40M1080 600l50 30M1240 470l30 -50", "none", 'stroke="#555" stroke-width="6" stroke-linecap="round"');
    return s;
  },

  "new-stick-insects": (c) => {
    let s = rect(0, 0, W, H, "#e3f2d7");
    const r = rand(12);
    for (let i = 0; i < 22; i++) s += leaf(100 + r() * 1400, 100 + r() * 700, 1 + r() * 1.4, r() * 360, i % 2 ? "#74b84d" : "#4f9a35");
    s += path("M120 520Q600 480 1500 380", "none", 'stroke="#7a5a3a" stroke-width="26" stroke-linecap="round"');
    // the stick insect along the branch
    s += `<g transform="translate(820 440) rotate(-7)">`;
    s += rect(-300, -9, 560, 18, "#8c6a43", 'rx="9"') + `<ellipse cx="290" cy="0" rx="34" ry="12" fill="#8c6a43"/>`;
    for (const [x, d] of [[-160, 1], [-40, 1], [100, 1], [-160, -1], [-40, -1], [100, -1]] as [number, number][]) s += path(`M${x} 0L${x + 30} ${d * 70}L${x - 10} ${d * 140}`, "none", 'stroke="#8c6a43" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"');
    s += path("M320 -6L430 -60M320 6L440 30", "none", 'stroke="#8c6a43" stroke-width="5" stroke-linecap="round"');
    s += `</g>`;
    // an egg with a tiny lid
    s += `<ellipse cx="1260" cy="700" rx="40" ry="56" fill="#b08968"/>` + `<ellipse cx="1260" cy="652" rx="26" ry="10" fill="#7f5539"/>` + rect(1252, 634, 16, 12, "#7f5539", 'rx="4"');
    return s;
  },

  "libraries-on-the-move": (c) => {
    let s = rect(0, 0, W, H, "#ffd9a8") + circle(800, 330, 210, "#ffb347") + circle(800, 330, 150, "#ffcf6e");
    s += path(`M0 610Q400 520 800 600T1600 580V900H0Z`, "#f2b36b") + path(`M0 700Q500 610 1000 690T1600 670V900H0Z`, "#e59a4f") + path(`M0 800Q600 740 1600 790V900H0Z`, "#d4843c");
    // camel walking left to right
    const camel = "#8a5a2b", shade = "#6e4520";
    s += `<g transform="translate(560 410)">`;
    for (const [x, sh] of [[90, shade], [140, camel], [300, shade], [350, camel]] as const) s += rect(x, 190, 26, 200, sh, 'rx="10"');
    s += path("M60 120Q80 40 170 60Q210 0 260 60Q300 30 340 70Q420 80 420 160Q420 220 340 225H110Q40 220 60 120Z", camel);
    s += path("M400 120Q470 60 470 -20L500 -40Q540 -40 560 -10L590 10Q600 30 570 40L520 30Q510 90 450 170Z", camel);
    s += circle(530, -12, 7, "#2b1a0b");
    // saddle bags full of books
    s += rect(150, 70, 180, 100, "#c8432b", 'rx="14"') + rect(165, 20, 40, 70, "#2d6cdf", 'rx="4"') + rect(210, 8, 34, 82, "#f2c230", 'rx="4"') + rect(249, 26, 44, 64, "#2f9e44", 'rx="4"') + rect(296, 14, 26, 76, "#7048e8", 'rx="4"');
    s += rect(150, 104, 180, 12, "#f6e3c4");
    s += `</g>`;
    // books fluttering like birds
    const r = rand(11);
    for (let i = 0; i < 7; i++) {
      const x = 180 + i * 200 + r() * 60, y = 90 + r() * 160, col = ["#2d6cdf", "#c8432b", "#7048e8", "#2f9e44"][i % 4];
      s += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(-15 + r() * 30)})">${path("M0 0L-46 -14V22L0 36Z", col)}${path("M0 0L46 -14V22L0 36Z", col, 'opacity=".8"')}${path("M0 2L-38 -8V16L0 28Z", "#fff8ea")}${path("M0 2L38 -8V16L0 28Z", "#fff1d8")}</g>`;
    }
    return s;
  },

  "crew-13-record-trip": (c) => {
    let s = rect(0, 0, W, H, "#070b24") + stars(61, 220, "#fff", H * 0.75);
    s += `<defs><radialGradient id="earth" cx=".5" cy=".1" r=".9"><stop offset="0" stop-color="#5ab0ff"/><stop offset=".55" stop-color="#1c5fd1"/><stop offset="1" stop-color="#0a2a6e"/></radialGradient></defs>`;
    s += circle(800, 2150, 1500, "#7cc4ff", 'opacity=".25"') + circle(800, 2160, 1480, "url(#earth)");
    const r = rand(8);
    for (let i = 0; i < 9; i++) s += `<ellipse cx="${f(150 + r() * 1300)}" cy="${f(720 + r() * 120)}" rx="${f(80 + r() * 140)}" ry="${f(10 + r() * 14)}" fill="#fff" opacity=".55"/>`;
    // the station: a long truss, solar wings and modules
    s += `<g transform="translate(860 330) rotate(-6)">`;
    s += rect(-380, -8, 760, 16, "#c9ced8");
    for (const x of [-360, -270, 190, 280]) for (const y of [-150, 20]) { s += rect(x, y, 80, 130, "#c58a16") ; for (let k = 1; k < 4; k++) s += rect(x, y + k * 32, 80, 3, "#7a520a"); s += rect(x + 38, y, 3, 130, "#7a520a"); }
    for (const x of [-320, -230, 230, 320]) s += rect(x - 2, -150, 4, 300, "#9aa3b5");
    s += rect(-120, -30, 240, 60, "#e9ecf2", 'rx="26"') + rect(-30, -90, 60, 180, "#dfe3ea", 'rx="26"') + rect(-200, -22, 90, 44, "#d3d8e2", 'rx="20"') + rect(110, -22, 90, 44, "#d3d8e2", 'rx="20"');
    s += circle(0, 0, 18, "#9aa3b5") + `</g>`;
    // the capsule on approach
    s += `<g transform="translate(420 470) rotate(18)">${path("M0 -70L60 -20V60H-60V-20Z", "#f4f6fa")}${rect(-60, 60, 120, 70, "#2b2f3a", 'rx="6"')}${rect(-36, -10, 72, 22, "#1b2030", 'rx="8"')}${circle(-24, 1, 6, "#7cc4ff")}${circle(0, 1, 6, "#7cc4ff")}${circle(24, 1, 6, "#7cc4ff")}${path("M-30 130Q0 230 30 130Z", "#ffb347", 'opacity=".75"')}</g>`;
    s += path("M500 420Q640 330 780 320", "none", 'stroke="#fff" stroke-width="5" stroke-dasharray="3 16" stroke-linecap="round" opacity=".7"');
    return s;
  },

  "new-wild-cat-tilcayo": (c) => {
    let s = `<defs><linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8efe4"/><stop offset="1" stop-color="#8fc7a8"/></linearGradient></defs>` + rect(0, 0, W, H, "url(#mist)");
    s += poly([[0, 520], [220, 300], [430, 470], [700, 250], [980, 460], [1220, 280], [1600, 480], [1600, 900], [0, 900]], "#6aa886", 'opacity=".55"');
    s += `<rect x="0" y="420" width="1600" height="90" fill="#fff" opacity=".45"/>`;
    s += poly([[0, 700], [260, 520], [520, 660], [820, 500], [1120, 660], [1400, 540], [1600, 640], [1600, 900], [0, 900]], "#3f8a5f");
    s += `<rect x="0" y="640" width="1600" height="70" fill="#fff" opacity=".35"/>`;
    // ferns
    const fern = (x: number, y: number, sc: number, flip: number) => { let g = `<g transform="translate(${x} ${y}) scale(${sc * flip} ${sc})">` + path("M0 0Q40 -120 140 -200", "none", 'stroke="#2f7a4a" stroke-width="8"'); for (let i = 1; i < 9; i++) { const t = i / 9, px = 140 * t * t + 40 * 2 * t * (1 - t), py = -200 * t * t - 120 * 2 * t * (1 - t); g += `<ellipse cx="${f(px)}" cy="${f(py)}" rx="34" ry="10" transform="rotate(${f(-40 + t * 20)} ${f(px)} ${f(py)})" fill="#3d9a5c"/>`; } return g + "</g>"; };
    s += fern(80, 900, 1.6, 1) + fern(1520, 900, 1.6, -1) + fern(260, 900, 1.1, 1);
    // mossy branch
    s += path("M180 640Q800 560 1440 600L1440 640Q800 610 180 690Z", "#6b4a2b") + path("M260 650Q800 575 1380 605", "none", 'stroke="#7fbf5f" stroke-width="16" stroke-linecap="round" opacity=".9"');
    // the cat sitting on the branch
    const fur = "#c99a63", dark = "#5a3a1c";
    s += `<g transform="translate(800 470)">`;
    s += path("M70 120Q170 170 150 300Q146 330 128 320Q132 220 60 150Z", fur);
    for (let i = 0; i < 4; i++) s += path(`M${118 + i * 8} ${190 + i * 34}q16 -4 26 4`, "none", `stroke="${dark}" stroke-width="9" stroke-linecap="round"`);
    s += `<ellipse cx="0" cy="80" rx="110" ry="90" fill="${fur}"/>`;
    for (const [x, y, rr] of [[-50, 60, 16], [10, 40, 18], [60, 80, 15], [-20, 110, 17], [40, 130, 13], [-70, 110, 12]] as const) s += circle(x, y, rr, "none", `stroke="${dark}" stroke-width="7"`) + circle(x, y, rr * 0.45, "#a87a46");
    s += poly([[-70, -110], [-40, -175], [-10, -110]], fur) + poly([[10, -110], [40, -175], [70, -110]], fur) + poly([[-56, -118], [-40, -152], [-24, -118]], "#e7b48a") + poly([[24, -118], [40, -152], [56, -118]], "#e7b48a");
    s += circle(0, -60, 82, fur) + `<ellipse cx="0" cy="-30" rx="44" ry="30" fill="#f2dcc0"/>`;
    s += circle(-30, -70, 20, "#f6e7a6") + circle(30, -70, 20, "#f6e7a6") + `<ellipse cx="-30" cy="-70" rx="6" ry="15" fill="#1c1208"/><ellipse cx="30" cy="-70" rx="6" ry="15" fill="#1c1208"/>`;
    s += poly([[-9, -42], [9, -42], [0, -32]], "#d27a6a") + path("M-60 -36H-110M-60 -28H-108M60 -36H110M60 -28H108", "none", 'stroke="#fff" stroke-width="3" opacity=".8"');
    s += path("M-36 -118q10 -16 0 -30M0 -126q0 -18 0 -30M36 -118q-10 -16 0 -30", "none", `stroke="${dark}" stroke-width="6" stroke-linecap="round"`);
    s += `</g>`;
    return s;
  },

  "new-sea-spiders": (c) => {
    let s = `<defs><linearGradient id="deep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b7f86"/><stop offset="1" stop-color="#062f3d"/></linearGradient></defs>` + rect(0, 0, W, H, "url(#deep)");
    const r = rand(12);
    for (let i = 0; i < 30; i++) s += circle(r() * W, r() * H, 3 + r() * 10, "none", `stroke="#bff3f0" stroke-width="2.5" opacity="${f(0.2 + r() * 0.5)}"`);
    for (const x of [120, 230, 1380, 1500]) s += path(`M${x} ${H}C${x - 50} 720 ${x + 70} 600 ${x - 10} 470C${x + 40} 600 ${x - 10} 740 ${x + 40} ${H}Z`, "#2c8a5a", 'opacity=".85"');
    s += path("M0 820Q300 760 620 800T1200 790T1600 810V900H0Z", "#0b3b44") + `<ellipse cx="560" cy="815" rx="190" ry="40" fill="#165561"/><ellipse cx="1120" cy="800" rx="150" ry="34" fill="#165561"/>`;
    const spider = (x: number, y: number, sc: number, col: string, spines: boolean) => {
      let g = `<g transform="translate(${x} ${y}) scale(${sc})">`;
      const legs: [number, number, number, number][] = [[-1, -60, -230, -150], [-1, -20, -260, -30], [-1, 20, -250, 110], [-1, 60, -200, 220], [1, -60, 230, -150], [1, -20, 260, -30], [1, 20, 250, 110], [1, 60, 200, 220]];
      for (const [side, y0, x2, y2] of legs) {
        const kx = side * 110, ky = y0 - 90;
        g += path(`M${side * 14} ${y0 / 2}L${kx} ${ky}L${x2} ${y2}`, "none", `stroke="${col}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"`);
        g += circle(kx, ky, 9, col);
        if (spines) for (let t = 0.45; t < 1; t += 0.12) { const px = kx + (x2 - kx) * t, py = ky + (y2 - ky) * t; g += path(`M${f(px)} ${f(py)}l${side * 14} -16`, "none", `stroke="${col}" stroke-width="4" stroke-linecap="round"`); }
      }
      g += `<ellipse cx="0" cy="0" rx="20" ry="70" fill="${col}"/>` + path("M-10 -70L0 -120L10 -70Z", col) + circle(-8, -54, 6, "#e03131") + circle(8, -54, 6, "#e03131");
      return g + "</g>";
    };
    s += spider(800, 420, 1.2, "#f1c7a6", true) + spider(1240, 300, 0.55, "#d9b48f", false);
    return s;
  },

  "berlin-marathon-2026": (c) => {
    let s = `<defs><linearGradient id="dawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd6a5"/><stop offset="1" stop-color="#fff1e0"/></linearGradient></defs>` + rect(0, 0, W, H, "url(#dawn)") + circle(1260, 170, 80, "#ffe8a3");
    // a city gate with columns in the distance
    const gate = "#c9a77c";
    s += rect(500, 210, 600, 50, gate) + rect(470, 260, 660, 26, gate);
    for (let i = 0; i < 6; i++) s += rect(500 + i * 112, 286, 38, 250, gate);
    s += rect(470, 536, 660, 22, gate) + rect(700, 170, 200, 40, gate);
    // the road and crowd barriers
    s += poly([[0, 900], [640, 560], [960, 560], [1600, 900]], "#4a4e5c") + poly([[780, 560], [820, 560], [860, 900], [740, 900]], "#fff", 'opacity=".75"');
    for (const side of [-1, 1]) for (let i = 0; i < 6; i++) { const t = i / 6, x = 800 + side * (170 + t * 640), y = 560 + t * 340; s += rect(x - 30 * (1 + t), y - 26 * (1 + t), 60 * (1 + t), 26 * (1 + t), i % 2 ? "#2d6cdf" : "#ffffff"); }
    // runners
    const runner = (x: number, y: number, sc: number, shirt: string, flip = 1) => `<g transform="translate(${x} ${y}) scale(${sc * flip} ${sc})" stroke-linecap="round" stroke-linejoin="round">${path("M0 -40L-30 30L-10 90", "none", 'stroke="#3a2a1e" stroke-width="18"')}${path("M0 -40L30 20L70 50", "none", 'stroke="#3a2a1e" stroke-width="18"')}${path("M0 -120L0 -40", "none", `stroke="${shirt}" stroke-width="44"`)}${path("M0 -110L-40 -70L-20 -40", "none", 'stroke="#3a2a1e" stroke-width="14"')}${path("M0 -110L40 -90L60 -120", "none", 'stroke="#3a2a1e" stroke-width="14"')}${circle(0, -150, 22, "#3a2a1e")}</g>`;
    s += runner(640, 760, 1.4, "#e03131") + runner(880, 720, 1.2, "#2f9e44", -1) + runner(1040, 800, 1.6, "#f59f00") + runner(500, 680, 0.9, "#7048e8", -1) + runner(1180, 690, 0.9, "#0c7fd6");
    return s;
  },

  "spain-wins-world-cup": (c) => {
    let s = rect(0, 0, W, H, "#0b1430");
    // floodlights and stands
    for (const x of [140, 1460]) { s += rect(x - 6, 40, 12, 260, "#4a5268") + rect(x - 60, 20, 120, 50, "#e9ecf2", 'rx="6"') + circle(x, 45, 160, "#fff6c9", 'opacity=".12"'); }
    s += path("M0 420Q800 250 1600 420V520H0Z", "#1d2850") + path("M0 470Q800 320 1600 470V540H0Z", "#273466");
    const r = rand(19);
    for (let i = 0; i < 420; i++) { const x = r() * W, t = x / W, top = 420 - Math.sin(t * Math.PI) * 160; s += circle(x, top + 10 + r() * 100, 3, ["#ffd43b", "#e03131", "#ffffff", "#74c0fc"][i % 4], 'opacity=".75"'); }
    // pitch
    s += poly([[0, 900], [0, 560], [1600, 560], [1600, 900]], "#2f9e44");
    for (let i = 0; i < 7; i++) s += poly([[i * 240 - 120, 900], [i * 240, 900], [500 + i * 100, 560], [460 + i * 100, 560]], "#37b24d");
    s += path("M200 900L560 560H1040L1400 900", "none", 'stroke="#fff" stroke-width="6" opacity=".8"');
    // goal and net with the ball inside
    s += `<g transform="translate(800 600)">`;
    s += rect(-260, -170, 520, 170, "#fff", 'opacity=".08"');
    for (let x = -250; x <= 250; x += 25) s += path(`M${x} -170L${x * 0.9} 0`, "none", 'stroke="#fff" stroke-width="2" opacity=".5"');
    for (let y = -150; y <= 0; y += 25) s += path(`M-260 ${y}H260`, "none", 'stroke="#fff" stroke-width="2" opacity=".5"');
    s += path("M-270 10V-180H270V10", "none", 'stroke="#fff" stroke-width="16"');
    s += circle(110, -60, 42, "#fff") + poly([[110, -78], [127, -66], [121, -46], [99, -46], [93, -66]], "#14181f") + `</g>`;
    // confetti in red and gold
    for (let i = 0; i < 70; i++) { const x = r() * W, y = r() * 520; s += rect(x, y, 10 + r() * 10, 5 + r() * 6, i % 2 ? "#e03131" : "#ffd43b", `transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})"`); }
    return s;
  },

  "octopus-genius": (c) => {
    let s = `<defs><linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#0b4f6c"/></linearGradient></defs>` + rect(0, 0, W, H, "url(#sea)");
    for (let i = 0; i < 6; i++) s += path(`M${i * 300 - 100} 0L${i * 300 + 40} 0L${i * 300 + 260} ${H}L${i * 300 + 60} ${H}Z`, "#fff", 'opacity=".06"');
    const r = rand(5);
    for (let i = 0; i < 26; i++) s += circle(r() * W, r() * H, 4 + r() * 14, "none", `stroke="#e0fbff" stroke-width="3" opacity="${f(0.3 + r() * 0.5)}"`);
    // seaweed
    for (const x of [140, 260, 1320, 1460]) s += path(`M${x} ${H}C${x - 60} 760 ${x + 60} 660 ${x} 560C${x - 40} 640 ${x + 20} 760 ${x + 30} ${H}Z`, "#1f9d55");
    s += path(`M0 840Q400 800 800 850T1600 830V900H0Z`, "#f2d49b");
    // arms
    const body = "#f0663f", dark = "#c4472a";
    const arms: [number, number, number, number, number, number][] = [
      [700, 560, 520, 640, 470, 520], [730, 600, 600, 760, 470, 760], [770, 610, 720, 790, 620, 830], [800, 615, 820, 800, 760, 850],
      [830, 610, 900, 800, 980, 840], [870, 600, 1010, 760, 1130, 760], [900, 560, 1080, 640, 1130, 520], [880, 520, 1020, 470, 1080, 380],
    ];
    for (const [x0, y0, cx, cy, x1, y1] of arms) {
      s += path(`M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}`, "none", `stroke="${body}" stroke-width="46" stroke-linecap="round"`);
      for (let t = 0.25; t < 1; t += 0.2) {
        const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
        s += circle(x, y + 10, 8 * (1.1 - t), "#ffc7a8");
      }
    }
    s += path("M800 180C980 180 1010 360 960 470C930 540 880 580 800 580C720 580 670 540 640 470C590 360 620 180 800 180Z", body);
    s += path("M690 240C720 200 760 190 790 195C740 230 715 290 712 360C690 330 678 290 690 240Z", "#ff9b75");
    for (const [x, y, rr] of [[700, 300, 18], [910, 330, 14], [860, 250, 10]] as const) s += circle(x, y, rr, dark);
    for (const x of [740, 860]) s += circle(x, 470, 46, "#fff") + circle(x + 8, 476, 22, "#14213d") + circle(x + 16, 466, 7, "#fff");
    return s;
  },

  "louis-braille": (c) => {
    let s = rect(0, 0, W, H, c.tint);
    const r = rand(9);
    for (let i = 0; i < 140; i++) s += circle(r() * W, r() * H, 6 + r() * 6, c.ink, `opacity="${f(0.06 + r() * 0.1)}"`);
    // an open book
    s += path("M800 300C680 250 470 240 330 280V760C470 720 680 730 800 780Z", "#fffdf6") + path("M800 300C920 250 1130 240 1270 280V760C1130 720 920 730 800 780Z", "#fff7e6");
    s += path("M800 300V780", "none", `stroke="${c.deep}" stroke-width="6" opacity=".25"`);
    s += path("M330 760C470 720 680 730 800 780C920 730 1130 720 1270 760V790C1130 750 920 760 800 810C680 760 470 750 330 790Z", c.deep);
    // "READ" in braille: R = 1,2,3,5  E = 1,5  A = 1  D = 1,4,5
    const cells = [[1, 2, 3, 5], [1, 5], [1], [1, 4, 5]];
    const dot = (n: number) => ({ x: n <= 3 ? 0 : 1, y: (n - 1) % 3 });
    cells.forEach((dots, i) => {
      const bx = (i < 2 ? 430 : 900) + (i % 2) * 140, by = 400;
      for (let n = 1; n <= 6; n++) {
        const { x, y } = dot(n), on = dots.includes(n);
        s += circle(bx + x * 56, by + y * 70, on ? 20 : 8, on ? c.ink : "#d8d2c4", on ? `stroke="${c.deep}" stroke-width="3"` : "");
      }
    });
    s += sparkle(260, 200, 30, c.ink) + sparkle(1360, 220, 22, c.ink) + sparkle(1300, 640, 18, c.ink);
    return s;
  },

  "a-day-on-venus": (c) => {
    let s = rect(0, 0, W, H, "#120c33") + stars(21, 160) + circle(120, 120, 260, "#ffcf5c", 'opacity=".12"') + circle(120, 120, 150, "#ffcf5c", 'opacity=".25"') + circle(120, 120, 80, "#ffe08a");
    s += `<defs><clipPath id="v"><circle cx="820" cy="470" r="290"/></clipPath><radialGradient id="vg" cx=".35" cy=".35"><stop offset="0" stop-color="#ffe7a6"/><stop offset="1" stop-color="#d9902f"/></radialGradient></defs>`;
    s += circle(820, 470, 330, "#ffcf7a", 'opacity=".12"') + circle(820, 470, 290, "url(#vg)");
    s += `<g clip-path="url(#v)" opacity=".55">`;
    const r = rand(4);
    for (let i = 0; i < 9; i++) { const y = 220 + i * 60 + r() * 20; s += path(`M500 ${y}Q700 ${y - 40 + r() * 80} 900 ${y}T1140 ${y}`, "none", `stroke="${i % 2 ? "#f6c46a" : "#c97b2a"}" stroke-width="${f(14 + r() * 18)}" stroke-linecap="round"`); }
    s += `</g>` + circle(820, 470, 290, "none", `stroke="#000" stroke-opacity=".18" stroke-width="40"`);
    // a curved arrow showing the backward spin
    s += path("M560 210Q820 90 1080 210", "none", 'stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-dasharray="4 22"') + poly([[540, 220], [590, 190], [580, 240]], "#fff");
    s += circle(1360, 690, 46, "#3b82f6") + path("M1330 670q20 -14 40 4q-6 20 -30 14z", "#34d399") + path("M1360 720q20 -6 30 -24q4 20 -14 30z", "#34d399");
    return s;
  },

  "why-leaves-change-color": (c) => {
    let s = rect(0, 0, W, H, "#cfe8ff") + circle(1320, 160, 90, "#fff3b0") + path(`M0 760Q800 700 1600 760V900H0Z`, "#8fc463") + path(`M0 820Q800 780 1600 830V900H0Z`, "#6ea94a");
    s += path("M770 820L780 520Q740 470 690 450L700 430Q760 450 790 490L800 400L820 400L825 500Q860 450 920 430L930 450Q860 480 840 530L850 820Z", "#6b3f1f");
    const r = rand(13), cols = ["#f59f00", "#e8590c", "#d6336c", "#fab005", "#c92a2a", "#f76707"];
    for (let i = 0; i < 46; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 240; s += circle(810 + Math.cos(a) * d * 1.25, 330 + Math.sin(a) * d * 0.8, 60 + r() * 40, cols[i % cols.length], 'opacity=".95"'); }
    for (let i = 0; i < 14; i++) s += leaf(200 + r() * 1200, 450 + r() * 380, 0.7 + r() * 0.5, r() * 360, cols[i % cols.length]);
    for (let i = 0; i < 6; i++) s += leaf(120 + i * 70, 800 - (i % 2) * 20, 0.6, i * 50, cols[(i + 2) % cols.length]);
    return s;
  },

  "sleep-superpower": (c) => {
    let s = `<defs><linearGradient id="nt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1a4a"/><stop offset="1" stop-color="#2a4a9a"/></linearGradient></defs>` + rect(0, 0, W, H, "url(#nt)") + stars(31, 120);
    s += circle(1250, 200, 110, "#fff2b8") + circle(1300, 165, 100, "#18306f");
    // a sleepy cloud
    s += path("M560 620C470 620 440 520 520 490C510 400 620 370 670 430C700 350 830 340 870 430C930 380 1040 420 1020 500C1100 520 1090 620 1000 620Z", "#f4f7ff");
    s += path("M690 520q30 24 60 0", "none", 'stroke="#2a3b7a" stroke-width="10" stroke-linecap="round"') + path("M850 520q30 24 60 0", "none", 'stroke="#2a3b7a" stroke-width="10" stroke-linecap="round"');
    s += circle(660, 565, 22, "#ffb3c7", 'opacity=".7"') + circle(940, 565, 22, "#ffb3c7", 'opacity=".7"') + path("M780 575q20 14 40 0", "none", 'stroke="#2a3b7a" stroke-width="8" stroke-linecap="round"');
    // z z z
    const z = (x: number, y: number, sz: number) => path(`M${x} ${y}h${sz}l${-sz} ${sz}h${sz}`, "none", `stroke="#bcd0ff" stroke-width="${f(sz / 5)}" stroke-linecap="round" stroke-linejoin="round"`);
    s += z(1040, 360, 60) + z(1130, 270, 44) + z(1195, 205, 30);
    s += path(`M0 800Q400 740 800 790T1600 770V900H0Z`, "#14295f");
    return s;
  },

  "math-of-a-soccer-ball": (c) => {
    let s = rect(0, 0, W, H, "#2f9e44");
    for (let i = 0; i < 8; i++) s += rect(i * 200, 0, 100, H, "#37b24d");
    s += path("M800 0V900", "none", 'stroke="#fff" stroke-width="10" opacity=".7"') + circle(800, 450, 300, "none", 'stroke="#fff" stroke-width="10" opacity=".7"');
    // the ball: a central pentagon ringed by hexagons, drawn flat and clipped to a circle
    const cx = 800, cy = 440, R = 230, edge = 64;
    s += `<defs><clipPath id="ball"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath><radialGradient id="shade" cx=".38" cy=".32"><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#1b2a3a" stop-opacity=".45"/></radialGradient></defs>`;
    s += circle(cx + 20, cy + 250, 200, "#1b4d2a", 'opacity=".35" transform="scale(1 .25) translate(0 1900)"');
    s += circle(cx, cy, R, "#fff");
    const ngon = (x: number, y: number, n: number, r0: number, rot: number) => Array.from({ length: n }, (_, i): [number, number] => [x + Math.cos(rot + (i / n) * Math.PI * 2) * r0, y + Math.sin(rot + (i / n) * Math.PI * 2) * r0]);
    // central pentagon; a hexagon shares each of its edges; pentagons sit in the gaps beyond
    const pentR = edge / (2 * Math.sin(Math.PI / 5)), pentA = edge / (2 * Math.tan(Math.PI / 5)), hexA = (edge * Math.sqrt(3)) / 2;
    let inner = poly(ngon(cx, cy, 5, pentR, -Math.PI / 2), "#14181f");
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + Math.PI / 5 + (i / 5) * Math.PI * 2; // normal of edge i
      const hx = cx + Math.cos(a) * (pentA + hexA), hy = cy + Math.sin(a) * (pentA + hexA);
      inner += poly(ngon(hx, hy, 6, edge, a + Math.PI - Math.PI / 6), "none", 'stroke="#14181f" stroke-width="5" stroke-linejoin="round"');
      // the next ring: a black pentagon past each outer corner, and hexagon edges in between
      const v = -Math.PI / 2 + (i / 5) * Math.PI * 2, d2 = pentR + edge * 2.05;
      inner += poly(ngon(cx + Math.cos(v) * d2, cy + Math.sin(v) * d2, 5, pentR * 1.05, v), "#14181f");
      const ox = cx + Math.cos(a) * (pentA + hexA * 2 + edge * 0.9), oy = cy + Math.sin(a) * (pentA + hexA * 2 + edge * 0.9);
      inner += poly(ngon(ox, oy, 6, edge * 1.1, a + Math.PI - Math.PI / 6), "none", 'stroke="#14181f" stroke-width="5" stroke-linejoin="round"');
    }
    s += `<g clip-path="url(#ball)">${inner}</g>` + circle(cx, cy, R, "url(#shade)") + circle(cx, cy, R, "none", 'stroke="#14181f" stroke-width="6"');
    s += path("M480 300q-60 30 -80 90", "none", 'stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".8"') + path("M450 470q-50 10 -90 50", "none", 'stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".6"');
    return s;
  },

  "matisse-painting-with-scissors": (c) => {
    let s = rect(0, 0, W, H, "#fff6e8");
    const blob = (x: number, y: number, sc: number, rot: number, fill: string) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${sc})">${path("M0 -120C30 -80 70 -100 60 -50C110 -40 90 0 50 10C90 40 70 90 20 70C20 120 -20 120 -20 70C-70 100 -90 50 -50 20C-100 0 -80 -50 -40 -40C-60 -90 -20 -110 0 -120Z", fill)}</g>`;
    s += blob(330, 300, 1.4, 10, "#2b59c3") + blob(1290, 620, 1.5, -20, "#2f9e44") + blob(1250, 230, 1, 40, "#f08c00") + blob(380, 700, 1.1, -30, "#e03131");
    s += rect(560, 160, 480, 600, "#1f1f2e", 'rx="10"');
    const pieces = [["#e03131", 600, 200, 170, 150], ["#2b59c3", 780, 190, 210, 120], ["#f59f00", 800, 330, 190, 170], ["#2f9e44", 590, 370, 190, 140], ["#7048e8", 620, 530, 150, 190], ["#f783ac", 790, 520, 200, 200]] as const;
    pieces.forEach(([col, x, y, w2, h2], i) => { s += rect(x, y, w2, h2, col, `transform="rotate(${(i % 2 ? 4 : -5)} ${x + w2 / 2} ${y + h2 / 2})"`); });
    for (let i = 0; i < 6; i++) s += sparkle(170 + i * 260, 100 + (i % 2) * 720, 26, ["#2b59c3", "#e03131", "#f59f00"][i % 3]);
    // scissors
    s += `<g transform="translate(1110 420) rotate(-25)">${circle(-40, 80, 30, "none", 'stroke="#e03131" stroke-width="16"')}${circle(40, 80, 30, "none", 'stroke="#e03131" stroke-width="16"')}${path("M-24 56L30 -110L42 -104L0 60Z", "#adb5bd")}${path("M24 56L-30 -110L-42 -104L0 60Z", "#ced4da")}${circle(0, 30, 7, "#495057")}</g>`;
    return s;
  },

  "monarch-migration": (c) => {
    let s = `<defs><linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd8a8"/><stop offset="1" stop-color="#ffa94d"/></linearGradient></defs>` + rect(0, 0, W, H, "url(#dusk)");
    s += poly([[0, 700], [260, 470], [480, 640], [760, 420], [1050, 650], [1320, 460], [1600, 640], [1600, 900], [0, 900]], "#8f5b3a", 'opacity=".55"');
    s += poly([[0, 800], [300, 600], [560, 760], [860, 590], [1160, 780], [1420, 620], [1600, 740], [1600, 900], [0, 900]], "#2b6b4a");
    for (let i = 0; i < 18; i++) { const x = 40 + i * 90, y = 820 - (i % 3) * 20; s += poly([[x, y - 120], [x - 34, y], [x + 34, y]], "#1e5a3c"); }
    const fly = (x: number, y: number, sc: number, rot: number) => `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(sc)})">${path("M0 0C-20 -60 -90 -70 -90 -20C-90 10 -40 20 0 0Z", "#f76707", 'stroke="#1a1a1a" stroke-width="7"')}${path("M0 0C20 -60 90 -70 90 -20C90 10 40 20 0 0Z", "#f76707", 'stroke="#1a1a1a" stroke-width="7"')}${path("M0 4C-14 30 -60 50 -56 20C-50 6 -20 4 0 4Z", "#fd7e14", 'stroke="#1a1a1a" stroke-width="7"')}${path("M0 4C14 30 60 50 56 20C50 6 20 4 0 4Z", "#fd7e14", 'stroke="#1a1a1a" stroke-width="7"')}${path("M-46 -40L-10 -6M46 -40L10 -6", "none", 'stroke="#1a1a1a" stroke-width="4"')}${rect(-5, -24, 10, 54, "#1a1a1a", 'rx="5"')}${circle(-60, -30, 4, "#fff")}${circle(60, -30, 4, "#fff")}</g>`;
    s += fly(800, 360, 2.2, -8);
    const r = rand(17);
    for (let i = 0; i < 16; i++) s += fly(100 + r() * 1400, 80 + r() * 420, 0.35 + r() * 0.5, -30 + r() * 60);
    s += path("M200 560C500 300 1100 200 1450 120", "none", 'stroke="#fff" stroke-width="6" stroke-dasharray="2 18" stroke-linecap="round" opacity=".8"');
    return s;
  },

  "bees-tiny-workers": (c) => {
    let s = rect(0, 0, W, H, "#fff3bf");
    const hex = (x: number, y: number, r0: number, fill: string, extra = "") => poly(Array.from({ length: 6 }, (_, i): [number, number] => [x + Math.cos(Math.PI / 6 + (i * Math.PI) / 3) * r0, y + Math.sin(Math.PI / 6 + (i * Math.PI) / 3) * r0]), fill, extra);
    for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
      const x = 1090 + col * 90 + (row % 2) * 45, y = 60 + row * 78;
      s += hex(x, y, 48, row + col > 6 ? "#ffd43b" : "#fab005", 'stroke="#e67700" stroke-width="6"');
    }
    // flowers
    const flower = (x: number, y: number, col: string) => { let g = rect(x - 5, y, 10, H - y, "#2f9e44"); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g += circle(x + Math.cos(a) * 34, y + Math.sin(a) * 34, 28, col); } return g + circle(x, y, 24, "#ffd43b"); };
    s += path(`M0 760Q800 700 1600 760V900H0Z`, "#69db7c") + flower(180, 610, "#f783ac") + flower(330, 680, "#ffffff") + flower(500, 620, "#9775fa") + flower(1450, 690, "#f783ac");
    // waggle path
    s += path("M560 420C620 300 760 300 800 420C840 540 980 540 1040 420C980 300 840 300 800 420C760 540 620 540 560 420Z", "none", 'stroke="#e67700" stroke-width="6" stroke-dasharray="3 16" stroke-linecap="round"');
    // the bee
    s += `<g transform="translate(800 420) rotate(-12)">`;
    s += path("M-20 -60C-110 -170 -200 -80 -110 -30Z", "#e7f5ff", 'stroke="#74c0fc" stroke-width="6" opacity=".95"') + path("M20 -60C110 -170 200 -80 110 -30Z", "#e7f5ff", 'stroke="#74c0fc" stroke-width="6" opacity=".95"');
    s += `<ellipse cx="0" cy="20" rx="150" ry="110" fill="#fcc419"/>`;
    for (const x of [-60, 10, 80]) s += rect(x - 20, -86, 40, 212, "#212529", `clip-path="url(#bb)"`);
    s += `<defs><clipPath id="bb"><ellipse cx="0" cy="20" rx="150" ry="110"/></clipPath></defs>`;
    s += circle(-150, 0, 70, "#212529") + circle(-170, -14, 16, "#fff") + circle(-166, -12, 7, "#212529") + path("M-180 -60Q-200 -120 -240 -130", "none", 'stroke="#212529" stroke-width="8" stroke-linecap="round"') + circle(-242, -130, 12, "#212529") + poly([[150, 20], [200, 10], [150, 46]], "#212529");
    s += `</g>`;
    return s;
  },

  // ── 5-Minute Reads ──
  "basketball-peach-baskets": (c) => {
    let s = rect(0, 0, W, H, "#f6e3c4") + rect(0, 640, W, 260, "#c98b4f");
    for (let i = 0; i < 16; i++) s += rect(i * 100, 640, 4, 260, "#a86e38");
    s += rect(0, 250, W, 30, "#7a4a22") + rect(0, 280, W, 14, "#5c3517");
    for (let i = 0; i < 20; i++) s += rect(20 + i * 80, 180, 12, 70, "#7a4a22");
    // the peach basket on the railing
    s += path("M690 290H910L880 430H720Z", "#c9842c") + path("M690 290H910", "none", 'stroke="#8a5a1c" stroke-width="10"');
    for (let i = 1; i < 5; i++) s += path(`M${690 + i * 44} 290L${720 + i * 32} 430`, "none", 'stroke="#8a5a1c" stroke-width="5"');
    for (let j = 1; j < 3; j++) s += path(`M${690 + j * 10} ${290 + j * 46}H${910 - j * 10}`, "none", 'stroke="#8a5a1c" stroke-width="5"');
    for (const [x, y] of [[740, 270], [800, 262], [860, 272]] as const) s += circle(x, y, 30, "#ffa94d") + circle(x - 8, y - 10, 8, "#ffd8a8");
    // the ball, a leather soccer-style ball
    s += circle(800, 560, 70, "#8d5524") + path("M730 560Q800 520 870 560M800 490Q770 560 800 630", "none", 'stroke="#5c3517" stroke-width="6"');
    s += path("M800 470L800 440M760 480L745 455M840 480L855 455", "none", 'stroke="#5c3517" stroke-width="6" stroke-linecap="round"');
    return s;
  },

  "skateboarding-olympic-teens": (c) => {
    let s = rect(0, 0, W, H, "#ffe3e3") + circle(1250, 200, 120, "#ffd43b");
    s += path("M0 900V600Q300 600 420 760H1180Q1300 600 1600 600V900Z", "#74c0fc") + path("M420 760H1180", "none", 'stroke="#1c7ed6" stroke-width="14"');
    // the board, mid-air
    s += `<g transform="translate(800 420) rotate(-14)">` + rect(-210, -18, 420, 36, "#e8590c", 'rx="18"') + rect(-200, -10, 400, 8, "#ffc078", 'rx="4"');
    for (const x of [-130, 130]) s += rect(x - 30, 18, 60, 14, "#868e96") + circle(x - 22, 46, 20, "#fff", 'stroke="#495057" stroke-width="6"') + circle(x + 22, 46, 20, "#fff", 'stroke="#495057" stroke-width="6"');
    s += `</g>`;
    s += path("M560 560Q640 600 700 530M1040 300Q1000 260 960 300", "none", 'stroke="#fa5252" stroke-width="8" stroke-linecap="round" stroke-dasharray="4 18"');
    s += sparkle(560, 300, 34, "#fab005") + sparkle(1060, 520, 26, "#fab005");
    return s;
  },

  "why-curveballs-curve": (c) => {
    let s = rect(0, 0, W, H, "#d3f9d8") + path("M0 700Q800 600 1600 700V900H0Z", "#c08552");
    s += path("M200 420C600 360 900 380 1200 560", "none", 'stroke="#ffffff" stroke-width="10" stroke-dasharray="8 22" stroke-linecap="round"');
    s += circle(1220, 570, 22, "#fff", 'opacity=".5"');
    // baseball with seams and spin arrows
    s += circle(800, 420, 140, "#ffffff", 'stroke="#ced4da" stroke-width="6"');
    s += path("M700 320Q760 420 700 520M900 320Q840 420 900 520", "none", 'stroke="#e03131" stroke-width="7"');
    for (let i = 0; i < 6; i++) { const y = 340 + i * 30; s += path(`M${712 + Math.sin(i) * 8} ${y}l18 -8M${888 - Math.sin(i) * 8} ${y}l-18 -8`, "none", 'stroke="#e03131" stroke-width="4"'); }
    s += path("M600 300A230 230 0 0 1 1000 300", "none", 'stroke="#2b8a3e" stroke-width="14" stroke-linecap="round"') + poly([[1000, 270], [1030, 320], [975, 320]], "#2b8a3e");
    return s;
  },

  "pele-king-of-soccer": (c) => {
    let s = rect(0, 0, W, H, "#ffe066") + rect(0, 640, W, 260, "#2f9e44");
    for (let i = 0; i < 8; i++) s += rect(i * 200, 640, 100, 260, "#37b24d");
    // a sock-ball tied with string
    s += `<g transform="translate(800 500) rotate(-10)">` + `<ellipse cx="0" cy="0" rx="150" ry="120" fill="#f8f9fa" stroke="#adb5bd" stroke-width="6"/>`;
    s += path("M-150 -20Q0 -60 150 -20M-140 50Q0 10 140 50", "none", 'stroke="#ced4da" stroke-width="8"');
    s += path("M-10 -120Q-30 0 -10 120M40 -115Q20 0 40 115", "none", 'stroke="#a17c45" stroke-width="6"');
    s += rect(-40, -24, 60, 30, "#ffd43b", 'opacity=".6"') + `</g>`;
    // crown
    s += poly([[680, 300], [700, 200], [750, 260], [800, 180], [850, 260], [900, 200], [920, 300]], "#f59f00", 'stroke="#e67700" stroke-width="6"');
    for (const x of [700, 800, 900]) s += circle(x, x === 800 ? 180 : 200, 14, "#e03131");
    return s;
  },

  "offside-rule-explained": (c) => {
    let s = rect(0, 0, W, H, "#2f9e44");
    for (let i = 0; i < 8; i++) s += rect(i * 200, 0, 100, H, "#37b24d");
    s += rect(1500, 300, 100, 300, "none", 'stroke="#fff" stroke-width="10"') + rect(0, 0, W, H, "none", 'stroke="#fff" stroke-width="16"');
    // the offside line
    s += path("M1000 0V900", "none", 'stroke="#ffd43b" stroke-width="10" stroke-dasharray="30 20"');
    const player = (x: number, y: number, col: string) => circle(x, y - 70, 34, "#ffd8a8") + rect(x - 40, y - 36, 80, 100, col, 'rx="22"') + rect(x - 34, y + 64, 26, 70, "#212529", 'rx="10"') + rect(x + 8, y + 64, 26, 70, "#212529", 'rx="10"');
    s += player(1000, 420, "#1c7ed6") + player(1150, 540, "#fa5252") + player(640, 520, "#fa5252");
    s += circle(560, 680, 30, "#fff", 'stroke="#212529" stroke-width="5"');
    // the assistant's flag
    s += rect(1260, 140, 10, 220, "#495057") + poly([[1270, 140], [1380, 150], [1270, 220]], "#ffd43b") + rect(1270, 165, 110, 18, "#fa5252", 'opacity=".9"');
    return s;
  },

  "first-world-cup-1930": (c) => {
    let s = rect(0, 0, W, H, "#e7f5ff") + circle(1200, 200, 90, "#ffe066");
    s += path("M0 640Q200 610 400 640T800 640T1200 640T1600 640V900H0Z", "#4dabf7") + path("M0 700Q200 670 400 700T800 700T1200 700T1600 700V900H0Z", "#1c7ed6");
    // ocean liner
    s += path("M480 600H1120L1060 690H540Z", "#212529") + rect(540, 520, 520, 80, "#f8f9fa");
    for (let i = 0; i < 8; i++) s += circle(580 + i * 64, 560, 12, "#74c0fc");
    for (const x of [660, 800, 940]) s += rect(x - 30, 420, 60, 100, "#e8590c") + rect(x - 30, 420, 60, 22, "#212529");
    s += path("M640 400Q600 340 640 300M780 400Q740 330 790 280", "none", 'stroke="#adb5bd" stroke-width="16" stroke-linecap="round" opacity=".7"');
    // old leather ball on deck
    s += circle(1000, 495, 24, "#a0522d") + path("M980 495H1020M1000 472V518", "none", 'stroke="#6b3a1f" stroke-width="4"');
    return s;
  },

  "jackie-robinson-42": (c) => {
    let s = rect(0, 0, W, H, "#d0ebff") + path("M0 650Q800 560 1600 650V900H0Z", "#2f9e44") + path("M600 900L800 680L1000 900Z", "#c08552");
    // jersey with 42
    s += path("M600 180L700 140H900L1000 180L1080 300L1000 340L980 300V620H620V300L600 340L520 300Z", "#ffffff", 'stroke="#1c4f9c" stroke-width="10"');
    s += path("M740 140Q800 200 860 140", "none", 'stroke="#1c4f9c" stroke-width="10"');
    s += `<text x="800" y="500" font-family="'Arial Black',Arial,sans-serif" font-weight="900" font-size="220" fill="#1c4f9c" text-anchor="middle">42</text>`;
    s += sparkle(470, 200, 40, "#fab005") + sparkle(1140, 470, 30, "#fab005");
    return s;
  },

  "katherine-johnson-numbers": (c) => {
    let s = rect(0, 0, W, H, "#0b1d3a") + stars(52, 160, "#fff", H);
    // an orbit path drawn like a calculation
    s += `<ellipse cx="800" cy="470" rx="460" ry="190" fill="none" stroke="#74c0fc" stroke-width="6" stroke-dasharray="16 14"/>`;
    s += circle(800, 470, 120, "#1c7ed6") + path("M720 420Q760 380 820 410T880 480Q840 540 780 520Z", "#40c057");
    s += `<g transform="translate(1250 400) rotate(30)">` + path("M0 -40L18 10H-18Z", "#f8f9fa") + rect(-18, 10, 36, 50, "#f8f9fa") + poly([[-18, 40], [-34, 70], [-18, 60]], "#fa5252") + poly([[18, 40], [34, 70], [18, 60]], "#fa5252") + `</g>`;
    const font = 'font-family="Georgia,serif" font-style="italic" fill="#ffe066" opacity=".9"';
    s += `<text x="520" y="200" ${font} font-size="52">x² + y² = r²</text><text x="860" y="760" ${font} font-size="46">v = 17,500 mph</text><text x="470" y="760" ${font} font-size="40">t + Δt</text>`;
    return s;
  },

  "wright-brothers-first-flight": (c) => {
    let s = rect(0, 0, W, H, "#bfe3ff") + circle(1300, 180, 80, "#fff3bf");
    s += path("M0 720Q400 660 800 720T1600 700V900H0Z", "#f1d9a6") + path("M0 790Q500 740 1000 790T1600 780V900H0Z", "#e3c27d");
    // the Flyer: two long wings with struts
    s += `<g transform="translate(800 400) rotate(-4)">`;
    s += rect(-380, -60, 760, 22, "#f8f0e3", 'stroke="#8d6e4a" stroke-width="5"') + rect(-380, 40, 760, 22, "#f8f0e3", 'stroke="#8d6e4a" stroke-width="5"');
    for (let i = -6; i <= 6; i++) s += path(`M${i * 60} -38V40`, "none", 'stroke="#8d6e4a" stroke-width="5"');
    s += rect(-560, -24, 120, 14, "#f8f0e3", 'stroke="#8d6e4a" stroke-width="4"') + rect(-560, 20, 120, 14, "#f8f0e3", 'stroke="#8d6e4a" stroke-width="4"') + path("M-440 -10L-380 -20M-440 30L-380 40", "none", 'stroke="#8d6e4a" stroke-width="4"');
    s += rect(400, -30, 40, 90, "#f8f0e3", 'stroke="#8d6e4a" stroke-width="4"') + circle(-20, 40, 18, "#495057");
    s += path("M60 70V110M100 70V110", "none", 'stroke="#8d6e4a" stroke-width="5"') + `</g>`;
    for (const x of [300, 1350]) s += path(`M${x} 300q30 -30 60 0q30 -30 60 0`, "none", 'stroke="#495057" stroke-width="6" stroke-linecap="round"');
    return s;
  },

  "we-choose-the-moon": (c) => {
    let s = rect(0, 0, W, H, "#120c30") + stars(88, 200, "#fff", H * 0.7);
    s += circle(1180, 230, 130, "#f1f3f5") + circle(1140, 200, 26, "#dee2e6") + circle(1220, 270, 18, "#dee2e6");
    // a podium with a microphone, and a rocket rising behind
    s += `<g transform="translate(560 380) rotate(20)">` + path("M0 -170C30 -130 40 -60 40 40H-40C-40 -60 -30 -130 0 -170Z", "#f8f9fa") + circle(0, -60, 18, "#4dabf7") + poly([[-40, 10], [-80, 70], [-40, 50]], "#fa5252") + poly([[40, 10], [80, 70], [40, 50]], "#fa5252") + path("M-26 50Q0 140 26 50Z", "#ffa94d") + `</g>`;
    s += path("M640 900L680 620H920L960 900Z", "#9c36b5") + rect(660, 600, 280, 30, "#7a2593", 'rx="8"');
    s += rect(795, 470, 10, 140, "#adb5bd") + `<ellipse cx="800" cy="460" rx="26" ry="36" fill="#495057"/>`;
    s += path("M850 430Q890 460 850 490M880 410Q940 460 880 510", "none", 'stroke="#ffe066" stroke-width="7" stroke-linecap="round"');
    return s;
  },

  "lou-gehrig-luckiest-man": (c) => {
    let s = rect(0, 0, W, H, "#f3d9fa") + path("M0 380Q800 240 1600 380V560H0Z", "#5f3dc4") + path("M0 470Q800 340 1600 470V600H0Z", "#7048e8");
    const r = rand(9); for (let i = 0; i < 140; i++) s += circle(r() * W, 330 + r() * 210, 7, ["#ffe066", "#ffa8a8", "#fff", "#a5d8ff"][i % 4], 'opacity=".85"');
    s += rect(0, 580, W, 320, "#2f9e44") + path("M500 900L800 640L1100 900Z", "#c08552");
    // microphones on a stand
    s += rect(795, 420, 10, 300, "#495057");
    for (const [x, y] of [[760, 410], [800, 395], [840, 410]] as const) s += `<ellipse cx="${x}" cy="${y}" rx="22" ry="30" fill="#343a40"/>`;
    s += rect(720, 712, 160, 14, "#495057", 'rx="7"');
    s += `<text x="800" y="200" font-family="'Arial Black',Arial,sans-serif" font-weight="900" font-size="90" fill="#4f1460" text-anchor="middle">2,130</text>`;
    return s;
  },

  "one-small-step": (c) => {
    let s = rect(0, 0, W, H, "#000") + stars(12, 180, "#fff", H * 0.55);
    s += circle(1280, 170, 70, "#1c7ed6") + path("M1240 140Q1270 120 1300 150T1330 190Q1290 210 1250 190Z", "#40c057");
    s += path("M0 560Q400 520 800 560T1600 540V900H0Z", "#adb5bd") + path("M0 620Q500 590 1000 630T1600 610V900H0Z", "#868e96");
    for (const [x, y, r0] of [[200, 700, 40], [1400, 760, 60], [1100, 680, 30]] as const) s += `<ellipse cx="${x}" cy="${y}" rx="${r0}" ry="${r0 / 3}" fill="#6c757d"/>`;
    // a boot print
    s += `<g transform="translate(800 720) rotate(-8)">` + `<ellipse cx="0" cy="0" rx="110" ry="46" fill="#5c636a"/>`;
    for (let i = -4; i <= 4; i++) s += rect(i * 22 - 6, -36, 12, 72, "#495057", 'rx="5"');
    s += `</g>`;
    // a flag on a pole
    s += rect(552, 220, 10, 360, "#ced4da") + rect(562, 222, 140, 84, "#fff");
    for (let i = 0; i < 4; i++) s += rect(562, 222 + i * 22, 140, 11, "#e03131");
    s += rect(562, 222, 60, 44, "#1c4f9c");
    return s;
  },

  "malala-one-pen": (c) => {
    let s = rect(0, 0, W, H, "#fff0f6");
    for (let i = 0; i < 6; i++) s += circle(200 + i * 240, 120 + (i % 2) * 60, 40, ["#fcc2d7", "#d0bfff", "#a5d8ff"][i % 3], 'opacity=".7"');
    // an open book
    s += path("M800 520Q640 450 460 480V720Q640 690 800 760Z", "#ffffff", 'stroke="#9c36b5" stroke-width="8"') + path("M800 520Q960 450 1140 480V720Q960 690 800 760Z", "#ffffff", 'stroke="#9c36b5" stroke-width="8"');
    for (let i = 0; i < 4; i++) s += path(`M520 ${540 + i * 44}Q640 ${525 + i * 44} 760 ${560 + i * 44}M840 ${560 + i * 44}Q960 ${525 + i * 44} 1080 ${540 + i * 44}`, "none", 'stroke="#d0bfff" stroke-width="6"');
    // a pen
    s += `<g transform="translate(860 330) rotate(35)">` + rect(-20, -180, 40, 280, "#7048e8", 'rx="10"') + poly([[-20, 100], [20, 100], [0, 150]], "#ffe066") + rect(-20, -120, 40, 14, "#ffd43b") + `</g>`;
    s += sparkle(560, 360, 34, "#f59f00") + sparkle(1080, 300, 26, "#f59f00");
    return s;
  },

  "how-roller-coasters-work": (c) => {
    let s = rect(0, 0, W, H, "#e3fafc") + circle(1350, 160, 80, "#ffe066");
    const track = "M0 760C200 760 300 160 520 160C700 160 700 620 860 620C960 620 960 420 1060 420C1160 420 1180 640 1300 640C1420 640 1500 560 1600 560";
    s += path(track, "none", 'stroke="#495057" stroke-width="30"') + path(track, "none", 'stroke="#fa5252" stroke-width="16"');
    for (let i = 0; i < 16; i++) { const x = 60 + i * 100; s += rect(x, i < 6 ? 300 + Math.abs(5 - i) * 40 : 560, 10, 400, "#adb5bd"); }
    // the train just over the top
    s += `<g transform="translate(600 210) rotate(38)">`;
    for (let i = 0; i < 3; i++) s += rect(i * -110 - 50, -70, 96, 60, ["#1c7ed6", "#fab005", "#40c057"][i], 'rx="14"') + circle(i * -110 - 30, -10, 12, "#212529") + circle(i * -110 + 30, -10, 12, "#212529") + circle(i * -110, -86, 20, "#ffd8a8");
    s += `</g>`;
    s += path("M700 300l40 -20M720 340l46 -6", "none", 'stroke="#868e96" stroke-width="8" stroke-linecap="round"');
    return s;
  },

  "why-cats-purr": (c) => {
    let s = rect(0, 0, W, H, "#fff9db") + rect(0, 640, W, 260, "#e9c46a") + `<ellipse cx="800" cy="700" rx="440" ry="90" fill="#f4a261"/>`;
    // a curled-up cat
    s += `<ellipse cx="800" cy="580" rx="300" ry="160" fill="#868e96"/>` + path("M520 620Q470 520 560 470", "none", 'stroke="#868e96" stroke-width="60" stroke-linecap="round"');
    s += circle(1000, 520, 110, "#868e96") + poly([[920, 450], [940, 360], [990, 430]], "#868e96") + poly([[1020, 430], [1070, 360], [1090, 450]], "#868e96");
    s += poly([[935, 430], [948, 385], [975, 425]], "#f783ac") + poly([[1035, 425], [1065, 385], [1075, 430]], "#f783ac");
    s += path("M950 520q20 16 40 0M1030 520q20 16 40 0", "none", 'stroke="#343a40" stroke-width="7" stroke-linecap="round"') + poly([[1000, 548], [990, 538], [1010, 538]], "#f783ac");
    for (let i = 0; i < 3; i++) s += path(`M${1140 + i * 34} ${440 - i * 10}q16 30 0 60q-16 30 0 60`, "none", `stroke="#f08c00" stroke-width="7" stroke-linecap="round" opacity="${1 - i * 0.25}"`);
    s += `<text x="1240" y="330" font-family="'Arial Black',Arial,sans-serif" font-size="56" fill="#f08c00">prrr</text>`;
    return s;
  },

  "hiccup-science": (c) => {
    let s = rect(0, 0, W, H, "#e5dbff");
    for (let i = 0; i < 9; i++) s += circle(220 + i * 150, 140 + (i % 3) * 40, 16 + (i % 3) * 8, "#ffffff", 'opacity=".6"');
    // lungs and a dome-shaped diaphragm
    s += path("M790 230V380", "none", 'stroke="#f783ac" stroke-width="26" stroke-linecap="round"');
    s += path("M770 360C640 330 560 440 580 580C600 660 700 650 760 600Z", "#ff8787") + path("M830 360C960 330 1040 440 1020 580C1000 660 900 650 840 600Z", "#ff8787");
    s += path("M520 700Q800 560 1080 700", "none", 'stroke="#e8590c" stroke-width="30" stroke-linecap="round"');
    s += path("M560 760Q800 640 1040 760", "none", 'stroke="#e8590c" stroke-width="10" stroke-dasharray="10 18" stroke-linecap="round" opacity=".6"');
    s += `<text x="1140" y="300" font-family="'Arial Black',Arial,sans-serif" font-weight="900" font-size="110" fill="#7048e8" transform="rotate(-10 1140 300)">HIC!</text>`;
    return s;
  },

  "why-the-moon-changes-shape": (c) => {
    let s = rect(0, 0, W, H, "#0d1033") + stars(41, 200, "#fff", H);
    s += circle(800, 380, 260, "#f1f3f5", 'opacity=".08"') + circle(800, 380, 210, "#e9ecef");
    for (const [x, y, r0] of [[730, 320, 40], [880, 300, 26], [840, 450, 52], [700, 470, 22], [930, 400, 18]] as const) s += circle(x, y, r0, "#ced4da");
    // a row of phases
    const phases = [0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25];
    phases.forEach((lit, i) => {
      const x = 170 + i * 180, y = 760, r0 = 50, waxing = i <= 4;
      s += circle(x, y, r0, "#2b2f5c");
      if (lit === 1) s += circle(x, y, r0, "#f1f3f5");
      else if (lit > 0) {
        const k = Math.cos(lit * Math.PI) * r0; // terminator ellipse radius
        const sweepOuter = waxing ? 1 : 0;
        s += path(`M${x} ${y - r0}A${r0} ${r0} 0 0 ${sweepOuter} ${x} ${y + r0}A${f(Math.abs(k))} ${r0} 0 0 ${(k > 0) === waxing ? 0 : 1} ${x} ${y - r0}Z`, "#f1f3f5");
      }
    });
    return s;
  },
};

/** The illustration on its own, 1600×900. */
export function newsArtInner(a: NewsArticle) {
  const scene = SCENES[a.slug];
  return scene ? scene(SECTION_COLORS[a.section]) : rect(0, 0, W, H, SECTION_COLORS[a.section].tint) + circle(800, 450, 220, SECTION_COLORS[a.section].ink);
}

export function newsHeroSvg(a: NewsArticle) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration for ${a.title.replace(/"/g, "")}">${newsArtInner(a)}</svg>`;
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function wrap(text: string, max: number) {
  const lines: string[] = []; let line = "";
  for (const w of text.split(" ")) { if ((line + " " + w).trim().length > max && line) { lines.push(line); line = w; } else line = (line + " " + w).trim(); }
  if (line) lines.push(line);
  return lines;
}

/** A tall magazine cover (600×900) for the library shelf: masthead, art, headline. */
export function newsCoverSvg(a: NewsArticle) {
  const c = SECTION_COLORS[a.section];
  const lines = wrap(a.title, 16).slice(0, 4);
  const size = lines.length > 3 ? 44 : 50;
  const top = 900 - 40 - lines.length * (size + 6);
  const font = `font-family="'Arial Black','Helvetica Neue',Arial,sans-serif" font-weight="900"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" width="600" height="900">
<rect width="600" height="900" fill="${c.deep}"/>
<svg x="0" y="96" width="600" height="${f(top - 120)}" viewBox="460 0 680 ${H}" preserveAspectRatio="xMidYMid slice">${newsArtInner(a)}</svg>
<rect width="600" height="96" fill="#ffffff"/>
<text x="30" y="66" ${font} font-size="50" fill="${c.deep}" letter-spacing="-1">ARISE<tspan fill="${c.ink}"> NEWS</tspan></text>
<text x="570" y="44" font-family="Arial,sans-serif" font-weight="700" font-size="16" fill="${c.deep}" text-anchor="end">ISSUE ${NEWS_ISSUE.number}</text>
<text x="570" y="68" font-family="Arial,sans-serif" font-weight="700" font-size="16" fill="${c.ink}" text-anchor="end">${esc(a.section.toUpperCase())}</text>
<rect y="${f(top - 24)}" width="600" height="${f(900 - top + 24)}" fill="${c.deep}"/>
<rect x="30" y="${f(top - 6)}" width="120" height="8" fill="${c.ink}"/>
${lines.map((l, i) => `<text x="30" y="${f(top + 40 + i * (size + 6))}" ${font} font-size="${size}" fill="#ffffff">${esc(l)}</text>`).join("\n")}
<text x="570" y="${f(top - 2)}" font-family="Arial,sans-serif" font-weight="800" font-size="20" fill="#ffffff" text-anchor="end">5 PTS</text>
</svg>`;
}
