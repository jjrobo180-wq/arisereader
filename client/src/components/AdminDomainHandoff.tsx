import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { TODO_APP, hubPathFor, isHubAccount, pendingHubTab } from "@/lib/hubs";

function HandoffScreen({ title, message, error, manualUrl, manualText }: {
  title: string;
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
      <h1 className="mt-5 text-2xl font-black tracking-tight">{title}</h1>
      <p className="mt-3 text-sm leading-7 text-slate-600">{error || message}</p>
      {error && <a href={manualUrl} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#5d53dc] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#4940c9]">
        {manualText} <ArrowRight size={18} />
      </a>}
      <p className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
        <CheckCircle2 size={14} /> Everything you saved stays in your account
      </p>
    </section>
  </main>;
}

const hubName = (user: { isAdmin?: boolean; role?: string } | null) => hubPathFor(user) === "/workhub" ? "Arise WorkHub" : "Arise LifeHub";

/** A teacher, parent, LifeHub account or administrator signed in on A.R.I.S.E. Reader: carry the
 *  sign-in over to arisetodo.com with a one-use code and open their hub there. */
export function ReaderToHubHandoff() {
  const { user, token } = useAuth();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token || !isHubAccount(user)) {
      setError("Please sign in on arisetodo.com to open your hub.");
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
          throw new Error(data?.message || "We couldn't carry your sign-in over automatically.");
        }
        const tab = pendingHubTab();
        const tabPart = /^[a-z0-9-]{1,24}$/.test(tab) ? `&tab=${tab}` : "";
        if (active) window.location.replace(`${TODO_APP}#/admin-handoff?code=${data.code}${tabPart}`);
      } catch (err) {
        if (active) setError((err instanceof Error && err.message) || "Couldn't open your hub automatically.");
      }
    })();
    return () => { active = false; };
  }, [token, user?.id, user?.isAdmin, user?.role]);

  return <HandoffScreen
    title={hubName(user)}
    message={`Opening ${hubName(user)}…`}
    error={error}
    manualUrl={`${TODO_APP}#/signin`}
    manualText="Sign in on arisetodo.com"
  />;
}

/** Kept for older imports: the administrator's version is now the same handoff. */
export const ReaderAdminToTodoRedirect = ReaderToHubHandoff;

/** Redeem the short-lived one-use code on the To-Do domain itself, then open the right hub. */
export function TodoAdminHandoff() {
  const { completeAdminHandoff } = useAuth();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = window.location.hash.match(/[?&]code=([a-f0-9]{64})(?:&|$)/)?.[1];
    const tab = window.location.hash.match(/[?&]tab=([a-z0-9-]{1,24})(?:&|$)/)?.[1] || "";
    // Remove the one-use code from the browser's visible URL immediately,
    // without disrupting the current React route until redemption completes.
    window.history.replaceState(null, "", window.location.pathname + "#/admin-handoff");
    if (!code) {
      setError("This sign-in link is missing or expired. Please sign in again.");
      return;
    }
    let active = true;
    completeAdminHandoff(code)
      .then((signedIn) => {
        if (!active) return;
        const to = hubPathFor(signedIn);
        try {
          if (tab) sessionStorage.setItem(to === "/workhub" ? "workhub_tab" : "lifehub_tab", tab);
          else if (signedIn.role === "teacher") sessionStorage.setItem("workhub_tab", "overview");
          else if (signedIn.role === "parent") sessionStorage.setItem("lifehub_tab", "home");
          localStorage.setItem("arise-hub-rail", "open");
          localStorage.setItem("arise-life-rail", "open");
        } catch { /* the hub opens on its usual first tab */ }
        window.location.replace(`/app#${to}`);
      })
      .catch(err => {
        if (active) setError((err instanceof Error && err.message) || "Please sign in again.");
      });
    return () => { active = false; };
  }, [completeAdminHandoff]);

  return <HandoffScreen
    title="A.R.I.S.E."
    message="Opening your hub…"
    error={error}
    manualUrl="/app#/signin"
    manualText="Go to sign in"
  />;
}
