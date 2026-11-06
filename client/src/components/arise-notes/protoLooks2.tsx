// The hand-made Studio arrangements: Rows (Cabinet, Threadline, Maison, Helvetic, Obsidian, Outliner, Cornell),
// Timeline, Wall, Tiles, Shelf and Sticky. protoLooks.tsx calls these for any arrangement it does not draw itself.
import type { ReactNode } from "react";
import type { NotesTheme } from "@shared/ariseNotes";
import type { ListNote } from "./api";
import type { HomeActions } from "./looks";
import { Bar2, IcGear, IcMic, IcSearch, Svg, Title, dayWord, gist, kindOf, label, metaOf } from "./protoLooks";

const initials = (n: ListNote) => (n.title || "N").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
const Round = ({ a }: { a: HomeActions }) => <span className="pl-icons">
  <button type="button" aria-label="Ask or search your notes" onClick={a.ask} data-testid="notes-ask-bar"><IcSearch /></button>
  {a.settings && <button type="button" aria-label="Settings" onClick={a.settings}><IcGear /></button>}
</span>;
const Actions = ({ a }: { a: HomeActions }) => <div className="pl-chips">
  <button type="button" onClick={a.upload} data-testid="notes-upload">Upload</button>
  <button type="button" onClick={a.memo} data-testid="notes-memo">Voice memo{a.memoLocked ? " · Basic" : ""}</button>
  <button type="button" onClick={a.ask}>Ask</button>
</div>;
const folders = (notes: ListNote[]) => { const m = new Map<string, number>(); for (const n of notes) { const k = n.folder || kindOf(n); m.set(k, (m.get(k) ?? 0) + 1); } return [...m]; };

export function bespokeHero(look: NotesTheme, a: HomeActions): ReactNode {
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  switch (look.arch) {
    case "rows": return <>
      <div className="pl-top">{look.v === "cornell" ? <div><span className="pl-kk">{today}</span><h1 className="pl-rows-h">Your notes</h1></div> : <h1 className="pl-rows-h">Notes</h1>}<Round a={a} /></div>
      <button type="button" className="pl-search" onClick={a.ask} data-testid="notes-ask-bar"><IcSearch size={18} />Search or ask</button>
      <Actions a={a} />
      <div className="pl-kk pl-label">{look.v === "outline" ? "// recent" : "Recent"} · {a.count ?? 0}</div>
    </>;
    case "timeline": return <>
      <div className="pl-top"><span className="pl-kk">{today}</span><Round a={a} /></div>
      <button type="button" className="pl-tapbig" onClick={a.record} data-testid="notes-record"><span><IcMic size={30} /></span><b>Tap to record<small>Or upload audio, or write a note.</small></b></button>
      <Actions a={a} />
    </>;
    case "wall": return <>
      <div className="pl-top"><span className="pl-kk">THE WALL · {a.count ?? 0} NOTES</span><Round a={a} /></div>
      <Actions a={a} />
    </>;
    case "tiles": return <>
      <div className="pl-top"><h1 className="pl-rows-h">Hey there</h1><Round a={a} /></div>
      <div className="pl-bento">
        <button type="button" className="pl-t-rec" onClick={a.record} data-testid="notes-record"><IcMic size={26} /><b>Record<small>Meetings, classes, calls</small></b></button>
        <button type="button" className="pl-t-up" onClick={a.upload} data-testid="notes-upload"><Svg size={22}><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></Svg>Upload</button>
        <button type="button" className="pl-t-ask" onClick={a.ask}><Svg size={22}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></Svg>Ask</button>
      </div>
      <div className="pl-top pl-label"><h2 className="pl-rows-h2">Your notes</h2><button type="button" className="pl-link" onClick={a.ask}>Search</button></div>
    </>;
    case "shelf": return <>
      <div className="pl-top"><div><span className="pl-kk">{today}</span><h1 className="pl-rows-h">Notebooks</h1></div><Round a={a} /></div>
      <Actions a={a} />
    </>;
    case "sticky": return <>
      <div className="pl-top"><h1 className="pl-rows-h">{look.v === "pad" ? "Sticky pad" : "Stickies"}</h1><Round a={a} /></div>
      <Actions a={a} />
    </>;
    case "strips": return <>
      <div className="pl-top"><h1 className="pl-rows-h">Strips</h1><Round a={a} /></div>
      <Actions a={a} />
    </>;
    case "receipt": return <>
      <div className="pl-top"><span className="pl-kk">ARISE NOTES · {new Date().toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" }).toUpperCase()}</span><Round a={a} /></div>
      <Actions a={a} />
    </>;
    case "deck": return <>
      <div className="pl-top"><span className="pl-kk">NOTES · {a.count ?? 0}</span><Round a={a} /></div>
      <Actions a={a} />
    </>;
    case "cassette": return <>
      <div className="pl-top"><h1 className="pl-rows-h">My tapes</h1><Round a={a} /></div>
      <Actions a={a} />
    </>;
    case "dial": return <>
      <div className="pl-top"><span className="pl-kk">{today.toUpperCase()}</span><span className="pl-kk pl-acc">{a.count ?? 0} CAPTURES</span></div>
      <div className="pl-dialface" aria-hidden="false"><button type="button" onClick={a.record} data-testid="notes-record" aria-label="Record"><IcMic size={44} /></button><i className="pl-pill pl-p1" /><i className="pl-pill pl-p2" /><i className="pl-pill pl-p3" /></div>
      <Actions a={a} />
    </>;
    case "paper": return <>
      <h1 className="pl-rows-h pl-greet">{new Date().getHours() < 12 ? "Good morning," : new Date().getHours() < 18 ? "Good afternoon," : "Good evening,"}<br />welcome back.</h1>
      <button type="button" className="pl-search" onClick={a.ask} data-testid="notes-ask-bar"><IcSearch size={18} />Search every note</button>
      <button type="button" className="pl-askdark" onClick={a.ask}><Svg size={18}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></Svg>Ask your notes anything</button>
      <div className="pl-chips"><button type="button" onClick={a.upload} data-testid="notes-upload">Upload</button><button type="button" onClick={a.memo} data-testid="notes-memo">Voice memo{a.memoLocked ? " · Basic" : ""}</button></div>
    </>;
    default: return null;
  }
}

export function BespokeList({ look, notes, onOpen }: { look: NotesTheme; notes: ListNote[]; onOpen: (n: ListNote) => void }): ReactNode {
  switch (look.arch) {
    case "rows": return <ul className="pl-rowlist">{notes.map((n, i) => <li key={n.id}><button type="button" onClick={() => onOpen(n)} data-testid="notes-card">
      <span className="pl-av" aria-hidden>{look.v === "outline" ? String(i + 1).padStart(2, "0") : look.v === "cornell" ? "" : initials(n)}</span>
      <span className="pl-r-t"><span className="pl-kk">{label(n)}</span><b><Title n={n} /></b><span className="pl-ix-g">{gist(n)}</span></span>
      <small>{dayWord(n.createdAt)}</small>
    </button></li>)}</ul>;
    case "timeline": {
      const groups: [string, ListNote[]][] = []; for (const n of notes) { const k = dayWord(n.createdAt); const g = groups.find((x) => x[0] === k); if (g) g[1].push(n); else groups.push([k, [n]]); }
      return <>{groups.map(([k, list]) => <section key={k}><div className="pl-kk pl-label">{k}</div>
        <ul className="pl-tline">{list.map((n) => <li key={n.id}><button type="button" onClick={() => onOpen(n)} data-testid="notes-card"><em>{new Date(n.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</em><b><Title n={n} /></b><span className="pl-ix-g">{[mins(n), gist(n)].filter(Boolean).join(" · ")}</span></button></li>)}</ul></section>)}</>;
    }
    case "wall": return <ul className="pl-pins">{notes.map((n) => <li key={n.id}><button type="button" onClick={() => onOpen(n)} data-testid="notes-card"><i aria-hidden /><b><Title n={n} /></b><span>{gist(n)}</span></button></li>)}</ul>;
    case "tiles": return <ul className="pl-cards">{notes.map((n) => <li key={n.id}><button type="button" onClick={() => onOpen(n)} data-testid="notes-card"><span className="pl-kk">{label(n)} · {mins(n) || dayWord(n.createdAt)}</span><b><Title n={n} /></b><span className="pl-ix-g">{gist(n)}</span></button></li>)}</ul>;
    case "shelf": {
      const fs = folders(notes).slice(0, 5); const first = notes[0];
      return <>
        <ul className="pl-books">{fs.map(([k, c]) => <li key={k}><button type="button" onClick={() => onOpen(notes.find((n) => (n.folder || kindOf(n)) === k) ?? notes[0])}><b>{k}</b><small>{c} page{c === 1 ? "" : "s"}</small></button></li>)}</ul>
        {first && <><div className="pl-kk pl-label">Pick up where you left off</div><button type="button" className="pl-pick" onClick={() => onOpen(first)} data-testid="notes-card"><span><b><Title n={first} /></b><small>{label(first)} · {metaOf(first)}</small></span><Svg size={18} w={2.2}><path d="m9 6 6 6-6 6" /></Svg></button></>}
      </>;
    }
    case "sticky": return <ul className="pl-notes">{notes.map((n) => <li key={n.id}><button type="button" onClick={() => onOpen(n)} data-testid="notes-card"><b><Title n={n} /></b><span>{gist(n)}</span><small>{dayWord(n.createdAt)}</small></button></li>)}</ul>;
    case "strips": return <ul className="pl-stripl">{notes.map((n) => <li key={n.id}><button type="button" onClick={() => onOpen(n)} data-testid="notes-card"><span className="pl-kk">{label(n)} · {mins(n) || dayWord(n.createdAt)}</span><b><Title n={n} /></b></button></li>)}</ul>;
    case "receipt": return <ul className="pl-slips">{notes.map((n) => <li key={n.id}><button type="button" onClick={() => onOpen(n)} data-testid="notes-card"><small>{label(n).toUpperCase()} · {mins(n) || dayWord(n.createdAt)}</small><b><Title n={n} /></b><span>{gist(n)}</span></button></li>)}</ul>;
    case "deck": {
      const [first, ...rest] = notes;
      return <>{first && <button type="button" className="pl-deckcard" onClick={() => onOpen(first)} data-testid="notes-card"><span className="pl-kk">{dayWord(first.createdAt)} · {label(first)} · {mins(first) || "note"}</span><strong aria-hidden>{String(notes.length).padStart(2, "0")}</strong><b><Title n={first} /></b><span className="pl-ix-g">{gist(first)}</span></button>}
        <ul className="pl-deckrows">{rest.map((n) => <li key={n.id}><button type="button" onClick={() => onOpen(n)} data-testid="notes-card"><b><Title n={n} /></b><small>{metaOf(n)}</small></button></li>)}</ul></>;
    }
    case "cassette": return <ul className="pl-tapes">{notes.map((n) => <li key={n.id}><button type="button" onClick={() => onOpen(n)} data-testid="notes-card"><span className="pl-label-w"><b><Title n={n} /></b><small>{metaOf(n)} · side A</small></span><span className="pl-reels" aria-hidden><i /><em /><i /></span></button></li>)}</ul>;
    case "dial": return <ul className="pl-dots">{notes.map((n) => <li key={n.id}><button type="button" onClick={() => onOpen(n)} data-testid="notes-card"><i aria-hidden /><b><Title n={n} /></b><small>{new Date(n.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</small></button></li>)}</ul>;
    case "paper": {
      const groups: [string, ListNote[]][] = []; for (const n of notes) { const k = dayWord(n.createdAt); const g = groups.find((x) => x[0] === k); if (g) g[1].push(n); else groups.push([k, [n]]); }
      return <>{groups.map(([k, list]) => <section key={k}><div className="pl-kk pl-label">{k}</div><ul className="pl-paperl">{list.map((n) => <li key={n.id}><button type="button" onClick={() => onOpen(n)} data-testid="notes-card"><span className="pl-kk pl-acc">{label(n)} · {mins(n) || dayWord(n.createdAt)}</span><b><Title n={n} /></b><span className="pl-ix-g">{gist(n)}</span></button></li>)}</ul></section>)}</>;
    }
    default: return null;
  }
}
const mins = (n: ListNote) => (n.durationSecs > 0 ? `${Math.max(1, Math.round(n.durationSecs / 60))} min` : "");

export function bespokeBar(look: NotesTheme, on: "ai" | "pages", record: () => void, notes: () => void, home: () => void): ReactNode {
  switch (look.arch) {
    case "wall": return <nav aria-label="Arise Notes" className="an-noprint pl-pinbar" data-testid="notes-tabs">
      <button type="button" className="pl-pin" onClick={record} data-testid="notes-tab-record"><IcMic size={20} />Pin a new note</button>
      {on === "ai" ? <button type="button" className="pl-pin-alt" onClick={notes} data-testid="notes-tab-pages">Notes</button> : <button type="button" className="pl-pin-alt" onClick={home} data-testid="notes-tab-ai">Home</button>}
    </nav>;
    case "receipt": return <nav aria-label="Arise Notes" className="an-noprint pl-pinbar pl-printbar" data-testid="notes-tabs">
      <button type="button" className="pl-pin" onClick={record} data-testid="notes-tab-record"><IcMic size={20} />PRINT NEW</button>
      {on === "ai" ? <button type="button" className="pl-pin-alt" onClick={notes} data-testid="notes-tab-pages">NOTES</button> : <button type="button" className="pl-pin-alt" onClick={home} data-testid="notes-tab-ai">HOME</button>}
    </nav>;
    case "shelf": return <nav aria-label="Arise Notes" className="an-noprint pl-bar2 pl-bar1" data-testid="notes-tabs">
      <button type="button" className="pl-b-pri" onClick={record} data-testid="notes-tab-record"><IcMic size={18} />Start a page and record</button>
    </nav>;
    case "rows": if (look.v === "cabinet") return <nav aria-label="Arise Notes" className="an-noprint pl-cab" data-testid="notes-tabs">
      <button type="button" aria-current={on === "ai" ? "page" : undefined} onClick={on === "ai" ? notes : home} data-testid="notes-tab-pages"><Svg size={22} w={2}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Svg>Folders</button>
      <button type="button" className="pl-cab-rec" aria-label="Record" onClick={record} data-testid="notes-tab-record"><IcMic size={28} /></button>
      <button type="button" onClick={home} data-testid="notes-tab-ai"><Svg size={22} w={2}><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></Svg>Home</button>
    </nav>;
    // falls through to the two-button bar
    default: return on === "ai" ? <Bar2 record={record} second={notes} secondLabel="New note" on={on} /> : <Bar2 record={record} second={home} secondLabel="Home" on={on} />;
  }
}
