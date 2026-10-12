// Where adults live: teachers, parents, LifeHub-only accounts and the administrator all sign in
// with the same screen on either site, and their hub always opens on arisetodo.com
// (their own free Work and Life spaces on A.R.I.S.E. To-Do).
// Students keep A.R.I.S.E. Reader. Signing out of a hub always goes back to the sign-in screen.

type HubUser = { isAdmin?: boolean; role?: string | null } | null | undefined;

export const TODO_APP = "https://arisetodo.com/app";
export const READER_APP = "https://www.arisereader.com/";

export const isTodoHost = () => typeof window !== "undefined" && /^(www\.)?arisetodo\.com$/i.test(window.location.hostname);
export const isReaderHost = () => typeof window !== "undefined" && /^(www\.)?arisereader\.com$/i.test(window.location.hostname);

/** Teachers, parents, LifeHub-only accounts and the administrator. */
export function isHubAccount(user: HubUser): boolean {
  return !!user && (user.isAdmin === true || user.role === "teacher" || user.role === "parent" || user.role === "todo");
}

/** The hub an adult opens after signing in. A teacher lands straight in WorkHub, where their
 *  class and all of A.R.I.S.E. Reader's teacher tools (overview, live quiz, scenes, students,
 *  approvals, parents, quizzes & grading, game time, prizes) actually live — that's what a
 *  teacher signed up for, not the family to-do list. Every other adult (parent, LifeHub-only,
 *  the administrator) still lands on the to-do list (LifeHub) first; WorkHub is one click away
 *  for anyone who needs it. */
export function hubPathFor(user: HubUser): "/workhub" | "/lifehub" {
  return user?.role === "teacher" ? "/workhub" : "/lifehub";
}

/** The sign-in screen's address on this site (the app lives at /app on arisetodo.com). */
export function signInHref(student = false): string {
  const base = isTodoHost() ? "/app" : (typeof window !== "undefined" ? window.location.pathname : "/") || "/";
  return `${base}#/signin${student ? "?as=student" : ""}`;
}

/** After signing out: back to the sign-in screen, on whichever site this is. */
export function goToSignIn(): void {
  try { window.location.replace(signInHref()); } catch { window.location.hash = "/signin"; }
}

/** Which hub tab to open (kept per site in session storage, so it rides along on a handoff). */
export function pendingHubTab(): string {
  try { return sessionStorage.getItem("workhub_tab") || sessionStorage.getItem("lifehub_tab") || ""; } catch { return ""; }
}
