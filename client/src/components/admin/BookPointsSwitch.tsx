// Admin > Library: where the one-time switch of every book to A.R.I.S.E. points
// stands. It runs by itself; this shows whether it has finished, and lets the
// admin start it (or pick it up) if any books are still on their old points.
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/queryClient";
import { sessionToken } from "@/lib/notifications";

type Status = {
  state: "done" | "running" | "waiting" | "stopped";
  at: string | null;
  books: number; attempts: number; students: number;
  /** Books still on their old points. */
  left: number;
  error?: string;
};

const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const when = (at: string | null) => {
  const t = at ? new Date(at) : null;
  return t && !Number.isNaN(t.getTime()) ? t.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
};

export default function BookPointsSwitch({ token, onChanged }: { token: string | null; onChanged: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const wasDone = useRef<boolean | null>(null);
  // The page hands in a new function every time it draws; only the latest is ever called.
  const changed = useRef(onChanged);
  changed.current = onChanged;

  const load = useCallback(async (method: "GET" | "POST" = "GET") => {
    const res = await fetch(`${API_BASE}/api/admin/book-points/switch`, { method, headers: { Authorization: `Bearer ${token || sessionToken()}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Could not check the books' points.");
    setStatus(data as Status);
    return data as Status;
  }, [token]);

  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

  // While it is at work, look again every few seconds; when it finishes, refresh the book list.
  const working = status?.state === "running";
  useEffect(() => {
    if (!status) return;
    const done = status.state === "done" && status.left === 0;
    if (wasDone.current === false && done) changed.current();
    wasDone.current = done;
    if (!working) return;
    const timer = window.setTimeout(() => { load().catch(() => {}); }, 4000);
    return () => window.clearTimeout(timer);
  }, [status, working, load]);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await load("POST"); }
    catch (e: any) { setError(e?.message || "Could not start it."); }
    finally { setBusy(false); }
  }

  if (!status) return error ? <p role="alert" className="mb-4 text-sm text-destructive">{error}</p> : null;

  const finished = status.state === "done" && status.left === 0;
  return (
    <div className={`mb-4 rounded-xl border p-3 text-sm ${finished ? "border-border bg-muted/20" : "border-amber-500/40 bg-amber-500/10"}`} data-testid="book-points-switch" role="status">
      {finished ? (
        <p>
          <span className="font-semibold">Every book is on A.R.I.S.E. points (5 to 30).</span>{" "}
          {status.books > 0
            ? `${count(status.books, "book was", "books were")} switched${when(status.at) ? ` on ${when(status.at)}` : ""}, and ${count(status.students, "student total was", "student totals were")} updated.`
            : "No book needed changing."}
        </p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-semibold">
              {working ? "Switching books to A.R.I.S.E. points…" : `${count(status.left, "book is", "books are")} still on old points.`}
            </p>
            <p className="text-muted-foreground">
              {working
                ? `${count(status.left, "book", "books")} to go. You can leave this page; it carries on.`
                : status.state === "stopped"
                  ? `The switch stopped${status.error ? ` (${status.error})` : ""}. It tries again by itself, or you can start it now.`
                  : "The switch picks up by itself within a couple of minutes, or you can start it now."}
            </p>
          </div>
          {!working && <Button size="sm" onClick={start} disabled={busy} className="shrink-0" data-testid="book-points-switch-start">{busy ? "Starting..." : "Switch them now"}</Button>}
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-destructive">{error}</p>}
    </div>
  );
}
