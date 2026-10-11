// Arise LifeHub: the menu on a phone, placed the way the family chose in Customize, with the same choices as
// WorkHub: a strip down the left or right side (scrolls up and down), a bar across the top or bottom, or an
// app drawer (a round button that opens every section as app icons, with search). It can close with a Hide
// button, by itself once a section is picked, or never. On a computer (lg and up) the sidebar is used instead.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, LayoutGrid, Search, X } from "lucide-react";
import type { MenuClose, MenuSide } from "@shared/hubLayout";

export type PhoneMenuItem = { id: string; label: string; icon: ReactNode; active: boolean; badge?: number; color?: string; onClick: () => void };

const KEY = "arise-life-rail";

/** Whether the phone menu is showing, remembered on this device, and what the page must leave room for. */
export function usePhoneMenu(side: MenuSide, close: MenuClose) {
  const [rail, setRailState] = useState(() => { try { return localStorage.getItem(KEY) !== "closed"; } catch { return true; } });
  const setRail = (open: boolean) => { setRailState(open); try { localStorage.setItem(KEY, open ? "open" : "closed"); } catch { /* not remembered */ } };
  const open = side !== "drawer" && (close === "always" || rail);
  /** Room the page leaves for the menu on a phone (nothing on a computer). */
  const pad = side === "drawer" ? "" : side === "left" ? (open ? "max-lg:pl-[80px]" : "max-lg:pl-9") : side === "right" ? (open ? "max-lg:pr-[80px]" : "max-lg:pr-9")
    : side === "top" ? (open ? "max-lg:pt-[76px]" : "max-lg:pt-6") : open ? "max-lg:pb-[92px]" : "";
  /** On a phone the menu may close by itself once a section is picked. */
  const afterPick = () => { if (close === "auto" && typeof window !== "undefined" && window.innerWidth < 1024) setRail(false); };
  return { open, setRail, pad, afterPick };
}

/** The phone menu itself. `top` is how far below the top of the screen it starts (under the header). */
export function PhoneMenu({ items, side, close, open, setRail, afterPick, top = 65 }: {
  items: PhoneMenuItem[]; side: MenuSide; close: MenuClose; open: boolean; setRail: (open: boolean) => void; afterPick: () => void; top?: number;
}) {
  const [apps, setApps] = useState(false);
  const [query, setQuery] = useState("");
  const swipe = useRef<number | null>(null);
  useEffect(() => {
    if (!apps) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setApps(false); };
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = overflow; setQuery(""); };
  }, [apps]);
  const pick = (item: PhoneMenuItem) => { item.onClick(); afterPick(); };
  const across = side === "top" || side === "bottom";
  const canHide = close !== "always";
  const badge = (n?: number) => (n ? <span className="absolute right-1 top-0.5 min-w-[16px] rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-4 text-white">{n > 99 ? "99+" : n}</span> : null);

  if (side === "drawer") {
    const shown = items.filter((i) => i.label.toLowerCase().includes(query.trim().toLowerCase()));
    return <>
      {!apps && <button type="button" onClick={() => setApps(true)} aria-label="Open all sections" data-testid="life-apps-open"
        onTouchStart={(e) => { swipe.current = e.touches[0].clientY; }} onTouchMove={(e) => { if (swipe.current !== null && swipe.current - e.touches[0].clientY > 30) { swipe.current = null; setApps(true); } }}
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-40 inline-flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-[#292446] text-white shadow-xl transition active:scale-90 lg:hidden"><LayoutGrid className="h-6 w-6" /></button>}
      <div className={`fixed inset-0 z-[480] lg:hidden ${apps ? "" : "pointer-events-none"}`} aria-hidden={!apps}>
        <div className={`absolute inset-0 bg-slate-950/30 transition-opacity duration-200 ${apps ? "opacity-100" : "opacity-0"}`} onClick={() => setApps(false)} />
        <div role="dialog" aria-modal="true" aria-label="All sections" data-testid="life-apps"
          className={`absolute inset-x-0 bottom-0 top-[max(2.5rem,env(safe-area-inset-top))] flex flex-col rounded-t-[2rem] bg-white shadow-2xl transition-transform duration-300 ease-out ${apps ? "translate-y-0" : "translate-y-full"}`}
          onTouchStart={(e) => { swipe.current = e.touches[0].clientY; }}
          onTouchEnd={(e) => { const from = swipe.current; swipe.current = null; const list = document.getElementById("life-apps-list"); if (from !== null && e.changedTouches[0].clientY - from > 90 && (!list || list.scrollTop <= 0)) setApps(false); }}>
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-300" aria-hidden />
          <div className="flex items-center gap-2 px-4 pb-3 pt-3">
            <label className="flex min-h-11 flex-1 items-center gap-2 rounded-2xl bg-slate-100 px-3"><Search className="h-4 w-4 shrink-0 text-slate-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search sections" tabIndex={apps ? 0 : -1} className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-500" /></label>
            <button type="button" onClick={() => setApps(false)} aria-label="Close" tabIndex={apps ? 0 : -1} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
          </div>
          <ul id="life-apps-list" className="grid flex-1 grid-cols-4 content-start gap-x-2 gap-y-5 overflow-y-auto overscroll-contain px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1">
            {shown.map((item) => <li key={item.id}>
              <button type="button" tabIndex={apps ? 0 : -1} onClick={() => { item.onClick(); setApps(false); }} data-testid={`life-app-${item.id}`} className="relative flex w-full flex-col items-center gap-1.5 rounded-2xl p-1 text-center transition active:scale-90">
                <span className={`inline-flex h-14 w-14 items-center justify-center rounded-[1.1rem] text-white shadow-sm [&_svg]:h-7 [&_svg]:w-7 ${item.active ? "bg-[#7968e5]" : "bg-[#292446]"}`} style={item.color && !item.active ? { backgroundColor: item.color } : undefined}>{item.icon}</span>
                {badge(item.badge)}
                <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-800">{item.label}</span>
              </button>
            </li>)}
          </ul>
        </div>
      </div>
    </>;
  }

  const place = side === "top" ? `inset-x-0 border-b px-2 py-1.5 ${open ? "translate-y-0" : "-translate-y-[150%]"}`
    : side === "bottom" ? `inset-x-0 bottom-0 border-t px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] ${open ? "translate-y-0" : "translate-y-full"}`
    : `bottom-0 w-[72px] pb-[max(0.5rem,env(safe-area-inset-bottom))] ${side === "right" ? "right-0 border-l" : "left-0 border-r"} ${open ? "translate-x-0" : side === "right" ? "translate-x-full" : "-translate-x-full"}`;
  const hideIcon = side === "top" ? <ChevronUp className="h-5 w-5" /> : side === "bottom" ? <ChevronDown className="h-5 w-5" /> : side === "right" ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />;
  const showIcon = side === "top" ? <ChevronDown className="h-5 w-5" /> : side === "bottom" ? <ChevronUp className="h-5 w-5" /> : side === "right" ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />;
  const tabPlace = side === "top" ? "left-1/2 h-7 w-14 -translate-x-1/2 rounded-b-xl border-t-0" : side === "bottom" ? "bottom-0 left-1/2 h-7 w-14 -translate-x-1/2 rounded-t-xl border-b-0 pb-[env(safe-area-inset-bottom)]"
    : side === "right" ? "right-0 h-14 w-7 rounded-l-xl border-r-0" : "left-0 h-14 w-7 rounded-r-xl border-l-0";

  return <>
    {!open && <button type="button" onClick={() => setRail(true)} aria-label="Show menu" data-testid="life-rail-show"
      className={`fixed z-30 inline-flex items-center justify-center border border-slate-200 bg-white text-slate-600 shadow-md lg:hidden ${tabPlace}`} style={side === "bottom" ? undefined : { top: side === "top" ? top : top + 12 }}>{showIcon}</button>}
    <nav aria-label="LifeHub menu" aria-hidden={open ? undefined : true} data-testid="life-phone-menu"
      className={`fixed z-30 border-slate-200 bg-white/95 backdrop-blur transition-transform duration-200 lg:hidden ${place}`} style={side === "bottom" ? undefined : { top }}>
      <div className={`flex ${across ? "snap-x gap-1 overflow-x-auto" : "h-full touch-pan-y flex-col gap-1 overflow-y-auto overscroll-contain px-1 py-1.5"} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
        {canHide && <button type="button" onClick={() => setRail(false)} aria-label="Hide menu" tabIndex={open ? 0 : -1} data-testid="life-rail-hide"
          className={`flex min-h-11 ${across ? "min-w-11 px-2" : "w-full"} shrink-0 flex-col items-center justify-center rounded-xl text-[10px] font-semibold text-slate-500 hover:bg-slate-100`}>{hideIcon}Hide</button>}
        {items.map((item) => <button key={item.id} type="button" onClick={() => pick(item)} aria-current={item.active ? "page" : undefined} tabIndex={open ? 0 : -1} data-testid={`life-menu-${item.id}`}
          className={`relative flex min-h-[52px] ${across ? "min-w-[64px] snap-start" : "w-full"} shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1 text-center text-[10px] font-semibold transition ${item.active ? "bg-[#292446] text-white" : "text-slate-500 hover:text-slate-900"}`}>
          <span className="[&_svg]:h-5 [&_svg]:w-5">{item.icon}</span>
          <span className={`${across ? "max-w-[72px]" : "max-w-[62px]"} truncate`}>{item.label}</span>
          {badge(item.badge)}
        </button>)}
      </div>
    </nav>
  </>;
}
