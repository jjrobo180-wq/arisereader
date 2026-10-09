type Navigate = (to: string, options?: { replace?: boolean }) => void;

type NavigationUser = {
  isAdmin?: boolean;
  role?: string;
  is_eye_gaze_user?: boolean;
};

const AUTH_STACK_KEY = "arise_authenticated_route_stack";
const AUTH_PENDING_HOME_KEY = "arise_authenticated_route_pending_home";
const SAMPLE_SESSION_KEY = "arise_sample_session";
const MAX_STACK = 40;

function normalizePath(path: string) {
  const clean = (path || "/").replace(/^#/, "");
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function readStack(): string[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(AUTH_STACK_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeStack(stack: string[]) {
  sessionStorage.setItem(AUTH_STACK_KEY, JSON.stringify(stack.slice(-MAX_STACK)));
}

export function authenticatedHome(user: NavigationUser | null | undefined) {
  if (!user) return "/";
  if (user.isAdmin) return "/admin";
  if (user.role === "teacher") return "/teacher-dashboard";
  if (user.role === "parent") return "/parent-dashboard";
  if (user.role === "todo") return "/to-do";
  return user.is_eye_gaze_user ? "/eye-gaze-home" : "/library";
}

export function resetAuthenticatedNavigation(user: NavigationUser) {
  const home = authenticatedHome(user);
  writeStack([home]);
  sessionStorage.setItem(AUTH_PENDING_HOME_KEY, home);
}

export function clearAuthenticatedNavigation() {
  sessionStorage.removeItem(AUTH_STACK_KEY);
  sessionStorage.removeItem(AUTH_PENDING_HOME_KEY);
}

export function trackAuthenticatedNavigation(path: string, user: NavigationUser) {
  const current = normalizePath(path);
  const home = authenticatedHome(user);
  const pendingHome = sessionStorage.getItem(AUTH_PENDING_HOME_KEY);

  if (pendingHome) {
    if (current !== pendingHome) return;
    sessionStorage.removeItem(AUTH_PENDING_HOME_KEY);
    writeStack([current]);
    return;
  }

  const stack = readStack();
  if (stack.length === 0) {
    writeStack([current === "/" ? home : current]);
    return;
  }

  const last = stack[stack.length - 1];
  if (last === current) return;

  if (stack.length > 1 && stack[stack.length - 2] === current) {
    stack.pop();
    writeStack(stack);
    return;
  }

  stack.push(current);
  writeStack(stack);
}

export function safeBack(navigate: Navigate, fallback = "/library") {
  // Sample accounts are temporary tours. Back should always leave the tour and
  // return to the public login page instead of wandering through demo history.
  if (sessionStorage.getItem(SAMPLE_SESSION_KEY) === "true") {
    window.dispatchEvent(new Event("arise-exit-sample"));
    return;
  }

  const current = normalizePath(window.location.hash || window.location.pathname);
  const stack = readStack();

  if (stack.length > 0) {
    let currentIndex = stack.lastIndexOf(current);
    if (currentIndex === -1) {
      stack.push(current);
      currentIndex = stack.length - 1;
    }

    if (currentIndex > 0) {
      const previous = stack[currentIndex - 1];
      writeStack(stack.slice(0, currentIndex));
      navigate(previous, { replace: true });
      return;
    }
  }

  const destination = normalizePath(fallback);
  writeStack([destination]);
  navigate(destination, { replace: true });
}