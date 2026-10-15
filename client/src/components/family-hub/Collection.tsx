// Reading list, Watchlist, Bucket list and Gift ideas (Plugin Store add-ons): lists where each
// item moves through a few stages (want to read → reading → read).
import { useState, type FormEvent } from "react";
import { BookOpen, ExternalLink, Gift, GraduationCap, Hammer, Handshake, Heart, Mountain, Star, Trash2, Tv, Utensils } from "lucide-react";
import { COLLECTIONS } from "@shared/lifePlugins";
import type { CollectionItem, CollectionKind } from "@shared/familyHub";
import { Empty, PageHead, Panel, danger, inputClass, primary, type SectionProps } from "./ui";

const HEAD: Record<CollectionKind, { eyebrow: string; title: string; blurb: string; placeholder: string; icon: typeof BookOpen }> = {
  reading: { eyebrow: "Reading list", title: "Books to read", blurb: "Keep track of what you want to read, what you're reading, and what you thought.", placeholder: "Book title", icon: BookOpen },
  watchlist: { eyebrow: "Watchlist", title: "What to watch", blurb: "Movies and shows to watch, what you're in the middle of, and how you rated them.", placeholder: "Movie or show", icon: Tv },
  bucket: { eyebrow: "Bucket list", title: "Someday, for real", blurb: "The places, adventures and goals you want to get to. Check them off as life happens.", placeholder: "Something you want to do", icon: Mountain },
  wishlist: { eyebrow: "Wishlist", title: "Things I'd love", blurb: "Keep a wishlist with prices and links, so it's ready when someone asks what you want.", placeholder: "Something you want", icon: Heart },
  restaurants: { eyebrow: "Restaurants", title: "Places to eat", blurb: "Restaurants you want to try, and how the ones you tried measured up.", placeholder: "Restaurant name", icon: Utensils },
  learning: { eyebrow: "Learning goals", title: "Keep learning", blurb: "Skills and subjects you want to learn, what you're working on now, and what you've mastered.", placeholder: "Something to learn", icon: GraduationCap },
  projects: { eyebrow: "Home projects", title: "Project list", blurb: "Repairs, upgrades and DIY ideas for the house, with what each might cost.", placeholder: "Project", icon: Hammer },
  loans: { eyebrow: "Lent items", title: "Who has my stuff?", blurb: "Keep track of what you lent out and to whom, so it finds its way home.", placeholder: "What you lent", icon: Handshake },
  gifts: { eyebrow: "Gift ideas", title: "Gift ideas", blurb: "Jot down gift ideas all year, so birthdays and holidays are easy. Track what's bought and given.", placeholder: "Gift idea", icon: Gift },
};
const money = (n: number) => `$${n.toFixed(n % 1 ? 2 : 0)}`;

export default function Collection({ kind, family, setFamily, today, makeId }: SectionProps & { kind: CollectionKind }) {
  const cfg = COLLECTIONS[kind], head = HEAD[kind], Icon = head.icon;
  const [title, setTitle] = useState("");
  const [sub, setSub] = useState("");
  const [price, setPrice] = useState("");
  const [url, setUrl] = useState("");
  const [tab, setTab] = useState(cfg.statuses[0].id);
  const items = family.collections.filter((i) => i.kind === kind);
  const set = (update: (all: CollectionItem[]) => CollectionItem[]) => setFamily((f) => ({ ...f, collections: update(f.collections) }));
  const patch = (id: string, p: Partial<CollectionItem>) => set((all) => all.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const link = /^https?:\/\//i.test(url.trim()) ? url.trim() : url.trim() ? `https://${url.trim()}` : "";
    set((all) => [...all, { id: makeId(), kind, title: title.trim(), sub: sub.trim(), status: tab, rating: 0, note: "", url: cfg.linked ? link : "", price: cfg.priced ? Math.max(0, Number(price) || 0) : 0, doneOn: tab === "done" ? today : "" }]);
    setTitle(""); setSub(""); setPrice(""); setUrl("");
  };
  const shown = items.filter((i) => (i.status || cfg.statuses[0].id) === tab);
  const count = (s: string) => items.filter((i) => (i.status || cfg.statuses[0].id) === s).length;
  const giftTotal = kind === "gifts" || kind === "wishlist" || kind === "projects" ? items.filter((i) => i.status !== "want").reduce((s, i) => s + i.price, 0) : 0;

  return <div className="space-y-6">
    <PageHead eyebrow={head.eyebrow} title={head.title} blurb={head.blurb} />
    <Panel>
      <form onSubmit={add} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder={head.placeholder} className={inputClass} aria-label={head.placeholder} />
        <input value={sub} onChange={(e) => setSub(e.target.value)} maxLength={120} placeholder={cfg.subLabel} className={inputClass} aria-label={cfg.subLabel} />
        <button type="submit" className={primary} disabled={!title.trim()}>Add to {cfg.statuses.find((s) => s.id === tab)?.label}</button>
        {cfg.priced && <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="Price (optional)" className={inputClass} aria-label="Price" />}
        {cfg.linked && <input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={1000} placeholder="Link (optional)" className={inputClass} aria-label="Link" inputMode="url" autoCapitalize="none" />}
      </form>
    </Panel>
    <div className="flex flex-wrap gap-1.5">{cfg.statuses.map((s) => <button key={s.id} type="button" onClick={() => setTab(s.id)} aria-pressed={tab === s.id} className={`min-h-10 rounded-xl px-4 text-sm font-bold ${tab === s.id ? "bg-[#292446] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"}`}>{s.label} · {count(s.id)}</button>)}
      {giftTotal > 0 && <span className="ml-auto self-center text-sm font-bold text-slate-500">{kind === "projects" ? "Started or done" : "Spent"}: {money(giftTotal)}</span>}</div>
    <Panel>
      {shown.length ? <ul className="divide-y divide-slate-100">{shown.map((i) => <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold text-[#232139]">{i.title}{i.url && <a href={i.url} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex text-slate-400 hover:text-violet-700" aria-label="Open link"><ExternalLink size={13} /></a>}</span>
          <span className="block text-xs text-slate-500">{[i.sub, i.price ? money(i.price) : "", i.doneOn ? `${cfg.statuses[cfg.statuses.length - 1].label} ${new Date(`${i.doneOn}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : ""].filter(Boolean).join(" · ")}</span>
        </span>
        {cfg.rated && i.status === "done" && <span className="flex" role="group" aria-label="Rating">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => patch(i.id, { rating: i.rating === n ? 0 : n })} aria-label={`${n} star${n === 1 ? "" : "s"}`} className="p-0.5"><Star size={17} className={n <= i.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"} /></button>)}</span>}
        <select value={i.status || cfg.statuses[0].id} onChange={(e) => patch(i.id, { status: e.target.value, doneOn: e.target.value === "done" ? i.doneOn || today : "" })} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-600" aria-label={`Move ${i.title}`}>{cfg.statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        <button type="button" onClick={() => set((all) => all.filter((x) => x.id !== i.id))} className={danger + " px-2"} aria-label={`Delete ${i.title}`}><Trash2 size={14} /></button>
      </li>)}</ul> : <Empty icon={<Icon />} title="Nothing here yet.">Add one above.</Empty>}
    </Panel>
  </div>;
}
