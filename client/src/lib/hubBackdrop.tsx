// The hubs' own background, remembered on this device, so anything shown while a hub is still
// arriving (its code or its saved copy) is the hub's color — never a white flash before a dark
// theme — and a loading circle only appears if the wait is more than a moment.
import type { CSSProperties } from "react";

const KEY = "arise-hub-backdrop";
type Backdrop = { bg: string; dark: boolean };

export function rememberHubBackdrop(bg: string, dark: boolean): void {
  try { localStorage.setItem(KEY, JSON.stringify({ bg, dark })); } catch { /* private mode: the default colors are used */ }
}

export function lastHubBackdrop(): Backdrop | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v && typeof v.bg === "string" && v.bg.length < 200 ? { bg: v.bg, dark: !!v.dark } : null;
  } catch { return null; }
}

/** Fades in after a moment: a quick switch shows only the background. */
const late: CSSProperties = { opacity: 0, animation: "arise-fade-in .3s ease 1.2s forwards" };

/** A full-screen wait in the hub's own colors. */
export function HubWaiting({ label, fallbackBg = "#f6f7fc" }: { label?: string; fallbackBg?: string }) {
  const b = lastHubBackdrop();
  const dark = b?.dark ?? false;
  return <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center" style={{ background: b?.bg || fallbackBg }} data-testid="hub-waiting">
    <div style={late} className="flex flex-col items-center gap-4">
      <div className={`h-9 w-9 animate-spin rounded-full border-4 border-t-transparent ${dark ? "border-white/70" : "border-violet-600"}`} style={{ borderTopColor: "transparent" }} />
      {label && <p className={`text-sm font-semibold ${dark ? "text-white/80" : "text-slate-600"}`}>{label}</p>}
    </div>
  </div>;
}
