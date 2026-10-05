// Admin > Settings > Notifications: which alerts go by email and to the bell, where emails go,
// and a log of every alert email so it's clear whether they're being delivered.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellRing, CheckCircle2, Mail, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { API_BASE } from "@/lib/queryClient";
import { relativeTime, sessionToken } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import {
  ALERT_EVENTS, MAX_ALERT_RECIPIENTS, isEmailAddress,
  type AlertEmailLogEntry, type AlertEventKey, type AlertSettings, type AlertSettingsResponse,
} from "@shared/adminAlerts";
import { AdminSection, INPUT_CLASS, StatusPill } from "./AdminUi";

const GROUPS = ["Sign-ups", "Quizzes", "Requests", "Messages"] as const;

export default function AlertSettingsCard({ token }: { token: string | null }) {
  const [data, setData] = useState<AlertSettingsResponse | null>(null);
  const [draft, setDraft] = useState<AlertSettings | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "test">("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [showFullLog, setShowFullLog] = useState(false);

  const headers = () => ({ Authorization: `Bearer ${token || sessionToken()}`, "Content-Type": "application/json" });

  const apply = (body: AlertSettingsResponse) => {
    setData(body);
    setDraft(body.settings);
  };

  const load = async () => {
    setLoadError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/alert-settings`, { headers: headers(), cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not load notification settings.");
      apply(body);
    } catch (e: any) {
      setLoadError(e?.message || "Could not load notification settings.");
    }
  };

  useEffect(() => { void load(); }, []);

  const dirty = useMemo(() => !!data && !!draft && JSON.stringify(data.settings) !== JSON.stringify(draft), [data, draft]);

  const setEvent = (key: AlertEventKey, channel: "email" | "inApp", on: boolean) =>
    setDraft((current) => current ? { ...current, events: { ...current.events, [key]: { ...current.events[key], [channel]: on } } } : current);

  const setAll = (channel: "email" | "inApp", on: boolean) =>
    setDraft((current) => {
      if (!current) return current;
      const events = { ...current.events };
      for (const info of ALERT_EVENTS) events[info.key] = { ...events[info.key], [channel]: on };
      return { ...current, events };
    });

  const addEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!draft) return;
    if (!isEmailAddress(email)) { setNotice({ ok: false, text: "That doesn't look like an email address." }); return; }
    if (draft.recipients.includes(email)) { setNewEmail(""); return; }
    if (draft.recipients.length >= MAX_ALERT_RECIPIENTS) { setNotice({ ok: false, text: `You can send alerts to up to ${MAX_ALERT_RECIPIENTS} addresses.` }); return; }
    setDraft({ ...draft, recipients: [...draft.recipients, email] });
    setNewEmail("");
    setNotice(null);
  };

  const save = async () => {
    if (!draft) return;
    setBusy("save");
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/alert-settings`, { method: "PUT", headers: headers(), body: JSON.stringify({ settings: draft }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not save.");
      apply(body);
      setNotice({ ok: true, text: body.message || "Saved." });
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message || "Could not save." });
    } finally {
      setBusy("");
    }
  };

  const sendTest = async () => {
    setBusy("test");
    setNotice(null);
    try {
      if (dirty) await save();
      const res = await fetch(`${API_BASE}/api/admin/alert-settings/test`, { method: "POST", headers: headers() });
      const body = await res.json().catch(() => ({}));
      if (body.log && data) setData({ ...data, email: body.email || data.email, log: body.log });
      setNotice({ ok: res.ok, text: body.message || (res.ok ? "Test email sent." : "The test email could not be sent.") });
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message || "The test email could not be sent." });
    } finally {
      setBusy("");
    }
  };

  if (loadError) {
    return (
      <AdminSection id="alert-settings" icon={BellRing} title="Notifications & email alerts">
        <div className="flex flex-col items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {loadError}
          <Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button>
        </div>
      </AdminSection>
    );
  }
  if (!data || !draft) {
    return (
      <AdminSection id="alert-settings" icon={BellRing} title="Notifications & email alerts">
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/40" />)}</div>
      </AdminSection>
    );
  }

  const email = data.email;
  const testAddress = /resend\.dev/i.test(email.from);
  const log = showFullLog ? data.log : data.log.slice(0, 6);
  const allEmail = ALERT_EVENTS.every((info) => draft.events[info.key]?.email);
  const allBell = ALERT_EVENTS.every((info) => draft.events[info.key]?.inApp);

  return (
    <AdminSection
      id="alert-settings"
      icon={BellRing}
      title="Notifications & email alerts"
      description="Choose what you hear about, and where. The bell checks for new things every 20 seconds while the admin page is open."
    >
      <div className="space-y-6">
        {/* Email status */}
        <div className={cn("rounded-xl border p-3 text-sm sm:p-4", email.configured ? "border-emerald-500/25 bg-emerald-500/[.06]" : "border-amber-500/30 bg-amber-500/10")}>
          <div className="flex items-start gap-3">
            {email.configured ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />}
            <div className="min-w-0 space-y-1">
              {email.configured ? (
                <>
                  <p className="font-semibold">Email is set up</p>
                  <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">Sent from {email.from}. {email.sentToday} alert email{email.sentToday === 1 ? "" : "s"} today{draft.dailyLimit ? ` of ${draft.dailyLimit}` : ""}.</p>
                  {testAddress && <p className="text-xs text-amber-200">This is Resend's test sender, which only delivers to the email that owns your Resend account. To send to other addresses, verify your domain in Resend and change EMAIL_FROM on Render.</p>}
                </>
              ) : (
                <>
                  <p className="font-semibold text-amber-100">Email isn't set up yet</p>
                  <p className="text-xs text-amber-100/80">Add RESEND_API_KEY (and EMAIL_FROM) to the environment settings on Render. Until then, alerts show in the bell only.</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Where emails go */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Email me alerts</p>
              <p className="text-xs text-muted-foreground">Turn this off to pause every alert email. The bell keeps working.</p>
            </div>
            <Switch checked={draft.emailEnabled} onCheckedChange={(on) => setDraft({ ...draft, emailEnabled: on })} aria-label="Email me alerts" />
          </div>
          <div className={cn("space-y-2", !draft.emailEnabled && "opacity-50")}>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Send alerts to</p>
            <div className="flex flex-wrap gap-2">
              {draft.recipients.length === 0 && <span className="text-xs text-amber-300">No address yet — add one below.</span>}
              {draft.recipients.map((address) => (
                <span key={address} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/40 py-1 pl-3 pr-1 text-sm">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate">{address}</span>
                  <button type="button" onClick={() => setDraft({ ...draft, recipients: draft.recipients.filter((r) => r !== address) })} className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Stop sending alerts to ${address}`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
            {draft.recipients.length < MAX_ALERT_RECIPIENTS && (
              <div className="flex gap-2">
                <input
                  type="email"
                  inputMode="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                  placeholder="another@school.org"
                  className={INPUT_CLASS}
                  aria-label="Add an email address for alerts"
                />
                <Button type="button" variant="outline" onClick={addEmail} className="h-10 shrink-0"><Plus className="h-4 w-4" />Add</Button>
              </div>
            )}
          </div>
        </div>

        {/* Each alert */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">What to tell you about</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <button type="button" onClick={() => setAll("email", !allEmail)} className="rounded-full border border-border px-3 py-1.5 font-semibold text-muted-foreground hover:text-foreground">{allEmail ? "All emails off" : "All emails on"}</button>
              <button type="button" onClick={() => setAll("inApp", !allBell)} className="rounded-full border border-border px-3 py-1.5 font-semibold text-muted-foreground hover:text-foreground">{allBell ? "All bell off" : "All bell on"}</button>
            </div>
          </div>
          {GROUPS.map((group) => (
            <div key={group} className="overflow-hidden rounded-xl border border-border/70">
              <div className="grid grid-cols-[minmax(0,1fr)_3.25rem_3.25rem] items-center gap-2 bg-muted/40 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-muted-foreground sm:grid-cols-[minmax(0,1fr)_4.5rem_4.5rem]">
                <span>{group}</span>
                <span className="text-center">Email</span>
                <span className="text-center">Bell</span>
              </div>
              <ul className="divide-y divide-border/60">
                {ALERT_EVENTS.filter((info) => info.group === group).map((info) => (
                  <li key={info.key} className="grid grid-cols-[minmax(0,1fr)_3.25rem_3.25rem] items-center gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_4.5rem_4.5rem]">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">{info.label}</p>
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{info.hint}</p>
                    </div>
                    <div className="flex justify-center">
                      <Switch checked={draft.events[info.key].email} disabled={!draft.emailEnabled} onCheckedChange={(on) => setEvent(info.key, "email", on)} aria-label={`Email: ${info.label}`} />
                    </div>
                    <div className="flex justify-center">
                      <Switch checked={draft.events[info.key].inApp} onCheckedChange={(on) => setEvent(info.key, "inApp", on)} aria-label={`Bell: ${info.label}`} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Email volume */}
        <div className={cn("grid gap-4 sm:grid-cols-2", !draft.emailEnabled && "opacity-50")}>
          <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Combine alerts that arrive together</p>
              <p className="mt-0.5 text-xs text-muted-foreground">At most one email a minute: when a class takes quizzes at once you get one email listing them, not thirty.</p>
            </div>
            <Switch checked={draft.bundle} onCheckedChange={(on) => setDraft({ ...draft, bundle: on })} aria-label="Combine alerts that arrive together" />
          </div>
          <label className="block rounded-xl border border-border/70 p-3">
            <span className="text-sm font-semibold">Most alert emails per day</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">0 means no limit. Resend's free plan allows 100 emails a day, shared with teacher sign-up codes and password emails.</span>
            <input
              type="number"
              min={0}
              max={1000}
              value={draft.dailyLimit}
              onChange={(e) => setDraft({ ...draft, dailyLimit: Math.max(0, Math.min(1000, Math.floor(Number(e.target.value) || 0))) })}
              className={cn(INPUT_CLASS, "mt-2 w-32")}
            />
          </label>
        </div>

        {/* Save */}
        <div className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center">
          <Button onClick={() => void save()} disabled={!dirty || busy !== ""} className="arise-gradient-button font-bold">
            {busy === "save" ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
          <Button variant="outline" onClick={() => void sendTest()} disabled={busy !== "" || !email.configured || !draft.recipients.length}>
            <Send className="h-4 w-4" />{busy === "test" ? "Sending…" : "Send a test email"}
          </Button>
          {notice && <p role="status" className={cn("text-sm sm:ml-2", notice.ok ? "text-emerald-300" : "text-red-300")}>{notice.text}</p>}
        </div>

        {/* Log */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Recent alert emails</p>
          {data.log.length === 0 ? (
            <p className="text-xs text-muted-foreground">No alert emails yet. They'll be listed here, with the reason if one couldn't be sent.</p>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70">
              {log.map((entry: AlertEmailLogEntry, index) => (
                <li key={`${entry.at}-${index}`} className="flex items-start gap-3 px-3 py-2.5">
                  <span className="w-[4.25rem] shrink-0"><StatusPill tone={entry.status === "sent" ? "emerald" : entry.status === "failed" ? "red" : "amber"}>{entry.status}</StatusPill></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug [overflow-wrap:anywhere]">{entry.subject.replace(/ · A\.R\.I\.S\.E Reader$/, "")}</p>
                    {entry.detail && <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">{entry.detail}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(entry.at)}</span>
                </li>
              ))}
            </ul>
          )}
          {data.log.length > 6 && (
            <button type="button" onClick={() => setShowFullLog(!showFullLog)} className="text-xs font-semibold text-primary hover:underline">
              {showFullLog ? "Show fewer" : `Show all ${data.log.length}`}
            </button>
          )}
        </div>
      </div>
    </AdminSection>
  );
}
