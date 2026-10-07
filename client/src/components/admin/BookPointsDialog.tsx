// Admin > Library: set what a book is worth. The number the admin saves here is
// the book's value from then on (AR BookFinder no longer changes it), and every
// student who already passed the book's quiz is moved to the new value.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE } from "@/lib/queryClient";
import { sessionToken } from "@/lib/notifications";
import { BOOK_POINTS_MAX, cleanBookPoints } from "@shared/bookPoints";

export type PointsBook = { id: number; title: string; pointsValue?: number; pointsSetByAdmin?: boolean; arPoints?: number | null };

type Props = {
  /** The book being changed, or null when the box is closed. */
  book: PointsBook | null;
  token: string | null;
  onClose: () => void;
  /** Called after a save, so the list can show the new value. */
  onSaved: () => void;
};

export default function BookPointsDialog({ book, token, onClose, onSaved }: Props) {
  return (
    <Dialog open={!!book} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-h-[92dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Points for {book?.title}</DialogTitle>
        </DialogHeader>
        {/* keyed by the book, so each book opens with its own number and a clean slate */}
        {book && <PointsForm key={book.id} book={book} token={token} onClose={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function PointsForm({ book, token, onClose, onSaved }: Props & { book: PointsBook }) {
  const [value, setValue] = useState(String(book.pointsValue ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const points = cleanBookPoints(value);
  const current = Number(book.pointsValue ?? 0);

  async function save() {
    if (busy) return;
    if (points === null) { setError(`Enter a number above 0, up to ${BOOK_POINTS_MAX}.`); return; }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/books/${book.id}/points`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token || sessionToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pointsValue: points }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not save the points.");
      const students = Number(data.students || 0);
      setDone(
        students > 0
          ? `Saved. This book is now worth ${data.pointsValue} points, and ${students} ${students === 1 ? "student who passed it was" : "students who passed it were"} updated.`
          : `Saved. This book is now worth ${data.pointsValue} points.`,
      );
      onSaved();
    } catch (err: any) {
      setError(err?.message || "Could not save the points.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4 py-2">
        <p role="status" className="text-sm font-medium text-green-400">{done}</p>
        <Button onClick={onClose} className="w-full">Done</Button>
      </div>
    );
  }
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <p className="text-sm text-muted-foreground">
        Students who score 70% or higher on this book's quiz earn exactly this many points. Students who already passed it are changed to the new number too.
      </p>
      <div className="space-y-2">
        <Label htmlFor="book-points">Points</Label>
        <Input
          id="book-points" type="number" inputMode="decimal" min="0.5" max={BOOK_POINTS_MAX} step="0.5" autoFocus
          value={value} onChange={(e) => { setValue(e.target.value); setError(""); }}
          data-testid="book-points-input"
        />
        <p className="text-xs text-muted-foreground">
          Now worth {current} {current === 1 ? "point" : "points"}
          {book.pointsSetByAdmin ? ", set by you." : ", from AR BookFinder."}
          {book.arPoints != null && book.pointsSetByAdmin ? ` AR lists it at ${book.arPoints}.` : ""}
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy || points === null || (points === current && !!book.pointsSetByAdmin)} className="w-full" data-testid="book-points-save">
        {busy ? "Saving..." : "Save points"}
      </Button>
    </form>
  );
}
