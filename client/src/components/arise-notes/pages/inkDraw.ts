// Drawing handwritten pages (shared/arisePages.ts InkPage): the paper (lined, grid, dots, Cornell,
// music), an optional background picture, and the strokes, smoothed and thicker where the Apple
// Pencil presses harder. Everything is in page units (1000 wide), scaled to the screen.
import { INK_H, INK_W, PAPER_THEMES, type InkPage, type Stroke } from "@shared/arisePages";

export type Pt = { x: number; y: number; p: number };
export const pointsOf = (s: Stroke): Pt[] => { const out: Pt[] = []; for (let i = 0; i + 2 < s.p.length; i += 3) out.push({ x: s.p[i], y: s.p[i + 1], p: s.p[i + 2] }); return out; };
export const flat = (pts: Pt[]) => pts.flatMap((q) => [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10, Math.round(q.p * 100) / 100]);

// ─── Paper ───────────────────────────────────────────────────────────────────
const bgImages = new Map<string, HTMLImageElement>();
/** A background picture, loaded once; `onLoad` redraws when it arrives. */
function bgImage(src: string, onLoad: () => void): HTMLImageElement | null {
  let img = bgImages.get(src);
  if (!img) { img = new Image(); img.onload = onLoad; img.src = src; bgImages.set(src, img); }
  return img.complete && img.naturalWidth ? img : null;
}

export function drawPaper(ctx: CanvasRenderingContext2D, page: InkPage, onBg: () => void = () => {}) {
  const t = PAPER_THEMES[page.tint] ?? PAPER_THEMES.paper;
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, INK_W, INK_H);
  if (page.bg) {
    const img = bgImage(page.bg, onBg);
    if (img) { const h = (img.naturalHeight / img.naturalWidth) * INK_W; ctx.drawImage(img, 0, 0, INK_W, Math.min(h, INK_H * 1.5)); }
  }
  ctx.strokeStyle = t.line;
  ctx.fillStyle = t.line;
  ctx.lineWidth = 1.4;
  const hLines = (gap: number, from = 110) => { ctx.beginPath(); for (let y = from; y < INK_H - 40; y += gap) { ctx.moveTo(0, y); ctx.lineTo(INK_W, y); } ctx.stroke(); };
  switch (page.paper) {
    case "lined": hLines(36); margin(ctx); break;
    case "narrow": hLines(28); margin(ctx); break;
    case "grid": {
      ctx.beginPath();
      for (let x = 40; x < INK_W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, INK_H); }
      for (let y = 40; y < INK_H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(INK_W, y); }
      ctx.stroke();
      break;
    }
    case "dots": for (let x = 40; x < INK_W; x += 40) for (let y = 40; y < INK_H; y += 40) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); } break;
    case "cornell": {
      hLines(36, 146);
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(0, 110); ctx.lineTo(INK_W, 110); ctx.moveTo(300, 110); ctx.lineTo(300, 1180); ctx.moveTo(0, 1180); ctx.lineTo(INK_W, 1180); ctx.stroke();
      ctx.fillStyle = t.muted; ctx.font = "600 20px -apple-system, system-ui, sans-serif";
      ctx.fillText("Questions", 24, 140); ctx.fillText("Notes", 324, 140); ctx.fillText("Summary", 24, 1212);
      break;
    }
    case "music": {
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let top = 120; top + 48 < INK_H - 60; top += 130) for (let k = 0; k < 5; k++) { ctx.moveTo(60, top + k * 12); ctx.lineTo(INK_W - 60, top + k * 12); }
      ctx.stroke();
      break;
    }
    default: break;
  }
}
function margin(ctx: CanvasRenderingContext2D) {
  ctx.save(); ctx.strokeStyle = "rgba(239, 78, 91, .45)"; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(90, 0); ctx.lineTo(90, INK_H); ctx.stroke(); ctx.restore();
}

// ─── Strokes ─────────────────────────────────────────────────────────────────
/** A stroke's width at a point: thicker with more pressure (a finger or mouse counts as medium). */
const widthAt = (s: Stroke, p: number) => (s.t === "hl" || s.t === "shape" ? s.w : s.w * (0.35 + 0.9 * Math.min(1, Math.max(0, p))));

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, selected = false) {
  const pts = pointsOf(s);
  if (!pts.length) return;
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = s.c; ctx.fillStyle = s.c;
  if (s.t === "hl") { ctx.globalAlpha = 0.38; ctx.globalCompositeOperation = "multiply"; ctx.lineCap = "butt"; }
  else if (s.t === "pencil") ctx.globalAlpha = 0.82;
  if (selected) { ctx.shadowColor = "rgba(106, 85, 220, .9)"; ctx.shadowBlur = 8; }
  if (pts.length === 1) {
    ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, widthAt(s, pts[0].p) / 2, 0, Math.PI * 2); ctx.fill();
  } else if (s.t === "hl" || s.t === "shape") {
    // One path: even width, and the highlighter doesn't darken where it overlaps itself.
    ctx.lineWidth = s.w;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    if (s.t === "shape") for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); // sharp corners
    else for (let i = 1; i < pts.length - 1; i++) { const m = mid(pts[i], pts[i + 1]); ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y); }
    if (s.t !== "shape") ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  } else {
    // Short curved pieces, each as wide as the pressure there.
    let prev = pts[0];
    for (let i = 1; i < pts.length; i++) {
      const cur = pts[i];
      const end = i < pts.length - 1 ? mid(cur, pts[i + 1]) : cur;
      ctx.lineWidth = widthAt(s, (prev.p + cur.p) / 2);
      ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.quadraticCurveTo(cur.x, cur.y, end.x, end.y); ctx.stroke();
      prev = end;
    }
  }
  ctx.restore();
}
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, p: (a.p + b.p) / 2 });

export function drawPage(ctx: CanvasRenderingContext2D, page: InkPage, o: { selected?: Set<number>; onBg?: () => void } = {}) {
  drawPaper(ctx, page, o.onBg);
  page.strokes.forEach((s, i) => drawStroke(ctx, s, o.selected?.has(i)));
}

/** Drops points closer than `min` units together, so long strokes stay small. */
export function thin(pts: Pt[], min = 1.2): Pt[] {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) { const l = out[out.length - 1]; if (Math.hypot(pts[i].x - l.x, pts[i].y - l.y) >= min) out.push(pts[i]); }
  out.push(pts[pts.length - 1]);
  return out;
}

// ─── Eraser, lasso, shapes ───────────────────────────────────────────────────
function segDist(px: number, py: number, a: Pt, b: Pt) {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l)) : 0;
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}
/** The strokes an eraser at (x, y) touches. */
export function strokesHit(page: InkPage, x: number, y: number, r: number): number[] {
  const out: number[] = [];
  page.strokes.forEach((s, i) => {
    const pts = pointsOf(s);
    const reach = r + s.w / 2;
    for (let k = 0; k < pts.length; k++) {
      if (k === 0 ? Math.hypot(x - pts[0].x, y - pts[0].y) <= reach : segDist(x, y, pts[k - 1], pts[k]) <= reach) { out.push(i); break; }
    }
  });
  return out;
}
function inside(poly: Pt[], x: number, y: number) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y || 1e-9) + a.x) hit = !hit;
  }
  return hit;
}
/** Strokes mostly inside a lasso. */
export function strokesInLasso(page: InkPage, lasso: Pt[]): number[] {
  if (lasso.length < 3) return [];
  return page.strokes.flatMap((s, i) => { const pts = pointsOf(s); const n = pts.filter((q) => inside(lasso, q.x, q.y)).length; return n && n >= pts.length * 0.6 ? [i] : []; });
}
export function moveStrokes(page: InkPage, idx: Set<number>, dx: number, dy: number): InkPage {
  return { ...page, strokes: page.strokes.map((s, i) => (idx.has(i) ? { ...s, p: s.p.map((v, k) => (k % 3 === 0 ? v + dx : k % 3 === 1 ? v + dy : v)) } : s)) };
}

export type ShapeKind = "line" | "arrow" | "rect" | "ellipse";
/** A shape from a drag, as stroke points. */
export function shapePoints(kind: ShapeKind, a: Pt, b: Pt): Pt[] {
  const P = (x: number, y: number): Pt => ({ x, y, p: 0.5 });
  if (kind === "line") return [P(a.x, a.y), P(b.x, b.y)];
  if (kind === "arrow") {
    const ang = Math.atan2(b.y - a.y, b.x - a.x), len = Math.min(28, Math.hypot(b.x - a.x, b.y - a.y) * 0.35);
    const l = P(b.x - len * Math.cos(ang - 0.5), b.y - len * Math.sin(ang - 0.5)), r = P(b.x - len * Math.cos(ang + 0.5), b.y - len * Math.sin(ang + 0.5));
    return [P(a.x, a.y), P(b.x, b.y), l, P(b.x, b.y), r];
  }
  if (kind === "rect") return [P(a.x, a.y), P(b.x, a.y), P(b.x, b.y), P(a.x, b.y), P(a.x, a.y)];
  const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
  return Array.from({ length: 65 }, (_, i) => { const t = (i / 64) * Math.PI * 2; return P(cx + rx * Math.cos(t), cy + ry * Math.sin(t)); });
}

/** A page as a JPEG data URL (export, and reading handwriting on the iPhone). */
export function pageImage(page: InkPage, width = 1240, quality = 0.88): string {
  const c = document.createElement("canvas");
  const scale = width / INK_W;
  c.width = width; c.height = Math.round(INK_H * scale);
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  drawPage(ctx, page);
  return c.toDataURL("image/jpeg", quality);
}

/** Strokes as a transparent PNG cropped to what was drawn (a sketch dropped into a typed note). */
export function strokesPng(strokes: Stroke[], scale = 1.5): string | null {
  const pts = strokes.flatMap(pointsOf);
  if (!pts.length) return null;
  const pad = 16 + Math.max(...strokes.map((s) => s.w));
  const x0 = Math.max(0, Math.min(...pts.map((q) => q.x)) - pad), y0 = Math.max(0, Math.min(...pts.map((q) => q.y)) - pad);
  const x1 = Math.min(INK_W, Math.max(...pts.map((q) => q.x)) + pad), y1 = Math.min(INK_H, Math.max(...pts.map((q) => q.y)) + pad);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round((x1 - x0) * scale)); c.height = Math.max(1, Math.round((y1 - y0) * scale));
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale); ctx.translate(-x0, -y0);
  strokes.forEach((s) => drawStroke(ctx, s));
  return c.toDataURL("image/png");
}
