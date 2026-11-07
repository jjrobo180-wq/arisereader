// The Kitchen planner's engine (November 2026). Everything here is exact arithmetic on saved choices — no guessing,
// so the same plan always gives the same list and total:
//   need   = every meal × every person eating it × that person's serving of each ingredient
//   packs  = whole packages of the chosen product that cover the need
//   cost   = packs × the product's price (built-in estimate, the store's price, or one you typed)
//   left   = what's left in the last package — the planner suggests sharing or using it.
// The plan is saved with the family (family.kitchen), so everyone in the family sees the same week.
import { GROUP_BY_ID, PRODUCTS, groupOf, parseSize, type KGroup, type KProduct, type KUnit } from "./kitchenProducts";
import { K_DISHES, K_SLOTS, type KDish, type KPart, type KSlot } from "./kitchenDishes";

export { K_DISHES, K_SLOTS, PRODUCTS, groupOf };
export type { KDish, KPart, KSlot, KProduct, KGroup, KUnit };

export const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type KDay = (typeof WEEK)[number];
export const DAY_LABEL: Record<KDay, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
export const DAY_SHORT: Record<KDay, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
export const cell = (day: KDay, slot: KSlot) => `${day}:${slot}`;

export type KPerson = { id: string; name: string; /** 1 is a regular adult serving; 0.5 a small child's. */ portion: number };
export type KMeal = { id: string; dish: string; /** Who eats it. Empty means everyone. */ people: string[] };
const packsFor = (need: number, size: number) => (need <= 0 ? 0 : Math.max(1, Math.ceil(need / size - 1e-9)));
export type KDishEdit = { parts?: KPart[]; takeout?: { place: string; perPerson: number } };
export type KPrice = { price: number; source: "store" | "you"; at: string };
export type Kitchen = {
  setup: boolean;
  people: KPerson[];
  week: Record<string, KMeal[]>;
  /** The product picked for an ingredient (brand and size). */
  choice: Record<string, string>;
  /** Prices that replace the built-in estimate: the store's, or one you typed. They only change when you change them. */
  prices: Record<string, KPrice>;
  /** Products added from the store or by hand. */
  products: KProduct[];
  own: KDish[];
  edits: Record<string, KDishEdit>;
  /** One person's own serving: servings[personId]["dishId:group"] = amount (e.g. 4 cookies). */
  servings: Record<string, Record<string, number>>;
  /** Ingredients already at home (true, left off the list) or to buy even though they are staples (false). */
  have: Record<string, boolean>;
  store: { id: string; name: string; zip: string } | null;
};

export const emptyKitchen = (): Kitchen => ({ setup: false, people: [], week: {}, choice: {}, prices: {}, products: [], own: [], edits: {}, servings: {}, have: {}, store: null });

// ── Reading a saved plan safely ────────────────────────────────────────────────────────────────────────────────
const o = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {});
const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const n = (v: unknown, min: number, max: number, fb = 0) => { const x = Number(v); return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : fb; };
const isSlot = (v: unknown): v is KSlot => K_SLOTS.some((x) => x.id === v);
const cleanParts = (v: unknown): KPart[] => (Array.isArray(v) ? v : []).slice(0, 30).map((p) => ({ group: s(o(p).group, 60), per: n(o(p).per, 0, 1000) })).filter((p) => p.group && GROUP_BY_ID.has(p.group) && p.per > 0);
const cleanProduct = (v: unknown): KProduct | null => {
  const r = o(v); const group = s(r.group, 60); const id = s(r.id, 80);
  if (!id || !GROUP_BY_ID.has(group)) return null;
  return { id, group, name: s(r.name, 120) || groupOf(group)!.name, brand: s(r.brand, 60), size: n(r.size, 0.01, 100000, 1), label: s(r.label, 60), price: Math.round(n(r.price, 0, 1000) * 100) / 100, source: r.source === "store" ? "store" : "you", ...(s(r.storeId, 40) ? { storeId: s(r.storeId, 40) } : {}), ...(s(r.at, 30) ? { at: s(r.at, 30) } : {}) };
};

export function cleanKitchen(raw: unknown): Kitchen {
  const r = o(raw);
  const rawPeople = (Array.isArray(r.people) ? r.people : []).slice(0, 12).map((p: unknown) => ({ id: s(o(p).id, 60), name: s(o(p).name, 40).trim(), portion: n(o(p).portion, 0.1, 4, 1) })).filter((p: KPerson) => p.id && p.name);
  // The same person twice (a name in the family list twice, or added again by hand) is one person: their meals move to the first.
  const sameAs = new Map<string, string>();
  const people: KPerson[] = [];
  for (const p of rawPeople as KPerson[]) { const twin = people.find((q) => q.id === p.id || q.name.trim().toLowerCase() === p.name.trim().toLowerCase()); if (twin) sameAs.set(p.id, twin.id); else people.push(p); }
  const own = (Array.isArray(r.own) ? r.own : []).slice(0, 100).map((d: unknown): KDish | null => {
    const x = o(d); const id = s(x.id, 80), name = s(x.name, 80).trim();
    return id && name && isSlot(x.slot) ? { id, slot: x.slot, name, kcal: n(x.kcal, 0, 5000), minutes: n(x.minutes, 0, 1440), tags: [], pop: 0, parts: cleanParts(x.parts), own: true } : null;
  }).filter(Boolean) as KDish[];
  const dishIds = new Set([...K_DISHES.map((d) => d.id), ...own.map((d) => d.id)]);
  const week: Record<string, KMeal[]> = {};
  for (const day of WEEK) for (const sl of K_SLOTS) {
    const key = cell(day, sl.id);
    const meals = (Array.isArray(o(r.week)[key]) ? o(r.week)[key] : []).slice(0, 8).map((m: unknown) => ({ id: s(o(m).id, 60), dish: s(o(m).dish, 80), people: [...new Set((Array.isArray(o(m).people) ? o(m).people : []).slice(0, 12).map((x: unknown) => s(x, 60)).filter(Boolean).map((x: string) => sameAs.get(x) ?? x))] as string[] })).filter((m: KMeal) => m.id && dishIds.has(m.dish));
    if (meals.length) week[key] = meals;
  }
  const products = (Array.isArray(r.products) ? r.products : []).slice(0, 400).map(cleanProduct).filter(Boolean) as KProduct[];
  const productIds = new Set([...PRODUCTS.map((p) => p.id), ...products.map((p) => p.id)]);
  const choice = Object.fromEntries(Object.entries(o(r.choice)).filter(([g, p]) => GROUP_BY_ID.has(g) && typeof p === "string" && productIds.has(p)).slice(0, 300)) as Record<string, string>;
  const prices = Object.fromEntries(Object.entries(o(r.prices)).filter(([id]) => productIds.has(id)).slice(0, 600).map(([id, p]) => [id, { price: Math.round(n(o(p).price, 0, 1000) * 100) / 100, source: o(p).source === "store" ? "store" : "you", at: s(o(p).at, 30) } as KPrice]));
  const edits = Object.fromEntries(Object.entries(o(r.edits)).filter(([id]) => dishIds.has(id)).slice(0, 200).map(([id, e]) => {
    const x = o(e); const t = o(x.takeout);
    return [id, { ...(Array.isArray(x.parts) ? { parts: cleanParts(x.parts) } : {}), ...(x.takeout ? { takeout: { place: s(t.place, 60), perPerson: Math.round(n(t.perPerson, 0, 500) * 100) / 100 } } : {}) }];
  }).filter(([, e]) => Object.keys(e as object).length)) as Record<string, KDishEdit>;
  const servings = Object.fromEntries(Object.entries(o(r.servings)).slice(0, 12).map(([pid, m]) => [s(pid, 60), Object.fromEntries(Object.entries(o(m)).slice(0, 300).map(([k, v]) => [s(k, 140), n(v, 0, 1000)]).filter(([, v]) => (v as number) >= 0))]));
  const have = Object.fromEntries(Object.entries(o(r.have)).filter(([g, v]) => GROUP_BY_ID.has(g) && typeof v === "boolean")) as Record<string, boolean>;
  const st = o(r.store);
  return { setup: r.setup === true, people, week, choice, prices, products, own, edits, servings, have, store: s(st.id, 40) ? { id: s(st.id, 40), name: s(st.name, 80), zip: s(st.zip, 10) } : null };
}

// ── Looking things up ──────────────────────────────────────────────────────────────────────────────────────────
export const allDishes = (k: Kitchen) => [...K_DISHES, ...k.own];
export const dishOf = (k: Kitchen, id: string) => K_DISHES.find((d) => d.id === id) ?? k.own.find((d) => d.id === id);
export const partsOf = (k: Kitchen, d: KDish): KPart[] => k.edits[d.id]?.parts ?? d.parts;
export const takeoutOf = (k: Kitchen, id: string) => k.edits[id]?.takeout;
const priced = (k: Kitchen, p: KProduct): KProduct => { const x = k.prices[p.id]; return x ? { ...p, price: x.price, source: x.source, at: x.at } : p; };
export const productsFor = (k: Kitchen, group: string): KProduct[] => [...PRODUCTS, ...k.products].filter((p) => p.group === group).map((p) => priced(k, p));
export const productById = (k: Kitchen, id: string) => { const p = [...k.products, ...PRODUCTS].find((x) => x.id === id); return p ? priced(k, p) : undefined; };
/** What to buy for an ingredient: the product you picked (as many as needed), or else the cheapest mix of package
 *  sizes that covers this week's need (a 3 lb family pack and a 1 lb pack can beat four 1 lb packs). */
export type KBuy = { product: KProduct; packs: number };
export function bestBuy(k: Kitchen, group: string, need: number): KBuy[] {
  const picked = k.choice[group] && productById(k, k.choice[group]);
  if (picked) return need > 0 ? [{ product: picked, packs: packsFor(need, picked.size) }] : [];
  const shelf = productsFor(k, group);
  if (!shelf.length || need <= 0) return [];
  let best: { buy: KBuy[]; cost: number; left: number } | null = null;
  const consider = (buy: KBuy[]) => {
    const cost = buy.reduce((a, b) => a + b.packs * b.product.price, 0), got = buy.reduce((a, b) => a + b.packs * b.product.size, 0);
    if (got + 1e-9 < need) return;
    const left = got - need;
    if (!best || cost < best.cost - 1e-9 || (Math.abs(cost - best.cost) < 1e-9 && left < best.left)) best = { buy: buy.filter((b) => b.packs > 0), cost, left };
  };
  for (const a of shelf) {
    const max = Math.min(40, Math.ceil(need / a.size - 1e-9));
    for (let na = 0; na <= max; na++) {
      const rest = need - na * a.size;
      if (rest <= 1e-9) { consider([{ product: a, packs: na }]); break; }
      for (const b of shelf) if (b.id !== a.id) consider([{ product: a, packs: na }, { product: b, packs: packsFor(rest, b.size) }]);
      consider([{ product: a, packs: na + packsFor(rest, a.size) - (na ? 0 : 0) }]);
    }
  }
  return (best as { buy: KBuy[] } | null)?.buy.sort((x, y) => y.packs * y.product.size - x.packs * x.product.size) ?? [];
}
/** The main product bought for an ingredient (for showing and swapping). */
export const chosen = (k: Kitchen, group: string, need = 0): KProduct | undefined => bestBuy(k, group, need)[0]?.product ?? productsFor(k, group)[0];
export const pickedByYou = (k: Kitchen, group: string) => !!k.choice[group] && !!productById(k, k.choice[group]);
/** Already at home: what you said, or for staples like oil and spices, yes until you say you need it. */
export const atHome = (k: Kitchen, group: string) => k.have[group] ?? !!groupOf(group)?.staple;
export const peopleIn = (k: Kitchen, m: KMeal) => (m.people.length ? k.people.filter((p) => m.people.includes(p.id)) : k.people);
/** How much of an ingredient one person eats in one serving of a dish. */
export const amountFor = (k: Kitchen, person: KPerson, dish: KDish, part: KPart) => {
  const own = k.servings[person.id]?.[`${dish.id}:${part.group}`];
  return typeof own === "number" ? own : part.per * person.portion;
};
export const unitPrice = (p: KProduct) => (p.size > 0 ? p.price / p.size : Infinity);

// ── The shopping math ──────────────────────────────────────────────────────────────────────────────────────────
export type KUse = { key: string; day: KDay; slot: KSlot; dish: KDish; person: KPerson; amount: number };
export type KLine = { group: KGroup; product: KProduct; buy: KBuy[]; need: number; packs: number; got: number; cost: number; left: number; uses: KUse[]; have: boolean };
const r2 = (x: number) => Math.round(x * 100) / 100;

export function uses(k: Kitchen): KUse[] {
  const out: KUse[] = [];
  for (const day of WEEK) for (const sl of K_SLOTS) for (const m of k.week[cell(day, sl.id)] ?? []) {
    const dish = dishOf(k, m.dish); if (!dish || takeoutOf(k, dish.id)) continue;
    for (const person of peopleIn(k, m)) for (const part of partsOf(k, dish)) {
      const amount = amountFor(k, person, dish, part);
      if (amount > 0) out.push({ key: part.group, day, slot: sl.id, dish, person, amount });
    }
  }
  return out;
}

export function shoppingLines(k: Kitchen): KLine[] {
  const by = new Map<string, KUse[]>();
  for (const u of uses(k)) by.set(u.key, [...(by.get(u.key) ?? []), u]);
  const lines: KLine[] = [];
  for (const [g, us] of by) {
    const group = groupOf(g); if (!group) continue;
    const need = us.reduce((a, u) => a + u.amount, 0);
    const have = atHome(k, g);
    const buy = have ? [] : bestBuy(k, g, need);
    const product = buy[0]?.product ?? chosen(k, g); if (!product) continue;
    const got = buy.reduce((a, b) => a + b.packs * b.product.size, 0);
    lines.push({ group, product, buy, need, packs: buy.reduce((a, b) => a + b.packs, 0), got, cost: r2(buy.reduce((a, b) => a + b.packs * b.product.price, 0)), left: have ? 0 : Math.max(0, got - need), uses: us, have });
  }
  const aisle = ["Produce", "Meat & seafood", "Deli", "Dairy & eggs", "Bread & bakery", "Pantry", "Snacks", "Frozen"];
  return lines.sort((a, b) => aisle.indexOf(a.group.aisle) - aisle.indexOf(b.group.aisle) || a.group.name.localeCompare(b.group.name));
}

export type KTakeout = { dish: KDish; place: string; perPerson: number; servings: number; cost: number };
export function takeoutLines(k: Kitchen): KTakeout[] {
  const by = new Map<string, KTakeout>();
  for (const key of Object.keys(k.week)) for (const m of k.week[key]) {
    const dish = dishOf(k, m.dish); const t = dish && takeoutOf(k, dish.id); if (!dish || !t) continue;
    const people = peopleIn(k, m).length;
    const cur = by.get(dish.id) ?? { dish, place: t.place, perPerson: t.perPerson, servings: 0, cost: 0 };
    cur.servings += people; cur.cost = r2(cur.servings * t.perPerson); by.set(dish.id, cur);
  }
  return [...by.values()];
}

/** The week's total, and each person's share (an ingredient's cost split by how much of it each person eats). */
export function totals(k: Kitchen) {
  const lines = shoppingLines(k), take = takeoutLines(k);
  const groceries = r2(lines.reduce((a, l) => a + l.cost, 0)), takeout = r2(take.reduce((a, t) => a + t.cost, 0));
  const share: Record<string, number> = Object.fromEntries(k.people.map((p) => [p.id, 0]));
  for (const l of lines) { if (!l.need) continue; for (const u of l.uses) share[u.person.id] = (share[u.person.id] ?? 0) + (l.cost * u.amount) / l.need; }
  for (const key of Object.keys(k.week)) for (const m of k.week[key]) { const t = takeoutOf(k, m.dish); if (t) for (const p of peopleIn(k, m)) share[p.id] = (share[p.id] ?? 0) + t.perPerson; }
  for (const id of Object.keys(share)) share[id] = r2(share[id]);
  return { groceries, takeout, total: r2(groceries + takeout), share, lines, take };
}

// ── Amounts in words ───────────────────────────────────────────────────────────────────────────────────────────
const trim = (x: number) => (Math.round(x * 10) / 10).toString();
const plural = (w: string) => (/(s|x|ch|sh|o)$/.test(w) ? `${w}es` : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : `${w}s`);
export function amountText(x: number, g: KGroup): string {
  if (g.unit === "ct") { const v = Math.round(x * 100) / 100; const each = g.each ?? "piece"; const word = Math.abs(v - 1) < 0.01 ? each : plural(each); return `${trim(v)} ${word}`; }
  if (g.unit === "oz") return x >= 16 ? `${trim(x / 16)} lb` : `${trim(x)} oz`;
  return x >= 128 ? `${trim(x / 128)} gal` : x >= 32 ? `${trim(x / 32)} qt` : x >= 8 ? `${trim(x / 8)} cups` : `${trim(x)} fl oz`;
}
export const money = (x: number) => `$${(Number.isFinite(x) ? x : 0).toFixed(2)}`;
export const productText = (p: KProduct) => `${p.brand && p.brand !== "Fresh" ? `${p.brand} ` : ""}${p.label === "each" || p.brand === "Fresh" ? p.name : p.label}`;
export const buyText = (buy: KBuy[]) => buy.map((b) => `${b.packs > 1 ? `${b.packs} × ` : ""}${productText(b.product)}`).join(" + ");
const names = (list: string[]) => (list.length <= 1 ? list.join("") : list.length === 2 ? `${list[0]} and ${list[1]}` : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`);

// ── Ways to save ───────────────────────────────────────────────────────────────────────────────────────────────
export type KTip =
  | { kind: "bulk"; id: string; text: string; save: number; group: string; /** null: let the planner pick the cheapest. */ product: string | null; button: string }
  | { kind: "leftover"; id: string; text: string; button: string; day: KDay; slot: KSlot; dish: string; people: string[] }
  | { kind: "shared"; id: string; text: string }
  | { kind: "saved"; id: string; text: string; save: number };

export function tips(k: Kitchen): KTip[] {
  const out: KTip[] = [];
  const lines = shoppingLines(k);
  for (const l of lines) {
    if (l.have || !l.need) continue;
    // Cheaper packages for the same need: offered when you picked the product yourself,
    // and noted when the planner already chose the bulk pack for you.
    if (pickedByYou(k, l.group.id)) {
      const auto = bestBuy({ ...k, choice: { ...k.choice, [l.group.id]: "" } }, l.group.id, l.need);
      const c = r2(auto.reduce((x, y) => x + y.packs * y.product.price, 0));
      if (auto.length && c < l.cost - 0.24) out.push({ kind: "bulk", id: `bulk-${l.group.id}`, group: l.group.id, product: null, save: r2(l.cost - c),
        text: `${l.group.name}: ${buyText(auto)} covers the ${amountText(l.need, l.group)} you need for ${money(c)}. Your pick, ${buyText(l.buy)}, is ${money(l.cost)}.`,
        button: `Switch and save ${money(l.cost - c)}` });
    } else {
      const biggest = Math.max(...l.buy.map((b) => b.product.size));
      const small = productsFor(k, l.group.id).filter((p) => p.size < biggest).sort((x, y) => x.size - y.size)[0];
      if (small) { const c = r2(packsFor(l.need, small.size) * small.price); if (c > l.cost + 0.24) out.push({ kind: "saved", id: `saved-${l.group.id}`, save: r2(c - l.cost), text: `Bulk buy on ${l.group.name.toLowerCase()}: ${buyText(l.buy)} for ${money(l.cost)} saves ${money(c - l.cost)} over ${packsFor(l.need, small.size)} × ${productText(small)}.` }); }
    }
    // One package shared between people eating different dishes.
    const eaters = [...new Set(l.uses.map((u) => u.person.name))], dishes = [...new Set(l.uses.map((u) => u.dish.name))];
    if (eaters.length > 1 && dishes.length > 1 && l.cost >= 3) out.push({ kind: "shared", id: `shared-${l.group.id}`, text: `Shared ${l.group.name.toLowerCase()}: ${names(dishes)} all come out of ${buyText(l.buy)}, so nobody buys their own.` });
    // Leftovers worth using before they spoil.
    const one = l.uses.reduce((x, u) => Math.max(x, u.amount), 0);
    if (l.group.perishable && one > 0 && one >= l.got * 0.08 && l.left >= Math.max(one, l.got * 0.25) && l.left * unitPrice(l.product) >= 2) {
      const usedBy = [...new Set(l.uses.map((u) => u.person.id))];
      const others = k.people.filter((p) => !usedBy.includes(p.id));
      const forWho = others.length ? others : k.people;
      const slot = l.uses[0].slot;
      const sameDish = l.uses[0].dish;
      const free = WEEK.find((d) => !(k.week[cell(d, slot)] ?? []).some((m) => !m.people.length || m.people.some((id) => forWho.some((p) => p.id === id))));
      const extra = Math.floor(l.left / one);
      const userNames = names([...new Set(l.uses.map((u) => u.person.name))]);
      const text = `${userNames}'s ${names([...new Set(l.uses.map((u) => u.dish.name))])} use ${amountText(l.need, l.group)} of the ${amountText(l.got, l.group)} of ${l.group.name.toLowerCase()} you buy. ${amountText(l.left, l.group)} would be left, enough for about ${extra} more serving${extra === 1 ? "" : "s"}.`;
      if (free) out.push({ kind: "leftover", id: `left-${l.group.id}`, text, day: free, slot, dish: sameDish.id, people: others.length ? others.map((p) => p.id) : [], button: others.length ? `Share it: ${sameDish.name} for ${names(others.map((p) => p.name))} on ${DAY_LABEL[free]}` : `Use it: ${sameDish.name} again on ${DAY_LABEL[free]}` });
    }
  }
  // At most two "use it up" ideas, the ones worth the most.
  const left = out.filter((x) => x.kind === "leftover");
  if (left.length > 2) for (const x of left.slice(2)) out.splice(out.indexOf(x), 1);
  const rank = { bulk: 0, leftover: 1, saved: 2, shared: 3 } as const;
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || ("save" in b ? b.save : 0) - ("save" in a ? a.save : 0)).slice(0, 10);
}

// ── Changing the plan ──────────────────────────────────────────────────────────────────────────────────────────
export function addMeal(k: Kitchen, day: KDay, slot: KSlot, dish: string, people: string[], id: string): Kitchen {
  const key = cell(day, slot);
  return { ...k, week: { ...k.week, [key]: [...(k.week[key] ?? []), { id, dish, people }] } };
}
export function removeMeal(k: Kitchen, key: string, mealId: string): Kitchen {
  const rest = (k.week[key] ?? []).filter((m) => m.id !== mealId);
  const week = { ...k.week }; if (rest.length) week[key] = rest; else delete week[key];
  return { ...k, week };
}
/** Deleting your own dish takes it off every day too. */
export function deleteOwnDish(k: Kitchen, dishId: string): Kitchen {
  const week: Record<string, KMeal[]> = {};
  for (const [key, meals] of Object.entries(k.week)) { const rest = meals.filter((m) => m.dish !== dishId); if (rest.length) week[key] = rest; }
  const edits = { ...k.edits }; delete edits[dishId];
  return { ...k, own: k.own.filter((d) => d.id !== dishId), week, edits };
}
export const PORTIONS: { label: string; value: number }[] = [{ label: "Small child", value: 0.5 }, { label: "Child", value: 0.75 }, { label: "Adult", value: 1 }, { label: "Big eater", value: 1.5 }];

/** About what one regular serving of a dish costs, at the best-value product for each ingredient (staples at home left out). */
export function servingCost(k: Kitchen, d: KDish): number {
  const t = takeoutOf(k, d.id); if (t) return t.perPerson;
  return r2(partsOf(k, d).reduce((a, p) => {
    if (atHome(k, p.group)) return a;
    const shelf = productsFor(k, p.group); const best = (k.choice[p.group] && productById(k, k.choice[p.group])) || shelf.reduce<KProduct | undefined>((b, x) => (!b || unitPrice(x) < unitPrice(b) ? x : b), undefined);
    return a + (best ? unitPrice(best) * p.per : 0);
  }, 0));
}
/** A starting amount for an ingredient added by hand. */
export const defaultPer = (g: KGroup) => (g.unit === "ct" ? 1 : 4);
/** The unit word for an amount box: "cookies", "oz", "fl oz". */
export const unitWord = (g: KGroup, x = 2) => (g.unit === "ct" ? (Math.abs(x - 1) < 0.01 ? g.each ?? "piece" : plural(g.each ?? "piece")) : g.unit === "oz" ? "oz" : "fl oz");
export const GROUPS_SORTED = [...GROUP_BY_ID.values()].sort((a, b) => a.name.localeCompare(b.name));
/** A store's size text in this ingredient's unit ("24 ct" → 24 cookies, "2 lb" → 32 oz), or null when it can't be read. */
export const parseSizeFor = (text: string, g: KGroup) => parseSize(text, g.unit);
export const TAKEOUT_PLACES = ["Chipotle", "Chick-fil-A", "McDonald's", "Subway", "Panda Express", "Taco Bell", "Domino's", "Wendy's", "Olive Garden", "A local place"];
