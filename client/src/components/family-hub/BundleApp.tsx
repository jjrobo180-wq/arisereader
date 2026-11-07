// One plugin with the old ones inside it as pages (shared/appBundles.ts): Health Lite, Journal & Inspiration, Kitchen.
// The first time it opens, "Pick your tools" lets the person choose their pages; a settings button changes it later.
import { useState, type ReactNode } from "react";
import { Check, Settings2, Sparkles, X } from "lucide-react";
import KitPlugin from "@/components/plugin-kit/KitPlugin";
import { isKitLifeId, kitDef } from "@shared/pluginKit";
import { bundleOf, bundleMembers, memberInfo, type BundleId } from "@shared/appBundles";
import type { FamilySection } from "@shared/familyHub";
import { LIFE_VIEWS } from "./lifeApps";
import { SECTION_INFO } from "./Members";
import KitchenShop from "./KitchenShop";
import KitchenPlan from "./KitchenPlan";
import { Modal, plain, primary, type SectionProps } from "./ui";

const labelOf = (bundle: NonNullable<ReturnType<typeof bundleOf>>, id: FamilySection) => memberInfo(bundle, id)?.label ?? SECTION_INFO[id]?.label ?? id;

export default function BundleApp({ bundleId, ...p }: SectionProps & { bundleId: BundleId }) {
  const bundle = bundleOf(bundleId)!;
  const { family, setFamily } = p;
  const optional = bundle.groups.flatMap((g) => g.members.map((m) => m.id));
  const picked = optional.filter((id) => family.sections[id] === true);
  const pages: FamilySection[] = [...bundle.fixed, ...picked];
  const asked = family.bundleSet?.[bundleId] === true || picked.length > 0;
  const [picker, setPicker] = useState(!asked && bundle.fixed.length === 0);
  const [tab, setTab] = useState<FamilySection | null>(null);
  const [draft, setDraft] = useState<Set<string>>(() => new Set(picked));
  const open = () => { setDraft(new Set(picked)); setPicker(true); };
  const save = () => {
    setFamily((f) => {
      const sections = { ...f.sections };
      for (const id of optional) sections[id] = draft.has(id);
      sections[bundleId] = true;
      return { ...f, sections, bundleSet: { ...(f.bundleSet ?? {}), [bundleId]: true } };
    });
    setPicker(false);
  };
  const current = tab && pages.includes(tab) ? tab : pages[0] ?? null;
  const body = (id: FamilySection): ReactNode => {
    if (id === "grocery") return <KitchenShop {...p} />;
    if (id === "meals") return <KitchenPlan {...p} />;
    if (LIFE_VIEWS[id]) return LIFE_VIEWS[id]!(p);
    if (isKitLifeId(id) && kitDef(id)) return <KitPlugin key={id} def={kitDef(id)!} records={family.kit} setRecords={(update) => setFamily((f) => ({ ...f, kit: update(f.kit) }))} today={p.today} makeId={p.makeId} say={p.say} />;
    return null;
  };
  const tabLabel = (id: FamilySection) => id === "grocery" ? "Shopping list" : id === "meals" ? "Plan" : id === "recipes" ? "Recipes" : labelOf(bundle, id);

  return <div className="space-y-4" data-testid={`bundle-${bundleId}`}>
    {bundle.promo && <a href={bundle.promo.href} target="_blank" rel="noreferrer" data-testid="bundle-promo" className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-3 text-white shadow-sm">
      <Sparkles size={18} className="shrink-0" />
      <span className="min-w-0 flex-1 text-xs leading-snug"><b className="block text-sm">{bundle.promo.title}</b>{bundle.promo.body}</span>
      <span className="shrink-0 rounded-full bg-white/95 px-3 py-1.5 text-xs font-black text-violet-700">{bundle.promo.cta}</span>
    </a>}
    <div className="flex items-center gap-2">
      <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto" role="tablist" aria-label={bundle.name}>
        {pages.map((id) => <button key={id} type="button" role="tab" aria-selected={id === current} onClick={() => setTab(id)} className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-bold transition ${id === current ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{tabLabel(id)}</button>)}
      </div>
      <button type="button" onClick={open} aria-label={`${bundle.name} settings`} data-testid="bundle-settings" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><Settings2 size={17} /></button>
    </div>
    {current ? <div key={current}>{body(current)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
      <p className="text-sm font-semibold text-slate-600">Nothing picked yet.</p>
      <button type="button" onClick={open} className={`${primary} mt-3`}>Pick your tools</button>
    </div>}
    {picker && <Modal title={bundle.pickerTitle} eyebrow={bundle.name} onClose={() => (asked ? setPicker(false) : save())}>
      <p className="mb-4 text-sm text-slate-500">{bundle.pickerIntro}</p>
      <div className="space-y-5">
        {bundle.groups.map((g) => <div key={g.title}>
          <p className="mb-1.5 text-[11px] font-black uppercase tracking-[.12em] text-slate-500">{g.title}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {g.members.map((m) => { const on = draft.has(m.id); return <button key={m.id} type="button" aria-pressed={on} onClick={() => setDraft((d) => { const n = new Set(d); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })}
              className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${on ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${on ? "bg-[#6e5ae0] text-white" : "border-2 border-slate-300 text-transparent"}`}><Check size={14} /></span>
              <span className="min-w-0"><span className="block text-sm font-bold text-slate-800">{labelOf(bundle, m.id)}</span>{m.detail && <span className="block text-xs text-slate-500">{m.detail}</span>}</span>
            </button>; })}
          </div>
        </div>)}
      </div>
      <div className="mt-6 flex gap-2">
        {asked && <button type="button" onClick={() => setPicker(false)} className={`${plain} flex-1`}><X size={16} />Cancel</button>}
        <button type="button" onClick={save} className={`${primary} flex-1`} data-testid="bundle-save">Done</button>
      </div>
    </Modal>}
  </div>;
}
export { bundleMembers };
