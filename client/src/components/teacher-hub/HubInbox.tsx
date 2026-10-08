// Teacher Hub: emails forwarded in. The open Hub picks up what arrived at the teacher's forwarding address
// and adds each one to Emails, flagged, and to the to-do list. The Emails tab shows the address.
// The rules are in shared/hubInbox.ts; the server side is server/hubInbox.ts.
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Copy, Inbox, RefreshCw } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { addInboxItems, type InboxItem } from "@shared/hubInbox";
import type { Workspace } from "@shared/teacherHub";
import { Card, Field, GhostButton, PrimaryButton } from "./ui";

/** How often the open Hub looks for newly forwarded emails. */
export const INBOX_CHECK_MS = 60_000;

type InboxView = { ready: boolean; address: string | null; senders: string[]; anyone: boolean; waiting: InboxItem[] };

async function call(token: string | null, path: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "That did not work. Please try again.");
  return data;
}

/**
 * While the Hub is open: checks for forwarded emails when it opens, every minute, and when the page comes back
 * into view. Each one goes into the workspace (once, even with two Hubs open), and is then marked as taken.
 */
export function useHubInbox(ready: boolean, token: string | null, workspace: Workspace, setWorkspace: Dispatch<SetStateAction<Workspace>>, makeId: () => string, today: () => string, onAdded: (count: number) => void) {
  const latest = useRef(workspace);
  latest.current = workspace;
  const busy = useRef(false);
  useEffect(() => {
    if (!ready || !token) return;
    let stopped = false;
    const check = async () => {
      if (busy.current || stopped) return;
      busy.current = true;
      try {
        const data: InboxView = await call(token, "/api/teacher-hub/inbox");
        const waiting = Array.isArray(data.waiting) ? data.waiting : [];
        if (!waiting.length || stopped) return;
        const have = new Set((latest.current?.emails || []).map((e) => e.id));
        const fresh = waiting.filter((x) => !have.has(x.id));
        if (fresh.length) {
          setWorkspace((p) => addInboxItems(p, fresh, makeId, today()).workspace);
          onAdded(fresh.length);
        }
        await call(token, "/api/teacher-hub/inbox/taken", { method: "POST", body: JSON.stringify({ ids: waiting.map((x) => x.id) }) });
      } catch { /* tried again in a minute */ } finally { busy.current = false; }
    };
    void check();
    const timer = setInterval(() => void check(), INBOX_CHECK_MS);
    const onShow = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener("visibilitychange", onShow); };
  }, [ready, token]);
}

/** The forwarding address, who mail is accepted from, and (for the admin, until it is set up) the one-time setup. */
export function ForwardingCard({ token, isAdmin }: { token: string | null; isAdmin: boolean }) {
  const [view, setView] = useState<InboxView | null>(null);
  const [senders, setSenders] = useState("");
  const [anyone, setAnyone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [setup, setSetup] = useState({ domain: "", secret: "", apiKey: "" });

  const load = async () => {
    const data: InboxView = await call(token, "/api/teacher-hub/inbox");
    setView(data); setSenders(data.senders.join(", ")); setAnyone(data.anyone);
  };
  useEffect(() => { load().catch((e) => setError(e?.message || "Could not load forwarding.")); }, [token]);

  async function run(work: () => Promise<string>) {
    if (busy) return;
    setBusy(true); setNotice(""); setError("");
    try { setNotice(await work()); } catch (e: any) { setError(e?.message || "That did not work."); } finally { setBusy(false); }
  }
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); setNotice("Address copied."); } catch { setError("Could not copy. Select the address and copy it yourself."); } };

  if (!view) return error ? <Card title="Forward emails into your Hub"><p role="alert" className="text-sm text-red-700">{error}</p></Card> : null;
  return (
    <Card title="Forward emails into your Hub" right={<Inbox className="h-5 w-5 text-slate-400" />}>
      <div className="space-y-3 text-sm text-slate-700" data-testid="hub-forwarding">
        {!view.ready ? (
          isAdmin ? (
            <div className="space-y-2" data-testid="hub-forwarding-setup">
              <p>Set this up once for the whole site. Then every Hub teacher gets their own forwarding address.</p>
              <ol className="list-decimal space-y-1 pl-5 text-slate-600">
                <li>Open <a className="font-semibold text-teal-700 underline" href="https://resend.com/emails" target="_blank" rel="noreferrer">resend.com/emails</a>, choose the <b>Receiving</b> tab, then the ⋯ button and <b>Receiving address</b>. Copy it and paste it below. It looks like &lt;anything&gt;@abc123.resend.app, and pasting all of it is fine.</li>
                <li>Open <a className="font-semibold text-teal-700 underline" href="https://resend.com/webhooks" target="_blank" rel="noreferrer">resend.com/webhooks</a>, add a webhook for <b>email.received</b> with this address: <code className="break-all rounded bg-slate-100 px-1">{window.location.origin}/api/hub-inbox/webhook</code>. Copy its signing secret (it starts with whsec_).</li>
                <li>Open <a className="font-semibold text-teal-700 underline" href="https://resend.com/api-keys" target="_blank" rel="noreferrer">resend.com/api-keys</a>, choose <b>Create API key</b>, set Permission to <b>Full access</b>, and copy it (it starts with re_). The site needs it to read the emails it receives.</li>
                <li>Paste all three here and save.</li>
              </ol>
              <Field value={setup.domain} onChange={(e) => setSetup({ ...setup, domain: e.target.value })} placeholder="abc123.resend.app" aria-label="Receiving domain" />
              <Field value={setup.secret} onChange={(e) => setSetup({ ...setup, secret: e.target.value })} placeholder="whsec_..." aria-label="Webhook signing secret" type="password" autoComplete="off" />
              <Field value={setup.apiKey} onChange={(e) => setSetup({ ...setup, apiKey: e.target.value })} placeholder="re_... (Full access)" aria-label="Resend API key" type="password" autoComplete="off" />
              <PrimaryButton disabled={busy || !setup.domain.trim() || !setup.secret.trim()} onClick={() => void run(async () => { const r = await call(token, "/api/admin/hub-inbox", { method: "PUT", body: JSON.stringify(setup) }); setSetup({ domain: "", secret: "", apiKey: "" }); await load(); return r.message || "Saved."; })}>Save setup</PrimaryButton>
            </div>
          ) : <p>Forwarding isn't set up on the site yet. Ask the site's admin to turn it on.</p>
        ) : (
          <>
            <p>Forward any work email to your private address. It shows up here flagged, and on your to-do list, within a minute or two.</p>
            {view.address ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 break-all rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900" data-testid="hub-forwarding-address">{view.address}</code>
                <GhostButton onClick={() => void copy(view.address!)}><Copy className="h-4 w-4" /> Copy</GhostButton>
                <GhostButton onClick={() => { if (window.confirm("Get a new address? The old one will stop working.")) void run(async () => { await call(token, "/api/teacher-hub/inbox/address", { method: "POST" }); await load(); return "New address made. The old one no longer works."; }); }}><RefreshCw className="h-4 w-4" /> New address</GhostButton>
              </div>
            ) : (
              <PrimaryButton disabled={busy} onClick={() => void run(async () => { await call(token, "/api/teacher-hub/inbox/address", { method: "POST" }); await load(); return "Your address is ready. Save it as a contact so it's quick to forward to."; })}>Get my forwarding address</PrimaryButton>
            )}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="hub-forward-senders">Accept forwards from</label>
              <Field id="hub-forward-senders" value={senders} onChange={(e) => setSenders(e.target.value)} placeholder="you@school.org, you@gmail.com" data-testid="hub-forwarding-senders" />
              <p className="mt-1 text-xs text-slate-500">Your own email addresses, separated by commas. Mail to your address from anyone else is ignored, so a stranger who learns it can't fill your to-do list.</p>
              <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={anyone} onChange={(e) => setAnyone(e.target.checked)} className="h-4 w-4" /> Accept from anyone (for an automatic forwarding rule, which keeps the original sender)</label>
              <div className="mt-2"><GhostButton onClick={() => void run(async () => { const r = await call(token, "/api/teacher-hub/inbox/senders", { method: "PUT", body: JSON.stringify({ senders, anyone }) }); setSenders(r.senders.join(", ")); setAnyone(r.anyone); return "Saved."; })}>Save</GhostButton></div>
            </div>
            {isAdmin && (
              <details className="rounded-xl border border-slate-200 p-3" data-testid="hub-forwarding-admin">
                <summary className="cursor-pointer font-semibold text-slate-700">Site setup (admin)</summary>
                <p className="mt-2 text-slate-600">If forwarded emails reach Resend but not the Hub, the site needs a Resend key that can read received email. Make one at <a className="font-semibold text-teal-700 underline" href="https://resend.com/api-keys" target="_blank" rel="noreferrer">resend.com/api-keys</a> with Permission set to <b>Full access</b>, paste it here and save. Emails Resend is still retrying will then come in.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Field value={setup.apiKey} onChange={(e) => setSetup({ ...setup, apiKey: e.target.value })} placeholder="re_... (Full access)" aria-label="Resend API key" type="password" autoComplete="off" />
                  <GhostButton onClick={() => { if (!setup.apiKey.trim()) return; void run(async () => { const r = await call(token, "/api/admin/hub-inbox", { method: "PUT", body: JSON.stringify({ apiKey: setup.apiKey }) }); setSetup({ domain: "", secret: "", apiKey: "" }); return r.apiKeySet ? "Key saved." : (r.message || "Saved."); }); }}>Save key</GhostButton>
                </div>
              </details>
            )}
          </>
        )}
        {notice && <p role="status" className="text-emerald-700" data-testid="hub-forwarding-notice">{notice}</p>}
        {error && <p role="alert" className="text-red-700">{error}</p>}
      </div>
    </Card>
  );
}
