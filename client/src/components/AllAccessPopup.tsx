// The Arise All Access pop-up in the iPhone apps (To Duo, Fit, Notes, Podster). Sign-up screens no longer show
// All Access; instead, once a person has made their account and finished the app's tutorial, this pops up once
// per account on this phone. It is skipped for anyone who already has All Access. Buying inside it follows the
// same rules as everywhere else (components/AllAccessOffer.tsx: Apple in-app purchase, or the US website link).
import { useEffect, useState } from "react";
import { Crown, X } from "lucide-react";
import AllAccessOffer from "@/components/AllAccessOffer";
import type { AllAccessApp } from "@shared/allAccess";
import { NATIVE_NO_PURCHASE, isNativeApp } from "@/lib/nativeApp";
import { API_BASE } from "@/lib/queryClient";

const SEEN = (id: unknown) => `arise-all-access-intro-v1:${id}`;
const seen = (id: unknown) => { try { return localStorage.getItem(SEEN(id)) === "1"; } catch { return false; } };

export default function AllAccessPopup({ userId, token, ready, doneKey, dark = false, apiBase = API_BASE, intro, app = "todo", handoff, isMember }: {
  userId: unknown; token: string | null | undefined;
  /** The app's tutorial is finished (or pass doneKey: the localStorage key its tutorial sets when done). */
  ready?: boolean; doneKey?: string;
  dark?: boolean; apiBase?: string;
  /** One line about what the free version of this app includes. */
  intro?: string;
  /** Which app: the website page wears its name and colors. */
  app?: AllAccessApp;
  /** Podster: its own sign-in code maker, and its own "already a member?" check (its accounts are separate). */
  handoff?: () => Promise<string | null>;
  isMember?: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [tutorialDone, setTutorialDone] = useState(false);
  useEffect(() => {
    if (!doneKey) return;
    const check = () => { try { if (localStorage.getItem(doneKey)) setTutorialDone(true); } catch { /* not yet */ } };
    check();
    const t = window.setInterval(check, 1500);
    return () => window.clearInterval(t);
  }, [doneKey]);
  const go = (ready ?? false) || tutorialDone;
  useEffect(() => {
    if (!go || !token || !userId || !isNativeApp() || seen(userId)) return;
    let alive = true;
    const t = window.setTimeout(() => {
      (isMember ? isMember().then((m) => ({ live: m })) : fetch(`${apiBase}/api/all-access`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)))
        .then((s) => { if (alive && s && !(s.live || s.admin)) setOpen(true); })
        .catch(() => { /* try next time */ });
    }, 1200);
    return () => { alive = false; window.clearTimeout(t); };
  }, [go, token, userId, apiBase]);
  if (!open) return null;
  const close = () => { try { localStorage.setItem(SEEN(userId), "1"); } catch { /* shows once this visit */ } setOpen(false); };
  return <div className="kb-sheet fixed inset-0 z-[700] flex items-end justify-center bg-black/45 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Arise All Access" data-testid="all-access-popup">
    <div className={`max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-[22px] p-5 shadow-2xl ${dark ? "bg-[#17161d] text-white" : "bg-[#f5f4fb] text-[#111018]"}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white"><Crown className="h-6 w-6" /></span>
        <button type="button" onClick={close} aria-label="Close" className={`grid h-10 w-10 place-items-center rounded-full ${dark ? "text-white/70" : "text-[#6b6879]"}`}><X className="h-5 w-5" /></button>
      </div>
      <h2 className="mt-3 text-[22px] font-bold leading-tight">You're all set. Want more?</h2>
      <p className={`mt-1.5 text-[15px] leading-snug ${dark ? "text-white/70" : "text-[#6b6879]"}`}>{intro || "Everything you need is free to use. Arise All Access unlocks the extras in every Arise app with one plan."}</p>
      <AllAccessOffer dark={dark} className="mt-4" note={NATIVE_NO_PURCHASE} authToken={handoff ? null : token} app={app} handoff={handoff} onBought={close} />
      <button type="button" onClick={close} className={`mt-3 h-11 w-full text-[15px] font-semibold ${dark ? "text-white/80" : "text-[#5b4fe0]"}`} data-testid="all-access-popup-later">Not now</button>
    </div>
  </div>;
}
