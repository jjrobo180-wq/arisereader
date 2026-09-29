import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ArrowLeft, Crosshair, Shield, Zap, Trophy } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { getAvatarCharacter } from "@/lib/avatarCharacters";

type SelfInfo={userId:number;displayName:string;characterId:string};
type Bot={id:number;name:string;characterId:string;root:THREE.Group;hp:number;shield:number;score:number;alive:boolean;respawnAt:number;target:THREE.Vector3;cooldown:number};

const PUBLIC_DOMAIN_BOTS=[
  {name:"Robin",characterId:"robin-hood"},
  {name:"Arthur",characterId:"king-arthur"},
  {name:"Alice",characterId:"alice"},
  {name:"Sherlock",characterId:"sherlock-holmes"},
  {name:"Frank",characterId:"frankenstein"},
  {name:"Hercules",characterId:"hercules"},
];

function label(text:string,bg="#07111f",fg="#fff"){
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext("2d")!;ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(10,12,492,104,30);ctx.fill();
  ctx.fillStyle=fg;ctx.font="800 38px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,256,64);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));sprite.scale.set(4,.95,1);return sprite;
}

function addCrate(scene:THREE.Scene,x:number,z:number,color=0x334155){
  const box=new THREE.Mesh(new THREE.BoxGeometry(2.2,2.2,2.2),new THREE.MeshStandardMaterial({color,roughness:.72}));
  box.position.set(x,1.1,z);box.castShadow=true;box.receiveShadow=true;scene.add(box);
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry),new THREE.LineBasicMaterial({color:0x94a3b8}));edge.position.copy(box.position);scene.add(edge);
}
function addTower(scene:THREE.Scene,x:number,z:number,color:number){
  const root=new THREE.Group();root.position.set(x,0,z);scene.add(root);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.5,5.5,8),new THREE.MeshStandardMaterial({color,roughness:.72}));base.position.y=2.75;base.castShadow=true;root.add(base);
  for(let i=0;i<8;i++){const crenel=new THREE.Mesh(new THREE.BoxGeometry(.75,.7,.75),new THREE.MeshStandardMaterial({color}));const a=i*Math.PI/4;crenel.position.set(Math.cos(a)*1.9,5.75,Math.sin(a)*1.9);root.add(crenel);}
  const beacon=new THREE.PointLight(0x67e8f9,7,12,2);beacon.position.set(0,6.5,0);root.add(beacon);
}
function addTree(scene:THREE.Scene,x:number,z:number){
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.28,.42,3.2,8),new THREE.MeshStandardMaterial({color:0x6b4423,roughness:.95}));trunk.position.set(x,1.6,z);scene.add(trunk);
  const crown=new THREE.Mesh(new THREE.ConeGeometry(1.7,4.2,8),new THREE.MeshStandardMaterial({color:0x1f7a4d,roughness:.9}));crown.position.set(x,4.2,z);scene.add(crown);
}

export default function LaserRoyale(){
  const {token}=useAuth();
  const [,navigate]=useLocation();
  const mountRef=useRef<HTMLDivElement>(null);
  const selfRootRef=useRef<THREE.Group|null>(null);
  const cameraRef=useRef<THREE.PerspectiveCamera|null>(null);
  const controlsRef=useRef<OrbitControls|null>(null);
  const targetRef=useRef(new THREE.Vector3());
  const keysRef=useRef(new Set<string>());
  const botsRef=useRef<Bot[]>([]);
  const beamGroupRef=useRef<THREE.Group|null>(null);
  const zoneRef=useRef<THREE.Mesh|null>(null);
  const [self,setSelf]=useState<SelfInfo|null>(null);
  const [hp,setHp]=useState(100);
  const [shield,setShield]=useState(50);
  const [energy,setEnergy]=useState(100);
  const [score,setScore]=useState(0);
  const scoreRef=useRef(0);
  const energyRef=useRef(100);
  const [roundTime,setRoundTime]=useState(180);
  const [zoneRadius,setZoneRadius]=useState(28);
  const [notice,setNotice]=useState("Laser Royale: tag opponents, grab power-ups, and stay inside the safe zone!");
  const [leaderboard,setLeaderboard]=useState<Array<{name:string;score:number}>>([]);
  useEffect(()=>{scoreRef.current=score;},[score]);
  useEffect(()=>{energyRef.current=energy;},[energy]);
  const [cameraMode,setCameraMode]=useState<"pan"|"rotate">("rotate");
  const headers=useMemo(()=>({Authorization:"Bearer "+token}),[token]);

  useEffect(()=>{
    if(!token)return;
    fetch(API_BASE+"/api/club-arise/bootstrap",{headers,cache:"no-store"})
      .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.message);return d;})
      .then(d=>setSelf(d.self))
      .catch(()=>setSelf({userId:0,displayName:"Reader",characterId:"robin-hood"}));
  },[token]);

  useEffect(()=>{
    const controls=controlsRef.current;if(!controls)return;
    controls.mouseButtons.LEFT=cameraMode==="rotate"?THREE.MOUSE.ROTATE:THREE.MOUSE.PAN;
    controls.touches.ONE=cameraMode==="rotate"?THREE.TOUCH.ROTATE:THREE.TOUCH.PAN;
  },[cameraMode]);

  useEffect(()=>{
    if(!self)return;
    const mount=mountRef.current;if(!mount)return;
    let disposed=false;
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1530);scene.fog=new THREE.Fog(0x0b1530,45,95);
    const camera=new THREE.PerspectiveCamera(52,mount.clientWidth/Math.max(1,mount.clientHeight),.1,140);camera.position.set(0,15,24);cameraRef.current=camera;
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(mount.clientWidth,mount.clientHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;mount.appendChild(renderer.domElement);

    const controls=new OrbitControls(camera,renderer.domElement);controlsRef.current=controls;controls.target.set(0,1.4,0);controls.enableDamping=true;controls.enablePan=true;controls.screenSpacePanning=false;controls.minDistance=8;controls.maxDistance=38;controls.maxPolarAngle=Math.PI*.47;controls.mouseButtons.LEFT=THREE.MOUSE.ROTATE;controls.mouseButtons.RIGHT=THREE.MOUSE.PAN;controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;

    scene.add(new THREE.HemisphereLight(0xbfd8ff,0x20331f,2.2));const sun=new THREE.DirectionalLight(0xffffff,3.1);sun.position.set(-12,22,16);sun.castShadow=true;scene.add(sun);
    const ground=new THREE.Mesh(new THREE.CircleGeometry(31,96),new THREE.MeshStandardMaterial({color:0x223b31,roughness:.9,metalness:.08}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.userData.ground=true;scene.add(ground);
    const grid=new THREE.GridHelper(60,30,0x34d399,0x1e3a5f);grid.position.y=.03;(grid.material as THREE.Material).transparent=true;(grid.material as THREE.Material).opacity=.22;scene.add(grid);

    const zone=new THREE.Mesh(new THREE.TorusGeometry(28,.24,12,128),new THREE.MeshStandardMaterial({color:0x22d3ee,emissive:0x22d3ee,emissiveIntensity:3}));zone.rotation.x=Math.PI/2;zone.position.y=.18;scene.add(zone);zoneRef.current=zone;

    addTower(scene,-20,-18,0x334155);addTower(scene,20,-18,0x4c1d95);addTower(scene,-20,18,0x14532d);addTower(scene,20,18,0x7c2d12);
    for(const p of [[-10,-8],[10,-8],[-12,8],[12,8],[-4,15],[5,-17],[-18,0],[18,1]] as const)addCrate(scene,p[0],p[1]);
    for(const p of [[-24,-8],[-24,8],[24,-8],[24,8],[-8,24],[8,24],[-8,-24],[8,-24]] as const)addTree(scene,p[0],p[1]);

    const centerPad=new THREE.Mesh(new THREE.CylinderGeometry(5.2,5.2,.24,64),new THREE.MeshStandardMaterial({color:0x111827,emissive:0x2563eb,emissiveIntensity:.5,metalness:.35}));centerPad.position.y=.12;scene.add(centerPad);
    const centerRing=new THREE.Mesh(new THREE.TorusGeometry(4.4,.14,12,64),new THREE.MeshStandardMaterial({color:0xfacc15,emissive:0xfacc15,emissiveIntensity:3}));centerRing.rotation.x=Math.PI/2;centerRing.position.y=.3;scene.add(centerRing);
    const title=label("LASER ROYALE","#0f172a","#67e8f9");title.position.set(0,6.8,-28);title.scale.set(9,2.1,1);scene.add(title);

    const powerups:THREE.Mesh[]=[];
    const powerupDefs=[
      {x:-14,z:-4,type:"shield",color:0x60a5fa},
      {x:14,z:5,type:"energy",color:0xfacc15},
      {x:0,z:18,type:"heal",color:0x4ade80},
      {x:-3,z:-18,type:"boost",color:0xf472b6},
    ];
    powerupDefs.forEach(d=>{const m=new THREE.Mesh(new THREE.OctahedronGeometry(.8,0),new THREE.MeshStandardMaterial({color:d.color,emissive:d.color,emissiveIntensity:2.4,metalness:.35}));m.position.set(d.x,1,d.z);m.userData.powerup=d.type;scene.add(m);powerups.push(m);const light=new THREE.PointLight(d.color,4,7);light.position.copy(m.position);scene.add(light);});

    const beamGroup=new THREE.Group();scene.add(beamGroup);beamGroupRef.current=beamGroup;
    const loader=new GLTFLoader();

    const loadAvatar=(charId:string,name:string,x:number,z:number,isSelf=false)=>{
      const root=new THREE.Group();root.position.set(x,0,z);scene.add(root);
      const tag=label(name,isSelf?"#0c4a6e":"#111827",isSelf?"#a5f3fc":"#fff");tag.position.set(0,3.25,0);root.add(tag);
      loader.load(getAvatarCharacter(charId).modelPath,gltf=>{if(disposed)return;const model=gltf.scene;const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());model.scale.setScalar(2.5/Math.max(.01,size.y));model.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(model);model.position.y=-b.min.y;model.traverse(o=>{if((o as THREE.Mesh).isMesh){(o as THREE.Mesh).castShadow=true;}});root.add(model);if(gltf.animations.length){const mixer=new THREE.AnimationMixer(model);const idle=gltf.animations.find(a=>/idle/i.test(a.name))||gltf.animations[0];mixer.clipAction(idle).play();root.userData.mixer=mixer;}});
      return root;
    };

    const selfRoot=loadAvatar(self.characterId,self.displayName||"You",0,0,true);selfRootRef.current=selfRoot;targetRef.current.copy(selfRoot.position);
    const bots:Bot[]=PUBLIC_DOMAIN_BOTS.map((b,i)=>{const a=i*Math.PI*2/PUBLIC_DOMAIN_BOTS.length;const root=loadAvatar(b.characterId,b.name,Math.cos(a)*18,Math.sin(a)*18,false);return{id:i+1,...b,root,hp:100,shield:50,score:0,alive:true,respawnAt:0,target:new THREE.Vector3(root.position.x,0,root.position.z),cooldown:Math.random()*1.2};});botsRef.current=bots;

    const makeBeam=(from:THREE.Vector3,to:THREE.Vector3,color:number)=>{
      const delta=to.clone().sub(from),len=delta.length();const geo=new THREE.CylinderGeometry(.07,.07,len,8);const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.95});const beam=new THREE.Mesh(geo,mat);beam.position.copy(from).add(to).multiplyScalar(.5);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());beamGroup.add(beam);window.setTimeout(()=>{beamGroup.remove(beam);geo.dispose();mat.dispose();},120);
    };

    const hitBot=(bot:Bot)=>{
      if(!bot.alive)return;let dmg=34;if(bot.shield>0){const used=Math.min(bot.shield,dmg);bot.shield-=used;dmg-=used;}bot.hp-=dmg;
      if(bot.hp<=0){bot.alive=false;bot.root.visible=false;bot.score=Math.max(0,bot.score-1);bot.respawnAt=performance.now()+3500;scoreRef.current+=2;setScore(scoreRef.current);setNotice("✨ Tagged "+bot.name+"! +2 points");}
      else setNotice("⚡ Hit "+bot.name+"!");
    };

    const shoot=()=>{
      if(energyRef.current<15)return;
      energyRef.current=Math.max(0,energyRef.current-15);
      setEnergy(energyRef.current);
      const root=selfRootRef.current;if(!root)return;
      const origin=root.position.clone().add(new THREE.Vector3(0,1.7,0));
      const forward=new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),root.rotation.y).normalize();
      let best:Bot|null=null,bestDist=Infinity;
      for(const bot of botsRef.current){if(!bot.alive)continue;const to=bot.root.position.clone().sub(origin);const dist=to.length();const angle=forward.angleTo(to.clone().normalize());if(dist<28&&angle<.28&&dist<bestDist){best=bot;bestDist=dist;}}
      const end=best?best.root.position.clone().add(new THREE.Vector3(0,1.5,0)):origin.clone().add(forward.multiplyScalar(28));
      makeBeam(origin,end,0x22d3ee);if(best)hitBot(best);
    };
    (selfRoot as any).userData.shoot=shoot;

    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let pointerStart:{x:number;y:number}|null=null;
    const pointerDown=(e:PointerEvent)=>{pointerStart={x:e.clientX,y:e.clientY};};
    const pointerUp=(e:PointerEvent)=>{if(!pointerStart)return;const moved=Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y);pointerStart=null;if(moved>10)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects(scene.children,true);const groundHit=hits.find(h=>{let o:THREE.Object3D|null=h.object;while(o){if(o.userData.ground)return true;o=o.parent;}return false;});if(groundHit){targetRef.current.set(THREE.MathUtils.clamp(groundHit.point.x,-29,29),0,THREE.MathUtils.clamp(groundHit.point.z,-29,29));}};
    renderer.domElement.addEventListener("pointerdown",pointerDown);renderer.domElement.addEventListener("pointerup",pointerUp);
    const keyDown=(e:KeyboardEvent)=>{keysRef.current.add(e.key.toLowerCase());if(e.code==="Space"){e.preventDefault();shoot();}};const keyUp=(e:KeyboardEvent)=>keysRef.current.delete(e.key.toLowerCase());window.addEventListener("keydown",keyDown);window.addEventListener("keyup",keyUp);

    const clock=new THREE.Clock();let raf=0;let zoneR=28;let timer=180;let lastSecond=performance.now();let botScoreRefresh=0;
    const respawnSelf=()=>{selfRoot.position.set(0,0,0);targetRef.current.copy(selfRoot.position);setHp(100);setShield(50);setNotice("Respawned at center pad.");};
    const animate=()=>{
      if(disposed)return;const dt=Math.min(.04,clock.getDelta());const now=performance.now();
      (selfRoot.userData.mixer as THREE.AnimationMixer|undefined)?.update(dt);

      let dx=0,dz=0;const k=keysRef.current;if(k.has("w")||k.has("arrowup"))dz-=1;if(k.has("s")||k.has("arrowdown"))dz+=1;if(k.has("a")||k.has("arrowleft"))dx-=1;if(k.has("d")||k.has("arrowright"))dx+=1;
      if(dx||dz){const move=new THREE.Vector3(dx,0,dz).normalize().multiplyScalar(6.2*dt);selfRoot.position.add(move);targetRef.current.copy(selfRoot.position);selfRoot.rotation.y=Math.atan2(move.x,move.z);}
      else{const diff=targetRef.current.clone().sub(selfRoot.position);diff.y=0;if(diff.length()>.15){diff.normalize();selfRoot.position.addScaledVector(diff,5.1*dt);selfRoot.rotation.y=Math.atan2(diff.x,diff.z);}}
      selfRoot.position.x=THREE.MathUtils.clamp(selfRoot.position.x,-30,30);selfRoot.position.z=THREE.MathUtils.clamp(selfRoot.position.z,-30,30);

      powerups.forEach(p=>{p.rotation.y+=dt*1.8;p.position.y=1+Math.sin(now*.002+p.position.x)*.2;if(p.visible&&p.position.distanceTo(selfRoot.position)<1.8){p.visible=false;const type=p.userData.powerup;if(type==="shield")setShield(v=>Math.min(100,v+50));if(type==="energy")energyRef.current=100;setEnergy(100);if(type==="heal")setHp(v=>Math.min(100,v+45));if(type==="boost"){setEnergy(100);setShield(v=>Math.min(100,v+25));}setNotice("Power-up collected: "+String(type).toUpperCase());window.setTimeout(()=>p.visible=true,9000);}});

      for(const bot of bots){
        (bot.root.userData.mixer as THREE.AnimationMixer|undefined)?.update(dt);
        if(!bot.alive){if(now>=bot.respawnAt){bot.alive=true;bot.root.visible=true;bot.hp=100;bot.shield=50;const a=Math.random()*Math.PI*2;bot.root.position.set(Math.cos(a)*20,0,Math.sin(a)*20);bot.target.copy(bot.root.position);}continue;}
        bot.cooldown-=dt;
        if(bot.root.position.distanceTo(bot.target)<1.2||Math.random()<.004){const a=Math.random()*Math.PI*2,r=Math.random()*Math.max(8,zoneR-2);bot.target.set(Math.cos(a)*r,0,Math.sin(a)*r);}
        const diff=bot.target.clone().sub(bot.root.position);diff.y=0;if(diff.length()>.2){diff.normalize();bot.root.position.addScaledVector(diff,(3.2+bot.id*.12)*dt);bot.root.rotation.y=Math.atan2(diff.x,diff.z);}
        const toSelf=selfRoot.position.clone().sub(bot.root.position);const dist=toSelf.length();
        if(dist<18&&bot.cooldown<=0){bot.cooldown=1.4+Math.random()*1.4;makeBeam(bot.root.position.clone().add(new THREE.Vector3(0,1.6,0)),selfRoot.position.clone().add(new THREE.Vector3(0,1.4,0)),0xf472b6);if(Math.random()<.58){setShield(s=>{let remaining=28;const used=Math.min(s,remaining);remaining-=used;const next=s-used;if(remaining>0)setHp(h=>{const nh=h-remaining;if(nh<=0){window.setTimeout(respawnSelf,80);return 100;}return nh;});return next;});}}
      }

      if(now-lastSecond>=1000){lastSecond=now;timer=Math.max(0,timer-1);setRoundTime(timer);zoneR=Math.max(10,28-(180-timer)*.1);setZoneRadius(Math.round(zoneR));if(zoneRef.current)zoneRef.current.scale.setScalar(zoneR/28);setEnergy(v=>{const next=Math.min(100,v+8);energyRef.current=next;return next;});if(selfRoot.position.length()>zoneR)setHp(h=>Math.max(1,h-6));if(timer===0){timer=180;zoneR=28;setNotice("New round started! Scores carry over.");}}
      if(now-botScoreRefresh>700){botScoreRefresh=now;setLeaderboard([{name:self.displayName||"You",score:scoreRef.current},...bots.map(b=>({name:b.name,score:b.score}))].sort((a,b)=>b.score-a.score).slice(0,5));}

      const center=new THREE.Vector3(selfRoot.position.x,1.4,selfRoot.position.z);camera.position.add(center.clone().sub(controls.target));controls.target.lerp(center,.12);controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(animate);
    };animate();

    const resize=()=>{camera.aspect=mount.clientWidth/Math.max(1,mount.clientHeight);camera.updateProjectionMatrix();renderer.setSize(mount.clientWidth,mount.clientHeight);};window.addEventListener("resize",resize);
    return()=>{disposed=true;cancelAnimationFrame(raf);window.removeEventListener("resize",resize);window.removeEventListener("keydown",keyDown);window.removeEventListener("keyup",keyUp);renderer.domElement.removeEventListener("pointerdown",pointerDown);renderer.domElement.removeEventListener("pointerup",pointerUp);controls.dispose();scene.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>x.dispose());});renderer.dispose();if(mount.contains(renderer.domElement))mount.removeChild(renderer.domElement);};
  },[self?.characterId]);

  const shoot=()=>{const root=selfRootRef.current as any;if(root?.userData?.shoot)root.userData.shoot();};

  return <main className="relative h-[100dvh] overflow-hidden bg-slate-950 text-white">
    <div ref={mountRef} className="absolute inset-0 touch-none"/>
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-black/85 to-transparent p-2 sm:p-4">
      <button onClick={()=>navigate("/worlds")} className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-xl bg-black/70 px-3 font-black backdrop-blur"><ArrowLeft className="h-4 w-4"/> Worlds</button>
      <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-300">A.R.I.S.E. WORLD</p><h1 className="truncate text-lg font-black sm:text-2xl">⚡ Laser Royale</h1></div>
      <div className="pointer-events-auto rounded-xl bg-black/70 px-3 py-2 text-xs font-black backdrop-blur"><Trophy className="mr-1 inline h-4 w-4 text-amber-300"/>{score}</div>
    </header>

    <div className="absolute left-2 top-16 z-30 flex flex-col gap-1.5 sm:left-4 sm:top-24">
      <button onClick={()=>setCameraMode("rotate")} className={"min-h-10 rounded-xl px-3 text-xs font-black backdrop-blur "+(cameraMode==="rotate"?"bg-cyan-300 text-slate-950":"bg-slate-950/85")}>Rotate 360°</button>
      <button onClick={()=>setCameraMode("pan")} className={"min-h-10 rounded-xl px-3 text-xs font-black backdrop-blur "+(cameraMode==="pan"?"bg-cyan-300 text-slate-950":"bg-slate-950/85")}>Move view</button>
      <button onClick={()=>{const root=selfRootRef.current,controls=controlsRef.current,camera=cameraRef.current;if(root&&controls&&camera){const center=new THREE.Vector3(root.position.x,1.4,root.position.z);camera.position.add(center.clone().sub(controls.target));controls.target.copy(center);controls.update();}}} className="min-h-10 rounded-xl bg-slate-950/85 px-3 text-xs font-black backdrop-blur">Center</button>
    </div>

    <div className="absolute right-2 top-16 z-30 w-32 space-y-1.5 sm:right-4 sm:top-24 sm:w-40">
      <div className="rounded-xl bg-black/70 p-2 text-[10px] font-black backdrop-blur"><div className="flex items-center justify-between"><span>HP</span><span>{hp}</span></div><div className="mt-1 h-2 rounded bg-white/10"><div className="h-full rounded bg-emerald-400" style={{width:hp+"%"}}/></div></div>
      <div className="rounded-xl bg-black/70 p-2 text-[10px] font-black backdrop-blur"><div className="flex items-center justify-between"><span><Shield className="mr-1 inline h-3 w-3"/>Shield</span><span>{shield}</span></div><div className="mt-1 h-2 rounded bg-white/10"><div className="h-full rounded bg-blue-400" style={{width:shield+"%"}}/></div></div>
      <div className="rounded-xl bg-black/70 p-2 text-[10px] font-black backdrop-blur"><div className="flex items-center justify-between"><span><Zap className="mr-1 inline h-3 w-3"/>Energy</span><span>{energy}</span></div><div className="mt-1 h-2 rounded bg-white/10"><div className="h-full rounded bg-amber-300" style={{width:energy+"%"}}/></div></div>
      <div className="rounded-xl bg-black/70 p-2 text-center text-[10px] font-black backdrop-blur">Zone {zoneRadius}m · {Math.floor(roundTime/60)}:{String(roundTime%60).padStart(2,"0")}</div>
    </div>

    <div className="pointer-events-none absolute left-1/2 top-16 z-20 max-w-[48vw] -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-center text-[10px] font-black backdrop-blur sm:top-20">{notice}</div>

    <aside className="absolute bottom-3 left-3 z-30 hidden w-44 rounded-2xl bg-black/65 p-3 backdrop-blur sm:block">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-amber-300">Top players</p>
      {leaderboard.map((p,i)=><div key={p.name} className="flex justify-between text-xs font-bold"><span>{i+1}. {p.name}</span><span>{p.score}</span></div>)}
    </aside>

    <button onClick={shoot} disabled={energy<15} className="absolute bottom-4 right-4 z-40 grid h-20 w-20 place-items-center rounded-full border-4 border-cyan-200/70 bg-cyan-400 text-slate-950 shadow-[0_0_35px_rgba(34,211,238,.55)] disabled:opacity-40 sm:h-24 sm:w-24" aria-label="Fire laser"><Crosshair className="h-9 w-9"/></button>
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-xl bg-black/55 px-3 py-2 text-[10px] font-bold text-white/70 backdrop-blur sm:text-xs">WASD/arrows or tap to move · Space or ⚡ button to tag · stay inside the glowing zone</div>
  </main>;
}
