import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";

/** Opened from the "Forgot your username or password?" email: choose a new password. */
export default function ResetPassword() {
  const token = (() => { const q = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : window.location.search.slice(1); return new URLSearchParams(q).get("token") || ""; })();
  const [who, setWho] = useState<{ username: string; displayName: string } | null>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (r.ok) setWho(d); else setError(d.message || "This link can't be used."); })
      .catch(() => setError("We couldn't reach the server. Check your connection and try again."));
  }, [token]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("The two passwords don't match."); return; }
    setBusy(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/api/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setDone(d.message || "Your password is changed."); else setError(d.message || "The password couldn't be changed.");
    } catch { setError("We couldn't reach the server. Please try again."); } finally { setBusy(false); }
  };

  const field = "h-12 w-full rounded-xl border border-[#dfe3f1] bg-[#fbfbff] px-4 text-base text-[#17213b] outline-none focus:border-[#665ae6] focus:ring-2 focus:ring-[#dfdcff]";
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f3fb] px-4 py-10 text-[#17213b]">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl shadow-violet-100">
        <p className="text-xs font-black uppercase tracking-[.13em] text-[#695ede]">A.R.I.S.E.</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Choose a new password</h1>
        {done ? <>
          <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{done}</p>
          <Link href="/signin" className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#5b53df] text-sm font-black text-white hover:bg-[#4941cb]">Go to sign in</Link>
        </> : !who ? <>
          {error ? <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : <p className="mt-5 text-sm text-[#737b94]">Checking your link…</p>}
          {error && <Link href="/signin" className="mt-5 block text-center text-sm font-bold text-[#5b53df]">Back to sign in to ask for a new link</Link>}
        </> : (
          <form onSubmit={save} className="mt-5 space-y-4">
            <p className="rounded-xl bg-[#f5f3ff] p-3 text-sm">Account: <b>{who.displayName}</b><br />Username: <b>{who.username}</b></p>
            <div className="relative">
              <label htmlFor="new-password" className="mb-2 block text-sm font-bold">New password</label>
              <input id="new-password" type={show ? "text" : "password"} autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className={`${field} pr-12`} />
              <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)} className="absolute bottom-0 right-0 grid h-12 w-12 place-items-center text-[#788098]">{show ? <EyeOff size={20} /> : <Eye size={20} />}</button>
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm font-bold">Type it again</label>
              <input id="confirm-password" type={show ? "text" : "password"} autoComplete="new-password" minLength={6} required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} />
            </div>
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
            <button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-[#5b53df] text-sm font-black text-white hover:bg-[#4941cb] disabled:opacity-60">{busy ? "Saving…" : "Save new password"}</button>
          </form>
        )}
      </div>
    </main>
  );
}
