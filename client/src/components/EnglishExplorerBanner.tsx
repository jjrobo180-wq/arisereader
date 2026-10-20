// The way into English Explorer (#/english) from the Library, only for students a teacher turned it on for.
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

type EnglishMe = { enabled: boolean; staff?: boolean; due?: number; streak?: number; today?: { lessons: number }; name?: string };
let cached: { token: string; at: number; value: Promise<EnglishMe | null> } | null = null;

/** Whether this student has English Explorer (asked once a minute at most). */
export function useEnglishExplorer(): EnglishMe | null {
  const { token, user } = useAuth();
  const [me, setMe] = useState<EnglishMe | null>(null);
  useEffect(() => {
    if (!token || !user || user.role !== "student") { setMe(null); return; }
    if (!cached || cached.token !== token || Date.now() - cached.at > 60_000) {
      cached = { token, at: Date.now(), value: fetch(`${API_BASE}/api/english/me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null) };
    }
    let live = true;
    void cached.value.then((v) => { if (live) setMe(v); });
    return () => { live = false; };
  }, [token, user?.id, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps
  return me?.enabled && !me.staff ? me : null;
}

export function EnglishExplorerBanner({ onOpen }: { onOpen: () => void }) {
  const me = useEnglishExplorer();
  if (!me) return null;
  const line = me.due ? `${me.due} ${me.due === 1 ? "word is" : "words are"} ready to review.` : me.today?.lessons ? "Nice work today! Play one more?" : "Learn new English words and earn points.";
  return (
    <button type="button" onClick={onOpen} data-testid="english-explorer-banner"
      className="mb-4 flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition hover:brightness-105"
      style={{ background: "linear-gradient(90deg, #cdeff5, #eafafc)", borderColor: "#0e7c86", color: "#1f2a44" }}>
      <span className="text-3xl" aria-hidden="true">🦜</span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-black">English Explorer{me.streak ? ` · 🔥 ${me.streak} days` : ""}</span>
        <span className="block text-sm font-semibold" style={{ color: "#0a5f67" }}>{line}</span>
      </span>
      <span className="shrink-0 rounded-xl px-3 py-2 text-sm font-black text-white" style={{ background: "#0e7c86" }}>Play</span>
    </button>
  );
}
