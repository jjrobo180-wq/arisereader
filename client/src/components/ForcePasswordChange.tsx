import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

/**
 * Shown instead of the app whenever the signed-in account has
 * mustChangePassword set — today, that's only a student a teacher just
 * bulk-added (their starting username AND password were both their student
 * number, so the very first thing they do is replace it with one only they
 * know). Blocks the rest of the app until a new password is set.
 */
export default function ForcePasswordChange() {
  const { token, refreshUser, logout } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 4) { setError("Your new password must be at least 4 characters."); return; }
    if (newPassword !== confirm) { setError("Those passwords don't match."); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/account/set-first-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
        signal: AbortSignal.timeout(20_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Couldn't set your password. Try again.");
      // Saved. The app goes on as soon as the account says so; this screen never sits on "Saving…".
      await refreshUser();
      setBusy(false);
    } catch (e: any) {
      setError(e?.name === "TimeoutError" ? "That's taking too long. Check your connection and try again." : e.message || "Couldn't set your password. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-100 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-[1.75rem] bg-white p-7 shadow-[0_30px_90px_rgba(30,34,80,.18)]">
        <div className="mx-auto grid grid-cols-1 h-14 w-14 place-items-center rounded-2xl bg-violet-600 text-white">
          <KeyRound className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-center text-2xl font-extrabold tracking-tight text-slate-900">Set your password</h1>
        <p className="mt-2 text-center text-sm font-medium leading-5 text-slate-500">
          Your teacher gave you a starting password. Pick a new one that only you know before you continue.
        </p>

        <label className="mt-6 block text-sm font-bold text-slate-700">
          New password
          <input
            type="password"
            autoFocus
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={4}
            required
            className="mt-1.5 block w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
          />
        </label>
        <label className="mt-4 block text-sm font-bold text-slate-700">
          Type it again
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={4}
            required
            className="mt-1.5 block w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
          />
        </label>

        {error && <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 flex min-h-12 w-full items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save and continue"}
        </button>
        <button
          type="button"
          onClick={logout}
          className="mt-3 w-full text-center text-sm font-semibold text-slate-400 hover:text-slate-600"
        >
          Sign out instead
        </button>
      </form>
    </div>
  );
}
