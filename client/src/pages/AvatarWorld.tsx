import { useMemo, useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import ARISEAvatar3D from "@/components/ARISEAvatar3D";
import { ArrowLeft, Car, Check, Coins, Home, Lock, RotateCcw, ShoppingBag, UserRound, X } from "lucide-react";

type CatalogItem={id:string;type:string;name:string;price:number;rarity:string};
type Look={skin:string;hair:string;hairColor:string;eyeColor:string;face:string;build:string;brows:string};
type Payload={
  economy:{level:number;quizzesTaken:number;totalPoints:number;lifetimeCoins:number;wallet:number;nextLevelAt:number|null;coinsPerQuiz:number;levelBonus:number};
  state:{purchased:string[];equipped:Record<string,string>;furniture:string[];look:Look;spent:number;avatar3d?:any};
  catalog:CatalogItem[];
};
type Tab="character"|"shop"|"garage"|"home";

const FREE_ITEMS:CatalogItem[]=[
  {id:"top-basic",type:"top",name:"A.R.I.S.E. Tee",price:0,rarity:"starter"},
  {id:"bottom-basic",type:"bottom",name:"Classic Jeans",price:0,rarity:"starter"},
  {id:"shoes-basic",type:"shoes",name:"Starter Sneakers",price:0,rarity:"starter"},
  {id:"car-none",type:"car",name:"No Car",price:0,rarity:"starter"},
  {id:"home-basic",type:"home",name:"Starter Room",price:0,rarity:"starter"},
];

const rarityClass:Record<string,string>={
  starter:"from-slate-500 to-slate-700 border-slate-400",
  common:"from-slate-600 to-zinc-800 border-slate-400",
  rare:"from-sky-500 to-blue-800 border-sky-300",
  epic:"from-violet-500 to-fuchsia-800 border-violet-300",
  legendary:"from-amber-400 to-orange-700 border-amber-200",
};

function CarStage({id,rotation}:{id:string;rotation:number}){
  const scheme=id==="car-super"
    ? {body:"#f97316",accent:"#111827",glow:"rgba(249,115,22,.65)"}
    : id==="car-electric"
      ? {body:"#7c3aed",accent:"#22d3ee",glow:"rgba(124,58,237,.7)"}
      : id==="car-suv"
        ? {body:"#0f766e",accent:"#d1fae5",glow:"rgba(13,148,136,.6)"}
        : {body:"#2563eb",accent:"#e2e8f0",glow:"rgba(37,99,235,.6)"};
  return <div className="relative w-[310px] sm:w-[470px] h-[190px] sm:h-[270px]" style={{transform:"perspective(950px) rotateY("+rotation+"deg) rotateX(-3deg)",transformStyle:"preserve-3d",transition:"transform .06s linear"}}>
    <div className="absolute left-[8%] right-[8%] top-[39%] bottom-[17%] rounded-[31%_43%_17%_17%]" style={{background:"linear-gradient(160deg,"+scheme.body+",#020617)",boxShadow:"0 25px 65px "+scheme.glow+",inset 0 12px 23px rgba(255,255,255,.2)"}}/>
    <div className="absolute left-[27%] right-[22%] top-[18%] h-[35%] rounded-[45%_48%_8%_8%] bg-sky-200/85 border-4 border-slate-900" style={{clipPath:"polygon(16% 0,82% 0,100% 100%,0 100%)"}}/>
    <div className="absolute left-[14%] right-[14%] top-[56%] h-4 rounded-full" style={{background:scheme.accent,boxShadow:"0 0 16px "+scheme.glow}}/>
    <div className="absolute left-[11%] bottom-[4%] w-[22%] aspect-square rounded-full bg-slate-950 border-[10px] border-slate-700"><div className="absolute inset-[26%] rounded-full bg-slate-300"/></div>
    <div className="absolute right-[11%] bottom-[4%] w-[22%] aspect-square rounded-full bg-slate-950 border-[10px] border-slate-700"><div className="absolute inset-[26%] rounded-full bg-slate-300"/></div>
  </div>;
}

export default function AvatarWorld(){
  const {user,token}=useAuth();
  const [,navigate]=useLocation();
  const [payload,setPayload]=useState<Payload|null>(null);
  const [tab,setTab]=useState<Tab>("character");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");
  const [shopFilter,setShopFilter]=useState("all");
  const [carRotation,setCarRotation]=useState(0);
  const [entering,setEntering]=useState(false);
  const [inCar,setInCar]=useState(false);
  const carDrag=useRef<{x:number;rotation:number}|null>(null);

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
    setBusy(product.id);setMessage("");
    try{
      const r=await fetch(API_BASE+"/api/avatar-world/purchase",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({itemId:product.id})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not unlock that.");
      setPayload(d);setMessage("Unlocked "+product.name+"!");
    }catch(error:any){setMessage(error.message||"Could not unlock that.");}
    finally{setBusy("");}
  };

  const allItems=useMemo(()=>[...FREE_ITEMS,...(payload?.catalog||[])],[payload]);
  const owned=(id:string)=>FREE_ITEMS.some(x=>x.id===id)||!!payload?.state.purchased.includes(id);
  const getItem=(id:string)=>allItems.find(x=>x.id===id);
  const shopItems=(payload?.catalog||[]).filter(x=>shopFilter==="all"||x.type===shopFilter);

  if(loading)return <main className="min-h-screen bg-slate-950 text-white grid place-items-center"><div className="text-center"><div className="w-14 h-14 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"/><p className="font-black mt-4">Loading Avatar World…</p></div></main>;
  if(!payload)return <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-6"><div className="text-center"><p className="text-xl font-black">{message||"Avatar World is unavailable."}</p><button onClick={()=>navigate("/library")} className="mt-4 rounded-2xl bg-white text-slate-950 px-5 py-3 font-black">Back to Library</button></div></main>;

  const carId=payload.state.equipped.car||"car-none";
  const homeId=payload.state.equipped.home||"home-basic";
  const quizzesIntoLevel=payload.economy.quizzesTaken%2;

  const pickLook=(key:keyof Look,value:string)=>customize({action:"look",look:{[key]:value}});
  const equip=(slot:string,itemId:string)=>customize({action:"equip",slot,itemId});

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554,#0f172a_50%,#020617)] text-white">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-3 flex items-center gap-3">
        <button onClick={()=>navigate("/library")} className="min-h-12 rounded-2xl bg-white/10 border border-white/15 px-3 font-black flex items-center gap-2"><ArrowLeft className="w-5 h-5"/> Library</button>
        <div className="flex-1 min-w-0"><p className="text-[10px] font-black tracking-[.28em] text-cyan-300">A.R.I.S.E.</p><h1 className="text-lg sm:text-2xl font-black truncate">Avatar World</h1></div>
        <div className="rounded-2xl bg-amber-400/10 border border-amber-300/30 px-3 py-2 text-center"><div className="text-[10px] font-black text-amber-200">COINS</div><div className="font-black text-amber-300">{payload.economy.wallet.toLocaleString()}</div></div>
        <div className="rounded-2xl bg-violet-500/10 border border-violet-300/30 px-3 py-2 text-center"><div className="text-[10px] font-black text-violet-200">LEVEL</div><div className="font-black text-xl">{payload.economy.level}</div></div>
      </div>
    </header>

    <section className="max-w-7xl mx-auto px-3 sm:px-5 pt-5">
      <div className="rounded-[2rem] border border-cyan-300/20 bg-gradient-to-r from-cyan-400/10 via-violet-500/10 to-fuchsia-500/10 p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-black tracking-widest text-cyan-300">YOUR CHARACTER. YOUR READING PROGRESS.</p>
            <h2 className="text-2xl sm:text-3xl font-black mt-1">{user?.displayName||"Reader"}, build your world.</h2>
            <p className="text-white/65 font-bold mt-1">Every completed quiz earns <span className="text-amber-300">100 Reader Coins</span>. Every new level adds <span className="text-amber-300">150 bonus coins</span>.</p>
          </div>
          <div className="min-w-[260px]">
            <div className="flex justify-between text-xs font-black mb-1"><span>{payload.economy.quizzesTaken} quizzes</span><span>{payload.economy.nextLevelAt?payload.economy.nextLevelAt+" for Level "+(payload.economy.level+1):"MAX LEVEL"}</span></div>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500" style={{width:payload.economy.nextLevelAt?(quizzesIntoLevel/2)*100+"%":"100%"}}/></div>
          </div>
        </div>
      </div>

      <nav className="mt-4 grid grid-cols-4 gap-2 rounded-3xl bg-white/5 border border-white/10 p-2">
        {([
          ["character",UserRound,"Character"],["shop",ShoppingBag,"Shop"],["garage",Car,"Garage"],["home",Home,"Home"]
        ] as const).map(([id,Icon,label])=><button key={id} onClick={()=>setTab(id)} className={"min-h-16 rounded-2xl font-black flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 "+(tab===id?"bg-white text-slate-950 shadow-lg":"text-white/70 hover:bg-white/10")}><Icon className="w-5 h-5"/>{label}</button>)}
      </nav>
      {message&&<div className="mt-3 rounded-2xl bg-white/10 border border-white/15 p-3 text-center font-black flex items-center justify-center gap-2">{message}<button onClick={()=>setMessage("")}><X className="w-4 h-4"/></button></div>}
    </section>

    {tab==="character"&&<section className="max-w-7xl mx-auto p-3 sm:p-5">
      <div className="grid lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,.92fr)] gap-5 items-start">
        <div className="rounded-[2rem] overflow-hidden border border-white/10 bg-slate-950 shadow-2xl">
          <div className="px-5 pt-5 pb-3 border-b border-white/10">
            <p className="text-xs font-black tracking-widest text-cyan-300">CHARACTER STUDIO</p>
            <h2 className="text-2xl font-black mt-1">Build your player</h2>
            <p className="text-sm text-white/55 font-bold mt-1">Use FACE to inspect details closely, or FULL BODY to check the complete look. The viewer stays contained on this card.</p>
          </div>
          <div className="h-[460px] sm:h-[540px] lg:h-[590px]">
            <ARISEAvatar3D look={payload.state.look} equipped={payload.state.equipped} className="w-full h-full" initialView="face"/>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-[2rem] bg-white/5 border border-white/10 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-cyan-300 text-slate-950 grid place-items-center font-black">1</div>
              <div><h3 className="text-xl font-black">Face</h3><p className="text-xs font-bold text-white/45">Skin, structure, brows and eyes</p></div>
            </div>

            <p className="text-[11px] font-black text-white/45 mt-5 tracking-wider">SKIN TONE</p>
            <div className="grid grid-cols-9 gap-2 mt-2">
              {["#f4c7a1","#e7b184","#d89a73","#b97750","#9b6244","#74432e","#5b3326","#4c2a20","#2e1a16"].map(v=><button key={v} onClick={()=>pickLook("skin",v)} className={"aspect-square rounded-full border-[3px] transition-transform "+(payload.state.look.skin===v?"border-cyan-300 scale-110":"border-white/15 hover:scale-105")} style={{background:v}} aria-label="Skin tone"/>)}
            </div>

            <p className="text-[11px] font-black text-white/45 mt-5 tracking-wider">FACE SHAPE</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">{["oval","round","square","long"].map(v=><button key={v} onClick={()=>pickLook("face",v)} className={"min-h-11 rounded-xl font-black capitalize "+(payload.state.look.face===v?"bg-cyan-300 text-slate-950":"bg-white/10 hover:bg-white/15")}>{v}</button>)}</div>

            <p className="text-[11px] font-black text-white/45 mt-5 tracking-wider">BROWS</p>
            <div className="grid grid-cols-3 gap-2 mt-2">{["natural","straight","bold"].map(v=><button key={v} onClick={()=>pickLook("brows",v)} className={"min-h-11 rounded-xl font-black capitalize "+(payload.state.look.brows===v?"bg-cyan-300 text-slate-950":"bg-white/10 hover:bg-white/15")}>{v}</button>)}</div>

            <p className="text-[11px] font-black text-white/45 mt-5 tracking-wider">EYE COLOR</p>
            <div className="flex flex-wrap gap-2 mt-2">{["#2b1a12","#3f2a1d","#5b3b24","#305b66","#475569","#355b39"].map(v=><button key={v} onClick={()=>pickLook("eyeColor",v)} className={"w-10 h-10 rounded-full border-[3px] transition-transform "+(payload.state.look.eyeColor===v?"border-cyan-300 scale-110":"border-white/15")} style={{background:v}} aria-label="Eye color"/>)}</div>
          </section>

          <section className="rounded-[2rem] bg-white/5 border border-white/10 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-violet-300 text-slate-950 grid place-items-center font-black">2</div>
              <div><h3 className="text-xl font-black">Hair & build</h3><p className="text-xs font-bold text-white/45">Change the silhouette and style</p></div>
            </div>

            <p className="text-[11px] font-black text-white/45 mt-5 tracking-wider">HAIR STYLE</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">{["fade","curls","locs","waves","afro","braids","short","buzz"].map(v=><button key={v} onClick={()=>pickLook("hair",v)} className={"min-h-11 rounded-xl font-black capitalize "+(payload.state.look.hair===v?"bg-violet-300 text-slate-950":"bg-white/10 hover:bg-white/15")}>{v}</button>)}</div>

            <p className="text-[11px] font-black text-white/45 mt-5 tracking-wider">HAIR COLOR</p>
            <div className="flex flex-wrap gap-2 mt-2">{["#111111","#171717","#2a1b13","#3b2417","#6b3d24","#8f6545","#b5814e"].map(v=><button key={v} onClick={()=>pickLook("hairColor",v)} className={"w-10 h-10 rounded-full border-[3px] "+(payload.state.look.hairColor===v?"border-violet-300 scale-110":"border-white/15")} style={{background:v}} aria-label="Hair color"/>)}</div>

            <p className="text-[11px] font-black text-white/45 mt-5 tracking-wider">BODY BUILD</p>
            <div className="grid grid-cols-3 gap-2 mt-2">{["slim","athletic","broad"].map(v=><button key={v} onClick={()=>pickLook("build",v)} className={"min-h-11 rounded-xl font-black capitalize "+(payload.state.look.build===v?"bg-violet-300 text-slate-950":"bg-white/10 hover:bg-white/15")}>{v}</button>)}</div>
          </section>

          <section className="rounded-[2rem] bg-white/5 border border-white/10 p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-amber-300 text-slate-950 grid place-items-center font-black">3</div>
              <div><h3 className="text-xl font-black">Style</h3><p className="text-xs font-bold text-white/45">Equip the things you own</p></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {["top","bottom","shoes","hat","glasses","accessory"].map(slot=>{
                const equippedItem=getItem(payload.state.equipped[slot]);
                const count=allItems.filter(x=>x.type===slot&&owned(x.id)).length;
                return <button key={slot} onClick={()=>{setTab("shop");setShopFilter(slot);}} className="rounded-2xl bg-white/5 border border-white/10 p-4 text-left hover:bg-white/10 transition-colors">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{slot}</p>
                  <p className="font-black mt-1">{equippedItem?.name||"None"}</p>
                  <p className="text-xs font-bold text-amber-300 mt-2">{count} owned · Open shop →</p>
                </button>;
              })}
            </div>

            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              {["hat","glasses","accessory"].map(slot=>{
                const ownedItems=[{id:"",type:slot,name:"None",price:0,rarity:"starter"},...allItems.filter(x=>x.type===slot&&owned(x.id))];
                return <div key={slot} className="rounded-2xl bg-black/15 border border-white/10 p-3">
                  <p className="text-[10px] font-black uppercase text-white/40 mb-2">{slot}</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">{ownedItems.map(product=><button key={product.id||"none"} onClick={()=>equip(slot,product.id)} className={"min-w-max rounded-xl px-3 py-2 text-xs font-black "+(payload.state.equipped[slot]===product.id?"bg-cyan-300 text-slate-950":"bg-white/10")}>{product.name}</button>)}</div>
                </div>;
              })}
            </div>
          </section>
        </div>
      </div>
    </section>}

    {tab==="shop"&&<section className="max-w-7xl mx-auto p-3 sm:p-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1"><p className="text-xs font-black tracking-widest text-amber-300">EARNED THROUGH READING</p><h2 className="text-3xl font-black">Avatar & World Shop</h2><p className="text-white/60 font-bold mt-1">No real money. Students unlock everything with Reader Coins earned from quizzes.</p></div>
        <div className="rounded-2xl bg-amber-400 text-slate-950 px-4 py-3 font-black flex items-center gap-2"><Coins className="w-5 h-5"/>{payload.economy.wallet.toLocaleString()} coins</div>
      </div>
      <div className="flex gap-2 overflow-x-auto mt-4 pb-2">{["all","top","bottom","shoes","hat","glasses","accessory","car","home","furniture"].map(filter=><button key={filter} onClick={()=>setShopFilter(filter)} className={"min-w-max rounded-full px-4 py-2 font-black capitalize "+(shopFilter===filter?"bg-white text-slate-950":"bg-white/10 text-white/70")}>{filter}</button>)}</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
        {shopItems.map(product=>{
          const isOwned=owned(product.id),canAfford=payload.economy.wallet>=product.price;
          const icon=product.type==="car"?"🏎️":product.type==="home"?"🏡":product.type==="furniture"?"🛋️":product.type==="hat"?"🧢":product.type==="glasses"?"🕶️":product.type==="shoes"?"👟":product.type==="accessory"?"🎧":"🧥";
          return <article key={product.id} className={"rounded-[2rem] overflow-hidden border-2 bg-gradient-to-br "+(rarityClass[product.rarity]||rarityClass.common)}>
            <div className="h-44 grid place-items-center bg-black/25 relative"><div className="text-7xl">{icon}</div><span className="absolute top-3 right-3 rounded-full bg-black/40 px-3 py-1 text-[10px] font-black uppercase">{product.rarity}</span></div>
            <div className="p-4 bg-slate-950/85"><h3 className="text-lg font-black">{product.name}</h3><p className="text-xs font-black text-white/45 uppercase">{product.type}</p>
              <button disabled={isOwned||!canAfford||busy===product.id} onClick={()=>purchase(product)} className={"mt-4 w-full min-h-12 rounded-xl font-black flex items-center justify-center gap-2 "+(isOwned?"bg-emerald-500/20 text-emerald-300":canAfford?"bg-amber-400 text-slate-950":"bg-white/10 text-white/40")}>{isOwned?<><Check className="w-5 h-5"/>OWNED</>:canAfford?<><Coins className="w-5 h-5"/>{busy===product.id?"UNLOCKING…":product.price}</>:<><Lock className="w-5 h-5"/>{product.price}</>}</button>
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
            <div className="absolute inset-x-0 top-[12%] flex justify-center z-10" onPointerDown={e=>{carDrag.current={x:e.clientX,rotation:carRotation};e.currentTarget.setPointerCapture?.(e.pointerId);}} onPointerMove={e=>{if(carDrag.current)setCarRotation(carDrag.current.rotation+(e.clientX-carDrag.current.x)*.7);}} onPointerUp={()=>carDrag.current=null} onPointerCancel={()=>carDrag.current=null}><div className="touch-none cursor-grab active:cursor-grabbing"><CarStage id={carId} rotation={carRotation}/></div></div>
            <div className={"absolute left-[4%] bottom-[1%] w-[290px] h-[430px] z-10 transition-all duration-1000 "+(entering?"translate-x-[360px] scale-[.55] opacity-25":"")}><ARISEAvatar3D look={payload.state.look} equipped={payload.state.equipped} compact className="w-full h-full rounded-3xl overflow-hidden"/></div>
            {inCar&&<div className="absolute inset-x-0 bottom-[8%] z-20 flex justify-center"><div className="rounded-3xl bg-black/65 backdrop-blur px-6 py-4 text-center border border-cyan-300/20"><h3 className="text-xl font-black">Your character is in the car.</h3><p className="text-white/55 text-sm font-bold">Drag the car above for the 360° view.</p></div></div>}
            <div className="absolute right-5 bottom-5 z-30 flex gap-2">{!inCar?<button disabled={entering} onClick={()=>{setEntering(true);window.setTimeout(()=>setInCar(true),1000);}} className="min-h-14 rounded-2xl bg-cyan-300 text-slate-950 px-5 font-black">{entering?"GETTING IN…":"GET IN CAR"}</button>:<button onClick={()=>{setInCar(false);setEntering(false);}} className="min-h-14 rounded-2xl bg-white text-slate-950 px-5 font-black">GET OUT</button>}<button onClick={()=>setCarRotation(0)} className="min-h-14 w-14 rounded-2xl bg-white/10 border border-white/15 grid place-items-center"><RotateCcw/></button></div>
          </>}
        </div>
        <aside className="space-y-3"><h3 className="text-xl font-black">My Cars</h3>{allItems.filter(x=>x.type==="car"&&owned(x.id)).map(car=><button key={car.id} onClick={()=>equip("car",car.id)} className={"w-full rounded-2xl border p-4 text-left "+(carId===car.id?"bg-cyan-400 text-slate-950 border-cyan-200":"bg-white/5 border-white/10")}><strong className="block">{car.name}</strong><span className="text-xs font-black opacity-60 uppercase">{car.rarity}</span></button>)}<button onClick={()=>{setTab("shop");setShopFilter("car");}} className="w-full min-h-14 rounded-2xl bg-amber-400 text-slate-950 font-black">UNLOCK MORE CARS</button></aside>
      </div>
    </section>}

    {tab==="home"&&<section className="max-w-7xl mx-auto p-3 sm:p-5">
      <div className="grid lg:grid-cols-[1fr_340px] gap-5">
        <div className={"min-h-[680px] rounded-[2.5rem] border border-white/10 relative overflow-hidden "+(homeId==="home-modern"?"bg-[linear-gradient(180deg,#7dd3fc_0_36%,#e2e8f0_36%_39%,#d6d3d1_39%)]":homeId==="home-loft"?"bg-[linear-gradient(180deg,#111827_0_58%,#4c1d95_58%_61%,#292524_61%)]":homeId==="home-studio"?"bg-[linear-gradient(180deg,#334155_0_58%,#0f766e_58%_61%,#1f2937_61%)]":"bg-[linear-gradient(180deg,#dbeafe_0_58%,#f8fafc_58%_61%,#cbd5e1_61%)]")}>
          <div className="absolute top-5 left-5 z-20"><p className="text-xs font-black text-cyan-300 drop-shadow">MY HOME</p><h2 className="text-3xl font-black drop-shadow">{getItem(homeId)?.name||"Starter Room"}</h2></div>
          <div className="absolute left-[8%] bottom-[12%] w-[42%] h-[24%] rounded-[2rem] bg-slate-700 shadow-2xl"><div className="absolute -top-5 left-6 right-6 h-12 rounded-2xl bg-slate-600"/></div>
          <div className="absolute right-[8%] bottom-[13%] w-[28%] h-[25%] bg-amber-950 rounded-xl shadow-2xl"><div className="absolute -top-[60%] left-[10%] right-[10%] h-[62%] bg-slate-900 rounded-t-xl"><div className="absolute inset-[8%] bg-gradient-to-br from-cyan-400 to-violet-600"/></div></div>
          {payload.state.furniture.includes("furniture-books")&&<div className="absolute right-[3%] top-[18%] w-[22%] h-[38%] bg-amber-950 p-2 grid grid-rows-4 gap-2 shadow-2xl">{[0,1,2,3].map(i=><div key={i} className="bg-gradient-to-r from-cyan-400 via-amber-300 to-fuchsia-400"/>)}</div>}
          {payload.state.furniture.includes("furniture-neon")&&<div className="absolute left-[8%] top-[22%] text-3xl sm:text-5xl font-black text-cyan-300 drop-shadow-[0_0_16px_rgba(34,211,238,.8)]">READ • RISE • REPEAT</div>}
          {payload.state.furniture.includes("furniture-sofa")&&<div className="absolute left-[30%] bottom-[9%] w-[34%] h-[20%] rounded-[2rem] bg-violet-600 border-t-[18px] border-violet-400 shadow-2xl"/>}
          <div className="absolute right-[2%] bottom-[1%] w-[310px] h-[450px] z-10"><ARISEAvatar3D look={payload.state.look} equipped={payload.state.equipped} compact className="w-full h-full rounded-3xl overflow-hidden"/></div>
        </div>
        <aside className="space-y-3"><h3 className="text-xl font-black">My Places</h3>{allItems.filter(x=>x.type==="home"&&owned(x.id)).map(home=><button key={home.id} onClick={()=>equip("home",home.id)} className={"w-full rounded-2xl p-4 border text-left "+(homeId===home.id?"bg-cyan-400 text-slate-950 border-cyan-200":"bg-white/5 border-white/10")}><strong>{home.name}</strong><span className="block text-xs font-black opacity-60 uppercase">{home.rarity}</span></button>)}
          <h3 className="text-xl font-black pt-3">Furniture</h3>{(payload.catalog||[]).filter(x=>x.type==="furniture"&&owned(x.id)).map(furn=>{const active=payload.state.furniture.includes(furn.id);return <button key={furn.id} onClick={()=>customize({action:"furniture",itemIds:active?payload.state.furniture.filter(id=>id!==furn.id):[...payload.state.furniture,furn.id]})} className={"w-full rounded-2xl p-4 border text-left "+(active?"bg-emerald-400 text-slate-950 border-emerald-200":"bg-white/5 border-white/10")}><div className="flex items-center justify-between"><strong>{furn.name}</strong>{active&&<Check className="w-5 h-5"/>}</div></button>})}
          <button onClick={()=>{setTab("shop");setShopFilter("home");}} className="w-full min-h-14 rounded-2xl bg-amber-400 text-slate-950 font-black">UPGRADE MY HOME</button>
          <button onClick={()=>{setTab("shop");setShopFilter("furniture");}} className="w-full min-h-14 rounded-2xl bg-white text-slate-950 font-black">SHOP FURNITURE</button>
        </aside>
      </div>
    </section>}

    <footer className="max-w-7xl mx-auto px-5 py-8 text-center text-white/40 text-xs font-bold">A.R.I.S.E. Avatar World is built into A.R.I.S.E. Reader. No outside avatar account, no weapons, no fighting, and no real-money purchases.</footer>
  </main>;
}
