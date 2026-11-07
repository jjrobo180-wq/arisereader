// Picking what to buy for one ingredient: a brand and package size from the shelf, a product found at King Soopers, or
// one you add yourself. Any price can be set by hand and then stays put until you change it.
import { useState } from "react";
import { amountText, groupOf, money, parseSizeFor, productsFor, unitPrice, unitWord, type Kitchen, type KProduct } from "@shared/kitchen";
import { searchStore, type StoreProduct } from "@/lib/kitchenStore";
import { Modal } from "../ui";
import { Check, btn, field, ghost, label, link, priceSource, quiet } from "./kit";

export default function ProductChooser({ k, setK, group, need, token, connected, makeId, onClose }: {
  k: Kitchen; setK: (fn: (k: Kitchen) => Kitchen) => void; group: string; need: number; token: string | null; connected: boolean; makeId: () => string; onClose: () => void;
}) {
  const g = groupOf(group)!;
  const shelf = productsFor(k, group);
  const picked = k.choice[group];
  const [pricing, setPricing] = useState<string | null>(null);
  const [priceText, setPriceText] = useState("");
  const [term, setTerm] = useState(g.name);
  const [results, setResults] = useState<StoreProduct[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [own, setOwn] = useState<{ brand: string; name: string; size: string; price: string } | null>(null);

  const choose = (id: string | null) => setK((x) => { const choice = { ...x.choice }; if (id) choice[group] = id; else delete choice[group]; return { ...x, choice }; });
  const setPrice = (id: string, price: number) => setK((x) => ({ ...x, prices: { ...x.prices, [id]: { price: Math.round(price * 100) / 100, source: "you", at: new Date().toISOString() } } }));
  const search = async () => {
    if (!k.store) return;
    setBusy(true); setErr("");
    try { setResults(await searchStore(token, term.trim(), k.store.id)); } catch (e: any) { setErr(String(e?.message || "The store search failed.")); setResults(null); }
    setBusy(false);
  };
  const useStore = (r: StoreProduct) => {
    const size = parseSizeFor(r.label, g) ?? Number(sizes[r.storeId]);
    if (!Number.isFinite(size) || size <= 0) return;
    const p: KProduct = { id: `ks-${r.storeId}`, group, brand: r.brand, name: r.name, size, label: r.label || `${size} ${unitWord(g, size)}`, price: r.price, source: "store", storeId: r.storeId, at: new Date().toISOString() };
    setK((x) => ({ ...x, products: [...x.products.filter((q) => q.id !== p.id), p], prices: Object.fromEntries(Object.entries(x.prices).filter(([id]) => id !== p.id)), choice: { ...x.choice, [group]: p.id } }));
    onClose();
  };
  const addOwn = () => {
    if (!own) return;
    const size = Number(own.size), price = Number(own.price);
    if (!own.name.trim() || !(size > 0) || !(price >= 0)) return;
    const p: KProduct = { id: `you-${makeId()}`, group, brand: own.brand.trim(), name: own.name.trim(), size, label: `${size} ${unitWord(g, size)}`, price: Math.round(price * 100) / 100, source: "you", at: new Date().toISOString() };
    setK((x) => ({ ...x, products: [...x.products, p], choice: { ...x.choice, [group]: p.id } }));
    onClose();
  };

  return <Modal title={g.name} eyebrow="What to buy" onClose={onClose}>
    {need > 0 && <p className="mb-4 text-sm text-slate-500">This week needs {amountText(need, g)}.</p>}
    <ul className="divide-y divide-slate-100 border-y border-slate-100">
      <li><button type="button" onClick={() => choose(null)} className="flex w-full items-center gap-3 py-3 text-left">
        <Check on={!picked} /><span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-slate-900">Best value</span><span className="block text-xs text-slate-500">The planner picks the cheapest mix of sizes for what you need</span></span>
      </button></li>
      {shelf.map((p) => <li key={p.id} className="py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => choose(p.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <Check on={picked === p.id} />
            <span className="min-w-0"><span className="block truncate text-[15px] font-semibold text-slate-900">{p.brand ? `${p.brand} ` : ""}{p.name}</span>
              <span className="block text-xs text-slate-500">{p.label} &middot; {money(unitPrice(p) * (g.unit === "ct" ? 1 : g.unit === "oz" ? 16 : 128))} per {g.unit === "ct" ? g.each ?? "piece" : g.unit === "oz" ? "lb" : "gal"} &middot; {priceSource(p)}</span></span>
          </button>
          <button type="button" onClick={() => { setPricing(pricing === p.id ? null : p.id); setPriceText(String(p.price)); }} className="shrink-0 text-right">
            <span className="block text-[15px] font-semibold tabular-nums text-slate-900">{money(p.price)}</span>
            <span className="block text-[11px] text-slate-400 underline underline-offset-2">Change</span>
          </button>
        </div>
        {pricing === p.id && <div className="mt-2 flex gap-2 pl-8">
          <div className="flex flex-1 items-center rounded-lg border border-slate-200 px-3"><span className="text-slate-400">$</span><input autoFocus value={priceText} onChange={(e) => setPriceText(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" aria-label={`Price for ${p.name}`} className="w-full bg-transparent py-2 pl-1 text-sm outline-none" /></div>
          <button type="button" onClick={() => { const v = Number(priceText); if (Number.isFinite(v) && v >= 0) { setPrice(p.id, v); setPricing(null); } }} className={ghost}>Save price</button>
        </div>}
      </li>)}
    </ul>

    <section className="mt-6">
      <p className={label}>King Soopers</p>
      {!connected ? <p className="mt-1.5 text-sm text-slate-500">The store isn't connected yet, so these prices are estimates. Once it is, you can search the real shelf here.</p>
        : !k.store ? <p className="mt-1.5 text-sm text-slate-500">Pick your store under People &amp; store to search its shelf.</p>
        : <>
          <div className="mt-2 flex gap-2"><input value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} aria-label="Search King Soopers" className={`${field} flex-1`} /><button type="button" onClick={() => void search()} disabled={busy || term.trim().length < 2} className={ghost}>{busy ? "Searching" : "Search"}</button></div>
          {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
          {results && <ul className="mt-2 divide-y divide-slate-100 border-y border-slate-100">{results.length === 0 && <li className="py-4 text-sm text-slate-400">Nothing found. Try other words.</li>}
            {results.map((r) => { const size = parseSizeFor(r.label, g); return <li key={r.storeId} className="flex items-center gap-3 py-3">
              {r.image && <img src={r.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-contain" />}
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{r.brand} {r.name}</span>
                <span className="block text-xs text-slate-500">{r.label}{r.sale ? ` · on sale, usually ${money(r.regular)}` : ""}</span>
                {size == null && <span className="mt-1 flex items-center gap-2 text-xs text-slate-500">How many {unitWord(g)} in it?<input value={sizes[r.storeId] ?? ""} onChange={(e) => setSizes((s) => ({ ...s, [r.storeId]: e.target.value.replace(/[^\d.]/g, "") }))} inputMode="decimal" className="w-16 rounded border border-slate-200 px-2 py-1" aria-label="Amount in the package" /></span>}</span>
              <span className="shrink-0 text-right"><span className="block text-sm font-semibold tabular-nums">{money(r.price)}</span>
                <button type="button" onClick={() => useStore(r)} disabled={size == null && !(Number(sizes[r.storeId]) > 0)} className="text-xs font-semibold underline underline-offset-2 disabled:opacity-30">Use this</button></span>
            </li>; })}</ul>}
        </>}
    </section>

    <section className="mt-6">
      {!own ? <button type="button" onClick={() => setOwn({ brand: "", name: g.name, size: "", price: "" })} className={link}>Add a product yourself</button> : <div className="space-y-2">
        <p className={label}>Your product</p>
        <div className="grid grid-cols-2 gap-2">
          <input value={own.brand} onChange={(e) => setOwn({ ...own, brand: e.target.value })} placeholder="Brand" aria-label="Brand" className={field} />
          <input value={own.name} onChange={(e) => setOwn({ ...own, name: e.target.value })} placeholder="Product" aria-label="Product" className={field} />
          <label className="flex items-center gap-2 text-sm text-slate-500"><input value={own.size} onChange={(e) => setOwn({ ...own, size: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" placeholder="Amount" aria-label="Amount in the package" className={`${field} w-full`} /><span className="shrink-0">{unitWord(g)}</span></label>
          <div className="flex items-center rounded-lg border border-slate-200 px-3"><span className="text-slate-400">$</span><input value={own.price} onChange={(e) => setOwn({ ...own, price: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" placeholder="Price" aria-label="Price" className="w-full bg-transparent py-2.5 pl-1 text-sm outline-none" /></div>
        </div>
        <div className="flex gap-2"><button type="button" onClick={addOwn} className={ghost}>Add product</button><button type="button" onClick={() => setOwn(null)} className={quiet}>Cancel</button></div>
      </div>}
    </section>
    <button type="button" onClick={onClose} className={`${btn} mt-6 w-full`}>Done</button>
  </Modal>;
}
