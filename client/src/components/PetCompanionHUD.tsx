import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Coins, Moon, X } from "lucide-react";
import PetCareActions, { DEFAULT_PET_RULES, PET_CARE_MESSAGES, PetHealthBar, petMood, type PetAction, type PetCare, type PetRules } from "@/components/PetCareActions";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { PET_CARE_EVENT, PET_PERSONALITIES } from "@/lib/pets";
import { halloreadPetGearName } from "@/lib/halloread";

type WorldPayload={
  economy:{wallet:number};
  state:{equipped:Record<string,string>;petCare:Record<string,PetCare>;lostPets?:string[]};
  catalog:Array<{id:string;type:string;name:string;price?:number}>;
  petRules?:PetRules;
};

export default function PetCompanionHUD(){
  const {token}=useAuth();
  const [,navigate]=useLocation();
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
  useEffect(()=>{
    const openCare=()=>{void load();setOpen(true);};
    window.addEventListener(PET_CARE_EVENT,openCare);
    return()=>window.removeEventListener(PET_CARE_EVENT,openCare);
  },[token]);

  const petId=data?.state.equipped.pet||"pet-none";
  const pet=data?.catalog.find(x=>x.id===petId);
  const care=data?.state.petCare[petId];
  const happiness=Math.max(0,Math.min(100,Math.round(care?.happiness??100)));
  const petMood_=useMemo(()=>petMood(happiness),[happiness]);
  const rules=data?.petRules||DEFAULT_PET_RULES;
  if(!data)return null;
  if(petId==="pet-none"||!pet){
    const lostId=data.state.lostPets?.[data.state.lostPets.length-1];
    const lost=data.catalog.find(x=>x.id===lostId);
    if(!lost)return null;
    return <button type="button" onClick={()=>navigate("/avatar-world")} className="fixed bottom-3 left-3 z-[80] max-w-[260px] rounded-2xl border border-rose-300/40 bg-rose-950/95 p-3 text-left text-white shadow-2xl backdrop-blur">
      <span className="block text-sm font-black">💔 {lost.name} ran away</span>
      <span className="mt-1 block text-xs font-bold text-white/70">Happiness reached 0%. Tap to rescue {lost.name} from the pet shop for half price.</span>
    </button>;
  }

  const act=async(action:PetAction)=>{
    if(!token||busy)return;
    setBusy(action);setMessage("");
    try{
      const r=await fetch(API_BASE+"/api/avatar-world/pet-care",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({petId,action})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not care for your pet.");
      setData(d);
      setMessage(PET_CARE_MESSAGES[action]);
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

  return <>
    <button type="button" onClick={()=>setOpen(true)} className="fixed bottom-3 left-3 z-[80] flex min-h-14 items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/90 px-3 text-left text-white shadow-2xl backdrop-blur" aria-label={"Open care for "+pet.name}>
      <span className="text-3xl">{PET_PERSONALITIES[petId]?.emoji||"🐾"}</span>
      <span className="min-w-24">
        <span className="block text-xs font-black">{pet.name} {petMood_.face}</span>
        <span className="mt-1 block h-2 overflow-hidden rounded-full bg-white/15"><span className={"block h-full rounded-full transition-all "+petMood_.bar} style={{width:happiness+"%"}}/></span>
        <span className="block text-[10px] font-bold text-white/65">{happiness}% happy</span>
      </span>
    </button>

    {open&&<div className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={()=>setOpen(false)}>
      <section className="w-[min(520px,96vw)] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 text-white shadow-2xl" onClick={e=>e.stopPropagation()}>
        <header className="flex items-center gap-3 border-b border-white/10 p-4">
          <span className="text-5xl">{PET_PERSONALITIES[petId]?.emoji||"🐾"}</span>
          <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-widest text-cyan-300">My Pet</p><h2 className="truncate text-2xl font-black">{pet.name}</h2><p className="text-sm font-bold text-white/65">{PET_PERSONALITIES[petId]?.trait||"Your reading buddy"}</p>{halloreadPetGearName(petId)&&<p className="mt-1 inline-flex rounded-full bg-orange-400/15 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-orange-200">🎃 Halloread gear · {halloreadPetGearName(petId)}</p>}</div>
          <button onClick={()=>setOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl bg-white/10" aria-label="Close pet care"><X className="h-5 w-5"/></button>
        </header>
        <div className="p-4">
          <div className="rounded-2xl bg-white/5 p-4"><PetHealthBar happiness={happiness} rules={rules}/></div>
          <div className="mt-4 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-amber-300">Pet Care</p><p className="text-sm font-bold text-white/60">Free play has a short rest time. Food, treats, and vet visits use Reader Coins.</p></div><span className="flex items-center gap-1 rounded-xl bg-amber-300 px-3 py-2 font-black text-slate-950"><Coins className="h-4 w-4"/>{data.economy.wallet}</span></div>
          <div className="mt-3"><PetCareActions petId={petId} care={care} wallet={data.economy.wallet} rules={rules} busy={!!busy} onAct={a=>void act(a)}/></div>
          <button disabled={!!busy} onClick={()=>void turnOff()} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-black text-white/80 disabled:opacity-40"><Moon className="h-4 w-4"/>Let pet rest at home (stops following you)</button>
          {message&&<p className="mt-3 rounded-xl bg-white/10 p-3 text-sm font-black">{message}</p>}
        </div>
      </section>
    </div>}
  </>;
}
