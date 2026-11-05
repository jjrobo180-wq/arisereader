// Opened from a "Share full access" link. Signed in: shows who is sharing and joins in one tap. Signed out: keeps
// the link, sends them to sign in or make an account, and AriseTodo brings them back here after. See server/profileLinks.ts.
import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { CheckCircle2, Loader2, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { JOIN_PENDING_KEY, linksApi } from "@/lib/profileLinks";

const keep = (v: string | null) => { try { if (v) localStorage.setItem(JOIN_PENDING_KEY, v); else localStorage.removeItem(JOIN_PENDING_KEY); } catch { /* not kept */ } };

export default function JoinFamily() {
  const [, params] = useRoute("/join/:token");
  const [, go] = useLocation();
  const { user, token: auth } = useAuth();
  const joinToken = params?.token || "";
  const api = useMemo(() => linksApi(auth), [auth]);
  const [owner, setOwner] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user) { setOwner(""); return; }
    let live = true;
    api.peekJoin(joinToken).then((r) => { if (live) setOwner(r.ownerName); }).catch((e: any) => { if (live) setError(e.message || "This link isn't working."); });
    return () => { live = false; };
  }, [user, api, joinToken]);

  const accept = async () => {
    setBusy(true); setError("");
    try { await api.join(joinToken); keep(null); setDone(true); window.setTimeout(() => go("/lifehub?go=linked"), 1200); }
    catch (e: any) { setError(e.message || "That didn't work. Try again."); }
    finally { setBusy(false); }
  };
  const signIn = () => { keep(joinToken); go("/signin"); };

  return <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6 text-center" data-testid="join-family">
    {done ? <CheckCircle2 className="h-14 w-14 text-emerald-600" /> : <Users className="h-14 w-14 text-violet-600" />}
    {done ? <><h1 className="text-2xl font-black">You're in</h1><p className="text-slate-600">Opening the shared apps…</p></>
      : error ? <><h1 className="text-2xl font-black">This link isn't working</h1><p className="text-slate-600">{error}</p>
          <button type="button" onClick={() => go("/lifehub")} className="min-h-12 rounded-2xl bg-violet-600 px-6 font-bold text-white">Go to my apps</button></>
      : !user ? <><h1 className="text-2xl font-black">You've been invited</h1><p className="text-slate-600">Someone is sharing their family apps with you, Potty Training included. Sign in or make a free account to open them.</p>
          <button type="button" onClick={signIn} className="min-h-12 w-full rounded-2xl bg-violet-600 font-bold text-white" data-testid="join-signin">Sign in or create account</button></>
      : !owner ? <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
      : <><h1 className="text-2xl font-black">{owner} is sharing their family apps with you</h1><p className="text-slate-600">You'll see everything they share, and can log in the apps that allow it. They can stop sharing any time.</p>
          <button type="button" onClick={() => void accept()} disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 font-bold text-white disabled:opacity-60" data-testid="join-accept">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Accept</button></>}
  </main>;
}
