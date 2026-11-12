// The apps you can add to Arise Notes (the App Gallery, NotesApps.tsx): what each one is, which ones
// you've added (saved to the account, so they follow you to every device) and the row of them on Home.
// Kept small and separate from the apps themselves so Home doesn't load them.
import type { ReactNode } from "react";
import { ChevronRight, EyeOff, FileText, Layers, LayoutGrid, ListChecks, Palette, PenLine, Presentation, StickyNote, Table2, Timer } from "lucide-react";
import { useAppData } from "@/lib/cloudDocs";
import type { AppCtx } from "./NotesApp";

export type NotesAppId = "stickies" | "lists" | "whiteboard" | "sheets" | "slides" | "docs" | "design" | "flashcards" | "focus" | "undercover";
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
  { id: "design", name: "Arise Design", short: "Design", tagline: "Posters, flyers, posts and invitations", group: "Office", color: "#7c3aed", icon: <Palette />,
    about: "Make anything look great, like Canva: 80+ templates in every size (Instagram, stories, flyers, posters, invitations, business cards, certificates), text styles, shapes, stickers, photo frames, your own pictures, Magic Design from one sentence, and PNG, JPG or PDF downloads." },
  { id: "flashcards", name: "Flashcards", short: "Flashcards", tagline: "Study cards, or make them from a note", group: "Study", color: "#7c3aed", icon: <Layers />,
    about: "Turn a recorded class or meeting into study cards in one tap, or make your own decks. Flip, shuffle and keep track of the ones you know." },
  { id: "undercover", name: "Undercover", short: "Undercover", tagline: "Choose how the Ask button looks: texting, a doc, and more", group: "Write & plan", color: "#6d3df5", icon: <EyeOff />,
    about: "This is the Ask button's style. Whatever look you pick here is what opens when you tap Ask in Notes (it starts as a text thread). Ask anything during a meeting or class without it looking like AI. Six looks: a text thread, a group chat, a chats inbox, meeting notes, doc comments or a phone doc. Live answers from the web, today's date and the real weather. Tap the name in the inbox look to swap to a decoy chat." },
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

/** An app's mark: a thin line icon in the look's accent, no colored square (the minimal look, November 2026). */
export function AppIcon({ app, size = 44 }: { app: NotesAppInfo; size?: number }) {
  return <span aria-hidden className="grid shrink-0 place-items-center [&>svg]:h-[62%] [&>svg]:w-[62%] [&>svg]:[stroke-width:1.6]"
    style={{ width: size, height: size, color: "var(--an-violet)" }}>{app.icon}</span>;
}

/** Home's row of added apps, and the way into the App Gallery. */
export function AppsStrip({ ctx }: { ctx: AppCtx }) {
  const { installed, loaded } = useNotesApps();
  if (!loaded && !installed.length) return null;
  const apps = NOTES_APPS.filter((a) => installed.includes(a.id));
  if (!apps.length) return <button type="button" onClick={() => ctx.go({ name: "apps" })} className="flex w-full items-center gap-3 border-y border-[var(--an-line)] py-3 text-left" data-testid="notes-apps-promo">
    <LayoutGrid className="h-[18px] w-[18px] shrink-0 text-[var(--an-violet)]" strokeWidth={1.6} aria-hidden />
    <span className="min-w-0 flex-1"><span className="block text-[14.5px] font-semibold">Add apps</span><span className="block truncate text-[12.5px] text-[var(--an-muted)]">Sticky notes, lists, Sheets, Slides, flashcards</span></span>
    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--an-muted)]" aria-hidden />
  </button>;
  return <section aria-labelledby="notes-apps-heading" data-testid="notes-apps-strip">
    <div className="mb-1 flex items-baseline gap-2"><h2 id="notes-apps-heading" className="mr-auto text-[11px] font-semibold uppercase tracking-[.16em] text-[var(--an-muted)]">Your apps</h2>
      <button type="button" onClick={() => ctx.go({ name: "apps" })} className="text-[12.5px] font-semibold text-[var(--an-violet)]">All apps</button></div>
    <ul className="grid grid-cols-2 gap-x-5 border-t border-[var(--an-line)]">
      {apps.map((a) => <li key={a.id} className="border-b border-[var(--an-line)]"><button type="button" onClick={() => ctx.go({ name: "app", id: a.id })} data-testid={`notes-app-${a.id}`}
        className="flex min-h-11 w-full items-center gap-2.5 text-left text-[14px] font-medium"><AppIcon app={a} size={22} /><span className="min-w-0 flex-1 truncate">{a.short}</span><ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--an-muted)]" aria-hidden /></button></li>)}
    </ul>
  </section>;
}
