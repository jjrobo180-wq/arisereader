import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CameraOff, Loader2, Maximize2, Minimize2, RotateCcw, WifiOff } from "lucide-react";
import type { NoProctorMonitor } from "@/lib/noProctorMonitor";
import "./noproctor.css";

/** The live camera picture in the corner during a no-proctor quiz. Snapshots are taken from it. */
export function CameraBubble({ monitor, cameraOn }: { monitor: NoProctorMonitor; cameraOn: boolean }) {
  const [small, setSmall] = useState(false);
  const attach = useCallback((video: HTMLVideoElement | null) => monitor.attachVideo(video), [monitor]);
  const isSmall = small && cameraOn;

  return (
    <aside className={"np-bubble" + (isSmall ? " small" : "") + (cameraOn ? "" : " off")} aria-label="Your camera">
      <div className="np-bubble-view">
        <video ref={attach} muted playsInline autoPlay aria-hidden="true" />
        {!cameraOn && <div className="np-bubble-offview"><CameraOff /></div>}
        {cameraOn && (
          <button
            type="button"
            className="np-bubble-size"
            onClick={() => setSmall((s) => !s)}
            aria-label={isSmall ? "Make the camera picture bigger" : "Make the camera picture smaller"}
          >
            {isSmall ? <Maximize2 /> : <Minimize2 />}
          </button>
        )}
      </div>
      {!isSmall && (
        <div className="np-bubble-status">
          {cameraOn ? <><i className="np-bubble-dot" /> Camera on</> : <><CameraOff /> Camera off</>}
        </div>
      )}
    </aside>
  );
}

/** The reminder above the questions. */
export function OnYourOwnStrip({ warningUsed }: { warningUsed: boolean }) {
  return (
    <div className={"np-strip" + (warningUsed ? " warned" : "")} role="status">
      {warningUsed ? <AlertTriangle /> : <Camera />}
      <span>
        {warningUsed
          ? "You've used your one warning. Leaving this page again turns the quiz in."
          : "You're taking this quiz on your own. Stay on this page until you turn it in."}
      </span>
    </div>
  );
}

function awayFor(ms: number) {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return `${s} ${s === 1 ? "second" : "seconds"}`;
  const m = Math.round(s / 60);
  return `about ${m} ${m === 1 ? "minute" : "minutes"}`;
}

/** Keeps keyboard focus inside a dialog and puts it on the main button when it opens. */
function useDialogFocus() {
  const boxRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    mainRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !boxRef.current) return;
      const items = Array.from(boxRef.current.querySelectorAll<HTMLElement>("button:not(:disabled)"));
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return { boxRef, mainRef };
}

/** Shown when the student comes back after leaving the quiz the first time. */
export function LeaveWarning({ awayMs, onClose }: { awayMs: number; onClose: () => void }) {
  const { boxRef, mainRef } = useDialogFocus();
  return (
    <div className="np-modal-backdrop">
      <div ref={boxRef} className="np-modal warn" role="alertdialog" aria-modal="true" aria-labelledby="np-warn-title" aria-describedby="np-warn-text">
        <span className="np-modal-icon"><AlertTriangle /></span>
        <h2 id="np-warn-title">You left the quiz</h2>
        <p id="np-warn-text">This is your one warning. <b>If you leave again, your quiz is turned in</b> with the answers you have so far.</p>
        <p>You were away for {awayFor(awayMs)}.</p>
        <button ref={mainRef} type="button" className="np-btn np-btn-amber" onClick={onClose} data-testid="button-back-to-quiz">
          Back to my quiz
        </button>
      </div>
    </div>
  );
}

/** Shown when the camera stops in the middle of the quiz. */
export function CameraOffDialog({ onRestart, onTurnIn }: { onRestart: () => Promise<void>; onTurnIn: () => void }) {
  const { boxRef, mainRef } = useDialogFocus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const restart = async () => {
    setBusy(true);
    setError("");
    try { await onRestart(); } catch (e: any) { setError(e?.message || "The camera didn't start. Try again."); } finally { setBusy(false); }
  };
  return (
    <div className="np-modal-backdrop">
      <div ref={boxRef} className="np-modal warn" role="alertdialog" aria-modal="true" aria-labelledby="np-cam-title" aria-describedby="np-cam-text">
        <span className="np-modal-icon"><CameraOff /></span>
        <h2 id="np-cam-title">Your camera turned off</h2>
        <p id="np-cam-text">Turn it back on to keep going with the quiz.</p>
        {error && <div className="np-error" role="alert">{error}</div>}
        <button ref={mainRef} type="button" className="np-btn np-btn-primary" disabled={busy} onClick={() => void restart()}>
          <Camera /> {busy ? "Starting camera…" : "Turn camera on"}
        </button>
        <button type="button" className="np-link" onClick={onTurnIn}>Turn in my quiz now</button>
      </div>
    </div>
  );
}

/** Asked when the student taps Back during a no-proctor quiz. */
export function StopDialog({ onKeepGoing, onStop }: { onKeepGoing: () => void; onStop: () => void }) {
  const { boxRef, mainRef } = useDialogFocus();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onKeepGoing(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onKeepGoing]);
  return (
    <div className="np-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onKeepGoing(); }}>
      <div ref={boxRef} className="np-modal" role="dialog" aria-modal="true" aria-labelledby="np-stop-title" aria-describedby="np-stop-text">
        <span className="np-modal-icon"><RotateCcw /></span>
        <h2 id="np-stop-title">Stop this quiz?</h2>
        <p id="np-stop-text">Your answers won't be saved, so you'll start over next time. Your teacher can see that you started it.</p>
        <button ref={mainRef} type="button" className="np-btn np-btn-primary" onClick={onKeepGoing}>Keep going</button>
        <button type="button" className="np-link" onClick={onStop} data-testid="button-stop-quiz">Stop the quiz</button>
      </div>
    </div>
  );
}

/** Covers the quiz while it's being turned in automatically (after the second leave). */
export function TurningIn({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const { boxRef, mainRef } = useDialogFocus();
  return (
    <div className="np-modal-backdrop">
      <div ref={boxRef} className={"np-modal" + (failed ? " warn" : "")} role="alertdialog" aria-modal="true" aria-labelledby="np-turnin-title" aria-describedby="np-turnin-text">
        <span className="np-modal-icon">{failed ? <WifiOff /> : <Loader2 className="np-spin" />}</span>
        <h2 id="np-turnin-title">{failed ? "Your quiz didn't go through" : "Turning in your quiz"}</h2>
        <p id="np-turnin-text">
          {failed
            ? "Check your internet connection, then try again. Your answers are kept."
            : "You left the quiz a second time, so it's being turned in with the answers you have."}
        </p>
        {failed && <button ref={mainRef} type="button" className="np-btn np-btn-amber" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  );
}

/** On the result screen when the quiz was turned in automatically. */
export function AutoTurnInNote() {
  return (
    <div className="np-note" role="status">
      <AlertTriangle />
      <span>This quiz was turned in automatically because you left it a second time. It was graded with the answers you had.</span>
    </div>
  );
}
