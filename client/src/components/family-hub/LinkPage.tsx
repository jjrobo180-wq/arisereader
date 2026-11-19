// Links (a Plugin Gallery add-on, in LifeHub and WorkHub): a simple place for your links. Paste an address, name it
// if you like, and file it in a folder. Tap a link to open it. The public page (share link, theme, list or grid) is
// still there, folded away under "Public page", and the Home card and widgets show these same links.
import { useMemo, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Folder, FolderPlus, Globe, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import type { LinkPage as LinkPageData, LinkPageStyle, PageLink } from "@shared/familyHub";
import { LINK_THEMES, linkHost, type LinkPageTheme } from "@shared/linkPageLook";
import { openOutside } from "@/lib/nativeApp";
import { fixUrl, foldersOf, nameFromUrl } from "@shared/linkList";
import { ShareButton } from "./ShareLink";
import { inputClass, type SectionProps } from "./ui";

const cleanFolder = (g: string) => g.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 30);

/** The LifeHub's links. The WorkHub has its own (workspace.linkPage) with the same editor; the two never mix. */
export default function LinkPage({ family, setFamily, makeId, say }: SectionProps) {
  return <LinkPageEditor page={family.linkPage} update={(fn) => setFamily((f) => ({ ...f, linkPage: fn(f.linkPage) }))} makeId={makeId} say={say} where="life" />;
}

const ALL = "\u0000all";
const LOOSE = "\u0000loose";

export function LinkPageEditor({ page, update, makeId, say, where }: { page: LinkPageData; update: (fn: (p: LinkPageData) => LinkPageData) => void; makeId: () => string; say: (message: string) => void; where: "life" | "work" }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [folder, setFolder] = useState<string>(ALL);
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; title: string; url: string } | null>(null);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);
  const [publicOpen, setPublicOpen] = useState(false);
  const folders = foldersOf(page);
  const setLinks = (change: (l: PageLink[]) => PageLink[]) => update((p) => ({ ...p, links: change(p.links) }));
  const setFolders = (next: string[]) => update((p) => { const { folders: _f, ...rest } = p; return next.length ? { ...rest, folders: next } : rest; });

  const add = (e: FormEvent) => {
    e.preventDefault();
    const link = fixUrl(url);
    if (!link) { say("That doesn't look like a web address. Try something like example.com."); return; }
    const group = folder !== ALL && folder !== LOOSE ? folder : "";
    setLinks((l) => [...l, { id: makeId(), title: name.trim().slice(0, 80) || nameFromUrl(link), url: link, emoji: "", ...(group ? { group } : {}) }]);
    setUrl(""); setName("");
  };
  const moveTo = (id: string, g: string) => setLinks((l) => l.map((x) => { if (x.id !== id) return x; const { group: _old, ...rest } = x; return g ? { ...rest, group: g } : rest; }));
  const moveBy = (id: string, d: -1 | 1) => setLinks((l) => { const i = l.findIndex((x) => x.id === id); const j = i + d; if (i < 0 || j < 0 || j >= l.length) return l; const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const saveEdit = () => {
    if (!editing) return;
    const link = fixUrl(editing.url);
    if (!link) { say("That doesn't look like a web address."); return; }
    setLinks((l) => l.map((x) => (x.id === editing.id ? { ...x, title: editing.title.trim().slice(0, 80) || nameFromUrl(link), url: link } : x)));
    setEditing(null);
  };
  const addFolder = () => {
    const g = cleanFolder(newFolder || "");
    if (!g) { setNewFolder(null); return; }
    if (!folders.some((f) => f.toLowerCase() === g.toLowerCase())) setFolders([...folders, g]);
    setFolder(g); setNewFolder(null);
  };
  const renameFolder = () => {
    if (!renaming) return;
    const to = cleanFolder(renaming.to);
    if (to && to !== renaming.from) update((p) => ({ ...p, folders: foldersOf(p).map((f) => (f === renaming.from ? to : f)), links: p.links.map((l) => (l.group === renaming.from ? { ...l, group: to } : l)) }));
    if (to) setFolder(to);
    setRenaming(null);
  };
  const deleteFolder = (g: string) => {
    const n = page.links.filter((l) => l.group === g).length;
    if (n && !window.confirm(`Delete the folder "${g}"? Its ${n} ${n === 1 ? "link stays" : "links stay"}, out of the folder.`)) return;
    update((p) => ({ ...p, folders: foldersOf(p).filter((f) => f !== g), links: p.links.map((l) => { if (l.group !== g) return l; const { group: _g, ...rest } = l; return rest; }) }));
    setFolder(ALL);
  };

  const words = q.trim().toLowerCase();
  const shown = useMemo(() => page.links.filter((l) => (folder === ALL || (folder === LOOSE ? !l.group : l.group === folder)) && (!words || `${l.title} ${l.url} ${l.group || ""}`.toLowerCase().includes(words))), [page.links, folder, words]);
  const looseCount = page.links.filter((l) => !l.group).length;
  const tab = (id: string, label: string, count: number) => (
    <button key={id} type="button" onClick={() => setFolder(id)} aria-pressed={folder === id}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition ${folder === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
      {id !== ALL && id !== LOOSE && <Folder size={14} />}{label}<span className={folder === id ? "text-white/60" : "text-slate-400"}>{count}</span>
    </button>
  );

  return <div className="mx-auto max-w-2xl space-y-5" data-testid="links-simple">
    <div className="flex items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold tracking-tight text-slate-950">Links</h1><p className="text-sm text-slate-500">{where === "work" ? "Your work links. Only in Work." : "Your links. Only in Life."}</p></div>
      {page.links.length > 8 && <label className="relative w-44 sm:w-56"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search links" className={inputClass + " !min-h-10 pl-9"} /></label>}
    </div>

    <form onSubmit={add} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 sm:flex-row" data-testid="links-add">
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a link" aria-label="Web address" inputMode="url" autoCapitalize="none" maxLength={1000} className="min-h-11 min-w-0 flex-[2] rounded-xl px-3 text-sm outline-none" />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" aria-label="Link name" maxLength={80} className="min-h-11 min-w-0 flex-1 rounded-xl px-3 text-sm outline-none sm:border-l sm:border-slate-100" />
      <button type="submit" disabled={!url.trim()} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-40"><Plus size={16} />Add{folder !== ALL && folder !== LOOSE ? ` to ${folder}` : ""}</button>
    </form>

    <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1" role="group" aria-label="Folders">
      {tab(ALL, "All", page.links.length)}
      {folders.map((g) => tab(g, g, page.links.filter((l) => l.group === g).length))}
      {folders.length > 0 && looseCount > 0 && tab(LOOSE, "No folder", looseCount)}
      {newFolder === null
        ? <button type="button" onClick={() => setNewFolder("")} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-slate-500 hover:bg-slate-100" data-testid="links-new-folder"><FolderPlus size={15} />New folder</button>
        : <form onSubmit={(e) => { e.preventDefault(); addFolder(); }} className="flex shrink-0 items-center gap-1"><input autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)} onBlur={addFolder} maxLength={30} placeholder="Folder name" aria-label="New folder name" className={inputClass + " !min-h-9 w-36"} /></form>}
    </div>

    {folder !== ALL && folder !== LOOSE && (
      <div className="flex items-center gap-2 text-sm">
        {renaming ? <form onSubmit={(e) => { e.preventDefault(); renameFolder(); }} className="flex items-center gap-1"><input autoFocus value={renaming.to} onChange={(e) => setRenaming({ ...renaming, to: e.target.value })} onBlur={renameFolder} maxLength={30} aria-label="Folder name" className={inputClass + " !min-h-9 w-44"} /></form>
          : <><button type="button" onClick={() => setRenaming({ from: folder, to: folder })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"><Pencil size={13} />Rename folder</button>
            <button type="button" onClick={() => deleteFolder(folder)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={13} />Delete folder</button></>}
      </div>
    )}

    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="links-list">
      {shown.map((l) => {
        const host = linkHost(l.url) || l.url.replace(/^(mailto|tel):/, "");
        if (editing?.id === l.id) return (
          <li key={l.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <input autoFocus value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} aria-label="Name" maxLength={80} className={inputClass + " !min-h-10 flex-1"} />
            <input value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} aria-label="Address" maxLength={1000} className={inputClass + " !min-h-10 flex-[2]"} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }} />
            <div className="flex gap-1"><button type="button" onClick={saveEdit} aria-label="Save" className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white"><Check size={16} /></button><button type="button" onClick={() => setEditing(null)} aria-label="Cancel" className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><X size={16} /></button></div>
          </li>
        );
        return (
          <li key={l.id} className="group relative flex items-center gap-3 px-3 py-2.5" data-testid="links-row">
            <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600">{l.emoji || (host.replace(/^www\./, "")[0] || "•").toUpperCase()}</span>
            <a href={l.url} onClick={(e) => { if (/^https?:/i.test(l.url)) { e.preventDefault(); openOutside(l.url); } }} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900 group-hover:underline">{l.title}</span>
              <span className="block truncate text-xs text-slate-400">{host}{folder === ALL && l.group ? ` · ${l.group}` : ""}</span>
            </a>
            <button type="button" onClick={() => setMenu(menu === l.id ? null : l.id)} aria-label={`More for ${l.title}`} aria-expanded={menu === l.id} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><MoreHorizontal size={17} /></button>
            {menu === l.id && (
              <div className="absolute right-2 top-12 z-20 w-56 rounded-2xl border border-slate-200 bg-white p-1.5 text-sm shadow-xl" role="menu" onMouseLeave={() => setMenu(null)}>
                <button type="button" role="menuitem" onClick={() => { setEditing({ id: l.id, title: l.title, url: l.url }); setMenu(null); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-slate-50"><Pencil size={14} />Edit</button>
                <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Move to</div>
                {["", ...folders].map((g) => <button key={g || "none"} type="button" role="menuitem" onClick={() => { moveTo(l.id, g); setMenu(null); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left hover:bg-slate-50">{(l.group || "") === g ? <Check size={14} /> : <span className="w-3.5" />}{g || "No folder"}</button>)}
                <div className="my-1 border-t border-slate-100" />
                <div className="flex gap-1 px-1"><button type="button" onClick={() => moveBy(l.id, -1)} aria-label="Move up" className="grid h-9 flex-1 place-items-center rounded-xl hover:bg-slate-50"><ArrowUp size={15} /></button><button type="button" onClick={() => moveBy(l.id, 1)} aria-label="Move down" className="grid h-9 flex-1 place-items-center rounded-xl hover:bg-slate-50"><ArrowDown size={15} /></button></div>
                <button type="button" role="menuitem" onClick={() => { setLinks((x) => x.filter((y) => y.id !== l.id)); setMenu(null); }} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-rose-700 hover:bg-rose-50"><Trash2 size={14} />Delete</button>
              </div>
            )}
          </li>
        );
      })}
      {!shown.length && <li className="px-4 py-10 text-center text-sm text-slate-500">{page.links.length ? (words ? "No links match that." : "No links in this folder yet.") : "No links yet. Paste one above."}</li>}
    </ul>

    <section className="rounded-2xl border border-slate-200 bg-white" data-testid="links-public">
      <button type="button" onClick={() => setPublicOpen((o) => !o)} aria-expanded={publicOpen} className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-sm font-semibold text-slate-700">
        <Globe size={16} className="text-slate-400" /><span className="flex-1">Public page{where === "life" ? " & sharing" : ""}</span><ChevronDown size={16} className={`text-slate-400 transition ${publicOpen ? "rotate-180" : ""}`} />
      </button>
      {publicOpen && <PublicPage page={page} update={update} say={say} where={where} />}
    </section>
  </div>;
}

/** The public page's name, line and look, folded away under "Public page" (it also drives the Home card and widgets). */
function PublicPage({ page, update, say, where }: { page: LinkPageData; update: (fn: (p: LinkPageData) => LinkPageData) => void; say: (m: string) => void; where: "life" | "work" }) {
  const style: LinkPageStyle = page.style === "directory" ? "directory" : "buttons";
  const theme: LinkPageTheme = page.theme ?? "light";
  const setTheme = (next: LinkPageTheme) => update((p) => { const { theme: _old, ...rest } = p; return next === "light" ? rest : { ...rest, theme: next }; });
  const setStyle = (next: LinkPageStyle) => update((p) => { const { style: _old, ...rest } = p; return next === "directory" ? { ...rest, style: "directory" as const } : rest; });
  return <div className="space-y-3 border-t border-slate-100 p-4">
    <input value={page.title} onChange={(e) => update((p) => ({ ...p, title: e.target.value }))} maxLength={80} placeholder="Page name" className={inputClass} aria-label="Page name" />
    <input value={page.bio} onChange={(e) => update((p) => ({ ...p, bio: e.target.value }))} maxLength={300} placeholder="A line about you (optional)" className={inputClass} aria-label="About" />
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="contents" role="group" aria-label="Theme" data-testid="link-theme">{LINK_THEMES.map((t) => <button key={t.id} type="button" onClick={() => setTheme(t.id)} aria-pressed={theme === t.id} title={t.name} aria-label={t.name} className={`grid h-9 w-9 place-items-center rounded-full border ${theme === t.id ? "border-slate-900 ring-2 ring-slate-900/20" : "border-slate-300"}`} style={{ background: t.swatch }}>{theme === t.id && <Check size={13} className={t.id === "dark" ? "text-white" : "text-slate-900"} />}</button>)}</span>
      <span className="mx-1 h-6 w-px bg-slate-200" />
      <span className="contents" role="group" aria-label="Layout" data-testid="link-style">{(["buttons", "directory"] as const).map((s) => <button key={s} type="button" onClick={() => setStyle(s)} aria-pressed={style === s} className={`min-h-9 rounded-full px-3 font-semibold ${style === s ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{s === "buttons" ? "List" : "Grid"}</button>)}</span>
    </div>
    {where === "life" && <ShareButton target="links" title={page.title || "My links"} say={say} label="Share my page" />}
  </div>;
}
