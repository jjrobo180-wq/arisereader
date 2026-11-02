import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { forgetStay } from "@/lib/useStayOnRefresh";
import { API_BASE } from "@/lib/queryClient";
import { setSchoolTheme, setTeacherBand } from "@/lib/schoolTheme";
import { clearAuthenticatedNavigation, resetAuthenticatedNavigation } from "@/lib/navigation";
import { forgetThisDevice } from "@/lib/pushDevice";
import { setAccount } from "@/lib/accountStorage";
import { isHubAccount } from "@/lib/hubs";
import { clearSessionBackup, keepStorage, readSessionBackup, saveSessionBackup } from "@/lib/sessionBackup";
import { SAMPLE_TOKEN, SAMPLE_USER, isSampleMode, resetSample } from "@/lib/sampleMode";
import { setEyeGazeUser } from "@/lib/gazeDefaults";

interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  isAdmin: boolean;
  role?: string;
  teacherId?: number | null;
  approvedByTeacher?: boolean;
  accountApproved?: boolean;
  assessmentPromptShown?: boolean;
  is_eye_gaze_user?: boolean;
  email?: string | null;
  schoolId?: number | null;
  totalPoints?: number;
  loginCount?: number;
  mustChangePassword?: boolean;
}

type AdminPreviewMode = "regular" | "eye-gaze" | null;

interface AuthContextType {
  user: AuthUser | null;
  realUser: AuthUser | null;
  adminPreviewMode: AdminPreviewMode;
  startAdminPreview: (mode?: Exclude<AdminPreviewMode, null>) => void;
  exitAdminPreview: () => void;
  /** The real teacher account the administrator is viewing the app as (view only), if any. */
  viewAsTeacher: (AuthUser & { schoolName?: string | null }) | null;
  startViewAsTeacher: (teacher: AuthUser & { schoolName?: string | null }) => void;
  exitViewAsTeacher: () => void;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  /** Sign in with Apple in the iPhone app (lib/appleSignIn.ts gets the token from iOS). True when a new account was made. */
  signInWithApple: (apple: { identityToken: string; authorizationCode?: string; givenName?: string; familyName?: string }) => Promise<boolean>;
  /** Redeems a one-use code from arisereader.com (teachers, parents, LifeHub accounts, the administrator). */
  completeAdminHandoff: (code: string) => Promise<AuthUser>;
  register: (username: string, password: string, displayName: string, isEyeGazeUser?: boolean, teacherId?: number | null, schoolId?: number | null, gradeLevel?: string, unlisted?: { schoolName?: string; teacherName?: string; directoryTeacherId?: string; independent?: boolean; directorySchool?: string; advisoryId?: string }) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const COOKIE_NAME = "arise_session";
const VIEW_AS_KEY = "arise_admin_view_teacher";
const SAMPLE_SESSION_KEY = "arise_sample_session";
const SAMPLE_USERNAMES = new Set(["sample", "tutorial-eye", "sample-parent"]);

// Stays signed in until they sign out. (Safari trims cookies written by a page to a week; the copy in
// storage, see lib/sessionBackup.ts, brings the sign-in back when that happens.)
const SESSION_DAYS = 180;

function setCookie(name: string, value: string, days: number) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = name + "=" + value + ";expires=" + d.toUTCString() + ";max-age=" + days * 24 * 60 * 60 + ";path=/;SameSite=Lax";
}
function getCookie(name: string): string | null {
  const cookies = document.cookie.split(";");
  for (let i = 0; i < cookies.length; i++) {
    const c = cookies[i].trim();
    if (c.startsWith(name + "=")) return c.substring(name.length + 1);
  }
  return null;
}
function deleteCookie(name: string) {
  document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax";
}
// btoa only takes Latin-1 text, so a name like "Nguyễn" or an emoji would stop the sign-in from
// being saved. The JSON is turned into UTF-8 bytes first (plain ASCII comes out exactly as before).
function encodeSession(value: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value))));
}
function decodeSession(raw: string): any {
  const binary = atob(raw);
  try { return JSON.parse(decodeURIComponent(escape(binary))); } catch { return JSON.parse(binary); }
}
function saveSessionCookie(user: AuthUser | null, token: string | null) {
  if (isSampleMode()) return; // the sample never touches the visitor's sign-in
  if (user && token) {
    const data = encodeSession({ user, token });
    setCookie(COOKIE_NAME, data, SESSION_DAYS);
    if (SAMPLE_USERNAMES.has(user.username)) clearSessionBackup(); else saveSessionBackup(data);
  } else {
    deleteCookie(COOKIE_NAME);
    clearSessionBackup();
  }
}
function loadSessionCookie(): { user: AuthUser | null; token: string | null } {
  // Inside the sample Duo viewer: the made-up sample profile, never the visitor's own sign-in.
  if (isSampleMode()) return { user: SAMPLE_USER as AuthUser, token: SAMPLE_TOKEN };
  try {
    // The cookie first; if the phone dropped it, the copy kept in storage (and the cookie is put back).
    let raw = getCookie(COOKIE_NAME);
    let fromBackup = false;
    if (!raw) { raw = readSessionBackup(); fromBackup = !!raw; }
    if (!raw) return { user: null, token: null };
    let data: any;
    try { data = decodeSession(raw); } catch { clearSessionBackup(); throw new Error("unreadable sign-in"); }
    if (typeof data.user?.username === "string" && SAMPLE_USERNAMES.has(data.user.username)) {
      deleteCookie(COOKIE_NAME);
      clearSessionBackup();
      sessionStorage.removeItem(SAMPLE_SESSION_KEY);
      return { user: null, token: null };
    }
    if (!data.token || !data.user) { if (fromBackup) clearSessionBackup(); return { user: null, token: null }; }
    if (fromBackup) setCookie(COOKIE_NAME, raw, SESSION_DAYS);
    // Signed in before the storage copy existed (or opened offline, before the server check below
    // could write it): keep the copy now, so a Home Screen app that loses its cookie stays signed in.
    else if (!readSessionBackup()) saveSessionBackup(raw);
    return { user: data.user || null, token: data.token || null };
  } catch {
    return { user: null, token: null };
  }
}

// Pages outside the app (A.R.I.S.E. Connect at /social/, Arise Math at /math/, Arise History at /history/) send people here to sign in or sign up,
// and ask to be taken back afterwards. Only known pages are allowed, so this can't be used to send someone elsewhere.
const RETURN_KEY = "arise_return_to";
const RETURN_PAGES = new Set(["/social/", "/math/", "/history/", "/notes/"]);
function returnIfAsked() {
  try {
    const to = sessionStorage.getItem(RETURN_KEY);
    if (!to) return;
    sessionStorage.removeItem(RETURN_KEY);
    if (RETURN_PAGES.has(to)) window.location.assign(to);
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const sessionRef = useRef<{ user: AuthUser | null; token: string | null }>(loadSessionCookie());
  const [user, setUser] = useState<AuthUser | null>(sessionRef.current.user);
  const [token, setToken] = useState<string | null>(sessionRef.current.token);
  const [isLoading, setIsLoading] = useState(!!sessionRef.current.token && !isSampleMode());
  const [sessionValidated, setSessionValidated] = useState(() => isSampleMode());
  const [retryTick, setRetryTick] = useState(0);
  const [adminPreviewMode, setAdminPreviewMode] = useState<AdminPreviewMode>(() => {
    if (typeof window === "undefined") return null;
    const saved = sessionStorage.getItem("arise_admin_preview_mode");
    return saved === "eye-gaze" ? "eye-gaze" : saved === "regular" ? "regular" : null;
  });

  const [viewAsTeacher, setViewAsTeacher] = useState<(AuthUser & { schoolName?: string | null }) | null>(() => {
    if (typeof window === "undefined") return null;
    try { const v = JSON.parse(sessionStorage.getItem(VIEW_AS_KEY) || "null"); return v && Number(v.id) > 0 ? v : null; } catch { return null; }
  });
  const startViewAsTeacher = useCallback((teacher: AuthUser & { schoolName?: string | null }) => {
    if (!sessionRef.current.user?.isAdmin || !(Number(teacher?.id) > 0)) return;
    const t = { ...teacher, isAdmin: false, role: "teacher" };
    sessionStorage.removeItem("arise_admin_preview_mode");
    sessionStorage.removeItem(VIEW_AS_KEY);
    setAdminPreviewMode(null);
    sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify(t));
    setViewAsTeacher(t);
  }, []);
  const exitViewAsTeacher = useCallback(() => {
    sessionStorage.removeItem(VIEW_AS_KEY);
    setViewAsTeacher(null);
  }, []);

  // a fresh sign-in (or sign-out) clears it from storage; drop it here too
  useEffect(() => {
    try { if (!sessionStorage.getItem(VIEW_AS_KEY)) setViewAsTeacher(null); } catch { /* fine */ }
  }, [user?.id]);

  const startAdminPreview = useCallback((mode: Exclude<AdminPreviewMode, null> = "regular") => {
    if (!sessionRef.current.user?.isAdmin) return;
    sessionStorage.removeItem(VIEW_AS_KEY);
    setViewAsTeacher(null);
    const nextMode = mode === "eye-gaze" ? "eye-gaze" : "regular";
    sessionStorage.setItem("arise_admin_preview_mode", nextMode);
    setAdminPreviewMode(nextMode);
  }, []);

  const exitAdminPreview = useCallback(() => {
    sessionStorage.removeItem("arise_admin_preview_mode");
    sessionStorage.removeItem(VIEW_AS_KEY);
    if (sessionRef.current.user) resetAuthenticatedNavigation(sessionRef.current.user);
    setAdminPreviewMode(null);
  }, []);

  useEffect(() => {
    if (!user) return;
    const originalFetch = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (!rawUrl.includes("/api/")) return originalFetch(input, init);
      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
      // The preview header goes on every call except "who am I" (which must keep
      // answering with the admin account — the preview is layered on top here) and
      // the admin console / Arise WorkHub's own APIs. Those are the admin's own
      // tools, never "preview as a student" territory — sending the header there
      // would silently demote the admin to a student server-side and lock them
      // out of Settings, banners, and the rest of the admin console with no
      // visible error, which is exactly the bug this guards against.
      const isAdminOrHubApi = /\/api\/(admin\/|teacher-hub\/)/.test(rawUrl);
      // "View as a teacher" goes on everything but "who am I" and the admin console's own APIs
      // (the teacher's hub included, since that's what a teacher sees).
      const viewAsId = user.isAdmin ? (() => { try { return Number(JSON.parse(sessionStorage.getItem(VIEW_AS_KEY) || "null")?.id) || 0; } catch { return 0; } })() : 0;
      if (viewAsId > 0 && !/\/api\/admin\//.test(rawUrl) && !/\/api\/me(?:[?#]|$)/.test(rawUrl)) headers.set("X-ARISE-View-As-Teacher", String(viewAsId));
      else if (user.isAdmin && !isAdminOrHubApi && !/\/api\/me(?:[?#]|$)/.test(rawUrl)) {
        const previewMode = sessionStorage.getItem("arise_admin_preview_mode");
        if (previewMode === "regular" || previewMode === "eye-gaze") headers.set("X-ARISE-Admin-Preview", previewMode);
      }
      if (user.role === "parent") {
        const childId = Number(sessionStorage.getItem("arise_parent_child_id"));
        if (Number.isSafeInteger(childId) && childId > 0) headers.set("X-ARISE-Child-ID", String(childId));
      }
      return originalFetch(input, { ...init, headers });
    }) as typeof window.fetch;
    return () => { window.fetch = originalFetch; };
  }, [user?.id, user?.role, user?.isAdmin]);

  // The installed app asks the browser to keep its storage, so the sign-in survives a force-close.
  useEffect(() => { if (user) keepStorage(); }, [user?.id]);
  // Already signed in when the app opens: use this account's own things on this device.
  useEffect(() => { if (user?.id && token && !isSampleMode()) setAccount(user.id); }, [user?.id, token]);

  const persistSession = useCallback((u: AuthUser | null, t: string | null) => {
    sessionRef.current = { user: u, token: t };
    saveSessionCookie(u, t);
    // Each account keeps its own things on this device; a different account opens fresh (accountStorage.ts).
    if (u && t && !isSampleMode()) setAccount(u.id);
    setUser(u);
    setToken(t);
    if (u && u.schoolId) {
      fetch(`${API_BASE}/api/schools`)
        .then(r => r.ok ? r.json() : [])
        .then(schools => {
          const school = schools.find((s: any) => s.id === u.schoolId);
          if (school) setSchoolTheme({ mascotName: school.mascotName, primaryHsl: school.primaryHsl, primaryForegroundHsl: school.primaryForegroundHsl, mascotEmoji: school.mascotEmoji });
        })
        .catch(() => {});
    } else setSchoolTheme(null);
    if (u && (u.role === "teacher" || u.role === "admin" || u.isAdmin)) {
      fetch(`${API_BASE}/api/teacher/my-band`, { headers: { Authorization: `Bearer ${t}` } })
        .then(r => r.ok ? r.json() : { bandsText: "" })
        .then(data => setTeacherBand(data.bandsText || ""))
        .catch(() => setTeacherBand(""));
    } else setTeacherBand("");
  }, []);

  useEffect(() => {
    if (!sessionRef.current.token || sessionValidated) return;
    let cancelled = false;
    setIsLoading(true);
    fetch(`${API_BASE}/api/me`, {
      headers: { Authorization: `Bearer ${sessionRef.current.token}` },
      signal: AbortSignal.timeout(8000),
    })
      .then(res => {
        // Only the server saying "this sign-in is no good" signs the person out. A slow connection or a server
        // hiccup keeps the sign-in they have, so opening the app in a school with poor Wi-Fi doesn't log them out.
        if (res.status === 401 || res.status === 403) {
          setUser(null); setToken(null); persistSession(null, null);
          return { ok: true as const, userData: null };
        }
        if (!res.ok) return { ok: false as const, userData: null };
        return res.json().then(userData => ({ ok: true as const, userData }));
      })
      .then(({ ok, userData }) => {
        if (cancelled) return;
        if (userData) {
          setUser(userData);
          sessionRef.current.user = userData;
          persistSession(userData, sessionRef.current.token);
        }
        setIsLoading(false);
        if (ok) {
          // A real answer came back (signed out, or a fresh user object): this is
          // settled, no need to check again this tab.
          setSessionValidated(true);
        } else {
          // The server answered but something was wrong server-side (a 500, a
          // flaky proxy) — try again shortly rather than running for the rest of
          // this tab's life on whatever was cached in the sign-in cookie, which
          // is exactly what let a stale isAdmin/role silently hide admin-only
          // pages until the next full reload. Bumping retryTick re-triggers this
          // effect even though sessionValidated is already false.
          window.setTimeout(() => { if (!cancelled) setRetryTick((t) => t + 1); }, 15000);
        }
      })
      .catch(() => {
        // Offline or too slow to answer: keep the saved sign-in, but keep trying —
        // see the comment above for why giving up permanently here is the bug.
        if (cancelled) return;
        setIsLoading(false);
        window.setTimeout(() => { if (!cancelled) setRetryTick((t) => t + 1); }, 15000);
      });
    return () => { cancelled = true; };
  }, [persistSession, sessionValidated, retryTick]);

  useEffect(() => {
    if (user && user.schoolId) {
      fetch(`${API_BASE}/api/schools`)
        .then(r => r.ok ? r.json() : [])
        .then(schools => {
          const school = schools.find((s: any) => s.id === user.schoolId);
          if (school) setSchoolTheme({ mascotName: school.mascotName, primaryHsl: school.primaryHsl, primaryForegroundHsl: school.primaryForegroundHsl, mascotEmoji: school.mascotEmoji });
        })
        .catch(() => {});
    }
    if (token && user && (user.role === "teacher" || user.role === "admin" || user.isAdmin)) {
      fetch(`${API_BASE}/api/teacher/my-band`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { bandsText: "" })
        .then(data => setTeacherBand(data.bandsText || ""))
        .catch(() => setTeacherBand(""));
    } else setTeacherBand("");
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    // A fresh sign-in must not inherit a previous administrator preview session.
    sessionStorage.removeItem("arise_admin_preview_mode");
    sessionStorage.removeItem(VIEW_AS_KEY);
    setAdminPreviewMode(null);
    persistSession(null, null);
    const res = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      const failure: Error & { confirmEmail?: boolean; username?: string } = new Error(data.message || "Login failed");
      // a new teacher who still has to type the code from their school email (see TeacherSignup)
      if (data.confirmEmail) { failure.confirmEmail = true; failure.username = data.username || username; }
      throw failure;
    }
    const data = await res.json();
    if (SAMPLE_USERNAMES.has(data.user?.username)) sessionStorage.setItem(SAMPLE_SESSION_KEY, "true");
    else sessionStorage.removeItem(SAMPLE_SESSION_KEY);
    resetAuthenticatedNavigation(data.user);
    persistSession(data.user, data.token);
    returnIfAsked();
  }, [persistSession]);

  const signInWithApple = useCallback(async (apple: { identityToken: string; authorizationCode?: string; givenName?: string; familyName?: string }) => {
    sessionStorage.removeItem("arise_admin_preview_mode");
    sessionStorage.removeItem(VIEW_AS_KEY);
    setAdminPreviewMode(null);
    persistSession(null, null);
    const res = await fetch(`${API_BASE}/api/auth/apple`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(apple), cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data?.token !== "string") throw new Error(data?.message || "Sign in with Apple didn't work. Try again.");
    sessionStorage.removeItem(SAMPLE_SESSION_KEY);
    resetAuthenticatedNavigation(data.user);
    persistSession(data.user, data.token);
    returnIfAsked();
    return !!data.made;
  }, [persistSession]);

  // Redeem a one-use sign-in code on arisetodo.com. The code is never a session token.
  const completeAdminHandoff = useCallback(async (code: string) => {
    if (!/^[a-f0-9]{64}$/.test(code)) throw new Error("The sign-in link is invalid.");
    const res = await fetch(`${API_BASE}/api/auth/admin-handoff/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || "Could not complete sign-in.");
    if (!isHubAccount(data?.user) || typeof data.token !== "string") {
      throw new Error("We couldn't confirm your account. Please sign in again.");
    }
    sessionStorage.removeItem("arise_admin_preview_mode");
    sessionStorage.removeItem(VIEW_AS_KEY);
    setAdminPreviewMode(null);
    sessionStorage.removeItem(SAMPLE_SESSION_KEY);
    resetAuthenticatedNavigation(data.user);
    persistSession(data.user, data.token);
    return data.user as AuthUser;
  }, [persistSession]);

  const register = useCallback(async (username: string, password: string, displayName: string, isEyeGazeUser?: boolean, teacherId?: number | null, schoolId?: number | null, gradeLevel?: string, unlisted?: { schoolName?: string; teacherName?: string; directoryTeacherId?: string; independent?: boolean; directorySchool?: string; advisoryId?: string }) => {
    sessionStorage.removeItem(SAMPLE_SESSION_KEY);
    const res = await fetch(`${API_BASE}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, displayName, isEyeGazeUser, teacherId, schoolId, gradeLevel, unlistedSchoolName: unlisted?.schoolName || undefined, unlistedTeacherName: unlisted?.teacherName || undefined, directoryTeacherId: unlisted?.directoryTeacherId || undefined, independent: unlisted?.independent || undefined, directorySchool: unlisted?.directorySchool || undefined, advisoryId: unlisted?.advisoryId || undefined }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Registration failed");
    }
    const data = await res.json();
    resetAuthenticatedNavigation(data.user);
    persistSession(data.user, data.token);
    returnIfAsked();
  }, [persistSession]);

  const refreshUser = useCallback(async () => {
    if (!sessionRef.current.token) return;
    try {
      const res = await fetch(`${API_BASE}/api/me`, { headers: { Authorization: `Bearer ${sessionRef.current.token}` } });
      if (res.ok) {
        const data = await res.json();
        const updatedUser = { ...sessionRef.current.user, ...data } as AuthUser;
        persistSession(updatedUser, sessionRef.current.token);
      }
    } catch {}
  }, [persistSession]);

  const logout = useCallback(() => {
    // The sample profile can't sign out of anything: it starts over from the fresh sample instead.
    if (isSampleMode()) { resetSample(); window.dispatchEvent(new Event("arise-logout")); window.location.replace(window.location.pathname + "#/lifehub"); window.location.reload(); return; }
    sessionStorage.removeItem("arise_admin_preview_mode");
    sessionStorage.removeItem(VIEW_AS_KEY);
    sessionStorage.removeItem(SAMPLE_SESSION_KEY);
    sessionStorage.removeItem("arise_parent_child_id");
    clearAuthenticatedNavigation();
    setAdminPreviewMode(null);
    if (sessionRef.current.token) {
      void forgetThisDevice(sessionRef.current.token);
      fetch(`${API_BASE}/api/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionRef.current.token}` },
        keepalive: true,
      }).catch(() => {});
    }
    persistSession(null, null);
    setAccount(null); // signed out: the next account to sign in opens with its own things
    forgetStay(); // the next person starts on Home, not on this person's open note
    window.dispatchEvent(new Event("arise-logout"));
  }, [persistSession]);

  useEffect(() => {
    const exitSample = () => {
      if (sessionStorage.getItem(SAMPLE_SESSION_KEY) !== "true") return;
      logout();
      window.history.replaceState(null, "", window.location.pathname + "#/");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    };
    const browserBack = () => {
      if (sessionStorage.getItem(SAMPLE_SESSION_KEY) === "true") exitSample();
    };
    window.addEventListener("arise-exit-sample", exitSample);
    window.addEventListener("popstate", browserBack);
    return () => {
      window.removeEventListener("arise-exit-sample", exitSample);
      window.removeEventListener("popstate", browserBack);
    };
  }, [logout]);

  const contextUser: AuthUser | null = user?.isAdmin && viewAsTeacher
    ? viewAsTeacher
    : user?.isAdmin && adminPreviewMode
    ? {
        ...user,
        username: "admin-preview",
        displayName: user.displayName || "Admin Preview",
        isAdmin: false,
        role: "student",
        is_eye_gaze_user: adminPreviewMode === "eye-gaze",
        totalPoints: 0,
        approvedByTeacher: true,
        accountApproved: true,
      }
    : user?.username === "sample"
      // The regular sample must behave exactly like a normal non-eye-gaze student.
      // Library had legacy tutorial content keyed to the literal username "sample".
      ? { ...user, username: "sample-student", is_eye_gaze_user: false }
      : user;
  // Eye-gaze accounts get look-to-press in the games on every device, tablets included.
  setEyeGazeUser(!!contextUser?.is_eye_gaze_user);

  return (
    <AuthContext.Provider value={{
      user: contextUser,
      realUser: user,
      adminPreviewMode,
      startAdminPreview,
      exitAdminPreview,
      viewAsTeacher: user?.isAdmin ? viewAsTeacher : null,
      startViewAsTeacher,
      exitViewAsTeacher,
      token,
      login,
      signInWithApple,
      completeAdminHandoff,
      register,
      logout,
      isLoading,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}