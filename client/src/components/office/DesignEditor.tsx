// Arise Design: a Canva-style editor. Pick a size or one of 80+ templates, then add text, shapes, lines,
// photo frames, stickers and your own pictures; drag, resize and rotate them with smart guides; change
// fonts, colors, gradients and effects; arrange layers; add pages; let Magic Design make four looks from
// a sentence; and download PNG, JPG or a multi-page PDF. It saves by itself to the person's account.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, Copy, Download, FlipHorizontal, FlipVertical, Image as ImageIcon, ImagePlus, Italic, Layers, LayoutTemplate,
  Lock, Minus, PaintBucket, Plus, Search, Shapes, Sparkles, Trash2, Type, Underline, Unlock, Upload, X, CaseUpper, ChevronUp, ChevronDown, Wand2,
} from "lucide-react";
import { Redo2, Undo2, BringToFront, SendToBack } from "./icons";
import { useAuth } from "@/context/AuthContext";
import { askAppAi, saveLabel, useCloudDoc } from "@/lib/cloudDocs";
import {
  DESIGN_AI_TASK, DESIGN_FONTS, GRADIENTS, SHAPES, SIZES, STICKERS, SWATCHES, TEXT_PRESETS, builtinCopy, cleanCopy, cleanDesign, dId, designShapePath, fillCss, resizeDesign, sizeOf,
  type DEl, type Design, type DPage, type ShapeKind,
} from "@shared/office/designModel";
import { TEMPLATES, TEMPLATE_CATEGORIES, magicDesigns } from "@shared/office/designTemplates";
import { DesignThumb, PageView, fontStack, loadDesignFonts } from "./designDom";
import { exportImage, exportPdf, shrinkImage } from "./designRender";
import { DropButton, downloadBlob, safeName } from "./officeUi";

type Handle = ReturnType<typeof useCloudDoc<Design>> & { content: Design };
type Panel = "templates" | "elements" | "text" | "uploads" | "background" | "layers" | "magic";
const PANELS: { id: Panel; label: string; icon: ReactNode }[] = [
  { id: "templates", label: "Design", icon: <LayoutTemplate size={20} /> },
  { id: "elements", label: "Elements", icon: <Shapes size={20} /> },
  { id: "text", label: "Text", icon: <Type size={20} /> },
  { id: "uploads", label: "Uploads", icon: <Upload size={20} /> },
  { id: "background", label: "Background", icon: <PaintBucket size={20} /> },
  { id: "magic", label: "Magic", icon: <Sparkles size={20} /> },
  { id: "layers", label: "Layers", icon: <Layers size={20} /> },
];
const FRAMES: { shape: ShapeKind; label: string }[] = [
  { shape: "rect", label: "Square" }, { shape: "round", label: "Rounded" }, { shape: "ellipse", label: "Circle" }, { shape: "arch", label: "Arch" },
  { shape: "heart", label: "Heart" }, { shape: "star", label: "Star" }, { shape: "blob", label: "Blob" }, { shape: "hexagon", label: "Hexagon" },
];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const isTouch = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export default function DesignEditor({ id, onBack }: { id: string; onBack: () => void; onOpen?: (id: string) => void }) {
  const doc = useCloudDoc<Design>(id, cleanDesign);
  useEffect(() => { loadDesignFonts(); }, []);
  if (!doc.content) return <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 bg-white text-slate-600">
    {doc.loading ? <><div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" /><p className="text-sm font-semibold">Opening design…</p></>
      : <><p className="text-sm font-semibold">{doc.error || "That design couldn't be opened."}</p><button type="button" onClick={onBack} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Back to files</button></>}
  </div>;
  return <Studio doc={doc as Handle} onBack={onBack} />;
}

function Studio({ doc, onBack }: { doc: Handle; onBack: () => void }) {
  const { token } = useAuth();
  const design = doc.content;
  const ref = useRef(design); ref.current = design;
  const past = useRef<Design[]>([]); const future = useRef<Design[]>([]);
  const [, bump] = useState(0);
  const commit = useCallback((fn: (d: Design) => Design) => {
    const prev = ref.current, next = fn(prev);
    if (next === prev) return;
    past.current.push(prev); if (past.current.length > 150) past.current.shift(); future.current = [];
    ref.current = next; doc.setContent(next); bump((x) => x + 1);
  }, [doc]);
  /** A change that isn't its own undo step (a text box growing to fit its words). */
  const quiet = useCallback((fn: (d: Design) => Design) => { const next = fn(ref.current); if (next === ref.current) return; ref.current = next; doc.setContent(next); bump((x) => x + 1); }, [doc]);
  const undo = () => { const p = past.current.pop(); if (!p) return; future.current.push(ref.current); ref.current = p; doc.setContent(p); setSel([]); bump((x) => x + 1); };
  const redo = () => { const f = future.current.pop(); if (!f) return; past.current.push(ref.current); ref.current = f; doc.setContent(f); setSel([]); bump((x) => x + 1); };

  const [pi, setPi] = useState(0);
  const pageIndex = Math.min(pi, design.pages.length - 1);
  const page = design.pages[pageIndex];
  const [sel, setSel] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<Panel | null>(() => (typeof window !== "undefined" && window.innerWidth >= 1024 ? "templates" : null));
  const [dialog, setDialog] = useState<null | "download" | "resize">(null);
  const [toast, setToast] = useState("");
  const say = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast((t) => (t === m ? "" : t)), 3200); }, []);
  const selected = page.elements.filter((e) => sel.includes(e.id));
  const one = selected.length === 1 ? selected[0] : null;
  const clip = useRef<DEl[]>([]);

  const updPage = useCallback((fn: (p: DPage) => DPage, i = pageIndex) => commit((d) => ({ ...d, pages: d.pages.map((p, k) => (k === i ? fn(p) : p)) })), [commit, pageIndex]);
  const updEls = (ids: string[], patch: Partial<DEl> | ((e: DEl) => DEl)) => updPage((p) => ({ ...p, elements: p.elements.map((e) => (ids.includes(e.id) ? (typeof patch === "function" ? patch(e) : { ...e, ...patch }) : e)) }));
  const addEls = (els: DEl[]) => { if (!els.length) return; updPage((p) => ({ ...p, elements: [...p.elements, ...els] })); setSel(els.map((e) => e.id)); if (window.innerWidth < 1024) setPanel(null); };

  // ─── Fitting the page on screen ───
  const area = useRef<HTMLDivElement>(null);
  const [areaSize, setAreaSize] = useState({ w: 800, h: 600 });
  useLayoutEffect(() => { const el = area.current; if (!el) return; const ro = new ResizeObserver(() => setAreaSize({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el); setAreaSize({ w: el.clientWidth, h: el.clientHeight }); return () => ro.disconnect(); }, []);
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  // Room around the page, so it reads as a page and its handles can be grabbed at the edges.
  const pad = areaSize.w < 640 ? 44 : 72;
  const fit = Math.max(0.02, Math.min((areaSize.w - pad) / design.w, (areaSize.h - pad) / design.h));
  const scale = zoom === "fit" ? fit : zoom;

  // ─── Text boxes grow and shrink to fit their words (not an undo step) ───
  useLayoutEffect(() => {
    const root = area.current; if (!root || drag.current) return;
    const fixes: Record<string, number> = {};
    for (const e of page.elements) {
      if (e.type !== "text") continue;
      const node = root.querySelector<HTMLElement>(`[data-el="${e.id}"] [data-design-text]`);
      if (!node) continue;
      const h = Math.ceil(node.offsetHeight);
      if (h > 0 && Math.abs(h - e.h) > 1) fixes[e.id] = h;
    }
    if (Object.keys(fixes).length) quiet((d) => ({ ...d, pages: d.pages.map((p, k) => (k === pageIndex ? { ...p, elements: p.elements.map((e) => (fixes[e.id] ? { ...e, h: fixes[e.id] } : e)) } : p)) }));
  });

  // ─── Editing words ───
  const finishEdit = useCallback(() => {
    const idd = editing; if (!idd) return;
    const text = (editRef.current?.innerText ?? "").replace(/\n$/, "");
    setEditing(null);
    const before = ref.current.pages[pageIndex].elements.find((e) => e.id === idd);
    if (!before) return;
    if (!text.trim()) { updPage((p) => ({ ...p, elements: p.elements.filter((e) => e.id !== idd) })); setSel([]); return; }
    if (text !== before.text) updPage((p) => ({ ...p, elements: p.elements.map((e) => (e.id === idd ? { ...e, text } : e)) }));
  }, [editing, pageIndex, updPage]);
  const startEdit = (e: DEl) => {
    if (e.type !== "text" || e.locked) return;
    setSel([e.id]); setEditing(e.id);
    window.setTimeout(() => { const r = editRef.current; if (!r) return; r.focus(); const range = document.createRange(); range.selectNodeContents(r); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(range); }, 0);
  };

  // ─── Pointer: select, move (with smart guides), resize, rotate ───
  const drag = useRef<null | { kind: "move" | "resize" | "rotate"; handle?: string; x0: number; y0: number; start: Map<string, DEl>; moved: boolean; wasSelected: boolean }>(null);
  const live = useRef<Map<string, DEl> | null>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [, rerender] = useState(0);
  const onElDown = (e: React.PointerEvent, el: DEl) => {
    if (editing && el.id !== editing) finishEdit();
    if (editing === el.id) return;
    if (e.shiftKey || e.metaKey || e.ctrlKey) { setSel((s) => (s.includes(el.id) ? s.filter((x) => x !== el.id) : [...s, el.id])); return; }
    const wasSelected = sel.includes(el.id);
    const ids = wasSelected ? sel : [el.id];
    if (!wasSelected) setSel([el.id]);
    const movable = page.elements.filter((x) => ids.includes(x.id) && !x.locked);
    drag.current = { kind: "move", x0: e.clientX, y0: e.clientY, start: new Map(movable.map((x) => [x.id, x])), moved: false, wasSelected };
    area.current?.setPointerCapture?.(e.pointerId);
  };
  const onHandleDown = (e: React.PointerEvent, handle: string) => {
    e.stopPropagation(); e.preventDefault();
    drag.current = { kind: handle === "rot" ? "rotate" : "resize", handle, x0: e.clientX, y0: e.clientY, start: new Map(selected.filter((x) => !x.locked).map((x) => [x.id, x])), moved: false, wasSelected: true };
    area.current?.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = (e.clientX - d.x0) / scale, dy = (e.clientY - d.y0) / scale;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return;
    d.moved = true;
    const next = new Map<string, DEl>();
    const g = { v: [] as number[], h: [] as number[] };
    const W = design.w, H = design.h, snap = 7 / scale;
    if (d.kind === "move") {
      // The whole selection moves together; its outer box snaps to the page and to the other elements.
      const all = Array.from(d.start.values());
      const bx = Math.min(...all.map((s) => s.x)), by = Math.min(...all.map((s) => s.y)), bw = Math.max(...all.map((s) => s.x + s.w)) - bx, bh = Math.max(...all.map((s) => s.y + s.h)) - by;
      let ox = dx, oy = dy;
      if (!e.altKey) {
        const others = page.elements.filter((x) => !d.start.has(x.id));
        const vx = [0, W / 2, W, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])], hy = [0, H / 2, H, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
        let best = snap + 1;
        for (const t of vx) for (const edge of [0, bw / 2, bw]) { const diff = t - (bx + dx + edge); if (Math.abs(diff) < Math.min(best, snap)) { best = Math.abs(diff); ox = dx + diff; g.v = [t]; } }
        best = snap + 1;
        for (const t of hy) for (const edge of [0, bh / 2, bh]) { const diff = t - (by + dy + edge); if (Math.abs(diff) < Math.min(best, snap)) { best = Math.abs(diff); oy = dy + diff; g.h = [t]; } }
      }
      for (const [k, s] of d.start) next.set(k, { ...s, x: Math.round(s.x + ox), y: Math.round(s.y + oy) });
    } else if (d.kind === "resize") {
      for (const [k, s] of d.start) {
        const h = d.handle!, corner = h.length === 2;
        let { x, y, w, h: hh } = s;
        if (h.includes("e")) w = Math.max(8, s.w + dx);
        if (h.includes("s")) hh = Math.max(8, s.h + dy);
        if (h.includes("w")) { w = Math.max(8, s.w - dx); x = s.x + s.w - w; }
        if (h.includes("n")) { hh = Math.max(8, s.h - dy); y = s.y + s.h - hh; }
        const keep = corner && (e.shiftKey || s.type === "image" || s.type === "sticker" || s.type === "text");
        if (keep) { const r = s.w / s.h; if (w / hh > r) w = hh * r; else hh = w / r; if (h.includes("w")) x = s.x + s.w - w; if (h.includes("n")) y = s.y + s.h - hh; }
        const out: DEl = { ...s, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(hh) };
        // Text: a corner grows the words with the box; a side changes where they wrap.
        if (s.type === "text" && corner) { const k2 = w / s.w; out.size = Math.max(4, Math.round((s.size || 40) * k2)); if (s.letter) out.letter = Math.round(s.letter * k2); }
        if (s.type === "line") { out.h = s.h; out.y = s.y; }
        next.set(k, out);
      }
    } else {
      for (const [k, s] of d.start) {
        const node = area.current!.querySelector<HTMLElement>(`[data-el="${k}"]`); if (!node) continue;
        const r = node.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let a = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
        if (!e.shiftKey) { const near = Math.round(a / 45) * 45; if (Math.abs(a - near) < 5) a = near; }
        next.set(k, { ...s, rot: ((Math.round(a) % 360) + 360) % 360 || undefined });
      }
    }
    live.current = next; setGuides(g); rerender((x) => x + 1);
  };
  const onUp = () => {
    const d = drag.current; drag.current = null; setGuides({ v: [], h: [] });
    if (!d) return;
    const l = live.current; live.current = null;
    if (d.moved && l) updPage((p) => ({ ...p, elements: p.elements.map((e) => l.get(e.id) || e) }));
    else {
      // A tap on text that was already selected starts typing (phones have no double-click).
      const only = d.start.size === 1 ? Array.from(d.start.values())[0] : null;
      if (d.kind === "move" && d.wasSelected && only?.type === "text") startEdit(only);
      else if (d.kind === "move" && d.wasSelected && only?.type === "image" && !only.src) void addPicture(only);
      rerender((x) => x + 1);
    }
  };
  const onBgDown = (e: React.PointerEvent) => { if (e.target !== e.currentTarget && !(e.target as HTMLElement).closest?.("[data-page-bg]")) return; if (editing) finishEdit(); setSel([]); };

  // ─── Adding things ───
  const center = (w: number, h: number) => ({ x: Math.round((design.w - w) / 2), y: Math.round((design.h - h) / 2), w: Math.round(w), h: Math.round(h) });
  const u = Math.min(design.w, design.h);
  const addText = (presetId: string) => {
    const preset = TEXT_PRESETS.find((p) => p.id === presetId)!;
    const parts = preset.make(design.w, design.h);
    let y = design.h * 0.38;
    const els = parts.map((p) => { const w = Math.round(p.w || design.w * 0.7), size = p.size || 48, h = Math.round(size * (p.lineH || 1.2)); const el: DEl = { ...(p as DEl), id: dId(), x: Math.round((design.w - w) / 2), y: Math.round(y), w, h }; y += h + size * 0.35; return el; });
    addEls(els);
    if (els.length === 1) window.setTimeout(() => startEdit(els[0]), 30);
  };
  const addShape = (shape: ShapeKind) => addEls([{ id: dId(), type: "shape", shape, ...center(u * 0.35, shape === "arrow" ? u * 0.2 : u * 0.35), fill: "#8b5cf6" }]);
  const addLine = (line: DEl["line"]) => addEls([{ id: dId(), type: "line", line, ...center(u * 0.5, Math.max(20, u * 0.04)), stroke: "#111827", strokeW: Math.max(3, Math.round(u * 0.008)) }]);
  const addFrame = (shape: ShapeKind) => addEls([{ id: dId(), type: "image", shape, fit: "cover", fill: "#cbd5e1", ...center(u * 0.45, shape === "arch" ? u * 0.6 : u * 0.45), ...(shape === "round" ? { radius: u * 0.04 } : {}) }]);
  const addSticker = (emoji: string) => addEls([{ id: dId(), type: "sticker", emoji, ...center(u * 0.2, u * 0.2) }]);
  const addImageSrc = (src: string, w: number, h: number) => { const r = Math.min((design.w * 0.6) / w, (design.h * 0.6) / h); addEls([{ id: dId(), type: "image", src, fit: "cover", ...center(w * r, h * r) }]); };
  const imgSize = (src: string) => new Promise<{ w: number; h: number }>((ok) => { const i = new Image(); i.onload = () => ok({ w: i.width, h: i.height }); i.onerror = () => ok({ w: 800, h: 600 }); i.src = src; });
  const upload = async (): Promise<{ src: string; w: number; h: number }[]> => {
    const files = await new Promise<File[]>((resolve) => { const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.multiple = true; input.onchange = () => resolve(Array.from(input.files || [])); input.click(); });
    const out: { src: string; w: number; h: number }[] = [];
    for (const f of files.slice(0, 10)) { try { out.push(await shrinkImage(f)); } catch (e: any) { say(e.message); } }
    if (out.length) commit((d) => ({ ...d, uploads: [...out.map((o) => o.src), ...d.uploads.filter((s) => !out.some((o) => o.src === s))].slice(0, 30) }));
    return out;
  };
  /** A frame (or a picture) gets a new picture; the frame keeps its shape. */
  const addPicture = async (into?: DEl) => {
    const [first] = await upload(); if (!first) return;
    if (into) updEls([into.id], { src: first.src }); else addImageSrc(first.src, first.w, first.h);
  };

  // ─── Arranging ───
  const remove = () => { const ids = selected.filter((e) => !e.locked).map((e) => e.id); if (!ids.length) return; updPage((p) => ({ ...p, elements: p.elements.filter((e) => !ids.includes(e.id)) })); setSel([]); };
  const duplicate = () => { const copies = selected.map((e) => ({ ...e, id: dId(), x: e.x + Math.round(u * 0.03), y: e.y + Math.round(u * 0.03), locked: undefined })); if (!copies.length) return; updPage((p) => ({ ...p, elements: [...p.elements, ...copies] })); setSel(copies.map((c) => c.id)); };
  const order = (dir: "front" | "back" | "up" | "down") => updPage((p) => {
    const els = [...p.elements], ids = new Set(sel);
    if (dir === "front") return { ...p, elements: [...els.filter((e) => !ids.has(e.id)), ...els.filter((e) => ids.has(e.id))] };
    if (dir === "back") return { ...p, elements: [...els.filter((e) => ids.has(e.id)), ...els.filter((e) => !ids.has(e.id))] };
    const i = els.findIndex((e) => ids.has(e.id)), j = i + (dir === "up" ? 1 : -1);
    if (i < 0 || j < 0 || j >= els.length) return p;
    [els[i], els[j]] = [els[j], els[i]]; return { ...p, elements: els };
  });
  const alignTo = (how: "left" | "center" | "right" | "top" | "middle" | "bottom") => updEls(sel, (e) => ({ ...e,
    ...(how === "left" ? { x: 0 } : how === "center" ? { x: Math.round((design.w - e.w) / 2) } : how === "right" ? { x: design.w - e.w } : how === "top" ? { y: 0 } : how === "middle" ? { y: Math.round((design.h - e.h) / 2) } : { y: design.h - e.h }) }));

  // ─── Pages ───
  const addPage = (from?: DPage) => { const pg: DPage = from ? { ...JSON.parse(JSON.stringify(from)), id: dId() } : { id: dId(), bg: "#ffffff", elements: [] }; if (from) pg.elements.forEach((e) => { e.id = dId(); }); commit((d) => { const pages = [...d.pages]; pages.splice(pageIndex + 1, 0, pg); return { ...d, pages }; }); setPi(pageIndex + 1); setSel([]); };
  const delPage = (i: number) => { if (design.pages.length <= 1) { say("A design needs at least one page."); return; } commit((d) => ({ ...d, pages: d.pages.filter((_, k) => k !== i) })); setPi(Math.max(0, Math.min(i, design.pages.length - 2))); setSel([]); };
  const movePage = (i: number, to: number) => { if (to < 0 || to >= design.pages.length) return; commit((d) => { const pages = [...d.pages]; const [p] = pages.splice(i, 1); pages.splice(to, 0, p); return { ...d, pages }; }); setPi(to); };
  /** A template (or a magic design) on this page: made for this size, it's used as is; otherwise it's resized to fit. */
  const usePage = (src: Design, mode: "replace" | "add") => {
    const fitted = src.w === design.w && src.h === design.h ? src : resizeDesign(src, design.w, design.h, design.size);
    const pg = { ...fitted.pages[0], id: dId(), elements: fitted.pages[0].elements.map((e) => ({ ...e, id: dId() })) };
    if (mode === "add" || page.elements.length === 0 && mode !== "replace") { /* fall through to replace when empty */ }
    if (mode === "add") { commit((d) => { const pages = [...d.pages]; pages.splice(pageIndex + 1, 0, pg); return { ...d, pages }; }); setPi(pageIndex + 1); }
    else commit((d) => ({ ...d, pages: d.pages.map((p, k) => (k === pageIndex ? pg : p)) }));
    setSel([]); if (window.innerWidth < 1024) setPanel(null);
  };

  // ─── Keys ───
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (dialog) return;
      const t = e.target as HTMLElement;
      if (editing || t.closest?.("input, textarea, select, [contenteditable]")) { if (e.key === "Escape" && editing) finishEdit(); return; }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
      else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicate(); }
      else if (mod && e.key.toLowerCase() === "c" && selected.length) { clip.current = selected.map((x) => ({ ...x })); }
      else if (mod && e.key.toLowerCase() === "v" && clip.current.length) { e.preventDefault(); addEls(clip.current.map((x) => ({ ...x, id: dId(), x: x.x + Math.round(u * 0.03), y: x.y + Math.round(u * 0.03) }))); }
      else if (mod && e.key.toLowerCase() === "a") { e.preventDefault(); setSel(page.elements.map((x) => x.id)); }
      else if ((e.key === "Delete" || e.key === "Backspace") && sel.length) { e.preventDefault(); remove(); }
      else if (e.key === "Escape") setSel([]);
      else if (e.key === "Enter" && one?.type === "text") { e.preventDefault(); startEdit(one); }
      else if (e.key.startsWith("Arrow") && sel.length) {
        e.preventDefault(); const s = e.shiftKey ? 10 : 1;
        updEls(sel.filter((x) => !page.elements.find((y) => y.id === x)?.locked), (el) => ({ ...el, x: el.x + (e.key === "ArrowLeft" ? -s : e.key === "ArrowRight" ? s : 0), y: el.y + (e.key === "ArrowUp" ? -s : e.key === "ArrowDown" ? s : 0) }));
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const shownPage: DPage = live.current ? { ...page, elements: page.elements.map((e) => live.current!.get(e.id) || e) } : page;
  const shownSel = shownPage.elements.filter((e) => sel.includes(e.id));
  const hs = (isTouch() ? 18 : 12) / scale;

  return <div className="flex h-full min-h-0 flex-col bg-[#eef0f5] text-slate-900" data-testid="design-editor">
    {/* Top bar */}
    {/* A clean white bar (the page is the colorful part): back, the name and how it's saving, undo, Download. */}
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-slate-200/80 bg-white px-1.5 text-slate-900 sm:gap-2 sm:px-3">
      <button type="button" onClick={async () => { finishEdit(); await doc.flush(); onBack(); }} aria-label="Back to designs" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-700 hover:bg-slate-100"><ArrowLeft size={21} /></button>
      <div className="min-w-0 flex-1 sm:flex-none">
        <input value={doc.name} onChange={(e) => doc.setName(e.target.value)} aria-label="Design name" data-testid="design-name" className="block w-full min-w-0 rounded-md bg-transparent px-1.5 text-[15.5px] font-bold leading-tight outline-none hover:bg-slate-100 focus:bg-slate-100 sm:w-64" />
        <button type="button" onClick={() => setDialog("resize")} className="block max-w-full truncate px-1.5 text-left text-[11.5px] font-semibold text-slate-500 hover:text-violet-700" data-testid="design-resize">{sizeOf(design.size)?.name || `${design.w} × ${design.h}`} · {saveLabel(doc.state)}</button>
      </div>
      <span className="hidden flex-1 sm:block" />
      <button type="button" onClick={undo} disabled={!past.current.length} aria-label="Undo" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-700 hover:bg-slate-100 disabled:text-slate-300"><Undo2 size={19} /></button>
      <button type="button" onClick={redo} disabled={!future.current.length} aria-label="Redo" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-700 hover:bg-slate-100 disabled:text-slate-300"><Redo2 size={19} /></button>
      <button type="button" onClick={() => setPanel("magic")} className="hidden h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold text-violet-700 hover:bg-violet-50 sm:inline-flex"><Wand2 size={16} />Magic</button>
      <button type="button" onClick={() => { finishEdit(); setDialog("download"); }} aria-label="Download" className="ml-0.5 inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-violet-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-violet-700" data-testid="design-download"><Download size={17} /><span className="hidden min-[380px]:inline">Download</span></button>
    </header>

    <div className="relative flex min-h-0 flex-1">
      {/* Side rail (bigger screens) */}
      <nav className="hidden w-[76px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-slate-200 bg-white py-2 lg:flex" aria-label="Design tools">
        {PANELS.map((p) => <button key={p.id} type="button" onClick={() => setPanel(panel === p.id ? null : p.id)} aria-pressed={panel === p.id} data-testid={`design-rail-${p.id}`}
          className={`flex w-[64px] flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold ${panel === p.id ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-50"}`}>{p.icon}{p.label}</button>)}
      </nav>
      {panel && <aside className="absolute inset-x-0 bottom-0 z-30 flex max-h-[62%] flex-col rounded-t-3xl border-t border-slate-200 bg-white shadow-[0_-10px_40px_rgba(15,23,42,.18)] lg:static lg:z-auto lg:max-h-none lg:w-[340px] lg:shrink-0 lg:rounded-none lg:border-r lg:border-t-0 lg:shadow-none" data-testid={`design-panel-${panel}`}>
        <div className="flex items-center gap-2 px-4 pb-2 pt-3"><span className="mx-auto mb-1 block h-1.5 w-10 rounded-full bg-slate-200 lg:hidden" /></div>
        <div className="flex items-center justify-between px-4 pb-2"><h2 className="text-lg font-black">{PANELS.find((p) => p.id === panel)!.label === "Design" ? "Templates" : PANELS.find((p) => p.id === panel)!.label}</h2>
          <button type="button" onClick={() => setPanel(null)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100"><X size={18} /></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
          {panel === "templates" && <TemplatesPanel design={design} onUse={(d, mode) => usePage(d, mode)} />}
          {panel === "elements" && <ElementsPanel onShape={addShape} onLine={addLine} onFrame={addFrame} onSticker={addSticker} />}
          {panel === "text" && <div className="space-y-2">{TEXT_PRESETS.map((p, i) => { const first = p.make(1000, 1000)[0]; return <button key={p.id} type="button" onClick={() => addText(p.id)} data-testid={`design-text-${p.id}`}
            className={`w-full rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-violet-300 hover:bg-violet-50/40 ${i < 3 ? "bg-slate-50" : ""}`}
            style={{ fontFamily: fontStack(first.font), fontWeight: first.weight, fontStyle: first.italic ? "italic" : undefined, fontSize: i === 0 ? 26 : i === 1 ? 19 : i === 2 ? 14 : 20, color: first.color, textTransform: first.upper ? "uppercase" : undefined, letterSpacing: first.letter ? 1 : undefined }}>
            {first.highlight ? <span style={{ background: first.highlight, padding: "0 6px" }}>{p.label}</span> : p.label}</button>; })}</div>}
          {panel === "uploads" && <div className="space-y-3">
            <button type="button" onClick={async () => { const got = await upload(); if (got.length === 1) addImageSrc(got[0].src, got[0].w, got[0].h); else if (got.length) say(`${got.length} pictures added. Tap one to put it on the page.`); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-black text-white hover:bg-violet-700" data-testid="design-upload"><Upload size={17} />Upload pictures</button>
            <p className="text-xs text-slate-500">Pictures from your phone or computer. They're kept with this design.</p>
            {design.uploads.length ? <div className="grid grid-cols-2 gap-2">{design.uploads.map((s, i) => <button key={i} type="button" onClick={async () => { const { w, h } = await imgSize(s); addImageSrc(s, w, h); }} className="overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 hover:ring-2 hover:ring-violet-400"><img src={s} alt="" className="aspect-square w-full object-cover" /></button>)}</div>
              : <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Nothing uploaded yet.</p>}
          </div>}
          {panel === "background" && <BackgroundPanel page={page} onBg={(bg) => updPage((p) => ({ ...p, bg }))} onPhoto={async () => { const [f] = await upload(); if (f) updPage((p) => ({ ...p, bgImage: f.src })); }} onNoPhoto={() => updPage((p) => { const { bgImage: _b, ...rest } = p; return rest; })} />}
          {panel === "layers" && <LayersPanel page={page} sel={sel} onSel={setSel} onToggleLock={(id) => updEls([id], (e) => ({ ...e, locked: e.locked ? undefined : true }))} onMove={(id, dir) => { setSel([id]); updPage((p) => { const els = [...p.elements]; const i = els.findIndex((e) => e.id === id), j = i + dir; if (j < 0 || j >= els.length) return p; [els[i], els[j]] = [els[j], els[i]]; return { ...p, elements: els }; }); }} />}
          {panel === "magic" && <MagicPanel token={token} design={design} say={say} onUse={(d, mode) => usePage(d, mode)} />}
        </div>
      </aside>}

      {/* The page */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        {(selected.length > 0 || editing) && <ContextBar els={selected} editing={!!editing} design={design}
          onPatch={(patch) => updEls(sel, patch)} onRemove={remove} onDuplicate={duplicate} onOrder={order} onAlign={alignTo} onPicture={() => one && void addPicture(one)}
          onLock={() => updEls(sel, (e) => ({ ...e, locked: selected.every((x) => x.locked) ? undefined : true }))} onEditText={() => one && startEdit(one)} />}
        <div ref={area} className="relative min-h-0 flex-1 overflow-auto" style={{ touchAction: drag.current ? "none" : "pan-x pan-y" }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          onPointerDown={(e) => { if (e.target === e.currentTarget) { if (editing) finishEdit(); setSel([]); } }} data-testid="design-area">
          <div className="flex min-h-full min-w-full items-center justify-center" style={{ padding: pad / 2, width: zoom === "fit" ? undefined : design.w * scale + pad, height: zoom === "fit" ? undefined : design.h * scale + pad }}
            onPointerDown={(e) => { if (e.target === e.currentTarget) { if (editing) finishEdit(); setSel([]); } }}>
            <div className="relative rounded-[3px] shadow-[0_1px_2px_rgba(15,23,42,.08),0_12px_32px_rgba(15,23,42,.14)]" data-testid="design-page">
              <PageView design={design} page={shownPage} scale={scale} onBgDown={(e) => { if (editing) finishEdit(); if (e.target === e.currentTarget || (e.target as HTMLElement).parentElement === e.currentTarget) setSel([]); }}
                onElDown={onElDown} onElDouble={(el) => (el.type === "text" ? startEdit(el) : el.type === "image" ? void addPicture(el) : undefined)} editingId={editing} editRef={editRef} frameHints>
                {guides.v.map((x, i) => <div key={`v${i}`} className="pointer-events-none absolute top-0 bg-pink-500" style={{ left: x - 0.5 / scale, width: 1 / scale, height: design.h }} />)}
                {guides.h.map((y, i) => <div key={`h${i}`} className="pointer-events-none absolute left-0 bg-pink-500" style={{ top: y - 0.5 / scale, height: 1 / scale, width: design.w }} />)}
                {!editing && shownSel.map((e) => <div key={e.id} className="pointer-events-none absolute" style={{ left: e.x, top: e.y, width: e.w, height: e.h, transform: e.rot ? `rotate(${e.rot}deg)` : undefined, outline: `${2 / scale}px solid ${e.locked ? "#94a3b8" : "#8b5cf6"}` }}>
                  {sel.length === 1 && !e.locked && <>
                    {(e.type === "line" ? ["w", "e"] : (e.type === "text" ? ["nw", "ne", "sw", "se", "w", "e"] : ["nw", "n", "ne", "e", "se", "s", "sw", "w"])
                      // Too short or narrow for side handles between the corners: corners only (they'd overlap on a phone).
                      .filter((h) => h.length === 2 || ("ew".includes(h) ? e.h > hs * 4 : e.w > hs * 4))).map((h) => <span key={h} onPointerDown={(ev) => onHandleDown(ev, h)} className="pointer-events-auto absolute rounded-full border-violet-500 bg-white shadow"
                      style={{ width: h.length === 1 && "ns".includes(h) ? hs * 1.8 : h.length === 1 ? hs * 0.7 : hs, height: h.length === 1 && "ew".includes(h) ? hs * 1.8 : h.length === 1 ? hs * 0.7 : hs, borderWidth: 1.5 / scale,
                        left: h.includes("w") ? -hs / 2 : h.includes("e") ? e.w - hs / 2 : e.w / 2 - (h === "n" || h === "s" ? hs * 0.9 : hs / 2), top: h.includes("n") ? -hs / 2 : h.includes("s") ? e.h - hs / 2 : e.h / 2 - (h === "e" || h === "w" ? hs * 0.9 : hs / 2),
                        cursor: `${h}-resize`, ...(h.length === 1 && "ew".includes(h) ? { left: (h === "w" ? -hs * 0.35 : e.w - hs * 0.35) } : {}), ...(h.length === 1 && "ns".includes(h) ? { top: (h === "n" ? -hs * 0.35 : e.h - hs * 0.35) } : {}) }} data-testid={`design-handle-${h}`} />)}
                    <span onPointerDown={(ev) => onHandleDown(ev, "rot")} className="pointer-events-auto absolute grid place-items-center rounded-full border-violet-500 bg-white text-violet-600 shadow" title="Rotate"
                      style={{ width: hs * 1.6, height: hs * 1.6, left: e.w / 2 - hs * 0.8, top: e.h + hs * 1.4, borderWidth: 1.5 / scale, cursor: "grab", fontSize: hs }} data-testid="design-rotate">↻</span>
                  </>}
                </div>)}
              </PageView>
            </div>
          </div>
        </div>
        {/* Pages and zoom */}
        <div className="flex shrink-0 items-center gap-2 bg-[#eef0f5] px-3 pb-2 pt-1">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1 [scrollbar-width:thin]" data-testid="design-pages">
            {design.pages.map((p, i) => <div key={p.id} className="group relative shrink-0">
              <button type="button" onClick={() => { finishEdit(); setPi(i); setSel([]); }} aria-label={`Page ${i + 1}`} aria-current={i === pageIndex} className={`block overflow-hidden rounded-md ring-2 ${i === pageIndex ? "ring-violet-500" : "ring-transparent hover:ring-slate-300"}`}>
                <PageView design={design} page={p} scale={Math.min(64 / design.w, 44 / design.h)} className="pointer-events-none" />
              </button>
              <span className="absolute -left-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-slate-800 px-1 text-[9px] font-bold text-white">{i + 1}</span>
              {i === pageIndex && <span className="absolute -right-1 -top-1 hidden gap-0.5 group-hover:flex">
                <button type="button" onClick={() => movePage(i, i - 1)} aria-label="Move page left" className="grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] shadow ring-1 ring-slate-200">‹</button>
                <button type="button" onClick={() => movePage(i, i + 1)} aria-label="Move page right" className="grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] shadow ring-1 ring-slate-200">›</button>
                <button type="button" onClick={() => addPage(p)} aria-label="Duplicate page" className="grid h-5 w-5 place-items-center rounded-full bg-white shadow ring-1 ring-slate-200"><Copy size={10} /></button>
                <button type="button" onClick={() => delPage(i)} aria-label="Delete page" className="grid h-5 w-5 place-items-center rounded-full bg-white text-rose-600 shadow ring-1 ring-slate-200"><Trash2 size={10} /></button>
              </span>}
            </div>)}
            <button type="button" onClick={() => addPage()} aria-label="Add a page" className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-[12.5px] font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:text-violet-700" data-testid="design-add-page"><Plus size={16} />Page</button>
          </div>
          <div className="hidden shrink-0 items-center gap-1 sm:flex">
            <button type="button" onClick={() => setZoom(clamp(+(scale / 1.2).toFixed(3), 0.05, 4))} aria-label="Zoom out" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100"><Minus size={15} /></button>
            <button type="button" onClick={() => setZoom("fit")} className="min-w-[56px] rounded-lg px-2 py-1 text-xs font-bold hover:bg-slate-100">{zoom === "fit" ? "Fit" : `${Math.round(scale * 100)}%`}</button>
            <button type="button" onClick={() => setZoom(clamp(+(scale * 1.2).toFixed(3), 0.05, 4))} aria-label="Zoom in" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100"><Plus size={15} /></button>
          </div>
        </div>
        {/* Tools on phones */}
        <nav className="flex shrink-0 justify-around border-t border-slate-200/80 bg-white px-1 pt-1 lg:hidden" aria-label="Design tools">
          {PANELS.map((p) => <button key={p.id} type="button" onClick={() => setPanel(panel === p.id ? null : p.id)} aria-pressed={panel === p.id} data-testid={`design-tab-${p.id}`}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 py-1.5 text-[10.5px] font-semibold ${panel === p.id ? "text-violet-700" : "text-slate-500"}`}>
            <span className={`grid h-8 w-12 place-items-center rounded-full transition ${panel === p.id ? "bg-violet-100" : ""}`}>{p.icon}</span><span className="truncate">{p.label}</span></button>)}
        </nav>
      </main>
    </div>

    {toast && <div role="status" className="pointer-events-none fixed bottom-24 left-1/2 z-[1200] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg">{toast}</div>}
    {dialog === "download" && <DownloadDialog design={design} pageIndex={pageIndex} name={doc.name} onClose={() => setDialog(null)} say={say} />}
    {dialog === "resize" && <ResizeDialog design={design} onClose={() => setDialog(null)} onPick={(w, h, sizeId) => { commit((d) => resizeDesign(d, w, h, sizeId)); setDialog(null); setZoom("fit"); say(`Resized to ${sizeOf(sizeId)?.name || `${w} × ${h}`}.`); }} />}
  </div>;
}

// ─── The bar of tools for what's selected ───
function ContextBar({ els, editing, design, onPatch, onRemove, onDuplicate, onOrder, onAlign, onPicture, onLock, onEditText }: {
  els: DEl[]; editing: boolean; design: Design; onPatch: (p: Partial<DEl> | ((e: DEl) => DEl)) => void; onRemove: () => void; onDuplicate: () => void;
  onOrder: (d: "front" | "back" | "up" | "down") => void; onAlign: (h: "left" | "center" | "right" | "top" | "middle" | "bottom") => void; onPicture: () => void; onLock: () => void; onEditText: () => void;
}) {
  const one = els.length === 1 ? els[0] : null;
  const all = (t: DEl["type"]) => els.length > 0 && els.every((e) => e.type === t);
  const first = els[0];
  const locked = els.length > 0 && els.every((e) => e.locked);
  const btn = (title: string, on: boolean | undefined, onClick: () => void, icon: ReactNode, testId?: string) => <button type="button" title={title} aria-label={title} aria-pressed={on} onMouseDown={(e) => e.preventDefault()} onClick={onClick} data-testid={testId}
    className={`grid h-9 min-w-9 shrink-0 place-items-center rounded-lg px-1.5 text-slate-700 hover:bg-slate-100 ${on ? "bg-violet-100 text-violet-700" : ""}`}>{icon}</button>;
  const sep = <span className="mx-0.5 h-6 w-px shrink-0 bg-slate-200" />;
  return <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-slate-200 bg-white px-2 py-1.5 [scrollbar-width:none]" data-testid="design-context">
    {!locked && all("text") && first && <>
      <DropButton title="Font" testId="design-font" label={<span className="max-w-[120px] truncate px-1 text-sm font-semibold" style={{ fontFamily: fontStack(first.font) }}>{first.font}</span>}>
        {(close) => <div className="max-h-[340px] w-[230px] overflow-y-auto py-1">{DESIGN_FONTS.map((f) => <button key={f} type="button" onClick={() => { onPatch({ font: f }); close(); }} className={`block w-full px-3 py-2 text-left text-[17px] hover:bg-slate-100 ${first.font === f ? "bg-violet-50 text-violet-700" : ""}`} style={{ fontFamily: fontStack(f) }}>{f}</button>)}</div>}
      </DropButton>
      <span className="flex shrink-0 items-center rounded-lg border border-slate-200">
        <button type="button" aria-label="Smaller text" onClick={() => onPatch((e) => ({ ...e, size: Math.max(4, Math.round((e.size || 40) / 1.1)) }))} className="grid h-8 w-7 place-items-center hover:bg-slate-100"><Minus size={13} /></button>
        <input aria-label="Text size" value={Math.round(first.size || 40)} onChange={(e) => { const v = Number(e.target.value); if (v > 0) onPatch({ size: clamp(v, 4, 2000) }); }} className="h-8 w-11 border-x border-slate-200 text-center text-sm outline-none" inputMode="numeric" />
        <button type="button" aria-label="Bigger text" onClick={() => onPatch((e) => ({ ...e, size: Math.min(2000, Math.round((e.size || 40) * 1.1)) }))} className="grid h-8 w-7 place-items-center hover:bg-slate-100"><Plus size={13} /></button>
      </span>
      <ColorButton title="Text color" value={first.color || "#111827"} onPick={(c) => onPatch({ color: c })} letter />
      {btn("Bold", (first.weight || 400) >= 700, () => onPatch((e) => ({ ...e, weight: (e.weight || 400) >= 900 ? 400 : (e.weight || 400) >= 700 ? 900 : 700 })), <Bold size={17} strokeWidth={(first.weight || 400) >= 900 ? 3.5 : 2.4} />, "design-bold")}
      {btn("Italic", first.italic, () => onPatch((e) => ({ ...e, italic: e.italic ? undefined : true })), <Italic size={17} />)}
      {btn("Underline", first.underline, () => onPatch((e) => ({ ...e, underline: e.underline ? undefined : true })), <Underline size={17} />)}
      {btn("Capitals", first.upper, () => onPatch((e) => ({ ...e, upper: e.upper ? undefined : true })), <CaseUpper size={18} />)}
      {btn("Alignment", false, () => onPatch((e) => ({ ...e, align: e.align === "left" ? "center" : e.align === "center" ? "right" : "left" })), first.align === "left" ? <AlignLeft size={17} /> : first.align === "right" ? <AlignRight size={17} /> : <AlignCenter size={17} />)}
      <DropButton title="Spacing" label={<span className="px-1 text-sm font-semibold">Spacing</span>}>{() => <div className="w-[240px] space-y-3 p-3">
        <Slider label="Letter spacing" min={-10} max={60} value={first.letter || 0} onChange={(v) => onPatch({ letter: v || undefined })} />
        <Slider label="Line spacing" min={0.7} max={2.5} step={0.05} value={first.lineH || 1.2} onChange={(v) => onPatch({ lineH: v })} />
      </div>}</DropButton>
      <DropButton title="Effects" label={<span className="px-1 text-sm font-semibold">Effects</span>}>{() => <div className="w-[250px] space-y-3 p-3 text-sm">
        <label className="flex items-center justify-between gap-2 font-semibold">Shadow<input type="checkbox" checked={!!first.shadow} onChange={(e) => onPatch({ shadow: e.target.checked || undefined })} className="h-4 w-4 accent-violet-600" /></label>
        <div><p className="mb-1 font-semibold">Outline</p><Swatches value={first.outline} none onPick={(c) => onPatch({ outline: c === "none" ? undefined : c })} /></div>
        <div><p className="mb-1 font-semibold">Highlight</p><Swatches value={first.highlight} none onPick={(c) => onPatch({ highlight: c === "none" ? undefined : c })} /></div>
      </div>}</DropButton>
      {one && !editing && btn("Edit text", false, onEditText, <Type size={17} />)}
      {sep}
    </>}
    {!locked && all("shape") && first && <>
      <ColorButton title="Color" value={first.fill || "#8b5cf6"} onPick={(c) => onPatch({ fill: c })} gradients />
      <DropButton title="Border" label={<span className="px-1 text-sm font-semibold">Border</span>}>{() => <div className="w-[250px] space-y-3 p-3 text-sm">
        <Swatches value={first.stroke} none onPick={(c) => onPatch((e) => ({ ...e, stroke: c === "none" ? undefined : c, strokeW: c === "none" ? undefined : e.strokeW || Math.max(2, Math.round(Math.min(e.w, e.h) * 0.03)) }))} />
        <Slider label="Border width" min={0} max={60} value={first.strokeW || 0} onChange={(v) => onPatch({ strokeW: v || undefined })} />
      </div>}</DropButton>
      {(first.shape === "round" || first.shape === "rect") && <DropButton title="Corners" label={<span className="px-1 text-sm font-semibold">Corners</span>}>{() => <div className="w-[240px] p-3"><Slider label="Corner rounding" min={0} max={Math.round(Math.min(first.w, first.h) / 2)} value={first.radius || 0} onChange={(v) => onPatch({ shape: v ? "round" : "rect", radius: v || undefined })} /></div>}</DropButton>}
      {sep}
    </>}
    {!locked && all("line") && first && <>
      <ColorButton title="Line color" value={first.stroke || "#111827"} onPick={(c) => onPatch({ stroke: c })} />
      <DropButton title="Line style" label={<span className="px-1 text-sm font-semibold">Style</span>}>{(close) => <div className="w-[220px] space-y-2 p-3 text-sm">
        <div className="grid grid-cols-4 gap-1">{(["solid", "dashed", "dotted", "arrow"] as const).map((l) => <button key={l} type="button" onClick={() => { onPatch({ line: l }); close(); }} className={`rounded-md border px-1 py-2 text-xs font-semibold capitalize ${first.line === l ? "border-violet-500 bg-violet-50" : "border-slate-200"}`}>{l}</button>)}</div>
        <Slider label="Thickness" min={1} max={80} value={first.strokeW || 4} onChange={(v) => onPatch({ strokeW: v })} />
      </div>}</DropButton>
      {sep}
    </>}
    {!locked && all("image") && first && <>
      <button type="button" onClick={onPicture} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"><ImagePlus size={16} />{first.src ? "Replace" : "Add photo"}</button>
      <DropButton title="Frame shape" label={<span className="px-1 text-sm font-semibold">Shape</span>}>{(close) => <div className="grid w-[240px] grid-cols-4 gap-2 p-3">{FRAMES.map((f) => <button key={f.shape} type="button" title={f.label} onClick={() => { onPatch({ shape: f.shape === "rect" ? undefined : f.shape }); close(); }} className="grid aspect-square place-items-center rounded-lg hover:bg-slate-100"><ShapeIcon shape={f.shape} fill="#94a3b8" /></button>)}</div>}</DropButton>
      {btn(first.fit === "contain" ? "Fill the frame" : "Show the whole picture", first.fit === "contain", () => onPatch((e) => ({ ...e, fit: e.fit === "contain" ? "cover" : "contain" })), <ImageIcon size={17} />)}
      {sep}
    </>}
    {!locked && els.some((e) => e.type === "image" || e.type === "sticker" || e.type === "shape") && <>
      {btn("Flip across", first?.flipX, () => onPatch((e) => ({ ...e, flipX: e.flipX ? undefined : true })), <FlipHorizontal size={17} />)}
      {btn("Flip up and down", first?.flipY, () => onPatch((e) => ({ ...e, flipY: e.flipY ? undefined : true })), <FlipVertical size={17} />)}
      {!all("text") && btn("Shadow", first?.shadow, () => onPatch((e) => ({ ...e, shadow: e.shadow ? undefined : true })), <span className="text-[13px] font-black">S</span>)}
    </>}
    {!locked && <>
      <DropButton title="Transparency" label={<span className="px-1 text-sm font-semibold">{Math.round((first?.opacity ?? 1) * 100)}%</span>}>{() => <div className="w-[230px] p-3"><Slider label="Transparency" min={5} max={100} value={Math.round((first?.opacity ?? 1) * 100)} onChange={(v) => onPatch({ opacity: v >= 100 ? undefined : v / 100 })} /></div>}</DropButton>
      <DropButton title="Position" testId="design-position" label={<span className="px-1 text-sm font-semibold">Position</span>}>{(close) => <div className="w-[240px] space-y-3 p-3 text-sm">
        <div className="grid grid-cols-2 gap-1.5">
          {([["front", "To front", <BringToFront key="a" size={15} />], ["up", "Forward", <ChevronUp key="b" size={15} />], ["down", "Backward", <ChevronDown key="c" size={15} />], ["back", "To back", <SendToBack key="d" size={15} />]] as const).map(([d, l, ic]) =>
            <button key={d} type="button" onClick={() => { onOrder(d); close(); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-2 font-semibold hover:bg-slate-50">{ic}{l}</button>)}
        </div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Line up on the page</p>
        <div className="grid grid-cols-3 gap-1.5">{(["left", "center", "right", "top", "middle", "bottom"] as const).map((a) => <button key={a} type="button" onClick={() => onAlign(a)} className="rounded-lg border border-slate-200 px-1 py-2 text-xs font-semibold capitalize hover:bg-slate-50">{a}</button>)}</div>
      </div>}</DropButton>
      {btn("Duplicate", false, onDuplicate, <Copy size={17} />, "design-duplicate")}
    </>}
    {btn(locked ? "Unlock" : "Lock", locked, onLock, locked ? <Lock size={17} /> : <Unlock size={17} />)}
    {!locked && btn("Delete", false, onRemove, <Trash2 size={17} className="text-rose-600" />, "design-delete")}
    <span className="ml-auto shrink-0 pl-2 text-[11px] text-slate-400">{design.w} × {design.h}</span>
  </div>;
}

function Slider({ label, min, max, step = 1, value, onChange }: { label: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void }) {
  return <label className="block text-sm"><span className="mb-1 flex justify-between font-semibold"><span>{label}</span><span className="tabular-nums text-slate-500">{Number(value.toFixed(2))}</span></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-violet-600" /></label>;
}
function Swatches({ value, onPick, none, gradients }: { value?: string; onPick: (c: string) => void; none?: boolean; gradients?: boolean }) {
  return <div className="space-y-2">
    <div className="grid grid-cols-8 gap-1.5">
      {none && <button type="button" onClick={() => onPick("none")} title="None" aria-label="None" className={`relative h-6 w-6 overflow-hidden rounded-md bg-white ring-1 ring-slate-300 ${!value ? "outline outline-2 outline-violet-500" : ""}`}><span className="absolute left-1/2 top-[-2px] h-[30px] w-[2px] -translate-x-1/2 rotate-45 bg-rose-500" /></button>}
      {SWATCHES.map((c) => <button key={c} type="button" onClick={() => onPick(c)} title={c} aria-label={c} className={`h-6 w-6 rounded-md ring-1 ring-black/10 ${value === c ? "outline outline-2 outline-offset-1 outline-violet-500" : ""}`} style={{ background: c }} />)}
    </div>
    {gradients && <div className="grid grid-cols-5 gap-1.5">{GRADIENTS.map((g) => <button key={g} type="button" onClick={() => onPick(g)} aria-label="Gradient" className={`h-7 rounded-md ring-1 ring-black/10 ${value === g ? "outline outline-2 outline-offset-1 outline-violet-500" : ""}`} style={{ background: fillCss(g) }} />)}</div>}
    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">Any color<input type="color" value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#7c3aed"} onChange={(e) => onPick(e.target.value)} className="h-7 w-12 cursor-pointer rounded border border-slate-200" /></label>
  </div>;
}
function ColorButton({ title, value, onPick, gradients, letter }: { title: string; value: string; onPick: (c: string) => void; gradients?: boolean; letter?: boolean }) {
  return <DropButton title={title} testId={`design-color-${letter ? "text" : "fill"}`} label={letter
    ? <span className="flex flex-col items-center px-1 text-[15px] font-black leading-none">A<span className="mt-0.5 h-1 w-5 rounded-full ring-1 ring-black/10" style={{ background: fillCss(value) }} /></span>
    : <span className="h-6 w-6 rounded-md ring-1 ring-black/15" style={{ background: fillCss(value) }} />}>
    {() => <div className="w-[260px] p-3"><Swatches value={value} onPick={onPick} gradients={gradients} /></div>}
  </DropButton>;
}

function ShapeIcon({ shape, fill = "#8b5cf6", size = 40 }: { shape: ShapeKind; fill?: string; size?: number }) {
  const w = size, h = shape === "arrow" ? size * 0.6 : shape === "arch" ? size * 1.2 : size;
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden><path d={designShapePath(shape, w, h)} fill={fill} /></svg>;
}

// ─── Panels ───
function TemplatesPanel({ design, onUse }: { design: Design; onUse: (d: Design, mode: "replace" | "add") => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [allSizes, setAllSizes] = useState(false);
  const list = useMemo(() => TEMPLATES.filter((t) => (allSizes || t.size === design.size || (sizeOf(t.size)!.w / sizeOf(t.size)!.h).toFixed(2) === (design.w / design.h).toFixed(2)) && (!cat || t.category === cat) && (!q || `${t.name} ${t.category}`.toLowerCase().includes(q.toLowerCase()))), [q, cat, allSizes, design.size, design.w, design.h]);
  const made = useMemo(() => new Map(list.slice(0, 60).map((t) => [t.id, t.make()])), [list]);
  const [pick, setPick] = useState<string | null>(null);
  return <div className="space-y-3">
    <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-violet-400 focus:bg-white" /></div>
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      <button type="button" onClick={() => setCat("")} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${!cat ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"}`}>All</button>
      {TEMPLATE_CATEGORIES.map((c) => <button key={c} type="button" onClick={() => setCat(cat === c ? "" : c)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${cat === c ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"}`}>{c}</button>)}
    </div>
    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={allSizes} onChange={(e) => setAllSizes(e.target.checked)} className="accent-violet-600" />Show every size (they're resized to fit)</label>
    {list.length ? <div className="grid grid-cols-2 gap-2.5" data-testid="design-templates">{list.slice(0, 60).map((t) => { const d = made.get(t.id)!; return <div key={t.id} className="relative">
      <button type="button" onClick={() => setPick(pick === t.id ? null : t.id)} className="flex w-full flex-col items-center gap-1 rounded-xl bg-slate-50 p-2 text-left ring-1 ring-slate-200 hover:ring-2 hover:ring-violet-400" data-testid={`design-template-${t.id}`}>
        <div className="grid h-[130px] w-full place-items-center"><DesignThumb design={d} width={Math.min(130, 130 * (d.w / d.h))} /></div>
        <span className="w-full truncate text-xs font-bold text-slate-700">{t.name}</span>
      </button>
      {pick === t.id && <div className="absolute inset-x-2 bottom-8 z-10 grid gap-1 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-slate-200">
        <button type="button" onClick={() => { onUse(d, "replace"); setPick(null); }} className="rounded-lg bg-violet-600 px-2 py-1.5 text-xs font-bold text-white">Use on this page</button>
        <button type="button" onClick={() => { onUse(d, "add"); setPick(null); }} className="rounded-lg px-2 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-50">Add as a new page</button>
      </div>}
    </div>; })}</div> : <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No templates for this size yet. Tick “Show every size”.</p>}
  </div>;
}

function ElementsPanel({ onShape, onLine, onFrame, onSticker }: { onShape: (s: ShapeKind) => void; onLine: (l: DEl["line"]) => void; onFrame: (s: ShapeKind) => void; onSticker: (e: string) => void }) {
  const [q, setQ] = useState("");
  const Head = ({ children }: { children: ReactNode }) => <h3 className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-wide text-slate-400 first:mt-0">{children}</h3>;
  return <div>
    <Head>Shapes</Head>
    <div className="grid grid-cols-4 gap-2" data-testid="design-shapes">{SHAPES.map((s) => <button key={s.id} type="button" title={s.label} aria-label={s.label} onClick={() => onShape(s.id)} className="grid aspect-square place-items-center rounded-xl bg-slate-50 hover:bg-violet-50"><ShapeIcon shape={s.id} /></button>)}</div>
    <Head>Lines</Head>
    <div className="grid grid-cols-4 gap-2">{(["solid", "dashed", "dotted", "arrow"] as const).map((l) => <button key={l} type="button" title={l} aria-label={`${l} line`} onClick={() => onLine(l)} className="grid h-12 place-items-center rounded-xl bg-slate-50 hover:bg-violet-50">
      <svg width="44" height="12" viewBox="0 0 44 12"><line x1="2" y1="6" x2={l === "arrow" ? 36 : 42} y2="6" stroke="#334155" strokeWidth="3" strokeLinecap="round" strokeDasharray={l === "dashed" ? "8 5" : l === "dotted" ? "0 6" : undefined} />{l === "arrow" && <path d="M34 1 L43 6 L34 11 Z" fill="#334155" />}</svg></button>)}</div>
    <Head>Photo frames</Head>
    <div className="grid grid-cols-4 gap-2">{FRAMES.map((f) => <button key={f.shape} type="button" title={`${f.label} frame`} aria-label={`${f.label} frame`} onClick={() => onFrame(f.shape)} className="grid aspect-square place-items-center rounded-xl bg-slate-50 hover:bg-violet-50"><ShapeIcon shape={f.shape} fill="#cbd5e1" size={36} /></button>)}</div>
    <Head>Stickers</Head>
    <div className="relative mb-2"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a group (food, love, school…)" className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-sm outline-none focus:border-violet-400" /></div>
    {STICKERS.filter((g) => !q || g.group.toLowerCase().includes(q.toLowerCase())).map((g) => <div key={g.group} className="mb-3">
      <p className="mb-1 text-xs font-bold text-slate-500">{g.group}</p>
      <div className="grid grid-cols-8 gap-1">{g.items.map((s) => <button key={s} type="button" onClick={() => onSticker(s)} aria-label={`Sticker ${s}`} className="grid aspect-square place-items-center rounded-lg text-[22px] hover:bg-violet-50">{s}</button>)}</div>
    </div>)}
  </div>;
}

function BackgroundPanel({ page, onBg, onPhoto, onNoPhoto }: { page: DPage; onBg: (bg: string) => void; onPhoto: () => void; onNoPhoto: () => void }) {
  return <div className="space-y-4">
    <div><p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-400">Colors and gradients</p><Swatches value={page.bg} onPick={onBg} gradients /></div>
    <div><p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-400">Photo</p>
      <div className="flex gap-2"><button type="button" onClick={onPhoto} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white"><ImagePlus size={16} />{page.bgImage ? "Change photo" : "Use a photo"}</button>
        {page.bgImage && <button type="button" onClick={onNoPhoto} className="rounded-xl border border-slate-200 px-3 text-sm font-semibold">Remove</button>}</div></div>
  </div>;
}

function LayersPanel({ page, sel, onSel, onToggleLock, onMove }: { page: DPage; sel: string[]; onSel: (ids: string[]) => void; onToggleLock: (id: string) => void; onMove: (id: string, dir: 1 | -1) => void }) {
  const name = (e: DEl) => e.type === "text" ? (e.text || "Text").slice(0, 30) : e.type === "sticker" ? `Sticker ${e.emoji}` : e.type === "image" ? (e.src ? "Picture" : "Photo frame") : e.type === "line" ? "Line" : `${SHAPES.find((s) => s.id === e.shape)?.label || "Shape"}`;
  const list = [...page.elements].reverse();
  if (!list.length) return <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">This page is empty. Add text, elements or a template.</p>;
  return <ul className="space-y-1.5" data-testid="design-layers">{list.map((e) => <li key={e.id} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ring-1 ${sel.includes(e.id) ? "bg-violet-50 ring-violet-300" : "bg-white ring-slate-200"}`}>
    <button type="button" onClick={() => onSel([e.id])} className="flex min-w-0 flex-1 items-center gap-2 text-left">
      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100 text-lg">{e.type === "sticker" ? e.emoji : e.type === "text" ? <Type size={15} /> : e.type === "image" ? (e.src ? <img src={e.src} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={15} />) : e.type === "line" ? <Minus size={15} /> : <ShapeIcon shape={e.shape || "rect"} fill={e.fill && !e.fill.startsWith("linear") ? e.fill : "#8b5cf6"} size={20} />}</span>
      <span className="truncate text-sm font-semibold">{name(e)}</span>
    </button>
    <button type="button" onClick={() => onMove(e.id, 1)} aria-label="Move up" className="grid h-8 w-7 place-items-center rounded-md hover:bg-slate-100"><ChevronUp size={15} /></button>
    <button type="button" onClick={() => onMove(e.id, -1)} aria-label="Move down" className="grid h-8 w-7 place-items-center rounded-md hover:bg-slate-100"><ChevronDown size={15} /></button>
    <button type="button" onClick={() => onToggleLock(e.id)} aria-label={e.locked ? "Unlock" : "Lock"} className={`grid h-8 w-7 place-items-center rounded-md hover:bg-slate-100 ${e.locked ? "text-violet-600" : "text-slate-400"}`}>{e.locked ? <Lock size={14} /> : <Unlock size={14} />}</button>
  </li>)}</ul>;
}

function MagicPanel({ token, design, say, onUse }: { token: string | null; design: Design; say: (m: string) => void; onUse: (d: Design, mode: "replace" | "add") => void }) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Design[]>([]);
  const ideas = ["Bake sale this Friday at 3 in the school gym", "Birthday party for Leo turning 5", "Grand opening of our coffee shop", "Free coding class for kids on Tuesdays", "Summer sale 40% off everything"];
  const go = async (text = prompt) => {
    const p = text.trim(); if (!p || busy) return;
    setBusy(true); setResults([]);
    let copy;
    try { copy = cleanCopy(await askAppAi(token, DESIGN_AI_TASK, { prompt: p, size: sizeOf(design.size)?.name || "square" }), p); }
    catch { copy = builtinCopy(p); say("Made without AI this time: edit the words to fit."); }
    setResults(magicDesigns(copy, design.size).map((d) => (d.w === design.w && d.h === design.h ? d : resizeDesign(d, design.w, design.h, design.size))));
    setBusy(false);
  };
  return <div className="space-y-3">
    <p className="text-sm text-slate-600">Say what it's for, and get four designs to start from. Everything stays editable.</p>
    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="e.g. Car wash fundraiser Saturday 10–2 at the church parking lot" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-violet-400 focus:bg-white" data-testid="design-magic-prompt" />
    <button type="button" onClick={() => void go()} disabled={!prompt.trim() || busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 py-3 text-sm font-black text-white disabled:opacity-50" data-testid="design-magic-go">{busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Wand2 size={17} />}{busy ? "Designing…" : "Make designs"}</button>
    {!results.length && !busy && <div className="flex flex-wrap gap-1.5">{ideas.map((i) => <button key={i} type="button" onClick={() => { setPrompt(i); void go(i); }} className="rounded-full bg-slate-100 px-3 py-1.5 text-left text-xs font-semibold text-slate-600 hover:bg-violet-50 hover:text-violet-700">{i}</button>)}</div>}
    {results.length > 0 && <div className="grid grid-cols-2 gap-2.5" data-testid="design-magic-results">{results.map((d, i) => <div key={i} className="rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
      <div className="grid h-[130px] place-items-center"><DesignThumb design={d} width={Math.min(130, 130 * (d.w / d.h))} /></div>
      <div className="mt-1.5 grid gap-1"><button type="button" onClick={() => onUse(d, "replace")} className="rounded-lg bg-violet-600 py-1.5 text-xs font-bold text-white">Use this</button><button type="button" onClick={() => onUse(d, "add")} className="rounded-lg py-1 text-xs font-bold text-violet-700 hover:bg-violet-50">New page</button></div>
    </div>)}</div>}
  </div>;
}

// ─── Dialogs ───
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 kb-sheet z-[1100] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-slate-100"><X size={17} /></button></div>
      {children}
    </div>
  </div>;
}

function DownloadDialog({ design, pageIndex, name, onClose, say }: { design: Design; pageIndex: number; name: string; onClose: () => void; say: (m: string) => void }) {
  const [type, setType] = useState<"png" | "jpg" | "pdf">(design.pages.length > 1 ? "pdf" : "png");
  const [which, setWhich] = useState<"this" | "all">(design.pages.length > 1 ? "all" : "this");
  const [hi, setHi] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const base = safeName(name || "Design");
      if (type === "pdf") downloadBlob(`${base}.pdf`, await exportPdf(design, which === "all" ? undefined : [pageIndex]), "application/pdf");
      else {
        const pages = which === "all" ? design.pages.map((_, i) => i) : [pageIndex];
        for (const i of pages) downloadBlob(`${base}${pages.length > 1 ? ` - page ${i + 1}` : ""}.${type}`, await exportImage(design, i, type, hi ? 2 : 1), type === "png" ? "image/png" : "image/jpeg");
      }
      say("Downloaded."); onClose();
    } catch (e: any) { say(e?.message || "That couldn't be downloaded. Try again."); } finally { setBusy(false); }
  };
  const choice = (on: boolean, onClick: () => void, title: string, sub: string) => <button type="button" onClick={onClick} className={`rounded-xl border-2 p-3 text-left ${on ? "border-violet-500 bg-violet-50" : "border-slate-200"}`}><span className="block text-sm font-black">{title}</span><span className="text-xs text-slate-500">{sub}</span></button>;
  return <Modal title="Download" onClose={onClose}>
    <div className="space-y-4" data-testid="design-download-dialog">
      <div className="grid grid-cols-3 gap-2">{choice(type === "png", () => setType("png"), "PNG", "Sharp, best for social")}{choice(type === "jpg", () => setType("jpg"), "JPG", "Small file")}{choice(type === "pdf", () => setType("pdf"), "PDF", "Best for printing")}</div>
      {design.pages.length > 1 && <div className="grid grid-cols-2 gap-2">{choice(which === "this", () => setWhich("this"), "This page", `Page ${pageIndex + 1}`)}{choice(which === "all", () => setWhich("all"), "All pages", `${design.pages.length} pages`)}</div>}
      {type !== "pdf" && <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold">Double size (extra sharp)<input type="checkbox" checked={hi} onChange={(e) => setHi(e.target.checked)} className="h-4 w-4 accent-violet-600" /></label>}
      <button type="button" onClick={() => void go()} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-black text-white disabled:opacity-60" data-testid="design-download-go">{busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Download size={17} />}{busy ? "Making your file…" : `Download ${type.toUpperCase()}`}</button>
    </div>
  </Modal>;
}

function ResizeDialog({ design, onClose, onPick }: { design: Design; onClose: () => void; onPick: (w: number, h: number, sizeId: string) => void }) {
  const [w, setW] = useState(design.w); const [h, setH] = useState(design.h);
  const groups = Array.from(new Set(SIZES.map((s) => s.group)));
  return <Modal title="Resize" onClose={onClose}>
    <p className="mb-3 text-sm text-slate-500">Everything moves and scales with the page. Undo puts it back.</p>
    {groups.map((g) => <div key={g} className="mb-3"><p className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-400">{g}</p>
      <div className="grid grid-cols-2 gap-1.5">{SIZES.filter((s) => s.group === g).map((s) => <button key={s.id} type="button" onClick={() => onPick(s.w, s.h, s.id)} className={`rounded-xl border px-3 py-2 text-left ${design.size === s.id ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:bg-slate-50"}`}>
        <span className="block truncate text-sm font-bold">{s.name}</span><span className="text-[11px] text-slate-500">{s.unit || `${s.w} × ${s.h} px`}</span></button>)}</div></div>)}
    <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-400">Custom</p>
    <div className="flex items-center gap-2"><input type="number" value={w} min={16} max={8000} onChange={(e) => setW(Number(e.target.value))} aria-label="Width" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /><span className="text-slate-400">×</span>
      <input type="number" value={h} min={16} max={8000} onChange={(e) => setH(Number(e.target.value))} aria-label="Height" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
      <button type="button" onClick={() => onPick(clamp(Math.round(w), 16, 8000), clamp(Math.round(h), 16, 8000), "custom")} className="h-10 shrink-0 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white">Resize</button></div>
  </Modal>;
}
