// The Link page on Home: a small card of your page (your mark, name and address) with one tap to copy or
// share it, open it, or edit it, and your links below as tiles. Shown when the page has links.
import { duoLink, duoOpen } from "@/lib/duoWidgets";
import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Copy, Loader2, Pencil, Share2 } from "lucide-react";
import type { LinkPage } from "@shared/familyHub";
import { THEME_COLORS, monogram } from "@shared/linkPageLook";
import { publishWidgets, type WidgetSlot } from "@/lib/widgets";
import { makeShare, sendLink, useTodoShares } from "@/lib/todoShares";
import { HomeLinks } from "./LinkDirectory";

export function LinkPageCard({ page, say, onEdit }: { page: LinkPage; say: (message: string) => void; onEdit: () => void }) {
  const { token, shares } = useTodoShares();
  const live = shares.find((s) => s.target === "links");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const c = THEME_COLORS[page.theme ?? "light"];
  const name = page.title.trim() || "My links";
  const address = live ? live.url.replace(/^https?:\/\//, "") : "";

  async function share() {
    setBusy(true);
    try {
      const link = live || (await makeShare(token, "links"));
      const how = await sendLink(link.url, name);
      if (how === "cancelled") return;
      setCopied(true); window.setTimeout(() => setCopied(false), 2200);
      say(how === "copied" ? "Link copied." : "Your page is ready to share.");
    } catch (e: any) { say(e?.message || "Could not make a link."); }
    finally { setBusy(false); }
  }

  const btn = "inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50";
  return <div className="space-y-4" data-testid="link-page-card">
    <div className="flex items-center gap-3.5 rounded-2xl border p-3.5" style={{ background: c.page, borderColor: c.line, color: c.text }}>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-base font-semibold" style={{ background: c.mark, color: c.markText }} aria-hidden>{monogram(name)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold tracking-tight">{name}</span>
        <span className="block truncate text-xs" style={{ color: c.sub }}>{address || `${page.links.length} link${page.links.length === 1 ? "" : "s"} · not shared yet`}</span>
      </span>
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={share} disabled={busy} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60" data-testid="link-page-card-share">
        {busy ? <Loader2 size={15} className="animate-spin" /> : copied ? <Check size={15} /> : live ? <Copy size={15} /> : <Share2 size={15} />}{live ? "Copy link" : "Share my page"}
      </button>
      {live && <a href={live.url} target="_blank" rel="noreferrer noopener" className={btn}><ArrowUpRight size={15} />Open</a>}
      <button type="button" onClick={onEdit} className={btn}><Pencil size={14} />Edit</button>
    </div>
    <HomeLinks links={page.links} onOpenPage={onEdit} />
  </div>;
}

/** The iPhone Link page widget's slot: your initials, name and address, your links, and a QR code of the
 *  page once it has a share link (until then the widget asks you to share it from the app). */
export function linkPageSlot(page: LinkPage, url?: string): WidgetSlot {
  const name = page.title.trim() || "My links";
  const short = url ? url.replace(/^https?:\/\//, "").replace(/^(.{26}).+$/, "$1…") : "";
  return {
    id: "duo.linkpage", title: name, value: monogram(name),
    detail: short || "Share your page to get a QR code",
    tint: THEME_COLORS[page.theme ?? "light"].page,
    ...(page.links.length ? { lines: page.links.slice(0, 8).map((l) => l.title), urls: page.links.slice(0, 8).map((l) => (/^https?:\/\//i.test(l.url) ? duoLink(l.url) : duoOpen("links"))) } : {}),
    open: duoOpen("links"),
    ...(url ? { qr: url } : {}),
  };
}

/** Keeps the iPhone Link page widget up to date (nothing happens outside the iPhone app). */
export function LinkPageWidgetFeed({ page }: { page: LinkPage }) {
  const { shares } = useTodoShares();
  const url = shares.find((s) => s.target === "links")?.url;
  useEffect(() => {
    const t = window.setTimeout(() => publishWidgets([linkPageSlot(page, url)]), 1200);
    return () => window.clearTimeout(t);
  }, [page, url]);
  return null;
}
