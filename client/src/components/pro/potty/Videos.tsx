// Videos: real YouTube videos for kids (songs, shows, step-by-step video modeling) and for parents
// (pediatricians, children's hospitals, autism and Down syndrome specialists), a player, your own
// YouTube links, and the video that plays during the sit timer.
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Heart, Play, Plus, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { uid } from "../kit";
import { VIDEOS, VIDEO_SEARCHES, VIDEO_TOPICS, youtubeId, ytEmbed, ytSearch, ytThumb, type Video } from "@shared/pro/potty";
import { usePotty } from "./ctx";
import { Btn2, C, Chip, Empty2, Label, Note, Panel, Section, field, fieldStyle } from "./theme";

type V = Video | { id: string; yt: string; title: string; channel: string; audience: "kids" | "parents"; topic?: undefined; about?: string; playlist?: undefined };
const thumb = (v: V) => ytThumb(v.playlist ? "QeDuo3ZjVl4" : v.yt);

function Player({ list, start, onClose }: { list: V[]; start: number; onClose: () => void }) {
  const { data, set } = usePotty();
  const [i, setI] = useState(start); const v = list[i];
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const isSit = data.sitVideo === v.yt;
  return createPortal(<div className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/85 p-3" role="dialog" aria-modal="true" aria-label={v.title}>
    <div className="w-full max-w-4xl">
      <div className="mb-2 flex items-center justify-between gap-3 text-white"><div className="min-w-0"><p className="font-extrabold leading-snug">{v.title}</p><p className="text-xs text-white/60">{v.channel}</p></div><button type="button" onClick={onClose} aria-label="Close video" className="rounded-full bg-white/15 p-2 hover:bg-white/25"><X size={20} /></button></div>
      <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black"><iframe key={v.yt} title={v.title} src={ytEmbed(v, true)} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Btn2 kind="plain" disabled={i === 0} onClick={() => setI(i - 1)} title="Previous video"><ChevronLeft size={16} /></Btn2><Btn2 kind="plain" disabled={i >= list.length - 1} onClick={() => setI(i + 1)} title="Next video"><ChevronRight size={16} /></Btn2>
        {v.audience === "kids" && !v.playlist && <Btn2 kind={isSit ? "duck" : "plain"} onClick={() => set((d) => ({ ...d, sitVideo: isSit ? "" : v.yt }))}>{isSit ? "✓ Plays during sits" : "Play this during sits"}</Btn2>}
        <a href={v.playlist ? `https://www.youtube.com/playlist?list=${v.yt}` : `https://www.youtube.com/watch?v=${v.yt}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-white/80 hover:text-white"><ExternalLink size={15} />Open on YouTube</a>
      </div>
      {v.about && <p className="mt-2 text-sm text-white/70">{v.about}</p>}
    </div>
  </div>, document.body);
}

function Card({ v, onPlay, fav, onFav, sit }: { v: V; onPlay: () => void; fav: boolean; onFav: () => void; sit: boolean }) {
  return <div className="group overflow-hidden rounded-[22px] bg-white" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}` }}>
    <button type="button" onClick={onPlay} className="relative block w-full" aria-label={`Play ${v.title}`}>
      <img src={thumb(v)} alt="" loading="lazy" className="aspect-video w-full object-cover" />
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/25"><span className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition group-hover:scale-110" style={{ background: "#FF0033" }}><Play size={22} fill="currentColor" /></span></span>
      {v.playlist && <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white">Series</span>}
      {sit && <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-extrabold" style={{ background: C.duck, color: C.ink }}>Sit-time video</span>}
    </button>
    <div className="flex items-start gap-2 p-3"><div className="min-w-0 flex-1"><p className="ph text-[14px] font-extrabold leading-snug">{v.title}</p><p className="mt-0.5 text-xs leading-snug" style={{ color: C.muted }}>{v.channel}</p>{v.about && <p className="mt-1 leading-snug text-[12.5px]" style={{ color: C.inkSoft }}>{v.about}</p>}</div>
      <button type="button" onClick={onFav} aria-pressed={fav} aria-label={fav ? "Remove from favourites" : "Add to favourites"} className="p-1" style={{ color: fav ? "#E5484D" : C.muted }}><Heart size={18} fill={fav ? "currentColor" : "none"} /></button></div>
  </div>;
}

export default function Videos() {
  const { data, set, sub, kid } = usePotty();
  const subId = sub.startsWith("v:") ? sub.slice(2) : "";
  const subV = VIDEOS.find((v) => v.id === subId);
  const [tab, setTab] = useState<"kids" | "parents" | "mine">(subV?.audience === "parents" ? "parents" : "kids");
  const [topic, setTopic] = useState<string>("");
  const [play, setPlay] = useState<{ list: V[]; i: number } | null>(null);
  const [link, setLink] = useState(""); const [title, setTitle] = useState(""); const [aud, setAud] = useState<"kids" | "parents">("kids");
  const mine: V[] = data.myVideos.map((m) => ({ id: m.id, yt: m.yt, title: m.title, channel: "Added by you", audience: m.audience }));
  useEffect(() => { if (subV) { const list = VIDEOS.filter((v) => v.audience === subV.audience); setPlay({ list, i: list.findIndex((v) => v.id === subV.id) }); } }, [subId]); // eslint-disable-line react-hooks/exhaustive-deps
  const fav = (v: V) => data.favVideos.includes(v.yt);
  const toggleFav = (v: V) => set((d) => ({ ...d, favVideos: fav(v) ? d.favVideos.filter((x) => x !== v.yt) : [...d.favVideos, v.yt] }));
  const kids = VIDEOS.filter((v) => v.audience === "kids"); const parents = VIDEOS.filter((v) => v.audience === "parents" && (!topic || v.topic === topic));
  const featuredNeeds = kid.needs.length ? VIDEOS.filter((v) => v.audience === "parents" && ((kid.needs.includes("autism") && v.topic === "autism") || (kid.needs.includes("down") && v.topic === "down") || v.topic === "complex")) : [];
  const grid = (list: V[]) => <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((v, i) => <Card key={v.id} v={v} fav={fav(v)} sit={data.sitVideo === v.yt} onFav={() => toggleFav(v)} onPlay={() => setPlay({ list, i })} />)}</div>;
  const ytFromLink = youtubeId(link);
  return <div className="space-y-6">
    <div className="flex flex-wrap gap-1.5"><Chip on={tab === "kids"} onClick={() => setTab("kids")}>🧸 For {kid.name}</Chip><Chip on={tab === "parents"} onClick={() => setTab("parents")}>🎓 For you</Chip><Chip on={tab === "mine"} onClick={() => setTab("mine")}>⭐ Favourites & my videos</Chip></div>
    {tab === "kids" && <>
      <Section title={`Watch together with ${kid.name}`} sub="Songs and shows from official channels. Pick one to play automatically during the sit timer.">{grid(kids)}</Section>
      <Note tone="tip">Watching the same video before every sit makes it a cue: video starts, we go to the potty. For children with autism, step-by-step 'video modeling' videos can help a lot.</Note>
    </>}
    {tab === "parents" && <>
      {featuredNeeds.length > 0 && <Section title={`For ${kid.name}'s needs`}>{grid(featuredNeeds)}</Section>}
      <Section title="Learn from the experts" sub="Pediatricians, children's hospitals, public-health services and specialists.">
        <div className="mb-4 flex flex-wrap gap-1.5"><Chip on={!topic} onClick={() => setTopic("")}>All</Chip>{(["basics", "poop", "nights", "outings", "autism", "down", "complex"] as const).map((t) => <Chip key={t} on={topic === t} onClick={() => setTopic(t)}>{VIDEO_TOPICS[t]}</Chip>)}</div>
        {grid(parents)}
      </Section>
    </>}
    {tab === "mine" && <>
      <Section title="Add any YouTube video" sub="Paste a link to a video you love — a song your child knows, a book read-aloud, a video model of your own bathroom routine.">
        <Panel className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"><Label text="YouTube link"><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" className={field} style={fieldStyle} /></Label><Label text="Name it"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Potty song" className={field} style={fieldStyle} maxLength={80} /></Label></div>
          <div className="flex flex-wrap items-center gap-2"><Chip on={aud === "kids"} onClick={() => setAud("kids")}>For my child</Chip><Chip on={aud === "parents"} onClick={() => setAud("parents")}>For me</Chip><span className="flex-1" />
            <Btn2 kind="ink" disabled={!ytFromLink} onClick={() => { if (!ytFromLink) return; set((d) => ({ ...d, myVideos: [{ id: uid(), yt: ytFromLink, title: title.trim() || "My video", audience: aud, added: Date.now() }, ...d.myVideos].slice(0, 100) })); setLink(""); setTitle(""); }}><Plus size={15} />Add video</Btn2></div>
          {link && !ytFromLink && <p className="text-sm" style={{ color: C.accident }}>That doesn't look like a YouTube link.</p>}
        </Panel>
      </Section>
      {mine.length ? <Section title="Your videos"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{mine.map((v, i) => <div key={v.id} className="relative"><Card v={v} fav={fav(v)} sit={data.sitVideo === v.yt} onFav={() => toggleFav(v)} onPlay={() => setPlay({ list: mine, i })} /><button type="button" aria-label="Remove video" onClick={() => set((d) => ({ ...d, myVideos: d.myVideos.filter((x) => x.id !== v.id), sitVideo: d.sitVideo === v.yt ? "" : d.sitVideo }))} className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5" style={{ color: C.accident }}><Trash2 size={15} /></button></div>)}</div></Section> : null}
      {data.favVideos.length > 0 && <Section title="Favourites">{grid([...VIDEOS, ...mine].filter((v) => fav(v)))}</Section>}
      {!mine.length && !data.favVideos.length && <Empty2 icon="⭐" title="No favourites yet" text="Tap the heart on any video, or add your own YouTube links above." />}
    </>}
    <Section title="Find more on YouTube" sub="Opens YouTube in a new tab. Watch first before showing your child.">
      <div className="flex flex-wrap gap-2">{VIDEO_SEARCHES.map((s) => <a key={s.q} href={ytSearch(s.q)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}`, color: C.ink }}><ExternalLink size={14} />{s.label}</a>)}</div>
    </Section>
    {play && <Player list={play.list} start={Math.max(0, play.i)} onClose={() => setPlay(null)} />}
  </div>;
}
