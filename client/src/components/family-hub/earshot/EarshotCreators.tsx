// Creators in Pod+ and Earshot: Open Mic (the page where new and independent podcasters get found),
// Studio (a creator's numbers and the Pod+ Rise program), email sign-in for Pod+ creators, starting
// a LivePod, and the LivePod room itself (live audio from the host's browser, chat, Cheers, likes).
// Server: server/podcastCreators.ts, server/podcastLive.ts, server/podcastAccounts.ts.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronLeft, Crown, Headphones, Heart, Loader2, Mail, Mic, MicOff, PartyPopper, Pin, Play, Plus, Radio, Send, Share2, Sparkles, Trash2, TrendingDown, TrendingUp, Upload, Users, VolumeX, X } from "lucide-react";
import { durationWords, hiRes } from "@shared/earshot";
import {
  CHEERS, CHEER_BUDGET, BIG_CHEER, ICE_SERVERS, LIVE_CHAT_MAX, LIVE_TITLE_MAX, LIVE_TOPICS, RISE_PERKS, liveClock, type MicTab,
} from "@shared/earshotCreators";
import { ACCENT, Avatar, Sheet, ago, artOf, compact, inputCls, toEpisode, toShow, type Api, type PlayFn, type PostEpisode, type Profile } from "./EarshotSocial";

const INK = "#0f1419", GREY = "#536471", LINE = "#eff3f4";
const INK0 = INK, GREY0 = GREY, LINE0 = LINE;

// ===========================================================================
// Who you are as a creator
// ===========================================================================
export type CreatorInfo = { creator: boolean; signIn: boolean; email: string | null; profile: Profile | null; live: { id: string } | null };
export function useCreator(api: Api, off: boolean) {
  const [info, setInfo] = useState<CreatorInfo | null>(null);
  const load = useCallback(() => { if (off) return; api("/api/earshot/creators/me").then(setInfo).catch(() => {}); }, [api, off]);
  useEffect(() => { load(); }, [load]);
  return { info, reload: load };
}

export type LiveSummary = { id: string; title: string; topic: string; host: Profile; listeners: number; likes: number; startedAt: number };
export type MicEpisode = {
  post: string; episode: PostEpisode; caption: string; at: string; creator: Profile; followers: number; episodes: number;
  newVoice: boolean; plays: number; likes: number; comments: number; followed: boolean; mine: boolean;
};

/** A small orange "Live" mark with a pulse. */
export const LiveDot = ({ className = "" }: { className?: string }) => <span className={`relative inline-flex h-2 w-2 ${className}`}><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: ACCENT }} /><span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: ACCENT }} /></span>;

// ===========================================================================
// Sign in (Pod+): an email and a 6-digit code
// ===========================================================================
export function SignInSheet({ api, say, why, onDone, onClose }: { api: Api; say: (m: string) => void; why: string; onDone: (token: string, email: string) => void; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const ask = () => { setBusy(true); api("/api/earshot/account/code", { method: "POST", body: { email } }).then(() => { setSent(true); say("Check your email for the code."); }).catch((e) => say(e.message)).finally(() => setBusy(false)); };
  const check = () => { setBusy(true); api("/api/earshot/account/verify", { method: "POST", body: { email, code } }).then((b) => { onDone(b.token, b.email); }).catch((e) => say(e.message)).finally(() => setBusy(false)); };
  return <Sheet title="Sign in to create" onClose={onClose}>
    <div className="px-4 pb-6">
      <div className="flex items-start gap-3 rounded-2xl bg-white/[.05] p-3"><span className="grid h-10 w-10 flex-none place-items-center rounded-full" style={{ background: ACCENT, color: "#111013" }}><Mic size={19} /></span>
        <p className="text-sm leading-relaxed text-white/75">{why} Your profile, posts and followers come with you on any device.</p></div>
      {!sent ? <>
        <label className="mt-4 block"><span className="mb-1 block text-xs font-bold text-white/60">Email</span>
          <input type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && email.includes("@")) ask(); }} placeholder="you@example.com" className={inputCls} /></label>
        <button type="button" onClick={ask} disabled={busy || !email.includes("@")} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold text-[#111013] disabled:opacity-40">{busy ? <Loader2 size={17} className="animate-spin" /> : <Mail size={17} />}Email me a code</button>
      </> : <>
        <p className="mt-4 text-sm text-white/70">We sent a 6-digit code to <b className="text-white">{email}</b>.</p>
        <input inputMode="numeric" autoComplete="one-time-code" autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => { if (e.key === "Enter" && code.length === 6) check(); }} placeholder="123456" aria-label="Code from the email"
          className={`${inputCls} mt-3 text-center text-2xl font-bold tracking-[.4em]`} />
        <button type="button" onClick={check} disabled={busy || code.length !== 6} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold text-[#111013] disabled:opacity-40">{busy ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}Sign in</button>
        <div className="mt-3 flex justify-between text-xs text-white/55"><button type="button" onClick={() => { setSent(false); setCode(""); }} className="underline">Use another email</button><button type="button" onClick={ask} disabled={busy} className="underline">Send a new code</button></div>
      </>}
    </div>
  </Sheet>;
}

// ===========================================================================
// Create: a new episode, a LivePod, or your Studio
// ===========================================================================
export function CreateSheet({ onEpisode, onLive, onStudio, onClose, live }: { onEpisode: () => void; onLive: () => void; onStudio: () => void; onClose: () => void; live: boolean }) {
  const row = (icon: ReactNode, title: string, sub: string, onClick: () => void, hot?: boolean) => <button type="button" onClick={onClick} className={`flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 text-left ${hot ? "text-[#111013]" : "bg-white/[.06]"}`} style={hot ? { background: ACCENT } : undefined}>
    <span className={`grid h-10 w-10 flex-none place-items-center rounded-full ${hot ? "bg-black/10" : "bg-white/10"}`}>{icon}</span>
    <span><span className="block font-semibold">{title}</span><span className={`block text-xs ${hot ? "opacity-75" : "text-white/55"}`}>{sub}</span></span></button>;
  return <Sheet title="Create" onClose={onClose}>
    <div className="flex flex-col gap-2 px-4 pb-6">
      {row(<Radio size={19} />, live ? "Back to your LivePod" : "Go live", live ? "You're live right now" : "A LivePod: talk live, take comments and Cheers", onLive, true)}
      {row(<Upload size={18} />, "New episode", "Record here or upload a file. It shows up in Open Mic.", onEpisode)}
      {row(<TrendingUp size={18} />, "Studio", "Your plays, listeners, followers and earnings", onStudio)}
    </div>
  </Sheet>;
}

export function GoLiveSheet({ api, say, onStarted, onClose }: { api: Api; say: (m: string) => void; onStarted: (room: string, ticket: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState<string>(LIVE_TOPICS[0]);
  const [busy, setBusy] = useState(false);
  const go = () => { setBusy(true); api("/api/earshot/creators/live", { method: "POST", body: { title, topic } }).then((b) => onStarted(b.room, b.ticket)).catch((e) => say(e.message)).finally(() => setBusy(false)); };
  return <Sheet title="Go live" onClose={onClose}>
    <div className="px-4 pb-6">
      <label className="block"><span className="mb-1 block text-xs font-bold text-white/60">What's this LivePod about?</span>
        <input autoFocus value={title} maxLength={LIVE_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="Late night talk: your questions" className={inputCls} /></label>
      <p className="mb-1.5 mt-4 text-xs font-bold text-white/60">Topic</p>
      <div className="flex flex-wrap gap-1.5">{LIVE_TOPICS.map((t) => <button key={t} type="button" onClick={() => setTopic(t)} aria-pressed={topic === t} className={`min-h-9 rounded-full px-3 text-xs font-semibold ${topic === t ? "bg-white text-[#111013]" : "bg-white/10 text-white/75"}`}>{t}</button>)}</div>
      <ul className="mt-4 space-y-1.5 text-xs leading-relaxed text-white/55">
        <li>• Your followers and Open Mic can find you while you're live.</li>
        <li>• Listeners can comment and send Cheers. You can pin, remove or mute comments.</li>
        <li>• Use headphones to avoid echo. Your browser will ask to use the microphone.</li>
      </ul>
      <button type="button" onClick={go} disabled={busy} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full font-semibold text-[#111013] disabled:opacity-50" style={{ background: ACCENT }}>{busy ? <Loader2 size={17} className="animate-spin" /> : <Radio size={18} />}Go live</button>
    </div>
  </Sheet>;
}

// ===========================================================================
// Open Mic: new and independent podcasters (a white page, like Social)
// ===========================================================================
export function OpenMic({ api, say, onPlay, onPerson, onCreate, onStudio, onJoinLive, creator, live, night = false }: {
  api: Api; say: (m: string) => void; onPlay: PlayFn; onPerson: (handle: string) => void; onCreate: () => void; onStudio: () => void; onJoinLive: (id: string) => void;
  creator: CreatorInfo | null; live: LiveSummary[]; night?: boolean;
}) {
  // Built as a white page; at night the same layout takes a dark palette.
  const INK = night ? "#f7f1ec" : INK0, GREY = night ? "#a99fab" : GREY0, LINE = night ? "rgba(255,255,255,.09)" : LINE0;
  const CARD = night ? "#1d1720" : "#fff", CHIP = night ? "rgba(255,255,255,.08)" : "#f2f4f6", SOFT = night ? "#3a2a24" : "#fff0e5";
  const BTN = night ? { background: "#fff", color: "#120e14" } : { background: INK0, color: "#fff" };
  const [tab, setTab] = useState<MicTab>("fresh");
  const [list, setList] = useState<MicEpisode[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => { setList(null); setErr(""); api(`/api/earshot/creators/openmic?tab=${tab}`).then((b) => setList(b.episodes || [])).catch((e) => { setErr(e?.message || "Open Mic didn't load."); setList([]); }); }, [api, tab]);
  useEffect(() => { load(); }, [load]);
  const follow = (m: MicEpisode) => {
    const on = !m.followed;
    setList((l) => (l || []).map((x) => (x.creator.handle === m.creator.handle ? { ...x, followed: on } : x)));
    api("/api/earshot/social/follow", { method: "POST", body: { handle: m.creator.handle, on } }).then(() => say(on ? `Following @${m.creator.handle}.` : `Unfollowed @${m.creator.handle}.`)).catch((e) => {
      setList((l) => (l || []).map((x) => (x.creator.handle === m.creator.handle ? { ...x, followed: !on } : x)));
      say(/profile/i.test(e?.message || "") ? "Make your profile in Social first, then follow creators." : e.message);
    });
  };
  const play = (m: MicEpisode) => onPlay(toShow(m.episode, m.creator.name), toEpisode(m.episode, m.creator.name));

  return <div className="h-full overflow-y-auto pb-16 pt-16 [scrollbar-width:none]" style={{ color: INK }}>
    <div className="mx-auto w-full max-w-[760px] px-4">
      {/* Header */}
      <div className="relative mt-2 overflow-hidden rounded-[28px] p-5 sm:p-7" style={{ background: night ? "linear-gradient(135deg,#3b2420,#33203a 55%,#231f3d)" : "linear-gradient(135deg,#fff3ea,#fde8f1 55%,#efe8fd)" }}>
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full opacity-60" style={{ background: "radial-gradient(circle,#ffb27a,transparent 70%)" }} />
        <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.16em]" style={{ color: night ? "#ffb27a" : "#c2551a" }}><Mic size={14} />Open Mic</p>
        <h2 className="mt-2 text-[30px] font-extrabold leading-[1.05] tracking-tight sm:text-[38px]">New voices,<br />fresh every day.</h2>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed" style={{ color: GREY }}>Independent and brand-new podcasters, put first. Find your next favorite show before everyone else does.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={onCreate} className="flex min-h-11 items-center gap-2 rounded-full px-5 text-[15px] font-bold" style={BTN}><Plus size={17} />{creator?.creator ? "Create" : "Start your show"}</button>
          {creator?.creator && <button type="button" onClick={onStudio} className="flex min-h-11 items-center gap-2 rounded-full border px-5 text-[15px] font-bold" style={{ borderColor: LINE, background: CARD }}><TrendingUp size={17} />Studio</button>}
        </div>
      </div>

      {/* Live now */}
      {live.length > 0 && <section className="mt-6">
        <h3 className="flex items-center gap-2 text-[17px] font-extrabold"><LiveDot />LivePods on now</h3>
        <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {live.map((r) => <button key={r.id} type="button" onClick={() => onJoinLive(r.id)} className="w-[220px] flex-none rounded-2xl border p-3 text-left shadow-[0_6px_20px_rgba(15,20,25,.06)] transition hover:-translate-y-0.5" style={{ borderColor: LINE, background: CARD }}>
            <div className="flex items-center gap-2.5">
              <span className="rounded-full p-[2px]" style={{ background: `conic-gradient(${ACCENT},#e8467c,${ACCENT})` }}><span className="block rounded-full p-[2px]" style={{ background: CARD }}><Avatar p={r.host} size={40} /></span></span>
              <span className="min-w-0"><b className="block truncate text-[14px]">{r.host.name}</b><span className="flex items-center gap-1 text-[12px]" style={{ color: GREY }}><Headphones size={12} />{compact(r.listeners)} listening</span></span>
            </div>
            <p className="mt-2 line-clamp-2 text-[14px] font-semibold leading-snug">{r.title}</p>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[#fff]" style={{ background: ACCENT }}>Live · {r.topic}</span>
          </button>)}
        </div>
      </section>}

      {/* Tabs */}
      <div className="sticky top-0 z-10 -mx-4 mt-6 flex gap-1.5 px-4 py-2 backdrop-blur" style={{ background: night ? "rgba(18,14,20,.94)" : "rgba(255,255,255,.95)" }} role="tablist">
        {([["fresh", "Fresh"], ["rising", "Rising"], ["following", "Following"]] as const).map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
          className="min-h-9 rounded-full px-4 text-[14px] font-bold transition" style={tab === v ? BTN : { background: CHIP, color: GREY }}>{l}</button>)}
      </div>
      <p className="mt-1 text-[13px]" style={{ color: GREY }}>{tab === "fresh" ? "The newest episodes, with first-time and small creators lifted up." : tab === "rising" ? "What listeners are taking to right now." : "New episodes from creators you follow."}</p>

      {/* Episodes */}
      {!list && <div className="grid place-items-center py-14"><Loader2 className="animate-spin" style={{ color: ACCENT }} /></div>}
      {list && !list.length && <div className="mt-6 rounded-3xl border border-dashed p-8 text-center" style={{ borderColor: night ? "rgba(255,255,255,.18)" : "#d9dee3" }}>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full" style={{ background: SOFT, color: night ? "#ffb27a" : "#c2551a" }}><Mic size={24} /></span>
        <p className="mt-3 text-[19px] font-extrabold">{err ? "Open Mic didn't load" : tab === "following" ? "Nothing new from people you follow" : "The stage is open"}</p>
        <p className="mx-auto mt-1 max-w-sm text-[14px]" style={{ color: GREY }}>{err || (tab === "following" ? "Follow creators on Open Mic and their new episodes land here." : "Be one of the first voices on Open Mic. Record an episode right here or upload one.")}</p>
        {err ? <button type="button" onClick={load} className="mt-4 min-h-10 rounded-full px-5 text-sm font-bold" style={BTN}>Try again</button>
          : tab !== "following" && <button type="button" onClick={onCreate} className="mt-4 min-h-10 rounded-full px-5 text-sm font-bold" style={BTN}>Start your show</button>}
      </div>}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {list?.map((m, i) => <article key={m.post} className="group flex flex-col rounded-3xl border p-3 shadow-[0_4px_16px_rgba(15,20,25,.04)] transition hover:shadow-[0_10px_30px_rgba(15,20,25,.08)]" style={{ borderColor: LINE, background: CARD }}>
          <div className="flex gap-3">
            <button type="button" onClick={() => play(m)} aria-label={`Play ${m.episode.title}`} className="relative h-[92px] w-[92px] flex-none overflow-hidden rounded-2xl">
              <img src={hiRes(artOf(m.episode), 300)} alt="" referrerPolicy="no-referrer" loading={i < 6 ? "eager" : "lazy"} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              <span className="absolute bottom-1.5 right-1.5 grid h-8 w-8 place-items-center rounded-full bg-[#fff] text-[#0f1419] shadow"><Play size={14} fill="currentColor" strokeWidth={0} className="ml-0.5" /></span>
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {m.newVoice && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider" style={{ background: "#e3f6f3", color: "#0f8f87" }}>New voice</span>}
                {tab === "rising" && i < 3 && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider" style={{ background: SOFT, color: night ? "#ffb27a" : "#c2551a" }}>#{i + 1} rising</span>}
                <span className="text-[12px]" style={{ color: GREY }}>{ago(m.at)}</span>
              </div>
              <button type="button" onClick={() => play(m)} className="mt-1 line-clamp-2 text-left text-[15.5px] font-bold leading-snug">{m.episode.title}</button>
              <p className="mt-1 flex items-center gap-3 text-[12.5px]" style={{ color: GREY }}>
                <span className="flex items-center gap-1"><Play size={11} fill="currentColor" strokeWidth={0} />{compact(m.plays)}</span>
                <span className="flex items-center gap-1"><Heart size={12} />{compact(m.likes)}</span>
                {m.episode.secs > 0 && <span>{durationWords(m.episode.secs)}</span>}
              </p>
            </div>
          </div>
          {m.caption && <p className="mt-2.5 line-clamp-2 text-[14px] leading-snug" style={{ color: night ? "#d6ced8" : "#3b4651" }}>{m.caption}</p>}
          <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: LINE }}>
            <button type="button" onClick={() => onPerson(m.creator.handle)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <Avatar p={m.creator} size={30} />
              <span className="min-w-0 leading-tight"><b className="block truncate text-[13.5px]">{m.creator.name}</b><span className="block truncate text-[12px]" style={{ color: GREY }}>@{m.creator.handle} · {compact(m.followers)} follower{m.followers === 1 ? "" : "s"}</span></span>
            </button>
            {!m.mine && <button type="button" onClick={() => follow(m)} className="min-h-8 flex-none rounded-full px-3.5 text-[13px] font-bold" style={m.followed ? { border: `1px solid ${night ? "rgba(255,255,255,.25)" : "#cfd9de"}`, color: INK } : BTN}>{m.followed ? "Following" : "Follow"}</button>}
          </div>
        </article>)}
      </div>
      {list && list.length > 0 && <p className="mt-6 text-center text-[12.5px]" style={{ color: GREY }}>Open Mic lifts new and small creators so every voice gets a chance to be heard.</p>}
    </div>
  </div>;
}

// ===========================================================================
// Studio: a creator's numbers, their LivePods, and Pod+ Rise (a white page)
// ===========================================================================
type StudioData = {
  profile: Profile;
  totals: { plays: number; playsTrend: number | null; listeners: number; minutes: number; minutesTrend: number | null; followers: number; followersNew: number; followersTrend: number | null; likes: number; completion: number; episodes: number };
  daily: { day: string; plays: number; minutes: number; followers: number }[];
  sources: Record<string, number>;
  episodes: { post: string; title: string; art: string; at: string; secs: number; plays: number; listeners: number; minutes: number; completion: number; likes: number; comments: number; reposts: number }[];
  live: { title: string; at: string; minutes: number; peak: number; listeners: number; comments: number; cheers: number; cheerPoints: number; likes: number; shares: number }[];
  rise: { steps: { id: string; label: string; have: number; need: number; done: boolean }[]; eligible: boolean; percent: number; joined: boolean };
};
const SOURCE_NAMES: Record<string, string> = { openmic: "Open Mic", foryou: "For You", social: "Social", profile: "Your profile", other: "Links and other" };

export function Studio({ api, say, onClose, onCreate, email, onSignOut }: { api: Api; say: (m: string) => void; onClose: () => void; onCreate: () => void; email: string | null; onSignOut?: () => void }) {
  const [d, setD] = useState<StudioData | null>(null);
  const [err, setErr] = useState("");
  const [metric, setMetric] = useState<"plays" | "minutes" | "followers">("plays");
  const [joining, setJoining] = useState(false);
  useEffect(() => { api("/api/earshot/creators/studio").then(setD).catch((e) => setErr(e?.message || "Studio didn't load.")); }, [api]);
  const join = () => { setJoining(true); api("/api/earshot/creators/rise", { method: "POST" }).then(() => { setD((x) => (x ? { ...x, rise: { ...x.rise, joined: true } } : x)); say("You're on the Pod+ Rise list."); }).catch((e) => say(e.message)).finally(() => setJoining(false)); };
  const max = Math.max(1, ...(d?.daily.map((x) => x[metric]) ?? [1]));
  const sources: Record<string, number> = d?.sources ?? {};
  const srcTotal = Object.values(sources).reduce((a, b) => a + b, 0);

  const Kpi = ({ label, value, sub, tr }: { label: string; value: string; sub?: string; tr?: number | null }) => <div className="rounded-3xl border bg-[#fff] p-4" style={{ borderColor: LINE }}>
    <p className="text-[12.5px] font-semibold" style={{ color: GREY }}>{label}</p>
    <p className="mt-1 text-[28px] font-extrabold leading-none tracking-tight tabular-nums">{value}</p>
    <p className="mt-1.5 flex items-center gap-1 text-[12px] font-semibold" style={{ color: tr == null ? GREY : tr >= 0 ? "#0f8f6f" : "#c8344a" }}>
      {tr != null && (tr >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />)}{tr != null ? `${tr >= 0 ? "+" : ""}${tr}% vs last 28 days` : sub || ""}</p>
  </div>;

  return <div className="absolute inset-0 z-50 overflow-y-auto bg-[#f7f9fa] pb-16 [scrollbar-width:none]" role="dialog" aria-label="Studio" style={{ color: INK }}>
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-[#fff]/90 px-3 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.6rem)] backdrop-blur-xl" style={{ borderColor: LINE }}>
      <button type="button" onClick={onClose} aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5"><ChevronLeft size={22} /></button>
      <b className="text-[19px]">Studio</b>
      <span className="ml-auto flex items-center gap-2">
        <button type="button" onClick={onCreate} className="flex min-h-9 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold text-[#fff]" style={{ background: INK }}><Plus size={16} />Create</button>
      </span>
    </div>
    <div className="mx-auto w-full max-w-[860px] px-4">
      {!d && !err && <div className="grid place-items-center py-24"><Loader2 className="animate-spin" style={{ color: ACCENT }} /></div>}
      {err && <p className="py-20 text-center text-[15px]" style={{ color: GREY }}>{err}</p>}
      {d && <>
        <div className="mt-5 flex items-center gap-3">
          <Avatar p={d.profile} size={52} />
          <div><h2 className="text-[24px] font-extrabold leading-tight tracking-tight">Hi, {d.profile.name.split(" ")[0]}</h2><p className="text-[14px]" style={{ color: GREY }}>@{d.profile.handle} · your last 28 days</p></div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Plays" value={compact(d.totals.plays)} tr={d.totals.playsTrend} />
          <Kpi label="Listeners" value={compact(d.totals.listeners)} sub="Different people" />
          <Kpi label="Minutes listened" value={compact(d.totals.minutes)} tr={d.totals.minutesTrend} />
          <Kpi label="Followers" value={compact(d.totals.followers)} tr={d.totals.followersTrend} sub={`+${d.totals.followersNew} new`} />
        </div>

        <section className="mt-3 rounded-3xl border bg-[#fff] p-4" style={{ borderColor: LINE }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[16px] font-extrabold">Day by day</h3>
            <div className="flex gap-1 rounded-full bg-[#f2f4f6] p-1">{([["plays", "Plays"], ["minutes", "Minutes"], ["followers", "Followers"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setMetric(k)} className="min-h-8 rounded-full px-3 text-[12.5px] font-bold" style={metric === k ? { background: "#fff", color: INK, boxShadow: "0 1px 4px rgba(0,0,0,.08)" } : { color: GREY }}>{l}</button>)}</div>
          </div>
          <div className="mt-4 flex h-40 items-end gap-[3px]" role="img" aria-label={`${metric} per day for 28 days`}>
            {d.daily.map((x) => <div key={x.day} title={`${new Date(x.day + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}: ${x[metric]}`} className="group relative flex-1 rounded-t-md transition-[height] duration-500" style={{ height: `${Math.max(3, (x[metric] / max) * 100)}%`, background: x[metric] ? "linear-gradient(180deg,#ff9f5a,#e8467c)" : "#eef1f3" }} />)}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px]" style={{ color: GREY }}><span>{new Date(d.daily[0].day + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><span>Today</span></div>
        </section>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <section className="rounded-3xl border bg-[#fff] p-4" style={{ borderColor: LINE }}>
            <h3 className="text-[16px] font-extrabold">Where listeners found you</h3>
            {srcTotal === 0 ? <p className="mt-3 text-[14px]" style={{ color: GREY }}>Once people play your episodes, you'll see whether they came from Open Mic, For You, Social or your profile.</p>
              : <div className="mt-3 space-y-2.5">{Object.entries(sources).sort((a, b) => b[1] - a[1]).map(([k, n]) => <div key={k}>
                <div className="flex justify-between text-[13px] font-semibold"><span>{SOURCE_NAMES[k] ?? k}</span><span style={{ color: GREY }}>{Math.round((n / srcTotal) * 100)}%</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#f0f2f4]"><div className="h-full rounded-full" style={{ width: `${(n / srcTotal) * 100}%`, background: "linear-gradient(90deg,#11b9af,#5279ed)" }} /></div>
              </div>)}</div>}
          </section>
          <section className="rounded-3xl border bg-[#fff] p-4" style={{ borderColor: LINE }}>
            <h3 className="text-[16px] font-extrabold">How they listen</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl bg-[#f7f9fa] p-3"><p className="text-[24px] font-extrabold tabular-nums">{d.totals.completion}%</p><p className="text-[12px]" style={{ color: GREY }}>finish your episodes</p></div>
              <div className="rounded-2xl bg-[#f7f9fa] p-3"><p className="text-[24px] font-extrabold tabular-nums">{d.totals.plays ? Math.round(d.totals.minutes / d.totals.plays) : 0}</p><p className="text-[12px]" style={{ color: GREY }}>minutes per play</p></div>
              <div className="rounded-2xl bg-[#f7f9fa] p-3"><p className="text-[24px] font-extrabold tabular-nums">{compact(d.totals.likes)}</p><p className="text-[12px]" style={{ color: GREY }}>likes, all time</p></div>
              <div className="rounded-2xl bg-[#f7f9fa] p-3"><p className="text-[24px] font-extrabold tabular-nums">{d.totals.episodes}</p><p className="text-[12px]" style={{ color: GREY }}>episodes</p></div>
            </div>
          </section>
        </div>

        {/* Pod+ Membership: what a creator needs to earn (no follower, play or time minimums) */}
        <section className="relative mt-3 overflow-hidden rounded-3xl p-5 text-[#fff]" style={{ background: "linear-gradient(120deg,#13b2ac,#5576e5 55%,#835adf)" }}>
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[#fff]/25" />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.16em] opacity-85"><Crown size={14} />Pod+ Membership</p>
              <h3 className="mt-1 text-[24px] font-extrabold leading-tight tracking-tight">Earn from your first episode</h3>
              <p className="mt-1 max-w-md text-[14px] leading-relaxed opacity-90">Creators earn with a Pod+ Membership, the same $5 a month plan listeners get. No follower, play or time minimums.</p></div>
            <div className="grid h-20 w-20 flex-none place-items-center rounded-full" style={{ background: "rgba(255,255,255,.18)" }}><span className="text-center leading-none"><b className="block text-[22px] font-extrabold">$5</b><span className="text-[11px] font-bold opacity-85">a month</span></span></div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">{RISE_PERKS.map((p) => <div key={p.id} className="rounded-2xl p-3" style={{ background: "rgba(0,0,0,.12)" }}>
            <p className="flex items-center justify-between gap-2 text-[13.5px] font-bold">{p.title}<span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider" style={{ background: "rgba(255,255,255,.2)" }}>Opening soon</span></p>
            <p className="mt-0.5 text-[12.5px] leading-snug opacity-85">{p.blurb}</p></div>)}</div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={join} disabled={d.rise.joined || joining} className="flex min-h-11 items-center gap-2 rounded-full bg-[#fff] px-5 text-[14.5px] font-extrabold disabled:opacity-90" style={{ color: "#3d4fb8" }}>{d.rise.joined ? <><Check size={16} />We'll tell you when it opens</> : joining ? <Loader2 size={16} className="animate-spin" /> : <><Sparkles size={16} />Tell me when it opens</>}</button>
            <p className="text-[12px] opacity-85">Memberships and payouts are opening soon. No card needed today.</p>
          </div>
        </section>

        {/* Episodes */}
        <section className="mt-3 rounded-3xl border bg-[#fff] p-4" style={{ borderColor: LINE }}>
          <h3 className="text-[16px] font-extrabold">Your episodes</h3>
          {!d.episodes.length ? <div className="py-6 text-center"><p className="text-[14px]" style={{ color: GREY }}>No episodes yet. Your first one goes straight into Open Mic with a boost for new voices.</p>
            <button type="button" onClick={onCreate} className="mt-3 min-h-10 rounded-full px-5 text-sm font-bold text-[#fff]" style={{ background: INK }}>Make your first episode</button></div>
            : <div className="mt-2 divide-y" style={{ borderColor: LINE }}>{d.episodes.map((e) => <div key={e.post} className="flex items-center gap-3 py-3" style={{ borderColor: LINE }}>
              <img src={hiRes(e.art || artOf({ id: e.post, title: e.title } as PostEpisode), 120)} alt="" referrerPolicy="no-referrer" className="h-12 w-12 flex-none rounded-xl object-cover" />
              <div className="min-w-0 flex-1"><p className="truncate text-[14.5px] font-bold">{e.title}</p><p className="text-[12px]" style={{ color: GREY }}>{ago(e.at)}{e.secs ? ` · ${durationWords(e.secs)}` : ""}</p></div>
              <div className="grid flex-none grid-cols-2 gap-x-4 text-right text-[12.5px] tabular-nums sm:grid-cols-4">
                <span><b className="block text-[14px]">{compact(e.plays)}</b><span style={{ color: GREY }}>plays</span></span>
                <span><b className="block text-[14px]">{e.completion}%</b><span style={{ color: GREY }}>finish</span></span>
                <span className="hidden sm:block"><b className="block text-[14px]">{compact(e.likes)}</b><span style={{ color: GREY }}>likes</span></span>
                <span className="hidden sm:block"><b className="block text-[14px]">{compact(e.comments)}</b><span style={{ color: GREY }}>comments</span></span>
              </div>
            </div>)}</div>}
        </section>

        {/* LivePods */}
        <section className="mt-3 rounded-3xl border bg-[#fff] p-4" style={{ borderColor: LINE }}>
          <h3 className="text-[16px] font-extrabold">Your LivePods</h3>
          {!d.live.length ? <p className="py-4 text-[14px]" style={{ color: GREY }}>Go live to talk with listeners in real time. Your LivePods and their numbers show up here.</p>
            : <div className="mt-2 space-y-2">{d.live.map((l, i) => <div key={i} className="rounded-2xl bg-[#f7f9fa] p-3">
              <div className="flex items-baseline justify-between gap-2"><p className="truncate text-[14.5px] font-bold">{l.title}</p><span className="flex-none text-[12px]" style={{ color: GREY }}>{ago(l.at)} · {l.minutes} min</span></div>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]" style={{ color: GREY }}><span><b style={{ color: INK }}>{l.peak}</b> peak</span><span><b style={{ color: INK }}>{l.listeners}</b> listeners</span><span><b style={{ color: INK }}>{l.comments}</b> comments</span><span><b style={{ color: INK }}>{compact(l.cheerPoints)}</b> Cheer points</span><span><b style={{ color: INK }}>{compact(l.likes)}</b> likes</span></p>
            </div>)}</div>}
        </section>

        {email && onSignOut && <p className="mt-6 text-center text-[13px]" style={{ color: GREY }}>Signed in as {email} · <button type="button" onClick={onSignOut} className="font-semibold underline">Sign out</button></p>}
      </>}
    </div>
  </div>;
}

// ===========================================================================
// LivePod: the room
// ===========================================================================
type LiveMsg = { id: string; at: number; kind: "chat" | "cheer" | "join" | "note"; who: { handle: string; name: string } | null; text: string; cheer?: string; points?: number };
type Burst = { id: number; emoji: string; name: string; who: string; big: boolean };
type Summary = { title: string; minutes: number; peak: number; listeners: number; comments: number; cheers: number; cheerPoints: number; likes: number; shares: number };

const hueOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 11);

/**
 * One LivePod. The host's microphone goes to each listener's browser directly (WebRTC); this page
 * only talks to the server for the handshake, chat, Cheers and likes. Works the same as host or
 * listener; the host gets the mic, moderation and the numbers.
 */
export function LiveRoom({ api, wsBase, roomId, ticket: firstTicket, say, onClose, onPerson }: {
  api: Api; wsBase: string; roomId: string; ticket?: string; say: (m: string) => void; onClose: () => void; onPerson?: (handle: string) => void;
}) {
  const [room, setRoom] = useState<{ title: string; topic: string; host: Profile; startedAt: number } | null>(null);
  const [me, setMe] = useState<{ id: string; role: "host" | "listener"; audio: boolean; canChat: boolean; spent: number } | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "waiting" | "ended" | "error">("connecting");
  const [error, setError] = useState("");
  const [chat, setChat] = useState<LiveMsg[]>([]);
  const [pinned, setPinned] = useState<LiveMsg | null>(null);
  const [stats, setStats] = useState({ listeners: 0, peak: 0, likes: 0, cheerPoints: 0 });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [text, setText] = useState("");
  const [cheering, setCheering] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [hearts, setHearts] = useState<{ id: number; x: number; hue: number }[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [heard, setHeard] = useState<"no" | "blocked" | "yes">("no");
  const [level, setLevel] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [menu, setMenu] = useState<LiveMsg | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const pcs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pending = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const meRef = useRef(me); meRef.current = me;
  const likeQ = useRef(0);
  const chatBox = useRef<HTMLDivElement | null>(null);
  const isHost = me?.role === "host";
  const hue = hueOf(room?.host.handle || roomId);

  const send = useCallback((m: unknown) => { const w = ws.current; if (w && w.readyState === WebSocket.OPEN) w.send(JSON.stringify(m)); }, []);
  const burst = useCallback((b: Omit<Burst, "id">) => { const id = Date.now() + Math.random(); setBursts((l) => [...l.slice(-5), { ...b, id }]); setTimeout(() => setBursts((l) => l.filter((x) => x.id !== id)), b.big ? 3200 : 2600); }, []);
  const floatHeart = useCallback(() => { const id = Date.now() + Math.random(); setHearts((h) => [...h.slice(-24), { id, x: Math.random() * 40 - 20, hue: [350, 20, 330, 280, 40][Math.floor(Math.random() * 5)] }]); setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 2200); }, []);

  // A level meter from whichever stream is playing: the host's microphone or what a listener hears.
  const meter = useCallback((s: MediaStream) => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext; if (!Ctx) return;
      const ctx = new Ctx(); const src = ctx.createMediaStreamSource(s); const an = ctx.createAnalyser(); an.fftSize = 256; src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount); let raf = 0;
      const tick = () => { an.getByteFrequencyData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i]; setLevel(Math.min(1, sum / buf.length / 90)); raf = requestAnimationFrame(tick); };
      tick();
      return () => { cancelAnimationFrame(raf); void ctx.close().catch(() => {}); };
    } catch { return undefined; }
  }, []);

  // ---- the audio handshake ----
  const hostCall = useCallback(async (peer: string) => {
    const s = stream.current; if (!s) return;
    pcs.current.get(peer)?.close();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcs.current.set(peer, pc);
    s.getTracks().forEach((t) => pc.addTrack(t, s));
    pc.onicecandidate = (e) => { if (e.candidate) send({ t: "signal", to: peer, data: { ice: e.candidate.toJSON() } }); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") pc.restartIce?.(); };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ t: "signal", to: peer, data: { sdp: pc.localDescription } });
  }, [send]);
  const onSignal = useCallback(async (from: string, data: any) => {
    const host = meRef.current?.role === "host";
    const key = host ? from : "host";
    if (data.sdp?.type === "offer" && !host) {
      pcs.current.get("host")?.close();
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcs.current.set("host", pc);
      pc.onicecandidate = (e) => { if (e.candidate) send({ t: "signal", data: { ice: e.candidate.toJSON() } }); };
      pc.ontrack = (e) => {
        const a = audioEl.current; const s = e.streams[0] ?? new MediaStream([e.track]);
        if (a) { a.srcObject = s; a.play().then(() => setHeard("yes"), () => setHeard("blocked")); }
        meter(s);
      };
      await pc.setRemoteDescription(data.sdp);
      for (const c of pending.current.get(key) ?? []) await pc.addIceCandidate(c).catch(() => {});
      pending.current.delete(key);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ t: "signal", data: { sdp: pc.localDescription } });
    } else if (data.sdp?.type === "answer" && host) {
      const pc = pcs.current.get(from); if (!pc) return;
      await pc.setRemoteDescription(data.sdp).catch(() => {});
      for (const c of pending.current.get(key) ?? []) await pc.addIceCandidate(c).catch(() => {});
      pending.current.delete(key);
    } else if (data.ice) {
      const pc = pcs.current.get(key);
      if (pc?.remoteDescription) await pc.addIceCandidate(data.ice).catch(() => {});
      else pending.current.set(key, [...(pending.current.get(key) ?? []), data.ice]);
    }
  }, [meter, send]);

  // ---- connect ----
  useEffect(() => {
    let closed = false; let stopMeter: (() => void) | undefined;
    (async () => {
      try {
        let ticket = firstTicket;
        let host = !!firstTicket;
        if (!ticket) { const b = await api(`/api/earshot/creators/live/${roomId}/ticket`, { method: "POST" }); ticket = b.ticket; host = !!b.host; }
        if (host && !stream.current) {
          try { stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
          catch { if (!closed) { setStatus("error"); setError("Pod+ needs your microphone to go live. Allow it in your browser's settings, then try again."); } return; }
          stopMeter = meter(stream.current);
        }
        if (closed) return;
        const w = new WebSocket(`${wsBase}/api/live/ws?ticket=${encodeURIComponent(ticket!)}`);
        ws.current = w;
        w.onmessage = (ev) => {
          let m: any; try { m = JSON.parse(String(ev.data)); } catch { return; }
          switch (m.t) {
            case "hello": setRoom({ title: m.room.title, topic: m.room.topic, host: m.room.host, startedAt: m.room.startedAt }); setMe(m.you); setChat(m.chat || []); setPinned(m.pinned); setStats((s) => ({ ...s, ...m.stats, listeners: m.room.listeners })); setStatus(m.you.role === "host" || m.room.live ? "live" : "waiting"); break;
            case "peer": void hostCall(m.id); break;
            case "leave": pcs.current.get(m.id)?.close(); pcs.current.delete(m.id); break;
            case "signal": void onSignal(m.from, m.data); break;
            case "audio": setMe((x) => (x ? { ...x, audio: !!m.on } : x)); break;
            case "msg": {
              const msg: LiveMsg = m.msg;
              if (msg.kind === "cheer") { const c = CHEERS.find((x) => x.id === msg.cheer); if (c) burst({ emoji: c.emoji, name: c.name, who: msg.who?.name || "Someone", big: c.points >= BIG_CHEER }); }
              setChat((l) => [...l.slice(-120), msg]);
              break;
            }
            case "room": setStats({ listeners: m.listeners, peak: m.peak, likes: m.likes, cheerPoints: m.cheerPoints }); for (let i = 0; i < Math.min(8, m.burst || 0); i++) setTimeout(floatHeart, i * 120); break;
            case "spent": setMe((x) => (x ? { ...x, spent: m.spent } : x)); break;
            case "pinned": setPinned(m.msg); break;
            case "removed": setChat((l) => l.filter((x) => x.id !== m.id)); break;
            case "muted": setChat((l) => l.filter((x) => x.who?.handle !== m.handle)); break;
            case "host": setStatus(m.here ? "live" : "waiting"); break;
            case "error": say(m.text); break;
            case "ended": setSummary(m.summary); setStatus("ended"); pcs.current.forEach((pc) => pc.close()); break;
          }
        };
        w.onclose = () => { if (!closed) setStatus((s) => (s === "ended" ? s : "ended")); };
        w.onerror = () => { if (!closed) { setStatus("error"); setError("The LivePod connection dropped. Check your connection and try again."); } };
      } catch (e: any) {
        if (!closed) { setStatus("error"); setError(e?.message || "This LivePod isn't available."); }
      }
    })();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const likes = setInterval(() => { if (likeQ.current) { send({ t: "like", n: likeQ.current }); likeQ.current = 0; } }, 600);
    return () => {
      closed = true; clearInterval(clock); clearInterval(likes); stopMeter?.();
      try { ws.current?.close(); } catch { /* gone */ }
      pcs.current.forEach((pc) => pc.close()); pcs.current.clear();
      stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => { const b = chatBox.current; if (b) b.scrollTop = b.scrollHeight; }, [chat.length]);
  useEffect(() => { stream.current?.getAudioTracks().forEach((t) => { t.enabled = micOn; }); }, [micOn]);

  const like = () => { likeQ.current++; floatHeart(); setStats((s) => ({ ...s, likes: s.likes + 1 })); };
  const post = () => { const t = text.trim(); if (!t) return; send({ t: "chat", text: t }); setText(""); };
  const share = () => {
    send({ t: "share" });
    const url = `${location.origin}${location.pathname}`;
    const msg = `${room?.host.name ?? "Someone"} is live on Pod+: ${room?.title ?? ""}`;
    if (navigator.share) void navigator.share({ title: room?.title || "LivePod", text: msg, url }).catch(() => {});
    else void navigator.clipboard?.writeText(`${msg} ${url}`).then(() => say("Link copied."), () => say(url));
  };
  const leave = () => { if (isHost && status !== "ended") { if (!window.confirm("End your LivePod for everyone?")) return; send({ t: "end" }); return; } onClose(); };
  const left = CHEER_BUDGET - (me?.spent ?? 0);
  const ring = 1 + level * 0.35;

  return <div className="fixed inset-0 z-[70] flex justify-center overflow-hidden bg-[#0b0a0d] text-white" role="dialog" aria-label={room ? `LivePod: ${room.title}` : "LivePod"}>
    <audio ref={audioEl} autoPlay playsInline />
    <style>{`@keyframes lpFloat{0%{transform:translate(0,0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translate(var(--x),-260px) scale(1.15);opacity:0}}
@keyframes lpIn{0%{transform:translateX(-30px);opacity:0}12%,80%{transform:none;opacity:1}100%{transform:translateY(-10px);opacity:0}}
@keyframes lpBig{0%{transform:scale(.3);opacity:0}18%{transform:scale(1.12);opacity:1}30%,78%{transform:scale(1)}100%{transform:scale(1.3);opacity:0}}
@keyframes lpBlob{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(6%,-5%) scale(1.15)}}
@media (prefers-reduced-motion:reduce){.lp-m{animation:none!important}}`}</style>
    {/* Moving color behind everything, from the host's own color */}
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="lp-m absolute -left-1/4 -top-1/4 h-[80%] w-[80%] rounded-full opacity-55 blur-[90px]" style={{ background: `hsl(${hue} 70% 45%)`, animation: "lpBlob 14s ease-in-out infinite" }} />
      <div className="lp-m absolute -bottom-1/4 -right-1/4 h-[75%] w-[75%] rounded-full opacity-45 blur-[90px]" style={{ background: `hsl(${(hue + 50) % 360} 75% 42%)`, animation: "lpBlob 18s ease-in-out infinite reverse" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/80" />
    </div>

    <div className="relative flex h-full w-full max-w-[560px] flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))]">
      {/* Top bar */}
      <div className="flex items-center gap-2.5">
        {room ? <button type="button" onClick={() => room && onPerson?.(room.host.handle)} className="flex min-w-0 items-center gap-2.5 rounded-full bg-black/30 py-1 pl-1 pr-3 backdrop-blur">
          <Avatar p={room.host} size={34} /><span className="min-w-0 text-left leading-tight"><b className="block truncate text-[14px]">{room.host.name}</b><span className="block truncate text-[11.5px] text-white/65">@{room.host.handle}</span></span></button>
          : <span className="h-11 w-40 animate-pulse rounded-full bg-white/10" />}
        <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-extrabold uppercase tracking-wider text-[#111013]" style={{ background: ACCENT }}>{status === "live" ? <><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#111013]" />Live</> : status === "waiting" ? "Paused" : status === "ended" ? "Ended" : "…"}</span>
        <span className="flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-[12px] font-bold tabular-nums backdrop-blur"><Users size={13} />{compact(stats.listeners)}</span>
        <button type="button" onClick={leave} aria-label={isHost ? "End LivePod" : "Leave"} className={`ml-auto grid h-10 place-items-center rounded-full bg-black/35 backdrop-blur ${isHost && status !== "ended" ? "px-4 text-[13px] font-bold" : "w-10"}`}>{isHost && status !== "ended" ? "End" : <X size={20} />}</button>
      </div>

      {status === "error" ? <div className="flex flex-1 flex-col items-center justify-center text-center">
        <MicOff size={40} className="text-white/60" /><p className="mt-3 max-w-xs text-[15px] text-white/80">{error}</p>
        <button type="button" onClick={onClose} className="mt-5 min-h-11 rounded-full bg-white px-6 font-semibold text-[#111013]">Close</button>
      </div> : status === "ended" ? <div className="flex flex-1 flex-col items-center justify-center text-center">
        {room && <Avatar p={room.host} size={84} />}
        <p className="mt-4 text-[13px] font-extrabold uppercase tracking-[.14em] text-white/60">LivePod ended</p>
        <h2 className="mt-1 max-w-sm text-[24px] font-extrabold leading-tight">{summary?.title || room?.title || ""}</h2>
        {summary && <div className="mt-5 grid w-full max-w-sm grid-cols-3 gap-2">{([["Minutes", summary.minutes], ["Peak", summary.peak], ["Listeners", summary.listeners], ["Comments", summary.comments], ["Cheer points", summary.cheerPoints], ["Likes", summary.likes]] as const).map(([l, n]) => <div key={l} className="rounded-2xl bg-white/10 p-3 backdrop-blur"><b className="block text-[20px] tabular-nums">{compact(n)}</b><span className="text-[11.5px] text-white/65">{l}</span></div>)}</div>}
        <button type="button" onClick={onClose} className="mt-6 min-h-11 rounded-full bg-white px-6 font-semibold text-[#111013]">Done</button>
      </div> : <>
        {/* The host, glowing with their voice */}
        <div className="flex flex-col items-center pt-6 text-center">
          <div className="relative grid place-items-center" style={{ width: 190, height: 190 }}>
            {[0, 1, 2].map((i) => <span key={i} aria-hidden className="absolute inset-0 rounded-full border-2 transition-transform duration-100" style={{ borderColor: `hsla(${hue},90%,75%,${0.45 - i * 0.13})`, transform: `scale(${0.72 + i * 0.13 + level * (0.2 + i * 0.12)})` }} />)}
            <div className="relative transition-transform duration-100" style={{ transform: `scale(${ring})` }}>{room ? <Avatar p={room.host} size={128} /> : <span className="block h-32 w-32 rounded-full bg-white/10" />}</div>
            {isHost && !micOn && <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-rose-500"><MicOff size={17} /></span>}
          </div>
          <h2 className="mt-3 line-clamp-2 max-w-md px-4 text-[21px] font-extrabold leading-tight tracking-tight">{room?.title ?? ""}</h2>
          <p className="mt-1.5 flex items-center gap-2 text-[12.5px] text-white/65">{room && <span className="rounded-full bg-white/12 px-2 py-0.5 font-semibold" style={{ background: "rgba(255,255,255,.12)" }}>{room.topic}</span>}<span className="tabular-nums">{room ? liveClock(now - room.startedAt) : ""}</span>{isHost && <span>· peak {stats.peak} · {compact(stats.cheerPoints)} Cheer points</span>}</p>
          {status === "waiting" && <p className="mt-3 rounded-full bg-black/35 px-4 py-1.5 text-[13px] text-white/80">The host stepped away. Stay here; they'll be right back.</p>}
          {!isHost && me && !me.audio && <p className="mt-3 max-w-xs rounded-2xl bg-black/35 px-4 py-2 text-[13px] text-white/80">This LivePod is full for audio right now. You can still read and comment, and you'll hear it when a place opens.</p>}
          {!isHost && heard === "blocked" && <button type="button" onClick={() => audioEl.current?.play().then(() => setHeard("yes"), () => {})} className="mt-3 flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-semibold text-[#111013]"><Headphones size={16} />Tap to hear</button>}
          {!isHost && me?.audio && heard === "no" && status === "live" && <p className="mt-3 flex items-center gap-2 text-[13px] text-white/65"><Loader2 size={14} className="animate-spin" />Tuning in…</p>}
        </div>

        {/* Cheers and hearts in the air */}
        <div aria-hidden className="pointer-events-none absolute bottom-28 right-6 h-0 w-10">{hearts.map((h) => <Heart key={h.id} size={26} className="lp-m absolute bottom-0" style={{ color: `hsl(${h.hue} 90% 62%)`, fill: `hsl(${h.hue} 90% 62%)`, animation: "lpFloat 2.2s ease-out forwards", ["--x" as any]: `${h.x}px` }} />)}</div>
        <div className="pointer-events-none absolute left-4 top-[38%] z-10 flex flex-col gap-2">{bursts.filter((b) => !b.big).map((b) => <div key={b.id} className="lp-m flex items-center gap-2 rounded-full bg-black/45 py-1 pl-1 pr-3 backdrop-blur" style={{ animation: "lpIn 2.6s ease-out forwards" }}>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-[20px]">{b.emoji}</span><span className="text-[13px] leading-tight"><b className="block">{b.who}</b><span className="text-white/70">sent {b.name}</span></span></div>)}</div>
        {bursts.filter((b) => b.big).slice(-1).map((b) => <div key={b.id} aria-live="polite" className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <div className="lp-m text-center" style={{ animation: "lpBig 3.2s ease-out forwards" }}><div className="text-[110px] leading-none drop-shadow-[0_10px_40px_rgba(0,0,0,.6)]">{b.emoji}</div><p className="mt-2 text-[20px] font-extrabold drop-shadow">{b.who}</p><p className="text-[15px] text-white/85">sent a {b.name}!</p></div>
        </div>)}

        {/* Chat */}
        <div className="mt-auto">
          {pinned && <div className="mb-2 flex items-start gap-2 rounded-2xl bg-white/15 p-2.5 backdrop-blur" style={{ background: "rgba(255,255,255,.14)" }}><Pin size={14} className="mt-0.5 flex-none" style={{ color: ACCENT }} /><p className="min-w-0 flex-1 text-[13.5px] leading-snug"><b>{pinned.who?.name}</b> {pinned.text}</p>{isHost && <button type="button" onClick={() => send({ t: "pin", id: null })} aria-label="Unpin" className="text-white/60"><X size={15} /></button>}</div>}
          <div ref={chatBox} className="flex max-h-[30vh] flex-col gap-1.5 overflow-y-auto pb-2 [mask-image:linear-gradient(180deg,transparent,#000_22%)] [scrollbar-width:none]" aria-live="polite">
            {chat.filter((m) => m.kind !== "join" || chat.length < 60).slice(-60).map((m) => m.kind === "join" ? <p key={m.id} className="text-[12px] text-white/50">{m.who?.name} joined</p>
              : <button type="button" key={m.id} disabled={!isHost || m.kind !== "chat"} onClick={() => setMenu(m)} className="flex max-w-[92%] items-start gap-2 text-left">
                <span className="text-[13.5px] leading-snug"><b className={m.kind === "cheer" ? "" : "text-white/75"} style={m.kind === "cheer" ? { color: ACCENT } : undefined}>{m.who?.name}</b>{" "}
                  {m.kind === "cheer" ? <span className="font-semibold">{m.text} {CHEERS.find((c) => c.id === m.cheer)?.emoji}</span> : <span className="text-white/95">{m.text}</span>}</span>
              </button>)}
          </div>

          {/* Bottom bar */}
          <div className="flex items-center gap-2">
            {(me?.canChat || isHost) ? <div className="flex min-h-11 min-w-0 flex-1 items-center rounded-full bg-white/12 pl-4 pr-1 backdrop-blur" style={{ background: "rgba(255,255,255,.13)" }}>
              <input value={text} maxLength={LIVE_CHAT_MAX} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") post(); }} placeholder={isHost ? "Talk to your listeners…" : "Say something…"} aria-label="Comment" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-white/50" />
              {text.trim() && <button type="button" onClick={post} aria-label="Send" className="grid h-9 w-9 place-items-center rounded-full" style={{ background: ACCENT, color: "#111013" }}><Send size={15} /></button>}
            </div> : <p className="flex-1 text-[12.5px] text-white/60">Make a profile in Social to comment and send Cheers.</p>}
            {isHost ? <button type="button" onClick={() => setMicOn((m) => !m)} aria-label={micOn ? "Mute your mic" : "Unmute your mic"} aria-pressed={!micOn} className={`grid h-11 w-11 flex-none place-items-center rounded-full ${micOn ? "bg-white text-[#111013]" : "bg-rose-500"}`}>{micOn ? <Mic size={19} /> : <MicOff size={19} />}</button>
              : me?.canChat && <button type="button" onClick={() => setCheering(true)} aria-label="Send a Cheer" className="grid h-11 w-11 flex-none place-items-center rounded-full text-[#111013]" style={{ background: `linear-gradient(135deg,${ACCENT},#e8467c)` }}><PartyPopper size={19} /></button>}
            <button type="button" onClick={share} aria-label="Share" className="grid h-11 w-11 flex-none place-items-center rounded-full bg-white/12" style={{ background: "rgba(255,255,255,.13)" }}><Share2 size={18} /></button>
            {!isHost && <button type="button" onClick={like} aria-label="Like" className="grid h-11 w-11 flex-none place-items-center rounded-full bg-white/12 active:scale-90" style={{ background: "rgba(255,255,255,.13)" }}><Heart size={19} className="fill-rose-500 text-rose-500" /></button>}
          </div>
        </div>
      </>}
    </div>

    {/* Cheers */}
    {cheering && <div className="absolute inset-0 z-30 flex items-end bg-black/55" onClick={() => setCheering(false)}>
      <div onClick={(e) => e.stopPropagation()} className="mx-auto w-full max-w-[560px] rounded-t-3xl bg-[#17151b] p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between"><h3 className="text-[18px] font-extrabold">Send a Cheer</h3><button type="button" onClick={() => setCheering(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><X size={18} /></button></div>
        <p className="mt-1 text-[13px] text-white/60">Cheers are free. You have <b className="text-white">{left}</b> of {CHEER_BUDGET} Cheer points left in this LivePod.</p>
        <div className="mt-4 grid grid-cols-3 gap-2">{CHEERS.map((c) => <button key={c.id} type="button" disabled={c.points > left} onClick={() => { send({ t: "cheer", id: c.id }); setCheering(false); }} className="flex flex-col items-center rounded-2xl bg-white/[.06] px-2 py-3 transition hover:bg-white/10 disabled:opacity-30">
          <span className="text-[34px] leading-none">{c.emoji}</span><b className="mt-1.5 text-[13px]">{c.name}</b><span className="text-[11.5px] text-white/55">{c.points} pt{c.points === 1 ? "" : "s"}</span></button>)}</div>
      </div>
    </div>}

    {/* Host: what to do with a comment */}
    {menu && <div className="absolute inset-0 z-30 flex items-end bg-black/55" onClick={() => setMenu(null)}>
      <div onClick={(e) => e.stopPropagation()} className="mx-auto w-full max-w-[560px] rounded-t-3xl bg-[#17151b] p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p className="text-[14px] text-white/70"><b className="text-white">{menu.who?.name}</b> {menu.text}</p>
        <div className="mt-3 flex flex-col gap-2">
          <button type="button" onClick={() => { send({ t: "pin", id: menu.id }); setMenu(null); }} className="flex min-h-12 items-center gap-3 rounded-2xl bg-white/[.06] px-4 font-semibold"><Pin size={17} />Pin for everyone</button>
          <button type="button" onClick={() => { send({ t: "remove", id: menu.id }); setMenu(null); }} className="flex min-h-12 items-center gap-3 rounded-2xl bg-white/[.06] px-4 font-semibold"><Trash2 size={17} />Remove comment</button>
          <button type="button" onClick={() => { send({ t: "mute", handle: menu.who?.handle }); setMenu(null); }} className="flex min-h-12 items-center gap-3 rounded-2xl bg-white/[.06] px-4 font-semibold text-rose-300"><VolumeX size={17} />Turn off @{menu.who?.handle}'s comments</button>
        </div>
      </div>
    </div>}
  </div>;
}

/** The little "Live" chip for the top bar: who's live right now. */
export function LiveChip({ live, light, onClick }: { live: LiveSummary[]; light: boolean; onClick: () => void }) {
  const faces = useMemo(() => live.slice(0, 3), [live]);
  if (!live.length) return null;
  return <button type="button" onClick={onClick} aria-label={`${live.length} LivePod${live.length === 1 ? "" : "s"} on now`} className={`flex h-9 items-center gap-1.5 rounded-full pl-1 pr-2.5 text-xs font-extrabold backdrop-blur ${light ? "bg-black/[.05] text-[#0f1419]" : "bg-black/45"}`}>
    <span className="flex -space-x-2">{faces.map((r) => <span key={r.id} className="rounded-full ring-2" style={{ ["--tw-ring-color" as any]: ACCENT }}><Avatar p={r.host} size={26} /></span>)}</span>
    <LiveDot className="ml-1" />LIVE
  </button>;
}
