// Meal prep: plan your week of food ahead. Pick a day, add food to each meal (search, recent, saved,
// scan, AI photo, all the usual ways), and its calories and macros add up against your goals as you go.
// "Week view" shows every day side by side once it's done. A planned day goes into the diary in one tap.
// Grocery list: from the meal prep, or from your nutrition plan, checked off as you shop.
import { useMemo, useState } from "react";
import { CalendarRange, Check, ClipboardCopy, Copy, ListChecks, Plus, RefreshCw, Share2, Trash2 } from "lucide-react";
import { dayKey, uid, type FitData, type FoodEntry, type Meal } from "@shared/fit";
import { DIET_BY_ID } from "@shared/fitNutrition";
import { dayGoals } from "@shared/fitVacation";
import { groceryForPlan, groceryFromPrep, groceryText, prepStart, prepSummary, sumFoods, weekDays } from "@shared/fitMealPrep";
import { AddFood, latestKg } from "./FitFood";
import type { Update } from "./fitStore";
import { Bar, Btn, C, Card, Ring, Sheet, Title, display, fmtNum, haptic, inputCls, inputStyle } from "./fitUi";

const MEALS: { id: Meal; label: string }[] = [{ id: "breakfast", label: "Breakfast" }, { id: "lunch", label: "Lunch" }, { id: "dinner", label: "Dinner" }, { id: "snack", label: "Snacks" }];
const dayName = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: "short" }) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, opts);

export function MealPrep({ token, data, update, say, onClose, onGrocery }: { token: string | null; data: FitData; update: Update; say: (m: string) => void; onClose: () => void; onGrocery: () => void }) {
  const prep = data.prep && (weekDays(data.prep.start).includes(dayKey()) || data.prep.start > dayKey()) ? data.prep : null;
  const start = prep?.start ?? prepStart();
  const days = weekDays(start);
  const [day, setDay] = useState(days.includes(dayKey()) ? dayKey() : days[0]);
  const [adding, setAdding] = useState<Meal | null>(null);
  const [view, setView] = useState<"plan" | "week">("plan");
  const foods = prep?.foods ?? [];
  const g = dayGoals(data, latestKg(data), new Date(`${day}T12:00:00`));
  const list = foods.filter((f) => f.date === day);
  const t = sumFoods(list);
  const sum = useMemo(() => prepSummary({ start, foods }), [start, foods]);
  const set = (fn: (f: FoodEntry[]) => FoodEntry[]) => update((d) => { const cur = d.prep && d.prep.start === start ? d.prep.foods : []; return { ...d, prep: { start, foods: fn(cur) } }; });
  const copyTo = (to: string) => { set((f) => [...f.filter((x) => x.date !== to), ...list.map((x) => ({ ...x, id: uid(), date: to }))]); say(`${dayName(day, { weekday: "long" })} copied to ${dayName(to, { weekday: "long" })}.`); };
  const logDay = () => {
    if (!list.length) return;
    update((d) => ({ ...d, foods: [...d.foods.filter((x) => !(x.date === day && list.some((p) => p.name === x.name && p.meal === x.meal))), ...list.map((x) => ({ ...x, id: uid() }))] }));
    haptic("success"); say(`${dayName(day, { weekday: "long" })}'s plan is in your diary.`);
  };
  const left = g.kcal - t.kcal;

  return <Sheet title="Meal prep" onClose={onClose} testId="fit-meal-prep" right={<button type="button" onClick={() => setView(view === "plan" ? "week" : "plan")} className="h-10 rounded-full px-4 text-[14px] font-semibold" style={{ background: C.card2 }} data-testid="fit-prep-view">{view === "plan" ? "Week view" : "Plan a day"}</button>}>
    <p className="-mt-1 mb-3 px-1 text-[14px]" style={{ color: C.dim }}>Plan the week's food ahead. Each day adds up against your goals as you go; tap "Log this day" when you eat it.</p>
    {view === "plan" ? <>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist">{days.map((d) => { const s = sum.days.find((x) => x.date === d)!; const on = d === day;
        return <button key={d} type="button" role="tab" aria-selected={on} onClick={() => { setDay(d); haptic("light"); }} className="flex min-w-[54px] flex-col items-center rounded-[12px] px-2 py-2" style={on ? { background: C.lime, color: C.ink } : { background: C.card2 }}>
          <span className="text-[11px] font-bold uppercase">{dayName(d)}</span><span className="text-[18px] leading-tight" style={display}>{new Date(`${d}T12:00:00`).getDate()}</span>
          <span className="mt-0.5 h-1.5 w-1.5 rounded-full" style={{ background: s.count ? (on ? C.ink : C.lime) : "transparent" }} /></button>; })}</div>

      <Card className="mt-3 flex items-center gap-4 !p-4" testId="fit-prep-totals">
        <Ring value={t.kcal} goal={g.kcal} size={100} stroke={10}><div><p className="text-[24px] leading-none" style={display}>{fmtNum(Math.abs(left))}</p><p className="mt-1 text-[10px]" style={{ color: C.dim }}>cal {left < 0 ? "over" : "left"}</p></div></Ring>
        <div className="min-w-0 flex-1 space-y-2"><Bar label="Protein" value={t.p} goal={g.p} color={C.pink} /><Bar label="Carbs" value={t.c} goal={g.c} color={C.blue} /><Bar label="Fat" value={t.f} goal={g.f} color={C.orange} /></div>
      </Card>

      {MEALS.map((m) => { const items = list.filter((f) => f.meal === m.id);
        return <div key={m.id}><Title right={<span className="text-[13px] font-semibold tabular-nums" style={{ color: C.dim }}>{Math.round(sumFoods(items).kcal)} cal</span>}>{m.label}</Title>
          <Card className="!p-2">{items.map((f) => <div key={f.id} className="flex items-center gap-2 px-2 py-2" style={{ borderBottom: `1px solid ${C.line}` }}>
            <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-medium">{f.name}</p><p className="text-[12px]" style={{ color: C.dim }}>{f.servings !== 1 ? `${f.servings} × ` : ""}{f.serving || "serving"} · P {Math.round(f.p * f.servings)} · C {Math.round(f.c * f.servings)} · F {Math.round(f.f * f.servings)}</p></div>
            <span className="text-[15px] font-semibold tabular-nums">{Math.round(f.kcal * f.servings)}</span>
            <button type="button" onClick={() => set((x) => x.filter((y) => y.id !== f.id))} aria-label={`Remove ${f.name}`} className="grid h-9 w-9 place-items-center" style={{ color: C.dim }}><Trash2 className="h-4 w-4" /></button></div>)}
            <button type="button" onClick={() => setAdding(m.id)} className="flex min-h-11 w-full items-center gap-2 px-2 text-[15px] font-semibold" style={{ color: C.lime }} data-testid={`fit-prep-add-${m.id}`}><Plus className="h-5 w-5" />Plan food</button></Card></div>; })}

      {list.length > 0 && <>
        <Btn className="mt-5 w-full" onClick={logDay} testId="fit-prep-log"><Check className="h-5 w-5" />Log this day in my diary</Btn>
        <div className="mt-3"><p className="mb-1.5 px-1 text-[13px] font-semibold" style={{ color: C.dim }}>Copy {dayName(day, { weekday: "long" })} to</p>
          <div className="flex flex-wrap gap-1.5">{days.filter((d) => d !== day).map((d) => <button key={d} type="button" onClick={() => copyTo(d)} className="flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-semibold" style={{ background: C.card2 }}><Copy className="h-3.5 w-3.5" />{dayName(d)}</button>)}</div></div>
      </>}
    </> : <WeekView data={data} sum={sum} onDay={(d) => { setDay(d); setView("plan"); }} />}

    <Btn kind="soft" className="mt-5 w-full" onClick={onGrocery} testId="fit-prep-grocery"><ListChecks className="h-5 w-5" />Make my grocery list</Btn>
    {foods.length > 0 && <button type="button" onClick={() => { if (window.confirm("Clear this week's meal prep?")) update((d) => ({ ...d, prep: undefined })); }} className="mt-3 h-11 w-full text-[14px] font-semibold" style={{ color: C.red }}>Start over</button>}
    {adding && <AddFood token={token} meal={adding} date={day} data={data} update={update} say={say} verb="Plan for" onClose={() => setAdding(null)}
      sink={(entries) => { set((f) => [...f, ...entries.map((e) => ({ ...e, date: day, meal: adding }))]); say(`Planned for ${dayName(day, { weekday: "long" })}.`); setAdding(null); }} />}
  </Sheet>;
}

function WeekView({ data, sum, onDay }: { data: FitData; sum: ReturnType<typeof prepSummary>; onDay: (d: string) => void }) {
  const g = dayGoals(data, latestKg(data));
  const hi = Math.max(g.kcal * 1.2, ...sum.days.map((d) => d.totals.kcal));
  return <div data-testid="fit-prep-week">
    <Card className="!p-4">
      <p className="text-[13px] font-semibold" style={{ color: C.dim }}>{sum.planned} of 7 days planned · daily average</p>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center">{([["Calories", sum.avg.kcal, g.kcal, ""], ["Protein", sum.avg.p, g.p, "g"], ["Carbs", sum.avg.c, g.c, "g"], ["Fat", sum.avg.f, g.f, "g"]] as const).map(([l, v, goal, u]) =>
        <div key={l}><p className="text-[20px] leading-none tabular-nums" style={display}>{Math.round(v)}<span className="text-[11px]">{u}</span></p><p className="text-[11px]" style={{ color: C.dim }}>{l}</p><p className="text-[10.5px] tabular-nums" style={{ color: Math.abs(v - goal) <= goal * 0.1 ? C.green : C.dim }}>goal {Math.round(goal)}</p></div>)}</div>
    </Card>
    <Card className="mt-3 !p-4"><p className="mb-2 text-[13px] font-semibold" style={{ color: C.dim }}>Calories by day (dashed line: your goal)</p>
      <div className="relative flex h-[120px] items-end gap-2">
        <span aria-hidden className="absolute inset-x-0 border-t border-dashed" style={{ bottom: `${(g.kcal / hi) * 100}%`, borderColor: C.dim }} />
        {sum.days.map((d) => <button key={d.date} type="button" onClick={() => onDay(d.date)} className="flex h-full flex-1 flex-col justify-end" aria-label={`${dayName(d.date, { weekday: "long" })}: ${Math.round(d.totals.kcal)} calories`}>
          <span className="w-full rounded-t-[4px]" style={{ height: `${Math.max(2, (d.totals.kcal / hi) * 100)}%`, background: d.count ? C.lime : C.track }} /></button>)}
      </div>
      <div className="mt-1 flex gap-2">{sum.days.map((d) => <span key={d.date} className="flex-1 text-center text-[11px] font-semibold" style={{ color: C.dim }}>{dayName(d.date).slice(0, 2)}</span>)}</div>
    </Card>
    <div className="mt-3 space-y-2">{sum.days.map((d) => <Card key={d.date} onClick={() => onDay(d.date)} className="flex items-center gap-3 !p-3">
      <CalendarRange className="h-5 w-5 shrink-0" style={{ color: d.count ? C.lime : C.dim }} />
      <div className="min-w-0 flex-1"><p className="font-semibold">{dayName(d.date, { weekday: "long", month: "short", day: "numeric" })}</p><p className="text-[12.5px] tabular-nums" style={{ color: C.dim }}>{d.count ? `${Math.round(d.totals.kcal)} cal · P ${Math.round(d.totals.p)} · C ${Math.round(d.totals.c)} · F ${Math.round(d.totals.f)}` : "Not planned yet"}</p></div></Card>)}</div>
  </div>;
}

export function GroceryList({ data, update, say, onClose }: { data: FitData; update: Update; say: (m: string) => void; onClose: () => void }) {
  const list = data.grocery;
  const [extra, setExtra] = useState("");
  const g = dayGoals(data, latestKg(data));
  const diet = DIET_BY_ID.get(data.profile.dietPlan ?? "balanced")!;
  const prepFoods = data.prep?.foods ?? [];
  const build = (from: "prep" | "plan") => {
    const items = from === "prep" ? groceryFromPrep(prepFoods) : groceryForPlan(diet.id, g.kcal);
    update((d) => ({ ...d, grocery: { made: new Date().toISOString(), from: from === "prep" ? "Meal prep" : `${diet.name} plan`, items } }));
    haptic("success"); say(`Grocery list made: ${items.length} items.`);
  };
  const toggle = (id: string) => update((d) => d.grocery ? { ...d, grocery: { ...d.grocery, items: d.grocery.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)) } } : d);
  const share = async () => {
    if (!list) return;
    const text = groceryText(list.items);
    try { if (navigator.share) { await navigator.share({ title: "Grocery list", text }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(text); say("Copied. Paste it anywhere."); } catch { window.prompt("Copy your list:", text); }
  };
  const aisles = list ? [...new Set(list.items.map((i) => i.aisle))] : [];
  const left = list ? list.items.filter((i) => !i.done).length : 0;
  return <Sheet title="Grocery list" onClose={onClose} testId="fit-grocery" right={list ? <button type="button" onClick={() => void share()} aria-label="Share the list" className="grid h-10 w-10 place-items-center rounded-full" style={{ background: C.card2 }}><Share2 className="h-5 w-5" /></button> : undefined}>
    {!list ? <>
      <p className="-mt-1 mb-3 px-1 text-[14px]" style={{ color: C.dim }}>Make a week's shopping list in one tap.</p>
      {prepFoods.length > 0 && <Card onClick={() => build("prep")} className="!p-4" testId="fit-grocery-from-prep"><p className="text-[18px] leading-tight" style={display}>From my meal prep</p><p className="mt-1 text-[13px]" style={{ color: C.dim }}>Every food you planned this week, added up and sorted by aisle.</p></Card>}
      <Card onClick={() => build("plan")} className="mt-2 !p-4" testId="fit-grocery-from-plan"><p className="text-[18px] leading-tight" style={display}>From my {diet.name} plan</p><p className="mt-1 text-[13px]" style={{ color: C.dim }}>Staples that fit your plan, in amounts for 7 days at about {fmtNum(g.kcal)} calories a day.</p></Card>
    </> : <>
      <p className="-mt-1 mb-2 px-1 text-[13px]" style={{ color: C.dim }}>From {list.from} · {left} of {list.items.length} left</p>
      {aisles.map((a) => <div key={a}><Title>{a}</Title><Card className="!p-1">{list.items.filter((i) => i.aisle === a).map((i) => <button key={i.id} type="button" onClick={() => toggle(i.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left" style={{ borderBottom: `1px solid ${C.line}` }} aria-pressed={i.done}>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full" style={i.done ? { background: C.lime, color: C.ink } : { boxShadow: `inset 0 0 0 2px ${C.line}` }}>{i.done && <Check className="h-4 w-4" strokeWidth={3} />}</span>
        <span className="min-w-0 flex-1 text-[15px]" style={i.done ? { color: C.dim, textDecoration: "line-through" } : undefined}>{i.name}</span>
        <span className="shrink-0 text-[13px] tabular-nums" style={{ color: C.dim }}>{i.qty}</span></button>)}</Card></div>)}
      <form onSubmit={(e) => { e.preventDefault(); const n = extra.trim(); if (!n) return; update((d) => d.grocery ? { ...d, grocery: { ...d.grocery, items: [...d.grocery.items, { id: uid(), name: n.slice(0, 80), qty: "", aisle: "Added by you", done: false }] } } : d); setExtra(""); }} className="mt-4 flex gap-2">
        <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Add an item" className={inputCls} style={inputStyle} aria-label="Add an item" />
        <Btn type="submit" kind="soft" disabled={!extra.trim()}><Plus className="h-5 w-5" /></Btn></form>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Btn kind="soft" onClick={() => void share()}><ClipboardCopy className="h-5 w-5" />Share</Btn>
        <Btn kind="soft" onClick={() => update((d) => ({ ...d, grocery: undefined }))}><RefreshCw className="h-5 w-5" />New list</Btn>
      </div>
    </>}
  </Sheet>;
}
