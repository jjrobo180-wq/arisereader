// Recipe box (a Plugin Store add-on): the family's recipes in one place, with a one-tap way to put
// a recipe's ingredients on the Grocery list.
import { useState } from "react";
import { ChefHat, Clock, Pencil, Search, ShoppingCart, Trash2, Users } from "lucide-react";
import { guessAisle, ingredientToGrocery } from "@shared/lifePlugins";
import type { Family, Recipe } from "@shared/familyHub";
import { Empty, Modal, PageHead, Panel, danger, inputClass, plain, primary, soft, type SectionProps } from "./ui";

/** Puts ingredient lines on the Grocery list, skipping what's already on it. Used by the Meal planner too. */
export function addToGroceries(f: Family, lines: string[], makeId: () => string): { family: Family; added: number } {
  const have = new Set(f.groceries.filter((g) => !g.checked).map((g) => g.name.toLowerCase()));
  const fresh = lines.map(ingredientToGrocery).filter((i) => i.name && !have.has(i.name.toLowerCase()) && (have.add(i.name.toLowerCase()), true));
  return { family: { ...f, groceries: [...f.groceries, ...fresh.map((i) => ({ id: makeId(), name: i.name, qty: i.qty, aisle: guessAisle(i.name), checked: false }))] }, added: fresh.length };
}

const blank = (): Recipe => ({ id: "", title: "", ingredients: [], steps: "", tags: "", servings: 4, minutes: 30 });

export default function Recipes({ family, setFamily, makeId, say }: SectionProps) {
  const [editing, setEditing] = useState<(Recipe & { ingredientText: string }) | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const list = family.recipes.filter((r) => !q || `${r.title} ${r.tags} ${r.ingredients.join(" ")}`.toLowerCase().includes(q));
  const viewing = family.recipes.find((r) => r.id === open);

  const save = () => {
    if (!editing || !editing.title.trim()) return;
    const row: Recipe = { ...editing, id: editing.id || makeId(), title: editing.title.trim(), ingredients: editing.ingredientText.split("\n").map((s) => s.trim()).filter(Boolean) };
    delete (row as any).ingredientText;
    setFamily((f) => ({ ...f, recipes: editing.id ? f.recipes.map((r) => (r.id === row.id ? row : r)) : [...f.recipes, row] }));
    setEditing(null);
    say(`${row.title} saved.`);
  };
  const shop = (r: Recipe) => {
    let added = 0;
    setFamily((f) => { const out = addToGroceries(f, r.ingredients, makeId); added = out.added; return out.family; });
    window.setTimeout(() => say(added ? `Added ${added} item${added === 1 ? "" : "s"} to your Grocery list.` : "Everything's already on your Grocery list."), 0);
  };

  return <div className="space-y-6">
    <PageHead eyebrow="Recipe box" title="Family recipes" blurb="Keep your go-to recipes in one place. One tap puts the ingredients on your Grocery list." action={<button type="button" onClick={() => setEditing({ ...blank(), ingredientText: "" })} className={primary}><ChefHat size={16} />New recipe</button>} />
    <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipes, tags or ingredients" className={inputClass + " pl-9"} aria-label="Search recipes" /></label>
    {list.length ? <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{list.map((r) => <li key={r.id}>
      <button type="button" onClick={() => setOpen(r.id)} className="h-full w-full rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5 text-left shadow-[0_8px_28px_#17152b08] transition hover:shadow-lg">
        <p className="text-lg font-black text-[#232139]">{r.title}</p>
        <p className="mt-1 flex flex-wrap gap-3 text-xs font-bold text-slate-500">{r.minutes > 0 && <span className="flex items-center gap-1"><Clock size={13} />{r.minutes} min</span>}{r.servings > 0 && <span className="flex items-center gap-1"><Users size={13} />Serves {r.servings}</span>}<span>{r.ingredients.length} ingredients</span></p>
        {r.tags && <p className="mt-3 flex flex-wrap gap-1">{r.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => <span key={t} className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700">{t}</span>)}</p>}
      </button>
    </li>)}</ul> : <Panel><Empty icon={<ChefHat />} title={q ? "No recipes match." : "No recipes yet."}>{q ? "Try another word." : "Add the dishes your family loves."}</Empty></Panel>}

    {viewing && <Modal title={viewing.title} eyebrow="Recipe" onClose={() => setOpen(null)} wide>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => shop(viewing)} className={primary}><ShoppingCart size={16} />Add to grocery list</button>
        <button type="button" onClick={() => { setEditing({ ...viewing, ingredientText: viewing.ingredients.join("\n") }); setOpen(null); }} className={plain}><Pencil size={15} />Edit</button>
        <button type="button" onClick={() => { if (window.confirm(`Delete ${viewing.title}?`)) { setFamily((f) => ({ ...f, recipes: f.recipes.filter((r) => r.id !== viewing.id) })); setOpen(null); } }} className={danger}><Trash2 size={15} />Delete</button>
      </div>
      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div><h3 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-400">Ingredients</h3><ul className="space-y-1.5 text-sm">{viewing.ingredients.map((i, n) => <li key={n} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />{i}</li>)}</ul></div>
        <div><h3 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-400">Steps</h3><p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{viewing.steps || "No steps written yet."}</p></div>
      </div>
    </Modal>}

    {editing && <Modal title={editing.id ? "Edit recipe" : "New recipe"} eyebrow="Recipe box" onClose={() => setEditing(null)} wide>
      <div className="space-y-3">
        <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} maxLength={120} placeholder="Recipe name" className={inputClass} aria-label="Recipe name" autoFocus />
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs font-bold text-slate-500">Minutes<input type="number" min={0} value={editing.minutes} onChange={(e) => setEditing({ ...editing, minutes: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })} className={inputClass + " mt-1"} /></label>
          <label className="text-xs font-bold text-slate-500">Serves<input type="number" min={0} value={editing.servings} onChange={(e) => setEditing({ ...editing, servings: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })} className={inputClass + " mt-1"} /></label>
          <label className="text-xs font-bold text-slate-500">Tags<input value={editing.tags} onChange={(e) => setEditing({ ...editing, tags: e.target.value })} maxLength={120} placeholder="dinner, quick" className={inputClass + " mt-1"} /></label>
        </div>
        <textarea value={editing.ingredientText} onChange={(e) => setEditing({ ...editing, ingredientText: e.target.value })} rows={6} placeholder={"One per line:\n2 cups flour\n1 tsp salt\n3 eggs"} className={inputClass + " py-3 leading-6"} aria-label="Ingredients" />
        <textarea value={editing.steps} onChange={(e) => setEditing({ ...editing, steps: e.target.value })} rows={6} maxLength={8000} placeholder="Steps" className={inputClass + " py-3 leading-6"} aria-label="Steps" />
        <div className="flex gap-2"><button type="button" onClick={save} disabled={!editing.title.trim()} className={primary}>Save recipe</button><button type="button" onClick={() => setEditing(null)} className={soft}>Cancel</button></div>
      </div>
    </Modal>}
  </div>;
}
