// Arise Slides: a presentation maker like PowerPoint or Google Slides. Themes and layouts, text
// boxes, pictures and shapes you drag, resize and rotate, fonts and colours, speaker notes,
// transitions and animations, full-screen presenting, an AI deck builder, and PowerPoint/PDF in
// and out. Saves by itself to the person's account.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, Copy, Image as ImageIcon, Italic, List, Play, Plus, Presentation, Sparkles, Star, Trash2, Type, Underline, ChevronLeft, ChevronRight, X, StickyNote,
} from "lucide-react";
import { ArrowDownToLine, ArrowUpToLine, BringToFront, MoveVertical, Redo2, SendToBack, Shapes, Undo2, Baseline, PaintBucket } from "./icons";
import { useAuth } from "@/context/AuthContext";
import { askAppAi, docsApi, saveLabel, useCloudDoc } from "@/lib/cloudDocs";
import { sanitizeHtml } from "@shared/office/docModel";
import {
  CH, CW, LAYOUTS, THEMES, blankDeck, cleanDeck, deckFromOutline, elId, makeSlide, readPptx, shapePath, slideTitle, themeOf, writePptx,
  type Deck, type El, type LayoutId, type ShapeKind, type Slide, type Theme,
} from "@shared/office/slidesModel";
import { DOC_FONTS } from "@shared/office/docModel";
import { ColorGrid, Dialog, DropButton, Floating, Label, MenuBar, MenuList, Tool, ToolSep, btnGhost, btnPrimary, downloadBlob, field, pickFile, safeName, type MenuItem } from "./officeUi";
import { FONT_LINK, loadOfficeFonts } from "./sheetsHelpers";

type DocHandle = ReturnType<typeof useCloudDoc<Deck>> & { content: Deck };
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const SHAPES: { id: ShapeKind; label: string }[] = [
  { id: "rect", label: "Rectangle" }, { id: "round", label: "Rounded" }, { id: "ellipse", label: "Circle" }, { id: "triangle", label: "Triangle" }, { id: "diamond", label: "Diamond" },
  { id: "hexagon", label: "Hexagon" }, { id: "star", label: "Star" }, { id: "arrow", label: "Arrow" }, { id: "speech", label: "Speech bubble" }, { id: "line", label: "Line" },
];
const TEXT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 54, 60, 72, 96, 120];

// ─── Drawing a slide ─────────────────────────────────────────────────────────

export function SlideView({ slide, theme, scale, children, onPointerDown, editingId, editRef, animStep, className = "", style }: {
  slide: Slide; theme: Theme; scale: number; children?: ReactNode; onPointerDown?: (e: React.PointerEvent, el: El | null) => void;
  editingId?: string | null; editRef?: React.RefObject<HTMLDivElement>; animStep?: number; className?: string; style?: CSSProperties;
}) {
  const bg = slide.bg || theme.bg;
  const grad = !slide.bg && theme.bg2 ? `linear-gradient(135deg, ${theme.bg} 0%, ${theme.bg2} 100%)` : bg;
  return <div className={`relative overflow-hidden ${className}`} style={{ width: CW * scale, height: CH * scale, ...style }} onPointerDown={(e) => onPointerDown?.(e, null)}>
    <div className="absolute left-0 top-0 origin-top-left" style={{ width: CW, height: CH, transform: `scale(${scale})`, background: grad, fontFamily: `'${theme.body}', Arial, sans-serif` }}>
      {slide.elements.map((e, i) => <ElementView key={e.id} el={e} theme={theme} editing={editingId === e.id} editRef={editingId === e.id ? editRef : undefined} onPointerDown={onPointerDown} hidden={animStep !== undefined && e.anim && e.anim !== "none" ? i >= 0 && animIndex(slide, e) >= animStep : false} />)}
      {children}
    </div>
  </div>;
}
const animIndex = (s: Slide, e: El) => s.elements.filter((x) => x.anim && x.anim !== "none").indexOf(e);

function ElementView({ el, theme, editing, editRef, onPointerDown, hidden }: { el: El; theme: Theme; editing: boolean; editRef?: React.RefObject<HTMLDivElement>; onPointerDown?: (e: React.PointerEvent, el: El | null) => void; hidden?: boolean }) {
  const box: CSSProperties = { position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h, transform: el.rot ? `rotate(${el.rot}deg)` : undefined, opacity: hidden ? 0 : el.opacity ?? 1, transition: "opacity .45s, transform .45s" };
  const text: CSSProperties = {
    fontFamily: `'${el.font || theme.body}', Arial, sans-serif`, fontSize: el.size || 24, color: el.color || theme.text, textAlign: el.align || "left", lineHeight: 1.2,
    display: "flex", flexDirection: "column", justifyContent: el.valign === "middle" ? "center" : el.valign === "bottom" ? "flex-end" : "flex-start", width: "100%", height: "100%", padding: el.type === "shape" ? "8px 12px" : "4px 6px", overflowWrap: "break-word",
  };
  const body = el.type === "image" ? <img src={el.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: el.radius || 0, display: "block" }} />
    : <>
      {el.type === "shape" && <svg className="absolute inset-0" width={el.w} height={el.h} viewBox={`0 0 ${el.w} ${el.h}`} overflow="visible"><path d={shapePath(el.shape || "rect", el.w, el.h, el.radius)} fill={el.shape === "line" ? "none" : el.fill && el.fill !== "none" ? el.fill : "transparent"} stroke={el.shape === "line" ? el.stroke && el.stroke !== "none" ? el.stroke : el.fill || theme.accent : el.stroke && el.stroke !== "none" ? el.stroke : "none"} strokeWidth={el.shape === "line" ? el.strokeW || 4 : el.strokeW || 2} /></svg>}
      {(el.html || editing) && el.shape !== "line" && <div className="arise-slide-text relative" style={text}>
        {editing ? <div ref={editRef} contentEditable suppressContentEditableWarning className="outline-none" style={{ minHeight: "1.2em", cursor: "text" }} dangerouslySetInnerHTML={{ __html: el.html || "<p><br></p>" }} />
          : <div dangerouslySetInnerHTML={{ __html: el.html || "" }} />}
      </div>}
    </>;
  return <div data-el={el.id} style={box} onPointerDown={(e) => { if (onPointerDown && !editing) { e.stopPropagation(); onPointerDown(e, el); } }}>{body}</div>;
}

const SLIDE_CSS = `
.arise-slide-text p { margin: 0 0 0.25em; } .arise-slide-text ul { list-style: disc; padding-left: 1.1em; margin: 0; } .arise-slide-text ol { list-style: decimal; padding-left: 1.3em; margin: 0; }
.arise-slide-text li { margin: 0 0 0.35em; } .arise-slide-text ul ul { list-style: circle; font-size: 0.85em; } .arise-slide-text a { text-decoration: underline; }
@keyframes arise-fade { from { opacity: 0 } to { opacity: 1 } } @keyframes arise-slide { from { transform: translateX(8%); opacity: 0 } to { transform: none; opacity: 1 } } @keyframes arise-zoom { from { transform: scale(.92); opacity: 0 } to { transform: none; opacity: 1 } }
`;

// ─── Editor ──────────────────────────────────────────────────────────────────

export default function SlidesEditor({ id, onBack, onOpen }: { id: string; onBack: () => void; onOpen?: (id: string) => void }) {
  const doc = useCloudDoc<Deck>(id, cleanDeck);
  useEffect(() => { loadOfficeFonts(); }, []);
  if (!doc.content) return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-white text-slate-600">
    {doc.loading ? <><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-200 border-t-amber-600" /><p className="text-sm font-semibold">Opening presentation…</p></>
      : <><p className="text-sm font-semibold">{doc.error || "That presentation couldn't be opened."}</p><button type="button" onClick={onBack} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Back to files</button></>}
  </div>;
  return <Studio doc={doc as DocHandle} id={id} onBack={onBack} onOpen={onOpen} />;
}

function Studio({ doc, id, onBack, onOpen }: { doc: DocHandle; id: string; onBack: () => void; onOpen?: (id: string) => void }) {
  const { token } = useAuth();
  const api = docsApi(token);
  const deck = doc.content;
  const theme = themeOf(deck.theme);
  const deckRef = useRef(deck); deckRef.current = deck;
  const past = useRef<Deck[]>([]); const future = useRef<Deck[]>([]);
  const [, bump] = useState(0);
  const commit = useCallback((fn: (d: Deck) => Deck) => { const prev = deckRef.current; const next = fn(prev); if (next === prev) return; past.current.push(prev); if (past.current.length > 120) past.current.shift(); future.current = []; deckRef.current = next; doc.setContent(next); }, [doc]);
  const undo = () => { const p = past.current.pop(); if (!p) return; future.current.push(deckRef.current); deckRef.current = p; doc.setContent(p); bump((x) => x + 1); };
  const redo = () => { const f = future.current.pop(); if (!f) return; past.current.push(deckRef.current); deckRef.current = f; doc.setContent(f); bump((x) => x + 1); };

  const [cur, setCur] = useState(0);
  const si = Math.min(cur, deck.slides.length - 1);
  const slide = deck.slides[si];
  const [sel, setSel] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const [present, setPresent] = useState<number | null>(null);
  const [dialog, setDialog] = useState<null | "ai" | "theme" | "versions">(null);
  const [toast, setToast] = useState("");
  const say = (m: string) => { setToast(m); window.setTimeout(() => setToast(""), 3000); };
  const [starred, setStarred] = useState(false);
  useEffect(() => { api.list("slides").then((all) => setStarred(!!all.find((d) => d.id === id)?.starred)).catch(() => {}); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const selected = slide.elements.filter((e) => sel.includes(e.id));
  const one = selected.length === 1 ? selected[0] : null;
  const clip = useRef<El[]>([]);
  const [thumbMenu, setThumbMenu] = useState<{ i: number; el: HTMLElement } | null>(null);

  const updSlide = (fn: (s: Slide) => Slide, i = si) => commit((d) => ({ ...d, slides: d.slides.map((s, k) => (k === i ? fn(s) : s)) }));
  const updEls = (ids: string[], patch: Partial<El> | ((e: El) => El)) => updSlide((s) => ({ ...s, elements: s.elements.map((e) => (ids.includes(e.id) ? (typeof patch === "function" ? patch(e) : { ...e, ...patch }) : e)) }));
  const addEl = (e: El) => { updSlide((s) => ({ ...s, elements: [...s.elements, e] })); setSel([e.id]); };

  // ─── Canvas size ───
  const area = useRef<HTMLDivElement>(null);
  const [areaSize, setAreaSize] = useState({ w: 800, h: 450 });
  useLayoutEffect(() => { const el = area.current; if (!el) return; const ro = new ResizeObserver(() => setAreaSize({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el); setAreaSize({ w: el.clientWidth, h: el.clientHeight }); return () => ro.disconnect(); }, []);
  const scale = Math.max(0.2, Math.min((areaSize.w - 32) / CW, (areaSize.h - 32) / CH));

  // ─── Text editing ───
  const finishEdit = useCallback(() => {
    if (!editing || !editRef.current) { setEditing(null); return; }
    const html = sanitizeHtml(editRef.current.innerHTML);
    const idd = editing;
    setEditing(null);
    commit((d) => ({ ...d, slides: d.slides.map((s, k) => (k === si ? { ...s, elements: s.elements.map((e) => (e.id === idd ? { ...e, html } : e)) } : s)) }));
  }, [editing, si, commit]);
  const startEdit = (e: El) => {
    if (e.type === "image") return;
    setSel([e.id]); setEditing(e.id);
    window.setTimeout(() => { const r = editRef.current; if (!r) return; r.focus(); const range = document.createRange(); range.selectNodeContents(r); range.collapse(false); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(range); }, 0);
  };
  /** Bold, italic, colour… on the words being edited, or on all the text of the selected boxes. */
  const inline = (cmd: string, value?: string) => {
    if (editing && editRef.current) { editRef.current.focus(); document.execCommand("styleWithCSS", false, "true"); document.execCommand(cmd, false, value); return; }
    if (!selected.length) return;
    updEls(selected.map((e) => e.id), (e) => {
      if (!e.html) return e;
      const div = document.createElement("div"); div.contentEditable = "true"; div.innerHTML = e.html; div.style.position = "fixed"; div.style.left = "-9999px"; document.body.appendChild(div);
      div.focus(); const r = document.createRange(); r.selectNodeContents(div); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r);
      document.execCommand("styleWithCSS", false, "true"); document.execCommand(cmd, false, value);
      const html = sanitizeHtml(div.innerHTML); div.remove();
      return { ...e, html };
    });
  };

  // ─── Pointer: select, move, resize, rotate ───
  const drag = useRef<null | { kind: "move" | "resize" | "rotate"; handle?: string; x0: number; y0: number; start: Map<string, El>; moved: boolean }>(null);
  const [guides, setGuides] = useState<{ v?: number; h?: number }>({});
  const onCanvasDown = (e: React.PointerEvent, el: El | null) => {
    if (present !== null) return;
    if (editing && el?.id !== editing) finishEdit();
    if (!el) { setSel([]); return; }
    if (e.shiftKey || e.metaKey || e.ctrlKey) { setSel((s) => (s.includes(el.id) ? s.filter((x) => x !== el.id) : [...s, el.id])); return; }
    const ids = sel.includes(el.id) ? sel : [el.id];
    if (!sel.includes(el.id)) setSel([el.id]);
    drag.current = { kind: "move", x0: e.clientX, y0: e.clientY, start: new Map(slide.elements.filter((x) => ids.includes(x.id)).map((x) => [x.id, x])), moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onHandleDown = (e: React.PointerEvent, handle: string) => {
    e.stopPropagation(); e.preventDefault();
    drag.current = { kind: handle === "rot" ? "rotate" : "resize", handle, x0: e.clientX, y0: e.clientY, start: new Map(selected.map((x) => [x.id, x])), moved: false };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const live = useRef<Map<string, El> | null>(null);
  const [, rerender] = useState(0);
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = (e.clientX - d.x0) / scale, dy = (e.clientY - d.y0) / scale;
    if (!d.moved && Math.hypot(dx, dy) < 2) return;
    d.moved = true;
    const next = new Map<string, El>();
    const g: { v?: number; h?: number } = {};
    for (const [k, s] of d.start) {
      if (d.kind === "move") {
        let nx = s.x + dx, ny = s.y + dy;
        if (d.start.size === 1 && !e.altKey) {
          // Snap to the middle and edges of the slide.
          const cx = nx + s.w / 2, cy = ny + s.h / 2;
          if (Math.abs(cx - CW / 2) < 6) { nx = CW / 2 - s.w / 2; g.v = CW / 2; }
          if (Math.abs(cy - CH / 2) < 6) { ny = CH / 2 - s.h / 2; g.h = CH / 2; }
          if (Math.abs(nx) < 6) nx = 0; if (Math.abs(ny) < 6) ny = 0;
          if (Math.abs(nx + s.w - CW) < 6) nx = CW - s.w; if (Math.abs(ny + s.h - CH) < 6) ny = CH - s.h;
        }
        next.set(k, { ...s, x: Math.round(nx), y: Math.round(ny) });
      } else if (d.kind === "resize") {
        const h = d.handle!;
        let { x, y, w, h: hh } = s;
        if (h.includes("e")) w = Math.max(10, s.w + dx);
        if (h.includes("s")) hh = Math.max(10, s.h + dy);
        if (h.includes("w")) { w = Math.max(10, s.w - dx); x = s.x + s.w - w; }
        if (h.includes("n")) { hh = Math.max(10, s.h - dy); y = s.y + s.h - hh; }
        if ((e.shiftKey || s.type === "image") && h.length === 2) { const ratio = s.w / s.h; if (w / hh > ratio) w = hh * ratio; else hh = w / ratio; if (h.includes("w")) x = s.x + s.w - w; if (h.includes("n")) y = s.y + s.h - hh; }
        next.set(k, { ...s, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(hh) });
      } else {
        const rect = area.current!.querySelector<HTMLElement>(`[data-el="${k}"]`)!.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        let a = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
        if (!e.shiftKey) a = Math.round(a / 15) * 15;
        next.set(k, { ...s, rot: ((Math.round(a) % 360) + 360) % 360 || undefined });
      }
    }
    live.current = next; setGuides(g); rerender((x) => x + 1);
  };
  const onUp = () => {
    const d = drag.current; drag.current = null; setGuides({});
    if (!d) return;
    const l = live.current; live.current = null;
    if (d.moved && l) updSlide((s) => ({ ...s, elements: s.elements.map((e) => l.get(e.id) || e) }));
    else rerender((x) => x + 1);
  };
  const shownSlide: Slide = live.current ? { ...slide, elements: slide.elements.map((e) => live.current!.get(e.id) || e) } : slide;

  // ─── Slides ───
  const addSlide = (layout: LayoutId) => { const s = makeSlide(layout, theme); commit((d) => { const slides = [...d.slides]; slides.splice(si + 1, 0, s); return { ...d, slides }; }); setCur(si + 1); setSel([]); };
  const dupSlide = (i = si) => { commit((d) => { const slides = [...d.slides]; const c: Slide = JSON.parse(JSON.stringify(d.slides[i])); c.id = elId(); c.elements.forEach((e) => { e.id = elId(); }); slides.splice(i + 1, 0, c); return { ...d, slides }; }); setCur(i + 1); };
  const delSlide = (i = si) => { if (deck.slides.length <= 1) { say("A presentation needs at least one slide."); return; } commit((d) => ({ ...d, slides: d.slides.filter((_s, k) => k !== i) })); setCur(Math.max(0, i - (i >= si ? 1 : 0))); setSel([]); };
  const moveSlide = (from: number, to: number) => { if (to < 0 || to >= deck.slides.length || from === to) return; commit((d) => { const slides = [...d.slides]; const [s] = slides.splice(from, 1); slides.splice(to, 0, s); return { ...d, slides }; }); setCur(to); };
  const setTheme = (tid: string) => {
    const t = themeOf(tid), old = theme;
    // Text and accents that followed the old theme follow the new one.
    commit((d) => ({ ...d, theme: tid, slides: d.slides.map((s) => ({ ...s, elements: s.elements.map((e) => {
      const n2 = { ...e };
      if (e.color === old.title) n2.color = t.title; else if (e.color === old.text) n2.color = t.text; else if (e.color === old.accent) n2.color = t.accent;
      if (e.fill === old.accent) n2.fill = t.accent; else if (e.fill === old.accent2) n2.fill = t.accent2;
      if (e.font === old.heading) n2.font = t.heading; else if (e.font === old.body) n2.font = t.body;
      return n2;
    }) })) }));
  };

  // ─── Inserting ───
  const addText = () => addEl({ id: elId(), type: "text", x: 280, y: 220, w: 400, h: 80, html: "<p>Text</p>", size: 28, color: theme.text, font: theme.body });
  const addShape = (k: ShapeKind) => addEl({ id: elId(), type: "shape", shape: k, x: 380, y: 170, w: k === "line" ? 240 : 200, h: k === "line" ? 20 : 200, fill: k === "line" ? theme.accent : theme.accent2, stroke: k === "line" ? theme.accent : "none", strokeW: k === "line" ? 4 : 2, html: "", color: theme.text, size: 22, align: "center", valign: "middle" });
  const addImage = async (replace?: El) => {
    const f = await pickFile("image/*"); if (!f) return;
    try {
      const { url, w, h } = await loadImage(f);
      const box = replace ? (() => { const r = Math.min(replace.w / w, replace.h / h); return { w: w * r, h: h * r, x: replace.x + (replace.w - w * r) / 2, y: replace.y + (replace.h - h * r) / 2 }; })() : (() => { const r = Math.min(600 / w, 380 / h, 1); return { w: w * r, h: h * r, x: (CW - w * r) / 2, y: (CH - h * r) / 2 }; })();
      const el: El = { id: elId(), type: "image", src: url, x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h) };
      if (replace) updSlide((s) => ({ ...s, elements: s.elements.map((e) => (e.id === replace.id ? el : e)) })); else addEl(el);
      setSel([el.id]);
    } catch (e: any) { say(e.message); }
  };
  const order = (dir: "front" | "back" | "up" | "down") => updSlide((s) => {
    const els = [...s.elements]; const ids = new Set(sel);
    if (dir === "front") return { ...s, elements: [...els.filter((e) => !ids.has(e.id)), ...els.filter((e) => ids.has(e.id))] };
    if (dir === "back") return { ...s, elements: [...els.filter((e) => ids.has(e.id)), ...els.filter((e) => !ids.has(e.id))] };
    const i = els.findIndex((e) => ids.has(e.id)); const j = i + (dir === "up" ? 1 : -1); if (i < 0 || j < 0 || j >= els.length) return s; [els[i], els[j]] = [els[j], els[i]]; return { ...s, elements: els };
  });
  const remove = () => { if (!sel.length) return; updSlide((s) => ({ ...s, elements: s.elements.filter((e) => !sel.includes(e.id)) })); setSel([]); };
  const duplicate = () => { const copies = selected.map((e) => ({ ...e, id: elId(), x: e.x + 20, y: e.y + 20 })); if (!copies.length) return; updSlide((s) => ({ ...s, elements: [...s.elements, ...copies] })); setSel(copies.map((c) => c.id)); };
  const align = (how: "left" | "center" | "right" | "top" | "middle" | "bottom") => updEls(sel, (e) => ({ ...e, ...(how === "left" ? { x: 0 } : how === "center" ? { x: Math.round((CW - e.w) / 2) } : how === "right" ? { x: CW - e.w } : how === "top" ? { y: 0 } : how === "middle" ? { y: Math.round((CH - e.h) / 2) } : { y: CH - e.h }) }));

  // ─── Keys ───
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (present !== null || dialog) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true]")) { if (e.key === "Escape" && editing) { finishEdit(); } return; }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); if (sel.length) duplicate(); else dupSlide(); return; }
      if (mod && e.key.toLowerCase() === "c" && sel.length) { clip.current = JSON.parse(JSON.stringify(selected)); return; }
      if (mod && e.key.toLowerCase() === "v" && clip.current.length) { e.preventDefault(); const copies = clip.current.map((x) => ({ ...x, id: elId(), x: x.x + 16, y: x.y + 16 })); updSlide((s) => ({ ...s, elements: [...s.elements, ...copies] })); setSel(copies.map((c) => c.id)); clip.current = copies; return; }
      if (mod && e.key.toLowerCase() === "a") { e.preventDefault(); setSel(slide.elements.map((x) => x.id)); return; }
      if (mod && e.key === "Enter") { e.preventDefault(); addSlide("content"); return; }
      if (e.key === "F5" || (mod && e.key === "Enter" && e.shiftKey)) { e.preventDefault(); setPresent(si); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && sel.length) { e.preventDefault(); remove(); return; }
      if (e.key === "Escape") { setSel([]); return; }
      if (e.key === "Enter" && one) { e.preventDefault(); startEdit(one); return; }
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (arrows[e.key] && sel.length) { e.preventDefault(); const step = e.shiftKey ? 10 : 1; const [ax, ay] = arrows[e.key]; updEls(sel, (x) => ({ ...x, x: x.x + ax * step, y: x.y + ay * step })); return; }
      if (!sel.length && (e.key === "ArrowDown" || e.key === "PageDown")) { setCur(Math.min(deck.slides.length - 1, si + 1)); return; }
      if (!sel.length && (e.key === "ArrowUp" || e.key === "PageUp")) { setCur(Math.max(0, si - 1)); return; }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  // ─── Files ───
  const print = () => {
    const w = window.open("", "_blank"); if (!w) { say("Allow pop-ups for Arise to print."); return; }
    const pages = deck.slides.filter((s) => !s.hidden).map((s) => slideHtml(s, theme)).join("");
    w.document.open(); w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${doc.name.replace(/</g, "&lt;")}</title><link rel="stylesheet" href="${FONT_LINK}"><style>@page { size: 13.333in 7.5in; margin: 0; } body { margin: 0; } .s { width: 13.333in; height: 7.5in; position: relative; overflow: hidden; break-after: page; } .s > div { transform-origin: 0 0; transform: scale(${(13.333 * 96) / CW}); } ${SLIDE_CSS}</style></head><body>${pages}</body></html>`);
    w.document.close(); w.focus(); window.setTimeout(() => { try { w.print(); } catch { /* still open */ } }, 700);
  };
  const download = () => downloadBlob(`${safeName(doc.name || "Presentation")}.pptx`, writePptx(deckRef.current, doc.name) as BlobPart, PPTX_MIME);
  const importSlides = async () => {
    const f = await pickFile(".pptx"); if (!f) return;
    try { const d = await readPptx(await f.arrayBuffer()); commit((dd) => ({ ...dd, slides: [...dd.slides, ...d.slides] })); setCur(deck.slides.length); say(`Added ${d.slides.length} slides from ${f.name}.`); }
    catch (e: any) { say(e.message || "That file couldn't be opened."); }
  };
  const newFile = async () => { try { const d = await api.create("slides", "Untitled presentation", blankDeck()); onOpen?.(d.id); } catch (e: any) { say(e.message); } };
  const copy = async () => { try { const d = await api.create("slides", `Copy of ${doc.name}`, deckRef.current); onOpen?.(d.id); } catch (e: any) { say(e.message); } };
  const trash = async () => { if (!window.confirm(`Move "${doc.name}" to the trash? You can restore it for 30 days.`)) return; try { await api.trash(id); onBack(); } catch (e: any) { say(e.message); } };

  const menus = [
    { label: "File", items: (): MenuItem[] => [
      { label: "New presentation", onClick: () => void newFile() }, { label: "Open…", onClick: onBack }, { label: "Make a copy", onClick: () => void copy() }, { sep: true },
      { label: "Import slides from PowerPoint…", onClick: () => void importSlides() },
      { label: "Download", sub: [{ label: "Microsoft PowerPoint (.pptx)", onClick: download }, { label: "PDF document (.pdf)", onClick: print }] },
      { sep: true }, { label: "Version history", onClick: () => setDialog("versions") }, { label: "Print", onClick: print }, { sep: true }, { label: "Move to trash", danger: true, onClick: () => void trash() },
    ] },
    { label: "Edit", items: (): MenuItem[] => [
      { label: "Undo", keys: "Ctrl+Z", disabled: !past.current.length, onClick: undo }, { label: "Redo", keys: "Ctrl+Y", disabled: !future.current.length, onClick: redo }, { sep: true },
      { label: "Duplicate", keys: "Ctrl+D", disabled: !sel.length, onClick: duplicate }, { label: "Delete", keys: "Delete", disabled: !sel.length, onClick: remove }, { label: "Select all", keys: "Ctrl+A", onClick: () => setSel(slide.elements.map((x) => x.id)) },
    ] },
    { label: "Insert", items: (): MenuItem[] => [
      { label: "Text box", icon: <Type size={14} />, onClick: addText }, { label: "Image", icon: <ImageIcon size={14} />, onClick: () => void addImage() },
      { label: "Shape", icon: <Shapes size={14} />, sub: SHAPES.map((s): MenuItem => ({ label: s.label, onClick: () => addShape(s.id) })) }, { sep: true },
      { label: "New slide", keys: "Ctrl+Enter", sub: LAYOUTS.map((l): MenuItem => ({ label: l.name, onClick: () => addSlide(l.id) })) },
    ] },
    { label: "Slide", items: (): MenuItem[] => [
      { label: "New slide", sub: LAYOUTS.map((l): MenuItem => ({ label: l.name, onClick: () => addSlide(l.id) })) }, { label: "Duplicate slide", onClick: () => dupSlide() }, { label: "Delete slide", danger: true, onClick: () => delSlide() },
      { label: slide.hidden ? "Show slide" : "Skip slide when presenting", onClick: () => updSlide((s) => ({ ...s, hidden: !s.hidden })) }, { sep: true },
      { label: "Move up", disabled: si === 0, onClick: () => moveSlide(si, si - 1) }, { label: "Move down", disabled: si === deck.slides.length - 1, onClick: () => moveSlide(si, si + 1) }, { sep: true },
      { label: "Change theme…", onClick: () => setDialog("theme") },
      { label: "Transition", sub: (["none", "fade", "slide", "zoom"] as const).map((t): MenuItem => ({ label: t === "none" ? "None" : t[0].toUpperCase() + t.slice(1), checked: (slide.transition || "fade") === t, onClick: () => updSlide((s) => ({ ...s, transition: t })) })) },
      { label: "Apply this transition to all slides", onClick: () => commit((d) => ({ ...d, slides: d.slides.map((s) => ({ ...s, transition: slide.transition || "fade" })) })) },
    ] },
    { label: "Arrange", items: (): MenuItem[] => [
      { label: "Bring to front", disabled: !sel.length, onClick: () => order("front") }, { label: "Bring forward", disabled: !sel.length, onClick: () => order("up") }, { label: "Send backward", disabled: !sel.length, onClick: () => order("down") }, { label: "Send to back", disabled: !sel.length, onClick: () => order("back") }, { sep: true },
      { label: "Align on slide", disabled: !sel.length, sub: (["left", "center", "right", "top", "middle", "bottom"] as const).map((a): MenuItem => ({ label: a[0].toUpperCase() + a.slice(1), onClick: () => align(a) })) },
      { label: "Rotate", disabled: !sel.length, sub: [0, 90, 180, 270, 15, -15].map((r): MenuItem => ({ label: r === 0 ? "Reset" : `${r}°`, onClick: () => updEls(sel, (e) => ({ ...e, rot: r === 0 ? undefined : (((e.rot || 0) + r) % 360) || undefined })) })) },
    ] },
    { label: "Tools", items: (): MenuItem[] => [{ label: "AI presentation builder", icon: <Sparkles size={14} />, onClick: () => setDialog("ai") }] },
  ];

  const isText = !!one && one.type !== "image";
  const H = (h: string, cx: number, cy: number, cursor: string) => <span key={h} data-handle={h} onPointerDown={(e) => onHandleDown(e, h)} className="absolute z-10 h-3 w-3 rounded-sm border-2 border-white bg-sky-600 shadow" style={{ left: cx - 6, top: cy - 6, cursor, touchAction: "none" }} />;

  return <div className="flex h-[calc(100dvh-8rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm" data-testid="slides-editor">
    <div className="flex items-start gap-2 px-2 pt-2 sm:px-3">
      <button type="button" onClick={async () => { finishEdit(); await doc.flush(); onBack(); }} aria-label="Back to files" title="Back to files" className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"><ArrowLeft size={18} /></button>
      <span className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white sm:inline-flex"><Presentation size={18} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <input value={doc.name} onChange={(e) => doc.setName(e.target.value)} aria-label="Presentation name" className="min-w-0 max-w-[50vw] rounded-md border border-transparent px-1.5 py-0.5 text-[17px] font-semibold hover:border-slate-300 focus:border-sky-500 focus:outline-none sm:max-w-md" />
          <button type="button" onClick={() => { const n2 = !starred; setStarred(n2); void api.save(id, { starred: n2 }).catch(() => setStarred(!n2)); }} aria-label={starred ? "Unstar" : "Star"} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"><Star size={15} className={starred ? "fill-amber-400 text-amber-500" : ""} /></button>
          <span className={`hidden truncate text-xs sm:inline ${doc.state === "error" || doc.state === "conflict" ? "font-bold text-rose-600" : "text-slate-500"}`}>{saveLabel(doc.state)}</span>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={() => setDialog("ai")} className="hidden items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1.5 text-sm font-bold text-violet-800 hover:bg-violet-200 sm:inline-flex"><Sparkles size={15} />AI deck</button>
            <button type="button" onClick={() => { finishEdit(); setPresent(si); }} data-testid="slides-present" className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3.5 py-1.5 text-sm font-bold text-white hover:bg-amber-600"><Play size={15} />Present</button>
          </div>
        </div>
        <MenuBar menus={menus} />
      </div>
    </div>
    {doc.state === "conflict" && <div className="mx-3 mt-1 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">This presentation was changed on another device.
      <button type="button" onClick={doc.keepMine} className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-bold text-white">Keep what's here</button><button type="button" onClick={() => void doc.reload()} className="rounded-md bg-white px-2.5 py-1 text-xs font-bold ring-1 ring-amber-300">Load the other copy</button></div>}

    <div className="px-2 pb-1.5 pt-1 sm:px-3">
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full bg-slate-100/80 px-2 py-1" data-testid="slides-toolbar" onMouseDown={(e) => { if ((e.target as HTMLElement).closest("button") && editing) e.preventDefault(); }}>
        <DropButton title="New slide" label={<Plus size={16} />}>{(close) => <LayoutPicker theme={theme} onPick={(l) => { addSlide(l); close(); }} />}</DropButton>
        <Tool title="Undo" keys="Ctrl+Z" onClick={undo} disabled={!past.current.length}><Undo2 size={16} /></Tool>
        <Tool title="Redo" keys="Ctrl+Y" onClick={redo} disabled={!future.current.length}><Redo2 size={16} /></Tool>
        <ToolSep />
        <Tool title="Text box" onClick={addText} testId="slides-add-text"><Type size={16} /></Tool>
        <Tool title="Image" onClick={() => void addImage()}><ImageIcon size={16} /></Tool>
        <DropButton title="Shape" label={<Shapes size={16} />}>{(close) => <div className="grid w-[230px] grid-cols-5 gap-1 p-2">{SHAPES.map((s) => <button key={s.id} type="button" title={s.label} aria-label={s.label} onClick={() => { addShape(s.id); close(); }} className="inline-flex h-10 items-center justify-center rounded-md hover:bg-slate-100"><svg width="26" height="22" viewBox="-2 -2 30 26"><path d={shapePath(s.id, 26, 22)} fill={s.id === "line" ? "none" : "#bae6fd"} stroke="#0369a1" strokeWidth="1.6" /></svg></button>)}</div>}</DropButton>
        <ToolSep />
        {isText && <>
          <DropButton title="Font" label={<span className="w-[78px] truncate text-left text-[12px]" style={{ fontFamily: one!.font || theme.body }}>{one!.font || theme.body}</span>}>{(close) => <MenuList items={[...new Set([theme.heading, theme.body, ...DOC_FONTS])].map((f) => ({ label: f, checked: (one!.font || theme.body) === f, icon: <span style={{ fontFamily: f }}>A</span>, onClick: () => updEls(sel, { font: f }) }))} onDone={close} />}</DropButton>
          <DropButton title="Size" label={<span className="w-6 text-center text-[12px]">{one!.size || 24}</span>}>{(close) => <MenuList items={TEXT_SIZES.map((s) => ({ label: String(s), checked: (one!.size || 24) === s, onClick: () => updEls(sel, { size: s }) }))} onDone={close} />}</DropButton>
          <Tool title="Bold" onClick={() => inline("bold")}><Bold size={16} /></Tool>
          <Tool title="Italic" onClick={() => inline("italic")}><Italic size={16} /></Tool>
          <Tool title="Underline" onClick={() => inline("underline")}><Underline size={16} /></Tool>
          <DropButton title="Text colour" label={<span className="flex flex-col items-center"><Baseline size={15} /><span className="-mt-0.5 h-1 w-4 rounded" style={{ background: one!.color || theme.text }} /></span>}>{(close) => <ColorGrid value={one!.color} onPick={(c) => { if (editing) inline("foreColor", c || theme.text); else updEls(sel, { color: c || theme.text }); close(); }} />}</DropButton>
          <DropButton title="Align" label={one!.align === "center" ? <AlignCenter size={15} /> : one!.align === "right" ? <AlignRight size={15} /> : <AlignLeft size={15} />}>{(close) => <MenuList items={[{ label: "Left", icon: <AlignLeft size={14} />, onClick: () => updEls(sel, { align: "left" }) }, { label: "Center", icon: <AlignCenter size={14} />, onClick: () => updEls(sel, { align: "center" }) }, { label: "Right", icon: <AlignRight size={14} />, onClick: () => updEls(sel, { align: "right" }) }, { sep: true }, { label: "Top", icon: <ArrowUpToLine size={14} />, onClick: () => updEls(sel, { valign: "top" }) }, { label: "Middle", icon: <MoveVertical size={14} />, onClick: () => updEls(sel, { valign: "middle" }) }, { label: "Bottom", icon: <ArrowDownToLine size={14} />, onClick: () => updEls(sel, { valign: "bottom" }) }]} onDone={close} />}</DropButton>
          <Tool title="Bullets" onClick={() => { if (editing) inline("insertUnorderedList"); else startEdit(one!); }}><List size={16} /></Tool>
          <ToolSep />
        </>}
        {one && one.type !== "image" && <>
          <DropButton title={one.type === "shape" ? "Fill" : "Box fill"} label={<span className="flex flex-col items-center"><PaintBucket size={15} /><span className="-mt-0.5 h-1 w-4 rounded border border-slate-300" style={{ background: one.fill && one.fill !== "none" ? one.fill : "#fff" }} /></span>}>{(close) => <ColorGrid value={one.fill} resetLabel="No fill" onPick={(c) => { updEls(sel, { fill: c || "none" }); close(); }} />}</DropButton>
          <DropButton title="Border" label={<span className="inline-block h-4 w-4 rounded-sm border-2" style={{ borderColor: one.stroke && one.stroke !== "none" ? one.stroke : "#94a3b8" }} />}>{(close) => <div><ColorGrid value={one.stroke} resetLabel="No border" onPick={(c) => { updEls(sel, { stroke: c || "none" }); close(); }} /><div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs">Width {[1, 2, 4, 8].map((w) => <button key={w} type="button" onClick={() => updEls(sel, { strokeW: w })} className={`rounded px-2 py-0.5 ring-1 ${one.strokeW === w ? "bg-sky-100 ring-sky-300" : "ring-slate-200"}`}>{w}</button>)}</div></div>}</DropButton>
        </>}
        {sel.length > 0 && <>
          <DropButton title="Animation" label={<span className="text-[12px] font-bold">✨</span>}>{(close) => <MenuList items={(["none", "fade", "rise", "zoom"] as const).map((a) => ({ label: a === "none" ? "No animation" : a === "rise" ? "Fly in from below" : a[0].toUpperCase() + a.slice(1) + " in", checked: (one?.anim || "none") === a, onClick: () => updEls(sel, { anim: a }) }))} onDone={close} />}</DropButton>
          <Tool title="Bring to front" onClick={() => order("front")}><BringToFront size={15} /></Tool>
          <Tool title="Send to back" onClick={() => order("back")}><SendToBack size={15} /></Tool>
          <Tool title="Duplicate" keys="Ctrl+D" onClick={duplicate}><Copy size={15} /></Tool>
          <Tool title="Delete" keys="Delete" onClick={remove}><Trash2 size={15} /></Tool>
          <ToolSep />
        </>}
        {!sel.length && <>
          <button type="button" onClick={() => setDialog("theme")} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] font-bold text-slate-700 hover:bg-slate-100"><span className="h-4 w-4 rounded-full ring-1 ring-slate-300" style={{ background: theme.accent }} />Theme</button>
          <DropButton title="Background" label={<span className="text-[12px] font-bold">Background</span>}>{(close) => <ColorGrid value={slide.bg} resetLabel="Theme background" onPick={(c) => { updSlide((s) => ({ ...s, bg: c })); close(); }} />}</DropButton>
          <DropButton title="Transition" label={<span className="text-[12px] font-bold">Transition</span>}>{(close) => <MenuList items={(["none", "fade", "slide", "zoom"] as const).map((t) => ({ label: t === "none" ? "None" : t[0].toUpperCase() + t.slice(1), checked: (slide.transition || "fade") === t, onClick: () => updSlide((s) => ({ ...s, transition: t })) }))} onDone={close} />}</DropButton>
        </>}
      </div>
    </div>

    <div className="flex min-h-0 flex-1 flex-col border-t border-slate-200 md:flex-row">
      {/* Slide list */}
      <div className="order-2 flex shrink-0 gap-2 overflow-x-auto border-t border-slate-200 bg-slate-50 p-2 md:order-1 md:w-48 md:flex-col md:overflow-y-auto md:overflow-x-hidden md:border-r md:border-t-0" data-testid="slides-list">
        {deck.slides.map((s, i) => <SlideThumb key={s.id} slide={s} theme={theme} index={i} active={i === si} onClick={() => { finishEdit(); setCur(i); setSel([]); }} onMove={moveSlide} onMenu={(el) => setThumbMenu({ i, el })} />)}
        <button type="button" onClick={() => addSlide("content")} className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-500 hover:bg-white md:h-auto md:w-full md:py-3"><Plus size={18} /></button>
      </div>
      {/* Canvas */}
      <div className="order-1 flex min-h-0 min-w-0 flex-1 flex-col md:order-2">
        <div ref={area} className="relative flex min-h-0 flex-1 items-center justify-center bg-[#e9edf2]" onPointerMove={onMove} onPointerUp={onUp} onPointerDown={(e) => { if (e.target === e.currentTarget) { finishEdit(); setSel([]); } }} data-testid="slides-canvas">
          <div className="relative shadow-[0_2px_10px_rgba(0,0,0,.15)]" onDoubleClick={(e) => { const elId2 = (e.target as HTMLElement).closest<HTMLElement>("[data-el]")?.dataset.el; const el = slide.elements.find((x) => x.id === elId2); if (!el) return; if (el.type === "shape" && /add a picture/i.test(el.html || "")) void addImage(el); else startEdit(el); }}>
            <SlideView slide={shownSlide} theme={theme} scale={scale} onPointerDown={onCanvasDown} editingId={editing} editRef={editRef}>
              {guides.v !== undefined && <div className="pointer-events-none absolute top-0 h-full w-px bg-pink-500" style={{ left: guides.v }} />}
              {guides.h !== undefined && <div className="pointer-events-none absolute left-0 h-px w-full bg-pink-500" style={{ top: guides.h }} />}
            </SlideView>
            {/* Selection boxes and handles, drawn at screen size */}
            {shownSlide.elements.filter((e) => sel.includes(e.id)).map((e) => {
              const L = e.x * scale, T = e.y * scale, W = e.w * scale, Hh = e.h * scale;
              return <div key={e.id} className="pointer-events-none absolute" style={{ left: L, top: T, width: W, height: Hh, transform: e.rot ? `rotate(${e.rot}deg)` : undefined }}>
                <div className={`absolute inset-0 ${editing === e.id ? "ring-2 ring-sky-400" : "ring-2 ring-sky-600"}`} />
                {sel.length === 1 && editing !== e.id && <div className="pointer-events-auto">
                  {H("nw", 0, 0, "nwse-resize")}{H("n", W / 2, 0, "ns-resize")}{H("ne", W, 0, "nesw-resize")}{H("e", W, Hh / 2, "ew-resize")}
                  {H("se", W, Hh, "nwse-resize")}{H("s", W / 2, Hh, "ns-resize")}{H("sw", 0, Hh, "nesw-resize")}{H("w", 0, Hh / 2, "ew-resize")}
                  <span onPointerDown={(ev) => onHandleDown(ev, "rot")} title="Rotate" className="absolute z-10 h-3.5 w-3.5 cursor-grab rounded-full border-2 border-white bg-sky-600 shadow" style={{ left: W / 2 - 7, top: -28, touchAction: "none" }} />
                </div>}
              </div>;
            })}
          </div>
          <div className="absolute bottom-2 right-3 flex items-center gap-1 rounded-full bg-white/90 px-1 py-0.5 text-xs font-semibold text-slate-600 shadow ring-1 ring-slate-200">
            <button type="button" aria-label="Previous slide" onClick={() => { finishEdit(); setCur(Math.max(0, si - 1)); setSel([]); }} className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-slate-100"><ChevronLeft size={15} /></button>
            {si + 1} / {deck.slides.length}
            <button type="button" aria-label="Next slide" onClick={() => { finishEdit(); setCur(Math.min(deck.slides.length - 1, si + 1)); setSel([]); }} className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-slate-100"><ChevronRight size={15} /></button>
          </div>
          {editing && <p className="pointer-events-none absolute left-3 top-2 rounded-md bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-600 shadow">Typing — click outside the box when done</p>}
        </div>
        <div className="flex items-start gap-2 border-t border-slate-200 bg-white px-3 py-2">
          <StickyNote size={15} className="mt-1.5 shrink-0 text-slate-400" />
          <textarea value={slide.notes} onChange={(e) => { const v = e.target.value; doc.setContent((d) => ({ ...d, slides: d.slides.map((s, k) => (k === si ? { ...s, notes: v } : s)) })); }} rows={2} placeholder="Speaker notes — what you'll say on this slide" aria-label="Speaker notes" className="min-h-[44px] flex-1 resize-y rounded-md border border-transparent px-2 py-1 text-sm text-slate-700 hover:border-slate-200 focus:border-sky-400 focus:outline-none" />
        </div>
      </div>
    </div>
    <style>{SLIDE_CSS}</style>
    {thumbMenu && <Floating anchor={thumbMenu.el} onClose={() => setThumbMenu(null)}><MenuList items={[{ label: "Duplicate", onClick: () => dupSlide(thumbMenu.i) }, { label: "Delete", danger: true, onClick: () => delSlide(thumbMenu.i) }, { label: deck.slides[thumbMenu.i]?.hidden ? "Show slide" : "Skip when presenting", onClick: () => updSlide((s) => ({ ...s, hidden: !s.hidden }), thumbMenu.i) }, { sep: true }, { label: "Move up", disabled: thumbMenu.i === 0, onClick: () => moveSlide(thumbMenu.i, thumbMenu.i - 1) }, { label: "Move down", disabled: thumbMenu.i === deck.slides.length - 1, onClick: () => moveSlide(thumbMenu.i, thumbMenu.i + 1) }]} onDone={() => setThumbMenu(null)} /></Floating>}
    {present !== null && <PresentMode deck={deck} start={present} onClose={(at) => { setPresent(null); setCur(at); }} />}
    {dialog === "theme" && <Dialog title="Themes" onClose={() => setDialog(null)} wide><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{THEMES.map((t) => <button key={t.id} type="button" onClick={() => { setTheme(t.id); setDialog(null); }} className={`overflow-hidden rounded-xl text-left ring-2 ${t.id === theme.id ? "ring-sky-500" : "ring-slate-200 hover:ring-slate-400"}`}><SlideView slide={makeSlidePreview(t)} theme={t} scale={0.24} /><p className="px-2 py-1.5 text-xs font-bold">{t.name}</p></button>)}</div></Dialog>}
    {dialog === "ai" && <AiDeck token={token} theme={deck.theme} onClose={() => setDialog(null)} onDone={(d, how) => { setDialog(null); if (how === "replace") { commit(() => d); setCur(0); } else { commit((dd) => ({ ...dd, slides: [...dd.slides, ...d.slides] })); setCur(deck.slides.length); } say(`Made ${d.slides.length} slides. Undo removes them.`); }} />}
    {dialog === "versions" && <SlideVersions token={token} id={id} onClose={() => setDialog(null)} onRestore={(d) => { setDialog(null); commit(() => d); setCur(0); say("Restored. Undo brings back what you had."); }} />}
    {toast && <div role="status" className="pointer-events-none fixed bottom-6 left-1/2 z-[1100] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xl">{toast}</div>}
  </div>;
}

const makeSlidePreview = (t: Theme) => makeSlide("title", t, { title: "Aa Title", sub: "Body text" });

function SlideThumb({ slide, theme, index, active, onClick, onMove, onMenu }: { slide: Slide; theme: Theme; index: number; active: boolean; onClick: () => void; onMove: (from: number, to: number) => void; onMenu: (el: HTMLElement) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(150);
  useLayoutEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth); return () => ro.disconnect(); }, []);
  return <div className="flex shrink-0 items-start gap-1.5" draggable onDragStart={(e) => e.dataTransfer.setData("text/arise-slide", String(index))} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const from = Number(e.dataTransfer.getData("text/arise-slide")); if (Number.isFinite(from)) onMove(from, index); }}>
    <span className="hidden w-4 pt-1 text-right text-[11px] font-semibold text-slate-400 md:block">{index + 1}</span>
    <div ref={ref} role="button" tabIndex={0} aria-label={`Slide ${index + 1}: ${slideTitle(slide) || "untitled"}`} onClick={onClick} onContextMenu={(e) => { e.preventDefault(); onMenu(e.currentTarget); }} onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      className={`relative w-28 cursor-pointer overflow-hidden rounded-md ring-2 md:w-full ${active ? "ring-amber-500" : "ring-slate-200 hover:ring-slate-400"} ${slide.hidden ? "opacity-40" : ""}`}>
      <div className="pointer-events-none"><SlideView slide={slide} theme={theme} scale={(w || 112) / CW} /></div>
      {active && <button type="button" onClick={(e) => { e.stopPropagation(); onMenu(e.currentTarget); }} aria-label="Slide options" className="absolute right-1 top-1 rounded bg-white/90 px-1 text-[11px] font-bold text-slate-600 shadow">•••</button>}
    </div>
  </div>;
}

function LayoutPicker({ theme, onPick }: { theme: Theme; onPick: (l: LayoutId) => void }) {
  return <div className="grid w-[340px] grid-cols-2 gap-2 p-3">{LAYOUTS.map((l) => <button key={l.id} type="button" onClick={() => onPick(l.id)} className="overflow-hidden rounded-lg text-left ring-1 ring-slate-200 hover:ring-2 hover:ring-sky-400"><div className="pointer-events-none"><SlideView slide={makeSlide(l.id, theme)} theme={theme} scale={150 / CW} /></div><p className="px-2 py-1 text-[11px] font-bold">{l.name}</p></button>)}</div>;
}

// ─── Presenting ───
function PresentMode({ deck, start, onClose }: { deck: Deck; start: number; onClose: (at: number) => void }) {
  const theme = themeOf(deck.theme);
  const order = deck.slides.map((s, i) => ({ s, i })).filter((x) => !x.s.hidden);
  const [pos, setPos] = useState(() => Math.max(0, order.findIndex((x) => x.i >= start)));
  const [step, setStep] = useState(0);
  const [notes, setNotes] = useState(false);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const root = useRef<HTMLDivElement>(null);
  const cur = order[pos]?.s;
  const steps = cur ? cur.elements.filter((e) => e.anim && e.anim !== "none").length : 0;
  const next = () => { if (step < steps) setStep(step + 1); else if (pos < order.length - 1) { setPos(pos + 1); setStep(0); } };
  const prev = () => { if (step > 0) setStep(step - 1); else if (pos > 0) { setPos(pos - 1); setStep(0); } };
  useEffect(() => {
    void root.current?.requestFullscreen?.().catch(() => {});
    const r = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    const k = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); next(); }
      if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); prev(); }
      if (e.key === "Escape") close();
      if (e.key.toLowerCase() === "s") setNotes((x) => !x);
      if (e.key === "Home") { setPos(0); setStep(0); } if (e.key === "End") { setPos(order.length - 1); setStep(0); }
    };
    window.addEventListener("resize", r); window.addEventListener("keydown", k);
    const fs = () => { if (!document.fullscreenElement) setSize({ w: window.innerWidth, h: window.innerHeight }); };
    document.addEventListener("fullscreenchange", fs);
    return () => { window.removeEventListener("resize", r); window.removeEventListener("keydown", k); document.removeEventListener("fullscreenchange", fs); };
  });
  const close = () => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); onClose(order[pos]?.i ?? 0); };
  const touch = useRef(0);
  const sc = Math.min(size.w / CW, (size.h - (notes ? 140 : 0)) / CH);
  const anim = cur?.transition === "slide" ? "arise-slide" : cur?.transition === "zoom" ? "arise-zoom" : cur?.transition === "none" ? "" : "arise-fade";
  return <div ref={root} className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-black" onClick={(e) => { if (!(e.target as HTMLElement).closest("button")) next(); }} onTouchStart={(e) => { touch.current = e.touches[0].clientX; }} onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - touch.current; if (dx < -40) next(); else if (dx > 40) prev(); }} data-testid="slides-presenting">
    <style>{SLIDE_CSS}</style>
    {cur && <div key={cur.id} style={{ animation: anim ? `${anim} .5s ease` : undefined }}><SlideView slide={cur} theme={theme} scale={sc} animStep={step} /></div>}
    {notes && cur && <div className="w-full max-w-4xl overflow-auto px-6 py-3 text-lg text-slate-200" style={{ height: 130 }}>{cur.notes || <span className="text-slate-500">No speaker notes on this slide.</span>}</div>}
    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/10 px-2 py-1 text-sm text-white opacity-40 transition hover:opacity-100">
      <button type="button" onClick={prev} aria-label="Previous" className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/20"><ChevronLeft size={18} /></button>
      <span>{pos + 1} / {order.length}</span>
      <button type="button" onClick={next} aria-label="Next" className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/20"><ChevronRight size={18} /></button>
      <button type="button" onClick={() => setNotes((x) => !x)} className="rounded-full px-2 py-1 text-xs font-bold hover:bg-white/20">{notes ? "Hide notes" : "Notes"}</button>
      <button type="button" onClick={close} aria-label="Stop presenting" className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/20"><X size={18} /></button>
    </div>
  </div>;
}

// ─── AI and versions ───
function AiDeck({ token, theme, onClose, onDone }: { token: string | null; theme: string; onClose: () => void; onDone: (d: Deck, how: "replace" | "add") => void }) {
  const [topic, setTopic] = useState(""); const [audience, setAudience] = useState("students"); const [count, setCount] = useState("8"); const [th, setTh] = useState(theme); const [notes, setNotes] = useState("");
  const [how, setHow] = useState<"replace" | "add">("add");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const go = async () => {
    setBusy(true); setErr("");
    try {
      const r = await askAppAi<{ title: string; slides: { title: string; bullets: string[]; notes: string }[] }>(token, "slides-deck", { topic, audience, count, notes });
      if (!r?.slides?.length) throw new Error("No slides came back. Try again.");
      onDone(deckFromOutline(th, r.title || topic, r.slides.map((s) => ({ title: String(s.title || ""), bullets: Array.isArray(s.bullets) ? s.bullets.map(String).slice(0, 7) : [], notes: String(s.notes || "") }))), how);
    } catch (e: any) { setErr(e.message || "The AI couldn't make the deck. Try again."); } finally { setBusy(false); }
  };
  return <Dialog title="AI presentation builder" onClose={onClose} wide footer={<><button type="button" className={btnGhost} onClick={onClose}>Cancel</button><button type="button" className={btnPrimary} onClick={() => void go()} disabled={busy || !topic.trim()}><Sparkles size={14} />{busy ? "Building your slides…" : "Make slides"}</button></>}>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><Label text="What is the presentation about?"><textarea autoFocus value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} placeholder="e.g. The water cycle for 5th graders, with a quick check at the end" className={`${field} h-auto py-2`} /></Label></div>
      <Label text="Audience"><input value={audience} onChange={(e) => setAudience(e.target.value)} className={field} /></Label>
      <Label text="Slides"><select value={count} onChange={(e) => setCount(e.target.value)} className={field}>{["5", "6", "8", "10", "12", "15"].map((c) => <option key={c}>{c}</option>)}</select></Label>
      <Label text="Theme"><select value={th} onChange={(e) => setTh(e.target.value)} className={field}>{THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Label>
      <Label text="Put the slides"><select value={how} onChange={(e) => setHow(e.target.value as "replace" | "add")} className={field}><option value="add">After the slides I have</option><option value="replace">Instead of the slides I have</option></select></Label>
      <div className="sm:col-span-2"><Label text="Anything else? (optional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. include vocabulary, a fun fact, and 3 review questions" className={field} /></Label></div>
    </div>
    {err && <p className="mt-2 text-rose-600">{err}</p>}
    <p className="mt-3 text-xs text-slate-500">Every slide stays editable, with speaker notes written for you.</p>
  </Dialog>;
}

function SlideVersions({ token, id, onClose, onRestore }: { token: string | null; id: string; onClose: () => void; onRestore: (d: Deck) => void }) {
  const [list, setList] = useState<{ at: number }[] | null>(null); const [err, setErr] = useState("");
  useEffect(() => { docsApi(token).versions(id).then(setList).catch((e) => setErr(e.message)); }, [token, id]);
  return <Dialog title="Version history" onClose={onClose}>
    {err && <p className="text-rose-600">{err}</p>}
    {!list ? <p className="text-slate-500">Loading…</p> : !list.length ? <p className="text-slate-500">No earlier versions yet. A copy is kept every 10 minutes while you work.</p>
      : <ul className="divide-y divide-slate-100">{list.map((v) => <li key={v.at} className="flex items-center justify-between py-2"><span>{new Date(v.at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span><button type="button" className={btnGhost} onClick={async () => { try { const d = await docsApi(token).version<unknown>(id, v.at); onRestore(cleanDeck(d.content)); } catch (e: any) { setErr(e.message); } }}>Restore</button></li>)}</ul>}
  </Dialog>;
}

function loadImage(f: File): Promise<{ url: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    if (f.size > 20_000_000) { reject(new Error("That picture is too big (20 MB max).")); return; }
    const img = new Image(); const u = URL.createObjectURL(f);
    img.onload = () => { const s = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); resolve({ url: c.toDataURL(f.type === "image/png" ? "image/png" : "image/jpeg", 0.86), w: c.width, h: c.height }); };
    img.onerror = () => { URL.revokeObjectURL(u); reject(new Error("That picture couldn't be opened.")); };
    img.src = u;
  });
}

/** One slide as static HTML, for printing. */
function slideHtml(s: Slide, t: Theme): string {
  const bg = s.bg || (t.bg2 ? `linear-gradient(135deg, ${t.bg}, ${t.bg2})` : t.bg);
  const els = s.elements.map((e) => {
    const box = `position:absolute;left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;${e.rot ? `transform:rotate(${e.rot}deg);` : ""}opacity:${e.opacity ?? 1}`;
    if (e.type === "image") return `<img src="${e.src}" style="${box};object-fit:cover;border-radius:${e.radius || 0}px">`;
    const svg = e.type === "shape" ? `<svg width="${e.w}" height="${e.h}" style="position:absolute;inset:0;overflow:visible"><path d="${shapePath(e.shape || "rect", e.w, e.h, e.radius)}" fill="${e.shape === "line" ? "none" : e.fill && e.fill !== "none" ? e.fill : "transparent"}" stroke="${e.shape === "line" ? e.stroke || e.fill || t.accent : e.stroke && e.stroke !== "none" ? e.stroke : "none"}" stroke-width="${e.strokeW || (e.shape === "line" ? 4 : 2)}"/></svg>` : "";
    const txt = e.html && e.shape !== "line" ? `<div class="arise-slide-text" style="position:relative;display:flex;flex-direction:column;justify-content:${e.valign === "middle" ? "center" : e.valign === "bottom" ? "flex-end" : "flex-start"};width:100%;height:100%;padding:${e.type === "shape" ? "8px 12px" : "4px 6px"};box-sizing:border-box;font-family:'${e.font || t.body}',Arial;font-size:${e.size || 24}px;color:${e.color || t.text};text-align:${e.align || "left"};line-height:1.2">${e.html}</div>` : "";
    return `<div style="${box}">${svg}${txt}</div>`;
  }).join("");
  return `<div class="s"><div style="width:${CW}px;height:${CH}px;position:relative;background:${bg};font-family:'${t.body}',Arial">${els}</div></div>`;
}

