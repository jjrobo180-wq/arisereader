// Arise Fit nutrition: the day's food by meal, with search (USDA + Open Food Facts), barcode scanning,
// a photo or description estimated by AI, recent foods and quick add. Uses the same food lookup as the
// Calorie counter in Arise To Duo (server/foodLookup.ts).
import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Bookmark, Camera, Check, ChevronLeft, ChevronRight, Copy, Droplets, Loader2, Plus, ScanLine, Search, Sparkles, Trash2, Utensils, Zap } from "lucide-react";
import { dayKey, goals, uid, type FitData, type FoodEntry, type Meal, type SavedMeal } from "@shared/fit";
import type { FoundFood } from "@shared/foodLookup";
import { estimateMeal, lookupBarcode, searchFoods, shrinkPhoto } from "@/lib/foodLookup";
import { canUseCamera, scanWithCamera } from "@/lib/barcodeScanner";
import { DIET_BY_ID, DIET_PLANS, pointsBudget, pointsOf } from "@shared/fitNutrition";
import type { Update } from "./fitStore";
import { FastingCard, FastingSheet } from "./FitFasting";
import { Bar, Btn, C, Card, Chips, Ring, Sheet, Title, display, fmtNum, inputCls, inputStyle } from "./fitUi";

const MEALS: { id: Meal; label: string }[] = [{ id: "breakfast", label: "Breakfast" }, { id: "lunch", label: "Lunch" }, { id: "dinner", label: "Dinner" }, { id: "snack", label: "Snacks" }];
type Picked = { name: string; kcal: number; p: number; c: number; f: number; serving?: string };
const fromFound = (f: FoundFood): Picked => ({ name: f.brand ? `${f.name} (${f.brand})` : f.name, kcal: f.calories, p: f.protein, c: f.carbs, f: f.fat, serving: f.serving });
export const totals = (foods: FoodEntry[]) => foods.reduce((t, f) => ({ kcal: t.kcal + f.kcal * f.servings, p: t.p + f.p * f.servings, c: t.c + f.c * f.servings, f: t.f + f.f * f.servings }), { kcal: 0, p: 0, c: 0, f: 0 });
export const latestKg = (d: FitData) => d.weights.length ? d.weights[d.weights.length - 1].kg : undefined;

type AddTab = "search" | "recent" | "meals" | "scan" | "ai" | "quick";
function AddFood({ token, meal, date, data, update, onClose, say, start = "search" }: { token: string | null; meal: Meal; date: string; data: FitData; update: Update; onClose: () => void; say: (m: string) => void; start?: AddTab }) {
  const [tab, setTab] = useState<AddTab>(start);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<FoundFood[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [servings, setServings] = useState("1");
  const [quick, setQuick] = useState({ name: "", kcal: "", p: "", c: "", f: "" });
  const [ai, setAi] = useState<{ text: string; image: string | null; foods: FoundFood[] }>({ text: "", image: null, foods: [] });
  const [camera, setCamera] = useState(false);
  const [code, setCode] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const t = q.trim(); if (tab !== "search" || t.length < 2) { setFound(null); return; }
    const ctrl = new AbortController(); setBusy(true); setErr("");
    const timer = window.setTimeout(() => searchFoods(token, t, ctrl.signal).then((b) => { setFound(b.foods); setBusy(false); }).catch((e) => { if (!ctrl.signal.aborted) { setErr(e.message); setBusy(false); } }), 350);
    return () => { ctrl.abort(); window.clearTimeout(timer); };
  }, [q, tab, token]);
  useEffect(() => {
    if (!camera || !video.current) return;
    return scanWithCamera(video.current, (value) => { navigator.vibrate?.(40); setCamera(false); void barcode(value); }, (e) => { setCamera(false); setErr(e); });
  }, [camera]); // eslint-disable-line react-hooks/exhaustive-deps
  const barcode = async (value: string) => { setBusy(true); setErr(""); try { setPicked(fromFound(await lookupBarcode(token, value))); setServings("1"); } catch (e: any) { setErr(e?.message || "That product wasn't found."); } finally { setBusy(false); } };
  const add = (p: Picked, n: number) => {
    const entry: FoodEntry = { id: uid(), date, meal, name: p.name, kcal: p.kcal, p: p.p, c: p.c, f: p.f, servings: n, ...(p.serving ? { serving: p.serving } : {}) };
    update((d) => ({ ...d, foods: [...d.foods, entry], recentFoods: [{ name: p.name, kcal: p.kcal, p: p.p, c: p.c, f: p.f, servings: 1, ...(p.serving ? { serving: p.serving } : {}) }, ...d.recentFoods.filter((r) => r.name !== p.name)].slice(0, 60) }));
    say(`Added ${p.name}.`); onClose();
  };
  const addMeal = (m: SavedMeal) => {
    update((d) => ({ ...d, foods: [...d.foods, ...m.items.map((i) => ({ ...i, id: uid(), date, meal }))] }));
    say(`Added ${m.name}.`); onClose();
  };
  const row = (f: Picked, k: number | string) => <button key={k} type="button" onClick={() => { setPicked(f); setServings("1"); }} className="flex w-full items-center gap-3 rounded-[10px] p-3 text-left" style={{ background: C.card }}>
    <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{f.name}</span><span className="block truncate text-[12px]" style={{ color: C.dim }}>{f.serving || "1 serving"} · P {Math.round(f.p)} · C {Math.round(f.c)} · F {Math.round(f.f)}</span></span>
    <span className="shrink-0 text-[15px] font-bold">{Math.round(f.kcal)}<span className="text-[11px] font-normal" style={{ color: C.dim }}> cal</span></span></button>;

  if (picked) {
    const n = Math.max(0.05, Number(servings) || 1);
    return <Sheet title="Add food" onClose={() => setPicked(null)}>
      <h2 className="mt-2 text-[20px] font-bold leading-tight">{picked.name}</h2>
      <p className="text-[13px]" style={{ color: C.dim }}>{picked.serving || "1 serving"}</p>
      <div className="mt-4 flex items-center gap-3"><span className="text-[15px] font-semibold">Servings</span>
        <input inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))} aria-label="Servings" className={`${inputCls} !w-28 text-center font-bold`} style={inputStyle} />
        {[0.5, 1, 2].map((v) => <button key={v} type="button" onClick={() => setServings(String(v))} className="h-11 rounded-[8px] px-3 text-[14px] font-semibold" style={{ background: C.card2 }}>{v}</button>)}</div>
      <div className="mt-6 grid grid-cols-4 gap-2 text-center">{[["Calories", picked.kcal, ""], ["Protein", picked.p, "g"], ["Carbs", picked.c, "g"], ["Fat", picked.f, "g"]].map(([l, v, u]) =>
        <Card key={l as string} className="!p-3"><p className="text-[20px] font-bold">{Math.round((v as number) * n)}<span className="text-[11px]" style={{ color: C.dim }}>{u}</span></p><p className="text-[11px]" style={{ color: C.dim }}>{l}</p></Card>)}</div>
      <div className="mt-2 flex items-center justify-between rounded-[10px] px-4 py-3" style={{ background: C.card }}><span className="text-[14px]" style={{ color: C.dim }}>Arise Points</span><span className="text-[26px] leading-none" style={{ ...display, color: C.lime }} data-testid="fit-food-points">{pointsOf({ kcal: picked.kcal * n, p: picked.p * n, c: picked.c * n, f: picked.f * n })}</span></div>
      <Btn className="mt-8 w-full" onClick={() => add(picked, n)} testId="fit-food-add">Add to {MEALS.find((m) => m.id === meal)?.label}</Btn>
    </Sheet>;
  }
  return <Sheet title={`Add to ${MEALS.find((m) => m.id === meal)?.label}`} onClose={onClose} testId="fit-add-food">
    <Chips label="How to add" value={tab} onChange={(t) => { setTab(t); setErr(""); }} items={[{ id: "ai", label: "AI photo" }, { id: "search", label: "Search" }, { id: "recent", label: "Recent" }, { id: "meals", label: "My meals" }, { id: "scan", label: "Barcode" }, { id: "quick", label: "Quick add" }]} />
    {err && <p className="mt-3 rounded-[8px] p-3 text-[14px]" style={{ background: "rgba(255,77,77,.12)", color: "#ff9c9c" }} role="status">{err}</p>}
    {tab === "search" && <>
      <div className="relative mt-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: C.dim }} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods, brands and restaurants" className={`${inputCls} pl-10`} style={inputStyle} data-testid="fit-food-search" /></div>
      {busy && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" style={{ color: C.dim }} /></div>}
      <div className="mt-3 space-y-2">{(found || []).map((f, k) => row(fromFound(f), k))}</div>
      {found && !found.length && !busy && <p className="py-8 text-center" style={{ color: C.dim }}>Nothing found. Try another word, or Quick add.</p>}
    </>}
    {tab === "meals" && <div className="mt-3 space-y-2">{(data.savedMeals ?? []).length ? (data.savedMeals ?? []).map((m) => { const t = totals(m.items.map((i) => ({ ...i, id: "", date, meal }))); return <div key={m.id} className="flex items-center gap-2 rounded-[10px] p-3" style={{ background: C.card }}>
      <button type="button" onClick={() => { addMeal(m); }} className="min-w-0 flex-1 text-left" data-testid={`fit-meal-${m.id}`}><span className="block truncate text-[17px] leading-tight" style={display}>{m.name}</span><span className="block truncate text-[12px]" style={{ color: C.dim }}>{m.items.length} foods · {Math.round(t.kcal)} cal · P {Math.round(t.p)}g</span></button>
      <button type="button" aria-label={`Delete ${m.name}`} onClick={() => update((d) => ({ ...d, savedMeals: (d.savedMeals ?? []).filter((x) => x.id !== m.id) }))} className="grid h-9 w-9 place-items-center" style={{ color: C.dim }}><Trash2 className="h-4 w-4" /></button>
    </div>; }) : <p className="py-8 text-center text-[14px]" style={{ color: C.dim }}>Save a meal from your diary (tap the bookmark next to a meal) to add it again in one tap.</p>}</div>}
    {tab === "recent" && <div className="mt-3 space-y-2">{data.recentFoods.length ? data.recentFoods.map((f, k) => row(f, k)) : <p className="py-8 text-center" style={{ color: C.dim }}>Foods you add show up here.</p>}</div>}
    {tab === "scan" && <div className="mt-3">
      {camera ? <div className="overflow-hidden rounded-[14px] bg-black"><video ref={video} playsInline muted className="aspect-[4/3] w-full object-cover" /><Btn kind="soft" className="w-full !rounded-none" onClick={() => setCamera(false)}>Cancel</Btn></div>
        : canUseCamera() && <Btn className="w-full" onClick={() => setCamera(true)} testId="fit-scan"><ScanLine className="h-5 w-5" />Scan a barcode</Btn>}
      <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) void barcode(code.trim()); }} className="mt-3 flex gap-2">
        <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 14))} placeholder="Or type the barcode number" className={inputCls} style={inputStyle} />
        <Btn type="submit" kind="soft" disabled={busy || code.length < 8}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Find"}</Btn></form>
    </div>}
    {tab === "ai" && <div className="mt-3 space-y-3">
      <textarea value={ai.text} onChange={(e) => setAi({ ...ai, text: e.target.value.slice(0, 500) })} rows={3} placeholder="Describe what you ate, e.g. “2 eggs, toast with butter and a latte”" className="w-full rounded-[8px] p-3 text-[17px] outline-none" style={inputStyle} />
      <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold" style={{ background: C.card2 }}>
        <Camera className="h-5 w-5" />{ai.image ? "Photo added. Change it" : "Take or choose a photo"}
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { setAi((a) => ({ ...a, image: null })); const img = await shrinkPhoto(f); setAi((a) => ({ ...a, image: img })); } catch (er: any) { setErr(er.message); } } }} />
      </label>
      {ai.image && <img src={ai.image} alt="Your meal" className="max-h-56 w-full rounded-[12px] object-cover" />}
      <Btn className="w-full" disabled={busy || (!ai.text.trim() && !ai.image)} onClick={async () => { setBusy(true); setErr(""); try { const foods = await estimateMeal(token, ai.text.trim(), ai.image); setAi((a) => ({ ...a, foods })); if (!foods.length) setErr("No food found. Try describing it in more detail."); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }} testId="fit-ai-estimate">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}Estimate calories</Btn>
      <div className="space-y-2">{ai.foods.map((f, k) => row(fromFound(f), k))}</div>
      {ai.foods.length > 1 && <Btn className="w-full" onClick={() => { const items = ai.foods.map((f) => ({ ...fromFound(f), servings: 1 })); update((d) => ({ ...d, foods: [...d.foods, ...items.map((i) => ({ id: uid(), date, meal, name: i.name, kcal: i.kcal, p: i.p, c: i.c, f: i.f, servings: 1, ...(i.serving ? { serving: i.serving } : {}) }))] })); say(`Added ${items.length} foods.`); onClose(); }} testId="fit-ai-add-each">Add each food ({ai.foods.length})</Btn>}
      {ai.foods.length > 1 && <Btn kind="soft" className="w-full" onClick={() => { const t = ai.foods.reduce((a, f) => ({ kcal: a.kcal + f.calories, p: a.p + f.protein, c: a.c + f.carbs, f: a.f + f.fat }), { kcal: 0, p: 0, c: 0, f: 0 }); add({ name: ai.text.trim().slice(0, 60) || "Meal", ...t }, 1); }}>Add all as one meal</Btn>}
      <p className="text-[12px]" style={{ color: C.dim }}>AI estimates can be off. Check the numbers before you add them.</p>
    </div>}
    {tab === "quick" && <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); const k = Number(quick.kcal); if (k > 0) add({ name: quick.name.trim() || "Quick add", kcal: k, p: Number(quick.p) || 0, c: Number(quick.c) || 0, f: Number(quick.f) || 0 }, 1); }}>
      <input value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value.slice(0, 80) })} placeholder="Name (optional)" className={inputCls} style={inputStyle} />
      <input inputMode="numeric" value={quick.kcal} onChange={(e) => setQuick({ ...quick, kcal: e.target.value.replace(/\D/g, "").slice(0, 5) })} placeholder="Calories" className={inputCls} style={inputStyle} data-testid="fit-quick-kcal" />
      <div className="grid grid-cols-3 gap-2">{(["p", "c", "f"] as const).map((k) => <input key={k} inputMode="decimal" value={quick[k]} onChange={(e) => setQuick({ ...quick, [k]: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) })} placeholder={k === "p" ? "Protein g" : k === "c" ? "Carbs g" : "Fat g"} className={inputCls} style={inputStyle} />)}</div>
      <Btn type="submit" className="w-full" disabled={!(Number(quick.kcal) > 0)}><Zap className="h-5 w-5" />Add</Btn>
    </form>}
    <p className="mt-6 text-[11px]" style={{ color: C.dim }}>Food data from USDA FoodData Central and Open Food Facts.</p>
  </Sheet>;
}

/** The last 7 days against the goals: averages, days on target, and a bar for each day. */
export function weekStats(data: FitData, end = new Date()) {
  const g = goals(data.profile, latestKg(data));
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(end); d.setDate(d.getDate() - (6 - i)); const k = dayKey(d); const t = totals(data.foods.filter((f) => f.date === k)); return { k, label: d.toLocaleDateString(undefined, { weekday: "short" }), ...t, logged: t.kcal > 0 }; });
  const logged = days.filter((d) => d.logged);
  const avg = (f: (x: (typeof days)[number]) => number) => (logged.length ? Math.round(logged.reduce((t, x) => t + f(x), 0) / logged.length) : 0);
  const onTarget = logged.filter((d) => Math.abs(d.kcal - g.kcal) <= g.kcal * 0.1).length;
  const proteinHit = logged.filter((d) => d.p >= g.p * 0.9).length;
  return { g, days, logged: logged.length, kcal: avg((x) => x.kcal), p: avg((x) => x.p), c: avg((x) => x.c), f: avg((x) => x.f), onTarget, proteinHit };
}

function WeekReport({ data, onClose }: { data: FitData; onClose: () => void }) {
  const w = weekStats(data);
  const max = Math.max(w.g.kcal * 1.2, ...w.days.map((d) => d.kcal));
  return <Sheet title="This week" onClose={onClose} testId="fit-report">
    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
      {([[fmtNum(w.kcal), `avg cal (goal ${fmtNum(w.g.kcal)})`], [`${w.onTarget}/${w.logged}`, "days on target"], [`${w.proteinHit}/${w.logged}`, "protein goal hit"]] as const).map(([v, l]) => <Card key={l} className="!px-1 !py-3"><p className="text-[26px] leading-none" style={display}>{v}</p><p className="mt-1 text-[11px] leading-tight" style={{ color: C.dim }}>{l}</p></Card>)}
    </div>
    <Card className="mt-3 !p-4"><div className="relative flex h-40 items-end gap-2">
      <div className="pointer-events-none absolute inset-x-0 border-t border-dashed" style={{ bottom: `${(w.g.kcal / max) * 100}%`, borderColor: C.lime }} />
      {w.days.map((d) => <div key={d.k} className="flex min-w-0 flex-1 flex-col items-center gap-1"><div className="w-full rounded-t-[4px]" style={{ height: `${Math.max(3, (d.kcal / max) * 140)}px`, background: !d.logged ? C.card2 : Math.abs(d.kcal - w.g.kcal) <= w.g.kcal * 0.1 ? C.lime : d.kcal > w.g.kcal ? C.orange : C.blue }} /><span className="text-[11px]" style={{ color: C.dim }}>{d.label}</span></div>)}
    </div><p className="mt-2 text-[12px]" style={{ color: C.dim }}>Dashed line: your daily goal. Orange: over by 10%+, blue: under.</p></Card>
    <Title>Average macros</Title>
    <Card className="space-y-2.5 !p-4"><Bar label="Protein" value={w.p} goal={w.g.p} color={C.pink} /><Bar label="Carbs" value={w.c} goal={w.g.c} color={C.blue} /><Bar label="Fat" value={w.f} goal={w.g.f} color={C.orange} /></Card>
    {w.logged < 7 && <p className="mt-3 px-1 text-[13px]" style={{ color: C.dim }}>{7 - w.logged} day{7 - w.logged === 1 ? "" : "s"} this week with nothing logged. Log every meal for an accurate picture.</p>}
  </Sheet>;
}

/** Pick a nutrition plan (it sets the macro split) and count food in calories or Arise Points. */
export function PlanSheet({ data, update, onClose }: { data: FitData; update: Update; onClose: () => void }) {
  const g = goals(data.profile, latestKg(data));
  const points = data.profile.trackMode === "points";
  const choose = (id: string) => { const plan = DIET_BY_ID.get(id)!; update((d) => ({ ...d, profile: { ...d.profile, dietPlan: id, macroSplit: plan.split } })); };
  return <Sheet title="Nutrition plan" onClose={onClose} testId="fit-plan">
    <Title>Track by</Title>
    <div className="grid grid-cols-2 gap-2">
      {([["calories", "Calories", `${fmtNum(g.kcal)} a day plus macros`], ["points", "Arise Points", `${pointsBudget(g)} points a day`]] as const).map(([id, l, sub]) => <button key={id} type="button" onClick={() => update((d) => ({ ...d, profile: { ...d.profile, trackMode: id === "points" ? "points" : undefined } }))} aria-pressed={(id === "points") === points}
        className="rounded-[10px] p-3 text-left" style={(id === "points") === points ? { background: "linear-gradient(180deg, rgba(255,90,31,.25), rgba(255,90,31,.08))", boxShadow: "inset 0 0 0 1px #ff5a1f" } : { background: C.card }} data-testid={`fit-mode-${id}`}>
        <span className="block text-[20px] leading-none" style={display}>{l}</span><span className="mt-1 block text-[12px]" style={{ color: C.dim }}>{sub}</span></button>)}
    </div>
    <p className="mt-2 px-1 text-[12px] leading-snug" style={{ color: C.dim }}>Arise Points: every food gets a score from its calories, fat and protein. Lean protein scores low, fatty and sugary food scores high. Stay under your daily points.</p>
    <Title>Plan</Title>
    <div className="space-y-2">{DIET_PLANS.map((d) => { const on = (data.profile.dietPlan ?? "balanced") === d.id; return <button key={d.id} type="button" onClick={() => choose(d.id)} aria-pressed={on}
      className="w-full rounded-[12px] p-4 text-left" style={on ? { background: "linear-gradient(180deg, rgba(255,90,31,.22), rgba(255,90,31,.06))", boxShadow: "inset 0 0 0 1px #ff5a1f" } : { background: C.card }} data-testid={`fit-diet-${d.id}`}>
      <span className="flex items-center justify-between gap-2"><span className="text-[22px] leading-none" style={display}>{d.name}</span>{on && <Check className="h-5 w-5" style={{ color: C.lime }} />}</span>
      <span className="mt-1 block text-[14px] leading-snug" style={{ color: C.steel }}>{d.blurb}</span>
      <span className="mt-2 flex gap-3 text-[12px] font-semibold tabular-nums" style={{ color: C.dim }}><span>Protein {d.split.p}%</span><span>Carbs {d.split.c}%</span><span>Fat {d.split.f}%</span>{d.carbCap !== undefined && <span>≤{d.carbCap} g carbs</span>}</span>
      {on && <ul className="mt-3 space-y-1 text-[13px]" style={{ color: C.text }}>{d.tips.map((t) => <li key={t} className="flex gap-2"><span style={{ color: C.lime }}>▸</span>{t}</li>)}</ul>}
    </button>; })}</div>
    <p className="mt-6 text-[11px] leading-relaxed" style={{ color: C.dim }}>Plans set your daily macro targets from your calorie goal (Progress → Settings). Check with a doctor before a major diet change.</p>
  </Sheet>;
}

export function FoodTab({ token, data, update, say }: { token: string | null; data: FitData; update: Update; say: (m: string) => void }) {
  const [date, setDate] = useState(dayKey());
  const [adding, setAdding] = useState<{ meal: Meal; start?: AddTab } | null>(null);
  const [plan, setPlan] = useState(false);
  const [report, setReport] = useState(false);
  const [fasting, setFasting] = useState(false);
  const today = date === dayKey();
  const foods = useMemo(() => data.foods.filter((f) => f.date === date), [data.foods, date]);
  const t = totals(foods);
  const g = goals(data.profile, latestKg(data));
  const water = data.water[date] || 0;
  const points = data.profile.trackMode === "points";
  const used = foods.reduce((n, f) => n + pointsOf({ kcal: f.kcal * f.servings, p: f.p * f.servings, c: f.c * f.servings, f: f.f * f.servings }), 0);
  const budget = pointsBudget(g);
  const diet = DIET_BY_ID.get(data.profile.dietPlan ?? "balanced")!;
  const cap = diet.carbCap;
  const nowMeal: Meal = (() => { const h = new Date().getHours(); return h < 10 ? "breakfast" : h < 15 ? "lunch" : h < 21 ? "dinner" : "snack"; })();
  const yesterday = (() => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() - 1); return dayKey(d); })();
  const copyYesterday = (m: Meal) => {
    const prev = data.foods.filter((f) => f.date === yesterday && f.meal === m);
    if (!prev.length) return;
    update((d) => ({ ...d, foods: [...d.foods, ...prev.map((f) => ({ ...f, id: uid(), date }))] })); say(`Copied yesterday's ${m}.`);
  };
  const saveMeal = (m: Meal, items: FoodEntry[]) => {
    const name = window.prompt("Name this meal", `${MEALS.find((x) => x.id === m)?.label} · ${items.map((i) => i.name.split(" (")[0]).slice(0, 2).join(", ")}`.slice(0, 60));
    if (!name?.trim()) return;
    update((d) => ({ ...d, savedMeals: [{ id: uid(), name: name.trim().slice(0, 60), items: items.map(({ id, date: _d, meal: _m, ...rest }) => rest) }, ...(d.savedMeals ?? [])].slice(0, 60) })); say("Meal saved. Find it under My meals.");
  };
  const shift = (n: number) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + n); setDate(dayKey(d)); };
  return <div>
    <div className="flex items-center justify-between">
      <button type="button" onClick={() => shift(-1)} aria-label="Day before" className="grid h-11 w-11 place-items-center rounded-full" style={{ background: C.card }}><ChevronLeft className="h-5 w-5" /></button>
      <p className="text-[16px] font-bold">{today ? "Today" : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
      <button type="button" onClick={() => shift(1)} disabled={today} aria-label="Next day" className="grid h-11 w-11 place-items-center rounded-full disabled:opacity-30" style={{ background: C.card }}><ChevronRight className="h-5 w-5" /></button>
    </div>
    {today && <div className="mt-3 grid grid-cols-[1.4fr_1fr] gap-2">
      <button type="button" onClick={() => setAdding({ meal: nowMeal, start: "ai" })} className="flex min-h-[74px] items-center gap-3 rounded-[14px] px-4 text-left" style={{ background: "linear-gradient(150deg, #ff5a1f, #b8360a)", color: "#0b0b0c" }} data-testid="fit-snap-meal">
        <Camera className="h-7 w-7 shrink-0" /><span><span className="block text-[22px] leading-none" style={display}>Snap a meal</span><span className="text-[12px] font-semibold">AI counts it for you</span></span></button>
      <button type="button" onClick={() => setAdding({ meal: nowMeal, start: "scan" })} className="flex min-h-[74px] items-center gap-2 rounded-[14px] px-3 text-left" style={{ background: C.card2 }} data-testid="fit-scan-quick">
        <ScanLine className="h-6 w-6 shrink-0" style={{ color: C.lime }} /><span className="text-[18px] leading-none" style={display}>Scan barcode</span></button>
    </div>}
    <Card className="mt-3 flex items-center gap-4 !p-4">
      {points
        ? <Ring value={used} goal={budget} size={112} stroke={11}><div><p className="text-[30px] leading-none" style={display}>{Math.abs(budget - used)}</p><p className="mt-1 text-[11px]" style={{ color: C.dim }}>points {used > budget ? "over" : "left"}</p></div></Ring>
        : <Ring value={t.kcal} goal={g.kcal} size={112} stroke={11}><div><p className="text-[28px] leading-none" style={display}>{fmtNum(Math.abs(g.kcal - t.kcal))}</p><p className="mt-1 text-[11px]" style={{ color: C.dim }}>{t.kcal > g.kcal ? "cal over" : "cal left"}</p></div></Ring>}
      <div className="min-w-0 flex-1 space-y-2.5"><Bar label="Protein" value={t.p} goal={g.p} color={C.pink} /><Bar label={cap !== undefined ? `Carbs (cap ${cap})` : "Carbs"} value={t.c} goal={cap !== undefined ? Math.min(g.c, cap) || cap : g.c} color={C.blue} /><Bar label="Fat" value={t.f} goal={g.f} color={C.orange} /></div>
    </Card>
    <button type="button" onClick={() => setPlan(true)} className="mt-2 flex w-full items-center gap-3 rounded-[12px] px-4 py-3 text-left" style={{ background: C.card }} data-testid="fit-open-plan">
      <Utensils className="h-5 w-5 shrink-0" style={{ color: C.lime }} />
      <span className="min-w-0 flex-1"><span className="block text-[17px] leading-none" style={display}>{diet.name} plan</span><span className="mt-0.5 block text-[12px]" style={{ color: C.dim }}>{points ? `Arise Points · ${budget} a day` : `Calories · ${fmtNum(g.kcal)} a day`} · P{diet.split.p} C{diet.split.c} F{diet.split.f}</span></span>
      <ChevronRight className="h-5 w-5" style={{ color: C.dim }} />
    </button>
    {today && <div className="mt-2"><FastingCard data={data} update={update} onOpen={() => setFasting(true)} /></div>}
    {MEALS.map((m) => {
      const list = foods.filter((f) => f.meal === m.id); const k = totals(list).kcal;
      const kp = list.reduce((n, f) => n + pointsOf({ kcal: f.kcal * f.servings, p: f.p * f.servings, c: f.c * f.servings, f: f.f * f.servings }), 0);
      const hadYesterday = !list.length && data.foods.some((f) => f.date === yesterday && f.meal === m.id);
      return <div key={m.id}><Title right={<span className="flex items-center gap-1">
        {hadYesterday && <button type="button" onClick={() => copyYesterday(m.id)} className="flex h-8 items-center gap-1 rounded-[6px] px-2 text-[12px] font-semibold" style={{ background: C.card, color: C.lime }} data-testid={`fit-copy-${m.id}`}><Copy className="h-3.5 w-3.5" />Yesterday</button>}
        {list.length >= 2 && <button type="button" onClick={() => saveMeal(m.id, list)} aria-label={`Save ${m.label} as a meal`} className="grid h-8 w-8 place-items-center rounded-[6px]" style={{ background: C.card, color: C.dim }} data-testid={`fit-save-${m.id}`}><Bookmark className="h-4 w-4" /></button>}
        <span className="ml-1 text-[13px] font-semibold tabular-nums" style={{ color: C.dim }}>{points ? `${kp} pts` : `${Math.round(k)} cal`}</span></span>}>{m.label}</Title>
        <Card className="!p-2">
          {list.map((f) => <div key={f.id} className="flex items-center gap-2 px-2 py-2" style={{ borderBottom: `1px solid ${C.line}` }}>
            <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-medium">{f.name}</p><p className="text-[12px]" style={{ color: C.dim }}>{f.servings !== 1 ? `${f.servings} × ` : ""}{f.serving || "serving"}</p></div>
            <span className="text-right text-[15px] font-semibold tabular-nums">{points ? <>{pointsOf({ kcal: f.kcal * f.servings, p: f.p * f.servings, c: f.c * f.servings, f: f.f * f.servings })}<span className="text-[11px] font-normal" style={{ color: C.dim }}> pts</span></> : Math.round(f.kcal * f.servings)}</span>
            <button type="button" onClick={() => update((d) => ({ ...d, foods: d.foods.filter((x) => x.id !== f.id) }))} aria-label={`Remove ${f.name}`} className="grid h-9 w-9 place-items-center" style={{ color: C.dim }}><Trash2 className="h-4 w-4" /></button>
          </div>)}
          <button type="button" onClick={() => setAdding({ meal: m.id })} className="flex min-h-11 w-full items-center gap-2 px-2 text-[15px] font-semibold" style={{ color: C.lime }} data-testid={`fit-add-${m.id}`}><Plus className="h-5 w-5" />Add food</button>
        </Card></div>;
    })}
    <Title right={<span className="text-[13px] font-semibold tabular-nums" style={{ color: C.dim }}>{(water / 1000).toFixed(2)} / {(data.profile.waterGoalMl / 1000).toFixed(1)} L</span>}>Water</Title>
    <Card className="flex items-center gap-3 !p-3"><Droplets className="h-7 w-7 shrink-0" style={{ color: C.blue }} />
      <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.08)" }}><div className="h-full rounded-full" style={{ width: `${Math.min(100, (water / data.profile.waterGoalMl) * 100)}%`, background: C.blue }} /></div>
      {[250, 500].map((ml) => <Btn key={ml} kind="soft" className="!min-h-10 !px-3 text-[14px]" onClick={() => update((d) => ({ ...d, water: { ...d.water, [date]: (d.water[date] || 0) + ml } }))}>+{ml}</Btn>)}
    </Card>
    <button type="button" onClick={() => setReport(true)} className="mt-4 flex w-full items-center gap-3 rounded-[12px] px-4 py-3 text-left" style={{ background: C.card }} data-testid="fit-open-report">
      <BarChart3 className="h-5 w-5 shrink-0" style={{ color: C.lime }} /><span className="flex-1 text-[17px] leading-none" style={display}>Weekly nutrition report</span><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></button>
    {adding && <AddFood token={token} meal={adding.meal} start={adding.start} date={date} data={data} update={update} onClose={() => setAdding(null)} say={say} />}
    {report && <WeekReport data={data} onClose={() => setReport(false)} />}
    {plan && <PlanSheet data={data} update={update} onClose={() => setPlan(false)} />}
    {fasting && <FastingSheet data={data} update={update} onClose={() => setFasting(false)} />}
  </div>;
}
