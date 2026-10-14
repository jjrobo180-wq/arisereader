// Rewards: the sticker chart toward a prize the child chose, prize history, the whole sticker
// collection, a printable chart for the fridge, and how to fade rewards out (ERIC).
import { Printer } from "lucide-react";
import { esc, printPage, uid } from "../kit";
import { PRIZE_IDEAS, dayOf } from "@shared/pro/potty";
import { usePotty } from "./ctx";
import { Btn2, C, Chip, Label, Meter, Note, Panel, Section, field, fieldStyle } from "./theme";

export default function Rewards() {
  const { data, set, kid, putKid, celebrate } = usePotty();
  const lastPrize = data.prizes.filter((p) => p.kid === kid.id).reduce((m, p) => Math.max(m, p.at), 0);
  const board = data.stickers.filter((s) => s.kid === kid.id && s.at > lastPrize);
  const all = data.stickers.filter((s) => s.kid === kid.id);
  const prizes = data.prizes.filter((p) => p.kid === kid.id).sort((a, b) => b.at - a.at);
  const full = board.length >= kid.goal;
  const print = () => printPage(`${kid.name}'s potty chart`, `<div style="text-align:center"><div style="font-size:60px">${esc(kid.avatar)} 🚽 ⭐</div><h1 style="font-size:34px">${esc(kid.name)}'s Potty Chart</h1><p style="font-size:18px">Every time I use the ${esc(kid.words.potty)}, I get a sticker!</p></div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:22px 0">${Array.from({ length: kid.goal }, (_, i) => `<div style="border:3px dashed #B7860B;border-radius:22px;aspect-ratio:1;display:flex;align-items:center;justify-content:center;font:900 22px Arial;color:#E8C977">${i + 1}</div>`).join("")}</div><div style="text-align:center;font-size:24px;border:3px solid #1F2544;border-radius:22px;padding:14px">🏆 When my chart is full: <b>${esc(kid.prize)}</b></div>`);
  return <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
    <div className="space-y-6">
      <Panel tone="night" className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-white/60">{kid.name}'s sticker chart</p><h2 className="mt-1 text-2xl font-extrabold">{full ? `${kid.name} earned: ${kid.prize}!` : `${kid.goal - board.length} more to ${kid.prize}`}</h2></div><Btn2 kind="plain" onClick={print}><Printer size={15} />Print a chart</Btn2></div>
        <div className="mx-auto mt-5 grid max-w-lg grid-cols-5 gap-2">{Array.from({ length: kid.goal }, (_, i) => <div key={i} className="flex aspect-square items-center justify-center rounded-2xl text-3xl sm:text-4xl" style={board[i] ? { background: "#fff" } : { border: `2px dashed ${C.duck}66`, color: `${C.duck}88`, fontSize: 14, fontWeight: 800 }}>{board[i] ? <span className="pt-pop">{board[i].s}</span> : i + 1}</div>)}</div>
        <Meter value={board.length} max={kid.goal} color={C.duck} className="mx-auto mt-4 max-w-lg !bg-white/15" />
        <div className="mt-5 flex flex-wrap justify-center gap-2">{full && <Btn2 big kind="duck" onClick={() => { set((d) => ({ ...d, prizes: [...d.prizes, { id: uid(), kid: kid.id, at: Date.now(), prize: kid.prize }] })); celebrate(`You earned ${kid.prize}`); }}>🏆 Claim the prize</Btn2>}<Btn2 kind="plain" onClick={() => celebrate("A bonus sticker")}>+ Bonus sticker</Btn2></div>
      </Panel>
      <Section title={`Sticker collection (${all.length})`}>{all.length ? <div className="flex flex-wrap gap-1 rounded-[22px] bg-white p-4 text-3xl" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}` }}>{all.map((s) => <span key={s.id} title={dayOf(s.at)}>{s.s}</span>)}</div> : <Note tone="info">Every potty win opens a celebration where {kid.name} picks a sticker. They collect here.</Note>}</Section>
    </div>
    <div className="space-y-6">
      <Section title="The prize">
        <Panel className="space-y-4">
          <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3"><Label text="Prize"><input value={kid.prize} onChange={(e) => putKid({ ...kid, prize: e.target.value.slice(0, 60) })} className={field} style={fieldStyle} /></Label><Label text="Stickers"><input type="number" min={3} max={40} value={kid.goal} onChange={(e) => putKid({ ...kid, goal: Math.max(3, Math.min(40, Number(e.target.value) || 10)) })} className={field} style={fieldStyle} /></Label></div>
          <div className="flex flex-wrap gap-1.5">{PRIZE_IDEAS.map((p) => <Chip key={p} on={kid.prize === p} onClick={() => putKid({ ...kid, prize: p })}>{p}</Chip>)}</div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={kid.tryStickers} onChange={(e) => putKid({ ...kid, tryStickers: e.target.checked })} className="mt-0.5 h-4 w-4" />Stickers for sitting and trying too (great at the start; turn off once they go regularly)</label>
        </Panel>
      </Section>
      <Section title="Using rewards well">
        <Panel tone="duck"><ul className="space-y-2 text-sm">
          <li><b>Start small.</b> 5–10 stickers so the first prize comes within a day or two.</li>
          <li><b>Reward right away</b> — within seconds of success.</li>
          <li><b>Praise effort</b>, not just results: "You sat and tried!" (ERIC).</li>
          <li><b>Make poop special.</b> A bigger reward for poop in the potty is fine for a while.</li>
          <li><b>Then fade.</b> Sticker for every pee → for a dry morning → for a dry day → praise and pride. Rewards that never change stop working (ERIC).</li>
        </ul></Panel>
      </Section>
      {prizes.length > 0 && <Section title="Prizes earned"><ul className="space-y-1.5">{prizes.map((p) => <li key={p.id} className="flex items-center gap-2 text-sm"><span>🏆</span><b>{p.prize}</b><span style={{ color: C.muted }}>{dayOf(p.at)}</span></li>)}</ul></Section>}
    </div>
  </div>;
}
