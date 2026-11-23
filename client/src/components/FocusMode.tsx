// The full screen buttons for the hubs (lib/focusMode.ts): one in the top bar to go full screen, and, while
// full screen, one small button in the corner to come back. The hub renders <FocusExit /> once.
import { useEffect } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { setFocusMode, useFocusMode } from "@/lib/focusMode";

export function FocusButton({ className = "" }: { className?: string }) {
  return <button type="button" onClick={() => setFocusMode(true)} aria-label="Full screen" title="Full screen: just the plugin"
    className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 ${className}`} data-testid="focus-on">
    <Maximize2 className="h-[18px] w-[18px]" />
  </button>;
}

export function FocusExit() {
  const on = useFocusMode();
  // Leaving the hub (another hub, signing out) leaves full screen too.
  useEffect(() => () => setFocusMode(false), []);
  useEffect(() => {
    if (!on) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector('[role="dialog"], [aria-modal="true"]')) setFocusMode(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [on]);
  if (!on) return null;
  return <button type="button" onClick={() => setFocusMode(false)} aria-label="Exit full screen" data-testid="focus-off"
    className="fixed right-3 top-[max(0.6rem,env(safe-area-inset-top))] z-[640] inline-flex h-10 items-center gap-1.5 rounded-full bg-slate-900/75 px-3 text-xs font-bold text-white shadow-lg backdrop-blur transition hover:bg-slate-900 sm:px-4">
    <Minimize2 className="h-4 w-4" /><span className="hidden sm:inline">Exit full screen</span>
  </button>;
}
