// Customize, for both hubs: one sheet with its choices sorted into a few tabs instead of one long
// scroll. It is easy to leave from anywhere in it — the Done button stays at the top while the rest
// scrolls, and a tap outside, Escape, or a swipe down on the top bar (on a phone) closes it too.
// The tab you were on is remembered for the rest of the visit.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Check } from "lucide-react";

export type CustomizeTab = { id: string; label: string; icon: ReactNode; content: ReactNode };

export default function CustomizeSheet({ title = "Customize", eyebrow, tabs, initialTab, storageKey, onClose, dark = "#292446", testId }: {
  title?: string;
  eyebrow: string;
  tabs: CustomizeTab[];
  /** Opens on this tab (the Duo button opens straight to "Duo & split screen"). */
  initialTab?: string;
  /** Where the last tab is remembered (sessionStorage). */
  storageKey: string;
  onClose: () => void;
  dark?: string;
  testId?: string;
}) {
  const [tab, setTabState] = useState<string>(() => {
    if (initialTab && tabs.some((t) => t.id === initialTab)) return initialTab;
    try { const saved = sessionStorage.getItem(storageKey); if (saved && tabs.some((t) => t.id === saved)) return saved; } catch { /* first visit */ }
    return tabs[0]?.id ?? "";
  });
  const setTab = (id: string) => { setTabState(id); try { sessionStorage.setItem(storageKey, id); } catch { /* not remembered */ } body.current?.scrollTo({ top: 0 }); };
  const body = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [drag, setDrag] = useState(0);
  const press = useRef<{ y: number; id: number } | null>(null);

  // Escape closes; the page behind stops scrolling; focus starts on Done and goes back after.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    done.current?.focus({ preventScroll: true });
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); closeRef.current(); } };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (before && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, []);

  // Swipe the top bar down to close, the way a phone's own sheets close.
  const onDown = (e: ReactPointerEvent) => { if (e.pointerType === "mouse") return; press.current = { y: e.clientY, id: e.pointerId }; };
  const onMove = (e: ReactPointerEvent) => { const p = press.current; if (!p || p.id !== e.pointerId) return; setDrag(Math.max(0, e.clientY - p.y)); };
  const onUp = () => { if (!press.current) return; press.current = null; if (drag > 90) closeRef.current(); setDrag(0); };

  const current = tabs.find((t) => t.id === tab) ?? tabs[0];
  // Drawn inside the hub (not moved to <body>) so the hub's night mode and theme style it too.
  return (
    <div className="fixed inset-0 kb-sheet z-[500] flex items-end justify-center bg-[#16152a]/60 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid={testId}>
      <div role="dialog" aria-modal="true" aria-label={`${eyebrow} ${title}`}
        className="flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-[1.5rem] bg-white text-slate-900 shadow-2xl sm:h-[min(86dvh,760px)] sm:max-w-4xl sm:rounded-[1.5rem]"
        style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : { transition: "transform .18s ease" }}>
        {/* Top bar: always on screen. Swipe it down (phone) or press Done to close. */}
        <div className="shrink-0 touch-none border-b border-slate-100" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden" aria-hidden />
          <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-2 sm:px-6 sm:pt-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[.15em] text-violet-600">{eyebrow}</p>
              <h2 className="text-xl font-black leading-tight">{title}</h2>
            </div>
            <button ref={done} type="button" onClick={onClose} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white" style={{ background: dark }} data-testid="customize-done">
              <Check className="h-4 w-4" /> Done
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Tabs: a row to swipe through on a phone, a list down the side on a bigger screen. */}
          <nav aria-label={`${title} sections`} className="shrink-0 border-b border-slate-100 sm:w-52 sm:border-b-0 sm:border-r sm:bg-slate-50/60">
            <div role="tablist" aria-orientation="horizontal" className="flex gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] sm:flex-col sm:overflow-visible sm:p-3">
              {tabs.map((t) => {
                const on = t.id === current?.id;
                return <button key={t.id} type="button" role="tab" aria-selected={on} aria-controls="customize-panel" onClick={() => setTab(t.id)} data-testid={`customize-tab-${t.id}`}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-bold transition sm:w-full ${on ? "text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  style={on ? { background: dark } : undefined}>
                  <span className="[&>svg]:h-4 [&>svg]:w-4" aria-hidden>{t.icon}</span>{t.label}
                </button>;
              })}
            </div>
          </nav>
          <div ref={body} id="customize-panel" role="tabpanel" aria-label={current?.label} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
            <div className="mx-auto max-w-2xl space-y-7">{current?.content}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A heading and a line of help over one group of choices, the same in every tab. */
export function CustomizeGroup({ title, help, children, testId }: { title: string; help?: string; children: ReactNode; testId?: string }) {
  return <section data-testid={testId}>
    <h3 className="text-sm font-black text-slate-900">{title}</h3>
    {help && <p className="mb-3 mt-1 text-sm text-slate-500">{help}</p>}
    {!help && <div className="mb-3" />}
    {children}
  </section>;
}
