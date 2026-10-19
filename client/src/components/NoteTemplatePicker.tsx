// Choosing a note template (shared/noteTemplates.ts): search or browse by category, look at the outline,
// then start a note from it. The same chooser is used in LifeHub Notes, the Notes apps and WorkHub Notes.
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, LayoutTemplate, Search, X } from "lucide-react";
import { NOTE_TEMPLATE_CATEGORIES, fillTemplate, findTemplates, type NoteTemplate, type NoteTemplateCategory } from "@shared/noteTemplates";

export type PickedTemplate = { title: string; body: string; template: NoteTemplate };

export function NoteTemplatesButton({ onPick, hub, className = "" }: { onPick: (picked: PickedTemplate) => void; hub?: "work" | "life"; className?: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 ${className}`} data-testid="note-templates">
      <LayoutTemplate size={17} /> Templates
    </button>
    {open && <NoteTemplatePicker hub={hub} onClose={() => setOpen(false)} onPick={(p) => { setOpen(false); onPick(p); }} />}
  </>;
}

export default function NoteTemplatePicker({ onPick, onClose, hub }: { onPick: (picked: PickedTemplate) => void; onClose: () => void; hub?: "work" | "life" }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<NoteTemplateCategory | null>(null);
  const [looking, setLooking] = useState<NoteTemplate | null>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { if (looking) setLooking(null); else onClose(); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [looking, onClose]);
  const list = useMemo(() => findTemplates({ query, category, hub }), [query, category, hub]);
  // Browsing everything with no search: grouped by category, with this hub's kind of notes first.
  const grouped = !query.trim() && !category;
  const order = useMemo(() => {
    const cats = [...NOTE_TEMPLATE_CATEGORIES];
    if (hub === "work") cats.sort((a, b) => Number(b === "Meetings" || b === "School & teaching") - Number(a === "Meetings" || a === "School & teaching"));
    return cats;
  }, [hub]);
  const use = (tpl: NoteTemplate) => onPick({ title: fillTemplate(tpl.title).slice(0, 120), body: fillTemplate(tpl.body).slice(0, 5000), template: tpl });

  const card = (tpl: NoteTemplate) => <li key={tpl.id}><button type="button" onClick={() => setLooking(tpl)}
    className="flex h-full w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-sm" data-testid={`template-${tpl.id}`}>
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xl" aria-hidden>{tpl.emoji}</span>
    <span className="min-w-0"><span className="block text-sm font-extrabold text-slate-900">{tpl.name}</span><span className="mt-0.5 block text-xs leading-snug text-slate-500">{tpl.blurb}</span></span>
  </button></li>;

  return <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label="Note templates" onClick={(e) => e.stopPropagation()}
      className="flex h-[88dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[1.75rem] bg-slate-50 text-slate-800 shadow-2xl sm:h-[min(88dvh,760px)] sm:rounded-[1.75rem]" data-testid="note-template-picker">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
        {looking
          ? <button type="button" onClick={() => setLooking(null)} className="inline-flex h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"><ArrowLeft size={16} /> All templates</button>
          : <div className="min-w-0 flex-1"><h2 className="text-lg font-black tracking-tight text-slate-900">Start from a template</h2><p className="text-xs text-slate-500">{list.length} templates. Pick one, then change anything you like.</p></div>}
        <button type="button" onClick={onClose} aria-label="Close" className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X size={18} /></button>
      </div>

      {looking ? <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="flex items-center gap-3"><span className="text-3xl" aria-hidden>{looking.emoji}</span><div><p className="text-xs font-bold uppercase tracking-[.14em] text-violet-600">{looking.category}</p><h3 className="text-xl font-black text-slate-900">{looking.name}</h3></div></div>
          <p className="mt-2 text-sm text-slate-500">{looking.blurb}</p>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-base font-black text-slate-900">{fillTemplate(looking.title)}</p>
            <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-700">{fillTemplate(looking.body)}</pre>
          </div>
        </div>
        <div className="border-t border-slate-200 bg-white p-4">
          <button type="button" onClick={() => use(looking)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 text-base font-extrabold text-white hover:bg-violet-700" data-testid="template-use">Use this template</button>
        </div>
      </div> : <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 space-y-3 bg-slate-50/95 px-4 pb-3 pt-4 backdrop-blur sm:px-5">
          <div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search: meeting, food, packing, IEP…" aria-label="Search templates" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-violet-400" />
          </div>
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-5 sm:px-5 [&::-webkit-scrollbar]:hidden">
            <button type="button" onClick={() => setCategory(null)} aria-pressed={!category} className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-bold ${!category ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>All</button>
            {order.map((c) => <button key={c} type="button" onClick={() => setCategory(c === category ? null : c)} aria-pressed={category === c} className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-bold ${category === c ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{c}</button>)}
          </div>
        </div>
        <div className="space-y-6 px-4 pb-6 sm:px-5">
          {grouped
            ? order.map((c) => { const inCat = list.filter((tpl) => tpl.category === c); return inCat.length ? <section key={c}><h3 className="mb-2 text-xs font-extrabold uppercase tracking-[.14em] text-slate-500">{c}</h3><ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{inCat.map(card)}</ul></section> : null; })
            : list.length ? <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{list.map(card)}</ul>
              : <p className="py-10 text-center text-sm text-slate-500">No templates match “{query}”. Try a shorter word.</p>}
        </div>
      </div>}
    </div>
  </div>;
}
