// Arise Fit+ in the app (shared/fitPlus.ts): who has it, the upgrade sheet, and the guest pass.
// Fit+ is bought on the website only. The iPhone app never shows a price or a way to pay (App Review
// 3.1.1): it says Fit+ is on the account when it is, and a guest pass works anywhere.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { FeatureIcon } from "./FitIcon";
import { Check, Copy, Crown, Loader2, Share2, Ticket, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { TODO_APP } from "@/lib/hubs";
import { isNativeApp, NATIVE_NO_PURCHASE } from "@/lib/nativeApp";
import { CODE_LEN, cleanCode } from "@shared/fitCircle";
import { PASS_SWITCH_DAYS, PLUS_FEATURES, PLUS_NAME, PLUS_REQUIRED, freeStatus, passLink, type PlusFeature, type PlusStatus } from "@shared/fitPlus";
import { fitApi } from "./fitStore";
import { Btn, C, Card, Sheet, Title, display, haptic, inputCls, inputStyle } from "./fitUi";

type Ctx = { status: PlusStatus; loaded: boolean; plus: boolean; reload: () => Promise<void>; ask: (f?: PlusFeature) => void };
const PlusCtx = createContext<Ctx>({ status: freeStatus(), loaded: false, plus: false, reload: async () => {}, ask: () => {} });
export const usePlus = () => useContext(PlusCtx);
/** True when a server answer says the person needs Fit+ (the app then opens the upgrade sheet). */
export const isPlusError = (e: any) => e?.code === PLUS_REQUIRED || /part of Arise Fit\+/.test(String(e?.message || ""));

/** Wraps Arise Fit: knows whether this person has Fit+, and opens the upgrade sheet when asked. */
export function PlusProvider({ children, say, passCode, onPassShown }: { children: ReactNode; say: (m: string) => void; passCode?: string; onPassShown?: () => void }) {
  const { token } = useAuth();
  const [status, setStatus] = useState<PlusStatus>(freeStatus);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<{ feature?: PlusFeature } | null>(null);
  const reload = useCallback(async () => {
    if (!token) return;
    try { setStatus(await fitApi<PlusStatus>(token, "/plus")); } catch { /* keep what we had */ } finally { setLoaded(true); }
  }, [token]);
  useEffect(() => { void reload(); }, [reload]);
  // Back from paying on the website (?paid=…): confirm it, then Fit+ is on.
  useEffect(() => {
    const paid = new URLSearchParams(window.location.search).get("paid");
    if (!paid || !token) return;
    fetch(`${API_BASE}/api/billing/confirm`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: paid }) }).catch(() => {}).finally(() => {
      void reload().then(() => say("Welcome to Arise Fit+!"));
      try { const u = new URL(window.location.href); u.searchParams.delete("paid"); history.replaceState(null, "", u.toString()); } catch { /* keep the address */ }
    });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (passCode) setOpen({}); }, [passCode]);
  const ask = useCallback((feature?: PlusFeature) => { haptic("light"); setOpen({ feature }); }, []);
  return <PlusCtx.Provider value={{ status, loaded, plus: status.plus, reload, ask }}>
    {children}
    {open && <PlusSheet status={status} feature={open.feature} passCode={passCode} reload={reload} say={say} onClose={() => { setOpen(null); onPassShown?.(); }} />}
  </PlusCtx.Provider>;
}

/** Runs `go` with Fit+, or opens the upgrade sheet for `feature`. */
export function useNeedsPlus() {
  const { plus, ask } = usePlus();
  return (feature: PlusFeature, go: () => void) => { if (plus) go(); else ask(feature); };
}

/** A small "Fit+" tag beside things that need it, for people who don't have it. */
export function PlusTag() {
  const { plus } = usePlus();
  return plus ? null : <span className="ml-1.5 inline-flex items-center rounded-full px-1.5 py-[1px] align-middle text-[10px] font-bold tracking-wide" style={{ background: C.lime, color: "var(--fit-on-accent)" }}>FIT+</span>;
}

export function PlusSheet({ status, feature, passCode, reload, say, onClose }: { status: PlusStatus; feature?: PlusFeature; passCode?: string; reload: () => Promise<void>; say: (m: string) => void; onClose: () => void }) {
  const { token } = useAuth();
  const native = isNativeApp();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [code, setCode] = useState(passCode ?? "");
  const call = async <T,>(path: string, body: unknown = {}): Promise<T | null> => {
    setBusy(path); setErr("");
    try { return await fitApi<T>(token, path, { method: "POST", body: JSON.stringify(body) }); }
    catch (e: any) { setErr(e.message); return null; } finally { setBusy(""); }
  };
  const subscribe = async () => { const r = await call<{ url: string }>("/billing/checkout", { returnPath: "/fit" }); if (r?.url) window.location.assign(r.url); };
  const manage = async () => { const r = await call<{ url: string }>("/billing/portal"); if (r?.url) window.location.assign(r.url); };
  const redeem = async () => {
    const c = cleanCode(code);
    if (!c) { setErr(`Guest pass codes are ${CODE_LEN} letters and numbers.`); return; }
    if (await call("/pass/redeem", { code: c })) { haptic("success"); await reload(); say("You have Arise Fit+ now. Enjoy!"); setCode(""); }
  };
  const share = async () => {
    const r = status.pass.code ? { code: status.pass.code } : await call<{ code: string }>("/pass/code");
    if (!r?.code) return;
    await reload();
    const link = passLink(TODO_APP, r.code);
    const text = `I'm sharing my Arise Fit+ with you, free. Open ${link} or enter guest pass code ${r.code} in Arise Fit › Fit+.`;
    try { if (navigator.share) { await navigator.share({ title: "Arise Fit+ guest pass", text }); return; } } catch (e: any) { if (e?.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text); say("Guest pass copied. Paste it in a text."); } catch { say(`Your guest pass code is ${r.code}`); }
  };
  const end = async (who: string) => { if (window.confirm(who)) { if (await call("/pass/end")) { await reload(); say("Guest pass updated."); } } };
  const p = status.pass;
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric" }) : "");
  return <Sheet title="Arise Fit+" onClose={onClose} testId="fit-plus">
    {status.plus ? <Card className="!p-4" testId="fit-plus-on"><div className="flex items-center gap-3"><Crown className="h-7 w-7 shrink-0" style={{ color: C.lime }} />
      <div><p className="text-[22px] leading-none" style={display}>You have Fit+</p>
        <p className="mt-1 text-[13px]" style={{ color: C.steel }}>{status.via === "guest-pass" ? `Shared with you by ${p.owner?.name} with their guest pass.` : status.via === "admin" ? "On your account." : status.endsAt ? `Renews or ends ${date(status.endsAt)}.` : "On your account."}</p></div></div>
      {status.canManage && !native && <Btn kind="soft" className="mt-3 w-full" onClick={() => void manage()} disabled={!!busy}>Manage billing</Btn>}
    </Card> : <>
      {feature && <p className="px-1 text-[15px]" style={{ color: C.steel }}><b style={{ color: C.text }}>{PLUS_NAME[feature]}</b> is part of Arise Fit+.</p>}
      <p className="mt-1 px-1 text-[40px] leading-none" style={display}>{status.price}</p>
      <p className="mt-1 px-1 text-[13px]" style={{ color: C.dim }}>Fit+ comes with Arise All Access: one plan that also unlocks To Duo Unlimited, Arise Notes Plus and ad-free Pod+.</p>
    </>}

    <Title>{status.plus ? "Included" : "What you get"}</Title>
    <Card className="!p-4"><ul className="space-y-3">{PLUS_FEATURES.map((f) => <li key={f.id} className="flex gap-3" style={feature === f.id ? { color: C.text } : undefined}>
      <FeatureIcon id={f.id} className="mt-0.5 h-5 w-5 shrink-0" />
      <span className="min-w-0"><span className="block text-[15px] font-semibold">{f.name}{status.plus && <Check className="ml-1.5 inline h-4 w-4" style={{ color: C.lime }} />}</span><span className="block text-[13px] leading-snug" style={{ color: C.dim }}>{f.blurb}</span></span></li>)}</ul>
      <p className="mt-3 text-[12px]" style={{ color: C.dim }}>Workouts, programs, food, fasting, runs, recipes and your workout circle stay free.</p></Card>

    {!status.plus && (native
      ? <p className="mt-3 px-1 text-[13px]" style={{ color: C.dim }}>{NATIVE_NO_PURCHASE}</p>
      : status.payment
        ? <Btn className="mt-4 w-full" onClick={() => void subscribe()} disabled={!!busy} testId="fit-plus-buy">{busy === "/billing/checkout" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crown className="h-5 w-5" />}Get All Access · {status.price}</Btn>
        : <p className="mt-3 px-1 text-[13px]" style={{ color: C.dim }}>Payments aren't switched on for this site yet.</p>)}

    <Title>Guest pass</Title>
    {p.role === "owner" ? <Card className="!p-4" testId="fit-pass-owner">
      {p.guest ? <>
        <p className="text-[15px]"><Ticket className="mr-1.5 inline h-5 w-5" style={{ color: C.lime }} /><b>{p.guest.name}</b> has Fit+ with your guest pass.</p>
        <Btn kind="ghost" className="mt-3 w-full" onClick={() => void end(`Take back your guest pass from ${p.guest!.name}? You can give it to someone new after ${PASS_SWITCH_DAYS} days.`)} disabled={!!busy}><X className="h-4 w-4" />Take it back</Btn>
      </> : <>
        <p className="text-[15px]">Share Fit+ free with one friend or family member. They use their own account.</p>
        {p.switchAfter ? <p className="mt-2 text-[13px]" style={{ color: C.dim }}>Your pass can go to someone new on {date(p.switchAfter)}.</p> : <>
          {p.code && <p className="mt-3 text-center text-[34px] leading-none tracking-[.18em]" style={display} data-testid="fit-pass-code">{p.code}</p>}
          <Btn className="mt-3 w-full" onClick={() => void share()} disabled={!!busy} testId="fit-pass-share">{busy === "/pass/code" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />}Send my guest pass</Btn>
          {p.code && <Btn kind="soft" className="mt-2 w-full" onClick={() => { void navigator.clipboard?.writeText(passLink(TODO_APP, p.code!)).then(() => say("Link copied."), () => say(p.code!)); }}><Copy className="h-4 w-4" />Copy link</Btn>}
        </>}
      </>}
    </Card> : p.role === "guest" ? <Card className="!p-4" testId="fit-pass-guest">
      <p className="text-[15px]"><Ticket className="mr-1.5 inline h-5 w-5" style={{ color: C.lime }} />You're using <b>{p.owner?.name}</b>'s guest pass. It lasts as long as their Fit+ does. Guest passes can't be shared again.</p>
      <Btn kind="ghost" className="mt-3 w-full" onClick={() => void end("Give back this guest pass? You'll lose Fit+.")} disabled={!!busy}>Give it back</Btn>
    </Card> : <Card className="!p-4" testId="fit-pass-redeem">
      <p className="text-[15px]">{status.plus ? "Your Fit+ was given to your account, so it has no guest pass." : "Someone with Fit+ can share it with you for free. Enter their guest pass code."}</p>
      {!status.plus && <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void redeem(); }}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LEN))} placeholder="Code" className={`${inputCls} tracking-[.2em]`} style={inputStyle} autoCapitalize="characters" aria-label="Guest pass code" data-testid="fit-pass-code-input" />
        <Btn type="submit" disabled={!!busy || code.length !== CODE_LEN} testId="fit-pass-redeem-go">{busy === "/pass/redeem" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Ticket className="h-5 w-5" />}Use</Btn>
      </form>}
    </Card>}
    {err && <p className="mt-3 px-1 text-[14px]" style={{ color: C.red }} role="alert">{err}</p>}
  </Sheet>;
}
