// The Arise Plugin Store: browse and add plugins to Arise WorkHub or Arise LifeHub, like Notion's.
// The catalog and the rules for adding live in shared/pluginStore.ts; the hub that opens the store
// says what is added and saves the change itself, so it syncs like every other change in the hub.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Apple, ArrowLeft, ArrowUpRight, BellRing, BookOpenCheck, Briefcase, Calculator, CalendarDays, CalendarPlus, CalendarRange, Check, CheckSquare,
  ClipboardCheck, Clock, Droplets, Forward, GraduationCap, Handshake, HeartPulse, History, Hourglass, Landmark, LayoutGrid, Mail, MessageCircle, Newspaper, NotebookPen, Pill, Plane,
  Plus, Puzzle, Quote, Search, ShoppingCart, Smile, SmilePlus, Sparkles, StickyNote, Target, Timer, TrendingUp, Users, Vote, Wallet, Wind, X, Shuffle, HeartHandshake, BookOpenText, Link2, type LucideIcon,
} from "lucide-react";
import { ArrowLeftRight as ArrowLeftRightTile, BookOpen as BookOpenTile, Cake as CakeTile, Car as CarTile, ChefHat as ChefHatTile, CloudSun as CloudSunTile, CreditCard as CreditCardTile, Flower2 as Flower2Tile, Gift as GiftTile, Heart as HeartTile, Mountain as MountainTile, PawPrint as PawPrintTile, Phone as PhoneTile, PiggyBank as PiggyBankTile, Repeat as RepeatTile, Tv as TvTile, UtensilsCrossed as UtensilsCrossedTile, Wrench as WrenchTile } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import HubMark from "@/components/HubMark";
import {
  PLUGIN_CATEGORIES, connectionNeeds, isAddable, pluginsFor, searchPlugins, OPEN_STORE_KEY, type Plugin, type PluginHub,
} from "@shared/pluginStore";

const ICONS: Record<string, LucideIcon> = {
  Apple, BellRing, BookOpenCheck, Briefcase, Calculator, CalendarDays, CalendarPlus, CalendarRange, CheckSquare, ClipboardCheck, Clock, Droplets, Forward,
  GraduationCap, Handshake, HeartPulse, Landmark, Mail, MessageCircle, Newspaper, Pill, Plane, Smile, SmilePlus, Sparkles, StickyNote, Target, Timer,
  Users, Vote, Wallet, NotebookPen, Hourglass, ShoppingCart, Wind, Quote, History, TrendingUp, Shuffle, HeartHandshake, BookOpenText, Link2,
  ArrowLeftRight: ArrowLeftRightTile, BookOpen: BookOpenTile, Cake: CakeTile, Car: CarTile, ChefHat: ChefHatTile, CloudSun: CloudSunTile, CreditCard: CreditCardTile, Flower2: Flower2Tile, Gift: GiftTile, Heart: HeartTile, Mountain: MountainTile, PawPrint: PawPrintTile, Phone: PhoneTile, PiggyBank: PiggyBankTile, Repeat: RepeatTile, Tv: TvTile, UtensilsCrossed: UtensilsCrossedTile, Wrench: WrenchTile,
};

/**
 * Scrolls to a connection's setup box once the hub has drawn it (the tab or section opens first),
 * opens it if it folds, and outlines it for a moment so it's easy to spot.
 */
export function goToSetup(selector: string, tries = 40) {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) { if (tries > 0) window.setTimeout(() => goToSetup(selector, tries - 1), 100); return; }
  if (el instanceof HTMLDetailsElement) el.open = true;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const before = { outline: el.style.outline, offset: el.style.outlineOffset, radius: el.style.borderRadius, transition: el.style.transition };
  el.style.transition = "outline-color .4s";
  el.style.outline = "3px solid #7c6be6";
  el.style.outlineOffset = "4px";
  if (!el.style.borderRadius) el.style.borderRadius = "1rem";
  window.setTimeout(() => { el.style.outline = before.outline; el.style.outlineOffset = before.offset; el.style.borderRadius = before.radius; el.style.transition = before.transition; }, 2600);
}

const HUB_NAME: Record<PluginHub, string> = { work: "WorkHub", life: "LifeHub" };
const ACCENT: Record<PluginHub, { solid: string; soft: string; text: string; ring: string }> = {
  work: { solid: "bg-teal-700 hover:bg-teal-800 text-white", soft: "bg-teal-50 text-teal-800", text: "text-teal-700", ring: "focus-visible:ring-teal-600" },
  life: { solid: "bg-[#705de0] hover:bg-[#604bd4] text-white", soft: "bg-[#f1eeff] text-[#5f4dc8]", text: "text-[#6854cf]", ring: "focus-visible:ring-violet-600" },
};

type AppAccess = Partial<Record<"history" | "math" | "social", boolean>>;

export type PluginStoreProps = {
  hub: PluginHub;
  /** Teachers (and admins) have both hubs and see the teacher-only plugins. */
  teacher: boolean;
  isInstalled: (p: Plugin) => boolean;
  /** Adds or removes a tab or section plugin. The hub saves it. */
  onToggle: (p: Plugin, on: boolean) => void;
  /** Opens the plugin's tab or section in the hub (and closes the store). */
  onOpen: (p: Plugin) => void;
  onClose: () => void;
};

function Tile({ p, size = "md" }: { p: Plugin; size?: "md" | "lg" }) {
  const Icon = ICONS[p.icon] ?? Puzzle;
  const box = size === "lg" ? "h-16 w-16 rounded-2xl" : "h-11 w-11 rounded-xl";
  return <span className={`flex shrink-0 items-center justify-center text-white shadow-sm ${box}`} style={{ background: p.color }} aria-hidden>
    <Icon className={size === "lg" ? "h-8 w-8" : "h-5 w-5"} />
  </span>;
}

export default function PluginStore({ hub, teacher, isInstalled, onToggle, onOpen, onClose }: PluginStoreProps) {
  const { token } = useAuth();
  const a = ACCENT[hub];
  const [view, setView] = useState<"discover" | "installed">("discover");
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [apps, setApps] = useState<AppAccess | null>(null);
  const [note, setNote] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  // The hub redraws often (clocks, saving), so the latest close and open-detail live in refs
  // and the effects below run once, not on every redraw.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const openIdRef = useRef(openId);
  openIdRef.current = openId;

  const all = useMemo(() => pluginsFor(hub, { teacher }), [hub, teacher]);
  const open = all.find((p) => p.id === openId) ?? null;

  // Whether the Arise apps are already included, so the card can say Open rather than See plans.
  useEffect(() => {
    if (!token) return;
    let gone = false;
    fetch(`${API_BASE}/api/addons`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!gone && d?.apps) setApps({ history: !!d.apps.history?.access, math: !!d.apps.math?.access, social: !!d.apps.social?.access }); })
      .catch(() => { /* the cards just say Open */ });
    return () => { gone = true; };
  }, [token]);

  // Escape closes the detail first, then the store. The page behind doesn't scroll.
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); if (openIdRef.current) setOpenId(null); else onCloseRef.current(); };
    window.addEventListener("keydown", key, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => { window.removeEventListener("keydown", key, true); document.body.style.overflow = overflow; };
  }, []);

  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(""), 3500); return () => clearTimeout(t); }, [note]);

  const shown = useMemo(() => {
    let list = searchPlugins(all, query);
    if (view === "installed") list = list.filter((p) => isAddable(p) && isInstalled(p));
    if (category) list = list.filter((p) => p.category === category);
    return list;
  }, [all, query, view, category, isInstalled]);

  const installedCount = all.filter((p) => isAddable(p) && isInstalled(p)).length;
  const browsing = view === "discover" && !category && !query.trim();
  const featured = all.filter((p) => p.featured);

  const toggle = (p: Plugin, on: boolean) => {
    onToggle(p, on);
    setNote(on ? `${p.name} was added to your ${HUB_NAME[hub]}.` : `${p.name} was removed. Nothing in it was deleted: add it back any time.`);
  };

  const switchHub = () => {
    try { sessionStorage.setItem(OPEN_STORE_KEY, "1"); } catch { /* the other hub just opens normally */ }
    window.location.hash = hub === "work" ? "#/lifehub" : "#/workhub";
  };

  /** The button on a card or the detail page. */
  const action = (p: Plugin, big?: boolean) => {
    const pad = big ? "min-h-11 px-5 text-sm" : "min-h-9 px-3 text-xs";
    const base = `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl font-bold transition focus-visible:outline-none focus-visible:ring-2 ${a.ring} ${pad}`;
    const t = p.target;
    if (t.kind === "app") {
      const has = apps?.[t.app] ?? true;
      return has
        ? <a href={t.href} className={`${base} bg-slate-100 text-slate-800 hover:bg-slate-200`} onClick={(e) => e.stopPropagation()}>Open <ArrowUpRight className="h-3.5 w-3.5" /></a>
        : <a href="/#/billing" className={`${base} ${a.solid}`} onClick={(e) => e.stopPropagation()}>See plans</a>;
    }
    if (t.kind === "connection") {
      const need = connectionNeeds(p);
      if (need && !isInstalled(need)) {
        return <button type="button" className={`${base} ${a.solid}`} onClick={(e) => { e.stopPropagation(); toggle(need, true); }}><Plus className="h-3.5 w-3.5" />Add {need.name}</button>;
      }
      // Set up explains the steps first; the popup's own button then goes to the place to do them.
      if (big) return <button type="button" className={`${base} ${a.solid}`} onClick={(e) => { e.stopPropagation(); onOpen(p); if (p.anchor) goToSetup(p.anchor); }} data-testid="plugin-start-setup">Start setup <ArrowUpRight className="h-3.5 w-3.5" /></button>;
      return <button type="button" className={`${base} bg-slate-100 text-slate-800 hover:bg-slate-200`} onClick={(e) => { e.stopPropagation(); setOpenId(p.id); }} data-testid={`plugin-setup-${p.id}`}>Set up</button>;
    }
    const on = isInstalled(p);
    return on
      ? <button type="button" className={`${base} ${a.soft}`} onClick={(e) => { e.stopPropagation(); if (big) toggle(p, false); else setOpenId(p.id); }} aria-label={big ? `Remove ${p.name}` : `${p.name} is added. Open details`} data-testid={`plugin-added-${p.id}`}>
          <Check className="h-3.5 w-3.5" />{big ? "Remove" : "Added"}
        </button>
      : <button type="button" className={`${base} ${a.solid}`} onClick={(e) => { e.stopPropagation(); toggle(p, true); }} data-testid={`plugin-add-${p.id}`}><Plus className="h-3.5 w-3.5" />Add</button>;
  };

  const card = (p: Plugin) => (
    <li key={p.id}>
      <div role="button" tabIndex={0} onClick={() => setOpenId(p.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(p.id); } }}
        className={`flex h-full cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 ${a.ring}`}
        data-testid={`plugin-${p.id}`}>
        <Tile p={p} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-slate-900">{p.name}</span>
          <span className="block truncate text-xs text-slate-500">{p.tagline}</span>
        </span>
        {action(p)}
      </div>
    </li>
  );

  const categories = PLUGIN_CATEGORIES[hub].filter((c) => all.some((p) => p.category === c));

  return <div className="fixed inset-0 z-[80] flex flex-col bg-[#f7f7fa] text-slate-900" role="dialog" aria-modal="true" aria-label={`Arise Plugin Store for ${HUB_NAME[hub]}`} data-testid="plugin-store">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-3 sm:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"><Puzzle className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-extrabold uppercase tracking-[.16em] text-slate-400">Arise</span>
          <span className="block truncate text-lg font-black leading-tight tracking-tight">Plugin Store</span>
        </span>
        {teacher && <nav aria-label="Which hub" className="inline-flex shrink-0 items-center gap-0.5 rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">
          {(["work", "life"] as const).map((h) => <button key={h} type="button" onClick={h === hub ? undefined : switchHub} aria-current={h === hub ? "page" : undefined}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition sm:px-3 ${h === hub ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}>
            <HubMark tone={h} className="h-[15px] w-[15px] shrink-0" /><span className="hidden sm:inline">{HUB_NAME[h]}</span>
          </button>)}
        </nav>}
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close the Plugin Store" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900" data-testid="plugin-store-close"><X className="h-5 w-5" /></button>
      </div>
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-2 px-4 pb-3 sm:px-6">
        <label className="relative min-w-0 flex-1 basis-60">
          <span className="sr-only">Search plugins</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${HUB_NAME[hub]} plugins`} className={`h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-slate-300 focus:bg-white focus-visible:ring-2 ${a.ring}`} data-testid="plugin-search" />
        </label>
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {([["discover", "Discover"], ["installed", `Added · ${installedCount}`]] as const).map(([id, label]) =>
            <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id} className={`min-h-9 rounded-lg px-3 text-xs font-bold transition ${view === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>{label}</button>)}
        </div>
      </div>
      <div className="mx-auto flex max-w-[1200px] gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
        <button type="button" onClick={() => setCategory(null)} aria-pressed={!category} className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition ${!category ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"}`}><LayoutGrid className="h-3.5 w-3.5" />All</button>
        {categories.map((c) => <button key={c} type="button" onClick={() => setCategory(c === category ? null : c)} aria-pressed={category === c}
          className={`min-h-9 shrink-0 rounded-full px-3.5 text-xs font-bold transition ${category === c ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"}`}>{c}</button>)}
      </div>
    </header>

    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-6 sm:px-6">
        {browsing && <section aria-labelledby="ps-featured">
          <h2 id="ps-featured" className="mb-3 text-xs font-extrabold uppercase tracking-[.16em] text-slate-400">Featured for your {HUB_NAME[hub]}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => <li key={p.id}>
              <div role="button" tabIndex={0} onClick={() => setOpenId(p.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(p.id); } }}
                className={`relative flex h-full cursor-pointer flex-col gap-3 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 transition hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 ${a.ring}`}>
                <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: p.color }} aria-hidden />
                <div className="flex items-start justify-between gap-3"><Tile p={p} size="lg" />{action(p)}</div>
                <div><p className="text-base font-black tracking-tight">{p.name}</p><p className="mt-1 text-sm leading-5 text-slate-500">{p.description}</p></div>
              </div>
            </li>)}
          </ul>
        </section>}

        {browsing
          ? categories.map((c) => <section key={c} aria-labelledby={`ps-${c}`}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 id={`ps-${c}`} className="text-base font-black tracking-tight">{c}</h2>
                <button type="button" onClick={() => setCategory(c)} className={`text-xs font-bold ${a.text} hover:underline`}>See all</button>
              </div>
              <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{all.filter((p) => p.category === c).map((p) => card(p))}</ul>
            </section>)
          : <section aria-live="polite">
              <h2 className="mb-3 text-base font-black tracking-tight">{view === "installed" ? `Added to your ${HUB_NAME[hub]}` : category ?? "Results"}{query.trim() && <span className="font-medium text-slate-400"> · “{query.trim()}”</span>}</h2>
              {shown.length
                ? <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{shown.map((p) => card(p))}</ul>
                : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                    <p className="text-sm font-bold">{view === "installed" ? "Nothing added here yet." : "No plugins match that."}</p>
                    <p className="mt-1 text-sm text-slate-500">{view === "installed" ? "Browse Discover to add your first one." : "Try another word, or browse every category."}</p>
                  </div>}
            </section>}
      </div>
    </main>

    {note && <div role="status" className="pointer-events-none fixed inset-x-0 bottom-5 z-[90] flex justify-center px-4"><p className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">{note}</p></div>}

    {open && <div className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-6" onClick={() => setOpenId(null)}>
      <div role="dialog" aria-modal="true" aria-label={open.name} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" data-testid="plugin-detail">
        <div className="h-24 rounded-t-3xl" style={{ background: `linear-gradient(135deg, ${open.color}, ${open.color}99)` }} aria-hidden />
        <div className="-mt-10 space-y-5 px-6 pb-6">
          <div className="flex items-end justify-between gap-3">
            <span className="rounded-2xl bg-white p-1.5"><Tile p={open} size="lg" /></span>
            <button type="button" onClick={() => setOpenId(null)} className="inline-flex min-h-9 items-center gap-1 rounded-xl px-2 text-xs font-bold text-slate-500 hover:bg-slate-100"><ArrowLeft className="h-3.5 w-3.5" />Back</button>
          </div>
          <div>
            <h3 className="text-2xl font-black tracking-tight">{open.name}</h3>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-[.14em] text-slate-400">{open.category} · Made by Arise</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">{open.description}</p>
          </div>
          <ul className="space-y-2">{open.features.map((f) => <li key={f} className="flex items-start gap-2 text-sm"><Check className={`mt-0.5 h-4 w-4 shrink-0 ${a.text}`} />{f}</li>)}</ul>
          {open.target.kind === "connection" && <div className="rounded-2xl border border-slate-200 p-4" data-testid="plugin-setup-steps">
            <p className="text-sm font-black">How to set it up</p>
            {open.steps && <ol className="mt-3 space-y-2.5">{open.steps.map((step, i) => <li key={i} className="flex gap-3 text-sm leading-5">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${a.soft}`}>{i + 1}</span><span>{step}</span>
            </li>)}</ol>}
            {open.needsNote && <p className="mt-3 text-xs text-slate-500">{open.needsNote}</p>}
            {(() => { const need = connectionNeeds(open); return need && !isInstalled(need)
              ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">This connects inside {need.name}. Add {need.name} first, then start setup.</p>
              : null; })()}
          </div>}
          {isAddable(open) && isInstalled(open) && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Removing it only hides it from your menu. Everything in it is kept, and adding it back brings it all back.</p>}
          {open.target.kind === "app" && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">A paid Arise add-on with its own page. {apps && !apps[open.target.app] ? "Your plans page shows the free trial and prices." : "It's included for you."}</p>}
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-5">
            {action(open, true)}
            {isAddable(open) && isInstalled(open) && <button type="button" onClick={() => onOpen(open)} className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-5 text-sm font-bold ${a.solid}`} data-testid="plugin-open">Open {open.name} <ArrowUpRight className="h-4 w-4" /></button>}
          </div>
        </div>
      </div>
    </div>}
  </div>;
}
