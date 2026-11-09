// The Arise marketplace: clients post what they need in Arise Fit, trainers who fit reply in Arise Trainer with a
// short pitch and a price, and the client hires one in a tap. Rules: shared/coachMarket.ts. Server: server/coach.ts.
import { useState } from "react";
import { Check, ChevronRight, Inbox, Megaphone, Send } from "lucide-react";
import { ALL_CONSENT, CONSENT_LABEL, MODE_LABEL, type Consent, type PublicTrainer } from "@shared/coach";
import type { Need } from "@shared/coachMatch";
import type { MarketReply } from "@shared/coachMarket";
import { ago, coachApi, post, put, usePoll } from "./coachApi";
import { Avatar, Stars } from "./CoachUi";
import { Btn, C, Card, Field, Sheet, Title, display, inputCls, inputStyle } from "../fit/fitUi";

type Mine = { id: string; at: string; need: Need; status: "open" | "hired" | "closed"; hired: number | null; open: boolean; replies: (MarketReply & { trainer: PublicTrainer })[] };
const usd = (c: number) => `$${Math.round(c / 100)}`;

/** In match results: post the answers so trainers come to you. */
export function PostRequest({ token, need, say, onPosted }: { token: string | null; need: Need; say: (m: string) => void; onPosted: () => void }) {
  const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); try { const r = await post<{ told: number }>(token, "/market", { need }); say(r.told ? `Posted. ${r.told} trainers who fit were told.` : "Posted. Trainers who fit will see it."); onPosted(); } catch (e: any) { say(e.message); } finally { setBusy(false); } };
  return <Card className="!p-4" testId="market-post-card">
    <p className="flex items-center gap-2 text-[17px] font-bold"><Megaphone className="h-5 w-5" style={{ color: C.lime }} />Let trainers come to you</p>
    <p className="mt-1 text-[14px]" style={{ color: C.steel }}>Post your answers. Trainers who fit reply with how they'd help and their price, then you pick. Free, and your contact details stay private.</p>
    <Btn className="mt-3 w-full" disabled={busy} onClick={go} testId="market-post">{busy ? "Posting…" : "Post my request"}</Btn>
  </Card>;
}

/** Arise Fit: your requests and the trainers who replied. */
export function MyRequests({ token, onProfile, onHired }: { token: string | null; onProfile: (t: PublicTrainer) => void; onHired: () => void }) {
  const { data, reload } = usePoll(() => coachApi<{ requests: Mine[] }>(token, "/market/mine"), [token], 60_000);
  const [open, setOpen] = useState<Mine | null>(null);
  const list = (data?.requests ?? []).filter((r) => r.open || r.replies.length);
  if (!list.length) return null;
  const replies = list.reduce((t, r) => t + (r.open ? r.replies.length : 0), 0);
  return <>
    <Card onClick={() => setOpen(list[0])} className="mt-3 !p-4" testId="market-mine">
      <div className="flex items-center gap-3"><Inbox className="h-6 w-6 shrink-0" style={{ color: C.lime }} />
        <span className="flex-1"><b className="block text-[16px]">Your request{list.length > 1 ? "s" : ""}</b><span className="text-[13px]" style={{ color: C.dim }}>{replies ? `${replies} trainer${replies === 1 ? "" : "s"} replied` : "Waiting for trainers to reply"}</span></span><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div>
    </Card>
    {open && <RequestReplies token={token} list={list} first={open} onClose={() => { setOpen(null); reload(); }} onProfile={onProfile} onHired={() => { setOpen(null); reload(); onHired(); }} />}
  </>;
}

function RequestReplies({ token, list, first, onClose, onProfile, onHired }: { token: string | null; list: Mine[]; first: Mine; onClose: () => void; onProfile: (t: PublicTrainer) => void; onHired: () => void }) {
  const [cur, setCur] = useState(first.id);
  const [hiring, setHiring] = useState<PublicTrainer | null>(null);
  const r = list.find((x) => x.id === cur) ?? first;
  return <Sheet title="Your request" onClose={onClose} testId="market-replies">
    {list.length > 1 && <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4">{list.map((x) => <button key={x.id} type="button" onClick={() => setCur(x.id)} className="h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold" style={x.id === cur ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card2 }}>{x.need.goal || "Request"} · {ago(x.at)}</button>)}</div>}
    <Card className="!p-3.5"><p className="font-semibold">{r.need.goal || "General fitness"} · {r.need.modes.map((m) => MODE_LABEL[m]).join(" or ") || "Any way"}</p>
      <p className="text-[13px]" style={{ color: C.dim }}>{r.need.budgetCents ? `Up to ${usd(r.need.budgetCents)}/month · ` : ""}Posted {ago(r.at)} ago{r.status === "hired" ? " · Hired" : !r.open ? " · Closed" : ""}</p>
      {r.open && <button type="button" onClick={async () => { await put(token, `/market/${r.id}`, { close: true }).catch(() => {}); onClose(); }} className="mt-2 text-[13px] font-semibold" style={{ color: C.dim }}>Close this request</button>}</Card>
    <Title>Replies · {r.replies.length}</Title>
    {r.replies.length ? <div className="space-y-3">{r.replies.map((x) => { const t = x.trainer; const hired = r.hired === t.id; return <Card key={t.id} className="!p-4" testId="market-reply-card">
      <div className="flex items-center gap-3"><Avatar t={t} size={52} /><div className="min-w-0 flex-1"><p className="truncate text-[20px] leading-none" style={display}>{t.name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[13px]" style={{ color: C.dim }}>{t.reviews ? <><Stars value={t.rating} />{t.rating.toFixed(1)} ({t.reviews})</> : "New on Arise"}{x.price ? ` · ${x.price}` : ""}</p></div></div>
      <p className="mt-2.5 whitespace-pre-line text-[15px] leading-relaxed">{x.message}</p>
      {hired ? <p className="mt-3 flex items-center gap-1.5 font-semibold" style={{ color: C.lime }}><Check className="h-5 w-5" />You hired {t.name.split(" ")[0]}</p>
        : r.open && <div className="mt-3 grid grid-cols-2 gap-2"><Btn kind="soft" className="!text-[15px]" onClick={() => onProfile(t)}>Profile</Btn><Btn className="!text-[15px]" onClick={() => setHiring(t)} testId="market-hire">Hire {t.name.split(" ")[0]}</Btn></div>}
    </Card>; })}</div>
      : <p className="text-[14px]" style={{ color: C.dim }}>No replies yet. Trainers who fit were told, and you'll get a notification when one answers.</p>}
    {hiring && <HireSheet token={token} rid={r.id} t={hiring} onClose={() => setHiring(null)} onDone={onHired} />}
  </Sheet>;
}

function HireSheet({ token, rid, t, onClose, onDone }: { token: string | null; rid: string; t: PublicTrainer; onClose: () => void; onDone: () => void }) {
  const [consent, setConsent] = useState<Consent>(ALL_CONSENT);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const first = t.name.split(" ")[0];
  return <Sheet title={`Hire ${first}`} onClose={onClose} testId="market-hire-sheet">
    <p className="text-[15px]" style={{ color: C.steel }}>You'll be connected right away. {first} can build your plan and message you here. Pick what {first} can see from Arise Fit (change it any time in Sharing):</p>
    <div className="mt-3 space-y-1.5">{(Object.keys(CONSENT_LABEL) as (keyof Consent)[]).map((k) => <label key={k} className="flex items-center gap-3 rounded-[12px] p-3" style={{ background: C.card }}>
      <input type="checkbox" checked={consent[k]} onChange={(e) => setConsent({ ...consent, [k]: e.target.checked })} className="h-6 w-6 accent-[var(--fit-accent)]" /><span><b className="block text-[15px]">{CONSENT_LABEL[k][0]}</b><span className="text-[12px]" style={{ color: C.dim }}>{CONSENT_LABEL[k][1]}</span></span></label>)}</div>
    {err && <p className="mt-3 text-[14px]" style={{ color: C.red }}>{err}</p>}
    <Btn className="mt-5 w-full" disabled={busy} onClick={async () => { setBusy(true); setErr(""); try { await post(token, `/market/${rid}/hire`, { trainerId: t.id, consent }); onDone(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }} testId="market-hire-go">{busy ? "Connecting…" : `Hire ${first}`}</Btn>
    <p className="mt-2 text-[12px]" style={{ color: C.dim }}>You pay {first} directly, the way you agree on together.</p>
  </Sheet>;
}

// ── Arise Trainer ─────────────────────────────────────────────────────────────────────────────────────────────
type ForMe = { id: string; name: string; at: string; title: string; need: Need; replies: number; mine: MarketReply | null; status: string; hiredMe: boolean };
export function MarketCard({ token, say }: { token: string | null; say: (m: string) => void }) {
  const { data, reload } = usePoll(() => coachApi<{ requests: ForMe[]; problem: string }>(token, "/trainer/market"), [token], 120_000);
  const [open, setOpen] = useState(false);
  const fresh = (data?.requests ?? []).filter((r) => r.status === "open" && !r.mine).length;
  if (!data) return null;
  return <>
    <Card onClick={() => setOpen(true)} className="mb-3 !p-4" testId="market-card">
      <div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: fresh ? C.lime : C.card2, color: fresh ? "var(--fit-on-accent)" : C.dim }}><Megaphone className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1"><p className="text-[20px] leading-none" style={display}>Client requests</p><p className="mt-1 text-[13px]" style={{ color: C.dim }}>{data.problem ? "People looking for a trainer. Get listed to answer them." : fresh ? `${fresh} new that fit you` : "Nothing new right now"}</p></div><ChevronRight className="h-5 w-5" style={{ color: C.dim }} /></div>
    </Card>
    {open && <MarketSheet token={token} data={data} say={say} onClose={() => { setOpen(false); reload(); }} reload={reload} />}
  </>;
}

function MarketSheet({ token, data, say, onClose, reload }: { token: string | null; data: { requests: ForMe[]; problem: string }; say: (m: string) => void; onClose: () => void; reload: () => void }) {
  const [reply, setReply] = useState<ForMe | null>(null);
  return <Sheet title="Client requests" onClose={onClose} testId="market-sheet">
    {data.problem ? <p className="rounded-[12px] p-4 text-[15px]" style={{ background: C.card }}>{data.problem} Clients post what they need in Arise Fit, and the trainers who fit get told first.</p>
      : !data.requests.length ? <p className="py-8 text-center text-[15px]" style={{ color: C.dim }}>No requests that fit you right now. You'll get a notification when one comes in.</p>
      : <div className="space-y-2.5">{data.requests.map((r) => <Card key={r.id} className="!p-4" testId="market-request">
        <div className="flex items-center gap-2"><b className="flex-1 text-[17px]">{r.name}</b><span className="text-[12px]" style={{ color: C.dim }}>{ago(r.at)}</span></div>
        <p className="text-[14px] font-semibold" style={{ color: C.lime }}>{r.title}</p>
        <p className="mt-1 text-[14px]" style={{ color: C.steel }}>{[r.need.level === "new" ? "New to training" : r.need.level === "experienced" ? "Experienced" : "Some experience", r.need.modes.some((m) => m !== "remote") ? `${r.need.perWeek}× a week` : "", r.need.budgetCents ? `budget about ${usd(r.need.budgetCents)}/month` : "", r.need.state ? `${r.need.state}${r.need.zip ? ` ${r.need.zip}` : ""}` : ""].filter(Boolean).join(" · ")}</p>
        {r.need.notes && <p className="mt-1.5 text-[14px]">"{r.need.notes}"</p>}
        {r.hiredMe ? <p className="mt-2 flex items-center gap-1.5 font-semibold" style={{ color: C.lime }}><Check className="h-5 w-5" />{r.name} hired you. They're in Clients.</p>
          : r.status !== "open" ? <p className="mt-2 text-[13px]" style={{ color: C.dim }}>Closed</p>
          : <Btn kind={r.mine ? "soft" : "primary"} className="mt-3 w-full !min-h-11 !text-[15px]" onClick={() => setReply(r)} testId="market-reply">{r.mine ? "Edit my reply" : `Reply to ${r.name}`}{r.replies ? ` · ${r.replies} replied` : ""}</Btn>}
      </Card>)}</div>}
    {reply && <ReplySheet token={token} r={reply} say={say} onClose={() => setReply(null)} onSent={() => { setReply(null); reload(); }} />}
  </Sheet>;
}

function ReplySheet({ token, r, say, onClose, onSent }: { token: string | null; r: ForMe; say: (m: string) => void; onClose: () => void; onSent: () => void }) {
  const [message, setMessage] = useState(r.mine?.message ?? ""); const [price, setPrice] = useState(r.mine?.price ?? "");
  const [busy, setBusy] = useState(false);
  const send = async () => { setBusy(true); try { await post(token, `/trainer/market/${r.id}/reply`, { message, price }); say(`Sent to ${r.name}.`); onSent(); } catch (e: any) { say(e.message); } finally { setBusy(false); } };
  return <Sheet title={`Reply to ${r.name}`} onClose={onClose} testId="market-reply-sheet">
    <p className="mb-3 text-[14px]" style={{ color: C.steel }}>{r.title}{r.need.notes ? ` · "${r.need.notes}"` : ""}</p>
    <Field label="How you'd help"><textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 800))} rows={5} placeholder={`Hi ${r.name}! I help people just like you with ${r.need.goal ? r.need.goal.toLowerCase() : "this"}. Here's how we'd start…`} className="mt-1 w-full rounded-[12px] p-3 text-[16px] outline-none" style={inputStyle} data-testid="market-message" /></Field>
    <div className="mt-2"><Field label="Your price"><input value={price} onChange={(e) => setPrice(e.target.value.slice(0, 60))} placeholder="$150/month, first week free" className={inputCls} style={inputStyle} /></Field></div>
    <Btn className="mt-5 w-full" disabled={busy || message.trim().length < 10} onClick={send} testId="market-send"><Send className="h-4 w-4" />{busy ? "Sending…" : r.mine ? "Update my reply" : "Send reply"}</Btn>
    <p className="mt-2 text-[12px]" style={{ color: C.dim }}>{r.name} sees your profile, rating and this reply. If they hire you, they're added to your clients right away.</p>
  </Sheet>;
}
