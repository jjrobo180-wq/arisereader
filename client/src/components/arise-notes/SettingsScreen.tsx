// Settings: plan and minutes (with upgrades and billing), the Family plan, audio and privacy
// (including deleting everything), accessibility, and defaults.
import { useEffect, useState } from "react";
import { Check, Crown, Eye, LogOut, Shield, Trash2, Type, Users } from "lucide-react";
import { NOTES_PLANS, dayWords, type NotesPlanId, type NotesProduct, type NotesSettings } from "@shared/ariseNotes";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { NATIVE_NO_PURCHASE, isNativeApp } from "@/lib/nativeApp";
import { notesApi, type Billing } from "./api";
import { Btn, Notice, Section, Spinner, Toggle, useToast } from "./ui";
import { TopBar, type AppCtx } from "./NotesApp";

type Tab = "plan" | "family" | "privacy" | "access";
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const FEATURES: Record<NotesPlanId, string[]> = {
  free: ["60 minutes a month", "Recordings up to 30 minutes", "Transcripts with times", "AI summaries"],
  basic: ["600 minutes a month", "Up to 2 hours per recording", "Every template, highlights and exports", "Ask your notes, voice memos", "To-dos straight into your planner", "Parent emails, translation, study tools"],
  plus: ["1,500 minutes a month", "Everything in Basic", "Speaker labels", "IEP meeting mode", "Unused minutes roll over"],
  family: ["2,000 minutes shared by up to 4 people", "Plus features for everyone", "Share notes with the family"],
};

export default function SettingsScreen({ ctx, tab: start }: { ctx: AppCtx; tab?: Tab }) {
  const [tab, setTab] = useState<Tab>(start ?? "plan");
  const tabs: [Tab, string][] = [["plan", "Plan & minutes"], ["family", "Family"], ["privacy", "Privacy"], ["access", "Accessibility"]];
  return <>
    <TopBar ctx={ctx} title="Settings" back={() => ctx.go({ name: "home" })} />
    <main className="mx-auto max-w-3xl space-y-4 px-4 pb-24 pt-4 sm:px-5">
      <div role="tablist" className="an-scroll -mx-1 flex gap-2 overflow-x-auto px-1">{tabs.map(([k, label]) => <button key={k} role="tab" type="button" aria-selected={tab === k} aria-pressed={tab === k} className="an-chip" onClick={() => setTab(k)}>{label}</button>)}</div>
      {tab === "plan" && <PlanTab ctx={ctx} />}
      {tab === "family" && <FamilyTab ctx={ctx} />}
      {tab === "privacy" && <PrivacyTab ctx={ctx} />}
      {tab === "access" && <AccessTab ctx={ctx} />}
      {ctx.mode === "standalone" && <SignOut ctx={ctx} />}
    </main>
  </>;
}

// The Notes app on its own (the iPhone app and /notes/) signs out here. Inside Arise To Duo, To Duo's
// own sign-out is used. Signing out also stops notifications to this phone (AuthContext.logout).
function SignOut({ ctx }: { ctx: AppCtx }) {
  const { logout } = useAuth();
  return <Section title="Account" icon={<LogOut className="h-4 w-4" />}>
    <div className="flex flex-wrap items-center gap-3">
      <p className="min-w-0 flex-1 text-[14px] text-[var(--an-muted)]">Signed in as <b className="text-[var(--an-ink)]">{ctx.me.user.name || "you"}</b>.</p>
      <Btn kind="soft" onClick={() => { logout(); window.location.hash = "#/"; }} data-testid="notes-sign-out"><LogOut className="h-4 w-4" />Sign out</Btn>
    </div>
  </Section>;
}

function useSettings(ctx: AppCtx) {
  const say = useToast();
  return async (s: Partial<NotesSettings>) => { try { await notesApi.settings(s); await ctx.refreshMe(); } catch (e: any) { say(e.message); } };
}

function PlanTab({ ctx }: { ctx: AppCtx }) {
  const say = useToast();
  const u = ctx.me.usage;
  const [bill, setBill] = useState<Billing | null>(null);
  const [busy, setBusy] = useState("");
  const [yearly, setYearly] = useState(true);
  const [admin, setAdmin] = useState<{ name: string; minutes: number; costCents: number; jobs: number }[] | null>(null);
  // Plans aren't sold inside the iPhone app (App Review Guideline 3.1.1): it shows the minutes and
  // what's on the account, with no prices, buy buttons or billing links.
  const native = isNativeApp();
  useEffect(() => { if (!native) notesApi.billing().then(setBill).catch((e) => say(e.message)); if (ctx.me.user.admin) notesApi.adminUsage().then((r) => setAdmin(r.people)).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const returnPath = ctx.mode === "embedded" ? "/arise-notes" : "/notes/";
  const choose = async (p: NotesProduct) => {
    setBusy(p);
    try {
      if (bill?.paidOnline) { await notesApi.change(p); say("Your plan is changed. The new limits work right away."); await ctx.refreshMe(); setBill(await notesApi.billing()); }
      else { const r = await notesApi.checkout(p, returnPath); window.location.assign(r.url); }
    } catch (e: any) { say(e.message); }
    finally { setBusy(""); }
  };
  const manage = async () => { setBusy("portal"); try { const r = await notesApi.portal(returnPath); window.location.assign(r.url); } catch (e: any) { say(e.message); } finally { setBusy(""); } };
  const pct = Math.min(100, u.pct);
  return <div className="space-y-4">
    <Section title="This month" icon={<Crown className="h-4 w-4" />}>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div><div className="text-[34px] font-extrabold leading-none tabular-nums">{u.left.toLocaleString("en-US")}</div><div className="text-[13px] text-[var(--an-muted)]">minutes left</div></div>
        <div className="text-[14px] text-[var(--an-muted)]"><b className="text-[var(--an-ink)]">{u.used.toLocaleString("en-US")}</b> used of {u.allowance.toLocaleString("en-US")}{u.rollover ? ` (${u.rollover.toLocaleString("en-US")} rolled over)` : ""}</div>
        <div className="text-[14px] text-[var(--an-muted)]">Starts again <b className="text-[var(--an-ink)]">{dayWords(u.resetOn)}</b></div>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--an-violet-soft)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Minutes used"><div className={`h-full rounded-full ${u.warn === 100 ? "bg-[var(--an-coral)]" : u.warn === 80 ? "bg-[#f5a524]" : "bg-[var(--an-violet)]"}`} style={{ width: `${pct}%` }} /></div>
      <p className="mt-3 text-[13px] leading-relaxed text-[var(--an-muted)]">You're on <b>{ctx.me.planName}</b>{u.pooled ? " (your family's shared minutes)" : ""}. Every minute of audio counts, recorded or uploaded, rounded up per recording. One recording can be up to {u.maxSecs >= 7200 ? "2 hours" : `${Math.round(u.maxSecs / 60)} minutes`}.{u.warn ? " You'll get a heads-up at 80% and at 100%." : ""}</p>
    </Section>
    {native ? <Notice>{NATIVE_NO_PURCHASE}</Notice> : !bill ? <Spinner /> : <>
      {bill.canBuy && !bill.payment && <Notice tone="warn">Paid plans aren't open on this site yet.</Notice>}
      {bill.given && <Notice>Your plan was set up for you{bill.endsAt ? ` until ${new Date(bill.endsAt).toLocaleDateString()}` : ""}.</Notice>}
      <div className="flex items-center justify-center gap-2 text-[14px]"><span>Plus billed</span><button type="button" className="an-chip" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button><button type="button" className="an-chip" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly · save 17%</button></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["free", "basic", "plus", "family"] as NotesPlanId[]).map((id) => {
          const p = NOTES_PLANS[id];
          const current = ctx.me.plan === id && !(id === "family" && u.pooled);
          const product: NotesProduct | null = id === "free" ? null : id === "plus" ? (yearly ? "plus_year" : "plus") : id;
          const price = id === "plus" && yearly ? `${money(p.yearlyCents!)}/yr` : id === "free" ? "$0" : `${money(p.monthlyCents)}/mo`;
          return <section key={id} className={`an-card flex flex-col p-5 ${current ? "ring-2 ring-[var(--an-violet)]" : ""} ${id === "plus" ? "border-[var(--an-violet)]" : ""}`}>
            <div className="flex items-center gap-2"><h3 className="text-[18px] font-bold">{p.name}</h3>{id === "plus" && <span className="rounded-full bg-[var(--an-violet)] px-2 py-0.5 text-[11px] font-bold text-white">Best value</span>}{current && <span className="ml-auto rounded-full bg-[var(--an-green-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--an-green)]">Your plan</span>}</div>
            <div className="mt-1 text-[24px] font-extrabold">{price}{id === "plus" && yearly && <span className="ml-1 text-[13px] font-semibold text-[var(--an-muted)]">≈ {money(Math.round(p.yearlyCents! / 12))}/mo</span>}</div>
            <ul className="mt-3 flex-1 space-y-1.5">{FEATURES[id].map((f) => <li key={f} className="flex gap-2 text-[14px]"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--an-green)]" aria-hidden />{f}</li>)}</ul>
            {product && bill.canBuy && bill.payment && !(current && (bill.product === product || id !== "plus")) && <Btn kind={id === "plus" ? "primary" : "soft"} className="mt-4" busy={busy === product} onClick={() => void choose(product)} data-testid={`notes-buy-${product}`}>{bill.paidOnline ? `Switch to ${p.name}${id === "plus" ? (yearly ? " yearly" : " monthly") : ""}` : `Get ${p.name}`}</Btn>}
          </section>;
        })}
      </div>
      {bill.canManage && <Btn kind="plain" className="w-full" busy={busy === "portal"} onClick={() => void manage()}>Manage billing, receipts or cancel</Btn>}
      <p className="text-center text-[12px] text-[var(--an-faint)]">Payments by Stripe. Changing plans takes effect right away; the difference is charged or credited.</p>
    </>}
    {admin && <Section title="Heavy users this month (admin)"><table className="w-full text-left text-[13px]"><thead><tr className="text-[var(--an-muted)]"><th>Account</th><th>Minutes</th><th>Jobs</th><th>Est. cost</th></tr></thead><tbody>{admin.map((r, i) => <tr key={i} className="border-t border-[var(--an-line)]"><td className="py-1.5">{r.name}</td><td>{r.minutes}</td><td>{r.jobs}</td><td>${(r.costCents / 100).toFixed(2)}</td></tr>)}</tbody></table>{!admin.length && <p className="text-[13px] text-[var(--an-muted)]">No usage yet this month.</p>}</Section>}
  </div>;
}

function FamilyTab({ ctx }: { ctx: AppCtx }) {
  const say = useToast();
  const f = ctx.me.family;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState("");
  const run = async (k: string, fn: () => Promise<unknown>) => { setBusy(k); try { await fn(); await ctx.refreshMe(); } catch (e: any) { say(e.message); } finally { setBusy(""); } };
  const owner = ctx.me.plan === "family" && !ctx.me.usage.pooled;
  return <div className="space-y-4">
    <Section title="Family plan" icon={<Users className="h-4 w-4" />}>
      <p className="text-[14px] leading-relaxed text-[var(--an-muted)]">Up to 4 people share 2,000 minutes a month, each with their own private notes and all of Plus. Notes stay private unless someone shares one with the family.</p>
      {owner && <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[var(--an-violet-soft)] p-4">
          <div className="flex-1"><div className="text-[13px] font-semibold text-[var(--an-violet-ink)]">Invite code</div><div className="font-mono text-[26px] font-bold tracking-[.2em]">{f?.code ?? "—"}</div></div>
          <Btn kind="primary" busy={busy === "code"} onClick={() => void run("code", () => notesApi.familyCode())}>{f?.code ? "New code" : "Make a code"}</Btn>
        </div>
        <p className="text-[13px] text-[var(--an-muted)]">Send the code to the people you want to add. They open Arise Notes, go to Settings → Family, and type it in.</p>
      </div>}
      {f && <ul className="mt-4 divide-y divide-[var(--an-line)]">{f.people.map((p) => <li key={p.id} className="flex items-center gap-3 py-2.5 text-[15px]"><span className="flex-1">{p.name}{p.owner && <span className="ml-2 text-[12px] font-semibold text-[var(--an-muted)]">plan owner</span>}{p.id === ctx.me.user.id && <span className="ml-2 text-[12px] font-semibold text-[var(--an-violet)]">you</span>}</span>
        {owner && !p.owner && <Btn kind="ghost" busy={busy === `rm${p.id}`} onClick={() => void run(`rm${p.id}`, () => notesApi.familyRemove(p.id))}>Remove</Btn>}</li>)}</ul>}
      {f?.role === "member" && <Btn kind="danger" className="mt-3" busy={busy === "leave"} onClick={() => void run("leave", () => notesApi.familyLeave())}>Leave this family plan</Btn>}
      {!f && !owner && <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void run("join", async () => { const r = await notesApi.familyJoin(code); say(`You're on ${r.owner}'s Family plan.`); }); }}>
        <input className="an-input font-mono uppercase tracking-widest" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))} placeholder="Invite code" aria-label="Family invite code" />
        <Btn kind="primary" type="submit" busy={busy === "join"} disabled={code.length < 8}>Join</Btn>
      </form>}
      {!owner && !f && <p className="mt-3 text-[13px] text-[var(--an-muted)]">Want to start one? Choose Family on the Plan & minutes tab.</p>}
    </Section>
  </div>;
}

function PrivacyTab({ ctx }: { ctx: AppCtx }) {
  const say = useToast();
  const save = useSettings(ctx);
  const { logout, token } = useAuth();
  const s = ctx.me.settings;
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const [alsoAccount, setAlsoAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const wipe = async () => {
    setBusy(true);
    try {
      await notesApi.wipe();
      if (alsoAccount) {
        const res = await fetch(`${API_BASE}/api/account/delete`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ confirm: "DELETE", password }) });
        const data = await res.json().catch(() => null);
        if (!res.ok) { say(`Your notes are deleted, but the account wasn't: ${data?.message || "try again"}`); return; }
        say("Everything is deleted."); logout(); return;
      }
      say("All of your Arise Notes data is deleted.");
      ctx.refreshNotes(); await ctx.refreshMe(); setConfirm(false);
    } catch (e: any) { say(e.message); }
    finally { setBusy(false); }
  };
  return <div className="space-y-4">
    <Section title="Audio" icon={<Shield className="h-4 w-4" />}>
      <p className="mb-2 text-[14px] text-[var(--an-muted)]">After a recording is written down:</p>
      {([["delete", "Delete the audio (recommended)", "Only the text is kept."], ["30d", "Keep the audio for 30 days", "Then it's deleted by itself."], ["keep", "Keep the audio", "So you can listen back any time."]] as const).map(([v, label, hint]) =>
        <label key={v} className="flex cursor-pointer items-start gap-3 py-2"><input type="radio" name="audio" checked={s.audio === v} onChange={() => void save({ audio: v })} className="mt-1 h-5 w-5 accent-[var(--an-violet)]" /><span><span className="block text-[15px] font-semibold">{label}</span><span className="text-[13px] text-[var(--an-muted)]">{hint}</span></span></label>)}
      <p className="mt-2 text-[12px] text-[var(--an-faint)]">Audio that can't be written down yet (out of minutes) is kept until it is.</p>
    </Section>
    <Section>
      <Toggle on={s.consent} onChange={(v) => void save({ consent: v })} label="Remind me to tell people they're being recorded" />
    </Section>
    <Section title="How your notes are protected">
      <ul className="space-y-1.5 text-[14px] leading-relaxed text-[var(--an-muted)]">
        <li>• Your audio and notes are never used to train AI.</li>
        <li>• Encrypted on the way and where they're stored. Only you can open your notes, unless you share one.</li>
        <li>• Students under 13 only use Arise Notes through a teacher or parent account.</li>
      </ul>
      <Btn kind="soft" className="mt-3" onClick={() => ctx.go({ name: "privacy" })}>Student data privacy (FERPA and COPPA)</Btn>
    </Section>
    <Section title="Delete everything" icon={<Trash2 className="h-4 w-4" />}>
      {!confirm ? <><p className="mb-3 text-[14px] text-[var(--an-muted)]">Every note, transcript, summary, recording and usage record in Arise Notes, gone for good.</p><Btn kind="danger" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" />Delete everything</Btn></>
        : <div className="space-y-3">
          <Notice tone="bad">This can't be undone.</Notice>
          <label className="flex items-start gap-3 text-[14px]"><input type="checkbox" checked={alsoAccount} onChange={(e) => setAlsoAccount(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--an-violet)]" /><span>Also delete my whole A.R.I.S.E. account (To Duo, Reader and everything else)</span></label>
          {alsoAccount && <input type="password" className="an-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" aria-label="Password" />}
          <label className="block text-[14px] font-semibold">Type DELETE to confirm<input className="an-input mt-1" value={typed} onChange={(e) => setTyped(e.target.value)} /></label>
          <div className="flex gap-2"><Btn kind="danger" busy={busy} disabled={typed !== "DELETE" || (alsoAccount && !password)} onClick={() => void wipe()}>Delete for good</Btn><Btn kind="plain" onClick={() => setConfirm(false)}>Cancel</Btn></div>
        </div>}
    </Section>
  </div>;
}

function AccessTab({ ctx }: { ctx: AppCtx }) {
  const save = useSettings(ctx);
  const s = ctx.me.settings;
  return <div className="space-y-4">
    <Section title="Reading and seeing" icon={<Eye className="h-4 w-4" />}>
      <div className="divide-y divide-[var(--an-line)]">
        <Toggle on={s.font === "dyslexic"} onChange={(v) => void save({ font: v ? "dyslexic" : "standard" })} label={<span className="flex items-center gap-2"><Type className="h-4 w-4" />Dyslexia-friendly font</span>} hint="Lexend, with a little more space between letters and lines." />
        <Toggle on={s.simple} onChange={(v) => void save({ simple: v })} label="Simple text" hint="Bigger words and only the main parts of each note." />
        <Toggle on={s.contrast} onChange={(v) => void save({ contrast: v })} label="High contrast" />
        <Toggle on={s.large} onChange={(v) => void save({ large: v })} label="Large buttons" />
      </div>
    </Section>
    <Section title="Read aloud voice">
      <select className="an-input" value={s.voice} onChange={(e) => void save({ voice: e.target.value })} aria-label="Voice">{["hannah", "autumn", "diana", "austin", "daniel", "troy"].map((v) => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}</select>
      <p className="mt-2 text-[13px] text-[var(--an-muted)]">An AI voice reads summaries and emails aloud.</p>
    </Section>
    <Section title="Defaults">
      <label className="block text-[14px] font-semibold">Usual kind of recording<select className="an-input mt-1" value={s.template} onChange={(e) => void save({ template: e.target.value as any })}>{ctx.me.templates.filter((t) => t.allowed).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
      {ctx.me.user.workHub && <label className="mt-3 block text-[14px] font-semibold">Send to-dos to<select className="an-input mt-1" value={s.hub} onChange={(e) => void save({ hub: e.target.value as "life" | "work" })}><option value="life">LifeHub</option><option value="work">WorkHub</option></select></label>}
    </Section>
    <p className="text-center text-[12px] text-[var(--an-faint)]">Everything works with a keyboard and a screen reader. While recording: Space pauses, H marks a highlight.</p>
  </div>;
}
