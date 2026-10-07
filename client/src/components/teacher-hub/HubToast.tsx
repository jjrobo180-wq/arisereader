// The strip at the bottom of the Hub: short messages with an Undo button (they go away by
// themselves), and anything that needs attention (a save that did not go through) above them.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export type ToastAction = { label: string; run: () => void };
export type ToastItem = { id: number; text: string; actions: ToastAction[] };

export type Toasts = {
  items: ToastItem[];
  /** Shows a message for `ms` (10 seconds unless told otherwise). */
  show(text: string, actions?: ToastAction[], ms?: number): number;
  dismiss(id: number): void;
};

export function useToasts(): Toasts {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, number>());
  const counter = useRef(1);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setItems((list) => list.filter((item) => item.id !== id));
  }, []);

  const show = useCallback((text: string, actions: ToastAction[] = [], ms = 10_000) => {
    const id = counter.current++;
    // Three at a time is plenty; the oldest makes way.
    setItems((list) => [...list.slice(-2), { id, text, actions }]);
    timers.current.set(id, window.setTimeout(() => dismiss(id), ms));
    return id;
  }, [dismiss]);

  useEffect(() => () => { timers.current.forEach((timer) => window.clearTimeout(timer)); timers.current.clear(); }, []);

  return { items, show, dismiss };
}

export function BottomStack({ toasts, children }: { toasts: Toasts; children?: ReactNode }) {
  if (!toasts.items.length && !children) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {children}
      {toasts.items.map((item) => (
        <div key={item.id} role="status" className="pointer-events-auto flex w-full max-w-xl items-center gap-2 rounded-2xl bg-slate-950 py-1.5 pl-4 pr-1.5 text-sm text-white shadow-xl" data-testid="hub-toast">
          <span className="min-w-0 flex-1 break-words py-1.5">{item.text}</span>
          {item.actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => { toasts.dismiss(item.id); action.run(); }}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-3 text-sm font-semibold text-teal-300 hover:bg-white/10"
            >
              {action.label}
            </button>
          ))}
          <button type="button" onClick={() => toasts.dismiss(item.id)} aria-label="Dismiss" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
