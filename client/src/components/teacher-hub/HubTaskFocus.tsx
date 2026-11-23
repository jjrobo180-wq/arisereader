// Arise WorkHub: "Focus on this to-do" in the to-do pop-up. In the Arise To Duo iPhone app it starts a timer on
// the Lock Screen and in the Dynamic Island (lib/duoFocus.ts, the same timer LifeHub's to-dos use). Its Done
// button there checks the to-do off (TeacherHub.tsx listens for it). Anywhere else nothing shows.
import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { FOCUS_MINUTES, currentFocus, focusSupported, readFocus, startFocus, stopFocus, type FocusNow } from "@/lib/duoFocus";
import { isNativeApp, nativeFlavor } from "@/lib/nativeApp";

export function TaskFocus({ task, say }: { task: { id: string; title: string; done: boolean }; say?: (text: string) => void }) {
  const [focus, setFocus] = useState<FocusNow | null>(() => currentFocus());
  const [error, setError] = useState("");
  useEffect(() => { if (focusSupported()) void readFocus().then(setFocus); }, []);
  if (task.done) return null;
  // The To Duo iPhone app from before the focus timer: say so, instead of showing nothing.
  if (!focusSupported()) return isNativeApp() && nativeFlavor() === "todo" ? (
    <p className="rounded-2xl bg-violet-50 p-3 text-xs font-semibold text-violet-900 ring-1 ring-violet-100" data-testid="work-task-focus-update">
      <Timer className="mr-1 inline h-4 w-4" />Focus timer: update Arise To Duo to get a timer on your Lock Screen and in the Dynamic Island.
    </p>
  ) : null;
  const mine = focus?.id === task.id;
  const begin = async (m: number) => {
    setError("");
    try { const f = await startFocus(task, m); setFocus(f); say?.(`Focus: ${m} minutes. It's on your Lock Screen and in the Dynamic Island.`); }
    catch (e: any) { setError(e?.message || "The focus timer couldn't start."); }
  };
  return (
    <div className="rounded-2xl bg-violet-50 p-3 ring-1 ring-violet-100" data-testid="work-task-focus">
      {mine ? (
        <div className="flex flex-wrap items-center gap-2">
          <Timer className="h-4 w-4 text-violet-700" />
          <p className="min-w-0 flex-1 text-sm font-bold text-violet-900">Focusing until {new Date(focus!.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
          <button type="button" onClick={() => { setFocus(null); void stopFocus(); }} className="min-h-10 rounded-xl bg-white px-3 text-xs font-bold text-violet-700 ring-1 ring-violet-200">Stop</button>
        </div>
      ) : (
        <>
          <p className="flex items-center gap-1.5 text-xs font-bold text-violet-900"><Timer className="h-4 w-4" /> Focus on this to-do</p>
          <p className="mt-0.5 text-xs text-violet-800/80">A timer on your Lock Screen and in the Dynamic Island. Tap Done there when you finish{focus ? " (this replaces the timer that's running)" : ""}.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FOCUS_MINUTES.map((m) => <button key={m} type="button" onClick={() => void begin(m)} className="min-h-10 rounded-xl bg-white px-3 text-xs font-bold text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100" data-testid={`work-task-focus-${m}`}>{m} min</button>)}
          </div>
          {error && <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p>}
        </>
      )}
    </div>
  );
}
