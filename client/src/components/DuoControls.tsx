// The one Arise To Duo menu. The same panel shows in LifeHub's and WorkHub's Customize (tab "Duo &
// split screen"), behind the header's Duo button while Duo is on, and on the split screen's fold
// handle — so there is one place to look, and one switch that turns Duo off everywhere at once
// (the two-pane layout AND the split screen; see turnDuoOff in lib/useAriseDuo.ts).
//
// Split screen works on any phone, not only the iPhone Duo: side by side when the screen is wide,
// one above the other on a regular phone held upright.
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeftRight, Columns2, X } from "lucide-react";
import { inDuoPane, inSplitScreen, looksLikeDuoInner, splitDirection, turnDuoOff, useAriseDuo } from "@/lib/useAriseDuo";
import { paneLabel, paneOptionsFor, useSplitPicks, type SplitPicks, type SplitSide } from "@/lib/duoSplit";

/** Asks the split screen (from this page or any pane inside it) to close, leaving Duo's layout as it is. */
export const DUO_CLOSE_SPLIT_MESSAGE = "arise-duo-close-split";
export function closeSplitScreen(): void {
  let w: Window = window;
  for (let hops = 0; hops < 6; hops++) {
    try { w.postMessage({ type: DUO_CLOSE_SPLIT_MESSAGE }, window.location.origin); } catch { /* another site */ }
    if (w === w.parent) break;
    w = w.parent;
  }
}

type SplitControl = { picks: SplitPicks; setPicks: (next: SplitPicks | ((p: SplitPicks) => SplitPicks)) => void };

export default function DuoControls({ canWork, onClose, split, dark = "#292446" }: {
  /** WorkHub can be one of the panes. */
  canWork: boolean;
  /** Closes whatever this panel sits in (Customize, the Duo menu) after it opens or closes the split screen. */
  onClose?: () => void;
  /** On the split screen itself, the picks it is showing (so a change shows there at once). */
  split?: SplitControl;
  dark?: string;
}) {
  const duo = useAriseDuo();
  const [, navigate] = useLocation();
  const [ownPicks, setOwnPicks] = useSplitPicks(canWork);
  const picks = split?.picks ?? ownPicks;
  const setPicks = split?.setPicks ?? setOwnPicks;
  const [dir, setDir] = useState<"book" | "stack">(() => splitDirection());
  useEffect(() => {
    const update = () => setDir(splitDirection());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const inSplit = !!split || inSplitScreen();
  const pane = inDuoPane();
  const on = duo.isDuo || inSplit || duo.choice === "on";
  const options = paneOptionsFor(canWork);
  const sideName = (side: SplitSide) => (dir === "book" ? (side === "left" ? "Left side" : "Right side") : (side === "left" ? "Top" : "Bottom"));

  const switchOn = () => duo.setChoice(looksLikeDuoInner() ? "auto" : "on");
  const switchOff = () => { turnDuoOff(); onClose?.(); };
  const openSplit = () => { onClose?.(); navigate("/duo"); };
  const closeSplit = () => { onClose?.(); closeSplitScreen(); };
  const status = !on ? "Off on this device."
    : inSplit ? "On · split screen is open."
    : duo.isDuo ? (duo.mode === "book" ? "On · two panes, one each side of the fold." : "On · one roomy column.")
    : "On · switches to the Duo layout when there's room.";

  return <div className="space-y-5" data-testid="duo-controls">
    {/* The one switch. Off = the layout goes off AND any split screen closes. */}
    <section className={`rounded-2xl border p-4 ${on ? "border-violet-200 bg-violet-50/60" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-black text-slate-900">Arise To Duo</h3>
          <p className="mt-0.5 text-sm text-slate-600" role="status" data-testid="duo-status">{status}</p>
        </div>
        <button type="button" role="switch" aria-checked={on} aria-label={on ? "Turn Arise To Duo off" : "Turn Arise To Duo on"} onClick={on ? switchOff : switchOn} data-testid="duo-master-switch"
          className={`relative inline-flex h-9 w-16 shrink-0 items-center rounded-full transition ${on ? "" : "bg-slate-300"}`} style={on ? { background: dark } : undefined}>
          <span className={`inline-block h-7 w-7 rounded-full bg-white shadow transition-transform ${on ? "translate-x-8" : "translate-x-1"}`} />
        </button>
      </div>
      {on && !inSplit && <div role="radiogroup" aria-label="When to use the Duo layout" className="mt-3 flex flex-wrap gap-2">
        {([["auto", "Only on the iPhone Duo"], ["on", "Always, when there's room"]] as const).map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={duo.choice === id} onClick={() => duo.setChoice(id)}
          className={`min-h-10 rounded-full px-3.5 text-sm font-semibold ring-1 ${duo.choice === id ? "text-white" : "bg-white text-slate-700 ring-slate-200"}`} style={duo.choice === id ? { background: dark, boxShadow: `0 0 0 1px ${dark}` } : undefined}>{label}</button>)}
      </div>}
      {duo.choice === "on" && !duo.isDuo && !inSplit && <p className="mt-2 text-xs text-slate-500">This screen is too small for two panes right now — try split screen below.</p>}
    </section>

    {/* Split screen: on any phone. A small picture shows which way it divides here. */}
    <section data-testid="duo-split-controls">
      <h3 className="text-sm font-black text-slate-900">Split screen</h3>
      <p className="mb-3 mt-1 text-sm text-slate-500">Two views at once. {dir === "book" ? "Side by side on this screen." : "One above the other on this phone — turn it sideways for side by side."}</p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div aria-hidden className={`mx-auto flex shrink-0 gap-1 overflow-hidden rounded-[18px] border-[3px] border-slate-800 bg-slate-800 p-1 ${dir === "book" ? "h-28 w-44 flex-row" : "h-44 w-24 flex-col"}`} data-testid="duo-split-preview">
          {(["left", "right"] as SplitSide[]).map((side) => <div key={side} className={`flex flex-1 items-center justify-center rounded-[11px] px-1 text-center text-[11px] font-bold leading-tight ${side === "left" ? "bg-white text-slate-700" : "bg-violet-100 text-violet-900"}`}>{paneLabel(picks[side])}</div>)}
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2">
          {(["left", "right"] as SplitSide[]).map((side) => <label key={side} className="block text-xs font-bold uppercase tracking-wide text-slate-500">{sideName(side)}
            <select value={picks[side]} onChange={(e) => setPicks((p) => ({ ...p, [side]: e.target.value }))} data-testid={`duo-pick-${side}`}
              className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-800">
              {(["LifeHub", "WorkHub"] as const).map((g) => { const list = options.filter((o) => o.group === g); return list.length ? <optgroup key={g} label={g}>{list.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</optgroup> : null; })}
            </select>
          </label>)}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setPicks((p) => ({ left: p.right, right: p.left }))} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-800 hover:bg-slate-200" data-testid="duo-swap"><ArrowLeftRight className="h-4 w-4" /> Swap</button>
        {inSplit
          ? <button type="button" onClick={closeSplit} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50" data-testid="duo-close-split"><X className="h-4 w-4" /> Close split screen</button>
          : !pane && <button type="button" onClick={openSplit} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white" style={{ background: dark }} data-testid="duo-open-split-screen">{dir === "book" ? <Columns2 className="h-4 w-4" /> : <Columns2 className="h-4 w-4 rotate-90" />} Open split screen</button>}
      </div>
    </section>
  </div>;
}

/** The header's Duo button: shown while Duo is on (the two-pane layout, or "Always on"), it opens
 *  the Duo menu right there — split screen, and the switch to turn it off — in one tap. */
export function DuoHeaderButton({ onOpen }: { onOpen: () => void }) {
  const duo = useAriseDuo();
  if (!duo.isDuo && duo.choice !== "on") return null;
  return <button type="button" onClick={onOpen} aria-label="Arise To Duo menu: split screen, or turn Duo off" title="Duo"
    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#292446] px-3 text-sm font-bold text-white" data-testid="duo-menu-button">
    <Columns2 className="h-4 w-4" /> <span className="hidden min-[400px]:inline">Duo</span>
  </button>;
}
