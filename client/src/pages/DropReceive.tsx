// The page a Drop link opens: /drop/:code. No account needed — the code in the link (or typed
// in here) is the key, the same way /share/:token works for a LifeHub share link.
import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Download, Loader2, CheckCircle2, QrCode } from "lucide-react";
import { isDropCode } from "@shared/dropApp";

const fmtBytes = (n: number) => n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export default function DropReceive() {
  const [, params] = useRoute("/drop/:code");
  const code = (params?.code || "").toUpperCase();
  const [info, setInfo] = useState<{ name: string; size: number } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isDropCode(code)) { setError("That link isn't a valid Drop code."); setLoading(false); return; }
    fetch(`/api/lifehub/drop/${code}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (!ok) setError(j?.message || "That drop couldn't be found."); else setInfo(j); })
      .catch(() => setError("Couldn't reach A.R.I.S.E. Check your connection."))
      .finally(() => setLoading(false));
  }, [code]);

  const claim = async () => {
    setClaiming(true);
    try {
      const res = await fetch(`/api/lifehub/drop/${code}/claim`, { method: "POST" });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.url) { setError(j?.message || "Couldn't open that drop."); return; }
      const a = document.createElement("a");
      a.href = j.url; a.download = j.name || info?.name || "file"; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      setDone(true);
    } catch {
      setError("Couldn't open that drop. Try again.");
    } finally {
      setClaiming(false);
    }
  };

  return <div className="grid min-h-dvh place-items-center bg-[#f6f7fc] px-4">
    <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#292446] text-white"><QrCode size={22} /></div>
      <h1 className="text-lg font-black text-slate-900">A.R.I.S.E. Drop</h1>
      {loading ? <p className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Looking up this drop…</p>
        : error ? <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p>
        : done ? <p className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-600"><CheckCircle2 size={16} /> Download started.</p>
        : info && <>
          <p className="mt-4 truncate text-sm font-bold text-slate-800">{info.name}</p>
          <p className="text-xs text-slate-500">{fmtBytes(info.size)}</p>
          <button type="button" onClick={claim} disabled={claiming} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#292446] px-4 text-sm font-bold text-white disabled:opacity-60">
            <Download size={16} /> {claiming ? "Opening…" : "Download"}
          </button>
        </>}
      <p className="mt-5 text-xs text-slate-400">Sent with A.R.I.S.E. Drop, no account needed to receive.</p>
    </div>
  </div>;
}
