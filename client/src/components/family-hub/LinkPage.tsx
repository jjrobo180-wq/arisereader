// Link page (a Plugin Store add-on): your own page of links, like a link tree. Add your links,
// see how the page looks, and share it with a link anyone can open (no account needed).
import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Link2, Trash2 } from "lucide-react";
import type { PageLink } from "@shared/familyHub";
import { ShareButton } from "./ShareLink";
import { Empty, PageHead, Panel, danger, inputClass, primary, type SectionProps } from "./ui";

const EMOJI = ["🔗", "📸", "🎵", "▶️", "💼", "🛍️", "✍️", "📅", "💬", "⭐", "❤️", "🏠"];
/** Adds https:// when someone types a bare address like example.com. */
const fixUrl = (u: string) => { const t = u.trim(); if (!t) return ""; if (/^(https?:\/\/|mailto:|tel:)/i.test(t)) return t; if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(t)) return `mailto:${t}`; return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t) ? `https://${t}` : ""; };

export default function LinkPage({ family, setFamily, makeId, say }: SectionProps) {
  const page = family.linkPage;
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [emoji, setEmoji] = useState(EMOJI[0]);
  const setPage = (patch: Partial<typeof page>) => setFamily((f) => ({ ...f, linkPage: { ...f.linkPage, ...patch } }));
  const setLinks = (update: (l: PageLink[]) => PageLink[]) => setFamily((f) => ({ ...f, linkPage: { ...f.linkPage, links: update(f.linkPage.links) } }));

  const add = (e: FormEvent) => {
    e.preventDefault();
    const link = fixUrl(url);
    if (!title.trim() || !link) { say("Add a name and a web address (like example.com)."); return; }
    setLinks((l) => [...l, { id: makeId(), title: title.trim(), url: link, emoji }]);
    setTitle(""); setUrl("");
  };
  const moveBy = (i: number, d: -1 | 1) => setLinks((l) => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });

  return <div className="space-y-6">
    <PageHead eyebrow="Link page" title="All your links, one page" blurb="Your socials, shop, calendar or favorite sites as one tidy page. Share it with a single link." action={<ShareButton target="links" title={page.title || "My links"} say={say} label="Share my page" />} />
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <Panel title="Your page">
          <div className="space-y-3">
            <input value={page.title} onChange={(e) => setPage({ title: e.target.value })} maxLength={80} placeholder="Page name (your name, family or business)" className={inputClass} aria-label="Page name" />
            <textarea value={page.bio} onChange={(e) => setPage({ bio: e.target.value })} maxLength={300} rows={2} placeholder="A line about you (optional)" className={inputClass + " py-2.5"} aria-label="About" />
          </div>
        </Panel>
        <Panel title="Add a link">
          <form onSubmit={add} className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Name (My Instagram)" className={inputClass} aria-label="Link name" />
              <input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={1000} placeholder="Address (instagram.com/you)" className={inputClass} aria-label="Web address" inputMode="url" autoCapitalize="none" />
            </div>
            <div className="flex flex-wrap gap-1.5">{EMOJI.map((m) => <button key={m} type="button" onClick={() => setEmoji(m)} aria-pressed={emoji === m} className={`h-10 w-10 rounded-xl text-lg ${emoji === m ? "bg-violet-100 ring-2 ring-violet-400" : "hover:bg-slate-100"}`}>{m}</button>)}</div>
            <button type="submit" className={primary} disabled={!title.trim() || !url.trim()}>Add link</button>
          </form>
        </Panel>
        <Panel title={`Links · ${page.links.length}`}>
          {page.links.length ? <ul className="divide-y divide-slate-100">{page.links.map((l, i) => <li key={l.id} className="flex items-center gap-2 py-2.5">
            <span className="text-xl" aria-hidden>{l.emoji}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{l.title}</span><span className="block truncate text-xs text-slate-500">{l.url}</span></span>
            <button type="button" onClick={() => moveBy(i, -1)} disabled={i === 0} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label={`Move ${l.title} up`}><ArrowUp size={15} /></button>
            <button type="button" onClick={() => moveBy(i, 1)} disabled={i === page.links.length - 1} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label={`Move ${l.title} down`}><ArrowDown size={15} /></button>
            <button type="button" onClick={() => setLinks((x) => x.filter((y) => y.id !== l.id))} className={danger + " px-2"} aria-label={`Delete ${l.title}`}><Trash2 size={14} /></button>
          </li>)}</ul> : <Empty icon={<Link2 />} title="No links yet.">Add your first link above.</Empty>}
        </Panel>
      </div>
      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-[.15em] text-slate-400">Preview</p>
        <div className="rounded-[2rem] bg-gradient-to-b from-[#2d2555] to-[#6d5ce7] p-6 text-center text-white shadow-[0_18px_40px_#4b3fa033]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-2xl font-black">{(page.title || "?").trim().charAt(0).toUpperCase()}</div>
          <p className="mt-3 text-lg font-black">{page.title || "Your page name"}</p>
          {page.bio && <p className="mt-1 text-sm text-violet-100">{page.bio}</p>}
          <div className="mt-5 space-y-2.5">{page.links.length ? page.links.map((l) => <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-[#2d2555] shadow-sm hover:scale-[1.02]"><span aria-hidden>{l.emoji}</span>{l.title}<ExternalLink size={13} className="opacity-40" /></a>)
            : <p className="rounded-2xl border border-dashed border-white/40 p-4 text-sm text-violet-100">Your links show up here.</p>}</div>
        </div>
      </div>
    </div>
  </div>;
}
