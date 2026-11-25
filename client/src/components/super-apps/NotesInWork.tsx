// Arise Notes inside WorkHub, like any plugin: the WorkHub menu stays beside it, and it wears To Duo's look
// (super-apps/notes-duo.css) under To Duo's heading and row of pages, the same as in LifeHub (NotesInDuo.tsx).
// The pages picked here are kept on the WorkHub workspace.
import { useMemo, useState } from "react";
import { superAppOf, superPagesFor } from "@shared/superApps";
import NotesApp, { type NotesDuo } from "@/components/arise-notes/NotesApp";
import { PagePicker, PageStrip, SuperHead } from "./SuperShell";
import "./notes-duo.css";

export default function NotesInWork({ picked, savePicked, night }: { picked?: string[]; savePicked: (ids: string[]) => void; night: boolean }) {
  const app = superAppOf("arisenotes")!;
  const pages = superPagesFor(app, picked);
  const [picking, setPicking] = useState(false);
  const pageKey = pages.join();
  const duo = useMemo<NotesDuo>(() => ({
    night, start: null,
    top: ({ page, go }) => <>
      <SuperHead app={app} onSettings={() => setPicking(true)} settingsLabel="Pick your Arise Notes pages" tabs={<PageStrip app={app} pages={pages.includes(page) ? pages : [...pages, page]} current={page} onPick={go} />} />
    </>,
  }), [night, pageKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="super-arisenotes" data-testid="work-super-app-arisenotes">
    <NotesApp mode="embedded" hub="work" duo={duo} />
    {picking && <PagePicker app={app} pages={pages} onSave={(ids) => { savePicked(superPagesFor(app, ids)); setPicking(false); }} onClose={() => setPicking(false)} />}
  </div>;
}
