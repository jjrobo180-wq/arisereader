// Who can win Arise Reader's prizes, and how other students' names show on leaderboards (Nov 25, 2026).
// Prizes (the pizza party, DoorDash food, AirPods) are only for Conservatory Green Middle School's students, so
// independent readers and other schools never see them. On a leaderboard, students and parents see only their own
// school's readers, and everyone but themselves (or their own children) by initials, for safety.

/** Conservatory Green Middle School ("Conservatory Green Middle School (Denver, CO)"), not the high school. */
export function isPrizeSchool(name: string | null | undefined): boolean {
  const n = String(name || "").toLowerCase();
  return n.includes("conservatory green") && n.includes("middle") && !n.includes("high");
}

/** "Kimberly Montoya-Mejia" → "K. M."; "josue quiroga" → "J. Q."; one word → "A."; nothing → "Reader". */
export function initials(name: string | null | undefined): string {
  const words = String(name || "").trim().split(/[\s]+/).filter(Boolean);
  if (!words.length) return "Reader";
  const first = words[0], last = words.length > 1 ? words[words.length - 1] : "";
  const letter = (w: string) => (Array.from(w.replace(/^[^\p{L}\p{N}]+/u, ""))[0] || "").toUpperCase();
  return [letter(first), letter(last)].filter(Boolean).map((l) => `${l}.`).join(" ") || "Reader";
}

/** Whether a viewer sees full names on boards: staff do; students and parents see initials for everyone else. */
export function seesFullNames(user: { isAdmin?: boolean; role?: string | null } | null | undefined): boolean {
  return !!user && (!!user.isAdmin || user.role === "teacher");
}
