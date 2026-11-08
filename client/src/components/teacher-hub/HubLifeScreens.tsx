// WorkHub's Notes, Calendar and Journal are LifeHub's own screens, running on the work data: the notes,
// events and journal stay in the teacher's workspace (shared/hubSwap.ts turns them into what the LifeHub
// screens expect, and puts every change back, keeping the work-only details such as a note's student).
import { useMemo, type Dispatch, type SetStateAction } from "react";
import Notes from "@/components/family-hub/Notes";
import Journal from "@/components/family-hub/Journal";
import FamilyCalendar, { type CalendarTask } from "@/components/family-hub/FamilyCalendar";
import { applyFamilyToWorkspace, familyFromWorkspace } from "@shared/hubSwap";
import type { Family } from "@shared/familyHub";
import type { Workspace } from "@shared/teacherHub";

export default function HubLifeScreen({ which, workspace, setWorkspace, today, makeId, say, openTasks }: {
  which: "notes" | "calendar" | "journal";
  workspace: Workspace;
  setWorkspace: Dispatch<SetStateAction<Workspace>>;
  today: string;
  makeId: () => string;
  say: (message: string) => void;
  openTasks?: () => void;
}) {
  const family = useMemo(
    () => familyFromWorkspace(workspace),
    // Only what these screens show: a change anywhere else in the workspace doesn't rebuild it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspace.notes, workspace.journal, workspace.calendars, workspace.extraCalendars, workspace.hiddenCalendars, workspace.events, workspace.hiddenEvents],
  );
  const setFamily = (update: (f: Family) => Family) =>
    setWorkspace((prev) => {
      const was = familyFromWorkspace(prev);
      return applyFamilyToWorkspace(prev, was, update(was), today);
    });
  const tasks: CalendarTask[] = useMemo(
    () => (workspace.tasks || []).filter((t) => !t.archived).map((t) => ({ id: t.id, title: t.title, due: t.dueDate || "", time: t.dueTime || "", assignee: "", done: t.done })),
    [workspace.tasks],
  );
  const common = { family, setFamily, today, makeId, say };
  if (which === "notes") return <Notes {...common} heading={{ title: "My notes", blurb: "Student, class and meeting notes, plus codes, contacts and ideas. Pinned notes stay at the top." }} />;
  if (which === "journal") return <Journal {...common} />;
  return <FamilyCalendar {...common} tasks={tasks} onOpenTasks={openTasks || (() => {})} heading={{ title: "My calendar", blurb: "Your meetings, classes and plans in one place. Switch calendars on or off to see just what you need." }} />;
}
