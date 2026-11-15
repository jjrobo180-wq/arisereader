// A Link page as people see it: a calm, minimal profile page. A round mark with your initials, your name
// and a line about you, your social profiles as a row of small icons, then your other links as quiet rows
// (or a grid of tiles in folders) showing the site each goes to. Used by the public page (TodoShare), the
// Link page editor's preview and the Link page card on Home. Colours: shared/linkPageLook.ts.
import { useMemo, useState, type ComponentType } from "react";
import {
  ArrowUpRight, AtSign, Facebook, Github, Ghost, Globe, Instagram, Linkedin, Mail, Music2, Phone, Pin, Search, Twitch, Twitter, Youtube,
} from "lucide-react";
import { groupLinks, type DirectoryLink } from "@shared/linkDirectory";
import { THEME_COLORS, linkHost, monogram, splitLinks, type LinkBrand, type LinkPageTheme } from "@shared/linkPageLook";

const BRAND_ICON: Record<LinkBrand, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  instagram: Instagram, tiktok: Music2, youtube: Youtube, x: Twitter, facebook: Facebook, linkedin: Linkedin, github: Github,
  twitch: Twitch, spotify: Music2, snapchat: Ghost, pinterest: Pin, threads: AtSign, email: Mail, phone: Phone,
};

export type LinkPageViewProps = {
  title: string;
  bio: string;
  links: readonly DirectoryLink[];
  style?: "buttons" | "directory";
  theme?: LinkPageTheme;
  /** Smaller, for the editor's preview: no page padding or footer. */
  preview?: boolean;
};

/** A link's small icon: its own emoji when it has one other than the plain link, otherwise a globe. */
function RowIcon({ emoji, color }: { emoji: string; color: string }) {
  const own = emoji && emoji !== "🔗";
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[17px]" style={{ background: `${color}10`, color }} aria-hidden>
    {own ? emoji : <Globe size={16} strokeWidth={1.8} />}
  </span>;
}

export function LinkPageView({ title, bio, links, style, theme = "light", preview = false }: LinkPageViewProps) {
  const c = THEME_COLORS[theme] ?? THEME_COLORS.light;
  const { icons, rows } = useMemo(() => splitLinks(links), [links]);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => rows.filter((l) => !q || `${l.title} ${l.group || ""} ${l.url}`.toLowerCase().includes(q)), [rows, q]);
  const grouped = groupLinks(shown);
  const name = title.trim() || "Your name";
  const grid = style === "directory";

  return <div className={preview ? "" : "min-h-[100dvh]"} style={{ background: c.page, color: c.text }} data-testid="link-page-view" data-theme={theme}>
    <div className={`mx-auto flex w-full max-w-[460px] flex-col items-center ${preview ? "px-5 pb-6 pt-7" : "px-5 pb-10 pt-14 sm:pt-20"}`}>
      <div className={`grid place-items-center rounded-full font-semibold tracking-tight ${preview ? "h-16 w-16 text-xl" : "h-[88px] w-[88px] text-[28px]"}`} style={{ background: c.mark, color: c.markText }} aria-hidden>{monogram(name)}</div>
      <h1 className={`mt-4 text-center font-semibold tracking-[-0.02em] ${preview ? "text-lg" : "text-[22px]"}`} data-testid="link-page-name">{name}</h1>
      {bio.trim() && <p className={`mt-1.5 max-w-[34ch] text-center leading-relaxed ${preview ? "text-[13px]" : "text-[15px]"}`} style={{ color: c.sub }}>{bio}</p>}

      {icons.length > 0 && <ul className="mt-5 flex flex-wrap justify-center gap-2" data-testid="link-page-icons">
        {icons.map((l, i) => { const Icon = BRAND_ICON[l.brand.id]; return <li key={i}>
          <a href={l.url} target="_blank" rel="noreferrer noopener" aria-label={`${l.title} (${l.brand.name})`} title={l.title}
            className="grid h-10 w-10 place-items-center rounded-full border transition-colors"
            style={{ borderColor: c.line, color: c.text, background: c.row }}
            onMouseEnter={(e) => { e.currentTarget.style.background = c.rowHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = c.row; }}>
            <Icon size={17} strokeWidth={1.8} />
          </a>
        </li>; })}
      </ul>}

      <div className={`w-full ${icons.length ? "mt-7" : "mt-8"}`}>
        {grid && rows.length > 8 && <label className="relative mb-4 block">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: c.sub }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search links" aria-label="Search links"
            className="h-11 w-full rounded-xl border bg-transparent pl-10 pr-3 text-[15px] outline-none" style={{ borderColor: c.line, color: c.text }} />
        </label>}
        {grouped.map(({ group, links: inGroup }) => <section key={group || "_"} className="mb-5 last:mb-0">
          {group && <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[.14em]" style={{ color: c.sub }}>{group}</h2>}
          {grid
            ? <div className="grid grid-cols-2 gap-2.5">{inGroup.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noreferrer noopener"
                className="flex min-h-[92px] flex-col justify-between rounded-2xl border p-3.5 transition-colors"
                style={{ borderColor: c.line, background: c.row }}
                onMouseEnter={(e) => { e.currentTarget.style.background = c.rowHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = c.row; }}>
                <RowIcon emoji={l.emoji} color={c.text} />
                <span className="mt-3 block min-w-0"><span className="block truncate text-[14px] font-medium">{l.title}</span><span className="block truncate text-[12px]" style={{ color: c.sub }}>{linkHost(l.url)}</span></span>
              </a>)}</div>
            : <ul className="space-y-2.5" data-testid="link-page-rows">{inGroup.map((l, i) => <li key={i}>
                <a href={l.url} target="_blank" rel="noreferrer noopener"
                  className="group flex min-h-[60px] items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors"
                  style={{ borderColor: c.line, background: c.row }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = c.rowHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = c.row; }}>
                  <RowIcon emoji={l.emoji} color={c.text} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium">{l.title}</span><span className="block truncate text-[12.5px]" style={{ color: c.sub }}>{linkHost(l.url)}</span></span>
                  <ArrowUpRight size={16} strokeWidth={1.8} className="shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" style={{ color: c.sub }} />
                </a>
              </li>)}</ul>}
        </section>)}
        {q && !shown.length && <p className="text-center text-sm" style={{ color: c.sub }}>No links match “{query}”.</p>}
        {!links.length && <p className="rounded-2xl border border-dashed p-5 text-center text-sm" style={{ borderColor: c.line, color: c.sub }}>Your links show up here.</p>}
      </div>

      {!preview && <a href="https://arisetodo.com" target="_blank" rel="noreferrer noopener" className="mt-12 text-[12px] tracking-wide opacity-70 transition-opacity hover:opacity-100" style={{ color: c.sub }}>Made with Arise</a>}
    </div>
  </div>;
}
