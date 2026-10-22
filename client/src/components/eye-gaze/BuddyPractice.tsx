// "Practice with my buddy" on the Eye Gazer profile: quick look-and-find questions taken from the
// Look & Find lessons (shared/eyegaze/lessons.ts). Look at a picture until the yellow bar fills,
// or tap it. Just practice, so no points; the Lessons page has the quizzes that earn points.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Check, ChevronRight, Volume2 } from "lucide-react";
import GazeButton from "@/components/eye-gaze/GazeButton";
import LessonPicture from "@/components/eye-gaze/LessonPicture";
import { sayLessonLine, stopLessonVoice } from "@/lib/lessonVoice";
import { EYE_GAZE_LESSONS } from "@shared/eyegaze/lessons";
import { picturePath } from "@shared/eyegaze/lessonSteps";

type Round = { ask: string; target: string; right: string; choices: Array<{ text: string; picture: string }> };

/** Every "Find the ___." question with pictures, three pictures each (the right one plus two). */
const ROUNDS: Round[] = EYE_GAZE_LESSONS.filter(lesson => lesson.step <= 2)
  .flatMap(lesson => lesson.quiz)
  .filter(q => q.show === "pictures" && q.skill === "identification" && q.choices.every(c => c.pic))
  .map(q => ({
    ask: q.ask,
    // "Find the dog." → "the dog"; "Find red." → "red"
    target: q.ask.replace(/^Find\s+/i, "").replace(/\.$/, ""),
    right: q.choices[0].text,
    choices: q.choices.slice(0, 3).map(c => ({ text: c.text, picture: picturePath(c.pic!) })),
  }));

function shuffled<T>(items: T[]): T[] {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export default function BuddyPractice({ buddy, buddyName, voice }: { buddy: ReactNode; buddyName: string; voice: boolean }) {
  const [, navigate] = useLocation();
  const order = useMemo(() => shuffled(ROUNDS), []);
  const [n, setN] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [settling, setSettling] = useState(false);
  const timers = useRef<number[]>([]);
  const round = order[n % order.length];
  const choices = useMemo(() => shuffled(round.choices), [round]);

  useEffect(() => () => { timers.current.forEach(window.clearTimeout); stopLessonVoice(); }, []);

  // A new picture set waits a moment, so a resting gaze doesn't pick by accident; then the buddy asks.
  useEffect(() => {
    if (n === 0) return;
    setSettling(true);
    timers.current.push(window.setTimeout(() => setSettling(false), 900));
    sayLessonLine(round.ask, { voice });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const choose = (text: string) => {
    if (picked || settling) return;
    setPicked(text);
    const right = text === round.right;
    setStreak(s => (right ? s + 1 : 0));
    sayLessonLine(right ? `Yes! You found ${round.target}!` : `Good try! This one is ${round.target}.`, { voice });
    timers.current.push(window.setTimeout(() => { setPicked(null); setN(i => i + 1); }, right ? 2000 : 2800));
  };

  const answered = picked !== null;
  const message = !answered ? round.ask : picked === round.right ? `Yes! You found ${round.target}!` : `Good try! This one is ${round.target}.`;

  return (
    <section className={`rounded-[2rem] overflow-hidden border-4 transition-colors ${answered ? (picked === round.right ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50") : "border-amber-200 bg-[#fffaf0]"}`}>
      <div className="grid grid-cols-1 lg:grid-cols-[330px_1fr]">
        <div className="p-5 sm:p-6 bg-gradient-to-br from-amber-100 to-orange-50 flex flex-col justify-center gap-4">
          <div className="inline-flex self-start rounded-full bg-amber-300 text-slate-950 px-4 py-2 text-xs font-black uppercase tracking-wider">
            Practice with {buddyName}
          </div>
          <div className="flex items-center gap-4">
            <GazeButton onSelect={() => sayLessonLine(message, { voice: true })} label="Hear it" className="flex-shrink-0 rounded-[2rem]">
              {buddy}
            </GazeButton>
            <div className="rounded-3xl bg-white border-4 border-teal-500 px-4 py-5 text-center flex-1" aria-live="polite">
              <div className={`text-xl sm:text-2xl font-black ${answered ? (picked === round.right ? "text-emerald-700" : "text-amber-800") : "text-teal-950"}`}>{message}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <GazeButton onSelect={() => sayLessonLine(round.ask, { voice: true })} label="Hear the question"
              className="min-h-[64px] rounded-2xl border-4 border-teal-200 bg-white text-teal-900 font-black flex items-center justify-center gap-2">
              <Volume2 className="w-6 h-6" aria-hidden="true" />Hear it
            </GazeButton>
            <div className="min-h-[64px] rounded-2xl bg-white/80 border-4 border-amber-200 text-amber-900 font-black flex items-center justify-center text-center px-2">
              {streak > 1 ? `${streak} in a row! ⭐` : "Look or tap"}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3 flex-1">
            {choices.map(choice => {
              const isRight = answered && choice.text === round.right;
              const missed = answered && choice.text === picked && !isRight;
              return (
                <div key={`${n}-${choice.text}`} className={`transition-opacity duration-300 ${answered && !isRight && !missed ? "opacity-40" : ""}`}>
                  <GazeButton onSelect={() => choose(choice.text)} ms={1500} barClass="h-3" disabled={answered || settling} label={choice.text}
                    className={`h-full w-full min-h-[185px] rounded-3xl border-[5px] p-3 flex flex-col items-center justify-center gap-2 disabled:opacity-100 ${isRight ? "border-emerald-500 bg-white ring-8 ring-emerald-200" : missed ? "border-amber-400 bg-white" : "border-amber-100 bg-white hover:border-teal-400"}`}>
                    <LessonPicture src={choice.picture} alt="" className="h-24 w-24 sm:h-32 sm:w-32" />
                    {isRight && <span className="text-2xl sm:text-3xl font-black text-teal-950">{choice.text}</span>}
                    {isRight && <span className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-emerald-500 text-white" aria-hidden="true"><Check className="h-6 w-6" /></span>}
                  </GazeButton>
                </div>
              );
            })}
          </div>
          <GazeButton onSelect={() => { stopLessonVoice(); navigate("/eye-gaze-lessons"); }} label="Go to my lessons" barClass="h-2.5"
            className="min-h-[72px] rounded-2xl bg-teal-700 text-white text-xl sm:text-2xl font-black flex items-center justify-center gap-2 border-4 border-teal-800">
            My lessons — earn points<ChevronRight className="w-7 h-7" aria-hidden="true" />
          </GazeButton>
        </div>
      </div>
    </section>
  );
}
