import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { ArrowLeft, Car, Check, Coins, Home, Lock, RotateCcw, ShoppingBag, Sparkles, UserRound, Zap } from "lucide-react";

type CatalogItem={id:string;type:string;name:string;price:number;rarity:string};
type Payload={
  economy:{level:number;quizzesTaken:number;totalPoints:number;lifetimeCoins:number;wallet:number;nextLevelAt:number|null;coinsPerQuiz:number;levelBonus:number};
  state:{purchased:string[];equipped:Record<string,string>;furniture:string[];look:{skin:string;hair:string;hairColor:string;eyeColor:string};spent:number};
  catalog:CatalogItem[];
};
type Tab="avatar"|"shop"|"garage"|"home";

const FREE_ITEMS:CatalogItem[]=[
  {id:"top-basic",type:"top",name:"Classic Tee",price:0,rarity:"starter"},
  {id:"bottom-basic",type:"bottom",name:"Classic Jeans",price:0,rarity:"starter"},
  {id:"shoes-basic",type:"shoes",name:"Starter Sneakers",price:0,rarity:"starter"},
  {id:"car-none",type:"car",name:"No Car",price:0,rarity:"starter"},
  {id:"home-basic",type:"home",name:"Starter Room",price:0,rarity:"starter"},
];

const rarityClass:Record<string,string>={
  starter:"from-slate-500 to-slate-700 border-slate-400",
  common:"from-slate-500 to-zinc-700 border-slate-400",
  rare:"from-sky-500 to-blue-700 border-sky-300",
  epic:"from-violet-500 to-fuchsia-700 border-violet-300",
  legendary:"from-amber-400 to-orange-600 border-amber-200",
};

function AvatarFigure({payload,small=false,entering=false}:{payload:Payload;small?:boolean;entering?:boolean}){
  const e=payload.state.equipped;
  const look=payload.state.look;
  const top=e.top;
  const bottom=e.bottom;
  const shoes=e.shoes;
  const hat=e.hat;
  const glasses=e.glasses;
  const accessory=e.accessory;
  const topStyle=top==="jacket-varsity"?"linear-gradient(145deg,#f8fafc,#0f766e 55%,#134e4a)":top==="hoodie-neon"?"linear-gradient(145deg,#0f172a,#7c3aed 55%,#22d3ee)":top==="hoodie-midnight"?"linear-gradient(145deg,#111827,#334155)":"linear-gradient(145deg,#14b8a6,#0f766e)";
  const bottomStyle=bottom==="pants-cargo"?"linear-gradient(145deg,#334155,#1f2937)":"linear-gradient(145deg,#1e3a8a,#172554)";
  const shoeStyle=shoes==="shoes-neon"?"linear-gradient(145deg,#a3e635,#22d3ee)":"linear-gradient(145deg,#fff,#cbd5e1)";
  const hairShape=look.hair==="afro"?"44% 44% 38% 38%":look.hair==="locs"?"38% 38% 48% 48%":look.hair==="braids"?"40% 40% 58% 58%":"48% 48% 35% 35%";
  return <div className={"relative "+(small?"w-40 h-64":"w-[250px] h-[420px] sm:w-[300px] sm:h-[500px]")} style={{filter:"drop-shadow(0 22px 24px rgba(0,0,0,.38))",transform:entering?"translateX(130px) scale(.72) rotateY(18deg)":"translateX(0) scale(1)",transition:"transform 1.1s cubic-bezier(.2,.8,.2,1)"}}>
    <div className="absolute left-1/2 -translate-x-1/2" style={{top:small?8:18,width:small?82:116,height:small?93:132,borderRadius:"46% 46% 48% 48%",background:look.skin,boxShadow:"inset 0 -8px 16px rgba(0,0,0,.16),0 10px 20px rgba(0,0,0,.18)"}}>
      <div className="absolute -top-[10%] left-[2%] right-[2%] h-[42%]" style={{background:look.hairColor,borderRadius:hairShape,boxShadow:"inset 0 -6px 10px rgba(0,0,0,.22)"}}/>
      {look.hair==="locs"&&[8,26,44,62,78].map(x=><span key={x} className="absolute -top-1 w-2 h-16 rounded-full" style={{left:x+"%",background:look.hairColor}}/>)}
      {look.hair==="braids"&&[12,28,45,62,78].map(x=><span key={x} className="absolute top-0 w-1.5 h-14 rounded-full" style={{left:x+"%",background:look.hairColor}}/>)}
      <span className="absolute top-[48%] left-[24%] w-3 h-2 rounded-full" style={{background:look.eyeColor}}/>
      <span className="absolute top-[48%] right-[24%] w-3 h-2 rounded-full" style={{background:look.eyeColor}}/>
      <span className="absolute top-[66%] left-1/2 -translate-x-1/2 w-[28%] h-2 rounded-full bg-black/20"/>
      {glasses&&<><span className="absolute top-[42%] left-[13%] w-[31%] h-[19%] rounded-xl border-[4px] border-slate-900 bg-cyan-200/20"/><span className="absolute top-[42%] right-[13%] w-[31%] h-[19%] rounded-xl border-[4px] border-slate-900 bg-cyan-200/20"/><span className="absolute top-[49%] left-[43%] w-[14%] h-1 bg-slate-900"/></>}
      {hat&&<div className="absolute -top-[20%] left-[-5%] right-[-5%] h-[32%] rounded-[50%_50%_30%_30%]" style={{background:hat==="hat-crown"?"linear-gradient(#facc15,#f59e0b)":"linear-gradient(#111827,#334155)",clipPath:hat==="hat-crown"?"polygon(0 100%,10% 15%,30% 65%,50% 0,70% 65%,90% 15%,100% 100%)":undefined}}/>}
    </div>
    <div className="absolute left-1/2 -translate-x-1/2" style={{top:small?96:137,width:small?106:152,height:small?103:150,borderRadius:"30% 30% 20% 20%",background:topStyle,boxShadow:"inset 0 -14px 22px rgba(0,0,0,.24)"}}>
      <span className="absolute left-[44%] top-[18%] text-white/80 font-black text-lg">A</span>
      <span className="absolute -left-[16%] top-[10%] w-[22%] h-[76%] rounded-full" style={{background:topStyle,transform:"rotate(6deg)"}}/>
      <span className="absolute -right-[16%] top-[10%] w-[22%] h-[76%] rounded-full" style={{background:topStyle,transform:"rotate(-6deg)"}}/>
      {accessory==="headphones-cyan"&&<div className="absolute -top-[56%] left-[5%] right-[5%] h-[65%] rounded-t-full border-[8px] border-cyan-400 border-b-0"/>}
      {accessory==="chain-silver"&&<div className="absolute top-[8%] left-[30%] right-[30%] h-[28%] rounded-b-full border-b-4 border-slate-200"/>}
      {accessory==="bag-tech"&&<div className="absolute -right-[22%] top-[14%] w-[34%] h-[62%] rounded-2xl bg-slate-900 border-4 border-cyan-400"/>}
      {accessory==="watch-smart"&&<div className="absolute -right-[24%] bottom-[12%] w-5 h-7 rounded-md bg-slate-950 border-2 border-cyan-400"/>}
    </div>
    <div className="absolute left-1/2 -translate-x-1/2 flex gap-[4%]" style={{top:small?190:278,width:small?82:116,height:small?58:88}}>
      <div className="flex-1 rounded-b-3xl" style={{background:bottomStyle,transform:"rotate(2deg)"}}/>
      <div className="flex-1 rounded-b-3xl" style={{background:bottomStyle,transform:"rotate(-2deg)"}}/>
    </div>
    <div className="absolute left-1/2 -translate-x-1/2 flex justify-between" style={{top:small?240:354,width:small?100:145}}>
      <div className="w-[44%] h-7 rounded-[60%_40%_35%_35%]" style={{background:shoeStyle,transform:"rotate(-4deg)"}}/>
      <div className="w-[44%] h-7 rounded-[40%_60%_35%_35%]" style={{background:shoeStyle,transform:"rotate(4deg)"}}/>
    </div>
  </div>
}

function CarModel({id,rotation=0}:{id:string;rotation?:number}){
  const scheme=id==="car-super"
    ? {body:"#f97316",accent:"#111827",glow:"rgba(249,115,22,.65)"}
    : id==="car-electric"
      ? {body:"#7c3aed",accent:"#22d3ee",glow:"rgba(124,58,237,.7)"}
      : id==="car-suv"
        ? {body:"#0f766e",accent:"#d1fae5",glow:"rgba(13,148,136,.6)"}
        : {body:"#2563eb",accent:"#e2e8f0",glow:"rgba(37,99,235,.6)"};
  return <div className="relative w-[320px] sm:w-[470px] h-[190px] sm:h-[260px]" style={{transform:"perspective(900px) rotateY("+rotation+"deg) rotateX(-4deg)",transformStyle:"preserve-3d",transition:"transform .08s linear"}}>
    <div className="absolute left-[8%] right-[8%] top-[38%] bottom-[16%] rounded-[30%_45%_18%_18%]" style={{background:"linear-gradient(160deg,"+scheme.body+",#0f172a)",boxShadow:"0 24px 55px "+scheme.glow+",inset 0 12px 22px rgba(255,255,255,.2)"}}/>
    <div className="absolute left-[27%] right-[22%] top-[18%] h-[34%] rounded-[45%_48%_8%_8%] bg-sky-200/80 border-4 border-slate-900" style={{clipPath:"polygon(16% 0,82% 0,100% 100%,0 100%)"}}/>
    <div className="absolute left-[14%] right-[14%] top-[54%] h-4 rounded-full" style={{background:scheme.accent,boxShadow:"0 0 14px "+scheme.glow}}/>
    <div className="absolute left-[11%] bottom-[4%] w-[22%] aspect-square rounded-full bg-slate-950 border-[10px] border-slate-700 shadow-xl"><div className="absolute inset-[26%] rounded-full bg-slate-300"/></div>
    <div className="absolute right-[11%] bottom-[4%] w-[22%] aspect-square rounded-full bg-slate-950 border-[10px] border-slate-700 shadow-xl"><div className="absolute inset-[26%] rounded-full bg-slate-300"/></div>
    <div className="absolute left-[9%] top-[48%] w-8 h-4 rounded-full bg-white shadow-[0_0_18px_white]"/>
    <div className="absolute right-[9%] top-[48%] w-8 h-4 rounded-full bg-red-400 shadow-[0_0_18px_rgba(248,113,113,.8)]"/>
  </div>
}

export default function AvatarWorld(){
  const {user,token}=useAuth();
  const [,navigate]=useLocation();
  const [payload,setPayload]=useState<Payload|null>(null);
  const [tab,setTab]=useState<Tab>("avatar");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");
  const [shopFilter,setShopFilter]=useState("all");
  const [carRotation,setCarRotation]=useState(0);
  const [entering,setEntering]=useState(false);
  const [inCar,setInCar]=useState(false);
  const dragRef=useRef<{x:number;rotation:number}|null>(null);

  const load=async()=>{
    if(!token)return;
    try{
      const r=await fetch(API_BASE+"/api/avatar-world",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not load Avatar World.");
      setPayload(d);
    }catch(error:any){setMessage(error.message||"Could not load Avatar World.");}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[token]);

  const saveCustomize=async(body:any)=>{
    if(!token)return;
    setBusy("save");setMessage("");
    try{
      const r=await fetch(API_BASE+"/api/avatar-world/customize",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not save.");
      setPayload(d);
    }catch(error:any){setMessage(error.message||"Could not save.");}
    finally{setBusy("");}
  };

  const buy=async(item:CatalogItem)=>{
    if(!token)return;
    setBusy(item.id);setMessage("");
    try{
      const r=await fetch(API_BASE+"/api/avatar-world/purchase",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({itemId:item.id})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not buy that.");
      setPayload(d);
      setMessage("Unlocked "+item.name+"!");
    }catch(error:any){setMessage(error.message||"Could not buy that.");}
    finally{setBusy("");}
  };

  const allItems=useMemo(()=>[...FREE_ITEMS,...(payload?.catalog||[])],[payload]);
  const item=(id:string)=>allItems.find(x=>x.id===id);
  const owned=(id:string)=>FREE_ITEMS.some(x=>x.id===id)||!!payload?.state.purchased.includes(id);
  const equipped=(id:string)=>Object.values(payload?.state.equipped||{}).includes(id);
  const shopItems=(payload?.catalog||[]).filter(x=>shopFilter==="all"||x.type===shopFilter);

  if(loading)return <main className="min-h-screen bg-slate-950 text-white grid place-items-center"><div className="text-center"><div className="w-14 h-14 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"/><p className="font-black mt-4">Loading Avatar World…</p></div></main>;
  if(!payload)return <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-6"><div className="text-center"><p className="text-xl font-black">{message||"Avatar World is unavailable."}</p><button onClick={()=>navigate("/library")} className="mt-4 rounded-2xl bg-white text-slate-950 px-5 py-3 font-black">Back to Library</button></div></main>;

  const carId=payload.state.equipped.car;
  const homeId=payload.state.equipped.home;

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554,#0f172a_52%,#020617)] text-white overflow-x-hidden">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-3 flex items-center gap-3">
        <button onClick={()=>navigate("/library")} className="min-h-12 rounded-2xl bg-white/10 border border-white/15 px-3 font-black flex items-center gap-2"><ArrowLeft className="w-5 h-5"/> Library</button>
        <div className="flex-1 min-w-0"><p className="text-[10px] font-black tracking-[.28em] text-cyan-300">A.R.I.S.E.</p><h1 className="text-lg sm:text-2xl font-black truncate">Avatar World</h1></div>
        <div className="hidden sm:flex items-center gap-2 rounded-2xl bg-amber-400/10 border border-amber-300/30 px-3 py-2"><Coins className="w-5 h-5 text-amber-300"/><div><div className="text-xs font-black text-amber-200">READER COINS</div><div className="font-black text-amber-300">{payload.economy.wallet.toLocaleString()}</div></div></div>
        <div className="rounded-2xl bg-violet-500/10 border border-violet-300/30 px-3 py-2 text-center"><div className="text-[10px] font-black text-violet-200">LEVEL</div><div className="font-black text-xl">{payload.economy.level}</div></div>
      </div>
    </header>

    <section className="max-w-7xl mx-auto px-3 sm:px-5 pt-5">
      <div className="rounded-[2rem] border border-cyan-300/20 bg-gradient-to-r from-cyan-400/10 via-violet-500/10 to-fuchsia-500/10 p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1"><p className="text-xs font-black tracking-widest text-cyan-300">QUIZ-POWERED PROGRESSION</p><h2 className="text-2xl sm:text-3xl font-black mt-1">{user?.displayName||"Reader"}, build your world.</h2><p className="text-white/65 font-bold mt-1">Every completed quiz earns <span className="text-amber-300">100 coins</span>. Every new level adds <span className="text-amber-300">150 bonus coins</span>.</p></div>
          <div className="min-w-[260px]">
            <div className="flex justify-between text-xs font-black mb-1"><span>{payload.economy.quizzesTaken} quizzes</span><span>{payload.economy.nextLevelAt?payload.economy.nextLevelAt+" for next level":"MAX LEVEL"}</span></div>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500" style={{width:payload.economy.nextLevelAt?((payload.economy.quizzesTaken%2)/2)*100+"%":"100%"}}/></div>
          </div>
        </div>
      </div>

      <nav className="mt-4 grid grid-cols-4 gap-2 rounded-3xl bg-white/5 border border-white/10 p-2">
        {([
          ["avatar",UserRound,"Character"],["shop",ShoppingBag,"Shop"],["garage",Car,"Garage"],["home",Home,"Home"]
        ] as const).map(([id,Icon,label])=><button key={id} onClick={()=>setTab(id)} className={"min-h-16 rounded-2xl font-black flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 "+(tab===id?"bg-white text-slate-950 shadow-lg":"text-white/70 hover:bg-white/10")}><Icon className="w-5 h-5"/>{label}</button>)}
      </nav>
      {message&&<div className="mt-3 rounded-2xl bg-white/10 border border-white/15 p-3 text-center font-black">{message}</div>}
    </section>

    {tab==="avatar"&&<section className="max-w-7xl mx-auto p-3 sm:p-5 grid lg:grid-cols-[1.05fr_.95fr] gap-5">
      <div className="min-h-[620px] rounded-[2.5rem] border border-white/10 bg-[radial-gradient(circle_at_50%_18%,rgba(34,211,238,.18),transparent_35%),linear-gradient(160deg,#111827,#020617)] relative overflow-hidden flex items-end justify-center">
        <div className="absolute inset-x-0 bottom-0 h-[24%] bg-[linear-gradient(180deg,transparent,rgba(15,23,42,.4)),repeating-linear-gradient(90deg,#1e293b_0_40px,#172033_40px_80px)] opacity-70"/>
        <div className="absolute top-5 left-5"><p className="text-xs font-black text-cyan-300">MY CHARACTER</p><h2 className="text-2xl font-black">Level {payload.economy.level}</h2></div>
        <AvatarFigure payload={payload}/>
      </div>

      <div className="space-y-4">
        <div className="rounded-[2rem] bg-white/5 border border-white/10 p-5">
          <h3 className="text-xl font-black">Face & hair</h3>
          <div className="mt-4">
            <p className="text-xs font-black text-white/55">SKIN TONE</p>
            <div className="flex flex-wrap gap-2 mt-2">{["#f4c7a1","#d89a73","#b97750","#9b6244","#74432e","#4c2a20","#2e1a16"].map(color=><button key={color} onClick={()=>saveCustomize({action:"look",look:{skin:color}})} className={"w-11 h-11 rounded-full border-4 "+(payload.state.look.skin===color?"border-cyan-300":"border-white/15")} style={{background:color}} aria-label="Choose skin tone"/>)}</div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-black text-white/55">HAIR STYLE</p>
            <div className="grid grid-cols-3 gap-2 mt-2">{["fade","curls","locs","waves","afro","braids"].map(hair=><button key={hair} onClick={()=>saveCustomize({action:"look",look:{hair}})} className={"min-h-12 rounded-xl border font-black capitalize "+(payload.state.look.hair===hair?"bg-cyan-400 text-slate-950 border-cyan-200":"bg-white/5 border-white/10")}>{hair}</button>)}</div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-black text-white/55">HAIR COLOR</p>
            <div className="flex gap-2 mt-2">{["#171717","#3b2417","#6b3d24","#8f6545"].map(color=><button key={color} onClick={()=>saveCustomize({action:"look",look:{hairColor:color}})} className={"w-10 h-10 rounded-full border-4 "+(payload.state.look.hairColor===color?"border-cyan-300":"border-white/15")} style={{background:color}}/>)}</div>
          </div>
        </div>

        {["top","bottom","shoes","hat","glasses","accessory"].map(slot=>{
          const candidates=allItems.filter(x=>x.type===slot&&owned(x.id));
          if(["hat","glasses","accessory"].includes(slot)) candidates.unshift({id:"",type:slot,name:"None",price:0,rarity:"starter"});
          return <div key={slot} className="rounded-[2rem] bg-white/5 border border-white/10 p-4">
            <p className="text-xs font-black tracking-widest text-white/45 uppercase">{slot}</p>
            <div className="flex gap-2 overflow-x-auto mt-2 pb-1">{candidates.map(candidate=><button key={candidate.id||"none"} onClick={()=>saveCustomize({action:"equip",slot,itemId:candidate.id})} className={"min-w-[150px] rounded-2xl border p-3 text-left "+(payload.state.equipped[slot]===candidate.id?"bg-cyan-400 text-slate-950 border-cyan-200":"bg-white/5 border-white/10")}>
              <strong className="block">{candidate.name}</strong><span className="text-xs font-black opacity-60">{candidate.rarity}</span>
            </button>)}</div>
          </div>;
        })}
      </div>
    </section>}

    {tab==="shop"&&<section className="max-w-7xl mx-auto p-3 sm:p-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex-1"><h2 className="text-3xl font-black">Reader Shop</h2><p className="text-white/60 font-bold">Everything is earned through reading and quizzes. No real-money purchases.</p></div>
        <div className="rounded-2xl bg-amber-400 text-slate-950 px-4 py-3 font-black flex items-center gap-2"><Coins className="w-5 h-5"/>{payload.economy.wallet.toLocaleString()} coins</div>
      </div>
      <div className="flex gap-2 overflow-x-auto mt-4 pb-2">{["all","top","bottom","shoes","hat","glasses","accessory","car","home","furniture"].map(filter=><button key={filter} onClick={()=>setShopFilter(filter)} className={"min-w-max rounded-full px-4 py-2 font-black capitalize "+(shopFilter===filter?"bg-white text-slate-950":"bg-white/10 text-white/70")}>{filter==="all"?"All":filter}</button>)}</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
        {shopItems.map(product=>{
          const isOwned=owned(product.id);
          const canAfford=payload.economy.wallet>=product.price;
          return <article key={product.id} className={"rounded-[2rem] overflow-hidden border-2 bg-gradient-to-br "+(rarityClass[product.rarity]||rarityClass.common)}>
            <div className="h-44 grid place-items-center bg-black/25 relative">
              <div className="text-7xl drop-shadow-xl">{product.type==="car"?"🏎️":product.type==="home"?"🏡":product.type==="hat"?"🧢":product.type==="glasses"?"🕶️":product.type==="shoes"?"👟":product.type==="accessory"?"🎧":product.type==="furniture"?"🛋️":"🧥"}</div>
              <span className="absolute top-3 right-3 rounded-full bg-black/40 px-3 py-1 text-[10px] font-black uppercase tracking-widest">{product.rarity}</span>
            </div>
            <div className="p-4 bg-slate-950/80">
              <h3 className="text-lg font-black">{product.name}</h3>
              <p className="text-xs font-black text-white/45 uppercase">{product.type}</p>
              <button disabled={isOwned||!canAfford||busy===product.id} onClick={()=>buy(product)} className={"mt-4 w-full min-h-12 rounded-xl font-black flex items-center justify-center gap-2 "+(isOwned?"bg-emerald-500/20 text-emerald-300":canAfford?"bg-amber-400 text-slate-950":"bg-white/10 text-white/40")}>
                {isOwned?<><Check className="w-5 h-5"/>OWNED</>:canAfford?<><Coins className="w-5 h-5"/>{busy===product.id?"UNLOCKING…":product.price}</>:<><Lock className="w-5 h-5"/>{product.price}</>}
              </button>
            </div>
          </article>;
        })}
      </div>
    </section>}

    {tab==="garage"&&<section className="max-w-7xl mx-auto p-3 sm:p-5">
      <div className="grid lg:grid-cols-[1fr_360px] gap-5">
        <div className="min-h-[640px] rounded-[2.5rem] overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_50%_45%,#1e3a8a_0,#0f172a_45%,#020617_100%)] relative flex flex-col items-center justify-center">
          <div className="absolute inset-x-0 bottom-0 h-[34%] bg-[linear-gradient(#334155,#111827)] opacity-80"/>
          <div className="absolute top-5 left-5 z-10"><p className="text-xs font-black text-cyan-300">MY GARAGE</p><h2 className="text-3xl font-black">{item(carId)?.name||"No car equipped"}</h2></div>
          {carId==="car-none"?<div className="text-center relative z-10"><div className="text-8xl">🚲</div><h3 className="text-2xl font-black mt-3">Your garage is waiting.</h3><p className="text-white/60 font-bold mt-1">Unlock a car in the Reader Shop.</p><button onClick={()=>{setTab("shop");setShopFilter("car");}} className="mt-4 rounded-2xl bg-amber-400 text-slate-950 px-5 py-3 font-black">Shop Cars</button></div>
          :<div className="relative z-10 flex flex-col items-center w-full">
            <div onPointerDown={e=>{dragRef.current={x:e.clientX,rotation:carRotation};e.currentTarget.setPointerCapture?.(e.pointerId);}} onPointerMove={e=>{if(dragRef.current)setCarRotation(dragRef.current.rotation+(e.clientX-dragRef.current.x)*.7);}} onPointerUp={()=>dragRef.current=null} onPointerCancel={()=>dragRef.current=null} className="touch-none cursor-grab active:cursor-grabbing">
              <CarModel id={carId} rotation={carRotation}/>
            </div>
            <p className="text-sm font-black text-white/60">↔ Drag the car for a 360° view</p>
            <div className="relative mt-5 h-64 w-full flex items-end justify-center overflow-hidden">
              {!inCar&&<div className="absolute left-[18%] bottom-0"><AvatarFigure payload={payload} small entering={entering}/></div>}
              <div className={"absolute right-[8%] bottom-2 transition-all duration-1000 "+(entering?"scale-105":"")}><CarModel id={carId} rotation={12}/></div>
              {inCar&&<div className="absolute inset-0 grid place-items-center"><div className="rounded-3xl bg-black/60 backdrop-blur p-6 text-center border border-cyan-300/20"><div className="text-5xl">🏁</div><h3 className="text-2xl font-black">Ready to roll!</h3><p className="text-white/60 font-bold">Your character is inside {item(carId)?.name}.</p></div></div>}
            </div>
            <div className="flex gap-2">
              {!inCar?<button disabled={entering} onClick={()=>{setEntering(true);setTimeout(()=>setInCar(true),1050);}} className="min-h-14 rounded-2xl bg-cyan-400 text-slate-950 px-6 font-black flex items-center gap-2"><Car className="w-5 h-5"/>{entering?"GETTING IN…":"GET IN CAR"}</button>:<button onClick={()=>{setInCar(false);setEntering(false);}} className="min-h-14 rounded-2xl bg-white text-slate-950 px-6 font-black">GET OUT</button>}
              <button onClick={()=>setCarRotation(0)} className="min-h-14 w-14 rounded-2xl bg-white/10 border border-white/10 grid place-items-center"><RotateCcw/></button>
            </div>
          </div>}
        </div>

        <aside className="space-y-3">
          <h3 className="text-xl font-black">My Cars</h3>
          {allItems.filter(x=>x.type==="car"&&owned(x.id)).map(car=><button key={car.id} onClick={()=>saveCustomize({action:"equip",slot:"car",itemId:car.id})} className={"w-full rounded-2xl border p-4 text-left "+(carId===car.id?"bg-cyan-400 text-slate-950 border-cyan-200":"bg-white/5 border-white/10")}>
            <div className="flex items-center gap-3"><div className="text-3xl">{car.id==="car-none"?"🚶":"🏎️"}</div><div><strong className="block">{car.name}</strong><span className="text-xs font-black opacity-60 uppercase">{car.rarity}</span></div></div>
          </button>)}
          <button onClick={()=>{setTab("shop");setShopFilter("car");}} className="w-full min-h-14 rounded-2xl bg-amber-400 text-slate-950 font-black">UNLOCK MORE CARS</button>
        </aside>
      </div>
    </section>}

    {tab==="home"&&<section className="max-w-7xl mx-auto p-3 sm:p-5">
      <div className="grid lg:grid-cols-[1fr_340px] gap-5">
        <div className={"min-h-[650px] rounded-[2.5rem] border border-white/10 relative overflow-hidden "+(homeId==="home-modern"?"bg-[linear-gradient(180deg,#7dd3fc_0_36%,#e2e8f0_36%_39%,#d6d3d1_39%)]":homeId==="home-loft"?"bg-[linear-gradient(180deg,#111827_0_58%,#4c1d95_58%_61%,#292524_61%)]":homeId==="home-studio"?"bg-[linear-gradient(180deg,#334155_0_58%,#0f766e_58%_61%,#1f2937_61%)]":"bg-[linear-gradient(180deg,#dbeafe_0_58%,#f8fafc_58%_61%,#cbd5e1_61%)]")}>
          <div className="absolute top-5 left-5 z-10"><p className="text-xs font-black text-cyan-300 drop-shadow">MY HOME</p><h2 className="text-3xl font-black drop-shadow">{item(homeId)?.name||"Starter Room"}</h2></div>
          <div className="absolute left-[8%] bottom-[12%] w-[42%] h-[24%] rounded-[2rem] bg-slate-700 shadow-2xl"><div className="absolute -top-5 left-6 right-6 h-12 rounded-2xl bg-slate-600"/></div>
          <div className="absolute right-[8%] bottom-[13%] w-[28%] h-[25%] bg-amber-950 rounded-xl shadow-2xl"><div className="absolute -top-[60%] left-[10%] right-[10%] h-[62%] bg-slate-900 rounded-t-xl"><div className="absolute inset-[8%] bg-gradient-to-br from-cyan-400 to-violet-600"/></div></div>
          {payload.state.furniture.includes("furniture-books")&&<div className="absolute right-[3%] top-[18%] w-[22%] h-[38%] bg-amber-950 p-2 grid grid-rows-4 gap-2 shadow-2xl">{[0,1,2,3].map(i=><div key={i} className="bg-gradient-to-r from-cyan-400 via-amber-300 to-fuchsia-400"/>)}</div>}
          {payload.state.furniture.includes("furniture-neon")&&<div className="absolute left-[8%] top-[20%] text-3xl sm:text-5xl font-black text-cyan-300 drop-shadow-[0_0_16px_rgba(34,211,238,.8)]">READ • RISE • REPEAT</div>}
          {payload.state.furniture.includes("furniture-sofa")&&<div className="absolute left-[30%] bottom-[9%] w-[34%] h-[20%] rounded-[2rem] bg-violet-600 border-t-[18px] border-violet-400 shadow-2xl"/>}
          <div className="absolute left-[55%] bottom-[9%]"><AvatarFigure payload={payload} small/></div>
        </div>
        <aside className="space-y-3">
          <h3 className="text-xl font-black">My Places</h3>
          {allItems.filter(x=>x.type==="home"&&owned(x.id)).map(home=><button key={home.id} onClick={()=>saveCustomize({action:"equip",slot:"home",itemId:home.id})} className={"w-full rounded-2xl p-4 border text-left "+(homeId===home.id?"bg-cyan-400 text-slate-950 border-cyan-200":"bg-white/5 border-white/10")}><strong>{home.name}</strong><span className="block text-xs font-black opacity-60 uppercase">{home.rarity}</span></button>)}
          <h3 className="text-xl font-black pt-3">Furniture</h3>
          {(payload.catalog||[]).filter(x=>x.type==="furniture"&&owned(x.id)).map(furn=>{
            const active=payload.state.furniture.includes(furn.id);
            return <button key={furn.id} onClick={()=>saveCustomize({action:"furniture",itemIds:active?payload.state.furniture.filter(id=>id!==furn.id):[...payload.state.furniture,furn.id]})} className={"w-full rounded-2xl p-4 border text-left "+(active?"bg-emerald-400 text-slate-950 border-emerald-200":"bg-white/5 border-white/10")}><div className="flex items-center justify-between"><strong>{furn.name}</strong>{active&&<Check className="w-5 h-5"/>}</div></button>;
          })}
          <button onClick={()=>{setTab("shop");setShopFilter("home");}} className="w-full min-h-14 rounded-2xl bg-amber-400 text-slate-950 font-black">UPGRADE MY HOME</button>
          <button onClick={()=>{setTab("shop");setShopFilter("furniture");}} className="w-full min-h-14 rounded-2xl bg-white text-slate-950 font-black">SHOP FURNITURE</button>
        </aside>
      </div>
    </section>}

    <footer className="max-w-7xl mx-auto px-5 py-8 text-center text-white/40 text-xs font-bold">
      Avatar World is cosmetic only. No weapons, fighting, or real-money purchases.
    </footer>
  </main>;
}
