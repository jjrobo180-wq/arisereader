import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Link2, Mail, Send, ShieldCheck, UserRoundPlus, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

type ParentConnection = {
  linked: boolean;
  parentCount?: number;
  code?: string;
  signupUrl?: string;
  message?: string;
};

export default function ParentConnectionBanner() {
  const { token } = useAuth();
  const [status, setStatus] = useState<ParentConnection | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const authHeaders = useMemo(() => token ? { Authorization: `Bearer ${token}` } : {}, [token]);

  const refresh = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/student/parent-connection`, {
        headers: authHeaders,
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data);
      if (data.linked) setExpanded(false);
    } catch {}
  };

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [token]);

  const copy = async (kind: "code" | "link", value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {}
  };

  const sendInvite = async () => {
    if (!email.trim() || !token) return;
    setSending(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/student/parent-invite-email`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.message || "Could not send the invitation.");
        return;
      }
      setMessage("Invitation sent.");
      setEmail("");
    } catch {
      setMessage("Could not send the invitation.");
    } finally {
      setSending(false);
    }
  };

  if (!status || status.linked) return null;

  return (
    <aside className="fixed inset-x-3 bottom-3 z-[240] mx-auto max-w-3xl overflow-hidden rounded-[1.35rem] border border-violet-400/25 bg-[#151326]/98 text-white shadow-[0_28px_90px_rgba(0,0,0,.48)] ring-1 ring-white/[.04] backdrop-blur-xl sm:bottom-5">
      <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-cyan-400 shadow-lg shadow-violet-500/15">
          <UserRoundPlus className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black tracking-[-.015em]">Connect a parent or guardian to unlock quizzes</p>
          <p className="mt-0.5 hidden text-sm font-semibold text-slate-300 sm:block">
            They’ll get their own Parent Proctor Code after connecting to your account.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="shrink-0 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-3.5 py-2 text-xs font-black text-white"
        >
          {expanded ? "Close" : "Connect"}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-violet-400/20 bg-[#0d0b1a] p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-violet-400/20 bg-[#19152b] p-4 shadow-inner">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-violet-300" />
                <p className="text-sm font-black">Parent sign-up link</p>
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-200">Send this link to a parent or guardian. Your private student code is already included.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void copy("link", status.signupUrl)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.055] px-3 py-2 text-xs font-black hover:bg-white/[.09]">
                  <Copy className="h-3.5 w-3.5" /> {copied === "link" ? "Copied" : "Copy link"}
                </button>
                {status.signupUrl && (
                  <a href={status.signupUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.055] px-3 py-2 text-xs font-black hover:bg-white/[.09]">
                    <ExternalLink className="h-3.5 w-3.5" /> Open
                  </a>
                )}
              </div>
              <div className="mt-3 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2">
                <p className="text-[11px] font-black uppercase tracking-[.16em] text-violet-200">Student connection code</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-base font-black tracking-[.12em] text-violet-200">{status.code}</span>
                  <button type="button" onClick={() => void copy("code", status.code)} className="rounded-lg p-1.5 text-violet-200 hover:bg-white/[.07]" aria-label="Copy parent code">
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-violet-400/20 bg-[#19152b] p-4 shadow-inner">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-cyan-300" />
                <p className="text-sm font-black">Email a parent or guardian</p>
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-200">A.R.I.S.E. will email the sign-up link and your connection code for you.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => { setEmail(event.target.value); setMessage(""); }}
                  onKeyDown={(event) => { if (event.key === "Enter") void sendInvite(); }}
                  placeholder="parent@email.com"
                  className="min-h-12 min-w-0 flex-1 rounded-xl border border-cyan-400/25 bg-[#080713] px-3 text-base font-semibold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/10"
                />
                <button
                  type="button"
                  onClick={() => void sendInvite()}
                  disabled={!email.trim() || sending}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-4 text-xs font-black text-white disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" /> {sending ? "Sending…" : "Send invite"}
                </button>
              </div>
              {message && <p className="mt-2 text-xs font-bold text-cyan-200">{message}</p>}
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-cyan-400/15 bg-cyan-500/[.06] p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                <p className="text-xs leading-5 text-slate-200">Once they connect, this notice disappears automatically and their Parent Proctor Code can unlock your quizzes and tests.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
