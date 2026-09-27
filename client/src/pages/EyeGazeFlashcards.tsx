import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronLeft, ChevronRight, Edit3, Plus, Save, Trash2, Volume2, X } from "lucide-react";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

type Card = { id: string; word: string; icon: string; phrase: string };
type Deck = { id: string; title: string; emoji: string; cards: Card[] };

const builtInDecks: Deck[] = [
  { id:"communication", title:"Communication", emoji:"💬", cards:[
    ["yes","Yes","👍","Yes."],["no","No","👎","No."],["help","Help","🤝","I need help."],["more","More","➕","I want more."],
    ["stop","Stop","✋","Stop, please."],["done","All done","✅","I am all done."],["break","Break","🧘","I need a break."],["bathroom","Bathroom","🚽","Bathroom, please."]
  ].map(([id,word,icon,phrase])=>({id,word,icon,phrase})) },
  { id:"feelings", title:"Feelings", emoji:"😊", cards:[
    ["happy","Happy","😊","I feel happy."],["sad","Sad","😢","I feel sad."],["mad","Mad","😠","I feel mad."],["scared","Scared","😨","I feel scared."],
    ["tired","Tired","🥱","I feel tired."],["calm","Calm","😌","I feel calm."],["excited","Excited","🤩","I feel excited."],["sick","Sick","🤒","I feel sick."]
  ].map(([id,word,icon,phrase])=>({id,word,icon,phrase})) },
  { id:"food", title:"Food & Drink", emoji:"🍎", cards:[
    ["milk","Milk","🥛","I want milk."],["water","Water","💧","I want water."],["apple","Apple","🍎","I want an apple."],["banana","Banana","🍌","I want a banana."],
    ["snack","Snack","🍪","I want a snack."],["breakfast","Breakfast","🥞","I want breakfast."],["lunch","Lunch","🥪","I want lunch."],["cup","Cup","🥤","This is my cup."]
  ].map(([id,word,icon,phrase])=>({id,word,icon,phrase})) },
  { id:"animals", title:"Animals", emoji:"🐶", cards:[
    ["dog","Dog","🐶","This is a dog."],["cat","Cat","🐱","This is a cat."],["lion","Lion","🦁","I see a lion."],["elephant","Elephant","🐘","I see an elephant."],
    ["monkey","Monkey","🐒","I see a monkey."],["giraffe","Giraffe","🦒","I see a giraffe."],["duck","Duck","🦆","This is a duck."],["cow","Cow","🐮","This is a cow."]
  ].map(([id,word,icon,phrase])=>({id,word,icon,phrase})) },
  { id:"people", title:"Family & People", emoji:"👨‍👩‍👧", cards:[
    ["mom","Mom","👩","This is Mom."],["dad","Dad","👨","This is Dad."],["grandma","Grandma","👵","This is Grandma."],["grandpa","Grandpa","👴","This is Grandpa."],
    ["teacher","Teacher","👩‍🏫","This is my teacher."],["friend","Friend","🧒","This is my friend."],["doctor","Doctor","🧑‍⚕️","This is a doctor."],["family","Family","👨‍👩‍👧","This is my family."]
  ].map(([id,word,icon,phrase])=>({id,word,icon,phrase})) },
  { id:"school", title:"School", emoji:"🎒", cards:[
    ["school","School","🏫","This is school."],["book","Book","📘","This is a book."],["pencil","Pencil","✏️","This is a pencil."],["backpack","Backpack","🎒","This is my backpack."],
    ["desk","Desk","🪑","This is my desk."],["lunch","Lunch","🥪","It is time for lunch."],["outside","Outside","🌳","I want to go outside."],["home","Home","🏠","I want to go home."]
  ].map(([id,word,icon,phrase])=>({id,word,icon,phrase})) },
  { id:"potty", title:"Potty Steps", emoji:"🚽", cards:[
    ["potty","Potty","🚽","It is potty time."],["pants","Pants down","👖","Pants down."],["sit","Sit","🪑","Sit on the potty."],["pee","Pee","💧","Pee goes in the potty."],
    ["poop","Poop","💩","Poop goes in the potty."],["wipe","Wipe","🧻","Wipe when you are done."],["flush","Flush","🚽","Flush the toilet."],["wash","Wash hands","🧼","Wash your hands."]
  ].map(([id,word,icon,phrase])=>({id,word,icon,phrase})) },
];

function cloneDefaults(): Deck[] {
  return builtInDecks.map(deck=>({...deck,cards:deck.cards.map(card=>({...card}))}));
}

function say(text:string){
  stopSpeaking();
  void speakCharacterAI(text,{calmMode:true,onFallback:()=>{
    if(!("speechSynthesis" in window)) return;
    const u=new SpeechSynthesisUtterance(text);
    u.rate=.82;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }});
}

const cacheKey="arise-eye-gaze-flashcard-decks";

export default function EyeGazeFlashcards(){
  const { token }=useAuth();
  const [,navigate]=useLocation();
  const [decks,setDecks]=useState<Deck[]>(cloneDefaults);
  const [deckId,setDeckId]=useState<string|null>(null);
  const [index,setIndex]=useState(0);
  const [editing,setEditing]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const stripRef=useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    let active=true;
    try{
      const cached=JSON.parse(localStorage.getItem(cacheKey)||"null");
      if(Array.isArray(cached)&&cached.length) setDecks(cached);
    }catch{}
    if(token){
      fetch(API_BASE+"/api/eye-gaze/flashcards",{headers:{Authorization:"Bearer "+token},cache:"no-store"})
        .then(async r=>r.ok?r.json():null)
        .then(data=>{if(active&&Array.isArray(data?.sets)&&data.sets.length){setDecks(data.sets);localStorage.setItem(cacheKey,JSON.stringify(data.sets));}})
        .catch(()=>{});
    }
    return()=>{active=false;stopSpeaking();};
  },[token]);

  const deck=decks.find(item=>item.id===deckId)||null;
  const cards=deck?.cards||[];
  const card=cards[index]||null;
  const progress=card?(index+1)+" / "+cards.length:"";

  useEffect(()=>{
    if(!card||editing) return;
    const timer=window.setTimeout(()=>say(card.word+". "+card.phrase),220);
    return()=>{window.clearTimeout(timer);stopSpeaking();};
  },[deckId,index,editing]);

  const persist=async(next:Deck[])=>{
    setDecks(next);
    localStorage.setItem(cacheKey,JSON.stringify(next));
    if(!token) return;
    setSaving(true);setMessage("");
    try{
      const r=await fetch(API_BASE+"/api/eye-gaze/flashcards",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({sets:next})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data.message||"Could not save flash cards.");
      setMessage("Saved!");
    }catch(error:any){setMessage(error.message||"Could not save flash cards.");}
    finally{setSaving(false);}
  };

  const go=(next:number)=>{
    if(!cards.length) return;
    const target=(next+cards.length)%cards.length;
    setIndex(target);
    const strip=stripRef.current;
    if(strip) strip.scrollTo({left:strip.clientWidth*target,behavior:"smooth"});
  };

  const onScroll=()=>{
    const strip=stripRef.current;
    if(!strip||!cards.length) return;
    const next=Math.max(0,Math.min(cards.length-1,Math.round(strip.scrollLeft/Math.max(1,strip.clientWidth))));
    if(next!==index) setIndex(next);
  };

  const updateDeck=(nextDeck:Deck)=>{
    const next=decks.map(item=>item.id===nextDeck.id?nextDeck:item);
    setDecks(next);
    localStorage.setItem(cacheKey,JSON.stringify(next));
  };

  const addDeck=()=>{
    const id="custom-"+Date.now();
    const next=[...decks,{id,title:"My Cards",emoji:"⭐",cards:[{id:"card-"+Date.now(),word:"My word",icon:"💬",phrase:"This is my word."}]}];
    setDecks(next);setDeckId(id);setIndex(0);setEditing(true);void persist(next);
  };

  const resetDefaults=()=>{
    const next=cloneDefaults();
    setDecks(next);setDeckId(null);setIndex(0);setEditing(false);void persist(next);
  };

  if(!deckId) return <main className="fixed inset-0 z-[130] h-[100dvh] overflow-y-auto bg-gradient-to-b from-sky-100 via-white to-violet-100 text-slate-950">
    <header className="sticky top-0 z-20 flex items-center gap-3 p-3 sm:p-4 bg-white/90 backdrop-blur border-b">
      <button onClick={()=>navigate("/eye-gaze-home")} className="min-h-14 rounded-2xl bg-[#ffd766] border-4 border-[#193d57] px-4 font-black flex items-center gap-2"><ArrowLeft className="w-5 h-5"/> BACK</button>
      <div className="flex-1 text-center"><div className="font-black text-xl sm:text-3xl">Flash Cards 🃏</div><div className="text-xs font-bold text-slate-500">Choose a set</div></div>
      <button onClick={addDeck} className="min-h-12 rounded-2xl bg-violet-600 text-white px-3 sm:px-4 font-black flex items-center gap-2"><Plus className="w-5 h-5"/><span className="hidden sm:inline">New set</span></button>
    </header>
    <section className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {decks.map(item=><button key={item.id} onClick={()=>{setDeckId(item.id);setIndex(0);setEditing(false);}} className="min-h-44 rounded-[2rem] bg-white border-4 border-slate-100 hover:border-sky-400 shadow-lg p-5 flex flex-col items-center justify-center text-center">
          <span className="text-6xl">{item.emoji}</span>
          <strong className="text-xl sm:text-2xl font-black mt-3">{item.title}</strong>
          <span className="text-sm font-bold text-slate-500 mt-1">{item.cards.length} cards</span>
        </button>)}
      </div>
      <div className="mt-6 rounded-3xl bg-white/80 border p-4 flex flex-wrap items-center gap-3">
        <p className="font-bold text-slate-600 flex-1">Grown-ups can edit any set, add cards, delete cards, or create a new set.</p>
        <button onClick={resetDefaults} className="min-h-12 rounded-2xl bg-slate-100 px-4 font-black">Restore starter sets</button>
      </div>
      {message&&<p className="mt-3 font-bold text-center text-slate-600">{message}</p>}
    </section>
  </main>;

  if(!deck) return null;

  if(editing) return <main className="fixed inset-0 z-[130] h-[100dvh] overflow-y-auto bg-slate-100 text-slate-950">
    <header className="sticky top-0 z-20 bg-white border-b p-3 sm:p-4 flex items-center gap-3">
      <button onClick={()=>{void persist(decks);setEditing(false);}} className="min-h-12 rounded-2xl bg-[#ffd766] border-4 border-[#193d57] px-4 font-black flex items-center gap-2"><X className="w-5 h-5"/> DONE</button>
      <div className="flex-1"><p className="text-xs font-black text-violet-600">GROWN-UP EDIT</p><h1 className="font-black text-xl sm:text-2xl">{deck.title}</h1></div>
      {saving&&<span className="text-sm font-black text-slate-500">Saving…</span>}
    </header>
    <section className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="rounded-3xl bg-white p-4 grid sm:grid-cols-[90px_1fr] gap-3">
        <label className="font-black">Emoji<input value={deck.emoji} onChange={e=>updateDeck({...deck,emoji:e.target.value.slice(0,8)})} className="mt-1 w-full min-h-12 rounded-xl border-2 px-3"/></label>
        <label className="font-black">Set name<input value={deck.title} onChange={e=>updateDeck({...deck,title:e.target.value.slice(0,50)})} className="mt-1 w-full min-h-12 rounded-xl border-2 px-3"/></label>
      </div>
      <div className="space-y-3">
        {deck.cards.map((item,cardIndex)=><div key={item.id} className="rounded-3xl bg-white p-4 grid sm:grid-cols-[80px_1fr_1.4fr_auto] gap-3 items-end">
          <label className="font-black text-sm">Picture<input value={item.icon} onChange={e=>{const next=[...deck.cards];next[cardIndex]={...item,icon:e.target.value.slice(0,12)};updateDeck({...deck,cards:next});}} className="mt-1 w-full min-h-12 rounded-xl border-2 px-2 text-2xl"/></label>
          <label className="font-black text-sm">Word<input value={item.word} onChange={e=>{const next=[...deck.cards];next[cardIndex]={...item,word:e.target.value.slice(0,40)};updateDeck({...deck,cards:next});}} className="mt-1 w-full min-h-12 rounded-xl border-2 px-3"/></label>
          <label className="font-black text-sm">Sentence<input value={item.phrase} onChange={e=>{const next=[...deck.cards];next[cardIndex]={...item,phrase:e.target.value.slice(0,100)};updateDeck({...deck,cards:next});}} className="mt-1 w-full min-h-12 rounded-xl border-2 px-3"/></label>
          <button aria-label={"Delete "+item.word} onClick={()=>updateDeck({...deck,cards:deck.cards.filter(card=>card.id!==item.id)})} className="min-h-12 w-12 rounded-xl bg-rose-50 text-rose-700 grid place-items-center"><Trash2 className="w-5 h-5"/></button>
        </div>)}
      </div>
      <button onClick={()=>updateDeck({...deck,cards:[...deck.cards,{id:"card-"+Date.now(),word:"New word",icon:"⭐",phrase:"This is a new word."}]})} className="w-full min-h-16 rounded-2xl bg-violet-600 text-white font-black text-lg flex items-center justify-center gap-2"><Plus/> Add a card</button>
      <button onClick={()=>void persist(decks)} className="w-full min-h-14 rounded-2xl bg-emerald-600 text-white font-black flex items-center justify-center gap-2"><Save/> Save now</button>
      {message&&<p className="font-bold text-center text-slate-600">{message}</p>}
    </section>
  </main>;

  return <main className="fixed inset-0 z-[130] h-[100dvh] overflow-hidden bg-gradient-to-b from-sky-100 via-white to-violet-100 text-slate-950 flex flex-col select-none">
    <header className="flex items-center gap-2 p-3 sm:p-4 flex-shrink-0">
      <button onClick={()=>{setDeckId(null);setIndex(0);stopSpeaking();}} className="min-h-14 rounded-2xl bg-[#ffd766] border-4 border-[#193d57] px-4 font-black flex items-center gap-2"><ArrowLeft className="w-5 h-5"/> SETS</button>
      <div className="flex-1 text-center"><div className="font-black text-lg sm:text-2xl">{deck.emoji} {deck.title}</div><div className="text-xs font-bold text-slate-500">{progress}</div></div>
      <button onClick={()=>setEditing(true)} className="min-h-12 rounded-2xl bg-white border-2 border-violet-200 px-3 font-black flex items-center gap-2"><Edit3 className="w-5 h-5"/><span className="hidden sm:inline">Edit</span></button>
      {card&&<button onClick={()=>say(card.word+". "+card.phrase)} className="w-12 h-12 rounded-2xl bg-white border-2 border-sky-200 grid place-items-center" aria-label="Hear card"><Volume2 className="w-6 h-6"/></button>}
    </header>

    <section ref={stripRef} onScroll={onScroll} className="flex-1 min-h-0 flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain scroll-smooth">
      {cards.map((item,i)=><article key={item.id} className="min-w-full h-full snap-center flex items-center justify-center px-3 sm:px-8 pb-3">
        <button type="button" onClick={()=>say(item.word+". "+item.phrase)} className={"w-full max-w-3xl h-full max-h-[720px] min-h-[340px] rounded-[2.5rem] bg-white border-4 shadow-2xl flex flex-col items-center justify-center p-6 touch-manipulation focus:outline-none focus:ring-8 transition "+(i===index?"border-sky-400 focus:ring-sky-200":"border-slate-200")}>
          <div className="text-[8rem] sm:text-[13rem] leading-none drop-shadow-sm" aria-hidden="true">{item.icon}</div>
          <h1 className="text-5xl sm:text-7xl font-black mt-5 text-blue-950">{item.word}</h1>
          <p className="text-xl sm:text-3xl font-black text-slate-600 mt-3 text-center">{item.phrase}</p>
          <p className="mt-6 rounded-full bg-sky-50 px-5 py-2 text-sm font-black text-sky-800">🔊 Tap to hear · Swipe for next</p>
        </button>
      </article>)}
      {!cards.length&&<div className="w-full grid place-items-center p-8"><div className="text-center"><div className="text-7xl">🃏</div><h2 className="text-3xl font-black mt-3">This set is empty</h2><button onClick={()=>setEditing(true)} className="mt-4 min-h-14 rounded-2xl bg-violet-600 text-white px-5 font-black">Add a card</button></div></div>}
    </section>

    {!!cards.length&&<nav className="grid grid-cols-2 gap-3 p-3 sm:p-4 flex-shrink-0">
      <button onClick={()=>go(index-1)} className="min-h-16 rounded-2xl bg-white border-2 border-slate-200 text-xl font-black flex items-center justify-center gap-2"><ChevronLeft/> Back</button>
      <button onClick={()=>go(index+1)} className="min-h-16 rounded-2xl bg-blue-600 text-white text-xl font-black flex items-center justify-center gap-2">Next <ChevronRight/></button>
    </nav>}
  </main>;
}
