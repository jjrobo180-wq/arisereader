import { isNativeReader } from "./nativeApp";

// Where adults live: teachers, parents, LifeHub-only accounts and the administrator all sign in
// with the same screen on either site, and their hub always opens on arisetodo.com
// (their own free Work and Life spaces on Arise To Duo).
// Students keep A.R.I.S.E. Reader. Signing out of a hub always goes back to the sign-in screen.

type HubUser = { isAdmin?: boolean; role?: string | null } | null | undefined;

export const TODO_APP = "https://arisetodo.com/app";
export const READER_APP = "https://www.arisereader.com/";

export const isTodoHost = () => typeof window !== "undefined" && /^(www\.)?arisetodo\.com$/i.test(window.location.hostname);
export const isReaderHost = () => typeof window !== "undefined" && (isNativeReader || /^(www\.)?arisereader\.com$/i.test(window.location.hostname));

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

/** A.R.I.S.E. Reader for teachers and parents: its own address, not a hash route inside the app.
 *  That is the point of it — opening the Reader must leave the To-Do app behind, shell and all,
 *  the way /math/ is its own page rather than a screen inside something else. Any unknown path
 *  serves the app's index.html (server/static.ts), so this address works on both sites. */
export const READER_PAGE = "/reader";

/** Is the page being shown right now the Reader's own page? */
export const isReaderPage = (): boolean =>
  typeof window !== "undefined" && (isNativeReader ? window.location.hash.split("?")[0] === "#/reader" : /^\/reader\/?$/.test(window.location.pathname));

/** Opens the Reader's own page. A real navigation, not a hash change: the To-Do app must unload. */
export function goToReader(): void {
  if (isNativeReader) { window.location.hash = "#/reader"; return; }
  try { window.location.assign(READER_PAGE); } catch { window.location.href = READER_PAGE; }
}

/** Where the app itself is served on this site: /app on arisetodo.com, the root elsewhere.
 *  Never the current path — from the Reader's own page (/reader) that would point every hub link
 *  back at /reader, and sending a signed-out visitor there would loop forever. */
export function appBase(): string {
  if (isTodoHost()) return "/app";
  if (typeof window === "undefined" || isReaderPage()) return "/";
  return window.location.pathname || "/";
}

/** A page of the app, as an address that works from anywhere — including the Reader's own page,
 *  which is outside the app's router, so a bare "#/workhub" there would change nothing. */
export const appHref = (hashPath: string): string => `${appBase()}#${hashPath}`;

/** The sign-in screen's address on this site. */
export function signInHref(student = false): string {
  return `${appBase()}#/signin${student ? "?as=student" : ""}`;
}

/** After signing out: back to the sign-in screen, on whichever site this is. */
export function goToSignIn(): void {
  if (isNativeReader) { window.location.hash = "#/signin"; return; }
  try { window.location.replace(signInHref()); } catch { window.location.hash = "/signin"; }
}

/** Which hub tab to open (kept per site in session storage, so it rides along on a handoff). */
export function pendingHubTab(): string {
  try { return sessionStorage.getItem("workhub_tab") || sessionStorage.getItem("lifehub_tab") || ""; } catch { return ""; }
}
