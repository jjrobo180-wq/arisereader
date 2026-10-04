// The signed-in person's plan, from GET /api/plan.
// If the plan can't be loaded the hook returns null and nothing is locked on
// the screen: the server makes the real decision on every request.
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/lib/queryClient";

export type PlanView = { kind: "teacher" | "school"; source: "stripe" | "admin"; status: string; seats: number; endsAt: string | null; live: boolean; paidOnline: boolean; canManage: boolean };
export type PlanInfo = {
  /** Has the site admin turned plan rules on? */
  enforced: boolean;
  premium: boolean;
  via: "rules-off" | "admin" | "demo" | "teacher-plan" | "school-plan" | "class" | "grandfathered" | null;
  seats: number | null;
  endsAt: string | null;
  /** Can Premium be bought online right now? */
  payment: boolean;
  prices: { teacherMonthlyCents: number; studentsPerBlock: number; maxBlocks: number; schoolYearlyCents: number; schoolStudentCap: number };
  /** Teachers only. */
  students?: number;
  teacherPlan?: PlanView | null;
  school?: { id: number; name: string; students: number; plan: PlanView | null } | null;
};

const cache = new Map<string, { at: number; plan: PlanInfo }>();
const FRESH_MS = 60_000;

export async function loadPlan(token: string, force = false): Promise<PlanInfo | null> {
  const hit = cache.get(token);
  if (!force && hit && Date.now() - hit.at < FRESH_MS) return hit.plan;
  try {
    const res = await fetch(`${API_BASE}/api/plan`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) return null;
    const plan = (await res.json()) as PlanInfo;
    cache.set(token, { at: Date.now(), plan });
    return plan;
  } catch {
    return null;
  }
}

/** Pass a null token to skip loading (for people the plan doesn't change anything for). */
export function usePlan(token: string | null | undefined) {
  const [plan, setPlan] = useState<PlanInfo | null>(() => (token ? cache.get(token)?.plan ?? null : null));
  const [loading, setLoading] = useState<boolean>(!!token && !cache.get(token));
  useEffect(() => {
    if (!token) { setPlan(null); setLoading(false); return; }
    let alive = true;
    const hit = cache.get(token);
    setPlan(hit?.plan ?? null);
    setLoading(!hit);
    loadPlan(token).then((p) => { if (alive) { setPlan(p); setLoading(false); } });
    return () => { alive = false; };
  }, [token]);
  const refresh = useCallback(async () => {
    if (!token) return null;
    const p = await loadPlan(token, true);
    setPlan(p);
    return p;
  }, [token]);
  return { plan, loading, refresh };
}

/** A teacher who must get Premium before using their account. */
export const teacherLocked = (plan: PlanInfo | null) => !!plan && plan.enforced && !plan.premium;
