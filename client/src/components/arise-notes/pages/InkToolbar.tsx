// The handwriting tools: pen, pencil, highlighter, shapes, eraser and lasso, with colours, sizes,
// undo, new pages (any paper, or a photo to write on), zoom and "Pencil only".
import { useState, type ReactNode } from "react";
import { Circle, Eraser, Highlighter, ImagePlus, Lasso, Minus, MoveRight, Pencil, PenTool, Plus, Redo2, Square, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { HL_COLORS, INK_COLORS, INK_PAPERS, type InkPaper } from "@shared/arisePages";
import type { ShapeKind } from "./inkDraw";
import type { Tool, ToolState } from "./InkCanvas";

const TOOLS: { id: Tool; label: string; icon: ReactNode }[] = [
  { id: "pen", label: "Pen", icon: <PenTool className="h-5 w-5" /> },
  { id: "pencil", label: "Pencil", icon: <Pencil className="h-5 w-5" /> },
  { id: "hl", label: "Highlighter", icon: <Highlighter className="h-5 w-5" /> },
  { id: "shape", label: "Shapes", icon: <Square className="h-5 w-5" /> },
  { id: "eraser", label: "Eraser", icon: <Eraser className="h-5 w-5" /> },
  { id: "lasso", label: "Select", icon: <Lasso className="h-5 w-5" /> },
];
const SHAPES: { id: ShapeKind; label: string; icon: ReactNode }[] = [
  { id: "line", label: "Line", icon: <Minus className="h-4 w-4" /> }, { id: "arrow", label: "Arrow", icon: <MoveRight className="h-4 w-4" /> },
  { id: "rect", label: "Box", icon: <Square className="h-4 w-4" /> }, { id: "ellipse", label: "Circle", icon: <Circle className="h-4 w-4" /> },
];
const WIDTHS = [1.6, 3, 5.5, 9];

export default function InkToolbar({ tools, setTools, canUndo, canRedo, onUndo, onRedo, pencilOnly, onPencilOnly, zoom, setZoom, onAddPage, onAddPhoto, compact }: {
  tools: ToolState; setTools: (t: ToolState) => void; canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void;
  pencilOnly: boolean; onPencilOnly: (v: boolean) => void; zoom: number; setZoom: (z: number) => void;
  onAddPage?: (paper: InkPaper) => void; onAddPhoto?: () => void; compact?: boolean;
}) {
  const [pages, setPages] = useState(false);
  const set = (p: Partial<ToolState>) => setTools({ ...tools, ...p });
  const hl = tools.tool === "hl";
  const colors = hl ? HL_COLORS : INK_COLORS;
  const current = hl ? tools.hlColor : tools.color;
  const btn = (on: boolean) => `grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${on ? "bg-[var(--an-violet)] text-white shadow" : "text-[#3d3a52] hover:bg-black/5"}`;
  return <div className={`an-noprint ${compact ? "" : "sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-20 border-b border-black/5 bg-white/90 backdrop-blur-xl"}`} data-testid="pages-ink-tools">
    <div className="flex items-center gap-1 overflow-x-auto px-2 py-1.5 [scrollbar-width:none]" role="toolbar" aria-label="Handwriting tools">
      <button type="button" className={btn(false)} disabled={!canUndo} aria-label="Undo" onClick={onUndo}><Undo2 className={`h-5 w-5 ${canUndo ? "" : "opacity-30"}`} /></button>
      <button type="button" className={btn(false)} disabled={!canRedo} aria-label="Redo" onClick={onRedo}><Redo2 className={`h-5 w-5 ${canRedo ? "" : "opacity-30"}`} /></button>
      <span className="mx-1 h-6 w-px shrink-0 bg-black/10" />
      {TOOLS.map((t) => <button key={t.id} type="button" aria-label={t.label} aria-pressed={tools.tool === t.id} title={t.label} className={btn(tools.tool === t.id)} onClick={() => set({ tool: t.id })} data-testid={`pages-tool-${t.id}`}>{t.icon}</button>)}
      <span className="mx-1 h-6 w-px shrink-0 bg-black/10" />
      {tools.tool === "shape" && SHAPES.map((s) => <button key={s.id} type="button" aria-label={s.label} aria-pressed={tools.shape === s.id} className={btn(tools.shape === s.id)} onClick={() => set({ shape: s.id })}>{s.icon}</button>)}
      {tools.tool !== "eraser" && tools.tool !== "lasso" && <>
        {colors.map((c) => <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={current === c} onClick={() => set(hl ? { hlColor: c } : { color: c })}
          className={`h-7 w-7 shrink-0 rounded-full border ${current === c ? "ring-2 ring-[var(--an-violet)] ring-offset-2" : ""}`} style={{ background: c, borderColor: c === "#ffffff" ? "#d4d2e0" : c }} />)}
        <label className="relative grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full border border-dashed border-[#b5b2c8] text-[#6b6880]" aria-label="Any color">
          <Plus className="h-3.5 w-3.5" /><input type="color" className="absolute inset-0 opacity-0" value={current} onChange={(e) => set(hl ? { hlColor: e.target.value } : { color: e.target.value })} />
        </label>
        <span className="mx-1 h-6 w-px shrink-0 bg-black/10" />
      </>}
      {tools.tool !== "lasso" && WIDTHS.map((w) => <button key={w} type="button" aria-label={`Size ${w}`} aria-pressed={tools.width === w} className={btn(tools.width === w)} onClick={() => set({ width: w })}>
        <span className="rounded-full bg-current" style={{ width: Math.min(18, 3 + w * 1.6), height: Math.min(18, 3 + w * 1.6) }} /></button>)}
      {!compact && <>
        <span className="mx-1 h-6 w-px shrink-0 bg-black/10" />
        <button type="button" className={btn(false)} aria-label="Zoom out" onClick={() => setZoom(Math.max(0.6, Math.round((zoom - 0.2) * 10) / 10))}><ZoomOut className="h-5 w-5" /></button>
        <button type="button" className={btn(false)} aria-label="Zoom in" onClick={() => setZoom(Math.min(2.4, Math.round((zoom + 0.2) * 10) / 10))}><ZoomIn className="h-5 w-5" /></button>
        <button type="button" className={`${btn(pencilOnly)} !w-auto px-3 text-[13px] font-semibold`} aria-pressed={pencilOnly} onClick={() => onPencilOnly(!pencilOnly)} title="Only the Apple Pencil draws; your finger scrolls">Pencil only</button>
        {onAddPage && <div className="relative shrink-0">
          <button type="button" className="ml-1 flex h-10 items-center gap-1.5 rounded-xl bg-[var(--an-violet-soft)] px-3 text-[13px] font-bold text-[var(--an-violet-ink)]" onClick={() => setPages(!pages)} aria-expanded={pages} data-testid="pages-add-page"><Plus className="h-4 w-4" />Page</button>
        </div>}
      </>}
    </div>
    {pages && onAddPage && <div className="flex flex-wrap gap-2 border-t border-black/5 px-3 py-2">
      {(Object.keys(INK_PAPERS) as InkPaper[]).map((p) => <button key={p} type="button" className="an-chip" onClick={() => { onAddPage(p); setPages(false); }}>{INK_PAPERS[p]}</button>)}
      {onAddPhoto && <button type="button" className="an-chip" onClick={() => { onAddPhoto(); setPages(false); }}><ImagePlus className="h-3.5 w-3.5" />Photo or worksheet</button>}
    </div>}
  </div>;
}
