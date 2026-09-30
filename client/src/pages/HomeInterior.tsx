import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ArrowLeft, Home, RotateCcw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { getAvatarCharacter } from "@/lib/avatarCharacters";
import { createPet } from "@/lib/pets";

type Payload={state:{selectedCharacter:string;equipped:Record<string,string>}};

function box(scene:THREE.Scene,size:[number,number,number],pos:[number,number,number],color:number){
  const m=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:.78}));
  m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;
}
function label(text:string,x:number,z:number){
  const c=document.createElement("canvas");c.width=512;c.height=120;const ctx=c.getContext("2d")!;
  ctx.fillStyle="rgba(15,23,42,.84)";ctx.beginPath();ctx.roundRect(8,8,496,104,28);ctx.fill();
  ctx.fillStyle="#fff";ctx.font="900 34px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,256,60);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:false}));s.scale.set(4.1,.95,1);s.position.set(x,4.4,z);return s;
}
function couch(scene:THREE.Scene,x:number,z:number,color:number){
  box(scene,[5,.8,1.7],[x,.45,z],color);box(scene,[5,1.45,.45],[x,1.05,z+.65],color);box(scene,[.5,1.1,1.7],[x-2.45,.65,z],color);box(scene,[.5,1.1,1.7],[x+2.45,.65,z],color);
}
function table(scene:THREE.Scene,x:number,z:number,color:number){
  box(scene,[3,.28,1.6],[x,.65,z],color);for(const dx of [-1.25,1.25])for(const dz of [-.55,.55])box(scene,[.18,1,.18],[x+dx,.28,z+dz],color);
}

export default function HomeInterior(){
  const {token}=useAuth();const [,navigate]=useLocation();
  const mountRef=useRef<HTMLDivElement>(null),rootRef=useRef<THREE.Group|null>(null),targetRef=useRef(new THREE.Vector3(0,0,7));
  const keysRef=useRef(new Set<string>()),cameraRef=useRef<THREE.PerspectiveCamera|null>(null),controlsRef=useRef<OrbitControls|null>(null);
  const [payload,setPayload]=useState<Payload|null>(null),[notice,setNotice]=useState("Walk through your rooms with WASD / arrow keys or tap the floor.");
  const headers=useMemo(()=>({Authorization:"Bearer "+token}),[token]);

  useEffect(()=>{if(!token)return;let live=true;fetch(API_BASE+"/api/avatar-world",{headers,cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.message||"Could not open your home.");return d;}).then(d=>{if(live)setPayload(d);}).catch((e:any)=>live&&setNotice(e.message));return()=>{live=false;};},[token]);

  useEffect(()=>{
    const mount=mountRef.current;if(!mount||!payload)return;let disposed=false,raf=0;
    const homeId=payload.state.equipped.home||"home-basic",dark=homeId==="home-loft",studio=homeId==="home-studio",modern=homeId==="home-modern";
    const wall=dark?0x292524:studio?0x334155:0xe5e7eb,floorColor=dark?0x3f3f46:studio?0x475569:modern?0xd6d3d1:0xcbd5e1,accent=dark?0xa855f7:studio?0x14b8a6:0x0ea5e9;
    const scene=new THREE.Scene();scene.background=new THREE.Color(dark?0x111827:studio?0x172033:0xdbeafe);scene.fog=new THREE.Fog(scene.background.getHex(),30,55);
    const camera=new THREE.PerspectiveCamera(54,1,.1,80);camera.position.set(0,7.5,15);cameraRef.current=camera;
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;mount.appendChild(renderer.domElement);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=5;controls.maxDistance=14;controls.maxPolarAngle=Math.PI*.47;controls.target.set(0,1.4,7);controlsRef.current=controls;
    scene.add(new THREE.HemisphereLight(0xffffff,0x64748b,2.2));const sun=new THREE.DirectionalLight(0xfff2d5,2.4);sun.position.set(-10,14,10);sun.castShadow=true;scene.add(sun);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(26,20),new THREE.MeshStandardMaterial({color:floorColor,roughness:.92}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.userData.ground=true;scene.add(floor);

    // Outer shell + real door opening.
    box(scene,[26,5.5,.45],[0,2.75,-10],wall);box(scene,[.45,5.5,20],[-13,2.75,0],wall);box(scene,[.45,5.5,20],[13,2.75,0],wall);
    box(scene,[10.5,5.5,.45],[-7.75,2.75,10],wall);box(scene,[10.5,5.5,.45],[7.75,2.75,10],wall);box(scene,[4.2,.5,.45],[0,5.25,10],wall);
    // Room walls with walk-through gaps.
    box(scene,[.35,5.1,6.2],[0,2.55,-6.9],wall);box(scene,[.35,5.1,5.6],[0,2.55,7.2],wall);
    box(scene,[10.6,5.1,.35],[-7.7,2.55,0],wall);box(scene,[9.4,5.1,.35],[8.3,2.55,0],wall);
    scene.add(label("LIVING ROOM",-6.4,5));scene.add(label("KITCHEN",6.4,5));scene.add(label("READING ROOM",-6.4,-5));scene.add(label("BEDROOM",6.4,-5));

    couch(scene,-6.4,6.6,0x475569);table(scene,-6.4,3.7,0x92400e);
    box(scene,[4.8,.95,1],[6.5,.5,6.8],0x78350f);box(scene,[4.8,.18,1.35],[6.5,1.05,6.8],0xf8fafc);box(scene,[2.2,2.5,.9],[9.8,1.25,8],0x94a3b8);
    box(scene,[5.2,2.3,.55],[-6.5,1.25,-8.7],0x713f12);for(let i=0;i<5;i++)box(scene,[.65,1.8,.35],[-8+i*.8,1.25,-8.35],[0x2563eb,0xdc2626,0x16a34a,0xca8a04,0x7c3aed][i]);
    couch(scene,-6.4,-4.5,0x0f766e);box(scene,[5.5,.65,7],[6.3,.35,-5.8],0x334155);box(scene,[5.2,1.5,.35],[6.3,1.45,-8.7],0x475569);box(scene,[1.2,2.8,1.2],[10.8,1.4,-7.6],accent);
    table(scene,6.4,-2.2,0x92400e);

    const loader=new GLTFLoader(),avatar=new THREE.Group();avatar.position.set(0,0,7.5);scene.add(avatar);rootRef.current=avatar;targetRef.current.copy(avatar.position);
    loader.load(getAvatarCharacter(payload.state.selectedCharacter||"robin-hood").modelPath,gltf=>{if(disposed)return;const m=gltf.scene,b=new THREE.Box3().setFromObject(m),s=b.getSize(new THREE.Vector3());m.scale.setScalar(2.5/Math.max(.01,s.y));m.updateMatrixWorld(true);const n=new THREE.Box3().setFromObject(m);m.position.y=-n.min.y;avatar.add(m);if(gltf.animations.length){const mixer=new THREE.AnimationMixer(m);mixer.clipAction(gltf.animations.find(a=>/idle/i.test(a.name))||gltf.animations[0]).play();avatar.userData.mixer=mixer;}});
    const pet=createPet(payload.state.equipped.pet,loader,.9);if(pet){pet.position.set(.9,0,.55);avatar.add(pet);}

    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down:{x:number;y:number}|null=null;
    const pd=(e:PointerEvent)=>down={x:e.clientX,y:e.clientY};
    const pu=(e:PointerEvent)=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>10){down=null;return;}down=null;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const h=ray.intersectObject(floor)[0];if(h)targetRef.current.set(THREE.MathUtils.clamp(h.point.x,-11.5,11.5),0,THREE.MathUtils.clamp(h.point.z,-8.8,8.8));};
    const kd=(e:KeyboardEvent)=>keysRef.current.add(e.key.toLowerCase()),ku=(e:KeyboardEvent)=>keysRef.current.delete(e.key.toLowerCase());
    renderer.domElement.addEventListener("pointerdown",pd);renderer.domElement.addEventListener("pointerup",pu);window.addEventListener("keydown",kd);window.addEventListener("keyup",ku);
    const resize=()=>{camera.aspect=mount.clientWidth/Math.max(1,mount.clientHeight);camera.updateProjectionMatrix();renderer.setSize(mount.clientWidth,mount.clientHeight);};resize();window.addEventListener("resize",resize);
    const clock=new THREE.Clock();
    const loop=()=>{if(disposed)return;const dt=Math.min(.05,clock.getDelta()),root=rootRef.current;if(root){let dx=0,dz=0,k=keysRef.current;if(k.has("w")||k.has("arrowup"))dz-=1;if(k.has("s")||k.has("arrowdown"))dz+=1;if(k.has("a")||k.has("arrowleft"))dx-=1;if(k.has("d")||k.has("arrowright"))dx+=1;if(dx||dz){const step=new THREE.Vector3(dx,0,dz).normalize().multiplyScalar(5*dt);targetRef.current.copy(root.position).add(step);}const d=targetRef.current.clone().sub(root.position);d.y=0;if(d.length()>.12){const mv=d.normalize().multiplyScalar(Math.min(d.length(),4.7*dt));root.position.add(mv);root.position.x=THREE.MathUtils.clamp(root.position.x,-11.7,11.7);root.position.z=THREE.MathUtils.clamp(root.position.z,-8.8,9);root.rotation.y=Math.atan2(mv.x,mv.z);}root.userData.mixer?.update?.(dt);const focus=new THREE.Vector3(root.position.x,1.4,root.position.z);const shift=focus.clone().sub(controls.target);controls.target.copy(focus);camera.position.add(shift);camera.position.y=THREE.MathUtils.clamp(camera.position.y,2.3,8.5);}controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(loop);};loop();
    return()=>{disposed=true;cancelAnimationFrame(raf);window.removeEventListener("resize",resize);window.removeEventListener("keydown",kd);window.removeEventListener("keyup",ku);renderer.domElement.removeEventListener("pointerdown",pd);renderer.domElement.removeEventListener("pointerup",pu);controls.dispose();renderer.dispose();if(renderer.domElement.parentElement===mount)mount.removeChild(renderer.domElement);rootRef.current=null;};
  },[payload?.state.selectedCharacter,payload?.state.equipped.home,payload?.state.equipped.pet]);

  return <main className="club-world-root relative h-[100dvh] overflow-hidden bg-slate-900 text-white">
    <div ref={mountRef} className="absolute inset-0 touch-none"/>
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-slate-950/90 to-transparent p-3">
      <button onClick={()=>navigate("/neighborhood")} className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-xl bg-slate-950/80 px-3 font-black"><ArrowLeft className="h-4 w-4"/> The Block</button>
      <div className="flex-1"><p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">My Home</p><h1 className="text-xl font-black">Walkable House Interior</h1></div>
      <button onClick={()=>{const r=rootRef.current,c=cameraRef.current,o=controlsRef.current;if(r&&c&&o){r.position.set(0,0,7.5);targetRef.current.copy(r.position);c.position.set(0,7.5,15);o.target.set(0,1.4,7.5);o.update();setNotice("Home view reset.");}} className="pointer-events-auto grid h-11 w-11 place-items-center rounded-xl bg-slate-950/80" aria-label="Reset home view"><RotateCcw className="h-4 w-4"/></button>
    </header>
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-xl bg-slate-950/75 px-4 py-2 text-center text-xs font-bold backdrop-blur">{notice}</div>
    {!payload&&<div className="absolute inset-0 z-40 grid place-items-center bg-slate-950"><div className="text-center"><Home className="mx-auto h-10 w-10"/><p className="mt-3 font-black">Opening your house…</p></div></div>}
  </main>;
}
