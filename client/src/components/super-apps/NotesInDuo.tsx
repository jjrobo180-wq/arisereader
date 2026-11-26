// Arise Notes inside Arise To Do: Notes' own screens and notes (signed in with the To Do account), in To
// Duo's colors, under To Do's heading and row of pages. Which pages show is picked with the settings button;
// the Notes plugins (Docs, Sheets, Slides, whiteboard…) are its Plugins page.
import { useMemo, useState } from "react";
import { superAppOf } from "@shared/superApps";
import type { Family } from "@shared/familyHub";
import NotesApp, { type NotesDuo } from "@/components/arise-notes/NotesApp";
import { PagePicker, PageStrip, SuperHead, useSuperPages } from "./SuperShell";
import "./notes-duo.css";

export default function NotesInDuo({ family, setFamily, night, start }: { family: Family; setFamily: (update: (f: Family) => Family) => void; night: boolean; start?: string | null }) {
  const app = superAppOf("arisenotes")!;
  const { pages, save } = useSuperPages(app, family, setFamily);
  const [picking, setPicking] = useState(false);
  const pageKey = pages.join();
  const duo = useMemo<NotesDuo>(() => ({
    night, start,
    top: ({ page, go }) => <>
      <SuperHead app={app} onSettings={() => go("settings")} settingsLabel="Arise Notes settings" tabs={<PageStrip app={app} pages={pages.includes(page) ? pages : [...pages, page]} current={page} onPick={go} onEdit={() => setPicking(true)} />} />
    </>,
  }), [night, start, pageKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="super-arisenotes" data-testid="super-app-arisenotes">
    <NotesApp mode="embedded" hub="life" duo={duo} />
    {picking && <PagePicker app={app} pages={pages} onSave={save} onClose={() => setPicking(false)} />}
  </div>;
}
