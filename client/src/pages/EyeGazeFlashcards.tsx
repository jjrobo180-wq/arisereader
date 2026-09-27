import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronLeft, ChevronRight, Volume2 } from "lucide-react";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";

const CARDS = [
  { word:"Mom", icon:"👩", phrase:"This is Mom." }, { word:"Dad", icon:"👨", phrase:"This is Dad." },
  { word:"Happy", icon:"😊", phrase:"I feel happy." }, { word:"Sad", icon:"😢", phrase:"I feel sad." },
  { word:"Milk", icon:"🥛", phrase:"I want milk." }, { word:"Water", icon:"💧", phrase:"I want water." },
  { word:"Apple", icon:"🍎", phrase:"This is an apple." }, { word:"Dog", icon:"🐶", phrase:"This is a dog." },
  { word:"Cat", icon:"🐱", phrase:"This is a cat." }, { word:"Book", icon:"📘", phrase:"This is a book." },
  { word:"Ball", icon:"⚽", phrase:"This is a ball." }, { word:"Home", icon:"🏠", phrase:"This is home." },
  { word:"School", icon:"🏫", phrase:"This is school." }, { word:"Help", icon:"🙋", phrase:"I need help." },
  { word:"More", icon:"➕", phrase:"I want more." }, { word:"All done", icon:"✅", phrase:"I am all done." },
];

function say(text:string){ stopSpeaking(); void speakCharacterAI(text,{calmMode:true,onFallback:()=>{ if(!("speechSynthesis" in window))return; const u=new SpeechSynthesisUtterance(text);u.rate=.82;window.speechSynthesis.cancel();window.speechSynthesis.speak(u); }}); }

export default function EyeGazeFlashcards(){
  const [,navigate]=useLocation();
  const [index,setIndex]=useState(0);
  const card=CARDS[index];
  const progress=useMemo(()=>`${index+1} / ${CARDS.length}`,[index]);
  useEffect(()=>{ const timer=window.setTimeout(()=>say(`${card.word}. ${card.phrase}`),180); return()=>{window.clearTimeout(timer);stopSpeaking();}; },[index]);
  const move=(direction:number)=>setIndex(i=>(i+direction+CARDS.length)%CARDS.length);
  return <main className="fixed inset-0 z-[120] h-[100dvh] overflow-hidden bg-gradient-to-b from-sky-100 via-white to-violet-100 text-slate-950 flex flex-col select-none">
    <header className="flex items-center gap-3 p-3 sm:p-4 flex-shrink-0">
      <button onClick={()=>navigate("/eye-gaze-home")} className="min-h-12 rounded-2xl bg-white border-2 border-slate-200 px-4 font-black flex items-center gap-2"><ArrowLeft className="w-5 h-5"/> Home</button>
      <div className="flex-1 text-center"><div className="font-black text-lg sm:text-2xl">Flash Cards 🃏</div><div className="text-xs font-bold text-slate-500">{progress}</div></div>
      <button onClick={()=>say(`${card.word}. ${card.phrase}`)} className="w-12 h-12 rounded-2xl bg-white border-2 border-sky-200 grid place-items-center" aria-label="Hear card"><Volume2 className="w-6 h-6"/></button>
    </header>
    <section className="flex-1 min-h-0 flex items-center justify-center px-3 sm:px-8">
      <button type="button" onClick={()=>say(`${card.word}. ${card.phrase}`)} className="w-full max-w-3xl h-[72dvh] max-h-[720px] min-h-[360px] rounded-[2.5rem] bg-white border-4 border-sky-300 shadow-2xl flex flex-col items-center justify-center p-6 touch-manipulation focus:outline-none focus:ring-8 focus:ring-sky-200">
        <div className="text-[9rem] sm:text-[13rem] leading-none drop-shadow-sm" aria-hidden="true">{card.icon}</div>
        <h1 className="text-5xl sm:text-7xl font-black mt-5 text-blue-950">{card.word}</h1>
        <p className="text-xl sm:text-3xl font-black text-slate-600 mt-3 text-center">{card.phrase}</p>
        <p className="mt-6 rounded-full bg-sky-50 px-5 py-2 text-sm font-black text-sky-800">🔊 Tap card to hear it</p>
      </button>
    </section>
    <nav className="grid grid-cols-2 gap-3 p-3 sm:p-4 flex-shrink-0">
      <button onClick={()=>move(-1)} className="min-h-16 rounded-2xl bg-white border-2 border-slate-200 text-xl font-black flex items-center justify-center gap-2"><ChevronLeft/> Back</button>
      <button onClick={()=>move(1)} className="min-h-16 rounded-2xl bg-blue-600 text-white text-xl font-black flex items-center justify-center gap-2">Next <ChevronRight/></button>
    </nav>
  </main>;
}
