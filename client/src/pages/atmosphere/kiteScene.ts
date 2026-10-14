/**
 * A.R.I.S.E. Atmosphere — kite scenes.
 *
 * Every kite scene is painted on one canvas: the sky, sun or moon, clouds, hills or sea, and the
 * kites themselves, each with a string down to the ground and a tail that ripples in the wind.
 * Nothing is loaded from the network, so the scenes look the same offline and stay sharp on any
 * screen size. Kites are placed from a fixed seed, so resizing or rotating a phone keeps the same
 * kites in the same colours rather than reshuffling them.
 */

export type KiteThemeId = "festival" | "golden" | "lantern" | "seaside" | "blossom" | "aurora";
export type ThemeId = "live" | KiteThemeId;
type KiteShape = "diamond" | "delta" | "rokkaku" | "box";
type Extra = "birds" | "stars" | "petals" | "fireflies" | "motes" | "aurora";

export type KiteTheme = {
  id: KiteThemeId;
  name: string;
  blurb: string;
  sky: string[];
  body?: { kind: "sun" | "moon"; x: number; y: number; r: number; color: string; glow: string };
  land: "hills" | "sea";
  /** Hills: back → front. Sea: [far water, near water, sand]. */
  layers: string[];
  kites: [string, string][];
  string: string;
  cloud: string | null;
  clouds: number;
  extras: Extra[];
  glow: boolean;
  night: boolean;
};

export const KITE_THEMES: Record<KiteThemeId, KiteTheme> = {
  festival: {
    id: "festival", name: "Kite Festival", blurb: "Bright blue sky over rolling green hills",
    sky: ["#3f9cf0", "#7cc3fb", "#c9e9ff", "#eaf7ff"],
    body: { kind: "sun", x: .86, y: .16, r: 46, color: "#fff7d1", glow: "rgba(255,244,190,.55)" },
    land: "hills", layers: ["#9bd28c", "#6fbb6a", "#4c9d55", "#327d43"],
    kites: [["#ff4d6d", "#ffd166"], ["#ffb703", "#fb5607"], ["#06d6a0", "#118ab2"], ["#8338ec", "#ff006e"], ["#3a86ff", "#ffbe0b"], ["#ef476f", "#ffffff"], ["#ff7b00", "#2ec4b6"]],
    string: "rgba(255,255,255,.55)", cloud: "rgba(255,255,255,.92)", clouds: 6, extras: ["birds"], glow: false, night: false,
  },
  golden: {
    id: "golden", name: "Golden Hour", blurb: "Sunset glow and silhouetted hills",
    sky: ["#241a4a", "#7a2f6b", "#d9566b", "#ff9a5a", "#ffd08a"],
    body: { kind: "sun", x: .74, y: .66, r: 70, color: "#ffe2a1", glow: "rgba(255,170,90,.6)" },
    land: "hills", layers: ["#5b2b52", "#3d1d3f", "#26122b", "#160a1b"],
    kites: [["#ff6b6b", "#ffd93d"], ["#ffb26b", "#7b2cbf"], ["#f72585", "#ffd6a5"], ["#ffe066", "#e85d04"], ["#4cc9f0", "#f9c74f"], ["#ff9e00", "#9d0208"]],
    string: "rgba(255,226,180,.45)", cloud: "rgba(255,190,160,.55)", clouds: 4, extras: ["birds", "motes"], glow: false, night: false,
  },
  lantern: {
    id: "lantern", name: "Lantern Night", blurb: "Glowing kites under the stars",
    sky: ["#03061a", "#0a1236", "#18245a", "#2a2f66"],
    body: { kind: "moon", x: .82, y: .18, r: 34, color: "#fbf3d9", glow: "rgba(220,230,255,.35)" },
    land: "hills", layers: ["#121a3f", "#0c1331", "#080d24", "#050816"],
    kites: [["#ffcf6e", "#ff8a3d"], ["#ff7a7a", "#ffd28a"], ["#9be7ff", "#5b8cff"], ["#ffd6ff", "#c77dff"], ["#b9fbc0", "#3ddc97"], ["#ffe8a3", "#ff5e7e"]],
    string: "rgba(200,210,255,.18)", cloud: null, clouds: 0, extras: ["stars", "fireflies"], glow: true, night: true,
  },
  seaside: {
    id: "seaside", name: "Seaside Breeze", blurb: "Kites over the ocean and a sandy beach",
    sky: ["#2b8fd6", "#6cc3f0", "#b8e6fb", "#e6f8ff"],
    body: { kind: "sun", x: .2, y: .14, r: 40, color: "#fffbe0", glow: "rgba(255,250,200,.5)" },
    land: "sea", layers: ["#1c76b4", "#2a9bd2", "#f1d8a3"],
    kites: [["#ff595e", "#ffca3a"], ["#1982c4", "#ffffff"], ["#ffca3a", "#ff924c"], ["#8ac926", "#1982c4"], ["#6a4c93", "#ff595e"], ["#ff006e", "#fbf8cc"]],
    string: "rgba(255,255,255,.6)", cloud: "rgba(255,255,255,.88)", clouds: 5, extras: ["birds"], glow: false, night: false,
  },
  blossom: {
    id: "blossom", name: "Cherry Blossom", blurb: "Spring kites and drifting petals",
    sky: ["#f4a6bd", "#f9c6d3", "#fde3ea", "#fff4f7"],
    body: { kind: "sun", x: .8, y: .2, r: 42, color: "#fffaf0", glow: "rgba(255,240,245,.6)" },
    land: "hills", layers: ["#bcd9b0", "#9cc794", "#7cb07a", "#5e955f"],
    kites: [["#ff8fab", "#ffffff"], ["#c77dff", "#ffd6e0"], ["#56cfe1", "#ff8fab"], ["#ffb5a7", "#ff7096"], ["#a0c4ff", "#ffadad"], ["#ffd166", "#ef476f"]],
    string: "rgba(255,255,255,.65)", cloud: "rgba(255,255,255,.85)", clouds: 4, extras: ["petals"], glow: false, night: false,
  },
  aurora: {
    id: "aurora", name: "Northern Lights", blurb: "Glowing kites beneath a dancing aurora",
    sky: ["#020815", "#04192c", "#0a2c3c", "#11354a"],
    body: undefined,
    land: "hills", layers: ["#0d2833", "#0a1f29", "#06161e", "#030c12"],
    kites: [["#7dffcb", "#2bd4a4"], ["#a98bff", "#5ee7ff"], ["#ff9be1", "#9b7bff"], ["#ffe38a", "#7dffcb"], ["#5ee7ff", "#ffffff"]],
    string: "rgba(170,255,230,.16)", cloud: null, clouds: 0, extras: ["stars", "aurora"], glow: true, night: true,
  },
};

export const KITE_THEME_ORDER: KiteThemeId[] = ["festival", "golden", "seaside", "blossom", "lantern", "aurora"];

export type SceneOptions = {
  theme: KiteTheme;
  kites: number;
  /** 0–100 */
  wind: number;
  strings: boolean;
  quality: "cinematic" | "balanced";
  /** Darkens the scene, for Sleep Studio. */
  sleepy: boolean;
};

type Kite = {
  shape: KiteShape; color: string; accent: string; homeX: number; homeY: number; depth: number;
  size: number; phase: number; tail: number; anchorX: number;
};

/** A small seeded random, so the same kites come back after a resize. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const BOTTOM: Record<KiteShape, number> = { diamond: .45, delta: .16, rokkaku: .5, box: .45 };

export function startKiteScene(canvas: HTMLCanvasElement, opts: SceneOptions): () => void {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return () => {};
  const { theme } = opts;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const high = opts.quality === "cinematic";
  const windF = .35 + Math.max(0, Math.min(100, opts.wind)) / 100 * 1.25;
  let W = 1, H = 1, raf = 0, tick = 0, last = performance.now(), t = 0;
  let sky: CanvasGradient | null = null;
  let hills: Path2D[] = [];
  let kites: Kite[] = [];
  let stars: { x: number; y: number; r: number; p: number }[] = [];
  let clouds: { x: number; y: number; s: number; v: number; puffs: [number, number, number][] }[] = [];
  let birds: { x: number; y: number; v: number; p: number; s: number }[] = [];
  let petals: { x: number; y: number; r: number; a: number; v: number; spin: number }[] = [];
  let flies: { x: number; y: number; p: number }[] = [];
  let trees: { x: number; y: number; s: number }[] = [];

  const layout = () => {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, rect.width); H = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, high ? 2 : 1.25);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const portrait = H > W * 1.05;
    const r = seeded(7919 + theme.id.length * 131);

    sky = ctx.createLinearGradient(0, 0, 0, H * (theme.land === "sea" ? .66 : .8));
    theme.sky.forEach((c, i) => sky!.addColorStop(i / (theme.sky.length - 1), c));

    // Hills: each layer a soft ridge made from two sine waves, cached as a path.
    hills = [];
    if (theme.land === "hills") {
      theme.layers.forEach((_, i) => {
        const p = new Path2D();
        const base = H * ((portrait ? .74 : .7) + i * (portrait ? .06 : .075));
        const amp = H * (.045 - i * .006);
        const f1 = 1.3 + i * .55, f2 = 3.1 + i * .9, o = i * 1.7 + 0.4;
        p.moveTo(0, H);
        for (let x = 0; x <= W + 8; x += 8) {
          const u = x / W;
          p.lineTo(x, base - Math.sin(u * Math.PI * f1 + o) * amp - Math.sin(u * Math.PI * f2 + o * 2) * amp * .35);
        }
        p.lineTo(W, H); p.closePath(); hills.push(p);
      });
    }
    trees = theme.extras.includes("petals")
      ? [{ x: .06, y: .86, s: 1.1 }, { x: .2, y: .9, s: .8 }, { x: .93, y: .88, s: 1 }].map(tr => ({ x: tr.x * W, y: tr.y * H, s: tr.s * Math.max(.7, Math.min(1.5, W / 900)) }))
      : [];

    const scale = Math.max(.62, Math.min(1.55, Math.min(W, H) / 640));
    const count = Math.max(1, Math.round(opts.kites * (high ? 1 : .75)));
    const shapes: KiteShape[] = ["diamond", "delta", "rokkaku", "box"];
    kites = Array.from({ length: count }, (_, i) => {
      const depth = .42 + r() * .78;
      const [color, accent] = theme.kites[i % theme.kites.length];
      const homeX = portrait ? .08 + r() * .84 : .4 + r() * .56;
      return {
        shape: shapes[Math.floor(r() * shapes.length)], color, accent, depth, homeX,
        homeY: .07 + r() * (portrait ? .36 : .46), size: (30 + r() * 30) * depth * scale,
        phase: r() * 1000, tail: 9 + Math.floor(r() * 9), anchorX: homeX - .1 - r() * .3,
      };
    }).sort((a, b) => a.depth - b.depth);

    stars = theme.extras.includes("stars") ? Array.from({ length: high ? 220 : 110 }, () => ({ x: r() * W, y: r() * H * .7, r: .3 + r() * 1.3, p: r() * 10 })) : [];
    clouds = Array.from({ length: theme.clouds }, () => {
      const s = (.6 + r() * .9) * scale;
      return { x: r() * W, y: H * (.06 + r() * .38), s, v: 4 + r() * 8, puffs: Array.from({ length: 6 }, (_, j) => [(j - 2.5) * 26 + r() * 10, -r() * 22 + (j === 0 || j === 5 ? 10 : 0), 22 + r() * 18] as [number, number, number]) };
    });
    birds = theme.extras.includes("birds") ? Array.from({ length: 5 }, () => ({ x: r() * W, y: H * (.12 + r() * .3), v: 18 + r() * 22, p: r() * 10, s: (.6 + r() * .6) * scale })) : [];
    petals = theme.extras.includes("petals") || theme.extras.includes("motes") ? Array.from({ length: high ? 70 : 32 }, () => ({ x: r() * W, y: r() * H, r: 2 + r() * 3.5, a: r() * 6, v: 12 + r() * 22, spin: r() * 2 - 1 })) : [];
    flies = theme.extras.includes("fireflies") ? Array.from({ length: high ? 34 : 16 }, () => ({ x: r() * W, y: H * (.72 + r() * .26), p: r() * 100 })) : [];
  };

  const drawBody = () => {
    const b = theme.body; if (!b) return;
    const x = b.x * W, y = b.y * H, rad = b.r * Math.max(.7, Math.min(1.6, Math.min(W, H) / 600));
    const g = ctx.createRadialGradient(x, y, rad * .2, x, y, rad * 4.5);
    g.addColorStop(0, b.glow); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad * 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    if (b.kind === "moon") {
      ctx.fillStyle = "rgba(180,185,205,.35)";
      for (const [cx, cy, cr] of [[-.3, -.2, .18], [.25, .1, .13], [-.05, .35, .1], [.3, -.35, .08]]) { ctx.beginPath(); ctx.arc(x + cx * rad, y + cy * rad, cr * rad, 0, Math.PI * 2); ctx.fill(); }
    }
  };

  const drawAurora = () => {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let band = 0; band < 3; band++) {
      const g = ctx.createLinearGradient(0, H * .05, 0, H * .55);
      const hue = band === 0 ? "125,255,203" : band === 1 ? "94,231,255" : "169,139,255";
      g.addColorStop(0, `rgba(${hue},0)`); g.addColorStop(.45, `rgba(${hue},${.16 - band * .03})`); g.addColorStop(1, `rgba(${hue},0)`);
      ctx.fillStyle = g; ctx.beginPath();
      for (let x = 0; x <= W + 10; x += 10) {
        const u = x / W, y = H * (.18 + band * .06) + Math.sin(u * 5 + t * .12 * (band + 1) + band) * H * .05 + Math.sin(u * 13 - t * .2) * H * .015;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (let x = W + 10; x >= 0; x -= 10) { const u = x / W; ctx.lineTo(x, H * (.45 + band * .04) + Math.sin(u * 4 + t * .1 + band) * H * .04); }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };

  const drawCloud = (c: typeof clouds[number]) => {
    ctx.fillStyle = theme.cloud!;
    ctx.beginPath();
    for (const [dx, dy, pr] of c.puffs) { ctx.moveTo(c.x + dx * c.s + pr * c.s, c.y + dy * c.s); ctx.arc(c.x + dx * c.s, c.y + dy * c.s, pr * c.s, 0, Math.PI * 2); }
    ctx.fill();
  };

  const drawSea = () => {
    const horizon = H * .66;
    const g = ctx.createLinearGradient(0, horizon, 0, H);
    g.addColorStop(0, theme.layers[0]); g.addColorStop(1, theme.layers[1]);
    ctx.fillStyle = g; ctx.fillRect(0, horizon, W, H - horizon);
    // Glints and gentle rolling wave lines.
    ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const y = horizon + 6 + i * i * (H * .0035) + 4;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 14) { const yy = y + Math.sin(x / (40 + i * 12) + t * (.6 + i * .08) + i) * (1 + i * .35); if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
      ctx.globalAlpha = .25 + i * .04; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const sunX = (theme.body?.x ?? .5) * W;
    for (let i = 0; i < 26; i++) {
      const y = horizon + 3 + i * (H * .009), w = 8 + Math.sin(t * 2 + i * 1.7) * 6 + i * 1.4;
      ctx.fillStyle = `rgba(255,252,220,${.42 - i * .013})`;
      ctx.fillRect(sunX - w / 2 + Math.sin(t * 1.3 + i) * 6, y, w, 1.6);
    }
    // Sand, with foam running along the edge.
    const shore = (x: number) => H * .87 + Math.sin(x / W * Math.PI * 1.6 + .6) * H * .025;
    ctx.fillStyle = theme.layers[2]; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, shore(x));
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2.2; ctx.beginPath();
    for (let x = 0; x <= W + 10; x += 10) { const y = shore(x) - 3 + Math.sin(x / 30 + t * 1.4) * 2 - (Math.sin(t * .5) * .5 + .5) * 5; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  };

  const drawTree = (tr: typeof trees[number]) => {
    const s = tr.s * 46;
    ctx.strokeStyle = "#6b4a3f"; ctx.lineWidth = s * .14; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.x, tr.y - s * 1.1); ctx.moveTo(tr.x, tr.y - s * .7); ctx.lineTo(tr.x - s * .5, tr.y - s * 1.25); ctx.moveTo(tr.x, tr.y - s * .85); ctx.lineTo(tr.x + s * .55, tr.y - s * 1.3); ctx.stroke();
    const puffs: [number, number, number, string][] = [[0, -1.5, .62, "#ffb3c7"], [-.55, -1.3, .48, "#ffc8d6"], [.6, -1.35, .5, "#ff9fbb"], [-.2, -1.9, .45, "#ffd6e2"], [.3, -1.85, .42, "#ffb3c7"], [.05, -1.15, .4, "#ffa5bf"]];
    for (const [dx, dy, pr, c] of puffs) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(tr.x + dx * s, tr.y + dy * s, pr * s, 0, Math.PI * 2); ctx.fill(); }
  };

  const shapePath = (k: Kite, s: number) => {
    const p = new Path2D();
    if (k.shape === "diamond") { p.moveTo(0, -.55 * s); p.lineTo(.38 * s, -.12 * s); p.lineTo(0, .45 * s); p.lineTo(-.38 * s, -.12 * s); }
    else if (k.shape === "delta") { p.moveTo(0, -.5 * s); p.lineTo(.62 * s, .28 * s); p.lineTo(0, .16 * s); p.lineTo(-.62 * s, .28 * s); }
    else if (k.shape === "rokkaku") { p.moveTo(-.32 * s, -.5 * s); p.lineTo(.32 * s, -.5 * s); p.lineTo(.4 * s, -.12 * s); p.lineTo(.32 * s, .5 * s); p.lineTo(-.32 * s, .5 * s); p.lineTo(-.4 * s, -.12 * s); }
    else { p.rect(-.22 * s, -.55 * s, .44 * s, .32 * s); p.rect(-.22 * s, .13 * s, .44 * s, .32 * s); }
    p.closePath(); return p;
  };

  const drawKiteBody = (k: Kite, s: number) => {
    const outline = shapePath(k, s);
    if (theme.glow) {
      const g = ctx.createRadialGradient(0, -.05 * s, s * .05, 0, 0, s * .7);
      g.addColorStop(0, "#fffbe8"); g.addColorStop(.45, k.color); g.addColorStop(1, k.accent);
      ctx.shadowColor = k.color; ctx.shadowBlur = (high ? 26 : 14) * k.depth;
      ctx.fillStyle = g; ctx.fill(outline); ctx.shadowBlur = 0;
      return;
    }
    if (k.shape === "diamond") {
      const tri = (a: number[], b: number[], c: string) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(a[0] * s, a[1] * s); ctx.lineTo(b[0] * s, b[1] * s); ctx.lineTo(0, -.12 * s); ctx.closePath(); ctx.fill(); };
      tri([0, -.55], [.38, -.12], k.color); tri([.38, -.12], [0, .45], k.accent); tri([0, .45], [-.38, -.12], k.color); tri([-.38, -.12], [0, -.55], k.accent);
    } else if (k.shape === "delta") {
      ctx.fillStyle = k.color; ctx.fill(outline);
      ctx.fillStyle = k.accent; ctx.beginPath(); ctx.moveTo(0, -.5 * s); ctx.lineTo(.16 * s, .2 * s); ctx.lineTo(0, .16 * s); ctx.lineTo(-.16 * s, .2 * s); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(.62 * s, .28 * s); ctx.lineTo(.42 * s, .18 * s); ctx.lineTo(.46 * s, .24 * s); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-.62 * s, .28 * s); ctx.lineTo(-.42 * s, .18 * s); ctx.lineTo(-.46 * s, .24 * s); ctx.closePath(); ctx.fill();
    } else if (k.shape === "rokkaku") {
      ctx.fillStyle = k.color; ctx.fill(outline);
      ctx.fillStyle = k.accent; ctx.beginPath(); ctx.arc(0, -.02 * s, .19 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = k.color; ctx.beginPath(); ctx.arc(0, -.02 * s, .08 * s, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = k.color; ctx.fill(outline);
      ctx.fillStyle = k.accent;
      for (const top of [-.55, .13]) { ctx.beginPath(); ctx.moveTo(.22 * s, top * s); ctx.lineTo(.32 * s, (top + .05) * s); ctx.lineTo(.32 * s, (top + .37) * s); ctx.lineTo(.22 * s, (top + .32) * s); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = Math.max(.6, s * .02);
      ctx.beginPath(); for (const x of [-.22, .22, .32]) { ctx.moveTo(x * s, -.55 * s); ctx.lineTo(x * s, .45 * s); } ctx.stroke();
    }
    // Light from the upper left, then a fine outline and the spars.
    const shade = ctx.createLinearGradient(-.5 * s, -.6 * s, .5 * s, .5 * s);
    shade.addColorStop(0, "rgba(255,255,255,.22)"); shade.addColorStop(1, "rgba(0,0,0,.16)");
    ctx.fillStyle = shade; ctx.fill(outline);
    ctx.strokeStyle = "rgba(0,0,0,.22)"; ctx.lineWidth = Math.max(.6, s * .018); ctx.stroke(outline);
    if (k.shape === "diamond" || k.shape === "rokkaku") {
      ctx.strokeStyle = "rgba(40,30,20,.32)"; ctx.beginPath();
      ctx.moveTo(0, -.55 * s); ctx.lineTo(0, BOTTOM[k.shape] * s);
      ctx.moveTo(-.4 * s, -.12 * s); ctx.lineTo(.4 * s, -.12 * s); ctx.stroke();
    }
  };

  const drawKite = (k: Kite) => {
    const gust = .75 + (Math.sin(t * .11) * .5 + .5) * .5;
    const w = windF * gust;
    const s = k.size;
    const x = k.homeX * W + Math.sin(t * .21 * w + k.phase) * W * .035 * k.depth + Math.sin(t * .63 * w + k.phase * 1.7) * W * .01 * w;
    const y = k.homeY * H + Math.cos(t * .29 * w + k.phase * .9) * H * .03 + Math.sin(t * .87 * w + k.phase) * H * .008 * w;
    const ang = .1 + Math.sin(t * .95 * w + k.phase) * .13 * w + Math.sin(t * 2.3 * w + k.phase) * .03 * w;
    ctx.globalAlpha = theme.night ? .55 + k.depth * .45 : .62 + k.depth * .38;

    if (opts.strings) {
      const bx = x + Math.sin(ang) * s * .05, by = y + s * .02;
      const ax = k.anchorX * W, ay = H + 40;
      ctx.strokeStyle = theme.string; ctx.lineWidth = Math.max(.5, .9 * k.depth);
      ctx.beginPath(); ctx.moveTo(bx, by);
      ctx.quadraticCurveTo((bx + ax) / 2 + W * .02, (by + ay) / 2 + H * .1 / w, ax, ay); ctx.stroke();
    }

    // The tail ripples down and away from the wind.
    const cos = Math.cos(ang), sin = Math.sin(ang), bot = BOTTOM[k.shape] * s;
    const tx = x - sin * bot, ty = y + cos * bot, seg = s * .17;
    const pts: [number, number][] = [[tx, ty]];
    for (let i = 1; i <= k.tail; i++) pts.push([tx - i * seg * .34 * w + Math.sin(t * 4.2 * w - i * .55 + k.phase) * i * seg * .1, ty + i * seg * .86]);
    ctx.strokeStyle = theme.glow ? k.color : k.accent; ctx.lineWidth = Math.max(.7, 1.3 * k.depth);
    if (theme.glow) { ctx.shadowColor = k.color; ctx.shadowBlur = 8; }
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    ctx.stroke(); ctx.shadowBlur = 0;
    for (let i = 2; i < pts.length; i += 2) {
      const [px, py] = pts[i], bs = seg * .5;
      ctx.fillStyle = i % 4 === 0 ? k.color : k.accent;
      if (theme.glow) { ctx.beginPath(); ctx.arc(px, py, bs * .35, 0, Math.PI * 2); ctx.fill(); continue; }
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - bs, py - bs * .5); ctx.lineTo(px - bs, py + bs * .5); ctx.closePath();
      ctx.moveTo(px, py); ctx.lineTo(px + bs, py - bs * .5); ctx.lineTo(px + bs, py + bs * .5); ctx.closePath(); ctx.fill();
    }

    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    drawKiteBody(k, s);
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  const paint = (now: number) => {
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (!reduced) t += dt;
    ctx.fillStyle = sky!; ctx.fillRect(0, 0, W, H);
    if (theme.land === "hills") { ctx.fillStyle = theme.sky[theme.sky.length - 1]; ctx.fillRect(0, H * .8, W, H * .2); }

    for (const s of stars) { ctx.globalAlpha = .35 + Math.abs(Math.sin(t * .8 + s.p)) * .6; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (theme.extras.includes("aurora")) drawAurora();
    drawBody();
    for (const c of clouds) { drawCloud(c); c.x += c.v * dt * windF; if (c.x - 120 * c.s > W) c.x = -160 * c.s; }
    for (const b of birds) {
      const flap = Math.sin(t * 7 + b.p) * 5 * b.s;
      ctx.strokeStyle = theme.night ? "rgba(255,255,255,.5)" : theme.id === "golden" ? "rgba(40,15,35,.75)" : "rgba(30,45,60,.6)";
      ctx.lineWidth = 1.4 * b.s; ctx.beginPath();
      ctx.moveTo(b.x - 9 * b.s, b.y - flap); ctx.quadraticCurveTo(b.x - 4 * b.s, b.y - 3 * b.s, b.x, b.y);
      ctx.quadraticCurveTo(b.x + 4 * b.s, b.y - 3 * b.s, b.x + 9 * b.s, b.y - flap); ctx.stroke();
      b.x += b.v * dt; b.y += Math.sin(t * .7 + b.p) * .15; if (b.x > W + 30) { b.x = -30; }
    }
    if (theme.land === "sea") drawSea();
    else hills.forEach((p, i) => { ctx.fillStyle = theme.layers[i]; ctx.fill(p); if (i === hills.length - 2) for (const tr of trees) drawTree(tr); });

    for (const k of kites) drawKite(k);

    for (const f of flies) {
      const a = .25 + Math.abs(Math.sin(t * 1.3 + f.p)) * .75;
      const fx = f.x + Math.sin(t * .4 + f.p) * 18, fy = f.y + Math.cos(t * .5 + f.p) * 10;
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 9);
      g.addColorStop(0, `rgba(255,236,150,${a})`); g.addColorStop(1, "rgba(255,236,150,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 9, 0, Math.PI * 2); ctx.fill();
    }
    const motes = theme.extras.includes("motes");
    for (const p of petals) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.fillStyle = motes ? `rgba(255,220,170,${.3 + Math.abs(Math.sin(t + p.a)) * .4})` : "rgba(255,183,205,.9)";
      ctx.beginPath(); if (motes) ctx.arc(0, 0, p.r * .45, 0, Math.PI * 2); else ctx.ellipse(0, 0, p.r, p.r * .58, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      p.y += p.v * dt * (motes ? .25 : 1); p.x += (motes ? Math.sin(t + p.a) * 6 : 14 * windF) * dt; p.a += p.spin * dt;
      if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; } if (p.x > W + 10) p.x = -10;
    }
    if (opts.sleepy) { ctx.fillStyle = "rgba(2,6,18,.42)"; ctx.fillRect(0, 0, W, H); }
  };

  const loop = (now: number) => {
    tick++;
    if (high || tick % 2 === 0) paint(now); else last = now;
    raf = requestAnimationFrame(loop);
  };
  layout();
  paint(performance.now());
  if (!reduced) raf = requestAnimationFrame(loop);
  const observer = new ResizeObserver(() => { layout(); if (reduced) paint(performance.now()); });
  observer.observe(canvas);
  return () => { cancelAnimationFrame(raf); observer.disconnect(); };
}
