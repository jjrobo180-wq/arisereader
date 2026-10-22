// Arise WorkHub: Home, arranged on the screen itself, the way iPhone apps are.
// Tap "Edit Home" (or press and hold an empty spot of Home) and the parts wiggle. Then:
// - hold a part for a moment and drag it: it follows your finger and the others glide out of its way
//   (a quick swipe still scrolls the page);
// - tap ✕ to take a part off Home, or S, M, L to resize it;
// - add parts and plugins back from the tray. Done (or Escape) finishes.
// The gliding is framer-motion's layout animation. The order, sizes and what is hidden are kept in the workspace
// layout (shared/hubLayout.ts), the same one Customize sets.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { AlarmClock, Bell, CalendarDays, Check, CheckSquare, Image as ImageIcon, LayoutGrid, ListChecks, Pencil, Plus, Puzzle, School, Sun, Users, WandSparkles, X, type LucideIcon } from "lucide-react";
import { HubModal } from "./HubModal";
import { HOME_SECTIONS, HOME_SIZES, homeShown, isWidgetHomeId, resizeSection, sizeOf, widgetHomeId, widgetIdOf, type AnyLayout, type HomeSection, type HomeSize } from "@shared/hubLayout";
import type { WidgetItem, WidgetSize } from "@shared/widgets";
import { startSize } from "@shared/startScreen";
import { arrangeLive, type LiveFace } from "@shared/liveTiles";
import { ROW as WIDGET_ROW, WidgetCell, useWidgetKit } from "@/components/widgets/WidgetBoard";
import type { Plugin } from "@shared/pluginStore";
import { ICONS } from "@/components/plugin-store/PluginStore";

/** Holding this long on Home starts editing; holding this long on a part while editing picks it up. */
const HOLD_EDIT_MS = 600;
const HOLD_DRAG_MS = 220;

/** A press on something you can use (a button, a link, a box to type in) is never a hold. */
const isControl = (el: EventTarget | null) => el instanceof HTMLElement && !!el.closest("a, button, input, textarea, select, label, [role='button'], [role='radio'], [contenteditable='true']");
/** Where a part sits in the grid, and how tall it may be. Small is half width from tablet size up. */
// The grid has 3 columns on a phone and more on wider screens. Small is one square, like an app icon but bigger.
// Columns are doubled (6 on a phone) so a small widget can take half the width while small parts stay a third.
const GRID = "grid grid-cols-6 gap-3 sm:grid-cols-8 sm:gap-5 md:grid-cols-10 xl:grid-cols-12";
const SPAN: Record<HomeSize, string> = { small: "col-span-2", medium: "col-span-full", large: "col-span-full" };
/** The picture on each part's small tile. */
const PART_ICON: Record<HomeSection, LucideIcon> = { day: Sun, widgets: AlarmClock, stats: LayoutGrid, picture: ImageIcon, agenda: ListChecks, add: WandSparkles, calendar: CalendarDays, meetings: Users, todo: CheckSquare, notifications: Bell, profile: School };
/** One part of a hub's Home: its name and the picture on its small tile. */
export type HomePart = { id: string; label: string; icon?: LucideIcon };
/** WorkHub's parts of Home. */
export const WORK_PARTS: HomePart[] = HOME_SECTIONS.map((s) => ({ id: s.id, label: s.label, icon: PART_ICON[s.id] }));
const CAP: Record<HomeSize, string> = { small: "max-h-[26rem] overflow-y-auto overscroll-contain rounded-3xl", medium: "max-h-[22rem] overflow-y-auto overscroll-contain rounded-3xl", large: "" };
/** How tall a part's picture is while arranging. */
// Edit mode shows each part at its real size, so every widget in it stays visible while you arrange.
const PREVIEW: Record<HomeSize, string> = { small: "aspect-square", medium: "h-36", large: "h-52" };
/** A widget on Home: its width by its own size, and a fixed height like on the Widgets board. */
const W_SPAN: Record<WidgetSize, string> = { small: "col-span-3 sm:col-span-4 md:col-span-5 xl:col-span-4", wide: "col-span-full md:col-span-10 xl:col-span-8", large: "col-span-full md:col-span-10 xl:col-span-8" };
const W_HEIGHT: Record<WidgetSize, string> = { small: WIDGET_ROW, wide: WIDGET_ROW, large: `calc(2 * ${WIDGET_ROW} + 0.75rem)` };
const W_TO_HOME: Record<WidgetSize, HomeSize> = { small: "small", wide: "medium", large: "large" };
const HOME_TO_W: Record<HomeSize, WidgetSize> = { small: "small", medium: "wide", large: "large" };
/** The widgets a hub keeps on Home, so each one can be its own part (see shared/hubLayout's widgetHomeId). */
export type HomeWidgets = { items: unknown; setItems: (update: (items: WidgetItem[]) => WidgetItem[]) => void; makeId: () => string };
const GLIDE = { type: "spring", stiffness: 520, damping: 42, mass: 0.8 } as const;

/** Which Home layout a theme uses (see shared/appThemes.ts's HomeLayout). Only the presentation
 *  constants below vary per layout — drag, reorder, resize and hide (everything above) stay the
 *  same code path regardless of layout, so a new structural theme is a new entry here, never a
 *  change to the editing logic.
 *    cards    - today's layout: a wide responsive grid, soft rounded cards. Classic's.
 *    tiles    - Windows-Phone-style: uniform flat-color square tiles, name bottom-left. Tile's.
 *    terminal - CRT-style: a single column of bracketed "[ LABEL ]" text rows. Old Computer's. */
export type HubHomeLayout = "cards" | "tiles" | "terminal";

const LAYOUT_GRID: Record<HubHomeLayout, string> = {
  cards: GRID,
  tiles: "hub-start-grid",
  terminal: "grid grid-cols-1 gap-3",
};
/** "tiles" is the Windows Phone start screen: four columns of square cells; small is 1×1, medium
 *  2×2, large the full-width 4×2 "wide" tile (see shared/startScreen.ts). "terminal" is always one column, full width, regardless of size — it reads
 *  top to bottom, not across columns. */
const LAYOUT_SPAN: Record<HubHomeLayout, Record<HomeSize, string>> = {
  cards: SPAN,
  tiles: { small: "col-span-1 row-span-1", medium: "col-span-2 row-span-2", large: "col-span-4 row-span-2" },
  terminal: { small: "col-span-1", medium: "col-span-1", large: "col-span-1" },
};
const LAYOUT_CAP: Record<HubHomeLayout, Record<HomeSize, string>> = {
  cards: CAP,
  tiles: { small: "max-h-[26rem] overflow-y-auto overscroll-contain", medium: "max-h-[22rem] overflow-y-auto overscroll-contain", large: "max-h-[26rem] overflow-y-auto overscroll-contain" },
  terminal: { small: "max-h-[20rem] overflow-y-auto overscroll-contain", medium: "max-h-[20rem] overflow-y-auto overscroll-contain", large: "" },
};
/** Layouts where every part renders as a tap-to-open tile, not just "small"-sized parts (see
 *  alwaysTile below) — the dense, uniform-grid layouts. */
const TILE_LAYOUTS: readonly HubHomeLayout[] = ["tiles"];

/** The start screen: a square-celled grid whose row height comes from the width of its own box
 *  (container units), so a small tile is always square, a medium is exactly two by two cells and a
 *  wide one is four by two — on any screen, with no gaps. It never grows wider than a big phone. */
const START_CSS = ".hub-start{container-type:inline-size;width:100%;max-width:40rem;margin-inline:auto}"
  + ".hub-start-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;grid-auto-flow:dense;grid-auto-rows:calc((100cqw - 15px) / 4)}"
  + ".hub-start-grid>*{min-width:0;min-height:0}"
  // A live tile's fact slides up into place when it changes (and just appears for people who asked for less motion).
  + ".tile-in{animation:tile-in .55s cubic-bezier(.2,.8,.2,1) both}@keyframes tile-in{from{opacity:0;transform:translateY(35%)}to{opacity:1;transform:none}}"
  + "@media (prefers-reduced-motion:reduce){.tile-in{animation:none}}";

/** A tile that is not one of the parts of Home: the app shortcuts (and a call to action) that fill the start screen. */
export type StartTile = {
  id: string; label: string; icon: ReactNode; color?: string; sub?: string; size?: HomeSize; badge?: number; onClick: () => void;
  /** A live tile: short facts it flips between (see shared/liveTiles.ts), pictures it fades between, or a face of its own that fills it (a clock, the weather). */
  faces?: LiveFace[]; photos?: string[]; body?: (size: HomeSize) => ReactNode;
};
const isLive = (t: StartTile) => !!(t.faces?.length || t.photos?.length || t.body);

/** Tile's real live-tile palette: the Windows-Phone/Windows-8 set of flat, saturated tile
 *  colors. Each part gets one of these — picked deterministically from its id, so a given part
 *  always lands on the same color (reorder-stable, no randomness) — instead of every tile on
 *  Home sharing one repeated accent color. */
const TILE_PALETTE = ["#00a2e8", "#f2600c", "#8cbf26", "#e671b8", "#1ba1e2", "#a200ff", "#e51400", "#339933", "#fa6800", "#647687", "#00aba9", "#60a917"];
const tileHash = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return h; };
/** The live-tile color for one part. Stable per part id, independent of the single `accent`
 *  prop (which still colors "cards" mode's app-icon squares). */
export const tileColorOf = (id: string) => TILE_PALETTE[tileHash(id) % TILE_PALETTE.length];

export type QuickPlugin = { plugin: Plugin; onAdd: () => void };

type Drag = {
  id: string;
  /** Where the finger took hold, inside the part. */
  grabX: number; grabY: number;
  /** The finger now, on the screen. */
  x: number; y: number;
  /** The part just swapped with: it is not swapped back until the finger leaves it, so parts never flip back and forth. */
  last: string | null;
};

export function HomeParts<L extends AnyLayout>({ parts, layout, onChange, plugins = [], onOpenStore, catalog = WORK_PARTS, accent = "bg-slate-950", homeLayout = "cards", leadTiles, appTiles, widgets }: {
  /** Each part's content. null is a part with nothing to show right now: it is left out of Home, and shown as its tile while editing. */
  parts: Record<string, ReactNode | null>; layout: L; onChange: (next: L) => void;
  /** The hub's parts of Home, for their names and tile pictures. */
  catalog?: HomePart[];
  /** The colour of the small tiles' picture square (a Tailwind background class). */
  accent?: string;
  /** Plugins not added yet, to add with one tap from the tray. */
  plugins?: QuickPlugin[];
  onOpenStore?: () => void;
  /** The current theme's Home structure (see shared/appThemes.ts). Changes the grid shape and
   *  tile rendering only — every drag/reorder/resize/hide behavior below is identical regardless. */
  homeLayout?: HubHomeLayout;
  /** "tiles" only: tiles before the parts (a call to action) and after them (every app of the hub), so the start screen holds everything and needs no menu beside it. */
  leadTiles?: StartTile[]; appTiles?: StartTile[];
  /** The hub's widgets. Given, each widget is its own part of Home — moved, resized and removed on its own —
   *  instead of the whole Widgets board being one part. */
  widgets?: HomeWidgets;
}) {
  const kit = useWidgetKit(widgets?.items ?? [], widgets?.setItems ?? (() => {}), widgets?.makeId ?? (() => String(Date.now())), accent);
  /** Widgets show on Home when the hub has them on (its Widgets part has something) and they aren't hidden. */
  const widgetsOn = !!widgets && parts.widgets != null;
  const widgetOf = (id: string) => (isWidgetHomeId(id) ? kit.items.find((w) => w.id === widgetIdOf(id)) : undefined);
  /** The Home order with the Widgets part opened up into one part per widget. A widget that has its own
   *  saved place goes there; a new one goes where the Widgets part is. With no widgets yet, the Widgets part
   *  stays, showing "Add your first widget". */
  const expand = (ids: readonly string[]): string[] => {
    if (!widgets) return [...ids];
    const placed = new Set(layout.home.filter(isWidgetHomeId));
    const out: string[] = [];
    for (const id of ids) {
      if (id === "widgets") {
        if (!widgetsOn) { out.push(id); continue; }
        const fresh = kit.items.filter((w) => !placed.has(widgetHomeId(w.id))).map((w) => widgetHomeId(w.id));
        out.push(...fresh);
        if (!kit.items.length) out.push(id);
      } else if (isWidgetHomeId(id)) { if (widgetsOn && widgetOf(id)) out.push(id); }
      else out.push(id);
    }
    return out;
  };
  /** A Home order (with widget parts) back to the saved layout: widgets keep their own places, the
   *  Widgets part sits right after the last widget (that's where a new one appears), and the rest of the
   *  saved order follows. Ids of widgets that were removed are dropped. */
  const collapse = (shown: string[]): string[] => {
    const live = new Set(kit.items.map((w) => widgetHomeId(w.id)));
    const out = shown.filter((id) => !isWidgetHomeId(id) || live.has(id));
    if (widgets && !out.includes("widgets")) {
      const lastW = out.map((id, i) => (isWidgetHomeId(id) ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
      if (lastW >= 0) out.splice(lastW + 1, 0, "widgets");
    }
    for (const id of layout.home) if (!out.includes(id) && (!isWidgetHomeId(id) || live.has(id))) out.push(id);
    return out;
  };
  const [editing, setEditing] = useState(false);
  /** A small tile tapped open: its whole part in a pop-up. */
  const [opened, setOpened] = useState<string | null>(null);
  const hidden = layout.homeHidden;
  const label = (id: string) => (isWidgetHomeId(id) ? kit.nameOf(widgetIdOf(id)) : catalog.find((p) => p.id === id)?.label ?? id);
  const gridClass = LAYOUT_GRID[homeLayout], spanOf = LAYOUT_SPAN[homeLayout], capOf = LAYOUT_CAP[homeLayout];
  const partOf = (id: string): HomePart => (isWidgetHomeId(id) ? { id, label: label(id), icon: AlarmClock } : catalog.find((p) => p.id === id) ?? { id, label: id });
  const tileOf = (id: string) => <PartTile part={partOf(id)} accent={accent} layout={homeLayout} size={sizeHere(id)} />;
  // "tiles" (Windows-Phone-style) always shows every part as a tile that opens in a pop-up, not
  // just the "small"-sized ones cards mode reserves tiles for — that dense tap-grid is the look.
  const alwaysTile = TILE_LAYOUTS.includes(homeLayout);
  /** The parts on Home in order, while editing. */
  const [order, setOrder] = useState<string[]>(() => expand(homeShown(layout)));
  const orderRef = useRef(order);
  orderRef.current = order;
  const [dragId, setDragId] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLDivElement>());
  const press = useRef<{ timer: number; x: number; y: number; id: string | null } | null>(null);
  const scrollLoop = useRef(0);

  const widgetKey = kit.items.map((w) => w.id).join(",") + (widgetsOn ? "+" : "-");
  useEffect(() => { if (!drag.current) setOrder(expand(homeShown(layout))); }, [layout.home.join(","), hidden.join(","), widgetKey]);
  useEffect(() => {
    if (!editing) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setEditing(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [editing]);

  /** The full order: the parts on Home as arranged, then the hidden ones. */
  const full = (shown: string[]) => collapse(shown);
  const isTiles = homeLayout === "tiles";
  const leads = isTiles ? leadTiles ?? [] : [], apps = isTiles ? appTiles ?? [] : [];
  /** A part's size: a widget's own size, the size the person chose, or — on the start screen — the next size in its pattern. */
  const sizeHere = (id: string): HomeSize => {
    const w = widgetOf(id); if (w) return W_TO_HOME[w.size];
    const own = layout.homeSize[id]; if (own) return own;
    if (!isTiles) return sizeOf(layout, id);
    return startSize(Math.max(0, (editing ? order : shownIds()).indexOf(id)));
  };
  /** Where a part sits in the grid. Widgets get their own widths in the usual (cards) layout. */
  const spanHere = (id: string) => { const w = widgetOf(id); return w && homeLayout === "cards" ? W_SPAN[w.size] : spanOf[sizeHere(id)]; };
  const widgetBox = (w: WidgetItem, live: boolean) => <div className="min-w-0" style={{ height: W_HEIGHT[w.size] }}><WidgetCell item={w} now={kit.now} onChange={live ? (p) => kit.patch(w.id, p) : undefined} /></div>;
  const emptyWidgets = <button type="button" onClick={kit.openGallery} className="flex w-full flex-col items-center gap-2 rounded-[1.6rem] border-2 border-dashed border-slate-300 bg-white/60 px-6 py-8 text-center transition hover:bg-white" data-testid="widget-empty">
    <span className="text-3xl" aria-hidden>🕰️</span><span className="text-base font-bold text-slate-900">Add your first widget</span>
    <span className="max-w-sm text-sm text-slate-600">Clocks, calendars, countdowns, fun ones and timers, in eleven themes.</span></button>;
  /** What a part shows on Home: a widget's face, the empty Widgets card, or the part itself. */
  const contentOf = (id: string, live = true): ReactNode => { const w = widgetOf(id); if (w) return widgetBox(w, live); if (widgets && id === "widgets") return widgetsOn ? emptyWidgets : null; return parts[id]; };
  /** The parts on Home in order (those with something to show). */
  let shownCache: string[] | null = null;
  const shownIds = () => (shownCache ??= expand(homeShown(layout) as string[]).filter((id) => contentOf(id) != null));
  const frame = (n: ReactNode) => (isTiles ? <div className="hub-start"><style>{START_CSS}</style>{n}</div> : n);
  const fill = isTiles ? " h-full" : "";
  const tileProps = (t: StartTile, size: HomeSize) => ({ label: t.label, icon: t.icon, color: t.color ?? tileColorOf(t.id), size, sub: t.sub, badge: t.badge, faces: t.faces, photos: t.photos, body: t.body });
  const tileBtn = (t: StartTile, size: HomeSize) => <div key={`t-${t.id}`} {...holdProps} className={`${spanOf[size]} h-full min-w-0`}>
    <button type="button" onClick={t.onClick} aria-label={t.label} className="block h-full w-full transition active:scale-95" data-testid={`home-tile-${t.id}`}><TileFace {...tileProps(t, size)} /></button></div>;
  /** While arranging, tapping an app tile leaves arranging and opens that app. */
  const tileEdit = (t: StartTile, size: HomeSize) => <div key={`e-${t.id}`} className={`${spanOf[size]} h-full min-w-0`}>
    <button type="button" onClick={() => { setEditing(false); t.onClick(); }} aria-label={`${t.label}: leave customize and open`} className="block h-full w-full transition active:scale-95" data-testid={`home-tile-${t.id}`}><TileFace {...tileProps(t, size)} /></button></div>;
  /** The app tiles: the ones with something to say are given the bigger squares. */
  const arranged = (start: number): StartTile[] => arrangeLive(apps.map((t) => ({ t, live: isLive(t) })), (i) => startSize(start + i)).map((x) => x.t);
  /** When the last drag ended, so the tap that ends a drag is not taken for a tap on the tile. */
  const lastDrag = useRef(0);

  // ─── While a part is held, the page does not scroll under the finger ───────
  // The listener is there the whole time Home is being edited, so it is ready the moment a part is picked up.
  useEffect(() => {
    if (!editing) return;
    const stop = (e: TouchEvent) => { if (drag.current) e.preventDefault(); };
    document.addEventListener("touchmove", stop, { passive: false });
    return () => document.removeEventListener("touchmove", stop);
  }, [editing]);

  /** Puts the held part under the finger, wherever its place in the grid is now. */
  function place() {
    const d = drag.current, el = d && els.current.get(d.id), box = grid.current?.getBoundingClientRect();
    if (!d || !el || !box) return;
    el.style.transform = `translate3d(${d.x - d.grabX - box.left - el.offsetLeft}px, ${d.y - d.grabY - box.top - el.offsetTop}px, 0) scale(1.04)`;
  }

  /** Moves the held part to the place of the part under the finger. Places are read from the layout, not the screen, so gliding parts don't confuse it. */
  function reorder() {
    const d = drag.current, box = grid.current?.getBoundingClientRect();
    if (!d || !box) return;
    const px = d.x - box.left, py = d.y - box.top;
    const inside = (id: string) => { const el = els.current.get(id); return !!el && px >= el.offsetLeft && px <= el.offsetLeft + el.offsetWidth && py >= el.offsetTop && py <= el.offsetTop + el.offsetHeight; };
    if (d.last && !inside(d.last)) d.last = null;
    const target = orderRef.current.find((id) => id !== d.id && id !== d.last && inside(id));
    if (!target) return;
    const now = orderRef.current, to = now.indexOf(target);
    const next = now.filter((x) => x !== d.id);
    next.splice(to, 0, d.id);
    d.last = target;
    orderRef.current = next;
    setOrder(next);
    requestAnimationFrame(place);
  }

  function pickUp(id: string, x: number, y: number) {
    const el = els.current.get(id);
    if (!el) return;
    const r = el.getBoundingClientRect();
    drag.current = { id, grabX: x - r.left, grabY: y - r.top, x, y, last: null };
    setDragId(id);
    try { navigator.vibrate?.(10); } catch { /* no buzz */ }
    place();
    // Near the top or bottom of the screen, the page scrolls along.
    const tick = () => {
      const d = drag.current;
      if (!d) return;
      const edge = 90, speed = d.y < edge ? -(edge - d.y) / 6 : d.y > window.innerHeight - edge ? (d.y - (window.innerHeight - edge)) / 6 : 0;
      if (speed) { window.scrollBy(0, speed); place(); reorder(); }
      scrollLoop.current = requestAnimationFrame(tick);
    };
    scrollLoop.current = requestAnimationFrame(tick);
  }

  function drop() {
    const d = drag.current;
    cancelAnimationFrame(scrollLoop.current);
    if (!d) return;
    drag.current = null;
    lastDrag.current = Date.now();
    const el = els.current.get(d.id);
    if (el) { el.style.transition = "transform 220ms cubic-bezier(.2,.8,.2,1)"; el.style.transform = ""; setTimeout(() => { el.style.transition = ""; }, 240); }
    setDragId(null);
    onChange({ ...layout, home: full(orderRef.current) } as L);
  }

  // ─── Pointer handling for a part while editing ─────────────────────────────
  const cancelPress = () => { if (press.current) { clearTimeout(press.current.timer); press.current = null; } };
  const partHandlers = (id: string) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isControl(e.target) || (e.pointerType === "mouse" && e.button !== 0)) return;
      cancelPress();
      const { clientX: x, clientY: y } = e;
      if (e.pointerType === "mouse") { press.current = { timer: 0, x, y, id }; return; }
      // On a touch screen a part is picked up after a short hold, so a quick swipe still scrolls.
      press.current = { x, y, id, timer: window.setTimeout(() => { if (press.current) { const p = press.current; press.current = null; pickUp(id, p.x, p.y); } }, HOLD_DRAG_MS) };
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (drag.current) return; // the window follows a held part (below)
      const p = press.current;
      if (!p) return;
      const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      // With a mouse, moving a few pixels with the button down picks the part up. With a finger, moving first means scrolling.
      if (e.pointerType === "mouse" && moved > 4) { press.current = null; e.currentTarget.setPointerCapture?.(e.pointerId); pickUp(id, p.x, p.y); }
      else if (e.pointerType !== "mouse" && moved > 8) cancelPress();
    },
    onPointerUp: () => { cancelPress(); drop(); },
    onPointerCancel: () => { cancelPress(); drop(); },
  });
  // Once a part is picked up, it follows the pointer anywhere on the screen until it is let go.
  useEffect(() => {
    if (!dragId) return;
    const move = (e: PointerEvent) => { const d = drag.current; if (!d) return; d.x = e.clientX; d.y = e.clientY; place(); reorder(); };
    const up = () => drop();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
  }, [dragId]);

  // ─── Press and hold an empty spot of Home to start editing ─────────────────
  const holdProps = {
    onPointerDown: (e: ReactPointerEvent) => {
      if (isControl(e.target) || (e.pointerType === "mouse" && e.button !== 0)) return;
      cancelPress();
      press.current = { x: e.clientX, y: e.clientY, id: null, timer: window.setTimeout(() => { press.current = null; setEditing(true); try { navigator.vibrate?.(12); } catch { /* no buzz */ } }, HOLD_EDIT_MS) };
    },
    onPointerMove: (e: ReactPointerEvent) => { const p = press.current; if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) cancelPress(); },
    onPointerUp: cancelPress, onPointerCancel: cancelPress, onPointerLeave: cancelPress,
  };

  const ref = (id: string) => (el: HTMLDivElement | null) => { if (el) els.current.set(id, el); else els.current.delete(id); };

  // ─── Not editing: Home as usual, each part at its size ─────────────────────
  if (!editing) {
    const shown = shownIds();
    return (
      <>
        {frame(<div className={gridClass} data-testid="home-grid">
          {leads.map((t) => tileBtn(t, t.size ?? "large"))}
          {shown.map((id) => (
            <div key={id} {...holdProps} className={`${spanHere(id)} min-w-0${fill}`} data-home-part={id}>
              {alwaysTile || (sizeHere(id) === "small" && !widgetOf(id))
                ? <button type="button" onClick={() => setOpened(id)} className={`w-full transition active:scale-95${fill}`} aria-label={`Open ${label(id)}`} data-testid={`home-tile-${id}`}>{tileOf(id)}</button>
                : widgetOf(id) ? contentOf(id) : <div className={capOf[sizeOf(layout, id)]}>{contentOf(id)}</div>}
            </div>
          ))}
          {arranged(shown.length).map((t, i) => tileBtn(t, t.size ?? startSize(shown.length + i)))}
          {!shown.length && !leads.length && !apps.length && <p className="col-span-full py-4 text-sm text-slate-500">Everything on Home is hidden.</p>}
        </div>)}
        <div className="flex flex-wrap justify-center gap-2">
          {widgetsOn && kit.items.length > 0 && <button type="button" onClick={kit.openGallery} disabled={kit.full} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-50" data-testid="widget-add"><Plus className="h-4 w-4" /> Widget</button>}
          <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95" data-testid="home-edit">Edit Home</button>
        </div>
        {opened && <HubModal title={label(opened)} size="lg" onClose={() => setOpened(null)}>{(() => { const w = widgetOf(opened); return w ? <div style={{ height: `calc(2 * ${WIDGET_ROW})` }}><WidgetCell item={w} now={kit.now} onChange={(p) => kit.patch(w.id, p)} /></div> : contentOf(opened); })()}</HubModal>}
        {widgets && kit.modals}
      </>
    );
  }

  // ─── Editing: the parts wiggle; hold one and drag it ───────────────────────
  const off = layout.home.filter((id) => hidden.includes(id));
  return (
    <div className={`space-y-5${isTiles ? " hub-start" : ""}`} data-testid="home-editing">
      {isTiles && <style>{START_CSS}</style>}
      <style>{`@keyframes hub-jiggle{0%{transform:rotate(-.4deg)}50%{transform:rotate(.4deg)}100%{transform:rotate(-.4deg)}}@media (prefers-reduced-motion:reduce){.hub-jiggle{animation:none!important}}`}</style>
      <div className="sticky top-[72px] z-30 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur">
        <p className="min-w-0 text-sm text-slate-600">{isTiles ? "Hold a tile and drag it · tap an app to open it" : "Hold a part and drag it"} · <X className="inline h-3.5 w-3.5" /> removes · S M L resizes</p>
        <span className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setEditing(false)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition active:scale-95" data-testid="home-edit-done"><Check className="h-4 w-4" /> Done</button>
          {isTiles && <button type="button" onClick={() => setEditing(false)} aria-label="Exit customize mode" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition active:scale-90" data-testid="home-edit-exit"><X className="h-5 w-5" /></button>}
        </span>
      </div>

      <div ref={grid} className={`relative ${gridClass}`}>
        {leads.map((t) => tileEdit(t, t.size ?? "large"))}
        {order.map((id, i) => {
          const w = widgetOf(id), sz = sizeHere(id), held = dragId === id, tileHere = alwaysTile || (sz === "small" && !w), content = contentOf(id, false);
          return (
            <motion.div key={id} ref={ref(id)} layout={held ? false : "position"} transition={GLIDE} data-home-edit={id}
              {...partHandlers(id)}
              onClick={isTiles ? (e) => { if (isControl(e.target) || drag.current || Date.now() - lastDrag.current < 400) return; setEditing(false); setOpened(id); } : undefined}
              className={`${spanHere(id)} relative min-w-0 select-none [-webkit-touch-callout:none]${fill} ${held ? "z-40 cursor-grabbing" : "z-0 cursor-grab"}`}
              style={held ? { willChange: "transform" } : undefined}>
              <div className={`hub-jiggle relative ${isTiles ? "h-full" : "rounded-3xl bg-white"} transition-shadow duration-150 ${held ? "shadow-2xl ring-2 ring-slate-900" : "shadow-sm ring-1 ring-slate-300"}`}
                style={{ animation: held ? "none" : `hub-jiggle .3s ease-in-out ${i % 2 ? "-.15s" : "0s"} infinite` }}>
                {tileHere
                  ? <div className={`pointer-events-none${fill}`} aria-hidden>{tileOf(id)}</div>
                  : content == null ? <div className={`pointer-events-none flex ${PREVIEW[sz]} items-center justify-center rounded-3xl bg-slate-50 text-sm text-slate-400`} aria-hidden>Nothing here right now</div>
                  : <div className="pointer-events-none overflow-hidden rounded-3xl" aria-hidden>{content}</div>}
                {!tileHere && !(w && w.size === "small") && <span className="pointer-events-none absolute bottom-2 left-1/2 max-w-[calc(100%-1rem)] -translate-x-1/2 truncate rounded-full bg-slate-950/80 px-3 py-1 text-xs font-semibold text-white">{label(id)}</span>}
                {w && <button type="button" onClick={() => kit.openSettings(w.id)} aria-label={`Change ${label(id)}`} className={`absolute ${w.size === "small" ? "right-2 top-2" : "bottom-2 right-2"} z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-800 shadow-md ring-1 ring-slate-200 transition active:scale-90`} data-testid={`home-widget-settings-${w.id}`}><Pencil className="h-4 w-4" /></button>}
                <button type="button" onClick={() => { if (w) { const last = kit.items.length <= 1; const next = order.flatMap((x) => (x !== id ? [x] : last ? ["widgets"] : [])); setOrder(next); kit.remove(w.id); onChange({ ...layout, home: full(next) } as L); } else onChange({ ...layout, home: full(order), homeHidden: [...new Set([...hidden, id])] } as L); }} aria-label={w ? `Delete ${label(id)} widget` : `Remove ${label(id)} from Home`}
                  className="absolute -left-2 -top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-700 text-white shadow-md transition active:scale-90" data-testid={`home-remove-${id}`}><X className="h-4 w-4" /></button>
                <div className={`absolute z-10 flex rounded-full bg-white/95 p-0.5 shadow-md ring-1 ring-slate-200 ${tileHere || w?.size === "small" ? "-bottom-3 left-1/2 -translate-x-1/2" : "right-2 top-2"}`} role="radiogroup" aria-label={`Size of ${label(id)}`}>
                  {HOME_SIZES.map((z) => <button key={z.id} type="button" role="radio" aria-checked={sz === z.id} aria-label={z.label} onClick={() => { if (w) kit.patch(w.id, { size: HOME_TO_W[z.id] }); else onChange(resizeSection({ ...layout, home: full(order) } as L, id, z.id)); }}
                    className={`inline-flex ${tileHere || w?.size === "small" ? "h-7 w-7" : "h-8 w-8"} items-center justify-center rounded-full text-xs font-bold transition ${sz === z.id ? "bg-slate-950 text-white" : "text-slate-600"}`} data-testid={`home-size-${id}-${z.id}`}>{z.short}</button>)}
                </div>
              </div>
            </motion.div>
          );
        })}
        {arranged(order.length).map((t, i) => tileEdit(t, t.size ?? startSize(order.length + i)))}
        {!order.length && <p className="col-span-full rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Home is empty. Add parts back below.</p>}
      </div>

      {widgetsOn && (
        <button type="button" onClick={kit.openGallery} disabled={kit.full} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[.99] disabled:opacity-50" data-testid="home-add-widget">
          <Plus className="h-4 w-4" /> {kit.full ? "Widget limit reached" : "Add a widget"}</button>
      )}
      {widgets && kit.modals}
      {(off.length > 0 || plugins.length > 0 || onOpenStore) && (
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4" data-testid="home-tray">
          {off.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">Add to Home</p>
              <div className="flex flex-wrap gap-2">
                {off.map((id) => (
                  <button key={id} type="button" onClick={() => onChange({ ...layout, homeHidden: hidden.filter((x) => x !== id) } as L)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95" data-testid={`home-add-${id}`}>
                    <Plus className="h-4 w-4" /> {label(id)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(plugins.length > 0 || onOpenStore) && (
            <div data-testid="home-plugins">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Apps</p>
                {onOpenStore && <button type="button" onClick={onOpenStore} className="min-h-11 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4">See all</button>}
              </div>
              {plugins.length ? (
                <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {plugins.map(({ plugin: p, onAdd }) => {
                    const Icon = ICONS[p.icon] ?? Puzzle;
                    return (
                      <div key={p.id} className="flex w-32 shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-slate-200 p-3 text-center">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: p.color }} aria-hidden><Icon className="h-5 w-5" /></span>
                        <span className="line-clamp-1 text-sm font-semibold text-slate-900">{p.name}</span>
                        <button type="button" onClick={onAdd} className="mt-1 inline-flex min-h-9 w-full items-center justify-center gap-1 rounded-full bg-slate-950 text-xs font-semibold text-white transition active:scale-95" data-testid={`home-plugin-${p.id}`}><Plus className="h-3.5 w-3.5" /> Add</button>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-sm text-slate-500">Every app is added.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** A part as a small square tile, like an app icon: its picture and its name. Renders quite
 *  differently per Home layout (see HubHomeLayout) — "cards" is the original app-icon tile,
 *  "tiles" is a solid flat color block with the label pinned bottom-left (Windows-Phone live
 *  tile), "terminal" drops the picture tile entirely for a bracketed text line, CRT-menu style. */
function PartTile({ part, accent, layout = "cards", size = "small" }: { part: HomePart; accent: string; layout?: HubHomeLayout; size?: HomeSize }) {
  const Icon = part.icon ?? Puzzle;
  if (layout === "terminal") {
    return (
      <span className="flex w-full items-center gap-2 border border-current px-3 py-2.5 text-left font-mono text-sm">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">[ {part.label.toUpperCase()} ]</span>
      </span>
    );
  }
  if (layout === "tiles") return <TileFace label={part.label} icon={<Icon strokeWidth={1.75} />} color={tileColorOf(part.id)} size={size} />;
  return (
    <span className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-[1.6rem] border border-slate-200 bg-white p-2 text-center shadow-sm">
      <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm sm:h-14 sm:w-14 ${accent}`}><Icon className="h-6 w-6 sm:h-7 sm:w-7" /></span>
      <span className="line-clamp-2 text-xs font-semibold leading-tight text-slate-800 sm:text-sm">{part.label}</span>
    </span>
  );
}

/** Which of `n` things to show now: it moves on every few seconds, each tile on its own beat so the screen never flips all at once. */
function useCycle(n: number, seed: string, every = 5200) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (n < 2) return;
    let timer = 0;
    const start = window.setTimeout(() => { setI((x) => x + 1); timer = window.setInterval(() => setI((x) => x + 1), every); }, 1800 + (tileHash(seed) % 3200));
    return () => { clearTimeout(start); clearInterval(timer); };
  }, [n, seed, every]);
  return n < 2 ? 0 : i % n;
}
/** How big a tile's big word may be, in container-width units, so a long one ("3:30 PM") still fits its tile. */
const bigSize = (big: string, size: HomeSize) => `${Math.min({ small: 9, medium: 17, large: 21 }[size], { small: 20, medium: 42, large: 70 }[size] / (0.56 * Math.max(1, big.length)))}cqw`;

/** One tile of the start screen: a flat colour block that fills its cell, the picture top-left and the
 *  name bottom-left (a Windows Phone tile). Small is 1×1 (picture and a one-line name), medium 2×2,
 *  wide 4×2 (a bigger picture, and a line of detail when there is one). A live tile also flips between
 *  its facts and its picture, shows photos, or draws its own face (a clock). */
function TileFace({ label, icon, color, size, sub, badge, faces, photos, body }: { label: string; icon: ReactNode; color: string; size: HomeSize; sub?: string; badge?: number; faces?: LiveFace[]; photos?: string[]; body?: (size: HomeSize) => ReactNode }) {
  const px = size === "small" ? "[&_svg]:h-6 [&_svg]:w-6" : size === "medium" ? "[&_svg]:h-10 [&_svg]:w-10" : "[&_svg]:h-12 [&_svg]:w-12";
  const facts = faces ?? [];
  // The facts, then the plain picture once, like a live tile flipping back to its icon.
  const at = useCycle(facts.length ? facts.length + 1 : 0, label), face = facts[at];
  const shot = useCycle(photos?.length ?? 0, `${label}-photo`, 6500);
  const sheen = <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/10" />;
  const badgeEl = badge ? <span className="absolute right-1.5 top-1.5 z-10 min-w-[18px] rounded-full bg-white px-1 text-center text-[10px] font-bold leading-[18px] text-slate-900">{badge > 99 ? "99+" : badge}</span> : null;
  const name = <span className={`block font-semibold leading-tight ${size === "small" ? "truncate text-[10px] sm:text-xs" : "line-clamp-2 text-sm sm:text-base"}`}>{label}</span>;

  if (photos?.length) {
    return (
      <span className="relative block h-full w-full overflow-hidden text-left text-white" style={{ backgroundColor: color }}>
        {photos.map((u, i) => <img key={u} src={u} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000" style={{ opacity: i === shot ? 1 : 0 }} />)}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/65 to-transparent" />
        <span className="absolute inset-x-0 bottom-0 p-2 sm:p-3">{name}</span>
        {badgeEl}
      </span>
    );
  }
  if (body) {
    return <span className="relative block h-full w-full overflow-hidden text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]" style={{ backgroundColor: color }}>{sheen}{body(size)}{badgeEl}</span>;
  }
  return (
    <span className="relative flex h-full w-full flex-col justify-between overflow-hidden p-2 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] sm:p-3" style={{ backgroundColor: color }}>
      {/* A soft diagonal sheen, like real live tiles: decorative only, never affects contrast. */}
      {sheen}
      {face
        ? <span key={at} className="tile-in relative block min-w-0">
            {face.big && <span className="block truncate font-light leading-none tracking-tight tabular-nums" style={{ fontSize: bigSize(face.big, size) }}>{face.big}</span>}
            {size !== "small" && <span className="mt-1.5 line-clamp-2 block text-sm leading-snug text-white/90 sm:text-base">{face.text}</span>}
          </span>
        : <span key="icon" className={`${facts.length ? "tile-in " : ""}relative inline-flex ${px} [&_svg]:text-white`}>{icon}</span>}
      <span className="relative block w-full min-w-0">
        {name}
        {sub && size === "large" && <span className="mt-0.5 line-clamp-2 block text-xs text-white/85 sm:text-sm">{sub}</span>}
      </span>
      {badgeEl}
    </span>
  );
}
