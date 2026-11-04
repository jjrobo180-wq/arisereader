// A preview of Arise Notes' looks for the App Store screens workflow (script/appStoreScreens.mjs): Notes
// needs a signed-in account, so this page draws its Home, notes list, recording screen and tab bar from
// the real components with made-up notes. Not part of any app. ?look=<id>&view=home|rec&night=1
import { useEffect, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { nightLook, themeOf, themeVars } from "@shared/ariseNotes";
import type { ListNote } from "@/components/arise-notes/api";
import { LookHomeHero, LookNoteList, LookRecordArt, LookTabBar } from "@/components/arise-notes/looks";
import "@/components/arise-notes/notes.css";
import "@/components/arise-notes/notes-themes.css";

const q = new URLSearchParams(location.search);
const night = q.get("night") === "1", base = themeOf(q.get("look") || "classic"), look = night ? nightLook(base) : base;
const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
const note = (id: string, title: string, gist: string, mins: number, d: number, actions = 0, template: ListNote["template"] = "general"): ListNote => ({ id, title, template, source: "record", status: "done", durationSecs: mins * 60, createdAt: ago(d), folder: "", tags: [], familyShared: false, mine: true, gist, actions, minutes: mins });
const NOTES = [note("1", "Team standup", "Launch moved to Friday; Sam owns the checklist.", 14, 0, 3), note("2", "Parent-teacher conference", "Reading is up two levels; practice fractions at home.", 22, 1, 2, "parent"), note("3", "Doctor visit", "New dose starts Monday. Follow-up in six weeks.", 9, 3, 1, "doctor"), note("4", "Book club", "Next month: the lighthouse novel.", 41, 6)];

function Rec() {
  const [secs, setSecs] = useState(83), [level, setLevel] = useState(0.6);
  useEffect(() => { const t = setInterval(() => { setSecs((s) => s + 1); setLevel(0.35 + Math.random() * 0.6); }, 400); return () => clearInterval(t); }, []);
  return <section className="an-card an-l-recsec" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 20px", textAlign: "center" }}><LookRecordArt look={look} secs={secs} paused={false} finishing={false} level={level} /></section>;
}

function App() {
  useEffect(() => { if (look.fontUrl) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = look.fontUrl; document.head.appendChild(l); } }, []);
  const noop = () => {};
  const view = q.get("view") || "home";
  return <div className={`an-root an-themed an-theme-${base.id}${night ? " an-night" : ""}`} style={{ ...themeVars(look), minHeight: "100dvh" } as CSSProperties}>
    <main style={{ maxWidth: 1024, margin: "0 auto", padding: "20px 16px 96px", display: "grid", gap: 20 }}>
      {view === "rec" ? <Rec /> : <>
        <LookHomeHero look={look} a={{ first: "Sam", minutes: null, record: noop, upload: noop, memo: noop, ask: noop }} />
        <LookNoteList look={look} notes={NOTES} onOpen={noop} />
      </>}
    </main>
    <LookTabBar on="ai" initial="S" home={noop} notes={noop} record={noop} settings={noop} />
  </div>;
}
createRoot(document.getElementById("root")!).render(<App />);
