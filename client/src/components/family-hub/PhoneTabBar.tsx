// Arise To Duo on a phone: a floating tab bar along the bottom (Home, Tasks, Add, Apps, You), the same
// shape as the one in Pod+. Apps opens the full app drawer (PhoneMenu); You opens a sheet with the
// account and every setting. On a computer (lg and up) the sidebar is used instead, so this hides.
import { useEffect, type ReactNode } from "react";
import { CheckSquare, Home, LayoutGrid, Plus, X } from "lucide-react";

/** Opens the app drawer in PhoneMenu from anywhere. */
export const OPEN_APPS_EVENT = "arise:open-apps";

export type TabSheetItem = { id: string; label: string; detail?: string; icon: ReactNode; onClick: () => void; danger?: boolean };

export function PhoneTabBar({ home, tasks, addOpen, onHome, onTasks, onAdd, name, you, youOpen, setYouOpen, raise = false }: {
  home: boolean; tasks: boolean; addOpen: boolean;
  onHome: () => void; onTasks: () => void; onAdd: () => void;
  /** The signed-in person's name, for the You tab's initial and the sheet's heading. */ name: string;
  /** What the You sheet holds. */ you: TabSheetItem[];
  youOpen: boolean; setYouOpen: (open: boolean) => void;
  /** Sits a little higher, e.g. while something else is pinned to the bottom. */ raise?: boolean;
}) {
  useEffect(() => {
    if (!youOpen) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setYouOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [youOpen, setYouOpen]);
  const initial = (name.trim()[0] || "Y").toUpperCase();
  const tab = (active: boolean) => `relative flex min-h-12 min-w-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold transition active:scale-90 ${active ? "text-white" : "text-white/60"}`;
  return <>
    <nav aria-label="Arise To Duo" data-testid="life-tab-bar"
      className={`fixed inset-x-3 z-[45] mx-auto flex max-w-md items-center gap-1 rounded-full bg-[#1d1a33]/95 px-2 py-1.5 shadow-[0_12px_32px_#16152a55] ring-1 ring-white/10 backdrop-blur lg:hidden ${raise ? "bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)]" : "bottom-[max(0.75rem,env(safe-area-inset-bottom))]"}`}>
      <button type="button" onClick={onHome} aria-current={home ? "page" : undefined} className={tab(home)} data-testid="life-tab-home"><Home className="h-[22px] w-[22px]" />Home</button>
      <button type="button" onClick={onTasks} aria-current={tasks ? "page" : undefined} className={tab(tasks)} data-testid="life-tab-tasks"><CheckSquare className="h-[22px] w-[22px]" />Tasks</button>
      <button type="button" onClick={onAdd} aria-label="Add" aria-haspopup="menu" aria-expanded={addOpen} data-add-toggle data-testid="life-tab-add"
        className="mx-1 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#7968e5] text-white shadow-md transition active:scale-90">
        <Plus className={`h-6 w-6 transition-transform ${addOpen ? "rotate-45" : ""}`} />
      </button>
      <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_APPS_EVENT))} className={tab(false)} data-testid="life-tab-apps"><LayoutGrid className="h-[22px] w-[22px]" />Apps</button>
      <button type="button" onClick={() => setYouOpen(true)} aria-haspopup="dialog" aria-expanded={youOpen} className={tab(youOpen)} data-testid="life-tab-you">
        <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white text-[11px] font-black text-[#1d1a33]">{initial}</span>You
      </button>
    </nav>
    {youOpen && <div className="fixed inset-0 z-[490] lg:hidden" data-testid="life-you-sheet">
      <div className="absolute inset-0 bg-slate-950/35" onClick={() => setYouOpen(false)} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="You" className="absolute inset-x-0 bottom-0 mx-auto max-h-[85dvh] max-w-md overflow-y-auto rounded-t-[1.75rem] bg-white px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-300" aria-hidden />
        <div className="flex items-center gap-3 px-2 pb-2 pt-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#292446] text-lg font-black text-white">{initial}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-base font-extrabold text-slate-900">{name || "You"}</p><p className="text-xs text-slate-500">Account and settings</p></div>
          <button type="button" onClick={() => setYouOpen(false)} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <ul className="space-y-0.5">
          {you.map((item) => <li key={item.id}>
            <button type="button" onClick={() => { setYouOpen(false); item.onClick(); }} data-testid={`life-you-${item.id}`}
              className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-semibold hover:bg-slate-50 ${item.danger ? "text-rose-600" : "text-slate-800"}`}>
              <span className={`[&_svg]:h-5 [&_svg]:w-5 ${item.danger ? "text-rose-500" : "text-slate-500"}`}>{item.icon}</span>
              <span className="min-w-0"><span className="block truncate">{item.label}</span>{item.detail && <span className="block truncate text-xs font-normal text-slate-500">{item.detail}</span>}</span>
            </button>
          </li>)}
        </ul>
      </div>
    </div>}
  </>;
}
