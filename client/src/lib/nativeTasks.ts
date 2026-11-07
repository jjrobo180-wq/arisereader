// The native Tasks screen (native/arise-native): the iPhone app shows a SwiftUI screen over the web app. The web
// app stays the source of truth: it sends a snapshot of the to-dos, and what the person does there (tick, add,
// delete) comes back as actions the web app applies. Without the plugin (the website, or an older app), nothing
// here runs and the web Tasks screen is used.
import { hasNativePlugin, nativeCall, nativeFlavor } from "@/lib/nativeApp";

const PLUGIN = /AriseNative/;
type TaskIn = { id: string; title: string; due: string; time: string; done: boolean; priority: string; listId: string; repeat: string; archived?: boolean };
type ListIn = { id: string; name: string };
export type NativeTaskAction = { type: "toggle"; id: string } | { type: "delete"; id: string } | { type: "add"; title: string; due: string; listId: string } | { type: "closed" };

export const nativeTasksAvailable = (): boolean => nativeFlavor() === "todo" && hasNativePlugin(PLUGIN);

/** What the native screen needs, and nothing more. */
export function tasksPayload(data: { tasks: TaskIn[]; lists: ListIn[] }) {
  return {
    tasks: data.tasks.filter((t) => !t.archived && !t.id.startsWith("apple-")).slice(0, 1000).map((t) => ({ id: t.id, title: String(t.title || "").slice(0, 200), due: t.due || "", time: t.time || "", done: !!t.done, high: t.priority === "high", listId: t.listId || "", repeats: !!t.repeat && t.repeat !== "none" })),
    lists: data.lists.slice(0, 50).map((l) => ({ id: l.id, name: String(l.name || "").slice(0, 60) })),
  };
}

export async function openNativeTasks(payload: ReturnType<typeof tasksPayload>): Promise<boolean> {
  try { await nativeCall(PLUGIN, "AriseNative", "openTasks", payload); return true; } catch { return false; }
}
export function updateNativeTasks(payload: ReturnType<typeof tasksPayload>): void { void nativeCall(PLUGIN, "AriseNative", "updateTasks", payload).catch(() => {}); }

export async function takeNativeTaskActions(): Promise<NativeTaskAction[]> {
  try {
    const r = await nativeCall(PLUGIN, "AriseNative", "takeActions");
    const list: any[] = Array.isArray(r?.actions) ? r.actions : [];
    return list.flatMap((a): NativeTaskAction[] => {
      if (a?.type === "toggle" && typeof a.id === "string") return [{ type: "toggle", id: a.id }];
      if (a?.type === "delete" && typeof a.id === "string") return [{ type: "delete", id: a.id }];
      if (a?.type === "add" && typeof a.title === "string" && a.title.trim()) return [{ type: "add", title: a.title.trim().slice(0, 200), due: /^\d{4}-\d{2}-\d{2}$/.test(a.due) ? a.due : "", listId: typeof a.listId === "string" ? a.listId : "" }];
      if (a?.type === "closed") return [{ type: "closed" }];
      return [];
    });
  } catch { return []; }
}
