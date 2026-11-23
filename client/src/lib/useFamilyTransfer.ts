// LifeHub: moves what you share with your family over to FamilyHub (shared/familyTransfer.ts), quietly, once
// per thing. Runs a moment after LifeHub opens; anything that can't move now (offline, someone saving
// FamilyHub at the same moment) is tried again the next time.
import { useEffect, useRef } from "react";
import { API_BASE } from "@/lib/queryClient";
import { linksApi } from "@/lib/profileLinks";
import { cleanFamily, emptyFamily, type Family } from "@shared/familyHub";
import { hideFromLife, moveIntoFamily, pendingMoves } from "@shared/familyTransfer";

export function useFamilyTransfer({ on, token, me, family, setFamily }: { on: boolean; token: string | null; me: number; family: Family; setFamily: (fn: (f: Family) => Family) => void }) {
  const ran = useRef(false);
  const lifeRef = useRef(family); lifeRef.current = family;
  useEffect(() => {
    if (!on || !token || !me || ran.current) return;
    ran.current = true;
    const t = window.setTimeout(async () => {
      try {
        const auth = { Authorization: `Bearer ${token}` };
        const info = await fetch(`${API_BASE}/api/family-space`, { headers: auth, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        const ids: number[] = (info?.family?.members || []).map((m: any) => Number(m.id));
        if (ids.length < 2) return;
        const links = await linksApi(token).list().catch(() => null);
        if (!links) return;
        const m = pendingMoves(links.mine, ids, me, lifeRef.current.movedToFamily);
        if (!m.ids.length) return;
        const got = await fetch(`${API_BASE}/api/family-space/workspace`, { headers: auth, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        const ws = got?.workspace;
        if (!ws || typeof ws !== "object" || !ws.family) return;
        const next = { ...ws, family: moveIntoFamily(cleanFamily({ ...emptyFamily(), ...ws.family }), lifeRef.current, m) };
        const put = await fetch(`${API_BASE}/api/family-space/workspace`, { method: "PUT", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ workspace: next, baseUpdatedAt: got.updatedAt ?? null }) }).catch(() => null);
        if (!put?.ok) return;
        setFamily((f) => hideFromLife(f, m));
      } catch { /* tried again next time LifeHub opens */ }
    }, 2500);
    return () => window.clearTimeout(t);
  }, [on, token, me]); // eslint-disable-line react-hooks/exhaustive-deps
}
