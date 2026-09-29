import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ArrowLeft, Gamepad2, MessageCircle, Users, X } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { getAvatarCharacter } from "@/lib/avatarCharacters";

type Player={
  user_id:number;display_name:string;character_id:string;x:number;z:number;facing:number;
  phrase?:string|null;phrase_at?:string|null;updated_at:string;
};
type Match={id:string;game_type:"four"|"word_tiles"|"word_rescue";status:string;player1_id:number;player2_id:number|null;state:any;winner_id:number|null;players?:Array<{user_id:number;display_name:string;character_id:string}>};
type Station={id:Match["game_type"];name:string;subtitle:string;x:number;z:number};

const STATIONS:Station[]=[
  {id:"four",name:"Four in a Row",subtitle:"Strategy · patterns · planning",x:-12,z:-7},
  {id:"word_tiles",name:"Word Tiles",subtitle:"Vocabulary · spelling · word play",x:12,z:-7},
  {id:"word_rescue",name:"Word Rescue",subtitle:"Letters · clues · vocabulary",x:0,z:-15},
];

function makeLabel(text:string,bg="#111827",fg="#ffffff"){
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext("2d")!;
  ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(18,18,476,92,30);ctx.fill();
  ctx.font="700 42px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle=fg;ctx.fillText(text,256,64);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false});
  const sp=new THREE.Sprite(mat);sp.scale.set(4.6,1.15,1);sp.renderOrder=20;return sp;
}
function addBox(scene:THREE.Scene,size:[number,number,number],pos:[number,number,number],color:number){
  const m=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:.82}));
  m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;
}
function stationColor(id:Station["id"]){return id==="four"?0x2563eb:id==="word_tiles"?0x7c3aed:0x059669;}

export default function ClubArise(){
  const {token,user}=useAuth();
  const [,navigate]=useLocation();
  const mountRef=useRef<HTMLDivElement>(null);
  const rendererRef=useRef<THREE.WebGLRenderer|null>(null);
  const cameraRef=useRef<THREE.PerspectiveCamera|null>(null);
  const controlsRef=useRef<OrbitControls|null>(null);
  const sceneRef=useRef<THREE.Scene|null>(null);
  const selfRootRef=useRef<THREE.Group|null>(null);
  const remoteRootsRef=useRef<Map<number,THREE.Group>>(new Map());
  const targetRef=useRef(new THREE.Vector3(0,0,7));
  const keysRef=useRef(new Set<string>());
  const lastSyncRef=useRef(0);
  const [ready,setReady]=useState(false);
  const [players,setPlayers]=useState<Player[]>([]);
  const [self,setSelf]=useState<{userId:number;displayName:string;characterId:string}|null>(null);
  const [phrases,setPhrases]=useState<string[]>([]);
  const [nearStation,setNearStation]=useState<Station|null>(null);
  const [match,setMatch]=useState<Match|null>(null);
  const [gameOpen,setGameOpen]=useState(false);
  const [notice,setNotice]=useState("Walk around, meet readers, and play together.");

  const headers=useMemo(()=>({Authorization:"Bearer "+token,"Content-Type":"application/json"}),[token]);

  useEffect(()=>{
    if(!token)return;
    fetch(API_BASE+"/api/club-arise/bootstrap",{headers:{Authorization:"Bearer "+token},cache:"no-store"})
      .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.message);return d;})
      .then(d=>{setSelf(d.self);setPlayers(d.players||[]);setPhrases(d.safePhrases||[]);})
      .catch(e=>setNotice(e.message||"Could not enter Club A.R.I.S.E."));
  },[token]);

  useEffect(()=>{
    const mount=mountRef.current;if(!mount||!self)return;
    let disposed=false;
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x91c6e8);scene.fog=new THREE.FogExp2(0xbdd9ea,.012);sceneRef.current=scene;
    const camera=new THREE.PerspectiveCamera(52,mount.clientWidth/mount.clientHeight,.1,120);camera.position.set(0,15,24);cameraRef.current=camera;
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});renderer.setSize(mount.clientWidth,mount.clientHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.domElement.className="absolute inset-0 h-full w-full";mount.appendChild(renderer.domElement);rendererRef.current=renderer;
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.3,2);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.47;controls.minDistance=8;controls.maxDistance=36;controlsRef.current=controls;
    scene.add(new THREE.HemisphereLight(0xe7f5ff,0x48614a,2.4));const sun=new THREE.DirectionalLight(0xfff1ce,4);sun.position.set(-12,20,10);sun.castShadow=true;scene.add(sun);
    const ground=new THREE.Mesh(new THREE.CircleGeometry(31,96),new THREE.MeshStandardMaterial({color:0x6e9c63,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.userData.ground=true;scene.add(ground);

    // clubhouse + plaza
    addBox(scene,[12,5,6],[0,2.5,-24],0x8b4b39);addBox(scene,[4,3,.4],[0,1.5,-20.8],0x3f2a24);
    addBox(scene,[7,3,5],[-19,1.5,-17],0xd6b46b);addBox(scene,[7,3,5],[19,1.5,-17],0xd6b46b);
    for(let i=0;i<10;i++){const a=i/10*Math.PI*2;addBox(scene,[.35,1.2,.35],[Math.cos(a)*25,.6,Math.sin(a)*25],0x6b4828);}
    const fountain=new THREE.Mesh(new THREE.CylinderGeometry(2.4,2.9,.55,40),new THREE.MeshStandardMaterial({color:0xb9c4ca,roughness:.6}));fountain.position.set(0,.28,1);scene.add(fountain);
    const water=new THREE.Mesh(new THREE.CylinderGeometry(2.05,2.05,.18,40),new THREE.MeshPhysicalMaterial({color:0x46b4dc,transparent:true,opacity:.8,roughness:.12}));water.position.set(0,.6,1);scene.add(water);

    for(const s of STATIONS){
      const pad=new THREE.Mesh(new THREE.CylinderGeometry(3.8,3.8,.35,48),new THREE.MeshStandardMaterial({color:stationColor(s.id),roughness:.6}));pad.position.set(s.x,.18,s.z);pad.receiveShadow=true;scene.add(pad);
      const sign=makeLabel(s.name);sign.position.set(s.x,3.4,s.z);scene.add(sign);
      addBox(scene,[3.2,1.3,2.1],[s.x,.8,s.z],0xf7f3e8);
    }

    const loader=new GLTFLoader();
    const loadAvatar=(uid:number,name:string,charId:string,x:number,z:number,isSelf=false)=>{
      const root=new THREE.Group();root.position.set(x,0,z);root.userData.userId=uid;scene.add(root);
      const label=makeLabel(name);label.position.set(0,3.15,0);root.add(label);
      const path=getAvatarCharacter(charId).modelPath;
      loader.load(path,gltf=>{
        if(disposed)return;
        const model=gltf.scene;const box=new THREE.Box3().setFromObject(model);const size=new THREE.Vector3();box.getSize(size);model.scale.setScalar(2.4/Math.max(.01,size.y));model.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(model);model.position.y=-b.min.y;model.traverse(o=>{if((o as THREE.Mesh).isMesh){(o as THREE.Mesh).castShadow=true;(o as THREE.Mesh).receiveShadow=true;}});root.add(model);
      });
      if(isSelf)selfRootRef.current=root;else remoteRootsRef.current.set(uid,root);
      return root;
    };
    loadAvatar(self.userId,self.displayName,self.characterId,0,7,true);

    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
    const click=(e:PointerEvent)=>{
      const rect=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-rect.left)/rect.width)*2-1;pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;ray.setFromCamera(pointer,camera);
      const hits=ray.intersectObjects(scene.children,true);const hit=hits.find(h=>{let o:THREE.Object3D|null=h.object;while(o){if(o.userData.ground)return true;o=o.parent;}return false;});
      if(hit){targetRef.current.set(THREE.MathUtils.clamp(hit.point.x,-28,28),0,THREE.MathUtils.clamp(hit.point.z,-27,27));}
    };
    renderer.domElement.addEventListener("pointerdown",click);

    const down=(e:KeyboardEvent)=>keysRef.current.add(e.key.toLowerCase()),up=(e:KeyboardEvent)=>keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);

    const clock=new THREE.Clock();
    let raf=0;
    const loop=()=>{
      if(disposed)return;const dt=Math.min(.04,clock.getDelta());const root=selfRootRef.current;
      if(root){
        let dx=0,dz=0;const k=keysRef.current;if(k.has("w")||k.has("arrowup"))dz-=1;if(k.has("s")||k.has("arrowdown"))dz+=1;if(k.has("a")||k.has("arrowleft"))dx-=1;if(k.has("d")||k.has("arrowright"))dx+=1;
        let dest=targetRef.current.clone();
        if(dx||dz){const v=new THREE.Vector3(dx,0,dz).normalize().multiplyScalar(5*dt);root.position.add(v);targetRef.current.copy(root.position);root.rotation.y=Math.atan2(v.x,v.z);}
        else{const diff=dest.sub(root.position);diff.y=0;if(diff.length()>.18){diff.normalize();root.position.addScaledVector(diff,4.2*dt);root.rotation.y=Math.atan2(diff.x,diff.z);}}
        root.position.x=THREE.MathUtils.clamp(root.position.x,-28,28);root.position.z=THREE.MathUtils.clamp(root.position.z,-27,27);
        let nearest:Station|null=null,dist=Infinity;for(const s of STATIONS){const d=Math.hypot(root.position.x-s.x,root.position.z-s.z);if(d<dist){dist=d;nearest=s;}}setNearStation(dist<5?nearest:null);
      }
      controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(loop);
    };loop();
    setReady(true);

    const resize=()=>{camera.aspect=mount.clientWidth/mount.clientHeight;camera.updateProjectionMatrix();renderer.setSize(mount.clientWidth,mount.clientHeight);};window.addEventListener("resize",resize);
    return()=>{disposed=true;cancelAnimationFrame(raf);window.removeEventListener("resize",resize);window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);renderer.domElement.removeEventListener("pointerdown",click);controls.dispose();renderer.dispose();remoteRootsRef.current.clear();if(renderer.domElement.parentElement===mount)mount.removeChild(renderer.domElement);};
  },[self]);

  useEffect(()=>{
    if(!ready||!token||!self)return;
    const sync=async()=>{
      const root=selfRootRef.current;if(!root)return;
      try{
        const now=Date.now();if(now-lastSyncRef.current<500)return;lastSyncRef.current=now;
        const r=await fetch(API_BASE+"/api/club-arise/presence",{method:"POST",headers,body:JSON.stringify({x:root.position.x,z:root.position.z,facing:root.rotation.y})});const d=await r.json();if(r.ok)setPlayers(d.players||[]);
      }catch{}
    };
    const id=window.setInterval(sync,650);return()=>clearInterval(id);
  },[ready,token,self,headers]);

  useEffect(()=>{
    if(!sceneRef.current||!self)return;const scene=sceneRef.current,loader=new GLTFLoader();
    const active=new Set<number>();
    for(const p of players){if(p.user_id===self.userId)continue;active.add(p.user_id);let root=remoteRootsRef.current.get(p.user_id);
      if(!root){root=new THREE.Group();root.position.set(p.x,0,p.z);scene.add(root);const label=makeLabel(p.display_name);label.position.set(0,3.15,0);root.add(label);loader.load(getAvatarCharacter(p.character_id).modelPath,g=>{const model=g.scene;const box=new THREE.Box3().setFromObject(model),size=new THREE.Vector3();box.getSize(size);model.scale.setScalar(2.4/Math.max(.01,size.y));model.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(model);model.position.y=-b.min.y;root!.add(model);});remoteRootsRef.current.set(p.user_id,root);}
      root.position.lerp(new THREE.Vector3(p.x,0,p.z),.35);root.rotation.y=THREE.MathUtils.lerp(root.rotation.y,p.facing,.35);
      const phraseFresh=p.phrase&&p.phrase_at&&Date.now()-new Date(p.phrase_at).getTime()<4500;const old=root.getObjectByName("phrase");if(old)root.remove(old);
      if(phraseFresh){const bubble=makeLabel(p.phrase!,"#ffffff","#111827");bubble.name="phrase";bubble.position.set(0,4.35,0);root.add(bubble);}
    }
    for(const [uid,root] of remoteRootsRef.current)if(!active.has(uid)){scene.remove(root);remoteRootsRef.current.delete(uid);}
  },[players,self]);

  const sendPhrase=async(phrase:string)=>{
    const root=selfRootRef.current;if(!root)return;
    await fetch(API_BASE+"/api/club-arise/presence",{method:"POST",headers,body:JSON.stringify({x:root.position.x,z:root.position.z,facing:root.rotation.y,phrase})});
    setNotice(phrase);
  };

  const joinGame=async(station:Station)=>{
    setNotice("Finding another player…");
    const r=await fetch(API_BASE+"/api/club-arise/matches/join",{method:"POST",headers,body:JSON.stringify({gameType:station.id})});const d=await r.json();
    if(!r.ok){setNotice(d.message||"Could not join game.");return;}setMatch(d);setGameOpen(true);
  };

  useEffect(()=>{
    if(!match||!gameOpen)return;
    const id=window.setInterval(async()=>{const r=await fetch(API_BASE+"/api/club-arise/matches/"+match.id,{headers:{Authorization:"Bearer "+token},cache:"no-store"});if(r.ok)setMatch(await r.json());},700);
    return()=>clearInterval(id);
  },[match?.id,gameOpen,token]);

  const gameAction=async(body:any)=>{
    if(!match)return;const r=await fetch(API_BASE+"/api/club-arise/matches/"+match.id+"/action",{method:"POST",headers,body:JSON.stringify(body)});const d=await r.json();if(r.ok)setMatch(d);else setNotice(d.message||"Try again.");
  };

  const myIndex=match&&self?(match.player1_id===self.userId?1:match.player2_id===self.userId?2:0):0;
  const yourTurn=!!match&&match.status==="active"&&Number(match.state?.turn)===myIndex;
  const opponent=match?.players?.find(p=>p.user_id!==self?.userId)?.display_name||"another reader";

  return <main className="relative h-[100dvh] overflow-hidden bg-slate-950 text-white">
    <div ref={mountRef} className="absolute inset-0"/>
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
      <button onClick={()=>navigate("/library")} className="pointer-events-auto flex min-h-12 items-center gap-2 rounded-2xl bg-black/60 px-4 font-black backdrop-blur"><ArrowLeft className="h-5 w-5"/> Library</button>
      <div className="flex-1"><h1 className="text-xl font-black">Club A.R.I.S.E.</h1><p className="text-xs font-bold text-white/70">Learn · play · meet readers safely</p></div>
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-black/60 px-3 py-2 font-black backdrop-blur"><Users className="h-4 w-4"/>{players.length} online</div>
    </header>

    <div className="absolute left-3 top-20 z-30 w-[min(310px,calc(100%-1.5rem))] rounded-2xl bg-black/65 p-3 backdrop-blur">
      <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-white/60"><MessageCircle className="h-4 w-4"/> Safe chat</div>
      <div className="flex flex-wrap gap-2">{phrases.slice(0,10).map(p=><button key={p} onClick={()=>void sendPhrase(p)} className="min-h-10 rounded-xl bg-white/10 px-3 text-xs font-black hover:bg-white/20">{p}</button>)}</div>
    </div>

    <div className="pointer-events-none absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-2xl bg-black/60 px-4 py-2 text-sm font-black backdrop-blur">{notice}</div>

    {nearStation&&!gameOpen&&<div className="absolute bottom-6 left-1/2 z-30 w-[min(420px,90vw)] -translate-x-1/2 rounded-3xl bg-white p-5 text-slate-950 shadow-2xl">
      <div className="flex items-start gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100"><Gamepad2 className="h-6 w-6"/></div><div className="flex-1"><h2 className="text-xl font-black">{nearStation.name}</h2><p className="text-sm font-semibold text-slate-500">{nearStation.subtitle}</p><button onClick={()=>void joinGame(nearStation)} className="mt-3 min-h-12 rounded-2xl bg-slate-950 px-5 font-black text-white">Play with someone</button></div></div>
    </div>}

    {gameOpen&&match&&<div className="absolute inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <section className="max-h-[92dvh] w-[min(760px,96vw)] overflow-auto rounded-[2rem] bg-white p-5 text-slate-950 shadow-2xl">
        <div className="flex items-start gap-3"><div className="flex-1"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Club A.R.I.S.E. multiplayer</p><h2 className="text-2xl font-black">{STATIONS.find(s=>s.id===match.game_type)?.name}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{match.status==="waiting"?"Waiting for another reader…":match.status==="active"?(yourTurn?"Your turn!":"Waiting for "+opponent+"…"):"Game complete"}</p></div><button onClick={()=>setGameOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100"><X/></button></div>

        {match.game_type==="four"&&<div className="mt-5 grid grid-cols-7 gap-1 rounded-2xl bg-blue-600 p-2">
          {(match.state?.board||[]).flatMap((row:any[],r:number)=>row.map((cell:any,c:number)=><button key={r+"-"+c} disabled={!yourTurn||match.status!=="active"} onClick={()=>void gameAction({column:c})} className={"aspect-square rounded-full border-4 border-blue-700 "+(cell===1?"bg-amber-400":cell===2?"bg-rose-500":"bg-white")} aria-label={"Column "+(c+1)}/>))}
        </div>}

        {match.game_type==="word_rescue"&&<div className="mt-5">
          <div className="rounded-2xl bg-emerald-50 p-4 text-center"><p className="text-sm font-bold text-emerald-700">Clue: {match.state?.hint}</p><div className="mt-3 text-4xl font-black tracking-[.3em]">{String(match.state?.word||"").split("").map((ch:string)=>match.state?.guessed?.includes(ch)?ch:"_").join(" ")}</div><p className="mt-2 text-xs font-bold text-slate-500">Misses: {match.state?.misses||0} / 8</p></div>
          <div className="mt-4 grid grid-cols-7 gap-2">{"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(letter=><button key={letter} disabled={!yourTurn||match.state?.guessed?.includes(letter)||match.status!=="active"} onClick={()=>void gameAction({letter})} className="aspect-square rounded-xl bg-slate-100 font-black disabled:opacity-30">{letter}</button>)}</div>
        </div>}

        {match.game_type==="word_tiles"&&<div className="mt-5">
          <div className="flex justify-between rounded-2xl bg-violet-50 p-4 font-black"><span>You: {match.state?.scores?.[myIndex-1]||0}</span><span>{opponent}: {match.state?.scores?.[myIndex===1?1:0]||0}</span></div>
          <p className="mt-4 text-center font-black">Choose a word tile</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">{(match.state?.choices?.[match.state?.round]||[]).map((w:string)=><button key={w} disabled={!yourTurn||match.status!=="active"} onClick={()=>void gameAction({choice:w})} className="min-h-20 rounded-2xl bg-violet-600 text-2xl font-black text-white disabled:opacity-40">{w}</button>)}</div>
        </div>}

        {match.status==="finished"&&<div className="mt-5 rounded-2xl bg-amber-50 p-5 text-center"><h3 className="text-2xl font-black">{match.winner_id===self?.userId?"You won!":match.winner_id?"Good game!":"Tie game!"}</h3><button onClick={()=>{setGameOpen(false);setMatch(null);}} className="mt-3 min-h-12 rounded-2xl bg-slate-950 px-5 font-black text-white">Back to Club</button></div>}
      </section>
    </div>}

    <div className="absolute bottom-3 right-3 z-20 rounded-xl bg-black/50 px-3 py-2 text-xs font-bold text-white/70">Click to walk · WASD / arrow keys</div>
  </main>;
}
