// The switch in the top bar between Arise WorkHub, LifeHub and FamilyHub (the one the whole family shares).
// Both use the same sign-in, so switching never asks to log in again.
// Night colours are set inline: the hubs' night stylesheets remap slate classes, which made
// the active pill's dark text turn light (invisible on its light background).
import type { CSSProperties, MouseEvent } from "react";

/** Switches hubs in place: the switch is not a step in the browser's history, so Back never flips Work and Life. */
export function switchHub(hash: "#/workhub" | "#/lifehub" | "#/familyhub", e?: MouseEvent) {
  if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) return; // a new tab or window: leave it be
  e?.preventDefault();
  if (window.location.hash === hash) return;
  window.location.replace(hash);
}
import HubMark from "@/components/HubMark";

export default function HubSwitch({ current, night }: { current: "hub" | "todo" | "family"; night?: boolean }) {
  const item = (on: boolean) => `inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition sm:px-3 ${night
    ? on ? "" : "hover:bg-white/10"
    : on ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`;
  const style = (on: boolean) => night ? (on ? { background: "#e2e8f0", color: "#0f172a" } : { color: "#cbd5e1" }) : undefined;
  return <nav aria-label="Switch app" className={`inline-flex shrink-0 items-center gap-0.5 rounded-xl p-1 ring-1 ${night ? "" : "bg-slate-100 ring-slate-200"}`}
    style={night ? ({ background: "#1e293b", "--tw-ring-color": "#334155" } as CSSProperties) : undefined} data-testid="hub-todo-switch">
    <a href="#/workhub" onClick={(e) => switchHub("#/workhub", e)} aria-current={current === "hub" ? "page" : undefined} className={item(current === "hub")} style={style(current === "hub")} title="Arise To Do — Work"><HubMark tone="work" className="h-[15px] w-[15px] shrink-0" /><span className="hidden sm:inline">Work</span></a>
    <a href="#/lifehub" onClick={(e) => switchHub("#/lifehub", e)} aria-current={current === "todo" ? "page" : undefined} className={item(current === "todo")} style={style(current === "todo")} title="Arise To Do — Life"><HubMark tone="life" className="h-[15px] w-[15px] shrink-0" /><span className="hidden sm:inline">Life</span></a>
    <a href="#/familyhub" onClick={(e) => switchHub("#/familyhub", e)} aria-current={current === "family" ? "page" : undefined} className={item(current === "family")} style={style(current === "family")} title="Arise To Do — Family" data-testid="hub-switch-family"><HubMark tone="family" className="h-[15px] w-[15px] shrink-0" /><span className="hidden sm:inline">Family</span></a>
  </nav>;
}
