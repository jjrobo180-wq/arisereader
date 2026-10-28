import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Clock3, KeyRound, ClipboardX, ShieldCheck, Users, RotateCcw, PenLine, Mail, RefreshCw } from "lucide-react";
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

type View = "choose" | "code" | "camera" | "askCamera";

/** What a parent has allowed (GET /api/student/quiz-permission). */
type Permission = { camera: "none" | "pending" | "approved" | "declined"; cameraEmail: string; codesWaiting: number; parentLinked: boolean };

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
  const [perm, setPerm] = useState<Permission | null>(null);
  const [parentEmail, setParentEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [askError, setAskError] = useState("");
  const [askNote, setAskNote] = useState("");
  const [showCodeAsk, setShowCodeAsk] = useState(false);

  const loadPermission = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/student/quiz-permission`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) setPerm(await res.json());
    } catch {}
  };
  useEffect(() => { if (authToken) void loadPermission(); }, [authToken]);

  // "On my own" needs a parent's yes first (a try that's already going can carry on).
  const chooseCamera = () => {
    setAskError(""); setAskNote("");
    setView(resume || !perm || perm.camera === "approved" ? "camera" : "askCamera");
  };
  const chooseCode = () => { setAskError(""); setAskNote(""); setShowCodeAsk(false); setView("code"); };

  const emailParent = async (kind: "camera" | "code") => {
    setSending(true); setAskError(""); setAskNote("");
    try {
      const res = await fetch(`${API_BASE}/api/student/quiz-permission/${kind}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: parentEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not send the email. Try again.");
      if (kind === "camera") {
        if (data.camera === "approved") { await loadPermission(); setView("camera"); return; }
        setPerm((p) => ({ ...(p || { codesWaiting: 0, parentLinked: false }), camera: "pending", cameraEmail: data.cameraEmail || "" }));
      } else {
        setAskNote(`Sent to ${data.sentTo || "your parent"}. Have your parent sit with you and type the code from the email here. It works for one quiz.`);
        setShowCodeAsk(false);
      }
      setParentEmail("");
    } catch (e: any) {
      setAskError(e?.message || "Could not send the email. Try again.");
    } finally { setSending(false); }
  };

  const checkAgain = async () => {
    setSending(true); setAskError("");
    await loadPermission();
    setSending(false);
  };
  useEffect(() => {
    if (view === "askCamera" && perm?.camera === "approved") setView("camera");
  }, [view, perm]);

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
      if (data.needsParentPermission) { setBusy(false); await loadPermission(); setView("askCamera"); return; }
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
  const backTo: View | null = view === "code" ? (resume ? "camera" : "choose") : (view === "camera" || view === "askCamera") && !resume ? "choose" : null;

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
            <p className="np-bonus"><b>NEW!</b> Either way, you can write about the book at the end for up to {COMPREHENSION.bonusPoints} extra points.</p>
            <div className="np-options">
              <button type="button" className="np-option" onClick={chooseCode}>
                <span className="np-option-icon"><KeyRound /></span>
                <b>With a proctor</b>
                <span>{perm && !perm.parentLinked ? "A teacher types their code, or your parent gets a one-time code by email." : "A parent or teacher types their proctor code."}</span>
              </button>
              <button type="button" className="np-option np-option-camera" onClick={chooseCamera}>
                <span className="np-option-icon"><Camera /></span>
                <b>On my own</b>
                <span>{perm && perm.camera !== "approved" ? "A parent says yes by email first. Then your camera stays on and takes pictures." : "Your camera stays on and takes pictures at random times."}</span>
              </button>
            </div>
          </>
        )}

        {view === "code" && (
          <>
            <h1>Enter the proctor code</h1>
            <p className="np-lead">Ask your linked parent or guardian, or a teacher, to type their private proctor code.</p>
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
            {askNote && <p className="np-ok-line" role="status">{askNote}</p>}
            {perm && (showCodeAsk || (!perm.parentLinked && !askNote)) ? (
              <div className="np-ask">
                <h2>Your parent doesn't have a code yet?</h2>
                <p>Type their email. We'll send them a one-time code for this quiz, and a link to create a free parent account so they get their own code for next time.</p>
                {askError && <p className="np-error" role="alert">{askError}</p>}
                <input type="email" className="np-input" placeholder="Parent or guardian's email" value={parentEmail} autoComplete="off"
                  onChange={(e) => setParentEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && parentEmail) void emailParent("code"); }}
                  data-testid="input-parent-email-code" />
                <button type="button" className="np-btn" disabled={!parentEmail.trim() || sending} onClick={() => void emailParent("code")} data-testid="button-email-parent-code">
                  <Mail /> {sending ? "Sending…" : "Email my parent a code"}
                </button>
              </div>
            ) : perm && (
              <button type="button" className="np-link" onClick={() => { setAskNote(""); setShowCodeAsk(true); }}><Mail /> Email my parent a one-time code</button>
            )}
            <button type="button" className="np-link" onClick={chooseCamera}><Camera /> No proctor? Take it on your own with the camera</button>
          </>
        )}

        {view === "askCamera" && perm && (
          <>
            <h1>Ask a parent first</h1>
            <p className="np-lead">To take quizzes on your own with the camera, a parent or guardian has to say yes. Type their email and we'll send them a request. They can approve it and create a free parent account.</p>
            {perm.camera === "pending" && (
              <p className="np-warn-line" role="status">Waiting for {perm.cameraEmail || "your parent"} to say yes. Once they approve, tap "Check again".</p>
            )}
            {perm.camera === "declined" && (
              <p className="np-error" role="status">Your parent said no to camera quizzes. You can still take the quiz with a proctor.</p>
            )}
            {perm.camera === "pending" && (
              <button type="button" className="np-btn np-btn-primary" disabled={sending} onClick={() => void checkAgain()} data-testid="button-check-permission">
                <RefreshCw /> {sending ? "Checking…" : "Check again"}
              </button>
            )}
            <div className="np-ask">
              <h2>{perm.camera === "none" ? "Your parent's email" : "Send it again, or to someone else"}</h2>
              {askError && <p className="np-error" role="alert">{askError}</p>}
              <input type="email" className="np-input" placeholder="Parent or guardian's email" value={parentEmail} autoComplete="off" autoFocus={perm.camera === "none"}
                onChange={(e) => setParentEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && parentEmail) void emailParent("camera"); }}
                data-testid="input-parent-email-camera" />
              <button type="button" className={"np-btn" + (perm.camera === "none" ? " np-btn-primary" : "")} disabled={!parentEmail.trim() || sending} onClick={() => void emailParent("camera")} data-testid="button-ask-parent-camera">
                <Mail /> {sending ? "Sending…" : "Ask my parent"}
              </button>
            </div>
            <button type="button" className="np-link" onClick={chooseCode}><KeyRound /> Use a proctor code instead</button>
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
                <li><Camera /><span>Your camera takes pictures at random times, and whenever you leave the quiz.</span></li>
                <li><ShieldCheck /><span>Stay on this screen until you turn the quiz in. Leaving once gets a warning. Leaving again turns the quiz in with the answers you have.</span></li>
                <li><ClipboardX /><span>Copy and paste are turned off.</span></li>
                <li><Users /><span>Your teacher, your parent and the site admin can see the pictures. They're deleted after 30 days.</span></li>
                <li><PenLine /><span>At the end you can write about the book for up to {COMPREHENSION.bonusPoints} extra points.</span></li>
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
            <button type="button" className="np-link" onClick={chooseCode}><KeyRound /> Use a proctor code instead</button>
          </>
        )}

        <button type="button" className="np-back" onClick={() => (backTo ? setView(backTo) : onBack())}>
          <ArrowLeft /> {backTo ? "Back" : "Back to Library"}
        </button>
      </div>
    </div>
  );
}
