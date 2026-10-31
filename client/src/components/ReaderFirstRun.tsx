// The first run of the two A.R.I.S.E. Reader iPhone apps, right after the first sign-in on a phone:
//  - A.R.I.S.E. Reader (students): a daily "time to read" reminder at a time they pick, scheduled on
//    the phone itself (no server, no account details leave it), then a short tour.
//  - A.R.I.S.E. Reader Educator (teachers and parents): Apple push for messages and updates from the
//    server (lib/applePush.ts), then a short tour.
// Full-screen pages like a native app's onboarding; shown once per person on each phone.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, BookOpen, ClipboardList, GraduationCap, Sparkles, Trophy, Users } from "lucide-react";
import { hasNativePlugin, nativeAppInfo, nativeCall, nativeFlavor } from "@/lib/nativeApp";
import { startApplePush } from "@/lib/applePush";

const DONE = (id: number | string) => `arise-reader-first-run-v1:${id}`;
const LOCAL = /localnotif/i;
/** The one daily reading reminder's id (replaced, never doubled, when the time changes). */
export const READ_REMINDER_ID = 424242;
const READ_TIME_KEY = "arise-read-reminder-time";

type Page = { id: string; icon: ReactNode; tint: string; title: string; body: string };
const STUDENT: Page[] = [
  { id: "library", icon: <BookOpen />, tint: "#6a3cf0", title: "Find your next book", body: "Your library has books picked for how you read. Tap one to start, and it remembers your page." },
  { id: "quiz", icon: <Trophy />, tint: "#e08a1a", title: "Finish, quiz, earn", body: "When you finish a book, take its quiz to earn points and show what you learned." },
  { id: "grow", icon: <Sparkles />, tint: "#0f766e", title: "Watch yourself grow", body: "Every book and every quiz counts. Your teacher or parent sees your progress and can cheer you on." },
];
const EDUCATOR: Page[] = [
  { id: "class", icon: <GraduationCap />, tint: "#6a3cf0", title: "Your class at a glance", body: "Your students, books waiting for approval and quizzes to grade, all on one screen." },
  { id: "grade", icon: <ClipboardList />, tint: "#0f766e", title: "Grade and quiz together", body: "Grade written answers in a few taps, or run a live quiz with the whole class." },
  { id: "family", icon: <Users />, tint: "#e0457b", title: "Parents, right there too", body: "Parents follow their child's reading and celebrate each win. Same app, same sign-in." },
];

/** Schedules (or moves) the daily reading reminder on this iPhone. Resolves with whether it's on. */
export async function scheduleReadingReminder(hour: number, minute: number): Promise<boolean> {
  if (!hasNativePlugin(LOCAL)) return false;
  const perm = await nativeCall(LOCAL, "LocalNotifications", "requestPermissions");
  if (String(perm?.display ?? "") !== "granted") return false;
  await nativeCall(LOCAL, "LocalNotifications", "cancel", { notifications: [{ id: READ_REMINDER_ID }] }).catch(() => {});
  await nativeCall(LOCAL, "LocalNotifications", "schedule", { notifications: [{
    id: READ_REMINDER_ID, title: "Time to read", body: "Your next chapter is waiting. Even 10 minutes counts!",
    schedule: { on: { hour, minute }, allowWhileIdle: true },
  }] });
  try { localStorage.setItem(READ_TIME_KEY, `${hour}:${minute}`); } catch { /* still scheduled */ }
  return true;
}

export default function ReaderFirstRun({ userId }: { userId: number | string }) {
  const student = nativeFlavor() === "reader";
  const pages = student ? STUDENT : EDUCATOR;
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(true);
  const [time, setTime] = useState("18:00");
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const touch = useRef<number | null>(null);
  useEffect(() => {
    let first = false;
    try { first = localStorage.getItem(DONE(userId)) !== "1"; } catch { first = false; }
    if (first) { const t = window.setTimeout(() => setOpen(true), 300); return () => window.clearTimeout(t); }
  }, [userId]);
  if (!open) return null;
  const close = () => { setOpen(false); try { localStorage.setItem(DONE(userId), "1"); } catch { /* shown again next time */ } };

  const allow = async () => {
    setBusy(true); setNote("");
    try {
      const [h, m] = time.split(":").map(Number);
      const on = student ? await scheduleReadingReminder(h || 18, m || 0) : await startApplePush(true);
      if (on) setAsking(false);
      else setNote(`Notifications are off. You can turn them on any time in Settings → Notifications → ${nativeAppInfo().name}.`);
    } catch { setNote("That didn't work. Try again, or tap Not now."); }
    finally { setBusy(false); }
  };

  const font = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif" };
  const shell = "fixed inset-0 z-[700] flex flex-col bg-white pb-[max(16px,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] text-[#111018]";
  const primary = "flex h-[54px] w-full items-center justify-center gap-2 rounded-[16px] text-[17px] font-semibold text-white transition active:opacity-85 disabled:opacity-60";
  const icon = student ? "/app-icons/reader-1024.png" : "/app-icons/educator-1024.png";

  if (asking) return <div className={shell} style={font} role="dialog" aria-modal="true" aria-label="Notifications" data-testid="reader-notify-ask">
    <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col px-7">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        <div className="relative mb-10 w-full max-w-[19rem]" aria-hidden>
          <div className="absolute inset-x-6 -bottom-3 h-14 rounded-[20px] bg-[#ecebf3]" />
          <div className="relative flex items-start gap-3 rounded-[20px] bg-white/90 p-3.5 text-left shadow-[0_20px_50px_-20px_rgba(40,30,100,.45)] ring-1 ring-black/[.06]">
            <img src={icon} alt="" className="h-10 w-10 shrink-0 rounded-[10px]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2"><span className="text-[14px] font-semibold">{student ? "Time to read" : nativeAppInfo().name}</span><span className="text-[12px] text-[#8e8b9c]">now</span></div>
              <p className="mt-0.5 text-[14px] leading-snug text-[#3d3a4b]">{student ? "Your next chapter is waiting. Even 10 minutes counts!" : "You have a new message."}</p>
            </div>
          </div>
        </div>
        <h1 className="text-[30px] font-bold leading-tight tracking-[-.02em] [text-wrap:balance]">{student ? "A reminder to read" : "Stay in the loop"}</h1>
        <p className="mt-3 max-w-[20rem] text-[17px] leading-snug text-[#6b6879] [text-wrap:balance]">{student ? "Pick a time and we'll nudge you every day. A little reading each day adds up." : "Get messages and updates from your class or your reader as they happen."}</p>
        {student && <label className="mt-6 flex items-center gap-3 rounded-[14px] bg-[#f4f3f8] px-4 py-2.5">
          <span className="text-[16px] font-medium">Every day at</span>
          {/* 17px: iPhone doesn't zoom when it's tapped; iOS shows its own time wheel. */}
          <input type="time" value={time} onChange={(e) => setTime(e.target.value || "18:00")} className="bg-transparent text-[17px] font-semibold text-[#5b4fe0] outline-none" data-testid="reader-time" />
        </label>}
        {note && <p role="status" className="mt-5 rounded-[12px] bg-[#f4f3f8] px-4 py-3 text-[14px] leading-snug text-[#3d3a4b]">{note}</p>}
      </div>
      <div className="shrink-0 space-y-2 pt-4">
        <button type="button" onClick={() => void allow()} disabled={busy} className={`${primary} bg-[#5b4fe0] shadow-[0_12px_28px_-12px_rgba(91,79,224,.8)]`} data-testid="reader-notify-allow"><Bell className="h-5 w-5" />{student ? "Remind me" : "Turn on notifications"}</button>
        <button type="button" onClick={() => setAsking(false)} className="h-12 w-full text-[16px] font-medium text-[#6b6879]" data-testid="reader-notify-later">Not now</button>
      </div>
    </div>
  </div>;

  const step = pages[i];
  const last = i === pages.length - 1;
  const next = () => (last ? close() : setI(i + 1));
  return <div className={shell} style={font} role="dialog" aria-modal="true" aria-label="How it works" data-testid="reader-tour"
    onTouchStart={(e) => { touch.current = e.touches[0]?.clientX ?? null; }}
    onTouchEnd={(e) => { const x = touch.current; touch.current = null; if (x == null) return; const dx = (e.changedTouches[0]?.clientX ?? x) - x; if (dx < -50) next(); else if (dx > 50) setI(Math.max(0, i - 1)); }}>
    <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-end px-4">{!last && <button type="button" onClick={close} className="h-11 px-2 text-[16px] font-medium text-[#6b6879]" data-testid="reader-tour-skip">Skip</button>}</div>
      <div key={step.id} className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="relative mb-10 grid h-44 w-44 place-items-center" aria-hidden>
          <span className="absolute inset-0 rounded-full opacity-25 blur-2xl" style={{ background: step.tint }} />
          <span className="absolute inset-5 rounded-[2.4rem] opacity-15" style={{ background: step.tint }} />
          <span className="relative grid h-24 w-24 place-items-center rounded-[1.6rem] text-white shadow-[0_18px_36px_-14px_rgba(0,0,0,.45)] [&_svg]:h-11 [&_svg]:w-11" style={{ background: `linear-gradient(160deg, ${step.tint}cc, ${step.tint})` }}>{step.icon}</span>
        </div>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-.02em] [text-wrap:balance]">{step.title}</h1>
        <p className="mt-3 max-w-[21rem] text-[16px] leading-[1.45] text-[#6b6879]">{step.body}</p>
      </div>
      <div className="shrink-0 px-6 pt-4">
        <div className="mb-5 flex justify-center gap-2" aria-label={`Page ${i + 1} of ${pages.length}`}>{pages.map((p, k) => <span key={p.id} className={`h-2 rounded-full transition-all duration-300 ${k === i ? "w-6 bg-[#111018]" : "w-2 bg-[#d6d4df]"}`} />)}</div>
        <button type="button" onClick={next} className={`${primary} bg-[#111018]`} data-testid="reader-tour-next">{last ? "Get started" : "Continue"}</button>
      </div>
    </div>
  </div>;
}
