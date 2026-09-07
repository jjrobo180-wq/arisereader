import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { API_BASE } from "@/lib/queryClient";
import { setSchoolTheme, setTeacherBand } from "@/lib/schoolTheme";

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

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName: string, isEyeGazeUser?: boolean, teacherId?: number | null, schoolId?: number | null, gradeLevel?: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Cookie helpers — survive page reloads
const COOKIE_NAME = "arise_session";
function setCookie(name: string, value: string, days: number) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = name + "=" + value + ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
}
function getCookie(name: string): string | null {
  const cookies = document.cookie.split(";");
  for (let i = 0; i < cookies.length; i++) {
    const c = cookies[i].trim();
    if (c.startsWith(name + "=")) {
      return c.substring(name.length + 1);
    }
  }
  return null;
}
function deleteCookie(name: string) {
  document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax";
}

// Encode/decode session data for cookie storage
function saveSessionCookie(user: AuthUser | null, token: string | null) {
  if (user && token) {
    const data = btoa(JSON.stringify({ user, token }));
    setCookie(COOKIE_NAME, data, 7);
  } else {
    deleteCookie(COOKIE_NAME);
  }
}
function loadSessionCookie(): { user: AuthUser | null; token: string | null } {
  try {
    const raw = getCookie(COOKIE_NAME);
    if (!raw) return { user: null, token: null };
    const data = JSON.parse(atob(raw));
    // Sample account: always reset to login page on fresh page load
    if (data.user?.username === 'sample') {
      deleteCookie(COOKIE_NAME);
      return { user: null, token: null };
    }
    return { user: data.user || null, token: data.token || null };
  } catch {
    return { user: null, token: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // useRef for session memory — survives re-renders, never triggers re-renders
  const sessionRef = useRef<{ user: AuthUser | null; token: string | null }>(
    loadSessionCookie()
  );

  // Initialize state from ref (already has cookie data)
  const [user, setUser] = useState<AuthUser | null>(sessionRef.current.user);
  const [token, setToken] = useState<string | null>(sessionRef.current.token);
  // Start in loading state if there's a session to validate — prevents premature routing
  const [isLoading, setIsLoading] = useState(!!sessionRef.current.token);
  const [sessionValidated, setSessionValidated] = useState(false);

  // Validate session on app load — if the token is expired, clear the cookie
  // and redirect to login. This prevents blank pages from stale cookies.
  useEffect(() => {
    if (!sessionRef.current.token || sessionValidated) return;
    setIsLoading(true);
    fetch(`${API_BASE}/api/me`, {
      headers: { Authorization: `Bearer ${sessionRef.current.token}` },
      signal: AbortSignal.timeout(8000),
    })
      .then(res => {
        if (!res.ok) {
          // Session expired — clear everything
          setUser(null);
          setToken(null);
          persistSession(null, null);
        } else {
          // Session valid — refresh user data from server
          return res.json();
        }
      })
      .then(userData => {
        if (userData) {
          setUser(userData);
          sessionRef.current.user = userData;
          // Update cookie with fresh user data
          persistSession(userData, sessionRef.current.token);
        }
      })
      .catch(() => {
        // Network error — if we can't reach the server, the session is useless
        // Clear it so the user sees the login page instead of a blank dashboard
        setUser(null);
        setToken(null);
        persistSession(null, null);
      })
      .finally(() => {
        setIsLoading(false);
        setSessionValidated(true);
      });
  }, []);

  // Apply school theme on page load if user is already logged in (from cookie)
  useEffect(() => {
    if (user && user.schoolId) {
      fetch(`${API_BASE}/api/schools`)
        .then(r => r.ok ? r.json() : [])
        .then(schools => {
          const school = schools.find((s: any) => s.id === user.schoolId);
          if (school) {
            setSchoolTheme({
              mascotName: school.mascotName,
              primaryHsl: school.primaryHsl,
              primaryForegroundHsl: school.primaryForegroundHsl,
              mascotEmoji: school.mascotEmoji,
            });
          }
        })
        .catch(() => {});
    }
    // Fetch teacher band on page load
    if (token && user && (user.role === 'teacher' || user.role === 'admin' || (user as any).isAdmin)) {
      fetch(`${API_BASE}/api/teacher/my-band`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : { bandsText: '' })
        .then(data => setTeacherBand(data.bandsText || ''))
        .catch(() => setTeacherBand(''));
    } else {
      setTeacherBand('');
    }
  }, []);

  const persistSession = useCallback((u: AuthUser | null, t: string | null) => {
    sessionRef.current = { user: u, token: t };
    saveSessionCookie(u, t);
    setUser(u);
    setToken(t);
    // Apply school theme based on logged-in user's school
    if (u && u.schoolId) {
      fetch(`${API_BASE}/api/schools`)
        .then(r => r.ok ? r.json() : [])
        .then(schools => {
          const school = schools.find((s: any) => s.id === u.schoolId);
          if (school) {
            setSchoolTheme({
              mascotName: school.mascotName,
              primaryHsl: school.primaryHsl,
              primaryForegroundHsl: school.primaryForegroundHsl,
              mascotEmoji: school.mascotEmoji,
            });
          }
        })
        .catch(() => {});
    } else {
      setSchoolTheme(null);
    }
    // Fetch teacher's grade band
    if (u && (u.role === 'teacher' || u.role === 'admin' || (u as any).isAdmin)) {
      fetch(`${API_BASE}/api/teacher/my-band`, {
        headers: { Authorization: `Bearer ${t}` },
      })
        .then(r => r.ok ? r.json() : { bandsText: '' })
        .then(data => setTeacherBand(data.bandsText || ''))
        .catch(() => setTeacherBand(''));
    } else {
      setTeacherBand('');
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    // Clear any old session data before login
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
    persistSession(data.user, data.token);
  }, [persistSession]);

  const register = useCallback(async (username: string, password: string, displayName: string, isEyeGazeUser?: boolean, teacherId?: number | null, schoolId?: number | null, gradeLevel?: string) => {
    const res = await fetch(`${API_BASE}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, displayName, isEyeGazeUser, teacherId, schoolId, gradeLevel }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Registration failed");
    }
    const data = await res.json();
    persistSession(data.user, data.token);
  }, [persistSession]);

  const refreshUser = useCallback(async () => {
    if (!sessionRef.current.token) return;
    try {
      const res = await fetch(`${API_BASE}/api/me`, {
        headers: { Authorization: `Bearer ${sessionRef.current.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const updatedUser = { ...sessionRef.current.user, ...data } as AuthUser;
        persistSession(updatedUser, sessionRef.current.token);
      }
    } catch {}
  }, [persistSession]);

  const logout = useCallback(() => {
    if (sessionRef.current.token) {
      fetch(`${API_BASE}/api/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionRef.current.token}` },
      }).catch(() => {});
    }
    // Clear cookie, session ref, and state
    persistSession(null, null);
    // Dispatch event so module-level caches can clear
    window.dispatchEvent(new Event("arise-logout"));
  }, [persistSession]);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
