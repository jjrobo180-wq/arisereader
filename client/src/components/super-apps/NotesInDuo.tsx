// Arise Notes inside Arise To Duo, taken apart into plugins of its own (Nov 15, 2026): Arise Notes (notes,
// its plugins and settings), Recorder (record, upload, voice memos) and Ask @arise (shared/superApps.ts).
// Each one is Notes' own screens and notes (signed in with the To Duo account), in To Duo's colors, under
// To Duo's heading with only its own row of pages. A screen from another part (a note opened from a new
// recording) still opens here.
import { useMemo } from "react";
import { superAppOf, type NotesPartId } from "@shared/superApps";
import NotesApp, { type NotesDuo } from "@/components/arise-notes/NotesApp";
import { PageStrip, SuperHead } from "./SuperShell";
import "./notes-duo.css";

export default function NotesInDuo({ appId = "arisenotes", night, start }: { appId?: NotesPartId; night: boolean; start?: string | null }) {
  const app = superAppOf(appId)!;
  const pages = app.pages.map((p) => p.id);
  const duo = useMemo<NotesDuo>(() => ({
    night, start: start && pages.includes(start) ? start : pages[0],
    top: ({ page, go }) => <>
      <SuperHead app={app} />
      {pages.length > 1 && <PageStrip app={app} pages={pages} current={pages.includes(page) ? page : ""} onPick={go} />}
    </>,
  }), [night, start, appId]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className={`super-arisenotes super-${appId}`} data-testid={`super-app-${appId}`}>
    <NotesApp mode="embedded" hub="life" duo={duo} />
  </div>;
}
