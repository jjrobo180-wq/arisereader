import { useMemo, useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import ARISEAvatar3D from "@/components/ARISEAvatar3D";
import WorldModelPreview from "@/components/WorldModelPreview";
import { PET_PERSONALITIES } from "@/lib/pets";
import { AVATAR_CHARACTERS, getAvatarCharacter } from "@/lib/avatarCharacters";
import { ArrowLeft, Car, Check, Coins, Home, Lock, ShoppingBag, UserRound, X } from "lucide-react";

type CatalogItem={id:string;type:string;name:string;price:number;rarity:string};
type Payload={
  economy:{level:number;quizzesTaken:number;passedQuizzes:number;totalPoints:number;lifetimeCoins:number;wallet:number;nextLevelAt:number|null;coinsPerPassedQuiz:number;coinsPerGame:number;winBonusCoins:number;levelBonus:number;clubGames:number;clubWins:number};
  state:{purchased:string[];selectedCharacter:string;equipped:Record<string,string>;furniture:string[];petCare:Record<string,{happiness:number;lastUpdatedAt:number;lastFedAt:number;lastTreatAt:number;lastWalkAt:number}>;runawayPets:string[];lastRunaway:null|{petId:string;ranAwayAt:number};careSpent:number;spent:number};
  catalog:CatalogItem[];
};
type Tab="character"|"shop"|"garage";

const FREE_ITEMS:CatalogItem[]=[
  {id:"car-none",type:"car",name:"No Car",price:0,rarity:"starter"},
  {id:"home-basic",type:"home",name:"Starter Room",price:0,rarity:"starter"},
  {id:"pet-none",type:"pet",name:"No Pet",price:0,rarity:"starter"},
];

const rarityClass:Record<string,string>={
  starter:"from-slate-500 to-slate-700 border-slate-400",
  common:"from-slate-600 to-zinc-800 border-slate-400",
  rare:"from-sky-500 to-blue-800 border-sky-300",
  epic:"from-violet-500 to-fuchsia-800 border-violet-300",
  legendary:"from-amber-400 to-orange-700 border-amber-200",
};

export default function AvatarWorld({initialTab="character"}:{initialTab?:Tab}){
  const {user,token}=useAuth();
  const [,navigate]=useLocation();
  const [payload,setPayload]=useState<Payload|null>(null);
  const [tab,setTab]=useState<Tab>(initialTab);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");
  const [shopFilter,setShopFilter]=useState("all");
  const [entering,setEntering]=useState(false);
  const [inCar,setInCar]=useState(false);
  const [previewCharacterId,setPreviewCharacterId]=useState<string|null>(null);
  const [pendingPurchase,setPendingPurchase]=useState<CatalogItem|null>(null);
  const [previewProduct,setPreviewProduct]=useState<CatalogItem|null>(null);
  const [pendingCare,setPendingCare]=useState<{petId:string;action:"feed"|"treat"|"walk"|"play"}|null>(null);
  const previewRef=useRef<HTMLDivElement|null>(null);
  const petSectionRef=useRef<HTMLElement|null>(null);

  const load=async()=>{
    if(!token)return;
    setLoading(true);
    try{
      const r=await fetch(API_BASE+"/api/avatar-world",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not load Avatar World.");
      setPayload(d);
    }catch(error:any){setMessage(error.message||"Could not load Avatar World.");}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[token]);
  useEffect(()=>{if(previewCharacterId&&tab==="character")requestAnimationFrame(()=>previewRef.current?.scrollIntoView({behavior:"smooth",block:"start"}));},[previewCharacterId,tab]);

  const customize=async(body:any)=>{
    if(!token)return;
    setBusy("customize");setMessage("");
    try{
      const r=await fetch(API_BASE+"/api/avatar-world/customize",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not save.");
      setPayload(d);
    }catch(error:any){setMessage(error.message||"Could not save.");}
    finally{setBusy("");}
  };

  const purchase=async(product:CatalogItem)=>{
    if(!token)return;
    setPendingPurchase(null);
    setBusy(product.id);setMessage("");
    try{
      const r=await fetch(API_BASE+"/api/avatar-world/purchase",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({itemId:product.id})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not unlock that.");
      setPayload(d);setMessage("Unlocked "+product.name+"!");
    }catch(error:any){setMessage(error.message||"Could not unlock that.");}
    finally{setBusy("");}
  };

  const careForPet=async(petId:string,action:"feed"|"treat"|"walk"|"play")=>{
    if(!token)return;
    setPendingCare(null);setBusy("care");setMessage("");
    try{
      const r=await fetch(API_BASE+"/api/avatar-world/pet-care",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({petId,action})});
      const d=await r.json();if(!r.ok)throw new Error(d.message||"Could not care for your pet.");
      setPayload(d);setMessage(action==="feed"?"Your pet loved the food!":action==="treat"?"Treat time!":action==="walk"?"That walk made your dog happier!":"Play time made your pet happier!");
    }catch(error:any){setMessage(error.message||"Could not care for your pet.");}
    finally{setBusy("");}
  };

  const allItems=useMemo(()=>[...FREE_ITEMS,...(payload?.catalog||[])],[payload]);
  const owned=(id:string)=>FREE_ITEMS.some(x=>x.id===id)||!!payload?.state.purchased.includes(id);
  const getItem=(id:string)=>allItems.find(x=>x.id===id);
  const shopItems=(payload?.catalog||[]).filter(x=>["car","home","furniture","pet","character"].includes(x.type)&&(shopFilter==="all"||x.type===shopFilter));

  if(loading)return <main className="min-h-screen bg-slate-950 text-white grid place-items-center"><div className="text-center"><div className="w-14 h-14 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"/><p className="font-black mt-4">Loading Avatar World…</p></div></main>;
  if(!payload)return <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-6"><div className="text-center"><p className="text-xl font-black">{message||"Avatar World is unavailable."}</p><button onClick={()=>navigate("/library")} className="mt-4 rounded-2xl bg-white text-slate-950 px-5 py-3 font-black">Back to Library</button></div></main>;

  const carId=payload.state.equipped.car||"car-none";
  const petId=payload.state.equipped.pet||"pet-none";
  const quizzesIntoLevel=payload.economy.passedQuizzes%2;
  const starterCharacters=new Set(["robin-hood","sherlock-holmes","sinbad","alice"]);
  const characterUnlockId=(id:string)=>"unlock-"+id;
  const characterOwned=(id:string)=>starterCharacters.has(id)||payload.state.purchased.includes(characterUnlockId(id));
  const previewId=previewCharacterId||payload.state.selectedCharacter;
  const previewOwned=characterOwned(previewId);
  const previewUnlockItem=payload.catalog.find(x=>x.id===characterUnlockId(previewId));

  const equip=(slot:string,itemId:string)=>customize({action:"equip",slot,itemId});
  const selectCharacter=(characterId:string)=>customize({action:"character",characterId});
  const showPets=()=>{setTab("character");requestAnimationFrame(()=>requestAnimationFrame(()=>petSectionRef.current?.scrollIntoView({behavior:"smooth",block:"start"})));};

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554,#0f172a_50%,#020617)] text-white">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-3 flex items-center gap-3">
        <button onClick={()=>navigate("/library")} className="min-h-12 rounded-2xl bg-white/10 border border-white/15 px-3 font-black flex items-center gap-2"><ArrowLeft className="w-5 h-5"/> Library</button>
        <div className="flex-1 min-w-0"><p className="text-[10px] font-black tracking-[.28em] text-cyan-300">A.R.I.S.E.</p><h1 className="text-lg sm:text-2xl font-black truncate">Avatar World</h1></div>
        <div className="rounded-2xl bg-amber-400/10 border border-amber-300/30 px-3 py-2 text-center"><div className="text-[10px] font-black text-amber-200">COINS</div><div className="font-black text-amber-300">{payload.economy.wallet.toLocaleString()}</div></div>
        <div className="rounded-2xl bg-violet-500/10 border border-violet-300/30 px-3 py-2 text-center"><div className="text-[10px] font-black text-violet-200">LEVEL</div><div className="font-black text-xl">{payload.economy.level}</div></div>
      </div>
    </header>

    <section className="max-w-7xl mx-auto px-3 sm:px-5 pt-3 sm:pt-5">
      <div className="rounded-[1.5rem] sm:rounded-[2rem] border border-cyan-300/20 bg-gradient-to-r from-cyan-400/10 via-violet-500/10 to-fuchsia-500/10 p-3 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-black tracking-widest text-cyan-300">YOUR CHARACTER. YOUR READING PROGRESS.</p>
            <h2 className="text-xl sm:text-3xl font-black mt-1">{user?.displayName||"Reader"}, build your world.</h2>
            <p className="text-white/65 font-bold mt-1">Pass a book quiz: <span className="text-amber-300">+100 coins</span>. Finish a Club game: <span className="text-amber-300">+10</span>. Win: <span className="text-amber-300">+20 bonus</span>. Coins are separate from leaderboard points.</p>
          </div>
          <div className="min-w-[260px]">
            <div className="flex justify-between text-xs font-black mb-1"><span>{payload.economy.passedQuizzes} passed quizzes · {payload.economy.clubGames} Club games</span><span>{payload.economy.nextLevelAt?payload.economy.nextLevelAt+" passes for Level "+(payload.economy.level+1):"MAX LEVEL"}</span></div>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500" style={{width:payload.economy.nextLevelAt?(quizzesIntoLevel/2)*100+"%":"100%"}}/></div>
          </div>
        </div>
      </div>

      <nav className="mt-3 grid grid-cols-4 gap-1.5 rounded-2xl bg-white/5 border border-white/10 p-1.5">
        {([
          ["character",UserRound,"Character"],["shop",ShoppingBag,"Shop"],["garage",Car,"Garage"]
        ] as const).map(([id,Icon,label])=><button key={id} onClick={()=>setTab(id)} className={"min-h-12 sm:min-h-14 rounded-xl font-black text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 "+(tab===id?"bg-white text-slate-950 shadow-lg":"text-white/70 hover:bg-white/10")}><Icon className="w-5 h-5"/>{label}</button>)}
        <button onClick={()=>navigate("/my-home")} className="min-h-12 sm:min-h-14 rounded-xl font-black text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-white/70 hover:bg-white/10"><Home className="w-5 h-5"/>Home</button>
      </nav>
      {message&&<div className="mt-3 rounded-2xl bg-white/10 border border-white/15 p-3 text-center font-black flex items-center justify-center gap-2">{message}<button onClick={()=>setMessage("")}><X className="w-4 h-4"/></button></div>}
    </section>

    {tab==="character"&&<section className="max-w-7xl mx-auto p-3 sm:p-5 pt-3">
      <div className="grid xl:grid-cols-[minmax(0,1.08fr)_minmax(380px,.92fr)] gap-5 items-start">
        <div ref={previewRef} className="scroll-mt-24 rounded-[2rem] overflow-hidden border border-white/10 bg-slate-950 shadow-2xl">
          <div className="px-5 pt-5 pb-3 border-b border-white/10 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] sm:text-xs font-black tracking-widest text-cyan-300">MY CHARACTER</p>
              <h2 className="text-xl sm:text-2xl font-black mt-1">{getAvatarCharacter(previewId).name}</h2>
              <p className="text-xs font-bold text-white/45 mt-1">{getAvatarCharacter(previewId).subtitle}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black tracking-widest text-white/75">{previewId===payload.state.selectedCharacter?"YOUR CHARACTER":"PREVIEW"}</span>
          </div>
          <div className="h-[430px] sm:h-[520px] lg:h-[580px] bg-[radial-gradient(circle_at_50%_30%,rgba(20,184,166,.18),transparent_38%)]">
            <ARISEAvatar3D characterId={previewId} equipped={payload.state.equipped} className="w-full h-full" initialView="full" emotes/>
          </div>
          {previewId!==payload.state.selectedCharacter&&<div className="flex flex-wrap items-center gap-2 border-t border-white/10 p-3 sm:p-4">
            {previewOwned?<button type="button" onClick={()=>void selectCharacter(previewId)} disabled={busy==="customize"} className="min-h-12 flex-1 rounded-xl bg-cyan-300 px-4 font-black text-slate-950 disabled:opacity-50">Use {getAvatarCharacter(previewId).name}</button>
              :previewUnlockItem?<button type="button" onClick={()=>setPendingPurchase(previewUnlockItem)} disabled={payload.economy.wallet<previewUnlockItem.price||!!busy} className="min-h-12 flex-1 rounded-xl bg-amber-400 px-4 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45">Unlock for {previewUnlockItem.price} coins</button>:null}
            <button type="button" onClick={()=>setPreviewCharacterId(null)} className="min-h-12 rounded-xl bg-white/10 px-4 font-black">Back to mine</button>
            {!previewOwned&&previewUnlockItem&&payload.economy.wallet<previewUnlockItem.price&&<p className="w-full text-sm font-semibold text-amber-300">Earn {(previewUnlockItem.price-payload.economy.wallet).toLocaleString()} more coins to unlock this character. You can keep previewing it.</p>}
          </div>}
        </div>

        <div className="space-y-4">
          <section className="rounded-[2rem] bg-white/5 border border-white/10 p-4 sm:p-5">
            <h3 className="text-xl font-black">Choose your character</h3>
            <p className="text-sm text-white/55 font-bold mt-1">Tap any character to preview it, even if it is locked. Use Reader Coins to unlock the ones you want.</p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {AVATAR_CHARACTERS.map(character=>{
                const active=previewId===character.id;
                const selected=payload.state.selectedCharacter===character.id;
                const unlocked=characterOwned(character.id);
                const unlockItem=payload.catalog.find(x=>x.id===characterUnlockId(character.id));
                return <button
                  key={character.id}
                  onClick={()=>setPreviewCharacterId(character.id)}
                  className={"rounded-2xl border p-3 text-left transition-all "+(active?"bg-cyan-300 text-slate-950 border-cyan-200 shadow-lg":unlocked?"bg-white/5 border-white/10 hover:bg-white/10":"bg-black/25 border-amber-300/25 hover:bg-amber-300/10")}
                >
                  <div className="flex items-center gap-3">
                    <div className={"w-11 h-11 rounded-xl grid place-items-center text-2xl "+(active?"bg-slate-950/10":"bg-black/20")}>{character.icon}</div>
                    <div className="min-w-0 flex-1">
                      <strong className="block text-sm sm:text-base leading-tight">{character.name}</strong>
                      <span className={"block text-[10px] sm:text-xs font-bold mt-1 "+(active?"text-slate-700":"text-white/45")}>{character.subtitle}</span>
                    </div>
                    {!unlocked&&unlockItem&&<span className={"text-xs font-black "+(active?"text-slate-900":"text-amber-300")}>{unlockItem.price} 🪙</span>}
                  </div>
                  {selected?<div className="mt-2 flex items-center gap-1 text-xs font-black"><Check className="w-4 h-4"/> USING NOW</div>:unlocked?<div className={"mt-2 text-[10px] font-black "+(active?"text-slate-800":"text-emerald-300")}>OWNED · TAP TO PREVIEW</div>:<div className={"mt-2 flex items-center gap-1 text-[10px] font-black "+(active?"text-slate-800":"text-amber-300")}><Lock className="w-3 h-3"/> TAP TO PREVIEW</div>}
                </button>;
              })}
            </div>
          </section>

          <section className="rounded-[2rem] bg-white/5 border border-white/10 p-4 sm:p-5">
            <h3 className="text-xl font-black">Fixed character system</h3>
            <p className="text-sm text-white/55 font-bold mt-1">Characters work like complete game skins: pick the character you want, and that character always keeps the same face, hair, body, outfit, and look.</p>
            <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
              <p className="text-sm font-black text-cyan-200">Complete character skins</p>
              <p className="text-xs font-bold text-white/55 mt-1">Each character keeps a consistent look. Reader Coins unlock additional complete characters instead of mismatched wearable pieces.</p>
            </div>
          </section>
          <section ref={petSectionRef} className="scroll-mt-28 rounded-[2rem] bg-white/5 border border-white/10 p-4 sm:p-5">
            <h3 className="text-xl font-black">My Club Pet</h3>
            <p className="text-sm text-white/65 font-bold mt-1">Your pet stays with you through A.R.I.S.E. worlds and games until you turn it off. Happiness keeps dropping with real time even when you are offline or the pet is resting. Keep it happy with food, treats, walks, and play. If happiness reaches 0%, the pet runs away and must be adopted again.</p>
            <div className="mt-3 grid sm:grid-cols-2 gap-2">
              {payload.catalog.filter(x=>x.type==="pet"&&owned(x.id)).map(pet=>{
                const personality=PET_PERSONALITIES[pet.id];
                const happiness=Math.max(0,Math.min(100,Math.round(payload.state.petCare[pet.id]?.happiness??90)));
                const mood=happiness>=85?"Thrilled 🤩":happiness>=65?"Happy 😊":happiness>=40?"Okay 🙂":happiness>=20?"Needs care 🥺":"Very unhappy 😢";
                const isDog=pet.id==="pet-dog";
                return <div key={pet.id} className={"rounded-2xl border p-3 "+(petId===pet.id?"border-cyan-300 bg-cyan-300/10":"border-white/10 bg-white/5")}>
                  <div className="font-black text-lg">{personality?.emoji} {pet.name}</div>
                  <p className="text-sm text-cyan-200 font-bold">{personality?.trait}</p>
                  <p className="text-xs text-white/65 mt-1">“{personality?.greeting}” · Loves {personality?.favorite.toLowerCase()}.</p>
                  <div className="mt-3 flex items-center justify-between text-xs font-black"><span>Happiness</span><span>{happiness}% · {mood}</span></div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{width:happiness+"%"}}/></div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button onClick={()=>setPendingCare({petId:pet.id,action:"feed"})} disabled={!!busy||payload.economy.wallet<30} className="min-h-11 rounded-xl bg-amber-400 px-2 text-xs font-black text-slate-950 disabled:opacity-40">Food · 30 🪙<span className="block opacity-70">+30 happy</span></button>
                    <button onClick={()=>setPendingCare({petId:pet.id,action:"treat"})} disabled={!!busy||payload.economy.wallet<10} className="min-h-11 rounded-xl bg-pink-300 px-2 text-xs font-black text-slate-950 disabled:opacity-40">Treat · 10 🪙<span className="block opacity-70">+12 happy</span></button>
                    <button onClick={()=>setPendingCare({petId:pet.id,action:isDog?"walk":"play"})} disabled={!!busy} className="min-h-11 rounded-xl bg-emerald-300 px-2 text-xs font-black text-slate-950 disabled:opacity-40">{isDog?"Walk dog":"Play"} · Free<span className="block opacity-70">+22 happy</span></button>
                    <button onClick={()=>equip("pet",petId===pet.id?"pet-none":pet.id)} disabled={!!busy} className="min-h-11 rounded-xl bg-cyan-300 px-2 text-xs font-black text-slate-950 disabled:opacity-40">{petId===pet.id?"Let pet rest":"Follow me"}</button>
                  </div>
                </div>;
              })}
              {!payload.catalog.some(x=>x.type==="pet"&&owned(x.id))&&<p className="text-sm text-white/60">{payload.state.runawayPets?.length?"Your pet ran away after its happiness reached 0. Visit the Pet Store to adopt it again.":"Unlock an animal to meet your first companion."}</p>}
            </div>
            <button onClick={()=>{setTab("shop");setShopFilter("pet");}} className="mt-3 min-h-12 w-full rounded-xl bg-amber-400 font-black text-slate-950">VISIT THE PET STORE</button>
          </section>
        </div>
      </div>
    </section>}

    {tab==="shop"&&<section className="max-w-7xl mx-auto p-3 sm:p-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1"><p className="text-xs font-black tracking-widest text-amber-300">EARNED — NEVER BOUGHT WITH REAL MONEY</p><h2 className="text-3xl font-black">World Shop</h2><p className="text-white/60 font-bold mt-1">Spend Reader Coins on characters, pets, cars, homes, and world items. Pets follow you into A.R.I.S.E Arcade.</p></div>
        <div className="rounded-2xl bg-amber-400 text-slate-950 px-4 py-3 font-black flex items-center gap-2"><Coins className="w-5 h-5"/>{payload.economy.wallet.toLocaleString()} coins</div>
      </div>
      <div className="flex gap-2 overflow-x-auto mt-4 pb-2">{["all","character","pet","car","home","furniture"].map(filter=><button key={filter} onClick={()=>setShopFilter(filter)} className={"min-w-max rounded-full px-4 py-2 font-black capitalize "+(shopFilter===filter?"bg-white text-slate-950":"bg-white/10 text-white/70")}>{filter}</button>)}</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
        {shopItems.map(product=>{
          const isOwned=owned(product.id),canAfford=payload.economy.wallet>=product.price;
          const ranAway=product.type==="pet"&&payload.state.runawayPets?.includes(product.id);
          const icon=product.type==="pet"?PET_PERSONALITIES[product.id]?.emoji:product.type==="car"?"🚗":product.type==="home"?"🏠":product.type==="character"?"🧍":"🛋️";
          return <article key={product.id} className={"rounded-[2rem] overflow-hidden border-2 bg-gradient-to-br "+(rarityClass[product.rarity]||rarityClass.common)}>
            <div className="h-44 grid place-items-center bg-black/25 relative"><div className="text-7xl">{icon}</div><span className="absolute top-3 right-3 rounded-full bg-black/60 px-3 py-1 text-[10px] font-black uppercase">{product.rarity}</span>{product.type==="character"?<button type="button" onClick={()=>{setPreviewCharacterId(product.id.replace(/^unlock-/,""));setTab("character");}} className="absolute bottom-2 left-2 right-2 min-h-10 rounded-xl bg-white/90 px-3 text-sm font-black text-slate-950">Preview character</button>:["pet","car","home"].includes(product.type)&&<button type="button" onClick={()=>setPreviewProduct(product)} className="absolute bottom-2 left-2 right-2 min-h-10 rounded-xl bg-white/90 px-3 text-sm font-black text-slate-950">Preview in 3D</button>}</div>
            <div className="p-4 bg-slate-950/85"><h3 className="text-lg font-black">{product.name}</h3><p className="text-xs font-black text-white/45 uppercase">{product.type}</p>
              {product.type==="pet"&&<p className="mt-2 text-xs text-white/70"><strong className="text-cyan-200">{PET_PERSONALITIES[product.id]?.trait}.</strong> {PET_PERSONALITIES[product.id]?.greeting} · Loves {PET_PERSONALITIES[product.id]?.favorite.toLowerCase()}. Happiness keeps dropping even while offline. At 0%, the pet runs away.</p>}
              {ranAway&&<p className="mt-2 rounded-xl bg-rose-500/15 p-2 text-xs font-black text-rose-200">This pet ran away. Adopt it again to bring it home.</p>}
              {product.type==="pet"&&isOwned
                ?<button onClick={showPets} className="mt-4 w-full min-h-12 rounded-xl bg-emerald-500/20 font-black text-emerald-300">CARE FOR PET</button>
                :<button disabled={isOwned||!canAfford||!!busy} onClick={()=>setPendingPurchase(product)} className={"mt-4 w-full min-h-12 rounded-xl font-black flex items-center justify-center gap-2 "+(isOwned?"bg-emerald-500/20 text-emerald-300":canAfford?"bg-amber-400 text-slate-950":"bg-white/10 text-white/40")}>{isOwned?<><Check className="w-5 h-5"/>OWNED</>:canAfford?<><Coins className="w-5 h-5"/>{product.price} · {ranAway?"ADOPT AGAIN":"UNLOCK"}</>:<><Lock className="w-5 h-5"/>{product.price}</>}</button>}
            </div>
          </article>;
        })}
      </div>
    </section>}

    {tab==="garage"&&<section className="max-w-7xl mx-auto p-3 sm:p-5">
      <div className="grid lg:grid-cols-[1fr_360px] gap-5">
        <div className="min-h-[680px] rounded-[2.5rem] overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_50%_40%,#1e3a8a_0,#0f172a_45%,#020617_100%)] relative">
          <div className="absolute inset-x-0 bottom-0 h-[34%] bg-[linear-gradient(#334155,#111827)] opacity-85"/>
          <div className="absolute top-5 left-5 z-20"><p className="text-xs font-black text-cyan-300">MY GARAGE</p><h2 className="text-3xl font-black">{getItem(carId)?.name||"No car equipped"}</h2></div>
          {carId==="car-none"?<div className="absolute inset-0 grid place-items-center"><div className="text-center"><div className="text-8xl">🏁</div><h3 className="text-2xl font-black mt-3">Your garage is empty.</h3><button onClick={()=>{setTab("shop");setShopFilter("car");}} className="mt-4 rounded-2xl bg-amber-400 text-slate-950 px-5 py-3 font-black">Shop Cars</button></div></div>:<>
            <WorldModelPreview id={carId} className="absolute inset-x-0 top-[12%] h-[52%] z-10"/>
            <div className={"absolute left-[4%] bottom-[1%] w-[290px] h-[430px] z-10 transition-all duration-1000 "+(entering?"translate-x-[360px] scale-[.55] opacity-25":"")}><ARISEAvatar3D characterId={payload.state.selectedCharacter} equipped={payload.state.equipped} compact className="w-full h-full rounded-3xl overflow-hidden"/></div>
            {inCar&&<div className="absolute inset-x-0 bottom-[8%] z-20 flex justify-center"><div className="rounded-3xl bg-black/65 backdrop-blur px-6 py-4 text-center border border-cyan-300/20"><h3 className="text-xl font-black">Your character is in the car.</h3><p className="text-white/55 text-sm font-bold">Drag the model above to look around.</p></div></div>}
            <div className="absolute right-5 bottom-5 z-30 flex gap-2">{!inCar?<button disabled={entering} onClick={()=>{setEntering(true);window.setTimeout(()=>setInCar(true),1000);}} className="min-h-14 rounded-2xl bg-cyan-300 text-slate-950 px-5 font-black">{entering?"GETTING IN…":"GET IN CAR"}</button>:<button onClick={()=>{setInCar(false);setEntering(false);}} className="min-h-14 rounded-2xl bg-white text-slate-950 px-5 font-black">GET OUT</button>}<button onClick={()=>navigate("/club-arise")} className="min-h-14 rounded-2xl bg-amber-400 px-4 font-black text-slate-950">Explore Club Arise</button></div>
          </>}
        </div>
        <aside className="space-y-3"><h3 className="text-xl font-black">My Cars</h3>{allItems.filter(x=>x.type==="car"&&owned(x.id)).map(car=><button key={car.id} onClick={()=>equip("car",car.id)} className={"w-full rounded-2xl border p-4 text-left "+(carId===car.id?"bg-cyan-400 text-slate-950 border-cyan-200":"bg-white/5 border-white/10")}><strong className="block">{car.name}</strong><span className="text-xs font-black opacity-60 uppercase">{car.rarity}</span></button>)}<button onClick={()=>{setTab("shop");setShopFilter("car");}} className="w-full min-h-14 rounded-2xl bg-amber-400 text-slate-950 font-black">UNLOCK MORE CARS</button></aside>
      </div>
    </section>}

    <footer className="max-w-7xl mx-auto px-5 py-8 text-center text-white/40 text-xs font-bold">A.R.I.S.E. Avatar World is built into A.R.I.S.E. Reader. No outside avatar account, no weapons, no fighting, and no real-money purchases.</footer>
    {previewProduct&&<div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="model-preview-title">
      <div className="w-[min(560px,100%)] rounded-3xl border border-cyan-300/30 bg-slate-950 p-4 shadow-2xl">
        <div className="flex items-center justify-between"><h2 id="model-preview-title" className="text-xl font-black">{previewProduct.name}</h2><button type="button" onClick={()=>setPreviewProduct(null)} className="min-h-11 min-w-11 rounded-xl bg-white/10" aria-label="Close preview"><X className="mx-auto"/></button></div>
        <WorldModelPreview id={previewProduct.id} className="mt-2 h-[340px] rounded-2xl bg-cyan-900/15"/>
        {previewProduct.type==="pet"&&<p className="mt-2 text-sm text-white/75">{PET_PERSONALITIES[previewProduct.id]?.trait}. “{PET_PERSONALITIES[previewProduct.id]?.greeting}”</p>}
        <p className="mt-2 text-sm text-white/60">Drag to rotate. You can preview this even before earning the coins.</p>
        <button type="button" onClick={()=>setPreviewProduct(null)} className="mt-4 min-h-12 w-full rounded-xl bg-white/10 font-black">Close preview</button>
      </div>
    </div>}
    {pendingCare&&<div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="care-title">
      <div className="w-[min(430px,100%)] rounded-3xl border border-amber-300/30 bg-slate-950 p-5 shadow-2xl">
        <h2 id="care-title" className="text-2xl font-black">{pendingCare.action==="feed"?"Buy food for":pendingCare.action==="treat"?"Give a treat to":pendingCare.action==="walk"?"Walk":"Play with"} {getItem(pendingCare.petId)?.name}?</h2>
        <p className="mt-2 text-sm text-white/70">{pendingCare.action==="feed"?"Food costs 30 Reader Coins and adds 30 happiness.":pendingCare.action==="treat"?"A treat costs 10 Reader Coins and adds 12 happiness.":pendingCare.action==="walk"?"Walking is free and adds 22 happiness.":"Play time is free and adds 22 happiness."}</p>
        <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setPendingCare(null)} className="min-h-12 rounded-xl bg-white/10 font-black">Cancel</button><button type="button" onClick={()=>void careForPet(pendingCare.petId,pendingCare.action)} disabled={!!busy} className="min-h-12 rounded-xl bg-amber-400 font-black text-slate-950 disabled:opacity-40">Confirm</button></div>
      </div>
    </div>}
    {pendingPurchase&&<div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="purchase-title">
      <div className="w-[min(430px,100%)] rounded-3xl border border-amber-300/30 bg-slate-950 p-5 text-white shadow-2xl">
        <h2 id="purchase-title" className="text-2xl font-black">{pendingPurchase.type==="pet"&&payload.state.runawayPets?.includes(pendingPurchase.id)?"Adopt "+pendingPurchase.name+" again?":"Unlock "+pendingPurchase.name+"?"}</h2>
        <p className="mt-2 text-sm text-white/70">{pendingPurchase.type==="pet"&&payload.state.runawayPets?.includes(pendingPurchase.id)?"This pet ran away when its happiness reached 0. Adopting it again costs ":"This will spend "}<strong className="text-amber-300">{pendingPurchase.price.toLocaleString()} Reader Coins</strong>. You have {payload.economy.wallet.toLocaleString()} coins.</p>
        <p className="mt-2 text-sm font-bold text-white/60">Your balance after unlocking: {(payload.economy.wallet-pendingPurchase.price).toLocaleString()} coins.</p>
        <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setPendingPurchase(null)} className="min-h-12 rounded-xl bg-white/10 font-black">Cancel</button><button type="button" onClick={()=>void purchase(pendingPurchase)} disabled={payload.economy.wallet<pendingPurchase.price||!!busy} className="min-h-12 rounded-xl bg-amber-400 px-3 font-black text-slate-950 disabled:opacity-50">Confirm unlock</button></div>
      </div>
    </div>}
  </main>;
}
