// Class Goal Board (WorkHub app, opens at #/class-goal): a goal the class works toward, shown big on
// the classroom board for students. The teacher sets the goal and the reward, then adds points from
// the same screen or from their phone, and the board updates by itself. See shared/classGoals.ts.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ymd, type Goal } from "@shared/classGoals";
import BoardView from "@/components/classGoal/BoardView";
import TeacherPanel from "@/components/classGoal/TeacherPanel";
import { useClassGoals } from "@/components/classGoal/useClassGoals";
import "./classGoal.css";

const SOUND_KEY = "arise-class-goal-sound";
const readSound = () => { try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; } };

export default function ClassGoalBoard() {
  const { user, token } = useAuth();
  const { state, link, send, retry } = useClassGoals(user?.id, token);
  const [today, setToday] = useState(() => ymd(new Date()));
  const [open, setOpen] = useState(() => typeof window !== "undefined" && window.innerWidth < 700);
  const [sound, setSoundState] = useState(readSound);
  const setSound = useCallback((on: boolean) => { setSoundState(on); try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch { /* fine */ } }, []);

  // The date rolls over at midnight even if the board is left on overnight.
  useEffect(() => {
    const t = window.setInterval(() => setToday(ymd(new Date())), 30_000);
    const wake = () => setToday(ymd(new Date()));
    document.addEventListener("visibilitychange", wake);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", wake); };
  }, []);

  // Keep the screen awake while the board is up.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const ask = async () => { try { if (!document.hidden && !lock) { lock = await (navigator as any).wakeLock?.request("screen"); (lock as any)?.addEventListener?.("release", () => { lock = null; }); } } catch { lock = null; } };
    void ask();
    document.addEventListener("visibilitychange", ask);
    return () => { document.removeEventListener("visibilitychange", ask); void lock?.release().catch(() => {}); };
  }, []);

  useEffect(() => { document.title = "Class Goal Board | A.R.I.S.E."; }, []);

  const goal: Goal | null = useMemo(() => state?.goals.find((g) => g.id === state.boardId) ?? state?.goals[0] ?? null, [state]);
  const close = useCallback(() => setOpen(false), []);
  const openControls = useCallback(() => setOpen(true), []);

  if (!state) {
    return (
      <div className="cg-root cg-center">
        {link === "error" || link === "offline" || link === "signin"
          ? <div className="cg-message"><h1>{link === "signin" ? "Sign in to see your class goal" : "Couldn't load your class goal"}</h1><p>{link === "signin" ? "Your sign-in ran out." : "Check your connection and try again."}</p>{link === "signin" ? <a className="cg-btn cg-btn-main" href="#/signin">Sign in</a> : <button type="button" className="cg-btn cg-btn-main" onClick={retry}>Try again</button>}<a className="cg-btn cg-btn-quiet" href="#/workhub">Back to WorkHub</a></div>
          : <div className="cg-loading" role="status"><span className="cg-spinner" aria-hidden />Loading your class goal…</div>}
      </div>
    );
  }

  // Nothing to show to students yet: the setup is the whole page.
  if (!goal) {
    return <div className="cg-root cg-setup"><TeacherPanel state={state} goal={null} today={today} link={link} send={send} retry={retry} sound={sound} setSound={setSound} onClose={close} fullBleed /></div>;
  }

  return (
    <div className="cg-root">
      <BoardView goal={goal} today={today} sound={sound} onOpenControls={openControls} />
      {open && <TeacherPanel state={state} goal={goal} today={today} link={link} send={send} retry={retry} sound={sound} setSound={setSound} onClose={close} />}
      {!open && link !== "saved" && link !== "loading" && <span className={"cg-dot is-" + link} title={link === "offline" ? "No connection" : "Not saved yet"} aria-hidden />}
    </div>
  );
}
