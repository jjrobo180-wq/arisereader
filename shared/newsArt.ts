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

  "festivals-of-light": (c) => {
    let s = `<defs><radialGradient id="glow"><stop offset="0" stop-color="#ffe9a3"/><stop offset=".45" stop-color="#ffb84d" stop-opacity=".7"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient><linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1446"/><stop offset="1" stop-color="#4a1d6b"/></linearGradient></defs>`;
    s += rect(0, 0, W, H, "url(#night)") + stars(3, 90) + circle(1300, 150, 70, "#fff6d6") + circle(1300, 150, 120, "#fff6d6", 'opacity=".12"');
    s += rect(0, 640, W, 260, "#241a5c") + path(`M0 640H1600`, "none", 'stroke="#6a5acd" stroke-width="3" opacity=".6"');
    const r = rand(7);
    // sky lanterns
    for (let i = 0; i < 9; i++) {
      const x = 160 + i * 160 + r() * 60, y = 120 + r() * 360, sc = 0.6 + r() * 0.7;
      s += circle(x, y, 90 * sc, "url(#glow)") + `<g transform="translate(${f(x)} ${f(y)}) scale(${f(sc)})">${path("M-34 -48Q0 -60 34 -48L42 30Q0 44 -42 30Z", i % 3 ? "#ff6b3d" : "#e63946")}${rect(-30, 30, 60, 10, "#ffd166", 'rx="4"')}${path("M-20 -40Q0 -46 20 -40L24 20Q0 28 -24 20Z", "#ffb38a", 'opacity=".6"')}</g>`;
    }
    // floating baskets and reflections
    for (let i = 0; i < 7; i++) {
      const x = 140 + i * 220 + r() * 40, y = 700 + r() * 120;
      s += rect(x - 3, y + 14, 6, 60, "#ffcc66", 'opacity=".35"') + circle(x, y - 22, 40, "url(#glow)");
      s += path(`M${x - 40} ${y}Q${x} ${y + 26} ${x + 40} ${y}L${x + 30} ${y - 8}H${x - 30}Z`, "#3fa34d") + circle(x - 16, y - 12, 8, "#ff7eb6") + circle(x + 16, y - 12, 8, "#ffd6e8") + rect(x - 4, y - 34, 8, 22, "#fff3d6") + path(`M${x} ${y - 48}q8 10 0 16q-8 -6 0 -16z`, "#ffd166");
    }
    // a row of diyas
    for (let i = 0; i < 5; i++) {
      const x = 560 + i * 120, y = 600;
      s += circle(x, y - 40, 50, "url(#glow)") + path(`M${x - 34} ${y - 14}Q${x} ${y + 22} ${x + 34} ${y - 14}Z`, "#c2410c") + path(`M${x} ${y - 52}q12 16 0 28q-12 -12 0 -28z`, "#ffd166");
    }
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
