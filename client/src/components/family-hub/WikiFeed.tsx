// Arise Wiki (LifeHub section "wiki"): every Wikipedia article as an endless, full-screen swipe feed that learns what
// you like (the algorithm is shared/wikiFeed.ts). Cards come straight from Wikipedia's public API. Tap a card for the
// whole article with every link working (links open inside, as deep as you like, with Back). Like (or double-tap),
// comment, save, share, or "Not for me". Taste, likes and saves are kept on this device and on the account
// (server/wikiFeed.ts), so every device shares them. Mature topics are filtered by default, and always for students.
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type MutableRefObject, type ReactNode } from "react";
import { ArrowLeft, Bookmark, ChevronUp, ExternalLink, EyeOff, Flag, Heart, Loader2, MessageCircle, Play, Search, Send, Share2, Sparkles, Trash2, X } from "lucide-react";
import { SwipeFeed, type SwipeFeedHandle } from "@/components/swipe/SwipeFeed";
import { tap } from "@/lib/celebrate";
import { API_BASE } from "@/lib/queryClient";
import {
  articleUrl, cleanProfile, dwellSignal, interleave, laneUrl, learn, learnSearch, learnSubtopic, markSeen, mergeProfiles, newProfile, pageUrl, pickLane, pickSearch, pickSeed, pickTopic,
  relatedUrl, searchPageUrl, short, subLabel, SUBTOPICS, suggestions, suggestUrl, titlesUrl, toCards, toggleSave, TOPICS, trendTitles, trendUrl, unlike, weave,
  type Lane, type Signal, type WikiCard, type WikiProfile,
} from "@shared/wikiFeed";

type Props = { say: (m: string) => void; token?: string | null; student?: boolean; userId?: number };
type Stats = { likes: number; comments: number; shares: number };
type Comment = { id: string; author: string; text: string; at: string; mine: boolean };

const KEY = (uid?: number) => `arise-wiki-profile:${uid ?? "me"}`;
const readLocal = (uid?: number): WikiProfile | null => { try { const v = localStorage.getItem(KEY(uid)); return v ? cleanProfile(JSON.parse(v)) : null; } catch { return null; } };
const writeLocal = (uid: number | undefined, p: WikiProfile) => { try { localStorage.setItem(KEY(uid), JSON.stringify(p)); } catch { /* this visit only */ } };
const getJson = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const random = Math.random;
const GRADIENTS = ["from-[#1e1b4b] to-[#7c3aed]", "from-[#0f172a] to-[#0e7490]", "from-[#3b0764] to-[#db2777]", "from-[#052e16] to-[#16a34a]", "from-[#431407] to-[#ea580c]", "from-[#172554] to-[#2563eb]", "from-[#1c1917] to-[#a16207]"];
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const laneLabel: Record<Lane, string> = { seed: "More like what you love", topic: "Picked for you", search: "From your search", trend: "Trending today", explore: "Discover" };

/** The interest profile: this device's copy, merged with the account's, saved to both. */
function useProfile(token: string | null | undefined, uid: number | undefined, student: boolean) {
  const [profile, setProfile] = useState<WikiProfile | null>(() => readLocal(uid));
  const [synced, setSynced] = useState(false);
  const ref = useRef(profile);
  ref.current = profile;
  const auth = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);
  useEffect(() => {
    if (!auth) { setSynced(true); return; }
    let live = true;
    fetch(`${API_BASE}/api/wiki/profile`, { headers: auth }).then((r) => (r.ok ? r.json() : null)).then((b) => {
      if (!live) return;
      const theirs = b?.profile ? cleanProfile(b.profile) : null;
      if (theirs) setProfile((mine) => (mine ? mergeProfiles(mine, theirs) : theirs));
    }).catch(() => {}).finally(() => live && setSynced(true));
    return () => { live = false; };
  }, [auth]);
  // Saved here at once, and to the account a few seconds after the last change (and when the page closes).
  const timer = useRef<number>();
  const push = useCallback(() => {
    const p = ref.current;
    if (!p || !auth) return;
    void fetch(`${API_BASE}/api/wiki/profile`, { method: "PUT", keepalive: true, headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ profile: p }) }).catch(() => {});
  }, [auth]);
  useEffect(() => {
    if (!profile) return;
    writeLocal(uid, profile);
    if (!synced) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(push, 4000);
  }, [profile, synced, uid, push]);
  useEffect(() => { const bye = () => push(); window.addEventListener("pagehide", bye); return () => { window.removeEventListener("pagehide", bye); push(); }; }, [push]);
  const forced = student ? (p: WikiProfile) => ({ ...p, matureOff: undefined }) : (p: WikiProfile) => p;
  return { profile: profile ? forced(profile) : null, setProfile, ref, synced, auth };
}

/** What the feed is showing: For you, a search, one subject (and everything like it), or a whole topic. */
export type FeedMode = { kind: "you" } | { kind: "search"; q: string } | { kind: "focus"; title: string } | { kind: "topic"; id: string };
export const modeKey = (m: FeedMode) => (m.kind === "you" ? "you" : m.kind === "search" ? `s:${m.q}` : m.kind === "focus" ? `f:${m.title}` : `t:${m.id}`);

/**
 * The endless feed. For you: batches from the learning lanes, woven together. A search: its results in order, best
 * first, two at a time with one "more like the top result" between, page after page; when they run out, more like
 * what you liked in it. A subject: that article, then everything like it. A topic: its best-known articles mixed with
 * its subtopics. More is fetched as you near the end, so none of them ends.
 */
function useFeed(profileRef: MutableRefObject<WikiProfile | null>, student: boolean, onSearched: (q: string, top: string | null) => void) {
  const [cards, setCards] = useState<WikiCard[]>([]);
  const [mode, setModeState] = useState<FeedMode>({ kind: "you" });
  const modeRef = useRef<FeedMode>(mode);
  const pool = useRef<WikiCard[]>([]);
  const inFeed = useRef(new Set<string>());
  const busy = useRef(0); // which mode's fetch is running (a new mode makes an old fetch's answer ignored)
  const gen = useRef(0);
  const page = useRef(0);
  const anchor = useRef<string | null>(null);
  const trend = useRef<{ day: string; titles: string[] } | null>(null);

  const filterFor = (focused: boolean) => {
    const p = profileRef.current ?? newProfile();
    // A search shows what you asked for even if you've seen it; For you never repeats.
    return { seen: focused ? [...inFeed.current] : [...p.seen, ...inFeed.current], nope: p.nope, matureOff: student ? false : p.matureOff };
  };
  const trending = async (): Promise<string[]> => {
    const d = new Date(), day = d.toISOString().slice(0, 10);
    if (trend.current?.day !== day) {
      let json = await getJson(trendUrl(d));
      if (!json?.mostread) json = await getJson(trendUrl(new Date(d.getTime() - 86_400_000)));
      trend.current = { day, titles: trendTitles(json).sort(() => random() - 0.5) };
    }
    const p = profileRef.current;
    const skip = new Set([...(p?.seen ?? []), ...inFeed.current]);
    const out = trend.current.titles.filter((t) => !skip.has(t)).slice(0, 10);
    trend.current.titles = trend.current.titles.filter((t) => !out.includes(t));
    return out;
  };
  const batch = async (lane: Lane): Promise<WikiCard[]> => {
    const p = profileRef.current ?? newProfile();
    if (lane === "trend") {
      const titles = await trending();
      if (!titles.length) return batch("explore");
      return toCards(await getJson(titlesUrl(titles)), "trend", undefined, filterFor(false));
    }
    const from = lane === "seed" ? pickSeed(p, random) : lane === "topic" ? pickTopic(p, random) : lane === "search" ? pickSearch(p, random) : null;
    if ((lane === "seed" || lane === "topic" || lane === "search") && !from) return batch("explore");
    return toCards(await getJson(laneUrl(lane, from, random)), lane, from ?? undefined, filterFor(false));
  };
  const forYou = async (want: number) => {
    for (let tries = 0; pool.current.length < want && tries < 3; tries++) {
      const p = profileRef.current ?? newProfile();
      const lanes = Array.from({ length: 4 }, () => pickLane(p, random));
      const got = (await Promise.all(lanes.map((l) => batch(l).catch(() => [])))).flat();
      pool.current.push(...got.filter((c) => !inFeed.current.has(c.title) && !pool.current.some((x) => x.title === c.title)).sort(() => random() - 0.5));
    }
    const { out, rest } = weave(pool.current, want);
    pool.current = rest.slice(0, 60);
    return out;
  };
  /** Something you liked or stayed on in this feed, to find more like when the asked-for results run out. */
  const lovedHere = () => {
    const p = profileRef.current;
    const here = [...inFeed.current];
    const good = (p?.seeds ?? []).filter((s) => s.w > 0 && here.includes(s.title)).sort((a, b) => b.at - a.at);
    return good.length ? good[Math.floor(random() * Math.min(3, good.length))].title : anchor.current;
  };
  const focused = async (m: Exclude<FeedMode, { kind: "you" }>): Promise<WikiCard[]> => {
    const n = page.current++;
    const f = filterFor(true);
    const get = async (url: string, lane: Lane, from?: string) => toCards(await getJson(url), lane, from, f);
    let primary: WikiCard[] = [], related: WikiCard[] = [];
    if (m.kind === "search") {
      primary = n < 6 ? await get(searchPageUrl(m.q, n), "search", m.q) : [];
      if (n === 0) { anchor.current = primary[0]?.title ?? null; onSearched(m.q, anchor.current); }
      const like = n < 3 ? anchor.current : lovedHere();
      if (like) related = await get(relatedUrl(like, n < 3 ? n : Math.floor(random() * 3)), "seed", like);
    } else if (m.kind === "focus") {
      if (n === 0) { anchor.current = m.title; primary = await get(titlesUrl([m.title]), "seed", m.title); }
      const more = await get(relatedUrl(m.title, Math.min(n, 8)), "seed", m.title);
      primary = [...primary, ...(n < 9 ? more : [])];
      if (n >= 2) { const like = lovedHere(); if (like && like !== m.title) related = await get(relatedUrl(like, Math.floor(random() * 3)), "seed", like); }
    } else {
      const subs = SUBTOPICS[m.id as keyof typeof SUBTOPICS] ?? [];
      const sub = subs[Math.floor(random() * subs.length)];
      const [a, b] = await Promise.all([get(laneUrl("topic", m.id, random), "topic", m.id), sub ? get(relatedUrl(sub, Math.floor(random() * 3)), "seed", sub) : Promise.resolve([])]);
      primary = a.sort(() => random() - 0.5); related = b.sort(() => random() - 0.5);
    }
    return interleave(primary, related).filter((c) => !inFeed.current.has(c.title));
  };
  const more = useCallback(async (want = 8) => {
    const g = gen.current;
    if (busy.current === g + 1) return;
    busy.current = g + 1;
    try {
      const m = modeRef.current;
      let out = m.kind === "you" ? await forYou(want) : await focused(m);
      // A search with nothing left to show keeps going with For you, so it never just stops.
      if (m.kind !== "you" && !out.length) out = await focused(m);
      if (m.kind !== "you" && !out.length) out = await forYou(want);
      if (g !== gen.current) return;
      for (const c of out) inFeed.current.add(c.title);
      if (out.length) setCards((cs) => [...cs, ...out]);
    } finally { if (busy.current === g + 1) busy.current = 0; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student]);
  const setMode = useCallback((m: FeedMode) => {
    gen.current++; busy.current = 0;
    modeRef.current = m; setModeState(m);
    setCards([]); pool.current = []; inFeed.current = new Set(); page.current = 0; anchor.current = null;
    // After this render, so a profile set in the same tap (picks, a search) is what the first batch uses.
    window.setTimeout(() => void more(8), 0);
  }, [more]);
  return { cards, more, mode, setMode };
}

/** Wikipedia's article HTML made safe and made to fit: no scripts or handlers, links marked for in-app opening. */
function cleanArticle(html: string): string {
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root")!;
  root.querySelectorAll("script,style,link,meta,iframe,object,embed,form,input,button,textarea,select,noscript,.mw-editsection,.navbox,.vertical-navbox,.metadata,.ambox,.mbox-small,.noprint,.mw-empty-elt,.sistersitebox,.portalbox,.mw-references-wrap .mw-cite-backlink,.hatnote.navigation-not-searchable").forEach((n) => n.remove());
  root.querySelectorAll("*").forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      const n = a.name.toLowerCase();
      if (n.startsWith("on") || n === "style" && /expression|url\(/i.test(a.value) || ((n === "href" || n === "src" || n === "srcset") && /^\s*(javascript|data|vbscript):/i.test(a.value))) el.removeAttribute(a.name);
    }
  });
  root.querySelectorAll("img").forEach((img) => {
    for (const at of ["src", "srcset"]) { const v = img.getAttribute(at); if (v) img.setAttribute(at, v.replace(/(^|,\s*)\/\//g, "$1https://")); }
    img.setAttribute("loading", "lazy");
    img.removeAttribute("width"); img.removeAttribute("height");
  });
  root.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    const wiki = href.match(/^(?:https?:\/\/en\.(?:m\.)?wikipedia\.org)?\/wiki\/([^#?]+)(#.*)?$/);
    if (href.includes("redlink=1")) { a.replaceWith(...Array.from(a.childNodes)); return; }
    if (wiki) {
      const title = decodeURIComponent(wiki[1]).replace(/_/g, " ");
      if (/^(File|Special|Help|Wikipedia|Template|Template talk|Talk|Category|Portal|User|Draft|MediaWiki|Module):/i.test(title)) { a.replaceWith(...Array.from(a.childNodes)); return; }
      a.setAttribute("data-wiki", title);
      a.setAttribute("href", pageUrl(title));
    } else if (href.startsWith("#")) {
      a.setAttribute("data-hash", href.slice(1));
    } else {
      a.setAttribute("href", href.startsWith("//") ? `https:${href}` : href);
      a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer");
    }
  });
  root.querySelectorAll("table").forEach((t) => { const w = doc.createElement("div"); w.className = "wv-table"; t.replaceWith(w); w.appendChild(t); });
  return root.innerHTML;
}

const ARTICLE_CSS = `
.wv-article{font-size:17px;line-height:1.7;color:#e7e5f4;word-wrap:break-word}
.wv-article p{margin:0 0 1em}
.wv-article h2{font-size:24px;font-weight:800;margin:1.6em 0 .5em;color:#fff;letter-spacing:-.01em;border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:.3em}
.wv-article h3{font-size:19px;font-weight:800;margin:1.3em 0 .4em;color:#fff}
.wv-article h4{font-size:17px;font-weight:700;margin:1.2em 0 .3em;color:#fff}
.wv-article a{color:#a5b4fc;text-decoration:none;border-bottom:1px solid rgba(165,180,252,.35)}
.wv-article a[data-wiki]{color:#c4b5fd}
.wv-article ul,.wv-article ol{margin:0 0 1em 1.3em;list-style:disc}
.wv-article ol{list-style:decimal}
.wv-article li{margin:.2em 0}
.wv-article img{max-width:100%;height:auto;border-radius:12px;display:inline-block}
.wv-article figure,.wv-article .thumb{margin:1em 0;max-width:100%}
.wv-article figcaption,.wv-article .thumbcaption{font-size:13px;color:#a8a3c4;margin-top:.4em}
.wv-article .wv-table{overflow-x:auto;margin:1em 0;-webkit-overflow-scrolling:touch}
.wv-article table{border-collapse:collapse;font-size:14px;min-width:60%}
.wv-article th,.wv-article td{border:1px solid rgba(255,255,255,.12);padding:6px 8px;vertical-align:top;text-align:left}
.wv-article th{background:rgba(255,255,255,.06)}
.wv-article .infobox{background:rgba(255,255,255,.04);border-radius:14px;width:100%}
.wv-article .infobox-image img{border-radius:10px}
.wv-article sup{font-size:.7em}
.wv-article sup.reference a{border:0;color:#8b87a8}
.wv-article blockquote{border-left:3px solid #8b5cf6;padding-left:1em;color:#d4d0ea;margin:1em 0}
.wv-article .reflist,.wv-article .references{font-size:13px;color:#b9b5d0}
.wv-article .mw-headline{scroll-margin-top:80px}
.wv-article .tright,.wv-article .floatright{float:none}
.wv-article math,.wv-article .mwe-math-element img{filter:invert(1) hue-rotate(180deg)}
`;

/** The whole article, links working: Wikipedia links open here (Back returns), others in a new tab. */
function Reader({ title, onClose, onLink, onOpen }: { title: string; onClose: () => void; onLink: (t: string) => void; onOpen: (t: string) => void }) {
  const [stack, setStack] = useState<string[]>([title]);
  const here = stack[stack.length - 1];
  const [html, setHtml] = useState<string | null>(null);
  const [shown, setShown] = useState(title);
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    setHtml(null); setFailed(false);
    void getJson(articleUrl(here)).then((j) => {
      if (!live) return;
      const text = j?.parse?.text;
      if (typeof text !== "string") { setFailed(true); return; }
      setShown(j.parse.title || here);
      setHtml(cleanArticle(text));
      box.current?.scrollTo({ top: 0 });
    });
    onOpen(here);
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); stack.length > 1 ? setStack((s) => s.slice(0, -1)) : onClose(); } }; window.addEventListener("keydown", k, true); return () => window.removeEventListener("keydown", k, true); }, [stack.length, onClose]);
  const click = (e: ReactMouseEvent) => {
    const a = (e.target as HTMLElement).closest("a") as HTMLAnchorElement | null;
    if (!a) return;
    const wiki = a.getAttribute("data-wiki"), hashId = a.getAttribute("data-hash");
    if (wiki) { e.preventDefault(); tap(); onLink(wiki); setStack((s) => [...s, wiki]); }
    else if (hashId) { e.preventDefault(); box.current?.querySelector(`[id="${CSS.escape(hashId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  };
  return <div className="fixed inset-0 z-[520] flex flex-col bg-[#0d0b1a] text-white" role="dialog" aria-modal="true" aria-label={shown}>
    <style>{ARTICLE_CSS}</style>
    <div className="flex items-center gap-2 border-b border-white/10 px-3 pb-2 pt-[max(.75rem,env(safe-area-inset-top))]">
      <button type="button" onClick={() => (stack.length > 1 ? setStack((s) => s.slice(0, -1)) : onClose())} aria-label={stack.length > 1 ? "Back" : "Close"} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">{stack.length > 1 ? <ArrowLeft size={20} /> : <X size={20} />}</button>
      <p className="min-w-0 flex-1 truncate text-[15px] font-bold">{shown}</p>
      {stack.length > 1 && <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10"><X size={20} /></button>}
      <a href={pageUrl(here)} target="_blank" rel="noopener noreferrer" aria-label="Open on Wikipedia" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10"><ExternalLink size={18} /></a>
    </div>
    <div ref={box} className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-2xl px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5">
        <h1 className="mb-4 text-[30px] font-black leading-tight tracking-[-.02em]">{shown}</h1>
        {failed ? <p className="text-white/70">Wikipedia didn't answer. Check your connection and try again.</p>
          : html === null ? <div className="flex items-center gap-2 py-10 text-white/60"><Loader2 className="animate-spin" size={18} />Loading the article…</div>
          : <div className="wv-article" onClick={click} dangerouslySetInnerHTML={{ __html: html }} />}
        {html && <p className="mt-10 border-t border-white/10 pt-4 text-xs leading-5 text-white/45">From Wikipedia, the free encyclopedia. Text is available under the <a className="underline" href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">Creative Commons Attribution-ShareAlike 4.0 License</a>. <a className="underline" href={pageUrl(here)} target="_blank" rel="noopener noreferrer">See the page and its history</a>.</p>}
      </div>
    </div>
  </div>;
}

/** Comments on an article, in a sheet from the bottom. */
function Comments({ title, auth, onClose, onPosted }: { title: string; auth?: Record<string, string>; onClose: () => void; onPosted: (n: number) => void }) {
  const [list, setList] = useState<Comment[] | null>(null);
  const [canPost, setCanPost] = useState(false);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void fetch(`${API_BASE}/api/wiki/comments?title=${encodeURIComponent(title)}`, { headers: auth }).then((r) => (r.ok ? r.json() : null)).then((b) => { setList(b?.comments ?? []); setCanPost(!!b?.canPost); }).catch(() => setList([]));
  }, [title, auth]);
  const post = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setNote("");
    const r = await fetch(`${API_BASE}/api/wiki/comments`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ title, text }) }).catch(() => null);
    const b = await r?.json().catch(() => null);
    setBusy(false);
    if (!r?.ok) { setNote(b?.message || "Couldn't post that. Try again."); return; }
    setList((l) => [b.comment, ...(l ?? [])]); setText(""); onPosted(1); tap("success");
  };
  const remove = async (c: Comment) => {
    const r = await fetch(`${API_BASE}/api/wiki/comments/${encodeURIComponent(c.id)}?title=${encodeURIComponent(title)}`, { method: "DELETE", headers: auth }).catch(() => null);
    if (r?.ok) { setList((l) => (l ?? []).filter((x) => x.id !== c.id)); onPosted(-1); }
  };
  const report = async (c: Comment) => {
    await fetch(`${API_BASE}/api/wiki/comments/${encodeURIComponent(c.id)}/report`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ title }) }).catch(() => null);
    setList((l) => (l ?? []).filter((x) => x.id !== c.id)); setNote("Reported. Thanks for keeping it kind.");
  };
  return <div className="fixed inset-0 z-[530] flex items-end justify-center bg-black/50" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Comments on ${title}`}>
    <div onClick={(e) => e.stopPropagation()} className="flex max-h-[75dvh] w-full max-w-xl flex-col rounded-t-[28px] bg-[#16142a] text-white shadow-2xl">
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <p className="text-[15px] font-extrabold">{list ? `${list.length} comment${list.length === 1 ? "" : "s"}` : "Comments"}</p>
        <button type="button" onClick={onClose} aria-label="Close comments" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><X size={18} /></button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-2">
        {list === null ? <p className="py-6 text-center text-sm text-white/50">Loading…</p>
          : !list.length ? <p className="py-8 text-center text-sm text-white/55">No comments yet. {canPost ? "Start the conversation." : ""}</p>
          : list.map((c) => <div key={c.id} className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-black">{c.author.slice(0, 1)}</div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white/55">{c.author} · {new Date(c.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-6">{c.text}</p>
            </div>
            {c.mine ? <button type="button" onClick={() => remove(c)} aria-label="Delete your comment" className="h-9 w-9 shrink-0 text-white/40 hover:text-white"><Trash2 size={16} className="mx-auto" /></button>
              : <button type="button" onClick={() => report(c)} aria-label="Report this comment" className="h-9 w-9 shrink-0 text-white/30 hover:text-white"><Flag size={15} className="mx-auto" /></button>}
          </div>)}
      </div>
      {note && <p className="px-5 pb-1 text-xs font-semibold text-amber-300">{note}</p>}
      {canPost ? <div className="flex items-center gap-2 border-t border-white/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void post(); }} maxLength={500} placeholder="Add a comment…" aria-label="Your comment"
          className="min-h-11 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-[15px] text-white outline-none placeholder:text-white/40 focus:bg-white/15" />
        <button type="button" onClick={post} disabled={!text.trim() || busy} aria-label="Post comment" className="flex h-11 w-11 items-center justify-center rounded-full bg-[#8b5cf6] disabled:opacity-40">{busy ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}</button>
      </div> : <p className="border-t border-white/10 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-center text-xs text-white/50">Student accounts can read comments.</p>}
    </div>
  </div>;
}

function RailButton({ label, count, on, onClick, children, testId }: { label: string; count?: string; on?: boolean; onClick: () => void; children: ReactNode; testId?: string }) {
  return <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={label} aria-pressed={on} data-testid={testId} className="flex flex-col items-center gap-1 text-white">
    <span className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-md transition active:scale-90 ${on ? "bg-white/25" : "bg-black/25"}`}>{children}</span>
    {count !== undefined && <span className="text-[12px] font-bold drop-shadow">{count}</span>}
  </button>;
}

function Card({ c, liked, saved, stats, active, onLike, onSave, onComment, onShare, onNope, onRead }: {
  c: WikiCard; liked: boolean; saved: boolean; stats?: Stats; active: boolean;
  onLike: () => void; onSave: () => void; onComment: () => void; onShare: () => void; onNope: () => void; onRead: () => void;
}) {
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);
  const tapped = () => {
    const t = Date.now();
    if (t - lastTap.current < 300) { if (!liked) onLike(); setBurst((b) => b + 1); lastTap.current = 0; }
    else lastTap.current = t;
  };
  const tall = !!c.image && (c.imageH ?? 0) > (c.imageW ?? 1) * 1.05;
  const paragraphs = c.extract.split("\n").filter(Boolean);
  return <div className="relative h-full w-full select-none" onClick={tapped} data-testid="wiki-card">
    {c.image ? <>
      <img src={c.image} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" loading={active ? "eager" : "lazy"} />
      <img src={c.image} alt={c.title} className={`absolute inset-x-0 top-0 mx-auto w-full ${tall ? "h-[68%] object-cover" : "mt-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] max-h-[48%] object-contain"}`} loading={active ? "eager" : "lazy"} draggable={false} />
    </> : <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENTS[hash(c.title) % GRADIENTS.length]}`}>
      <p aria-hidden className="absolute left-6 right-20 top-[18%] text-[64px] font-black leading-[0.95] tracking-[-0.04em] text-white/[0.09] [overflow-wrap:anywhere]">{c.title}</p>
    </div>}
    <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,.95) 0%, rgba(0,0,0,.75) 38%, rgba(0,0,0,.1) 65%, rgba(0,0,0,0) 100%)" }} />
    {burst > 0 && <Heart key={burst} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 animate-[wvpop_.8s_ease-out_forwards] fill-[#ff3b6b] text-[#ff3b6b] drop-shadow-2xl" />}
    <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] pl-5 pr-3">
      <div className="min-w-0 flex-1 pb-1">
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.08em] text-white/85 backdrop-blur">
          <Sparkles size={12} />{c.from === c.title ? "Your pick" : <>{laneLabel[c.lane]}{(c.lane === "seed" || c.lane === "search") && c.from ? ` · ${subLabel(c.from)}` : c.lane === "topic" && c.from ? ` · ${TOPICS.find((t) => t.id === c.from)?.label ?? ""}` : ""}</>}
        </p>
        <h2 className="text-[30px] font-black leading-[1.05] tracking-[-0.025em] text-white [overflow-wrap:anywhere] sm:text-[36px]">{c.title}</h2>
        {c.description && <p className="mt-1 text-[14px] font-semibold text-white/70">{c.description.charAt(0).toUpperCase() + c.description.slice(1)}</p>}
        <p className="mt-3 line-clamp-5 max-w-xl text-[15.5px] leading-[1.55] text-white/90">{paragraphs.join(" ")}</p>
        <button type="button" onClick={(e) => { e.stopPropagation(); onRead(); }} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-extrabold text-[#111] active:scale-95" data-testid="wiki-read">
          Read the whole article<ChevronUp size={16} className="rotate-90" />
        </button>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-4 pb-1">
        <RailButton label={liked ? "Unlike" : "Like"} on={liked} count={short((stats?.likes ?? 0))} onClick={onLike} testId="wiki-like"><Heart size={24} className={liked ? "fill-[#ff3b6b] text-[#ff3b6b]" : ""} /></RailButton>
        <RailButton label="Comments" count={short(stats?.comments ?? 0)} onClick={onComment}><MessageCircle size={24} /></RailButton>
        <RailButton label={saved ? "Remove from saved" : "Save"} on={saved} onClick={onSave} testId="wiki-save"><Bookmark size={23} className={saved ? "fill-[#fbbf24] text-[#fbbf24]" : ""} /></RailButton>
        <RailButton label="Share" count={short(stats?.shares ?? 0)} onClick={onShare}><Share2 size={22} /></RailButton>
        <RailButton label="Not for me" onClick={onNope}><EyeOff size={21} /></RailButton>
      </div>
    </div>
  </div>;
}

/** A search box with title suggestions as you type. Enter searches (a swipe feed of results); a suggestion opens
 *  that article's feed. */
function SearchBox({ onSearch, onPick, dark = false, autoFocus = false }: { onSearch: (q: string) => void; onPick: (title: string, typed: string) => void; dark?: boolean; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [hints, setHints] = useState<string[]>([]);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHints([]); return; }
    let live = true;
    const t = window.setTimeout(() => { void getJson(suggestUrl(term)).then((j) => { if (live) setHints(suggestions(j)); }); }, 220);
    return () => { live = false; window.clearTimeout(t); };
  }, [q]);
  const go = () => { const term = q.trim(); if (term) { setHints([]); onSearch(term); } };
  return <div className="relative">
    <form onSubmit={(e) => { e.preventDefault(); go(); }} className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${dark ? "text-white/50" : "text-slate-400"}`} size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus={autoFocus} enterKeyHint="search" placeholder="Search anything: WW2, sharks, LeBron…" aria-label="Search Wikipedia" data-testid="wiki-search"
          className={`min-h-12 w-full rounded-2xl pl-10 pr-3 text-[16px] font-medium outline-none ${dark ? "bg-white/10 text-white placeholder:text-white/40 focus:bg-white/15" : "border border-slate-200 bg-white text-slate-800 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"}`} />
      </div>
      <button type="submit" className={`min-h-12 rounded-2xl px-4 text-sm font-bold ${dark ? "bg-white text-[#111]" : "bg-[#16142a] text-white"}`}>Swipe</button>
    </form>
    {hints.length > 0 && <div className={`mt-2 overflow-hidden rounded-2xl ${dark ? "bg-white/10" : "border border-slate-100 bg-white shadow-sm"}`} data-testid="wiki-suggestions">
      <button type="button" onClick={go} className={`flex w-full items-center gap-2 px-4 py-3 text-left text-[15px] font-bold ${dark ? "text-white hover:bg-white/10" : "text-violet-700 hover:bg-violet-50"}`}><Search size={16} />Swipe through "{q.trim()}"</button>
      {hints.map((h) => <button key={h} type="button" onClick={() => { setHints([]); onPick(h, q.trim()); }} className={`block w-full truncate border-t px-4 py-3 text-left text-[15px] ${dark ? "border-white/5 text-white/85 hover:bg-white/10" : "border-slate-100 text-slate-700 hover:bg-slate-50"}`}>{h}</button>)}
    </div>}
  </div>;
}

export default function WikiFeed({ say, token, student = false, userId }: Props) {
  const { profile, setProfile, ref, auth } = useProfile(token, userId, student);
  const onSearched = useCallback((q: string, top: string | null) => setProfile((p) => learnSearch(p ?? newProfile(), q, top)), [setProfile]);
  const { cards, more, mode, setMode } = useFeed(ref, student, onSearched);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [reading, setReading] = useState<string | null>(null);
  const [commenting, setCommenting] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [picks, setPicks] = useState<string[]>([]);
  const [subPicks, setSubPicks] = useState<string[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [browse, setBrowse] = useState<string | null>(null);
  const [tab, setTab] = useState<"saved" | "liked">("saved");
  const feedRef = useRef<SwipeFeedHandle>(null);
  const shownAt = useRef<{ i: number; t: number }>({ i: -1, t: 0 });
  const acted = useRef(new Set<string>());

  const signal = useCallback((c: Pick<WikiCard, "title" | "lane" | "from">, s: Signal) => setProfile((p) => learn(p ?? newProfile(), c, s)), [setProfile]);

  // How long each card stayed is the strongest signal of all: learned when you move on (unless you already did
  // something with it, which says more).
  const leave = useCallback(() => {
    const { i, t } = shownAt.current;
    const c = cards[i];
    if (c && t && !acted.current.has(c.title)) signal(c, dwellSignal((Date.now() - t) / 1000));
  }, [cards, signal]);
  const onIndex = (i: number) => {
    if (reading || searching) return;
    leave();
    shownAt.current = { i, t: Date.now() };
    setIndex(i);
    const c = cards[i];
    if (c) setProfile((p) => markSeen(p ?? newProfile(), [c.title]));
  };
  useEffect(() => {
    if (!open) return;
    const titles = cards.map((c) => c.title).filter((t) => !stats[t]).slice(-30);
    if (!titles.length || !auth) return;
    void fetch(`${API_BASE}/api/wiki/stats?titles=${encodeURIComponent(titles.join("|"))}`, { headers: auth }).then((r) => (r.ok ? r.json() : null)).then((b) => b?.stats && setStats((s) => ({ ...s, ...b.stats }))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length, open, auth]);

  // The first card arrives after the loading screen: start its clock then.
  const firstTitle = cards[0]?.title;
  useEffect(() => {
    if (!open || !firstTitle || index !== 0) return;
    shownAt.current = { i: 0, t: Date.now() };
    setProfile((p) => markSeen(p ?? newProfile(), [firstTitle]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstTitle, open]);

  /** Opens the feed in a mode (For you, a search, a subject, a topic), from the top. */
  const openFeed = (m: FeedMode) => {
    leave();
    shownAt.current = { i: -1, t: 0 };
    setIndex(0); setSearching(false); setOpen(true);
    if (modeKey(m) !== modeKey(mode) || !cards.length) setMode(m);
  };
  const searchFor = (q: string) => openFeed({ kind: "search", q });
  const pickTitle = (title: string, typed: string) => { setProfile((p) => learnSearch(p ?? newProfile(), typed || title, title)); openFeed({ kind: "focus", title }); };
  const openSub = (title: string) => { setProfile((p) => learnSubtopic(p ?? newProfile(), title)); openFeed({ kind: "focus", title }); };
  const openTopic = (id: string) => { setProfile((p) => { const q = p ?? newProfile(); return { ...q, topics: { ...q.topics, [id]: Math.min(20, (q.topics[id] || 0) + 2) }, updatedAt: Date.now() }; }); openFeed({ kind: "topic", id }); };
  const close = () => { leave(); shownAt.current = { i: -1, t: 0 }; setOpen(false); };
  const react = (title: string, kind: "like" | "unlike" | "share") => {
    if (!auth) return;
    void fetch(`${API_BASE}/api/wiki/react`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ title, kind }) }).then((r) => (r.ok ? r.json() : null)).then((b) => b && setStats((s) => ({ ...s, [title]: b }))).catch(() => {});
  };
  const like = (c: WikiCard) => {
    const isLiked = profile?.liked.includes(c.title);
    acted.current.add(c.title);
    if (isLiked) { setProfile((p) => unlike(p ?? newProfile(), c.title)); react(c.title, "unlike"); }
    else { signal(c, "like"); react(c.title, "like"); tap(); }
    setStats((s) => { const x = s[c.title] ?? { likes: 0, comments: 0, shares: 0 }; return { ...s, [c.title]: { ...x, likes: Math.max(0, x.likes + (isLiked ? -1 : 1)) } }; });
  };
  const save = (c: WikiCard) => {
    const was = profile?.saved.some((s) => s.title === c.title);
    acted.current.add(c.title);
    setProfile((p) => { const q = toggleSave(p ?? newProfile(), c); return was ? q : learn(q, c, "save"); });
    tap(); say(was ? "Removed from saved." : "Saved. Find it under Saved.");
  };
  const share = async (c: Pick<WikiCard, "title" | "url" | "lane" | "from" | "description">) => {
    acted.current.add(c.title);
    const url = c.url || pageUrl(c.title);
    try {
      if (navigator.share) await navigator.share({ title: c.title, text: c.description ? `${c.title}: ${c.description}` : c.title, url });
      else { await navigator.clipboard.writeText(url); say("Link copied."); }
      signal(c, "share"); react(c.title, "share");
    } catch { /* closed the share sheet */ }
  };
  const nope = (c: WikiCard) => { acted.current.add(c.title); signal(c, "nope"); say("Got it, less like that."); feedRef.current?.next(); };

  const fromCard = (title: string): WikiCard => cards.find((c) => c.title === title) ?? { title, description: "", extract: "", url: pageUrl(title), lane: "explore" };
  const pages: ReactNode[] = cards.map((c, i) => <Card key={c.title} c={c} active={i === index} liked={!!profile?.liked.includes(c.title)} saved={!!profile?.saved.some((s) => s.title === c.title)} stats={stats[c.title]}
    onLike={() => like(c)} onSave={() => save(c)} onComment={() => setCommenting(c.title)} onShare={() => void share(c)} onNope={() => nope(c)} onRead={() => setReading(c.title)} />);
  if (open && !cards.length) pages.push(<div key="loading" className="flex h-full items-center justify-center gap-2 text-white/70"><Loader2 className="animate-spin" size={20} />{mode.kind === "search" ? `Finding "${mode.q}"…` : "Finding articles for you…"}</div>);

  const onboarding = !profile || (profile.n === 0 && !Object.keys(profile.topics).length && !profile.seeds.length);
  const list = tab === "saved" ? [...(profile?.saved ?? [])].reverse() : [...(profile?.liked ?? [])].reverse().map((t) => ({ title: t, description: "", image: undefined as string | undefined }));
  const recent = [...(profile?.searches ?? [])].sort((a, b) => b.at - a.at).slice(0, 8);
  const modeLabel = mode.kind === "you" ? "For you" : mode.kind === "search" ? mode.q : mode.kind === "focus" ? subLabel(mode.title) : TOPICS.find((t) => t.id === mode.id)?.label ?? "Topic";
  const chip = (on: boolean) => `min-h-10 rounded-full px-3.5 text-[14px] font-bold transition ${on ? "bg-white text-[#111]" : "bg-white/10 text-white hover:bg-white/15"}`;

  const top = <div className="flex max-w-[calc(100vw-5rem)] items-center gap-2">
    <button type="button" onClick={() => openFeed({ kind: "you" })} aria-pressed={mode.kind === "you"} className={`min-h-10 shrink-0 rounded-full px-3.5 text-[13px] font-extrabold backdrop-blur ${mode.kind === "you" ? "bg-white text-[#111]" : "bg-black/30 text-white"}`}>For you</button>
    {mode.kind !== "you" && <span className="inline-flex min-h-10 min-w-0 items-center gap-1 rounded-full bg-white py-0 pl-3.5 pr-1 text-[13px] font-extrabold text-[#111]">
      <span className="truncate">{modeLabel}</span>
      <button type="button" onClick={() => openFeed({ kind: "you" })} aria-label="Back to For you" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-black/5"><X size={15} /></button>
    </span>}
    <button type="button" onClick={() => setSearching(true)} aria-label="Search" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur" data-testid="wiki-feed-search"><Search size={18} /></button>
  </div>;

  return <div className="mx-auto w-full max-w-2xl py-6" data-testid="wiki-feed">
    <style>{"@keyframes wvpop{0%{opacity:0;transform:translate(-50%,-50%) scale(.4)}25%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}70%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-70%) scale(.9)}}"}</style>
    <div className="relative overflow-hidden rounded-[28px] bg-[#0d0b1a] p-6 text-white sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#7c3aed]/40 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-[#0ea5e9]/30 blur-3xl" />
      <p className="relative text-xs font-bold uppercase tracking-[0.16em] text-[#c4b5fd]">Arise Wiki</p>
      <h1 className="relative mt-2 text-[32px] font-black leading-tight tracking-[-0.02em]">All of Wikipedia. Endless. Made for you.</h1>
      {onboarding ? (step === 1 ? <div className="relative mt-5">
        <p className="text-sm font-bold text-white/85">What are you into? Pick a few.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {TOPICS.map((t) => { const on = picks.includes(t.id); return <button key={t.id} type="button" aria-pressed={on} onClick={() => setPicks((p) => (on ? p.filter((x) => x !== t.id) : [...p, t.id]))} className={chip(on)}>{t.label}</button>; })}
        </div>
        <button type="button" disabled={!picks.length} onClick={() => setStep(2)} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#c4b5fd] px-6 text-[15px] font-extrabold text-[#16141f] disabled:opacity-40" data-testid="wiki-next">
          {picks.length ? "Next" : "Pick at least one"}<ChevronUp size={16} className="rotate-90" />
        </button>
        <button type="button" onClick={() => { setProfile(newProfile([])); openFeed({ kind: "you" }); }} className="ml-3 mt-5 text-sm font-bold text-white/60 underline-offset-4 hover:underline">Surprise me</button>
      </div> : <div className="relative mt-5">
        <p className="text-sm font-bold text-white/85">Now get specific. What in these?</p>
        {picks.map((id) => <div key={id} className="mt-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[.14em] text-white/50">{TOPICS.find((t) => t.id === id)?.label}</p>
          <div className="mt-2 flex flex-wrap gap-2">{(SUBTOPICS[id as keyof typeof SUBTOPICS] ?? []).map((title) => { const on = subPicks.includes(title); return <button key={title} type="button" aria-pressed={on} onClick={() => setSubPicks((p) => (on ? p.filter((x) => x !== title) : [...p, title]))} className={chip(on)}>{subLabel(title)}</button>; })}</div>
        </div>)}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => { setProfile(newProfile(picks, Date.now(), subPicks)); openFeed({ kind: "you" }); }} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#c4b5fd] px-6 text-[15px] font-extrabold text-[#16141f]" data-testid="wiki-start">
            <Play className="h-4 w-4" fill="currentColor" />Start swiping
          </button>
          <button type="button" onClick={() => setStep(1)} className="text-sm font-bold text-white/60 underline-offset-4 hover:underline">Back</button>
        </div>
      </div>) : <div className="relative mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => openFeed({ kind: "you" })} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#c4b5fd] px-6 text-[15px] font-extrabold text-[#16141f]" data-testid="wiki-open"><Play className="h-4 w-4" fill="currentColor" />{cards.length && mode.kind === "you" ? "Keep swiping" : "Swipe For you"}</button>
        <p className="text-xs font-semibold text-white/50">{(profile?.seen.length ?? 0).toLocaleString()} read · {profile?.liked.length ?? 0} liked · {profile?.saved.length ?? 0} saved</p>
      </div>}
    </div>

    <div className="mt-5"><SearchBox onSearch={searchFor} onPick={pickTitle} /></div>
    {recent.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      {recent.map((r) => <button key={r.q} type="button" onClick={() => searchFor(r.q)} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-[13px] font-bold text-slate-600 hover:bg-slate-200"><Search size={13} />{r.q}</button>)}
    </div>}

    <div className="mt-7">
      <p className="text-[11px] font-black uppercase tracking-[.14em] text-slate-500">Browse</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {TOPICS.map((t) => <button key={t.id} type="button" aria-expanded={browse === t.id} onClick={() => setBrowse(browse === t.id ? null : t.id)}
          className={`min-h-10 rounded-full px-3.5 text-[14px] font-bold transition ${browse === t.id ? "bg-[#16142a] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{t.label}</button>)}
      </div>
      {browse && <div className="mt-3 rounded-3xl bg-[#16142a] p-4 text-white" data-testid="wiki-subtopics">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] font-extrabold">{TOPICS.find((t) => t.id === browse)?.label}</p>
          <button type="button" onClick={() => openTopic(browse)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-extrabold text-[#111]"><Play size={13} fill="currentColor" />Swipe all of it</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{(SUBTOPICS[browse as keyof typeof SUBTOPICS] ?? []).map((title) => <button key={title} type="button" onClick={() => openSub(title)} className="min-h-10 rounded-full bg-white/10 px-3.5 text-[14px] font-bold text-white hover:bg-white/20">{subLabel(title)}</button>)}</div>
      </div>}
    </div>

    <div className="mt-7">
      <div className="flex gap-2">
        {(["saved", "liked"] as const).map((t) => <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} className={`min-h-10 rounded-full px-4 text-sm font-bold ${tab === t ? "bg-[#16142a] text-white" : "bg-slate-100 text-slate-600"}`}>{t === "saved" ? `Saved (${profile?.saved.length ?? 0})` : `Liked (${profile?.liked.length ?? 0})`}</button>)}
        {!student && profile && <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-500"><input type="checkbox" checked={!profile.matureOff} onChange={(e) => setProfile((p) => ({ ...(p ?? newProfile()), matureOff: e.target.checked ? undefined : true, updatedAt: Date.now() }))} />Filter mature topics</label>}
      </div>
      {!list.length ? <p className="mt-4 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">{tab === "saved" ? "Tap the bookmark on any card to keep it here." : "Tap the heart (or double-tap a card) to like it."}</p>
        : <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {list.slice(0, 120).map((s) => <button key={s.title} type="button" onClick={() => openFeed({ kind: "focus", title: s.title })} className="group relative aspect-[3/4] overflow-hidden rounded-2xl text-left">
            {s.image ? <img src={s.image} alt="" className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105" loading="lazy" /> : <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENTS[hash(s.title) % GRADIENTS.length]}`} />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3"><p className="line-clamp-2 text-[15px] font-extrabold leading-tight text-white">{s.title}</p>{s.description && <p className="mt-0.5 line-clamp-1 text-xs text-white/70">{s.description}</p>}</div>
          </button>)}
        </div>}
    </div>

    {open && <SwipeFeed key={modeKey(mode)} ref={feedRef} pages={pages} label="Arise Wiki" onClose={close} onIndex={onIndex} onNearEnd={() => void more(8)} top={top} />}
    {open && searching && <div className="fixed inset-0 z-[540] bg-[#0d0b1a]/95 px-4 pt-[max(1rem,env(safe-area-inset-top))] text-white backdrop-blur" role="dialog" aria-modal="true" aria-label="Search">
      <div className="mx-auto max-w-xl">
        <div className="mb-3 flex items-center justify-between"><p className="text-[15px] font-extrabold">Search and swipe</p><button type="button" onClick={() => setSearching(false)} aria-label="Close search" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><X size={18} /></button></div>
        <SearchBox dark autoFocus onSearch={searchFor} onPick={pickTitle} />
        {recent.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{recent.map((r) => <button key={r.q} type="button" onClick={() => searchFor(r.q)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[13px] font-bold"><Search size={13} />{r.q}</button>)}</div>}
      </div>
    </div>}
    {reading && <Reader title={reading} onClose={() => setReading(null)}
      onOpen={(t) => { acted.current.add(t); signal(fromCard(t), t === reading ? "open" : "link"); }}
      onLink={() => { /* the opened page learns as "link" in onOpen */ }} />}
    {commenting && <Comments title={commenting} auth={auth} onClose={() => setCommenting(null)} onPosted={(n) => {
      if (n > 0) { acted.current.add(commenting); signal(fromCard(commenting), "comment"); }
      setStats((s) => { const x = s[commenting] ?? { likes: 0, comments: 0, shares: 0 }; return { ...s, [commenting]: { ...x, comments: Math.max(0, x.comments + n) } }; });
    }} />}
  </div>;
}
