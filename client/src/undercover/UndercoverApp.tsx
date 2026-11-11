// Arise Undercover: an AI chat that looks like something else. Six looks (shared/undercover.ts):
// three that look like texting and three that look like a document. Chats stay on this device.
// The settings sheet opens from each look's own back / close / file button, so nothing on screen
// says "AI". In the inbox and phone doc looks, tapping the name or title hides the AI chat.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { API_BASE, apiAuthToken } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { UNDERCOVER_THEMES, answerLines, wantsWeather, weatherPlaceFrom, type UndercoverMsg, type UndercoverTheme } from "@shared/undercover";

type Saved = { theme: UndercoverTheme; contact: string; city: string; unit: "F" | "C"; chats: Partial<Record<UndercoverTheme, UndercoverMsg[]>> };
const KEY = "arise-undercover-v1";
const load = (): Saved => {
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && typeof s === "object") return { theme: s.theme || "text", contact: s.contact || "Sam", city: s.city || "", unit: s.unit === "C" ? "C" : "F", chats: s.chats || {} }; } catch { /* first time */ }
  const metric = (() => { try { return !/^en-US|^en-LR|^my/.test(navigator.language || "en-US"); } catch { return false; } })();
  return { theme: "text", contact: "Sam", city: "", unit: metric ? "C" : "F", chats: {} };
};
const store = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full */ } };

/** The phone's location, only for a weather question with no city named or saved (4 seconds at most). */
const here = (): Promise<{ lat: number; lon: number } | null> => new Promise((done) => {
  if (!navigator.geolocation) return done(null);
  const t = setTimeout(() => done(null), 4000);
  navigator.geolocation.getCurrentPosition((p) => { clearTimeout(t); done({ lat: p.coords.latitude, lon: p.coords.longitude }); }, () => { clearTimeout(t); done(null); }, { maximumAge: 30 * 60_000, timeout: 4000 });
});

async function askAi(theme: UndercoverTheme, messages: UndercoverMsg[], prefs: { city: string; unit: "F" | "C" }): Promise<string> {
  const token = apiAuthToken();
  const q = messages[messages.length - 1]?.content || "";
  const coords = wantsWeather(q) && !prefs.city && !weatherPlaceFrom(q) ? await here() : null;
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; } })();
  const res = await fetch(`${API_BASE}/api/undercover/chat`, {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ theme, messages, tz, place: prefs.city, unit: prefs.unit, ...(coords || {}) }),
  }).catch(() => null);
  if (!res) throw new Error("You seem to be offline.");
  const d = await res.json().catch(() => null);
  if (!res.ok) throw new Error(d?.message || "Couldn't get an answer. Try again.");
  return String(d?.reply || "");
}

const FONT = "Inter, system-ui, -apple-system, sans-serif";
const SERIF = "'Source Serif 4', Georgia, serif";
const TOP = "max(14px, env(safe-area-inset-top))";
const BOTTOM = "max(14px, env(safe-area-inset-bottom))";
const hidden: CSSProperties = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" };
const iconBtn: CSSProperties = { width: 44, height: 44, border: 0, background: "none", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const Chevron = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>;
const Up = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>;
const Close = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>;

/** The chat behind every look: the saved messages, sending, and the answer coming back. */
function useChat(theme: UndercoverTheme, saved: Saved, save: (s: Saved) => void) {
  const msgs = saved.chats[theme] || [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(saved); latest.current = saved;
  const send = async (text: string) => {
    const q = text.trim().slice(0, 2000);
    if (!q || busy) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    save({ ...latest.current, chats: { ...latest.current.chats, [theme]: next } });
    setBusy(true); setError("");
    try {
      const reply = await askAi(theme, next.slice(-16), { city: latest.current.city, unit: latest.current.unit });
      save({ ...latest.current, chats: { ...latest.current.chats, [theme]: [...next, { role: "assistant", content: reply }] } });
    } catch (e: any) { setError(e?.message || "Couldn't get an answer."); }
    finally { setBusy(false); }
  };
  return { msgs, busy, error, send };
}

function Composer({ onSend, placeholder, style, inputStyle, button, id }: { onSend: (t: string) => void; placeholder: string; style: CSSProperties; inputStyle: CSSProperties; button?: CSSProperties; id: string }) {
  const [draft, setDraft] = useState("");
  const go = () => { if (draft.trim()) { onSend(draft); setDraft(""); } };
  return <form style={style} onSubmit={(e) => { e.preventDefault(); go(); }}>
    <label htmlFor={id} style={hidden}>Message</label>
    <input id={id} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} autoComplete="off" enterKeyHint="send" style={{ flex: 1, minWidth: 0, height: 44, boxSizing: "border-box", fontSize: 16, fontFamily: "inherit", ...inputStyle }} />
    {button && <button type="submit" aria-label="Send" style={{ ...iconBtn, borderRadius: 22, color: "#fff", ...button }}><Up /></button>}
  </form>;
}

function useScrollEnd(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, [dep]);
  return ref;
}

// ─── Looks like texting ─────────────────────────────────────────────────────
function TextLook({ chat, contact, onMenu, accent = "#2563eb" }: { chat: ReturnType<typeof useChat>; contact: string; onMenu: () => void; accent?: string }) {
  const end = useScrollEnd(chat.msgs.length + (chat.busy ? 1 : 0));
  return <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#fff", color: "#111827", fontFamily: FONT }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: `${TOP} 12px 10px`, borderBottom: "1px solid #e5e7eb" }}>
      <button aria-label="Back" onClick={onMenu} style={{ ...iconBtn, color: accent }}><Chevron /></button>
      <div style={{ width: 40, height: 40, borderRadius: 20, background: "#c7d2fe", color: "#3730a3", display: "grid", placeItems: "center", fontWeight: 600 }}>{contact.slice(0, 1).toUpperCase()}</div>
      <div><div style={{ fontWeight: 600, fontSize: 16 }}>{contact}</div><div style={{ fontSize: 12, color: "#4b5563" }}>{chat.busy ? "typing…" : "Active now"}</div></div>
    </div>
    <div ref={end} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      {chat.msgs.map((m, i) => <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
        <div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: 18, fontSize: 15, lineHeight: 1.4, whiteSpace: "pre-wrap", ...(m.role === "user" ? { background: accent, color: "#fff" } : { background: "#f1f5f9" }) }}>{m.content}</div>
      </div>)}
      {chat.busy && <div style={{ alignSelf: "flex-start", background: "#f1f5f9", borderRadius: 18, padding: "10px 14px", color: "#4b5563" }}>typing…</div>}
      {chat.error && <div style={{ alignSelf: "center", fontSize: 12, color: "#b91c1c" }}>Not delivered. {chat.error}</div>}
    </div>
    <Composer id="uc-text" onSend={chat.send} placeholder="Text message" style={{ display: "flex", gap: 8, padding: `10px 12px ${BOTTOM}`, borderTop: "1px solid #e5e7eb" }} inputStyle={{ border: "1px solid #d1d5db", borderRadius: 22, padding: "0 16px", color: "#111827" }} button={{ background: accent }} />
  </div>;
}

const FRIENDS = [{ name: "Jess", bg: "#f59e0b", fg: "#1c1917" }, { name: "Mike", bg: "#34d399", fg: "#052e16" }, { name: "Riley", bg: "#a78bfa", fg: "#2e1065" }];
function GroupLook({ chat, contact, onMenu }: { chat: ReturnType<typeof useChat>; contact: string; onMenu: () => void }) {
  // Each answer is split into short messages from the three friends, taking turns.
  const rows = useMemo(() => {
    const out: { me: boolean; who: string; text: string }[] = [];
    let turn = 0;
    for (const m of chat.msgs) {
      if (m.role === "user") { out.push({ me: true, who: "", text: m.content }); continue; }
      for (const line of answerLines(m.content)) out.push({ me: false, who: FRIENDS[turn++ % 3].name, text: line });
    }
    return out;
  }, [chat.msgs]);
  const end = useScrollEnd(rows.length + (chat.busy ? 1 : 0));
  return <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#0b0b0f", color: "#f3f4f6", fontFamily: FONT }}>
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: `${TOP} 16px 10px`, borderBottom: "1px solid #27272a" }}>
      <button aria-label="Back" onClick={onMenu} style={{ ...iconBtn, color: "#4ade80", position: "absolute", left: 8, top: `calc(${TOP} - 4px)` }}><Chevron /></button>
      <div style={{ display: "flex" }}>{FRIENDS.map((f, i) => <div key={f.name} style={{ width: 32, height: 32, borderRadius: 16, background: f.bg, color: f.fg, display: "grid", placeItems: "center", fontWeight: 600, fontSize: 13, border: "2px solid #0b0b0f", marginLeft: i ? -10 : 0 }}>{f.name[0]}</div>)}</div>
      <div style={{ fontWeight: 600, fontSize: 15 }}>{contact}</div>
      <div style={{ fontSize: 12, color: "#a1a1aa" }}>Jess, Mike, Riley</div>
    </div>
    <div ref={end} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((r, i) => <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: r.me ? "flex-end" : "flex-start" }}>
        {!r.me && (i === 0 || rows[i - 1].who !== r.who) && <div style={{ fontSize: 12, color: "#a1a1aa", padding: "6px 12px 2px" }}>{r.who}</div>}
        <div style={{ maxWidth: "78%", padding: "9px 14px", borderRadius: 18, fontSize: 15, lineHeight: 1.4, background: r.me ? "#16a34a" : "#1f1f23", color: r.me ? "#fff" : "#f3f4f6" }}>{r.text}</div>
      </div>)}
      {chat.busy && <div style={{ alignSelf: "flex-start", background: "#1f1f23", borderRadius: 18, padding: "9px 14px", color: "#a1a1aa", fontSize: 14 }}>{FRIENDS[rows.filter((r) => !r.me).length % 3].name} is typing…</div>}
      {chat.error && <div style={{ alignSelf: "center", fontSize: 12, color: "#fca5a5" }}>Not delivered. {chat.error}</div>}
    </div>
    <Composer id="uc-group" onSend={chat.send} placeholder="Message" style={{ display: "flex", gap: 8, padding: `10px 12px ${BOTTOM}`, borderTop: "1px solid #27272a" }} inputStyle={{ border: "1px solid #3f3f46", background: "#18181b", borderRadius: 22, padding: "0 16px", color: "#f3f4f6" }} button={{ background: "#16a34a" }} />
  </div>;
}

const DECOY: UndercoverMsg[] = [{ role: "assistant", content: "running 5 min late, save me a seat" }, { role: "user", content: "np" }, { role: "assistant", content: "grabbing coffee want one?" }];
function InboxLook({ chat, contact, onMenu }: { chat: ReturnType<typeof useChat>; contact: string; onMenu: () => void }) {
  const [open, setOpen] = useState(true);
  const [decoy, setDecoy] = useState(false);
  const shown = decoy ? DECOY : chat.msgs;
  const last = shown[shown.length - 1]?.content || "";
  const others = [["Mom", "Call me when you can", "8:12", "#fecaca", "#7f1d1d"], ["Team lunch", "Tacos again?", "Yesterday", "#bbf7d0", "#14532d"], ["Chris", "Thanks!", "Yesterday", "#fde68a", "#78350f"], ["Landlord", "Plumber is coming Thursday", "Mon", "#e9d5ff", "#4c1d95"]];
  const end = useScrollEnd(shown.length + (chat.busy ? 1 : 0) + (open ? 1 : 0));
  if (!open) return <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#f8fafc", color: "#0f172a", fontFamily: FONT }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${TOP} 20px 10px` }}>
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Chats</h1>
      <button onClick={onMenu} style={{ ...iconBtn, width: "auto", color: "#2563eb", fontFamily: FONT, fontSize: 16 }}>Edit</button>
    </div>
    <div style={{ overflowY: "auto" }}>
      {[[contact, last || "sounds good", "9:41", "#bfdbfe", "#1e3a8a"], ...others].map(([name, preview, time, bg, fg], i) =>
        <button key={name} onClick={() => i === 0 && setOpen(true)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", border: 0, borderBottom: "1px solid #e2e8f0", background: "none", textAlign: "left", fontFamily: FONT, color: "inherit", minHeight: 72 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: bg, color: fg, display: "grid", placeItems: "center", fontWeight: 600, flexShrink: 0 }}>{name[0]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: 600, fontSize: 16 }}>{name}</span><span style={{ fontSize: 13, color: "#475569" }}>{time}</span></div>
            <div style={{ fontSize: 14, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{preview}</div>
          </div>
        </button>)}
    </div>
  </div>;
  return <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#fff", color: "#0f172a", fontFamily: FONT }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: `${TOP} 12px 10px`, borderBottom: "1px solid #e2e8f0" }}>
      <button aria-label="Back to chats" onClick={() => setOpen(false)} style={{ ...iconBtn, color: "#2563eb" }}><Chevron /></button>
      <button onClick={() => setDecoy(!decoy)} aria-label={`${contact}, tap to switch`} style={{ flex: 1, border: 0, background: "none", textAlign: "left", fontFamily: FONT, color: "inherit", minHeight: 44 }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{contact}</div><div style={{ fontSize: 12, color: "#475569" }}>Active now</div>
      </button>
    </div>
    <div ref={end} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      {shown.map((m, i) => <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
        <div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: 18, fontSize: 15, lineHeight: 1.4, whiteSpace: "pre-wrap", ...(m.role === "user" ? { background: "#2563eb", color: "#fff" } : { background: "#f1f5f9" }) }}>{m.content}</div>
      </div>)}
      {!decoy && chat.busy && <div style={{ alignSelf: "flex-start", background: "#f1f5f9", borderRadius: 18, padding: "10px 14px", color: "#475569" }}>typing…</div>}
      {!decoy && chat.error && <div style={{ alignSelf: "center", fontSize: 12, color: "#b91c1c" }}>Not delivered. {chat.error}</div>}
    </div>
    <Composer id="uc-inbox" onSend={(t) => { setDecoy(false); chat.send(t); }} placeholder="Message" style={{ display: "flex", gap: 8, padding: `10px 12px ${BOTTOM}`, borderTop: "1px solid #e2e8f0" }} inputStyle={{ border: "1px solid #cbd5e1", borderRadius: 22, padding: "0 16px" }} button={{ background: "#2563eb" }} />
  </div>;
}

// ─── Looks like a document ──────────────────────────────────────────────────
const pairs = (msgs: UndercoverMsg[]) => {
  const out: { q: string; a: string | null }[] = [];
  for (const m of msgs) { if (m.role === "user") out.push({ q: m.content, a: null }); else if (out.length) out[out.length - 1].a = m.content; }
  return out;
};
function DocBar({ title, onMenu, saving, accent }: { title: string; onMenu: () => void; saving: boolean; accent: string }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 12, padding: `${TOP} 16px 10px`, background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
    <button aria-label="File" onClick={onMenu} style={{ ...iconBtn, width: 32, height: 40, borderRadius: 4, background: accent }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 7h12M6 12h12M6 17h8" /></svg>
    </button>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 16, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
      <div style={{ display: "flex", gap: 14, fontSize: 13, color: "#475569" }}>{["File", "Edit", "View", "Insert", "Format"].map((x) => <span key={x}>{x}</span>)}</div>
    </div>
    <div style={{ fontSize: 13, color: "#475569", whiteSpace: "nowrap" }}>{saving ? "Saving…" : "All changes saved"}</div>
  </div>;
}

function DocNotesLook({ chat, onMenu }: { chat: ReturnType<typeof useChat>; onMenu: () => void }) {
  const items = pairs(chat.msgs);
  const end = useScrollEnd(chat.msgs.length + (chat.busy ? 1 : 0));
  const [draft, setDraft] = useState("");
  const key = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter" && draft.trim()) { chat.send(draft); setDraft(""); } };
  return <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#eef1f5", color: "#1f2937", fontFamily: FONT }}>
    <DocBar title="Meeting notes" onMenu={onMenu} saving={chat.busy} accent="#1d4ed8" />
    <div ref={end} style={{ flex: 1, overflowY: "auto", padding: "20px 12px" }}>
      <div style={{ maxWidth: 816, margin: "0 auto", minHeight: "100%", boxSizing: "border-box", background: "#fff", boxShadow: "0 1px 3px rgba(15,23,42,.12)", padding: "clamp(24px, 6vw, 72px) clamp(20px, 8vw, 96px)", fontFamily: SERIF, fontSize: 16, lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>Meeting notes</h1>
        <div style={{ color: "#475569", fontSize: 14 }}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
        {items.map((it, i) => <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
          <div style={{ fontWeight: 600 }}>{it.q}</div>
          {it.a && <div style={{ whiteSpace: "pre-line" }}>{it.a}</div>}
        </div>)}
        {chat.busy && <div style={{ color: "#64748b" }}>…</div>}
        {chat.error && <div style={{ color: "#b91c1c", fontSize: 14 }}>{chat.error}</div>}
        <label htmlFor="uc-docnotes" style={hidden}>Type a note</label>
        <input id="uc-docnotes" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={key} enterKeyHint="send" autoComplete="off" placeholder="Type a note…" style={{ border: 0, outline: "none", padding: "4px 0", fontFamily: SERIF, fontSize: 16, color: "#1f2937", background: "transparent", minHeight: 44 }} />
      </div>
    </div>
  </div>;
}

function DocCommentsLook({ chat, onMenu }: { chat: ReturnType<typeof useChat>; onMenu: () => void }) {
  const items = pairs(chat.msgs);
  const end = useScrollEnd(chat.msgs.length + (chat.busy ? 1 : 0));
  const av = (bg: string, fg: string): CSSProperties => ({ width: 30, height: 30, borderRadius: 15, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 600, background: bg, color: fg });
  return <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#eef1f5", color: "#1f2937", fontFamily: FONT }}>
    <DocBar title="Proposal — review" onMenu={onMenu} saving={chat.busy} accent="#0f766e" />
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "999 1 420px", minWidth: 0, overflowY: "auto", padding: "20px 12px", maxHeight: "100%" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", background: "#fff", boxShadow: "0 1px 3px rgba(15,23,42,.12)", padding: "clamp(24px, 6vw, 64px)", fontFamily: SERIF, fontSize: 15, lineHeight: 1.65, display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Proposal</h1>
          <p style={{ margin: 0 }}>Draft for review. Add questions and comments in the panel.</p>
          <p style={{ margin: 0, color: "#94a3b8" }}>[Paste or type the document here]</p>
        </div>
      </div>
      <div style={{ flex: "1 1 320px", minWidth: 0, background: "#f8fafc", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", maxHeight: "100%" }}>
        <div ref={end} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((it, i) => <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 10 }}><div style={av("#bfdbfe", "#1e3a8a")}>Y</div><div><div style={{ fontSize: 13, fontWeight: 600 }}>You</div><div style={{ fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-line" }}>{it.q}</div></div></div>
            {it.a && <div style={{ display: "flex", gap: 10 }}><div style={av("#99f6e4", "#134e4a")}>P</div><div><div style={{ fontSize: 13, fontWeight: 600 }}>Priya Shah</div><div style={{ fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-line" }}>{it.a}</div></div></div>}
          </div>)}
          {chat.busy && <div style={{ fontSize: 13, color: "#64748b" }}>Priya is replying…</div>}
          {chat.error && <div style={{ fontSize: 13, color: "#b91c1c" }}>{chat.error}</div>}
        </div>
        <Composer id="uc-comments" onSend={chat.send} placeholder="Add a comment…" style={{ display: "flex", gap: 8, padding: `12px 16px ${BOTTOM}`, borderTop: "1px solid #e2e8f0" }} inputStyle={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "0 12px" }} button={{ background: "#0f766e" }} />
      </div>
    </div>
  </div>;
}

function DocPhoneLook({ chat, onMenu }: { chat: ReturnType<typeof useChat>; onMenu: () => void }) {
  const [hide, setHide] = useState(false);
  const items = pairs(chat.msgs);
  const end = useScrollEnd(chat.msgs.length + (chat.busy ? 1 : 0));
  return <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#fff", color: "#1f2937", fontFamily: FONT }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: `${TOP} 12px 8px`, borderBottom: "1px solid #e2e8f0" }}>
      <button aria-label="Close" onClick={onMenu} style={{ ...iconBtn, color: "#334155" }}><Close /></button>
      <button onClick={() => setHide(!hide)} style={{ flex: 1, border: 0, background: "none", fontFamily: FONT, fontSize: 16, fontWeight: 600, color: "inherit", textAlign: "left", minHeight: 44 }}>Notes</button>
      <div style={{ fontSize: 13, color: "#475569", paddingRight: 8 }}>{chat.busy ? "Saving…" : "Saved"}</div>
    </div>
    <div ref={end} style={{ flex: 1, overflowY: "auto", padding: "20px 22px", fontFamily: SERIF, fontSize: 16, lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 10 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Notes — {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}</h1>
      {!hide && items.map((it, i) => <div key={i}>
        <div style={{ fontWeight: 600 }}>{it.q}</div>
        {it.a && <ul style={{ margin: "2px 0 0", paddingLeft: 20 }}>{answerLines(it.a).map((l, j) => <li key={j}>{l}</li>)}</ul>}
      </div>)}
      {!hide && chat.busy && <div style={{ color: "#64748b" }}>…</div>}
      {!hide && chat.error && <div style={{ color: "#b91c1c", fontSize: 14 }}>{chat.error}</div>}
    </div>
    <Composer id="uc-phone" onSend={(t) => { setHide(false); chat.send(t); }} placeholder="Add a line…" style={{ display: "flex", padding: `10px 12px ${BOTTOM}`, borderTop: "1px solid #e2e8f0" }} inputStyle={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 14px" }} />
  </div>;
}

// ─── Settings ───────────────────────────────────────────────────────────────
function Settings({ saved, save, onClose, onExit }: { saved: Saved; save: (s: Saved) => void; onClose: () => void; onExit?: () => void }) {
  const { logout } = useAuth();
  const [contact, setContact] = useState(saved.contact);
  const [city, setCity] = useState(saved.city);
  const pick = (theme: UndercoverTheme) => { save({ ...saved, theme, contact: contact.trim() || "Sam", city: city.trim() }); onClose(); };
  return <div role="dialog" aria-modal="true" aria-label="Settings" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50, fontFamily: FONT }} onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "88dvh", overflowY: "auto", background: "#fff", color: "#0f172a", borderRadius: "20px 20px 0 0", padding: `20px 20px ${BOTTOM}`, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Look</h2>
        <button aria-label="Close settings" onClick={onClose} style={{ ...iconBtn, color: "#334155" }}><Close /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {UNDERCOVER_THEMES.map((t) => <button key={t.id} onClick={() => pick(t.id)} style={{ textAlign: "left", padding: 12, borderRadius: 12, border: `2px solid ${saved.theme === t.id ? "#6d3df5" : "#e2e8f0"}`, background: saved.theme === t.id ? "#f5f3ff" : "#fff", fontFamily: FONT, color: "inherit", minHeight: 76 }}>
          <div style={{ fontSize: 12, color: "#6d3df5", fontWeight: 600 }}>{t.kind === "text" ? "Texting" : "Document"}</div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{t.name}</div>
          <div style={{ fontSize: 13, color: "#475569" }}>{t.blurb}</div>
        </button>)}
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 500 }}>Contact or group name
        <input value={contact} maxLength={30} onChange={(e) => setContact(e.target.value)} onBlur={() => save({ ...saved, contact: contact.trim() || "Sam" })} style={{ height: 44, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 12px", fontSize: 16, fontFamily: FONT }} />
      </label>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 500 }}>Your city, for the weather
          <input value={city} maxLength={60} placeholder="Uses your location if empty" onChange={(e) => setCity(e.target.value)} onBlur={() => save({ ...saved, city: city.trim() })} style={{ height: 44, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 12px", fontSize: 16, fontFamily: FONT }} />
        </label>
        <div role="group" aria-label="Temperature unit" style={{ display: "flex", border: "1px solid #cbd5e1", borderRadius: 10, overflow: "hidden" }}>
          {(["F", "C"] as const).map((x) => <button key={x} aria-pressed={saved.unit === x} onClick={() => save({ ...saved, city: city.trim(), unit: x })} style={{ width: 48, height: 44, border: 0, background: saved.unit === x ? "#6d3df5" : "#fff", color: saved.unit === x ? "#fff" : "#0f172a", fontFamily: FONT, fontWeight: 600 }}>°{x}</button>)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => { save({ ...saved, chats: { ...saved.chats, [saved.theme]: [] } }); onClose(); }} style={{ flex: 1, height: 44, borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", fontFamily: FONT, fontWeight: 500, color: "#0f172a" }}>Clear this chat</button>
        {onExit
          ? <button onClick={onExit} style={{ flex: 1, height: 44, borderRadius: 10, border: 0, background: "#6d3df5", fontFamily: FONT, fontWeight: 600, color: "#fff" }}>Back to Arise Notes</button>
          : <button onClick={logout} style={{ flex: 1, height: 44, borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", fontFamily: FONT, fontWeight: 500, color: "#b91c1c" }}>Sign out</button>}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "#475569" }}>Open this screen from the back, close or file button in any look. Chats stay on this device.</p>
    </div>
  </div>;
}

export default function UndercoverApp({ onExit }: { onExit?: () => void } = {}) {
  const [saved, setSaved] = useState<Saved>(load);
  // First time: open the look picker so people see the choices and where settings live.
  const [menu, setMenu] = useState(() => { try { return !localStorage.getItem(KEY); } catch { return false; } });
  const save = (s: Saved) => { setSaved(s); store(s); };
  const chat = useChat(saved.theme, saved, save);
  const onMenu = () => setMenu(true);
  useEffect(() => {
    document.body.style.margin = "0";
    // The document looks use a serif like a word processor's; load it once.
    if (!document.getElementById("uc-fonts")) {
      const l = document.createElement("link");
      l.id = "uc-fonts"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:wght@400;600&display=swap";
      document.head.appendChild(l);
    }
  }, []);
  const look = (() => {
    switch (saved.theme) {
      case "group": return <GroupLook chat={chat} contact={saved.contact === "Sam" ? "Weekend plans" : saved.contact} onMenu={onMenu} />;
      case "inbox": return <InboxLook chat={chat} contact={saved.contact === "Sam" ? "Alex" : saved.contact} onMenu={onMenu} />;
      case "docNotes": return <DocNotesLook chat={chat} onMenu={onMenu} />;
      case "docComments": return <DocCommentsLook chat={chat} onMenu={onMenu} />;
      case "docPhone": return <DocPhoneLook chat={chat} onMenu={onMenu} />;
      default: return <TextLook chat={chat} contact={saved.contact} onMenu={onMenu} />;
    }
  })();
  return <>{look}{menu && <Settings saved={saved} save={save} onClose={() => setMenu(false)} onExit={onExit} />}</>;
}
