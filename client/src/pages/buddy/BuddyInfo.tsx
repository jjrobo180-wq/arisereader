// The "i" button on every TTS Buddy screen: what it is and how it helps. Teachers (and anyone on the home page) get
// the full explanation; students get a short, friendly one that's read aloud with the same voice.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";
import { B, BRAND_FONT, FONT } from "./buddyApi";
import { BuddyMark } from "./BuddyMark";

export const HELPS: [string, string][] = [
  ["Reading isn't the test", "Students who understand the work but struggle to read it — dyslexia, a reading IEP or 504, English learners, young readers — hear every question and answer, so they can show what they actually know."],
  ["Follow along, word by word", "Each word lights up as it's spoken, which builds word recognition instead of just replacing reading."],
  ["One question at a time", "No crowded page. Fewer things on screen means less overwhelm and better focus."],
  ["Accommodations, done for you", "Every question comes with easier words, step-by-step hints, a word bank, sentence starters, tricky words explained, 2 choices instead of 4, bigger text, a slower voice and a microphone to say the answer. All are on for every student, and you can turn any of them off."],
  ["Works with your paper", "Snap the worksheet you already have, up to 8 pages, pictures included. Nothing to retype or rebuild."],
  ["You see answers live", "Progress and answers show on your phone as students work."],
  ["Private by design", "Students don't need accounts, emails or names (add a first name or seat number if you like). Laptops unlink by themselves after the school day."],
];
export const STEPS: [string, string][] = [
  ["Snap the worksheet", "On your phone, take a photo of each page. TTS Buddy splits it into one question at a time and writes the supports."],
  ["Open the site on the laptop", "Go to arisetodo.com/buddy or arisereader.com/buddy, tap “I'm a student”, and a 4-digit code shows up."],
  ["Type the code on your phone", "The worksheet appears on that laptop and reads itself out loud. Students can also type your class code instead."],
];

export function InfoButton({ audience = "teacher", dark = false, testId = "buddy-info" }: { audience?: "teacher" | "student"; dark?: boolean; testId?: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={audience === "student" ? "What is this?" : "What is TTS Buddy?"} data-testid={testId}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: dark ? "rgba(255,255,255,.12)" : B.card, border: `2px solid ${dark ? "transparent" : B.line}`, color: dark ? "#fff" : B.ink }}>
      <Info className="h-5 w-5" />
    </button>
    {/* Drawn at the top of the page, so nothing on the screen behind it (a fixed corner, a button) shows through. */}
    {open && createPortal(<InfoSheet audience={audience} onClose={() => setOpen(false)} />, document.body)}
  </>;
}

export function InfoSheet({ audience, onClose }: { audience: "teacher" | "student"; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return <div className="fixed inset-0 kb-sheet z-[60] flex items-end justify-center sm:items-center" style={{ background: "rgba(20,24,33,.55)", fontFamily: FONT }} onClick={onClose} data-testid="buddy-info-sheet">
    <div role="dialog" aria-modal="true" aria-label="About TTS Buddy" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-[26px] p-5 sm:rounded-[26px] sm:p-7" style={{ background: B.bg, color: B.ink }} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-3">
        <BuddyMark size={44} />
        <p className="flex-1 text-[26px] font-semibold" style={{ fontFamily: BRAND_FONT }}>TTS Buddy</p>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full" style={{ background: B.card, border: `2px solid ${B.line}` }} data-testid="buddy-info-close"><X className="h-5 w-5" /></button>
      </div>
      {audience === "student" ? <StudentInfo /> : <TeacherInfo />}
      <button type="button" onClick={onClose} className="mt-6 w-full rounded-[14px] py-3.5 text-[18px] font-bold text-white" style={{ background: B.accent, boxShadow: `0 4px 0 ${B.accentDeep}` }}>Got it</button>
    </div>
  </div>;
}

function TeacherInfo() {
  return <>
    <p className="mt-4 text-[19px] font-bold leading-snug">Turns any paper worksheet into a talking, one-question-at-a-time quiz on a student's laptop.</p>
    <p className="mt-2 text-[16px]" style={{ color: B.dim }}>TTS means text to speech: the worksheet is read out loud in a natural voice, not a robot one, with every word lit up as it's said.</p>
    <h3 className="mt-6 text-[14px] font-bold uppercase tracking-wide" style={{ color: B.dim }}>How it helps</h3>
    <div className="mt-2 space-y-2.5">{HELPS.map(([t, d]) => <div key={t} className="rounded-[16px] p-4" style={{ background: B.card, border: `2px solid ${B.line}` }}>
      <p className="text-[17px] font-bold">{t}</p><p className="mt-0.5 text-[15px] leading-relaxed" style={{ color: B.dim }}>{d}</p></div>)}</div>
    <h3 className="mt-6 text-[14px] font-bold uppercase tracking-wide" style={{ color: B.dim }}>How to use it</h3>
    <ol className="mt-2 space-y-2.5">{STEPS.map(([t, d], i) => <li key={t} className="flex gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[16px] font-bold text-white" style={{ background: B.ink, fontFamily: BRAND_FONT }}>{i + 1}</span>
      <span><span className="block text-[17px] font-bold">{t}</span><span className="text-[15px]" style={{ color: B.dim }}>{d}</span></span></li>)}</ol>
  </>;
}

function StudentInfo() {
  const rows: [string, string][] = [
    ["Read it to me", "Your worksheet talks! Each word lights up when it's said, so you can follow along."],
    ["I need help", "Get a hint, one step at a time."],
    ["Easier words", "Hear the question in simpler words."],
    ["Just 2 choices", "Fewer answers to pick from."],
    ["Say it", "Say your answer out loud and it gets typed for you."],
    ["AA", "Make the words bigger."],
    ["Slower", "Make the voice slow down."],
  ];
  return <>
    <p className="mt-4 text-[20px] font-bold leading-snug">TTS Buddy reads your worksheet to you, one question at a time.</p>
    <p className="mt-2 text-[17px]" style={{ color: B.dim }}>You can use any of these whenever you want. Your teacher sees your answers.</p>
    <div className="mt-4 space-y-2">{rows.map(([t, d]) => <div key={t} className="flex items-start gap-3 rounded-[14px] p-3" style={{ background: B.card, border: `2px solid ${B.line}` }}>
      <span className="min-w-[132px] text-[17px] font-bold">{t}</span><span className="text-[16px]" style={{ color: B.dim }}>{d}</span></div>)}</div>
  </>;
}
