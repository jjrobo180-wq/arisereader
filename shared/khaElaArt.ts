// Kha ELA worksheets: the pictures. The AI can't draw, so it only DESCRIBES a scene (a setting, a few birds,
// a few props, a speech bubble or two) and this file draws it as SVG, the same way every time, in the flat
// cartoon style of the reference worksheet (pink flamingos, gray pigeons, speech bubbles).
//
// On a screen the pictures move gently (a flamingo sways, a pigeon pecks, the sun's rays turn). The motion is
// slow, never flashes, stops for people who ask their device for reduced motion, stops when printed, and the
// document has a Pause box. All of that is plain CSS: no script runs inside a worksheet.

export const SCENE_W = 400, SCENE_H = 240, GROUND = 196;

export const SETTINGS = ["meadow", "pond", "divided", "rainbow", "sunset", "city", "storm", "night"] as const;
export const BIRDS = ["pigeon", "flamingo", "dove", "crow"] as const;
export const ACTIONS = ["stand", "peck", "fly", "sway", "hop", "sit"] as const;
export const MOODS = ["calm", "happy", "sad", "angry", "proud", "curious"] as const;
export const PROPS = ["sun", "sunbeam", "cloud", "rain", "fence", "wall", "crumbs", "heart", "rainbow", "stars", "notes"] as const;
export type Setting = (typeof SETTINGS)[number];
export type BirdKind = (typeof BIRDS)[number];
export type Action = (typeof ACTIONS)[number];
export type Mood = (typeof MOODS)[number];
export type PropKind = (typeof PROPS)[number];

export type SceneBird = { kind: BirdKind; x: number; size: number; facing: "left" | "right"; action: Action; mood: Mood };
export type SceneProp = { kind: PropKind; x: number };
export type SceneBubble = { who: number; text: string };
export type Scene = { setting: Setting; birds: SceneBird[]; props: SceneProp[]; bubbles: SceneBubble[]; alt: string };

const inList = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (list as readonly string[]).includes(String(v)) ? (String(v) as T) : fallback;
const num = (v: unknown, lo: number, hi: number, dflt: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };
const text = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

/** A scene from the AI's description. Anything unknown becomes a safe default; nothing here can break the page. */
export function cleanScene(v: any): Scene {
  const r = v && typeof v === "object" ? v : {};
  const birds: SceneBird[] = (Array.isArray(r.birds ?? r.characters) ? (r.birds ?? r.characters) : []).slice(0, 5).map((b: any): SceneBird => ({
    kind: inList(BIRDS, b?.kind, "pigeon"), x: num(b?.x, 8, 92, 50), size: num(b?.size, 0.6, 1.4, 1),
    facing: b?.facing === "left" ? "left" : "right", action: inList(ACTIONS, b?.action, "stand"), mood: inList(MOODS, b?.mood, "calm"),
  }));
  const props: SceneProp[] = (Array.isArray(r.props) ? r.props : []).slice(0, 6).map((p: any): SceneProp => {
    const kind = inList(PROPS, typeof p === "string" ? p : p?.kind, "cloud");
    return { kind, x: num(typeof p === "object" ? p?.x : NaN, 0, 100, DEFAULT_X[kind]) };
  });
  const bubbles: SceneBubble[] = (Array.isArray(r.bubbles) ? r.bubbles : []).slice(0, 2).map((b: any): SceneBubble => ({ who: Math.round(num(b?.who, 0, Math.max(0, birds.length - 1), 0)), text: text(b?.text, 34) })).filter((b: SceneBubble) => b.text && birds.length > 0);
  return { setting: inList(SETTINGS, r.setting, "meadow"), birds, props, bubbles, alt: text(r.alt, 200) };
}
const DEFAULT_X: Record<PropKind, number> = { sun: 80, sunbeam: 50, cloud: 25, rain: 25, fence: 50, wall: 50, crumbs: 30, heart: 50, rainbow: 50, stars: 50, notes: 50 };

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f = (n: number) => String(Math.round(n * 10) / 10);

// ─── Settings (the background) ───
function background(s: Setting, id: string): string {
  const sky = (a: string, b: string) => `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${SCENE_W}" height="${SCENE_H}" fill="url(#${id}-sky)"/>`;
  const ground = (c: string) => `<rect x="0" y="${GROUND - 4}" width="${SCENE_W}" height="${SCENE_H - GROUND + 4}" fill="${c}"/>`;
  switch (s) {
    case "pond": return sky("#bfe3f8", "#e4f3fb") + ground("#a8d98c") + `<ellipse cx="290" cy="${GROUND + 14}" rx="82" ry="17" fill="#8ec9ec"/><ellipse cx="290" cy="${GROUND + 14}" rx="60" ry="10" fill="none" stroke="#e8f6ff" stroke-width="1.5"/>`;
    case "divided": return `<rect width="200" height="${SCENE_H}" fill="#fde1ea"/><rect x="200" width="200" height="${SCENE_H}" fill="#dfe4ee"/><rect y="${GROUND - 4}" width="200" height="${SCENE_H - GROUND + 4}" fill="#f0b8c9"/><rect x="200" y="${GROUND - 4}" width="200" height="${SCENE_H - GROUND + 4}" fill="#b5c0d6"/>`;
    case "rainbow": return sky("#fff0cc", "#fde1e6") + ground("#a8d98c");
    case "sunset": return sky("#ffd29a", "#ffb4a2") + ground("#8fbf7a");
    case "city": return sky("#dbe6f1", "#eef3f8") + `<rect x="20" y="70" width="60" height="126" fill="#b9c4d3"/><rect x="95" y="40" width="50" height="156" fill="#a7b3c5"/><rect x="300" y="60" width="70" height="136" fill="#b9c4d3"/><rect x="230" y="100" width="55" height="96" fill="#a7b3c5"/>` + [[32, 84], [52, 84], [32, 110], [52, 110], [106, 58], [126, 58], [106, 90], [126, 90], [312, 76], [338, 76], [312, 104], [338, 104]].map(([x, y]) => `<rect x="${x}" y="${y}" width="10" height="14" fill="#f6f1c8"/>`).join("") + ground("#98a2b3");
    case "storm": return sky("#9aa6b6", "#c5ced9") + ground("#8fb07c");
    case "night": return sky("#1d2b53", "#3a4d86") + ground("#3d5a4a");
    default: return sky("#c9e8fa", "#eaf6fd") + ground("#a8d98c");
  }
}

// ─── Props ───
function prop(p: SceneProp, i: number): string {
  const x = p.x * 4;
  switch (p.kind) {
    case "sun": {
      let rays = "";
      for (let k = 0; k < 12; k++) { const a = (k * Math.PI) / 6; rays += `<line x1="${f(x + Math.cos(a) * 26)}" y1="${f(46 + Math.sin(a) * 26)}" x2="${f(x + Math.cos(a) * 38)}" y2="${f(46 + Math.sin(a) * 38)}" stroke="#f6b73c" stroke-width="3.5" stroke-linecap="round"/>`; }
      return `<g class="a-spin">${rays}</g><circle cx="${f(x)}" cy="46" r="21" fill="#ffd54a"/>`;
    }
    case "sunbeam": return `<polygon points="${f(x)},50 ${f(x - 150)},${GROUND} ${f(x + 150)},${GROUND}" fill="#ffe27a" opacity="0.55"/>`;
    case "cloud": return `<g class="a-drift"><g fill="#fff"><ellipse cx="${f(x)}" cy="${34 + (i % 2) * 10}" rx="30" ry="14"/><ellipse cx="${f(x - 18)}" cy="${40 + (i % 2) * 10}" rx="20" ry="11"/><ellipse cx="${f(x + 20)}" cy="${40 + (i % 2) * 10}" rx="22" ry="11"/></g></g>`;
    case "rain": {
      let d = "";
      for (let k = 0; k < 4; k++) d += `<line class="a-drop" style="animation-delay:${k * 0.4}s" x1="${f(x - 27 + k * 18)}" y1="${70}" x2="${f(x - 31 + k * 18)}" y2="${82}" stroke="#4f86c6" stroke-width="3" stroke-linecap="round"/>`;
      return `<g fill="#8b95a5"><ellipse cx="${f(x)}" cy="52" rx="34" ry="15"/><ellipse cx="${f(x - 20)}" cy="58" rx="22" ry="12"/><ellipse cx="${f(x + 22)}" cy="58" rx="22" ry="12"/></g>${d}`;
    }
    case "fence": {
      let pickets = "";
      for (let k = 0; k < 4; k++) pickets += `<polygon points="${f(x - 28 + k * 15)},${GROUND} ${f(x - 28 + k * 15)},96 ${f(x - 20.5 + k * 15)},86 ${f(x - 13 + k * 15)},96 ${f(x - 13 + k * 15)},${GROUND}" fill="#d2a164" stroke="#9a6b35" stroke-width="1.5"/>`;
      return `${pickets}<rect x="${f(x - 30)}" y="112" width="62" height="8" fill="#b9854a" stroke="#9a6b35" stroke-width="1.2"/><rect x="${f(x - 30)}" y="158" width="62" height="8" fill="#b9854a" stroke="#9a6b35" stroke-width="1.2"/>`;
    }
    case "wall": return `<rect x="${f(x - 28)}" y="70" width="56" height="${GROUND - 70}" fill="#c4745a" stroke="#8f4f3b" stroke-width="2"/>` + [90, 112, 134, 156, 178].map((y) => `<line x1="${f(x - 28)}" y1="${y}" x2="${f(x + 28)}" y2="${y}" stroke="#8f4f3b" stroke-width="1.5"/>`).join("");
    case "crumbs": return [0, 1, 2].map((k) => `<circle cx="${f(x + k * 11)}" cy="${GROUND + 4 + (k % 2) * 4}" r="2.6" fill="#e3a352"/>`).join("");
    case "heart": return `<g class="a-pulse"><path d="M${f(x)} 78 c-14 -14 -34 6 0 28 c34 -22 14 -42 0 -28z" fill="#f0527e" transform="translate(0,-8) scale(0.9) translate(${f(x * 0.1)},0)"/></g>`;
    case "rainbow": {
      const colors = ["#e85d5d", "#f4a259", "#f6d860", "#79c277", "#5aa7e0", "#8f79d6"];
      return colors.map((c, k) => `<path d="M${f(x - 150 + k * 9)} ${GROUND} A${150 - k * 9} ${150 - k * 9} 0 0 1 ${f(x + 150 - k * 9)} ${GROUND}" fill="none" stroke="${c}" stroke-width="9"/>`).join("");
    }
    case "stars": return [[40, 30], [110, 60], [190, 24], [250, 56], [330, 30], [370, 80]].map(([sx, sy], k) => `<circle class="a-twinkle" style="animation-delay:${k * 0.7}s" cx="${sx}" cy="${sy}" r="2.4" fill="#fff6c2"/>`).join("");
    case "notes": return `<g class="a-float" fill="#7c5cc4"><ellipse cx="${f(x)}" cy="92" rx="5" ry="3.6"/><rect x="${f(x + 4)}" y="68" width="2.2" height="24"/><ellipse cx="${f(x + 22)}" cy="82" rx="5" ry="3.6"/><rect x="${f(x + 26)}" y="58" width="2.2" height="24"/><rect x="${f(x + 4)}" y="68" width="24" height="3.5"/></g>`;
  }
}

// ─── Birds (flat cartoon, facing right at scale 1; feet at 0,0) ───
const PALETTE: Record<Exclude<BirdKind, "flamingo">, { body: string; wing: string; tail: string; beak: string; leg: string; neck: string; sheen: string }> = {
  pigeon: { body: "#7b8aa5", wing: "#5f6d86", tail: "#4b5870", beak: "#f0a040", leg: "#e0803a", neck: "#7b8aa5", sheen: "#5fb39a" },
  dove: { body: "#f6f6fa", wing: "#dcdce8", tail: "#c9c9da", beak: "#f0a040", leg: "#e0803a", neck: "#f6f6fa", sheen: "#e6e6f2" },
  crow: { body: "#3c404c", wing: "#2b2e38", tail: "#23252e", beak: "#d9a441", leg: "#2b2e38", neck: "#3c404c", sheen: "#5a5f72" },
};

function face(hx: number, hy: number, mood: Mood): string {
  const eye = mood === "happy" || mood === "proud"
    ? `<path d="M${hx - 2.5} ${hy - 1} q2.5 -3.5 5 0" fill="none" stroke="#1d2433" stroke-width="1.7" stroke-linecap="round"/>`
    : `<circle cx="${hx}" cy="${hy - 1}" r="2.6" fill="#fff"/><circle cx="${hx + 0.8}" cy="${hy - 1}" r="1.3" fill="#1d2433"/>`;
  const brow = mood === "angry" ? `<line x1="${hx - 4}" y1="${hy - 6.5}" x2="${hx + 4}" y2="${hy - 3.5}" stroke="#1d2433" stroke-width="1.8" stroke-linecap="round"/>`
    : mood === "sad" ? `<line x1="${hx - 4}" y1="${hy - 3.5}" x2="${hx + 4}" y2="${hy - 6.5}" stroke="#1d2433" stroke-width="1.6" stroke-linecap="round"/><circle cx="${hx + 1}" cy="${hy + 5}" r="1.7" fill="#6db6e8"/>`
    : mood === "curious" ? `<line x1="${hx - 4}" y1="${hy - 6}" x2="${hx + 4}" y2="${hy - 7.5}" stroke="#1d2433" stroke-width="1.4" stroke-linecap="round"/>` : "";
  const blush = mood === "happy" ? `<circle cx="${hx - 4}" cy="${hy + 4}" r="2.8" fill="#f6a5b0" opacity="0.8"/>` : "";
  return eye + brow + blush;
}

function pigeonLike(kind: Exclude<BirdKind, "flamingo">, mood: Mood, flying: boolean): string {
  const c = PALETTE[kind];
  const legs = flying ? "" : `<g stroke="${c.leg}" stroke-width="3" stroke-linecap="round"><line x1="-6" y1="-15" x2="-6" y2="-2"/><line x1="7" y1="-15" x2="7" y2="-2"/><line x1="-10" y1="-1" x2="-2" y2="-1"/><line x1="3" y1="-1" x2="11" y2="-1"/></g>`;
  const wing = flying ? `<g class="a-flap"><ellipse cx="-2" cy="-44" rx="24" ry="8" fill="${c.wing}" transform="rotate(-24 -2 -44)"/></g>` : "";
  return `${legs}<polygon points="-26,-36 -54,-31 -54,-20 -26,-25" fill="${c.tail}"/><ellipse cx="0" cy="-30" rx="31" ry="17" fill="${c.body}"/><ellipse cx="-4" cy="-30" rx="19" ry="10" fill="${c.wing}"/>${wing}<circle cx="24" cy="-45" r="10.5" fill="${c.body}"/><ellipse cx="15" cy="-40" rx="9" ry="7" fill="${c.sheen}" opacity="0.9"/><polygon points="33,-47 43,-43 33,-40" fill="${c.beak}"/>${face(27, -45, mood)}`;
}

function flamingoShape(mood: Mood, oneLeg: boolean, flying: boolean): string {
  const leg = "#e8588a";
  const legs = flying ? "" : oneLeg
    ? `<g fill="none" stroke="${leg}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="0" y1="-50" x2="0" y2="-2"/><path d="M6 -50 L18 -36 L6 -30"/><line x1="-5" y1="-1" x2="5" y2="-1"/></g>`
    : `<g fill="none" stroke="${leg}" stroke-width="3" stroke-linecap="round"><line x1="-4" y1="-50" x2="-4" y2="-2"/><line x1="9" y1="-50" x2="9" y2="-2"/><line x1="-9" y1="-1" x2="-1" y2="-1"/><line x1="5" y1="-1" x2="13" y2="-1"/></g>`;
  const wing = flying ? `<g class="a-flap"><ellipse cx="-2" cy="-74" rx="24" ry="8" fill="#ec5f93" transform="rotate(-24 -2 -74)"/></g>` : "";
  return `${legs}<polygon points="-22,-68 -42,-56 -22,-55" fill="#f48fb1"/><ellipse cx="0" cy="-62" rx="25" ry="14.5" fill="#f48fb1"/><ellipse cx="-3" cy="-62" rx="15" ry="8" fill="#ec5f93"/>${wing}<path d="M16 -68 C36 -80 6 -98 22 -112" fill="none" stroke="#f48fb1" stroke-width="7.5" stroke-linecap="round"/><circle cx="24" cy="-114" r="7.5" fill="#f48fb1"/><polygon points="29,-117 41,-112 30,-108" fill="#fff0f3" stroke="#d98aa3" stroke-width="0.8"/><polygon points="36,-114.5 41,-112 36,-110.5" fill="#1d2433"/>${face(26.5, -114, mood)}`;
}

function birdHeight(k: BirdKind) { return k === "flamingo" ? 124 : 58; }

function bird(b: SceneBird): { svg: string; headX: number; headTop: number } {
  const x = b.x * 4, lift = b.action === "fly" ? 52 : 0, y = GROUND - lift;
  const flip = b.facing === "left" ? -1 : 1;
  const cls = b.action === "peck" ? "a-peck" : b.action === "sway" ? "a-sway" : b.action === "hop" ? "a-hop" : b.action === "fly" ? "a-fly" : "";
  const inner = b.kind === "flamingo" ? flamingoShape(b.mood, b.action === "stand" || b.action === "sway", b.action === "fly") : pigeonLike(b.kind, b.mood, b.action === "fly");
  const body = b.action === "sit" ? `<g transform="translate(0,12)">${inner}</g>` : inner;
  const svg = `<g transform="translate(${f(x)} ${f(y)}) scale(${f(flip * b.size)} ${f(b.size)})"><g class="${cls}">${body}</g></g>`;
  const headTop = y - birdHeight(b.kind) * b.size - (b.kind === "flamingo" ? 4 : 2);
  return { svg, headX: x + flip * b.size * (b.kind === "flamingo" ? 12 : 14), headTop };
}

// ─── Speech bubbles ───
export function wrapWords(t: string, per = 14): string[] {
  const lines: string[] = []; let line = "";
  for (const w of t.split(" ")) { if (line && (line + " " + w).length > per) { lines.push(line); line = w; } else line = line ? line + " " + w : w; }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}
type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w + 4 && b.x < a.x + a.w + 4 && a.y < b.y + b.h + 4 && b.y < a.y + a.h + 4;

/** Where each bubble goes: above its bird, inside the picture, and never on top of another bubble. */
export function placeBubbles(s: Scene): { box: Box; lines: string[]; tipX: number; tipY: number }[] {
  const out: { box: Box; lines: string[]; tipX: number; tipY: number }[] = [];
  for (const bub of s.bubbles) {
    const b = s.birds[bub.who]; if (!b) continue;
    const g = bird(b);
    const lines = wrapWords(bub.text), w = Math.max(...lines.map((l) => l.length)) * 7 + 18, h = lines.length * 15 + 12;
    const tipX = Math.min(SCENE_W - 12, Math.max(12, g.headX)), tipY = Math.max(h + 10, g.headTop - 4);
    let y = Math.max(4, tipY - 12 - h);
    let x = Math.min(SCENE_W - w - 4, Math.max(4, tipX - w / 2));
    let box: Box = { x, y, w, h };
    for (let tries = 0; tries < 12 && out.some((o) => overlaps(o.box, box)); tries++) {
      const hit = out.find((o) => overlaps(o.box, box))!;
      const right = hit.box.x + hit.box.w + 6, left = hit.box.x - w - 6;
      if (tipX >= hit.box.x + hit.box.w / 2 && right + w <= SCENE_W - 4) x = right;
      else if (left >= 4) x = left;
      else if (right + w <= SCENE_W - 4) x = right;
      else y = Math.max(4, hit.box.y - h - 6);
      box = { x, y, w, h };
    }
    out.push({ box, lines, tipX: Math.min(box.x + box.w - 10, Math.max(box.x + 10, tipX)), tipY: Math.min(box.y + box.h + 12, tipY) });
  }
  return out;
}
function bubblesSvg(s: Scene): string {
  return placeBubbles(s).map(({ box, lines, tipX, tipY }) => {
    const tail = `<polygon points="${f(tipX - 7)},${f(box.y + box.h - 0.5)} ${f(tipX + 7)},${f(box.y + box.h - 0.5)} ${f(tipX)},${f(tipY)}" fill="#fff" stroke="#1d2433" stroke-width="2.4" stroke-linejoin="round"/>`;
    const cover = `<rect x="${f(tipX - 6)}" y="${f(box.y + box.h - 3)}" width="12" height="4.5" fill="#fff"/>`;
    return `<g>${tail}<rect x="${f(box.x)}" y="${f(box.y)}" width="${f(box.w)}" height="${f(box.h)}" rx="12" fill="#fff" stroke="#1d2433" stroke-width="2.4"/>${cover}${lines.map((l, i) => `<text x="${f(box.x + box.w / 2)}" y="${f(box.y + 19 + i * 15)}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="12.5" font-weight="700" fill="#1d2433">${esc(l)}</text>`).join("")}</g>`;
  }).join("");
}

let uid = 0;
/** The whole picture as one inline SVG. */
export function sceneSvg(raw: unknown, opts: { label?: string } = {}): string {
  const s = raw && typeof raw === "object" && "setting" in (raw as any) && Array.isArray((raw as any).birds) && typeof (raw as any).alt === "string" ? (raw as Scene) : cleanScene(raw);
  const id = `sc${++uid}`;
  const behind = s.props.filter((p) => ["sun", "cloud", "stars", "rainbow", "sunbeam"].includes(p.kind));
  const middle = s.props.filter((p) => ["fence", "wall", "crumbs", "rain"].includes(p.kind));
  const front = s.props.filter((p) => ["heart", "notes"].includes(p.kind));
  const birds = [...s.birds].map((b, i) => ({ b, i })).sort((p, q) => p.b.size - q.b.size).map(({ b }) => bird(b).svg).join("");
  const label = esc(opts.label || s.alt || "A cartoon scene");
  return `<svg class="scene" viewBox="0 0 ${SCENE_W} ${SCENE_H}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg"><clipPath id="${id}-c"><rect width="${SCENE_W}" height="${SCENE_H}" rx="10"/></clipPath><g clip-path="url(#${id}-c)">${background(s.setting, id)}${behind.map(prop).join("")}${middle.map(prop).join("")}${birds}${front.map(prop).join("")}${bubblesSvg(s)}</g><rect width="${SCENE_W}" height="${SCENE_H}" rx="10" fill="none" stroke="#1d2433" stroke-width="3"/></svg>`;
}

/** The motion. Slow and gentle, never flashing; off for reduced motion, for print, and when the Pause box is ticked. */
export const ANIM_CSS = `.scene{display:block;width:100%;height:auto}
.a-sway,.a-peck,.a-hop,.a-fly,.a-flap,.a-spin,.a-drift,.a-pulse,.a-float{transform-box:fill-box}
.a-sway{transform-origin:50% 100%;animation:k-sway 4.5s ease-in-out infinite}
.a-peck{transform-origin:25% 100%;animation:k-peck 3.2s ease-in-out infinite}
.a-hop{transform-origin:50% 100%;animation:k-hop 1.8s ease-in-out infinite}
.a-fly{animation:k-fly 4s ease-in-out infinite}
.a-flap{transform-origin:20% 80%;animation:k-flap 1.6s ease-in-out infinite}
.a-spin{transform-origin:50% 50%;animation:k-spin 60s linear infinite}
.a-drift{animation:k-drift 10s ease-in-out infinite}
.a-pulse{transform-origin:50% 50%;animation:k-pulse 2.8s ease-in-out infinite}
.a-float{animation:k-float 5s ease-in-out infinite}
.a-drop{animation:k-drop 1.8s linear infinite}
.a-twinkle{animation:k-twinkle 3.6s ease-in-out infinite}
@keyframes k-sway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
@keyframes k-peck{0%,55%,100%{transform:rotate(0)}65%{transform:rotate(13deg)}75%{transform:rotate(0)}85%{transform:rotate(13deg)}}
@keyframes k-hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes k-fly{0%,100%{transform:translate(0,0)}50%{transform:translate(6px,-6px)}}
@keyframes k-flap{0%,100%{transform:rotate(0)}50%{transform:rotate(18deg)}}
@keyframes k-spin{to{transform:rotate(360deg)}}
@keyframes k-drift{0%,100%{transform:translateX(-6px)}50%{transform:translateX(6px)}}
@keyframes k-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
@keyframes k-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes k-drop{0%{transform:translateY(-4px);opacity:.2}60%{opacity:1}100%{transform:translateY(12px);opacity:.2}}
@keyframes k-twinkle{0%,100%{opacity:.45}50%{opacity:1}}
#pause:checked~* *{animation-play-state:paused!important}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
@media print{*{animation:none!important}}`;
