// The way into A.R.I.S.E. Beginners (#/beginners) from the Library: shown to students in grades K–3 and to anyone
// who has already started Beginners. Beginners points are Reader points, so the line says so.
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

type BeginnersMe = { beginnerGrade?: boolean; next?: string | null; nextTitle?: string | null; lessons?: Record<string, unknown>; streak?: number; preview?: boolean };
let cached: { token: string; at: number; value: Promise<BeginnersMe | null> } | null = null;

/** This student's Beginners summary (asked once a minute at most), or null. */
export function useBeginners(): BeginnersMe | null {
  const { token, user } = useAuth();
  const [me, setMe] = useState<BeginnersMe | null>(null);
  useEffect(() => {
    if (!token || !user || user.role !== "student") { setMe(null); return; }
    if (!cached || cached.token !== token || Date.now() - cached.at > 60_000) {
      cached = { token, at: Date.now(), value: fetch(`${API_BASE}/api/beginners/me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null) };
    }
    let live = true;
    void cached.value.then((v) => { if (live) setMe(v); });
    return () => { live = false; };
  }, [token, user?.id, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps
  return me && !me.preview ? me : null;
}

export function BeginnersBanner({ onOpen }: { onOpen: () => void }) {
  const me = useBeginners();
  const started = !!me && Object.keys(me.lessons || {}).length > 0;
  if (!me || (!me.beginnerGrade && !started)) return null;
  const line = me.nextTitle ? `${started ? "Up next" : "Start with"}: ${me.nextTitle}. Earn Reader points for every lesson.` : "You finished every lesson! Practice in Say It Studio.";
  return (
    <button type="button" onClick={onOpen} data-testid="beginners-banner"
      className="mb-4 flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition hover:brightness-105"
      style={{ background: "linear-gradient(90deg, #fff1c7, #fffaf0)", borderColor: "#f0a500", color: "#2b1d52" }}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-2xl" style={{ background: "#ffbe2e" }} aria-hidden="true">☀</span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-black">A.R.I.S.E. Beginners{me.streak ? ` · 🔥 ${me.streak} days` : ""}</span>
        <span className="block text-sm font-semibold" style={{ color: "#6b4a00" }}>{line}</span>
      </span>
      <span className="shrink-0 rounded-xl px-3 py-2 text-sm font-black text-white" style={{ background: "#12a150" }}>{started ? "Keep reading" : "Start"}</span>
    </button>
  );
}
