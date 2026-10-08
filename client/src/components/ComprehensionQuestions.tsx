// The written reading comprehension part at the end of a book quiz: three questions about
// the book, for up to 10 extra points that the student's teacher gives. Shown with a
// parent or teacher proctor code and on camera (no-proctor) quizzes.
import { useEffect, useState } from "react";
import { PenLine, Square, Volume2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";
import { COMPREHENSION, COMPREHENSION_PROMPTS, comprehensionState, type ComprehensionAnswers, type PromptId } from "@shared/comprehension";

export default function ComprehensionQuestions({ value, onChange, startNumber }: {
  value: ComprehensionAnswers;
  onChange: (next: ComprehensionAnswers) => void;
  /** The number after the last multiple-choice question. */
  startNumber: number;
}) {
  const [speaking, setSpeaking] = useState<PromptId | null>(null);
  useEffect(() => () => stopSpeaking(), []);
  const state = comprehensionState(value);

  // Read aloud with the same voice as the quiz questions.
  const speak = (id: PromptId, text: string) => {
    stopSpeaking();
    if (speaking === id) { setSpeaking(null); return; }
    setSpeaking(id);
    void speakCharacterAI(text, { onEnd: () => setSpeaking(null), onFallback: () => setSpeaking(null) });
  };

  return (
    <section className="mt-8" aria-labelledby="comprehension-title" data-testid="comprehension-section">
      <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-500"><PenLine className="h-5 w-5" /></div>
          <div className="min-w-0">
            <h3 id="comprehension-title" className="text-lg font-bold">Reading comprehension</h3>
            <span className="mt-1 inline-block rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-500">Up to {COMPREHENSION.bonusPoints} extra points</span>
            <p className="mt-1 text-sm text-muted-foreground">
              Optional. Answer these 3 questions in your own words. Your teacher reads them and gives you up to {COMPREHENSION.bonusPoints} extra points. Answer all 3, or leave all 3 empty to skip.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {COMPREHENSION_PROMPTS.map((p, i) => {
          const text = value[p.id] || "";
          const short = state === "incomplete" && text.trim().length < COMPREHENSION.minChars;
          return (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="mb-3 flex gap-3">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">{startNumber + i}</div>
                  <label htmlFor={`comprehension-${p.id}`} className="flex-1 text-base font-medium">
                    <span className="block text-xs font-bold uppercase tracking-wide text-emerald-500">{p.label}</span>
                    {p.text}
                  </label>
                  <button type="button" onClick={() => speak(p.id, `Question ${startNumber + i}. ${p.text}`)} className="flex flex-shrink-0 items-center gap-1.5 self-start rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10" title={speaking === p.id ? "Stop reading" : "Read question aloud"}>
                    {speaking === p.id ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    {speaking === p.id ? "Stop" : "Listen"}
                  </button>
                </div>
                <Textarea
                  id={`comprehension-${p.id}`}
                  value={text}
                  maxLength={COMPREHENSION.maxChars}
                  onChange={(e) => onChange({ ...value, [p.id]: e.target.value })}
                  placeholder={p.hint}
                  rows={4}
                  className="resize-y text-base"
                  aria-invalid={short || undefined}
                  data-testid={`comprehension-${p.id}`}
                />
                <div className="mt-1 flex justify-between gap-2 text-xs">
                  <span className={short ? "font-semibold text-amber-500" : "text-muted-foreground"}>{short ? "Write a little more (a full sentence)." : ""}</span>
                  {text.length > COMPREHENSION.maxChars - 200 && <span className="text-muted-foreground">{text.length}/{COMPREHENSION.maxChars}</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

/** For teachers looking at a quiz: what students with a proctor also see. */
export function ComprehensionPreview() {
  return (
    <Card className="mt-4 shadow-md" data-testid="comprehension-preview">
      <CardContent className="p-4">
        <p className="font-semibold"><PenLine className="mr-1 inline h-4 w-4 text-emerald-500" /> Reading comprehension · up to {COMPREHENSION.bonusPoints} extra points</p>
        <p className="mt-1 text-sm text-muted-foreground">At the end of the quiz, students can also answer these in writing, with a proctor code or on their own with the camera on. You grade them under Reading Comprehension on your dashboard.</p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
          {COMPREHENSION_PROMPTS.map((p) => <li key={p.id}>{p.text}</li>)}
        </ol>
      </CardContent>
    </Card>
  );
}
