// Account & privacy: the Privacy Policy, Terms of Use, Support, and deleting your own account
// (App Store Guidelines 5.1.1(i) and 5.1.1(v)). Opened from the More menu in Arise LifeHub and
// Arise WorkHub, on the website and in the Arise To Duo iPhone app, and from the account button in
// the two A.R.I.S.E. Reader iPhone apps. An account made with Sign in with Apple confirms with Apple.
import { useState } from "react";
import { FileText, LifeBuoy, Loader2, ShieldCheck, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { goToSignIn } from "@/lib/hubs";
import { LEGAL, nativeAppInfo, nativeFlavor } from "@/lib/nativeApp";
import { APPLE_LOGO_PATH, appleSignInAvailable, askApple } from "@/lib/appleSignIn";

export default function AccountPrivacy({ onClose }: { onClose: () => void }) {
  const { user, token, logout } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const confirmed = typed.trim().toUpperCase() === "DELETE" && !busy;
  const ready = !!password && confirmed;
  // An account made with Sign in with Apple has no password its owner knows: it confirms with Apple.
  const withApple = appleSignInAvailable();

  const remove = async (apple = false) => {
    if (apple ? !confirmed : !ready) return;
    setBusy(true); setErr("");
    try {
      let appleIdentityToken = "";
      if (apple) {
        const a = await askApple(nativeAppInfo().bundle);
        if (!a) { setBusy(false); return; }
        appleIdentityToken = a.identityToken;
      }
      const res = await fetch(`${API_BASE}/api/account/delete`, {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(apple ? { appleIdentityToken, confirm: "DELETE" } : { password, confirm: "DELETE" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "That didn't work. Try again.");
      setDone(body?.message || "Your account and its data were deleted.");
      setTimeout(() => { logout(); goToSignIn(); }, 2200);
    } catch (e: any) {
      setErr(e?.message || "That didn't work. Try again.");
    } finally { setBusy(false); }
  };

  const row = "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium text-slate-800 hover:bg-slate-50";
  const input = "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-rose-500";
  return <div role="dialog" aria-modal="true" aria-labelledby="acct-privacy-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    className="fixed inset-0 kb-sheet z-[120] flex items-end justify-center bg-slate-950/50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] sm:items-center" data-testid="account-privacy">
    <div className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      <h2 id="acct-privacy-title" className="pr-12 text-xl font-bold text-slate-950">Account & privacy</h2>
      {user && <p className="mt-1 text-sm text-slate-600">Signed in as <b className="text-slate-800">{user.displayName || user.username}</b>.</p>}
      <div className="mt-4 space-y-0.5">
        <a href={LEGAL.privacy} target="_blank" rel="noreferrer" className={row}><ShieldCheck className="h-5 w-5 text-violet-600" />Privacy Policy</a>
        <a href={LEGAL.terms} target="_blank" rel="noreferrer" className={row}><FileText className="h-5 w-5 text-violet-600" />Terms of Use</a>
        <a href={LEGAL.support} target="_blank" rel="noreferrer" className={row}><LifeBuoy className="h-5 w-5 text-violet-600" />Contact support</a>
        {!user?.isAdmin && <button type="button" onClick={() => setDeleting(true)} className={`${row} !text-rose-700 hover:!bg-rose-50`} data-testid="account-delete-open"><Trash2 className="h-5 w-5" />Delete my account</button>}
      </div>
      {deleting && !done && <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
        <p className="text-[15px] font-bold text-rose-900">Delete your account?</p>
        <p className="mt-1 text-sm leading-snug text-rose-900/80">{nativeFlavor() === "fit"
          ? "This removes your Arise account and everything in it: your workouts, programs, food diary and weight, plus anything in Arise To Duo with the same account. It can't be undone."
          : nativeFlavor() === "todo"
          ? "This removes your account and everything in it: your tasks, notes, calendars, LifeHub and WorkHub, files, and podcast profile and posts. It can't be undone. Anything shared with you by others stays with them."
          : "This removes your account and everything saved in it, including reading progress, quizzes and points. It can't be undone."}</p>
        <label className="mt-3 block text-sm font-semibold text-rose-900">Your password
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} data-testid="account-delete-password" /></label>
        <label className="mt-3 block text-sm font-semibold text-rose-900">Type DELETE to confirm
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" className={input} data-testid="account-delete-confirm" /></label>
        {err && <p role="alert" className="mt-2 text-sm font-medium text-rose-800">{err}</p>}
        {withApple && <button type="button" onClick={() => void remove(true)} disabled={!confirmed} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-semibold text-white disabled:opacity-40" data-testid="account-delete-apple">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={APPLE_LOGO_PATH} /></svg>Signed up with Apple? Delete with Apple
        </button>}
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => { setDeleting(false); setPassword(""); setTyped(""); setErr(""); }} className="min-h-11 flex-1 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800">Cancel</button>
          <button type="button" onClick={() => void remove(false)} disabled={!ready} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-semibold text-white disabled:opacity-40" data-testid="account-delete-submit">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Delete forever</button>
        </div>
      </div>}
      {done && <p role="status" className="mt-3 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{done} Signing you out…</p>}
      {user?.isAdmin && <p className="mt-3 text-xs text-slate-500">The admin account can't be deleted from here.</p>}
    </div>
  </div>;
}
