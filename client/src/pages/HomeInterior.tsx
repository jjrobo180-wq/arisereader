import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Home, Paintbrush, RotateCcw, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { getAvatarCharacter } from "@/lib/avatarCharacters";
import { createPet, openPetCare } from "@/lib/pets";

type CatalogItem={id:string;type:string;name:string;price:number;rarity:string};
type Payload={
  economy:{wallet:number};
  state:{
    selectedCharacter:string;
    equipped:Record<string,string>;
    purchased:string[];
    furniture:string[];
  };
  catalog:CatalogItem[];
};

const ROOM_NAMES=[
  {name:"Living Room",test:(x:number,z:number)=>x<0&&z>0},
  {name:"Kitchen",test:(x:number,z:number)=>x>=0&&z>0},
  {name:"Reading Room",test:(x:number,z:number)=>x<0&&z<=0},
  {name:"Bedroom",test:(x:number,z:number)=>x>=0&&z<=0},
];

function mat(color:number,roughness=.78){return new THREE.MeshStandardMaterial({color,roughness});}
function addBox(scene:THREE.Scene,size:[number,number,number],pos:[number,number,number],color:number){
  const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat(color));m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;
}
function addPlane(scene:THREE.Scene,size:[number,number],pos:[number,number,number],color:number,rotationX=-Math.PI/2){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(...size),mat(color));m.position.set(...pos);m.rotation.x=rotationX;m.receiveShadow=true;scene.add(m);return m;
}
function addWindow(scene:THREE.Scene,x:number,z:number,rotY:number){
  const frame=new THREE.Group();frame.position.set(x,2.8,z);frame.rotation.y=rotY;
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(3.4,2.1),new THREE.MeshStandardMaterial({color:0x93c5fd,emissive:0x1d4ed8,emissiveIntensity:.16,transparent:true,opacity:.76,side:THREE.DoubleSide}));
  frame.add(glass);
  const frameMat=mat(0xe2e8f0,.5);
  for(const [sx,sy,px,py] of [[3.7,.16,0,1.13],[3.7,.16,0,-1.13],[.16,2.4,-1.78,0],[.16,2.4,1.78,0],[.12,2.2,0,0]] as number[][]){
    const b=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,.12),frameMat);b.position.set(px,py,.06);frame.add(b);
  }
  scene.add(frame);
}
function addRug(scene:THREE.Scene,x:number,z:number,w:number,d:number,color:number){
  const rug=addPlane(scene,[w,d],[x,.012,z],color);rug.rotation.z=0;return rug;
}
function addCouch(scene:THREE.Scene,x:number,z:number,color:number,rot=0){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);
  const make=(s:[number,number,number],p:[number,number,number])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...s),mat(color,.9));m.position.set(...p);m.castShadow=true;m.receiveShadow=true;g.add(m);};
  make([4.7,.75,1.75],[0,.45,0]);make([4.7,1.2,.38],[0,1.05,.67]);make([.45,1.05,1.75],[-2.3,.62,0]);make([.45,1.05,1.75],[2.3,.62,0]);
  return g;
}
function addTable(scene:THREE.Scene,x:number,z:number,color:number){
  addBox(scene,[3,.22,1.45],[x,.72,z],color);
  for(const dx of [-1.2,1.2])for(const dz of [-.5,.5])addBox(scene,[.16,1.25,.16],[x+dx,.31,z+dz],color);
}
function addPlant(scene:THREE.Scene,x:number,z:number){
  addBox(scene,[.8,.7,.8],[x,.35,z],0x9a3412);
  for(let i=0;i<5;i++){const leaf=addBox(scene,[.18,1.25,.18],[x+(i-2)*.12,1.25,z],0x16a34a);leaf.rotation.z=(i-2)*.18;}
}
function addLamp(scene:THREE.Scene,x:number,z:number){
  addBox(scene,[.16,2.5,.16],[x,1.25,z],0x334155);const shade=new THREE.Mesh(new THREE.ConeGeometry(.65,.85,18,1,true),new THREE.MeshStandardMaterial({color:0xfef3c7,side:THREE.DoubleSide}));shade.position.set(x,2.65,z);scene.add(shade);
  const light=new THREE.PointLight(0xffe7b3,1.25,7);light.position.set(x,2.5,z);scene.add(light);
}
function addBookshelf(scene:THREE.Scene,x:number,z:number,rot=0){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);
  const wood=mat(0x713f12,.85);
  const side=(sx:number,sy:number,sz:number,px:number,py:number,pz:number)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),wood);m.position.set(px,py,pz);m.castShadow=true;g.add(m);};
  side(4.8,2.6,.35,0,1.3,0);for(let i=0;i<4;i++)side(4.55,.12,.55,0,.45+i*.6,.18);
  const colors=[0x2563eb,0xdc2626,0x16a34a,0xca8a04,0x7c3aed,0xdb2777];
  for(let shelf=0;shelf<3;shelf++)for(let i=0;i<7;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(.3,.42,.22),mat(colors[(i+shelf)%colors.length],.7));b.position.set(-1.65+i*.53,.72+shelf*.6,.48);g.add(b);}
}
function addBed(scene:THREE.Scene,x:number,z:number,accent:number){
  addBox(scene,[5.2,.55,6.4],[x,.42,z],0x334155);addBox(scene,[5,.5,5.9],[x,.85,z-.1],0xf8fafc);addBox(scene,[5.2,2.2,.35],[x,1.35,z-3.05],accent);
  addBox(scene,[2,.3,1.1],[x-1.25,1.2,z-2.25],0xe2e8f0);addBox(scene,[2,.3,1.1],[x+1.25,1.2,z-2.25],0xe2e8f0);
}
function addKitchen(scene:THREE.Scene,accent:number){
  addBox(scene,[5.5,1.05,1.15],[6.2,.55,6.75],0x78350f);addBox(scene,[5.7,.18,1.35],[6.2,1.08,6.75],0xf8fafc);
  addBox(scene,[1.8,3.4,1.3],[10.5,1.7,7.9],0x94a3b8);addBox(scene,[1.25,2.3,.25],[10.5,1.65,8.58],0xcbd5e1);
  addBox(scene,[2.4,.95,1.2],[8.1,.5,3.8],accent);addBox(scene,[2.55,.12,1.35],[8.1,1.02,3.8],0x0f172a);
  const sink=new THREE.Mesh(new THREE.TorusGeometry(.38,.08,8,20,Math.PI),mat(0x64748b,.35));sink.position.set(5.5,1.35,6.65);sink.rotation.x=Math.PI/2;scene.add(sink);
}
function addTv(scene:THREE.Scene,x:number,z:number){
  addBox(scene,[3.7,2.2,.2],[x,2.25,z],0x0f172a);const screen=addBox(scene,[3.35,1.85,.08],[x,2.25,z+.13],0x1d4ed8);(screen.material as THREE.MeshStandardMaterial).emissive=new THREE.Color(0x172554);(screen.material as THREE.MeshStandardMaterial).emissiveIntensity=.65;
  addBox(scene,[4.5,.65,1.1],[x,.42,z+.1],0x713f12);
}
function addNeon(scene:THREE.Scene,text:string,x:number,y:number,z:number,rotY=0){
  const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=256;const ctx=canvas.getContext("2d")!;ctx.clearRect(0,0,1024,256);ctx.font="900 76px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.shadowColor="#22d3ee";ctx.shadowBlur=26;ctx.fillStyle="#a5f3fc";ctx.fillText(text,512,128);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(6.4,1.6),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide}));mesh.position.set(x,y,z);mesh.rotation.y=rotY;scene.add(mesh);
}
function blocked(x:number,z:number){
  if(x<-11.8||x>11.8||z<-8.9||z>8.9)return true;
  // Hall wall separates the front rooms from the back rooms, with a wide center doorway.
  if(Math.abs(z)<.42 && Math.abs(x)>2)return true;
  // Back divider separates the reading room and bedroom. Return through the hall to cross sides.
  if(Math.abs(x)<.42 && z<-2)return true;
  // Keep avatar out of the biggest furniture.
  const zones=[
    [-9,-4.1,5.25,7.8],[-9,-4.1,-6.6,-3.1],[3.2,9.4,-8.8,-2.6],
    [3.2,9.4,5.8,8.5],[9.45,11.6,6.7,8.8],
  ];
  return zones.some(([x1,x2,z1,z2])=>x>x1&&x<x2&&z>z1&&z<z2);
}

export default function HomeInterior(){
  const {token}=useAuth();const [,navigate]=useLocation();
  const mountRef=useRef<HTMLDivElement>(null);
  const rootRef=useRef<THREE.Group|null>(null);
  const petRef=useRef<THREE.Object3D|null>(null);
  const cameraRef=useRef<THREE.PerspectiveCamera|null>(null);
  const controlsRef=useRef<OrbitControls|null>(null);
  const keysRef=useRef(new Set<string>());
  const targetRef=useRef(new THREE.Vector3(0,0,7.2));
  const [payload,setPayload]=useState<Payload|null>(null);
  const [notice,setNotice]=useState("Drag to look around. Use the arrows to walk.");
  const [room,setRoom]=useState("Living Room");
  const [decorate,setDecorate]=useState(false);
  const [busy,setBusy]=useState("");
  const headers=useMemo(()=>({Authorization:"Bearer "+token,"Content-Type":"application/json"}),[token]);

  const load=async()=>{
    if(!token)return;
    try{const r=await fetch(API_BASE+"/api/avatar-world",{headers,cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.message||"Could not open your home.");setPayload(d);}
    catch(e:any){setNotice(e.message||"Could not open your home.");}
  };
  useEffect(()=>{void load();},[token]);

  const customize=async(body:any)=>{
    if(!token||busy)return;setBusy("save");
    try{const r=await fetch(API_BASE+"/api/avatar-world/customize",{method:"POST",headers,body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.message||"Could not update your home.");setPayload(d);setNotice("Home updated.");}
    catch(e:any){setNotice(e.message||"Could not update your home.");}
    finally{setBusy("");}
  };

  useEffect(()=>{
    const mount=mountRef.current;if(!mount||!payload)return;let disposed=false,raf=0,lastRoom="";
    const homeId=payload.state.equipped.home||"home-basic",dark=homeId==="home-loft",studio=homeId==="home-studio",modern=homeId==="home-modern";
    const wall=dark?0x27272a:studio?0x334155:modern?0xf1f5f9:0xf8fafc;
    const floorColor=dark?0x3f3f46:studio?0x475569:modern?0xd6d3d1:0xcbd5e1;
    const accent=dark?0xa855f7:studio?0x14b8a6:modern?0x0284c7:0x2563eb;
    const scene=new THREE.Scene();scene.background=new THREE.Color(dark?0x0f172a:studio?0x172033:0xbfe4ff);scene.fog=new THREE.Fog(scene.background.getHex(),28,50);
    const camera=new THREE.PerspectiveCamera(58,1,.1,70);camera.position.set(0,5.2,13.2);cameraRef.current=camera;
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;mount.innerHTML="";mount.appendChild(renderer.domElement);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=false;controls.minDistance=3.8;controls.maxDistance=9.5;controls.minPolarAngle=.55;controls.maxPolarAngle=1.35;controls.target.set(0,1.35,7.2);controlsRef.current=controls;
    scene.add(new THREE.HemisphereLight(0xffffff,0x475569,2.35));const sun=new THREE.DirectionalLight(0xfff1d6,2.4);sun.position.set(-9,14,9);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
    const floor=addPlane(scene,[25,19],[0,0,0],floorColor);floor.userData.ground=true;
    addRug(scene,-6.7,4.8,6,4.5,dark?0x581c87:0x1d4ed8);addRug(scene,-6.6,-4.8,6,4.6,0x0f766e);addRug(scene,6.4,-4.9,6,5.3,dark?0x7c2d12:0x64748b);
    // Outer shell with a real entry opening at the south side.
    addBox(scene,[25,5.4,.36],[0,2.7,-9.5],wall);addBox(scene,[.36,5.4,19],[-12.5,2.7,0],wall);addBox(scene,[.36,5.4,19],[12.5,2.7,0],wall);
    addBox(scene,[10.1,5.4,.36],[-7.45,2.7,9.5],wall);addBox(scene,[10.1,5.4,.36],[7.45,2.7,9.5],wall);addBox(scene,[4.9,.6,.36],[0,5.1,9.5],wall);
    // Real room layout: living + kitchen are open at the front, a center hall leads to two back rooms.
    addBox(scene,[10.5,5.1,.34],[-7.25,2.55,0],wall);addBox(scene,[10.5,5.1,.34],[7.25,2.55,0],wall);
    addBox(scene,[.34,5.1,7.5],[0,2.55,-5.75],wall);
    // Trim the wide hallway opening.
    addBox(scene,[.36,4.6,.36],[-2,2.3,0],0x94a3b8);addBox(scene,[.36,4.6,.36],[2,2.3,0],0x94a3b8);addBox(scene,[4.35,.18,.36],[0,4.5,0],0x94a3b8);
    addWindow(scene,-7.2,-9.28,0);addWindow(scene,7.2,-9.28,0);addWindow(scene,-12.28,5.2,Math.PI/2);addWindow(scene,12.28,5.2,-Math.PI/2);
    // Living room.
    addCouch(scene,-6.7,6.5,0x475569);addTable(scene,-6.7,3.75,0x92400e);addTv(scene,-6.7,.75);addPlant(scene,-10.7,7.6);addLamp(scene,-3.4,7.6);
    // Kitchen.
    addKitchen(scene,accent);addPlant(scene,3.3,7.7);
    // Reading room.
    addBookshelf(scene,-6.5,-8.55,0);addCouch(scene,-6.5,-4.5,0x0f766e,Math.PI);addTable(scene,-6.5,-2.2,0x92400e);addLamp(scene,-10.5,-2.3);
    // Bedroom.
    addBed(scene,6.3,-5.65,accent);addTable(scene,10.4,-2.3,0x713f12);addLamp(scene,10.4,-3.1);
    if(payload.state.furniture.includes("furniture-books"))addBookshelf(scene,-10.3,-4.9,Math.PI/2);
    if(payload.state.furniture.includes("furniture-sofa"))addCouch(scene,6.3,3.15,0x7c3aed,Math.PI);
    if(payload.state.furniture.includes("furniture-neon"))addNeon(scene,"READ • RISE • REPEAT",-6.5,3.9,-9.28,0);

    const loader=new GLTFLoader(),avatar=new THREE.Group();avatar.position.set(0,0,7.2);scene.add(avatar);rootRef.current=avatar;targetRef.current.copy(avatar.position);
    loader.load(getAvatarCharacter(payload.state.selectedCharacter||"robin-hood").modelPath,gltf=>{
      if(disposed)return;const model=gltf.scene;const b=new THREE.Box3().setFromObject(model),s=b.getSize(new THREE.Vector3());model.scale.setScalar(2.45/Math.max(.01,s.y));model.updateMatrixWorld(true);const n=new THREE.Box3().setFromObject(model);model.position.y=-n.min.y;model.traverse(o=>{if((o as THREE.Mesh).isMesh){(o as THREE.Mesh).castShadow=true;(o as THREE.Mesh).receiveShadow=true;}});avatar.add(model);
      if(gltf.animations.length){const mixer=new THREE.AnimationMixer(model);const idle=gltf.animations.find(a=>/idle/i.test(a.name))||gltf.animations[0],walk=gltf.animations.find(a=>/walk|run/i.test(a.name));const idleAction=mixer.clipAction(idle);idleAction.play();avatar.userData.mixer=mixer;avatar.userData.idleAction=idleAction;if(walk)avatar.userData.walkAction=mixer.clipAction(walk);}
    });
    const pet=createPet(payload.state.equipped.pet,loader,.9);if(pet){pet.position.set(.9,0,7.8);scene.add(pet);petRef.current=pet;}

    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down:{x:number;y:number}|null=null;
    const pd=(e:PointerEvent)=>down={x:e.clientX,y:e.clientY};
    const pu=(e:PointerEvent)=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>9){down=null;return;}down=null;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const petObj=petRef.current;if(petObj&&ray.intersectObject(petObj,true).length){openPetCare();return;}const hit=ray.intersectObject(floor)[0];if(hit&&!blocked(hit.point.x,hit.point.z))targetRef.current.set(hit.point.x,0,hit.point.z);};
    const kd=(e:KeyboardEvent)=>keysRef.current.add(e.key.toLowerCase()),ku=(e:KeyboardEvent)=>keysRef.current.delete(e.key.toLowerCase());
    renderer.domElement.addEventListener("pointerdown",pd);renderer.domElement.addEventListener("pointerup",pu);window.addEventListener("keydown",kd);window.addEventListener("keyup",ku);
    const resize=()=>{camera.aspect=mount.clientWidth/Math.max(1,mount.clientHeight);camera.updateProjectionMatrix();renderer.setSize(mount.clientWidth,mount.clientHeight);};resize();window.addEventListener("resize",resize);
    const clock=new THREE.Clock();
    const loop=()=>{
      if(disposed)return;const dt=Math.min(.05,clock.getDelta()),root=rootRef.current;
      if(root){
        let side=0,forwardInput=0,k=keysRef.current;if(k.has("w")||k.has("arrowup"))forwardInput+=1;if(k.has("s")||k.has("arrowdown"))forwardInput-=1;if(k.has("d")||k.has("arrowright"))side+=1;if(k.has("a")||k.has("arrowleft"))side-=1;
        if(side||forwardInput){
          const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize().multiplyScalar(-1);
          const step=forward.multiplyScalar(forwardInput).add(right.multiplyScalar(side)).normalize().multiplyScalar(4.5*dt);const nx=root.position.x+step.x,nz=root.position.z+step.z;if(!blocked(nx,nz)){targetRef.current.set(nx,0,nz);}
        }
        const delta=targetRef.current.clone().sub(root.position);delta.y=0;const moving=delta.length()>.08;
        if(moving){const mv=delta.normalize().multiplyScalar(Math.min(delta.length(),4.6*dt));const nx=root.position.x+mv.x,nz=root.position.z+mv.z;if(!blocked(nx,nz)){root.position.x=nx;root.position.z=nz;root.rotation.y=Math.atan2(mv.x,mv.z);}else targetRef.current.copy(root.position);}
        const mixer=root.userData.mixer as THREE.AnimationMixer|undefined;mixer?.update(dt);
        const walk=root.userData.walkAction as THREE.AnimationAction|undefined,idle=root.userData.idleAction as THREE.AnimationAction|undefined;
        if(walk&&idle){if(moving&&!walk.isRunning()){idle.fadeOut(.18);walk.reset().fadeIn(.18).play();}else if(!moving&&walk.isRunning()){walk.fadeOut(.18);idle.reset().fadeIn(.18).play();}}
        const focus=new THREE.Vector3(root.position.x,1.35,root.position.z);const shift=focus.clone().sub(controls.target);controls.target.copy(focus);camera.position.add(shift);camera.position.y=THREE.MathUtils.clamp(camera.position.y,2.2,7.2);
        const petObj=petRef.current;if(petObj){const behind=new THREE.Vector3(-Math.sin(root.rotation.y)*1.05,0,-Math.cos(root.rotation.y)*1.05).add(root.position);petObj.position.lerp(behind,Math.min(1,dt*3.4));petObj.rotation.y=THREE.MathUtils.lerp(petObj.rotation.y,root.rotation.y,Math.min(1,dt*4));}
        const current=ROOM_NAMES.find(r=>r.test(root.position.x,root.position.z))?.name||"My Home";if(current!==lastRoom){lastRoom=current;setRoom(current);}
      }
      controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(loop);
    };loop();
    return()=>{disposed=true;cancelAnimationFrame(raf);window.removeEventListener("resize",resize);window.removeEventListener("keydown",kd);window.removeEventListener("keyup",ku);renderer.domElement.removeEventListener("pointerdown",pd);renderer.domElement.removeEventListener("pointerup",pu);controls.dispose();renderer.dispose();mount.innerHTML="";rootRef.current=null;petRef.current=null;};
  },[payload?.state.selectedCharacter,payload?.state.equipped.home,payload?.state.equipped.pet,payload?.state.furniture.join("|")]);

  const move=(key:string,on:boolean)=>{if(on)keysRef.current.add(key);else keysRef.current.delete(key);};
  const reset=()=>{const r=rootRef.current,c=cameraRef.current,o=controlsRef.current;if(r&&c&&o){r.position.set(0,0,7.2);targetRef.current.copy(r.position);c.position.set(0,5.2,13.2);o.target.set(0,1.35,7.2);o.update();setNotice("Back at the front door.");}};
  const ownedHomes=(payload?.catalog||[]).filter(x=>x.type==="home"&&payload?.state.purchased.includes(x.id));
  const ownedFurniture=(payload?.catalog||[]).filter(x=>x.type==="furniture"&&payload?.state.purchased.includes(x.id));

  return <main className="club-world-root relative h-[100dvh] overflow-hidden bg-slate-950 text-white">
    <div ref={mountRef} className="absolute inset-0 touch-none"/>
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-slate-950/95 via-slate-950/65 to-transparent p-2.5 sm:p-4">
      <button onClick={()=>navigate("/neighborhood")} className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/85 px-3 font-black shadow-xl"><ArrowLeft className="h-4 w-4"/><span className="hidden sm:inline">The Block</span></button>
      <div className="min-w-0 flex-1 text-center sm:text-left"><p className="text-[9px] font-black uppercase tracking-[.22em] text-cyan-300">Inside My Home</p><h1 className="truncate text-base font-black sm:text-xl">{room}</h1></div>
      <button onClick={()=>setDecorate(true)} className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-2xl bg-fuchsia-600/90 px-3 text-xs font-black shadow-xl"><Paintbrush className="h-4 w-4"/><span className="hidden sm:inline">Decorate</span></button>
      <button onClick={reset} className="pointer-events-auto grid h-11 w-11 place-items-center rounded-2xl bg-slate-950/85 shadow-xl" aria-label="Reset home view"><RotateCcw className="h-4 w-4"/></button>
    </header>

    <div className="pointer-events-none absolute left-1/2 top-[74px] z-20 -translate-x-1/2 rounded-full bg-slate-950/70 px-3 py-1 text-[10px] font-black text-white/85 backdrop-blur sm:top-24">Drag to look · pinch to zoom · tap floor to walk</div>

    <div className="absolute bottom-5 left-4 z-40 grid grid-cols-3 gap-1.5 rounded-[1.6rem] border border-white/10 bg-slate-950/75 p-2 shadow-2xl backdrop-blur lg:hidden" aria-label="Home movement controls">
      <span/><button aria-label="Walk forward" onPointerDown={e=>{e.preventDefault();move("w",true)}} onPointerUp={()=>move("w",false)} onPointerCancel={()=>move("w",false)} onPointerLeave={()=>move("w",false)} className="grid h-12 w-12 place-items-center rounded-xl bg-white/15 active:bg-cyan-300 active:text-slate-950"><ArrowUp/></button><span/>
      <button aria-label="Walk left" onPointerDown={e=>{e.preventDefault();move("a",true)}} onPointerUp={()=>move("a",false)} onPointerCancel={()=>move("a",false)} onPointerLeave={()=>move("a",false)} className="grid h-12 w-12 place-items-center rounded-xl bg-white/15 active:bg-cyan-300 active:text-slate-950"><ArrowLeft/></button>
      <button aria-label="Walk backward" onPointerDown={e=>{e.preventDefault();move("s",true)}} onPointerUp={()=>move("s",false)} onPointerCancel={()=>move("s",false)} onPointerLeave={()=>move("s",false)} className="grid h-12 w-12 place-items-center rounded-xl bg-white/15 active:bg-cyan-300 active:text-slate-950"><ArrowDown/></button>
      <button aria-label="Walk right" onPointerDown={e=>{e.preventDefault();move("d",true)}} onPointerUp={()=>move("d",false)} onPointerCancel={()=>move("d",false)} onPointerLeave={()=>move("d",false)} className="grid h-12 w-12 place-items-center rounded-xl bg-white/15 active:bg-cyan-300 active:text-slate-950"><ArrowRight/></button>
    </div>

    <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 max-w-[72vw] -translate-x-1/2 rounded-xl bg-slate-950/72 px-3 py-2 text-center text-[10px] font-bold text-white/80 backdrop-blur sm:text-xs">{notice}</div>

    {decorate&&payload&&<div className="fixed inset-0 z-[100] flex items-end bg-black/70 p-2 backdrop-blur-sm sm:items-center sm:justify-center" onClick={()=>setDecorate(false)}>
      <section className="max-h-[78dvh] w-full overflow-y-auto rounded-t-[2rem] border border-white/10 bg-slate-950 p-4 shadow-2xl sm:max-w-xl sm:rounded-[2rem]" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center gap-3"><div className="flex-1"><p className="text-xs font-black uppercase tracking-widest text-cyan-300">My Home</p><h2 className="text-2xl font-black">Decorate & Change House</h2></div><button onClick={()=>setDecorate(false)} className="grid h-11 w-11 place-items-center rounded-xl bg-white/10"><X/></button></div>
        <p className="mt-2 text-sm font-bold text-white/55">Changes happen inside the house immediately.</p>
        <h3 className="mt-5 font-black">House style</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">{ownedHomes.map(home=><button key={home.id} disabled={!!busy} onClick={()=>void customize({action:"equip",slot:"home",itemId:home.id})} className={"min-h-16 rounded-xl border p-3 text-left font-black "+(payload.state.equipped.home===home.id?"border-cyan-200 bg-cyan-300 text-slate-950":"border-white/10 bg-white/5")}><span className="block">{home.name}</span><span className="text-[10px] uppercase opacity-60">{home.rarity}</span></button>)}</div>
        <h3 className="mt-5 font-black">Furniture</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">{ownedFurniture.length?ownedFurniture.map(item=>{const active=payload.state.furniture.includes(item.id);return <button key={item.id} disabled={!!busy} onClick={()=>void customize({action:"furniture",itemIds:active?payload.state.furniture.filter(id=>id!==item.id):[...payload.state.furniture,item.id]})} className={"min-h-16 rounded-xl border p-3 text-left font-black "+(active?"border-emerald-200 bg-emerald-300 text-slate-950":"border-white/10 bg-white/5")}><span className="block">{item.name}</span><span className="text-[10px] uppercase opacity-60">{active?"Placed":"Tap to place"}</span></button>}):<p className="col-span-2 rounded-xl bg-white/5 p-3 text-sm font-bold text-white/60">Unlock furniture in the Avatar World Shop, then place it here.</p>}</div>
        <button onClick={()=>navigate("/avatar-world")} className="mt-5 min-h-12 w-full rounded-xl bg-amber-300 font-black text-slate-950">Open Avatar World Shop</button>
      </section>
    </div>}

    {!payload&&<div className="absolute inset-0 z-50 grid place-items-center bg-slate-950"><div className="text-center"><Home className="mx-auto h-11 w-11 text-cyan-300"/><p className="mt-3 font-black">Opening your house…</p></div></div>}
  </main>;
}
