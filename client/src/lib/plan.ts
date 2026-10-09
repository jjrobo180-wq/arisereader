// The signed-in person's plan, from GET /api/plan.
// If the plan can't be loaded the hook returns null and nothing is locked on
// the screen: the server makes the real decision on every request.
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/lib/queryClient";

export type PlanView = { kind: import("@shared/plans").PlanKind; source: "stripe" | "admin"; status: string; seats: number; endsAt: string | null; live: boolean; paidOnline: boolean; canManage: boolean; /** A school that is always Premium at no charge. */ free?: boolean };
export type PlanInfo = {
  /** Has the site admin turned plan rules on? */
  enforced: boolean;
  premium: boolean;
  via: "rules-off" | "admin" | "demo" | "teacher-plan" | "school-plan" | "class" | "grandfathered" | "free-month" | null;
  seats: number | null;
  endsAt: string | null;
  /** Can Premium be bought online right now? */
  payment: boolean;
  prices: { teacherMonthlyCents: number; studentsPerBlock: number; maxBlocks: number; schoolYearlyCents: number; schoolStudentCap: number };
  /** Teachers only: when their 30-day free trial ends, or ended. */
  freeMonthEndsAt?: string;
  /** Teachers only. */
  students?: number;
  teacherPlan?: PlanView | null;
  school?: { id: number; name: string; students: number; plan: PlanView | null } | null;
  /** Arise WorkHub, the add-on. Teachers and the admin only. */
  hub?: HubInfo;
};
export type HubInfo = {
  access: boolean;
  via: "admin" | "hub-teacher-plan" | "hub-school-plan" | "free-month" | null;
  seats: number | null;
  endsAt: string | null;
  /** Students in the teacher's Hub caseload. */
  students: number;
  teacherPlan: PlanView | null;
  schoolPlan: PlanView | null;
  prices: { monthlyCents: number; studentsPerBlock: number; maxBlocks: number; schoolYearlyCents: number; schoolStudentCap: number };
};

// A failed load is remembered too (as null), so a page doesn't wait on it again and again.
const cache = new Map<string, { at: number; plan: PlanInfo | null }>();
const FRESH_MS = 60_000, RETRY_MS = 30_000;

const LOCKED_KEY = "arise_plan_locked";
/** Was this browser's teacher locked the last time we looked? Decides whether a page waits for the plan before showing. */
export function lastKnownLocked(): boolean {
  try { return localStorage.getItem(LOCKED_KEY) === "1"; } catch { return false; }
}
function rememberLocked(plan: PlanInfo) {
  try { localStorage.setItem(LOCKED_KEY, teacherLocked(plan) ? "1" : "0"); } catch { /* private mode */ }
}

export async function loadPlan(token: string, force = false): Promise<PlanInfo | null> {
  const hit = cache.get(token);
  if (!force && hit && Date.now() - hit.at < (hit.plan ? FRESH_MS : RETRY_MS)) return hit.plan;
  let plan: PlanInfo | null = null;
  try {
    const res = await fetch(`${API_BASE}/api/plan`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (res.ok) plan = (await res.json()) as PlanInfo;
  } catch { /* offline: nothing is locked on the screen */ }
  // keep the last good answer if this try failed
  cache.set(token, { at: Date.now(), plan: plan ?? hit?.plan ?? null });
  if (plan) rememberLocked(plan);
  return plan ?? hit?.plan ?? null;
}

/** Pass a null token to skip loading (for people the plan doesn't change anything for). */
export function usePlan(token: string | null | undefined) {
  const [plan, setPlan] = useState<PlanInfo | null>(() => (token ? cache.get(token)?.plan ?? null : null));
  const [loading, setLoading] = useState<boolean>(!!token && !cache.has(token));
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
