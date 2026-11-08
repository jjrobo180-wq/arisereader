// Arise Notes' bottom bar (November 2026): the same floating dark pill as Arise To Duo's (family-hub/PhoneTabBar.tsx).
// Home, Notes, a round + in the middle (Record, Upload, Voice memo, a new note, Ask AI), Ask, and You (the menu).
// Every look uses it, so the app feels like one family with To Duo. The + takes the look's own accent color.
import { useEffect, useRef, useState } from "react";
import { AudioLines, Home, Mic, Pencil, Plus, Sparkles, Upload } from "lucide-react";

export type DockGo = { home: () => void; notes: () => void; record: () => void; upload: () => void; memo: () => void; newNote: () => void; ask: () => void; menu: () => void };

export function NotesDock({ on, initial, go }: { on: "ai" | "pages" | "ask" | "menu"; initial: string; go: DockGo }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const tab = (active: boolean) => `relative flex min-h-12 min-w-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold tracking-wide transition active:scale-90 ${active ? "text-white" : "text-white/55"}`;
  const pick = (f: () => void) => () => { setOpen(false); f(); };
  const items: [string, string, JSX.Element, () => void][] = [
    ["record", "Record", <Mic key="r" className="h-[18px] w-[18px]" />, go.record],
    ["upload", "Upload a recording", <Upload key="u" className="h-[18px] w-[18px]" />, go.upload],
    ["memo", "Voice memo", <AudioLines key="m" className="h-[18px] w-[18px]" />, go.memo],
    ["note", "New note", <Pencil key="n" className="h-[18px] w-[18px]" />, go.newNote],
    ["ask", "Ask AI about your notes", <Sparkles key="a" className="h-[18px] w-[18px]" />, go.ask],
  ];
  return <div ref={ref} className="an-noprint">
    {open && <div role="menu" aria-label="Add" data-testid="notes-dock-menu" className="fixed inset-x-3 z-[46] mx-auto max-w-[17rem] overflow-hidden rounded-2xl bg-[#1d1a33] p-1.5 text-white shadow-[0_18px_40px_#16152a66] ring-1 ring-white/10" style={{ bottom: "calc(max(0.75rem, env(safe-area-inset-bottom)) + 4.4rem)" }}>
      {items.map(([id, label, icon, f]) => <button key={id} type="button" role="menuitem" onClick={pick(f)} data-testid={`notes-dock-${id}`} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[14px] font-semibold hover:bg-white/10">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10">{icon}</span>{label}</button>)}
    </div>}
    <nav aria-label="Arise Notes" data-testid="notes-tabs"
      className="fixed inset-x-3 z-[45] mx-auto flex max-w-md items-center gap-1 rounded-full bg-[#1d1a33] px-2 py-1.5 shadow-[0_12px_32px_#16152a55] ring-1 ring-white/10"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <button type="button" onClick={pick(go.home)} aria-current={on === "ai" ? "page" : undefined} className={tab(on === "ai")} data-testid="notes-tab-ai"><Home className="h-[21px] w-[21px]" />Home</button>
      <button type="button" onClick={pick(go.notes)} aria-current={on === "pages" ? "page" : undefined} className={tab(on === "pages")} data-testid="notes-tab-pages"><Pencil className="h-[21px] w-[21px]" />Notes</button>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Add" aria-haspopup="menu" aria-expanded={open} data-testid="notes-tab-record"
        className="mx-1 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-md transition active:scale-90" style={{ background: "var(--an-violet, #7968e5)", color: "var(--an-on-accent, #fff)" }}>
        <Plus className={`h-6 w-6 transition-transform ${open ? "rotate-45" : ""}`} />
      </button>
      <button type="button" onClick={pick(go.ask)} aria-current={on === "ask" ? "page" : undefined} className={tab(on === "ask")} data-testid="notes-tab-ask"><Sparkles className="h-[21px] w-[21px]" />Ask</button>
      <button type="button" onClick={pick(go.menu)} aria-current={on === "menu" ? "page" : undefined} className={tab(on === "menu")} data-testid="notes-tab-menu">
        <span className="inline-flex h-[21px] w-[21px] items-center justify-center rounded-full bg-white text-[11px] font-black text-[#1d1a33]">{initial}</span>You
      </button>
    </nav>
  </div>;
}
