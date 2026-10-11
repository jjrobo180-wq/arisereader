import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

const todoWorkHub = "https://arisetodo.com/app#/workhub";
const todoSignIn = "https://arisetodo.com/app#/signin";

function HandoffScreen({ message, error, manualUrl, manualText }: {
  message: string;
  error: string;
  manualUrl: string;
  manualText: string;
}) {
  return <main className="flex min-h-[100dvh] items-center justify-center bg-[#f7f8ff] p-5 text-slate-900">
    <section className="w-full max-w-md rounded-[26px] border border-[#e6e5f7] bg-white p-8 text-center shadow-[0_20px_80px_#35337c15]" role="status">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#eceaff] text-[#6055dc]">
        {error ? <ShieldCheck size={30} /> : <LoaderCircle size={32} className="animate-spin" />}
      </span>
      <h1 className="mt-5 text-2xl font-black tracking-tight">A.R.I.S.E. WorkHub</h1>
      <p className="mt-3 text-sm leading-7 text-slate-600">{error || message}</p>
      <a href={manualUrl} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#5d53dc] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#4940c9]">
        {manualText} <ArrowRight size={18} />
      </a>
      <p className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
        <CheckCircle2 size={14} /> Your existing WorkHub data stays in your account
      </p>
    </section>
  </main>;
}

/** Bridge a signed-in Reader administrator into their To-Do WorkHub. */
export function ReaderAdminToTodoRedirect() {
  const { user, token } = useAuth();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token || !user?.isAdmin) {
      setError("Please sign in with your administrator account on A.R.I.S.E. To-Do.");
      return;
    }
    let active = true;
    (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/admin-handoff/start`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !/^[a-f0-9]{64}$/.test(String(data?.code || ""))) {
          throw new Error(data?.message || "We couldn't transfer the sign-in automatically.");
        }
        if (active) window.location.replace(`https://arisetodo.com/app#/admin-handoff?code=${data.code}`);
      } catch (err) {
        if (active) setError((err instanceof Error && err.message) || "Couldn't open WorkHub automatically.");
      }
    })();
    return () => { active = false; };
  }, [token, user?.id, user?.isAdmin]);

  return <HandoffScreen
    message="Signing you in securely and opening your administrator WorkHub…"
    error={error}
    manualUrl={todoSignIn}
    manualText="Sign in on arisetodo.com"
  />;
}

/** Redeem the short-lived one-use code on the To-Do domain itself. */
export function TodoAdminHandoff() {
  const { completeAdminHandoff } = useAuth();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = window.location.hash.match(/[?&]code=([a-f0-9]{64})(?:&|$)/)?.[1];
    // Remove the one-use code from the browser's visible URL immediately,
    // without disrupting the current React route until redemption completes.
    window.history.replaceState(null, "", window.location.pathname + "#/admin-handoff");
    if (!code) {
      setError("This sign-in link is missing or expired. Please sign in normally.");
      return;
    }
    let active = true;
    completeAdminHandoff(code)
      .then(() => {
        if (!active) return;
        try { sessionStorage.setItem("workhub_tab", "admin"); } catch { /* Home tab is still accessible. */ }
        window.location.replace("/app#/workhub");
      })
      .catch(err => {
        if (active) setError((err instanceof Error && err.message) || "Please sign in again.");
      });
    return () => { active = false; };
  }, [completeAdminHandoff]);

  return <HandoffScreen
    message="Opening your A.R.I.S.E. WorkHub administrator account…"
    error={error}
    manualUrl="/app#/signin"
    manualText="Sign in manually"
  />;
}
