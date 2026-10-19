// Link page (a Plugin Store add-on): your own page of links, like a link tree. Add your links, put them in
// folders if you like, pick how the page looks (big buttons, or a directory of tiles grouped by folder), and
// share it with a link anyone can open (no account needed). The same links show on Home as "My links".
import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, FolderOpen, LayoutGrid, Link2, List, Trash2 } from "lucide-react";
import type { LinkPageStyle, PageLink } from "@shared/familyHub";
import { ShareButton } from "./ShareLink";
import { LinkPageLinks } from "./LinkDirectory";
import { Empty, PageHead, Panel, danger, inputClass, primary, type SectionProps } from "./ui";

const EMOJI = ["🔗", "📸", "🎵", "▶️", "💼", "🛍️", "✍️", "📅", "💬", "⭐", "❤️", "🏠", "🏫", "📚", "🏥", "💳", "🍔", "🎮", "📰", "🗺️"];
const FOLDER_IDEAS = ["School", "Work", "Shopping", "Bills", "Health", "Social", "Fun", "Church"];
/** Adds https:// when someone types a bare address like example.com. */
const fixUrl = (u: string) => { const t = u.trim(); if (!t) return ""; if (/^(https?:\/\/|mailto:|tel:)/i.test(t)) return t; if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(t)) return `mailto:${t}`; return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t) ? `https://${t}` : ""; };
const cleanFolder = (g: string) => g.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 30);

export default function LinkPage({ family, setFamily, makeId, say }: SectionProps) {
  const page = family.linkPage;
  const style: LinkPageStyle = page.style === "directory" ? "directory" : "buttons";
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [emoji, setEmoji] = useState(EMOJI[0]);
  const [folder, setFolder] = useState("");
  const folders = [...new Set(page.links.map((l) => (l.group || "").trim()).filter(Boolean))];
  const setPage = (patch: Partial<typeof page>) => setFamily((f) => ({ ...f, linkPage: { ...f.linkPage, ...patch } }));
  const setLinks = (update: (l: PageLink[]) => PageLink[]) => setFamily((f) => ({ ...f, linkPage: { ...f.linkPage, links: update(f.linkPage.links) } }));
  const setStyle = (next: LinkPageStyle) => setFamily((f) => { const { style: _old, ...rest } = f.linkPage; return { ...f, linkPage: next === "directory" ? { ...rest, style: "directory" } : rest }; });

  const add = (e: FormEvent) => {
    e.preventDefault();
    const link = fixUrl(url);
    if (!title.trim() || !link) { say("Add a name and a web address (like example.com)."); return; }
    const group = cleanFolder(folder);
    setLinks((l) => [...l, { id: makeId(), title: title.trim(), url: link, emoji, ...(group ? { group } : {}) }]);
    setTitle(""); setUrl("");
  };
  const moveBy = (i: number, d: -1 | 1) => setLinks((l) => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const setGroup = (id: string, raw: string) => setLinks((l) => l.map((x) => { if (x.id !== id) return x; const { group: _old, ...rest } = x; const g = cleanFolder(raw); return g ? { ...rest, group: g } : rest; }));
  const styleBtn = (s: LinkPageStyle, label: string, Icon: typeof List) => <button type="button" onClick={() => setStyle(s)} aria-pressed={style === s}
    className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${style === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}><Icon size={16} /> {label}</button>;

  return <div className="space-y-6">
    <PageHead eyebrow="Link page" title="All your links, one page" blurb="Your socials, school sites, shops, bills or favorite places as one tidy page or a directory. Share it with a single link, and open any of them right from Home." action={<ShareButton target="links" title={page.title || "My links"} say={say} label="Share my page" />} />
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <Panel title="Your page">
          <div className="space-y-3">
            <input value={page.title} onChange={(e) => setPage({ title: e.target.value })} maxLength={80} placeholder="Page name (your name, family or business)" className={inputClass} aria-label="Page name" />
            <textarea value={page.bio} onChange={(e) => setPage({ bio: e.target.value })} maxLength={300} rows={2} placeholder="A line about you (optional)" className={inputClass + " py-2.5"} aria-label="About" />
            <div>
              <p className="mb-1.5 text-xs font-bold text-slate-500">How it looks</p>
              <div className="flex gap-1 rounded-2xl bg-slate-100 p-1" role="group" aria-label="How the page looks" data-testid="link-style">
                {styleBtn("buttons", "Link tree", List)}
                {styleBtn("directory", "Directory", LayoutGrid)}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">{style === "directory" ? "Tiles grouped by folder, with a search box once you have lots of links." : "Big buttons, one under another, like a classic link tree."}</p>
            </div>
          </div>
        </Panel>
        <Panel title="Add a link">
          <form onSubmit={add} className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Name (My Instagram)" className={inputClass} aria-label="Link name" />
              <input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={1000} placeholder="Address (instagram.com/you)" className={inputClass} aria-label="Web address" inputMode="url" autoCapitalize="none" />
            </div>
            <div>
              <input value={folder} onChange={(e) => setFolder(e.target.value)} maxLength={30} list="link-folders" placeholder="Folder (optional: School, Bills, Shopping…)" className={inputClass} aria-label="Folder" />
              <datalist id="link-folders">{[...new Set([...folders, ...FOLDER_IDEAS])].map((g) => <option key={g} value={g} />)}</datalist>
            </div>
            <div className="flex flex-wrap gap-1.5">{EMOJI.map((m) => <button key={m} type="button" onClick={() => setEmoji(m)} aria-pressed={emoji === m} className={`h-10 w-10 rounded-xl text-lg ${emoji === m ? "bg-violet-100 ring-2 ring-violet-400" : "hover:bg-slate-100"}`}>{m}</button>)}</div>
            <button type="submit" className={primary} disabled={!title.trim() || !url.trim()}>Add link</button>
          </form>
        </Panel>
        <Panel title={`Links · ${page.links.length}`}>
          {page.links.length ? <ul className="divide-y divide-slate-100">{page.links.map((l, i) => <li key={l.id} className="flex flex-wrap items-center gap-2 py-2.5 sm:flex-nowrap">
            <span className="text-xl" aria-hidden>{l.emoji}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{l.title}</span><span className="block truncate text-xs text-slate-500">{l.url}</span></span>
            <label className="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs text-slate-500 focus-within:border-violet-400">
              <FolderOpen size={13} className="shrink-0" />
              <input defaultValue={l.group || ""} onBlur={(e) => setGroup(l.id, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} list="link-folders" maxLength={30} placeholder="Folder" aria-label={`Folder for ${l.title}`} className="w-20 bg-transparent font-semibold text-slate-700 outline-none sm:w-24" />
            </label>
            <button type="button" onClick={() => moveBy(i, -1)} disabled={i === 0} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label={`Move ${l.title} up`}><ArrowUp size={15} /></button>
            <button type="button" onClick={() => moveBy(i, 1)} disabled={i === page.links.length - 1} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label={`Move ${l.title} down`}><ArrowDown size={15} /></button>
            <button type="button" onClick={() => setLinks((x) => x.filter((y) => y.id !== l.id))} className={danger + " px-2"} aria-label={`Delete ${l.title}`}><Trash2 size={14} /></button>
          </li>)}</ul> : <Empty icon={<Link2 />} title="No links yet.">Add your first link above.</Empty>}
          {page.links.length > 0 && <p className="mt-3 rounded-xl bg-violet-50 p-3 text-xs text-violet-800"><LayoutGrid size={13} className="mr-1 inline" /> These links also show on Home as <span className="font-bold">My links</span>, so they're one tap away. Hide or move it from Home's Edit button.</p>}
        </Panel>
      </div>
      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-[.15em] text-slate-400">Preview</p>
        <div className="rounded-[2rem] bg-gradient-to-b from-[#2d2555] to-[#6d5ce7] p-6 text-center text-white shadow-[0_18px_40px_#4b3fa033]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-2xl font-black">{(page.title || "?").trim().charAt(0).toUpperCase()}</div>
          <p className="mt-3 text-lg font-black">{page.title || "Your page name"}</p>
          {page.bio && <p className="mt-1 text-sm text-violet-100">{page.bio}</p>}
          <div className="mt-5"><LinkPageLinks links={page.links} style={style} /></div>
        </div>
      </div>
    </div>
  </div>;
}
