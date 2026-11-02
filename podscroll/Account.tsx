// Account & privacy: the Privacy Policy, Terms of Use and community rules, Support, and deleting
// your Pod+ account and data (App Store Guidelines 5.1.1(i) and (v), 1.2, 1.5). Opened from the menu
// and the account button.
import { useState } from "react";
import { FileText, LifeBuoy, Loader2, ShieldCheck, Trash2, Users, X } from "lucide-react";

export const POD_LINKS = {
  privacy: "https://podscroll.onrender.com/privacy/",
  terms: "https://podscroll.onrender.com/terms/",
  rules: "https://podscroll.onrender.com/terms/#community",
  support: "https://podscroll.onrender.com/support/",
};

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;

export function AccountSheet({ api, email, signedIn, onClose, say }: { api: Api; email: string; signedIn: boolean; onClose: () => void; say: (m: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const remove = () => {
    if (typed.trim().toUpperCase() !== "DELETE" || busy) return;
    setBusy(true); setErr("");
    api("/api/earshot/account/delete", { method: "POST", body: { confirm: "DELETE" } })
      .then(() => {
        // Everything this phone kept goes too: the session, the device id, listening history, downloads list.
        try { for (const k of Object.keys(localStorage)) if (k.startsWith("podscroll") || k.startsWith("podplus")) localStorage.removeItem(k); } catch { /* private window */ }
        say("Your Pod+ account and data were deleted.");
        setTimeout(() => location.reload(), 1200);
      })
      .catch((e) => setErr(e?.message || "That didn't work. Try again."))
      .finally(() => setBusy(false));
  };
  const row = "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium hover:bg-[#f2f2f2]";
  return <div role="dialog" aria-modal="true" aria-labelledby="acct-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] sm:items-center">
    <div className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-[24px] bg-white p-5 text-[#0f0f0f] shadow-2xl">
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-[#606060] hover:bg-[#f2f2f2]"><X size={20} /></button>
      <h2 id="acct-title" className="pr-10 text-xl font-bold">Account & privacy</h2>
      <p className="mt-1 text-sm text-[#606060]">{signedIn ? `Signed in as ${email || "a Pod+ member"}.` : "You're listening without an account. Your likes, follows and profile are kept for this phone."}</p>
      <div className="mt-4 space-y-0.5">
        <a href={POD_LINKS.privacy} target="_blank" rel="noreferrer" className={row}><ShieldCheck size={20} className="text-[#ff6a1f]" />Privacy Policy</a>
        <a href={POD_LINKS.terms} target="_blank" rel="noreferrer" className={row}><FileText size={20} className="text-[#ff6a1f]" />Terms of Use</a>
        <a href={POD_LINKS.rules} target="_blank" rel="noreferrer" className={row}><Users size={20} className="text-[#ff6a1f]" />Community rules</a>
        <a href={POD_LINKS.support} target="_blank" rel="noreferrer" className={row}><LifeBuoy size={20} className="text-[#ff6a1f]" />Contact support</a>
        <button type="button" onClick={() => setDeleting(true)} className={`${row} text-[#d93025]`} data-testid="pod-delete-account"><Trash2 size={20} />{signedIn ? "Delete my account" : "Delete my data"}</button>
      </div>
      {deleting && <div className="mt-3 rounded-2xl border border-[#f5c2c0] bg-[#fdf2f1] p-4">
        <p className="text-[15px] font-bold text-[#a50e0e]">{signedIn ? "Delete your Pod+ account?" : "Delete your Pod+ data?"}</p>
        <p className="mt-1 text-sm leading-snug text-[#5f2120]">This removes {signedIn ? "your account, " : ""}your profile, posts, comments, messages, stories, clips, uploaded episodes, follows and likes. It can't be undone.</p>
        <label className="mt-3 block text-sm font-semibold text-[#5f2120]">Type DELETE to confirm
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" className="mt-1 min-h-11 w-full rounded-xl border border-[#e0a8a5] bg-white px-3 text-base outline-none focus:border-[#d93025]" /></label>
        {err && <p role="alert" className="mt-2 text-sm text-[#a50e0e]">{err}</p>}
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => { setDeleting(false); setTyped(""); setErr(""); }} className="min-h-11 flex-1 rounded-full border border-[#d3d3d3] bg-white text-sm font-semibold">Cancel</button>
          <button type="button" onClick={remove} disabled={busy || typed.trim().toUpperCase() !== "DELETE"} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#d93025] text-sm font-semibold text-white disabled:opacity-40">{busy && <Loader2 size={16} className="animate-spin" />}Delete forever</button>
        </div>
      </div>}
    </div>
  </div>;
}
