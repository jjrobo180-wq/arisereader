import { useEffect, useState } from "react";
import { Camera, CheckCircle2, ShieldCheck, Users, UserPlus, XCircle, ClipboardX } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import "@/components/noproctor.css";

type Info = { studentName: string; status: "none" | "pending" | "approved" | "declined"; signupUrl: string };

/** Where a parent lands from the "camera quizzes" email: approve or say no, no account needed. */
export default function QuizPermission() {
  const [token, setToken] = useState("");
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let t = "";
    try {
      const query = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "";
      t = new URLSearchParams(query).get("token") || "";
    } catch {}
    setToken(t);
    if (!t) { setError("This link is missing its code. Open the link from the email again."); return; }
    fetch(`${API_BASE}/api/quiz-permission/${encodeURIComponent(t)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Could not open this request.");
        setInfo(data);
      })
      .catch((e) => setError(e?.message || "Could not open this request."));
  }, []);

  const decide = async (approve: boolean) => {
    setBusy(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/quiz-permission/${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approve }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not save your answer.");
      setInfo((i) => (i ? { ...i, status: data.status } : i));
    } catch (e: any) { setError(e?.message || "Could not save your answer."); }
    finally { setBusy(false); }
  };

  const name = info?.studentName || "Your student";
  const signup = info?.signupUrl ? (
    <div className="np-ask">
      <h2>Follow {name}'s reading</h2>
      <p>Create a free parent account to see {name}'s progress and quiz pictures, and to get your own Parent Proctor Code for quizzes you sit in on.</p>
      <a className="np-btn" href={info.signupUrl}><UserPlus /> Create a parent account</a>
    </div>
  ) : null;

  return (
    <div className="np-gate">
      <div className="np-card">
        {!info && !error && <p className="np-lead">Loading…</p>}
        {error && !info && <p className="np-error" role="alert">{error}</p>}

        {info && (info.status === "pending" || info.status === "none") && (
          <>
            <h1>{name} is asking to take quizzes with the camera</h1>
            <p className="np-lead">On A.R.I.S.E. Reader, students can take book quizzes on their own instead of with a proctor. Here's how those quizzes work:</p>
            <ul className="np-rules">
              <li><Camera /><span>The camera stays on and takes pictures at random times, and whenever {name} leaves the quiz.</span></li>
              <li><ShieldCheck /><span>Leaving the quiz once gets a warning. Leaving again turns the quiz in.</span></li>
              <li><ClipboardX /><span>Copy and paste are turned off.</span></li>
              <li><Users /><span>{name}'s teacher, their parent and the site admin can see the pictures. They're deleted after 30 days.</span></li>
            </ul>
            {error && <p className="np-error" role="alert">{error}</p>}
            <button type="button" className="np-btn np-btn-primary" disabled={busy} onClick={() => void decide(true)} data-testid="button-approve-camera">
              <CheckCircle2 /> {busy ? "Saving…" : `Yes, ${name} can take camera quizzes`}
            </button>
            <button type="button" className="np-link" disabled={busy} onClick={() => void decide(false)}><XCircle /> No, don't allow it</button>
            {signup}
          </>
        )}

        {info?.status === "approved" && (
          <>
            <h1>You said yes</h1>
            <p className="np-ok-line" role="status">{name} can now take book quizzes on their own with the camera on. Tell {name} to tap "Check again" on the quiz screen.</p>
            {signup}
          </>
        )}

        {info?.status === "declined" && (
          <>
            <h1>You said no</h1>
            <p className="np-lead">{name} can't take camera quizzes. They can still take quizzes with a parent or teacher as the proctor. Changed your mind?</p>
            <button type="button" className="np-btn" disabled={busy} onClick={() => void decide(true)}><CheckCircle2 /> Allow camera quizzes</button>
            {signup}
          </>
        )}
      </div>
    </div>
  );
}
