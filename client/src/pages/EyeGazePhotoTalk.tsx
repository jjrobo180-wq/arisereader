// Photo Talk, on Arise AAC's Talk shelf: talking with real photos of the child's own things.
// Four ways to use the same photos (rules: shared/photoTalk.ts):
//   Swipe        one big photo at a time; swipe up for the next, tap the photo to say it
//   Right now    just 3 photos, the ones for this part of her day
//   This or that two photos, plus "neither"
//   My phrases   whole phrases she already uses, each on a photo
// A grown-up adds the photos here (camera or photo library), after the same quick math check as My World;
// a parent's own account skips the check. Photos stay private (server/routes.ts, /api/eye-gaze/photo-talk).
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { sayAI } from "@/lib/aiVoice";
import {
  MAX_CARDS, MAX_PHRASES, TIMES, TIME_LABEL, cardSays, rightNow, swipeTo, thisOrThat, timeOfDay,
  type PhotoCard, type PhotoPhrase, type TimeOfDay,
} from "@shared/photoTalk";

type Card = PhotoCard & { photoUrl?: string | null };
type Phrase = PhotoPhrase & { photoUrl?: string | null };
type Mode = "swipe" | "now" | "pick" | "phrases";
const MODES: Array<{ id: Mode; label: string; d: string }> = [
  { id: "swipe", label: "Swipe", d: "M12 19V5M6 11l6-6 6 6" },
  { id: "now", label: "Right now", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" },
  { id: "pick", label: "This or that", d: "M3 5h8v14H3zM13 5h8v14h-8z" },
  { id: "phrases", label: "My phrases", d: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" },
];
const INK = "#191b35";
const FONT = "Lexend, system-ui, sans-serif";
const TOP = "max(14px, var(--sat-in, env(safe-area-inset-top)))";
const BOTTOM = "max(14px, env(safe-area-inset-bottom))";
const TINTS = ["#ffd9b8", "#cfe2f7", "#cdebc8", "#f7d3e3", "#ffe9a8", "#e3d7f5"];
const say = (text: string) => { if (text) void sayAI(text, { voice: "calm" }).catch(() => false); };
const GROWNUP_KEY = "my-world-grownup-token";
const newId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function Svg({ d, size = 24, width = 2.2 }: { d: string; size?: number; width?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

/** A photo filling its box, or a soft tile with the word when there's no photo yet. */
function Photo({ url, label, tint, className = "", style }: { url?: string | null; label: string; tint: string; className?: string; style?: CSSProperties }) {
  return url
    ? <img src={url} alt="" draggable={false} className={`select-none object-cover ${className}`} style={style} />
    : <div aria-hidden className={`grid place-items-center text-center font-bold ${className}`} style={{ background: tint, color: INK, fontSize: 22, ...style }}>{label}</div>;
}

/** Makes a phone photo small enough to load fast (longest side 1280px, JPEG). A photo the browser can't
 *  read (HEIC on a computer) is sent as it is. */
async function shrink(file: File): Promise<Blob> {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url; });
    const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    return blob && blob.size ? blob : file;
  } catch { return file; }
}

export default function EyeGazePhotoTalk() {
  const { token, user } = useAuth();
  const [, navigate] = useLocation();
  const [cards, setCards] = useState<Card[]>([]);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [isParent, setIsParent] = useState(user?.role === "parent");
  const [childName, setChildName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setModeState] = useState<Mode>(() => { try { return (localStorage.getItem("photo-talk:mode") as Mode) || "swipe"; } catch { return "swipe"; } });
  const setMode = (m: Mode) => { setModeState(m); try { localStorage.setItem("photo-talk:mode", m); } catch { /* fine */ } };
  const [setup, setSetup] = useState(false);
  const [gate, setGate] = useState(false);
  const [grownup, setGrownup] = useState(() => { try { return sessionStorage.getItem(GROWNUP_KEY) || ""; } catch { return ""; } });

  const load = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/eye-gaze/photo-talk`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not load Photo Talk.");
      setCards(data.cards || []); setPhrases(data.phrases || []);
      setIsParent(!!data.isParent); setChildName(data.student?.name || "");
      setError("");
    } catch (e: any) { setError(e?.message || "Could not load Photo Talk."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [token, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // The photo links last an hour: get fresh ones every 45 minutes while the app is open.
  useEffect(() => { const t = window.setInterval(() => void load(), 45 * 60_000); return () => window.clearInterval(t); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const openSetup = () => { if (isParent || grownup) setSetup(true); else setGate(true); };
  const empty = !cards.length && !phrases.length;

  return <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "#f6f3ff", color: INK, fontFamily: FONT }} data-testid="photo-talk">
    <header className="flex shrink-0 items-center gap-2 px-3 pb-2" style={{ paddingTop: TOP }}>
      <button type="button" onClick={() => navigate("/eye-gaze-apps")} aria-label="Back to apps" className="grid h-12 w-12 place-items-center rounded-full bg-white shadow-sm"><Svg d="M15 5l-7 7 7 7" /></button>
      <h1 className="min-w-0 flex-1 truncate text-[22px] font-extrabold">Photo Talk</h1>
      <button type="button" onClick={openSetup} className="flex h-12 items-center gap-2 rounded-full bg-white px-4 text-[15px] font-bold shadow-sm" data-testid="photo-talk-setup"><Svg d="M4 7h3l2-3h6l2 3h3v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" size={20} />Grown-ups</button>
    </header>

    {!empty && <nav className="grid shrink-0 grid-cols-4 gap-2 px-3 pb-2" aria-label="Ways to talk">
      {MODES.map((m) => <button key={m.id} type="button" onClick={() => setMode(m.id)} aria-pressed={mode === m.id}
        className="flex h-[60px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[18px] px-1 text-[13px] font-bold leading-tight sm:h-12 sm:flex-row sm:gap-2 sm:text-[16px]"
        style={mode === m.id ? { background: INK, color: "#fff" } : { background: "#fff", color: INK }}><Svg d={m.d} size={20} />{m.label}</button>)}
    </nav>}

    <main className="relative min-h-0 flex-1" style={{ paddingBottom: BOTTOM }}>
      {loading ? <p className="p-6 text-center text-[17px] font-semibold text-slate-500">Loading her photos…</p>
        : error ? <div className="p-6 text-center"><p className="text-[17px] font-semibold">{error}</p><button type="button" onClick={() => void load()} className="mt-4 h-12 rounded-full bg-white px-6 font-bold shadow-sm">Try again</button></div>
        : empty ? <Empty name={childName} onSetup={openSetup} />
        : mode === "swipe" ? <Swipe cards={cards} />
        : mode === "now" ? <RightNow cards={cards} onMore={() => setMode("swipe")} />
        : mode === "pick" ? <ThisOrThat cards={cards} />
        : <Phrases phrases={phrases} />}
    </main>

    {gate && <GrownupGate token={token} onClose={() => setGate(false)} onPass={(t) => { setGrownup(t); try { sessionStorage.setItem(GROWNUP_KEY, t); } catch { /* fine */ } setGate(false); setSetup(true); }} />}
    {setup && <Setup token={token} grownup={grownup} cards={cards} phrases={phrases}
      onSaved={(c, p) => { setCards(c); setPhrases(p); }}
      onExpired={() => { setGrownup(""); try { sessionStorage.removeItem(GROWNUP_KEY); } catch { /* fine */ } setSetup(false); setGate(true); }}
      onClose={() => setSetup(false)} />}
  </div>;
}

function Empty({ name, onSetup }: { name: string; onSetup: () => void }) {
  return <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
    <div className="grid h-24 w-24 place-items-center rounded-[28px] bg-white shadow-sm"><Svg d="M4 7h3l2-3h6l2 3h3v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" size={44} width={1.8} /></div>
    <h2 className="text-[26px] font-extrabold">No photos yet</h2>
    <p className="text-[17px] leading-snug text-slate-600">Take photos of {name ? `${name.split(" ")[0]}'s` : "her"} own things: her cup, favorite snacks, toys, the swing, the bath, her bed, the car, and the people she loves.</p>
    <button type="button" onClick={onSetup} className="h-14 rounded-full px-7 text-[18px] font-bold text-white" style={{ background: INK }}>Add photos (grown-ups)</button>
  </div>;
}

// ——— Swipe: one big photo at a time ———
function Swipe({ cards }: { cards: Card[] }) {
  const [i, setI] = useState(0);
  const [said, setSaid] = useState("");
  const start = useRef<{ y: number; x: number } | null>(null);
  const at = Math.min(i, cards.length - 1);
  const card = cards[at];
  const go = (step: number) => { setI(swipeTo(at, step, cards.length)); setSaid(""); };
  const speak = (text: string) => { setSaid(text); say(text); };
  if (!card) return null;
  return <div className="flex h-full flex-col gap-3 px-3">
    <div className="flex gap-1.5" aria-hidden>{cards.length <= 30 && cards.map((c, k) => <span key={c.id} className="h-1.5 flex-1 rounded-full" style={{ background: k === at ? INK : "rgba(25,27,53,.18)" }} />)}</div>
    <div className="relative min-h-0 flex-1">
      <button type="button" aria-label={`Say ${cardSays(card)}`} data-testid="photo-talk-swipe-card"
        className="absolute inset-0 flex flex-col overflow-hidden rounded-[32px] bg-white text-left shadow-[0_6px_24px_rgba(25,27,53,.12)]"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => { start.current = { y: e.clientY, x: e.clientX }; }}
        onPointerUp={(e) => {
          const s = start.current; start.current = null;
          if (!s) return;
          const dy = e.clientY - s.y;
          if (dy < -60) go(1); else if (dy > 60) go(-1); else if (Math.abs(dy) < 14 && Math.abs(e.clientX - s.x) < 14) speak(cardSays(card));
        }}
        onKeyDown={(e) => { if (e.key === "ArrowDown") go(1); if (e.key === "ArrowUp") go(-1); }}
        onClick={(e) => { if (e.detail === 0) speak(cardSays(card)); }}>
        <Photo url={card.photoUrl} label={card.label} tint={TINTS[at % TINTS.length]} className="min-h-0 w-full flex-1" />
        <span className="flex shrink-0 items-center justify-between gap-3 px-5 py-4">
          <span className="min-w-0 truncate text-[34px] font-extrabold leading-none">{card.label}</span>
          <span className="shrink-0 text-[15px] font-semibold text-slate-500">{said ? `Said: ${said}` : "Tap to say it"}</span>
        </span>
      </button>
      <div className="absolute bottom-24 right-3 flex flex-col gap-3">
        <RoundBtn onClick={() => speak(`more ${card.label}`)}>more</RoundBtn>
        <RoundBtn onClick={() => { say("not this one"); go(1); }}>not this</RoundBtn>
        <RoundBtn dark onClick={() => speak("all done")}>all done</RoundBtn>
      </div>
    </div>
    <div className="grid shrink-0 grid-cols-2 gap-3">
      <button type="button" onClick={() => go(-1)} className="flex h-16 items-center justify-center gap-2 rounded-[22px] bg-white text-[19px] font-bold shadow-sm"><Svg d="M12 5v14M6 13l6 6 6-6" />back</button>
      <button type="button" onClick={() => go(1)} className="flex h-16 items-center justify-center gap-2 rounded-[22px] bg-white text-[19px] font-bold shadow-sm" data-testid="photo-talk-next"><Svg d="M12 19V5M6 11l6-6 6 6" />next</button>
    </div>
  </div>;
}

function RoundBtn({ children, onClick, dark }: { children: ReactNode; onClick: () => void; dark?: boolean }) {
  return <button type="button" onClick={onClick} className="grid h-[68px] w-[68px] place-items-center rounded-full text-[14px] font-extrabold leading-tight shadow-[0_2px_10px_rgba(25,27,53,.18)]"
    style={dark ? { background: INK, color: "#fff" } : { background: "#fff", color: INK }}>{children}</button>;
}

// ——— Right now: 3 photos for this part of the day ———
function RightNow({ cards, onMore }: { cards: Card[]; onMore: () => void }) {
  const [time, setTime] = useState<TimeOfDay>(() => timeOfDay(new Date().getHours()));
  useEffect(() => { const t = window.setInterval(() => setTime(timeOfDay(new Date().getHours())), 60_000); return () => window.clearInterval(t); }, []);
  const three = useMemo(() => rightNow(cards, time), [cards, time]);
  const [picked, setPicked] = useState<string | null>(null);
  return <div className="mx-auto flex h-full max-w-3xl flex-col gap-3 px-3">
    <div className="text-[15px] font-bold text-[#8a5a1e]">{TIME_LABEL[time]}</div>
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {three.map((c, k) => <button key={c.id} type="button" onClick={() => { setPicked(c.id); say(cardSays(c)); }} data-testid="photo-talk-now"
        className="flex min-h-0 flex-1 items-center gap-4 overflow-hidden rounded-[28px] bg-white p-3 text-left shadow-sm"
        style={{ outline: picked === c.id ? `5px solid ${INK}` : "none", outlineOffset: -5 }}>
        <Photo url={c.photoUrl} label={c.label} tint={TINTS[k % TINTS.length]} className="aspect-square h-full max-h-[200px] shrink-0 rounded-[20px]" />
        <span className="min-w-0 text-[30px] font-extrabold leading-tight">{c.label}</span>
      </button>)}
    </div>
    <button type="button" onClick={onMore} className="h-16 shrink-0 rounded-[22px] border-[3px] bg-white text-[19px] font-bold" style={{ borderColor: INK }}>something else</button>
  </div>;
}

// ——— This or that ———
function ThisOrThat({ cards }: { cards: Card[] }) {
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const pair = thisOrThat(cards, round);
  if (!pair) return <p className="p-6 text-center text-[18px] font-semibold">Add at least 2 photos for This or that.</p>;
  const next = () => { setRound(round + 1); setPicked(null); };
  return <div className="mx-auto flex h-full max-w-4xl flex-col gap-3 px-3">
    <div className="grid min-h-0 flex-1 grid-rows-2 gap-3 sm:grid-cols-2 sm:grid-rows-1">
      {pair.map((c, k) => <button key={c.id} type="button" onClick={() => { setPicked(c.id); say(cardSays(c)); }} data-testid="photo-talk-pick"
        className="flex min-h-0 flex-col overflow-hidden rounded-[30px] bg-white shadow-sm"
        style={{ outline: picked === c.id ? `6px solid ${INK}` : "none", outlineOffset: -6, opacity: picked && picked !== c.id ? 0.45 : 1 }}>
        <Photo url={c.photoUrl} label={c.label} tint={TINTS[k]} className="min-h-0 w-full flex-1" />
        <span className="shrink-0 px-4 py-3 text-center text-[30px] font-extrabold">{c.label}</span>
      </button>)}
    </div>
    <div className="grid shrink-0 grid-cols-2 gap-3">
      <button type="button" onClick={() => { setPicked(null); say("neither"); }} className="h-16 rounded-[22px] text-[19px] font-bold" style={{ background: "#f7d3e3" }}>neither</button>
      <button type="button" onClick={next} className="h-16 rounded-[22px] text-[19px] font-bold text-white" style={{ background: INK }}>next</button>
    </div>
  </div>;
}

// ——— My phrases ———
function Phrases({ phrases }: { phrases: Phrase[] }) {
  if (!phrases.length) return <p className="p-6 text-center text-[18px] font-semibold">A grown-up can add the phrases she already says, like "Ready, set, go!"</p>;
  return <div className="mx-auto grid h-full max-w-4xl auto-rows-[minmax(96px,1fr)] grid-cols-1 gap-3 overflow-y-auto px-3 pb-2 sm:grid-cols-2">
    {phrases.map((p, k) => <button key={p.id} type="button" onClick={() => say(p.say)} data-testid="photo-talk-phrase"
      className="flex items-center gap-4 overflow-hidden rounded-[26px] p-3 text-left shadow-sm" style={{ background: TINTS[k % TINTS.length] }}>
      {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-[84px] w-[84px] shrink-0 rounded-[18px] object-cover" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white"><Svg d="M8 5v14l11-7z" /></span>}
      <span className="min-w-0"><span className="block text-[24px] font-extrabold leading-tight">{p.say}</span>{p.means && <span className="mt-1 block text-[14px] font-semibold text-slate-600">means: {p.means}</span>}</span>
    </button>)}
  </div>;
}

// ——— Grown-up check (the same one as My World) ———
function GrownupGate({ token, onClose, onPass }: { token: string | null; onClose: () => void; onPass: (t: string) => void }) {
  const [q, setQ] = useState<{ challengeId: string; question: string } | null>(null);
  const [answer, setAnswer] = useState("");
  const [msg, setMsg] = useState("");
  const ask = async (note = "") => {
    setMsg(note); setAnswer("");
    try {
      const res = await fetch(`${API_BASE}/api/eye-gaze/my-world/grownup-challenge`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.message || "Could not open the grown-up check.");
      setQ(r);
    } catch (e: any) { setMsg(e?.message || "Could not open the grown-up check."); }
  };
  useEffect(() => { void ask(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async () => {
    if (!q || !answer.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/eye-gaze/my-world/grownup-challenge`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: q.challengeId, answer: Number(answer) }) });
      const r = await res.json().catch(() => ({}));
      if (!res.ok || !r.grownupToken) return void ask(r.message || "Not quite. Try this one.");
      onPass(r.grownupToken);
    } catch { void ask("Try another one."); }
  };
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-[#191b35]/60 p-4" role="dialog" aria-modal="true" aria-label="Grown-up check">
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="w-full max-w-sm rounded-[28px] bg-white p-6 text-center">
      <h2 className="text-[22px] font-extrabold">Grown-ups only</h2>
      <p className="mt-1 text-[15px] text-slate-600">Answer to add or change photos.</p>
      <label className="mt-5 block text-[30px] font-extrabold" htmlFor="pt-answer">{q?.question || "…"}</label>
      <input id="pt-answer" inputMode="numeric" autoComplete="off" value={answer} onChange={(e) => setAnswer(e.target.value.replace(/[^0-9]/g, ""))}
        className="mt-3 h-14 w-full rounded-2xl border-2 border-slate-200 text-center text-[24px] font-bold outline-none focus:border-[#191b35]" />
      {msg && <p className="mt-3 text-[14px] font-semibold text-rose-700">{msg}</p>}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button type="button" onClick={onClose} className="h-12 rounded-full bg-slate-100 font-bold">Cancel</button>
        <button type="submit" className="h-12 rounded-full font-bold text-white" style={{ background: INK }}>Open</button>
      </div>
    </form>
  </div>;
}

// ——— Setup: add photos and phrases ———
function Setup({ token, grownup, cards: startCards, phrases: startPhrases, onSaved, onExpired, onClose }: {
  token: string | null; grownup: string; cards: Card[]; phrases: Phrase[];
  onSaved: (c: Card[], p: Phrase[]) => void; onExpired: () => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<"photos" | "phrases">("photos");
  const [cards, setCards] = useState<Card[]>(startCards);
  const [phrases, setPhrases] = useState<Phrase[]>(startPhrases);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  const fileFor = useRef<{ kind: "card" | "phrase"; id: string | null }>({ kind: "card", id: null });
  const fileInput = useRef<HTMLInputElement>(null);
  const headers = (extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${token}`, ...(grownup ? { "X-My-World-Grownup-Token": grownup } : {}), ...extra });

  const editCard = (id: string, patch: Partial<Card>) => { setCards((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c))); setDirty(true); };
  const editPhrase = (id: string, patch: Partial<Phrase>) => { setPhrases((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p))); setDirty(true); };
  const move = <T,>(list: T[], i: number, step: number) => { const j = i + step; if (j < 0 || j >= list.length) return list; const out = [...list]; [out[i], out[j]] = [out[j], out[i]]; return out; };

  const pickPhoto = (kind: "card" | "phrase", id: string | null) => { fileFor.current = { kind, id }; fileInput.current?.click(); };
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const target = fileFor.current;
    const list = Array.from(files).slice(0, target.id ? 1 : Math.max(0, MAX_CARDS - cards.length));
    for (let k = 0; k < list.length; k++) {
      setBusy(list.length > 1 ? `Adding photo ${k + 1} of ${list.length}…` : "Adding the photo…");
      try {
        const body = await shrink(list[k]);
        const res = await fetch(`${API_BASE}/api/eye-gaze/my-world/upload`, { method: "POST", headers: headers({ "Content-Type": body.type || "application/octet-stream", "X-My-World-Label": "photo-talk" }), body });
        const r = await res.json().catch(() => ({}));
        if (res.status === 403) { setBusy(""); return onExpired(); }
        if (!res.ok || !r.path) throw new Error(r.message || "That photo didn't upload. Try again.");
        if (target.kind === "phrase" && target.id) editPhrase(target.id, { photoPath: r.path, photoUrl: r.url });
        else if (target.id) editCard(target.id, { photoPath: r.path, photoUrl: r.url });
        else { setCards((cs) => [...cs, { id: newId(), label: "", phrase: "", photoPath: r.path, photoUrl: r.url, times: [] }]); setDirty(true); }
      } catch (e: any) { setMsg(e?.message || "That photo didn't upload."); break; }
    }
    setBusy("");
    if (fileInput.current) fileInput.current.value = "";
  };

  const save = async (): Promise<boolean> => {
    if (cards.some((c) => !c.label.trim())) { setTab("photos"); setMsg("Give every photo a word, like “juice”."); return false; }
    if (phrases.some((p) => !p.say.trim())) { setTab("phrases"); setMsg("Every phrase needs the words she says."); return false; }
    setBusy("Saving…"); setMsg("");
    try {
      const strip = <T extends { photoUrl?: string | null }>(x: T) => { const { photoUrl, ...rest } = x; void photoUrl; return rest; };
      const res = await fetch(`${API_BASE}/api/eye-gaze/photo-talk/config`, { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ cards: cards.map(strip), phrases: phrases.map(strip) }) });
      const r = await res.json().catch(() => ({}));
      if (res.status === 403) { onExpired(); return false; }
      if (!res.ok) throw new Error(r.message || "Could not save.");
      onSaved(r.cards || [], r.phrases || []); setDirty(false); setMsg("Saved.");
      return true;
    } catch (e: any) { setMsg(e?.message || "Could not save."); return false; }
    finally { setBusy(""); }
  };
  const close = async () => { if (!dirty || await save()) onClose(); };

  return <div className="fixed inset-0 z-[85] flex flex-col bg-[#f6f3ff]" role="dialog" aria-modal="true" aria-label="Set up Photo Talk" style={{ fontFamily: FONT, color: INK }} data-testid="photo-talk-editor">
    <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void upload(e.target.files)} data-testid="photo-talk-file" />
    <header className="flex shrink-0 items-center gap-2 px-3 pb-2" style={{ paddingTop: TOP }}>
      <button type="button" onClick={() => void close()} aria-label="Done" className="grid h-12 w-12 place-items-center rounded-full bg-white shadow-sm"><Svg d="M15 5l-7 7 7 7" /></button>
      <h2 className="min-w-0 flex-1 truncate text-[20px] font-extrabold">Set up Photo Talk</h2>
      <button type="button" onClick={() => void save()} disabled={!!busy || !dirty} className="h-12 rounded-full px-5 text-[16px] font-bold text-white disabled:opacity-40" style={{ background: INK }} data-testid="photo-talk-save">Save</button>
    </header>
    <div className="flex shrink-0 gap-2 px-3 pb-2">
      {(["photos", "phrases"] as const).map((t) => <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t} className="h-11 rounded-full px-5 text-[15px] font-bold" style={tab === t ? { background: INK, color: "#fff" } : { background: "#fff" }}>{t === "photos" ? `Photos (${cards.length})` : `Phrases (${phrases.length})`}</button>)}
    </div>
    {(busy || msg) && <p className="mx-3 mb-2 rounded-2xl bg-white px-4 py-3 text-[15px] font-semibold" role="status">{busy || msg}</p>}
    <div className="min-h-0 flex-1 overflow-y-auto px-3" style={{ paddingBottom: BOTTOM }}>
      {tab === "photos" ? <>
        <button type="button" onClick={() => pickPhoto("card", null)} disabled={cards.length >= MAX_CARDS || !!busy} data-testid="photo-talk-add"
          className="mb-3 flex h-16 w-full items-center justify-center gap-2 rounded-[22px] border-[3px] border-dashed border-[#8b7bb8] bg-white text-[18px] font-bold disabled:opacity-40"><Svg d="M12 5v14M5 12h14" />Take or choose photos</button>
        <p className="mb-3 px-1 text-[14px] text-slate-600">Her own things work best: her cup, not just any cup. Mark when each one fits her day; Right now shows those 3 first.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((c, i) => <div key={c.id} className="rounded-[22px] bg-white p-3 shadow-sm">
            <div className="flex gap-3">
              <button type="button" onClick={() => pickPhoto("card", c.id)} aria-label={`Change the photo for ${c.label || "this card"}`} className="shrink-0">
                <Photo url={c.photoUrl} label="+ photo" tint={TINTS[i % TINTS.length]} className="h-24 w-24 rounded-2xl" style={{ fontSize: 14 }} />
              </button>
              <div className="min-w-0 flex-1 space-y-2">
                <label className="block"><span className="sr-only">Word</span>
                  <input value={c.label} onChange={(e) => editCard(c.id, { label: e.target.value })} placeholder="Word (juice)" maxLength={40} className="h-11 w-full rounded-xl border-2 border-slate-200 px-3 text-[17px] font-bold outline-none focus:border-[#191b35]" /></label>
                <label className="block"><span className="sr-only">What it says</span>
                  <input value={c.phrase} onChange={(e) => editCard(c.id, { phrase: e.target.value })} placeholder={c.label ? `Says: I want ${c.label}` : "What it says"} maxLength={120} className="h-11 w-full rounded-xl border-2 border-slate-200 px-3 text-[15px] outline-none focus:border-[#191b35]" /></label>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="When it fits her day">
              {TIMES.map((t) => { const on = c.times.includes(t); return <button key={t} type="button" aria-pressed={on} onClick={() => editCard(c.id, { times: on ? c.times.filter((x) => x !== t) : [...c.times, t] })}
                className="h-9 rounded-full px-3 text-[13px] font-bold" style={on ? { background: INK, color: "#fff" } : { background: "#f1eef9" }}>{TIME_LABEL[t]}</button>; })}
            </div>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => { setCards(move(cards, i, -1)); setDirty(true); }} disabled={i === 0} className="h-10 flex-1 rounded-xl bg-[#f1eef9] text-[14px] font-bold disabled:opacity-40">Move up</button>
              <button type="button" onClick={() => { setCards(move(cards, i, 1)); setDirty(true); }} disabled={i === cards.length - 1} className="h-10 flex-1 rounded-xl bg-[#f1eef9] text-[14px] font-bold disabled:opacity-40">Move down</button>
              <button type="button" onClick={() => { setCards(cards.filter((x) => x.id !== c.id)); setDirty(true); }} className="h-10 flex-1 rounded-xl bg-rose-50 text-[14px] font-bold text-rose-700">Remove</button>
            </div>
          </div>)}
        </div>
      </> : <>
        <button type="button" onClick={() => { setPhrases([...phrases, { id: newId(), say: "", means: "", photoPath: null }]); setDirty(true); }} disabled={phrases.length >= MAX_PHRASES}
          className="mb-3 flex h-16 w-full items-center justify-center gap-2 rounded-[22px] border-[3px] border-dashed border-[#8b7bb8] bg-white text-[18px] font-bold disabled:opacity-40" data-testid="photo-talk-add-phrase"><Svg d="M12 5v14M5 12h14" />Add a phrase she says</button>
        <p className="mb-3 px-1 text-[14px] text-slate-600">Phrases she already uses, from a show or from you ("Ready, set, go!", "Uh oh!"), and what she means by them.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {phrases.map((p, i) => <div key={p.id} className="rounded-[22px] bg-white p-3 shadow-sm">
            <div className="flex gap-3">
              <button type="button" onClick={() => pickPhoto("phrase", p.id)} aria-label="Add a photo for this phrase" className="shrink-0">
                <Photo url={p.photoUrl} label="+ photo" tint={TINTS[i % TINTS.length]} className="h-20 w-20 rounded-2xl" style={{ fontSize: 14 }} />
              </button>
              <div className="min-w-0 flex-1 space-y-2">
                <input value={p.say} onChange={(e) => editPhrase(p.id, { say: e.target.value })} placeholder="She says: Ready, set, go!" aria-label="What she says" maxLength={120} className="h-11 w-full rounded-xl border-2 border-slate-200 px-3 text-[16px] font-bold outline-none focus:border-[#191b35]" />
                <input value={p.means} onChange={(e) => editPhrase(p.id, { means: e.target.value })} placeholder="It means: let's start" aria-label="What it means" maxLength={120} className="h-11 w-full rounded-xl border-2 border-slate-200 px-3 text-[15px] outline-none focus:border-[#191b35]" />
              </div>
            </div>
            <button type="button" onClick={() => { setPhrases(phrases.filter((x) => x.id !== p.id)); setDirty(true); }} className="mt-2 h-10 w-full rounded-xl bg-rose-50 text-[14px] font-bold text-rose-700">Remove</button>
          </div>)}
        </div>
      </>}
    </div>
  </div>;
}
