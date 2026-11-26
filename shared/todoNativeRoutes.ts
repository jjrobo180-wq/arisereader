// The Arise To Do iPhone app is To Do: LifeHub, FamilyHub, WorkHub and the apps inside them (Notes,
// Office, Cooked, Cooked PT, the Plugin Gallery's apps), plus sign-in, account and plan pages. The same
// web code also runs Arise Reader's student side (quizzes, games, the FYP feed, rewards), the eye-gaze
// apps and the admin pages; none of those are part of To Do, so inside the To Do app their addresses go
// to the hub instead (App Review 5.6: nothing in the app that review doesn't see).
const ALLOWED = [
  "/", "/lifehub", "/familyhub", "/workhub", "/teacher-hub", "/hub", "/to-do", "/duo",
  "/arise-notes", "/office", "/pro", "/ai-apps", "/para-team", "/class-goal", "/math-lessons", "/buddy",
  "/fit", "/trainer", "/trainers", "/t", "/c", "/goal-quiz", "/all-access", "/try",
  "/signin", "/register", "/register-independent", "/reset-password", "/teacher-signup", "/parent-signup",
  "/updates", "/plans", "/join", "/share", "/meet", "/drop", "/billing", "/pricing", "/subscribe", "/profile",
] as const;

/** Can this address open inside the To Do iPhone app? (Path only: "#/lifehub?go=x" → "/lifehub".) */
export function todoNativeAllows(path: string): boolean {
  const p = (path.split(/[?#]/)[0] || "/").replace(/\/+$/, "") || "/";
  if (p === "/") return true;
  const first = `/${p.split("/")[1]}`;
  return (ALLOWED as readonly string[]).includes(first);
}
