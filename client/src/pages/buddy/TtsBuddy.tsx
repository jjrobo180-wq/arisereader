// TTS Buddy (arisetodo.com/buddy): #/buddy asks "teacher or student", #/buddy/teach is the teacher's phone,
// #/buddy/kid is the child's laptop. What it is: shared/ttsBuddy.ts.
import { lazy, Suspense, useEffect } from "react";
import { GraduationCap, Laptop } from "lucide-react";
import { B, BRAND_FONT, FONT, useBuddyFont } from "./buddyApi";
import { BuddyMark } from "./BuddyMark";

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
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col justify-center px-5 py-10">
      <div className="flex items-center gap-3"><BuddyMark size={56} /><p className="text-[38px] font-semibold" style={{ fontFamily: BRAND_FONT }}>TTS Buddy</p></div>
      <p className="mt-4 text-[22px] leading-snug">Worksheets that read themselves out loud.</p>
      <p className="mt-2 text-[17px]" style={{ color: B.dim }}>A teacher snaps a worksheet, and each student hears it one question at a time, every word lit up as it's read. No accounts for students.</p>
      <div className="mt-8 grid gap-4">{wide ? [student, teacher] : [teacher, student]}</div>
    </div>
  </div>;
}
