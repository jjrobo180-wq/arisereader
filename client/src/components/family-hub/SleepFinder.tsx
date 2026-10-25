// Sleep Finder (a Plugin Store add-on): asks what someone is into, recommends real sleep sounds,
// music, stories and podcasts with links, finds anything they describe (with AI when it's there),
// and builds sleep playlists they can play through one item at a time. The picks and the link rules
// live in shared/sleepFinder.ts.
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Copy, ExternalLink, EyeOff, ListMusic, Loader2, Moon, Pencil, Play, Plus, Search, SkipBack, SkipForward, Sparkles, ThumbsUp, Trash2, Wand2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import {
  KINDS, KIND_LABELS, LENGTHS, LENGTH_LABELS, LINK_LABELS, PLACES, PLACE_LABELS, TOPICS, TOPIC_LABELS, VOICES, VOICE_LABELS, WHOS, WHO_LABELS, FINDER_LIMITS,
  cleanUrl, defaultPrefs, itemLink, minutesWords, placesFor, placesForKind, playlistMinutes, playlistText, recommend, searchCatalog, searchLink, toItem, tonightsMix, wantsDark,
  type AiPick, type Kind, type LinkPlace, type PlaylistItem, type SleepFinder as Finder, type SleepPick, type SleepPlaylist, type SleepPrefs,
} from "@shared/sleepFinder";
import { Empty, Label, Modal, PageHead, Panel, confirmed, danger, inputClass, plain, primary, shortDate, soft, type SectionProps } from "./ui";

type Tab = "foryou" | "find" | "playlists";
const EMOJIS = ["🌙", "🌧️", "🌊", "🔥", "🎹", "🌌", "📖", "🧸", "🌲", "💤"];
const EXAMPLES = ["Rain with a train going by", "Someone reading old history, very slowly", "Calm video game music, no voices", "Something for my 5-year-old", "Like a cozy cabin in winter"];
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const chip = (on: boolean) => `inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold ring-1 transition ${on ? "bg-[#292446] text-white ring-[#292446]" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`;

/** Something that can be shown as a card: a catalog pick, or one the AI suggested. */
type Card = { key: string; title: string; by: string; kind: Kind; about: string; query: string; on: LinkPlace[]; mins: number; pick?: SleepPick; extra?: string };
const fromPick = (p: SleepPick): Card => ({ key: p.id, title: p.title, by: p.by, kind: p.kind, about: p.about, query: p.query, on: p.on, mins: p.mins, pick: p, extra: `${p.length === "long" ? "All night" : p.length === "medium" ? "1–2 hours" : "Under an hour"} · ${p.voice === "none" ? "No voices" : p.voice === "soft" ? "Soft voice" : "Talking"}` });
const fromAi = (p: AiPick, i: number): Card => ({ key: `ai-${i}-${p.query}`, title: p.title, by: p.by, kind: p.kind, about: p.why, query: p.query, on: placesForKind(p.kind), mins: 0 });

export default function SleepFinder({ family, setFamily, today, makeId, say }: SectionProps) {
  const finder = family.sleepFinder;
  const prefs = finder.prefs;
  const [tab, setTab] = useState<Tab>("foryou");
  const [quiz, setQuiz] = useState(!prefs);
  const [openList, setOpenList] = useState<string | null>(null);
  const [adding, setAdding] = useState<Card | null>(null);

  const update = (fn: (f: Finder) => Finder) => setFamily((fam) => ({ ...fam, sleepFinder: fn(fam.sleepFinder) }));
  const savePrefs = (p: SleepPrefs) => { update((f) => ({ ...f, prefs: p })); setQuiz(false); setTab("foryou"); say("Got it. Here's what we think you'll sleep to."); };

  const newPlaylist = (name: string, emoji: string, items: PlaylistItem[] = []): string | null => {
    if (finder.playlists.length >= FINDER_LIMITS.playlists) { say(`You can keep up to ${FINDER_LIMITS.playlists} playlists. Delete one to make room.`); return null; }
    const id = makeId();
    update((f) => ({ ...f, playlists: [{ id, name: name.slice(0, FINDER_LIMITS.name), emoji, items, createdAt: today }, ...f.playlists] }));
    return id;
  };
  const addToPlaylist = (listId: string, card: Card) => {
    const pl = finder.playlists.find((p) => p.id === listId);
    if (!pl) return;
    if (pl.items.length >= FINDER_LIMITS.items) { say("That playlist is full."); return; }
    const item: PlaylistItem = card.pick ? toItem(card.pick, makeId()) : { id: makeId(), ref: "", title: card.title, by: card.by, kind: card.kind, query: card.query, url: "", mins: card.mins };
    update((f) => ({ ...f, playlists: f.playlists.map((p) => (p.id === listId ? { ...p, items: [...p.items, item] } : p)) }));
    say(`Added to ${pl.name}.`);
  };
  const makeTonight = () => {
    if (!prefs) return;
    const mix = tonightsMix(prefs, finder.liked, finder.hidden);
    const id = newPlaylist(`Tonight · ${shortDate(today, { month: "short", day: "numeric" })}`, "🌙", mix.map((p) => toItem(p, makeId())));
    if (id) { setTab("playlists"); setOpenList(id); say("Tonight's mix is ready: wind down, drift off, then all night."); }
  };
  const like = (id: string) => update((f) => ({ ...f, liked: toggle(f.liked, id).slice(-FINDER_LIMITS.liked) }));
  const hide = (id: string) => { update((f) => ({ ...f, hidden: [...f.hidden.filter((x) => x !== id), id].slice(-FINDER_LIMITS.hidden), liked: f.liked.filter((x) => x !== id) })); say("Hidden. It won't be suggested again."); };

  const cardProps = { prefs, liked: finder.liked, onAdd: setAdding, onLike: like, onHide: hide };

  if (quiz) return <Quiz initial={prefs ?? defaultPrefs()} canCancel={!!prefs} onCancel={() => setQuiz(false)} onDone={savePrefs} />;

  return <div className="space-y-6">
    <PageHead eyebrow="Sleep Finder" title="Find your sleep sound" blurb="Sounds, music, stories and podcasts picked for what you're into, with links to play them. Save the ones that work into playlists."
      action={<div className="flex flex-wrap gap-2">
        <button type="button" onClick={makeTonight} className={primary + " min-h-11"} data-testid="sleepfinder-tonight"><Moon size={16} />Make tonight's mix</button>
        <button type="button" onClick={() => setQuiz(true)} className={plain + " min-h-11"}><Pencil size={15} />Change my answers</button>
      </div>} />

    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sleep Finder">
      {([["foryou", "For you", <Sparkles key="a" size={15} />], ["find", "Find anything", <Search key="b" size={15} />], ["playlists", `Playlists${finder.playlists.length ? ` (${finder.playlists.length})` : ""}`, <ListMusic key="c" size={15} />]] as [Tab, string, ReactNode][]).map(([id, label, icon]) =>
        <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={chip(tab === id)} data-testid={`sleepfinder-tab-${id}`}>{icon}{label}</button>)}
    </div>

    {tab === "foryou" && prefs && <ForYou prefs={prefs} finder={finder} card={cardProps} />}
    {tab === "find" && <Find finder={finder} update={update} card={cardProps} />}
    {tab === "playlists" && <Playlists finder={finder} update={update} openId={openList} setOpenId={setOpenList} newPlaylist={newPlaylist} makeId={makeId} say={say} onBrowse={() => setTab("foryou")} />}

    {adding && <AddToPlaylist card={adding} playlists={finder.playlists} onClose={() => setAdding(null)}
      onPick={(id) => { addToPlaylist(id, adding); setAdding(null); }}
      onNew={(name) => { const id = newPlaylist(name, "🌙"); if (id) { const item: PlaylistItem = adding.pick ? toItem(adding.pick, makeId()) : { id: makeId(), ref: "", title: adding.title, by: adding.by, kind: adding.kind, query: adding.query, url: "", mins: adding.mins }; update((f) => ({ ...f, playlists: f.playlists.map((p) => (p.id === id ? { ...p, items: [item] } : p)) })); say(`Made ${name} and added it.`); } setAdding(null); }} />}
  </div>;
}

// ── The questions ────────────────────────────────────────────────────────────

function Quiz({ initial, canCancel, onCancel, onDone }: { initial: SleepPrefs; canCancel: boolean; onCancel: () => void; onDone: (p: SleepPrefs) => void }) {
  const [p, setP] = useState<SleepPrefs>(initial);
  const [step, setStep] = useState(0);
  const set = <K extends keyof SleepPrefs>(k: K, v: SleepPrefs[K]) => setP((x) => ({ ...x, [k]: v }));
  const one = <T extends string>(list: readonly T[], labels: Record<T, string>, value: T, k: keyof SleepPrefs) =>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup">{list.map((v) => <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => set(k, v as never)}
      className={`min-h-12 rounded-2xl border p-3 text-left text-sm font-extrabold transition ${value === v ? "border-violet-300 bg-violet-50 text-violet-800" : "border-slate-100 hover:bg-slate-50"}`}>{labels[v]}</button>)}</div>;

  const steps: { title: string; hint: string; body: ReactNode }[] = [
    { title: "Who's it for?", hint: "Kids and babies only get picks made for them.", body: one(WHOS, WHO_LABELS, p.who, "who") },
    { title: "What helps you drift off?", hint: "Pick as many as you like. Not sure? Pick a few that sound nice.", body:
      <div className="flex flex-wrap gap-2" data-testid="sleepfinder-kinds">{KINDS.map((k) => <button key={k} type="button" aria-pressed={p.kinds.includes(k)} onClick={() => set("kinds", toggle(p.kinds, k))} className={chip(p.kinds.includes(k))}><span aria-hidden>{KIND_LABELS[k].emoji}</span>{KIND_LABELS[k].label}</button>)}</div> },
    { title: "What are you into?", hint: "Stories and podcasts are matched to your interests. Skip if you only want sounds.", body:
      <div className="flex flex-wrap gap-2">{TOPICS.map((t) => <button key={t} type="button" aria-pressed={p.topics.includes(t)} onClick={() => set("topics", toggle(p.topics, t))} className={chip(p.topics.includes(t))}>{TOPIC_LABELS[t]}</button>)}</div> },
    { title: "How do you feel about voices?", hint: "Some people need total quiet; others need someone talking.", body: one(VOICES, VOICE_LABELS, p.voice, "voice") },
    { title: "Where do you listen?", hint: "Your app's links show first.", body: <div className="space-y-4">{one(PLACES, PLACE_LABELS, p.place, "place")}
      <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600"><input type="checkbox" checked={p.dark} onChange={(e) => set("dark", e.target.checked)} className="h-5 w-5 accent-violet-600" />Prefer black-screen YouTube videos, so the room stays dark</label></div> },
    { title: "How long should it play?", hint: "Short is for falling asleep; all night is for staying asleep.", body: one(LENGTHS, LENGTH_LABELS, p.length, "length") },
  ];
  const last = step === steps.length - 1;
  const s = steps[step];
  return <div className="space-y-6">
    <PageHead eyebrow="Sleep Finder" title="Let's find what you sleep to" blurb="Six quick questions, then we'll pick sounds, music, stories and podcasts for you, with links." />
    <Panel>
      <div className="mb-5 flex items-center gap-1.5" aria-hidden>{steps.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-violet-500" : "bg-slate-100"}`} />)}</div>
      <p className="text-xs font-extrabold uppercase tracking-[.15em] text-violet-600">Question {step + 1} of {steps.length}</p>
      <h2 className="mt-1 text-2xl font-black text-[#232139]">{s.title}</h2>
      <p className="mb-5 mt-1 text-sm text-slate-500">{s.hint}</p>
      {s.body}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className={plain}><ArrowLeft size={16} />Back</button>}
          {canCancel && <button type="button" onClick={onCancel} className={plain}>Cancel</button>}
        </div>
        <button type="button" onClick={() => (last ? onDone(p) : setStep(step + 1))} className={primary + " px-5"} data-testid="sleepfinder-next">{last ? <><Sparkles size={16} />Show my picks</> : <>Next<ArrowRight size={16} /></>}</button>
      </div>
    </Panel>
  </div>;
}

// ── Cards ────────────────────────────────────────────────────────────────────

type CardActions = { prefs: SleepPrefs | null; liked: string[]; onAdd: (c: Card) => void; onLike: (id: string) => void; onHide: (id: string) => void };

function PickCard({ card, a }: { card: Card; a: CardActions }) {
  const places = placesFor(card.on, a.prefs?.place ?? "any");
  const liked = !!card.pick && a.liked.includes(card.pick.id);
  return <article className="flex min-w-0 flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_3px_16px_#17152b08]" data-testid="sleepfinder-card">
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-xl" aria-hidden>{KIND_LABELS[card.kind].emoji}</span>
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-base font-black leading-tight text-[#232139]">{card.title}</h3>
        {card.by && <p className="mt-0.5 truncate text-xs font-bold text-slate-500">{card.by}</p>}
      </div>
      {liked && <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">Works for me</span>}
    </div>
    <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{card.about}</p>
    {card.extra && <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{KIND_LABELS[card.kind].label} · {card.extra}</p>}
    <div className="mt-3 flex flex-wrap gap-1.5">
      {places.map((pl) => <a key={pl} href={searchLink(pl, card.query, pl === "youtube" && wantsDark(card.kind, a.prefs))} target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-slate-50 px-3 text-xs font-bold text-slate-700 hover:bg-violet-50 hover:text-violet-700">{LINK_LABELS[pl]}<ExternalLink size={12} /></a>)}
    </div>
    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
      <button type="button" onClick={() => a.onAdd(card)} className={soft + " min-h-9 text-xs"}><Plus size={14} />Playlist</button>
      {card.pick && <button type="button" onClick={() => a.onLike(card.pick!.id)} aria-pressed={liked} className={plain + " min-h-9 text-xs"}><ThumbsUp size={14} />{liked ? "Liked" : "Works for me"}</button>}
      {card.pick && <button type="button" onClick={() => a.onHide(card.pick!.id)} className={plain + " min-h-9 text-xs"} title="Don't suggest this again"><EyeOff size={14} />Not for me</button>}
    </div>
  </article>;
}

const Grid = ({ cards, a }: { cards: Card[]; a: CardActions }) =>
  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{cards.map((c) => <PickCard key={c.key} card={c} a={a} />)}</div>;

// ── For you ──────────────────────────────────────────────────────────────────

function ForYou({ prefs, finder, card }: { prefs: SleepPrefs; finder: Finder; card: CardActions }) {
  const picks = useMemo(() => recommend(prefs, finder.liked, finder.hidden, 12), [prefs, finder.liked, finder.hidden]);
  const tags = [WHO_LABELS[prefs.who], ...prefs.kinds.map((k) => `${KIND_LABELS[k].emoji} ${KIND_LABELS[k].label}`), ...prefs.topics.map((t) => TOPIC_LABELS[t]), VOICE_LABELS[prefs.voice], PLACE_LABELS[prefs.place]];
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-1.5" aria-label="Your answers">{tags.map((t) => <span key={t} className="rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">{t}</span>)}</div>
    {picks.length ? <Grid cards={picks.map(fromPick)} a={card} /> :
      <Empty icon={<Moon size={24} />} title="Nothing fits those answers yet">Try changing your answers, or search for anything on the Find tab.</Empty>}
    <p className="text-xs leading-5 text-slate-500">Links open a search on that app, so they always find the real thing.{finder.liked.length ? "" : " Tap “Works for me” on what helps and those rise to the top."}{finder.hidden.length ? ` ${finder.hidden.length} hidden.` : ""}</p>
  </div>;
}

// ── Find anything ────────────────────────────────────────────────────────────

function Find({ finder, update, card }: { finder: Finder; update: (fn: (f: Finder) => Finder) => void; card: CardActions }) {
  const { token } = useAuth();
  const [text, setText] = useState("");
  const [asked, setAsked] = useState("");
  const [ai, setAi] = useState<AiPick[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const matches = useMemo(() => (asked ? searchCatalog(asked, card.prefs, finder.hidden) : []), [asked, card.prefs, finder.hidden]);

  const run = (q: string) => {
    const t = q.trim().slice(0, 100);
    if (!t) return;
    setText(t); setAsked(t); setAi(null); setProblem("");
    update((f) => ({ ...f, searches: [t, ...f.searches.filter((s) => s.toLowerCase() !== t.toLowerCase())].slice(0, FINDER_LIMITS.searches) }));
  };
  const submit = (e: FormEvent) => { e.preventDefault(); run(text); };
  const askAi = async () => {
    const t = (asked || text).trim();
    if (!t || busy) return;
    if (t !== asked) run(t);
    setBusy(true); setProblem("");
    try {
      const res = await fetch(`${API_BASE}/api/sleep-finder/ask`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ text: t, prefs: card.prefs }) });
      const body: any = await res.json().catch(() => null);
      if (res.ok && Array.isArray(body?.picks) && body.picks.length) setAi(body.picks);
      else setProblem(`${body?.message || "The AI couldn't answer right now."} Here's what we found without it.`);
    } catch { setProblem("Couldn't reach the AI. Check your connection."); }
    finally { setBusy(false); }
  };
  const everywhere: LinkPlace[] = placesFor(["youtube", "spotify", "apple", "podcasts"], card.prefs?.place ?? "any");

  return <div className="space-y-4">
    <Panel title="What do you want to fall asleep to?">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={100} className={inputClass} placeholder="Rain on a cabin roof, a slow history podcast, Zelda music…" aria-label="Describe what you want" data-testid="sleepfinder-search" />
        <div className="flex gap-2">
          <button type="submit" className={plain + " min-h-11 flex-1 sm:flex-none"}><Search size={16} />Find</button>
          <button type="button" onClick={askAi} disabled={busy || !(asked || text).trim()} className={primary + " min-h-11 flex-1 sm:flex-none"} data-testid="sleepfinder-ask">{busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}Ask AI</button>
        </div>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(finder.searches.length ? finder.searches.slice(0, 6) : EXAMPLES).map((q) => <button key={q} type="button" onClick={() => run(q)} className="min-h-9 rounded-xl bg-slate-50 px-3 text-xs font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-700">{q}</button>)}
      </div>
    </Panel>

    {asked && <Panel title={`Search “${asked}” everywhere`} eyebrow="Straight to the apps">
      <div className="flex flex-wrap gap-2">
        {everywhere.map((pl) => <a key={pl} href={searchLink(pl, `${asked} sleep`, pl === "youtube" && !!card.prefs?.dark)} target="_blank" rel="noopener noreferrer" className={plain + " min-h-10"}>{LINK_LABELS[pl]}<ExternalLink size={13} /></a>)}
        <button type="button" onClick={() => card.onAdd({ key: `q-${asked}`, title: asked, by: "Search", kind: "music", about: "", query: `${asked} sleep`, on: ["youtube", "spotify", "apple"], mins: 0 })} className={soft + " min-h-10"}><Plus size={15} />Add this search to a playlist</button>
      </div>
    </Panel>}

    {busy && <p className="flex items-center gap-2 text-sm font-semibold text-slate-500"><Loader2 size={16} className="animate-spin" />Finding ideas…</p>}
    {problem && <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-800">{problem}</p>}
    {ai && <section className="space-y-3"><h2 className="flex items-center gap-2 text-lg font-black text-[#232139]"><Sparkles size={18} className="text-violet-600" />AI's ideas for “{asked}”</h2><Grid cards={ai.map(fromAi)} a={card} /><p className="text-xs text-slate-500">AI can be wrong about details; the links search for each idea so you can check.</p></section>}
    {asked && <section className="space-y-3">
      <h2 className="text-lg font-black text-[#232139]">{matches.length ? "From our sleep picks" : "No close matches in our picks"}</h2>
      {matches.length ? <Grid cards={matches.map(fromPick)} a={card} /> : !ai && <p className="text-sm text-slate-500">Try the app links above, or tap “Ask AI” to describe it in your own words.</p>}
    </section>}
  </div>;
}

// ── Playlists ────────────────────────────────────────────────────────────────

function Playlists({ finder, update, openId, setOpenId, newPlaylist, makeId, say, onBrowse }: {
  finder: Finder; update: (fn: (f: Finder) => Finder) => void; openId: string | null; setOpenId: (id: string | null) => void;
  newPlaylist: (name: string, emoji: string) => string | null; makeId: () => string; say: (m: string) => void; onBrowse: () => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const open = finder.playlists.find((p) => p.id === openId);
  if (open) return <PlaylistView pl={open} prefs={finder.prefs} update={update} makeId={makeId} say={say} onBack={() => setOpenId(null)} />;

  const create = (e: FormEvent) => { e.preventDefault(); const n = name.trim(); if (!n) return; const id = newPlaylist(n, emoji); if (id) { setName(""); setOpenId(id); } };
  return <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <div className="space-y-3">
      {finder.playlists.length ? finder.playlists.map((p) => <button key={p.id} type="button" onClick={() => setOpenId(p.id)} data-testid="sleepfinder-playlist"
        className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-[0_3px_16px_#17152b08] transition hover:border-violet-200">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-2xl" aria-hidden>{p.emoji}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-base font-black text-[#232139]">{p.name}</span>
          <span className="block text-xs font-bold text-slate-500">{p.items.length} item{p.items.length === 1 ? "" : "s"}{playlistMinutes(p) ? ` · about ${minutesWords(playlistMinutes(p))}` : ""}</span></span>
        <ArrowRight size={18} className="text-slate-400" />
      </button>) : <Panel><Empty icon={<ListMusic size={24} />} title="No playlists yet" action={<button type="button" onClick={onBrowse} className={soft}><Sparkles size={15} />See your picks</button>}>Make one here, tap “Playlist” on any pick, or let “Make tonight's mix” build one for you.</Empty></Panel>}
    </div>
    <Panel title="New playlist">
      <form onSubmit={create} className="space-y-3">
        <Label text="Name"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={FINDER_LIMITS.name} className={inputClass} placeholder="Rainy nights" data-testid="sleepfinder-new-name" /></Label>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icon">{EMOJIS.map((e) => <button key={e} type="button" role="radio" aria-checked={emoji === e} onClick={() => setEmoji(e)} className={`h-10 w-10 rounded-xl text-lg ${emoji === e ? "bg-violet-100 ring-2 ring-violet-400" : "bg-slate-50"}`}>{e}</button>)}</div>
        <button type="submit" disabled={!name.trim()} className={primary + " w-full"}><Plus size={16} />Create playlist</button>
      </form>
    </Panel>
  </div>;
}

function PlaylistView({ pl, prefs, update, makeId, say, onBack }: { pl: SleepPlaylist; prefs: SleepPrefs | null; update: (fn: (f: Finder) => Finder) => void; makeId: () => string; say: (m: string) => void; onBack: () => void }) {
  const [now, setNow] = useState<number | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(pl.name);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const change = (fn: (p: SleepPlaylist) => SleepPlaylist) => update((f) => ({ ...f, playlists: f.playlists.map((p) => (p.id === pl.id ? fn(p) : p)) }));
  const move = (i: number, d: number) => change((p) => { const items = [...p.items]; const j = i + d; if (j < 0 || j >= items.length) return p; [items[i], items[j]] = [items[j], items[i]]; return { ...p, items }; });
  const remove = (i: number) => { change((p) => ({ ...p, items: p.items.filter((_, n) => n !== i) })); if (now !== null && now >= pl.items.length - 1) setNow(pl.items.length > 1 ? pl.items.length - 2 : null); };
  const play = (i: number) => { const item = pl.items[i]; if (!item) return; setNow(i); window.open(itemLink(item, prefs), "_blank", "noopener,noreferrer"); };
  const addOwn = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim(), raw = link.trim();
    if (!t && !raw) return;
    if (pl.items.length >= FINDER_LIMITS.items) { say("That playlist is full."); return; }
    const looksLikeLink = /^https?:\/\//i.test(raw) || /^[\w-]+\.[\w.-]+\//.test(raw);
    const url = looksLikeLink ? cleanUrl(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`) : "";
    if (looksLikeLink && !url) { say("That link doesn't look right."); return; }
    const item: PlaylistItem = { id: makeId(), ref: "", title: (t || (url ? new URL(url).hostname.replace(/^www\./, "") : raw)).slice(0, FINDER_LIMITS.title), by: url ? "Your link" : "Search", kind: "music", query: url ? "" : (raw || t).slice(0, FINDER_LIMITS.query), url, mins: 0 };
    change((p) => ({ ...p, items: [...p.items, item] }));
    setTitle(""); setLink("");
  };
  const copy = async () => { try { await navigator.clipboard.writeText(playlistText(pl, prefs)); say("Copied. Paste it into a message or a note."); } catch { say("Couldn't copy on this device."); } };
  const del = () => { if (confirmed(`Delete “${pl.name}”?`)) { update((f) => ({ ...f, playlists: f.playlists.filter((p) => p.id !== pl.id) })); onBack(); } };
  const current = now !== null ? pl.items[now] : null;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" onClick={onBack} className={plain}><ArrowLeft size={16} />All playlists</button>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} disabled={!pl.items.length} className={plain}><Copy size={15} />Copy list</button>
        <button type="button" onClick={del} className={danger}><Trash2 size={15} />Delete</button>
      </div>
    </div>

    <Panel>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-3xl" aria-hidden>{pl.emoji}</span>
        <div className="min-w-0 flex-1">
          {renaming ? <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = name.trim(); if (n) change((p) => ({ ...p, name: n.slice(0, FINDER_LIMITS.name) })); setRenaming(false); }}>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={FINDER_LIMITS.name} className={inputClass} autoFocus aria-label="Playlist name" />
            <button type="submit" className={primary} aria-label="Save name"><Check size={16} /></button>
          </form> : <button type="button" onClick={() => { setName(pl.name); setRenaming(true); }} className="group flex items-center gap-2 text-left"><h2 className="break-words text-2xl font-black text-[#232139]">{pl.name}</h2><Pencil size={15} className="text-slate-400 group-hover:text-violet-600" /></button>}
          <p className="text-xs font-bold text-slate-500">{pl.items.length} item{pl.items.length === 1 ? "" : "s"}{playlistMinutes(pl) ? ` · about ${minutesWords(playlistMinutes(pl))}` : ""}</p>
        </div>
        {pl.items.length > 0 && <button type="button" onClick={() => play(now === null ? 0 : now)} className={primary + " min-h-11 px-5"} data-testid="sleepfinder-play"><Play size={16} />{now === null ? "Play from the start" : "Play again"}</button>}
      </div>
      {current && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-[#292446] p-4 text-white" aria-live="polite">
        <div className="min-w-0 flex-1"><p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-violet-200">Now playing {now! + 1} of {pl.items.length}</p><p className="truncate text-base font-black">{current.title}</p></div>
        <button type="button" onClick={() => play(now! - 1)} disabled={now === 0} className="rounded-xl bg-white/10 p-2.5 hover:bg-white/20 disabled:opacity-40" aria-label="Previous"><SkipBack size={18} /></button>
        <button type="button" onClick={() => play(now! + 1)} disabled={now === pl.items.length - 1} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-[#292446] disabled:opacity-40"><SkipForward size={16} />Next</button>
        <button type="button" onClick={() => setNow(null)} className="rounded-xl p-2.5 hover:bg-white/10" aria-label="Stop"><X size={18} /></button>
      </div>}
    </Panel>

    <Panel title="In this playlist">
      {pl.items.length ? <ol className="space-y-2">{pl.items.map((it, i) => <li key={it.id} className={`flex items-center gap-2 rounded-2xl border p-2.5 ${now === i ? "border-violet-300 bg-violet-50" : "border-slate-100"}`}>
        <span className="w-6 shrink-0 text-center text-xs font-black text-slate-400">{i + 1}</span>
        <span className="text-lg" aria-hidden>{KIND_LABELS[it.kind].emoji}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-slate-800">{it.title}</p><p className="truncate text-xs text-slate-500">{[it.by, minutesWords(it.mins)].filter(Boolean).join(" · ")}</p></div>
        <a href={itemLink(it, prefs)} target="_blank" rel="noopener noreferrer" onClick={() => setNow(i)} className="rounded-lg p-2 text-violet-600 hover:bg-violet-50" aria-label={`Open ${it.title}`}><ExternalLink size={16} /></a>
        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Move up"><ArrowUp size={16} /></button>
        <button type="button" onClick={() => move(i, 1)} disabled={i === pl.items.length - 1} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Move down"><ArrowDown size={16} /></button>
        <button type="button" onClick={() => remove(i)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${it.title}`}><Trash2 size={16} /></button>
      </li>)}</ol> : <p className="text-sm text-slate-500">Empty for now. Add picks from “For you” or “Find anything”, or add your own below.</p>}
    </Panel>

    <Panel title="Add your own">
      <form onSubmit={addOwn} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={FINDER_LIMITS.title} className={inputClass} placeholder="Name (optional)" aria-label="Name" />
        <input value={link} onChange={(e) => setLink(e.target.value)} maxLength={FINDER_LIMITS.url} className={inputClass} placeholder="Paste a link, or type what to search for" aria-label="Link or search" data-testid="sleepfinder-own" />
        <button type="submit" disabled={!title.trim() && !link.trim()} className={primary}><Plus size={16} />Add</button>
      </form>
      <p className="mt-2 text-xs text-slate-500">A YouTube, Spotify or Apple link plays that exact thing. Words become a search on your app.</p>
    </Panel>
  </div>;
}

function AddToPlaylist({ card, playlists, onClose, onPick, onNew }: { card: Card; playlists: SleepPlaylist[]; onClose: () => void; onPick: (id: string) => void; onNew: (name: string) => void }) {
  const [name, setName] = useState("");
  return <Modal title={`Add “${card.title}”`} eyebrow="Sleep Finder" onClose={onClose}>
    {playlists.length > 0 && <div className="mb-4 space-y-2">{playlists.map((p) => <button key={p.id} type="button" onClick={() => onPick(p.id)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 p-3 text-left hover:border-violet-200 hover:bg-violet-50">
      <span className="text-xl" aria-hidden>{p.emoji}</span><span className="min-w-0 flex-1 truncate text-sm font-extrabold">{p.name}</span><span className="text-xs font-bold text-slate-400">{p.items.length}</span>
    </button>)}</div>}
    <form onSubmit={(e) => { e.preventDefault(); const n = name.trim(); if (n) onNew(n); }} className="flex gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={FINDER_LIMITS.name} className={inputClass} placeholder={playlists.length ? "Or start a new playlist" : "Name your first playlist"} aria-label="New playlist name" autoFocus={!playlists.length} />
      <button type="submit" disabled={!name.trim()} className={primary}><Plus size={16} />New</button>
    </form>
  </Modal>;
}
