// How a family's links are drawn: the classic link tree (big buttons) or a directory (tiles grouped into
// folders, with a search box once there are a lot of them). Used by the Link page's preview, the shared
// page anyone can open (TodoShare), and the "My links" part of Home.
import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { groupLinks, type DirectoryLink } from "@shared/linkDirectory";

export type { DirectoryLink };

const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url.replace(/^(mailto|tel):/, ""); } };

/** On the dark link-page card: buttons or directory tiles. */
export function LinkPageLinks({ links, style, big = false }: { links: readonly DirectoryLink[]; style?: "buttons" | "directory"; big?: boolean }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => links.filter((l) => !q || `${l.title} ${l.group || ""} ${l.url}`.toLowerCase().includes(q)), [links, q]);
  if (!links.length) return <p className="rounded-2xl border border-dashed border-white/40 p-4 text-sm text-violet-100">Your links show up here.</p>;
  if (style !== "directory") {
    return <div className="space-y-2.5">{links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noreferrer noopener" className={`flex items-center justify-center gap-2 rounded-2xl bg-white px-4 font-extrabold text-[#2d2555] shadow-sm transition hover:scale-[1.02] ${big ? "min-h-14 text-base" : "min-h-12 text-sm"}`}><span aria-hidden>{l.emoji}</span>{l.title}<ExternalLink size={13} className="opacity-40" /></a>)}</div>;
  }
  return <div className="space-y-4 text-left" data-testid="link-directory">
    {links.length > 8 && <div className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-3 text-violet-200" />
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search links" aria-label="Search links" className="h-10 w-full rounded-xl border border-white/20 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-violet-200 outline-none focus:border-white/50" />
    </div>}
    {groupLinks(shown).map(({ group, links: inGroup }) => <section key={group || "_"}>
      {group && <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-violet-200">{group}</h3>}
      <div className={`grid gap-2 ${big ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>{inGroup.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noreferrer noopener"
        className="flex min-h-[4.5rem] flex-col justify-between rounded-2xl bg-white p-3 text-[#2d2555] shadow-sm transition hover:-translate-y-0.5">
        <span className="text-xl leading-none" aria-hidden>{l.emoji}</span>
        <span className="mt-2 block min-w-0"><span className="block truncate text-sm font-extrabold">{l.title}</span><span className="block truncate text-[11px] text-slate-500">{host(l.url)}</span></span>
      </a>)}</div>
    </section>)}
    {q && !shown.length && <p className="text-center text-sm text-violet-100">No links match “{query}”.</p>}
  </div>;
}

/** The "My links" part of Home: a light grid of tiles, like app icons, grouped by folder. */
export function HomeLinks({ links, onOpenPage }: { links: readonly DirectoryLink[]; onOpenPage: () => void }) {
  const groups = groupLinks(links.slice(0, 24));
  return <div className="space-y-3" data-testid="home-links">
    {groups.map(({ group, links: inGroup }) => <div key={group || "_"}>
      {group && <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[.14em] text-slate-400">{group}</p>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">{inGroup.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noreferrer noopener" title={l.title}
        className="flex min-h-[4.75rem] flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-100 bg-slate-50 px-2 py-3 text-center transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
        <span className="text-2xl leading-none" aria-hidden>{l.emoji || "🔗"}</span>
        <span className="block w-full truncate text-xs font-bold text-slate-700">{l.title}</span>
      </a>)}</div>
    </div>)}
    {links.length > 24 && <button type="button" onClick={onOpenPage} className="text-sm font-bold text-violet-700 hover:underline">See all {links.length} links</button>}
  </div>;
}
