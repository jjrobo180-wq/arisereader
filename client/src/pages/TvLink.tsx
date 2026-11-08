// arisetodo.com/tv: sign in Arise Duo on an Apple TV by typing the code the TV shows (server/tvLink.ts).
// Signed out, it sends you to sign in first and back here.
import { useState, type FormEvent } from "react";
import { Tv, Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { tvCodeFromAddress } from "@/lib/tvCode";

export default function TvLink() {
  const { user, token } = useAuth();
  const [code, setCode] = useState(() => tvCodeFromAddress(window.location));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/tv-link/approve`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ code }) });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "That didn't work. Please try again.");
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "That didn't work. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-[#f6f7fc] px-4 py-16 text-slate-900">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white"><Tv size={28} /></div>
        <h1 className="text-2xl font-bold">Sign in your Apple TV</h1>
        {!user ? (
          <>
            <p className="mt-2 text-slate-600">Sign in here first, then type the code your TV is showing.</p>
            <a className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white" href="#/signin" onClick={() => { try { sessionStorage.setItem("tv_link_code", code); } catch { /* comes back without the code */ } }}>Sign in</a>
          </>
        ) : done ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900">
            <Check className="mt-0.5 shrink-0" />
            <p>Your Apple TV is signed in as <b>{user.displayName || user.username}</b>. It will show your day in a moment.</p>
          </div>
        ) : (
          <form onSubmit={send}>
            <p className="mt-2 text-slate-600">Open Arise Duo or Arise Fit on your Apple TV and type the code it shows. You're signing it in as <b>{user.displayName || user.username}</b>.</p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              inputMode="text" autoCapitalize="characters" autoComplete="one-time-code" aria-label="Code from your TV"
              placeholder="K7QX2M"
              className="mt-6 w-full rounded-2xl border border-slate-300 px-4 py-4 text-center font-mono text-3xl tracking-[0.4em] outline-none focus:border-slate-900"
            />
            {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
            <button disabled={busy || code.length !== 6} className="mt-5 w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-40">
              {busy ? "Signing in…" : "Sign in the TV"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
