// The open hub's to-do list, for plugins that add to it or attach to it from outside the hub's own code
// (the Google plugin: a Doc on a to-do, an email made into a to-do). WorkHub, LifeHub and FamilyHub each
// provide it (Nov 25, 2026).
import { createContext, useContext } from "react";
import type { GoogleFile } from "@shared/googleConnect";

export type HubTasksBridge = {
  hub: "work" | "life" | "family";
  tasks: { id: string; title: string; done: boolean; dueDate: string; dueTime?: string; notes?: string }[];
  /** Adds a to-do; returns its id. */
  add: (title: string, notes: string) => string;
  /** Puts a Google file's link on a to-do. */
  attach: (taskId: string, file: GoogleFile) => void;
  /** Brings Classroom assignments in (WorkHub only); says what happened. */
  syncClassroom?: () => Promise<string>;
};
export const HubTasksContext = createContext<HubTasksBridge | null>(null);
export const useHubTasks = () => useContext(HubTasksContext);
