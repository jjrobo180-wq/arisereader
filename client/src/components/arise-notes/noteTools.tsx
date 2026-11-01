// The note's tools: a parent-friendly email (plain words, any home language), the summary translated,
// and study tools from class notes (flashcards and a quiz, which a teacher can send to A.R.I.S.E. Reader).
import { useState } from "react";
import { BookOpen, Columns2, Copy, GraduationCap, Languages, Lock, Mail, Send, Volume2, X } from "lucide-react";
import type { NoteSummary, StudyTools } from "@shared/ariseNotes";
import { sayAI, stopAiVoice } from "@/lib/aiVoice";
import { notesApi, type FullNote } from "./api";
import { copyText, mailtoLink } from "./exporters";
import { Btn, Notice, Section, useToast } from "./ui";
import { openSplit, type AppCtx } from "./NotesApp";

const LANGUAGES = ["English", "Spanish", "Vietnamese", "Chinese (Simplified)", "Arabic", "Haitian Creole", "Portuguese", "Tagalog", "Russian", "Somali", "French", "Korean"];

function LanguagePick({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  const other = !LANGUAGES.includes(value);
  return <div className="flex flex-wrap gap-2">
    <select id={id} className="an-input !w-auto" value={other ? "__other" : value} onChange={(e) => onChange(e.target.value === "__other" ? "" : e.target.value)}>
      {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
      <option value="__other">Another language…</option>
    </select>
    {other && <input className="an-input !w-48" placeholder="Which language?" value={value} onChange={(e) => onChange(e.target.value)} maxLength={40} aria-label="Language" />}
  </div>;
}

export default function ToolsTab({ ctx, note, onNote, onTranslated }: { ctx: AppCtx; note: FullNote; onNote: (n: FullNote) => void; onTranslated: (x: { language: string; summary: NoteSummary }) => void }) {
  const say = useToast();
  const f = ctx.me.features;
  const [lang, setLang] = useState("English");
  const [tlang, setTlang] = useState("Spanish");
  const [busy, setBusy] = useState("");
  const [email, setEmail] = useState(() => note.extras.parent ? Object.values(note.extras.parent)[0] : null);
  const [study, setStudy] = useState<StudyTools | null>(note.extras.study ?? null);
  const [reading, setReading] = useState(false);
  const run = async (k: string, fn: () => Promise<void>) => { setBusy(k); try { await fn(); } catch (e: any) { say(e.message); if (e?.code === "upgrade") ctx.go({ name: "settings", tab: "plan" }); } finally { setBusy(""); } };
  const lock = (plan = "Basic") => <Btn kind="soft" onClick={() => ctx.go({ name: "settings", tab: "plan" })}><Lock className="h-4 w-4" />Comes with {plan}</Btn>;
  if (!note.summary) return <Section><p className="text-[15px] text-[var(--an-muted)]">Write the summary first (on the Summary tab). The tools start from it.</p></Section>;
  return <div className="space-y-4">
    <Section title="Parent-friendly summary" icon={<Mail className="h-4 w-4" />}>
      <p className="mb-3 text-[14px] text-[var(--an-muted)]">The meeting in plain words (about a 6th-grade reading level), as an email ready to send. In the family's home language if you like. You send it yourself.</p>
      {!f.parent ? lock() : <>
        <div className="flex flex-wrap items-center gap-2"><LanguagePick id="an-parent-lang" value={lang} onChange={setLang} /><Btn kind="primary" busy={busy === "parent"} disabled={!lang.trim()} onClick={() => void run("parent", async () => { const r = await notesApi.parent(note.id, lang, !!email && email.language === lang); setEmail(r.email); })} data-testid="notes-parent">Write the email</Btn></div>
        {email && <div className="mt-4 space-y-3 rounded-2xl bg-[var(--an-bg)] p-4">
          <p className="text-[14px]"><b>Subject:</b> {email.subject}</p>
          <p className="an-read whitespace-pre-wrap text-[15px] leading-relaxed">{email.body}</p>
          <div className="flex flex-wrap gap-2">
            <Btn kind="soft" onClick={async () => { if (await copyText(`${email.subject}\n\n${email.body}`)) say("Copied."); }}><Copy className="h-4 w-4" />Copy</Btn>
            <a className="an-btn an-plain" href={mailtoLink(email.subject, email.body)}><Mail className="h-4 w-4" />Open in email</a>
            <Btn kind="plain" onClick={async () => { if (reading) { stopAiVoice(); setReading(false); return; } setReading(true); try { await sayAI(email.body, { voice: ctx.me.settings.voice as any }); } finally { setReading(false); } }}>{reading ? <X className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}{reading ? "Stop" : "Read aloud"}</Btn>
          </div>
          <p className="text-[12px] text-[var(--an-faint)]">A draft: read it over before sending. Nothing is sent automatically.</p>
        </div>}
      </>}
    </Section>

    <Section title="Translate the summary" icon={<Languages className="h-4 w-4" />}>
      {!f.translate ? lock() : <div className="flex flex-wrap items-center gap-2"><LanguagePick id="an-tr-lang" value={tlang} onChange={setTlang} /><Btn kind="primary" busy={busy === "translate"} disabled={!tlang.trim()} onClick={() => void run("translate", async () => { const r = await notesApi.translate(note.id, tlang); onTranslated(r); })}>Translate</Btn></div>}
    </Section>

    <Section title="Flashcards and a quiz" icon={<GraduationCap className="h-4 w-4" />}>
      <p className="mb-3 text-[14px] text-[var(--an-muted)]">Turn class notes into study cards and a short quiz.</p>
      {!f.study ? lock() : !study ? <Btn kind="primary" busy={busy === "study"} onClick={() => void run("study", async () => { const r = await notesApi.study(note.id); setStudy(r.study); onNote({ ...note, extras: { ...note.extras, study: r.study } }); })} data-testid="notes-study"><BookOpen className="h-4 w-4" />Make them</Btn>
        : <StudyView study={study} />}
      {study && ctx.me.user.teacher && study.quiz.length > 0 && <div className="mt-4">{note.extras.readerQuiz ? <Notice tone="good">Sent to A.R.I.S.E. Reader. Your students find it in their custom quizzes.</Notice>
        : <Btn kind="soft" busy={busy === "reader"} onClick={() => void run("reader", async () => { const r = await notesApi.studyToReader(note.id); onNote({ ...note, extras: { ...note.extras, readerQuiz: r.quizId } }); say("Sent to A.R.I.S.E. Reader."); })}><Send className="h-4 w-4" />Send the quiz to A.R.I.S.E. Reader</Btn>}</div>}
    </Section>

    <Section title="Notes beside your to-dos" icon={<Columns2 className="h-4 w-4" />} className="an-extra">
      <p className="mb-3 text-[14px] text-[var(--an-muted)]">Open Arise To Duo's split screen: your notes on one side, your to-do list, calendar or WorkHub on the other. Made for the iPhone Duo, foldables, tablets and wide screens.</p>
      <div className="flex flex-wrap gap-2"><Btn kind="soft" onClick={() => openSplit(ctx.mode, "tasks")}>With my to-dos</Btn><Btn kind="plain" onClick={() => openSplit(ctx.mode, "calendar")}>With my calendar</Btn>{ctx.me.user.workHub && <Btn kind="plain" onClick={() => openSplit(ctx.mode, "workhub")}>With WorkHub</Btn>}</div>
    </Section>
  </div>;
}

function StudyView({ study }: { study: StudyTools }) {
  const [card, setCard] = useState(0);
  const [flip, setFlip] = useState(false);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const right = Object.entries(picked).filter(([q, a]) => study.quiz[Number(q)]?.answer === a).length;
  const c = study.flashcards[card];
  return <div className="space-y-5">
    {c && <div>
      <div className="an-flip" data-flipped={flip}>
        <div className="relative h-44">
          <button type="button" onClick={() => setFlip(true)} className="an-face absolute inset-0 grid place-items-center rounded-2xl bg-[var(--an-violet)] p-5 text-center text-[18px] font-bold text-white" aria-label={`Card ${card + 1}: ${c.front}. Tap to see the answer.`}>{c.front}</button>
          <button type="button" onClick={() => setFlip(false)} className="an-face an-back absolute inset-0 grid place-items-center rounded-2xl border-2 border-[var(--an-violet)] bg-white p-5 text-center text-[16px] leading-relaxed" aria-label={`Answer: ${c.back}`}>{c.back}</button>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[13px] text-[var(--an-muted)]">
        <Btn kind="ghost" disabled={card === 0} onClick={() => { setCard(card - 1); setFlip(false); }}>Back</Btn>
        <span>Card {card + 1} of {study.flashcards.length} · tap to flip</span>
        <Btn kind="ghost" disabled={card >= study.flashcards.length - 1} onClick={() => { setCard(card + 1); setFlip(false); }}>Next</Btn>
      </div>
    </div>}
    {study.quiz.length > 0 && <div className="space-y-4">
      <h4 className="text-[15px] font-bold">Quiz {Object.keys(picked).length === study.quiz.length && <span className="ml-2 rounded-full bg-[var(--an-green-soft)] px-2 py-0.5 text-[12px] text-[var(--an-green)]">{right} of {study.quiz.length} right</span>}</h4>
      {study.quiz.map((q, i) => <fieldset key={i} className="rounded-2xl border border-[var(--an-line)] p-3">
        <legend className="px-1 text-[15px] font-semibold">{i + 1}. {q.q}</legend>
        <div className="mt-1 grid gap-1.5">{q.choices.map((ch, k) => {
          const done = picked[i] !== undefined, isRight = k === q.answer, mine = picked[i] === k;
          return <button key={k} type="button" disabled={done} onClick={() => setPicked({ ...picked, [i]: k })}
            className={`min-h-11 rounded-xl border px-3 text-left text-[14px] ${done && isRight ? "border-[var(--an-green)] bg-[var(--an-green-soft)]" : done && mine ? "border-[var(--an-coral)] bg-[var(--an-coral-soft)]" : "border-[var(--an-line)] hover:border-[var(--an-violet)]"}`}>{ch}</button>;
        })}</div>
        {picked[i] !== undefined && q.why && <p className="mt-2 text-[13px] text-[var(--an-muted)]">{q.why}</p>}
      </fieldset>)}
      {Object.keys(picked).length > 0 && <Btn kind="ghost" onClick={() => setPicked({})}>Try again</Btn>}
    </div>}
  </div>;
}
