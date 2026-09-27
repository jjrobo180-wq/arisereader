import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import {
  ArrowLeft, Car, Check, Coins, Home, Lock, RotateCcw, Save,
  ShoppingBag, UserRound, WandSparkles, X
} from "lucide-react";

type CatalogItem={id:string;type:string;name:string;price:number;rarity:string};
type Avatar3D={url:string;avatarId:string;provider:string;updatedAt:string};
type Payload={
  economy:{level:number;quizzesTaken:number;totalPoints:number;lifetimeCoins:number;wallet:number;nextLevelAt:number|null;coinsPerQuiz:number;levelBonus:number};
  state:{purchased:string[];equipped:Record<string,string>;furniture:string[];look:any;avatar3d:Avatar3D;spent:number};
  catalog:CatalogItem[];
};
type Tab="character"|"shop"|"garage"|"home";

const rarityClass:Record<string,string>={
  common:"from-slate-600 to-zinc-800 border-slate-400",
  rare:"from-sky-500 to-blue-800 border-sky-300",
  epic:"from-violet-500 to-fuchsia-800 border-violet-300",
  legendary:"from-amber-400 to-orange-700 border-amber-200",
};

const FREE_WORLD:CatalogItem[]=[
  {id:"car-none",type:"car",name:"No Car",price:0,rarity:"common"},
  {id:"home-basic",type:"home",name:"Starter Room",price:0,rarity:"common"},
];

function useModelViewer(){
  useEffect(()=>{
    if(customElements.get("model-viewer"))return;
    const existing=document.querySelector('script[data-arise-model-viewer="1"]');
    if(existing)return;
    const script=document.createElement("script");
    script.type="module";
    script.src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.3.1/model-viewer.min.js";
    script.setAttribute("data-arise-model-viewer","1");
    document.head.appendChild(script);
  },[]);
}

function RealAvatar({url,className=""}:{url:string;className?:string}){
  useModelViewer();
  if(!url)return <div className={"grid place-items-center bg-[radial-gradient(circle_at_top,#1e293b,#020617)] "+className}>
    <div className="text-center px-6"><div className="text-7xl">🧍</div><p className="mt-3 font-black text-white">Create your 3D character</p></div>
  </div>;
  return <div className={className}>
    {createElement("model-viewer" as any,{
      src:url,
      alt:"My 3D A.R.I.S.E. character",
      "camera-controls":"",
      "auto-rotate":"",
      "rotation-per-second":"18deg",
      "shadow-intensity":"1.4",
      "shadow-softness":"0.8",
      exposure:"1.05",
      "environment-image":"neutral",
      "camera-orbit":"0deg 80deg 2.4m",
      style:{width:"100%",height:"100%",background:"radial-gradient(circle at 50% 35%, #334155 0%, #0f172a 45%, #020617 100%)"}
    })}
  </div>;
}

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
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState("");
  const [showCreator,setShowCreator]=useState(false);
  const [creatorLoading,setCreatorLoading]=useState(false);
  const [creatorError,setCreatorError]=useState("");
  const [studioReload,setStudioReload]=useState(0);
  const [shopFilter,setShopFilter]=useState<"all"|"car"|"home"|"furniture">("all");
  const [carRotation,setCarRotation]=useState(0);
  const [entering,setEntering]=useState(false);
  const [inCar,setInCar]=useState(false);
  const creatorHostRef=useRef<HTMLDivElement|null>(null);
  const sdkRef=useRef<any>(null);
  const carDrag=useRef<{x:number;rotation:number}|null>(null);

  const load=async()=>{
    if(!token)return;
    setLoading(true);
    try{
      const r=await fetch(API_BASE+"/api/avatar-world",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not load Avatar World.");
      setPayload(d);
      if(!d?.state?.avatar3d?.url)setShowCreator(true);
    }catch(error:any){setMessage(error.message||"Could not load Avatar World.");}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[token]);

  const saveAvatarExport=async(result:any)=>{
    if(!token||!result?.url)return;
    setBusy("avatar-save");setMessage("");
    try{
      const r=await fetch(API_BASE+"/api/avatar-world/customize",{
        method:"POST",
        headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
        body:JSON.stringify({action:"avatar3d",avatar:{url:result.url,avatarId:result.avatarId||""}})
      });
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not save your 3D character.");
      setPayload(d);
      setShowCreator(false);
      setMessage("3D character saved!");
    }catch(error:any){setMessage(error.message||"Could not save your 3D character.");}
    finally{setBusy("");}
  };

  useEffect(()=>{
    if(!showCreator||tab!=="character"||!creatorHostRef.current)return;
    let cancelled=false;
    setCreatorLoading(true);
    setCreatorError("");
    creatorHostRef.current.innerHTML="";
    const boot=async()=>{
      try{
        const cdn="https://cdn.jsdelivr.net/npm/@avaturn/sdk@1.1.0/dist/index.js";
        const mod:any=await import(/* @vite-ignore */ cdn);
        if(cancelled)return;
        const sdk=new mod.AvaturnSDK();
        sdkRef.current=sdk;
        await sdk.init(creatorHostRef.current,{url:"https://demo.avaturn.dev",iframeClassName:"arise-avaturn-frame"});
        if(cancelled){sdk.destroy?.();return;}
        sdk.on("export",(result:any)=>{void saveAvatarExport(result);});
        setCreatorLoading(false);
      }catch{
        if(cancelled)return;
        setCreatorLoading(false);
        setCreatorError("The 3D character studio could not load.");
      }
    };
    void boot();
    return()=>{
      cancelled=true;
      try{sdkRef.current?.destroy?.();}catch{}
      sdkRef.current=null;
    };
  },[showCreator,tab,studioReload]);

  const exportNow=async()=>{
    if(!sdkRef.current)return;
    setBusy("avatar-export");setMessage("");
    try{
      const result=await sdkRef.current.exportAvatar();
      await saveAvatarExport(result);
    }catch{
      setMessage("Finish your character in the studio, then tap Save Character again.");
    }finally{setBusy("");}
  };

  const purchase=async(product:CatalogItem)=>{
    if(!token)return;
    setBusy(product.id);setMessage("");
    try{
      const r=await fetch(API_BASE+"/api/avatar-world/purchase",{
        method:"POST",
        headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
        body:JSON.stringify({itemId:product.id})
      });
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not unlock that.");
      setPayload(d);setMessage("Unlocked "+product.name+"!");
    }catch(error:any){setMessage(error.message||"Could not unlock that.");}
    finally{setBusy("");}
  };

  const customize=async(body:any)=>{
    if(!token)return;
    setBusy("customize");setMessage("");
    try{
      const r=await fetch(API_BASE+"/api/avatar-world/customize",{
        method:"POST",
        headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
        body:JSON.stringify(body)
      });
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not save.");
      setPayload(d);
    }catch(error:any){setMessage(error.message||"Could not save.");}
    finally{setBusy("");}
  };

  const allWorldItems=useMemo(()=>[...FREE_WORLD,...(payload?.catalog||[]).filter(x=>["car","home","furniture"].includes(x.type))],[payload]);
  const owned=(id:string)=>FREE_WORLD.some(x=>x.id===id)||!!payload?.state.purchased.includes(id);
  const getItem=(id:string)=>allWorldItems.find(x=>x.id===id);
  const shopItems=(payload?.catalog||[]).filter(x=>["car","home","furniture"].includes(x.type)&&(shopFilter==="all"||x.type===shopFilter));

  if(loading)return <main className="min-h-screen bg-slate-950 text-white grid place-items-center"><div className="text-center"><div className="w-14 h-14 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"/><p className="font-black mt-4">Loading Avatar World…</p></div></main>;
  if(!payload)return <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-6"><div className="text-center"><p className="text-xl font-black">{message||"Avatar World is unavailable."}</p><button onClick={()=>navigate("/library")} className="mt-4 rounded-2xl bg-white text-slate-950 px-5 py-3 font-black">Back to Library</button></div></main>;

  const avatarUrl=payload.state.avatar3d?.url||"";
  const carId=payload.state.equipped.car||"car-none";
  const homeId=payload.state.equipped.home||"home-basic";
  const quizzesIntoLevel=payload.economy.quizzesTaken%2;

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554,#0f172a_50%,#020617)] text-white">
    <style>{".arise-avaturn-frame{width:100%!important;height:100%!important;border:0!important;border-radius:24px!important;background:#020617!important;}"}</style>
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
            <p className="text-xs font-black tracking-widest text-cyan-300">QUIZZES POWER YOUR WORLD</p>
            <h2 className="text-2xl sm:text-3xl font-black mt-1">{user?.displayName||"Reader"}, level up your world.</h2>
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
      {message&&<div className="mt-3 rounded-2xl bg-white/10 border border-white/15 p-3 text-center font-black flex items-center justify-center gap-2">{message}<button onClick={()=>setMessage("")} aria-label="Dismiss"><X className="w-4 h-4"/></button></div>}
    </section>

    {tab==="character"&&<section className="max-w-7xl mx-auto p-3 sm:p-5">
      {showCreator?<div className="rounded-[2.2rem] overflow-hidden border border-white/10 bg-slate-950 shadow-2xl">
        <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1"><p className="text-xs font-black tracking-widest text-cyan-300">REAL 3D CHARACTER STUDIO</p><h2 className="text-2xl sm:text-3xl font-black">Build a realistic player</h2><p className="text-sm font-bold text-white/55 mt-1">Use the 3D studio controls for face, body, hair, clothing, shoes and accessories. Rotate the model and see changes on the actual player.</p></div>
          <div className="flex gap-2">
            {avatarUrl&&<button onClick={()=>setShowCreator(false)} className="min-h-12 rounded-2xl bg-white/10 border border-white/15 px-4 font-black">Cancel</button>}
            <button disabled={!sdkRef.current||busy==="avatar-export"} onClick={exportNow} className="min-h-12 rounded-2xl bg-cyan-300 text-slate-950 px-5 font-black flex items-center gap-2 disabled:opacity-40"><Save className="w-5 h-5"/>{busy==="avatar-export"?"Saving…":"Save Character"}</button>
          </div>
        </div>
        <div className="relative h-[72dvh] min-h-[620px] bg-slate-950">
          {creatorLoading&&<div className="absolute inset-0 z-10 grid place-items-center bg-slate-950"><div className="text-center"><div className="w-14 h-14 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"/><p className="mt-4 font-black">Loading high-quality 3D studio…</p></div></div>}
          {creatorError&&<div className="absolute inset-0 z-20 grid place-items-center bg-slate-950 p-6"><div className="max-w-md text-center"><div className="text-6xl">🛠️</div><p className="mt-3 text-xl font-black">{creatorError}</p><button onClick={()=>setStudioReload(v=>v+1)} className="mt-4 rounded-2xl bg-cyan-300 text-slate-950 px-5 py-3 font-black">Reload Studio</button></div></div>}
          <div ref={creatorHostRef} className="absolute inset-0 p-2 sm:p-3"/>
        </div>
      </div>
      :<div className="grid lg:grid-cols-[1fr_390px] gap-5">
        <div className="rounded-[2.5rem] overflow-hidden border border-white/10 bg-slate-950 min-h-[650px] shadow-2xl">
          <RealAvatar url={avatarUrl} className="w-full h-[650px]"/>
        </div>
        <aside className="space-y-4">
          <div className="rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 to-violet-500/10 p-5">
            <div className="w-14 h-14 rounded-2xl bg-cyan-300 text-slate-950 grid place-items-center"><WandSparkles className="w-7 h-7"/></div>
            <h3 className="text-2xl font-black mt-4">My 3D Player</h3>
            <p className="text-white/60 font-bold mt-2">Drag to rotate. Pinch or scroll to zoom. Your saved player stays centered on screen.</p>
            <button onClick={()=>setShowCreator(true)} className="mt-5 w-full min-h-14 rounded-2xl bg-white text-slate-950 font-black">{avatarUrl?"EDIT 3D CHARACTER":"CREATE 3D CHARACTER"}</button>
          </div>
          <div className="rounded-[2rem] bg-white/5 border border-white/10 p-5">
            <h3 className="font-black text-lg">No more fake character buttons</h3>
            <p className="text-sm text-white/55 font-bold mt-2">Hair, face, body, clothing, shoes and accessories are changed inside the real 3D Studio so every control edits the actual model.</p>
          </div>
        </aside>
      </div>}
    </section>}

    {tab==="shop"&&<section className="max-w-7xl mx-auto p-3 sm:p-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1"><p className="text-xs font-black tracking-widest text-amber-300">QUIZ REWARDS</p><h2 className="text-3xl font-black">World Shop</h2><p className="text-white/60 font-bold mt-1">Spend Reader Coins on cars, homes and room upgrades. Character appearance is customized in the 3D Studio.</p></div>
        <div className="rounded-2xl bg-amber-400 text-slate-950 px-4 py-3 font-black flex items-center gap-2"><Coins className="w-5 h-5"/>{payload.economy.wallet.toLocaleString()} coins</div>
      </div>
      <div className="flex gap-2 overflow-x-auto mt-4 pb-2">{(["all","car","home","furniture"] as const).map(filter=><button key={filter} onClick={()=>setShopFilter(filter)} className={"min-w-max rounded-full px-4 py-2 font-black capitalize "+(shopFilter===filter?"bg-white text-slate-950":"bg-white/10 text-white/70")}>{filter==="all"?"All":filter}</button>)}</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
        {shopItems.map(product=>{
          const isOwned=owned(product.id);
          const canAfford=payload.economy.wallet>=product.price;
          return <article key={product.id} className={"rounded-[2rem] overflow-hidden border-2 bg-gradient-to-br "+(rarityClass[product.rarity]||rarityClass.common)}>
            <div className="h-44 grid place-items-center bg-black/25 relative">
              <div className="text-7xl drop-shadow-xl">{product.type==="car"?"🏎️":product.type==="home"?"🏡":"🛋️"}</div>
              <span className="absolute top-3 right-3 rounded-full bg-black/40 px-3 py-1 text-[10px] font-black uppercase tracking-widest">{product.rarity}</span>
            </div>
            <div className="p-4 bg-slate-950/85">
              <h3 className="text-lg font-black">{product.name}</h3>
              <p className="text-xs font-black text-white/45 uppercase">{product.type}</p>
              <button disabled={isOwned||!canAfford||busy===product.id} onClick={()=>purchase(product)} className={"mt-4 w-full min-h-12 rounded-xl font-black flex items-center justify-center gap-2 "+(isOwned?"bg-emerald-500/20 text-emerald-300":canAfford?"bg-amber-400 text-slate-950":"bg-white/10 text-white/40")}>
                {isOwned?<><Check className="w-5 h-5"/>OWNED</>:canAfford?<><Coins className="w-5 h-5"/>{busy===product.id?"UNLOCKING…":product.price}</>:<><Lock className="w-5 h-5"/>{product.price}</>}
              </button>
            </div>
          </article>;
        })}
      </div>
    </section>}

    {tab==="garage"&&<section className="max-w-7xl mx-auto p-3 sm:p-5">
      <div className="grid lg:grid-cols-[1fr_360px] gap-5">
        <div className="min-h-[660px] rounded-[2.5rem] overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_50%_40%,#1e3a8a_0,#0f172a_45%,#020617_100%)] relative">
          <div className="absolute inset-x-0 bottom-0 h-[34%] bg-[linear-gradient(#334155,#111827)] opacity-85"/>
          <div className="absolute top-5 left-5 z-20"><p className="text-xs font-black text-cyan-300">MY GARAGE</p><h2 className="text-3xl font-black">{getItem(carId)?.name||"No car equipped"}</h2></div>
          {carId==="car-none"?<div className="absolute inset-0 grid place-items-center"><div className="text-center"><div className="text-8xl">🏁</div><h3 className="text-2xl font-black mt-3">Your garage is empty.</h3><button onClick={()=>{setTab("shop");setShopFilter("car");}} className="mt-4 rounded-2xl bg-amber-400 text-slate-950 px-5 py-3 font-black">Shop Cars</button></div></div>
          :<>
            <div className="absolute inset-x-0 top-[15%] flex justify-center z-10" onPointerDown={e=>{carDrag.current={x:e.clientX,rotation:carRotation};e.currentTarget.setPointerCapture?.(e.pointerId);}} onPointerMove={e=>{if(carDrag.current)setCarRotation(carDrag.current.rotation+(e.clientX-carDrag.current.x)*.7);}} onPointerUp={()=>carDrag.current=null} onPointerCancel={()=>carDrag.current=null}>
              <div className="touch-none cursor-grab active:cursor-grabbing"><CarStage id={carId} rotation={carRotation}/></div>
            </div>
            <div className={"absolute left-[7%] bottom-[2%] w-[260px] h-[390px] z-10 transition-all duration-1000 "+(entering?"translate-x-[330px] scale-[.62] opacity-30":"")}>
              <RealAvatar url={avatarUrl} className="w-full h-full rounded-3xl overflow-hidden"/>
            </div>
            {inCar&&<div className="absolute inset-x-0 bottom-[8%] z-20 flex justify-center"><div className="rounded-3xl bg-black/65 backdrop-blur px-6 py-4 text-center border border-cyan-300/20"><h3 className="text-xl font-black">Your player is in the car.</h3><p className="text-white/55 text-sm font-bold">Drag the car above to keep exploring the 360° view.</p></div></div>}
            <div className="absolute right-5 bottom-5 z-30 flex gap-2">
              {!inCar?<button disabled={entering||!avatarUrl} onClick={()=>{setEntering(true);window.setTimeout(()=>setInCar(true),1000);}} className="min-h-14 rounded-2xl bg-cyan-300 text-slate-950 px-5 font-black disabled:opacity-40">{entering?"GETTING IN…":"GET IN CAR"}</button>:<button onClick={()=>{setInCar(false);setEntering(false);}} className="min-h-14 rounded-2xl bg-white text-slate-950 px-5 font-black">GET OUT</button>}
              <button onClick={()=>setCarRotation(0)} className="min-h-14 w-14 rounded-2xl bg-white/10 border border-white/15 grid place-items-center"><RotateCcw/></button>
            </div>
          </>}
        </div>
        <aside className="space-y-3">
          <h3 className="text-xl font-black">My Cars</h3>
          {allWorldItems.filter(x=>x.type==="car"&&owned(x.id)).map(car=><button key={car.id} onClick={()=>customize({action:"equip",slot:"car",itemId:car.id})} className={"w-full rounded-2xl border p-4 text-left "+(carId===car.id?"bg-cyan-400 text-slate-950 border-cyan-200":"bg-white/5 border-white/10")}><strong className="block">{car.name}</strong><span className="text-xs font-black opacity-60 uppercase">{car.rarity}</span></button>)}
          <button onClick={()=>{setTab("shop");setShopFilter("car");}} className="w-full min-h-14 rounded-2xl bg-amber-400 text-slate-950 font-black">UNLOCK MORE CARS</button>
        </aside>
      </div>
    </section>}

    {tab==="home"&&<section className="max-w-7xl mx-auto p-3 sm:p-5">
      <div className="grid lg:grid-cols-[1fr_340px] gap-5">
        <div className={"min-h-[660px] rounded-[2.5rem] border border-white/10 relative overflow-hidden "+(homeId==="home-modern"?"bg-[linear-gradient(180deg,#7dd3fc_0_36%,#e2e8f0_36%_39%,#d6d3d1_39%)]":homeId==="home-loft"?"bg-[linear-gradient(180deg,#111827_0_58%,#4c1d95_58%_61%,#292524_61%)]":homeId==="home-studio"?"bg-[linear-gradient(180deg,#334155_0_58%,#0f766e_58%_61%,#1f2937_61%)]":"bg-[linear-gradient(180deg,#dbeafe_0_58%,#f8fafc_58%_61%,#cbd5e1_61%)]")}>
          <div className="absolute top-5 left-5 z-20"><p className="text-xs font-black text-cyan-300 drop-shadow">MY HOME</p><h2 className="text-3xl font-black drop-shadow">{getItem(homeId)?.name||"Starter Room"}</h2></div>
          <div className="absolute left-[8%] bottom-[12%] w-[42%] h-[24%] rounded-[2rem] bg-slate-700 shadow-2xl"><div className="absolute -top-5 left-6 right-6 h-12 rounded-2xl bg-slate-600"/></div>
          <div className="absolute right-[8%] bottom-[13%] w-[28%] h-[25%] bg-amber-950 rounded-xl shadow-2xl"><div className="absolute -top-[60%] left-[10%] right-[10%] h-[62%] bg-slate-900 rounded-t-xl"><div className="absolute inset-[8%] bg-gradient-to-br from-cyan-400 to-violet-600"/></div></div>
          {payload.state.furniture.includes("furniture-books")&&<div className="absolute right-[3%] top-[18%] w-[22%] h-[38%] bg-amber-950 p-2 grid grid-rows-4 gap-2 shadow-2xl">{[0,1,2,3].map(i=><div key={i} className="bg-gradient-to-r from-cyan-400 via-amber-300 to-fuchsia-400"/>)}</div>}
          {payload.state.furniture.includes("furniture-neon")&&<div className="absolute left-[8%] top-[22%] text-3xl sm:text-5xl font-black text-cyan-300 drop-shadow-[0_0_16px_rgba(34,211,238,.8)]">READ • RISE • REPEAT</div>}
          {payload.state.furniture.includes("furniture-sofa")&&<div className="absolute left-[30%] bottom-[9%] w-[34%] h-[20%] rounded-[2rem] bg-violet-600 border-t-[18px] border-violet-400 shadow-2xl"/>}
          <div className="absolute right-[3%] bottom-[3%] w-[270px] h-[420px] z-10"><RealAvatar url={avatarUrl} className="w-full h-full rounded-3xl overflow-hidden"/></div>
        </div>
        <aside className="space-y-3">
          <h3 className="text-xl font-black">My Places</h3>
          {allWorldItems.filter(x=>x.type==="home"&&owned(x.id)).map(home=><button key={home.id} onClick={()=>customize({action:"equip",slot:"home",itemId:home.id})} className={"w-full rounded-2xl p-4 border text-left "+(homeId===home.id?"bg-cyan-400 text-slate-950 border-cyan-200":"bg-white/5 border-white/10")}><strong>{home.name}</strong><span className="block text-xs font-black opacity-60 uppercase">{home.rarity}</span></button>)}
          <h3 className="text-xl font-black pt-3">Furniture</h3>
          {(payload.catalog||[]).filter(x=>x.type==="furniture"&&owned(x.id)).map(furn=>{
            const active=payload.state.furniture.includes(furn.id);
            return <button key={furn.id} onClick={()=>customize({action:"furniture",itemIds:active?payload.state.furniture.filter(id=>id!==furn.id):[...payload.state.furniture,furn.id]})} className={"w-full rounded-2xl p-4 border text-left "+(active?"bg-emerald-400 text-slate-950 border-emerald-200":"bg-white/5 border-white/10")}><div className="flex items-center justify-between"><strong>{furn.name}</strong>{active&&<Check className="w-5 h-5"/>}</div></button>;
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
