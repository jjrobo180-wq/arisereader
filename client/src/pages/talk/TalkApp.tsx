// Arise Talk: tap words to build a message, and it's said out loud in a natural AI voice.
// Talk (the boards), Type (a keyboard that guesses the next word), Phrases (ready to say) and More
// (voice, look, touch, About me, backup, Premium). Works without an account; signing in backs the
// words up and unlocks Premium. Pieces: TalkEdit.tsx (changing buttons and boards), TalkSheets.tsx
// (the other tabs and sheets), talkStore.ts (saving and the voice), shared/talk.ts (the words).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ChevronLeft, Delete, Ear, Keyboard, LayoutGrid, Maximize2, MessageSquareText, Pencil, Plus, Settings, Sparkles, Undo2, Volume2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fillIn, messageText, nextWords, spoken, wordForms, type TalkBoard, type TalkButton, type TalkData } from "@shared/talk";
import { prefetch, say, stopSaying, talkApi, useTalkData, type TalkMe } from "./talkStore";
import { Layer, T, font, haptic, tileColors, useTalkTheme } from "./talkUi";
import { BoardEditor, ButtonEditor } from "./TalkEdit";
import { ListenSheet, MoreTab, Onboarding, PhrasesTab, PinSheet, PremiumSheet, SentenceSheet, ShowSheet, SignInSheet, SnapSheet, TypeTab } from "./TalkSheets";

type Tab = "talk" | "type" | "phrases" | "more";
type Token = { id: number; text: string; emoji?: string; photo?: string };
export type Talk = ReturnType<typeof useTalk>;

/** Everything the screens share: the data, the voice, the account and Premium. */
function useTalk() {
  const store = useTalkData();
  const { data } = store;
  const { user, token } = useAuth();
  const [me, setMe] = useState<TalkMe | null>(null);
  const [toast, setToast] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const flash = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast((t) => (t === m ? "" : t)), 3200); }, []);
  const s = data.settings;
  const speak = useCallback(async (text: string, opts: { remember?: boolean } = {}) => {
    const t = fillIn(text, data.about).trim();
    if (!t) return;
    setSpeaking(true);
    await say(t, s.voice, s.rate, { error: flash });
    setSpeaking(false);
    if (opts.remember) store.update((d) => ({ ...d, recent: [t, ...d.recent.filter((r) => r !== t)].slice(0, 60) }), { undo: false });
  }, [data.about, s.voice, s.rate, flash, store]);
  const refreshMe = useCallback(async () => {
    if (!token) { setMe(null); return; }
    try { setMe(await talkApi<TalkMe>(token, "/me")); } catch { /* offline: keep what we know */ }
  }, [token]);
  useEffect(() => { void refreshMe(); }, [refreshMe]);
  return { ...store, user, token, me, refreshMe, premium: !!me?.premium, speak, speaking, stop: () => { stopSaying(); setSpeaking(false); }, toast, flash };
}

export default function TalkApp() {
  const talk = useTalk();
  const { data, update, token } = talk;
  const s = data.settings;
  const isDark = useTalkTheme(s.theme);
  const [tab, setTab] = useState<Tab>("talk");
  const [sheet, setSheet] = useState<"" | "listen" | "snap" | "premium" | "signin" | "show" | "sentence" | "pin">("");
  const [afterPin, setAfterPin] = useState<(() => void) | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [message, setMessage] = useState<Token[]>([]);
  const nextId = useRef(1);

  /** Things that change the app ask for the code first, when there is one. */
  const guarded = (fn: () => void) => { if (!s.lock || unlocked) fn(); else { setAfterPin(() => fn); setSheet("pin"); } };
  const needPremium = (fn: () => void) => { if (talk.premium) fn(); else setSheet("premium"); };

  // Back from Stripe: Premium turns on.
  useEffect(() => {
    const m = window.location.hash.match(/premium=(cs_[A-Za-z0-9_]+)/);
    if (!m || !token) return;
    window.history.replaceState(null, "", window.location.pathname + "#/talk");
    talkApi(token, "/premium/confirm", { method: "POST", body: JSON.stringify({ session: m[1] }) })
      .then(() => { void talk.refreshMe(); talk.flash("Premium is on. Thank you!"); }).catch((e) => talk.flash(e.message));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Backups: a new phone with an account gets its words back; after that, changes are saved a few seconds later.
  const restored = useRef(false);
  useEffect(() => {
    if (!token || restored.current) return;
    restored.current = true;
    if (Date.parse(data.updatedAt) > 0) return;
    talkApi<{ data: TalkData | null }>(token, "/backup").then((b) => { if (b.data) { talk.replace(b.data); talk.flash("Your words are back."); } }).catch(() => {});
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!token || Date.parse(data.updatedAt) <= 0) return;
    const t = setTimeout(() => { void talkApi(token, "/backup", { method: "PUT", body: JSON.stringify({ data }) }).catch(() => {}); }, 6000);
    return () => clearTimeout(t);
  }, [token, data]);

  const add = (b: Pick<TalkButton, "label" | "say" | "emoji" | "photo">, text?: string) => {
    const t = text ?? spoken(b, data.about);
    setMessage((m) => [...m, { id: nextId.current++, text: t, emoji: b.emoji, photo: b.photo }]);
    if (s.speakWords) void talk.speak(t);
  };
  const text = messageText(message.map((m) => m.text));
  const sayMessage = async () => {
    if (!text) return;
    haptic(s.haptics, "medium");
    await talk.speak(text, { remember: true });
    if (s.clearAfter) setMessage([]);
  };
  // The message is fetched while it's being built, so Speak starts at once.
  useEffect(() => {
    if (message.length < 2) return;
    const t = setTimeout(() => prefetch([fillIn(text, data.about)], s.voice), 1100);
    return () => clearTimeout(t);
  }, [text, s.voice]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data.onboarded) return <Onboarding talk={talk} onDone={(signIn) => { update((d) => ({ ...d, onboarded: true })); if (signIn) setSheet("signin"); }} />;

  return <div className="fixed inset-0 flex flex-col" style={{ ...font, background: T.bg, color: T.text }} data-testid="talk-app">
    {/* The message */}
    <div className="px-3 pt-[max(10px,env(safe-area-inset-top))]">
      <MessageBar tokens={message} speaking={talk.speaking} onSay={sayMessage} onRemove={(id) => setMessage((m) => m.filter((x) => x.id !== id))}
        onBack={() => setMessage((m) => m.slice(0, -1))} onClear={() => { setMessage([]); talk.stop(); }} />
      <div className="mt-2 flex items-center gap-1.5">
        <ToolBtn label="Show" onClick={() => text && setSheet("show")} testId="talk-show"><Maximize2 className="h-[18px] w-[18px]" /></ToolBtn>
        <ToolBtn label="Sentence" accent onClick={() => text && needPremium(() => setSheet("sentence"))} testId="talk-sentence"><Sparkles className="h-[18px] w-[18px]" /></ToolBtn>
        <ToolBtn label="Listen" onClick={() => needPremium(() => setSheet("listen"))} testId="talk-listen"><Ear className="h-[18px] w-[18px]" /></ToolBtn>
        <ToolBtn label="Snap" onClick={() => needPremium(() => setSheet("snap"))} testId="talk-snap"><Camera className="h-[18px] w-[18px]" /></ToolBtn>
      </div>
    </div>

    <main className="min-h-0 flex-1 overflow-hidden">
      {tab === "talk" && <TalkTab talk={talk} isDark={isDark} message={message} onAdd={add} guarded={guarded} />}
      {tab === "type" && <TypeTab talk={talk} />}
      {tab === "phrases" && <PhrasesTab talk={talk} guarded={guarded} />}
      {tab === "more" && <MoreTab talk={talk} guarded={guarded} onPremium={() => setSheet("premium")} onSignIn={() => setSheet("signin")} />}
    </main>

    <nav className="flex shrink-0 justify-around px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5" style={{ background: T.bg, borderTop: `1px solid ${T.line}` }}>
      {([["talk", "Talk", LayoutGrid], ["type", "Type", Keyboard], ["phrases", "Phrases", MessageSquareText], ["more", "More", Settings]] as const).map(([id, label, Icon]) =>
        <button key={id} type="button" onClick={() => { setTab(id); haptic(s.haptics); }} aria-current={tab === id ? "page" : undefined} className="flex min-h-[50px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold" style={{ color: tab === id ? T.accent : T.dim }} data-testid={`talk-tab-${id}`}>
          <Icon className="h-[22px] w-[22px]" strokeWidth={tab === id ? 2.4 : 2} />{label}</button>)}
    </nav>

    {sheet === "show" && <ShowSheet text={fillIn(text, data.about)} onClose={() => setSheet("")} onSay={sayMessage} />}
    {sheet === "sentence" && <SentenceSheet talk={talk} words={message.map((m) => m.text).join(" ")} onClose={() => setSheet("")} onPick={(t) => { setMessage([{ id: nextId.current++, text: t }]); void talk.speak(t, { remember: true }); setSheet(""); }} />}
    {sheet === "listen" && <ListenSheet talk={talk} onClose={() => setSheet("")} />}
    {sheet === "snap" && <SnapSheet talk={talk} onClose={() => setSheet("")} onAdd={(w) => add(w)} />}
    {sheet === "premium" && <PremiumSheet talk={talk} onClose={() => setSheet("")} onSignIn={() => setSheet("signin")} />}
    {sheet === "signin" && <SignInSheet onClose={() => setSheet("")} />}
    {sheet === "pin" && <PinSheet code={s.lock} onClose={() => setSheet("")} onOk={() => { setUnlocked(true); setSheet(""); afterPin?.(); setAfterPin(null); }} />}
    {talk.toast && <Layer><div className="tk-in pointer-events-none fixed inset-x-0 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[500] flex justify-center px-6" style={font}><div className="rounded-full px-4 py-2.5 text-[14px] font-semibold text-white shadow-lg" style={{ background: "rgba(22,22,29,.92)" }} role="status">{talk.toast}</div></div></Layer>}
  </div>;
}

function ToolBtn({ children, label, onClick, accent, testId }: { children: React.ReactNode; label: string; onClick: () => void; accent?: boolean; testId?: string }) {
  return <button type="button" onClick={onClick} className="tk-press flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold" style={accent ? { background: T.accentSoft, color: T.accent } : { background: T.card, color: T.text, boxShadow: T.shadow }} data-testid={testId}>{children}{label}</button>;
}

/** The message: words as they're tapped. Tap it to say it all; tap a word's × to take it out. */
function MessageBar({ tokens, speaking, onSay, onRemove, onBack, onClear }: { tokens: Token[]; speaking: boolean; onSay: () => void; onRemove: (id: number) => void; onBack: () => void; onClear: () => void }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", inline: "end" }); }, [tokens.length]);
  return <div className="flex items-stretch gap-2">
    <div role="button" tabIndex={0} onClick={onSay} onKeyDown={(e) => { if (e.key === "Enter") onSay(); }} aria-label="Say the message" className="flex min-h-[76px] min-w-0 flex-1 items-center overflow-x-auto rounded-[20px] px-3 [scrollbar-width:none]" style={{ background: T.card, boxShadow: speaking ? `0 0 0 2px ${T.accent}, ${T.shadow}` : T.shadow }} data-testid="talk-message">
      {tokens.length ? <div className="flex items-center gap-1.5 py-2">
        {tokens.map((t) => <span key={t.id} className="tk-in group relative flex shrink-0 items-center gap-1 rounded-[12px] py-1.5 pl-2 pr-2.5 text-[20px] font-semibold" style={{ background: T.card2 }}>
          {t.photo ? <img src={t.photo} alt="" className="h-7 w-7 rounded-[6px] object-cover" /> : t.emoji ? <span className="text-[22px] leading-none">{t.emoji}</span> : null}{t.text}
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(t.id); }} aria-label={`Take out ${t.text}`} className="-mr-1 ml-0.5 grid h-5 w-5 place-items-center rounded-full opacity-40"><X className="h-3.5 w-3.5" /></button>
        </span>)}
        <div ref={end} />
      </div> : <span className="text-[17px]" style={{ color: T.dim }}>Tap words to talk</span>}
    </div>
    <div className="flex shrink-0 flex-col gap-1.5">
      <button type="button" onClick={onSay} aria-label="Speak" className="tk-press grid h-[50px] w-[58px] place-items-center rounded-[16px]" style={{ background: T.accent, color: T.onAccent }} data-testid="talk-speak">
        {speaking ? <span className="tk-wave flex h-4 items-center"><span /><span /><span /><span /></span> : <Volume2 className="h-6 w-6" />}</button>
      <div className="flex gap-1">
        <button type="button" onClick={onBack} aria-label="Delete last word" className="tk-press grid h-7 flex-1 place-items-center rounded-[10px]" style={{ background: T.card, boxShadow: T.shadow }} data-testid="talk-back"><Delete className="h-4 w-4" /></button>
        <button type="button" onClick={onClear} aria-label="Clear" className="tk-press grid h-7 flex-1 place-items-center rounded-[10px]" style={{ background: T.card, boxShadow: T.shadow }} data-testid="talk-clear"><X className="h-4 w-4" /></button>
      </div>
    </div>
  </div>;
}

/** The boards: quick phrases, the row of boards, and the word grid. */
function TalkTab({ talk, isDark, message, onAdd, guarded }: { talk: Talk; isDark: boolean; message: Token[]; onAdd: (b: Pick<TalkButton, "label" | "say" | "emoji" | "photo">, text?: string) => void; guarded: (fn: () => void) => void }) {
  const { data, update } = talk;
  const s = data.settings;
  const [boardId, setBoardId] = useState("core");
  const [trail, setTrail] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [editBtn, setEditBtn] = useState<{ board: string; index: number } | null>(null);
  const [editBoard, setEditBoard] = useState<string | null>(null);
  const [forms, setForms] = useState<TalkButton | null>(null);
  const board = data.boards.find((b) => b.id === boardId) ?? data.boards[0];
  const quick = s.quick.map((id) => data.phrases.find((p) => p.id === id)).filter(Boolean) as { id: string; text: string }[];
  const width = useWidth();
  const cols = s.cols || (width < 500 ? 5 : width < 820 ? 7 : 8);
  const shown = editing ? board.buttons : board.buttons.filter((b) => !b.hidden);
  const next = useMemo(() => nextWords(message.map((m) => m.text), data.recent, 5), [message, data.recent]);

  // The words on this board (and the quick phrases) are fetched ahead.
  useEffect(() => {
    prefetch([...board.buttons.filter((b) => !b.hidden && !b.opens).map((b) => spoken(b, data.about)), ...quick.map((q) => fillIn(q.text, data.about))], s.voice);
  }, [board.id, s.voice]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (id: string) => { setTrail((t) => [...t, board.id]); setBoardId(id); haptic(s.haptics); };
  const back = () => { const t = [...trail]; const prev = t.pop(); setTrail(t); setBoardId(prev ?? "core"); };
  const tap = (b: TalkButton, i: number) => {
    if (editing) { setEditBtn({ board: board.id, index: i }); return; }
    haptic(s.haptics);
    if (b.opens) { open(b.opens); return; }
    if (b.now) { void talk.speak(spoken(b, data.about), { remember: true }); return; }
    onAdd(b);
  };
  const addBoard = () => guarded(() => {
    const id = `mine-${Date.now().toString(36)}`;
    update((d) => ({ ...d, boards: [...d.boards, { id, name: "New board", emoji: "📁", buttons: [], mine: true }] }));
    setBoardId(id); setEditing(true); setEditBoard(id);
  });

  return <div className="flex h-full flex-col">
    {/* Quick phrases */}
    <div className="flex shrink-0 gap-1.5 overflow-x-auto px-3 pb-1 pt-2.5 [scrollbar-width:none]" data-testid="talk-quick">
      {quick.map((q) => <button key={q.id} type="button" onClick={() => { haptic(s.haptics); void talk.speak(q.text, { remember: true }); }} className="tk-press h-10 shrink-0 rounded-full px-4 text-[15px] font-semibold" style={{ background: T.card, boxShadow: T.shadow }}>{fillIn(q.text, data.about).replace(/[.!]$/, "")}</button>)}
      {message.length > 0 && next.map((w) => <button key={`n-${w}`} type="button" onClick={() => onAdd({ label: w })} className="tk-press h-10 shrink-0 rounded-full px-4 text-[15px] font-semibold" style={{ background: T.accentSoft, color: T.accent }} data-testid="talk-next">{w}</button>)}
    </div>
    {/* The boards */}
    <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto px-3 py-1.5 [scrollbar-width:none]" data-testid="talk-boards">
      {trail.length > 0 && <button type="button" onClick={back} aria-label="Back" className="tk-press grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: T.card2 }}><ChevronLeft className="h-5 w-5" /></button>}
      {data.boards.filter((b) => !data.boards.some((x) => x.buttons.some((y) => y.opens === b.id)) || b.id === board.id).map((b) => <button key={b.id} type="button" onClick={() => { setTrail([]); setBoardId(b.id); haptic(s.haptics); }} aria-pressed={b.id === board.id} className="tk-press flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold" style={b.id === board.id ? { background: T.text, color: T.bg } : { background: T.card, boxShadow: T.shadow }} data-testid={`talk-board-${b.id}`}><span className="text-[17px]">{b.emoji}</span>{b.name}</button>)}
      {editing && <button type="button" onClick={addBoard} className="tk-press flex h-10 shrink-0 items-center gap-1 rounded-full px-3.5 text-[14px] font-semibold" style={{ background: T.accentSoft, color: T.accent }} data-testid="talk-add-board"><Plus className="h-4 w-4" />Board</button>}
    </div>
    {/* Editing bar */}
    <div className="flex shrink-0 items-center gap-2 px-3 pb-1.5 pt-0.5">
      <p className="min-w-0 flex-1 truncate text-[13px]" style={{ color: T.dim }}>{editing ? "Tap a button to change it" : board.name}</p>
      {editing && talk.canUndo && <button type="button" onClick={talk.undo} className="tk-press flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-semibold" style={{ background: T.card2 }} data-testid="talk-undo"><Undo2 className="h-4 w-4" />Undo</button>}
      {editing && <button type="button" onClick={() => setEditBoard(board.id)} className="tk-press flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-semibold" style={{ background: T.card2 }} data-testid="talk-board-settings">Board</button>}
      <button type="button" onClick={() => (editing ? setEditing(false) : guarded(() => setEditing(true)))} className="tk-press flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-semibold" style={editing ? { background: T.accent, color: T.onAccent } : { background: T.card2 }} data-testid="talk-edit">{editing ? "Done" : <><Pencil className="h-3.5 w-3.5" />Edit</>}</button>
    </div>
    {/* The words */}
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} data-testid="talk-grid">
        {shown.map((b) => <Tile key={b.id} b={b} isDark={isDark} editing={editing} size={s.text} labels={s.labels} hold={s.hold} repeat={s.repeat}
          onTap={() => tap(b, board.buttons.indexOf(b))} onHold={() => { const f = wordForms(b.label, b.kind); if (f.length && !editing) { haptic(s.haptics, "medium"); setForms(b); } }} />)}
        {editing && <button type="button" onClick={() => setEditBtn({ board: board.id, index: -1 })} className="tk-press grid aspect-[5/6] place-items-center rounded-[16px] border-2 border-dashed" style={{ borderColor: T.line, color: T.accent }} data-testid="talk-add-button"><Plus className="h-7 w-7" /></button>}
      </div>
      {!shown.length && !editing && <p className="py-10 text-center text-[15px]" style={{ color: T.dim }}>This board is empty. Tap Edit to add words.</p>}
    </div>
    {forms && <FormsPop b={forms} onClose={() => setForms(null)} onPick={(w) => { onAdd({ ...forms, say: undefined, label: w }, w); setForms(null); }} />}
    {editBtn && <ButtonEditor talk={talk} boardId={editBtn.board} index={editBtn.index} onClose={() => setEditBtn(null)} />}
    {editBoard && <BoardEditor talk={talk} boardId={editBoard} onClose={() => setEditBoard(null)} onDeleted={() => { setEditBoard(null); setBoardId("core"); setTrail([]); }} />}
  </div>;
}

function useWidth() {
  const [w, setW] = useState(() => (typeof window === "undefined" ? 390 : window.innerWidth));
  useEffect(() => { const on = () => setW(window.innerWidth); window.addEventListener("resize", on); return () => window.removeEventListener("resize", on); }, []);
  return w;
}

/** One word. Tap it (or hold it, when "hold to select" is on). Hold longer for its other forms. */
function Tile({ b, isDark, editing, size, labels, hold, repeat, onTap, onHold }: { b: TalkButton; isDark: boolean; editing: boolean; size: "s" | "m" | "l"; labels: boolean; hold: number; repeat: number; onTap: () => void; onHold: () => void }) {
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const last = useRef(0);
  const [filling, setFilling] = useState(false);
  const [lit, setLit] = useState(0);
  const fire = () => { const t = Date.now(); if (repeat && t - last.current < repeat) return; last.current = t; setLit((n) => n + 1); onTap(); };
  const down = () => {
    held.current = false;
    if (hold && !editing) { setFilling(true); timer.current = window.setTimeout(() => { held.current = true; setFilling(false); fire(); }, hold); }
    else timer.current = window.setTimeout(() => { held.current = true; onHold(); }, 600);
  };
  const up = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = null; setFilling(false); if (!held.current && !hold) fire(); if (!held.current && hold && editing) fire(); held.current = false; };
  const cancel = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = null; setFilling(false); held.current = true; };
  const c = tileColors(b.kind, isDark);
  const emojiSize = size === "l" ? 40 : size === "s" ? 26 : 32;
  const labelSize = size === "l" ? 17 : size === "s" ? 12 : 14;
  return <button type="button" onPointerDown={down} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire(); } }} onPointerUp={up} onPointerLeave={cancel} onPointerCancel={cancel} onContextMenu={(e) => e.preventDefault()}
    className="tk-press relative flex aspect-[5/6] select-none flex-col items-center justify-center overflow-hidden rounded-[16px] border-[1.5px] px-1"
    style={{ ...(b.opens ? { background: isDark ? "#1c1c22" : "#ffffff", borderColor: c.borderColor } : { ...c, borderColor: `${c.borderColor}55` }), opacity: b.hidden ? 0.4 : 1, WebkitTouchCallout: "none" }}
    aria-label={b.label} data-testid={`talk-btn-${b.id}`}>
    {lit > 0 && <span key={lit} aria-hidden className="tk-flash pointer-events-none absolute inset-0 rounded-[16px]" />}
    {filling && <span aria-hidden className="absolute inset-x-0 bottom-0 bg-black/10" style={{ height: "100%", transformOrigin: "bottom", animation: `tkHold ${hold}ms linear forwards` }} />}
    {b.photo ? <img src={b.photo} alt="" draggable={false} className="mb-1 aspect-square w-[64%] rounded-[10px] object-cover" />
      : b.emoji ? <span className="leading-none" style={{ fontSize: emojiSize }}>{b.emoji}</span>
      : <span className="font-bold leading-none tracking-[-.02em]" style={{ fontSize: emojiSize * 0.72 }}>{b.label}</span>}
    {labels && (b.emoji || b.photo) && <span className="mt-1 line-clamp-2 w-full text-center font-semibold leading-[1.1]" style={{ fontSize: labelSize }}>{b.label}</span>}
    {b.opens && <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full" style={{ background: c.borderColor }} />}
    {editing && <span aria-hidden className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full" style={{ background: T.accent, color: T.onAccent }}><Pencil className="h-3 w-3" /></span>}
    <style>{"@keyframes tkHold{from{transform:scaleY(0)}to{transform:scaleY(1)}}"}</style>
  </button>;
}

/** Other forms of a word: want → wants, wanted, wanting. */
function FormsPop({ b, onPick, onClose }: { b: TalkButton; onPick: (w: string) => void; onClose: () => void }) {
  const forms = wordForms(b.label, b.kind);
  return <Layer><div className="fixed inset-0 z-[450] grid place-items-center px-6" style={font} onClick={onClose}>
    <div className="absolute inset-0 bg-black/30" />
    <div className="tk-sheet relative w-full max-w-[360px] rounded-[22px] p-4" style={{ background: T.bg, color: T.text }} onClick={(e) => e.stopPropagation()} data-testid="talk-forms">
      <p className="px-1 text-[13px] font-semibold uppercase tracking-[.08em]" style={{ color: T.dim }}>Other ways to say “{b.label}”</p>
      <div className="mt-3 grid grid-cols-2 gap-2">{forms.map((f) => <button key={f} type="button" onClick={() => onPick(f)} className="tk-press h-14 rounded-[14px] text-[19px] font-semibold" style={{ background: T.card, boxShadow: T.shadow }}>{f}</button>)}</div>
    </div>
  </div></Layer>;
}

export type { TalkBoard };
