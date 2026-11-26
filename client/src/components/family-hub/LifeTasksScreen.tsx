// LifeHub's Tasks screen is WorkHub's, running on LifeHub's own to-dos and lists (shared/hubSwap.ts translates
// each way, keeping what WorkHub's screen has no place for: a family member, low priority, when it was made).
import { useMemo } from "react";
import { Tasks } from "@/components/teacher-hub/HubTasks";
import { applyWorkTasksToLife, workspaceFromLifeTasks, type LifeListShape, type LifeTaskShape } from "@shared/hubSwap";
import type { Workspace } from "@shared/teacherHub";
import type { TaskView } from "@shared/hubTasks";
import type { AriseAsk } from "@shared/ariseAsks";
import type { DailyInput } from "@/components/daily/useDailyCheckins";
import { WithDaily } from "@/components/daily/WithDaily";

type Life = { tasks: LifeTaskShape[]; lists: LifeListShape[] };

export default function LifeTasksScreen<T extends Life>({ data, setData, makeId, say, view, setView, list, setList, arise, extra, daily }: {
  /** The hub's daily check-ins as rows of the list (components/daily/): LifeHub's are yours, FamilyHub's the family's. */
  daily?: DailyInput;
  extra?: import("react").ReactNode;
  data: T;
  setData: (update: (previous: T) => T) => void;
  makeId: () => string;
  say: (message: string) => void;
  view: TaskView; setView: (v: TaskView) => void;
  list: string; setList: (id: string) => void;
  /** Arise To Do's "@arise" asks (lib/ariseAsks.ts), passed on to the Tasks screen. */
  arise?: { asks: AriseAsk[]; loaded: boolean; open: string | null; people: string[] };
}) {
  const workspace = useMemo(() => workspaceFromLifeTasks(data), [data.tasks, data.lists]); // eslint-disable-line react-hooks/exhaustive-deps
  const setWorkspace = (update: Workspace | ((p: Workspace) => Workspace)) =>
    setData((previous) => {
      const was = workspaceFromLifeTasks(previous);
      const next = typeof update === "function" ? update(was) : update;
      return applyWorkTasksToLife(previous, was, next, new Date().toISOString());
    });
  const remove = (key: keyof Workspace, rowId: string) => {
    if (key === "tasks") setData((previous) => ({ ...previous, tasks: previous.tasks.filter((t) => t.id !== rowId) }));
  };
  const props = { workspace, setWorkspace, remove, makeId, toast: (text: string) => say(text), plain: true, controls: { view, setView, list, setList }, arise, extra };
  // The check-ins read Cooked, Accountability and the rest, so they're only set up where they're shown.
  return daily ? <WithDaily input={daily}>{(d) => <Tasks {...props} daily={d} />}</WithDaily> : <Tasks {...props} />;
}
