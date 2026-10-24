// Arise To Duo split screen: /#/duo. Two views open at once, one on each side of the iPhone Duo's
// fold: LifeHub and WorkHub, or the To-Do list and Notes, or any two LifeHub sections.
// No bars across the top: a small handle on the fold picks what each side shows, swaps them or
// closes the split, and ONE floating button serves both sides: drag it to a side and it adds to
// (or asks the AI in) that side's hub. Each pane hides its own buttons (lib/duoPaneBridge.ts).
// Each pane is the real app in a frame named "duo-pane-left" / "duo-pane-right", so it keeps the
// phone layout that fits half the screen, remembers its own place (useStayOnRefresh), and saves
// straight to the account. When one pane saves, the other catches up at once (lib/paneSync).
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Redirect, useLocation } from "wouter";
import { ArrowLeftRight, GripVertical, GripHorizontal, Plus, Sparkles, X } from "lucide-react";
import type { DuoPaneAction, DuoPaneReply } from "@/lib/duoPaneBridge";
import { useAuth } from "@/context/AuthContext";
import { splitDirection } from "@/lib/useAriseDuo";

type PaneOption = { id: string; label: string; path: string; group: "LifeHub" | "WorkHub"; work?: boolean };

const life = (id: string, label: string): PaneOption => ({ id, label, path: `/lifehub?pane=${id}`, group: "LifeHub" });

export const PANE_OPTIONS: PaneOption[] = [
  { id: "workhub", label: "WorkHub", path: "/workhub", group: "WorkHub", work: true },
  life("home", "LifeHub Home"),
  life("tasks", "To-Do list"),
  life("notes", "Notes"),
  life("calendar", "Calendar"),
  life("grocery", "Grocery list"),
  life("meals", "Meal planner"),
  life("chores", "Chores"),
  life("goals", "Goals"),
  life("habits", "Habits"),
  life("journal", "Journal"),
  life("money", "Money"),
  life("countdowns", "Countdowns"),
  life("lifeplan", "AI Reminders"),
  life("focus", "Focus timer"),
];

const KEY = "arise_duo_split_v1";
const FAB_KEY = "arise_duo_split_fab";
type Side = "left" | "right";
// Where the fold is, when the browser says (otherwise the two views share the screen evenly).
const knowsFold = () => { try { return CSS.supports("width", "env(viewport-segment-width 0 0, 1px)"); } catch { return false; } };

function loadPicks(canWork: boolean): { left: string; right: string } {
  const fallback = { left: "tasks", right: canWork ? "workhub" : "notes" };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    const ok = (id: unknown) => typeof id === "string" && PANE_OPTIONS.some((o) => o.id === id && (!o.work || canWork));
    if (saved && ok(saved.left) && ok(saved.right)) return { left: saved.left, right: saved.right };
  } catch { /* fresh start */ }
  return fallback;
}

export default function DuoSplit() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const canWork = !!user && (user.role === "teacher" || !!user.isAdmin);
  const [picks, setPicks] = useState(() => loadPicks(canWork));
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

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(picks)); } catch { /* not remembered */ } }, [picks]);
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
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(""), 3500); return () => window.clearTimeout(t); }, [toast]);

  if (!user) return <Redirect to="/signin" replace />;

  const options = PANE_OPTIONS.filter((o) => !o.work || canWork);
  const optFor = (side: Side) => options.find((o) => o.id === picks[side]) || options[0];
  const pick = (side: Side, id: string) => setPicks((p) => ({ ...p, [side]: id }));
  const swap = () => { setPicks((p) => ({ left: p.right, right: p.left })); setFoldMenu(false); };
  const close = () => navigate(picks.left === "workhub" ? "/workhub" : "/lifehub");
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

      {foldMenu && <div className="fixed inset-0 z-50 grid place-items-center bg-[#16152a]/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setFoldMenu(false); }}>
        <div role="dialog" aria-modal="true" aria-label="Split screen" className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl" data-testid="duo-fold-menu">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-slate-900">Split screen</h2>
            <button type="button" onClick={() => setFoldMenu(false)} aria-label="Done" className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
          </div>
          <div className={`grid gap-4 ${dir === "book" ? "grid-cols-2" : "grid-cols-1"}`}>
            {(["left", "right"] as Side[]).map((side) => (
              <fieldset key={side} className="min-w-0">
                <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{sideName(side)}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {options.map((o) => <button key={o.id} type="button" aria-pressed={picks[side] === o.id} onClick={() => pick(side, o.id)}
                    className={`min-h-10 rounded-full px-3 text-sm font-semibold ring-1 ${picks[side] === o.id ? "bg-[#292446] text-white ring-[#292446]" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}>{o.label}</button>)}
                </div>
              </fieldset>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={swap} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-800"><ArrowLeftRight className="h-4 w-4" /> Swap sides</button>
            <button type="button" onClick={close} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#292446] px-4 text-sm font-bold text-white"><X className="h-4 w-4" /> Close split screen</button>
          </div>
        </div>
      </div>}

      {toast && <div role="status" className="fixed bottom-24 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl bg-[#292446] px-4 py-3 text-center text-sm font-semibold text-white shadow-xl">{toast}</div>}
    </div>
  );
}
