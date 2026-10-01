import { useEffect, useRef, useState } from 'react';
import { Check, Dices, Hand, Shield, Trophy, Volume2, RotateCcw, Users } from 'lucide-react';
import { API_BASE } from '@/lib/queryClient';
import { BOARD_LAST_SPACE, HANDS, rpsWinner, type Hand as HandChoice, type View, type TutorialResult } from '@shared/boardQuest';

const STEPS = [
  { title: 'Team up. Reach the finish.', icon: Trophy, text: `Welcome to Board Quest! Play for your team and take turns answering questions. Get one of your readers to the finish, space ${BOARD_LAST_SPACE + 1}, to win. Your team also wins if the other team runs out of players. Board Quest points track the rewards your team collects along the way.` },
  { title: 'Who goes first?', icon: Hand, text: 'Every player picks Rock, Paper, or Scissors in private. Rock beats Scissors, Scissors beats Paper, and Paper beats Rock. Each win earns a point in the opening competition. The player with the most wins goes first. If players tie, the randomizer picks a starter from those tied players.' },
  { title: 'Answer. Roll. Move.', icon: Dices, text: 'On your turn, choose an answer before the timer runs out. A correct answer rolls the dice and moves your reader. The whole room sees the same roll and landing. A wrong answer gives you a strike. Three strikes and your reader is out. A shield blocks one strike. Try this practice question, or continue.' },
  { title: 'Know your landing spaces', icon: Shield, text: 'Point spaces give your team 50 points. A jackpot gives 100. A steal takes up to 30 points from the other team. A shield protects you from one strike. A power adds two spaces to your next roll. Safe spaces have no penalty. On a battle space, choose Rock, Paper, or Scissors. The loser gets a strike; a tie gives no strikes.' },
  { title: 'Everyone starts together', icon: Users, text: 'You are ready! Finish this tutorial or skip it at any time. You will wait while the other readers finish or skip their own tutorials. Once everyone is ready, both teams make their entrance, then the opening Rock, Paper, Scissors competition begins. Good luck, readers!' },
];

export default function BoardTutorial({ view, myId, token, sound, busy, offline, error, finish }: {
  view: View; myId: number; token: string | null; sound: boolean; busy: boolean; offline: boolean; error: string;
  finish: (result: TutorialResult) => void;
}) {
  const [step, setStep] = useState(0), [replay, setReplay] = useState(0), [voiceState, setVoiceState] = useState('');
  const [example, setExample] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null), cancelRef = useRef<(() => void) | null>(null);
  const ready = view.tutorialReady.includes(myId), card = STEPS[step], Icon = card.icon;
  const humans = view.players.filter(player => !player.bot), remaining = humans.filter(player => !view.tutorialReady.includes(player.id));

  useEffect(() => {
    let alive = true, url = '', fallbackActive = false;
    const controller = new AbortController();
    const stop = () => { alive = false; controller.abort(); audioRef.current?.pause(); audioRef.current = null; if (url) URL.revokeObjectURL(url); if (fallbackActive) window.speechSynthesis?.cancel(); };
    cancelRef.current = stop;
    if (!sound || ready) { setVoiceState(sound ? '' : 'Narration muted'); return stop; }
    const fallback = () => {
      if (!alive) return;
      if (!('speechSynthesis' in window)) { setVoiceState('Read the rules below, then continue.'); return; }
      fallbackActive = true;
      const speech = new SpeechSynthesisUtterance(card.text);
      const voices = speechSynthesis.getVoices();
      const voice = voices.find(voice => /Guy|Daniel|David|Alex/i.test(voice.name) && /^en/i.test(voice.lang)) || voices.find(voice => /^en/i.test(voice.lang));
      if (voice) speech.voice = voice;
      speech.rate = 1; speech.pitch = .85;
      speech.onend = () => { if (alive) setVoiceState('Device narration finished'); };
      setVoiceState('Device narration'); speechSynthesis.speak(speech);
    };
    const narrate = async () => {
      setVoiceState('Preparing AI announcer…');
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`${API_BASE}/api/eye-gaze/tts`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: card.text, style: 'announcer' }), signal: controller.signal });
        if (!response.ok) throw Error('Voice unavailable');
        const blob = await response.blob();
        if (!alive) return;
        url = URL.createObjectURL(blob);
        const audio = new Audio(url); audio.volume = .92; audioRef.current = audio;
        audio.onended = () => { if (alive) setVoiceState('AI narration finished'); };
        audio.onerror = fallback;
        await audio.play();
        if (alive) setVoiceState('AI announcer speaking');
      } catch (error: any) {
        if (!alive) return;
        if (error?.name === 'NotAllowedError') setVoiceState('Tap Hear rules to play the announcer.');
        else fallback();
      } finally { window.clearTimeout(timeout); }
    };
    void narrate();
    return stop;
  }, [step, replay, ready, sound, token, view.tutorialId]);

  function markReady(result: TutorialResult) { cancelRef.current?.(); finish(result); }
  function next() { cancelRef.current?.(); setExample(''); setStep(index => Math.min(STEPS.length - 1, index + 1)); }
  function hearRules() {
    const audio = audioRef.current;
    if (audio) { audio.currentTime = 0; void audio.play().then(() => setVoiceState('AI announcer speaking')).catch(() => setVoiceState('Read the rules below, then continue.')); }
    else setReplay(value => value + 1);
  }
  return <section className="bq-tutorial" role="dialog" aria-modal="true" aria-label={ready ? 'Waiting for other readers' : 'Board Quest rules tutorial'}>
    <div className="bq-tutorial-card">
      {ready ? <>
        <Check className="bq-tutorial-icon" size={44} />
        <p className="bq-tutorial-eyebrow">{view.tutorialResults[myId] === 'skipped' ? 'TUTORIAL SKIPPED' : 'TUTORIAL COMPLETE'}</p>
        <h2>You’re ready!</h2>
        <p role="status">Waiting for {remaining.length} other {remaining.length === 1 ? 'reader' : 'readers'} to finish or skip. The game will start for everyone together.</p>
      </> : <>
        <Icon className="bq-tutorial-icon" size={44} />
        <p className="bq-tutorial-eyebrow">QUICK RULES · {step + 1} OF {STEPS.length}</p>
        <div className="bq-tutorial-progress" aria-hidden="true">{STEPS.map((_, index) => <i key={index} className={index <= step ? 'done' : ''} />)}</div>
        <h2>{card.title}</h2>
        <p>{card.text}</p>
        {step === 1 && <div className="bq-tutorial-example"><strong>Practice against Scissors</strong><div className="bq-tutorial-hands">{HANDS.map(hand => <button key={hand} onClick={() => { const winner = rpsWinner(hand as HandChoice, 'scissors'); setExample(winner === null ? 'Tie! Same hand.' : winner === 0 ? 'You win! Rock beats Scissors.' : 'Scissors beats Paper. Try Rock.'); }}>{hand}</button>)}</div><span role="status">{example}</span></div>}
        {step === 2 && <div className="bq-tutorial-example"><strong>Practice: What is 2 + 1?</strong><div className="bq-tutorial-hands">{[2, 3, 4].map(answer => <button key={answer} onClick={() => setExample(answer === 3 ? 'Correct! In the game, the dice would roll and your reader would move.' : 'That would be one strike. Try 3. You can still keep playing.')}>{answer}</button>)}</div><span role="status">{example}</span></div>}
        <div className="bq-tutorial-voice"><button disabled={!sound} onClick={hearRules}><Volume2 size={18} />Hear rules</button><span>{voiceState}</span></div>
        <div className="bq-tutorial-actions">
          <button disabled={busy || offline} className="bq-tutorial-skip" onClick={() => markReady('skipped')}>Skip tutorial</button>
          <button disabled={busy || offline} className="bq-tutorial-next" onClick={() => step === STEPS.length - 1 ? markReady('finished') : next()}>{busy ? 'Joining waiting room…' : step === STEPS.length - 1 ? 'Finish tutorial' : 'Next'}</button>
        </div>
        {step > 0 && <button className="bq-tutorial-back" onClick={() => { cancelRef.current?.(); setExample(''); setStep(index => index - 1); }}><RotateCcw size={14} />Previous rule</button>}
      </>}
      <ul className="bq-tutorial-roster" aria-label="Tutorial readiness">{humans.map(player => <li key={player.id}><span>{player.name}{player.id === myId ? ' (you)' : ''}</span><strong>{view.tutorialReady.includes(player.id) ? 'Ready' : 'Learning rules'}</strong></li>)}</ul>
      {error && <p role="alert" className="bq-error">{error}</p>}
      {offline && <p role="status" className="bq-error">Reconnecting… Your tutorial progress is kept here.</p>}
      <small>AI generated announcer voice. Computer players are ready automatically.</small>
    </div>
  </section>;
}
