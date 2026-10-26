import { useState } from "react";
import { API_BASE } from "@/lib/queryClient";

/**
 * "Forgot your username or password?": emails the username(s) on an address, each with a
 * link to choose a new password. Students without an email are told to ask their teacher.
 */
export default function ForgotSignIn({ dark = false }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setNote(null);
    try {
      const r = await fetch(`${API_BASE}/api/auth/forgot`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const d = await r.json().catch(() => ({}));
      setNote({ ok: r.ok, text: d.message || (r.ok ? "Check your email." : "Something went wrong. Please try again.") });
    } catch {
      setNote({ ok: false, text: "We couldn't reach the server. Check your connection and try again." });
    } finally { setBusy(false); }
  };

  const link = dark ? "text-violet-300 hover:text-white" : "text-[#5b53df] hover:text-[#4941cb]";
  const box = dark ? "border-white/10 bg-white/5 text-slate-200" : "border-[#e3e6f0] bg-[#f8f8fd] text-[#3b4256]";
  const input = dark ? "border-white/10 bg-[#0f0d1d] text-white" : "border-[#dfe3f1] bg-white text-[#17213b] focus:border-[#665ae6]";

  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className={`mt-3 w-full text-center text-sm font-bold underline-offset-2 hover:underline ${link}`}>
      Forgot your username or password?
    </button>
  );
  return (
    <form onSubmit={send} className={`mt-4 space-y-3 rounded-xl border p-4 text-sm ${box}`}>
      <p className="font-bold">We'll email your username and a link to choose a new password.</p>
      <label htmlFor="forgot-email" className="sr-only">Email on your account</label>
      <input id="forgot-email" type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email on your account" className={`h-11 w-full rounded-lg border px-3 text-base outline-none ${input}`} />
      {note && <p role="status" className={`rounded-lg p-2.5 font-semibold ${note.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{note.text}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="h-10 flex-1 rounded-lg bg-[#5b53df] px-4 font-black text-white hover:bg-[#4941cb] disabled:opacity-60">{busy ? "Sending…" : "Email me"}</button>
        <button type="button" onClick={() => { setOpen(false); setNote(null); }} className={`h-10 rounded-lg px-3 font-bold ${link}`}>Cancel</button>
      </div>
      <p className="text-xs opacity-80">Students: if your account has no email, ask your teacher to reset your password.</p>
    </form>
  );
}
