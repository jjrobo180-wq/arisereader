import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { API_BASE } from "@/lib/queryClient";
import { setSchoolTheme, setTeacherBand } from "@/lib/schoolTheme";
import { clearAuthenticatedNavigation, resetAuthenticatedNavigation } from "@/lib/navigation";

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
}

type AdminPreviewMode = "regular" | "eye-gaze" | null;

interface AuthContextType {
  user: AuthUser | null;
  realUser: AuthUser | null;
  adminPreviewMode: AdminPreviewMode;
  startAdminPreview: (mode?: Exclude<AdminPreviewMode, null>) => void;
  exitAdminPreview: () => void;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName: string, isEyeGazeUser?: boolean, teacherId?: number | null, schoolId?: number | null, gradeLevel?: string, unlisted?: { schoolName?: string; teacherName?: string; independent?: boolean }) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const COOKIE_NAME = "arise_session";
const SAMPLE_SESSION_KEY = "arise_sample_session";
const SAMPLE_USERNAMES = new Set(["sample", "tutorial-eye", "sample-parent"]);

function setCookie(name: string, value: string, days: number) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = name + "=" + value + ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
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
function saveSessionCookie(user: AuthUser | null, token: string | null) {
  if (user && token) {
    const data = btoa(JSON.stringify({ user, token }));
    setCookie(COOKIE_NAME, data, 7);
  } else deleteCookie(COOKIE_NAME);
}
function loadSessionCookie(): { user: AuthUser | null; token: string | null } {
  try {
    const raw = getCookie(COOKIE_NAME);
    if (!raw) return { user: null, token: null };
    const data = JSON.parse(atob(raw));
    if (typeof data.user?.username === "string" && SAMPLE_USERNAMES.has(data.user.username)) {
      deleteCookie(COOKIE_NAME);
      sessionStorage.removeItem(SAMPLE_SESSION_KEY);
      return { user: null, token: null };
    }
    return { user: data.user || null, token: data.token || null };
  } catch {
    return { user: null, token: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const sessionRef = useRef<{ user: AuthUser | null; token: string | null }>(loadSessionCookie());
  const [user, setUser] = useState<AuthUser | null>(sessionRef.current.user);
  const [token, setToken] = useState<string | null>(sessionRef.current.token);
  const [isLoading, setIsLoading] = useState(!!sessionRef.current.token);
  const [sessionValidated, setSessionValidated] = useState(false);
  const [adminPreviewMode, setAdminPreviewMode] = useState<AdminPreviewMode>(() => {
    if (typeof window === "undefined") return null;
    const saved = sessionStorage.getItem("arise_admin_preview_mode");
    return saved === "eye-gaze" ? "eye-gaze" : saved === "regular" ? "regular" : null;
  });

  const startAdminPreview = useCallback((mode: Exclude<AdminPreviewMode, null> = "regular") => {
    if (!sessionRef.current.user?.isAdmin) return;
    const nextMode = mode === "eye-gaze" ? "eye-gaze" : "regular";
    sessionStorage.setItem("arise_admin_preview_mode", nextMode);
    setAdminPreviewMode(nextMode);
  }, []);

  const exitAdminPreview = useCallback(() => {
    sessionStorage.removeItem("arise_admin_preview_mode");
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
      if (user.isAdmin) {
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

  const persistSession = useCallback((u: AuthUser | null, t: string | null) => {
    sessionRef.current = { user: u, token: t };
    saveSessionCookie(u, t);
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
    setIsLoading(true);
    fetch(`${API_BASE}/api/me`, {
      headers: { Authorization: `Bearer ${sessionRef.current.token}` },
      signal: AbortSignal.timeout(8000),
    })
      .then(res => {
        if (!res.ok) {
          setUser(null); setToken(null); persistSession(null, null);
        } else return res.json();
      })
      .then(userData => {
        if (userData) {
          setUser(userData);
          sessionRef.current.user = userData;
          persistSession(userData, sessionRef.current.token);
        }
      })
      .catch(() => { setUser(null); setToken(null); persistSession(null, null); })
      .finally(() => { setIsLoading(false); setSessionValidated(true); });
  }, [persistSession, sessionValidated]);

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
    persistSession(null, null);
    const res = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Login failed");
    }
    const data = await res.json();
    if (SAMPLE_USERNAMES.has(data.user?.username)) sessionStorage.setItem(SAMPLE_SESSION_KEY, "true");
    else sessionStorage.removeItem(SAMPLE_SESSION_KEY);
    resetAuthenticatedNavigation(data.user);
    persistSession(data.user, data.token);
  }, [persistSession]);

  const register = useCallback(async (username: string, password: string, displayName: string, isEyeGazeUser?: boolean, teacherId?: number | null, schoolId?: number | null, gradeLevel?: string, unlisted?: { schoolName?: string; teacherName?: string; independent?: boolean }) => {
    sessionStorage.removeItem(SAMPLE_SESSION_KEY);
    const res = await fetch(`${API_BASE}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, displayName, isEyeGazeUser, teacherId, schoolId, gradeLevel, unlistedSchoolName: unlisted?.schoolName || undefined, unlistedTeacherName: unlisted?.teacherName || undefined, independent: unlisted?.independent || undefined }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Registration failed");
    }
    const data = await res.json();
    resetAuthenticatedNavigation(data.user);
    persistSession(data.user, data.token);
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
    sessionStorage.removeItem("arise_admin_preview_mode");
    sessionStorage.removeItem(SAMPLE_SESSION_KEY);
    sessionStorage.removeItem("arise_parent_child_id");
    clearAuthenticatedNavigation();
    setAdminPreviewMode(null);
    if (sessionRef.current.token) {
      fetch(`${API_BASE}/api/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionRef.current.token}` },
        keepalive: true,
      }).catch(() => {});
    }
    persistSession(null, null);
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

  const contextUser: AuthUser | null = user?.isAdmin && adminPreviewMode
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

  return (
    <AuthContext.Provider value={{
      user: contextUser,
      realUser: user,
      adminPreviewMode,
      startAdminPreview,
      exitAdminPreview,
      token,
      login,
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