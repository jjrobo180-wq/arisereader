// Gratitude (a Plugin Store add-on): three good things a day, a streak, and a look back.
import { useState } from "react";
import { Heart, Shuffle } from "lucide-react";
import { streak } from "@shared/lifePlugins";
import { Empty, PageHead, Panel, inputClass, plain, primary, type SectionProps } from "./ui";

export default function Gratitude({ family, setFamily, today, makeId, say }: SectionProps) {
  const todayRow = family.gratitude.find((g) => g.date === today);
  const [items, setItems] = useState<string[]>(() => { const t = todayRow?.items ?? []; return [t[0] ?? "", t[1] ?? "", t[2] ?? ""]; });
  const [memory, setMemory] = useState<{ date: string; item: string } | null>(null);
  const past = family.gratitude.filter((g) => g.date !== today).sort((a, b) => b.date.localeCompare(a.date));
  const s = streak(family.gratitude.map((g) => g.date), today);

  const save = () => {
    const clean = items.map((i) => i.trim()).filter(Boolean);
    if (!clean.length) return;
    setFamily((f) => ({ ...f, gratitude: [...f.gratitude.filter((g) => g.date !== today), { id: todayRow?.id || makeId(), date: today, items: clean }] }));
    say("Saved. Thanks for noticing the good stuff.");
  };
  const remember = () => { const all = past.flatMap((g) => g.items.map((item) => ({ date: g.date, item }))); if (all.length) setMemory(all[Math.floor(Math.random() * all.length)]); };
  const nice = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return <div className="space-y-6">
    <PageHead eyebrow="Gratitude" title="Three good things" blurb="Write down three things you're thankful for today. Big or tiny, they all count." />
    <Panel title="Today" right={s > 0 ? <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-600">{s} day streak</span> : undefined}>
      <div className="space-y-2">{items.map((v, i) => <label key={i} className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-sm font-black text-rose-500">{i + 1}</span>
        <input value={v} onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))} maxLength={300} placeholder={["A person who made today better…", "Something that went right…", "A small thing you enjoyed…"][i]} className={inputClass} aria-label={`Thing ${i + 1}`} /></label>)}</div>
      <button type="button" onClick={save} disabled={!items.some((i) => i.trim())} className={primary + " mt-4"}><Heart size={16} />{todayRow ? "Update today" : "Save today"}</button>
    </Panel>
    {past.length > 0 && <Panel title="A good memory" right={<button type="button" onClick={remember} className={plain}><Shuffle size={15} />Show me one</button>}>
      {memory ? <p className="text-lg font-bold text-[#232139]">“{memory.item}”<span className="mt-1 block text-xs font-semibold text-slate-400">{nice(memory.date)}</span></p> : <p className="text-sm text-slate-500">Tap “Show me one” for something you were thankful for before.</p>}
    </Panel>}
    <Panel title={`Looking back · ${past.length} day${past.length === 1 ? "" : "s"}`} collapseKey="gratitude-past">
      {past.length ? <ul className="space-y-3">{past.slice(0, 60).map((g) => <li key={g.id} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">{nice(g.date)}</p><ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">{g.items.map((it, i) => <li key={i}>{it}</li>)}</ul></li>)}</ul>
        : <Empty icon={<Heart />} title="Your gratitude history shows here.">Come back tomorrow to add more.</Empty>}
    </Panel>
  </div>;
}
