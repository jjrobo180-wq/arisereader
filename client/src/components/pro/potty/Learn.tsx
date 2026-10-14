// Learn: the article library (with a proper reader), underwear and gear, the signs a child needs
// to go (and simple signs to teach), books for kids and parents, and trusted resources online.
import { useState } from "react";
import { ArrowLeft, Check, ExternalLink, Search } from "lucide-react";
import { ARTICLES, ARTICLE_CATS, GEAR, KID_BOOKS, NEEDS_TO_GO, PARENT_BOOKS, RESOURCES, SIGNS, UNDERWEAR, articleById, type Article, type GearItem } from "@shared/pro/potty";
import { usePotty } from "./ctx";
import { Btn2, C, Chip, Note, Panel, Section, field, fieldStyle } from "./theme";

function Reader({ a, onBack }: { a: Article; onBack: () => void }) {
  const { data, set } = usePotty();
  const read = data.read.includes(a.id);
  return <article className="mx-auto max-w-[68ch]">
    <Btn2 kind="ghost" onClick={onBack}><ArrowLeft size={15} />All articles</Btn2>
    <p className="mt-4 text-[13px] font-bold" style={{ color: C.duckDeep }}>{a.cat} · {a.minutes} min read</p>
    <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">{a.title}</h1>
    <p className="mt-3 text-lg leading-relaxed" style={{ color: C.inkSoft }}>{a.summary}</p>
    <div className="mt-6 space-y-5">{a.body.map((b, i) => <div key={i}>
      {b.h && <h2 className="mb-2 text-xl font-extrabold">{b.h}</h2>}
      {b.p && <p className="text-[16.5px] leading-[1.7]">{b.p}</p>}
      {b.list && <ul className="space-y-2">{b.list.map((x) => <li key={x} className="flex gap-3 text-[16px] leading-relaxed"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: C.duckDeep }} />{x}</li>)}</ul>}
      {b.tip && <Note tone="tip">{b.tip}</Note>}
      {b.warn && <Note tone="doctor">{b.warn}</Note>}
    </div>)}</div>
    <p className="mt-8 border-t pt-4 text-[13px]" style={{ color: C.muted, borderColor: C.line }}>Based on guidance from: {a.sources.join("; ")}. Full links are in Learn → Trusted resources. General information, not medical advice.</p>
    <Btn2 className="mt-4" kind={read ? "plain" : "ink"} onClick={() => set((d) => ({ ...d, read: read ? d.read.filter((x) => x !== a.id) : [...d.read, a.id] }))}>{read ? <><Check size={15} />Read</> : "Mark as read"}</Btn2>
  </article>;
}

function GearCard({ g }: { g: GearItem }) {
  return <Panel><div className="flex items-start gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ background: C.ground }}>{g.emoji}</span><div className="min-w-0"><h3 className="text-lg font-extrabold">{g.name}</h3><p className="text-sm" style={{ color: C.inkSoft }}>{g.what}</p></div></div>
    <p className="mt-3 text-[13px]"><b>When:</b> {g.when}</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="mb-1 text-[12px] font-extrabold" style={{ color: C.good }}>Good</p><ul className="space-y-1">{g.good.map((x) => <li key={x} className="text-[13px] leading-snug">+ {x}</li>)}</ul></div><div><p className="mb-1 text-[12px] font-extrabold" style={{ color: C.duckDeep }}>Watch out</p><ul className="space-y-1">{g.watch.map((x) => <li key={x} className="text-[13px] leading-snug">! {x}</li>)}</ul></div></div>
  </Panel>;
}

export default function Learn() {
  const { data, sub, kid } = usePotty();
  const [tab, setTab] = useState<"articles" | "gear" | "signs" | "books" | "links">("articles");
  const [open, setOpen] = useState<string>(sub.startsWith("a:") ? sub.slice(2) : "");
  const [q, setQ] = useState(""); const [cat, setCat] = useState("");
  const art = open ? articleById(open) : undefined;
  if (art) return <Reader a={art} onBack={() => setOpen("")} />;
  const list = ARTICLES.filter((a) => (!cat || a.cat === cat) && (!q || `${a.title} ${a.summary} ${a.body.map((b) => [b.h, b.p, ...(b.list || [])].join(" ")).join(" ")}`.toLowerCase().includes(q.toLowerCase())));
  const recommended = ["when-to-start", "first-days", "poop", "constipation", "naps-nights", "special-needs", kid.sex === "boy" ? "boys" : kid.sex === "girl" ? "girls" : "accidents"].filter((id) => !data.read.includes(id)).slice(0, 3).map(articleById).filter(Boolean) as Article[];
  return <div className="space-y-6">
    <div className="flex flex-wrap gap-1.5">{([["articles", "📖 Articles"], ["gear", "🩲 Underwear & gear"], ["signs", "👀 Signs"], ["books", "📚 Books"], ["links", "🔗 Trusted resources"]] as const).map(([v, l]) => <Chip key={v} on={tab === v} onClick={() => setTab(v)}>{l}</Chip>)}</div>
    {tab === "articles" && <>
      {recommended.length > 0 && !q && !cat && <Section title="Start with these"><div className="grid gap-3 md:grid-cols-3">{recommended.map((a) => <button key={a.id} type="button" onClick={() => setOpen(a.id)} className="rounded-[22px] p-5 text-left transition hover:-translate-y-0.5" style={{ background: C.night, color: "#fff" }}><p className="text-xs font-bold" style={{ color: C.duck }}>{a.cat} · {a.minutes} min</p><p className="ph mt-2 text-lg font-extrabold leading-snug">{a.title}</p><p className="mt-2 text-sm text-white/70">{a.summary}</p></button>)}</div></Section>}
      <Section title="All articles" sub={`${ARTICLES.length} guides, written from AAP, Mayo Clinic, ERIC, NHS, CHOP and NIDDK guidance. ${data.read.length} read.`}>
        <div className="mb-3 flex flex-wrap items-center gap-2"><div className="relative min-w-[220px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles" className={`${field} pl-9`} style={fieldStyle} aria-label="Search articles" /></div></div>
        <div className="mb-4 flex flex-wrap gap-1.5"><Chip on={!cat} onClick={() => setCat("")}>All</Chip>{ARTICLE_CATS.map((c) => <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}</div>
        <div className="grid gap-3 md:grid-cols-2">{list.map((a) => <button key={a.id} type="button" onClick={() => setOpen(a.id)} className="flex gap-3 rounded-[20px] bg-white p-4 text-left transition hover:-translate-y-0.5" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}` }}>
          <div className="min-w-0 flex-1"><p className="text-xs font-bold" style={{ color: C.duckDeep }}>{a.cat} · {a.minutes} min</p><p className="ph mt-1 font-extrabold leading-snug">{a.title}</p><p className="mt-1 line-clamp-2 text-[13px]" style={{ color: C.muted }}>{a.summary}</p></div>
          {data.read.includes(a.id) && <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: C.good, color: "#fff" }}><Check size={14} /></span>}</button>)}</div>
        {!list.length && <p className="text-sm" style={{ color: C.muted }}>No articles match. Try the AI coach.</p>}
      </Section>
    </>}
    {tab === "gear" && <>
      <Section title="Underwear, training pants and pull-ups" sub="What each is for. Short version: real underwear in the day, cloth trainers or covers in between, pull-ups or night pants only for sleep."><div className="grid gap-4 lg:grid-cols-2">{UNDERWEAR.map((g) => <GearCard key={g.id} g={g} />)}</div></Section>
      <Section title="Potties, seats and helpers"><div className="grid gap-4 lg:grid-cols-2">{GEAR.map((g) => <GearCard key={g.id} g={g} />)}</div></Section>
    </>}
    {tab === "signs" && <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Signs your child needs to go" sub="Catching these early — and saying it out loud — teaches your child to notice them too."><Panel><ul className="space-y-3">{NEEDS_TO_GO.map((s) => <li key={s.sign} className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl" style={{ background: C.ground }}>{s.emoji}</span><span className="text-[15px] font-bold">{s.sign}</span></li>)}</ul></Panel></Section>
      <Section title="Simple signs to teach" sub="Signing helps every toddler, and is essential for children who don't talk much yet. These are American Sign Language (ASL).">
        <div className="space-y-3">{SIGNS.map((s) => <Panel key={s.word}><p className="ph text-lg font-extrabold">{s.word}</p><p className="mt-1 text-[15px]" style={{ color: C.inkSoft }}>{s.how}</p></Panel>)}</div>
        <Note tone="tip">Pick one sign (or picture card) for each word and use it every single time, by every adult — at home, at daycare, at grandma's. Talk cards are in the Additional needs tab.</Note>
      </Section>
    </div>}
    {tab === "books" && <div className="grid gap-6 lg:grid-cols-2">
      <Section title={`Books to read with ${kid.name}`} sub="Read the same one at every sit — it becomes part of the routine."><div className="space-y-2">{KID_BOOKS.map((b) => <Panel key={b.title}><p className="ph font-extrabold">{b.title}</p><p className="text-[13px]" style={{ color: C.muted }}>{b.author}</p><p className="mt-1 text-sm">{b.note}</p></Panel>)}</div></Section>
      <Section title="Books for you"><div className="space-y-2">{PARENT_BOOKS.map((b) => <Panel key={b.title}><p className="ph font-extrabold">{b.title}</p><p className="text-[13px]" style={{ color: C.muted }}>{b.author}</p><p className="mt-1 text-sm">{b.note}</p></Panel>)}</div>
        <Note tone="info">Many libraries have these — and read-alouds of the children's books are on YouTube (Videos → Find more).</Note></Section>
    </div>}
    {tab === "links" && <Section title="Trusted resources" sub="The organisations this app's guidance comes from. Opens in a new tab.">
      {Array.from(new Set(RESOURCES.map((r) => r.topic))).map((t) => <div key={t} className="mb-5"><h3 className="mb-2 text-[15px] font-extrabold">{t}</h3><div className="grid gap-2 md:grid-cols-2">{RESOURCES.filter((r) => r.topic === t).map((r) => <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="flex items-start gap-3 rounded-[18px] bg-white p-3.5 transition hover:-translate-y-0.5" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}`, color: C.ink }}><ExternalLink size={16} className="mt-0.5 shrink-0" style={{ color: C.muted }} /><span><span className="block text-[14px] font-bold">{r.title}</span><span className="text-xs" style={{ color: C.muted }}>{r.org}</span></span></a>)}</div></div>)}
    </Section>}
  </div>;
}
