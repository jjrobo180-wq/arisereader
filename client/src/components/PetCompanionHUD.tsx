import { useEffect, useMemo, useState } from "react";
import { Bone, Coins, Heart, PawPrint, ShoppingBag, Utensils, X } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { PET_PERSONALITIES } from "@/lib/pets";

type PetCare={happiness:number;lastUpdatedAt:number;lastFedAt:number;lastTreatAt:number;lastWalkAt:number};
type WorldPayload={
  economy:{wallet:number};
  state:{equipped:Record<string,string>;petCare:Record<string,PetCare>};
  catalog:Array<{id:string;type:string;name:string}>;
};

function mood(happiness:number){
  if(happiness>=85)return {label:"Thrilled",face:"🤩"};
  if(happiness>=65)return {label:"Happy",face:"😊"};
  if(happiness>=40)return {label:"Okay",face:"🙂"};
  if(happiness>=20)return {label:"Needs care",face:"🥺"};
  return {label:"Very unhappy",face:"😢"};
}

export default function PetCompanionHUD(){
  const {token}=useAuth();
  const [data,setData]=useState<WorldPayload|null>(null);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");

  const load=async()=>{
    if(!token)return;
    try{
      const r=await fetch(API_BASE+"/api/avatar-world",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
      if(r.ok)setData(await r.json());
    }catch{}
  };
  useEffect(()=>{void load();const id=window.setInterval(load,30000);return()=>window.clearInterval(id);},[token]);

  const petId=data?.state.equipped.pet||"pet-none";
  const pet=data?.catalog.find(x=>x.id===petId);
  const care=data?.state.petCare[petId];
  const happiness=Math.max(0,Math.min(100,Math.round(care?.happiness??100)));
  const petMood=useMemo(()=>mood(happiness),[happiness]);
  if(!data||petId==="pet-none"||!pet)return null;

  const act=async(action:"feed"|"treat"|"walk"|"play")=>{
    if(!token||busy)return;
    setBusy(action);setMessage("");
    try{
      const r=await fetch(API_BASE+"/api/avatar-world/pet-care",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({petId,action})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not care for your pet.");
      setData(d);
      setMessage(action==="feed"?"Yum! Happiness went up.":action==="treat"?"Treat time!":action==="walk"?"Great walk!":"Play time!");
    }catch(e:any){setMessage(e.message||"Could not care for your pet.");}
    finally{setBusy("");}
  };

  const turnOff=async()=>{
    if(!token||busy)return;
    setBusy("off");
    try{
      const r=await fetch(API_BASE+"/api/avatar-world/customize",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({action:"equip",slot:"pet",itemId:"pet-none"})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not turn off your pet.");
      setData(d);setOpen(false);
    }catch(e:any){setMessage(e.message||"Could not turn off your pet.");}
    finally{setBusy("");}
  };

  const isDog=petId==="pet-dog";
  return <>
    <button type="button" onClick={()=>setOpen(true)} className="fixed bottom-3 left-3 z-[80] flex min-h-14 items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/90 px-3 text-left text-white shadow-2xl backdrop-blur" aria-label={"Open care for "+pet.name}>
      <span className="text-3xl">{PET_PERSONALITIES[petId]?.emoji||"🐾"}</span>
      <span className="min-w-24">
        <span className="block text-xs font-black">{pet.name} {petMood.face}</span>
        <span className="mt-1 block h-2 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-emerald-400 transition-all" style={{width:happiness+"%"}}/></span>
        <span className="block text-[10px] font-bold text-white/65">{happiness}% happy</span>
      </span>
    </button>

    {open&&<div className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={()=>setOpen(false)}>
      <section className="w-[min(520px,96vw)] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 text-white shadow-2xl" onClick={e=>e.stopPropagation()}>
        <header className="flex items-center gap-3 border-b border-white/10 p-4">
          <span className="text-5xl">{PET_PERSONALITIES[petId]?.emoji||"🐾"}</span>
          <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-widest text-cyan-300">My Pet</p><h2 className="truncate text-2xl font-black">{pet.name}</h2><p className="text-sm font-bold text-white/65">{PET_PERSONALITIES[petId]?.trait||"Your reading buddy"}</p></div>
          <button onClick={()=>setOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl bg-white/10" aria-label="Close pet care"><X className="h-5 w-5"/></button>
        </header>
        <div className="p-4">
          <div className="rounded-2xl bg-white/5 p-4">
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-black"><Heart className="h-5 w-5"/> Happiness</span><strong>{happiness}% · {petMood.label}</strong></div>
            <div className="mt-3 h-4 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{width:happiness+"%"}}/></div>
            <p className="mt-2 text-xs font-bold text-white/55">Happiness slowly drops over time. Food, treats, walks, and play bring it back up. Your pet never disappears just because the meter is low.</p>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-amber-300">Pet Store & Care</p><p className="text-sm font-bold text-white/60">Use Reader Coins for food and treats.</p></div><span className="flex items-center gap-1 rounded-xl bg-amber-300 px-3 py-2 font-black text-slate-950"><Coins className="h-4 w-4"/>{data.economy.wallet}</span></div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button disabled={!!busy||data.economy.wallet<30} onClick={()=>void act("feed")} className="min-h-20 rounded-2xl bg-amber-300 p-3 text-left font-black text-slate-950 disabled:opacity-40"><Utensils className="mb-1 h-5 w-5"/>Food · 30 🪙<span className="block text-xs font-bold opacity-70">+30 happiness</span></button>
            <button disabled={!!busy||data.economy.wallet<10} onClick={()=>void act("treat")} className="min-h-20 rounded-2xl bg-pink-300 p-3 text-left font-black text-slate-950 disabled:opacity-40"><Bone className="mb-1 h-5 w-5"/>Treat · 10 🪙<span className="block text-xs font-bold opacity-70">+12 happiness</span></button>
            <button disabled={!!busy} onClick={()=>void act(isDog?"walk":"play")} className="min-h-20 rounded-2xl bg-cyan-300 p-3 text-left font-black text-slate-950 disabled:opacity-40"><PawPrint className="mb-1 h-5 w-5"/>{isDog?"Walk dog":"Play together"}<span className="block text-xs font-bold opacity-70">Free · +22 happiness</span></button>
            <button disabled={!!busy} onClick={()=>void turnOff()} className="min-h-20 rounded-2xl bg-white/10 p-3 text-left font-black text-white disabled:opacity-40"><ShoppingBag className="mb-1 h-5 w-5"/>Let pet rest<span className="block text-xs font-bold text-white/55">Turns pet off until you equip it again</span></button>
          </div>
          {message&&<p className="mt-3 rounded-xl bg-white/10 p-3 text-sm font-black">{message}</p>}
        </div>
      </section>
    </div>}
  </>;
}
