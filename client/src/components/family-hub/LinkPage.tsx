// Link page (a Plugin Gallery add-on): your own minimal page of links. Add your links (social profiles become
// a row of icons under your name), put the rest in folders if you like, pick a theme and a list or grid, and
// share it with a link anyone can open (no account needed). It's also a card on Home and an iPhone widget.
import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Check, FolderOpen, LayoutGrid, Link2, List, Trash2 } from "lucide-react";
import type { LinkPageStyle, PageLink } from "@shared/familyHub";
import { LINK_THEMES, linkBrand, linkHost, type LinkPageTheme } from "@shared/linkPageLook";
import { ShareButton } from "./ShareLink";
import { LinkPageView } from "./LinkPageView";
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
  const theme: LinkPageTheme = page.theme ?? "light";
  const setTheme = (next: LinkPageTheme) => setFamily((f) => { const { theme: _old, ...rest } = f.linkPage; return { ...f, linkPage: next === "light" ? rest : { ...rest, theme: next } }; });
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
    <PageHead eyebrow="Link page" title="All your links, one clean page" blurb="Your socials, work, shop or favorite places on one simple page. Share it with a single link, keep it on Home, and add it to your iPhone's Home Screen as a widget with a QR code." action={<ShareButton target="links" title={page.title || "My links"} say={say} label="Share my page" />} />
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <Panel title="Your page">
          <div className="space-y-3">
            <input value={page.title} onChange={(e) => setPage({ title: e.target.value })} maxLength={80} placeholder="Page name (your name, family or business)" className={inputClass} aria-label="Page name" />
            <textarea value={page.bio} onChange={(e) => setPage({ bio: e.target.value })} maxLength={300} rows={2} placeholder="A line about you (optional)" className={inputClass + " py-2.5"} aria-label="About" />
            <div>
              <p className="mb-1.5 text-xs font-bold text-slate-500">Theme</p>
              <div className="grid grid-cols-4 gap-2" role="group" aria-label="Theme" data-testid="link-theme">
                {LINK_THEMES.map((t) => <button key={t.id} type="button" onClick={() => setTheme(t.id)} aria-pressed={theme === t.id}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-2xl border text-xs font-bold transition ${theme === t.id ? "border-slate-900 text-slate-900" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                  <span className="grid h-7 w-7 place-items-center rounded-full border border-slate-300" style={{ background: t.swatch }}>{theme === t.id && <Check size={13} className={t.id === "dark" ? "text-white" : "text-slate-900"} />}</span>{t.name}
                </button>)}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-bold text-slate-500">Layout</p>
              <div className="flex gap-1 rounded-2xl bg-slate-100 p-1" role="group" aria-label="Layout" data-testid="link-style">
                {styleBtn("buttons", "List", List)}
                {styleBtn("directory", "Grid", LayoutGrid)}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">{style === "directory" ? "Tiles in two columns, grouped by folder, with a search box once you have lots of links." : "A clean row for each link, showing the site it goes to."} Instagram, TikTok, YouTube, LinkedIn, email and similar links show as small icons under your name.</p>
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
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{l.title}</span><span className="block truncate text-xs text-slate-500">{linkBrand(l.url) ? `${linkBrand(l.url)!.name} icon · ` : ""}{linkHost(l.url) || l.url}</span></span>
            <label className="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs text-slate-500 focus-within:border-violet-400">
              <FolderOpen size={13} className="shrink-0" />
              <input defaultValue={l.group || ""} onBlur={(e) => setGroup(l.id, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} list="link-folders" maxLength={30} placeholder="Folder" aria-label={`Folder for ${l.title}`} className="w-20 bg-transparent font-semibold text-slate-700 outline-none sm:w-24" />
            </label>
            <button type="button" onClick={() => moveBy(i, -1)} disabled={i === 0} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label={`Move ${l.title} up`}><ArrowUp size={15} /></button>
            <button type="button" onClick={() => moveBy(i, 1)} disabled={i === page.links.length - 1} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label={`Move ${l.title} down`}><ArrowDown size={15} /></button>
            <button type="button" onClick={() => setLinks((x) => x.filter((y) => y.id !== l.id))} className={danger + " px-2"} aria-label={`Delete ${l.title}`}><Trash2 size={14} /></button>
          </li>)}</ul> : <Empty icon={<Link2 />} title="No links yet.">Add your first link above.</Empty>}
          {page.links.length > 0 && <p className="mt-3 rounded-xl bg-violet-50 p-3 text-xs text-violet-800"><LayoutGrid size={13} className="mr-1 inline" /> Your page is also a card on Home, so it's one tap to copy or share. Hide or move it from Home's Edit button. On iPhone, add the <span className="font-bold">Link page</span> widget to your Home Screen for a QR code people can scan.</p>}
        </Panel>
      </div>
      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-[.15em] text-slate-400">Preview</p>
        <div className="max-h-[78vh] overflow-y-auto rounded-[2rem] border border-slate-200 shadow-[0_18px_40px_#17152b14]" data-testid="link-page-preview">
          <LinkPageView title={page.title} bio={page.bio} links={page.links} style={style} theme={theme} preview />
        </div>
      </div>
    </div>
  </div>;
}
