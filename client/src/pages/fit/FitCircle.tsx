// Arise Fit: your workout circle (shared/fitCircle.ts, server/fitCircle.ts). Friends, each on their own
// account, who see each other's training as it happens, get a notification when someone in the circle
// finishes a workout, and send cheers and nudges. Anyone in the circle can invite more people.
import { useCallback, useEffect, useState } from "react";
import { Copy, Crown, Flame, Loader2, LogOut, Share2, Trophy, UserPlus, Users, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { TODO_APP } from "@/lib/hubs";
import { CHEERS, CODE_LEN, agoWords, circleLink, cleanCode, type Cheer, type CheerKind, type Member } from "@shared/fitCircle";
import { fitApi } from "./fitStore";
import { Btn, C, Card, Sheet, Title, display, haptic, inputCls, inputStyle, stagger } from "./fitUi";

type View = { inCircle: boolean; owner: boolean; code: string | null; max: number; members: Member[]; cheers: Cheer[] };

/** My circle, checked every 30 seconds while it's on screen. */
export function useCircle(token: string | null, on = true) {
  const [view, setView] = useState<View | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => fitApi<View>(token, "/circle").then((v) => { setView(v); setErr(""); }).catch((e) => setErr(e.message)), [token]);
  useEffect(() => { if (!on || !token) return; void load(); const t = window.setInterval(() => void load(), 30_000); return () => window.clearInterval(t); }, [load, on, token]);
  return { view, err, load };
}

const HUES = ["#ff5a1f", "#3b82f6", "#22c55e", "#a855f7", "#eab308", "#ec4899"];
function Face({ m, size = 44 }: { m: Pick<Member, "id" | "name">; size?: number }) {
  return <span className="grid shrink-0 place-items-center rounded-full font-bold text-white" style={{ width: size, height: size, background: HUES[m.id % HUES.length], fontSize: size * 0.42 }} aria-hidden>{(m.name.trim()[0] || "?").toUpperCase()}</span>;
}

/** On Today: who in your circle trained lately, or an invite to start one. */
export function CircleCard({ token, onOpen }: { token: string | null; onOpen: () => void }) {
  const { view } = useCircle(token);
  const others = (view?.members ?? []).filter((m) => !m.me);
  const latest = [...others].filter((m) => m.stats?.last).sort((a, b) => b.stats!.last!.date.localeCompare(a.stats!.last!.date))[0];
  const cheer = view?.cheers?.[0];
  return <Card className="mt-3 flex items-center gap-3 !p-4" onClick={onOpen} testId="fit-circle-card">
    {others.length ? <div className="flex -space-x-2">{others.slice(0, 3).map((m) => <span key={m.id} className="rounded-full" style={{ boxShadow: `0 0 0 2px ${C.bg}` }}><Face m={m} size={36} /></span>)}</div>
      : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: C.card2 }}><Users className="h-5 w-5" style={{ color: C.lime }} /></span>}
    <div className="min-w-0 flex-1">
      <p className="text-[19px] leading-none" style={display}>Workout circle</p>
      <p className="mt-1 truncate text-[13px]" style={{ color: C.dim }}>{cheer && Date.now() - cheer.at < 864e5 ? `${CHEERS[cheer.kind].e} ${cheer.name} · ${agoWords(cheer.at)}`
        : latest ? `${latest.name} trained ${agoWords(latest.stats!.last!.date)}: ${latest.stats!.last!.name}` : others.length ? "Nobody has trained yet this week" : "Train with friends and keep each other on track"}</p>
    </div>
  </Card>;
}

export function CircleSheet({ onClose, say, joinCode }: { onClose: () => void; say: (m: string) => void; joinCode?: string }) {
  const { token } = useAuth();
  const { view, err, load } = useCircle(token);
  const [code, setCode] = useState(joinCode ?? "");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const call = async (path: string, body: unknown, done?: string) => {
    setBusy(path); setMsg("");
    try { const r = await fitApi<any>(token, path, { method: "POST", body: JSON.stringify(body) }); if (done) say(done); await load(); return r; }
    catch (e: any) { setMsg(e.message); return null; } finally { setBusy(""); }
  };
  const share = async (c: string) => {
    const link = circleLink(TODO_APP, c);
    const text = `Join my workout circle on Arise Fit! We'll see each other's workouts and keep each other going. Open ${link} or enter code ${c} in Arise Fit › Workout circle.`;
    try { if (navigator.share) { await navigator.share({ title: "Join my workout circle", text }); return; } } catch (e: any) { if (e?.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text); say("Invite copied. Paste it in a text."); } catch { say(`The code is ${c}`); }
  };
  const invite = async () => { const r = view?.code ? { code: view.code } : await call("/circle/invite", {}); if (r?.code) await share(r.code); };
  const join = async () => { const c = cleanCode(code); if (!c) { setMsg(`Codes are ${CODE_LEN} letters and numbers.`); return; } if (await call("/circle/join", { code: c }, "You're in! Say hi with a cheer.")) { setCode(""); haptic("success"); } };
  const cheer = async (to: Member, kind: CheerKind) => { haptic("light"); await call("/circle/cheer", { to: to.id, kind }, `${CHEERS[kind].e} Sent to ${to.name}`); };
  const members = view?.members ?? [];
  const full = members.length >= (view?.max ?? 10);
  return <Sheet title="Workout circle" onClose={onClose} testId="fit-circle">
    {!view && !err && <div className="grid h-40 place-items-center"><Loader2 className="h-7 w-7 animate-spin" style={{ color: C.dim }} /></div>}
    {err && !view && <p className="px-1 text-[14px]" style={{ color: C.red }} role="alert">{err}</p>}
    {view && <>
      {!view.inCircle && <p className="px-1 text-[15px]" style={{ color: C.steel }}>Start a circle with up to {view.max - 1} friends, each on their own Arise Fit account. You'll see each other's workouts, streaks and new records, get a notification when someone trains, and cheer each other on. Food, weight and photos stay private.</p>}

      {view.inCircle && <><Title>This week</Title>
        <div className="space-y-2">{[...members].sort((a, b) => (b.stats?.week ?? 0) - (a.stats?.week ?? 0)).map((m, i) => <MemberRow key={m.id} m={m} rank={i} onCheer={(k) => void cheer(m, k)} busy={busy === "/circle/cheer"}
          onRemove={view.owner && !m.me ? () => { if (window.confirm(`Remove ${m.name} from your circle?`)) void call("/circle/remove", { id: m.id }, `${m.name} was removed.`); } : undefined} />)}</div></>}

      {view.cheers.length > 0 && <><Title>Cheers for you</Title>
        <Card className="!p-3"><ul className="space-y-2">{view.cheers.slice(0, 6).map((c, i) => <li key={i} className="flex items-center gap-2 text-[14px]"><span className="text-[18px]" aria-hidden>{CHEERS[c.kind].e}</span><span className="flex-1"><b>{c.name}</b> {c.kind === "nudge" ? "nudged you" : "cheered you on"}</span><span className="text-[12px]" style={{ color: C.dim }}>{agoWords(c.at)}</span></li>)}</ul></Card></>}

      <Title>{view.inCircle ? "Invite someone" : "Start a circle"}</Title>
      <Card className="!p-4">
        {view.code && <div className="mb-3 text-center"><p className="text-[12px] uppercase tracking-[.14em]" style={{ color: C.dim }}>Circle code</p><p className="mt-1 text-[40px] leading-none tracking-[.18em]" style={display} data-testid="fit-circle-code">{view.code}</p></div>}
        <Btn className="w-full" onClick={() => void invite()} disabled={!!busy || full} testId="fit-circle-invite">{busy === "/circle/invite" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />}{full ? `Your circle is full (${view.max})` : "Send an invite"}</Btn>
        {view.code && <div className="mt-2 grid grid-cols-2 gap-2">
          <Btn kind="soft" onClick={() => { void navigator.clipboard?.writeText(circleLink(TODO_APP, view.code!)).then(() => say("Link copied."), () => say(view.code!)); }}><Copy className="h-4 w-4" />Copy link</Btn>
          {(view.owner || !view.inCircle) && <Btn kind="soft" onClick={() => { if (window.confirm("Make a new code? The old one stops working (people already in stay).")) void call("/circle/invite", { fresh: true }, "New code ready."); }}>New code</Btn>}
        </div>}
      </Card>

      {!view.inCircle && <><Title>Join a friend's circle</Title>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void join(); }}>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LEN))} placeholder="Their code" className={`${inputCls} tracking-[.2em]`} style={inputStyle} autoCapitalize="characters" aria-label="Circle code" data-testid="fit-circle-join-code" />
          <Btn type="submit" disabled={!!busy || code.length !== CODE_LEN} testId="fit-circle-join">{busy === "/circle/join" ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}Join</Btn>
        </form></>}

      {msg && <p className="mt-3 px-1 text-[14px]" style={{ color: C.red }} role="alert">{msg}</p>}

      {view.inCircle && <Btn kind="danger" className="mt-6 w-full" onClick={() => { if (window.confirm(view.owner && members.length > 1 ? "Leave your circle? It carries on with everyone else." : "Leave this circle?")) void call("/circle/leave", {}, "You left the circle."); }} testId="fit-circle-leave"><LogOut className="h-5 w-5" />Leave circle</Btn>}
    </>}
  </Sheet>;
}

function MemberRow({ m, rank, onCheer, onRemove, busy }: { m: Member; rank: number; onCheer: (k: CheerKind) => void; onRemove?: () => void; busy: boolean }) {
  const s = m.stats;
  return <Card className="!p-3.5" style={stagger(rank, 0.05)} testId={`fit-member-${m.id}`}>
    <div className="flex items-center gap-3">
      <Face m={m} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[16px] font-semibold">{m.me ? "You" : m.name}{m.owner && <Crown className="h-4 w-4 shrink-0" style={{ color: C.orange }} aria-label="Started the circle" />}{rank === 0 && (s?.week ?? 0) > 0 && <Trophy className="h-4 w-4 shrink-0" style={{ color: C.lime }} aria-label="Most workouts this week" />}</p>
        <p className="truncate text-[12px]" style={{ color: C.dim }}>{s?.last ? `${s.last.name} · ${agoWords(s.last.date)}` : "No workouts yet"}{s?.goal ? ` · ${s.goal}` : ""}</p>
      </div>
      <div className="text-right"><p className="text-[26px] leading-none tabular-nums" style={display}>{s?.week ?? 0}</p><p className="text-[11px]" style={{ color: C.dim }}>this week</p></div>
      {onRemove && <button type="button" onClick={onRemove} aria-label={`Remove ${m.name}`} className="grid h-9 w-9 place-items-center" style={{ color: C.dim }}><X className="h-4 w-4" /></button>}
    </div>
    {s && (s.streak > 0 || s.prs.length > 0 || s.minutes7 > 0) && <div className="mt-2.5 flex flex-wrap gap-1.5 text-[12px] font-semibold">
      {s.streak > 0 && <span className="flex items-center gap-1 rounded-full px-2.5 py-1" style={{ background: C.card2 }}><Flame className="h-3.5 w-3.5" style={{ color: C.lime }} />{s.streak}-day streak</span>}
      {s.minutes7 > 0 && <span className="rounded-full px-2.5 py-1" style={{ background: C.card2 }}>{s.minutes7} min · {s.sets7} sets</span>}
      {s.prs.map((p) => <span key={p.name} className="rounded-full px-2.5 py-1" style={{ background: C.tint }}>🏆 {p.name} {p.weight} {s.units} × {p.reps}</span>)}
    </div>}
    {!m.me && <div className="mt-2.5 grid grid-cols-4 gap-1.5">{(Object.keys(CHEERS) as CheerKind[]).map((k) => <button key={k} type="button" disabled={busy} onClick={() => onCheer(k)} className="flex h-10 items-center justify-center gap-1 rounded-[10px] text-[12px] font-semibold disabled:opacity-50" style={{ background: C.card2 }} data-testid={`fit-cheer-${k}-${m.id}`}><span aria-hidden>{CHEERS[k].e}</span>{CHEERS[k].label}</button>)}</div>}
  </Card>;
}
