// The parts of Arise Fit that each layout (fitThemes.ts LAYOUTS) draws its own way: the tab bar, and
// the pieces of Today that only some layouts have (Studio's three rings, Bloom's flower and checklist,
// Pro's dashboard tiles, Zen's quiet rows). Type, corners and surfaces come from the layout's CSS.
import type { ComponentType } from "react";
import { Check, ChevronRight } from "lucide-react";
import { C, LAYOUTS, LAYOUT_IDS, PALETTES, cardStyle, display, haptic, numFont, setLayout, type LayoutId } from "./fitUi";

type Icon = ComponentType<{ className?: string; style?: React.CSSProperties }>;
export type NavTab = [id: string, label: string, icon: Icon];

/** Today's numbers, worked out once and drawn by each layout. */
export type DayVals = {
  ready: { score: number; word: string; color: string };
  sleep: { big: string; small: string; pct?: number };
  water: { text: string; goal: string; pct: number };
  food: { left: string; unit: string; pct: number; protein: number; proteinGoal: number };
  fast: { active: boolean; text: string; label: string; pct?: number };
  streak: number; weekCount: number; trainedToday: boolean;
};
type Open = (id: "recovery" | "sleep" | "water" | "food" | "fast" | "train") => void;

// ——— Tab bars ————————————————————————————————————————————————————————————————————————————————————
export function FitNav({ layout, tabs, tab, go }: { layout: LayoutId; tabs: NavTab[]; tab: string; go: (id: string) => void }) {
  const at = Math.max(0, tabs.findIndex(([id]) => id === tab)), n = tabs.length;
  const press = (id: string) => () => go(id);
  const base = { background: C.nav, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } as React.CSSProperties;
  if (layout === "studio" || layout === "bloom") {
    // A floating pill. Studio: icons with a small dot under the one you're on. Bloom: the one you're on
    // grows into a bubble with its name.
    return <nav aria-label="Arise Fit" className="fixed inset-x-4 z-[40] mx-auto flex max-w-md items-center justify-between rounded-full p-1.5" style={{ ...base, bottom: "max(14px, env(safe-area-inset-bottom))", boxShadow: `${C.navShadow}, inset 0 0 0 1px ${C.navBorder}` }} data-testid="fit-nav" data-layout={layout}>
      {tabs.map(([id, label, Ic]) => { const on = id === tab;
        return <button key={id} type="button" onClick={press(id)} aria-current={on ? "page" : undefined} aria-label={label} data-testid={`fit-tab-${id}`}
          className={`relative flex min-h-[50px] items-center justify-center gap-1.5 rounded-full transition-all duration-300 ${layout === "bloom" && on ? "flex-[2.2] px-3" : "flex-1"}`}
          style={layout === "bloom" ? (on ? { background: C.lime, color: C.ink, boxShadow: "0 8px 18px -8px rgba(var(--fit-accent-rgb),.8)" } : { color: C.dim }) : { color: on ? C.lime : C.dim }}>
          <Ic className="h-[22px] w-[22px] shrink-0" />
          {layout === "bloom" && on && <span className="truncate text-[14px] font-extrabold">{label}</span>}
          {layout === "studio" && <span aria-hidden className="absolute bottom-1.5 h-1 w-1 rounded-full transition-opacity" style={{ background: C.lime, opacity: on ? 1 : 0 }} />}
        </button>; })}
    </nav>;
  }
  if (layout === "pro" || layout === "zen") {
    // Docked along the bottom edge. Pro: a line over the tab you're on. Zen: words only, underlined.
    return <nav aria-label="Arise Fit" className="fixed inset-x-0 bottom-0 z-[40] flex items-stretch px-1 pb-[max(4px,env(safe-area-inset-bottom))] pt-0.5" style={{ ...base, boxShadow: C.navShadow }} data-testid="fit-nav" data-layout={layout}>
      {layout === "pro" && <span aria-hidden className="absolute top-0 h-[2px]" style={{ width: `calc((100% - 8px) / ${n})`, left: `calc(4px + ${at} * (100% - 8px) / ${n})`, background: C.lime, transition: "left .3s cubic-bezier(.2,.9,.2,1)" }} />}
      {tabs.map(([id, label, Ic]) => { const on = id === tab;
        return <button key={id} type="button" onClick={press(id)} aria-current={on ? "page" : undefined} data-testid={`fit-tab-${id}`}
          className="flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-1" style={{ color: on ? C.text : C.dim }}>
          {layout === "pro" && <Ic className="h-5 w-5" />}
          <span className={`max-w-full truncate px-0.5 ${layout === "zen" ? "text-[13px]" : "text-[10.5px] font-semibold uppercase tracking-[.08em]"}`} style={layout === "zen" ? { fontWeight: on ? 600 : 400, textDecoration: on ? "underline" : "none", textUnderlineOffset: 6, textDecorationThickness: 1.5, textDecorationColor: "var(--fit-accent)" } : { fontFamily: "var(--fit-num)" }}>{label}</span>
        </button>; })}
    </nav>;
  }
  // Athletic: the floating bar with a highlight that slides under the tab you pick.
  return <nav aria-label="Arise Fit" className="fixed inset-x-3 z-[40] mx-auto flex max-w-md items-center rounded-[16px] p-1.5" style={{ ...base, bottom: "max(12px, env(safe-area-inset-bottom))", boxShadow: `${C.navShadow}, inset 0 0 0 1px ${C.navBorder}` }} data-testid="fit-nav" data-layout={layout}>
    <span aria-hidden className="absolute bottom-1.5 top-1.5 rounded-[11px]" style={{ width: `calc((100% - 12px) / ${n})`, left: `calc(6px + ${at} * (100% - 12px) / ${n})`, background: "linear-gradient(180deg, rgba(var(--fit-accent-rgb),.24), rgba(var(--fit-accent-rgb),.08))", boxShadow: "inset 0 -2px 0 var(--fit-accent)", transition: "left .35s cubic-bezier(.2,.9,.2,1), width .35s cubic-bezier(.2,.9,.2,1)" }} />
    {tabs.map(([id, label, Ic]) => <button key={id} type="button" onClick={press(id)} aria-current={tab === id ? "page" : undefined} data-testid={`fit-tab-${id}`}
      className="relative flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] text-[11.5px] uppercase tracking-[.06em] transition-colors duration-200" style={{ fontFamily: "var(--fit-display)", fontWeight: 800, color: tab === id ? C.lime : C.dim }}>
      <Ic className="h-[22px] w-[22px]" /><span className="max-w-full truncate px-0.5">{label}</span></button>)}
  </nav>;
}

// ——— Rings ———————————————————————————————————————————————————————————————————————————————————————
const arc = (r: number, pct: number) => { const c = 2 * Math.PI * r; return { strokeDasharray: c, strokeDashoffset: c * (1 - Math.max(0, Math.min(1, pct))) }; };
function MiniRing({ pct, color, size = 76, stroke = 8, children }: { pct: number; color: string; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  return <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
    <svg width={size} height={size} className="-rotate-90" aria-hidden><circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: C.track }} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" style={{ stroke: color, transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.9,.2,1)", ...arc(r, pct) }} /></svg>
    <span className="absolute inset-0 grid place-items-center text-center">{children}</span>
  </span>;
}

/** Studio: three soft rings in one card: how ready you are, food left, and water. */
export function StudioTrio({ v, open }: { v: DayVals; open: Open }) {
  const items: [string, string, number, string, Parameters<Open>[0]][] = [["Readiness", String(v.ready.score), v.ready.score / 100, v.ready.color, "recovery"], [v.food.unit, v.food.left, v.food.pct, "var(--fit-accent)", "food"], ["Water", v.water.text, v.water.pct, "#6aa9e9", "water"]];
  return <div className="fit-in mt-4 grid grid-cols-3 gap-1 rounded-[16px] px-2 py-4" style={cardStyle} data-testid="fit-studio-trio">
    {items.map(([label, value, pct, color, id]) => <button key={label} type="button" onClick={() => { haptic("light"); open(id); }} className="flex min-w-0 flex-col items-center gap-2">
      <MiniRing pct={pct} color={color}><span className="text-[19px] leading-none" style={display}>{value}</span></MiniRing>
      <span className="max-w-full truncate text-[12px] font-medium" style={{ color: C.dim }}>{label}</span></button>)}
  </div>;
}

/** Bloom: four rings growing out from the middle like petals (move, nourish, hydrate, rest). */
export function BloomFlower({ v, open }: { v: DayVals; open: Open }) {
  const rings: [string, number, string][] = [["Move", Math.min(1, v.weekCount / 4), "var(--fit-accent)"], ["Nourish", v.food.pct, "#ff7eb6"], ["Hydrate", v.water.pct, "#5cc8ff"], ["Rest", v.sleep.pct ?? 0, "#a78bfa"]];
  const S = 210;
  return <div className="fit-in mt-4 flex items-center gap-4 rounded-[16px] p-4" style={cardStyle} data-testid="fit-bloom-flower">
    <button type="button" onClick={() => open("recovery")} className="relative shrink-0" style={{ width: S * 0.62, height: S * 0.62 }} aria-label={`Readiness ${v.ready.score}`}>
      <svg viewBox={`0 0 ${S} ${S}`} className="h-full w-full -rotate-90" aria-hidden>{rings.map(([, pct, color], i) => { const r = 96 - i * 22; return <g key={i}><circle cx={S / 2} cy={S / 2} r={r} fill="none" strokeWidth={16} style={{ stroke: C.track }} /><circle cx={S / 2} cy={S / 2} r={r} fill="none" strokeWidth={16} strokeLinecap="round" style={{ stroke: color, transition: "stroke-dashoffset 1.3s cubic-bezier(.2,.9,.2,1)", ...arc(r, pct) }} /></g>; })}</svg>
      <span className="absolute inset-0 grid place-items-center"><span className="text-[22px] leading-none" style={display}>{v.ready.score}</span></span>
    </button>
    <ul className="min-w-0 flex-1 space-y-2">{rings.map(([label, pct, color]) => <li key={label} className="flex items-center gap-2 text-[14px]"><span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} /><span className="min-w-0 flex-1 truncate font-semibold">{label}</span><span className="tabular-nums" style={{ color: C.dim }}>{Math.round(pct * 100)}%</span></li>)}</ul>
  </div>;
}

/** Bloom: today as a little checklist; each line opens its app. */
export function BloomRitual({ v, open }: { v: DayVals; open: Open }) {
  const rows: [string, string, boolean, Parameters<Open>[0]][] = [
    ["Move your body", v.trainedToday ? "Done today" : `${v.weekCount} this week`, v.trainedToday, "train"],
    ["Drink water", `${v.water.text} of ${v.water.goal}`, v.water.pct >= 1, "water"],
    ["Eat your protein", `${Math.round(v.food.protein)} of ${v.food.proteinGoal} g`, v.food.protein >= v.food.proteinGoal, "food"],
    ["Rest well", v.sleep.big, (v.sleep.pct ?? 0) >= 0.7, "sleep"],
  ];
  return <div className="fit-in mt-3 rounded-[16px] p-2" style={cardStyle} data-testid="fit-bloom-ritual">
    <p className="px-2 pb-1 pt-1.5 text-[15px]" style={display}>Today's ritual</p>
    {rows.map(([title, sub, done, id]) => <button key={title} type="button" onClick={() => { haptic("light"); open(id); }} className="flex w-full items-center gap-3 rounded-[12px] px-2 py-2.5 text-left active:scale-[.99]">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors" style={done ? { background: C.lime, color: C.ink } : { boxShadow: `inset 0 0 0 2px ${C.line}` }}>{done && <Check className="h-4 w-4" strokeWidth={3} />}</span>
      <span className="min-w-0 flex-1"><span className="block font-bold" style={done ? { color: C.dim, textDecoration: "line-through" } : undefined}>{title}</span><span className="block text-[13px]" style={{ color: C.dim }}>{sub}</span></span>
      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: C.dim }} /></button>)}
  </div>;
}

/** Pro: six tiles of numbers, a dashboard at a glance. */
export function ProTiles({ v, open }: { v: DayVals; open: Open }) {
  const tiles: [string, string, string, number | undefined, Parameters<Open>[0]][] = [
    ["READY", String(v.ready.score), v.ready.word, v.ready.score / 100, "recovery"], ["SLEEP", v.sleep.big, v.sleep.small, v.sleep.pct, "sleep"], ["WATER", v.water.text, `of ${v.water.goal}`, v.water.pct, "water"],
    [v.food.unit.toUpperCase(), v.food.left, "left today", v.food.pct, "food"], ["PROTEIN", `${Math.round(v.food.protein)}g`, `of ${v.food.proteinGoal}g`, v.food.protein / Math.max(1, v.food.proteinGoal), "food"], v.fast.active ? ["FAST", v.fast.text, v.fast.label, v.fast.pct, "fast"] : ["STREAK", `${v.streak}d`, `${v.weekCount} this week`, Math.min(1, v.weekCount / 4), "train"],
  ];
  return <div className="fit-in mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-[8px]" style={{ background: C.line, boxShadow: `0 0 0 1px ${C.line}` }} data-testid="fit-pro-tiles">
    {tiles.map(([k, val, sub, pct, id]) => <button key={k} type="button" onClick={() => { haptic("light"); open(id); }} className="flex min-w-0 flex-col gap-1 p-2.5 text-left" style={{ background: C.card }}>
      <span className="text-[10px] font-semibold tracking-[.12em]" style={{ color: C.dim, fontFamily: "var(--fit-num)" }}>{k}</span>
      <span className="truncate text-[20px] font-bold leading-none tabular-nums" style={{ fontFamily: "var(--fit-num)" }}>{val}</span>
      <span className="truncate text-[11px]" style={{ color: C.dim }}>{sub}</span>
      <span className="mt-0.5 h-[3px] overflow-hidden rounded-full" style={{ background: C.track }}><span className="block h-full" style={{ width: `${Math.round(Math.min(1, pct ?? 0) * 100)}%`, background: C.lime }} /></span>
    </button>)}
  </div>;
}

/** Zen: plain rows with a hairline between, a word on the left and the number on the right. */
export function ZenRows({ v, open }: { v: DayVals; open: Open }) {
  const rows: [string, string, Parameters<Open>[0]][] = [["Readiness", `${v.ready.score} · ${v.ready.word}`, "recovery"], ["Sleep", v.sleep.big, "sleep"], ["Water", `${v.water.text} / ${v.water.goal}`, "water"], [v.food.unit === "pts left" ? "Points left" : "Calories left", v.food.left, "food"], ["Protein", `${Math.round(v.food.protein)} / ${v.food.proteinGoal} g`, "food"], ["Fasting", v.fast.active ? v.fast.text : "Not fasting", "fast"]];
  return <ul className="fit-in mt-6" data-testid="fit-zen-rows">{rows.map(([k, val, id]) => <li key={k}><button type="button" onClick={() => open(id)} className="flex w-full items-baseline justify-between gap-3 py-3.5 text-left" style={{ borderBottom: `1px solid ${C.line}` }}>
    <span className="text-[15px]" style={{ color: C.dim }}>{k}</span><span className="truncate text-[19px] tabular-nums" style={{ ...numFont, fontWeight: 400 }}>{val}</span></button></li>)}</ul>;
}

// ——— The picker (Settings → Appearance) ———————————————————————————————————————————————————————————
/** Five layouts, each previewed in its own type, corners and colors. */
export function LayoutPicker({ value, mode }: { value: LayoutId; mode: "light" | "dark" }) {
  return <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Layout" data-testid="fit-layouts">
    {LAYOUT_IDS.map((id) => { const L = LAYOUTS[id], b = { ...(mode === "dark" ? { bg: "#15171b", card: "#202329", text: "#f6f5f2", dim: "#a6acb5" } : { bg: "#f2f2f4", card: "#ffffff", text: "#111318", dim: "#6b717c" }), ...L[mode] }, sel = id === value;
      const r = (n: number) => Math.round(n * L.round), acc = PALETTES[L.palette][mode][0];
      return <button key={id} type="button" role="radio" aria-checked={sel} onClick={() => { setLayout(id); haptic("medium"); }} className="flex min-h-[108px] w-full items-stretch overflow-hidden rounded-[14px] text-left transition-transform active:scale-[.98]" style={{ background: C.card, boxShadow: sel ? `inset 0 0 0 2px ${C.lime}` : `inset 0 0 0 1px ${C.line}` }} data-testid={`fit-layout-${id}`}>
        <span className="relative block w-[136px] shrink-0 overflow-hidden" style={{ background: b.bg, color: b.text }} aria-hidden>
          <span className="absolute left-3 top-2.5 text-[16px] leading-none" style={{ fontFamily: L.display, fontWeight: L.weight, textTransform: L.upper ? "uppercase" : "none", letterSpacing: L.tracking }}>Good morning</span>
          <span className="absolute left-2.5 right-2.5 top-9 flex h-9 items-center gap-1.5 px-2" style={{ background: b.card, borderRadius: r(10), boxShadow: id === "zen" ? `inset 0 -1px 0 ${b.dim}55` : "0 4px 12px -6px rgba(0,0,0,.3)" }}>
            <span className="h-5 w-5 shrink-0 rounded-full" style={{ boxShadow: `inset 0 0 0 3px ${acc}` }} />
            <span className="h-2 flex-1 rounded-full" style={{ background: `${b.dim}44` }} /><span className="h-5 w-7" style={{ background: acc, borderRadius: r(6) }} /></span>
          <span className="absolute bottom-2 left-1/2 flex h-5 w-[70%] -translate-x-1/2 items-center justify-around" style={{ background: b.card, borderRadius: id === "pro" || id === "zen" ? 2 : 99, boxShadow: "0 2px 8px -4px rgba(0,0,0,.35)" }}>{[0, 1, 2, 3].map((k) => <i key={k} className="block h-1.5 w-1.5 rounded-full" style={{ background: k === 0 ? acc : `${b.dim}77` }} />)}</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center px-3.5 py-3"><span className="flex items-center justify-between gap-2 text-[16px] font-semibold">{L.name}{sel && <Check className="h-4 w-4 shrink-0" style={{ color: C.lime }} strokeWidth={3} />}</span><span className="mt-1 block text-[12.5px] leading-snug" style={{ color: C.dim }}>{L.blurb}</span></span>
      </button>; })}
  </div>;
}
