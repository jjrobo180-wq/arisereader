import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ArrowLeft, BatteryCharging, Camera, DoorClosed, Eye, Flashlight, KeyRound, Search, Shield, Sparkles, Users, Volume2, VolumeX } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { HANDS, cueStage, type Hand, type Level, type LobbySummary, type Team, type View } from "@shared/boardQuest";

type RoomId="stage"|"arcade"|"party"|"kitchen"|"left-hall"|"right-hall";
const ROOMS:{id:RoomId;name:string;cam:string;hint:string}[]=[
 {id:"stage",name:"Moonlight Stage",cam:"CAM 01",hint:"The mascot show went dark here."},
 {id:"arcade",name:"Neon Arcade",cam:"CAM 02",hint:"Prize tickets and machines hide tiny clues."},
 {id:"party",name:"Party Room",cam:"CAM 03",hint:"Someone was here after closing."},
 {id:"kitchen",name:"Back Kitchen",cam:"CAM 04",hint:"The service door leads behind the scenes."},
 {id:"left-hall",name:"Left Hall",cam:"CAM 05",hint:"Listen for footsteps before you move."},
 {id:"right-hall",name:"Right Hall",cam:"CAM 06",hint:"The lights flicker near the control room."},
];
const ACTION_LABELS:Record<Hand,{title:string;sub:string}> = {
 rock:{title:"FLASH",sub:"Use the flashlight"},
 paper:{title:"HIDE",sub:"Duck behind cover"},
 scissors:{title:"DISTRACT",sub:"Trigger a sound away from you"},
};
const EVENT_TEXT:Record<string,{title:string;detail:string}> = {
 points:{title:"CLUE FOUND",detail:"Your team uncovered evidence and added it to the case board."},
 safe:{title:"SAFE CAMERA",detail:"The halls are quiet. You can investigate without triggering an alarm."},
 steal:{title:"RECOVERED EVIDENCE",detail:"You found a clue the other team missed."},
 shield:{title:"SECURITY PASS",detail:"A security pass will cancel your next alarm."},
 power:{title:"BATTERY PACK",detail:"Fresh flashlight batteries give your team an extra boost."},
 rps:{title:"MASCOT ENCOUNTER",detail:"A roaming mascot is close. Choose your move before it reaches the room."},
 bonus:{title:"SECRET FILE",detail:"You unlocked a hidden control-room file worth a major clue bonus."},
};

function mascot(scene:THREE.Scene,x:number,z:number,color:number,accent:number,name:string){
 const root=new THREE.Group();root.position.set(x,0,z);root.userData.name=name;
 const bodyMat=new THREE.MeshStandardMaterial({color,roughness:.56,metalness:.35});
 const dark=new THREE.MeshStandardMaterial({color:0x10151d,roughness:.42,metalness:.58});
 const glow=new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:.9,roughness:.3});
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.7,1.1,6,14),bodyMat);body.position.y=1.55;body.castShadow=true;root.add(body);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.76,20,16),bodyMat);head.position.y=2.95;head.castShadow=true;root.add(head);
 for(const ex of [-.26,.26]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),glow);eye.position.set(ex,3.02,.69);root.add(eye);}
 const mouth=new THREE.Mesh(new THREE.BoxGeometry(.5,.08,.08),dark);mouth.position.set(0,2.7,.71);root.add(mouth);
 for(const sx of [-.85,.85]){const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.14,.86,5,10),bodyMat);arm.position.set(sx,1.62,0);arm.rotation.z=sx<0?.18:-.18;root.add(arm);}
 for(const sx of [-.34,.34]){const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.18,.7,5,10),dark);leg.position.set(sx,.42,0);root.add(leg);}
 const badge=new THREE.Mesh(new THREE.TorusGeometry(.17,.05,8,20),glow);badge.position.set(0,1.8,.68);root.add(badge);
 scene.add(root);return root;
}

function MysteryScene({room,revision,alert,halloread}:{room:RoomId;revision:number;alert:boolean;halloread:boolean}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
   const mount=host.current;if(!mount)return;
   const scene=new THREE.Scene();scene.background=new THREE.Color(0x03060b);scene.fog=new THREE.Fog(0x050812,15,55);
   const camera=new THREE.PerspectiveCamera(57,1,.1,90);camera.position.set(0,6.2,15);camera.lookAt(0,2.3,0);
   const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(devicePixelRatio,1.55));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;mount.appendChild(renderer.domElement);

   scene.add(new THREE.HemisphereLight(0x5b6f9b,0x10131b,.8));
   const key=new THREE.SpotLight(alert?0xff334d:(halloread?0xff7a18:0x8be9ff),22,45,Math.PI/4,.35,1.4);key.position.set(0,10,8);key.target.position.set(0,1,0);scene.add(key,key.target);
   const amber=new THREE.PointLight(0xffa34d,6,25,1.8);amber.position.set(-7,4,-5);scene.add(amber);
   const violet=new THREE.PointLight(0x8b5cf6,halloread?9:5,24,1.8);violet.position.set(7,5,-8);scene.add(violet);
   if(halloread){
     const pumpkin=(x:number,z:number,scale=.65)=>{const g=new THREE.Group();const mat=new THREE.MeshStandardMaterial({color:0xf97316,emissive:0x7c2d12,emissiveIntensity:.45,roughness:.7});for(const dx of [-.22,0,.22]){const lobe=new THREE.Mesh(new THREE.SphereGeometry(.5,14,10),mat);lobe.scale.set(.8,1,.82);lobe.position.x=dx;g.add(lobe);}const stem=new THREE.Mesh(new THREE.CylinderGeometry(.07,.1,.3,8),new THREE.MeshStandardMaterial({color:0x365314}));stem.position.y=.58;g.add(stem);g.position.set(x,0,z);g.scale.setScalar(scale);scene.add(g);};
     pumpkin(-10,-7,.8);pumpkin(10,-7,.8);pumpkin(-11,5,.62);pumpkin(11,4,.62);
     for(const side of [-1,1]){
       const web=new THREE.Group(),mat=new THREE.LineBasicMaterial({color:0xe9d5ff,transparent:true,opacity:.5});
       for(let i=0;i<8;i++){const a=i*Math.PI/4;web.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(Math.cos(a)*2.2,Math.sin(a)*2.2,0)]),mat));}
       for(const rr of [.65,1.25,1.8,2.2]){const pts=[];for(let i=0;i<=28;i++){const a=i/28*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*rr,Math.sin(a)*rr,0));}web.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),mat));}
       web.position.set(side*12.5,6,-9.45);web.rotation.y=side<0?Math.PI/5:-Math.PI/5;scene.add(web);
     }
   }

   const floor=new THREE.Mesh(new THREE.PlaneGeometry(28,24),new THREE.MeshStandardMaterial({color:0x171b25,roughness:.72,metalness:.12}));
   floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
   for(let x=-12;x<=12;x+=2)for(let z=-10;z<=10;z+=2){
     if((x/2+z/2)%2===0){const tile=new THREE.Mesh(new THREE.PlaneGeometry(1.92,1.92),new THREE.MeshStandardMaterial({color:0x252a36,roughness:.77}));tile.rotation.x=-Math.PI/2;tile.position.set(x,.012,z);scene.add(tile);}
   }
   const back=new THREE.Mesh(new THREE.BoxGeometry(28,8,.35),new THREE.MeshStandardMaterial({color:0x101522,roughness:.82}));back.position.set(0,4,-10);scene.add(back);
   const leftWall=new THREE.Mesh(new THREE.BoxGeometry(.35,8,20),new THREE.MeshStandardMaterial({color:0x111827,roughness:.85}));leftWall.position.set(-14,4,0);scene.add(leftWall);
   const rightWall=leftWall.clone();rightWall.position.x=14;scene.add(rightWall);

   const labelCanvas=document.createElement("canvas");labelCanvas.width=1024;labelCanvas.height=200;const ctx=labelCanvas.getContext("2d")!;
   ctx.fillStyle="#090d16";ctx.fillRect(0,0,1024,200);ctx.strokeStyle=alert?"#ff4964":"#66e8ff";ctx.lineWidth=9;ctx.strokeRect(8,8,1008,184);ctx.fillStyle="#ffffff";ctx.font="900 76px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(ROOMS.find(r=>r.id===room)?.name.toUpperCase()||"CAMERA",512,100);
   const tex=new THREE.CanvasTexture(labelCanvas);tex.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(8.8,1.72),new THREE.MeshBasicMaterial({map:tex}));sign.position.set(0,6.2,-9.75);scene.add(sign);

   if(room==="stage"){
     const stage=new THREE.Mesh(new THREE.BoxGeometry(12,.7,5.2),new THREE.MeshStandardMaterial({color:0x2d163f,roughness:.65}));stage.position.set(0,.35,-5.7);scene.add(stage);
     for(const x of [-5.4,5.4]){const curtain=new THREE.Mesh(new THREE.BoxGeometry(1.4,7,.5),new THREE.MeshStandardMaterial({color:0x5b1434,roughness:.9}));curtain.position.set(x,3.5,-8.9);scene.add(curtain);}
     for(const x of [-3,0,3]){const lamp=new THREE.PointLight(x===0?0xfacc15:0xc084fc,4,10,2);lamp.position.set(x,5,-5);scene.add(lamp);}
   }else if(room==="arcade"){
     for(let i=0;i<6;i++){const cab=new THREE.Mesh(new THREE.BoxGeometry(2.2,3.2,1.6),new THREE.MeshStandardMaterial({color:0x111827,metalness:.45,roughness:.4}));cab.position.set(-8+(i%3)*8,1.6,-6+Math.floor(i/3)*7);scene.add(cab);const screen=new THREE.Mesh(new THREE.PlaneGeometry(1.65,1.05),new THREE.MeshBasicMaterial({color:[0x22d3ee,0xf472b6,0xfacc15][i%3]}));screen.position.set(cab.position.x,2.05,cab.position.z+.82);scene.add(screen);}
   }else if(room==="party"){
     for(const x of [-6,0,6]){const table=new THREE.Mesh(new THREE.CylinderGeometry(2,2,.22,28),new THREE.MeshStandardMaterial({color:0x475569,roughness:.55}));table.position.set(x,.9,-2);scene.add(table);const lamp=new THREE.PointLight(x===0?0xff88cc:0x67e8f9,3,8,2);lamp.position.set(x,3,-2);scene.add(lamp);}
     for(let i=0;i<10;i++){const balloon=new THREE.Mesh(new THREE.SphereGeometry(.28,12,10),new THREE.MeshStandardMaterial({color:[0xef4444,0xfacc15,0x22c55e,0x60a5fa][i%4],roughness:.4}));balloon.position.set(-9+i*2,4+(i%3)*.5,-6);scene.add(balloon);}
   }else if(room==="kitchen"){
     for(const x of [-7,0,7]){const counter=new THREE.Mesh(new THREE.BoxGeometry(5,1.8,2),new THREE.MeshStandardMaterial({color:0x64748b,metalness:.55,roughness:.38}));counter.position.set(x,.9,-3);scene.add(counter);}
     const red=new THREE.PointLight(0xff334d,4,12,2);red.position.set(7,5,-5);scene.add(red);
   }else{
     for(const x of [-9,-3,3,9]){const door=new THREE.Mesh(new THREE.BoxGeometry(2.8,5,.35),new THREE.MeshStandardMaterial({color:0x161d29,metalness:.22,roughness:.72}));door.position.set(x,2.5,-9.7);scene.add(door);const bar=new THREE.Mesh(new THREE.BoxGeometry(1.8,.1,.1),new THREE.MeshBasicMaterial({color:x%2?0x67e8f9:0xf59e0b}));bar.position.set(x,3,-9.48);scene.add(bar);}
   }

   const which=(revision+(room==="left-hall"?1:room==="right-hall"?2:0))%4;
   const bots:THREE.Group[]=[];
   if(which!==0)bots.push(mascot(scene,which===1?-5:which===2?0:5,-4,0x7c3aed,0xfacc15,"Orbit Owl"));
   if((revision+2)%5===0)bots.push(mascot(scene,6,-7,0x0f766e,0x67e8f9,"Moxie Moose"));
   if((revision+3)%7===0)bots.push(mascot(scene,-7,-6,0xbe185d,0xf9a8d4,"Pip Panda"));

   const resize=()=>{const w=mount.clientWidth,h=mount.clientHeight;camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();renderer.setSize(w,h)};resize();window.addEventListener("resize",resize);
   let raf=0;const clock=new THREE.Clock();const animate=()=>{const t=clock.getElapsedTime();bots.forEach((bot,i)=>{bot.rotation.y=Math.sin(t*.45+i)*.12;bot.position.y=Math.sin(t*1.15+i)*.035;});key.intensity=(alert?18:12)+(Math.sin(t*9)>0.86?8:0);renderer.render(scene,camera);raf=requestAnimationFrame(animate)};animate();
   return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);scene.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose?.();if(m.material){(Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>{if("map" in mat)(mat as THREE.MeshBasicMaterial).map?.dispose?.();mat.dispose();});}});renderer.dispose();mount.removeChild(renderer.domElement);};
 },[room,revision,alert,halloread]);
 return <div className="mm-feed relative h-full min-h-[340px] overflow-hidden rounded-[1.6rem] border border-cyan-300/20 bg-black shadow-2xl"><div ref={host} className="absolute inset-0"/><div className="mm-scan absolute inset-0 pointer-events-none"/><div className="absolute left-3 top-3 rounded-lg border border-white/15 bg-black/75 px-3 py-1.5 text-[10px] font-black tracking-[.2em] text-cyan-200">LIVE SECURITY FEED</div><div className="absolute right-3 top-3 h-2.5 w-2.5 animate-pulse rounded-full bg-red-500 shadow-[0_0_12px_#ef4444]"/></div>;
}

export default function MidnightMystery({halloread=false}:{halloread?:boolean}){
 const {user,token}=useAuth();const [,navigate]=useLocation();
 const [view,setView]=useState<View|null>(null),[level,setLevel]=useState<Level>("6-8"),[code,setCode]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[offline,setOffline]=useState(false),[lobbies,setLobbies]=useState<LobbySummary[]>([]),[now,setNow]=useState(Date.now()),[offset,setOffset]=useState(0),[sound,setSound]=useState(true),[manualCam,setManualCam]=useState<RoomId|null>(null);
 const requestLock=useRef(false),mounted=useRef(true),requestSerial=useRef(0),latestSerial=useRef(0),pollFailures=useRef(0),announcerCue=useRef("");
 const myId=Number(user?.id),current=view?.players[view.turn],myTurn=current?.id===myId,host=view?.hostId===myId,cue=view?.cue,stage=cueStage(cue||null,now);
 const roomFromSpace=(space=0)=>ROOMS[Math.abs(space)%ROOMS.length].id;
 const activeRoom=manualCam||roomFromSpace(cue?.to??current?.space??0);
 const roomInfo=ROOMS.find(r=>r.id===activeRoom)!;
 const sessionKey=`arise-midnight-room-${myId}`;

 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()+offset),100);return()=>clearInterval(timer)},[offset]);

 async function request(path:string,data?:unknown,base="rooms"){
   const start=Date.now(),serial=++requestSerial.current;
   const response=await fetch(`${API_BASE}/api/board-quest${base?"/"+base:""}${path}`,{method:data?"POST":"GET",headers:{Authorization:`Bearer ${token}`,...(data?{"Content-Type":"application/json"}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(10000)});
   let body:any={};try{body=await response.json()}catch{}
   if(!response.ok){const e=new Error(body.message||"Could not connect to Midnight Mystery.") as Error&{status?:number};e.status=response.status;throw e;}
   if(mounted.current&&serial>=latestSerial.current){latestSerial.current=serial;pollFailures.current=0;setOffset(body.serverNow-(start+Date.now())/2);setView(body);setOffline(false);sessionStorage.setItem(sessionKey,body.code);}
   return body as View;
 }
 useEffect(()=>{const saved=sessionStorage.getItem(sessionKey);if(saved&&token)request("/"+saved).catch(()=>{sessionStorage.removeItem(sessionKey);setView(null)})},[token,myId]);
 useEffect(()=>{if(!view?.code)return;let done=false,timer=0;const poll=async()=>{try{await request("/"+view.code)}catch(e){if(done)return;const status=(e as Error&{status?:number}).status;if(status===404||status===409){sessionStorage.removeItem(sessionKey);setView(null);setError((e as Error).message);return;}pollFailures.current++;if(pollFailures.current>=3)setOffline(true)}if(!done)timer=window.setTimeout(poll,1400)};timer=window.setTimeout(poll,1100);return()=>{done=true;clearTimeout(timer)}},[view?.code,token]);
 useEffect(()=>{if(view||!token)return;let stop=false;const refresh=async()=>{try{const r=await fetch(`${API_BASE}/api/board-quest/lobbies`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});if(r.ok&&!stop)setLobbies(await r.json())}catch{}};void refresh();const t=window.setInterval(refresh,3000);return()=>{stop=true;clearInterval(t)}},[!!view,token]);

 async function act(data:any){if(requestLock.current||!view)return;requestLock.current=true;setBusy(true);setError("");try{await request("/"+view.code+"/action",data)}catch(e){setError((e as Error).message)}finally{requestLock.current=false;setBusy(false)}}
 async function enter(kind:"create"|"practice"|"join"|"queue",selected=code){if(requestLock.current)return;requestLock.current=true;setBusy(true);setError("");try{await request(kind==="queue"?"/lobby/queue":kind==="join"?"/"+selected+"/join":"",kind==="join"?{}:{level,practice:kind==="practice",publicLobby:kind==="create"},kind==="queue"?"":"rooms")}catch(e){setError((e as Error).message)}finally{requestLock.current=false;setBusy(false)}}
 function leave(){if(view)void fetch(`${API_BASE}/api/board-quest/rooms/${view.code}/leave`,{method:"POST",headers:{Authorization:`Bearer ${token}`},keepalive:true}).catch(()=>{});sessionStorage.removeItem(sessionKey);navigate("/worlds")}

 useEffect(()=>{
   if(!sound||!view)return;
   let line="",key="";
   if(view.phase==="intro"){line="The doors are locked. Cameras are online. Investigators, find the clues before the mascots reach the control room.";key=view.code+"-intro";}
   else if(view.phase==="question"&&myTurn){line="Clue decoder ready. Choose the best answer.";key=view.code+"-q-"+view.question?.id;}
   else if(view.phase==="rps"&&cue){line="Mascot nearby. Choose flash, hide, or distract.";key=view.code+"-enc-"+cue.id;}
   if(!line||announcerCue.current===key)return;announcerCue.current=key;void speakCharacterAI(line,{calmMode:false});
 },[view?.phase,view?.question?.id,cue?.id,myTurn,sound]);

 const reward=cue&&stage==="reward"?EVENT_TEXT[cue.event]||EVENT_TEXT.points:null;
 const rival=cue?.rival==null?null:view?.players.find(p=>p.id===cue.rival);
 const canEncounter=view?.phase==="rps"&&cue&&[cue.actor,cue.rival].includes(myId)&&!view.rpsReady.includes(myId);
 const countdown=cue?Math.max(1,3-Math.floor(Math.max(0,now-cue.startAt)/1000)):3;
 const openingResolved=view?.phase==="opening-roll"&&view.openingWinner!==null;
 const openingChosen=!!view?.openingReady.includes(myId);
 const canOpening=view?.phase==="opening-roll"&&!openingResolved&&!openingChosen;

 if(!view)return <main className={`min-h-screen px-4 py-8 text-white ${halloread?"bg-[radial-gradient(circle_at_20%_0%,rgba(249,115,22,.25),transparent_28%),radial-gradient(circle_at_85%_5%,rgba(124,58,237,.32),transparent_32%),#050308]":"bg-[radial-gradient(circle_at_50%_-10%,#273351_0%,#090d17_42%,#03050a_100%)]"}`}>
   <button onClick={()=>navigate("/worlds")} className="mb-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black"><ArrowLeft className="mr-2 inline h-5 w-5"/> Worlds</button>
   <section className="mx-auto max-w-5xl overflow-hidden rounded-[2.4rem] border border-cyan-300/20 bg-[#080c14]/95 shadow-[0_30px_90px_rgba(0,0,0,.6)]">
     <div className="relative min-h-[330px] overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_80%_25%,rgba(239,68,68,.16),transparent_24%),radial-gradient(circle_at_25%_20%,rgba(34,211,238,.17),transparent_28%),#070b12] p-7 sm:p-10">
       <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:34px_34px]"/>
       <div className="relative max-w-3xl">
         <p className={`text-xs font-black uppercase tracking-[.28em] ${halloread?"text-orange-300":"text-cyan-300"}`}>{halloread?"HALLOREAD · OCTOBER AFTER DARK":"A.R.I.S.E. after dark · Kid-safe suspense mystery"}</p>
         <h1 className="mt-3 text-5xl font-black tracking-[-.04em] sm:text-7xl">{halloread?"HALLOREAD":"MIDNIGHT"}<br/><span className={halloread?"text-orange-300":"text-cyan-300"}>MYSTERY</span></h1>
         <p className="mt-5 max-w-2xl text-base font-bold leading-7 text-slate-300 sm:text-lg">The family fun center closed for the night. The grand-prize key vanished, the show was sabotaged, and the mascot robots are wandering. Watch cameras, decode clues, survive encounters, and solve the case before morning.</p>
         <div className="mt-5 flex flex-wrap gap-2 text-xs font-black"><span className="rounded-full bg-white/8 px-3 py-2">NO GORE</span><span className="rounded-full bg-white/8 px-3 py-2">MULTIPLAYER</span><span className="rounded-full bg-white/8 px-3 py-2">COMPUTER PLAYERS</span><span className="rounded-full bg-white/8 px-3 py-2">CAMERAS + CLUES + SURVIVAL</span></div>
       </div>
     </div>
     <div className="grid gap-5 p-5 sm:p-8 md:grid-cols-[1fr_.8fr]">
       <div>
         <button disabled={busy} onClick={()=>enter("queue")} className="min-h-16 w-full rounded-2xl bg-cyan-300 px-5 text-xl font-black text-slate-950 shadow-lg"><Users className="mr-2 inline h-5 w-5"/> Join a public investigation</button>
         <div className="mt-3 grid gap-2">{lobbies.slice(0,4).map(l=><button key={l.code} disabled={busy} onClick={()=>enter("join",l.code)} className="flex min-h-14 items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 text-left"><span><b>{l.hostName}’s case</b><small className="block text-slate-400">{l.players}/6 investigators · {l.level}</small></span><span className="text-cyan-300">JOIN</span></button>)}</div>
       </div>
       <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
         <label className="text-xs font-black uppercase tracking-wider text-slate-400">Clue reading level<select value={level} onChange={e=>setLevel(e.target.value as Level)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-white">{(["K-2","3-5","6-8","9-12"] as Level[]).map(v=><option key={v}>{v}</option>)}</select></label>
         <button disabled={busy} onClick={()=>enter("practice")} className="mt-3 min-h-12 w-full rounded-xl bg-violet-500 font-black">Practice with computer investigators</button>
         <button disabled={busy} onClick={()=>enter("create")} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white/5 font-black">Create open investigation</button>
         <details className="mt-2"><summary className="cursor-pointer py-2 text-sm font-black text-slate-300">Have a room code?</summary><div className="flex gap-2"><input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" placeholder="6-digit code" className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3"/><button disabled={busy||code.length!==6} onClick={()=>enter("join")} className="rounded-xl bg-amber-300 px-4 font-black text-slate-950">Join</button></div></details>
       </div>
     </div>
     {error&&<p className="mx-5 mb-5 rounded-xl bg-red-500/10 p-3 text-sm font-bold text-red-200 sm:mx-8">{error}</p>}
   </section>
 </main>;

 if(view.phase==="lobby")return <main className="min-h-screen bg-[#050810] p-4 text-white">
   <button onClick={leave} className="rounded-xl bg-white/5 px-4 py-3 font-black"><ArrowLeft className="mr-2 inline h-4 w-4"/> Worlds</button>
   <section className="mx-auto mt-4 max-w-5xl rounded-[2rem] border border-cyan-300/20 bg-[#0b111c] p-5 shadow-2xl sm:p-8">
     <p className="text-xs font-black uppercase tracking-[.25em] text-cyan-300">Midnight Mystery Lobby · {view.players.length}/6 investigators</p><h1 className="mt-2 text-4xl font-black">Assemble the night crew</h1>
     <p className="mt-2 font-semibold text-slate-400">Split into investigation teams. The first team to crack the case wins.</p>
     {host&&<div className="mt-5 flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-4"><label className="font-bold">Clue level <select value={view.level} disabled={busy} onChange={e=>act({type:"settings",level:e.target.value})} className="ml-2 rounded-lg bg-slate-900 p-2">{(["K-2","3-5","6-8","9-12"] as Level[]).map(v=><option key={v}>{v}</option>)}</select></label><label className="font-bold"><input type="checkbox" checked={view.fillCpu} onChange={e=>act({type:"settings",fillCpu:e.target.checked})} className="mr-2"/>Fill empty spots with computer investigators</label></div>}
     <div className="mt-5 grid gap-4 md:grid-cols-2">{(["blue","gold"] as Team[]).map(team=><div key={team} className={`rounded-2xl border p-4 ${team==="blue"?"border-cyan-400/30 bg-cyan-400/5":"border-amber-300/30 bg-amber-300/5"}`}><h2 className="text-2xl font-black">{view.teamNames[team]}</h2>{view.players.filter(p=>p.team===team).map(p=><div key={p.id} className="mt-2 flex min-h-12 items-center justify-between rounded-xl bg-black/25 px-3"><span><b>{p.name}{p.id===myId?" · YOU":""}</b><small className="block text-slate-500">{p.bot?"Computer investigator":p.id===view.hostId?"Host":"Investigator"}</small></span>{host&&!p.bot&&p.id!==myId&&<button onClick={()=>act({type:"assign",playerId:p.id,team:team==="blue"?"gold":"blue"})} className="rounded-lg bg-white/10 px-2 py-1 text-xs font-black">Switch team</button>}</div>)}</div>)}</div>
     {host?<button disabled={busy||offline} onClick={()=>act({type:"start"})} className="mt-5 min-h-14 w-full rounded-2xl bg-cyan-300 text-lg font-black text-slate-950">Lock the doors & start the mystery</button>:<p className="mt-5 text-center font-black text-cyan-200">Waiting for the host to begin…</p>}
     {(error||offline)&&<p className="mt-4 rounded-xl bg-red-500/10 p-3 text-red-200">{offline?"Reconnecting…":error}</p>}
   </section>
 </main>;

 if(view.phase==="tutorial")return <main className="min-h-screen bg-[#050810] p-4 text-white"><section className="mx-auto max-w-4xl rounded-[2rem] border border-cyan-300/20 bg-[#0a101a] p-6 shadow-2xl sm:p-9"><p className="text-xs font-black uppercase tracking-[.25em] text-cyan-300">Night Shift Briefing</p><h1 className="mt-2 text-4xl font-black">How to survive the mystery</h1><div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-white/5 p-5"><Camera className="text-cyan-300"/><h2 className="mt-2 text-xl font-black">Watch the cameras</h2><p className="mt-1 text-sm font-semibold text-slate-400">Rooms change as the night goes on. Mascots may appear where you least expect them.</p></div><div className="rounded-2xl bg-white/5 p-5"><Search className="text-amber-300"/><h2 className="mt-2 text-xl font-black">Decode clues</h2><p className="mt-1 text-sm font-semibold text-slate-400">Answer clue questions to search rooms and add evidence to your team’s case board.</p></div><div className="rounded-2xl bg-white/5 p-5"><Flashlight className="text-violet-300"/><h2 className="mt-2 text-xl font-black">Handle encounters</h2><p className="mt-1 text-sm font-semibold text-slate-400">When a mascot gets close, choose Flash, Hide, or Distract. The wrong move can trigger an alarm.</p></div><div className="rounded-2xl bg-white/5 p-5"><KeyRound className="text-emerald-300"/><h2 className="mt-2 text-xl font-black">Solve the case</h2><p className="mt-1 text-sm font-semibold text-slate-400">Collect more evidence than the rival team and uncover who sabotaged the show and hid the grand-prize key.</p></div></div><button disabled={busy||offline} onClick={()=>act({type:"tutorial-ready",tutorialId:view.tutorialId,result:"finished"})} className="mt-6 min-h-14 w-full rounded-2xl bg-cyan-300 text-lg font-black text-slate-950">I’m ready for the night shift</button></section></main>;

 return <main className={`min-h-screen text-white ${halloread?"bg-[#050208]":"bg-[#03050a]"}`}>
   {halloread&&<div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden" aria-hidden="true"><div className="absolute left-[-28px] top-[-28px] text-[120px] opacity-45">🕸️</div><div className="absolute right-[-28px] top-[-28px] text-[120px] opacity-45">🕸️</div><div className="absolute left-[6%] top-20 text-3xl opacity-60">🦇</div><div className="absolute right-[8%] top-32 text-3xl opacity-60">🦇</div><div className="halloread-mm-fog absolute inset-x-[-15%] bottom-[-6%] h-[30vh] rounded-[50%] bg-violet-100/20 blur-[45px]"/></div>}
   <header className="flex min-h-16 items-center gap-3 border-b border-white/10 bg-[#080d15]/95 px-3 sm:px-5"><button onClick={leave} className="rounded-xl bg-white/5 px-3 py-2 font-black"><ArrowLeft className="mr-1 inline h-4 w-4"/> Worlds</button><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">Midnight Mystery · Room {view.code}</p><h1 className="truncate text-lg font-black">Night Shift Investigation</h1></div><button onClick={()=>setSound(v=>!v)} className="grid h-11 w-11 place-items-center rounded-xl bg-white/5">{sound?<Volume2/>:<VolumeX/>}</button></header>
   <div className="mx-auto grid max-w-[1500px] gap-3 p-3 lg:grid-cols-[1fr_360px]">
     <section className="relative min-h-[520px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#080c13] p-2 shadow-2xl">
       <MysteryScene room={activeRoom} revision={view.revision} alert={view.phase==="rps"||stage==="duel-result"} halloread={halloread}/>
       <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">{ROOMS.map(r=><button key={r.id} onClick={()=>setManualCam(r.id)} className={`rounded-xl border px-3 py-2 text-left text-xs font-black backdrop-blur ${activeRoom===r.id?"border-cyan-300 bg-cyan-300 text-slate-950":"border-white/15 bg-black/65 text-white"}`}><span className="block text-[9px] opacity-65">{r.cam}</span>{r.name}</button>)}</div>
       {view.phase==="intro"&&<div className="absolute inset-0 grid place-items-center bg-black/60 p-4 text-center backdrop-blur-sm"><div><p className="text-xs font-black uppercase tracking-[.3em] text-red-300">12:00 AM · DOORS LOCKED</p><h2 className="mt-2 text-5xl font-black sm:text-7xl">THE NIGHT SHIFT<br/>HAS BEGUN</h2><p className="mx-auto mt-4 max-w-xl font-bold text-slate-300">Stay together. Watch the feeds. Find out who sabotaged the show.</p></div></div>}
       {view.phase==="opening-roll"&&!openingResolved&&<div className="absolute inset-0 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><div className="max-w-lg rounded-[2rem] border border-cyan-300/30 bg-[#0a111d] p-6 text-center shadow-2xl"><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Security Console</p><h2 className="mt-2 text-3xl font-black">Choose your access move</h2><p className="mt-2 text-sm font-semibold text-slate-400">Everyone chooses privately. The strongest result opens the first camera feed.</p>{canOpening?<div className="mt-5 grid grid-cols-3 gap-2">{HANDS.map(h=><button key={h} disabled={busy} onClick={()=>act({type:"opening-hand",hand:h})} className="min-h-24 rounded-2xl border border-white/10 bg-white/5 p-3 font-black hover:bg-cyan-300 hover:text-slate-950"><span className="block text-2xl">{h==="rock"?"🔦":h==="paper"?"🚪":"📢"}</span>{ACTION_LABELS[h].title}<small className="mt-1 block text-[10px] opacity-60">{ACTION_LABELS[h].sub}</small></button>)}</div>:<p className="mt-5 rounded-xl bg-white/5 p-3 font-bold">Choice locked. Waiting for the other investigators…</p>}</div></div>}
       {view.phase==="opening-roll"&&openingResolved&&<div className="absolute left-1/2 top-8 -translate-x-1/2 rounded-2xl border border-cyan-300/30 bg-black/85 px-6 py-4 text-center shadow-2xl"><p className="text-xs font-black text-cyan-300">CONTROL ROOM UNLOCKED</p><h2 className="mt-1 text-2xl font-black">{view.players.find(p=>p.id===view.openingWinner)?.name} investigates first</h2></div>}
       {reward&&<div className="absolute left-1/2 top-6 w-[min(92%,580px)] -translate-x-1/2 rounded-2xl border border-amber-300/30 bg-black/90 p-5 text-center shadow-2xl"><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">CASE UPDATE</p><h2 className="mt-1 text-3xl font-black">{reward.title}</h2><p className="mt-2 font-semibold text-slate-300">{reward.detail}</p></div>}
       {cue&&stage==="countdown"&&<div className="absolute inset-0 grid place-items-center bg-red-950/40 backdrop-blur-[2px]"><div className="text-center"><p className="text-sm font-black uppercase tracking-[.3em] text-red-200">Mascot approaching</p><div className="mt-2 text-8xl font-black">{countdown}</div></div></div>}
     </section>

     <aside className="space-y-3">
       <section className="rounded-[1.6rem] border border-white/10 bg-[#0a1019] p-4 shadow-xl"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-300">{roomInfo.cam}</p><h2 className="text-xl font-black">{roomInfo.name}</h2></div><Camera className="text-cyan-300"/></div><p className="mt-2 text-sm font-semibold text-slate-400">{roomInfo.hint}</p></section>
       <section className="grid grid-cols-2 gap-2"><div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4"><span className="text-[10px] font-black uppercase text-cyan-300">{view.teamNames.blue}</span><strong className="mt-1 block text-3xl">{view.scores.blue}</strong><small className="font-bold text-slate-500">evidence points</small></div><div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4"><span className="text-[10px] font-black uppercase text-amber-300">{view.teamNames.gold}</span><strong className="mt-1 block text-3xl">{view.scores.gold}</strong><small className="font-bold text-slate-500">evidence points</small></div></section>
       {view.phase!=="intro"&&view.phase!=="opening-roll"&&<section className="rounded-[1.6rem] border border-white/10 bg-[#0a1019] p-4"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Current investigator</p><h2 className="mt-1 text-2xl font-black">{current?.name}{myTurn?" · YOUR TURN":""}</h2><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black"><span className="rounded-xl bg-red-500/10 p-2">ALARMS<br/>{current?.strikes}/3</span><span className="rounded-xl bg-cyan-500/10 p-2"><Shield className="mx-auto h-4 w-4"/>PASS {current?.shield}</span><span className="rounded-xl bg-amber-500/10 p-2"><BatteryCharging className="mx-auto h-4 w-4"/>POWER {current?.power}</span></div></section>}
       {view.phase==="question"&&view.question&&<section className="rounded-[1.6rem] border border-violet-300/20 bg-violet-400/5 p-4"><p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-300">Clue Decoder</p><h2 className="mt-2 text-xl font-black">{view.question.q}</h2>{myTurn?<div className="mt-4 grid gap-2">{view.question.a.map((a,i)=><button key={i} disabled={busy||offline} onClick={()=>act({type:"answer",questionId:view.question!.id,choice:i})} className="min-h-14 rounded-xl border border-white/10 bg-white/5 px-3 text-left font-black hover:border-violet-300 hover:bg-violet-300 hover:text-slate-950"><span className="mr-3 text-violet-300">{String.fromCharCode(65+i)}</span>{a}</button>)}</div>:<p className="mt-3 rounded-xl bg-white/5 p-3 text-sm font-bold text-slate-400">{current?.name} is decoding the clue. Watch the cameras.</p>}</section>}
       {canEncounter&&<section className="rounded-[1.6rem] border border-red-400/30 bg-red-500/10 p-4"><p className="text-xs font-black uppercase tracking-[.2em] text-red-300">Mascot encounter</p><h2 className="mt-1 text-2xl font-black">{view.players.find(p=>p.id===cue?.actor)?.name} vs {rival?.name}</h2><p className="mt-2 text-sm font-semibold text-slate-300">Choose fast. Your move stays hidden until both players lock in.</p><div className="mt-3 grid grid-cols-3 gap-2">{HANDS.map(h=><button key={h} onClick={()=>act({type:"hand",hand:h,cueId:cue!.id})} className="min-h-20 rounded-xl bg-white/8 p-2 font-black"><span className="block text-2xl">{h==="rock"?"🔦":h==="paper"?"🚪":"📢"}</span>{ACTION_LABELS[h].title}</button>)}</div></section>}
       {view.phase==="finished"&&<section className="rounded-[1.6rem] border border-emerald-300/30 bg-emerald-400/10 p-5 text-center"><Sparkles className="mx-auto text-emerald-300"/><p className="mt-2 text-xs font-black uppercase tracking-[.2em] text-emerald-300">Case Closed</p><h2 className="mt-1 text-3xl font-black">{view.winner} solved the mystery!</h2>{host?<button onClick={()=>act({type:"start"})} className="mt-4 min-h-12 w-full rounded-xl bg-emerald-300 font-black text-slate-950">Start another night</button>:<p className="mt-3 text-sm font-bold text-slate-400">Waiting for the host…</p>}</section>}
       <section className="rounded-[1.6rem] border border-white/10 bg-[#0a1019] p-4"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Night crew</p><div className="mt-2 flex flex-wrap gap-2">{view.players.map(p=><span key={p.id} className={`rounded-full px-3 py-1.5 text-xs font-black ${p.id===current?.id?"bg-cyan-300 text-slate-950":"bg-white/5 text-slate-300"}`}>{p.name}{p.out?" · locked out":""}</span>)}</div></section>
       {(error||offline)&&<p className="rounded-xl bg-red-500/10 p-3 text-sm font-bold text-red-200">{offline?"Reconnecting to the security system…":error}</p>}
     </aside>
   </div>
   <style>{`
    .mm-scan{background:repeating-linear-gradient(to bottom,rgba(255,255,255,.025) 0,rgba(255,255,255,.025) 1px,transparent 1px,transparent 4px),linear-gradient(90deg,rgba(34,211,238,.025),transparent 28%,rgba(239,68,68,.022));mix-blend-mode:screen;animation:mmFlicker 5s steps(1,end) infinite}
    @keyframes mmFlicker{0%,93%,100%{opacity:.75}94%{opacity:.2}95%{opacity:1}96%{opacity:.35}}
    .halloread-mm-fog{animation:mmFog 9s ease-in-out infinite alternate}@keyframes mmFog{from{transform:translateX(-4%) scale(.92)}to{transform:translateX(5%) scale(1.08)}}
    @media(prefers-reduced-motion:reduce){.mm-scan,.halloread-mm-fog{animation:none}}
   `}</style>
 </main>;
}
