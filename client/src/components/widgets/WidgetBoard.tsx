// The Widgets board on Home, in WorkHub and LifeHub: the widgets someone added, a gallery to add
// more (each shown live), and settings for each one (theme, size and its own options).
// What a widget looks like is in WidgetFace.tsx; the catalog, themes and saved shape are in
// shared/widgets.ts. Every change is cleaned and handed to the hub, which saves it like anything else.
//
// In Edit mode, a widget can also be dragged by its body to reorder it, and dragged by its corner
// handle to resize it (small → wide → large), with no library: plain pointer events, since the
// board is a fixed-row CSS grid and a drag only ever needs to land on another widget's cell.
import { useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { HubModal } from "@/components/teacher-hub/HubModal";
import {
  MAX_WIDGETS, WIDGET_CITIES, WIDGET_DEFS, WIDGET_GROUPS, WIDGET_SIZES, WIDGET_THEMES, cleanWidgets, dayKey, newWidget, themeOf, widgetDef,
  type WidgetGroup, type WidgetItem, type WidgetSize,
} from "@shared/widgets";
import { WIDGET_CSS, WidgetFace, fontOf, useNow } from "./WidgetFace";

const SPAN: Record<WidgetSize, string> = { small: "col-span-1 row-span-1", wide: "col-span-2 row-span-1", large: "col-span-2 row-span-2" };
/** One grid row: small widgets are about square on a phone. */
export const ROW = "clamp(8.5rem, 22vw, 10.5rem)";
/** Sizes in order, for the resize handle to step through. */
const SIZE_ORDER: WidgetSize[] = ["small", "wide", "large"];
/** How many pixels of drag it takes to step the resize handle to the next size. */
const RESIZE_STEP_PX = 56;
const GROUP_NOTE: Record<WidgetGroup, string> = {
  Clocks: "Ten ways to tell the time, from classic to binary.",
  Calendars: "Today, this week, this month and the whole year.",
  Countdowns: "What's coming, what's done, and how far through the day you are.",
  Fun: "Little things to tap and smile at.",
  Focus: "Timers, notes and the one thing that matters today.",
};

/** A widget's outside: its theme's background, text colour, border and typeface. */
export function Shell({ item, children, className = "", style, onPointerDown }: { item: WidgetItem; children: React.ReactNode; className?: string; style?: CSSProperties; onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void }) {
  const t = themeOf(item.theme);
  return (
    <div className={`relative h-full overflow-hidden rounded-[1.6rem] p-4 ${className}`} onPointerDown={onPointerDown}
      style={{ background: t.bg, color: t.fg, fontFamily: fontOf(t), border: t.border === "transparent" ? "none" : `${t.id === "bold" ? 3 : 1}px solid ${t.border}`, boxShadow: t.id === "bold" ? "4px 4px 0 #000" : "0 1px 2px rgba(15,23,42,.06)", ...style }}>
      {children}
    </div>
  );
}

// ── Drag to reorder ──────────────────────────────────────────────────────────

/**
 * Drag a widget by its body (in Edit mode) to reorder it. Pointer events only, so it works with
 * mouse, touch and pen alike. While dragging, the pointer's position is checked against every
 * other widget's cell on each move; crossing into one swaps that widget to the dragged widget's
 * old spot, the way most phone home-screen reordering works.
 */
function useWidgetDrag(items: WidgetItem[], onReorder: (next: WidgetItem[]) => void) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const orderRef = useRef(items);
  orderRef.current = items;

  const start = (e: ReactPointerEvent<HTMLDivElement>, id: string) => {
    // Only the widget's own surface starts a drag; its ✎ and resize buttons handle their own clicks.
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const pointerId = e.pointerId;
    setDraggingId(id);
    const board = boardRef.current;

    const cellAt = (x: number, y: number): string | null => {
      if (!board) return null;
      for (const el of board.querySelectorAll<HTMLElement>("[data-widget-cell]")) {
        const r = el.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return el.dataset.widgetCell ?? null;
      }
      return null;
    };

    const onMove = (ev: PointerEvent) => {
      const overCell = cellAt(ev.clientX, ev.clientY);
      setOverId(overCell && overCell !== id ? overCell : null);
    };
    const finish = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      const dropCell = cellAt(ev.clientX, ev.clientY);
      setDraggingId(null);
      setOverId(null);
      if (dropCell && dropCell !== id) {
        const cur = orderRef.current;
        const from = cur.findIndex((w) => w.id === id), to = cur.findIndex((w) => w.id === dropCell);
        if (from >= 0 && to >= 0 && from !== to) {
          const next = [...cur];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          onReorder(next);
        }
      }
      try { (ev.target as Element)?.releasePointerCapture?.(pointerId); } catch { /* already released */ }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  return { boardRef, draggingId, overId, start };
}

// ── Drag to resize ───────────────────────────────────────────────────────────

/**
 * Drag a widget's corner handle (in Edit mode) to resize it. Every RESIZE_STEP_PX of outward drag
 * steps to the next size (small → wide → large); dragging back inward steps down again. The face
 * previews the new size live as you drag, and the size is only saved on release.
 */
function useWidgetResize(onResize: (id: string, size: WidgetSize) => void) {
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState<WidgetSize | null>(null);

  const start = (e: ReactPointerEvent<HTMLButtonElement>, id: string, startSize: WidgetSize) => {
    e.preventDefault();
    e.stopPropagation();
    const pointerId = e.pointerId;
    const startX = e.clientX, startY = e.clientY;
    const startIndex = SIZE_ORDER.indexOf(startSize);
    setResizingId(id);
    setPreviewSize(startSize);
    let current = startSize;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      const dist = Math.max(dx, dy); // corner drag: either axis growing counts as "bigger"
      const steps = Math.round(dist / RESIZE_STEP_PX);
      const nextIndex = Math.min(SIZE_ORDER.length - 1, Math.max(0, startIndex + steps));
      current = SIZE_ORDER[nextIndex];
      setPreviewSize(current);
    };
    const finish = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      if (current !== startSize) onResize(id, current);
      setResizingId(null);
      setPreviewSize(null);
      try { (ev.target as Element)?.releasePointerCapture?.(pointerId); } catch { /* already released */ }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  return { resizingId, previewSize, start };
}

export default function WidgetBoard({ items: raw, setItems, makeId, accent = "bg-slate-950" }: {
  items: unknown;
  setItems: (update: (items: WidgetItem[]) => WidgetItem[]) => void;
  makeId: () => string;
  /** The hub's main button colour (a Tailwind background class). */
  accent?: string;
}) {
  const items = useMemo(() => cleanWidgets(raw), [raw]);
  const now = useNow(1000);
  const [gallery, setGallery] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  /** Edit mode shows each widget's ✎ button and its drag handles. With a mouse it also shows on hover. */
  const [arranging, setArranging] = useState(false);
  const save = (update: (items: WidgetItem[]) => WidgetItem[]) => setItems((cur) => cleanWidgets(update(cleanWidgets(cur))));
  const patch = (id: string, p: Partial<WidgetItem>) => save((all) => all.map((w) => (w.id === id ? { ...w, ...p } : w)));
  const reorder = useWidgetDrag(items, (next) => save(() => next));
  const resize = useWidgetResize((id, size) => patch(id, { size }));
  const add = (type: string) => {
    const w = newWidget(type, makeId(), dayKey(new Date()));
    if (!w) return;
    save((all) => [...all, w]);
    setGallery(false);
    // Widgets that need a choice (a date, a city, bell times, a note) open their settings straight away.
    if (widgetDef(type)?.options.length) setEditing(w.id);
  };
  const editingItem = items.find((w) => w.id === editing);
  const full = items.length >= MAX_WIDGETS;

  return (
    <section aria-label="Widgets" data-testid="widget-board">
      <style>{WIDGET_CSS}</style>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Widgets</h2>
        <div className="flex items-center gap-2">
        {items.length > 0 && <button type="button" onClick={() => setArranging((a) => !a)} aria-pressed={arranging} className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition active:scale-95 ${arranging ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`} data-testid="widget-arrange">{arranging ? "Done" : "Edit"}</button>}
        <button type="button" onClick={() => setGallery(true)} disabled={full} className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50 ${accent}`} data-testid="widget-add">
          <span aria-hidden className="text-lg leading-none">+</span> Add widget
        </button>
        </div>
      </div>

      {items.length ? (
        <div ref={reorder.boardRef} className="grid grid-cols-2 gap-3 sm:grid-cols-4" style={{ gridAutoRows: ROW, gridAutoFlow: "dense" }} data-testid="widget-grid">
          {items.map((w) => {
            const isDragging = reorder.draggingId === w.id;
            const isDropTarget = reorder.overId === w.id && reorder.draggingId !== w.id;
            const isResizing = resize.resizingId === w.id;
            const liveSize = isResizing ? resize.previewSize ?? w.size : w.size;
            return (
              <div key={w.id} data-widget-cell={w.id} className={`${SPAN[liveSize]} min-w-0 ${isDragging ? "z-20 scale-95 opacity-80" : ""} ${isDropTarget ? "scale-[1.02]" : ""} ${isResizing ? "z-20" : "transition-transform"}`} data-widget={w.type}>
                <Shell item={w} className={`group relative ${arranging ? "outline outline-2 outline-offset-2 outline-slate-400" : ""} ${isDropTarget ? "ring-2 ring-offset-2 ring-slate-900" : ""}`}
                  onPointerDown={arranging ? (e) => reorder.start(e, w.id) : undefined}
                  style={{ touchAction: arranging ? "none" : undefined, cursor: arranging ? "grab" : undefined }}>
                  <WidgetFace item={w} theme={themeOf(w.theme)} now={now} size={liveSize} onChange={(p) => patch(w.id, p)} />
                  <button type="button" onClick={() => setEditing(w.id)} aria-label={`Change ${widgetDef(w.type)?.name ?? "widget"}`}
                    className={`absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-base font-bold shadow-md transition focus-visible:opacity-100 active:scale-90 ${arranging ? "opacity-100" : "pointer-events-none opacity-0 focus-visible:pointer-events-auto [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:opacity-100"}`}
                    style={{ background: "#ffffff", color: "#0f172a" }} data-testid={`widget-edit-${w.type}`}>✎</button>
                  {arranging && (
                    <button type="button" aria-label={`Resize ${widgetDef(w.type)?.name ?? "widget"}`} data-testid={`widget-resize-${w.type}`}
                      onPointerDown={(e) => resize.start(e, w.id, w.size)}
                      className="absolute bottom-2 right-2 inline-flex h-9 w-9 touch-none items-center justify-center rounded-full text-sm font-bold shadow-md active:scale-90"
                      style={{ background: "#ffffff", color: "#0f172a", cursor: "nwse-resize" }}>
                      <svg aria-hidden width="14" height="14" viewBox="0 0 14 14"><path d="M12 2 2 12M12 7 7 12M12 12h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                    </button>
                  )}
                </Shell>
              </div>
            );
          })}
        </div>
      ) : (
        <button type="button" onClick={() => setGallery(true)} className="flex w-full flex-col items-center gap-2 rounded-[1.6rem] border-2 border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center transition hover:bg-white" data-testid="widget-empty">
          <span className="text-3xl" aria-hidden>🕰️</span>
          <span className="text-base font-bold text-slate-900">Add your first widget</span>
          <span className="max-w-sm text-sm text-slate-600">Clocks, calendars, countdowns, fun ones and timers, in eleven themes.</span>
        </button>
      )}

      {gallery && <Gallery now={now} onAdd={add} onClose={() => setGallery(false)} accent={accent} />}
      {editingItem && (
        <Settings item={editingItem} now={now} onChange={(p) => patch(editingItem.id, p)} accent={accent}
          onRemove={() => { save((all) => all.filter((w) => w.id !== editingItem.id)); setEditing(null); }}
          onMove={(by) => save((all) => { const i = all.findIndex((w) => w.id === editingItem.id), j = i + by; if (i < 0 || j < 0 || j >= all.length) return all; const next = [...all]; [next[i], next[j]] = [next[j], next[i]]; return next; })}
          onClose={() => setEditing(null)} />
      )}
    </section>
  );
}

// ── One widget at a time, for Home ──────────────────────────────────────────

/**
 * Everything Home needs to show each widget as its own part: the cleaned list, the live clock, and
 * add / change / remove / reorder, plus the Add-a-widget gallery and a widget's settings as pop-ups
 * (render `modals` once). The Widgets board below uses the same saving rules.
 */
export function useWidgetKit(raw: unknown, setItems: (update: (items: WidgetItem[]) => WidgetItem[]) => void, makeId: () => string, accent = "bg-slate-950") {
  const items = useMemo(() => cleanWidgets(raw), [raw]);
  const now = useNow(1000);
  const [gallery, setGallery] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const save = (update: (items: WidgetItem[]) => WidgetItem[]) => setItems((cur) => cleanWidgets(update(cleanWidgets(cur))));
  const patch = (id: string, p: Partial<WidgetItem>) => save((all) => all.map((w) => (w.id === id ? { ...w, ...p } : w)));
  const remove = (id: string) => { save((all) => all.filter((w) => w.id !== id)); if (editing === id) setEditing(null); };
  const reorder = (ids: string[]) => save((all) => [...ids.map((id) => all.find((w) => w.id === id)).filter((w): w is WidgetItem => !!w), ...all.filter((w) => !ids.includes(w.id))]);
  const add = (type: string) => {
    const w = newWidget(type, makeId(), dayKey(new Date()));
    if (!w) return;
    save((all) => [...all, w]);
    setGallery(false);
    if (widgetDef(type)?.options.length) setEditing(w.id);
  };
  const editingItem = items.find((w) => w.id === editing);
  const nameOf = (id: string) => { const w = items.find((x) => x.id === id); return (w && (w.label?.trim() || widgetDef(w.type)?.name)) || "Widget"; };
  const modals: ReactNode = <>
    <style>{WIDGET_CSS}</style>
    {gallery && <Gallery now={now} onAdd={add} onClose={() => setGallery(false)} accent={accent} />}
    {editingItem && <Settings item={editingItem} now={now} onChange={(p) => patch(editingItem.id, p)} accent={accent}
      onRemove={() => remove(editingItem.id)}
      onMove={(by) => save((all) => { const i = all.findIndex((w) => w.id === editingItem.id), j = i + by; if (i < 0 || j < 0 || j >= all.length) return all; const next = [...all]; [next[i], next[j]] = [next[j], next[i]]; return next; })}
      onClose={() => setEditing(null)} />}
  </>;
  return { items, now, full: items.length >= MAX_WIDGETS, add, patch, remove, reorder, openGallery: () => setGallery(true), openSettings: setEditing, nameOf, modals };
}

/** One widget's face in its themed shell, filling whatever box it is put in. */
export function WidgetCell({ item, now, onChange }: { item: WidgetItem; now: Date; onChange?: (p: Partial<WidgetItem>) => void }) {
  return <Shell item={item}><WidgetFace item={item} theme={themeOf(item.theme)} now={now} size={item.size} onChange={onChange ?? (() => {})} /></Shell>;
}

// ── Gallery ──────────────────────────────────────────────────────────────────

function Gallery({ now, onAdd, onClose, accent }: { now: Date; onAdd: (type: string) => void; onClose: () => void; accent: string }) {
  const [group, setGroup] = useState<WidgetGroup>("Clocks");
  const [mood, setMood] = useState<"all" | "fun" | "serious">("all");
  const list = WIDGET_DEFS.filter((d) => d.group === group && (mood === "all" || d.mood === mood || d.mood === "both"));
  return (
    <HubModal title="Add a widget" size="lg" onClose={onClose}>
      <div className="space-y-4" data-testid="widget-gallery">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Kinds of widget">
          {WIDGET_GROUPS.map((g) => (
            <button key={g} type="button" role="tab" aria-selected={g === group} onClick={() => setGroup(g)}
              className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition ${g === group ? `${accent} text-white` : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{g}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">{GROUP_NOTE[group]}</p>
          <div className="flex rounded-full bg-slate-100 p-0.5 text-xs font-semibold" role="radiogroup" aria-label="Show">
            {(["all", "fun", "serious"] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={mood === m} onClick={() => setMood(m)} className={`min-h-8 rounded-full px-3 ${mood === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>{m === "all" ? "All" : m === "fun" ? "Fun" : "Serious"}</button>)}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((d) => {
            const sample = newWidget(d.id, `preview-${d.id}`, dayKey(now))!;
            return (
              <div key={d.id} className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-3">
                <div className={`pointer-events-none ${d.size === "small" ? "mx-auto aspect-square w-40" : "h-40"}`} aria-hidden>
                  <Shell item={sample}><WidgetFace item={sample} theme={themeOf(sample.theme)} now={now} size={d.size === "large" ? "wide" : d.size} /></Shell>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="font-bold text-slate-900">{d.name}</p><p className="text-sm text-slate-600">{d.blurb}</p></div>
                  <button type="button" onClick={() => onAdd(d.id)} className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold text-white transition active:scale-95 ${accent}`} data-testid={`widget-pick-${d.id}`}>Add</button>
                </div>
              </div>
            );
          })}
          {!list.length && <p className="text-sm text-slate-500">No {mood} widgets here. Try All.</p>}
        </div>
      </div>
    </HubModal>
  );
}

// ── Settings for one widget ──────────────────────────────────────────────────

const field = "mt-1 block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 sm:text-sm";

function Settings({ item, now, onChange, onRemove, onMove, onClose, accent }: {
  item: WidgetItem; now: Date; onChange: (p: Partial<WidgetItem>) => void; onRemove: () => void; onMove: (by: -1 | 1) => void; onClose: () => void; accent: string;
}) {
  const def = widgetDef(item.type)!;
  const has = (o: (typeof def.options)[number]) => def.options.includes(o);
  const tzs = item.tzs?.length ? item.tzs : ["America/New_York", "Europe/London", "Asia/Tokyo"];
  const citySelect = (value: string, set: (tz: string) => void, label: string) => (
    <label className="block text-sm font-semibold text-slate-700">{label}
      <select value={value} onChange={(e) => set(e.target.value)} className={field}>{WIDGET_CITIES.map((c) => <option key={c.tz} value={c.tz}>{c.city}</option>)}</select>
    </label>
  );
  return (
    <HubModal title={def.name} size="md" onClose={onClose}
      footer={<div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onRemove} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-red-700 hover:bg-red-50" data-testid="widget-remove">Remove widget</button>
        <button type="button" onClick={onClose} className={`min-h-11 rounded-xl px-5 text-sm font-semibold text-white ${accent}`}>Done</button>
      </div>}>
      <div className="space-y-5" data-testid="widget-settings">
        <div className={`pointer-events-none mx-auto ${item.size === "small" ? "aspect-square w-44" : item.size === "wide" ? "h-40 w-full" : "aspect-square w-full max-w-sm"}`} aria-hidden>
          <Shell item={item}><WidgetFace item={item} theme={themeOf(item.theme)} now={now} size={item.size} /></Shell>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-700">Theme</legend>
          <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {WIDGET_THEMES.map((t) => (
              <button key={t.id} type="button" onClick={() => onChange({ theme: t.id })} aria-pressed={item.theme === t.id}
                className={`flex flex-col items-center gap-1 rounded-2xl p-1.5 text-[11px] font-semibold text-slate-700 transition ${item.theme === t.id ? "ring-2 ring-slate-900" : "hover:bg-slate-50"}`} data-testid={`widget-theme-${t.id}`}>
                <span className="flex h-10 w-full items-center justify-center rounded-xl text-sm font-black" style={{ background: t.bg, color: t.fg, fontFamily: fontOf(t), border: t.border === "transparent" ? "none" : `1px solid ${t.border}`, textShadow: t.glow ? `0 0 6px ${t.fg}` : undefined }}>Aa</span>
                {t.name}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-700">Size</legend>
          <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Size">
            {WIDGET_SIZES.map((s) => <button key={s.id} type="button" role="radio" aria-checked={item.size === s.id} onClick={() => onChange({ size: s.id })}
              className={`min-h-11 flex-1 rounded-xl text-sm font-semibold transition ${item.size === s.id ? `${accent} text-white` : "bg-slate-100 text-slate-700"}`} data-testid={`widget-size-${s.id}`}>{s.label}</button>)}
          </div>
        </fieldset>

        {has("label") && <label className="block text-sm font-semibold text-slate-700">{item.type === "workday" ? "Name" : "What it's for"}<input value={item.label ?? ""} maxLength={60} onChange={(e) => onChange({ label: e.target.value })} className={field} placeholder={item.type === "since" ? "Last day off" : item.type === "workday" ? "School day" : "Summer break"} /></label>}
        {has("date") && <label className="block text-sm font-semibold text-slate-700">{item.type === "since" ? "Since" : "Date"}<input type="date" value={item.date ?? ""} onChange={(e) => onChange({ date: e.target.value || undefined })} className={field} /></label>}
        {has("tz") && citySelect(item.tz ?? "Europe/London", (tz) => onChange({ tz }), "City")}
        {has("tz3") && <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i}>{citySelect(tzs[i], (tz) => onChange({ tzs: tzs.map((x, j) => (j === i ? tz : x)) }), `City ${i + 1}`)}</div>)}</div>}
        {has("workday") && <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-slate-700">Starts<input type="time" value={item.start ?? "08:00"} onChange={(e) => onChange({ start: e.target.value })} className={field} /></label>
          <label className="block text-sm font-semibold text-slate-700">Ends<input type="time" value={item.end ?? "15:00"} onChange={(e) => onChange({ end: e.target.value })} className={field} /></label>
        </div>}
        {has("bells") && <label className="block text-sm font-semibold text-slate-700">Bell times
          <textarea value={item.bells ?? ""} maxLength={400} rows={3} onChange={(e) => onChange({ bells: e.target.value })} className={field + " py-2.5"} placeholder="8:00, 8:50, 9:40, 1:05" />
          <span className="mt-1 block text-xs font-normal text-slate-500">Separate times with commas or spaces. A time from 1:00 to 6:59 without am or pm counts as afternoon.</span></label>}
        {has("text") && <label className="block text-sm font-semibold text-slate-700">{item.type === "one-thing" ? "Today's one thing" : "Note"}
          <textarea value={item.text ?? ""} maxLength={280} rows={3} onChange={(e) => onChange({ text: e.target.value, ...(item.type === "one-thing" ? { doneOn: undefined } : {}) })} className={field + " py-2.5"} placeholder={item.type === "one-thing" ? "Finish the report card comments" : "Bring the permission slips"} /></label>}
        {has("minutes") && <label className="block text-sm font-semibold text-slate-700">Minutes<input type="number" inputMode="numeric" min={1} max={600} value={item.minutes ?? 5} onChange={(e) => onChange({ minutes: Number(e.target.value) || 1 })} className={field} /></label>}
        {has("dice") && <fieldset><legend className="text-sm font-semibold text-slate-700">How many dice</legend><div className="mt-2 flex gap-2">{[1, 2].map((n) => <button key={n} type="button" aria-pressed={(item.dice ?? 1) === n} onClick={() => onChange({ dice: n })} className={`min-h-11 flex-1 rounded-xl text-sm font-semibold ${(item.dice ?? 1) === n ? `${accent} text-white` : "bg-slate-100 text-slate-700"}`}>{n === 1 ? "One" : "Two"}</button>)}</div></fieldset>}

        <div className="flex gap-2">
          <button type="button" onClick={() => onMove(-1)} className="min-h-11 flex-1 rounded-xl bg-slate-100 text-sm font-semibold text-slate-700">Move earlier</button>
          <button type="button" onClick={() => onMove(1)} className="min-h-11 flex-1 rounded-xl bg-slate-100 text-sm font-semibold text-slate-700">Move later</button>
        </div>
      </div>
    </HubModal>
  );
}
