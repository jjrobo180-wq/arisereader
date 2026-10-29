// Writing a post: words (500 characters, with @mention suggestions as you type), up to 4 photos or
// one video (uploaded with a progress bar), a poll, an episode, or a quote of someone's post.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BarChart2, Headphones, Image as ImageIcon, Loader2, Plus, Search, X } from "lucide-react";
import { durationWords, hiRes } from "@shared/earshot";
import { Avatar, Layer, NameLine, NeedSignIn, shortAgo, uploadMedia, type Media, type Person, type Post, type PostEpisode, type SCtx } from "./kit";
import { Body } from "./PostCard";

type Pending = { key: string; file: File; preview: string; video: boolean; pct: number; done?: Media; err?: string };
const MAX = 500;

export function Composer({ ctx, quote, onClose, onPosted }: { ctx: SCtx; quote?: Post; onClose: () => void; onPosted: (p: Post) => void }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [poll, setPoll] = useState<{ options: string[]; days: number } | null>(null);
  const [episode, setEpisode] = useState<PostEpisode | null>(null);
  const [findEp, setFindEp] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => { box.current?.focus(); }, []);
  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  // @mention suggestions for the word being typed.
  const [caret, setCaret] = useState(0);
  const typing = useMemo(() => { const m = /(^|\s)@([a-zA-Z0-9_]{1,20})$/.exec(text.slice(0, caret)); return m ? m[2] : null; }, [text, caret]);
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => {
    if (!typing) { setPeople([]); return; }
    const t = setTimeout(() => { ctx.api(`/api/earshot/social/people?q=${encodeURIComponent(typing)}`).then((b) => setPeople((b.people || []).slice(0, 5))).catch(() => setPeople([])); }, 200);
    return () => clearTimeout(t);
  }, [typing, ctx]);
  const pickPerson = (h: string) => {
    const before = text.slice(0, caret).replace(/@([a-zA-Z0-9_]{1,20})$/, `@${h} `);
    const next = before + text.slice(caret);
    setText(next.slice(0, MAX)); setPeople([]);
    setTimeout(() => { box.current?.focus(); box.current?.setSelectionRange(before.length, before.length); setCaret(before.length); }, 0);
  };

  const hasVideo = files.some((f) => f.video);
  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list);
    const video = picked.find((f) => f.type.startsWith("video/") || /\.(mov|mp4|webm)$/i.test(f.name));
    const take = video ? [video] : picked.filter((f) => f.type.startsWith("image/")).slice(0, 4 - files.filter((f) => !f.video).length);
    if (video && files.length) { ctx.say("A post can have one video, or up to 4 photos."); return; }
    if (!take.length) { ctx.say(hasVideo ? "A post can have one video, or up to 4 photos." : "You can add up to 4 photos."); return; }
    const added: Pending[] = take.map((f) => ({ key: `${Date.now()}${Math.random()}`, file: f, preview: URL.createObjectURL(f), video: f === video, pct: 0 }));
    setFiles((l) => [...l, ...added]);
    for (const a of added) await send(a);
  };
  const send = async (a: Pending) => {
    try {
      const done = await uploadMedia(ctx.api, a.file, (pct) => setFiles((l) => l.map((x) => (x.key === a.key ? { ...x, pct } : x))));
      setFiles((l) => l.map((x) => (x.key === a.key ? { ...x, pct: 1, done } : x)));
    } catch (e: any) {
      if (e instanceof NeedSignIn) {
        setFiles((l) => l.filter((x) => x.key !== a.key));
        if (await ctx.signIn()) { setFiles((l) => [...l, a]); await send({ ...a, pct: 0 }); }
        return;
      }
      setFiles((l) => l.map((x) => (x.key === a.key ? { ...x, err: e?.message || "That didn't upload." } : x)));
    }
  };
  const uploading = files.some((f) => !f.done && !f.err);
  const pollOk = !poll || (poll.options.filter((o) => o.trim()).length >= 2);
  const can = !busy && !uploading && pollOk && text.length <= MAX && (text.trim() || files.some((f) => f.done) || !!episode || !!quote || !!poll);

  const post = () => {
    if (!can) return;
    setBusy(true);
    const body: any = quote ? { kind: "repost", repostOf: quote.id, caption: text.trim() }
      : episode ? { kind: "share", episode, caption: text.trim() }
      : { kind: "text", caption: text.trim(), media: files.filter((f) => f.done).map((f) => f.done), ...(poll ? { poll: { options: poll.options.filter((o) => o.trim()), days: poll.days } } : {}) };
    if (quote && !text.trim()) { ctx.api(`/api/earshot/social/posts/${quote.id}/repost`, { method: "POST", body: { on: true } }).then(() => { ctx.say("Reposted."); onClose(); }).catch((e) => ctx.say(e.message)).finally(() => setBusy(false)); return; }
    ctx.api("/api/earshot/social/posts", { method: "POST", body }).then((b) => { if (b.post) onPosted(b.post); ctx.say("Posted."); onClose(); })
      .catch((e) => ctx.say(e?.needProfile ? "Make your profile first." : e.message)).finally(() => setBusy(false));
  };
  const left = MAX - text.length;

  return <Layer><div className="fade absolute inset-0 z-[75] flex items-stretch justify-center sm:items-start sm:p-8" style={{ background: "var(--overlay)" }} onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={quote ? "Quote post" : "New post"} onClick={(e) => e.stopPropagation()} className="rise bg flex w-full flex-col sm:max-h-[86%] sm:max-w-[600px] sm:rounded-2xl sm:shadow-2xl">
      <div className="flex flex-none items-center justify-between px-3 pb-2 pt-[max(.6rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="hov min-h-9 rounded-full px-3 text-[16px]">Cancel</button>
        <button type="button" onClick={post} disabled={!can} className="bg-accent inline-flex min-h-9 items-center gap-1.5 rounded-full px-5 text-[15px] font-bold disabled:opacity-40">{busy && <Loader2 size={15} className="animate-spin" />}{quote && !text.trim() ? "Repost" : "Post"}</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex gap-3">
          {ctx.me && <Avatar p={ctx.me} size={40} />}
          <div className="relative min-w-0 flex-1">
            <textarea ref={box} value={text} onChange={(e) => { setText(e.target.value.slice(0, MAX + 20)); setCaret(e.target.selectionStart ?? 0); }} onKeyUp={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)} onClick={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
              rows={Math.min(10, Math.max(3, text.split("\n").length + Math.floor(text.length / 60)))} placeholder={quote ? "Add a comment" : poll ? "Ask a question" : "What's happening?"} aria-label="Post text"
              className="w-full resize-none bg-transparent pt-1.5 text-[20px] leading-snug outline-none" />
            {people.length > 0 && <ul className="surface absolute left-0 right-0 top-full z-10 overflow-hidden rounded-2xl border line shadow-xl">{people.map((p) => <li key={p.handle}><button type="button" onClick={() => pickPerson(p.handle)} className="hov flex w-full items-center gap-3 px-3 py-2 text-left"><Avatar p={p} size={36} /><span className="min-w-0"><NameLine p={p} small /><span className="muted block truncate text-[13px]">@{p.handle}</span></span></button></li>)}</ul>}
            {files.length > 0 && <div className={`mt-2 grid gap-2 ${files.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>{files.map((f) => <div key={f.key} className="relative overflow-hidden rounded-2xl border line elev" style={{ aspectRatio: files.length === 1 ? "auto" : "1" }}>
              {f.video ? <video src={f.preview} muted playsInline className="max-h-[360px] w-full object-cover" /> : <img src={f.preview} alt="" className={`w-full object-cover ${files.length === 1 ? "max-h-[420px]" : "h-full"}`} />}
              <button type="button" onClick={() => setFiles((l) => l.filter((x) => x.key !== f.key))} aria-label="Remove" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white"><X size={16} /></button>
              {!f.done && !f.err && <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/40"><div className="h-full bg-[color:var(--accent)] transition-[width]" style={{ width: `${Math.round(f.pct * 100)}%` }} /></div>}
              {!f.done && !f.err && <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[12px] font-bold text-white">{Math.round(f.pct * 100)}%</span>}
              {f.err && <div className="absolute inset-0 grid place-items-center bg-black/70 p-3 text-center text-[13px] font-semibold text-white">{f.err}<button type="button" onClick={() => { setFiles((l) => l.map((x) => (x.key === f.key ? { ...x, err: undefined, pct: 0 } : x))); void send({ ...f, err: undefined, pct: 0 }); }} className="mt-2 rounded-full bg-white px-3 py-1 text-[13px] font-bold text-black">Try again</button></div>}
            </div>)}</div>}
            {poll && <div className="mt-3 rounded-2xl border line p-3">
              {poll.options.map((o, i) => <div key={i} className="mb-2 flex items-center gap-2">
                <input value={o} onChange={(e) => setPoll({ ...poll, options: poll.options.map((x, j) => (j === i ? e.target.value.slice(0, 40) : x)) })} placeholder={`Choice ${i + 1}${i > 1 ? " (optional)" : ""}`} aria-label={`Choice ${i + 1}`} className="min-h-11 flex-1 rounded-lg border line bg-transparent px-3 text-[15px] outline-none focus:border-[color:var(--link)]" />
                {i > 1 && <button type="button" onClick={() => setPoll({ ...poll, options: poll.options.filter((_, j) => j !== i) })} aria-label="Remove choice" className="hov grid h-9 w-9 place-items-center rounded-full"><X size={16} /></button>}
              </div>)}
              {poll.options.length < 4 && <button type="button" onClick={() => setPoll({ ...poll, options: [...poll.options, ""] })} className="link mb-2 inline-flex items-center gap-1 text-[14px] font-bold"><Plus size={15} />Add a choice</button>}
              <div className="flex items-center justify-between border-t line pt-2.5">
                <label className="muted flex items-center gap-2 text-[14px]">Poll length
                  <select value={poll.days} onChange={(e) => setPoll({ ...poll, days: Number(e.target.value) })} className="surface rounded-lg border line px-2 py-1 text-[14px] fg">{[1, 2, 3, 5, 7].map((d) => <option key={d} value={d}>{d} {d === 1 ? "day" : "days"}</option>)}</select>
                </label>
                <button type="button" onClick={() => setPoll(null)} className="text-[14px] font-bold text-[#f4212e]">Remove poll</button>
              </div>
            </div>}
            {episode && <div className="relative mt-3 grid grid-cols-[60px_1fr] items-center gap-3 rounded-2xl border line p-2">
              <img src={hiRes(episode.art, 160)} alt="" referrerPolicy="no-referrer" className="h-[60px] w-[60px] rounded-xl object-cover" />
              <span className="min-w-0 pr-8"><b className="line-clamp-2 block text-[14px]">{episode.title}</b><span className="muted block truncate text-[13px]">{episode.show}</span></span>
              <button type="button" onClick={() => setEpisode(null)} aria-label="Remove episode" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full elev2"><X size={15} /></button>
            </div>}
            {quote && <div className="mt-3 rounded-2xl border line p-3"><span className="flex items-center gap-1.5"><Avatar p={quote.author} size={20} /><NameLine p={quote.author} small /><span className="muted text-[14px]">@{quote.author.handle} · {shortAgo(quote.at)}</span></span><Body p={quote} ctx={ctx} compact /></div>}
          </div>
        </div>
      </div>
      <div className="flex flex-none items-center gap-1 border-t line px-3 py-2 pb-[max(.5rem,env(safe-area-inset-bottom))]">
        <input ref={picker} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
        <Tool label="Photo or video" disabled={!!quote || !!episode || !!poll || hasVideo || files.length >= 4} onClick={() => picker.current?.click()}><ImageIcon size={20} /></Tool>
        <Tool label="Poll" disabled={!!quote || !!episode || files.length > 0 || !!poll} onClick={() => setPoll({ options: ["", ""], days: 1 })}><BarChart2 size={20} /></Tool>
        <Tool label="Episode" disabled={!!quote || files.length > 0 || !!poll} onClick={() => setFindEp(true)}><Headphones size={20} /></Tool>
        <span className="flex-1" />
        {text.length > 0 && <span className={`text-[13px] tabular-nums ${left < 0 ? "font-bold text-[#f4212e]" : left < 40 ? "text-[#ffad1f]" : "muted"}`}>{left}</span>}
        {text.length > 0 && <Ring pct={text.length / MAX} />}
      </div>
    </div>
    {findEp && <EpisodeFinder ctx={ctx} onPick={(e) => { setEpisode(e); setFindEp(false); }} onClose={() => setFindEp(false)} />}
  </div></Layer>;
}

const Tool = ({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) =>
  <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="accent grid h-10 w-10 place-items-center rounded-full transition hover:bg-[color:var(--hover)] disabled:opacity-35">{children}</button>;
function Ring({ pct }: { pct: number }) {
  const r = 9, c = 2 * Math.PI * r, over = pct > 1;
  return <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" className="-rotate-90"><circle cx="12" cy="12" r={r} fill="none" stroke="var(--line)" strokeWidth="2.5" /><circle cx="12" cy="12" r={r} fill="none" stroke={over ? "#f4212e" : pct > 0.92 ? "#ffad1f" : "var(--accent)"} strokeWidth="2.5" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, pct))} strokeLinecap="round" /></svg>;
}

/** Search for an episode to post (or put in a story). */
export function EpisodeFinder({ ctx, onPick, onClose, z = 80 }: { ctx: SCtx; onPick: (e: PostEpisode) => void; onClose: () => void; z?: number }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<PostEpisode[] | null>(null);
  useEffect(() => {
    const t = q.trim(); if (t.length < 2) { setRes(null); return; }
    let live = true;
    const h = setTimeout(() => ctx.api(`/api/earshot/search?q=${encodeURIComponent(t)}`).then((b) => { if (live) setRes((b.episodes || []).filter((e: any) => /^https:\/\//.test(e.audio || "")).map((e: any) => ({ id: e.id, showId: e.showId, show: e.show, title: e.title, art: e.art, audio: e.audio, secs: e.secs, date: e.date }))); }).catch(() => { if (live) setRes([]); }), 350);
    return () => { live = false; clearTimeout(h); };
  }, [q, ctx]);
  return <Layer><div className="fade fg absolute inset-0 flex items-end justify-center sm:items-center sm:p-6" style={{ background: "var(--overlay)", zIndex: z }} onClick={onClose}>
    <div className="rise surface flex h-[80%] w-full flex-col overflow-hidden rounded-t-3xl sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add an episode">
      <div className="flex items-center gap-2 border-b line p-3">
        <button type="button" onClick={onClose} aria-label="Close" className="hov grid h-9 w-9 place-items-center rounded-full"><X size={20} /></button>
        <div className="elev flex min-h-10 flex-1 items-center gap-2 rounded-full px-3"><Search size={17} className="muted" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search episodes and shows" aria-label="Search episodes" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" /></div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!res && <p className="muted px-6 py-10 text-center text-[15px]">Find the episode you want to talk about.</p>}
        {res && !res.length && <p className="muted px-6 py-10 text-center text-[15px]">Nothing found. Try other words.</p>}
        {res?.slice(0, 25).map((e) => <button key={e.id} type="button" onClick={() => onPick(e)} className="hov flex w-full items-center gap-3 px-4 py-2.5 text-left">
          <img src={hiRes(e.art, 120)} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-12 w-12 flex-none rounded-lg object-cover elev2" />
          <span className="min-w-0"><b className="line-clamp-2 block text-[14px] leading-snug">{e.title}</b><span className="muted block truncate text-[13px]">{e.show}{e.secs ? ` · ${durationWords(e.secs)}` : ""}</span></span>
        </button>)}
      </div>
    </div>
  </div></Layer>;
}
