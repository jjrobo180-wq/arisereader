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
  const status = !on ? "Off on this phone."
    : inSplit ? "On · split screen is open."
    : duo.isDuo ? (duo.mode === "book" ? "On · two panes, one each side of the fold." : "On · one roomy column.")
    : "On · switches to the Duo layout when there's room.";

  const [picking, setPicking] = useState<SplitSide | null>(null);
  const groups = (["LifeHub", "WorkHub"] as const).map((g) => ({ g, list: options.filter((o) => o.group === g) })).filter((x) => x.list.length);

  return <div className="space-y-6" data-testid="duo-controls">
    {/* 1. Split screen: the main thing, on any phone. */}
    <section data-testid="duo-split-controls">
      <h3 className="text-lg font-black text-slate-900">Split screen</h3>
      <p className="mt-1 text-sm text-slate-500">See two things at once. {dir === "book" ? "They sit side by side." : "One sits above the other; turn your phone sideways to put them side by side."} Tap a half to change what it shows.</p>

      <div className="mt-4 flex items-stretch gap-4">
        {/* The phone, with the two halves you can tap. */}
        <div className={`flex shrink-0 gap-1.5 rounded-[22px] bg-slate-900 p-1.5 shadow-lg ${dir === "book" ? "h-32 w-52 flex-row" : "h-56 w-28 flex-col"}`} data-testid="duo-split-preview">
          {(["left", "right"] as SplitSide[]).map((side, n) => <button key={side} type="button" onClick={() => setPicking(picking === side ? null : side)} aria-pressed={picking === side} aria-label={`${sideName(side)}: ${paneLabel(picks[side])}. Tap to change.`}
            className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-[16px] px-1.5 text-center transition ${picking === side ? "ring-4 ring-violet-400" : ""}`} style={{ background: n === 0 ? "#ffffff" : "#ede9fe", color: "#1e1b4b" }}>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6d28d9" }}>{sideName(side)}</span>
            <span className="text-[12.5px] font-black leading-tight">{paneLabel(picks[side])}</span>
          </button>)}
        </div>
        {/* What each half shows, plainly. */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          {(["left", "right"] as SplitSide[]).map((side) => <button key={side} type="button" onClick={() => setPicking(picking === side ? null : side)} data-testid={`duo-change-${side}`}
            className={`flex min-h-14 w-full items-center justify-between gap-2 rounded-2xl border px-3.5 text-left ${picking === side ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white"}`}>
            <span className="min-w-0"><span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">{sideName(side)}</span><span className="block truncate text-[15px] font-bold text-slate-900">{paneLabel(picks[side])}</span></span>
            <span className="shrink-0 text-sm font-bold text-violet-700">Change</span>
          </button>)}
          <button type="button" onClick={() => setPicks((p) => ({ left: p.right, right: p.left }))} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl text-sm font-bold text-slate-600" data-testid="duo-swap"><ArrowLeftRight className="h-4 w-4" /> Swap them</button>
        </div>
      </div>

      {/* Choosing what one half shows. */}
      {picking && <div className="mt-3 rounded-2xl border border-violet-200 bg-white p-3" data-testid="duo-picker">
        <p className="mb-2 text-sm font-bold text-slate-900">{sideName(picking)} shows:</p>
        {groups.map(({ g, list }) => <div key={g} className="mb-2"><p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{g}</p>
          <div className="flex flex-wrap gap-1.5">{list.map((o) => { const sel = picks[picking] === o.id; return <button key={o.id} type="button" onClick={() => { setPicks((p) => ({ ...p, [picking]: o.id })); setPicking(null); }} aria-pressed={sel}
            className={`min-h-10 rounded-full px-3.5 text-sm font-semibold ${sel ? "text-white" : "bg-slate-100 text-slate-800"}`} style={sel ? { background: "#6d28d9" } : undefined}>{o.label}</button>; })}</div></div>)}
        {/* The old pickers stay for keyboards and screen readers. */}
        <select value={picks[picking]} onChange={(e) => { setPicks((p) => ({ ...p, [picking]: e.target.value })); setPicking(null); }} data-testid={`duo-pick-${picking}`} className="sr-only" aria-label={`${sideName(picking)} shows`}>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>}

      <div className="mt-4">
        {inSplit
          ? <button type="button" onClick={closeSplit} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-base font-bold text-slate-800 ring-1 ring-slate-300" data-testid="duo-close-split"><X className="h-5 w-5" /> Close split screen</button>
          : !pane && <button type="button" onClick={openSplit} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-bold text-white shadow-[0_10px_24px_-12px_rgba(109,40,217,.8)]" style={{ background: "#6d28d9" }} data-testid="duo-open-split-screen">{dir === "book" ? <Columns2 className="h-5 w-5" /> : <Columns2 className="h-5 w-5 rotate-90" />} Open split screen</button>}
      </div>
    </section>

    {/* 2. The folding-phone layout: separate, and plainly optional. */}
    <section className="rounded-2xl border border-slate-200 bg-white p-4" data-testid="duo-layout-section">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-black text-slate-900">Folding-phone layout</h3>
          <p className="mt-0.5 text-sm text-slate-600">For phones that fold or have two screens: shows the app as two pages, one each side. You don't need it for split screen.</p>
          <p className="mt-1 text-xs font-semibold text-slate-500" role="status" data-testid="duo-status">{status}</p>
        </div>
        <button type="button" role="switch" aria-checked={on} aria-label={on ? "Turn the folding-phone layout off" : "Turn the folding-phone layout on"} onClick={on ? switchOff : switchOn} data-testid="duo-master-switch"
          className={`relative inline-flex h-9 w-16 shrink-0 items-center rounded-full transition ${on ? "" : "bg-slate-300"}`} style={on ? { background: "#6d28d9" } : undefined}>
          <span className={`inline-block h-7 w-7 rounded-full bg-white shadow transition-transform ${on ? "translate-x-8" : "translate-x-1"}`} />
        </button>
      </div>
      {on && !inSplit && <div role="radiogroup" aria-label="When to use it" className="mt-3 flex flex-wrap gap-2">
        {([["auto", "Only on a folding phone"], ["on", "Whenever there's room"]] as const).map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={duo.choice === id} onClick={() => duo.setChoice(id)}
          className={`min-h-10 rounded-full px-3.5 text-sm font-semibold ${duo.choice === id ? "text-white" : "bg-slate-100 text-slate-700"}`} style={duo.choice === id ? { background: "#6d28d9" } : undefined}>{label}</button>)}
      </div>}
      {duo.choice === "on" && !duo.isDuo && !inSplit && <p className="mt-2 text-xs text-slate-500">This screen is too narrow for two pages right now. Use split screen above instead.</p>}
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
