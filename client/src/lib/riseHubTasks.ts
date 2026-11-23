// The Rise Score plugin's "Hubs that count": the to-dos from FamilyHub and WorkHub (when switched on) that
// count toward the checklist score alongside the hub it's opened in.
import { API_BASE } from "@/lib/queryClient";
import type { RiseHubs } from "@/components/RiseScoreCard";

type T = { title: string; due: string; time: string; done: boolean };
const get = async (path: string, token: string): Promise<any> => {
  const r = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null);
  return r?.ok ? r.json().catch(() => null) : null;
};

export async function riseHubTasks(h: RiseHubs, token: string | null, inFamily: boolean): Promise<T[]> {
  if (!token) return [];
  const out: T[] = [];
  // Opened in FamilyHub: LifeHub's own to-dos are the "extra" hub; opened in LifeHub: FamilyHub's are.
  if (h.family) {
    const ws = (await get(inFamily ? "/api/arise-todo/workspace" : "/api/family-space/workspace", token))?.workspace;
    for (const t of Array.isArray(ws?.tasks) ? ws.tasks : []) if (t && !t.archived && t.title) out.push({ title: String(t.title), due: String(t.due || ""), time: String(t.time || ""), done: !!t.done });
  }
  if (h.work) {
    const ws = (await get("/api/teacher-hub/workspace", token))?.workspace;
    for (const t of Array.isArray(ws?.tasks) ? ws.tasks : []) if (t && !t.archived && t.title) out.push({ title: String(t.title), due: String(t.dueDate || ""), time: String(t.dueTime || ""), done: !!t.done });
  }
  return out;
}
