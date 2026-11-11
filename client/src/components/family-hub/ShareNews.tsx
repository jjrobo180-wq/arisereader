// Something newly shared with you shows up right away, with no restart: the app looks for new shares every
// 20 seconds while it's on screen and the moment it comes back, and says so in a banner you can tap.
import { useEffect, useRef, useState } from "react";
import { linksApi, type SharedLink } from "@/lib/profileLinks";
import { sharedAppLabel } from "@shared/sharedApps";

const seenKey = "arise-share-seen";
const keyOf = (l: SharedLink) => `${l.ownerId}:${l.status}:${Object.keys(l.grants).sort().join(",")}`;

export default function ShareNews({ token }: { token: string | null | undefined }) {
  const [news, setNews] = useState<{ who: string; what: string; pending: boolean } | null>(null);
  const first = useRef(true);
  useEffect(() => {
    if (!token) return;
    let live = true;
    const look = async () => {
      if (document.visibilityState !== "visible") return;
      const r = await linksApi(token).list().catch(() => null);
      if (!live || !r) return;
      let seen: Record<string, string> = {};
      try { seen = JSON.parse(localStorage.getItem(seenKey) || "{}"); } catch { /* none */ }
      const now: Record<string, string> = {};
      let fresh: { who: string; what: string; pending: boolean } | null = null;
      for (const l of r.withMe) {
        now[String(l.ownerId)] = keyOf(l);
        const before = seen[String(l.ownerId)];
        if (before === keyOf(l)) continue;
        const had = new Set((before?.split(":")[2] || "").split(",").filter(Boolean));
        const added = Object.keys(l.grants).filter((g) => !had.has(g)).map((g) => sharedAppLabel(g)).filter(Boolean) as string[];
        if (l.status === "pending" || added.length) fresh = { who: l.ownerName || "Someone", what: added.length ? [...new Set(added)].slice(0, 2).join(" and ") : "their apps", pending: l.status === "pending" };
      }
      try { localStorage.setItem(seenKey, JSON.stringify(now)); } catch { /* fine */ }
      // The very first look on a device only remembers what's there; after that, anything new is news.
      if (fresh && !(first.current && !Object.keys(seen).length)) setNews(fresh);
      first.current = false;
    };
    void look();
    const t = window.setInterval(() => void look(), 20_000);
    const vis = () => { if (document.visibilityState === "visible") void look(); };
    document.addEventListener("visibilitychange", vis);
    return () => { live = false; window.clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [token]);
  if (!news) return null;
  return <div role="status" className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[90] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900 p-3 text-white shadow-2xl" data-testid="share-news">
    <p className="min-w-0 flex-1 text-sm"><b>{news.who}</b> shared {news.what} with you.</p>
    <button type="button" onClick={() => { setNews(null); window.location.hash = "#/lifehub?go=linked"; }} className="min-h-11 rounded-xl bg-white px-4 text-sm font-bold text-slate-900">{news.pending ? "Accept" : "Open"}</button>
    <button type="button" onClick={() => setNews(null)} aria-label="Dismiss" className="min-h-11 px-2 text-slate-300">✕</button>
  </div>;
}
