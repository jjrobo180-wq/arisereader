// The A.R.I.S.E. learning programs (Arise Math, Arise History and A.R.I.S.E. Connect) as their own
// "Arise Learning" section in WorkHub's and LifeHub's menus, right under A.R.I.S.E. Reader, so
// teachers and parents always see them. Each has its own color. Someone who doesn't have a program
// yet sees an "Add-on" tag on it, and tapping it takes them to their plan page to get it.
import { useEffect, useState } from "react";
import { Calculator, Landmark, Users, type LucideIcon } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";

export type LearningId = "math" | "history" | "social";

export const LEARNING_APPS: { id: LearningId; label: string; short: string; href: string; icon: LucideIcon; color: string; soft: string; /** The icon in the program's color, for menus that draw plain icons. */ text: string }[] = [
  { id: "math", label: "Arise Math", short: "Math", href: "/math/", icon: Calculator, color: "#0284c7", soft: "#e0f2fe", text: "text-sky-600" },
  { id: "history", label: "Arise History", short: "History", href: "/history/", icon: Landmark, color: "#d97706", soft: "#fef3c7", text: "text-amber-600" },
  { id: "social", label: "A.R.I.S.E. Connect", short: "Connect", href: "/social/", icon: Users, color: "#db2777", soft: "#fce7f3", text: "text-pink-600" },
];

/** Where a teacher goes to add a program they don't have yet. (Parents get theirs on LifeHub's Reader page.) */
export const LEARNING_PLAN_PAGE = "/#/billing";

/** Which programs this person can open. Unknown (still loading, or offline) counts as open, so nothing is wrongly tagged. */
export function useLearningAccess(token: string | null | undefined): Record<LearningId, boolean> {
  const [access, setAccess] = useState<Record<LearningId, boolean>>({ math: true, history: true, social: true });
  useEffect(() => {
    if (!token) return;
    let gone = false;
    fetch(`${API_BASE}/api/addons`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (gone || !d?.apps) return;
        setAccess({ math: d.apps.math?.access !== false, history: d.apps.history?.access !== false, social: d.apps.social?.access !== false });
      })
      .catch(() => { /* leave them open */ });
    return () => { gone = true; };
  }, [token]);
  return access;
}

/** Opens a program, or where to get it when they don't have it yet (`onLocked`, or the teacher plan page). */
export function openLearning(id: LearningId, has: boolean, onLocked?: () => void) {
  const app = LEARNING_APPS.find((a) => a.id === id);
  if (!app) return;
  if (has) { window.location.href = app.href; return; }
  if (onLocked) onLocked(); else window.location.href = LEARNING_PLAN_PAGE;
}

/** The program's colored icon tile. */
export function LearningIcon({ id, size = "md" }: { id: LearningId; size?: "sm" | "md" }) {
  const app = LEARNING_APPS.find((a) => a.id === id)!;
  const Icon = app.icon;
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-lg text-white shadow-sm ${size === "sm" ? "h-6 w-6" : "h-7 w-7"}`} style={{ background: `linear-gradient(135deg, ${app.color}, ${app.color}cc)` }}>
    <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
  </span>;
}
