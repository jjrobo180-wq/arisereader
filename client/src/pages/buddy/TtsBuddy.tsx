// TTS Buddy (arisetodo.com/buddy and arisereader.com/buddy): #/buddy asks "teacher or student", #/buddy/teach is the
// teacher's phone, #/buddy/kid is the child's laptop. What it is: shared/ttsBuddy.ts and BuddyInfo.tsx.
import { lazy, Suspense, useEffect } from "react";
import { GraduationCap, Laptop } from "lucide-react";
import { B, BRAND_FONT, FONT, useBuddyFont } from "./buddyApi";
import { BuddyMark } from "./BuddyMark";
import { HELPS, InfoButton, STEPS } from "./BuddyInfo";

const BuddyTeacher = lazy(() => import("./BuddyTeacher"));
const BuddyLaptop = lazy(() => import("./BuddyLaptop"));

export default function TtsBuddy({ mode }: { mode?: string }) {
  useBuddyFont();
  useEffect(() => { const t = document.title; document.title = "TTS Buddy"; return () => { document.title = t; }; }, []);
  const fallback = <div className="min-h-[100dvh]" style={{ background: B.bg }} />;
  if (mode === "teach") return <Suspense fallback={fallback}><BuddyTeacher /></Suspense>;
  if (mode === "kid") return <Suspense fallback={fallback}><BuddyLaptop /></Suspense>;
  // On a laptop the student button comes first; on a phone, the teacher's.
  const wide = typeof window !== "undefined" && window.innerWidth >= 820;
  const student = <a key="kid" href="#/buddy/kid" data-testid="buddy-pick-kid" className="flex items-center gap-4 rounded-[22px] p-5 text-left" style={{ background: B.accent, color: "#fff", boxShadow: `0 6px 0 ${B.accentDeep}` }}>
    <Laptop className="h-12 w-12 shrink-0" /><span><span className="block text-[26px] font-semibold" style={{ fontFamily: BRAND_FONT }}>I'm a student</span><span className="text-[16px] opacity-90">On my school laptop</span></span></a>;
  const teacher = <a key="teach" href="#/buddy/teach" data-testid="buddy-pick-teacher" className="flex items-center gap-4 rounded-[22px] p-5 text-left" style={{ background: B.card, color: B.ink, border: `3px solid ${B.ink}`, boxShadow: `0 6px 0 ${B.ink}` }}>
    <GraduationCap className="h-12 w-12 shrink-0" /><span><span className="block text-[26px] font-semibold" style={{ fontFamily: BRAND_FONT }}>I'm a teacher</span><span className="text-[16px]" style={{ color: B.dim }}>On my phone, to snap worksheets</span></span></a>;
  return <div className="min-h-[100dvh] w-full" style={{ background: B.bg, color: B.ink, fontFamily: FONT }} data-testid="buddy-home">
    <div className="mx-auto grid min-h-[100dvh] max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-10">
      <div>
        <div className="flex items-center gap-3"><BuddyMark size={56} /><p className="flex-1 text-[38px] font-semibold" style={{ fontFamily: BRAND_FONT }}>TTS Buddy</p><InfoButton testId="buddy-info-home" /></div>
        <h1 className="mt-6 text-[34px] font-semibold leading-[1.1] sm:text-[44px]" style={{ fontFamily: BRAND_FONT }}>Worksheets that read themselves out loud.</h1>
        <p className="mt-4 max-w-lg text-[18px] leading-relaxed" style={{ color: B.dim }}>A teacher snaps a paper worksheet. Each student hears it one question at a time, every word lit up as it's read, with hints and easier words a tap away. No accounts for students.</p>
        <div className="mt-8 grid max-w-lg gap-4">{wide ? [student, teacher] : [teacher, student]}</div>
        <p className="mt-5 text-[15px]" style={{ color: B.dim }}>Also at arisetodo.com/buddy and arisereader.com/buddy.</p>
      </div>
      <div className="space-y-3" data-testid="buddy-home-helps">
        <p className="text-[14px] font-bold uppercase tracking-wide" style={{ color: B.dim }}>How it helps</p>
        {HELPS.slice(0, 4).map(([t, d]) => <div key={t} className="rounded-[18px] p-4" style={{ background: B.card, border: `2px solid ${B.line}` }}>
          <p className="text-[18px] font-bold">{t}</p><p className="mt-1 text-[15px] leading-relaxed" style={{ color: B.dim }}>{d}</p></div>)}
        <p className="pt-3 text-[14px] font-bold uppercase tracking-wide" style={{ color: B.dim }}>How it works</p>
        <ol className="space-y-2">{STEPS.map(([t], i) => <li key={t} className="flex items-center gap-3 text-[17px] font-bold">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[16px] text-white" style={{ background: B.ink, fontFamily: BRAND_FONT }}>{i + 1}</span>{t}</li>)}</ol>
      </div>
    </div>
  </div>;
}
