// Arise Fit: near you, and what to eat.
// - Gyms near me: every gym around you (OpenStreetMap), what each chain usually costs, when gyms are
//   usually busy, and what people there say right now ("it's packed"). Set one as My gym.
// - Eat out: fast food and restaurants nearby with the healthier things to order at each chain, logged
//   to Food in one tap.
// - Recipes: healthy recipes that fit what's left of today, and the AI makes one from what you have.
// Data and numbers: shared/fitNearby.ts and shared/fitRecipes.ts; places come through server/fit.ts.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RecipeIcon } from "./FitIcon";
import { Check, ChefHat, ChevronRight, Clock, ExternalLink, Globe, Loader2, LocateFixed, MapPin, Navigation, Plus, Salad, Search, SlidersHorizontal, Sparkles, Users, Utensils } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { dayKey, goals, uid, type FitData, type Meal } from "@shared/fit";
import { BUSY_WORDS, CHAIN_BY_ID, FOOD_CHAINS, nearbyCell, PRICES_CHECKED, REPORT_WORDS, busyCurve, busyLevel, cuisineTip, directionsUrl, gymTypeFor, hourWords, parsePlaces, quietTimes, type BusyLevel, type FoodChain, type NearbyKind, type Place } from "@shared/fitNearby";
import { GYM_BY_ID } from "@shared/fitGym";
import { TAG_NAME, pickRecipes, type Recipe, type RecipeTag } from "@shared/fitRecipes";
import { searchFoods } from "@/lib/foodLookup";
import { fitApi, type Update } from "./fitStore";
import { lastPlace, keepPlace, locate } from "./FitRun";
import { latestKg, totals } from "./FitFood";
import { Btn, C, Card, Sheet, Title, display, haptic, inputCls, inputStyle, usePointsMode } from "./fitUi";
import { amountText, pointsOf, DIET_BY_ID } from "@shared/fitNutrition";
import type { MenuPick } from "@shared/fitMenuAi";
import { PlusTag, isPlusError, usePlus } from "./FitPlus";

type Crowd = { level: BusyLevel; n: number; mins: number } | null;
const apple = () => typeof navigator !== "undefined" && /iPhone|iPad|Macintosh/.test(navigator.userAgent);
const away = (km: number, data: FitData) => (data.profile.units === "kg" ? `${km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1) + " km"}` : `${(km / 1.609).toFixed(1)} mi`);
const LEVEL_COLOR: Record<BusyLevel, string> = { quiet: "#22c55e", some: "#eab308", busy: "#f97316", packed: "#ef4444" };
const mealNow = (): Meal => { const h = new Date().getHours(); return h < 10 ? "breakfast" : h < 15 ? "lunch" : h < 21 ? "dinner" : "snack"; };

/** Adds a food to today's log, in the meal for this time of day. */
export function logFood(update: Update, f: { name: string; kcal: number; p: number; c: number; f: number; serving?: string }) {
  const entry = { id: uid(), date: dayKey(), meal: mealNow(), name: f.name.slice(0, 80), kcal: f.kcal, p: f.p, c: f.c, f: f.f, servings: 1, ...(f.serving ? { serving: f.serving } : {}) };
  update((d) => ({ ...d, foods: [...d.foods, entry] }));
  haptic("success");
}

/** Places of one kind around you: opens on the last place right away, then where you are now. */
function useNearby(kind: NearbyKind) {
  const { token } = useAuth();
  const [from, setFrom] = useState(lastPlace);
  const [list, setList] = useState<Place[] | null>(null);
  const [crowd, setCrowd] = useState<Record<string, Crowd>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const here = (quiet = false) => {
    setErr(""); setBusy(true);
    locate().then((ll) => { const p = { ll, label: "Near you" }; keepPlace(p); setFrom(p); }).catch((e) => { if (!quiet || !lastPlace()) setErr(e.message); setBusy(false); });
  };
  const search = async () => {
    const t = q.trim(); if (t.length < 2) return;
    setErr(""); setBusy(true);
    try {
      const { place } = await fitApi<any>(token, `/places?${new URLSearchParams({ q: t })}`);
      if (!place) { setErr(`Couldn't find "${t}". Try a town or zip code.`); setBusy(false); return; }
      const p = { ll: [place.lat, place.lng] as [number, number], label: place.label };
      keepPlace(p); setFrom(p);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };
  useEffect(() => { here(!!lastPlace()); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!from) return;
    let live = true;
    // What this area looked like last time shows at once; the fresh answer replaces it when it arrives.
    const ck = `arise-fit-near:${kind}:${nearbyCell(kind, from.ll[0], from.ll[1]).join(",")}`;
    let had = false;
    try { const v = JSON.parse(localStorage.getItem(ck) || "null"); if (v?.r && Date.now() - v.at < 864e5) { had = true; setList(parsePlaces(v.r, kind, from.ll, kind === "gyms" ? 25 : 10)); setCrowd(v.r.crowd ?? {}); } } catch { /* nothing kept */ }
    setBusy(!had);
    const q = (extra = "") => fitApi<{ elements: any[]; crowd: Record<string, Crowd> }>(token, `/nearby?${new URLSearchParams({ kind, lat: String(from.ll[0]), lng: String(from.ll[1]) })}${extra}`);
    let full = false;
    // Food: the closest couple of kilometres come back first (a small search), the whole area fills in behind it.
    if (kind === "food" && !had) q("&quick=1").then((r) => { if (!live || full) return; const near = parsePlaces(r, kind, from.ll, 10); if (!near.length) return; setList(near); setErr(""); setBusy(false); }).catch(() => { /* the full search answers */ });
    q()
      .then((r) => { full = true; if (!live) return; setList(parsePlaces(r, kind, from.ll, kind === "gyms" ? 25 : 10)); setCrowd(r.crowd ?? {}); setErr(""); try { localStorage.setItem(ck, JSON.stringify({ at: Date.now(), r })); } catch { /* storage full */ } })
      .catch((e) => live && !had && setErr(/reach|fetch|network/i.test(e.message) ? "No connection. Check your internet and try again." : e.message))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [from, kind, token]);
  const bar = <div className="mt-1">
    <div className="flex gap-2">
      <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Town or zip code" className={inputCls} style={inputStyle} aria-label="Search a town or zip code" />
        <Btn kind="soft" type="submit" disabled={q.trim().length < 2} className="!px-3"><Search className="h-5 w-5" /><span className="sr-only">Search</span></Btn>
      </form>
      <Btn kind="soft" onClick={() => here()} className="!px-3" testId={`fit-near-${kind}-here`}><LocateFixed className="h-5 w-5" /><span className="sr-only">Near me</span></Btn>
    </div>
    <p className="mt-2 flex items-center gap-1.5 px-1 text-[13px]" style={{ color: C.dim }}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}{from ? from.label : "Finding you…"}</p>
    {err && <p className="mt-2 px-1 text-[14px]" style={{ color: C.red }} role="alert">{err}</p>}
  </div>;
  return { list, crowd, setCrowd, busy, bar, token };
}

/** Warm the caches for the last-used place so Gyms and Eat open with results already on screen. */
export function prefetchNearby(token: string | null | undefined) {
  const p = lastPlace(); if (!p) return;
  (["gyms", "food"] as NearbyKind[]).forEach((kind, i) => window.setTimeout(() => {
    const ck = `arise-fit-near:${kind}:${nearbyCell(kind, p.ll[0], p.ll[1]).join(",")}`;
    try { const v = JSON.parse(localStorage.getItem(ck) || "null"); if (v?.r && Date.now() - v.at < 6 * 36e5) return; } catch { /* refetch */ }
    fitApi<any>(token as any, `/nearby?${new URLSearchParams({ kind, lat: String(p.ll[0]), lng: String(p.ll[1]) })}`)
      .then((r) => { try { localStorage.setItem(ck, JSON.stringify({ at: Date.now(), r })); } catch { /* storage full */ } })
      .catch(() => { /* the screen fetches it itself */ });
  }, 800 + i * 600));
}

// ——— Gyms near me ———————————————————————————————————————————————————————————————————————————————
export function NearbyGyms({ data, update, onClose, say }: { data: FitData; update: Update; onClose: () => void; say: (m: string) => void }) {
  const { list, crowd, setCrowd, busy, bar, token } = useNearby("gyms");
  const [open, setOpen] = useState<Place | null>(null);
  const [only, setOnly] = useState<"all" | "chains">("all");
  const now = new Date();
  const typical = busyCurve(now.getDay())[now.getHours()];
  const shown = (list ?? []).filter((p) => only === "all" || p.chain).slice(0, 60);
  return <Sheet title="Gyms near me" onClose={onClose} testId="fit-gyms-near">
    {bar}
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-[12px] p-1" style={{ background: C.card2 }} role="tablist">
      {([["all", "All gyms"], ["chains", "Chains with prices"]] as const).map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={only === id} onClick={() => setOnly(id)} className="h-9 rounded-[9px] text-[13px] font-semibold" style={only === id ? { background: C.card, color: C.text } : { color: C.dim }}>{l}</button>)}
    </div>
    <div className="mt-3 space-y-2">
      {shown.map((p) => {
        const c = crowd[p.id]; const chain = p.chain ? CHAIN_BY_ID.get(p.chain) : null;
        const level = c?.level ?? busyLevel(typical);
        return <Card key={p.id} onClick={() => { haptic("light"); setOpen(p); }} className="!p-3.5" testId={`fit-gym-near-${p.id}`}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold">{p.name}</p>
              <p className="mt-0.5 truncate text-[13px]" style={{ color: C.dim }}>{away(p.km, data)}{p.address ? ` · ${p.address}` : ""}</p>
              {chain?.price && <p className="mt-1 text-[13px] font-semibold" style={{ color: C.lime }}>{chain.price.plans.map(([n, v]) => `${n} ${v}`).join(" · ")}</p>}
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: C.card2 }}>
              <span className="h-2 w-2 rounded-full" style={{ background: LEVEL_COLOR[level] }} aria-hidden />{REPORT_WORDS[level]}</span>
          </div>
        </Card>;
      })}
      {list && !shown.length && !busy && <p className="px-1 text-[14px]" style={{ color: C.dim }}>No gyms found here. Try a nearby town.</p>}
    </div>
    <p className="mt-4 px-1 text-[11px] leading-relaxed" style={{ color: C.dim }}>Gyms from OpenStreetMap. Prices are typical for each chain (checked {PRICES_CHECKED}); each location sets its own, so check with the gym. Busy times are the usual pattern for gyms, plus what members report.</p>
    {open && <GymDetail p={open} crowd={crowd[open.id] ?? null} data={data} onClose={() => setOpen(null)} token={token}
      onReport={(c) => setCrowd((x) => ({ ...x, [open.id]: c }))}
      onSet={() => { const type = gymTypeFor(open); update((d) => ({ ...d, profile: { ...d.profile, gym: { type, name: open.name.slice(0, 60), gear: d.profile.gym?.type === type ? d.profile.gym.gear : GYM_BY_ID.get(type)!.gear } } })); say(`${open.name} is your gym. Adjust its equipment in My gym.`); setOpen(null); onClose(); }} />}
  </Sheet>;
}

function GymDetail({ p, crowd, data, onClose, onSet, onReport, token }: { p: Place; crowd: Crowd; data: FitData; onClose: () => void; onSet: () => void; onReport: (c: Crowd) => void; token: string | null }) {
  const now = new Date();
  const [day, setDay] = useState(now.getDay());
  const curve = busyCurve(day);
  const chain = p.chain ? CHAIN_BY_ID.get(p.chain) : null;
  const [sent, setSent] = useState("");
  const report = async (level: BusyLevel) => {
    try { const r = await fitApi<{ crowd: Crowd }>(token, "/busy", { method: "POST", body: JSON.stringify({ place: p.id, level }) }); onReport(r.crowd); setSent("Thanks! Others nearby will see it for the next 90 minutes."); haptic("success"); }
    catch (e: any) { setSent(e.message); }
  };
  const hours = Array.from({ length: 18 }, (_, i) => i + 5); // 5 am – 10 pm
  const isToday = day === now.getDay();
  return <Sheet title={p.name} onClose={onClose} testId="fit-gym-detail">
    <p className="px-1 text-[14px]" style={{ color: C.dim }}>{away(p.km, data)} away{p.address ? ` · ${p.address}` : ""}</p>
    {crowd && <Card className="mt-3 flex items-center gap-3 !p-4" testId="fit-gym-crowd"><Users className="h-6 w-6" style={{ color: LEVEL_COLOR[crowd.level] }} />
      <p className="text-[15px]"><b>{REPORT_WORDS[crowd.level]} right now</b><span style={{ color: C.dim }}> · {crowd.n === 1 ? "1 member said so" : `${crowd.n} members said so`} {crowd.mins} min ago</span></p></Card>}
    <Title>Usually busy</Title>
    <Card className="!p-4">
      <div className="mb-3 flex gap-1 overflow-x-auto">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => <button key={d} type="button" onClick={() => setDay(i)} aria-pressed={day === i} className="h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold" style={day === i ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card2, color: C.text }}>{d}</button>)}</div>
      <div className="flex h-28 items-end gap-[3px]" role="img" aria-label={`How busy gyms usually are on ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]}`}>
        {hours.map((h) => { const v = curve[h]; const nowBar = isToday && h === now.getHours(); return <div key={h} className="flex-1 rounded-t-[3px]" style={{ height: `${Math.max(4, v)}%`, background: nowBar ? C.lime : LEVEL_COLOR[busyLevel(v)], opacity: nowBar ? 1 : 0.55 }} title={`${hourWords(h)}: ${BUSY_WORDS[busyLevel(v)].toLowerCase()}`} />; })}
      </div>
      <div className="mt-1 flex justify-between text-[11px]" style={{ color: C.dim }}><span>5a</span><span>9a</span><span>1p</span><span>5p</span><span>10p</span></div>
      <p className="mt-3 text-[14px]"><Clock className="mr-1 inline h-4 w-4" style={{ color: C.lime }} />Quietest: {quietTimes(day).map(hourWords).join(", ")}</p>
    </Card>
    <Title>How busy is it now?</Title>
    <div className="grid grid-cols-4 gap-2">{(["quiet", "some", "busy", "packed"] as BusyLevel[]).map((l) => <button key={l} type="button" onClick={() => void report(l)} className="flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-[12px] text-[12px] font-semibold" style={{ background: C.card, boxShadow: `inset 0 0 0 1px ${C.line}` }} data-testid={`fit-busy-${l}`}>
      <span className="h-3 w-3 rounded-full" style={{ background: LEVEL_COLOR[l] }} aria-hidden />{REPORT_WORDS[l]}</button>)}</div>
    {sent && <p className="mt-2 px-1 text-[13px]" style={{ color: C.dim }} role="status">{sent}</p>}
    <Title>Price</Title>
    <Card className="!p-4">{chain?.price ? <>
      <ul className="space-y-1.5">{chain.price.plans.map(([n, v]) => <li key={n} className="flex justify-between text-[15px]"><span className="font-semibold">{n}</span><span className="tabular-nums">{v}</span></li>)}</ul>
      {chain.price.fees && <p className="mt-2 text-[13px]" style={{ color: C.dim }}>{chain.price.fees}.</p>}
      <p className="mt-2 text-[12px]" style={{ color: C.dim }}>Typical for {chain.name} (checked {PRICES_CHECKED}). This location may charge more or less.</p>
    </> : <p className="text-[14px]" style={{ color: C.dim }}>{chain ? `Prices at ${chain.name} vary a lot by location.` : "This gym's price isn't listed."} {p.website ? "Check their website" : "Call or stop by"} for today's rates.</p>}</Card>
    {p.hours && <Card className="mt-2 flex items-start gap-3 !p-4"><Clock className="mt-0.5 h-5 w-5 shrink-0" style={{ color: C.dim }} /><p className="text-[14px]">{p.hours.replace(/;/g, " · ")}</p></Card>}
    <div className="mt-4 grid grid-cols-2 gap-2">
      <a href={directionsUrl(p, apple())} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-[12px] text-[15px] font-semibold" style={{ background: C.card2, color: C.text }}><Navigation className="h-5 w-5" />Directions</a>
      {p.website ? <a href={p.website} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-[12px] text-[15px] font-semibold" style={{ background: C.card2, color: C.text }}><Globe className="h-5 w-5" />Website</a>
        : <a href={`https://www.google.com/search?q=${encodeURIComponent(`${p.name} ${p.address} membership price`)}`} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-[12px] text-[15px] font-semibold" style={{ background: C.card2, color: C.text }}><ExternalLink className="h-5 w-5" />Look it up</a>}
    </div>
    <Btn className="mt-3 w-full" onClick={onSet} testId="fit-gym-set"><MapPin className="h-5 w-5" />{data.profile.gym?.name === p.name ? "This is my gym" : "Set as my gym"}</Btn>
  </Sheet>;
}

// ——— Eat out ————————————————————————————————————————————————————————————————————————————————————
type Goal = "all" | "fits" | "protein" | "lowcarb" | "lowcal" | "lowfat";
const GOALS: { id: Goal; label: string }[] = [{ id: "all", label: "Everything" }, { id: "fits", label: "Fits my day" }, { id: "protein", label: "High protein" }, { id: "lowcarb", label: "Low carb" }, { id: "lowcal", label: "Low calorie" }, { id: "lowfat", label: "Low fat" }];
type Limits = { maxKcal: number; minP: number; maxC: number };
const NO_LIMITS: Limits = { maxKcal: 1200, minP: 0, maxC: 120 }; // the ends of each slider mean "no limit"
type Macro = { kcal: number; p: number; c: number; f: number };
type Filter = { goal: Goal; lim: Limits; meal: Macro };

/** Whether one menu item matches the chosen goal and the sliders. */
const matches = (m: Macro, { goal, lim, meal }: Filter) => {
  if (lim.maxKcal < NO_LIMITS.maxKcal && m.kcal > lim.maxKcal) return false;
  if (lim.minP > 0 && m.p < lim.minP) return false;
  if (lim.maxC < NO_LIMITS.maxC && m.c > lim.maxC) return false;
  switch (goal) {
    case "protein": return m.p >= 25 && (m.p * 4) / Math.max(1, m.kcal) >= 0.22;
    case "lowcarb": return m.c <= 30;
    case "lowcal": return m.kcal <= 400;
    case "lowfat": return m.f <= 12;
    case "fits": return m.kcal <= meal.kcal * 1.1 && m.p >= meal.p * 0.7;
    default: return true;
  }
};

/** A restaurant's real logo (from its website), or its first letter while that loads or if it can't. */
function BrandLogo({ domain, name, size = 40 }: { domain?: string; name: string; size?: number }) {
  const [bad, setBad] = useState(false);
  const box = { width: size, height: size };
  if (!domain || bad) return <span className="grid shrink-0 place-items-center rounded-[10px] text-[17px] font-bold" style={{ ...box, background: C.card2, color: C.dim }} aria-hidden>{name.slice(0, 1).toUpperCase()}</span>;
  return <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`} alt="" loading="lazy" onError={() => setBad(true)} className="shrink-0 rounded-[10px] bg-white object-contain p-1" style={box} />;
}

function EatFilters({ goal, setGoal, lim, setLim }: { goal: Goal; setGoal: (g: Goal) => void; lim: Limits; setLim: (l: Limits) => void }) {
  const [open, setOpen] = useState(false);
  const row = (label: string, value: string, el: ReactNode) => <label className="block"><span className="flex items-center justify-between text-[13px]"><span style={{ color: C.dim }}>{label}</span><b className="tabular-nums">{value}</b></span>{el}</label>;
  const on = lim.maxKcal < NO_LIMITS.maxKcal || lim.minP > 0 || lim.maxC < NO_LIMITS.maxC;
  return <div className="mt-3">
    <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Match a goal">{GOALS.map((g) => <button key={g.id} type="button" onClick={() => setGoal(g.id)} aria-pressed={goal === g.id} className="h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold" style={goal === g.id ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card2, color: C.text }} data-testid={`fit-eat-goal-${g.id}`}>{g.label}</button>)}</div>
    <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-1 inline-flex items-center gap-1.5 px-1 text-[13px] font-semibold" style={{ color: C.lime }}><SlidersHorizontal className="h-4 w-4" />Adjust{on ? " (on)" : ""}</button>
    {open && <Card className="mt-2 space-y-3 !p-4">
      {row("Most calories", lim.maxKcal >= NO_LIMITS.maxKcal ? "No limit" : `${lim.maxKcal}`, <input type="range" min={200} max={NO_LIMITS.maxKcal} step={50} value={lim.maxKcal} onChange={(e) => setLim({ ...lim, maxKcal: Number(e.target.value) })} className="mt-1 w-full" style={{ accentColor: C.lime }} />)}
      {row("Least protein", lim.minP <= 0 ? "No limit" : `${lim.minP} g`, <input type="range" min={0} max={60} step={5} value={lim.minP} onChange={(e) => setLim({ ...lim, minP: Number(e.target.value) })} className="mt-1 w-full" style={{ accentColor: C.lime }} />)}
      {row("Most carbs", lim.maxC >= NO_LIMITS.maxC ? "No limit" : `${lim.maxC} g`, <input type="range" min={5} max={NO_LIMITS.maxC} step={5} value={lim.maxC} onChange={(e) => setLim({ ...lim, maxC: Number(e.target.value) })} className="mt-1 w-full" style={{ accentColor: C.lime }} />)}
      {on && <button type="button" onClick={() => setLim(NO_LIMITS)} className="text-[13px] font-semibold underline" style={{ color: C.dim }}>Clear</button>}
    </Card>}
  </div>;
}

/** One menu item with a button that logs it; the button turns into a check so it's clear it went in. */
function PickRow({ name, m, serving, logName, update, say }: { name: string; m: Macro; serving: string; logName: string; update: Update; say: (m: string) => void }) {
  const [added, setAdded] = useState(false);
  const pts = usePointsMode();
  useEffect(() => { if (!added) return; const t = window.setTimeout(() => setAdded(false), 2500); return () => window.clearTimeout(t); }, [added]);
  return <div className="flex items-center gap-3 rounded-[10px] p-2.5" style={{ background: C.card2 }}>
    <div className="min-w-0 flex-1"><p className="text-[14px] font-semibold leading-snug">{name}</p><p className="mt-0.5 text-[12px] tabular-nums" style={{ color: C.dim }}>about {amountText(m, pts ? "points" : "calories")} · P {Math.round(m.p)}g · C {Math.round(m.c)}g · F {Math.round(m.f)}g</p></div>
    <button type="button" onClick={() => { logFood(update, { name: logName, kcal: m.kcal, p: m.p, c: m.c, f: m.f, serving }); setAdded(true); say(`Added to ${mealNow()}.`); }} aria-label={added ? `${name} added` : `Add ${name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform active:scale-90" style={{ background: added ? C.card : C.lime, color: added ? C.lime : "var(--fit-on-accent)" }} data-testid="fit-log-pick">{added ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}</button>
  </div>;
}

/** More of a chain's menu from the nutrition database (USDA), when its short list isn't enough. */
function MoreFromChain({ chain, filter, update, say }: { chain: FoodChain; filter: Filter; update: Update; say: (m: string) => void }) {
  const { token } = useAuth();
  const [st, setSt] = useState<"idle" | "busy" | "done" | "err">("idle");
  const [foods, setFoods] = useState<{ name: string; m: Macro; serving: string }[]>([]);
  const load = () => {
    setSt("busy");
    searchFoods(token, chain.name).then((b) => {
      const seen = new Set<string>();
      setFoods(b.foods.filter((f) => chain.match.test(`${f.brand || ""} ${f.name}`) && f.calories > 0).map((f) => ({ name: f.name.slice(0, 80), m: { kcal: f.calories, p: f.protein, c: f.carbs, f: f.fat }, serving: f.serving || "1 serving" }))
        .filter((f) => { const k = f.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }));
      setSt("done");
    }).catch(() => setSt("err"));
  };
  const shown = foods.filter((f) => matches(f.m, filter));
  if (st === "idle") return <button type="button" onClick={load} className="mt-1 inline-flex h-10 items-center gap-2 rounded-[10px] px-3 text-[14px] font-semibold" style={{ background: C.card2 }} data-testid={`fit-chain-more-${chain.id}`}><Search className="h-4 w-4" />See more from {chain.name}</button>;
  if (st === "busy") return <p className="flex items-center gap-2 py-2 text-[13px]" style={{ color: C.dim }}><Loader2 className="h-4 w-4 animate-spin" />Looking up the {chain.name} menu…</p>;
  if (st === "err") return <button type="button" onClick={load} className="text-[13px] font-semibold underline" style={{ color: C.red }}>Couldn't load the menu. Tap to try again.</button>;
  return <>{shown.map((f, k) => <PickRow key={`${f.name}-${k}`} name={f.name} m={f.m} serving={f.serving} logName={`${chain.name}: ${f.name}`} update={update} say={say} />)}
    {!shown.length && <p className="text-[13px]" style={{ color: C.dim }}>{foods.length ? "Nothing else here matches your filters." : `No more ${chain.name} items found.`}</p>}</>;
}

function ChainPicks({ chain, filter, update, say }: { chain: FoodChain; filter: Filter; update: Update; say: (m: string) => void }) {
  const picks = chain.picks.filter((p) => matches(p, filter));
  return <div className="mt-3 space-y-2">
    <p className="text-[13px] leading-snug" style={{ color: C.steel }}>{chain.tip}</p>
    {picks.map((p) => <PickRow key={p.name} name={p.name} m={p} serving="1 order" logName={`${chain.name}: ${p.name}`} update={update} say={say} />)}
    {!picks.length && <p className="text-[13px]" style={{ color: C.dim }}>None of the short list match your filters. Try "See more".</p>}
    <MoreFromChain chain={chain} filter={filter} update={update} say={say} />
  </div>;
}

export function EatOut({ data, update, onClose, say }: { data: FitData; update: Update; onClose: () => void; say: (m: string) => void }) {
  const [tab, setTab] = useState<"near" | "chains" | "match">("near");
  const [open, setOpen] = useState<string | null>(null);
  const [goal, setGoal] = useState<Goal>("all");
  const [lim, setLim] = useState<Limits>(NO_LIMITS);
  const g = goals(data.profile, latestKg(data));
  // One meal's share of the day (a third), for "Fits my day".
  const filter: Filter = { goal, lim, meal: { kcal: Math.max(250, g.kcal / 3), p: g.p / 3, c: g.c / 3, f: g.f / 3 } };
  const everything = useMemo(() => FOOD_CHAINS.flatMap((c) => c.picks.map((p) => ({ chain: c, p }))).filter((x) => matches(x.p, filter)).sort((a, b) => (goal === "lowcal" || goal === "lowcarb" || goal === "lowfat" ? a.p.kcal - b.p.kcal : b.p.p / Math.max(1, b.p.kcal) - a.p.p / Math.max(1, a.p.kcal))), [goal, lim.maxKcal, lim.minP, lim.maxC, g.kcal, g.p]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Sheet title="Eat out" onClose={onClose} testId="fit-eat-out">
    <p className="px-1 text-[15px]" style={{ color: C.steel }}>Healthier picks at places around you. Tap + to add one to today.</p>
    <div className="mt-3 grid grid-cols-3 gap-1 rounded-[12px] p-1" style={{ background: C.card2 }} role="tablist">
      {([["near", "Near me"], ["chains", "Every chain"], ["match", "Match goals"]] as const).map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className="h-9 rounded-[9px] text-[13px] font-semibold" style={tab === id ? { background: C.card, color: C.text } : { color: C.dim }} data-testid={`fit-eat-${id}`}>{l}</button>)}
    </div>
    <EatFilters goal={goal} setGoal={setGoal} lim={lim} setLim={setLim} />
    {tab === "near" && <FoodNear data={data} update={update} say={say} filter={filter} />}
    {tab === "chains" && <div className="mt-3 space-y-2">{FOOD_CHAINS.map((c) => <Card key={c.id} className="!p-3.5">
      <button type="button" onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id} className="flex w-full items-center gap-3 text-left" data-testid={`fit-chain-${c.id}`}>
        <BrandLogo domain={c.domain} name={c.name} /><span className="flex-1 text-[19px] leading-none" style={display}>{c.name}</span>
        <ChevronRight className="h-5 w-5 transition-transform" style={{ color: C.dim, transform: open === c.id ? "rotate(90deg)" : undefined }} /></button>
      {open === c.id && <ChainPicks chain={c} filter={filter} update={update} say={say} />}
    </Card>)}</div>}
    {tab === "match" && <div className="mt-3 space-y-2" data-testid="fit-eat-match">
      <p className="px-1 text-[13px]" style={{ color: C.dim }}>{goal === "all" && lim.maxKcal >= NO_LIMITS.maxKcal && lim.minP <= 0 && lim.maxC >= NO_LIMITS.maxC ? "Pick a goal above, or adjust the sliders, to see what fits across every chain." : `${everything.length} ${everything.length === 1 ? "item matches" : "items match"}, best first.`}</p>
      {everything.slice(0, 60).map(({ chain, p }) => <div key={`${chain.id}-${p.name}`} className="rounded-[12px] p-2" style={{ background: C.card }}>
        <div className="mb-1.5 flex items-center gap-2 px-1"><BrandLogo domain={chain.domain} name={chain.name} size={24} /><span className="text-[13px] font-semibold" style={{ color: C.dim }}>{chain.name}</span></div>
        <PickRow name={p.name} m={p} serving="1 order" logName={`${chain.name}: ${p.name}`} update={update} say={say} /></div>)}
      {!everything.length && <p className="py-6 text-center text-[14px]" style={{ color: C.dim }}>Nothing matches. Loosen a filter.</p>}
    </div>}
    <p className="mt-4 px-1 text-[11px] leading-relaxed" style={{ color: C.dim }}>Numbers are close to each chain's published nutrition and can change; check their nutrition info for exact values. "See more" items come from the USDA food database. Places from OpenStreetMap. Logos belong to their companies.</p>
  </Sheet>;
}

/** Ask the AI what to order at a restaurant, fit to what's left of today. Works for places that aren't in any list. */
function MenuAi({ data, update, say, place, cuisine = "" }: { data: FitData; update: Update; say: (m: string) => void; place?: string; cuisine?: string }) {
  const { token } = useAuth();
  const { plus, ask } = usePlus();
  const pts = usePointsMode();
  const [name, setName] = useState(place ?? "");
  const [wants, setWants] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [picks, setPicks] = useState<MenuPick[] | null>(null);
  const run = async () => {
    const target = (place ?? name).trim();
    if (target.length < 2) { setErr("Type a restaurant's name."); return; }
    if (!plus) { ask("eat-out"); return; }
    setErr(""); setBusy(true);
    try {
      const g = goals(data.profile, latestKg(data));
      const t = totals(data.foods.filter((f) => f.date === dayKey()));
      const left = { kcal: Math.max(0, Math.round(g.kcal - t.kcal)), p: Math.max(0, Math.round(g.p - t.p)), c: Math.max(0, Math.round(g.c - t.c)), f: Math.max(0, Math.round(g.f - t.f)) };
      const r = await fitApi<{ picks: MenuPick[] }>(token, "/menu", { method: "POST", body: JSON.stringify({ place: target, cuisine, goal: data.profile.goal, diet: DIET_BY_ID.get(data.profile.dietPlan ?? "balanced")?.name ?? "balanced", mode: pts ? "points" : "calories", wants, left }) });
      setPicks(r.picks); haptic("success");
    } catch (e: any) { if (isPlusError(e)) ask("eat-out"); else setErr(e.message); } finally { setBusy(false); }
  };
  return <div className={place ? "mt-3" : "mb-3"} data-testid="fit-menu-ai">
    {!place && <Card className="!p-4">
      <p className="flex items-center gap-2 text-[17px] leading-none" style={display}><Sparkles className="h-5 w-5" style={{ color: C.lime }} />What should I order?<PlusTag /></p>
      <p className="mt-1 text-[13px]" style={{ color: C.dim }}>Any restaurant, even ones that aren't listed. The AI picks what fits what's left of your day.</p>
      <input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} placeholder="Olive Garden, a sushi place, Texas Roadhouse…" className={`${inputCls} mt-3`} style={inputStyle} aria-label="Restaurant" data-testid="fit-menu-place" />
    </Card>}
    <div className={place ? "" : "mt-2"}>
      <input value={wants} onChange={(e) => setWants(e.target.value.slice(0, 160))} placeholder="Anything specific? (high protein, no dairy, under 600…)" className={inputCls} style={inputStyle} aria-label="What you want" onKeyDown={(e) => { if (e.key === "Enter") void run(); }} />
      <Btn kind={place ? "soft" : "primary"} className="mt-2 w-full" onClick={run} disabled={busy} testId="fit-menu-go">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}{picks ? "Try again" : place ? "Ask AI what to order here" : "Find my best order"}</Btn>
    </div>
    {err && <p className="mt-2 text-[14px]" style={{ color: C.red }} role="alert">{err}</p>}
    {picks && <div className="mt-3 space-y-2" data-testid="fit-menu-picks">
      {picks.map((m, k) => <div key={`${m.name}-${k}`}><PickRow name={m.name} m={m} serving="1 order" logName={`${place ?? name}: ${m.name}`} update={update} say={say} />{m.how && <p className="px-3 pt-1 text-[12px] leading-snug" style={{ color: C.steel }}>{m.how}</p>}</div>)}
      <p className="px-1 text-[11px] leading-relaxed" style={{ color: C.dim }}>AI estimates from typical menus, not the restaurant's published numbers. Ask for the nutrition info if exact values matter.</p>
    </div>}
  </div>;
}

function FoodNear({ data, update, say, filter }: { data: FitData; update: Update; say: (m: string) => void; filter: Filter }) {
  const { list, busy, bar } = useNearby("food");
  const [open, setOpen] = useState<string | null>(null);
  return <div className="mt-3">
    <MenuAi data={data} update={update} say={say} />
    {bar}
    <div className="mt-2 space-y-2">{(list ?? []).slice(0, 40).map((p) => {
      const chain = p.chain ? FOOD_CHAINS.find((c) => c.id === p.chain) : null;
      const tip = chain ? "" : cuisineTip(p.cuisine);
      return <Card key={p.id} className="!p-3.5" testId={`fit-food-near-${p.id}`}>
        <button type="button" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id} className="flex w-full items-center gap-3 text-left">
          {chain ? <BrandLogo domain={chain.domain} name={chain.name} size={38} /> : <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px]" style={{ background: C.card2, color: C.lime }} aria-hidden><Salad className="h-5 w-5" /></span>}
          <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-semibold">{p.name}</span><span className="block truncate text-[12px]" style={{ color: C.dim }}>{away(p.km, data)}{p.cuisine ? ` · ${p.cuisine.replace(/[_;]/g, " ")}` : ""}</span></span>
          <ChevronRight className="h-5 w-5 shrink-0 transition-transform" style={{ color: C.dim, transform: open === p.id ? "rotate(90deg)" : undefined }} /></button>
        {open === p.id && <>
          {chain ? <ChainPicks chain={chain} filter={filter} update={update} say={say} /> : <p className="mt-2 text-[14px]">{tip || "Look for grilled protein, vegetables, and sauces on the side."}</p>}
          <MenuAi data={data} update={update} say={say} place={p.name} cuisine={(p.cuisine ?? "").replace(/[_;]/g, " ")} />
          <a href={directionsUrl(p, apple())} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: C.lime }}><Navigation className="h-4 w-4" />Directions</a>
        </>}
      </Card>;
    })}
      {list && !list.length && !busy && <p className="px-1 text-[14px]" style={{ color: C.dim }}>No places found here. See "Every chain" for what to order anywhere.</p>}
    </div>
  </div>;
}

// ——— Recipes ————————————————————————————————————————————————————————————————————————————————————
export function RecipesSheet({ data, update, onClose, say }: { data: FitData; update: Update; onClose: () => void; say: (m: string) => void }) {
  const { token } = useAuth();
  const [tag, setTag] = useState<RecipeTag | "all">("all");
  const pts = usePointsMode();
  const [open, setOpen] = useState<Recipe | null>(null);
  const [have, setHave] = useState("");
  const [cooking, setCooking] = useState(false);
  const [err, setErr] = useState("");
  const [made, setMade] = useState<Recipe[]>([]);
  const { plus, ask } = usePlus();
  const g = goals(data.profile, latestKg(data));
  const t = totals(data.foods.filter((f) => f.date === dayKey()));
  const left = { kcal: Math.max(0, Math.round(g.kcal - t.kcal)), p: Math.max(0, Math.round(g.p - t.p)) };
  const list = useMemo(() => pickRecipes(left, { tag, hour: new Date().getHours(), goal: data.profile.goal }), [tag, left.kcal, left.p, data.profile.goal]); // eslint-disable-line react-hooks/exhaustive-deps
  const cook = async () => {
    if (!plus) { ask("ai-recipes"); return; }
    setErr(""); setCooking(true);
    try {
      const r = await fitApi<{ recipe: Recipe }>(token, "/recipe", { method: "POST", body: JSON.stringify({ have, goal: data.profile.goal, left }) });
      setMade((m) => [r.recipe, ...m].slice(0, 5)); setOpen(r.recipe); haptic("success");
    } catch (e: any) { if (isPlusError(e)) ask("ai-recipes"); else setErr(e.message); } finally { setCooking(false); }
  };
  const tags: (RecipeTag | "all")[] = ["all", "high-protein", "post-workout", "quick", "low-cal", "breakfast", "lunch", "dinner", "snack", "vegetarian", "meal-prep"];
  return <Sheet title="Recipes" onClose={onClose} testId="fit-recipes">
    <p className="px-1 text-[15px]" style={{ color: C.steel }}>{left.kcal > 0 ? <>You have about <b>{left.kcal} calories</b> and <b>{left.p} g protein</b> left today. Best fits first.</> : "Healthy recipes, most protein per calorie first."}</p>
    <Card className="mt-3 !p-4">
      <p className="flex items-center gap-2 text-[17px] leading-none" style={display}><Sparkles className="h-5 w-5" style={{ color: C.lime }} />Make one from what I have<PlusTag /></p>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (have.trim().length >= 3) void cook(); }}>
        <input value={have} onChange={(e) => setHave(e.target.value.slice(0, 400))} placeholder="chicken, rice, broccoli, eggs…" className={inputCls} style={inputStyle} aria-label="What you have" data-testid="fit-recipe-have" />
        <Btn type="submit" disabled={cooking || have.trim().length < 3} className="!px-3" testId="fit-recipe-make">{cooking ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChefHat className="h-5 w-5" />}<span className="sr-only">Make a recipe</span></Btn>
      </form>
      {err && <p className="mt-2 text-[14px]" style={{ color: C.red }} role="alert">{err}</p>}
    </Card>
    <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">{tags.map((x) => <button key={x} type="button" onClick={() => setTag(x)} aria-pressed={tag === x} className="h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold" style={tag === x ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card2, color: C.text }}>{x === "all" ? "Best for now" : TAG_NAME[x]}</button>)}</div>
    <div className="mt-2 space-y-2">{[...made, ...list].map((r) => <Card key={r.id} onClick={() => setOpen(r)} className="flex items-center gap-3 !p-3" testId={`fit-recipe-${r.id}`}>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px] " style={{ background: C.card2 }} aria-hidden><RecipeIcon id={r.id} tags={r.tags} className="h-6 w-6" /></span>
      <div className="min-w-0 flex-1"><p className="truncate text-[16px] font-semibold">{r.name}</p><p className="text-[12px] tabular-nums" style={{ color: C.dim }}>{amountText(r, pts ? "points" : "calories")} · P {r.p}g · {r.mins} min{r.id.startsWith("ai-") ? " · made for you" : ""}</p></div>
      <ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></Card>)}</div>
    {open && <RecipeDetail r={open} onClose={() => setOpen(null)} onLog={() => { logFood(update, { name: open.name, kcal: open.kcal, p: open.p, c: open.c, f: open.f, serving: "1 serving" }); say(`Logged to ${mealNow()}.`); setOpen(null); }} />}
  </Sheet>;
}

function RecipeDetail({ r, onClose, onLog }: { r: Recipe; onClose: () => void; onLog: () => void }) {
  const pts = usePointsMode();
  return <Sheet title={r.name} onClose={onClose} testId="fit-recipe-detail">
    <div className="grid grid-cols-4 gap-2 text-center">{([[pts ? "Points" : "Cal", pts ? pointsOf(r) : r.kcal], ["Protein", `${r.p}g`], ["Carbs", `${r.c}g`], ["Fat", `${r.f}g`]] as const).map(([l, v]) => <Card key={l} className="!p-2.5"><p className="text-[22px] leading-none tabular-nums" style={display}>{v}</p><p className="mt-1 text-[11px]" style={{ color: C.dim }}>{l}</p></Card>)}</div>
    <p className="mt-2 px-1 text-[13px]" style={{ color: C.dim }}>Per serving · makes {r.serves} · {r.mins} min{r.tags.length ? ` · ${r.tags.map((x) => TAG_NAME[x]).join(", ")}` : ""}</p>
    <Title>Ingredients</Title>
    <Card className="!p-4"><ul className="space-y-1.5">{r.ingredients.map((i, k) => <li key={k} className="text-[15px]">• {i}</li>)}</ul></Card>
    <Title>Steps</Title>
    <Card className="!p-4"><ol className="space-y-2.5">{r.steps.map((s, k) => <li key={k} className="flex gap-3 text-[15px] leading-snug"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] font-bold" style={{ background: C.lime, color: "var(--fit-on-accent)" }}>{k + 1}</span>{s}</li>)}</ol></Card>
    <Btn className="mt-4 w-full" onClick={onLog} testId="fit-recipe-log"><Utensils className="h-5 w-5" />Log 1 serving</Btn>
    {r.id.startsWith("ai-") && <p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>Made by AI: the numbers are estimates.</p>}
  </Sheet>;
}

