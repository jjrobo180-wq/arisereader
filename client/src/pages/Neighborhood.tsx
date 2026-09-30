import { useEffect,useMemo,useRef,useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ArrowLeft, Home, Map as MapIcon, Users, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { getAvatarCharacter } from "@/lib/avatarCharacters";
import { createPet, findPetRoot, openPetCare } from "@/lib/pets";
import { createWorldModel } from "@/lib/worldModels";
import { createWorldExit } from "@/lib/worldPortal";
import WorldLoadingOverlay from "@/components/WorldLoadingOverlay";

type Visitor={userId:number;displayName:string;characterId:string;petId:string;homeId:string;lot:number;x:number;z:number;facing:number;updatedAt:number};
const LOTS=[
  {x:0,z:15},{x:-12,z:15},{x:12,z:15},{x:-24,z:15},{x:24,z:15},
  {x:0,z:-15},{x:-12,z:-15},{x:12,z:-15},{x:-24,z:-15},{x:24,z:-15},
];

function label(text:string,color="#0f172a"){
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;
  const context=canvas.getContext("2d")!;context.fillStyle=color;context.beginPath();context.roundRect(12,16,488,96,28);context.fill();
  context.fillStyle="#fff";context.font="bold 37px system-ui";context.textAlign="center";context.textBaseline="middle";
  context.fillText(text.length>21?text.slice(0,20)+"…":text,256,64);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));sprite.scale.set(4.7,1.2,1);sprite.renderOrder=5;return sprite;
}
function block(scene:THREE.Scene,size:[number,number,number],position:[number,number,number],color:number){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:.85}));
  mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
}

export default function Neighborhood(){
  const {token}=useAuth();const [,navigate]=useLocation();
  const [leavingWorld,setLeavingWorld]=useState(false);
  const mountRef=useRef<HTMLDivElement>(null);
  const sceneRef=useRef<THREE.Scene|null>(null);
  const selfRootRef=useRef<THREE.Group|null>(null);
  const remoteRootsRef=useRef(new Map<number,THREE.Group>());
  const lotRootsRef=useRef(new Map<number,THREE.Group>());
  const cameraRef=useRef<THREE.PerspectiveCamera|null>(null);
  const controlsRef=useRef<OrbitControls|null>(null);
  const targetRef=useRef(new THREE.Vector3());
  const keysRef=useRef(new Set<string>());
  const [self,setSelf]=useState<Visitor|null>(null);
  const [players,setPlayers]=useState<Visitor[]>([]);
  const [ready,setReady]=useState(false);
  const [notice,setNotice]=useState("Click the street to walk, or use WASD / arrow keys.");
  const [showReaders,setShowReaders]=useState(false);
  const [cameraMode,setCameraMode]=useState<"pan"|"rotate">("pan");
  const headers=useMemo(()=>({Authorization:"Bearer "+token,"Content-Type":"application/json"}),[token]);

  useEffect(()=>{
    if(!token)return;
    let active=true;
    fetch(API_BASE+"/api/neighborhood/bootstrap",{headers:{Authorization:"Bearer "+token},cache:"no-store"})
      .then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.message||"Could not enter The Block.");return data;})
      .then(data=>{if(active){setSelf(data.self);setPlayers(data.players||[]);}})
      .catch(error=>{if(active)setNotice(error.message);});
    return()=>{active=false;void fetch(API_BASE+"/api/neighborhood/leave",{method:"POST",headers:{Authorization:"Bearer "+token},keepalive:true}).catch(()=>{});};
  },[token]);

  const centerOn=(x:number,z:number)=>{
    const camera=cameraRef.current,controls=controlsRef.current;if(!camera||!controls)return;
    const focus=new THREE.Vector3(x,1.3,z);camera.position.add(focus.clone().sub(controls.target));controls.target.copy(focus);controls.update();
  };
  const goHome=()=>{
    if(!self||self.lot<0){setNotice("Your house will appear when a lot is free.");return;}
    const lot=LOTS[self.lot];targetRef.current.set(lot.x,0,lot.z>0?9:-9);centerOn(lot.x,lot.z);
    setNotice("Heading to "+self.displayName+"'s house…");
  };
  const walkTo=(player:Visitor)=>{targetRef.current.set(player.x+1.5,0,player.z);centerOn(player.x,player.z);setShowReaders(false);setNotice("Walking to "+player.displayName+"…");};

  useEffect(()=>{
    const mount=mountRef.current;if(!mount||!self)return;
    let disposed=false;
    const scene=new THREE.Scene();scene.background=new THREE.Color(0xa7dafa);scene.fog=new THREE.FogExp2(0xa7dafa,.012);sceneRef.current=scene;
    const camera=new THREE.PerspectiveCamera(52,1,.1,160);camera.position.set(self.x,18,self.z+25);cameraRef.current=camera;
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;mount.appendChild(renderer.domElement);
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(self.x,1.3,self.z);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.47;controls.minDistance=8;controls.maxDistance=45;controls.mouseButtons.LEFT=THREE.MOUSE.PAN;controls.mouseButtons.RIGHT=THREE.MOUSE.ROTATE;controls.touches.ONE=THREE.TOUCH.PAN;controlsRef.current=controls;
    scene.add(new THREE.HemisphereLight(0xffffff,0x91b38b,2.3));
    const sunlight=new THREE.DirectionalLight(0xfff2d5,2.4);sunlight.position.set(-16,32,15);sunlight.castShadow=true;scene.add(sunlight);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(80,62),new THREE.MeshStandardMaterial({color:0x7cab67,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.userData.ground=true;scene.add(ground);
    block(scene,[76,.12,8],[0,.06,0],0x475569);
    for(const z of [-5,5])block(scene,[76,.15,1.4],[0,.08,z],0xd7dce1);
    for(let x=-34;x<=34;x+=7)block(scene,[3,.025,.12],[x,.14,0],0xfef3c7);
    createWorldExit(scene,0,-25,0x38bdf8);
    const loader=new GLTFLoader();
    LOTS.forEach((lot,i)=>{
      const root=new THREE.Group();root.position.set(lot.x,0,lot.z);scene.add(root);lotRootsRef.current.set(i,root);
      const pad=new THREE.Mesh(new THREE.BoxGeometry(10,.1,10),new THREE.MeshStandardMaterial({color:i%2?0x83b971:0x91c980}));pad.position.y=.06;pad.receiveShadow=true;root.add(pad);
      const path=new THREE.Mesh(new THREE.BoxGeometry(1.3,.06,6),new THREE.MeshStandardMaterial({color:0xd4c9b6}));path.position.set(0,.14,lot.z>0?-5:5);root.add(path);
    });
    for(const x of [-30,-18,-6,6,18,30])for(const z of [-7,7]){
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.24,.3,2.4,8),new THREE.MeshStandardMaterial({color:0x806143}));trunk.position.set(x,1.2,z);scene.add(trunk);
      const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.8,1),new THREE.MeshStandardMaterial({color:(x+z)%3?0x318f59:0x51a362,roughness:1}));crown.position.set(x,3.2,z);crown.castShadow=true;scene.add(crown);
    }
    const createAvatar=(visitor:Visitor)=>{
      const root=new THREE.Group();root.position.set(visitor.x,0,visitor.z);root.userData.userId=visitor.userId;scene.add(root);
      const tag=label(visitor.displayName,visitor.userId===self.userId?"#0369a1":"#1e293b");tag.position.y=3.4;root.add(tag);
      loader.load(getAvatarCharacter(visitor.characterId).modelPath,gltf=>{
        if(disposed)return;const model=gltf.scene;const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());model.scale.setScalar(2.5/Math.max(.01,size.y));model.updateMatrixWorld(true);const normalized=new THREE.Box3().setFromObject(model);model.position.y=-normalized.min.y;root.add(model);
        if(gltf.animations.length){const mixer=new THREE.AnimationMixer(model);const idle=gltf.animations.find(clip=>/idle/i.test(clip.name))||gltf.animations[0];mixer.clipAction(idle).play();root.userData.mixer=mixer;}
      });
      const pet=createPet(visitor.petId,loader,.9);if(pet){pet.position.set(.85,0,.5);root.add(pet);}
      return root;
    };
    selfRootRef.current=createAvatar(self);targetRef.current.set(self.x,0,self.z);
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
    let pointerStart:{x:number;y:number;id:number}|null=null;
    const pointerDown=(event:PointerEvent)=>{pointerStart={x:event.clientX,y:event.clientY,id:event.pointerId};};
    const pointerUp=(event:PointerEvent)=>{
      if(!pointerStart||pointerStart.id!==event.pointerId)return;
      const moved=Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y);pointerStart=null;if(moved>10)return;
      const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
      const hits=raycaster.intersectObjects(scene.children,true);
      const ownPetHit=hits.find(hit=>{const petRoot=findPetRoot(hit.object);return !!petRoot&&petRoot.parent===selfRootRef.current;});
      if(ownPetHit){openPetCare();return;}
      const portalHit=hits.some(hit=>{let node:THREE.Object3D|null=hit.object;while(node){if(node.userData.worldExit)return true;node=node.parent;}return false;});
      if(portalHit){setLeavingWorld(true);return;}
      const groundHit=raycaster.intersectObject(ground)[0];if(groundHit)targetRef.current.set(THREE.MathUtils.clamp(groundHit.point.x,-31,31),0,THREE.MathUtils.clamp(groundHit.point.z,-22,22));
    };
    const keyDown=(event:KeyboardEvent)=>keysRef.current.add(event.key.toLowerCase());
    const keyUp=(event:KeyboardEvent)=>keysRef.current.delete(event.key.toLowerCase());
    renderer.domElement.addEventListener("pointerdown",pointerDown);renderer.domElement.addEventListener("pointerup",pointerUp);
    window.addEventListener("keydown",keyDown);window.addEventListener("keyup",keyUp);
    const resize=()=>{const width=mount.clientWidth,height=mount.clientHeight;camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();renderer.setSize(width,height);};resize();window.addEventListener("resize",resize);
    const clock=new THREE.Clock();let frame=0;
    const render=()=>{if(disposed)return;const dt=Math.min(.05,clock.getDelta()),root=selfRootRef.current;
      if(root){let dx=0,dz=0;const keys=keysRef.current;if(keys.has("w")||keys.has("arrowup"))dz-=1;if(keys.has("s")||keys.has("arrowdown"))dz+=1;if(keys.has("a")||keys.has("arrowleft"))dx-=1;if(keys.has("d")||keys.has("arrowright"))dx+=1;
        if(dx||dz){const step=new THREE.Vector3(dx,0,dz).normalize().multiplyScalar(5*dt);root.position.add(step);root.rotation.y=Math.atan2(step.x,step.z);targetRef.current.copy(root.position);}
        else{const delta=targetRef.current.clone().sub(root.position);delta.y=0;if(delta.length()>.18){delta.normalize();root.position.addScaledVector(delta,4*dt);root.rotation.y=Math.atan2(delta.x,delta.z);}}
        root.position.x=THREE.MathUtils.clamp(root.position.x,-31,31);root.position.z=THREE.MathUtils.clamp(root.position.z,-27,22);
        if(Math.hypot(root.position.x,root.position.z+25)<1.7){setLeavingWorld(true);return;}
        (root.userData.mixer as THREE.AnimationMixer|undefined)?.update(dt);
      }
      remoteRootsRef.current.forEach(remote=>(remote.userData.mixer as THREE.AnimationMixer|undefined)?.update(dt));
      controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(render);
    };render();setReady(true);
    return()=>{disposed=true;cancelAnimationFrame(frame);window.removeEventListener("resize",resize);window.removeEventListener("keydown",keyDown);window.removeEventListener("keyup",keyUp);renderer.domElement.removeEventListener("pointerdown",pointerDown);renderer.domElement.removeEventListener("pointerup",pointerUp);controls.dispose();renderer.dispose();remoteRootsRef.current.clear();lotRootsRef.current.clear();sceneRef.current=null;selfRootRef.current=null;if(renderer.domElement.parentElement===mount)mount.removeChild(renderer.domElement);};
  },[self?.userId,token]);

  useEffect(()=>{
    if(!ready||!self||!token)return;
    const sync=async()=>{const root=selfRootRef.current;if(!root)return;
      try{const response=await fetch(API_BASE+"/api/neighborhood/presence",{method:"POST",headers,body:JSON.stringify({x:root.position.x,z:root.position.z,facing:root.rotation.y})});const data=await response.json();
        if(response.ok)setPlayers(data.players||[]);
        else if(response.status===409){const reconnect=await fetch(API_BASE+"/api/neighborhood/bootstrap",{headers:{Authorization:"Bearer "+token},cache:"no-store"});const fresh=await reconnect.json();if(reconnect.ok){setSelf(fresh.self);setPlayers(fresh.players||[]);setNotice("Reconnected to The Block.");}}
        else setNotice(data.message||"Could not update The Block.");
      }catch{}
    };
    void sync();const interval=window.setInterval(sync,850);return()=>window.clearInterval(interval);
  },[ready,self?.userId,token,headers]);

  useEffect(()=>{
    const scene=sceneRef.current;if(!scene||!self)return;
    const loader=new GLTFLoader();
    LOTS.forEach((_,lot)=>{
      const root=lotRootsRef.current.get(lot);if(!root)return;
      const owner=players.find(player=>player.lot===lot);
      const homeId=owner?.homeId||"home-basic";
      if(root.userData.homeId!==homeId){const old=root.getObjectByName("houseModel");if(old)root.remove(old);const model=createWorldModel(homeId,loader,7.2);model.name="houseModel";model.rotation.y=lot<5?Math.PI:0;root.add(model);root.userData.homeId=homeId;}
      const title=owner?.userId===self.userId?"MY HOME":owner?owner.displayName+"'S HOME":"NEIGHBOR HOME";
      if(root.userData.title!==title){const old=root.getObjectByName("houseLabel");if(old)root.remove(old);const tag=label(title,owner?.userId===self.userId?"#0369a1":"#334155");tag.name="houseLabel";tag.position.y=5.3;root.add(tag);root.userData.title=title;}
    });
    const active=new Set<number>();
    for(const player of players){if(player.userId===self.userId)continue;active.add(player.userId);
      let root=remoteRootsRef.current.get(player.userId);
      if(!root){root=new THREE.Group();root.position.set(player.x,0,player.z);scene.add(root);const tag=label(player.displayName);tag.position.y=3.4;root.add(tag);
        loader.load(getAvatarCharacter(player.characterId).modelPath,gltf=>{const model=gltf.scene;const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());model.scale.setScalar(2.5/Math.max(.01,size.y));model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model);model.position.y=-box.min.y;root!.add(model);if(gltf.animations.length){const mixer=new THREE.AnimationMixer(model);mixer.clipAction(gltf.animations.find(clip=>/idle/i.test(clip.name))||gltf.animations[0]).play();root!.userData.mixer=mixer;}});
        const pet=createPet(player.petId,loader,.9);if(pet){pet.position.set(.85,0,.5);root.add(pet);}remoteRootsRef.current.set(player.userId,root);
      }
      root.position.lerp(new THREE.Vector3(player.x,0,player.z),.4);root.rotation.y=THREE.MathUtils.lerp(root.rotation.y,player.facing,.4);
    }
    remoteRootsRef.current.forEach((root,id)=>{if(!active.has(id)){scene.remove(root);remoteRootsRef.current.delete(id);}});
  },[players,self?.userId,ready]);

  useEffect(()=>{const controls=controlsRef.current;if(!controls)return;controls.mouseButtons.LEFT=cameraMode==="pan"?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;controls.touches.ONE=cameraMode==="pan"?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;},[cameraMode,ready]);

  useEffect(()=>{
    if(!leavingWorld)return;
    const timer=window.setTimeout(()=>navigate("/worlds"),800);
    return()=>window.clearTimeout(timer);
  },[leavingWorld,navigate]);

  const neighbors=players.filter(player=>player.userId!==self?.userId);
  return <main className="club-world-root relative h-[100dvh] overflow-hidden bg-sky-300 text-white">
    <div ref={mountRef} className="absolute inset-0"/>
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-slate-950/85 to-transparent p-3">
      <button type="button" onClick={()=>setLeavingWorld(true)} className="pointer-events-auto flex min-h-12 items-center gap-2 rounded-2xl bg-slate-950/75 px-3 font-black"><ArrowLeft className="h-5 w-5"/> Exit to worlds</button>
      <div className="flex-1"><h1 className="text-xl font-black">The Block</h1><p className="text-xs font-bold text-white/80">Your neighborhood · your home</p></div>
      <button type="button" onClick={()=>setShowReaders(value=>!value)} className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-xl bg-slate-950/75 px-3 font-black" aria-expanded={showReaders}><Users className="h-4 w-4"/>{neighbors.length}</button>
    </header>
    <div className="absolute left-3 top-20 z-30 flex max-w-44 flex-col gap-2 rounded-2xl bg-slate-950/80 p-2 backdrop-blur">
      <button type="button" onClick={goHome} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-300 px-3 font-black text-slate-950"><Home className="h-4 w-4"/> Go home</button>
      <button type="button" onClick={()=>navigate("/my-home")} className="min-h-11 rounded-xl bg-cyan-300 px-3 text-sm font-black text-slate-950">Enter my house</button>
    </div>
    <div className="absolute right-3 top-20 z-30 flex flex-col gap-2 rounded-2xl bg-slate-950/80 p-2 text-sm font-black backdrop-blur">
      <button type="button" onClick={()=>setCameraMode("pan")} className={"min-h-11 rounded-xl px-3 "+(cameraMode==="pan"?"bg-white text-slate-950":"bg-white/10")}>Move view</button>
      <button type="button" onClick={()=>setCameraMode("rotate")} className={"min-h-11 rounded-xl px-3 "+(cameraMode==="rotate"?"bg-white text-slate-950":"bg-white/10")}>Rotate</button>
      <button type="button" onClick={()=>{const root=selfRootRef.current;if(root)centerOn(root.position.x,root.position.z);}} className="min-h-11 rounded-xl bg-white/10 px-3">Center me</button>
    </div>
    {showReaders&&<aside className="absolute right-3 top-56 z-40 max-h-[48dvh] w-[min(310px,calc(100%-1.5rem))] overflow-y-auto rounded-2xl bg-slate-950/95 p-3 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="font-black">Neighbors here</h2><button type="button" onClick={()=>setShowReaders(false)} className="grid h-10 w-10 place-items-center rounded-lg bg-white/10" aria-label="Close neighbors"><X className="h-4 w-4"/></button></div>
      {neighbors.length?neighbors.map(player=><button type="button" key={player.userId} onClick={()=>walkTo(player)} className="mt-2 min-h-12 w-full rounded-xl bg-white/10 p-3 text-left text-sm font-bold">{player.displayName}<span className="block text-xs text-cyan-200">Walk over</span></button>):<p className="mt-3 text-sm text-white/70">You are the first reader on the block right now.</p>}
    </aside>}
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 max-w-[90vw] -translate-x-1/2 rounded-xl bg-slate-950/75 px-4 py-2 text-center text-xs font-bold backdrop-blur">{notice}</div>
    {!self&&<div className="absolute inset-0 z-40 grid place-items-center bg-slate-950/70 p-5 text-center"><div><MapIcon className="mx-auto h-12 w-12 text-cyan-300"/><p className="mt-3 text-xl font-black">{notice.startsWith("Could not")?notice:"Opening The Block…"}</p></div></div>}
    {leavingWorld&&<WorldLoadingOverlay tone="block" label="Leaving The Block…" />}
  </main>;
}
