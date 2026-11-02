// One handwritten page you can write on: Apple Pencil pressure, a finger or a mouse. With "Pencil
// only" (or as soon as an Apple Pencil is used), a finger scrolls and a resting palm doesn't draw.
import { useEffect, useRef, useState } from "react";
import { INK_H, INK_W, type InkPage, type InkTool, type Stroke } from "@shared/arisePages";
import { drawPage, drawStroke, flat, moveStrokes, pointsOf, shapePoints, strokesHit, strokesInLasso, thin, type Pt, type ShapeKind } from "./inkDraw";

export type Tool = InkTool | "eraser" | "lasso";
export type ToolState = { tool: Tool; color: string; width: number; hlColor: string; shape: ShapeKind };

let penSeen = false;
export const pencilWasUsed = () => penSeen;

export default function InkCanvas({ page, tools, pencilOnly, onChange, onPen, label }: {
  page: InkPage; tools: ToolState; pencilOnly: boolean; label: string;
  /** A finished change (a stroke, an erase, a move): the page after it. */
  onChange: (p: InkPage) => void;
  /** The first time an Apple Pencil touches the page (so the finger switches to scrolling). */
  onPen?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [cssW, setCssW] = useState(0);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const live = useRef<{ id: number; pts: Pt[]; erased: Set<number>; start?: Pt; lasso?: Pt[]; moving?: { from: Pt; dx: number; dy: number } } | null>(null);
  const pageRef = useRef(page); pageRef.current = page;

  // Size the canvas to its box (and the screen's sharpness).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCssW(el.clientWidth));
    ro.observe(el);
    setCssW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const scale = cssW / INK_W;
  // The finished page is drawn once into a cache; while writing, only the live stroke is drawn over it.
  const cache = useRef<{ page: InkPage; sel: Set<number>; w: number; c: HTMLCanvasElement } | null>(null);
  const redraw = (extra?: (ctx: CanvasRenderingContext2D) => void, p: InkPage = pageRef.current) => {
    const c = canvas.current;
    if (!c || !cssW) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.round(cssW * dpr), h = Math.round(cssW * (INK_H / INK_W) * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext("2d")!;
    const own = p === pageRef.current;
    let k = cache.current;
    if (!own || !k || k.page !== p || k.sel !== sel || k.w !== w) {
      const off = k?.c ?? document.createElement("canvas");
      if (off.width !== w || off.height !== h) { off.width = w; off.height = h; }
      const octx = off.getContext("2d")!;
      octx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      drawPage(octx, p, { selected: own ? sel : undefined, onBg: () => { cache.current = null; redraw(); } });
      k = { page: p, sel, w, c: off };
      if (own) cache.current = k; else cache.current = null;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(k.c, 0, 0);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    extra?.(ctx);
  };
  useEffect(() => { redraw(); }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSel(new Set()); }, [tools.tool]);

  const at = (e: { clientX: number; clientY: number; pressure: number; pointerType: string }): Pt => {
    const r = canvas.current!.getBoundingClientRect();
    const p = e.pointerType === "pen" ? (e.pressure || 0.5) : 0.5;
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale, p };
  };
  const ignore = (e: React.PointerEvent) => e.pointerType === "touch" && (pencilOnly || penSeen);

  const strokeFor = (pts: Pt[]): Stroke => {
    const t = tools.tool;
    if (t === "hl") return { t: "hl", c: tools.hlColor, w: Math.max(14, tools.width * 5), p: flat(pts) };
    if (t === "shape") return { t: "shape", c: tools.color, w: tools.width, p: flat(pts) };
    return { t: t === "pencil" ? "pencil" : "pen", c: tools.color, w: t === "pencil" ? Math.max(1, tools.width * 0.8) : tools.width, p: flat(pts) };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "pen" && !penSeen) { penSeen = true; onPen?.(); }
    if (ignore(e) || e.button > 0) return;
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    const p = at(e);
    const t = tools.tool;
    if (t === "lasso" && sel.size) {
      // Dragging the selection moves it; a tap elsewhere starts a new lasso.
      const box = selectionBox(pageRef.current, sel);
      if (box && p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1) { live.current = { id: e.pointerId, pts: [], erased: new Set(), moving: { from: p, dx: 0, dy: 0 } }; return; }
      setSel(new Set());
    }
    live.current = { id: e.pointerId, pts: [p], erased: new Set(), start: p, lasso: t === "lasso" ? [p] : undefined };
    if (t === "eraser") erase(p);
  };
  const erase = (p: Pt) => {
    const l = live.current!;
    for (const i of strokesHit(pageRef.current, p.x, p.y, Math.max(10, tools.width * 3))) l.erased.add(i);
    if (l.erased.size) redraw(undefined, { ...pageRef.current, strokes: pageRef.current.strokes.filter((_, i) => !l.erased.has(i)) });
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const l = live.current;
    if (!l || l.id !== e.pointerId) return;
    e.preventDefault();
    const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];
    const t = tools.tool;
    for (const ev of events) {
      const p = at(ev as PointerEvent);
      if (l.moving) { l.moving.dx = p.x - l.moving.from.x; l.moving.dy = p.y - l.moving.from.y; continue; }
      if (t === "eraser") { erase(p); continue; }
      if (l.lasso) { l.lasso.push(p); continue; }
      l.pts.push(p);
    }
    if (t === "eraser") return;
    if (l.moving) { redraw(undefined, moveStrokes(pageRef.current, sel, l.moving.dx, l.moving.dy)); return; }
    if (l.lasso) {
      redraw((ctx) => { ctx.save(); ctx.setLineDash([8, 6]); ctx.strokeStyle = "#6a55dc"; ctx.lineWidth = 2; ctx.beginPath(); l.lasso!.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke(); ctx.restore(); });
      return;
    }
    if (t === "shape") { redraw((ctx) => drawStroke(ctx, strokeFor(shapePoints(tools.shape, l.start!, l.pts[l.pts.length - 1])))); return; }
    redraw((ctx) => drawStroke(ctx, strokeFor(l.pts)));
  };
  const up = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const l = live.current;
    if (!l || l.id !== e.pointerId) return;
    live.current = null;
    const pg = pageRef.current;
    const t = tools.tool;
    if (l.moving) { if (l.moving.dx || l.moving.dy) onChange(moveStrokes(pg, sel, l.moving.dx, l.moving.dy)); return; }
    if (t === "eraser") { if (l.erased.size) onChange({ ...pg, strokes: pg.strokes.filter((_, i) => !l.erased.has(i)) }); return; }
    if (l.lasso) { setSel(new Set(strokesInLasso(pg, l.lasso))); redraw(); return; }
    if (t === "shape") {
      const end = l.pts[l.pts.length - 1];
      if (Math.hypot(end.x - l.start!.x, end.y - l.start!.y) < 4) { redraw(); return; }
      onChange({ ...pg, strokes: [...pg.strokes, strokeFor(shapePoints(tools.shape, l.start!, end))] });
      return;
    }
    onChange({ ...pg, strokes: [...pg.strokes, strokeFor(thin(l.pts))] });
  };

  // Selection tools.
  const delSel = () => { onChange({ ...page, strokes: page.strokes.filter((_, i) => !sel.has(i)) }); setSel(new Set()); };
  const recolorSel = () => { onChange({ ...page, strokes: page.strokes.map((s, i) => (sel.has(i) && s.t !== "hl" ? { ...s, c: tools.color } : s)) }); };
  const dupSel = () => {
    const copies = page.strokes.filter((_, i) => sel.has(i)).map((s) => ({ ...s, p: s.p.map((v, k) => (k % 3 === 2 ? v : v + 24)) }));
    const start = page.strokes.length;
    onChange({ ...page, strokes: [...page.strokes, ...copies] });
    setSel(new Set(copies.map((_, i) => start + i)));
  };

  return <div ref={box} className="relative w-full" style={{ aspectRatio: `${INK_W} / ${INK_H}` }}>
    <canvas ref={canvas} role="img" aria-label={label} className="absolute inset-0 h-full w-full rounded-[6px] shadow-[0_1px_0_rgba(0,0,0,.04),0_10px_30px_-18px_rgba(30,20,90,.45)]"
      style={{ touchAction: pencilOnly || penSeen ? "pan-x pan-y pinch-zoom" : "none", cursor: tools.tool === "lasso" ? "crosshair" : tools.tool === "eraser" ? "cell" : "crosshair" }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
    {sel.size > 0 && <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 gap-1 rounded-full bg-[#1b1a26] p-1 text-[13px] font-semibold text-white shadow-lg">
      <span className="px-2 py-1.5">{sel.size} selected</span>
      <button type="button" className="rounded-full px-3 py-1.5 hover:bg-white/15" onClick={recolorSel}>Recolor</button>
      <button type="button" className="rounded-full px-3 py-1.5 hover:bg-white/15" onClick={dupSel}>Duplicate</button>
      <button type="button" className="rounded-full px-3 py-1.5 text-[#ff8a95] hover:bg-white/15" onClick={delSel}>Delete</button>
    </div>}
  </div>;
}

function selectionBox(page: InkPage, sel: Set<number>) {
  const pts = page.strokes.filter((_, i) => sel.has(i)).flatMap(pointsOf);
  if (!pts.length) return null;
  return { x0: Math.min(...pts.map((p) => p.x)) - 12, y0: Math.min(...pts.map((p) => p.y)) - 12, x1: Math.max(...pts.map((p) => p.x)) + 12, y1: Math.max(...pts.map((p) => p.y)) + 12 };
}
