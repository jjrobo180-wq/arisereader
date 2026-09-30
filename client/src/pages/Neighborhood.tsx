import { useEffect,useMemo,useRef,useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ArrowLeft, Home, Lock, Map as MapIcon, ShoppingBag, Unlock, Users, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { getAvatarCharacter } from "@/lib/avatarCharacters";
import { createPet, findPetRoot, openPetCare } from "@/lib/pets";
import { createWorldModel } from "@/lib/worldModels";
import { createWorldExit } from "@/lib/worldPortal";
import WorldLoadingOverlay from "@/components/WorldLoadingOverlay";
import MobileJoystick from "@/components/MobileJoystick";

type Visitor={userId:number;displayName:string;characterId:string;petId:string;homeId:string;lot:number;x:number;z:number;facing:number;updatedAt:number};
type Property={ownerId:number;displayName:string;homeId:string;propertyId:string;lot:number;x:number;z:number;unlocked:boolean;updatedAt:number};

function label(text:string,color="#0f172a"){
  const canvas=document.createElement("canvas");canvas.width=640;canvas.height=150;
  const c=canvas.getContext("2d")!;c.fillStyle=color;c.beginPath();c.roundRect(14,18,612,112,32);c.fill();
  c.fillStyle="#fff";c.font="800 40px system-ui";c.textAlign="center";c.textBaseline="middle";c.fillText(text.length>26?text.slice(0,25)+"…":text,320,74);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));sprite.scale.set(5.4,1.28,1);sprite.renderOrder=20;return sprite;
}
function block(scene:THREE.Scene,size:[number,number,number],position:[number,number,number],color:number){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:.88}));mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
function yardColor(ownerId:number){const colors=[0x8fcf79,0x78bd70,0x9acb74,0x70b982,0xa2cc80,0x80c58a];return colors[Math.abs(ownerId)%colors.length];}

export default function Neighborhood(){
  const {token}=useAuth();const [,navigate]=useLocation();
  const [leavingWorld,setLeavingWorld]=useState(false);
  const mountRef=useRef<HTMLDivElement>(null);
  const sceneRef=useRef<THREE.Scene|null>(null);
  const selfRootRef=useRef<THREE.Group|null>(null);
  const remoteRootsRef=useRef(new Map<number,THREE.Group>());
  const propertyRootsRef=useRef(new Map<string,THREE.Group>());
  const cameraRef=useRef<THREE.PerspectiveCamera|null>(null);
  const controlsRef=useRef<OrbitControls|null>(null);
  const targetRef=useRef(new THREE.Vector3());
  const keysRef=useRef(new Set<string>());
  const enteringRef=useRef(false);
  const [self,setSelf]=useState<Visitor|null>(null);
  const [players,setPlayers]=useState<Visitor[]>([]);
  const [homes,setHomes]=useState<Property[]>([]);
  const [myHome,setMyHome]=useState<Property|null>(null);
  const [ready,setReady]=useState(false);
  const [notice,setNotice]=useState("Use the joystick to explore. Walk to a front door to enter.");
  const [showReaders,setShowReaders]=useState(false);
  const [cameraMode,setCameraMode]=useState<"pan"|"rotate">("rotate");
  const headers=useMemo(()=>({Authorization:"Bearer "+token,"Content-Type":"application/json"}),[token]);

  const loadHomes=async()=>{
    if(!token)return;
    try{
      const response=await fetch(API_BASE+"/api/homes/neighborhood",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
      const data=await response.json();if(!response.ok)throw Error(data.message||"Could not load homes.");
      setHomes(data.homes||[]);setMyHome(data.myHome||null);
    }catch(error:any){setNotice(error.message||"Could not load homes.");}
  };

  useEffect(()=>{
    if(!token)return;let active=true;
    Promise.all([
      fetch(API_BASE+"/api/neighborhood/bootstrap",{headers:{Authorization:"Bearer "+token},cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.message||"Could not enter The Block.");return d;}),
      fetch(API_BASE+"/api/homes/neighborhood",{headers:{Authorization:"Bearer "+token},cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.message||"Could not load homes.");return d;})
    ]).then(([world,property])=>{if(!active)return;setSelf(world.self);setPlayers(world.players||[]);setHomes(property.homes||[]);setMyHome(property.myHome||null);})
      .catch(error=>{if(active)setNotice(error.message);});
    return()=>{active=false;void fetch(API_BASE+"/api/neighborhood/leave",{method:"POST",headers:{Authorization:"Bearer "+token},keepalive:true}).catch(()=>{});};
  },[token]);

  const centerOn=(x:number,z:number)=>{
    const camera=cameraRef.current,controls=controlsRef.current;if(!camera||!controls)return;
    const focus=new THREE.Vector3(x,1.5,z);camera.position.add(focus.clone().sub(controls.target));controls.target.copy(focus);controls.update();
  };
  const goHome=()=>{
    if(!myHome){setNotice("You do not own a home yet. Buy one in Avatar World first.");return;}
    const doorZ=myHome.z>0?myHome.z-5.1:myHome.z+5.1;targetRef.current.set(myHome.x,0,doorZ);centerOn(myHome.x,myHome.z);setNotice("Walking to your front door…");
  };
  const walkTo=(player:Visitor)=>{targetRef.current.set(player.x+1.5,0,player.z);centerOn(player.x,player.z);setShowReaders(false);setNotice("Walking to "+player.displayName+"…");};
  const enterHome=(home:Property)=>{
    if(enteringRef.current)return;
    if(home.ownerId!==self?.userId&&!home.unlocked){setNotice("🔒 "+home.displayName+"'s door is locked.");return;}
    enteringRef.current=true;setNotice("Entering "+(home.ownerId===self?.userId?"your home":home.displayName+"'s home")+"…");
    navigate("/my-home?owner="+home.ownerId);
  };

  useEffect(()=>{
    const mount=mountRef.current;if(!mount||!self)return;let disposed=false;
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x9ed9ff);scene.fog=new THREE.Fog(0x9ed9ff,58,115);sceneRef.current=scene;
    const camera=new THREE.PerspectiveCamera(52,1,.1,180);camera.position.set(self.x,11,self.z+17);cameraRef.current=camera;
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;mount.innerHTML="";mount.appendChild(renderer.domElement);
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(self.x,1.4,self.z);controls.enableDamping=true;controls.dampingFactor=.08;controls.maxPolarAngle=Math.PI*.47;controls.minPolarAngle=.35;controls.minDistance=7;controls.maxDistance=30;controls.enablePan=false;controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;controlsRef.current=controls;
    scene.add(new THREE.HemisphereLight(0xffffff,0x5f8d5b,2.6));const sunlight=new THREE.DirectionalLight(0xfff2d5,3);sunlight.position.set(-22,34,18);sunlight.castShadow=true;sunlight.shadow.mapSize.set(2048,2048);scene.add(sunlight);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(78,58),new THREE.MeshStandardMaterial({color:0x78b96b,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.userData.ground=true;scene.add(ground);
    block(scene,[76,.12,8],[0,.06,0],0x3f4b59);for(const z of [-5,5])block(scene,[76,.15,1.4],[0,.08,z],0xdce2e7);for(let x=-34;x<=34;x+=7)block(scene,[3,.025,.12],[x,.14,0],0xfff3b0);
    createWorldExit(scene,0,-25,0x38bdf8);
    const loader=new GLTFLoader();
    const createAvatar=(visitor:Visitor)=>{
      const root=new THREE.Group();root.position.set(visitor.x,0,visitor.z);root.userData.userId=visitor.userId;scene.add(root);const tag=label(visitor.displayName,visitor.userId===self.userId?"#0369a1":"#1e293b");tag.position.y=3.4;root.add(tag);
      loader.load(getAvatarCharacter(visitor.characterId).modelPath,gltf=>{if(disposed)return;const model=gltf.scene,b=new THREE.Box3().setFromObject(model),s=b.getSize(new THREE.Vector3());model.scale.setScalar(2.5/Math.max(.01,s.y));model.updateMatrixWorld(true);const n=new THREE.Box3().setFromObject(model);model.position.y=-n.min.y;root.add(model);if(gltf.animations.length){const mixer=new THREE.AnimationMixer(model);mixer.clipAction(gltf.animations.find(a=>/idle/i.test(a.name))||gltf.animations[0]).play();root.userData.mixer=mixer;}});
      const pet=createPet(visitor.petId,loader,.9);if(pet){pet.position.set(.85,0,.5);root.add(pet);}return root;
    };
    selfRootRef.current=createAvatar(self);targetRef.current.set(self.x,0,self.z);
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let pointerStart:{x:number;y:number;id:number}|null=null;
    const pointerDown=(e:PointerEvent)=>pointerStart={x:e.clientX,y:e.clientY,id:e.pointerId};
    const pointerUp=(e:PointerEvent)=>{if(!pointerStart||pointerStart.id!==e.pointerId)return;const moved=Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y);pointerStart=null;if(moved>10)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(scene.children,true);const petHit=hits.find(hit=>{const p=findPetRoot(hit.object);return !!p&&p.parent===selfRootRef.current;});if(petHit){openPetCare();return;}const portal=hits.some(hit=>{let n:THREE.Object3D|null=hit.object;while(n){if(n.userData.worldExit)return true;n=n.parent;}return false;});if(portal){setLeavingWorld(true);return;}const hit=raycaster.intersectObject(ground)[0];if(hit)targetRef.current.set(THREE.MathUtils.clamp(hit.point.x,-34,34),0,THREE.MathUtils.clamp(hit.point.z,-23,23));};
    const kd=(e:KeyboardEvent)=>keysRef.current.add(e.key.toLowerCase()),ku=(e:KeyboardEvent)=>keysRef.current.delete(e.key.toLowerCase());renderer.domElement.addEventListener("pointerdown",pointerDown);renderer.domElement.addEventListener("pointerup",pointerUp);window.addEventListener("keydown",kd);window.addEventListener("keyup",ku);
    const resize=()=>{camera.aspect=mount.clientWidth/Math.max(1,mount.clientHeight);camera.updateProjectionMatrix();renderer.setSize(mount.clientWidth,mount.clientHeight);};resize();window.addEventListener("resize",resize);
    const clock=new THREE.Clock();let frame=0;
    const render=()=>{if(disposed)return;const dt=Math.min(.05,clock.getDelta()),root=selfRootRef.current;if(root){let side=0,forwardInput=0,k=keysRef.current;if(k.has("w")||k.has("arrowup"))forwardInput+=1;if(k.has("s")||k.has("arrowdown"))forwardInput-=1;if(k.has("d")||k.has("arrowright"))side+=1;if(k.has("a")||k.has("arrowleft"))side-=1;if(side||forwardInput){const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize().multiplyScalar(-1);const step=forward.multiplyScalar(forwardInput).add(right.multiplyScalar(side)).normalize().multiplyScalar(5.4*dt);root.position.add(step);root.rotation.y=Math.atan2(step.x,step.z);targetRef.current.copy(root.position);}else{const delta=targetRef.current.clone().sub(root.position);delta.y=0;if(delta.length()>.16){delta.normalize();root.position.addScaledVector(delta,4.6*dt);root.rotation.y=Math.atan2(delta.x,delta.z);}}root.position.x=THREE.MathUtils.clamp(root.position.x,-34,34);root.position.z=THREE.MathUtils.clamp(root.position.z,-23,23);if(Math.hypot(root.position.x,root.position.z+25)<1.7){setLeavingWorld(true);return;}(root.userData.mixer as THREE.AnimationMixer|undefined)?.update(dt);
      for(const home of homes){const doorZ=home.z>0?home.z-5.1:home.z+5.1;if(Math.hypot(root.position.x-home.x,root.position.z-doorZ)<1.15){enterHome(home);break;}}
    }remoteRootsRef.current.forEach(r=>(r.userData.mixer as THREE.AnimationMixer|undefined)?.update(dt));controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(render);};render();setReady(true);
    return()=>{disposed=true;cancelAnimationFrame(frame);window.removeEventListener("resize",resize);window.removeEventListener("keydown",kd);window.removeEventListener("keyup",ku);renderer.domElement.removeEventListener("pointerdown",pointerDown);renderer.domElement.removeEventListener("pointerup",pointerUp);controls.dispose();renderer.dispose();remoteRootsRef.current.clear();propertyRootsRef.current.clear();sceneRef.current=null;selfRootRef.current=null;};
  },[self?.userId,token,homes.map(h=>h.propertyId+":"+h.homeId+":"+h.unlocked).join("|")]);

  useEffect(()=>{
    const scene=sceneRef.current;if(!scene||!self)return;const loader=new GLTFLoader();
    propertyRootsRef.current.forEach(root=>scene.remove(root));propertyRootsRef.current.clear();
    for(const home of homes){const root=new THREE.Group();root.position.set(home.x,0,home.z);scene.add(root);propertyRootsRef.current.set(home.propertyId,root);const pad=new THREE.Mesh(new THREE.BoxGeometry(6.5,.1,9.5),new THREE.MeshStandardMaterial({color:yardColor(home.ownerId),roughness:1}));pad.position.y=.05;pad.receiveShadow=true;root.add(pad);const model=createWorldModel(home.homeId,loader,6.5);model.rotation.y=home.z>0?Math.PI:0;root.add(model);const path=new THREE.Mesh(new THREE.BoxGeometry(1.4,.06,5.2),new THREE.MeshStandardMaterial({color:0xd7c7ac,roughness:1}));path.position.set(0,.13,home.z>0?-4.7:4.7);root.add(path);const sign=label((home.ownerId===self.userId?"MY HOME":home.displayName+"'S HOME")+(home.ownerId===self.userId?(home.unlocked?" · UNLOCKED":" · LOCKED"):(home.unlocked?" · OPEN":" · LOCKED")),home.ownerId===self.userId?"#0369a1":home.unlocked?"#166534":"#334155");sign.position.set(0,5.3,0);root.add(sign);}
    const active=new Set<number>();for(const player of players){if(player.userId===self.userId)continue;active.add(player.userId);let root=remoteRootsRef.current.get(player.userId);if(!root){root=new THREE.Group();root.position.set(player.x,0,player.z);scene.add(root);const tag=label(player.displayName);tag.position.y=3.4;root.add(tag);loader.load(getAvatarCharacter(player.characterId).modelPath,gltf=>{const model=gltf.scene,b=new THREE.Box3().setFromObject(model),s=b.getSize(new THREE.Vector3());model.scale.setScalar(2.5/Math.max(.01,s.y));model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model);model.position.y=-box.min.y;root!.add(model);if(gltf.animations.length){const mixer=new THREE.AnimationMixer(model);mixer.clipAction(gltf.animations.find(a=>/idle/i.test(a.name))||gltf.animations[0]).play();root!.userData.mixer=mixer;}});const pet=createPet(player.petId,loader,.9);if(pet){pet.position.set(.85,0,.5);root.add(pet);}remoteRootsRef.current.set(player.userId,root);}root.position.lerp(new THREE.Vector3(player.x,0,player.z),.4);root.rotation.y=THREE.MathUtils.lerp(root.rotation.y,player.facing,.4);}remoteRootsRef.current.forEach((root,id)=>{if(!active.has(id)){scene.remove(root);remoteRootsRef.current.delete(id);}});
  },[homes,players,self?.userId,ready]);

  useEffect(()=>{if(!ready||!self||!token)return;const sync=async()=>{const root=selfRootRef.current;if(!root)return;try{const response=await fetch(API_BASE+"/api/neighborhood/presence",{method:"POST",headers,body:JSON.stringify({x:root.position.x,z:root.position.z,facing:root.rotation.y})});const data=await response.json();if(response.ok)setPlayers(data.players||[]);else if(response.status===409){const reconnect=await fetch(API_BASE+"/api/neighborhood/bootstrap",{headers:{Authorization:"Bearer "+token},cache:"no-store"});const fresh=await reconnect.json();if(reconnect.ok){setSelf(fresh.self);setPlayers(fresh.players||[]);}}}catch{}};void sync();const interval=window.setInterval(sync,900);return()=>window.clearInterval(interval);},[ready,self?.userId,token,headers]);
  useEffect(()=>{const controls=controlsRef.current;if(!controls)return;controls.enablePan=cameraMode==="pan";controls.touches.ONE=cameraMode==="pan"?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;},[cameraMode,ready]);
  useEffect(()=>{if(!leavingWorld)return;const timer=window.setTimeout(()=>navigate("/worlds"),700);return()=>window.clearTimeout(timer);},[leavingWorld,navigate]);

  const neighbors=players.filter(player=>player.userId!==self?.userId);const move=(key:"w"|"a"|"s"|"d",pressed:boolean)=>{if(pressed)keysRef.current.add(key);else keysRef.current.delete(key);};
  return <main className="club-world-root relative h-[100dvh] overflow-hidden bg-sky-300 text-white">
    <div ref={mountRef} className="absolute inset-0 touch-none"/>
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-slate-950/90 to-transparent p-3"><button type="button" onClick={()=>setLeavingWorld(true)} className="pointer-events-auto flex min-h-12 items-center gap-2 rounded-2xl bg-slate-950/80 px-3 font-black"><ArrowLeft className="h-5 w-5"/> Exit</button><div className="flex-1"><h1 className="text-xl font-black">The Block</h1><p className="text-xs font-bold text-white/80">Every purchased home is a separate property</p></div><button type="button" onClick={()=>setShowReaders(v=>!v)} className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-xl bg-slate-950/80 px-3 font-black"><Users className="h-4 w-4"/>{neighbors.length}</button></header>
    <div className="absolute left-3 top-20 z-30 flex max-w-48 flex-col gap-2 rounded-2xl bg-slate-950/84 p-2 backdrop-blur"><button type="button" onClick={goHome} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-300 px-3 font-black text-slate-950"><Home className="h-4 w-4"/> {myHome?"Go home":"No home yet"}</button>{myHome?<button type="button" onClick={()=>enterHome(myHome)} className="min-h-11 rounded-xl bg-cyan-300 px-3 text-sm font-black text-slate-950">Enter my house</button>:<button type="button" onClick={()=>navigate("/avatar-world")} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-fuchsia-500 px-3 text-sm font-black"><ShoppingBag className="h-4 w-4"/> Buy a home</button>}</div>
    <div className="absolute right-3 top-20 z-30 flex flex-col gap-2 rounded-2xl bg-slate-950/84 p-2 text-sm font-black backdrop-blur"><button onClick={()=>setCameraMode("rotate")} className={"min-h-11 rounded-xl px-3 "+(cameraMode==="rotate"?"bg-white text-slate-950":"bg-white/10")}>Rotate view</button><button onClick={()=>setCameraMode("pan")} className={"min-h-11 rounded-xl px-3 "+(cameraMode==="pan"?"bg-white text-slate-950":"bg-white/10")}>Move view</button><button onClick={()=>{const r=selfRootRef.current;if(r)centerOn(r.position.x,r.position.z);}} className="min-h-11 rounded-xl bg-white/10 px-3">Center me</button></div>
    {showReaders&&<aside className="absolute right-3 top-56 z-40 max-h-[48dvh] w-[min(310px,calc(100%-1.5rem))] overflow-y-auto rounded-2xl bg-slate-950/95 p-3 shadow-xl"><div className="flex items-center justify-between"><h2 className="font-black">Neighbors here</h2><button onClick={()=>setShowReaders(false)} className="grid h-10 w-10 place-items-center rounded-lg bg-white/10"><X className="h-4 w-4"/></button></div>{neighbors.length?neighbors.map(player=><button key={player.userId} onClick={()=>walkTo(player)} className="mt-2 min-h-12 w-full rounded-xl bg-white/10 p-3 text-left text-sm font-bold">{player.displayName}<span className="block text-xs text-cyan-200">Walk over</span></button>):<p className="mt-3 text-sm text-white/70">You are the first reader here right now.</p>}<div className="mt-3 border-t border-white/10 pt-3"><p className="text-xs font-black uppercase tracking-widest text-white/45">Homes on the block</p>{homes.map(home=><button key={home.propertyId} onClick={()=>{targetRef.current.set(home.x,0,home.z>0?home.z-5.1:home.z+5.1);centerOn(home.x,home.z);setShowReaders(false);}} className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-xl bg-white/5 px-3 text-left text-xs font-bold">{home.unlocked?<Unlock className="h-4 w-4 text-emerald-300"/>:<Lock className="h-4 w-4 text-amber-300"/>}<span className="truncate">{home.displayName}'s home</span></button>)}</div></aside>}
    <MobileJoystick onMove={move} className="bottom-24 left-3" label="Neighborhood movement controls"/>
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 max-w-[88vw] -translate-x-1/2 rounded-xl bg-slate-950/78 px-4 py-2 text-center text-xs font-bold backdrop-blur">{notice}</div>
    {!self&&<div className="absolute inset-0 z-40 grid place-items-center bg-slate-950/70 p-5 text-center"><div><MapIcon className="mx-auto h-12 w-12 text-cyan-300"/><p className="mt-3 text-xl font-black">Opening The Block…</p></div></div>}
    {leavingWorld&&<WorldLoadingOverlay tone="block" label="Leaving The Block…"/>}
  </main>;
}
