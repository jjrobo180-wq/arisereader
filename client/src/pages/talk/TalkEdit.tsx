// Changing Arise Talk: a button (its word, what it says, its picture or photo, its color, whether it
// opens another board or says a whole phrase at once, where it sits) and a board (name, picture,
// delete or put back the original words). Every change can be undone from the Talk screen.
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, EyeOff, RotateCcw, Search, Trash2 } from "lucide-react";
import { BUILT_IN_BOARD_IDS, KIND_INFO, KINDS, builtInBoard, starterData, type TalkButton, type TalkKind } from "@shared/talk";
import type { Talk } from "./TalkApp";
import { shrinkPhoto } from "./talkStore";
import { Btn, Field, PremiumTag, Seg, Sheet, T, Title, Toggle, inputCls, inputStyle } from "./talkUi";

/** Every picture in the starter words, found by its word, plus some extras. */
const EXTRA = "😀 grin|😃 smile|🥰 love|😍 heart eyes|😘 kiss|😇 angel|🙃 upside|😜 joke|🤗 hug|🤔 think|🤐 secret|😶 quiet|🙄 eye roll|😴 sleep|🤢 sick|🤧 sneeze|🥵 hot|🥶 cold|😵 dizzy|🤯 wow|🥳 party|😎 cool|🤓 smart|😭 cry|😱 scream|😡 mad|👍 yes|👎 no|👏 clap|🙌 yay|🤝 deal|✌️ peace|🤞 hope|💪 strong|🧠 brain|👶 baby|🧒 kid|👩 woman|👨 man|🧓 older|👮 police|👷 builder|🧑‍🍳 cook|🧑‍🎓 student|🧑‍💻 office|🎅 santa|🐶 dog|🐱 cat|🌳 tree|🌸 flower|🌞 sun|🌙 moon|⭐ star|🔥 fire|💧 water|🌊 ocean|🍎 apple|🍕 pizza|☕ coffee|🎂 cake|🎁 present|🎈 balloon|🎉 party|⚽ ball|🎮 game|🎵 music|🎨 art|📚 books|✏️ pencil|📱 phone|💻 laptop|📺 tv|🚗 car|🚌 bus|✈️ plane|🚲 bike|🏠 house|🏫 school|🏥 hospital|🛒 shopping|🛏️ bed|🚽 toilet|🛁 bath|🧸 teddy|🪀 toy|🔑 key|🚪 door|🪟 window|💡 light|🔋 battery|💊 pill|🩹 bandaid|❤️ love|💔 broken|✅ done|❌ wrong|❓ question|❗ important|➕ more|➖ less|🔁 again|⏰ time|📅 calendar|🔔 bell|🔇 mute|🔊 loud|🙏 please|💬 talk|🗣️ speak|👂 hear|👀 see|🤲 give|✋ stop|👋 wave|🚶 walk|🏃 run|🧘 relax|🛀 bath|🧹 clean|🍽️ eat|🥤 drink|💤 tired|🏖️ beach|🌧️ rain|❄️ snow|🌈 rainbow|🐾 pet|🦄 unicorn|🦖 dinosaur|🚀 rocket|👑 king|💰 money|🛍️ buy|🎟️ ticket|📷 camera|🎤 sing|🎧 headphones|🏆 win|🥇 first";
function emojiIndex(talk: Talk) {
  const map = new Map<string, string>();
  for (const b of starterData().boards) for (const x of b.buttons) if (x.emoji && !map.has(x.emoji)) map.set(x.emoji, x.label.toLowerCase());
  for (const b of talk.data.boards) for (const x of b.buttons) if (x.emoji && !map.has(x.emoji)) map.set(x.emoji, x.label.toLowerCase());
  for (const pair of EXTRA.split("|")) { const [e, ...w] = pair.split(" "); map.set(e, `${map.get(e) ?? ""} ${w.join(" ")}`.trim()); }
  return [...map.entries()];
}
/** The best picture for a word, when one is known. */
export function emojiFor(label: string, index: [string, string][]): string | undefined {
  const w = label.trim().toLowerCase();
  if (!w) return undefined;
  return index.find(([, k]) => k === w)?.[0] ?? index.find(([, k]) => k.split(" ").includes(w))?.[0] ?? index.find(([, k]) => k.startsWith(w) && w.length >= 3)?.[0];
}

export function ButtonEditor({ talk, boardId, index, onClose }: { talk: Talk; boardId: string; index: number; onClose: () => void }) {
  const { data, update } = talk;
  const board = data.boards.find((b) => b.id === boardId)!;
  const isNew = index < 0;
  const orig: TalkButton = isNew ? { id: `${boardId}.${Date.now().toString(36)}`, label: "", kind: "thing" } : board.buttons[index];
  const [b, setB] = useState<TalkButton>({ ...orig });
  const [find, setFind] = useState("");
  const [pickedEmoji, setPickedEmoji] = useState(!!orig.emoji);
  const file = useRef<HTMLInputElement>(null);
  const index_ = useMemo(() => emojiIndex(talk), []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<TalkButton>) => setB((x) => ({ ...x, ...p }));
  const shownEmoji = index_.filter(([, k]) => !find || k.includes(find.toLowerCase().trim())).slice(0, 96);

  const save = () => {
    const label = b.label.trim();
    if (!label) { talk.flash("Give the button a word."); return; }
    const clean: TalkButton = { ...b, label, say: b.say?.trim() || undefined };
    if (!clean.opens) delete clean.opens;
    update((d) => ({ ...d, boards: d.boards.map((x) => x.id !== boardId ? x : { ...x, buttons: isNew ? [...x.buttons, clean] : x.buttons.map((y, i) => (i === index ? clean : y)) }) }));
    onClose();
  };
  const remove = () => { update((d) => ({ ...d, boards: d.boards.map((x) => x.id !== boardId ? x : { ...x, buttons: x.buttons.filter((_, i) => i !== index) }) })); talk.flash("Button deleted. Undo is on the Talk screen."); onClose(); };
  const move = (by: number) => {
    const to = index + by;
    if (to < 0 || to >= board.buttons.length) return;
    update((d) => ({ ...d, boards: d.boards.map((x) => { if (x.id !== boardId) return x; const a = [...x.buttons]; [a[index], a[to]] = [a[to], a[index]]; return { ...x, buttons: a }; }) }));
    onClose();
  };
  const photo = async (f?: File) => {
    if (!f) return;
    if (!talk.premium) { talk.flash("Photos on buttons are part of Premium."); return; }
    try { set({ photo: await shrinkPhoto(f, 300, 0.7) }); } catch (e: any) { talk.flash(e.message); }
  };
  const c = KIND_INFO[b.kind];

  return <Sheet title={isNew ? "New button" : "Change button"} onClose={onClose} full testId="talk-button-editor">
    {/* Preview */}
    <div className="mt-1 flex items-center gap-4">
      <div className="grid aspect-[5/6] w-[96px] shrink-0 place-items-center overflow-hidden rounded-[18px] border-2" style={{ background: c.light, borderColor: `${c.edge}66`, color: "#16161d" }}>
        <div className="flex flex-col items-center">
          {b.photo ? <img src={b.photo} alt="" className="h-14 w-14 rounded-[10px] object-cover" /> : b.emoji ? <span className="text-[40px] leading-none">{b.emoji}</span> : <span className="text-[24px] font-bold">{b.label || "?"}</span>}
          {(b.emoji || b.photo) && <span className="mt-1 max-w-[86px] truncate text-[14px] font-semibold">{b.label || "Word"}</span>}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <Field label="Word on the button"><input autoFocus={isNew} value={b.label} onChange={(e) => { const label = e.target.value.slice(0, 40); setB((x) => ({ ...x, label, ...(!pickedEmoji ? { emoji: emojiFor(label, index_) } : {}) })); }} placeholder="pizza" className={inputCls} style={inputStyle} data-testid="talk-edit-label" /></Field>
      </div>
    </div>
    <Field label="It says (if different)"><input value={b.say ?? ""} onChange={(e) => set({ say: e.target.value.slice(0, 300) })} placeholder={b.label ? `“${b.label}”` : "I want pizza, please."} className={inputCls} style={inputStyle} data-testid="talk-edit-say" /></Field>

    <Title>Color</Title>
    <div className="grid grid-cols-4 gap-2">{KINDS.map((k: TalkKind) => <button key={k} type="button" onClick={() => set({ kind: k })} aria-pressed={b.kind === k} className="flex h-12 items-center justify-center rounded-[12px] border-2 px-1 text-[12px] font-semibold" style={{ background: KIND_INFO[k].light, borderColor: b.kind === k ? KIND_INFO[k].edge : "transparent", color: "#16161d" }} data-testid={`talk-kind-${k}`}>{KIND_INFO[k].name}</button>)}</div>

    <Title right={b.photo ? <button type="button" className="text-[14px] font-semibold" style={{ color: T.accent }} onClick={() => set({ photo: undefined })}>Remove photo</button> : undefined}>Picture</Title>
    <div className="flex gap-2">
      <div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: T.dim }} /><input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a picture" className={`${inputCls} pl-10`} style={inputStyle} /></div>
      <button type="button" onClick={() => file.current?.click()} className="tk-press flex h-12 shrink-0 items-center gap-1.5 rounded-[14px] px-3 text-[14px] font-semibold" style={{ background: T.card2 }} data-testid="talk-edit-photo"><Camera className="h-5 w-5" />Photo</button>
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => void photo(e.target.files?.[0])} />
    </div>
    {!talk.premium && <p className="mt-1.5 flex items-center gap-1.5 px-1 text-[12px]" style={{ color: T.dim }}><PremiumTag /> Your own photos on buttons</p>}
    <div className="mt-2 grid grid-cols-8 gap-1">
      <button type="button" onClick={() => { set({ emoji: undefined, photo: undefined }); setPickedEmoji(true); }} className="grid aspect-square place-items-center rounded-[10px] text-[11px] font-semibold" style={{ background: T.card2, color: T.dim }}>None</button>
      {shownEmoji.map(([e, k]) => <button key={e} type="button" title={k} onClick={() => { set({ emoji: e, photo: undefined }); setPickedEmoji(true); }} aria-pressed={b.emoji === e} className="grid aspect-square place-items-center rounded-[10px] text-[24px]" style={b.emoji === e ? { background: T.accentSoft, boxShadow: `inset 0 0 0 2px ${T.accent}` } : {}}>{e}</button>)}
    </div>

    <Title>What it does</Title>
    <div className="rounded-[18px] px-4" style={{ background: T.card }}>
      <Toggle on={!!b.now} onChange={(now) => set({ now, ...(now ? { opens: undefined } : {}) })} label="Say it right away" sub="For a whole phrase, instead of adding it to the message" testId="talk-edit-now" />
      <div style={{ borderTop: `1px solid ${T.line}` }} />
      <label className="flex items-center gap-3 py-3"><span className="flex-1 text-[16px] font-medium">Opens a board</span>
        <select value={b.opens ?? ""} onChange={(e) => set({ opens: e.target.value || undefined, ...(e.target.value ? { now: false } : {}) })} className="h-10 max-w-[55%] rounded-[10px] px-2 text-[15px] outline-none" style={inputStyle} data-testid="talk-edit-opens">
          <option value="">No</option>{data.boards.filter((x) => x.id !== boardId).map((x) => <option key={x.id} value={x.id}>{x.emoji} {x.name}</option>)}
        </select></label>
      <div style={{ borderTop: `1px solid ${T.line}` }} />
      <Toggle on={!!b.hidden} onChange={(hidden) => set({ hidden })} label="Hide it for now" sub="It stays here, out of sight, until you show it again" />
    </div>

    {!isNew && <div className="mt-4 grid grid-cols-3 gap-2">
      <Btn kind="soft" onClick={() => move(-1)} disabled={index === 0}><ArrowLeft className="h-5 w-5" />Earlier</Btn>
      <Btn kind="soft" onClick={() => move(1)} disabled={index === board.buttons.length - 1}>Later<ArrowRight className="h-5 w-5" /></Btn>
      <Btn kind="danger" onClick={remove} testId="talk-edit-delete"><Trash2 className="h-5 w-5" />Delete</Btn>
    </div>}
    <Btn className="mt-4 w-full" onClick={save} testId="talk-edit-save">{isNew ? "Add button" : "Save"}</Btn>
    {b.hidden && <p className="mt-2 flex items-center justify-center gap-1.5 text-[13px]" style={{ color: T.dim }}><EyeOff className="h-4 w-4" />Hidden buttons show faded while you edit.</p>}
  </Sheet>;
}

export function BoardEditor({ talk, boardId, onClose, onDeleted }: { talk: Talk; boardId: string; onClose: () => void; onDeleted: () => void }) {
  const { data, update } = talk;
  const board = data.boards.find((b) => b.id === boardId)!;
  const [name, setName] = useState(board.name);
  const [emoji, setEmoji] = useState(board.emoji);
  const builtIn = BUILT_IN_BOARD_IDS.includes(boardId);
  const save = () => { update((d) => ({ ...d, boards: d.boards.map((b) => (b.id === boardId ? { ...b, name: name.trim().slice(0, 40) || b.name, emoji: emoji.trim() || "📁" } : b)) })); onClose(); };
  const del = () => {
    update((d) => ({ ...d, boards: d.boards.filter((b) => b.id !== boardId).map((b) => ({ ...b, buttons: b.buttons.map((x) => (x.opens === boardId ? { ...x, opens: undefined } : x)) })) }));
    talk.flash("Board deleted. Undo is on the Talk screen."); onDeleted();
  };
  const reset = () => { const orig = builtInBoard(boardId); if (!orig) return; update((d) => ({ ...d, boards: d.boards.map((b) => (b.id === boardId ? { ...orig, buttons: orig.buttons.map((x) => ({ ...x })) } : b)) })); talk.flash("The original words are back."); onClose(); };
  const [cols, setCols] = useState(data.settings.cols);
  return <Sheet title="Board" onClose={onClose} testId="talk-board-editor">
    <div className="flex gap-2">
      <Field label="Picture"><input value={emoji} onChange={(e) => setEmoji(Array.from(e.target.value).slice(-2).join(""))} className={`${inputCls} w-[72px] text-center text-[24px]`} style={inputStyle} /></Field>
      <div className="flex-1"><Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} style={inputStyle} data-testid="talk-board-name" /></Field></div>
    </div>
    <Title>Buttons across (every board)</Title>
    <Seg value={cols} onChange={(c) => { setCols(c); update((d) => ({ ...d, settings: { ...d.settings, cols: c } })); }} items={[{ id: 0, label: "Auto" }, ...[3, 4, 5, 6, 7, 8].map((n) => ({ id: n, label: String(n) }))]} testId="talk-cols" />
    <Btn className="mt-6 w-full" onClick={save} testId="talk-board-save">Save</Btn>
    <div className="mt-3 grid grid-cols-2 gap-2">
      {builtIn && <Btn kind="soft" onClick={reset}><RotateCcw className="h-5 w-5" />Original words</Btn>}
      {boardId !== "core" && <Btn kind="danger" className={builtIn ? "" : "col-span-2"} onClick={del} testId="talk-board-delete"><Trash2 className="h-5 w-5" />Delete board</Btn>}
    </div>
  </Sheet>;
}
