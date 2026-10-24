// Arise To Duo Browser (a LifeHub App Store app): browse the web next to your lists, bookmark
// pages, and save any page as a task. Limited for now (see shared/browserApp.ts): a site that
// doesn't allow being shown inside another website opens in Safari instead. The full browser
// comes with the Arise To Duo iPhone app.
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Bookmark, Columns2, Maximize2, Minimize2, BookmarkCheck, ExternalLink, Globe, ListPlus, Loader2, RotateCw, Search, ShieldAlert, Sparkles, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { addressFor, hostOf, type BrowserMark } from "@shared/browserApp";
import { inputClass, plain, primary, type SectionProps } from "./ui";

type Page = { url: string; title: string; frameable: boolean; reason?: string; query?: string };
type Props = SectionProps & { onAddTask?: (title: string, url: string) => void };

const HISTORY_KEY = "arise_browser_history_v1"; // this device only
const NOTE_KEY = "arise_browser_note_closed";
const SIZE_KEY = "arise_browser_size";
/** How much of the screen the browser takes: its place in the page, the whole screen (or the whole
 *  pane on the split screen), or one whole side of the iPhone Duo's fold. */
type Size = "normal" | "full" | "side";
const duoBook = () => typeof document !== "undefined" && document.documentElement.dataset.duo === "book";
const readHistory = (): { url: string; title: string }[] => { try { const v = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); return Array.isArray(v) ? v.slice(0, 30) : []; } catch { return []; } };

function Letter({ url }: { url: string }) {
  const h = hostOf(url);
  return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-base font-black uppercase text-sky-700">{h.slice(0, 1)}</span>;
}

export default function Browser({ family, setFamily, makeId, say, onAddTask }: Props) {
  const { token } = useAuth();
  const [address, setAddress] = useState("");
  const [stack, setStack] = useState<Page[]>([]);
  const [at, setAt] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [round, setRound] = useState(0);
  const [history, setHistory] = useState(readHistory);
  const [noteOpen, setNoteOpen] = useState(() => { try { return localStorage.getItem(NOTE_KEY) !== "1"; } catch { return true; } });
  const [size, setSizeState] = useState<Size>(() => { try { const v = localStorage.getItem(SIZE_KEY); return v === "full" || v === "side" ? v : "normal"; } catch { return "normal"; } });
  const [book, setBook] = useState(duoBook);
  const setSize = (next: Size) => { setSizeState(next); try { localStorage.setItem(SIZE_KEY, next); } catch { /* not remembered */ } };
  useEffect(() => {
    const update = () => setBook(duoBook());
    window.addEventListener("resize", update);
    const keys = (e: KeyboardEvent) => { if (e.key === "Escape" && size !== "normal") setSize("normal"); };
    window.addEventListener("keydown", keys);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("keydown", keys); };
  }, [size]); // eslint-disable-line react-hooks/exhaustive-deps
  // "One side" only means something on the Duo opened flat; anywhere else it is the whole screen.
  const shownSize: Size = size === "side" && !book ? "full" : size;
  const page = at >= 0 ? stack[at] : null;
  const marks = family.browserMarks ?? [];
  const marked = page ? marks.find((m) => m.url === page.url) : undefined;

  const remember = (p: Page) => {
    const next = [{ url: p.url, title: p.title }, ...readHistory().filter((h) => h.url !== p.url)].slice(0, 30);
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* not remembered */ }
  };

  const open = async (typed: string) => {
    const where = addressFor(typed);
    if (!where) return;
    setLoading(true);
    let p: Page = { url: where.url, title: where.kind === "search" ? `Search: ${where.query}` : hostOf(where.url), frameable: false, query: where.kind === "search" ? where.query : undefined };
    try {
      const res = await fetch(`${API_BASE}/api/arise-todo/browser/check?url=${encodeURIComponent(where.url)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const body = await res.json().catch(() => null);
      if (res.ok && body) p = { ...p, url: body.url || p.url, title: where.kind === "search" ? p.title : body.title || p.title, frameable: !!body.frameable, reason: body.reason };
      else if (body?.message) say(body.message);
    } catch { p = { ...p, reason: "unreachable" }; }
    setLoading(false);
    setAddress(where.kind === "search" ? where.query : p.url);
    const next = [...stack.slice(0, at + 1), p];
    setStack(next); setAt(next.length - 1); setRound((r) => r + 1);
    remember(p);
  };

  const go = (e: FormEvent) => { e.preventDefault(); void open(address); };
  const move = (by: number) => { const i = at + by; if (i < -1 || i >= stack.length) return; setAt(i); setAddress(i >= 0 ? (stack[i].query ?? stack[i].url) : ""); };
  const toggleMark = () => {
    if (!page) return;
    if (marked) { setFamily((f) => ({ ...f, browserMarks: (f.browserMarks ?? []).filter((m) => m.id !== marked.id) })); say("Bookmark removed."); return; }
    const mark: BrowserMark = { id: makeId(), url: page.url, title: page.title || hostOf(page.url) };
    setFamily((f) => ({ ...f, browserMarks: [mark, ...(f.browserMarks ?? [])].slice(0, 300) }));
    say("Bookmarked.");
  };
  const saveTask = () => { if (page && onAddTask) onAddTask(page.title || hostOf(page.url), page.url); };
  const safari = (url: string) => window.open(url, "_blank", "noopener,noreferrer");
  const closeNote = () => { setNoteOpen(false); try { localStorage.setItem(NOTE_KEY, "1"); } catch { /* fine */ } };

  const iconBtn = "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-30";

  return (
    <div data-testid="life-browser" data-size={shownSize}
      className={shownSize === "normal" ? "flex min-h-[calc(100dvh-9rem)] flex-col gap-3"
        : `fixed bottom-0 right-0 top-0 z-[400] flex flex-col gap-2 bg-[#f6f7fc] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] ${shownSize === "full" ? "left-0" : "border-l border-slate-200"}`}
      style={shownSize === "side" ? { width: "calc(100vw - var(--duo-left, 50vw))" } : undefined}>
      {noteOpen && shownSize === "normal" && <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900" data-testid="browser-limited-note">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="min-w-0 flex-1"><b>Limited for now.</b> Google, YouTube, Facebook and many other big sites don't allow being opened inside another website, so those open in Safari. The full browser, with every site, comes with the <b>Arise To Duo iPhone app</b>, coming soon to the App Store.</p>
        <button type="button" onClick={closeNote} aria-label="Hide this note" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-sky-100"><X className="h-4 w-4" /></button>
      </div>}

      <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <button type="button" onClick={() => move(-1)} disabled={at < 0} aria-label="Back" className={iconBtn}><ArrowLeft className="h-5 w-5" /></button>
        <button type="button" onClick={() => move(1)} disabled={at >= stack.length - 1} aria-label="Forward" className={`${iconBtn} max-sm:hidden`}><ArrowRight className="h-5 w-5" /></button>
        <form onSubmit={go} className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={address} onChange={(e) => setAddress(e.target.value)} onFocus={(e) => e.target.select()} inputMode="url" enterKeyHint="go" autoCapitalize="off" autoCorrect="off" spellCheck={false}
            placeholder="Search or type a web address" aria-label="Search or type a web address" className={`${inputClass} pl-9`} data-testid="browser-address" />
        </form>
        {page && <button type="button" onClick={() => setRound((r) => r + 1)} aria-label="Reload" className={`${iconBtn} max-sm:hidden`}><RotateCw className="h-5 w-5" /></button>}
        {page && <button type="button" onClick={toggleMark} aria-label={marked ? "Remove bookmark" : "Bookmark this page"} aria-pressed={!!marked} className={iconBtn}>{marked ? <BookmarkCheck className="h-5 w-5 text-sky-600" /> : <Bookmark className="h-5 w-5" />}</button>}
        {page && onAddTask && <button type="button" onClick={saveTask} aria-label="Save this page as a task" title="Save as a task" className={iconBtn}><ListPlus className="h-5 w-5" /></button>}
        {page && <button type="button" onClick={() => safari(page.url)} aria-label="Open in Safari" title="Open in Safari" className={`${iconBtn} ${shownSize === "normal" ? "" : "max-sm:hidden"}`}><ExternalLink className="h-5 w-5" /></button>}
        {book && <button type="button" onClick={() => setSize(shownSize === "side" ? "normal" : "side")} aria-pressed={shownSize === "side"} aria-label={shownSize === "side" ? "Back to normal size" : "Fill one side of the screen"} title="One side" data-testid="browser-side"
          className={`${iconBtn} ${shownSize === "side" ? "bg-sky-100 text-sky-700" : ""}`}><Columns2 className="h-5 w-5" /></button>}
        <button type="button" onClick={() => setSize(shownSize === "full" ? "normal" : "full")} aria-pressed={shownSize === "full"} aria-label={shownSize === "full" ? "Exit full screen" : "Full screen"} title={shownSize === "full" ? "Exit full screen" : "Full screen"} data-testid="browser-full"
          className={`${iconBtn} ${shownSize === "full" ? "bg-sky-100 text-sky-700" : ""}`}>{shownSize === "full" ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}</button>
      </div>

      {loading && <div className="grid flex-1 place-items-center rounded-2xl border border-slate-200 bg-white p-10 text-slate-500"><Loader2 className="h-7 w-7 animate-spin" /></div>}

      {!loading && page && page.frameable && (
        <iframe key={`${page.url}#${round}`} src={page.url} title={page.title || "Web page"} data-testid="browser-frame"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
          referrerPolicy="strict-origin-when-cross-origin"
          className={`w-full flex-1 rounded-2xl border border-slate-200 bg-white ${shownSize === "normal" ? "min-h-[60dvh]" : "min-h-0"}`} />
      )}

      {!loading && page && !page.frameable && (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center" data-testid="browser-blocked">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-sky-50 text-sky-600">{page.reason === "address" || page.reason === "unreachable" ? <ShieldAlert className="h-7 w-7" /> : <Globe className="h-7 w-7" />}</span>
          <h2 className="mt-4 max-w-md break-words text-lg font-black text-slate-900">{page.query ? `Search for “${page.query}”` : page.title || hostOf(page.url)}</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{
            page.reason === "address" ? "That address can't be opened."
            : page.reason === "unreachable" ? "That page couldn't be reached. Check the address, or try it in Safari."
            : page.reason === "insecure" ? "This page isn't secure (http), so it can't open inside Arise To Duo."
            : page.query ? "Search results open in Safari for now."
            : `${hostOf(page.url)} doesn't allow being opened inside another website, so it opens in Safari for now.`}</p>
          {page.reason !== "address" && <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => safari(page.url)} className={primary}><ExternalLink className="h-4 w-4" /> Open in Safari</button>
            {!page.query && <button type="button" onClick={toggleMark} className={plain}>{marked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />} {marked ? "Bookmarked" : "Bookmark"}</button>}
            {!page.query && onAddTask && <button type="button" onClick={saveTask} className={plain}><ListPlus className="h-4 w-4" /> Save as a task</button>}
          </div>}
          {page.reason !== "address" && page.reason !== "unreachable" && <p className="mt-4 max-w-sm text-xs text-slate-500">In the Arise To Duo iPhone app, coming soon to the App Store, it opens right here.</p>}
        </div>
      )}

      {!loading && !page && (
        <div className={`space-y-5 ${shownSize === "normal" ? "" : "min-h-0 flex-1 overflow-y-auto px-1 pb-4"}`}>
          <section>
            <h2 className="mb-2 text-sm font-black text-slate-900">Bookmarks</h2>
            {marks.length ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {marks.map((m) => <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2.5">
                <button type="button" onClick={() => { setAddress(m.url); void open(m.url); }} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <Letter url={m.url} /><span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-800">{m.title}</span><span className="block truncate text-xs text-slate-500">{hostOf(m.url)}</span></span>
                </button>
                <button type="button" onClick={() => setFamily((f) => ({ ...f, browserMarks: (f.browserMarks ?? []).filter((x) => x.id !== m.id) }))} aria-label={`Remove ${m.title}`} className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>)}
            </div> : <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Open a page and tap <Bookmark className="inline h-4 w-4" /> to keep it here. Bookmarks sync to all your devices.</p>}
          </section>
          {history.length > 0 && <section>
            <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-black text-slate-900">Recent</h2>
              <button type="button" onClick={() => { setHistory([]); try { localStorage.removeItem(HISTORY_KEY); } catch { /* fine */ } }} className="min-h-10 px-2 text-xs font-semibold text-slate-500 underline">Clear</button></div>
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
              {history.slice(0, 10).map((h) => <li key={h.url}><button type="button" onClick={() => { setAddress(h.url); void open(h.url); }} className="flex min-h-12 w-full items-center gap-3 px-3 text-left">
                <Globe className="h-4 w-4 shrink-0 text-slate-400" /><span className="min-w-0 flex-1 truncate text-sm text-slate-700">{h.title || hostOf(h.url)}</span><span className="shrink-0 text-xs text-slate-400">{hostOf(h.url)}</span>
              </button></li>)}
            </ul>
            <p className="mt-1.5 text-xs text-slate-500">Recent pages stay on this device only.</p>
          </section>}
        </div>
      )}
    </div>
  );
}
