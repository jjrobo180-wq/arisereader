// Study Squad: what a reader sees once they sit down at a table. The lobby
// (pick a set and a game), the four games, and the results.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ROOM, STUDY_MODES, TEAM_NAMES, studyMode, type StudyPlayerView } from "@shared/study/game";
import type { Boot, RoomView } from "./api";
import { IconBot, IconCheck, IconCoin, IconCrown, IconFlag, IconHeart, IconX } from "./icons";

type Props = {
  room: RoomView; meId: number; offset: number; phrases: string[]; rewards: Boot["rewards"]; student: boolean;
  act: (body: Record<string, unknown>) => Promise<void>;
  onLeave: () => void; onPickSet: () => void; onHide?: () => void; onFlashcards: (setId: string) => void;
};

const SHAPES = ["▲", "◆", "●", "■"];
const joinNames = (names: string[]) => (names.length <= 1 ? names[0] ?? "" : names.slice(0, -1).join(", ") + " and " + names[names.length - 1]);

/** The server's clock, ticking, so every reader's timer shows the same time. */
function useServerNow(offset: number, running: boolean) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now() + offset), 100);
    return () => window.clearInterval(t);
  }, [offset, running]);
  return now;
}

export default function TablePanel({ room, meId, offset, phrases, rewards, student, act, onLeave, onPickSet, onHide, onFlashcards }: Props) {
  const me = room.players.find((p) => p.id === meId);
  const host = room.hostId === meId;
  const hostName = room.players.find((p) => p.host)?.name ?? "the host";
  const mode = studyMode(room.settings.mode);
  const timed = room.phase === "countdown" || room.phase === "question" || room.phase === "reveal" || room.phase === "racing";
  const now = useServerNow(offset, timed);
  const [copied, setCopied] = useState(false);
  const copyCode = () => { void navigator.clipboard?.writeText(room.code).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); }).catch(() => {}); };

  return (
    <section className="sq-sheet sq-sheet-table" aria-label="Your table">
      <div className={"sq-slate sq-table-slate phase-" + room.phase}>
        <header className="sq-slate-head">
          <div className="sq-table-name">
            <h2>{host ? "Your table" : `${hostName}'s table`}</h2>
            <span>{room.phase === "lobby" ? "Getting ready" : `${mode.icon} ${mode.name}`}</span>
          </div>
          <button type="button" className="sq-codechip" onClick={copyCode} title="Copy the table code">
            <small>Table code</small><b>{room.code}</b><i>{copied ? "Copied" : "Copy"}</i>
          </button>
          <div className="sq-head-btns">
            {onHide && <button type="button" className="sq-btn sq-btn-quiet" onClick={onHide}>Look around</button>}
            <button type="button" className="sq-btn sq-btn-quiet" onClick={onLeave}>Leave table</button>
          </div>
        </header>

        {room.phase === "lobby" && <Lobby room={room} host={host} hostName={hostName} act={act} onPickSet={onPickSet} onFlashcards={onFlashcards} />}
        {room.phase === "countdown" && <Countdown room={room} me={me} now={now} />}
        {(room.phase === "question" || room.phase === "reveal") && <Round room={room} me={me} now={now} act={act} />}
        {room.phase === "racing" && <Race room={room} me={me} now={now} act={act} />}
        {room.phase === "finished" && <Results room={room} me={me} host={host} hostName={hostName} rewards={rewards} student={student} act={act} onFlashcards={onFlashcards} />}

        <footer className="sq-phrases" aria-label="Say something">
          {phrases.map((p) => <button key={p} type="button" onClick={() => void act({ type: "say", phrase: p })}>{p}</button>)}
        </footer>
      </div>
    </section>
  );
}

// ─── The lobby ───────────────────────────────────────────────────────────────
function Lobby({ room, host, hostName, act, onPickSet, onFlashcards }: { room: RoomView; host: boolean; hostName: string; act: Props["act"]; onPickSet: () => void; onFlashcards: (id: string) => void }) {
  const s = room.settings;
  const seats = Array.from({ length: ROOM.seats }, (_, i) => room.players.find((p) => p.seat === i) ?? null);
  const set = (patch: Record<string, unknown>) => void act({ type: "settings", ...patch });
  return (
    <div className="sq-lobby">
      <div className="sq-lobby-main">
        <div className="sq-card sq-setcard">
          <div>
            <small>Study set</small>
            <b>{room.set?.title ?? "No set yet"}</b>
            {room.set && <span>{room.set.subject}, {room.set.count} questions, by {room.set.ownerName}</span>}
          </div>
          <div className="sq-setcard-btns">
            {host && <button type="button" className="sq-btn sq-btn-ink" onClick={onPickSet}>Change set</button>}
            {room.set && <button type="button" className="sq-btn sq-btn-inkquiet" onClick={() => onFlashcards(room.set!.id)}>Flashcards</button>}
          </div>
        </div>

        <div className="sq-modes" role="radiogroup" aria-label="Game">
          {STUDY_MODES.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={s.mode === m.id} className="sq-mode" disabled={!host} onClick={() => set({ mode: m.id })}>
              <i aria-hidden="true">{m.icon}</i><b>{m.name}</b><span>{m.blurb}</span>
            </button>
          ))}
        </div>

        <Choice label={s.mode === "race" ? "Steps to the summit" : "Questions"} values={ROOM.questionChoices} value={s.questions} host={host} onPick={(n) => set({ questions: n })} />
        {s.mode !== "race" && <Choice label="Seconds per question" values={ROOM.secondChoices} value={s.seconds} host={host} onPick={(n) => set({ seconds: n })} />}
        <Choice label="Study bots" values={[0, 1, 2, 3]} value={s.bots} host={host} onPick={(n) => set({ bots: n })} zero="None" />
        <div className="sq-optrow" role="group" aria-label="Who can join">
          <span>Who can join</span>
          <div>
            <button type="button" className="sq-opt" aria-pressed={s.publicTable} disabled={!host} onClick={() => set({ publicTable: true })}>Anyone in the hall</button>
            <button type="button" className="sq-opt" aria-pressed={!s.publicTable} disabled={!host} onClick={() => set({ publicTable: false })}>Only with the code</button>
          </div>
        </div>
      </div>

      <aside className="sq-lobby-side">
        <h3>At the table</h3>
        <ul className="sq-seats">
          {seats.map((p, i) => (
            <li key={i} className={p ? "" : "empty"}>
              {p ? <><PlayerName p={p} />{p.phrase && <q>{p.phrase}</q>}</> : <span>Open seat</span>}
            </li>
          ))}
        </ul>
        {host
          ? <button type="button" className="sq-btn sq-btn-main sq-btn-big" disabled={!room.set} onClick={() => void act({ type: "start" })}>Start the game</button>
          : <p className="sq-wait">Waiting for {hostName} to start the game.</p>}
        {host && room.players.length === 1 && <p className="sq-fine">Playing alone is fine. Add study bots for some competition, or share the table code with a friend.</p>}
      </aside>
    </div>
  );
}

function Choice({ label, values, value, host, onPick, zero }: { label: string; values: number[]; value: number; host: boolean; onPick: (n: number) => void; zero?: string }) {
  return (
    <div className="sq-optrow" role="group" aria-label={label}>
      <span>{label}</span>
      <div>{values.map((n) => <button key={n} type="button" className="sq-opt" aria-pressed={value === n} disabled={!host} onClick={() => onPick(n)}>{n === 0 && zero ? zero : n}</button>)}</div>
    </div>
  );
}

function PlayerName({ p }: { p: StudyPlayerView }) {
  return (
    <span className={"sq-name" + (p.away ? " away" : "")}>
      {p.bot && <IconBot />}{p.host && <i className="sq-crown" title="Table host"><IconCrown /></i>}<b>{p.name}</b>{p.away && <small>away</small>}
    </span>
  );
}

// ─── 3, 2, 1 ─────────────────────────────────────────────────────────────────
function Countdown({ room, me, now }: { room: RoomView; me?: StudyPlayerView; now: number }) {
  const mode = studyMode(room.settings.mode);
  const n = Math.max(1, Math.min(3, Math.ceil((room.phaseEnds - now) / 1000)));
  return (
    <div className="sq-countdown" role="status">
      <i aria-hidden="true">{mode.icon}</i>
      <h3>{mode.name}</h3>
      <p>{mode.blurb}</p>
      {mode.teams && me && <p className={"sq-teamline team-" + me.team}>You're on the {TEAM_NAMES[me.team]}.</p>}
      <b className="sq-count" key={n}>{n}</b>
    </div>
  );
}

// ─── A question everyone answers together (Lightning, Last One Standing, Tug of War) ──
function Round({ room, me, now, act }: { room: RoomView; me?: StudyPlayerView; now: number; act: Props["act"] }) {
  const q = room.question!;
  const reveal = room.reveal;
  const total = room.settings.seconds * 1000;
  const left = Math.max(0, room.phaseEnds - now);
  const waiting = room.players.filter((p) => !p.out && !p.answeredNow && !p.away).length;
  const answered = !!room.myAnswer;
  return (
    <div className="sq-game">
      <div className="sq-play">
        <div className="sq-qhead">
          <span>Question {room.round ? room.round.index + 1 : 1} of {room.round?.total ?? 1}</span>
          {room.phase === "question" && <b className={"sq-clock" + (left < 5000 ? " low" : "")} aria-label={`${Math.ceil(left / 1000)} seconds left`}>{Math.ceil(left / 1000)}</b>}
        </div>
        {room.phase === "question" && <div className="sq-timebar" aria-hidden="true"><i style={{ width: `${Math.min(100, (left / total) * 100)}%` }} /></div>}
        {room.tug && <Rope rope={room.tug.rope} win={room.tug.win} myTeam={me?.team} />}
        <Question key={`${room.round?.index}:${q.id}`} q={q} room={room} locked={answered || !!me?.out || !me} reveal={reveal} onAnswer={(payload) => void act({ type: "answer", questionId: q.id, ...payload })} />
        <div className="sq-status" role="status" aria-live="polite">
          {reveal
            ? <RevealLine reveal={reveal} />
            : me?.out ? "You're out of hearts this game. Keep following along!"
            : answered ? (waiting > 0 ? `Locked in. Waiting for ${waiting} more…` : "Locked in.")
            : q.input === "type" ? "Type your answer and lock it in." : q.kind === "card" ? "Pick the match." : "Pick an answer."}
        </div>
      </div>
      <Scoreboard room={room} meId={me?.id ?? 0} />
    </div>
  );
}

function RevealLine({ reveal }: { reveal: NonNullable<RoomView["reveal"]> }) {
  return (
    <div className="sq-reveal">
      {reveal.mine
        ? <b className={reveal.mine.correct ? "ok" : "no"}>{reveal.mine.correct ? `Right! +${reveal.mine.points}` : `Not this time. The answer is ${reveal.answerText}.`}</b>
        : <b>The answer is {reveal.answerText}.</b>}
      {reveal.explain && <span>{reveal.explain}</span>}
      {reveal.note && <em>{reveal.note}</em>}
    </div>
  );
}

function Question({ q, room, locked, reveal, onAnswer }: {
  q: NonNullable<RoomView["question"]>; room: RoomView; locked: boolean; reveal: RoomView["reveal"]; onAnswer: (payload: { choice?: number; text?: string }) => void;
}) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (q.input === "type") inputRef.current?.focus(); }, [q.input]);
  const mine = room.myAnswer;
  const pick = (i: number) => { if (locked || sent !== null) return; setSent(i); onAnswer({ choice: i }); };
  const submit = () => { const t = text.trim(); if (!t || locked || sent !== null) return; setSent(-1); onAnswer({ text: t }); };
  // number keys answer, for readers on a keyboard
  useEffect(() => {
    if (q.input !== "pick" || locked) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length) pick(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <h3 className={"sq-prompt" + (q.prompt.length > 90 ? " long" : "")}>{q.prompt}</h3>
      {q.input === "pick" ? (
        <div className={"sq-answers n" + q.options.length}>
          {q.options.map((opt, i) => {
            const chosen = (mine?.choice ?? sent) === i;
            const cls = reveal ? (i === reveal.correct ? " right" : chosen ? " wrong" : " dim") : chosen ? " chosen" : (locked || sent !== null) ? " dim" : "";
            return (
              <button key={i} type="button" className={`sq-answer c${i % 4}${cls}`} disabled={locked || sent !== null || !!reveal} onClick={() => pick(i)}>
                <i aria-hidden="true">{reveal && i === reveal.correct ? <IconCheck /> : reveal && chosen ? <IconX /> : SHAPES[i % 4]}</i>
                <span>{opt}</span>
                {reveal && reveal.counts[i] > 0 && <small>{reveal.counts[i]} picked</small>}
              </button>
            );
          })}
        </div>
      ) : (
        <form className="sq-typed" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <input ref={inputRef} value={mine?.text ?? text} onChange={(e) => setText(e.target.value)} disabled={locked || sent !== null || !!reveal} placeholder="Type your answer" maxLength={120} autoComplete="off" autoCapitalize="off" spellCheck={false} aria-label="Your answer" />
          <button type="submit" className="sq-btn sq-btn-main" disabled={locked || sent !== null || !!reveal || !text.trim()}>Lock in</button>
        </form>
      )}
    </>
  );
}

function Rope({ rope, win, myTeam }: { rope: number; win: number; myTeam?: 0 | 1 }) {
  const pos = 50 + (rope / win) * 42;
  return (
    <div className="sq-rope" role="img" aria-label={rope === 0 ? "The rope is in the middle" : `${TEAM_NAMES[rope < 0 ? 0 : 1]} are ahead by ${Math.abs(rope)}`}>
      <span className={"team-0" + (myTeam === 0 ? " mine" : "")}>{TEAM_NAMES[0]}</span>
      <div className="sq-rope-line">
        <i className="goal left" /><i className="goal right" /><i className="mid" />
        <b style={{ left: `${pos}%` }} />
      </div>
      <span className={"team-1" + (myTeam === 1 ? " mine" : "")}>{TEAM_NAMES[1]}</span>
    </div>
  );
}

function Scoreboard({ room, meId }: { room: RoomView; meId: number }) {
  const mode = room.settings.mode;
  const rows = room.players.slice().sort((a, b) => (mode === "survival" ? Number(a.out) - Number(b.out) || b.hearts - a.hearts || b.score - a.score : b.score - a.score) || a.seat - b.seat);
  return (
    <aside className="sq-scores" aria-label="Scores">
      <ol>
        {rows.map((p) => (
          <li key={p.id} className={(p.id === meId ? "me " : "") + (p.out ? "out " : "") + (mode === "tug" ? "team-" + p.team : "")}>
            <PlayerName p={p} />
            {mode === "survival"
              ? <span className="sq-hearts" aria-label={`${p.hearts} hearts`}>{Array.from({ length: ROOM.hearts }, (_, i) => <IconHeart key={i} off={i >= p.hearts} />)}</span>
              : <span className="sq-pts">{p.score}</span>}
            <span className="sq-mark" aria-hidden="true">
              {p.lastCorrect === true ? <i className="ok"><IconCheck /></i> : p.lastCorrect === false ? <i className="no"><IconX /></i> : p.answeredNow ? <i className="in" /> : null}
            </span>
            {p.phrase && <q>{p.phrase}</q>}
          </li>
        ))}
      </ol>
    </aside>
  );
}

// ─── Summit Race ─────────────────────────────────────────────────────────────
function Race({ room, me, now, act }: { room: RoomView; me?: StudyPlayerView; now: number; act: Props["act"] }) {
  const race = room.race!;
  const q = room.question;
  const frozen = Math.max(0, race.frozenUntil - now);
  const left = Math.max(0, room.phaseEnds - now);
  const clock = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
  const rows = room.players.slice().sort((a, b) => b.step - a.step || a.seat - b.seat);
  return (
    <div className="sq-game sq-race">
      <div className="sq-play">
        <div className="sq-qhead"><span>First to {race.goal} steps reaches the summit</span><b className={"sq-clock wide" + (left < 15000 ? " low" : "")} aria-label="Time left">{clock}</b></div>
        {me?.finished ? (
          <div className="sq-summit" role="status"><i aria-hidden="true">⛰️</i><h3>You reached the summit!</h3><p>Hang on while the others finish their climb.</p></div>
        ) : !me ? null : frozen > 0 && race.last ? (
          <div className="sq-freeze" role="status">
            <h3>Not quite.</h3>
            <p>The answer was <b>{race.last.answerText}</b>.</p>
            {race.last.explain && <p>{race.last.explain}</p>}
            <span>Catch your breath… {Math.ceil(frozen / 1000)}</span>
          </div>
        ) : q ? (
          <>
            <Question key={me.answered} q={q} room={room} locked={false} reveal={null} onAnswer={(payload) => void act({ type: "answer", questionId: q.id, ...payload })} />
            <div className="sq-status" role="status" aria-live="polite">
              {race.last?.correct ? (race.last.boost ? "Three in a row! Two steps up." : "Right! One step up.") : me.step === 0 ? "Every right answer is a step up. Three in a row is a double step." : ""}
            </div>
          </>
        ) : null}
      </div>
      <aside className="sq-scores sq-climb" aria-label="The climb">
        <ol>
          {rows.map((p) => (
            <li key={p.id} className={(p.id === me?.id ? "me " : "") + (p.finished ? "done" : "")}>
              <PlayerName p={p} />
              <span className="sq-pts">{p.finished ? <IconFlag /> : `${p.step}/${race.goal}`}</span>
              <div className="sq-track" aria-hidden="true"><i style={{ width: `${(p.step / race.goal) * 100}%` }} /></div>
              {p.phrase && <q>{p.phrase}</q>}
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

// ─── Results ─────────────────────────────────────────────────────────────────
function Results({ room, me, host, hostName, rewards, student, act, onFlashcards }: {
  room: RoomView; me?: StudyPlayerView; host: boolean; hostName: string; rewards: Boot["rewards"]; student: boolean; act: Props["act"]; onFlashcards: (id: string) => void;
}) {
  const res = room.results!;
  const mode = room.settings.mode;
  const mine = res.ranking.find((r) => r.id === me?.id);
  const firsts = res.ranking.filter((r) => r.place === 1).map((r) => (r.id === me?.id ? "You" : r.name));
  let headline: string;
  if (mode === "tug") headline = res.winnerTeam === -1 || res.winnerTeam === null ? "It's a tie!" : `${TEAM_NAMES[res.winnerTeam]} win!`;
  else if (res.ranking.length === 1) headline = "Set complete!";
  else headline = `${joinNames(firsts)} ${firsts.length > 1 || firsts[0] === "You" ? "win" : "wins"}!`;
  const earned = room.earned;
  const detail = (r: (typeof res.ranking)[number]): ReactNode => (mode === "race" ? `${r.step} steps` : mode === "survival" ? `${r.hearts} ${r.hearts === 1 ? "heart" : "hearts"} left` : `${r.score} pts`);
  return (
    <div className="sq-results">
      <div className="sq-results-main">
        <h3 className="sq-headline">{headline}</h3>
        {mine && <p className="sq-mine">You got {mine.correct} of {mine.answered} right{mine.bestStreak >= 3 ? `, with ${mine.bestStreak} in a row` : ""}.</p>}
        {student && earned && (earned.coins > 0 || earned.capped) && (
          <p className="sq-earned"><IconCoin />{earned.coins > 0 ? <b>+{earned.coins} Reader Coins</b> : <b>No more coins today</b>}{earned.capped && <span>You've reached today's limit of {rewards.dailyCap} coins from study games. Your points still count on the board.</span>}</p>
        )}
        <ol className="sq-ranking">
          {res.ranking.map((r) => (
            <li key={r.id} className={(r.id === me?.id ? "me " : "") + (mode === "tug" ? "team-" + r.team : "")}>
              <i>{mode === "tug" ? "" : r.place}</i>
              <b>{r.bot && <IconBot />}{r.name}{r.id === me?.id ? " (you)" : ""}</b>
              <span>{r.correct}/{r.answered} right</span>
              <span>{detail(r)}</span>
            </li>
          ))}
        </ol>
        <div className="sq-results-btns">
          {host ? <button type="button" className="sq-btn sq-btn-main sq-btn-big" onClick={() => void act({ type: "again" })}>Play again</button> : <p className="sq-wait">Waiting for {hostName} to set up the next game.</p>}
          {room.set && <button type="button" className="sq-btn" onClick={() => onFlashcards(room.set!.id)}>Study this set as flashcards</button>}
        </div>
      </div>
      <aside className="sq-review">
        <h3>{res.missed.length ? "Worth another look" : "Nothing to review"}</h3>
        {res.missed.length === 0
          ? <p className="sq-fine">{mine && mine.answered > 0 ? "You didn't miss a single one." : "Play a round to see what to practice."}</p>
          : <ul>{res.missed.map((m, i) => <li key={i}><span>{m.prompt}</span><b>{m.answer}</b>{m.yours && <small>You said: {m.yours}</small>}</li>)}</ul>}
      </aside>
    </div>
  );
}
