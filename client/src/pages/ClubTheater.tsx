import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ArrowLeft, Coins, Film, Popcorn, Volume2, VolumeX } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { getAvatarCharacter } from "@/lib/avatarCharacters";

type Movie = {
  id:string;
  title:string;
  subtitle:string;
  url:string;
  duration:number;
  license:string;
  attribution:string;
  age:string;
};
type TheaterPayload = {
  state:{movieId:string;startedAt:number};
  movies:Movie[];
  changeCost:number;
  wallet:number;
};
type ClubSelf={userId:number;displayName:string;characterId:string};

const SEATS=Array.from({length:12},(_,i)=>({id:"S"+(i+1),row:Math.floor(i/4),col:i%4}));

export default function ClubTheater(){
  const {token}=useAuth();
  const [,navigate]=useLocation();
  const mountRef=useRef<HTMLDivElement>(null);
  const videoRef=useRef<HTMLVideoElement>(null);
  const cameraRef=useRef<THREE.PerspectiveCamera|null>(null);
  const controlsRef=useRef<OrbitControls|null>(null);
  const selfRootRef=useRef<THREE.Group|null>(null);
  const targetRef=useRef(new THREE.Vector3(0,0,12));
  const keysRef=useRef(new Set<string>());
  const [payload,setPayload]=useState<TheaterPayload|null>(null);
  const [self,setSelf]=useState<ClubSelf|null>(null);
  const [muted,setMuted]=useState(true);
  const [seat,setSeat]=useState("S6");
  const [popcorn,setPopcorn]=useState<"idle"|"ordering"|"ready">("idle");
  const [picker,setPicker]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("Pick a seat, grab popcorn, and enjoy the show.");
  const headers=useMemo(()=>({Authorization:"Bearer "+token,"Content-Type":"application/json"}),[token]);

  const load=async()=>{
    if(!token)return;
    try{
      const [r,clubRes]=await Promise.all([
        fetch(API_BASE+"/api/club-theater",{headers:{Authorization:"Bearer "+token},cache:"no-store"}),
        fetch(API_BASE+"/api/club-arise/bootstrap",{headers:{Authorization:"Bearer "+token},cache:"no-store"})
      ]);
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not open the theater.");
      setPayload(d);
      if(clubRes.ok){const club=await clubRes.json();setSelf(club.self);}
    }catch(e:any){setNotice(e.message||"Could not open the theater.");}
  };

  useEffect(()=>{void load();},[token]);

  useEffect(()=>{
    if(!token)return;
    const timer=window.setInterval(()=>void load(),5000);
    return()=>window.clearInterval(timer);
  },[token]);

  const currentMovie=payload?.movies.find(m=>m.id===payload.state.movieId)||payload?.movies[0];

  const syncVideo=()=>{
    const video=videoRef.current;
    if(!video||!payload||!currentMovie)return;
    const elapsed=Math.max(0,(Date.now()-payload.state.startedAt)/1000);
    const target=elapsed%Math.max(1,currentMovie.duration);
    if(Number.isFinite(video.duration)&&video.duration>0){
      const wrapped=target%video.duration;
      if(Math.abs(video.currentTime-wrapped)>2.5)video.currentTime=wrapped;
    }else if(Math.abs(video.currentTime-target)>2.5)video.currentTime=target;
    video.muted=muted;
    void video.play().catch(()=>{});
  };

  useEffect(()=>{
    const video=videoRef.current;
    if(!video||!currentMovie)return;
    video.load();
    const onReady=()=>syncVideo();
    video.addEventListener("loadedmetadata",onReady);
    const timer=window.setInterval(syncVideo,12000);
    return()=>{video.removeEventListener("loadedmetadata",onReady);window.clearInterval(timer);};
  },[currentMovie?.id,payload?.state.startedAt,muted]);

  useEffect(()=>{
    const mount=mountRef.current;if(!mount)return;
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x05030a);
    const camera=new THREE.PerspectiveCamera(55,mount.clientWidth/Math.max(1,mount.clientHeight),.1,80);camera.position.set(0,4.2,13);cameraRef.current=camera;
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(mount.clientWidth,mount.clientHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;mount.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0x9b7cff,0x120817,1.1));
    const screenGlow=new THREE.PointLight(0x8bdcff,6,20);screenGlow.position.set(0,4,-7);scene.add(screenGlow);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(24,30),new THREE.MeshStandardMaterial({color:0x160b19,roughness:.85}));floor.rotation.x=-Math.PI/2;floor.position.z=2;scene.add(floor);
    const back=new THREE.Mesh(new THREE.BoxGeometry(24,10,.5),new THREE.MeshStandardMaterial({color:0x100912}));back.position.set(0,5,-8);scene.add(back);
    const screenFrame=new THREE.Mesh(new THREE.BoxGeometry(12.8,7.2,.35),new THREE.MeshStandardMaterial({color:0x0b0b14,metalness:.5,roughness:.25}));screenFrame.position.set(0,5,-7.65);scene.add(screenFrame);
    const inner=new THREE.Mesh(new THREE.PlaneGeometry(11.8,6.2),new THREE.MeshBasicMaterial({color:0x172033}));inner.position.set(0,5,-7.45);scene.add(inner);
    for(let row=0;row<3;row++)for(let col=0;col<4;col++){
      const root=new THREE.Group();root.position.set((col-1.5)*2.2,.25,2+row*2.5);scene.add(root);
      const cushion=new THREE.Mesh(new THREE.BoxGeometry(1.5,.45,1.45),new THREE.MeshStandardMaterial({color:0x7f1d1d,roughness:.6}));cushion.position.y=.45;root.add(cushion);
      const backrest=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.7,.35),new THREE.MeshStandardMaterial({color:0x991b1b,roughness:.55}));backrest.position.set(0,1.2,.52);backrest.rotation.x=-.08;root.add(backrest);
      const armMat=new THREE.MeshStandardMaterial({color:0x18181b,metalness:.25,roughness:.5});
      for(const x of [-.9,.9]){const arm=new THREE.Mesh(new THREE.BoxGeometry(.18,.55,1.25),armMat);arm.position.set(x,.65,0);root.add(arm);}
    }
    for(const x of [-10,10])for(const z of [-4,2,8]){const lamp=new THREE.PointLight(0xf59e0b,1.2,5);lamp.position.set(x,2.3,z);scene.add(lamp);}
    const resize=()=>{camera.aspect=mount.clientWidth/Math.max(1,mount.clientHeight);camera.updateProjectionMatrix();renderer.setSize(mount.clientWidth,mount.clientHeight);};window.addEventListener("resize",resize);
    let raf=0;const animate=()=>{renderer.render(scene,camera);raf=requestAnimationFrame(animate);};animate();
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);scene.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();if(m.material){(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>x.dispose());}});renderer.dispose();if(mount.contains(renderer.domElement))mount.removeChild(renderer.domElement);};
  },[]);

  useEffect(()=>{
    const camera=cameraRef.current;if(!camera)return;
    const s=SEATS.find(x=>x.id===seat);if(!s)return;
    const x=(s.col-1.5)*1.4;
    const z=6+s.row*1.6;
    camera.position.set(x,2.7,z);
    camera.lookAt(0,4.8,-7);
  },[seat]);

  const changeMovie=async(movieId:string)=>{
    if(!payload||busy)return;
    if(payload.wallet<payload.changeCost){setNotice("You need more Reader Coins to change the movie.");return;}
    setBusy(true);
    try{
      const r=await fetch(API_BASE+"/api/club-theater/change",{method:"POST",headers,body:JSON.stringify({movieId})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not change the movie.");
      setPayload(d);setPicker(false);setNotice("The new movie is starting for everyone in the theater.");
    }catch(e:any){setNotice(e.message||"Could not change the movie.");}
    finally{setBusy(false);}
  };

  const orderPopcorn=()=>{
    if(popcorn!=="idle")return;
    setPopcorn("ordering");setNotice("Popcorn is popping…");
    window.setTimeout(()=>{setPopcorn("ready");setNotice("🍿 Your popcorn is ready!");},1800);
  };

  return <main className="relative h-[100dvh] overflow-hidden bg-black text-white">
    <div ref={mountRef} className="absolute inset-0"/>
    <header className="absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-black/90 to-transparent p-2 sm:p-4">
      <button onClick={()=>navigate("/club-arise")} className="flex min-h-11 items-center gap-2 rounded-xl bg-black/70 px-3 font-black backdrop-blur"><ArrowLeft className="h-4 w-4"/> <span className="hidden sm:inline">Back to Club</span></button>
      <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.22em] text-amber-300">Club A.R.I.S.E.</p><h1 className="truncate text-lg font-black sm:text-2xl">🎬 Cinema Room</h1></div>
      <div className="flex items-center gap-1.5 rounded-xl border border-amber-300/25 bg-black/70 px-2.5 py-2 text-sm font-black"><Coins className="h-4 w-4 text-amber-300"/>{payload?.wallet?.toLocaleString()??"—"}</div>
    </header>

    <div className="absolute left-1/2 top-[14%] z-20 w-[min(760px,88vw)] -translate-x-1/2">
      <div className="overflow-hidden rounded-[1.2rem] border-4 border-slate-900 bg-black shadow-[0_0_60px_rgba(56,189,248,.28)]">
        {currentMovie?<video ref={videoRef} key={currentMovie.id} src={currentMovie.url} playsInline loop muted={muted} autoPlay preload="auto" onClick={()=>void videoRef.current?.play().catch(()=>{})} className="aspect-video w-full bg-black object-contain"/>:<div className="aspect-video grid place-items-center bg-slate-950"><Film className="h-12 w-12 text-white/30"/></div>}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 rounded-xl bg-black/70 px-3 py-2 backdrop-blur">
        <div className="min-w-0"><p className="truncate text-sm font-black">{currentMovie?.title||"Loading show…"}</p><p className="truncate text-[10px] font-bold text-white/55">{currentMovie?.subtitle}</p></div>
        <button type="button" onClick={()=>{const next=!muted;setMuted(next);if(videoRef.current){videoRef.current.muted=next;if(!next)void videoRef.current.play().catch(()=>{});}}} className="flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-white/10 px-3 text-xs font-black">{muted?<VolumeX className="h-4 w-4"/>:<Volume2 className="h-4 w-4"/>}{muted?"Hear movie":"Mute"}</button>
      </div>
    </div>

    <aside className="absolute bottom-2 left-2 right-2 z-30 rounded-2xl border border-white/10 bg-slate-950/92 p-2.5 shadow-2xl backdrop-blur-xl sm:left-4 sm:right-auto sm:w-[360px] sm:p-3">
      <div className="flex items-center justify-between gap-2">
        <div><p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Your theater seat</p><p className="text-sm font-black">Seat {seat}</p></div>
        <button onClick={orderPopcorn} disabled={popcorn!=="idle"} className="flex min-h-10 items-center gap-2 rounded-xl bg-amber-300 px-3 text-xs font-black text-slate-950 disabled:opacity-70"><Popcorn className="h-4 w-4"/>{popcorn==="ordering"?"Popping…":popcorn==="ready"?"🍿 Ready":"Order popcorn"}</button>
      </div>
      <div className="mt-2 grid grid-cols-6 gap-1.5">
        {SEATS.map(s=><button key={s.id} type="button" onClick={()=>{setSeat(s.id);setNotice("You sat down in seat "+s.id+".");}} className={"min-h-9 rounded-lg text-[10px] font-black "+(seat===s.id?"bg-cyan-300 text-slate-950":"bg-white/10 hover:bg-white/20")}>{s.id}</button>)}
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={()=>setPicker(true)} className="min-h-10 flex-1 rounded-xl bg-fuchsia-500/25 px-3 text-xs font-black ring-1 ring-fuchsia-300/25">Change movie · {payload?.changeCost??75} coins</button>
      </div>
      <p className="mt-2 text-[10px] font-semibold text-white/45">{notice}</p>
    </aside>

    <div className="absolute bottom-3 right-3 z-20 hidden max-w-[340px] rounded-xl bg-black/55 px-3 py-2 text-right text-[10px] font-bold text-white/45 sm:block">
      The theater channel keeps running even when nobody is inside. Screenings use open/Creative Commons media with attribution.
    </div>

    {picker&&payload&&<div className="absolute inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
      <section className="max-h-[88dvh] w-[min(620px,94vw)] overflow-auto rounded-[1.7rem] border border-white/10 bg-slate-950 p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-fuchsia-300">Now showing</p><h2 className="text-2xl font-black">Choose the next movie</h2><p className="mt-1 text-sm font-semibold text-white/55">Changing the movie costs {payload.changeCost} Reader Coins and changes it for everyone.</p></div><button onClick={()=>setPicker(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">×</button></div>
        <div className="mt-4 space-y-2">
          {payload.movies.map(movie=><button key={movie.id} onClick={()=>void changeMovie(movie.id)} disabled={busy||movie.id===payload.state.movieId} className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10 disabled:opacity-45">
            <div className="flex items-start justify-between gap-3"><div><p className="font-black">{movie.title}</p><p className="text-xs font-semibold text-white/55">{movie.subtitle} · {movie.age}</p></div>{movie.id===payload.state.movieId&&<span className="rounded-full bg-cyan-300 px-2 py-1 text-[9px] font-black text-slate-950">PLAYING</span>}</div>
            <p className="mt-2 text-[10px] font-bold text-amber-200/75">{movie.license} · {movie.attribution}</p>
          </button>)}
        </div>
      </section>
    </div>}
  </main>;
}
