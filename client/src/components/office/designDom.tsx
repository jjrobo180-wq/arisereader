// Arise Design on screen: one page drawn with HTML and SVG at any scale (the editor, the page strip and
// the template gallery all use it), and the fonts designs use. Exporting draws the same page on a canvas
// (designRender.ts), from the same numbers.
import { memo, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { ImagePlus } from "lucide-react";
import { DESIGN_FONT_LINK, designShapePath, fillCss, gradientParts, type DEl, type Design, type DPage } from "@shared/office/designModel";

export function loadDesignFonts() {
  if (typeof document === "undefined" || document.getElementById("arise-design-fonts")) return;
  const l = document.createElement("link");
  l.id = "arise-design-fonts"; l.rel = "stylesheet"; l.href = DESIGN_FONT_LINK;
  document.head.appendChild(l);
}

export const fontStack = (f?: string) => `'${f || "Inter"}', 'Inter', system-ui, sans-serif`;

/** One element, positioned on the page. */
export const ElView = memo(function ElView({ el, editing, onDown, onDouble, editRef, frameHint }: {
  el: DEl; editing?: boolean; onDown?: (e: RPointerEvent, el: DEl) => void; onDouble?: (el: DEl) => void; editRef?: React.RefObject<HTMLDivElement>; frameHint?: boolean;
}) {
  const flip = `${el.flipX ? " scaleX(-1)" : ""}${el.flipY ? " scaleY(-1)" : ""}`;
  const box: CSSProperties = { position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h, transform: `${el.rot ? `rotate(${el.rot}deg)` : ""}${flip}` || undefined, opacity: el.opacity ?? 1,
    filter: el.shadow ? `drop-shadow(0 ${Math.max(2, el.h * 0.03)}px ${Math.max(4, el.h * 0.06)}px rgba(0,0,0,.35))` : undefined };
  let body: ReactNode = null;
  if (el.type === "text") {
    const st: CSSProperties = {
      fontFamily: fontStack(el.font), fontSize: el.size, fontWeight: el.weight || 400, fontStyle: el.italic ? "italic" : "normal", color: el.color || "#111827",
      textAlign: el.align || "center", lineHeight: el.lineH || 1.2, letterSpacing: el.letter ? `${el.letter}px` : undefined, textTransform: el.upper ? "uppercase" : undefined,
      textDecoration: el.underline ? "underline" : undefined, whiteSpace: "pre-wrap", overflowWrap: "break-word", width: "100%", outline: "none",
      WebkitTextStroke: el.outline ? `${Math.max(1, (el.size || 40) * 0.04)}px ${el.outline}` : undefined, paintOrder: "stroke fill",
    };
    const inner = el.highlight ? <span style={{ background: el.highlight, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", padding: `0 ${(el.size || 40) * 0.18}px` }}>{el.text}</span> : el.text;
    body = editing
      ? <div ref={editRef} contentEditable="plaintext-only" suppressContentEditableWarning data-design-text style={{ ...st, cursor: "text", minHeight: "1em" }}>{el.text}</div>
      : <div data-design-text style={st}>{inner || "​"}</div>;
  } else if (el.type === "shape") {
    const g = el.fill ? gradientParts(el.fill) : null, gid = `g-${el.id}`;
    body = <svg width="100%" height="100%" viewBox={`0 0 ${el.w} ${el.h}`} overflow="visible" style={{ display: "block" }}>
      {g && <defs><linearGradient id={gid} gradientTransform={`rotate(${g.angle - 90} .5 .5)`}>{g.stops.map((c, i) => <stop key={i} offset={i / (g.stops.length - 1)} stopColor={c} />)}</linearGradient></defs>}
      <path d={designShapePath(el.shape || "rect", el.w, el.h, el.radius)} fill={g ? `url(#${gid})` : el.fill && el.fill !== "none" ? el.fill : "none"} stroke={el.stroke && el.stroke !== "none" ? el.stroke : "none"} strokeWidth={el.strokeW || 0} vectorEffect="non-scaling-stroke" />
    </svg>;
  } else if (el.type === "line") {
    const sw = el.strokeW || 4, mid = el.h / 2, dash = el.line === "dashed" ? `${sw * 3} ${sw * 2}` : el.line === "dotted" ? `0 ${sw * 2}` : undefined;
    body = <svg width="100%" height="100%" viewBox={`0 0 ${el.w} ${el.h}`} overflow="visible" style={{ display: "block" }}>
      <line x1={0} y1={mid} x2={el.line === "arrow" ? el.w - sw * 2 : el.w} y2={mid} stroke={el.stroke || "#111827"} strokeWidth={sw} strokeDasharray={dash} strokeLinecap="round" />
      {el.line === "arrow" && <path d={`M ${el.w - sw * 4} ${mid - sw * 2.4} L ${el.w} ${mid} L ${el.w - sw * 4} ${mid + sw * 2.4} Z`} fill={el.stroke || "#111827"} />}
    </svg>;
  } else if (el.type === "image") {
    const clip = el.shape && el.shape !== "rect" ? `path('${designShapePath(el.shape, el.w, el.h, el.radius)}')` : undefined;
    const round = !clip && el.radius ? el.radius : 0;
    body = el.src
      ? <img src={el.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: el.fit || "cover", display: "block", clipPath: clip, borderRadius: round, background: el.fit === "contain" ? "transparent" : undefined }} />
      : <div style={{ width: "100%", height: "100%", clipPath: clip, borderRadius: round, background: fillCss(el.fill || "#cbd5e1"), display: "grid", placeItems: "center", color: "#475569" }}>
          {frameHint && <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: Math.min(el.w, el.h) * 0.03, fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: Math.max(12, Math.min(el.w, el.h) * 0.06) }}><ImagePlus style={{ width: Math.min(el.w, el.h) * 0.16, height: Math.min(el.w, el.h) * 0.16 }} />Add a photo</span>}
        </div>;
  } else if (el.type === "sticker") {
    body = <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: Math.min(el.w, el.h) * 0.86, lineHeight: 1, fontFamily: "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif" }}>{el.emoji}</div>;
  }
  return <div data-el={el.id} style={box}
    onPointerDown={onDown && !editing ? (e) => { e.stopPropagation(); onDown(e, el); } : undefined}
    onDoubleClick={onDouble ? (e) => { e.stopPropagation(); onDouble(el); } : undefined}>{body}</div>;
});

/** A whole page at `scale` (1 = full size). */
export function PageView({ design, page, scale, children, onBgDown, onElDown, onElDouble, editingId, editRef, live, frameHints, className = "", style }: {
  design: Pick<Design, "w" | "h">; page: DPage; scale: number; children?: ReactNode; onBgDown?: (e: RPointerEvent) => void;
  onElDown?: (e: RPointerEvent, el: DEl) => void; onElDouble?: (el: DEl) => void; editingId?: string | null; editRef?: React.RefObject<HTMLDivElement>;
  live?: Map<string, DEl> | null; frameHints?: boolean; className?: string; style?: CSSProperties;
}) {
  return <div className={`relative overflow-hidden ${className}`} style={{ width: design.w * scale, height: design.h * scale, ...style }} onPointerDown={onBgDown}>
    <div className="absolute left-0 top-0 origin-top-left" style={{ width: design.w, height: design.h, transform: `scale(${scale})`, background: fillCss(page.bg) }}>
      {page.bgImage && <img src={page.bgImage} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />}
      {page.elements.map((e) => { const shown = live?.get(e.id) || e; return <ElView key={e.id} el={shown} editing={editingId === e.id} editRef={editingId === e.id ? editRef : undefined} onDown={onElDown} onDouble={onElDouble} frameHint={frameHints} />; })}
      {children}
    </div>
  </div>;
}

/** A small picture of a design's first page (templates, files). */
export function DesignThumb({ design, width }: { design: Design; width: number }) {
  return <PageView design={design} page={design.pages[0]} scale={width / design.w} className="pointer-events-none rounded-md shadow-sm ring-1 ring-black/5" />;
}
