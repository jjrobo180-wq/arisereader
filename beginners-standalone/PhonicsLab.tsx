import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Delete, Headphones, Lightbulb,
  Play, RotateCcw, Sparkles, Volume2
} from "lucide-react";
import {
  buildMatches, describeLetterChange, soundHint, tileChoices,
  type PhonicsActivity
} from "./phonics-curriculum";

export type PhonicsResult = {
  buildsCompleted: 3;
  correctOnFirstCheck: number;
  checks: number;
};
type Props = {
  activity: PhonicsActivity;
  onComplete: (result: PhonicsResult) => void;
  onExit: () => void;
};
function speak(text:string,rate=.74){
  if(!("speechSynthesis" in window))return false;
  window.speechSynthesis.cancel();
  const voice=new SpeechSynthesisUtterance(text);
  voice.lang="en-US";
  voice.rate=rate;
  window.speechSynthesis.speak(voice);
  return true;
}
export default function PhonicsLab({activity,onComplete,onExit}:Props){
  const [phase,setPhase]=useState<"teach"|"build"|"read">("teach");
  const [index,setIndex]=useState(0);
  const [chosen,setChosen]=useState<(string|null)[]>([]);
  const [wrongChecks,setWrongChecks]=useState(0);
  const [totalChecks,setTotalChecks]=useState(0);
  const [firstTries,setFirstTries]=useState(0);
  const [correct,setCorrect]=useState(false);
  const [showSpelling,setShowSpelling]=useState(false);
  const [message,setMessage]=useState("");
  const [audioNote,setAudioNote]=useState("");
  const words=activity.wordBuilds;
  const word=words[index];
  const tiles=useMemo(()=>tileChoices(word,words),[word,words]);
  const chosenTexts=word.parts.map((_,i)=>tiles.find(t=>t.id===chosen[i])?.text||"");
  const filledCount=chosen.filter(Boolean).length;
  const clue=word.parts.map(part=>soundHint(part,activity.unit));
  const primaryName=activity.unit===9?"SYLLABLES":activity.unit===10?"WORD PARTS":"SOUND SPELLINGS";
  useEffect(()=>{
    if("speechSynthesis" in window)window.speechSynthesis.cancel();
    return()=>{if("speechSynthesis" in window)window.speechSynthesis.cancel()};
  },[activity.lessonId,index]);
  function playWord(text:string){
    if(!speak(text))setAudioNote("Audio is unavailable in this browser. Use the sound clues or show the spelling hint.");
    else setAudioNote("");
  }
  function playPart(part:string){
    // Do not pretend that TTS pronounces isolated consonant phonemes accurately.
    // A spoken example word is a more honest, helpful approximation.
    const cue=soundHint(part,activity.unit);
    const example=cue.split("as in ")[1];
    // Whole example words are modeled, not misleading synthesized isolated consonants.
    playWord(example?example.replace(/\s*\(.*/, "").trim():word.word);
  }
  function addTile(id:string){
    if(correct||chosen.includes(id)||filledCount>=word.parts.length)return;
    setChosen(items=>{
      const next=word.parts.map((_,i)=>items[i]||null);
      const slot=next.findIndex(x=>!x);
      if(slot>=0)next[slot]=id;
      return next;
    });
    setMessage("");
  }
  function clearTile(i:number){
    if(correct)return;
    setChosen(ids=>word.parts.map((_,j)=>j===i?null:ids[j]||null));
    setMessage("");
  }
  function check(){
    if(correct||filledCount!==word.parts.length)return;
    setTotalChecks(n=>n+1);
    if(buildMatches(word,chosenTexts)){
      setCorrect(true);
      if(wrongChecks===0)setFirstTries(n=>n+1);
      setMessage("Yes! "+word.parts.join(" + ")+" = "+word.word+". Read the whole word out loud.");
      // Only whole-word audio; there is no unreliable isolated-phoneme playback.
      return;
    }
    setWrongChecks(n=>n+1);
    const mismatch=word.parts.findIndex((part,i)=>part!==chosenTexts[i]);
    const focus=word.parts[mismatch];
    setMessage("Not yet. Check box "+(mismatch+1)+". "+soundHint(focus,activity.unit)+". Try again.");
  }
  function next(){
    if(!correct)return;
    if(index===2){setPhase("read");setMessage("");return;}
    const upcoming=words[index+1];
    const sameLength=word.parts.length===upcoming.parts.length;
    const differences=sameLength?word.parts.filter((part,i)=>part!==upcoming.parts[i]).length:0;
    if(activity.unit<=8&&sameLength&&differences===1){
      // Keep every unchanged sound tile from the previous word. Only the
      // changed phoneme must be moved, so students actually chain words.
      setChosen(upcoming.parts.map((part,i)=>part===word.parts[i]?"target-"+i:null));
    }else setChosen([]);
    setIndex(i=>i+1);
    setWrongChecks(0);setCorrect(false);setShowSpelling(false);setMessage("");
  }
  return <section className="phonics-lab" aria-label={"Word-building laboratory: "+activity.title}>
    <div className="phonics-header">
      <span className="phonics-kicker"><Sparkles size={15}/> PHONICS FIRST · SOUND LAB</span>
      <div className="phonics-count"><span>{phase==="teach"?"MODEL":phase==="read"?"READ":"BUILD "+(index+1)+" / 3"}</span>
        <div className="phonics-mini-track">{[0,1,2].map(n=><i key={n} className={phase==="read"||n<index?"done":phase==="build"&&n===index?"current":""}/>)}</div>
      </div>
    </div>
    {phase==="teach"?<div className="phonics-teach">
      <div className="phonics-hero-mark">{words[0].parts[0]}<span>+</span>{words[0].parts[1]}</div>
      <h1>{activity.title}</h1>
      <p className="phonics-objective">{activity.objective}</p>
      <div className="phonics-model">
        <div className="phonics-box-eyebrow">I DO · WATCH AND LISTEN</div>
        <div className="phonics-model-word" aria-label={"Model word "+words[0].word}>
          {words[0].parts.map((part,i)=><span key={i}>{part}</span>)}
          <span className="phonics-equals">=</span><strong>{words[0].word}</strong>
        </div>
        <p>{activity.model}</p>
        <button type="button" className="phonics-voice-btn" onClick={()=>playWord(words[0].word)}>
          <Volume2 size={19}/> Hear “{words[0].word}”
        </button>
      </div>
      <div className="phonics-skill-note"><Lightbulb size={19}/><span>{activity.readingCue}</span></div>
      <button type="button" className="primary-btn phonics-main-button" onClick={()=>{setPhase("build");setMessage("");}}>
        Your Turn: Build Words <ArrowRight size={20}/>
      </button>
      <button type="button" className="phonics-quiet-exit" onClick={onExit}>Leave lesson</button>
    </div>:
    phase==="build"?<div className="phonics-build">
      <p className="phonics-step-label">YOU DO · WORD {index+1} OF 3</p>
      <h1>{index===0?"Build what you hear.":describeLetterChange(words[index-1],word)}</h1>
      <p className="phonics-build-description">{activity.unit>=9?"Put the larger word parts in the correct order.":activity.unit===4?"Notice regular sounds and any tricky spelling parts.":"Listen for each sound, then tap the letter tiles in order."}</p>
      {index>0&&<p className="phonics-from">Last word: <strong>{words[index-1].word}</strong></p>}
      <div className="phonics-listen-row">
        <button type="button" className="phonics-voice-btn" onClick={()=>playWord(word.word)}>
          <Volume2 size={21}/> Hear word {index+1}
        </button>
        <button type="button" className="phonics-clue-button" onClick={()=>setShowSpelling(x=>!x)}>
          <Lightbulb size={18}/> {showSpelling?"Hide spelling clue":"Show spelling clue"}
        </button>
      </div>
      {showSpelling&&<div className="phonics-spelling-hint">Word: <strong>{word.word}</strong> <small>(Support is allowed. Try building it yourself.)</small></div>}
      <div className="phonics-sound-ribbon"><div className="phonics-box-eyebrow">{primaryName} · TAP TO HEAR CUES</div>
        <div className="phonics-sound-grid">{clue.map((note,i)=><button type="button" key={i} className="phonics-sound-cue" onClick={()=>playPart(word.parts[i])} title={note} aria-label={"Sound clue "+(i+1)+": "+note}>
          <span>{note.split(" — ")[0]}</span><small><Volume2 size={13}/> {note.split(" — ")[1]||"listen"}</small>
        </button>)}</div>
        <p>These are printed sound clues. Audio models whole words and examples; it does not replace a teacher's phoneme modeling.</p>
      </div>
      <div className="phonics-work-mat">
        <div className="phonics-box-eyebrow">BUILD THE WORD · {word.parts.length} TILES</div>
        <div className="phonics-slots" role="group" aria-label="Word-building slots">
          {word.parts.map((_,i)=><button type="button" aria-label={"Word slot "+(i+1)+(chosenTexts[i]?", "+chosenTexts[i]:" empty")} key={i}
            disabled={!chosen[i]||correct}
            onClick={()=>clearTile(i)}
            className={"phonics-slot "+(chosen[i]?"filled ":"")+(correct?"correct":"")}>
              {chosenTexts[i]||<span className="phonics-slot-number">{i+1}</span>}
            </button>)}
        </div>
        <p className="phonics-instruction">{correct?"Great work! You mapped every sound-spelling part.":index>0&&filledCount>0?"The unchanged sounds stayed in place. Fill the open box or tap a tile to change it.":"Tap tiles below to fill the boxes. Tap a filled box to remove a tile."}</p>
        <div className="phonics-tiles" role="group" aria-label="Available letter and word-part tiles">
          {tiles.map(tile=><button type="button" key={tile.id} aria-label={"Add tile "+tile.text}
            disabled={correct||chosen.includes(tile.id)||filledCount>=word.parts.length}
            onClick={()=>addTile(tile.id)} className="phonics-tile">{tile.text}</button>)}
        </div>
        <div className="phonics-check-row">
          <button type="button" className="secondary-btn" disabled={correct||chosen.length===0}
            onClick={()=>{setChosen([]);setMessage("");}}><RotateCcw size={17}/> Clear</button>
          {!correct?<button type="button" className="primary-btn"
            disabled={filledCount!==word.parts.length} onClick={check}><Check size={17}/> Check Word</button>:
            <button type="button" className="primary-btn" onClick={next}>{index===2?"Practice Reading":"Next Word"} <ArrowRight size={17}/></button>}
        </div>
        {message&&<div role="status" aria-live="polite" className={"phonics-feedback "+(correct?"correct":"retry")}>
          {correct?<CheckCircle2 size={21}/>:<Lightbulb size={21}/>}<span>{message}</span>
        </div>}
        {correct&&<button type="button" className="phonics-voice-btn" onClick={()=>playWord(word.word)}><Headphones size={17}/> Hear the completed word</button>}
        {audioNote&&<p role="status" className="phonics-audio-note">{audioNote}</p>}
      </div>
    </div>:
    <div className="phonics-read">
      <div className="phonics-finish-symbol"><CheckCircle2 size={47}/></div>
      <div className="phonics-kicker">PHONICS PRACTICE COMPLETE</div>
      <h1>Now read what you built.</h1>
      <p className="phonics-objective">Look at the letter parts, read each word without help, and then listen to check your reading.</p>
      <div className="phonics-reading-strip">{words.map((w,i)=><button type="button" key={w.word} onClick={()=>playWord(w.word)}>
        <span className="phonics-strip-number">0{i+1}</span><strong>{w.word}</strong><Volume2 size={19}/></button>)}</div>
      <div className="phonics-skill-note"><Lightbulb size={18}/><span>{activity.readingCue}</span></div>
      <div className="phonics-read-result">
        <strong>{firstTries} of 3</strong>
        <span>built correctly on the first check · {totalChecks} total checks. You may use hints and retries.</span>
      </div>
      <button type="button" className="primary-btn phonics-main-button"
        onClick={()=>onComplete({buildsCompleted:3,correctOnFirstCheck:firstTries,checks:totalChecks})}>
        Continue to Supported Reading <ArrowRight size={18}/>
      </button>
    </div>}
  </section>;
}
