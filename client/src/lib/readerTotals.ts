// All-time quizzes taken and points earned on Arise Reader (GET /api/public/reader-totals: totals only, public).
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import type { ReaderTotals } from "@shared/readerTotals";

export { formatTotal, sinceLabel, type ReaderTotals } from "@shared/readerTotals";

let cached: ReaderTotals | null = null;

/** The totals, or null while loading (and when the server can't say): the screens show nothing then, never a 0. */
export function useReaderTotals(): ReaderTotals | null {
  const [totals, setTotals] = useState<ReaderTotals | null>(cached);
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/public/reader-totals`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d || !(Number(d.quizzes) > 0)) return;
        cached = { quizzes: Number(d.quizzes), points: Number(d.points) || 0, since: typeof d.since === "string" ? d.since : null };
        setTotals(cached);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return totals;
}
