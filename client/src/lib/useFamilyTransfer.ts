// Moving things between LifeHub and FamilyHub from either one (shared/hubMove.ts, shared/familyTransfer.ts).
// The hub that's open changes its own copy as usual; the other hub's saved copy is read, changed and saved
// here, checked against the version it was read at (and tried once more if someone saved it in between).
import { useEffect, useRef } from "react";
import { API_BASE } from "@/lib/queryClient";
import { linksApi } from "@/lib/profileLinks";
import { cleanFamily, emptyFamily } from "@shared/familyHub";
import { moveItem, type HubItem, type HubWorkspace } from "@shared/hubMove";
import { intoFamily, outOfLife, pendingMoves } from "@shared/familyTransfer";

type Space = "life" | "family";
const LIFE_API = `${API_BASE}/api/arise-todo/workspace`;
const FAMILY_API = `${API_BASE}/api/family-space/workspace`;
const apiOf = (space: Space) => (space === "family" ? FAMILY_API : LIFE_API);
export const otherHub = (space: Space): Space => (space === "family" ? "life" : "family");

/** A hub's saved copy, with its Family made safe, and when it was saved. Null when it can't be read
 *  (offline, no family) or was never saved. */
async function readHub(space: Space, token: string): Promise<{ ws: HubWorkspace; at: string | null } | null> {
  const got = await fetch(apiOf(space), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const ws = got?.workspace;
  if (!ws || typeof ws !== "object" || !Array.isArray(ws.lists) || !Array.isArray(ws.tasks)) return null;
  return { ws: { ...ws, version: 2, family: cleanFamily({ ...emptyFamily(), ...(ws.family || {}) }) }, at: typeof got.updatedAt === "string" ? got.updatedAt : null };
}

/** Reads a hub's saved copy, changes it and saves it. "ok", "none" (nothing to change or no copy) or "failed". */
export async function changeHub(space: Space, token: string, change: (ws: HubWorkspace) => HubWorkspace | null): Promise<"ok" | "none" | "failed"> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const got = await readHub(space, token);
    if (!got) return "failed";
    const next = change(got.ws);
    if (!next) return "none";
    const put = await fetch(apiOf(space), {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: next, baseUpdatedAt: got.at }),
    }).catch(() => null);
    if (put?.ok) return "ok";
    if (put?.status !== 409) return "failed";
  }
  return "failed";
}

/** Moves one app out of the open hub into the other one. The other hub is saved first; only then is the app
 *  turned off here, so nothing is ever only half moved. */
export async function moveToOtherHub(space: Space, token: string, item: HubItem, setData: (fn: (d: HubWorkspace) => HubWorkspace) => void, current: HubWorkspace): Promise<boolean> {
  const done = await changeHub(otherHub(space), token, (other) => moveItem(current, other, item).to);
  if (done !== "ok") return false;
  setData((d) => moveItem(d, d, item).from);
  return true;
}

/** Who is in my family (ids), or null when I'm not in one with anyone else. */
async function familyIds(token: string): Promise<number[] | null> {
  const info = await fetch(`${API_BASE}/api/family-space`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const ids: number[] = (info?.family?.members || []).map((m: any) => Number(m.id));
  return ids.length >= 2 ? ids : null;
}

/** Moves what I share with my family into FamilyHub, quietly, a moment after LifeHub or FamilyHub opens.
 *  Anything that can't move now (offline, someone saving at the same moment) is tried again next time. */
export function useFamilyTransfer({ space, on, token, me, data, setData }: { space: Space; on: boolean; token: string | null; me: number; data: HubWorkspace; setData: (fn: (d: HubWorkspace) => HubWorkspace) => void }) {
  const ran = useRef(false);
  const dataRef = useRef(data); dataRef.current = data;
  useEffect(() => {
    if (!on || !token || !me || ran.current) return;
    ran.current = true;
    const t = window.setTimeout(async () => {
      try {
        const ids = await familyIds(token);
        if (!ids) return;
        const links = await linksApi(token).list().catch(() => null);
        if (!links) return;
        if (space === "life") {
          // In LifeHub: FamilyHub's saved copy gets everything, then it's turned off here.
          const m = pendingMoves(links.mine, ids, me, dataRef.current.family);
          if (!m.ids.length) return;
          const life = dataRef.current;
          if (await changeHub("family", token, (fam) => intoFamily(life, fam, m)) !== "ok") return;
          setData((d) => outOfLife(d, m));
        } else {
          // In FamilyHub: everything comes in here first, then my LifeHub's saved copy turns it off.
          const got = await readHub("life", token);
          if (!got) return;
          const m = pendingMoves(links.mine, ids, me, got.ws.family);
          if (!m.ids.length) return;
          setData((d) => intoFamily(got.ws, d, m));
          await changeHub("life", token, (life) => outOfLife(life, m));
        }
      } catch { /* tried again next time a hub opens */ }
    }, 2500);
    return () => window.clearTimeout(t);
  }, [space, on, token, me]); // eslint-disable-line react-hooks/exhaustive-deps
}
