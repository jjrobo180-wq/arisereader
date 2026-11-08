// Apps for Arise Notes: the App Gallery (#/apps) and each app (#/app/<id>). Sticky Notes, Checklists,
// Whiteboard, Flashcards and Focus Timer are built in here and keep their data in the account
// (useAppData, server/userDocs.ts /api/app-data), so they open on every device and work offline.
// Sheets, Slides and Docs are A.R.I.S.E. Office (components/office), whose files are in the account too.
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { Check, Eraser, Layers, Minus, Pause, Pin, Play, Plus, RotateCcw, Shuffle, SkipForward, Trash2, Undo2, X } from "lucide-react";
import { useAppData } from "@/lib/cloudDocs";
import { OFFICE_KINDS } from "@/components/office/officeKinds";
import { notesApi, type ListNote } from "./api";
import { Btn, IconBtn, Spinner, useToast } from "./ui";
import { TopBar, type AppCtx } from "./NotesApp";
import { AppIcon, NOTES_APPS, notesAppOf, useNotesApps, type NotesAppId, type NotesAppInfo } from "./notesAppsCatalog";
import "./notesApps.css";

const OfficeApp = lazy(() => import("@/components/office/OfficeApp"));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max) : "");
const arr = (v: unknown, max = 500): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const obj = (v: unknown) => (v && typeof v === "object" ? v : {}) as Record<string, unknown>;

// ─── The App Gallery ───
const GROUPS: NotesAppInfo["group"][] = ["Write & plan", "Office", "Study"];

export function AppsScreen({ ctx }: { ctx: AppCtx }) {
  const { installed, toggle } = useNotesApps();
  const say = useToast();
  const flip = (a: NotesAppInfo) => { const on = installed.includes(a.id); toggle(a.id); say(on ? `${a.name} was removed. Nothing in it was deleted: add it back any time.` : `${a.name} was added to Home.`); };
  return <>
    <TopBar ctx={ctx} title="Apps" back={() => ctx.go({ name: "home" })} />
    <main className="mx-auto max-w-2xl space-y-7 px-4 pb-32 pt-5 sm:px-5" data-testid="notes-apps">
      <p className="text-[13.5px] leading-relaxed text-[var(--an-muted)]">Add the ones you want. They show on Home, and what's in them is saved to your account.</p>
      {GROUPS.map((g) => <section key={g} aria-labelledby={`na-${g}`}>
        <h2 id={`na-${g}`} className="mb-1 text-[11px] font-semibold uppercase tracking-[.16em] text-[var(--an-muted)]">{g}</h2>
        <ul className="border-t border-[var(--an-line)]">{NOTES_APPS.filter((a) => a.group === g).map((a) => {
          const on = installed.includes(a.id);
          return <li key={a.id} className="flex min-h-[3.75rem] items-center gap-3 border-b border-[var(--an-line)] py-2.5" data-testid={`notes-apps-row-${a.id}`}>
            <AppIcon app={a} size={26} />
            <button type="button" onClick={() => (on ? ctx.go({ name: "app", id: a.id }) : flip(a))} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[15px] font-semibold leading-tight text-[var(--an-ink)]">{a.name.replace(/^A\.R\.I\.S\.E\. /, "")}</span>
              <span className="mt-0.5 block truncate text-[12.5px] text-[var(--an-muted)]">{a.tagline}</span>
            </button>
            {on ? <span className="flex shrink-0 items-center gap-3">
                <button type="button" onClick={() => flip(a)} className="text-[12px] font-medium text-[var(--an-muted)]">Remove</button>
                <button type="button" onClick={() => ctx.go({ name: "app", id: a.id })} className="text-[13.5px] font-semibold text-[var(--an-violet)]">Open</button></span>
              : <button type="button" onClick={() => flip(a)} data-testid={`notes-apps-add-${a.id}`} className="shrink-0 rounded-full border border-[var(--an-line)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--an-ink)]">Add</button>}
          </li>;
        })}</ul>
      </section>)}
    </main>
  </>;
}

// ─── One app ───
export function AppScreen({ ctx, id }: { ctx: AppCtx; id: string }) {
  const app = notesAppOf(id);
  const { installed, toggle, loaded } = useNotesApps();
  // Opening an app from a link adds it, so it's on Home next time.
  useEffect(() => { if (app && loaded && !installed.includes(app.id)) toggle(app.id); }, [app, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!app) return <><TopBar ctx={ctx} title="App Gallery" back={() => ctx.go({ name: "apps" })} /><main className="mx-auto max-w-3xl px-4 pt-8"><p className="an-card p-6 text-center text-[15px] text-[var(--an-muted)]">That app isn't in the App Gallery.</p></main></>;
  const office = app.id === "sheets" || app.id === "slides" || app.id === "docs" || app.id === "design";
  return <>
    <TopBar ctx={ctx} title={<span className="flex min-w-0 items-center gap-2"><AppIcon app={app} size={26} /><span className="truncate">{app.name}</span></span>} back={() => ctx.go({ name: "home" })}
      right={<IconBtn label="App Gallery" onClick={() => ctx.go({ name: "apps" })}><Layers className="h-5 w-5" /></IconBtn>} />
    <main className={`mx-auto ${office ? "max-w-6xl" : "max-w-4xl"} px-4 pb-28 pt-4 sm:px-5`} data-testid={`notes-app-${app.id}`}>
      {app.id === "stickies" && <Stickies />}
      {app.id === "lists" && <Checklists />}
      {app.id === "whiteboard" && <Whiteboard />}
      {app.id === "flashcards" && <Flashcards ctx={ctx} />}
      {app.id === "focus" && <Focus />}
      {office && <div className="na-office rounded-2xl bg-white p-3 text-slate-900 shadow-sm ring-1 ring-slate-200 sm:p-5">
        <Suspense fallback={<Spinner />}><OfficeApp config={OFFICE_KINDS[app.id === "sheets" ? "sheet" : app.id === "slides" ? "slides" : app.id === "design" ? "design" : "doc"]} /></Suspense>
      </div>}
    </main>
  </>;
}
export type { NotesAppId };

const Empty = ({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) => <div className="an-card px-6 py-10 text-center">
  <div aria-hidden className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-3xl bg-[var(--an-violet-soft)] text-[var(--an-violet-ink)] [&>svg]:h-6 [&>svg]:w-6">{icon}</div>
  <h3 className="text-[17px] font-bold">{title}</h3><p className="mx-auto mt-1 max-w-sm text-[14.5px] leading-relaxed text-[var(--an-muted)]">{children}</p>
  {action && <div className="mt-4 flex justify-center">{action}</div>}
</div>;

// ─── Sticky Notes ───
const STICKY_COLORS = ["#ffe45c", "#ff9cc8", "#8fd8ff", "#a8f0a0", "#d6c7ff", "#ffc28a"];
type Sticky = { id: string; text: string; color: string; pinned: boolean; at: string };
const cleanStickies = (raw: unknown): { items: Sticky[] } => ({
  items: arr(obj(raw).items, 300).map((x) => { const o = obj(x); return { id: str(o.id, 40) || uid(), text: str(o.text, 2000), color: STICKY_COLORS.includes(str(o.color)) ? str(o.color) : STICKY_COLORS[0], pinned: o.pinned === true, at: str(o.at, 40) }; }),
});

function Stickies() {
  const { data, setData } = useAppData("notes-stickies", cleanStickies);
  const [fresh, setFresh] = useState<string | null>(null);
  const add = () => { const s: Sticky = { id: uid(), text: "", color: STICKY_COLORS[data.items.length % STICKY_COLORS.length], pinned: false, at: new Date().toISOString() }; setData((d) => ({ items: [s, ...d.items] })); setFresh(s.id); };
  const update = (id: string, patch: Partial<Sticky>) => setData((d) => ({ items: d.items.map((x) => (x.id === id ? { ...x, ...patch, at: new Date().toISOString() } : x)) }));
  const remove = (id: string) => setData((d) => ({ items: d.items.filter((x) => x.id !== id) }));
  const items = useMemo(() => [...data.items].sort((a, b) => Number(b.pinned) - Number(a.pinned)), [data.items]);
  return <div className="space-y-4">
    <div className="flex items-center gap-3"><p className="flex-1 text-[14px] text-[var(--an-muted)]">{items.length ? `${items.length} sticky ${items.length === 1 ? "note" : "notes"}. Pinned ones stay first.` : "Quick notes, in color."}</p><Btn kind="primary" onClick={add} data-testid="stickies-new"><Plus className="h-4 w-4" />New sticky</Btn></div>
    {items.length ? <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">{items.map((s, i) => <li key={s.id} className="na-sticky" style={{ background: s.color, transform: `rotate(${[-1.2, 1, .6, -.8][i % 4]}deg)` }} data-testid="sticky">
      {s.pinned && <span aria-hidden className="na-sticky-pin" />}
      <textarea value={s.text} onChange={(e) => update(s.id, { text: e.target.value })} placeholder="Write something…" aria-label="Sticky note" autoFocus={fresh === s.id} maxLength={2000} />
      <div className="na-sticky-bar">
        {STICKY_COLORS.map((c) => <button key={c} type="button" aria-label="Color" aria-pressed={s.color === c} onClick={() => update(s.id, { color: c })} style={{ background: c }} className="na-dot" />)}
        <span className="flex-1" />
        <button type="button" aria-label={s.pinned ? "Unpin" : "Pin"} aria-pressed={s.pinned} onClick={() => update(s.id, { pinned: !s.pinned })} className="na-tool"><Pin className="h-4 w-4" /></button>
        <button type="button" aria-label="Delete sticky note" onClick={() => remove(s.id)} className="na-tool"><Trash2 className="h-4 w-4" /></button>
      </div>
    </li>)}</ul>
      : <Empty icon={<Plus />} title="No sticky notes yet" action={<Btn kind="primary" onClick={add}><Plus className="h-4 w-4" />New sticky</Btn>}>A sticky note is for the quick stuff: a number, a reminder, an idea you don't want to lose.</Empty>}
  </div>;
}

// ─── Checklists ───
type Item = { id: string; text: string; done: boolean };
type List = { id: string; name: string; items: Item[] };
const cleanLists = (raw: unknown): { lists: List[] } => ({
  lists: arr(obj(raw).lists, 100).map((l) => { const o = obj(l); return { id: str(o.id, 40) || uid(), name: str(o.name, 80) || "List", items: arr(o.items, 300).map((x) => { const i = obj(x); return { id: str(i.id, 40) || uid(), text: str(i.text, 300), done: i.done === true }; }).filter((i) => i.text) }; }),
});

function Checklists() {
  const { data, setData } = useAppData("notes-lists", cleanLists);
  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const list = data.lists.find((l) => l.id === openId);
  const edit = (id: string, f: (l: List) => List) => setData((d) => ({ lists: d.lists.map((l) => (l.id === id ? f(l) : l)) }));
  const make = (e: FormEvent) => { e.preventDefault(); const n = name.trim(); if (!n) return; const l: List = { id: uid(), name: n.slice(0, 80), items: [] }; setData((d) => ({ lists: [l, ...d.lists] })); setName(""); setOpenId(l.id); };
  if (list) {
    const done = list.items.filter((i) => i.done).length;
    const addItem = (e: FormEvent) => { e.preventDefault(); const t = text.trim(); if (!t) return; edit(list.id, (l) => ({ ...l, items: [...l.items, { id: uid(), text: t.slice(0, 300), done: false }] })); setText(""); };
    return <div className="space-y-4">
      <button type="button" onClick={() => setOpenId(null)} className="text-[14px] font-bold text-[var(--an-ink)] underline underline-offset-2">← All lists</button>
      <div className="an-card p-4 sm:p-5">
        <input value={list.name} onChange={(e) => edit(list.id, (l) => ({ ...l, name: e.target.value.slice(0, 80) }))} aria-label="List name" className="w-full bg-transparent text-[22px] font-extrabold tracking-tight outline-none" />
        <p className="mt-0.5 text-[13.5px] text-[var(--an-muted)]">{done} of {list.items.length} done</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--an-line)]"><div className="h-full rounded-full bg-[var(--an-violet)] transition-all" style={{ width: `${list.items.length ? (done / list.items.length) * 100 : 0}%` }} /></div>
        <ul className="mt-3 divide-y divide-[var(--an-line)]">{list.items.map((i) => <li key={i.id} className="flex items-center gap-3 py-2.5">
          <button type="button" role="checkbox" aria-checked={i.done} aria-label={i.text} onClick={() => edit(list.id, (l) => ({ ...l, items: l.items.map((x) => (x.id === i.id ? { ...x, done: !x.done } : x)) }))}
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 ${i.done ? "border-[var(--an-violet)] bg-[var(--an-violet)] text-[var(--an-on-accent)]" : "border-[var(--an-line)]"}`}>{i.done && <Check className="h-4 w-4" />}</button>
          <span className={`min-w-0 flex-1 break-words text-[15.5px] ${i.done ? "text-[var(--an-muted)] line-through" : ""}`}>{i.text}</span>
          <button type="button" aria-label={`Delete ${i.text}`} onClick={() => edit(list.id, (l) => ({ ...l, items: l.items.filter((x) => x.id !== i.id) }))} className="na-tool"><X className="h-4 w-4" /></button>
        </li>)}</ul>
        <form onSubmit={addItem} className="mt-3 flex gap-2"><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an item" aria-label="Add an item" className="an-input flex-1" /><Btn kind="primary" type="submit"><Plus className="h-4 w-4" />Add</Btn></form>
      </div>
      <div className="flex flex-wrap gap-2">
        {done > 0 && <Btn kind="soft" onClick={() => edit(list.id, (l) => ({ ...l, items: l.items.filter((x) => !x.done) }))}>Clear {done} done</Btn>}
        <Btn kind="ghost" onClick={() => { setData((d) => ({ lists: d.lists.filter((l) => l.id !== list.id) })); setOpenId(null); }}><Trash2 className="h-4 w-4" />Delete list</Btn>
      </div>
    </div>;
  }
  return <div className="space-y-4">
    <form onSubmit={make} className="flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="New list: groceries, packing, a project…" aria-label="New list name" className="an-input flex-1" /><Btn kind="primary" type="submit"><Plus className="h-4 w-4" />Make</Btn></form>
    {data.lists.length ? <ul className="grid gap-3 sm:grid-cols-2">{data.lists.map((l) => { const d = l.items.filter((i) => i.done).length; return <li key={l.id}>
      <button type="button" onClick={() => setOpenId(l.id)} className="an-card block w-full p-4 text-left transition hover:border-[var(--an-violet)]">
        <span className="block truncate text-[16px] font-bold">{l.name}</span><span className="mt-0.5 block text-[13.5px] text-[var(--an-muted)]">{l.items.length ? `${d} of ${l.items.length} done` : "Empty"}</span>
        <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-[var(--an-line)]"><span className="block h-full rounded-full bg-[var(--an-violet)]" style={{ width: `${l.items.length ? (d / l.items.length) * 100 : 0}%` }} /></span>
      </button></li>; })}</ul>
      : <Empty icon={<Check />} title="No lists yet">Type a name above to make your first one.</Empty>}
  </div>;
}

// ─── Whiteboard ───
type Board = { id: string; name: string; png: string; at: string };
const MAX_BOARDS = 6;
const cleanBoards = (raw: unknown): { boards: Board[] } => ({
  boards: arr(obj(raw).boards, MAX_BOARDS).map((b) => { const o = obj(b); return { id: str(o.id, 40) || uid(), name: str(o.name, 60) || "Board", png: /^data:image\/(png|jpeg);base64,/.test(str(o.png, 600_000)) ? str(o.png, 600_000) : "", at: str(o.at, 40) }; }),
});
const INKS = ["#111827", "#dc2626", "#2563eb", "#16a34a", "#f59e0b", "#7c3aed"];

function Whiteboard() {
  const { data, setData } = useAppData("notes-whiteboard", cleanBoards);
  const [openId, setOpenId] = useState<string | null>(null);
  const board = data.boards.find((b) => b.id === openId);
  const make = () => { if (data.boards.length >= MAX_BOARDS) return; const b: Board = { id: uid(), name: `Board ${data.boards.length + 1}`, png: "", at: new Date().toISOString() }; setData((d) => ({ boards: [b, ...d.boards] })); setOpenId(b.id); };
  if (board) return <BoardEditor board={board} onBack={() => setOpenId(null)} onSave={(png) => setData((d) => ({ boards: d.boards.map((b) => (b.id === board.id ? { ...b, png, at: new Date().toISOString() } : b)) }))}
    onRename={(name) => setData((d) => ({ boards: d.boards.map((b) => (b.id === board.id ? { ...b, name } : b)) }))} onDelete={() => { setData((d) => ({ boards: d.boards.filter((b) => b.id !== board.id) })); setOpenId(null); }} />;
  return <div className="space-y-4">
    <div className="flex items-center gap-3"><p className="flex-1 text-[14px] text-[var(--an-muted)]">{data.boards.length} of {MAX_BOARDS} boards</p><Btn kind="primary" onClick={make} disabled={data.boards.length >= MAX_BOARDS} data-testid="whiteboard-new"><Plus className="h-4 w-4" />New board</Btn></div>
    {data.boards.length ? <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">{data.boards.map((b) => <li key={b.id}><button type="button" onClick={() => setOpenId(b.id)} className="an-card block w-full overflow-hidden p-0 text-left transition hover:border-[var(--an-violet)]">
      <span className="block aspect-[4/3] bg-white">{b.png && <img src={b.png} alt="" className="h-full w-full object-contain" />}</span>
      <span className="block truncate border-t border-[var(--an-line)] px-3 py-2 text-[14px] font-bold">{b.name}</span></button></li>)}</ul>
      : <Empty icon={<Plus />} title="A blank board" action={<Btn kind="primary" onClick={make}><Plus className="h-4 w-4" />New board</Btn>}>Draw a diagram, a map or a quick sketch to go with your notes.</Empty>}
  </div>;
}

function BoardEditor({ board, onBack, onSave, onRename, onDelete }: { board: Board; onBack: () => void; onSave: (png: string) => void; onRename: (n: string) => void; onDelete: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const undo = useRef<ImageData[]>([]);
  const [ink, setInk] = useState(INKS[0]);
  const [size, setSize] = useState(4);
  const [erase, setErase] = useState(false);
  const [, bump] = useState(0);
  const W = 1200, H = 900; // drawn at this size and scaled to fit, so a board looks the same on every screen
  useEffect(() => {
    const c = canvas.current, g = c?.getContext("2d"); if (!c || !g) return;
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
    if (board.png) { const img = new Image(); img.onload = () => g.drawImage(img, 0, 0, W, H); img.src = board.png; }
  }, [board.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = () => { const c = canvas.current; if (c) onSave(c.toDataURL("image/jpeg", 0.82)); };
  const at = (e: RPointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H] as const; };
  const last = useRef<readonly [number, number] | null>(null);
  const down = (e: RPointerEvent<HTMLCanvasElement>) => {
    const g = canvas.current?.getContext("2d"); if (!g) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    undo.current = [...undo.current.slice(-19), g.getImageData(0, 0, W, H)]; bump((n) => n + 1);
    last.current = at(e); move(e);
  };
  const move = (e: RPointerEvent<HTMLCanvasElement>) => {
    const g = canvas.current?.getContext("2d"); if (!g || !last.current) return;
    const p = at(e);
    g.strokeStyle = erase ? "#ffffff" : ink; g.lineWidth = (erase ? size * 5 : size) * (W / 600) * (e.pressure && e.pointerType === "pen" ? 0.5 + e.pressure : 1); g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(last.current[0], last.current[1]); g.lineTo(p[0] + 0.01, p[1]); g.stroke(); last.current = p;
  };
  const up = () => { if (last.current) { last.current = null; save(); } };
  const back = () => { const g = canvas.current?.getContext("2d"); const prev = undo.current.pop(); if (g && prev) { g.putImageData(prev, 0, 0); save(); bump((n) => n + 1); } };
  const clear = () => { const g = canvas.current?.getContext("2d"); if (!g) return; undo.current = [...undo.current.slice(-19), g.getImageData(0, 0, W, H)]; g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H); save(); bump((n) => n + 1); };
  return <div className="space-y-3">
    <div className="flex items-center gap-2">
      <button type="button" onClick={onBack} className="shrink-0 text-[14px] font-bold text-[var(--an-ink)] underline underline-offset-2">← Boards</button>
      <input value={board.name} onChange={(e) => onRename(e.target.value.slice(0, 60))} aria-label="Board name" className="min-w-0 flex-1 bg-transparent text-right text-[16px] font-bold outline-none" />
    </div>
    <div className="na-toolbar an-card flex flex-wrap items-center gap-1.5 p-2">
      {INKS.map((c) => <button key={c} type="button" aria-label="Pen color" aria-pressed={!erase && ink === c} onClick={() => { setInk(c); setErase(false); }} className="na-swatch" style={{ background: c }} />)}
      <span className="mx-1 h-6 w-px bg-[var(--an-line)]" />
      {[2, 4, 8].map((s) => <button key={s} type="button" aria-label={`Pen size ${s}`} aria-pressed={size === s} onClick={() => setSize(s)} className="na-tool"><span className="block rounded-full bg-current" style={{ width: s + 3, height: s + 3 }} /></button>)}
      <button type="button" aria-label="Eraser" aria-pressed={erase} onClick={() => setErase(!erase)} className="na-tool"><Eraser className="h-4 w-4" /></button>
      <span className="flex-1" />
      <button type="button" aria-label="Undo" disabled={!undo.current.length} onClick={back} className="na-tool"><Undo2 className="h-4 w-4" /></button>
      <button type="button" aria-label="Clear the board" onClick={clear} className="na-tool"><RotateCcw className="h-4 w-4" /></button>
      <button type="button" aria-label="Delete board" onClick={onDelete} className="na-tool"><Trash2 className="h-4 w-4" /></button>
    </div>
    <canvas ref={canvas} width={W} height={H} onPointerDown={down} onPointerMove={(e) => { if (last.current) move(e); }} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
      className="na-canvas block aspect-[4/3] w-full rounded-2xl bg-white shadow-sm ring-1 ring-slate-200" aria-label={`Whiteboard ${board.name}`} data-testid="whiteboard-canvas" />
    <p className="text-center text-[12.5px] text-[var(--an-muted)]">Saved as you draw.</p>
  </div>;
}

// ─── Flashcards ───
type Card = { id: string; front: string; back: string };
type Deck = { id: string; name: string; cards: Card[]; known: string[]; from: string };
const cleanDecks = (raw: unknown): { decks: Deck[] } => ({
  decks: arr(obj(raw).decks, 100).map((d) => { const o = obj(d); const cards = arr(o.cards, 300).map((c) => { const x = obj(c); return { id: str(x.id, 40) || uid(), front: str(x.front, 300), back: str(x.back, 600) }; }).filter((c) => c.front && c.back);
    return { id: str(o.id, 40) || uid(), name: str(o.name, 100) || "Deck", cards, known: arr(o.known, 300).map((k) => str(k, 40)).filter((k) => cards.some((c) => c.id === k)), from: str(o.from, 60) }; }),
});

function Flashcards({ ctx }: { ctx: AppCtx }) {
  const { data, setData } = useAppData("notes-flashcards", cleanDecks);
  const say = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [studying, setStudying] = useState(false);
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState("");
  const deck = data.decks.find((d) => d.id === openId);
  const edit = (id: string, f: (d: Deck) => Deck) => setData((s) => ({ decks: s.decks.map((d) => (d.id === id ? f(d) : d)) }));
  const make = (e: FormEvent) => { e.preventDefault(); const n = name.trim(); if (!n) return; const d: Deck = { id: uid(), name: n.slice(0, 100), cards: [], known: [], from: "" }; setData((s) => ({ decks: [d, ...s.decks] })); setName(""); setOpenId(d.id); };
  const fromNote = async (n: ListNote) => {
    try {
      const { study } = await notesApi.study(n.id);
      const cards = study.flashcards.map((c) => ({ id: uid(), front: c.front, back: c.back }));
      if (!cards.length) { say("That note didn't give any cards. Try a longer one."); return; }
      const d: Deck = { id: uid(), name: n.title || "From a note", cards, known: [], from: n.id };
      setData((s) => ({ decks: [d, ...s.decks.filter((x) => x.from !== n.id)] })); setPicking(false); setOpenId(d.id);
      say(`${cards.length} cards from “${d.name}”.`);
    } catch (e: any) { say(e?.message || "Couldn't make cards from that note."); }
  };
  if (picking) return <NotePicker locked={!ctx.me.features.study} onPick={fromNote} onCancel={() => setPicking(false)} />;
  if (deck && studying) return <Study deck={deck} onKnown={(id, yes) => edit(deck.id, (d) => ({ ...d, known: yes ? [...new Set([...d.known, id])] : d.known.filter((k) => k !== id) }))} onDone={() => setStudying(false)} />;
  if (deck) return <DeckView deck={deck} edit={(f) => edit(deck.id, f)} onBack={() => setOpenId(null)} onStudy={() => setStudying(true)} onDelete={() => { setData((s) => ({ decks: s.decks.filter((d) => d.id !== deck.id) })); setOpenId(null); }} />;
  return <div className="space-y-4">
    <button type="button" onClick={() => setPicking(true)} className="na-hero flex w-full items-center gap-4 p-5 text-left" data-testid="flashcards-from-note">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--an-on-accent)_18%,transparent)]"><Layers className="h-6 w-6" /></span>
      <span className="min-w-0 flex-1"><span className="block text-[17px] font-extrabold">Make cards from a note</span><span className="block text-[13.5px] opacity-90">Pick a recorded class or meeting: its key ideas become cards.</span></span>
    </button>
    <form onSubmit={make} className="flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Or make your own deck: name it" aria-label="New deck name" className="an-input flex-1" /><Btn kind="soft" type="submit"><Plus className="h-4 w-4" />Make</Btn></form>
    {data.decks.length > 0 && <ul className="grid gap-3 sm:grid-cols-2">{data.decks.map((d) => <li key={d.id}><button type="button" onClick={() => setOpenId(d.id)} className="an-card block w-full p-4 text-left transition hover:border-[var(--an-violet)]">
      <span className="block truncate text-[16px] font-bold">{d.name}</span>
      <span className="mt-0.5 block text-[13.5px] text-[var(--an-muted)]">{d.cards.length} {d.cards.length === 1 ? "card" : "cards"} · {d.known.length} known{d.from ? " · from a note" : ""}</span>
    </button></li>)}</ul>}
  </div>;
}

function NotePicker({ locked, onPick, onCancel }: { locked: boolean; onPick: (n: ListNote) => Promise<void>; onCancel: () => void }) {
  const [notes, setNotes] = useState<ListNote[] | null>(null);
  const [busy, setBusy] = useState("");
  useEffect(() => { notesApi.list().then((r) => setNotes(r.notes.filter((n) => n.status === "ready"))).catch(() => setNotes([])); }, []);
  return <div className="space-y-3">
    <div className="flex items-center gap-2"><h2 className="flex-1 text-[18px] font-extrabold">Pick a note</h2><Btn kind="ghost" onClick={onCancel}>Cancel</Btn></div>
    {locked && <p className="an-card p-4 text-[14px] text-[var(--an-muted)]">Making cards from a note is part of the Basic plan and up. You can still make your own decks.</p>}
    {notes === null ? <Spinner /> : notes.length ? <ul className="grid gap-2 sm:grid-cols-2">{notes.map((n) => <li key={n.id}><button type="button" disabled={locked || !!busy} onClick={() => { setBusy(n.id); void onPick(n).finally(() => setBusy("")); }} className="an-card flex w-full items-center gap-3 p-3.5 text-left transition hover:border-[var(--an-violet)] disabled:opacity-60">
      <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{n.title || "Untitled note"}</span><span className="block truncate text-[13px] text-[var(--an-muted)]">{n.gist || "A recorded note"}</span></span>
      {busy === n.id ? <span className="text-[13px] font-bold text-[var(--an-muted)]">Making…</span> : <Plus className="h-5 w-5 text-[var(--an-muted)]" />}
    </button></li>)}</ul> : <p className="an-card p-6 text-center text-[14.5px] text-[var(--an-muted)]">No finished notes yet. Record or upload one first.</p>}
  </div>;
}

function DeckView({ deck, edit, onBack, onStudy, onDelete }: { deck: Deck; edit: (f: (d: Deck) => Deck) => void; onBack: () => void; onStudy: () => void; onDelete: () => void }) {
  const [front, setFront] = useState(""), [back, setBack] = useState("");
  const add = (e: FormEvent) => { e.preventDefault(); if (!front.trim() || !back.trim()) return; edit((d) => ({ ...d, cards: [...d.cards, { id: uid(), front: front.trim().slice(0, 300), back: back.trim().slice(0, 600) }] })); setFront(""); setBack(""); };
  return <div className="space-y-4">
    <button type="button" onClick={onBack} className="text-[14px] font-bold text-[var(--an-ink)] underline underline-offset-2">← All decks</button>
    <div className="an-card p-4 sm:p-5">
      <input value={deck.name} onChange={(e) => edit((d) => ({ ...d, name: e.target.value.slice(0, 100) }))} aria-label="Deck name" className="w-full bg-transparent text-[22px] font-extrabold tracking-tight outline-none" />
      <p className="mt-0.5 text-[13.5px] text-[var(--an-muted)]">{deck.cards.length} cards · {deck.known.length} known</p>
      <div className="mt-3 flex flex-wrap gap-2"><Btn kind="primary" onClick={onStudy} disabled={!deck.cards.length} data-testid="flashcards-study"><Play className="h-4 w-4" />Study</Btn>{deck.known.length > 0 && <Btn kind="soft" onClick={() => edit((d) => ({ ...d, known: [] }))}><RotateCcw className="h-4 w-4" />Start over</Btn>}</div>
    </div>
    <form onSubmit={add} className="an-card grid gap-2 p-4 sm:grid-cols-[1fr_1.4fr_auto]">
      <input value={front} onChange={(e) => setFront(e.target.value)} placeholder="Front: a word or question" aria-label="Front of the card" className="an-input" />
      <input value={back} onChange={(e) => setBack(e.target.value)} placeholder="Back: the answer" aria-label="Back of the card" className="an-input" />
      <Btn kind="soft" type="submit"><Plus className="h-4 w-4" />Add card</Btn>
    </form>
    <ul className="space-y-2">{deck.cards.map((c) => <li key={c.id} className="an-card flex items-start gap-3 p-3.5">
      <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold">{c.front}</span><span className="mt-0.5 block text-[14px] text-[var(--an-muted)]">{c.back}</span></span>
      {deck.known.includes(c.id) && <span className="rounded-full bg-[var(--an-green-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--an-green)]">Known</span>}
      <button type="button" aria-label="Delete card" onClick={() => edit((d) => ({ ...d, cards: d.cards.filter((x) => x.id !== c.id), known: d.known.filter((k) => k !== c.id) }))} className="na-tool"><X className="h-4 w-4" /></button>
    </li>)}</ul>
    <Btn kind="ghost" onClick={onDelete}><Trash2 className="h-4 w-4" />Delete deck</Btn>
  </div>;
}

function Study({ deck, onKnown, onDone }: { deck: Deck; onKnown: (id: string, yes: boolean) => void; onDone: () => void }) {
  const [order, setOrder] = useState(() => { const left = deck.cards.filter((c) => !deck.known.includes(c.id)); return (left.length ? left : deck.cards).map((c) => c.id); });
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = deck.cards.find((c) => c.id === order[i]);
  const next = () => { setFlipped(false); setI((n) => n + 1); };
  if (!card) return <div className="an-card px-6 py-10 text-center">
    <div aria-hidden className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-3xl bg-[var(--an-green-soft)] text-[var(--an-green)]"><Check className="h-7 w-7" /></div>
    <h3 className="text-[19px] font-extrabold">That's the deck</h3><p className="mt-1 text-[14.5px] text-[var(--an-muted)]">{deck.known.length} of {deck.cards.length} known.</p>
    <div className="mt-4 flex justify-center gap-2"><Btn kind="primary" onClick={() => { setOrder(deck.cards.filter((c) => !deck.known.includes(c.id)).map((c) => c.id)); setI(0); }} disabled={deck.known.length >= deck.cards.length}>Study the rest</Btn><Btn kind="soft" onClick={onDone}>Done</Btn></div>
  </div>;
  return <div className="mx-auto max-w-xl space-y-4">
    <div className="flex items-center gap-2"><button type="button" onClick={onDone} className="text-[14px] font-bold text-[var(--an-ink)] underline underline-offset-2">← {deck.name}</button><span className="flex-1" /><span className="text-[13.5px] font-semibold text-[var(--an-muted)]">{i + 1} of {order.length}</span>
      <IconBtn label="Shuffle" onClick={() => { setOrder((o) => [...o].sort(() => Math.random() - 0.5)); setI(0); setFlipped(false); }}><Shuffle className="h-5 w-5" /></IconBtn></div>
    <button type="button" onClick={() => setFlipped(!flipped)} aria-label={flipped ? "Show the front" : "Show the answer"} className={`na-card ${flipped ? "na-card-back" : ""}`} data-testid="flashcard">
      <span className="text-[12px] font-bold uppercase tracking-[.14em] opacity-70">{flipped ? "Answer" : "Question"}</span>
      <span className="mt-3 block text-[22px] font-extrabold leading-snug">{flipped ? card.back : card.front}</span>
      {!flipped && <span className="mt-6 block text-[13px] font-semibold opacity-70">Tap to see the answer</span>}
    </button>
    {flipped ? <div className="grid grid-cols-2 gap-2"><Btn kind="soft" onClick={() => { onKnown(card.id, false); next(); }}><Minus className="h-4 w-4" />Again</Btn><Btn kind="primary" onClick={() => { onKnown(card.id, true); next(); }}><Check className="h-4 w-4" />Got it</Btn></div>
      : <div className="flex justify-center"><Btn kind="ghost" onClick={next}><SkipForward className="h-4 w-4" />Skip</Btn></div>}
  </div>;
}

// ─── Focus Timer ───
const cleanFocus = (raw: unknown): { log: string[]; mins: number } => {
  const o = obj(raw); const mins = Number(o.mins);
  return { log: arr(o.log, 400).map((x) => str(x, 40)).filter(Boolean), mins: [15, 25, 50].includes(mins) ? mins : 25 };
};
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function chime() { try { const A = window.AudioContext || (window as any).webkitAudioContext; const a = new A(); const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(0.0001, a.currentTime); g.gain.exponentialRampToValueAtTime(0.25, a.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 1.2); o.start(); o.stop(a.currentTime + 1.25); } catch { /* no sound here */ } try { navigator.vibrate?.(300); } catch { /* no buzz */ } }

function Focus() {
  const { data, setData } = useAppData("notes-focus", cleanFocus);
  const [mode, setMode] = useState<"focus" | "rest">("focus");
  const total = (mode === "focus" ? data.mins : data.mins >= 50 ? 10 : 5) * 60;
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [left, setLeft] = useState(total);
  const [, tick] = useState(0);
  useEffect(() => { if (endsAt === null) setLeft(total); }, [total]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (endsAt === null) return;
    const t = window.setInterval(() => {
      const s = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setLeft(s); tick((n) => n + 1);
      if (s <= 0) {
        window.clearInterval(t); setEndsAt(null); chime();
        if (mode === "focus") { setData((d) => ({ ...d, log: [...d.log.slice(-399), new Date().toISOString()] })); setMode("rest"); } else setMode("focus");
      }
    }, 250);
    return () => window.clearInterval(t);
  }, [endsAt, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const running = endsAt !== null;
  const today = new Date().toDateString();
  const sessions = data.log.filter((x) => new Date(x).toDateString() === today).length;
  const pct = 1 - left / total;
  const R = 108, C = 2 * Math.PI * R;
  return <div className="mx-auto max-w-md space-y-5 text-center">
    <div className="flex justify-center gap-2" role="group" aria-label="Focus length">{[15, 25, 50].map((m) => <button key={m} type="button" className="an-chip" aria-pressed={data.mins === m} disabled={running} onClick={() => setData((d) => ({ ...d, mins: m }))}>{m} min</button>)}</div>
    <div className="relative mx-auto aspect-square w-full max-w-[18rem]">
      <svg viewBox="0 0 240 240" className="h-full w-full -rotate-90" aria-hidden><circle cx="120" cy="120" r={R} fill="none" stroke="var(--an-line)" strokeWidth="14" />
        <circle cx="120" cy="120" r={R} fill="none" stroke={mode === "focus" ? "var(--an-coral)" : "var(--an-green)"} strokeWidth="14" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: "stroke-dashoffset .25s linear" }} /></svg>
      <div className="absolute inset-0 grid place-content-center"><p className="text-[13px] font-bold uppercase tracking-[.14em] text-[var(--an-muted)]">{mode === "focus" ? "Focus" : "Break"}</p><p className="text-[54px] font-black leading-none tabular-nums" role="timer" aria-live="off">{fmt(left)}</p></div>
    </div>
    <div className="flex justify-center gap-2">
      <Btn kind="primary" className="min-w-[8rem]" onClick={() => setEndsAt(running ? null : Date.now() + left * 1000)} data-testid="focus-start">{running ? <><Pause className="h-4 w-4" />Pause</> : <><Play className="h-4 w-4" />{left < total ? "Resume" : "Start"}</>}</Btn>
      <Btn kind="soft" onClick={() => { setEndsAt(null); setLeft(total); }}><RotateCcw className="h-4 w-4" />Reset</Btn>
      <Btn kind="soft" onClick={() => { setEndsAt(null); setMode(mode === "focus" ? "rest" : "focus"); }}><SkipForward className="h-4 w-4" />{mode === "focus" ? "Break" : "Focus"}</Btn>
    </div>
    <p className="text-[14.5px] text-[var(--an-muted)]">Today: <b className="text-[var(--an-ink)]">{sessions}</b> focus {sessions === 1 ? "session" : "sessions"} · {sessions * data.mins} minutes</p>
  </div>;
}
