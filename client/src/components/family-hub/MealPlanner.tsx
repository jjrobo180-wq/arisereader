// Meal planner (a Plugin Store add-on): plan the week's meals, pick from the Recipe box, and put
// the whole week's ingredients on the Grocery list in one tap.
import { useState } from "react";
import { ChevronLeft, ChevronRight, ShoppingCart, X } from "lucide-react";
import { addDaysTo } from "@shared/lifePlugins";
import type { MealSlot } from "@shared/familyHub";
import { addToGroceries } from "./Recipes";
import { PageHead, Panel, plain, primary, type SectionProps } from "./ui";

const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

export default function MealPlanner({ family, setFamily, today, makeId, say }: SectionProps) {
  const monday = (() => { const d = new Date(`${today}T12:00:00Z`).getUTCDay(); return addDaysTo(today, -((d + 6) % 7)); })();
  const [start, setStart] = useState(monday);
  const days = Array.from({ length: 7 }, (_, i) => addDaysTo(start, i));
  const [draft, setDraft] = useState<Record<string, string>>({});
  const key = (d: string, s: MealSlot) => `${d}|${s}`;
  const mealsAt = (d: string, s: MealSlot) => family.meals.filter((m) => m.date === d && m.slot === s);
  const recipeName = (id: string) => family.recipes.find((r) => r.id === id)?.title || "";

  const add = (d: string, s: MealSlot, value: string) => {
    const v = value.trim();
    if (!v) return;
    const recipe = family.recipes.find((r) => r.title.toLowerCase() === v.toLowerCase());
    setFamily((f) => ({ ...f, meals: [...f.meals, { id: makeId(), date: d, slot: s, text: recipe ? "" : v.slice(0, 120), recipeId: recipe?.id || "" }] }));
    setDraft((x) => ({ ...x, [key(d, s)]: "" }));
  };
  const shopWeek = () => {
    const lines = family.meals.filter((m) => days.includes(m.date) && m.recipeId).flatMap((m) => family.recipes.find((r) => r.id === m.recipeId)?.ingredients ?? []);
    if (!lines.length) { say("Plan a few meals from your Recipe box first. Their ingredients go on the list."); return; }
    let added = 0;
    setFamily((f) => { const out = addToGroceries(f, lines, makeId); added = out.added; return out.family; });
    window.setTimeout(() => say(added ? `Added ${added} item${added === 1 ? "" : "s"} to your Grocery list.` : "Everything's already on your Grocery list."), 0);
  };

  return <div className="space-y-6">
    <PageHead eyebrow="Meal planner" title="What's for dinner?" blurb="Plan the week. Type a meal or pick one from your Recipe box, then send the week's ingredients to the Grocery list." action={<button type="button" onClick={shopWeek} className={primary}><ShoppingCart size={16} />Shop this week</button>} />
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => setStart(addDaysTo(start, -7))} className={plain + " px-2"} aria-label="Last week"><ChevronLeft size={17} /></button>
      <p className="min-w-0 flex-1 text-center text-sm font-black">{new Date(`${days[0]}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {new Date(`${days[6]}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
      {start !== monday && <button type="button" onClick={() => setStart(monday)} className={plain}>This week</button>}
      <button type="button" onClick={() => setStart(addDaysTo(start, 7))} className={plain + " px-2"} aria-label="Next week"><ChevronRight size={17} /></button>
    </div>
    <datalist id="meal-recipes">{family.recipes.map((r) => <option key={r.id} value={r.title} />)}</datalist>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{days.map((d) => <Panel key={d} className={d === today ? "ring-2 ring-violet-300" : ""}>
      <p className="mb-3 text-sm font-black">{new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}{d === today && <span className="ml-2 text-xs text-violet-600">Today</span>}</p>
      <div className="space-y-3">{SLOTS.map((s) => <div key={s}>
        <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-slate-400">{s}</p>
        {mealsAt(d, s).map((m) => <p key={m.id} className="mt-1 flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 text-sm font-bold text-orange-900"><span className="min-w-0 flex-1 truncate">{m.recipeId ? `🍳 ${recipeName(m.recipeId) || "(deleted recipe)"}` : m.text}</span>
          <button type="button" onClick={() => setFamily((f) => ({ ...f, meals: f.meals.filter((x) => x.id !== m.id) }))} className="rounded p-0.5 text-orange-400 hover:text-rose-600" aria-label="Remove"><X size={13} /></button></p>)}
        <form onSubmit={(e) => { e.preventDefault(); add(d, s, draft[key(d, s)] || ""); }}><input list="meal-recipes" value={draft[key(d, s)] || ""} onChange={(e) => setDraft((x) => ({ ...x, [key(d, s)]: e.target.value }))} onBlur={(e) => add(d, s, e.target.value)} maxLength={120} placeholder="+ Add" className="mt-1 w-full rounded-lg border border-dashed border-slate-200 bg-transparent px-2 py-1 text-sm outline-none focus:border-violet-300" aria-label={`${s} on ${d}`} /></form>
      </div>)}</div>
    </Panel>)}</div>
    {!family.recipes.length && <p className="text-xs text-slate-500">Tip: add the Recipe box plugin so you can pick recipes here and shop for them in one tap.</p>}
  </div>;
}
