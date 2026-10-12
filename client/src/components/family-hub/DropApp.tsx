// The Drop app (App Store add-on, shared/dropApp.ts): an AirDrop-style file hand-off. Send a
// file from this device and get a code, a QR code, and a link; on the receiving device, type the
// code, scan the QR, or open the link to pull it straight back down. Also lists this account's
// own drops from the last hour ("Waiting for you") as a tap-to-grab shortcut between two of your
// own devices, without retyping a code. A drop lasts an hour and downloading leaves it in place.
import { useEffect, useRef, useState } from "react";
import { Upload, Copy, Check, QrCode, Download, Clock, Link2 } from "lucide-react";
import { DROP_MAX_BYTES, isDropCode } from "@shared/dropApp";
import { API_BASE } from "@/lib/queryClient";

type Props = {
  say: (msg: string) => void;
  /** This account's own A.R.I.S.E. session token (see AuthContext) — the server checks for it as
   *  a Bearer header, not a cookie, so sending a drop and listing "mine" both need it attached.
   *  Receiving (lookup + claim) is deliberately open, no account needed on that side. */
  token: string | null;
};

type SentDrop = { code: string; name: string; size: number; createdAt: string; expiresAt: string };
type ReceivedInfo = { code: string; name: string; size: number; contentType: string; expiresAt: string; claimed?: boolean };

const fmtBytes = (n: number) => n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
const fmtLeft = (iso: string) => {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
};

export default function DropApp({ say, token }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ code: string; name: string; size: number; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [mine, setMine] = useState<SentDrop[]>([]);
  // A send that fails shows nothing at all otherwise — no code, no QR, no link — which reads as
  // the app being broken rather than as one upload going wrong. The reason stays on the screen.
  const [sendError, setSendError] = useState("");

  const [codeInput, setCodeInput] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [received, setReceived] = useState<ReceivedInfo | null>(null);
  const [receivedError, setReceivedError] = useState("");
  /** The code currently being pulled down ("" when none), so the row that was tapped is the one
   *  that shows "Opening…" rather than every row at once. */
  const [claiming, setClaiming] = useState("");

  const link = (code: string) => `${window.location.origin}/drop/${code}`;

  const loadMine = () => {
    if (!token) return;
    fetch(`${API_BASE}/api/lifehub/drop/mine/list`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((j) => setMine(Array.isArray(j?.drops) ? j.drops : [])).catch(() => {});
  };
  // Kept fresh while the screen is open, so a file sent from a phone turns up on the laptop by
  // itself — without that, this list was whatever existed the moment the screen was opened, and
  // the only way to fetch a just-sent file was to type its code.
  useEffect(() => {
    loadMine();
    if (!token) return;
    const t = setInterval(loadMine, 10_000);
    const wake = () => { if (document.visibilityState === "visible") loadMine(); };
    document.addEventListener("visibilitychange", wake);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", wake); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // A link like /drop/ABC123 (or ?drop=ABC123) opens Drop already looking that code up.
  useEffect(() => {
    const m = window.location.pathname.match(/\/drop\/([A-Za-z2-9]{6})/) || [null, new URLSearchParams(window.location.search).get("drop") || ""];
    const code = String(m[1] || "").toUpperCase();
    if (isDropCode(code)) { setCodeInput(code); lookup(code); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = () => inputRef.current?.click();

  const upload = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    const fail = (msg: string) => { setSendError(msg); say(msg); };
    if (!token) { fail("Sign in again to send with Drop."); return; }
    if (file.size > DROP_MAX_BYTES) { fail("Keep a Drop file under 200 MB."); return; }
    setBusy(true);
    setSendError("");
    try {
      const body = await file.arrayBuffer();
      const res = await fetch(`${API_BASE}/api/lifehub/drop/upload`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream", "x-drop-name": encodeURIComponent(file.name), Authorization: `Bearer ${token}` },
        body,
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { fail(j?.message || "Couldn't create that drop."); return; }
      setSent(j); setCopied(false); loadMine();
    } catch {
      fail("Couldn't upload. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const copyLink = async (code: string) => {
    try { await navigator.clipboard.writeText(link(code)); setCopied(true); say("Link copied."); setTimeout(() => setCopied(false), 2000); }
    catch { say("Couldn't copy — select and copy the link manually."); }
  };

  const lookup = async (codeRaw: string) => {
    const code = codeRaw.toUpperCase().trim();
    setReceivedError("");
    if (!isDropCode(code)) { setReceivedError("Enter the 6-character code."); return; }
    setLookupBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/lifehub/drop/${code}`);
      const j = await res.json().catch(() => null);
      if (!res.ok) { setReceivedError(j?.message || "That drop couldn't be found."); setReceived(null); return; }
      setReceived(j);
    } catch {
      setReceivedError("Couldn't reach A.R.I.S.E. Check your connection.");
    } finally {
      setLookupBusy(false);
    }
  };

  /** Pull one drop down by its code, whatever found it: a typed code, a scanned QR, a link, or a
   *  tap on this account's own "Sent from this account" list. */
  const grab = async (code: string, fallbackName: string) => {
    setClaiming(code);
    try {
      const res = await fetch(`${API_BASE}/api/lifehub/drop/${code}/claim`, { method: "POST" });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.url) { say(j?.message || "Couldn't open that drop."); return; }
      const a = document.createElement("a");
      a.href = j.url; a.download = j.name || fallbackName; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      say("Download started.");
      setReceived((r) => (r && r.code === code ? { ...r, claimed: true } : r));
      // The drop is left on screen rather than cleared: it stays alive for the rest of its hour,
      // so being able to tap Download again (a save that went wrong, a second device) matters.
      loadMine();
    } catch {
      say("Couldn't open that drop. Try again.");
    } finally {
      setClaiming("");
    }
  };

  return <div className="space-y-6" data-testid="drop-app">
    <div>
      <h2 className="text-lg font-black text-slate-900">Drop</h2>
      <p className="mt-1 text-sm text-slate-500">Send a file to another device with a code, a QR code, or a link. Files stay for one hour, and you can pick one up as many times as you need.</p>
    </div>

    {/* ---- Send ---- */}
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-black uppercase tracking-wide text-slate-400">Send a file</h3>
      {!sent ? <>
        <input ref={inputRef} type="file" className="hidden" onChange={(e) => upload(e.target.files)} />
        <button type="button" onClick={pick} disabled={busy} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#292446] px-4 text-sm font-bold text-white disabled:opacity-60" data-testid="drop-upload">
          <Upload size={16} /> {busy ? "Preparing…" : "Choose a file"}
        </button>
        {sendError && <p className="mt-2 text-sm font-semibold text-rose-600" data-testid="drop-send-error">{sendError}</p>}
      </> : <div className="mt-3 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=176x176&data=${encodeURIComponent(link(sent.code))}`} alt="QR code for this drop" width={132} height={132} className="rounded-xl border border-slate-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Code</p>
            <p className="text-3xl font-black tracking-[.2em] text-[#292446]" data-testid="drop-code">{sent.code}</p>
            <p className="truncate text-sm text-slate-500">{sent.name} · {fmtBytes(sent.size)}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => copyLink(sent.code)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 hover:bg-slate-50">
                {copied ? <Check size={15} /> : <Link2 size={15} />} {copied ? "Copied" : "Copy link"}
              </button>
              <button type="button" onClick={() => { setSent(null); }} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-slate-500 hover:bg-slate-50">Send another</button>
            </div>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-slate-400"><QrCode size={13} /> Scan the QR, type the code, or send the link — any one works on the other device.</p>
      </div>}
    </div>

    {/* ---- Receive ---- */}
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-black uppercase tracking-wide text-slate-400">Receive a file</h3>
      <div className="mt-3 flex gap-2">
        <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase().slice(0, 6))} placeholder="Enter code" maxLength={6}
          className="min-h-11 flex-1 rounded-xl border border-slate-200 px-4 text-lg font-black tracking-[.15em] text-slate-900 placeholder:font-semibold placeholder:tracking-normal placeholder:text-slate-300" data-testid="drop-code-input" />
        <button type="button" onClick={() => lookup(codeInput)} disabled={lookupBusy} className="min-h-11 rounded-xl bg-[#292446] px-4 text-sm font-bold text-white disabled:opacity-60">{lookupBusy ? "Looking…" : "Find"}</button>
      </div>
      {receivedError && <p className="mt-2 text-sm font-semibold text-rose-600">{receivedError}</p>}
      {received && <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-800">{received.name}</p>
          <p className="text-xs text-slate-500">{fmtBytes(received.size)} · {fmtLeft(received.expiresAt)}{received.claimed ? " · already picked up once, still here" : ""}</p>
        </div>
        <button type="button" onClick={() => grab(received.code, received.name)} disabled={!!claiming} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#292446] px-3 text-sm font-bold text-white disabled:opacity-60" data-testid="drop-download">
          <Download size={15} /> {claiming === received.code ? "Opening…" : "Download"}
        </button>
      </div>}
    </div>

    {/* ---- Sent from this account ---- */}
    {/* Waiting for you — the point of this list is to skip the code entirely when both devices
        are your own. Each row is a button that pulls the file straight down; the code stays
        visible beside it for when the other device belongs to someone else. */}
    {mine.length > 0 && <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-black uppercase tracking-wide text-slate-400">Waiting for you</h3>
      <p className="mt-1 text-xs text-slate-400">Sent from your account. Tap one to pick it up on this device — no code needed.</p>
      <div className="mt-3 space-y-2">
        {mine.map((d) => <button key={d.code} type="button" onClick={() => grab(d.code, d.name)} disabled={!!claiming}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
          data-testid={`drop-mine-${d.code}`}>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-700">{d.name}</p>
            <p className="text-xs text-slate-400">{fmtBytes(d.size)} · <Clock size={10} className="-mt-0.5 inline" /> {fmtLeft(d.expiresAt)}</p>
          </div>
          <span className="flex shrink-0 items-center gap-2">
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black tracking-wide text-slate-500">{d.code}</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#292446] text-white">
              <Download size={14} />
            </span>
          </span>
        </button>)}
      </div>
      {claiming && <p className="mt-2 text-xs font-semibold text-slate-500">Opening…</p>}
    </div>}
  </div>;
}
