// The apps you can add to Arise Notes (the App Gallery, NotesApps.tsx): what each one is, which ones
// you've added (saved to the account, so they follow you to every device) and the row of them on Home.
// Kept small and separate from the apps themselves so Home doesn't load them.
import type { ReactNode } from "react";
import { FileText, Layers, LayoutGrid, ListChecks, PenLine, Plus, Presentation, StickyNote, Table2, Timer } from "lucide-react";
import { useAppData } from "@/lib/cloudDocs";
import type { AppCtx } from "./NotesApp";

export type NotesAppId = "stickies" | "lists" | "whiteboard" | "sheets" | "slides" | "docs" | "flashcards" | "focus";
export type NotesAppInfo = { id: NotesAppId; name: string; short: string; tagline: string; about: string; color: string; icon: ReactNode; group: "Write & plan" | "Office" | "Study" };

export const NOTES_APPS: NotesAppInfo[] = [
  { id: "stickies", name: "Sticky Notes", short: "Stickies", tagline: "Quick colored notes on a board", group: "Write & plan", color: "#f2a900", icon: <StickyNote />,
    about: "Jot something down in a second: a phone number, a reminder, an idea. Pick a color and pin the ones that matter most." },
  { id: "lists", name: "Checklists", short: "Lists", tagline: "Lists you can tick off", group: "Write & plan", color: "#15803d", icon: <ListChecks />,
    about: "Groceries, packing, the steps of a project. Make as many lists as you need and check things off as you go." },
  { id: "whiteboard", name: "Whiteboard", short: "Whiteboard", tagline: "Sketch, draw and diagram", group: "Write & plan", color: "#0284c7", icon: <PenLine />,
    about: "A blank board for diagrams, maps and quick sketches, with colors, pen sizes, an eraser and undo. Keep up to six boards." },
  { id: "sheets", name: "A.R.I.S.E. Sheets", short: "Sheets", tagline: "Spreadsheets with formulas", group: "Office", color: "#0f9d58", icon: <Table2 />,
    about: "Budgets, grade books, trackers: real spreadsheets with formulas, charts and templates. Open Excel files and download yours." },
  { id: "slides", name: "A.R.I.S.E. Slides", short: "Slides", tagline: "Build and present slide decks", group: "Office", color: "#e8590c", icon: <Presentation />,
    about: "Make a presentation from scratch or a template, then present it full screen. Turn a meeting's notes into slides for the next one." },
  { id: "docs", name: "A.R.I.S.E. Docs", short: "Docs", tagline: "Write and format documents", group: "Office", color: "#2563eb", icon: <FileText />,
    about: "Longer writing with headings, lists and formatting: reports, letters and plans. Download as Word or PDF." },
  { id: "flashcards", name: "Flashcards", short: "Flashcards", tagline: "Study cards, or make them from a note", group: "Study", color: "#7c3aed", icon: <Layers />,
    about: "Turn a recorded class or meeting into study cards in one tap, or make your own decks. Flip, shuffle and keep track of the ones you know." },
  { id: "focus", name: "Focus Timer", short: "Focus", tagline: "25 minutes on, 5 minutes off", group: "Study", color: "#db2777", icon: <Timer />,
    about: "A Pomodoro timer for studying or deep work: focus, take a short break, repeat. It counts today's sessions." },
];
export const notesAppOf = (id: string) => NOTES_APPS.find((a) => a.id === id);

const cleanInstalled = (raw: unknown): { installed: NotesAppId[] } => {
  const r = (raw && typeof raw === "object" ? raw : {}) as { installed?: unknown };
  const ids = Array.isArray(r.installed) ? r.installed.filter((x): x is NotesAppId => typeof x === "string" && NOTES_APPS.some((a) => a.id === x)) : [];
  return { installed: [...new Set(ids)] };
};

/** The apps this person has added, saved to the account. Removing one never deletes what's in it. */
export function useNotesApps() {
  const { data, setData, loaded } = useAppData("notes-apps", cleanInstalled);
  const toggle = (id: NotesAppId) => setData((d) => ({ installed: d.installed.includes(id) ? d.installed.filter((x) => x !== id) : [...d.installed, id] }));
  return { installed: data.installed, toggle, loaded };
}

export function AppIcon({ app, size = 44 }: { app: NotesAppInfo; size?: number }) {
  return <span aria-hidden className="grid shrink-0 place-items-center text-white shadow-[0_6px_14px_-8px_rgba(0,0,0,.55)] [&>svg]:h-[46%] [&>svg]:w-[46%]"
    style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), background: `linear-gradient(150deg, color-mix(in srgb, ${app.color} 78%, #fff), ${app.color})` }}>{app.icon}</span>;
}

/** Home's row of added apps, and the way into the App Gallery. */
export function AppsStrip({ ctx }: { ctx: AppCtx }) {
  const { installed, loaded } = useNotesApps();
  if (!loaded && !installed.length) return null;
  const apps = NOTES_APPS.filter((a) => installed.includes(a.id));
  if (!apps.length) return <button type="button" onClick={() => ctx.go({ name: "apps" })} className="an-card flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:border-[var(--an-violet)]" data-testid="notes-apps-promo">
    <span className="flex shrink-0 -space-x-2">{NOTES_APPS.slice(0, 3).map((a) => <AppIcon key={a.id} app={a} size={34} />)}</span>
    <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold">Add apps to Notes</span><span className="block truncate text-[13px] text-[var(--an-muted)]">Sticky notes, Sheets, Slides, flashcards and more</span></span>
    <LayoutGrid className="h-5 w-5 shrink-0 text-[var(--an-muted)]" aria-hidden />
  </button>;
  return <section aria-labelledby="notes-apps-heading" data-testid="notes-apps-strip">
    <div className="mb-2 flex items-center gap-2"><h2 id="notes-apps-heading" className="mr-auto text-[16px] font-bold tracking-tight">Your apps</h2>
      <button type="button" onClick={() => ctx.go({ name: "apps" })} className="rounded-full px-2 py-1 text-[13px] font-bold text-[var(--an-ink)] underline decoration-[color-mix(in_srgb,var(--an-ink)_35%,transparent)] underline-offset-[3px]">App Gallery</button></div>
    <div className="an-scroll -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
      {apps.map((a) => <button key={a.id} type="button" onClick={() => ctx.go({ name: "app", id: a.id })} data-testid={`notes-app-${a.id}`}
        className="an-card flex w-[5.4rem] shrink-0 flex-col items-center gap-1.5 px-1 py-3 text-[12.5px] font-semibold"><AppIcon app={a} size={42} /><span className="w-full truncate text-center">{a.short}</span></button>)}
      <button type="button" onClick={() => ctx.go({ name: "apps" })} className="an-card flex w-[5.4rem] shrink-0 flex-col items-center gap-1.5 px-1 py-3 text-[12.5px] font-semibold text-[var(--an-muted)]">
        <span aria-hidden className="grid h-[42px] w-[42px] place-items-center rounded-[13px] border-2 border-dashed border-[var(--an-line)]"><Plus className="h-5 w-5" /></span>Get more</button>
    </div>
  </section>;
}
