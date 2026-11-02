// Pieces shared by the Notes screens: the sync hook, the notes password and unlock sheets, the
// appearance picker and the folder sheet.
import { useEffect, useState, type CSSProperties } from "react";
import { Fingerprint, KeyRound, Lock } from "lucide-react";
import { PAGE_COLORS, PAGE_FONTS, PAGE_FONT_IDS, PAPER_THEMES, PAPER_THEME_IDS, type Folder, type PageLook, type PageMeta, type PageSettings, type Vault } from "@shared/arisePages";
import { Btn, Notice, Sheet, Toggle } from "../ui";
import { pagesSyncFor, type PagesSync, type SyncState } from "./pagesSync";
import { currentKey, faceIdAvailable, faceIdForget, faceIdLoad, faceIdSave, makeVault, onLockChange, openText, rememberKey, unlockVault } from "./pagesLock";

export function usePages(userId: number) {
  const sync = pagesSyncFor(userId);
  const [snap, setSnap] = useState(() => sync.snapshot());
  useEffect(() => sync.subscribe(setSnap), [sync]);
  return { sync, metas: snap.metas, settings: snap.settings, state: snap.state, message: snap.message };
}

/** Re-renders when locked notes are unlocked or locked again. */
export function useUnlocked(vault: Vault | null) {
  const [, tick] = useState(0);
  useEffect(() => onLockChange(() => tick((n) => n + 1)), []);
  return currentKey(vault);
}

export const SYNC_WORDS: Record<SyncState, string> = { loading: "Loading…", synced: "Synced", syncing: "Syncing…", offline: "Offline: saved on this device", error: "Not synced yet" };

const fontsLoaded = new Set<string>();
/** Loads a note font from Google Fonts the first time it's used. */
export function loadPageFont(id: keyof typeof PAGE_FONTS) {
  const g = PAGE_FONTS[id]?.google;
  if (!g || fontsLoaded.has(g) || typeof document === "undefined") return;
  fontsLoaded.add(g);
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.href = `https://fonts.googleapis.com/css2?family=${g}&display=swap`;
  document.head.appendChild(l);
}

/** The note's paper as CSS: colour, font, size, spacing, ruled lines. */
export function lookStyle(look: PageLook): CSSProperties {
  const t = PAPER_THEMES[look.theme];
  const lh = Math.round(look.size * look.spacing);
  const lines = look.lines === "lined" ? `repeating-linear-gradient(to bottom, transparent 0, transparent ${lh - 1}px, ${t.line} ${lh - 1}px, ${t.line} ${lh}px)`
    : look.lines === "grid" ? `linear-gradient(${t.line} 1px, transparent 1px), linear-gradient(90deg, ${t.line} 1px, transparent 1px)`
      : look.lines === "dots" ? `radial-gradient(${t.line} 1.4px, transparent 1.6px)` : "none";
  return {
    background: t.bg, color: t.ink, fontFamily: PAGE_FONTS[look.font].css, fontSize: `${look.size}px`, lineHeight: `${lh}px`,
    backgroundImage: lines, backgroundSize: look.lines === "grid" || look.lines === "dots" ? `${lh}px ${lh}px` : undefined,
    backgroundAttachment: "local", colorScheme: t.dark ? "dark" : "light",
  };
}

// ─── Appearance ──────────────────────────────────────────────────────────────
export function AppearanceSheet({ look, onChange, onClose, onDefault }: { look: PageLook; onChange: (l: PageLook) => void; onClose: () => void; onDefault?: () => void }) {
  useEffect(() => { PAGE_FONT_IDS.forEach(loadPageFont); }, []);
  const set = (p: Partial<PageLook>) => onChange({ ...look, ...p });
  return <Sheet title="Appearance" onClose={onClose}>
    <div className="space-y-5" data-testid="pages-appearance">
      <section>
        <h3 className="mb-2 text-[14px] font-bold">Paper</h3>
        <div className="grid grid-cols-4 gap-2">{PAPER_THEME_IDS.map((id) => { const t = PAPER_THEMES[id]; return <button key={id} type="button" aria-pressed={look.theme === id} onClick={() => set({ theme: id })}
          className={`flex flex-col items-center gap-1 rounded-2xl border p-2 text-[12px] font-semibold ${look.theme === id ? "border-[var(--an-violet)] ring-2 ring-[var(--an-violet)]" : "border-[var(--an-line)]"}`}>
          <span className="grid h-10 w-full place-items-center rounded-xl text-[15px] font-bold" style={{ background: t.bg, color: t.ink, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)" }}>Aa</span>{t.name}</button>; })}</div>
      </section>
      <section>
        <h3 className="mb-2 text-[14px] font-bold">Font</h3>
        <div className="grid grid-cols-2 gap-2">{PAGE_FONT_IDS.map((id) => <button key={id} type="button" aria-pressed={look.font === id} onClick={() => set({ font: id })}
          className={`rounded-2xl border px-3 py-2.5 text-left text-[16px] ${look.font === id ? "border-[var(--an-violet)] bg-[#f7f5ff]" : "border-[var(--an-line)]"}`} style={{ fontFamily: PAGE_FONTS[id].css }}>{PAGE_FONTS[id].name}</button>)}</div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <label className="block text-[14px] font-bold">Text size <span className="font-normal text-[var(--an-muted)]">{look.size}</span>
          <input type="range" min={13} max={28} value={look.size} onChange={(e) => set({ size: Number(e.target.value) })} className="mt-2 w-full accent-[var(--an-violet)]" /></label>
        <label className="block text-[14px] font-bold">Line spacing <span className="font-normal text-[var(--an-muted)]">{look.spacing.toFixed(1)}</span>
          <input type="range" min={1.2} max={2.2} step={0.1} value={look.spacing} onChange={(e) => set({ spacing: Number(e.target.value) })} className="mt-2 w-full accent-[var(--an-violet)]" /></label>
      </section>
      <section>
        <h3 className="mb-2 text-[14px] font-bold">Lines</h3>
        <div className="flex flex-wrap gap-2">{(["none", "lined", "grid", "dots"] as const).map((l) => <button key={l} type="button" className="an-chip" aria-pressed={look.lines === l} onClick={() => set({ lines: l })}>{l === "none" ? "None" : l[0].toUpperCase() + l.slice(1)}</button>)}</div>
      </section>
      <Toggle on={look.wide} onChange={(v) => set({ wide: v })} label="Full width" hint="Use the whole screen instead of a comfortable reading width." />
      <div className="flex gap-2">{onDefault && <Btn kind="soft" className="flex-1" onClick={onDefault}>Use for new notes</Btn>}<Btn kind="primary" className="flex-1" onClick={onClose}>Done</Btn></div>
    </div>
  </Sheet>;
}

export function ColorDots({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">{PAGE_COLORS.map((c) => <button key={c || "none"} type="button" role="radio" aria-checked={value === c} aria-label={c || "No color"} onClick={() => onChange(c)}
    className={`grid h-8 w-8 place-items-center rounded-full border ${value === c ? "ring-2 ring-[var(--an-violet)] ring-offset-2" : ""}`} style={{ background: c || "#fff", borderColor: c ? c : "var(--an-line)" }}>{!c && <span className="h-0.5 w-4 rotate-45 bg-[var(--an-faint)]" />}</button>)}</div>;
}

// ─── Folders ─────────────────────────────────────────────────────────────────
const FOLDER_EMOJI = ["📁", "📚", "🍎", "💼", "🏠", "✨", "🧠", "🎨", "🗓️", "💡", "❤️", "🌱"];
export function FolderSheet({ folder, onSave, onDelete, onClose }: { folder: Folder | null; onSave: (f: { name: string; color: string; icon: string }) => void; onDelete?: () => void; onClose: () => void }) {
  const [name, setName] = useState(folder?.name ?? "");
  const [color, setColor] = useState(folder?.color ?? "#6a55dc");
  const [icon, setIcon] = useState(folder?.icon ?? "📁");
  return <Sheet title={folder ? "Edit folder" : "New folder"} onClose={onClose}>
    <div className="space-y-4">
      <input className="an-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Folder name" maxLength={40} autoFocus data-testid="pages-folder-name" />
      <div className="flex flex-wrap gap-2">{FOLDER_EMOJI.map((e) => <button key={e} type="button" aria-pressed={icon === e} onClick={() => setIcon(e)} className={`grid h-10 w-10 place-items-center rounded-xl text-[20px] ${icon === e ? "bg-[var(--an-violet-soft)] ring-2 ring-[var(--an-violet)]" : "bg-slate-50"}`}>{e}</button>)}</div>
      <ColorDots value={color} onChange={(c) => setColor(c || "#64748b")} />
      <div className="flex gap-2">
        {onDelete && <Btn kind="danger" onClick={onDelete}>Delete folder</Btn>}
        <Btn kind="primary" className="flex-1" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), color, icon })} data-testid="pages-folder-save">{folder ? "Save" : "Create"}</Btn>
      </div>
      {onDelete && <p className="text-[12px] text-[var(--an-faint)]">Deleting a folder keeps its notes; they move to All notes.</p>}
    </div>
  </Sheet>;
}

// ─── The notes password ──────────────────────────────────────────────────────
export function VaultSheet({ sync, settings, userId, onDone, onClose }: { sync: PagesSync; settings: PageSettings; userId: number; onDone: () => void; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [hint, setHint] = useState("");
  const [face, setFace] = useState(faceIdAvailable());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const make = async () => {
    if (pw.length < 6) { setError("Use at least 6 characters."); return; }
    if (pw !== again) { setError("The two passwords don't match."); return; }
    if (hint && pw.toLowerCase().includes(hint.toLowerCase())) { setError("The hint can't contain the password."); return; }
    setBusy(true);
    try {
      const { vault, key } = await makeVault(pw, hint);
      sync.saveSettings({ ...settings, vault });
      rememberKey(key, vault);
      if (face) await faceIdSave(userId, key);
      onDone();
    } catch { setError("Something went wrong. Try again."); }
    finally { setBusy(false); }
  };
  return <Sheet title={<span className="flex items-center gap-2"><KeyRound className="h-5 w-5" />Create a notes password</span>} onClose={onClose}>
    <div className="space-y-3" data-testid="pages-vault">
      <p className="text-[15px] leading-relaxed">One password locks all your locked notes. They're encrypted on this device before they're saved, so nobody else can read them, not even Arise.</p>
      <Notice tone="warn"><b>If you forget this password, your locked notes can't be recovered.</b> Arise can't reset it. Pick one you'll remember, and add a hint.</Notice>
      <input className="an-input" type="password" autoComplete="new-password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} data-testid="pages-vault-pw" />
      <input className="an-input" type="password" autoComplete="new-password" placeholder="Type it again" value={again} onChange={(e) => setAgain(e.target.value)} data-testid="pages-vault-again" />
      <input className="an-input" placeholder="Hint (optional)" value={hint} onChange={(e) => setHint(e.target.value)} maxLength={80} />
      {faceIdAvailable() && <Toggle on={face} onChange={setFace} label="Unlock with Face ID" hint="On this iPhone, Face ID can open locked notes instead of typing the password." />}
      {error && <Notice tone="bad">{error}</Notice>}
      <Btn kind="primary" className="w-full" busy={busy} onClick={() => void make()} data-testid="pages-vault-make"><Lock className="h-4 w-4" />Create password</Btn>
    </div>
  </Sheet>;
}

export function UnlockSheet({ settings, userId, onUnlocked, onForgot, onClose }: { settings: PageSettings; userId: number; onUnlocked: () => void; onForgot: () => void; onClose: () => void }) {
  const vault = settings.vault!;
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tries, setTries] = useState(0);
  const tryFace = async () => {
    const key = await faceIdLoad(userId);
    if (!key) return;
    // A key from Face ID is checked like a password.
    try { if ((await openText(key, vault.check)) === "arise-notes-vault-v1") { rememberKey(key, vault); onUnlocked(); return; } } catch { /* fall through */ }
    await faceIdForget(userId);
    setError("Face ID needs the password once more. Type it to turn Face ID back on.");
  };
  useEffect(() => { if (faceIdAvailable()) void tryFace(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const open = async () => {
    setBusy(true); setError("");
    const key = await unlockVault(vault, pw);
    setBusy(false);
    if (!key) { setTries((n) => n + 1); setError(tries >= 1 && vault.hint ? `That's not it. Hint: ${vault.hint}` : "That's not the notes password."); return; }
    rememberKey(key, vault);
    if (faceIdAvailable()) await faceIdSave(userId, key);
    onUnlocked();
  };
  return <Sheet title={<span className="flex items-center gap-2"><Lock className="h-5 w-5" />Locked note</span>} onClose={onClose}>
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void open(); }} data-testid="pages-unlock">
      <p className="text-[15px]">Type your notes password to open your locked notes.</p>
      <input className="an-input" type="password" autoComplete="current-password" autoFocus placeholder="Notes password" value={pw} onChange={(e) => setPw(e.target.value)} data-testid="pages-unlock-pw" />
      {error && <Notice tone="bad">{error}</Notice>}
      <Btn kind="primary" className="w-full" type="submit" busy={busy} disabled={!pw} data-testid="pages-unlock-go">Unlock</Btn>
      {faceIdAvailable() && <Btn kind="soft" className="w-full" type="button" onClick={() => void tryFace()}><Fingerprint className="h-4 w-4" />Use Face ID</Btn>}
      <button type="button" className="w-full py-2 text-[13px] font-semibold text-[var(--an-violet)]" onClick={onForgot}>Forgot your notes password?</button>
    </form>
  </Sheet>;
}

/** Forgot the password: the locked notes can only be cleared, then a new password made. */
export function ForgotSheet({ sync, settings, metas, userId, onDone, onClose }: { sync: PagesSync; settings: PageSettings; metas: PageMeta[]; userId: number; onDone: () => void; onClose: () => void }) {
  const locked = metas.filter((m) => m.locked);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const clear = async () => {
    setBusy(true);
    try {
      await sync.forever(locked.map((m) => m.id), true);
      await faceIdForget(userId);
      sync.saveSettings({ ...settings, vault: null });
      onDone();
    } finally { setBusy(false); }
  };
  return <Sheet title="Forgot your notes password" onClose={onClose}>
    <div className="space-y-3">
      {settings.vault?.hint && <Notice>Your hint: <b>{settings.vault.hint}</b></Notice>}
      <p className="text-[15px] leading-relaxed">Locked notes are encrypted with your password, and nobody, including Arise, can open them without it. If you can't remember it, you can delete your {locked.length === 1 ? "locked note" : `${locked.length} locked notes`} and make a new password.</p>
      <input className="an-input" placeholder='Type DELETE to confirm' value={typed} onChange={(e) => setTyped(e.target.value)} />
      <Btn kind="danger" className="w-full" busy={busy} disabled={typed.trim().toUpperCase() !== "DELETE"} onClick={() => void clear()}>Delete locked notes and reset</Btn>
    </div>
  </Sheet>;
}
