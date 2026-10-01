type Navigate = (to: string, options?: { replace?: boolean }) => void;

type NavigationUser = {
  isAdmin?: boolean;
  role?: string;
  is_eye_gaze_user?: boolean;
};

const AUTH_STACK_KEY = "arise_authenticated_route_stack";
const AUTH_PENDING_HOME_KEY = "arise_authenticated_route_pending_home";
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
  return user.is_eye_gaze_user ? "/eye-gaze-home" : "/library";
}

/**
 * Start a fresh in-app navigation history at authentication time.
 * The pending-home marker prevents the public login route from being recorded
 * between successful authentication and the role-based redirect.
 */
export function resetAuthenticatedNavigation(user: NavigationUser) {
  const home = authenticatedHome(user);
  writeStack([home]);
  sessionStorage.setItem(AUTH_PENDING_HOME_KEY, home);
}

export function clearAuthenticatedNavigation() {
  sessionStorage.removeItem(AUTH_STACK_KEY);
  sessionStorage.removeItem(AUTH_PENDING_HOME_KEY);
}

/**
 * Track only routes reached during the current authenticated session.
 * This keeps A.R.I.S.E.'s own Back buttons from crossing into pre-login pages.
 */
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

  // A normal Back navigation lands on the previous stack item. Collapse the
  // stack instead of adding that previous route again.
  if (stack.length > 1 && stack[stack.length - 2] === current) {
    stack.pop();
    writeStack(stack);
    return;
  }

  stack.push(current);
  writeStack(stack);
}

/**
 * Go back within the current signed-in A.R.I.S.E. session.
 * If there is no signed-in route to return to, stay inside the role's stable
 * home/dashboard instead of falling through to browser history from pre-login.
 */
export function safeBack(navigate: Navigate, fallback = "/library") {
  const current = normalizePath(window.location.hash || window.location.pathname);
  const stack = readStack();

  if (stack.length > 0) {
    let currentIndex = stack.lastIndexOf(current);

    // If the tracker has not seen this route yet, treat it as the current top.
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
