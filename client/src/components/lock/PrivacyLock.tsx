// Passcode lock for LifeHub and WorkHub (shared/privacyLock.ts). The hub wraps itself in
// <PrivacyLockProvider>; then:
//   • <LockedApp> stands in for an app the person locked until the passcode is entered,
//   • useLock().ask() asks for the passcode before opening a locked note,
//   • <LockSettings> (from the hub's ⋯ menu) sets the passcode and picks which apps it locks.
// Like the iPhone, one unlock opens everything locked until "Lock now", or the app is left for a few minutes.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Delete, Lock, LockOpen, ShieldCheck, X } from "lucide-react";
import { checkPasscode, makeLock, toggleApp, validPasscode, type PrivacyLock } from "@shared/privacyLock";
import { apiRequest } from "@/lib/queryClient";

type Ctx = {
  lock: PrivacyLock | null;
  setLock: (next: PrivacyLock | null) => void;
  unlocked: boolean;
  relock: () => void;
  /** Resolves true once the passcode is entered (at once when already unlocked or no passcode is set). */
  ask: (why?: string) => Promise<boolean>;
  /** Opens the settings sheet (to set a passcode first, say). */
  openSettings: () => void;
};
const LockCtx = createContext<Ctx | null>(null);
export const useLock = () => useContext(LockCtx);

/** Relock after the app has been out of sight this long. */
const AWAY_MS = 3 * 60_000;

export function PrivacyLockProvider({ lock, setLock, apps, settings, onSettings, children }: { lock: PrivacyLock | null; setLock: (next: PrivacyLock | null) => void; apps: { id: string; label: string }[];
  /** The Passcode & locks sheet is open (the hub opens it from its menu or search). */ settings: boolean; onSettings: (open: boolean) => void; children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [asking, setAsking] = useState<{ why: string; done: (ok: boolean) => void } | null>(null);
  const hiddenAt = useRef(0);
  useEffect(() => {
    const vis = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > AWAY_MS) setUnlocked(false);
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, []);
  const ask = useCallback((why = "Enter your passcode") => {
    if (!lock || unlocked) return Promise.resolve(true);
    return new Promise<boolean>((done) => setAsking({ why, done }));
  }, [lock, unlocked]);
  const value: Ctx = { lock, setLock, unlocked: unlocked || !lock, relock: () => setUnlocked(false), ask, openSettings: () => onSettings(true) };
  return <LockCtx.Provider value={value}>
    {children}
    {asking && lock && <PasscodePad lock={lock} title={asking.why} onDone={(ok) => { if (ok) setUnlocked(true); asking.done(ok); setAsking(null); }} onForgot={() => { setLock(null); setUnlocked(false); }} />}
    {settings && <LockSettings apps={apps} onClose={() => onSettings(false)} />}
  </LockCtx.Provider>;
}

/** What shows in place of a locked app until the passcode is entered. */
export function LockedApp({ name, locked, children }: { name: string; locked: boolean; children: ReactNode }) {
  const c = useLock();
  if (!locked || !c || c.unlocked) return <>{children}</>;
  return <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 px-4 text-center" data-testid="locked-app">
    <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white"><Lock className="h-8 w-8" /></span>
    <h2 className="text-xl font-black text-slate-900">{name} is locked</h2>
    <p className="max-w-xs text-sm text-slate-500">Enter your passcode to open it.</p>
    <button type="button" onClick={() => void c.ask(`Unlock ${name}`)} className="min-h-11 rounded-xl bg-slate-900 px-6 text-sm font-bold text-white hover:bg-slate-800" data-testid="locked-app-unlock">Unlock</button>
  </div>;
}

/** The small lock shown beside a locked app's name or on a locked note. */
export const LockBadge = ({ className = "h-3.5 w-3.5" }: { className?: string }) => <Lock className={`shrink-0 text-slate-400 ${className}`} aria-label="Locked" />;

/** The iPhone-style keypad. With `lock` it checks the passcode; with `onEntered` it just hands back what was typed. */
function PasscodePad({ lock, title, sub, digits, onDone, onEntered, onForgot }: {
  lock?: PrivacyLock; title: string; sub?: string; digits?: number;
  onDone: (ok: boolean) => void; onEntered?: (code: string) => void; onForgot?: () => void;
}) {
  const [code, setCode] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const len = lock?.digits ?? digits ?? 6;
  const press = async (d: string) => {
    if (busy) return;
    const next = (code + d).slice(0, 8);
    setCode(next);
    if (!lock && !digits) return; // choosing a passcode: any length 4–8, confirmed with Done
    if (next.length < len) return;
    if (onEntered) { onEntered(next); setCode(""); return; }
    setBusy(true);
    const ok = await checkPasscode(lock!, next);
    setBusy(false);
    if (ok) onDone(true);
    else { setShake(true); window.setTimeout(() => { setShake(false); setCode(""); }, 450); }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) { e.preventDefault(); void press(e.key); }
      else if (e.key === "Backspace") setCode((c) => c.slice(0, -1));
      else if (e.key === "Escape") onDone(false);
      else if (e.key === "Enter" && !lock && !digits && validPasscode(code) && onEntered) { onEntered(code); setCode(""); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const free = !lock && !digits;
  const dots = free ? Math.max(4, code.length) : len;
  const key = "flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white/10 text-3xl font-light text-white transition active:bg-white/30 hover:bg-white/15";
  return createPortal(<div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[900] flex flex-col items-center justify-center bg-slate-950/95 px-6 py-8 text-white backdrop-blur" data-testid="passcode-pad">
    <button type="button" onClick={() => onDone(false)} aria-label="Cancel" className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] inline-flex h-11 w-11 items-center justify-center rounded-full text-white/80 hover:bg-white/10"><X className="h-6 w-6" /></button>
    {forgot ? <ForgotPasscode onBack={() => setForgot(false)} onReset={() => { onForgot?.(); onDone(false); }} /> : <>
      <Lock className="mb-4 h-7 w-7 text-white/80" />
      <h2 className="text-lg font-semibold">{title}</h2>
      {sub && <p className="mt-1 max-w-xs text-center text-sm text-white/60">{sub}</p>}
      <div className={`my-7 flex gap-4 ${shake ? "animate-[lockshake_.4s]" : ""}`} aria-live="polite" aria-label={`${code.length} digits entered`}>
        {Array.from({ length: dots }, (_, i) => <span key={i} className={`h-3.5 w-3.5 rounded-full border-2 border-white ${i < code.length ? "bg-white" : ""}`} />)}
      </div>
      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <button key={d} type="button" className={key} onClick={() => void press(d)}>{d}</button>)}
        <span />
        <button type="button" className={key} onClick={() => void press("0")}>0</button>
        <button type="button" aria-label="Delete" className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-white/80 hover:bg-white/10" onClick={() => setCode((c) => c.slice(0, -1))}><Delete className="h-7 w-7" /></button>
      </div>
      {free && <button type="button" disabled={!validPasscode(code)} onClick={() => { onEntered?.(code); setCode(""); }} className="mt-6 min-h-11 rounded-full bg-white px-8 text-sm font-bold text-slate-900 disabled:opacity-30">Next</button>}
      {lock && onForgot && <button type="button" onClick={() => setForgot(true)} className="mt-6 min-h-11 text-sm font-semibold text-white/70 underline-offset-4 hover:underline">Forgot passcode?</button>}
    </>}
    <style>{`@keyframes lockshake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-12px)}40%,80%{transform:translateX(12px)}}`}</style>
  </div>, document.body);
}

/** Forgot the passcode: the account password turns the passcode off, so a new one can be set. */
function ForgotPasscode({ onBack, onReset }: { onBack: () => void; onReset: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setErr("");
    try { await apiRequest("POST", "/api/account/verify-password", { password: pw }); onReset(); }
    catch (e: any) { setErr(String(e?.message || "").replace(/^\d+:\s*/, "").replace(/^\{"message":"(.*)"\}$/, "$1") || "That password isn't right."); }
    setBusy(false);
  };
  return <form onSubmit={(e) => { e.preventDefault(); void go(); }} className="w-full max-w-xs text-center">
    <ShieldCheck className="mx-auto mb-4 h-8 w-8 text-white/80" />
    <h2 className="text-lg font-semibold">Reset your passcode</h2>
    <p className="mt-1 text-sm text-white/60">Enter your account password. This turns the passcode off so you can set a new one.</p>
    <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Account password" placeholder="Account password" autoComplete="current-password"
      className="mt-5 min-h-12 w-full rounded-xl border border-white/20 bg-white/10 px-4 text-white outline-none placeholder:text-white/40 focus:border-white/60" />
    {err && <p className="mt-2 text-sm text-rose-300" role="alert">{err}</p>}
    <button type="submit" disabled={!pw || busy} className="mt-4 min-h-11 w-full rounded-xl bg-white text-sm font-bold text-slate-900 disabled:opacity-40">{busy ? "Checking…" : "Turn off passcode"}</button>
    <button type="button" onClick={onBack} className="mt-3 min-h-11 text-sm font-semibold text-white/70">Back</button>
  </form>;
}

/** Choosing a passcode: type it, then type it again. */
function SetPasscode({ onSet, onCancel }: { onSet: (code: string) => void; onCancel: () => void }) {
  const [first, setFirst] = useState("");
  const [miss, setMiss] = useState(false);
  return first
    ? <PasscodePad key="again" title="Enter it again" sub={miss ? "Those didn't match. Try again." : undefined} digits={first.length} onDone={onCancel}
        onEntered={(c) => { if (c === first) onSet(c); else { setMiss(true); setFirst(""); } }} />
    : <PasscodePad key="first" title="Choose a passcode" sub={miss ? "Those didn't match. Choose one again." : "4 to 8 numbers. Only you need to know it."} onDone={onCancel} onEntered={(c) => setFirst(c)} />;
}

/** The settings sheet: passcode on/off/change, and the apps it locks. */
function LockSettings({ apps, onClose }: { apps: { id: string; label: string }[]; onClose: () => void }) {
  const c = useLock()!;
  const [step, setStep] = useState<"" | "set" | "check-change" | "check-off" | "check-open">(c.lock && !c.unlocked ? "check-open" : "");
  const [q, setQ] = useState("");
  const lock = c.lock;
  const save = async (code: string) => { c.setLock(await makeLock(code, lock?.apps ?? [])); setStep(""); };
  if (step === "set") return <SetPasscode onSet={(code) => void save(code)} onCancel={() => setStep("")} />;
  if (step && lock) return <PasscodePad lock={lock} title={step === "check-off" ? "Enter passcode to turn it off" : step === "check-change" ? "Enter your current passcode" : "Enter passcode"}
    onForgot={() => { c.setLock(null); setStep(""); }}
    onDone={(ok) => { if (!ok) { if (step === "check-open") onClose(); else setStep(""); return; } if (step === "check-off") { c.setLock(null); setStep(""); } else if (step === "check-change") setStep("set"); else setStep(""); }} />;
  const shown = apps.filter((a) => !q.trim() || a.label.toLowerCase().includes(q.trim().toLowerCase()));
  return createPortal(<div className="fixed inset-0 z-[800] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="lock-settings-title" className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white text-slate-800 shadow-2xl sm:max-w-lg sm:rounded-3xl" data-testid="lock-settings">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div><p className="text-xs font-bold uppercase tracking-[.15em] text-slate-500">Privacy</p><h2 id="lock-settings-title" className="text-lg font-black">Passcode & locks</h2></div>
        <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {!lock ? <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm text-slate-600">Set a passcode, then lock any app here, or open a note and tap <b>Lock note</b>. Locked things need the passcode to open.</p>
          <button type="button" onClick={() => setStep("set")} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white" data-testid="lock-set"><Lock className="h-4 w-4" /> Set a passcode</button>
        </div> : <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { c.relock(); onClose(); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white" data-testid="lock-now"><Lock className="h-4 w-4" /> Lock now</button>
          <button type="button" onClick={() => setStep("check-change")} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50">Change passcode</button>
          <button type="button" onClick={() => setStep("check-off")} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50">Turn off passcode</button>
        </div>}
        {lock && <section>
          <h3 className="text-sm font-black">Lock apps</h3>
          <p className="mb-3 text-xs text-slate-500">Turn on any app to need the passcode before it opens.</p>
          {apps.length > 8 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an app" aria-label="Find an app" className="mb-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />}
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
            {shown.map((a) => { const on = lock.apps.includes(a.id);
              return <li key={a.id}><label className="flex min-h-12 cursor-pointer items-center gap-3 px-4">
                {on ? <Lock className="h-4 w-4 text-slate-800" /> : <LockOpen className="h-4 w-4 text-slate-300" />}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{a.label}</span>
                <input type="checkbox" role="switch" checked={on} onChange={() => c.setLock(toggleApp(lock, a.id))} className="peer sr-only" data-testid={`lock-app-${a.id}`} />
                <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-slate-400 ${on ? "bg-emerald-500" : "bg-slate-200"}`}><span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} /></span>
              </label></li>; })}
          </ul>
        </section>}
        <p className="text-xs leading-5 text-slate-400">The passcode keeps locked apps and notes out of sight on a shared screen. If you forget it, your account password turns it off.</p>
      </div>
    </div>
  </div>, document.body);
}

/** The header's lock button: opens Passcode & locks; shows closed while things are locked. */
export function LockButton({ className = "" }: { className?: string }) {
  const c = useLock();
  if (!c) return null;
  const closed = !!c.lock && !c.unlocked;
  return <button type="button" onClick={c.openSettings} aria-label="Passcode & locks" title={c.lock ? (closed ? "Locked — Passcode & locks" : "Unlocked — Passcode & locks") : "Set a passcode"} data-testid="hub-lock"
    className={`inline-flex h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50 ${className}`}>{closed || !c.lock ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4 text-emerald-600" />}</button>;
}
