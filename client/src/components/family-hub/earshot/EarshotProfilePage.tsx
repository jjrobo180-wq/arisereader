// Pod+ profile pages, MySpace style but minimal: your page, your way. A background (color, gradient,
// pattern or photo), a banner, accent color, font, card style and corners, a profile song, a mood,
// and widgets you add, move between the two columns, reorder and fill in: Top 8 shows, Top 8
// friends, guestbook, quote, links, photo, text, interests, latest posts, clips and your podcast.
// The page format and its safety rules live in shared/earshotPage.ts (the server cleans every save).
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, ChevronLeft, Columns2, ExternalLink, Image as ImageIcon, Loader2, Music2, Paintbrush, Pause, Pencil, Play, Plus, Quote, Search, Send, Trash2, Upload, UserPlus, X } from "lucide-react";
import { hiRes } from "@shared/earshot";
import {
  FONTS, MOODS, PATTERNS, PHOTO_BGS, PRESETS, WIDGETS, bgCss, cardInk, cleanPage, defaultPage, newWidgetId, pageInk, safeUrl,
  type GuestEntry, type PageBg, type PageEpisode, type PageShow, type ProfilePageData, type Widget, type WidgetType,
} from "@shared/earshotPage";
import { Avatar, ago, artOf, toEpisode, toShow, type Ctx, type Post, type Profile } from "./EarshotSocial";

export type PageData = { profile: Profile; me: boolean; followers: number; following: number; followed: boolean; posts: Post[]; page?: ProfilePageData | null; guestbook?: GuestEntry[]; friends?: Profile[] };

const alpha = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K` : String(n));
const widgetName = (t: WidgetType) => WIDGETS.find((w) => w.type === t)?.name ?? t;

/** The look every card on the page shares. */
function useLook(page: ProfilePageData) {
  return useMemo(() => {
    const ink = pageInk(page), cInk = cardInk(page);
    const lightInk = cInk === "#ffffff";
    const card: CSSProperties = page.card === "solid" ? { background: page.cardColor, color: cInk }
      : page.card === "glass" ? { background: lightInk ? "rgba(10,10,14,.42)" : "rgba(255,255,255,.62)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", color: cInk }
      : page.card === "outline" ? { border: `1px solid ${alpha(cInk, 0.28)}`, color: cInk }
      : { color: cInk };
    return { ink, cInk, card: { ...card, borderRadius: page.radius }, sub: alpha(cInk, 0.68), line: alpha(cInk, 0.14), soft: alpha(cInk, lightInk ? 0.1 : 0.06), font: FONTS[page.font] };
  }, [page]);
}

// ===========================================================================
// The page
// ===========================================================================
export function ProfileSpace({ data, page, ctx, onBack, onFollow, onEditProfile, onCustomize, onGuestbook, editing }: {
  data: PageData; page: ProfilePageData; ctx: Ctx; onBack: () => void; onFollow: () => void; onEditProfile: () => void; onCustomize: () => void;
  onGuestbook: (list: GuestEntry[]) => void; editing?: boolean;
}) {
  const look = useLook(page);
  const side = page.widgets.filter((w) => w.col === "side"), main = page.widgets.filter((w) => w.col === "main");
  const banner = page.banner;
  const bannerStyle: CSSProperties = banner.kind === "image" ? { backgroundImage: `url("${banner.image.replace(/"/g, "%22")}")`, backgroundSize: "cover", backgroundPosition: "center" }
    : banner.kind === "color" ? { background: banner.color2 ? `linear-gradient(120deg, ${banner.color}, ${banner.color2})` : banner.color } : {};
  const render = (w: Widget) => <WidgetCard key={w.id} w={w} page={page} look={look} data={data} ctx={ctx} onGuestbook={onGuestbook} />;
  return <div className={`ps-dark absolute inset-0 z-40 overflow-y-auto [scrollbar-width:none] ${editing ? "pb-[64vh] md:pb-24 md:pr-[400px]" : "pb-24"}`} role="dialog" aria-label={`${data.profile.name}'s page`}
    style={{ ...bgCss(page.bg), color: look.ink, fontFamily: look.font.stack }}>
    <div className="mx-auto w-full max-w-5xl">
      <div className={`relative ${banner.kind === "none" ? "h-16" : "h-36 sm:h-48"}`} style={bannerStyle}>
        <button type="button" onClick={onBack} aria-label="Back" className="absolute left-3 top-[max(.75rem,env(safe-area-inset-top))] grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur"><ChevronLeft size={22} /></button>
      </div>
      <header className="px-4 sm:px-6">
        <div className={`flex flex-wrap items-end justify-between gap-3 ${banner.kind === "none" ? "" : "-mt-12"}`}>
          <span className="rounded-full p-1" style={{ background: page.accent }}><Avatar p={data.profile} size={96} /></span>
          <div className="flex flex-wrap gap-2 pb-1">
            {data.me ? <>
              <button type="button" onClick={onEditProfile} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold" style={{ ...look.card, borderRadius: 999 }}><Pencil size={15} />Name & bio</button>
              <button type="button" onClick={onCustomize} aria-pressed={editing} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold" style={{ background: page.accent, color: pageInkOn(page.accent) }}><Paintbrush size={15} />Customize page</button>
            </> : <button type="button" onClick={onFollow} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-5 text-sm font-bold" style={data.followed ? { ...look.card, borderRadius: 999 } : { background: page.accent, color: pageInkOn(page.accent) }}>{data.followed ? <><Check size={15} />Following</> : <><UserPlus size={15} />Follow</>}</button>}
          </div>
        </div>
        <h1 className="mt-3 text-[28px] leading-tight sm:text-[34px]" style={{ fontWeight: look.font.weight }}>{data.profile.name}</h1>
        <p className="text-[15px]" style={{ color: alpha(look.ink, 0.7) }}>@{data.profile.handle}{page.mood.text || page.mood.emoji ? <> · <span aria-label="Mood">{page.mood.emoji} {page.mood.text}</span></> : null}</p>
      </header>
      <div className={`mt-5 grid gap-4 px-4 sm:px-6 ${page.layout === "two" ? "md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" : ""}`}>
        {page.layout === "two" ? <>
          <div className="flex min-w-0 flex-col gap-4">{side.map(render)}</div>
          <div className="flex min-w-0 flex-col gap-4">{main.map(render)}</div>
        </> : <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-4">{page.widgets.map(render)}</div>}
      </div>
      {!page.widgets.length && <p className="px-6 py-16 text-center" style={{ color: alpha(look.ink, 0.7) }}>{data.me ? "Your page is empty. Tap Customize page to add widgets." : "Nothing here yet."}</p>}
    </div>
  </div>;
}
const pageInkOn = (hex: string) => { const n = parseInt(hex.slice(1), 16); const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return l > 0.6 ? "#111111" : "#ffffff"; };

type Look = ReturnType<typeof useLook>;
function WidgetCard({ w, page, look, data, ctx, onGuestbook }: { w: Widget; page: ProfilePageData; look: Look; data: PageData; ctx: Ctx; onGuestbook: (l: GuestEntry[]) => void }) {
  const title = w.title || (w.type === "about" ? `About ${data.profile.name.split(" ")[0]}` : w.type === "friends" ? `${data.profile.name.split(" ")[0]}'s Top 8` : widgetName(w.type));
  const body = <WidgetBody w={w} page={page} look={look} data={data} ctx={ctx} onGuestbook={onGuestbook} />;
  return <section className="min-w-0 overflow-hidden p-4 sm:p-5" style={look.card} aria-label={title}>
    <h2 className="mb-3 flex items-center gap-2 text-[13px] uppercase tracking-[.14em]" style={{ color: page.accent, fontWeight: 800 }}><span className="h-3 w-1 rounded-full" style={{ background: page.accent }} />{title}</h2>
    {body}
  </section>;
}

function WidgetBody({ w, page, look, data, ctx, onGuestbook }: { w: Widget; page: ProfilePageData; look: Look; data: PageData; ctx: Ctx; onGuestbook: (l: GuestEntry[]) => void }) {
  const posts = data.posts.filter((p) => p.kind !== "bookmark");
  const empty = (t: string) => <p className="text-sm" style={{ color: look.sub }}>{t}</p>;
  const playShow = (s: PageShow) => ctx.api(`/api/earshot/show/${s.id}?x=1`).then((b) => { const e = (b.episodes || [])[0]; if (e) ctx.onPlay({ id: s.id, name: s.name, author: s.author || "", art: s.art, genre: "culture", appleGenre: "", link: "", episodes: 0, explicit: false, latest: "" }, { ...e, art: e.art || s.art }); else ctx.say("No episodes to play yet."); }).catch((e) => ctx.say(e.message));
  switch (w.type) {
    case "about": return data.profile.bio || w.text ? <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{w.text || data.profile.bio}</p> : empty(data.me ? "Add a bio with Name & bio." : "No bio yet.");
    case "mood": return <div className="flex items-center gap-3"><span className="text-4xl" aria-hidden="true">{page.mood.emoji}</span><span><span className="block text-xs uppercase tracking-widest" style={{ color: look.sub }}>Mood</span><b className="text-[15px]">{page.mood.text || "Listening"}</b></span></div>;
    case "song": return page.song ? <SongPlayer song={page.song} look={look} accent={page.accent} ctx={ctx} /> : empty(data.me ? "Pick a profile song in Customize page → Profile." : "No profile song.");
    case "stats": return <dl className="grid grid-cols-3 gap-2 text-center">{([["Followers", data.followers], ["Following", data.following], ["Posts", posts.length]] as const).map(([l, n]) => <div key={l} className="rounded-xl py-2" style={{ background: look.soft }}><dt className="text-[11px] uppercase tracking-wider" style={{ color: look.sub }}>{l}</dt><dd className="text-xl font-bold">{compact(n)}</dd></div>)}</dl>;
    case "top8": return w.shows?.length ? <div className="grid grid-cols-4 gap-2.5">{w.shows.map((s, i) => <button key={s.id} type="button" onClick={() => playShow(s)} className="group min-w-0 text-left" aria-label={`Play ${s.name}`}>
      <span className="relative block"><img src={hiRes(s.art, 300)} alt="" referrerPolicy="no-referrer" loading="lazy" className="aspect-square w-full object-cover transition group-hover:opacity-85" style={{ borderRadius: Math.max(4, page.radius - 6) }} /><span className="absolute left-1 top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold" style={{ background: page.accent, color: pageInkOn(page.accent) }}>{i + 1}</span></span>
      <span className="mt-1 line-clamp-2 block text-[12px] leading-tight">{s.name}</span></button>)}</div> : empty(data.me ? "Pick your 8 favorite shows in Customize page → Widgets." : "No favorites picked yet.");
    case "friends": return data.friends?.length ? <div className="grid grid-cols-4 gap-3">{data.friends.map((f) => <button key={f.handle} type="button" onClick={() => ctx.person(f.handle)} className="flex min-w-0 flex-col items-center gap-1.5 text-center"><Avatar p={f} size={56} /><span className="w-full truncate text-[12px] font-semibold">{f.name}</span></button>)}</div> : empty(data.me ? "Pick your Top 8 people in Customize page → Widgets." : "No Top 8 yet.");
    case "interests": return w.tags?.length ? <div className="flex flex-wrap gap-1.5">{w.tags.map((t) => <span key={t} className="rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: alpha(page.accent, 0.18), color: look.cInk, boxShadow: `inset 0 0 0 1px ${alpha(page.accent, 0.45)}` }}>{t}</span>)}</div> : empty("No interests added yet.");
    case "quote": return w.text ? <figure><Quote size={22} style={{ color: page.accent }} /><blockquote className="mt-1 text-[19px] leading-snug" style={{ fontWeight: 600 }}>{w.text}</blockquote>{w.by && <figcaption className="mt-2 text-sm" style={{ color: look.sub }}>— {w.by}</figcaption>}</figure> : empty("No quote yet.");
    case "links": return w.links?.length ? <ul className="flex flex-col gap-1.5">{w.links.map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 text-[15px] font-semibold" style={{ background: look.soft }}>{l.label || new URL(l.url).hostname}<ExternalLink size={15} style={{ color: look.sub }} /></a></li>)}</ul> : empty("No links yet.");
    case "text": return w.text ? <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{w.text}</p> : empty("Empty text box.");
    case "photo": return w.image ? <figure><img src={w.image} alt={w.text || ""} referrerPolicy="no-referrer" loading="lazy" className="w-full object-cover" style={{ borderRadius: Math.max(4, page.radius - 6) }} />{w.text && <figcaption className="mt-2 text-sm" style={{ color: look.sub }}>{w.text}</figcaption>}</figure> : empty("No photo yet.");
    case "posts": {
      const list = posts.filter((p) => p.kind !== "clip" && p.kind !== "own").slice(0, w.count ?? 5);
      return list.length ? <ul className="flex flex-col divide-y" style={{ borderColor: look.line }}>{list.map((p) => <li key={p.id} style={{ borderColor: look.line }}><button type="button" onClick={() => ctx.comments(p)} className="flex w-full gap-3 py-2.5 text-left">
        {(p.episode || p.repost?.episode) && <img src={hiRes(artOf(p.episode || p.repost!.episode!), 120)} alt="" referrerPolicy="no-referrer" className="h-12 w-12 flex-none rounded-lg object-cover" />}
        <span className="min-w-0 flex-1"><span className="line-clamp-2 block text-[15px]">{p.caption || p.repost?.caption || p.episode?.title || p.repost?.episode?.title || "Shared an episode"}</span><span className="text-xs" style={{ color: look.sub }}>{ago(p.at)} · {p.likes} likes · {p.comments} replies</span></span>
      </button></li>)}</ul> : empty("No posts yet.");
    }
    case "clips": case "podcast": {
      const list = posts.filter((p) => p.kind === (w.type === "clips" ? "clip" : "own") && p.episode).slice(0, w.count ?? 5);
      return list.length ? <ul className="flex flex-col gap-2">{list.map((p) => <li key={p.id}><button type="button" onClick={() => ctx.onPlay(toShow(p.episode!, data.profile.name), toEpisode(p.episode!, data.profile.name), p.clip?.s)} className="grid w-full grid-cols-[52px_1fr_auto] items-center gap-3 rounded-xl p-2 text-left" style={{ background: look.soft }}>
        <img src={hiRes(artOf(p.episode!), 120)} alt="" referrerPolicy="no-referrer" className="h-[52px] w-[52px] rounded-lg object-cover" />
        <span className="min-w-0"><b className="line-clamp-1 block text-[14px]">{w.type === "clips" && p.clip?.quote ? `“${p.clip.quote}”` : p.episode!.title}</b><span className="line-clamp-1 block text-xs" style={{ color: look.sub }}>{p.episode!.show}</span></span>
        <Play size={18} style={{ color: page.accent }} />
      </button></li>)}</ul> : empty(w.type === "clips" ? "No clips yet." : "No episodes yet.");
    }
    case "guestbook": return <Guestbook data={data} look={look} accent={page.accent} ctx={ctx} onChange={onGuestbook} />;
  }
}

function SongPlayer({ song, look, accent, ctx }: { song: PageEpisode; look: Look; accent: string; ctx: Ctx }) {
  const [on, setOn] = useState(false);
  const el = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { el.current?.pause(); }, []);
  const toggle = () => {
    if (!el.current) { el.current = new Audio(song.audio); el.current.onended = () => setOn(false); }
    if (on) { el.current.pause(); setOn(false); } else { void el.current.play().then(() => setOn(true)).catch(() => ctx.say("That episode can't play right now.")); }
  };
  return <div className="flex items-center gap-3">
    <img src={hiRes(song.art, 160)} alt="" referrerPolicy="no-referrer" className="h-16 w-16 flex-none rounded-xl object-cover" />
    <span className="min-w-0 flex-1"><b className="line-clamp-2 block text-[14px] leading-tight">{song.title}</b><span className="line-clamp-1 block text-xs" style={{ color: look.sub }}>{song.show}</span>
      <button type="button" onClick={() => { el.current?.pause(); setOn(false); ctx.onPlay(toShow(song as any), toEpisode(song as any)); }} className="mt-1 text-xs font-semibold underline" style={{ color: look.sub }}>Open full episode</button></span>
    <button type="button" onClick={toggle} aria-label={on ? "Pause profile song" : "Play profile song"} className="grid h-12 w-12 flex-none place-items-center rounded-full" style={{ background: accent, color: pageInkOn(accent) }}>{on ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}</button>
  </div>;
}

function Guestbook({ data, look, accent, ctx, onChange }: { data: PageData; look: Look; accent: string; ctx: Ctx; onChange: (l: GuestEntry[]) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const list = data.guestbook ?? [];
  const sign = () => {
    if (!ctx.me) return ctx.needProfile();
    const body = text.trim(); if (!body) return;
    setBusy(true);
    ctx.api(`/api/earshot/social/u/${data.profile.handle}/guestbook`, { method: "POST", body: { body } }).then((b) => { onChange(b.guestbook || []); setText(""); ctx.say("Signed. Thanks!"); }).catch((e) => ctx.say(e.message)).finally(() => setBusy(false));
  };
  const remove = (g: GuestEntry) => ctx.api(`/api/earshot/social/u/${data.profile.handle}/guestbook/${g.id}`, { method: "DELETE" }).then((b) => onChange(b.guestbook || [])).catch((e) => ctx.say(e.message));
  return <div>
    {!data.me && <form onSubmit={(e) => { e.preventDefault(); sign(); }} className="mb-3 flex gap-2">
      <label htmlFor={`gb-${data.profile.handle}`} className="sr-only">Leave a note</label>
      <input id={`gb-${data.profile.handle}`} value={text} onChange={(e) => setText(e.target.value.slice(0, 280))} placeholder={`Leave ${data.profile.name.split(" ")[0]} a note`} className="min-h-11 min-w-0 flex-1 rounded-xl px-3 text-[15px] outline-none" style={{ background: look.soft, color: look.cInk, boxShadow: `inset 0 0 0 1px ${look.line}` }} />
      <button type="submit" disabled={busy || !text.trim()} aria-label="Sign guestbook" className="grid h-11 w-11 flex-none place-items-center rounded-xl disabled:opacity-40" style={{ background: accent, color: pageInkOn(accent) }}>{busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}</button>
    </form>}
    {!list.length ? <p className="text-sm" style={{ color: look.sub }}>{data.me ? "When people sign your guestbook, their notes show up here." : "Be the first to sign."}</p>
      : <ul className="flex flex-col gap-3">{list.map((g) => <li key={g.id} className="flex gap-3">
        <button type="button" onClick={() => ctx.person(g.handle)} aria-label={`@${g.handle}`}><Avatar p={{ handle: g.handle, name: g.name, bio: "", avatar: g.avatar }} size={38} /></button>
        <div className="min-w-0 flex-1"><p className="text-sm"><b>{g.name}</b> <span style={{ color: look.sub }}>· {ago(g.at)}</span></p><p className="whitespace-pre-wrap break-words text-[15px]">{g.body}</p></div>
        {(data.me || ctx.me?.handle === g.handle) && <button type="button" onClick={() => remove(g)} aria-label="Remove note" className="grid h-9 w-9 flex-none place-items-center rounded-full" style={{ color: look.sub }}><Trash2 size={15} /></button>}
      </li>)}</ul>}
  </div>;
}

// ===========================================================================
// The editor
// ===========================================================================
type Tab = "themes" | "background" | "style" | "widgets" | "profile";
const TABS: [Tab, string][] = [["themes", "Themes"], ["background", "Background"], ["style", "Style"], ["widgets", "Widgets"], ["profile", "Profile"]];
const panel = "ps-dark";
const fieldCls = "min-h-11 w-full rounded-xl border border-white/15 bg-white/[.06] px-3 text-[15px] text-white outline-none placeholder:text-white/40 focus:border-[#ff8a3d]";
const chip = (on: boolean) => `min-h-10 rounded-full px-3.5 text-sm font-semibold ${on ? "bg-white text-[#111]" : "bg-white/10 text-white hover:bg-white/15"}`;

export function PageEditor({ page, setPage, ctx, saving, onSave, onCancel, onEditProfile }: { page: ProfilePageData; setPage: (p: ProfilePageData) => void; ctx: Ctx; saving: boolean; onSave: () => void; onCancel: () => void; onEditProfile: () => void }) {
  const [tab, setTab] = useState<Tab>("themes");
  const set = (patch: Partial<ProfilePageData>) => setPage({ ...page, ...patch });
  return <div className={`${panel} absolute inset-x-0 bottom-14 z-[46] flex max-h-[60%] flex-col rounded-t-3xl bg-[#111214] text-white shadow-[0_-12px_40px_rgba(0,0,0,.5)] md:left-auto md:right-0 md:top-0 md:max-h-none md:w-[400px] md:rounded-none md:rounded-l-3xl`} role="dialog" aria-label="Customize your page">
    <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
      <Paintbrush size={18} className="text-[#ff8a3d]" /><b className="text-[16px]">Customize your page</b>
      <span className="flex-1" />
      <button type="button" onClick={onCancel} className="min-h-10 rounded-full px-3 text-sm font-semibold text-white/70 hover:bg-white/10">Cancel</button>
      <button type="button" onClick={onSave} disabled={saving} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#ff8a3d] px-4 text-sm font-bold text-[#111] disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}Save</button>
    </div>
    <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 py-2 [scrollbar-width:none]" role="tablist">
      {TABS.map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={chip(tab === v)}>{l}</button>)}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-3">
      {tab === "themes" && <ThemesTab page={page} setPage={setPage} />}
      {tab === "background" && <BackgroundTab page={page} set={set} ctx={ctx} />}
      {tab === "style" && <StyleTab page={page} set={set} />}
      {tab === "widgets" && <WidgetsTab page={page} set={set} ctx={ctx} />}
      {tab === "profile" && <ProfileTab page={page} set={set} ctx={ctx} onEditProfile={onEditProfile} />}
    </div>
  </div>;
}

const Label = ({ children }: { children: ReactNode }) => <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-[.14em] text-white/55 first:mt-0">{children}</p>;
const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => <label className="flex min-h-11 items-center gap-3 rounded-xl bg-white/[.06] px-3">
  <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" aria-label={label} />
  <span className="flex-1 text-[15px]">{label}</span><span className="font-mono text-xs text-white/50">{value}</span></label>;
const Slider = ({ label, value, min, max, onChange, unit = "" }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit?: string }) => <label className="block rounded-xl bg-white/[.06] px-3 py-2.5">
  <span className="flex justify-between text-[15px]"><span>{label}</span><span className="text-white/55">{value}{unit}</span></span>
  <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1.5 w-full accent-[#ff8a3d]" /></label>;

function ThemesTab({ page, setPage }: { page: ProfilePageData; setPage: (p: ProfilePageData) => void }) {
  return <>
    <Label>Pick a look. Your widgets stay put.</Label>
    <div className="grid grid-cols-2 gap-2.5">{PRESETS.map((t) => {
      const look = { ...page, ...t.look } as ProfilePageData;
      return <button key={t.id} type="button" onClick={() => setPage(look)} className="overflow-hidden rounded-2xl text-left ring-1 ring-white/10 hover:ring-white/40">
        <span className="block h-24 p-2.5" style={bgCss(look.bg)}>
          <span className="block h-full p-2" style={{ ...(look.card === "solid" ? { background: look.cardColor } : look.card === "glass" ? { background: pageInk(look) === "#ffffff" ? "rgba(0,0,0,.4)" : "rgba(255,255,255,.6)" } : look.card === "outline" ? { border: `1px solid ${alpha(cardInk(look), 0.3)}` } : {}), borderRadius: look.radius / 2 }}>
            <span className="block text-[13px]" style={{ fontFamily: FONTS[look.font].stack, color: cardInk(look), fontWeight: FONTS[look.font].weight }}>Aa {t.name}</span>
            <span className="mt-1.5 block h-1.5 w-10 rounded-full" style={{ background: look.accent }} />
          </span>
        </span>
        <span className="block bg-white/[.05] px-3 py-2 text-sm font-semibold">{t.name}</span>
      </button>;
    })}</div>
  </>;
}

/** Upload a picture (signed-in creators), returning its public link. */
function useUpload(ctx: Ctx) {
  const [busy, setBusy] = useState(false);
  const run = async (f: File): Promise<string | null> => {
    const type = (f.type || "image/jpeg").split(";")[0];
    if (!/^image\/(jpeg|png|webp)$/.test(type)) { ctx.say("Pictures can be JPG, PNG or WebP."); return null; }
    setBusy(true);
    try {
      const u = await ctx.api("/api/earshot/social/upload-url", { method: "POST", body: { kind: "art", type, size: f.size } });
      const res = await fetch(u.url, { method: "PUT", headers: { "Content-Type": type, "x-upsert": "false" }, body: f });
      if (!res.ok || !u.publicUrl) throw new Error("The upload didn't go through. Try again.");
      return u.publicUrl as string;
    } catch (e: any) { ctx.say(e?.needSignIn ? "Sign in with your email to upload pictures. You can still paste a link or pick one of ours." : e?.message || "That didn't upload."); return null; }
    finally { setBusy(false); }
  };
  return { busy, run };
}
function ImagePicker({ value, onPick, ctx, presets = true }: { value: string; onPick: (url: string) => void; ctx: Ctx; presets?: boolean }) {
  const [link, setLink] = useState("");
  const up = useUpload(ctx);
  const file = useRef<HTMLInputElement>(null);
  return <div className="flex flex-col gap-2">
    {presets && <div className="grid grid-cols-4 gap-2">{PHOTO_BGS.map((p) => <button key={p.url} type="button" onClick={() => onPick(p.url)} aria-label={p.name} aria-pressed={value === p.url} className={`overflow-hidden rounded-xl ring-2 ${value === p.url ? "ring-[#ff8a3d]" : "ring-transparent"}`}><img src={p.url.replace("width=1600", "width=240")} alt="" referrerPolicy="no-referrer" loading="lazy" className="aspect-square w-full object-cover" /></button>)}</div>}
    <div className="flex gap-2">
      <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a picture link (https://…)" aria-label="Picture link" className={fieldCls} />
      <button type="button" onClick={() => { const u = safeUrl(link); if (u) { onPick(u); setLink(""); } else ctx.say("That link needs to start with https://"); }} className="min-h-11 flex-none rounded-xl bg-white/10 px-3 text-sm font-semibold">Use</button>
    </div>
    <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { const u = await up.run(f); if (u) onPick(u); } }} />
    <button type="button" onClick={() => file.current?.click()} disabled={up.busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-semibold disabled:opacity-50">{up.busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}Upload a picture</button>
  </div>;
}

function BackgroundTab({ page, set, ctx }: { page: ProfilePageData; set: (p: Partial<ProfilePageData>) => void; ctx: Ctx }) {
  const bg = page.bg;
  const base = bg.kind === "image" ? bg.color : bg.color, base2 = bg.kind === "gradient" || bg.kind === "pattern" ? bg.color2 : "#312e81";
  const to = (kind: PageBg["kind"]): PageBg => kind === "color" ? { kind, color: base } : kind === "gradient" ? { kind, color: base, color2: base2, angle: 160 } : kind === "pattern" ? { kind, color: base, color2: base2, pattern: "dots", size: 28 } : { kind, image: PHOTO_BGS[0].url, fit: "cover", dim: 30, color: "#000000" };
  return <>
    <Label>Page background</Label>
    <div className="flex flex-wrap gap-2">{(["color", "gradient", "pattern", "image"] as const).map((k) => <button key={k} type="button" onClick={() => set({ bg: to(k) })} className={chip(bg.kind === k)}>{k === "image" ? "Photo" : k[0].toUpperCase() + k.slice(1)}</button>)}</div>
    <div className="mt-3 flex flex-col gap-2">
      {bg.kind !== "image" && <ColorField label={bg.kind === "color" ? "Color" : "First color"} value={bg.color} onChange={(c) => set({ bg: { ...bg, color: c } as PageBg })} />}
      {(bg.kind === "gradient" || bg.kind === "pattern") && <ColorField label={bg.kind === "pattern" ? "Pattern color" : "Second color"} value={bg.color2} onChange={(c) => set({ bg: { ...bg, color2: c } })} />}
      {bg.kind === "gradient" && <Slider label="Direction" value={bg.angle} min={0} max={360} unit="°" onChange={(n) => set({ bg: { ...bg, angle: n } })} />}
      {bg.kind === "pattern" && <>
        <div className="grid grid-cols-4 gap-2">{PATTERNS.map((pt) => <button key={pt} type="button" onClick={() => set({ bg: { ...bg, pattern: pt } })} aria-pressed={bg.pattern === pt} className={`h-14 rounded-xl ring-2 ${bg.pattern === pt ? "ring-[#ff8a3d]" : "ring-white/10"}`} style={bgCss({ ...bg, pattern: pt, size: 18 })}><span className="sr-only">{pt}</span></button>)}</div>
        <Slider label="Pattern size" value={bg.size} min={12} max={80} unit="px" onChange={(n) => set({ bg: { ...bg, size: n } })} />
      </>}
      {bg.kind === "image" && <>
        <ImagePicker value={bg.image} onPick={(u) => set({ bg: { ...bg, image: u } })} ctx={ctx} />
        <Slider label="Darken" value={bg.dim} min={0} max={80} unit="%" onChange={(n) => set({ bg: { ...bg, dim: n } })} />
        <div className="flex gap-2">{(["cover", "tile"] as const).map((f) => <button key={f} type="button" onClick={() => set({ bg: { ...bg, fit: f } })} className={chip(bg.fit === f)}>{f === "cover" ? "Fill the page" : "Repeat (tile)"}</button>)}</div>
      </>}
    </div>
    <Label>Banner</Label>
    <div className="flex flex-wrap gap-2">{(["none", "color", "image"] as const).map((k) => <button key={k} type="button" onClick={() => set({ banner: k === "none" ? { kind: "none" } : k === "color" ? { kind: "color", color: page.accent } : { kind: "image", image: PHOTO_BGS[1].url } })} className={chip(page.banner.kind === k)}>{k === "none" ? "None" : k === "color" ? "Color" : "Photo"}</button>)}</div>
    <div className="mt-3 flex flex-col gap-2">
      {page.banner.kind === "color" && <>
        <ColorField label="Banner color" value={page.banner.color} onChange={(c) => set({ banner: { ...(page.banner as any), color: c } })} />
        <ColorField label="Fade to" value={page.banner.color2 || page.banner.color} onChange={(c) => set({ banner: { ...(page.banner as any), color2: c } })} />
      </>}
      {page.banner.kind === "image" && <ImagePicker value={page.banner.image} onPick={(u) => set({ banner: { kind: "image", image: u } })} ctx={ctx} />}
    </div>
  </>;
}

function StyleTab({ page, set }: { page: ProfilePageData; set: (p: Partial<ProfilePageData>) => void }) {
  return <>
    <Label>Accent color</Label>
    <ColorField label="Buttons, titles and highlights" value={page.accent} onChange={(c) => set({ accent: c })} />
    <Label>Font</Label>
    <div className="grid grid-cols-2 gap-2">{(Object.keys(FONTS) as (keyof typeof FONTS)[]).map((f) => <button key={f} type="button" onClick={() => set({ font: f })} aria-pressed={page.font === f} className={`min-h-14 rounded-xl px-3 text-left ring-2 ${page.font === f ? "bg-white/10 ring-[#ff8a3d]" : "bg-white/[.05] ring-transparent"}`} style={{ fontFamily: FONTS[f].stack }}><span className="block text-[17px]" style={{ fontWeight: FONTS[f].weight }}>{FONTS[f].name}</span><span className="text-xs text-white/55">Aa Bb 123</span></button>)}</div>
    <Label>Cards</Label>
    <div className="flex flex-wrap gap-2">{(["glass", "solid", "outline", "none"] as const).map((c) => <button key={c} type="button" onClick={() => set({ card: c })} className={chip(page.card === c)}>{c === "glass" ? "Frosted" : c === "none" ? "No box" : c[0].toUpperCase() + c.slice(1)}</button>)}</div>
    {page.card === "solid" && <div className="mt-2"><ColorField label="Card color" value={page.cardColor} onChange={(c) => set({ cardColor: c })} /></div>}
    <div className="mt-2"><Slider label="Rounded corners" value={page.radius} min={0} max={28} unit="px" onChange={(n) => set({ radius: n })} /></div>
    <Label>Text color</Label>
    <div className="flex flex-wrap gap-2">{(["auto", "light", "dark"] as const).map((t) => <button key={t} type="button" onClick={() => set({ text: t })} className={chip(page.text === t)}>{t === "auto" ? "Automatic" : t === "light" ? "Light" : "Dark"}</button>)}</div>
    <Label>Layout</Label>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => set({ layout: "two" })} className={`${chip(page.layout === "two")} inline-flex items-center gap-1.5`}><Columns2 size={15} />Two columns</button>
      <button type="button" onClick={() => set({ layout: "one" })} className={chip(page.layout === "one")}>One column</button>
    </div>
    <button type="button" onClick={() => set({ ...defaultPage(), widgets: page.widgets, mood: page.mood, song: page.song })} className="mt-6 min-h-11 w-full rounded-xl bg-white/[.06] text-sm font-semibold text-white/75">Reset the look</button>
  </>;
}

function WidgetsTab({ page, set, ctx }: { page: ProfilePageData; set: (p: Partial<ProfilePageData>) => void; ctx: Ctx }) {
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const list = page.widgets;
  const put = (widgets: Widget[]) => set({ widgets });
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= list.length) return; const n = list.slice(); [n[i], n[j]] = [n[j], n[i]]; put(n); };
  const patch = (id: string, p: Partial<Widget>) => put(list.map((w) => (w.id === id ? { ...w, ...p } : w)));
  const have = new Set(list.map((w) => w.type));
  return <>
    <Label>Your widgets, top to bottom</Label>
    <ul className="flex flex-col gap-2">{list.map((w, i) => <li key={w.id} className="rounded-2xl bg-white/[.05] ring-1 ring-white/10">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button type="button" onClick={() => setOpen(open === w.id ? null : w.id)} className="min-h-11 min-w-0 flex-1 truncate px-1 text-left text-[15px] font-semibold">{w.title || widgetName(w.type)}<span className="ml-2 text-xs font-normal text-white/45">{page.layout === "two" ? (w.col === "side" ? "Left" : "Right") : ""}</span></button>
        {page.layout === "two" && <button type="button" onClick={() => patch(w.id, { col: w.col === "side" ? "main" : "side" })} aria-label={`Move ${widgetName(w.type)} to the ${w.col === "side" ? "right" : "left"} column`} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"><Columns2 size={16} /></button>}
        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 disabled:opacity-30"><ArrowUp size={16} /></button>
        <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Move down" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 disabled:opacity-30"><ArrowDown size={16} /></button>
        <button type="button" onClick={() => put(list.filter((x) => x.id !== w.id))} aria-label={`Remove ${widgetName(w.type)}`} className="grid h-10 w-10 place-items-center rounded-full text-white/60 hover:bg-white/10"><Trash2 size={16} /></button>
      </div>
      {open === w.id && <div className="border-t border-white/10 p-3"><WidgetSettings w={w} patch={(p) => patch(w.id, p)} ctx={ctx} /></div>}
    </li>)}</ul>
    {adding ? <div className="mt-3 rounded-2xl bg-white/[.05] p-2 ring-1 ring-white/10">
      <div className="flex items-center justify-between px-2 py-1"><b className="text-sm">Add a widget</b><button type="button" onClick={() => setAdding(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"><X size={16} /></button></div>
      {WIDGETS.map((d) => { const off = !!d.once && have.has(d.type); return <button key={d.type} type="button" disabled={off} onClick={() => { const w: Widget = { id: newWidgetId(), type: d.type, col: d.col, ...(d.type === "top8" ? { shows: [] } : d.type === "friends" ? { handles: [] } : d.type === "links" ? { links: [] } : d.type === "interests" ? { tags: [] } : d.type === "posts" || d.type === "clips" || d.type === "podcast" ? { count: 5 } : {}) }; put([...list, w]); setAdding(false); setOpen(w.id); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-white/[.06] disabled:opacity-35">
        <Plus size={16} className="flex-none text-[#ff8a3d]" /><span className="min-w-0"><b className="block text-[15px]">{d.name}</b><span className="block text-xs text-white/55">{off ? "Already on your page" : d.about}</span></span></button>; })}
    </div> : <button type="button" onClick={() => setAdding(true)} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/20 text-[15px] font-semibold text-white/80 hover:border-white/40"><Plus size={18} />Add a widget</button>}
  </>;
}

function WidgetSettings({ w, patch, ctx }: { w: Widget; patch: (p: Partial<Widget>) => void; ctx: Ctx }) {
  const [tag, setTag] = useState("");
  return <div className="flex flex-col gap-2">
    <input value={w.title || ""} onChange={(e) => patch({ title: e.target.value.slice(0, 60) })} placeholder={`Title (${widgetName(w.type)})`} aria-label="Widget title" className={fieldCls} />
    {(w.type === "text" || w.type === "quote" || w.type === "about") && <textarea value={w.text || ""} onChange={(e) => patch({ text: e.target.value.slice(0, w.type === "text" || w.type === "about" ? 2000 : 400) })} rows={w.type === "quote" ? 3 : 5} placeholder={w.type === "about" ? "Leave empty to show your bio" : w.type === "quote" ? "A line you love" : "Say anything"} aria-label="Text" className={`${fieldCls} py-2.5`} />}
    {w.type === "quote" && <input value={w.by || ""} onChange={(e) => patch({ by: e.target.value.slice(0, 80) })} placeholder="Who said it (optional)" aria-label="Who said it" className={fieldCls} />}
    {w.type === "photo" && <><ImagePicker value={w.image || ""} onPick={(u) => patch({ image: u })} ctx={ctx} presets={false} /><input value={w.text || ""} onChange={(e) => patch({ text: e.target.value.slice(0, 200) })} placeholder="Caption (optional)" aria-label="Caption" className={fieldCls} /></>}
    {w.type === "links" && <>
      {(w.links || []).map((l, i) => <div key={i} className="flex gap-2">
        <input value={l.label} onChange={(e) => patch({ links: (w.links || []).map((x, j) => (j === i ? { ...x, label: e.target.value.slice(0, 40) } : x)) })} placeholder="Label" aria-label="Link label" className={`${fieldCls} w-1/3`} />
        <input value={l.url} onChange={(e) => patch({ links: (w.links || []).map((x, j) => (j === i ? { ...x, url: e.target.value.slice(0, 600) } : x)) })} placeholder="https://…" aria-label="Link address" className={fieldCls} />
        <button type="button" onClick={() => patch({ links: (w.links || []).filter((_, j) => j !== i) })} aria-label="Remove link" className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-white/10"><X size={16} /></button>
      </div>)}
      {(w.links || []).length < 8 && <button type="button" onClick={() => patch({ links: [...(w.links || []), { label: "", url: "https://" }] })} className="min-h-11 rounded-xl bg-white/10 text-sm font-semibold">Add a link</button>}
      <p className="text-xs text-white/45">Links must start with https://</p>
    </>}
    {w.type === "interests" && <>
      <div className="flex flex-wrap gap-1.5">{(w.tags || []).map((t) => <button key={t} type="button" onClick={() => patch({ tags: (w.tags || []).filter((x) => x !== t) })} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white/10 px-3 text-sm">{t}<X size={13} /></button>)}</div>
      <form onSubmit={(e) => { e.preventDefault(); const t = tag.trim().slice(0, 24); if (t && !(w.tags || []).includes(t)) patch({ tags: [...(w.tags || []), t].slice(0, 16) }); setTag(""); }} className="flex gap-2"><input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="True crime, F1, history…" aria-label="Add an interest" className={fieldCls} /><button type="submit" className="min-h-11 flex-none rounded-xl bg-white/10 px-3 text-sm font-semibold">Add</button></form>
    </>}
    {w.type === "top8" && <ShowPicker shows={w.shows || []} onChange={(shows) => patch({ shows })} ctx={ctx} />}
    {w.type === "friends" && <FriendPicker handles={w.handles || []} onChange={(handles) => patch({ handles })} ctx={ctx} />}
    {(w.type === "posts" || w.type === "clips" || w.type === "podcast") && <Slider label="How many to show" value={w.count ?? 5} min={1} max={20} onChange={(n) => patch({ count: n })} />}
  </div>;
}

function useSearch<T>(q: string, run: (q: string) => Promise<T[]>) {
  const [res, setRes] = useState<T[] | null>(null);
  const runRef = useRef(run); runRef.current = run;
  useEffect(() => { const t = q.trim(); if (t.length < 2) { setRes(null); return; } let live = true; const h = setTimeout(() => { runRef.current(t).then((r) => { if (live) setRes(r); }).catch(() => { if (live) setRes([]); }); }, 350); return () => { live = false; clearTimeout(h); }; }, [q]);
  return res;
}
function ShowPicker({ shows, onChange, ctx }: { shows: PageShow[]; onChange: (s: PageShow[]) => void; ctx: Ctx }) {
  const [q, setQ] = useState("");
  const res = useSearch<PageShow>(q, (t) => ctx.api(`/api/earshot/search?q=${encodeURIComponent(t)}`).then((b) => (b.shows || []).map((s: any) => ({ id: s.id, name: s.name, art: s.art, author: s.author }))));
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= shows.length) return; const n = shows.slice(); [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  return <>
    <ul className="flex flex-col gap-1.5">{shows.map((s, i) => <li key={s.id} className="flex items-center gap-2 rounded-xl bg-white/[.05] p-1.5">
      <span className="w-5 text-center text-xs font-bold text-white/55">{i + 1}</span><img src={hiRes(s.art, 80)} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-lg object-cover" /><span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="grid h-9 w-9 place-items-center rounded-full disabled:opacity-30"><ArrowUp size={14} /></button>
      <button type="button" onClick={() => onChange(shows.filter((x) => x.id !== s.id))} aria-label={`Remove ${s.name}`} className="grid h-9 w-9 place-items-center rounded-full"><X size={15} /></button>
    </li>)}</ul>
    {shows.length < 8 ? <>
      <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find a show to add (${8 - shows.length} left)`} aria-label="Find a show" className={`${fieldCls} pl-9`} /></div>
      {res && <ul className="max-h-56 overflow-y-auto">{res.filter((s) => !shows.some((x) => x.id === s.id)).slice(0, 12).map((s) => <li key={s.id}><button type="button" onClick={() => { onChange([...shows, s].slice(0, 8)); setQ(""); }} className="flex min-h-12 w-full items-center gap-2.5 rounded-xl px-1.5 text-left hover:bg-white/[.06]"><img src={hiRes(s.art, 80)} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-lg object-cover" /><span className="min-w-0 flex-1"><b className="block truncate text-sm">{s.name}</b><span className="block truncate text-xs text-white/50">{s.author}</span></span><Plus size={16} className="text-[#ff8a3d]" /></button></li>)}</ul>}
    </> : <p className="text-xs text-white/50">That's your 8. Remove one to swap it.</p>}
  </>;
}
function FriendPicker({ handles, onChange, ctx }: { handles: string[]; onChange: (h: string[]) => void; ctx: Ctx }) {
  const [q, setQ] = useState("");
  const res = useSearch<Profile>(q, (t) => ctx.api(`/api/earshot/social/people?q=${encodeURIComponent(t)}`).then((b) => b.people || []));
  return <>
    <div className="flex flex-wrap gap-1.5">{handles.map((h, i) => <span key={h} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white/10 pl-3 pr-1 text-sm"><b className="text-white/55">{i + 1}</b>@{h}
      {i > 0 && <button type="button" onClick={() => { const n = handles.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); }} aria-label={`Move @${h} up`} className="grid h-7 w-7 place-items-center rounded-full"><ArrowUp size={13} /></button>}
      <button type="button" onClick={() => onChange(handles.filter((x) => x !== h))} aria-label={`Remove @${h}`} className="grid h-7 w-7 place-items-center rounded-full"><X size={13} /></button></span>)}</div>
    {handles.length < 8 ? <>
      <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find people (${8 - handles.length} spots left)`} aria-label="Find people" className={`${fieldCls} pl-9`} /></div>
      {res && <ul className="max-h-56 overflow-y-auto">{res.filter((p) => !handles.includes(p.handle) && p.handle !== ctx.me?.handle).slice(0, 12).map((p) => <li key={p.handle}><button type="button" onClick={() => { onChange([...handles, p.handle].slice(0, 8)); setQ(""); }} className="flex min-h-12 w-full items-center gap-2.5 rounded-xl px-1.5 text-left hover:bg-white/[.06]"><Avatar p={p} size={34} /><span className="min-w-0 flex-1"><b className="block truncate text-sm">{p.name}</b><span className="block truncate text-xs text-white/50">@{p.handle}</span></span><Plus size={16} className="text-[#ff8a3d]" /></button></li>)}</ul>}
    </> : <p className="text-xs text-white/50">Your Top 8 is full. Remove someone to swap.</p>}
  </>;
}

function ProfileTab({ page, set, ctx, onEditProfile }: { page: ProfilePageData; set: (p: Partial<ProfilePageData>) => void; ctx: Ctx; onEditProfile: () => void }) {
  const [q, setQ] = useState("");
  const res = useSearch<PageEpisode>(q, (t) => ctx.api(`/api/earshot/search?q=${encodeURIComponent(t)}`).then((b) => (b.episodes || []).filter((e: any) => /^https:\/\//.test(e.audio || "")).map((e: any) => ({ id: e.id, showId: e.showId, show: e.show, title: e.title, art: e.art, audio: e.audio, secs: e.secs, date: e.date }))));
  return <>
    <button type="button" onClick={onEditProfile} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-semibold"><Pencil size={15} />Change your name, username or bio</button>
    <Label>Mood</Label>
    <div className="flex flex-wrap gap-1.5">{MOODS.map((m) => <button key={m} type="button" onClick={() => set({ mood: { ...page.mood, emoji: m } })} aria-pressed={page.mood.emoji === m} className={`grid h-11 w-11 place-items-center rounded-xl text-xl ${page.mood.emoji === m ? "bg-white/20 ring-2 ring-[#ff8a3d]" : "bg-white/[.06]"}`}>{m}</button>)}</div>
    <input value={page.mood.text} onChange={(e) => set({ mood: { ...page.mood, text: e.target.value.slice(0, 80) } })} placeholder="What's your mood? (e.g. deep in a true crime binge)" aria-label="Mood" className={`${fieldCls} mt-2`} />
    <Label>Profile song</Label>
    <p className="mb-2 text-xs text-white/55">An episode visitors can play from your page.</p>
    {page.song && <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-white/[.06] p-2"><Music2 size={16} className="text-[#ff8a3d]" /><img src={hiRes(page.song.art, 80)} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-lg object-cover" /><span className="min-w-0 flex-1"><b className="block truncate text-sm">{page.song.title}</b><span className="block truncate text-xs text-white/50">{page.song.show}</span></span><button type="button" onClick={() => set({ song: null })} aria-label="Remove profile song" className="grid h-9 w-9 place-items-center rounded-full"><X size={15} /></button></div>}
    <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an episode" aria-label="Find an episode for your profile song" className={`${fieldCls} pl-9`} /></div>
    {res && <ul className="mt-1 max-h-64 overflow-y-auto">{res.slice(0, 15).map((e) => <li key={e.id}><button type="button" onClick={() => { set({ song: e }); setQ(""); ctx.say("Profile song set."); }} className="flex min-h-12 w-full items-center gap-2.5 rounded-xl px-1.5 text-left hover:bg-white/[.06]"><img src={hiRes(e.art, 80)} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-lg object-cover" /><span className="min-w-0 flex-1"><b className="block truncate text-sm">{e.title}</b><span className="block truncate text-xs text-white/50">{e.show}</span></span><Plus size={16} className="text-[#ff8a3d]" /></button></li>)}</ul>}
    <p className="mt-6 flex items-center gap-1.5 text-xs text-white/45"><ImageIcon size={13} />Everything on your page is public.</p>
  </>;
}

/** Someone's page with live editing for the owner (wraps ProfileSpace and PageEditor). */
export function ProfileWithEditor({ data, ctx, onBack, onFollow, onEditProfile, setData }: { data: PageData; ctx: Ctx; onBack: () => void; onFollow: () => void; onEditProfile: () => void; setData: (f: (d: PageData) => PageData) => void }) {
  const saved = useMemo(() => cleanPage(data.page ?? defaultPage()), [data.page]);
  const [draft, setDraft] = useState<ProfilePageData | null>(null);
  const [saving, setSaving] = useState(false);
  const page = draft ?? saved;
  const save = () => {
    if (!draft) return;
    setSaving(true);
    ctx.api("/api/earshot/social/me/page", { method: "POST", body: { page: draft } })
      .then((b) => {
        setData((d) => ({ ...d, page: b.page })); setDraft(null); ctx.say("Your page is saved.");
        // Top 8 friends' names and pictures come from the server.
        ctx.api(`/api/earshot/social/u/${data.profile.handle}`).then((full) => setData((d) => ({ ...d, friends: full.friends || [] }))).catch(() => {});
      })
      .catch((e) => ctx.say(e?.needProfile ? "Make your profile first." : e.message))
      .finally(() => setSaving(false));
  };
  // Friends picked in the editor show right away in the preview (their names load when saved).
  return <>
    <ProfileSpace data={data} page={page} ctx={ctx} onBack={onBack} onFollow={onFollow} onEditProfile={onEditProfile} editing={!!draft}
      onCustomize={() => setDraft((d) => d ?? saved)} onGuestbook={(list) => setData((d) => ({ ...d, guestbook: list }))} />
    {draft && data.me && <PageEditor page={draft} setPage={setDraft} ctx={ctx} saving={saving} onSave={save} onCancel={() => setDraft(null)} onEditProfile={onEditProfile} />}
  </>;
}

/** Opens someone's page by username: loads it, then shows it (with Customize for the owner). */
export function PersonSpace({ handle, ctx, onEdit, onClose }: { handle: string; ctx: Ctx; onEdit: () => void; onClose: () => void }) {
  const [data, setData] = useState<PageData | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { setData(null); setErr(""); ctx.api(`/api/earshot/social/u/${handle}`).then(setData).catch((e) => setErr(e?.message || "That profile didn't load.")); }, [handle]); // eslint-disable-line react-hooks/exhaustive-deps
  const follow = () => { if (!data) return; if (!ctx.me) return ctx.needProfile(); const on = !data.followed; setData({ ...data, followed: on, followers: data.followers + (on ? 1 : -1) }); ctx.api("/api/earshot/social/follow", { method: "POST", body: { handle, on } }).catch((e) => ctx.say(e.message)); };
  if (!data) return <div className="ps-dark absolute inset-0 z-40 grid place-items-center bg-black text-white" role="dialog" aria-label={`@${handle}`}>
    <button type="button" onClick={onClose} aria-label="Back" className="absolute left-3 top-[max(.75rem,env(safe-area-inset-top))] grid h-10 w-10 place-items-center rounded-full bg-white/10"><ChevronLeft size={22} /></button>
    {err ? <p className="px-6 text-center text-sm text-white/70">{err}</p> : <Loader2 className="animate-spin" />}
  </div>;
  return <ProfileWithEditor data={data} ctx={ctx} onBack={onClose} onFollow={follow} onEditProfile={onEdit} setData={(f) => setData((d) => (d ? f(d) : d))} />;
}

/** Top of the Social tab: your page, and pages worth a visit. */
export function PagesStrip({ ctx, onCreate }: { ctx: Ctx; onCreate: () => void }) {
  const [people, setPeople] = useState<Profile[] | null>(null);
  useEffect(() => { ctx.api("/api/earshot/social/people").then((b) => setPeople((b.people || []).filter((p: Profile) => p.handle !== ctx.me?.handle).slice(0, 16))).catch(() => setPeople([])); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <section aria-label="Pages" className="border-b border-white/[.09] px-4 py-3">
    <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
      <button type="button" onClick={() => (ctx.me ? ctx.person(ctx.me.handle) : onCreate())} className="flex w-[74px] flex-none flex-col items-center gap-1.5 text-center">
        <span className="relative grid h-[66px] w-[66px] place-items-center rounded-full p-[3px]" style={{ background: "conic-gradient(#ff8a3d, #ec4899, #6366f1, #ff8a3d)" }}>
          {ctx.me ? <Avatar p={ctx.me} size={60} /> : <span className="grid h-[60px] w-[60px] place-items-center rounded-full bg-black"><Plus size={22} /></span>}
          <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-[#ff8a3d] text-[#111] ring-2 ring-black"><Paintbrush size={12} /></span>
        </span>
        <span className="w-full truncate text-[12px] font-semibold">{ctx.me ? "Your page" : "Make yours"}</span>
      </button>
      {(people ?? []).map((p) => <button key={p.handle} type="button" onClick={() => ctx.person(p.handle)} className="flex w-[74px] flex-none flex-col items-center gap-1.5 text-center">
        <Avatar p={p} size={66} /><span className="w-full truncate text-[12px] text-white/80">{p.name}</span>
      </button>)}
      {people === null && <Loader2 className="my-6 animate-spin text-white/50" />}
    </div>
  </section>;
}
