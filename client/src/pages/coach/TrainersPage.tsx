// The trainer directory on the website (#/trainers): anyone can browse listed trainers, their prices and
// reviews without signing in. Connecting with one happens in Arise Fit; trainers list themselves in
// Arise Trainer (#/trainer).
import { useEffect, useState } from "react";
import { ArrowRight, UserRound } from "lucide-react";
import { LISTING, money } from "@shared/coach";
import { C, Card, display, font, glowBg, useFitFonts } from "../fit/fitUi";
import { Directory, TrainerPage } from "./CoachUi";

export default function TrainersPage() {
  useFitFonts();
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => { document.title = "Find a personal trainer · Arise"; }, []);
  return <div className="min-h-screen" style={{ background: glowBg, backgroundColor: C.bg, color: C.text, ...font }} data-testid="trainers-page">
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <p className="text-[12px] tracking-[.18em]" style={{ ...display, color: C.lime }}>Arise Fit · Trainers</p>
      <h1 className="fit-in mt-1 text-[48px] leading-[.92]" style={display}>Find a real trainer</h1>
      <p className="mt-2 text-[16px]" style={{ color: C.steel }}>Certified coaches, not AI. Each trainer sets their own prices for in-person, live video or online coaching. Reviews come only from people they've actually coached.</p>
      <Directory onOpen={(t) => setOpen(t.id)} />
      <Card className="mt-8 !p-5" style={{ background: "linear-gradient(150deg, #2e1d14, #202329)" }}>
        <div className="flex items-start gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px]" style={{ background: C.lime, color: "#0b0b0c" }}><UserRound className="h-6 w-6" /></span>
          <div><p className="text-[26px] leading-none" style={display}>Are you a trainer?</p>
            <p className="mt-1 text-[14px]" style={{ color: C.steel }}>List your prices, get reviews and coach clients in Arise Trainer. Their Arise Fit workouts, food and health data come to you automatically. {money(LISTING.cents)} a month after a {LISTING.trialDays}-day free trial.</p>
            <a href="#/trainer" className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-[10px] px-5 text-[18px]" style={{ ...display, background: C.lime, color: "#0b0b0c" }}>List yourself<ArrowRight className="h-5 w-5" /></a></div></div>
      </Card>
    </div>
    {open !== null && <TrainerPage id={open} onClose={() => setOpen(null)} action={() => <div>
      <a href="#/fit" className="flex min-h-[52px] w-full items-center justify-center rounded-[10px] text-[19px]" style={{ ...display, background: C.lime, color: "#0b0b0c" }}>Ask to coach me in Arise Fit</a>
      <p className="mt-2 text-center text-[12px]" style={{ color: C.dim }}>Sign in to Arise Fit (free), then open Find a trainer.</p>
    </div>} />}
  </div>;
}
