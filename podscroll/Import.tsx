// Pod+ "Bring your shows": everything someone follows in another podcast app, followed in Pod+ too.
// An OPML file (Overcast, Pocket Casts, Castro, Podcast Addict and most apps can export one), or show
// names and links pasted in (Apple Podcasts, Spotify and YouTube Music have no export). Each show is
// found in the directory one at a time (server/podcastImport.ts) and followed the moment it's found,
// so leaving halfway keeps what's done.
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, FileUp, Loader2, Search, Upload, X } from "lucide-react";
import { EARSHOT_LIMITS, type Earshot, type PodShow } from "@shared/earshot";
import { parseLines, parseOpml, type ImportItem } from "@shared/podImport";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
type Row = { item: ImportItem; state: "waiting" | "finding" | "added" | "had" | "missing"; show?: PodShow };

const APPS: { name: string; steps: string }[] = [
  { name: "Overcast", steps: "On a computer or your phone's browser, sign in at overcast.fm, open Account, then Export Your Data and download the OPML file." },
  { name: "Pocket Casts", steps: "Profile → Settings (gear) → Import & Export → export your podcasts as an OPML file." },
  { name: "Castro", steps: "Settings → User Data → Export Subscriptions, then Save to Files." },
  { name: "Podcast Addict", steps: "Settings → Backup / Restore → export your subscriptions as OPML." },
  { name: "Apple Podcasts", steps: "Apple doesn't let you export. Open Library → Shows, and type the names below (one per line), or tap a show's ⋯ → Share → Copy Link and paste the links." },
  { name: "Spotify", steps: "Spotify doesn't let you export. Type the names of your shows below, or on a show tap ⋯ → Share → Copy link and paste the links." },
  { name: "YouTube Music or another app", steps: "Look for Export or OPML in its settings. If there isn't one, type your shows' names below, one per line." },
];

const label = (i: ImportItem) => i.title || (i.appleId ? "Apple Podcasts link" : i.spotify ? "Spotify link" : i.feed ? i.feed.replace(/^https?:\/\//, "").slice(0, 60) : "");

export function ImportView({ api, es, update, say, onBack, onSearch, onFollowing }: { api: Api; es: Earshot; update: (fn: (e: Earshot) => Earshot) => void; say: (m: string) => void; onBack: () => void; onSearch: (q: string) => void; onFollowing: () => void }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const run = useRef(0);
  const following = useRef(new Set(es.follows.map((f) => f.id)));
  useEffect(() => { following.current = new Set(es.follows.map((f) => f.id)); }, [es.follows]);
  useEffect(() => () => { run.current++; }, []);

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 3e6) { say("That file is too big. Is it the OPML export?"); return; }
    const t = await f.text();
    const items = /<opml\b|<outline\b/i.test(t) ? parseOpml(t) : parseLines(t);
    if (!items.length) { setNote("No shows were found in that file. Make sure it's the OPML (or .xml) export from your podcast app."); return; }
    setNote(""); void start(items);
  };

  const start = async (items: ImportItem[]) => {
    const id = ++run.current;
    const list: Row[] = items.map((item) => ({ item, state: "waiting" }));
    setRows(list); setRunning(true);
    const set = (i: number, r: Partial<Row>) => { list[i] = { ...list[i], ...r }; setRows([...list]); };
    for (let i = 0; i < list.length; i++) {
      if (id !== run.current) return;
      set(i, { state: "finding" });
      let show: PodShow | null = null, done = false;
      for (let tries = 0; tries < 8 && !done; tries++) {
        try { show = (await api("/api/earshot/import/match", { method: "POST", body: list[i].item }))?.show ?? null; done = true; }
        catch (e: any) {
          if (id !== run.current) return;
          if (e?.status === 429 && !/trying again/i.test(e?.message || "")) { say(e.message); setRunning(false); return; }
          // The directory is busy, or the connection dropped: wait and ask again.
          await new Promise((r) => setTimeout(r, 2500 * (tries + 1)));
        }
      }
      if (id !== run.current) return;
      if (!show) { set(i, { state: "missing" }); continue; }
      const s = show;
      if (following.current.has(s.id)) { set(i, { state: "had", show: s }); continue; }
      following.current.add(s.id);
      update((e) => (e.follows.some((f) => f.id === s.id) ? e : { ...e, follows: [{ id: s.id, name: s.name, author: s.author, art: s.art, genre: s.genre, at: new Date().toISOString() }, ...e.follows].slice(0, EARSHOT_LIMITS.follows) }));
      set(i, { state: "added", show: s });
    }
    if (id === run.current) setRunning(false);
  };

  const fromText = () => {
    const items = parseLines(text);
    if (!items.length) { setNote("Type or paste at least one show name or link."); return; }
    setNote(""); void start(items);
  };

  const counts = rows ? { added: rows.filter((r) => r.state === "added").length, had: rows.filter((r) => r.state === "had").length, missing: rows.filter((r) => r.state === "missing").length, done: rows.filter((r) => r.state !== "waiting" && r.state !== "finding").length } : null;

  return <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 sm:px-6" data-testid="pod-import">
    <button onClick={onBack} className="mb-3 inline-flex h-9 items-center gap-1 rounded-full pl-1 pr-3 text-sm font-medium hover:bg-[#f2f2f2]"><ChevronLeft size={18} />Home</button>
    <h1 className="text-2xl font-bold tracking-tight">Bring your shows to Pod+</h1>
    <p className="mt-1 text-[15px] text-[#606060]">Follow everything you already listen to in another app, all at once.</p>

    {rows ? <section className="mt-5">
      <div className="rounded-2xl bg-[#0f0f0f] p-4 text-white">
        <p className="text-sm font-semibold">{running ? <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" />Finding your shows… {counts!.done} of {rows.length}</span> : "All done"}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-[#ff6a1f] transition-all" style={{ width: `${(counts!.done / Math.max(1, rows.length)) * 100}%` }} /></div>
        <p className="mt-2 text-xs text-white/70">{counts!.added} added{counts!.had ? ` · ${counts!.had} you already follow` : ""}{counts!.missing ? ` · ${counts!.missing} not found` : ""}{running ? ". Each one is followed as soon as it's found, so you can keep listening meanwhile." : ""}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!running && <button onClick={onFollowing} className="h-10 rounded-full bg-white px-4 text-sm font-semibold text-[#0f0f0f]">See your shows</button>}
          {running ? <button onClick={() => { run.current++; setRunning(false); }} className="h-10 rounded-full bg-white/15 px-4 text-sm font-semibold">Stop</button>
            : <button onClick={() => { setRows(null); setText(""); }} className="h-10 rounded-full bg-white/15 px-4 text-sm font-semibold">Import more</button>}
        </div>
      </div>
      <ul className="mt-4 divide-y divide-[#eee] rounded-2xl border border-[#e5e5e5] bg-white">
        {rows.map((r, i) => <li key={i} className="flex items-center gap-3 p-3">
          {r.show ? <img src={r.show.art} alt="" referrerPolicy="no-referrer" className="h-11 w-11 shrink-0 rounded-lg object-cover" /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#f2f2f2] text-[#909090]">{r.state === "finding" ? <Loader2 size={18} className="animate-spin" /> : <FileUp size={18} />}</span>}
          <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{r.show?.name || label(r.item)}</span>
            <span className={`block truncate text-xs ${r.state === "missing" ? "text-[#cc0000]" : "text-[#606060]"}`}>{r.state === "added" ? `Following · ${r.show?.author || ""}` : r.state === "had" ? "Already following" : r.state === "missing" ? "Not in the podcast directory (it may be on one app only)" : r.state === "finding" ? "Finding…" : "Waiting"}</span></span>
          {r.state === "added" || r.state === "had" ? <Check size={18} className="shrink-0 text-[#0a7d32]" /> : r.state === "missing" && r.item.title ? <button onClick={() => onSearch(r.item.title!)} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-[#f2f2f2] px-3 text-xs font-semibold"><Search size={14} />Search</button> : r.state === "missing" ? <X size={18} className="shrink-0 text-[#cc0000]" /> : null}
        </li>)}
      </ul>
    </section> : <>
      <section className="mt-5 rounded-2xl border border-[#e5e5e5] bg-white p-4">
        <h2 className="text-base font-bold">1. Get your list from your old app</h2>
        <ul className="mt-2 divide-y divide-[#eee]">
          {APPS.map((a) => <li key={a.name}>
            <button onClick={() => setOpen(open === a.name ? null : a.name)} aria-expanded={open === a.name} className="flex min-h-11 w-full items-center justify-between text-left text-[15px] font-medium">{a.name}<ChevronDown size={18} className={`transition ${open === a.name ? "rotate-180" : ""}`} /></button>
            {open === a.name && <p className="pb-3 text-sm leading-relaxed text-[#3f3f3f]">{a.steps}</p>}
          </li>)}
        </ul>
      </section>
      <section className="mt-4 rounded-2xl border border-[#e5e5e5] bg-white p-4">
        <h2 className="text-base font-bold">2. Bring it here</h2>
        <button onClick={() => file.current?.click()} data-testid="pod-import-file" className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0f0f0f] text-[15px] font-semibold text-white"><Upload size={18} />Choose the OPML file</button>
        <input ref={file} type="file" accept=".opml,.xml,.txt,text/xml,application/xml,text/x-opml,text/plain" className="hidden" onChange={(e) => { void readFile(e.target.files?.[0]); e.target.value = ""; }} />
        <p className="my-3 text-center text-xs font-semibold uppercase tracking-wider text-[#909090]">or</p>
        <label htmlFor="pod-import-text" className="text-sm font-medium">Type or paste your shows, one per line (names or links)</label>
        <textarea id="pod-import-text" data-testid="pod-import-text" value={text} onChange={(e) => setText(e.target.value.slice(0, 60000))} rows={6} placeholder={"The Daily\nhttps://podcasts.apple.com/us/podcast/...\nhttps://open.spotify.com/show/...\nRadiolab"}
          className="mt-2 w-full resize-y rounded-xl bg-[#f6f6f6] p-3 text-[15px] leading-relaxed outline-none focus:ring-2 focus:ring-[#0f0f0f]/20" />
        <button onClick={fromText} data-testid="pod-import-go" className="mt-2 h-12 w-full rounded-full bg-[#ff6a1f] text-[15px] font-semibold text-white">Find and follow my shows</button>
        {note && <p role="alert" className="mt-3 rounded-xl bg-[#fff6e5] px-3 py-2 text-sm text-[#7a4b00]">{note}</p>}
        <p className="mt-3 text-xs text-[#606060]">Only your list of shows is used, to find them in the podcast directory. Nothing is posted, and nothing changes in your other app.</p>
      </section>
    </>}
  </div>;
}
