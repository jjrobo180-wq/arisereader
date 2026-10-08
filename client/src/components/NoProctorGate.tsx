import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Clock3, KeyRound, ClipboardX, ShieldCheck, Users, RotateCcw, PenLine } from "lucide-react";
import { COMPREHENSION } from "@shared/comprehension";
import { API_BASE } from "@/lib/queryClient";
import { CAMERA_CONSTRAINTS, cameraErrorMessage, canUseCamera } from "@/lib/noProctorMonitor";
import "./noproctor.css";

export type CameraSession = {
  stream: MediaStream;
  token: string;
  startedAt: number;
  snapshotEveryMs: number;
  leavesBeforeTurnIn: number;
  leaves: number;
  restarts: number;
  resumed: boolean;
};

type Props = {
  book: { title: string; author: string; coverUrl: string | null } | null;
  questionCount: number;
  quizId: number;
  authToken: string | null;
  /** A try that was interrupted by a reload, to pick up instead of starting over. */
  resume: { token: string; leaves: number; startedAt: number; snapshotEveryMs: number; leavesBeforeTurnIn: number } | null;
  proctorError: string;
  proctorLoading: boolean;
  onVerifyCode: (code: string) => void;
  onCameraReady: (session: CameraSession) => void;
  onBack: () => void;
};

type View = "choose" | "code" | "camera";

/**
 * The screen before a book quiz: take it with a proctor code, or on your own with the camera on.
 */
export default function NoProctorGate({ book, questionCount, quizId, authToken, resume, proctorError, proctorLoading, onVerifyCode, onCameraReady, onBack }: Props) {
  const [view, setView] = useState<View>(resume ? "camera" : "choose");
  const [code, setCode] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const handedOff = useRef(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => {});
    }
  }, [stream, view]);
  // Turn the camera off again if the student backs out before starting.
  useEffect(() => () => { if (!handedOff.current) stream?.getTracks().forEach((t) => t.stop()); }, [stream]);

  const turnOnCamera = async () => {
    setError("");
    if (!canUseCamera()) { setError("This browser can't use a camera here. Take the quiz with a proctor code, or try another browser."); return; }
    setBusy(true);
    try {
      setStream(await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS));
    } catch (e) {
      setError(cameraErrorMessage(e));
    } finally { setBusy(false); }
  };

  const begin = async () => {
    if (!stream) return;
    setBusy(true); setError("");
    try {
      if (resume) {
        handedOff.current = true;
        onCameraReady({ stream, token: resume.token, startedAt: resume.startedAt, snapshotEveryMs: resume.snapshotEveryMs, leavesBeforeTurnIn: resume.leavesBeforeTurnIn, leaves: resume.leaves, restarts: 0, resumed: true });
        return;
      }
      const res = await fetch(`${API_BASE}/api/integrity/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ quizKind: "book", quizId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not start the quiz. Try again.");
      handedOff.current = true;
      onCameraReady({
        // Timing is measured with this device's clock from the moment the try starts.
        stream, token: data.token, startedAt: Date.now(),
        snapshotEveryMs: data.snapshotEveryMs || 30_000, leavesBeforeTurnIn: data.leavesBeforeTurnIn || 2,
        leaves: 0, restarts: Number(data.restarts) || 0, resumed: false,
      });
    } catch (e: any) {
      setError(e?.message || "Could not start the quiz. Try again.");
      setBusy(false);
    }
  };

  // Where the Back button goes; null means back to the library.
  const backTo: View | null = view === "code" ? (resume ? "camera" : "choose") : view === "camera" && !resume ? "choose" : null;

  const header = (
    <div className="np-book">
      <div className="np-cover">{book?.coverUrl ? <img src={book.coverUrl} alt="" /> : <span>{book?.title?.slice(0, 1) || "?"}</span>}</div>
      <div className="np-book-text">
        <b>{book?.title}</b>
        <span>by {book?.author}</span>
        <em>{questionCount} questions</em>
      </div>
    </div>
  );

  return (
    <div className="np-gate">
      <div className="np-card">
        {header}

        {view === "choose" && (
          <>
            <h1>How do you want to take this quiz?</h1>
            <div className="np-options">
              <button type="button" className="np-option" onClick={() => setView("code")}>
                <span className="np-option-icon"><KeyRound /></span>
                <b>With a proctor</b>
                <span>A parent or teacher types their proctor code.</span>
                <em className="np-bonus">Write about the book for up to {COMPREHENSION.bonusPoints} extra points</em>
              </button>
              <button type="button" className="np-option np-option-camera" onClick={() => setView("camera")}>
                <span className="np-option-icon"><Camera /></span>
                <b>On my own</b>
                <span>Your camera stays on and takes a picture every 30 seconds.</span>
              </button>
            </div>
          </>
        )}

        {view === "code" && (
          <>
            <h1>Enter the proctor code</h1>
            <p className="np-lead">Ask your linked parent or guardian, or a teacher, to type their private proctor code. With a proctor you can also write about the book for up to {COMPREHENSION.bonusPoints} extra points.</p>
            {proctorError && <p className="np-error" role="alert">{proctorError}</p>}
            <input
              type="password"
              className="np-input"
              placeholder="Parent or teacher proctor code"
              value={code}
              autoFocus
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && code) onVerifyCode(code); }}
              data-testid="input-proctor-password"
            />
            <button type="button" className="np-btn np-btn-primary" disabled={!code || proctorLoading} onClick={() => onVerifyCode(code)} data-testid="button-verify-proctor">
              {proctorLoading ? "Checking…" : "Unlock quiz"}
            </button>
            <button type="button" className="np-link" onClick={() => setView("camera")}><Camera /> No proctor? Take it on your own with the camera</button>
          </>
        )}

        {view === "camera" && (
          <>
            <h1>{resume ? "Pick up where you left off" : "Taking the quiz on your own"}</h1>
            {resume && (
              <p className={resume.leaves >= 1 ? "np-warn-line" : "np-lead"} role="status">
                {resume.leaves >= 1
                  ? "Leaving the page used your one warning. If you leave the quiz again, it's turned in with the answers you have."
                  : "Your answers so far are saved. Turn your camera on to keep going."}
              </p>
            )}
            <div className="np-setup">
              <div className={"np-preview" + (stream ? " live" : "")}>
                {stream ? <video ref={videoRef} muted playsInline autoPlay aria-label="Your camera picture" /> : (
                  <div className="np-preview-empty"><Camera /><span>Your camera picture shows here</span></div>
                )}
                {stream && <span className="np-rec"><i /> Camera on</span>}
              </div>
              <ul className="np-rules">
                <li><Camera /><span>Your camera takes a picture every 30 seconds and whenever you leave the quiz.</span></li>
                <li><ShieldCheck /><span>Stay on this screen until you turn the quiz in. Leaving once gets a warning. Leaving again turns the quiz in with the answers you have.</span></li>
                <li><ClipboardX /><span>Copy and paste are turned off.</span></li>
                <li><Users /><span>Your teacher, your parent and the site admin can see the pictures. They're deleted after 30 days.</span></li>
                <li><PenLine /><span>Writing about the book for up to {COMPREHENSION.bonusPoints} extra points is only with a proctor code, not on your own.</span></li>
              </ul>
            </div>
            {error && <p className="np-error" role="alert">{error}</p>}
            {!stream ? (
              <button type="button" className="np-btn np-btn-primary" disabled={busy} onClick={() => void turnOnCamera()}>
                <Camera /> {busy ? "Starting camera…" : "Turn on camera"}
              </button>
            ) : (
              <>
                <label className="np-check">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                  <span>I understand, and I'm ready to start.</span>
                </label>
                <button type="button" className="np-btn np-btn-primary" disabled={!agreed || busy} onClick={() => void begin()} data-testid="button-start-no-proctor">
                  {resume ? <><RotateCcw /> Keep going</> : <><Clock3 /> {busy ? "Starting…" : "Start the quiz"}</>}
                </button>
              </>
            )}
            <button type="button" className="np-link" onClick={() => setView("code")}><KeyRound /> Use a proctor code instead</button>
          </>
        )}

        <button type="button" className="np-back" onClick={() => (backTo ? setView(backTo) : onBack())}>
          <ArrowLeft /> {backTo ? "Back" : "Back to Library"}
        </button>
      </div>
    </div>
  );
}
