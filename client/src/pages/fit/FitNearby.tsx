// Arise Fit: near you, and what to eat.
// - Gyms near me: every gym around you (OpenStreetMap), what each chain usually costs, when gyms are
//   usually busy, and what people there say right now ("it's packed"). Set one as My gym.
// - Eat out: fast food and restaurants nearby with the healthier things to order at each chain, logged
//   to Food in one tap.
// - Recipes: healthy recipes that fit what's left of today, and the AI makes one from what you have.
// Data and numbers: shared/fitNearby.ts and shared/fitRecipes.ts; places come through server/fit.ts.
import { useEffect, useMemo, useState } from "react";
import { ChefHat, ChevronRight, Clock, ExternalLink, Globe, Loader2, LocateFixed, MapPin, Navigation, Plus, Search, Sparkles, Users, Utensils } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { dayKey, goals, uid, type FitData, type Meal } from "@shared/fit";
import { BUSY_WORDS, CHAIN_BY_ID, FOOD_CHAINS, PRICES_CHECKED, REPORT_WORDS, busyCurve, busyLevel, cuisineTip, directionsUrl, gymTypeFor, hourWords, parsePlaces, quietTimes, type BusyLevel, type FoodChain, type NearbyKind, type Place } from "@shared/fitNearby";
import { GYM_BY_ID } from "@shared/fitGym";
import { TAG_NAME, pickRecipes, type Recipe, type RecipeTag } from "@shared/fitRecipes";
import { fitApi, type Update } from "./fitStore";
import { lastPlace, keepPlace, locate } from "./FitRun";
import { latestKg, totals } from "./FitFood";
import { Btn, C, Card, Sheet, Title, display, haptic, inputCls, inputStyle } from "./fitUi";
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
    setBusy(true);
    fitApi<{ elements: any[]; crowd: Record<string, Crowd> }>(token, `/nearby?${new URLSearchParams({ kind, lat: String(from.ll[0]), lng: String(from.ll[1]) })}`)
      .then((r) => { if (!live) return; setList(parsePlaces(r, kind, from.ll, kind === "gyms" ? 25 : 10)); setCrowd(r.crowd ?? {}); setErr(""); })
      .catch((e) => live && setErr(/reach|fetch|network/i.test(e.message) ? "No connection. Check your internet and try again." : e.message))
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
      <div className="mb-3 flex gap-1 overflow-x-auto">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => <button key={d} type="button" onClick={() => setDay(i)} aria-pressed={day === i} className="h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold" style={day === i ? { background: C.lime, color: "#0b0b0c" } : { background: C.card2, color: C.text }}>{d}</button>)}</div>
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
function ChainPicks({ chain, update, say }: { chain: FoodChain; update: Update; say: (m: string) => void }) {
  return <div className="mt-3 space-y-2">
    <p className="text-[13px] leading-snug" style={{ color: C.steel }}>{chain.tip}</p>
    {chain.picks.map((p) => <div key={p.name} className="flex items-center gap-3 rounded-[10px] p-2.5" style={{ background: C.card2 }}>
      <div className="min-w-0 flex-1"><p className="text-[14px] font-semibold leading-snug">{p.name}</p><p className="mt-0.5 text-[12px] tabular-nums" style={{ color: C.dim }}>about {p.kcal} cal · P {p.p}g · C {p.c}g · F {p.f}g</p></div>
      <button type="button" onClick={() => { logFood(update, { name: `${chain.name}: ${p.name}`, kcal: p.kcal, p: p.p, c: p.c, f: p.f, serving: "1 order" }); say(`Logged to ${mealNow()}.`); }} aria-label={`Log ${p.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: C.lime, color: "#0b0b0c" }} data-testid={`fit-log-pick`}><Plus className="h-5 w-5" /></button>
    </div>)}
  </div>;
}

export function EatOut({ data, update, onClose, say }: { data: FitData; update: Update; onClose: () => void; say: (m: string) => void }) {
  const [tab, setTab] = useState<"near" | "chains">("near");
  const [open, setOpen] = useState<string | null>(null);
  return <Sheet title="Eat out" onClose={onClose} testId="fit-eat-out">
    <p className="px-1 text-[15px]" style={{ color: C.steel }}>Healthier picks at places around you. Tap + to log one.</p>
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-[12px] p-1" style={{ background: C.card2 }} role="tablist">
      {([["near", "Near me"], ["chains", "Every chain"]] as const).map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className="h-9 rounded-[9px] text-[13px] font-semibold" style={tab === id ? { background: C.card, color: C.text } : { color: C.dim }} data-testid={`fit-eat-${id}`}>{l}</button>)}
    </div>
    {tab === "near" ? <FoodNear data={data} update={update} say={say} /> : <div className="mt-3 space-y-2">{FOOD_CHAINS.map((c) => <Card key={c.id} className="!p-3.5">
      <button type="button" onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id} className="flex w-full items-center gap-3 text-left" data-testid={`fit-chain-${c.id}`}>
        <span className="text-[24px]" aria-hidden>{c.e}</span><span className="flex-1 text-[19px] leading-none" style={display}>{c.name}</span>
        <ChevronRight className="h-5 w-5 transition-transform" style={{ color: C.dim, transform: open === c.id ? "rotate(90deg)" : undefined }} /></button>
      {open === c.id && <ChainPicks chain={c} update={update} say={say} />}
    </Card>)}</div>}
    <p className="mt-4 px-1 text-[11px] leading-relaxed" style={{ color: C.dim }}>Numbers are close to each chain's published nutrition and can change; check their nutrition info for exact values. Places from OpenStreetMap.</p>
  </Sheet>;
}

function FoodNear({ data, update, say }: { data: FitData; update: Update; say: (m: string) => void }) {
  const { list, busy, bar } = useNearby("food");
  const [open, setOpen] = useState<string | null>(null);
  return <div className="mt-3">
    {bar}
    <div className="mt-2 space-y-2">{(list ?? []).slice(0, 40).map((p) => {
      const chain = p.chain ? FOOD_CHAINS.find((c) => c.id === p.chain) : null;
      const tip = chain ? "" : cuisineTip(p.cuisine);
      return <Card key={p.id} className="!p-3.5" testId={`fit-food-near-${p.id}`}>
        <button type="button" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id} className="flex w-full items-center gap-3 text-left">
          <span className="text-[22px]" aria-hidden>{chain?.e ?? "🥗"}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-semibold">{p.name}</span><span className="block truncate text-[12px]" style={{ color: C.dim }}>{away(p.km, data)}{p.cuisine ? ` · ${p.cuisine.replace(/[_;]/g, " ")}` : ""}</span></span>
          <ChevronRight className="h-5 w-5 shrink-0 transition-transform" style={{ color: C.dim, transform: open === p.id ? "rotate(90deg)" : undefined }} /></button>
        {open === p.id && <>
          {chain ? <ChainPicks chain={chain} update={update} say={say} /> : <p className="mt-2 text-[14px]">{tip || "Look for grilled protein, vegetables, and sauces on the side."}</p>}
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
    <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">{tags.map((x) => <button key={x} type="button" onClick={() => setTag(x)} aria-pressed={tag === x} className="h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold" style={tag === x ? { background: C.lime, color: "#0b0b0c" } : { background: C.card2, color: C.text }}>{x === "all" ? "Best for now" : TAG_NAME[x]}</button>)}</div>
    <div className="mt-2 space-y-2">{[...made, ...list].map((r) => <Card key={r.id} onClick={() => setOpen(r)} className="flex items-center gap-3 !p-3" testId={`fit-recipe-${r.id}`}>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px] text-[26px]" style={{ background: C.card2 }} aria-hidden>{r.e}</span>
      <div className="min-w-0 flex-1"><p className="truncate text-[16px] font-semibold">{r.name}</p><p className="text-[12px] tabular-nums" style={{ color: C.dim }}>{r.kcal} cal · P {r.p}g · {r.mins} min{r.id.startsWith("ai-") ? " · made for you" : ""}</p></div>
      <ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></Card>)}</div>
    {open && <RecipeDetail r={open} onClose={() => setOpen(null)} onLog={() => { logFood(update, { name: open.name, kcal: open.kcal, p: open.p, c: open.c, f: open.f, serving: "1 serving" }); say(`Logged to ${mealNow()}.`); setOpen(null); }} />}
  </Sheet>;
}

function RecipeDetail({ r, onClose, onLog }: { r: Recipe; onClose: () => void; onLog: () => void }) {
  return <Sheet title={r.name} onClose={onClose} testId="fit-recipe-detail">
    <div className="grid grid-cols-4 gap-2 text-center">{([["Cal", r.kcal], ["Protein", `${r.p}g`], ["Carbs", `${r.c}g`], ["Fat", `${r.f}g`]] as const).map(([l, v]) => <Card key={l} className="!p-2.5"><p className="text-[22px] leading-none tabular-nums" style={display}>{v}</p><p className="mt-1 text-[11px]" style={{ color: C.dim }}>{l}</p></Card>)}</div>
    <p className="mt-2 px-1 text-[13px]" style={{ color: C.dim }}>Per serving · makes {r.serves} · {r.mins} min{r.tags.length ? ` · ${r.tags.map((x) => TAG_NAME[x]).join(", ")}` : ""}</p>
    <Title>Ingredients</Title>
    <Card className="!p-4"><ul className="space-y-1.5">{r.ingredients.map((i, k) => <li key={k} className="text-[15px]">• {i}</li>)}</ul></Card>
    <Title>Steps</Title>
    <Card className="!p-4"><ol className="space-y-2.5">{r.steps.map((s, k) => <li key={k} className="flex gap-3 text-[15px] leading-snug"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] font-bold" style={{ background: C.lime, color: "#0b0b0c" }}>{k + 1}</span>{s}</li>)}</ol></Card>
    <Btn className="mt-4 w-full" onClick={onLog} testId="fit-recipe-log"><Utensils className="h-5 w-5" />Log 1 serving</Btn>
    {r.id.startsWith("ai-") && <p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>Made by AI: the numbers are estimates.</p>}
  </Sheet>;
}

