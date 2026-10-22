// Passcode lock screens and settings (shared/passLock.ts, client/src/lib/passLock.ts).
//  - LockScreen: covers the whole screen when a locked page or app is opened.
//  - PasscodePrompt: the same keypad as a pop-up, for one locked thing (a note).
//  - PassLockSettings: set, change or turn off the passcode, and choose what is locked.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Delete, Lock, LockOpen, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { markUnlocked, type PassGate } from "@/lib/passLock";
import { LOCK_MINUTES, makePassLock, toggleLocked, validPasscode, type PassLock } from "@shared/passLock";

/** Dots for what's typed, a number pad for phones, and the keyboard works too. */
export function PasscodePad({ onSubmit, busy, error, autoFocus = true, testId = "passcode" }: { onSubmit: (code: string) => void; busy?: boolean; error?: string; autoFocus?: boolean; testId?: string }) {
  const [code, setCode] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (error) setCode(""); }, [error]);
  useEffect(() => { if (autoFocus) input.current?.focus({ preventScroll: true }); }, [autoFocus]);
  const press = (d: string) => setCode((c) => (c.length < 8 ? c + d : c));
  const submit = () => { if (validPasscode(code) && !busy) onSubmit(code); };
  const key = "flex h-14 w-14 items-center justify-center rounded-full bg-white/80 text-xl font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-white active:scale-95 sm:h-16 sm:w-16";
  return <div className="flex flex-col items-center" data-testid={testId}>
    <input ref={input} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))} onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
      inputMode="numeric" autoComplete="off" type="password" aria-label="Passcode" className="sr-only" data-testid={`${testId}-input`} />
    <button type="button" onClick={() => input.current?.focus()} className="flex h-8 items-center gap-3" aria-hidden tabIndex={-1}>
      {Array.from({ length: Math.max(4, code.length) }, (_, i) => <span key={i} className={`h-3.5 w-3.5 rounded-full border-2 ${i < code.length ? "border-violet-600 bg-violet-600" : "border-slate-400"}`} />)}
    </button>
    <p className={`mt-2 min-h-5 text-center text-sm font-semibold ${error ? "text-rose-600" : "text-slate-500"}`} role={error ? "alert" : undefined}>{error || (code.length >= 4 ? "Press Enter or ✓" : "")}</p>
    <div className="mt-3 grid grid-cols-3 gap-3">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <button key={d} type="button" className={key} onClick={() => press(d)}>{d}</button>)}
      <button type="button" className={key + " text-slate-500"} onClick={() => setCode((c) => c.slice(0, -1))} aria-label="Delete"><Delete size={20} /></button>
      <button type="button" className={key} onClick={() => press("0")}>0</button>
      <button type="button" className={key + " !bg-violet-600 text-white ring-violet-600 disabled:opacity-40"} onClick={submit} disabled={!validPasscode(code) || busy} aria-label="Unlock" data-testid={`${testId}-ok`}>✓</button>
    </div>
  </div>;
}

function useUnlock(gate: PassGate, onDone?: () => void) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const tries = useRef(0);
  const submit = async (code: string) => {
    setBusy(true);
    const ok = await gate.unlock(code).catch(() => false);
    setBusy(false);
    if (ok) { tries.current = 0; setError(""); onDone?.(); return; }
    tries.current += 1;
    setError(tries.current >= 5 ? "Wrong passcode. Forgot it? Use your account password below." : "Wrong passcode. Try again.");
  };
  return { error, busy, submit };
}

/** Covers the screen while something locked is open. `onLeave` goes somewhere that isn't locked. */
export function LockScreen({ gate, title, onLeave, onForgot }: { gate: PassGate; title: string; onLeave: () => void; onForgot: () => void }) {
  const u = useUnlock(gate);
  return createPortal(
    <div className="fixed inset-0 z-[650] flex flex-col items-center justify-center overflow-y-auto bg-gradient-to-b from-violet-50 to-slate-100 px-4 py-8" role="dialog" aria-modal="true" aria-label={`${title} is locked`} data-testid="lock-screen">
      <button type="button" onClick={onLeave} className="absolute left-3 top-3 inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-bold text-violet-700 hover:bg-white" style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>← Back</button>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg"><Lock size={26} /></span>
      <h2 className="mt-4 text-center text-xl font-black text-slate-900">{title} is locked</h2>
      <p className="mb-5 mt-1 text-center text-sm text-slate-600">Enter your passcode</p>
      <PasscodePad onSubmit={u.submit} busy={u.busy} error={u.error} testId="lock-screen-pad" />
      <button type="button" onClick={onForgot} className="mt-6 min-h-10 text-sm font-semibold text-slate-500 underline-offset-2 hover:text-violet-700 hover:underline">Forgot passcode?</button>
    </div>,
    document.body,
  );
}

function Sheet({ title, onClose, children, testId }: { title: string; onClose: () => void; children: ReactNode; testId?: string }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 kb-sheet z-[660] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid={testId}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl bg-slate-50 p-5 shadow-2xl sm:max-w-sm sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-black text-slate-900">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200"><X size={20} /></button></div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Asks for the passcode as a pop-up (to open one locked note, or before changing what's locked). */
export function PasscodePrompt({ gate, title = "Enter passcode", onDone, onClose, onForgot }: { gate: PassGate; title?: string; onDone: () => void; onClose: () => void; onForgot: () => void }) {
  const u = useUnlock(gate, onDone);
  return <Sheet title={title} onClose={onClose} testId="passcode-prompt">
    <PasscodePad onSubmit={u.submit} busy={u.busy} error={u.error} testId="prompt-pad" />
    <button type="button" onClick={onForgot} className="mx-auto mt-5 block min-h-10 text-sm font-semibold text-slate-500 hover:text-violet-700">Forgot passcode?</button>
  </Sheet>;
}

/** Forgot the passcode: the account password turns the lock off. */
export function ForgotPasscode({ onCleared, onClose }: { onCleared: () => void; onClose: () => void }) {
  const { token } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/pass-lock/check-password`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ password }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.message || "That didn't work. Try again."); return; }
      onCleared();
    } catch { setError("No connection. Try again."); } finally { setBusy(false); }
  };
  return <Sheet title="Forgot passcode" onClose={onClose} testId="forgot-passcode">
    <p className="text-sm leading-6 text-slate-600">Type the password you sign in with. The passcode is turned off and everything opens; you can set a new one in Settings.</p>
    <form onSubmit={(e) => { e.preventDefault(); if (password) void go(); }} className="mt-4 space-y-3">
      <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" aria-label="Account password" placeholder="Account password" className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
      {error && <p className="text-sm font-semibold text-rose-600" role="alert">{error}</p>}
      <button type="submit" disabled={!password || busy} className="min-h-12 w-full rounded-xl bg-violet-600 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">{busy ? "Checking…" : "Turn off passcode"}</button>
    </form>
  </Sheet>;
}

export type LockItem = { id: string; label: string; group: string; icon?: ReactNode };

/** Settings: the passcode and what it locks. */
export function PassLockSettings({ hub, gate, lock, setLock, items, onForgot }: { hub: "life" | "work"; gate: PassGate; lock: PassLock | undefined; setLock: (next: PassLock | undefined) => void; items: LockItem[]; onForgot: () => void }) {
  const [step, setStep] = useState<null | "new" | "confirm" | "verify-change" | "verify-off" | "verify-edit">(null);
  const [first, setFirst] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<null | (() => void)>(null);
  const close = () => { setStep(null); setFirst(""); setError(""); setPending(null); };
  /** Changing what's locked needs the hub to be unlocked first. */
  const guarded = (run: () => void) => { if (!lock || gate.unlocked) run(); else { setPending(() => run); setStep("verify-edit"); } };
  const groups = [...new Set(items.map((i) => i.group))];
  const count = lock?.locked.length ?? 0;

  return <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6" data-testid="passlock-settings">
    <div className="flex flex-wrap items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><ShieldCheck size={22} /></span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-black text-slate-900">Passcode lock</h2>
        <p className="mt-0.5 text-sm leading-6 text-slate-600">{lock ? `On · ${count} ${count === 1 ? "thing" : "things"} locked · locks again after ${lock.minutes} min without use` : "Lock your journal, money, a note or any app behind a passcode, so others using this phone or computer can't open them."}</p>
      </div>
      {lock && gate.unlocked && <button type="button" onClick={gate.lockNow} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50" data-testid="lock-now"><Lock size={16} /> Lock now</button>}
    </div>

    {!lock ? <button type="button" onClick={() => setStep("new")} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-bold text-white hover:bg-violet-700" data-testid="passlock-set"><Lock size={16} /> Set a passcode</button>
      : <>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setStep("verify-change")} className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Change passcode</button>
          <button type="button" onClick={() => setStep("verify-off")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 text-sm font-bold text-rose-700 hover:bg-rose-100" data-testid="passlock-off"><LockOpen size={16} /> Turn off</button>
          <label className="ml-auto inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600">Lock again after
            <select value={lock.minutes} onChange={(e) => { const m = Number(e.target.value); guarded(() => setLock({ ...lock, minutes: m })); }} className="min-h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm font-bold" aria-label="Lock again after">{LOCK_MINUTES.map((m) => <option key={m} value={m}>{m} min</option>)}</select>
          </label>
        </div>
        <h3 className="mt-6 text-xs font-extrabold uppercase tracking-[.14em] text-slate-500">What's locked</h3>
        <div className="mt-2 space-y-4">
          {groups.map((g) => <div key={g}>
            <p className="mb-1.5 text-xs font-bold text-slate-500">{g}</p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {items.filter((i) => i.group === g).map((i) => { const on = lock.locked.includes(i.id); return <button key={i.id} type="button" aria-pressed={on} onClick={() => guarded(() => setLock(toggleLocked(lock, i.id, !on)))} data-testid={`lock-item-${i.id}`}
                className={`flex min-h-11 items-center gap-2.5 rounded-xl border px-3 text-left text-sm font-semibold transition ${on ? "border-violet-300 bg-violet-50 text-violet-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                {i.icon && <span className="flex h-5 w-5 shrink-0 items-center justify-center [&_svg]:h-[18px] [&_svg]:w-[18px]">{i.icon}</span>}
                <span className="min-w-0 flex-1 truncate">{i.label}</span>
                {on ? <Lock size={15} className="shrink-0 text-violet-700" /> : <LockOpen size={15} className="shrink-0 text-slate-300" />}
              </button>; })}
            </div>
          </div>)}
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">To lock one note, open it in Notes and tap the lock. The passcode keeps people out of this screen; it doesn't encrypt your saved data.</p>
      </>}

    {(step === "new" || step === "confirm") && <Sheet title={step === "new" ? "Choose a passcode" : "Type it again"} onClose={close} testId="passlock-new">
      <p className="mb-4 text-center text-sm text-slate-600">{step === "new" ? "4 to 8 numbers. Don't use your phone's passcode." : "Type the same passcode to make sure."}</p>
      <PasscodePad key={step} busy={busy} error={error} testId={`passlock-${step}`} onSubmit={async (code) => {
        if (step === "new") { setFirst(code); setError(""); setStep("confirm"); return; }
        if (code !== first) { setError("Those didn't match. Start again."); setFirst(""); setStep("new"); return; }
        setBusy(true);
        try { const next = await makePassLock(code, lock ? { locked: lock.locked, minutes: lock.minutes } : undefined); setLock(next); markUnlocked(hub); close(); }
        catch (e: any) { setError(e?.message || "Couldn't set it."); }
        finally { setBusy(false); }
      }} />
    </Sheet>}
    {(step === "verify-change" || step === "verify-off" || step === "verify-edit") && <PasscodePrompt gate={gate} title={step === "verify-off" ? "Passcode to turn it off" : "Enter your passcode"} onClose={close} onForgot={() => { close(); onForgot(); }}
      onDone={() => { if (step === "verify-off") { setLock(undefined); close(); } else if (step === "verify-change") { setStep("new"); } else { const run = pending; close(); run?.(); } }} />}
  </section>;
}
