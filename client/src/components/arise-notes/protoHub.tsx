// The Studio looks (shared/protoLooks.ts) in Arise To Duo and WorkHub. Each arrangement draws the hubs the way
// it draws Arise Notes, so a look is the same thing in both apps: Stickies is a wall of sticky notes, Receipts
// is paper slips, Tape Rack is cassettes, Chronograph is a dial, and so on. Tasks, the days coming up and notes
// all go through one list (ArchList) that each arrangement draws its own way; protoHub.css dresses them.
import type { CSSProperties, ReactNode } from "react";
import type { NotesTheme } from "@shared/notesThemes";
import "./protoHub.css";

export type HubLink = { label: string; onClick: () => void };
export type HubTask = { id: string; title: string; done: boolean; due: string; late: boolean; dueLabel: string; listName: string; color: string; assignee: string; notes: string };
export type HubDay = { date: string; weekday: string; day: string; month: string; items: { id: string; time: string; title: string }[] };
export type HubNote = { id: string; title: string; body: string; locked?: boolean; when?: string; pinned?: boolean };

type Check = { pressed: boolean; label: string; onClick: () => void; kind?: "done" | "pin" };
/** One thing in a list: a task, a day with what's on it, or a note. */
export type ArchItem = {
  id: string; title: string; sub?: string; meta?: string; kicker?: string; time?: string;
  /** A day's number, for the arrangements that show a date. */
  big?: string; date?: string;
  lines?: { id: string; time: string; title: string }[];
  done?: boolean; late?: boolean; pinned?: boolean; group?: string;
  open: () => void; check?: Check;
};
export type ArchKind = "tasks" | "days" | "notes";

const archOf = (look: NotesTheme) => look.arch ?? "";
const Svg = ({ children, size = 20, w = 2.2 }: { children: ReactNode; size?: number; w?: number }) => <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
const Plus = ({ size = 20 }: { size?: number }) => <Svg size={size} w={2.6}><path d="M12 5v14M5 12h14" /></Svg>;
const Tick = ({ size = 16 }: { size?: number }) => <Svg size={size} w={3}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
const PinIc = ({ size = 15 }: { size?: number }) => <Svg size={size}><path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7" /></Svg>;
const Arrow = () => <Svg size={16} w={2.4}><path d="M7 17 17 7M8 7h9v9" /></Svg>;

export const dayWord = (iso: string) => {
  const d = new Date(iso); if (Number.isNaN(+d)) return "";
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const diff = Math.round((+t0 - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 864e5);
  return diff <= 0 ? "Today" : diff === 1 ? "Yesterday" : diff < 7 ? d.toLocaleDateString(undefined, { weekday: "short" }) : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const firstLine = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 3).join(" · ");

// ─── What goes in the lists ───
export function taskItems(tasks: HubTask[], onToggle: (id: string) => void, onOpen: (id: string) => void): ArchItem[] {
  return tasks.map((t) => ({
    id: t.id, title: t.title, sub: firstLine(t.notes), kicker: t.listName,
    meta: [t.late ? "Overdue" : "", t.dueLabel, t.assignee].filter(Boolean).join(" · "),
    done: t.done, late: t.late, date: t.due, group: t.done ? "Done" : t.late ? "Overdue" : t.dueLabel || "Anytime",
    open: () => onOpen(t.id), check: { pressed: t.done, label: t.done ? `Reopen ${t.title}` : `Complete ${t.title}`, onClick: () => onToggle(t.id), kind: "done" },
  }));
}
export function dayItems(days: HubDay[], onPick: (date: string) => void): ArchItem[] {
  return days.map((d) => ({
    id: d.date, title: `${d.weekday} ${d.day}`, kicker: d.month, big: d.day, date: d.date, time: d.items[0]?.time,
    sub: d.items.map((x) => x.title).join(" · "), lines: d.items, group: `${d.weekday}, ${d.month} ${d.day}`,
    meta: `${d.items.length} ${d.items.length === 1 ? "thing" : "things"}`, open: () => onPick(d.date),
  }));
}
export function noteItems(notes: HubNote[], onOpen: (id: string) => void, onPin?: (id: string) => void): ArchItem[] {
  return notes.map((n) => {
    const title = n.title || (n.locked ? "Locked note" : "Untitled");
    return {
      id: n.id, title, sub: n.locked ? "Locked" : firstLine(n.body), meta: n.when ? dayWord(n.when) : "", kicker: n.pinned ? "Pinned" : "Note",
      pinned: n.pinned, date: n.when, group: n.when ? dayWord(n.when) : "Notes", open: () => onOpen(n.id),
      check: onPin ? { pressed: !!n.pinned, label: n.pinned ? `Unpin ${title}` : `Pin ${title}`, onClick: () => onPin(n.id), kind: "pin" } : undefined,
    };
  });
}

// ─── The pieces every arrangement uses ───
function CheckBtn({ c, className = "", mark }: { c: Check; className?: string; mark?: ReactNode }) {
  return <button type="button" className={`sh-ck ${className}`} aria-pressed={c.pressed} aria-label={c.label} data-kind={c.kind ?? "done"} onClick={c.onClick}>
    {mark ?? (c.kind === "pin" ? <PinIc /> : c.pressed ? <Tick /> : null)}</button>;
}
const Lines = ({ it, n = 3 }: { it: ArchItem; n?: number }) => it.lines?.length ? <span className="sh-lines">{it.lines.slice(0, n).map((x) => <span key={x.id}>{x.time && <em>{x.time}</em>}{x.title}</span>)}{it.lines.length > n && <span>+{it.lines.length - n} more</span>}</span> : null;
const Body = ({ it }: { it: ArchItem }) => it.lines?.length ? <Lines it={it} /> : it.sub ? <span className="sh-sub">{it.sub}</span> : null;
const attrs = (it: ArchItem) => ({ "data-done": it.done || undefined, "data-late": it.late || undefined, "data-pinned": it.pinned || undefined });
const groupsOf = (items: ArchItem[]) => { const out: [string, ArchItem[]][] = []; for (const it of items) { const k = it.group ?? ""; const g = out.find((x) => x[0] === k); if (g) g[1].push(it); else out.push([k, [it]]); } return out; };
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "·";
const pad2 = (i: number) => String(i + 1).padStart(2, "0");

/** A board of cards (sticky notes, pins, slips, tiles, records): the card is the button, the check sits on it. */
function Board({ items, cls, add, card }: { items: ArchItem[]; cls: string; add?: HubLink; card: (it: ArchItem, i: number) => ReactNode }) {
  return <ul className={`sh-list sh-board ${cls}`}>{items.map((it, i) => <li key={it.id} className="sh-it" {...attrs(it)}>{card(it, i)}{it.check && <CheckBtn c={it.check} />}</li>)}
    {add && <li className="sh-it sh-add"><button type="button" className="sh-op" onClick={add.onClick}><Plus size={22} />{add.label}</button></li>}</ul>;
}
/** A list of rows: the row opens, the check is its own button beside it. */
function Rows({ items, cls, row, check = "end", add, mark }: { items: ArchItem[]; cls: string; row: (it: ArchItem, i: number) => ReactNode; check?: "start" | "end"; add?: HubLink; mark?: (it: ArchItem, i: number) => ReactNode }) {
  const ck = (it: ArchItem, i: number) => it.check && <CheckBtn c={it.check} mark={mark && !(it.check.pressed && it.check.kind !== "pin") ? mark(it, i) : undefined} />;
  return <ul className={`sh-list sh-rowsl ${cls}`}>{items.map((it, i) => <li key={it.id} className="sh-it" {...attrs(it)}>
    {check === "start" && ck(it, i)}
    {check === "start" && !it.check && mark && <span className="sh-ck sh-av" aria-hidden>{mark(it, i)}</span>}
    <button type="button" className="sh-op" onClick={it.open}>{row(it, i)}</button>
    {check === "end" && ck(it, i)}
  </li>)}{add && <li className="sh-it sh-add"><button type="button" className="sh-op" onClick={add.onClick}><Plus size={18} />{add.label}</button></li>}</ul>;
}
const Op = ({ it, children }: { it: ArchItem; children: ReactNode }) => <button type="button" className="sh-op" onClick={it.open}>{children}</button>;

/** A week around today, with a dot on days that have something. */
function Week({ items }: { items: ArchItem[] }) {
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() - 1 + i); return d; });
  const has = new Set(items.map((it) => (it.date ?? "").slice(0, 10)));
  return <ol className="sh-week" aria-hidden>{days.map((d, i) => <li key={i} data-on={i === 1 || undefined} data-has={has.has(iso(d)) || undefined}><small>{d.toLocaleDateString(undefined, { weekday: "narrow" })}</small><b>{d.getDate()}</b></li>)}</ol>;
}

/** Tasks, days or notes, drawn the way this look draws its lists. */
export function ArchList({ look, items, kind, add, total }: { look: NotesTheme; items: ArchItem[]; kind: ArchKind; add?: HubLink; /** How many there are in all, when only some are shown. */ total?: number }): ReactNode {
  const a = archOf(look);
  const stdCard = (it: ArchItem) => <Op it={it}>{it.kicker && <span className="sh-kk">{it.kicker}</span>}<b>{it.title}</b><Body it={it} />{it.meta && <small>{it.meta}</small>}</Op>;
  switch (a) {
    case "sticky": return <Board cls="sh-sticky" items={items} add={add} card={(it) => <Op it={it}><b>{it.title}</b><Body it={it} /><small>{[it.kicker, it.meta].filter(Boolean).join(" · ")}</small></Op>} />;
    case "wall": return <Board cls="sh-wall" items={items} add={add} card={(it) => <><i className="sh-pin" aria-hidden /><Op it={it}><b>{it.title}</b><Body it={it} /><small>{[it.kicker, it.meta].filter(Boolean).join(" · ")}</small></Op></>} />;
    case "receipt": return <Board cls="sh-receipt" items={items} add={add} card={(it) => <Op it={it}><small>{[it.kicker, it.meta].filter(Boolean).join(" · ").toUpperCase()}</small><b>{it.title}</b>{it.lines?.length ? <span className="sh-lines">{it.lines.slice(0, 4).map((x) => <span key={x.id}><em>{x.time || "--:--"}</em><i aria-hidden />{x.title}</span>)}</span> : it.sub ? <span className="sh-sub">{it.sub}</span> : null}</Op>} />;
    case "tiles": return <Board cls="sh-tiles" items={items} add={add} card={stdCard} />;
    case "cons": return <Board cls="sh-cons" items={items} add={add} card={(it) => <Op it={it}><span className="sh-kk">{it.kicker || kind.toUpperCase()}</span><b>{it.title}</b><Body it={it} />{it.meta && <small>{it.meta}</small>}</Op>} />;
    case "strips": return <Rows cls="sh-strips" items={items} add={add} row={(it) => <><span className="sh-kk">{[it.kicker, it.meta].filter(Boolean).join(" · ")}</span><b>{it.title}</b><Body it={it} /></>} />;
    case "cassette": return <ul className="sh-list sh-tapes">{items.map((it) => <li key={it.id} className="sh-it" {...attrs(it)}>
      <span className="sh-label-w"><Op it={it}><b>{it.title}</b><small>{[it.meta || it.kicker, kind === "days" ? "side B" : "side A"].filter(Boolean).join(" · ")}</small></Op>{it.check && <CheckBtn c={it.check} />}</span>
      <span className="sh-reels" aria-hidden><i /><em>{it.lines?.length ? it.lines.map((x) => x.title).join(" · ") : ""}</em><i /></span>
    </li>)}{add && <li className="sh-it sh-add"><button type="button" className="sh-op" onClick={add.onClick}><Plus size={18} />{add.label}</button></li>}</ul>;
    case "dial": return <ul className="sh-list sh-dots">{items.map((it, i) => <li key={it.id} className="sh-it" {...attrs(it)} style={{ ["--dot" as string]: ["var(--an-coral)", "#5ce1e6", "var(--an-violet)"][i % 3] } as CSSProperties}>
      {it.check ? <CheckBtn c={it.check} className="sh-dot" mark={it.check.pressed ? <Tick size={12} /> : null} /> : <i className="sh-dot" aria-hidden />}
      <Op it={it}><b>{it.title}</b><Body it={it} /></Op><small>{it.time || it.meta}</small>
    </li>)}{add && <li className="sh-it sh-add"><button type="button" className="sh-op" onClick={add.onClick}><Plus size={18} />{add.label}</button></li>}</ul>;
    case "deck": {
      const [first, ...rest] = items;
      if (!first) return null;
      return <div className="sh-deck">
        <div className="sh-deckcard" {...attrs(first)}><Op it={first}><span className="sh-kk">{[first.kicker, first.meta].filter(Boolean).join(" · ")}</span><strong aria-hidden>{kind === "days" ? first.big : String(total ?? items.length).padStart(2, "0")}</strong><b>{first.title}</b><Body it={first} /></Op>
          {first.check && <button type="button" className="sh-deckdone" aria-pressed={first.check.pressed} onClick={first.check.onClick}>{first.check.kind === "pin" ? (first.check.pressed ? "Unpin" : "Pin") : first.check.pressed ? "Reopen" : "Done"}</button>}</div>
        {rest.length > 0 && <Rows cls="sh-deckrows" items={rest} check="start" add={add} row={(it) => <><b>{it.title}</b><small>{it.meta || it.kicker}</small></>} />}
      </div>;
    }
    case "shelf": {
      if (kind === "notes") return <Board cls="sh-books" items={items} add={add} card={(it) => <Op it={it}><b>{it.title}</b><small>{it.meta || "Note"}</small></Op>} />;
      if (kind === "days") return <Rows cls="sh-lined" items={items} add={add} row={(it) => <><span className="sh-kk">{it.group}</span><Body it={it} /></>} />;
      const lists: [string, ArchItem[]][] = []; for (const it of items) { const k = it.kicker || "Tasks"; const g = lists.find((x) => x[0] === k); if (g) g[1].push(it); else lists.push([k, [it]]); }
      const [next, ...rest] = items;
      return <div className="sh-shelf">
        <ul className="sh-list sh-books">{lists.slice(0, 6).map(([k, l]) => <li key={k} className="sh-it"><button type="button" className="sh-op" onClick={l[0].open}><b>{k}</b><small>{l.length} {l.length === 1 ? "page" : "pages"}</small></button></li>)}</ul>
        {next && <><div className="sh-sublabel">Pick up where you left off</div><div className="sh-pick" {...attrs(next)}><Op it={next}><b>{next.title}</b><small>{[next.kicker, next.meta].filter(Boolean).join(" · ")}</small></Op>{next.check && <CheckBtn c={next.check} />}</div></>}
        {rest.length > 0 && <Rows cls="sh-lined" items={rest} add={add} row={(it) => <><b>{it.title}</b><small>{[it.kicker, it.meta].filter(Boolean).join(" · ")}</small></>} />}
      </div>;
    }
    case "paper": return <div className="sh-groups">{groupsOf(items).map(([g, list]) => <section key={g}><div className="sh-grp">{g}</div>
      <Rows cls="sh-paper" items={list} row={(it) => <><span className="sh-kk sh-acc">{[it.kicker, it.meta].filter(Boolean).join(" · ")}</span><b>{kind === "days" ? it.sub || it.title : it.title}</b>{kind !== "days" && <Body it={it} />}</>} />
    </section>)}{add && <button type="button" className="sh-addrow" onClick={add.onClick}><Plus size={18} />{add.label}</button>}</div>;
    case "timeline": return <div className="sh-groups">{groupsOf(items).map(([g, list]) => <section key={g}><div className="sh-grp">{g}</div>
      <Rows cls="sh-tline" items={list} check="start" row={(it) => <>{(it.time || it.meta) && <em>{kind === "days" ? it.lines?.map((x) => x.time).filter(Boolean).join(" · ") || it.meta : it.meta}</em>}<b>{kind === "days" ? it.sub || it.title : it.title}</b>{kind !== "days" && <Body it={it} />}</>} />
    </section>)}{add && <button type="button" className="sh-addrow" onClick={add.onClick}><Plus size={18} />{add.label}</button>}</div>;
    case "rows": return <Rows cls="sh-rows" items={items} check="start" add={add} mark={(it, i) => look.v === "outline" ? pad2(i) : look.v === "cornell" ? null : kind === "days" ? it.big : kind === "notes" && it.check?.kind === "pin" ? null : initials(it.kicker || it.title)} row={(it) => <><span className="sh-r-t">{it.kicker && <span className="sh-kk">{it.kicker}</span>}<b>{it.title}</b><Body it={it} /></span><small>{it.meta}</small></>} />;
    case "index": return <Rows cls="sh-ix" items={items} add={add} row={(it) => <><span className="sh-kk">{it.kicker}</span><b>{it.title}</b><Body it={it} />{it.meta && <small>{it.meta}</small>}</>} />;
    case "chron": return <div className="sh-chron">{kind !== "notes" && <Week items={items} />}
      <Rows cls="sh-tl" items={items} add={add} row={(it) => <><span className="sh-kk">{kind === "days" ? it.group : it.kicker}</span><b>{kind === "days" ? it.sub || it.title : it.title}</b>{kind !== "days" && <Body it={it} />}{kind !== "days" && it.meta && <small>{it.meta}</small>}</>} /></div>;
    case "edit": return <Rows cls="sh-ed" items={items} check="start" add={add} row={(it) => <><b>{kind === "days" ? `${it.title} — ${it.sub}` : it.title}</b><small>{kind === "days" ? it.time ?? "" : it.meta}</small></>} />;
    case "atlas": {
      if (kind === "tasks") {
        const lists: [string, ArchItem[]][] = []; for (const it of items) { const k = it.kicker || "Tasks"; const g = lists.find((x) => x[0] === k); if (g) g[1].push(it); else lists.push([k, [it]]); }
        return <div className="sh-atlas">
          <ul className="sh-list sh-tiles2">{lists.slice(0, 4).map(([k, l]) => <li key={k} className="sh-it"><button type="button" className="sh-op" onClick={l[0].open}><span aria-hidden className="sh-tile-i"><Svg size={22}><path d="M4 5h16v14H4zM8 12l3 3 5-6" /></Svg></span><b>{k}</b><small>{l.length} to do</small></button></li>)}</ul>
          <div className="sh-sublabel">Recent</div>
          <Rows cls="sh-ix" items={items} add={add} row={(it) => <><b>{it.title}</b>{it.meta && <small>{it.meta}</small>}</>} />
        </div>;
      }
      if (kind === "days") return <Board cls="sh-tiles2 sh-daytiles" items={items} card={(it) => <Op it={it}><span className="sh-tile-i sh-tile-d" aria-hidden><small>{it.title.split(" ")[0]}</small><b>{it.big}</b></span><b>{it.sub}</b><small>{it.meta}</small></Op>} />;
      return <Rows cls="sh-ix" items={items} add={add} row={(it) => <><b>{it.title}</b><Body it={it} />{it.meta && <small>{it.meta}</small>}</>} />;
    }
    case "stream": return <Rows cls="sh-st" items={items} check="start" add={add} row={(it) => <><b>{kind === "days" ? it.sub || it.title : it.title}</b>{kind !== "days" && <Body it={it} />}<span className="sh-kk">{kind === "days" ? `${it.group}${it.time ? ` · ${it.time}` : ""}` : [it.kicker, it.meta].filter(Boolean).join(" · ")}</span></>} />;
    // Billboard keeps the rows it has always had (protoLooks.css): numbered, ruled, in huge type.
    case "billboard":
      if (kind === "days") return <div className="stx-bb-agenda">{items.map((it) => <button type="button" key={it.id} className="stx-bb-day" onClick={it.open}>
        <span className="stx-bb-date"><small>{it.title.split(" ")[0]}</small><b>{it.big}</b><small>{it.kicker}</small></span>
        <span className="stx-bb-items">{(it.lines ?? []).slice(0, 3).map((x) => <span key={x.id}><em>{x.time}</em>{x.title}</span>)}{(it.lines?.length ?? 0) > 3 && <span><em /> +{(it.lines?.length ?? 0) - 3} more</span>}</span>
      </button>)}</div>;
      return <ol className="stx-bb-list stx-bb-tasks">{items.map((it, i) => <li key={it.id} {...attrs(it)}>
        {it.check && <button type="button" className="stx-bb-check" aria-pressed={it.check.pressed} aria-label={it.check.label} onClick={it.check.onClick}>{it.check.kind === "pin" ? <PinIc /> : it.check.pressed ? "✓" : ""}</button>}
        <button type="button" className="stx-bb-row" onClick={it.open}><span className="stx-bb-n">{pad2(i)}</span><span className="stx-bb-t"><b>{it.title}</b><small>{[it.meta, it.kicker].filter(Boolean).join(" · ")}</small></span></button>
      </li>)}</ol>;
    default: return <Rows cls="sh-ix" items={items} add={add} row={(it) => <><span className="sh-kk">{it.kicker}</span><b>{it.title}</b><Body it={it} />{it.meta && <small>{it.meta}</small>}</>} />;
  }
}

/** What each arrangement calls the three parts of Home. */
export function archLabels(look: NotesTheme, open: number): { todo: string; days: string; notes: string } {
  switch (archOf(look)) {
    case "receipt": return { todo: `Items due · ${open}`, days: "Coming up", notes: "Notes" };
    case "wall": return { todo: `Pinned to do · ${open}`, days: "This week", notes: "Notes" };
    case "cassette": return { todo: `Side A · ${open} to do`, days: "Side B · coming up", notes: "Notes" };
    case "cons": return { todo: `Open records / ${String(open).padStart(3, "0")}`, days: "Schedule", notes: "Notes" };
    case "index": return { todo: `Task index · ${open}`, days: "Upcoming", notes: "Notes index" };
    case "chron": return { todo: `Your timeline · ${open}`, days: "This week", notes: "Notes" };
    case "edit": return { todo: `Your list · ${open}`, days: "Coming up", notes: "Your writing" };
    case "atlas": return { todo: `Collections · ${open}`, days: "Coming up", notes: "Recent notes" };
    case "shelf": return { todo: `Your lists · ${open}`, days: "This week", notes: "Notebooks" };
    case "paper": return { todo: `To do · ${open}`, days: "Coming up", notes: "From your notes" };
    case "timeline": return { todo: `Still to do · ${open}`, days: "Coming up", notes: "Notes" };
    case "deck": return { todo: `Up next · ${open}`, days: "Coming up", notes: "Notes" };
    case "tiles": return { todo: `To do · ${open}`, days: "Coming up", notes: "Your notes" };
    default: return { todo: `To do · ${open}`, days: "Coming up", notes: "Notes" };
  }
}

/** Whether Home lays the parts out as one wide board (cards in columns) or as a list beside a side column. */
export const archBoard = (look: NotesTheme) => ["sticky", "wall", "receipt", "tiles", "cons"].includes(archOf(look));

// ─── The top of Home ───
export type HubHeroProps = { look: NotesTheme; date: string; greeting: string; primary: HubLink; links: HubLink[]; open?: number; today?: number; hubName?: string };
const Chips = ({ primary, links, pri = true }: { primary?: HubLink; links: HubLink[]; pri?: boolean }) => <div className="sh-chips">
  {primary && <button type="button" className={pri ? "sh-chip-pri" : ""} onClick={primary.onClick} data-testid="hub-look-primary">{pri && <Plus size={16} />}{primary.label}</button>}
  {links.slice(0, 3).map((l) => <button key={l.label} type="button" onClick={l.onClick}>{l.label}</button>)}
</div>;

export function archHubHero({ look, date, greeting, primary, links, open = 0, today = 0, hubName = "" }: HubHeroProps): ReactNode {
  const hub = hubName.toUpperCase();
  const short = new Date().toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" }).toUpperCase();
  const [hello, ...nameParts] = greeting.split(", ");
  const name = nameParts.join(", ");
  switch (archOf(look)) {
    case "sticky": return <><p className="sh-date">{date}</p><h1 className="sh-h1">{greeting}</h1><Chips primary={primary} links={links} /></>;
    case "wall": return <><div className="sh-top"><span className="sh-kk">The wall · {open} to do</span></div><h1 className="sh-h1">{greeting}</h1><Chips primary={primary} links={links} /></>;
    case "receipt": return <div className="sh-rhead"><span className="sh-kk">{hub || "A.R.I.S.E."} · {short}</span><h1 className="sh-h1">{greeting}</h1><p>{"*".repeat(28)}</p><Chips primary={primary} links={links} /></div>;
    case "tiles": return <><h1 className="sh-h1">{greeting}</h1>
      <div className="sh-bento">
        <button type="button" className="sh-t-main" onClick={primary.onClick} data-testid="hub-look-primary"><Plus size={26} /><b>{primary.label}<small>{date}</small></b></button>
        {links.slice(0, 2).map((l, i) => <button key={l.label} type="button" className={i ? "sh-t-b" : "sh-t-a"} onClick={l.onClick}>{l.label}</button>)}
      </div></>;
    case "shelf": return <><span className="sh-kk">{date}</span><h1 className="sh-h1">{greeting}</h1><Chips primary={primary} links={links} /></>;
    case "strips": return <><span className="sh-kk">{date}</span><h1 className="sh-h1">{greeting}</h1><Chips primary={primary} links={links} /></>;
    case "deck": return <><span className="sh-kk">{hub || "To do"} · {open} open</span><h1 className="sh-h1">{greeting}</h1><Chips primary={primary} links={links} /></>;
    case "cassette": return <><span className="sh-kk">{date}</span><h1 className="sh-h1">{greeting}</h1><Chips primary={primary} links={links} /></>;
    case "dial": return <><div className="sh-top"><span className="sh-kk">{date}</span><span className="sh-kk sh-acc">{open} to do</span></div>
      <div className="sh-dialface"><button type="button" onClick={primary.onClick} aria-label={primary.label} data-testid="hub-look-primary"><Plus size={40} /></button><i className="sh-pill sh-p1" /><i className="sh-pill sh-p2" /><i className="sh-pill sh-p3" /></div>
      <h1 className="sh-h1">{greeting}</h1><Chips links={links} /></>;
    case "paper": return <><h1 className="sh-h1 sh-greet">{hello},<br />{name ? `${name}.` : "welcome back."}</h1>
      <button type="button" className="sh-search" onClick={primary.onClick} data-testid="hub-look-primary"><Plus size={18} />{primary.label}…</button>
      {links[0] && <button type="button" className="sh-askdark" onClick={links[0].onClick}>{links[0].label}</button>}<Chips links={links.slice(1)} /></>;
    case "timeline": return <><span className="sh-kk">{date}</span>
      <button type="button" className="sh-tapbig" onClick={primary.onClick} data-testid="hub-look-primary"><span><Plus size={32} /></span><b>{greeting}<small>{primary.label}, or see what's coming up.</small></b></button>
      <Chips links={links} /></>;
    case "rows": return <><div className="sh-top">{look.v === "cornell" ? <div><span className="sh-kk">{date}</span><h1 className="sh-h1">{greeting}</h1></div> : <h1 className="sh-h1">{greeting}</h1>}</div>
      <button type="button" className="sh-search" onClick={primary.onClick} data-testid="hub-look-primary"><Plus size={18} />{primary.label}</button><Chips links={links} /></>;
    case "index": return <><header className="sh-head"><span className="sh-kk">{hub || "A.R.I.S.E."} / Index</span><h1 className="sh-h1">{greeting}</h1><p>Every task, exactly where it is · {date}</p></header><Chips primary={primary} links={links} /></>;
    case "chron": return <><header className="sh-head"><span className="sh-kk">{hub || "A.R.I.S.E."} / Chronicle</span><h1 className="sh-h1">{greeting}</h1><p>Your day, over time · {date}</p></header><Chips primary={primary} links={links} /></>;
    case "edit": return <><div className="sh-top"><span className="sh-kk">{hub || "A.R.I.S.E."} · {date}</span></div><h1 className="sh-hl">{greeting}.</h1>
      <div className="sh-btns"><button type="button" className="sh-b-pri" onClick={primary.onClick} data-testid="hub-look-primary">{primary.label} <Arrow /></button>{links.slice(0, 2).map((l) => <button key={l.label} type="button" className="sh-b-out" onClick={l.onClick}>{l.label}</button>)}</div></>;
    case "cons": return <><header className="sh-head"><span className="sh-kk">{hub || "A.R.I.S.E."} / Field</span><h1 className="sh-h1">{(name || hello).toUpperCase()} / {hub || "TASKS"}</h1><p>Task system — active · {date}</p></header>
      <div className="sh-sublabel">System status / online</div><h2 className="sh-hl">{open} open. {today} today.</h2>
      <div className="sh-btns"><button type="button" className="sh-b-pri" onClick={primary.onClick} data-testid="hub-look-primary"><Plus size={16} />{primary.label.toUpperCase()}</button>{links.slice(0, 2).map((l) => <button key={l.label} type="button" className="sh-b-out" onClick={l.onClick}>{l.label.toUpperCase()}</button>)}</div></>;
    case "atlas": return <><header className="sh-head"><span className="sh-kk">{hub || "A.R.I.S.E."} / Atlas</span><h1 className="sh-h1">{greeting}</h1><p>Your day, organized</p></header>
      <div className="sh-card"><span className="sh-kk">Today · {date}</span><h2 className="sh-hl">{open} to do. {today ? `${today} on today.` : "A clear day."}</h2>
        <div className="sh-btns"><button type="button" className="sh-b-pri" onClick={primary.onClick} data-testid="hub-look-primary">{primary.label}</button>{links.slice(0, 2).map((l) => <button key={l.label} type="button" className="sh-b-out" onClick={l.onClick}>{l.label}</button>)}</div></div></>;
    case "stream": return <><div className="sh-top"><span className="sh-kk sh-ink">A.R.I.S.E. / {hub || "Duo"}</span></div><h1 className="sh-hl">{greeting}.</h1><Chips primary={primary} links={links} /></>;
    default: return <><span className="sh-kk">{date}</span><h1 className="sh-h1">{greeting}</h1><Chips primary={primary} links={links} /></>;
  }
}
