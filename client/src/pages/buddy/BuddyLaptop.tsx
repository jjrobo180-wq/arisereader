// TTS Buddy on a child's school laptop: shows a code for the teacher, then the worksheet one question at a time,
// read aloud with each word lit up as it's said. No account, no typing needed to get started.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Lightbulb, Loader2, Mic, Pause, Square, Turtle, Volume2 } from "lucide-react";
import { LETTERS, cleanAcc, isAnswered, pictureFor, tokens, type Acc, type Item, type Worksheet } from "@shared/ttsBuddy";
import { B, BRAND_FONT, BuddyError, FONT, call, figurePath, saveLaptop, savedLaptop, useAuthedImage, useBuddyFont, useRecorder, useVoice, type Clip, type LaptopId, type Playing } from "./buddyApi";
import { BuddyMark } from "./BuddyMark";

type State = { state: "waiting"; code: string } | { state: "linked"; name: string } | { state: "ready"; name: string; worksheet: Worksheet; answers: Record<string, string>; step: number; done: boolean; acc?: Acc };

/** Text with the word being read lit up, like a finger following along under the line. */
export function Words({ text, word, active, size }: { text: string; word: number; active: boolean; size?: number }) {
  const t = useMemo(() => tokens(text), [text]);
  const out: JSX.Element[] = []; let at = 0;
  t.forEach((tk, i) => {
    if (tk.i > at) out.push(<Fragment key={`s${i}`}>{text.slice(at, tk.i)}</Fragment>);
    const on = active && i === word;
    out.push(<span key={i} data-word={i} className="rounded-[6px] transition-colors duration-100" style={{ background: on ? B.mark : "transparent", boxShadow: on ? `0 0 0 3px ${B.mark}` : "none" }}>{tk.w}</span>);
    at = tk.i + tk.w.length;
  });
  if (at < text.length) out.push(<Fragment key="end">{text.slice(at)}</Fragment>);
  return <span style={{ whiteSpace: "pre-wrap", fontSize: size }}>{out}</span>;
}

const RATES = [{ r: 1, label: "Normal" }, { r: 0.8, label: "Slower" }, { r: 0.65, label: "Slowest" }];

export default function BuddyLaptop() {
  useBuddyFont();
  const [me, setMe] = useState<LaptopId | null>(() => savedLaptop());
  const [st, setSt] = useState<State | null>(null);
  const [err, setErr] = useState("");
  const starting = useRef(false);

  const start = useCallback(async () => {
    if (starting.current) return; starting.current = true;
    try { const r = await call<{ id: string; key: string; code: string }>("/laptop", { method: "POST" }); const id = { id: r.id, key: r.key }; saveLaptop(id); setMe(id); setSt({ state: "waiting", code: r.code }); setErr(""); }
    catch (e: any) { setErr(e.message); }
    finally { starting.current = false; }
  }, []);
  useEffect(() => { if (!me) void start(); }, [me, start]);

  const poll = useCallback(async () => {
    if (!me) return;
    try { const r = await call<State>(`/laptop/${me.id}`, { laptop: me }); setSt(r); setErr(""); }
    catch (e: any) { if (e instanceof BuddyError && e.status === 404) { saveLaptop(null); setMe(null); } else setErr(e.message); }
  }, [me]);
  const ready = st?.state === "ready";
  useEffect(() => {
    if (!me) return;
    void poll();
    const t = setInterval(() => { if (!document.hidden) void poll(); }, ready ? 6000 : 2500);
    return () => clearInterval(t);
  }, [me, poll, ready]);

  return <div className="min-h-[100dvh] w-full" style={{ background: B.bg, color: B.ink, fontFamily: FONT }} data-testid="buddy-laptop">
    {st?.state === "ready" && me ? <Quiz key={st.worksheet.id} me={me} st={st} onGone={poll} /> : <Waiting me={me} st={st} err={err} onJoined={poll} />}
  </div>;
}

function Waiting({ me, st, err, onJoined }: { me: LaptopId | null; st: State | null; err: string; onJoined: () => void }) {
  const [cls, setCls] = useState(""); const [name, setName] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const code = st?.state === "waiting" ? st.code : "";
  const join = async () => {
    if (!me) return; setBusy(true); setMsg("");
    try { await call(`/laptop/${me.id}/join`, { laptop: me, body: { classCode: cls, name } }); onJoined(); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  return <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col items-center justify-center px-6 py-10 text-center">
    <BuddyMark size={64} />
    <p className="mt-3 text-[30px] font-semibold" style={{ fontFamily: BRAND_FONT }}>TTS Buddy</p>
    {st?.state === "linked" ? <p className="mt-10 text-[24px]" data-testid="buddy-linked">Hi{st.name ? ` ${st.name}` : ""}! Your teacher is getting your worksheet ready…</p> : <>
      <p className="mt-8 text-[22px]" style={{ color: B.dim }}>Show this code to your teacher</p>
      <div className="mt-4 flex gap-3" data-testid="buddy-code" aria-label={code ? `Your code is ${code.split("").join(" ")}` : "Getting your code"}>
        {(code || "····").split("").map((d, i) => <span key={i} className="grid h-[112px] w-[88px] place-items-center rounded-[20px] text-[72px] font-bold" style={{ background: B.card, border: `3px solid ${B.ink}`, fontFamily: BRAND_FONT, boxShadow: `0 6px 0 ${B.ink}` }}>{code ? d : <Loader2 className="h-10 w-10 animate-spin" style={{ color: B.dim }} />}</span>)}
      </div>
      <p className="mt-6 max-w-md text-[17px]" style={{ color: B.dim }}>Your teacher types it on their phone, and your worksheet shows up here. Leave this page open.</p>
      <div className="mt-10 w-full max-w-md rounded-[20px] p-5 text-left" style={{ background: B.card, border: `2px solid ${B.line}` }}>
        <p className="text-[18px] font-bold">Or type your class code</p>
        <div className="mt-3 flex gap-2">
          <input value={cls} onChange={(e) => setCls(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))} placeholder="ABCD" aria-label="Class code" data-testid="buddy-class-input"
            className="w-36 rounded-[12px] px-3 py-3 text-center text-[26px] font-bold tracking-[.3em] outline-none" style={{ border: `2px solid ${B.ink}`, fontFamily: BRAND_FONT }} />
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} placeholder="Your first name" aria-label="Your first name" className="min-w-0 flex-1 rounded-[12px] px-3 py-3 text-[18px] outline-none" style={{ border: `2px solid ${B.line}` }} />
        </div>
        <button type="button" disabled={cls.length !== 4 || busy} onClick={join} className="mt-3 w-full rounded-[14px] py-3 text-[19px] font-bold text-white disabled:opacity-40" style={{ background: B.accent }} data-testid="buddy-join">{busy ? "Joining…" : "Join"}</button>
        {msg && <p className="mt-2 text-[15px]" style={{ color: B.accentDeep }}>{msg}</p>}
      </div>
    </>}
    {err && <p className="mt-6 text-[15px]" style={{ color: B.accentDeep }}>{err}</p>}
  </div>;
}

/** The picture that goes with a question, cut from the worksheet photo. */
export function Figure({ wid, item, auth, onHear, big }: { wid: string; item: Item; auth: { teacher?: boolean; laptop?: LaptopId | null }; onHear?: () => void; big?: boolean }) {
  const url = useAuthedImage(figurePath(wid, item), auth);
  if (!item.figure?.img) return null;
  return <figure className="mt-5 overflow-hidden rounded-[16px] bg-white p-2" style={{ border: `2px solid ${B.line}` }} data-testid="buddy-figure">
    {url ? <img src={url} alt={item.figure.alt || "Picture for this question"} className={`mx-auto w-auto max-w-full object-contain ${big ? "max-h-[440px]" : "max-h-[340px]"}`} />
      : <div className="grid h-40 place-items-center"><Loader2 className="h-7 w-7 animate-spin" style={{ color: B.dim }} /></div>}
    {onHear && item.figure.alt && <button type="button" onClick={onHear} className="mt-1 flex items-center gap-1.5 px-1 text-[15px] font-bold" style={{ color: B.blue }}><Volume2 className="h-4 w-4" />Hear about the picture</button>}
  </figure>;
}

function Quiz({ me, st, onGone }: { me: LaptopId; st: Extract<State, { state: "ready" }>; onGone: () => void }) {
  const ws = st.worksheet;
  const acc = cleanAcc(st.acc);
  const [step, setStep] = useState(() => Math.min(st.step, ws.items.length));
  const [answers, setAnswers] = useState<Record<string, string>>(st.answers);
  const [rate, setRate] = useState(() => { try { return Number(localStorage.getItem("tts-buddy-rate")) || 1; } catch { return 1; } });
  const [auto, setAuto] = useState(true);
  const [original, setOriginal] = useState(false);
  const [hints, setHints] = useState(0);
  const [micBusy, setMicBusy] = useState(false);
  const [micMsg, setMicMsg] = useState("");
  const rec = useRecorder();
  const fetchClip = useCallback((itemId: string, part: string) => call<Clip>("/speak", { laptop: me, body: { laptopId: me.id, worksheetId: ws.id, itemId, part } }), [me, ws.id]);
  const voice = useVoice(fetchClip, rate);
  const done = step >= ws.items.length;
  const item = ws.items[Math.min(step, ws.items.length - 1)];
  const sp = item.supports;
  const pic = pictureFor(ws.items, Math.min(step, ws.items.length - 1));
  const simpleOn = acc.simple && !!sp?.simple && !original;
  const qPart = simpleOn ? "s" : "q";
  const qText = simpleOn ? sp!.simple : item.text;
  const shownChoices = item.choices.map((c, i) => ({ c, i })).filter(({ i }) => !(acc.fewer && sp && sp.keep.length >= 2) || sp.keep.includes(i));
  const parts = (it: Item) => {
    const s = it.supports; const simple = acc.simple && !!s?.simple && !original;
    const keep = acc.fewer && s && s.keep.length >= 2 ? s.keep : it.choices.map((_, i) => i);
    return [simple ? "s" : "q", ...keep.map((i) => `c${i}`)];
  };
  const questions = ws.items.filter((i) => i.kind !== "read");
  const qIndex = questions.indexOf(item);
  const big = acc.big;

  // Answers and the step go back to the teacher's phone (a moment after the last change).
  const save = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(save.current);
    save.current = setTimeout(() => { call(`/laptop/${me.id}/progress`, { laptop: me, body: { worksheetId: ws.id, answers, step, done } }).catch((e) => { if (e.status === 409 || e.status === 404) onGone(); }); }, 700);
    return () => clearTimeout(save.current);
  }, [answers, step, done, me, ws.id, onGone]);
  useEffect(() => { try { localStorage.setItem("tts-buddy-rate", String(rate)); } catch { /* fine */ } }, [rate]);

  // Each new question: get its voice ready, read it out if "Read each question" is on (after the first tap), start the
  // hints over, and put the sentence starter in an empty written answer.
  const tapped = useRef(false);
  useEffect(() => {
    setHints(0); setOriginal(false); setMicMsg("");
    if (done) { voice.stop(); return; }
    voice.prefetch(item.id, parts(item));
    const next = ws.items[step + 1]; if (next) voice.prefetch(next.id, [parts(next)[0]]);
    if (acc.starter && sp?.starter && item.kind !== "choice" && item.kind !== "read" && !(answers[item.id] || "").trim()) setAnswers((a) => ({ ...a, [item.id]: `${sp.starter} ` }));
    if (auto && tapped.current) void voice.play(item.id, parts(item)); else voice.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, done]);

  const go = (d: number) => { tapped.current = true; setStep((s) => Math.max(0, Math.min(ws.items.length, s + d))); };
  const on = (part: string): Playing => (voice.playing && voice.playing.itemId === item.id && voice.playing.part === part ? voice.playing : null);
  const readAll = () => { tapped.current = true; if (voice.playing) voice.stop(); else void voice.play(item.id, parts(item)); };
  const setAnswer = (v: string) => setAnswers((a) => ({ ...a, [item.id]: v }));
  const answeredCount = questions.filter((q) => isAnswered(q, answers[q.id])).length;
  const nextHint = () => { tapped.current = true; const n = Math.min(hints + 1, sp?.steps.length || 0); setHints(n); void voice.play(item.id, [`h${n - 1}`]); };
  const mic = async () => {
    setMicMsg("");
    if (rec.on) {
      setMicBusy(true);
      try { const audio = await rec.stop(); const r = await call<{ text: string }>(`/laptop/${me.id}/hear`, { laptop: me, body: { audio } }); if (r.text) { const cur = (answers[item.id] || "").trimEnd(); setAnswer(cur ? `${cur} ${r.text}` : r.text); } else setMicMsg("I didn't catch that. Try again, a little louder."); }
      catch (e: any) { setMicMsg(e.message); } finally { setMicBusy(false); }
    } else { try { await rec.start(); } catch { setMicMsg("The microphone is off. Ask your teacher to allow it in the browser."); } }
  };
  const MicBtn = () => acc.mic ? <button type="button" onClick={mic} disabled={micBusy} data-testid="buddy-mic" aria-label={rec.on ? "Stop and type what I said" : "Say your answer"}
    className="flex shrink-0 items-center gap-2 self-start rounded-[16px] px-4 py-3 text-[18px] font-bold text-white disabled:opacity-60" style={{ background: rec.on ? "#d92d20" : B.ink }}>
    {micBusy ? <Loader2 className="h-6 w-6 animate-spin" /> : rec.on ? <Square className="h-6 w-6" /> : <Mic className="h-6 w-6" />}{micBusy ? "Listening…" : rec.on ? "Stop" : "Say it"}</button> : null;

  if (done) return <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col items-center justify-center px-6 text-center" data-testid="buddy-done">
    <div className="grid h-24 w-24 place-items-center rounded-full" style={{ background: B.green }}><Check className="h-14 w-14 text-white" strokeWidth={3} /></div>
    <p className="mt-6 text-[44px] font-semibold" style={{ fontFamily: BRAND_FONT }}>All done{st.name ? `, ${st.name}` : ""}!</p>
    <p className="mt-2 text-[22px]" style={{ color: B.dim }}>You answered {answeredCount} of {questions.length} questions. Your teacher can see your answers.</p>
    <button type="button" onClick={() => setStep(0)} className="mt-8 rounded-[16px] px-6 py-4 text-[20px] font-bold" style={{ background: B.card, border: `2px solid ${B.ink}` }}>Check my answers</button>
  </div>;

  const qSize = item.kind === "read" ? (big ? "text-[30px] leading-[1.75]" : "text-[24px] sm:text-[26px] leading-[1.5]") : (big ? "text-[38px] leading-[1.6] font-bold" : "text-[28px] font-bold sm:text-[32px] leading-[1.5]");
  return <div className="mx-auto flex min-h-[100dvh] max-w-4xl flex-col px-5 pb-6 pt-4 sm:px-8" data-big={big ? "1" : "0"}>
    <header className="flex items-center gap-3">
      <BuddyMark size={36} />
      <div className="min-w-0 flex-1"><p className="truncate text-[18px] font-bold">{ws.title}</p><p className="text-[14px]" style={{ color: B.dim }}>{st.name ? `${st.name} · ` : ""}{item.kind === "read" ? "Read first" : `Question ${qIndex + 1} of ${questions.length}`}</p></div>
      <div className="flex rounded-[12px] p-1" style={{ background: B.card, border: `2px solid ${B.line}` }} role="radiogroup" aria-label="Reading speed">
        {RATES.map((x) => <button key={x.r} type="button" role="radio" aria-checked={rate === x.r} onClick={() => setRate(x.r)} className="flex items-center gap-1 rounded-[9px] px-2.5 py-1.5 text-[14px] font-bold" style={{ background: rate === x.r ? B.ink : "transparent", color: rate === x.r ? "#fff" : B.dim }}>{x.r < 1 && <Turtle className="h-4 w-4" />}{x.label}</button>)}
      </div>
    </header>
    <div className="mt-3 flex gap-1.5" aria-hidden>{ws.items.map((it, i) => <button key={it.id} type="button" tabIndex={-1} onClick={() => { tapped.current = true; setStep(i); }} className="h-2.5 flex-1 rounded-full" style={{ background: i === step ? B.accent : it.kind !== "read" && isAnswered(it, answers[it.id]) ? B.green : B.line }} />)}</div>

    <main className="mt-6 flex-1">
      <div className="rounded-[24px] p-6 sm:p-8" style={{ background: B.card, border: `2px solid ${B.line}` }} data-testid="buddy-question">
        <div className="flex items-start gap-4">
          {item.kind !== "read" && <span className="grid h-12 min-w-12 shrink-0 place-items-center rounded-full px-2 text-[22px] font-bold text-white" style={{ background: B.ink, fontFamily: BRAND_FONT }}>{item.number || qIndex + 1}</span>}
          <p className={`flex-1 ${qSize}`} data-testid="buddy-qtext"><Words text={qText} word={on(qPart)?.word ?? -1} active={!!on(qPart)} /></p>
        </div>
        {acc.simple && sp?.simple && <button type="button" onClick={() => { voice.stop(); setOriginal((o) => !o); }} className="mt-2 text-[15px] font-bold underline" style={{ color: B.dim }} data-testid="buddy-original">{original ? "Show it in simpler words" : item.kind === "read" ? "Read the whole thing" : "Show the original question"}</button>}
        {pic && <Figure wid={ws.id} item={pic} auth={{ laptop: me }} big={big} onHear={() => { tapped.current = true; void voice.play(pic.id, ["p"]); }} />}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={readAll} data-testid="buddy-read" className="flex items-center gap-3 rounded-full py-3 pl-3 pr-6 text-[20px] font-bold text-white" style={{ background: voice.playing ? B.ink : B.blue, boxShadow: `0 5px 0 ${voice.playing ? "#000" : "#1f4fa8"}` }}>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/20">{voice.loading ? <Loader2 className="h-6 w-6 animate-spin" /> : voice.playing ? <Pause className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}</span>
            {voice.playing ? "Stop" : item.kind === "read" ? "Read it to me" : shownChoices.length ? "Read question and answers" : "Read it to me"}
          </button>
          {acc.steps && sp && sp.steps.length > 0 && hints < sp.steps.length && <button type="button" onClick={nextHint} data-testid="buddy-hint" className="flex items-center gap-2 rounded-full px-5 py-3 text-[19px] font-bold" style={{ background: B.mark, color: B.ink }}><Lightbulb className="h-6 w-6" />{hints ? "Another hint" : "I need help"}</button>}
        </div>
        {acc.steps && sp && hints > 0 && <ol className="mt-4 space-y-2" data-testid="buddy-hints">{sp.steps.slice(0, hints).map((h, i) => <li key={i} className={`flex items-start gap-3 rounded-[14px] p-3 ${big ? "text-[24px]" : "text-[19px]"}`} style={{ background: B.soft }}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[16px] font-bold text-white" style={{ background: B.accent }}>{i + 1}</span>
          <span className="flex-1"><Words text={h} word={on(`h${i}`)?.word ?? -1} active={!!on(`h${i}`)} /></span>
          <button type="button" aria-label="Hear this hint" onClick={() => void voice.play(item.id, [`h${i}`])} style={{ color: B.blue }}><Volume2 className="h-6 w-6" /></button></li>)}</ol>}
        {acc.vocab && sp && sp.vocab.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="buddy-vocab"><span className="text-[15px] font-bold" style={{ color: B.dim }}>Tricky words:</span>
          {sp.vocab.map((v, i) => { const speaking = on(`v${i}`); return <button key={i} type="button" onClick={() => { tapped.current = true; void voice.play(item.id, [`v${i}`]); }} className={`rounded-[12px] px-3 py-1.5 text-left ${big ? "text-[22px]" : "text-[18px]"}`} style={{ background: speaking ? B.mark : B.bg, border: `2px solid ${B.line}` }}>
            <b className="underline decoration-dotted">{v.w}</b>{speaking && <span className="block text-[16px]">{v.m}</span>}</button>; })}</div>}
        {voice.error && <p className="mt-3 text-[16px]" style={{ color: B.accentDeep }}>{voice.error}</p>}
      </div>

      {item.kind === "choice" && <div className={`mt-5 grid gap-3 ${shownChoices.length > 2 ? "sm:grid-cols-2" : ""}`}>
        {shownChoices.map(({ c, i }) => {
          const picked = answers[item.id] === c; const speaking = on(`c${i}`);
          return <div key={i} className="flex items-stretch overflow-hidden rounded-[18px]" style={{ background: picked ? B.soft : B.card, border: `3px solid ${picked ? B.accent : speaking ? B.blue : B.line}` }}>
            <button type="button" onClick={() => setAnswer(c)} aria-pressed={picked} data-testid={`buddy-choice-${i}`} className={`flex flex-1 items-center gap-3 p-4 text-left ${big ? "text-[30px]" : "text-[22px] sm:text-[24px]"}`}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[20px] font-bold" style={{ background: picked ? B.accent : B.bg, color: picked ? "#fff" : B.ink, fontFamily: BRAND_FONT }}>{picked ? <Check className="h-6 w-6" strokeWidth={3} /> : LETTERS[i]}</span>
              {/* The voice says the letter first ("A. their tails"), so word 0 on screen is spoken word 1. */}
              <span className="min-w-0 flex-1"><Words text={c} word={(speaking?.word ?? 0) - 1} active={!!speaking} /></span>
            </button>
            <button type="button" aria-label={`Read answer ${LETTERS[i]}`} onClick={() => { tapped.current = true; void voice.play(item.id, [`c${i}`]); }} className="grid w-16 shrink-0 place-items-center" style={{ borderLeft: `2px solid ${B.line}`, color: B.blue }}><Volume2 className="h-7 w-7" /></button>
          </div>;
        })}
      </div>}
      {(item.kind === "short" || item.kind === "long") && <div className="mt-5">
        <div className="flex gap-3">
          {item.kind === "short" ? <input value={answers[item.id] || ""} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer" aria-label="Your answer" data-testid="buddy-answer"
            className={`min-w-0 flex-1 rounded-[18px] px-5 py-4 outline-none ${big ? "text-[32px]" : "text-[26px]"}`} style={{ background: B.card, border: `3px solid ${(answers[item.id] || "").trim() ? B.accent : B.line}` }} />
            : <textarea value={answers[item.id] || ""} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer" aria-label="Your answer" rows={5} data-testid="buddy-answer"
              className={`min-w-0 flex-1 resize-y rounded-[18px] px-5 py-4 outline-none ${big ? "text-[28px] leading-[1.7]" : "text-[22px] leading-relaxed"}`} style={{ background: B.card, border: `3px solid ${(answers[item.id] || "").trim() ? B.accent : B.line}` }} />}
          <MicBtn />
        </div>
        {micMsg && <p className="mt-2 text-[16px]" style={{ color: B.accentDeep }}>{micMsg}</p>}
        {acc.bank && sp && sp.bank.length > 0 && item.kind === "short" && <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="buddy-bank"><span className="text-[15px] font-bold" style={{ color: B.dim }}>Word bank:</span>
          {sp.bank.map((w) => <button key={w} type="button" onClick={() => setAnswer(w)} className={`rounded-[12px] px-4 py-2 font-bold ${big ? "text-[26px]" : "text-[20px]"}`} style={{ background: answers[item.id] === w ? B.soft : B.card, border: `2px solid ${answers[item.id] === w ? B.accent : B.line}` }}>{w}</button>)}</div>}
      </div>}
    </main>

    <footer className="mt-6 flex items-center gap-3">
      <button type="button" disabled={step === 0} onClick={() => go(-1)} className="flex items-center gap-2 rounded-[16px] px-5 py-4 text-[20px] font-bold disabled:opacity-30" style={{ background: B.card, border: `2px solid ${B.ink}` }}><ArrowLeft className="h-6 w-6" />Back</button>
      <label className="mx-auto flex cursor-pointer items-center gap-2 text-[15px]" style={{ color: B.dim }}><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-5 w-5" />Read each question out loud</label>
      <button type="button" onClick={() => go(1)} data-testid="buddy-next" className="flex items-center gap-2 rounded-[16px] px-6 py-4 text-[20px] font-bold text-white" style={{ background: B.accent, boxShadow: `0 5px 0 ${B.accentDeep}` }}>{step === ws.items.length - 1 ? "Finish" : "Next"}<ArrowRight className="h-6 w-6" /></button>
    </footer>
  </div>;
}
