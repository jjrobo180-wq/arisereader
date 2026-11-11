// Paying your trainer inside Arise (Stripe Connect). Cooked: pay with a card from My trainer. Arise Trainer:
// set up payouts once, then see what came in. Rules and the fee: shared/coachPay.ts. Server: server/coach.ts.
import { useState } from "react";
import { BadgeDollarSign, Check, CreditCard, ExternalLink } from "lucide-react";
import { MODE_LABEL, money, priceText, type Price } from "@shared/coach";
import { PLATFORM_FEE_PCT, payKind, trainerGets, type Payment } from "@shared/coachPay";
import { coachApi, post, shortDate, usePoll } from "./coachApi";
import { Btn, C, Card, Title, display } from "../fit/fitUi";

const returnTo = () => window.location.origin + window.location.pathname;

/** Cooked, My trainer → Plan: pay your trainer by card. Shows nothing when they don't take in-app payments. */
export function PayTrainer({ token, linkId, trainer, say }: { token: string | null; linkId: string; trainer: string; say: (m: string) => void }) {
  const { data } = usePoll(() => coachApi<{ ready: boolean; prices: Price[]; payUrl: string; payments: Payment[] }>(token, `/links/${linkId}/pay`), [token, linkId], 0);
  const [busy, setBusy] = useState("");
  if (!data || (!data.ready && !data.payUrl)) return null;
  const pay = async (p: Price) => { setBusy(p.id); try { const r = await post<{ url: string }>(token, `/links/${linkId}/pay`, { priceId: p.id, returnTo: returnTo() }); window.location.href = r.url; } catch (e: any) { say(e.message); setBusy(""); } };
  const last = data.payments[0];
  return <div data-testid="pay-trainer">
    <Title>Pay {trainer}</Title>
    {data.ready && data.prices.length ? <div className="space-y-2">{data.prices.map((p) => <Card key={p.id} className="!p-3.5"><div className="flex items-center gap-3">
      <CreditCard className="h-5 w-5 shrink-0" style={{ color: C.lime }} />
      <div className="min-w-0 flex-1"><p className="truncate font-semibold">{p.label || MODE_LABEL[p.mode]}</p><p className="text-[13px]" style={{ color: C.dim }}>{priceText(p)}{payKind(p) !== "once" ? " · renews until you cancel" : ""}</p></div>
      <Btn className="!min-h-10 !px-4 !text-[15px]" disabled={!!busy} onClick={() => pay(p)} testId="pay-go">{busy === p.id ? "…" : "Pay"}</Btn></div></Card>)}
      <p className="text-[12px]" style={{ color: C.dim }}>Card payments go to {trainer}'s own account through Stripe. You'll get a receipt by email.</p></div>
      : data.payUrl ? <Btn kind="soft" className="w-full" onClick={() => window.open(data.payUrl, "_blank")}><ExternalLink className="h-5 w-5" />Pay {trainer} (their payment link)</Btn> : null}
    {last && <p className="mt-2 flex items-center gap-1.5 text-[13px]" style={{ color: C.dim }}><Check className="h-4 w-4" style={{ color: C.lime }} />Last paid {money(last.cents)} on {shortDate(last.at)} for {last.label}</p>}
  </div>;
}

type Payouts = { configured: boolean; started: boolean; ready: boolean; feePct: number; month: { cents: number; fee: number; count: number; net: number }; all: { cents: number; count: number; net: number }; recent: (Payment & { client: string })[] };
/** Arise Trainer, Business: take card payments in the app. */
export function PayoutsCard({ token, say }: { token: string | null; say: (m: string) => void }) {
  const { data } = usePoll(() => coachApi<Payouts>(token, "/trainer/payouts"), [token], 0);
  const [busy, setBusy] = useState(false);
  const go = async (path: string) => { setBusy(true); try { const r = await post<{ url: string }>(token, path, { returnTo: returnTo() }); window.location.href = r.url; } catch (e: any) { say(e.message); setBusy(false); } };
  if (!data) return null;
  return <>
    <Title>Get paid in the app</Title>
    <Card className="!p-4" testId="tr-payouts">
      {data.ready ? <>
        <p className="flex items-center gap-2 text-[22px] leading-none" style={display}><BadgeDollarSign className="h-6 w-6" style={{ color: C.lime }} />Taking card payments</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-[12px] p-3" style={{ background: C.card2 }}><p className="text-[26px] leading-none" style={display}>{money(data.month.cents)}</p><p className="mt-1 text-[11px] uppercase" style={{ color: C.dim }}>this month · {data.month.count}</p></div>
          <div className="rounded-[12px] p-3" style={{ background: C.card2 }}><p className="text-[26px] leading-none" style={display}>{money(data.month.net)}</p><p className="mt-1 text-[11px] uppercase" style={{ color: C.dim }}>to you after fees</p></div></div>
        {data.recent.length > 0 && <div className="mt-3 space-y-1">{data.recent.slice(0, 5).map((p) => <div key={p.id} className="flex items-center gap-2 text-[14px]"><span className="flex-1 truncate">{p.client} · {p.label}</span><span style={{ color: C.dim }}>{shortDate(p.at)}</span><b>{money(p.cents)}</b></div>)}</div>}
        <Btn kind="soft" className="mt-3 w-full !text-[15px]" disabled={busy} onClick={() => go("/trainer/payouts/dashboard")}>Payouts and bank account</Btn>
      </> : <>
        <p className="text-[22px] leading-none" style={display}>{data.started ? "Finish setting up payouts" : "Let clients pay you by card"}</p>
        <p className="mt-1 text-[14px]" style={{ color: C.steel }}>Clients tap Pay in Cooked, using the prices on your listing. Money goes straight to your bank. Arise keeps {PLATFORM_FEE_PCT}%, plus Stripe's card fee (2.9% + 30¢). On a $150 payment you get about {money(trainerGets(15000))}.</p>
        {data.configured ? <Btn className="mt-3 w-full" disabled={busy} onClick={() => go("/trainer/payouts/setup")} testId="tr-payouts-setup">{busy ? "Opening Stripe…" : data.started ? "Continue setup" : "Set up payouts (about 5 minutes)"}</Btn>
          : <p className="mt-3 rounded-[10px] p-3 text-[13px]" style={{ background: C.card2, color: C.steel }}>Card payments open soon. Until then, add your own payment link in Edit listing.</p>}
      </>}
    </Card>
  </>;
}
