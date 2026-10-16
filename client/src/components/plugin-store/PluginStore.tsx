// The Arise App Store: browse and add apps to Arise WorkHub or Arise LifeHub.
// The catalog and the rules for adding live in shared/pluginStore.ts; the hub that opens the store
// says what is added and saves the change itself, so it syncs like every other change in the hub.
//
// Built phone first. Nothing in it is wider than the screen (rows wrap their words instead of
// pushing the page sideways), the list scrolls on its own without dragging the page behind it, and
// buttons keep their width when Add turns into Added, so tapping one never moves anything else.
// Its colours come from one palette, in day or night, so the hub's night mode can't half-darken it.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Apple, ArrowUpRight, BellRing, BookOpenCheck, Briefcase, Calculator, CalendarDays, CalendarPlus, CalendarRange, Check, CheckSquare,
  ClipboardCheck, Clock, Droplets, Forward, GraduationCap, Handshake, HeartPulse, History, Hourglass, Landmark, Mail, MessageCircle, Newspaper, NotebookPen, Pill, Plane,
  Plus, Puzzle, Quote, Search, ShoppingBag, ShoppingCart, Smile, SmilePlus, Sparkles, StickyNote, Sun, Target, Timer, TrendingUp, Users, Vote, Wallet, Wind, X, Shuffle, HeartHandshake, BookOpenText, Link2, Trophy, type LucideIcon,
} from "lucide-react";
import { ArrowLeftRight as ArrowLeftRightTile, BookOpen as BookOpenTile, Cake as CakeTile, Car as CarTile, ChefHat as ChefHatTile, CloudSun as CloudSunTile, CreditCard as CreditCardTile, Flower2 as Flower2Tile, Gift as GiftTile, Heart as HeartTile, Mountain as MountainTile, PawPrint as PawPrintTile, Phone as PhoneTile, PiggyBank as PiggyBankTile, Repeat as RepeatTile, Tv as TvTile, UtensilsCrossed as UtensilsCrossedTile, Wrench as WrenchTile } from "lucide-react";
import { Coins as CoinsTile2, Dumbbell as DumbbellTile2, Gauge as GaugeTile2, Globe as GlobeTile2, Hammer as HammerTile2, HandCoins as HandCoinsTile2, ListChecks as ListChecksTile2, Moon as MoonTile2, ShieldCheck as ShieldCheckTile2, Star as StarTile2, Stethoscope as StethoscopeTile2, Utensils as UtensilsTile2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { appHref } from "@/lib/hubs";
import HubMark from "@/components/HubMark";
import KitPlugin from "@/components/plugin-kit/KitPlugin";
import NotesKitApp from "@/components/plugin-kit/NotesKitApp";
import { KIT_ICONS } from "@/components/plugin-kit/kitIcons";
import { kitDef, type KitRecord } from "@shared/pluginKit";
import { countsAsApp } from "@shared/todoPlan";
import type { Note } from "@shared/notesApp";
import {
  HUB_TEMPLATES, PLUGIN_CATEGORIES, connectionNeeds, isAddable, pluginsFor, searchPlugins, templatePlugins, OPEN_STORE_KEY, type HubTemplate, type Plugin, type PluginHub,
} from "@shared/pluginStore";

export const ICONS: Record<string, LucideIcon> = {
  Apple, BellRing, BookOpenCheck, Briefcase, Calculator, CalendarDays, CalendarPlus, CalendarRange, CheckSquare, ClipboardCheck, Clock, Droplets, Forward,
  GraduationCap, Handshake, HeartPulse, Landmark, Mail, MessageCircle, Newspaper, Pill, Plane, Smile, SmilePlus, Sparkles, StickyNote, Target, Timer,
  Users, Vote, Wallet, NotebookPen, Hourglass, ShoppingCart, Wind, Quote, History, TrendingUp, Shuffle, HeartHandshake, BookOpenText, Link2, Sun, Trophy,
  ArrowLeftRight: ArrowLeftRightTile, BookOpen: BookOpenTile, Cake: CakeTile, Car: CarTile, ChefHat: ChefHatTile, CloudSun: CloudSunTile, CreditCard: CreditCardTile, Flower2: Flower2Tile, Gift: GiftTile, Heart: HeartTile, Mountain: MountainTile, PawPrint: PawPrintTile, Phone: PhoneTile, PiggyBank: PiggyBankTile, Repeat: RepeatTile, Tv: TvTile, UtensilsCrossed: UtensilsCrossedTile, Wrench: WrenchTile,
  Coins: CoinsTile2, Dumbbell: DumbbellTile2, Gauge: GaugeTile2, Globe: GlobeTile2, Hammer: HammerTile2, HandCoins: HandCoinsTile2, ListChecks: ListChecksTile2, Moon: MoonTile2, ShieldCheck: ShieldCheckTile2, Star: StarTile2, Stethoscope: StethoscopeTile2, Utensils: UtensilsTile2,
};

/** The store's name, as people see it everywhere. */
export const STORE_NAME = "App Store";

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
/** Each hub's own colour, used when the hub doesn't hand the store one. */
const HUB_ACCENT: Record<PluginHub, string> = { work: "#0f766e", life: "#6a55dc" };

// ── Colours ──────────────────────────────────────────────────────────────────

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hexOf = (c: number[]) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
/** `a` blended toward `b` by t (0 = a, 1 = b). */
export const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return hexOf(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = (hex: string) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = rgb(hex); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
/** WCAG contrast between two colours. */
export const contrast = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** The colour nearest `color` (moving toward `toward`) that reads at `need`:1 on `ground`. */
function readable(color: string, ground: string, toward: string, need = 4.6) {
  for (let t = 0; t <= 1.0001; t += 0.05) { const c = mix(color, toward, t); if (contrast(c, ground) >= need) return c; }
  return toward;
}

export type StorePalette = {
  bg: string; surface: string; raised: string; line: string; text: string; sub: string; faint: string;
  chipOn: string; chipOnText: string; accent: string; onAccent: string; accentSoft: string; accentText: string;
  /** A second accent, further round the hue wheel, for the hero's two-colour gradient. */
  accent2: string;
};

/** The store's colours for a hub, in day or night. Every text colour reads at 4.5:1 or better on the ground it sits on. */
export function storePalette(hub: PluginHub, night: boolean, accentIn?: string): StorePalette {
  const accent = /^#[0-9a-f]{6}$/i.test(accentIn || "") ? accentIn!.toLowerCase() : HUB_ACCENT[hub];
  const base = night
    ? hub === "work"
      ? { bg: "#070c17", surface: "#121b2f", raised: "#1b2640", line: "#27344f", text: "#f1f5f9", sub: "#bac6d8", faint: "#9aa8bd", chipOn: "#f1f5f9", chipOnText: "#0b1220" }
      : { bg: "#0a0915", surface: "#18162c", raised: "#221f3c", line: "#2e2b4f", text: "#f3f1fb", sub: "#c6c2de", faint: "#a29fc0", chipOn: "#f3f1fb", chipOnText: "#0e0d1a" }
    : { bg: "#f6f6fa", surface: "#ffffff", raised: "#f1f1f6", line: "#e6e6ee", text: "#131220", sub: "#4f4c60", faint: "#6a6778", chipOn: "#131220", chipOnText: "#ffffff" };
  // A solid button keeps the accent; its words are white, or near-black for a pale accent.
  const onAccent = contrast("#ffffff", accent) >= 4.5 ? "#ffffff" : "#111111";
  const accentSoft = night ? mix(base.surface, accent, 0.3) : mix("#ffffff", accent, 0.12);
  const accentText = readable(accent, night ? accentSoft : accentSoft, night ? "#ffffff" : "#000000");
  // A second hue, shifted warm-to-cool from the accent, for the hero gradient's far edge.
  const accent2 = mix(accent, night ? "#ff7ad1" : "#ff8fc7", 0.35);
  return { ...base, accent, onAccent, accentSoft, accentText, accent2 };
}

type AppAccess = Partial<Record<"history" | "math" | "social", boolean>>;

export type PluginStoreProps = {
  hub: PluginHub;
  /** Teachers (and admins) have both hubs and see the teacher-only apps. */
  teacher: boolean;
  isInstalled: (p: Plugin) => boolean;
  /** Adds or removes a tab or section app. The hub saves it. */
  onToggle: (p: Plugin, on: boolean) => void;
  /** Opens the app's tab or section in the hub (and closes the store). */
  onOpen: (p: Plugin) => void;
  onClose: () => void;
  /** WorkHub's Plugin Kit apps open inside the store, with their records kept in the hub. */
  kit?: { records: KitRecord[]; setRecords: (update: (all: KitRecord[]) => KitRecord[]) => void; today: string; makeId: () => string };
  /** Installed Notes-app plugins (see shared/notesApp.ts) open inside the store, keyed by plugin id
   *  so each install (LifeHub Notes in WorkHub, Work Notes in LifeHub) keeps its own separate notes. */
  notesApp?: { notes: Record<string, Note[]>; setNotes: (id: string, update: (all: Note[]) => Note[]) => void; makeId: () => string };
  /** The hub is in night mode. */
  night?: boolean;
  /** The hub's accent colour (a hex), for buttons and selected chips. */
  accent?: string;
};

function Tile({ p, size = "md" }: { p: Plugin; size?: "md" | "lg" }) {
  const Icon = ICONS[p.icon] ?? KIT_ICONS[p.icon] ?? Puzzle;
  const box = size === "lg" ? "h-16 w-16 rounded-[1.3rem]" : "h-12 w-12 rounded-[1rem]";
  return <span
    className={`relative flex shrink-0 items-center justify-center text-white ${box}`}
    style={{
      background: `linear-gradient(150deg, ${mix(p.color, "#ffffff", 0.22)}, ${p.color} 55%, ${mix(p.color, "#000000", 0.18)})`,
      boxShadow: `0 1px 2px rgba(0,0,0,.18), 0 6px 14px -6px ${p.color}99, inset 0 1px 0 rgba(255,255,255,.35)`,
    }}
    aria-hidden
  >
    <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/25 via-transparent to-transparent" />
    <Icon className={`relative drop-shadow-sm ${size === "lg" ? "h-8 w-8" : "h-6 w-6"}`} strokeWidth={2.1} />
  </span>;
}

/** How many apps a category shows before "See all". */
const PER_CATEGORY = 6;

export default function PluginStore({ hub, teacher, isInstalled, onToggle, onOpen, onClose, kit, notesApp, night = false, accent }: PluginStoreProps) {
  const { token } = useAuth();
  const pal = useMemo(() => storePalette(hub, night, accent), [hub, night, accent]);
  const vars = {
    "--s-bg": pal.bg, "--s-surface": pal.surface, "--s-raised": pal.raised, "--s-line": pal.line, "--s-text": pal.text, "--s-sub": pal.sub, "--s-faint": pal.faint,
    "--s-chip-on": pal.chipOn, "--s-chip-on-text": pal.chipOnText, "--s-accent": pal.accent, "--s-on-accent": pal.onAccent, "--s-accent-soft": pal.accentSoft, "--s-accent-text": pal.accentText,
    colorScheme: night ? "dark" : "light",
  } as CSSProperties;
  const [view, setView] = useState<"discover" | "installed" | "templates">("discover");
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [openTemplateId, setOpenTemplateId] = useState<string | null>(null);
  const [apps, setApps] = useState<AppAccess | null>(null);
  const [note, setNote] = useState("");
  // A WorkHub kit app being used, shown over the store.
  const [running, setRunning] = useState<string | null>(null);
  const runningRef = useRef(running);
  runningRef.current = running;
  const openPlugin = (p: Plugin) => { if (p.target.kind === "kit" && kit) { setRunning(p.target.id); setOpenId(null); } else if (p.target.kind === "notesApp" && notesApp) { setRunning(p.target.id); setOpenId(null); } else onOpen(p); };
  const closeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLElement>(null);
  // The hub redraws often (clocks, saving), so the latest close and open-detail live in refs
  // and the effects below run once, not on every redraw.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const openIdRef = useRef(openId);
  openIdRef.current = openId;
  const openTemplateIdRef = useRef(openTemplateId);
  openTemplateIdRef.current = openTemplateId;

  const all = useMemo(() => pluginsFor(hub, { teacher }), [hub, teacher]);
  /** How many apps this hub's store has (built-in tools that are always there aren't counted). */
  const appCount = useMemo(() => all.filter((p) => countsAsApp(hub, p)).length, [all, hub]);
  /** The running plugin's definition: either a Kit plugin, or a Notes-app install (by its store id).
   *  Must stay below `all`: read above it, opening a Kit or Notes app threw a ReferenceError. */
  const runningNotesApp = running ? all.find((p) => p.id === running && p.target.kind === "notesApp") : null;
  const open = all.find((p) => p.id === openId) ?? null;
  // Hub templates: ready-made bundles of this hub's plugins, for building a new hub around one area of life.
  const templates = useMemo(() => HUB_TEMPLATES.filter((t) => t.hub === hub), [hub]);
  const openTemplate = templates.find((t) => t.id === openTemplateId) ?? null;

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


  // Escape closes the detail first, then the store. The page behind is held still, iPhone included:
  // fixing the body in place is the only thing Safari respects, so the hub can't slide under the store.
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); if (runningRef.current) setRunning(null); else if (openIdRef.current) setOpenId(null); else if (openTemplateIdRef.current) setOpenTemplateId(null); else onCloseRef.current(); };
    window.addEventListener("keydown", key, true);
    const body = document.body.style, y = window.scrollY;
    const was = { overflow: body.overflow, position: body.position, top: body.top, width: body.width };
    body.overflow = "hidden"; body.position = "fixed"; body.top = `-${y}px`; body.width = "100%";
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("keydown", key, true);
      body.overflow = was.overflow; body.position = was.position; body.top = was.top; body.width = was.width;
      window.scrollTo(0, y);
    };
  }, []);

  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(""), 3500); return () => clearTimeout(t); }, [note]);
  // Changing what's shown starts the list at the top.
  useEffect(() => { listRef.current?.scrollTo({ top: 0 }); }, [view, category]);

  const shown = useMemo(() => {
    let list = searchPlugins(all, query);
    if (view === "installed") list = list.filter((p) => isAddable(p) && isInstalled(p));
    if (category) list = list.filter((p) => p.category === category);
    return list;
  }, [all, query, view, category, isInstalled]);

  const installedCount = all.filter((p) => isAddable(p) && isInstalled(p)).length;
  const browsing = view === "discover" && !category && !query.trim();
  // Featured: the ones not added yet first, worked out once when the store opens, so a card never
  // jumps to a new place the moment it's added. The first becomes the spotlight; the rest run as a rail.
  const [featured] = useState(() => all.filter((p) => p.featured).map((p, i) => ({ p, i, on: isAddable(p) && isInstalled(p) ? 1 : 0 }))
    .sort((a, b) => a.on - b.on || a.i - b.i).slice(0, 9).map((x) => x.p));
  const [spotlight, ...rail] = featured;

  const toggle = (p: Plugin, on: boolean) => {
    onToggle(p, on);
    setNote(on ? `${p.name} was added to your ${HUB_NAME[hub]}.` : `${p.name} was removed. Nothing in it was deleted: add it back any time.`);
  };

  /** Adds (or removes) every plugin in a template at once, each exactly as toggle() would on its own. */
  const toggleTemplate = (t: HubTemplate, on: boolean) => {
    for (const p of templatePlugins(t)) onToggle(p, on);
    setNote(on ? `${t.name}: every app in it was added to your ${HUB_NAME[hub]}.` : `${t.name} was removed. Nothing in it was deleted: add it back any time.`);
  };

  const switchHub = () => {
    try { sessionStorage.setItem(OPEN_STORE_KEY, "1"); } catch { /* the other hub just opens normally */ }
    window.location.hash = hub === "work" ? "#/lifehub" : "#/workhub";
  };

  const ring = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--s-bg)]";
  const solid = "bg-[var(--s-accent)] text-[var(--s-on-accent)] shadow-[0_4px_12px_-4px_var(--s-accent)]";
  const soft = "bg-[var(--s-accent-soft)] text-[var(--s-accent-text)]";
  const quiet = "bg-[var(--s-raised)] text-[var(--s-text)]";

  /** The button on a row or the detail sheet. Row buttons keep one width, so Add → Added moves nothing. */
  const action = (p: Plugin, big?: boolean) => {
    const size = big ? "min-h-12 px-5 text-[15px]" : "h-9 w-[5.5rem] px-2 text-[13px]";
    const base = `inline-flex shrink-0 items-center justify-center gap-1 rounded-full font-bold transition-all active:scale-[.96] active:opacity-80 ${ring} ${size}`;
    const t = p.target;
    if (t.kind === "app") {
      const has = apps?.[t.app] ?? true;
      return has
        ? <a href={t.href} className={`${base} ${quiet}`} onClick={(e) => e.stopPropagation()}>Open{big && <ArrowUpRight className="h-4 w-4" />}</a>
        : <a href={appHref("/billing")} className={`${base} ${solid}`} onClick={(e) => e.stopPropagation()}>{big ? "See plans" : "Plans"}</a>;
    }
    if (t.kind === "connection") {
      const need = connectionNeeds(p);
      if (need && !isInstalled(need)) {
        return <button type="button" className={`${base} ${solid} ${big ? "" : "!w-auto max-w-[9rem]"}`} onClick={(e) => { e.stopPropagation(); toggle(need, true); }}><Plus className="h-4 w-4 shrink-0" /><span className="truncate">Add {need.name}</span></button>;
      }
      // Set up explains the steps first; the popup's own button then goes to the place to do them.
      if (big) return <button type="button" className={`${base} ${solid}`} onClick={(e) => { e.stopPropagation(); onOpen(p); if (p.anchor) goToSetup(p.anchor); }} data-testid="plugin-start-setup">Start setup <ArrowUpRight className="h-4 w-4" /></button>;
      return <button type="button" className={`${base} ${quiet}`} onClick={(e) => { e.stopPropagation(); setOpenId(p.id); }} data-testid={`plugin-setup-${p.id}`}>Set up</button>;
    }
    const on = isInstalled(p);
    return on
      ? <button type="button" className={`${base} ${big ? quiet : soft}`} onClick={(e) => { e.stopPropagation(); if (big) toggle(p, false); else setOpenId(p.id); }} aria-label={big ? `Remove ${p.name}` : `${p.name} is added. Open details`} data-testid={`plugin-added-${p.id}`}>
          {big ? "Remove" : <><Check className="h-4 w-4" />Added</>}
        </button>
      : <button type="button" className={`${base} ${solid}`} onClick={(e) => { e.stopPropagation(); toggle(p, true); }} data-testid={`plugin-add-${p.id}`}><Plus className="h-4 w-4" />Add</button>;
  };

  /** A template's icon-and-colour badge, same look as a plugin's Tile. */
  const templateTile = (t: HubTemplate) => {
    const Icon = ICONS[t.icon] ?? KIT_ICONS[t.icon] ?? Puzzle;
    return <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] text-white"
      style={{ background: `linear-gradient(150deg, ${mix(t.color, "#ffffff", 0.22)}, ${t.color} 55%, ${mix(t.color, "#000000", 0.18)})`, boxShadow: `0 1px 2px rgba(0,0,0,.18), 0 6px 14px -6px ${t.color}99, inset 0 1px 0 rgba(255,255,255,.35)` }} aria-hidden>
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/25 via-transparent to-transparent" />
      <Icon className="relative h-6 w-6 drop-shadow-sm" strokeWidth={2.1} />
    </span>;
  };

  /** A hub template as a card: its apps, how many are already added, and one button to add (or remove) them all. */
  const templateCard = (t: HubTemplate) => {
    const plugins = templatePlugins(t);
    const have = plugins.filter((p) => isInstalled(p)).length;
    const everyOne = have === plugins.length;
    return <div role="button" tabIndex={0} onClick={() => setOpenTemplateId(t.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenTemplateId(t.id); } }}
      className={`group flex h-full min-w-0 cursor-pointer flex-col gap-3 rounded-[1.4rem] border border-[var(--s-line)] bg-[var(--s-surface)] p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,.04)] transition-all hover:-translate-y-0.5 hover:border-[var(--s-accent)]/30 hover:shadow-[0_10px_24px_-14px_rgba(0,0,0,.35)] ${ring}`}
      data-testid={`template-${t.id}`}>
      <div className="flex items-start gap-3">
        {templateTile(t)}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold leading-tight text-[var(--s-text)]">{t.name}</span>
          <span className="mt-0.5 line-clamp-2 break-words text-[13px] leading-snug text-[var(--s-sub)]">{t.tagline}</span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-[var(--s-faint)]">{have} of {plugins.length} added</span>
        {everyOne
          ? <button type="button" className={`inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-full px-3.5 text-[13px] font-bold transition-all active:scale-[.96] ${quiet} ${ring}`} onClick={(e) => { e.stopPropagation(); toggleTemplate(t, false); }} data-testid={`template-remove-${t.id}`}>Remove all</button>
          : <button type="button" className={`inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-full px-3.5 text-[13px] font-bold transition-all active:scale-[.96] ${solid} ${ring}`} onClick={(e) => { e.stopPropagation(); toggleTemplate(t, true); }} data-testid={`template-add-${t.id}`}><Plus className="h-4 w-4" />{have ? "Add the rest" : "Add all"}</button>}
      </div>
    </div>;
  };

  /** One app as a row: the whole row opens its details, the button on the right adds it. */
  const row = (p: Plugin) => (
    <li key={p.id} className="min-w-0">
      <div role="button" tabIndex={0} onClick={() => setOpenId(p.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(p.id); } }}
        className={`group flex h-full min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-[var(--s-line)] bg-[var(--s-surface)] p-3 text-left shadow-[0_1px_2px_rgba(0,0,0,.04)] transition-all hover:-translate-y-0.5 hover:border-[var(--s-accent)]/30 hover:shadow-[0_10px_24px_-14px_rgba(0,0,0,.35)] ${ring}`}
        data-testid={`plugin-${p.id}`}>
        <Tile p={p} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] font-bold leading-tight text-[var(--s-text)]">{p.name}</span>
            {p.recommendedFor && <span title={`Recommended for Arise ${HUB_NAME[p.recommendedFor]}`} className="shrink-0 rounded-full border border-[var(--s-line)] px-1.5 py-px text-[10px] font-black uppercase tracking-wide text-[var(--s-faint)]">{HUB_NAME[p.recommendedFor]}</span>}
          </span>
          <span className="mt-0.5 line-clamp-2 break-words text-[13px] leading-snug text-[var(--s-sub)]">{p.tagline}</span>
        </span>
        {action(p)}
      </div>
    </li>
  );
  const rows = (list: Plugin[]) => <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{list.map(row)}</ul>;

  /** The App of the day spotlight: the app's own colour fills the whole card, with a big icon badge
   * standing in for artwork. Fixed height (not content-driven), so it never depends on how long the
   * tagline runs. */
  const spotlightCard = (p: Plugin) => {
    const deep = mix(p.color, "#000000", 0.55);
    const Icon = ICONS[p.icon] ?? KIT_ICONS[p.icon] ?? Puzzle;
    return <div role="button" tabIndex={0} onClick={() => setOpenId(p.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(p.id); } }}
      className={`group relative flex h-[17rem] w-full cursor-pointer flex-col overflow-hidden rounded-[1.75rem] p-5 text-left text-white sm:h-72 sm:p-7 ${ring}`}
      style={{ background: `radial-gradient(130% 110% at 100% 0%, ${mix(p.color, "#ffffff", 0.3)}, ${p.color} 45%, ${deep})` }}
      data-testid="plugin-spotlight">
      <span className="pointer-events-none absolute inset-0 opacity-90 [background:radial-gradient(60%_80%_at_15%_100%,rgba(0,0,0,.35),transparent_65%)]" aria-hidden />
      <span className="relative inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] backdrop-blur-sm"><Sparkles className="h-3 w-3" />App of the day</span>
      <span className="pointer-events-none relative flex flex-1 items-center justify-center py-2 transition-transform duration-300 group-hover:scale-105" aria-hidden>
        <span className="flex h-24 w-24 items-center justify-center rounded-[1.4rem] bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,.4),0_8px_20px_-8px_rgba(0,0,0,.45)] backdrop-blur-sm">
          <Icon className="h-12 w-12" strokeWidth={1.6} />
        </span>
      </span>
      <span className="relative">
        <span className="block truncate text-[26px] font-black tracking-tight drop-shadow-sm sm:text-[30px]">{p.name}</span>
        <span className="mt-1 block max-w-sm text-[14px] leading-snug text-white/85 sm:text-[15px]">{p.tagline}</span>
        <span className="mt-3 inline-block" onClick={(e) => e.stopPropagation()}>{action(p, true)}</span>
      </span>
    </div>;
  };

  /** One rail card: a compact, full-colour tile with a small icon badge, a one-line title, a fixed
   * two-line tagline slot (so a short tagline doesn't make its card shorter than its neighbours),
   * and the button pinned to the same bottom edge on every card in the row. */
  const railCard = (p: Plugin) => {
    const deep = mix(p.color, "#000000", 0.55);
    const Icon = ICONS[p.icon] ?? KIT_ICONS[p.icon] ?? Puzzle;
    return <div role="button" tabIndex={0} key={p.id} onClick={() => setOpenId(p.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(p.id); } }}
      className={`group relative flex h-[11.5rem] w-32 shrink-0 cursor-pointer flex-col overflow-hidden rounded-[1.1rem] p-3 text-left text-white shadow-[0_6px_16px_-8px_rgba(0,0,0,.4)] snap-start sm:h-[12.5rem] sm:w-36 ${ring}`}
      style={{ background: `radial-gradient(130% 110% at 100% 0%, ${mix(p.color, "#ffffff", 0.3)}, ${p.color} 45%, ${deep})` }}
      data-testid={`plugin-rail-${p.id}`}>
      <span className="pointer-events-none absolute inset-0 opacity-90 [background:radial-gradient(60%_80%_at_15%_100%,rgba(0,0,0,.35),transparent_65%)]" aria-hidden />
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,.4)] backdrop-blur-sm" aria-hidden><Icon className="h-5 w-5" strokeWidth={1.8} /></span>
      <span className="relative mt-2 min-w-0 flex-1">
        <span className="block truncate text-[13px] font-black leading-tight tracking-tight">{p.name}</span>
        <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/75">{p.tagline}</span>
      </span>
      <span className="relative shrink-0" onClick={(e) => e.stopPropagation()}>{action(p)}</span>
    </div>;
  };
  const posterRail = (list: Plugin[]) => <ul className="-mx-4 flex items-stretch gap-2.5 overflow-x-auto overscroll-x-contain px-4 pb-1 pt-1 [scrollbar-width:none] snap-x snap-mandatory sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
    {list.map((p) => <li key={p.id} className="flex shrink-0">{railCard(p)}</li>)}
  </ul>;

  const categories = PLUGIN_CATEGORIES[hub].filter((c) => all.some((p) => p.category === c));
  const chip = (on: boolean) => `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition-all ${ring} ${on ? "bg-[var(--s-chip-on)] text-[var(--s-chip-on-text)] shadow-[0_4px_10px_-4px_rgba(0,0,0,.35)]" : "border border-[var(--s-line)] bg-[var(--s-surface)] text-[var(--s-text)] hover:border-[var(--s-accent)]/40"}`;
  const label = "text-xs font-extrabold uppercase tracking-[.14em] text-[var(--s-faint)]";

  return <div className="fixed inset-0 z-[80] flex flex-col bg-[var(--s-bg)] text-[var(--s-text)]" style={vars} role="dialog" aria-modal="true" aria-label={`Arise ${STORE_NAME} for ${HUB_NAME[hub]}`} data-testid="plugin-store">
    <header
      className="relative shrink-0 overflow-hidden pb-7 pt-[env(safe-area-inset-top)] sm:pb-8"
      style={{ background: `linear-gradient(120deg, ${pal.accent}, ${pal.accent2})` }}
    >
      <span className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(60%_140%_at_85%_0%,rgba(255,255,255,.28),transparent_60%)]" aria-hidden />
      <div className="relative mx-auto flex h-14 max-w-[1100px] items-center gap-2.5 px-3 sm:h-16 sm:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.75rem] bg-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.4)] backdrop-blur-sm" aria-hidden><ShoppingBag className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[10px] font-extrabold uppercase tracking-[.2em] text-white/75" data-testid="store-app-count">Arise · {appCount.toLocaleString()} apps</span>
          <span className="block truncate text-[17px] font-black tracking-tight text-white">{STORE_NAME}</span>
        </span>
        {teacher && <nav aria-label="Which hub" className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-black/15 p-0.5 backdrop-blur-sm">
          {(["work", "life"] as const).map((h) => <button key={h} type="button" onClick={h === hub ? undefined : switchHub} aria-current={h === hub ? "page" : undefined} aria-label={HUB_NAME[h]}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold transition-colors ${ring} ${h === hub ? "bg-white text-[var(--s-text)] shadow-sm" : "text-white/80"}`}>
            <HubMark tone={h} className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{HUB_NAME[h]}</span>
          </button>)}
        </nav>}
        <button ref={closeRef} type="button" onClick={onClose} aria-label={`Close the ${STORE_NAME}`} className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 ${ring}`} data-testid="plugin-store-close"><X className="h-6 w-6" /></button>
      </div>
      <label className="relative mx-auto mt-4 block max-w-[1100px] px-3 sm:px-6">
        <span className="sr-only">Search apps</span>
        <Search className="pointer-events-none absolute left-7 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--s-faint)] sm:left-9" />
        {/* 16px text, so an iPhone doesn't zoom the page when the box is tapped. */}
        <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" enterKeyHint="search" placeholder={`Search ${appCount.toLocaleString()} ${HUB_NAME[hub]} apps`}
          className={`h-12 w-full rounded-2xl border pl-11 pr-3 text-base shadow-[0_8px_24px_-10px_rgba(0,0,0,.45)] outline-none ${ring}`}
          style={{ background: pal.surface, color: pal.text, borderColor: pal.line }} data-testid="plugin-search" />
      </label>
    </header>

    <main ref={listRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
      <div className="mx-auto max-w-[1100px] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
        {/* Stays at the top while the list scrolls under it. */}
        <div className="sticky top-0 z-10 -mx-4 mt-3 bg-[var(--s-bg)] px-4 py-2 sm:-mx-6 sm:px-6">
          <div className="-mx-4 flex gap-2 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Show">
            <button type="button" onClick={() => { setView("discover"); setCategory(null); }} aria-pressed={browsing} className={chip(view === "discover" && !category)}>All</button>
            <button type="button" onClick={() => { setView("installed"); setCategory(null); }} aria-pressed={view === "installed"} className={chip(view === "installed")} data-testid="plugin-store-added">Added · {installedCount}</button>
            {templates.length > 0 && <button type="button" onClick={() => { setView("templates"); setCategory(null); }} aria-pressed={view === "templates"} className={chip(view === "templates")} data-testid="plugin-store-templates">Hubs</button>}
            {categories.map((c) => <button key={c} type="button" onClick={() => { setView("discover"); setCategory(c === category ? null : c); }} aria-pressed={category === c} className={chip(category === c)}>{c}</button>)}
          </div>
        </div>

        <div className="space-y-9 pt-1">
          {browsing && spotlight && <section aria-labelledby="ps-spotlight">
            <h2 id="ps-spotlight" className="sr-only">App of the day</h2>
            {spotlightCard(spotlight)}
          </section>}

          {browsing && rail.length > 0 && <section aria-labelledby="ps-featured">
            <div className="mb-3 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[var(--s-accent)]" aria-hidden />
              <h2 id="ps-featured" className={label}>Featured for your {HUB_NAME[hub]}</h2>
            </div>
            {posterRail(rail)}
          </section>}

          {view === "templates" && <section aria-live="polite">
            <h2 className="mb-1 text-lg font-black tracking-tight text-[var(--s-text)]">Build a new hub</h2>
            <p className="mb-4 max-w-md text-sm text-[var(--s-sub)]">Each one adds a ready-made set of apps in a single tap. Add just the ones you want afterward, or remove any of them the same way you would on their own.</p>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">{templates.map((t) => <li key={t.id}>{templateCard(t)}</li>)}</ul>
          </section>}

          {view !== "templates" && (browsing
            ? categories.map((c) => {
                const inCat = all.filter((p) => p.category === c);
                return <section key={c} aria-labelledby={`ps-${c}`}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 id={`ps-${c}`} className="min-w-0 truncate text-lg font-black tracking-tight text-[var(--s-text)]">{c}<span className="ml-2 text-sm font-semibold text-[var(--s-sub)]">{inCat.length}</span></h2>
                    {inCat.length > PER_CATEGORY && <button type="button" onClick={() => setCategory(c)} className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-bold text-[var(--s-accent-text)] transition-colors hover:bg-[var(--s-accent-soft)] ${ring}`}>See all {inCat.length} <ArrowUpRight className="h-3.5 w-3.5" /></button>}
                  </div>
                  {posterRail(inCat.slice(0, PER_CATEGORY))}
                </section>;
              })
            : <section aria-live="polite">
                <h2 className="mb-3 text-lg font-black tracking-tight text-[var(--s-text)]">
                  {view === "installed" ? `Added to your ${HUB_NAME[hub]}` : category ?? "Results"}
                  <span className="ml-2 text-sm font-semibold text-[var(--s-sub)]">{shown.length}{query.trim() ? ` · “${query.trim()}”` : ""}</span>
                </h2>
                {shown.length
                  ? rows(shown)
                  : <div className="rounded-[1.4rem] border border-dashed border-[var(--s-line)] bg-[var(--s-surface)] p-10 text-center">
                      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--s-accent-soft)] text-[var(--s-accent-text)]"><Search className="h-5 w-5" /></span>
                      <p className="text-[15px] font-bold text-[var(--s-text)]">{view === "installed" ? "Nothing added here yet." : "No apps match that."}</p>
                      <p className="mt-1 text-sm text-[var(--s-sub)]">{view === "installed" ? "Tap All to add your first one." : "Try another word, or tap All."}</p>
                    </div>}
              </section>)}
        </div>
      </div>
    </main>

    {running && ((kit && kitDef(running)) || (notesApp && runningNotesApp)) && <div className="fixed inset-0 z-[87] flex flex-col bg-[var(--s-bg)]" role="dialog" aria-modal="true" aria-label={kitDef(running)?.name || runningNotesApp?.name} data-testid="kit-running">
      <div className="shrink-0 border-b border-[var(--s-line)] bg-[var(--s-surface)] pt-[env(safe-area-inset-top)]"><div className="mx-auto flex h-14 max-w-[1100px] items-center gap-2 px-3 sm:px-6">
        <button type="button" onClick={() => setRunning(null)} className={`inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-[var(--s-text)] ${ring}`} data-testid="kit-back">← {STORE_NAME}</button>
        <span className="ml-auto text-xs font-bold uppercase tracking-[.14em] text-[var(--s-faint)]">{HUB_NAME[hub]} app</span>
      </div></div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"><div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6">
        {kit && kitDef(running) && <KitPlugin key={running} def={kitDef(running)!} records={kit.records} setRecords={kit.setRecords} today={kit.today} makeId={kit.makeId} say={setNote} />}
        {notesApp && runningNotesApp && <NotesKitApp key={running} name={runningNotesApp.name} blurb={runningNotesApp.description} notes={notesApp.notes[running] ?? []} setNotes={(update) => notesApp.setNotes(running, update)} makeId={notesApp.makeId} say={setNote} />}
      </div></div>
    </div>}
    {note && <div role="status" className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[90] flex justify-center px-4"><p className="max-w-md rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl" style={{ background: night ? "#f8fafc" : "#15141d", color: night ? "#15141d" : "#ffffff" }}>{note}</p></div>}

    {open && <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setOpenId(null)}>
      <div role="dialog" aria-modal="true" aria-label={open.name} onClick={(e) => e.stopPropagation()}
        className="max-h-[88dvh] w-full max-w-lg overflow-y-auto overflow-x-hidden overscroll-contain rounded-t-[1.75rem] bg-[var(--s-surface)] text-[var(--s-text)] shadow-[0_30px_80px_-20px_rgba(0,0,0,.55)] sm:rounded-[1.75rem]" data-testid="plugin-detail">
        <div className="relative h-28 overflow-hidden" style={{ background: `linear-gradient(135deg, ${mix(open.color, "#ffffff", 0.18)}, ${open.color} 55%, ${mix(open.color, "#000000", 0.25)})` }}>
          <span className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_120%_at_90%_-10%,rgba(255,255,255,.35),transparent_60%)]" aria-hidden />
          <span className="absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-white/60 sm:hidden" aria-hidden />
          <button type="button" onClick={() => setOpenId(null)} aria-label="Close" className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="-mt-11 space-y-5 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
          <span className="inline-block rounded-[1.5rem] bg-[var(--s-surface)] p-1.5 shadow-[0_8px_20px_-8px_rgba(0,0,0,.35)]"><Tile p={open} size="lg" /></span>
          <div>
            <h3 className="text-2xl font-black tracking-tight text-[var(--s-text)]">{open.name}</h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[.14em] text-[var(--s-faint)]">{open.category}<span aria-hidden className="text-[var(--s-line)]">•</span>Made by Arise</p>
            {open.recommendedFor && <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${soft}`} data-testid="plugin-recommended-for">
              <Sparkles className="h-3.5 w-3.5" /> Recommended for Arise {HUB_NAME[open.recommendedFor]} — works here too
            </p>}
            <p className="mt-3 text-[15px] leading-6 text-[var(--s-sub)]">{open.description}</p>
          </div>
          <ul className="space-y-2 rounded-2xl bg-[var(--s-raised)] p-4">{open.features.map((f) => <li key={f} className="flex items-start gap-2 text-[15px] text-[var(--s-text)]"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${soft}`}><Check className="h-3.5 w-3.5" /></span>{f}</li>)}</ul>
          {open.target.kind === "connection" && <div className="rounded-2xl border border-[var(--s-line)] p-4" data-testid="plugin-setup-steps">
            <p className="text-[15px] font-black">How to set it up</p>
            {open.steps && <ol className="mt-3 space-y-2.5">{open.steps.map((step, i) => <li key={i} className="flex gap-3 text-sm leading-5">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${soft}`}>{i + 1}</span><span>{step}</span>
            </li>)}</ol>}
            {open.needsNote && <p className="mt-3 text-xs text-[var(--s-sub)]">{open.needsNote}</p>}
            {(() => { const need = connectionNeeds(open); return need && !isInstalled(need)
              ? <p className={`mt-3 rounded-xl p-3 text-xs ${soft}`}>This connects inside {need.name}. Add {need.name} first, then start setup.</p>
              : null; })()}
          </div>}
          {isAddable(open) && isInstalled(open) && <p className="rounded-xl bg-[var(--s-raised)] p-3 text-xs text-[var(--s-sub)]">Removing it only hides it from your menu. Everything in it is kept, and adding it back brings it all back.</p>}
          {open.target.kind === "app" && <p className="rounded-xl bg-[var(--s-raised)] p-3 text-xs text-[var(--s-sub)]">A paid Arise add-on with its own page. {apps && !apps[open.target.app] ? "Your plans page shows the free trial and prices." : "It's included for you."}</p>}
          <div className="flex flex-wrap gap-2 border-t border-[var(--s-line)] pt-5">
            {action(open, true)}
            {isAddable(open) && isInstalled(open) && <button type="button" onClick={() => openPlugin(open)} className={`inline-flex min-h-12 items-center gap-1.5 rounded-full px-5 text-[15px] font-bold ${solid} ${ring}`} data-testid="plugin-open">Open {open.name} <ArrowUpRight className="h-4 w-4" /></button>}
          </div>
        </div>
      </div>
    </div>}

    {openTemplate && (() => {
      const plugins = templatePlugins(openTemplate);
      const have = plugins.filter((p) => isInstalled(p)).length;
      return <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setOpenTemplateId(null)}>
        <div role="dialog" aria-modal="true" aria-label={openTemplate.name} onClick={(e) => e.stopPropagation()}
          className="max-h-[88dvh] w-full max-w-lg overflow-y-auto overflow-x-hidden overscroll-contain rounded-t-[1.75rem] bg-[var(--s-surface)] text-[var(--s-text)] shadow-[0_30px_80px_-20px_rgba(0,0,0,.55)] sm:rounded-[1.75rem]" data-testid="template-detail">
          <div className="relative h-28 overflow-hidden" style={{ background: `linear-gradient(135deg, ${mix(openTemplate.color, "#ffffff", 0.18)}, ${openTemplate.color} 55%, ${mix(openTemplate.color, "#000000", 0.25)})` }}>
            <span className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_120%_at_90%_-10%,rgba(255,255,255,.35),transparent_60%)]" aria-hidden />
            <span className="absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-white/60 sm:hidden" aria-hidden />
            <button type="button" onClick={() => setOpenTemplateId(null)} aria-label="Close" className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><X className="h-5 w-5" /></button>
          </div>
          <div className="-mt-11 space-y-5 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
            <span className="inline-block rounded-[1.5rem] bg-[var(--s-surface)] p-1.5 shadow-[0_8px_20px_-8px_rgba(0,0,0,.35)]">{templateTile(openTemplate)}</span>
            <div>
              <h3 className="text-2xl font-black tracking-tight text-[var(--s-text)]">{openTemplate.name}</h3>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[.14em] text-[var(--s-faint)]">Hub template<span aria-hidden className="text-[var(--s-line)]">•</span>Made by Arise</p>
              <p className="mt-3 text-[15px] leading-6 text-[var(--s-sub)]">{openTemplate.description}</p>
            </div>
            <ul className="space-y-2 rounded-2xl bg-[var(--s-raised)] p-4">{plugins.map((p) => <li key={p.id} className="flex items-center gap-2.5 text-[15px] text-[var(--s-text)]">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isInstalled(p) ? soft : quiet}`}>{isInstalled(p) && <Check className="h-3.5 w-3.5" />}</span>{p.name}
            </li>)}</ul>
            <p className="rounded-xl bg-[var(--s-raised)] p-3 text-xs text-[var(--s-sub)]">Adding it adds every app above at once. Removing it only hides them from your menu, and you can always add any one of them back on its own afterward.</p>
            <div className="flex flex-wrap gap-2 border-t border-[var(--s-line)] pt-5">
              {have === plugins.length
                ? <button type="button" onClick={() => toggleTemplate(openTemplate, false)} className={`inline-flex min-h-12 items-center gap-1.5 rounded-full px-5 text-[15px] font-bold ${quiet} ${ring}`} data-testid="template-remove">Remove all</button>
                : <button type="button" onClick={() => toggleTemplate(openTemplate, true)} className={`inline-flex min-h-12 items-center gap-1.5 rounded-full px-5 text-[15px] font-bold ${solid} ${ring}`} data-testid="template-add"><Plus className="h-4 w-4" />{have ? "Add the rest" : "Add all"}</button>}
            </div>
          </div>
        </div>
      </div>;
    })()}
  </div>;
}
