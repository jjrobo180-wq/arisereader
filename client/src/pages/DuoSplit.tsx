// Arise To Duo split screen: /#/duo. Two views open at once, one on each side of the iPhone Duo's
// fold: LifeHub and WorkHub, or the To-Do list and Notes, or any two LifeHub sections.
// No bars across the top: a small handle on the fold opens the Duo menu (components/DuoControls.tsx,
// the same one as in Customize): what each side shows, swap, close the split, or turn Duo off.
// ONE floating button serves both sides: drag it to a side and it adds to
// (or asks the AI in) that side's hub. Each pane hides its own buttons (lib/duoPaneBridge.ts).
// Each pane is the real app in a frame named "duo-pane-left" / "duo-pane-right", so it keeps the
// phone layout that fits half the screen, remembers its own place (useStayOnRefresh), and saves
// straight to the account. When one pane saves, the other catches up at once (lib/paneSync).
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Redirect, useLocation } from "wouter";
import { GripVertical, GripHorizontal, Plus, Sparkles, X } from "lucide-react";
import type { DuoPaneAction, DuoPaneReply } from "@/lib/duoPaneBridge";
import { useAuth } from "@/context/AuthContext";
import { DUO_OFF_MESSAGE, splitDirection } from "@/lib/useAriseDuo";
import { PANE_OPTIONS, paneOptionsFor, useSplitPicks, type SplitSide } from "@/lib/duoSplit";
import DuoControls, { DUO_CLOSE_SPLIT_MESSAGE } from "@/components/DuoControls";

// Kept for anything that imported the list from here before it moved to lib/duoSplit.ts.
export { PANE_OPTIONS };

const FAB_KEY = "arise_duo_split_fab";
type Side = SplitSide;
// Where the fold is, when the browser says (otherwise the two views share the screen evenly).
const knowsFold = () => { try { return CSS.supports("width", "env(viewport-segment-width 0 0, 1px)"); } catch { return false; } };

export default function DuoSplit() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const canWork = !!user && (user.role === "teacher" || !!user.isAdmin);
  const [picks, setPicks] = useSplitPicks(canWork);
  const [dir, setDir] = useState<"book" | "stack">(() => splitDirection());
  const [fabSide, setFabSide] = useState<Side>(() => { try { return localStorage.getItem(FAB_KEY) === "left" ? "left" : "right"; } catch { return "right"; } });
  const [fabMenu, setFabMenu] = useState(false);
  const [foldMenu, setFoldMenu] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number; over: Side } | null>(null);
  const [toast, setToast] = useState("");
  const panes = useRef<Record<Side, HTMLElement | null>>({ left: null, right: null });
  const frames = useRef<Record<Side, HTMLIFrameElement | null>>({ left: null, right: null });
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    const before = document.title;
    document.title = "Arise To Duo";
    const update = () => setDir(splitDirection());
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => { document.title = before; window.removeEventListener("resize", update); window.removeEventListener("orientationchange", update); };
  }, []);

  useEffect(() => { try { localStorage.setItem(FAB_KEY, fabSide); } catch { /* not remembered */ } }, [fabSide]);

  // A pane answers when it couldn't do what the button asked (no AI assistant added there, say).
  useEffect(() => {
    const onReply = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const r = e.data as Partial<DuoPaneReply> | null;
      if (!r || r.type !== "arise-duo-result" || r.ok) return;
      setToast(r.action === "ai" ? "The AI assistant isn't added on this side yet. Add it from that hub's App Store." : "There's nothing to add on this side.");
    };
    window.addEventListener("message", onReply);
    return () => window.removeEventListener("message", onReply);
  }, []);
  // "Turn Duo off" or "Close split screen" from the Duo menu — here, or inside either pane.
  const backTo = picks.left === "workhub" ? "/workhub" : "/lifehub";
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const t = (e.data as { type?: string } | null)?.type;
      if (t === DUO_OFF_MESSAGE || t === DUO_CLOSE_SPLIT_MESSAGE) navigate(backTo);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [backTo, navigate]);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(""), 3500); return () => window.clearTimeout(t); }, [toast]);

  if (!user) return <Redirect to="/signin" replace />;

  const options = paneOptionsFor(canWork);
  const optFor = (side: Side) => options.find((o) => o.id === picks[side]) || options[0];
  const sideName = (side: Side) => (dir === "book" ? (side === "left" ? "Left side" : "Right side") : (side === "left" ? "Top" : "Bottom"));

  // The one floating button: tap for Add / Ask AI on its side, or drag it to the other side.
  const sideAt = (x: number, y: number): Side => {
    const r = panes.current.left?.getBoundingClientRect();
    if (!r) return fabSide;
    return dir === "book" ? (x <= r.right ? "left" : "right") : (y <= r.bottom ? "left" : "right");
  };
  const onDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current; if (!p) return;
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) return;
    p.moved = true;
    setFabMenu(false);
    setDrag({ x: e.clientX, y: e.clientY, over: sideAt(e.clientX, e.clientY) });
  };
  const onUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current; press.current = null;
    if (p?.moved) { setFabSide(sideAt(e.clientX, e.clientY)); setDrag(null); return; }
    setFabMenu((v) => !v);
  };
  const act = (action: DuoPaneAction) => {
    setFabMenu(false);
    frames.current[fabSide]?.contentWindow?.postMessage({ type: "arise-duo-action", action }, window.location.origin);
  };

  const fab = (
    <div className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex flex-col items-end gap-2">
      {fabMenu && <div role="menu" aria-label={`For the ${sideName(fabSide).toLowerCase()}`} className="pointer-events-auto w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl" data-testid="duo-fab-menu">
        <p className="px-3 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{sideName(fabSide)}: {optFor(fabSide).label}</p>
        <button type="button" role="menuitem" onClick={() => act("add")} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"><Plus className="h-4 w-4 text-[#6e5ae0]" /> Add</button>
        <button type="button" role="menuitem" onClick={() => act("ai")} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"><Sparkles className="h-4 w-4 text-[#6e5ae0]" /> Ask AI</button>
        <p className="px-3 pb-1.5 pt-1 text-xs text-slate-500">Drag this button to the other side to use it there.</p>
      </div>}
      <button type="button" aria-label={`Add or ask AI on the ${sideName(fabSide).toLowerCase()}. Drag to move it.`} aria-haspopup="menu" aria-expanded={fabMenu}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { press.current = null; setDrag(null); }}
        className={`pointer-events-auto grid h-14 w-14 touch-none place-items-center rounded-full bg-[#6e5ae0] text-white shadow-xl transition active:scale-95 ${drag ? "opacity-0" : ""}`} data-testid="duo-fab">
        <Plus className={`h-6 w-6 transition-transform ${fabMenu ? "rotate-45" : ""}`} />
      </button>
    </div>
  );

  const pane = (side: Side) => {
    const opt = optFor(side);
    const src = `${window.location.pathname}#${opt.path}`;
    return (
      <section key={side} ref={(el) => { panes.current[side] = el; }} aria-label={`${sideName(side)}: ${opt.label}`}
        className="relative flex min-h-0 min-w-0 flex-1 basis-0 flex-col bg-white"
        style={side === "left" && knowsFold() ? { flexBasis: dir === "book" ? "env(viewport-segment-width 0 0, 50%)" : "env(viewport-segment-height 0 0, 50%)", flexGrow: 0 } : undefined}
        data-testid={`duo-pane-${side}`}>
        <iframe key={opt.id} ref={(el) => { frames.current[side] = el; }} name={`duo-pane-${side}`} title={opt.label} src={src} className="min-h-0 w-full flex-1 border-0" />
        {drag && <div aria-hidden className={`pointer-events-none absolute inset-0 z-20 transition ${drag.over === side ? "bg-[#6e5ae0]/10 ring-4 ring-inset ring-[#6e5ae0]/60" : ""}`} />}
        {fabSide === side && fab}
      </section>
    );
  };

  return (
    <div className={`fixed inset-0 flex bg-[#292446] ${dir === "book" ? "flex-row" : "flex-col"}`} data-testid="duo-split">
      {pane("left")}
      <div className={`relative z-40 shrink-0 bg-[#292446] ${dir === "book" ? "w-px" : "h-px"}`}>
        <button type="button" onClick={() => setFoldMenu(true)} aria-label="Choose what each side shows" title="Choose views"
          className={`absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-md hover:text-slate-800 ${dir === "book" ? "h-16 w-6" : "h-6 w-16"}`} data-testid="duo-fold-handle">
          {dir === "book" ? <GripVertical className="h-4 w-4" /> : <GripHorizontal className="h-4 w-4" />}
        </button>
      </div>
      {pane("right")}

      {drag && <span aria-hidden className="pointer-events-none fixed z-50 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#6e5ae0] text-white shadow-2xl" style={{ left: drag.x, top: drag.y }}><Plus className="h-6 w-6" /></span>}

      {foldMenu && <div className="fixed inset-0 kb-sheet z-50 flex items-end justify-center bg-[#16152a]/40 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setFoldMenu(false); }}>
        <div role="dialog" aria-modal="true" aria-label="Arise To Duo" onKeyDown={(e) => { if (e.key === "Escape") setFoldMenu(false); }}
          className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" data-testid="duo-fold-menu">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <h2 className="text-lg font-black text-slate-900">Arise To Duo</h2>
            <button type="button" onClick={() => setFoldMenu(false)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#292446] px-4 text-sm font-bold text-white" data-autofocus><X className="h-4 w-4" /> Done</button>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DuoControls canWork={canWork} split={{ picks, setPicks }} onClose={() => setFoldMenu(false)} />
          </div>
        </div>
      </div>}

      {toast && <div role="status" className="fixed bottom-24 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl bg-[#292446] px-4 py-3 text-center text-sm font-semibold text-white shadow-xl">{toast}</div>}
    </div>
  );
}
