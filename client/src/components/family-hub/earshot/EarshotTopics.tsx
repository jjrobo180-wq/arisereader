// Explore → Browse by subject: pick a subject (History), then a topic (World War II), and get a
// ready-made playlist of real episodes from Apple Podcasts. Play it all, play from any episode,
// or save it to your own playlists. The subjects and topics live in shared/earshotTopics.ts.
import { useEffect, useState } from "react";
import { BookmarkPlus, ChevronLeft, ChevronRight, Loader2, Play } from "lucide-react";
import { durationWords, type PodEpisode, type PodShow } from "@shared/earshot";
import { SUBJECTS, subjectsFor, type Subject, type Topic } from "@shared/earshotTopics";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
type TopicData = { topic: { id: string; name: string; subject: string }; episodes: PodEpisode[]; shows: PodShow[] };

/** The grid of subjects shown on Explore's front page. */
export function SubjectGrid({ student, onOpen }: { student: boolean; onOpen: (s: Subject) => void }) {
  return <section className="mt-6">
    <h3 className="text-lg font-semibold">Browse by subject</h3>
    <p className="mt-0.5 text-xs text-white/50">Ready-made playlists, like History → World War II.</p>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {subjectsFor(student).map((s) => (
        <button key={s.id} type="button" onClick={() => onOpen(s)} className="flex min-h-16 items-center gap-3 rounded-2xl px-3.5 text-left ring-1 ring-white/10 hover:ring-white/25" style={{ background: `linear-gradient(135deg, ${s.color}55, ${s.color}1a)` }}>
          <span aria-hidden="true" className="text-2xl">{s.emoji}</span>
          <span className="min-w-0"><b className="block text-sm leading-tight">{s.name}</b><span className="block text-[11px] text-white/55">{s.topics.length} topics</span></span>
        </button>
      ))}
    </div>
  </section>;
}

/** One subject's topics, and a topic's playlist once one is picked. */
export function SubjectView({ subjectId, api, ex, onBack, onShow, onPlay, onSave }: {
  subjectId: string; api: Api; ex: string; onBack: () => void;
  onShow: (s: PodShow) => void;
  /** Plays the list starting at index i. */
  onPlay: (list: PodEpisode[], i: number, title: string) => void;
  /** Saves the playlist to the listener's own playlists. */
  onSave: (topic: Topic, list: PodEpisode[]) => void;
}) {
  const subject = SUBJECTS.find((s) => s.id === subjectId);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [data, setData] = useState<TopicData | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!topic) { setData(null); setErr(""); return; }
    let alive = true; setData(null); setErr("");
    api(`/api/earshot/topic/${topic.id}?x=1${ex}`).then((b) => { if (alive) setData(b); }).catch((e) => { if (alive) setErr(e?.message || "That playlist didn't load. Try again."); });
    return () => { alive = false; };
  }, [topic, api, ex]);
  if (!subject) return null;

  const back = <button type="button" onClick={() => (topic ? setTopic(null) : onBack())} className="flex min-h-10 items-center gap-1 rounded-full bg-white/10 pl-2 pr-4 text-sm font-bold"><ChevronLeft size={18} />{topic ? subject.name : "Explore"}</button>;

  if (!topic) return <div>
    {back}
    <div className="mt-4 flex items-center gap-3"><span aria-hidden="true" className="text-4xl">{subject.emoji}</span><div><h2 className="text-2xl font-black">{subject.name}</h2><p className="text-sm text-white/55">Pick a topic for a playlist of episodes about it.</p></div></div>
    <div className="mt-4 flex flex-col gap-1.5">
      {subject.topics.map((t) => (
        <button key={t.id} type="button" onClick={() => setTopic(t)} className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-white/[.04] px-4 text-left ring-1 ring-white/[.06] hover:bg-white/[.08]">
          <span className="flex items-center gap-3"><span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: subject.color }} /><b className="text-[15px]">{t.name}</b></span>
          <ChevronRight size={18} className="text-white/40" />
        </button>
      ))}
    </div>
  </div>;

  const eps = data?.episodes ?? [];
  const total = eps.reduce((n, e) => n + (e.secs || 0), 0);
  return <div>
    {back}
    <div className="mt-4 rounded-3xl p-5 ring-1 ring-white/10" style={{ background: `linear-gradient(135deg, ${subject.color}66, ${subject.color}14)` }}>
      <p className="text-xs font-black uppercase tracking-widest text-white/60">{subject.emoji} {subject.name} playlist</p>
      <h2 className="mt-1 text-3xl font-black leading-tight">{topic.name}</h2>
      {data && <p className="mt-1 text-sm text-white/65">{eps.length} episodes{total ? ` · about ${durationWords(total)}` : ""}</p>}
      {!!eps.length && <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => onPlay(eps, 0, topic.name)} className="flex min-h-11 items-center gap-2 rounded-full bg-white px-5 font-black text-[#120e14]"><Play size={18} fill="currentColor" />Play all</button>
        <button type="button" onClick={() => onSave(topic, eps)} className="flex min-h-11 items-center gap-2 rounded-full bg-white/15 px-5 font-bold"><BookmarkPlus size={18} />Save as playlist</button>
      </div>}
    </div>

    {!data && !err && <div className="grid place-items-center py-10"><Loader2 className="animate-spin" /><p className="mt-2 text-sm text-white/55">Finding episodes about {topic.name}…</p></div>}
    {err && <div className="py-8 text-center"><p className="text-sm text-white/70">{err}</p><button type="button" onClick={() => { const t = topic; setTopic(null); setTimeout(() => setTopic(t), 0); }} className="mt-3 min-h-10 rounded-full bg-white/10 px-5 font-bold">Try again</button></div>}
    {data && !eps.length && <p className="py-8 text-center text-sm text-white/60">No episodes found for this topic right now. Try another one.</p>}

    {!!eps.length && <ol className="mt-4 flex flex-col gap-1">
      {eps.map((e, i) => (
        <li key={e.id}>
          <button type="button" onClick={() => onPlay(eps, i, topic.name)} className="grid w-full grid-cols-[22px_52px_1fr] items-center gap-3 rounded-xl p-2 text-left hover:bg-white/5">
            <span className="text-right text-xs font-bold text-white/40">{i + 1}</span>
            <img src={e.art} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-[52px] w-[52px] rounded-lg object-cover" />
            <span className="min-w-0"><b className="line-clamp-2 text-sm leading-snug">{e.title}</b><span className="block truncate text-xs text-white/55">{e.show}{e.secs ? ` · ${durationWords(e.secs)}` : ""}</span></span>
          </button>
        </li>
      ))}
    </ol>}

    {!!data?.shows.length && <section className="mt-6">
      <h3 className="text-lg font-semibold">Shows about {topic.name}</h3>
      <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {data.shows.map((s) => <button key={s.id} type="button" onClick={() => onShow(s)} className="w-32 flex-none text-left"><img src={s.art} alt="" referrerPolicy="no-referrer" loading="lazy" className="aspect-square w-32 rounded-xl object-cover" /><b className="mt-1.5 line-clamp-2 text-sm leading-tight">{s.name}</b><span className="line-clamp-1 text-xs text-white/55">{s.author}</span></button>)}
      </div>
    </section>}
  </div>;
}
