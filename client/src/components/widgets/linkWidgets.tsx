// The Links widgets: they show this hub's own Link page. The LifeHub and the WorkHub each keep their own
// links (family.linkPage and workspace.linkPage), so each hub puts its page here through the provider
// (WidgetLinksProvider) and the same widget shows different links in each. Without a provider (or with no
// links yet) a widget shows a few example links and a button to add real ones.
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import type { LinkPage, PageLink } from "@shared/familyHub";
import { THEME_COLORS, linkHost, monogram, splitLinks } from "@shared/linkPageLook";
import type { WidgetSize, WidgetTheme } from "@shared/widgets";
import { SAMPLE_LINKS, linksShown } from "@shared/linkWidgets";

export type WidgetLinks = { page: LinkPage; /** Opens this hub's Link page, to add or change links. */ open?: () => void };
const Ctx = createContext<WidgetLinks | null>(null);
export function WidgetLinksProvider({ page, open, children }: { page: LinkPage | undefined; open?: () => void; children: ReactNode }) {
  return <Ctx.Provider value={page ? { page, open } : null}>{children}</Ctx.Provider>;
}

const open = (url: string) => ({ href: url, target: url.startsWith("http") ? "_blank" : undefined, rel: "noreferrer noopener" });

function More({ extra, color, onOpen }: { extra: number; color: string; onOpen?: () => void }) {
  if (extra <= 0) return null;
  return onOpen ? <button type="button" onClick={onOpen} className="text-left text-xs font-bold" style={{ color }}>+{extra} more</button> : <p className="text-xs font-bold" style={{ color }}>+{extra} more</p>;
}

function Empty({ t, onOpen }: { t: WidgetTheme; onOpen?: () => void }) {
  return <div className="flex h-full flex-col items-start justify-center gap-2">
    <p className="text-sm font-bold" style={{ color: t.sub }}>Example links. Add yours to see them here.</p>
    {onOpen && <button type="button" onClick={onOpen} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold" style={{ background: t.accent, color: t.dark ? "#0b1224" : "#fff" }}><Plus size={15} />Add links</button>}
  </div>;
}

type Look = { text: string; sub: string; row: string; line: string; accent: string; mark: string; markText: string; page?: string };
const lookOf = (t: WidgetTheme): Look => ({ text: t.fg, sub: t.sub, row: t.soft, line: t.border === "transparent" ? t.soft : t.border, accent: t.accent, mark: t.accent, markText: t.dark ? "#0b1224" : "#ffffff" });

function Rows({ links, look, extra, onOpen, compact }: { links: PageLink[]; look: Look; extra: number; onOpen?: () => void; compact?: boolean }) {
  return <div className="flex h-full min-h-0 flex-col gap-1.5" data-testid="links-widget-rows">
    {links.map((l) => <a key={l.id} {...open(l.url)} className={`flex min-w-0 items-center gap-2.5 rounded-xl px-3 ${compact ? "min-h-9" : "min-h-10"}`} style={{ background: look.row, color: look.text }}>
      <span aria-hidden className="text-base">{l.emoji || "🔗"}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{l.title}</span>{!compact && <span className="block truncate text-[11px]" style={{ color: look.sub }}>{linkHost(l.url)}</span>}</span>
      <ArrowUpRight size={14} style={{ color: look.sub }} aria-hidden />
    </a>)}
    <More extra={extra} color={look.sub} onOpen={onOpen} />
  </div>;
}

function Tiles({ links, look, extra, onOpen, cols = 2 }: { links: PageLink[]; look: Look; extra: number; onOpen?: () => void; cols?: number }) {
  return <div className="flex h-full min-h-0 flex-col gap-2" data-testid="links-widget-tiles">
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {links.map((l) => <a key={l.id} {...open(l.url)} className="flex min-h-[4.25rem] flex-col items-start justify-between rounded-2xl p-2.5" style={{ background: look.row, color: look.text }}>
        <span aria-hidden className="text-xl leading-none">{l.emoji || "🔗"}</span>
        <span className="block w-full truncate text-xs font-bold">{l.title}</span>
      </a>)}
    </div>
    <More extra={extra} color={look.sub} onOpen={onOpen} />
  </div>;
}

function Icons({ links, look, extra, onOpen }: { links: PageLink[]; look: Look; extra: number; onOpen?: () => void }) {
  return <div className="flex h-full min-h-0 flex-col justify-center gap-2" data-testid="links-widget-icons">
    <div className="flex flex-wrap gap-2.5">
      {links.map((l) => <a key={l.id} {...open(l.url)} title={l.title} aria-label={l.title} className="grid h-11 w-11 place-items-center rounded-full text-xl" style={{ background: look.row, color: look.text, border: `1px solid ${look.line}` }}>{l.emoji || "🔗"}</a>)}
    </div>
    <More extra={extra} color={look.sub} onOpen={onOpen} />
  </div>;
}

/** The face of a Links widget (`links-page`, `links-list`, `links-tiles` or `links-icons`). */
export function LinksFace({ type, t, size }: { type: string; t: WidgetTheme; size: WidgetSize }) {
  const ctx = useContext(Ctx);
  const real = ctx?.page.links ?? [];
  const sample = real.length === 0;
  const links = sample ? SAMPLE_LINKS : real;
  const onOpen = ctx?.open;
  const n = linksShown(type, size);
  const shown = links.slice(0, n), extra = sample ? 0 : links.length - shown.length;
  if (type === "links-page") {
    // The page's own look: its theme's colours, its name, and a list or tiles as chosen on the Link page.
    const page = ctx?.page;
    const c = THEME_COLORS[page?.theme ?? "light"];
    const name = page?.title.trim() || "My links";
    const grid = page?.style === "directory";
    const { icons, rows } = sample ? { icons: [], rows: shown } : splitLinks(links);
    // Sized to fit without cutting a row in half: a wide widget has room for one row of tiles or two rows of the list.
    const body = grid ? rows.slice(0, size === "large" ? 6 : size === "wide" ? 4 : 2) : rows.slice(0, size === "large" ? 5 : 2);
    const look: Look = { text: c.text, sub: c.sub, row: c.row, line: c.line, accent: c.mark, mark: c.mark, markText: c.markText };
    const box: CSSProperties = { background: c.page, color: c.text, borderColor: c.line };
    return <div className="-m-1 flex h-[calc(100%+0.5rem)] flex-col gap-2 overflow-hidden rounded-2xl border p-3" style={box} data-testid="links-widget-page" data-theme={page?.theme ?? "light"} data-layout={grid ? "grid" : "list"}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold" style={{ background: c.mark, color: c.markText }} aria-hidden>{monogram(name)}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
        {icons.length > 0 && size !== "small" && <span className="flex shrink-0 gap-1">{icons.slice(0, 4).map((i) => <a key={i.id} {...open(i.url)} title={i.title} aria-label={i.title} className="grid h-7 w-7 place-items-center rounded-full text-sm" style={{ background: c.row, border: `1px solid ${c.line}` }}>{i.emoji || "🔗"}</a>)}</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {sample ? <Empty t={t} onOpen={onOpen} /> : grid ? <Tiles links={body} look={look} extra={Math.max(0, links.length - icons.slice(0, 4).length - body.length)} onOpen={onOpen} cols={size === "wide" ? 4 : 2} /> : <Rows links={body} look={look} compact extra={Math.max(0, links.length - icons.slice(0, 4).length - body.length)} onOpen={onOpen} />}
      </div>
    </div>;
  }
  const look = lookOf(t);
  if (sample) return <div className="flex h-full flex-col gap-2"><div className="min-h-0 flex-1 overflow-hidden opacity-70">{type === "links-tiles" ? <Tiles links={shown.slice(0, 2)} look={look} extra={0} /> : type === "links-icons" ? <Icons links={shown} look={look} extra={0} /> : <Rows links={shown.slice(0, 2)} look={look} compact extra={0} />}</div><Empty t={t} onOpen={onOpen} /></div>;
  if (type === "links-tiles") return <Tiles links={shown} look={look} extra={extra} onOpen={onOpen} cols={size === "wide" ? 4 : 2} />;
  if (type === "links-icons") return <Icons links={shown} look={look} extra={extra} onOpen={onOpen} />;
  return <Rows links={shown} look={look} extra={extra} onOpen={onOpen} compact={size === "small"} />;
}
