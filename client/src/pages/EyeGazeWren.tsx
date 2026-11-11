import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { isNativeApp, nativeFlavor } from "@/lib/nativeApp";

type WrenDoc = { get(): Promise<{ exists: boolean; data(): any }>; set(body: unknown): Promise<void>; delete(): Promise<void> };

/**
 * The account Wren saves to when it runs inside Eye Gazer: the signed-in child's Eye Gazer profile.
 * Wren (at /eyegaze/wren/) looks for window.parent.__ariseWren and uses it the same way it uses its
 * account storage elsewhere, so there is no separate Wren sign-in or setup.
 */
function makeHost(token: string, user: { id: number; displayName?: string; username?: string }) {
  const call = (name: string, init?: RequestInit) => fetch(`${API_BASE}/api/eye-gaze/wren/${encodeURIComponent(name)}`, {
    ...init,
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
  });
  const fail = (res: Response) => { throw Object.assign(new Error(`Wren save ${res.status}`), { code: res.status === 413 ? "too_large" : res.status === 401 || res.status === 403 ? "not_granted" : "unavailable" }); };
  const db = {
    doc(path: string): WrenDoc {
      const name = path.split("/").pop() || "";
      return {
        async get() { const res = await call(name); if (!res.ok) fail(res); const j = await res.json(); return { exists: !!j.exists, data: () => j.data }; },
        async set(body) { const res = await call(name, { method: "PUT", body: JSON.stringify({ data: body }) }); if (!res.ok) fail(res); },
        async delete() { const res = await call(name, { method: "DELETE" }); if (!res.ok) fail(res); },
      };
    },
  };
  const name = user.displayName || user.username || "";
  const me = { id: String(user.id), name };
  return {
    accountKey: `u${user.id}`,
    skipSetup: true,
    accountLabel: `${name.split(" ")[0] || "this"}'s Eye Gazer profile`,
    use(capability: string) {
      if (capability === "db") return Promise.resolve(db);
      if (capability === "user") return Promise.resolve({ me: async () => me });
      return Promise.reject(Object.assign(new Error("not available"), { code: "not_declared" }));
    },
  };
}

/** Wren, the AI-voice talker, opened full screen inside the Eye Gazer app. */
export default function EyeGazeWren() {
  const [, navigate] = useLocation();
  const { user, token } = useAuth();
  // Set before the frame exists, so Wren finds the account the moment it starts.
  const [ready] = useState(() => {
    if (!user || !token) return false;
    (window as any).__ariseWren = makeHost(token, user as any);
    return true;
  });
  useEffect(() => () => { delete (window as any).__ariseWren; }, []);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#f7f8ff]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-[#e5e8f4] bg-white px-3 sm:px-5">
        <button type="button" onClick={() => navigate("/eye-gaze-home")} className="eg-press inline-flex min-h-11 items-center gap-2 rounded-full bg-violet-700 px-4 text-sm font-bold text-white" data-testid="button-wren-home">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Home
        </button>
        <span className="eg-title text-lg font-extrabold tracking-tight text-[#191b35]">Wren <span className="text-violet-700">Talker</span></span>
      </div>
      {isNativeApp() && nativeFlavor() === "todo"
        ? <p className="p-6 text-center text-slate-600" data-testid="wren-not-here">Wren Talker is in the Arise AAC app. Open Arise AAC to use it.</p>
        : ready
        ? <iframe src="/eyegaze/wren/" title="Wren talker" allow="autoplay; camera" className="w-full flex-1 border-0 bg-white" data-testid="frame-wren" />
        : <p className="p-6 text-center text-slate-600">Sign in to your Eye Gazer account to use Wren.</p>}
    </div>
  );
}
